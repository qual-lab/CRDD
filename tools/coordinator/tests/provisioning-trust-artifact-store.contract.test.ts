import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  compileProvisioningRevocationManifestCandidate,
  compileProvisioningTrustAnchorSetCandidate,
} from "../src/security/provisioning-record-pure-core.ts";
import { PROVISIONING_RECORD_STORAGE_DIRECTORY } from "../src/security/provisioning-record-store.ts";
import {
  PROVISIONING_REVOCATION_MANIFESTS_DIRECTORY,
  PROVISIONING_TRUST_ANCHORS_DIRECTORY,
  describeProvisioningTrustArtifactStoreContract,
  persistProvisioningTrustArtifactsForEffect,
  verifyStoredProvisioningTrustArtifactsCandidate,
} from "../src/security/provisioning-trust-artifact-store.ts";
import { evaluateProvisioningTrustFloorCandidate } from "../src/security/provisioning-trust-floor.ts";
import { assertCanonicalCandidate } from "./test-support.ts";

function fixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-trust-store-"));
  const root = path.join(parent, PROVISIONING_RECORD_STORAGE_DIRECTORY);
  fs.mkdirSync(path.join(root, PROVISIONING_TRUST_ANCHORS_DIRECTORY), {
    recursive: true,
  });
  fs.mkdirSync(path.join(root, PROVISIONING_REVOCATION_MANIFESTS_DIRECTORY));
  return { parent, root };
}

function artifacts(trustEpoch = 1, revocationRevision = 1) {
  const { publicKey } = generateKeyPairSync("ec", {
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
        notBefore: "2026-01-01T00:00:00.000Z",
        notAfter: "2026-12-31T00:00:00.000Z",
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
  return { anchors, revocations };
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
    persistence: "implemented_candidate",
    repositoryCanonicalTrustStored: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
});
