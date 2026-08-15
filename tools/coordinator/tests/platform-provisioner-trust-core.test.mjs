import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
  describePlatformProvisionerTrustCoreContract,
  verifyPlatformProvisionerManifestCandidate
} from "../src/security/platform-provisioner-trust-core.mjs";
import { canonicalizeProvisioningJsonValueCandidate } from
  "../src/security/provisioning-signature-primitives.mjs";

function frame(payload) {
  const bytes = canonicalizeProvisioningJsonValueCandidate(payload).canonicalBytes;
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  return Buffer.concat([Buffer.from(PLATFORM_PROVISIONER_MANIFEST_DOMAIN, "ascii"), length, bytes]);
}

function fixture() {
  const signer = generateKeyPairSync("ed25519");
  const spki = signer.publicKey.export({ format: "der", type: "spki" });
  const keyId = createHash("sha256").update(spki).digest("hex");
  const executableSha256 = "1".repeat(64);
  const payload = {
    contract: "crdd-coordinator/platform-provisioner-manifest",
    contractRevision: 1,
    platform: "windows",
    architecture: "x64",
    provisionerVersion: "1.0.0",
    executableSha256,
    rootProtectionPolicySha256: "2".repeat(64),
    keyStoragePolicySha256: "3".repeat(64),
    issuedAt: "2026-08-15T00:00:00.000Z",
    expiresAt: "2027-08-15T00:00:00.000Z"
  };
  const manifestEnvelope = {
    contract: "crdd-coordinator/platform-provisioner-manifest-envelope",
    contractRevision: 1,
    payload,
    signatures: [{ keyId, algorithm: "Ed25519",
      signature: sign(null, frame(payload), signer.privateKey).toString("base64url") }]
  };
  return { manifestEnvelope, releaseSignerSpkiDer: spki, executableSha256 };
}

test("Qual-Lab manifest cryptographic match remains non-authoritative without native signature", () => {
  const value = fixture();
  const result = verifyPlatformProvisionerManifestCandidate({
    manifestEnvelope: value.manifestEnvelope,
    releaseSignerSpkiDer: value.releaseSignerSpkiDer,
    observedExecutableSha256: value.executableSha256,
    evaluationTime: "2026-08-15T12:00:00.000Z"
  });
  assert.equal(result.status, "candidate");
  assert.equal(result.qualLabManifestCryptographicMatch, true);
  assert.equal(result.osNativeCodeSignatureConfirmed, false);
  assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
  assert.equal(result.filesystemEffectIssued, false);
  for (const key of ["executableSha256", "keyId", "signature", "spkiDer", "canonicalBytes"]) {
    assert.equal(key in result, false);
  }
});

test("digest, signature, time and exact envelope mismatches fail closed", () => {
  const base = fixture();
  const verify = (overrides = {}) => verifyPlatformProvisionerManifestCandidate({
    manifestEnvelope: base.manifestEnvelope,
    releaseSignerSpkiDer: base.releaseSignerSpkiDer,
    observedExecutableSha256: base.executableSha256,
    evaluationTime: "2026-08-15T12:00:00.000Z",
    ...overrides
  });
  assert.equal(verify({ observedExecutableSha256: "f".repeat(64) }).status, "blocked");
  assert.equal(verify({ evaluationTime: "2027-08-15T00:00:00.000Z" }).reason,
    "platform_provisioner_manifest_not_current");
  assert.equal(verify({ manifestEnvelope: { ...base.manifestEnvelope, extra: true } }).status,
    "blocked");
  const changed = structuredClone(base.manifestEnvelope);
  changed.signatures[0].signature = `${changed.signatures[0].signature[0] === "A" ? "B" : "A"}` +
    changed.signatures[0].signature.slice(1);
  assert.equal(verify({ manifestEnvelope: changed }).status, "blocked");
});

test("contract requires dual packaged-build verification and keeps local development dry-run only", () => {
  const contract = describePlatformProvisionerTrustCoreContract();
  assert.equal(contract.manifestCryptographicVerification, "implemented_candidate");
  assert.equal(contract.packagedBuildAcceptance,
    "os_native_code_signature_and_qual_lab_manifest_both_required_before_effect_target");
  assert.equal(contract.localDevelopmentBehavior,
    "dry_run_and_test_only_without_trust_gate_or_filesystem_effect_target");
  assert.equal(contract.explicitProvisionCommandRequired, true);
  assert.equal(contract.rsaOrAlternateCurveFallback, false);
  assert.equal(contract.windowsNativeSignatureAdapter, "not_implemented_winverifytrust_target");
  assert.equal(contract.filesystemEffectIssued, false);
});
