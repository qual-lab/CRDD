import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createDockerRestartContinuationRecord,
  parseDockerRestartContinuationRecord,
  validateDockerRestartContinuationChain,
} from "../../src/security/docker-restart-continuation-record.ts";
import { createDockerRestartRecord } from "../../src/security/docker-restart-record.ts";

const hash = "a".repeat(64);
const binding = {
  recoveryId: `docker-task.${hash}.${hash}.${hash}`,
  operationNonce: hash,
  runtimeExecutionIdentitySha256: hash,
  localUserBindingHash: hash,
  runtimeStateIdentityHash: hash,
  runtimeStateProtectionHash: hash,
  stableLogicalHomeBindingHash: hash,
  pendingSubmissionSha256: hash,
};
test("continuation binds exact handoff and preserves phase predecessor contract", () => {
  const handoff = Buffer.from("test history bytes");
  const tip = createHash("sha256").update(handoff).digest("hex");
  const first = createDockerRestartRecord(binding, "stop_intent");
  const second = createDockerRestartRecord(binding, "stopped", first);
  const records = [first, second].map((bytes) =>
    createDockerRestartContinuationRecord(bytes, tip),
  );
  assert.equal(
    validateDockerRestartContinuationChain(records, binding, handoff)?.length,
    2,
  );
  assert.equal(
    validateDockerRestartContinuationChain(
      records,
      binding,
      Buffer.from("other"),
    ),
    null,
  );
  assert.equal(
    validateDockerRestartContinuationChain(
      [records[1] as Buffer],
      binding,
      handoff,
    ),
    null,
  );
  assert.equal(
    validateDockerRestartContinuationChain(
      [records[0] as Buffer, records[0] as Buffer],
      binding,
      handoff,
    ),
    null,
  );
  for (const bytes of [
    Buffer.from("null"),
    Buffer.alloc(8193),
    Buffer.from([255]),
    Buffer.concat([records[0] as Buffer, Buffer.from("\n")]),
  ])
    assert.equal(parseDockerRestartContinuationRecord(bytes), null);
});
