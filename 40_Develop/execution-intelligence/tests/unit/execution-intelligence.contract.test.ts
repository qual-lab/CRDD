import assert from "node:assert/strict";
import test from "node:test";

import {
  createTaskAttemptSettledEvent,
  inspectExecutionIntelligenceEvent,
  proposeExecutionImprovementCandidates,
  summarizeExecutionIntelligence,
} from "../../src/index.ts";

function event(status: "completed" | "blocked" = "completed") {
  return createTaskAttemptSettledEvent({
    occurredAt: "2026-09-05T00:00:01.000Z",
    identity: {
      projectId: "project-a",
      milestoneId: "milestone-a",
      objectiveId: "objective-a",
      taskId: "task-a",
      attemptId: "attempt-a",
      operationId: "operation-a",
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
      provider: {
        state: "not_observed",
        reason: "provider_not_reported",
      },
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
