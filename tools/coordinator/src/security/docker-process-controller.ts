import { createHash } from "node:crypto";

import { consumeRuntimeOwnedClaudeDockerPlanForProcessController } from "./claude-docker-runtime-adapter.ts";
import { normalizeClaudeStructuredResult } from "./claude-structured-result.ts";
import { consumeRuntimeOwnedCodexDockerPlanForProcessController } from "./codex-docker-runtime-adapter.ts";
import { normalizeCodexStructuredResult } from "./codex-structured-result.ts";
import { normalizeProviderTaskStructuredResult } from "./provider-task-structured-result.ts";
import { parseUnambiguousJsonDocument } from "./claude-structured-result.ts";
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
import {
  cleanupRuntimeOwnedDockerResources,
  startRuntimeOwnedDockerCommand,
} from "./docker-effect-runtime.ts";
import { consumeRuntimeOwnedProviderAuthority } from "./provider-authority-runtime.ts";
import { completeRuntimeOwnedProviderHomeMount } from "./provider-home-mount-grant-runtime.ts";
import { verifyRuntimeOwnedRepositoryOperation } from "./repository-operation-runtime.ts";
import {
  publicDockerRecoveryStartReason,
  publicVerifiedDockerRecoveryId,
} from "./docker-recovery-public-projection.ts";
import { parseDockerTaskRecoveryId } from "./docker-recovery-identity.ts";

export const DOCKER_PROCESS_CONTROLLER_CONTRACT =
  "crdd-coordinator/docker-process-controller";
export const DOCKER_PROCESS_CONTROLLER_CONTRACT_REVISION = 14;

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
const SAFE_IDENTIFIER =
  /^crdd-(?:auth|internal|egress|proxy|claude|codex)-[a-f0-9]{16}$/u;

type Command = Readonly<{ purpose: string; argv: readonly string[] }>;
type PreparedPlan = Readonly<{
  provider: "codex" | "claude";
  operationId: string;
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
  cancellationRequested: boolean;
  activeHandle: CommandHandle | null;
  completion: Promise<ExecutionResult> | null;
};
type RuntimeState = Readonly<{
  dependencies: RuntimeDependencies;
  controls: WeakMap<object, ExecutionRecord>;
}>;
type ExecutionResult = ReturnType<typeof createFinalResult>;

function ownDataValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
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
) {
  if (provider === "codex")
    return (
      expectedOffering === "chatgpt_subscription_oauth" &&
      stdout.trim() === "Logged in using ChatGPT"
    );
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
        ? "provider_process_exit_nonzero"
        : "docker_setup_command_failed",
    });
  return Object.freeze({
    ok: true,
    reason: "command_completed",
    stdoutBytes,
  });
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
      if (isProvider) providerRequestStarted = true;
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
      const handle = state.dependencies.startCommand(
        command,
        plan,
        record.managementCapability,
      );
      record.activeHandle = handle;
      const execution = await handle.wait(
        isProvider ? PROVIDER_TIMEOUT_MS : SETUP_TIMEOUT_MS,
      );
      record.activeHandle = null;
      if (record.cancellationRequested) {
        requestedStatus = "cancelled";
        reason = "provider_operation_cancelled";
        break;
      }
      const classified = classifyExecution(execution, isProvider);
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
      if (
        command.purpose === "start_subscription_auth_probe_attached" &&
        execution
      ) {
        if (
          !subscriptionAuthConfirmed(
            plan.provider,
            plan.subscriptionOffering,
            execution.stdout,
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
              )
            : plan.provider === "codex"
              ? normalizeCodexStructuredResult(execution.stdout)
              : normalizeClaudeStructuredResult(execution.stdout);
        if (providerResult.status !== "confirmed") {
          requestedStatus = "blocked";
          reason = "provider_result_invalid";
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
        recoveryCompleted = completion.status === "completed";
        recoveryFinalizationCapability =
          recoveryCompleted && completion.recoveryFinalizationCapability
            ? completion.recoveryFinalizationCapability
            : null;
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
  const recovery = state.dependencies.beginRecovery(plan, managementCapability);
  const readyRecovery = snapshotReadyRecovery(recovery);
  if (!readyRecovery) {
    const malformedCapability = ownDataValue(recovery, "recoveryCapability");
    const malformedRecoveryId = publicVerifiedDockerRecoveryId(
      ownDataValue(recovery, "recoveryId"),
    );
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
    consumeProviderAuthority: consumeRuntimeOwnedProviderAuthority,
  }),
  controls: new WeakMap(),
});

export function startRuntimeOwnedDockerProcessController(
  preparedCapability: unknown,
  managementCapability: unknown,
  registerRecoveryHandoff?: unknown,
) {
  try {
    return start(
      productionState,
      preparedCapability,
      managementCapability,
      registerRecoveryHandoff,
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
    ) => {
      try {
        return start(
          state,
          preparedCapability,
          managementCapability,
          registerRecoveryHandoff,
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
    subscriptionAuthentication:
      "network_none_read_only_provider_home_probe_required_before_provider_request",
    subscriptionOffering:
      "chatgpt_subscription_oauth_or_claude_max_exact_match_required",
    cancellation: "opaque_control_capability_exactly_once",
    cleanup:
      "owned_containers_and_networks_absent_then_mount_release_then_recovery_complete",
    cleanupFailure: "manual_recovery_required_fail_closed",
    structuredResult:
      "exact_provider_boolean_or_role_task_result_published_after_cleanup_only",
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
