/**
 * HTTPとMCPの実行操作をCoordinator、実行定義をExecution Modelへ接続する。
 * @packageDocumentation
 * @responsibility 実行の対象・主体・公開前再照合と、実行定義の入力形式・操作対応を共通化する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary 通信方式に依存しない実行・定義受付とCoordinator・Execution Model・AM。
 */
import type {
  ExecutionSelection,
  WorkspaceResult,
} from "../../../coordinator/src/index.ts";
import type { AuthorizedRepository } from "../../../access-management/src/index.ts";
import type {
  RuntimeActivityObservation,
  RuntimeActivityRequest,
  SingleTaskCommand,
} from "../../../coordinator/src/index.ts";
import type { RepositoryProjectContext } from "../../../document-model/src/index.ts";
import { inspectAiSelectionChoice } from "../../../configuration-model/src/index.ts";

import { types } from "node:util";
import {
  resolveConnectionAuthentication,
  type FilesystemStoreRoot,
} from "../../../access-management/src/index.ts";
import {
  createLocalPrincipalId,
  createObjective,
  createTask,
  deleteObjective,
  deleteTask,
  type ExecutionModelAccess,
  initializeExecutionState,
  isPrincipalId,
  queryObjectives,
  queryPlan,
  queryTasks,
  savePlan,
  updateObjective,
  updateTask,
} from "../../../execution-model/src/index.ts";
import {
  getRepository,
  readGitUser,
  resolveVerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";
import type { CredentialAdministration } from "./access.ts";
import { resolveSharedDevelopmentAccess } from "./access.ts";

export const definitionReadFields = {
  plan: [],
  objectives: [],
  tasks: [],
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

type ExecutionDefinitionOperation =
  | keyof typeof definitionReadFields
  | keyof typeof definitionWriteFields;

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
  const requiredFields = [
    "operation",
    "projectId",
    "milestoneId",
    ...operationFields,
  ];
  const receivedFields = Object.keys(command);
  if (
    receivedFields.length !== requiredFields.length ||
    receivedFields.some((key) => !requiredFields.includes(key))
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
  access: ExecutionModelAccess,
  { operation, input }: ExecutionDefinitionCommand,
): unknown {
  // 型の絞り込みは検査ではない。Execution Modelの検査・認可・CASをそのまま使う。
  switch (operation) {
    case "initialize":
      return initializeExecutionState(
        access,
        input as Parameters<typeof initializeExecutionState>[1],
      );
    case "plan.save":
      return savePlan(access, input as Parameters<typeof savePlan>[1]);
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
  submitDecision: (
    request: Readonly<Record<string, unknown>>,
    authentication: Readonly<{ principalId: string }>,
  ) => Promise<unknown>;
  getProjectState: (
    request: Readonly<Record<string, unknown>>,
    authentication: Readonly<{ principalId: string }>,
  ) => Promise<unknown>;
}>;

/** 各入口が使う同じ実行系操作。 @trace ARCH-000012 */
export type CoordinatorExecutionOperation = "objective" | "decision" | "state";

/** 起動Repositoryまたは共有の認証資格から現在対象を確定する。 @trace ARCH-000012 */
export type CoordinatorExecutionConfiguration =
  | CoordinatorExecutionDependencies
  | Readonly<{ scope: "local"; repositoryRoot: string }>
  | Readonly<{
      scope: "shared";
      credentials: CredentialAdministration | undefined;
    }>;

type CoordinatorModule = typeof import("../../../coordinator/src/index.ts");

/**
 * 現在の開発権限と本人を同じ改訂の実行対象に結び付ける。
 * @responsibility 共有入口で指定したRepository以外の実行・判断・照会を防ぐ。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary AMの通常認証と開発Repository認可から要求限定のCoordinator入力へ。
 * @security 資格・Root・Bindingを公開せず、Project不一致や認可不明は拒否する。
 */
function resolveSharedExecutionTarget(
  root: FilesystemStoreRoot,
  token: string,
  repositoryId: string,
  projectId: string,
  signal: AbortSignal,
) {
  if (signal.aborted) return null;
  const initial = resolveConnectionAuthentication(root, token);
  if (initial.status !== "normal" || signal.aborted) return null;
  const target = resolveSharedDevelopmentAccess(
    root,
    token,
    repositoryId,
    signal,
  );
  if (
    !target ||
    signal.aborted ||
    target.projectId !== projectId ||
    target.revision !== initial.snapshot.revision
  )
    return null;
  return {
    ownerRoot: target.ownerRoot,
    principalId: initial.snapshot.userId,
    authorize: () => {
      if (signal.aborted) return false;
      const current = resolveConnectionAuthentication(root, token);
      return (
        current.status === "normal" &&
        current.snapshot.userId === initial.snapshot.userId &&
        current.snapshot.credentialId === initial.snapshot.credentialId &&
        current.snapshot.revision === target.revision &&
        target.authorize()
      );
    },
  };
}

/** 起動Repositoryと現在のGitローカル主体を照合する。 @trace ARCH-000012 */
function resolveLocalExecutionTarget(
  repositoryRoot: string,
  signal: AbortSignal,
): Readonly<{
  ownerRoot: string;
  principalId: string;
  authorize?: () => boolean;
}> | null {
  if (signal.aborted) return null;
  const repository = getRepository(repositoryRoot);
  if (
    repository.status !== "completed" ||
    resolveVerifiedRepositoryRoot(repository.capability) !== repositoryRoot
  )
    return null;
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
  } catch {
    return { kind: "invalid" } as const;
  }
  let coordinator: CoordinatorModule;
  try {
    coordinator = await import("../../../coordinator/src/index.ts");
  } catch {
    return { kind: signal.aborted ? "cancelled" : "unavailable" } as const;
  }
  if (signal.aborted) return { kind: "cancelled" } as const;
  const {
    inspectCoordinatorDecisionRequest,
    inspectCoordinatorDecisionResult,
    inspectCoordinatorObjectiveRequest,
    inspectCoordinatorObjectiveResult,
    inspectCoordinatorStateQuery,
    inspectCoordinatorStateQueryResult,
  } = coordinator;
  if (
    ![
      inspectCoordinatorDecisionRequest,
      inspectCoordinatorDecisionResult,
      inspectCoordinatorObjectiveRequest,
      inspectCoordinatorObjectiveResult,
      inspectCoordinatorStateQuery,
      inspectCoordinatorStateQueryResult,
      ...(scope
        ? [
            coordinator.runObjective,
            coordinator.submitDecision,
            coordinator.queryState,
          ]
        : []),
    ].every((inspect) => typeof inspect === "function")
  )
    return { kind: "unavailable" } as const;
  const args =
    operation === "objective"
      ? inspectCoordinatorObjectiveRequest(captured)
      : operation === "decision"
        ? inspectCoordinatorDecisionRequest(captured)
        : inspectCoordinatorStateQuery(captured);
  if (!args) return { kind: "invalid" } as const;
  let principalId: unknown;
  let ownerRoot: string | undefined;
  let authorize: (() => boolean) | undefined;
  try {
    if ("scope" in configuration) {
      const target =
        configuration.scope === "local"
          ? resolveLocalExecutionTarget(configuration.repositoryRoot, signal)
          : configuration.credentials && repositoryId !== null
            ? resolveSharedExecutionTarget(
                configuration.credentials.root,
                configuration.credentials.token,
                repositoryId,
                args.projectId,
                signal,
              )
            : null;
      if (target) {
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
  try {
    if ("scope" in configuration) {
      result =
        operation === "objective"
          ? await coordinator.runObjective(
              args,
              signal,
              ownerRoot,
              authentication,
            )
          : operation === "decision"
            ? coordinator.submitDecision(args, ownerRoot, authentication)
            : coordinator.queryState(args, ownerRoot, authentication);
    } else {
      result =
        operation === "objective"
          ? await configuration.runObjective(args, signal, authentication)
          : operation === "decision"
            ? await configuration.submitDecision(args, authentication)
            : await configuration.getProjectState(args, authentication);
    }
  } catch {
    result = null;
  }
  try {
    if (authorize && !authorize())
      return { kind: "publication_denied" } as const;
  } catch {
    return { kind: "publication_denied" } as const;
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
          ? inspectCoordinatorDecisionResult(result)
          : inspectCoordinatorStateQueryResult(result);
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
export async function readAuthorizedRuntimeActivity(
  query: Omit<RuntimeActivityRequest, "repositories">,
  selected: readonly AuthorizedRepository[],
  authorize: () => boolean,
  signal: AbortSignal,
): Promise<RuntimeActivityObservation> {
  const { queryActivity } = await import("../../../coordinator/src/index.ts");
  if (signal.aborted || !authorize())
    throw new Error("runtime_activity_unavailable");
  return queryActivity(
    {
      ...query,
      repositories: selected.map((entry) => ({
        projectId: entry.manifest.projectId,
        repositoryId: entry.repositoryId,
        root: entry.root,
      })),
    },
    signal,
  );
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
    page?: WorkbenchRuntimeActivityPageRequest,
  ) => Promise<WorkbenchRuntimeActivityObservation>;
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
      const { queryActivity } = await import(
        "../../../coordinator/src/index.ts"
      );
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
      return projectRuntimeActivityForWorkbench(observation);
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
  ) => Promise<AiRequestStartResult>;
  observe: (
    requestId: string,
    signal?: AbortSignal,
  ) => Promise<AiRequestSnapshot>;
  cancel: (
    requestId: string,
    signal?: AbortSignal,
  ) => Promise<AiRequestSnapshot>;
  close?: () => Promise<void>;
}>;

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
 * 照会・取消で指定された依頼が現在の実行Ownerに属することを確認する。
 * @responsibility 欠測・対象外を通常の照会や取消へ進めない。
 * @trace ARCH-000015
 * @boundary 呼出し側の観測結果を検査する。照会・取消は発行しない。
 */
export function requireAiRequestForAction(
  previous: AiRequestSnapshot,
): AiRequestSnapshot {
  if (
    previous.mode === null ||
    previous.reason === "orchestrator_task_not_available"
  )
    throw new Error("workbench_ai_request_identity_invalid");
  return previous;
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
export function projectRuntimeActivityForWorkbench(
  observation: RuntimeActivityObservation,
): WorkbenchRuntimeActivityObservation {
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
export type WorkbenchRuntimeActivityProjection = Readonly<{
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
export type WorkbenchRuntimeEventProjection = Readonly<{
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
export type WorkbenchRuntimeActivityPageRequest = Readonly<{
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
export type WorkbenchRuntimeActivityObservation = Readonly<{
  singleTasks?: RuntimeActivityObservation["singleTasks"];
  state: "observed" | "absent" | "unknown";
  reason: string;
  projection: WorkbenchRuntimeActivityProjection | null;
  eventState: "observed" | "unknown";
  eventReason: string;
  events: readonly WorkbenchRuntimeEventProjection[];
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
