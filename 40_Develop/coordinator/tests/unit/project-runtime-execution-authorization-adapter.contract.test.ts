import assert from "node:assert/strict";
import test from "node:test";

import { createProjectRuntimeExecutionAuthorizationAdapter } from "../../src/security/project-runtime-execution-authorization-adapter.ts";

const request = Object.freeze({
  projectId: "project-a",
  milestoneId: "milestone-a",
  taskId: "task-a",
  attemptId: "attempt-a",
  operationId: "operation-a",
  authorityBindingId: "authority-a",
  repositoryRevision: "a".repeat(40),
});

test("実行許可AdapterはRuntime package capabilityをTask Authorityと混同せず一回の発行へ閉じる", () => {
  const capability = Object.freeze({});
  let issueCount = 0;
  const adapter = createProjectRuntimeExecutionAuthorizationAdapter({
    issueRuntimeCapability: () => {
      issueCount += 1;
      return capability;
    },
    revokeRuntimeCapability: (candidate) => candidate === capability,
  });

  const issued = adapter.issue(request);
  assert.equal(issued.status, "completed");
  assert.equal(issued.value, capability);
  assert.equal(issueCount, 1);
  assert.deepEqual(adapter.revokeUnused(capability), {
    status: "completed",
    reason: "project_runtime_execution_authorization_revoked",
    value: null,
  });
});

test("不正な相関・発行失敗・失効不明は閉じた結果となり例外を漏らさない", () => {
  let issueCount = 0;
  const invalid = createProjectRuntimeExecutionAuthorizationAdapter({
    issueRuntimeCapability: () => {
      issueCount += 1;
      return Object.freeze({});
    },
  }).issue({ ...request, repositoryRevision: "invalid" });
  assert.equal(invalid.status, "blocked");
  assert.equal(issueCount, 0);

  const hostile = new Proxy(request, {
    get() {
      throw new Error("hostile getter");
    },
  });
  const hostileResult = createProjectRuntimeExecutionAuthorizationAdapter({
    issueRuntimeCapability: () => {
      issueCount += 1;
      return Object.freeze({});
    },
  }).issue(hostile);
  assert.equal(hostileResult.status, "blocked");
  if (hostileResult.status !== "blocked") throw new Error("test setup");
  assert.equal(hostileResult.manualRecoveryRequired, false);
  assert.equal(issueCount, 0);

  const throwing = createProjectRuntimeExecutionAuthorizationAdapter({
    issueRuntimeCapability: () => {
      throw new Error("unobservable");
    },
    revokeRuntimeCapability: () => {
      throw new Error("unobservable");
    },
  });
  const issue = throwing.issue(request);
  assert.equal(issue.status, "blocked");
  assert.equal(issue.manualRecoveryRequired, true);
  const revoke = throwing.revokeUnused(Object.freeze({}));
  assert.equal(revoke.status, "blocked");
  assert.equal(revoke.manualRecoveryRequired, true);

  const absent = createProjectRuntimeExecutionAuthorizationAdapter({
    issueRuntimeCapability: () => null,
  });
  const absentIssue = absent.issue(request);
  assert.equal(absentIssue.status, "blocked");
  if (absentIssue.status !== "blocked") throw new Error("test setup");
  assert.equal(absentIssue.manualRecoveryRequired, false);
  const absentRevoke = absent.revokeUnused(Object.freeze({}));
  assert.equal(absentRevoke.status, "blocked");
  if (absentRevoke.status !== "blocked") throw new Error("test setup");
  assert.equal(absentRevoke.manualRecoveryRequired, true);
});
