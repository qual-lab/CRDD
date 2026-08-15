import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  INITIAL_ENROLLMENT_CHALLENGE_CONTRACT,
  INITIAL_ENROLLMENT_CERTIFICATE_CONTRACT,
  INITIAL_ENROLLMENT_CERTIFICATE_ENVELOPE_CONTRACT,
  INITIAL_ENROLLMENT_DOMAINS,
  INITIAL_ENROLLMENT_REQUEST_CONTRACT,
  INITIAL_ENROLLMENT_REQUEST_ENVELOPE_CONTRACT,
  compileInitialEnrollmentChallengeCandidate
} from "../src/security/initial-enrollment-pure-core.mjs";
import {
  OFFLINE_ENROLLMENT_BUNDLE_CONTRACT,
  OFFLINE_ENROLLMENT_BUNDLE_DOMAIN,
  OFFLINE_ENROLLMENT_BUNDLE_ENVELOPE_CONTRACT,
  describeOfflineEnrollmentBundlePureCoreContract,
  verifyOfflineEnrollmentBundleCandidate
} from "../src/security/offline-enrollment-bundle-pure-core.mjs";
import { PROVISIONING_CA_DOMAINS } from
  "../src/security/provisioning-ca-pure-core.mjs";
import { canonicalizeProvisioningJsonValueCandidate } from
  "../src/security/provisioning-signature-primitives.mjs";

const P256_ORDER = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");

function lowS(signature) {
  const result = Buffer.from(signature);
  const s = BigInt(`0x${result.subarray(32).toString("hex")}`);
  if (s > (P256_ORDER >> 1n)) {
    Buffer.from((P256_ORDER - s).toString(16).padStart(64, "0"), "hex").copy(result, 32);
  }
  return result;
}

function framed(domain, value) {
  const bytes = canonicalizeProvisioningJsonValueCandidate(value).canonicalBytes;
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  return Buffer.concat([Buffer.from(domain, "ascii"), length, bytes]);
}

function fixture() {
  const root = generateKeyPairSync("ed25519");
  const online = generateKeyPairSync("ed25519");
  const offline = generateKeyPairSync("ed25519");
  const installation = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const rootSpki = root.publicKey.export({ format: "der", type: "spki" });
  const onlineSpki = online.publicKey.export({ format: "der", type: "spki" });
  const offlineSpki = offline.publicKey.export({ format: "der", type: "spki" });
  const installationSpki = installation.publicKey.export({ format: "der", type: "spki" });
  const keyId = (value) => createHash("sha256").update(value).digest("hex");
  const rootKeyId = keyId(rootSpki);
  const onlineKeyId = keyId(onlineSpki);
  const offlineKeyId = keyId(offlineSpki);
  const installationKeyId = keyId(installationSpki);
  const rootTrustSet = {
    contract: "crdd-coordinator/provisioning-ca-root-trust-set", contractRevision: 1,
    trustEpoch: 1, roots: [{ keyId: rootKeyId, algorithm: "Ed25519",
      spkiDer: rootSpki.toString("base64url"), notBefore: "2026-01-01T00:00:00.000Z",
      notAfter: "2028-01-01T00:00:00.000Z" }]
  };
  const issuing = (role, id, spki) => {
    const value = { contract: "crdd-coordinator/provisioning-ca-issuing-certificate",
      contractRevision: 1, caSeriesId: "a".repeat(32), role, keyId: id,
      algorithm: "Ed25519", spkiDer: spki.toString("base64url"), rootKeyId,
      trustEpoch: 1, notBefore: "2026-01-01T00:00:00.000Z",
      notAfter: "2026-12-31T00:00:00.000Z" };
    return { contract: "crdd-coordinator/provisioning-ca-issuing-certificate-envelope",
      contractRevision: 1, payload: value, signatures: [{ keyId: rootKeyId,
        algorithm: "Ed25519", signature: sign(null,
          framed(PROVISIONING_CA_DOMAINS.issuingCertificate, value), root.privateKey)
          .toString("base64url") }] };
  };
  const onlineIssuingCertificateEnvelope = issuing("online_enrollment_issuer", onlineKeyId, onlineSpki);
  const offlineIssuingCertificateEnvelope = issuing("offline_bundle_issuer", offlineKeyId, offlineSpki);
  const revocation = { contract: "crdd-coordinator/provisioning-ca-revocation-manifest",
    contractRevision: 1, trustEpoch: 1, revocationRevision: 1,
    issuedAt: "2026-08-15T00:00:00.000Z", expiresAt: "2026-08-16T00:00:00.000Z", revoked: [] };
  const revocationEnvelope = { contract: "crdd-coordinator/provisioning-ca-revocation-manifest-envelope",
    contractRevision: 1, payload: revocation, signatures: [{ keyId: rootKeyId,
      algorithm: "Ed25519", signature: sign(null,
        framed(PROVISIONING_CA_DOMAINS.revocationManifest, revocation), root.privateKey)
        .toString("base64url") }] };
  const challenge = { contract: INITIAL_ENROLLMENT_CHALLENGE_CONTRACT, contractRevision: 1,
    challengeId: "1".repeat(32), nonce: Buffer.alloc(32, 7).toString("base64url"),
    platformScopeId: "2".repeat(32), provisionerIdentityHash: "3".repeat(64),
    installationKeyId, issuedAt: "2026-08-15T00:00:00.000Z",
    expiresAt: "2026-08-15T00:30:00.000Z" };
  const challengeHash = compileInitialEnrollmentChallengeCandidate(challenge).challengeHash;
  const request = { contract: INITIAL_ENROLLMENT_REQUEST_CONTRACT, contractRevision: 1,
    requestId: "4".repeat(32), challengeHash, platformScopeId: challenge.platformScopeId,
    provisionerIdentityHash: challenge.provisionerIdentityHash, installationKeyId,
    installationKeySpkiDer: installationSpki.toString("base64url"),
    requestedAt: "2026-08-15T00:05:00.000Z" };
  const requestSignature = lowS(sign("sha256", framed(INITIAL_ENROLLMENT_DOMAINS.request, request),
    { key: installation.privateKey, dsaEncoding: "ieee-p1363" })).toString("base64url");
  const requestEnvelope = { contract: INITIAL_ENROLLMENT_REQUEST_ENVELOPE_CONTRACT,
    contractRevision: 1, payload: request, signatures: [{ keyId: installationKeyId,
      algorithm: "ECDSA-P256-SHA256", signature: requestSignature }] };
  const certificate = { contract: INITIAL_ENROLLMENT_CERTIFICATE_CONTRACT, contractRevision: 1,
    enrollmentId: "5".repeat(32), platformScopeId: challenge.platformScopeId,
    provisionerIdentityHash: challenge.provisionerIdentityHash, installationKeyId,
    installationKeySpkiDer: installationSpki.toString("base64url"),
    issuedAt: "2026-08-15T00:10:00.000Z", expiresAt: "2027-02-11T00:10:00.000Z" };
  const certificateEnvelope = { contract: INITIAL_ENROLLMENT_CERTIFICATE_ENVELOPE_CONTRACT,
    contractRevision: 1, payload: certificate, signatures: [{ keyId: onlineKeyId,
      algorithm: "Ed25519", signature: sign(null,
        framed(INITIAL_ENROLLMENT_DOMAINS.certificate, certificate), online.privateKey)
        .toString("base64url") }] };
  const requestHash = createHash("sha256").update(framed(INITIAL_ENROLLMENT_DOMAINS.request, request)).digest("hex");
  const bundlePayload = { contract: OFFLINE_ENROLLMENT_BUNDLE_CONTRACT, contractRevision: 1,
    bundleId: "6".repeat(32), requestHash, platformScopeId: challenge.platformScopeId,
    provisionerIdentityHash: challenge.provisionerIdentityHash, installationKeyId,
    challenge, requestEnvelope, certificateEnvelope, onlineIssuingCertificateEnvelope,
    offlineIssuingCertificateEnvelope, revocationEnvelope,
    issuedAt: "2026-08-15T00:15:00.000Z", expiresAt: "2026-08-22T00:15:00.000Z" };
  const bundleEnvelope = { contract: OFFLINE_ENROLLMENT_BUNDLE_ENVELOPE_CONTRACT,
    contractRevision: 1, payload: bundlePayload, signatures: [{ keyId: offlineKeyId,
      algorithm: "Ed25519", signature: sign(null,
        framed(OFFLINE_ENROLLMENT_BUNDLE_DOMAIN, bundlePayload), offline.privateKey)
        .toString("base64url") }] };
  const result = { rootTrustSet, bundleEnvelope };
  Object.defineProperties(result, {
    onlinePrivateKey: { value: online.privateKey },
    offlinePrivateKey: { value: offline.privateKey }
  });
  return result;
}

test("signed offline bundle binds request, certificate and exact two-role CA chain", () => {
  const value = fixture();
  const result = verifyOfflineEnrollmentBundleCandidate({ ...value,
    evaluationTime: "2026-08-15T12:00:00.000Z" });
  assert.equal(result.status, "candidate");
  assert.equal(result.certificateCryptographicMatch, true);
  assert.equal(result.offlineBundleCryptographicMatch, true);
  assert.equal(result.consumptionRequired, true);
  assert.equal(result.runtimeOwnedCaTrustConfirmed, false);
  assert.equal(result.runtimeAuthorityConferred, false);
  for (const secret of ["signature", "spkiDer", "installationKeyId", "platformScopeId"]) {
    assert.equal(secret in result, false);
  }
});

test("wrong role, binding, signature, expiry and dynamic input fail closed", () => {
  const role = fixture();
  role.bundleEnvelope.payload.offlineIssuingCertificateEnvelope.payload.role =
    "online_enrollment_issuer";
  assert.equal(verifyOfflineEnrollmentBundleCandidate({ ...role,
    evaluationTime: "2026-08-15T12:00:00.000Z" }).status, "blocked");
  const binding = fixture();
  binding.bundleEnvelope.payload.requestHash = "f".repeat(64);
  assert.equal(verifyOfflineEnrollmentBundleCandidate({ ...binding,
    evaluationTime: "2026-08-15T12:00:00.000Z" }).reason,
  "offline_enrollment_bundle_binding_mismatch");
  const changed = fixture();
  changed.bundleEnvelope.signatures[0].signature = "A".repeat(86);
  assert.equal(verifyOfflineEnrollmentBundleCandidate({ ...changed,
    evaluationTime: "2026-08-15T12:00:00.000Z" }).status, "blocked");
  assert.equal(verifyOfflineEnrollmentBundleCandidate({ ...fixture(),
    evaluationTime: "2026-08-22T00:15:00.000Z" }).status, "blocked");
  const certificateExpiresFirst = fixture();
  certificateExpiresFirst.bundleEnvelope.payload.certificateEnvelope.payload.expiresAt =
    "2026-08-20T00:15:00.000Z";
  certificateExpiresFirst.bundleEnvelope.payload.certificateEnvelope.signatures[0].signature =
    sign(null, framed(INITIAL_ENROLLMENT_DOMAINS.certificate,
      certificateExpiresFirst.bundleEnvelope.payload.certificateEnvelope.payload),
    certificateExpiresFirst.onlinePrivateKey).toString("base64url");
  certificateExpiresFirst.bundleEnvelope.signatures[0].signature = sign(null,
    framed(OFFLINE_ENROLLMENT_BUNDLE_DOMAIN, certificateExpiresFirst.bundleEnvelope.payload),
    certificateExpiresFirst.offlinePrivateKey).toString("base64url");
  assert.equal(verifyOfflineEnrollmentBundleCandidate({ ...certificateExpiresFirst,
    evaluationTime: "2026-08-15T12:00:00.000Z" }).status, "blocked");
  let calls = 0;
  const dynamic = {};
  Object.defineProperty(dynamic, "rootTrustSet", { enumerable: true,
    get() { calls += 1; return fixture().rootTrustSet; } });
  dynamic.bundleEnvelope = fixture().bundleEnvelope;
  dynamic.evaluationTime = "2026-08-15T12:00:00.000Z";
  assert.equal(verifyOfflineEnrollmentBundleCandidate(dynamic).status, "blocked");
  assert.equal(calls, 0);
});

test("contract keeps replay, Trust, clock and import effects unimplemented", () => {
  const contract = describeOfflineEnrollmentBundlePureCoreContract();
  assert.equal(contract.maximumValidityDays, 7);
  assert.match(contract.caChain, /online_enrollment_issuer_then_offline_bundle_issuer/u);
  assert.equal(contract.oneTimeConsumptionLedger, "not_implemented");
  assert.equal(contract.runtimeOwnedCaTrustRollbackAndClock, "not_implemented");
  assert.equal(contract.filesystemImportEffect, "not_implemented");
  assert.equal(contract.runtimeAuthorityConferred, false);
});
