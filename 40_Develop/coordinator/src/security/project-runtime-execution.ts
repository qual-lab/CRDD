import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  acquireProjectRuntimeLease,
  readProjectOperationQueueState,
  readProjectRuntimeState,
  settleProjectOperationQueueLeaseRelease,
  selectNextProjectOperation,
  updateProjectOperationQueueState,
  writeProjectRuntimeState,
} from "./project-runtime-durable-foundation.ts";
import type {
  ProjectRuntimeSingleTaskAttemptInput,
  ProjectRuntimeSingleTaskResult,
} from "./project-runtime-single-task-adapter.ts";
import {
  isProjectRuntimeRecoveryIdentity,
  observeProjectTaskStarted,
  prepareProjectTaskHandoff,
  reserveProjectTaskStart,
  selectSchedulableProjectTasks,
  settleProjectTask,
  settleProjectTaskBeforeEffect,
  type ProjectTaskRecoveryKind,
  type ProjectRuntimeState,
} from "./project-runtime-state.ts";
import {
  createRuntimeProcessRecoveryIdentity,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../core/runtime-process-safety-state.ts";

export const PROJECT_RUNTIME_EXECUTION_CONTRACT =
  "crdd-coordinator/project-runtime-execution/v1" as const;

export type ProjectRuntimeTaskExecution = Readonly<{
  taskId: string;
  authorityBindingId: string;
  taskRequest: unknown;
  taskAuthorityCapability: object;
  repositoryRoot: unknown;
}>;

export type ProjectRuntimeExecutionDependencies = Readonly<{
  issueTaskAuthority?: () => object | null;
  revokeTaskAuthority?: (capability: object) => boolean;
  poisonProcessAfterAuthorityRevocationUnknown?: () => void;
  runSingleTaskAttempt: (
    input: ProjectRuntimeSingleTaskAttemptInput,
  ) => Promise<ProjectRuntimeSingleTaskResult>;
}>;

export type ProjectRuntimeExecutionResult = Readonly<{
  contract: typeof PROJECT_RUNTIME_EXECUTION_CONTRACT;
  status: "completed" | "blocked" | "cancelled";
  reason: string;
  projectId: string;
  queueId: string;
  stateGeneration: number | null;
  completedTaskIds: readonly string[];
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired: boolean;
  recoveryIds: readonly string[];
  recoveryObligations: readonly Readonly<{
    kind: ProjectTaskRecoveryKind;
    recoveryId: string;
  }>[];
  effectState: "no_effect" | "settled" | "unknown";
}>;

type ExecutionInput = Readonly<{
  workingDirectory: string;
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
  taskExecutions: readonly ProjectRuntimeTaskExecution[];
  cancellationSignal: AbortSignal;
}>;

function stableId(prefix: string, ...parts: readonly string[]) {
  const value = createHash("sha256").update(parts.join("\0")).digest("hex");
  return `${prefix}-${value.slice(0, 40)}`;
}

function validIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

function validSingleTaskResult(
  value: unknown,
  runtimeIssuedRecoveryIds: ReadonlySet<string>,
): value is ProjectRuntimeSingleTaskResult {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    )
      return false;
    const expected = [
      "attemptId",
      "authorityBindingId",
      "candidateId",
      "cleanupConfirmed",
      "contract",
      "effectState",
      "manualRecoveryRequired",
      "operationId",
      "processRestartRequired",
      "reason",
      "recoveryIds",
      "repositoryRevision",
      "status",
    ].sort();
    const expectedWithTypedRecovery = [
      ...expected,
      "recoveryObligations",
    ].sort();
    const keys = Reflect.ownKeys(value);
    if (
      (keys.length !== expected.length &&
        keys.length !== expectedWithTypedRecovery.length) ||
      keys.some((key) => typeof key !== "string") ||
      ![...(keys as string[])]
        .sort()
        .every(
          (key, index) =>
            key ===
            (keys.length === expected.length
              ? expected[index]
              : expectedWithTypedRecovery[index]),
        )
    )
      return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      (keys.length === expected.length
        ? expected
        : expectedWithTypedRecovery
      ).some(
        (key) =>
          !descriptors[key] ||
          !("value" in descriptors[key]) ||
          descriptors[key].get !== undefined ||
          descriptors[key].set !== undefined,
      )
    )
      return false;
    const record = value as Record<string, unknown>;
    if (
      record.contract !==
        "crdd-coordinator/project-runtime-single-task-adapter" ||
      !validIdentity(record.attemptId) ||
      !validIdentity(record.operationId) ||
      !validIdentity(record.authorityBindingId) ||
      typeof record.repositoryRevision !== "string" ||
      !/^[0-9a-f]{40,64}$/u.test(record.repositoryRevision) ||
      !["completed", "blocked", "cancelled"].includes(String(record.status)) ||
      typeof record.reason !== "string" ||
      record.reason.length === 0 ||
      record.reason.length > 256 ||
      !["no_effect", "settled", "unknown"].includes(
        String(record.effectState),
      ) ||
      typeof record.cleanupConfirmed !== "boolean" ||
      typeof record.manualRecoveryRequired !== "boolean" ||
      typeof record.processRestartRequired !== "boolean" ||
      (record.candidateId !== null &&
        (typeof record.candidateId !== "string" ||
          record.candidateId.length > 512)) ||
      !Array.isArray(record.recoveryIds) ||
      utilTypes.isProxy(record.recoveryIds) ||
      record.recoveryIds.length > 128 ||
      Reflect.ownKeys(record.recoveryIds).some(
        (key) =>
          key !== "length" &&
          (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key)),
      )
    )
      return false;
    for (let index = 0; index < record.recoveryIds.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(
        record.recoveryIds,
        String(index),
      );
      if (
        !descriptor ||
        !("value" in descriptor) ||
        !isProjectRuntimeRecoveryIdentity(descriptor.value)
      )
        return false;
    }
    const rawObligations = record.recoveryObligations;
    if (rawObligations !== undefined) {
      if (
        !Array.isArray(rawObligations) ||
        utilTypes.isProxy(rawObligations) ||
        rawObligations.length > 128
      )
        return false;
      const identities = new Set<string>();
      const ids = new Set<string>();
      for (let index = 0; index < rawObligations.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(
          rawObligations,
          String(index),
        );
        if (!descriptor || !("value" in descriptor)) return false;
        const entry = descriptor.value;
        if (
          !entry ||
          typeof entry !== "object" ||
          Array.isArray(entry) ||
          utilTypes.isProxy(entry) ||
          ![Object.prototype, null].includes(Object.getPrototypeOf(entry))
        )
          return false;
        const entryKeys = Reflect.ownKeys(entry).sort();
        if (
          entryKeys.length !== 2 ||
          entryKeys[0] !== "kind" ||
          entryKeys[1] !== "recoveryId"
        )
          return false;
        const kind = (entry as { kind?: unknown }).kind;
        const recoveryId = (entry as { recoveryId?: unknown }).recoveryId;
        if (
          ![
            "host",
            "docker",
            "candidate",
            "candidate_store",
            "runtime_process",
          ].includes(String(kind)) ||
          !isProjectRuntimeRecoveryIdentity(recoveryId) ||
          (kind === "runtime_process" &&
            !runtimeIssuedRecoveryIds.has(String(recoveryId))) ||
          identities.has(`${kind}\0${recoveryId}`)
        )
          return false;
        identities.add(`${kind}\0${recoveryId}`);
        ids.add(recoveryId);
      }
      if (
        ids.size !== new Set(record.recoveryIds as string[]).size ||
        [...ids].some((id) => !(record.recoveryIds as string[]).includes(id))
      )
        return false;
    } else if (record.recoveryIds.length > 0) return false;
    const status = String(record.status);
    const effectState = String(record.effectState);
    const cleanupConfirmed = record.cleanupConfirmed === true;
    const manualRecoveryRequired = record.manualRecoveryRequired === true;
    const processRestartRequired = record.processRestartRequired === true;
    const recoveryCount = record.recoveryIds.length;
    if (
      (status === "completed" &&
        (effectState !== "settled" ||
          !cleanupConfirmed ||
          manualRecoveryRequired ||
          processRestartRequired ||
          recoveryCount !== 0)) ||
      (status === "cancelled" &&
        (!cleanupConfirmed ||
          manualRecoveryRequired ||
          processRestartRequired ||
          recoveryCount !== 0 ||
          (effectState !== "no_effect" && effectState !== "settled"))) ||
      (effectState === "unknown" &&
        (cleanupConfirmed || !manualRecoveryRequired)) ||
      (!cleanupConfirmed &&
        (effectState !== "unknown" || !manualRecoveryRequired)) ||
      (recoveryCount > 0 && !manualRecoveryRequired) ||
      (processRestartRequired && status !== "blocked")
    )
      return false;
    return true;
  } catch {
    return false;
  }
}

function result(
  input: ExecutionInput,
  fields: Omit<
    ProjectRuntimeExecutionResult,
    | "contract"
    | "projectId"
    | "queueId"
    | "processRestartRequired"
    | "recoveryIds"
    | "recoveryObligations"
  > &
    Readonly<{
      processRestartRequired?: boolean;
      recoveryIds?: readonly string[];
      recoveryObligations?: readonly Readonly<{
        kind: ProjectTaskRecoveryKind;
        recoveryId: string;
      }>[];
    }>,
): ProjectRuntimeExecutionResult {
  return Object.freeze({
    contract: PROJECT_RUNTIME_EXECUTION_CONTRACT,
    projectId: input.projectId,
    queueId: input.queueId,
    ...fields,
    processRestartRequired: fields.processRestartRequired ?? false,
    recoveryIds: Object.freeze([...(fields.recoveryIds ?? [])]),
    recoveryObligations: Object.freeze([...(fields.recoveryObligations ?? [])]),
    completedTaskIds: Object.freeze([...fields.completedTaskIds]),
  });
}

function blocked(
  input: ExecutionInput,
  reason: string,
  options: Readonly<{
    state?: ProjectRuntimeState | null;
    completedTaskIds?: readonly string[];
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    processRestartRequired?: boolean;
    effectState?: "no_effect" | "settled" | "unknown";
    recoveryIds?: readonly string[];
    recoveryObligations?: readonly Readonly<{
      kind: ProjectTaskRecoveryKind;
      recoveryId: string;
    }>[];
  }> = {},
) {
  return result(input, {
    status: "blocked",
    reason,
    stateGeneration: options.state?.generation ?? null,
    completedTaskIds: options.completedTaskIds ?? [],
    cleanupConfirmed: options.cleanupConfirmed ?? true,
    manualRecoveryRequired: options.manualRecoveryRequired ?? false,
    processRestartRequired: options.processRestartRequired ?? false,
    effectState: options.effectState ?? "no_effect",
    recoveryIds: options.recoveryIds ?? [],
    recoveryObligations: options.recoveryObligations ?? [],
  });
}

function taskExecutionMap(
  state: ProjectRuntimeState,
  executions: readonly ProjectRuntimeTaskExecution[],
) {
  if (
    !Array.isArray(executions) ||
    executions.length !==
      state.tasks.filter((task) => task.state !== "superseded").length ||
    new Set(executions.map((entry) => entry.taskId)).size !== executions.length
  )
    return null;
  const result = new Map<string, ProjectRuntimeTaskExecution>();
  for (const entry of executions) {
    if (
      !entry ||
      typeof entry !== "object" ||
      !state.tasks.some(
        (task) =>
          task.definition.id === entry.taskId && task.state !== "superseded",
      ) ||
      !validIdentity(entry.authorityBindingId) ||
      !entry.taskAuthorityCapability ||
      typeof entry.taskAuthorityCapability !== "object"
    )
      return null;
    result.set(entry.taskId, entry);
  }
  return result;
}

function persistedState(
  input: ExecutionInput,
  state: ProjectRuntimeState,
  expectedGeneration: number,
) {
  return writeProjectRuntimeState(
    input.workingDirectory,
    input.repositoryBindingId,
    state,
    expectedGeneration,
  );
}

/**
 * Own one durable Project operation from a queued request through all currently
 * reachable Task attempts. Short mutation locks are never held while a Single
 * Task Runtime effect is awaited. Capacity and conflict reservations are first
 * persisted in Project State; task results are accepted only for the exact
 * attempt and repository revision. Unknown cleanup becomes a durable recovery
 * obligation and never frees the state-level slot or conflict reservation.
 */
export async function runProjectRuntimeOperation(
  dependencies: ProjectRuntimeExecutionDependencies,
  input: ExecutionInput,
): Promise<ProjectRuntimeExecutionResult> {
  if (!(input.cancellationSignal instanceof AbortSignal))
    return blocked(input, "project_runtime_execution_input_invalid");
  const stateRead = readProjectRuntimeState(
    input.workingDirectory,
    input.repositoryBindingId,
    input.projectId,
  );
  const queueRead = readProjectOperationQueueState(
    input.workingDirectory,
    input.repositoryBindingId,
    input.queueId,
  );
  if (
    stateRead.status !== "completed" ||
    stateRead.value === null ||
    queueRead.status !== "completed"
  )
    return blocked(input, "project_runtime_execution_observation_unknown", {
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  let state = stateRead.value;
  let queue = queueRead.value;
  if (
    state.projectId !== input.projectId ||
    state.milestoneId !== input.milestoneId ||
    queue.projectId !== input.projectId ||
    queue.milestoneId !== input.milestoneId ||
    queue.repositoryRevision !== state.repositoryRevision
  )
    return blocked(input, "project_runtime_execution_identity_mismatch");
  if (queue.state === "integration_pending")
    return queue.ownerGeneration === null
      ? result(input, {
          status: "completed",
          reason: "project_runtime_tasks_already_integration_pending",
          stateGeneration: state.generation,
          completedTaskIds: state.tasks
            .filter((task) => task.state === "completed")
            .map((task) => task.definition.id),
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          effectState: "no_effect",
        })
      : blocked(input, "project_runtime_queue_release_not_settled", {
          state,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
  if (queue.state !== "queued")
    return blocked(input, "project_runtime_queue_not_startable", {
      state,
      manualRecoveryRequired: [
        "leased",
        "running",
        "recovery_required",
      ].includes(queue.state),
    });
  const executions = taskExecutionMap(state, input.taskExecutions);
  if (!executions)
    return blocked(input, "project_runtime_task_execution_set_invalid", {
      state,
    });

  const leaseResult = acquireProjectRuntimeLease(
    input.workingDirectory,
    input.repositoryBindingId,
    input.projectId,
    input.queueId,
    "project-operation",
  );
  if (leaseResult.status !== "completed")
    return blocked(input, leaseResult.reason, {
      state,
      manualRecoveryRequired: leaseResult.manualRecoveryRequired,
      ...(leaseResult.recoveryId === null
        ? {}
        : { recoveryIds: Object.freeze([leaseResult.recoveryId]) }),
    });
  const lease = leaseResult.value;
  const completeWithoutOwnedQueue = (
    terminal: ProjectRuntimeExecutionResult,
  ): ProjectRuntimeExecutionResult => {
    const released = lease.release();
    return released.status === "completed"
      ? terminal
      : result(input, {
          status: "blocked",
          reason: released.reason,
          stateGeneration: terminal.stateGeneration,
          completedTaskIds: terminal.completedTaskIds,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          processRestartRequired: terminal.processRestartRequired,
          effectState: "unknown",
        });
  };
  const completeOwnedQueue = (
    terminal: ProjectRuntimeExecutionResult,
    terminalQueue: typeof queue,
  ): ProjectRuntimeExecutionResult => {
    const released = lease.release();
    if (released.status !== "completed")
      return result(input, {
        status: "blocked",
        reason: released.reason,
        stateGeneration: terminal.stateGeneration,
        completedTaskIds: terminal.completedTaskIds,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        processRestartRequired: terminal.processRestartRequired,
        effectState: "unknown",
      });
    const settled = settleProjectOperationQueueLeaseRelease(
      input.workingDirectory,
      input.repositoryBindingId,
      input.queueId,
      terminalQueue.generation,
      lease.ownerGeneration,
    );
    return settled.status === "completed"
      ? terminal
      : result(input, {
          status: "blocked",
          reason: settled.reason,
          stateGeneration: terminal.stateGeneration,
          completedTaskIds: terminal.completedTaskIds,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          processRestartRequired: terminal.processRestartRequired,
          effectState: "unknown",
        });
  };
  const finalizeOwnedFailure = (
    reason: string,
    options: Readonly<{
      state: ProjectRuntimeState;
      completedTaskIds?: readonly string[];
      processRestartRequired?: boolean;
    }>,
  ): ProjectRuntimeExecutionResult => {
    const terminal = blocked(input, reason, {
      state: options.state,
      completedTaskIds: options.completedTaskIds ?? [],
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      processRestartRequired: options.processRestartRequired ?? false,
      effectState: "unknown",
    });
    const recoveryQueue = updateProjectOperationQueueState(
      input.workingDirectory,
      input.repositoryBindingId,
      input.queueId,
      queue.generation,
      {
        state: "recovery_required",
        lease,
        resumeCondition: "owned_operation_failure",
        resultReference: stableId(
          "project-operation-recovery",
          input.projectId,
          input.queueId,
          lease.ownerGeneration,
        ),
      },
    );
    if (recoveryQueue.status === "completed") {
      queue = recoveryQueue.value;
      return completeOwnedQueue(terminal, recoveryQueue.value);
    }
    return completeWithoutOwnedQueue(
      blocked(input, recoveryQueue.reason, {
        state: options.state,
        completedTaskIds: options.completedTaskIds ?? [],
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        processRestartRequired: options.processRestartRequired ?? false,
        effectState: "unknown",
      }),
    );
  };

  // Selection made before the binding-wide lease is only advisory. Re-read
  // the complete durable queue population while this process exclusively owns
  // the Project Operation boundary, then bind exactly that selected Queue.
  const selectedAfterLease = selectNextProjectOperation(
    input.workingDirectory,
    input.repositoryBindingId,
  );
  if (selectedAfterLease.status !== "completed")
    return completeWithoutOwnedQueue(
      blocked(input, selectedAfterLease.reason, {
        state,
        cleanupConfirmed: false,
        manualRecoveryRequired: selectedAfterLease.manualRecoveryRequired,
        effectState: "unknown",
      }),
    );
  if (
    !selectedAfterLease.value ||
    selectedAfterLease.value.queueId !== input.queueId
  )
    return completeWithoutOwnedQueue(
      blocked(input, "project_runtime_queue_claim_priority_changed", {
        state,
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect",
      }),
    );

  const leaseQueue = updateProjectOperationQueueState(
    input.workingDirectory,
    input.repositoryBindingId,
    input.queueId,
    queue.generation,
    {
      state: "leased",
      lease,
      resumeCondition: null,
      resultReference: null,
    },
  );
  if (leaseQueue.status !== "completed")
    return completeWithoutOwnedQueue(
      blocked(input, leaseQueue.reason, {
        state,
        cleanupConfirmed: false,
        manualRecoveryRequired: leaseQueue.manualRecoveryRequired,
        effectState: "unknown",
      }),
    );
  queue = leaseQueue.value;
  if (input.cancellationSignal.aborted) {
    const cancelled = updateProjectOperationQueueState(
      input.workingDirectory,
      input.repositoryBindingId,
      input.queueId,
      queue.generation,
      {
        state: "cancelled",
        lease,
        resumeCondition: null,
        resultReference: null,
      },
    );
    if (cancelled.status !== "completed")
      return finalizeOwnedFailure(cancelled.reason, { state });
    return completeOwnedQueue(
      result(input, {
        status: "cancelled",
        reason: "project_runtime_cancelled_before_task_effect",
        stateGeneration: state.generation,
        completedTaskIds: [],
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect",
      }),
      cancelled.value,
    );
  }
  const runningQueue = updateProjectOperationQueueState(
    input.workingDirectory,
    input.repositoryBindingId,
    input.queueId,
    queue.generation,
    {
      state: "running",
      lease,
      resumeCondition: null,
      resultReference: null,
    },
  );
  if (runningQueue.status !== "completed")
    return finalizeOwnedFailure(runningQueue.reason, { state });
  queue = runningQueue.value;

  const completedTaskIds: string[] = [];
  let processRestartRequired = false;
  while (true) {
    const selected = selectSchedulableProjectTasks(state);
    if (selected.length === 0) break;
    const attempts: Array<{
      taskId: string;
      attemptId: string;
      operationId: string;
      execution: ProjectRuntimeTaskExecution;
    }> = [];
    for (const taskId of selected) {
      const execution = executions.get(taskId);
      if (!execution)
        return finalizeOwnedFailure("project_runtime_task_execution_missing", {
          state,
          completedTaskIds,
        });
      const attemptId = stableId(
        "attempt",
        input.queueId,
        taskId,
        String(state.generation),
      );
      const operationId = stableId(
        "operation",
        input.queueId,
        taskId,
        attemptId,
        execution.authorityBindingId,
      );
      const reserved = reserveProjectTaskStart(
        state,
        state.generation,
        taskId,
        attemptId,
        execution.authorityBindingId,
      );
      if (reserved.status !== "completed" || !reserved.state)
        return finalizeOwnedFailure(reserved.reason, {
          state,
          completedTaskIds,
        });
      const reserveWrite = persistedState(
        input,
        reserved.state,
        state.generation,
      );
      if (reserveWrite.status !== "completed")
        return finalizeOwnedFailure(reserveWrite.reason, {
          state,
          completedTaskIds,
        });
      state = reserved.state;
      const prepared = prepareProjectTaskHandoff(
        state,
        state.generation,
        taskId,
        attemptId,
        operationId,
      );
      if (prepared.status !== "completed" || !prepared.state)
        return finalizeOwnedFailure(prepared.reason, {
          state,
          completedTaskIds,
        });
      const preparedWrite = persistedState(
        input,
        prepared.state,
        state.generation,
      );
      if (preparedWrite.status !== "completed")
        return finalizeOwnedFailure(preparedWrite.reason, {
          state,
          completedTaskIds,
        });
      state = prepared.state;
      attempts.push({
        taskId,
        attemptId,
        operationId,
        execution,
      });
    }

    // Persist every reservation in the wave before issuing any Task effect.
    // Promise.resolve().then also converts a synchronous dependency failure into
    // an observed attempt failure instead of letting it escape with a live lease.
    let startObservationChain = Promise.resolve(true);
    const startedAttemptIds = new Set<string>();
    const observeStarted = (attempt: (typeof attempts)[number]) => {
      const observation = startObservationChain.then(() => {
        const started = observeProjectTaskStarted(
          state,
          state.generation,
          attempt.taskId,
          attempt.attemptId,
          attempt.operationId,
        );
        if (started.status !== "completed" || !started.state) return false;
        const written = persistedState(input, started.state, state.generation);
        if (written.status !== "completed") return false;
        state = written.value;
        startedAttemptIds.add(attempt.attemptId);
        return true;
      });
      startObservationChain = observation.then(
        () => true,
        () => false,
      );
      return observation;
    };
    const runtimeIssuedRecoveryIds = new Set<string>();
    const outcomes = await Promise.all(
      attempts.map(async (attempt) => {
        try {
          if (input.cancellationSignal.aborted)
            return Object.freeze({
              contract:
                "crdd-coordinator/project-runtime-single-task-adapter" as const,
              attemptId: attempt.attemptId,
              operationId: attempt.operationId,
              authorityBindingId: attempt.execution.authorityBindingId,
              repositoryRevision: state.repositoryRevision,
              status: "cancelled" as const,
              reason: "single_task_cancelled_before_authority",
              effectState: "no_effect" as const,
              cleanupConfirmed: true,
              manualRecoveryRequired: false,
              processRestartRequired: false,
              candidateId: null,
              recoveryIds: Object.freeze([]),
              recoveryObligations: Object.freeze([]),
            });
          const taskAuthorityCapability = dependencies.issueTaskAuthority
            ? dependencies.issueTaskAuthority()
            : attempt.execution.taskAuthorityCapability;
          if (
            !taskAuthorityCapability ||
            typeof taskAuthorityCapability !== "object"
          )
            return Object.freeze({
              contract:
                "crdd-coordinator/project-runtime-single-task-adapter" as const,
              attemptId: attempt.attemptId,
              operationId: attempt.operationId,
              authorityBindingId: attempt.execution.authorityBindingId,
              repositoryRevision: state.repositoryRevision,
              status: "blocked" as const,
              reason: "single_task_authority_issue_failed",
              effectState: "no_effect" as const,
              cleanupConfirmed: true,
              manualRecoveryRequired: false,
              processRestartRequired: false,
              candidateId: null,
              recoveryIds: Object.freeze([]),
              recoveryObligations: Object.freeze([]),
            });
          if (input.cancellationSignal.aborted) {
            const revoked = dependencies.revokeTaskAuthority?.(
              taskAuthorityCapability,
            );
            return revoked === true
              ? Object.freeze({
                  contract:
                    "crdd-coordinator/project-runtime-single-task-adapter" as const,
                  attemptId: attempt.attemptId,
                  operationId: attempt.operationId,
                  authorityBindingId: attempt.execution.authorityBindingId,
                  repositoryRevision: state.repositoryRevision,
                  status: "cancelled" as const,
                  reason: "single_task_cancelled_after_authority_revoked",
                  effectState: "no_effect" as const,
                  cleanupConfirmed: true,
                  manualRecoveryRequired: false,
                  processRestartRequired: false,
                  candidateId: null,
                  recoveryIds: Object.freeze([]),
                  recoveryObligations: Object.freeze([]),
                })
              : (() => {
                  (
                    dependencies.poisonProcessAfterAuthorityRevocationUnknown ??
                    poisonRuntimeProcessAfterCleanupUnknown
                  )();
                  const runtimeProcessRecoveryId =
                    createRuntimeProcessRecoveryIdentity(
                      attempt.attemptId,
                      attempt.operationId,
                    );
                  runtimeIssuedRecoveryIds.add(runtimeProcessRecoveryId);
                  return Object.freeze({
                    contract:
                      "crdd-coordinator/project-runtime-single-task-adapter" as const,
                    attemptId: attempt.attemptId,
                    operationId: attempt.operationId,
                    authorityBindingId: attempt.execution.authorityBindingId,
                    repositoryRevision: state.repositoryRevision,
                    status: "blocked" as const,
                    reason: "single_task_authority_revocation_unknown",
                    effectState: "unknown" as const,
                    cleanupConfirmed: false,
                    manualRecoveryRequired: true,
                    processRestartRequired: true,
                    candidateId: null,
                    recoveryIds: Object.freeze([runtimeProcessRecoveryId]),
                    recoveryObligations: Object.freeze([
                      Object.freeze({
                        kind: "runtime_process" as const,
                        recoveryId: runtimeProcessRecoveryId,
                      }),
                    ]),
                  });
                })();
          }
          return await dependencies.runSingleTaskAttempt({
            attemptId: attempt.attemptId,
            operationId: attempt.operationId,
            authorityBindingId: attempt.execution.authorityBindingId,
            repositoryRevision: state.repositoryRevision,
            taskAuthorityCapability,
            taskRequest: attempt.execution.taskRequest,
            repositoryRoot: attempt.execution.repositoryRoot,
            cancellationSignal: input.cancellationSignal,
            observeStarted: () => observeStarted(attempt),
          });
        } catch {
          return null;
        }
      }),
    );
    let terminalState:
      | "recovery_required"
      | "replan_required"
      | "cancelled"
      | null = null;
    let terminalReference: string | null = null;
    for (let index = 0; index < attempts.length; index += 1) {
      const attempt = attempts[index];
      const outcome = outcomes[index];
      if (!attempt)
        return finalizeOwnedFailure(
          "project_runtime_attempt_observation_unknown",
          {
            state,
            completedTaskIds,
          },
        );
      const validatedOutcome = validSingleTaskResult(
        outcome,
        runtimeIssuedRecoveryIds,
      )
        ? outcome
        : null;
      const exact =
        validatedOutcome !== null &&
        validatedOutcome.attemptId === attempt?.attemptId &&
        validatedOutcome.operationId === attempt?.operationId &&
        validatedOutcome.authorityBindingId ===
          attempt?.execution.authorityBindingId &&
        validatedOutcome.repositoryRevision === state.repositoryRevision;
      const effectStarted = startedAttemptIds.has(attempt.attemptId);
      const normalizedRecoveryObligations: Array<
        Readonly<{ kind: ProjectTaskRecoveryKind; recoveryId: string }>
      > = validatedOutcome
        ? [...(validatedOutcome.recoveryObligations ?? [])]
        : [];
      if (
        validatedOutcome?.processRestartRequired === true &&
        !normalizedRecoveryObligations.some(
          (entry) => entry.kind === "runtime_process",
        )
      ) {
        const runtimeProcessRecoveryId = createRuntimeProcessRecoveryIdentity(
          attempt.attemptId,
          attempt.operationId,
        );
        (
          dependencies.poisonProcessAfterAuthorityRevocationUnknown ??
          poisonRuntimeProcessAfterCleanupUnknown
        )();
        runtimeIssuedRecoveryIds.add(runtimeProcessRecoveryId);
        normalizedRecoveryObligations.push(
          Object.freeze({
            kind: "runtime_process" as const,
            recoveryId: runtimeProcessRecoveryId,
          }),
        );
      }
      const recoveryRequired =
        !validatedOutcome ||
        !exact ||
        validatedOutcome.effectState === "unknown" ||
        !validatedOutcome.cleanupConfirmed ||
        validatedOutcome.manualRecoveryRequired ||
        validatedOutcome.processRestartRequired ||
        validatedOutcome.recoveryIds.length > 0;
      processRestartRequired ||=
        validatedOutcome?.processRestartRequired === true;
      const recoveryObligations = recoveryRequired
        ? normalizedRecoveryObligations.map((entry) =>
            Object.freeze({ ...entry, phase: "required" as const }),
          )
        : [];
      const recoveryUnresolved =
        recoveryRequired && recoveryObligations.length === 0;
      const settlementInput = {
        taskId: attempt?.taskId ?? "invalid",
        attemptId: attempt?.attemptId ?? "invalid",
        operationId: attempt?.operationId ?? "invalid",
        authorityBindingId: attempt?.execution.authorityBindingId ?? "invalid",
        outcome: recoveryRequired
          ? "recovery_required"
          : validatedOutcome?.status === "completed"
            ? "completed"
            : validatedOutcome?.status === "cancelled"
              ? "cancelled"
              : "failed",
        cleanupConfirmed: validatedOutcome?.cleanupConfirmed === true,
        recoveryObligations,
        recoveryUnresolved,
        candidateId: validatedOutcome?.candidateId ?? null,
      } as const;
      const settlement = effectStarted
        ? settleProjectTask(state, state.generation, settlementInput)
        : settleProjectTaskBeforeEffect(state, state.generation, {
            ...settlementInput,
            outcome:
              settlementInput.outcome === "completed"
                ? "recovery_required"
                : settlementInput.outcome,
            cleanupConfirmed:
              settlementInput.outcome === "completed"
                ? false
                : settlementInput.cleanupConfirmed,
            recoveryUnresolved:
              settlementInput.outcome === "completed"
                ? true
                : settlementInput.recoveryUnresolved,
          });
      if (settlement.status !== "completed" || !settlement.state)
        return finalizeOwnedFailure(settlement.reason, {
          state,
          completedTaskIds,
          processRestartRequired,
        });
      const settlementWrite = persistedState(
        input,
        settlement.state,
        state.generation,
      );
      if (settlementWrite.status !== "completed")
        return finalizeOwnedFailure(settlementWrite.reason, {
          state,
          completedTaskIds,
          processRestartRequired,
        });
      state = settlement.state;
      if (!recoveryRequired && validatedOutcome?.status === "completed")
        completedTaskIds.push(attempt?.taskId ?? "invalid");
      if (recoveryRequired) {
        terminalState = "recovery_required";
      } else if (
        validatedOutcome?.status === "cancelled" &&
        terminalState === null
      ) {
        terminalState = "cancelled";
      } else if (
        validatedOutcome?.status === "blocked" &&
        terminalState === null
      ) {
        terminalState = "replan_required";
        terminalReference = stableId(
          "task-result",
          attempt.taskId,
          attempt.attemptId,
        );
      }
    }
    if (terminalState) {
      if (terminalState === "recovery_required") {
        const exactRecoveries = state.tasks
          .filter((task) => task.state === "recovery_required")
          .flatMap((task) =>
            task.recoveryObligations.map(
              (entry) =>
                `${task.definition.id}:${entry.kind}:${entry.recoveryId}`,
            ),
          )
          .sort();
        terminalReference =
          exactRecoveries.length > 0
            ? stableId(
                "project-recovery-application",
                input.projectId,
                input.queueId,
                ...exactRecoveries,
              )
            : stableId(
                "project-unresolved-recovery",
                input.projectId,
                input.queueId,
                ...state.tasks
                  .filter((task) => task.recoveryUnresolved)
                  .map((task) => task.definition.id)
                  .sort(),
              );
      }
      const queueTerminal = updateProjectOperationQueueState(
        input.workingDirectory,
        input.repositoryBindingId,
        input.queueId,
        queue.generation,
        {
          state: terminalState,
          lease,
          resumeCondition:
            terminalState === "recovery_required" ? "exact_recovery" : null,
          resultReference: terminalReference,
        },
      );
      const terminal =
        queueTerminal.status === "completed"
          ? result(input, {
              status: terminalState === "cancelled" ? "cancelled" : "blocked",
              reason:
                terminalState === "recovery_required"
                  ? "project_runtime_task_recovery_required"
                  : terminalState === "cancelled"
                    ? "project_runtime_operation_cancelled"
                    : "project_runtime_replan_required",
              stateGeneration: state.generation,
              completedTaskIds,
              cleanupConfirmed: terminalState !== "recovery_required",
              manualRecoveryRequired: terminalState === "recovery_required",
              processRestartRequired,
              recoveryIds: state.tasks.flatMap((task) =>
                task.recoveryObligations.map((entry) => entry.recoveryId),
              ),
              recoveryObligations: state.tasks.flatMap((task) =>
                task.recoveryObligations.map(({ kind, recoveryId }) =>
                  Object.freeze({ kind, recoveryId }),
                ),
              ),
              effectState:
                terminalState === "recovery_required" ? "unknown" : "settled",
            })
          : blocked(input, queueTerminal.reason, {
              state,
              completedTaskIds,
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              effectState: "unknown",
            });
      if (queueTerminal.status !== "completed")
        return finalizeOwnedFailure(queueTerminal.reason, {
          state,
          completedTaskIds,
          processRestartRequired,
        });
      return completeOwnedQueue(terminal, queueTerminal.value);
    }
  }

  if (!state.tasks.every((task) => task.state === "completed"))
    return finalizeOwnedFailure("project_runtime_no_schedulable_task", {
      state,
      completedTaskIds,
    });
  const integration = updateProjectOperationQueueState(
    input.workingDirectory,
    input.repositoryBindingId,
    input.queueId,
    queue.generation,
    {
      state: "integration_pending",
      lease,
      resumeCondition: "objective_integration",
      resultReference: stableId(
        "project-result",
        input.projectId,
        input.queueId,
      ),
    },
  );
  if (integration.status !== "completed")
    return finalizeOwnedFailure(integration.reason, {
      state,
      completedTaskIds,
    });
  return completeOwnedQueue(
    result(input, {
      status: "completed",
      reason: "project_runtime_tasks_completed_integration_pending",
      stateGeneration: state.generation,
      completedTaskIds,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "settled",
    }),
    integration.value,
  );
}

export function describeProjectRuntimeExecutionContract() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_EXECUTION_CONTRACT,
    maximumConcurrency: 5,
    externalWaitWhileMutationLockHeld: false,
    cleanupUnknownDisposition: "durable_recovery_and_reservation_retained",
    staleOrOwnedQueueDisposition: "effect_zero_manual_reconciliation",
    upperProjectRuntimeCapabilityComplete: false,
  });
}
