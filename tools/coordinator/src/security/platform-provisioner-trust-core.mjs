import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  canonicalizeProvisioningJsonValueCandidate,
  inspectProvisioningEd25519SpkiCandidate,
  PROVISIONING_SIGNATURE_INPUT_LIMITS,
  verifyProvisioningEd25519Base64urlCandidate
} from "./provisioning-signature-primitives.mjs";
import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";

export const PLATFORM_PROVISIONER_MANIFEST_REVISION = 1;
export const PLATFORM_PROVISIONER_MANIFEST_CONTRACT =
  "crdd-coordinator/platform-provisioner-manifest";
export const PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT =
  "crdd-coordinator/platform-provisioner-manifest-envelope";
export const PLATFORM_PROVISIONER_MANIFEST_DOMAIN =
  "CRDD\0PLATFORM-PROVISIONER-MANIFEST\0V1\0";

const MANIFEST_KEYS = new Set([
  "contract", "contractRevision", "platform", "architecture", "provisionerVersion",
  "executableSha256", "rootProtectionPolicySha256", "keyStoragePolicySha256",
  "issuedAt", "expiresAt"
]);
const ENVELOPE_KEYS = new Set(["contract", "contractRevision", "payload", "signatures"]);
const SIGNATURE_KEYS = new Set(["keyId", "algorithm", "signature"]);
const VERIFY_KEYS = new Set([
  "manifestEnvelope", "releaseSignerSpkiDer", "observedExecutableSha256", "evaluationTime"
]);
const HEX64 = /^[0-9a-f]{64}$/u;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]{1,64})?$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const PLATFORMS = new Set(["windows", "macos", "linux"]);
const ARCHITECTURES = new Set(["x64", "arm64"]);
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype), "byteLength"
).get;

function response(status, reason, fields = {}) {
  return Object.freeze({
    status,
    reason,
    ...fields,
    runtimeOwnedReleaseTrustConfirmed: false,
    osNativeCodeSignatureConfirmed: false,
    runtimeOwnedExecutableDigestConfirmed: false,
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

function normalizeManifest(raw) {
  const value = snapshotPlainRecord(raw, MANIFEST_KEYS);
  if (!value || value.contract !== PLATFORM_PROVISIONER_MANIFEST_CONTRACT ||
      value.contractRevision !== PLATFORM_PROVISIONER_MANIFEST_REVISION ||
      !PLATFORMS.has(value.platform) || !ARCHITECTURES.has(value.architecture) ||
      typeof value.provisionerVersion !== "string" || value.provisionerVersion.length > 96 ||
      !VERSION.test(value.provisionerVersion) || !HEX64.test(value.executableSha256) ||
      !HEX64.test(value.rootProtectionPolicySha256) ||
      !HEX64.test(value.keyStoragePolicySha256) || !utc(value.issuedAt) || !utc(value.expiresAt) ||
      Date.parse(value.expiresAt) <= Date.parse(value.issuedAt)) return null;
  return value;
}

function normalizeSignature(raw) {
  const value = snapshotPlainRecord(raw, SIGNATURE_KEYS);
  if (!value || !HEX64.test(value.keyId) || value.algorithm !== "Ed25519" ||
      typeof value.signature !== "string" || value.signature.length !== 86 ||
      !BASE64URL.test(value.signature)) return null;
  const bytes = Buffer.from(value.signature, "base64url");
  return bytes.length === 64 && bytes.toString("base64url") === value.signature ? value : null;
}

function normalizeEnvelope(raw) {
  const value = snapshotPlainRecord(raw, ENVELOPE_KEYS);
  if (!value || value.contract !== PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT ||
      value.contractRevision !== PLATFORM_PROVISIONER_MANIFEST_REVISION ||
      !Array.isArray(value.signatures) || utilTypes.isProxy(value.signatures) ||
      Object.getPrototypeOf(value.signatures) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(value.signatures, "length");
  const entry = Object.getOwnPropertyDescriptor(value.signatures, "0");
  if (!length || length.value !== 1 || length.enumerable || length.configurable ||
      Reflect.ownKeys(value.signatures).length !== 2 || !entry || !entry.enumerable ||
      !("value" in entry) || entry.get || entry.set) return null;
  const payload = normalizeManifest(value.payload);
  const signature = normalizeSignature(entry.value);
  return payload && signature ? Object.freeze({ value, payload, signature }) : null;
}

function frame(payload) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(payload);
  if (canonical.status !== "candidate") return null;
  const prefix = Buffer.from(PLATFORM_PROVISIONER_MANIFEST_DOMAIN, "ascii");
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.canonicalBytes.length));
  const message = Buffer.concat([prefix, length, canonical.canonicalBytes]);
  return Object.freeze({
    message,
    manifestHash: createHash("sha256").update(message).digest("hex")
  });
}

function snapshotSignerSpki(raw) {
  if (!Buffer.isBuffer(raw)) return null;
  const length = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, raw, []);
  if (length > PROVISIONING_SIGNATURE_INPUT_LIMITS.spkiDerBytes) return null;
  const owned = Buffer.allocUnsafe(length);
  Uint8Array.prototype.set.call(owned, raw);
  return owned;
}

export function verifyPlatformProvisionerManifestCandidate(rawInput) {
  try {
    const input = snapshotPlainRecord(rawInput, VERIFY_KEYS);
    if (!input || !HEX64.test(input.observedExecutableSha256) || !utc(input.evaluationTime)) {
      return response("blocked", "platform_provisioner_manifest_input_invalid");
    }
    const ownedSigner = snapshotSignerSpki(input.releaseSignerSpkiDer);
    const envelope = normalizeEnvelope(input.manifestEnvelope);
    const signer = envelope && ownedSigner && inspectProvisioningEd25519SpkiCandidate(ownedSigner);
    const framed = envelope && frame(envelope.payload);
    if (!envelope || !signer || signer.status !== "candidate" || !framed ||
        envelope.signature.keyId !== signer.spkiSha256Digest.toString("hex") ||
        envelope.payload.executableSha256 !== input.observedExecutableSha256) {
      return response("blocked", "platform_provisioner_manifest_or_digest_mismatch");
    }
    if (Date.parse(input.evaluationTime) < Date.parse(envelope.payload.issuedAt) ||
        Date.parse(input.evaluationTime) >= Date.parse(envelope.payload.expiresAt)) {
      return response("blocked", "platform_provisioner_manifest_not_current");
    }
    const verified = verifyProvisioningEd25519Base64urlCandidate({
      spkiDer: ownedSigner,
      message: framed.message,
      signatureBase64url: envelope.signature.signature
    });
    if (verified.status !== "candidate") {
      return response("blocked", "platform_provisioner_manifest_signature_mismatch");
    }
    return response("candidate",
      "runtime_owned_release_trust_executable_digest_and_os_native_signature_required", {
        manifestHash: framed.manifestHash,
        platform: envelope.payload.platform,
        architecture: envelope.payload.architecture,
        provisionerVersion: envelope.payload.provisionerVersion,
        qualLabManifestCryptographicMatch: true
      });
  } catch {
    return response("blocked", "platform_provisioner_manifest_input_invalid");
  }
}

export function describePlatformProvisionerTrustCoreContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-trust-core",
    contractRevision: PLATFORM_PROVISIONER_MANIFEST_REVISION,
    manifestContract: PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
    envelopeContract: PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
    domain: PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
    manifestSignatureAlgorithm: "Ed25519",
    manifestSignatureCount: 1,
    manifestCryptographicVerification: "implemented_candidate",
    runtimeOwnedReleaseTrustSelection: "not_implemented",
    runtimeOwnedExecutableDigest: "not_implemented",
    windowsNativeSignatureAdapter: "not_implemented_winverifytrust_target",
    macosNativeSignatureAdapter: "not_implemented_secstaticcodecheckvalidity_target",
    linuxNativePackageSignatureAdapter: "not_implemented_distribution_specific_target",
    packagedBuildAcceptance:
      "os_native_code_signature_and_qual_lab_manifest_both_required_before_effect_target",
    localDevelopmentBehavior:
      "dry_run_and_test_only_without_trust_gate_or_filesystem_effect_target",
    explicitProvisionCommandRequired: true,
    unknownTamperedOrPermissionMismatchBehavior: "blocked_before_effect_without_fallback",
    rsaOrAlternateCurveFallback: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false
  });
}
