import { createHash } from "node:crypto";
import type { Writable } from "node:stream";
import { types as utilTypes } from "node:util";

import { consumeRuntimeOwnedClaudeDockerPlanForProcessController } from "./claude-docker-runtime-adapter.ts";
import {
  normalizeClaudeStructuredResult,
  parseUnambiguousJsonDocument,
} from "./claude-structured-result.ts";
import { consumeRuntimeOwnedCodexDockerPlanForProcessController } from "./codex-docker-runtime-adapter.ts";
import { normalizeCodexStructuredResult } from "./codex-structured-result.ts";
import {
  cleanupRuntimeOwnedDockerResources,
  startRuntimeOwnedDockerCommand,
} from "./docker-effect-runtime.ts";
import { parseDockerTaskRecoveryId } from "./docker-recovery-identity.ts";
import {
  publicDockerRecoveryStartReason,
  publicVerifiedDockerRecoveryId,
} from "./docker-recovery-public-projection.ts";
import {
  abandonRuntimeOwnedDockerRecovery,
  beginRuntimeOwnedDockerRecovery,
  completeRuntimeOwnedDockerRecovery,
  markRuntimeOwnedDockerResourceSubmission,
  recordRuntimeOwnedDockerAbsence,
  recordRuntimeOwnedDockerResourceReceipt,
  recordRuntimeOwnedNormalMountCompletion,
  verifyRuntimeOwnedDockerRecoveryBinding,
} from "./docker-recovery-runtime.ts";
import { consumeRuntimeOwnedProviderAuthority } from "./provider-authority-runtime.ts";
import { completeRuntimeOwnedProviderHomeMount } from "./provider-home-mount-grant-runtime.ts";
import { normalizeProviderTaskStructuredResult } from "./provider-task-structured-result.ts";
import { verifyRuntimeOwnedRepositoryOperation } from "./repository-operation-runtime.ts";

export const DOCKER_PROCESS_CONTROLLER_CONTRACT =
  "crdd-coordinator/docker-process-controller";
export const DOCKER_PROCESS_CONTROLLER_CONTRACT_REVISION = 27;

const SETUP_TIMEOUT_MS = 10_000;
const PROVIDER_TIMEOUT_MS = 300_000;
const CANCELLATION_GRACE_MS = 5_000;
const STDOUT_LIMIT_BYTES = 1_048_576;
const STDERR_LIMIT_BYTES = 262_144;
const PURPOSES = Object.freeze([
  "create_subscription_auth_probe",
  "start_subscription_auth_probe_attached",
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "connect_proxy_egress",
  "create_provider",
  "start_proxy",
  "start_provider_attached",
]);
const CREATE_PURPOSES = new Set([
  "create_subscription_auth_probe",
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "create_provider",
]);
const BLOCKED_COMPLETION_REASONS = new Set([
  "provider_deadline_exceeded",
  "docker_setup_deadline_exceeded",
  "provider_output_limit_exceeded",
  "provider_process_signalled",
  "provider_process_exit_nonzero",
  "provider_subscription_quota_exhausted",
  "provider_authentication_expired",
  "provider_operation_budget_exceeded",
  "provider_turn_limit_exceeded",
  "provider_structured_output_retry_exhausted",
  "provider_invocation_rejected",
  "provider_network_unavailable",
  "provider_service_unavailable",
  "docker_setup_command_failed",
  "docker_resource_submission_record_unavailable",
  "docker_resource_receipt_unavailable",
  "docker_process_controller_execution_restricted",
  "provider_subscription_auth_not_confirmed",
  "provider_result_invalid",
  "provider_task_result_input_invalid",
  "provider_task_result_json_invalid",
  "provider_task_result_envelope_status_invalid",
  "provider_task_result_turn_count_invalid",
  "provider_task_result_turn_limit_mismatch",
  "provider_task_result_cost_metadata_invalid",
  "provider_task_reviewer_result_transport_invalid",
  "provider_task_executor_shape_invalid",
  "provider_task_reviewer_shape_invalid",
  "provider_task_reviewer_finding_invalid",
  "provider_task_reviewer_decision_inconsistent",
  "docker_process_controller_execution_failed_closed",
  "docker_process_controller_provider_start_failed",
  "docker_process_controller_provider_start_observation_failed",
  "repository_revision_changed",
]);
const SAFE_IDENTIFIER =
  /^crdd-(?:auth|internal|egress|proxy|claude|codex)-[a-f0-9]{16}$/u;

type Command = Readonly<{ purpose: string; argv: readonly string[] }>;
type PreparedPlan = Readonly<{
  provider: "codex" | "claude";
  operationId: string;
  recoveryCorrelationId?: string | null;
  grantRef: string;
  profileId: string;
  activeMountCapability: object;
  authorityUseCapability: object;
  providerHomeSourcePath: string;
  providerHomeIdentityHash: string;
  providerHomeProtectionHash: string;
  localUserBindingHash: string;
  stableLogicalHomeBindingHash: string;
  authContainerName: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  selectionRecordId: string;
  subscriptionOffering: "chatgpt_subscription_oauth" | "claude_max";
  selectedModel: string;
  selectedEffort: "low" | "medium" | "high";
  selectedModelTier: string;
  operationMode: "boolean_probe" | "isolated_task";
  taskRole: "executor" | "reviewer" | null;
  taskWorkload?: unknown;
  taskPacketRef: string | null;
  taskPacketHash: string | null;
  providerInput: string | null;
  workspaceSourcePath: string | null;
  workspaceMountMode: "read_write" | "read_only" | null;
  commands: readonly Command[];
}>;
type CommandExecution = Readonly<{
  status: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  outputExceeded: boolean;
}>;
type CommandHandle = Readonly<{
  started: (timeoutMs: number) => Promise<boolean>;
  wait: (timeoutMs: number) => Promise<CommandExecution | null>;
  terminateAndWait: (graceMs: number) => Promise<boolean>;
}>;
type Recovery = Readonly<{
  status: "ready";
  recoveryId: string;
  recoveryCapability: object;
}>;
type BlockedRecovery = Readonly<{
  status: "blocked";
  reason?: string;
  recoveryId: string | null;
  manualRecoveryRequired?: boolean;
}>;
type CleanupObservation = Readonly<{
  confirmed: boolean;
  processTreeTerminated: boolean;
  containersAbsent: boolean;
  networksAbsent: boolean;
}>;
type ProviderProcessStartedNotice = Readonly<{
  event: "coordinator_provider_process_started";
  taskRole: "executor" | "reviewer" | null;
  provider: "codex" | "claude";
  operationId: string;
}>;
type RuntimeDependencies = Readonly<{
  effectExecutorAvailable: boolean;
  verifyRevision: (managementCapability: unknown) => unknown;
  consumePreparedPlan: (
    preparedCapability: unknown,
    managementCapability: unknown,
  ) => PreparedPlan | null;
  beginRecovery: (
    plan: PreparedPlan,
    managementCapability: unknown,
  ) => Recovery | BlockedRecovery | null;
  abandonRecovery?: (recoveryCapability: object) => boolean;
  verifyRecoveryBinding: (
    recoveryCapability: unknown,
    recoveryId: unknown,
    managementCapability: unknown,
    stableLogicalHomeBindingHash: unknown,
  ) => boolean;
  startCommand: (
    command: Command,
    plan: PreparedPlan,
    managementCapability: unknown,
  ) => CommandHandle;
  cleanupOwnedResources: (
    plan: PreparedPlan,
    recoveryCapability: object,
    managementCapability: unknown,
  ) => Promise<CleanupObservation>;
  completeMount: (
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{ status: string }>;
  completeRecovery: (
    recoveryCapability: object,
    managementCapability: unknown,
  ) => Readonly<{
    status: string;
    recoveryFinalizationCapability?: object;
  }>;
  markResourceSubmission?: (
    recoveryCapability: object,
    purpose: string,
  ) => boolean;
  recordResourceReceipt?: (
    recoveryCapability: object,
    purpose: string,
    dockerId: string,
  ) => boolean;
  recordDockerAbsence?: (recoveryCapability: object) => boolean;
  recordMountCompletion?: (recoveryCapability: object) => boolean;
  reportProviderProcessStarted?: (
    notice: ProviderProcessStartedNotice,
  ) => Promise<boolean>;
  consumeProviderAuthority: (
    useCapability: unknown,
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{
    operationId: string;
    provider: string;
    profileId: string;
    providerHomeMountGrantRef: string;
    runtimeAuthorityIssued: true;
    providerEffectAllowed: true;
  }> | null;
}>;

type ExecutionRecord = {
  managementCapability: object;
  commandRestriction: unknown;
  cancellationRequested: boolean;
  activeHandle: CommandHandle | null;
  completion: Promise<ExecutionResult> | null;
};
type RuntimeState = Readonly<{
  dependencies: RuntimeDependencies;
  controls: WeakMap<object, ExecutionRecord>;
}>;
type ExecutionResult = ReturnType<typeof createFinalResult>;

export function createRuntimeOwnedLifecycleNoticeReporter(stream: Writable) {
  return (notice: ProviderProcessStartedNotice): Promise<boolean> => {
    if (!stream.writable || stream.destroyed) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => settle(false), CANCELLATION_GRACE_MS);
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        stream.off("error", onFailure);
        stream.off("close", onFailure);
        resolve(value);
      };
      const onFailure = () => settle(false);
      stream.once("error", onFailure);
      stream.once("close", onFailure);
      try {
        stream.write(
          `[Coordinator lifecycle] ${JSON.stringify(notice)}\n`,
          "utf8",
          (error) => {
            if (error === undefined || error === null) settle(true);
          },
        );
      } catch {
        settle(false);
      }
    });
  };
}

const BLOCKED_START_KEYS = Object.freeze([
  "cleanupConfirmed",
  "completion",
  "controlCapability",
  "credentialAbsenceVerified",
  "dockerEffectStarted",
  "hostPathReported",
  "manualRecoveryRequired",
  "normalizedResult",
  "operationId",
  "providerRequestStarted",
  "proxyCredentialReported",
  "rawOutputReported",
  "reason",
  "recoveryId",
  "status",
  "untrustedProviderTextReported",
]);
const STARTED_KEYS = Object.freeze([
  "completion",
  "controlCapability",
  "credentialAbsenceVerified",
  "dockerEffectStarted",
  "hostPathReported",
  "normalizedResult",
  "normalizedResultReportedAfterCleanupOnly",
  "operationId",
  "providerRequestStarted",
  "proxyCredentialReported",
  "rawOutputReported",
  "reason",
  "recoveryId",
  "status",
  "untrustedProviderTextReported",
]);
const COMPLETION_KEYS = Object.freeze([
  "cancellationRequested",
  "cleanupConfirmed",
  "containersAbsent",
  "credentialAbsenceVerified",
  "dockerEffectStarted",
  "hostPathReported",
  "manualRecoveryRequired",
  "mountLeaseReleased",
  "networksAbsent",
  "normalizedResult",
  "operationId",
  "processTreeTerminationConfirmed",
  "providerRequestStarted",
  "proxyCredentialReported",
  "rawOutputReported",
  "reason",
  "recoveryCompleted",
  "recoveryFinalizationCapability",
  "recoveryId",
  "resultBytes",
  "resultSha256",
  "selectionRecordId",
  "status",
  "subscriptionAuthConfirmed",
  "untrustedProviderTextReported",
]);

function ownDataValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function exactPlainRecord(value: unknown, expectedKeys: readonly string[]) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  )
    return null;
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.some((key) => typeof key !== "string") ||
      (keys as string[]).sort().join("\0") !==
        [...expectedKeys].sort().join("\0")
    )
      return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const entries: [string, unknown][] = [];
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      )
        return null;
      entries.push([key, descriptor.value]);
    }
    return Object.freeze(Object.fromEntries(entries));
  } catch {
    return null;
  }
}

/** Producer-owned exact projection for the controller's synchronous result. */
export function projectDockerProcessControllerStartResult(
  value: unknown,
  handedOffRecoveryId: unknown,
  expectedOperationId?: unknown,
): Readonly<Record<string, unknown>> | null {
  const blockedRecord = exactPlainRecord(value, BLOCKED_START_KEYS);
  if (blockedRecord && ownDataValue(blockedRecord, "status") === "blocked") {
    const record = blockedRecord;
    const rawRecoveryId = ownDataValue(record, "recoveryId");
    const recoveryId =
      rawRecoveryId === null
        ? null
        : publicVerifiedDockerRecoveryId(rawRecoveryId);
    const cleanupConfirmed = ownDataValue(record, "cleanupConfirmed");
    const manualRecoveryRequired = ownDataValue(
      record,
      "manualRecoveryRequired",
    );
    return record &&
      typeof ownDataValue(record, "reason") === "string" &&
      ownDataValue(record, "controlCapability") === null &&
      ownDataValue(record, "completion") === null &&
      ownDataValue(record, "operationId") === null &&
      typeof cleanupConfirmed === "boolean" &&
      typeof manualRecoveryRequired === "boolean" &&
      (cleanupConfirmed === true || manualRecoveryRequired === true) &&
      (recoveryId === null || manualRecoveryRequired === true) &&
      ownDataValue(record, "dockerEffectStarted") === false &&
      ownDataValue(record, "providerRequestStarted") === false &&
      ownDataValue(record, "normalizedResult") === null &&
      ownDataValue(record, "rawOutputReported") === false &&
      ownDataValue(record, "untrustedProviderTextReported") === false &&
      ownDataValue(record, "credentialAbsenceVerified") === false &&
      ownDataValue(record, "hostPathReported") === false &&
      ownDataValue(record, "proxyCredentialReported") === false &&
      recoveryId === rawRecoveryId
      ? Object.freeze({ ...record, recoveryId })
      : null;
  }
  const record = exactPlainRecord(value, STARTED_KEYS);
  const status = ownDataValue(record, "status");
  const recoveryId = publicVerifiedDockerRecoveryId(
    ownDataValue(record, "recoveryId"),
  );
  return record &&
    status === "started" &&
    typeof ownDataValue(record, "reason") === "string" &&
    typeof ownDataValue(record, "operationId") === "string" &&
    (expectedOperationId === undefined ||
      ownDataValue(record, "operationId") === expectedOperationId) &&
    ownDataValue(record, "controlCapability") !== null &&
    typeof ownDataValue(record, "controlCapability") === "object" &&
    ownDataValue(record, "completion") instanceof Promise &&
    ownDataValue(record, "dockerEffectStarted") === true &&
    ownDataValue(record, "providerRequestStarted") === false &&
    ownDataValue(record, "normalizedResult") === null &&
    ownDataValue(record, "normalizedResultReportedAfterCleanupOnly") === true &&
    ownDataValue(record, "rawOutputReported") === false &&
    ownDataValue(record, "untrustedProviderTextReported") === false &&
    ownDataValue(record, "credentialAbsenceVerified") === false &&
    ownDataValue(record, "hostPathReported") === false &&
    ownDataValue(record, "proxyCredentialReported") === false &&
    recoveryId !== null &&
    recoveryId === handedOffRecoveryId
    ? Object.freeze({ ...record, recoveryId })
    : null;
}

/** Producer-owned exact projection for the controller's asynchronous result. */
export function projectDockerProcessControllerCompletionResult(
  value: unknown,
  expectedRecoveryId: unknown,
  expectedOperationId?: unknown,
): Readonly<Record<string, unknown>> | null {
  const record = exactPlainRecord(value, COMPLETION_KEYS);
  if (!record) return null;
  const status = ownDataValue(record, "status");
  const cleanupConfirmed = ownDataValue(record, "cleanupConfirmed");
  const manualRecoveryRequired = ownDataValue(record, "manualRecoveryRequired");
  const rawRecoveryId = ownDataValue(record, "recoveryId");
  const recoveryId =
    rawRecoveryId === null
      ? null
      : publicVerifiedDockerRecoveryId(rawRecoveryId);
  const expected = publicVerifiedDockerRecoveryId(expectedRecoveryId);
  const processTreeTerminated = ownDataValue(
    record,
    "processTreeTerminationConfirmed",
  );
  const containersAbsent = ownDataValue(record, "containersAbsent");
  const networksAbsent = ownDataValue(record, "networksAbsent");
  const mountLeaseReleased = ownDataValue(record, "mountLeaseReleased");
  const recoveryCompleted = ownDataValue(record, "recoveryCompleted");
  const isCleanupFromResources =
    processTreeTerminated === true &&
    containersAbsent === true &&
    networksAbsent === true &&
    mountLeaseReleased === true &&
    recoveryCompleted === true;
  const providerRequestStarted = ownDataValue(record, "providerRequestStarted");
  const cancellationRequested = ownDataValue(record, "cancellationRequested");
  const normalizedResult = ownDataValue(record, "normalizedResult");
  const resultSha256 = ownDataValue(record, "resultSha256");
  const resultBytes = ownDataValue(record, "resultBytes");
  const subscriptionAuthConfirmed = ownDataValue(
    record,
    "subscriptionAuthConfirmed",
  );
  const recoveryFinalizationCapability = ownDataValue(
    record,
    "recoveryFinalizationCapability",
  );
  const reason = ownDataValue(record, "reason");
  if (
    (status !== "completed" &&
      status !== "blocked" &&
      status !== "cancelled") ||
    typeof reason !== "string" ||
    typeof cleanupConfirmed !== "boolean" ||
    typeof manualRecoveryRequired !== "boolean" ||
    typeof ownDataValue(record, "operationId") !== "string" ||
    (expectedOperationId !== undefined &&
      ownDataValue(record, "operationId") !== expectedOperationId) ||
    typeof ownDataValue(record, "selectionRecordId") !== "string" ||
    ownDataValue(record, "dockerEffectStarted") !== true ||
    typeof providerRequestStarted !== "boolean" ||
    typeof cancellationRequested !== "boolean" ||
    typeof processTreeTerminated !== "boolean" ||
    typeof containersAbsent !== "boolean" ||
    typeof networksAbsent !== "boolean" ||
    typeof mountLeaseReleased !== "boolean" ||
    typeof recoveryCompleted !== "boolean" ||
    cleanupConfirmed !== isCleanupFromResources ||
    !Number.isSafeInteger(resultBytes) ||
    (resultBytes as number) < 0 ||
    (resultSha256 !== null &&
      (typeof resultSha256 !== "string" ||
        !/^[a-f0-9]{64}$/u.test(resultSha256))) ||
    (recoveryFinalizationCapability !== null &&
      typeof recoveryFinalizationCapability !== "object") ||
    typeof subscriptionAuthConfirmed !== "boolean" ||
    ownDataValue(record, "rawOutputReported") !== false ||
    ownDataValue(record, "untrustedProviderTextReported") !== false ||
    ownDataValue(record, "credentialAbsenceVerified") !== false ||
    ownDataValue(record, "hostPathReported") !== false ||
    ownDataValue(record, "proxyCredentialReported") !== false ||
    !expected ||
    (cleanupConfirmed === true
      ? recoveryId !== null || manualRecoveryRequired !== false
      : recoveryId !== expected ||
        manualRecoveryRequired !== true ||
        status !== "blocked" ||
        reason !== "docker_process_controller_cleanup_unconfirmed" ||
        normalizedResult !== null ||
        resultSha256 !== null ||
        resultBytes !== 0 ||
        recoveryFinalizationCapability !== null) ||
    (cleanupConfirmed === true &&
      (recoveryFinalizationCapability === null ||
        typeof recoveryFinalizationCapability !== "object")) ||
    (status === "completed"
      ? reason !== "provider_operation_completed" ||
        providerRequestStarted !== true ||
        cancellationRequested !== false ||
        subscriptionAuthConfirmed !== true ||
        normalizedResult === null ||
        typeof normalizedResult !== "object" ||
        typeof resultSha256 !== "string" ||
        resultBytes === 0
      : normalizedResult !== null ||
        resultSha256 !== null ||
        resultBytes !== 0) ||
    (status === "cancelled" &&
      (reason !== "provider_operation_cancelled" ||
        cancellationRequested !== true)) ||
    (status === "blocked" &&
      cleanupConfirmed === true &&
      !BLOCKED_COMPLETION_REASONS.has(reason))
  )
    return null;
  return Object.freeze({ ...record, recoveryId });
}

function snapshotReadyRecovery(value: unknown): Recovery | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    if (
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).sort().join("\0") !==
        ["recoveryCapability", "recoveryId", "status"].sort().join("\0")
    )
      return null;
  } catch {
    return null;
  }
  const status = ownDataValue(value, "status");
  const recoveryId = ownDataValue(value, "recoveryId");
  const recoveryCapability = ownDataValue(value, "recoveryCapability");
  return status === "ready" &&
    typeof recoveryId === "string" &&
    recoveryCapability !== null &&
    typeof recoveryCapability === "object"
    ? Object.freeze({ status, recoveryId, recoveryCapability })
    : null;
}

function snapshotBlockedRecoveryWithExactId(
  value: unknown,
  expectedStableLogicalHomeBindingHash: string,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    if (
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).sort().join("\0") !==
        ["reason", "recoveryId", "status"].sort().join("\0")
    )
      return null;
  } catch {
    return null;
  }
  const status = ownDataValue(value, "status");
  const reason = ownDataValue(value, "reason");
  const recoveryId = publicVerifiedDockerRecoveryId(
    ownDataValue(value, "recoveryId"),
  );
  const parsed = parseDockerTaskRecoveryId(recoveryId);
  return status === "blocked" &&
    typeof reason === "string" &&
    recoveryId &&
    parsed?.stableLogicalHomeBindingHash ===
      expectedStableLogicalHomeBindingHash
    ? Object.freeze({ status, reason, recoveryId })
    : null;
}

function createBlockedStart(
  reason: string,
  preEffectCleanupConfirmed = false,
  recoveryId: string | null = null,
  lowerManualRecoveryRequired = false,
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    controlCapability: null,
    completion: null,
    operationId: null,
    recoveryId,
    cleanupConfirmed: preEffectCleanupConfirmed,
    manualRecoveryRequired:
      lowerManualRecoveryRequired ||
      !preEffectCleanupConfirmed ||
      recoveryId !== null,
    dockerEffectStarted: false,
    providerRequestStarted: false,
    normalizedResult: null,
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
    hostPathReported: false,
    proxyCredentialReported: false,
  });
}

function settleInvalidRecoveryStart(
  state: RuntimeState,
  plan: PreparedPlan,
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
  return createBlockedStart(reason, false, recoveryId, true);
}

function createFinalResult(
  status: "completed" | "blocked" | "cancelled",
  reason: string,
  plan: PreparedPlan,
  recoveryId: string,
  details: Readonly<{
    providerRequestStarted: boolean;
    cancellationRequested: boolean;
    processTreeTerminationConfirmed: boolean;
    containersAbsent: boolean;
    networksAbsent: boolean;
    mountLeaseReleased: boolean;
    recoveryCompleted: boolean;
    resultSha256: string | null;
    resultBytes: number;
    normalizedResult: unknown | null;
    subscriptionAuthConfirmed: boolean;
    recoveryFinalizationCapability: object | null;
  }>,
) {
  const cleanupConfirmed =
    details.processTreeTerminationConfirmed &&
    details.containersAbsent &&
    details.networksAbsent &&
    details.mountLeaseReleased &&
    details.recoveryCompleted;
  return Object.freeze({
    status: cleanupConfirmed ? status : ("blocked" as const),
    reason: cleanupConfirmed
      ? reason
      : "docker_process_controller_cleanup_unconfirmed",
    operationId: plan.operationId,
    selectionRecordId: plan.selectionRecordId,
    recoveryId: cleanupConfirmed ? null : recoveryId,
    manualRecoveryRequired: !cleanupConfirmed,
    dockerEffectStarted: true,
    providerRequestStarted: details.providerRequestStarted,
    cancellationRequested: details.cancellationRequested,
    processTreeTerminationConfirmed: details.processTreeTerminationConfirmed,
    containersAbsent: details.containersAbsent,
    networksAbsent: details.networksAbsent,
    mountLeaseReleased: details.mountLeaseReleased,
    recoveryCompleted: details.recoveryCompleted,
    cleanupConfirmed,
    resultSha256:
      cleanupConfirmed && status === "completed" ? details.resultSha256 : null,
    resultBytes:
      cleanupConfirmed && status === "completed" ? details.resultBytes : 0,
    normalizedResult:
      cleanupConfirmed && status === "completed"
        ? details.normalizedResult
        : null,
    subscriptionAuthConfirmed: details.subscriptionAuthConfirmed,
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
    hostPathReported: false,
    proxyCredentialReported: false,
    recoveryFinalizationCapability: cleanupConfirmed
      ? details.recoveryFinalizationCapability
      : null,
  });
}

function isPlanValid(plan: PreparedPlan) {
  const isTaskPlan = plan.operationMode === "isolated_task";
  return (
    (plan.provider === "codex" || plan.provider === "claude") &&
    /^OP-[0-9]{6,}$/u.test(plan.operationId) &&
    (plan.recoveryCorrelationId == null ||
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(plan.recoveryCorrelationId)) &&
    /^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(plan.grantRef) &&
    /^PROFILE-[0-9]{6,}$/u.test(plan.profileId) &&
    /^MODELSEL-[A-Z0-9-]{8,80}$/u.test(plan.selectionRecordId) &&
    plan.subscriptionOffering ===
      (plan.provider === "codex"
        ? "chatgpt_subscription_oauth"
        : "claude_max") &&
    plan.activeMountCapability !== null &&
    typeof plan.activeMountCapability === "object" &&
    plan.authorityUseCapability !== null &&
    typeof plan.authorityUseCapability === "object" &&
    (plan.operationMode === "boolean_probe" || isTaskPlan) &&
    (isTaskPlan
      ? (plan.taskRole === "executor" || plan.taskRole === "reviewer") &&
        /^TASKPKT-[A-F0-9]{32}$/u.test(plan.taskPacketRef ?? "") &&
        /^[a-f0-9]{64}$/u.test(plan.taskPacketHash ?? "") &&
        typeof plan.providerInput === "string" &&
        plan.providerInput.length > 0 &&
        typeof plan.workspaceSourcePath === "string" &&
        plan.workspaceSourcePath.length > 0 &&
        plan.workspaceMountMode ===
          (plan.taskRole === "executor" ? "read_write" : "read_only")
      : plan.taskRole === null &&
        plan.taskPacketRef === null &&
        plan.taskPacketHash === null &&
        plan.providerInput === null &&
        plan.workspaceSourcePath === null &&
        plan.workspaceMountMode === null) &&
    [
      plan.providerContainerName,
      plan.authContainerName,
      plan.proxyContainerName,
      plan.internalNetworkName,
      plan.egressNetworkName,
    ].every((value) => SAFE_IDENTIFIER.test(value)) &&
    /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(plan.ownershipLabel) &&
    /^[a-f0-9]{64}$/u.test(plan.providerHomeIdentityHash) &&
    /^[a-f0-9]{64}$/u.test(plan.providerHomeProtectionHash) &&
    /^[a-f0-9]{64}$/u.test(plan.localUserBindingHash) &&
    /^[a-f0-9]{64}$/u.test(plan.stableLogicalHomeBindingHash) &&
    Array.isArray(plan.commands) &&
    plan.commands.length === PURPOSES.length &&
    plan.commands.every(
      (command, index) =>
        command.purpose === PURPOSES[index] &&
        Array.isArray(command.argv) &&
        command.argv.length > 0 &&
        command.argv.every(
          (value: unknown) =>
            typeof value === "string" &&
            value.length > 0 &&
            !value.includes("\0"),
        ),
    )
  );
}

function subscriptionAuthConfirmed(
  provider: "codex" | "claude",
  expectedOffering: "chatgpt_subscription_oauth" | "claude_max",
  stdout: string,
  stderr: string,
) {
  if (provider === "codex") {
    if (expectedOffering !== "chatgpt_subscription_oauth") return false;
    const normalize = (value: string) => {
      if (value.includes("\0")) return null;
      const normalized = value.replaceAll("\r\n", "\n");
      if (normalized.includes("\r")) return null;
      return normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
    };
    const normalizedStdout = normalize(stdout);
    const normalizedStderr = normalize(stderr);
    if (normalizedStdout === null || normalizedStderr === null) return false;
    const status = "Logged in using ChatGPT";
    const readOnlyAliasWarning =
      "WARNING: proceeding, even though we could not create PATH aliases: Read-only file system (os error 30)";
    return (
      (normalizedStdout === status && normalizedStderr === "") ||
      (normalizedStdout === "" && normalizedStderr === status) ||
      (normalizedStdout === status &&
        normalizedStderr === readOnlyAliasWarning) ||
      (normalizedStdout === "" &&
        normalizedStderr === `${readOnlyAliasWarning}\n${status}`)
    );
  }
  if (expectedOffering !== "claude_max") return false;
  const parsed = parseUnambiguousJsonDocument(stdout);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return false;
  const status = parsed as Record<string, unknown>;
  return (
    status.loggedIn === true &&
    status.authMethod === "claude.ai" &&
    status.apiProvider === "firstParty" &&
    status.forcedLoginMethod === "claudeai" &&
    status.subscriptionType === "max"
  );
}

function classifyExecution(
  execution: CommandExecution | null,
  isProvider: boolean,
  provider: "codex" | "claude",
) {
  if (execution === null)
    return Object.freeze({
      ok: false,
      reason: isProvider
        ? "provider_deadline_exceeded"
        : "docker_setup_deadline_exceeded",
    });
  const stdoutBytes = Buffer.byteLength(execution.stdout, "utf8");
  const stderrBytes = Buffer.byteLength(execution.stderr, "utf8");
  if (
    execution.outputExceeded ||
    stdoutBytes > STDOUT_LIMIT_BYTES ||
    stderrBytes > STDERR_LIMIT_BYTES
  ) {
    return Object.freeze({
      ok: false,
      reason: "provider_output_limit_exceeded",
    });
  }
  if (execution.signal !== null)
    return Object.freeze({ ok: false, reason: "provider_process_signalled" });
  if (execution.status !== 0)
    return Object.freeze({
      ok: false,
      reason: isProvider
        ? classifyProviderNonzeroExit(provider, execution)
        : "docker_setup_command_failed",
    });
  return Object.freeze({
    ok: true,
    reason: "command_completed",
    stdoutBytes,
  });
}

function classifyProviderNonzeroExit(
  provider: "codex" | "claude",
  execution: CommandExecution,
) {
  if (provider === "claude") {
    const envelope = parseUnambiguousJsonDocument(execution.stdout);
    if (
      envelope &&
      typeof envelope === "object" &&
      !Array.isArray(envelope) &&
      (envelope as Record<string, unknown>).type === "result"
    ) {
      const subtype = (envelope as Record<string, unknown>).subtype;
      if (subtype === "error_max_budget_usd")
        return "provider_operation_budget_exceeded";
      if (subtype === "error_max_turns") return "provider_turn_limit_exceeded";
      if (subtype === "error_max_structured_output_retries")
        return "provider_structured_output_retry_exhausted";
    }
  }
  if (
    execution.stderr.includes("\0") ||
    Buffer.byteLength(execution.stderr, "utf8") > 8_192
  )
    return "provider_process_exit_nonzero";
  const diagnostic = execution.stderr
    .replaceAll("\r\n", "\n")
    .trim()
    .toLowerCase();
  if (
    /(?:usage|rate) limit|quota (?:exceeded|exhausted)|credit balance (?:is )?too low|hit your (?:current )?limit/u.test(
      diagnostic,
    )
  )
    return "provider_subscription_quota_exhausted";
  if (
    /authentication (?:failed|required)|oauth (?:token )?expired|not logged in|please (?:run )?(?:\/login|login)|invalid api key/u.test(
      diagnostic,
    )
  )
    return "provider_authentication_expired";
  if (
    /unknown (?:argument|option)|invalid (?:argument|option)|json schema (?:is )?invalid|unsupported model|model (?:is )?not found/u.test(
      diagnostic,
    )
  )
    return "provider_invocation_rejected";
  if (
    /econn(?:refused|reset)|etimedout|enotfound|network error|connection (?:refused|reset|timed out)|proxy (?:connection )?(?:failed|error)/u.test(
      diagnostic,
    )
  )
    return "provider_network_unavailable";
  if (
    /service unavailable|internal server error|overloaded|temporarily unavailable|(?:http |status (?:code )?)5\d\d/u.test(
      diagnostic,
    )
  )
    return "provider_service_unavailable";
  return "provider_process_exit_nonzero";
}

// This is an additional veto, never an authority source. Do not pass plans,
// credentials or capabilities to it, or use it on the existing cleanup path.
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

async function executePlan(
  state: RuntimeState,
  record: ExecutionRecord,
  plan: PreparedPlan,
  recovery: Recovery,
) {
  let reason = "provider_operation_completed";
  let requestedStatus: "completed" | "blocked" | "cancelled" = "completed";
  let providerRequestStarted = false;
  let resultSha256: string | null = null;
  let resultBytes = 0;
  let normalizedResult: unknown | null = null;
  let isSubscriptionAuthConfirmed = false;
  let recoveryFinalizationCapability: object | null = null;

  try {
    for (const command of plan.commands) {
      if (record.cancellationRequested) {
        requestedStatus = "cancelled";
        reason = "provider_operation_cancelled";
        break;
      }
      const isProvider = command.purpose === "start_provider_attached";
      if (
        CREATE_PURPOSES.has(command.purpose) &&
        state.dependencies.markResourceSubmission &&
        !state.dependencies.markResourceSubmission(
          recovery.recoveryCapability,
          command.purpose,
        )
      ) {
        requestedStatus = "blocked";
        reason = "docker_resource_submission_record_unavailable";
        break;
      }
      if (
        !commandRestrictionAllows(record.commandRestriction, command.purpose)
      ) {
        requestedStatus = "blocked";
        reason = "docker_process_controller_execution_restricted";
        break;
      }
      // A synchronous restriction can also cause the owner to request cancel.
      // Neither that re-entrancy nor a preceding await may open a new command.
      if (record.cancellationRequested) {
        requestedStatus = "cancelled";
        reason = "provider_operation_cancelled";
        break;
      }
      const handle = state.dependencies.startCommand(
        command,
        plan,
        record.managementCapability,
      );
      record.activeHandle = handle;
      if (isProvider) {
        const processStarted = await handle.started(CANCELLATION_GRACE_MS);
        if (!processStarted) {
          await handle.terminateAndWait(CANCELLATION_GRACE_MS);
          record.activeHandle = null;
          requestedStatus = "blocked";
          reason = "docker_process_controller_provider_start_failed";
          break;
        }
        providerRequestStarted = true;
        let startObserved = true;
        try {
          startObserved =
            !state.dependencies.reportProviderProcessStarted ||
            (await state.dependencies.reportProviderProcessStarted(
              Object.freeze({
                event: "coordinator_provider_process_started",
                taskRole: plan.taskRole,
                provider: plan.provider,
                operationId: plan.operationId,
              }),
            )) === true;
        } catch {
          startObserved = false;
        }
        if (!startObserved) {
          record.cancellationRequested = true;
          await handle.terminateAndWait(CANCELLATION_GRACE_MS);
          record.activeHandle = null;
          requestedStatus = "blocked";
          reason =
            "docker_process_controller_provider_start_observation_failed";
          break;
        }
      }
      const execution = await handle.wait(
        isProvider ? PROVIDER_TIMEOUT_MS : SETUP_TIMEOUT_MS,
      );
      record.activeHandle = null;
      // A submitted CREATE can have completed while cancellation was requested.
      // Preserve its validated receipt before stopping; otherwise cleanup loses
      // the exact resource ID. Non-CREATE cancellation keeps its prior ordering.
      if (
        record.cancellationRequested &&
        !CREATE_PURPOSES.has(command.purpose)
      ) {
        requestedStatus = "cancelled";
        reason = "provider_operation_cancelled";
        break;
      }
      const classified = classifyExecution(
        execution,
        isProvider,
        plan.provider,
      );
      if (!classified.ok) {
        requestedStatus = "blocked";
        reason = classified.reason;
        if (execution === null)
          await handle.terminateAndWait(CANCELLATION_GRACE_MS);
        break;
      }
      if (
        CREATE_PURPOSES.has(command.purpose) &&
        state.dependencies.recordResourceReceipt &&
        (!execution ||
          !state.dependencies.recordResourceReceipt(
            recovery.recoveryCapability,
            command.purpose,
            execution.stdout,
          ))
      ) {
        requestedStatus = "blocked";
        reason = "docker_resource_receipt_unavailable";
        break;
      }
      if (record.cancellationRequested) {
        requestedStatus = "cancelled";
        reason = "provider_operation_cancelled";
        break;
      }
      if (
        command.purpose === "start_subscription_auth_probe_attached" &&
        execution
      ) {
        if (
          !subscriptionAuthConfirmed(
            plan.provider,
            plan.subscriptionOffering,
            execution.stdout,
            execution.stderr,
          )
        ) {
          requestedStatus = "blocked";
          reason = "provider_subscription_auth_not_confirmed";
          break;
        }
        isSubscriptionAuthConfirmed = true;
      }
      if (isProvider && execution) {
        const providerResult =
          plan.operationMode === "isolated_task"
            ? normalizeProviderTaskStructuredResult(
                plan.provider,
                plan.taskRole,
                plan.selectedEffort,
                execution.stdout,
                plan.taskWorkload,
              )
            : plan.provider === "codex"
              ? normalizeCodexStructuredResult(execution.stdout)
              : normalizeClaudeStructuredResult(execution.stdout);
        if (providerResult.status !== "confirmed") {
          requestedStatus = "blocked";
          reason =
            "reason" in providerResult &&
            typeof providerResult.reason === "string" &&
            BLOCKED_COMPLETION_REASONS.has(providerResult.reason)
              ? providerResult.reason
              : "provider_result_invalid";
          break;
        }
        normalizedResult = providerResult.normalizedResult;
        resultBytes = classified.stdoutBytes ?? 0;
        resultSha256 = createHash("sha256")
          .update(execution.stdout, "utf8")
          .digest("hex");
      }
    }
  } catch {
    requestedStatus = "blocked";
    reason = "docker_process_controller_execution_failed_closed";
  }

  let cleanup: CleanupObservation = Object.freeze({
    confirmed: false,
    processTreeTerminated: false,
    containersAbsent: false,
    networksAbsent: false,
  });
  try {
    cleanup = await state.dependencies.cleanupOwnedResources(
      plan,
      recovery.recoveryCapability,
      record.managementCapability,
    );
  } catch {
    cleanup = Object.freeze({
      confirmed: false,
      processTreeTerminated: false,
      containersAbsent: false,
      networksAbsent: false,
    });
  }
  const processTreeTerminationConfirmed =
    cleanup.confirmed && cleanup.processTreeTerminated;
  let mountLeaseReleased = false;
  let recoveryCompleted = false;
  if (
    processTreeTerminationConfirmed &&
    cleanup.containersAbsent &&
    cleanup.networksAbsent
  ) {
    try {
      const dockerAbsenceRecorded =
        !state.dependencies.recordDockerAbsence ||
        state.dependencies.recordDockerAbsence(recovery.recoveryCapability);
      if (!dockerAbsenceRecorded)
        throw new Error("docker_absence_record_failed");
      mountLeaseReleased =
        state.dependencies.completeMount(
          plan.activeMountCapability,
          record.managementCapability,
        ).status === "completed";
      if (mountLeaseReleased) {
        const mountCompletionRecorded =
          !state.dependencies.recordMountCompletion ||
          state.dependencies.recordMountCompletion(recovery.recoveryCapability);
        if (!mountCompletionRecorded)
          throw new Error("mount_completion_record_failed");
        const completion = state.dependencies.completeRecovery(
          recovery.recoveryCapability,
          record.managementCapability,
        );
        recoveryFinalizationCapability =
          completion.status === "completed" &&
          completion.recoveryFinalizationCapability &&
          typeof completion.recoveryFinalizationCapability === "object"
            ? completion.recoveryFinalizationCapability
            : null;
        recoveryCompleted = recoveryFinalizationCapability !== null;
      }
    } catch {
      mountLeaseReleased = false;
      recoveryCompleted = false;
    }
  }
  if (requestedStatus === "completed") {
    try {
      if (!state.dependencies.verifyRevision(record.managementCapability)) {
        requestedStatus = "blocked";
        reason = "repository_revision_changed";
        resultSha256 = null;
        resultBytes = 0;
        normalizedResult = null;
      }
    } catch {
      requestedStatus = "blocked";
      reason = "repository_revision_changed";
      resultSha256 = null;
      resultBytes = 0;
      normalizedResult = null;
    }
  }
  // Cancellation remains live through cleanup. Re-settle after the final await
  // so a request received during cleanup cannot be published as completed.
  // A failure that already settled as blocked keeps the more specific failure;
  // cancellationRequested remains observable without erasing that diagnosis.
  if (record.cancellationRequested && requestedStatus === "completed") {
    requestedStatus = "cancelled";
    reason = "provider_operation_cancelled";
    resultSha256 = null;
    resultBytes = 0;
    normalizedResult = null;
  }
  return createFinalResult(requestedStatus, reason, plan, recovery.recoveryId, {
    providerRequestStarted,
    cancellationRequested: record.cancellationRequested,
    processTreeTerminationConfirmed,
    containersAbsent: cleanup.containersAbsent,
    networksAbsent: cleanup.networksAbsent,
    mountLeaseReleased,
    recoveryCompleted,
    resultSha256,
    resultBytes,
    normalizedResult,
    subscriptionAuthConfirmed: isSubscriptionAuthConfirmed,
    recoveryFinalizationCapability,
  });
}

function start(
  state: RuntimeState,
  preparedCapability: unknown,
  managementCapability: unknown,
  registerRecoveryHandoff: unknown,
  commandRestriction: unknown,
) {
  if (
    !state.dependencies.effectExecutorAvailable ||
    !managementCapability ||
    typeof managementCapability !== "object"
  ) {
    return createBlockedStart("docker_process_controller_effect_unavailable");
  }
  const plan = state.dependencies.consumePreparedPlan(
    preparedCapability,
    managementCapability,
  );
  if (!plan || !isPlanValid(plan))
    return createBlockedStart("docker_process_controller_plan_invalid");
  if (!state.dependencies.verifyRevision(managementCapability)) {
    const completed = state.dependencies.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
    return createBlockedStart(
      "docker_process_controller_revision_invalid",
      completed.status === "completed",
    );
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
    authority.profileId !== plan.profileId ||
    authority.providerHomeMountGrantRef !== plan.grantRef ||
    authority.runtimeAuthorityIssued !== true ||
    authority.providerEffectAllowed !== true
  ) {
    const completed = state.dependencies.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
    return createBlockedStart(
      "docker_process_controller_authority_invalid",
      completed.status === "completed",
    );
  }
  const recovery = state.dependencies.beginRecovery(
    Object.freeze({
      ...plan,
      recoveryCorrelationId: plan.recoveryCorrelationId ?? null,
    }),
    managementCapability,
  );
  const readyRecovery = snapshotReadyRecovery(recovery);
  if (!readyRecovery) {
    const malformedCapability = ownDataValue(recovery, "recoveryCapability");
    const malformedRecoveryId = publicVerifiedDockerRecoveryId(
      ownDataValue(recovery, "recoveryId"),
    );
    const exactBlocked = snapshotBlockedRecoveryWithExactId(
      recovery,
      plan.stableLogicalHomeBindingHash,
    );
    if (!malformedCapability && exactBlocked) {
      const completed = state.dependencies.completeMount(
        plan.activeMountCapability,
        managementCapability,
      );
      return createBlockedStart(
        publicDockerRecoveryStartReason(exactBlocked.reason),
        completed.status === "completed",
        exactBlocked.recoveryId,
        true,
      );
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
    return createBlockedStart(
      publicDockerRecoveryStartReason(ownDataValue(recovery, "reason")),
      completed.status === "completed",
      malformedRecoveryId,
      ownDataValue(recovery, "manualRecoveryRequired") === true,
    );
  }
  const parsedRecoveryId = parseDockerTaskRecoveryId(readyRecovery.recoveryId);
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
  const controlCapability = Object.freeze({});
  const record: ExecutionRecord = {
    managementCapability,
    commandRestriction,
    cancellationRequested: false,
    activeHandle: null,
    completion: null,
  };
  state.controls.set(controlCapability, record);
  const completion = executePlan(state, record, plan, readyRecovery).finally(
    () => {
      state.controls.delete(controlCapability);
    },
  );
  record.completion = completion;
  return Object.freeze({
    status: "started" as const,
    reason: "docker_process_controller_started",
    controlCapability,
    completion,
    operationId: plan.operationId,
    recoveryId: parsedRecoveryId.token,
    dockerEffectStarted: true,
    providerRequestStarted: false,
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
    normalizedResult: null,
    normalizedResultReportedAfterCleanupOnly: true,
    hostPathReported: false,
    proxyCredentialReported: false,
  });
}

async function cancel(
  state: RuntimeState,
  controlCapability: unknown,
  managementCapability: unknown,
) {
  if (!controlCapability || typeof controlCapability !== "object")
    return Object.freeze({ status: "blocked" as const, reason: "invalid" });
  const record = state.controls.get(controlCapability);
  if (!record || record.managementCapability !== managementCapability)
    return Object.freeze({ status: "blocked" as const, reason: "invalid" });
  if (record.cancellationRequested)
    return Object.freeze({ status: "blocked" as const, reason: "duplicate" });
  record.cancellationRequested = true;
  const terminated = record.activeHandle
    ? await record.activeHandle.terminateAndWait(CANCELLATION_GRACE_MS)
    : true;
  return Object.freeze({
    status: "requested" as const,
    reason: terminated
      ? "provider_cancellation_requested"
      : "provider_cancellation_grace_exceeded",
    cancellationRequested: true,
    processTerminationObserved: terminated,
  });
}

const productionState: RuntimeState = Object.freeze({
  dependencies: Object.freeze({
    effectExecutorAvailable: true,
    verifyRevision: verifyRuntimeOwnedRepositoryOperation,
    consumePreparedPlan: (
      preparedCapability: unknown,
      managementCapability: unknown,
    ) =>
      consumeRuntimeOwnedClaudeDockerPlanForProcessController(
        preparedCapability,
        managementCapability,
      ) ??
      consumeRuntimeOwnedCodexDockerPlanForProcessController(
        preparedCapability,
        managementCapability,
      ),
    beginRecovery: beginRuntimeOwnedDockerRecovery,
    abandonRecovery: abandonRuntimeOwnedDockerRecovery,
    verifyRecoveryBinding: verifyRuntimeOwnedDockerRecoveryBinding,
    startCommand: startRuntimeOwnedDockerCommand,
    cleanupOwnedResources: cleanupRuntimeOwnedDockerResources,
    completeMount: completeRuntimeOwnedProviderHomeMount,
    completeRecovery: completeRuntimeOwnedDockerRecovery,
    markResourceSubmission: markRuntimeOwnedDockerResourceSubmission,
    recordResourceReceipt: recordRuntimeOwnedDockerResourceReceipt,
    recordDockerAbsence: recordRuntimeOwnedDockerAbsence,
    recordMountCompletion: recordRuntimeOwnedNormalMountCompletion,
    reportProviderProcessStarted: createRuntimeOwnedLifecycleNoticeReporter(
      process.stderr,
    ),
    consumeProviderAuthority: consumeRuntimeOwnedProviderAuthority,
  }),
  controls: new WeakMap(),
});

export function startRuntimeOwnedDockerProcessController(
  preparedCapability: unknown,
  managementCapability: unknown,
  registerRecoveryHandoff?: unknown,
  commandRestriction?: unknown,
) {
  try {
    return start(
      productionState,
      preparedCapability,
      managementCapability,
      registerRecoveryHandoff,
      commandRestriction,
    );
  } catch {
    return createBlockedStart("docker_process_controller_start_failed_closed");
  }
}

export async function cancelRuntimeOwnedDockerProcessController(
  controlCapability: unknown,
  managementCapability: unknown,
) {
  try {
    return await cancel(
      productionState,
      controlCapability,
      managementCapability,
    );
  } catch {
    return Object.freeze({ status: "blocked" as const, reason: "invalid" });
  }
}

export function createIsolatedDockerProcessControllerCandidate(
  dependencies: RuntimeDependencies,
) {
  const state: RuntimeState = Object.freeze({
    dependencies: Object.freeze(dependencies),
    controls: new WeakMap(),
  });
  return Object.freeze({
    productionAuthority: false as const,
    start: (
      preparedCapability: unknown,
      managementCapability: unknown,
      registerRecoveryHandoff: unknown = () => true,
      commandRestriction?: unknown,
    ) => {
      try {
        return start(
          state,
          preparedCapability,
          managementCapability,
          registerRecoveryHandoff,
          commandRestriction,
        );
      } catch {
        return createBlockedStart(
          "docker_process_controller_start_failed_closed",
        );
      }
    },
    cancel: (controlCapability: unknown, managementCapability: unknown) =>
      cancel(state, controlCapability, managementCapability),
  });
}

export function describeDockerProcessControllerContract() {
  return Object.freeze({
    contract: DOCKER_PROCESS_CONTROLLER_CONTRACT,
    contractRevision: DOCKER_PROCESS_CONTROLLER_CONTRACT_REVISION,
    setupTimeoutMs: SETUP_TIMEOUT_MS,
    providerTimeoutMs: PROVIDER_TIMEOUT_MS,
    cancellationGraceMs: CANCELLATION_GRACE_MS,
    stdoutLimitBytes: STDOUT_LIMIT_BYTES,
    stderrLimitBytes: STDERR_LIMIT_BYTES,
    preparedPlan: "opaque_single_use_adapter_capability_only",
    recoveryBeforeDockerEffect: true,
    resourceJournal:
      "durable_submission_before_each_create_and_exact_id_receipt_after_success",
    providerAuthority:
      "opaque_single_use_reverified_and_consumed_before_recovery_or_docker_effect",
    additionalCommandRestriction:
      "optional_synchronous_exact_true_veto_before_each_command_never_authority_or_cleanup_gate",
    subscriptionAuthentication:
      "network_none_read_only_provider_home_probe_with_exact_provider_stdout_stderr_shape_required_before_provider_request",
    subscriptionOffering:
      "chatgpt_subscription_oauth_or_claude_max_exact_match_required",
    cancellation: "opaque_control_capability_exactly_once",
    cleanup:
      "owned_containers_and_networks_absent_then_mount_release_then_recovery_complete",
    cleanupFailure: "manual_recovery_required_fail_closed",
    structuredResult:
      "exact_provider_boolean_or_role_task_result_published_after_cleanup_only",
    providerFailureClassification:
      "known_operational_nonzero_output_mapped_to_closed_public_reason_unknown_output_kept_generic",
    providerTextPublication: "validated_then_discarded_not_reported",
    credentialAbsenceVerification: "not_claimed",
    taskPrompt: "runtime_owned_stdin_only_not_reported",
    rawOutputReported: false,
    hostPathReported: false,
    proxyCredentialReported: false,
    productionPreparedPlan: "runtime_owned_adapter_connected",
    productionRecovery:
      "runtime_state_docker_task_recovery_and_deferred_host_finalization_connected",
    productionMountCompletion: "runtime_owned_mount_lease_connected",
    productionRevisionBinding: "runtime_owned_repository_revision_connected",
    productionEffectExecutor: "fixed_docker_cli_connected",
  });
}
