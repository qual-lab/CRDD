import {
  discardRuntimeOwnedCandidateBundle,
  publishRuntimeOwnedCandidateBundle,
  runRuntimeOwnedCandidateStoreStartupGc,
} from "./candidate-bundle-store.ts";
import { prepareRuntimeOwnedClaudeDockerTaskCandidate } from "./claude-docker-runtime-adapter.ts";
import { prepareRuntimeOwnedCodexDockerTaskCandidate } from "./codex-docker-runtime-adapter.ts";
import {
  issueRuntimeOwnedDelegationSelectionGrant,
  preflightRuntimeOwnedDelegationExecutionSlate,
  revokeRuntimeOwnedDelegationSelectionGrant,
} from "./delegation-selection-grant-runtime.ts";
import {
  cancelRuntimeOwnedDockerProcessController,
  startRuntimeOwnedDockerProcessController,
} from "./docker-process-controller.ts";
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
  cleanupOwnedOperationDirectoriesAsync,
  confirmOwnedHostOperationGenerationLockReadiness,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  getOwnedHostRecoveryId,
  observeOwnedHostOperationGenerationLoss,
  verifyOwnedOperationCleanupOutcome,
  verifyOwnedOperationManagementCapability,
} from "./execution-environment.ts";
import { requestRuntimeOwnedExternalSendGrant } from "./external-send-grant-runtime.ts";
import { consumeRuntimeOwnedVerifiedCoordinatorPackageCapability } from "./platform-provisioner-package-filesystem.ts";
import {
  isRuntimeProcessEffectBlocked,
  isRuntimeProcessPoisoned,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../core/runtime-process-safety-state.ts";
import { resolveRuntimeOwnedExternalSendPolicy } from "./external-send-policy-runtime.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
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
import { containsRecognizedSecretScope } from "./secret-material-policy.ts";

export const COORDINATOR_TASK_RUNTIME_CONTRACT =
  "crdd-coordinator/task-runtime";
export const COORDINATOR_TASK_RUNTIME_CONTRACT_REVISION = 18;

const REQUEST_KEYS = new Set([
  "frontProvider",
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "readPaths",
  "workClass",
  "planState",
  "risk",
  "difficulty",
  "decisionImpact",
  "isLocalCandidateOnly",
  "hasUnresolvedDirection",
  "requiresCrossContextAlignment",
]);
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

type Provider = "codex" | "claude";
type TaskRole = "executor" | "reviewer";
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
type HostCleanupStatus = "completed" | "protocol_failure_cleanup_confirmed";
type ProductionOperationFailure = Readonly<{
  reason: string;
  hostRecoveryId: string;
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
type RuntimeDependencies = Readonly<{
  inspectRepository: (repositoryRoot: string) => RuntimeRecord | null;
  createOperation: () => Operation | Promise<Operation>;
  cleanupOperation: (owned: object) => unknown | Promise<unknown>;
  classifyOperationCleanup: (outcome: unknown) => HostCleanupStatus | null;
  abandonOperation: (managementCapability: object) => Promise<unknown>;
  poisonProcessAfterCleanupUnknown?: () => void;
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
  prepareDockerRecoveryState?: () => RuntimeRecord;
  reportSelectionNotice: (notice: RuntimeRecord) => boolean;
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
}>;
type ControlRecord = {
  managementCapability: object;
  currentProcessControl: object | null;
  cancellationRequested: boolean;
  cancellationController: AbortController;
  ownedOperation: object | null;
  retainOperationRoot: boolean;
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

function blocked(
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

function objectCapability(value: unknown) {
  return value && typeof value === "object" ? (value as object) : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
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

function snapshotRequest(rawRequest: unknown) {
  const request = snapshotPlainRecord(rawRequest, REQUEST_KEYS);
  const acceptance = request
    ? snapshotPlainArray<string>(request.acceptanceCriteria, 16)
    : null;
  const paths = request
    ? snapshotPlainArray<string>(request.allowedPaths, 64)
    : null;
  const requestedReadPaths =
    request && request.readPaths !== undefined
      ? snapshotPlainArray<string>(request.readPaths, 64)
      : paths;
  if (
    !request ||
    (request.frontProvider !== "codex" && request.frontProvider !== "claude") ||
    typeof request.objective !== "string" ||
    request.objective.length === 0 ||
    acceptance?.status !== "ok" ||
    paths?.status !== "ok" ||
    requestedReadPaths?.status !== "ok" ||
    acceptance.value.length === 0 ||
    paths.value.length === 0
  ) {
    return null;
  }
  const readPaths = [
    ...new Map(
      [...requestedReadPaths.value, ...paths.value].map((value) => [
        value.toUpperCase(),
        value,
      ]),
    ).values(),
  ];
  if (readPaths.length > 64) return null;
  const normalized = Object.freeze({
    ...request,
    frontProvider: request.frontProvider as Provider,
    objective: request.objective,
    acceptanceCriteria: acceptance.value,
    allowedPaths: paths.value,
    readPaths: Object.freeze(readPaths),
  });
  return containsRecognizedSecretScope(
    normalized.objective,
    normalized.acceptanceCriteria,
    normalized.allowedPaths,
    normalized.readPaths,
  )
    ? Object.freeze({
        status: "blocked" as const,
        reason: "coordinator_task_scope_recognized_secret_rejected" as const,
      })
    : Object.freeze({ status: "accepted" as const, request: normalized });
}

function selectionRequest(
  request: RuntimeRecord,
  operationId: string,
  role: "executor" | "independent_reviewer",
  subjectProvider: Provider | null,
  requestedProvider: Provider | null,
  requiresIndependentProvider: boolean,
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
      isIndependentReview && requiresIndependentProvider,
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

async function executeStage(
  state: RuntimeState,
  operation: Operation,
  request: RuntimeRecord,
  repositoryBindingCapability: object,
  externalSendGrantCapability: object,
  evaluationTime: unknown,
  role: TaskRole,
  taskAttempt: 0 | 1,
  subjectProvider: Provider | null,
  requestedProvider: Provider | null,
  remediationCapability: object | null,
  control: ControlRecord,
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
      requestedProvider,
      role === "reviewer" ? requestedProvider !== subjectProvider : false,
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
      return blocked("coordinator_task_provider_prepare_failed");
    }
    const process = state.dependencies.startProcess(
      preparedCapability,
      operation.managementCapability,
      (recoveryCapability, recoveryId) => {
        const capability = objectCapability(recoveryCapability);
        const id = stringValue(recoveryId);
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
    );
    const processControl = objectCapability(process.controlCapability);
    const completion = process.completion;
    if (
      process.status !== "started" ||
      !processControl ||
      !(completion instanceof Promise)
    ) {
      return blocked(
        stringValue(process.reason) ?? "coordinator_task_process_start_failed",
        process.cleanupConfirmed !== true,
        process.cleanupConfirmed !== true ? operation.hostRecoveryId : null,
        process.cleanupConfirmed !== true
          ? stringValue(process.recoveryId)
          : null,
      );
    }
    control.currentProcessControl = processControl;
    startedProcessControl = processControl;
    startedDockerRecoveryId = stringValue(process.recoveryId);
    if (control.cancellationRequested) {
      await state.dependencies.cancelProcess(
        processControl,
        operation.managementCapability,
      );
    }
    const result = (await completion) as RuntimeRecord;
    control.currentProcessControl = null;
    startedProcessControl = null;
    const completedHandoff = control.dockerHandoffs.find(
      (candidate) => candidate.recoveryId === startedDockerRecoveryId,
    );
    if (
      result.cleanupConfirmed === true &&
      (result.status !== "completed" || control.cancellationRequested)
    ) {
      if (completedHandoff) completedHandoff.state = "finalized";
    }
    if (control.cancellationRequested) {
      return blocked("coordinator_task_cancelled_after_provider_cleanup");
    }
    if (result.status !== "completed" || result.cleanupConfirmed !== true) {
      return Object.freeze({
        ...blocked(
          stringValue(result.reason) ?? "coordinator_task_provider_failed",
          result.cleanupConfirmed !== true,
          result.cleanupConfirmed !== true ? operation.hostRecoveryId : null,
          result.cleanupConfirmed !== true
            ? stringValue(result.recoveryId)
            : null,
        ),
      });
    }
    const finalizationCapability = objectCapability(
      result.recoveryFinalizationCapability,
    );
    const handoff = control.dockerHandoffs.find(
      (candidate) => candidate.recoveryId === startedDockerRecoveryId,
    );
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

async function runCoordinatorTask(
  state: RuntimeState,
  rawRequest: unknown,
  repositoryRoot: unknown,
  evaluationTime: unknown,
  controlCapability: object,
  control: ControlRecord,
) {
  const requestOutcome = snapshotRequest(rawRequest);
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
  const dockerRecoveryState = state.dependencies.prepareDockerRecoveryState?.();
  if (dockerRecoveryState && dockerRecoveryState.status !== "completed") {
    return blocked(
      stringValue(dockerRecoveryState.reason) ??
        "coordinator_task_docker_recovery_state_unavailable",
      true,
      null,
      stringValue(dockerRecoveryState.dockerRecoveryId),
    );
  }
  let operation: Operation | null = null;
  let shouldRetainOperationRoot = false;
  try {
    operation = await state.dependencies.createOperation();
    control.ownedOperation = operation.owned;
    control.managementCapability = operation.managementCapability;
    control.hostRecoveryId = operation.hostRecoveryId;
    if (
      operation.hostGenerationFailureDetected &&
      operation.hostGenerationLoss
    ) {
      control.hostGenerationLoss = operation.hostGenerationLoss;
      control.hostGenerationFailureHandling =
        operation.hostGenerationFailureDetected.then(async () => {
          control.hostGenerationFailureObserved = true;
          control.cancellationRequested = true;
          control.cancellationController.abort();
          const processControl = control.currentProcessControl;
          if (processControl) {
            try {
              const cancellation = await state.dependencies.cancelProcess(
                processControl,
                control.managementCapability,
              );
              const cancellationResult = snapshotPlainRecord(
                cancellation,
                PROCESS_CANCELLATION_RESULT_KEYS,
              );
              if (
                cancellationResult?.status !== "requested" ||
                ("processTerminationObserved" in (cancellationResult ?? {}) &&
                  cancellationResult?.processTerminationObserved !== true)
              ) {
                control.hostGenerationLossOutcome = "cleanup_unknown";
                state.dependencies.poisonProcessAfterCleanupUnknown?.();
              }
            } catch {
              control.hostGenerationLossOutcome = "cleanup_unknown";
              state.dependencies.poisonProcessAfterCleanupUnknown?.();
            }
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
        null,
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
      return blocked(
        workspace?.reason ===
          "repository_read_projection_recognized_secret_rejected"
          ? "coordinator_task_read_projection_recognized_secret_rejected"
          : "coordinator_task_workspace_materialization_failed",
      );
    }
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
      return executor;
    }
    if (control.cancellationRequested) {
      return blocked("coordinator_task_cancelled_before_candidate_capture");
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
      return blocked(
        candidate?.reason === "candidate_recognized_secret_rejected"
          ? "coordinator_task_candidate_recognized_secret_rejected"
          : "coordinator_task_candidate_revision_invalid",
      );
    }
    if (control.cancellationRequested) {
      return blocked("coordinator_task_cancelled_before_independent_review");
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
      return reviewer;
    }
    let reviewerResult = reviewer.normalizedResult as RuntimeRecord;
    let remediationPerformed = false;
    if (reviewerResult?.decision === "changes_requested") {
      const remediationCapability = objectCapability(
        reviewerResult.remediationCapability,
      );
      if (!remediationCapability || reviewerResult.findingCount === 0) {
        return blocked("coordinator_task_review_remediation_invalid");
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
        return remediation;
      }
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
        return blocked(
          candidate?.reason === "candidate_recognized_secret_rejected"
            ? "coordinator_task_candidate_recognized_secret_rejected"
            : "coordinator_task_remediated_candidate_invalid",
        );
      }
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
        return reviewer;
      }
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
      return blocked("coordinator_task_independent_review_not_approved");
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
    return Object.freeze({
      status: "completed" as const,
      reason: "coordinator_task_candidate_approved",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      executorProvider: executor.provider,
      reviewerProvider: reviewer.provider,
      reviewerIndependence,
      externalSendAuthorizationMode:
        externalSendGrant.authorizationMode === "interactive_initial_consent"
          ? "interactive_initial_consent"
          : "reused_initial_consent",
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
    const creationFailure = productionOperationFailure(error);
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
    state.controls.delete(controlCapability);
    control.retainOperationRoot = shouldRetainOperationRoot;
  }
}

async function createProductionOperation() {
  const owned = createOwnedOperationDirectories();
  const hostRecoveryId = getOwnedHostRecoveryId(owned);
  let failureReason = "coordinator_task_operation_creation_failed";
  try {
    const contextCapability = createOwnedOperationContextCapability(owned);
    const mountCapability = createOwnedMountCapability(owned);
    const managementCapability = createOwnedOperationManagementCapability(
      contextCapability,
      mountCapability,
    );
    const operation =
      verifyOwnedOperationManagementCapability(managementCapability);
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
      operationId: operation.operationId,
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
  cleanupOperation: cleanupOwnedOperationDirectoriesAsync,
  classifyOperationCleanup: verifyOwnedOperationCleanupOutcome,
  abandonOperation: abandonOwnedHostOperationGenerationLock,
  poisonProcessAfterCleanupUnknown: poisonRuntimeProcessAfterCleanupUnknown,
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
  control.retainOperationRoot = true;
  for (const handoff of control.dockerHandoffs) {
    if (handoff.state === "finalized" || handoff.state === "abandoned")
      continue;
    if (state.dependencies.abandonDockerRecovery?.(handoff.capability) === true)
      handoff.state = "abandoned";
  }
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
        managementCapability: Object.freeze({}),
        currentProcessControl: null,
        cancellationRequested: false,
        cancellationController: new AbortController(),
        ownedOperation: null,
        retainOperationRoot: false,
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
      state.controls.set(controlCapability, control);
      const completion = runCoordinatorTask(
        state,
        rawRequest,
        repositoryRoot,
        evaluationTime,
        controlCapability,
        control,
      )
        .then(async (rawResult) => {
          const rawResultRecord = rawResult as RuntimeRecord;
          const allDockerRecoveryIds = [
            ...(Array.isArray(rawResultRecord.dockerRecoveryIds)
              ? rawResultRecord.dockerRecoveryIds.filter(
                  (value: unknown): value is string =>
                    typeof value === "string",
                )
              : []),
            ...(stringValue(rawResultRecord.dockerRecoveryId)
              ? [String(rawResultRecord.dockerRecoveryId)]
              : []),
            ...controlDockerRecoveryIds(control),
          ];
          const uniqueDockerRecoveryIds = Object.freeze([
            ...new Set(allDockerRecoveryIds),
          ]);
          const projectedDockerRecoveryIds = uniqueDockerRecoveryIds;
          let result = Object.freeze({
            ...rawResult,
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
                  rawResult.manualRecoveryRequired === true,
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
            let hostProtocolFailure =
              control.hostGenerationLossOutcome === "cleanup_confirmed_failure";
            const isProcessRestartOnly =
              result.reason ===
              "coordinator_task_external_send_confirmation_cleanup_unknown_process_restart_required";
            if (
              (result.manualRecoveryRequired === true &&
                !stringValue(result.candidateRecoveryId) &&
                !isProcessRestartOnly) ||
              ("hostRecoveryId" in result &&
                stringValue(result.hostRecoveryId)) ||
              ("dockerRecoveryId" in result &&
                stringValue(result.dockerRecoveryId))
            )
              control.retainOperationRoot = true;
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
                hostProtocolFailure = true;
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
              hostProtocolFailure = true;
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
              hostProtocolFailure = true;
            if (hostProtocolFailure) {
              const candidateRecoveryId = stringValue(
                result.candidateRecoveryId,
              );
              const discarded = candidateRecoveryId
                ? state.dependencies.discardCandidate(candidateRecoveryId)
                : null;
              const candidateStillRequiresRecovery = Boolean(
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
                  candidateStillRequiresRecovery ||
                  candidateStoreRecoveryId,
              );
              return blocked(
                "coordinator_task_host_generation_protocol_failed_cleanup_confirmed",
                manualRecoveryRequired,
                hostRecoveryId,
                dockerRecoveryIds.length === 1 ? dockerRecoveryIds[0] : null,
                candidateStillRequiresRecovery ? candidateRecoveryId : null,
                !manualRecoveryRequired,
                candidateStoreRecoveryId,
                dockerRecoveryIds,
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
          await retainRuntimeRecoveryState(state, control);
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
        .then((result) => {
          if (control.hostGenerationFailureObserved) {
            if (result.manualRecoveryRequired === true)
              state.dependencies.poisonProcessAfterCleanupUnknown?.();
            control.releaseHostGenerationDrain?.();
            control.releaseHostGenerationDrain = null;
          }
          return result;
        })
        .finally(() => state.controls.delete(controlCapability));
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
    cancel: async (controlCapability: unknown) => {
      if (!controlCapability || typeof controlCapability !== "object") {
        return Object.freeze({ status: "blocked" as const });
      }
      const control = state.controls.get(controlCapability);
      if (!control || control.cancellationRequested) {
        return Object.freeze({ status: "blocked" as const });
      }
      control.cancellationRequested = true;
      control.cancellationController.abort();
      return control.currentProcessControl
        ? state.dependencies.cancelProcess(
            control.currentProcessControl,
            control.managementCapability,
          )
        : Object.freeze({ status: "requested" as const });
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
    resultPublication: "cleanup_and_candidate_reverification_required",
    candidateExpiryPublication: "validated_published_expires_at_ms",
    canonicalRepositoryEffectAllowed: false,
    directProviderToProviderSpawnAllowed: false,
    apiKeyFallbackAllowed: false,
    paidApiFallbackAllowed: false,
    rawOutputReported: false,
  });
}
