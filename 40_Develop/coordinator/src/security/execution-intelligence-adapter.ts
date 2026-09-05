import {
  createTaskAttemptSettledEvent,
  verifyExecutionIntelligenceRepositoryRoot,
  type ExecutionIntelligenceEvent,
  type ExecutionIntelligencePublicationResult,
} from "../../../execution-intelligence/src/index.ts";
import { writeExecutionIntelligenceEvent } from "../../../execution-intelligence/src/index.ts";

/**
 * Coordinator-specific projection into the shared Execution Intelligence
 * contract. The shared component does not know Single Task Runtime semantics.
 */
export function createProjectRuntimeTaskAttemptEvent(
  input: Readonly<{
    occurredAt: string;
    startedAtMs: number;
    endedAtMs: number;
    identity: ExecutionIntelligenceEvent["identity"];
    outcome: ExecutionIntelligenceEvent["outcome"];
    provider?: "codex" | "claude";
  }>,
): ExecutionIntelligenceEvent {
  return createTaskAttemptSettledEvent({
    occurredAt: input.occurredAt,
    identity: input.identity,
    execution: {
      role: "executor",
      provider:
        input.provider === undefined
          ? {
              state: "not_observed",
              reason: "provider_selection_not_exposed_by_single_task_result",
            }
          : {
              state: "observed",
              value: input.provider,
              source: "single_task_verified_completion",
            },
      model: {
        state: "not_observed",
        reason: "model_selection_not_exposed_by_single_task_result",
      },
      inputStrategyRef: {
        state: "observed",
        value: "project-runtime/single-task-request/v1",
        source: "project_runtime_execution",
      },
      durationMs:
        Number.isFinite(input.startedAtMs) &&
        Number.isFinite(input.endedAtMs) &&
        input.endedAtMs >= input.startedAtMs
          ? {
              state: "observed",
              value: Math.round(input.endedAtMs - input.startedAtMs),
              source: "project_runtime_monotonic_clock",
            }
          : {
              state: "not_observed",
              reason: "project_runtime_monotonic_clock_invalid",
            },
      usage: {
        state: "not_observed",
        reason: "provider_usage_not_exposed_by_single_task_result",
      },
      humanActiveMs: {
        state: "not_observed",
        reason: "human_active_time_not_observed_for_task_attempt",
      },
    },
    outcome: input.outcome,
    quality: {
      state: "not_applicable",
      reason: "task_attempt_settlement_is_not_acceptance",
    },
  });
}

export function recordProjectRuntimeExecutionEvent(
  repositoryRoot: string,
  event: ExecutionIntelligenceEvent,
): ExecutionIntelligencePublicationResult {
  const verifiedRoot =
    verifyExecutionIntelligenceRepositoryRoot(repositoryRoot);
  if (verifiedRoot.status !== "completed")
    return Object.freeze({
      status: "blocked" as const,
      reason: verifiedRoot.reason,
      effectState: "no_effect" as const,
      cleanupConfirmed: true,
      retryAllowed: false,
      manualRecoveryRequired: false,
      residualArtifactIds: Object.freeze([]),
    });
  return writeExecutionIntelligenceEvent(verifiedRoot.root, event);
}

export type {
  ExecutionIntelligenceEvent,
  ExecutionIntelligencePublicationResult,
};
