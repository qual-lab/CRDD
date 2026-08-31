import { types as utilTypes } from "node:util";

import {
  PROVISIONING_SIGNATURE_INPUT_LIMITS,
  canonicalizeProvisioningJsonValueCandidate,
  inspectProvisioningP256SpkiCandidate,
  verifyProvisioningP256Base64urlCandidate,
} from "./provisioning-signature-primitives.ts";
import {
  AUTHORITY_ROOT_ABSOLUTE_PATH_MAX_BYTES,
  isSupportedAuthorityRootAbsolutePath,
} from "./authority-root-path-lexical.ts";

export const PROVISIONING_RECORD_CONTRACT =
  "crdd-coordinator/provisioning-record";
export const PROVISIONING_RECORD_ENVELOPE_CONTRACT =
  "crdd-coordinator/provisioning-record-envelope";
export const PROVISIONING_TRUST_ANCHOR_SET_CONTRACT =
  "crdd-coordinator/provisioning-trust-anchor-set";
export const PROVISIONING_REVOCATION_MANIFEST_CONTRACT =
  "crdd-coordinator/provisioning-revocation-manifest";
export const PROVISIONING_RECORD_PURE_CORE_CONTRACT_REVISION = 1;
export const PROVISIONING_RECORD_DOMAIN_PREFIX_ASCII =
  "CRDD\0PROVISIONING-RECORD\0V1\0";
const PROVISIONING_CANONICAL_BYTES =
  PROVISIONING_SIGNATURE_INPUT_LIMITS.canonicalBytes;
export const PROVISIONING_RECORD_PURE_CORE_LIMITS = Object.freeze({
  artifactBytes: PROVISIONING_CANONICAL_BYTES,
  absolutePathBytes: AUTHORITY_ROOT_ABSOLUTE_PATH_MAX_BYTES,
  signatures: 16,
  keys: 32,
  revocations: 4_096,
  recordLifetimeDays: 180,
});

const HASH = /^[a-f0-9]{64}$/u;
const ID = /^[a-f0-9]{32}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const P256_ALGORITHM: "ECDSA-P256-SHA256" = "ECDSA-P256-SHA256";
const RUNTIME_PRINCIPAL_MODES = Object.freeze([
  "local_interactive_selected_user",
  "server_dedicated_service_account",
]);
const RECORD_KEYS = Object.freeze([
  "contract",
  "contractRevision",
  "recordId",
  "recordRevision",
  "previousRecordHash",
  "platformScopeId",
  "provisionerIdentityHash",
  "provisionerEnrollmentId",
  "authorityRootAbsolutePath",
  "authorityRootIdentityHash",
  "authorityRootProtectionHash",
  "runtimePrincipalModes",
  "trustEpoch",
  "issuedAt",
  "expiresAt",
]);
const ENVELOPE_KEYS = Object.freeze([
  "contract",
  "contractRevision",
  "payload",
  "signatures",
]);
const SIGNATURE_KEYS = Object.freeze(["keyId", "algorithm", "signature"]);
const KEYSET_KEYS = Object.freeze([
  "contract",
  "contractRevision",
  "trustEpoch",
  "keys",
]);
const KEY_KEYS = Object.freeze([
  "keyId",
  "algorithm",
  "spkiDer",
  "enrollmentCaId",
  "notBefore",
  "notAfter",
]);
const REVOCATION_KEYS = Object.freeze([
  "contract",
  "contractRevision",
  "trustEpoch",
  "revocationRevision",
  "revoked",
]);
const REVOKED_KEY_KEYS = Object.freeze(["keyId", "revokedAt", "reasonCode"]);
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get;

type ProvisioningRecord = Readonly<{
  contract: string;
  contractRevision: number;
  recordId: string;
  recordRevision: number;
  previousRecordHash: string | null;
  platformScopeId: string;
  provisionerIdentityHash: string;
  provisionerEnrollmentId: string;
  authorityRootAbsolutePath: string;
  authorityRootIdentityHash: string;
  authorityRootProtectionHash: string;
  runtimePrincipalModes: readonly string[];
  trustEpoch: number;
  issuedAt: string;
  expiresAt: string;
}>;
type ProvisioningSignature = Readonly<{
  keyId: string;
  algorithm: "ECDSA-P256-SHA256";
  signature: string;
}>;
type ProvisioningEnvelope = Readonly<{
  contract: string;
  contractRevision: number;
  payload: ProvisioningRecord;
  signatures: readonly ProvisioningSignature[];
}>;
type ProvisioningKeyRecord = Readonly<{
  keyId: string;
  algorithm: "ECDSA-P256-SHA256";
  spkiDer: string;
  enrollmentCaId: string;
  notBefore: string;
  notAfter: string;
}>;
type ProvisioningKey = Readonly<{
  record: ProvisioningKeyRecord;
  spkiDer: Buffer;
}>;
type ProvisioningKeyset = Readonly<{
  canonical: Readonly<{
    contract: string;
    contractRevision: number;
    trustEpoch: number;
    keys: readonly ProvisioningKeyRecord[];
  }>;
  keys: readonly ProvisioningKey[];
}>;
type RevokedKey = Readonly<{
  keyId: string;
  revokedAt: string;
  reasonCode: string;
}>;
type ProvisioningRevocations = Readonly<{
  contract: string;
  contractRevision: number;
  trustEpoch: number;
  revocationRevision: number;
  revoked: readonly RevokedKey[];
}>;

function dataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return Boolean(
    descriptor &&
      Object.hasOwn(descriptor, "value") &&
      descriptor.get === undefined &&
      descriptor.set === undefined &&
      descriptor.enumerable === true,
  );
}

function exactRecord(value: unknown, keys: readonly string[]) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    return null;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== keys.length ||
    ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
  )
    return null;
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!dataDescriptor(descriptor)) return null;
    result[key] = descriptor.value;
  }
  return result;
}

function exactArray<T>(
  value: unknown,
  maximum: number,
  normalize: (value: unknown) => T | null,
) {
  if (!Array.isArray(value) || utilTypes.isProxy(value)) return null;
  if (Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length");
  if (
    !length ||
    !Object.hasOwn(length, "value") ||
    length.get !== undefined ||
    length.set !== undefined ||
    length.enumerable !== false ||
    length.configurable !== false ||
    !Number.isSafeInteger(length.value) ||
    length.value < 0 ||
    length.value > maximum
  )
    return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== length.value + 1) return null;
  const normalizedItems: T[] = [];
  for (let index = 0; index < length.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!dataDescriptor(descriptor)) return null;
    const item = normalize(descriptor.value);
    if (!item) return null;
    normalizedItems.push(item);
  }
  return Object.freeze(normalizedItems);
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function exactString(
  value: unknown,
  pattern: RegExp,
  length: number | undefined = undefined,
): value is string {
  return (
    typeof value === "string" &&
    (length === undefined || value.length === length) &&
    pattern.test(value)
  );
}

function exactHash(value: unknown): value is string {
  return exactString(value, HASH, 64);
}

function nullableHash(value: unknown): value is string | null {
  return value === null || exactHash(value);
}

function exactId(value: unknown): value is string {
  return exactString(value, ID, 32);
}

function canonicalUtc(value: unknown): value is string {
  if (typeof value !== "string" || !UTC.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function canonicalPath(value: unknown): value is string {
  return isSupportedAuthorityRootAbsolutePath(value);
}

function normalizedModes(value: unknown) {
  const modes = exactArray(value, RUNTIME_PRINCIPAL_MODES.length, (item) =>
    typeof item === "string" && RUNTIME_PRINCIPAL_MODES.includes(item)
      ? item
      : null,
  );
  return modes &&
    modes.length > 0 &&
    new Set(modes).size === modes.length &&
    modes.every((mode, index) => {
      if (index === 0) return true;
      const previous = modes[index - 1];
      return previous !== undefined && previous < mode;
    })
    ? modes
    : null;
}

function normalizeRecord(value: unknown): ProvisioningRecord | null {
  const record = exactRecord(value, RECORD_KEYS);
  const modes = record && normalizedModes(record.runtimePrincipalModes);
  const previousRecordHash = record?.previousRecordHash;
  if (
    !record ||
    record.contract !== PROVISIONING_RECORD_CONTRACT ||
    record.contractRevision !==
      PROVISIONING_RECORD_PURE_CORE_CONTRACT_REVISION ||
    !exactId(record.recordId) ||
    !positive(record.recordRevision) ||
    !nullableHash(previousRecordHash) ||
    (record.recordRevision === 1
      ? previousRecordHash !== null
      : previousRecordHash === null) ||
    !exactId(record.platformScopeId) ||
    !exactHash(record.provisionerIdentityHash) ||
    !exactId(record.provisionerEnrollmentId) ||
    !canonicalPath(record.authorityRootAbsolutePath) ||
    !exactHash(record.authorityRootIdentityHash) ||
    !exactHash(record.authorityRootProtectionHash) ||
    !modes ||
    !positive(record.trustEpoch) ||
    !canonicalUtc(record.issuedAt) ||
    !canonicalUtc(record.expiresAt)
  )
    return null;
  const issuedAt = Date.parse(record.issuedAt);
  const expiresAt = Date.parse(record.expiresAt);
  if (
    expiresAt <= issuedAt ||
    expiresAt - issuedAt >
      PROVISIONING_RECORD_PURE_CORE_LIMITS.recordLifetimeDays * 86_400_000
  )
    return null;
  return Object.freeze({
    contract: record.contract,
    contractRevision: record.contractRevision,
    recordId: record.recordId,
    recordRevision: record.recordRevision,
    previousRecordHash,
    platformScopeId: record.platformScopeId,
    provisionerIdentityHash: record.provisionerIdentityHash,
    provisionerEnrollmentId: record.provisionerEnrollmentId,
    authorityRootAbsolutePath: record.authorityRootAbsolutePath,
    authorityRootIdentityHash: record.authorityRootIdentityHash,
    authorityRootProtectionHash: record.authorityRootProtectionHash,
    runtimePrincipalModes: modes,
    trustEpoch: record.trustEpoch,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
  });
}

function normalizeSignature(value: unknown): ProvisioningSignature | null {
  const entry = exactRecord(value, SIGNATURE_KEYS);
  return entry &&
    exactHash(entry.keyId) &&
    entry.algorithm === P256_ALGORITHM &&
    typeof entry.signature === "string" &&
    entry.signature.length === 86 &&
    BASE64URL.test(entry.signature) &&
    Buffer.from(entry.signature, "base64url").length === 64 &&
    Buffer.from(entry.signature, "base64url").toString("base64url") ===
      entry.signature
    ? Object.freeze({
        keyId: entry.keyId,
        algorithm: P256_ALGORITHM,
        signature: entry.signature,
      })
    : null;
}

function sortedUnique<T>(items: readonly T[], select: (item: T) => string) {
  return items.every((item, index) => {
    const current = select(item);
    if (index === 0) return true;
    const previous = items[index - 1];
    return previous !== undefined && select(previous) < current;
  });
}

function normalizeEnvelope(value: unknown): ProvisioningEnvelope | null {
  const envelope = exactRecord(value, ENVELOPE_KEYS);
  const payload = envelope && normalizeRecord(envelope.payload);
  const signatures =
    envelope &&
    exactArray(
      envelope.signatures,
      PROVISIONING_RECORD_PURE_CORE_LIMITS.signatures,
      normalizeSignature,
    );
  if (
    !envelope ||
    envelope.contract !== PROVISIONING_RECORD_ENVELOPE_CONTRACT ||
    envelope.contractRevision !==
      PROVISIONING_RECORD_PURE_CORE_CONTRACT_REVISION ||
    !payload ||
    !signatures ||
    signatures.length === 0 ||
    !sortedUnique(signatures, (signature) => signature.keyId)
  )
    return null;
  return Object.freeze({
    contract: PROVISIONING_RECORD_ENVELOPE_CONTRACT,
    contractRevision: PROVISIONING_RECORD_PURE_CORE_CONTRACT_REVISION,
    payload,
    signatures,
  });
}

function decodeSpki(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length !== 122 ||
    !BASE64URL.test(value)
  )
    return null;
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== 91 || bytes.toString("base64url") !== value) return null;
  const inspected = inspectProvisioningP256SpkiCandidate(bytes);
  if (inspected.status !== "candidate") return null;
  return Object.freeze({
    bytes,
    keyId: inspected.spkiSha256Digest.toString("hex"),
  });
}

function normalizeKey(value: unknown): ProvisioningKey | null {
  const key = exactRecord(value, KEY_KEYS);
  if (!key || typeof key.spkiDer !== "string") return null;
  const spki = decodeSpki(key.spkiDer);
  if (
    !exactHash(key.keyId) ||
    key.algorithm !== P256_ALGORITHM ||
    !spki ||
    spki.keyId !== key.keyId ||
    !exactId(key.enrollmentCaId) ||
    !canonicalUtc(key.notBefore) ||
    !canonicalUtc(key.notAfter) ||
    Date.parse(key.notAfter) <= Date.parse(key.notBefore)
  )
    return null;
  return Object.freeze({
    record: Object.freeze({
      keyId: key.keyId,
      algorithm: P256_ALGORITHM,
      spkiDer: key.spkiDer,
      enrollmentCaId: key.enrollmentCaId,
      notBefore: key.notBefore,
      notAfter: key.notAfter,
    }),
    spkiDer: spki.bytes,
  });
}

function normalizeKeyset(value: unknown): ProvisioningKeyset | null {
  const keyset = exactRecord(value, KEYSET_KEYS);
  const keys =
    keyset &&
    exactArray(
      keyset.keys,
      PROVISIONING_RECORD_PURE_CORE_LIMITS.keys,
      normalizeKey,
    );
  if (
    !keyset ||
    keyset.contract !== PROVISIONING_TRUST_ANCHOR_SET_CONTRACT ||
    keyset.contractRevision !==
      PROVISIONING_RECORD_PURE_CORE_CONTRACT_REVISION ||
    !positive(keyset.trustEpoch) ||
    !keys ||
    keys.length === 0 ||
    !sortedUnique(keys, (key) => key.record.keyId)
  )
    return null;
  return Object.freeze({
    canonical: Object.freeze({
      contract: PROVISIONING_TRUST_ANCHOR_SET_CONTRACT,
      contractRevision: PROVISIONING_RECORD_PURE_CORE_CONTRACT_REVISION,
      trustEpoch: keyset.trustEpoch,
      keys: Object.freeze(keys.map(({ record }) => record)),
    }),
    keys,
  });
}

function normalizeRevoked(value: unknown): RevokedKey | null {
  const entry = exactRecord(value, REVOKED_KEY_KEYS);
  return entry &&
    exactHash(entry.keyId) &&
    canonicalUtc(entry.revokedAt) &&
    exactString(entry.reasonCode, /^[a-z][a-z0-9_]{0,63}$/u)
    ? Object.freeze({
        keyId: entry.keyId,
        revokedAt: entry.revokedAt,
        reasonCode: entry.reasonCode,
      })
    : null;
}

function normalizeRevocations(value: unknown): ProvisioningRevocations | null {
  const manifest = exactRecord(value, REVOCATION_KEYS);
  const revokedEntries =
    manifest &&
    exactArray(
      manifest.revoked,
      PROVISIONING_RECORD_PURE_CORE_LIMITS.revocations,
      normalizeRevoked,
    );
  if (
    !manifest ||
    manifest.contract !== PROVISIONING_REVOCATION_MANIFEST_CONTRACT ||
    manifest.contractRevision !==
      PROVISIONING_RECORD_PURE_CORE_CONTRACT_REVISION ||
    !positive(manifest.trustEpoch) ||
    !positive(manifest.revocationRevision) ||
    !revokedEntries ||
    !sortedUnique(revokedEntries, (entry) => entry.keyId)
  )
    return null;
  return Object.freeze({
    contract: PROVISIONING_REVOCATION_MANIFEST_CONTRACT,
    contractRevision: PROVISIONING_RECORD_PURE_CORE_CONTRACT_REVISION,
    trustEpoch: manifest.trustEpoch,
    revocationRevision: manifest.revocationRevision,
    revoked: revokedEntries,
  });
}

type NormalizedCandidate = Readonly<Record<string, unknown>> & {
  readonly canonical?: unknown;
};
type CompiledCandidate = Readonly<{
  value: unknown;
  canonicalBytes: Buffer;
  canonicalHash: string;
}>;

function canonicalize(normalized: unknown): CompiledCandidate | null {
  const result = canonicalizeProvisioningJsonValueCandidate(normalized);
  return result.status === "candidate"
    ? Object.freeze({
        value: normalized,
        canonicalBytes: Buffer.from(result.canonicalBytes),
        canonicalHash: result.canonicalHash,
      })
    : null;
}

function compile(
  normalize: (raw: unknown) => NormalizedCandidate | null,
  raw: unknown,
): CompiledCandidate | null {
  try {
    const normalized = normalize(raw);
    return normalized ? canonicalize(normalized.canonical ?? normalized) : null;
  } catch {
    return null;
  }
}

function ownedBytes(value: unknown) {
  if (!Buffer.isBuffer(value)) return null;
  if (typeof TYPED_ARRAY_BYTE_LENGTH !== "function") return null;
  const rawLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, value, []);
  if (
    typeof rawLength !== "number" ||
    !Number.isSafeInteger(rawLength) ||
    rawLength < 0
  ) {
    return null;
  }
  const length = rawLength;
  if (length > PROVISIONING_RECORD_PURE_CORE_LIMITS.artifactBytes) return null;
  const copy = Buffer.allocUnsafe(length);
  Uint8Array.prototype.set.call(copy, value);
  return copy;
}

function decode(
  normalize: (raw: unknown) => NormalizedCandidate | null,
  input: unknown,
): CompiledCandidate | null {
  try {
    const bytes = ownedBytes(input);
    if (
      !bytes ||
      (bytes.length >= 3 &&
        bytes[0] === 0xef &&
        bytes[1] === 0xbb &&
        bytes[2] === 0xbf)
    )
      return null;
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const compiled = compile(normalize, JSON.parse(source));
    return compiled &&
      Buffer.prototype.equals.call(bytes, compiled.canonicalBytes)
      ? compiled
      : null;
  } catch {
    return null;
  }
}

function codecResult(compiled: CompiledCandidate | null, kind: string) {
  return compiled
    ? Object.freeze({
        status: "candidate",
        reason: `${kind}_pure_codec_candidate`,
        canonicalBytes: Buffer.from(compiled.canonicalBytes),
        canonicalHash: compiled.canonicalHash,
        filesystemEffectIssued: false,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
      })
    : Object.freeze({
        status: "blocked",
        reason: `${kind}_invalid`,
        canonicalBytes: null,
        canonicalHash: null,
        filesystemEffectIssued: false,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
      });
}

export function buildProvisioningRecordDomainMessageCandidate(
  rawPayload: unknown,
) {
  const compiled = compile(normalizeRecord, rawPayload);
  if (!compiled) return codecResult(null, "provisioning_record_domain");
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(compiled.canonicalBytes.length));
  return Object.freeze({
    status: "candidate",
    reason: "provisioning_record_domain_message_candidate",
    message: Buffer.concat([
      Buffer.from(PROVISIONING_RECORD_DOMAIN_PREFIX_ASCII, "ascii"),
      length,
      compiled.canonicalBytes,
    ]),
    payloadHash: compiled.canonicalHash,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

export function compileProvisioningRecordEnvelopeCandidate(raw: unknown) {
  return codecResult(
    compile(normalizeEnvelope, raw),
    "provisioning_record_envelope",
  );
}
export function decodeProvisioningRecordEnvelopeCandidate(raw: unknown) {
  return codecResult(
    decode(normalizeEnvelope, raw),
    "provisioning_record_envelope",
  );
}

export function verifyProvisioningRecordLineageCandidate(rawInput: unknown) {
  try {
    const input = exactRecord(rawInput, [
      "previousEnvelopeBytes",
      "nextEnvelopeBytes",
    ]);
    if (!input) {
      return Object.freeze({
        status: "blocked" as const,
        reason: "provisioning_record_lineage_input_invalid",
        nextRecordHash: null,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
      });
    }
    const previous = decode(normalizeEnvelope, input.previousEnvelopeBytes);
    const next = decode(normalizeEnvelope, input.nextEnvelopeBytes);
    const previousEnvelope = previous
      ? normalizeEnvelope(previous.value)
      : null;
    const nextEnvelope = next ? normalizeEnvelope(next.value) : null;
    if (!previous || !next || !previousEnvelope || !nextEnvelope) {
      return Object.freeze({
        status: "blocked" as const,
        reason: "provisioning_record_lineage_artifact_invalid",
        nextRecordHash: null,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
      });
    }
    const previousPayload = previousEnvelope.payload;
    const nextPayload = nextEnvelope.payload;
    if (
      nextPayload.recordRevision !== previousPayload.recordRevision + 1 ||
      nextPayload.previousRecordHash !== previous.canonicalHash ||
      nextPayload.recordId !== previousPayload.recordId ||
      nextPayload.platformScopeId !== previousPayload.platformScopeId ||
      nextPayload.provisionerIdentityHash !==
        previousPayload.provisionerIdentityHash ||
      nextPayload.provisionerEnrollmentId !==
        previousPayload.provisionerEnrollmentId
    ) {
      return Object.freeze({
        status: "blocked" as const,
        reason: "provisioning_record_lineage_mismatch",
        nextRecordHash: null,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
      });
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "provisioning_record_lineage_candidate",
      nextRecordHash: next.canonicalHash,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "provisioning_record_lineage_input_invalid",
      nextRecordHash: null,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  }
}
export function verifyProvisioningRecordAuthorityRootBindingCandidate(
  rawInput: unknown,
) {
  const buildInvalidResult = (
    reason: string,
    recordHash: string | null = null,
  ) =>
    Object.freeze({
      status: "blocked" as const,
      reason,
      recordHash,
      authorityRootBindingMatch: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  try {
    const input = exactRecord(rawInput, [
      "envelopeBytes",
      "selectedAuthorityRootAbsolutePath",
      "observedAuthorityRootIdentityHash",
      "observedAuthorityRootProtectionHash",
    ]);
    if (
      !input ||
      typeof input.selectedAuthorityRootAbsolutePath !== "string" ||
      typeof input.observedAuthorityRootIdentityHash !== "string" ||
      typeof input.observedAuthorityRootProtectionHash !== "string"
    ) {
      return buildInvalidResult(
        "provisioning_record_authority_root_binding_input_invalid",
      );
    }
    const decoded = decode(normalizeEnvelope, input.envelopeBytes);
    const envelope = decoded ? normalizeEnvelope(decoded.value) : null;
    if (!decoded || !envelope) {
      return buildInvalidResult(
        "provisioning_record_authority_root_binding_record_invalid",
      );
    }
    const payload = envelope.payload;
    if (
      payload.authorityRootAbsolutePath !==
        input.selectedAuthorityRootAbsolutePath ||
      payload.authorityRootIdentityHash !==
        input.observedAuthorityRootIdentityHash ||
      payload.authorityRootProtectionHash !==
        input.observedAuthorityRootProtectionHash
    ) {
      return buildInvalidResult(
        "provisioning_record_authority_root_binding_mismatch",
        decoded.canonicalHash,
      );
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "provisioning_record_authority_root_binding_candidate",
      recordHash: decoded.canonicalHash,
      authorityRootBindingMatch: true,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  } catch {
    return buildInvalidResult(
      "provisioning_record_authority_root_binding_input_invalid",
    );
  }
}

export function compileProvisioningTrustAnchorSetCandidate(raw: unknown) {
  return codecResult(
    compile(normalizeKeyset, raw),
    "provisioning_trust_anchor_set",
  );
}
export function decodeProvisioningTrustAnchorSetCandidate(raw: unknown) {
  return codecResult(
    decode(normalizeKeyset, raw),
    "provisioning_trust_anchor_set",
  );
}
export function compileProvisioningRevocationManifestCandidate(raw: unknown) {
  return codecResult(
    compile(normalizeRevocations, raw),
    "provisioning_revocation_manifest",
  );
}
export function decodeProvisioningRevocationManifestCandidate(raw: unknown) {
  return codecResult(
    decode(normalizeRevocations, raw),
    "provisioning_revocation_manifest",
  );
}

const AGGREGATE_KEYS = Object.freeze([
  "envelopeBytes",
  "trustAnchorSetBytes",
  "revocationManifestBytes",
  "evaluationTime",
]);

function aggregateBlocked(reason: string) {
  return Object.freeze({
    status: "blocked",
    reason,
    cryptographicConditionSatisfied: false,
    verifiedSignatureCount: 0,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

export function verifyProvisioningRecordAggregateCandidate(rawInput: unknown) {
  try {
    const input = exactRecord(rawInput, AGGREGATE_KEYS);
    if (!input || !canonicalUtc(input.evaluationTime))
      return aggregateBlocked("provisioning_record_aggregate_input_invalid");
    const envelope = decode(normalizeEnvelope, input.envelopeBytes);
    const keyset = decode(normalizeKeyset, input.trustAnchorSetBytes);
    const revocations = decode(
      normalizeRevocations,
      input.revocationManifestBytes,
    );
    if (!envelope || !keyset || !revocations)
      return aggregateBlocked("provisioning_record_aggregate_artifact_invalid");
    const normalizedEnvelope = normalizeEnvelope(envelope.value);
    const normalizedKeyset = normalizeKeyset(keyset.value);
    const normalizedRevocations = normalizeRevocations(revocations.value);
    if (
      !normalizedEnvelope ||
      !normalizedKeyset ||
      !normalizedRevocations ||
      normalizedEnvelope.payload.trustEpoch !==
        normalizedKeyset.canonical.trustEpoch ||
      normalizedEnvelope.payload.trustEpoch !== normalizedRevocations.trustEpoch
    ) {
      return aggregateBlocked(
        "provisioning_record_aggregate_trust_epoch_mismatch",
      );
    }
    const message = buildProvisioningRecordDomainMessageCandidate(
      normalizedEnvelope.payload,
    );
    if (message.status !== "candidate" || !("message" in message)) {
      return aggregateBlocked("provisioning_record_aggregate_payload_invalid");
    }
    const now = Date.parse(input.evaluationTime);
    if (
      now < Date.parse(normalizedEnvelope.payload.issuedAt) ||
      now >= Date.parse(normalizedEnvelope.payload.expiresAt)
    ) {
      return aggregateBlocked(
        "provisioning_record_aggregate_record_time_invalid",
      );
    }
    const keys = new Map(
      normalizedKeyset.keys.map((entry) => [entry.record.keyId, entry]),
    );
    const revokedEntries = new Map(
      normalizedRevocations.revoked.map((entry) => [entry.keyId, entry]),
    );
    let verified = 0;
    for (const signature of normalizedEnvelope.signatures) {
      const key = keys.get(signature.keyId);
      if (!key)
        return aggregateBlocked("provisioning_record_aggregate_unknown_key");
      if (revokedEntries.has(signature.keyId)) {
        return aggregateBlocked("provisioning_record_aggregate_revoked_key");
      }
      if (
        now < Date.parse(key.record.notBefore) ||
        now >= Date.parse(key.record.notAfter)
      ) {
        return aggregateBlocked(
          "provisioning_record_aggregate_key_time_invalid",
        );
      }
      const result = verifyProvisioningP256Base64urlCandidate({
        spkiDer: key.spkiDer,
        message: message.message,
        signatureBase64url: signature.signature,
      });
      if (result.status !== "candidate")
        return aggregateBlocked(
          "provisioning_record_aggregate_signature_invalid",
        );
      verified += 1;
    }
    return Object.freeze({
      status: "candidate",
      reason:
        "runtime_owned_bundled_trust_rollback_filesystem_and_activation_verification_required",
      cryptographicConditionSatisfied: true,
      verifiedSignatureCount: verified,
      recordHash: envelope.canonicalHash,
      trustEpoch: normalizedEnvelope.payload.trustEpoch,
      revocationRevision: normalizedRevocations.revocationRevision,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
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
    domainFraming:
      "implemented_candidate_fixed_prefix_uint64be_length_jcs_payload",
    keyIdEncoding: "implemented_candidate_spki_der_sha256_lowercase_hex_64",
    recordSignatureAlgorithm: "ECDSA-P256-SHA256",
    recordSignatureEncoding: "low-S-IEEE-P1363-64-byte-unpadded-base64url",
    recordPayloadCodec: "implemented_candidate",
    multiSignatureEnvelopeCodec: "implemented_candidate",
    trustAnchorSetCodec: "implemented_candidate_untrusted_input",
    revocationManifestCodec: "implemented_candidate_untrusted_input",
    aggregateCryptographicCondition:
      "implemented_candidate_fail_closed_all_entries",
    authorityRootBindingVerification: "implemented_candidate",
    runtimeOwnedBundledTrustSelection: "not_implemented",
    rollbackResistantTrustFloor: "not_implemented",
    filesystemRead: "not_implemented",
    lifecyclePersistence: "not_implemented",
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
