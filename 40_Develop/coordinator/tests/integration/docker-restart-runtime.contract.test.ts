import assert from "node:assert/strict";
import test from "node:test";
import { restartRuntimeOwnedDockerForRecovery } from "../../src/security/docker-restart-runtime.ts";

test("signed restart entry rejects cancellation before preparation", async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await restartRuntimeOwnedDockerForRecovery(
    "not-a-recovery-id",
    controller.signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_restart_cancelled");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.restartCompleted, false);
  assert.equal(result.taskRecoveryCompleted, false);
});

test("signed restart entry rejects invalid recovery identity before native acquisition", async () => {
  const result = await restartRuntimeOwnedDockerForRecovery(
    "not-a-recovery-id",
    new AbortController().signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_restart_id_invalid");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.restartCompleted, false);
  assert.equal(result.taskRecoveryCompleted, false);
});
