import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  canonicalizeProvisioningJsonValueCandidate,
  inspectProvisioningEd25519SpkiCandidate,
  verifyProvisioningEd25519Base64urlCandidate
} from "./provisioning-signature-primitives.mjs";
import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";

export const PROVISIONING_CA_CONTRACT_REVISION = 1;
export const PROVISIONING_CA_DOMAINS = Object.freeze({
  issuingCertificate: "CRDD\0PROVISIONING-CA-ISSUING-CERTIFICATE\0V1\0",
  revocationManifest: "CRDD\0PROVISIONING-CA-REVOCATION-MANIFEST\0V1\0"
});

const ROOT_SET_CONTRACT = "crdd-coordinator/provisioning-ca-root-trust-set";
const ISSUING_CERTIFICATE_CONTRACT = "crdd-coordinator/provisioning-ca-issuing-certificate";
const ISSUING_ENVELOPE_CONTRACT =
  "crdd-coordinator/provisioning-ca-issuing-certificate-envelope";
const REVOCATION_CONTRACT = "crdd-coordinator/provisioning-ca-revocation-manifest";
const REVOCATION_ENVELOPE_CONTRACT =
  "crdd-coordinator/provisioning-ca-revocation-manifest-envelope";

const ROOT_SET_KEYS = new Set(["contract", "contractRevision", "trustEpoch", "roots"]);
const ROOT_KEYS = new Set(["keyId", "algorithm", "spkiDer", "notBefore", "notAfter"]);
const ISSUING_KEYS = new Set([
  "contract", "contractRevision", "caSeriesId", "role", "keyId", "algorithm", "spkiDer",
  "rootKeyId", "trustEpoch", "notBefore", "notAfter"
]);
const REVOCATION_KEYS = new Set([
  "contract", "contractRevision", "trustEpoch", "revocationRevision", "issuedAt", "expiresAt",
  "revoked"
]);
const REVOKED_KEYS = new Set(["keyId", "revokedAt", "reasonCode"]);
const ENVELOPE_KEYS = new Set(["contract", "contractRevision", "payload", "signatures"]);
const SIGNATURE_KEYS = new Set(["keyId", "algorithm", "signature"]);
const VERIFY_KEYS = new Set([
  "rootTrustSet", "issuingCertificateEnvelope", "revocationEnvelope", "evaluationTime"
]);
const HEX32 = /^[0-9a-f]{32}$/u;
const HEX64 = /^[0-9a-f]{64}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ROLES = new Set(["online_enrollment_issuer", "offline_bundle_issuer"]);

function response(status, reason, details = {}) {
  return Object.freeze({
    status,
    reason,
    ...details,
    runtimeOwnedRootTrustConfirmed: false,
    rollbackFloorConfirmed: false,
    runtimeClockAuthorityConfirmed: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false
  });
}

function exactArray(raw, maximum, normalize) {
  if (!Array.isArray(raw) || utilTypes.isProxy(raw) ||
      Object.getPrototypeOf(raw) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(raw, "length");
  if (!length || length.enumerable || length.configurable ||
      !Number.isSafeInteger(length.value) || length.value < 0 || length.value > maximum) return null;
  const keys = Reflect.ownKeys(raw);
  if (keys.length !== length.value + 1 || keys.at(-1) !== "length") return null;
  const values = [];
  for (let index = 0; index < length.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor) ||
        descriptor.get || descriptor.set) return null;
    const value = normalize(descriptor.value);
    if (!value) return null;
    values.push(value);
  }
  return Object.freeze(values);
}

function utc(value) {
  return typeof value === "string" && UTC.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString() === value;
}

function positive(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function ed25519Spki(value) {
  if (typeof value !== "string" || value.length !== 59 || !BASE64URL.test(value)) return null;
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== 44 || bytes.toString("base64url") !== value) return null;
  const inspected = inspectProvisioningEd25519SpkiCandidate(bytes);
  if (inspected.status !== "candidate") return null;
  return Object.freeze({ bytes, keyId: inspected.spkiSha256Digest.toString("hex") });
}

function normalizeRoot(raw) {
  const value = snapshotPlainRecord(raw, ROOT_KEYS);
  const spki = value && ed25519Spki(value.spkiDer);
  if (!value || !spki || !HEX64.test(value.keyId) || value.keyId !== spki.keyId ||
      value.algorithm !== "Ed25519" || !utc(value.notBefore) || !utc(value.notAfter) ||
      Date.parse(value.notAfter) <= Date.parse(value.notBefore)) return null;
  return Object.freeze({ value, spkiDer: spki.bytes });
}

function normalizeRootSet(raw) {
  const value = snapshotPlainRecord(raw, ROOT_SET_KEYS);
  const roots = value && exactArray(value.roots, 8, normalizeRoot);
  if (!value || value.contract !== ROOT_SET_CONTRACT ||
      value.contractRevision !== PROVISIONING_CA_CONTRACT_REVISION || !positive(value.trustEpoch) ||
      !roots || roots.length === 0 || roots.some((root, index) =>
        index > 0 && roots[index - 1].value.keyId >= root.value.keyId)) return null;
  return Object.freeze({ value, roots });
}

function normalizeSignature(raw) {
  const value = snapshotPlainRecord(raw, SIGNATURE_KEYS);
  return value && HEX64.test(value.keyId) && value.algorithm === "Ed25519" &&
    typeof value.signature === "string" && value.signature.length === 86 &&
    BASE64URL.test(value.signature) && Buffer.from(value.signature, "base64url").length === 64 &&
    Buffer.from(value.signature, "base64url").toString("base64url") === value.signature
    ? value : null;
}

function normalizeIssuing(raw) {
  const value = snapshotPlainRecord(raw, ISSUING_KEYS);
  const spki = value && ed25519Spki(value.spkiDer);
  if (!value || value.contract !== ISSUING_CERTIFICATE_CONTRACT ||
      value.contractRevision !== PROVISIONING_CA_CONTRACT_REVISION ||
      !HEX32.test(value.caSeriesId) || !ROLES.has(value.role) || !spki ||
      !HEX64.test(value.keyId) || value.keyId !== spki.keyId || value.algorithm !== "Ed25519" ||
      !HEX64.test(value.rootKeyId) || !positive(value.trustEpoch) ||
      !utc(value.notBefore) || !utc(value.notAfter) ||
      Date.parse(value.notAfter) <= Date.parse(value.notBefore) ||
      Date.parse(value.notAfter) - Date.parse(value.notBefore) > 365 * 86_400_000) return null;
  return Object.freeze({ value, spkiDer: spki.bytes });
}

function normalizeRevoked(raw) {
  const value = snapshotPlainRecord(raw, REVOKED_KEYS);
  return value && HEX64.test(value.keyId) && utc(value.revokedAt) &&
    typeof value.reasonCode === "string" && /^[a-z][a-z0-9_]{0,63}$/u.test(value.reasonCode)
    ? value : null;
}

function normalizeRevocation(raw) {
  const value = snapshotPlainRecord(raw, REVOCATION_KEYS);
  const revoked = value && exactArray(value.revoked, 4096, normalizeRevoked);
  if (!value || value.contract !== REVOCATION_CONTRACT ||
      value.contractRevision !== PROVISIONING_CA_CONTRACT_REVISION ||
      !positive(value.trustEpoch) || !positive(value.revocationRevision) ||
      !utc(value.issuedAt) || !utc(value.expiresAt) ||
      Date.parse(value.expiresAt) <= Date.parse(value.issuedAt) ||
      Date.parse(value.expiresAt) - Date.parse(value.issuedAt) > 24 * 3_600_000 ||
      !revoked || revoked.some((entry, index) =>
        index > 0 && revoked[index - 1].keyId >= entry.keyId)) return null;
  return Object.freeze({ ...value, revoked });
}

function normalizeEnvelope(raw, contract, normalizePayload) {
  const value = snapshotPlainRecord(raw, ENVELOPE_KEYS);
  const payload = value && normalizePayload(value.payload);
  const signatures = value && exactArray(value.signatures, 1, normalizeSignature);
  if (!value || value.contract !== contract ||
      value.contractRevision !== PROVISIONING_CA_CONTRACT_REVISION ||
      !payload || !signatures || signatures.length !== 1) return null;
  return Object.freeze({ value, payload, signature: signatures[0] });
}

function frame(domain, payload) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(payload);
  if (canonical.status !== "candidate") return null;
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.canonicalBytes.length));
  const message = Buffer.concat([Buffer.from(domain, "ascii"), length, canonical.canonicalBytes]);
  return Object.freeze({ message, hash: createHash("sha256").update(message).digest("hex") });
}

function verifyRootSignature(root, signature, message) {
  return signature.keyId === root.value.keyId &&
    verifyProvisioningEd25519Base64urlCandidate({
      spkiDer: root.spkiDer,
      message,
      signatureBase64url: signature.signature
    }).status === "candidate";
}

export function verifyProvisioningCaStateCandidate(rawInput) {
  try {
    const input = snapshotPlainRecord(rawInput, VERIFY_KEYS);
    if (!input || !utc(input.evaluationTime)) {
      return response("blocked", "provisioning_ca_state_input_invalid");
    }
    const roots = normalizeRootSet(input.rootTrustSet);
    const issuing = normalizeEnvelope(input.issuingCertificateEnvelope,
      ISSUING_ENVELOPE_CONTRACT, normalizeIssuing);
    const revocations = normalizeEnvelope(input.revocationEnvelope,
      REVOCATION_ENVELOPE_CONTRACT, normalizeRevocation);
    if (!roots || !issuing || !revocations ||
        issuing.payload.value.trustEpoch !== roots.value.trustEpoch ||
        revocations.payload.trustEpoch !== roots.value.trustEpoch) {
      return response("blocked", "provisioning_ca_state_invalid");
    }
    const root = roots.roots.find((entry) => entry.value.keyId === issuing.payload.value.rootKeyId);
    const revocationRoot = roots.roots.find((entry) =>
      entry.value.keyId === revocations.signature.keyId);
    const issuingFrame = frame(PROVISIONING_CA_DOMAINS.issuingCertificate,
      issuing.payload.value);
    const revocationFrame = frame(PROVISIONING_CA_DOMAINS.revocationManifest,
      revocations.payload);
    if (!root || !revocationRoot || !issuingFrame || !revocationFrame ||
        !verifyRootSignature(root, issuing.signature, issuingFrame.message) ||
        !verifyRootSignature(revocationRoot, revocations.signature, revocationFrame.message)) {
      return response("blocked", "provisioning_ca_signature_or_root_mismatch");
    }
    const now = Date.parse(input.evaluationTime);
    const timeValues = [root.value, revocationRoot.value, issuing.payload.value, {
      notBefore: revocations.payload.issuedAt,
      notAfter: revocations.payload.expiresAt
    }];
    if (timeValues.some((entry) => now < Date.parse(entry.notBefore) ||
        now >= Date.parse(entry.notAfter))) {
      return response("blocked", "provisioning_ca_state_not_current");
    }
    const revoked = new Set(revocations.payload.revoked.map((entry) => entry.keyId));
    if (revoked.has(root.value.keyId) || revoked.has(revocationRoot.value.keyId) ||
        revoked.has(issuing.payload.value.keyId)) {
      return response("blocked", "provisioning_ca_key_revoked");
    }
    return response(
      "candidate",
      "runtime_owned_root_trust_rollback_floor_clock_and_distribution_verification_required",
      {
        issuingRole: issuing.payload.value.role,
        trustEpoch: roots.value.trustEpoch,
        revocationRevision: revocations.payload.revocationRevision,
        issuingCertificateCryptographicMatch: true,
        revocationManifestCryptographicMatch: true
      }
    );
  } catch {
    return response("blocked", "provisioning_ca_state_input_invalid");
  }
}

export function describeProvisioningCaPureCoreContract() {
  return Object.freeze({
    contract: "crdd-coordinator/provisioning-ca-pure-core",
    contractRevision: PROVISIONING_CA_CONTRACT_REVISION,
    rootTrustSetContract: ROOT_SET_CONTRACT,
    issuingCertificateContract: ISSUING_CERTIFICATE_CONTRACT,
    issuingCertificateEnvelopeContract: ISSUING_ENVELOPE_CONTRACT,
    revocationManifestContract: REVOCATION_CONTRACT,
    revocationManifestEnvelopeContract: REVOCATION_ENVELOPE_CONTRACT,
    signatureAlgorithm: "Ed25519",
    issuingRoles: Object.freeze([...ROLES]),
    issuingKeyMaximumValidityDays: 365,
    revocationMaximumFreshnessHours: 24,
    rootTrustSetCodec: "implemented_candidate_untrusted_input",
    issuingCertificateVerification: "implemented_candidate_cryptographic_condition_only",
    revocationManifestVerification: "implemented_candidate_cryptographic_condition_only",
    runtimeOwnedRootTrustSelection: "not_implemented",
    rollbackFloorPersistence: "not_implemented",
    runtimeClockAuthority: "not_implemented",
    trustDistribution: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false
  });
}
