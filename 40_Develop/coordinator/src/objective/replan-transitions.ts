/**
 * 部分再計画とTask再試行の状態遷移を所有する。
 * @responsibility 部分再計画とTask再試行の状態遷移を所有する。
 * @trace ARCH-000004
 */

import {
  type ProjectTaskDefinition,
  type OrchestratorState,
  type StateResult,
  snapshotDefinition,
  hasCycle,
  projectState,
  replaceTask,
} from "../state/model.ts";

/**
 * Replace only a failed task inside the already-authorized milestone scope.
 *
 * @responsibility Orchestrator Partial Replanの適用条件、変更結果、拒否境界を所有する。
 * @trace ARCH-000004
 * @input state: OrchestratorState、expectedGeneration: number、input: Readonly<{ failedTaskId: string; replacements: readonly ProjectTaskDefinition[]; maximumReplans: number; }>
 * @returns StateResultを返す。
 * @precondition 「state: OrchestratorState、expectedGeneration: number、input: Readonly<{ failedTaskId: string; replacements: readonly ProjectTaskDefinition[]; maximumReplans: number; }>」がapplyOrchestratorPartialReplanの入力契約を満たす。
 * @postcondition applyOrchestratorPartialReplanの責務を完了した結果だけを返す。
 * @effect N/A: applyOrchestratorPartialReplanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: applyOrchestratorPartialReplanは独自の失敗分岐を所有しない。
 * @invariant applyOrchestratorPartialReplanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: applyOrchestratorPartialReplanはProcess内の同一Subsystemで完結する。
 * @security N/A: applyOrchestratorPartialReplanはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: applyOrchestratorPartialReplanは共有非同期状態を持たない同期処理である。
 */
export function applyOrchestratorPartialReplan(
  state: OrchestratorState,
  expectedGeneration: number,
  input: Readonly<{
    failedTaskId: string;
    replacements: readonly ProjectTaskDefinition[];
    maximumReplans: number;
  }>,
): StateResult {
  const failed = state.tasks.find(
    (task) => task.definition.id === input.failedTaskId,
  );
  const completedIds = new Set(
    state.tasks
      .filter((task) => task.state === "completed")
      .map((task) => task.definition.id),
  );
  const replacementDefinitions = input.replacements.map(snapshotDefinition);
  const existingIds = new Set(state.tasks.map((task) => task.definition.id));
  const replacementIds = new Set(
    replacementDefinitions
      .filter((value): value is ProjectTaskDefinition => value !== null)
      .map((definition) => definition.id),
  );
  const availableDependencies = new Set([...completedIds, ...replacementIds]);
  const hasLiveDependent = state.tasks.some(
    (task) =>
      task.definition.id !== input.failedTaskId &&
      !["completed", "cancelled", "failed", "superseded"].includes(
        task.state,
      ) &&
      task.definition.dependencies.includes(input.failedTaskId),
  );
  if (
    state.generation !== expectedGeneration ||
    !failed ||
    failed.state !== "failed" ||
    failed.supersededBy !== null ||
    !Number.isSafeInteger(input.maximumReplans) ||
    input.maximumReplans < 0 ||
    state.tasks.filter((task) => task.supersededBy !== null).length >=
      input.maximumReplans ||
    hasLiveDependent ||
    replacementDefinitions.length === 0 ||
    replacementDefinitions.some((definition) => definition === null) ||
    replacementIds.size !== replacementDefinitions.length ||
    [...replacementIds].some((id) => existingIds.has(id)) ||
    (replacementDefinitions as readonly ProjectTaskDefinition[]).some(
      (definition) =>
        definition.objectiveId !== failed.definition.objectiveId ||
        definition.dependencies.some(
          (dependency) => !availableDependencies.has(dependency),
        ),
    ) ||
    hasCycle([
      ...state.tasks
        .filter(
          (task) => task.state !== "failed" && task.state !== "superseded",
        )
        .map((task) => task.definition),
      ...(replacementDefinitions as readonly ProjectTaskDefinition[]),
    ])
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_replan_invalid_or_out_of_scope",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const replacements = (
    replacementDefinitions as readonly ProjectTaskDefinition[]
  ).map((definition) =>
    Object.freeze({
      definition,
      state: definition.dependencies.every((dependency) =>
        completedIds.has(dependency),
      )
        ? ("ready" as const)
        : ("waiting_dependency" as const),
      attemptId: null,
      operationId: null,
      authorityBindingId: null,
      startPhase: "none" as const,
      cleanupConfirmed: false,
      recoveryObligations: Object.freeze([]),
      resultAcceptances: Object.freeze([]),
      recoveryUnresolved: false,
      candidateId: null,
      retryCount: 0,
      supersededBy: null,
    }),
  );
  const replacementHead = replacements[0]?.definition.id ?? null;
  const tasks = [
    ...state.tasks.map((task) =>
      task.definition.id === failed.definition.id
        ? Object.freeze({
            ...task,
            state: "superseded" as const,
            resultAcceptances: Object.freeze([]),
            supersededBy: replacementHead,
          })
        : task,
    ),
    ...replacements,
  ];
  const objectives = state.objectives.map((objective) =>
    objective.definition.id === failed.definition.objectiveId
      ? Object.freeze({
          ...objective,
          state: "executing" as const,
          criterionEvidenceIds: Object.freeze([]),
        })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_partial_replan_applied",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: "executing" as const,
      }),
      objectives,
      tasks,
    }),
    taskIds: Object.freeze(replacements.map((task) => task.definition.id)),
  });
}

/**
 * Retry the same bounded task definition without reusing its prior attempt or
 *
 * @responsibility orchestrator-stateの入力からretry Orchestrator Taskを導く規則と結果境界を所有する。
 * @trace ARCH-000004
 * @input state: OrchestratorState、expectedGeneration: number、taskId: string、maximumReplans: number
 * @returns StateResultを返す。
 * @precondition 「state: OrchestratorState、expectedGeneration: number、taskId: string、maximumReplans: number」がretryOrchestratorTaskの入力契約を満たす。
 * @postcondition retryOrchestratorTaskの責務を完了した結果だけを返す。
 * @effect N/A: retryOrchestratorTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: retryOrchestratorTaskは独自の失敗分岐を所有しない。
 * @invariant retryOrchestratorTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: retryOrchestratorTaskはProcess内の同一Subsystemで完結する。
 * @security N/A: retryOrchestratorTaskはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: retryOrchestratorTaskは共有非同期状態を持たない同期処理である。
 */
export function retryOrchestratorTask(
  state: OrchestratorState,
  expectedGeneration: number,
  taskId: string,
  maximumReplans: number,
): StateResult {
  const failed = state.tasks.find((task) => task.definition.id === taskId);
  if (
    state.generation !== expectedGeneration ||
    !failed ||
    failed.state !== "failed" ||
    !Number.isSafeInteger(maximumReplans) ||
    maximumReplans < 0 ||
    failed.retryCount >= maximumReplans
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_retry_invalid_or_limit_exceeded",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = replaceTask(state, taskId, (task) =>
    Object.freeze({
      ...task,
      state: "ready" as const,
      attemptId: null,
      operationId: null,
      authorityBindingId: null,
      startPhase: "none" as const,
      cleanupConfirmed: false,
      recoveryObligations: Object.freeze([]),
      resultAcceptances: Object.freeze([]),
      recoveryUnresolved: false,
      candidateId: null,
      retryCount: task.retryCount + 1,
    }),
  );
  const objectives = state.objectives.map((objective) =>
    objective.definition.id === failed.definition.objectiveId
      ? Object.freeze({ ...objective, state: "executing" as const })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_plan_maintained_for_retry",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: "executing" as const,
      }),
      objectives,
      tasks,
    }),
    taskIds: Object.freeze([taskId]),
  });
}
