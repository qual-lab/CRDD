import { createHash } from "node:crypto";
import { TextDecoder, types as utilTypes } from "node:util";

import {
  canonicalizeProvisioningJsonValueCandidate,
  inspectProvisioningEd25519SpkiCandidate,
  PROVISIONING_SIGNATURE_INPUT_LIMITS,
  verifyProvisioningEd25519Base64urlCandidate
} from "./provisioning-signature-primitives.mjs";

export const INITIAL_ENROLLMENT_CONTRACT_REVISION = 1;
export const INITIAL_ENROLLMENT_CHALLENGE_CONTRACT =
  "crdd-coordinator/initial-enrollment-challenge";
export const INITIAL_ENROLLMENT_REQUEST_CONTRACT =
  "crdd-coordinator/initial-enrollment-request";
export const INITIAL_ENROLLMENT_CERTIFICATE_CONTRACT =
  "crdd-coordinator/initial-enrollment-certificate";
export const INITIAL_ENROLLMENT_REQUEST_ENVELOPE_CONTRACT =
  "crdd-coordinator/initial-enrollment-request-envelope";
export const INITIAL_ENROLLMENT_CERTIFICATE_ENVELOPE_CONTRACT =
  "crdd-coordinator/initial-enrollment-certificate-envelope";
export const INITIAL_ENROLLMENT_DOMAINS = Object.freeze({
  challenge: "CRDD\0INITIAL-ENROLLMENT-CHALLENGE\0V1\0",
  request: "CRDD\0INITIAL-ENROLLMENT-REQUEST\0V1\0",
  certificate: "CRDD\0INITIAL-ENROLLMENT-CERTIFICATE\0V1\0"
});

const ID = /^[a-f0-9]{32}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const NONCE = /^[A-Za-z0-9_-]{43}$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype), "byteLength"
).get;
const CHALLENGE_KEYS = Object.freeze([
  "contract", "contractRevision", "challengeId", "nonce", "platformScopeId",
  "provisionerIdentityHash", "installationKeyId", "issuedAt", "expiresAt"
]);
const REQUEST_KEYS = Object.freeze([
  "contract", "contractRevision", "requestId", "challengeHash", "platformScopeId",
  "provisionerIdentityHash", "installationKeyId", "installationKeySpkiDer", "requestedAt"
]);
const CERTIFICATE_KEYS = Object.freeze([
  "contract", "contractRevision", "enrollmentId", "platformScopeId",
  "provisionerIdentityHash", "installationKeyId", "installationKeySpkiDer",
  "issuedAt", "expiresAt"
]);
const ENVELOPE_KEYS = Object.freeze(["contract", "contractRevision", "payload", "signatures"]);
const SIGNATURE_KEYS = Object.freeze(["keyId", "algorithm", "signature"]);
const REQUEST_VERIFY_KEYS = Object.freeze(["challenge", "requestEnvelope"]);
const CERTIFICATE_VERIFY_KEYS = Object.freeze(["certificateEnvelope", "issuerSpkiDer"]);
const FLOW_VERIFY_KEYS = Object.freeze([
  "challenge", "requestEnvelope", "certificateEnvelope", "issuerSpkiDer"
]);

function blocked(reason) {
  return Object.freeze({
    status: "blocked", reason, cryptographicConditionSatisfied: false,
    runtimeAuthorityConferred: false, runtimeCapabilityIssued: false,
    filesystemEffectIssued: false, networkEffectIssued: false
  });
}

function candidate(reason, fields = {}) {
  return Object.freeze({ status: "candidate", reason, ...fields,
    runtimeAuthorityConferred: false, runtimeCapabilityIssued: false,
    filesystemEffectIssued: false, networkEffectIssued: false });
}

function exactRecord(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) || utilTypes.isProxy(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))) return null;
  const result = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true) return null;
    result[key] = descriptor.value;
  }
  return Object.freeze(result);
}

function exactArray(value, length, normalize) {
  if (!value || typeof value !== "object" || utilTypes.isProxy(value) || !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype) return null;
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (!lengthDescriptor || !Object.prototype.hasOwnProperty.call(lengthDescriptor, "value") ||
      lengthDescriptor.get !== undefined || lengthDescriptor.set !== undefined ||
      lengthDescriptor.enumerable !== false || lengthDescriptor.configurable !== false ||
      lengthDescriptor.value !== length) return null;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== length + 1) return null;
  const result = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true) return null;
    const item = normalize(descriptor.value);
    if (!item) return null;
    result.push(item);
  }
  return Object.freeze(result);
}

function utc(value) {
  return typeof value === "string" && UTC.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString() === value;
}

function spki(value) {
  if (typeof value !== "string" || value.length !== 59 || !/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== 44 || bytes.toString("base64url") !== value) return null;
  const inspected = inspectProvisioningEd25519SpkiCandidate(bytes);
  return inspected.status === "candidate" ? bytes : null;
}

function frame(domain, payload) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(payload);
  if (canonical.status !== "candidate") return null;
  const prefix = Buffer.from(domain, "ascii");
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.canonicalBytes.length));
  return Object.freeze({
    canonicalBytes: Buffer.from(canonical.canonicalBytes),
    message: Buffer.concat([prefix, length, canonical.canonicalBytes]),
    hash: createHash("sha256").update(prefix).update(length).update(canonical.canonicalBytes).digest("hex")
  });
}

function decodeRawPayloadCandidate(raw, normalize, domain, kind, hashField) {
  try {
    if (!Buffer.isBuffer(raw)) return blocked(`${kind}_raw_payload_bytes_required`);
    const length = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, raw, []);
    if (length > PROVISIONING_SIGNATURE_INPUT_LIMITS.canonicalBytes) {
      return blocked(`${kind}_raw_payload_bytes_exceeded`);
    }
    const bytes = Buffer.allocUnsafe(length);
    Uint8Array.prototype.set.call(bytes, raw);
    if (length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return blocked(`${kind}_raw_payload_invalid`);
    }
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const normalized = normalize(JSON.parse(source));
    const framed = normalized && frame(domain, normalized.value ?? normalized);
    if (!framed || !Buffer.prototype.equals.call(bytes, framed.canonicalBytes)) {
      return blocked(`${kind}_raw_payload_noncanonical_or_invalid`);
    }
    return candidate(`${kind}_raw_payload_candidate`, { [hashField]: framed.hash });
  } catch {
    return blocked(`${kind}_raw_payload_invalid`);
  }
}

function normalizeChallenge(raw) {
  const value = exactRecord(raw, CHALLENGE_KEYS);
  if (!value || value.contract !== INITIAL_ENROLLMENT_CHALLENGE_CONTRACT ||
      value.contractRevision !== 1 || typeof value.challengeId !== "string" || !ID.test(value.challengeId) ||
      typeof value.nonce !== "string" || !NONCE.test(value.nonce) ||
      Buffer.from(value.nonce, "base64url").length !== 32 ||
      Buffer.from(value.nonce, "base64url").toString("base64url") !== value.nonce ||
      typeof value.platformScopeId !== "string" || !ID.test(value.platformScopeId) ||
      typeof value.provisionerIdentityHash !== "string" || !HASH.test(value.provisionerIdentityHash) ||
      typeof value.installationKeyId !== "string" || !HASH.test(value.installationKeyId) ||
      !utc(value.issuedAt) || !utc(value.expiresAt) ||
      Date.parse(value.expiresAt) - Date.parse(value.issuedAt) !== 30 * 60 * 1000) return null;
  return value;
}

function normalizeRequest(raw) {
  const value = exactRecord(raw, REQUEST_KEYS);
  const key = value && spki(value.installationKeySpkiDer);
  if (!value || !key || value.contract !== INITIAL_ENROLLMENT_REQUEST_CONTRACT ||
      value.contractRevision !== 1 || typeof value.requestId !== "string" || !ID.test(value.requestId) ||
      typeof value.challengeHash !== "string" || !HASH.test(value.challengeHash) ||
      typeof value.platformScopeId !== "string" || !ID.test(value.platformScopeId) ||
      typeof value.provisionerIdentityHash !== "string" || !HASH.test(value.provisionerIdentityHash) ||
      typeof value.installationKeyId !== "string" || !HASH.test(value.installationKeyId) ||
      createHash("sha256").update(key).digest("hex") !== value.installationKeyId || !utc(value.requestedAt)) return null;
  return Object.freeze({ value, key });
}

function normalizeCertificate(raw) {
  const value = exactRecord(raw, CERTIFICATE_KEYS);
  const key = value && spki(value.installationKeySpkiDer);
  if (!value || !key || value.contract !== INITIAL_ENROLLMENT_CERTIFICATE_CONTRACT ||
      value.contractRevision !== 1 || typeof value.enrollmentId !== "string" || !ID.test(value.enrollmentId) ||
      typeof value.platformScopeId !== "string" || !ID.test(value.platformScopeId) ||
      typeof value.provisionerIdentityHash !== "string" || !HASH.test(value.provisionerIdentityHash) ||
      typeof value.installationKeyId !== "string" || !HASH.test(value.installationKeyId) ||
      createHash("sha256").update(key).digest("hex") !== value.installationKeyId ||
      !utc(value.issuedAt) || !utc(value.expiresAt) || Date.parse(value.expiresAt) <= Date.parse(value.issuedAt) ||
      Date.parse(value.expiresAt) - Date.parse(value.issuedAt) > 180 * 86_400_000) return null;
  return Object.freeze({ value, key });
}

function normalizeSignature(raw) {
  const value = exactRecord(raw, SIGNATURE_KEYS);
  return value && typeof value.keyId === "string" && HASH.test(value.keyId) &&
    value.algorithm === "Ed25519" && typeof value.signature === "string"
    ? value : null;
}

function normalizeEnvelope(raw, contract, normalizePayload) {
  const value = exactRecord(raw, ENVELOPE_KEYS);
  const payload = value && normalizePayload(value.payload);
  const signatures = value && exactArray(value.signatures, 1, normalizeSignature);
  if (!value || value.contract !== contract ||
      value.contractRevision !== INITIAL_ENROLLMENT_CONTRACT_REVISION ||
      !payload || !signatures) return null;
  return Object.freeze({ value, payload, signature: signatures[0] });
}

function normalizeRequestEnvelope(raw) {
  return normalizeEnvelope(raw, INITIAL_ENROLLMENT_REQUEST_ENVELOPE_CONTRACT, normalizeRequest);
}

function normalizeCertificateEnvelope(raw) {
  return normalizeEnvelope(raw, INITIAL_ENROLLMENT_CERTIFICATE_ENVELOPE_CONTRACT,
    normalizeCertificate);
}

export function compileInitialEnrollmentChallengeCandidate(raw) {
  try {
    const value = normalizeChallenge(raw);
    const framed = value && frame(INITIAL_ENROLLMENT_DOMAINS.challenge, value);
    return framed ? candidate("runtime_clock_and_one_time_consumption_required",
      { challengeHash: framed.hash }) : blocked("initial_enrollment_challenge_invalid");
  } catch { return blocked("initial_enrollment_challenge_invalid"); }
}

export function decodeInitialEnrollmentChallengePayloadCandidate(raw) {
  return decodeRawPayloadCandidate(raw, normalizeChallenge,
    INITIAL_ENROLLMENT_DOMAINS.challenge, "initial_enrollment_challenge", "challengeHash");
}

export function decodeInitialEnrollmentRequestPayloadCandidate(raw) {
  return decodeRawPayloadCandidate(raw, normalizeRequest,
    INITIAL_ENROLLMENT_DOMAINS.request, "initial_enrollment_request", "requestHash");
}

export function decodeInitialEnrollmentCertificatePayloadCandidate(raw) {
  return decodeRawPayloadCandidate(raw, normalizeCertificate,
    INITIAL_ENROLLMENT_DOMAINS.certificate, "initial_enrollment_certificate", "certificateHash");
}

export function verifyInitialEnrollmentRequestCandidate(rawInput) {
  const input = exactRecord(rawInput, REQUEST_VERIFY_KEYS);
  if (!input) return blocked("initial_enrollment_request_invalid");
  const { challenge: rawChallenge, requestEnvelope: rawEnvelope } = input;
  const challenge = normalizeChallenge(rawChallenge);
  const envelope = normalizeRequestEnvelope(rawEnvelope);
  const request = envelope?.payload;
  if (!challenge || !envelope || !request ||
      envelope.signature.keyId !== request.value.installationKeyId) {
    return blocked("initial_enrollment_request_invalid");
  }
  const challengeFrame = frame(INITIAL_ENROLLMENT_DOMAINS.challenge, challenge);
  const requestFrame = frame(INITIAL_ENROLLMENT_DOMAINS.request, request.value);
  if (!challengeFrame || !requestFrame || request.value.challengeHash !== challengeFrame.hash ||
      request.value.platformScopeId !== challenge.platformScopeId ||
      request.value.provisionerIdentityHash !== challenge.provisionerIdentityHash ||
      request.value.installationKeyId !== challenge.installationKeyId ||
      Date.parse(request.value.requestedAt) < Date.parse(challenge.issuedAt) ||
      Date.parse(request.value.requestedAt) >= Date.parse(challenge.expiresAt)) return blocked("initial_enrollment_request_binding_mismatch");
  const verified = verifyProvisioningEd25519Base64urlCandidate({
    spkiDer: request.key, message: requestFrame.message,
    signatureBase64url: envelope.signature.signature
  });
  if (verified.status !== "candidate") return blocked("initial_enrollment_proof_of_possession_invalid");
  return candidate("runtime_clock_consumption_ledger_and_ca_issuance_required",
    { proofOfPossessionCryptographicMatch: true, requestHash: requestFrame.hash,
      consumptionRequired: true });
}

export function verifyInitialEnrollmentCertificateCandidate(rawInput) {
  const input = exactRecord(rawInput, CERTIFICATE_VERIFY_KEYS);
  if (!input) return blocked("initial_enrollment_certificate_invalid");
  const { certificateEnvelope: rawEnvelope, issuerSpkiDer } = input;
  const envelope = normalizeCertificateEnvelope(rawEnvelope);
  const certificate = envelope?.payload;
  const framed = certificate && frame(INITIAL_ENROLLMENT_DOMAINS.certificate, certificate.value);
  const issuer = Buffer.isBuffer(issuerSpkiDer) ? issuerSpkiDer : null;
  const inspectedIssuer = issuer && inspectProvisioningEd25519SpkiCandidate(issuer);
  if (!envelope || !certificate || !framed || !issuer || !inspectedIssuer ||
      inspectedIssuer.status !== "candidate" ||
      inspectedIssuer.spkiSha256Digest.toString("hex") !== envelope.signature.keyId) {
    return blocked("initial_enrollment_certificate_invalid");
  }
  const verified = verifyProvisioningEd25519Base64urlCandidate({
    spkiDer: issuer, message: framed.message,
    signatureBase64url: envelope.signature.signature
  });
  if (verified.status !== "candidate") return blocked("initial_enrollment_certificate_signature_invalid");
  return candidate("runtime_owned_ca_trust_clock_revocation_and_record_binding_required",
    { certificateSignatureCryptographicMatch: true, certificateHash: framed.hash });
}

export function verifyInitialEnrollmentFlowCandidate(rawInput) {
  try {
    const input = exactRecord(rawInput, FLOW_VERIFY_KEYS);
    if (!input) return blocked("initial_enrollment_flow_invalid");
    const requestResult = verifyInitialEnrollmentRequestCandidate({
      challenge: input.challenge, requestEnvelope: input.requestEnvelope
    });
    const certificateResult = verifyInitialEnrollmentCertificateCandidate({
      certificateEnvelope: input.certificateEnvelope, issuerSpkiDer: input.issuerSpkiDer
    });
    const request = normalizeRequestEnvelope(input.requestEnvelope)?.payload;
    const certificate = normalizeCertificateEnvelope(input.certificateEnvelope)?.payload;
    if (requestResult.status !== "candidate" || certificateResult.status !== "candidate" ||
        !request || !certificate ||
        certificate.value.platformScopeId !== request.value.platformScopeId ||
        certificate.value.provisionerIdentityHash !== request.value.provisionerIdentityHash ||
        certificate.value.installationKeyId !== request.value.installationKeyId ||
        certificate.value.installationKeySpkiDer !== request.value.installationKeySpkiDer ||
        Date.parse(certificate.value.issuedAt) < Date.parse(request.value.requestedAt)) {
      return blocked("initial_enrollment_flow_binding_mismatch");
    }
    return candidate("runtime_clock_consumption_ledger_ca_trust_revocation_and_record_binding_required", {
      proofOfPossessionCryptographicMatch: true,
      certificateSignatureCryptographicMatch: true,
      consumptionRequired: true
    });
  } catch { return blocked("initial_enrollment_flow_invalid"); }
}

export function describeInitialEnrollmentPureCoreContract() {
  return Object.freeze({
    contract: "crdd-coordinator/initial-enrollment-pure-core",
    contractRevision: 1,
    supportedFlow: "initial_online_enrollment_only",
    challengeObjectContractAndDomainFraming: "implemented_candidate",
    requestObjectContractAndDomainFraming: "implemented_candidate",
    certificateObjectContractAndDomainFraming: "implemented_candidate",
    challengeRawPayloadByteDecoder: "implemented_candidate",
    requestRawPayloadByteDecoder: "implemented_candidate",
    certificateRawPayloadByteDecoder: "implemented_candidate",
    requestSignatureEnvelopeObjectContract: "implemented_candidate",
    certificateSignatureEnvelopeObjectContract: "implemented_candidate",
    requestRawEnvelopeByteDecoder: "not_implemented",
    certificateRawEnvelopeByteDecoder: "not_implemented",
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
}
