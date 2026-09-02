import { types as utilTypes } from "node:util";

export const PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT =
  "crdd-coordinator/project-runtime-single-task-adapter" as const;
export const PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT_REVISION = 1;

const STABLE_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const REPOSITORY_REVISION = /^[0-9a-f]{40,64}$/u;

/**
 * Pre-effect rejections thrown by the v0.18 Single Task Runtime before any
 * provider, container or repository effect starts. Exported so a binding test
 * can reconcile this population against the actual throw sites of
 * coordinator-task-runtime.ts. Any other synchronous throw is treated as
 * effect-unknown and fails closed.
 */
export const PROJECT_RUNTIME_SINGLE_TASK_PRE_EFFECT_REJECTIONS = Object.freeze([
  "coordinator_task_process_restart_required",
  "coordinator_task_runtime_cleanup_in_progress",
  "coordinator_task_release_verification_required",
] as const);

const preEffectRejectionSet: ReadonlySet<string> = new Set(
  PROJECT_RUNTIME_SINGLE_TASK_PRE_EFFECT_REJECTIONS,
);

export type ProjectRuntimeSingleTaskAttemptInput = Readonly<{
  attemptId: string;
  repositoryRevision: string;
  taskAuthorityCapability: object;
  taskRequest: unknown;
  repositoryRoot: unknown;
  cancellationSignal: AbortSignal;
}>;

export type ProjectRuntimeSingleTaskResult = Readonly<{
  contract: typeof PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT;
  attemptId: string | null;
  repositoryRevision: string | null;
  status: "completed" | "blocked" | "cancelled";
  reason: string;
  effectState: "no_effect" | "settled" | "unknown";
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired: boolean;
  candidateId: string | null;
  recoveryIds: readonly string[];
}>;

export type ProjectRuntimeSingleTaskDependencies = Readonly<{
  startTask: (
    taskRequest: unknown,
    repositoryRoot: unknown,
    taskAuthorityCapability: object,
  ) => unknown;
  cancelTask: (controlCapability: object) => unknown;
}>;

function result(
  input: Readonly<{
    attemptId: string | null;
    repositoryRevision: string | null;
    status: "completed" | "blocked" | "cancelled";
    reason: string;
    effectState: "no_effect" | "settled" | "unknown";
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
    candidateId: string | null;
    recoveryIds: readonly string[];
  }>,
): ProjectRuntimeSingleTaskResult {
  return Object.freeze({
    contract: PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT,
    ...input,
    recoveryIds: Object.freeze([...input.recoveryIds]),
  });
}

function rejectedWithoutEffect(
  attemptId: string | null,
  repositoryRevision: string | null,
  reason: string,
  processRestartRequired = false,
): ProjectRuntimeSingleTaskResult {
  return result({
    attemptId,
    repositoryRevision,
    status: "blocked",
    reason,
    effectState: "no_effect",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired,
    candidateId: null,
    recoveryIds: [],
  });
}

function failedClosedUnknown(
  attemptId: string | null,
  repositoryRevision: string | null,
  reason: string,
): ProjectRuntimeSingleTaskResult {
  return result({
    attemptId,
    repositoryRevision,
    status: "blocked",
    reason,
    effectState: "unknown",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: false,
    candidateId: null,
    recoveryIds: [],
  });
}

function validText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !value.includes("\0")
  );
}

function optionalIdentity(value: unknown): value is string | null {
  return value === null || validText(value, 512);
}

function isOpaqueCapability(value: unknown): value is object {
  return (
    typeof value === "object" && value !== null && !utilTypes.isProxy(value)
  );
}

/**
 * Read one own data property exactly once. Accessor properties, prototype
 * lookups and repeated reads are rejected so a hostile record cannot return a
 * validated value first and a different value later (single-read discipline
 * shared with plain-data-snapshot.ts).
 */
function ownDataProperty(container: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(container, key);
  if (
    !descriptor ||
    !Object.hasOwn(descriptor, "value") ||
    descriptor.get !== undefined ||
    descriptor.set !== undefined
  )
    return undefined;
  return descriptor.value;
}

function isPlainContainer(value: unknown): value is object {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function inspectStartedTask(value: unknown): Readonly<{
  controlCapability: object;
  completion: Promise<unknown>;
}> | null {
  try {
    if (!isPlainContainer(value)) return null;
    const controlCapability = ownDataProperty(value, "controlCapability");
    const completion = ownDataProperty(value, "completion");
    if (
      ownDataProperty(value, "status") !== "started" ||
      !isOpaqueCapability(controlCapability) ||
      !(completion instanceof Promise)
    )
      return null;
    return Object.freeze({ controlCapability, completion });
  } catch {
    return null;
  }
}

function inspectCompletionRecord(value: unknown): Readonly<{
  status: "completed" | "blocked";
  reason: string;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired: boolean;
  candidateId: string | null;
  recoveryIds: readonly string[];
}> | null {
  try {
    if (!isPlainContainer(value)) return null;
    const status = ownDataProperty(value, "status");
    const reason = ownDataProperty(value, "reason");
    const cleanupConfirmed = ownDataProperty(value, "cleanupConfirmed");
    const manualRecoveryRequired = ownDataProperty(
      value,
      "manualRecoveryRequired",
    );
    const processRestartRequired = ownDataProperty(
      value,
      "processRestartRequired",
    );
    const candidateId = ownDataProperty(value, "candidateId");
    const hostRecoveryId = ownDataProperty(value, "hostRecoveryId");
    const candidateRecoveryId = ownDataProperty(value, "candidateRecoveryId");
    const candidateStoreRecoveryId = ownDataProperty(
      value,
      "candidateStoreRecoveryId",
    );
    const rawDockerRecoveryIds = ownDataProperty(value, "dockerRecoveryIds");
    // The v0.18 completion record never carries status "cancelled": effect-era
    // cancellation settles as "blocked" with a runtime-owned cancellation
    // reason, and accepting values the producer cannot emit would widen the
    // observation surface beyond the real contract.
    if (
      (status !== "completed" && status !== "blocked") ||
      !validText(reason, 256) ||
      typeof cleanupConfirmed !== "boolean" ||
      typeof manualRecoveryRequired !== "boolean" ||
      typeof processRestartRequired !== "boolean" ||
      !optionalIdentity(candidateId) ||
      !optionalIdentity(hostRecoveryId) ||
      !optionalIdentity(candidateRecoveryId) ||
      !optionalIdentity(candidateStoreRecoveryId) ||
      !Array.isArray(rawDockerRecoveryIds) ||
      utilTypes.isProxy(rawDockerRecoveryIds) ||
      rawDockerRecoveryIds.length > 128 ||
      (status === "completed" && cleanupConfirmed !== true)
    )
      return null;
    const dockerRecoveryIds: string[] = [];
    for (let index = 0; index < rawDockerRecoveryIds.length; index += 1) {
      const id = ownDataProperty(rawDockerRecoveryIds, String(index));
      if (!validText(id, 512)) return null;
      dockerRecoveryIds.push(id);
    }
    const recoveryIds = [
      ...new Set(
        [
          hostRecoveryId,
          ...dockerRecoveryIds,
          candidateRecoveryId,
          candidateStoreRecoveryId,
        ].filter((id): id is string => typeof id === "string"),
      ),
    ];
    return Object.freeze({
      status,
      reason,
      cleanupConfirmed,
      manualRecoveryRequired,
      processRestartRequired,
      candidateId,
      recoveryIds: Object.freeze(recoveryIds),
    });
  } catch {
    return null;
  }
}

/**
 * IF-SINGLE-TASK adapter: run exactly one task attempt on the existing v0.18
 * Single Task Runtime and return a closed structured result bound to the
 * attempt identity and the fixed repository revision. The adapter owns only
 * the attempt binding, cancellation forwarding and result observation; the
 * task request schema, provider effects, candidate store and recovery remain
 * owned by the underlying runtime. It never owns project state, follow-up
 * task creation or objective/milestone acceptance.
 */
export async function runProjectRuntimeSingleTaskAttempt(
  dependencies: ProjectRuntimeSingleTaskDependencies,
  input: ProjectRuntimeSingleTaskAttemptInput,
): Promise<ProjectRuntimeSingleTaskResult> {
  if (
    !input ||
    typeof input !== "object" ||
    !validText(input.attemptId, 128) ||
    !STABLE_IDENTITY.test(input.attemptId) ||
    typeof input.repositoryRevision !== "string" ||
    !REPOSITORY_REVISION.test(input.repositoryRevision) ||
    !isOpaqueCapability(input.taskAuthorityCapability) ||
    !(input.cancellationSignal instanceof AbortSignal)
  )
    return rejectedWithoutEffect(null, null, "single_task_input_invalid");
  const attemptId = input.attemptId;
  const repositoryRevision = input.repositoryRevision;
  if (input.cancellationSignal.aborted)
    return result({
      attemptId,
      repositoryRevision,
      status: "cancelled",
      reason: "single_task_cancelled_before_effect",
      effectState: "no_effect",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      candidateId: null,
      recoveryIds: [],
    });
  let rawStarted: unknown;
  try {
    rawStarted = dependencies.startTask(
      input.taskRequest,
      input.repositoryRoot,
      input.taskAuthorityCapability,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (preEffectRejectionSet.has(message))
      return rejectedWithoutEffect(
        attemptId,
        repositoryRevision,
        message,
        message === "coordinator_task_process_restart_required",
      );
    return failedClosedUnknown(
      attemptId,
      repositoryRevision,
      "single_task_start_observation_invalid",
    );
  }
  const started = inspectStartedTask(rawStarted);
  if (!started)
    return failedClosedUnknown(
      attemptId,
      repositoryRevision,
      "single_task_start_observation_invalid",
    );
  let cancellationTransferred = false;
  const forwardCancellation = () => {
    if (cancellationTransferred) return;
    cancellationTransferred = true;
    try {
      const settlement = dependencies.cancelTask(started.controlCapability);
      if (settlement instanceof Promise)
        settlement.catch(() => {
          // Cancellation settlement is owned by the runtime's completion
          // record; an asynchronously failing cancel entry must not become an
          // unhandled rejection while the completion is still observed.
        });
    } catch {
      // Cancellation settlement is owned by the runtime's completion record;
      // a throwing cancel entry must not detach the completion observation.
    }
  };
  input.cancellationSignal.addEventListener("abort", forwardCancellation, {
    once: true,
  });
  // A signal aborted synchronously during startTask never fires a listener
  // registered afterwards, so re-check once; {once: true} keeps the total
  // forwarding at one.
  if (input.cancellationSignal.aborted) forwardCancellation();
  let rawCompletion: unknown;
  try {
    rawCompletion = await started.completion;
  } catch {
    return failedClosedUnknown(
      attemptId,
      repositoryRevision,
      "single_task_completion_observation_invalid",
    );
  } finally {
    input.cancellationSignal.removeEventListener("abort", forwardCancellation);
  }
  const completion = inspectCompletionRecord(rawCompletion);
  if (!completion)
    return failedClosedUnknown(
      attemptId,
      repositoryRevision,
      "single_task_completion_observation_invalid",
    );
  const recoveryOrCleanupUnknown =
    completion.cleanupConfirmed !== true ||
    completion.manualRecoveryRequired === true ||
    completion.recoveryIds.length > 0;
  const completionStatus =
    recoveryOrCleanupUnknown && completion.status === "completed"
      ? "blocked"
      : completion.status;
  const completionReason =
    recoveryOrCleanupUnknown && completion.status === "completed"
      ? "single_task_completion_cleanup_unknown"
      : completion.reason;
  return result({
    attemptId,
    repositoryRevision,
    status: completionStatus,
    reason: completionReason,
    effectState: recoveryOrCleanupUnknown ? "unknown" : "settled",
    cleanupConfirmed: completion.cleanupConfirmed,
    manualRecoveryRequired: recoveryOrCleanupUnknown
      ? true
      : completion.manualRecoveryRequired,
    processRestartRequired: completion.processRestartRequired,
    candidateId: completion.candidateId,
    recoveryIds: completion.recoveryIds,
  });
}

export function describeProjectRuntimeSingleTaskAdapterContract() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT,
    contractRevision: PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT_REVISION,
    taskRequestSchemaOwnership: "single_task_runtime",
    projectStateOwnership: "none",
    followUpTaskCreation: "none",
    acceptanceOwnership: "none",
    unknownSettlement: "fail_closed_manual_recovery",
    effectCancellationRepresentation:
      "pre_effect_adapter_owned_cancelled_and_effect_era_runtime_owned_blocked_reason",
  });
}
