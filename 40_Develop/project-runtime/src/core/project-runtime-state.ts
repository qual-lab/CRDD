export const PROJECT_RUNTIME_STATE_CONTRACT =
  "crdd-coordinator/project-runtime-state/v1" as const;
export const PROJECT_RUNTIME_MAXIMUM_CONCURRENCY = 5;
export const PROJECT_RUNTIME_MAXIMUM_OBJECTIVES = 128;
export const PROJECT_RUNTIME_MAXIMUM_TASKS = 1024;

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

export type ProjectObjectiveState =
  | "planned"
  | "executing"
  | "integration_pending"
  | "accepted"
  | "blocked"
  | "cancelled";

export type ProjectMilestoneState =
  | "planned"
  | "executing"
  | "integrating"
  | "human_decision_required"
  | "recovery_required"
  | "accepted"
  | "cancelled";

const PROJECT_OBJECTIVE_STATES = Object.freeze([
  "planned",
  "executing",
  "integration_pending",
  "accepted",
  "blocked",
  "cancelled",
] as const);
const PROJECT_TASK_STATES = Object.freeze([
  "planned",
  "waiting_dependency",
  "ready",
  "starting",
  "running",
  "cleanup_pending",
  "completed",
  "failed",
  "cancelled",
  "recovery_required",
  "superseded",
] as const);

export type ProjectObjectiveDefinition = Readonly<{
  id: string;
  acceptanceCriteria: readonly string[];
}>;

export type ProjectObjectiveRecord = Readonly<{
  definition: ProjectObjectiveDefinition;
  state: ProjectObjectiveState;
  criterionEvidenceIds: readonly string[];
}>;

export type ProjectMilestoneRecord = Readonly<{
  id: string;
  acceptanceCriteria: readonly string[];
  state: ProjectMilestoneState;
  criterionEvidenceIds: readonly string[];
}>;

export type ProjectTaskDefinition = Readonly<{
  id: string;
  objectiveId: string;
  dependencies: readonly string[];
  allowedPaths: readonly string[];
  conflictKeys: readonly string[];
}>;

export type ProjectTaskRecoveryKind =
  | "host"
  | "docker"
  | "candidate"
  | "candidate_store"
  | "runtime_process";

export type ProjectTaskRecoveryObligation = Readonly<{
  kind: ProjectTaskRecoveryKind;
  recoveryId: string;
  phase: "required" | "recovering" | "settled" | "acknowledged";
  acknowledgement?: ProjectDockerRecoveryAcknowledgement;
}>;

export type ProjectDockerRecoveryAcknowledgement = Readonly<{
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string;
  taskId: string;
  attemptId: string;
  operationId: string;
  recoveryId: string;
  settlementGeneration: number;
  runtimeStateBinding: Readonly<{
    runtimeStateIdentityHash: string;
    runtimeStateProtectionHash: string;
    localUserBindingHash: string;
    runtimeStateBindingHash: string;
  }>;
  receiptContentHash: string;
  receiptContentIdentity: string;
}>;

export type ProjectTaskStartPhase =
  | "none"
  | "reserved"
  | "handoff_prepared"
  | "running"
  | "settled";

export type ProjectTaskRecord = Readonly<{
  definition: ProjectTaskDefinition;
  state: ProjectTaskState;
  attemptId: string | null;
  operationId: string | null;
  authorityBindingId: string | null;
  startPhase: ProjectTaskStartPhase;
  cleanupConfirmed: boolean;
  recoveryObligations: readonly ProjectTaskRecoveryObligation[];
  recoveryUnresolved: boolean;
  candidateId: string | null;
  retryCount: number;
  supersededBy: string | null;
}>;

export type ProjectRuntimeState = Readonly<{
  contract: typeof PROJECT_RUNTIME_STATE_CONTRACT;
  projectId: string;
  milestoneId: string;
  repositoryRevision: string;
  generation: number;
  ownerGeneration: string;
  decisionApplicationId: string | null;
  maximumConcurrency: number;
  milestone: ProjectMilestoneRecord;
  objectives: readonly ProjectObjectiveRecord[];
  tasks: readonly ProjectTaskRecord[];
}>;

export type ProjectRuntimeProjection = Readonly<{
  projectId: string;
  milestoneId: string;
  generation: number;
  milestoneState: ProjectMilestoneState;
  objectiveCounts: Readonly<Record<ProjectObjectiveState, number>>;
  taskCounts: Readonly<Record<ProjectTaskState, number>>;
  objectiveTaskSummaries: readonly Readonly<{
    objectiveId: string;
    objectiveState: ProjectObjectiveState;
    taskCounts: Readonly<Record<ProjectTaskState, number>>;
  }>[];
  workProgress: "not_started" | "in_progress" | "tasks_complete";
  qualityState:
    | "not_evaluated"
    | "integration_pending"
    | "accepted"
    | "blocked";
  humanDecisionRequired: boolean;
  recoveryRequired: boolean;
  nextAction:
    | "schedule_task"
    | "wait_for_task"
    | "verify_objective_integration"
    | "verify_milestone_integration"
    | "human_decision"
    | "recover"
    | "complete";
}>;

/**
 * Validate only semantic relations carried by the public projection itself.
 * Scheduling versus waiting still depends on the Task graph and therefore is
 * intentionally left as the one permitted pair when no stronger action wins.
 */
export function isProjectRuntimeProjectionSemanticallyValid(
  projection: ProjectRuntimeProjection,
) {
  const boundedTotal = <T extends string>(
    counts: Readonly<Record<T, number>>,
    states: readonly T[],
    maximum: number,
  ) => {
    let total = 0;
    for (const state of states) {
      const value = counts[state];
      if (!Number.isSafeInteger(value) || value < 0 || value > maximum)
        return null;
      total += value;
      if (!Number.isSafeInteger(total) || total > maximum) return null;
    }
    return total;
  };
  const objectiveTotal = boundedTotal(
    projection.objectiveCounts,
    PROJECT_OBJECTIVE_STATES,
    PROJECT_RUNTIME_MAXIMUM_OBJECTIVES,
  );
  const taskTotal = boundedTotal(
    projection.taskCounts,
    PROJECT_TASK_STATES,
    PROJECT_RUNTIME_MAXIMUM_TASKS,
  );
  if (objectiveTotal === null || taskTotal === null) return false;
  if (objectiveTotal < 1 || taskTotal < 1) return false;
  if (
    projection.objectiveTaskSummaries.length !== objectiveTotal ||
    new Set(projection.objectiveTaskSummaries.map((entry) => entry.objectiveId))
      .size !== objectiveTotal
  )
    return false;
  const summarizedObjectiveCounts = countStates(
    projection.objectiveTaskSummaries.map((entry) => entry.objectiveState),
    PROJECT_OBJECTIVE_STATES,
  );
  const mutableSummarizedTaskCounts = Object.fromEntries(
    PROJECT_TASK_STATES.map((state) => [state, 0]),
  ) as Record<ProjectTaskState, number>;
  for (const summary of projection.objectiveTaskSummaries) {
    const summaryTotal = boundedTotal(
      summary.taskCounts,
      PROJECT_TASK_STATES,
      PROJECT_RUNTIME_MAXIMUM_TASKS,
    );
    if (summaryTotal === null || summaryTotal < 1) return false;
    for (const state of PROJECT_TASK_STATES) {
      const next =
        mutableSummarizedTaskCounts[state] + summary.taskCounts[state];
      if (!Number.isSafeInteger(next) || next > PROJECT_RUNTIME_MAXIMUM_TASKS)
        return false;
      mutableSummarizedTaskCounts[state] = next;
    }
  }
  const summarizedTaskCounts = Object.freeze(mutableSummarizedTaskCounts);
  if (
    JSON.stringify(summarizedObjectiveCounts) !==
      JSON.stringify(projection.objectiveCounts) ||
    JSON.stringify(summarizedTaskCounts) !==
      JSON.stringify(projection.taskCounts)
  )
    return false;
  for (const summary of projection.objectiveTaskSummaries) {
    const count = (states: readonly ProjectTaskState[]) =>
      states.reduce((sum, state) => sum + summary.taskCounts[state], 0);
    const summaryTotal = count(PROJECT_TASK_STATES);
    if (summaryTotal < 1) return false;
    const notStarted = count(["planned", "waiting_dependency", "ready"]);
    const blocked = count(["failed", "cancelled", "recovery_required"]);
    if (summary.objectiveState === "planned" && notStarted !== summaryTotal)
      return false;
    if (
      summary.objectiveState === "executing" &&
      (notStarted === summaryTotal ||
        summary.taskCounts.completed + summary.taskCounts.superseded ===
          summaryTotal ||
        blocked > 0)
    )
      return false;
    if (
      ["integration_pending", "accepted"].includes(summary.objectiveState) &&
      summary.taskCounts.completed + summary.taskCounts.superseded !==
        summaryTotal
    )
      return false;
    if (summary.objectiveState === "blocked" && blocked === 0) return false;
    if (
      summary.objectiveState === "cancelled" &&
      summary.taskCounts.cancelled === 0
    )
      return false;
  }
  const recoveryRequired = projection.milestoneState === "recovery_required";
  const humanDecisionRequired =
    projection.milestoneState === "human_decision_required" ||
    projection.objectiveCounts.blocked > 0;
  const allTasksComplete =
    projection.taskCounts.completed + projection.taskCounts.superseded ===
    taskTotal;
  const anyTaskStarted =
    projection.taskCounts.ready + projection.taskCounts.waiting_dependency <
    taskTotal;
  const workProgress = allTasksComplete
    ? "tasks_complete"
    : anyTaskStarted
      ? "in_progress"
      : "not_started";
  const qualityState =
    projection.milestoneState === "accepted"
      ? "accepted"
      : humanDecisionRequired || recoveryRequired
        ? "blocked"
        : projection.objectiveCounts.integration_pending > 0 ||
            projection.milestoneState === "integrating"
          ? "integration_pending"
          : "not_evaluated";
  const expectedAction = recoveryRequired
    ? "recover"
    : humanDecisionRequired
      ? "human_decision"
      : projection.milestoneState === "accepted"
        ? "complete"
        : projection.milestoneState === "integrating"
          ? "verify_milestone_integration"
          : projection.objectiveCounts.integration_pending > 0
            ? "verify_objective_integration"
            : null;
  const isAllObjectivesPlanned =
    projection.objectiveCounts.planned === objectiveTotal;
  const isAllObjectivesAccepted =
    projection.objectiveCounts.accepted === objectiveTotal;
  const isAllTasksWaitingToStart =
    projection.taskCounts.ready + projection.taskCounts.waiting_dependency ===
    taskTotal;
  const isAllTasksTerminalForIntegration =
    projection.taskCounts.completed + projection.taskCounts.superseded ===
    taskTotal;
  const isAggregateReachable =
    (!isAllObjectivesPlanned || projection.taskCounts.completed === 0) &&
    (!allTasksComplete ||
      (projection.objectiveCounts.planned === 0 &&
        projection.objectiveCounts.executing === 0)) &&
    (projection.objectiveCounts.integration_pending === 0 ||
      projection.taskCounts.completed > 0);
  const isMilestoneReachable =
    isAggregateReachable &&
    (projection.milestoneState !== "planned" ||
      (isAllObjectivesPlanned && isAllTasksWaitingToStart)) &&
    (projection.milestoneState !== "executing" ||
      (!isAllObjectivesPlanned && !isAllObjectivesAccepted)) &&
    (projection.milestoneState !== "integrating" ||
      (isAllObjectivesAccepted && isAllTasksTerminalForIntegration)) &&
    (projection.milestoneState !== "accepted" ||
      (isAllObjectivesAccepted &&
        projection.objectiveCounts.blocked === 0 &&
        projection.objectiveCounts.cancelled === 0 &&
        isAllTasksTerminalForIntegration &&
        projection.taskCounts.recovery_required === 0)) &&
    (projection.milestoneState !== "recovery_required" ||
      projection.taskCounts.recovery_required > 0) &&
    (projection.milestoneState !== "human_decision_required" ||
      projection.objectiveCounts.blocked > 0) &&
    (projection.milestoneState !== "cancelled" ||
      (projection.taskCounts.starting === 0 &&
        projection.taskCounts.running === 0 &&
        projection.taskCounts.cleanup_pending === 0 &&
        projection.taskCounts.recovery_required === 0));
  return (
    isMilestoneReachable &&
    projection.recoveryRequired === recoveryRequired &&
    projection.humanDecisionRequired === humanDecisionRequired &&
    projection.workProgress === workProgress &&
    projection.qualityState === qualityState &&
    (expectedAction === null
      ? projection.nextAction === "schedule_task" ||
        projection.nextAction === "wait_for_task"
      : projection.nextAction === expectedAction)
  );
}

/**
 * Validate the relation between the public Objective result and its already
 * descriptor-safe Project projection.  Resolved decision/recovery history is
 * not part of this projection, so only active actions are rejected here.
 */
export function isProjectRuntimeObjectiveProjectionCorrelationValid(
  outer: Readonly<{
    status: "completed" | "blocked" | "cancelled";
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
    effectState: "no_effect" | "settled" | "unknown";
    recoveryCount: number;
  }>,
  projection: ProjectRuntimeProjection | null,
) {
  if (!projection) return true;
  if (outer.status === "completed" && projection.milestoneState !== "accepted")
    return false;
  if (outer.status === "cancelled" && projection.milestoneState !== "cancelled")
    return false;
  if (
    projection.nextAction === "recover" &&
    (outer.status !== "blocked" ||
      outer.cleanupConfirmed ||
      !outer.manualRecoveryRequired ||
      outer.effectState !== "unknown" ||
      outer.recoveryCount < 1)
  )
    return false;
  if (
    projection.milestoneState === "accepted" &&
    (outer.status !== "completed" ||
      outer.cleanupConfirmed !== true ||
      outer.manualRecoveryRequired ||
      outer.processRestartRequired ||
      outer.recoveryCount !== 0 ||
      outer.effectState === "unknown")
  )
    return false;
  return true;
}

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

function validCandidateIdentity(value: unknown) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

export function isProjectRuntimeRecoveryIdentity(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

function uniqueStrings(
  values: readonly string[],
  maximum: number,
  kind: "identity_or_path" | "human_text",
): readonly string[] | null {
  if (values.length > maximum) return null;
  const resultItems: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0 || value.length > 512)
      return null;
    const normalized =
      kind === "identity_or_path" ? value.replaceAll("\\", "/") : value;
    const key =
      kind === "identity_or_path" ? normalized.toUpperCase() : normalized;
    if (seen.has(key)) return null;
    seen.add(key);
    resultItems.push(normalized);
  }
  return Object.freeze(resultItems);
}

function snapshotDefinition(
  definition: ProjectTaskDefinition,
): ProjectTaskDefinition | null {
  if (!validIdentity(definition.id) || !validIdentity(definition.objectiveId))
    return null;
  const dependencies = uniqueStrings(
    definition.dependencies,
    128,
    "identity_or_path",
  );
  const allowedPaths = uniqueStrings(
    definition.allowedPaths,
    128,
    "identity_or_path",
  );
  const conflictKeys = uniqueStrings(
    definition.conflictKeys,
    128,
    "identity_or_path",
  );
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

function snapshotObjectiveDefinition(
  definition: ProjectObjectiveDefinition,
): ProjectObjectiveDefinition | null {
  if (!validIdentity(definition.id)) return null;
  const acceptanceCriteria = uniqueStrings(
    definition.acceptanceCriteria,
    128,
    "human_text",
  );
  if (!acceptanceCriteria || acceptanceCriteria.length === 0) return null;
  return Object.freeze({ id: definition.id, acceptanceCriteria });
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
    milestone: Object.freeze({ ...state.milestone }),
    objectives: Object.freeze([...state.objectives]),
    tasks: Object.freeze([...state.tasks]),
  });
}

export function createProjectRuntimeState(
  input: Readonly<{
    projectId: string;
    milestoneId: string;
    repositoryRevision: string;
    maximumConcurrency: number;
    milestoneAcceptanceCriteria: readonly string[];
    objectives: readonly ProjectObjectiveDefinition[];
    tasks: readonly ProjectTaskDefinition[];
    ownerGeneration: string;
  }>,
): StateResult {
  if (
    !validIdentity(input.projectId) ||
    !validIdentity(input.milestoneId) ||
    !validIdentity(input.ownerGeneration) ||
    !validRevision(input.repositoryRevision) ||
    !Number.isSafeInteger(input.maximumConcurrency) ||
    input.maximumConcurrency < 1 ||
    input.maximumConcurrency > PROJECT_RUNTIME_MAXIMUM_CONCURRENCY ||
    input.tasks.length === 0 ||
    input.tasks.length > PROJECT_RUNTIME_MAXIMUM_TASKS ||
    input.objectives.length === 0 ||
    input.objectives.length > PROJECT_RUNTIME_MAXIMUM_OBJECTIVES
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_input_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  const definitions = input.tasks.map(snapshotDefinition);
  const objectiveDefinitions = input.objectives.map(
    snapshotObjectiveDefinition,
  );
  const milestoneAcceptanceCriteria = uniqueStrings(
    input.milestoneAcceptanceCriteria,
    128,
    "human_text",
  );
  if (definitions.some((definition) => !definition)) {
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_task_definition_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  if (
    objectiveDefinitions.some((definition) => !definition) ||
    !milestoneAcceptanceCriteria ||
    milestoneAcceptanceCriteria.length === 0
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_acceptance_definition_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  const completeDefinitions = definitions as readonly ProjectTaskDefinition[];
  const completeObjectiveDefinitions =
    objectiveDefinitions as readonly ProjectObjectiveDefinition[];
  const ids = new Set(completeDefinitions.map((definition) => definition.id));
  const objectiveIds = new Set(
    completeObjectiveDefinitions.map((definition) => definition.id),
  );
  if (
    ids.size !== completeDefinitions.length ||
    objectiveIds.size !== completeObjectiveDefinitions.length ||
    completeDefinitions.some(
      (definition) => !objectiveIds.has(definition.objectiveId),
    ) ||
    completeObjectiveDefinitions.some(
      (objective) =>
        !completeDefinitions.some(
          (definition) => definition.objectiveId === objective.id,
        ),
    ) ||
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
      authorityBindingId: null,
      startPhase: "none" as const,
      cleanupConfirmed: false,
      recoveryObligations: Object.freeze([]),
      recoveryUnresolved: false,
      candidateId: null,
      retryCount: 0,
      supersededBy: null,
    }),
  );
  const state = projectState({
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    repositoryRevision: input.repositoryRevision,
    generation: 1,
    ownerGeneration: input.ownerGeneration,
    decisionApplicationId: null,
    maximumConcurrency: input.maximumConcurrency,
    milestone: Object.freeze({
      id: input.milestoneId,
      acceptanceCriteria: milestoneAcceptanceCriteria,
      state: "planned" as const,
      criterionEvidenceIds: Object.freeze([]),
    }),
    objectives: completeObjectiveDefinitions.map((definition) =>
      Object.freeze({
        definition,
        state: "planned" as const,
        criterionEvidenceIds: Object.freeze([]),
      }),
    ),
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
    (task.state === "recovery_required" &&
      (task.recoveryUnresolved || task.recoveryObligations.length > 0))
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
  const selectedItems: ProjectTaskRecord[] = [];
  const reservedItems = state.tasks.filter(reservesConflict);
  for (const task of state.tasks) {
    if (selectedItems.length >= available) break;
    if (task.state !== "ready") continue;
    if (
      reservedItems.some((active) => conflicts(task, active)) ||
      selectedItems.some((candidate) => conflicts(task, candidate))
    )
      continue;
    selectedItems.push(task);
  }
  return Object.freeze(selectedItems.map((task) => task.definition.id));
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
  authorityBindingId: string,
): StateResult {
  if (
    state.generation !== expectedGeneration ||
    !validIdentity(taskId) ||
    !validIdentity(attemptId) ||
    !validIdentity(authorityBindingId)
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
    Object.freeze({
      ...task,
      state: "starting" as const,
      attemptId,
      authorityBindingId,
      operationId: null,
      startPhase: "reserved" as const,
      recoveryObligations: Object.freeze([]),
      recoveryUnresolved: false,
    }),
  );
  const objectiveId = tasks.find((task) => task.definition.id === taskId)
    ?.definition.objectiveId;
  const objectives = state.objectives.map((objective) =>
    objective.definition.id === objectiveId && objective.state === "planned"
      ? Object.freeze({ ...objective, state: "executing" as const })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_task_start_reserved",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state:
          state.milestone.state === "planned"
            ? ("executing" as const)
            : state.milestone.state,
      }),
      objectives,
      tasks,
    }),
    taskIds: Object.freeze([taskId]),
  });
}

export function prepareProjectTaskHandoff(
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
    task.startPhase !== "reserved" ||
    task.attemptId !== attemptId ||
    !validIdentity(operationId)
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_task_handoff_preparation_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = replaceTask(state, taskId, (current) =>
    Object.freeze({
      ...current,
      operationId,
      startPhase: "handoff_prepared" as const,
    }),
  );
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_task_handoff_prepared",
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
    task.startPhase !== "handoff_prepared" ||
    task.attemptId !== attemptId ||
    task.operationId !== operationId
  )
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_task_start_observation_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = replaceTask(state, taskId, (current) =>
    Object.freeze({
      ...current,
      state: "running" as const,
      startPhase: "running" as const,
    }),
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
    authorityBindingId: string;
    outcome: "completed" | "failed" | "cancelled" | "recovery_required";
    cleanupConfirmed: boolean;
    recoveryObligations: readonly ProjectTaskRecoveryObligation[];
    recoveryUnresolved: boolean;
    candidateId?: string | null;
  }>,
): StateResult {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === input.taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "running" ||
    task.startPhase !== "running" ||
    task.attemptId !== input.attemptId ||
    task.operationId !== input.operationId ||
    task.authorityBindingId !== input.authorityBindingId ||
    (input.outcome === "completed" && !input.cleanupConfirmed) ||
    (input.outcome === "cancelled" && !input.cleanupConfirmed) ||
    !Array.isArray(input.recoveryObligations) ||
    input.recoveryObligations.length > 128 ||
    new Set(
      input.recoveryObligations.map(
        (entry) => `${entry.kind}\0${entry.recoveryId}`,
      ),
    ).size !== input.recoveryObligations.length ||
    input.recoveryObligations.some(
      (entry) =>
        ![
          "host",
          "docker",
          "candidate",
          "candidate_store",
          "runtime_process",
        ].includes(entry.kind) ||
        !isProjectRuntimeRecoveryIdentity(entry.recoveryId) ||
        entry.phase !== "required",
    ) ||
    typeof input.recoveryUnresolved !== "boolean" ||
    (input.outcome === "recovery_required" &&
      input.recoveryObligations.length === 0 &&
      !input.recoveryUnresolved) ||
    (input.outcome !== "recovery_required" &&
      (input.recoveryObligations.length !== 0 || input.recoveryUnresolved)) ||
    (input.candidateId !== undefined &&
      input.candidateId !== null &&
      !validCandidateIdentity(input.candidateId)) ||
    (input.outcome !== "completed" &&
      input.candidateId !== undefined &&
      input.candidateId !== null)
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
      startPhase: "settled" as const,
      cleanupConfirmed: input.cleanupConfirmed,
      recoveryObligations: Object.freeze(
        input.recoveryObligations.map((entry) => Object.freeze({ ...entry })),
      ),
      recoveryUnresolved: input.recoveryUnresolved,
      candidateId:
        input.outcome === "completed" ? (input.candidateId ?? null) : null,
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
  const objectives = state.objectives.map((objective) => {
    if (objective.state === "accepted" || objective.state === "cancelled")
      return objective;
    const objectiveTasks = tasks.filter(
      (task) =>
        task.definition.objectiveId === objective.definition.id &&
        task.state !== "superseded",
    );
    if (objectiveTasks.every((task) => task.state === "completed")) {
      return Object.freeze({
        ...objective,
        state: "integration_pending" as const,
      });
    }
    if (objectiveTasks.some((task) => task.state === "cancelled")) {
      return Object.freeze({ ...objective, state: "cancelled" as const });
    }
    if (
      objectiveTasks.some((task) =>
        ["failed", "recovery_required"].includes(task.state),
      )
    ) {
      return Object.freeze({ ...objective, state: "blocked" as const });
    }
    return objective;
  });
  const milestoneState: ProjectMilestoneState = tasks.some(
    (task) => task.state === "recovery_required",
  )
    ? "recovery_required"
    : tasks.some((task) => task.state === "cancelled")
      ? "cancelled"
      : state.milestone.state;
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_task_settled",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({ ...state.milestone, state: milestoneState }),
      objectives,
      tasks,
    }),
    taskIds: Object.freeze([input.taskId]),
  });
}

/** Settle a durably prepared attempt that the Single Task Runtime did not
 * accept. This path must never invent a running/provider-effect state. */
export function settleProjectTaskBeforeEffect(
  state: ProjectRuntimeState,
  expectedGeneration: number,
  input: Readonly<{
    taskId: string;
    attemptId: string;
    operationId: string;
    authorityBindingId: string;
    outcome: "failed" | "cancelled" | "recovery_required";
    cleanupConfirmed: boolean;
    recoveryObligations: readonly ProjectTaskRecoveryObligation[];
    recoveryUnresolved: boolean;
  }>,
): StateResult {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === input.taskId,
  );
  const obligationKinds = new Set<ProjectTaskRecoveryKind>([
    "host",
    "docker",
    "candidate",
    "candidate_store",
    "runtime_process",
  ]);
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "starting" ||
    task.startPhase !== "handoff_prepared" ||
    task.attemptId !== input.attemptId ||
    task.operationId !== input.operationId ||
    task.authorityBindingId !== input.authorityBindingId ||
    (!input.cleanupConfirmed && input.outcome !== "recovery_required") ||
    input.recoveryObligations.some(
      (entry) =>
        !obligationKinds.has(entry.kind) ||
        !isProjectRuntimeRecoveryIdentity(entry.recoveryId) ||
        entry.phase !== "required",
    ) ||
    (input.outcome === "recovery_required" &&
      input.recoveryObligations.length === 0 &&
      !input.recoveryUnresolved) ||
    (input.outcome !== "recovery_required" &&
      (input.recoveryObligations.length > 0 || input.recoveryUnresolved))
  )
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_pre_effect_settlement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = replaceTask(state, input.taskId, (current) =>
    Object.freeze({
      ...current,
      state: input.outcome,
      startPhase: "settled" as const,
      cleanupConfirmed: input.cleanupConfirmed,
      recoveryObligations: Object.freeze(
        input.recoveryObligations.map((entry) => Object.freeze({ ...entry })),
      ),
      recoveryUnresolved: input.recoveryUnresolved,
      candidateId: null,
    }),
  );
  const objectives = state.objectives.map((objective) =>
    objective.definition.id === task.definition.objectiveId
      ? Object.freeze({
          ...objective,
          state:
            input.outcome === "cancelled"
              ? ("cancelled" as const)
              : ("blocked" as const),
        })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_pre_effect_task_settled",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state:
          input.outcome === "recovery_required"
            ? ("recovery_required" as const)
            : input.outcome === "cancelled"
              ? ("cancelled" as const)
              : state.milestone.state,
      }),
      objectives,
      tasks,
    }),
    taskIds: Object.freeze([input.taskId]),
  });
}

export function markProjectTaskRecoveryObligationRecovering(
  state: ProjectRuntimeState,
  expectedGeneration: number,
  taskId: string,
  kind: ProjectTaskRecoveryKind,
  recoveryId: string,
): StateResult {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "recovery_required" ||
    task.recoveryUnresolved ||
    !task.recoveryObligations.some(
      (entry) =>
        entry.kind === kind &&
        entry.recoveryId === recoveryId &&
        entry.phase === "required",
    ) ||
    !isProjectRuntimeRecoveryIdentity(recoveryId)
  )
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_task_recovery_start_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = replaceTask(state, taskId, (current) =>
    Object.freeze({
      ...current,
      recoveryObligations: Object.freeze(
        current.recoveryObligations.map((entry) =>
          entry.kind === kind && entry.recoveryId === recoveryId
            ? Object.freeze({ ...entry, phase: "recovering" as const })
            : entry,
        ),
      ),
    }),
  );
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_task_recovery_started",
    state: projectState({ ...state, generation: state.generation + 1, tasks }),
    taskIds: Object.freeze([taskId]),
  });
}

export function settleProjectTaskRecoveryObligation(
  state: ProjectRuntimeState,
  expectedGeneration: number,
  taskId: string,
  kind: ProjectTaskRecoveryKind,
  recoveryId: string,
): StateResult {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "recovery_required" ||
    task.recoveryUnresolved ||
    !task.recoveryObligations.some(
      (entry) =>
        entry.kind === kind &&
        entry.recoveryId === recoveryId &&
        entry.phase === "recovering",
    ) ||
    !isProjectRuntimeRecoveryIdentity(recoveryId)
  )
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_task_recovery_settlement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = replaceTask(state, taskId, (current) =>
    Object.freeze({
      ...current,
      recoveryObligations: Object.freeze(
        current.recoveryObligations.map((entry) =>
          entry.kind === kind && entry.recoveryId === recoveryId
            ? Object.freeze({ ...entry, phase: "settled" as const })
            : entry,
        ),
      ),
    }),
  );
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_task_recovery_item_settled",
    state: projectState({ ...state, generation: state.generation + 1, tasks }),
    taskIds: Object.freeze([taskId]),
  });
}

export function acknowledgeProjectDockerRecoveryObligation(
  state: ProjectRuntimeState,
  expectedGeneration: number,
  acknowledgement: ProjectDockerRecoveryAcknowledgement,
): StateResult {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === acknowledgement.taskId,
  );
  const binding = acknowledgement.runtimeStateBinding;
  const hex64 = (value: unknown) =>
    typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
  if (
    state.generation !== expectedGeneration ||
    acknowledgement.settlementGeneration !== expectedGeneration ||
    acknowledgement.projectId !== state.projectId ||
    acknowledgement.milestoneId !== state.milestoneId ||
    !validIdentity(acknowledgement.repositoryBindingId) ||
    !task ||
    task.state !== "recovery_required" ||
    task.attemptId !== acknowledgement.attemptId ||
    task.operationId !== acknowledgement.operationId ||
    !task.recoveryObligations.some(
      (entry) =>
        entry.kind === "docker" &&
        entry.recoveryId === acknowledgement.recoveryId &&
        entry.phase === "settled",
    ) ||
    !isProjectRuntimeRecoveryIdentity(acknowledgement.recoveryId) ||
    ![
      binding.runtimeStateIdentityHash,
      binding.runtimeStateProtectionHash,
      binding.localUserBindingHash,
      binding.runtimeStateBindingHash,
      acknowledgement.receiptContentHash,
    ].every(hex64) ||
    typeof acknowledgement.receiptContentIdentity !== "string" ||
    acknowledgement.receiptContentIdentity.length < 1 ||
    acknowledgement.receiptContentIdentity.length > 256
  )
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_docker_recovery_acknowledgement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const frozen = Object.freeze({
    ...acknowledgement,
    runtimeStateBinding: Object.freeze({ ...binding }),
  });
  const tasks = replaceTask(state, acknowledgement.taskId, (current) =>
    Object.freeze({
      ...current,
      recoveryObligations: Object.freeze(
        current.recoveryObligations.map((entry) =>
          entry.kind === "docker" &&
          entry.recoveryId === acknowledgement.recoveryId
            ? Object.freeze({
                ...entry,
                phase: "acknowledged" as const,
                acknowledgement: frozen,
              })
            : entry,
        ),
      ),
    }),
  );
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_docker_recovery_acknowledged",
    state: projectState({ ...state, generation: state.generation + 1, tasks }),
    taskIds: Object.freeze([acknowledgement.taskId]),
  });
}

export function retrySettledProjectTaskRecoveries(
  state: ProjectRuntimeState,
  expectedGeneration: number,
  taskIds: readonly string[],
): StateResult {
  if (
    state.generation !== expectedGeneration ||
    taskIds.length === 0 ||
    new Set(taskIds).size !== taskIds.length ||
    taskIds.some((taskId) => !validIdentity(taskId))
  )
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_task_recovery_batch_invalid",
      state,
      taskIds: Object.freeze([]),
    });
  if (
    taskIds.some((taskId) => {
      const task = state.tasks.find(
        (candidate) => candidate.definition.id === taskId,
      );
      return (
        !task ||
        task.recoveryUnresolved ||
        task.recoveryObligations.length === 0 ||
        task.recoveryObligations.some(
          (entry) =>
            entry.phase !==
            (entry.kind === "docker" ? "acknowledged" : "settled"),
        ) ||
        (task.state !== "recovery_required" && task.state !== "ready")
      );
    })
  )
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_task_recovery_batch_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = state.tasks.map((task) => {
    if (!taskIds.includes(task.definition.id) || task.state === "ready")
      return task;
    return Object.freeze({
      ...task,
      state: "ready" as const,
      attemptId: null,
      operationId: null,
      authorityBindingId: null,
      startPhase: "none" as const,
      cleanupConfirmed: true,
      candidateId: null,
      retryCount: task.retryCount + 1,
    });
  });
  const recoveredObjectiveIds = new Set(
    tasks
      .filter((task) => taskIds.includes(task.definition.id))
      .map((task) => task.definition.objectiveId),
  );
  const objectives = state.objectives.map((objective) =>
    recoveredObjectiveIds.has(objective.definition.id)
      ? Object.freeze({ ...objective, state: "executing" as const })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_task_recoveries_settled_for_retry",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: "executing" as const,
      }),
      objectives,
      tasks,
    }),
    taskIds: Object.freeze([...taskIds]),
  });
}

/** Bind owner-loss observations to the exact Runtime-owned Task recoveries. */
export function recordProjectTaskOwnerLossRecoveries(
  state: ProjectRuntimeState,
  expectedGeneration: number,
  bindings: readonly Readonly<{
    operationId: string;
    status: "matched" | "verified_absent";
    recoveryId: string | null;
  }>[],
): StateResult {
  const activeItems = state.tasks.filter((task) =>
    ["starting", "running"].includes(task.state),
  );
  const preparedItems = activeItems.filter((task) => task.operationId !== null);
  const reservedItems = activeItems.filter((task) => task.operationId === null);
  if (
    state.generation !== expectedGeneration ||
    activeItems.length === 0 ||
    preparedItems.length + reservedItems.length !== activeItems.length ||
    bindings.length !== preparedItems.length ||
    new Set(bindings.map((entry) => entry.operationId)).size !==
      bindings.length ||
    bindings.some(
      (entry) =>
        !validIdentity(entry.operationId) ||
        !["matched", "verified_absent"].includes(entry.status) ||
        (entry.status === "matched" &&
          !isProjectRuntimeRecoveryIdentity(entry.recoveryId)) ||
        (entry.status === "verified_absent" && entry.recoveryId !== null),
    )
  )
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_owner_loss_recovery_binding_invalid",
      state,
      taskIds: Object.freeze([]),
    });
  const byOperation = new Map(
    bindings.map((entry) => [entry.operationId, entry]),
  );
  if (
    preparedItems.some(
      (task) => task.operationId === null || !byOperation.has(task.operationId),
    ) ||
    preparedItems.some((task) => {
      const binding = task.operationId
        ? byOperation.get(task.operationId)
        : null;
      return task.state === "running" && binding?.status !== "matched";
    })
  )
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_owner_loss_recovery_binding_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = state.tasks.map((task) => {
    const binding =
      task.operationId === null ? undefined : byOperation.get(task.operationId);
    if (reservedItems.includes(task) || binding?.status === "verified_absent")
      return Object.freeze({
        ...task,
        state: "ready" as const,
        attemptId: null,
        operationId: null,
        authorityBindingId: null,
        startPhase: "none" as const,
        cleanupConfirmed: true,
        recoveryObligations: Object.freeze([]),
        recoveryUnresolved: false,
        candidateId: null,
      });
    return binding?.status === "matched" && binding.recoveryId
      ? Object.freeze({
          ...task,
          state: "recovery_required" as const,
          startPhase: "settled" as const,
          cleanupConfirmed: false,
          recoveryObligations: Object.freeze([
            Object.freeze({
              kind: "docker" as const,
              recoveryId: binding.recoveryId,
              phase: "required" as const,
            }),
          ]),
          recoveryUnresolved: false,
          candidateId: null,
        })
      : task;
  });
  const objectives = state.objectives.map((objective) =>
    tasks.some(
      (task) =>
        task.definition.objectiveId === objective.definition.id &&
        task.state === "recovery_required",
    )
      ? Object.freeze({ ...objective, state: "blocked" as const })
      : reservedItems.some(
            (task) => task.definition.objectiveId === objective.definition.id,
          )
        ? Object.freeze({ ...objective, state: "executing" as const })
        : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_owner_loss_recoveries_bound",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: bindings.some((entry) => entry.status === "matched")
          ? ("recovery_required" as const)
          : ("executing" as const),
      }),
      objectives,
      tasks,
    }),
    taskIds: Object.freeze(activeItems.map((task) => task.definition.id)),
  });
}

/**
 * Replace only a failed task inside the already-authorized milestone scope.
 * Replanning never mutates the failed record in place: the old task becomes
 * superseded and every replacement receives a new stable identity.  The
 * number of superseded records is the durable replan counter, avoiding a
 * second mutable counter that could diverge from the actual plan history.
 */
export function applyProjectRuntimePartialReplan(
  state: ProjectRuntimeState,
  expectedGeneration: number,
  input: Readonly<{
    failedTaskId: string;
    replacements: readonly ProjectTaskDefinition[];
    maximumReplans: number;
  }>,
): StateResult {
  const failed = state.tasks.find(
    (task) => task.definition.id === input.failedTaskId,
  );
  const completedIds = new Set(
    state.tasks
      .filter((task) => task.state === "completed")
      .map((task) => task.definition.id),
  );
  const replacementDefinitions = input.replacements.map(snapshotDefinition);
  const existingIds = new Set(state.tasks.map((task) => task.definition.id));
  const replacementIds = new Set(
    replacementDefinitions
      .filter((value): value is ProjectTaskDefinition => value !== null)
      .map((definition) => definition.id),
  );
  const availableDependencies = new Set([...completedIds, ...replacementIds]);
  const hasLiveDependent = state.tasks.some(
    (task) =>
      task.definition.id !== input.failedTaskId &&
      !["completed", "cancelled", "failed", "superseded"].includes(
        task.state,
      ) &&
      task.definition.dependencies.includes(input.failedTaskId),
  );
  if (
    state.generation !== expectedGeneration ||
    !failed ||
    failed.state !== "failed" ||
    failed.supersededBy !== null ||
    !Number.isSafeInteger(input.maximumReplans) ||
    input.maximumReplans < 0 ||
    state.tasks.filter((task) => task.supersededBy !== null).length >=
      input.maximumReplans ||
    hasLiveDependent ||
    replacementDefinitions.length === 0 ||
    replacementDefinitions.some((definition) => definition === null) ||
    replacementIds.size !== replacementDefinitions.length ||
    [...replacementIds].some((id) => existingIds.has(id)) ||
    (replacementDefinitions as readonly ProjectTaskDefinition[]).some(
      (definition) =>
        definition.objectiveId !== failed.definition.objectiveId ||
        definition.dependencies.some(
          (dependency) => !availableDependencies.has(dependency),
        ),
    ) ||
    hasCycle([
      ...state.tasks
        .filter(
          (task) => task.state !== "failed" && task.state !== "superseded",
        )
        .map((task) => task.definition),
      ...(replacementDefinitions as readonly ProjectTaskDefinition[]),
    ])
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_replan_invalid_or_out_of_scope",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const replacements = (
    replacementDefinitions as readonly ProjectTaskDefinition[]
  ).map((definition) =>
    Object.freeze({
      definition,
      state: definition.dependencies.every((dependency) =>
        completedIds.has(dependency),
      )
        ? ("ready" as const)
        : ("waiting_dependency" as const),
      attemptId: null,
      operationId: null,
      authorityBindingId: null,
      startPhase: "none" as const,
      cleanupConfirmed: false,
      recoveryObligations: Object.freeze([]),
      recoveryUnresolved: false,
      candidateId: null,
      retryCount: 0,
      supersededBy: null,
    }),
  );
  const replacementHead = replacements[0]?.definition.id ?? null;
  const tasks = [
    ...state.tasks.map((task) =>
      task.definition.id === failed.definition.id
        ? Object.freeze({
            ...task,
            state: "superseded" as const,
            supersededBy: replacementHead,
          })
        : task,
    ),
    ...replacements,
  ];
  const objectives = state.objectives.map((objective) =>
    objective.definition.id === failed.definition.objectiveId
      ? Object.freeze({
          ...objective,
          state: "executing" as const,
          criterionEvidenceIds: Object.freeze([]),
        })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_partial_replan_applied",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: "executing" as const,
      }),
      objectives,
      tasks,
    }),
    taskIds: Object.freeze(replacements.map((task) => task.definition.id)),
  });
}

/**
 * Retry the same bounded task definition without reusing its prior attempt or
 * Operation identity. This is the explicit "maintain plan" transition: the
 * plan and scope stay fixed while the failed execution identity is retired.
 */
export function retryProjectRuntimeTask(
  state: ProjectRuntimeState,
  expectedGeneration: number,
  taskId: string,
  maximumReplans: number,
): StateResult {
  const failed = state.tasks.find((task) => task.definition.id === taskId);
  if (
    state.generation !== expectedGeneration ||
    !failed ||
    failed.state !== "failed" ||
    !Number.isSafeInteger(maximumReplans) ||
    maximumReplans < 0 ||
    failed.retryCount >= maximumReplans
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_retry_invalid_or_limit_exceeded",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = replaceTask(state, taskId, (task) =>
    Object.freeze({
      ...task,
      state: "ready" as const,
      attemptId: null,
      operationId: null,
      authorityBindingId: null,
      startPhase: "none" as const,
      cleanupConfirmed: false,
      recoveryObligations: Object.freeze([]),
      recoveryUnresolved: false,
      candidateId: null,
      retryCount: task.retryCount + 1,
    }),
  );
  const objectives = state.objectives.map((objective) =>
    objective.definition.id === failed.definition.objectiveId
      ? Object.freeze({ ...objective, state: "executing" as const })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_plan_maintained_for_retry",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: "executing" as const,
      }),
      objectives,
      tasks,
    }),
    taskIds: Object.freeze([taskId]),
  });
}

export function requestProjectRuntimeHumanDecision(
  state: ProjectRuntimeState,
  expectedGeneration: number,
  objectiveId: string,
): StateResult {
  const objective = state.objectives.find(
    (candidate) => candidate.definition.id === objectiveId,
  );
  if (
    state.generation !== expectedGeneration ||
    !objective ||
    objective.state !== "blocked" ||
    state.milestone.state === "accepted" ||
    state.milestone.state === "cancelled"
  )
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_human_decision_request_invalid",
      state,
      taskIds: Object.freeze([]),
    });
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_human_decision_required",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      decisionApplicationId: null,
      milestone: Object.freeze({
        ...state.milestone,
        state: "human_decision_required" as const,
      }),
    }),
    taskIds: Object.freeze(
      state.tasks
        .filter((task) => task.definition.objectiveId === objectiveId)
        .map((task) => task.definition.id),
    ),
  });
}

export function applyProjectRuntimeHumanDecision(
  state: ProjectRuntimeState,
  expectedGeneration: number,
  action: "resume" | "cancel",
  applicationId?: string,
): StateResult {
  if (
    state.generation !== expectedGeneration ||
    state.milestone.state !== "human_decision_required" ||
    !validIdentity(applicationId)
  )
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_human_decision_stale",
      state,
      taskIds: Object.freeze([]),
    });
  return Object.freeze({
    status: "completed",
    reason:
      action === "resume"
        ? "project_runtime_human_decision_applied"
        : "project_runtime_milestone_cancelled_by_human",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      decisionApplicationId: applicationId as string,
      milestone: Object.freeze({
        ...state.milestone,
        state:
          action === "resume" ? ("executing" as const) : ("cancelled" as const),
      }),
    }),
    taskIds: Object.freeze([]),
  });
}

export function recordObjectiveIntegration(
  state: ProjectRuntimeState,
  expectedGeneration: number,
  objectiveId: string,
  input: Readonly<{
    accepted: boolean;
    criterionEvidenceIds: readonly string[];
  }>,
): StateResult {
  const objective = state.objectives.find(
    (candidate) => candidate.definition.id === objectiveId,
  );
  if (
    state.generation !== expectedGeneration ||
    !objective ||
    objective.state !== "integration_pending" ||
    input.criterionEvidenceIds.length !==
      objective.definition.acceptanceCriteria.length ||
    input.criterionEvidenceIds.some((value) => !validIdentity(value))
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_objective_integration_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const objectives = state.objectives.map((candidate) =>
    candidate.definition.id === objectiveId
      ? Object.freeze({
          ...candidate,
          state: input.accepted ? ("accepted" as const) : ("blocked" as const),
          criterionEvidenceIds: Object.freeze([...input.criterionEvidenceIds]),
        })
      : candidate,
  );
  const isAllAccepted = objectives.every(
    (candidate) => candidate.state === "accepted",
  );
  return Object.freeze({
    status: "completed",
    reason: input.accepted
      ? "project_runtime_objective_accepted"
      : "project_runtime_objective_integration_rejected",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: isAllAccepted ? ("integrating" as const) : state.milestone.state,
      }),
      objectives,
    }),
    taskIds: Object.freeze(
      state.tasks
        .filter((task) => task.definition.objectiveId === objectiveId)
        .map((task) => task.definition.id),
    ),
  });
}

export function recordMilestoneIntegration(
  state: ProjectRuntimeState,
  expectedGeneration: number,
  criterionEvidenceIds: readonly string[],
): StateResult {
  if (
    state.generation !== expectedGeneration ||
    state.milestone.state !== "integrating" ||
    !state.objectives.every((objective) => objective.state === "accepted") ||
    criterionEvidenceIds.length !== state.milestone.acceptanceCriteria.length ||
    criterionEvidenceIds.some((value) => !validIdentity(value))
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_milestone_integration_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_milestone_accepted",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: "accepted" as const,
        criterionEvidenceIds: Object.freeze([...criterionEvidenceIds]),
      }),
    }),
    taskIds: Object.freeze(state.tasks.map((task) => task.definition.id)),
  });
}

function countStates<T extends string>(
  values: readonly T[],
  states: readonly T[],
): Readonly<Record<T, number>> {
  return Object.freeze(
    Object.fromEntries(
      states.map((state) => [
        state,
        values.filter((value) => value === state).length,
      ]),
    ) as Record<T, number>,
  );
}

export function projectProjectRuntimeState(
  state: ProjectRuntimeState,
): ProjectRuntimeProjection {
  const objectiveCounts = countStates(
    state.objectives.map((objective) => objective.state),
    PROJECT_OBJECTIVE_STATES,
  );
  const taskCounts = countStates(
    state.tasks.map((task) => task.state),
    PROJECT_TASK_STATES,
  );
  const objectiveTaskSummaries = Object.freeze(
    state.objectives.map((objective) =>
      Object.freeze({
        objectiveId: objective.definition.id,
        objectiveState: objective.state,
        taskCounts: countStates(
          state.tasks
            .filter(
              (task) => task.definition.objectiveId === objective.definition.id,
            )
            .map((task) => task.state),
          PROJECT_TASK_STATES,
        ),
      }),
    ),
  );
  const recoveryRequired = state.milestone.state === "recovery_required";
  const humanDecisionRequired =
    state.milestone.state === "human_decision_required" ||
    objectiveCounts.blocked > 0;
  const allTasksComplete =
    taskCounts.completed + taskCounts.superseded === state.tasks.length;
  const anyTaskStarted =
    taskCounts.ready + taskCounts.waiting_dependency < state.tasks.length;
  const qualityState =
    state.milestone.state === "accepted"
      ? ("accepted" as const)
      : humanDecisionRequired || recoveryRequired
        ? ("blocked" as const)
        : objectiveCounts.integration_pending > 0 ||
            state.milestone.state === "integrating"
          ? ("integration_pending" as const)
          : ("not_evaluated" as const);
  const nextAction = recoveryRequired
    ? ("recover" as const)
    : humanDecisionRequired
      ? ("human_decision" as const)
      : state.milestone.state === "accepted"
        ? ("complete" as const)
        : state.milestone.state === "integrating"
          ? ("verify_milestone_integration" as const)
          : objectiveCounts.integration_pending > 0
            ? ("verify_objective_integration" as const)
            : selectSchedulableProjectTasks(state).length > 0
              ? ("schedule_task" as const)
              : ("wait_for_task" as const);
  const projection = Object.freeze({
    projectId: state.projectId,
    milestoneId: state.milestoneId,
    generation: state.generation,
    milestoneState: state.milestone.state,
    objectiveCounts,
    taskCounts,
    objectiveTaskSummaries,
    workProgress: allTasksComplete
      ? "tasks_complete"
      : anyTaskStarted
        ? "in_progress"
        : "not_started",
    qualityState,
    humanDecisionRequired,
    recoveryRequired,
    nextAction,
  });
  if (!isProjectRuntimeProjectionSemanticallyValid(projection))
    throw new Error("project_runtime_projection_semantics_invalid");
  return projection;
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
    acceptanceContract:
      "task_completion_then_objective_integration_then_milestone_integration",
  });
}
