/**
 * Objectiveの進行をTask実行・回復・結果受領へ接続する。
 *
 * @responsibility 同じObjectiveの保存・実行・取消・回復を既存Ownerへ委譲し、進行と公開結果を確定する。
 * @trace ARCH-000004
 */

import { isDeepStrictEqual } from "node:util";
import { getAiModelCatalog } from "../../../ai-adapter/src/index.ts";
import {
  type CoordinatorState,
  inspectTaskExecutionSelections,
  type ProjectTaskRecoveryObligation,
  readCoordinatorTaskIntakeState,
  readRepositoryAiSelection,
  snapshotRuntimeStateArray as snapshotPlainArray,
  snapshotRuntimeStateRecord as snapshotPlainRecord,
  type TaskExecutionSelections,
} from "../../../domain-model/src/index.ts";
import { observePlatformFamily } from "../../../platform-access/src/index.ts";
import {
  inspectRepositoryIdentityCandidate,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import { runCoordinatorSingleTaskAttempt } from "../execution/controller.ts";
import {
  createCoordinatorWindowsPlatformAdapter,
  writeCoordinatorRecoveryDiagnostic,
} from "../execution/diagnostics.ts";
import { verifyRuntimePersistenceRepository } from "../execution/persistence.ts";
import {
  consumeDockerRecoveryReceiptAfterProjectSettlement,
  recoverRuntimeOwnedDockerTaskForCurrentConsumer,
  resolveRuntimeOwnedDockerTaskCurrentCorrelations,
} from "../execution/recovery.ts";
import { resolveTaskExecutionSelections } from "../selection/resolve.ts";
import { createCoordinatorState } from "../state/create.ts";
import type { CoordinatorClockIdentityPort } from "../state/persistence.ts";
import { projectCoordinatorState } from "../state/projection.ts";

import { maintainCoordinatorSnapshot } from "../state/retirement.ts";
import { createCoordinatorSnapshotPersistencePorts } from "../state/transaction.ts";
import { deriveCoordinatorRepositoryBindingId } from "../state/validation.ts";
import { acknowledgeProjectDockerRecoveryObligation } from "../task/acceptance.ts";
import {
  createCoordinatorExecutionHostPorts,
  createCoordinatorTaskRecoveryAdapter,
  runCoordinatorOperation,
} from "../task/dispatch.ts";
import { inspectCoordinatorSnapshotIntake } from "../task/queue.ts";
import {
  markProjectTaskRecoveryObligationRecovering,
  recordProjectTaskOwnerLossRecoveries,
  retrySettledProjectTaskRecoveries,
  settleProjectTaskRecoveryObligation,
} from "../task/recovery.ts";
import type {
  CoordinatorExecutionResult,
  CoordinatorTaskExecution,
} from "../task/types.ts";
import { workspacePlanReadyForAcceptance } from "../workspace/operations.ts";
import { inspectCoordinatorObjectivePlan } from "./plan.ts";

import type {
  CoordinatorObjectiveExecutionDependencies,
  CoordinatorObjectiveIntakeDependencies,
  PublicExecutionDependencies,
} from "./types.ts";

/**
 * 初回の選定要求又は保存値の継承と明示要求を照合する。
 * @responsibility 新しい選択希望を保存済みの別選定へ黙って畳まない。
 * @trace ARCH-000004
 * @input request: 検査済み要求、selections: 検査済み選定組、initial: 初回保存前。
 * @returns 今回明示された条件を満たす場合だけtrue。
 * @precondition 初回はcodec通過後、再受付は保存Reader通過後の組を使う。
 * @postcondition 省略は初回なら既定選定、再受付なら保存値の継承とする。
 * @effect N/A: 同期比較だけ。
 * @failure 明示値・選定元・分類不一致をfalseで拒否する。
 * @invariant 現在設定・Catalogを再読せず、保存値を再構成しない。
 * @boundary Objective受付とenqueue前の固定選定。
 * @security 真偽を実行Authorityにしない。
 * @concurrency 既存CASと実行Leaseは別に維持する。
 */
function objectiveSelectionsMatch(
  request: CoordinatorObjectiveRequest,
  selections: TaskExecutionSelections,
  initial: boolean,
): boolean {
  if (
    (initial || request.workType !== undefined) &&
    (selections.executor.workType !== (request.workType ?? null) ||
      selections.reviewer.workType !== (request.workType ?? null))
  )
    return false;
  if (!request.choice)
    return !initial || selections.executor.source !== "explicit";
  return (
    selections.executor.source === "explicit" &&
    selections.executor.provider === request.choice.provider &&
    selections.executor.modelIdentifier === request.choice.model &&
    selections.executor.reasoningEffort === request.choice.effort
  );
}

/**
 * recovery Application Idを決定する。
 *
 * @responsibility recovery Application Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input projectId: string、queueId: string、state: CoordinatorState、clockIdentity: CoordinatorClockIdentityPort
 * @returns recoveryApplicationIdの計算結果を返す。
 * @precondition 「projectId: string、queueId: string、state: CoordinatorState、clockIdentity: CoordinatorClockIdentityPort」がrecoveryApplicationIdの入力契約を満たす。
 * @postcondition recoveryApplicationIdの責務を完了した結果だけを返す。
 * @effect N/A: recoveryApplicationIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryApplicationIdは独自の失敗分岐を所有しない。
 * @invariant recoveryApplicationIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryApplicationIdはProcess内の同一Subsystemで完結する。
 * @security N/A: recoveryApplicationIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recoveryApplicationIdは共有非同期状態を持たない同期処理である。
 */
function recoveryApplicationId(
  projectId: string,
  queueId: string,
  state: CoordinatorState,
  clockIdentity: CoordinatorClockIdentityPort,
) {
  const recoveries = state.tasks
    .flatMap((task) =>
      task.recoveryObligations.map(
        (entry) => `${task.definition.id}:${entry.kind}:${entry.recoveryId}`,
      ),
    )
    .sort();
  return recoveries.length === 0
    ? null
    : clockIdentity.createStableId("project-recovery-application", [
        projectId,
        queueId,
        ...recoveries,
      ]);
}

/**
 * 回復の技術終端を種類別の固定条件へ照合する。
 *
 * @responsibility Dockerの耐久受領待ちとProcess回復の既存終端を区別する。
 * @trace ARCH-000008
 * @input value: 下位結果、kind: 保存済み義務種別、recoveryId: exact回復参照。
 * @returns 同じ義務の技術終端条件を満たす場合だけtrue。
 * @precondition 義務種別と回復参照は上位の検証済み状態から取得する。
 * @postcondition DockerのtrueをTask成功・操作除去へ強めない。
 * @effect N/A: exactRecoveryCompletedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure Docker結果の欠落・別ID・旧形式・不明・getter／Proxyはfalse。
 * @invariant 過去失敗や回復参照を成功・空値へ変更しない。
 * @boundary 下位の固定診断と上位settled遷移。
 * @security Dockerの全共同fieldを閉じた値として検証し、受領Authorityを発行しない。
 * @concurrency N/A: exactRecoveryCompletedは共有非同期状態を持たない同期処理である。
 */
function exactRecoveryCompleted(
  value: unknown,
  kind: string,
  recoveryId: string,
) {
  if (kind === "docker") {
    const record = snapshotPlainRecord(
      value,
      new Set([
        "contract",
        "status",
        "reason",
        "recoveryId",
        "dockerCleanupConfirmed",
        "hostCleanupConfirmed",
        "locksReleased",
        "historyConfirmed",
        "deliveryPending",
        "operationRetained",
        "operationRemovalConfirmed",
        "taskRecoveryCompleted",
        "cleanupReason",
      ]),
    );
    return (
      record?.contract === "crdd-coordinator/current-task-recovery" &&
      record.status === "awaiting_delivery" &&
      record.reason === "docker_task_recovery_durable_acceptance_pending" &&
      record.recoveryId === recoveryId &&
      record.dockerCleanupConfirmed === true &&
      record.hostCleanupConfirmed === true &&
      record.locksReleased === true &&
      record.historyConfirmed === true &&
      record.deliveryPending === true &&
      record.operationRetained === true &&
      record.operationRemovalConfirmed === false &&
      record.taskRecoveryCompleted === false &&
      record.cleanupReason === null
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Readonly<Record<string, unknown>>;
  return (
    record.status === "recovered" &&
    record.recoveryId === null &&
    record.manualRecoveryRequired !== true
  );
}

/**
 * 回復 Correlation Bindingsを観測する。
 *
 * @responsibility 回復 Correlation Bindingsの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、correlationIds: readonly string[]
 * @returns inspectRecoveryCorrelationBindingsの計算結果を返す。
 * @precondition 「value: unknown、correlationIds: readonly string[]」がinspectRecoveryCorrelationBindingsの入力契約を満たす。
 * @postcondition inspectRecoveryCorrelationBindingsの責務を完了した結果だけを返す。
 * @effect N/A: inspectRecoveryCorrelationBindingsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRecoveryCorrelationBindingsは独自の失敗分岐を所有しない。
 * @invariant inspectRecoveryCorrelationBindingsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRecoveryCorrelationBindingsはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectRecoveryCorrelationBindingsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectRecoveryCorrelationBindingsは共有非同期状態を持たない同期処理である。
 */
function inspectRecoveryCorrelationBindings(
  value: unknown,
  correlationIds: readonly string[],
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Readonly<Record<string, unknown>>;
  if (
    record.status !== "completed" ||
    !Array.isArray(record.bindings) ||
    !Array.isArray(record.absentCorrelationIds)
  )
    return null;
  const bindings: Array<{
    operationId: string;
    status: "matched" | "verified_absent";
    recoveryId: string | null;
  }> = [];
  for (const item of record.bindings) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const binding = item as Readonly<Record<string, unknown>>;
    if (
      typeof binding.correlationId !== "string" ||
      !correlationIds.includes(binding.correlationId) ||
      typeof binding.recoveryId !== "string" ||
      !validId(binding.correlationId)
    )
      return null;
    bindings.push({
      operationId: binding.correlationId,
      status: "matched",
      recoveryId: binding.recoveryId,
    });
  }
  for (const correlationId of record.absentCorrelationIds) {
    if (typeof correlationId !== "string" || !validId(correlationId))
      return null;
    bindings.push({
      operationId: correlationId,
      status: "verified_absent",
      recoveryId: null,
    });
  }
  return bindings.length === correlationIds.length &&
    bindings.every((entry) => correlationIds.includes(entry.operationId)) &&
    new Set(bindings.map((entry) => entry.operationId)).size === bindings.length
    ? Object.freeze(bindings.map((entry) => Object.freeze(entry)))
    : null;
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
function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * objective-applicationを停止結果として構築する。
 *
 * @responsibility objective-applicationの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input request: CoordinatorObjectiveRequest、reason: string、options: Readonly<{ queueId?: string | null; projection?: ReturnType<typeof projectCoordinatorState> | null; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; processRestartRequired?: boolean; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryObligation["kind"]; recoveryId: string; }>[]; effectState?: "no_effect" | "settled" | "unknown"; }>
 * @returns blockedの計算結果を返す。
 * @precondition 「request: CoordinatorObjectiveRequest、reason: string、options: Readonly<{ queueId?: string | null; projection?: ReturnType<typeof projectCoordinatorState> | null; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; processRestartRequired?: boolean; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryObligation["kind"]; recoveryId: string; }>[]; effectState?: "no_effect" | "settled" | "unknown"; }>」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security N/A: blockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(
  request: CoordinatorObjectiveRequest,
  reason: string,
  options: Readonly<{
    queueId?: string | null;
    projection?: ReturnType<typeof projectCoordinatorState> | null;
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    processRestartRequired?: boolean;
    recoveryIds?: readonly string[];
    recoveryObligations?: readonly Readonly<{
      kind: ProjectTaskRecoveryObligation["kind"];
      recoveryId: string;
    }>[];
    effectState?: "no_effect" | "settled" | "unknown";
  }> = {},
) {
  return createCoordinatorObjectiveResult(request, {
    status: "blocked",
    reason,
    ...options,
  });
}

/**
 * Coordinate one validated Objective through the Coordinator lifecycle.
 *
 * @responsibility Coordinator Objective Applicationの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: CoordinatorObjectiveExecutionDependencies、request: CoordinatorObjectiveRequest、cancellationSignal: AbortSignal
 * @returns executeCoordinatorObjectiveの計算結果を返す。
 * @precondition 「dependencies: CoordinatorObjectiveExecutionDependencies、request: CoordinatorObjectiveRequest、cancellationSignal: AbortSignal」がexecuteCoordinatorObjectiveの入力契約を満たす。
 * @postcondition executeCoordinatorObjectiveの責務を完了した結果だけを返す。
 * @effect N/A: executeCoordinatorObjectiveは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure executeCoordinatorObjectiveは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executeCoordinatorObjectiveは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executeCoordinatorObjectiveはProcess内の同一Subsystemで完結する。
 * @security N/A: executeCoordinatorObjectiveはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency executeCoordinatorObjectiveは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function executeCoordinatorObjective(
  dependencies: CoordinatorObjectiveExecutionDependencies,
  request: CoordinatorObjectiveRequest,
  cancellationSignal: AbortSignal,
) {
  if (request.adoptResult)
    return blocked(
      request,
      "orchestrator_explicit_workspace_adoption_required",
    );
  if (
    !(cancellationSignal instanceof AbortSignal) ||
    !validId(dependencies.authenticatedPrincipalId)
  )
    return blocked(request, "orchestrator_objective_request_invalid");
  const plan = dependencies.plan;
  const queueId = dependencies.clockIdentity.createStableId("queue", [
    dependencies.repositoryBindingId,
    request.projectId,
    request.milestoneId,
    request.requestId,
    dependencies.authenticatedPrincipalId,
  ]);
  const requestHash = dependencies.clockIdentity.createContentHash(
    JSON.stringify({
      ...request,
      plan,
      authenticatedPrincipalId: dependencies.authenticatedPrincipalId,
      acceptanceCriteria: [...request.acceptanceCriteria],
      allowedPaths: [...request.allowedPaths],
      readPaths: [...request.readPaths],
    }),
  );
  const scopeHash = dependencies.clockIdentity.createContentHash(
    JSON.stringify({
      allowedPaths: request.allowedPaths,
      readPaths: request.readPaths,
    }),
  );

  const persistence = dependencies.persistence;
  const taskRecovery = dependencies.taskRecovery;
  const acquisitionOwner = persistence.lease.inspectAcquisitionOwner();
  if (acquisitionOwner.status !== "completed")
    return blocked(request, acquisitionOwner.reason, {
      cleanupConfirmed: false,
      manualRecoveryRequired: acquisitionOwner.manualRecoveryRequired,
      recoveryIds:
        acquisitionOwner.recoveryId === null
          ? Object.freeze([])
          : Object.freeze([acquisitionOwner.recoveryId]),
      effectState: acquisitionOwner.manualRecoveryRequired
        ? "unknown"
        : "no_effect",
    });
  const resolvedAcquisition = acquisitionOwner.value.acquisition;
  if (
    resolvedAcquisition !== null &&
    resolvedAcquisition.projectId !== request.projectId
  )
    return blocked(
      request,
      "orchestrator_lease_acquisition_project_identity_mismatch",
      {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        recoveryIds: Object.freeze([resolvedAcquisition.recoveryId]),
        effectState: "unknown",
      },
    );
  const observedState = persistence.state.readState(request.projectId);
  let state = observedState;
  if (state.status !== "completed")
    return blocked(request, state.reason, {
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  if (state.value === null) {
    let selected: ReturnType<
      CoordinatorObjectiveExecutionDependencies["resolveTaskSelections"]
    >;
    try {
      selected = dependencies.resolveTaskSelections(request);
    } catch {
      return blocked(request, "ai_selection_observation_failed");
    }
    if (selected.status !== "resolved")
      return blocked(request, selected.reason);
    const created = createCoordinatorState({
      taskExecutionSelections: selected.value,
      projectId: request.projectId,
      milestoneId: request.milestoneId,
      repositoryRevision: request.repositoryRevision,
      maximumConcurrency: request.maximumConcurrency,
      milestoneAcceptanceCriteria: plan.milestoneAcceptanceCriteria,
      objectives: plan.objectives,
      tasks: plan.tasks,
      ownerGeneration: dependencies.processSafety.getProcessInstanceIdentity(),
    });
    if (created.status !== "completed") return blocked(request, created.reason);
    if (
      !objectiveSelectionsMatch(
        request,
        created.state.taskExecutionSelections,
        true,
      )
    )
      return blocked(request, "coordinator_objective_selection_mismatch");
    const written = persistence.state.writeState(created.state, 0);
    if (written.status !== "completed")
      return blocked(request, written.reason, {
        cleanupConfirmed: false,
        manualRecoveryRequired: written.manualRecoveryRequired,
        effectState: "unknown",
      });
    state = Object.freeze({
      status: "completed" as const,
      reason: written.reason,
      value: written.value,
    });
  } else if (
    state.value.milestoneId !== request.milestoneId ||
    state.value.repositoryRevision !== request.repositoryRevision
  ) {
    return blocked(request, "orchestrator_existing_state_identity_mismatch");
  }
  if (
    state.value &&
    !objectiveSelectionsMatch(
      request,
      state.value.taskExecutionSelections,
      false,
    )
  )
    return blocked(request, "coordinator_objective_selection_mismatch");
  const queued = persistence.state.enqueueOperation({
    queueId,
    ...(request.workspaceId === undefined
      ? {}
      : { workspaceId: request.workspaceId }),
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    requestHash,
    originLane: request.originLane,
    repositoryRevision: request.repositoryRevision,
    scopeHash,
  });
  if (queued.status !== "completed")
    return blocked(request, queued.reason, {
      cleanupConfirmed: false,
      manualRecoveryRequired: queued.manualRecoveryRequired,
      effectState: queued.manualRecoveryRequired ? "unknown" : "no_effect",
    });
  let queue = queued.value;
  const recoveryQueueId =
    resolvedAcquisition?.queueId ??
    (queue.ownerGeneration === null ? null : queueId);
  if (recoveryQueueId !== null) {
    const reconciled = persistence.lease.reconcileOperationOwnerLoss(
      request.projectId,
      recoveryQueueId,
      dependencies.observeLeaseOwner,
    );
    if (
      reconciled.status !== "completed" &&
      reconciled.reason === "orchestrator_lease_owner_still_active" &&
      recoveryQueueId === queueId &&
      state.value
    )
      return createCoordinatorObjectiveResult(request, {
        status: "blocked",
        reason: "orchestrator_objective_already_running",
        queueId,
        projection: projectCoordinatorState(state.value),
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        processRestartRequired: false,
        recoveryIds: Object.freeze([]),
        recoveryObligations: Object.freeze([]),
        effectState: "no_effect" as const,
      });
    if (
      reconciled.status !== "completed" &&
      reconciled.reason !== "orchestrator_lease_owner_still_active"
    )
      return blocked(request, reconciled.reason, {
        cleanupConfirmed: !reconciled.manualRecoveryRequired,
        manualRecoveryRequired: reconciled.manualRecoveryRequired,
        recoveryIds:
          reconciled.recoveryId === null
            ? Object.freeze([])
            : Object.freeze([reconciled.recoveryId]),
        effectState: reconciled.manualRecoveryRequired
          ? "unknown"
          : "no_effect",
      });
    const reread = persistence.state.readQueue(queueId);
    if (reread.status !== "completed")
      return blocked(request, reread.reason, {
        cleanupConfirmed: false,
        manualRecoveryRequired: reread.manualRecoveryRequired,
        effectState: "unknown",
      });
    queue = reread.value;
  }
  if (
    queue.state === "recovery_required" &&
    queue.resumeCondition === "owner_loss" &&
    state.value
  ) {
    const activeTasks = state.value.tasks.filter((task) =>
      ["starting", "running"].includes(task.state),
    );
    const operationIds = activeTasks
      .map((task) => task.operationId)
      .filter((value): value is string => value !== null);
    let applicationId = recoveryApplicationId(
      request.projectId,
      queueId,
      state.value,
      dependencies.clockIdentity,
    );
    if (applicationId === null && activeTasks.length > 0) {
      let bindings: ReturnType<typeof inspectRecoveryCorrelationBindings> =
        Object.freeze([]);
      if (operationIds.length > 0) {
        let rawBindings: unknown;
        try {
          rawBindings = taskRecovery.resolveCorrelations(operationIds);
        } catch {
          rawBindings = null;
        }
        bindings = inspectRecoveryCorrelationBindings(
          rawBindings,
          operationIds,
        );
      }
      if (!bindings)
        return blocked(request, "orchestrator_owner_loss_recovery_unresolved", {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      const bound = recordProjectTaskOwnerLossRecoveries(
        state.value,
        state.value.generation,
        bindings,
      );
      if (bound.status !== "completed" || !bound.state)
        return blocked(request, bound.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      const boundWrite = persistence.state.writeState(
        bound.state,
        state.value.generation,
      );
      if (boundWrite.status !== "completed")
        return blocked(request, boundWrite.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      state = Object.freeze({
        status: "completed" as const,
        reason: boundWrite.reason,
        value: boundWrite.value,
      });
      for (const task of boundWrite.value.tasks) {
        for (const obligation of task.recoveryObligations) {
          await taskRecovery.observeTransition({
            phase: "required",
            projectId: request.projectId,
            milestoneId: request.milestoneId,
            queueId,
            taskId: task.definition.id,
            operationId: task.operationId,
            recoveryId: obligation.recoveryId,
            stateGeneration: boundWrite.value.generation,
          });
        }
      }
      applicationId = recoveryApplicationId(
        request.projectId,
        queueId,
        boundWrite.value,
        dependencies.clockIdentity,
      );
    }
    if (!applicationId) {
      const remainingActiveTasks = (state.value?.tasks ?? []).filter((task) =>
        ["starting", "running"].includes(task.state),
      );
      if (remainingActiveTasks.length > 0)
        return blocked(request, "orchestrator_owner_loss_recovery_unresolved", {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      const reopenedQueue = persistence.state.updateQueue(
        queueId,
        queue.generation,
        {
          state: "queued",
          lease: null,
          resumeCondition: null,
          resultReference: null,
        },
      );
      if (reopenedQueue.status !== "completed")
        return blocked(request, reopenedQueue.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      queue = reopenedQueue.value;
    } else {
      const reboundQueue = persistence.state.updateQueue(
        queueId,
        queue.generation,
        {
          state: "recovery_required",
          lease: null,
          resumeCondition: "exact_recovery",
          resultReference: applicationId,
        },
      );
      if (reboundQueue.status !== "completed")
        return blocked(request, reboundQueue.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      queue = reboundQueue.value;
    }
  }
  if (
    (queue.state === "recovery_required" ||
      (queue.state === "queued" &&
        queue.resumeCondition === "exact_recovery_settled")) &&
    state.value
  ) {
    let recoveryState = state.value;
    const recoveryApplication = recoveryApplicationId(
      request.projectId,
      queueId,
      recoveryState,
      dependencies.clockIdentity,
    );
    const unresolvedTasks = recoveryState.tasks.filter(
      (task) => task.state === "recovery_required" && task.recoveryUnresolved,
    );
    const recoveries = recoveryState.tasks.flatMap((task) =>
      task.recoveryObligations.map((entry) =>
        Object.freeze({ taskId: task.definition.id, ...entry }),
      ),
    );
    const publicRecoveryObligations = recoveries.map(({ kind, recoveryId }) =>
      Object.freeze({ kind, recoveryId }),
    );
    const recoveryProcess =
      dependencies.processSafety.getProcessInstanceIdentity();
    const recoveryQueue = queue;
    /**
     * 待機・診断後の同じ上位状態と取消を読戻す。
     * @responsibility 旧値からsettled保存・ACKへ無条件に進めない。
     * @trace ARCH-000008
     * @input N/A: 同じQueue・現在状態・取消とProcess相関を閉包で使う。
     * @returns 同じ業務内容のfresh状態、又は取消・不一致時null。
     * @precondition Queueは回復対象であり新しいLease Ownerを発行しない。
     * @postcondition 同一Process相関を生存・非poison保証へ強めない。
     * @effect 既存状態・Queueの読取りだけ。
     * @failure 取消・差・観測不能はnull。
     * @invariant 新しいLock・Owner・回復状態を生成しない。
     * @boundary 回復の非同期待機と上位保存。
     * @security 書込み競合の最終判定は既存期待世代付き保存が所有する。
     * @concurrency 各後段処置前にfresh読取りし、耐久済み段階を巻き戻さない。
     */
    const readCurrentRecoveryState = (
      technicalProgress?: Readonly<{ taskId: string; recoveryId: string }>,
    ) => {
      try {
        if (
          cancellationSignal.aborted ||
          dependencies.processSafety.getProcessInstanceIdentity() !==
            recoveryProcess
        )
          return null;
        const currentState = persistence.state.readState(request.projectId);
        const currentQueue = persistence.state.readQueue(queueId);
        if (
          currentState.status !== "completed" ||
          currentState.value === null ||
          currentQueue.status !== "completed" ||
          !isDeepStrictEqual(currentQueue.value, recoveryQueue)
        )
          return null;
        let comparable = currentState.value;
        if (technicalProgress) {
          const before = recoveryState.tasks.find(
            (task) => task.definition.id === technicalProgress.taskId,
          );
          const after = comparable.tasks.find(
            (task) => task.definition.id === technicalProgress.taskId,
          );
          const prior = before?.recoveryObligations.find(
            (item) =>
              item.kind === "docker" &&
              item.recoveryId === technicalProgress.recoveryId,
          );
          const next = after?.recoveryObligations.find(
            (item) =>
              item.kind === "docker" &&
              item.recoveryId === technicalProgress.recoveryId,
          );
          if (
            !before ||
            !after ||
            !prior ||
            !next ||
            prior.acknowledgement !== undefined ||
            next.acknowledgement !== undefined ||
            !["required", "settled"].includes(prior.phase) ||
            !(
              next.phase === prior.phase ||
              (prior.phase === "required" && next.phase === "settled")
            ) ||
            (before.cleanupConfirmed && !after.cleanupConfirmed)
          )
            return null;
          comparable = {
            ...comparable,
            tasks: comparable.tasks.map((task) =>
              task === after
                ? {
                    ...task,
                    cleanupConfirmed: before.cleanupConfirmed,
                    recoveryObligations: task.recoveryObligations.map((item) =>
                      item === next ? { ...item, phase: prior.phase } : item,
                    ),
                  }
                : task,
            ),
          };
        }
        return isDeepStrictEqual(comparable, recoveryState)
          ? currentState.value
          : null;
      } catch {
        return null;
      }
    };
    if (unresolvedTasks.length > 0)
      return blocked(request, "orchestrator_recovery_result_unresolved", {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
        recoveryIds: recoveries.map((entry) => entry.recoveryId),
        recoveryObligations: publicRecoveryObligations,
      });
    if (!recoveryApplication || queue.resultReference !== recoveryApplication)
      return blocked(request, "orchestrator_recovery_identity_mismatch", {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
        recoveryIds: recoveries.map((entry) => entry.recoveryId),
        recoveryObligations: publicRecoveryObligations,
      });
    if (queue.state === "recovery_required") {
      for (const item of recoveries.filter(
        (entry) =>
          ["docker", "runtime_process"].includes(entry.kind) &&
          entry.phase !== "settled" &&
          entry.phase !== "acknowledged",
      )) {
        if (item.phase === "required" && item.kind !== "docker") {
          const recovering = markProjectTaskRecoveryObligationRecovering(
            recoveryState,
            recoveryState.generation,
            item.taskId,
            item.kind,
            item.recoveryId,
          );
          if (recovering.status !== "completed" || !recovering.state)
            return blocked(request, recovering.reason, {
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              effectState: "unknown",
              recoveryIds: [item.recoveryId],
              recoveryObligations: [
                Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
              ],
            });
          const recoveringWrite = persistence.state.writeState(
            recovering.state,
            recoveryState.generation,
          );
          if (recoveringWrite.status !== "completed")
            return blocked(request, recoveringWrite.reason, {
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              effectState: "unknown",
              recoveryIds: [item.recoveryId],
              recoveryObligations: [
                Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
              ],
            });
          state = Object.freeze({
            status: "completed" as const,
            reason: recoveringWrite.reason,
            value: recoveringWrite.value,
          });
          recoveryState = recoveringWrite.value;
          await taskRecovery.observeTransition({
            phase: "recovering",
            projectId: request.projectId,
            milestoneId: request.milestoneId,
            queueId,
            taskId: item.taskId,
            operationId:
              recoveryState.tasks.find(
                (entry) => entry.definition.id === item.taskId,
              )?.operationId ?? null,
            recoveryId: item.recoveryId,
            stateGeneration: recoveryState.generation,
          });
        }
        let recovery: unknown;
        if (item.kind === "runtime_process") {
          const task = recoveryState.tasks.find(
            (entry) => entry.definition.id === item.taskId,
          );
          const match =
            task?.attemptId && task.operationId
              ? dependencies.processSafety.inspectRecoveryIdentity(
                  item.recoveryId,
                  task.attemptId,
                  task.operationId,
                )
              : null;
          recovery =
            match &&
            match.processIdentity !==
              dependencies.processSafety.getProcessInstanceIdentity()
              ? Object.freeze({
                  status: "recovered" as const,
                  recoveryId: null,
                  manualRecoveryRequired: false,
                })
              : null;
        } else {
          try {
            await taskRecovery.observeTransition({
              phase: "recovering",
              projectId: request.projectId,
              milestoneId: request.milestoneId,
              queueId,
              taskId: item.taskId,
              operationId:
                recoveryState.tasks.find(
                  (task) => task.definition.id === item.taskId,
                )?.operationId ?? null,
              recoveryId: item.recoveryId,
              stateGeneration: recoveryState.generation,
            });
            recovery = readCurrentRecoveryState()
              ? await taskRecovery.recover(item.recoveryId, cancellationSignal)
              : null;
            const fresh = readCurrentRecoveryState(item);
            if (!fresh) recovery = null;
            else recoveryState = fresh;
          } catch {
            recovery = null;
          }
        }
        if (!exactRecoveryCompleted(recovery, item.kind, item.recoveryId))
          return blocked(request, "orchestrator_task_recovery_not_settled", {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
            recoveryIds: [item.recoveryId],
            recoveryObligations: [
              Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
            ],
          });
        if (item.kind === "docker") {
          const settled = recoveryState.tasks.find(
            (task) => task.definition.id === item.taskId,
          );
          if (
            !settled?.recoveryObligations.some(
              (entry) =>
                entry.kind === "docker" &&
                entry.recoveryId === item.recoveryId &&
                entry.phase === "settled",
            )
          )
            return blocked(request, "orchestrator_task_recovery_not_settled", {
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              effectState: "unknown",
              recoveryIds: [item.recoveryId],
              recoveryObligations: [
                Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
              ],
            });
          state = Object.freeze({
            status: "completed" as const,
            reason: "coordinator_technical_recovery_observed",
            value: recoveryState,
          });
          await taskRecovery.observeTransition({
            phase: "settled",
            projectId: request.projectId,
            milestoneId: request.milestoneId,
            queueId,
            taskId: item.taskId,
            operationId: settled.operationId,
            recoveryId: item.recoveryId,
            stateGeneration: recoveryState.generation,
          });
          continue;
        }
        const settledItem = settleProjectTaskRecoveryObligation(
          recoveryState,
          recoveryState.generation,
          item.taskId,
          item.kind,
          item.recoveryId,
        );
        if (settledItem.status !== "completed" || !settledItem.state)
          return blocked(request, settledItem.reason, {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
            recoveryIds: [item.recoveryId],
            recoveryObligations: [
              Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
            ],
          });
        const settledWrite = persistence.state.writeState(
          settledItem.state,
          recoveryState.generation,
        );
        if (settledWrite.status !== "completed")
          return blocked(request, settledWrite.reason, {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
            recoveryIds: [item.recoveryId],
            recoveryObligations: [
              Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
            ],
          });
        state = Object.freeze({
          status: "completed" as const,
          reason: settledWrite.reason,
          value: settledWrite.value,
        });
        recoveryState = settledWrite.value;
        await taskRecovery.observeTransition({
          phase: "settled",
          projectId: request.projectId,
          milestoneId: request.milestoneId,
          queueId,
          taskId: item.taskId,
          operationId:
            recoveryState.tasks.find(
              (entry) => entry.definition.id === item.taskId,
            )?.operationId ?? null,
          recoveryId: item.recoveryId,
          stateGeneration: recoveryState.generation,
        });
      }
    }
    for (const item of recoveries.filter((entry) => entry.kind === "docker")) {
      const settledTask = recoveryState.tasks.find(
        (entry) => entry.definition.id === item.taskId,
      );
      if (
        !settledTask?.attemptId ||
        !settledTask.operationId ||
        !settledTask.recoveryObligations.some(
          (entry) =>
            entry.kind === "docker" &&
            entry.recoveryId === item.recoveryId &&
            ["settled", "acknowledged"].includes(entry.phase),
        )
      )
        return blocked(
          request,
          "orchestrator_task_recovery_acknowledgement_not_settled",
          {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
            recoveryIds: [item.recoveryId],
            recoveryObligations: [
              Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
            ],
          },
        );
      let currentObligation = settledTask.recoveryObligations.find(
        (entry) =>
          entry.kind === "docker" && entry.recoveryId === item.recoveryId,
      );
      if (currentObligation?.phase === "settled") {
        let acknowledgementResult: unknown;
        try {
          if (!readCurrentRecoveryState())
            throw new Error("orchestrator_recovery_boundary_changed");
          acknowledgementResult = taskRecovery.acknowledgeDocker(
            Object.freeze({
              projectId: request.projectId,
              milestoneId: request.milestoneId,
              stateGeneration: recoveryState.generation,
              taskId: item.taskId,
              attemptId: settledTask.attemptId,
              operationId: settledTask.operationId,
              kind: "docker" as const,
              recoveryId: item.recoveryId,
            }),
          );
        } catch {
          acknowledgementResult = null;
        }
        const acknowledged = snapshotPlainRecord(
          acknowledgementResult,
          new Set(["status", "reason", "acknowledgement"]),
        );
        const evidence = snapshotPlainRecord(
          acknowledged?.acknowledgement,
          new Set([
            "repositoryBinding",
            "operationId",
            "recoveryId",
            "resultId",
            "consumer",
          ]),
        );
        if (
          acknowledged?.status !== "completed" ||
          typeof acknowledged.reason !== "string" ||
          !evidence ||
          evidence.operationId !== settledTask.operationId ||
          evidence.recoveryId !== item.recoveryId ||
          evidence.consumer !== "orchestrator" ||
          typeof evidence.repositoryBinding !== "string" ||
          !/^[a-f0-9]{64}$/u.test(evidence.repositoryBinding) ||
          typeof evidence.resultId !== "string" ||
          !/^[a-f0-9]{64}$/u.test(evidence.resultId)
        )
          return blocked(
            request,
            "orchestrator_task_recovery_acknowledgement_not_settled",
            {
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              effectState: "unknown",
              recoveryIds: [item.recoveryId],
              recoveryObligations: [
                Object.freeze({
                  kind: item.kind,
                  recoveryId: item.recoveryId,
                }),
              ],
            },
          );
        const durableAcknowledgement = Object.freeze({
          repositoryBindingId: dependencies.repositoryBindingId,
          projectId: request.projectId,
          milestoneId: request.milestoneId,
          taskId: item.taskId,
          attemptId: settledTask.attemptId,
          operationId: settledTask.operationId,
          recoveryId: item.recoveryId,
          settlementGeneration: recoveryState.generation + 1,
          repositoryBinding: evidence.repositoryBinding,
          resultId: evidence.resultId,
          consumer: "orchestrator" as const,
        });
        const marked = acknowledgeProjectDockerRecoveryObligation(
          recoveryState,
          recoveryState.generation,
          durableAcknowledgement,
        );
        if (marked.status !== "completed" || !marked.state)
          return blocked(request, marked.reason, {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
          });
        const markedWrite = persistence.state.writeState(
          marked.state,
          recoveryState.generation,
        );
        if (markedWrite.status !== "completed")
          return blocked(request, markedWrite.reason, {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
          });
        recoveryState = markedWrite.value;
        state = Object.freeze({
          status: "completed" as const,
          reason: markedWrite.reason,
          value: markedWrite.value,
        });
        await taskRecovery.observeTransition({
          phase: "acknowledged",
          projectId: request.projectId,
          milestoneId: request.milestoneId,
          queueId,
          taskId: item.taskId,
          operationId: settledTask.operationId,
          recoveryId: item.recoveryId,
          stateGeneration: recoveryState.generation,
        });
        currentObligation = recoveryState.tasks
          .find((entry) => entry.definition.id === item.taskId)
          ?.recoveryObligations.find(
            (entry) =>
              entry.kind === "docker" && entry.recoveryId === item.recoveryId,
          );
      }
      if (
        currentObligation?.phase !== "acknowledged" ||
        !currentObligation.acknowledgement
      )
        return blocked(
          request,
          "orchestrator_task_recovery_acknowledgement_not_settled",
          {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
          },
        );
      await taskRecovery.observeTransition({
        phase: "verification_resources_finalized",
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        queueId,
        taskId: item.taskId,
        operationId: settledTask.operationId,
        recoveryId: item.recoveryId,
        stateGeneration: recoveryState.generation,
      });
      if (!readCurrentRecoveryState())
        return blocked(request, "orchestrator_task_recovery_not_settled", {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
          recoveryIds: [item.recoveryId],
          recoveryObligations: [
            Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
          ],
        });
    }
    const externallyOwnedItems = recoveryState.tasks.flatMap((task) =>
      task.recoveryObligations
        .filter(
          (entry) =>
            !["docker", "runtime_process"].includes(entry.kind) &&
            entry.phase !== "settled",
        )
        .map((entry) => ({ taskId: task.definition.id, ...entry })),
    );
    if (externallyOwnedItems.length > 0)
      return blocked(request, "orchestrator_external_recovery_required", {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
        recoveryIds: recoveryState.tasks.flatMap((task) =>
          task.recoveryObligations
            .filter(
              (entry) =>
                entry.phase !==
                (entry.kind === "docker" ? "acknowledged" : "settled"),
            )
            .map((entry) => entry.recoveryId),
        ),
        recoveryObligations: recoveryState.tasks.flatMap((task) =>
          task.recoveryObligations
            .filter(
              (entry) =>
                entry.phase !==
                (entry.kind === "docker" ? "acknowledged" : "settled"),
            )
            .map(({ kind, recoveryId }) => Object.freeze({ kind, recoveryId })),
        ),
      });
    if (queue.state === "recovery_required") {
      const queueSettlement = persistence.state.settleQueueRecovery(
        queueId,
        queue.generation,
        recoveryApplication,
      );
      if (queueSettlement.status !== "completed")
        return blocked(request, queueSettlement.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      queue = queueSettlement.value;
      await taskRecovery.observeTransition({
        phase: "queue_settled",
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        queueId,
        taskId: null,
        operationId: null,
        recoveryId: null,
        stateGeneration: recoveryState.generation,
      });
    }
    const retryTaskIds = recoveryState.tasks
      .filter(
        (task) =>
          task.state === "recovery_required" &&
          !task.recoveryUnresolved &&
          task.recoveryObligations.length > 0 &&
          task.recoveryObligations.every(
            (entry) =>
              entry.phase ===
              (entry.kind === "docker" ? "acknowledged" : "settled"),
          ),
      )
      .map((task) => task.definition.id);
    if (retryTaskIds.length > 0) {
      const retry = retrySettledProjectTaskRecoveries(
        recoveryState,
        recoveryState.generation,
        retryTaskIds,
      );
      if (retry.status !== "completed")
        return blocked(request, retry.reason, {
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          effectState: "no_effect",
        });
      const retryWrite = persistence.state.writeState(
        retry.state,
        recoveryState.generation,
      );
      if (retryWrite.status !== "completed")
        return blocked(request, retryWrite.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      state = Object.freeze({
        status: "completed" as const,
        reason: retryWrite.reason,
        value: retryWrite.value,
      });
      recoveryState = retryWrite.value;
      await taskRecovery.observeTransition({
        phase: "retry_ready",
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        queueId,
        taskId: null,
        operationId: null,
        recoveryId: null,
        stateGeneration: recoveryState.generation,
      });
    }
  }
  if (queue.state === "queued" || queue.state === "waiting_foreground") {
    const currentState = state.value;
    if (!currentState)
      return blocked(request, "orchestrator_state_observation_unknown", {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
      });
    const selected = persistence.state.selectNextOperation();
    if (selected.status !== "completed")
      return blocked(request, selected.reason, {
        cleanupConfirmed: false,
        manualRecoveryRequired: selected.manualRecoveryRequired,
        effectState: "unknown",
      });
    if (!selected.value || selected.value.queueId !== queueId)
      return createCoordinatorObjectiveResult(request, {
        status: "blocked",
        reason: "orchestrator_objective_queued_waiting_foreground",
        queueId,
        projection: projectCoordinatorState(currentState),
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        processRestartRequired: false,
        recoveryIds: Object.freeze([]),
        recoveryObligations: Object.freeze([]),
        effectState: "no_effect" as const,
      });
  }
  if (queue.state === "integration_pending" && state.value) {
    return createCoordinatorObjectiveResult(request, {
      status: "completed",
      reason: "orchestrator_tasks_already_integration_pending",
      queueId,
      projection: projectCoordinatorState(state.value),
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      recoveryIds: Object.freeze([]),
      recoveryObligations: Object.freeze([]),
      effectState: "no_effect" as const,
    });
  }
  if (queue.state === "completed" && state.value) {
    const projection = projectCoordinatorState(state.value);
    if (projection.milestoneState !== "accepted")
      return blocked(request, "orchestrator_terminal_replay_mismatch", {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
      });
    return createCoordinatorObjectiveResult(request, {
      status: "completed",
      reason: "orchestrator_objective_already_accepted",
      queueId,
      projection,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      recoveryIds: Object.freeze([]),
      recoveryObligations: Object.freeze([]),
      effectState: "no_effect" as const,
    });
  }
  if (queue.state === "cancelled" && state.value)
    return createCoordinatorObjectiveResult(request, {
      status: "cancelled",
      reason: "orchestrator_objective_already_cancelled",
      queueId,
      projection: projectCoordinatorState(state.value),
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      recoveryIds: Object.freeze([]),
      recoveryObligations: Object.freeze([]),
      effectState: "no_effect" as const,
    });
  if (queue.state !== "queued" && state.value) {
    const manualRecoveryRequired = queue.state === "recovery_required";
    const outstandingRecoveries = state.value.tasks.flatMap((task) =>
      task.recoveryObligations.filter(
        (entry) =>
          entry.phase !==
          (entry.kind === "docker" ? "acknowledged" : "settled"),
      ),
    );
    return createCoordinatorObjectiveResult(request, {
      status: "blocked",
      reason: `orchestrator_objective_${queue.state}`,
      queueId,
      projection: projectCoordinatorState(state.value),
      cleanupConfirmed: !manualRecoveryRequired,
      manualRecoveryRequired,
      processRestartRequired: outstandingRecoveries.some(
        (entry) => entry.kind === "runtime_process",
      ),
      recoveryIds: Object.freeze(
        outstandingRecoveries.map((entry) => entry.recoveryId),
      ),
      recoveryObligations: Object.freeze(
        outstandingRecoveries.map(({ kind, recoveryId }) =>
          Object.freeze({ kind, recoveryId }),
        ),
      ),
      effectState: manualRecoveryRequired
        ? ("unknown" as const)
        : ("no_effect" as const),
    });
  }
  const executableState = state.value;
  if (!executableState)
    return blocked(request, "orchestrator_state_observation_unknown", {
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  let rawExecutions: unknown;
  try {
    rawExecutions = dependencies.createTaskExecutions(request, executableState);
  } catch {
    rawExecutions = null;
  }
  const taskExecutions = createCoordinatorTaskExecutionSet(
    rawExecutions,
    executableState,
    dependencies.clockIdentity,
  );
  if (!taskExecutions)
    return blocked(request, "orchestrator_task_execution_set_invalid");
  const execution = await runCoordinatorOperation(
    {
      ...dependencies.execution,
      clockIdentity: dependencies.clockIdentity,
      processSafety: dependencies.processSafety,
      persistence,
    },
    {
      projectId: request.projectId,
      milestoneId: request.milestoneId,
      queueId,
      taskExecutions: taskExecutions.map((entry) =>
        Object.freeze({
          ...entry,
          repositoryRoot: dependencies.repositoryRoot,
        }),
      ),
      cancellationSignal,
    },
  );
  const latest = persistence.state.readState(request.projectId);
  const projection =
    latest.status === "completed" && latest.value
      ? projectCoordinatorState(latest.value)
      : null;
  return createCoordinatorObjectiveResult(request, {
    status: execution.status,
    reason: execution.reason,
    queueId,
    projection,
    cleanupConfirmed: execution.cleanupConfirmed,
    manualRecoveryRequired: execution.manualRecoveryRequired,
    processRestartRequired: execution.processRestartRequired,
    recoveryIds: execution.recoveryIds,
    recoveryObligations: execution.recoveryObligations,
    effectState: execution.effectState,
    ...(execution.workspaceResults === undefined
      ? {}
      : { workspaceResults: execution.workspaceResults }),
  });
}

/**
 * Coordinator Objective Intake 契約の公開契約を記述する。
 *
 * @responsibility Coordinator Objective Intake 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCoordinatorObjectiveIntakeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCoordinatorObjectiveIntakeContractの入力契約を満たす。
 * @postcondition describeCoordinatorObjectiveIntakeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCoordinatorObjectiveIntakeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCoordinatorObjectiveIntakeContractは独自の失敗分岐を所有しない。
 * @invariant describeCoordinatorObjectiveIntakeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeCoordinatorObjectiveIntakeContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeCoordinatorObjectiveIntakeContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeCoordinatorObjectiveIntakeContractは共有非同期状態を持たない同期処理である。
 */
export function describeCoordinatorObjectiveIntakeContract() {
  return Object.freeze({
    contract: COORDINATOR_OBJECTIVE_INTAKE_CONTRACT,
    transports: Object.freeze(["cli", "mcp"]),
    duplicateRequest: "same_queue_and_latest_state_no_duplicate_effect",
    scopeExpansionByPlanner: false,
    ownerLossObservation: "platform_adapter_only",
  });
}

/**
 * Bind Host-prepared Task payloads to the exact current Task scope. The Host
 *
 * @responsibility Coordinator Task Execution Setの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown、state: CoordinatorState、clockIdentity: CoordinatorClockIdentityPort
 * @returns readonly CoordinatorTaskExecution[] | nullを返す。
 * @precondition 「raw: unknown、state: CoordinatorState、clockIdentity: CoordinatorClockIdentityPort」がcreateCoordinatorTaskExecutionSetの入力契約を満たす。
 * @postcondition createCoordinatorTaskExecutionSetの責務を完了した結果だけを返す。
 * @effect N/A: createCoordinatorTaskExecutionSetは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createCoordinatorTaskExecutionSetは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createCoordinatorTaskExecutionSetは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createCoordinatorTaskExecutionSetはProcess内の同一Subsystemで完結する。
 * @security N/A: createCoordinatorTaskExecutionSetはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createCoordinatorTaskExecutionSetは共有非同期状態を持たない同期処理である。
 */
export function createCoordinatorTaskExecutionSet(
  raw: unknown,
  state: CoordinatorState,
  clockIdentity: CoordinatorClockIdentityPort,
): readonly CoordinatorTaskExecution[] | null {
  const activeTasks = state.tasks.filter((task) => task.state !== "superseded");
  const rawExecutions = snapshotPlainArray(raw, activeTasks.length);
  if (
    rawExecutions.status !== "ok" ||
    rawExecutions.value.length !== activeTasks.length
  )
    return null;
  const executions: CoordinatorTaskExecution[] = [];
  for (const rawExecution of rawExecutions.value) {
    const execution = snapshotPlainRecord(
      rawExecution,
      new Set(["taskId", "taskRequest", "repositoryRoot"] as const),
    );
    const task = activeTasks.find(
      (candidate) => candidate.definition.id === execution?.taskId,
    );
    if (!execution || !task) return null;
    let authorityBindingId: string;
    try {
      authorityBindingId = clockIdentity.createStableId("authority", [
        state.projectId,
        state.milestoneId,
        state.repositoryRevision,
        task.definition.objectiveId,
        task.definition.id,
        String(task.retryCount),
      ]);
    } catch {
      return null;
    }
    if (!validId(authorityBindingId)) return null;
    executions.push(
      Object.freeze({
        taskId: task.definition.id,
        authorityBindingId,
        taskRequest: execution.taskRequest,
        repositoryRoot: execution.repositoryRoot,
      }),
    );
  }
  return new Set(executions.map((entry) => entry.taskId)).size ===
    activeTasks.length
    ? Object.freeze(executions)
    : null;
}

/**
 * Canonical public result envelope for one Coordinator objective request.
 *
 * @responsibility Coordinator Objective 結果の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input request: CoordinatorObjectiveRequest、options: Readonly<{ status: "completed" | "blocked" | "cancelled"; reason: string; queueId?: string | null; projection?: ReturnType<typeof projectCoordinatorState> | null; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; processRestartRequired?: boolean; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryObligation["kind"]; recoveryId: string; }>[]; effectState?: "no_effect" | "settled" | "unknown"; }>
 * @returns createCoordinatorObjectiveResultの計算結果を返す。
 * @precondition 「request: CoordinatorObjectiveRequest、options: Readonly<{ status: "completed" | "blocked" | "cancelled"; reason: string; queueId?: string | null; projection?: ReturnType<typeof projectCoordinatorState> | null; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; processRestartRequired?: boolean; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryObligation["kind"]; recoveryId: string; }>[]; effectState?: "no_effect" | "settled" | "unknown"; }>」がcreateCoordinatorObjectiveResultの入力契約を満たす。
 * @postcondition createCoordinatorObjectiveResultの責務を完了した結果だけを返す。
 * @effect N/A: createCoordinatorObjectiveResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createCoordinatorObjectiveResultは独自の失敗分岐を所有しない。
 * @invariant createCoordinatorObjectiveResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createCoordinatorObjectiveResultはProcess内の同一Subsystemで完結する。
 * @security N/A: createCoordinatorObjectiveResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createCoordinatorObjectiveResultは共有非同期状態を持たない同期処理である。
 */
export function createCoordinatorObjectiveResult(
  request: CoordinatorObjectiveRequest,
  options: Readonly<{
    status: "completed" | "blocked" | "cancelled";
    reason: string;
    queueId?: string | null;
    projection?: ReturnType<typeof projectCoordinatorState> | null;
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    processRestartRequired?: boolean;
    recoveryIds?: readonly string[];
    recoveryObligations?: readonly Readonly<{
      kind: ProjectTaskRecoveryObligation["kind"];
      recoveryId: string;
    }>[];
    effectState?: "no_effect" | "settled" | "unknown";
    workspaceResults?: CoordinatorExecutionResult["workspaceResults"] | null;
  }>,
) {
  const workspaceResults =
    options.workspaceResults === undefined
      ? undefined
      : inspectCoordinatorWorkspaceResults(
          options.workspaceResults,
          request.workspaceId ?? null,
        );
  return Object.freeze({
    contract: COORDINATOR_OBJECTIVE_INTAKE_CONTRACT,
    status: options.status,
    reason: options.reason,
    requestId: request.requestId,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    queueId: options.queueId ?? null,
    projection: options.projection ?? null,
    cleanupConfirmed: options.cleanupConfirmed ?? true,
    manualRecoveryRequired: options.manualRecoveryRequired ?? false,
    processRestartRequired: options.processRestartRequired ?? false,
    recoveryIds: Object.freeze([...(options.recoveryIds ?? [])]),
    recoveryObligations: Object.freeze([
      ...(options.recoveryObligations ?? []),
    ]),
    effectState: options.effectState ?? ("no_effect" as const),
    ...(workspaceResults === undefined ? {} : { workspaceResults }),
  });
}

/**
 * 公開Objectiveを既存のSingle Task入力へ変換する。
 *
 * @responsibility Coordinator Coordinator Task Requestの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input request: CoordinatorObjectiveRequest、taskExecutionSelections: 保存済みの役割選定組。
 * @returns buildObjectiveTaskRequestの計算結果を返す。
 * @precondition 選定組は同じObjective受付の不変値である。
 * @postcondition 完全な選定組を搬送し、現在設定・Catalogによる再選定を行わない。
 * @effect N/A: buildObjectiveTaskRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: buildObjectiveTaskRequestは独自の失敗分岐を所有しない。
 * @invariant buildObjectiveTaskRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: buildObjectiveTaskRequestはProcess内の同一Subsystemで完結する。
 * @security 選定値はGrant、送信同意、現在の利用可能性または隔離を代替しない。
 * @concurrency N/A: buildObjectiveTaskRequestは共有非同期状態を持たない同期処理である。
 */
export function buildObjectiveTaskRequest(
  request: CoordinatorObjectiveRequest,
  taskExecutionSelections: TaskExecutionSelections,
) {
  const selections = inspectTaskExecutionSelections(taskExecutionSelections);
  if (!selections) throw new Error("coordinator_task_selection_invalid");
  return Object.freeze({
    taskExecutionSelections: selections,
    objective: request.objective,
    acceptanceCriteria: Object.freeze([...request.acceptanceCriteria]),
    allowedPaths: Object.freeze([...request.allowedPaths]),
    readPaths: Object.freeze([...request.readPaths]),
    workClass: "bounded_implementation" as const,
    planState: "complete" as const,
    risk: "low" as const,
    difficulty: "low" as const,
    decisionImpact: "limited" as const,
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  });
}

/**
 * Production composition shared by the CLI and MCP transports.
 *
 * @responsibility Coordinator Public Objectiveの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input runtimeDependencies: PublicExecutionDependencies、rawRequest: unknown、cancellationSignal: AbortSignal、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns executeCoordinatorPublicObjectiveの計算結果を返す。
 * @precondition 「runtimeDependencies: PublicExecutionDependencies、rawRequest: unknown、cancellationSignal: AbortSignal、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がexecuteCoordinatorPublicObjectiveの入力契約を満たす。
 * @postcondition executeCoordinatorPublicObjectiveの責務を完了した結果だけを返す。
 * @effect Repository・判断記録を観測し、受付状態の保存と認可済みTask実行を既存Ownerへ委譲する。
 * @failure executeCoordinatorPublicObjectiveは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 予約・開始・結果保存・配送の順序と同じ要求Identityを維持する。
 * @boundary 公開Objective入力→認証・保存・実行依存の境界を接続する。
 * @security 認証済み主体・Repository・要求範囲を既存境界で検証し、現在の許可外へ実行を拡張しない。
 * @concurrency 取消Signalと実行・保存・結果搬送の非同期完了を既存Lifecycleへ接続する。
 */
export async function executeCoordinatorPublicObjective(
  runtimeDependencies: PublicExecutionDependencies,
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  const request = inspectCoordinatorObjectiveRequest(rawRequest);
  if (!request)
    return Object.freeze({
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_objective_request_invalid",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  if (request.adoptResult)
    return createCoordinatorObjectiveResult(request, {
      status: "blocked",
      reason: "orchestrator_explicit_workspace_adoption_required",
    });
  let repositoryRoot: string;
  try {
    repositoryRoot =
      resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
  } catch {
    return Object.freeze({
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_repository_root_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  }
  const identity = inspectRepositoryIdentityCandidate(repositoryRoot);
  const authenticated = runtimeDependencies.openDecisionStore();
  if (
    authenticated.status !== "completed" ||
    (authenticationContext !== undefined &&
      authenticationContext.principalId !== authenticated.principalId)
  )
    return Object.freeze({
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_authenticated_principal_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  const observedPlatform = observePlatformFamily();
  const platform =
    observedPlatform.status === "observed" &&
    observedPlatform.platformFamily === "windows"
      ? createCoordinatorWindowsPlatformAdapter()
      : null;
  const observeLeaseOwner = (
    owner: Readonly<{
      ownerProcessId: number;
      ownerGeneration: string;
    }>,
  ) => {
    const lockLease = platform?.operations.lock_lease as
      | Readonly<{ observeLeaseOwner: (value: typeof owner) => unknown }>
      | undefined;
    return (
      lockLease?.observeLeaseOwner(owner) ??
      Object.freeze({
        status: "unknown",
        ownerProcessId: owner.ownerProcessId,
        ownerGeneration: owner.ownerGeneration,
      })
    );
  };
  const execution = await runCoordinatorObjective(
    {
      authenticatedPrincipalId: authenticated.principalId,
      resolveTaskSelections(request) {
        const root = verifyRepositoryRoot(repositoryRoot);
        if (root.status !== "completed")
          return Object.freeze({
            status: "blocked" as const,
            value: null,
            reason: root.reason,
          });
        const configured = readRepositoryAiSelection(
          root.capability,
          getAiModelCatalog().catalog,
        );
        if (configured.status !== "available")
          return Object.freeze({
            status: "blocked" as const,
            value: null,
            reason: configured.reason,
          });
        return resolveTaskExecutionSelections(configured.snapshot.config, {
          workType: request.workType ?? null,
          ...(request.choice ? { choice: request.choice } : {}),
        });
      },
      /**
       * Project Bindingを検証する。
       *
       * @responsibility Project Bindingの検証根拠、成立条件、観測不能時の拒否境界を所有する。
       * @trace ARCH-000004
       * @input input
       * @returns verifyProjectBindingの計算結果を返す。
       * @precondition 「input」がverifyProjectBindingの入力契約を満たす。
       * @postcondition verifyProjectBindingの責務を完了した結果だけを返す。
       * @effect N/A: verifyProjectBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
       * @failure N/A: verifyProjectBindingは独自の失敗分岐を所有しない。
       * @invariant verifyProjectBindingは入力から導いた結果以外の共有状態を変更しない。
       * @boundary N/A: verifyProjectBindingはProcess内の同一Subsystemで完結する。
       * @security N/A: verifyProjectBindingはAuthority、秘密値または信頼判断を扱わない。
       * @concurrency N/A: verifyProjectBindingは共有非同期状態を持たない同期処理である。
       */
      verifyProjectBinding(input) {
        if (
          identity?.status !== "candidate" ||
          (identity.commit !== input.repositoryRevision &&
            !workspacePlanReadyForAcceptance(
              repositoryRoot,
              deriveCoordinatorRepositoryBindingId(repositoryRoot),
              input.projectId,
              input.milestoneId,
              input.repositoryRevision,
              identity.commit,
            ))
        )
          return Object.freeze({
            status: "blocked",
            reason: "orchestrator_repository_revision_mismatch",
          });
        return Object.freeze({
          status: "verified",
          repositoryBindingId:
            deriveCoordinatorRepositoryBindingId(repositoryRoot),
          repositoryRevision: input.repositoryRevision,
          workingDirectory: repositoryRoot,
          repositoryRoot,
          bindingCapability: Object.freeze({}),
        });
      },
      /**
       * plan Objectiveを決定する。
       *
       * @responsibility plan Objectiveの導出に必要な入力、判定規則、返却結果の境界を所有する。
       * @trace ARCH-000004
       * @input request: CoordinatorObjectiveRequest
       * @returns planObjectiveの計算結果を返す。
       * @precondition 「request: CoordinatorObjectiveRequest」がplanObjectiveの入力契約を満たす。
       * @postcondition planObjectiveの責務を完了した結果だけを返す。
       * @effect N/A: planObjectiveは入力と局所値だけを扱い、外部または共有Effectを発行しない。
       * @failure N/A: planObjectiveは独自の失敗分岐を所有しない。
       * @invariant planObjectiveは入力から導いた結果以外の共有状態を変更しない。
       * @boundary N/A: planObjectiveはProcess内の同一Subsystemで完結する。
       * @security N/A: planObjectiveはAuthority、秘密値または信頼判断を扱わない。
       * @concurrency N/A: planObjectiveは共有非同期状態を持たない同期処理である。
       */
      planObjective(request: CoordinatorObjectiveRequest) {
        return request.plan;
      },
      /**
       * Task Executionsを構築する。
       *
       * @responsibility Task Executionsの構築入力、生成結果、不正入力の拒否境界を所有する。
       * @trace ARCH-000004
       * @input request、_bindingCapability、state
       * @returns createTaskExecutionsの計算結果を返す。
       * @precondition 「request、_bindingCapability、state」がcreateTaskExecutionsの入力契約を満たす。
       * @postcondition createTaskExecutionsの責務を完了した結果だけを返す。
       * @effect N/A: createTaskExecutionsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
       * @failure N/A: createTaskExecutionsは独自の失敗分岐を所有しない。
       * @invariant createTaskExecutionsは入力から導いた結果以外の共有状態を変更しない。
       * @boundary N/A: createTaskExecutionsはProcess内の同一Subsystemで完結する。
       * @security N/A: createTaskExecutionsはAuthority、秘密値または信頼判断を扱わない。
       * @concurrency N/A: createTaskExecutionsは共有非同期状態を持たない同期処理である。
       */
      createTaskExecutions(request, _bindingCapability, state) {
        return state.tasks
          .filter((task) => task.state !== "superseded")
          .map((task) => {
            const input = request.taskInputs.find(
              (candidate) => candidate.taskId === task.definition.id,
            );
            if (!input) throw new Error("coordinator_task_input_missing");
            return Object.freeze({
              taskId: task.definition.id,
              repositoryRoot,
              taskRequest: buildObjectiveTaskRequest(
                Object.freeze({
                  ...request,
                  objective: input.objective,
                  readPaths: input.readPaths,
                  acceptanceCriteria: Object.freeze([
                    ...input.acceptanceCriteria,
                  ]),
                  allowedPaths: Object.freeze([
                    ...task.definition.allowedPaths,
                  ]),
                }),
                state.taskExecutionSelections,
              ),
            });
          });
      },
      observeLeaseOwner,
      recoverTaskRecovery: (recoveryId, signal) => {
        const root = verifyRepositoryRoot(repositoryRoot);
        return recoverRuntimeOwnedDockerTaskForCurrentConsumer(
          recoveryId,
          root.status === "completed" ? root.capability : null,
          signal,
        );
      },
      acknowledgeTaskRecovery: (settlement) =>
        consumeDockerRecoveryReceiptAfterProjectSettlement(settlement, {
          workingDirectory,
          repositoryRoot,
          repositoryBindingId:
            deriveCoordinatorRepositoryBindingId(repositoryRoot),
        }),
      resolveTaskRecoveryCorrelations:
        runtimeDependencies.resolveTaskRecoveryCorrelations ??
        ((ids) => {
          const root = verifyRepositoryRoot(repositoryRoot);
          return resolveRuntimeOwnedDockerTaskCurrentCorrelations(
            ids,
            root.status === "completed" ? root.capability : null,
          );
        }),
      observeRecoveryTransition: writeCoordinatorRecoveryDiagnostic,
      execution: {
        resultDelivery: {
          repositoryBindingId:
            deriveCoordinatorRepositoryBindingId(repositoryRoot),
        },
        runSingleTaskAttempt: (input) =>
          runCoordinatorSingleTaskAttempt(
            {
              startTask: (
                taskRequest,
                root,
                correlation,
                observer,
                workspaceTarget,
              ) =>
                runtimeDependencies.startTask(
                  taskRequest,
                  root,
                  correlation,
                  observer,
                  "orchestrator",
                  workspaceTarget,
                ),
              cancelTask: runtimeDependencies.cancelTask,
              captureResultDelivery: runtimeDependencies.captureResultDelivery,
            },
            input,
          ),
        recordTaskAttempt: (observation) =>
          runtimeDependencies.recordExecutionEvent(repositoryRoot, observation),
        callbacks: {
          observePublication:
            runtimeDependencies.observeExecutionEventPublication,
        },
      },
    },
    request,
    cancellationSignal,
  );
  if (
    execution.projection?.milestoneState === "accepted" &&
    execution.reason === "orchestrator_tasks_already_integration_pending"
  )
    return createCoordinatorObjectiveResult(request, {
      ...execution,
      status: "completed",
      reason: "orchestrator_objective_already_accepted",
    });
  if (
    execution.queueId &&
    execution.projection?.milestoneState !== "accepted" &&
    [
      "orchestrator_tasks_completed_integration_pending",
      "orchestrator_tasks_already_integration_pending",
    ].includes(execution.reason)
  ) {
    const snapshot = readCoordinatorTaskIntakeState(
      verifyRuntimePersistenceRepository(repositoryRoot),
      deriveCoordinatorRepositoryBindingId(repositoryRoot),
    );
    const queue =
      snapshot.status === "completed"
        ? snapshot.value?.queueEntries.find(
            (q) =>
              q.queueId === execution.queueId &&
              q.projectId === request.projectId &&
              q.milestoneId === request.milestoneId,
          )
        : null;
    if (
      !queue ||
      (queue.workspaceId !== request.workspaceId &&
        !(queue.workspaceId == null && request.workspaceId === undefined))
    )
      return createCoordinatorObjectiveResult(request, {
        ...execution,
        status: "blocked",
        reason: "orchestrator_workspace_target_unconfirmed",
        cleanupConfirmed: false,
      });
    const ready = workspacePlanReadyForAcceptance(
      repositoryRoot,
      deriveCoordinatorRepositoryBindingId(repositoryRoot),
      request.projectId,
      request.milestoneId,
      request.repositoryRevision,
      identity?.commit ?? "",
    );
    return createCoordinatorObjectiveResult(request, {
      ...execution,
      status: "blocked",
      reason:
        queue.workspaceId != null && !ready
          ? "orchestrator_workspace_adoption_required"
          : "orchestrator_quality_acceptance_required",
    });
  }
  return execution;
}

/**
 * Bindingを観測する。
 *
 * @responsibility Bindingの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown、revision: string
 * @returns inspectBindingの計算結果を返す。
 * @precondition 「raw: unknown、revision: string」がinspectBindingの入力契約を満たす。
 * @postcondition inspectBindingの責務を完了した結果だけを返す。
 * @effect N/A: inspectBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectBindingは独自の失敗分岐を所有しない。
 * @invariant inspectBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectBindingはProcess内の同一Subsystemで完結する。
 * @security inspectBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectBindingは共有非同期状態を持たない同期処理である。
 */
function inspectBinding(raw: unknown, revision: string) {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "status",
      "repositoryBindingId",
      "repositoryRevision",
      "workingDirectory",
      "repositoryRoot",
      "bindingCapability",
    ] as const),
  );
  if (!value) return null;
  return value.status === "verified" &&
    validId(value.repositoryBindingId) &&
    value.repositoryRevision === revision &&
    typeof value.workingDirectory === "string" &&
    value.workingDirectory.length > 0 &&
    value.repositoryRoot !== null &&
    (typeof value.repositoryRoot === "object" ||
      typeof value.repositoryRoot === "string") &&
    value.bindingCapability !== null &&
    typeof value.bindingCapability === "object"
    ? Object.freeze({
        repositoryBindingId: value.repositoryBindingId,
        repositoryRevision: revision,
        workingDirectory: value.workingDirectory,
        repositoryRoot: value.repositoryRoot,
        bindingCapability: value.bindingCapability,
      })
    : null;
}

/**
 * 認証済み主体とRepositoryを確認し、Objective受付を保存・Task実行へ接続する。
 *
 * @responsibility Coordinator Objectiveの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: CoordinatorObjectiveIntakeDependencies、rawRequest: unknown、cancellationSignal: AbortSignal
 * @returns runCoordinatorObjectiveの計算結果を返す。
 * @precondition 「dependencies: CoordinatorObjectiveIntakeDependencies、rawRequest: unknown、cancellationSignal: AbortSignal」がrunCoordinatorObjectiveの入力契約を満たす。
 * @postcondition 検証済みの同じ受付Identityで実行し、停止結果を成功へ補正せず返す。
 * @effect 受付世代を観測し、既存保存PortとTask実行へ委譲する。停止以外の結果では同じRepositoryの終了後整理を呼ぶ。
 * @failure runCoordinatorObjectiveは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant Binding・計画・受付世代の確認を実行より先に行い、終了後整理の不明をcleanup成功へ変えない。
 * @boundary Objective受付→Repositoryに結合した保存・実行Portの境界。
 * @security 認証済みPrincipalと検証済みBindingだけを接続し、Capabilityを公開結果へ含めない。
 * @concurrency 同じ取消Signalと保存世代を既存実行へ渡し、新しいLock・Writer・再試行を作らない。
 */
export async function runCoordinatorObjective(
  dependencies: CoordinatorObjectiveIntakeDependencies,
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
) {
  const request = inspectCoordinatorObjectiveRequest(rawRequest);
  if (
    !request ||
    !(cancellationSignal instanceof AbortSignal) ||
    !validId(dependencies.authenticatedPrincipalId)
  )
    return blocked(
      Object.freeze({
        requestId: "invalid",
        projectId: "invalid",
        milestoneId: "invalid",
      }) as CoordinatorObjectiveRequest,
      "orchestrator_objective_request_invalid",
    );

  let rawBinding: unknown;
  try {
    rawBinding = dependencies.verifyProjectBinding({
      projectId: request.projectId,
      milestoneId: request.milestoneId,
      repositoryRevision: request.repositoryRevision,
    });
  } catch {
    rawBinding = null;
  }
  const binding = inspectBinding(rawBinding, request.repositoryRevision);
  if (!binding) return blocked(request, "orchestrator_binding_not_verified");

  let rawPlan: unknown;
  try {
    rawPlan = dependencies.planObjective(request, binding.bindingCapability);
  } catch {
    rawPlan = null;
  }
  const plan = inspectCoordinatorObjectivePlan(rawPlan, request);
  if (!plan)
    return blocked(request, "orchestrator_plan_invalid_or_out_of_scope");

  const hostPorts = createCoordinatorExecutionHostPorts();
  const intake = {
    epoch: request.intakeEpoch,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    queueId: hostPorts.clockIdentity.createStableId("queue", [
      binding.repositoryBindingId,
      request.projectId,
      request.milestoneId,
      request.requestId,
      dependencies.authenticatedPrincipalId,
    ]),
    requestHash: hostPorts.clockIdentity.createContentHash(
      JSON.stringify({
        ...request,
        plan,
        authenticatedPrincipalId: dependencies.authenticatedPrincipalId,
        acceptanceCriteria: [...request.acceptanceCriteria],
        allowedPaths: [...request.allowedPaths],
        readPaths: [...request.readPaths],
      }),
    ),
  };
  const admitted = inspectCoordinatorSnapshotIntake(
    binding.workingDirectory,
    binding.repositoryBindingId,
    intake,
  );
  if (admitted.status !== "completed")
    return createCoordinatorObjectiveResult(request, {
      status: "blocked",
      reason: admitted.reason,
      cleanupConfirmed: !admitted.manualRecoveryRequired,
      manualRecoveryRequired: admitted.manualRecoveryRequired,
      recoveryIds: admitted.recoveryId ? [admitted.recoveryId] : [],
      effectState: admitted.manualRecoveryRequired ? "unknown" : "no_effect",
    });
  const result = await executeCoordinatorObjective(
    {
      authenticatedPrincipalId: dependencies.authenticatedPrincipalId,
      repositoryBindingId: binding.repositoryBindingId,
      repositoryRoot: binding.repositoryRoot,
      plan,
      resolveTaskSelections: dependencies.resolveTaskSelections,
      persistence: createCoordinatorSnapshotPersistencePorts(
        binding.workingDirectory,
        binding.repositoryBindingId,
        request.intakeEpoch,
        intake,
      ),
      clockIdentity: hostPorts.clockIdentity,
      processSafety: hostPorts.processSafety,
      taskRecovery: createCoordinatorTaskRecoveryAdapter(
        binding.workingDirectory,
        binding.repositoryBindingId,
        dependencies,
      ),
      createTaskExecutions: (objectiveRequest, state) =>
        dependencies.createTaskExecutions(
          objectiveRequest,
          binding.bindingCapability,
          state,
        ),
      observeLeaseOwner: dependencies.observeLeaseOwner,
      execution: dependencies.execution,
    },
    request,
    cancellationSignal,
  );
  if (result.status === "blocked") return result;
  const maintenance = maintainCoordinatorSnapshot(
    binding.workingDirectory,
    binding.repositoryBindingId,
  );
  if (maintenance.status !== "completed")
    return createCoordinatorObjectiveResult(request, {
      ...result,
      status: "blocked",
      projection:
        result.projection?.milestoneState === "accepted"
          ? null
          : result.projection,
      reason: `${result.status === "cancelled" ? "orchestrator_cancelled_" : ""}${maintenance.reason}`,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  return result;
}

import { COORDINATOR_PUBLIC_RUNTIME_CONTRACT } from "../../../domain-model/src/index.ts";
import { COORDINATOR_OBJECTIVE_INTAKE_CONTRACT } from "../../../domain-model/src/index.ts";
import {
  type CoordinatorObjectiveRequest,
  inspectCoordinatorObjectiveRequest,
} from "../../../domain-model/src/index.ts";

import { inspectCoordinatorWorkspaceResults } from "../../../domain-model/src/index.ts";
