import assert from "node:assert/strict";
import test from "node:test";
import {
  createDockerRestartRecord,
  DOCKER_RESTART_PHASES,
  type DockerRestartBinding,
  parseDockerRestartRecord,
  validateDockerRestartRecordChain,
} from "../../src/security/docker-restart-record.ts";

const hash = "a".repeat(64);
const binding: DockerRestartBinding = {
  recoveryId: `docker-task.${hash}.${hash}.${hash}`,
  operationNonce: hash,
  runtimeExecutionIdentitySha256: hash,
  localUserBindingHash: hash,
  runtimeStateIdentityHash: hash,
  runtimeStateProtectionHash: hash,
  stableLogicalHomeBindingHash: hash,
  pendingSubmissionSha256: hash,
};
function chain() {
  const records: Buffer[] = [];
  for (const phase of DOCKER_RESTART_PHASES)
    records.push(createDockerRestartRecord(binding, phase, records.at(-1)));
  return records;
}
test("canonical restart records validate every complete prefix without granting authority", () => {
  const records = chain();
  for (let length = 1; length <= records.length; length++)
    assert.equal(
      validateDockerRestartRecordChain(records.slice(0, length), binding)
        ?.length,
      length,
    );
  assert.equal(
    parseDockerRestartRecord(records[4] as Buffer)?.phase,
    "settled",
  );
});
test("closed record rejects malformed, noncanonical and unbounded bytes", () => {
  const first = chain()[0] as Buffer;
  for (const bytes of [
    Buffer.alloc(0),
    Buffer.alloc(65_537),
    Buffer.from("{}\n"),
    Buffer.from("[]\n"),
    Buffer.from([255]),
    first.subarray(0, first.length - 1),
    Buffer.concat([first, Buffer.from("\n")]),
    Buffer.from(first.toString().replace('"sequence":0', '"sequence": 0')),
  ])
    assert.equal(parseDockerRestartRecord(bytes), null);
  const value = JSON.parse(first.toString());
  for (const key of Object.keys(value)) {
    const altered = { ...value };
    delete altered[key];
    assert.equal(
      parseDockerRestartRecord(Buffer.from(`${JSON.stringify(altered)}\n`)),
      null,
    );
  }
  assert.equal(
    parseDockerRestartRecord(
      Buffer.from(`${JSON.stringify({ ...value, extra: true })}\n`),
    ),
    null,
  );
});
test("record rejects all changed field types and malformed hashes", () => {
  const value = JSON.parse((chain()[0] as Buffer).toString());
  for (const key of Object.keys(value))
    assert.equal(
      parseDockerRestartRecord(
        Buffer.from(`${JSON.stringify({ ...value, [key]: [] })}\n`),
      ),
      null,
    );
  for (const key of Object.keys(binding).filter((key) => key !== "recoveryId"))
    assert.throws(() =>
      createDockerRestartRecord(
        { ...binding, [key]: "A".repeat(64) },
        "stop_intent",
      ),
    );
  assert.throws(() =>
    createDockerRestartRecord(
      { ...binding, operationNonce: "b".repeat(64) },
      "stop_intent",
    ),
  );
});
test("chain rejects missing, duplicate, reordered, foreign and digest-modified records", () => {
  const records = chain();
  assert.equal(validateDockerRestartRecordChain([], binding), null);
  assert.equal(
    validateDockerRestartRecordChain(records.slice(1), binding),
    null,
  );
  assert.equal(
    validateDockerRestartRecordChain(
      [records[0] as Buffer, records[0] as Buffer],
      binding,
    ),
    null,
  );
  assert.equal(
    validateDockerRestartRecordChain([...records].reverse(), binding),
    null,
  );
  assert.equal(
    validateDockerRestartRecordChain(records, {
      ...binding,
      pendingSubmissionSha256: "b".repeat(64),
    }),
    null,
  );
  const wrongDigest = Buffer.from(
    (records[1] as Buffer)
      .toString()
      .replace(
        /"previousRecordSha256":"[a-f0-9]{64}"/u,
        `"previousRecordSha256":"${hash}"`,
      ),
  );
  assert.notEqual(parseDockerRestartRecord(wrongDigest), null);
  assert.equal(
    validateDockerRestartRecordChain(
      [records[0] as Buffer, wrongDigest],
      binding,
    ),
    null,
  );
});
test("generation cannot skip a phase or mix bindings", () => {
  const records = chain();
  assert.throws(() => createDockerRestartRecord(binding, "ready", records[0]));
  assert.throws(() => createDockerRestartRecord(binding, "stopped"));
  assert.throws(() =>
    createDockerRestartRecord(binding, "stop_intent", records[0]),
  );
  assert.throws(() =>
    createDockerRestartRecord(
      { ...binding, localUserBindingHash: "b".repeat(64) },
      "stopped",
      records[0],
    ),
  );
});
