/**
 * objective-applicationに属する責務をまとめる。
 *
 * @responsibility CoordinatorObjectiveExecutionDependenciesを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { isDeepStrictEqual } from "node:util";
import type { CoordinatorPersistencePorts } from "../state/persistence.ts";
import { runCoordinatorOperation } from "../task/dispatch.ts";
import type { CoordinatorExecutionDependencies } from "../task/execution-contract.ts";
import type { CoordinatorClockIdentityPort } from "../identity/clock-and-hash.ts";
import type { CoordinatorProcessSafetyPort } from "../process/safety-contract.ts";
import type { CoordinatorTaskRecoveryPort } from "../task/recovery.ts";
import {
  createCoordinatorState,
  type ProjectTaskRecoveryObligation,
  type CoordinatorState,
} from "../state/model.ts";
import {
  acknowledgeProjectDockerRecoveryObligation,
  markProjectTaskRecoveryObligationRecovering,
  recordProjectTaskOwnerLossRecoveries,
  retrySettledProjectTaskRecoveries,
  settleProjectTaskRecoveryObligation,
} from "../task/recovery-transitions.ts";
import { projectCoordinatorState } from "../state/projection.ts";
import { snapshotPlainRecord } from "../input/plain-data-snapshot.ts";
import {
  createCoordinatorObjectiveResult,
  createCoordinatorTaskExecutionSet,
  COORDINATOR_OBJECTIVE_INTAKE_CONTRACT,
  type CoordinatorObjectivePlan,
} from "./plan.ts";
import type { CoordinatorObjectiveRequest } from "./request.ts";

/**
 * objective-applicationで使用するCoordinator Objective Application Dependenciesの値契約を定義する。
 *
 * @responsibility Coordinator Objective Application DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorObjectiveExecutionDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorObjectiveExecutionDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorObjectiveExecutionDependenciesの宣言は外部境界を開かない。
 * @security N/A: CoordinatorObjectiveExecutionDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorObjectiveExecutionDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorObjectiveExecutionDependencies = Readonly<{
  authenticatedPrincipalId: string;
  repositoryBindingId: string;
  repositoryRoot: object | string;
  plan: CoordinatorObjectivePlan;
  persistence: CoordinatorPersistencePorts;
  clockIdentity: CoordinatorClockIdentityPort;
  processSafety: CoordinatorProcessSafetyPort;
  taskRecovery: CoordinatorTaskRecoveryPort;
  createTaskExecutions: (
    request: CoordinatorObjectiveRequest,
    state: CoordinatorState,
  ) => unknown;
  observeLeaseOwner: (
    owner: Readonly<{
      ownerProcessId: number;
      ownerGeneration: string;
    }>,
  ) => unknown;
  execution: Omit<
    CoordinatorExecutionDependencies,
    "persistence" | "clockIdentity" | "processSafety"
  >;
}>;

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
    const created = createCoordinatorState({
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
