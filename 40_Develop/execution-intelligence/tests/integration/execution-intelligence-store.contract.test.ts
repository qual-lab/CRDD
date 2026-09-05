import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createTaskAttemptSettledEvent } from "../../src/core/execution-intelligence.ts";
import {
  applyExecutionIntelligenceRetention,
  readExecutionIntelligence,
  writeExecutionIntelligenceEvent,
} from "../../src/store/execution-intelligence-store.ts";

function fixture(t: test.TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-execution-store-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function event() {
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
      status: "completed",
      reason: "task_completed",
      effectState: "settled",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
    },
    execution: {
      role: "executor",
      provider: { state: "not_observed", reason: "provider_not_reported" },
      model: { state: "not_observed", reason: "model_not_reported" },
      inputStrategyRef: {
        state: "observed",
        value: "test/input/v1",
        source: "integration_fixture",
      },
      durationMs: {
        state: "observed",
        value: 10,
        source: "integration_clock",
      },
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

test("writes immutable events under repository-local .crdd and reads a summary", (t) => {
  const root = fixture(t);
  const created = event();
  assert.equal(
    writeExecutionIntelligenceEvent(root, created).status,
    "completed",
  );
  assert.equal(
    writeExecutionIntelligenceEvent(root, created).status,
    "completed",
  );
  const observed = readExecutionIntelligence(root);
  assert.equal(observed.status, "completed");
  if (observed.status !== "completed") throw new Error("observation_failed");
  assert.equal(observed.events.length, 1);
  assert.equal(observed.summary.eventCount, 1);
  assert.equal(
    fs.existsSync(
      path.join(
        root,
        ".crdd",
        "execution",
        "events",
        `${created.eventId}.json`,
      ),
    ),
    true,
  );
});

test("rejects conflicting content for the same exact identity", (t) => {
  const root = fixture(t);
  const created = event();
  assert.equal(
    writeExecutionIntelligenceEvent(root, created).status,
    "completed",
  );
  const changed = {
    ...created,
    outcome: { ...created.outcome, reason: "different_reason" },
  };
  assert.equal(
    writeExecutionIntelligenceEvent(root, changed).reason,
    "execution_event_identity_conflict",
  );
});

test("fails closed when stored content is corrupt", (t) => {
  const root = fixture(t);
  const created = event();
  assert.equal(
    writeExecutionIntelligenceEvent(root, created).status,
    "completed",
  );
  fs.writeFileSync(
    path.join(root, ".crdd", "execution", "events", `${created.eventId}.json`),
    "{}\n",
    "utf8",
  );
  assert.deepEqual(readExecutionIntelligence(root), {
    status: "blocked",
    reason: "execution_event_store_observation_failed",
  });
});

test("does not replace a non-directory repository-local boundary", (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, ".crdd"), "occupied\n", "utf8");
  const result = writeExecutionIntelligenceEvent(root, event());
  assert.deepEqual(result, {
    status: "blocked",
    reason: "execution_event_store_unavailable",
  });
  assert.equal(fs.readFileSync(path.join(root, ".crdd"), "utf8"), "occupied\n");
});

test("does not hide an unknown residual file from the store result", (t) => {
  const root = fixture(t);
  assert.equal(
    writeExecutionIntelligenceEvent(root, event()).status,
    "completed",
  );
  fs.writeFileSync(
    path.join(root, ".crdd", "execution", "events", "unknown.pending"),
    "residual\n",
    "utf8",
  );
  assert.deepEqual(readExecutionIntelligence(root), {
    status: "blocked",
    reason: "execution_event_store_observation_failed",
  });
});

test("cleans only exact hashes after durable evidence and no unresolved references", (t) => {
  const root = fixture(t);
  const created = event();
  writeExecutionIntelligenceEvent(root, created);
  const observed = readExecutionIntelligence(root);
  assert.equal(observed.status, "completed");
  if (observed.status !== "completed") throw new Error("observation_failed");
  assert.equal(
    applyExecutionIntelligenceRetention(root, {
      eventHashes: {},
      unresolvedReferenceEventIds: [],
      durableEvidenceId: "evidence-a",
    }).reason,
    "execution_retention_not_safe",
  );
  assert.equal(
    applyExecutionIntelligenceRetention(root, {
      eventHashes: observed.hashes,
      unresolvedReferenceEventIds: [created.eventId],
      durableEvidenceId: "evidence-a",
    }).reason,
    "execution_retention_not_safe",
  );
  const cleaned = applyExecutionIntelligenceRetention(root, {
    eventHashes: observed.hashes,
    unresolvedReferenceEventIds: [],
    durableEvidenceId: "evidence-a",
  });
  assert.equal(cleaned.status, "completed");
  assert.deepEqual(cleaned.removedEventIds, [created.eventId]);
  const after = readExecutionIntelligence(root);
  assert.equal(after.status, "completed");
  if (after.status === "completed") assert.equal(after.events.length, 0);
});
