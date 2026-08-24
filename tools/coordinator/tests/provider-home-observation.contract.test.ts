import assert from "node:assert/strict";
import test from "node:test";

import {
  createProviderHomeObservationRequest,
  describeProviderHomeObservationContract,
  evaluateProviderHomeObservationResponseCandidate,
  PROVIDER_HOME_OBSERVATION_REQUEST_BYTES,
  PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES,
} from "../src/security/provider-home-observation.ts";
import {
  consumeRuntimeOwnedProviderHomeObservationCapability,
  describeProviderHomeWindowsAdapterContract,
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
} from "../src/security/provider-home-windows-adapter.ts";

function response(provider: 1 | 2, nonce: Buffer) {
  const bytes = Buffer.alloc(PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES);
  bytes.write("CRDDHO01", 0, "ascii");
  bytes.writeUInt16LE(2, 8);
  bytes[10] = provider;
  bytes[11] = 1;
  nonce.copy(bytes, 12);
  bytes.writeUInt16LE(100, 44);
  bytes.writeUInt32LE(0x83, 46);
  bytes.writeUInt32LE(0x1ff, 50);
  bytes.fill(1, 54, 86);
  bytes.fill(2, 86, 118);
  bytes.fill(3, 118, 150);
  return bytes;
}

test("Provider Home requestはRuntime nonce、Providerとraw Pathでないmount source Hashだけを含める", () => {
  const nonce = Buffer.alloc(32, 7);
  const source =
    "C:\\Users\\selected\\AppData\\Local\\Qual-Lab\\CRDD\\ProviderHomes\\claude";
  const created = createProviderHomeObservationRequest(
    "claude",
    source,
    () => nonce,
  );
  assert.ok(created);
  assert.equal(created.request.length, PROVIDER_HOME_OBSERVATION_REQUEST_BYTES);
  assert.equal(created.request.subarray(0, 8).toString("ascii"), "CRDDPH01");
  assert.equal(created.request.readUInt16LE(8), 2);
  assert.equal(created.request[10], 2);
  assert.equal(created.request[11], 0);
  assert.deepEqual(created.request.subarray(12, 44), nonce);
  assert.equal(
    created.request.subarray(44, 76).equals(Buffer.alloc(32)),
    false,
  );
  assert.equal(created.request.includes(Buffer.from("C:\\", "ascii")), false);
  assert.equal(createProviderHomeObservationRequest("other", source), null);
  assert.equal(createProviderHomeObservationRequest("codex", ""), null);
  assert.equal(
    createProviderHomeObservationRequest("codex", source, () =>
      Buffer.alloc(31),
    ),
    null,
  );
});

test("Provider Home responseはnonce、Provider、全観測bitと三つのdomain hashを検証する", () => {
  const nonce = Buffer.alloc(32, 9);
  const result = evaluateProviderHomeObservationResponseCandidate(
    response(2, nonce),
    nonce,
    "claude",
  );
  assert.equal(result.status, "candidate");
  assert.equal(result.provider, "claude");
  assert.equal(result.selectedUserBindingVerified, true);
  assert.equal(result.protectionVerified, true);
  assert.equal(result.stableIdentityObserved, true);
  assert.equal(result.pathReported, false);
  assert.equal(result.principalReported, false);
  assert.equal(result.aclReported, false);
  assert.equal(result.credentialContentRead, false);
  assert.equal(result.runtimeAuthorityIssued, false);
  assert.equal(result.mountGrantIssued, false);
});

test("Provider Home responseは旧版、余分byte、未知bit、zero／重複hashを拒否する", () => {
  const nonce = Buffer.alloc(32, 4);
  const candidates: Buffer[] = [];
  const legacy = response(1, nonce);
  legacy.writeUInt16LE(0, 8);
  candidates.push(legacy);
  candidates.push(Buffer.concat([response(1, nonce), Buffer.from([0])]));
  const unknownPrincipal = response(1, nonce);
  unknownPrincipal.writeUInt32LE(0x183, 46);
  candidates.push(unknownPrincipal);
  const missingHomeFlag = response(1, nonce);
  missingHomeFlag.writeUInt32LE(0xff, 50);
  candidates.push(missingHomeFlag);
  const zeroHash = response(1, nonce);
  zeroHash.fill(0, 54, 86);
  candidates.push(zeroHash);
  const duplicateHash = response(1, nonce);
  duplicateHash.fill(1, 86, 118);
  candidates.push(duplicateHash);
  for (const candidate of candidates) {
    assert.equal(
      evaluateProviderHomeObservationResponseCandidate(
        candidate,
        nonce,
        "codex",
      ).status,
      "blocked",
    );
  }
  assert.equal(
    evaluateProviderHomeObservationResponseCandidate(
      response(1, nonce),
      Buffer.alloc(32, 5),
      "codex",
    ).status,
    "blocked",
  );
  assert.equal(
    evaluateProviderHomeObservationResponseCandidate(
      response(1, nonce),
      nonce,
      "claude",
    ).status,
    "blocked",
  );
});

test("Provider Home observation contractはcaller PathとCredential readを持たない", () => {
  const contract = describeProviderHomeObservationContract();
  assert.equal(contract.callerSuppliedPathAccepted, false);
  assert.equal(contract.requestPathField, false);
  assert.equal(contract.requestMountSourceHashField, true);
  assert.equal(contract.requestMountSourceHashAuthority, false);
  assert.equal(contract.credentialContentRead, false);
  assert.equal(contract.rawPathReported, false);
  assert.equal(contract.runtimeAuthorityIssued, false);
  assert.equal(contract.mountGrantIssued, false);
  const adapter = describeProviderHomeWindowsAdapterContract();
  assert.equal(adapter.shellInvocation, false);
  assert.equal(adapter.pathLookup, false);
  assert.equal(adapter.callerSuppliedPathAccepted, false);
  assert.equal(adapter.environment, "empty");
  assert.equal(
    adapter.processTreeTerminationConfirmation.includes("step_4"),
    true,
  );
  const invalid = inspectRuntimeOwnedWindowsProviderHomeCandidate(
    "other",
    "2026-08-24T00:00:00.000Z",
  );
  assert.equal(invalid.status, "blocked");
  assert.equal(invalid.helperSpawnAttempts, 0);
  assert.equal(invalid.runtimeOwnedObservationCapabilityIssued, false);
  assert.equal(consumeRuntimeOwnedProviderHomeObservationCapability({}), null);
});
