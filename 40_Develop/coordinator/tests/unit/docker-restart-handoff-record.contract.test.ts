import assert from "node:assert/strict";
import test from "node:test";
import {
  createDockerRestartHandoffRecord,
  parseDockerRestartHandoffRecord,
  validateDockerRestartHandoffChain,
} from "../../src/security/docker-restart-handoff-record.ts";
import {
  createDockerRestartRecord,
  type DockerRestartBinding,
  dockerRestartPhases,
} from "../../src/security/docker-restart-record.ts";

const h = (n: number) => n.toString(16).padStart(64, "0");
const binding: DockerRestartBinding = {
  recoveryId: `docker-task.${h(1)}.${h(1)}.${h(1)}`,
  operationNonce: h(1),
  runtimeExecutionIdentitySha256: h(1),
  localUserBindingHash: h(1),
  runtimeStateIdentityHash: h(1),
  runtimeStateProtectionHash: h(1),
  stableLogicalHomeBindingHash: h(1),
  pendingSubmissionSha256: h(1),
};
const originRecords = [createDockerRestartRecord(binding, "stop_intent")];
test("partial v1 history can be linked without changing its bytes or issuing authority", () => {
  const saved = Buffer.from(originRecords[0] as Buffer);
  const first = createDockerRestartHandoffRecord(
    originRecords,
    binding,
    [],
    h(2),
  );
  const second = createDockerRestartHandoffRecord(
    originRecords,
    binding,
    [first],
    h(3),
  );
  assert.equal(
    validateDockerRestartHandoffChain(
      originRecords,
      binding,
      [first, second],
      h(3),
    )?.length,
    2,
  );
  assert.deepEqual(originRecords[0], saved);
  assert.equal(
    Object.hasOwn(parseDockerRestartHandoffRecord(first) ?? {}, "authority"),
    false,
  );
});
test("closed canonical codec rejects malformed values and unsupported revision", () => {
  const first = createDockerRestartHandoffRecord(
    originRecords,
    binding,
    [],
    h(2),
  );
  for (const bytes of [
    Buffer.alloc(0),
    Buffer.alloc(4097),
    Buffer.from([255]),
    Buffer.from("null"),
    Buffer.from("[]"),
    Buffer.concat([first, Buffer.from("\n")]),
  ])
    assert.equal(parseDockerRestartHandoffRecord(bytes), null);
  for (const [key, value] of [
    ["originRecordRevision", 2],
    ["sequence", 8],
    ["sequence", -1],
    ["sequence", 0.5],
    ["toRuntimeIdentitySha256", "bad"],
    ["extra", true],
    ["previousHandoffSha256", h(9)],
  ] as const) {
    const record = JSON.parse(first.toString());
    record[key] = value;
    assert.equal(
      parseDockerRestartHandoffRecord(
        Buffer.from(`${JSON.stringify(record)}\n`),
      ),
      null,
    );
  }
});
test("exact originRecords, tip, current identity and every target binding field are required", () => {
  const first = createDockerRestartHandoffRecord(
    originRecords,
    binding,
    [],
    h(2),
  );
  for (const key of Object.keys(binding) as (keyof DockerRestartBinding)[]) {
    assert.equal(
      validateDockerRestartHandoffChain(
        originRecords,
        { ...binding, [key]: h(9) },
        [first],
        h(2),
      ),
      null,
    );
  }
  assert.equal(
    validateDockerRestartHandoffChain(originRecords, binding, [first], h(3)),
    null,
  );
  const extendedRecords = [
    ...originRecords,
    createDockerRestartRecord(binding, "stopped", originRecords[0]),
  ];
  assert.equal(
    validateDockerRestartHandoffChain(extendedRecords, binding, [first], h(2)),
    null,
  );
  assert.equal(
    validateDockerRestartHandoffChain([], binding, [first], h(2)),
    null,
  );
});
test("duplicates, branches, gaps and cyclic runtime adoption are rejected", () => {
  const a = createDockerRestartHandoffRecord(originRecords, binding, [], h(2));
  const b = createDockerRestartHandoffRecord(originRecords, binding, [a], h(3));
  const branch = createDockerRestartHandoffRecord(
    originRecords,
    binding,
    [],
    h(4),
  );
  for (const records of [[a, a], [b], [branch, b], [b, a]])
    assert.equal(
      validateDockerRestartHandoffChain(originRecords, binding, records, h(3)),
      null,
    );
  assert.throws(() =>
    createDockerRestartHandoffRecord(originRecords, binding, [a, b], h(1)),
  );
  assert.throws(() =>
    createDockerRestartHandoffRecord(originRecords, binding, [a], h(2)),
  );
  assert.throws(() =>
    createDockerRestartHandoffRecord(originRecords, binding, [a, a], h(3)),
  );
});
test("eight handoffs are bounded and completed originRecords uses no partial handoff", () => {
  const records: Buffer[] = [];
  for (let n = 2; n <= 9; n++)
    records.push(
      createDockerRestartHandoffRecord(originRecords, binding, records, h(n)),
    );
  assert.equal(
    validateDockerRestartHandoffChain(originRecords, binding, records, h(9))
      ?.length,
    8,
  );
  assert.throws(() =>
    createDockerRestartHandoffRecord(originRecords, binding, records, h(10)),
  );
  assert.equal(
    validateDockerRestartHandoffChain(
      originRecords,
      binding,
      [...records, records[7] as Buffer],
      h(9),
    ),
    null,
  );
  const completeRecords: Buffer[] = [];
  for (const phase of dockerRestartPhases)
    completeRecords.push(
      createDockerRestartRecord(binding, phase, completeRecords.at(-1)),
    );
  assert.throws(() =>
    createDockerRestartHandoffRecord(completeRecords, binding, [], h(2)),
  );
});
