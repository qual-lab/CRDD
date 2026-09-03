import { createHash } from "node:crypto";

import {
  getRuntimeProcessInstanceIdentity,
  inspectRuntimeProcessRecoveryIdentity,
} from "../core/runtime-process-safety-state.ts";

import {
  enqueueProjectOperation,
  inspectProjectRuntimeLeaseAcquisitionOwner,
  readProjectOperationQueueState,
  readProjectRuntimeState,
  reconcileProjectRuntimeLeaseOwnerLoss,
  selectNextProjectOperation,
  settleProjectOperationQueueRecovery,
  updateProjectOperationQueueState,
  writeProjectRuntimeState,
} from "./project-runtime-durable-foundation.ts";
import {
  runProjectRuntimeOperation,
  type ProjectRuntimeExecutionDependencies,
  type ProjectRuntimeTaskExecution,
} from "./project-runtime-execution.ts";
import {
  createProjectRuntimeState,
  acknowledgeProjectDockerRecoveryObligation,
  markProjectTaskRecoveryObligationRecovering,
  projectProjectRuntimeState,
  recordProjectTaskOwnerLossRecoveries,
  retrySettledProjectTaskRecoveries,
  settleProjectTaskRecoveryObligation,
  type ProjectObjectiveDefinition,
  type ProjectTaskRecoveryObligation,
  type ProjectDockerRecoveryAcknowledgement,
  type ProjectTaskDefinition,
  type ProjectRuntimeState,
} from "./project-runtime-state.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import {
  inspectProjectRuntimeObjectiveRequest,
  type ProjectRuntimeObjectiveRequest,
} from "./project-runtime-objective-request.ts";

export {
  inspectProjectRuntimeObjectiveRequest,
  type ProjectRuntimeObjectiveRequest,
} from "./project-runtime-objective-request.ts";

export const PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT =
  "crdd-coordinator/project-runtime-objective-intake/v1" as const;

export type ProjectRuntimeObjectivePlan = Readonly<{
  milestoneAcceptanceCriteria: readonly string[];
  objectives: readonly ProjectObjectiveDefinition[];
  tasks: readonly ProjectTaskDefinition[];
}>;

export type ProjectRuntimeObjectiveIntakeDependencies = Readonly<{
  authenticatedPrincipalId: string;
  verifyProjectBinding: (
    input: Readonly<{
      projectId: string;
      milestoneId: string;
      repositoryRevision: string;
    }>,
  ) => unknown;
  planObjective: (
    request: ProjectRuntimeObjectiveRequest,
    bindingCapability: object,
  ) => unknown;
  createTaskExecutions: (
    request: ProjectRuntimeObjectiveRequest,
    bindingCapability: object,
    state: ProjectRuntimeState,
  ) => unknown;
  observeLeaseOwner: (
    owner: Readonly<{
      ownerProcessId: number;
      ownerGeneration: string;
    }>,
  ) => unknown;
  recoverTaskRecovery?: (recoveryId: string) => unknown;
  acknowledgeTaskRecovery?: (
    settlement: Readonly<{
      workingDirectory: string;
      repositoryBindingId: string;
      projectId: string;
      milestoneId: string;
      stateGeneration: number;
      taskId: string;
      attemptId: string;
      operationId: string;
      kind: "docker";
      recoveryId: string;
    }>,
  ) => unknown;
  finalizeTaskRecoveryAcknowledgement?: (
    settlement: Readonly<{
      workingDirectory: string;
      repositoryBindingId: string;
      projectId: string;
      milestoneId: string;
      stateGeneration: number;
      taskId: string;
      attemptId: string;
      operationId: string;
      kind: "docker";
      recoveryId: string;
      acknowledgement: ProjectDockerRecoveryAcknowledgement;
    }>,
  ) => unknown;
  resolveTaskRecoveryCorrelations?: (
    correlationIds: readonly string[],
  ) => unknown;
  observeRecoveryTransition?: (
    event: Readonly<{
      phase:
        | "required"
        | "recovering"
        | "settled"
        | "acknowledged"
        | "verification_resources_finalized"
        | "queue_settled"
        | "retry_ready";
      projectId: string;
      milestoneId: string;
      queueId: string;
      taskId: string | null;
      operationId: string | null;
      recoveryId: string | null;
      stateGeneration: number;
    }>,
  ) => void | Promise<void>;
  execution: ProjectRuntimeExecutionDependencies;
}>;

async function observeRecoveryTransition(
  dependencies: ProjectRuntimeObjectiveIntakeDependencies,
  event: Parameters<
    NonNullable<
      ProjectRuntimeObjectiveIntakeDependencies["observeRecoveryTransition"]
    >
  >[0],
) {
  try {
    await dependencies.observeRecoveryTransition?.(Object.freeze({ ...event }));
  } catch {
    // Recovery correctness never depends on a diagnostic observer.
  }
}

function stableId(prefix: string, ...values: readonly string[]) {
  return `${prefix}-${createHash("sha256")
    .update(values.join("\0"))
    .digest("hex")
    .slice(0, 40)}`;
}

function recoveryApplicationId(
  projectId: string,
  queueId: string,
  state: ProjectRuntimeState,
) {
  const recoveries = state.tasks
    .flatMap((task) =>
      task.recoveryObligations.map(
        (entry) => `${task.definition.id}:${entry.kind}:${entry.recoveryId}`,
      ),
    )
    .sort();
  return recoveries.length === 0
    ? null
    : stableId(
        "project-recovery-application",
        projectId,
        queueId,
        ...recoveries,
      );
}

function exactRecoveryCompleted(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Readonly<Record<string, unknown>>;
  return (
    record.status === "recovered" &&
    record.recoveryId === null &&
    record.manualRecoveryRequired !== true
  );
}

function inspectRecoveryCorrelationBindings(
  value: unknown,
  correlationIds: readonly string[],
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Readonly<Record<string, unknown>>;
  if (
    record.status !== "completed" ||
    !Array.isArray(record.bindings) ||
    !Array.isArray(record.absentCorrelationIds)
  )
    return null;
  const bindings: Array<{
    operationId: string;
    status: "matched" | "verified_absent";
    recoveryId: string | null;
  }> = [];
  for (const item of record.bindings) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const binding = item as Readonly<Record<string, unknown>>;
    if (
      typeof binding.correlationId !== "string" ||
      !correlationIds.includes(binding.correlationId) ||
      typeof binding.recoveryId !== "string" ||
      !validId(binding.correlationId)
    )
      return null;
    bindings.push({
      operationId: binding.correlationId,
      status: "matched",
      recoveryId: binding.recoveryId,
    });
  }
  for (const correlationId of record.absentCorrelationIds) {
    if (typeof correlationId !== "string" || !validId(correlationId))
      return null;
    bindings.push({
      operationId: correlationId,
      status: "verified_absent",
      recoveryId: null,
    });
  }
  return bindings.length === correlationIds.length &&
    bindings.every((entry) => correlationIds.includes(entry.operationId)) &&
    new Set(bindings.map((entry) => entry.operationId)).size === bindings.length
    ? Object.freeze(bindings.map((entry) => Object.freeze(entry)))
    : null;
}

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

function validText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

function inspectStrings(
  value: unknown,
  maximumItems: number,
  maximumText: number,
  allowEmpty = false,
): readonly string[] | null {
  const snapshot = snapshotPlainArray(value, maximumItems);
  if (
    snapshot.status !== "ok" ||
    (!allowEmpty && snapshot.value.length === 0) ||
    !snapshot.value.every((entry) => validText(entry, maximumText)) ||
    new Set(
      snapshot.value.map((entry) =>
        (entry as string).replaceAll("\\", "/").toUpperCase(),
      ),
    ).size !== snapshot.value.length
  )
    return null;
  return Object.freeze([...(snapshot.value as readonly string[])]);
}

function pathWithin(candidate: string, roots: readonly string[]) {
  const normalized = candidate.replaceAll("\\", "/").toUpperCase();
  return roots.some((rootValue) => {
    const root = rootValue
      .replaceAll("\\", "/")
      .replace(/\/+$/u, "")
      .toUpperCase();
    return normalized === root || normalized.startsWith(`${root}/`);
  });
}

function inspectBinding(raw: unknown, revision: string) {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "status",
      "repositoryBindingId",
      "repositoryRevision",
      "workingDirectory",
      "repositoryRoot",
      "bindingCapability",
    ] as const),
  );
  if (!value) return null;
  return value.status === "verified" &&
    validId(value.repositoryBindingId) &&
    value.repositoryRevision === revision &&
    typeof value.workingDirectory === "string" &&
    value.workingDirectory.length > 0 &&
    value.repositoryRoot !== null &&
    (typeof value.repositoryRoot === "object" ||
      typeof value.repositoryRoot === "string") &&
    value.bindingCapability !== null &&
    typeof value.bindingCapability === "object"
    ? Object.freeze({
        repositoryBindingId: value.repositoryBindingId,
        repositoryRevision: revision,
        workingDirectory: value.workingDirectory,
        repositoryRoot: value.repositoryRoot,
        bindingCapability: value.bindingCapability,
      })
    : null;
}

function inspectPlan(
  raw: unknown,
  request: ProjectRuntimeObjectiveRequest,
): ProjectRuntimeObjectivePlan | null {
  const plan = snapshotPlainRecord(
    raw,
    new Set(["milestoneAcceptanceCriteria", "objectives", "tasks"] as const),
  );
  if (!plan) return null;
  const milestoneAcceptanceCriteria = inspectStrings(
    plan.milestoneAcceptanceCriteria,
    128,
    2_048,
  );
  const rawObjectives = snapshotPlainArray(plan.objectives, 128);
  const rawTasks = snapshotPlainArray(plan.tasks, 1024);
  if (
    !milestoneAcceptanceCriteria ||
    rawObjectives.status !== "ok" ||
    rawTasks.status !== "ok" ||
    rawObjectives.value.length === 0 ||
    rawTasks.value.length === 0
  )
    return null;
  const objectives: ProjectObjectiveDefinition[] = [];
  for (const rawObjective of rawObjectives.value) {
    const objective = snapshotPlainRecord(
      rawObjective,
      new Set(["id", "acceptanceCriteria"] as const),
    );
    if (!objective || !validId(objective.id)) return null;
    const acceptanceCriteria = inspectStrings(
      objective.acceptanceCriteria,
      128,
      2_048,
    );
    if (!acceptanceCriteria) return null;
    objectives.push(Object.freeze({ id: objective.id, acceptanceCriteria }));
  }
  const tasks: ProjectTaskDefinition[] = [];
  for (const rawTask of rawTasks.value) {
    const task = snapshotPlainRecord(
      rawTask,
      new Set([
        "id",
        "objectiveId",
        "dependencies",
        "allowedPaths",
        "conflictKeys",
      ] as const),
    );
    if (!task || !validId(task.id) || !validId(task.objectiveId)) return null;
    const dependencies = inspectStrings(task.dependencies, 128, 512, true);
    const allowedPaths = inspectStrings(task.allowedPaths, 128, 512);
    const conflictKeys = inspectStrings(task.conflictKeys, 128, 512, true);
    if (
      !dependencies ||
      !allowedPaths ||
      !conflictKeys ||
      !allowedPaths.every((candidate) =>
        pathWithin(candidate, request.allowedPaths),
      )
    )
      return null;
    tasks.push(
      Object.freeze({
        id: task.id,
        objectiveId: task.objectiveId,
        dependencies,
        allowedPaths,
        conflictKeys,
      }),
    );
  }
  return Object.freeze({
    milestoneAcceptanceCriteria,
    objectives: Object.freeze(objectives),
    tasks: Object.freeze(tasks),
  });
}

function inspectTaskExecutions(
  raw: unknown,
  state: ProjectRuntimeState,
): readonly ProjectRuntimeTaskExecution[] | null {
  const activeTaskIds = state.tasks
    .filter((task) => task.state !== "superseded")
    .map((task) => task.definition.id);
  const rawExecutions = snapshotPlainArray(raw, activeTaskIds.length);
  if (
    rawExecutions.status !== "ok" ||
    rawExecutions.value.length !== activeTaskIds.length
  )
    return null;
  const executions: ProjectRuntimeTaskExecution[] = [];
  for (const rawExecution of rawExecutions.value) {
    const execution = snapshotPlainRecord(
      rawExecution,
      new Set([
        "taskId",
        "authorityBindingId",
        "taskRequest",
        "taskAuthorityCapability",
        "repositoryRoot",
      ] as const),
    );
    if (
      !execution ||
      !validId(execution.taskId) ||
      !activeTaskIds.includes(execution.taskId) ||
      !validId(execution.authorityBindingId) ||
      !execution.taskAuthorityCapability ||
      typeof execution.taskAuthorityCapability !== "object"
    )
      return null;
    executions.push(Object.freeze(execution as ProjectRuntimeTaskExecution));
  }
  if (
    new Set(executions.map((entry) => entry.taskId)).size !== executions.length
  )
    return null;
  return Object.freeze(executions);
}

function projectRuntimeResult(
  request: ProjectRuntimeObjectiveRequest,
  options: Readonly<{
    status: "completed" | "blocked" | "cancelled";
    reason: string;
    queueId?: string | null;
    projection?: ReturnType<typeof projectProjectRuntimeState> | null;
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    processRestartRequired?: boolean;
    recoveryIds?: readonly string[];
    recoveryObligations?: readonly Readonly<{
      kind: ProjectTaskRecoveryObligation["kind"];
      recoveryId: string;
    }>[];
    effectState?: "no_effect" | "settled" | "unknown";
  }>,
) {
  return Object.freeze({
    contract: PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT,
    status: options.status,
    reason: options.reason,
    requestId: request.requestId,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    queueId: options.queueId ?? null,
    projection: options.projection ?? null,
    cleanupConfirmed: options.cleanupConfirmed ?? true,
    manualRecoveryRequired: options.manualRecoveryRequired ?? false,
    processRestartRequired: options.processRestartRequired ?? false,
    recoveryIds: Object.freeze([...(options.recoveryIds ?? [])]),
    recoveryObligations: Object.freeze([
      ...(options.recoveryObligations ?? []),
    ]),
    effectState: options.effectState ?? ("no_effect" as const),
  });
}

function blocked(
  request: ProjectRuntimeObjectiveRequest,
  reason: string,
  options: Readonly<{
    queueId?: string | null;
    projection?: ReturnType<typeof projectProjectRuntimeState> | null;
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    processRestartRequired?: boolean;
    recoveryIds?: readonly string[];
    recoveryObligations?: readonly Readonly<{
      kind: ProjectTaskRecoveryObligation["kind"];
      recoveryId: string;
    }>[];
    effectState?: "no_effect" | "settled" | "unknown";
  }> = {},
) {
  return projectRuntimeResult(request, {
    status: "blocked",
    reason,
    ...options,
  });
}

/** Public semantic entry shared by CLI and MCP transports. */
export async function runProjectRuntimeObjective(
  dependencies: ProjectRuntimeObjectiveIntakeDependencies,
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
) {
  const request = inspectProjectRuntimeObjectiveRequest(rawRequest);
  if (
    !request ||
    !(cancellationSignal instanceof AbortSignal) ||
    !validId(dependencies.authenticatedPrincipalId)
  )
    return blocked(
      Object.freeze({
        requestId: "invalid",
        projectId: "invalid",
        milestoneId: "invalid",
      }) as ProjectRuntimeObjectiveRequest,
      "project_runtime_objective_request_invalid",
    );
  let rawBinding: unknown;
  try {
    rawBinding = dependencies.verifyProjectBinding({
      projectId: request.projectId,
      milestoneId: request.milestoneId,
      repositoryRevision: request.repositoryRevision,
    });
  } catch {
    rawBinding = null;
  }
  const binding = inspectBinding(rawBinding, request.repositoryRevision);
  if (!binding) return blocked(request, "project_runtime_binding_not_verified");
  let rawPlan: unknown;
  try {
    rawPlan = dependencies.planObjective(request, binding.bindingCapability);
  } catch {
    rawPlan = null;
  }
  const plan = inspectPlan(rawPlan, request);
  if (!plan)
    return blocked(request, "project_runtime_plan_invalid_or_out_of_scope");
  const queueId = stableId(
    "queue",
    binding.repositoryBindingId,
    request.projectId,
    request.milestoneId,
    request.requestId,
    dependencies.authenticatedPrincipalId,
  );
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        ...request,
        authenticatedPrincipalId: dependencies.authenticatedPrincipalId,
        acceptanceCriteria: [...request.acceptanceCriteria],
        allowedPaths: [...request.allowedPaths],
        readPaths: [...request.readPaths],
      }),
    )
    .digest("hex");
  const scopeHash = createHash("sha256")
    .update(
      JSON.stringify({
        allowedPaths: request.allowedPaths,
        readPaths: request.readPaths,
      }),
    )
    .digest("hex");

  const workingDirectory = binding.workingDirectory;
  const acquisitionOwner = inspectProjectRuntimeLeaseAcquisitionOwner(
    workingDirectory,
    binding.repositoryBindingId,
  );
  if (acquisitionOwner.status !== "completed")
    return blocked(request, acquisitionOwner.reason, {
      cleanupConfirmed: false,
      manualRecoveryRequired: acquisitionOwner.manualRecoveryRequired,
      recoveryIds:
        acquisitionOwner.recoveryId === null
          ? Object.freeze([])
          : Object.freeze([acquisitionOwner.recoveryId]),
      effectState: acquisitionOwner.manualRecoveryRequired
        ? "unknown"
        : "no_effect",
    });
  const resolvedAcquisition = acquisitionOwner.value.acquisition;
  if (
    resolvedAcquisition !== null &&
    resolvedAcquisition.projectId !== request.projectId
  )
    return blocked(
      request,
      "project_runtime_lease_acquisition_project_identity_mismatch",
      {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        recoveryIds: Object.freeze([resolvedAcquisition.recoveryId]),
        effectState: "unknown",
      },
    );
  const observedState = readProjectRuntimeState(
    workingDirectory,
    binding.repositoryBindingId,
    request.projectId,
  );
  let state = observedState;
  if (state.status !== "completed")
    return blocked(request, state.reason, {
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  if (state.value === null) {
    const created = createProjectRuntimeState({
      projectId: request.projectId,
      milestoneId: request.milestoneId,
      repositoryRevision: request.repositoryRevision,
      maximumConcurrency: request.maximumConcurrency,
      milestoneAcceptanceCriteria: plan.milestoneAcceptanceCriteria,
      objectives: plan.objectives,
      tasks: plan.tasks,
    });
    if (created.status !== "completed") return blocked(request, created.reason);
    const written = writeProjectRuntimeState(
      workingDirectory,
      binding.repositoryBindingId,
      created.state,
      0,
    );
    if (written.status !== "completed")
      return blocked(request, written.reason, {
        cleanupConfirmed: false,
        manualRecoveryRequired: written.manualRecoveryRequired,
        effectState: "unknown",
      });
    state = Object.freeze({
      status: "completed" as const,
      reason: written.reason,
      value: written.value,
    });
  } else if (
    state.value.milestoneId !== request.milestoneId ||
    state.value.repositoryRevision !== request.repositoryRevision
  ) {
    return blocked(request, "project_runtime_existing_state_identity_mismatch");
  }
  const queued = enqueueProjectOperation(
    workingDirectory,
    binding.repositoryBindingId,
    {
      queueId,
      projectId: request.projectId,
      milestoneId: request.milestoneId,
      requestHash,
      originLane: request.originLane,
      repositoryRevision: request.repositoryRevision,
      scopeHash,
    },
  );
  if (queued.status !== "completed")
    return blocked(request, queued.reason, {
      cleanupConfirmed: false,
      manualRecoveryRequired: queued.manualRecoveryRequired,
      effectState: queued.manualRecoveryRequired ? "unknown" : "no_effect",
    });
  let queue = queued.value;
  const recoveryQueueId =
    resolvedAcquisition?.queueId ??
    (queue.ownerGeneration === null ? null : queueId);
  if (recoveryQueueId !== null) {
    const reconciled = reconcileProjectRuntimeLeaseOwnerLoss(
      workingDirectory,
      binding.repositoryBindingId,
      request.projectId,
      recoveryQueueId,
      dependencies.observeLeaseOwner,
    );
    if (
      reconciled.status !== "completed" &&
      reconciled.reason === "project_runtime_lease_owner_still_active" &&
      recoveryQueueId === queueId &&
      state.value
    )
      return projectRuntimeResult(request, {
        status: "blocked",
        reason: "project_runtime_objective_already_running",
        queueId,
        projection: projectProjectRuntimeState(state.value),
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        processRestartRequired: false,
        recoveryIds: Object.freeze([]),
        recoveryObligations: Object.freeze([]),
        effectState: "no_effect" as const,
      });
    if (
      reconciled.status !== "completed" &&
      reconciled.reason !== "project_runtime_lease_owner_still_active"
    )
      return blocked(request, reconciled.reason, {
        cleanupConfirmed: !reconciled.manualRecoveryRequired,
        manualRecoveryRequired: reconciled.manualRecoveryRequired,
        recoveryIds:
          reconciled.recoveryId === null
            ? Object.freeze([])
            : Object.freeze([reconciled.recoveryId]),
        effectState: reconciled.manualRecoveryRequired
          ? "unknown"
          : "no_effect",
      });
    const reread = readProjectOperationQueueState(
      workingDirectory,
      binding.repositoryBindingId,
      queueId,
    );
    if (reread.status !== "completed")
      return blocked(request, reread.reason, {
        cleanupConfirmed: false,
        manualRecoveryRequired: reread.manualRecoveryRequired,
        effectState: "unknown",
      });
    queue = reread.value;
  }
  if (
    queue.state === "recovery_required" &&
    queue.resumeCondition === "owner_loss" &&
    state.value
  ) {
    const activeTasks = state.value.tasks.filter((task) =>
      ["starting", "running"].includes(task.state),
    );
    const operationIds = activeTasks
      .map((task) => task.operationId)
      .filter((value): value is string => value !== null);
    let applicationId = recoveryApplicationId(
      request.projectId,
      queueId,
      state.value,
    );
    if (applicationId === null && activeTasks.length > 0) {
      let bindings: ReturnType<typeof inspectRecoveryCorrelationBindings> =
        Object.freeze([]);
      if (operationIds.length > 0) {
        let rawBindings: unknown;
        try {
          rawBindings =
            dependencies.resolveTaskRecoveryCorrelations?.(operationIds) ??
            null;
        } catch {
          rawBindings = null;
        }
        bindings = inspectRecoveryCorrelationBindings(
          rawBindings,
          operationIds,
        );
      }
      if (!bindings)
        return blocked(
          request,
          "project_runtime_owner_loss_recovery_unresolved",
          {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
          },
        );
      const bound = recordProjectTaskOwnerLossRecoveries(
        state.value,
        state.value.generation,
        bindings,
      );
      if (bound.status !== "completed" || !bound.state)
        return blocked(request, bound.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      const boundWrite = writeProjectRuntimeState(
        workingDirectory,
        binding.repositoryBindingId,
        bound.state,
        state.value.generation,
      );
      if (boundWrite.status !== "completed")
        return blocked(request, boundWrite.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      state = Object.freeze({
        status: "completed" as const,
        reason: boundWrite.reason,
        value: boundWrite.value,
      });
      for (const task of boundWrite.value.tasks) {
        for (const obligation of task.recoveryObligations) {
          await observeRecoveryTransition(dependencies, {
            phase: "required",
            projectId: request.projectId,
            milestoneId: request.milestoneId,
            queueId,
            taskId: task.definition.id,
            operationId: task.operationId,
            recoveryId: obligation.recoveryId,
            stateGeneration: boundWrite.value.generation,
          });
        }
      }
      applicationId = recoveryApplicationId(
        request.projectId,
        queueId,
        boundWrite.value,
      );
    }
    if (!applicationId) {
      const remainingActiveTasks = (state.value?.tasks ?? []).filter((task) =>
        ["starting", "running"].includes(task.state),
      );
      if (remainingActiveTasks.length > 0)
        return blocked(
          request,
          "project_runtime_owner_loss_recovery_unresolved",
          {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
          },
        );
      const reopenedQueue = updateProjectOperationQueueState(
        workingDirectory,
        binding.repositoryBindingId,
        queueId,
        queue.generation,
        {
          state: "queued",
          lease: null,
          resumeCondition: null,
          resultReference: null,
        },
      );
      if (reopenedQueue.status !== "completed")
        return blocked(request, reopenedQueue.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      queue = reopenedQueue.value;
    } else {
      const reboundQueue = updateProjectOperationQueueState(
        workingDirectory,
        binding.repositoryBindingId,
        queueId,
        queue.generation,
        {
          state: "recovery_required",
          lease: null,
          resumeCondition: "exact_recovery",
          resultReference: applicationId,
        },
      );
      if (reboundQueue.status !== "completed")
        return blocked(request, reboundQueue.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      queue = reboundQueue.value;
    }
  }
  if (
    (queue.state === "recovery_required" ||
      (queue.state === "queued" &&
        queue.resumeCondition === "exact_recovery_settled")) &&
    state.value
  ) {
    let recoveryState = state.value;
    const recoveryApplication = recoveryApplicationId(
      request.projectId,
      queueId,
      recoveryState,
    );
    const unresolvedTasks = recoveryState.tasks.filter(
      (task) => task.state === "recovery_required" && task.recoveryUnresolved,
    );
    const recoveries = recoveryState.tasks.flatMap((task) =>
      task.recoveryObligations.map((entry) =>
        Object.freeze({ taskId: task.definition.id, ...entry }),
      ),
    );
    const publicRecoveryObligations = recoveries.map(({ kind, recoveryId }) =>
      Object.freeze({ kind, recoveryId }),
    );
    if (unresolvedTasks.length > 0)
      return blocked(request, "project_runtime_recovery_result_unresolved", {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
        recoveryIds: recoveries.map((entry) => entry.recoveryId),
        recoveryObligations: publicRecoveryObligations,
      });
    if (!recoveryApplication || queue.resultReference !== recoveryApplication)
      return blocked(request, "project_runtime_recovery_identity_mismatch", {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
        recoveryIds: recoveries.map((entry) => entry.recoveryId),
        recoveryObligations: publicRecoveryObligations,
      });
    if (queue.state === "recovery_required") {
      for (const item of recoveries.filter(
        (entry) =>
          ["docker", "runtime_process"].includes(entry.kind) &&
          entry.phase !== "settled" &&
          entry.phase !== "acknowledged",
      )) {
        if (item.phase === "required") {
          const recovering = markProjectTaskRecoveryObligationRecovering(
            recoveryState,
            recoveryState.generation,
            item.taskId,
            item.kind,
            item.recoveryId,
          );
          if (recovering.status !== "completed" || !recovering.state)
            return blocked(request, recovering.reason, {
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              effectState: "unknown",
              recoveryIds: [item.recoveryId],
              recoveryObligations: [
                Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
              ],
            });
          const recoveringWrite = writeProjectRuntimeState(
            workingDirectory,
            binding.repositoryBindingId,
            recovering.state,
            recoveryState.generation,
          );
          if (recoveringWrite.status !== "completed")
            return blocked(request, recoveringWrite.reason, {
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              effectState: "unknown",
              recoveryIds: [item.recoveryId],
              recoveryObligations: [
                Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
              ],
            });
          state = Object.freeze({
            status: "completed" as const,
            reason: recoveringWrite.reason,
            value: recoveringWrite.value,
          });
          recoveryState = recoveringWrite.value;
          await observeRecoveryTransition(dependencies, {
            phase: "recovering",
            projectId: request.projectId,
            milestoneId: request.milestoneId,
            queueId,
            taskId: item.taskId,
            operationId:
              recoveryState.tasks.find(
                (entry) => entry.definition.id === item.taskId,
              )?.operationId ?? null,
            recoveryId: item.recoveryId,
            stateGeneration: recoveryState.generation,
          });
        }
        let recovery: unknown;
        if (item.kind === "runtime_process") {
          const task = recoveryState.tasks.find(
            (entry) => entry.definition.id === item.taskId,
          );
          const match =
            task?.attemptId && task.operationId
              ? inspectRuntimeProcessRecoveryIdentity(
                  item.recoveryId,
                  task.attemptId,
                  task.operationId,
                )
              : null;
          recovery =
            match &&
            match.processIdentity !== getRuntimeProcessInstanceIdentity()
              ? Object.freeze({
                  status: "recovered" as const,
                  recoveryId: null,
                  manualRecoveryRequired: false,
                })
              : null;
        } else {
          try {
            recovery =
              dependencies.recoverTaskRecovery?.(item.recoveryId) ?? null;
          } catch {
            recovery = null;
          }
        }
        if (!exactRecoveryCompleted(recovery))
          return blocked(request, "project_runtime_task_recovery_not_settled", {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
            recoveryIds: [item.recoveryId],
            recoveryObligations: [
              Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
            ],
          });
        const settledItem = settleProjectTaskRecoveryObligation(
          recoveryState,
          recoveryState.generation,
          item.taskId,
          item.kind,
          item.recoveryId,
        );
        if (settledItem.status !== "completed" || !settledItem.state)
          return blocked(request, settledItem.reason, {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
            recoveryIds: [item.recoveryId],
            recoveryObligations: [
              Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
            ],
          });
        const settledWrite = writeProjectRuntimeState(
          workingDirectory,
          binding.repositoryBindingId,
          settledItem.state,
          recoveryState.generation,
        );
        if (settledWrite.status !== "completed")
          return blocked(request, settledWrite.reason, {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
            recoveryIds: [item.recoveryId],
            recoveryObligations: [
              Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
            ],
          });
        state = Object.freeze({
          status: "completed" as const,
          reason: settledWrite.reason,
          value: settledWrite.value,
        });
        recoveryState = settledWrite.value;
        await observeRecoveryTransition(dependencies, {
          phase: "settled",
          projectId: request.projectId,
          milestoneId: request.milestoneId,
          queueId,
          taskId: item.taskId,
          operationId:
            recoveryState.tasks.find(
              (entry) => entry.definition.id === item.taskId,
            )?.operationId ?? null,
          recoveryId: item.recoveryId,
          stateGeneration: recoveryState.generation,
        });
      }
    }
    for (const item of recoveries.filter((entry) => entry.kind === "docker")) {
      const settledTask = recoveryState.tasks.find(
        (entry) => entry.definition.id === item.taskId,
      );
      if (
        !settledTask?.attemptId ||
        !settledTask.operationId ||
        !settledTask.recoveryObligations.some(
          (entry) =>
            entry.kind === "docker" &&
            entry.recoveryId === item.recoveryId &&
            ["settled", "acknowledged"].includes(entry.phase),
        )
      )
        return blocked(
          request,
          "project_runtime_task_recovery_acknowledgement_not_settled",
          {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
            recoveryIds: [item.recoveryId],
            recoveryObligations: [
              Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
            ],
          },
        );
      let currentObligation = settledTask.recoveryObligations.find(
        (entry) =>
          entry.kind === "docker" && entry.recoveryId === item.recoveryId,
      );
      if (currentObligation?.phase === "settled") {
        let acknowledgementResult: unknown;
        try {
          acknowledgementResult =
            dependencies.acknowledgeTaskRecovery?.(
              Object.freeze({
                workingDirectory,
                repositoryBindingId: binding.repositoryBindingId,
                projectId: request.projectId,
                milestoneId: request.milestoneId,
                stateGeneration: recoveryState.generation,
                taskId: item.taskId,
                attemptId: settledTask.attemptId,
                operationId: settledTask.operationId,
                kind: "docker" as const,
                recoveryId: item.recoveryId,
              }),
            ) ?? null;
        } catch {
          acknowledgementResult = null;
        }
        const acknowledged = snapshotPlainRecord(
          acknowledgementResult,
          new Set(["status", "reason", "acknowledgement"]),
        );
        const evidence = snapshotPlainRecord(
          acknowledged?.acknowledgement,
          new Set([
            "runtimeStateBinding",
            "receiptContentHash",
            "receiptContentIdentity",
          ]),
        );
        const runtimeStateBinding = snapshotPlainRecord(
          evidence?.runtimeStateBinding,
          new Set([
            "runtimeStateIdentityHash",
            "runtimeStateProtectionHash",
            "localUserBindingHash",
            "runtimeStateBindingHash",
          ]),
        );
        if (
          acknowledged?.status !== "completed" ||
          typeof acknowledged.reason !== "string" ||
          !evidence ||
          !runtimeStateBinding
        )
          return blocked(
            request,
            "project_runtime_task_recovery_acknowledgement_not_settled",
            {
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              effectState: "unknown",
              recoveryIds: [item.recoveryId],
              recoveryObligations: [
                Object.freeze({
                  kind: item.kind,
                  recoveryId: item.recoveryId,
                }),
              ],
            },
          );
        const durableAcknowledgement = Object.freeze({
          repositoryBindingId: binding.repositoryBindingId,
          projectId: request.projectId,
          milestoneId: request.milestoneId,
          taskId: item.taskId,
          attemptId: settledTask.attemptId,
          operationId: settledTask.operationId,
          recoveryId: item.recoveryId,
          settlementGeneration: recoveryState.generation,
          runtimeStateBinding,
          receiptContentHash: String(evidence.receiptContentHash),
          receiptContentIdentity: String(evidence.receiptContentIdentity),
        }) as ProjectDockerRecoveryAcknowledgement;
        const marked = acknowledgeProjectDockerRecoveryObligation(
          recoveryState,
          recoveryState.generation,
          durableAcknowledgement,
        );
        if (marked.status !== "completed" || !marked.state)
          return blocked(request, marked.reason, {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
          });
        const markedWrite = writeProjectRuntimeState(
          workingDirectory,
          binding.repositoryBindingId,
          marked.state,
          recoveryState.generation,
        );
        if (markedWrite.status !== "completed")
          return blocked(request, markedWrite.reason, {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
          });
        recoveryState = markedWrite.value;
        state = Object.freeze({
          status: "completed" as const,
          reason: markedWrite.reason,
          value: markedWrite.value,
        });
        await observeRecoveryTransition(dependencies, {
          phase: "acknowledged",
          projectId: request.projectId,
          milestoneId: request.milestoneId,
          queueId,
          taskId: item.taskId,
          operationId: settledTask.operationId,
          recoveryId: item.recoveryId,
          stateGeneration: recoveryState.generation,
        });
        currentObligation = recoveryState.tasks
          .find((entry) => entry.definition.id === item.taskId)
          ?.recoveryObligations.find(
            (entry) =>
              entry.kind === "docker" && entry.recoveryId === item.recoveryId,
          );
      }
      if (
        currentObligation?.phase !== "acknowledged" ||
        !currentObligation.acknowledgement
      )
        return blocked(
          request,
          "project_runtime_task_recovery_acknowledgement_not_settled",
          {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
          },
        );
      let finalized: unknown;
      try {
        finalized =
          dependencies.finalizeTaskRecoveryAcknowledgement?.(
            Object.freeze({
              workingDirectory,
              repositoryBindingId: binding.repositoryBindingId,
              projectId: request.projectId,
              milestoneId: request.milestoneId,
              stateGeneration: recoveryState.generation,
              taskId: item.taskId,
              attemptId: settledTask.attemptId,
              operationId: settledTask.operationId,
              kind: "docker" as const,
              recoveryId: item.recoveryId,
              acknowledgement: currentObligation.acknowledgement,
            }),
          ) ?? null;
      } catch {
        finalized = null;
      }
      const finalResult = snapshotPlainRecord(
        finalized,
        new Set(["status", "reason"]),
      );
      if (
        finalResult?.status !== "completed" ||
        typeof finalResult.reason !== "string"
      )
        return blocked(
          request,
          "project_runtime_task_recovery_acknowledgement_gc_not_settled",
          {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
            recoveryIds: [item.recoveryId],
            recoveryObligations: [
              Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
            ],
          },
        );
      await observeRecoveryTransition(dependencies, {
        phase: "verification_resources_finalized",
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        queueId,
        taskId: item.taskId,
        operationId: settledTask.operationId,
        recoveryId: item.recoveryId,
        stateGeneration: recoveryState.generation,
      });
    }
    const externallyOwned = recoveryState.tasks.flatMap((task) =>
      task.recoveryObligations
        .filter(
          (entry) =>
            !["docker", "runtime_process"].includes(entry.kind) &&
            entry.phase !== "settled",
        )
        .map((entry) => ({ taskId: task.definition.id, ...entry })),
    );
    if (externallyOwned.length > 0)
      return blocked(request, "project_runtime_external_recovery_required", {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
        recoveryIds: recoveryState.tasks.flatMap((task) =>
          task.recoveryObligations
            .filter(
              (entry) =>
                entry.phase !==
                (entry.kind === "docker" ? "acknowledged" : "settled"),
            )
            .map((entry) => entry.recoveryId),
        ),
        recoveryObligations: recoveryState.tasks.flatMap((task) =>
          task.recoveryObligations
            .filter(
              (entry) =>
                entry.phase !==
                (entry.kind === "docker" ? "acknowledged" : "settled"),
            )
            .map(({ kind, recoveryId }) => Object.freeze({ kind, recoveryId })),
        ),
      });
    if (queue.state === "recovery_required") {
      const queueSettlement = settleProjectOperationQueueRecovery(
        workingDirectory,
        binding.repositoryBindingId,
        queueId,
        queue.generation,
        recoveryApplication,
      );
      if (queueSettlement.status !== "completed")
        return blocked(request, queueSettlement.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      queue = queueSettlement.value;
      await observeRecoveryTransition(dependencies, {
        phase: "queue_settled",
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        queueId,
        taskId: null,
        operationId: null,
        recoveryId: null,
        stateGeneration: recoveryState.generation,
      });
    }
    const retryTaskIds = recoveryState.tasks
      .filter(
        (task) =>
          task.state === "recovery_required" &&
          !task.recoveryUnresolved &&
          task.recoveryObligations.length > 0 &&
          task.recoveryObligations.every(
            (entry) =>
              entry.phase ===
              (entry.kind === "docker" ? "acknowledged" : "settled"),
          ),
      )
      .map((task) => task.definition.id);
    if (retryTaskIds.length > 0) {
      const retry = retrySettledProjectTaskRecoveries(
        recoveryState,
        recoveryState.generation,
        retryTaskIds,
      );
      if (retry.status !== "completed")
        return blocked(request, retry.reason, {
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          effectState: "no_effect",
        });
      const retryWrite = writeProjectRuntimeState(
        workingDirectory,
        binding.repositoryBindingId,
        retry.state,
        recoveryState.generation,
      );
      if (retryWrite.status !== "completed")
        return blocked(request, retryWrite.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      state = Object.freeze({
        status: "completed" as const,
        reason: retryWrite.reason,
        value: retryWrite.value,
      });
      recoveryState = retryWrite.value;
      await observeRecoveryTransition(dependencies, {
        phase: "retry_ready",
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        queueId,
        taskId: null,
        operationId: null,
        recoveryId: null,
        stateGeneration: recoveryState.generation,
      });
    }
  }
  if (queue.state === "queued" || queue.state === "waiting_foreground") {
    const currentState = state.value;
    if (!currentState)
      return blocked(request, "project_runtime_state_observation_unknown", {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
      });
    const selected = selectNextProjectOperation(
      workingDirectory,
      binding.repositoryBindingId,
    );
    if (selected.status !== "completed")
      return blocked(request, selected.reason, {
        cleanupConfirmed: false,
        manualRecoveryRequired: selected.manualRecoveryRequired,
        effectState: "unknown",
      });
    if (!selected.value || selected.value.queueId !== queueId)
      return projectRuntimeResult(request, {
        status: "blocked",
        reason: "project_runtime_objective_queued_waiting_foreground",
        queueId,
        projection: projectProjectRuntimeState(currentState),
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        processRestartRequired: false,
        recoveryIds: Object.freeze([]),
        recoveryObligations: Object.freeze([]),
        effectState: "no_effect" as const,
      });
  }
  if (queue.state === "integration_pending" && state.value) {
    return projectRuntimeResult(request, {
      status: "completed",
      reason: "project_runtime_tasks_already_integration_pending",
      queueId,
      projection: projectProjectRuntimeState(state.value),
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      recoveryIds: Object.freeze([]),
      recoveryObligations: Object.freeze([]),
      effectState: "no_effect" as const,
    });
  }
  if (queue.state === "completed" && state.value) {
    const projection = projectProjectRuntimeState(state.value);
    if (projection.milestoneState !== "accepted")
      return blocked(request, "project_runtime_terminal_replay_mismatch", {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
      });
    return projectRuntimeResult(request, {
      status: "completed",
      reason: "project_runtime_objective_already_accepted",
      queueId,
      projection,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      recoveryIds: Object.freeze([]),
      recoveryObligations: Object.freeze([]),
      effectState: "no_effect" as const,
    });
  }
  if (queue.state === "cancelled" && state.value)
    return projectRuntimeResult(request, {
      status: "cancelled",
      reason: "project_runtime_objective_already_cancelled",
      queueId,
      projection: projectProjectRuntimeState(state.value),
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      recoveryIds: Object.freeze([]),
      recoveryObligations: Object.freeze([]),
      effectState: "no_effect" as const,
    });
  if (queue.state !== "queued" && state.value) {
    const manualRecoveryRequired = queue.state === "recovery_required";
    const outstandingRecoveries = state.value.tasks.flatMap((task) =>
      task.recoveryObligations.filter(
        (entry) =>
          entry.phase !==
          (entry.kind === "docker" ? "acknowledged" : "settled"),
      ),
    );
    return projectRuntimeResult(request, {
      status: "blocked",
      reason: `project_runtime_objective_${queue.state}`,
      queueId,
      projection: projectProjectRuntimeState(state.value),
      cleanupConfirmed: !manualRecoveryRequired,
      manualRecoveryRequired,
      processRestartRequired: outstandingRecoveries.some(
        (entry) => entry.kind === "runtime_process",
      ),
      recoveryIds: Object.freeze(
        outstandingRecoveries.map((entry) => entry.recoveryId),
      ),
      recoveryObligations: Object.freeze(
        outstandingRecoveries.map(({ kind, recoveryId }) =>
          Object.freeze({ kind, recoveryId }),
        ),
      ),
      effectState: manualRecoveryRequired
        ? ("unknown" as const)
        : ("no_effect" as const),
    });
  }
  const executableState = state.value;
  if (!executableState)
    return blocked(request, "project_runtime_state_observation_unknown", {
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  let rawExecutions: unknown;
  try {
    rawExecutions = dependencies.createTaskExecutions(
      request,
      binding.bindingCapability,
      executableState,
    );
  } catch {
    rawExecutions = null;
  }
  const taskExecutions = inspectTaskExecutions(rawExecutions, executableState);
  if (!taskExecutions)
    return blocked(request, "project_runtime_task_execution_set_invalid");
  const execution = await runProjectRuntimeOperation(dependencies.execution, {
    workingDirectory,
    repositoryBindingId: binding.repositoryBindingId,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    queueId,
    taskExecutions: taskExecutions.map((entry) =>
      Object.freeze({ ...entry, repositoryRoot: binding.repositoryRoot }),
    ),
    cancellationSignal,
  });
  const latest = readProjectRuntimeState(
    workingDirectory,
    binding.repositoryBindingId,
    request.projectId,
  );
  const projection =
    latest.status === "completed" && latest.value
      ? projectProjectRuntimeState(latest.value)
      : null;
  return projectRuntimeResult(request, {
    status: execution.status,
    reason: execution.reason,
    queueId,
    projection,
    cleanupConfirmed: execution.cleanupConfirmed,
    manualRecoveryRequired: execution.manualRecoveryRequired,
    processRestartRequired: execution.processRestartRequired,
    recoveryIds: execution.recoveryIds,
    recoveryObligations: execution.recoveryObligations,
    effectState: execution.effectState,
  });
}

export function describeProjectRuntimeObjectiveIntakeContract() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT,
    transports: Object.freeze(["cli", "mcp"]),
    duplicateRequest: "same_queue_and_latest_state_no_duplicate_effect",
    scopeExpansionByPlanner: false,
    ownerLossObservation: "platform_adapter_only",
  });
}
