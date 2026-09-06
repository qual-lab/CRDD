import assert from "node:assert/strict";
import test from "node:test";

import {
  BOUNDED_INTEGRATED_RESULT_EVALUATION_INPUT_CONTRACT,
  createTaskAttemptSettledEvent,
  evaluateBoundedIntegratedResult,
  inspectExecutionIntelligenceEvent,
  proposeExecutionImprovementCandidates,
  summarizeExecutionIntelligence,
} from "../../src/index.ts";

function event(
  status: "completed" | "blocked" = "completed",
  taskId = "task-a",
  provider: string | null = null,
) {
  return createTaskAttemptSettledEvent({
    occurredAt: "2026-09-05T00:00:01.000Z",
    identity: {
      projectId: "project-a",
      milestoneId: "milestone-a",
      objectiveId: "objective-a",
      taskId,
      attemptId: `attempt-${taskId}`,
      operationId: `operation-${taskId}`,
    },
    outcome: {
      status,
      reason: status === "completed" ? "task_completed" : "task_blocked",
      effectState: status === "completed" ? "settled" : "no_effect",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
    },
    execution: {
      role: "executor",
      provider:
        provider === null
          ? { state: "not_observed", reason: "provider_not_reported" }
          : { state: "observed", value: provider, source: "runtime_receipt" },
      model: { state: "not_observed", reason: "model_not_reported" },
      inputStrategyRef: {
        state: "observed",
        value: "test/input/v1",
        source: "unit_fixture",
      },
      durationMs: { state: "observed", value: 75, source: "unit_clock" },
      usage: { state: "not_observed", reason: "usage_not_reported" },
      humanActiveMs: {
        state: "not_observed",
        reason: "human_time_not_reported",
      },
    },
    quality: {
      state: "not_applicable",
      reason: "attempt_settlement_is_not_acceptance",
    },
  });
}

test("creates a closed metadata-only event and preserves missing observations", () => {
  const created = event();
  assert.equal(inspectExecutionIntelligenceEvent(created), created);
  assert.equal(created.execution.durationMs.state, "observed");
  assert.equal(created.execution.provider.state, "not_observed");
  assert.equal(created.execution.usage.state, "not_observed");
  assert.equal(created.quality.state, "not_applicable");
  assert.equal(Object.isFrozen(created.execution.provider), true);
  assert.equal(Object.isFrozen(created.identity), true);
  assert.equal(JSON.stringify(created).includes("prompt"), false);
  assert.equal(
    inspectExecutionIntelligenceEvent({
      ...created,
      rawProviderOutput: "forbidden",
    }),
    null,
  );
});

test("accepts stable provider and role identifiers without Coordinator ownership", () => {
  const created = event();
  const external = createTaskAttemptSettledEvent({
    occurredAt: created.occurredAt,
    identity: created.identity,
    execution: {
      ...created.execution,
      role: "verifier",
      provider: {
        state: "observed",
        value: "self-hosted-provider",
        source: "external_runtime_receipt",
      },
    },
    outcome: created.outcome,
    quality: created.quality,
  });
  assert.equal(external.execution.role, "verifier");
  assert.deepEqual(external.execution.provider, {
    state: "observed",
    value: "self-hosted-provider",
    source: "external_runtime_receipt",
  });
});

test("aggregates observed facts without turning missing values into zero", () => {
  const summary = summarizeExecutionIntelligence([event()]);
  assert.ok(summary);
  assert.equal(summary.eventCount, 1);
  assert.equal(summary.totalObservedDurationMs, 75);
  assert.equal(summary.providerObservationCount, 0);
  assert.equal(summary.usageObservationCount, 0);
  assert.equal(summary.humanActiveObservationCount, 0);
  assert.equal(summary.missingnessPreserved, true);
});

test("returns non-authoritative improvement candidates", () => {
  const proposal = proposeExecutionImprovementCandidates([event("blocked")]);
  assert.ok(proposal);
  assert.equal(proposal.status, "proposal");
  assert.equal(proposal.authorityConferred, false);
  assert.equal(proposal.automaticChangeAllowed, false);
  assert.deepEqual(
    proposal.candidates.map((entry) => entry.kind),
    ["investigate_noncompleted_attempts", "improve_provider_observation"],
  );
});

test("rejects an invalid member instead of silently dropping it", () => {
  assert.equal(
    summarizeExecutionIntelligence([event(), { status: "bad" }]),
    null,
  );
  assert.equal(
    proposeExecutionImprovementCandidates([{ status: "bad" }]),
    null,
  );
  const duplicate = event();
  assert.equal(summarizeExecutionIntelligence([duplicate, duplicate]), null);
});

function evaluationInput() {
  const observedCount = (value: number) => ({
    state: "observed" as const,
    value,
    source: "dogfooding_record",
  });
  return {
    contract: BOUNDED_INTEGRATED_RESULT_EVALUATION_INPUT_CONTRACT,
    evaluationId: "evaluation-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    expectedTaskIds: ["task-a", "task-b"],
    taskAttemptEvents: [
      event("completed", "task-a", "codex"),
      event("completed", "task-b", "claude"),
    ],
    integratedResult: {
      state: "observed" as const,
      value: { result: "accepted" as const, evidenceIds: ["evidence-a"] },
      source: "project_runtime_integration",
    },
    measurements: {
      timeToAcceptedResultMs: observedCount(1_200),
      humanActiveMs: observedCount(20),
      reviewLoopCount: observedCount(1),
      remediationCount: observedCount(0),
      retryCount: observedCount(0),
      integrationConflictCount: observedCount(0),
      postIntegrationFindingCount: observedCount(0),
    },
  };
}

test("evaluates bounded work by the integrated accepted result rather than task success", () => {
  const result = evaluateBoundedIntegratedResult(evaluationInput());
  assert.ok(result);
  assert.equal(result.status, "completed");
  assert.equal(result.integratedAcceptedResult, true);
  assert.equal(result.attemptCount, 2);
  assert.equal(result.observedTaskCount, 2);
  assert.deepEqual(result.providerAttemptCounts, { codex: 1, claude: 1 });
  assert.equal(result.taskSuccessIsIntegrationAcceptance, false);
  assert.equal(result.authorityConferred, false);
});

test("preserves an unobserved integrated result and missing task evidence", () => {
  const base = evaluationInput();
  const result = evaluateBoundedIntegratedResult({
    ...base,
    taskAttemptEvents: base.taskAttemptEvents.slice(0, 1),
    integratedResult: {
      state: "not_observed",
      reason: "integration_not_run",
    },
  });
  assert.ok(result);
  assert.equal(result.status, "incomplete");
  assert.equal(result.reason, "expected_task_attempt_not_observed");
  assert.equal(result.integratedAcceptedResult, null);
  assert.deepEqual(result.missingTaskIds, ["task-b"]);
  assert.equal(result.missingnessPreserved, true);
});

test("rejects cross-project events and unknown evaluation fields", () => {
  const base = evaluationInput();
  assert.equal(
    evaluateBoundedIntegratedResult({
      ...base,
      taskAttemptEvents: [
        {
          ...base.taskAttemptEvents[0],
          identity: {
            ...base.taskAttemptEvents[0]?.identity,
            projectId: "other-project",
          },
        },
      ],
    }),
    null,
  );
  assert.equal(
    evaluateBoundedIntegratedResult({ ...base, automaticAdoption: true }),
    null,
  );
});
