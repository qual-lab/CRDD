import { types as utilTypes } from "node:util";

import { isProjectRuntimeRecoveryIdentity } from "./project-runtime-state.ts";

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
  operationId: string;
  authorityBindingId: string;
  repositoryRevision: string;
  taskAuthorityCapability: object;
  taskRequest: unknown;
  repositoryRoot: unknown;
  cancellationSignal: AbortSignal;
  observeStarted?: () => Promise<boolean>;
}>;

export type ProjectRuntimeSingleTaskRecoveryObligation = Readonly<{
  kind: "host" | "docker" | "candidate" | "candidate_store";
  recoveryId: string;
}>;

export type ProjectRuntimeSingleTaskResult = Readonly<{
  contract: typeof PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT;
  attemptId: string | null;
  operationId: string | null;
  authorityBindingId: string | null;
  repositoryRevision: string | null;
  status: "completed" | "blocked" | "cancelled";
  reason: string;
  effectState: "no_effect" | "settled" | "unknown";
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired: boolean;
  candidateId: string | null;
  recoveryIds: readonly string[];
  recoveryObligations?: readonly ProjectRuntimeSingleTaskRecoveryObligation[];
  executorProvider?: "codex" | "claude";
}>;

export type ProjectRuntimeSingleTaskDependencies = Readonly<{
  startTask: (
    taskRequest: unknown,
    repositoryRoot: unknown,
    taskAuthorityCapability: object,
    recoveryCorrelationId?: string,
  ) => unknown;
  cancelTask: (controlCapability: object) => unknown;
}>;

function result(
  input: Readonly<{
    attemptId: string | null;
    operationId: string | null;
    authorityBindingId: string | null;
    repositoryRevision: string | null;
    status: "completed" | "blocked" | "cancelled";
    reason: string;
    effectState: "no_effect" | "settled" | "unknown";
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
    candidateId: string | null;
    recoveryIds: readonly string[];
    recoveryObligations?: readonly ProjectRuntimeSingleTaskRecoveryObligation[];
    executorProvider?: "codex" | "claude";
  }>,
): ProjectRuntimeSingleTaskResult {
  return Object.freeze({
    contract: PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT,
    ...input,
    recoveryIds: Object.freeze([...input.recoveryIds]),
    recoveryObligations: Object.freeze([...(input.recoveryObligations ?? [])]),
  });
}

function rejectedWithoutEffect(
  attemptId: string | null,
  operationId: string | null,
  authorityBindingId: string | null,
  repositoryRevision: string | null,
  reason: string,
  processRestartRequired = false,
): ProjectRuntimeSingleTaskResult {
  return result({
    attemptId,
    operationId,
    authorityBindingId,
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
  operationId: string | null,
  authorityBindingId: string | null,
  repositoryRevision: string | null,
  reason: string,
): ProjectRuntimeSingleTaskResult {
  return result({
    attemptId,
    operationId,
    authorityBindingId,
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
  recoveryObligations: readonly ProjectRuntimeSingleTaskRecoveryObligation[];
  executorProvider?: "codex" | "claude";
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
    const executorProvider = ownDataProperty(value, "executorProvider");
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
      (executorProvider !== undefined &&
        executorProvider !== "codex" &&
        executorProvider !== "claude") ||
      (status === "completed" && cleanupConfirmed !== true)
    )
      return null;
    const dockerRecoveryIds: string[] = [];
    for (let index = 0; index < rawDockerRecoveryIds.length; index += 1) {
      const id = ownDataProperty(rawDockerRecoveryIds, String(index));
      if (!isProjectRuntimeRecoveryIdentity(id)) return null;
      dockerRecoveryIds.push(id);
    }
    const recoveryObligations = [
      ...(typeof hostRecoveryId === "string"
        ? [{ kind: "host" as const, recoveryId: hostRecoveryId }]
        : []),
      ...dockerRecoveryIds.map((recoveryId) => ({
        kind: "docker" as const,
        recoveryId,
      })),
      ...(typeof candidateRecoveryId === "string"
        ? [{ kind: "candidate" as const, recoveryId: candidateRecoveryId }]
        : []),
      ...(typeof candidateStoreRecoveryId === "string"
        ? [
            {
              kind: "candidate_store" as const,
              recoveryId: candidateStoreRecoveryId,
            },
          ]
        : []),
    ];
    const identities = recoveryObligations.map(
      (entry) => `${entry.kind}\0${entry.recoveryId}`,
    );
    if (new Set(identities).size !== identities.length) return null;
    const recoveryIds = [
      ...new Set(recoveryObligations.map((entry) => entry.recoveryId)),
    ];
    if (recoveryIds.some((id) => !isProjectRuntimeRecoveryIdentity(id)))
      return null;
    return Object.freeze({
      status,
      reason,
      cleanupConfirmed,
      manualRecoveryRequired,
      processRestartRequired,
      candidateId,
      recoveryIds: Object.freeze(recoveryIds),
      recoveryObligations: Object.freeze(
        recoveryObligations.map((entry) => Object.freeze(entry)),
      ),
      ...(executorProvider === "codex" || executorProvider === "claude"
        ? { executorProvider }
        : {}),
    });
  } catch {
    return null;
  }
}

const SETTLED_RUNTIME_CANCELLATION_REASONS = new Set([
  "coordinator_task_cancelled_before_stage_start",
  "coordinator_task_cancelled_after_provider_cleanup",
  "coordinator_task_cancelled_during_operation_creation",
  "coordinator_task_cancelled_during_external_send_authorization",
  "coordinator_task_cancelled_before_candidate_capture",
  "coordinator_task_cancelled_before_independent_review",
]);

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
    !validText(input.operationId, 128) ||
    !STABLE_IDENTITY.test(input.operationId) ||
    !validText(input.authorityBindingId, 128) ||
    !STABLE_IDENTITY.test(input.authorityBindingId) ||
    typeof input.repositoryRevision !== "string" ||
    !REPOSITORY_REVISION.test(input.repositoryRevision) ||
    !isOpaqueCapability(input.taskAuthorityCapability) ||
    !(input.cancellationSignal instanceof AbortSignal) ||
    (input.observeStarted !== undefined &&
      typeof input.observeStarted !== "function")
  )
    return rejectedWithoutEffect(
      null,
      null,
      null,
      null,
      "single_task_input_invalid",
    );
  const attemptId = input.attemptId;
  const operationId = input.operationId;
  const authorityBindingId = input.authorityBindingId;
  const repositoryRevision = input.repositoryRevision;
  if (input.cancellationSignal.aborted)
    return result({
      attemptId,
      operationId,
      authorityBindingId,
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
      input.operationId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (preEffectRejectionSet.has(message))
      return rejectedWithoutEffect(
        attemptId,
        operationId,
        authorityBindingId,
        repositoryRevision,
        message,
        message === "coordinator_task_process_restart_required",
      );
    return failedClosedUnknown(
      attemptId,
      operationId,
      authorityBindingId,
      repositoryRevision,
      "single_task_start_observation_invalid",
    );
  }
  const started = inspectStartedTask(rawStarted);
  if (!started)
    return failedClosedUnknown(
      attemptId,
      operationId,
      authorityBindingId,
      repositoryRevision,
      "single_task_start_observation_invalid",
    );
  if (input.observeStarted) {
    let isObserved = false;
    try {
      isObserved = (await input.observeStarted()) === true;
    } catch {
      isObserved = false;
    }
    if (!isObserved) {
      try {
        const cancellation = dependencies.cancelTask(started.controlCapability);
        if (cancellation instanceof Promise)
          await cancellation.catch(() => null);
      } catch {
        // The completion record below remains the authority for cleanup.
      }
    }
  }
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
      operationId,
      authorityBindingId,
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
      operationId,
      authorityBindingId,
      repositoryRevision,
      "single_task_completion_observation_invalid",
    );
  const isRecoveryOrCleanupUnknown =
    completion.cleanupConfirmed !== true ||
    completion.manualRecoveryRequired === true ||
    completion.recoveryIds.length > 0;
  const isSettledRuntimeCancellation =
    cancellationTransferred &&
    input.cancellationSignal.aborted &&
    completion.status === "blocked" &&
    completion.cleanupConfirmed === true &&
    completion.manualRecoveryRequired === false &&
    completion.processRestartRequired === false &&
    completion.recoveryIds.length === 0 &&
    SETTLED_RUNTIME_CANCELLATION_REASONS.has(completion.reason);
  const completionStatus = isSettledRuntimeCancellation
    ? "cancelled"
    : isRecoveryOrCleanupUnknown && completion.status === "completed"
      ? "blocked"
      : completion.status;
  const completionReason = isSettledRuntimeCancellation
    ? "single_task_cancelled_after_effect_cleanup"
    : isRecoveryOrCleanupUnknown && completion.status === "completed"
      ? "single_task_completion_cleanup_unknown"
      : completion.reason;
  return result({
    attemptId,
    operationId,
    authorityBindingId,
    repositoryRevision,
    status: completionStatus,
    reason: completionReason,
    effectState: isRecoveryOrCleanupUnknown ? "unknown" : "settled",
    cleanupConfirmed: completion.cleanupConfirmed,
    manualRecoveryRequired: isRecoveryOrCleanupUnknown
      ? true
      : completion.manualRecoveryRequired,
    processRestartRequired: completion.processRestartRequired,
    candidateId: completion.candidateId,
    recoveryIds: completion.recoveryIds,
    recoveryObligations: completion.recoveryObligations,
    ...(completion.executorProvider === undefined
      ? {}
      : { executorProvider: completion.executorProvider }),
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
      "pre_effect_and_confirmed_post_effect_cleanup_normalized_to_project_cancelled_other_effect_era_results_preserved",
  });
}
