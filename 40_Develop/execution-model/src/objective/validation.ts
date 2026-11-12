/**
 * Objectiveと実行計画の値検査と純粋な遷移・投影を所有する。
 * @responsibility I/Oや新しい権限を発行せず、モデル固有の受入条件を判定する。
 * @trace ARCH-000008
 */

import { createHash } from "node:crypto";
import type { RuntimeProjectDefinition } from "../state/types.ts";
import {
  decodeRuntimeDomainSnapshot,
  encodeRuntimeStateValue,
  hashRuntimeProjectDefinition,
  normalizeRepositoryRelativePath,
  repositoryPathWithin,
  snapshotPlainArray,
  snapshotRuntimeStateArray,
  snapshotRuntimeStateRecord,
  validId,
} from "../state/validation.ts";
import type { CallerTaskInput, ProjectTaskDefinition } from "../task/types.ts";
import type {
  CoordinatorObjectivePlan,
  CoordinatorObjectiveRequest,
  ExecutionPlanScope,
  ProjectMilestoneRecord,
  ProjectObjectiveDefinition,
  ProjectObjectiveRecord,
} from "./types.ts";

/**
 * 対象と定義本文を結合したHashを導く。
 * @responsibility 別対象の同じ本文を同一改訂と扱わない。
 * @trace ARCH-000008
 * @input project、kind、definition: 検査済み対象と定義。
 * @returns 正規UTF-8定義のSHA-256。
 * @precondition 定義の値検査を完了している。
 * @postcondition 実行状態・OwnerをHashへ混入させない。
 * @effect N/A: 純粋変換。
 * @failure 符号化不能では例外。
 * @invariant ProjectとMilestone、種別とIDを固定する。
 * @boundary 一般定義の比較交換。
 * @security Hashを操作Authorityにしない。
 * @concurrency N/A: 状態共有なし。
 */
export function hashRuntimeEntityDefinition(
  project: RuntimeProjectDefinition,
  kind: "objective" | "task",
  definition: ProjectObjectiveDefinition | ProjectTaskDefinition,
): string {
  return createHash("sha256")
    .update("crdd-domain/definition/v1\0")
    .update(
      encodeRuntimeStateValue({
        projectId: project.projectId,
        milestoneId: project.milestoneId,
        kind,
        definition,
      }),
    )
    .digest("hex");
}

/**
 * 一つの一般CRUD要求を同じSnapshotの次版へ変換する。
 * @responsibility 管理実行・受付・判断等が参照する対象を変更せず対象外区画を保持する。
 * @trace ARCH-000008
 * @input before: 元byte、kind: 固定CRUD用途、request: 未信頼入力、binding: 現在結合、revision: 現在Repository改訂。
 * @returns 次byteと返却値、又は固定した拒否・競合。
 * @precondition 操作認可と物理排他は保存Ownerが別に確認する。
 * @postcondition 未指定属性・Owner・Selectionを捏造せず新Schemaだけを生成する。
 * @effect N/A: 純粋候補生成。
 * @failure 入力不正・参照中・定義差・全体CAS差を区別する。
 * @invariant 未選択区画を変更せずCascade・自動再適用を行わない。
 * @boundary 一般定義の責務と単一物理Writer。
 * @security 任意更新callbackや完成状態の捏造を受け付けない。
 * @concurrency 同じ要求を物理確定直前にも再導出する。
 */
export function prepareRuntimeDefinitionChange(
  before: unknown,
  kind:
    | "plan.save"
    | "objective.create"
    | "objective.update"
    | "objective.delete"
    | "task.create"
    | "task.update"
    | "task.delete",
  raw: unknown,
  binding: string,
  revision: string,
) {
  const denied = (
    reason:
      | "input_invalid"
      | "target_referenced"
      | "target_missing"
      | "target_exists",
  ) => ({ status: "blocked" as const, reason });
  const request = snapshotRuntimeStateRecord(
    raw,
    new Set([
      "projectId",
      "milestoneId",
      "expected",
      ...(!kind.endsWith(".create") ? ["expectedDefinitionHash"] : []),
      ...(kind === "plan.save" || !kind.endsWith(".delete")
        ? ["definition"]
        : []),
      ...(kind.startsWith("objective.") && !kind.endsWith(".create")
        ? ["objectiveId"]
        : []),
      ...(kind.startsWith("task.") && !kind.endsWith(".create")
        ? ["taskId"]
        : []),
    ]),
  );
  if (!request || !validId(request.projectId) || !validId(request.milestoneId))
    return denied("input_invalid");
  const expected = snapshotRuntimeStateRecord(
    request.expected,
    new Set(["revision", "payloadSha256"]),
  );
  const decoded = decodeRuntimeDomainSnapshot(before, binding);
  if (
    !decoded ||
    !expected ||
    !Number.isSafeInteger(expected.revision) ||
    typeof expected.payloadSha256 !== "string"
  )
    return denied("input_invalid");
  if (
    decoded.snapshot.revision !== expected.revision ||
    decoded.payloadSha256 !== expected.payloadSha256
  )
    return { status: "conflict" as const, reason: "state_changed" as const };
  const snapshot = decoded.snapshot;
  const current = snapshot.projects.find(
    (p) =>
      p.projectId === request.projectId &&
      p.milestoneId === request.milestoneId,
  );
  if (
    snapshot.projects.some(
      (p) =>
        p.projectId === request.projectId &&
        p.milestoneId !== request.milestoneId,
    )
  )
    return denied("target_exists");
  const referenced =
    snapshot.managedExecutions.some((p) => p.projectId === request.projectId) ||
    snapshot.decisions.some(
      (row) => row.target.projectId === request.projectId,
    ) ||
    [snapshot.queueEntries, snapshot.results, snapshot.resultReceipts].some(
      (rows) => rows.some((row) => row.projectId === request.projectId),
    );
  if (
    referenced ||
    (current &&
      (current.milestone.state !== "planned" ||
        current.milestone.criterionEvidenceIds.length !== 0 ||
        current.decisionApplicationId !== null ||
        current.objectives.some(
          (o) => o.state !== "planned" || o.criterionEvidenceIds.length !== 0,
        )))
  )
    return denied("target_referenced");
  if (kind !== "plan.save" && !current) return denied("target_missing");
  let objectives = current?.objectives ?? [];
  let tasks = current?.tasks ?? [];
  let criteria = current?.milestone.acceptanceCriteria ?? [];
  let value: unknown = null;
  let changedId: string | null = null;
  if (kind === "plan.save") {
    const plan = inspectExecutionPlanDefinition(request.definition);
    if (!plan) return denied("input_invalid");
    const expectedHash = current ? hashRuntimeProjectDefinition(current) : null;
    if (request.expectedDefinitionHash !== expectedHash)
      return {
        status: "conflict" as const,
        reason: "definition_changed" as const,
      };
    objectives = plan.objectives.map((definition) => ({
      definition,
      state: "planned" as const,
      criterionEvidenceIds: [],
    }));
    tasks = plan.tasks;
    criteria = plan.milestoneAcceptanceCriteria;
  } else {
    const objective = kind.startsWith("objective.");
    const id = request[objective ? "objectiveId" : "taskId"];
    const rows = objective ? objectives.map((o) => o.definition) : tasks;
    const definition = kind.endsWith(".delete")
      ? null
      : snapshotRuntimeStateRecord(
          request.definition,
          new Set(
            objective
              ? ["id", "acceptanceCriteria"]
              : [
                  "id",
                  "objectiveId",
                  "dependencies",
                  "allowedPaths",
                  "conflictKeys",
                ],
          ),
        );
    const targetId = kind.endsWith(".create") ? definition?.id : id;
    if (!validId(targetId) || (definition && definition.id !== targetId))
      return denied("input_invalid");
    changedId = targetId;
    const prior = rows.find((row) => row.id === targetId);
    if (kind.endsWith(".create") ? !!prior : !prior)
      return denied(prior ? "target_exists" : "target_missing");
    if (
      !kind.endsWith(".create") &&
      current &&
      prior &&
      request.expectedDefinitionHash !==
        hashRuntimeEntityDefinition(
          current,
          objective ? "objective" : "task",
          prior,
        )
    )
      return {
        status: "conflict" as const,
        reason: "definition_changed" as const,
      };
    if (kind.endsWith(".delete")) {
      if (
        objective
          ? tasks.some((t) => t.objectiveId === targetId)
          : tasks.some((t) => t.dependencies.includes(targetId))
      )
        return denied("target_referenced");
      if (objective)
        objectives = objectives.filter((o) => o.definition.id !== targetId);
      else tasks = tasks.filter((t) => t.id !== targetId);
      value = { id: targetId };
    } else if (objective) {
      const row = {
        definition: definition as ProjectObjectiveDefinition,
        state: "planned" as const,
        criterionEvidenceIds: [],
      };
      objectives = kind.endsWith(".create")
        ? [...objectives, row]
        : objectives.map((o) => (o.definition.id === targetId ? row : o));
    } else {
      const row = definition as ProjectTaskDefinition;
      tasks = kind.endsWith(".create")
        ? [...tasks, row]
        : tasks.map((t) => (t.id === targetId ? row : t));
    }
  }
  const project = inspectRuntimeProjectDefinition({
    contract: "crdd-domain/project-state/v1",
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    repositoryRevision: current?.repositoryRevision ?? revision,
    generation: (current?.generation ?? 0) + 1,
    decisionApplicationId: null,
    milestone: {
      id: request.milestoneId,
      acceptanceCriteria: criteria,
      state: "planned",
      criterionEvidenceIds: [],
    },
    objectives,
    tasks,
  });
  if (!project) return denied("input_invalid");
  if (value === null) {
    if (kind === "plan.save")
      value = {
        definition: {
          milestoneAcceptanceCriteria: project.milestone.acceptanceCriteria,
          objectives: project.objectives.map((o) => o.definition),
          tasks: project.tasks,
        },
        definitionHash: hashRuntimeProjectDefinition(project),
      };
    else {
      const objective = kind.startsWith("objective.");
      const definition = objective
        ? project.objectives.find((o) => o.definition.id === changedId)
            ?.definition
        : project.tasks.find((t) => t.id === changedId);
      if (!definition) return denied("input_invalid");
      value = {
        definition,
        definitionHash: hashRuntimeEntityDefinition(
          project,
          objective ? "objective" : "task",
          definition,
        ),
      };
    }
  }
  const next = {
    ...snapshot,
    revision: snapshot.revision + 1,
    previous: {
      revision: snapshot.revision,
      payloadSha256: decoded.payloadSha256,
    },
    projects: current
      ? snapshot.projects.map((p) =>
          p.projectId === project.projectId ? project : p,
        )
      : [...snapshot.projects, project],
  };
  const bytes = Buffer.from(encodeRuntimeStateValue(next) + "\n");
  if (!decodeRuntimeDomainSnapshot(bytes, binding))
    return denied("input_invalid");
  return { status: "prepared" as const, bytes, value };
}

function inspectExplicitChoice(
  candidate: unknown,
): NonNullable<CoordinatorObjectiveRequest["choice"]> | null {
  const value = snapshotRuntimeStateRecord(
    candidate,
    new Set(["provider", "model", "effort"]),
  );
  if (
    !value ||
    (value.provider !== "codex" && value.provider !== "claude") ||
    typeof value.model !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value.model) ||
    typeof value.effort !== "string" ||
    !["low", "medium", "high", "xhigh", "max"].includes(value.effort)
  )
    return null;
  return Object.freeze({
    provider: value.provider,
    model: value.model,
    effort: value.effort as NonNullable<
      CoordinatorObjectiveRequest["choice"]
    >["effort"],
  });
}

/**
 * Idが有効か判定する。
 *
 * @responsibility Idの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidIdの入力契約を満たす。
 * @postcondition validIdの責務を完了した結果だけを返す。
 * @effect N/A: validIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdは独自の失敗分岐を所有しない。
 * @invariant validIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdはProcess内の同一Subsystemで完結する。
 * @security N/A: validIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validIdは共有非同期状態を持たない同期処理である。
 */
function validObjectiveRequestId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * Revisionが有効か判定する。
 *
 * @responsibility Revisionの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidRevisionの入力契約を満たす。
 * @postcondition validRevisionの責務を完了した結果だけを返す。
 * @effect N/A: validRevisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRevisionは独自の失敗分岐を所有しない。
 * @invariant validRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validRevisionはProcess内の同一Subsystemで完結する。
 * @security N/A: validRevisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validRevisionは共有非同期状態を持たない同期処理である。
 */
function validRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
}

/**
 * Textが有効か判定する。
 *
 * @responsibility Textの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidTextの入力契約を満たす。
 * @postcondition validTextの責務を完了した結果だけを返す。
 * @effect N/A: validTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTextは独自の失敗分岐を所有しない。
 * @invariant validTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validTextはProcess内の同一Subsystemで完結する。
 * @security N/A: validTextはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validTextは共有非同期状態を持たない同期処理である。
 */
function validObjectiveRequestText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

/**
 * Stringsを観測する。
 *
 * @responsibility Stringsの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns readonly string[] | nullを返す。
 * @precondition 「value: unknown」がinspectStringsの入力契約を満たす。
 * @postcondition inspectStringsの責務を完了した結果だけを返す。
 * @effect N/A: inspectStringsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectStringsは独自の失敗分岐を所有しない。
 * @invariant inspectStringsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectStringsはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectStringsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectStringsは共有非同期状態を持たない同期処理である。
 */
function inspectObjectiveRequestStrings(
  value: unknown,
): readonly string[] | null {
  const snapshot = snapshotRuntimeStateArray(value, Number.MAX_SAFE_INTEGER);
  if (
    snapshot.status !== "ok" ||
    snapshot.value.length === 0 ||
    !snapshot.value.every((entry) => validObjectiveRequestText(entry)) ||
    new Set(
      snapshot.value.map((entry) =>
        (entry as string).replaceAll("\\", "/").toUpperCase(),
      ),
    ).size !== snapshot.value.length
  )
    return null;
  return Object.freeze([...(snapshot.value as readonly string[])]);
}

const REQUIRED_REQUEST_KEYS = Object.freeze([
  "plan",
  "taskInputs",
  "intakeEpoch",
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
] as const);

const OPTIONAL_REQUEST_KEYS = Object.freeze([
  "workType",
  "choice",
  "workspaceId",
] as const);

const requestKeySets = Object.freeze(
  Array.from(
    { length: 2 ** OPTIONAL_REQUEST_KEYS.length },
    (_entry, mask) => mask,
  ).map(
    (mask) =>
      new Set([
        ...REQUIRED_REQUEST_KEYS,
        ...OPTIONAL_REQUEST_KEYS.filter(
          (_optional, index) => (mask & (1 << index)) !== 0,
        ),
      ]),
  ),
);

/**
 * Coordinator Objective Requestを観測する。
 *
 * @responsibility 閉じたObjective入力を所有Snapshotへ変換し、分類と明示選択の形式を検査する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns CoordinatorObjectiveRequest | nullを返す。
 * @precondition 「value: unknown」がinspectCoordinatorObjectiveRequestの入力契約を満たす。
 * @postcondition 受理した三項目を独立Snapshotにし、省略された希望を生成しない。
 * @effect N/A: inspectCoordinatorObjectiveRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectCoordinatorObjectiveRequestは独自の失敗分岐を所有しない。
 * @invariant inspectCoordinatorObjectiveRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectCoordinatorObjectiveRequestはProcess内の同一Subsystemで完結する。
 * @security 未知field、Accessor、Proxyと不正形式を拒否する。分類参照・技術適合性は選定Resolverが別に検証する。
 * @concurrency N/A: inspectCoordinatorObjectiveRequestは共有非同期状態を持たない同期処理である。
 */
export function inspectCoordinatorObjectiveRequest(
  value: unknown,
): CoordinatorObjectiveRequest | null {
  const requestSnapshot = requestKeySets.reduce<Readonly<
    Record<string, unknown>
  > | null>(
    (accepted, keys) => accepted ?? snapshotRuntimeStateRecord(value, keys),
    null,
  );
  if (!requestSnapshot) return null;
  const request: Readonly<Record<string, unknown>> = requestSnapshot;
  const choice = Object.hasOwn(request, "choice")
    ? inspectExplicitChoice(request.choice)
    : undefined;
  const acceptanceCriteria = inspectObjectiveRequestStrings(
    request.acceptanceCriteria,
  );
  const allowedPaths = inspectObjectiveRequestStrings(request.allowedPaths);
  const readPaths = inspectObjectiveRequestStrings(request.readPaths);
  if (
    !validObjectiveRequestId(request.intakeEpoch) ||
    !validObjectiveRequestId(request.requestId) ||
    !validObjectiveRequestId(request.projectId) ||
    !validObjectiveRequestId(request.milestoneId) ||
    !validRevision(request.repositoryRevision) ||
    !validObjectiveRequestText(request.objective) ||
    !acceptanceCriteria ||
    !allowedPaths ||
    !readPaths ||
    !allowedPaths.every(
      (candidate) => normalizeRepositoryRelativePath(candidate) !== null,
    ) ||
    !readPaths.every(
      (candidate) => normalizeRepositoryRelativePath(candidate) !== null,
    ) ||
    !Number.isSafeInteger(request.maximumConcurrency) ||
    (request.maximumConcurrency as number) < 1 ||
    (request.maximumConcurrency as number) > 5 ||
    !Number.isSafeInteger(request.maximumReplans) ||
    (request.maximumReplans as number) < 0 ||
    (request.maximumReplans as number) > 32 ||
    (request.originLane !== "interactive" &&
      request.originLane !== "scheduled") ||
    typeof request.adoptResult !== "boolean" ||
    (Object.hasOwn(request, "workType") &&
      (typeof request.workType !== "string" ||
        !/^[a-z0-9][a-z0-9._-]*$/u.test(request.workType))) ||
    choice === null ||
    (Object.hasOwn(request, "workspaceId") &&
      (typeof request.workspaceId !== "string" ||
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(
          request.workspaceId,
        )))
  )
    return null;
  const plan = inspectExecutionPlan(request.plan, { allowedPaths });
  if (
    !plan ||
    JSON.stringify(plan.milestoneAcceptanceCriteria) !==
      JSON.stringify(acceptanceCriteria)
  )
    return null;
  const taskInputs = inspectCallerTaskInputs(
    plan,
    request.taskInputs,
    readPaths,
  );
  if (!taskInputs) return null;
  return Object.freeze({
    plan,
    taskInputs,
    intakeEpoch: request.intakeEpoch,
    requestId: request.requestId,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    repositoryRevision: request.repositoryRevision,
    objective: request.objective,
    acceptanceCriteria,
    allowedPaths,
    readPaths,
    maximumConcurrency: request.maximumConcurrency as number,
    maximumReplans: request.maximumReplans as number,
    originLane: request.originLane,
    adoptResult: request.adoptResult,
    ...(typeof request.workType === "string"
      ? { workType: request.workType }
      : {}),
    ...(choice ? { choice } : {}),
    ...(typeof request.workspaceId === "string"
      ? { workspaceId: request.workspaceId }
      : {}),
  });
}

export const COORDINATOR_OBJECTIVE_INTAKE_CONTRACT =
  "crdd-coordinator/orchestrator-objective-intake/v2" as const;

/**
 * Idが有効か判定する。
 *
 * @responsibility Idの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidIdの入力契約を満たす。
 * @postcondition validIdの責務を完了した結果だけを返す。
 * @effect N/A: validIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdは独自の失敗分岐を所有しない。
 * @invariant validIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdはProcess内の同一Subsystemで完結する。
 * @security N/A: validIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validIdは共有非同期状態を持たない同期処理である。
 */
function validObjectiveId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * Textが有効か判定する。
 *
 * @responsibility Textの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidTextの入力契約を満たす。
 * @postcondition validTextの責務を完了した結果だけを返す。
 * @effect N/A: validTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTextは独自の失敗分岐を所有しない。
 * @invariant validTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validTextはProcess内の同一Subsystemで完結する。
 * @security N/A: validTextはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validTextは共有非同期状態を持たない同期処理である。
 */
function validText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

/**
 * Stringsを観測する。
 *
 * @responsibility Stringsの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、shouldAllowEmpty
 * @returns readonly string[] | nullを返す。
 * @precondition 「value: unknown、shouldAllowEmpty」がinspectStringsの入力契約を満たす。
 * @postcondition inspectStringsの責務を完了した結果だけを返す。
 * @effect N/A: inspectStringsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectStringsは独自の失敗分岐を所有しない。
 * @invariant inspectStringsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectStringsはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectStringsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectStringsは共有非同期状態を持たない同期処理である。
 */
function inspectStrings(
  value: unknown,
  shouldAllowEmpty = false,
): readonly string[] | null {
  const snapshot = snapshotPlainArray(value, Number.MAX_SAFE_INTEGER);
  if (
    snapshot.status !== "ok" ||
    (!shouldAllowEmpty && snapshot.value.length === 0) ||
    !snapshot.value.every((entry) => validText(entry)) ||
    new Set(
      snapshot.value.map((entry) =>
        (entry as string).replaceAll("\\", "/").toUpperCase(),
      ),
    ).size !== snapshot.value.length
  )
    return null;
  return Object.freeze([...(snapshot.value as readonly string[])]);
}

/**
 * path Withinを決定する。
 *
 * @responsibility path Withinの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input candidate: string、roots: readonly string[]
 * @returns pathWithinの計算結果を返す。
 * @precondition 「candidate: string、roots: readonly string[]」がpathWithinの入力契約を満たす。
 * @postcondition pathWithinの責務を完了した結果だけを返す。
 * @effect N/A: pathWithinは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: pathWithinは独自の失敗分岐を所有しない。
 * @invariant pathWithinは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: pathWithinはProcess内の同一Subsystemで完結する。
 * @security N/A: pathWithinはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: pathWithinは共有非同期状態を持たない同期処理である。
 */
function pathWithin(candidate: string, roots: readonly string[]) {
  return repositoryPathWithin(candidate, roots);
}

/**
 * 未信頼の計画定義と外側の対象範囲を検査する。
 *
 * @responsibility Coordinator Objective Planの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown、request: ExecutionPlanScope
 * @returns CoordinatorObjectivePlan | nullを返す。
 * @precondition 「raw: unknown、request: ExecutionPlanScope」がinspectExecutionPlanの入力契約を満たす。
 * @postcondition inspectExecutionPlanの責務を完了した結果だけを返す。
 * @effect N/A: inspectExecutionPlanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectExecutionPlanは独自の失敗分岐を所有しない。
 * @invariant inspectExecutionPlanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectExecutionPlanはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectExecutionPlanはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectExecutionPlanは共有非同期状態を持たない同期処理である。
 */
export function inspectExecutionPlan(
  raw: unknown,
  request: ExecutionPlanScope,
): CoordinatorObjectivePlan | null {
  const scope = snapshotRuntimeStateRecord(request, new Set(["allowedPaths"]));
  if (!scope) return null;
  const allowedRoots = snapshotPlainArray(
    scope.allowedPaths,
    Number.MAX_SAFE_INTEGER,
  );
  if (
    allowedRoots.status !== "ok" ||
    allowedRoots.value.length === 0 ||
    !allowedRoots.value.every(
      (root) => typeof root === "string" && repositoryPathWithin(root, [root]),
    )
  )
    return null;
  const plan = inspectExecutionPlanDefinition(raw);
  return plan?.tasks.every((task) =>
    task.allowedPaths.every((candidate) =>
      pathWithin(candidate, allowedRoots.value as readonly string[]),
    ),
  )
    ? plan
    : null;
}

/**
 * 実行設定や認可範囲を要求せず、計画定義そのものを検査する。
 * @responsibility 既存の閉形式・件数・ID・Path文法・DAG条件を共有する。
 * @trace ARCH-000004
 * @input raw: 未信頼の計画定義。
 * @returns 不変の完全定義、またはnull。
 * @precondition N/A: 任意値を拒否可能。
 * @postcondition AI選定・Owner・実行状態を補完しない。
 * @effect N/A: メモリ内の検査だけ。
 * @failure 欠測・不正形状・循環・不正文法はnull。
 * @invariant 定義の有効性は実行範囲への認可ではない。
 * @boundary Core定義と管理実行の範囲検査を分離する。
 * @security 実行利用側はinspectExecutionPlanで外側範囲も検査する。
 * @concurrency N/A: 共有状態なし。
 */
export function inspectExecutionPlanDefinition(
  raw: unknown,
): CoordinatorObjectivePlan | null {
  const plan = inspectRuntimePlanDefinition(raw);
  return plan &&
    plan.objectives.length > 0 &&
    plan.tasks.length > 0 &&
    plan.objectives.every((objective) =>
      plan.tasks.some((task) => task.objectiveId === objective.id),
    )
    ? plan
    : null;
}

/**
 * 一般CRUDの合法な中間保存を含む定義集合を検査する。
 * @responsibility 空集合・未割当Objectiveを実行開始と区別し、参照・DAG・文法を固定する。
 * @trace ARCH-000004
 * @input raw: 未信頼の定義集合。
 * @returns 不変定義、またはnull。
 * @precondition N/A: 任意値を拒否可能。
 * @postcondition 偽Task・Selection・Ownerを生成しない。
 * @effect N/A: メモリ内の値検査。
 * @failure 重複・不正参照・循環・不正文法はnull。
 * @invariant Coreの合法性を管理実行の完全性や認可へ読み替えない。
 * @boundary Core定義と実行受付を明示的に区別する。
 * @security 実行利用側は必ずinspectExecutionPlanを使用する。
 * @concurrency N/A: 共有状態なし。
 */
export function inspectRuntimePlanDefinition(
  raw: unknown,
): CoordinatorObjectivePlan | null {
  const plan = snapshotRuntimeStateRecord(
    raw,
    new Set(["milestoneAcceptanceCriteria", "objectives", "tasks"] as const),
  );
  if (!plan) return null;
  const milestoneAcceptanceCriteria = inspectStrings(
    plan.milestoneAcceptanceCriteria,
  );
  const rawObjectives = snapshotPlainArray(
    plan.objectives,
    Number.MAX_SAFE_INTEGER,
  );
  const rawTasks = snapshotPlainArray(plan.tasks, Number.MAX_SAFE_INTEGER);
  if (
    !milestoneAcceptanceCriteria ||
    rawObjectives.status !== "ok" ||
    rawTasks.status !== "ok"
  )
    return null;
  const objectives: ProjectObjectiveDefinition[] = [];
  for (const rawObjective of rawObjectives.value) {
    const objective = snapshotRuntimeStateRecord(
      rawObjective,
      new Set(["id", "acceptanceCriteria"] as const),
    );
    if (!objective || !validObjectiveId(objective.id)) return null;
    const acceptanceCriteria = inspectStrings(objective.acceptanceCriteria);
    if (!acceptanceCriteria) return null;
    objectives.push(Object.freeze({ id: objective.id, acceptanceCriteria }));
  }
  const tasks: ProjectTaskDefinition[] = [];
  for (const rawTask of rawTasks.value) {
    const task = snapshotRuntimeStateRecord(
      rawTask,
      new Set([
        "id",
        "objectiveId",
        "dependencies",
        "allowedPaths",
        "conflictKeys",
      ] as const),
    );
    if (
      !task ||
      !validObjectiveId(task.id) ||
      !validObjectiveId(task.objectiveId)
    )
      return null;
    const dependencies = inspectStrings(task.dependencies, true);
    const allowedPaths = inspectStrings(task.allowedPaths);
    const conflictKeys = inspectStrings(task.conflictKeys, true);
    if (
      !dependencies ||
      !allowedPaths ||
      !conflictKeys ||
      !allowedPaths.every((candidate) =>
        repositoryPathWithin(candidate, [candidate]),
      )
    )
      return null;
    tasks.push(
      Object.freeze({
        id: task.id,
        objectiveId: task.objectiveId,
        dependencies,
        allowedPaths,
        conflictKeys,
      }),
    );
  }
  const taskIds = new Set(tasks.map((task) => task.id));
  const objectiveIds = new Set(objectives.map((objective) => objective.id));
  if (
    taskIds.size !== tasks.length ||
    objectiveIds.size !== objectives.length ||
    tasks.some(
      (task) =>
        !objectiveIds.has(task.objectiveId) ||
        task.dependencies.some((id) => !taskIds.has(id)),
    )
  )
    return null;
  const dependencies = new Map(
    tasks.map((task) => [task.id, task.dependencies]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    for (const dependency of dependencies.get(id) ?? []) {
      if (!visit(dependency)) return false;
    }
    visiting.delete(id);
    visited.add(id);
    return true;
  };
  if (!tasks.every((task) => visit(task.id))) return null;
  return Object.freeze({
    milestoneAcceptanceCriteria,
    objectives: Object.freeze(objectives),
    tasks: Object.freeze(tasks),
  });
}

/**
 * 実行資格を含まないProject定義の閉じた保存値を検査する。
 * @responsibility 対象ID・改訂・判断値とCore計画を一つの不変値へ固定する。
 * @trace ARCH-000004
 * @input raw: 新形式のProject定義候補。
 * @returns 完全に検査したCore値、又はnull。
 * @precondition N/A: 未信頼値を拒否できる。
 * @postcondition Task定義を一度だけ保持し、SelectionやOwnerを補完しない。
 * @effect N/A: 局所値の検査のみ。
 * @failure 不正Schema・ID・改訂・記録値・依存参照はnull。
 * @invariant 記録の状態値は実行許可や新たな完了報告ではない。
 * @boundary Core定義と管理実行記録。
 * @security Getter・Proxyを評価しない。保存・認可を発行しない。
 * @concurrency N/A: 共有状態なし。
 */
export function inspectRuntimeProjectDefinition(
  raw: unknown,
): RuntimeProjectDefinition | null {
  const project = snapshotRuntimeStateRecord(
    raw,
    new Set([
      "contract",
      "projectId",
      "milestoneId",
      "repositoryRevision",
      "generation",
      "decisionApplicationId",
      "milestone",
      "objectives",
      "tasks",
    ]),
  );
  if (
    project?.contract !== "crdd-domain/project-state/v1" ||
    !validObjectiveId(project.projectId) ||
    !validObjectiveId(project.milestoneId) ||
    typeof project.repositoryRevision !== "string" ||
    !/^[a-f0-9]{40,64}$/u.test(project.repositoryRevision) ||
    !Number.isSafeInteger(project.generation) ||
    Number(project.generation) < 1 ||
    (project.decisionApplicationId !== null &&
      !validObjectiveId(project.decisionApplicationId))
  )
    return null;
  const milestone = snapshotRuntimeStateRecord(
    project.milestone,
    new Set(["id", "acceptanceCriteria", "state", "criterionEvidenceIds"]),
  );
  const objectives = snapshotPlainArray(
    project.objectives,
    Number.MAX_SAFE_INTEGER,
  );
  if (
    !milestone ||
    milestone.id !== project.milestoneId ||
    typeof milestone.state !== "string" ||
    ![
      "planned",
      "executing",
      "integrating",
      "human_decision_required",
      "recovery_required",
      "accepted",
      "returned",
      "cancelled",
    ].includes(milestone.state) ||
    objectives.status !== "ok"
  )
    return null;
  const milestoneEvidence = inspectStrings(
    milestone.criterionEvidenceIds,
    true,
  );
  if (!milestoneEvidence) return null;
  const records: ProjectObjectiveRecord[] = [];
  for (const rawObjective of objectives.value) {
    const objective = snapshotRuntimeStateRecord(
      rawObjective,
      new Set(["definition", "state", "criterionEvidenceIds"]),
    );
    if (
      !objective ||
      typeof objective.state !== "string" ||
      ![
        "planned",
        "executing",
        "integration_pending",
        "accepted",
        "returned",
        "blocked",
        "cancelled",
      ].includes(objective.state)
    )
      return null;
    const evidence = inspectStrings(objective.criterionEvidenceIds, true);
    if (!evidence) return null;
    records.push({
      definition: objective.definition as ProjectObjectiveDefinition,
      state: objective.state as ProjectObjectiveRecord["state"],
      criterionEvidenceIds: evidence,
    });
  }
  const definition = inspectRuntimePlanDefinition({
    milestoneAcceptanceCriteria: milestone.acceptanceCriteria,
    objectives: records.map((record) => record.definition),
    tasks: project.tasks,
  });
  if (!definition) return null;
  return Object.freeze({
    contract: "crdd-domain/project-state/v1",
    projectId: project.projectId,
    milestoneId: project.milestoneId,
    repositoryRevision: project.repositoryRevision,
    generation: Number(project.generation),
    decisionApplicationId: project.decisionApplicationId as string | null,
    milestone: Object.freeze({
      id: project.milestoneId,
      acceptanceCriteria: definition.milestoneAcceptanceCriteria,
      state: milestone.state as ProjectMilestoneRecord["state"],
      criterionEvidenceIds: milestoneEvidence,
    }),
    objectives: Object.freeze(
      records.map((record, index) =>
        Object.freeze({
          ...record,
          definition: definition.objectives[
            index
          ] as ProjectObjectiveDefinition,
        }),
      ),
    ),
    tasks: definition.tasks,
  });
}

/**
 * Task定義と実行入力を一対一で固定する。
 * @responsibility 不足・余剰・重複・範囲外を拒否し、指示を自動生成しない。
 * @trace ARCH-000004
 * @input 検査済み計画、未信頼入力、全体の読取り範囲。
 * @returns 同じ宣言順の不変入力、又はnull。
 * @effect 外部Effectなし。
 * @security Getter／Proxyを実行せず、認可や再開権限を発行しない。
 */
export function inspectCallerTaskInputs(
  plan: CoordinatorObjectivePlan,
  candidate: unknown,
  readPaths: readonly string[],
): readonly CallerTaskInput[] | null {
  const entries = snapshotPlainArray(candidate, Number.MAX_SAFE_INTEGER);
  const roots = snapshotPlainArray(readPaths, Number.MAX_SAFE_INTEGER);
  if (
    entries.status !== "ok" ||
    roots.status !== "ok" ||
    entries.value.length !== plan.tasks.length ||
    roots.value.length === 0 ||
    !roots.value.every(
      (root) => typeof root === "string" && repositoryPathWithin(root, [root]),
    )
  )
    return null;
  const ids = new Set(plan.tasks.map((task) => task.id));
  const seen = new Set<string>();
  const inputs: CallerTaskInput[] = [];
  for (const entry of entries.value) {
    const input = snapshotRuntimeStateRecord(
      entry,
      new Set(["taskId", "objective", "acceptanceCriteria", "readPaths"]),
    );
    if (
      !input ||
      !validObjectiveId(input.taskId) ||
      !ids.has(input.taskId) ||
      seen.has(input.taskId) ||
      !validText(input.objective)
    )
      return null;
    const acceptanceCriteria = inspectStrings(input.acceptanceCriteria);
    const paths = inspectStrings(input.readPaths);
    if (
      !acceptanceCriteria ||
      !paths?.every((value) =>
        repositoryPathWithin(value, roots.value as readonly string[]),
      )
    )
      return null;
    seen.add(input.taskId);
    inputs.push(
      Object.freeze({
        taskId: input.taskId,
        objective: input.objective,
        acceptanceCriteria,
        readPaths: paths,
      }),
    );
  }
  return Object.freeze(inputs);
}
