import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  INITIAL_ENROLLMENT_CERTIFICATE_CONTRACT,
  INITIAL_ENROLLMENT_CERTIFICATE_ENVELOPE_CONTRACT,
  INITIAL_ENROLLMENT_DOMAINS
} from "../src/security/initial-enrollment-pure-core.mjs";
import {
  describeEnrollmentCertificateRenewalContract,
  verifyEnrollmentCertificateRenewalCandidate
} from "../src/security/enrollment-certificate-renewal.ts";
import { canonicalizeProvisioningJsonValueCandidate } from
  "../src/security/provisioning-signature-primitives.mjs";

function frame(payload) {
  const bytes = canonicalizeProvisioningJsonValueCandidate(payload).canonicalBytes;
  const length = Buffer.alloc(8); length.writeBigUInt64BE(BigInt(bytes.length));
  return Buffer.concat([Buffer.from(INITIAL_ENROLLMENT_DOMAINS.certificate, "ascii"), length, bytes]);
}

function fixture() {
  const installation = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const previousIssuer = generateKeyPairSync("ed25519");
  const nextIssuer = generateKeyPairSync("ed25519");
  const installationSpki = installation.publicKey.export({ format: "der", type: "spki" });
  const installationKeyId = createHash("sha256").update(installationSpki).digest("hex");
  const base = { contract: INITIAL_ENROLLMENT_CERTIFICATE_CONTRACT, contractRevision: 1,
    enrollmentId: "1".repeat(32), platformScopeId: "2".repeat(32),
    provisionerIdentityHash: "3".repeat(64), installationKeyId,
    installationKeySpkiDer: installationSpki.toString("base64url") };
  const previous = { ...base, issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-06-30T00:00:00.000Z" };
  const next = { ...base, issuedAt: "2026-06-01T00:00:00.000Z",
    expiresAt: "2026-11-28T00:00:00.000Z" };
  const envelope = (payload, issuer) => {
    const spki = issuer.publicKey.export({ format: "der", type: "spki" });
    return { contract: INITIAL_ENROLLMENT_CERTIFICATE_ENVELOPE_CONTRACT, contractRevision: 1,
      payload, signatures: [{ keyId: createHash("sha256").update(spki).digest("hex"),
        algorithm: "Ed25519", signature: sign(null, frame(payload), issuer.privateKey)
          .toString("base64url") }] };
  };
  return { previousCertificateEnvelope: envelope(previous, previousIssuer),
    previousIssuerSpkiDer: previousIssuer.publicKey.export({ format: "der", type: "spki" }),
    nextCertificateEnvelope: envelope(next, nextIssuer),
    nextIssuerSpkiDer: nextIssuer.publicKey.export({ format: "der", type: "spki" }),
    evaluationTime: "2026-06-01T00:00:00.000Z" };
}

test("renewal preserves identity and starts within the final 30 days", () => {
  const result = verifyEnrollmentCertificateRenewalCandidate(fixture());
  assert.equal(result.status, "candidate");
  assert.equal(result.identityContinuitySatisfied, true);
  assert.equal(result.renewalWindowSatisfied, true);
  assert.equal(result.runtimeClockAuthorityConfirmed, false);
  assert.equal(result.runtimeAuthorityConferred, false);
});

test("early, expired, identity-changing and invalidly signed renewals fail closed", () => {
  const early = fixture(); early.evaluationTime = "2026-05-30T23:59:59.999Z";
  assert.equal(verifyEnrollmentCertificateRenewalCandidate(early).status, "blocked");
  const expired = fixture(); expired.evaluationTime = "2026-06-30T00:00:00.000Z";
  assert.equal(verifyEnrollmentCertificateRenewalCandidate(expired).status, "blocked");
  const identity = fixture();
  identity.nextCertificateEnvelope.payload.platformScopeId = "9".repeat(32);
  assert.equal(verifyEnrollmentCertificateRenewalCandidate(identity).status, "blocked");
  const changed = fixture(); changed.nextCertificateEnvelope.signatures[0].signature = "A".repeat(86);
  assert.equal(verifyEnrollmentCertificateRenewalCandidate(changed).status, "blocked");
});

test("contract separates pure transition from issuance and persistence effects", () => {
  const contract = describeEnrollmentCertificateRenewalContract();
  assert.equal(contract.renewalWindowDays, 30);
  assert.equal(contract.maximumOverlapDays, 30);
  assert.equal(contract.transitionVerification, "implemented_candidate");
  assert.equal(contract.certificateIssuanceAndAutomaticRenewalEffect, "not_implemented");
  assert.equal(contract.runtimeAuthorityConferred, false);
});
