import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  canonicalizeProvisioningJsonValueCandidate,
  inspectProvisioningEd25519SpkiCandidate,
  verifyProvisioningEd25519Base64urlCandidate
} from "./provisioning-signature-primitives.mjs";
import {
  INITIAL_ENROLLMENT_DOMAINS,
  verifyInitialEnrollmentFlowCandidate
} from "./initial-enrollment-pure-core.mjs";
import { verifyProvisioningCaStateCandidate } from "./provisioning-ca-pure-core.mjs";
import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";

export const OFFLINE_ENROLLMENT_BUNDLE_CONTRACT_REVISION = 1;
export const OFFLINE_ENROLLMENT_BUNDLE_CONTRACT =
  "crdd-coordinator/offline-enrollment-bundle";
export const OFFLINE_ENROLLMENT_BUNDLE_ENVELOPE_CONTRACT =
  "crdd-coordinator/offline-enrollment-bundle-envelope";
export const OFFLINE_ENROLLMENT_BUNDLE_DOMAIN =
  "CRDD\0OFFLINE-ENROLLMENT-BUNDLE\0V1\0";

const INPUT_KEYS = new Set(["rootTrustSet", "bundleEnvelope", "evaluationTime"]);
const ENVELOPE_KEYS = new Set(["contract", "contractRevision", "payload", "signatures"]);
const SIGNATURE_KEYS = new Set(["keyId", "algorithm", "signature"]);
const PAYLOAD_KEYS = new Set([
  "contract", "contractRevision", "bundleId", "requestHash", "platformScopeId",
  "provisionerIdentityHash", "installationKeyId", "challenge", "requestEnvelope",
  "certificateEnvelope", "onlineIssuingCertificateEnvelope",
  "offlineIssuingCertificateEnvelope", "revocationEnvelope", "issuedAt", "expiresAt"
]);
const HEX32 = /^[0-9a-f]{32}$/u;
const HEX64 = /^[0-9a-f]{64}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function response(status, reason, details = {}) {
  return Object.freeze({
    status,
    reason,
    ...details,
    consumptionRequired: status === "candidate",
    runtimeOwnedCaTrustConfirmed: false,
    rollbackFloorConfirmed: false,
    runtimeClockAuthorityConfirmed: false,
    replayLedgerConfirmed: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false
  });
}

function exactArray(raw, length, normalize) {
  if (!Array.isArray(raw) || utilTypes.isProxy(raw) ||
      Object.getPrototypeOf(raw) !== Array.prototype) return null;
  const descriptor = Object.getOwnPropertyDescriptor(raw, "length");
  if (!descriptor || descriptor.enumerable || descriptor.configurable ||
      descriptor.value !== length) return null;
  const keys = Reflect.ownKeys(raw);
  if (keys.length !== length + 1 || keys.at(-1) !== "length") return null;
  const values = [];
  for (let index = 0; index < length; index += 1) {
    const item = Object.getOwnPropertyDescriptor(raw, String(index));
    if (!item || !item.enumerable || !("value" in item) || item.get || item.set) return null;
    const normalized = normalize(item.value);
    if (!normalized) return null;
    values.push(normalized);
  }
  return Object.freeze(values);
}

function utc(value) {
  return typeof value === "string" && UTC.test(value) && Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function signature(raw) {
  const value = snapshotPlainRecord(raw, SIGNATURE_KEYS);
  if (!value || typeof value.keyId !== "string" || !HEX64.test(value.keyId) ||
      value.algorithm !== "Ed25519" || typeof value.signature !== "string" ||
      value.signature.length !== 86 || !BASE64URL.test(value.signature)) return null;
  const bytes = Buffer.from(value.signature, "base64url");
  return bytes.length === 64 && bytes.toString("base64url") === value.signature ? value : null;
}

function payload(raw) {
  const value = snapshotPlainRecord(raw, PAYLOAD_KEYS);
  if (!value || value.contract !== OFFLINE_ENROLLMENT_BUNDLE_CONTRACT ||
      value.contractRevision !== OFFLINE_ENROLLMENT_BUNDLE_CONTRACT_REVISION ||
      typeof value.bundleId !== "string" || !HEX32.test(value.bundleId) ||
      typeof value.requestHash !== "string" || !HEX64.test(value.requestHash) ||
      typeof value.platformScopeId !== "string" || !HEX32.test(value.platformScopeId) ||
      typeof value.provisionerIdentityHash !== "string" || !HEX64.test(value.provisionerIdentityHash) ||
      typeof value.installationKeyId !== "string" || !HEX64.test(value.installationKeyId) ||
      !utc(value.issuedAt) || !utc(value.expiresAt) ||
      Date.parse(value.expiresAt) <= Date.parse(value.issuedAt) ||
      Date.parse(value.expiresAt) - Date.parse(value.issuedAt) > 7 * 86_400_000) return null;
  return value;
}

function envelope(raw) {
  const value = snapshotPlainRecord(raw, ENVELOPE_KEYS);
  const normalizedPayload = value && payload(value.payload);
  const signatures = value && exactArray(value.signatures, 1, signature);
  if (!value || value.contract !== OFFLINE_ENROLLMENT_BUNDLE_ENVELOPE_CONTRACT ||
      value.contractRevision !== OFFLINE_ENROLLMENT_BUNDLE_CONTRACT_REVISION ||
      !normalizedPayload || !signatures) return null;
  return Object.freeze({ value, payload: normalizedPayload, signature: signatures[0] });
}

function frame(domain, value) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(value);
  if (canonical.status !== "candidate") return null;
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.canonicalBytes.length));
  const message = Buffer.concat([Buffer.from(domain, "ascii"), length, canonical.canonicalBytes]);
  return Object.freeze({ message, hash: createHash("sha256").update(message).digest("hex") });
}

function ownedPlainInput(raw) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(raw);
  if (canonical.status !== "candidate") return null;
  try { return JSON.parse(canonical.canonicalBytes.toString("utf8")); } catch { return null; }
}

function issuingPayload(rawEnvelope, role) {
  const outer = snapshotPlainRecord(rawEnvelope, ENVELOPE_KEYS);
  const value = outer && outer.payload;
  if (!value || value.role !== role || typeof value.spkiDer !== "string" ||
      typeof value.keyId !== "string" || !HEX64.test(value.keyId) ||
      typeof value.caSeriesId !== "string" || !HEX32.test(value.caSeriesId) ||
      typeof value.rootKeyId !== "string" || !HEX64.test(value.rootKeyId) ||
      !Number.isSafeInteger(value.trustEpoch)) return null;
  const bytes = Buffer.from(value.spkiDer, "base64url");
  const inspected = inspectProvisioningEd25519SpkiCandidate(bytes);
  if (inspected.status !== "candidate" ||
      inspected.spkiSha256Digest.toString("hex") !== value.keyId) return null;
  return Object.freeze({ value, spkiDer: bytes });
}

function requestHash(requestEnvelope) {
  const outer = snapshotPlainRecord(requestEnvelope, ENVELOPE_KEYS);
  const requestFrame = outer && frame(INITIAL_ENROLLMENT_DOMAINS.request, outer.payload);
  return requestFrame?.hash ?? null;
}

export function verifyOfflineEnrollmentBundleCandidate(rawInput) {
  try {
    const owned = ownedPlainInput(rawInput);
    const input = owned && snapshotPlainRecord(owned, INPUT_KEYS);
    const bundle = input && envelope(input.bundleEnvelope);
    if (!input || !bundle || !utc(input.evaluationTime)) {
      return response("blocked", "offline_enrollment_bundle_input_invalid");
    }
    const online = issuingPayload(bundle.payload.onlineIssuingCertificateEnvelope,
      "online_enrollment_issuer");
    const offline = issuingPayload(bundle.payload.offlineIssuingCertificateEnvelope,
      "offline_bundle_issuer");
    if (!online || !offline || online.value.caSeriesId !== offline.value.caSeriesId ||
        online.value.rootKeyId !== offline.value.rootKeyId ||
        online.value.trustEpoch !== offline.value.trustEpoch) {
      return response("blocked", "offline_enrollment_bundle_ca_chain_invalid");
    }
    const commonCaInput = {
      rootTrustSet: input.rootTrustSet,
      revocationEnvelope: bundle.payload.revocationEnvelope,
      evaluationTime: input.evaluationTime
    };
    const onlineState = verifyProvisioningCaStateCandidate({
      ...commonCaInput,
      issuingCertificateEnvelope: bundle.payload.onlineIssuingCertificateEnvelope
    });
    const offlineState = verifyProvisioningCaStateCandidate({
      ...commonCaInput,
      issuingCertificateEnvelope: bundle.payload.offlineIssuingCertificateEnvelope
    });
    if (onlineState.status !== "candidate" || offlineState.status !== "candidate") {
      return response("blocked", "offline_enrollment_bundle_ca_state_invalid");
    }
    const flow = verifyInitialEnrollmentFlowCandidate({
      challenge: bundle.payload.challenge,
      requestEnvelope: bundle.payload.requestEnvelope,
      certificateEnvelope: bundle.payload.certificateEnvelope,
      issuerSpkiDer: online.spkiDer
    });
    if (flow.status !== "candidate") {
      return response("blocked", "offline_enrollment_bundle_enrollment_flow_invalid");
    }
    const request = bundle.payload.requestEnvelope?.payload;
    const certificate = bundle.payload.certificateEnvelope?.payload;
    const calculatedRequestHash = requestHash(bundle.payload.requestEnvelope);
    if (!request || !certificate || !calculatedRequestHash ||
        bundle.payload.requestHash !== calculatedRequestHash ||
        bundle.payload.platformScopeId !== request.platformScopeId ||
        bundle.payload.provisionerIdentityHash !== request.provisionerIdentityHash ||
        bundle.payload.installationKeyId !== request.installationKeyId ||
        certificate.platformScopeId !== bundle.payload.platformScopeId ||
        certificate.provisionerIdentityHash !== bundle.payload.provisionerIdentityHash ||
        certificate.installationKeyId !== bundle.payload.installationKeyId ||
        Date.parse(bundle.payload.issuedAt) < Date.parse(certificate.issuedAt)) {
      return response("blocked", "offline_enrollment_bundle_binding_mismatch");
    }
    const now = Date.parse(input.evaluationTime);
    if (now < Date.parse(bundle.payload.issuedAt) || now >= Date.parse(bundle.payload.expiresAt)) {
      return response("blocked", "offline_enrollment_bundle_not_current");
    }
    const framed = frame(OFFLINE_ENROLLMENT_BUNDLE_DOMAIN, bundle.payload);
    if (!framed || bundle.signature.keyId !== offline.value.keyId ||
        verifyProvisioningEd25519Base64urlCandidate({
          spkiDer: offline.spkiDer,
          message: framed.message,
          signatureBase64url: bundle.signature.signature
        }).status !== "candidate") {
      return response("blocked", "offline_enrollment_bundle_signature_invalid");
    }
    return response(
      "candidate",
      "runtime_owned_ca_trust_rollback_clock_replay_ledger_and_import_effect_required",
      {
        bundleHash: framed.hash,
        requestHash: calculatedRequestHash,
        certificateCryptographicMatch: true,
        offlineBundleCryptographicMatch: true
      }
    );
  } catch {
    return response("blocked", "offline_enrollment_bundle_input_invalid");
  }
}

export function describeOfflineEnrollmentBundlePureCoreContract() {
  return Object.freeze({
    contract: "crdd-coordinator/offline-enrollment-bundle-pure-core",
    contractRevision: OFFLINE_ENROLLMENT_BUNDLE_CONTRACT_REVISION,
    bundleContract: OFFLINE_ENROLLMENT_BUNDLE_CONTRACT,
    bundleEnvelopeContract: OFFLINE_ENROLLMENT_BUNDLE_ENVELOPE_CONTRACT,
    domain: OFFLINE_ENROLLMENT_BUNDLE_DOMAIN,
    maximumValidityDays: 7,
    caChain: "exact_online_enrollment_issuer_then_offline_bundle_issuer_same_root_series_and_epoch",
    signatureAlgorithm: "Ed25519",
    objectContractAndCryptographicVerification: "implemented_candidate",
    rawByteDecoderAndTransport: "not_implemented",
    oneTimeConsumptionLedger: "not_implemented",
    runtimeOwnedCaTrustRollbackAndClock: "not_implemented",
    filesystemImportEffect: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false
  });
}
