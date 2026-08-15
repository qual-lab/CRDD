import { canonicalizeProvisioningJsonValueCandidate, PROVISIONING_SIGNATURE_INPUT_LIMITS } from
  "./provisioning-signature-primitives.mjs";
import { verifyInitialEnrollmentCertificateCandidate } from
  "./initial-enrollment-pure-core.mjs";
import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";

const INPUT_KEYS = new Set([
  "previousCertificateEnvelope", "previousIssuerSpkiDer", "nextCertificateEnvelope",
  "nextIssuerSpkiDer", "evaluationTime"
]);
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype), "byteLength"
).get;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const DAY = 86_400_000;

function response(status, reason, details = {}) {
  return Object.freeze({
    status, reason, ...details,
    runtimeClockAuthorityConfirmed: false,
    runtimeOwnedCaTrustConfirmed: false,
    rollbackFloorConfirmed: false,
    persistenceConfirmed: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false
  });
}

function utc(value) {
  return typeof value === "string" && UTC.test(value) && Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function ownedSpki(raw) {
  try {
    if (!Buffer.isBuffer(raw)) return null;
    const length = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, raw, []);
    if (length > PROVISIONING_SIGNATURE_INPUT_LIMITS.spkiDerBytes) return null;
    const value = Buffer.allocUnsafe(length);
    Uint8Array.prototype.set.call(value, raw);
    return value;
  } catch { return null; }
}

function ownedEnvelopes(previous, next) {
  const canonical = canonicalizeProvisioningJsonValueCandidate({ previous, next });
  if (canonical.status !== "candidate") return null;
  try { return JSON.parse(canonical.canonicalBytes.toString("utf8")); } catch { return null; }
}

export function verifyEnrollmentCertificateRenewalCandidate(rawInput) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input || !utc(input.evaluationTime)) {
      return response("blocked", "enrollment_certificate_renewal_input_invalid");
    }
    const envelopes = ownedEnvelopes(input.previousCertificateEnvelope,
      input.nextCertificateEnvelope);
    const previousIssuer = ownedSpki(input.previousIssuerSpkiDer);
    const nextIssuer = ownedSpki(input.nextIssuerSpkiDer);
    if (!envelopes || !previousIssuer || !nextIssuer) {
      return response("blocked", "enrollment_certificate_renewal_input_invalid");
    }
    const previousResult = verifyInitialEnrollmentCertificateCandidate({
      certificateEnvelope: envelopes.previous, issuerSpkiDer: previousIssuer
    });
    const nextResult = verifyInitialEnrollmentCertificateCandidate({
      certificateEnvelope: envelopes.next, issuerSpkiDer: nextIssuer
    });
    const previous = envelopes.previous?.payload;
    const next = envelopes.next?.payload;
    if (previousResult.status !== "candidate" || nextResult.status !== "candidate" ||
        !previous || !next) {
      return response("blocked", "enrollment_certificate_renewal_certificate_invalid");
    }
    if (previous.enrollmentId !== next.enrollmentId ||
        previous.platformScopeId !== next.platformScopeId ||
        previous.provisionerIdentityHash !== next.provisionerIdentityHash ||
        previous.installationKeyId !== next.installationKeyId ||
        previous.installationKeySpkiDer !== next.installationKeySpkiDer) {
      return response("blocked", "enrollment_certificate_renewal_identity_mismatch");
    }
    const now = Date.parse(input.evaluationTime);
    const previousExpiry = Date.parse(previous.expiresAt);
    const nextIssued = Date.parse(next.issuedAt);
    if (now < previousExpiry - 30 * DAY || now >= previousExpiry ||
        nextIssued < previousExpiry - 30 * DAY || nextIssued >= previousExpiry ||
        previousExpiry - nextIssued > 30 * DAY ||
        Date.parse(next.expiresAt) <= previousExpiry) {
      return response("blocked", "enrollment_certificate_renewal_window_invalid");
    }
    return response(
      "candidate",
      "runtime_owned_clock_ca_trust_rollback_persistence_and_automatic_renewal_effect_required",
      {
        previousCertificateCryptographicMatch: true,
        nextCertificateCryptographicMatch: true,
        identityContinuitySatisfied: true,
        renewalWindowSatisfied: true
      }
    );
  } catch {
    return response("blocked", "enrollment_certificate_renewal_input_invalid");
  }
}

export function describeEnrollmentCertificateRenewalContract() {
  return Object.freeze({
    contract: "crdd-coordinator/enrollment-certificate-renewal",
    contractRevision: 1,
    renewalWindowDays: 30,
    maximumOverlapDays: 30,
    identityContinuity:
      "enrollment_scope_provisioner_identity_installation_key_and_spki_unchanged",
    transitionVerification: "implemented_candidate",
    certificateIssuanceAndAutomaticRenewalEffect: "not_implemented",
    runtimeClockCaTrustRollbackAndPersistence: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false
  });
}
