/**
 * HTTPとMCPの実行操作をCoordinator、実行定義をExecution Modelへ接続する。
 * @packageDocumentation
 * @responsibility 実行の対象・主体・公開前再照合と、実行定義の入力形式・操作対応を共通化する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary 通信方式に依存しない実行・定義受付とCoordinator・Execution Model・AM。
 */
import type { AuthorizedRepository } from "@qual-lab/crdd-access-management";
import type {
  ExecutionActivityObservation,
  ExecutionActivityRequest,
  ExecutionSelection,
  SingleTaskCommand,
  WorkspaceResult,
} from "@qual-lab/crdd-coordinator";
import type { RepositoryProjectContext } from "@qual-lab/crdd-document-model";
import {
  inspectAiSelectionChoice,
  readRepositoryManifest,
} from "@qual-lab/crdd-configuration-model";

import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { types } from "node:util";
import {
  onAccessStatePublication,
  type FilesystemStoreRoot,
} from "@qual-lab/crdd-access-management";
import {
  createLocalPrincipalId,
  createObjective,
  createTask,
  deleteObjective,
  deleteTask,
  ExecutionStorageBlockedError,
  type ExecutionModelAccess,
  initializeExecutionState,
  isPrincipalId,
  queryObjectives,
  queryPlan,
  queryTasks,
  savePlan,
  updateObjective,
  updateTask,
} from "@qual-lab/crdd-execution-model";
import {
  getRepository,
  readGitUser,
  readRepositoryRevision,
  registerRepositoryLocalIgnore,
  resolveVerifiedRepositoryRoot,
  type Repository,
} from "@qual-lab/crdd-version-control";
import {
  type HostedAccessSession,
  openHostedExecutionAccess,
  resolveHostedDevelopmentAccess,
} from "./access.ts";

/** サーバーが許可した定義操作と、その初回保存の準備。 @trace ARCH-000012 */
export type DefinitionAccess = ExecutionModelAccess &
  Readonly<{
    readInitialPlanRevision: () => string | null;
    prepareDirectory: () => boolean;
    canPublish?: ExecutionModelAccess["revalidate"];
  }>;

/**
 * 確定した保存先とサーバー所有の初回準備を定義操作へ渡す。
 * @trace ARCH-000012
 * @precondition 呼出し元が同じRepositoryの認可と正規ディレクトリを確認する。
 */
export function createDefinitionAccess(
  repository: Repository,
  directory: string,
  principalId: string,
  revalidate: ExecutionModelAccess["revalidate"],
): DefinitionAccess {
  return {
    root: { directory },
    principalId,
    readInitialPlanRevision: () =>
      readRepositoryRevision(repository)?.revisionIdentity ?? null,
    prepareDirectory: () => {
      const ignore = registerRepositoryLocalIgnore(repository, ".crdd/");
      if (ignore.status !== "registered")
        throw new ExecutionStorageBlockedError({
          ...ignore,
          reason: "repository_runtime_data_ignore_registration_blocked",
        });
      return true;
    },
    revalidate,
  };
}

/** 起動先の識別子と現在の定義対象を結び付ける。 @trace ARCH-000012 */
export function resolveLocalDefinitionAccess(
  repository: Repository,
  repositoryId: string,
  signal: AbortSignal,
): DefinitionAccess | null {
  if (signal.aborted) return null;
  const root = resolveVerifiedRepositoryRoot(repository);
  if (!root) return null;
  const initial = readRepositoryManifest(root);
  if (
    initial.status !== "ready" ||
    initial.manifest.repositoryId !== repositoryId
  )
    return null;
  const gitUser = readGitUser(repository);
  const principalId =
    gitUser.status === "completed"
      ? createLocalPrincipalId(gitUser.email)
      : null;
  if (!principalId) return null;
  return createDefinitionAccess(
    repository,
    root,
    principalId,
    (operation, target) => {
      if (
        signal.aborted ||
        (operation !== "definition.read" && operation !== "definition.write") ||
        target.projectId !== initial.manifest.projectId ||
        resolveVerifiedRepositoryRoot(repository) !== root
      )
        return false;
      const current = readRepositoryManifest(root);
      return (
        current.status === "ready" && current.identity === initial.identity
      );
    },
  );
}

/** 外部権限の照会は保存ロックの前に完了する。 @trace ARCH-000012 */
export async function resolveHostedDefinitionAccess(
  root: FilesystemStoreRoot,
  session: HostedAccessSession,
  repositoryId: string,
  write: boolean,
  signal: AbortSignal,
): Promise<DefinitionAccess | null> {
  const access = await resolveHostedDevelopmentAccess(
    root,
    session,
    repositoryId,
    write,
    signal,
  );
  if (!access || signal.aborted) return null;
  const repository = getRepository(access.ownerRoot);
  if (repository.status !== "completed") return null;
  const canPublish: ExecutionModelAccess["revalidate"] = (operation, target) =>
    !signal.aborted &&
    operation === (write ? "definition.write" : "definition.read") &&
    target.projectId === access.projectId &&
    resolveVerifiedRepositoryRoot(repository.capability) === access.ownerRoot &&
    access.authorize();
  return {
    ...createDefinitionAccess(
      repository.capability,
      access.ownerRoot,
      session.principal.userId,
      canPublish,
    ),
    canPublish,
  };
}

export const definitionReadFields = {
  plan: [],
  objectives: [],
  tasks: ["queueId"],
} as const;

export const definitionWriteFields = {
  initialize: ["expectedAbsence"],
  "plan.save": ["expected", "definition", "expectedDefinitionHash"],
  "objective.create": ["expected", "definition"],
  "objective.update": [
    "expected",
    "objectiveId",
    "definition",
    "expectedDefinitionHash",
  ],
  "objective.delete": ["expected", "objectiveId", "expectedDefinitionHash"],
  "task.create": ["expected", "definition"],
  "task.update": ["expected", "taskId", "definition", "expectedDefinitionHash"],
  "task.delete": ["expected", "taskId", "expectedDefinitionHash"],
} as const;

export type ExecutionDefinitionOperation =
  | keyof typeof definitionReadFields
  | keyof typeof definitionWriteFields;

const definitionBase =
  "/api/repositories/:repositoryId/projects/:projectId/milestones/:milestoneId";

// 一つの定義操作に一つずつHTTPリソースとMCPツールを対応させる。
export const executionDefinitionResources = {
  plan: {
    method: "get",
    path: `${definitionBase}/plan`,
    tool: "crdd.get_execution_plan",
  },
  objectives: {
    method: "get",
    path: `${definitionBase}/objectives`,
    tool: "crdd.list_objectives",
  },
  tasks: {
    method: "get",
    path: `${definitionBase}/tasks`,
    tool: "crdd.list_tasks",
  },
  initialize: {
    method: "post",
    path: `${definitionBase}/definition`,
    tool: "crdd.initialize_execution_definition",
  },
  "plan.save": {
    method: "put",
    path: `${definitionBase}/plan`,
    tool: "crdd.save_execution_plan",
  },
  "objective.create": {
    method: "post",
    path: `${definitionBase}/objectives`,
    tool: "crdd.create_objective",
  },
  "objective.update": {
    method: "patch",
    path: `${definitionBase}/objectives/:objectiveId`,
    tool: "crdd.update_objective",
  },
  "objective.delete": {
    method: "delete",
    path: `${definitionBase}/objectives/:objectiveId`,
    tool: "crdd.delete_objective",
  },
  "task.create": {
    method: "post",
    path: `${definitionBase}/tasks`,
    tool: "crdd.create_task",
  },
  "task.update": {
    method: "patch",
    path: `${definitionBase}/tasks/:taskId`,
    tool: "crdd.update_task",
  },
  "task.delete": {
    method: "delete",
    path: `${definitionBase}/tasks/:taskId`,
    tool: "crdd.delete_task",
  },
} as const satisfies Record<
  ExecutionDefinitionOperation,
  {
    method: "get" | "post" | "put" | "patch" | "delete";
    path: string;
    tool: `crdd.${string}`;
  }
>;

type ExecutionDefinitionInput = Readonly<
  Record<string, unknown> & { projectId: unknown; milestoneId: unknown }
>;

type ExecutionDefinitionCommand = Readonly<{
  operation: ExecutionDefinitionOperation;
  input: ExecutionDefinitionInput;
}>;

/**
 * 通信形式から取り出した操作を、読み書きの区分に従って捕捉する。
 * @responsibility 操作名と必須・余剰fieldの扱いを二つの入口で一致させる。
 * @trace ARCH-000012
 * @boundary 入力の形だけを受付し、値の意味・認可・CASはExecution Modelに委ねる。
 */
export function validateExecutionDefinitionCommand(
  value: unknown,
  mode: "read" | "write",
): ExecutionDefinitionCommand | null {
  const fieldsByOperation: Partial<
    Record<ExecutionDefinitionOperation, readonly string[]>
  > = mode === "read" ? definitionReadFields : definitionWriteFields;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const command = value as Record<string, unknown>;
  if (!Object.hasOwn(command, "operation")) return null;
  const rawOperation = command.operation;
  if (typeof rawOperation !== "string") return null;
  const operation = rawOperation as ExecutionDefinitionOperation;
  const operationFields = Object.hasOwn(fieldsByOperation, operation)
    ? fieldsByOperation[operation]
    : undefined;
  if (!operationFields) return null;
  const allowedFields = [
    "operation",
    "projectId",
    "milestoneId",
    ...operationFields,
  ];
  const receivedFields = Object.keys(command);
  if (
    allowedFields.some(
      (key) =>
        (operation !== "tasks" || key !== "queueId") &&
        !Object.hasOwn(command, key),
    ) ||
    receivedFields.some((key) => !allowedFields.includes(key))
  )
    return null;
  const { operation: _operation, projectId, milestoneId, ...input } = command;
  return { operation, input: { projectId, milestoneId, ...input } };
}

/**
 * 通信側が確定した現在認可で、定義操作を一度だけ発行する。
 * @responsibility 操作とExecution Model APIの対応を所有し、結果を再解釈しない。
 * @trace ARCH-000008
 * @trace ARCH-000012
 * @boundary 通信の認可・取消・結果配送を代替しない。
 */
export function executeDefinitionOperation(
  access: DefinitionAccess,
  { operation, input }: ExecutionDefinitionCommand,
): unknown {
  // 型の絞り込みは検査ではない。Execution Modelの検査・認可・CASをそのまま使う。
  switch (operation) {
    case "initialize":
      return initializeExecutionState(
        access,
        input as Parameters<typeof initializeExecutionState>[1],
        access.prepareDirectory,
      );
    case "plan.save": {
      const plan = input as Parameters<typeof savePlan>[1];
      const initialSourceRevision =
        plan.expectedDefinitionHash === null &&
        typeof plan.projectId === "string" &&
        typeof plan.milestoneId === "string" &&
        access.revalidate("definition.write", {
          projectId: plan.projectId,
          milestoneId: plan.milestoneId,
        })
          ? access.readInitialPlanRevision()
          : null;
      return savePlan({ ...access, initialSourceRevision }, plan);
    }
    case "objective.create":
      return createObjective(
        access,
        input as Parameters<typeof createObjective>[1],
      );
    case "objective.update":
      return updateObjective(
        access,
        input as Parameters<typeof updateObjective>[1],
      );
    case "objective.delete":
      return deleteObjective(
        access,
        input as Parameters<typeof deleteObjective>[1],
      );
    case "task.create":
      return createTask(access, input as Parameters<typeof createTask>[1]);
    case "task.update":
      return updateTask(access, input as Parameters<typeof updateTask>[1]);
    case "task.delete":
      return deleteTask(access, input as Parameters<typeof deleteTask>[1]);
    case "plan":
      return queryPlan(access, input as Parameters<typeof queryPlan>[1]);
    case "objectives":
      return queryObjectives(
        access,
        input as Parameters<typeof queryObjectives>[1],
      );
    case "tasks":
      return queryTasks(access, input as Parameters<typeof queryTasks>[1]);
  }
}

/** 既存の直接構成で与える実行操作。 @trace ARCH-000012 */
export type CoordinatorExecutionDependencies = Readonly<{
  authenticateClient: () => unknown;
  runObjective: (
    request: Readonly<Record<string, unknown>>,
    signal: AbortSignal,
    authentication: Readonly<{ principalId: string }>,
  ) => Promise<unknown>;
  getProjectState: (
    request: Readonly<Record<string, unknown>>,
    authentication: Readonly<{ principalId: string }>,
  ) => Promise<unknown>;
}>;

const requiredObjectiveFields = [
  "plan",
  "taskInputs",
  "requestId",
  "projectId",
  "milestoneId",
  "repositoryRevision",
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "readPaths",
  "maximumConcurrency",
  "maximumReplans",
  "originLane",
  "adoptResult",
] as const;

/** RESTとMCPへ同じObjective要求Schemaを渡す。実際の受付はCoordinatorが意味を検査する。 @trace ARCH-000012 */
export function objectiveRequestSchema(exclude: readonly string[] = []) {
  const id = Object.freeze({
    type: "string",
    pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$",
  });
  const rev = Object.freeze({ type: "string", pattern: "^[0-9a-f]{40,64}$" });
  const list = (maximum: number) =>
    Object.freeze({
      type: "array",
      minItems: 1,
      maxItems: maximum,
      items: Object.freeze({ type: "string" }),
    });
  const properties = {
    plan: {
      type: "object",
      additionalProperties: false,
      required: ["milestoneAcceptanceCriteria", "objectives", "tasks"],
      properties: {
        milestoneAcceptanceCriteria: list(128),
        objectives: {
          type: "array",
          minItems: 1,
          maxItems: 128,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "acceptanceCriteria"],
            properties: { id, acceptanceCriteria: list(128) },
          },
        },
        tasks: {
          type: "array",
          minItems: 1,
          maxItems: 1024,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "objectiveId",
              "dependencies",
              "allowedPaths",
              "conflictKeys",
            ],
            properties: {
              id,
              objectiveId: id,
              dependencies: { ...list(128), minItems: 0 },
              allowedPaths: list(128),
              conflictKeys: { ...list(128), minItems: 0 },
            },
          },
        },
      },
    },
    taskInputs: {
      type: "array",
      minItems: 1,
      maxItems: 1024,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["taskId", "objective", "acceptanceCriteria", "readPaths"],
        properties: {
          taskId: id,
          objective: { type: "string", minLength: 1, maxLength: 16_384 },
          acceptanceCriteria: list(128),
          readPaths: list(128),
        },
      },
    },
    requestId: id,
    projectId: id,
    milestoneId: id,
    repositoryRevision: rev,
    objective: Object.freeze({ type: "string", maxLength: 16_384 }),
    acceptanceCriteria: list(128),
    allowedPaths: list(128),
    readPaths: list(128),
    maximumConcurrency: Object.freeze({
      type: "integer",
      minimum: 1,
      maximum: 5,
    }),
    maximumReplans: Object.freeze({
      type: "integer",
      minimum: 0,
      maximum: 32,
    }),
    originLane: Object.freeze({
      enum: Object.freeze(["interactive", "scheduled"]),
    }),
    adoptResult: Object.freeze({ type: "boolean" }),
    workType: Object.freeze({
      type: "string",
      pattern: "^[a-z0-9][a-z0-9._-]*$",
    }),
    choice: Object.freeze({
      type: "object",
      additionalProperties: false,
      required: Object.freeze(["provider", "model", "effort"]),
      properties: Object.freeze({
        provider: Object.freeze({
          enum: Object.freeze(["codex", "claude"]),
        }),
        model: Object.freeze({
          type: "string",
          maxLength: 128,
          pattern: "^[a-z0-9][a-z0-9._-]{0,127}$",
        }),
        effort: Object.freeze({
          enum: Object.freeze(["low", "medium", "high", "xhigh", "max"]),
        }),
      }),
    }),
    workspaceId: Object.freeze({
      type: "string",
      pattern: "^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$",
    }),
  };
  return {
    type: "object" as const,
    additionalProperties: false,
    properties: Object.fromEntries(
      Object.entries(properties).filter(([name]) => !exclude.includes(name)),
    ),
    required: requiredObjectiveFields.filter((name) => !exclude.includes(name)),
  };
}

/** 各入口が使う同じ実行系操作。 @trace ARCH-000012 */
export type CoordinatorExecutionOperation =
  | "objective"
  | "decision"
  | "state"
  | "cancel";

/** 判断の公開操作と各表面に共通する受付項目。意味検査はCoordinatorが所有する。 @trace ARCH-000012 */
export const executionDecisionTools = {
  request: "crdd.request_decision",
  answer: "crdd.answer_decision",
  apply: "crdd.apply_decision",
  close: "crdd.close_decision",
} as const;

export type DecisionAction = keyof typeof executionDecisionTools;

export function decisionRequestSchema(
  action: DecisionAction,
  exclude: readonly string[] = [],
) {
  const id = { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$" };
  const decisionText = {
    type: "string",
    minLength: 1,
    pattern:
      "^(?=[\\s\\S]*\\S)[^\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]*(?![\\s\\S])",
  };
  const variants = {
    request: {
      blockerId: id,
      queueId: id,
      question: decisionText,
      allowedOptions: {
        type: "array",
        minItems: 1,
        maxItems: 2,
        uniqueItems: true,
        items: { enum: ["resume", "cancel"] },
      },
    },
    answer: {
      selectedOption: { enum: ["resume", "cancel"] },
      comment: {
        type: "string",
        pattern: "^[^\\u0000-\\u001f\\u007f]*(?![\\s\\S])",
      },
    },
    apply: {},
    close: {
      status: { const: "invalidated" },
      reason: decisionText,
    },
  } as const;
  const properties = Object.fromEntries(
    Object.entries({
      decisionId: id,
      projectId: id,
      milestoneId: id,
      generation: { type: "integer", minimum: 1 },
      repositoryRevision: {
        type: "string",
        pattern: "^(?:[0-9a-f]{40}|[0-9a-f]{64})$",
      },
      ...variants[action],
    }).filter(([name]) => !exclude.includes(name)),
  );
  return {
    type: "object" as const,
    additionalProperties: false,
    properties,
    required: Object.keys(properties).filter((name) => name !== "comment"),
  };
}

export type ExecutionWriteAction = "start" | "resume" | DecisionAction;

const executionIdentifier = "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$";
const objectiveLaunchIdentifier =
  "^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$";

/** 取消要求を特定の起動に結び付ける。 @trace ARCH-000012 */
export function objectiveCancellationSchema(exclude: readonly string[] = []) {
  const properties = Object.fromEntries(
    Object.entries({
      requestId: { type: "string", pattern: executionIdentifier },
      projectId: { type: "string", pattern: executionIdentifier },
      launchId: { type: "string", pattern: objectiveLaunchIdentifier },
    }).filter(([key]) => !exclude.includes(key)),
  );
  return {
    type: "object" as const,
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}

type ActiveObjectiveTarget = Readonly<{
  scope: "local" | "shared";
  repositoryId: string | null;
  ownerRoot: string;
  bindingId?: string | undefined;
  hostedBinding?: string | undefined;
  principalId: string;
  projectId: string;
  requestId: string;
}>;

function objectiveDirectoryIdentity(root: string): string | null {
  try {
    const directory = statSync(root, { bigint: true });
    return directory.isDirectory() && directory.ino !== 0n
      ? `${directory.dev}:${directory.ino}`
      : null;
  } catch {
    return null;
  }
}

function sameObjectiveTarget(
  a: ActiveObjectiveTarget,
  b: ActiveObjectiveTarget,
) {
  return (
    a.scope === b.scope &&
    a.repositoryId === b.repositoryId &&
    a.ownerRoot === b.ownerRoot &&
    a.bindingId === b.bindingId &&
    a.hostedBinding === b.hostedBinding &&
    a.principalId === b.principalId &&
    a.projectId === b.projectId &&
    a.requestId === b.requestId
  );
}

/** 起動中の子だけを追跡する。永続状態や実行結果は所有しない。 @trace ARCH-000012 */
export function createObjectiveRuns() {
  const active = new Map<
    string,
    Readonly<{
      identity: string;
      target: ActiveObjectiveTarget;
      cancellation: AbortController;
    }>
  >();
  return {
    attach(target: ActiveObjectiveTarget) {
      const identity = objectiveDirectoryIdentity(target.ownerRoot);
      if (
        !identity ||
        [...active.values()].some(({ target: current }) =>
          sameObjectiveTarget(current, target),
        )
      )
        return null;
      const launchId = randomUUID();
      const cancellation = new AbortController();
      active.set(launchId, { identity, target, cancellation });
      return {
        signal: cancellation.signal,
        close: () => active.delete(launchId),
      };
    },
    read(target: ActiveObjectiveTarget) {
      for (const [launchId, entry] of active) {
        if (
          sameObjectiveTarget(entry.target, target) &&
          entry.identity === objectiveDirectoryIdentity(target.ownerRoot)
        )
          return launchId;
      }
      return null;
    },
    cancel(
      launchId: string,
      target: ActiveObjectiveTarget,
      signal: AbortSignal,
    ) {
      const entry = active.get(launchId);
      if (
        !entry ||
        !sameObjectiveTarget(entry.target, target) ||
        entry.identity !== objectiveDirectoryIdentity(target.ownerRoot) ||
        signal.aborted
      )
        return false;
      entry.cancellation.abort();
      return true;
    },
  };
}

export type ObjectiveRuns = ReturnType<typeof createObjectiveRuns>;

/** 起動Repositoryまたは共有の認証資格から現在対象を確定する。 @trace ARCH-000012 */
export type CoordinatorExecutionConfiguration =
  | CoordinatorExecutionDependencies
  | Readonly<{
      scope: "local";
      repositoryRoot: string;
      repositoryId?: string;
      objectiveRuns?: ObjectiveRuns;
    }>
  | Readonly<{
      scope: "shared";
      objectiveRuns?: ObjectiveRuns;
      observeClient?: NonNullable<HostedAccessSession["observeClient"]>;
      credentials: { root: FilesystemStoreRoot; hosted: HostedAccessSession };
    }>;

type CoordinatorModule = typeof import("@qual-lab/crdd-coordinator");
const executionAccessCheckIntervalMs = 15_000;

type ExecutionTarget = Readonly<{
  ownerRoot: string;
  bindingId?: string | undefined;
  hostedBinding?: string | undefined;
  principalId: string;
  authorize?: () => boolean;
  authorizeAdmission?: () => boolean;
  watch?: Readonly<{
    accessRoot: FilesystemStoreRoot;
    revocationSignal?: AbortSignal | undefined;
    observe: NonNullable<
      Awaited<ReturnType<typeof openHostedExecutionAccess>>
    >["observe"];
  }>;
  refresh?: NonNullable<
    Awaited<ReturnType<typeof openHostedExecutionAccess>>
  >["refresh"];
}>;

/** 短い照会・判断を本人のGitホスト権限へ結び付ける。資格はCoordinatorへ渡さない。 @trace ARCH-000012 */
async function resolveHostedExecutionTarget(
  root: FilesystemStoreRoot,
  session: HostedAccessSession,
  repositoryId: string,
  projectId: string,
  write: boolean,
  signal: AbortSignal,
): Promise<ExecutionTarget | null> {
  const current = () => !signal.aborted && (session.isCurrent?.() ?? true);
  if (!current()) return null;
  const target = await resolveHostedDevelopmentAccess(
    root,
    session,
    repositoryId,
    write,
    signal,
  );
  if (!target || target.projectId !== projectId || !current()) return null;
  return {
    ownerRoot: target.ownerRoot,
    bindingId: target.bindingId,
    principalId: session.principal.userId,
    hostedBinding: "hostedBinding" in target ? target.hostedBinding : undefined,
    authorize: () => current() && target.authorize() && current(),
  };
}

/** 起動Repositoryと現在のGitローカル主体を照合する。 @trace ARCH-000012 */
function resolveLocalExecutionTarget(
  repositoryRoot: string,
  signal: AbortSignal,
  repositoryId?: string,
): ExecutionTarget | null {
  if (signal.aborted) return null;
  const repository = getRepository(repositoryRoot);
  if (
    repository.status !== "completed" ||
    resolveVerifiedRepositoryRoot(repository.capability) !== repositoryRoot
  )
    return null;
  if (repositoryId !== undefined) {
    const manifest = readRepositoryManifest(repositoryRoot);
    if (
      manifest.status !== "ready" ||
      manifest.manifest.repositoryId !== repositoryId
    )
      return null;
  }
  const user = readGitUser(repository.capability);
  const principalId =
    user.status === "completed" ? createLocalPrincipalId(user.email) : null;
  return principalId && !signal.aborted
    ? { ownerRoot: repositoryRoot, principalId }
    : null;
}

/**
 * Coordinator読込み前に引数を独立捕捉する。
 * @responsibility 意味検査はCoordinatorに残し、待機中の参照変更を防ぐ。
 * @trace ARCH-000012
 * @boundary MCP入力からCoordinatorを読み込む非同期境界。
 * @security 待機後に使用する要求値を確定する。循環参照は拒否する。
 */
function captureCoordinatorArguments(value: unknown): unknown {
  const ancestors = new Set<object>();
  const capture = (entry: unknown): unknown => {
    if (
      entry === null ||
      entry === undefined ||
      typeof entry === "string" ||
      typeof entry === "boolean" ||
      typeof entry === "number"
    )
      return entry;
    if (typeof entry !== "object" || ancestors.has(entry))
      throw new Error("mcp_coordinator_input_invalid");
    ancestors.add(entry);
    try {
      if (Array.isArray(entry))
        return Object.freeze(Array.from(entry, capture));
      return Object.freeze(
        Object.fromEntries(
          Object.entries(entry).map(([key, item]) => [key, capture(item)]),
        ),
      );
    } finally {
      ancestors.delete(entry);
    }
  };
  return capture(value);
}

/**
 * 対象Repositoryに対して一つのCoordinator操作を完了させる。
 * @responsibility 結果の意味と公開条件を共通化し、HTTPやJSON-RPCへの変換はしない。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 固定操作、未信頼引数、起動または要求に結び付いた対象選択、取消Signal。
 * @returns 検査済みの操作結果、または配送前拒否・結果公開不能の区分。
 * @effect 既存Coordinatorの操作を一度だけ呼ぶ。取消は保存の巻戻しを意味しない。
 * @security 共有では認証・対象・公開前の再照合を省略しない。
 */
export async function executeCoordinatorOperation(
  operation: CoordinatorExecutionOperation,
  raw: unknown,
  configuration: CoordinatorExecutionConfiguration,
  signal: AbortSignal,
  action?: ExecutionWriteAction,
) {
  if (signal.aborted) return { kind: "cancelled" } as const;
  const scope = "scope" in configuration ? configuration.scope : null;
  let captured: unknown;
  let repositoryId: string | null = null;
  try {
    captured = captureCoordinatorArguments(raw);
    if (scope === "shared") {
      if (
        !captured ||
        typeof captured !== "object" ||
        Array.isArray(captured) ||
        !Object.hasOwn(captured, "repositoryId")
      )
        return { kind: "invalid" } as const;
      const target = captured as Readonly<Record<string, unknown>>;
      const { repositoryId: requested, ...input } = target;
      if (
        typeof requested !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(requested)
      )
        return { kind: "invalid" } as const;
      repositoryId = requested;
      captured = Object.freeze(input);
    }
    if (action !== undefined) {
      const expected =
        action === "start" || action === "resume" ? "objective" : "decision";
      if (
        operation !== expected ||
        !captured ||
        typeof captured !== "object" ||
        Array.isArray(captured) ||
        Object.hasOwn(captured, "operation")
      )
        return { kind: "invalid" } as const;
      captured = Object.freeze({ ...captured, operation: action });
    }
  } catch {
    return { kind: "invalid" } as const;
  }
  let coordinator: CoordinatorModule;
  try {
    coordinator = await import("@qual-lab/crdd-coordinator");
  } catch {
    return { kind: signal.aborted ? "cancelled" : "unavailable" } as const;
  }
  if (signal.aborted) return { kind: "cancelled" } as const;
  const {
    inspectCoordinatorDecisionRequest,
    inspectCoordinatorObjectiveRequest,
    inspectCoordinatorObjectiveResult,
    inspectCoordinatorStateQuery,
    inspectCoordinatorStateQueryResult,
  } = coordinator;
  if (
    ![
      inspectCoordinatorDecisionRequest,
      inspectCoordinatorObjectiveRequest,
      inspectCoordinatorObjectiveResult,
      inspectCoordinatorStateQuery,
      inspectCoordinatorStateQueryResult,
      ...(scope ? [coordinator.submitDecision, coordinator.queryState] : []),
    ].every((inspect) => typeof inspect === "function")
  )
    return { kind: "unavailable" } as const;
  const resolveLocalTarget = () =>
    "scope" in configuration && configuration.scope === "local"
      ? resolveLocalExecutionTarget(
          configuration.repositoryRoot,
          signal,
          configuration.repositoryId,
        )
      : null;
  const resolveSharedTarget = (projectId: string, write: boolean) =>
    "scope" in configuration &&
    configuration.scope === "shared" &&
    repositoryId !== null
      ? resolveHostedExecutionTarget(
          configuration.credentials.root,
          configuration.credentials.hosted,
          repositoryId,
          projectId,
          write,
          signal,
        )
      : null;
  const id = (value: unknown): value is string =>
    typeof value === "string" &&
    new RegExp(executionIdentifier, "u").test(value);
  const runIdentity = (
    target: ExecutionTarget,
    projectId: string,
    requestId: string,
  ) => ({
    scope: scope ?? "local",
    repositoryId,
    ownerRoot: target.ownerRoot,
    bindingId: target.bindingId,
    hostedBinding: target.hostedBinding,
    principalId: target.principalId,
    projectId,
    requestId,
  });
  const objectiveRuns =
    "scope" in configuration ? configuration.objectiveRuns : undefined;
  const observeClient =
    "scope" in configuration && configuration.scope === "shared"
      ? configuration.observeClient
      : undefined;
  if (operation === "cancel") {
    if (
      !captured ||
      typeof captured !== "object" ||
      Reflect.ownKeys(captured).length !== 3 ||
      !("projectId" in captured && id(captured.projectId)) ||
      !("requestId" in captured && id(captured.requestId)) ||
      !(
        "launchId" in captured &&
        typeof captured.launchId === "string" &&
        new RegExp(objectiveLaunchIdentifier, "u").test(captured.launchId)
      )
    )
      return { kind: "invalid" } as const;
    if (!objectiveRuns) return { kind: "unavailable" } as const;
    const { projectId, requestId, launchId } = captured;
    try {
      const target =
        scope === "shared"
          ? await resolveSharedTarget(projectId, true)
          : resolveLocalTarget();
      if (signal.aborted) return { kind: "cancelled" } as const;
      if (
        target &&
        observeClient &&
        (await observeClient(signal)) !== "current"
      )
        return {
          kind: signal.aborted ? "cancelled" : "access_denied",
        } as const;
      if (
        target &&
        (!target.authorize || target.authorize()) &&
        objectiveRuns.cancel(
          launchId,
          runIdentity(target, projectId, requestId),
          signal,
        )
      )
        return { kind: "cancellation_requested" } as const;
    } catch {
      // 観測不能から取消を発行せず、対象の存在も公開しない。
    }
    return { kind: signal.aborted ? "cancelled" : "access_denied" } as const;
  }
  if (operation === "objective" && scope !== null) {
    // 子を起動する前は配送先だけを確定する。計画の検査はCoordinatorだけが行う。
    if (
      !captured ||
      typeof captured !== "object" ||
      !("projectId" in captured) ||
      typeof captured.projectId !== "string"
    )
      return { kind: "invalid" } as const;
    let target: ExecutionTarget | null;
    let closeTarget: (() => void) | undefined;
    try {
      if (
        "scope" in configuration &&
        configuration.scope === "shared" &&
        repositoryId !== null
      ) {
        const { root, hosted } = configuration.credentials;
        const admission = await openHostedExecutionAccess(
          root,
          hosted,
          repositoryId,
          { projectId: captured.projectId, permission: "write" },
          signal,
        );
        closeTarget = admission?.close;
        target = admission && {
          ownerRoot: admission.ownerRoot,
          bindingId: admission.bindingId,
          hostedBinding: admission.hostedBinding,
          principalId: admission.principalId,
          authorize: () => admission.observe() === "current",
          authorizeAdmission: admission.authorizedAtAdmission,
          watch: {
            accessRoot: root,
            observe: admission.observe,
            revocationSignal: admission.revocationSignal,
          },
          refresh: admission.refresh,
        };
      } else {
        target = resolveLocalTarget();
      }
      if (
        !target ||
        !isPrincipalId(target.principalId) ||
        (scope === "shared" && !target.authorize?.()) ||
        target.authorizeAdmission?.() === false
      )
        target = null;
    } catch {
      target = null;
    }
    try {
      if (signal.aborted) return { kind: "cancelled" } as const;
      if (!target) return { kind: "access_denied" } as const;
      const { authorize, authorizeAdmission, ownerRoot, principalId } = target;
      const requestId =
        "requestId" in captured ? captured.requestId : undefined;
      const active =
        objectiveRuns && id(requestId)
          ? objectiveRuns.attach(
              runIdentity(target, captured.projectId, requestId),
            )
          : undefined;
      if (active === null) return { kind: "unavailable" } as const;
      const reception: {
        status: "pending" | "access_denied" | "cancelled" | "accepted";
        workspaceId: string | null;
      } = { status: "pending", workspaceId: null };
      let effectAuthorized = false;
      let publicationBlocked = false;
      const refusal = (reason: "cancelled" | "access_denied") => {
        if (effectAuthorized) publicationBlocked = true;
        else reception.status = reason;
        return false;
      };
      const canGrant = () => {
        if (publicationBlocked) return false;
        if (active?.signal.aborted) return false;
        if (signal.aborted) return refusal("cancelled");
        try {
          if (!effectAuthorized && authorizeAdmission?.() === false)
            return refusal("access_denied");
          if (!authorize || authorize()) return true;
        } catch {
          /* 認可の観測不能は拒否する。 */
        }
        return refusal("access_denied");
      };
      let result: unknown;
      let unsubscribe: (() => void) | undefined;
      let accessTimer: ReturnType<typeof setInterval> | undefined;
      const sharedTarget = target.watch;
      const revocation = sharedTarget ? new AbortController() : null;
      const monitoring = new AbortController();
      const monitorSignal = AbortSignal.any([
        signal,
        monitoring.signal,
        ...(revocation ? [revocation.signal] : []),
        ...(active ? [active.signal] : []),
      ]);
      // 開始済み実行は、当該HTTP／MCP要求の資格ではなく対象の現在認可を確認する。
      const refresh = target.refresh;
      let inFlight:
        | ReturnType<NonNullable<ExecutionTarget["refresh"]>>
        | undefined;
      const checkExternal = () => {
        if (!refresh) return undefined;
        if (inFlight) return inFlight;
        const checking = refresh(monitorSignal).finally(() => {
          if (inFlight === checking) inFlight = undefined;
        });
        inFlight = checking;
        return checking;
      };
      const stopOnRevocation = (current: string) => {
        if (current === "revoked" || current === "target_changed") {
          publicationBlocked = true;
          revocation?.abort();
        }
      };
      const grantEffect = () => {
        if (sharedTarget && revocation && !unsubscribe) {
          const { accessRoot, observe, revocationSignal } = sharedTarget;
          const recheck = (changesOnly: boolean) => {
            if (!unsubscribe || monitorSignal.aborted) return;
            try {
              stopOnRevocation(observe());
            } catch {
              /* 一時的な観測不能は失効とは区別する。 */
            }
            if (changesOnly && !monitorSignal.aborted)
              void checkExternal()?.then(
                (current) => {
                  if (!monitorSignal.aborted) stopOnRevocation(current);
                },
                () => {},
              );
          };
          const detachAccess = onAccessStatePublication(accessRoot, () => {
            recheck(false);
          });
          const onRevoked = () => stopOnRevocation("revoked");
          revocationSignal?.addEventListener("abort", onRevoked, {
            once: true,
          });
          unsubscribe = () => {
            detachAccess();
            revocationSignal?.removeEventListener("abort", onRevoked);
          };
          if (revocationSignal?.aborted) {
            onRevoked();
            return refusal("access_denied");
          }
          accessTimer = setInterval(
            () => recheck(true),
            executionAccessCheckIntervalMs,
          ).unref();
        }
        effectAuthorized = true;
        return true;
      };
      try {
        const { runObjectiveInChild } = await import("./execution-child.ts");
        result = await runObjectiveInChild(
          captured,
          AbortSignal.any([
            signal,
            ...(revocation ? [revocation.signal] : []),
            ...(active ? [active.signal] : []),
          ]),
          (request) => {
            if (!canGrant()) return null;
            reception.status = "accepted";
            reception.workspaceId = request.workspaceId ?? null;
            return {
              directory: ownerRoot,
              principalId,
              ...(refresh && { confirmBeforeTask: true as const }),
            };
          },
          () => {
            if (reception.status !== "accepted" || !canGrant()) return false;
            const checking = checkExternal();
            return checking
              ? checking.then(
                  (current) => {
                    if (active?.signal.aborted) return false;
                    if (monitorSignal.aborted)
                      return refusal(
                        signal.aborted ? "cancelled" : "access_denied",
                      );
                    if (current !== "current") {
                      if (effectAuthorized) stopOnRevocation(current);
                      return refusal("access_denied");
                    }
                    return canGrant() && grantEffect();
                  },
                  () => refusal("access_denied"),
                )
              : grantEffect();
          },
        );
      } catch {
        // 発行済みEffectはここで不存在とみなさない。
      } finally {
        active?.close();
        clearInterval(accessTimer);
        unsubscribe?.();
        unsubscribe = undefined;
        monitoring.abort();
        await inFlight?.catch(() => undefined);
      }
      if (
        reception.status === "pending" &&
        result &&
        typeof result === "object" &&
        "reason" in result &&
        result.reason === "coordinator_objective_request_invalid"
      )
        return { kind: "invalid" } as const;
      if (reception.status === "pending" && signal.aborted)
        return { kind: "cancelled" } as const;
      if (
        reception.status === "cancelled" ||
        reception.status === "access_denied"
      )
        return { kind: reception.status } as const;
      try {
        if (
          publicationBlocked ||
          (refresh && (await refresh(signal)) !== "current") ||
          (authorize && !authorize())
        )
          return { kind: "publication_denied" } as const;
      } catch {
        return { kind: "publication_denied" } as const;
      }
      try {
        if (reception.status === "accepted") {
          const request = captured as Record<string, unknown>;
          const value = inspectCoordinatorObjectiveResult(
            result,
            reception.workspaceId,
            {
              repositoryRoot: ownerRoot,
              principalId,
              requestId: request.requestId,
              projectId: request.projectId,
              milestoneId: request.milestoneId,
            },
          );
          if (value) return { kind: "result", value } as const;
        }
      } catch {
        // 結果未確認として返す。
      }
      return { kind: "result_unconfirmed" } as const;
    } finally {
      closeTarget?.();
    }
  }
  const args =
    operation === "objective"
      ? inspectCoordinatorObjectiveRequest(captured)
      : operation === "decision"
        ? inspectCoordinatorDecisionRequest(captured)
        : inspectCoordinatorStateQuery(captured);
  if (!args) return { kind: "invalid" } as const;
  if (operation === "decision" && scope === null)
    return { kind: "unavailable" } as const;
  let principalId: unknown;
  let executionTarget: ExecutionTarget | null = null;
  let ownerRoot: string | undefined;
  let authorize: (() => boolean) | undefined;
  try {
    if ("scope" in configuration) {
      const target =
        scope === "shared"
          ? await resolveSharedTarget(args.projectId, operation === "decision")
          : resolveLocalTarget();
      if (target) {
        executionTarget = target;
        ownerRoot = target.ownerRoot;
        principalId = target.principalId;
        authorize = target.authorize;
      }
    } else {
      const authenticated = configuration.authenticateClient();
      if (
        authenticated &&
        typeof authenticated === "object" &&
        !types.isProxy(authenticated) &&
        (Object.getPrototypeOf(authenticated) === Object.prototype ||
          Object.getPrototypeOf(authenticated) === null) &&
        Reflect.ownKeys(authenticated).length === 2
      ) {
        const status = Object.getOwnPropertyDescriptor(authenticated, "status");
        const principal = Object.getOwnPropertyDescriptor(
          authenticated,
          "principalId",
        );
        if (
          status?.enumerable &&
          Object.hasOwn(status, "value") &&
          status.value === "verified" &&
          principal?.enumerable &&
          Object.hasOwn(principal, "value")
        )
          principalId = principal.value;
      }
    }
    if (scope === "shared" && !authorize?.()) principalId = undefined;
  } catch {
    principalId = undefined;
  }
  if (signal.aborted) return { kind: "cancelled" } as const;
  if (
    !isPrincipalId(principalId) ||
    (scope !== null && ownerRoot === undefined)
  )
    return { kind: "access_denied" } as const;

  const authentication = Object.freeze({ principalId });
  let result: unknown;
  let decisionResult: ReturnType<CoordinatorModule["submitDecision"]> | null =
    null;
  try {
    if ("scope" in configuration) {
      if (operation === "decision") {
        decisionResult = coordinator.submitDecision(
          args,
          ownerRoot,
          authentication,
        );
      } else {
        result = coordinator.queryState(args, ownerRoot, authentication);
      }
    } else {
      result =
        operation === "objective"
          ? await configuration.runObjective(args, signal, authentication)
          : operation === "state"
            ? await configuration.getProjectState(args, authentication)
            : null;
    }
  } catch {
    result = null;
  }
  try {
    const value =
      operation === "objective"
        ? inspectCoordinatorObjectiveResult(
            result,
            "workspaceId" in args && typeof args.workspaceId === "string"
              ? args.workspaceId
              : null,
          )
        : operation === "decision"
          ? decisionResult?.reason === "coordinator_decision_result_unconfirmed"
            ? null
            : decisionResult
          : inspectCoordinatorStateQueryResult(result);
    let launchId: string | null = null;
    if (operation === "state" && value) {
      if (
        !("observationState" in value) ||
        !("requestId" in args) ||
        value.requestId !== args.requestId ||
        value.projectId !== args.projectId ||
        value.repositoryRevision !== args.repositoryRevision ||
        value.queueId !== ("queueId" in args ? args.queueId : undefined)
      )
        return { kind: "result_unconfirmed" } as const;
      if (
        executionTarget &&
        objectiveRuns &&
        typeof args.requestId === "string"
      ) {
        launchId = objectiveRuns.read(
          runIdentity(executionTarget, args.projectId, args.requestId),
        );
      }
    }
    if (operation === "state" && signal.aborted)
      return { kind: "cancelled" } as const;
    try {
      if (authorize && !authorize())
        return { kind: "publication_denied" } as const;
    } catch {
      return { kind: "publication_denied" } as const;
    }
    if (operation === "state" && signal.aborted)
      return { kind: "cancelled" } as const;
    if (value && launchId)
      return { kind: "result", value: { ...value, launchId } } as const;
    if (value) return { kind: "result", value } as const;
  } catch {
    // A processing fault is not proof that no effects occurred.
  }
  return { kind: "result_unconfirmed" } as const;
}

/**
 * 現在許可された活動対象を同じCoordinator Readerへ渡す。
 * @trace ARCH-000012
 * @boundary 通信入口で確定した対象と、活動の実保存観測。
 * @security 遅延読込み後に現在認可を再確認し、資格・管理情報をReaderへ渡さない。
 * @concurrency 取消済みではReaderを開始せず、開始後はReaderの完了を待つ。
 */
export async function readAuthorizedExecutionActivity(
  query: Omit<ExecutionActivityRequest, "repositories">,
  selected: readonly (Pick<AuthorizedRepository, "root" | "repositoryId"> & {
    manifest: Pick<AuthorizedRepository["manifest"], "projectId">;
  })[],
  authorize: () => boolean,
  signal: AbortSignal,
): Promise<ExecutionActivityObservation> {
  const { queryActivity } = await import("@qual-lab/crdd-coordinator");
  if (signal.aborted || !authorize())
    throw new Error("runtime_activity_unavailable");
  const repositories = selected.map((entry) => {
    const repository = getRepository(entry.root);
    if (signal.aborted || repository.status !== "completed")
      throw new Error("runtime_activity_unavailable");
    return {
      projectId: entry.manifest.projectId,
      repositoryId: entry.repositoryId,
      root: repository.capability,
    };
  });
  const observation = await queryActivity(
    {
      ...query,
      repositories,
    },
    signal,
  );
  if (
    signal.aborted ||
    repositories.some(
      (repository, index) =>
        resolveVerifiedRepositoryRoot(repository.root) !==
        selected[index]?.root,
    )
  )
    throw new Error("runtime_activity_unavailable");
  return observation;
}

/** 指定Repositoryだけの活動を現在認可で読み、同じ対象の結果だけを返す。 @trace ARCH-000012 */
export async function readRepositoryExecutionActivity(
  repositoryId: string,
  page: Pick<ExecutionActivityRequest, "cursor" | "limit">,
  configuration:
    | { scope: "local"; repositoryRoot: string }
    | {
        scope: "shared";
        credentials: { root: FilesystemStoreRoot; hosted: HostedAccessSession };
      },
  signal: AbortSignal,
  expectedProjectId?: string,
) {
  if (signal.aborted) return null;
  const target = await (async () => {
    if (configuration.scope === "local") {
      const root = configuration.repositoryRoot;
      const manifest = readRepositoryManifest(root);
      if (
        manifest.status !== "ready" ||
        manifest.manifest.repositoryId !== repositoryId
      )
        return null;
      return {
        ownerRoot: root,
        projectId: manifest.manifest.projectId,
        authorize() {
          const current = readRepositoryManifest(root);
          return (
            current.status === "ready" && current.identity === manifest.identity
          );
        },
      };
    }
    const credentials = configuration.credentials;
    return resolveHostedDevelopmentAccess(
      credentials.root,
      credentials.hosted,
      repositoryId,
      false,
      signal,
    );
  })();
  if (
    !target ||
    signal.aborted ||
    (expectedProjectId !== undefined && target.projectId !== expectedProjectId)
  )
    return null;
  const { ownerRoot, projectId } = target;
  const authorize = () =>
    !signal.aborted &&
    !(
      configuration.scope === "shared" &&
      configuration.credentials.hosted.isCurrent?.() === false
    ) &&
    target.authorize() &&
    !signal.aborted;
  const observation = await readAuthorizedExecutionActivity(
    { ...page, projectId },
    [{ root: ownerRoot, repositoryId, manifest: { projectId } }],
    authorize,
    signal,
  );
  const { parseExecutionActivityObservation } = await import(
    "@qual-lab/crdd-coordinator"
  );
  const checked = parseExecutionActivityObservation(observation);
  if (!checked || checked.projectId !== projectId || !authorize())
    throw new Error("execution_activity_unavailable");
  return checked;
}

/**
 * Runtime Activityの読取りApplication Port。
 *
 * @responsibility Project IDを現在のRuntime観測結果へ変換するConsumer境界を固定する。
 * @trace ARCH-000004
 * @trace ARCH-000012
 * @shape observe操作だけを持つ読取り専用Portを表す。
 * @invariant WorkbenchへRuntime書込み、判断返却またはRecovery Authorityを公開しない。
 * @boundary WorkbenchとRepository／CROS Coordinator Adapterの型境界。
 * @security Project ID以外の任意Path、Credentialまたは内部Runtime引数を受け取らない。
 * @compatibility 書込み操作は本Portへ追加せず、別Authority境界で設計する。
 */
export type WorkbenchActivityReader = Readonly<{
  observe: (
    projectId: string,
    page?: WorkbenchExecutionActivityPageRequest,
  ) => Promise<WorkbenchExecutionActivityObservation>;
}>;

const DEFAULT_EVENT_LIMIT = 20;

/**
 * 起動時のRepository Identityへ固定した活動Readerを構築する。
 *
 * @responsibility 現在状態と履歴の観測・ページングを既存Coordinatorへ委譲する。
 * @trace ARCH-000004
 * @trace ARCH-000007
 * @trace ARCH-000012
 * @input 検証対象Rootと、Domainが確定したProject／Repository ID。
 * @returns 固定Projectだけを観測する読取り専用Reader。
 * @precondition Identityは起動時に取得したRepository Contextの値である。
 * @postcondition 現在状態・履歴・Continuationを同じOwnerの契約で返す。
 * @effect 現在Revision、Runtime状態と履歴を読む。初期化や保存はしない。
 * @failure RootまたはIdentity不成立はunknown。不正Cursorや上限はOwnerが拒否する。
 * @invariant 要求Projectの自己申告でRootの所属を変更しない。
 * @boundary Workbench表示とCoordinator活動Readerの直接境界。
 * @security 資格・Role・任意Pathを要求へ追加せず、Rootを表示しない。
 * @concurrency Identityの二値をコピーし、共有Cacheを持たない。
 */
export function createRepositoryWorkbenchActivityReader(
  repositoryRoot: string,
  identity: Pick<RepositoryProjectContext, "projectId" | "repositoryId">,
): WorkbenchActivityReader {
  const fixedIdentity = Object.freeze({
    projectId: identity.projectId,
    repositoryId: identity.repositoryId,
  });
  const validIdentity =
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(fixedIdentity.projectId) &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(fixedIdentity.repositoryId);
  const verification = getRepository(repositoryRoot);
  return Object.freeze({
    observe: async (projectId, page = {}) => {
      if (
        verification.status !== "completed" ||
        !validIdentity ||
        projectId !== fixedIdentity.projectId
      )
        return Object.freeze({
          state: "unknown" as const,
          reason: "repository_activity_identity_unverified",
          projection: null,
          eventState: "unknown" as const,
          eventReason: "observation_failed",
          events: Object.freeze([]),
          eventContinuation: null,
        });
      const { queryActivity } = await import("@qual-lab/crdd-coordinator");
      const observation = await queryActivity({
        projectId: fixedIdentity.projectId,
        repositories: [
          {
            ...fixedIdentity,
            root: verification.capability,
          },
        ],
        limit: page.limit ?? DEFAULT_EVENT_LIMIT,
        ...(page.cursor === undefined ? {} : { cursor: page.cursor }),
      });
      if (observation.projectId !== fixedIdentity.projectId)
        throw new Error("workbench_runtime_activity_project_mismatch");
      return projectExecutionActivityForWorkbench(observation);
    },
  });
}

/** Workbenchが受け付けるAI依頼の用途区分。 */
export type AiRequestMode = "read_only_advice" | "workspace_edit";

/** AI依頼の入力・対象・実行条件を受け付ける要求。 */
export type AiRequestCommand = SingleTaskCommand;

/** AI依頼の受付結果と追跡参照。 */
export type AiRequestStartResult = Readonly<{
  status: "accepted" | "blocked";
  requestId: string | null;
  reason: string | null;
}>;

/** AI依頼の開始・照会・取消・終了を結ぶWorkbench側の操作契約。 */
export type AiRequests = Readonly<{
  start: (
    request: AiRequestCommand,
    signal?: AbortSignal,
    admissionCurrent?: () => boolean,
  ) => Promise<AiRequestStartResult>;
  observe: (
    requestId: string,
    signal?: AbortSignal,
  ) => Promise<AiRequestSnapshot>;
  cancel: (
    requestId: string,
    signal?: AbortSignal,
  ) => Promise<AiRequestSnapshot>;
  join?: (requestId: string) => Promise<void>;
  close?: () => Promise<void>;
}>;

export type AiSession = {
  owner: AiRequests;
  currentId: string | null;
  authorize: () => boolean;
  canWrite: boolean;
};

export type AiSessionOperation =
  | "read"
  | "view"
  | "select"
  | "cancel"
  | AiRequestMode;

/** OAuthの要求資格と、開始後も存続する同一本人・対象の実行監視を分離する。 */
export function createHostedAiSessions(
  factory: (
    repository: Repository,
    projectId: string,
    principalId: string,
    authorize: () => boolean,
  ) => AiRequests,
) {
  const owners = new Map<string, { tasks: AiRequests; opened: boolean }>();
  const selections = new WeakMap<
    object,
    Map<string, { owner: string; requestId: string }>
  >();
  const running = new Set<Promise<void>>();
  let closing = false;
  const ownerKey = (
    session: HostedAccessSession,
    repositoryId: string,
    target: {
      bindingId: string;
      hostedBinding: string;
      ownerRoot: string;
      projectId: string;
    },
  ) =>
    JSON.stringify([
      session.principal.userId,
      session.principal.bindingId,
      repositoryId,
      target.bindingId,
      target.hostedBinding,
      target.ownerRoot,
      target.projectId,
    ]);
  async function open(
    root: FilesystemStoreRoot,
    session: HostedAccessSession,
    repositoryId: string,
    operation: AiSessionOperation,
    signal: AbortSignal,
  ): Promise<AiSession | null> {
    const browser = session.browserSessionKey;
    if (!browser || closing || signal.aborted) return null;
    if (operation === "view" && !selections.get(browser)?.has(repositoryId))
      return null;
    const start =
      operation === "workspace_edit" || operation === "read_only_advice";
    const admission = start
      ? await openHostedExecutionAccess(
          root,
          session,
          repositoryId,
          {
            projectId: null,
            permission: operation === "workspace_edit" ? "write" : "read",
          },
          signal,
        )
      : null;
    const access = start
      ? null
      : await resolveHostedDevelopmentAccess(
          root,
          session,
          repositoryId,
          false,
          signal,
        );
    let ownedAdmission = admission;
    try {
      const target = admission ?? access;
      const authorize = () =>
        !closing &&
        !signal.aborted &&
        (admission
          ? admission.authorizeRequest()
          : access?.authorize() === true);
      if (!target || !authorize()) return null;
      const key = ownerKey(session, repositoryId, target);
      let owner = owners.get(key);
      if (!owner) {
        if (operation === "read" || operation === "view" || owners.size >= 100)
          return null;
        const repository = getRepository(target.ownerRoot);
        if (repository.status !== "completed" || !authorize()) return null;
        const { observeBinding } = target;
        owner = {
          tasks: factory(
            repository.capability,
            target.projectId,
            session.principal.userId,
            () => !closing && observeBinding() === "current",
          ),
          opened: false,
        };
        owners.set(key, owner);
      }
      const entry = owner;
      if ((operation === "read" || operation === "view") && !entry.opened)
        return null;
      const taskOwner = entry.tasks;
      if (admission && !taskOwner.join) return null;
      if (!selections.get(browser)) selections.set(browser, new Map());
      const selection = selections.get(browser);
      if (!selection) return null;
      if (admission) ownedAdmission = null;
      const releaseUnused = () => admission?.close?.();
      if (admission)
        signal.addEventListener("abort", releaseUnused, { once: true });
      return {
        owner: {
          ...taskOwner,
          async observe(requestId, requestSignal) {
            const result = await taskOwner.observe(requestId, requestSignal);
            if (
              authorize() &&
              result.requestId === requestId &&
              result.mode !== null
            )
              entry.opened = true;
            return result;
          },
          async start(command, requestSignal) {
            signal.removeEventListener("abort", releaseUnused);
            if (
              !admission ||
              !taskOwner.join ||
              command.mode !== operation ||
              !authorize()
            ) {
              releaseUnused();
              return {
                status: "blocked",
                requestId: null,
                reason: "workbench_ai_access_unavailable",
              };
            }
            const stop = new AbortController();
            const done = new AbortController();
            const runtimeSignal = AbortSignal.any([stop.signal, done.signal]);
            let refresh: Promise<void> | undefined;
            const discard = () => stop.abort();
            requestSignal?.addEventListener("abort", discard, { once: true });
            if (requestSignal?.aborted) discard();
            const stopIfRevoked = (status: string) => {
              if (status === "revoked" || status === "target_changed")
                discard();
            };
            const revalidate = () => {
              stopIfRevoked(admission.observe());
              return undefined;
            };
            const unsubscribe = onAccessStatePublication(root, revalidate);
            admission.revocationSignal?.addEventListener("abort", discard, {
              once: true,
            });
            const timer = setInterval(() => {
              if (runtimeSignal.aborted) return;
              revalidate();
              if (runtimeSignal.aborted || refresh) return;
              refresh = admission
                .refresh(runtimeSignal)
                .then(
                  (status) => {
                    if (!runtimeSignal.aborted) stopIfRevoked(status);
                  },
                  () => {},
                )
                .finally(() => {
                  refresh = undefined;
                });
            }, executionAccessCheckIntervalMs).unref();
            const close = async () => {
              clearInterval(timer);
              unsubscribe();
              done.abort();
              admission.revocationSignal?.removeEventListener("abort", discard);
              await refresh;
              admission.close?.();
            };
            let transferred = false;
            try {
              if (!authorize())
                return {
                  status: "blocked",
                  requestId: null,
                  reason: "workbench_ai_access_unavailable",
                };
              const result = await taskOwner.start(
                command,
                stop.signal,
                authorize,
              );
              if (
                result.status === "accepted" &&
                result.requestId === command.requestId
              )
                entry.opened = true;
              if (
                result.status === "accepted" &&
                result.requestId === command.requestId &&
                result.reason === null
              ) {
                const settled = taskOwner
                  .join(command.requestId)
                  .then(close, close);
                running.add(settled);
                void settled.then(
                  () => running.delete(settled),
                  () => running.delete(settled),
                );
                transferred = true;
              }
              return result;
            } finally {
              requestSignal?.removeEventListener("abort", discard);
              if (!transferred) await close();
            }
          },
        },
        get currentId() {
          const selected = selection.get(repositoryId);
          return selected?.owner === key ? selected.requestId : null;
        },
        set currentId(id) {
          if (id === null) selection.delete(repositoryId);
          else selection.set(repositoryId, { owner: key, requestId: id });
        },
        authorize,
        canWrite: access?.canWrite ?? operation === "workspace_edit",
      };
    } finally {
      ownedAdmission?.close?.();
    }
  }
  return {
    open,
    async observeSelected(
      session: HostedAccessSession,
      target: AuthorizedRepository,
      signal: AbortSignal,
    ) {
      const browser = session.browserSessionKey;
      if (
        !browser ||
        closing ||
        signal.aborted ||
        session.isCurrent?.() === false
      )
        return null;
      const selection = selections.get(browser);
      const selected = selection?.get(target.repositoryId);
      if (!selected) return null;
      const key = ownerKey(session, target.repositoryId, {
        bindingId: target.bindingId,
        hostedBinding: JSON.stringify(target.hostedRepository),
        ownerRoot: target.root,
        projectId: target.manifest.projectId,
      });
      const owner = selected.owner === key ? owners.get(key) : undefined;
      if (!owner?.opened) return null;
      const result = await owner.tasks.observe(selected.requestId, signal);
      return !closing &&
        !signal.aborted &&
        session.isCurrent?.() !== false &&
        result.requestId === selected.requestId &&
        selection?.get(target.repositoryId) === selected
        ? result
        : null;
    },
    async close() {
      closing = true;
      const results = await Promise.allSettled(
        [...owners.values()].map(({ tasks }) => tasks.close?.()),
      );
      owners.clear();
      const monitors = await Promise.allSettled(running);
      if (
        [...results, ...monitors].some((result) => result.status === "rejected")
      )
        throw new Error("workbench_ai_close_unconfirmed");
    },
  };
}

/**
 * 単体・共有の開始入力を、既存の実行要求に変換する。
 * @responsibility 明示選定と用途を検査し、単体にだけ適用してきた入力条件を維持する。
 * @trace ARCH-000015
 * @boundary 形式の解析と現在認可は受付側、実行可否はCoordinatorが所有する。
 */
export function prepareAiRequestStart(
  input: Readonly<{
    mode: string | null;
    explicitChoice: unknown;
    requestId: string;
    workType: string | null;
    prompt: string;
    allowedPaths: string;
    workspaceId: string | null;
  }>,
  connection: "local" | "shared",
): AiRequestCommand {
  const choice =
    input.explicitChoice === undefined
      ? null
      : inspectAiSelectionChoice(input.explicitChoice);
  if (input.explicitChoice !== undefined && !choice)
    throw new Error("workbench_ai_request_choice_invalid");
  const { mode } = input;
  if (mode !== "read_only_advice" && mode !== "workspace_edit")
    throw new Error("workbench_ai_request_mode_invalid");
  const local = connection === "local";
  const prompt = local ? input.prompt.trim() : input.prompt;
  const allowedPaths = input.allowedPaths
    .split(/\r?\n/u)
    .map((line) => {
      const value = line.trim();
      return local ? value.replaceAll("\\", "/") : value;
    })
    .filter(Boolean);
  if (local) {
    if (prompt.length === 0 || prompt.length > 16_000)
      throw new Error("workbench_ai_request_prompt_invalid");
    if (
      allowedPaths.length > 64 ||
      new Set(allowedPaths).size !== allowedPaths.length ||
      allowedPaths.some(
        (value) =>
          value.length > 512 ||
          value.startsWith("/") ||
          /^[A-Za-z]:/u.test(value) ||
          value.split("/").includes(".."),
      ) ||
      (mode === "read_only_advice" && allowedPaths.length !== 0) ||
      (mode === "workspace_edit" && allowedPaths.length === 0)
    )
      throw new Error("workbench_ai_request_allowed_paths_invalid");
  }
  const contextReferences = ["PROJECT_CONTEXT.md"];
  const command: AiRequestCommand = {
    requestId: input.requestId,
    mode,
    workType: input.workType?.trim() || null,
    ...(choice ? { choice } : {}),
    prompt,
    contextReferences: local
      ? Object.freeze(contextReferences)
      : contextReferences,
    allowedPaths: local ? Object.freeze(allowedPaths) : allowedPaths,
    workspaceId: input.workspaceId?.trim() || null,
  };
  return local ? Object.freeze(command) : command;
}
/**
 * 検査済み活動Ownerの観測を画面専用値へ投影する。
 * @responsibility 出所を画面契約へ暗黙転記せず、表示語彙へ変換する。
 * @trace ARCH-000004
 * @trace ARCH-000007
 * @trace ARCH-000012
 * @input Coordinatorの検査済み活動観測。
 * @returns 現行Workbench表示Propertyだけを持つ新Object。
 * @precondition 利用側が既存OwnerのSchemaと要求Projectの一致を確認済み。通信経路の有無を認可証明にしない。
 * @postcondition 現在状態・履歴・Continuationの意味を保持する。
 * @effect N/A: 純粋な値変換だけを行う。
 * @failure N/A: 検査済み入力だけを受ける。
 * @invariant Root・出所Repository・管理情報を画面契約へ追加しない。
 * @boundary 活動Ownerの搬送契約からWorkbench表示契約。
 * @security 非秘密の表示項目だけを明示投影する。
 * @concurrency N/A: 共有状態を持たない。
 */
export function projectExecutionActivityForWorkbench(
  observation: ExecutionActivityObservation,
): WorkbenchExecutionActivityObservation {
  return Object.freeze({
    state: observation.state,
    reason: observation.reason,
    projection: observation.projection,
    eventState: observation.eventState,
    eventReason:
      observation.eventState === "observed"
        ? "execution_events_observed"
        : "observation_failed",
    events: Object.freeze(
      observation.events.map((event) =>
        Object.freeze({
          eventId: event.eventId,
          occurredAt: event.occurredAt,
          objectiveId: event.objectiveId,
          taskId: event.taskId,
          attemptId: event.attemptId,
          status: event.status,
          reason: event.reason,
          cleanupConfirmed: event.cleanupConfirmed,
          manualRecoveryRequired: event.manualRecoveryRequired,
        }),
      ),
    ),
    eventContinuation: observation.eventContinuation,
    singleTasks: observation.singleTasks ?? [],
    graphs: observation.graphs ?? [],
  });
}

/**
 * Workbenchが表示するCoordinator現在投影の値契約。
 *
 * @responsibility 実行状況画面に必要なMilestone、Objective／Task、判断、Recoveryおよび次処置を閉じる。
 * @trace ARCH-000004
 * @trace ARCH-000012
 * @shape Coordinator公開投影の表示Propertyだけを表す。
 * @invariant Runtime正本、Authorityまたは状態遷移操作を所有しない。
 * @boundary Coordinator State Query AdapterとWorkbench表示の型境界。
 * @security 非開示Task本文、Credential、Host PathおよびRecovery Authorityを含まない。
 * @compatibility Coordinator公開契約変更時はAdapterと表示試験を再評価する。
 */
export type WorkbenchExecutionActivityProjection = Readonly<{
  projectId: string;
  milestoneId: string;
  generation: number;
  milestoneState: string;
  objectiveCounts: Readonly<Record<string, number>>;
  taskCounts: Readonly<Record<string, number>>;
  objectiveTaskSummaries: readonly Readonly<{
    objectiveId: string;
    objectiveState: string;
    taskCounts: Readonly<Record<string, number>>;
  }>[];
  workProgress: string;
  qualityState: string;
  humanDecisionRequired: boolean;
  recoveryRequired: boolean;
  nextAction: string;
}>;

/**
 * Workbenchへ公開する一つの実行Event要約。
 *
 * @responsibility Execution Intelligence Eventから実行履歴画面に必要な非秘密情報だけを固定する。
 * @trace ARCH-000007
 * @trace ARCH-000012
 * @shape Event、Objective、Task、Attempt、時刻、結果および回復要否を表す。
 * @invariant Event Storeの正本値を変更せず、Recovery Authorityまたは生Provider出力を含まない。
 * @boundary Execution Intelligence EventとWorkbench表示の型境界。
 * @security Credential、Prompt、Response、Host PathおよびRecovery Authorityを含まない。
 * @compatibility Event契約変更時は投影と継続読込試験を再評価する。
 */
export type WorkbenchExecutionEventProjection = Readonly<{
  eventId: string;
  occurredAt: string;
  objectiveId: string;
  taskId: string;
  attemptId: string;
  status: "completed" | "blocked" | "cancelled" | "unknown";
  reason: string;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
}>;

/**
 * Runtime Eventページ要求。
 *
 * @responsibility Eventの取得上限と継続位置を一回の観測へ結合する。
 * @trace ARCH-000007
 * @trace ARCH-000012
 * @shape cursorとlimitを表す。
 * @invariant limitは1件以上50件以下である。
 * @boundary Browser QueryとExecution Event投影の型境界。
 * @security CursorへRepository Pathまたは秘密値を含めない。
 * @compatibility Cursorは同じ並び順の後続取得にだけ使用する。
 */
export type WorkbenchExecutionActivityPageRequest = Readonly<{
  cursor?: string;
  limit?: number;
}>;

/**
 * Runtime Activity一回分の観測結果を表す値契約。
 *
 * @responsibility observed、absent、unknownと理由・投影の相関をWorkbenchへ搬送する。
 * @trace ARCH-000004
 * @trace ARCH-000012
 * @shape state、reasonおよびprojectionを表す。
 * @invariant observedだけが非null projectionを持つ想定であり、表示側でも不整合を成功へ畳まない。
 * @boundary Runtime Activity Application PortとBrowser表示の型境界。
 * @security reasonに秘密値、Host Pathまたは非開示Identityを含めない。
 * @compatibility 状態追加時は未接続を含む全表示分岐を再評価する。
 */
export type WorkbenchExecutionActivityObservation = Readonly<{
  singleTasks?: ExecutionActivityObservation["singleTasks"];
  graphs?: ExecutionActivityObservation["graphs"];
  state: "observed" | "absent" | "unknown";
  reason: string;
  projection: WorkbenchExecutionActivityProjection | null;
  eventState: "observed" | "unknown";
  eventReason: string;
  events: readonly WorkbenchExecutionEventProjection[];
  eventContinuation: string | null;
}>;

/**
 * AI結果の一項目と、その意味を支える正本参照。
 *
 * @responsibility 結果本文を根拠参照から切り離さずWorkbench表示へ搬送する。
 * @trace ARCH-000015
 * @shape textと一件以上のRepository相対参照を持つ。
 * @invariant 参照のない本文を事実、共有分析または追加推論として扱わない。
 * @boundary 外部AI結果とWorkbench表示Modelの境界。
 * @security 参照は表示用Identityであり、任意Path読取りAuthorityを付与しない。
 * @compatibility 利用側はtextとreferencesだけへ依存する。
 */
export type AiResultItem = Readonly<{
  text: string;
  references: readonly string[];
}>;

/** 同一AI依頼の進行・終端・回復情報の公開投影。 */
export type AiRequestSnapshot = Readonly<{
  requestId: string;
  mode: AiRequestMode | null;
  executionSelection: ExecutionSelection | null;
  status:
    | "accepted"
    | "running"
    | "completed"
    | "blocked"
    | "cancelled"
    | "unknown";
  reason: string | null;
  facts: readonly AiResultItem[];
  resultAvailable: boolean;
  sharedAnalysis: readonly AiResultItem[];
  additionalInferences: readonly AiResultItem[];
  nextOptions: readonly AiResultItem[];
  candidate: null;
  workspaceResult?: WorkspaceResult | null;
  taskId?: string | null;
  attemptId?: string | null;
  operationId?: string | null;
  executionStatus?: string | null;
  primaryFailure?: string | null;
  cleanupConfirmed?: boolean;
  recoveryIds?: readonly string[];
  secondaryFailures?: readonly string[];
}>;
