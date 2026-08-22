import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  evaluatePlatformProvisionerPackageGateCandidate,
  describePlatformProvisionerPackageGateContract,
} from "../src/security/platform-provisioner-package-gate.ts";
import {
  PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
  PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
  calculatePlatformProvisionerPackageContentRootCandidate,
} from "../src/security/platform-provisioner-trust-core.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../src/security/provisioning-signature-primitives.ts";
import { assertCanonicalCandidate } from "./test-support.ts";

function frame(payload: Record<string, unknown>) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(payload);
  assertCanonicalCandidate(canonical);
  const bytes = canonical.canonicalBytes;
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  return Buffer.concat([
    Buffer.from(PLATFORM_PROVISIONER_MANIFEST_DOMAIN, "ascii"),
    length,
    bytes,
  ]);
}

function fixture() {
  const release = generateKeyPairSync("ed25519");
  const spki = release.publicKey.export({ format: "der", type: "spki" });
  const keyId = createHash("sha256").update(spki).digest("hex");
  const observedPackageContent = {
    packageName: "@qual-lab/crdd-coordinator",
    packageVersion: "0.0.0-development",
    files: [
      { path: "bin/coordinator.ts", byteLength: 100, sha256: "1".repeat(64) },
    ],
  };
  const packageRoot = calculatePlatformProvisionerPackageContentRootCandidate(
    observedPackageContent,
  );
  if (packageRoot.status !== "candidate") {
    assert.fail(`fixture package content was invalid: ${packageRoot.reason}`);
  }
  const packageContentRootSha256 = packageRoot.packageContentRootSha256;
  const payload = {
    contract: PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
    contractRevision: 1,
    packageName: observedPackageContent.packageName,
    packageVersion: observedPackageContent.packageVersion,
    crddVersion: "v0.18.0",
    releaseSequence: 18,
    crddCommit: "a".repeat(40),
    crddTree: "b".repeat(40),
    packageContentRootSha256,
    rootProtectionPolicySha256: "2".repeat(64),
    keyStoragePolicySha256: "3".repeat(64),
    platformAccessArtifact: {
      relativePath:
        "90_Release/platform-access/x86_64-pc-windows-msvc/crdd-platform-access.exe",
      target: "x86_64-pc-windows-msvc",
      protocolRevision: 3,
      rustToolchain: "1.94.1",
      byteLength: 1024,
      sha256: "4".repeat(64),
    },
    issuedAt: "2026-08-15T00:00:00.000Z",
    expiresAt: "2027-08-15T00:00:00.000Z",
  };
  const manifestEnvelope = {
    contract: PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
    contractRevision: 1,
    payload,
    signatures: [
      {
        keyId,
        algorithm: "Ed25519",
        signature: sign(null, frame(payload), release.privateKey).toString(
          "base64url",
        ),
      },
    ],
  };
  return {
    manifestVerificationInput: {
      manifestEnvelope,
      releaseSignerSpkiDer: spki,
      observedPackageContent,
      evaluationTime: "2026-08-15T12:00:00.000Z",
    },
    crddDistributionObservation: {
      packageName: observedPackageContent.packageName,
      packageVersion: observedPackageContent.packageVersion,
      packageContentRootSha256,
      crddVersion: payload.crddVersion,
      crddCommit: payload.crddCommit,
      crddTree: payload.crddTree,
      distributionVerdict: "verified_crdd_bundle",
      bundledPackageIdentityStable: true,
      permissionPolicyMatch: true,
    },
    expectedCrddVersion: payload.crddVersion,
    expectedCrddCommit: payload.crddCommit,
    expectedCrddTree: payload.crddTree,
  };
}

test("CRDD bundle and manifest observations match but remain non-authoritative", () => {
  const result = evaluatePlatformProvisionerPackageGateCandidate(fixture());
  assert.equal(result.status, "candidate");
  assert.equal(result.packageTrustObservationMatch, true);
  assert.equal(result.crddDistributionObservationRuntimeOwned, false);
  assert.equal(result.effectAuthorizationIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  for (const key of [
    "files",
    "packageContentRootSha256",
    "signature",
    "spkiDer",
  ]) {
    assert.equal(key in result, false);
  }
});

test("CRDD version, Commit, Tree, content, identity and permission mismatches fail closed", () => {
  const mutations: Array<(value: ReturnType<typeof fixture>) => void> = [
    (value) => {
      value.crddDistributionObservation.distributionVerdict = "missing";
    },
    (value) => {
      value.crddDistributionObservation.crddVersion = "v0.17.0";
    },
    (value) => {
      value.crddDistributionObservation.crddCommit = "c".repeat(40);
    },
    (value) => {
      value.crddDistributionObservation.crddTree = "d".repeat(40);
    },
    (value) => {
      value.crddDistributionObservation.packageContentRootSha256 = "f".repeat(
        64,
      );
    },
    (value) => {
      value.expectedCrddVersion = "v0.17.0";
    },
    (value) => {
      value.expectedCrddCommit = "e".repeat(40);
    },
    (value) => {
      value.expectedCrddTree = "f".repeat(40);
    },
    (value) => {
      value.crddDistributionObservation.bundledPackageIdentityStable = false;
    },
    (value) => {
      value.crddDistributionObservation.permissionPolicyMatch = false;
    },
  ];
  for (const mutate of mutations) {
    const value = fixture();
    mutate(value);
    assert.equal(
      evaluatePlatformProvisionerPackageGateCandidate(value).status,
      "blocked",
    );
  }
});

test("package gate cannot treat caller CRDD observations as Effect authorization", () => {
  const contract = describePlatformProvisionerPackageGateContract();
  assert.equal(
    contract.distributionModel,
    "crdd_bundled_private_typescript_package",
  );
  assert.equal(
    contract.observationContract,
    "implemented_candidate_non_authoritative",
  );
  assert.equal(contract.runtimeOwnedCrddDistributionAdapter, "not_implemented");
  assert.equal(
    contract.crddVersionCommitAndTreeBinding,
    "implemented_candidate",
  );
  assert.equal(contract.callerObservationMayAuthorizeEffect, false);
  assert.equal(contract.standalonePackageMayAuthorizeEffect, false);
  assert.equal(contract.effectAuthorizationIssued, false);
  assert.equal(
    contract.effectController,
    "not_implemented_effective_access_required",
  );
});
