import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  canonicalizeProvisioningJsonValueCandidate,
  inspectProvisioningEd25519SpkiCandidate,
  verifyProvisioningEd25519Base64urlCandidate,
} from "./provisioning-signature-primitives.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

export const PROVISIONING_CA_CONTRACT_REVISION = 1;
export const PROVISIONING_CA_DOMAINS = Object.freeze({
  issuingCertificate: "CRDD\0PROVISIONING-CA-ISSUING-CERTIFICATE\0V1\0",
  revocationManifest: "CRDD\0PROVISIONING-CA-REVOCATION-MANIFEST\0V1\0",
});

const ROOT_SET_CONTRACT = "crdd-coordinator/provisioning-ca-root-trust-set";
const ISSUING_CERTIFICATE_CONTRACT =
  "crdd-coordinator/provisioning-ca-issuing-certificate";
const ISSUING_ENVELOPE_CONTRACT =
  "crdd-coordinator/provisioning-ca-issuing-certificate-envelope";
const REVOCATION_CONTRACT =
  "crdd-coordinator/provisioning-ca-revocation-manifest";
const REVOCATION_ENVELOPE_CONTRACT =
  "crdd-coordinator/provisioning-ca-revocation-manifest-envelope";

const ROOT_SET_KEYS = new Set([
  "contract",
  "contractRevision",
  "trustEpoch",
  "roots",
]);
const ROOT_KEYS = new Set([
  "keyId",
  "algorithm",
  "spkiDer",
  "notBefore",
  "notAfter",
]);
const ISSUING_KEYS = new Set([
  "contract",
  "contractRevision",
  "caSeriesId",
  "role",
  "keyId",
  "algorithm",
  "spkiDer",
  "rootKeyId",
  "trustEpoch",
  "notBefore",
  "notAfter",
]);
const REVOCATION_KEYS = new Set([
  "contract",
  "contractRevision",
  "trustEpoch",
  "revocationRevision",
  "issuedAt",
  "expiresAt",
  "revoked",
]);
const REVOKED_KEYS = new Set(["keyId", "revokedAt", "reasonCode"]);
const ENVELOPE_KEYS = new Set([
  "contract",
  "contractRevision",
  "payload",
  "signatures",
]);
const SIGNATURE_KEYS = new Set(["keyId", "algorithm", "signature"]);
const VERIFY_KEYS = new Set([
  "rootTrustSet",
  "issuingCertificateEnvelope",
  "revocationEnvelope",
  "evaluationTime",
]);
const HEX32 = /^[0-9a-f]{32}$/u;
const HEX64 = /^[0-9a-f]{64}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ROLES = new Set(["online_enrollment_issuer", "offline_bundle_issuer"]);

type ProvisioningCaResponseBase<S extends string> = {
  status: S;
  reason: string;
  runtimeOwnedRootTrustConfirmed: false;
  rollbackFloorConfirmed: false;
  runtimeClockAuthorityConfirmed: false;
  runtimeAuthorityConferred: false;
  runtimeCapabilityIssued: false;
  filesystemEffectIssued: false;
  networkEffectIssued: false;
};

function response<const S extends string>(
  status: S,
  reason: string,
): Readonly<ProvisioningCaResponseBase<S>>;
function response<const S extends string, T extends Record<string, unknown>>(
  status: S,
  reason: string,
  details: T,
): Readonly<ProvisioningCaResponseBase<S> & T>;
function response(
  status: string,
  reason: string,
  details?: Record<string, unknown>,
) {
  const base = {
    status,
    reason,
    runtimeOwnedRootTrustConfirmed: false,
    rollbackFloorConfirmed: false,
    runtimeClockAuthorityConfirmed: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  } as const;
  return Object.freeze(details ? Object.assign(base, details) : base);
}

function exactArray<T>(
  raw: unknown,
  maximum: number,
  normalize: (value: unknown) => T | null,
): readonly T[] | null {
  if (
    !Array.isArray(raw) ||
    utilTypes.isProxy(raw) ||
    Object.getPrototypeOf(raw) !== Array.prototype
  )
    return null;
  const length = Object.getOwnPropertyDescriptor(raw, "length");
  if (
    !length ||
    length.enumerable ||
    length.configurable ||
    !Number.isSafeInteger(length.value) ||
    length.value < 0 ||
    length.value > maximum
  )
    return null;
  const keys = Reflect.ownKeys(raw);
  if (keys.length !== length.value + 1 || keys.at(-1) !== "length") return null;
  const values: T[] = [];
  for (let index = 0; index < length.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, String(index));
    if (
      !descriptor?.enumerable ||
      !("value" in descriptor) ||
      descriptor.get ||
      descriptor.set
    )
      return null;
    const value = normalize(descriptor.value);
    if (!value) return null;
    values.push(value);
  }
  return Object.freeze(values);
}

function utc(value: unknown): value is string {
  return (
    typeof value === "string" &&
    UTC.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value
  );
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function ed25519Spki(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length !== 59 ||
    !BASE64URL.test(value)
  )
    return null;
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== 44 || bytes.toString("base64url") !== value) return null;
  const inspected = inspectProvisioningEd25519SpkiCandidate(bytes);
  if (inspected.status !== "candidate") return null;
  return Object.freeze({
    bytes,
    keyId: inspected.spkiSha256Digest.toString("hex"),
  });
}

function normalizeRoot(raw: unknown) {
  const value = snapshotPlainRecord(raw, ROOT_KEYS);
  const spki = value && ed25519Spki(value.spkiDer);
  if (
    !value ||
    !spki ||
    typeof value.keyId !== "string" ||
    !HEX64.test(value.keyId) ||
    value.keyId !== spki.keyId ||
    value.algorithm !== "Ed25519" ||
    !utc(value.notBefore) ||
    !utc(value.notAfter) ||
    Date.parse(value.notAfter) <= Date.parse(value.notBefore)
  )
    return null;
  return Object.freeze({
    value: Object.freeze({
      ...value,
      keyId: value.keyId,
      notBefore: value.notBefore,
      notAfter: value.notAfter,
    }),
    spkiDer: spki.bytes,
  });
}

function normalizeRootSet(raw: unknown) {
  const value = snapshotPlainRecord(raw, ROOT_SET_KEYS);
  const roots = value && exactArray(value.roots, 8, normalizeRoot);
  if (
    !value ||
    value.contract !== ROOT_SET_CONTRACT ||
    value.contractRevision !== PROVISIONING_CA_CONTRACT_REVISION ||
    !positive(value.trustEpoch) ||
    !roots ||
    roots.length === 0 ||
    roots.some((root, index) => {
      const previous = roots[index - 1];
      return previous !== undefined && previous.value.keyId >= root.value.keyId;
    })
  )
    return null;
  return Object.freeze({
    value: Object.freeze({ ...value, trustEpoch: value.trustEpoch }),
    roots,
  });
}

function normalizeSignature(raw: unknown) {
  const value = snapshotPlainRecord(raw, SIGNATURE_KEYS);
  return value &&
    typeof value.keyId === "string" &&
    HEX64.test(value.keyId) &&
    value.algorithm === "Ed25519" &&
    typeof value.signature === "string" &&
    value.signature.length === 86 &&
    BASE64URL.test(value.signature) &&
    Buffer.from(value.signature, "base64url").length === 64 &&
    Buffer.from(value.signature, "base64url").toString("base64url") ===
      value.signature
    ? Object.freeze({ keyId: value.keyId, signature: value.signature })
    : null;
}

function normalizeIssuing(raw: unknown) {
  const value = snapshotPlainRecord(raw, ISSUING_KEYS);
  const spki = value && ed25519Spki(value.spkiDer);
  if (
    !value ||
    value.contract !== ISSUING_CERTIFICATE_CONTRACT ||
    value.contractRevision !== PROVISIONING_CA_CONTRACT_REVISION ||
    typeof value.caSeriesId !== "string" ||
    !HEX32.test(value.caSeriesId) ||
    typeof value.role !== "string" ||
    !ROLES.has(value.role) ||
    !spki ||
    typeof value.keyId !== "string" ||
    !HEX64.test(value.keyId) ||
    value.keyId !== spki.keyId ||
    value.algorithm !== "Ed25519" ||
    typeof value.rootKeyId !== "string" ||
    !HEX64.test(value.rootKeyId) ||
    !positive(value.trustEpoch) ||
    !utc(value.notBefore) ||
    !utc(value.notAfter) ||
    Date.parse(value.notAfter) <= Date.parse(value.notBefore) ||
    Date.parse(value.notAfter) - Date.parse(value.notBefore) > 365 * 86_400_000
  )
    return null;
  return Object.freeze({
    value: Object.freeze({
      ...value,
      caSeriesId: value.caSeriesId,
      role: value.role,
      keyId: value.keyId,
      rootKeyId: value.rootKeyId,
      trustEpoch: value.trustEpoch,
      notBefore: value.notBefore,
      notAfter: value.notAfter,
    }),
    spkiDer: spki.bytes,
  });
}

function normalizeRevoked(raw: unknown) {
  const value = snapshotPlainRecord(raw, REVOKED_KEYS);
  return value &&
    typeof value.keyId === "string" &&
    HEX64.test(value.keyId) &&
    utc(value.revokedAt) &&
    typeof value.reasonCode === "string" &&
    /^[a-z][a-z0-9_]{0,63}$/u.test(value.reasonCode)
    ? Object.freeze({
        keyId: value.keyId,
        revokedAt: value.revokedAt,
        reasonCode: value.reasonCode,
      })
    : null;
}

function normalizeRevocation(raw: unknown) {
  const value = snapshotPlainRecord(raw, REVOCATION_KEYS);
  const revokedEntries =
    value && exactArray(value.revoked, 4096, normalizeRevoked);
  if (
    !value ||
    value.contract !== REVOCATION_CONTRACT ||
    value.contractRevision !== PROVISIONING_CA_CONTRACT_REVISION ||
    !positive(value.trustEpoch) ||
    !positive(value.revocationRevision) ||
    !utc(value.issuedAt) ||
    !utc(value.expiresAt) ||
    Date.parse(value.expiresAt) <= Date.parse(value.issuedAt) ||
    Date.parse(value.expiresAt) - Date.parse(value.issuedAt) > 24 * 3_600_000 ||
    !revokedEntries ||
    revokedEntries.some((entry, index) => {
      const previous = revokedEntries[index - 1];
      return previous !== undefined && previous.keyId >= entry.keyId;
    })
  )
    return null;
  return Object.freeze({
    ...value,
    trustEpoch: value.trustEpoch,
    revocationRevision: value.revocationRevision,
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
    revoked: revokedEntries,
  });
}

function normalizeEnvelope<T>(
  raw: unknown,
  contract: string,
  normalizePayload: (value: unknown) => T | null,
) {
  const value = snapshotPlainRecord(raw, ENVELOPE_KEYS);
  const payload = value && normalizePayload(value.payload);
  const signatures =
    value && exactArray(value.signatures, 1, normalizeSignature);
  const signature = signatures?.[0];
  if (
    !value ||
    value.contract !== contract ||
    value.contractRevision !== PROVISIONING_CA_CONTRACT_REVISION ||
    !payload ||
    !signatures ||
    signatures.length !== 1 ||
    !signature
  )
    return null;
  return Object.freeze({ value, payload, signature });
}

function frame(domain: string, payload: unknown) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(payload);
  if (canonical.status !== "candidate") return null;
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.canonicalBytes.length));
  const message = Buffer.concat([
    Buffer.from(domain, "ascii"),
    length,
    canonical.canonicalBytes,
  ]);
  return Object.freeze({
    message,
    hash: createHash("sha256").update(message).digest("hex"),
  });
}

function verifyRootSignature(
  root: { value: { keyId: string }; spkiDer: Buffer },
  signature: { keyId: string; signature: string },
  message: Buffer,
) {
  return (
    signature.keyId === root.value.keyId &&
    verifyProvisioningEd25519Base64urlCandidate({
      spkiDer: root.spkiDer,
      message,
      signatureBase64url: signature.signature,
    }).status === "candidate"
  );
}

export function verifyProvisioningCaStateCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, VERIFY_KEYS);
    if (!input || !utc(input.evaluationTime)) {
      return response("blocked", "provisioning_ca_state_input_invalid");
    }
    const roots = normalizeRootSet(input.rootTrustSet);
    const issuing = normalizeEnvelope(
      input.issuingCertificateEnvelope,
      ISSUING_ENVELOPE_CONTRACT,
      normalizeIssuing,
    );
    const revocations = normalizeEnvelope(
      input.revocationEnvelope,
      REVOCATION_ENVELOPE_CONTRACT,
      normalizeRevocation,
    );
    if (
      !roots ||
      !issuing ||
      !revocations ||
      issuing.payload.value.trustEpoch !== roots.value.trustEpoch ||
      revocations.payload.trustEpoch !== roots.value.trustEpoch
    ) {
      return response("blocked", "provisioning_ca_state_invalid");
    }
    const root = roots.roots.find(
      (entry) => entry.value.keyId === issuing.payload.value.rootKeyId,
    );
    const revocationRoot = roots.roots.find(
      (entry) => entry.value.keyId === revocations.signature.keyId,
    );
    const issuingFrame = frame(
      PROVISIONING_CA_DOMAINS.issuingCertificate,
      issuing.payload.value,
    );
    const revocationFrame = frame(
      PROVISIONING_CA_DOMAINS.revocationManifest,
      revocations.payload,
    );
    if (
      !root ||
      !revocationRoot ||
      !issuingFrame ||
      !revocationFrame ||
      !verifyRootSignature(root, issuing.signature, issuingFrame.message) ||
      !verifyRootSignature(
        revocationRoot,
        revocations.signature,
        revocationFrame.message,
      )
    ) {
      return response("blocked", "provisioning_ca_signature_or_root_mismatch");
    }
    const now = Date.parse(input.evaluationTime);
    const timeValues = [
      root.value,
      revocationRoot.value,
      issuing.payload.value,
      {
        notBefore: revocations.payload.issuedAt,
        notAfter: revocations.payload.expiresAt,
      },
    ];
    if (
      timeValues.some(
        (entry) =>
          now < Date.parse(entry.notBefore) ||
          now >= Date.parse(entry.notAfter),
      )
    ) {
      return response("blocked", "provisioning_ca_state_not_current");
    }
    const revokedEntries = new Set(
      revocations.payload.revoked.map((entry) => entry.keyId),
    );
    if (
      revokedEntries.has(root.value.keyId) ||
      revokedEntries.has(revocationRoot.value.keyId) ||
      revokedEntries.has(issuing.payload.value.keyId)
    ) {
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
        revocationManifestCryptographicMatch: true,
      },
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
    issuingCertificateVerification:
      "implemented_candidate_cryptographic_condition_only",
    revocationManifestVerification:
      "implemented_candidate_cryptographic_condition_only",
    runtimeOwnedRootTrustSelection: "not_implemented",
    rollbackFloorPersistence: "not_implemented",
    runtimeClockAuthority: "not_implemented",
    trustDistribution: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}
