import assert from "node:assert/strict";
import test from "node:test";

import { evaluateSignedRunnerSafetyObservation } from "../src/security/signed-runner-safety-observation.ts";

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
    }),
    Object.freeze({
      singularField: "dockerRecoveryId",
      pluralField: "dockerRecoveryIds",
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
      hostRecoveryIds: Object.freeze(["host.one", "host.two"]),
      dockerRecoveryId: "docker.one",
      dockerRecoveryIds: Object.freeze(["docker.one"]),
    }),
    schema,
  );
  assert.equal(recovery.status, "exact");
  assert.deepEqual(recovery.recoveryIds, [
    "host.one",
    "host.two",
    "docker.one",
  ]);
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
    exact({ hostRecoveryId: "host.one" }),
    exact({ dockerRecoveryIds: Object.freeze(["docker.one"]) }),
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
    get: () => "docker.one",
  });
  accessor.length = 1;
  const proxy = new Proxy(["docker.one"], {});
  for (const value of [
    sparse,
    accessor,
    proxy,
    ["docker.one", "docker.one"],
    [1],
  ]) {
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
    exact({ hostRecoveryId: "host.one", hostRecoveryIds: Object.freeze([]) }),
    exact({
      hostRecoveryId: "host.one",
      hostRecoveryIds: Object.freeze(["host.two"]),
    }),
    exact({
      hostRecoveryId: "host.one",
      hostRecoveryIds: Object.freeze(["host.one", "host.two"]),
    }),
    exact({
      hostRecoveryId: null,
      hostRecoveryIds: Object.freeze(["host.one"]),
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
