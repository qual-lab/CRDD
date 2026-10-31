/**
 * 単段Executorを既存のHost・保存・回復Ownerへ一度だけ接続する。
 * @responsibility 同じ本番Runtimeの開始・取消・同期証拠照合だけを上位へ渡す。
 * @trace ARCH-000008
 * @boundary CoordinatorのHost管理とExecutorの技術生涯の間。
 */
import {
  createExecutor,
  type ExecutorCallbacks,
  type AttemptRequest,
  type ProcessStartedNotice,
  type Executor,
  type StartResult,
  type AttemptTerminalObservation,
} from "../../../executor/src/index.ts";
import {
  snapshotReadyRecovery,
  snapshotBlockedRecoveryWithExactId,
  ownDataValue,
  inspectRecoveryStartFailureDiagnostic,
  resolveRecoveryStartReason,
  resolveRecoveryReference,
} from "./validation.ts";
import type { RecoveryStartFailureDiagnostic, RecoveryPlan } from "./types.ts";
import type { AiProvider } from "../../../ai-adapter/src/index.ts";
import type { PreparationInput, PreparedAttemptPlan } from "./types.ts";
import {
  completeRuntimeOwnedProviderHomeMount,
  consumeRuntimeOwnedProviderAuthority,
  revokeRuntimeOwnedProviderAuthority,
} from "./authority.ts";
import {
  verifyRuntimeOwnedRepositoryOperation,
  borrowOwnedDockerExecutionPaths,
  borrowOwnedOperationExecutionSelection,
} from "./operation.ts";
import {
  createProviderDockerRuntimeDependencies,
  createAttemptPreparation,
} from "./preparation.ts";
import { createRuntimeOwnedLifecycleNoticeReporter } from "./controller.ts";
import {
  abandonRuntimeOwnedDockerRecovery,
  bindRuntimeOwnedExecutorAttempt,
  cancelRuntimeOwnedExecutorAttempt,
  abandonRuntimeOwnedExecutorAttempt as abandonBoundExecutorAttempt,
  beginRuntimeOwnedDockerRecovery,
  bindRuntimeOwnedDockerInitializationFailure,
  inspectRuntimeOwnedDockerResourceReceipts,
  markRuntimeOwnedDockerResourceSubmission,
  recordRuntimeOwnedDockerProviderSubmission,
  recordRuntimeOwnedDockerTerminalObservation,
  recordRuntimeOwnedDockerResourceNotIssued,
  recordRuntimeOwnedDockerResourceReceipt,
  verifyRuntimeOwnedDockerRecoveryBinding,
  recordRuntimeOwnedAttemptCleanup,
  recordRuntimeOwnedUnstartedAttempt,
} from "./recovery.ts";

import { types as utilTypes } from "node:util";
import { parseDockerTaskRecoveryId } from "../../../docker-isolation/src/index.ts";
import type {
  ExecutionRecordOperations,
  Recovery,
  AttemptCleanupResult,
  RecordedAttemptResult,
  RecordedStartResult,
} from "./types.ts";
const preparationHost = createProviderDockerRuntimeDependencies();
const createAttemptExecutor = (
  request: AttemptRequest,
  random: Readonly<{ randomBytes: (size: number) => Buffer }>,
) =>
  createExecutor(
    request,
    {
      borrowPaths: borrowOwnedDockerExecutionPaths,
      inspectReceipts: inspectRuntimeOwnedDockerResourceReceipts,
    },
    random,
  );
const codexPreparation = createAttemptPreparation(
  "codex",
  preparationHost,
  createAttemptExecutor,
);
const claudePreparation = createAttemptPreparation(
  "claude",
  preparationHost,
  createAttemptExecutor,
);
/**
 * 消費した上位記録と技術入力を同じ一試行へ結合する。
 * @responsibility 元の選定・Packet相関を下位Planへ戻さず、保存・診断へ接続する。
 * @trace ARCH-000008
 * @input 元の準備記録、凍結した技術入力、同じ管理参照。
 * @returns 一試行専用の確認・記録callback。
 * @effect 構築時は閉包だけ。保存はExecutorの明示通知後に限る。
 * @invariant 完了結果は複製せず、技術解放条件は変更しない。
 */
function createExecutionRecordOperations(
  owned: PreparedAttemptPlan<AiProvider>,
  technical: RecoveryPlan,
  management: unknown,
  admission: {
    authorityConsumed: boolean;
    mountAttempted: boolean;
    mountCompleted: boolean;
  },
): ExecutionRecordOperations {
  return {
    recordUnstarted: recordRuntimeOwnedUnstartedAttempt,
    verifyRevision: (candidate, plan) =>
      candidate === management && plan === technical
        ? verifyRuntimeOwnedRepositoryOperation(candidate)
        : false,
    beginRecovery: (plan, candidate, observeFailure) => {
      if (plan !== technical || candidate !== management) return null;
      const complete = borrowOwnedOperationExecutionSelection(
        management,
        owned.selectionRecordId,
        owned.selectionHash,
        owned.taskAttempt,
        plan.executionSelection,
      );
      if (!complete) return null;
      return beginRuntimeOwnedDockerRecovery(
        { ...owned, executionSelection: complete },
        management,
        observeFailure,
      );
    },
    bindInitializationFailure: bindRuntimeOwnedDockerInitializationFailure,
    abandonRecovery: abandonRuntimeOwnedDockerRecovery,
    verifyRecoveryBinding: verifyRuntimeOwnedDockerRecoveryBinding,
    completeMount: (mount, owner) => {
      if (mount === owned.activeMountCapability && owner === management)
        admission.mountAttempted = true;
      const result = completeRuntimeOwnedProviderHomeMount(mount, owner);
      if (
        mount === owned.activeMountCapability &&
        owner === management &&
        result.status === "completed"
      )
        admission.mountCompleted = true;
      return result;
    },
    completeCleanup: (input) =>
      input.plan === technical && input.managementCapability === management
        ? recordRuntimeOwnedAttemptCleanup({ ...input, plan: owned })
        : {
            mountLeaseReleased: false,
            homeLeaseReleased: false,
            recoveryCompleted: false,
            recoveryFinalizationCapability: null,
          },
    markResourceSubmission: markRuntimeOwnedDockerResourceSubmission,
    recordProviderSubmission: recordRuntimeOwnedDockerProviderSubmission,
    recordTerminalObservation: recordRuntimeOwnedDockerTerminalObservation,
    recordResourceNotIssued: recordRuntimeOwnedDockerResourceNotIssued,
    recordResourceReceipt: recordRuntimeOwnedDockerResourceReceipt,
    consumeProviderAuthority: (use, mount, owner) => {
      const result = consumeRuntimeOwnedProviderAuthority(use, mount, owner);
      if (result) admission.authorityConsumed = true;
      return result;
    },
    reportProviderProcessStarted: createRuntimeOwnedLifecycleNoticeReporter(
      process.stderr,
    ),
    reportProviderBoundaryDiagnostic: (notice) =>
      createRuntimeOwnedLifecycleNoticeReporter(process.stderr)(
        Object.freeze({
          ...notice,
          taskAttempt: owned.taskAttempt,
          recoveryCorrelationId: owned.recoveryCorrelationId,
        }),
      ),
  };
}

/**
 * 上位準備が拒否された事実を技術開始前の結果として返す。
 * @responsibility 準備失敗を実行・清掃の成立へ昇格しない。
 * @trace ARCH-000008
 * @effect N/A: 凍結値の構築だけ。
 */
function createBlockedPreparationStart(
  reason: string,
): StartResult & Readonly<{ status: "blocked" }> {
  return Object.freeze({
    status: "blocked",
    reason,
    controlCapability: null,
    completion: null,
    operationId: null,
    recoveryId: null,
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    dockerEffectStarted: false,
    providerRequestStarted: false,
    normalizedResult: null,
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
    hostPathReported: false,
    proxyCredentialReported: false,
    preparationFailed: true,
  });
}

/**
 * 消費済み準備が技術開始前に拒否されたとき元のAuthorityとMountだけを閉じる。
 * @responsibility 未消費Authorityの失効と未返却Mountの終了を上位Ownerで確認する。
 * @trace ARCH-000008
 * @effect 同じ準備のAuthority失効・Mount返却だけ。Home Leaseへ触れない。
 */
function settleUnstartedPreparation(
  plan: PreparedAttemptPlan<AiProvider>,
  management: unknown,
  admission: {
    authorityConsumed: boolean;
    mountAttempted: boolean;
    mountCompleted: boolean;
  },
): boolean {
  if (admission.authorityConsumed) return false;
  let revoked = false;
  try {
    revoked =
      revokeRuntimeOwnedProviderAuthority(
        plan.authorityControlCapability,
        management,
      ).status === "revoked";
  } catch {}
  if (!admission.mountAttempted) {
    admission.mountAttempted = true;
    try {
      admission.mountCompleted =
        completeRuntimeOwnedProviderHomeMount(
          plan.activeMountCapability,
          management,
        ).status === "completed";
    } catch {}
  }
  return revoked && admission.mountCompleted;
}

// Host開始保存と実行調停の相互参照では、初期化中にRuntimeを呼ばない。
// 関数宣言だけを束縛し、実呼出しは同じ一つのExecutorへ委譲する。
/**
 * 単段の開始を同じ固定Executorへ渡す。
 * @responsibility Host準備値を新Taskや新Runtimeへ読み替えず配送する。
 * @trace ARCH-000008
 * @input args: 元準備・管理参照・同期回復引渡しと既存制限。
 * @returns 同じExecutorの開始結果とcompletion。
 * @precondition 元Ownerの準備と同意が成立している。
 * @postcondition Task全体の順序を変更しない。
 * @effect Executorの開始・元回復保存と下位実行へ委譲する。
 * @failure 元のblocked／unknownをそのまま返す。
 * @invariant 本番Runtimeを呼出しごとに作らない。
 * @boundary Coordinatorの段階調停と単段実行。
 * @security 任意CLI／Processを追加注入しない。
 * @concurrency 返されたcompletionは上位が終了まで管理する。
 */
export function startRuntimeOwnedDockerProcessController(
  provider: AiProvider,
  input: PreparationInput,
  handoff: (capability: object, recoveryId: string) => boolean,
  restriction?: (purpose: string) => boolean,
  observeStarted?: (notice: ProcessStartedNotice) => void | Promise<void>,
): StartResult {
  if (provider !== "codex" && provider !== "claude")
    return createBlockedPreparationStart(
      "docker_process_controller_plan_invalid",
    );
  const owner = provider === "codex" ? codexPreparation : claudePreparation;
  const prepared = owner.prepare(input);
  const selection = {
    notice: prepared.selectionNotice,
    model: prepared.selectedModel,
    effort: prepared.selectedEffort,
  };
  if (prepared.status !== "prepared")
    return Object.freeze({
      ...createBlockedPreparationStart(prepared.reason),
      selectionNotice: selection.notice,
      selectedModel: selection.model,
      selectedEffort: selection.effort,
    });
  const plan = owner.consume(
    prepared.preparedCapability,
    input.managementCapability,
  );
  if (!plan)
    return Object.freeze({
      ...createBlockedPreparationStart(
        "docker_process_controller_plan_invalid",
      ),
      preparationFailed: false,
      selectionNotice: selection.notice,
      selectedModel: selection.model,
      selectedEffort: selection.effort,
    });
  const technical = plan;
  const admission = {
    authorityConsumed: false,
    mountAttempted: false,
    mountCompleted: false,
  };
  let started: StartResult;
  try {
    started = startHostAttempt(
      plan.executor,
      {
        dependencies: createExecutionRecordOperations(
          plan,
          technical,
          input.managementCapability,
          admission,
        ),
      },
      technical,
      input.managementCapability,
      handoff,
      restriction,
      observeStarted,
    );
  } catch {
    started = createBlockedPreparationStart(
      "docker_process_controller_start_failed_closed",
    );
  }
  if (started.status !== "started" && !admission.authorityConsumed) {
    const cleanupConfirmed = settleUnstartedPreparation(
      plan,
      input.managementCapability,
      admission,
    );
    started = Object.freeze({
      ...started,
      cleanupConfirmed,
      manualRecoveryRequired: !cleanupConfirmed || started.recoveryId !== null,
    });
  }
  return Object.freeze({
    ...started,
    preparationFailed: false,
    selectionNotice: selection.notice,
    selectedModel: selection.model,
    selectedEffort: selection.effort,
  });
}
/**
 * 元の制御参照の取消を同じExecutorへ渡す。
 * @responsibility 取消要求を開始時と同じControlへ結合する。
 * @trace ARCH-000008
 * @input args: 元Controlと管理参照。
 * @returns 元の取消・終了観測結果。
 * @precondition Controlは同じ本番Executorが発行したもの。
 * @postcondition 他OwnerのControlを取り消さない。
 * @effect 同じ下位Sessionへ取消を要求する。
 * @failure 参照不一致は元の拒否結果となる。
 * @invariant 要求成功だけで全資源回収済みとしない。
 * @boundary Task取消と単段Session。
 * @security exact管理参照を補完しない。
 * @concurrency completionの終了責任を取消で切り離さない。
 */
export function cancelRuntimeOwnedDockerProcessController(
  control: unknown,
  management: unknown,
) {
  return cancelRuntimeOwnedExecutorAttempt(control, management);
}

/**
 * 同じExecutorの終了済み試行だけを既存の明示終了へ渡す。
 * @responsibility 生Executorやstartを上位へ公開せず元Controlの終了に限定する。
 * @trace ARCH-000008
 * @effect 既存abandonへ委譲する。解放条件は変更しない。
 */
export function abandonRuntimeOwnedExecutorAttempt(
  recovery: unknown,
  management: unknown,
): boolean {
  return abandonBoundExecutorAttempt(recovery, management);
}
function settleInvalidRecoveryStart(
  state: Readonly<{ dependencies: ExecutionRecordOperations }>,
  plan: RecoveryPlan,
  managementCapability: object,
  recoveryCapability: unknown,
  recoveryId: string | null,
  reason: string,
) {
  if (recoveryCapability && typeof recoveryCapability === "object") {
    try {
      state.dependencies.abandonRecovery?.(recoveryCapability);
    } catch {}
  }
  try {
    state.dependencies.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
  } catch {}
  return createUnstartedResult({
    status: "blocked",
    reason: reason,
    cleanupConfirmed: false,
    recoveryId: recoveryId,
    manualRecoveryRequired: true,
  });
}

function commandRestrictionAllows(restriction: unknown, purpose: string) {
  if (restriction === undefined) return true;
  if (
    typeof restriction !== "function" ||
    utilTypes.isProxy(restriction) ||
    utilTypes.isAsyncFunction(restriction)
  )
    return false;
  try {
    const result: unknown = restriction(purpose);
    if (utilTypes.isPromise(result)) {
      // A mistakenly returned native Promise cannot authorize a synchronous
      // launch. Observe rejection without awaiting or invoking a custom then.
      void Promise.prototype.then.call(
        result,
        () => {},
        () => {},
      );
      return false;
    }
    return result === true;
  } catch {
    return false;
  }
}

/**
 * 上位が確定した一試行を実行し、技術通知を自身の保存へ接続する。
 * @responsibility 通知へ保存結果を返さず、上位の完了投影だけで耐久受理を表す。
 * @trace ARCH-000008
 * @effect 同じ記録への更新・Grant終了と、下位Executorの明示開始。
 */
function startRecordedAttempt(
  executor: Executor,
  plan: RecoveryPlan,
  management: object,
  recovery: Recovery,
  operations: ExecutionRecordOperations,
  observeStarted?: (notice: ProcessStartedNotice) => void | Promise<void>,
  restriction?: unknown,
): RecordedStartResult {
  let restrictionRejected = false;
  let mountCompletion: Readonly<{ status: string }> | null = null;
  let cleanup: AttemptCleanupResult = {
    mountLeaseReleased: false,
    homeLeaseReleased: false,
    recoveryCompleted: false,
    recoveryFinalizationCapability: null,
  };
  let terminalObservation: AttemptTerminalObservation | null = null;
  function requireRecorded(value: unknown): void {
    if (utilTypes.isPromise(value)) void value.catch(() => {});
    if (value !== true) throw Error("record_unconfirmed");
  }
  const callbacks: ExecutorCallbacks = {
    onCommandSubmitting: (purpose) => {
      if (!commandRestrictionAllows(restriction, purpose)) {
        restrictionRejected = true;
        throw Error("execution_restricted");
      }
      if (purpose.startsWith("create_") && operations.markResourceSubmission)
        requireRecorded(
          operations.markResourceSubmission(
            recovery.recoveryCapability,
            purpose,
          ),
        );
    },
    onCommandNotIssued: (purpose) => {
      if (operations.recordResourceNotIssued)
        requireRecorded(
          operations.recordResourceNotIssued(
            recovery.recoveryCapability,
            purpose,
          ),
        );
    },
    onProviderSubmitting: () => {
      if (operations.recordProviderSubmission)
        requireRecorded(
          operations.recordProviderSubmission(recovery.recoveryCapability),
        );
    },
    onResourceCreated: (purpose, id) => {
      if (operations.recordResourceReceipt)
        requireRecorded(
          operations.recordResourceReceipt(
            recovery.recoveryCapability,
            purpose,
            id,
          ),
        );
    },
    onStarted: async (notice) => {
      // 表示の失敗は保存の成否や後続実行を変更しない。
      try {
        const pending = operations.reportProviderProcessStarted?.(notice);
        if (pending) void pending.catch(() => {});
      } catch {
        // 任意表示だけの失敗。
      }
      if (observeStarted) {
        try {
          await observeStarted(notice);
        } catch {
          throw Error("provider_start_record_failed");
        }
      }
    },
    onDiagnostic: (notice) => {
      try {
        const pending = operations.reportProviderBoundaryDiagnostic?.(
          restrictionRejected &&
            notice.event === "coordinator_provider_boundary_settled"
            ? Object.freeze({
                ...notice,
                primaryFailure:
                  terminalObservation?.primaryFailure ?? notice.primaryFailure,
              })
            : notice,
        );
        if (pending) void pending.catch(() => {});
      } catch {
        // 任意診断は実行結果・元回復参照を変更しない。
      }
    },
    onResourcesClosed: () => {
      mountCompletion = operations.completeMount(
        plan.activeMountCapability,
        management,
      );
      cleanup = {
        ...cleanup,
        mountLeaseReleased: mountCompletion.status === "completed",
      };
    },
    onCleanupCompleted: (observation) => {
      terminalObservation =
        restrictionRejected && observation.primaryFailure
          ? Object.freeze({
              ...observation,
              primaryFailure: Object.freeze({
                ...observation.primaryFailure,
                stage: "command_restriction" as const,
                reason:
                  "docker_process_controller_execution_restricted" as const,
              }),
            })
          : observation;
      cleanup = {
        ...cleanup,
        homeLeaseReleased: observation.homeLeaseReleased,
      };
      if (
        !observation.processTreeTerminationConfirmed ||
        !observation.containersAbsent ||
        !observation.networksAbsent ||
        observation.resources === null
      )
        return;
      const saved = operations.completeCleanup({
        plan,
        managementCapability: management,
        recoveryCapability: recovery.recoveryCapability,
        recoveryId: recovery.recoveryId,
        observations: observation.resources,
        mountCompletion,
        mountLeaseReleased: cleanup.mountLeaseReleased,
        homeLeaseReleased: observation.homeLeaseReleased,
      });
      if (
        saved.mountLeaseReleased !== cleanup.mountLeaseReleased ||
        saved.homeLeaseReleased !== cleanup.homeLeaseReleased
      )
        throw Error("cleanup_record_inconsistent");
      cleanup = saved;
    },
  };
  const bound = bindRuntimeOwnedExecutorAttempt(
    recovery.recoveryCapability,
    management,
    executor,
  );
  const started = bound
    ? executor.start(management, recovery, callbacks)
    : Object.freeze({
        ...createBlockedPreparationStart(
          "docker_process_controller_recovery_unavailable",
        ),
        recoveryId: recovery.recoveryId,
      });
  let controlBindingConfirmed = true;
  if (
    started.status === "started" &&
    !bindRuntimeOwnedExecutorAttempt(
      recovery.recoveryCapability,
      management,
      executor,
      started,
    )
  ) {
    controlBindingConfirmed = false;
    void executor.cancel(started.controlCapability, management).catch(() => {});
    // 元completionを上位の終了保存へjoinし、開始済みの試行を未開始へ戻さない。
  }
  if (started.status !== "started") {
    try {
      operations.recordUnstarted?.(
        recovery.recoveryCapability,
        management,
        started,
      );
    } catch {
      /* 同じ未開始参照と回復義務を保持する。 */
    }
    try {
      operations.completeMount(plan.activeMountCapability, management);
    } catch {}
    return started;
  }
  return Object.freeze({
    ...started,
    completion: started.completion.then(async (result) => {
      try {
        if (!controlBindingConfirmed)
          throw Error("executor_control_binding_failed");
        const observation = terminalObservation;
        if (!observation) throw Error("terminal_observation_missing");
        const revisionValid = !!operations.verifyRevision(management, plan);
        const taskCleanupConfirmed =
          result.cleanupConfirmed && cleanup.mountLeaseReleased;
        const final: RecordedAttemptResult = Object.freeze({
          ...result,
          ...cleanup,
          reason:
            restrictionRejected && result.cleanupConfirmed
              ? ("docker_process_controller_execution_restricted" as const)
              : result.reason,
          cleanupConfirmed: taskCleanupConfirmed,
          ...(!taskCleanupConfirmed
            ? {
                status: "blocked" as const,
                reason:
                  "docker_process_controller_cleanup_unconfirmed" as const,
                normalizedResult: null,
                resultSha256: null,
                resultBytes: 0,
                reviewFindings: null,
                providerExecutionObservation: null,
                providerTurnObservation: null,
              }
            : {}),
          recoveryId:
            taskCleanupConfirmed && cleanup.recoveryCompleted
              ? null
              : recovery.recoveryId,
          manualRecoveryRequired:
            result.manualRecoveryRequired ||
            !cleanup.mountLeaseReleased ||
            !cleanup.recoveryCompleted,
          ...(!revisionValid
            ? {
                status: "blocked" as const,
                reason: "repository_revision_changed" as const,
                normalizedResult: null,
                resultSha256: null,
                resultBytes: 0,
                reviewFindings: null,
              }
            : {}),
        });
        if (observation.resources !== null)
          await operations.recordTerminalObservation?.(
            recovery.recoveryCapability,
            final,
            Object.freeze({
              ...observation,
              mountLeaseReleased: cleanup.mountLeaseReleased,
              recoveryCompleted: cleanup.recoveryCompleted,
            }),
          );
        return final;
      } catch {
        return Object.freeze({
          ...result,
          ...cleanup,
          status: "blocked" as const,
          reason: "docker_process_controller_execution_failed_closed" as const,
          recoveryCompleted: false,
          recoveryFinalizationCapability: null,
          recoveryId: recovery.recoveryId,
          manualRecoveryRequired: true,
          normalizedResult: null,
          resultSha256: null,
          resultBytes: 0,
          reviewFindings: null,
        });
      }
    }),
  });
}

function startHostAttempt(
  executor: Executor,
  state: Readonly<{ dependencies: ExecutionRecordOperations }>,
  preparedCapability: unknown,
  managementCapability: unknown,
  registerRecoveryHandoff: unknown,
  commandRestriction: unknown,
  observeProviderStarted?: (
    notice: ProcessStartedNotice,
  ) => void | Promise<void>,
) {
  if (
    (observeProviderStarted !== undefined &&
      typeof observeProviderStarted !== "function") ||
    !managementCapability ||
    typeof managementCapability !== "object"
  ) {
    return createUnstartedResult({
      status: "blocked",
      reason: "docker_process_controller_effect_unavailable",
    });
  }
  const plan = preparedCapability as RecoveryPlan;
  if (!plan)
    return createUnstartedResult({
      status: "blocked",
      reason: "docker_process_controller_plan_invalid",
    });
  if (!state.dependencies.verifyRevision(managementCapability, plan)) {
    const completed = state.dependencies.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
    return createUnstartedResult({
      status: "blocked",
      reason: "docker_process_controller_revision_invalid",
      cleanupConfirmed: completed.status === "completed",
    });
  }
  const authority = state.dependencies.consumeProviderAuthority(
    plan.authorityUseCapability,
    plan.activeMountCapability,
    managementCapability,
  );
  if (
    !authority ||
    authority.operationId !== plan.operationId ||
    authority.provider !== plan.provider ||
    authority.providerHomeMountGrantRef !== plan.grantRef ||
    authority.runtimeAuthorityIssued !== true ||
    authority.providerEffectAllowed !== true
  ) {
    const completed = state.dependencies.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
    return createUnstartedResult({
      status: "blocked",
      reason: "docker_process_controller_authority_invalid",
      cleanupConfirmed: completed.status === "completed",
    });
  }
  let recoveryStartFailure: RecoveryStartFailureDiagnostic | null = null;
  const proceed = () => {
    let failureObserved = false;
    const recovery = state.dependencies.beginRecovery(
      plan,
      managementCapability,
      (raw) => {
        if (failureObserved) return;
        failureObserved = true;
        const value = inspectRecoveryStartFailureDiagnostic(raw);
        recoveryStartFailure =
          value &&
          (value.recoveryId === null ||
            parseDockerTaskRecoveryId(value.recoveryId)
              ?.stableLogicalHomeBindingHash ===
              plan.stableLogicalHomeBindingHash)
            ? value
            : Object.freeze({ stage: "unknown", recoveryId: null });
      },
    );
    const readyRecovery = snapshotReadyRecovery(recovery);
    if (!readyRecovery) {
      if (failureObserved && recoveryStartFailure) {
        const diagnostic =
          recoveryStartFailure as RecoveryStartFailureDiagnostic;
        const returnedId = resolveRecoveryReference(
          ownDataValue(recovery, "recoveryId"),
        );
        try {
          const pending = state.dependencies.reportProviderBoundaryDiagnostic?.(
            Object.freeze({
              event: "coordinator_provider_recovery_start_failed",
              taskRole: plan.taskRole,
              provider: plan.provider,
              operationId: plan.operationId,
              diagnostic:
                diagnostic.recoveryId === null ||
                diagnostic.recoveryId === returnedId
                  ? diagnostic
                  : Object.freeze({ stage: "unknown", recoveryId: null }),
            }),
          );
          if (pending) void pending.catch(() => {});
        } catch {
          // 診断出力の失敗で、元の回復開始結果や参照を変更しない。
        }
      }
      const malformedCapability = ownDataValue(recovery, "recoveryCapability");
      const malformedRecoveryId = resolveRecoveryReference(
        ownDataValue(recovery, "recoveryId"),
      );
      const exactBlocked = snapshotBlockedRecoveryWithExactId(
        recovery,
        plan.stableLogicalHomeBindingHash,
      );
      if (exactBlocked?.recoveryCapability) {
        const stopped = createUnstartedResult({
          status: "blocked",
          reason: resolveRecoveryStartReason(exactBlocked.reason),
          cleanupConfirmed: false,
          recoveryId: exactBlocked.recoveryId,
          manualRecoveryRequired: true,
        });
        let isVerified = false;
        try {
          isVerified =
            state.dependencies.bindInitializationFailure?.(
              exactBlocked.recoveryCapability,
              exactBlocked.recoveryId,
              managementCapability,
              plan.stableLogicalHomeBindingHash,
              exactBlocked.reason,
              stopped,
            ) === true;
        } catch {}
        if (isVerified) {
          try {
            state.dependencies.abandonRecovery?.(
              exactBlocked.recoveryCapability,
            );
          } catch {}
          try {
            state.dependencies.completeMount(
              plan.activeMountCapability,
              managementCapability,
            );
          } catch {}
          return stopped;
        }
      }
      if (!malformedCapability && exactBlocked) {
        const completed = state.dependencies.completeMount(
          plan.activeMountCapability,
          managementCapability,
        );
        return createUnstartedResult({
          status: "blocked",
          reason: resolveRecoveryStartReason(exactBlocked.reason),
          cleanupConfirmed: completed.status === "completed",
          recoveryId: exactBlocked.recoveryId,
          manualRecoveryRequired: true,
        });
      }
      if (malformedCapability || malformedRecoveryId)
        return settleInvalidRecoveryStart(
          state,
          plan,
          managementCapability,
          malformedCapability,
          malformedRecoveryId,
          "docker_process_controller_recovery_identity_invalid",
        );
      const completed = state.dependencies.completeMount(
        plan.activeMountCapability,
        managementCapability,
      );
      return createUnstartedResult({
        status: "blocked",
        reason: resolveRecoveryStartReason(ownDataValue(recovery, "reason")),
        cleanupConfirmed: completed.status === "completed",
        recoveryId: malformedRecoveryId,
        manualRecoveryRequired:
          ownDataValue(recovery, "manualRecoveryRequired") === true,
      });
    }
    const parsedRecoveryId = parseDockerTaskRecoveryId(
      readyRecovery.recoveryId,
    );
    if (
      !parsedRecoveryId ||
      parsedRecoveryId.stableLogicalHomeBindingHash !==
        plan.stableLogicalHomeBindingHash ||
      state.dependencies.verifyRecoveryBinding(
        readyRecovery.recoveryCapability,
        parsedRecoveryId?.token ?? readyRecovery.recoveryId,
        managementCapability,
        plan.stableLogicalHomeBindingHash,
      ) !== true
    ) {
      return settleInvalidRecoveryStart(
        state,
        plan,
        managementCapability,
        readyRecovery.recoveryCapability,
        parsedRecoveryId?.token ?? null,
        "docker_process_controller_recovery_identity_invalid",
      );
    }
    if (
      typeof registerRecoveryHandoff !== "function" ||
      registerRecoveryHandoff(
        readyRecovery.recoveryCapability,
        parsedRecoveryId.token,
      ) !== true
    ) {
      return settleInvalidRecoveryStart(
        state,
        plan,
        managementCapability,
        readyRecovery.recoveryCapability,
        parsedRecoveryId.token,
        "docker_process_controller_recovery_handoff_unavailable",
      );
    }
    return startRecordedAttempt(
      executor,
      plan,
      managementCapability,
      readyRecovery,
      state.dependencies,
      observeProviderStarted,
      commandRestriction,
    );
  };
  return proceed();
}
/**
 * 上位Admissionで拒否した未開始結果を構成する。
 * @responsibility 下位の結果Factoryを公開させず上位の回復義務を保持する。
 * @trace ARCH-000008
 * @effect N/A: 不変の値だけを作る。
 */
function createUnstartedResult(
  input: Readonly<{
    status: "blocked";
    reason: string;
    cleanupConfirmed?: boolean;
    recoveryId?: string | null;
    manualRecoveryRequired?: boolean;
  }>,
): StartResult & Readonly<{ status: "blocked" }> {
  const cleanupConfirmed = input.cleanupConfirmed ?? false,
    recoveryId = input.recoveryId ?? null;
  return Object.freeze({
    ...createBlockedPreparationStart(input.reason),
    preparationFailed: false,
    cleanupConfirmed,
    recoveryId,
    manualRecoveryRequired:
      input.manualRecoveryRequired === true ||
      !cleanupConfirmed ||
      recoveryId !== null,
  });
}
