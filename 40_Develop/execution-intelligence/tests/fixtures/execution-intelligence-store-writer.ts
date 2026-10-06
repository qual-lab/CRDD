import {
  createTaskAttemptSettledEvent,
  verifyExecutionIntelligenceRepositoryRoot,
  writeExecutionIntelligenceEvent,
  usageNotObserved,
} from "../../src/index.ts";

const [repositoryRoot, reason = "task_completed", operationId = "operation-a"] =
  process.argv.slice(2);
if (!repositoryRoot) {
  process.stdout.write(
    `${JSON.stringify({ status: "blocked", reason: "execution_repository_root_invalid", stage: "argument_validation", effectIssued: false })}\n`,
  );
  process.exitCode = 3;
} else {
  const verified = verifyExecutionIntelligenceRepositoryRoot(repositoryRoot);
  if (verified.status !== "completed") {
    process.stdout.write(
      `${JSON.stringify({ status: "blocked", reason: "execution_repository_root_invalid", stage: "root_verification", effectIssued: false })}\n`,
    );
    process.exitCode = 4;
  } else {
    const event = createTaskAttemptSettledEvent({
      occurredAt: new Date(
        Math.floor(Date.now() / 86_400_000) * 86_400_000,
      ).toISOString(),
      identity: {
        projectId: "project-a",
        milestoneId: "milestone-a",
        objectiveId: "objective-a",
        taskId: "task-a",
        attemptId: "attempt-a",
        operationId,
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
        usage: usageNotObserved("usage_not_reported"),
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
