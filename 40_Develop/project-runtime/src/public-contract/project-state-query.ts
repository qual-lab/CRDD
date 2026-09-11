import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../internal/plain-data-snapshot.ts";
import {
  isProjectRuntimeProjectionSemanticallyValid,
  PROJECT_RUNTIME_MAXIMUM_OBJECTIVES,
  PROJECT_RUNTIME_MAXIMUM_TASKS,
  type ProjectRuntimeProjection,
} from "../core/project-runtime-state.ts";

export const PROJECT_RUNTIME_STATE_QUERY_CONTRACT =
  "crdd-coordinator/project-runtime-state-query/v1" as const;

export type ProjectRuntimeStateQuery = Readonly<{
  requestId: string;
  projectId: string;
  repositoryRevision: string;
}>;

export type ProjectRuntimeStateQueryResult = Readonly<{
  contract: typeof PROJECT_RUNTIME_STATE_QUERY_CONTRACT;
  status: "completed" | "blocked";
  reason: string;
  requestId: string;
  projectId: string;
  repositoryRevision: string;
  observationState: "observed" | "absent" | "unknown";
  projection: ProjectRuntimeProjection | null;
  cleanupConfirmed: true;
  manualRecoveryRequired: boolean;
  effectState: "no_effect";
}>;

const queryKeys = new Set([
  "requestId",
  "projectId",
  "repositoryRevision",
] as const);
const resultKeys = new Set([
  "contract",
  "status",
  "reason",
  "requestId",
  "projectId",
  "repositoryRevision",
  "observationState",
  "projection",
  "cleanupConfirmed",
  "manualRecoveryRequired",
  "effectState",
] as const);
const projectionKeys = new Set([
  "projectId",
  "milestoneId",
  "generation",
  "milestoneState",
  "objectiveCounts",
  "taskCounts",
  "objectiveTaskSummaries",
  "workProgress",
  "qualityState",
  "humanDecisionRequired",
  "recoveryRequired",
  "nextAction",
] as const);
const OBJECTIVE_STATES = Object.freeze([
  "planned",
  "executing",
  "integration_pending",
  "accepted",
  "blocked",
  "cancelled",
] as const);
const TASK_STATES = Object.freeze([
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

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)
  );
}

function validRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
}

function validReason(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    /^[a-z0-9_]+$/u.test(value)
  );
}

function countSnapshot<T extends string>(
  value: unknown,
  states: readonly T[],
  maximum: number,
): Readonly<Record<T, number>> | null {
  const record = snapshotPlainRecord(value, new Set(states));
  if (!record) return null;
  let total = 0;
  const entries: [T, number][] = [];
  for (const state of states) {
    const count = record[state];
    if (!Number.isSafeInteger(count) || Number(count) < 0) return null;
    total += Number(count);
    if (!Number.isSafeInteger(total) || total > maximum) return null;
    entries.push([state, Number(count)]);
  }
  return Object.freeze(Object.fromEntries(entries)) as Readonly<
    Record<T, number>
  >;
}

/** Snapshot and validate the canonical public projection at trust boundaries. */
export function inspectProjectRuntimeProjection(
  value: unknown,
): ProjectRuntimeProjection | null {
  const record = snapshotPlainRecord(value, projectionKeys);
  if (!record) return null;
  const objectiveCounts = countSnapshot(
    record.objectiveCounts,
    OBJECTIVE_STATES,
    PROJECT_RUNTIME_MAXIMUM_OBJECTIVES,
  );
  const taskCounts = countSnapshot(
    record.taskCounts,
    TASK_STATES,
    PROJECT_RUNTIME_MAXIMUM_TASKS,
  );
  const rawSummaries = snapshotPlainArray(
    record.objectiveTaskSummaries,
    PROJECT_RUNTIME_MAXIMUM_OBJECTIVES,
  );
  if (!objectiveCounts || !taskCounts || rawSummaries.status !== "ok")
    return null;
  const summaries: ProjectRuntimeProjection["objectiveTaskSummaries"][number][] =
    [];
  for (const raw of rawSummaries.value) {
    const summary = snapshotPlainRecord(
      raw,
      new Set(["objectiveId", "objectiveState", "taskCounts"]),
    );
    const counts = countSnapshot(
      summary?.taskCounts,
      TASK_STATES,
      PROJECT_RUNTIME_MAXIMUM_TASKS,
    );
    if (
      !summary ||
      !validId(summary.objectiveId) ||
      !OBJECTIVE_STATES.includes(summary.objectiveState as never) ||
      !counts
    )
      return null;
    summaries.push(
      Object.freeze({
        objectiveId: summary.objectiveId,
        objectiveState:
          summary.objectiveState as (typeof OBJECTIVE_STATES)[number],
        taskCounts: counts,
      }),
    );
  }
  if (
    !validId(record.projectId) ||
    !validId(record.milestoneId) ||
    !Number.isSafeInteger(record.generation) ||
    Number(record.generation) < 1 ||
    ![
      "planned",
      "executing",
      "integrating",
      "human_decision_required",
      "recovery_required",
      "accepted",
      "cancelled",
    ].includes(String(record.milestoneState)) ||
    !["not_started", "in_progress", "tasks_complete"].includes(
      String(record.workProgress),
    ) ||
    !["not_evaluated", "integration_pending", "accepted", "blocked"].includes(
      String(record.qualityState),
    ) ||
    typeof record.humanDecisionRequired !== "boolean" ||
    typeof record.recoveryRequired !== "boolean" ||
    ![
      "schedule_task",
      "wait_for_task",
      "verify_objective_integration",
      "verify_milestone_integration",
      "human_decision",
      "recover",
      "complete",
    ].includes(String(record.nextAction))
  )
    return null;
  const projection = Object.freeze({
    projectId: record.projectId,
    milestoneId: record.milestoneId,
    generation: Number(record.generation),
    milestoneState: record.milestoneState,
    objectiveCounts,
    taskCounts,
    objectiveTaskSummaries: Object.freeze(summaries),
    workProgress: record.workProgress,
    qualityState: record.qualityState,
    humanDecisionRequired: record.humanDecisionRequired,
    recoveryRequired: record.recoveryRequired,
    nextAction: record.nextAction,
  }) as ProjectRuntimeProjection;
  return isProjectRuntimeProjectionSemanticallyValid(projection)
    ? projection
    : null;
}

export function inspectProjectRuntimeStateQuery(
  value: unknown,
): ProjectRuntimeStateQuery | null {
  const request = snapshotPlainRecord(value, queryKeys);
  if (
    !request ||
    !validId(request.requestId) ||
    !validId(request.projectId) ||
    !validRevision(request.repositoryRevision)
  )
    return null;
  return Object.freeze({ ...request }) as ProjectRuntimeStateQuery;
}

export function inspectProjectRuntimeStateQueryResult(
  value: unknown,
): ProjectRuntimeStateQueryResult | null {
  const result = snapshotPlainRecord(value, resultKeys);
  if (
    !result ||
    result.contract !== PROJECT_RUNTIME_STATE_QUERY_CONTRACT ||
    !["completed", "blocked"].includes(String(result.status)) ||
    !validReason(result.reason) ||
    !validId(result.requestId) ||
    !validId(result.projectId) ||
    !validRevision(result.repositoryRevision) ||
    !["observed", "absent", "unknown"].includes(
      String(result.observationState),
    ) ||
    result.cleanupConfirmed !== true ||
    typeof result.manualRecoveryRequired !== "boolean" ||
    result.effectState !== "no_effect"
  )
    return null;
  const projection =
    result.projection === null
      ? null
      : inspectProjectRuntimeProjection(result.projection);
  if (
    (result.projection !== null && !projection) ||
    (result.observationState === "observed" &&
      (!projection || projection.projectId !== result.projectId)) ||
    (result.observationState !== "observed" && result.projection !== null) ||
    (result.status === "completed" && result.observationState === "unknown") ||
    (result.status === "blocked" && result.observationState !== "unknown") ||
    (result.observationState !== "unknown" && result.manualRecoveryRequired)
  )
    return null;
  return Object.freeze({
    ...result,
    projection,
  }) as ProjectRuntimeStateQueryResult;
}
