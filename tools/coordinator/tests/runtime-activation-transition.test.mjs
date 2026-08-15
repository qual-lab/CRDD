import assert from "node:assert/strict";
import test from "node:test";

import {
  RUNTIME_ACTIVATION_CONTRACT,
  RUNTIME_ACTIVATION_INPUT_LIMITS,
  compileRuntimeActivationRecordCandidate
} from "../src/security/runtime-activation-record.mjs";
import { evaluateRuntimeActivationTransitionCandidate } from
  "../src/security/runtime-activation-transition.ts";

function record(overrides = {}) {
  return {
    contract: RUNTIME_ACTIVATION_CONTRACT,
    contractRevision: 1,
    activationId: "ACTIVATION-000001",
    activationRevision: 1,
    status: "active",
    previousActivationHash: null,
    repositoryIdentityHash: "1".repeat(64),
    runtimeRootIdentityHash: "2".repeat(64),
    bundleId: "AUTHBUNDLE-000001",
    bundleRevision: 3,
    authorityBundleHash: "3".repeat(64),
    policyId: "AUTHPOL-000001",
    policyRevision: 2,
    trustPolicyHash: "4".repeat(64),
    registryId: "AUTHREG-000001",
    registryRevision: 5,
    registryHash: "5".repeat(64),
    activatedAt: "2026-08-11T00:00:00.000Z",
    disabledAt: null,
    ...overrides
  };
}

function transition(previousCanonicalBytes, nextRecord) {
  return evaluateRuntimeActivationTransitionCandidate({ previousCanonicalBytes, nextRecord });
}

function activePrevious(overrides = {}) {
  return compileRuntimeActivationRecordCandidate(record(overrides));
}

function disabledNext(previous, overrides = {}) {
  return record({
    activationRevision: previous.record.activationRevision + 1,
    status: "disabled",
    previousActivationHash: previous.recordHash,
    activatedAt: previous.record.activatedAt,
    disabledAt: "2026-08-11T01:00:00.000Z",
    ...overrides
  });
}

test("初版はnullからactive revision 1だけを候補化する", () => {
  const result = transition(null, record());
  assert.equal(result.status, "candidate");
  assert.equal(result.reason, "runtime_activation_initial_transition_candidate");
  assert.equal(result.transitionKind, "initial_null_to_active");
  assert.match(result.recordHash, /^[a-f0-9]{64}$/u);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.persistenceIssued, false);
  assert.equal(result.runtimeCapabilityIssued, false);

  assert.equal(transition(null, record({
    status: "disabled",
    disabledAt: "2026-08-11T01:00:00.000Z"
  })).reason, "runtime_activation_initial_transition_invalid");
  assert.equal(transition(null, record({
    activationRevision: 2,
    previousActivationHash: "a".repeat(64)
  })).reason, "runtime_activation_initial_transition_invalid");
});

test("activeからdisabledは再計算Hashと全不変条件を要求する", () => {
  const previous = activePrevious();
  const result = transition(previous.canonicalBytes, disabledNext(previous));
  assert.equal(result.status, "candidate");
  assert.equal(result.reason, "runtime_activation_disable_transition_candidate");
  assert.equal(result.transitionKind, "active_to_disabled");
  assert.equal(result.record.previousActivationHash, previous.recordHash);
  assert.equal(result.persistenceIssued, false);
  assert.equal(result.runtimeCapabilityIssued, false);
});

test("disable遷移はrevision、前版Hashおよび固定Identityの差を拒否する", () => {
  const previous = activePrevious();
  assert.equal(transition(previous.canonicalBytes, disabledNext(previous, {
    activationRevision: 1
  })).reason, "runtime_activation_next_record_invalid");
  assert.equal(transition(previous.canonicalBytes, disabledNext(previous, {
    activationRevision: 1,
    previousActivationHash: null
  })).reason, "runtime_activation_disable_transition_invalid");
  for (const overrides of [
    { activationRevision: 3 },
    { previousActivationHash: "f".repeat(64) },
    { activationId: "ACTIVATION-000002" },
    { repositoryIdentityHash: "6".repeat(64) },
    { runtimeRootIdentityHash: "7".repeat(64) }
  ]) assert.equal(transition(previous.canonicalBytes, disabledNext(previous, overrides)).reason,
    "runtime_activation_disable_transition_invalid");
});

test("disable遷移でAuthority tupleまたはactivatedAtを差し替えない", () => {
  const previous = activePrevious();
  const changes = [
    { bundleId: "AUTHBUNDLE-000002" },
    { bundleRevision: 4 },
    { authorityBundleHash: "6".repeat(64) },
    { policyId: "AUTHPOL-000002" },
    { policyRevision: 3 },
    { trustPolicyHash: "7".repeat(64) },
    { registryId: "AUTHREG-000002" },
    { registryRevision: 6 },
    { registryHash: "8".repeat(64) },
    { activatedAt: "2026-08-11T00:00:00.001Z" }
  ];
  for (const overrides of changes) {
    assert.equal(transition(previous.canonicalBytes, disabledNext(previous, overrides)).reason,
      "runtime_activation_disable_transition_invalid");
  }
  assert.equal(transition(previous.canonicalBytes, disabledNext(previous, {
    disabledAt: previous.record.activatedAt
  })).status, "candidate");
  assert.equal(transition(previous.canonicalBytes, disabledNext(previous, {
    disabledAt: "2026-08-10T23:59:59.999Z"
  })).reason, "runtime_activation_next_record_invalid");
});

test("再activationとdisabled起点の遷移は未実装としてfail closedにする", () => {
  const active = activePrevious();
  for (const overrides of [
    { activationRevision: 2, previousActivationHash: active.recordHash },
    { activationRevision: 2, previousActivationHash: active.recordHash, bundleRevision: 4 },
    { activationRevision: 2, previousActivationHash: "f".repeat(64) }
  ]) assert.equal(transition(active.canonicalBytes, record(overrides)).reason,
    "runtime_reactivation_transition_policy_not_implemented");

  const disabled = compileRuntimeActivationRecordCandidate(disabledNext(active));
  assert.equal(transition(disabled.canonicalBytes, record({
    activationRevision: 3,
    previousActivationHash: disabled.recordHash
  })).reason, "runtime_disabled_transition_policy_not_implemented");
  assert.equal(transition(disabled.canonicalBytes, record({
    activationRevision: 3,
    status: "disabled",
    previousActivationHash: disabled.recordHash,
    disabledAt: "2026-08-11T02:00:00.000Z"
  })).reason, "runtime_disabled_transition_policy_not_implemented");
});

test("前版revision上限と不正canonical bytesを例外なく拒否する", () => {
  const penultimate = activePrevious({
    activationRevision: Number.MAX_SAFE_INTEGER - 1,
    previousActivationHash: "a".repeat(64)
  });
  assert.equal(transition(penultimate.canonicalBytes, disabledNext(penultimate)).status, "candidate");

  const maximum = activePrevious({
    activationRevision: Number.MAX_SAFE_INTEGER,
    previousActivationHash: "a".repeat(64)
  });
  assert.equal(transition(maximum.canonicalBytes, record({
    activationRevision: Number.MAX_SAFE_INTEGER,
    previousActivationHash: maximum.recordHash
  })).reason, "runtime_reactivation_transition_policy_not_implemented");
  assert.equal(transition(maximum.canonicalBytes, record({
    activationRevision: Number.MAX_SAFE_INTEGER,
    status: "disabled",
    previousActivationHash: maximum.recordHash,
    disabledAt: "2026-08-11T01:00:00.000Z"
  })).reason, "runtime_activation_revision_exhausted");

  const disabledMaximum = compileRuntimeActivationRecordCandidate(record({
    activationRevision: Number.MAX_SAFE_INTEGER,
    status: "disabled",
    previousActivationHash: "a".repeat(64),
    disabledAt: "2026-08-11T01:00:00.000Z"
  }));
  assert.equal(transition(disabledMaximum.canonicalBytes, record({
    activationRevision: Number.MAX_SAFE_INTEGER,
    previousActivationHash: disabledMaximum.recordHash
  })).reason, "runtime_disabled_transition_policy_not_implemented");
  assert.equal(transition(disabledMaximum.canonicalBytes, record({
    activationRevision: Number.MAX_SAFE_INTEGER,
    status: "disabled",
    previousActivationHash: disabledMaximum.recordHash,
    disabledAt: "2026-08-11T02:00:00.000Z"
  })).reason, "runtime_disabled_transition_policy_not_implemented");

  const invalidPrevious = [
    {},
    new Uint8Array([1, 2, 3]),
    Buffer.alloc(RUNTIME_ACTIVATION_INPUT_LIMITS.rawBytes + 1, 0x20),
    Buffer.from("{\"not\":\"canonical\"}\n"),
    Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]),
    Buffer.from([0xc3, 0x28])
  ];
  for (const value of invalidPrevious) {
    assert.equal(transition(value, record()).reason, "runtime_activation_previous_record_invalid");
  }
});

test("外側入力と次recordの動的shapeを実行せずblockedへ閉じる", () => {
  const nullPrototype = Object.assign(Object.create(null), {
    previousCanonicalBytes: null,
    nextRecord: record()
  });
  assert.equal(evaluateRuntimeActivationTransitionCandidate(nullPrototype).status, "candidate");
  assert.equal(evaluateRuntimeActivationTransitionCandidate(Object.freeze({
    previousCanonicalBytes: null,
    nextRecord: Object.freeze(record())
  })).status, "candidate");

  let outerGetterCalls = 0;
  const outer = { previousCanonicalBytes: null };
  Object.defineProperty(outer, "nextRecord", {
    enumerable: true,
    get() { outerGetterCalls += 1; return record(); }
  });
  assert.equal(evaluateRuntimeActivationTransitionCandidate(outer).reason,
    "runtime_activation_transition_input_invalid");
  assert.equal(outerGetterCalls, 0);

  let previousGetterCalls = 0;
  const previousAccessor = { nextRecord: record() };
  Object.defineProperty(previousAccessor, "previousCanonicalBytes", {
    enumerable: true,
    get() { previousGetterCalls += 1; return null; }
  });
  assert.equal(evaluateRuntimeActivationTransitionCandidate(previousAccessor).reason,
    "runtime_activation_transition_input_invalid");
  assert.equal(previousGetterCalls, 0);

  let nextGetterCalls = 0;
  const next = record();
  Object.defineProperty(next, "bundleId", {
    enumerable: true,
    get() { nextGetterCalls += 1; return "AUTHBUNDLE-000001"; }
  });
  assert.equal(transition(null, next).reason, "runtime_activation_next_record_invalid");
  assert.equal(nextGetterCalls, 0);

  for (const value of [
    { previousCanonicalBytes: null, nextRecord: record(), extra: true },
    { previousCanonicalBytes: null },
    new Proxy({ previousCanonicalBytes: null, nextRecord: record() }, {})
  ]) assert.equal(evaluateRuntimeActivationTransitionCandidate(value).reason,
    "runtime_activation_transition_input_invalid");
});
