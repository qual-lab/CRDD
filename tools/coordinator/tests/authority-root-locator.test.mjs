import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORITY_ROOT_LOCATOR_CONTRACT,
  AUTHORITY_ROOT_LOCATOR_INPUT_LIMITS,
  compileAuthorityRootLocatorCandidate,
  decodeAuthorityRootLocatorCandidate,
  describeAuthorityRootLocatorContract,
  evaluateAuthorityRootLocatorActivationBindingCandidate
} from "../src/security/authority-root-locator.mjs";
import { RUNTIME_ACTIVATION_LOCATOR_PAIR_BINDING_FIELDS } from
  "../src/security/runtime-activation-locator-binding-contract.mjs";

const validPath = process.platform === "win32" ? "C:\\CRDD\\authority" : "/srv/crdd/authority";

function locator(overrides = {}) {
  return {
    contract: AUTHORITY_ROOT_LOCATOR_CONTRACT,
    contractRevision: 1,
    locatorRevision: 1,
    repositoryIdentityHash: "1".repeat(64),
    runtimeRootIdentityHash: "2".repeat(64),
    authorityRootAbsolutePath: validPath,
    authorityRootIdentityHash: "3".repeat(64),
    provisioningRecordHash: "4".repeat(64),
    activationId: "ACTIVATION-000001",
    activationRevision: 2,
    activationRecordHash: "5".repeat(64),
    ...overrides
  };
}

function canonicalBytes(value) {
  const sorted = Object.fromEntries(Object.entries(value).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0));
  return Buffer.from(JSON.stringify(sorted), "utf8");
}

test("Authority Root locatorはPathを公開せずcanonical内容Hashだけを候補化する", () => {
  const value = locator();
  const compiled = compileAuthorityRootLocatorCandidate(value);
  assert.equal(compiled.status, "candidate");
  assert.match(compiled.locatorHash, /^[a-f0-9]{64}$/u);
  assert.equal(compiled.summary.absolutePathReported, false);
  assert.equal(compiled.summary.containsCredentials, false);
  assert.equal("record" in compiled, false);
  assert.equal("canonicalBytes" in compiled, false);
  assert.equal(JSON.stringify(compiled).includes(value.authorityRootAbsolutePath), false);
  assert.equal(compiled.runtimeAuthorityConferred, false);
  assert.equal(compiled.runtimeCapabilityIssued, false);
  assert.equal(compiled.filesystemEffectIssued, false);

  const decoded = decodeAuthorityRootLocatorCandidate(canonicalBytes(value));
  assert.equal(decoded.status, "candidate");
  assert.equal(decoded.locatorHash, compiled.locatorHash);
});

test("locatorはexact plain-dataだけを受理し動的入力を実行しない", () => {
  const symbolInput = locator();
  symbolInput[Symbol("extra")] = true;
  for (const value of [
    { ...locator(), extra: true },
    (() => { const value = locator(); delete value.activationRecordHash; return value; })(),
    Object.assign(Object.create({}), locator()),
    symbolInput
  ]) assert.equal(compileAuthorityRootLocatorCandidate(value).status, "blocked");

  let getterCalls = 0;
  const accessor = locator();
  Object.defineProperty(accessor, "authorityRootAbsolutePath", {
    enumerable: true,
    get() { getterCalls += 1; return validPath; }
  });
  assert.equal(compileAuthorityRootLocatorCandidate(accessor).status, "blocked");
  assert.equal(getterCalls, 0);

  let proxyCalls = 0;
  const raw = locator();
  const proxy = new Proxy(raw, { ownKeys() { proxyCalls += 1; return Reflect.ownKeys(raw); } });
  assert.equal(compileAuthorityRootLocatorCandidate(proxy).status, "blocked");
  assert.equal(proxyCalls, 0);
});

test("Path、Hash、ID、revisionの不正値をfail closedにする", () => {
  const maximumPath = process.platform === "win32"
    ? `C:\\${"x".repeat(AUTHORITY_ROOT_LOCATOR_INPUT_LIMITS.absolutePathBytes - 3)}`
    : `/${"x".repeat(AUTHORITY_ROOT_LOCATOR_INPUT_LIMITS.absolutePathBytes - 1)}`;
  assert.equal(Buffer.byteLength(maximumPath, "utf8"),
    AUTHORITY_ROOT_LOCATOR_INPUT_LIMITS.absolutePathBytes);
  assert.equal(compileAuthorityRootLocatorCandidate(locator({
    authorityRootAbsolutePath: maximumPath
  })).status, "candidate");

  const paths = process.platform === "win32"
    ? [
        "relative",
        "c:\\CRDD\\authority",
        "\\\\server\\share",
        "\\\\?\\C:\\authority",
        "C:\\CRDD\\..\\authority",
        "C:/CRDD/authority",
        "C:\\CRDD\\authority\\",
        "C:\\bad?name",
        "C:\\bad<name",
        "C:\\bad>name",
        "C:\\bad\"name",
        "C:\\bad|name",
        "C:\\bad*name",
        "C:\\dir\\file:stream",
        "C:\\dir.",
        "C:\\dir ",
        "C:\\CON",
        "C:\\con.txt",
        "C:\\dir\\PRN.log",
        "C:\\AUX",
        "C:\\NUL.data",
        "C:\\CLOCK$",
        "C:\\CONIN$.txt",
        "C:\\CONOUT$",
        "C:\\COM1.log",
        "C:\\com9",
        "C:\\COM¹",
        "C:\\com².txt",
        "C:\\CoM³.data",
        "C:\\LPT1.txt",
        "C:\\lpt9",
        "C:\\LPT¹.log",
        "C:\\lpt²",
        "C:\\LpT³.txt"
      ]
    : ["relative", "//srv/authority", "/srv/../authority", "/srv/authority/"];
  for (const authorityRootAbsolutePath of paths) {
    const result = compileAuthorityRootLocatorCandidate(locator({ authorityRootAbsolutePath }));
    assert.equal(result.status, "blocked");
    assert.equal(JSON.stringify(result).includes(authorityRootAbsolutePath), false);
  }
  for (const overrides of [
    { authorityRootAbsolutePath: `${validPath}\n` },
    { authorityRootAbsolutePath: "x".repeat(AUTHORITY_ROOT_LOCATOR_INPUT_LIMITS.absolutePathBytes + 1) },
    { locatorRevision: 2 },
    { contractRevision: 2 },
    { repositoryIdentityHash: "A".repeat(64) },
    { runtimeRootIdentityHash: "2".repeat(63) },
    { authorityRootIdentityHash: "z".repeat(64) },
    { provisioningRecordHash: "4".repeat(65) },
    { activationId: "ACT-1" },
    { activationRevision: 0 },
    { activationRecordHash: "5".repeat(63) }
  ]) assert.equal(compileAuthorityRootLocatorCandidate(locator(overrides)).status, "blocked");

  if (process.platform === "win32") {
    for (const authorityRootAbsolutePath of [
      "C:\\",
      "C:\\CONSOLE",
      "C:\\COM0",
      "C:\\COM10",
      "C:\\COM⁴",
      "C:\\LPT0",
      "C:\\LPT10",
      "C:\\LPT⁴"
    ]) assert.equal(compileAuthorityRootLocatorCandidate(locator({
      authorityRootAbsolutePath
    })).status, "candidate");
  }
});

test("decoderはBuffer、上限、strict UTF-8およびcanonical完全一致を要求する", () => {
  const bytes = canonicalBytes(locator());
  assert.equal(decodeAuthorityRootLocatorCandidate(new Uint8Array(bytes)).reason,
    "authority_root_locator_bytes_required");
  assert.equal(decodeAuthorityRootLocatorCandidate(Buffer.alloc(
    AUTHORITY_ROOT_LOCATOR_INPUT_LIMITS.rawBytes + 1, 0x20
  )).reason, "authority_root_locator_bytes_exceeded");
  assert.equal(decodeAuthorityRootLocatorCandidate(Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]), bytes
  ])).reason, "authority_root_locator_bytes_invalid");
  assert.equal(decodeAuthorityRootLocatorCandidate(Buffer.concat([bytes, Buffer.from("\n")])).reason,
    "authority_root_locator_bytes_noncanonical");
  assert.equal(decodeAuthorityRootLocatorCandidate(Buffer.from([0xc3, 0x28])).reason,
    "authority_root_locator_bytes_invalid");
});

test("activation revisionまたはrecord Hash差はlocator内容Hashを変える", () => {
  const baseline = compileAuthorityRootLocatorCandidate(locator()).locatorHash;
  assert.notEqual(compileAuthorityRootLocatorCandidate(locator({ activationRevision: 3 })).locatorHash,
    baseline);
  assert.notEqual(compileAuthorityRootLocatorCandidate(locator({
    activationRecordHash: "6".repeat(64)
  })).locatorHash, baseline);
});

test("locator contractは固定Repository配置と未実装Effectを公開する", () => {
  const contract = describeAuthorityRootLocatorContract();
  assert.equal(contract.fixedRepositoryRelativeFile,
    ".crdd-runtime/authority-root-locator.json");
  assert.equal(contract.runtimeRootOverrideChangesLocatorLocation, false);
  assert.equal(contract.locatorCore, "implemented_candidate");
  assert.equal(contract.trustLevel, "untrusted_discovery_hint");
  assert.equal(contract.containsAbsolutePath, true);
  assert.equal(contract.containsCredentials, false);
  assert.equal(contract.canonicalBytesExposed, false);
  assert.equal(contract.filesystemRead, "not_implemented");
  assert.equal(contract.filesystemWrite, "not_implemented");
  assert.equal(contract.resolver, "not_implemented");
  assert.equal(contract.activationBindingComparisonCore, "implemented_candidate");
  assert.equal(contract.activeActivationBinding, "not_implemented");
  assert.equal(contract.runtimeAuthorityConferred, false);
  assert.equal(contract.runtimeCapabilityIssued, false);
});

test("locator activation binding compares only the five shared fields", () => {
  const value = locator();
  const expected = {
    repositoryIdentityHash: value.repositoryIdentityHash,
    runtimeRootIdentityHash: value.runtimeRootIdentityHash,
    activationId: value.activationId,
    activationRevision: value.activationRevision,
    activationRecordHash: value.activationRecordHash
  };
  const result = evaluateAuthorityRootLocatorActivationBindingCandidate(value, expected);
  assert.equal(result.status, "candidate");
  assert.equal(result.pairContentMatched, true);
  assert.equal(result.provisioningRecordVerification, "not_implemented");
  assert.equal(result.runtimeAuthorityConferred, false);
  assert.equal(result.runtimeCapabilityIssued, false);
  assert.equal(JSON.stringify(result).includes(value.authorityRootAbsolutePath), false);
  assert.equal(JSON.stringify(result).includes(value.repositoryIdentityHash), false);
  const replacements = {
    repositoryIdentityHash: "6".repeat(64),
    runtimeRootIdentityHash: "7".repeat(64),
    activationId: "ACTIVATION-000002",
    activationRevision: 3,
    activationRecordHash: "8".repeat(64)
  };
  assert.equal(Object.isFrozen(RUNTIME_ACTIVATION_LOCATOR_PAIR_BINDING_FIELDS), true);
  assert.equal(new Set(RUNTIME_ACTIVATION_LOCATOR_PAIR_BINDING_FIELDS).size,
    RUNTIME_ACTIVATION_LOCATOR_PAIR_BINDING_FIELDS.length);
  for (const key of RUNTIME_ACTIVATION_LOCATOR_PAIR_BINDING_FIELDS) {
    assert.equal(evaluateAuthorityRootLocatorActivationBindingCandidate(value, {
      ...expected,
      [key]: replacements[key]
    }).reason, "authority_root_locator_activation_binding_mismatch");
  }

  let getterCalls = 0;
  const accessor = { ...expected };
  Object.defineProperty(accessor, "activationRecordHash", {
    enumerable: true,
    get() { getterCalls += 1; return value.activationRecordHash; }
  });
  assert.equal(evaluateAuthorityRootLocatorActivationBindingCandidate(value, accessor).reason,
    "authority_root_locator_activation_binding_input_invalid");
  assert.equal(getterCalls, 0);
});
