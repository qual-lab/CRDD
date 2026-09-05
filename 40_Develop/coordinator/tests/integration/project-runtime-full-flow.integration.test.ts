import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readProjectRuntimeState } from "../../src/security/project-runtime-durable-foundation.ts";
import {
  issueProjectRuntimeHumanDecision,
  submitProjectRuntimeHumanDecision,
} from "../../src/security/project-runtime-human-decision.ts";
import type { ProjectRuntimeDecisionRecord } from "../../../project-runtime/src/index.ts";
import { integrateProjectRuntimeOperation } from "../../src/security/project-runtime-integration.ts";
import { runProjectRuntimeObjective } from "../../src/security/project-runtime-objective-intake.ts";
import { resolveProjectRuntimeReplan } from "../../src/security/project-runtime-replanning.ts";

const revision = "a".repeat(40);

function fixture(t: test.TestContext) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-project-full-flow-"),
  );
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const request = Object.freeze({
    requestId: "request-full",
    projectId: "project-full",
    milestoneId: "milestone-full",
    repositoryRevision: revision,
    objective: "Create the bounded result.",
    acceptanceCriteria: Object.freeze(["result accepted"]),
    allowedPaths: Object.freeze(["result.txt"]),
    readPaths: Object.freeze(["README.md"]),
    maximumConcurrency: 1,
    maximumReplans: 2,
    originLane: "interactive" as const,
    adoptResult: false,
  });
  let attempts = 0;
  const dependencies = {
    authenticatedPrincipalId: "principal-full",
    verifyProjectBinding: () => ({
      status: "verified",
      repositoryBindingId: "binding-full",
      repositoryRevision: revision,
      workingDirectory: root,
      repositoryRoot: root,
      bindingCapability: {},
    }),
    planObjective: () => ({
      milestoneAcceptanceCriteria: ["milestone accepted"],
      objectives: [
        { id: "objective-full", acceptanceCriteria: ["result accepted"] },
      ],
      tasks: [
        {
          id: "task-full",
          objectiveId: "objective-full",
          dependencies: [],
          allowedPaths: ["result.txt"],
          conflictKeys: ["result.txt"],
        },
      ],
    }),
    createTaskExecutions: (
      _request: unknown,
      _binding: unknown,
      state: {
        tasks: readonly {
          definition: { id: string };
          state: string;
          retryCount: number;
        }[];
      },
    ) =>
      state.tasks
        .filter((task) => task.state !== "superseded")
        .map((task) => ({
          taskId: task.definition.id,
          authorityBindingId: `authority-${task.retryCount}`,
          taskRequest: {},
          taskAuthorityCapability: {},
          repositoryRoot: root,
        })),
    observeLeaseOwner: () => ({ status: "absent" }),
    execution: {
      runSingleTaskAttempt: async (input: {
        attemptId: string;
        operationId: string;
        authorityBindingId: string;
        repositoryRevision: string;
        observeStarted?: () => Promise<boolean>;
      }) => {
        assert.equal(await input.observeStarted?.(), true);
        attempts += 1;
        const isSuccessful = attempts > 1;
        return {
          contract:
            "crdd-coordinator/project-runtime-single-task-adapter" as const,
          attemptId: input.attemptId,
          operationId: input.operationId,
          authorityBindingId: input.authorityBindingId,
          repositoryRevision: input.repositoryRevision,
          status: isSuccessful ? ("completed" as const) : ("blocked" as const),
          reason: isSuccessful ? "task_completed" : "transient_failure",
          effectState: "settled" as const,
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          processRestartRequired: false,
          candidateId: isSuccessful ? "candidate-full" : null,
          recoveryIds: Object.freeze([]),
        };
      },
    },
  };
  return {
    root,
    request,
    dependencies,
    get attempts() {
      return attempts;
    },
  };
}

test("public intake, bounded retry, progress and integration form one accepted flow", async (t) => {
  const context = fixture(t);
  const first = await runProjectRuntimeObjective(
    context.dependencies,
    context.request,
    new AbortController().signal,
  );
  assert.equal(first.reason, "project_runtime_replan_required");
  assert.equal(first.projection?.qualityState, "blocked");
  const replanned = resolveProjectRuntimeReplan(
    {
      workingDirectory: context.root,
      repositoryBindingId: "binding-full",
      projectId: context.request.projectId,
      milestoneId: context.request.milestoneId,
      queueId: first.queueId ?? "invalid",
      maximumReplans: context.request.maximumReplans,
    },
    () => ({ disposition: "maintain_plan", reason: "transient failure" }),
  );
  assert.equal(replanned.status, "completed");
  const second = await runProjectRuntimeObjective(
    context.dependencies,
    context.request,
    new AbortController().signal,
  );
  assert.equal(
    second.reason,
    "project_runtime_tasks_completed_integration_pending",
  );
  assert.equal(context.attempts, 2);
  const integrated = await integrateProjectRuntimeOperation(
    {
      createCandidate: async () => ({
        status: "candidate",
        candidateId: "integrated-full",
        candidateHash: "b".repeat(64),
        baseRevision: revision,
        changedPaths: ["result.txt"],
        objectiveEvidence: { "objective-full": ["evidence-objective"] },
        milestoneEvidence: ["evidence-milestone"],
        conflicts: [],
        cleanupConfirmed: true,
      }),
      observeCanonicalRepository: () => ({
        status: "observed",
        repositoryRevision: revision,
        dirty: false,
        observedPaths: ["result.txt"],
      }),
      adoptCandidate: async () => {
        throw new Error("adoption_not_authorized");
      },
    },
    {
      workingDirectory: context.root,
      repositoryBindingId: "binding-full",
      projectId: context.request.projectId,
      milestoneId: context.request.milestoneId,
      queueId: first.queueId ?? "invalid",
      allowedPaths: context.request.allowedPaths,
      adoptionAuthorized: false,
    },
  );
  assert.equal(integrated.reason, "project_runtime_milestone_accepted");
  const finalState = readProjectRuntimeState(
    context.root,
    "binding-full",
    context.request.projectId,
  );
  assert.equal(
    finalState.status === "completed" && finalState.value?.milestone.state,
    "accepted",
  );
});

test("human decision is one-time and resumes only through a fresh bounded plan", async (t) => {
  const context = fixture(t);
  const first = await runProjectRuntimeObjective(
    context.dependencies,
    context.request,
    new AbortController().signal,
  );
  const input = {
    workingDirectory: context.root,
    repositoryBindingId: "binding-full",
    projectId: context.request.projectId,
    milestoneId: context.request.milestoneId,
    queueId: first.queueId ?? "invalid",
    maximumReplans: context.request.maximumReplans,
  };
  const escalated = resolveProjectRuntimeReplan(input, () => ({
    disposition: "human_decision",
    objectiveId: "objective-full",
    reason: "human choice required",
  }));
  assert.equal(escalated.reason, "project_runtime_human_decision_required");
  const state = readProjectRuntimeState(
    context.root,
    "binding-full",
    context.request.projectId,
  );
  assert.equal(state.status, "completed");
  if (state.status !== "completed" || !state.value)
    throw new Error("state missing");
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
      if (records.get(expected.recordId) !== expected)
        return { status: "blocked" };
      records.set(expected.recordId, next);
      return { status: "completed", value: next };
    },
  };
  const commonFields = { ...input, principalId: "principal-full", store };
  const issued = issueProjectRuntimeHumanDecision(commonFields, {
    decisionId: "decision-full",
    repositoryRevision: revision,
    expectedGeneration: state.value.generation,
    allowedOptions: ["resume"],
    lifetimeMs: 60_000,
    nowEpochMs: 1_000,
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") throw new Error("decision not issued");
  const applied = submitProjectRuntimeHumanDecision(commonFields, {
    decisionId: "decision-full",
    recordId: issued.recordId,
    repositoryRevision: revision,
    generation: state.value.generation,
    selectedOption: "resume",
    continuationCapability: issued.continuationCapability,
    nowEpochMs: 2_000,
  });
  assert.equal(applied.status, "completed");
  const resumed = resolveProjectRuntimeReplan(input, () => ({
    disposition: "maintain_plan",
    reason: "human authorized retry",
  }));
  assert.equal(resumed.status, "completed");
  const completed = await runProjectRuntimeObjective(
    context.dependencies,
    context.request,
    new AbortController().signal,
  );
  assert.equal(
    completed.reason,
    "project_runtime_tasks_completed_integration_pending",
  );
});
