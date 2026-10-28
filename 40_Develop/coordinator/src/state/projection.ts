/**
 * 状態から公開投影を生成し、相関と意味を検査する。
 * @responsibility 状態から公開投影を生成し、相関と意味を検査する。
 * @trace ARCH-000004
 */

import {
  COORDINATOR_STATE_CONTRACT,
  inspectTaskExecutionSelections,
  type CoordinatorState,
} from "../../../domain-model/src/index.ts";

import { selectSchedulableProjectTasks } from "../task/scheduling.ts";

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
 * Coordinator 状態を公開結果へ投影する。
 *
 * @responsibility Coordinator 状態の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState
 * @returns CoordinatorProjectionを返す。
 * @precondition 「state: CoordinatorState」がprojectCoordinatorStateの入力契約を満たす。
 * @postcondition projectCoordinatorStateの責務を完了した結果だけを返す。
 * @effect N/A: projectCoordinatorStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure projectCoordinatorStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant projectCoordinatorStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectCoordinatorStateはProcess内の同一Subsystemで完結する。
 * @security N/A: projectCoordinatorStateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: projectCoordinatorStateは共有非同期状態を持たない同期処理である。
 */
export function projectCoordinatorState(
  state: CoordinatorState,
): CoordinatorProjection {
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
  if (!isCoordinatorProjectionSemanticallyValid(projection))
    throw new Error("orchestrator_projection_semantics_invalid");
  return projection;
}

/**
 * 状態を公開結果へ投影する。
 *
 * @responsibility 状態の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input state: Omit<CoordinatorState, "contract">
 * @returns CoordinatorStateを返す。
 * @precondition 「state: Omit<CoordinatorState, "contract">」がprojectStateの入力契約を満たす。
 * @postcondition projectStateの責務を完了した結果だけを返す。
 * @effect N/A: projectStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 選定組が閉形式・役割相関を満たさない場合は例外で停止する。
 * @invariant projectStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectStateはProcess内の同一Subsystemで完結する。
 * @security N/A: projectStateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: projectStateは共有非同期状態を持たない同期処理である。
 */
export function projectState(
  state: Omit<CoordinatorState, "contract">,
): CoordinatorState {
  const selections = inspectTaskExecutionSelections(
    state.taskExecutionSelections,
  );
  if (!selections) throw new Error("coordinator_state_selection_invalid");
  return Object.freeze({
    contract: COORDINATOR_STATE_CONTRACT,
    ...state,
    taskExecutionSelections: selections,
    milestone: Object.freeze({ ...state.milestone }),
    objectives: Object.freeze([...state.objectives]),
    tasks: Object.freeze([...state.tasks]),
  });
}

import type { CoordinatorProjection } from "../../../domain-model/src/index.ts";
import {
  PROJECT_OBJECTIVE_STATES,
  PROJECT_TASK_STATES,
} from "../../../domain-model/src/index.ts";

import { isCoordinatorProjectionSemanticallyValid } from "../../../domain-model/src/index.ts";
