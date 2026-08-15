import { types as utilTypes } from "node:util";

import {
  canonicalizeProvisioningJsonValueCandidate,
  inspectProvisioningEd25519SpkiCandidate,
  PROVISIONING_SIGNATURE_INPUT_LIMITS
} from "./provisioning-signature-primitives.mjs";
import { verifyProvisioningRecordAggregateCandidate } from
  "./provisioning-record-pure-core.mjs";
import { verifyInitialEnrollmentCertificateCandidate } from
  "./initial-enrollment-pure-core.mjs";
import { verifyProvisioningCaStateCandidate } from "./provisioning-ca-pure-core.mjs";
import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";

const INPUT_KEYS = new Set([
  "recordEnvelopeBytes", "recordTrustAnchorSetBytes", "recordRevocationManifestBytes",
  "certificateBindings", "provisioningCaRootTrustSet", "provisioningCaRevocationEnvelope",
  "evaluationTime"
]);
const BINDING_KEYS = new Set(["certificateEnvelope", "issuingCertificateEnvelope"]);
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype), "byteLength"
).get;

function response(status, reason, details = {}) {
  return Object.freeze({
    status, reason, ...details,
    runtimeOwnedTrustConfirmed: false,
    rollbackFloorConfirmed: false,
    runtimeClockAuthorityConfirmed: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false
  });
}

function ownedBuffer(raw) {
  try {
    if (!Buffer.isBuffer(raw)) return null;
    const length = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, raw, []);
    if (length > PROVISIONING_SIGNATURE_INPUT_LIMITS.canonicalBytes) return null;
    const result = Buffer.allocUnsafe(length);
    Uint8Array.prototype.set.call(result, raw);
    return result;
  } catch { return null; }
}

function ownedJson(raw) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(raw);
  if (canonical.status !== "candidate") return null;
  try { return JSON.parse(canonical.canonicalBytes.toString("utf8")); } catch { return null; }
}

function exactBindings(raw) {
  if (!Array.isArray(raw) || utilTypes.isProxy(raw) ||
      Object.getPrototypeOf(raw) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(raw, "length");
  if (!length || length.enumerable || length.configurable ||
      !Number.isSafeInteger(length.value) || length.value < 1 || length.value > 16) return null;
  const keys = Reflect.ownKeys(raw);
  if (keys.length !== length.value + 1 || keys.at(-1) !== "length") return null;
  const values = [];
  for (let index = 0; index < length.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor) ||
        descriptor.get || descriptor.set) return null;
    const value = snapshotPlainRecord(descriptor.value, BINDING_KEYS);
    if (!value) return null;
    values.push(value);
  }
  return Object.freeze(values);
}

function issuingKey(raw) {
  const payload = raw?.payload;
  if (!payload || payload.role !== "online_enrollment_issuer" ||
      typeof payload.spkiDer !== "string" || typeof payload.keyId !== "string" ||
      typeof payload.caSeriesId !== "string") return null;
  const bytes = Buffer.from(payload.spkiDer, "base64url");
  const inspected = inspectProvisioningEd25519SpkiCandidate(bytes);
  return inspected.status === "candidate" &&
    inspected.spkiSha256Digest.toString("hex") === payload.keyId
    ? Object.freeze({ payload, spkiDer: bytes }) : null;
}

export function verifyProvisioningRecordEnrollmentBindingCandidate(rawInput) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input || typeof input.evaluationTime !== "string") {
      return response("blocked", "provisioning_record_enrollment_binding_input_invalid");
    }
    const envelopeBytes = ownedBuffer(input.recordEnvelopeBytes);
    const keysetBytes = ownedBuffer(input.recordTrustAnchorSetBytes);
    const revocationBytes = ownedBuffer(input.recordRevocationManifestBytes);
    const ownedTrust = ownedJson({
      certificateBindings: input.certificateBindings,
      rootTrustSet: input.provisioningCaRootTrustSet,
      revocationEnvelope: input.provisioningCaRevocationEnvelope
    });
    const bindings = ownedTrust && exactBindings(ownedTrust.certificateBindings);
    if (!envelopeBytes || !keysetBytes || !revocationBytes || !ownedTrust || !bindings) {
      return response("blocked", "provisioning_record_enrollment_binding_input_invalid");
    }
    const aggregate = verifyProvisioningRecordAggregateCandidate({
      envelopeBytes,
      trustAnchorSetBytes: keysetBytes,
      revocationManifestBytes: revocationBytes,
      evaluationTime: input.evaluationTime
    });
    if (aggregate.status !== "candidate") {
      return response("blocked", "provisioning_record_enrollment_binding_record_invalid");
    }
    const recordEnvelope = JSON.parse(envelopeBytes.toString("utf8"));
    const recordKeyset = JSON.parse(keysetBytes.toString("utf8"));
    const signatures = recordEnvelope.signatures;
    if (!Array.isArray(signatures) || signatures.length !== bindings.length) {
      return response("blocked", "provisioning_record_enrollment_binding_cardinality_mismatch");
    }
    const bound = new Set();
    for (const binding of bindings) {
      const issuer = issuingKey(binding.issuingCertificateEnvelope);
      const certificate = binding.certificateEnvelope?.payload;
      if (!issuer || !certificate || bound.has(certificate.installationKeyId)) {
        return response("blocked", "provisioning_record_enrollment_binding_certificate_invalid");
      }
      const ca = verifyProvisioningCaStateCandidate({
        rootTrustSet: ownedTrust.rootTrustSet,
        issuingCertificateEnvelope: binding.issuingCertificateEnvelope,
        revocationEnvelope: ownedTrust.revocationEnvelope,
        evaluationTime: input.evaluationTime
      });
      const certificateResult = verifyInitialEnrollmentCertificateCandidate({
        certificateEnvelope: binding.certificateEnvelope,
        issuerSpkiDer: issuer.spkiDer
      });
      const now = Date.parse(input.evaluationTime);
      const record = recordEnvelope.payload;
      const key = recordKeyset.keys.find((entry) => entry.keyId === certificate.installationKeyId);
      if (ca.status !== "candidate" || certificateResult.status !== "candidate" ||
          now < Date.parse(certificate.issuedAt) || now >= Date.parse(certificate.expiresAt) ||
          record.provisionerEnrollmentId !== certificate.enrollmentId ||
          record.platformScopeId !== certificate.platformScopeId ||
          record.provisionerIdentityHash !== certificate.provisionerIdentityHash ||
          !key || key.spkiDer !== certificate.installationKeySpkiDer ||
          key.enrollmentCaId !== issuer.payload.caSeriesId ||
          !signatures.some((entry) => entry.keyId === certificate.installationKeyId)) {
        return response("blocked", "provisioning_record_enrollment_binding_mismatch");
      }
      bound.add(certificate.installationKeyId);
    }
    if (signatures.some((entry) => !bound.has(entry.keyId))) {
      return response("blocked", "provisioning_record_enrollment_binding_unbound_signer");
    }
    return response(
      "candidate",
      "runtime_owned_trust_rollback_clock_filesystem_activation_and_current_run_verification_required",
      {
        recordHash: aggregate.recordHash,
        verifiedRecordSignatureCount: aggregate.verifiedSignatureCount,
        verifiedEnrollmentBindingCount: bound.size,
        cryptographicAndEnrollmentBindingSatisfied: true
      }
    );
  } catch {
    return response("blocked", "provisioning_record_enrollment_binding_input_invalid");
  }
}

export function describeProvisioningRecordEnrollmentBindingContract() {
  return Object.freeze({
    contract: "crdd-coordinator/provisioning-record-enrollment-binding",
    contractRevision: 1,
    signerBinding: "every_record_signature_requires_one_current_enrollment_certificate",
    identityBinding:
      "enrollment_platform_scope_provisioner_identity_installation_spki_and_ca_series_exact",
    verification: "implemented_candidate",
    runtimeOwnedTrustRollbackClockFilesystemAndActivation: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false
  });
}
