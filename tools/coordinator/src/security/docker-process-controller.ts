import { createHash } from "node:crypto";

import { consumeRuntimeOwnedClaudeDockerPlanForProcessController } from "./claude-docker-runtime-adapter.ts";
import { normalizeClaudeStructuredResult } from "./claude-structured-result.ts";
import {
  beginRuntimeOwnedDockerRecovery,
  completeRuntimeOwnedDockerRecovery,
} from "./docker-recovery-runtime.ts";
import {
  cleanupRuntimeOwnedDockerResources,
  startRuntimeOwnedDockerCommand,
} from "./docker-effect-runtime.ts";
import { consumeRuntimeOwnedProviderAuthority } from "./provider-authority-runtime.ts";
import { completeRuntimeOwnedProviderHomeMount } from "./provider-home-mount-grant-runtime.ts";
import { verifyRuntimeOwnedRepositoryOperation } from "./repository-operation-runtime.ts";

export const DOCKER_PROCESS_CONTROLLER_CONTRACT =
  "crdd-coordinator/docker-process-controller";
export const DOCKER_PROCESS_CONTROLLER_CONTRACT_REVISION = 5;

const SETUP_TIMEOUT_MS = 10_000;
const PROVIDER_TIMEOUT_MS = 300_000;
const CANCELLATION_GRACE_MS = 5_000;
const STDOUT_LIMIT_BYTES = 1_048_576;
const STDERR_LIMIT_BYTES = 262_144;
const PURPOSES = Object.freeze([
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "connect_proxy_internal",
  "connect_proxy_egress",
  "create_provider",
  "connect_provider_internal",
  "start_proxy",
  "start_provider_attached",
]);
const SAFE_IDENTIFIER = /^crdd-(?:internal|egress|proxy|claude)-[a-f0-9]{16}$/u;

type Command = Readonly<{ purpose: string; argv: readonly string[] }>;
type PreparedPlan = Readonly<{
  operationId: string;
  grantRef: string;
  profileId: string;
  activeMountCapability: object;
  authorityUseCapability: object;
  providerHomeSourcePath: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  selectionRecordId: string;
  selectedModel: string;
  selectedEffort: "low" | "medium" | "high";
  selectedModelTier: string;
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
  recoveryId: string;
  recoveryCapability: object;
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
  ) => Recovery | null;
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
  ) => Readonly<{ status: string }>;
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

function createBlockedStart(reason: string, preEffectCleanupConfirmed = false) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    controlCapability: null,
    completion: null,
    operationId: null,
    recoveryId: null,
    cleanupConfirmed: preEffectCleanupConfirmed,
    manualRecoveryRequired: !preEffectCleanupConfirmed,
    dockerEffectStarted: false,
    providerRequestStarted: false,
    normalizedResult: null,
    rawOutputReported: false,
    hostPathReported: false,
    proxyCredentialReported: false,
  });
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
    normalizedResult: Readonly<{ status: true }> | null;
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
    rawOutputReported: false,
    hostPathReported: false,
    proxyCredentialReported: false,
  });
}

function isPlanValid(plan: PreparedPlan) {
  return (
    /^OP-[0-9]{6,}$/u.test(plan.operationId) &&
    /^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(plan.grantRef) &&
    /^PROFILE-[0-9]{6,}$/u.test(plan.profileId) &&
    /^MODELSEL-[A-Z0-9-]{8,80}$/u.test(plan.selectionRecordId) &&
    plan.activeMountCapability !== null &&
    typeof plan.activeMountCapability === "object" &&
    plan.authorityUseCapability !== null &&
    typeof plan.authorityUseCapability === "object" &&
    [
      plan.providerContainerName,
      plan.proxyContainerName,
      plan.internalNetworkName,
      plan.egressNetworkName,
    ].every((value) => SAFE_IDENTIFIER.test(value)) &&
    /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(plan.ownershipLabel) &&
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
  let normalizedResult: Readonly<{ status: true }> | null = null;

  try {
    for (const command of plan.commands) {
      if (record.cancellationRequested) {
        requestedStatus = "cancelled";
        reason = "provider_operation_cancelled";
        break;
      }
      const isProvider = command.purpose === "start_provider_attached";
      if (isProvider) providerRequestStarted = true;
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
      if (isProvider && execution) {
        const providerResult = normalizeClaudeStructuredResult(
          execution.stdout,
        );
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
      mountLeaseReleased =
        state.dependencies.completeMount(
          plan.activeMountCapability,
          record.managementCapability,
        ).status === "completed";
      if (mountLeaseReleased) {
        recoveryCompleted =
          state.dependencies.completeRecovery(
            recovery.recoveryCapability,
            record.managementCapability,
          ).status === "completed";
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
  });
}

function start(
  state: RuntimeState,
  preparedCapability: unknown,
  managementCapability: unknown,
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
    authority.provider !== "claude" ||
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
  if (!recovery) {
    const completed = state.dependencies.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
    return createBlockedStart(
      "docker_process_controller_recovery_unavailable",
      completed.status === "completed",
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
  const completion = executePlan(state, record, plan, recovery).finally(() => {
    state.controls.delete(controlCapability);
  });
  record.completion = completion;
  return Object.freeze({
    status: "started" as const,
    reason: "docker_process_controller_started",
    controlCapability,
    completion,
    operationId: plan.operationId,
    recoveryId: recovery.recoveryId,
    dockerEffectStarted: true,
    providerRequestStarted: false,
    rawOutputReported: false,
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
    consumePreparedPlan:
      consumeRuntimeOwnedClaudeDockerPlanForProcessController,
    beginRecovery: beginRuntimeOwnedDockerRecovery,
    startCommand: startRuntimeOwnedDockerCommand,
    cleanupOwnedResources: cleanupRuntimeOwnedDockerResources,
    completeMount: completeRuntimeOwnedProviderHomeMount,
    completeRecovery: completeRuntimeOwnedDockerRecovery,
    consumeProviderAuthority: consumeRuntimeOwnedProviderAuthority,
  }),
  controls: new WeakMap(),
});

export function startRuntimeOwnedDockerProcessController(
  preparedCapability: unknown,
  managementCapability: unknown,
) {
  try {
    return start(productionState, preparedCapability, managementCapability);
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
    start: (preparedCapability: unknown, managementCapability: unknown) => {
      try {
        return start(state, preparedCapability, managementCapability);
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
    providerAuthority:
      "opaque_single_use_reverified_and_consumed_before_recovery_or_docker_effect",
    cancellation: "opaque_control_capability_exactly_once",
    cleanup:
      "owned_containers_and_networks_absent_then_mount_release_then_recovery_complete",
    cleanupFailure: "manual_recovery_required_fail_closed",
    structuredResult:
      "exact_claude_boolean_result_published_after_cleanup_only",
    rawOutputReported: false,
    hostPathReported: false,
    proxyCredentialReported: false,
    productionPreparedPlan: "runtime_owned_adapter_connected",
    productionRecovery: "durable_host_recovery_connected",
    productionMountCompletion: "runtime_owned_mount_lease_connected",
    productionRevisionBinding: "runtime_owned_repository_revision_connected",
    productionEffectExecutor: "fixed_docker_cli_connected",
  });
}
