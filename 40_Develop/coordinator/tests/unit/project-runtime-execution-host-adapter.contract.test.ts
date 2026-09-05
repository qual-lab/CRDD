import assert from "node:assert/strict";
import test from "node:test";

import { inspectRuntimeProcessRecoveryIdentity } from "../../src/core/runtime-process-safety-state.ts";
import { createProjectRuntimeExecutionHostPorts } from "../../src/security/project-runtime-execution-host-adapter.ts";

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
  assert.deepEqual(
    inspectRuntimeProcessRecoveryIdentity(
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
