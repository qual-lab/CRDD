import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  enqueueProjectOperation,
  readProjectOperationQueueState,
  readProjectRuntimeState,
  writeProjectRuntimeState,
} from "../src/security/project-runtime-durable-foundation.ts";
import { runProjectRuntimeOperation } from "../src/security/project-runtime-execution.ts";
import {
  invalidateProjectRuntimeHumanDecision,
  issueProjectRuntimeHumanDecision,
  recoverProjectRuntimeHumanDecision,
  replaceProjectRuntimeHumanDecision,
  submitProjectRuntimeHumanDecision,
  type ProjectRuntimeDecisionRecord,
  type ProjectRuntimeDecisionRecoveryIntent,
} from "../src/security/project-runtime-human-decision.ts";
import { resolveProjectRuntimeReplan } from "../src/security/project-runtime-replanning.ts";
import {
  applyProjectRuntimeHumanDecision,
  createProjectRuntimeState,
} from "../src/security/project-runtime-state.ts";

const revision = "a".repeat(40);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function fixture(t: test.TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-project-replan-"));
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const created = createProjectRuntimeState({
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["accepted"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["done"] }],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["result.txt"],
        conflictKeys: [],
      },
    ],
    ownerGeneration: "owner-a",
  });
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw new Error("fixture");
  assert.equal(
    writeProjectRuntimeState(root, "binding-a", created.state, 0).status,
    "completed",
  );
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: hash("request"),
      originLane: "interactive",
      repositoryRevision: revision,
      scopeHash: hash("scope"),
    }).status,
    "completed",
  );
  return {
    root,
    input: {
      workingDirectory: root,
      repositoryBindingId: "binding-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      queueId: "queue-a",
      maximumReplans: 2,
    },
  };
}
async function failTask(root: string) {
  return runProjectRuntimeOperation(
    {
      runSingleTaskAttempt: async (input) => ({
        contract: "crdd-coordinator/project-runtime-single-task-adapter",
        attemptId: input.attemptId,
        operationId: input.operationId,
        authorityBindingId: input.authorityBindingId,
        repositoryRevision: input.repositoryRevision,
        status: "blocked",
        reason: "bounded_failure",
        effectState: "settled",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        processRestartRequired: false,
        candidateId: null,
        recoveryIds: [],
      }),
    },
    {
      workingDirectory: root,
      repositoryBindingId: "binding-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      queueId: "queue-a",
      taskExecutions: [
        {
          taskId: "task-a",
          authorityBindingId: "authority-a",
          taskRequest: {},
          taskAuthorityCapability: {},
          repositoryRoot: root,
        },
      ],
      cancellationSignal: new AbortController().signal,
    },
  );
}

test("bounded partial replan supersedes the failed task and returns the queue to ready", async (t) => {
  const { root, input } = fixture(t);
  assert.equal(
    (await failTask(root)).reason,
    "project_runtime_replan_required",
  );
  const result = resolveProjectRuntimeReplan(input, () => ({
    disposition: "partial_replan",
    failedTaskId: "task-a",
    replacements: [
      {
        id: "task-b",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["result.txt"],
        conflictKeys: [],
      },
    ],
  }));
  assert.equal(result.status, "completed");
  const state = readProjectRuntimeState(root, "binding-a", "project-a");
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.deepEqual(
    state.status === "completed" &&
      state.value?.tasks.map((task) => [task.definition.id, task.state]),
    [
      ["task-a", "superseded"],
      ["task-b", "ready"],
    ],
  );
  assert.equal(queue.status === "completed" && queue.value.state, "queued");
});

test("maintaining the plan creates a fresh attempt and enforces the retry limit", async (t) => {
  const { root, input } = fixture(t);
  assert.equal(
    (await failTask(root)).reason,
    "project_runtime_replan_required",
  );
  const maintained = resolveProjectRuntimeReplan(
    { ...input, maximumReplans: 1 },
    () => ({
      disposition: "maintain_plan",
      reason: "transient provider failure",
    }),
  );
  assert.equal(maintained.reason, "project_runtime_same_plan_retry_ready");
  const beforeRetry = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(
    beforeRetry.status === "completed" &&
      beforeRetry.value?.tasks[0]?.retryCount,
    1,
  );
  assert.equal(
    (await failTask(root)).reason,
    "project_runtime_replan_required",
  );
  const exhausted = resolveProjectRuntimeReplan(
    { ...input, maximumReplans: 1 },
    () => ({
      disposition: "maintain_plan",
      reason: "another transient failure",
    }),
  );
  assert.equal(
    exhausted.reason,
    "project_runtime_retry_invalid_or_limit_exceeded",
  );
});

test("human decision capability is one-time, principal-bound and finalized after Project readback", async (t) => {
  const { root, input } = fixture(t);
  await failTask(root);
  const escalated = resolveProjectRuntimeReplan(input, () => ({
    disposition: "human_decision",
    objectiveId: "objective-a",
    reason: "scope choice required",
  }));
  assert.equal(escalated.reason, "project_runtime_human_decision_required");
  const records = new Map<string, ProjectRuntimeDecisionRecord>();
  const store = {
    create(record: ProjectRuntimeDecisionRecord) {
      if (records.has(record.recordId)) return { status: "blocked" };
      records.set(record.recordId, record);
      return { status: "completed", value: record };
    },
    read(recordId: string) {
      const value = records.get(recordId);
      return value ? { status: "completed", value } : { status: "blocked" };
    },
    compareAndSet(
      expected: ProjectRuntimeDecisionRecord,
      next: ProjectRuntimeDecisionRecord,
    ) {
      const current = records.get(expected.recordId);
      if (JSON.stringify(current) !== JSON.stringify(expected))
        return { status: "blocked" };
      records.set(expected.recordId, next);
      return { status: "completed", value: next };
    },
  };
  const common = { ...input, principalId: "principal-a", store };
  const state = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  if (state.status !== "completed" || !state.value) throw new Error("state");
  const issued = issueProjectRuntimeHumanDecision(common, {
    decisionId: "decision-a",
    repositoryRevision: revision,
    expectedGeneration: state.value.generation,
    allowedOptions: ["resume", "cancel"],
    lifetimeMs: 60_000,
    nowEpochMs: 1_000,
  });
  assert.equal(issued.status, "completed", JSON.stringify(issued));
  if (issued.status !== "completed") throw new Error("issue");
  const wrongPrincipal = submitProjectRuntimeHumanDecision(
    { ...common, principalId: "principal-b" },
    {
      decisionId: "decision-a",
      recordId: issued.recordId,
      repositoryRevision: revision,
      generation: state.value.generation,
      selectedOption: "resume",
      continuationCapability: issued.continuationCapability,
      nowEpochMs: 2_000,
    },
  );
  assert.equal(wrongPrincipal.status, "blocked");
  const applied = submitProjectRuntimeHumanDecision(common, {
    decisionId: "decision-a",
    recordId: issued.recordId,
    repositoryRevision: revision,
    generation: state.value.generation,
    selectedOption: "resume",
    continuationCapability: issued.continuationCapability,
    nowEpochMs: 2_000,
  });
  assert.equal(applied.status, "completed", JSON.stringify(applied));
  const replay = submitProjectRuntimeHumanDecision(common, {
    decisionId: "decision-a",
    recordId: issued.recordId,
    repositoryRevision: revision,
    generation: state.value.generation,
    selectedOption: "resume",
    continuationCapability: issued.continuationCapability,
    nowEpochMs: 2_000,
  });
  assert.equal(replay.reason, "project_runtime_decision_already_consumed");
  assert.equal(records.get(issued.recordId)?.disposition, "finalized");
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(
    queue.status === "completed" && queue.value.state,
    "replan_required",
  );
});

test("prepared human decision is reconciled from durable Project state without replaying authority", async (t) => {
  const { root, input } = fixture(t);
  await failTask(root);
  resolveProjectRuntimeReplan(input, () => ({
    disposition: "human_decision",
    objectiveId: "objective-a",
    reason: "scope choice required",
  }));
  const records = new Map<string, ProjectRuntimeDecisionRecord>();
  const store = {
    create(record: ProjectRuntimeDecisionRecord) {
      records.set(record.recordId, record);
      return { status: "completed", value: record };
    },
    read(recordId: string) {
      const value = records.get(recordId);
      return value ? { status: "completed", value } : { status: "blocked" };
    },
    compareAndSet(
      expected: ProjectRuntimeDecisionRecord,
      next: ProjectRuntimeDecisionRecord,
    ) {
      if (
        JSON.stringify(records.get(expected.recordId)) !==
        JSON.stringify(expected)
      )
        return { status: "blocked" };
      records.set(expected.recordId, next);
      return { status: "completed", value: next };
    },
  };
  const common = { ...input, principalId: "principal-a", store };
  const before = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(before.status, "completed");
  if (before.status !== "completed" || !before.value) throw new Error("state");
  const issued = issueProjectRuntimeHumanDecision(common, {
    decisionId: "decision-recovery",
    repositoryRevision: revision,
    expectedGeneration: before.value.generation,
    allowedOptions: ["resume"],
    lifetimeMs: 60_000,
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") throw new Error("issue");
  const pending = records.get(issued.recordId);
  assert.ok(pending);
  const applicationId = "decision-application-recovery";
  const prepared = Object.freeze({
    ...pending,
    disposition: "prepared" as const,
    applicationId,
    selectedOption: "resume" as const,
    newGeneration: before.value.generation + 1,
  });
  records.set(issued.recordId, prepared);
  const transitioned = applyProjectRuntimeHumanDecision(
    before.value,
    before.value.generation,
    "resume",
    applicationId,
  );
  assert.equal(transitioned.status, "completed");
  if (transitioned.status !== "completed" || !transitioned.state)
    throw new Error("transition");
  assert.equal(
    writeProjectRuntimeState(
      root,
      "binding-a",
      transitioned.state,
      before.value.generation,
    ).status,
    "completed",
  );
  const recovered = recoverProjectRuntimeHumanDecision(common, {
    recordId: issued.recordId,
  });
  assert.equal(recovered.status, "completed", JSON.stringify(recovered));
  assert.equal(records.get(issued.recordId)?.disposition, "finalized");
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(
    queue.status === "completed" && queue.value.state,
    "replan_required",
  );
});

test("explicit replacement invalidates the former capability before issuing one fresh capability", async (t) => {
  const { root, input } = fixture(t);
  await failTask(root);
  resolveProjectRuntimeReplan(input, () => ({
    disposition: "human_decision",
    objectiveId: "objective-a",
    reason: "scope choice required",
  }));
  const records = new Map<string, ProjectRuntimeDecisionRecord>();
  const store = {
    create(record: ProjectRuntimeDecisionRecord) {
      if (records.has(record.recordId)) return { status: "blocked" };
      records.set(record.recordId, record);
      return { status: "completed", value: record };
    },
    read(recordId: string) {
      return { status: "completed", value: records.get(recordId) ?? null };
    },
    compareAndSet(
      expected: ProjectRuntimeDecisionRecord,
      next: ProjectRuntimeDecisionRecord,
    ) {
      if (records.get(expected.recordId) !== expected)
        return { status: "blocked" };
      records.set(expected.recordId, next);
      return { status: "completed", value: next };
    },
  };
  const state = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  if (state.status !== "completed" || !state.value) throw new Error("state");
  const common = { ...input, principalId: "principal-a", store };
  const issued = issueProjectRuntimeHumanDecision(common, {
    decisionId: "decision-replace",
    repositoryRevision: revision,
    expectedGeneration: state.value.generation,
    allowedOptions: ["resume"],
    lifetimeMs: 60_000,
    nowEpochMs: 1_000,
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") throw new Error("issue");
  const replaced = replaceProjectRuntimeHumanDecision(common, {
    recordId: issued.recordId,
    replacementRequestId: "replacement-a",
    lifetimeMs: 60_000,
    nowEpochMs: 2_000,
  });
  assert.equal(replaced.status, "completed", JSON.stringify(replaced));
  if (replaced.status !== "completed") throw new Error("replace");
  assert.notEqual(
    replaced.continuationCapability,
    issued.continuationCapability,
  );
  const oldAttempt = submitProjectRuntimeHumanDecision(common, {
    decisionId: "decision-replace",
    recordId: issued.recordId,
    repositoryRevision: revision,
    generation: state.value.generation,
    selectedOption: "resume",
    continuationCapability: issued.continuationCapability,
    nowEpochMs: 3_000,
  });
  assert.equal(oldAttempt.status, "blocked");
  const currentAttempt = submitProjectRuntimeHumanDecision(common, {
    decisionId: "decision-replace",
    recordId: issued.recordId,
    repositoryRevision: revision,
    generation: state.value.generation,
    selectedOption: "resume",
    continuationCapability: replaced.continuationCapability,
    nowEpochMs: 3_000,
  });
  assert.equal(
    currentAttempt.status,
    "completed",
    JSON.stringify(currentAttempt),
  );
});

test("parent lifecycle invalidation requires a fresh changed generation", async (t) => {
  const { root, input } = fixture(t);
  const records = new Map<string, ProjectRuntimeDecisionRecord>();
  const store = {
    create(record: ProjectRuntimeDecisionRecord) {
      records.set(record.recordId, record);
      return { status: "completed", value: record };
    },
    read(recordId: string) {
      return { status: "completed", value: records.get(recordId) ?? null };
    },
    compareAndSet(
      expected: ProjectRuntimeDecisionRecord,
      next: ProjectRuntimeDecisionRecord,
    ) {
      if (records.get(expected.recordId) !== expected)
        return { status: "blocked" };
      records.set(expected.recordId, next);
      return { status: "completed", value: next };
    },
  };
  const before = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(before.status, "completed");
  if (before.status !== "completed" || !before.value) throw new Error("state");
  const common = { ...input, principalId: "principal-a", store };
  const issued = issueProjectRuntimeHumanDecision(common, {
    decisionId: "decision-invalidate",
    repositoryRevision: revision,
    expectedGeneration: before.value.generation,
    allowedOptions: ["cancel"],
    lifetimeMs: 60_000,
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") throw new Error("issue");
  assert.equal(
    invalidateProjectRuntimeHumanDecision(common, {
      recordId: issued.recordId,
      reason: "project_advanced",
    }).reason,
    "project_runtime_decision_invalidation_not_proven",
  );
  const advanced = Object.freeze({
    ...before.value,
    generation: before.value.generation + 1,
  });
  assert.equal(
    writeProjectRuntimeState(
      root,
      "binding-a",
      advanced,
      before.value.generation,
    ).status,
    "completed",
  );
  const invalidated = invalidateProjectRuntimeHumanDecision(common, {
    recordId: issued.recordId,
    reason: "project_advanced",
  });
  assert.equal(invalidated.status, "completed", JSON.stringify(invalidated));
  assert.equal(records.get(issued.recordId)?.disposition, "invalidated");
});

test("issuance and expiry uncertainty persist an exact independent recovery intent", async (t) => {
  const { root, input } = fixture(t);
  const recovery = new Map<string, ProjectRuntimeDecisionRecoveryIntent>();
  const recoveryStore = {
    create(intent: ProjectRuntimeDecisionRecoveryIntent) {
      recovery.set(intent.recoveryId, intent);
      return { status: "completed", value: intent };
    },
    read(recoveryId: string) {
      return {
        status: "completed",
        value: recovery.get(recoveryId) ?? null,
      };
    },
    compareAndSet() {
      return { status: "blocked" };
    },
  };
  const failedIssue = issueProjectRuntimeHumanDecision(
    {
      ...input,
      principalId: "principal-a",
      recoveryStore,
      store: {
        create: () => ({ status: "blocked" }),
        read: () => ({ status: "blocked" }),
        compareAndSet: () => ({ status: "blocked" }),
      },
    },
    {
      decisionId: "decision-issue-unknown",
      repositoryRevision: revision,
      expectedGeneration: 1,
      allowedOptions: ["resume"],
      lifetimeMs: 60_000,
      nowEpochMs: 1_000,
    },
  );
  assert.equal(
    failedIssue.reason,
    "project_runtime_decision_recovery_required",
  );
  assert.equal(
    "recoveryId" in failedIssue && typeof failedIssue.recoveryId,
    "string",
  );
  assert.equal(recovery.size, 1);

  const records = new Map<string, ProjectRuntimeDecisionRecord>();
  let failUpdate = false;
  const store = {
    create(record: ProjectRuntimeDecisionRecord) {
      records.set(record.recordId, record);
      return { status: "completed", value: record };
    },
    read(recordId: string) {
      return { status: "completed", value: records.get(recordId) ?? null };
    },
    compareAndSet(
      expected: ProjectRuntimeDecisionRecord,
      next: ProjectRuntimeDecisionRecord,
    ) {
      if (failUpdate || records.get(expected.recordId) !== expected)
        return { status: "blocked" };
      records.set(expected.recordId, next);
      return { status: "completed", value: next };
    },
  };
  const common = {
    ...input,
    principalId: "principal-a",
    store,
    recoveryStore,
  };
  const issued = issueProjectRuntimeHumanDecision(common, {
    decisionId: "decision-expiry-unknown",
    repositoryRevision: revision,
    expectedGeneration: 1,
    allowedOptions: ["cancel"],
    lifetimeMs: 1_000,
    nowEpochMs: 1_000,
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") throw new Error("issue");
  failUpdate = true;
  const expired = submitProjectRuntimeHumanDecision(common, {
    decisionId: "decision-expiry-unknown",
    recordId: issued.recordId,
    repositoryRevision: revision,
    generation: 1,
    selectedOption: "cancel",
    continuationCapability: issued.continuationCapability,
    nowEpochMs: 3_000,
  });
  assert.equal(expired.reason, "project_runtime_decision_recovery_required");
  assert.equal("recoveryId" in expired && typeof expired.recoveryId, "string");
  assert.equal(recovery.size, 2);
  assert.equal(fs.existsSync(path.join(root, ".crdd")), true);
});
