import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSignedRunnerSafetyObservation,
  salvageSignedRunnerRecoveryPair,
} from "../src/security/signed-runner-safety-observation.ts";

const hostA = `host.crdd-coordinator-doctor-a.12345678-1234-4234-8234-123456789abc.${"a".repeat(64)}`;
const hostB = `host.crdd-coordinator-doctor-b.12345678-1234-4234-8234-123456789abc.${"b".repeat(64)}`;
const dockerA = `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`;

const schema = Object.freeze({
  booleanFields: Object.freeze([
    "cleanupConfirmed",
    "manualRecoveryRequired",
    "processRestartRequired",
    "effectStateUnknown",
  ]),
  nullableRecoveryFields: Object.freeze([]),
  recoveryPairs: Object.freeze([
    Object.freeze({
      singularField: "hostRecoveryId",
      pluralField: "hostRecoveryIds",
      kind: "host" as const,
    }),
    Object.freeze({
      singularField: "dockerRecoveryId",
      pluralField: "dockerRecoveryIds",
      kind: "docker" as const,
    }),
  ]),
  effectUnknownField: "effectStateUnknown",
});

function exact(overrides: Readonly<Record<string, unknown>> = {}) {
  return Object.freeze({
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
    effectStateUnknown: false,
    hostRecoveryId: null,
    dockerRecoveryId: null,
    hostRecoveryIds: Object.freeze([]),
    dockerRecoveryIds: Object.freeze([]),
    ...overrides,
  });
}

test("安全観測はexact booleanとRecovery集合だけを確定する", () => {
  const none = evaluateSignedRunnerSafetyObservation(exact(), schema);
  assert.equal(none.status, "exact");
  assert.deepEqual(none.recoveryIds, []);

  const recovery = evaluateSignedRunnerSafetyObservation(
    exact({
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      hostRecoveryId: null,
      hostRecoveryIds: Object.freeze([hostA, hostB]),
      dockerRecoveryId: dockerA,
      dockerRecoveryIds: Object.freeze([dockerA]),
    }),
    schema,
  );
  assert.equal(recovery.status, "exact");
  assert.deepEqual(recovery.recoveryIds, [hostA, hostB, dockerA]);
});

test("booleanの欠落・null・文字列は安全状態不明に閉じる", () => {
  for (const field of schema.booleanFields) {
    const missing = { ...exact() } as Record<string, unknown>;
    delete missing[field];
    for (const candidate of [
      missing,
      { ...exact(), [field]: null },
      { ...exact(), [field]: "false" },
    ]) {
      assert.equal(
        evaluateSignedRunnerSafetyObservation(candidate, schema).status,
        "unknown",
        field,
      );
    }
  }
});

test("cleanup・manual recovery・effect unknownの相関矛盾を拒否する", () => {
  for (const candidate of [
    exact({ cleanupConfirmed: false }),
    exact({ hostRecoveryId: hostA }),
    exact({ dockerRecoveryIds: Object.freeze([dockerA]) }),
    exact({ effectStateUnknown: true, manualRecoveryRequired: true }),
  ]) {
    assert.equal(
      evaluateSignedRunnerSafetyObservation(candidate, schema).status,
      "unknown",
    );
  }

  const childPoison = evaluateSignedRunnerSafetyObservation(
    exact({ processRestartRequired: true }),
    schema,
  );
  assert.equal(childPoison.status, "exact");
  assert.equal(childPoison.booleans?.processRestartRequired, true);
});

test("Recovery配列の疎・accessor・Proxy・重複・非文字列を拒否する", () => {
  const sparse = Array<string>(1);
  const accessor: string[] = [];
  Object.defineProperty(accessor, "0", {
    enumerable: true,
    configurable: true,
    get: () => dockerA,
  });
  accessor.length = 1;
  const proxy = new Proxy([dockerA], {});
  for (const value of [sparse, accessor, proxy, [dockerA, dockerA], [1]]) {
    assert.equal(
      evaluateSignedRunnerSafetyObservation(
        exact({
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          dockerRecoveryIds: value,
        }),
        schema,
      ).status,
      "unknown",
    );
  }
});

test("Recovery pairは0件・1件・N件のcanonical関係だけを受理する", () => {
  for (const candidate of [
    exact({ hostRecoveryId: hostA, hostRecoveryIds: Object.freeze([]) }),
    exact({
      hostRecoveryId: hostA,
      hostRecoveryIds: Object.freeze([hostB]),
    }),
    exact({
      hostRecoveryId: hostA,
      hostRecoveryIds: Object.freeze([hostA, hostB]),
    }),
    exact({
      hostRecoveryId: null,
      hostRecoveryIds: Object.freeze([hostA]),
    }),
  ]) {
    assert.equal(
      evaluateSignedRunnerSafetyObservation(
        Object.freeze({
          ...candidate,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        }),
        schema,
      ).status,
      "unknown",
    );
  }
});

test("Recordのgetter・Proxy・独自prototypeを観測済みにしない", () => {
  const getter = { ...exact() } as Record<string, unknown>;
  Object.defineProperty(getter, "cleanupConfirmed", {
    enumerable: true,
    get: () => true,
  });
  for (const candidate of [
    getter,
    new Proxy(exact(), {}),
    Object.assign(Object.create({ inherited: true }), exact()),
  ]) {
    assert.equal(
      evaluateSignedRunnerSafetyObservation(candidate, schema).status,
      "unknown",
    );
  }
});

test("partial salvageはown-dataのcanonical IDだけをboundedに保持する", () => {
  const mixed = salvageSignedRunnerRecoveryPair(
    Object.freeze({
      hostRecoveryId: hostA,
      hostRecoveryIds: Object.freeze([hostA, "x".repeat(1_025)]),
    }),
    Object.freeze({
      singularField: "hostRecoveryId",
      pluralField: "hostRecoveryIds",
      kind: "host" as const,
    }),
  );
  assert.equal(mixed.singular, hostA);
  assert.deepEqual(mixed.plural, [hostA]);
  assert.equal(mixed.ambiguous, true);

  const accessor = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(accessor, "hostRecoveryId", {
    enumerable: true,
    get: () => hostA,
  });
  Object.defineProperty(accessor, "hostRecoveryIds", {
    enumerable: true,
    value: Object.freeze([hostB]),
  });
  const partial = salvageSignedRunnerRecoveryPair(accessor, {
    singularField: "hostRecoveryId",
    pluralField: "hostRecoveryIds",
    kind: "host",
  });
  assert.equal(partial.singular, hostB);
  assert.deepEqual(partial.plural, [hostB]);
  assert.equal(partial.ambiguous, true);
});
