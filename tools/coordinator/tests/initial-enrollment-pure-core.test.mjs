import assert from "node:assert/strict";
import { generateKeyPairSync, createHash, sign } from "node:crypto";
import test from "node:test";

import {
  INITIAL_ENROLLMENT_CHALLENGE_CONTRACT,
  INITIAL_ENROLLMENT_CERTIFICATE_CONTRACT,
  INITIAL_ENROLLMENT_CERTIFICATE_ENVELOPE_CONTRACT,
  INITIAL_ENROLLMENT_DOMAINS,
  INITIAL_ENROLLMENT_REQUEST_CONTRACT,
  INITIAL_ENROLLMENT_REQUEST_ENVELOPE_CONTRACT,
  compileInitialEnrollmentChallengeCandidate,
  decodeInitialEnrollmentCertificatePayloadCandidate,
  decodeInitialEnrollmentCertificateEnvelopeCandidate,
  decodeInitialEnrollmentChallengePayloadCandidate,
  decodeInitialEnrollmentRequestEnvelopeCandidate,
  decodeInitialEnrollmentRequestPayloadCandidate,
  describeInitialEnrollmentPureCoreContract,
  verifyInitialEnrollmentCertificateCandidate,
  verifyInitialEnrollmentFlowCandidate,
  verifyInitialEnrollmentRequestCandidate
} from "../src/security/initial-enrollment-pure-core.mjs";
import { canonicalizeProvisioningJsonValueCandidate } from
  "../src/security/provisioning-signature-primitives.mjs";

const P256_ORDER = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");

function lowSP256(signature) {
  const result = Buffer.from(signature);
  const s = BigInt(`0x${result.subarray(32).toString("hex")}`);
  if (s > (P256_ORDER >> 1n)) {
    Buffer.from((P256_ORDER - s).toString(16).padStart(64, "0"), "hex").copy(result, 32);
  }
  return result;
}

function framed(domain, payload) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(payload).canonicalBytes;
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.length));
  return Buffer.concat([Buffer.from(domain, "ascii"), length, canonical]);
}

function canonicalBytes(payload) {
  return canonicalizeProvisioningJsonValueCandidate(payload).canonicalBytes;
}

function fixture() {
  const installation = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
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
  const proofOfPossession = lowSP256(sign("sha256", framed(INITIAL_ENROLLMENT_DOMAINS.request, request), {
    key: installation.privateKey, dsaEncoding: "ieee-p1363"
  })).toString("base64url");
  const requestEnvelope = {
    contract: INITIAL_ENROLLMENT_REQUEST_ENVELOPE_CONTRACT,
    contractRevision: 1,
    payload: request,
    signatures: [{ keyId: installationKeyId, algorithm: "ECDSA-P256-SHA256",
      signature: proofOfPossession }]
  };
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
  const issuerSpki = issuer.publicKey.export({ format: "der", type: "spki" });
  const certificateEnvelope = {
    contract: INITIAL_ENROLLMENT_CERTIFICATE_ENVELOPE_CONTRACT,
    contractRevision: 1,
    payload: certificate,
    signatures: [{ keyId: createHash("sha256").update(issuerSpki).digest("hex"),
      algorithm: "Ed25519", signature: certificateSignature }]
  };
  return { challenge, request, proofOfPossession, requestEnvelope, certificate,
    certificateSignature, certificateEnvelope, issuerSpki };
}

test("initial online enrollment verifies PoP and certificate without conferring authority", () => {
  const value = fixture();
  assert.equal(compileInitialEnrollmentChallengeCandidate(value.challenge).status, "candidate");
  const request = verifyInitialEnrollmentRequestCandidate({
    challenge: value.challenge,
    requestEnvelope: value.requestEnvelope
  });
  assert.equal(request.status, "candidate");
  assert.equal(request.proofOfPossessionCryptographicMatch, true);
  assert.equal(request.consumptionRequired, true);
  assert.equal(request.runtimeAuthorityConferred, false);
  const certificate = verifyInitialEnrollmentCertificateCandidate({
    certificateEnvelope: value.certificateEnvelope,
    issuerSpkiDer: value.issuerSpki
  });
  assert.equal(certificate.status, "candidate");
  assert.equal(certificate.runtimeAuthorityConferred, false);
  const flow = verifyInitialEnrollmentFlowCandidate({
    challenge: value.challenge, requestEnvelope: value.requestEnvelope,
    certificateEnvelope: value.certificateEnvelope, issuerSpkiDer: value.issuerSpki
  });
  assert.equal(flow.status, "candidate");
  assert.equal(flow.runtimeAuthorityConferred, false);
});

test("binding mismatch, expired request time, invalid signatures, and dynamic input fail closed", () => {
  const value = fixture();
  assert.equal(verifyInitialEnrollmentRequestCandidate({ challenge: value.challenge,
    requestEnvelope: { ...value.requestEnvelope,
      payload: { ...value.request, platformScopeId: "9".repeat(32) } } }).status, "blocked");
  assert.equal(verifyInitialEnrollmentRequestCandidate({ challenge: value.challenge,
    requestEnvelope: { ...value.requestEnvelope,
      payload: { ...value.request, requestedAt: value.challenge.expiresAt } } }).status, "blocked");
  assert.equal(verifyInitialEnrollmentRequestCandidate({ challenge: value.challenge,
    requestEnvelope: { ...value.requestEnvelope, signatures: [{
      ...value.requestEnvelope.signatures[0], signature: "A".repeat(86)
    }] } }).status, "blocked");
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
    certificateEnvelope: value.certificateEnvelope, issuerSpkiDer: Buffer.alloc(1_000_000)
  }).status, "blocked");
  assert.equal(verifyInitialEnrollmentFlowCandidate({
    challenge: value.challenge, requestEnvelope: value.requestEnvelope,
    certificateEnvelope: { ...value.certificateEnvelope,
      payload: { ...value.certificate, platformScopeId: "8".repeat(32) } },
    issuerSpkiDer: value.issuerSpki
  }).status, "blocked");
  const outer = {};
  Object.defineProperty(outer, "challenge", { enumerable: true, get() { called += 1; return value.challenge; } });
  outer.requestEnvelope = value.requestEnvelope;
  assert.equal(verifyInitialEnrollmentRequestCandidate(outer).status, "blocked");
  assert.equal(called, 0);
});

test("request and certificate envelopes require one exact role-bound signature", () => {
  const value = fixture();
  const requestResult = verifyInitialEnrollmentRequestCandidate({
    challenge: value.challenge, requestEnvelope: value.requestEnvelope
  });
  assert.deepEqual(Object.keys(requestResult).sort(), [
    "consumptionRequired", "filesystemEffectIssued", "networkEffectIssued",
    "proofOfPossessionCryptographicMatch", "reason", "requestHash",
    "runtimeAuthorityConferred", "runtimeCapabilityIssued", "status"
  ].sort());
  assert.equal(JSON.stringify(requestResult).includes(value.proofOfPossession), false);
  assert.equal(JSON.stringify(requestResult).includes(value.request.installationKeyId), false);
  const requestCases = [
    { ...value.requestEnvelope, signatures: [] },
    { ...value.requestEnvelope, signatures: [value.requestEnvelope.signatures[0],
      value.requestEnvelope.signatures[0]] },
    { ...value.requestEnvelope, signatures: [{ ...value.requestEnvelope.signatures[0],
      keyId: "9".repeat(64) }] },
    { ...value.requestEnvelope, signatures: [{ ...value.requestEnvelope.signatures[0],
      algorithm: "RSA-PSS" }] },
    { ...value.requestEnvelope, contract: INITIAL_ENROLLMENT_CERTIFICATE_ENVELOPE_CONTRACT },
    { ...value.requestEnvelope, extra: true }
  ];
  for (const requestEnvelope of requestCases) {
    assert.equal(verifyInitialEnrollmentRequestCandidate({
      challenge: value.challenge, requestEnvelope
    }).status, "blocked");
  }
  const customSignatures = Object.setPrototypeOf([...value.requestEnvelope.signatures], null);
  assert.equal(verifyInitialEnrollmentRequestCandidate({ challenge: value.challenge,
    requestEnvelope: { ...value.requestEnvelope, signatures: customSignatures } }).status, "blocked");
  let calls = 0;
  const accessorSignature = {};
  Object.defineProperty(accessorSignature, "keyId", { enumerable: true,
    get() { calls += 1; return value.requestEnvelope.signatures[0].keyId; } });
  accessorSignature.algorithm = "ECDSA-P256-SHA256";
  accessorSignature.signature = value.proofOfPossession;
  assert.equal(verifyInitialEnrollmentRequestCandidate({ challenge: value.challenge,
    requestEnvelope: { ...value.requestEnvelope, signatures: [accessorSignature] } }).status,
  "blocked");
  assert.equal(calls, 0);
  const proxyEnvelope = new Proxy(value.requestEnvelope, {
    get() { calls += 1; throw new Error("must not execute"); },
    ownKeys() { calls += 1; throw new Error("must not execute"); }
  });
  assert.equal(verifyInitialEnrollmentRequestCandidate({ challenge: value.challenge,
    requestEnvelope: proxyEnvelope }).status, "blocked");
  assert.equal(calls, 0);
  const signaturesWithSymbol = [...value.requestEnvelope.signatures];
  signaturesWithSymbol[Symbol("extra")] = true;
  assert.equal(verifyInitialEnrollmentRequestCandidate({ challenge: value.challenge,
    requestEnvelope: { ...value.requestEnvelope, signatures: signaturesWithSymbol } }).status,
  "blocked");
  assert.equal(verifyInitialEnrollmentCertificateCandidate({
    certificateEnvelope: { ...value.certificateEnvelope, signatures: [{
      ...value.certificateEnvelope.signatures[0], keyId: "8".repeat(64)
    }] }, issuerSpkiDer: value.issuerSpki
  }).status, "blocked");
  assert.equal(verifyInitialEnrollmentCertificateCandidate({
    certificateEnvelope: value.requestEnvelope, issuerSpkiDer: value.issuerSpki
  }).status, "blocked");
  assert.equal(verifyInitialEnrollmentCertificateCandidate({
    certificateEnvelope: value.certificateEnvelope, issuerSpkiDer: new Uint8Array(value.issuerSpki)
  }).status, "blocked");
  assert.equal(verifyInitialEnrollmentCertificateCandidate({
    certificateEnvelope: value.certificateEnvelope, issuerSpkiDer: Buffer.alloc(44)
  }).status, "blocked");
  const otherIssuer = generateKeyPairSync("ed25519").publicKey.export({
    format: "der", type: "spki"
  });
  assert.equal(verifyInitialEnrollmentCertificateCandidate({
    certificateEnvelope: value.certificateEnvelope, issuerSpkiDer: otherIssuer
  }).status, "blocked");
  const sharedIssuer = Buffer.from(new SharedArrayBuffer(value.issuerSpki.length));
  value.issuerSpki.copy(sharedIssuer);
  const certificateResult = verifyInitialEnrollmentCertificateCandidate({
    certificateEnvelope: value.certificateEnvelope, issuerSpkiDer: sharedIssuer
  });
  assert.equal(certificateResult.status, "candidate");
  sharedIssuer.fill(0);
  assert.equal(certificateResult.status, "candidate");
  assert.equal(JSON.stringify(certificateResult).includes(value.certificateSignature), false);
});

test("three raw payload decoders accept only canonical bounded JSON bytes", () => {
  const value = fixture();
  const cases = [
    [value.challenge, decodeInitialEnrollmentChallengePayloadCandidate,
      "challengeHash", compileInitialEnrollmentChallengeCandidate(value.challenge).challengeHash],
    [value.request, decodeInitialEnrollmentRequestPayloadCandidate,
      "requestHash", createHash("sha256").update(framed(INITIAL_ENROLLMENT_DOMAINS.request,
        value.request)).digest("hex")],
    [value.certificate, decodeInitialEnrollmentCertificatePayloadCandidate,
      "certificateHash", createHash("sha256").update(framed(INITIAL_ENROLLMENT_DOMAINS.certificate,
        value.certificate)).digest("hex")]
  ];
  for (const [payload, decode, hashField, expectedHash] of cases) {
    const bytes = canonicalBytes(payload);
    const result = decode(bytes);
    assert.equal(result.status, "candidate");
    assert.equal(result[hashField], expectedHash);
    bytes.fill(0);
    assert.equal(result[hashField], expectedHash);
    assert.deepEqual(Object.keys(result).sort(), [
      "filesystemEffectIssued", hashField, "networkEffectIssued", "reason",
      "runtimeAuthorityConferred", "runtimeCapabilityIssued", "status"
    ].sort());
    assert.equal(JSON.stringify(result).includes(payload.platformScopeId), false);
  }
});

test("raw payload decoders reject noncanonical, malformed, cross-artifact, and oversized input", () => {
  const value = fixture();
  const canonical = canonicalBytes(value.challenge);
  assert.equal(decodeInitialEnrollmentChallengePayloadCandidate(Buffer.alloc(131_072)).reason,
    "initial_enrollment_challenge_raw_payload_invalid");
  assert.equal(decodeInitialEnrollmentChallengePayloadCandidate(Buffer.alloc(131_073)).reason,
    "initial_enrollment_challenge_raw_payload_bytes_exceeded");
  const duplicate = Buffer.from(JSON.stringify({ ...value.challenge }).replace(
    `"challengeId":"${value.challenge.challengeId}"`,
    `"challengeId":"${value.challenge.challengeId}","challengeId":"${value.challenge.challengeId}"`));
  const reordered = Buffer.from(JSON.stringify(value.challenge));
  const invalidInputs = [
    new Uint8Array(canonical), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), canonical]),
    Buffer.from([0xc3, 0x28]), Buffer.alloc(0), Buffer.concat([canonical, Buffer.from("\n")]),
    duplicate, reordered, canonicalBytes(value.request),
    canonicalBytes({ ...value.challenge, contractRevision: 2 })
  ];
  for (const input of invalidInputs) {
    assert.equal(decodeInitialEnrollmentChallengePayloadCandidate(input).status, "blocked");
  }
  assert.equal(decodeInitialEnrollmentRequestPayloadCandidate(canonicalBytes(value.challenge)).status,
    "blocked");
  assert.equal(decodeInitialEnrollmentCertificatePayloadCandidate(canonicalBytes(value.request)).status,
    "blocked");
});

test("request and certificate raw envelope decoders accept only canonical bounded JSON bytes", () => {
  const value = fixture();
  const cases = [
    [value.requestEnvelope, decodeInitialEnrollmentRequestEnvelopeCandidate,
      "requestHash", createHash("sha256").update(framed(INITIAL_ENROLLMENT_DOMAINS.request,
        value.request)).digest("hex")],
    [value.certificateEnvelope, decodeInitialEnrollmentCertificateEnvelopeCandidate,
      "certificateHash", createHash("sha256").update(framed(INITIAL_ENROLLMENT_DOMAINS.certificate,
        value.certificate)).digest("hex")]
  ];
  for (const [envelope, decode, hashField, expectedHash] of cases) {
    const bytes = canonicalBytes(envelope);
    const result = decode(bytes);
    assert.equal(result.status, "candidate");
    assert.equal(result[hashField], expectedHash);
    assert.match(result.reason, /cryptographic_verification_required/u);
    bytes.fill(0);
    assert.equal(result[hashField], expectedHash);
    assert.deepEqual(Object.keys(result).sort(), [
      "filesystemEffectIssued", hashField, "networkEffectIssued", "reason",
      "runtimeAuthorityConferred", "runtimeCapabilityIssued", "status"
    ].sort());
    assert.equal(JSON.stringify(result).includes(envelope.payload.platformScopeId), false);
    assert.equal(JSON.stringify(result).includes(envelope.signatures[0].signature), false);
  }
});

test("raw envelope decoders reject noncanonical malformed and cross-artifact input", () => {
  const value = fixture();
  const canonical = canonicalBytes(value.requestEnvelope);
  const duplicate = Buffer.from(JSON.stringify(value.requestEnvelope).replace(
    `"contractRevision":1`, `"contractRevision":1,"contractRevision":1`));
  const invalidInputs = [
    new Uint8Array(canonical), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), canonical]),
    Buffer.from([0xc3, 0x28]), Buffer.alloc(0), Buffer.concat([canonical, Buffer.from("\n")]),
    duplicate, Buffer.from(JSON.stringify(value.requestEnvelope)),
    canonicalBytes({ ...value.requestEnvelope, contractRevision: 2 }),
    canonicalBytes(value.certificateEnvelope)
  ];
  for (const input of invalidInputs) {
    assert.equal(decodeInitialEnrollmentRequestEnvelopeCandidate(input).status, "blocked");
  }
  assert.equal(decodeInitialEnrollmentRequestEnvelopeCandidate(Buffer.alloc(131_072)).status,
    "blocked");
  assert.equal(decodeInitialEnrollmentRequestEnvelopeCandidate(Buffer.alloc(131_073)).reason,
    "initial_enrollment_request_raw_envelope_bytes_exceeded");
  assert.equal(decodeInitialEnrollmentCertificateEnvelopeCandidate(
    canonicalBytes(value.requestEnvelope)).status, "blocked");
  assert.equal(decodeInitialEnrollmentCertificateEnvelopeCandidate(
    canonicalBytes({ ...value.certificateEnvelope, signatures: [] })).status, "blocked");
});

test("all five raw decoders share the bounded owned canonical JSON input boundary", () => {
  const decoders = [
    decodeInitialEnrollmentChallengePayloadCandidate,
    decodeInitialEnrollmentRequestPayloadCandidate,
    decodeInitialEnrollmentCertificatePayloadCandidate,
    decodeInitialEnrollmentRequestEnvelopeCandidate,
    decodeInitialEnrollmentCertificateEnvelopeCandidate
  ];
  for (const decode of decoders) {
    assert.equal(decode(new Uint8Array()).status, "blocked");
    assert.equal(decode(Buffer.alloc(131_072)).status, "blocked");
    assert.match(decode(Buffer.alloc(131_073)).reason, /bytes_exceeded$/u);
    assert.equal(decode(Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d])).status, "blocked");
    assert.equal(decode(Buffer.from([0xc3, 0x28])).status, "blocked");
    assert.equal(decode(Buffer.alloc(0)).status, "blocked");
  }
});

test("contract keeps effects and deferred enrollment capabilities closed", () => {
  assert.deepEqual(describeInitialEnrollmentPureCoreContract(), {
    contract: "crdd-coordinator/initial-enrollment-pure-core",
    contractRevision: 1,
    supportedFlow: "initial_online_enrollment_only",
    installationKeyAlgorithm: "ECDSA-P256-SHA256",
    installationKeySignatureEncoding: "low-S-IEEE-P1363-64-byte-unpadded-base64url",
    provisioningCaSignatureAlgorithm: "Ed25519",
    challengeObjectContractAndDomainFraming: "implemented_candidate",
    requestObjectContractAndDomainFraming: "implemented_candidate",
    certificateObjectContractAndDomainFraming: "implemented_candidate",
    challengeRawPayloadByteDecoder: "implemented_candidate",
    requestRawPayloadByteDecoder: "implemented_candidate",
    certificateRawPayloadByteDecoder: "implemented_candidate",
    requestSignatureEnvelopeObjectContract: "implemented_candidate",
    certificateSignatureEnvelopeObjectContract: "implemented_candidate",
    requestRawEnvelopeByteDecoder: "implemented_candidate",
    certificateRawEnvelopeByteDecoder: "implemented_candidate",
    transportCodec: "not_implemented",
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
