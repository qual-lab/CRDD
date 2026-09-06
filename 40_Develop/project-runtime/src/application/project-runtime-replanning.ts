import {
  applyProjectRuntimePartialReplan,
  requestProjectRuntimeHumanDecision,
  retryProjectRuntimeTask,
  type ProjectTaskDefinition,
} from "../core/project-runtime-state.ts";
import type { ProjectRuntimeStatePort } from "../ports/state-port.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../internal/plain-data-snapshot.ts";

export const PROJECT_RUNTIME_REPLANNING_CONTRACT =
  "crdd-coordinator/project-runtime-replanning/v1" as const;

export type ProjectRuntimeReplanDecision =
  | Readonly<{
      disposition: "partial_replan";
      failedTaskId: string;
      replacements: readonly ProjectTaskDefinition[];
    }>
  | Readonly<{
      disposition: "human_decision";
      objectiveId: string;
      reason: string;
    }>
  | Readonly<{ disposition: "maintain_plan"; reason: string }>;

export type ProjectRuntimeReplanInput = Readonly<{
  projectId: string;
  milestoneId: string;
  queueId: string;
  maximumReplans: number;
}>;

export type ProjectRuntimeReplanClassifier = (
  context: Readonly<{
    failedTaskIds: readonly string[];
    generation: number;
    repositoryRevision: string;
  }>,
) => unknown;

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)
  );
}

function validText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    !value.includes("\0")
  );
}

function inspectStrings(
  value: unknown,
  maximum: number,
  isEmptyAllowed: boolean,
) {
  const snapshot = snapshotPlainArray<string>(value, maximum);
  if (
    snapshot.status !== "ok" ||
    (!isEmptyAllowed && snapshot.value.length === 0) ||
    !snapshot.value.every((entry) => validText(entry)) ||
    new Set(snapshot.value).size !== snapshot.value.length
  )
    return null;
  return Object.freeze([...snapshot.value]);
}

function inspectTaskDefinition(value: unknown): ProjectTaskDefinition | null {
  const task = snapshotPlainRecord(
    value,
    new Set([
      "allowedPaths",
      "conflictKeys",
      "dependencies",
      "id",
      "objectiveId",
    ] as const),
  );
  if (!task || !validId(task.id) || !validId(task.objectiveId)) return null;
  const dependencies = inspectStrings(task.dependencies, 128, true);
  const allowedPaths = inspectStrings(task.allowedPaths, 128, false);
  const conflictKeys = inspectStrings(task.conflictKeys, 128, true);
  return dependencies && allowedPaths && conflictKeys
    ? Object.freeze({
        id: task.id,
        objectiveId: task.objectiveId,
        dependencies,
        allowedPaths,
        conflictKeys,
      })
    : null;
}

function inspectDecision(raw: unknown): ProjectRuntimeReplanDecision | null {
  const maintain = snapshotPlainRecord(
    raw,
    new Set(["disposition", "reason"] as const),
  );
  if (maintain?.disposition === "maintain_plan" && validText(maintain.reason))
    return Object.freeze({
      disposition: "maintain_plan",
      reason: maintain.reason,
    });
  const human = snapshotPlainRecord(
    raw,
    new Set(["disposition", "objectiveId", "reason"] as const),
  );
  if (
    human?.disposition === "human_decision" &&
    validId(human.objectiveId) &&
    validText(human.reason)
  )
    return Object.freeze({
      disposition: "human_decision",
      objectiveId: human.objectiveId,
      reason: human.reason,
    });
  const partial = snapshotPlainRecord(
    raw,
    new Set(["disposition", "failedTaskId", "replacements"] as const),
  );
  if (
    partial?.disposition !== "partial_replan" ||
    !validId(partial.failedTaskId)
  )
    return null;
  const replacements = snapshotPlainArray(partial.replacements, 128);
  if (replacements.status !== "ok" || replacements.value.length === 0)
    return null;
  const inspectedTasks = replacements.value.map(inspectTaskDefinition);
  return inspectedTasks.some((entry) => entry === null)
    ? null
    : Object.freeze({
        disposition: "partial_replan",
        failedTaskId: partial.failedTaskId,
        replacements: Object.freeze(inspectedTasks as ProjectTaskDefinition[]),
      });
}

function blocked(reason: string, isRecovery = false) {
  return Object.freeze({
    contract: PROJECT_RUNTIME_REPLANNING_CONTRACT,
    status: "blocked" as const,
    reason,
    cleanupConfirmed: !isRecovery,
    manualRecoveryRequired: isRecovery,
    effectState: isRecovery ? ("unknown" as const) : ("no_effect" as const),
  });
}

/** Resolve one durable replan boundary without widening Milestone scope or authority. */
export function resolveProjectRuntimeReplan(
  statePort: ProjectRuntimeStatePort,
  input: ProjectRuntimeReplanInput,
  classify: ProjectRuntimeReplanClassifier,
) {
  const stateRead = statePort.readState(input.projectId);
  const queueRead = statePort.readQueue(input.queueId);
  if (
    stateRead.status !== "completed" ||
    !stateRead.value ||
    queueRead.status !== "completed"
  )
    return blocked("project_runtime_replan_observation_unknown", true);
  let state = stateRead.value;
  const queue = queueRead.value;
  if (
    state.milestoneId !== input.milestoneId ||
    queue.projectId !== input.projectId ||
    queue.milestoneId !== input.milestoneId ||
    queue.state !== "replan_required" ||
    queue.ownerGeneration !== null
  )
    return blocked("project_runtime_replan_not_available");
  const failedTaskIds = state.tasks
    .filter((task) => task.state === "failed")
    .map((task) => task.definition.id);
  if (failedTaskIds.length === 0)
    return blocked("project_runtime_replan_failed_task_missing", true);
  let decision: ProjectRuntimeReplanDecision | null;
  try {
    decision = inspectDecision(
      classify(
        Object.freeze({
          failedTaskIds: Object.freeze(failedTaskIds),
          generation: state.generation,
          repositoryRevision: state.repositoryRevision,
        }),
      ),
    );
  } catch {
    decision = null;
  }
  if (!decision) return blocked("project_runtime_replan_decision_invalid");
  const transition =
    decision.disposition === "maintain_plan"
      ? retryProjectRuntimeTask(
          state,
          state.generation,
          failedTaskIds[0] ?? "",
          input.maximumReplans,
        )
      : decision.disposition === "partial_replan"
        ? applyProjectRuntimePartialReplan(state, state.generation, {
            failedTaskId: decision.failedTaskId,
            replacements: decision.replacements,
            maximumReplans: input.maximumReplans,
          })
        : requestProjectRuntimeHumanDecision(
            state,
            state.generation,
            decision.objectiveId,
          );
  if (transition.status !== "completed" || !transition.state)
    return blocked(transition.reason);
  const written = statePort.writeState(transition.state, state.generation);
  if (written.status !== "completed") return blocked(written.reason, true);
  state = written.value;
  const queueUpdate = statePort.updateQueue(input.queueId, queue.generation, {
    state:
      decision.disposition === "human_decision"
        ? "human_decision_required"
        : "queued",
    lease: null,
    resumeCondition:
      decision.disposition === "maintain_plan"
        ? "same_plan_retry"
        : decision.disposition === "partial_replan"
          ? "partial_replan_applied"
          : "human_decision",
    resultReference:
      decision.disposition === "maintain_plan"
        ? (failedTaskIds[0] ?? null)
        : decision.disposition === "partial_replan"
          ? decision.failedTaskId
          : decision.objectiveId,
  });
  if (queueUpdate.status !== "completed")
    return blocked(queueUpdate.reason, true);
  return Object.freeze({
    contract: PROJECT_RUNTIME_REPLANNING_CONTRACT,
    status:
      decision.disposition === "human_decision"
        ? ("blocked" as const)
        : ("completed" as const),
    reason:
      decision.disposition === "maintain_plan"
        ? "project_runtime_same_plan_retry_ready"
        : decision.disposition === "partial_replan"
          ? "project_runtime_partial_replan_ready"
          : "project_runtime_human_decision_required",
    disposition: decision.disposition,
    generation: state.generation,
    taskIds: transition.taskIds,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}
