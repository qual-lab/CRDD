import { types as utilTypes } from "node:util";
import {
  createDevelopmentExecutionTiming,
  writeDevelopmentMeasurementProgress,
} from "../core/development-execution-timing.ts";
import { evaluateManagedDockerCleanupEligibility } from "../core/docker-cleanup-eligibility.ts";
import {
  isRuntimeProcessEffectBlocked,
  isRuntimeProcessPoisoned,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../core/runtime-process-safety-state.ts";
import {
  discardRuntimeOwnedCandidateBundle,
  inspectRuntimeOwnedDevelopmentCandidateStore,
  publishRuntimeOwnedCandidateBundle,
  runRuntimeOwnedCandidateStoreStartupGc,
} from "./candidate-bundle-store.ts";
import { prepareRuntimeOwnedClaudeDockerTaskCandidate } from "./claude-docker-runtime-adapter.ts";
import { prepareRuntimeOwnedCodexDockerTaskCandidate } from "./codex-docker-runtime-adapter.ts";
import {
  classifyOwnedCoordinatorOperationCreationFailure,
  createRuntimeOwnedCoordinatorOperation,
} from "./coordinator-operation-creation-internal.ts";
import { snapshotCoordinatorTaskRequest } from "./coordinator-task-request.ts";
import {
  issueRuntimeOwnedDelegationSelectionGrant,
  preflightRuntimeOwnedDelegationExecutionSlate,
  revokeRuntimeOwnedDelegationSelectionGrant,
} from "./delegation-selection-grant-runtime.ts";
import { reserveRuntimeOwnedDevelopmentMeasurementTask } from "./development-measurement-session.ts";
import {
  cancelRuntimeOwnedDockerProcessController,
  projectDockerProcessControllerCompletionResult,
  projectDockerProcessControllerStartResult,
  startRuntimeOwnedDockerProcessController,
} from "./docker-process-controller.ts";
import {
  projectDockerRecoveryAdmission,
  publicVerifiedDockerRecoveryId,
} from "./docker-recovery-public-projection.ts";
import {
  abandonRuntimeOwnedDockerRecovery,
  finalizeRuntimeOwnedDockerRecovery,
  inspectRuntimeOwnedDockerTaskRecoveryState,
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
import { requestRuntimeOwnedExternalSendGrant } from "./external-send-grant-runtime.ts";
import { resolveRuntimeOwnedExternalSendPolicy } from "./external-send-policy-runtime.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import { consumeRuntimeOwnedVerifiedCoordinatorPackageCapability } from "./platform-provisioner-package-filesystem.ts";
import {
  consumeRuntimeOwnedProviderHomeMountGrant,
  issueRuntimeOwnedProviderHomeMountGrant,
  revokeRuntimeOwnedProviderHomeMountGrant,
} from "./provider-home-mount-grant-runtime.ts";
import { inspectRuntimeOwnedWindowsProviderHomeCandidate } from "./provider-home-windows-adapter.ts";
import {
  issueRuntimeOwnedProviderTaskPacket,
  revokeRuntimeOwnedProviderTaskPacket,
} from "./provider-task-packet-runtime.ts";
import {
  bindRuntimeOwnedRepositoryOperation,
  inspectRepositoryObjectFormatCandidate,
} from "./repository-operation-runtime.ts";
import {
  captureRuntimeOwnedCandidateRevision,
  materializeRuntimeOwnedRepositoryWorkspace,
  persistRuntimeOwnedCandidateRevision,
  verifyRuntimeOwnedCandidateRevision,
} from "./repository-workspace-runtime.ts";

export function projectRuntimeOwnedDockerProcessStartForTask(
  value: unknown,
  recoveryId: unknown,
  operationId: unknown,
) {
  return projectDockerProcessControllerStartResult(
    value,
    recoveryId,
    operationId,
  );
}

export function projectRuntimeOwnedDockerProcessCompletionForTask(
  value: unknown,
  recoveryId: unknown,
  operationId: unknown,
) {
  return projectDockerProcessControllerCompletionResult(
    value,
    recoveryId,
    operationId,
  );
}

export const COORDINATOR_TASK_RUNTIME_CONTRACT =
  "crdd-coordinator/task-runtime";
export const COORDINATOR_TASK_RUNTIME_CONTRACT_REVISION = 27;
const PRODUCTION_CANCELLATION_ACK_TIMEOUT_MS = 10_000;

const EXTERNAL_SEND_CONFIRMATION_REASONS = new Set([
  "external_send_confirmation_declined_invalid",
  "external_send_confirmation_cancelled",
  "external_send_confirmation_timeout",
  "external_send_confirmation_unavailable",
  "external_send_confirmation_reader_failed",
  "external_send_confirmation_cleanup_unknown",
  "external_send_confirmation_cleanup_unknown_process_restart_required",
  "external_send_consent_cleanup_unknown_process_restart_required",
  "external_send_consent_manual_recovery_required",
]);
const PROCESS_CANCELLATION_RESULT_KEYS = new Set([
  "status",
  "reason",
  "cancellationRequested",
  "processTerminationObserved",
]);
const INVALID_CONTROL_CANCELLATION_RESULT = Object.freeze({
  status: "blocked" as const,
  reason: "coordinator_task_control_invalid" as const,
});

type Provider = "codex" | "claude";
type TaskRole = "executor" | "reviewer";
type RuntimeLifecycleState =
  | "STATE-ADMISSION"
  | "STATE-OPERATION-ACQUIRING"
  | "STATE-OPERATION-READY"
  | "STATE-TASK-AUTHORIZED"
  | "STATE-EXECUTOR-CLEAN"
  | "STATE-CANDIDATE-CAPTURED"
  | "STATE-REVIEWER-CLEAN"
  | "STATE-REMEDIATION-AUTHORIZED"
  | "STATE-REMEDIATION-EXECUTOR-CLEAN"
  | "STATE-REMEDIATION-CANDIDATE-CAPTURED"
  | "STATE-REMEDIATION-REVIEWER-CLEAN"
  | "STATE-CANDIDATE-STAGED"
  | "STATE-HOST-CLEAN"
  | "STATE-RESULT-PUBLISHED"
  | "STATE-BLOCKED-CLEAN"
  | "STATE-PROCESS-RESTART-REQUIRED"
  | "STATE-RECOVERY-REQUIRED"
  | "STATE-OPERATOR-TRANSFER-REQUIRED";
type RuntimeRecord = Readonly<Record<string, unknown>>;
const INTERNAL_TASK_OUTCOME = Symbol("internalTaskOutcome");
type InternalTaskOutcome = Readonly<{
  [INTERNAL_TASK_OUTCOME]: true;
  publicResult: RuntimeRecord;
  dockerCleanupEligible: boolean;
}>;
type TaskCompletionRecord = RuntimeRecord &
  Readonly<{
    status: string;
    reason: string;
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
    hostRecoveryId: string | null;
    dockerRecoveryId: string | null;
    dockerRecoveryIds: readonly string[];
    candidateRecoveryId: string | null;
    candidateStoreRecoveryId: string | null;
    candidateRevision:
      | (RuntimeRecord & Readonly<{ changedPaths?: readonly string[] }>)
      | null;
    candidateId: string | null;
    expiresAtMs?: number | null;
    executorProvider: unknown;
    reviewerProvider: unknown;
    canonicalRepositoryChanged: boolean;
  }>;
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
type HostCleanupStatus = "completed" | "protocol_failure_cleanup_confirmed";
type ProductionOperationFailure = Readonly<{
  reason: string;
  hostRecoveryId: string | null;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
}>;
const productionOperationFailures = new WeakMap<
  object,
  ProductionOperationFailure
>();

function productionOperationFailure(error: unknown) {
  return error && typeof error === "object"
    ? (productionOperationFailures.get(error) ?? null)
    : null;
}

function throwProductionOperationFailure(
  details: ProductionOperationFailure,
): never {
  const error = new Error("coordinator_task_operation_creation_failed");
  productionOperationFailures.set(error, Object.freeze(details));
  throw error;
}

function createProductionOperationRoot(
  createOperation: () => Operation,
  poisonAfterCleanupUnknown: () => void,
) {
  try {
    return createOperation();
  } catch (error) {
    const creation =
      classifyOwnedOperationDirectoryCreationFailure(error) ??
      classifyOwnedCoordinatorOperationCreationFailure(error);
    if (!creation) throw error;
    if (!creation.cleanupConfirmed) poisonAfterCleanupUnknown();
    throwProductionOperationFailure(
      Object.freeze({
        reason: creation.cleanupConfirmed
          ? "coordinator_task_operation_initialization_failed_cleanup_confirmed"
          : "coordinator_task_operation_initialization_cleanup_unknown_process_restart_required",
        hostRecoveryId: creation.hostRecoveryId,
        cleanupConfirmed: creation.cleanupConfirmed,
        manualRecoveryRequired: creation.manualRecoveryRequired,
      }),
    );
  }
}

/** Test-only seam for the exact production operation-root failure wrapper. */
export function createIsolatedCoordinatorTaskOperationCreationCandidate(
  createOperation: () => Operation,
) {
  let isPoisoned = false;
  return Object.freeze({
    productionAuthority: false as const,
    create: () =>
      createProductionOperationRoot(createOperation, () => {
        isPoisoned = true;
      }),
    classify: productionOperationFailure,
    isProcessPoisoned: () => isPoisoned,
  });
}
type RuntimeDependencies = Readonly<{
  beginInvocation?: (
    provider: Provider,
    role: TaskRole,
  ) => Readonly<{
    commandRestriction: (purpose: string) => boolean;
    settle: () => void;
  }> | null;
  observeLifecycleState?: (state: RuntimeLifecycleState) => void;
  inspectRepository: (repositoryRoot: string) => RuntimeRecord | null;
  createOperation: () => Operation | Promise<Operation>;
  classifyOperationCreationFailure: (
    error: unknown,
  ) => ProductionOperationFailure | null;
  cleanupOperation: (owned: object) => unknown | Promise<unknown>;
  classifyOperationCleanup: (outcome: unknown) => HostCleanupStatus | null;
  abandonOperation: (managementCapability: object) => Promise<unknown>;
  poisonProcessAfterCleanupUnknown?: () => void;
  isProcessPoisoned?: () => boolean;
  bindRepository: (
    managementCapability: object,
    repositoryRoot: string,
  ) => RuntimeRecord | null;
  materializeWorkspace: (
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
    readPaths: readonly string[],
  ) => RuntimeRecord | null;
  issueSelection: (
    managementCapability: object,
    request: RuntimeRecord,
  ) => RuntimeRecord;
  preflightSlate: (
    managementCapability: object,
    request: RuntimeRecord,
  ) => RuntimeRecord;
  revokeSelection: (
    controlCapability: object,
    managementCapability: object,
  ) => RuntimeRecord;
  observeProviderHome: (
    provider: Provider,
    evaluationTime: unknown,
  ) => RuntimeRecord;
  issueMountGrant: (
    managementCapability: object,
    observationCapability: object,
    profileId: string,
  ) => RuntimeRecord;
  consumeMountGrant: (
    useCapability: object,
    managementCapability: object,
    observationCapability: object,
  ) => RuntimeRecord;
  revokeMountGrant: (
    controlCapability: object,
    managementCapability: object,
  ) => RuntimeRecord;
  authorizeExternalSend: (
    managementCapability: object,
    repositoryBindingCapability: object,
    policyCapability: object,
    scope: RuntimeRecord,
    providers: readonly Provider[],
    cancellationSignal: AbortSignal,
  ) => RuntimeRecord | null | Promise<RuntimeRecord | null>;
  resolveExternalSendPolicy: (
    managementCapability: object,
    repositoryBindingCapability: object,
  ) => RuntimeRecord | null;
  prepareCandidateStore: () => RuntimeRecord;
  prepareDockerRecoveryState: () => unknown;
  reportSelectionNotice: (notice: RuntimeRecord) => boolean;
  reportExternalSendNotice: (notice: RuntimeRecord) => boolean;
  issueTaskPacket: (
    managementCapability: object,
    repositoryBindingCapability: object,
    provider: Provider,
    taskRole: TaskRole,
    taskAttempt: 0 | 1,
    externalSendGrantCapability: object,
    remediationCapability: object | null,
    packet: RuntimeRecord,
  ) => RuntimeRecord | null;
  revokeTaskPacket: (
    controlCapability: object,
    managementCapability: object,
  ) => RuntimeRecord;
  prepareProvider: (
    provider: Provider,
    managementCapability: object,
    mountCapability: object,
    mountAuthorizationCapability: object,
    selectionUseCapability: object,
    taskPacketUseCapability: object,
  ) => RuntimeRecord;
  startProcess: (
    preparedCapability: object,
    managementCapability: object,
    registerRecoveryHandoff: (
      recoveryCapability: unknown,
      recoveryId: unknown,
    ) => boolean,
    commandRestriction?: unknown,
  ) => RuntimeRecord;
  cancelProcess: (
    controlCapability: object,
    managementCapability: object,
  ) => Promise<unknown>;
  captureCandidate: (
    workspaceCapability: object,
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
    allowedPaths: readonly string[],
  ) => RuntimeRecord | null;
  verifyCandidate: (
    candidateCapability: object,
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
  ) => RuntimeRecord | null;
  persistCandidate: (
    candidateCapability: object,
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
    persistencePolicy: RuntimeRecord,
  ) => RuntimeRecord | null;
  discardCandidate: (candidateId: string) => RuntimeRecord;
  publishCandidate: (candidateRecoveryId: string) => RuntimeRecord | null;
  finalizeDockerRecovery?: (capability: object) => RuntimeRecord;
  prepareDockerHostCleanup?: (capability: object) => string | null;
  recordDockerHostCleanupReceipt?: (capability: object) => boolean;
  abandonDockerRecovery?: (capability: object) => boolean;
  isolatedCancellationAckTimeoutMs?: number;
}>;
type ControlRecord = {
  lifecycleState: RuntimeLifecycleState;
  managementCapability: object;
  currentProcessControl: object | null;
  cancellationRequested: boolean;
  cancellationReceipt: Promise<RuntimeRecord> | null;
  cancellationSettlement: Promise<"confirmed" | "unknown"> | null;
  cancellationProtocolFailure: boolean;
  cancellationController: AbortController;
  ownedOperation: object | null;
  retainOperationRoot: boolean;
  processPoisoned: boolean;
  hostCleanupCompleted: boolean;
  hostRecoveryId: string | null;
  hostGenerationLossOutcome:
    | "cleanup_confirmed_failure"
    | "cleanup_unknown"
    | null;
  hostGenerationLoss: Promise<
    "cleanup_confirmed_failure" | "cleanup_unknown"
  > | null;
  hostGenerationLossHandling: Promise<void> | null;
  hostGenerationFailureHandling: Promise<void> | null;
  hostGenerationFailureObserved: boolean;
  releaseHostGenerationDrain: (() => boolean) | null;
  dockerFinalizations: Array<
    Readonly<{ capability: object; recoveryId: string }>
  >;
  dockerHandoffs: Array<{
    capability: object;
    recoveryId: string;
    state: "active" | "finalizable" | "finalized" | "abandoned";
  }>;
};
type RuntimeState = Readonly<{
  dependencies: RuntimeDependencies;
  controls: WeakMap<object, ControlRecord>;
}>;

function advanceLifecycleState(
  state: RuntimeState,
  control: ControlRecord,
  next: RuntimeLifecycleState,
) {
  if (control.lifecycleState === next) return;
  control.lifecycleState = next;
  try {
    state.dependencies.observeLifecycleState?.(next);
  } catch {
    // Passive observation must not gain control over Runtime state or Effect.
  }
}

export function classifyCoordinatorTaskTerminalLifecycleState(
  result: TaskCompletionRecord,
): RuntimeLifecycleState {
  const exactRecoveryAvailable =
    result.hostRecoveryId !== null ||
    result.dockerRecoveryIds.length > 0 ||
    result.candidateRecoveryId !== null ||
    result.candidateStoreRecoveryId !== null;
  if (
    result.manualRecoveryRequired === true ||
    result.cleanupConfirmed !== true ||
    exactRecoveryAvailable
  )
    return exactRecoveryAvailable
      ? ("STATE-RECOVERY-REQUIRED" as const)
      : ("STATE-OPERATOR-TRANSFER-REQUIRED" as const);
  if (result.processRestartRequired === true)
    return "STATE-PROCESS-RESTART-REQUIRED" as const;
  if (result.status === "completed") return "STATE-RESULT-PUBLISHED" as const;
  return "STATE-BLOCKED-CLEAN" as const;
}

function finalProjectionFailure(
  result: TaskCompletionRecord,
  control: ControlRecord,
) {
  const dockerRecoveryIds = Object.freeze([
    ...new Set([
      ...result.dockerRecoveryIds,
      ...controlDockerRecoveryIds(control),
    ]),
  ]);
  return Object.freeze({
    ...result,
    status: "blocked" as const,
    reason: "coordinator_task_final_projection_failed_closed",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: true,
    hostRecoveryId: result.hostRecoveryId ?? control.hostRecoveryId,
    dockerRecoveryId:
      dockerRecoveryIds.length === 1 ? (dockerRecoveryIds[0] ?? null) : null,
    dockerRecoveryIds,
  }) as TaskCompletionRecord;
}

function createBlocked(
  reason: string,
  manualRecoveryRequired = false,
  hostRecoveryId: string | null = null,
  dockerRecoveryId: string | null = null,
  candidateRecoveryId: string | null = null,
  isCleanupConfirmedOverride: boolean | null = null,
  candidateStoreRecoveryId: string | null = null,
  dockerRecoveryIds: readonly string[] = dockerRecoveryId
    ? [dockerRecoveryId]
    : [],
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    cleanupConfirmed:
      isCleanupConfirmedOverride === null
        ? !manualRecoveryRequired
        : isCleanupConfirmedOverride,
    manualRecoveryRequired,
    hostRecoveryId: manualRecoveryRequired ? hostRecoveryId : null,
    dockerRecoveryId: manualRecoveryRequired ? dockerRecoveryId : null,
    dockerRecoveryIds: manualRecoveryRequired
      ? Object.freeze([...new Set(dockerRecoveryIds)])
      : Object.freeze([]),
    candidateRecoveryId: manualRecoveryRequired ? candidateRecoveryId : null,
    candidateStoreRecoveryId: manualRecoveryRequired
      ? candidateStoreRecoveryId
      : null,
    executorProvider: null,
    reviewerProvider: null,
    executorSelectionNotice: null,
    reviewerSelectionNotice: null,
    candidateRevision: null,
    candidateId: null,
    executorResult: null,
    reviewerResult: null,
    canonicalRepositoryChanged: false,
    rawOutputReported: false,
    hostPathReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
  });
}

const blocked = createBlocked;

function objectCapability(value: unknown) {
  return value && typeof value === "object" ? (value as object) : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function snapshotRuntimeRecord(value: unknown): RuntimeRecord | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") return null;
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      )
        return null;
      snapshot[key] = descriptor.value;
    }
    if (
      typeof snapshot.status !== "string" ||
      typeof snapshot.reason !== "string"
    )
      return null;
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function exactProcessCancellationReceipt(value: unknown) {
  const receipt = snapshotPlainRecord(value, PROCESS_CANCELLATION_RESULT_KEYS);
  if (
    receipt?.status !== "requested" ||
    receipt.cancellationRequested !== true ||
    typeof receipt.processTerminationObserved !== "boolean" ||
    (receipt.processTerminationObserved === true &&
      receipt.reason !== "provider_cancellation_requested") ||
    (receipt.processTerminationObserved === false &&
      receipt.reason !== "provider_cancellation_grace_exceeded")
  )
    return null;
  return Object.freeze({ ...receipt });
}

function requestControlCancellation(
  state: RuntimeState,
  control: ControlRecord,
) {
  if (control.cancellationReceipt) return control.cancellationReceipt;
  control.cancellationRequested = true;
  control.cancellationController.abort();
  const processControl = control.currentProcessControl;
  const receipt = (async () => {
    if (!processControl)
      return Object.freeze({
        status: "requested" as const,
        reason: "provider_cancellation_requested",
        cancellationRequested: true,
        processTerminationObserved: true,
      });
    const observed = await state.dependencies.cancelProcess(
      processControl,
      control.managementCapability,
    );
    const receipt = exactProcessCancellationReceipt(observed);
    if (!receipt)
      throw new Error("coordinator_task_cancellation_receipt_invalid");
    return receipt;
  })();
  control.cancellationReceipt = receipt;
  const isolatedTimeout = state.dependencies.isolatedCancellationAckTimeoutMs;
  const timeoutMs =
    Number.isSafeInteger(isolatedTimeout) && Number(isolatedTimeout) > 0
      ? Number(isolatedTimeout)
      : PRODUCTION_CANCELLATION_ACK_TIMEOUT_MS;
  control.cancellationSettlement = new Promise<"confirmed" | "unknown">(
    (resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const settle = (outcome: "confirmed" | "unknown") => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        if (outcome === "unknown") {
          control.cancellationProtocolFailure = true;
          try {
            poisonRuntimeProcess(state, control);
          } catch {
            control.processPoisoned = true;
          }
        }
        resolve(outcome);
      };
      timeout = setTimeout(() => settle("unknown"), timeoutMs);
      try {
        Promise.prototype.then.call(
          receipt,
          () => settle("confirmed"),
          () => settle("unknown"),
        );
      } catch {
        settle("unknown");
      }
    },
  );
  return receipt;
}

function controlDockerRecoveryIds(control: ControlRecord) {
  return Object.freeze([
    ...new Set(
      control.dockerHandoffs
        .filter((handoff) => handoff.state !== "finalized")
        .map((handoff) => handoff.recoveryId),
    ),
  ]);
}

function actionableDockerRecoveryIds(
  control: ControlRecord,
  preferredRecoveryIds: readonly string[] = [],
) {
  return Object.freeze([
    ...new Set([...preferredRecoveryIds, ...controlDockerRecoveryIds(control)]),
  ]);
}

function canRunManagedDockerCleanup(
  result: RuntimeRecord,
  control: ControlRecord,
) {
  try {
    const singularDescriptor = Object.getOwnPropertyDescriptor(
      result,
      "dockerRecoveryId",
    );
    const pluralDescriptor = Object.getOwnPropertyDescriptor(
      result,
      "dockerRecoveryIds",
    );
    if (
      !singularDescriptor ||
      !("value" in singularDescriptor) ||
      !pluralDescriptor ||
      !("value" in pluralDescriptor)
    )
      return false;
    const handoffs = Object.freeze(
      control.dockerHandoffs.map((handoff) =>
        Object.freeze({
          state: handoff.state,
          recoveryId: handoff.recoveryId,
          capability: handoff.capability,
        }),
      ),
    );
    const finalizations = Object.freeze(
      control.dockerFinalizations.map((finalization) =>
        Object.freeze({
          recoveryId: finalization.recoveryId,
          capability: finalization.capability,
        }),
      ),
    );
    return evaluateManagedDockerCleanupEligibility({
      raw: Object.freeze({
        singularPresent: singularDescriptor !== undefined,
        singular: singularDescriptor?.value,
        pluralPresent: pluralDescriptor !== undefined,
        plural: pluralDescriptor?.value,
      }),
      handoffs,
      finalizations,
    }).eligible;
  } catch {
    return false;
  }
}

function poisonRuntimeProcess(state: RuntimeState, control: ControlRecord) {
  control.processPoisoned = true;
  state.dependencies.poisonProcessAfterCleanupUnknown?.();
}

function projectCurrentDockerRecovery<T extends RuntimeRecord>(
  result: T,
  control: ControlRecord,
) {
  const finalizedDockerRecoveryIds = new Set(
    control.dockerHandoffs
      .filter((handoff) => handoff.state === "finalized")
      .map((handoff) => handoff.recoveryId),
  );
  const hasExplicitNonDockerRecovery = Boolean(
    stringValue(result.hostRecoveryId) ||
      stringValue(result.candidateRecoveryId) ||
      stringValue(result.candidateStoreRecoveryId),
  );
  const rawDockerRecoveryIds = Array.isArray(result.dockerRecoveryIds)
    ? result.dockerRecoveryIds.filter(
        (value: unknown): value is string => typeof value === "string",
      )
    : [];
  const dockerRecoveryIds = Object.freeze([
    ...new Set(
      [
        ...rawDockerRecoveryIds,
        ...(stringValue(result.dockerRecoveryId)
          ? [String(result.dockerRecoveryId)]
          : []),
        ...controlDockerRecoveryIds(control),
      ].filter((value) => !finalizedDockerRecoveryIds.has(value)),
    ),
  ]);
  const hasRecoveryWithoutIdentifier =
    result.manualRecoveryRequired === true &&
    !hasExplicitNonDockerRecovery &&
    rawDockerRecoveryIds.length === 0 &&
    !stringValue(result.dockerRecoveryId);
  const manualRecoveryRequired =
    hasExplicitNonDockerRecovery ||
    dockerRecoveryIds.length > 0 ||
    hasRecoveryWithoutIdentifier;
  return Object.freeze({
    ...result,
    manualRecoveryRequired,
    cleanupConfirmed:
      manualRecoveryRequired === false
        ? true
        : result.cleanupConfirmed === true,
    dockerRecoveryId:
      dockerRecoveryIds.length === 1 ? dockerRecoveryIds[0] : null,
    dockerRecoveryIds,
  });
}

function selectionRequest(
  request: RuntimeRecord,
  operationId: string,
  role: "executor" | "independent_reviewer",
  subjectProvider: Provider | null,
  requestedProvider: Provider | null,
  isRequiresIndependentProvider: boolean,
) {
  const isIndependentReview = role === "independent_reviewer";
  return Object.freeze({
    frontProvider: request.frontProvider,
    delegationNeed: isIndependentReview ? "required" : "beneficial",
    delegationReason: isIndependentReview
      ? "independent_review_required"
      : "specialized_executor_benefit",
    requestedExecutorProvider: requestedProvider ?? "auto",
    subjectProvider,
    requiresIndependentProvider:
      isIndependentReview && isRequiresIndependentProvider,
    role,
    workClass: isIndependentReview ? "bounded_verification" : request.workClass,
    planState: isIndependentReview ? "complete" : request.planState,
    risk: request.risk,
    difficulty: request.difficulty,
    decisionImpact: request.decisionImpact,
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: isIndependentReview
      ? false
      : request.hasUnresolvedDirection,
    requiresCrossContextAlignment: isIndependentReview
      ? false
      : request.requiresCrossContextAlignment,
    operationId,
    parentOperationId: null,
    ancestorOperationIds: Object.freeze([]),
    delegationDepth: 0,
  });
}

function packetRequest(request: RuntimeRecord) {
  return Object.freeze({
    objective: request.objective,
    acceptanceCriteria: request.acceptanceCriteria,
    allowedPaths: request.allowedPaths,
    readPaths: request.readPaths,
  });
}

function samePaths(left: unknown, right: unknown) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const normalize = (values: unknown[]) =>
    values.every((value) => typeof value === "string")
      ? [...(values as string[])].sort((a, b) =>
          Buffer.from(a).compare(Buffer.from(b)),
        )
      : null;
  const normalizedLeftPaths = normalize(left);
  const normalizedRightPaths = normalize(right);
  return (
    normalizedLeftPaths !== null &&
    normalizedRightPaths !== null &&
    normalizedLeftPaths.length === normalizedRightPaths.length &&
    normalizedLeftPaths.every(
      (value, index) => value === normalizedRightPaths[index],
    )
  );
}

async function executeStage(...args: Parameters<typeof executeStageBody>) {
  const dependencies = args[0].dependencies;
  const invocation = dependencies.beginInvocation?.(args[9], args[6]);
  if (dependencies.beginInvocation && !invocation)
    return blocked("coordinator_task_development_invocation_not_authorized");
  args[12] = invocation?.commandRestriction;
  try {
    return await executeStageBody(...args);
  } finally {
    invocation?.settle();
  }
}

async function executeStageBody(
  state: RuntimeState,
  operation: Operation,
  request: RuntimeRecord,
  repositoryBindingCapability: object,
  externalSendGrantCapability: object,
  evaluationTime: unknown,
  role: TaskRole,
  taskAttempt: 0 | 1,
  subjectProvider: Provider | null,
  expectedProvider: Provider,
  remediationCapability: object | null,
  control: ControlRecord,
  commandRestriction?: unknown,
) {
  if (control.cancellationRequested) {
    return blocked("coordinator_task_cancelled_before_stage_start");
  }
  const selection = state.dependencies.issueSelection(
    operation.managementCapability,
    selectionRequest(
      request,
      operation.operationId,
      role === "executor" ? "executor" : "independent_reviewer",
      subjectProvider,
      role === "executor" &&
        (request.requestedExecutorProvider === "codex" ||
          request.requestedExecutorProvider === "claude")
        ? request.requestedExecutorProvider
        : role === "reviewer" && expectedProvider === subjectProvider
          ? expectedProvider
          : null,
      role === "reviewer" ? expectedProvider !== subjectProvider : false,
    ),
  );
  const provider =
    selection.executorProvider === "codex" ||
    selection.executorProvider === "claude"
      ? selection.executorProvider
      : null;
  const profileId = stringValue(selection.profileId);
  let selectionControl = objectCapability(selection.controlCapability);
  let startedProcessControl: object | null = null;
  let startedDockerRecoveryId: string | null = null;
  if (
    selection.status !== "issued" ||
    !provider ||
    !profileId ||
    !selectionControl ||
    !objectCapability(selection.useCapability)
  ) {
    return blocked("coordinator_task_selection_failed");
  }
  let mountControl: object | null = null;
  let taskControl: object | null = null;
  const revokeUnconsumed = () => {
    if (taskControl) {
      state.dependencies.revokeTaskPacket(
        taskControl,
        operation.managementCapability,
      );
    }
    if (mountControl) {
      state.dependencies.revokeMountGrant(
        mountControl,
        operation.managementCapability,
      );
    }
    if (selectionControl) {
      state.dependencies.revokeSelection(
        selectionControl,
        operation.managementCapability,
      );
    }
  };
  try {
    if (provider !== expectedProvider) {
      revokeUnconsumed();
      return blocked("coordinator_task_selection_slate_mismatch");
    }
    if (
      !state.dependencies.reportSelectionNotice(
        Object.freeze({
          event: "coordinator_selection_before_provider_effect",
          taskRole: role,
          provider,
          model: selection.selectedModel,
          effort: selection.selectedEffort,
          speedMode: selection.speedMode,
          selectionReason: selection.selectionNotice,
          inputBasis:
            "caller_declared_task_attributes_plus_runtime_owned_preselection_candidate_with_deferred_provider_preflight",
          callerDeclaredAttributes: Object.freeze([
            "workClass",
            "planState",
            "risk",
            "difficulty",
            "decisionImpact",
          ]),
          highCostSelectionAllowed: false,
        }),
      )
    ) {
      revokeUnconsumed();
      return blocked("coordinator_task_selection_notice_unavailable");
    }
    const first = state.dependencies.observeProviderHome(
      provider,
      evaluationTime,
    );
    const firstObservation = objectCapability(first.observationCapability);
    if (first.status !== "candidate" || !firstObservation) {
      revokeUnconsumed();
      return blocked("coordinator_task_provider_home_observation_failed");
    }
    const mount = state.dependencies.issueMountGrant(
      operation.managementCapability,
      firstObservation,
      profileId,
    );
    mountControl = objectCapability(mount.controlCapability);
    const mountUse = objectCapability(mount.useCapability);
    if (mount.status !== "issued" || !mountControl || !mountUse) {
      revokeUnconsumed();
      return blocked("coordinator_task_mount_grant_issue_failed");
    }
    const second = state.dependencies.observeProviderHome(
      provider,
      evaluationTime,
    );
    const secondObservation = objectCapability(second.observationCapability);
    if (second.status !== "candidate" || !secondObservation) {
      revokeUnconsumed();
      return blocked("coordinator_task_provider_home_reobservation_failed");
    }
    const consumedMount = state.dependencies.consumeMountGrant(
      mountUse,
      operation.managementCapability,
      secondObservation,
    );
    const mountAuthorization = objectCapability(
      consumedMount.mountAuthorizationCapability,
    );
    if (consumedMount.status !== "consumed" || !mountAuthorization) {
      revokeUnconsumed();
      return blocked("coordinator_task_mount_grant_consume_failed");
    }
    mountControl = null;
    const packet = state.dependencies.issueTaskPacket(
      operation.managementCapability,
      repositoryBindingCapability,
      provider,
      role,
      taskAttempt,
      externalSendGrantCapability,
      remediationCapability,
      packetRequest(request),
    );
    taskControl = objectCapability(packet?.controlCapability);
    const taskUse = objectCapability(packet?.useCapability);
    if (
      packet?.status === "blocked" &&
      packet.reason === "provider_task_packet_recognized_secret_rejected"
    ) {
      revokeUnconsumed();
      return blocked("coordinator_task_remediation_recognized_secret_rejected");
    }
    if (packet?.status !== "issued" || !taskControl || !taskUse) {
      revokeUnconsumed();
      return blocked("coordinator_task_packet_issue_failed");
    }
    const prepared = state.dependencies.prepareProvider(
      provider,
      operation.managementCapability,
      operation.mountCapability,
      mountAuthorization,
      selection.useCapability as object,
      taskUse,
    );
    selectionControl = null;
    taskControl = null;
    const preparedCapability = objectCapability(prepared.preparedCapability);
    if (prepared.status !== "prepared" || !preparedCapability) {
      return blocked(
        prepared.reason === "claude_task_workload_split_required"
          ? "coordinator_task_workload_split_required"
          : "coordinator_task_provider_prepare_failed",
      );
    }
    const rawProcess = state.dependencies.startProcess(
      preparedCapability,
      operation.managementCapability,
      (recoveryCapability, recoveryId) => {
        const capability = objectCapability(recoveryCapability);
        const id = publicVerifiedDockerRecoveryId(recoveryId);
        if (
          !capability ||
          !id ||
          control.dockerHandoffs.some(
            (handoff) =>
              handoff.capability === capability || handoff.recoveryId === id,
          )
        )
          return false;
        control.dockerHandoffs.push({
          capability,
          recoveryId: id,
          state: "active",
        });
        return true;
      },
      commandRestriction,
    );
    const isProductionProcessContract =
      state.dependencies.startProcess ===
      startRuntimeOwnedDockerProcessController;
    const process = (
      isProductionProcessContract
        ? projectRuntimeOwnedDockerProcessStartForTask(
            rawProcess,
            control.dockerHandoffs.at(-1)?.recoveryId ?? null,
            operation.operationId,
          )
        : rawProcess
    ) as RuntimeRecord | null;
    if (!process) {
      return blocked(
        "coordinator_task_process_start_contract_invalid",
        true,
        operation.hostRecoveryId,
        control.dockerHandoffs.at(-1)?.recoveryId ?? null,
      );
    }
    const processControl = objectCapability(process.controlCapability);
    const completion = process.completion;
    if (
      process.status !== "started" ||
      !processControl ||
      !(completion instanceof Promise)
    ) {
      const dockerRecoveryId = publicVerifiedDockerRecoveryId(
        process.recoveryId,
      );
      const manualRecoveryRequired =
        process.cleanupConfirmed !== true ||
        process.manualRecoveryRequired === true ||
        dockerRecoveryId !== null;
      return blocked(
        stringValue(process.reason) ?? "coordinator_task_process_start_failed",
        manualRecoveryRequired,
        manualRecoveryRequired ? operation.hostRecoveryId : null,
        dockerRecoveryId,
        null,
        process.cleanupConfirmed === true,
      );
    }
    control.currentProcessControl = processControl;
    startedProcessControl = processControl;
    startedDockerRecoveryId = publicVerifiedDockerRecoveryId(
      process.recoveryId,
    );
    if (control.cancellationRequested) {
      await state.dependencies.cancelProcess(
        processControl,
        operation.managementCapability,
      );
    }
    const rawResult = await completion;
    const result = isProductionProcessContract
      ? projectRuntimeOwnedDockerProcessCompletionForTask(
          rawResult,
          startedDockerRecoveryId,
          operation.operationId,
        )
      : (rawResult as RuntimeRecord);
    control.currentProcessControl = null;
    startedProcessControl = null;
    if (!result) {
      return blocked(
        "coordinator_task_process_completion_contract_invalid",
        true,
        operation.hostRecoveryId,
        startedDockerRecoveryId,
      );
    }
    const finalizationCapability = objectCapability(
      result.recoveryFinalizationCapability,
    );
    const handoff = control.dockerHandoffs.find(
      (candidate) => candidate.recoveryId === startedDockerRecoveryId,
    );
    if (result.cleanupConfirmed === true) {
      if (
        state.dependencies.finalizeDockerRecovery &&
        (!finalizationCapability ||
          !startedDockerRecoveryId ||
          !handoff ||
          handoff.capability !== finalizationCapability)
      ) {
        return blocked(
          "coordinator_task_docker_finalization_capability_missing",
          true,
          operation.hostRecoveryId,
          startedDockerRecoveryId,
        );
      }
      if (finalizationCapability && startedDockerRecoveryId) {
        if (handoff) handoff.state = "finalizable";
        control.dockerFinalizations.push(
          Object.freeze({
            capability: finalizationCapability,
            recoveryId: startedDockerRecoveryId,
          }),
        );
      } else if (!state.dependencies.finalizeDockerRecovery && handoff) {
        handoff.state = "finalized";
      }
    }
    if (control.cancellationRequested) {
      const dockerRecoveryIds = controlDockerRecoveryIds(control);
      return Object.freeze({
        ...blocked("coordinator_task_cancelled_after_provider_cleanup"),
        dockerRecoveryId:
          dockerRecoveryIds.length === 1
            ? (dockerRecoveryIds[0] ?? null)
            : null,
        dockerRecoveryIds,
      });
    }
    if (result.status !== "completed" || result.cleanupConfirmed !== true) {
      const dockerRecoveryId = publicVerifiedDockerRecoveryId(
        result.recoveryId,
      );
      const manualRecoveryRequired =
        result.cleanupConfirmed !== true ||
        result.manualRecoveryRequired === true ||
        dockerRecoveryId !== null;
      const dockerRecoveryIds = controlDockerRecoveryIds(control);
      return Object.freeze({
        ...blocked(
          stringValue(result.reason) ?? "coordinator_task_provider_failed",
          manualRecoveryRequired,
          manualRecoveryRequired ? operation.hostRecoveryId : null,
          dockerRecoveryId,
          null,
          result.cleanupConfirmed === true,
        ),
        dockerRecoveryId:
          manualRecoveryRequired && dockerRecoveryId
            ? dockerRecoveryId
            : dockerRecoveryIds.length === 1
              ? (dockerRecoveryIds[0] ?? null)
              : null,
        dockerRecoveryIds: manualRecoveryRequired
          ? Object.freeze([
              ...new Set([
                ...(dockerRecoveryId ? [dockerRecoveryId] : []),
                ...dockerRecoveryIds,
              ]),
            ])
          : dockerRecoveryIds,
      });
    }
    return Object.freeze({
      status: "completed" as const,
      provider,
      selectionNotice:
        stringValue(prepared.selectionNotice) ??
        stringValue(selection.selectionNotice),
      normalizedResult: result.normalizedResult,
    });
  } catch {
    if (startedProcessControl) {
      try {
        await state.dependencies.cancelProcess(
          startedProcessControl,
          operation.managementCapability,
        );
      } catch {
        // The process state is already unknowable. The result below retains the
        // operation root and requires explicit recovery regardless.
      }
      control.currentProcessControl = null;
      return blocked(
        "coordinator_task_process_completion_unconfirmed",
        true,
        operation.hostRecoveryId,
        startedDockerRecoveryId,
      );
    }
    revokeUnconsumed();
    return blocked("coordinator_task_stage_failed_closed");
  }
}

async function runCoordinatorTaskCore(
  state: RuntimeState,
  rawRequest: unknown,
  repositoryRoot: unknown,
  evaluationTime: unknown,
  control: ControlRecord,
) {
  const blocked = (...args: Parameters<typeof createBlocked>) => {
    const source = createBlocked(...args);
    const dockerRecoveryIds = [
      ...new Set([
        ...source.dockerRecoveryIds,
        ...controlDockerRecoveryIds(control),
      ]),
    ];
    const manualRecoveryRequired =
      source.manualRecoveryRequired === true || dockerRecoveryIds.length > 0;
    return createBlocked(
      String(source.reason),
      manualRecoveryRequired,
      stringValue(source.hostRecoveryId),
      dockerRecoveryIds.length === 1 ? (dockerRecoveryIds[0] ?? null) : null,
      stringValue(source.candidateRecoveryId),
      dockerRecoveryIds.length > 0 ? false : source.cleanupConfirmed === true,
      stringValue(source.candidateStoreRecoveryId),
      dockerRecoveryIds,
    );
  };
  const requestOutcome = snapshotCoordinatorTaskRequest(rawRequest);
  if (
    !requestOutcome ||
    typeof repositoryRoot !== "string" ||
    !repositoryRoot
  ) {
    return blocked("coordinator_task_request_invalid");
  }
  if (requestOutcome.status === "blocked") {
    return blocked(requestOutcome.reason);
  }
  const request = requestOutcome.request;
  const repositoryPreflight =
    state.dependencies.inspectRepository(repositoryRoot);
  if (repositoryPreflight?.status !== "candidate") {
    return blocked("coordinator_task_repository_preflight_failed");
  }
  if (repositoryPreflight.runtimeSupported !== true) {
    return blocked("coordinator_task_git_object_format_unsupported");
  }
  let dockerRecoveryState: unknown;
  try {
    dockerRecoveryState = state.dependencies.prepareDockerRecoveryState();
  } catch {
    dockerRecoveryState = null;
  }
  const admission = projectDockerRecoveryAdmission(dockerRecoveryState);
  if (admission.status !== "completed") {
    return blocked(
      admission.reason,
      true,
      null,
      admission.dockerRecoveryId,
      null,
      false,
      null,
      admission.dockerRecoveryIds,
    );
  }
  advanceLifecycleState(state, control, "STATE-OPERATION-ACQUIRING");
  let operation: Operation | null = null;
  let shouldRetainOperationRoot = false;
  try {
    operation = await state.dependencies.createOperation();
    control.ownedOperation = operation.owned;
    control.managementCapability = operation.managementCapability;
    control.hostRecoveryId = operation.hostRecoveryId;
    advanceLifecycleState(state, control, "STATE-OPERATION-READY");
    if (
      operation.hostGenerationFailureDetected &&
      operation.hostGenerationLoss
    ) {
      control.hostGenerationLoss = operation.hostGenerationLoss;
      control.hostGenerationFailureHandling =
        operation.hostGenerationFailureDetected.then(async () => {
          control.hostGenerationFailureObserved = true;
          const processControl = control.currentProcessControl;
          try {
            const cancellationResult = await requestControlCancellation(
              state,
              control,
            );
            if (processControl) {
              if (cancellationResult.processTerminationObserved !== true) {
                control.hostGenerationLossOutcome = "cleanup_unknown";
                poisonRuntimeProcess(state, control);
              }
            }
          } catch {
            control.hostGenerationLossOutcome = "cleanup_unknown";
            poisonRuntimeProcess(state, control);
          }
        });
      control.releaseHostGenerationDrain =
        operation.releaseHostGenerationDrain ?? null;
      control.hostGenerationLossHandling = operation.hostGenerationLoss.then(
        async (outcome) => {
          if (control.hostGenerationLossOutcome !== "cleanup_unknown")
            control.hostGenerationLossOutcome = outcome;
          if (control.hostGenerationFailureHandling)
            await control.hostGenerationFailureHandling;
        },
      );
    }
    if (control.cancellationRequested) {
      return blocked("coordinator_task_cancelled_during_operation_creation");
    }
    const repository = state.dependencies.bindRepository(
      operation.managementCapability,
      repositoryRoot,
    );
    const repositoryBinding = objectCapability(
      repository?.repositoryBindingCapability,
    );
    if (repository?.repositoryBound !== true || !repositoryBinding) {
      return blocked("coordinator_task_repository_binding_failed");
    }
    const externalSendPolicy = state.dependencies.resolveExternalSendPolicy(
      operation.managementCapability,
      repositoryBinding,
    );
    const externalSendPolicyCapability = objectCapability(
      externalSendPolicy?.capability,
    );
    if (
      externalSendPolicy?.status !== "resolved" ||
      !externalSendPolicyCapability
    ) {
      return blocked("coordinator_task_external_send_policy_unresolved");
    }
    if (
      externalSendPolicy.candidatePersistenceAllowed !== true ||
      !Number.isSafeInteger(externalSendPolicy.candidateRetentionHours) ||
      externalSendPolicy.candidatePhysicalDeletion !==
        "next_safe_runtime_entry_after_expiry_or_explicit_discard"
    ) {
      return blocked("coordinator_task_candidate_persistence_not_authorized");
    }
    const candidatePersistencePolicy = Object.freeze({
      candidatePersistenceAllowed:
        externalSendPolicy.candidatePersistenceAllowed === true,
      candidateRetentionHours: externalSendPolicy.candidateRetentionHours,
      informationClassification: externalSendPolicy.informationClassification,
      candidatePhysicalDeletion: externalSendPolicy.candidatePhysicalDeletion,
    });
    const slate = state.dependencies.preflightSlate(
      operation.managementCapability,
      selectionRequest(
        request,
        operation.operationId,
        "executor",
        null,
        request.requestedExecutorProvider === "codex" ||
          request.requestedExecutorProvider === "claude"
          ? request.requestedExecutorProvider
          : null,
        false,
      ),
    );
    const slateExecutorProvider =
      slate.executorProvider === "codex" || slate.executorProvider === "claude"
        ? slate.executorProvider
        : null;
    const slateReviewerProvider =
      slate.reviewerProvider === "codex" || slate.reviewerProvider === "claude"
        ? slate.reviewerProvider
        : null;
    const reviewerIndependence =
      slate.reviewerIndependence === "provider_independent" ||
      slate.reviewerIndependence === "execution_context_independent"
        ? slate.reviewerIndependence
        : null;
    if (
      slate.status !== "candidate" ||
      !slateExecutorProvider ||
      !slateReviewerProvider ||
      !reviewerIndependence ||
      ((request.requestedExecutorProvider === "codex" ||
        request.requestedExecutorProvider === "claude") &&
        slateExecutorProvider !== request.requestedExecutorProvider) ||
      slate.providerEffectAllowed !== false
    ) {
      return blocked("coordinator_task_execution_slate_unavailable");
    }
    const slateProviders: readonly Provider[] = Object.freeze(
      slateExecutorProvider === slateReviewerProvider
        ? [slateExecutorProvider]
        : [slateExecutorProvider, slateReviewerProvider],
    );
    const candidateStore = state.dependencies.prepareCandidateStore();
    if (candidateStore.status !== "completed") {
      return blocked(
        "coordinator_task_candidate_store_unavailable",
        candidateStore.manualRecoveryRequired === true,
        null,
        null,
        stringValue(candidateStore.candidateRecoveryId),
        null,
        stringValue(candidateStore.candidateStoreRecoveryId),
      );
    }
    const externalSendGrant = await state.dependencies.authorizeExternalSend(
      operation.managementCapability,
      repositoryBinding,
      externalSendPolicyCapability,
      packetRequest(request),
      slateProviders,
      control.cancellationController.signal,
    );
    if (control.cancellationRequested) {
      return blocked(
        "coordinator_task_cancelled_during_external_send_authorization",
      );
    }
    const externalSendGrantCapability = objectCapability(
      externalSendGrant?.capability,
    );
    if (
      externalSendGrant?.status !== "issued" ||
      !externalSendGrantCapability
    ) {
      const grantReason = stringValue(externalSendGrant?.reason);
      const reason =
        grantReason && EXTERNAL_SEND_CONFIRMATION_REASONS.has(grantReason)
          ? `coordinator_task_${grantReason}`
          : "coordinator_task_external_send_not_authorized";
      const manualRecoveryRequired =
        externalSendGrant?.manualRecoveryRequired === true;
      return blocked(reason, manualRecoveryRequired, null);
    }
    const externalSendAuthorizationMode = externalSendGrant.authorizationMode;
    if (
      externalSendAuthorizationMode !== "interactive_initial_consent" &&
      externalSendAuthorizationMode !== "reused_initial_consent"
    ) {
      return blocked(
        "coordinator_task_external_send_authorization_mode_invalid",
      );
    }
    const externalSendNotice = Object.freeze({
      event: "coordinator_external_send_authorized",
      authorizationMode: externalSendAuthorizationMode,
      providers: slateProviders,
      message:
        externalSendAuthorizationMode === "reused_initial_consent"
          ? "既存の送信許可の範囲内で続行します。追加の承認入力は不要です。"
          : "今回確認した送信許可の範囲内で続行します。",
    });
    let isNoticeReported = false;
    try {
      isNoticeReported =
        state.dependencies.reportExternalSendNotice(externalSendNotice) ===
        true;
    } catch {
      isNoticeReported = false;
    }
    if (!isNoticeReported) {
      return blocked("coordinator_task_external_send_notice_unavailable");
    }
    if (control.cancellationRequested) {
      return blocked(
        "coordinator_task_cancelled_during_external_send_authorization",
      );
    }
    const candidateNotIssued = (result: RuntimeRecord) =>
      Object.freeze({
        ...result,
        externalSendAuthorizationMode,
        candidateDisposition: "not_issued" as const,
      });
    const workspace = state.dependencies.materializeWorkspace(
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
      request.readPaths as readonly string[],
    );
    const workspaceCapability = objectCapability(
      workspace?.workspaceCapability,
    );
    if (workspace?.status !== "materialized" || !workspaceCapability) {
      return candidateNotIssued(
        blocked(
          workspace?.reason ===
            "repository_read_projection_recognized_secret_rejected"
            ? "coordinator_task_read_projection_recognized_secret_rejected"
            : "coordinator_task_workspace_materialization_failed",
        ),
      );
    }
    advanceLifecycleState(state, control, "STATE-TASK-AUTHORIZED");
    const executor = await executeStage(
      state,
      operation,
      request,
      repositoryBinding,
      externalSendGrantCapability,
      evaluationTime,
      "executor",
      0,
      null,
      slateExecutorProvider,
      null,
      control,
    );
    if (executor.status !== "completed") {
      shouldRetainOperationRoot = executor.manualRecoveryRequired === true;
      return candidateNotIssued(executor);
    }
    advanceLifecycleState(state, control, "STATE-EXECUTOR-CLEAN");
    if (control.cancellationRequested) {
      return candidateNotIssued(
        blocked("coordinator_task_cancelled_before_candidate_capture"),
      );
    }
    let finalExecutor = executor;
    let executorResult = executor.normalizedResult as RuntimeRecord;
    let candidate = state.dependencies.captureCandidate(
      workspaceCapability,
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
      request.allowedPaths as readonly string[],
    );
    let candidateCapability = objectCapability(candidate?.candidateCapability);
    if (
      candidate?.status !== "candidate" ||
      !candidateCapability ||
      executorResult?.status !== "completed" ||
      !samePaths(executorResult.changedPaths, candidate.changedPaths)
    ) {
      return candidateNotIssued(
        blocked(
          candidate?.reason === "candidate_recognized_secret_rejected"
            ? "coordinator_task_candidate_recognized_secret_rejected"
            : "coordinator_task_candidate_revision_invalid",
        ),
      );
    }
    advanceLifecycleState(state, control, "STATE-CANDIDATE-CAPTURED");
    if (control.cancellationRequested) {
      return candidateNotIssued(
        blocked("coordinator_task_cancelled_before_independent_review"),
      );
    }
    let reviewer = await executeStage(
      state,
      operation,
      request,
      repositoryBinding,
      externalSendGrantCapability,
      evaluationTime,
      "reviewer",
      0,
      executor.provider as Provider,
      slateReviewerProvider,
      null,
      control,
    );
    if (reviewer.status !== "completed") {
      shouldRetainOperationRoot = reviewer.manualRecoveryRequired === true;
      return candidateNotIssued(reviewer);
    }
    advanceLifecycleState(state, control, "STATE-REVIEWER-CLEAN");
    let reviewerResult = reviewer.normalizedResult as RuntimeRecord;
    let remediationPerformed = false;
    if (reviewerResult?.decision === "changes_requested") {
      advanceLifecycleState(state, control, "STATE-REMEDIATION-AUTHORIZED");
      const remediationCapability = objectCapability(
        reviewerResult.remediationCapability,
      );
      if (!remediationCapability || reviewerResult.findingCount === 0) {
        return candidateNotIssued(
          blocked("coordinator_task_review_remediation_invalid"),
        );
      }
      const remediation = await executeStage(
        state,
        operation,
        request,
        repositoryBinding,
        externalSendGrantCapability,
        evaluationTime,
        "executor",
        1,
        null,
        executor.provider as Provider,
        remediationCapability,
        control,
      );
      if (remediation.status !== "completed") {
        shouldRetainOperationRoot = remediation.manualRecoveryRequired === true;
        return candidateNotIssued(remediation);
      }
      advanceLifecycleState(state, control, "STATE-REMEDIATION-EXECUTOR-CLEAN");
      remediationPerformed = true;
      finalExecutor = remediation;
      executorResult = remediation.normalizedResult as RuntimeRecord;
      candidate = state.dependencies.captureCandidate(
        workspaceCapability,
        repositoryBinding,
        operation.managementCapability,
        operation.mountCapability,
        request.allowedPaths as readonly string[],
      );
      candidateCapability = objectCapability(candidate?.candidateCapability);
      if (
        candidate?.status !== "candidate" ||
        !candidateCapability ||
        executorResult?.status !== "completed" ||
        !samePaths(executorResult.changedPaths, candidate.changedPaths)
      ) {
        return candidateNotIssued(
          blocked(
            candidate?.reason === "candidate_recognized_secret_rejected"
              ? "coordinator_task_candidate_recognized_secret_rejected"
              : "coordinator_task_remediated_candidate_invalid",
          ),
        );
      }
      advanceLifecycleState(
        state,
        control,
        "STATE-REMEDIATION-CANDIDATE-CAPTURED",
      );
      reviewer = await executeStage(
        state,
        operation,
        request,
        repositoryBinding,
        externalSendGrantCapability,
        evaluationTime,
        "reviewer",
        1,
        executor.provider as Provider,
        reviewer.provider as Provider,
        null,
        control,
      );
      if (reviewer.status !== "completed") {
        shouldRetainOperationRoot = reviewer.manualRecoveryRequired === true;
        return candidateNotIssued(reviewer);
      }
      advanceLifecycleState(state, control, "STATE-REMEDIATION-REVIEWER-CLEAN");
      reviewerResult = reviewer.normalizedResult as RuntimeRecord;
    }
    const verified = state.dependencies.verifyCandidate(
      candidateCapability,
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
    );
    if (
      verified?.status !== "verified" ||
      reviewerResult?.decision !== "approved" ||
      reviewerResult.findingCount !== 0
    ) {
      return Object.freeze({
        ...blocked("coordinator_task_independent_review_not_approved"),
        externalSendAuthorizationMode,
        candidateDisposition: "not_issued" as const,
      });
    }
    const persisted = state.dependencies.persistCandidate(
      candidateCapability,
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
      candidatePersistencePolicy,
    );
    const candidateRecoveryId = stringValue(persisted?.candidateRecoveryId);
    const candidateStoreRecoveryId = stringValue(
      persisted?.candidateStoreRecoveryId,
    );
    if (persisted?.status !== "staged" || !candidateRecoveryId) {
      return blocked(
        "coordinator_task_candidate_persistence_failed",
        persisted?.manualRecoveryRequired === true ||
          candidateRecoveryId !== null ||
          candidateStoreRecoveryId !== null,
        null,
        null,
        candidateRecoveryId,
        null,
        candidateStoreRecoveryId,
      );
    }
    advanceLifecycleState(state, control, "STATE-CANDIDATE-STAGED");
    return Object.freeze({
      status: "completed" as const,
      reason: "coordinator_task_candidate_approved",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      hostRecoveryId: null,
      dockerRecoveryId:
        controlDockerRecoveryIds(control).length === 1
          ? (controlDockerRecoveryIds(control)[0] ?? null)
          : null,
      dockerRecoveryIds: controlDockerRecoveryIds(control),
      executorProvider: executor.provider,
      reviewerProvider: reviewer.provider,
      reviewerIndependence,
      externalSendAuthorizationMode,
      executorSelectionNotice: finalExecutor.selectionNotice,
      reviewerSelectionNotice: reviewer.selectionNotice,
      remediationPerformed,
      candidateRevision: Object.freeze({
        baseCommit: verified.baseCommit,
        baseTree: verified.baseTree,
        patchHash: verified.patchHash,
        contentManifestHash: verified.contentManifestHash,
        allowedPathsHash: verified.allowedPathsHash,
        changedPaths: verified.changedPaths,
      }),
      candidateId: null,
      candidateRecoveryId,
      candidateStoreRecoveryId: null,
      executorResult: Object.freeze({
        status: executorResult.status,
        changedPaths: Object.freeze([
          ...((executorResult.changedPaths as readonly string[]) ?? []),
        ]),
        verificationCount:
          typeof executorResult.verificationCount === "number"
            ? executorResult.verificationCount
            : 0,
      }),
      reviewerResult: Object.freeze({
        decision: reviewerResult.decision,
        findingCount:
          typeof reviewerResult.findingCount === "number"
            ? reviewerResult.findingCount
            : 0,
      }),
      canonicalRepositoryChanged: false,
      rawOutputReported: false,
      hostPathReported: false,
      untrustedProviderTextReported: false,
      credentialAbsenceVerified: false,
    });
  } catch (error) {
    const creationFailure =
      state.dependencies.classifyOperationCreationFailure(error);
    if (creationFailure) {
      shouldRetainOperationRoot = !creationFailure.cleanupConfirmed;
      return blocked(
        creationFailure.reason,
        creationFailure.manualRecoveryRequired,
        creationFailure.hostRecoveryId,
        null,
        null,
        creationFailure.cleanupConfirmed,
      );
    }
    shouldRetainOperationRoot = true;
    return blocked(
      "coordinator_task_failed_closed",
      true,
      operation?.hostRecoveryId ?? null,
    );
  } finally {
    control.retainOperationRoot = shouldRetainOperationRoot;
  }
}

async function runCoordinatorTask(
  state: RuntimeState,
  rawRequest: unknown,
  repositoryRoot: unknown,
  evaluationTime: unknown,
  control: ControlRecord,
): Promise<InternalTaskOutcome> {
  const rawResult = await runCoordinatorTaskCore(
    state,
    rawRequest,
    repositoryRoot,
    evaluationTime,
    control,
  );
  const snapshot = snapshotRuntimeRecord(rawResult);
  if (!snapshot)
    return Object.freeze({
      [INTERNAL_TASK_OUTCOME]: true as const,
      publicResult: blocked(
        "coordinator_task_result_observation_invalid",
        true,
        control.hostRecoveryId,
        null,
        null,
        false,
        null,
        controlDockerRecoveryIds(control),
      ),
      dockerCleanupEligible: false,
    });
  const dockerCleanupEligible = canRunManagedDockerCleanup(snapshot, control);
  const singularDescriptor = Object.getOwnPropertyDescriptor(
    snapshot,
    "dockerRecoveryId",
  );
  const pluralDescriptor = Object.getOwnPropertyDescriptor(
    snapshot,
    "dockerRecoveryIds",
  );
  const plural = pluralDescriptor
    ? snapshotPlainArray<unknown>(pluralDescriptor.value, 128)
    : null;
  const isProjectionInvalid =
    !singularDescriptor ||
    !("value" in singularDescriptor) ||
    (singularDescriptor.value !== null &&
      !publicVerifiedDockerRecoveryId(singularDescriptor.value)) ||
    !pluralDescriptor ||
    !("value" in pluralDescriptor) ||
    plural?.status !== "ok" ||
    plural.value.some((value) => !publicVerifiedDockerRecoveryId(value)) ||
    new Set(plural.value).size !== plural.value.length;
  const observedIds = Object.freeze([
    ...new Set([
      ...(plural?.status === "ok"
        ? plural.value.filter(
            (value): value is string =>
              publicVerifiedDockerRecoveryId(value) !== null,
          )
        : []),
      ...(singularDescriptor &&
      "value" in singularDescriptor &&
      publicVerifiedDockerRecoveryId(singularDescriptor.value)
        ? [publicVerifiedDockerRecoveryId(singularDescriptor.value) as string]
        : []),
    ]),
  ]);
  const ids = Object.freeze([
    ...new Set([...observedIds, ...controlDockerRecoveryIds(control)]),
  ]);
  const publicResult = isProjectionInvalid
    ? blocked(
        "coordinator_task_docker_recovery_projection_invalid",
        true,
        control.hostRecoveryId,
        null,
        stringValue(snapshot.candidateRecoveryId),
        false,
        stringValue(snapshot.candidateStoreRecoveryId),
        ids,
      )
    : Object.freeze({
        ...snapshot,
        dockerRecoveryId: ids.length === 1 ? (ids[0] ?? null) : null,
        dockerRecoveryIds: ids,
      });
  return Object.freeze({
    [INTERNAL_TASK_OUTCOME]: true as const,
    publicResult,
    dockerCleanupEligible:
      dockerCleanupEligible === true && isProjectionInvalid === false,
  });
}

async function createProductionOperation() {
  const operation = createProductionOperationRoot(
    createRuntimeOwnedCoordinatorOperation,
    poisonRuntimeProcessAfterCleanupUnknown,
  );
  const {
    owned,
    mountCapability,
    managementCapability,
    operationId,
    hostRecoveryId,
  } = operation;
  let failureReason = "coordinator_task_operation_creation_failed";
  try {
    const activation =
      await activateOwnedHostOperationGenerationLock(managementCapability);
    if (activation !== "activated") {
      failureReason =
        activation === "cleanup_unknown"
          ? "coordinator_task_host_generation_lock_cleanup_unknown_process_restart_required"
          : activation === "cleanup_confirmed_failure"
            ? "coordinator_task_host_generation_lock_start_failed_cleanup_confirmed"
            : "coordinator_task_host_generation_lock_unavailable";
      throw new Error(
        "coordinator_task_host_generation_lock_activation_failed",
      );
    }
    const readiness =
      await confirmOwnedHostOperationGenerationLockReadiness(
        managementCapability,
      );
    if (readiness !== "ready") {
      failureReason =
        readiness === "cleanup_unknown"
          ? "coordinator_task_host_generation_lock_cleanup_unknown_process_restart_required"
          : "coordinator_task_host_generation_lock_not_ready_cleanup_confirmed";
      throw new Error("coordinator_task_host_generation_lock_not_ready");
    }
    const hostGenerationLoss =
      observeOwnedHostOperationGenerationLoss(managementCapability);
    return Object.freeze({
      owned,
      mountCapability,
      managementCapability,
      operationId,
      hostRecoveryId,
      hostGenerationFailureDetected: hostGenerationLoss.detected,
      hostGenerationLoss: hostGenerationLoss.outcome,
      releaseHostGenerationDrain: hostGenerationLoss.releaseDrain,
    });
  } catch {
    let cleanupConfirmed = false;
    let manualRecoveryRequired = false;
    try {
      const cleanup = verifyOwnedOperationCleanupOutcome(
        await cleanupOwnedOperationDirectoriesAsync(owned),
      );
      if (!cleanup)
        throw new Error("owned_operation_cleanup_outcome_unverified");
      cleanupConfirmed = true;
      if (cleanup === "protocol_failure_cleanup_confirmed")
        failureReason =
          "coordinator_task_host_generation_lock_protocol_failed_cleanup_confirmed";
    } catch {
      manualRecoveryRequired = true;
      poisonRuntimeProcessAfterCleanupUnknown();
      failureReason =
        "coordinator_task_host_generation_lock_cleanup_unknown_process_restart_required";
    }
    throwProductionOperationFailure(
      Object.freeze({
        reason: failureReason,
        hostRecoveryId,
        cleanupConfirmed,
        manualRecoveryRequired,
      }),
    );
  }
}

const productionDependencies: RuntimeDependencies = Object.freeze({
  inspectRepository: inspectRepositoryObjectFormatCandidate,
  createOperation: createProductionOperation,
  classifyOperationCreationFailure: productionOperationFailure,
  cleanupOperation: cleanupOwnedOperationDirectoriesAsync,
  classifyOperationCleanup: verifyOwnedOperationCleanupOutcome,
  abandonOperation: abandonOwnedHostOperationGenerationLock,
  poisonProcessAfterCleanupUnknown: poisonRuntimeProcessAfterCleanupUnknown,
  isProcessPoisoned: isRuntimeProcessPoisoned,
  bindRepository: bindRuntimeOwnedRepositoryOperation,
  materializeWorkspace: materializeRuntimeOwnedRepositoryWorkspace,
  issueSelection: issueRuntimeOwnedDelegationSelectionGrant,
  preflightSlate: preflightRuntimeOwnedDelegationExecutionSlate,
  revokeSelection: revokeRuntimeOwnedDelegationSelectionGrant,
  observeProviderHome: inspectRuntimeOwnedWindowsProviderHomeCandidate,
  issueMountGrant: issueRuntimeOwnedProviderHomeMountGrant,
  consumeMountGrant: consumeRuntimeOwnedProviderHomeMountGrant,
  revokeMountGrant: revokeRuntimeOwnedProviderHomeMountGrant,
  authorizeExternalSend: requestRuntimeOwnedExternalSendGrant,
  resolveExternalSendPolicy: resolveRuntimeOwnedExternalSendPolicy,
  prepareCandidateStore: runRuntimeOwnedCandidateStoreStartupGc,
  prepareDockerRecoveryState: inspectRuntimeOwnedDockerTaskRecoveryState,
  reportSelectionNotice: (notice) => {
    try {
      process.stderr.write(
        `[Coordinator selection] ${JSON.stringify(notice)}\n`,
      );
      return true;
    } catch {
      return false;
    }
  },
  reportExternalSendNotice: (notice) => {
    try {
      process.stderr.write(
        `[Coordinator authorization] ${JSON.stringify(notice)}\n`,
      );
      return true;
    } catch {
      return false;
    }
  },
  issueTaskPacket: issueRuntimeOwnedProviderTaskPacket,
  revokeTaskPacket: revokeRuntimeOwnedProviderTaskPacket,
  prepareProvider: (
    provider,
    managementCapability,
    mountCapability,
    mountAuthorizationCapability,
    selectionUseCapability,
    taskPacketUseCapability,
  ) =>
    provider === "codex"
      ? prepareRuntimeOwnedCodexDockerTaskCandidate(
          managementCapability,
          mountCapability,
          mountAuthorizationCapability,
          selectionUseCapability,
          taskPacketUseCapability,
        )
      : prepareRuntimeOwnedClaudeDockerTaskCandidate(
          managementCapability,
          mountCapability,
          mountAuthorizationCapability,
          selectionUseCapability,
          taskPacketUseCapability,
        ),
  startProcess: startRuntimeOwnedDockerProcessController,
  cancelProcess: cancelRuntimeOwnedDockerProcessController,
  captureCandidate: captureRuntimeOwnedCandidateRevision,
  verifyCandidate: verifyRuntimeOwnedCandidateRevision,
  persistCandidate: persistRuntimeOwnedCandidateRevision,
  discardCandidate: discardRuntimeOwnedCandidateBundle,
  publishCandidate: publishRuntimeOwnedCandidateBundle,
  finalizeDockerRecovery: finalizeRuntimeOwnedDockerRecovery,
  prepareDockerHostCleanup: prepareRuntimeOwnedDockerHostCleanup,
  recordDockerHostCleanupReceipt: recordRuntimeOwnedDockerHostCleanupReceipt,
  abandonDockerRecovery: abandonRuntimeOwnedDockerRecovery,
});

async function retainRuntimeRecoveryState(
  state: RuntimeState,
  control: ControlRecord,
) {
  control.retainOperationRoot = !control.hostCleanupCompleted;
  for (const handoff of control.dockerHandoffs) {
    if (handoff.state === "finalized" || handoff.state === "abandoned")
      continue;
    if (state.dependencies.abandonDockerRecovery?.(handoff.capability) === true)
      handoff.state = "abandoned";
  }
  if (!control.hostCleanupCompleted)
    await state.dependencies.abandonOperation(control.managementCapability);
}

function createRuntime(dependencies: RuntimeDependencies) {
  const state: RuntimeState = Object.freeze({
    dependencies: Object.freeze(dependencies),
    controls: new WeakMap(),
  });
  return Object.freeze({
    start: (
      rawRequest: unknown,
      repositoryRoot: unknown,
      evaluationTime: unknown,
    ) => {
      const controlCapability = Object.freeze({});
      const control: ControlRecord = {
        lifecycleState: "STATE-ADMISSION",
        managementCapability: Object.freeze({}),
        currentProcessControl: null,
        cancellationRequested: false,
        cancellationReceipt: null,
        cancellationSettlement: null,
        cancellationProtocolFailure: false,
        cancellationController: new AbortController(),
        ownedOperation: null,
        retainOperationRoot: false,
        processPoisoned: false,
        hostCleanupCompleted: false,
        hostRecoveryId: null,
        hostGenerationLossOutcome: null,
        hostGenerationLoss: null,
        hostGenerationLossHandling: null,
        hostGenerationFailureHandling: null,
        hostGenerationFailureObserved: false,
        releaseHostGenerationDrain: null,
        dockerFinalizations: [],
        dockerHandoffs: [],
      };
      try {
        state.dependencies.observeLifecycleState?.("STATE-ADMISSION");
      } catch {
        // Passive observation must not gain control over Runtime admission.
      }
      state.controls.set(controlCapability, control);
      const completion: Promise<TaskCompletionRecord> = runCoordinatorTask(
        state,
        rawRequest,
        repositoryRoot,
        evaluationTime,
        control,
      )
        .then(async (outcome) => {
          if (outcome[INTERNAL_TASK_OUTCOME] !== true)
            throw new Error("coordinator_task_internal_outcome_invalid");
          const rawResultRecord = snapshotRuntimeRecord(outcome.publicResult);
          if (!rawResultRecord) {
            await retainRuntimeRecoveryState(state, control);
            return blocked(
              "coordinator_task_result_observation_invalid",
              true,
              control.hostRecoveryId,
              null,
              null,
              false,
              null,
              controlDockerRecoveryIds(control),
            );
          }
          const cleanupProjectionEligible = outcome.dockerCleanupEligible;
          const observedDockerRecoveryIds = snapshotPlainArray<string>(
            rawResultRecord.dockerRecoveryIds,
            128,
          );
          const projectedDockerRecoveryIds = Object.freeze(
            observedDockerRecoveryIds.status === "ok"
              ? [...observedDockerRecoveryIds.value]
              : [...controlDockerRecoveryIds(control)],
          );
          let result: RuntimeRecord = Object.freeze({
            ...rawResultRecord,
            dockerRecoveryId:
              projectedDockerRecoveryIds.length === 1
                ? projectedDockerRecoveryIds[0]
                : null,
            dockerRecoveryIds: projectedDockerRecoveryIds,
          });
          const settleObservedHostLoss = async () => {
            if (
              !control.hostGenerationFailureObserved ||
              !control.hostGenerationLossHandling
            )
              return null;
            await control.hostGenerationLossHandling;
            return control.hostGenerationLossOutcome;
          };
          if ((await settleObservedHostLoss()) !== null) {
            if (control.hostGenerationLossOutcome === "cleanup_unknown") {
              result = blocked(
                "coordinator_task_host_generation_lost_cleanup_unknown_process_restart_required",
                true,
                control.hostRecoveryId,
                stringValue(result.dockerRecoveryId),
                stringValue(result.candidateRecoveryId),
                false,
                stringValue(result.candidateStoreRecoveryId),
                projectedDockerRecoveryIds,
              );
            } else if (
              control.hostGenerationLossOutcome === "cleanup_confirmed_failure"
            ) {
              result = Object.freeze({
                ...blocked(
                  "coordinator_task_host_generation_lost_cleanup_confirmed",
                ),
                cleanupConfirmed: false,
                manualRecoveryRequired:
                  rawResultRecord.manualRecoveryRequired === true,
                hostRecoveryId: stringValue(rawResultRecord.hostRecoveryId),
                dockerRecoveryId:
                  projectedDockerRecoveryIds.length === 1
                    ? projectedDockerRecoveryIds[0]
                    : null,
                dockerRecoveryIds: projectedDockerRecoveryIds,
                candidateRecoveryId: stringValue(
                  rawResultRecord.candidateRecoveryId,
                ),
                candidateStoreRecoveryId: stringValue(
                  rawResultRecord.candidateStoreRecoveryId,
                ),
              });
            }
          }
          try {
            let isHostProtocolFailure =
              control.hostGenerationLossOutcome === "cleanup_confirmed_failure";
            control.retainOperationRoot ||=
              control.hostGenerationLossOutcome === "cleanup_unknown" ||
              !cleanupProjectionEligible;
            if (control.retainOperationRoot)
              await retainRuntimeRecoveryState(state, control);
            for (const finalization of state.dependencies
              .prepareDockerHostCleanup && !control.retainOperationRoot
              ? control.dockerFinalizations
              : []) {
              const hostRecoveryId =
                state.dependencies.prepareDockerHostCleanup?.(
                  finalization.capability,
                );
              if (!hostRecoveryId) {
                await retainRuntimeRecoveryState(state, control);
                return blocked(
                  "coordinator_task_host_cleanup_intent_unconfirmed",
                  true,
                  control.hostRecoveryId,
                  finalization.recoveryId,
                  stringValue(result.candidateRecoveryId),
                  false,
                  stringValue(result.candidateStoreRecoveryId),
                  actionableDockerRecoveryIds(control, [
                    finalization.recoveryId,
                  ]),
                );
              }
              control.hostRecoveryId = hostRecoveryId;
            }
            if (control.ownedOperation && !control.retainOperationRoot) {
              const cleanup = state.dependencies.classifyOperationCleanup(
                await state.dependencies.cleanupOperation(
                  control.ownedOperation,
                ),
              );
              if (!cleanup)
                throw new Error(
                  "coordinator_task_operation_cleanup_outcome_invalid",
                );
              if (cleanup === "protocol_failure_cleanup_confirmed")
                isHostProtocolFailure = true;
              control.hostCleanupCompleted = true;
              control.hostRecoveryId = null;
              control.ownedOperation = null;
              result = Object.freeze({ ...result, hostRecoveryId: null });
              if (control.lifecycleState === "STATE-CANDIDATE-STAGED")
                advanceLifecycleState(state, control, "STATE-HOST-CLEAN");
            }
            const lateHostLoss = await settleObservedHostLoss();
            if (lateHostLoss === "cleanup_unknown") {
              await retainRuntimeRecoveryState(state, control);
              const candidateRecoveryId = stringValue(
                result.candidateRecoveryId,
              );
              const discarded = candidateRecoveryId
                ? state.dependencies.discardCandidate(candidateRecoveryId)
                : null;
              return blocked(
                "coordinator_task_host_generation_lost_cleanup_unknown_process_restart_required",
                true,
                control.hostRecoveryId,
                null,
                discarded?.status === "discarded" ? null : candidateRecoveryId,
                false,
                stringValue(
                  discarded?.candidateStoreRecoveryId ??
                    result.candidateStoreRecoveryId,
                ),
                actionableDockerRecoveryIds(control),
              );
            }
            if (lateHostLoss === "cleanup_confirmed_failure")
              isHostProtocolFailure = true;
            for (const finalization of state.dependencies
              .recordDockerHostCleanupReceipt && !control.retainOperationRoot
              ? control.dockerFinalizations
              : []) {
              if (
                !state.dependencies.recordDockerHostCleanupReceipt?.(
                  finalization.capability,
                )
              ) {
                await retainRuntimeRecoveryState(state, control);
                return blocked(
                  "coordinator_task_host_cleanup_receipt_unconfirmed",
                  true,
                  control.hostRecoveryId,
                  finalization.recoveryId,
                  stringValue(result.candidateRecoveryId),
                  false,
                  stringValue(result.candidateStoreRecoveryId),
                  actionableDockerRecoveryIds(control, [
                    finalization.recoveryId,
                  ]),
                );
              }
            }
            const finalizeDockerRecovery =
              state.dependencies.finalizeDockerRecovery;
            for (const finalization of control.retainOperationRoot
              ? []
              : control.dockerFinalizations) {
              const finalized = finalizeDockerRecovery?.(
                finalization.capability,
              );
              if (finalized?.status !== "completed") {
                await retainRuntimeRecoveryState(state, control);
                return blocked(
                  "coordinator_task_docker_recovery_finalization_unconfirmed",
                  true,
                  null,
                  finalization.recoveryId,
                  stringValue(result.candidateRecoveryId),
                  false,
                  stringValue(result.candidateStoreRecoveryId),
                  actionableDockerRecoveryIds(control, [
                    finalization.recoveryId,
                  ]),
                );
              }
              const handoff = control.dockerHandoffs.find(
                (candidate) =>
                  candidate.capability === finalization.capability &&
                  candidate.recoveryId === finalization.recoveryId,
              );
              if (handoff?.state !== "finalizable") {
                await retainRuntimeRecoveryState(state, control);
                return blocked(
                  "coordinator_task_docker_recovery_handoff_state_invalid",
                  true,
                  null,
                  finalization.recoveryId,
                  stringValue(result.candidateRecoveryId),
                  false,
                  stringValue(result.candidateStoreRecoveryId),
                  actionableDockerRecoveryIds(control, [
                    finalization.recoveryId,
                  ]),
                );
              }
              handoff.state = "finalized";
            }
            const postDockerHostLoss = await settleObservedHostLoss();
            if (postDockerHostLoss === "cleanup_unknown") {
              await retainRuntimeRecoveryState(state, control);
              const candidateRecoveryId = stringValue(
                result.candidateRecoveryId,
              );
              const discarded = candidateRecoveryId
                ? state.dependencies.discardCandidate(candidateRecoveryId)
                : null;
              return blocked(
                "coordinator_task_host_generation_lost_cleanup_unknown_process_restart_required",
                true,
                control.hostRecoveryId,
                null,
                discarded?.status === "discarded" ? null : candidateRecoveryId,
                false,
                stringValue(
                  discarded?.candidateStoreRecoveryId ??
                    result.candidateStoreRecoveryId,
                ),
                actionableDockerRecoveryIds(control),
              );
            }
            if (postDockerHostLoss === "cleanup_confirmed_failure")
              isHostProtocolFailure = true;
            if (isHostProtocolFailure) {
              const candidateRecoveryId = stringValue(
                result.candidateRecoveryId,
              );
              const discarded = candidateRecoveryId
                ? state.dependencies.discardCandidate(candidateRecoveryId)
                : null;
              const isCandidateStillRequiresRecovery = Boolean(
                candidateRecoveryId && discarded?.status !== "discarded",
              );
              const dockerRecoveryIds = controlDockerRecoveryIds(control);
              const hostRecoveryId = control.retainOperationRoot
                ? control.hostRecoveryId
                : null;
              const candidateStoreRecoveryId = stringValue(
                discarded?.candidateStoreRecoveryId ??
                  result.candidateStoreRecoveryId,
              );
              const manualRecoveryRequired = Boolean(
                hostRecoveryId ||
                  dockerRecoveryIds.length > 0 ||
                  isCandidateStillRequiresRecovery ||
                  candidateStoreRecoveryId,
              );
              return blocked(
                "coordinator_task_host_generation_protocol_failed_cleanup_confirmed",
                manualRecoveryRequired,
                hostRecoveryId,
                dockerRecoveryIds.length === 1 ? dockerRecoveryIds[0] : null,
                isCandidateStillRequiresRecovery ? candidateRecoveryId : null,
                !manualRecoveryRequired,
                candidateStoreRecoveryId,
                dockerRecoveryIds,
              );
            }
            if (!cleanupProjectionEligible) {
              const candidateRecoveryId = stringValue(
                result.candidateRecoveryId,
              );
              const discarded = candidateRecoveryId
                ? state.dependencies.discardCandidate(candidateRecoveryId)
                : null;
              return blocked(
                stringValue(result.reason) ??
                  "coordinator_task_docker_recovery_projection_invalid",
                true,
                control.hostRecoveryId,
                projectedDockerRecoveryIds.length === 1
                  ? (projectedDockerRecoveryIds[0] ?? null)
                  : null,
                discarded?.status === "discarded" ? null : candidateRecoveryId,
                false,
                stringValue(
                  discarded?.candidateStoreRecoveryId ??
                    result.candidateStoreRecoveryId,
                ),
                projectedDockerRecoveryIds,
              );
            }
            const candidateRecoveryId = stringValue(result.candidateRecoveryId);
            if (!candidateRecoveryId)
              return projectCurrentDockerRecovery(result, control);
            if (result.status !== "completed") {
              const discarded =
                state.dependencies.discardCandidate(candidateRecoveryId);
              if (discarded?.status === "discarded") {
                const currentDockerRecoveryIds =
                  controlDockerRecoveryIds(control);
                const manualRecoveryRequired = Boolean(
                  stringValue(result.hostRecoveryId) ||
                    stringValue(result.candidateStoreRecoveryId) ||
                    currentDockerRecoveryIds.length > 0,
                );
                return Object.freeze({
                  ...result,
                  manualRecoveryRequired,
                  cleanupConfirmed: !manualRecoveryRequired,
                  dockerRecoveryId:
                    currentDockerRecoveryIds.length === 1
                      ? currentDockerRecoveryIds[0]
                      : null,
                  dockerRecoveryIds: currentDockerRecoveryIds,
                  candidateRecoveryId: null,
                  candidateStoreRecoveryId: stringValue(
                    result.candidateStoreRecoveryId,
                  ),
                });
              }
              return blocked(
                String(result.reason),
                true,
                stringValue(result.hostRecoveryId),
                stringValue(result.dockerRecoveryId),
                candidateRecoveryId,
                result.cleanupConfirmed === true,
                stringValue(discarded?.candidateStoreRecoveryId),
              );
            }
            const published =
              state.dependencies.publishCandidate(candidateRecoveryId);
            const candidateId = stringValue(published?.candidateId);
            const candidateStoreRecoveryId = stringValue(
              published?.candidateStoreRecoveryId,
            );
            if (published?.status !== "published" || !candidateId) {
              return blocked(
                "coordinator_task_candidate_publish_unconfirmed",
                true,
                null,
                null,
                candidateRecoveryId,
                true,
                candidateStoreRecoveryId,
              );
            }
            return projectCurrentDockerRecovery(
              Object.freeze({
                ...result,
                candidateId,
                expiresAtMs:
                  Number.isSafeInteger(published.expiresAtMs) &&
                  Number(published.expiresAtMs) >= 0
                    ? Number(published.expiresAtMs)
                    : null,
                candidateRecoveryId: null,
                candidateStoreRecoveryId: null,
              }),
              control,
            );
          } catch {
            await retainRuntimeRecoveryState(state, control);
            const candidateRecoveryId = stringValue(result.candidateRecoveryId);
            const discarded = candidateRecoveryId
              ? state.dependencies.discardCandidate(candidateRecoveryId)
              : null;
            return blocked(
              result.reason ===
                "coordinator_task_external_send_confirmation_cleanup_unknown_process_restart_required"
                ? "coordinator_task_external_send_confirmation_cleanup_unknown_process_restart_and_operation_recovery_required"
                : "coordinator_task_operation_cleanup_unconfirmed",
              true,
              control.hostRecoveryId,
              null,
              discarded?.status === "discarded" ? null : candidateRecoveryId,
              null,
              stringValue(discarded?.candidateStoreRecoveryId),
              actionableDockerRecoveryIds(control),
            );
          }
        })
        .catch(async () => {
          try {
            await retainRuntimeRecoveryState(state, control);
          } catch {
            poisonRuntimeProcess(state, control);
          }
          return blocked(
            "coordinator_task_operation_cleanup_unconfirmed",
            true,
            control.hostRecoveryId,
            null,
            null,
            null,
            null,
            controlDockerRecoveryIds(control),
          );
        })
        .then(async (settledResult): Promise<TaskCompletionRecord> => {
          let result = settledResult as TaskCompletionRecord;
          try {
            if (control.cancellationRequested && control.cancellationSettlement)
              await control.cancellationSettlement;
            if (control.hostGenerationFailureObserved) {
              if (result.manualRecoveryRequired === true)
                poisonRuntimeProcess(state, control);
              control.releaseHostGenerationDrain?.();
              control.releaseHostGenerationDrain = null;
            }
            control.processPoisoned ||=
              state.dependencies.isProcessPoisoned?.() === true;
            if (control.cancellationProtocolFailure) {
              const manualRecoveryRequired =
                result.manualRecoveryRequired === true;
              result = Object.freeze({
                ...result,
                status: "blocked" as const,
                reason: manualRecoveryRequired
                  ? "coordinator_task_cancellation_protocol_failed_cleanup_unknown"
                  : "coordinator_task_cancellation_protocol_failed_cleanup_confirmed",
                cleanupConfirmed:
                  !manualRecoveryRequired && result.cleanupConfirmed === true,
                manualRecoveryRequired,
                processRestartRequired: true,
              }) as TaskCompletionRecord;
            } else {
              result = Object.freeze({
                ...result,
                processRestartRequired: control.processPoisoned,
              }) as TaskCompletionRecord;
            }
          } catch {
            result = finalProjectionFailure(result, control);
          } finally {
            state.controls.delete(controlCapability);
          }
          advanceLifecycleState(
            state,
            control,
            classifyCoordinatorTaskTerminalLifecycleState(result),
          );
          return result;
        });
      return Object.freeze({
        status: "started" as const,
        reason: "coordinator_task_started",
        controlCapability,
        completion,
        rawOutputReported: false,
        hostPathReported: false,
        untrustedProviderTextReported: false,
        credentialAbsenceVerified: false,
      });
    },
    cancel: (controlCapability: unknown) => {
      if (!controlCapability || typeof controlCapability !== "object") {
        return Promise.resolve(INVALID_CONTROL_CANCELLATION_RESULT);
      }
      const control = state.controls.get(controlCapability);
      if (!control) {
        return Promise.resolve(INVALID_CONTROL_CANCELLATION_RESULT);
      }
      return requestControlCancellation(state, control);
    },
  });
}

const productionRuntime = createRuntime(productionDependencies);

export function startRuntimeOwnedCoordinatorTask(
  rawRequest: unknown,
  repositoryRoot: unknown,
  verifiedPackageCapability: unknown,
) {
  if (isRuntimeProcessEffectBlocked()) {
    throw new Error(
      isRuntimeProcessPoisoned()
        ? "coordinator_task_process_restart_required"
        : "coordinator_task_runtime_cleanup_in_progress",
    );
  }
  if (
    !consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(
      verifiedPackageCapability,
    )
  ) {
    throw new Error("coordinator_task_release_verification_required");
  }
  return productionRuntime.start(
    rawRequest,
    repositoryRoot,
    new Date().toISOString(),
  );
}

export function cancelRuntimeOwnedCoordinatorTask(controlCapability: unknown) {
  return productionRuntime.cancel(controlCapability);
}

/** Bounded development admission is separate from the signed public Task path. */
const developmentProjectRuntimeCancellations = new WeakMap<
  object,
  () => Promise<unknown>
>();

function startRuntimeOwnedDevelopmentTask(
  rawRequest: unknown,
  repositoryRoot: unknown,
  sessionCapability: object,
  candidateDisposition: "discard" | "project_runtime_owned",
) {
  const timing = createDevelopmentExecutionTiming(
    undefined,
    writeDevelopmentMeasurementProgress,
  );
  const boundary = reserveRuntimeOwnedDevelopmentMeasurementTask(
    sessionCapability,
    rawRequest,
    repositoryRoot,
  );
  if (!boundary)
    throw new Error("coordinator_task_development_permission_required");
  let managementCapability: object | undefined;
  function guard<Args extends unknown[], Result>(
    action: (...args: Args) => Result,
  ) {
    return (...args: Args): Result => {
      if (!boundary?.checkNewWork())
        throw new Error("coordinator_task_development_permission_expired");
      return action(...args);
    };
  }
  const runtime = createRuntime({
    ...productionDependencies,
    observeLifecycleState: timing.observeLifecycleState,
    beginInvocation: boundary.beginInvocation,
    inspectRepository: guard(productionDependencies.inspectRepository),
    createOperation: guard(productionDependencies.createOperation),
    bindRepository: guard((management, root) => {
      const result = bindRuntimeOwnedRepositoryOperation(management, root);
      if (
        !result ||
        !boundary.bindOperation(management, result.repositoryBindingCapability)
      )
        return null;
      managementCapability = management;
      return result;
    }),
    prepareDockerRecoveryState: guard(() =>
      inspectRuntimeOwnedDockerTaskRecoveryState(boundary.context),
    ),
    prepareCandidateStore: guard(() =>
      inspectRuntimeOwnedDevelopmentCandidateStore(boundary.context),
    ),
    observeProviderHome: (provider, time) =>
      inspectRuntimeOwnedWindowsProviderHomeCandidate(
        provider,
        time,
        boundary.context,
      ),
    materializeWorkspace: guard(productionDependencies.materializeWorkspace),
    preflightSlate: guard(productionDependencies.preflightSlate),
    issueSelection: guard(productionDependencies.issueSelection),
    issueMountGrant: guard(productionDependencies.issueMountGrant),
    consumeMountGrant: guard(productionDependencies.consumeMountGrant),
    issueTaskPacket: guard(productionDependencies.issueTaskPacket),
    prepareProvider: guard(productionDependencies.prepareProvider),
    captureCandidate: guard(productionDependencies.captureCandidate),
    persistCandidate: guard(productionDependencies.persistCandidate),
    publishCandidate: guard((id) =>
      publishRuntimeOwnedCandidateBundle(id, managementCapability),
    ),
    discardCandidate: (id) =>
      discardRuntimeOwnedCandidateBundle(id, managementCapability),
  });
  const started = runtime.start(
    boundary.request,
    boundary.repositoryRoot,
    new Date().toISOString(),
  );
  const cancel = () => runtime.cancel(started.controlCapability);
  let cancellation: Promise<unknown> | null = null;
  const requestCancellation = () => {
    cancellation ??= cancel();
    void cancellation.catch(() => {});
  };
  const timer = setTimeout(
    requestCancellation,
    Math.max(0, boundary.expiresAtMs - Date.now()),
  );
  boundary.signal.addEventListener("abort", requestCancellation, {
    once: true,
  });
  if (boundary.signal.aborted) requestCancellation();
  const completion = started.completion
    .then(async (taskResult) => {
      if (cancellation) await cancellation.catch(() => {});
      // Comparison candidates are never promoted; dispose only the entry which
      // the Store registered to this exact operation when it created the file.
      const candidateDiscard =
        candidateDisposition === "discard" && taskResult.candidateId
          ? discardRuntimeOwnedCandidateBundle(
              taskResult.candidateId,
              managementCapability,
            )
          : null;
      const cleanupConfirmed =
        taskResult.cleanupConfirmed === true &&
        (!taskResult.candidateId ||
          candidateDisposition === "project_runtime_owned" ||
          candidateDiscard?.status === "discarded");
      boundary.finish(cleanupConfirmed ? "finished" : "cleanup_unknown");
      timing.finish();
      return Object.freeze({
        status:
          taskResult.status === "completed" && cleanupConfirmed
            ? "completed"
            : "blocked",
        executionSourceKind: "fixed_development_candidate",
        releaseAuthorityConferred: false,
        taskResult,
        candidateDiscard,
        cleanupConfirmed,
        manualRecoveryRequired:
          taskResult.manualRecoveryRequired || !cleanupConfirmed,
        executionTiming: timing.snapshot(),
      });
    })
    .catch((error: unknown) => {
      boundary.finish("cleanup_unknown");
      throw error;
    })
    .finally(() => {
      timing.finish();
      clearTimeout(timer);
      boundary.signal.removeEventListener("abort", requestCancellation);
      developmentProjectRuntimeCancellations.delete(started.controlCapability);
    });
  if (candidateDisposition === "project_runtime_owned")
    developmentProjectRuntimeCancellations.set(
      started.controlCapability,
      cancel,
    );
  return Object.freeze({
    ...started,
    completion,
    cancel,
    readExecutionTiming: timing.snapshot,
  });
}

/** Comparison-only development Tasks discard their candidates on completion. */
export function startRuntimeOwnedDevelopmentCoordinatorTask(
  rawRequest: unknown,
  repositoryRoot: unknown,
  sessionCapability: object,
) {
  return startRuntimeOwnedDevelopmentTask(
    rawRequest,
    repositoryRoot,
    sessionCapability,
    "discard",
  );
}

/** Project Runtime owns candidate integration and cleanup after Task completion. */
export function startRuntimeOwnedDevelopmentProjectRuntimeTask(
  rawRequest: unknown,
  repositoryRoot: unknown,
  sessionCapability: object,
) {
  const started = startRuntimeOwnedDevelopmentTask(
    rawRequest,
    repositoryRoot,
    sessionCapability,
    "project_runtime_owned",
  );
  return Object.freeze({
    status: started.status,
    controlCapability: started.controlCapability,
    completion: started.completion.then((outcome) => outcome.taskResult),
  });
}

export function cancelRuntimeOwnedDevelopmentProjectRuntimeTask(
  controlCapability: object,
) {
  const cancel = developmentProjectRuntimeCancellations.get(controlCapability);
  return cancel ? cancel() : Promise.resolve(false);
}

export function createIsolatedCoordinatorTaskRuntimeCandidate(
  dependencies: RuntimeDependencies,
) {
  return Object.freeze({
    productionAuthority: false as const,
    ...createRuntime(dependencies),
  });
}

export function describeCoordinatorTaskRuntimeContract() {
  return Object.freeze({
    contract: COORDINATOR_TASK_RUNTIME_CONTRACT,
    contractRevision: COORDINATOR_TASK_RUNTIME_CONTRACT_REVISION,
    flow: "front_to_coordinator_to_executor_to_candidate_revision_to_independent_reviewer_to_result_integration",
    routes: Object.freeze([
      "front_codex__executor_codex",
      "front_codex__executor_claude",
      "front_claude__executor_codex",
      "front_claude__executor_claude",
    ]),
    providerSelection: "explainable_cross_provider_preferred_cost_bounded",
    executorConstraint:
      "optional_auto_codex_or_claude_normalized_once_and_enforced_by_the_same_slate_and_selection_gate",
    repositoryObjectFormat:
      "sha1_only_preflight_before_operation_external_send_or_candidate_store",
    selectionNotice:
      "safe_preselection_event_before_provider_effect_with_deferred_preflight_explicit",
    executorWorkspace: "runtime_owned_exact_commit_read_write",
    reviewerWorkspace: "same_exact_candidate_read_only",
    taskTransport: "opaque_single_use_provider_stdin_only",
    recognizedSecretBoundary:
      "task_scope_and_read_projection_before_executor_candidate_capture_before_each_reviewer_and_remediation_path_before_next_executor",
    completeSecretAbsenceVerified: false,
    productionPackageGate:
      "single_use_runtime_private_verified_distribution_capability_before_all_effects",
    processPoisonGate:
      "before_package_consume_operation_console_store_workspace_provider_and_network",
    processRestartProjection:
      "runtime_owned_final_irreversible_process_poison_boolean_independent_from_recovery_identifiers_manual_recovery_reason_and_temporary_drain",
    cancellation: Object.freeze({
      liveControlReceipt:
        "exact_status_reason_cancellation_requested_process_termination_observed",
      reasonCorrelation:
        "termination_true_requested_or_termination_false_grace_exceeded",
      duplicateLiveOperation:
        "same_cancellation_effect_same_promise_same_frozen_receipt",
      invalidForeignOrExpiredControl:
        "exact_blocked_control_invalid_with_zero_effect",
      legacyReceiptFallbackAllowed: false,
      acknowledgmentTimeoutMs: PRODUCTION_CANCELLATION_ACK_TIMEOUT_MS,
      protocolFailure:
        "irreversible_process_poison_joined_before_completion_projection_while_resource_cleanup_continues",
      liveControlLifetime:
        "from_started_return_until_outer_completion_final_settlement_including_cleanup",
    }),
    completionOwnership:
      "production_producer_returns_exact_native_promise_and_owns_settlement_non_native_completion_is_not_runner_authority",
    hostOperationGenerationReadiness:
      "dedicated_supervisor_process_round_trip_then_same_generation_and_durable_record_file_hash_state_root_children_reconfirmation_before_any_following_effect",
    hostOperationSupervisorOutcomes:
      "acquired_unavailable_cleanup_confirmed_failure_or_cleanup_unknown_with_exact_recovery_and_process_poison",
    operationCreationCancellation:
      "rechecked_after_async_creation_before_repository_policy_slate_store_console_or_provider_effect",
    interactiveCleanupRecovery:
      "restart_only_without_operation_recovery_id_unless_operation_cleanup_also_fails",
    approvedCandidateTransfer:
      "policy_bounded_staged_bundle_published_only_after_operation_cleanup",
    candidateStorePreflight:
      "runtime_owned_protected_store_and_bounded_gc_before_external_send_authority",
    dockerRecoveryPreflight:
      "runtime_owned_bounded_state_audit_before_task_operation",
    executionSlate:
      "executor_and_reviewer_preflighted_together_before_external_send_or_provider_effect",
    independentReview: Object.freeze({
      providerIndependent: "preferred_subject_provider_excluded",
      executionContextIndependent:
        "low_risk_local_bounded_only_with_separate_grant_packet_process_and_read_only_candidate",
      highRiskSameProviderAllowed: false,
    }),
    boundedRemediation:
      "maximum_one_same_executor_then_same_independent_reviewer",
    externalSendPolicy:
      "exact_bound_repository_commit_policy_plus_terminal_safe_full_scope_confirmation",
    recoveryIdentifiers: Object.freeze([
      "host",
      "docker_task",
      "candidate",
      "candidate_store",
    ]),
    successfulHostRecoveryProjection: "explicit_null_never_omitted",
    resultPublication: "cleanup_and_candidate_reverification_required",
    candidateExpiryPublication: "validated_published_expires_at_ms",
    canonicalRepositoryEffectAllowed: false,
    directProviderToProviderSpawnAllowed: false,
    apiKeyFallbackAllowed: false,
    paidApiFallbackAllowed: false,
    rawOutputReported: false,
  });
}
