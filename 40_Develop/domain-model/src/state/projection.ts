/**
 * 公開状態投影の形式・相関を検査する。
 * @packageDocumentation
 * @responsibility 共有値の閉形式と相関を検査し、実行・保存・認可を発行しない。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary Domain値と利用側の入力・公開結果。
 */
import type {
  CoordinatorProjection,
  CoordinatorStateQueryResult,
} from "./projection-types.ts";
import type { ProjectTaskState } from "../task/types.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
  validId,
} from "./validation.ts";
import { COORDINATOR_STATE_QUERY_CONTRACT } from "./query.ts";
/**
 * 公開照会と同じGit改訂の字句境界を検査する。
 * @responsibility 値の形式だけを判定し、実Gitの現在性を保証しない。
 * @trace ARCH-000004
 */
const validRevision = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
export const COORDINATOR_MAXIMUM_OBJECTIVES = 128;
export const COORDINATOR_MAXIMUM_TASKS = 1024;
export const PROJECT_OBJECTIVE_STATES = Object.freeze([
  "planned",
  "executing",
  "integration_pending",
  "accepted",
  "returned",
  "blocked",
  "cancelled",
] as const);
export const PROJECT_TASK_STATES = Object.freeze([
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

/**
 * Validate only semantic relations carried by the public projection itself.
 *
 * @responsibility Coordinator Projection Semantically Validの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input projection: CoordinatorProjection
 * @returns isCoordinatorProjectionSemanticallyValidの計算結果を返す。
 * @precondition 「projection: CoordinatorProjection」がisCoordinatorProjectionSemanticallyValidの入力契約を満たす。
 * @postcondition isCoordinatorProjectionSemanticallyValidの責務を完了した結果だけを返す。
 * @effect N/A: isCoordinatorProjectionSemanticallyValidは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isCoordinatorProjectionSemanticallyValidは独自の失敗分岐を所有しない。
 * @invariant isCoordinatorProjectionSemanticallyValidは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isCoordinatorProjectionSemanticallyValidはProcess内の同一Subsystemで完結する。
 * @security N/A: isCoordinatorProjectionSemanticallyValidはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isCoordinatorProjectionSemanticallyValidは共有非同期状態を持たない同期処理である。
 */
export function isCoordinatorProjectionSemanticallyValid(
  projection: CoordinatorProjection,
) {
  const boundedTotal = <T extends string>(
    counts: Readonly<Record<T, number>>,
    states: readonly T[],
    maximum: number,
  ) => {
    let total = 0;
    for (const state of states) {
      const value = counts[state];
      if (!Number.isSafeInteger(value) || value < 0 || value > maximum)
        return null;
      total += value;
      if (!Number.isSafeInteger(total) || total > maximum) return null;
    }
    return total;
  };
  const objectiveTotal = boundedTotal(
    projection.objectiveCounts,
    PROJECT_OBJECTIVE_STATES,
    COORDINATOR_MAXIMUM_OBJECTIVES,
  );
  const taskTotal = boundedTotal(
    projection.taskCounts,
    PROJECT_TASK_STATES,
    COORDINATOR_MAXIMUM_TASKS,
  );
  if (objectiveTotal === null || taskTotal === null) return false;
  if (objectiveTotal < 1 || taskTotal < 1) return false;
  if (
    projection.objectiveTaskSummaries.length !== objectiveTotal ||
    new Set(projection.objectiveTaskSummaries.map((entry) => entry.objectiveId))
      .size !== objectiveTotal
  )
    return false;
  const summarizedObjectiveCounts = countStates(
    projection.objectiveTaskSummaries.map((entry) => entry.objectiveState),
    PROJECT_OBJECTIVE_STATES,
  );
  const mutableSummarizedTaskCounts = Object.fromEntries(
    PROJECT_TASK_STATES.map((state) => [state, 0]),
  ) as Record<ProjectTaskState, number>;
  for (const summary of projection.objectiveTaskSummaries) {
    const summaryTotal = boundedTotal(
      summary.taskCounts,
      PROJECT_TASK_STATES,
      COORDINATOR_MAXIMUM_TASKS,
    );
    if (summaryTotal === null || summaryTotal < 1) return false;
    for (const state of PROJECT_TASK_STATES) {
      const next =
        mutableSummarizedTaskCounts[state] + summary.taskCounts[state];
      if (!Number.isSafeInteger(next) || next > COORDINATOR_MAXIMUM_TASKS)
        return false;
      mutableSummarizedTaskCounts[state] = next;
    }
  }
  const summarizedTaskCounts = Object.freeze(mutableSummarizedTaskCounts);
  if (
    JSON.stringify(summarizedObjectiveCounts) !==
      JSON.stringify(projection.objectiveCounts) ||
    JSON.stringify(summarizedTaskCounts) !==
      JSON.stringify(projection.taskCounts)
  )
    return false;
  for (const summary of projection.objectiveTaskSummaries) {
    const count = (states: readonly ProjectTaskState[]) =>
      states.reduce((sum, state) => sum + summary.taskCounts[state], 0);
    const summaryTotal = count(PROJECT_TASK_STATES);
    if (summaryTotal < 1) return false;
    const notStarted = count(["planned", "waiting_dependency", "ready"]);
    const blocked = count(["failed", "cancelled", "recovery_required"]);
    if (summary.objectiveState === "planned" && notStarted !== summaryTotal)
      return false;
    if (
      summary.objectiveState === "executing" &&
      (notStarted === summaryTotal ||
        summary.taskCounts.completed + summary.taskCounts.superseded ===
          summaryTotal ||
        blocked > 0)
    )
      return false;
    if (
      ["integration_pending", "accepted", "returned"].includes(
        summary.objectiveState,
      ) &&
      summary.taskCounts.completed + summary.taskCounts.superseded !==
        summaryTotal
    )
      return false;
    if (summary.objectiveState === "blocked" && blocked === 0) return false;
    if (
      summary.objectiveState === "cancelled" &&
      summary.taskCounts.cancelled === 0
    )
      return false;
  }
  const recoveryRequired = projection.milestoneState === "recovery_required";
  const humanDecisionRequired =
    projection.milestoneState === "human_decision_required" ||
    projection.milestoneState === "returned" ||
    projection.objectiveCounts.returned > 0 ||
    projection.objectiveCounts.blocked > 0;
  const allTasksComplete =
    projection.taskCounts.completed + projection.taskCounts.superseded ===
    taskTotal;
  const anyTaskStarted =
    projection.taskCounts.ready + projection.taskCounts.waiting_dependency <
    taskTotal;
  const workProgress = allTasksComplete
    ? "tasks_complete"
    : anyTaskStarted
      ? "in_progress"
      : "not_started";
  const qualityState =
    projection.milestoneState === "accepted"
      ? "accepted"
      : humanDecisionRequired || recoveryRequired
        ? "blocked"
        : projection.objectiveCounts.integration_pending > 0 ||
            projection.milestoneState === "integrating"
          ? "integration_pending"
          : "not_evaluated";
  const expectedAction = recoveryRequired
    ? "recover"
    : humanDecisionRequired
      ? "human_decision"
      : projection.milestoneState === "accepted"
        ? "complete"
        : projection.milestoneState === "integrating"
          ? "verify_milestone_integration"
          : projection.objectiveCounts.integration_pending > 0
            ? "verify_objective_integration"
            : null;
  const isAllObjectivesPlanned =
    projection.objectiveCounts.planned === objectiveTotal;
  const isAllObjectivesAccepted =
    projection.objectiveCounts.accepted === objectiveTotal;
  const isAllTasksWaitingToStart =
    projection.taskCounts.ready + projection.taskCounts.waiting_dependency ===
    taskTotal;
  const isAllTasksTerminalForIntegration =
    projection.taskCounts.completed + projection.taskCounts.superseded ===
    taskTotal;
  const isAggregateReachable =
    (!isAllObjectivesPlanned || projection.taskCounts.completed === 0) &&
    (!allTasksComplete ||
      (projection.objectiveCounts.planned === 0 &&
        projection.objectiveCounts.executing === 0)) &&
    (projection.objectiveCounts.integration_pending === 0 ||
      projection.taskCounts.completed > 0);
  const isMilestoneReachable =
    isAggregateReachable &&
    (projection.milestoneState !== "planned" ||
      (isAllObjectivesPlanned && isAllTasksWaitingToStart)) &&
    (projection.milestoneState !== "executing" ||
      (!isAllObjectivesPlanned && !isAllObjectivesAccepted)) &&
    (projection.milestoneState !== "integrating" ||
      (isAllObjectivesAccepted && isAllTasksTerminalForIntegration)) &&
    (projection.milestoneState !== "accepted" ||
      (isAllObjectivesAccepted &&
        projection.objectiveCounts.blocked === 0 &&
        projection.objectiveCounts.cancelled === 0 &&
        isAllTasksTerminalForIntegration &&
        projection.taskCounts.recovery_required === 0)) &&
    (projection.milestoneState !== "returned" ||
      (isAllObjectivesAccepted && isAllTasksTerminalForIntegration)) &&
    (projection.milestoneState !== "recovery_required" ||
      projection.taskCounts.recovery_required > 0) &&
    (projection.milestoneState !== "human_decision_required" ||
      projection.objectiveCounts.blocked > 0) &&
    (projection.milestoneState !== "cancelled" ||
      (projection.taskCounts.starting === 0 &&
        projection.taskCounts.running === 0 &&
        projection.taskCounts.cleanup_pending === 0 &&
        projection.taskCounts.recovery_required === 0));
  return (
    isMilestoneReachable &&
    projection.recoveryRequired === recoveryRequired &&
    projection.humanDecisionRequired === humanDecisionRequired &&
    projection.workProgress === workProgress &&
    projection.qualityState === qualityState &&
    (expectedAction === null
      ? projection.nextAction === "schedule_task" ||
        projection.nextAction === "wait_for_task"
      : projection.nextAction === expectedAction)
  );
}

/**
 * Validate the relation between the public Objective result and its already
 *
 * @responsibility Coordinator Objective Projection Correlation Validの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input outer: Readonly<{ status: "completed" | "blocked" | "cancelled"; cleanupConfirmed: boolean; manualRecoveryRequired: boolean; processRestartRequired: boolean; effectState: "no_effect" | "settled" | "unknown"; recoveryCount: number; }>、projection: CoordinatorProjection | null
 * @returns isCoordinatorObjectiveProjectionCorrelationValidの計算結果を返す。
 * @precondition 「outer: Readonly<{ status: "completed" | "blocked" | "cancelled"; cleanupConfirmed: boolean; manualRecoveryRequired: boolean; processRestartRequired: boolean; effectState: "no_effect" | "settled" | "unknown"; recoveryCount: number; }>、projection: CoordinatorProjection | null」がisCoordinatorObjectiveProjectionCorrelationValidの入力契約を満たす。
 * @postcondition isCoordinatorObjectiveProjectionCorrelationValidの責務を完了した結果だけを返す。
 * @effect N/A: isCoordinatorObjectiveProjectionCorrelationValidは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isCoordinatorObjectiveProjectionCorrelationValidは独自の失敗分岐を所有しない。
 * @invariant isCoordinatorObjectiveProjectionCorrelationValidは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isCoordinatorObjectiveProjectionCorrelationValidはProcess内の同一Subsystemで完結する。
 * @security N/A: isCoordinatorObjectiveProjectionCorrelationValidはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isCoordinatorObjectiveProjectionCorrelationValidは共有非同期状態を持たない同期処理である。
 */
export function isCoordinatorObjectiveProjectionCorrelationValid(
  outer: Readonly<{
    status: "completed" | "blocked" | "cancelled";
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
    effectState: "no_effect" | "settled" | "unknown";
    recoveryCount: number;
  }>,
  projection: CoordinatorProjection | null,
) {
  if (!projection) return true;
  if (outer.status === "completed" && projection.milestoneState !== "accepted")
    return false;
  if (outer.status === "cancelled" && projection.milestoneState !== "cancelled")
    return false;
  if (
    projection.nextAction === "recover" &&
    (outer.status !== "blocked" ||
      outer.cleanupConfirmed ||
      !outer.manualRecoveryRequired ||
      outer.effectState !== "unknown" ||
      outer.recoveryCount < 1)
  )
    return false;
  if (
    projection.milestoneState === "accepted" &&
    (outer.status !== "completed" ||
      outer.cleanupConfirmed !== true ||
      outer.manualRecoveryRequired ||
      outer.processRestartRequired ||
      outer.recoveryCount !== 0 ||
      outer.effectState === "unknown")
  )
    return false;
  return true;
}

/**
 * Statesの件数を算出する。
 *
 * @responsibility Statesの計数対象、集計規則、件数結果境界を所有する。
 * @trace ARCH-000004
 * @input values: readonly T[]、states: readonly T[]
 * @returns Readonly<Record<T, number>>を返す。
 * @precondition 「values: readonly T[]、states: readonly T[]」がcountStatesの入力契約を満たす。
 * @postcondition countStatesの責務を完了した結果だけを返す。
 * @effect N/A: countStatesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: countStatesは独自の失敗分岐を所有しない。
 * @invariant countStatesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: countStatesはProcess内の同一Subsystemで完結する。
 * @security N/A: countStatesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: countStatesは共有非同期状態を持たない同期処理である。
 */
function countStates<T extends string>(
  values: readonly T[],
  states: readonly T[],
): Readonly<Record<T, number>> {
  return Object.freeze(
    Object.fromEntries(
      states.map((state) => [
        state,
        values.filter((value) => value === state).length,
      ]),
    ) as Record<T, number>,
  );
}

export const COORDINATOR_PUBLIC_RUNTIME_CONTRACT =
  "crdd-coordinator/public-runtime/v2" as const;
