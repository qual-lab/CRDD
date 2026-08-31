import { types as utilTypes } from "node:util";

import {
  canonicalizeProvisioningJsonValueCandidate,
  inspectProvisioningEd25519SpkiCandidate,
  PROVISIONING_SIGNATURE_INPUT_LIMITS,
} from "./provisioning-signature-primitives.ts";
import { verifyProvisioningRecordAggregateCandidate } from "./provisioning-record-pure-core.ts";
import { verifyInitialEnrollmentCertificateCandidate } from "./initial-enrollment-pure-core.ts";
import { verifyProvisioningCaStateCandidate } from "./provisioning-ca-pure-core.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

const INPUT_KEYS = new Set([
  "recordEnvelopeBytes",
  "recordTrustAnchorSetBytes",
  "recordRevocationManifestBytes",
  "certificateBindings",
  "provisioningCaRootTrustSet",
  "provisioningCaRevocationEnvelope",
  "evaluationTime",
]);
const BINDING_KEYS = new Set([
  "certificateEnvelope",
  "issuingCertificateEnvelope",
]);
const OWNED_TRUST_KEYS = new Set([
  "certificateBindings",
  "rootTrustSet",
  "revocationEnvelope",
]);
const ENVELOPE_KEYS = new Set([
  "contract",
  "contractRevision",
  "payload",
  "signatures",
]);
const RECORD_KEYS = new Set([
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
const SIGNATURE_KEYS = new Set(["keyId", "algorithm", "signature"]);
const KEYSET_KEYS = new Set([
  "contract",
  "contractRevision",
  "trustEpoch",
  "keys",
]);
const KEY_KEYS = new Set([
  "keyId",
  "algorithm",
  "spkiDer",
  "enrollmentCaId",
  "notBefore",
  "notAfter",
]);
const CERTIFICATE_KEYS = new Set([
  "contract",
  "contractRevision",
  "enrollmentId",
  "platformScopeId",
  "provisionerIdentityHash",
  "installationKeyId",
  "installationKeySpkiDer",
  "issuedAt",
  "expiresAt",
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
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get;

type Binding = Readonly<{
  certificateEnvelope: unknown;
  issuingCertificateEnvelope: unknown;
}>;

type IssuingKey = Readonly<{
  payload: Readonly<{ caSeriesId: string }>;
  spkiDer: Buffer;
}>;

type BindingResponseBase<S extends string> = {
  status: S;
  reason: string;
  runtimeOwnedTrustConfirmed: false;
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
): Readonly<BindingResponseBase<S>>;
function response<
  const S extends string,
  T extends Readonly<Record<string, unknown>>,
>(status: S, reason: string, details: T): Readonly<BindingResponseBase<S> & T>;
function response(
  status: string,
  reason: string,
  details?: Readonly<Record<string, unknown>>,
) {
  const base = {
    status,
    reason,
    runtimeOwnedTrustConfirmed: false,
    rollbackFloorConfirmed: false,
    runtimeClockAuthorityConfirmed: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  } as const;
  return Object.freeze(details ? Object.assign(base, details) : base);
}

function ownedBuffer(raw: unknown) {
  try {
    if (!Buffer.isBuffer(raw) || typeof TYPED_ARRAY_BYTE_LENGTH !== "function")
      return null;
    const length = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, raw, []);
    if (
      typeof length !== "number" ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > PROVISIONING_SIGNATURE_INPUT_LIMITS.canonicalBytes
    )
      return null;
    const result = Buffer.allocUnsafe(length);
    Uint8Array.prototype.set.call(result, raw);
    return result;
  } catch {
    return null;
  }
}

function ownedJson(raw: unknown): unknown | null {
  const canonical = canonicalizeProvisioningJsonValueCandidate(raw);
  if (canonical.status !== "candidate") return null;
  try {
    const parsed: unknown = JSON.parse(
      canonical.canonicalBytes.toString("utf8"),
    );
    return parsed;
  } catch {
    return null;
  }
}

function exactBindings(raw: unknown): readonly Binding[] | null {
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
    length.value < 1 ||
    length.value > 16
  )
    return null;
  const keys = Reflect.ownKeys(raw);
  if (keys.length !== length.value + 1 || keys.at(-1) !== "length") return null;
  const values: Binding[] = [];
  for (let index = 0; index < length.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, String(index));
    if (
      !descriptor?.enumerable ||
      !("value" in descriptor) ||
      descriptor.get ||
      descriptor.set
    )
      return null;
    const value = snapshotPlainRecord(descriptor.value, BINDING_KEYS);
    if (!value) return null;
    values.push(
      Object.freeze({
        certificateEnvelope: value.certificateEnvelope,
        issuingCertificateEnvelope: value.issuingCertificateEnvelope,
      }),
    );
  }
  return Object.freeze(values);
}

function issuingKey(raw: unknown): IssuingKey | null {
  const envelope = snapshotPlainRecord(raw, ENVELOPE_KEYS);
  const candidate =
    envelope && snapshotPlainRecord(envelope.payload, ISSUING_KEYS);
  if (!candidate) return null;
  if (
    candidate.role !== "online_enrollment_issuer" ||
    typeof candidate.spkiDer !== "string" ||
    typeof candidate.keyId !== "string" ||
    typeof candidate.caSeriesId !== "string"
  )
    return null;
  if (candidate.spkiDer.length !== 59 || !BASE64URL.test(candidate.spkiDer))
    return null;
  const bytes = Buffer.from(candidate.spkiDer, "base64url");
  if (bytes.length !== 44 || bytes.toString("base64url") !== candidate.spkiDer)
    return null;
  const inspected = inspectProvisioningEd25519SpkiCandidate(bytes);
  return inspected.status === "candidate" &&
    inspected.spkiSha256Digest.toString("hex") === candidate.keyId
    ? Object.freeze({
        payload: Object.freeze({ caSeriesId: candidate.caSeriesId }),
        spkiDer: bytes,
      })
    : null;
}

function parseJson(bytes: Buffer): unknown | null {
  try {
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    return parsed;
  } catch {
    return null;
  }
}

function exactRecordArray(
  raw: unknown,
  maximum: number,
  keys: ReadonlySet<string>,
): readonly Readonly<Record<string, unknown>>[] | null {
  if (
    !Array.isArray(raw) ||
    utilTypes.isProxy(raw) ||
    Object.getPrototypeOf(raw) !== Array.prototype
  )
    return null;
  const length = Object.getOwnPropertyDescriptor(raw, "length");
  if (
    !length ||
    !Object.hasOwn(length, "value") ||
    length.get !== undefined ||
    length.set !== undefined ||
    length.enumerable ||
    length.configurable ||
    !Number.isSafeInteger(length.value) ||
    length.value < 0 ||
    length.value > maximum
  )
    return null;
  const ownKeys = Reflect.ownKeys(raw);
  if (ownKeys.length !== length.value + 1) return null;
  const records: Readonly<Record<string, unknown>>[] = [];
  for (let index = 0; index < length.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, String(index));
    if (
      !descriptor ||
      !Object.hasOwn(descriptor, "value") ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      !descriptor.enumerable
    )
      return null;
    const record = snapshotPlainRecord(descriptor.value, keys);
    if (!record) return null;
    records.push(record);
  }
  return Object.freeze(records);
}

export function verifyProvisioningRecordEnrollmentBindingCandidate(
  rawInput: unknown,
) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input || typeof input.evaluationTime !== "string") {
      return response(
        "blocked",
        "provisioning_record_enrollment_binding_input_invalid",
      );
    }
    const envelopeBytes = ownedBuffer(input.recordEnvelopeBytes);
    const keysetBytes = ownedBuffer(input.recordTrustAnchorSetBytes);
    const revocationBytes = ownedBuffer(input.recordRevocationManifestBytes);
    const ownedTrustValue = ownedJson({
      certificateBindings: input.certificateBindings,
      rootTrustSet: input.provisioningCaRootTrustSet,
      revocationEnvelope: input.provisioningCaRevocationEnvelope,
    });
    const ownedTrust = snapshotPlainRecord(ownedTrustValue, OWNED_TRUST_KEYS);
    const bindings =
      ownedTrust && exactBindings(ownedTrust.certificateBindings);
    if (
      !envelopeBytes ||
      !keysetBytes ||
      !revocationBytes ||
      !ownedTrust ||
      !bindings
    ) {
      return response(
        "blocked",
        "provisioning_record_enrollment_binding_input_invalid",
      );
    }
    const aggregate = verifyProvisioningRecordAggregateCandidate({
      envelopeBytes,
      trustAnchorSetBytes: keysetBytes,
      revocationManifestBytes: revocationBytes,
      evaluationTime: input.evaluationTime,
    });
    if (aggregate.status !== "candidate") {
      return response(
        "blocked",
        "provisioning_record_enrollment_binding_record_invalid",
      );
    }
    const recordEnvelope = snapshotPlainRecord(
      parseJson(envelopeBytes),
      ENVELOPE_KEYS,
    );
    const record =
      recordEnvelope &&
      snapshotPlainRecord(recordEnvelope.payload, RECORD_KEYS);
    const signatures =
      recordEnvelope &&
      exactRecordArray(recordEnvelope.signatures, 16, SIGNATURE_KEYS);
    const recordKeyset = snapshotPlainRecord(
      parseJson(keysetBytes),
      KEYSET_KEYS,
    );
    const keys =
      recordKeyset && exactRecordArray(recordKeyset.keys, 32, KEY_KEYS);
    if (
      !recordEnvelope ||
      !record ||
      !signatures ||
      !recordKeyset ||
      !keys ||
      signatures.length !== bindings.length
    ) {
      return response(
        "blocked",
        "provisioning_record_enrollment_binding_cardinality_mismatch",
      );
    }
    const bound = new Set();
    for (const binding of bindings) {
      const issuer = issuingKey(binding.issuingCertificateEnvelope);
      const certificateEnvelope = snapshotPlainRecord(
        binding.certificateEnvelope,
        ENVELOPE_KEYS,
      );
      const certificate =
        certificateEnvelope &&
        snapshotPlainRecord(certificateEnvelope.payload, CERTIFICATE_KEYS);
      if (
        !issuer ||
        !certificate ||
        typeof certificate.installationKeyId !== "string" ||
        bound.has(certificate.installationKeyId)
      ) {
        return response(
          "blocked",
          "provisioning_record_enrollment_binding_certificate_invalid",
        );
      }
      const ca = verifyProvisioningCaStateCandidate({
        rootTrustSet: ownedTrust.rootTrustSet,
        issuingCertificateEnvelope: binding.issuingCertificateEnvelope,
        revocationEnvelope: ownedTrust.revocationEnvelope,
        evaluationTime: input.evaluationTime,
      });
      const certificateResult = verifyInitialEnrollmentCertificateCandidate({
        certificateEnvelope: binding.certificateEnvelope,
        issuerSpkiDer: issuer.spkiDer,
      });
      const now = Date.parse(input.evaluationTime);
      const key = keys.find(
        (entry) => entry.keyId === certificate.installationKeyId,
      );
      if (
        ca.status !== "candidate" ||
        certificateResult.status !== "candidate" ||
        typeof certificate.issuedAt !== "string" ||
        typeof certificate.expiresAt !== "string" ||
        typeof certificate.enrollmentId !== "string" ||
        typeof certificate.platformScopeId !== "string" ||
        typeof certificate.provisionerIdentityHash !== "string" ||
        typeof certificate.installationKeySpkiDer !== "string" ||
        now < Date.parse(certificate.issuedAt) ||
        now >= Date.parse(certificate.expiresAt) ||
        record.provisionerEnrollmentId !== certificate.enrollmentId ||
        record.platformScopeId !== certificate.platformScopeId ||
        record.provisionerIdentityHash !==
          certificate.provisionerIdentityHash ||
        !key ||
        key.spkiDer !== certificate.installationKeySpkiDer ||
        key.enrollmentCaId !== issuer.payload.caSeriesId ||
        !signatures.some(
          (entry) => entry.keyId === certificate.installationKeyId,
        )
      ) {
        return response(
          "blocked",
          "provisioning_record_enrollment_binding_mismatch",
        );
      }
      bound.add(certificate.installationKeyId);
    }
    if (
      signatures.some(
        (entry) => typeof entry.keyId !== "string" || !bound.has(entry.keyId),
      )
    ) {
      return response(
        "blocked",
        "provisioning_record_enrollment_binding_unbound_signer",
      );
    }
    return response(
      "candidate",
      "runtime_owned_trust_rollback_clock_filesystem_activation_and_current_run_verification_required",
      {
        recordHash: aggregate.recordHash,
        verifiedRecordSignatureCount: aggregate.verifiedSignatureCount,
        verifiedEnrollmentBindingCount: bound.size,
        cryptographicAndEnrollmentBindingSatisfied: true,
      },
    );
  } catch {
    return response(
      "blocked",
      "provisioning_record_enrollment_binding_input_invalid",
    );
  }
}

export function describeProvisioningRecordEnrollmentBindingContract() {
  return Object.freeze({
    contract: "crdd-coordinator/provisioning-record-enrollment-binding",
    contractRevision: 1,
    signerBinding:
      "every_record_signature_requires_one_current_enrollment_certificate",
    identityBinding:
      "enrollment_platform_scope_provisioner_identity_installation_spki_and_ca_series_exact",
    verification: "implemented_candidate",
    runtimeOwnedTrustRollbackClockFilesystemAndActivation: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}
