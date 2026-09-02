import { createHash } from "node:crypto";

import {
  enqueueProjectOperation,
  readProjectRuntimeState,
  reconcileProjectRuntimeLeaseOwnerLoss,
  selectNextProjectOperation,
  writeProjectRuntimeState,
} from "./project-runtime-durable-foundation.ts";
import {
  runProjectRuntimeOperation,
  type ProjectRuntimeExecutionDependencies,
  type ProjectRuntimeTaskExecution,
} from "./project-runtime-execution.ts";
import {
  createProjectRuntimeState,
  projectProjectRuntimeState,
  type ProjectObjectiveDefinition,
  type ProjectTaskDefinition,
  type ProjectRuntimeState,
} from "./project-runtime-state.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";

export const PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT =
  "crdd-coordinator/project-runtime-objective-intake/v1" as const;

export type ProjectRuntimeObjectiveRequest = Readonly<{
  requestId: string;
  projectId: string;
  milestoneId: string;
  repositoryRevision: string;
  objective: string;
  acceptanceCriteria: readonly string[];
  allowedPaths: readonly string[];
  readPaths: readonly string[];
  maximumConcurrency: number;
  maximumReplans: number;
  originLane: "interactive" | "scheduled";
  adoptResult: boolean;
}>;

export type ProjectRuntimeObjectivePlan = Readonly<{
  milestoneAcceptanceCriteria: readonly string[];
  objectives: readonly ProjectObjectiveDefinition[];
  tasks: readonly ProjectTaskDefinition[];
}>;

export type ProjectRuntimeObjectiveIntakeDependencies = Readonly<{
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
  execution: ProjectRuntimeExecutionDependencies;
}>;

function stableId(prefix: string, ...values: readonly string[]) {
  return `${prefix}-${createHash("sha256")
    .update(values.join("\0"))
    .digest("hex")
    .slice(0, 40)}`;
}

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

function validRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
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

const REQUEST_KEYS = new Set([
  "requestId",
  "projectId",
  "milestoneId",
  "repositoryRevision",
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "readPaths",
  "maximumConcurrency",
  "maximumReplans",
  "originLane",
  "adoptResult",
] as const);

export function inspectProjectRuntimeObjectiveRequest(
  value: unknown,
): ProjectRuntimeObjectiveRequest | null {
  const request = snapshotPlainRecord(value, REQUEST_KEYS);
  if (!request) return null;
  const acceptanceCriteria = inspectStrings(
    request.acceptanceCriteria,
    128,
    2_048,
  );
  const allowedPaths = inspectStrings(request.allowedPaths, 128, 512);
  const readPaths = inspectStrings(request.readPaths, 128, 512);
  if (
    !validId(request.requestId) ||
    !validId(request.projectId) ||
    !validId(request.milestoneId) ||
    !validRevision(request.repositoryRevision) ||
    !validText(request.objective, 16_384) ||
    !acceptanceCriteria ||
    !allowedPaths ||
    !readPaths ||
    !Number.isSafeInteger(request.maximumConcurrency) ||
    (request.maximumConcurrency as number) < 1 ||
    (request.maximumConcurrency as number) > 5 ||
    !Number.isSafeInteger(request.maximumReplans) ||
    (request.maximumReplans as number) < 0 ||
    (request.maximumReplans as number) > 32 ||
    (request.originLane !== "interactive" &&
      request.originLane !== "scheduled") ||
    typeof request.adoptResult !== "boolean"
  )
    return null;
  return Object.freeze({
    requestId: request.requestId,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    repositoryRevision: request.repositoryRevision,
    objective: request.objective,
    acceptanceCriteria,
    allowedPaths,
    readPaths,
    maximumConcurrency: request.maximumConcurrency as number,
    maximumReplans: request.maximumReplans as number,
    originLane: request.originLane,
    adoptResult: request.adoptResult,
  });
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

function blocked(
  request: ProjectRuntimeObjectiveRequest,
  reason: string,
  options: Readonly<{
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    effectState?: "no_effect" | "settled" | "unknown";
  }> = {},
) {
  return Object.freeze({
    contract: PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT,
    status: "blocked" as const,
    reason,
    requestId: request.requestId,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    queueId: null,
    projection: null,
    cleanupConfirmed: options.cleanupConfirmed ?? true,
    manualRecoveryRequired: options.manualRecoveryRequired ?? false,
    effectState: options.effectState ?? ("no_effect" as const),
  });
}

/** Public semantic entry shared by CLI and MCP transports. */
export async function runProjectRuntimeObjective(
  dependencies: ProjectRuntimeObjectiveIntakeDependencies,
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
) {
  const request = inspectProjectRuntimeObjectiveRequest(rawRequest);
  if (!request || !(cancellationSignal instanceof AbortSignal))
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
  );
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        ...request,
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
  if (queue.ownerGeneration !== null) {
    const reconciled = reconcileProjectRuntimeLeaseOwnerLoss(
      workingDirectory,
      binding.repositoryBindingId,
      request.projectId,
      queueId,
      dependencies.observeLeaseOwner,
    );
    if (reconciled.status !== "completed")
      return blocked(request, reconciled.reason, {
        cleanupConfirmed: false,
        manualRecoveryRequired: reconciled.manualRecoveryRequired,
        effectState: "unknown",
      });
    queue = reconciled.value;
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
      return Object.freeze({
        contract: PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT,
        status: "blocked" as const,
        reason: "project_runtime_objective_queued_waiting_foreground",
        requestId: request.requestId,
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        queueId,
        projection: projectProjectRuntimeState(currentState),
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
  }
  if (queue.state === "integration_pending" && state.value) {
    return Object.freeze({
      contract: PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT,
      status: "completed" as const,
      reason: "project_runtime_tasks_already_integration_pending",
      requestId: request.requestId,
      projectId: request.projectId,
      milestoneId: request.milestoneId,
      queueId,
      projection: projectProjectRuntimeState(state.value),
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
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
  return Object.freeze({
    contract: PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT,
    status: execution.status,
    reason: execution.reason,
    requestId: request.requestId,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    queueId,
    projection,
    cleanupConfirmed: execution.cleanupConfirmed,
    manualRecoveryRequired: execution.manualRecoveryRequired,
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
