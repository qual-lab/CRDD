/**
 * Taskの予約・開始・終了・部分再計画・再試行を純粋な状態遷移として所有する。
 * @responsibility Taskの予約・開始・終了・部分再計画・再試行を純粋な状態遷移として所有する。
 * @trace ARCH-000004
 */

import {
  type ProjectTaskDefinition,
  snapshotDefinition,
  hasCycle,
  type CoordinatorState,
  type StateResult,
  validIdentity,
  projectState,
  replaceTask,
  type ProjectTaskState,
  type ProjectMilestoneState,
  type ProjectTaskRecoveryObligation,
  isCoordinatorRecoveryIdentity,
  type ProjectTaskRecoveryKind,
} from "../state/model.ts";
import { selectSchedulableProjectTasks } from "./scheduling.ts";

/**
 * 候補 Identityが有効か判定する。
 *
 * @responsibility 候補 Identityの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns validCandidateIdentityの計算結果を返す。
 * @precondition 「value: unknown」がvalidCandidateIdentityの入力契約を満たす。
 * @postcondition validCandidateIdentityの責務を完了した結果だけを返す。
 * @effect N/A: validCandidateIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validCandidateIdentityは独自の失敗分岐を所有しない。
 * @invariant validCandidateIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validCandidateIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: validCandidateIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validCandidateIdentityは共有非同期状態を持たない同期処理である。
 */
function validCandidateIdentity(value: unknown) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * reserve Project Task Startを決定する。
 *
 * @responsibility reserve Project Task Startの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、taskId: string、attemptId: string、authorityBindingId: string
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、taskId: string、attemptId: string、authorityBindingId: string」がreserveProjectTaskStartの入力契約を満たす。
 * @postcondition reserveProjectTaskStartの責務を完了した結果だけを返す。
 * @effect N/A: reserveProjectTaskStartは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: reserveProjectTaskStartは独自の失敗分岐を所有しない。
 * @invariant reserveProjectTaskStartは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reserveProjectTaskStartはProcess内の同一Subsystemで完結する。
 * @security reserveProjectTaskStartはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reserveProjectTaskStartは共有非同期状態を持たない同期処理である。
 */
export function reserveProjectTaskStart(
  state: CoordinatorState,
  expectedGeneration: number,
  taskId: string,
  attemptId: string,
  authorityBindingId: string,
): StateResult {
  if (
    state.generation !== expectedGeneration ||
    !validIdentity(taskId) ||
    !validIdentity(attemptId) ||
    !validIdentity(authorityBindingId)
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_generation_or_identity_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  if (!selectSchedulableProjectTasks(state).includes(taskId)) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_not_schedulable",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = replaceTask(state, taskId, (task) =>
    Object.freeze({
      ...task,
      state: "starting" as const,
      attemptId,
      authorityBindingId,
      operationId: null,
      startPhase: "reserved" as const,
      recoveryObligations: Object.freeze([]),
      resultAcceptances: Object.freeze([]),
      recoveryUnresolved: false,
    }),
  );
  const objectiveId = tasks.find((task) => task.definition.id === taskId)
    ?.definition.objectiveId;
  const objectives = state.objectives.map((objective) =>
    objective.definition.id === objectiveId && objective.state === "planned"
      ? Object.freeze({ ...objective, state: "executing" as const })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_task_start_reserved",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state:
          state.milestone.state === "planned"
            ? ("executing" as const)
            : state.milestone.state,
      }),
      objectives,
      tasks,
    }),
    taskIds: Object.freeze([taskId]),
  });
}

/**
 * Project Task Handoffを実行前候補として準備する。
 *
 * @responsibility Project Task Handoffの準備条件、候補Identity、Effect前の拒否境界を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、taskId: string、attemptId: string、operationId: string
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、taskId: string、attemptId: string、operationId: string」がprepareProjectTaskHandoffの入力契約を満たす。
 * @postcondition prepareProjectTaskHandoffの責務を完了した結果だけを返す。
 * @effect N/A: prepareProjectTaskHandoffは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: prepareProjectTaskHandoffは独自の失敗分岐を所有しない。
 * @invariant prepareProjectTaskHandoffは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: prepareProjectTaskHandoffはProcess内の同一Subsystemで完結する。
 * @security N/A: prepareProjectTaskHandoffはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: prepareProjectTaskHandoffは共有非同期状態を持たない同期処理である。
 */
export function prepareProjectTaskHandoff(
  state: CoordinatorState,
  expectedGeneration: number,
  taskId: string,
  attemptId: string,
  operationId: string,
): StateResult {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "starting" ||
    task.startPhase !== "reserved" ||
    task.attemptId !== attemptId ||
    !validIdentity(operationId)
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_handoff_preparation_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = replaceTask(state, taskId, (current) =>
    Object.freeze({
      ...current,
      operationId,
      startPhase: "handoff_prepared" as const,
    }),
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_task_handoff_prepared",
    state: projectState({ ...state, generation: state.generation + 1, tasks }),
    taskIds: Object.freeze([taskId]),
  });
}

/**
 * Project Task Startedを観測する。
 *
 * @responsibility Project Task Startedの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、taskId: string、attemptId: string、operationId: string
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、taskId: string、attemptId: string、operationId: string」がobserveProjectTaskStartedの入力契約を満たす。
 * @postcondition observeProjectTaskStartedの責務を完了した結果だけを返す。
 * @effect N/A: observeProjectTaskStartedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observeProjectTaskStartedは独自の失敗分岐を所有しない。
 * @invariant observeProjectTaskStartedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeProjectTaskStartedはProcess内の同一Subsystemで完結する。
 * @security N/A: observeProjectTaskStartedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: observeProjectTaskStartedは共有非同期状態を持たない同期処理である。
 */
export function observeProjectTaskStarted(
  state: CoordinatorState,
  expectedGeneration: number,
  taskId: string,
  attemptId: string,
  operationId: string,
): StateResult {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "starting" ||
    task.startPhase !== "handoff_prepared" ||
    task.attemptId !== attemptId ||
    task.operationId !== operationId
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_start_observation_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = replaceTask(state, taskId, (current) =>
    Object.freeze({
      ...current,
      state: "running" as const,
      startPhase: "running" as const,
    }),
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_task_started",
    state: projectState({ ...state, generation: state.generation + 1, tasks }),
    taskIds: Object.freeze([taskId]),
  });
}

/**
 * Project Taskを終端状態へ確定する。
 *
 * @responsibility Project Taskの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、input: Readonly<{ taskId: string; attemptId: string; operationId: string; authorityBindingId: string; outcome: "completed" | "failed" | "cancelled" | "recovery_required"; cleanupConfirmed: boolean; recoveryObligations: readonly ProjectTaskRecoveryObligation[]; recoveryUnresolved: boolean; candidateId?: string | null; }>
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、input: Readonly<{ taskId: string; attemptId: string; operationId: string; authorityBindingId: string; outcome: "completed" | "failed" | "cancelled" | "recovery_required"; cleanupConfirmed: boolean; recoveryObligations: readonly ProjectTaskRecoveryObligation[]; recoveryUnresolved: boolean; candidateId?: string | null; }>」がsettleProjectTaskの入力契約を満たす。
 * @postcondition settleProjectTaskの責務を完了した結果だけを返す。
 * @effect N/A: settleProjectTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: settleProjectTaskは独自の失敗分岐を所有しない。
 * @invariant settleProjectTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: settleProjectTaskはProcess内の同一Subsystemで完結する。
 * @security settleProjectTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settleProjectTaskは共有非同期状態を持たない同期処理である。
 */
export function settleProjectTask(
  state: CoordinatorState,
  expectedGeneration: number,
  input: Readonly<{
    taskId: string;
    attemptId: string;
    operationId: string;
    authorityBindingId: string;
    outcome: "completed" | "failed" | "cancelled" | "recovery_required";
    cleanupConfirmed: boolean;
    recoveryObligations: readonly ProjectTaskRecoveryObligation[];
    recoveryUnresolved: boolean;
    candidateId?: string | null;
  }>,
): StateResult {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === input.taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "running" ||
    task.startPhase !== "running" ||
    task.attemptId !== input.attemptId ||
    task.operationId !== input.operationId ||
    task.authorityBindingId !== input.authorityBindingId ||
    (input.outcome === "completed" && !input.cleanupConfirmed) ||
    (input.outcome === "cancelled" && !input.cleanupConfirmed) ||
    !Array.isArray(input.recoveryObligations) ||
    input.recoveryObligations.length > 128 ||
    new Set(
      input.recoveryObligations.map(
        (entry) => `${entry.kind}\0${entry.recoveryId}`,
      ),
    ).size !== input.recoveryObligations.length ||
    input.recoveryObligations.some(
      (entry) =>
        ![
          "host",
          "docker",
          "candidate",
          "candidate_store",
          "runtime_process",
        ].includes(entry.kind) ||
        !isCoordinatorRecoveryIdentity(entry.recoveryId) ||
        entry.phase !== "required",
    ) ||
    typeof input.recoveryUnresolved !== "boolean" ||
    (input.outcome === "recovery_required" &&
      input.recoveryObligations.length === 0 &&
      !input.recoveryUnresolved) ||
    (input.outcome !== "recovery_required" &&
      (input.recoveryObligations.length !== 0 || input.recoveryUnresolved)) ||
    (input.candidateId !== undefined &&
      input.candidateId !== null &&
      !validCandidateIdentity(input.candidateId)) ||
    (input.outcome !== "completed" &&
      input.candidateId !== undefined &&
      input.candidateId !== null)
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_settlement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const nextState: ProjectTaskState =
    input.outcome === "failed" && !input.cleanupConfirmed
      ? "cleanup_pending"
      : input.outcome;
  let tasks = replaceTask(state, input.taskId, (current) =>
    Object.freeze({
      ...current,
      state: nextState,
      startPhase: "settled" as const,
      cleanupConfirmed: input.cleanupConfirmed,
      recoveryObligations: Object.freeze(
        input.recoveryObligations.map((entry) => Object.freeze({ ...entry })),
      ),
      recoveryUnresolved: input.recoveryUnresolved,
      candidateId:
        input.outcome === "completed" ? (input.candidateId ?? null) : null,
    }),
  );
  const completed = new Set(
    tasks
      .filter((candidate) => candidate.state === "completed")
      .map((candidate) => candidate.definition.id),
  );
  tasks = tasks.map((candidate) =>
    candidate.state === "waiting_dependency" &&
    candidate.definition.dependencies.every((dependency) =>
      completed.has(dependency),
    )
      ? Object.freeze({ ...candidate, state: "ready" as const })
      : candidate,
  );
  const objectives = state.objectives.map((objective) => {
    if (objective.state === "accepted" || objective.state === "cancelled")
      return objective;
    const objectiveTasks = tasks.filter(
      (task) =>
        task.definition.objectiveId === objective.definition.id &&
        task.state !== "superseded",
    );
    if (objectiveTasks.every((task) => task.state === "completed")) {
      return Object.freeze({
        ...objective,
        state: "integration_pending" as const,
      });
    }
    if (objectiveTasks.some((task) => task.state === "cancelled")) {
      return Object.freeze({ ...objective, state: "cancelled" as const });
    }
    if (
      objectiveTasks.some((task) =>
        ["failed", "recovery_required"].includes(task.state),
      )
    ) {
      return Object.freeze({ ...objective, state: "blocked" as const });
    }
    return objective;
  });
  const milestoneState: ProjectMilestoneState = tasks.some(
    (task) => task.state === "recovery_required",
  )
    ? "recovery_required"
    : tasks.some((task) => task.state === "cancelled")
      ? "cancelled"
      : state.milestone.state;
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_task_settled",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({ ...state.milestone, state: milestoneState }),
      objectives,
      tasks,
    }),
    taskIds: Object.freeze([input.taskId]),
  });
}

/**
 * Settle a durably prepared attempt that the Single Task Runtime did not
 *
 * @responsibility Project Task Before Effectの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、input: Readonly<{ taskId: string; attemptId: string; operationId: string; authorityBindingId: string; outcome: "failed" | "cancelled" | "recovery_required"; cleanupConfirmed: boolean; recoveryObligations: readonly ProjectTaskRecoveryObligation[]; recoveryUnresolved: boolean; }>
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、input: Readonly<{ taskId: string; attemptId: string; operationId: string; authorityBindingId: string; outcome: "failed" | "cancelled" | "recovery_required"; cleanupConfirmed: boolean; recoveryObligations: readonly ProjectTaskRecoveryObligation[]; recoveryUnresolved: boolean; }>」がsettleProjectTaskBeforeEffectの入力契約を満たす。
 * @postcondition settleProjectTaskBeforeEffectの責務を完了した結果だけを返す。
 * @effect N/A: settleProjectTaskBeforeEffectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: settleProjectTaskBeforeEffectは独自の失敗分岐を所有しない。
 * @invariant settleProjectTaskBeforeEffectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: settleProjectTaskBeforeEffectはProcess内の同一Subsystemで完結する。
 * @security settleProjectTaskBeforeEffectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settleProjectTaskBeforeEffectは共有非同期状態を持たない同期処理である。
 */
export function settleProjectTaskBeforeEffect(
  state: CoordinatorState,
  expectedGeneration: number,
  input: Readonly<{
    taskId: string;
    attemptId: string;
    operationId: string;
    authorityBindingId: string;
    outcome: "failed" | "cancelled" | "recovery_required";
    cleanupConfirmed: boolean;
    recoveryObligations: readonly ProjectTaskRecoveryObligation[];
    recoveryUnresolved: boolean;
  }>,
): StateResult {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === input.taskId,
  );
  const obligationKinds = new Set<ProjectTaskRecoveryKind>([
    "host",
    "docker",
    "candidate",
    "candidate_store",
    "runtime_process",
  ]);
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "starting" ||
    task.startPhase !== "handoff_prepared" ||
    task.attemptId !== input.attemptId ||
    task.operationId !== input.operationId ||
    task.authorityBindingId !== input.authorityBindingId ||
    (!input.cleanupConfirmed && input.outcome !== "recovery_required") ||
    input.recoveryObligations.some(
      (entry) =>
        !obligationKinds.has(entry.kind) ||
        !isCoordinatorRecoveryIdentity(entry.recoveryId) ||
        entry.phase !== "required",
    ) ||
    (input.outcome === "recovery_required" &&
      input.recoveryObligations.length === 0 &&
      !input.recoveryUnresolved) ||
    (input.outcome !== "recovery_required" &&
      (input.recoveryObligations.length > 0 || input.recoveryUnresolved))
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_pre_effect_settlement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = replaceTask(state, input.taskId, (current) =>
    Object.freeze({
      ...current,
      state: input.outcome,
      startPhase: "settled" as const,
      cleanupConfirmed: input.cleanupConfirmed,
      recoveryObligations: Object.freeze(
        input.recoveryObligations.map((entry) => Object.freeze({ ...entry })),
      ),
      recoveryUnresolved: input.recoveryUnresolved,
      candidateId: null,
    }),
  );
  const objectives = state.objectives.map((objective) =>
    objective.definition.id === task.definition.objectiveId
      ? Object.freeze({
          ...objective,
          state:
            input.outcome === "cancelled"
              ? ("cancelled" as const)
              : ("blocked" as const),
        })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_pre_effect_task_settled",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state:
          input.outcome === "recovery_required"
            ? ("recovery_required" as const)
            : input.outcome === "cancelled"
              ? ("cancelled" as const)
              : state.milestone.state,
      }),
      objectives,
      tasks,
    }),
    taskIds: Object.freeze([input.taskId]),
  });
}

/**
 * Replace only a failed task inside the already-authorized milestone scope.
 *
 * @responsibility Coordinator Partial Replanの適用条件、変更結果、拒否境界を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、input: Readonly<{ failedTaskId: string; replacements: readonly ProjectTaskDefinition[]; maximumReplans: number; }>
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、input: Readonly<{ failedTaskId: string; replacements: readonly ProjectTaskDefinition[]; maximumReplans: number; }>」がapplyCoordinatorPartialReplanの入力契約を満たす。
 * @postcondition applyCoordinatorPartialReplanの責務を完了した結果だけを返す。
 * @effect N/A: applyCoordinatorPartialReplanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: applyCoordinatorPartialReplanは独自の失敗分岐を所有しない。
 * @invariant applyCoordinatorPartialReplanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: applyCoordinatorPartialReplanはProcess内の同一Subsystemで完結する。
 * @security N/A: applyCoordinatorPartialReplanはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: applyCoordinatorPartialReplanは共有非同期状態を持たない同期処理である。
 */
export function applyCoordinatorPartialReplan(
  state: CoordinatorState,
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
 * @responsibility stateの入力からretry Coordinator Taskを導く規則と結果境界を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、taskId: string、maximumReplans: number
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、taskId: string、maximumReplans: number」がretryCoordinatorTaskの入力契約を満たす。
 * @postcondition retryCoordinatorTaskの責務を完了した結果だけを返す。
 * @effect N/A: retryCoordinatorTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: retryCoordinatorTaskは独自の失敗分岐を所有しない。
 * @invariant retryCoordinatorTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: retryCoordinatorTaskはProcess内の同一Subsystemで完結する。
 * @security N/A: retryCoordinatorTaskはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: retryCoordinatorTaskは共有非同期状態を持たない同期処理である。
 */
export function retryCoordinatorTask(
  state: CoordinatorState,
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
