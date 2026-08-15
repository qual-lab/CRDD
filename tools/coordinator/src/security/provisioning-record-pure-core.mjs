import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  PROVISIONING_SIGNATURE_INPUT_LIMITS,
  canonicalizeProvisioningJsonValueCandidate,
  inspectProvisioningP256SpkiCandidate,
  verifyProvisioningP256Base64urlCandidate
} from "./provisioning-signature-primitives.mjs";
import {
  AUTHORITY_ROOT_ABSOLUTE_PATH_MAX_BYTES,
  isSupportedAuthorityRootAbsolutePath
} from "./authority-root-path-lexical.mjs";

export const PROVISIONING_RECORD_CONTRACT = "crdd-coordinator/provisioning-record";
export const PROVISIONING_RECORD_ENVELOPE_CONTRACT =
  "crdd-coordinator/provisioning-record-envelope";
export const PROVISIONING_TRUST_ANCHOR_SET_CONTRACT =
  "crdd-coordinator/provisioning-trust-anchor-set";
export const PROVISIONING_REVOCATION_MANIFEST_CONTRACT =
  "crdd-coordinator/provisioning-revocation-manifest";
export const PROVISIONING_RECORD_PURE_CORE_CONTRACT_REVISION = 1;
export const PROVISIONING_RECORD_DOMAIN_PREFIX_ASCII =
  "CRDD\0PROVISIONING-RECORD\0V1\0";
export const PROVISIONING_RECORD_PURE_CORE_LIMITS = Object.freeze({
  artifactBytes: PROVISIONING_SIGNATURE_INPUT_LIMITS.canonicalBytes,
  absolutePathBytes: AUTHORITY_ROOT_ABSOLUTE_PATH_MAX_BYTES,
  signatures: 16,
  keys: 32,
  revocations: 4_096,
  recordLifetimeDays: 180
});

const HASH = /^[a-f0-9]{64}$/u;
const ID = /^[a-f0-9]{32}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const RUNTIME_PRINCIPAL_MODES = Object.freeze([
  "local_interactive_selected_user",
  "server_dedicated_service_account"
]);
const RECORD_KEYS = Object.freeze([
  "contract", "contractRevision", "recordId", "recordRevision", "previousRecordHash",
  "platformScopeId", "provisionerIdentityHash", "provisionerEnrollmentId",
  "authorityRootAbsolutePath", "authorityRootIdentityHash", "authorityRootProtectionHash",
  "runtimePrincipalModes", "trustEpoch", "issuedAt", "expiresAt"
]);
const ENVELOPE_KEYS = Object.freeze(["contract", "contractRevision", "payload", "signatures"]);
const SIGNATURE_KEYS = Object.freeze(["keyId", "algorithm", "signature"]);
const KEYSET_KEYS = Object.freeze(["contract", "contractRevision", "trustEpoch", "keys"]);
const KEY_KEYS = Object.freeze([
  "keyId", "algorithm", "spkiDer", "enrollmentCaId", "notBefore", "notAfter"
]);
const REVOCATION_KEYS = Object.freeze([
  "contract", "contractRevision", "trustEpoch", "revocationRevision", "revoked"
]);
const REVOKED_KEY_KEYS = Object.freeze(["keyId", "revokedAt", "reasonCode"]);
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype), "byteLength").get;

function dataDescriptor(descriptor) {
  return descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value") &&
    descriptor.get === undefined && descriptor.set === undefined && descriptor.enumerable === true;
}

function exactRecord(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) || utilTypes.isProxy(value)) {
    return null;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key !== "string" ||
    !keys.includes(key))) return null;
  const result = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!dataDescriptor(descriptor)) return null;
    result[key] = descriptor.value;
  }
  return result;
}

function exactArray(value, maximum, normalize) {
  if (!Array.isArray(value) || utilTypes.isProxy(value)) return null;
  if (Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length");
  if (!length || !Object.prototype.hasOwnProperty.call(length, "value") ||
      length.get !== undefined || length.set !== undefined || length.enumerable !== false ||
      length.configurable !== false || !Number.isSafeInteger(length.value) || length.value < 0 ||
      length.value > maximum) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== length.value + 1) return null;
  const result = [];
  for (let index = 0; index < length.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!dataDescriptor(descriptor)) return null;
    const item = normalize(descriptor.value);
    if (!item) return null;
    result.push(item);
  }
  return Object.freeze(result);
}

function positive(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

function exactString(value, pattern, length) {
  return typeof value === "string" && (length === undefined || value.length === length) &&
    pattern.test(value);
}

function exactHash(value) {
  return exactString(value, HASH, 64);
}

function exactId(value) {
  return exactString(value, ID, 32);
}

function canonicalUtc(value) {
  if (typeof value !== "string" || !UTC.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function canonicalPath(value) {
  return isSupportedAuthorityRootAbsolutePath(value);
}

function normalizedModes(value) {
  const modes = exactArray(value, RUNTIME_PRINCIPAL_MODES.length, (item) =>
    typeof item === "string" && RUNTIME_PRINCIPAL_MODES.includes(item) ? item : null);
  return modes && modes.length > 0 && new Set(modes).size === modes.length &&
    modes.every((mode, index) => index === 0 || modes[index - 1] < mode) ? modes : null;
}

function normalizeRecord(value) {
  const record = exactRecord(value, RECORD_KEYS);
  const modes = record && normalizedModes(record.runtimePrincipalModes);
  if (!record || record.contract !== PROVISIONING_RECORD_CONTRACT ||
      record.contractRevision !== PROVISIONING_RECORD_PURE_CORE_CONTRACT_REVISION ||
      !exactId(record.recordId) || !positive(record.recordRevision) ||
      (record.recordRevision === 1 ? record.previousRecordHash !== null :
        !exactHash(record.previousRecordHash)) || !exactId(record.platformScopeId) ||
      !exactHash(record.provisionerIdentityHash) || !exactId(record.provisionerEnrollmentId) ||
      !canonicalPath(record.authorityRootAbsolutePath) ||
      !exactHash(record.authorityRootIdentityHash) ||
      !exactHash(record.authorityRootProtectionHash) ||
      !modes || !positive(record.trustEpoch) || !canonicalUtc(record.issuedAt) ||
      !canonicalUtc(record.expiresAt)) return null;
  const issuedAt = Date.parse(record.issuedAt);
  const expiresAt = Date.parse(record.expiresAt);
  if (expiresAt <= issuedAt || expiresAt - issuedAt >
      PROVISIONING_RECORD_PURE_CORE_LIMITS.recordLifetimeDays * 86_400_000) return null;
  return Object.freeze({ ...record, runtimePrincipalModes: modes });
}

function normalizeSignature(value) {
  const entry = exactRecord(value, SIGNATURE_KEYS);
  return entry && exactHash(entry.keyId) && entry.algorithm === "ECDSA-P256-SHA256" &&
    typeof entry.signature === "string" && entry.signature.length === 86 &&
    BASE64URL.test(entry.signature) && Buffer.from(entry.signature, "base64url").length === 64 &&
    Buffer.from(entry.signature, "base64url").toString("base64url") === entry.signature
    ? Object.freeze(entry) : null;
}

function sortedUnique(items, key) {
  return items.every((item, index) => index === 0 || items[index - 1][key] < item[key]);
}

function normalizeEnvelope(value) {
  const envelope = exactRecord(value, ENVELOPE_KEYS);
  const payload = envelope && normalizeRecord(envelope.payload);
  const signatures = envelope && exactArray(envelope.signatures,
    PROVISIONING_RECORD_PURE_CORE_LIMITS.signatures, normalizeSignature);
  if (!envelope || envelope.contract !== PROVISIONING_RECORD_ENVELOPE_CONTRACT ||
      envelope.contractRevision !== PROVISIONING_RECORD_PURE_CORE_CONTRACT_REVISION ||
      !payload || !signatures || signatures.length === 0 || !sortedUnique(signatures, "keyId")) return null;
  return Object.freeze({ ...envelope, payload, signatures });
}

function decodeSpki(value) {
  if (typeof value !== "string" || value.length !== 122 || !BASE64URL.test(value)) return null;
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== 91 || bytes.toString("base64url") !== value) return null;
  const inspected = inspectProvisioningP256SpkiCandidate(bytes);
  if (inspected.status !== "candidate") return null;
  return Object.freeze({ bytes, keyId: inspected.spkiSha256Digest.toString("hex") });
}

function normalizeKey(value) {
  const key = exactRecord(value, KEY_KEYS);
  const spki = key && decodeSpki(key.spkiDer);
  if (!key || !exactHash(key.keyId) || key.algorithm !== "ECDSA-P256-SHA256" || !spki ||
      spki.keyId !== key.keyId || !exactId(key.enrollmentCaId) ||
      !canonicalUtc(key.notBefore) || !canonicalUtc(key.notAfter) ||
      Date.parse(key.notAfter) <= Date.parse(key.notBefore)) return null;
  return Object.freeze({ record: Object.freeze(key), spkiDer: spki.bytes });
}

function normalizeKeyset(value) {
  const keyset = exactRecord(value, KEYSET_KEYS);
  const keys = keyset && exactArray(keyset.keys, PROVISIONING_RECORD_PURE_CORE_LIMITS.keys,
    normalizeKey);
  if (!keyset || keyset.contract !== PROVISIONING_TRUST_ANCHOR_SET_CONTRACT ||
      keyset.contractRevision !== PROVISIONING_RECORD_PURE_CORE_CONTRACT_REVISION ||
      !positive(keyset.trustEpoch) || !keys || keys.length === 0 ||
      !sortedUnique(keys.map(({ record }) => record), "keyId")) return null;
  return Object.freeze({
    canonical: Object.freeze({ ...keyset, keys: Object.freeze(keys.map(({ record }) => record)) }),
    keys
  });
}

function normalizeRevoked(value) {
  const entry = exactRecord(value, REVOKED_KEY_KEYS);
  return entry && exactHash(entry.keyId) && canonicalUtc(entry.revokedAt) &&
    exactString(entry.reasonCode, /^[a-z][a-z0-9_]{0,63}$/u)
    ? Object.freeze(entry) : null;
}

function normalizeRevocations(value) {
  const manifest = exactRecord(value, REVOCATION_KEYS);
  const revoked = manifest && exactArray(manifest.revoked,
    PROVISIONING_RECORD_PURE_CORE_LIMITS.revocations, normalizeRevoked);
  if (!manifest || manifest.contract !== PROVISIONING_REVOCATION_MANIFEST_CONTRACT ||
      manifest.contractRevision !== PROVISIONING_RECORD_PURE_CORE_CONTRACT_REVISION ||
      !positive(manifest.trustEpoch) || !positive(manifest.revocationRevision) || !revoked ||
      !sortedUnique(revoked, "keyId")) return null;
  return Object.freeze({ ...manifest, revoked });
}

function canonicalize(normalized) {
  const result = canonicalizeProvisioningJsonValueCandidate(normalized);
  return result.status === "candidate" ? Object.freeze({
    value: normalized,
    canonicalBytes: Buffer.from(result.canonicalBytes),
    canonicalHash: result.canonicalHash
  }) : null;
}

function compile(normalize, raw) {
  try {
    const normalized = normalize(raw);
    return normalized ? canonicalize(normalized.canonical ?? normalized) : null;
  } catch {
    return null;
  }
}

function ownedBytes(value) {
  if (!Buffer.isBuffer(value)) return null;
  const length = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, value, []);
  if (length > PROVISIONING_RECORD_PURE_CORE_LIMITS.artifactBytes) return null;
  const copy = Buffer.allocUnsafe(length);
  Uint8Array.prototype.set.call(copy, value);
  return copy;
}

function decode(normalize, input) {
  try {
    const bytes = ownedBytes(input);
    if (!bytes || (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb &&
      bytes[2] === 0xbf)) return null;
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const compiled = compile(normalize, JSON.parse(source));
    return compiled && Buffer.prototype.equals.call(bytes, compiled.canonicalBytes) ? compiled : null;
  } catch {
    return null;
  }
}

function codecResult(compiled, kind) {
  return compiled ? Object.freeze({
    status: "candidate",
    reason: `${kind}_pure_codec_candidate`,
    canonicalBytes: Buffer.from(compiled.canonicalBytes),
    canonicalHash: compiled.canonicalHash,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  }) : Object.freeze({
    status: "blocked",
    reason: `${kind}_invalid`,
    canonicalBytes: null,
    canonicalHash: null,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  });
}

export function buildProvisioningRecordDomainMessageCandidate(rawPayload) {
  const compiled = compile(normalizeRecord, rawPayload);
  if (!compiled) return codecResult(null, "provisioning_record_domain");
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(compiled.canonicalBytes.length));
  return Object.freeze({
    status: "candidate",
    reason: "provisioning_record_domain_message_candidate",
    message: Buffer.concat([
      Buffer.from(PROVISIONING_RECORD_DOMAIN_PREFIX_ASCII, "ascii"), length,
      compiled.canonicalBytes
    ]),
    payloadHash: compiled.canonicalHash,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  });
}

export function compileProvisioningRecordEnvelopeCandidate(raw) {
  return codecResult(compile(normalizeEnvelope, raw), "provisioning_record_envelope");
}
export function decodeProvisioningRecordEnvelopeCandidate(raw) {
  return codecResult(decode(normalizeEnvelope, raw), "provisioning_record_envelope");
}
export function compileProvisioningTrustAnchorSetCandidate(raw) {
  return codecResult(compile(normalizeKeyset, raw), "provisioning_trust_anchor_set");
}
export function decodeProvisioningTrustAnchorSetCandidate(raw) {
  return codecResult(decode(normalizeKeyset, raw), "provisioning_trust_anchor_set");
}
export function compileProvisioningRevocationManifestCandidate(raw) {
  return codecResult(compile(normalizeRevocations, raw), "provisioning_revocation_manifest");
}
export function decodeProvisioningRevocationManifestCandidate(raw) {
  return codecResult(decode(normalizeRevocations, raw), "provisioning_revocation_manifest");
}

const AGGREGATE_KEYS = Object.freeze([
  "envelopeBytes", "trustAnchorSetBytes", "revocationManifestBytes", "evaluationTime"
]);

function aggregateBlocked(reason) {
  return Object.freeze({
    status: "blocked", reason, cryptographicConditionSatisfied: false,
    verifiedSignatureCount: 0, filesystemEffectIssued: false,
    runtimeAuthorityConferred: false, runtimeCapabilityIssued: false
  });
}

export function verifyProvisioningRecordAggregateCandidate(rawInput) {
  try {
    const input = exactRecord(rawInput, AGGREGATE_KEYS);
    if (!input || !canonicalUtc(input.evaluationTime)) return aggregateBlocked("provisioning_record_aggregate_input_invalid");
    const envelope = decode(normalizeEnvelope, input.envelopeBytes);
    const keyset = decode(normalizeKeyset, input.trustAnchorSetBytes);
    const revocations = decode(normalizeRevocations, input.revocationManifestBytes);
    if (!envelope || !keyset || !revocations) return aggregateBlocked("provisioning_record_aggregate_artifact_invalid");
    const normalizedEnvelope = normalizeEnvelope(envelope.value);
    const normalizedKeyset = normalizeKeyset(keyset.value);
    const normalizedRevocations = normalizeRevocations(revocations.value);
    if (!normalizedEnvelope || !normalizedKeyset || !normalizedRevocations ||
        normalizedEnvelope.payload.trustEpoch !== normalizedKeyset.canonical.trustEpoch ||
        normalizedEnvelope.payload.trustEpoch !== normalizedRevocations.trustEpoch) {
      return aggregateBlocked("provisioning_record_aggregate_trust_epoch_mismatch");
    }
    const message = buildProvisioningRecordDomainMessageCandidate(normalizedEnvelope.payload);
    if (message.status !== "candidate") return aggregateBlocked("provisioning_record_aggregate_payload_invalid");
    const now = Date.parse(input.evaluationTime);
    if (now < Date.parse(normalizedEnvelope.payload.issuedAt) ||
        now >= Date.parse(normalizedEnvelope.payload.expiresAt)) {
      return aggregateBlocked("provisioning_record_aggregate_record_time_invalid");
    }
    const keys = new Map(normalizedKeyset.keys.map((entry) => [entry.record.keyId, entry]));
    const revoked = new Map(normalizedRevocations.revoked.map((entry) => [entry.keyId, entry]));
    let verified = 0;
    for (const signature of normalizedEnvelope.signatures) {
      const key = keys.get(signature.keyId);
      if (!key) return aggregateBlocked("provisioning_record_aggregate_unknown_key");
      if (revoked.has(signature.keyId)) {
        return aggregateBlocked("provisioning_record_aggregate_revoked_key");
      }
      if (now < Date.parse(key.record.notBefore) || now >= Date.parse(key.record.notAfter)) {
        return aggregateBlocked("provisioning_record_aggregate_key_time_invalid");
      }
      const result = verifyProvisioningP256Base64urlCandidate({
        spkiDer: key.spkiDer, message: message.message, signatureBase64url: signature.signature
      });
      if (result.status !== "candidate") return aggregateBlocked("provisioning_record_aggregate_signature_invalid");
      verified += 1;
    }
    return Object.freeze({
      status: "candidate",
      reason: "runtime_owned_bundled_trust_rollback_filesystem_and_activation_verification_required",
      cryptographicConditionSatisfied: true,
      verifiedSignatureCount: verified,
      recordHash: envelope.canonicalHash,
      trustEpoch: normalizedEnvelope.payload.trustEpoch,
      revocationRevision: normalizedRevocations.revocationRevision,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false
    });
  } catch {
    return aggregateBlocked("provisioning_record_aggregate_input_invalid");
  }
}

export function describeProvisioningRecordPureCoreContract() {
  return Object.freeze({
    contractRevision: PROVISIONING_RECORD_PURE_CORE_CONTRACT_REVISION,
    recordContract: PROVISIONING_RECORD_CONTRACT,
    envelopeContract: PROVISIONING_RECORD_ENVELOPE_CONTRACT,
    trustAnchorSetContract: PROVISIONING_TRUST_ANCHOR_SET_CONTRACT,
    revocationManifestContract: PROVISIONING_REVOCATION_MANIFEST_CONTRACT,
    domainFraming: "implemented_candidate_fixed_prefix_uint64be_length_jcs_payload",
    keyIdEncoding: "implemented_candidate_spki_der_sha256_lowercase_hex_64",
    recordSignatureAlgorithm: "ECDSA-P256-SHA256",
    recordSignatureEncoding: "low-S-IEEE-P1363-64-byte-unpadded-base64url",
    recordPayloadCodec: "implemented_candidate",
    multiSignatureEnvelopeCodec: "implemented_candidate",
    trustAnchorSetCodec: "implemented_candidate_untrusted_input",
    revocationManifestCodec: "implemented_candidate_untrusted_input",
    aggregateCryptographicCondition: "implemented_candidate_fail_closed_all_entries",
    runtimeOwnedBundledTrustSelection: "not_implemented",
    rollbackResistantTrustFloor: "not_implemented",
    filesystemRead: "not_implemented",
    lifecyclePersistence: "not_implemented",
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  });
}
