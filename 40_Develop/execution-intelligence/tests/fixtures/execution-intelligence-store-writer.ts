import {
  createTaskAttemptSettledEvent,
  verifyExecutionIntelligenceRepositoryRoot,
  writeExecutionIntelligenceEvent,
} from "../../src/index.ts";

const [repositoryRoot, reason = "task_completed"] = process.argv.slice(2);
if (!repositoryRoot) process.exitCode = 3;
else {
  const verified = verifyExecutionIntelligenceRepositoryRoot(repositoryRoot);
  if (verified.status !== "completed") process.exitCode = 4;
  else {
    const event = createTaskAttemptSettledEvent({
      occurredAt: "2026-09-05T00:00:01.000Z",
      identity: {
        projectId: "project-a",
        milestoneId: "milestone-a",
        objectiveId: "objective-a",
        taskId: "task-a",
        attemptId: "attempt-a",
        operationId: "operation-a",
      },
      execution: {
        role: "executor",
        provider: { state: "not_observed", reason: "provider_not_reported" },
        model: { state: "not_observed", reason: "model_not_reported" },
        inputStrategyRef: {
          state: "observed",
          value: "test/input/v1",
          source: "process_fixture",
        },
        durationMs: {
          state: "observed",
          value: 10,
          source: "process_fixture",
        },
        usage: { state: "not_observed", reason: "usage_not_reported" },
        humanActiveMs: {
          state: "not_observed",
          reason: "human_time_not_reported",
        },
      },
      outcome: {
        status: "completed",
        reason,
        effectState: "settled",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        processRestartRequired: false,
      },
      quality: {
        state: "not_applicable",
        reason: "attempt_settlement_is_not_acceptance",
      },
    });
    process.stdout.write(
      `${JSON.stringify(writeExecutionIntelligenceEvent(verified.root, event))}\n`,
    );
  }
}
