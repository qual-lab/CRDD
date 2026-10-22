/**
 * project-state-queryに属する責務をまとめる。
 *
 * @responsibility CoordinatorStateQueryを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../input/plain-data-snapshot.ts";
import {
  isCoordinatorProjectionSemanticallyValid,
  type CoordinatorProjection,
} from "./projection.ts";
import {
  COORDINATOR_MAXIMUM_OBJECTIVES,
  COORDINATOR_MAXIMUM_TASKS,
} from "./model.ts";

export const COORDINATOR_STATE_QUERY_CONTRACT =
  "crdd-coordinator/orchestrator-state-query/v1" as const;

/**
 * project-state-queryで使用するCoordinator 状態 Queryの値契約を定義する。
 *
 * @responsibility Coordinator 状態 QueryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorStateQueryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorStateQueryで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorStateQueryの宣言は外部境界を開かない。
 * @security N/A: CoordinatorStateQueryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorStateQueryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorStateQuery = Readonly<{
  requestId: string;
  projectId: string;
  repositoryRevision: string;
}>;

/**
 * project-state-queryで使用するCoordinator 状態 Query 結果の値契約を定義する。
 *
 * @responsibility Coordinator 状態 Query 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorStateQueryResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorStateQueryResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorStateQueryResultの宣言は外部境界を開かない。
 * @security N/A: CoordinatorStateQueryResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorStateQueryResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorStateQueryResult = Readonly<{
  intakeEpoch: string | null;
  contract: typeof COORDINATOR_STATE_QUERY_CONTRACT;
  status: "completed" | "blocked";
  reason: string;
  requestId: string;
  projectId: string;
  repositoryRevision: string;
  observationState: "observed" | "absent" | "unknown";
  projection: CoordinatorProjection | null;
  cleanupConfirmed: true;
  manualRecoveryRequired: boolean;
  effectState: "no_effect";
}>;

const queryKeys = new Set([
  "requestId",
  "projectId",
  "repositoryRevision",
] as const);
const resultKeys = new Set([
  "intakeEpoch",
  "contract",
  "status",
  "reason",
  "requestId",
  "projectId",
  "repositoryRevision",
  "observationState",
  "projection",
  "cleanupConfirmed",
  "manualRecoveryRequired",
  "effectState",
] as const);
const projectionKeys = new Set([
  "projectId",
  "milestoneId",
  "generation",
  "milestoneState",
  "objectiveCounts",
  "taskCounts",
  "objectiveTaskSummaries",
  "workProgress",
  "qualityState",
  "humanDecisionRequired",
  "recoveryRequired",
  "nextAction",
] as const);
const OBJECTIVE_STATES = Object.freeze([
  "planned",
  "executing",
  "integration_pending",
  "accepted",
  "returned",
  "blocked",
  "cancelled",
] as const);
const TASK_STATES = Object.freeze([
  "planned",
  "waiting_dependency",
  "ready",
  "starting",
  "running",
  "cleanup_pending",
  "completed",
  "failed",
  "cancelled",
  "recovery_required",
  "superseded",
] as const);

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
function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)
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
 * Reasonが有効か判定する。
 *
 * @responsibility Reasonの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidReasonの入力契約を満たす。
 * @postcondition validReasonの責務を完了した結果だけを返す。
 * @effect N/A: validReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validReasonは独自の失敗分岐を所有しない。
 * @invariant validReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validReasonはProcess内の同一Subsystemで完結する。
 * @security N/A: validReasonはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validReasonは共有非同期状態を持たない同期処理である。
 */
function validReason(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    /^[a-z0-9_]+$/u.test(value)
  );
}

/**
 * Snapshotの件数を算出する。
 *
 * @responsibility Snapshotの計数対象、集計規則、件数結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、states: readonly T[]、maximum: number
 * @returns Readonly<Record<T, number>> | nullを返す。
 * @precondition 「value: unknown、states: readonly T[]、maximum: number」がcountSnapshotの入力契約を満たす。
 * @postcondition countSnapshotの責務を完了した結果だけを返す。
 * @effect N/A: countSnapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: countSnapshotは独自の失敗分岐を所有しない。
 * @invariant countSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: countSnapshotはProcess内の同一Subsystemで完結する。
 * @security N/A: countSnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: countSnapshotは共有非同期状態を持たない同期処理である。
 */
function countSnapshot<T extends string>(
  value: unknown,
  states: readonly T[],
  maximum: number,
): Readonly<Record<T, number>> | null {
  const record = snapshotPlainRecord(value, new Set(states));
  if (!record) return null;
  let total = 0;
  const entries: [T, number][] = [];
  for (const state of states) {
    const count = record[state];
    if (!Number.isSafeInteger(count) || Number(count) < 0) return null;
    total += Number(count);
    if (!Number.isSafeInteger(total) || total > maximum) return null;
    entries.push([state, Number(count)]);
  }
  return Object.freeze(Object.fromEntries(entries)) as Readonly<
    Record<T, number>
  >;
}

/**
 * Snapshot and validate the canonical public projection at trust boundaries.
 *
 * @responsibility Coordinator Projectionの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns CoordinatorProjection | nullを返す。
 * @precondition 「value: unknown」がinspectCoordinatorProjectionの入力契約を満たす。
 * @postcondition inspectCoordinatorProjectionの責務を完了した結果だけを返す。
 * @effect N/A: inspectCoordinatorProjectionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectCoordinatorProjectionは独自の失敗分岐を所有しない。
 * @invariant inspectCoordinatorProjectionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectCoordinatorProjectionはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectCoordinatorProjectionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectCoordinatorProjectionは共有非同期状態を持たない同期処理である。
 */
export function inspectCoordinatorProjection(
  value: unknown,
): CoordinatorProjection | null {
  const record = snapshotPlainRecord(value, projectionKeys);
  if (!record) return null;
  const objectiveCounts = countSnapshot(
    record.objectiveCounts,
    OBJECTIVE_STATES,
    COORDINATOR_MAXIMUM_OBJECTIVES,
  );
  const taskCounts = countSnapshot(
    record.taskCounts,
    TASK_STATES,
    COORDINATOR_MAXIMUM_TASKS,
  );
  const rawSummaries = snapshotPlainArray(
    record.objectiveTaskSummaries,
    COORDINATOR_MAXIMUM_OBJECTIVES,
  );
  if (!objectiveCounts || !taskCounts || rawSummaries.status !== "ok")
    return null;
  const summaries: CoordinatorProjection["objectiveTaskSummaries"][number][] =
    [];
  for (const raw of rawSummaries.value) {
    const summary = snapshotPlainRecord(
      raw,
      new Set(["objectiveId", "objectiveState", "taskCounts"]),
    );
    const counts = countSnapshot(
      summary?.taskCounts,
      TASK_STATES,
      COORDINATOR_MAXIMUM_TASKS,
    );
    if (
      !summary ||
      !validId(summary.objectiveId) ||
      !OBJECTIVE_STATES.includes(summary.objectiveState as never) ||
      !counts
    )
      return null;
    summaries.push(
      Object.freeze({
        objectiveId: summary.objectiveId,
        objectiveState:
          summary.objectiveState as (typeof OBJECTIVE_STATES)[number],
        taskCounts: counts,
      }),
    );
  }
  if (
    !validId(record.projectId) ||
    !validId(record.milestoneId) ||
    !Number.isSafeInteger(record.generation) ||
    Number(record.generation) < 1 ||
    ![
      "planned",
      "executing",
      "integrating",
      "human_decision_required",
      "recovery_required",
      "accepted",
      "returned",
      "cancelled",
    ].includes(String(record.milestoneState)) ||
    !["not_started", "in_progress", "tasks_complete"].includes(
      String(record.workProgress),
    ) ||
    !["not_evaluated", "integration_pending", "accepted", "blocked"].includes(
      String(record.qualityState),
    ) ||
    typeof record.humanDecisionRequired !== "boolean" ||
    typeof record.recoveryRequired !== "boolean" ||
    ![
      "schedule_task",
      "wait_for_task",
      "verify_objective_integration",
      "verify_milestone_integration",
      "human_decision",
      "recover",
      "complete",
    ].includes(String(record.nextAction))
  )
    return null;
  const projection = Object.freeze({
    projectId: record.projectId,
    milestoneId: record.milestoneId,
    generation: Number(record.generation),
    milestoneState: record.milestoneState,
    objectiveCounts,
    taskCounts,
    objectiveTaskSummaries: Object.freeze(summaries),
    workProgress: record.workProgress,
    qualityState: record.qualityState,
    humanDecisionRequired: record.humanDecisionRequired,
    recoveryRequired: record.recoveryRequired,
    nextAction: record.nextAction,
  }) as CoordinatorProjection;
  return isCoordinatorProjectionSemanticallyValid(projection)
    ? projection
    : null;
}

/**
 * Coordinator 状態 Queryを観測する。
 *
 * @responsibility Coordinator 状態 Queryの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns CoordinatorStateQuery | nullを返す。
 * @precondition 「value: unknown」がinspectCoordinatorStateQueryの入力契約を満たす。
 * @postcondition inspectCoordinatorStateQueryの責務を完了した結果だけを返す。
 * @effect N/A: inspectCoordinatorStateQueryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectCoordinatorStateQueryは独自の失敗分岐を所有しない。
 * @invariant inspectCoordinatorStateQueryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectCoordinatorStateQueryはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectCoordinatorStateQueryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectCoordinatorStateQueryは共有非同期状態を持たない同期処理である。
 */
export function inspectCoordinatorStateQuery(
  value: unknown,
): CoordinatorStateQuery | null {
  const request = snapshotPlainRecord(value, queryKeys);
  if (
    !request ||
    !validId(request.requestId) ||
    !validId(request.projectId) ||
    !validRevision(request.repositoryRevision)
  )
    return null;
  return Object.freeze({ ...request }) as CoordinatorStateQuery;
}

/**
 * Coordinator 状態 Query 結果を観測する。
 *
 * @responsibility Coordinator 状態 Query 結果の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns CoordinatorStateQueryResult | nullを返す。
 * @precondition 「value: unknown」がinspectCoordinatorStateQueryResultの入力契約を満たす。
 * @postcondition inspectCoordinatorStateQueryResultの責務を完了した結果だけを返す。
 * @effect N/A: inspectCoordinatorStateQueryResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectCoordinatorStateQueryResultは独自の失敗分岐を所有しない。
 * @invariant inspectCoordinatorStateQueryResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectCoordinatorStateQueryResultはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectCoordinatorStateQueryResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectCoordinatorStateQueryResultは共有非同期状態を持たない同期処理である。
 */
export function inspectCoordinatorStateQueryResult(
  value: unknown,
): CoordinatorStateQueryResult | null {
  const result = snapshotPlainRecord(value, resultKeys);
  if (
    !result ||
    (result.status === "completed"
      ? !validId(result.intakeEpoch)
      : result.intakeEpoch !== null) ||
    result.contract !== COORDINATOR_STATE_QUERY_CONTRACT ||
    !["completed", "blocked"].includes(String(result.status)) ||
    !validReason(result.reason) ||
    !validId(result.requestId) ||
    !validId(result.projectId) ||
    !validRevision(result.repositoryRevision) ||
    !["observed", "absent", "unknown"].includes(
      String(result.observationState),
    ) ||
    result.cleanupConfirmed !== true ||
    typeof result.manualRecoveryRequired !== "boolean" ||
    result.effectState !== "no_effect"
  )
    return null;
  const projection =
    result.projection === null
      ? null
      : inspectCoordinatorProjection(result.projection);
  if (
    (result.projection !== null && !projection) ||
    (result.observationState === "observed" &&
      (!projection || projection.projectId !== result.projectId)) ||
    (result.observationState !== "observed" && result.projection !== null) ||
    (result.status === "completed" && result.observationState === "unknown") ||
    (result.status === "blocked" && result.observationState !== "unknown") ||
    (result.observationState !== "unknown" && result.manualRecoveryRequired)
  )
    return null;
  return Object.freeze({
    ...result,
    projection,
  }) as CoordinatorStateQueryResult;
}
