/**
 * Taskの回復義務・結果受領・Owner喪失の状態遷移を所有する。
 * @responsibility Taskの回復義務・結果受領・Owner喪失の状態遷移を所有する。
 * @trace ARCH-000004
 */

import {
  type ProjectTaskRecoveryKind,
  type CoordinatorState,
  type StateResult,
  isCoordinatorRecoveryIdentity,
  projectState,
  replaceTask,
  type ProjectResultAcceptance,
  decodeProjectResultAcceptance,
  validIdentity,
  type ProjectDockerRecoveryAcknowledgement,
} from "../state/model.ts";

/**
 * mark Project Task 回復 Obligation Recoveringを決定する。
 *
 * @responsibility mark Project Task 回復 Obligation Recoveringの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、taskId: string、kind: ProjectTaskRecoveryKind、recoveryId: string
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、taskId: string、kind: ProjectTaskRecoveryKind、recoveryId: string」がmarkProjectTaskRecoveryObligationRecoveringの入力契約を満たす。
 * @postcondition markProjectTaskRecoveryObligationRecoveringの責務を完了した結果だけを返す。
 * @effect N/A: markProjectTaskRecoveryObligationRecoveringは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: markProjectTaskRecoveryObligationRecoveringは独自の失敗分岐を所有しない。
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
 * Project Task 回復 Obligationを終端状態へ確定する。
 *
 * @responsibility Project Task 回復 Obligationの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、taskId: string、kind: ProjectTaskRecoveryKind、recoveryId: string
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、taskId: string、kind: ProjectTaskRecoveryKind、recoveryId: string」がsettleProjectTaskRecoveryObligationの入力契約を満たす。
 * @postcondition settleProjectTaskRecoveryObligationの責務を完了した結果だけを返す。
 * @effect N/A: settleProjectTaskRecoveryObligationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: settleProjectTaskRecoveryObligationは独自の失敗分岐を所有しない。
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
 * 清掃済み通常Taskの結果受領集合を同じ現在状態へ固定する。
 * @responsibility 通常終端と結果受領を回復義務から分離し、Attempt別の固定本文を所有する。
 * @trace ARCH-000004
 * @input state: 未保存の終端候補、expectedGeneration: 保存済み元世代、taskId: 対象Task、acceptances: 全結果の受領本文。
 * @returns 全件相関を確認した次候補、または元状態を保持した拒否。
 * @precondition 組立てOwnerは元Taskの全fresh結果を取得済みであり、通常終端候補は元世代の次世代である。
 * @postcondition 初回受領世代を固定し、通常Taskを回復待ちへ変更しない。
 * @effect N/A: 値導出だけ。耐久保存と下位ACKは呼出し側の責務。
 * @failure 未清掃・未終端・未解決義務・別Attempt・重複・本文変更を拒否する。
 * @invariant ACKからcleanup成立を補完せず、同じ集合の再入場で世代を書き換えない。
 * @boundary 通常Taskの状態モデルと上位耐久保存。
 * @security 受領本文からProviderや回復Authorityを発行しない。
 * @concurrency 次世代候補へ全件を固定し、終端とACKで保存世代を二度進めない。
 */
export function recordProjectTaskResultAcceptances(
  state: CoordinatorState,
  expectedGeneration: number,
  taskId: string,
  acceptances: readonly unknown[],
): StateResult {
  const rejected = Object.freeze({
    status: "blocked" as const,
    reason: "orchestrator_task_result_acceptance_mismatch",
    state,
    taskIds: Object.freeze([]),
  });
  const task = state.tasks.find((entry) => entry.definition.id === taskId);
  if (
    state.generation !== expectedGeneration + 1 ||
    !task ||
    !["completed", "failed", "cancelled"].includes(task.state) ||
    task.startPhase !== "settled" ||
    !task.cleanupConfirmed ||
    task.recoveryUnresolved ||
    task.recoveryObligations.some(
      (entry) =>
        entry.phase !== (entry.kind === "docker" ? "acknowledged" : "settled"),
    ) ||
    !Array.isArray(acceptances) ||
    acceptances.length > 128
  )
    return rejected;
  const decodedAcceptances = Array.from(
    acceptances,
    decodeProjectResultAcceptance,
  );
  if (
    decodedAcceptances.some(
      (entry) =>
        !entry ||
        !validIdentity(entry.repositoryBindingId) ||
        !isCoordinatorRecoveryIdentity(entry.recoveryId) ||
        entry.projectId !== state.projectId ||
        entry.milestoneId !== state.milestoneId ||
        entry.taskId !== taskId ||
        entry.attemptId !== task.attemptId ||
        entry.operationId !== task.operationId ||
        task.recoveryObligations.some(
          (obligation) => obligation.recoveryId === entry.recoveryId,
        ),
    ) ||
    new Set(decodedAcceptances.map((entry) => entry?.recoveryId)).size !==
      decodedAcceptances.length ||
    new Set(decodedAcceptances.map((entry) => entry?.repositoryBindingId))
      .size > 1 ||
    new Set(decodedAcceptances.map((entry) => entry?.repositoryBinding)).size >
      1
  )
    return rejected;
  const verifiedAcceptances =
    decodedAcceptances as readonly ProjectResultAcceptance[];
  if (task.resultAcceptances.length > 0) {
    if (
      task.resultAcceptances.length !== verifiedAcceptances.length ||
      task.resultAcceptances.some((stored) => {
        const incoming = verifiedAcceptances.find(
          (entry) => entry.recoveryId === stored.recoveryId,
        );
        return (
          !incoming ||
          (Object.keys(stored) as (keyof ProjectResultAcceptance)[]).some(
            (key) => stored[key] !== incoming[key],
          )
        );
      })
    )
      return rejected;
    return Object.freeze({
      status: "completed",
      reason: "orchestrator_task_results_already_accepted",
      state,
      taskIds: Object.freeze([taskId]),
    });
  }
  if (
    verifiedAcceptances.some(
      (entry) => entry.settlementGeneration !== state.generation,
    )
  )
    return rejected;
  if (verifiedAcceptances.length === 0)
    return Object.freeze({
      status: "completed",
      reason: "orchestrator_task_results_absent",
      state,
      taskIds: Object.freeze([taskId]),
    });
  const tasks = replaceTask(state, taskId, (current) =>
    Object.freeze({
      ...current,
      resultAcceptances: Object.freeze([...verifiedAcceptances]),
    }),
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_task_results_accepted",
    state: projectState({ ...state, tasks }),
    taskIds: Object.freeze([taskId]),
  });
}

/**
 * Project Docker 回復 Obligationを確認済みとして記録する。
 *
 * @responsibility Project Docker 回復 Obligationの確認入力、状態遷移、重複処理境界を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、acknowledgement: ProjectDockerRecoveryAcknowledgement
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、acknowledgement: ProjectDockerRecoveryAcknowledgement」がacknowledgeProjectDockerRecoveryObligationの入力契約を満たす。
 * @postcondition 受領本文は同時に保存する次の業務世代を参照し、保存前の世代と混同しない。
 * @effect N/A: acknowledgeProjectDockerRecoveryObligationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: acknowledgeProjectDockerRecoveryObligationは独自の失敗分岐を所有しない。
 * @invariant acknowledgeProjectDockerRecoveryObligationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: acknowledgeProjectDockerRecoveryObligationはProcess内の同一Subsystemで完結する。
 * @security N/A: acknowledgeProjectDockerRecoveryObligationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: acknowledgeProjectDockerRecoveryObligationは共有非同期状態を持たない同期処理である。
 */
export function acknowledgeProjectDockerRecoveryObligation(
  state: CoordinatorState,
  expectedGeneration: number,
  acknowledgement: ProjectDockerRecoveryAcknowledgement,
): StateResult {
  const acceptance = decodeProjectResultAcceptance(acknowledgement);
  if (!acceptance)
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_docker_recovery_acknowledgement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === acceptance.taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    acceptance.settlementGeneration !== expectedGeneration + 1 ||
    acceptance.projectId !== state.projectId ||
    acceptance.milestoneId !== state.milestoneId ||
    !validIdentity(acceptance.repositoryBindingId) ||
    !task ||
    task.state !== "recovery_required" ||
    task.attemptId !== acceptance.attemptId ||
    task.operationId !== acceptance.operationId ||
    !task.recoveryObligations.some(
      (entry) =>
        entry.kind === "docker" &&
        entry.recoveryId === acceptance.recoveryId &&
        entry.phase === "settled",
    ) ||
    !isCoordinatorRecoveryIdentity(acceptance.recoveryId)
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_docker_recovery_acknowledgement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const frozen = acceptance;
  const tasks = replaceTask(state, acceptance.taskId, (current) =>
    Object.freeze({
      ...current,
      recoveryObligations: Object.freeze(
        current.recoveryObligations.map((entry) =>
          entry.kind === "docker" && entry.recoveryId === acceptance.recoveryId
            ? Object.freeze({
                ...entry,
                phase: "acknowledged" as const,
                acknowledgement: frozen,
              })
            : entry,
        ),
      ),
    }),
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_docker_recovery_acknowledged",
    state: projectState({ ...state, generation: state.generation + 1, tasks }),
    taskIds: Object.freeze([acceptance.taskId]),
  });
}

/**
 * retry Settled Project Task Recoveriesを決定する。
 *
 * @responsibility retry Settled Project Task Recoveriesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、taskIds: readonly string[]
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、taskIds: readonly string[]」がretrySettledProjectTaskRecoveriesの入力契約を満たす。
 * @postcondition retrySettledProjectTaskRecoveriesの責務を完了した結果だけを返す。
 * @effect N/A: retrySettledProjectTaskRecoveriesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: retrySettledProjectTaskRecoveriesは独自の失敗分岐を所有しない。
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
 * Bind owner-loss observations to the exact Runtime-owned Task recoveries.
 *
 * @responsibility stateの入力からrecord Project Task 所有者 Loss Recoveriesを導く規則と結果境界を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、bindings: readonly Readonly<{ operationId: string; status: "matched" | "verified_absent"; recoveryId: string | null; }>[]
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、bindings: readonly Readonly<{ operationId: string; status: "matched" | "verified_absent"; recoveryId: string | null; }>[]」がrecordProjectTaskOwnerLossRecoveriesの入力契約を満たす。
 * @postcondition recordProjectTaskOwnerLossRecoveriesの責務を完了した結果だけを返す。
 * @effect N/A: recordProjectTaskOwnerLossRecoveriesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recordProjectTaskOwnerLossRecoveriesは独自の失敗分岐を所有しない。
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
