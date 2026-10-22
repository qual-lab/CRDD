/**
 * 状態から公開投影を生成し、相関と意味を検査する。
 * @responsibility 状態から公開投影を生成し、相関と意味を検査する。
 * @trace ARCH-000004
 */

import {
  type ProjectTaskState,
  type ProjectObjectiveState,
  type ProjectMilestoneState,
  ORCHESTRATOR_MAXIMUM_OBJECTIVES,
  ORCHESTRATOR_MAXIMUM_TASKS,
  PROJECT_OBJECTIVE_STATES,
  PROJECT_TASK_STATES,
  type OrchestratorState,
} from "./model.ts";
import { selectSchedulableProjectTasks } from "../task/scheduling.ts";

/**
 * orchestrator-stateで使用するOrchestrator Projectionの値契約を定義する。
 *
 * @responsibility Orchestrator ProjectionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorProjectionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorProjectionで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorProjectionの宣言は外部境界を開かない。
 * @security N/A: OrchestratorProjectionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorProjectionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorProjection = Readonly<{
  projectId: string;
  milestoneId: string;
  generation: number;
  milestoneState: ProjectMilestoneState;
  objectiveCounts: Readonly<Record<ProjectObjectiveState, number>>;
  taskCounts: Readonly<Record<ProjectTaskState, number>>;
  objectiveTaskSummaries: readonly Readonly<{
    objectiveId: string;
    objectiveState: ProjectObjectiveState;
    taskCounts: Readonly<Record<ProjectTaskState, number>>;
  }>[];
  workProgress: "not_started" | "in_progress" | "tasks_complete";
  qualityState:
    | "not_evaluated"
    | "integration_pending"
    | "accepted"
    | "blocked";
  humanDecisionRequired: boolean;
  recoveryRequired: boolean;
  nextAction:
    | "schedule_task"
    | "wait_for_task"
    | "verify_objective_integration"
    | "verify_milestone_integration"
    | "human_decision"
    | "recover"
    | "complete";
}>;

/**
 * Validate only semantic relations carried by the public projection itself.
 *
 * @responsibility Orchestrator Projection Semantically Validの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input projection: OrchestratorProjection
 * @returns isOrchestratorProjectionSemanticallyValidの計算結果を返す。
 * @precondition 「projection: OrchestratorProjection」がisOrchestratorProjectionSemanticallyValidの入力契約を満たす。
 * @postcondition isOrchestratorProjectionSemanticallyValidの責務を完了した結果だけを返す。
 * @effect N/A: isOrchestratorProjectionSemanticallyValidは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isOrchestratorProjectionSemanticallyValidは独自の失敗分岐を所有しない。
 * @invariant isOrchestratorProjectionSemanticallyValidは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isOrchestratorProjectionSemanticallyValidはProcess内の同一Subsystemで完結する。
 * @security N/A: isOrchestratorProjectionSemanticallyValidはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isOrchestratorProjectionSemanticallyValidは共有非同期状態を持たない同期処理である。
 */
export function isOrchestratorProjectionSemanticallyValid(
  projection: OrchestratorProjection,
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
    ORCHESTRATOR_MAXIMUM_OBJECTIVES,
  );
  const taskTotal = boundedTotal(
    projection.taskCounts,
    PROJECT_TASK_STATES,
    ORCHESTRATOR_MAXIMUM_TASKS,
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
      ORCHESTRATOR_MAXIMUM_TASKS,
    );
    if (summaryTotal === null || summaryTotal < 1) return false;
    for (const state of PROJECT_TASK_STATES) {
      const next =
        mutableSummarizedTaskCounts[state] + summary.taskCounts[state];
      if (!Number.isSafeInteger(next) || next > ORCHESTRATOR_MAXIMUM_TASKS)
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
 * @responsibility Orchestrator Objective Projection Correlation Validの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input outer: Readonly<{ status: "completed" | "blocked" | "cancelled"; cleanupConfirmed: boolean; manualRecoveryRequired: boolean; processRestartRequired: boolean; effectState: "no_effect" | "settled" | "unknown"; recoveryCount: number; }>、projection: OrchestratorProjection | null
 * @returns isOrchestratorObjectiveProjectionCorrelationValidの計算結果を返す。
 * @precondition 「outer: Readonly<{ status: "completed" | "blocked" | "cancelled"; cleanupConfirmed: boolean; manualRecoveryRequired: boolean; processRestartRequired: boolean; effectState: "no_effect" | "settled" | "unknown"; recoveryCount: number; }>、projection: OrchestratorProjection | null」がisOrchestratorObjectiveProjectionCorrelationValidの入力契約を満たす。
 * @postcondition isOrchestratorObjectiveProjectionCorrelationValidの責務を完了した結果だけを返す。
 * @effect N/A: isOrchestratorObjectiveProjectionCorrelationValidは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isOrchestratorObjectiveProjectionCorrelationValidは独自の失敗分岐を所有しない。
 * @invariant isOrchestratorObjectiveProjectionCorrelationValidは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isOrchestratorObjectiveProjectionCorrelationValidはProcess内の同一Subsystemで完結する。
 * @security N/A: isOrchestratorObjectiveProjectionCorrelationValidはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isOrchestratorObjectiveProjectionCorrelationValidは共有非同期状態を持たない同期処理である。
 */
export function isOrchestratorObjectiveProjectionCorrelationValid(
  outer: Readonly<{
    status: "completed" | "blocked" | "cancelled";
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
    effectState: "no_effect" | "settled" | "unknown";
    recoveryCount: number;
  }>,
  projection: OrchestratorProjection | null,
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

/**
 * Orchestrator 状態を公開結果へ投影する。
 *
 * @responsibility Orchestrator 状態の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input state: OrchestratorState
 * @returns OrchestratorProjectionを返す。
 * @precondition 「state: OrchestratorState」がprojectOrchestratorStateの入力契約を満たす。
 * @postcondition projectOrchestratorStateの責務を完了した結果だけを返す。
 * @effect N/A: projectOrchestratorStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure projectOrchestratorStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant projectOrchestratorStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectOrchestratorStateはProcess内の同一Subsystemで完結する。
 * @security N/A: projectOrchestratorStateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: projectOrchestratorStateは共有非同期状態を持たない同期処理である。
 */
export function projectOrchestratorState(
  state: OrchestratorState,
): OrchestratorProjection {
  const objectiveCounts = countStates(
    state.objectives.map((objective) => objective.state),
    PROJECT_OBJECTIVE_STATES,
  );
  const taskCounts = countStates(
    state.tasks.map((task) => task.state),
    PROJECT_TASK_STATES,
  );
  const objectiveTaskSummaries = Object.freeze(
    state.objectives.map((objective) =>
      Object.freeze({
        objectiveId: objective.definition.id,
        objectiveState: objective.state,
        taskCounts: countStates(
          state.tasks
            .filter(
              (task) => task.definition.objectiveId === objective.definition.id,
            )
            .map((task) => task.state),
          PROJECT_TASK_STATES,
        ),
      }),
    ),
  );
  const recoveryRequired = state.milestone.state === "recovery_required";
  const humanDecisionRequired =
    state.milestone.state === "human_decision_required" ||
    state.milestone.state === "returned" ||
    objectiveCounts.returned > 0 ||
    objectiveCounts.blocked > 0;
  const allTasksComplete =
    taskCounts.completed + taskCounts.superseded === state.tasks.length;
  const anyTaskStarted =
    taskCounts.ready + taskCounts.waiting_dependency < state.tasks.length;
  const qualityState =
    state.milestone.state === "accepted"
      ? ("accepted" as const)
      : humanDecisionRequired || recoveryRequired
        ? ("blocked" as const)
        : objectiveCounts.integration_pending > 0 ||
            state.milestone.state === "integrating"
          ? ("integration_pending" as const)
          : ("not_evaluated" as const);
  const nextAction = recoveryRequired
    ? ("recover" as const)
    : humanDecisionRequired
      ? ("human_decision" as const)
      : state.milestone.state === "accepted"
        ? ("complete" as const)
        : state.milestone.state === "integrating"
          ? ("verify_milestone_integration" as const)
          : objectiveCounts.integration_pending > 0
            ? ("verify_objective_integration" as const)
            : selectSchedulableProjectTasks(state).length > 0
              ? ("schedule_task" as const)
              : ("wait_for_task" as const);
  const projection = Object.freeze({
    projectId: state.projectId,
    milestoneId: state.milestoneId,
    generation: state.generation,
    milestoneState: state.milestone.state,
    objectiveCounts,
    taskCounts,
    objectiveTaskSummaries,
    workProgress: allTasksComplete
      ? "tasks_complete"
      : anyTaskStarted
        ? "in_progress"
        : "not_started",
    qualityState,
    humanDecisionRequired,
    recoveryRequired,
    nextAction,
  });
  if (!isOrchestratorProjectionSemanticallyValid(projection))
    throw new Error("orchestrator_projection_semantics_invalid");
  return projection;
}
