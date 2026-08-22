import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign, verify } from "node:crypto";
import type { KeyObject } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
  PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
  calculatePlatformProvisionerPackageContentRootCandidate,
  describePlatformProvisionerTrustCoreContract,
  verifyPlatformProvisionerManifestCandidate,
} from "../src/security/platform-provisioner-trust-core.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../src/security/provisioning-signature-primitives.ts";
import { assertCanonicalCandidate, assertPresent } from "./test-support.ts";

const HISTORICAL_PLATFORM_PROVISIONER_MANIFEST_DOMAIN =
  "CRDD\0PLATFORM-PROVISIONER-PACKAGE-MANIFEST\0V1\0";
const fixturePrivateKeys = new WeakMap<object, KeyObject>();

function frame(
  payload: Record<string, unknown>,
  domain = PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(payload);
  assertCanonicalCandidate(canonical);
  const bytes = canonical.canonicalBytes;
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  return Buffer.concat([Buffer.from(domain, "ascii"), length, bytes]);
}

function fixture(protocolRevision = 3) {
  const signer = generateKeyPairSync("ed25519");
  const spki = signer.publicKey.export({ format: "der", type: "spki" });
  const keyId = createHash("sha256").update(spki).digest("hex");
  const observedPackageContent = {
    packageName: "@qual-lab/crdd-coordinator",
    packageVersion: "0.0.0-development",
    files: [
      { path: "bin/coordinator.ts", byteLength: 100, sha256: "1".repeat(64) },
      { path: "package.json", byteLength: 300, sha256: "2".repeat(64) },
      { path: "src/core/doctor.ts", byteLength: 500, sha256: "3".repeat(64) },
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
    contractRevision: 2,
    packageName: observedPackageContent.packageName,
    packageVersion: observedPackageContent.packageVersion,
    crddVersion: "v0.18.0",
    releaseSequence: 18,
    crddCommit: "a".repeat(40),
    crddTree: "b".repeat(40),
    packageContentRootSha256,
    rootProtectionPolicySha256: "4".repeat(64),
    keyStoragePolicySha256: "5".repeat(64),
    platformAccessArtifact: {
      relativePath:
        "90_Release/platform-access/x86_64-pc-windows-msvc/crdd-platform-access.exe",
      target: "x86_64-pc-windows-msvc",
      protocolRevision,
      rustToolchain: "1.94.1",
      byteLength: 1024,
      sha256: "6".repeat(64),
    },
    nativeProvisionSupervisorArtifact: {
      relativePath:
        "90_Release/coordinator/x86_64-pc-windows-msvc/coordinator.exe",
      target: "x86_64-pc-windows-msvc",
      entrypointContractRevision: 2,
      rustToolchain: "1.94.1",
      byteLength: 2048,
      sha256: "7".repeat(64),
    },
    issuedAt: "2026-08-15T00:00:00.000Z",
    expiresAt: "2027-08-15T00:00:00.000Z",
  };
  const manifestEnvelope = {
    contract: PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
    contractRevision: 2,
    payload,
    signatures: [
      {
        keyId,
        algorithm: "Ed25519",
        signature: sign(null, frame(payload), signer.privateKey).toString(
          "base64url",
        ),
      },
    ],
  };
  const value = {
    manifestEnvelope,
    releaseSignerSpkiDer: spki,
    observedPackageContent,
    evaluationTime: "2026-08-15T12:00:00.000Z",
  };
  fixturePrivateKeys.set(value, signer.privateKey);
  return value;
}

function resign(
  value: ReturnType<typeof fixture>,
  domain = PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
) {
  const signatureEntry = value.manifestEnvelope.signatures[0];
  assertPresent(signatureEntry);
  const privateKey = fixturePrivateKeys.get(value);
  assertPresent(privateKey);
  signatureEntry.signature = sign(
    null,
    frame(value.manifestEnvelope.payload, domain),
    privateKey,
  ).toString("base64url");
}

function assertSignatureValid(
  value: ReturnType<typeof fixture>,
  domain = PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
) {
  const signatureEntry = value.manifestEnvelope.signatures[0];
  assertPresent(signatureEntry);
  assert.equal(
    verify(
      null,
      frame(value.manifestEnvelope.payload, domain),
      { key: value.releaseSignerSpkiDer, format: "der", type: "spki" },
      Buffer.from(signatureEntry.signature, "base64url"),
    ),
    true,
  );
}

test("correctly signed revision 2 platform artifact is rejected only after cryptographic validity", () => {
  const value = fixture(2);
  const message = frame(value.manifestEnvelope.payload);
  const signatureEntry = value.manifestEnvelope.signatures[0];
  assertPresent(signatureEntry);
  const signature = Buffer.from(signatureEntry.signature, "base64url");
  assert.equal(
    verify(
      null,
      message,
      { key: value.releaseSignerSpkiDer, format: "der", type: "spki" },
      signature,
    ),
    true,
  );

  const result = verifyPlatformProvisionerManifestCandidate(value);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "platform_provisioner_manifest_or_package_content_mismatch",
  );
  assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
  assert.equal(result.crddDistributionConfirmed, false);
  assert.equal(result.runtimeOwnedPackageFilesystemConfirmed, false);
  assert.equal(result.runtimeAuthorityConferred, false);
  assert.equal(result.runtimeCapabilityIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.networkEffectIssued, false);
});

test("signed package manifest matches exact CRDD-bundled package content but remains non-authoritative", () => {
  const result = verifyPlatformProvisionerManifestCandidate(fixture());
  assert.equal(result.status, "candidate");
  assert.equal(result.packageName, "@qual-lab/crdd-coordinator");
  assert.equal(result.crddVersion, "v0.18.0");
  assert.equal(result.releaseSequence, 18);
  assert.equal(result.crddCommit, "a".repeat(40));
  assert.equal(result.crddTree, "b".repeat(40));
  assert.equal(result.rootProtectionPolicySha256, "4".repeat(64));
  assert.equal(result.keyStoragePolicySha256, "5".repeat(64));
  assert.deepEqual(result.platformAccessArtifact, {
    relativePath:
      "90_Release/platform-access/x86_64-pc-windows-msvc/crdd-platform-access.exe",
    target: "x86_64-pc-windows-msvc",
    protocolRevision: 3,
    rustToolchain: "1.94.1",
    byteLength: 1024,
    sha256: "6".repeat(64),
  });
  assert.deepEqual(result.nativeProvisionSupervisorArtifact, {
    relativePath:
      "90_Release/coordinator/x86_64-pc-windows-msvc/coordinator.exe",
    target: "x86_64-pc-windows-msvc",
    entrypointContractRevision: 2,
    rustToolchain: "1.94.1",
    byteLength: 2048,
    sha256: "7".repeat(64),
  });
  assert.equal(result.qualLabManifestCryptographicMatch, true);
  assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
  assert.equal(result.crddDistributionConfirmed, false);
  assert.equal(result.runtimeOwnedPackageFilesystemConfirmed, false);
  assert.equal(result.runtimeAuthorityConferred, false);
  assert.equal(result.runtimeCapabilityIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.networkEffectIssued, false);
  for (const key of ["files", "signature", "spkiDer", "releaseSignerSpkiDer"]) {
    assert.equal(key in result, false);
  }
});

test("package name, version, file ordering, path and digest mismatches fail closed", () => {
  const mutations: Array<(value: ReturnType<typeof fixture>) => void> = [
    (value) => {
      value.observedPackageContent.packageName = "@other/package";
    },
    (value) => {
      value.observedPackageContent.packageVersion = "1.0.0";
    },
    (value) => {
      const file = value.observedPackageContent.files[0];
      assertPresent(file);
      file.sha256 = "f".repeat(64);
    },
    (value) => {
      value.observedPackageContent.files.reverse();
    },
    (value) => {
      const file = value.observedPackageContent.files[0];
      assertPresent(file);
      file.path = "../escape.mjs";
    },
    (value) => {
      value.manifestEnvelope.payload.packageContentRootSha256 = "e".repeat(64);
    },
    (value) => {
      value.manifestEnvelope.payload.crddVersion = "0.18.0";
    },
    (value) => {
      value.manifestEnvelope.payload.crddCommit = "A".repeat(40);
    },
    (value) => {
      value.manifestEnvelope.payload.crddTree = "b".repeat(39);
    },
    (value) => {
      value.manifestEnvelope.payload.platformAccessArtifact.relativePath =
        "90_Release/platform-access/wrong.exe";
    },
    (value) => {
      value.manifestEnvelope.payload.platformAccessArtifact.target =
        "aarch64-pc-windows-msvc";
    },
    (value) => {
      value.manifestEnvelope.payload.platformAccessArtifact.protocolRevision = 1;
    },
    (value) => {
      value.manifestEnvelope.payload.platformAccessArtifact.rustToolchain =
        "1.95.0";
    },
    (value) => {
      value.manifestEnvelope.payload.platformAccessArtifact.byteLength = 0;
    },
    (value) => {
      value.manifestEnvelope.payload.platformAccessArtifact.sha256 = "6".repeat(
        63,
      );
    },
    (value) => {
      Object.assign(value.manifestEnvelope.payload.platformAccessArtifact, {
        extra: true,
      });
    },
    (value) => {
      value.manifestEnvelope.payload.nativeProvisionSupervisorArtifact.relativePath =
        "90_Release/coordinator/wrong.exe";
    },
    (value) => {
      value.manifestEnvelope.payload.nativeProvisionSupervisorArtifact.target =
        "aarch64-pc-windows-msvc";
    },
    (value) => {
      value.manifestEnvelope.payload.nativeProvisionSupervisorArtifact.entrypointContractRevision = 3;
    },
    (value) => {
      value.manifestEnvelope.payload.nativeProvisionSupervisorArtifact.rustToolchain =
        "1.95.0";
    },
    (value) => {
      value.manifestEnvelope.payload.nativeProvisionSupervisorArtifact.byteLength = 0;
    },
    (value) => {
      value.manifestEnvelope.payload.nativeProvisionSupervisorArtifact.sha256 =
        "7".repeat(63);
    },
    (value) => {
      Object.assign(
        value.manifestEnvelope.payload.nativeProvisionSupervisorArtifact,
        { extra: true },
      );
    },
  ];
  for (const mutate of mutations) {
    const value = fixture();
    mutate(value);
    assert.equal(
      verifyPlatformProvisionerManifestCandidate(value).status,
      "blocked",
    );
  }
});

test("暗号学的に有効な旧V1一成果物manifestをaliasせず拒否する", () => {
  const value = fixture();
  value.manifestEnvelope.payload.contractRevision = 1;
  value.manifestEnvelope.contractRevision = 1;
  Reflect.deleteProperty(
    value.manifestEnvelope.payload,
    "nativeProvisionSupervisorArtifact",
  );
  resign(value, HISTORICAL_PLATFORM_PROVISIONER_MANIFEST_DOMAIN);
  assertSignatureValid(value, HISTORICAL_PLATFORM_PROVISIONER_MANIFEST_DOMAIN);
  const result = verifyPlatformProvisionerManifestCandidate(value);
  assert.equal(result.status, "blocked");
  assert.equal(result.runtimeAuthorityConferred, false);
  assert.equal(result.runtimeCapabilityIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.networkEffectIssued, false);
});

test("暗号学的に有効なV2 artifact欠落とnative field差をSchemaで拒否する", () => {
  const mutations: Array<(value: ReturnType<typeof fixture>) => void> = [
    (value) => {
      Reflect.deleteProperty(
        value.manifestEnvelope.payload,
        "platformAccessArtifact",
      );
    },
    (value) => {
      Reflect.deleteProperty(
        value.manifestEnvelope.payload,
        "nativeProvisionSupervisorArtifact",
      );
    },
    (value) => {
      value.manifestEnvelope.payload.nativeProvisionSupervisorArtifact.relativePath =
        "90_Release/coordinator/wrong.exe";
    },
    (value) => {
      value.manifestEnvelope.payload.nativeProvisionSupervisorArtifact.target =
        "aarch64-pc-windows-msvc";
    },
    (value) => {
      value.manifestEnvelope.payload.nativeProvisionSupervisorArtifact.entrypointContractRevision = 3;
    },
    (value) => {
      value.manifestEnvelope.payload.nativeProvisionSupervisorArtifact.rustToolchain =
        "1.95.0";
    },
    (value) => {
      value.manifestEnvelope.payload.nativeProvisionSupervisorArtifact.byteLength = 0;
    },
    (value) => {
      value.manifestEnvelope.payload.nativeProvisionSupervisorArtifact.sha256 =
        "7".repeat(63);
    },
    (value) => {
      Object.assign(
        value.manifestEnvelope.payload.nativeProvisionSupervisorArtifact,
        { extra: true },
      );
    },
  ];
  for (const mutate of mutations) {
    const value = fixture();
    mutate(value);
    resign(value);
    assertSignatureValid(value);
    const result = verifyPlatformProvisionerManifestCandidate(value);
    assert.equal(result.status, "blocked");
    assert.equal(result.runtimeAuthorityConferred, false);
    assert.equal(result.runtimeCapabilityIssued, false);
    assert.equal(result.filesystemEffectIssued, false);
    assert.equal(result.networkEffectIssued, false);
  }
});

test("manifest signature, role, lifetime and exact envelope fail closed", () => {
  const mutations: Array<(value: ReturnType<typeof fixture>) => void> = [
    (value) => {
      const signature = value.manifestEnvelope.signatures[0];
      assertPresent(signature);
      signature.signature = "A".repeat(86);
    },
    (value) => {
      const signature = value.manifestEnvelope.signatures[0];
      assertPresent(signature);
      signature.algorithm = "ECDSA";
    },
    (value) => {
      const signature = value.manifestEnvelope.signatures[0];
      assertPresent(signature);
      value.manifestEnvelope.signatures.push(signature);
    },
    (value) => {
      value.evaluationTime = "2028-01-01T00:00:00.000Z";
    },
    (value) => {
      Reflect.set(value.manifestEnvelope, "extra", true);
    },
  ];
  for (const mutate of mutations) {
    const value = fixture();
    mutate(value);
    assert.equal(
      verifyPlatformProvisionerManifestCandidate(value).status,
      "blocked",
    );
  }
});

test("package trust contract requires CRDD-bundled use and both signed Rust executables", () => {
  const contract = describePlatformProvisionerTrustCoreContract();
  assert.equal(
    contract.distributionModel,
    "crdd_bundled_private_typescript_package",
  );
  assert.equal(contract.dedicatedNativeExecutableRequiredForV1, true);
  assert.equal(
    contract.osNativeCodeSignatureDecision,
    "deferred_until_production_verified_image_binding",
  );
  assert.equal(contract.standalonePackagePublicationAllowed, false);
  assert.equal(contract.standalonePackageInstallationAllowed, false);
  assert.equal(
    contract.releaseIdentityBinding,
    "release_sequence_crdd_version_commit_tree_package_content_root_platform_access_and_native_supervisor_artifacts_implemented_candidate",
  );
  assert.equal(
    contract.runtimeOwnedCrddDistributionVerification,
    "not_implemented_crdd_release_identity_target",
  );
  assert.equal(contract.filesystemEffectIssued, false);
});

test("coordinator package metadata remains private without a standalone command surface", async () => {
  const packageMetadata = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.equal(packageMetadata.private, true);
  assert.equal("bin" in packageMetadata, false);
});
