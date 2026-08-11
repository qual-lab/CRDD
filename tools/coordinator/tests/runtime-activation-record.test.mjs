import assert from "node:assert/strict";
import test from "node:test";

import {
  RUNTIME_ACTIVATION_CONTRACT,
  RUNTIME_ACTIVATION_INPUT_LIMITS,
  compileRuntimeActivationRecordCandidate,
  decodeRuntimeActivationRecordCandidate,
  describeRuntimeActivationContract
} from "../src/security/runtime-activation-record.mjs";

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

test("Activation recordはRepository、Root、Bundle、Policy、Registry Identityをcanonical byteへ結合する", () => {
  const compiled = compileRuntimeActivationRecordCandidate(record());
  assert.equal(compiled.status, "candidate");
  assert.match(compiled.recordHash, /^[a-f0-9]{64}$/u);
  assert.equal(compiled.runtimeCapabilityIssued, false);
  const decoded = decodeRuntimeActivationRecordCandidate(compiled.canonicalBytes);
  assert.equal(decoded.status, "candidate");
  assert.equal(decoded.recordHash, compiled.recordHash);
  assert.deepEqual(decoded.record, compiled.record);
});

test("Bundle、PolicyまたはRegistry Identity変更はrecord Hashを変え再activation対象にする", () => {
  const baseline = compileRuntimeActivationRecordCandidate(record()).recordHash;
  for (const overrides of [
    { bundleRevision: 4 },
    { authorityBundleHash: "6".repeat(64) },
    { policyRevision: 3 },
    { trustPolicyHash: "7".repeat(64) },
    { registryRevision: 6 },
    { registryHash: "8".repeat(64) }
  ]) assert.notEqual(compileRuntimeActivationRecordCandidate(record(overrides)).recordHash, baseline);
});

test("初版と後続版、activeとdisabledの状態境界を固定する", () => {
  assert.equal(compileRuntimeActivationRecordCandidate(record({
    activationRevision: 2,
    previousActivationHash: "a".repeat(64)
  })).status, "candidate");
  assert.equal(compileRuntimeActivationRecordCandidate(record({
    activationRevision: 2,
    previousActivationHash: null
  })).status, "blocked");
  assert.equal(compileRuntimeActivationRecordCandidate(record({
    previousActivationHash: "a".repeat(64)
  })).status, "blocked");
  assert.equal(compileRuntimeActivationRecordCandidate(record({
    status: "disabled",
    disabledAt: "2026-08-11T01:00:00.000Z"
  })).status, "candidate");
  assert.equal(compileRuntimeActivationRecordCandidate(record({
    status: "disabled",
    disabledAt: null
  })).status, "blocked");
  assert.equal(compileRuntimeActivationRecordCandidate(record({
    status: "active",
    disabledAt: "2026-08-11T01:00:00.000Z"
  })).status, "blocked");
});

test("非canonical時刻、余分／欠落field、accessorおよびProxyを拒否する", () => {
  for (const value of [
    record({ activatedAt: "2026-08-11T00:00:00.00Z" }),
    record({ activatedAt: "2026-08-11T00:00:00.0000Z" }),
    record({ activatedAt: "x".repeat(1_000_000) }),
    record({ activatedAt: "2026-08-11T09:00:00+09:00" }),
    record({ activatedAt: "2026-08-11" }),
    record({ activatedAt: "2026-02-30T00:00:00.000Z" }),
    record({ activatedAt: 0 }),
    record({ status: "disabled", disabledAt: "x".repeat(1_000_000) }),
    { ...record(), extra: true },
    (() => { const value = record(); delete value.registryHash; return value; })()
  ]) assert.equal(compileRuntimeActivationRecordCandidate(value).status, "blocked");

  let getterCalls = 0;
  const accessor = record();
  Object.defineProperty(accessor, "bundleId", {
    enumerable: true,
    get() { getterCalls += 1; return "AUTHBUNDLE-000001"; }
  });
  assert.equal(compileRuntimeActivationRecordCandidate(accessor).status, "blocked");
  assert.equal(getterCalls, 0);
  let proxyCalls = 0;
  const raw = record();
  const proxied = new Proxy(raw, { ownKeys() { proxyCalls += 1; return Reflect.ownKeys(raw); } });
  assert.equal(compileRuntimeActivationRecordCandidate(proxied).status, "blocked");
  assert.equal(proxyCalls, 0);
});

test("byte decoderはBuffer、上限、strict UTF-8、BOMおよびcanonical完全一致を要求する", () => {
  const bytes = compileRuntimeActivationRecordCandidate(record()).canonicalBytes;
  assert.equal(decodeRuntimeActivationRecordCandidate(new Uint8Array(bytes)).reason,
    "runtime_activation_record_bytes_required");
  assert.equal(decodeRuntimeActivationRecordCandidate(Buffer.alloc(
    RUNTIME_ACTIVATION_INPUT_LIMITS.rawBytes + 1, 0x20
  )).reason, "runtime_activation_record_bytes_exceeded");
  assert.equal(decodeRuntimeActivationRecordCandidate(Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]), bytes
  ])).reason, "runtime_activation_record_bytes_invalid");
  assert.equal(decodeRuntimeActivationRecordCandidate(Buffer.concat([bytes, Buffer.from("\n")])).reason,
    "runtime_activation_record_bytes_noncanonical");
  assert.equal(decodeRuntimeActivationRecordCandidate(Buffer.from([0xc3, 0x28])).reason,
    "runtime_activation_record_bytes_invalid");
});

test("Activation contractは永続化、専用command、再activation、disable/delete分離を公開する", () => {
  const contract = describeRuntimeActivationContract();
  assert.equal(contract.persistence, "repository_scoped_persistent");
  assert.equal(contract.activationCommand, "dedicated_activate_required");
  assert.equal(contract.doctorEnableIsActivation, false);
  assert.equal(contract.bundleIdentityChangeRequiresReactivation, true);
  assert.equal(contract.disableSemantics, "stop_new_operations_and_safely_cancel_in_flight");
  assert.equal(contract.deleteIsSeparateOperation, true);
  assert.equal(contract.atomicPersistence, "not_implemented");
  assert.equal(contract.canonicalUtcLength, 24);
  assert.equal(contract.runtimeCapabilityIssued, false);
});
