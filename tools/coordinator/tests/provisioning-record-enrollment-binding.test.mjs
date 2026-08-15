import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  INITIAL_ENROLLMENT_CERTIFICATE_CONTRACT,
  INITIAL_ENROLLMENT_CERTIFICATE_ENVELOPE_CONTRACT,
  INITIAL_ENROLLMENT_DOMAINS
} from "../src/security/initial-enrollment-pure-core.mjs";
import { PROVISIONING_CA_DOMAINS } from "../src/security/provisioning-ca-pure-core.ts";
import {
  buildProvisioningRecordDomainMessageCandidate,
  compileProvisioningRecordEnvelopeCandidate,
  compileProvisioningRevocationManifestCandidate,
  compileProvisioningTrustAnchorSetCandidate
} from "../src/security/provisioning-record-pure-core.mjs";
import {
  describeProvisioningRecordEnrollmentBindingContract,
  verifyProvisioningRecordEnrollmentBindingCandidate
} from "../src/security/provisioning-record-enrollment-binding.mjs";
import { canonicalizeProvisioningJsonValueCandidate } from
  "../src/security/provisioning-signature-primitives.mjs";

const ORDER = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
function lowS(value) {
  const result = Buffer.from(value);
  const s = BigInt(`0x${result.subarray(32).toString("hex")}`);
  if (s > (ORDER >> 1n)) Buffer.from((ORDER - s).toString(16).padStart(64, "0"), "hex").copy(result, 32);
  return result;
}
function frame(domain, value) {
  const bytes = canonicalizeProvisioningJsonValueCandidate(value).canonicalBytes;
  const length = Buffer.alloc(8); length.writeBigUInt64BE(BigInt(bytes.length));
  return Buffer.concat([Buffer.from(domain, "ascii"), length, bytes]);
}

function fixture() {
  const installation = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const root = generateKeyPairSync("ed25519");
  const issuer = generateKeyPairSync("ed25519");
  const installationSpki = installation.publicKey.export({ format: "der", type: "spki" });
  const rootSpki = root.publicKey.export({ format: "der", type: "spki" });
  const issuerSpki = issuer.publicKey.export({ format: "der", type: "spki" });
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  const installationKeyId = hash(installationSpki), rootKeyId = hash(rootSpki), issuerKeyId = hash(issuerSpki);
  const caSeriesId = "7".repeat(32), enrollmentId = "4".repeat(32);
  const record = { contract: "crdd-coordinator/provisioning-record", contractRevision: 1,
    recordId: "1".repeat(32), recordRevision: 1, previousRecordHash: null,
    platformScopeId: "2".repeat(32), provisionerIdentityHash: "3".repeat(64),
    provisionerEnrollmentId: enrollmentId,
    authorityRootAbsolutePath: process.platform === "win32" ? "C:\\CRDD-Authority" : "/var/lib/crdd-authority",
    authorityRootIdentityHash: "5".repeat(64), authorityRootProtectionHash: "6".repeat(64),
    runtimePrincipalModes: ["local_interactive_selected_user", "server_dedicated_service_account"],
    trustEpoch: 1, issuedAt: "2026-08-01T00:00:00.000Z", expiresAt: "2027-01-28T00:00:00.000Z" };
  const recordMessage = buildProvisioningRecordDomainMessageCandidate(record).message;
  const recordEnvelope = { contract: "crdd-coordinator/provisioning-record-envelope", contractRevision: 1,
    payload: record, signatures: [{ keyId: installationKeyId, algorithm: "ECDSA-P256-SHA256",
      signature: lowS(sign("sha256", recordMessage,
        { key: installation.privateKey, dsaEncoding: "ieee-p1363" })).toString("base64url") }] };
  const recordKeyset = { contract: "crdd-coordinator/provisioning-trust-anchor-set", contractRevision: 1,
    trustEpoch: 1, keys: [{ keyId: installationKeyId, algorithm: "ECDSA-P256-SHA256",
      spkiDer: installationSpki.toString("base64url"), enrollmentCaId: caSeriesId,
      notBefore: "2026-01-01T00:00:00.000Z", notAfter: "2027-01-01T00:00:00.000Z" }] };
  const recordRevocations = { contract: "crdd-coordinator/provisioning-revocation-manifest",
    contractRevision: 1, trustEpoch: 1, revocationRevision: 1, revoked: [] };
  const rootTrustSet = { contract: "crdd-coordinator/provisioning-ca-root-trust-set",
    contractRevision: 1, trustEpoch: 1, roots: [{ keyId: rootKeyId, algorithm: "Ed25519",
      spkiDer: rootSpki.toString("base64url"), notBefore: "2026-01-01T00:00:00.000Z",
      notAfter: "2028-01-01T00:00:00.000Z" }] };
  const issuing = { contract: "crdd-coordinator/provisioning-ca-issuing-certificate",
    contractRevision: 1, caSeriesId, role: "online_enrollment_issuer", keyId: issuerKeyId,
    algorithm: "Ed25519", spkiDer: issuerSpki.toString("base64url"), rootKeyId, trustEpoch: 1,
    notBefore: "2026-01-01T00:00:00.000Z", notAfter: "2026-12-31T00:00:00.000Z" };
  const issuingCertificateEnvelope = {
    contract: "crdd-coordinator/provisioning-ca-issuing-certificate-envelope", contractRevision: 1,
    payload: issuing, signatures: [{ keyId: rootKeyId, algorithm: "Ed25519",
      signature: sign(null, frame(PROVISIONING_CA_DOMAINS.issuingCertificate, issuing), root.privateKey)
        .toString("base64url") }] };
  const caRevocations = { contract: "crdd-coordinator/provisioning-ca-revocation-manifest",
    contractRevision: 1, trustEpoch: 1, revocationRevision: 1,
    issuedAt: "2026-08-15T00:00:00.000Z", expiresAt: "2026-08-16T00:00:00.000Z", revoked: [] };
  const caRevocationEnvelope = { contract: "crdd-coordinator/provisioning-ca-revocation-manifest-envelope",
    contractRevision: 1, payload: caRevocations, signatures: [{ keyId: rootKeyId, algorithm: "Ed25519",
      signature: sign(null, frame(PROVISIONING_CA_DOMAINS.revocationManifest, caRevocations), root.privateKey)
        .toString("base64url") }] };
  const certificate = { contract: INITIAL_ENROLLMENT_CERTIFICATE_CONTRACT, contractRevision: 1,
    enrollmentId, platformScopeId: record.platformScopeId,
    provisionerIdentityHash: record.provisionerIdentityHash, installationKeyId,
    installationKeySpkiDer: installationSpki.toString("base64url"),
    issuedAt: "2026-08-01T00:00:00.000Z", expiresAt: "2027-01-28T00:00:00.000Z" };
  const certificateEnvelope = { contract: INITIAL_ENROLLMENT_CERTIFICATE_ENVELOPE_CONTRACT,
    contractRevision: 1, payload: certificate, signatures: [{ keyId: issuerKeyId,
      algorithm: "Ed25519", signature: sign(null,
        frame(INITIAL_ENROLLMENT_DOMAINS.certificate, certificate), issuer.privateKey).toString("base64url") }] };
  const compile = (fn, value) => fn(value).canonicalBytes;
  return {
    recordEnvelopeBytes: compile(compileProvisioningRecordEnvelopeCandidate, recordEnvelope),
    recordTrustAnchorSetBytes: compile(compileProvisioningTrustAnchorSetCandidate, recordKeyset),
    recordRevocationManifestBytes: compile(compileProvisioningRevocationManifestCandidate, recordRevocations),
    certificateBindings: [{ certificateEnvelope, issuingCertificateEnvelope }],
    provisioningCaRootTrustSet: rootTrustSet, provisioningCaRevocationEnvelope: caRevocationEnvelope,
    evaluationTime: "2026-08-15T12:00:00.000Z"
  };
}

test("every Record signer is bound to a current enrollment certificate and CA series", () => {
  const result = verifyProvisioningRecordEnrollmentBindingCandidate(fixture());
  assert.equal(result.status, "candidate");
  assert.equal(result.verifiedRecordSignatureCount, 1);
  assert.equal(result.verifiedEnrollmentBindingCount, 1);
  assert.equal(result.cryptographicAndEnrollmentBindingSatisfied, true);
  assert.equal(result.runtimeOwnedTrustConfirmed, false);
  assert.equal(result.runtimeAuthorityConferred, false);
});

test("enrollment, scope, key, CA series and dynamic mismatches fail closed", () => {
  for (const mutate of [
    (x) => { x.certificateBindings[0].certificateEnvelope.payload.enrollmentId = "8".repeat(32); },
    (x) => { x.certificateBindings[0].certificateEnvelope.payload.platformScopeId = "8".repeat(32); },
    (x) => { x.certificateBindings[0].issuingCertificateEnvelope.payload.caSeriesId = "8".repeat(32); }
  ]) {
    const value = fixture(); mutate(value);
    assert.equal(verifyProvisioningRecordEnrollmentBindingCandidate(value).status, "blocked");
  }
  let calls = 0;
  const dynamic = fixture();
  Object.defineProperty(dynamic, "certificateBindings", { enumerable: true,
    get() { calls += 1; return []; } });
  assert.equal(verifyProvisioningRecordEnrollmentBindingCandidate(dynamic).status, "blocked");
  assert.equal(calls, 0);
});

test("binding remains a non-authoritative candidate", () => {
  const contract = describeProvisioningRecordEnrollmentBindingContract();
  assert.equal(contract.verification, "implemented_candidate");
  assert.match(contract.signerBinding, /every_record_signature/u);
  assert.equal(contract.runtimeOwnedTrustRollbackClockFilesystemAndActivation, "not_implemented");
  assert.equal(contract.runtimeAuthorityConferred, false);
});
