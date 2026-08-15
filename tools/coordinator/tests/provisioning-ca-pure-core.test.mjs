import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  PROVISIONING_CA_DOMAINS,
  describeProvisioningCaPureCoreContract,
  verifyProvisioningCaStateCandidate
} from "../src/security/provisioning-ca-pure-core.mjs";
import { canonicalizeProvisioningJsonValueCandidate } from
  "../src/security/provisioning-signature-primitives.mjs";

function frame(domain, payload) {
  const bytes = canonicalizeProvisioningJsonValueCandidate(payload).canonicalBytes;
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  return Buffer.concat([Buffer.from(domain, "ascii"), length, bytes]);
}

function fixture() {
  const root = generateKeyPairSync("ed25519");
  const issuer = generateKeyPairSync("ed25519");
  const rootSpki = root.publicKey.export({ format: "der", type: "spki" });
  const issuerSpki = issuer.publicKey.export({ format: "der", type: "spki" });
  const rootKeyId = createHash("sha256").update(rootSpki).digest("hex");
  const issuerKeyId = createHash("sha256").update(issuerSpki).digest("hex");
  const rootTrustSet = {
    contract: "crdd-coordinator/provisioning-ca-root-trust-set",
    contractRevision: 1,
    trustEpoch: 1,
    roots: [{ keyId: rootKeyId, algorithm: "Ed25519",
      spkiDer: rootSpki.toString("base64url"),
      notBefore: "2026-01-01T00:00:00.000Z", notAfter: "2028-01-01T00:00:00.000Z" }]
  };
  const issuingPayload = {
    contract: "crdd-coordinator/provisioning-ca-issuing-certificate",
    contractRevision: 1,
    caSeriesId: "1".repeat(32),
    role: "online_enrollment_issuer",
    keyId: issuerKeyId,
    algorithm: "Ed25519",
    spkiDer: issuerSpki.toString("base64url"),
    rootKeyId,
    trustEpoch: 1,
    notBefore: "2026-01-01T00:00:00.000Z",
    notAfter: "2026-12-31T00:00:00.000Z"
  };
  const issuingCertificateEnvelope = {
    contract: "crdd-coordinator/provisioning-ca-issuing-certificate-envelope",
    contractRevision: 1,
    payload: issuingPayload,
    signatures: [{ keyId: rootKeyId, algorithm: "Ed25519",
      signature: sign(null, frame(PROVISIONING_CA_DOMAINS.issuingCertificate, issuingPayload),
        root.privateKey).toString("base64url") }]
  };
  const revocationPayload = {
    contract: "crdd-coordinator/provisioning-ca-revocation-manifest",
    contractRevision: 1,
    trustEpoch: 1,
    revocationRevision: 1,
    issuedAt: "2026-08-15T00:00:00.000Z",
    expiresAt: "2026-08-16T00:00:00.000Z",
    revoked: []
  };
  const revocationEnvelope = {
    contract: "crdd-coordinator/provisioning-ca-revocation-manifest-envelope",
    contractRevision: 1,
    payload: revocationPayload,
    signatures: [{ keyId: rootKeyId, algorithm: "Ed25519",
      signature: sign(null, frame(PROVISIONING_CA_DOMAINS.revocationManifest, revocationPayload),
        root.privateKey).toString("base64url") }]
  };
  return { root, issuer, rootKeyId, issuerKeyId, rootTrustSet,
    issuingCertificateEnvelope, revocationEnvelope };
}

function input(value) {
  return {
    rootTrustSet: value.rootTrustSet,
    issuingCertificateEnvelope: value.issuingCertificateEnvelope,
    revocationEnvelope: value.revocationEnvelope,
    evaluationTime: "2026-08-15T12:00:00.000Z"
  };
}

test("root-signed issuing key and fresh revocation state remain non-authoritative candidates", () => {
  const result = verifyProvisioningCaStateCandidate(input(fixture()));
  assert.equal(result.status, "candidate");
  assert.equal(result.issuingRole, "online_enrollment_issuer");
  assert.equal(result.issuingCertificateCryptographicMatch, true);
  assert.equal(result.revocationManifestCryptographicMatch, true);
  assert.equal(result.runtimeOwnedRootTrustConfirmed, false);
  assert.equal(result.runtimeAuthorityConferred, false);
  for (const key of ["rootKeyId", "issuerKeyId", "spkiDer", "signature", "canonicalBytes"]) {
    assert.equal(key in result, false);
  }
});

test("unknown root, stale manifest, revoked key and signature mismatch fail closed", () => {
  const unknown = fixture();
  unknown.issuingCertificateEnvelope = {
    ...unknown.issuingCertificateEnvelope,
    payload: { ...unknown.issuingCertificateEnvelope.payload, rootKeyId: "f".repeat(64) }
  };
  assert.equal(verifyProvisioningCaStateCandidate(input(unknown)).status, "blocked");

  const stale = fixture();
  assert.equal(verifyProvisioningCaStateCandidate({
    ...input(stale), evaluationTime: "2026-08-16T00:00:00.000Z"
  }).reason, "provisioning_ca_state_not_current");

  const revoked = fixture();
  const payload = { ...revoked.revocationEnvelope.payload, revoked: [{
    keyId: revoked.issuerKeyId,
    revokedAt: "2027-01-01T00:00:00.000Z",
    reasonCode: "compromise"
  }] };
  revoked.revocationEnvelope = {
    ...revoked.revocationEnvelope,
    payload,
    signatures: [{ keyId: revoked.rootKeyId, algorithm: "Ed25519",
      signature: sign(null, frame(PROVISIONING_CA_DOMAINS.revocationManifest, payload),
        revoked.root.privateKey).toString("base64url") }]
  };
  assert.equal(verifyProvisioningCaStateCandidate(input(revoked)).reason,
    "provisioning_ca_key_revoked");

  const changed = fixture();
  changed.issuingCertificateEnvelope.signatures[0].signature =
    `${changed.issuingCertificateEnvelope.signatures[0].signature.startsWith("A") ? "B" : "A"}` +
    changed.issuingCertificateEnvelope.signatures[0].signature.slice(1);
  assert.equal(verifyProvisioningCaStateCandidate(input(changed)).status, "blocked");
});

test("exact shape and limits reject dynamic inputs and overlong CA periods", () => {
  const value = fixture();
  let getterCalls = 0;
  const accessor = { ...input(value) };
  Object.defineProperty(accessor, "evaluationTime", {
    enumerable: true,
    get() { getterCalls += 1; return "2026-08-15T12:00:00.000Z"; }
  });
  assert.equal(verifyProvisioningCaStateCandidate(accessor).status, "blocked");
  assert.equal(getterCalls, 0);
  const tooLong = fixture();
  tooLong.issuingCertificateEnvelope = {
    ...tooLong.issuingCertificateEnvelope,
    payload: { ...tooLong.issuingCertificateEnvelope.payload,
      notAfter: "2027-01-02T00:00:00.000Z" }
  };
  assert.equal(verifyProvisioningCaStateCandidate(input(tooLong)).status, "blocked");
});

test("contract separates cryptographic candidates from Runtime trust and rollback state", () => {
  const contract = describeProvisioningCaPureCoreContract();
  assert.equal(contract.signatureAlgorithm, "Ed25519");
  assert.equal(contract.issuingKeyMaximumValidityDays, 365);
  assert.equal(contract.revocationMaximumFreshnessHours, 24);
  assert.equal(contract.runtimeOwnedRootTrustSelection, "not_implemented");
  assert.equal(contract.rollbackFloorPersistence, "not_implemented");
  assert.equal(contract.runtimeAuthorityConferred, false);
});
