import assert from "node:assert/strict";
import test from "node:test";

import { createProjectRuntimeExecutionHostPorts } from "../../src/security/project-runtime-execution-host-adapter.ts";
import { createProjectRuntimeTaskRecoveryAdapter } from "../../src/security/project-runtime-task-recovery-adapter.ts";

test("Host Adapterは時刻と安定IdentityをProject Runtime Portへ閉じる", () => {
  const reading = Object.freeze({
    monotonicMs: 12_345,
    iso: "2026-09-06T00:00:00.000Z",
  });
  const ports = createProjectRuntimeExecutionHostPorts({ now: () => reading });

  assert.equal(ports.clockIdentity.now(), reading);
  assert.equal(
    ports.clockIdentity.createStableId("attempt", ["project", "task", "1"]),
    ports.clockIdentity.createStableId("attempt", ["project", "task", "1"]),
  );
  assert.notEqual(
    ports.clockIdentity.createStableId("attempt", ["project", "task", "1"]),
    ports.clockIdentity.createStableId("attempt", ["project", "task", "2"]),
  );
  assert.match(
    ports.clockIdentity.createStableId("attempt", ["project", "task", "1"]),
    /^attempt-[0-9a-f]{40}$/u,
  );
  assert.match(
    ports.clockIdentity.createContentHash("content"),
    /^[0-9a-f]{64}$/u,
  );
  assert.notEqual(
    ports.clockIdentity.createContentHash("content"),
    ports.clockIdentity.createContentHash("changed"),
  );
});

test("Host AdapterはProcess Recovery Identityと再利用禁止通知をProject Runtimeから分離する", () => {
  let poisonCount = 0;
  const ports = createProjectRuntimeExecutionHostPorts({
    poisonAfterCleanupUnknown: () => {
      poisonCount += 1;
    },
  });

  const recoveryId = ports.processSafety.createRecoveryIdentity(
    "attempt-12345678",
    "operation-12345678",
  );
  assert.match(
    ports.processSafety.getProcessInstanceIdentity(),
    /^[0-9a-f-]{36}$/u,
  );
  assert.deepEqual(
    ports.processSafety.inspectRecoveryIdentity(
      recoveryId,
      "attempt-12345678",
      "operation-12345678",
    ),
    {
      processIdentity: recoveryId.split(".")[1],
      recoveryId,
    },
  );

  ports.processSafety.poisonAfterCleanupUnknown();
  assert.equal(poisonCount, 1);
});

test("Task Recovery AdapterはRepository情報を閉じて意味IdentityだけをProject Runtimeへ公開する", async () => {
  const calls: unknown[] = [];
  const port = createProjectRuntimeTaskRecoveryAdapter(
    "C:\\verified-repository",
    "binding-1",
    {
      acknowledgeTaskRecovery: (input) => {
        calls.push(input);
        return { status: "completed" };
      },
      observeRecoveryTransition: () => {
        throw new Error("diagnostic_unavailable");
      },
    },
  );
  const identity = Object.freeze({
    projectId: "project-1",
    milestoneId: "milestone-1",
    stateGeneration: 2,
    taskId: "task-1",
    attemptId: "attempt-1",
    operationId: "operation-1",
    kind: "docker" as const,
    recoveryId: "recovery-1",
  });

  assert.deepEqual(port.acknowledgeDocker(identity), { status: "completed" });
  assert.deepEqual(calls, [
    {
      workingDirectory: "C:\\verified-repository",
      repositoryBindingId: "binding-1",
      ...identity,
    },
  ]);
  await assert.doesNotReject(async () => {
    await port.observeTransition({
      phase: "required",
      projectId: "project-1",
      milestoneId: "milestone-1",
      queueId: "queue-1",
      taskId: "task-1",
      operationId: "operation-1",
      recoveryId: "recovery-1",
      stateGeneration: 2,
    });
  });
});
