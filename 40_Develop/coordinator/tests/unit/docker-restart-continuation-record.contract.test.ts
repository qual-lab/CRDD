import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createDockerRestartContinuationRecord,
  parseDockerRestartContinuationRecord,
  validateDockerRestartContinuationChain,
  resolveDockerRestartHistory,
  createDockerRestartMigrationRecord,
  createDockerRestartMigratedPhase,
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

test("A to B to C preserves prior bytes and completes one mixed-generation phase chain", () => {
  const originRecords = [createDockerRestartRecord(binding, "stop_intent")];
  const b = { ...binding, runtimeExecutionIdentitySha256: "b".repeat(64) };
  const c = { ...binding, runtimeExecutionIdentitySha256: "c".repeat(64) };
  const firstHandoff = createDockerRestartMigrationRecord(
    originRecords,
    b,
    [],
    [],
  );
  const first = createDockerRestartRecord(b, "stop_intent");
  const firstWrapper = createDockerRestartContinuationRecord(
    first,
    createHash("sha256").update(firstHandoff).digest("hex"),
  );
  const saved = Buffer.from(firstWrapper);
  const secondHandoff = createDockerRestartMigrationRecord(
    originRecords,
    c,
    [firstHandoff],
    [firstWrapper],
  );
  const handoffs = [firstHandoff, secondHandoff];
  const wrappers = [firstWrapper];
  let previous = first;
  assert.equal(
    resolveDockerRestartHistory(originRecords, c, handoffs, wrappers)
      ?.currentPhase,
    "stop_intent",
  );
  for (const phase of [
    "stopped",
    "start_intent",
    "ready",
    "settled",
  ] as const) {
    previous = createDockerRestartMigratedPhase(c, phase, previous);
    wrappers.push(
      createDockerRestartContinuationRecord(
        previous,
        createHash("sha256").update(secondHandoff).digest("hex"),
      ),
    );
  }
  assert.equal(
    resolveDockerRestartHistory(originRecords, c, handoffs, wrappers)
      ?.currentPhase,
    "settled",
  );
  const d = { ...binding, runtimeExecutionIdentitySha256: "d".repeat(64) };
  const settledHandoff = createDockerRestartMigrationRecord(
    originRecords,
    d,
    handoffs,
    wrappers,
  );
  assert.equal(
    resolveDockerRestartHistory(
      originRecords,
      d,
      [...handoffs, settledHandoff],
      wrappers,
    )?.currentPhase,
    "settled",
  );
  assert.deepEqual(firstWrapper, saved);
  assert.equal(
    resolveDockerRestartHistory(
      originRecords,
      { ...c, pendingSubmissionSha256: "d".repeat(64) },
      handoffs,
      wrappers,
    ),
    null,
  );
  assert.equal(
    resolveDockerRestartHistory(originRecords, c, handoffs, wrappers.slice(1)),
    null,
  );
  assert.equal(
    resolveDockerRestartHistory(
      originRecords,
      c,
      [...handoffs].reverse(),
      wrappers,
    ),
    null,
  );
  const oldAppend = createDockerRestartRecord(b, "stopped", first);
  const oldWrapper = createDockerRestartContinuationRecord(
    oldAppend,
    createHash("sha256").update(firstHandoff).digest("hex"),
  );
  assert.equal(
    resolveDockerRestartHistory(originRecords, c, handoffs, [
      firstWrapper,
      oldWrapper,
    ]),
    null,
  );
  assert.throws(() =>
    createDockerRestartMigrationRecord(originRecords, b, handoffs, wrappers),
  );
});

test("migration boundary tampering and repeat migration without progress remain explicit", () => {
  const originRecords = [createDockerRestartRecord(binding, "stop_intent")];
  const b = { ...binding, runtimeExecutionIdentitySha256: "b".repeat(64) };
  const c = { ...binding, runtimeExecutionIdentitySha256: "c".repeat(64) };
  const first = createDockerRestartMigrationRecord(originRecords, b, [], []);
  const second = createDockerRestartMigrationRecord(
    originRecords,
    c,
    [first],
    [],
  );
  assert.equal(
    resolveDockerRestartHistory(originRecords, c, [first, second], [])
      ?.currentPhase,
    "stop_intent",
  );
  for (const mutation of [
    { continuationCount: 1, continuationTipSha256: hash },
    { originTipSha256: "d".repeat(64) },
    { fromRuntimeIdentitySha256: hash },
  ]) {
    const altered = Buffer.from(
      `${JSON.stringify({ ...JSON.parse(second.toString()), ...mutation })}\n`,
    );
    assert.equal(
      resolveDockerRestartHistory(originRecords, c, [first, altered], []),
      null,
    );
  }
});
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
