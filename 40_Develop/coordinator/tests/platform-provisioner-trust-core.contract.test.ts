import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign, verify } from "node:crypto";
import type { KeyObject } from "node:crypto";
import { readFile } from "node:fs/promises";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
  LEGACY_PLATFORM_PROVISIONER_MANIFEST_DOMAIN as PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
  PLATFORM_PROVISIONER_MANIFEST_DOMAIN as CURRENT_MANIFEST_DOMAIN,
  PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
  calculatePlatformProvisionerPackageContentRootCandidate,
  compilePlatformProvisionerManifestPayloadCandidate,
  describePlatformProvisionerTrustCoreContract,
  verifyPlatformProvisionerManifestCandidate,
  verifyHistoricalPlatformProvisionerManifestCandidate,
} from "../src/security/platform-provisioner-trust-core.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../src/security/provisioning-signature-primitives.ts";
import { assertCanonicalCandidate, assertPresent } from "./test-support.ts";
import { loadPlatformProvisionerManifestEnvelopeForVerification } from "../src/security/platform-provisioner-manifest-loader.ts";
import {
  createDockerDesktopRepairOperation,
  persistDockerDesktopRepairStage,
  persistDockerDesktopRepairHistoricalAdoption,
  inventoryDockerDesktopRepairOperations,
} from "../src/security/docker-desktop-repair-record-store.ts";

const HISTORICAL_PLATFORM_PROVISIONER_MANIFEST_DOMAIN =
  "CRDD\0PLATFORM-PROVISIONER-PACKAGE-MANIFEST\0V1\0";
const fixturePrivateKeys = new WeakMap<object, KeyObject>();

test("共有manifestベクトルは旧期限付き・新期限付き・期限なしと署名改変を区別する", () => {
  const lines = fs
    .readFileSync(
      new URL(
        "./fixtures/release-manifest-validity-vectors.txt",
        import.meta.url,
      ),
      "utf8",
    )
    .trim()
    .split(/\r?\n/u);
  assert.equal(lines.length, 3);
  const signer = generateKeyPairSync("ed25519");
  const spki = signer.publicKey.export({ format: "der", type: "spki" });
  const observedPackageContent = {
    packageName: "@qual-lab/crdd-coordinator",
    packageVersion: "0.0.0-development",
    files: [{ path: "package.json", byteLength: 1, sha256: "1".repeat(64) }],
  };
  for (const line of lines) {
    const payload: Record<string, unknown> = JSON.parse(line);
    const revision = payload.contractRevision;
    const domain =
      revision === 2
        ? PLATFORM_PROVISIONER_MANIFEST_DOMAIN
        : CURRENT_MANIFEST_DOMAIN;
    const compiled = compilePlatformProvisionerManifestPayloadCandidate({
      manifestPayload: payload,
    });
    assert.equal(compiled.status, "candidate");
    if (compiled.status !== "candidate") assert.fail("shared payload rejected");
    assert.deepEqual(compiled.message, frame(payload, domain));
    const signatures = [
      {
        keyId: createHash("sha256").update(spki).digest("hex"),
        algorithm: "Ed25519",
        signature: sign(null, compiled.message, signer.privateKey).toString(
          "base64url",
        ),
      },
    ];
    const envelope = {
      contract: PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
      contractRevision: revision,
      payload,
      signatures,
    };
    const input = {
      manifestEnvelope: envelope,
      releaseSignerSpkiDer: spki,
      observedPackageContent,
      evaluationTime: "2026-08-15T00:00:00.000Z",
    };
    assert.equal(
      verifyPlatformProvisionerManifestCandidate(input).status,
      "candidate",
    );
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "crdd-validity-loader-"),
    );
    try {
      fs.mkdirSync(path.join(root, "90_Release"));
      const target = path.join(
        root,
        "90_Release",
        "coordinator-package-manifest.json",
      );
      const canonical = canonicalizeProvisioningJsonValueCandidate(envelope);
      assertCanonicalCandidate(canonical);
      fs.writeFileSync(target, canonical.canonicalBytes, { flag: "wx" });
      const loaded =
        loadPlatformProvisionerManifestEnvelopeForVerification(root);
      assert.equal(
        verifyPlatformProvisionerManifestCandidate({
          ...input,
          manifestEnvelope: loaded.envelope,
        }).status,
        "candidate",
      );
      const changed = canonicalizeProvisioningJsonValueCandidate({
        ...envelope,
        payload: { ...payload, expiresAt: "2028-08-15T00:00:00.000Z" },
      });
      assertCanonicalCandidate(changed);
      fs.writeFileSync(target, changed.canonicalBytes);
      const rejected = verifyPlatformProvisionerManifestCandidate({
        ...input,
        manifestEnvelope:
          loadPlatformProvisionerManifestEnvelopeForVerification(root).envelope,
      });
      assert.equal(rejected.status, "blocked");
      assert.equal(rejected.runtimeAuthorityConferred, false);
      assert.equal(rejected.runtimeCapabilityIssued, false);
    } finally {
      assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
      assert.equal(fs.realpathSync.native(root), root);
      assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
      fs.rmSync(root, { recursive: true, force: true });
      assert.equal(fs.existsSync(root), false);
    }
    for (const evaluationTime of [
      "2027-08-15T00:00:00.000Z",
      "2099-01-01T00:00:00.000Z",
    ]) {
      assert.equal(
        verifyPlatformProvisionerManifestCandidate({ ...input, evaluationTime })
          .status,
        payload.expiresAt === null ? "candidate" : "blocked",
      );
    }
    assert.equal(
      verifyPlatformProvisionerManifestCandidate({
        ...input,
        evaluationTime: "2026-08-14T23:59:59.999Z",
      }).status,
      "blocked",
    );
    assert.equal(
      verifyPlatformProvisionerManifestCandidate({
        ...input,
        evaluationTime: "2027-08-14T23:59:59.999Z",
      }).status,
      "candidate",
    );
    const historical = verifyHistoricalPlatformProvisionerManifestCandidate(
      envelope,
      spki,
    );
    assert.ok(historical);
    assert.equal(historical.runtimeAuthorityConferred, false);
    assert.equal(historical.runtimeCapabilityIssued, false);
    const changedPayload = {
      ...payload,
      expiresAt: payload.expiresAt === null ? "2028-01-01T00:00:00.000Z" : null,
    };
    const changed = verifyPlatformProvisionerManifestCandidate({
      ...input,
      manifestEnvelope: { ...envelope, payload: changedPayload },
    });
    assert.equal(changed.status, "blocked");
    assert.equal(changed.runtimeAuthorityConferred, false);
    assert.equal(changed.runtimeCapabilityIssued, false);
    assert.equal(
      verifyHistoricalPlatformProvisionerManifestCandidate(
        { ...envelope, payload: changedPayload },
        spki,
      ),
      null,
    );
    const wrongDomain =
      domain === CURRENT_MANIFEST_DOMAIN
        ? PLATFORM_PROVISIONER_MANIFEST_DOMAIN
        : CURRENT_MANIFEST_DOMAIN;
    assert.equal(
      verifyPlatformProvisionerManifestCandidate({
        ...input,
        manifestEnvelope: {
          ...envelope,
          signatures: [
            {
              ...signatures[0],
              signature: sign(
                null,
                frame(payload, wrongDomain),
                signer.privateKey,
              ).toString("base64url"),
            },
          ],
        },
      }).status,
      "blocked",
    );
    assert.equal(
      verifyPlatformProvisionerManifestCandidate({
        ...input,
        manifestEnvelope: {
          ...envelope,
          contractRevision: revision === 2 ? 3 : 2,
        },
      }).status,
      "blocked",
    );
    for (const expiresAt of [
      undefined,
      "null",
      "",
      false,
      0,
      "2026-08-15T00:00:00.000Z",
    ]) {
      assert.equal(
        compilePlatformProvisionerManifestPayloadCandidate({
          manifestPayload: { ...payload, expiresAt },
        }).status,
        "blocked",
      );
    }
    const missingExpiry = { ...payload };
    delete missingExpiry.expiresAt;
    assert.equal(
      compilePlatformProvisionerManifestPayloadCandidate({
        manifestPayload: missingExpiry,
      }).status,
      "blocked",
    );
    for (const contractRevision of [1, 4, "3"]) {
      assert.equal(
        compilePlatformProvisionerManifestPayloadCandidate({
          manifestPayload: { ...payload, contractRevision },
        }).status,
        "blocked",
      );
    }
  }
});

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

test("historical signature verification preserves provenance without granting current execution authority", () => {
  const value = fixture();
  value.evaluationTime = "2028-08-15T12:00:00.000Z";
  assert.equal(
    verifyPlatformProvisionerManifestCandidate(value).status,
    "blocked",
  );
  const historical = verifyHistoricalPlatformProvisionerManifestCandidate(
    value.manifestEnvelope,
    value.releaseSignerSpkiDer,
  );
  assert.ok(historical);
  assert.equal(historical.runtimeAuthorityConferred, false);
  assert.equal(historical.runtimeCapabilityIssued, false);
  assert.equal(historical.crddDistributionConfirmed, false);
  assert.equal(historical.payload.releaseSequence, 18);
  // Altering the old distribution cannot be blessed by a provenance-only result.
  const firstFile = value.observedPackageContent.files[0];
  assertPresent(firstFile);
  firstFile.sha256 = "f".repeat(64);
  value.evaluationTime = "2026-08-15T12:00:00.000Z";
  assert.equal(
    verifyPlatformProvisionerManifestCandidate(value).status,
    "blocked",
  );
});

test("実署名の旧版・新版と実記録Storeを接続して旧byteを変更せず引き継ぐ", (t) => {
  const value = fixture();
  const originEnvelope = structuredClone(value.manifestEnvelope);
  const origin = verifyHistoricalPlatformProvisionerManifestCandidate(
    originEnvelope,
    value.releaseSignerSpkiDer,
  );
  assert.ok(origin);
  value.manifestEnvelope.payload.releaseSequence = 19;
  value.manifestEnvelope.payload.crddTree = "c".repeat(40);
  resign(value);
  const current = verifyHistoricalPlatformProvisionerManifestCandidate(
    value.manifestEnvelope,
    value.releaseSignerSpkiDer,
  );
  assert.ok(current);
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-history-signature-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const boundary = {
    runtimeStateRoot: root,
    localAppData: root,
    runtimeStateIdentityHash: "1".repeat(64),
    runtimeStateProtectionHash: "2".repeat(64),
    localUserBindingHash: "3".repeat(64),
    runtimeStateBindingHash: "4".repeat(64),
    dockerPolicySha256: "5".repeat(64),
    crddManifestHash: origin.manifestHash,
    crddReleaseSequence: origin.payload.releaseSequence,
    crddTree: origin.payload.crddTree,
    packageContentRootSha256: origin.payload.packageContentRootSha256,
  };
  const ledger = {
    processEffects: [],
    processEffectIssued: false,
    processEffectConfirmation: "not_issued" as const,
    filesystemEffects: [],
    filesystemEffectIssued: false,
    filesystemEffectConfirmation: "not_issued" as const,
    engineReady: false,
    staleState: "absent" as const,
    hostSafety: "safe" as const,
    evidenceState: "not_preserved" as const,
    disposition: "not_applicable" as const,
    liveRunIdentity: null,
  };
  const created = createDockerDesktopRepairOperation(
    boundary,
    { dev: "1", ino: "2", birthtimeNs: "3" },
    ledger,
  );
  const original = persistDockerDesktopRepairStage(
    boundary,
    created,
    "prepared",
    {
      ...ledger,
      filesystemEffectIssued: true,
      filesystemEffectConfirmation: "unknown",
      filesystemEffects: [
        {
          sequence: 0,
          action: "record_write",
          phase: "settled",
          issued: true,
          confirmation: "unknown",
        },
      ],
    },
  );
  assert.ok(original);
  const currentBoundary = {
    ...boundary,
    crddManifestHash: current.manifestHash,
    crddReleaseSequence: current.payload.releaseSequence,
    crddTree: current.payload.crddTree,
  };
  const verifyHistory = (envelope: unknown) => {
    const verified = verifyHistoricalPlatformProvisionerManifestCandidate(
      envelope,
      value.releaseSignerSpkiDer,
    );
    return (
      verified && {
        manifestHash: verified.manifestHash,
        releaseSequence: verified.payload.releaseSequence,
        crddTree: verified.payload.crddTree,
        packageContentRootSha256: verified.payload.packageContentRootSha256,
      }
    );
  };
  const adopted = persistDockerDesktopRepairHistoricalAdoption(
    currentBoundary,
    original,
    originEnvelope,
    value.manifestEnvelope,
    verifyHistory,
  );
  assert.ok(adopted?.history);
  assert.equal(adopted.previousRecordSha256, original.previousRecordSha256);
  assert.equal(
    inventoryDockerDesktopRepairOperations(currentBoundary, verifyHistory)
      .status,
    "verified",
  );
  assert.equal(
    inventoryDockerDesktopRepairOperations(currentBoundary).status,
    "unknown",
  );
});

test("historical provenance refuses wrong keys, tampered payloads and unsupported manifests", () => {
  const value = fixture();
  const other = fixture();
  assert.equal(
    verifyHistoricalPlatformProvisionerManifestCandidate(
      value.manifestEnvelope,
      other.releaseSignerSpkiDer,
    ),
    null,
  );
  value.manifestEnvelope.payload.crddTree = "c".repeat(40);
  assert.equal(
    verifyHistoricalPlatformProvisionerManifestCandidate(
      value.manifestEnvelope,
      value.releaseSignerSpkiDer,
    ),
    null,
  );
  const unsupported = fixture(2);
  assert.equal(
    verifyHistoricalPlatformProvisionerManifestCandidate(
      unsupported.manifestEnvelope,
      unsupported.releaseSignerSpkiDer,
    ),
    null,
  );
  assert.equal(
    verifyHistoricalPlatformProvisionerManifestCandidate(null, null),
    null,
  );
});

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

test("暗号学的に有効なV2 entrypoint revision 1をaliasせず拒否する", () => {
  const value = fixture();
  value.manifestEnvelope.payload.nativeProvisionSupervisorArtifact.entrypointContractRevision = 1;
  resign(value);
  assertSignatureValid(value);
  const result = verifyPlatformProvisionerManifestCandidate(value);
  assert.equal(result.status, "blocked");
  assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
  assert.equal(result.crddDistributionConfirmed, false);
  assert.equal(result.runtimeOwnedPackageFilesystemConfirmed, false);
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
    "signed_release_manifest_is_required_authenticode_is_optional_fixed_publisher_defense",
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
