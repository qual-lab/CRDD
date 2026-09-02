import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  readProjectOperationQueueState,
  readProjectRuntimeState,
} from "../src/security/project-runtime-durable-foundation.ts";
import { runProjectRuntimeObjective } from "../src/security/project-runtime-objective-intake.ts";
import type { ProjectRuntimeSingleTaskResult } from "../src/security/project-runtime-single-task-adapter.ts";

const revision = "a".repeat(40);
function root(t: test.TestContext) {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-project-intake-"));
  execFileSync("git", ["init", "--quiet", value], { windowsHide: true });
  t.after(() => fs.rmSync(value, { recursive: true, force: true }));
  return value;
}
function request(overrides: Record<string, unknown> = {}) {
  return {
    requestId: "request-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    objective: "Create the result.",
    acceptanceCriteria: ["Result exists."],
    allowedPaths: ["result.txt"],
    readPaths: ["README.md"],
    maximumConcurrency: 1,
    maximumReplans: 1,
    originLane: "interactive",
    adoptResult: false,
    ...overrides,
  };
}
function completed(input: {
  attemptId: string;
  operationId: string;
  authorityBindingId: string;
  repositoryRevision: string;
}): ProjectRuntimeSingleTaskResult {
  return {
    contract: "crdd-coordinator/project-runtime-single-task-adapter",
    attemptId: input.attemptId,
    operationId: input.operationId,
    authorityBindingId: input.authorityBindingId,
    repositoryRevision: input.repositoryRevision,
    status: "completed",
    reason: "task_completed",
    effectState: "settled",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
    candidateId: "candidate-a",
    recoveryIds: [],
  };
}

test("public Objective intake binds, plans, executes and deduplicates the same request", async (t) => {
  const workingDirectory = root(t);
  let effects = 0;
  const dependencies = {
    verifyProjectBinding: () => ({
      status: "verified",
      repositoryBindingId: "binding-a",
      repositoryRevision: revision,
      workingDirectory,
      repositoryRoot: workingDirectory,
      bindingCapability: {},
    }),
    planObjective: () => ({
      milestoneAcceptanceCriteria: ["Result exists."],
      objectives: [
        { id: "objective-a", acceptanceCriteria: ["Result exists."] },
      ],
      tasks: [
        {
          id: "task-a",
          objectiveId: "objective-a",
          dependencies: [],
          allowedPaths: ["result.txt"],
          conflictKeys: ["result.txt"],
        },
      ],
    }),
    createTaskExecutions: () => [
      {
        taskId: "task-a",
        authorityBindingId: "authority-a",
        taskRequest: {},
        taskAuthorityCapability: {},
        repositoryRoot: workingDirectory,
      },
    ],
    observeLeaseOwner: () => ({ status: "absent" }),
    execution: {
      runSingleTaskAttempt: async (input: Parameters<typeof completed>[0]) => {
        effects += 1;
        return completed(input);
      },
    },
  };
  const first = await runProjectRuntimeObjective(
    dependencies,
    request(),
    new AbortController().signal,
  );
  assert.equal(first.status, "completed");
  assert.equal(first.projection?.nextAction, "verify_objective_integration");
  assert.equal(effects, 1);
  const second = await runProjectRuntimeObjective(
    dependencies,
    request(),
    new AbortController().signal,
  );
  assert.equal(second.status, "completed");
  assert.equal(effects, 1);
  const state = readProjectRuntimeState(
    workingDirectory,
    "binding-a",
    "project-a",
  );
  const queue = readProjectOperationQueueState(
    workingDirectory,
    "binding-a",
    first.queueId ?? "invalid",
  );
  assert.equal(
    state.status === "completed" && state.value?.tasks[0]?.state,
    "completed",
  );
  assert.equal(
    queue.status === "completed" && queue.value.state,
    "integration_pending",
  );
});

test("binding or planner scope failure creates no Project State or Task effect", async (t) => {
  const workingDirectory = root(t);
  let effects = 0;
  const base = {
    verifyProjectBinding: () => ({
      status: "verified",
      repositoryBindingId: "binding-a",
      repositoryRevision: revision,
      workingDirectory,
      repositoryRoot: workingDirectory,
      bindingCapability: {},
    }),
    planObjective: () => ({
      milestoneAcceptanceCriteria: ["Result exists."],
      objectives: [
        { id: "objective-a", acceptanceCriteria: ["Result exists."] },
      ],
      tasks: [
        {
          id: "task-a",
          objectiveId: "objective-a",
          dependencies: [],
          allowedPaths: ["outside.txt"],
          conflictKeys: [],
        },
      ],
    }),
    createTaskExecutions: () => [
      {
        taskId: "task-a",
        authorityBindingId: "authority-a",
        taskRequest: {},
        taskAuthorityCapability: {},
        repositoryRoot: workingDirectory,
      },
    ],
    observeLeaseOwner: () => ({ status: "absent" }),
    execution: {
      runSingleTaskAttempt: async () => {
        effects += 1;
        throw new Error("not_expected");
      },
    },
  };
  const result = await runProjectRuntimeObjective(
    base,
    request(),
    new AbortController().signal,
  );
  assert.equal(result.reason, "project_runtime_plan_invalid_or_out_of_scope");
  assert.equal(effects, 0);
  const state = readProjectRuntimeState(
    workingDirectory,
    "binding-a",
    "project-a",
  );
  assert.equal(state.status === "completed" && state.value, null);
});

test("public Objective intake rejects unknown fields, accessors, proxies, and non-closed planner output before effect", async (t) => {
  const workingDirectory = root(t);
  let bindingCalls = 0;
  let taskEffects = 0;
  const dependencies = {
    verifyProjectBinding: () => {
      bindingCalls += 1;
      return {
        status: "verified",
        repositoryBindingId: "binding-a",
        repositoryRevision: revision,
        workingDirectory,
        repositoryRoot: workingDirectory,
        bindingCapability: {},
      };
    },
    planObjective: () => ({
      milestoneAcceptanceCriteria: ["Result exists."],
      objectives: [
        { id: "objective-a", acceptanceCriteria: ["Result exists."] },
      ],
      tasks: [
        {
          id: "task-a",
          objectiveId: "objective-a",
          dependencies: [],
          allowedPaths: ["result.txt"],
          conflictKeys: ["result.txt"],
        },
      ],
      unknown: true,
    }),
    createTaskExecutions: () => [],
    observeLeaseOwner: () => ({ status: "absent" }),
    execution: {
      runSingleTaskAttempt: async () => {
        taskEffects += 1;
        throw new Error("not_expected");
      },
    },
  };

  const unknownField = await runProjectRuntimeObjective(
    dependencies,
    request({ unknown: true }),
    new AbortController().signal,
  );
  assert.equal(
    unknownField.reason,
    "project_runtime_objective_request_invalid",
  );

  const getterRequest = request();
  Object.defineProperty(getterRequest, "objective", {
    enumerable: true,
    get: () => "Create the result.",
  });
  const accessor = await runProjectRuntimeObjective(
    dependencies,
    getterRequest,
    new AbortController().signal,
  );
  assert.equal(accessor.reason, "project_runtime_objective_request_invalid");

  let proxyTrapCount = 0;
  const proxy = await runProjectRuntimeObjective(
    dependencies,
    new Proxy(request(), {
      get() {
        proxyTrapCount += 1;
        throw new Error("must_not_execute");
      },
      ownKeys() {
        proxyTrapCount += 1;
        throw new Error("must_not_execute");
      },
    }),
    new AbortController().signal,
  );
  assert.equal(proxy.reason, "project_runtime_objective_request_invalid");
  assert.equal(proxyTrapCount, 0);
  assert.equal(bindingCalls, 0);

  const planner = await runProjectRuntimeObjective(
    dependencies,
    request(),
    new AbortController().signal,
  );
  assert.equal(planner.reason, "project_runtime_plan_invalid_or_out_of_scope");
  assert.equal(bindingCalls, 1);
  assert.equal(taskEffects, 0);
  const state = readProjectRuntimeState(
    workingDirectory,
    "binding-a",
    "project-a",
  );
  assert.equal(state.status === "completed" && state.value, null);
});
