/**
 * Workbench読取り助言を署名済みCoordinator Runtimeへ接続する。
 *
 * @packageDocumentation
 * @responsibility 署名配布物の確認、Operation、Provider Home、Selection、Docker回復、取消およびcleanupを一つの助言Lifecycleへ閉じる。
 * @trace ARCH-000008 ARCH-000010 ARCH-000015
 * @boundary Workbench助言Executorと署名済みDocker Provider Runtimeの実境界。
 * @effect 明示確認済み依頼ごとに選択Providerを最大一回実行し、所有する一時資源を清掃する。
 * @security Repository／WorkspaceをProviderへ共有せず、抽出済み助言JSONだけを返す。
 */
import {
  isRuntimeProcessEffectBlocked,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../core/runtime-process-safety-state.ts";
import { prepareRuntimeOwnedClaudeDockerAdviceCandidate } from "./claude-docker-runtime-adapter.ts";
import { prepareRuntimeOwnedCodexDockerAdviceCandidate } from "./codex-docker-runtime-adapter.ts";
import {
  classifyOwnedCoordinatorOperationCreationFailure,
  createRuntimeOwnedCoordinatorOperation,
} from "./coordinator-operation-creation-internal.ts";
import {
  issueRuntimeOwnedDelegationSelectionGrant,
  revokeRuntimeOwnedDelegationSelectionGrant,
} from "./delegation-selection-grant-runtime.ts";
import {
  cancelRuntimeOwnedDockerProcessController,
  startRuntimeOwnedDockerProcessController,
} from "./docker-process-controller.ts";
import {
  abandonRuntimeOwnedDockerRecovery,
  finalizeRuntimeOwnedDockerRecovery,
  prepareRuntimeOwnedDockerHostCleanup,
  recordRuntimeOwnedDockerHostCleanupReceipt,
} from "./docker-recovery-runtime.ts";
import {
  abandonOwnedHostOperationGenerationLock,
  activateOwnedHostOperationGenerationLock,
  classifyOwnedOperationDirectoryCreationFailure,
  cleanupOwnedOperationDirectoriesAsync,
  confirmOwnedHostOperationGenerationLockReadiness,
  observeOwnedHostOperationGenerationLoss,
  verifyOwnedOperationCleanupOutcome,
} from "./execution-environment.ts";
import { consumeRuntimeOwnedVerifiedCoordinatorPackageCapability } from "./platform-provisioner-package-filesystem.ts";
import {
  consumeRuntimeOwnedProviderHomeMountGrant,
  issueRuntimeOwnedProviderHomeMountGrant,
  revokeRuntimeOwnedProviderHomeMountGrant,
} from "./provider-home-mount-grant-runtime.ts";
import { inspectRuntimeOwnedWindowsProviderHomeCandidate } from "./provider-home-windows-adapter.ts";
import type { WorkbenchAiAdviceExecutionPlan } from "./workbench-ai-advice-execution-plan.ts";
import type {
  WorkbenchAiAdviceRuntimePort,
  WorkbenchAiAdviceRuntimeResult,
} from "./workbench-ai-advice-provider-executor.ts";
import {
  issueRuntimeOwnedWorkbenchAiAdvicePacket,
  revokeRuntimeOwnedWorkbenchAiAdvicePacket,
} from "./workbench-ai-advice-runtime-packet.ts";

export const WORKBENCH_AI_ADVICE_PRODUCTION_RUNTIME_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-production-runtime";
export const WORKBENCH_AI_ADVICE_PRODUCTION_RUNTIME_CONTRACT_REVISION = 1;

type RuntimeRecord = Readonly<Record<string, unknown>>;
type Operation = Readonly<{
  owned: object;
  mountCapability: object;
  managementCapability: object;
  operationId: string;
  hostRecoveryId: string;
  hostGenerationFailureDetected?: Promise<void>;
  hostGenerationLoss?: Promise<"cleanup_confirmed_failure" | "cleanup_unknown">;
  releaseHostGenerationDrain?: () => boolean;
}>;

export type WorkbenchAiAdviceRuntimeDependencies = Readonly<{
  consumeVerifiedPackage: (capability: unknown) => boolean;
  createOperation: () => Promise<Operation>;
  observeProviderHome: typeof inspectRuntimeOwnedWindowsProviderHomeCandidate;
  issueMountGrant: typeof issueRuntimeOwnedProviderHomeMountGrant;
  consumeMountGrant: typeof consumeRuntimeOwnedProviderHomeMountGrant;
  revokeMountGrant: typeof revokeRuntimeOwnedProviderHomeMountGrant;
  issueSelection: typeof issueRuntimeOwnedDelegationSelectionGrant;
  revokeSelection: typeof revokeRuntimeOwnedDelegationSelectionGrant;
  issuePacket: typeof issueRuntimeOwnedWorkbenchAiAdvicePacket;
  revokePacket: typeof revokeRuntimeOwnedWorkbenchAiAdvicePacket;
  prepareCodex: typeof prepareRuntimeOwnedCodexDockerAdviceCandidate;
  prepareClaude: typeof prepareRuntimeOwnedClaudeDockerAdviceCandidate;
  startProcess: typeof startRuntimeOwnedDockerProcessController;
  cancelProcess: typeof cancelRuntimeOwnedDockerProcessController;
  prepareDockerHostCleanup: typeof prepareRuntimeOwnedDockerHostCleanup;
  cleanupOperation: typeof cleanupOwnedOperationDirectoriesAsync;
  classifyOperationCleanup: typeof verifyOwnedOperationCleanupOutcome;
  recordDockerHostCleanupReceipt: typeof recordRuntimeOwnedDockerHostCleanupReceipt;
  finalizeDockerRecovery: typeof finalizeRuntimeOwnedDockerRecovery;
  abandonDockerRecovery: typeof abandonRuntimeOwnedDockerRecovery;
  abandonOperation: typeof abandonOwnedHostOperationGenerationLock;
  poisonAfterCleanupUnknown: () => void;
}>;

/**
 * 署名配布物Capabilityを依頼ごとに発行するProduction助言Runtimeを生成する。
 *
 * @responsibility 一回用の署名配布物CapabilityをRuntimeへ渡し、助言Lifecycleの外へ再利用可能なAuthorityを公開しない。
 * @trace ARCH-000010 ARCH-000015
 * @input issueVerifiedPackageCapability: 現在配布物を検証して一回用Capabilityを返す関数。
 * @returns Workbench Provider Executorへ注入できるRuntime Port。
 * @precondition 発行関数は秘密値を返さず、失敗時はnullを返す。
 * @postcondition 各呼出しは独立Operationを所有し、completedはHost／Docker cleanup後だけ返る。
 * @effect 選択ProviderのDocker ProcessとRepository-local Runtime状態を操作する。
 * @failure 署名、Identity、取消、Process、回復またはcleanupの不成立をblockedへ閉じる。
 * @invariant 自動再送、Provider fallback、Repository Mountおよび生出力公開を行わない。
 * @boundary Workbench Production Compositionと署名済みCoordinator Runtimeの間。
 * @security Capability、Host Path、Credentialおよび生Provider出力を公開結果へ含めない。
 * @concurrency 呼出しごとに独立Operationを生成し、共有Authorityを使い回さない。
 */
export function createRuntimeOwnedWorkbenchAiAdviceProductionRuntime(
  issueVerifiedPackageCapability: () => unknown,
): WorkbenchAiAdviceRuntimePort {
  const runtime = createWorkbenchAiAdviceRuntime(productionDependencies);
  return (executionPlan, cancellationSignal) =>
    runtime(
      executionPlan,
      cancellationSignal,
      issueVerifiedPackageCapability(),
    );
}

/** 試験専用の依存注入候補。Production Authorityを持たない。 */
export function createIsolatedWorkbenchAiAdviceRuntimeCandidate(
  dependencies: WorkbenchAiAdviceRuntimeDependencies,
) {
  return Object.freeze({
    productionAuthority: false as const,
    run: createWorkbenchAiAdviceRuntime(dependencies),
  });
}

function createWorkbenchAiAdviceRuntime(
  dependencies: WorkbenchAiAdviceRuntimeDependencies,
) {
  return async (
    plan: WorkbenchAiAdviceExecutionPlan,
    cancellationSignal: AbortSignal,
    verifiedPackageCapability: unknown,
  ): Promise<WorkbenchAiAdviceRuntimeResult> => {
    if (cancellationSignal.aborted)
      return blocked(
        "workbench_ai_advice_cancelled_before_runtime_effect",
        false,
        true,
      );
    if (
      isRuntimeProcessEffectBlocked() ||
      !dependencies.consumeVerifiedPackage(verifiedPackageCapability)
    )
      return blocked(
        "workbench_ai_advice_release_verification_required",
        false,
        true,
      );

    let operation: Operation | null = null;
    let mountControl: object | null = null;
    let selectionControl: object | null = null;
    let packetOwner: object | null = null;
    let processControl: object | null = null;
    let recoveryCapability: object | null = null;
    let recoveryFinalizationCapability: object | null = null;
    let providerEffectIssued = false;
    let operationCleaned = false;
    let hostGenerationFailed = false;
    let abortListener: (() => void) | null = null;

    try {
      operation = await dependencies.createOperation();
      if (cancellationSignal.aborted)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_cancelled_during_operation_creation",
        );

      const observation = dependencies.observeProviderHome(
        plan.provider,
        new Date().toISOString(),
      ) as RuntimeRecord;
      const observationCapability = objectValue(
        observation.observationCapability,
      );
      if (
        observation.status !== "candidate" ||
        !observationCapability ||
        observation.provider !== plan.provider
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_provider_home_unavailable",
        );

      const mount = dependencies.issueMountGrant(
        operation.managementCapability,
        observationCapability,
        plan.profileId,
      ) as RuntimeRecord;
      mountControl = objectValue(mount.controlCapability);
      const mountUse = objectValue(mount.useCapability);
      if (mount.status !== "issued" || !mountControl || !mountUse)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_mount_grant_unavailable",
        );
      const consumedMount = dependencies.consumeMountGrant(
        mountUse,
        operation.managementCapability,
        observationCapability,
      ) as RuntimeRecord;
      const mountAuthorization = objectValue(
        consumedMount.mountAuthorizationCapability,
      );
      if (consumedMount.status !== "consumed" || !mountAuthorization)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_mount_authorization_unavailable",
        );

      const selection = dependencies.issueSelection(
        operation.managementCapability,
        selectionRequest(plan, operation.operationId),
      ) as RuntimeRecord;
      selectionControl = objectValue(selection.controlCapability);
      const selectionUse = objectValue(selection.useCapability);
      if (
        selection.status !== "issued" ||
        !selectionControl ||
        !selectionUse ||
        selection.profileId !== plan.profileId ||
        selection.selectedModel !== plan.exactModelId ||
        selection.selectedEffort !== plan.reasoningEffort
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_selection_unavailable",
        );

      const packet = dependencies.issuePacket({
        operationId: operation.operationId,
        profileId: plan.profileId,
        provider: plan.provider,
        taskHash: plan.taskHash,
        projectionHash: plan.projectionHash,
        providerPrompt: plan.providerPrompt,
        providerCommand: plan.providerCommand,
      }) as RuntimeRecord;
      packetOwner = objectValue(packet.ownerCapability);
      const packetUse = objectValue(packet.useCapability);
      if (packet.status !== "issued" || !packetOwner || !packetUse)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_runtime_packet_unavailable",
        );

      const prepared = (
        plan.provider === "codex"
          ? dependencies.prepareCodex
          : dependencies.prepareClaude
      )(
        operation.managementCapability,
        operation.mountCapability,
        mountAuthorization,
        selectionUse,
        packetUse,
        packetOwner,
      ) as RuntimeRecord;
      const preparedCapability = objectValue(prepared.preparedCapability);
      if (prepared.status !== "prepared" || !preparedCapability)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_provider_preparation_failed",
        );
      packetOwner = null;
      selectionControl = null;
      mountControl = null;

      const process = dependencies.startProcess(
        preparedCapability,
        operation.managementCapability,
        (capability: unknown) => {
          recoveryCapability = objectValue(capability);
          return recoveryCapability !== null;
        },
      ) as RuntimeRecord;
      processControl = objectValue(process.controlCapability);
      const completion = process.completion;
      providerEffectIssued = process.dockerEffectStarted === true;
      if (
        process.status !== "started" ||
        !processControl ||
        !(completion instanceof Promise)
      )
        throw new AdviceRuntimeError(
          stringValue(process.reason) ??
            "workbench_ai_advice_process_start_failed",
        );

      abortListener = () => {
        if (processControl && operation)
          void dependencies.cancelProcess(
            processControl,
            operation.managementCapability,
          );
      };
      cancellationSignal.addEventListener("abort", abortListener, {
        once: true,
      });
      operation.hostGenerationFailureDetected?.then(() => {
        hostGenerationFailed = true;
        abortListener?.();
      });

      const result = (await completion) as RuntimeRecord;
      processControl = null;
      if (result.cleanupConfirmed !== true)
        throw new AdviceRuntimeError(
          stringValue(result.reason) ??
            "workbench_ai_advice_provider_cleanup_unconfirmed",
        );
      const providerCompletionReason = cancellationSignal.aborted
        ? "workbench_ai_advice_cancelled_after_provider_effect"
        : hostGenerationFailed
          ? "workbench_ai_advice_host_generation_lost"
          : result.status === "completed"
            ? null
            : (stringValue(result.reason) ??
              "workbench_ai_advice_provider_failed");
      recoveryFinalizationCapability = objectValue(
        result.recoveryFinalizationCapability,
      );
      if (
        !recoveryCapability ||
        !recoveryFinalizationCapability ||
        recoveryCapability !== recoveryFinalizationCapability
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_recovery_finalization_unavailable",
        );
      const normalized =
        providerCompletionReason === null
          ? recordValue(result.normalizedResult)
          : null;
      const adviceJson = normalized ? stringValue(normalized.adviceJson) : null;
      if (
        providerCompletionReason === null &&
        (normalized?.contract !==
          "crdd-coordinator/workbench-ai-advice-provider-output" ||
          normalized?.contractRevision !== 1 ||
          !adviceJson)
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_normalized_result_invalid",
        );

      if (
        !dependencies.prepareDockerHostCleanup(recoveryFinalizationCapability)
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_host_cleanup_intent_unconfirmed",
        );
      const hostCleanup = dependencies.classifyOperationCleanup(
        await dependencies.cleanupOperation(operation.owned),
      );
      if (!hostCleanup)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_operation_cleanup_unconfirmed",
        );
      operationCleaned = true;
      if (
        !dependencies.recordDockerHostCleanupReceipt(
          recoveryFinalizationCapability,
        ) ||
        dependencies.finalizeDockerRecovery(recoveryFinalizationCapability)
          .status !== "completed"
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_docker_recovery_finalization_unconfirmed",
        );
      recoveryCapability = null;
      recoveryFinalizationCapability = null;
      operation.releaseHostGenerationDrain?.();
      if (providerCompletionReason !== null)
        return blocked(providerCompletionReason, true, true);
      if (adviceJson === null)
        return blocked(
          "workbench_ai_advice_normalized_result_invalid",
          true,
          true,
        );
      return Object.freeze({
        status: "completed" as const,
        reason: null,
        adviceJson,
        providerEffectIssued: true as const,
        cleanupConfirmed: true as const,
      });
    } catch (error) {
      if (processControl && operation) {
        try {
          await dependencies.cancelProcess(
            processControl,
            operation.managementCapability,
          );
        } catch {}
      }
      if (packetOwner) dependencies.revokePacket(packetOwner);
      if (selectionControl && operation)
        dependencies.revokeSelection(
          selectionControl,
          operation.managementCapability,
        );
      if (mountControl && operation)
        dependencies.revokeMountGrant(
          mountControl,
          operation.managementCapability,
        );
      if (recoveryCapability)
        dependencies.abandonDockerRecovery(recoveryCapability);

      let cleanupConfirmed = operationCleaned;
      if (operation && !operationCleaned && !providerEffectIssued) {
        try {
          const cleanup = dependencies.classifyOperationCleanup(
            await dependencies.cleanupOperation(operation.owned),
          );
          cleanupConfirmed = cleanup !== null;
        } catch {
          cleanupConfirmed = false;
        }
      }
      if (operation && !cleanupConfirmed) {
        try {
          await dependencies.abandonOperation(operation.managementCapability);
        } catch {}
      }
      if (!cleanupConfirmed) dependencies.poisonAfterCleanupUnknown();
      operation?.releaseHostGenerationDrain?.();
      return blocked(
        error instanceof AdviceRuntimeError
          ? error.reason
          : "workbench_ai_advice_runtime_failed_closed",
        providerEffectIssued,
        cleanupConfirmed,
      );
    } finally {
      if (abortListener)
        cancellationSignal.removeEventListener("abort", abortListener);
    }
  };
}

class AdviceRuntimeError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}

function selectionRequest(
  plan: WorkbenchAiAdviceExecutionPlan,
  operationId: string,
) {
  return Object.freeze({
    frontProvider: plan.provider,
    delegationNeed: "none",
    delegationReason:
      "front_can_complete_without_specialized_or_independent_child",
    requestedExecutorProvider: plan.provider,
    requestedProfileId: plan.profileId,
    subjectProvider: null,
    requiresIndependentProvider: false,
    role: "coordinator",
    workClass: "diagnosis",
    planState: "complete",
    risk: "low",
    difficulty: "medium",
    decisionImpact: "material",
    isLocalCandidateOnly: false,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: true,
    operationId,
    parentOperationId: null,
    ancestorOperationIds: Object.freeze([]),
    delegationDepth: 0,
  });
}

async function createProductionOperation(): Promise<Operation> {
  let operation: Operation;
  try {
    operation = createRuntimeOwnedCoordinatorOperation() as Operation;
  } catch (error) {
    const creation =
      classifyOwnedOperationDirectoryCreationFailure(error) ??
      classifyOwnedCoordinatorOperationCreationFailure(error);
    if (!creation?.cleanupConfirmed) poisonRuntimeProcessAfterCleanupUnknown();
    throw new AdviceRuntimeError(
      creation?.cleanupConfirmed
        ? "workbench_ai_advice_operation_initialization_failed_cleanup_confirmed"
        : "workbench_ai_advice_operation_initialization_cleanup_unknown_process_restart_required",
    );
  }
  try {
    const activation = await activateOwnedHostOperationGenerationLock(
      operation.managementCapability,
    );
    if (activation !== "activated") throw new Error("activation_failed");
    const readiness = await confirmOwnedHostOperationGenerationLockReadiness(
      operation.managementCapability,
    );
    if (readiness !== "ready") throw new Error("readiness_failed");
    const loss = observeOwnedHostOperationGenerationLoss(
      operation.managementCapability,
    );
    return Object.freeze({
      ...operation,
      hostGenerationFailureDetected: loss.detected,
      hostGenerationLoss: loss.outcome,
      releaseHostGenerationDrain: loss.releaseDrain,
    });
  } catch {
    let cleanupConfirmed = false;
    try {
      cleanupConfirmed =
        verifyOwnedOperationCleanupOutcome(
          await cleanupOwnedOperationDirectoriesAsync(operation.owned),
        ) !== null;
    } catch {}
    if (!cleanupConfirmed) poisonRuntimeProcessAfterCleanupUnknown();
    throw new AdviceRuntimeError(
      cleanupConfirmed
        ? "workbench_ai_advice_host_generation_lock_unavailable_cleanup_confirmed"
        : "workbench_ai_advice_host_generation_lock_cleanup_unknown_process_restart_required",
    );
  }
}

const productionDependencies: WorkbenchAiAdviceRuntimeDependencies =
  Object.freeze({
    consumeVerifiedPackage:
      consumeRuntimeOwnedVerifiedCoordinatorPackageCapability,
    createOperation: createProductionOperation,
    observeProviderHome: inspectRuntimeOwnedWindowsProviderHomeCandidate,
    issueMountGrant: issueRuntimeOwnedProviderHomeMountGrant,
    consumeMountGrant: consumeRuntimeOwnedProviderHomeMountGrant,
    revokeMountGrant: revokeRuntimeOwnedProviderHomeMountGrant,
    issueSelection: issueRuntimeOwnedDelegationSelectionGrant,
    revokeSelection: revokeRuntimeOwnedDelegationSelectionGrant,
    issuePacket: issueRuntimeOwnedWorkbenchAiAdvicePacket,
    revokePacket: revokeRuntimeOwnedWorkbenchAiAdvicePacket,
    prepareCodex: prepareRuntimeOwnedCodexDockerAdviceCandidate,
    prepareClaude: prepareRuntimeOwnedClaudeDockerAdviceCandidate,
    startProcess: startRuntimeOwnedDockerProcessController,
    cancelProcess: cancelRuntimeOwnedDockerProcessController,
    prepareDockerHostCleanup: prepareRuntimeOwnedDockerHostCleanup,
    cleanupOperation: cleanupOwnedOperationDirectoriesAsync,
    classifyOperationCleanup: verifyOwnedOperationCleanupOutcome,
    recordDockerHostCleanupReceipt: recordRuntimeOwnedDockerHostCleanupReceipt,
    finalizeDockerRecovery: finalizeRuntimeOwnedDockerRecovery,
    abandonDockerRecovery: abandonRuntimeOwnedDockerRecovery,
    abandonOperation: abandonOwnedHostOperationGenerationLock,
    poisonAfterCleanupUnknown: poisonRuntimeProcessAfterCleanupUnknown,
  });

function objectValue(value: unknown): object | null {
  return value !== null && typeof value === "object" ? value : null;
}

function recordValue(value: unknown): RuntimeRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RuntimeRecord)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function blocked(
  reason: string,
  providerEffectIssued: boolean,
  cleanupConfirmed: boolean,
): WorkbenchAiAdviceRuntimeResult {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    adviceJson: null,
    providerEffectIssued,
    cleanupConfirmed,
  });
}
