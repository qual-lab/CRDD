import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
  PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_REVISION,
  calculatePlatformProvisionerPackageContentRootCandidate,
  calculateRuntimeExecutionIdentityCandidate,
  compilePlatformProvisionerManifestPayloadCandidate,
  describePlatformProvisionerTrustCoreContract,
  verifyHistoricalPlatformProvisionerManifestCandidate,
  verifyPlatformProvisionerManifestCandidate,
} from "../src/security/platform-provisioner-trust-core.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../src/security/provisioning-signature-primitives.ts";

function fixture() {
  const signer = generateKeyPairSync("ed25519");
  const spki = signer.publicKey.export({ type: "spki", format: "der" });
  const observedPackageContent = {
    packageName: "@qual-lab/crdd-coordinator",
    packageVersion: "0.0.0-development",
    files: [
      { path: "bin/coordinator.ts", byteLength: 12, sha256: "1".repeat(64) },
      { path: "package.json", byteLength: 24, sha256: "2".repeat(64) },
    ],
  };
  const content = calculatePlatformProvisionerPackageContentRootCandidate(
    observedPackageContent,
  );
  assert.equal(content.status, "candidate");
  const executionFields = {
    packageName: observedPackageContent.packageName,
    packageVersion: observedPackageContent.packageVersion,
    packageContentRootSha256: content.packageContentRootSha256,
    rootProtectionPolicySha256: "3".repeat(64),
    keyStoragePolicySha256: "4".repeat(64),
    platformAccessArtifact: {
      relativePath:
        "template/tools/coordinator/windows-x64/crdd-platform-access.exe",
      target: "x86_64-pc-windows-msvc",
      protocolRevision: 3,
      rustToolchain: "1.94.1",
      byteLength: 212_992,
      sha256: "5".repeat(64),
    },
  };
  const runtimeIdentity =
    calculateRuntimeExecutionIdentityCandidate(executionFields);
  assert.equal(runtimeIdentity.status, "candidate");
  const payload = {
    contract: PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
    contractRevision: PLATFORM_PROVISIONER_MANIFEST_REVISION,
    crddVersion: "v0.18.1",
    releaseSequence: 2026090102,
    crddCommit: "a".repeat(40),
    crddTree: "b".repeat(40),
    ...executionFields,
    runtimeExecutionIdentitySha256:
      runtimeIdentity.runtimeExecutionIdentitySha256,
    issuedAt: "2026-09-01T00:00:00.000Z",
    expiresAt: null,
  };
  const compiled = compilePlatformProvisionerManifestPayloadCandidate({
    manifestPayload: payload,
  });
  assert.equal(compiled.status, "candidate");
  const envelope = {
    contract: PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
    contractRevision: PLATFORM_PROVISIONER_MANIFEST_REVISION,
    payload,
    signatures: [
      {
        keyId: createHash("sha256").update(spki).digest("hex"),
        algorithm: "Ed25519",
        signature: sign(null, compiled.message, signer.privateKey).toString(
          "base64url",
        ),
      },
    ],
  };
  return {
    manifestEnvelope: envelope,
    releaseSignerSpkiDer: spki,
    observedPackageContent,
    evaluationTime: "2026-09-01T01:00:00.000Z",
  };
}

test("revision 5 manifestは閉じた実行集合とPlatform Access成果物を署名境界へ含める", () => {
  const result = verifyPlatformProvisionerManifestCandidate(fixture());
  assert.equal(result.status, "candidate");
  assert.equal(result.crddVersion, "v0.18.1");
  assert.equal(result.platformAccessArtifact.sha256, "5".repeat(64));
  assert.equal("nativeProvisionSupervisorArtifact" in result, false);
  assert.equal(result.runtimeAuthorityConferred, false);
  assert.equal(result.runtimeCapabilityIssued, false);
});

test("旧revision 2署名は履歴由来の確認だけに受理し現在の実行Authorityへ昇格しない", () => {
  const signer = generateKeyPairSync("ed25519");
  const spki = signer.publicKey.export({ type: "spki", format: "der" });
  const payload = {
    contract: PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
    contractRevision: 2,
    crddCommit: "a".repeat(40),
    crddTree: "b".repeat(40),
    crddVersion: "v0.18.0",
    expiresAt: "2026-09-07T00:00:00.000Z",
    issuedAt: "2026-08-31T00:00:00.000Z",
    keyStoragePolicySha256: "1".repeat(64),
    nativeProvisionSupervisorArtifact: {
      byteLength: 120_832,
      entrypointContractRevision: 2,
      relativePath:
        "90_Release/coordinator/x86_64-pc-windows-msvc/coordinator.exe",
      rustToolchain: "1.94.1",
      sha256: "2".repeat(64),
      target: "x86_64-pc-windows-msvc",
    },
    packageContentRootSha256: "3".repeat(64),
    packageName: "@qual-lab/crdd-coordinator",
    packageVersion: "0.0.0-development",
    platformAccessArtifact: {
      byteLength: 212_992,
      protocolRevision: 3,
      relativePath:
        "90_Release/platform-access/x86_64-pc-windows-msvc/crdd-platform-access.exe",
      rustToolchain: "1.94.1",
      sha256: "4".repeat(64),
      target: "x86_64-pc-windows-msvc",
    },
    releaseSequence: 2026083108,
    rootProtectionPolicySha256: "5".repeat(64),
  };
  const canonical = canonicalizeProvisioningJsonValueCandidate(payload);
  assert.equal(canonical.status, "candidate");
  if (canonical.status !== "candidate") return;
  const prefix = Buffer.from(
    "CRDD\0PLATFORM-PROVISIONER-PACKAGE-MANIFEST\0V2\0",
    "ascii",
  );
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.canonicalBytes.length));
  const message = Buffer.concat([prefix, length, canonical.canonicalBytes]);
  const envelope = {
    contract: PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
    contractRevision: 2,
    payload,
    signatures: [
      {
        keyId: createHash("sha256").update(spki).digest("hex"),
        algorithm: "Ed25519",
        signature: sign(null, message, signer.privateKey).toString("base64url"),
      },
    ],
  };
  const historical = verifyHistoricalPlatformProvisionerManifestCandidate(
    envelope,
    spki,
  );
  assert.equal(historical?.historicalSignatureVerified, true);
  assert.equal(historical?.runtimeAuthorityConferred, false);
  assert.equal(historical?.runtimeCapabilityIssued, false);
  assert.equal(
    verifyPlatformProvisionerManifestCandidate({
      manifestEnvelope: envelope,
      releaseSignerSpkiDer: spki,
      observedPackageContent: fixture().observedPackageContent,
      evaluationTime: "2026-09-01T00:00:00.000Z",
    }).status,
    "blocked",
  );
});

test("削除済みnative supervisor fieldと旧revisionを受理しない", () => {
  for (const mutate of [
    (value: ReturnType<typeof fixture>) => {
      value.manifestEnvelope.payload.contractRevision = 3;
      value.manifestEnvelope.contractRevision = 3;
    },
    (value: ReturnType<typeof fixture>) => {
      Object.assign(value.manifestEnvelope.payload, {
        nativeProvisionSupervisorArtifact: {
          relativePath:
            "template/tools/coordinator/windows-x64/coordinator.exe",
        },
      });
    },
  ]) {
    const value = fixture();
    mutate(value);
    assert.equal(
      verifyPlatformProvisionerManifestCandidate(value).status,
      "blocked",
    );
  }
});

test("署名・package内容・有効期間の差をfail closedにする", () => {
  const mutations: Array<(value: ReturnType<typeof fixture>) => void> = [
    (value) => {
      const signature = value.manifestEnvelope.signatures[0];
      assert.ok(signature);
      signature.signature = "A".repeat(86);
    },
    (value) => {
      const file = value.observedPackageContent.files[0];
      assert.ok(file);
      file.sha256 = "f".repeat(64);
    },
    (value) => {
      value.evaluationTime = "2026-08-31T23:59:59.999Z";
    },
  ];
  for (const mutate of mutations) {
    const value = fixture();
    mutate(value);
    const result = verifyPlatformProvisionerManifestCandidate(value);
    assert.equal(result.status, "blocked");
    assert.equal(result.runtimeAuthorityConferred, false);
    assert.equal(result.filesystemEffectIssued, false);
  }
});

test("package内容Rootは順序をexactに検証する", () => {
  const value = fixture();
  assert.equal(
    calculatePlatformProvisionerPackageContentRootCandidate(
      value.observedPackageContent,
    ).status,
    "candidate",
  );
  value.observedPackageContent.files.reverse();
  assert.equal(
    calculatePlatformProvisionerPackageContentRootCandidate(
      value.observedPackageContent,
    ).status,
    "blocked",
  );
});

test("Runtime Execution IdentityはRelease provenanceから独立し、Policy・Native差を検出する", () => {
  const value = fixture();
  const payload = value.manifestEnvelope.payload;
  const executionFields = {
    packageName: payload.packageName,
    packageVersion: payload.packageVersion,
    packageContentRootSha256: payload.packageContentRootSha256,
    rootProtectionPolicySha256: payload.rootProtectionPolicySha256,
    keyStoragePolicySha256: payload.keyStoragePolicySha256,
    platformAccessArtifact: payload.platformAccessArtifact,
  };
  const identity = calculateRuntimeExecutionIdentityCandidate(executionFields);
  assert.equal(identity.status, "candidate");
  const provenanceChanged = calculateRuntimeExecutionIdentityCandidate({
    ...executionFields,
  });
  if (provenanceChanged.status !== "candidate")
    assert.fail(provenanceChanged.reason);
  assert.equal(
    provenanceChanged.runtimeExecutionIdentitySha256,
    identity.runtimeExecutionIdentitySha256,
  );
  const policyChanged = calculateRuntimeExecutionIdentityCandidate({
    ...executionFields,
    rootProtectionPolicySha256: "f".repeat(64),
  });
  if (policyChanged.status !== "candidate") assert.fail(policyChanged.reason);
  assert.notEqual(
    policyChanged.runtimeExecutionIdentitySha256,
    identity.runtimeExecutionIdentitySha256,
  );
  const nativeChanged = calculateRuntimeExecutionIdentityCandidate({
    ...executionFields,
    platformAccessArtifact: {
      ...executionFields.platformAccessArtifact,
      sha256: "e".repeat(64),
    },
  });
  if (nativeChanged.status !== "candidate") assert.fail(nativeChanged.reason);
  assert.notEqual(
    nativeChanged.runtimeExecutionIdentitySha256,
    identity.runtimeExecutionIdentitySha256,
  );
});

test("Trust Coreの説明は単一Native成果物と非権限性を示す", () => {
  const contract = describePlatformProvisionerTrustCoreContract();
  assert.equal(contract.contractRevision, 5);
  assert.equal(contract.manifestDomain, PLATFORM_PROVISIONER_MANIFEST_DOMAIN);
  assert.equal(contract.dedicatedPlatformAccessExecutableRequiredForV1, true);
  assert.equal("explicitProvisionCommandRequired" in contract, false);
  assert.equal("dedicatedNativeExecutableRequiredForV1" in contract, false);
  assert.equal(contract.runtimeCapabilityIssued, false);
});
