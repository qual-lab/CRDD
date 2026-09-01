import { randomUUID } from "node:crypto";

export const PROJECT_RUNTIME_STATE_CONTRACT =
  "crdd-coordinator/project-runtime-state/v1" as const;
export const PROJECT_RUNTIME_MAXIMUM_CONCURRENCY = 5;

export type ProjectTaskState =
  | "planned"
  | "waiting_dependency"
  | "ready"
  | "starting"
  | "running"
  | "cleanup_pending"
  | "completed"
  | "failed"
  | "cancelled"
  | "recovery_required"
  | "superseded";

export type ProjectTaskDefinition = Readonly<{
  id: string;
  objectiveId: string;
  dependencies: readonly string[];
  allowedPaths: readonly string[];
  conflictKeys: readonly string[];
}>;

export type ProjectTaskRecord = Readonly<{
  definition: ProjectTaskDefinition;
  state: ProjectTaskState;
  attemptId: string | null;
  operationId: string | null;
  cleanupConfirmed: boolean;
  recoveryId: string | null;
  supersededBy: string | null;
}>;

export type ProjectRuntimeState = Readonly<{
  contract: typeof PROJECT_RUNTIME_STATE_CONTRACT;
  projectId: string;
  milestoneId: string;
  repositoryRevision: string;
  generation: number;
  ownerGeneration: string;
  maximumConcurrency: number;
  tasks: readonly ProjectTaskRecord[];
}>;

type StateResult =
  | Readonly<{
      status: "completed";
      reason: string;
      state: ProjectRuntimeState;
      taskIds: readonly string[];
    }>
  | Readonly<{
      status: "blocked";
      reason: string;
      state: ProjectRuntimeState | null;
      taskIds: readonly string[];
    }>;

function validIdentity(value: unknown) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

function validRevision(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
}

function validRecoveryIdentity(value: unknown) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

function normalizedUniqueStrings(
  values: readonly string[],
  maximum: number,
): readonly string[] | null {
  if (values.length > maximum) return null;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0 || value.length > 512)
      return null;
    const normalized = value.replaceAll("\\", "/");
    const key = normalized.toUpperCase();
    if (seen.has(key)) return null;
    seen.add(key);
    result.push(normalized);
  }
  return Object.freeze(result);
}

function snapshotDefinition(
  definition: ProjectTaskDefinition,
): ProjectTaskDefinition | null {
  if (!validIdentity(definition.id) || !validIdentity(definition.objectiveId))
    return null;
  const dependencies = normalizedUniqueStrings(definition.dependencies, 128);
  const allowedPaths = normalizedUniqueStrings(definition.allowedPaths, 128);
  const conflictKeys = normalizedUniqueStrings(definition.conflictKeys, 128);
  if (
    !dependencies ||
    !allowedPaths ||
    !conflictKeys ||
    allowedPaths.length === 0
  )
    return null;
  return Object.freeze({
    id: definition.id,
    objectiveId: definition.objectiveId,
    dependencies,
    allowedPaths,
    conflictKeys,
  });
}

function hasCycle(definitions: readonly ProjectTaskDefinition[]) {
  const dependencies = new Map(
    definitions.map((definition) => [definition.id, definition.dependencies]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dependency of dependencies.get(id) ?? []) {
      if (visit(dependency)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return definitions.some((definition) => visit(definition.id));
}

function projectState(
  state: Omit<ProjectRuntimeState, "contract">,
): ProjectRuntimeState {
  return Object.freeze({
    contract: PROJECT_RUNTIME_STATE_CONTRACT,
    ...state,
    tasks: Object.freeze([...state.tasks]),
  });
}

export function createProjectRuntimeState(
  input: Readonly<{
    projectId: string;
    milestoneId: string;
    repositoryRevision: string;
    maximumConcurrency: number;
    tasks: readonly ProjectTaskDefinition[];
    ownerGeneration?: string;
  }>,
): StateResult {
  if (
    !validIdentity(input.projectId) ||
    !validIdentity(input.milestoneId) ||
    !validRevision(input.repositoryRevision) ||
    !Number.isSafeInteger(input.maximumConcurrency) ||
    input.maximumConcurrency < 1 ||
    input.maximumConcurrency > PROJECT_RUNTIME_MAXIMUM_CONCURRENCY ||
    input.tasks.length === 0 ||
    input.tasks.length > 1024
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_input_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  const definitions = input.tasks.map(snapshotDefinition);
  if (definitions.some((definition) => !definition)) {
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_task_definition_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  const completeDefinitions = definitions as readonly ProjectTaskDefinition[];
  const ids = new Set(completeDefinitions.map((definition) => definition.id));
  if (
    ids.size !== completeDefinitions.length ||
    completeDefinitions.some(
      (definition) =>
        definition.dependencies.includes(definition.id) ||
        definition.dependencies.some((dependency) => !ids.has(dependency)),
    ) ||
    hasCycle(completeDefinitions)
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_task_graph_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = completeDefinitions.map((definition) =>
    Object.freeze({
      definition,
      state:
        definition.dependencies.length === 0
          ? ("ready" as const)
          : ("waiting_dependency" as const),
      attemptId: null,
      operationId: null,
      cleanupConfirmed: false,
      recoveryId: null,
      supersededBy: null,
    }),
  );
  const state = projectState({
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    repositoryRevision: input.repositoryRevision,
    generation: 1,
    ownerGeneration:
      input.ownerGeneration && validIdentity(input.ownerGeneration)
        ? input.ownerGeneration
        : randomUUID(),
    maximumConcurrency: input.maximumConcurrency,
    tasks,
  });
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_state_created",
    state,
    taskIds: Object.freeze(tasks.map((task) => task.definition.id)),
  });
}

function activeForCapacity(task: ProjectTaskRecord) {
  return (
    task.state === "starting" ||
    task.state === "running" ||
    task.state === "cleanup_pending" ||
    (task.state === "recovery_required" && !task.cleanupConfirmed)
  );
}

function reservesConflict(task: ProjectTaskRecord) {
  return (
    activeForCapacity(task) ||
    (task.state === "recovery_required" && task.recoveryId !== null)
  );
}

function normalizedConflictPaths(task: ProjectTaskRecord) {
  return task.definition.allowedPaths.map((value) =>
    value.replace(/\/+$/u, "").toUpperCase(),
  );
}

function conflicts(left: ProjectTaskRecord, right: ProjectTaskRecord) {
  const leftKeys = new Set(
    left.definition.conflictKeys.map((value) => value.toUpperCase()),
  );
  if (
    right.definition.conflictKeys.some((value) =>
      leftKeys.has(value.toUpperCase()),
    )
  )
    return true;
  return normalizedConflictPaths(left).some((leftPath) =>
    normalizedConflictPaths(right).some(
      (rightPath) =>
        leftPath === rightPath ||
        leftPath.startsWith(`${rightPath}/`) ||
        rightPath.startsWith(`${leftPath}/`),
    ),
  );
}

export function selectSchedulableProjectTasks(
  state: ProjectRuntimeState,
): readonly string[] {
  const available = Math.max(
    0,
    state.maximumConcurrency - state.tasks.filter(activeForCapacity).length,
  );
  if (available === 0) return Object.freeze([]);
  const selected: ProjectTaskRecord[] = [];
  const reserved = state.tasks.filter(reservesConflict);
  for (const task of state.tasks) {
    if (selected.length >= available) break;
    if (task.state !== "ready") continue;
    if (
      reserved.some((active) => conflicts(task, active)) ||
      selected.some((candidate) => conflicts(task, candidate))
    )
      continue;
    selected.push(task);
  }
  return Object.freeze(selected.map((task) => task.definition.id));
}

function replaceTask(
  state: ProjectRuntimeState,
  taskId: string,
  update: (task: ProjectTaskRecord) => ProjectTaskRecord,
) {
  return state.tasks.map((task) =>
    task.definition.id === taskId ? update(task) : task,
  );
}

export function reserveProjectTaskStart(
  state: ProjectRuntimeState,
  expectedGeneration: number,
  taskId: string,
  attemptId: string,
): StateResult {
  if (
    state.generation !== expectedGeneration ||
    !validIdentity(taskId) ||
    !validIdentity(attemptId)
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_generation_or_identity_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  if (!selectSchedulableProjectTasks(state).includes(taskId)) {
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_task_not_schedulable",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = replaceTask(state, taskId, (task) =>
    Object.freeze({ ...task, state: "starting" as const, attemptId }),
  );
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_task_start_reserved",
    state: projectState({ ...state, generation: state.generation + 1, tasks }),
    taskIds: Object.freeze([taskId]),
  });
}

export function observeProjectTaskStarted(
  state: ProjectRuntimeState,
  expectedGeneration: number,
  taskId: string,
  attemptId: string,
  operationId: string,
): StateResult {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "starting" ||
    task.attemptId !== attemptId ||
    !validIdentity(operationId)
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_task_start_observation_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = replaceTask(state, taskId, (current) =>
    Object.freeze({ ...current, state: "running" as const, operationId }),
  );
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_task_started",
    state: projectState({ ...state, generation: state.generation + 1, tasks }),
    taskIds: Object.freeze([taskId]),
  });
}

export function settleProjectTask(
  state: ProjectRuntimeState,
  expectedGeneration: number,
  input: Readonly<{
    taskId: string;
    attemptId: string;
    operationId: string;
    outcome: "completed" | "failed" | "cancelled" | "recovery_required";
    cleanupConfirmed: boolean;
    recoveryId: string | null;
  }>,
): StateResult {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === input.taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "running" ||
    task.attemptId !== input.attemptId ||
    task.operationId !== input.operationId ||
    (input.outcome === "completed" && !input.cleanupConfirmed) ||
    (input.outcome === "cancelled" && !input.cleanupConfirmed) ||
    (input.outcome === "recovery_required" &&
      !validRecoveryIdentity(input.recoveryId)) ||
    (input.outcome !== "recovery_required" && input.recoveryId !== null)
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_task_settlement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const nextState: ProjectTaskState =
    input.outcome === "failed" && !input.cleanupConfirmed
      ? "cleanup_pending"
      : input.outcome;
  let tasks = replaceTask(state, input.taskId, (current) =>
    Object.freeze({
      ...current,
      state: nextState,
      cleanupConfirmed: input.cleanupConfirmed,
      recoveryId: input.recoveryId,
    }),
  );
  const completed = new Set(
    tasks
      .filter((candidate) => candidate.state === "completed")
      .map((candidate) => candidate.definition.id),
  );
  tasks = tasks.map((candidate) =>
    candidate.state === "waiting_dependency" &&
    candidate.definition.dependencies.every((dependency) =>
      completed.has(dependency),
    )
      ? Object.freeze({ ...candidate, state: "ready" as const })
      : candidate,
  );
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_task_settled",
    state: projectState({ ...state, generation: state.generation + 1, tasks }),
    taskIds: Object.freeze([input.taskId]),
  });
}

export function describeProjectRuntimeStateContract() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_STATE_CONTRACT,
    maximumConcurrency: PROJECT_RUNTIME_MAXIMUM_CONCURRENCY,
    capacityStates: Object.freeze([
      "starting",
      "running",
      "cleanup_pending",
      "recovery_required_without_cleanup",
    ]),
    lockContract:
      "project_operation_then_short_project_state_transaction_never_held_across_single_task_runtime",
    staleResult:
      "generation_attempt_and_operation_identity_mismatch_blocks_without_projection",
  });
}
