import {
  createTaskAttemptSettledEvent,
  type ExecutionIntelligenceEvent,
  type ExecutionIntelligencePublicationResult,
  usageNotObserved,
  verifyExecutionIntelligenceRepositoryRoot,
  writeExecutionIntelligenceEvent,
} from "../../../execution-intelligence/src/index.ts";
import type {
  ProjectRuntimeExecutionObservationPublication,
  ProjectRuntimeTaskAttemptObservation,
} from "../../../project-runtime/src/index.ts";

/**
 * Coordinator-specific projection into the shared Execution Intelligence
 *
 * @responsibility createProjectRuntimeTaskAttemptEventに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000007
 * @input input: ProjectRuntimeTaskAttemptObservation
 * @returns ExecutionIntelligenceEventを返す。
 * @precondition 「input: ProjectRuntimeTaskAttemptObservation」がcreateProjectRuntimeTaskAttemptEventの入力契約を満たす。
 * @postcondition createProjectRuntimeTaskAttemptEventの責務を完了した結果だけを返す。
 * @effect N/A: createProjectRuntimeTaskAttemptEventは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createProjectRuntimeTaskAttemptEventは独自の失敗分岐を所有しない。
 * @invariant createProjectRuntimeTaskAttemptEventは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createProjectRuntimeTaskAttemptEventはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createProjectRuntimeTaskAttemptEventは共有非同期状態を持たない同期処理である。
 */
export function createProjectRuntimeTaskAttemptEvent(
  input: ProjectRuntimeTaskAttemptObservation,
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
      usage: usageNotObserved(
        "provider_usage_not_exposed_by_single_task_result",
      ),
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

/**
 * recordProjectRuntimeExecutionEventの処理を実行する。
 *
 * @responsibility recordProjectRuntimeExecutionEventに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000007
 * @input repositoryRoot: string、observation: ProjectRuntimeTaskAttemptObservation
 * @returns ProjectRuntimeExecutionObservationPublicationを返す。
 * @precondition 「repositoryRoot: string、observation: ProjectRuntimeTaskAttemptObservation」がrecordProjectRuntimeExecutionEventの入力契約を満たす。
 * @postcondition recordProjectRuntimeExecutionEventの責務を完了した結果だけを返す。
 * @effect N/A: recordProjectRuntimeExecutionEventは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recordProjectRuntimeExecutionEventは独自の失敗分岐を所有しない。
 * @invariant recordProjectRuntimeExecutionEventは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security recordProjectRuntimeExecutionEventはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recordProjectRuntimeExecutionEventは共有非同期状態を持たない同期処理である。
 */
export function recordProjectRuntimeExecutionEvent(
  repositoryRoot: string,
  observation: ProjectRuntimeTaskAttemptObservation,
): ProjectRuntimeExecutionObservationPublication {
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
  return writeExecutionIntelligenceEvent(
    verifiedRoot.root,
    createProjectRuntimeTaskAttemptEvent(observation),
  );
}

export type {
  ExecutionIntelligenceEvent,
  ExecutionIntelligencePublicationResult,
};
