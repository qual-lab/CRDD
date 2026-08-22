import assert from "node:assert/strict";
import test from "node:test";

import { AUTHORITY_ROOT_LOCATOR_CONTRACT } from "../src/security/authority-root-locator.ts";
import { evaluateInitialActivationLocatorBindingCandidate } from "../src/security/runtime-activation-locator-binding.ts";
import { RUNTIME_ACTIVATION_LOCATOR_PAIR_BINDING_FIELDS } from "../src/security/runtime-activation-locator-binding-contract.ts";
import {
  RUNTIME_ACTIVATION_CONTRACT,
  RUNTIME_ACTIVATION_CONTRACT_REVISION,
  compileRuntimeActivationRecordCandidate,
} from "../src/security/runtime-activation-record.ts";

const validPath =
  process.platform === "win32" ? "C:\\CRDD\\authority" : "/srv/crdd/authority";

function activation(overrides = {}) {
  return {
    contract: RUNTIME_ACTIVATION_CONTRACT,
    contractRevision: RUNTIME_ACTIVATION_CONTRACT_REVISION,
    activationId: "ACTIVATION-000001",
    activationRevision: 1,
    status: "active",
    previousActivationHash: null,
    repositoryIdentityHash: "1".repeat(64),
    runtimeRootIdentityHash: "2".repeat(64),
    bundleId: "AUTHBUNDLE-000001",
    bundleRevision: 1,
    authorityBundleHash: "3".repeat(64),
    policyId: "AUTHPOL-000001",
    policyRevision: 1,
    trustPolicyHash: "4".repeat(64),
    registryId: "AUTHREG-000001",
    registryRevision: 1,
    registryHash: "5".repeat(64),
    activatedAt: "2026-08-12T00:00:00.000Z",
    disabledAt: null,
    ...overrides,
  };
}

type ActivationFixture = ReturnType<typeof activation>;

function locator(
  record: ActivationFixture,
  overrides: Record<string, unknown> = {},
) {
  const compiled = compileRuntimeActivationRecordCandidate(record);
  if (compiled.status !== "candidate") {
    assert.fail(`fixture activation did not compile: ${compiled.reason}`);
  }
  return {
    contract: AUTHORITY_ROOT_LOCATOR_CONTRACT,
    contractRevision: 1,
    locatorRevision: 1,
    repositoryIdentityHash: record.repositoryIdentityHash,
    runtimeRootIdentityHash: record.runtimeRootIdentityHash,
    authorityRootAbsolutePath: validPath,
    authorityRootIdentityHash: "6".repeat(64),
    provisioningRecordHash: "7".repeat(64),
    activationId: record.activationId,
    activationRevision: record.activationRevision,
    activationRecordHash: compiled.recordHash,
    ...overrides,
  };
}

function evaluate(
  record: ActivationFixture,
  locatorOverrides: Record<string, unknown> = {},
  previousActivationCanonicalBytes: Buffer | null = null,
) {
  return evaluateInitialActivationLocatorBindingCandidate({
    previousActivationCanonicalBytes,
    nextActivationRecord: record,
    authorityRootLocator: locator(record, locatorOverrides),
  });
}

test("initial active activation and matching locator remain a candidate", () => {
  const record = activation();
  const result = evaluate(record);
  assert.equal(result.status, "candidate");
  assert.equal(
    result.reason,
    "runtime_initial_activation_locator_binding_candidate",
  );
  assert.equal(result.transitionKind, "initial_null_to_active");
  assert.equal(result.pairContentMatched, true);
  assert.equal(result.provisioningRecordVerification, "not_implemented");
  assert.equal(result.atomicPersistenceIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.runtimeAuthorityConferred, false);
  assert.equal(result.runtimeCapabilityIssued, false);
  assert.equal(JSON.stringify(result).includes(validPath), false);
  assert.equal(
    JSON.stringify(result).includes(record.repositoryIdentityHash),
    false,
  );
  assert.equal("record" in result, false);
  assert.equal("canonicalBytes" in result, false);
});

test("each shared activation and locator field must match", () => {
  const record = activation();
  const replacements: Record<string, string | number> = {
    repositoryIdentityHash: "8".repeat(64),
    runtimeRootIdentityHash: "9".repeat(64),
    activationId: "ACTIVATION-000002",
    activationRevision: 2,
    activationRecordHash: "a".repeat(64),
  };
  for (const key of RUNTIME_ACTIVATION_LOCATOR_PAIR_BINDING_FIELDS) {
    const result = evaluate(record, { [key]: replacements[key] });
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      "authority_root_locator_activation_binding_mismatch",
    );
    assert.equal(result.pairContentMatched, false);
  }
});

test("disable and reactivation locator lifecycles remain unsupported", () => {
  const active = compileRuntimeActivationRecordCandidate(activation());
  if (active.status !== "candidate") {
    assert.fail(`fixture activation did not compile: ${active.reason}`);
  }
  const disabled = activation({
    activationRevision: 2,
    status: "disabled",
    previousActivationHash: active.recordHash,
    disabledAt: "2026-08-12T01:00:00.000Z",
  });
  assert.equal(
    evaluate(disabled, {}, active.canonicalBytes).reason,
    "runtime_activation_locator_transition_not_supported",
  );
  assert.equal(
    evaluate(
      activation({
        activationRevision: 2,
        previousActivationHash: active.recordHash,
      }),
      {},
      active.canonicalBytes,
    ).reason,
    "runtime_activation_locator_transition_invalid",
  );
});

test("outer accessors and proxies fail closed without executing dynamic input", () => {
  const record = activation();
  let getterCalls = 0;
  const input = {
    previousActivationCanonicalBytes: null,
    authorityRootLocator: locator(record),
  };
  Object.defineProperty(input, "nextActivationRecord", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return record;
    },
  });
  assert.equal(
    evaluateInitialActivationLocatorBindingCandidate(input).reason,
    "runtime_activation_locator_binding_input_invalid",
  );
  assert.equal(getterCalls, 0);

  let proxyCalls = 0;
  const raw = {
    previousActivationCanonicalBytes: null,
    nextActivationRecord: record,
    authorityRootLocator: locator(record),
  };
  const proxy = new Proxy(raw, {
    ownKeys() {
      proxyCalls += 1;
      return Reflect.ownKeys(raw);
    },
  });
  assert.equal(
    evaluateInitialActivationLocatorBindingCandidate(proxy).reason,
    "runtime_activation_locator_binding_input_invalid",
  );
  assert.equal(proxyCalls, 0);
  assert.equal(
    evaluateInitialActivationLocatorBindingCandidate({
      ...raw,
      extra: true,
    }).reason,
    "runtime_activation_locator_binding_input_invalid",
  );
});
