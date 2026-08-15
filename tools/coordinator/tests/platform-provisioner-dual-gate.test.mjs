import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  evaluatePlatformProvisionerDualGateCandidate,
  describePlatformProvisionerDualGateContract
} from "../src/security/platform-provisioner-dual-gate.mjs";
import { PLATFORM_PROVISIONER_MANIFEST_DOMAIN } from
  "../src/security/platform-provisioner-trust-core.mjs";
import { canonicalizeProvisioningJsonValueCandidate } from
  "../src/security/provisioning-signature-primitives.mjs";

function frame(payload) {
  const bytes = canonicalizeProvisioningJsonValueCandidate(payload).canonicalBytes;
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  return Buffer.concat([Buffer.from(PLATFORM_PROVISIONER_MANIFEST_DOMAIN, "ascii"), length, bytes]);
}

function fixture() {
  const release = generateKeyPairSync("ed25519");
  const spki = release.publicKey.export({ format: "der", type: "spki" });
  const keyId = createHash("sha256").update(spki).digest("hex");
  const executableSha256 = "1".repeat(64);
  const nativeSignerIdentitySha256 = "4".repeat(64);
  const payload = {
    contract: "crdd-coordinator/platform-provisioner-manifest", contractRevision: 1,
    platform: "windows", architecture: "x64", provisionerVersion: "1.0.0",
    executableSha256, rootProtectionPolicySha256: "2".repeat(64),
    keyStoragePolicySha256: "3".repeat(64), issuedAt: "2026-08-15T00:00:00.000Z",
    expiresAt: "2027-08-15T00:00:00.000Z"
  };
  const manifestEnvelope = {
    contract: "crdd-coordinator/platform-provisioner-manifest-envelope", contractRevision: 1,
    payload, signatures: [{ keyId, algorithm: "Ed25519",
      signature: sign(null, frame(payload), release.privateKey).toString("base64url") }]
  };
  return {
    manifestVerificationInput: { manifestEnvelope, releaseSignerSpkiDer: spki,
      observedExecutableSha256: executableSha256,
      evaluationTime: "2026-08-15T12:00:00.000Z" },
    nativeObservation: { platform: "windows", verifier: "winverifytrust", verdict: "valid",
      signerIdentitySha256: nativeSignerIdentitySha256, executableSha256,
      fileIdentityStable: true, permissionPolicyMatch: true },
    expectedNativeSignerIdentitySha256: nativeSignerIdentitySha256
  };
}

test("dual observation match remains non-authoritative until Runtime adapters own every input", () => {
  const result = evaluatePlatformProvisionerDualGateCandidate(fixture());
  assert.equal(result.status, "candidate");
  assert.equal(result.dualVerificationObservationMatch, true);
  assert.equal(result.nativeObservationRuntimeOwned, false);
  assert.equal(result.effectAuthorizationIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  for (const key of ["signerIdentitySha256", "executableSha256", "signature", "spkiDer"]) {
    assert.equal(key in result, false);
  }
});

test("platform, verifier, digest, signer, identity and permission mismatches fail closed", () => {
  for (const mutate of [
    (value) => { value.nativeObservation.verifier = "secstaticcodecheckvalidity"; },
    (value) => { value.nativeObservation.executableSha256 = "f".repeat(64); },
    (value) => { value.expectedNativeSignerIdentitySha256 = "e".repeat(64); },
    (value) => { value.nativeObservation.fileIdentityStable = false; },
    (value) => { value.nativeObservation.permissionPolicyMatch = false; }
  ]) {
    const value = fixture();
    mutate(value);
    assert.equal(evaluatePlatformProvisionerDualGateCandidate(value).status, "blocked");
  }
});

test("dual gate contract does not treat caller observations as Effect authorization", () => {
  const contract = describePlatformProvisionerDualGateContract();
  assert.equal(contract.observationContract, "implemented_candidate_non_authoritative");
  assert.equal(contract.runtimeOwnedNativeAdapters, "not_implemented");
  assert.equal(contract.callerObservationMayAuthorizeEffect, false);
  assert.equal(contract.localDevelopmentMayAuthorizeEffect, false);
  assert.equal(contract.effectAuthorizationIssued, false);
});
