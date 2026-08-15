import assert from "node:assert/strict";
import { generateKeyPairSync, createHash, sign } from "node:crypto";
import test from "node:test";

import {
  INITIAL_ENROLLMENT_CHALLENGE_CONTRACT,
  INITIAL_ENROLLMENT_CERTIFICATE_CONTRACT,
  INITIAL_ENROLLMENT_DOMAINS,
  INITIAL_ENROLLMENT_REQUEST_CONTRACT,
  compileInitialEnrollmentChallengeCandidate,
  describeInitialEnrollmentPureCoreContract,
  verifyInitialEnrollmentCertificateCandidate,
  verifyInitialEnrollmentFlowCandidate,
  verifyInitialEnrollmentRequestCandidate
} from "../src/security/initial-enrollment-pure-core.mjs";
import { canonicalizeProvisioningJsonValueCandidate } from
  "../src/security/provisioning-signature-primitives.mjs";

function framed(domain, payload) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(payload).canonicalBytes;
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.length));
  return Buffer.concat([Buffer.from(domain, "ascii"), length, canonical]);
}

function fixture() {
  const installation = generateKeyPairSync("ed25519");
  const issuer = generateKeyPairSync("ed25519");
  const installationSpki = installation.publicKey.export({ format: "der", type: "spki" });
  const installationKeyId = createHash("sha256").update(installationSpki).digest("hex");
  const challenge = {
    contract: INITIAL_ENROLLMENT_CHALLENGE_CONTRACT,
    contractRevision: 1,
    challengeId: "1".repeat(32),
    nonce: Buffer.alloc(32, 7).toString("base64url"),
    platformScopeId: "2".repeat(32),
    provisionerIdentityHash: "3".repeat(64),
    installationKeyId,
    issuedAt: "2026-08-15T00:00:00.000Z",
    expiresAt: "2026-08-15T00:30:00.000Z"
  };
  const challengeHash = compileInitialEnrollmentChallengeCandidate(challenge).challengeHash;
  const request = {
    contract: INITIAL_ENROLLMENT_REQUEST_CONTRACT,
    contractRevision: 1,
    requestId: "4".repeat(32),
    challengeHash,
    platformScopeId: challenge.platformScopeId,
    provisionerIdentityHash: challenge.provisionerIdentityHash,
    installationKeyId,
    installationKeySpkiDer: installationSpki.toString("base64url"),
    requestedAt: "2026-08-15T00:05:00.000Z"
  };
  const proofOfPossession = sign(null, framed(INITIAL_ENROLLMENT_DOMAINS.request, request),
    installation.privateKey).toString("base64url");
  const certificate = {
    contract: INITIAL_ENROLLMENT_CERTIFICATE_CONTRACT,
    contractRevision: 1,
    enrollmentId: "5".repeat(32),
    platformScopeId: challenge.platformScopeId,
    provisionerIdentityHash: challenge.provisionerIdentityHash,
    installationKeyId,
    installationKeySpkiDer: installationSpki.toString("base64url"),
    issuedAt: "2026-08-15T00:10:00.000Z",
    expiresAt: "2027-02-11T00:10:00.000Z"
  };
  const certificateSignature = sign(null,
    framed(INITIAL_ENROLLMENT_DOMAINS.certificate, certificate), issuer.privateKey).toString("base64url");
  return { challenge, request, proofOfPossession, certificate, certificateSignature,
    issuerSpki: issuer.publicKey.export({ format: "der", type: "spki" }) };
}

test("initial online enrollment verifies PoP and certificate without conferring authority", () => {
  const value = fixture();
  assert.equal(compileInitialEnrollmentChallengeCandidate(value.challenge).status, "candidate");
  const request = verifyInitialEnrollmentRequestCandidate({
    challenge: value.challenge,
    request: value.request,
    proofOfPossession: value.proofOfPossession
  });
  assert.equal(request.status, "candidate");
  assert.equal(request.proofOfPossessionCryptographicMatch, true);
  assert.equal(request.consumptionRequired, true);
  assert.equal(request.runtimeAuthorityConferred, false);
  const certificate = verifyInitialEnrollmentCertificateCandidate({
    certificate: value.certificate,
    issuerSpkiDer: value.issuerSpki,
    signature: value.certificateSignature
  });
  assert.equal(certificate.status, "candidate");
  assert.equal(certificate.runtimeAuthorityConferred, false);
  const flow = verifyInitialEnrollmentFlowCandidate({
    challenge: value.challenge, request: value.request,
    proofOfPossession: value.proofOfPossession, certificate: value.certificate,
    issuerSpkiDer: value.issuerSpki, certificateSignature: value.certificateSignature
  });
  assert.equal(flow.status, "candidate");
  assert.equal(flow.runtimeAuthorityConferred, false);
});

test("binding mismatch, expired request time, invalid signatures, and dynamic input fail closed", () => {
  const value = fixture();
  assert.equal(verifyInitialEnrollmentRequestCandidate({ challenge: value.challenge,
    request: { ...value.request, platformScopeId: "9".repeat(32) },
    proofOfPossession: value.proofOfPossession }).status, "blocked");
  assert.equal(verifyInitialEnrollmentRequestCandidate({ challenge: value.challenge,
    request: { ...value.request, requestedAt: value.challenge.expiresAt },
    proofOfPossession: value.proofOfPossession }).status, "blocked");
  assert.equal(verifyInitialEnrollmentRequestCandidate({ challenge: value.challenge,
    request: value.request, proofOfPossession: "A".repeat(86) }).status, "blocked");
  let called = 0;
  const challenge = { ...value.challenge };
  Object.defineProperty(challenge, "nonce", { enumerable: true, get() { called += 1; return value.challenge.nonce; } });
  assert.equal(compileInitialEnrollmentChallengeCandidate(challenge).status, "blocked");
  assert.equal(called, 0);
  const canonicalNonce = value.challenge.nonce;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const aliasNonce = [...alphabet].map((tail) => canonicalNonce.slice(0, -1) + tail)
    .find((item) => item !== canonicalNonce &&
      Buffer.from(item, "base64url").equals(Buffer.from(canonicalNonce, "base64url")));
  assert.ok(aliasNonce);
  assert.equal(compileInitialEnrollmentChallengeCandidate({
    ...value.challenge, nonce: aliasNonce
  }).status, "blocked");
  assert.equal(verifyInitialEnrollmentCertificateCandidate({
    certificate: value.certificate, issuerSpkiDer: Buffer.alloc(1_000_000),
    signature: value.certificateSignature
  }).status, "blocked");
  assert.equal(verifyInitialEnrollmentFlowCandidate({
    challenge: value.challenge, request: value.request,
    proofOfPossession: value.proofOfPossession,
    certificate: { ...value.certificate, platformScopeId: "8".repeat(32) },
    issuerSpkiDer: value.issuerSpki, certificateSignature: value.certificateSignature
  }).status, "blocked");
  const outer = {};
  Object.defineProperty(outer, "challenge", { enumerable: true, get() { called += 1; return value.challenge; } });
  outer.request = value.request;
  outer.proofOfPossession = value.proofOfPossession;
  assert.equal(verifyInitialEnrollmentRequestCandidate(outer).status, "blocked");
  assert.equal(called, 0);
});

test("contract keeps effects and deferred enrollment capabilities closed", () => {
  assert.deepEqual(describeInitialEnrollmentPureCoreContract(), {
    contract: "crdd-coordinator/initial-enrollment-pure-core",
    contractRevision: 1,
    supportedFlow: "initial_online_enrollment_only",
    challengeObjectContractAndDomainFraming: "implemented_candidate",
    requestObjectContractAndDomainFraming: "implemented_candidate",
    certificateObjectContractAndDomainFraming: "implemented_candidate",
    rawWireDecoderAndTransportCodec: "not_implemented",
    requestProofOfPossessionVerification: "implemented_candidate",
    certificateSignatureVerification: "implemented_candidate",
    initialFlowBindingVerification: "implemented_candidate",
    renewal: "not_implemented",
    offlineEnrollment: "not_implemented",
    runtimeClock: "not_implemented",
    oneTimeConsumptionLedger: "not_implemented",
    runtimeOwnedCaTrustAndRevocation: "not_implemented",
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  });
});
