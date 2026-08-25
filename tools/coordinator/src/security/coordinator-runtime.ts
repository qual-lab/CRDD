import { types as utilTypes } from "node:util";

import { prepareRuntimeOwnedClaudeDockerCandidate } from "./claude-docker-runtime-adapter.ts";
import { prepareRuntimeOwnedCodexDockerCandidate } from "./codex-docker-runtime-adapter.ts";
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
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  verifyOwnedOperationManagementCapability,
} from "./execution-environment.ts";
import {
  consumeRuntimeOwnedProviderHomeMountGrant,
  issueRuntimeOwnedProviderHomeMountGrant,
  revokeRuntimeOwnedProviderHomeMountGrant,
} from "./provider-home-mount-grant-runtime.ts";
import { inspectRuntimeOwnedWindowsProviderHomeCandidate } from "./provider-home-windows-adapter.ts";
import {
  bindRuntimeOwnedRepositoryOperation,
  inspectRepositoryObjectFormatCandidate,
} from "./repository-operation-runtime.ts";

export const COORDINATOR_RUNTIME_CONTRACT = "crdd-coordinator/runtime";
export const COORDINATOR_RUNTIME_CONTRACT_REVISION = 4;

const REQUEST_KEYS = new Set([
  "frontProvider",
  "delegationNeed",
  "delegationReason",
  "requestedExecutorProvider",
  "subjectProvider",
  "requiresIndependentProvider",
  "role",
  "workClass",
  "planState",
  "risk",
  "difficulty",
  "decisionImpact",
  "isLocalCandidateOnly",
  "hasUnresolvedDirection",
  "requiresCrossContextAlignment",
]);

type RuntimeDependencies = Readonly<{
  inspectRepository: (
    repositoryRoot: string,
  ) => Readonly<{ status: string; runtimeSupported: boolean }> | null;
  createOperation: () => Readonly<{
    owned: object;
    mountCapability: object;
    managementCapability: object;
    operationId: string;
  }>;
  cleanupOperation: (owned: object) => void;
  bindRepository: (
    managementCapability: object,
    repositoryRoot: string,
  ) => Readonly<{ repositoryBound: true }> | null;
  issueSelection: (
    managementCapability: object,
    request: unknown,
  ) => Readonly<{
    status: string;
    executorProvider: string | null;
    profileId: string | null;
    selectionNotice: string | null;
    controlCapability: object | null;
    useCapability: object | null;
  }>;
  revokeSelection: (
    controlCapability: object,
    managementCapability: object,
  ) => Readonly<{ status: string }>;
  observeProviderHome: (
    provider: "codex" | "claude",
    evaluationTime: unknown,
  ) => Readonly<{
    status: string;
    observationCapability?: object | null;
  }>;
  issueMountGrant: (
    managementCapability: object,
    observationCapability: object,
    profileId: string,
  ) => Readonly<{
    status: string;
    controlCapability?: object | null;
    useCapability?: object | null;
  }>;
  consumeMountGrant: (
    useCapability: object,
    managementCapability: object,
    observationCapability: object,
  ) => Readonly<{
    status: string;
    mountAuthorizationCapability?: object | null;
  }>;
  revokeMountGrant: (
    controlCapability: object,
    managementCapability: object,
  ) => Readonly<{ status: string }>;
  prepareProvider: (
    provider: "codex" | "claude",
    managementCapability: object,
    mountCapability: object,
    mountAuthorizationCapability: object,
    selectionUseCapability: object,
  ) => Readonly<{
    status: string;
    preparedCapability?: object | null;
    selectionNotice?: string | null;
  }>;
  startProcess: (
    preparedCapability: object,
    managementCapability: object,
    registerRecoveryHandoff: (
      recoveryCapability: unknown,
      recoveryId: unknown,
    ) => boolean,
  ) => Readonly<{
    status: string;
    reason: string;
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    controlCapability: object | null;
    completion: Promise<unknown> | null;
  }>;
  cancelProcess: (
    controlCapability: object,
    managementCapability: object,
  ) => Promise<unknown>;
  abandonDockerRecovery: (recoveryCapability: object) => boolean;
  prepareDockerHostCleanup: (recoveryCapability: object) => string | null;
  recordDockerHostCleanupReceipt: (recoveryCapability: object) => boolean;
  finalizeDockerRecovery: (recoveryCapability: object) => Readonly<{
    status: string;
  }>;
}>;

type ControlRecord = Readonly<{
  processControlCapability: object;
  managementCapability: object;
}>;

type RuntimeState = Readonly<{
  dependencies: RuntimeDependencies;
  controls: WeakMap<object, ControlRecord>;
}>;

function blocked(reason: string, manualRecoveryRequired = false) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    controlCapability: null,
    completion: null,
    operationStarted: false,
    providerEffectStarted: false,
    cleanupConfirmed: !manualRecoveryRequired,
    manualRecoveryRequired,
    selectionNotice: null,
    normalizedResult: null,
    rawOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
  });
}

function snapshotRequest(value: unknown) {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      utilTypes.isProxy(value) ||
      Array.isArray(value)
    ) {
      return null;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length !== REQUEST_KEYS.size ||
      keys.some((key) => typeof key !== "string" || !REQUEST_KEYS.has(key))
    ) {
      return null;
    }
    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of REQUEST_KEYS) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      ) {
        return null;
      }
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function rootSelectionRequest(
  request: Readonly<Record<string, unknown>>,
  operationId: string,
) {
  return Object.freeze({
    ...request,
    operationId,
    parentOperationId: null,
    ancestorOperationIds: Object.freeze([]),
    delegationDepth: 0,
  });
}

function cleanupBeforeEffect(
  state: RuntimeState,
  owned: object,
  selectionControl: object | null,
  mountControl: object | null,
  managementCapability: object,
  reason: string,
) {
  try {
    if (
      mountControl &&
      state.dependencies.revokeMountGrant(mountControl, managementCapability)
        .status !== "revoked"
    ) {
      throw new Error("mount_grant_revocation_unconfirmed");
    }
    if (
      selectionControl &&
      state.dependencies.revokeSelection(selectionControl, managementCapability)
        .status !== "revoked"
    ) {
      throw new Error("selection_grant_revocation_unconfirmed");
    }
    state.dependencies.cleanupOperation(owned);
    return blocked(reason);
  } catch {
    return blocked("coordinator_runtime_pre_effect_cleanup_unconfirmed", true);
  }
}

function start(
  state: RuntimeState,
  rawRequest: unknown,
  repositoryRoot: unknown,
  evaluationTime: unknown,
) {
  const request = snapshotRequest(rawRequest);
  if (
    !request ||
    typeof repositoryRoot !== "string" ||
    repositoryRoot.length === 0
  ) {
    return blocked("coordinator_runtime_request_invalid");
  }
  const repositoryPreflight =
    state.dependencies.inspectRepository(repositoryRoot);
  if (repositoryPreflight?.status !== "candidate") {
    return blocked("coordinator_runtime_repository_preflight_failed");
  }
  if (repositoryPreflight.runtimeSupported !== true) {
    return blocked("coordinator_runtime_git_object_format_unsupported");
  }
  let operation: ReturnType<RuntimeDependencies["createOperation"]>;
  try {
    operation = state.dependencies.createOperation();
  } catch {
    return blocked("coordinator_runtime_operation_creation_failed");
  }
  const { owned, mountCapability, managementCapability, operationId } =
    operation;
  let selectionControl: object | null = null;
  let mountControl: object | null = null;
  try {
    const repository = state.dependencies.bindRepository(
      managementCapability,
      repositoryRoot,
    );
    if (!repository) {
      return cleanupBeforeEffect(
        state,
        owned,
        null,
        null,
        managementCapability,
        "coordinator_runtime_repository_binding_failed",
      );
    }
    const selection = state.dependencies.issueSelection(
      managementCapability,
      rootSelectionRequest(request, operationId),
    );
    if (
      selection.status !== "issued" ||
      (selection.executorProvider !== "codex" &&
        selection.executorProvider !== "claude") ||
      typeof selection.profileId !== "string" ||
      !selection.controlCapability ||
      !selection.useCapability
    ) {
      return cleanupBeforeEffect(
        state,
        owned,
        null,
        null,
        managementCapability,
        "coordinator_runtime_provider_selection_failed",
      );
    }
    selectionControl = selection.controlCapability;
    const executorProvider = selection.executorProvider;
    const firstObservation = state.dependencies.observeProviderHome(
      executorProvider,
      evaluationTime,
    );
    if (
      firstObservation.status !== "candidate" ||
      !firstObservation.observationCapability
    ) {
      return cleanupBeforeEffect(
        state,
        owned,
        selectionControl,
        null,
        managementCapability,
        "coordinator_runtime_provider_home_observation_failed",
      );
    }
    const mountGrant = state.dependencies.issueMountGrant(
      managementCapability,
      firstObservation.observationCapability,
      selection.profileId,
    );
    if (
      mountGrant.status !== "issued" ||
      !mountGrant.controlCapability ||
      !mountGrant.useCapability
    ) {
      return cleanupBeforeEffect(
        state,
        owned,
        selectionControl,
        null,
        managementCapability,
        "coordinator_runtime_mount_grant_issue_failed",
      );
    }
    mountControl = mountGrant.controlCapability;
    const currentObservation = state.dependencies.observeProviderHome(
      executorProvider,
      evaluationTime,
    );
    if (
      currentObservation.status !== "candidate" ||
      !currentObservation.observationCapability
    ) {
      return cleanupBeforeEffect(
        state,
        owned,
        selectionControl,
        mountControl,
        managementCapability,
        "coordinator_runtime_provider_home_reobservation_failed",
      );
    }
    const consumedMount = state.dependencies.consumeMountGrant(
      mountGrant.useCapability,
      managementCapability,
      currentObservation.observationCapability,
    );
    if (
      consumedMount.status !== "consumed" ||
      !consumedMount.mountAuthorizationCapability
    ) {
      return cleanupBeforeEffect(
        state,
        owned,
        selectionControl,
        mountControl,
        managementCapability,
        "coordinator_runtime_mount_grant_consume_failed",
      );
    }
    const prepared = state.dependencies.prepareProvider(
      executorProvider,
      managementCapability,
      mountCapability,
      consumedMount.mountAuthorizationCapability,
      selection.useCapability,
    );
    selectionControl = null;
    mountControl = null;
    if (prepared.status !== "prepared" || !prepared.preparedCapability) {
      return cleanupBeforeEffect(
        state,
        owned,
        null,
        null,
        managementCapability,
        "coordinator_runtime_provider_prepare_failed",
      );
    }
    let recoveryHandoffCapability: object | null = null;
    let recoveryHandoffId: string | null = null;
    const process = state.dependencies.startProcess(
      prepared.preparedCapability,
      managementCapability,
      (recoveryCapability, recoveryId) => {
        if (
          recoveryHandoffCapability ||
          !recoveryCapability ||
          typeof recoveryCapability !== "object" ||
          typeof recoveryId !== "string" ||
          !recoveryId
        )
          return false;
        recoveryHandoffCapability = recoveryCapability;
        recoveryHandoffId = recoveryId;
        return true;
      },
    );
    if (
      process.status !== "started" ||
      !process.controlCapability ||
      !process.completion
    ) {
      if (recoveryHandoffCapability)
        void state.dependencies.abandonDockerRecovery(
          recoveryHandoffCapability,
        );
      return process.cleanupConfirmed === true
        ? cleanupBeforeEffect(
            state,
            owned,
            null,
            null,
            managementCapability,
            process.reason || "coordinator_runtime_process_start_failed",
          )
        : blocked(
            process.reason || "coordinator_runtime_process_start_failed",
            true,
          );
    }
    const controlCapability = Object.freeze({});
    state.controls.set(
      controlCapability,
      Object.freeze({
        processControlCapability: process.controlCapability,
        managementCapability,
      }),
    );
    const completion = process.completion
      .then((rawResult) => {
        const result = rawResult as Readonly<{
          status?: string;
          reason?: string;
          cleanupConfirmed?: boolean;
          manualRecoveryRequired?: boolean;
          normalizedResult?: unknown;
          recoveryFinalizationCapability?: object | null;
        }>;
        if (result.cleanupConfirmed !== true) {
          if (recoveryHandoffCapability)
            void state.dependencies.abandonDockerRecovery(
              recoveryHandoffCapability,
            );
          return result;
        }
        try {
          if (
            !recoveryHandoffCapability ||
            !recoveryHandoffId ||
            result.recoveryFinalizationCapability !==
              recoveryHandoffCapability ||
            !state.dependencies.prepareDockerHostCleanup(
              recoveryHandoffCapability,
            )
          )
            throw new Error("coordinator_runtime_recovery_handoff_invalid");
          state.dependencies.cleanupOperation(owned);
          if (
            !state.dependencies.recordDockerHostCleanupReceipt(
              recoveryHandoffCapability,
            ) ||
            state.dependencies.finalizeDockerRecovery(recoveryHandoffCapability)
              .status !== "completed"
          )
            throw new Error("coordinator_runtime_recovery_finalize_failed");
          return Object.freeze({
            ...result,
            operationRootRemoved: true,
            selectionNotice:
              prepared.selectionNotice ?? selection.selectionNotice,
            rawOutputReported: false,
            hostPathReported: false,
            credentialReported: false,
          });
        } catch {
          if (recoveryHandoffCapability)
            void state.dependencies.abandonDockerRecovery(
              recoveryHandoffCapability,
            );
          return Object.freeze({
            status: "blocked" as const,
            reason: "coordinator_runtime_operation_cleanup_unconfirmed",
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            normalizedResult: null,
            operationRootRemoved: false,
            dockerRecoveryId: recoveryHandoffId,
            dockerRecoveryIds: recoveryHandoffId
              ? Object.freeze([recoveryHandoffId])
              : Object.freeze([]),
            rawOutputReported: false,
            hostPathReported: false,
            credentialReported: false,
          });
        }
      })
      .finally(() => state.controls.delete(controlCapability));
    return Object.freeze({
      status: "started" as const,
      reason: "coordinator_runtime_provider_probe_started",
      controlCapability,
      completion,
      operationStarted: true,
      providerEffectStarted: true,
      cleanupConfirmed: false,
      manualRecoveryRequired: false,
      selectionNotice: prepared.selectionNotice ?? selection.selectionNotice,
      normalizedResult: null,
      rawOutputReported: false,
      hostPathReported: false,
      credentialReported: false,
    });
  } catch {
    return cleanupBeforeEffect(
      state,
      owned,
      selectionControl,
      mountControl,
      managementCapability,
      "coordinator_runtime_start_failed_closed",
    );
  }
}

function createProductionOperation() {
  const owned = createOwnedOperationDirectories();
  const contextCapability = createOwnedOperationContextCapability(owned);
  const mountCapability = createOwnedMountCapability(owned);
  const managementCapability = createOwnedOperationManagementCapability(
    contextCapability,
    mountCapability,
  );
  const operation =
    verifyOwnedOperationManagementCapability(managementCapability);
  return Object.freeze({
    owned,
    mountCapability,
    managementCapability,
    operationId: operation.operationId,
  });
}

const productionState: RuntimeState = Object.freeze({
  dependencies: Object.freeze({
    inspectRepository: inspectRepositoryObjectFormatCandidate,
    createOperation: createProductionOperation,
    cleanupOperation: cleanupOwnedOperationDirectories,
    bindRepository: bindRuntimeOwnedRepositoryOperation,
    issueSelection: issueRuntimeOwnedDelegationSelectionGrant,
    revokeSelection: revokeRuntimeOwnedDelegationSelectionGrant,
    observeProviderHome: inspectRuntimeOwnedWindowsProviderHomeCandidate,
    issueMountGrant: issueRuntimeOwnedProviderHomeMountGrant,
    consumeMountGrant: consumeRuntimeOwnedProviderHomeMountGrant,
    revokeMountGrant: revokeRuntimeOwnedProviderHomeMountGrant,
    prepareProvider: (
      provider: "codex" | "claude",
      managementCapability: object,
      mountCapability: object,
      mountAuthorizationCapability: object,
      selectionUseCapability: object,
    ) =>
      provider === "codex"
        ? prepareRuntimeOwnedCodexDockerCandidate(
            managementCapability,
            mountCapability,
            mountAuthorizationCapability,
            selectionUseCapability,
          )
        : prepareRuntimeOwnedClaudeDockerCandidate(
            managementCapability,
            mountCapability,
            mountAuthorizationCapability,
            selectionUseCapability,
          ),
    startProcess: startRuntimeOwnedDockerProcessController,
    cancelProcess: cancelRuntimeOwnedDockerProcessController,
    abandonDockerRecovery: abandonRuntimeOwnedDockerRecovery,
    prepareDockerHostCleanup: prepareRuntimeOwnedDockerHostCleanup,
    recordDockerHostCleanupReceipt: recordRuntimeOwnedDockerHostCleanupReceipt,
    finalizeDockerRecovery: finalizeRuntimeOwnedDockerRecovery,
  }),
  controls: new WeakMap(),
});

export function startRuntimeOwnedCoordinatorOperation(
  rawRequest: unknown,
  repositoryRoot: unknown,
  evaluationTime: unknown,
) {
  return start(productionState, rawRequest, repositoryRoot, evaluationTime);
}

export async function cancelRuntimeOwnedCoordinatorOperation(
  controlCapability: unknown,
) {
  if (!controlCapability || typeof controlCapability !== "object")
    return Object.freeze({ status: "blocked" as const, reason: "invalid" });
  const record = productionState.controls.get(controlCapability);
  if (!record)
    return Object.freeze({ status: "blocked" as const, reason: "invalid" });
  return productionState.dependencies.cancelProcess(
    record.processControlCapability,
    record.managementCapability,
  );
}

export function createIsolatedCoordinatorRuntimeCandidate(
  dependencies: RuntimeDependencies,
) {
  const state: RuntimeState = Object.freeze({
    dependencies: Object.freeze(dependencies),
    controls: new WeakMap(),
  });
  return Object.freeze({
    productionAuthority: false as const,
    start: (
      rawRequest: unknown,
      repositoryRoot: unknown,
      evaluationTime: unknown,
    ) => start(state, rawRequest, repositoryRoot, evaluationTime),
    cancel: async (controlCapability: unknown) => {
      if (!controlCapability || typeof controlCapability !== "object")
        return Object.freeze({ status: "blocked" as const, reason: "invalid" });
      const record = state.controls.get(controlCapability);
      if (!record)
        return Object.freeze({ status: "blocked" as const, reason: "invalid" });
      return state.dependencies.cancelProcess(
        record.processControlCapability,
        record.managementCapability,
      );
    },
  });
}

export function describeCoordinatorRuntimeContract() {
  return Object.freeze({
    contract: COORDINATOR_RUNTIME_CONTRACT,
    contractRevision: COORDINATOR_RUNTIME_CONTRACT_REVISION,
    currentVerticalSlice: "codex_and_claude_subscription_boolean_probe",
    repositoryBinding: "runtime_owned_exact_revision",
    repositoryObjectFormat:
      "sha1_only_preflight_before_operation_or_provider_effect",
    providerSelection: "coordinator_explainable_selection_grant",
    providerHome: "selected_user_observed_twice_mount_grant_single_use",
    authority: "signed_release_bound_local_personal",
    effect: "fixed_docker_process_controller",
    cancellation: "opaque_coordinator_capability",
    cleanup: "docker_then_mount_then_recovery_then_operation_root",
    directProviderSpawnAllowed: false,
    apiKeyFallbackAllowed: false,
    paidApiFallbackAllowed: false,
    canonicalRepositoryEffectAllowed: false,
    rawOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
  });
}
