import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  AUTHORITY_ROOT_LOCATOR_CONTRACT,
  persistAuthorityRootLocatorForEffect,
  verifyStoredAuthorityRootLocatorRecordCandidate,
} from "../src/security/authority-root-locator.ts";
import {
  buildProvisioningRecordDomainMessageCandidate,
  compileProvisioningRecordEnvelopeCandidate,
  compileProvisioningRevocationManifestCandidate,
  compileProvisioningTrustAnchorSetCandidate,
} from "../src/security/provisioning-record-pure-core.ts";
import {
  PROVISIONING_RECORDS_DIRECTORY,
  PROVISIONING_RECORD_STORAGE_DIRECTORY,
  persistCurrentProvisioningRecordForEffect,
} from "../src/security/provisioning-record-store.ts";
import {
  PROVISIONING_REVOCATION_MANIFESTS_DIRECTORY,
  PROVISIONING_TRUST_ANCHORS_DIRECTORY,
  describeProvisioningTrustArtifactStoreContract,
  persistProvisioningTrustArtifactsForEffect,
  verifyCurrentProvisioningRecordWithPersistedTrustCandidate,
  verifyStoredProvisioningTrustArtifactsCandidate,
} from "../src/security/provisioning-trust-artifact-store.ts";
import { evaluateProvisioningTrustFloorCandidate } from "../src/security/provisioning-trust-floor.ts";
import { persistProvisioningTrustFloorForEffect } from "../src/security/provisioning-trust-floor-store.ts";
import {
  assertCanonicalCandidate,
  assertDomainMessageCandidate,
} from "./test-support.ts";

const P256_ORDER = BigInt(
  "0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",
);

function lowS(signature: Uint8Array) {
  const result = Buffer.from(signature);
  const s = BigInt(`0x${result.subarray(32).toString("hex")}`);
  if (s > P256_ORDER >> 1n) {
    Buffer.from((P256_ORDER - s).toString(16).padStart(64, "0"), "hex").copy(
      result,
      32,
    );
  }
  return result;
}

function fixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-trust-store-"));
  const root = path.join(parent, PROVISIONING_RECORD_STORAGE_DIRECTORY);
  const repositoryRoot = path.join(parent, "repository");
  fs.mkdirSync(path.join(repositoryRoot, ".crdd-runtime"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(root, PROVISIONING_TRUST_ANCHORS_DIRECTORY), {
    recursive: true,
  });
  fs.mkdirSync(path.join(root, PROVISIONING_REVOCATION_MANIFESTS_DIRECTORY));
  fs.mkdirSync(path.join(root, PROVISIONING_RECORDS_DIRECTORY));
  return {
    parent,
    root,
    repositoryRoot: fs.realpathSync.native(repositoryRoot),
    authorityRoot: fs.realpathSync.native(parent),
  };
}

function artifacts(trustEpoch = 1, revocationRevision = 1) {
  const now = Date.now();
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const spkiDer = publicKey.export({ format: "der", type: "spki" });
  const keyId = createHash("sha256").update(spkiDer).digest("hex");
  const anchors = compileProvisioningTrustAnchorSetCandidate({
    contract: "crdd-coordinator/provisioning-trust-anchor-set",
    contractRevision: 1,
    trustEpoch,
    keys: [
      {
        keyId,
        algorithm: "ECDSA-P256-SHA256",
        spkiDer: spkiDer.toString("base64url"),
        enrollmentCaId: "1".repeat(32),
        notBefore: new Date(now - 86_400_000).toISOString(),
        notAfter: new Date(now + 15_552_000_000).toISOString(),
      },
    ],
  });
  const revocations = compileProvisioningRevocationManifestCandidate({
    contract: "crdd-coordinator/provisioning-revocation-manifest",
    contractRevision: 1,
    trustEpoch,
    revocationRevision,
    revoked: [],
  });
  assertCanonicalCandidate(anchors);
  assertCanonicalCandidate(revocations);
  return { anchors, revocations, privateKey, keyId };
}

function floor(values: ReturnType<typeof artifacts>) {
  const result = evaluateProvisioningTrustFloorCandidate({
    currentFloor: null,
    verifiedTrust: {
      trustEpoch: 1,
      trustAnchorSetHash: values.anchors.canonicalHash,
      revocationRevision: 1,
      revocationManifestHash: values.revocations.canonicalHash,
    },
  });
  assert.equal(result.status, "candidate");
  if (!("nextFloor" in result)) throw new Error("next floor required");
  return result.nextFloor;
}

function recordEnvelope(
  values: ReturnType<typeof artifacts>,
  authorityRootAbsolutePath = process.platform === "win32"
    ? "C:\\CRDD-Authority"
    : "/var/lib/crdd-authority",
) {
  const now = Date.now();
  const payload = {
    contract: "crdd-coordinator/provisioning-record",
    contractRevision: 1,
    recordId: "2".repeat(32),
    recordRevision: 1,
    previousRecordHash: null,
    platformScopeId: "3".repeat(32),
    provisionerIdentityHash: "4".repeat(64),
    provisionerEnrollmentId: "5".repeat(32),
    authorityRootAbsolutePath,
    authorityRootIdentityHash: "6".repeat(64),
    authorityRootProtectionHash: "7".repeat(64),
    runtimePrincipalModes: [
      "local_interactive_selected_user",
      "server_dedicated_service_account",
    ],
    trustEpoch: 1,
    issuedAt: new Date(now - 60_000).toISOString(),
    expiresAt: new Date(now + 86_400_000).toISOString(),
  };
  const domain = buildProvisioningRecordDomainMessageCandidate(payload);
  assertDomainMessageCandidate(domain);
  const envelope = compileProvisioningRecordEnvelopeCandidate({
    contract: "crdd-coordinator/provisioning-record-envelope",
    contractRevision: 1,
    payload,
    signatures: [
      {
        keyId: values.keyId,
        algorithm: "ECDSA-P256-SHA256",
        signature: lowS(
          sign("sha256", domain.message, {
            key: values.privateKey,
            dsaEncoding: "ieee-p1363",
          }),
        ).toString("base64url"),
      },
    ],
  });
  assertCanonicalCandidate(envelope);
  return envelope.canonicalBytes;
}

test("Trust成果物をcontent addressで保存しfloorへ再結合する", () => {
  const target = fixture();
  try {
    const values = artifacts();
    const persisted = persistProvisioningTrustArtifactsForEffect(
      target.root,
      values.anchors.canonicalBytes,
      values.revocations.canonicalBytes,
    );
    assert.equal(persisted.status, "candidate");
    assert.equal(persisted.persistenceCompleted, true);
    assert.equal(persisted.filesystemEffectIssued, true);
    const verified = verifyStoredProvisioningTrustArtifactsCandidate(
      target.root,
      floor(values),
    );
    assert.equal(verified.status, "candidate");
    assert.equal(verified.trustAnchorSetHash, values.anchors.canonicalHash);
    assert.equal(
      persistProvisioningTrustArtifactsForEffect(
        target.root,
        values.anchors.canonicalBytes,
        values.revocations.canonicalBytes,
      ).filesystemEffectIssued,
      false,
    );
    assert.equal(JSON.stringify(verified).includes(target.root), false);
    assert.equal(JSON.stringify(verified).includes("canonicalBytes"), false);
  } finally {
    fs.rmSync(target.parent, { recursive: true, force: true });
  }
});

test("改変、epoch不一致、欠落および不正Rootをfail closedにする", () => {
  const target = fixture();
  try {
    const values = artifacts();
    assert.equal(
      persistProvisioningTrustArtifactsForEffect(
        target.root,
        values.anchors.canonicalBytes,
        artifacts(2).revocations.canonicalBytes,
      ).status,
      "blocked",
    );
    assert.equal(
      persistProvisioningTrustArtifactsForEffect(
        target.root,
        values.anchors.canonicalBytes,
        values.revocations.canonicalBytes,
      ).status,
      "candidate",
    );
    const anchorPath = path.join(
      target.root,
      PROVISIONING_TRUST_ANCHORS_DIRECTORY,
      `${values.anchors.canonicalHash}.json`,
    );
    fs.writeFileSync(anchorPath, "{}");
    assert.equal(
      verifyStoredProvisioningTrustArtifactsCandidate(
        target.root,
        floor(values),
      ).status,
      "blocked",
    );
    assert.equal(
      verifyStoredProvisioningTrustArtifactsCandidate(
        target.parent,
        floor(values),
      ).status,
      "blocked",
    );
  } finally {
    fs.rmSync(target.parent, { recursive: true, force: true });
  }
});

test("Trust成果物Store契約はRepositoryに実Trustを保存しない", () => {
  assert.deepEqual(describeProvisioningTrustArtifactStoreContract(), {
    contract: "crdd-coordinator/provisioning-trust-artifact-store",
    contractRevision: 1,
    trustAnchorLayout: ".crdd-provisioning/trust-anchors/<sha256>.json",
    revocationLayout: ".crdd-provisioning/revocation-manifests/<sha256>.json",
    storage: "immutable_content_addressed_canonical_artifacts",
    floorBinding: "implemented_candidate",
    persistedRecordAggregateVerification:
      "implemented_candidate_runtime_clock_non_authority",
    persistence: "implemented_candidate",
    repositoryCanonicalTrustStored: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
});

test("永続floorとTrustを現在RecordへRuntime時計で集約する", () => {
  const target = fixture();
  try {
    const values = artifacts();
    const nextFloor = floor(values);
    assert.equal(
      persistProvisioningTrustArtifactsForEffect(
        target.root,
        values.anchors.canonicalBytes,
        values.revocations.canonicalBytes,
      ).status,
      "candidate",
    );
    assert.equal(
      persistProvisioningTrustFloorForEffect(target.root, nextFloor).status,
      "candidate",
    );
    assert.equal(
      persistCurrentProvisioningRecordForEffect(
        target.root,
        recordEnvelope(values),
      ).status,
      "candidate",
    );
    const verified = verifyCurrentProvisioningRecordWithPersistedTrustCandidate(
      target.root,
    );
    assert.equal(verified.status, "candidate");
    assert.equal(verified.verifiedSignatureCount, 1);
    assert.equal(verified.runtimeAuthorityConferred, false);
    assert.equal(JSON.stringify(verified).includes(target.root), false);
    fs.writeFileSync(path.join(target.root, "trust-floor.json"), "{}");
    assert.equal(
      verifyCurrentProvisioningRecordWithPersistedTrustCandidate(target.root)
        .status,
      "blocked",
    );
  } finally {
    fs.rmSync(target.parent, { recursive: true, force: true });
  }
});

test("Repository検索票を永続Trustとcurrent Recordへ結合する", () => {
  const target = fixture();
  try {
    const values = artifacts();
    assert.equal(
      persistProvisioningTrustArtifactsForEffect(
        target.root,
        values.anchors.canonicalBytes,
        values.revocations.canonicalBytes,
      ).status,
      "candidate",
    );
    assert.equal(
      persistProvisioningTrustFloorForEffect(target.root, floor(values)).status,
      "candidate",
    );
    const persistedRecord = persistCurrentProvisioningRecordForEffect(
      target.root,
      recordEnvelope(values, target.authorityRoot),
    );
    assert.equal(persistedRecord.status, "candidate");
    assert.equal(
      persistAuthorityRootLocatorForEffect(target.repositoryRoot, {
        contract: AUTHORITY_ROOT_LOCATOR_CONTRACT,
        contractRevision: 1,
        locatorRevision: 1,
        repositoryIdentityHash: "8".repeat(64),
        runtimeRootIdentityHash: "9".repeat(64),
        authorityRootAbsolutePath: target.authorityRoot,
        authorityRootIdentityHash: "6".repeat(64),
        provisioningRecordHash: persistedRecord.recordHash,
        activationId: "ACTIVATION-000001",
        activationRevision: 1,
        activationRecordHash: "a".repeat(64),
      }).status,
      "candidate",
    );
    const verified = verifyStoredAuthorityRootLocatorRecordCandidate(
      target.repositoryRoot,
    );
    assert.equal(verified.status, "candidate");
    assert.equal(verified.locatorRecordTrustBindingMatch, true);
    assert.equal(verified.runtimeAuthorityConferred, false);
    assert.equal(
      JSON.stringify(verified).includes(target.authorityRoot),
      false,
    );
    const locatorPath = path.join(
      target.repositoryRoot,
      ".crdd-runtime",
      "authority-root-locator.json",
    );
    fs.writeFileSync(
      locatorPath,
      JSON.stringify({
        activationId: "ACTIVATION-000001",
        activationRecordHash: "a".repeat(64),
        activationRevision: 1,
        authorityRootAbsolutePath: target.authorityRoot,
        authorityRootIdentityHash: "b".repeat(64),
        contract: AUTHORITY_ROOT_LOCATOR_CONTRACT,
        contractRevision: 1,
        locatorRevision: 1,
        provisioningRecordHash: persistedRecord.recordHash,
        repositoryIdentityHash: "8".repeat(64),
        runtimeRootIdentityHash: "9".repeat(64),
      }),
    );
    assert.equal(
      verifyStoredAuthorityRootLocatorRecordCandidate(target.repositoryRoot)
        .status,
      "blocked",
    );
  } finally {
    fs.rmSync(target.parent, { recursive: true, force: true });
  }
});
