import {
  readProjectOperationQueueState,
  readProjectRuntimeState,
  updateProjectOperationQueueState,
  writeProjectRuntimeState,
} from "./project-runtime-durable-foundation.ts";
import {
  applyProjectRuntimePartialReplan,
  requestProjectRuntimeHumanDecision,
  retryProjectRuntimeTask,
  type ProjectTaskDefinition,
} from "../../../project-runtime/src/index.ts";

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

type Input = Readonly<{
  workingDirectory: string;
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
  maximumReplans: number;
}>;

function validDecision(raw: unknown): raw is ProjectRuntimeReplanDecision {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    Object.getPrototypeOf(raw) !== Object.prototype
  )
    return false;
  const value = raw as ProjectRuntimeReplanDecision;
  if (value.disposition === "maintain_plan")
    return typeof value.reason === "string" && value.reason.length > 0;
  if (value.disposition === "human_decision")
    return (
      typeof value.objectiveId === "string" &&
      typeof value.reason === "string" &&
      value.reason.length > 0
    );
  return (
    value.disposition === "partial_replan" &&
    typeof value.failedTaskId === "string" &&
    Array.isArray(value.replacements) &&
    value.replacements.length > 0
  );
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
  input: Input,
  classify: (
    context: Readonly<{
      failedTaskIds: readonly string[];
      generation: number;
      repositoryRevision: string;
    }>,
  ) => unknown,
) {
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
  let raw: unknown;
  try {
    raw = classify(
      Object.freeze({
        failedTaskIds: Object.freeze(failedTaskIds),
        generation: state.generation,
        repositoryRevision: state.repositoryRevision,
      }),
    );
  } catch {
    raw = null;
  }
  if (!validDecision(raw))
    return blocked("project_runtime_replan_decision_invalid");
  const transition =
    raw.disposition === "maintain_plan"
      ? retryProjectRuntimeTask(
          state,
          state.generation,
          failedTaskIds[0] ?? "",
          input.maximumReplans,
        )
      : raw.disposition === "partial_replan"
        ? applyProjectRuntimePartialReplan(state, state.generation, {
            failedTaskId: raw.failedTaskId,
            replacements: raw.replacements,
            maximumReplans: input.maximumReplans,
          })
        : requestProjectRuntimeHumanDecision(
            state,
            state.generation,
            raw.objectiveId,
          );
  if (transition.status !== "completed" || !transition.state)
    return blocked(transition.reason);
  const written = writeProjectRuntimeState(
    input.workingDirectory,
    input.repositoryBindingId,
    transition.state,
    state.generation,
  );
  if (written.status !== "completed") return blocked(written.reason, true);
  state = written.value;
  const queueUpdate = updateProjectOperationQueueState(
    input.workingDirectory,
    input.repositoryBindingId,
    input.queueId,
    queue.generation,
    {
      state:
        raw.disposition === "human_decision"
          ? "human_decision_required"
          : "queued",
      lease: null,
      resumeCondition:
        raw.disposition === "maintain_plan"
          ? "same_plan_retry"
          : raw.disposition === "partial_replan"
            ? "partial_replan_applied"
            : "human_decision",
      resultReference:
        raw.disposition === "maintain_plan"
          ? (failedTaskIds[0] ?? null)
          : raw.disposition === "partial_replan"
            ? raw.failedTaskId
            : raw.objectiveId,
    },
  );
  if (queueUpdate.status !== "completed")
    return blocked(queueUpdate.reason, true);
  return Object.freeze({
    contract: PROJECT_RUNTIME_REPLANNING_CONTRACT,
    status:
      raw.disposition === "human_decision"
        ? ("blocked" as const)
        : ("completed" as const),
    reason:
      raw.disposition === "maintain_plan"
        ? "project_runtime_same_plan_retry_ready"
        : raw.disposition === "partial_replan"
          ? "project_runtime_partial_replan_ready"
          : "project_runtime_human_decision_required",
    disposition: raw.disposition,
    generation: state.generation,
    taskIds: transition.taskIds,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}
