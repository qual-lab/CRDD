/**
 * Taskの回復義務・再試行・Owner喪失の純粋な状態遷移を所有する。
 * @responsibility Taskの回復義務・再試行・Owner喪失の純粋な状態遷移を所有する。
 * @trace ARCH-000004
 */

import type { ProjectTaskRecoveryKind } from "./types.ts";
import type { CoordinatorState, StateResult } from "../state/types.ts";
import {
  isCoordinatorRecoveryIdentity,
  validIdentity,
} from "../state/validation.ts";
import { projectState } from "../state/projection.ts";
import { replaceTask } from "./lifecycle.ts";

/**
 * 対象Taskの回復義務を、同じ回復参照で回復中へ進める。
 *
 * @responsibility 対象Task・世代・kind・回復参照を照合し、requiredからrecoveringへの純粋遷移を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、taskId: string、kind: ProjectTaskRecoveryKind、recoveryId: string
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、taskId: string、kind: ProjectTaskRecoveryKind、recoveryId: string」がmarkProjectTaskRecoveryObligationRecoveringの入力契約を満たす。
 * @postcondition markProjectTaskRecoveryObligationRecoveringの責務を完了した結果だけを返す。
 * @effect N/A: markProjectTaskRecoveryObligationRecoveringは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 世代、Task状態、未解決状態、対象kind／recoveryId又はrequired phaseが一致しない場合は、元状態を保持してblockedを返す。
 * @invariant markProjectTaskRecoveryObligationRecoveringは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: markProjectTaskRecoveryObligationRecoveringはProcess内の同一Subsystemで完結する。
 * @security N/A: markProjectTaskRecoveryObligationRecoveringはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: markProjectTaskRecoveryObligationRecoveringは共有非同期状態を持たない同期処理である。
 */
export function markProjectTaskRecoveryObligationRecovering(
  state: CoordinatorState,
  expectedGeneration: number,
  taskId: string,
  kind: ProjectTaskRecoveryKind,
  recoveryId: string,
): StateResult {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "recovery_required" ||
    task.recoveryUnresolved ||
    !task.recoveryObligations.some(
      (entry) =>
        entry.kind === kind &&
        entry.recoveryId === recoveryId &&
        entry.phase === "required",
    ) ||
    !isCoordinatorRecoveryIdentity(recoveryId)
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_recovery_start_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = replaceTask(state, taskId, (current) =>
    Object.freeze({
      ...current,
      recoveryObligations: Object.freeze(
        current.recoveryObligations.map((entry) =>
          entry.kind === kind && entry.recoveryId === recoveryId
            ? Object.freeze({ ...entry, phase: "recovering" as const })
            : entry,
        ),
      ),
    }),
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_task_recovery_started",
    state: projectState({ ...state, generation: state.generation + 1, tasks }),
    taskIds: Object.freeze([taskId]),
  });
}

/**
 * 対象Taskの回復義務を、同じ回復参照で処置済みへ進める。
 *
 * @responsibility Project Task 回復 Obligationの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、taskId: string、kind: ProjectTaskRecoveryKind、recoveryId: string
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、taskId: string、kind: ProjectTaskRecoveryKind、recoveryId: string」がsettleProjectTaskRecoveryObligationの入力契約を満たす。
 * @postcondition settleProjectTaskRecoveryObligationの責務を完了した結果だけを返す。
 * @effect N/A: settleProjectTaskRecoveryObligationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 世代、Task状態、未解決状態、対象kind／recoveryId又はrecovering phaseが一致しない場合は、元状態を保持してblockedを返す。
 * @invariant settleProjectTaskRecoveryObligationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: settleProjectTaskRecoveryObligationはProcess内の同一Subsystemで完結する。
 * @security N/A: settleProjectTaskRecoveryObligationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: settleProjectTaskRecoveryObligationは共有非同期状態を持たない同期処理である。
 */
export function settleProjectTaskRecoveryObligation(
  state: CoordinatorState,
  expectedGeneration: number,
  taskId: string,
  kind: ProjectTaskRecoveryKind,
  recoveryId: string,
): StateResult {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "recovery_required" ||
    task.recoveryUnresolved ||
    !task.recoveryObligations.some(
      (entry) =>
        entry.kind === kind &&
        entry.recoveryId === recoveryId &&
        entry.phase === "recovering",
    ) ||
    !isCoordinatorRecoveryIdentity(recoveryId)
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_recovery_settlement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = replaceTask(state, taskId, (current) =>
    Object.freeze({
      ...current,
      recoveryObligations: Object.freeze(
        current.recoveryObligations.map((entry) =>
          entry.kind === kind && entry.recoveryId === recoveryId
            ? Object.freeze({ ...entry, phase: "settled" as const })
            : entry,
        ),
      ),
    }),
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_task_recovery_item_settled",
    state: projectState({ ...state, generation: state.generation + 1, tasks }),
    taskIds: Object.freeze([taskId]),
  });
}

/**
 * 全回復義務の終端を確認したTaskだけを再試行可能にする。
 *
 * @responsibility Task集合と各義務の終端を照合し、履歴を保持したままreadyへ戻す純粋遷移を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、taskIds: readonly string[]
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、taskIds: readonly string[]」がretrySettledProjectTaskRecoveriesの入力契約を満たす。
 * @postcondition retrySettledProjectTaskRecoveriesの責務を完了した結果だけを返す。
 * @effect N/A: retrySettledProjectTaskRecoveriesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 世代、Task集合、Identity、義務の終端phase又は再試行可能状態が一致しない場合は、元状態を保持してblockedを返す。
 * @invariant retrySettledProjectTaskRecoveriesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: retrySettledProjectTaskRecoveriesはProcess内の同一Subsystemで完結する。
 * @security N/A: retrySettledProjectTaskRecoveriesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: retrySettledProjectTaskRecoveriesは共有非同期状態を持たない同期処理である。
 */
export function retrySettledProjectTaskRecoveries(
  state: CoordinatorState,
  expectedGeneration: number,
  taskIds: readonly string[],
): StateResult {
  if (
    state.generation !== expectedGeneration ||
    taskIds.length === 0 ||
    new Set(taskIds).size !== taskIds.length ||
    taskIds.some((taskId) => !validIdentity(taskId))
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_recovery_batch_invalid",
      state,
      taskIds: Object.freeze([]),
    });
  if (
    taskIds.some((taskId) => {
      const task = state.tasks.find(
        (candidate) => candidate.definition.id === taskId,
      );
      return (
        !task ||
        task.recoveryUnresolved ||
        task.recoveryObligations.length === 0 ||
        task.recoveryObligations.some(
          (entry) =>
            entry.phase !==
            (entry.kind === "docker" ? "acknowledged" : "settled"),
        ) ||
        (task.state !== "recovery_required" && task.state !== "ready")
      );
    })
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_recovery_batch_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = state.tasks.map((task) => {
    if (!taskIds.includes(task.definition.id) || task.state === "ready")
      return task;
    return Object.freeze({
      ...task,
      state: "ready" as const,
      attemptId: null,
      operationId: null,
      authorityBindingId: null,
      startPhase: "none" as const,
      cleanupConfirmed: true,
      candidateId: null,
      resultAcceptances: Object.freeze([]),
      retryCount: task.retryCount + 1,
    });
  });
  const recoveredObjectiveIds = new Set(
    tasks
      .filter((task) => taskIds.includes(task.definition.id))
      .map((task) => task.definition.objectiveId),
  );
  const objectives = state.objectives.map((objective) =>
    recoveredObjectiveIds.has(objective.definition.id)
      ? Object.freeze({ ...objective, state: "executing" as const })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_task_recoveries_settled_for_retry",
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
    taskIds: Object.freeze([...taskIds]),
  });
}

/**
 * Owner喪失時の観測を元Operationの回復参照又は不存在へ結合する。
 *
 * @responsibility 開始前の不存在と開始済みの回復義務を区別し、元Taskの相関を保持する純粋遷移を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、bindings: readonly Readonly<{ operationId: string; status: "matched" | "verified_absent"; recoveryId: string | null; }>[]
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、bindings: readonly Readonly<{ operationId: string; status: "matched" | "verified_absent"; recoveryId: string | null; }>[]」がrecordProjectTaskOwnerLossRecoveriesの入力契約を満たす。
 * @postcondition recordProjectTaskOwnerLossRecoveriesの責務を完了した結果だけを返す。
 * @effect N/A: recordProjectTaskOwnerLossRecoveriesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 世代、活動中Task集合、Operationとの件数・Identity・status・recoveryId相関が一致しない場合は、元状態を保持してblockedを返す。
 * @invariant recordProjectTaskOwnerLossRecoveriesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recordProjectTaskOwnerLossRecoveriesはProcess内の同一Subsystemで完結する。
 * @security N/A: recordProjectTaskOwnerLossRecoveriesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recordProjectTaskOwnerLossRecoveriesは共有非同期状態を持たない同期処理である。
 */
export function recordProjectTaskOwnerLossRecoveries(
  state: CoordinatorState,
  expectedGeneration: number,
  bindings: readonly Readonly<{
    operationId: string;
    status: "matched" | "verified_absent";
    recoveryId: string | null;
  }>[],
): StateResult {
  const activeItems = state.tasks.filter((task) =>
    ["starting", "running"].includes(task.state),
  );
  const preparedItems = activeItems.filter((task) => task.operationId !== null);
  const reservedItems = activeItems.filter((task) => task.operationId === null);
  if (
    state.generation !== expectedGeneration ||
    activeItems.length === 0 ||
    preparedItems.length + reservedItems.length !== activeItems.length ||
    bindings.length !== preparedItems.length ||
    new Set(bindings.map((entry) => entry.operationId)).size !==
      bindings.length ||
    bindings.some(
      (entry) =>
        !validIdentity(entry.operationId) ||
        !["matched", "verified_absent"].includes(entry.status) ||
        (entry.status === "matched" &&
          !isCoordinatorRecoveryIdentity(entry.recoveryId)) ||
        (entry.status === "verified_absent" && entry.recoveryId !== null),
    )
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_owner_loss_recovery_binding_invalid",
      state,
      taskIds: Object.freeze([]),
    });
  const byOperation = new Map(
    bindings.map((entry) => [entry.operationId, entry]),
  );
  if (
    preparedItems.some(
      (task) => task.operationId === null || !byOperation.has(task.operationId),
    ) ||
    preparedItems.some((task) => {
      const binding = task.operationId
        ? byOperation.get(task.operationId)
        : null;
      return task.state === "running" && binding?.status !== "matched";
    })
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_owner_loss_recovery_binding_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = state.tasks.map((task) => {
    const binding =
      task.operationId === null ? undefined : byOperation.get(task.operationId);
    if (reservedItems.includes(task) || binding?.status === "verified_absent")
      return Object.freeze({
        ...task,
        state: "ready" as const,
        attemptId: null,
        operationId: null,
        authorityBindingId: null,
        startPhase: "none" as const,
        cleanupConfirmed: true,
        recoveryObligations: Object.freeze([]),
        resultAcceptances: Object.freeze([]),
        recoveryUnresolved: false,
        candidateId: null,
      });
    return binding?.status === "matched" && binding.recoveryId
      ? Object.freeze({
          ...task,
          state: "recovery_required" as const,
          startPhase: "settled" as const,
          cleanupConfirmed: false,
          resultAcceptances: Object.freeze([]),
          recoveryObligations: Object.freeze([
            Object.freeze({
              kind: "docker" as const,
              recoveryId: binding.recoveryId,
              phase: "required" as const,
            }),
          ]),
          recoveryUnresolved: false,
          candidateId: null,
        })
      : task;
  });
  const objectives = state.objectives.map((objective) =>
    tasks.some(
      (task) =>
        task.definition.objectiveId === objective.definition.id &&
        task.state === "recovery_required",
    )
      ? Object.freeze({ ...objective, state: "blocked" as const })
      : reservedItems.some(
            (task) => task.definition.objectiveId === objective.definition.id,
          )
        ? Object.freeze({ ...objective, state: "executing" as const })
        : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_owner_loss_recoveries_bound",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: bindings.some((entry) => entry.status === "matched")
          ? ("recovery_required" as const)
          : ("executing" as const),
      }),
      objectives,
      tasks,
    }),
    taskIds: Object.freeze(activeItems.map((task) => task.definition.id)),
  });
}
