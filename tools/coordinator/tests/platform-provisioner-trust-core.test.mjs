import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
  PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
  calculatePlatformProvisionerPackageContentRootCandidate,
  describePlatformProvisionerTrustCoreContract,
  verifyPlatformProvisionerManifestCandidate
} from "../src/security/platform-provisioner-trust-core.ts";
import { canonicalizeProvisioningJsonValueCandidate } from
  "../src/security/provisioning-signature-primitives.ts";

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
  const observedPackageContent = {
    packageName: "@qual-lab/crdd-coordinator",
    packageVersion: "0.0.0-development",
    files: [
      { path: "bin/coordinator.ts", byteLength: 100, sha256: "1".repeat(64) },
      { path: "package.json", byteLength: 300, sha256: "2".repeat(64) },
      { path: "src/core/doctor.mjs", byteLength: 500, sha256: "3".repeat(64) }
    ]
  };
  const packageContentRootSha256 = calculatePlatformProvisionerPackageContentRootCandidate(
    observedPackageContent).packageContentRootSha256;
  const payload = {
    contract: PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
    contractRevision: 1,
    packageName: observedPackageContent.packageName,
    packageVersion: observedPackageContent.packageVersion,
    crddRevision: "a".repeat(40),
    packageContentRootSha256,
    rootProtectionPolicySha256: "4".repeat(64),
    keyStoragePolicySha256: "5".repeat(64),
    issuedAt: "2026-08-15T00:00:00.000Z",
    expiresAt: "2027-08-15T00:00:00.000Z"
  };
  const manifestEnvelope = {
    contract: PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
    contractRevision: 1,
    payload,
    signatures: [{
      keyId,
      algorithm: "Ed25519",
      signature: sign(null, frame(payload), signer.privateKey).toString("base64url")
    }]
  };
  return {
    manifestEnvelope,
    releaseSignerSpkiDer: spki,
    observedPackageContent,
    evaluationTime: "2026-08-15T12:00:00.000Z"
  };
}

test("signed package manifest matches exact CRDD-bundled package content but remains non-authoritative", () => {
  const result = verifyPlatformProvisionerManifestCandidate(fixture());
  assert.equal(result.status, "candidate");
  assert.equal(result.packageName, "@qual-lab/crdd-coordinator");
  assert.equal(result.qualLabManifestCryptographicMatch, true);
  assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
  assert.equal(result.crddDistributionConfirmed, false);
  assert.equal(result.runtimeOwnedPackageFilesystemConfirmed, false);
  assert.equal(result.filesystemEffectIssued, false);
  for (const key of ["files", "signature", "spkiDer", "releaseSignerSpkiDer"]) {
    assert.equal(key in result, false);
  }
});

test("package name, version, file ordering, path and digest mismatches fail closed", () => {
  for (const mutate of [
    (value) => { value.observedPackageContent.packageName = "@other/package"; },
    (value) => { value.observedPackageContent.packageVersion = "1.0.0"; },
    (value) => { value.observedPackageContent.files[0].sha256 = "f".repeat(64); },
    (value) => { value.observedPackageContent.files.reverse(); },
    (value) => { value.observedPackageContent.files[0].path = "../escape.mjs"; },
    (value) => { value.manifestEnvelope.payload.packageContentRootSha256 = "e".repeat(64); }
  ]) {
    const value = fixture();
    mutate(value);
    assert.equal(verifyPlatformProvisionerManifestCandidate(value).status, "blocked");
  }
});

test("manifest signature, role, lifetime and exact envelope fail closed", () => {
  for (const mutate of [
    (value) => { value.manifestEnvelope.signatures[0].signature = "A".repeat(86); },
    (value) => { value.manifestEnvelope.signatures[0].algorithm = "ECDSA"; },
    (value) => { value.manifestEnvelope.signatures.push(value.manifestEnvelope.signatures[0]); },
    (value) => { value.evaluationTime = "2028-01-01T00:00:00.000Z"; },
    (value) => { value.manifestEnvelope.extra = true; }
  ]) {
    const value = fixture();
    mutate(value);
    assert.equal(verifyPlatformProvisionerManifestCandidate(value).status, "blocked");
  }
});

test("package trust contract requires CRDD-bundled use and no native executable", () => {
  const contract = describePlatformProvisionerTrustCoreContract();
  assert.equal(contract.distributionModel, "crdd_bundled_private_mjs_package");
  assert.equal(contract.dedicatedNativeExecutableRequiredForV1, false);
  assert.equal(contract.osNativeCodeSignatureRequiredForV1, false);
  assert.equal(contract.standalonePackagePublicationAllowed, false);
  assert.equal(contract.standalonePackageInstallationAllowed, false);
  assert.equal(contract.runtimeOwnedCrddDistributionVerification,
    "not_implemented_crdd_release_identity_target");
  assert.equal(contract.filesystemEffectIssued, false);
});

test("coordinator package metadata remains private without a standalone command surface", async () => {
  const packageMetadata = JSON.parse(await readFile(
    new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageMetadata.private, true);
  assert.equal("bin" in packageMetadata, false);
});
