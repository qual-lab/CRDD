import { createHash, createPublicKey, verify } from "node:crypto";
import { types as utilTypes } from "node:util";

export const PROVISIONING_SIGNATURE_PRIMITIVES_CONTRACT =
  "crdd-coordinator/provisioning-signature-primitives";
export const PROVISIONING_SIGNATURE_PRIMITIVES_CONTRACT_REVISION = 1;
export const PROVISIONING_SIGNATURE_ENVELOPE_TOPOLOGY =
  "payload_and_multiple_signatures_separated_target";
export const PROVISIONING_SIGNATURE_INPUT_LIMITS = Object.freeze({
  canonicalBytes: 131_072,
  depth: 64,
  nodes: 4_096,
  stringBytes: 65_536,
  spkiDerBytes: 128,
  signatureBytes: 64
});

const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength"
).get;
const VERIFY_KEYS = new Set(["spkiDer", "message", "signature"]);
const BASE64URL_VERIFY_KEYS = new Set(["spkiDer", "message", "signatureBase64url"]);
const P256_ORDER = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
const P256_HALF_ORDER = P256_ORDER >> 1n;
const UNPADDED_BASE64URL = /^[A-Za-z0-9_-]+$/u;
const INVALID = Symbol("invalid");

class InputBudgetExceeded extends Error {}

function blocked(reason) {
  return Object.freeze({
    status: "blocked",
    reason,
    cryptographicMatch: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false
  });
}

function ownedBuffer(value, maximumLength) {
  if (!Buffer.isBuffer(value)) return null;
  const length = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, value, []);
  if (length > maximumLength) return null;
  const copy = Buffer.allocUnsafe(length);
  Uint8Array.prototype.set.call(copy, value);
  return copy;
}

function hasLoneSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return true;
  }
  return false;
}

function dataDescriptor(descriptor, enumerable = true) {
  return descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value") &&
    descriptor.get === undefined && descriptor.set === undefined &&
    (!enumerable || descriptor.enumerable === true);
}

function snapshotJsonValue(value, state, depth = 0) {
  if (depth > PROVISIONING_SIGNATURE_INPUT_LIMITS.depth ||
      state.nodes >= PROVISIONING_SIGNATURE_INPUT_LIMITS.nodes) throw new InputBudgetExceeded();
  state.nodes += 1;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : INVALID;
  if (typeof value === "string") {
    return !hasLoneSurrogate(value) &&
      Buffer.byteLength(value, "utf8") <= PROVISIONING_SIGNATURE_INPUT_LIMITS.stringBytes
      ? value : INVALID;
  }
  if (!value || typeof value !== "object" || utilTypes.isProxy(value) || state.ancestors.has(value)) {
    return INVALID;
  }
  state.ancestors.add(value);
  try {
    const prototype = Object.getPrototypeOf(value);
    if (Array.isArray(value)) {
      const length = Object.getOwnPropertyDescriptor(value, "length");
      if (prototype !== Array.prototype || !dataDescriptor(length, false) ||
          !Number.isSafeInteger(length.value) || length.value < 0) return INVALID;
      if (length.value > PROVISIONING_SIGNATURE_INPUT_LIMITS.nodes - state.nodes) {
        throw new InputBudgetExceeded();
      }
      const keys = Reflect.ownKeys(value);
      if (keys.length !== length.value + 1) return INVALID;
      const result = [];
      for (let index = 0; index < length.value; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!dataDescriptor(descriptor)) return INVALID;
        const child = snapshotJsonValue(descriptor.value, state, depth + 1);
        if (child === INVALID) return INVALID;
        result.push(child);
      }
      return Object.freeze(result);
    }
    if (prototype !== Object.prototype && prototype !== null) return INVALID;
    const keys = Reflect.ownKeys(value);
    if (keys.length > PROVISIONING_SIGNATURE_INPUT_LIMITS.nodes - state.nodes) {
      throw new InputBudgetExceeded();
    }
    if (keys.some((key) => typeof key !== "string" || hasLoneSurrogate(key) ||
      Buffer.byteLength(key, "utf8") > PROVISIONING_SIGNATURE_INPUT_LIMITS.stringBytes)) return INVALID;
    const result = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!dataDescriptor(descriptor)) return INVALID;
      const child = snapshotJsonValue(descriptor.value, state, depth + 1);
      if (child === INVALID) return INVALID;
      result[key] = child;
    }
    return Object.freeze(result);
  } finally {
    state.ancestors.delete(value);
  }
}

function boundedJcs(value) {
  const chunks = [];
  let byteLength = 0;
  const append = (chunk) => {
    const ownedChunk = Buffer.from(chunk, "utf8");
    if (byteLength + ownedChunk.length > PROVISIONING_SIGNATURE_INPUT_LIMITS.canonicalBytes) {
      throw new InputBudgetExceeded();
    }
    chunks.push(ownedChunk);
    byteLength += ownedChunk.length;
  };
  const string = (text) => {
    append("\"");
    let runStart = 0;
    const flush = (end) => {
      if (end > runStart) append(text.slice(runStart, end));
      runStart = end;
    };
    for (let index = 0; index < text.length;) {
      const unit = text.charCodeAt(index);
      let escaped = null;
      if (unit === 0x22) escaped = "\\\"";
      else if (unit === 0x5c) escaped = "\\\\";
      else if (unit === 0x08) escaped = "\\b";
      else if (unit === 0x09) escaped = "\\t";
      else if (unit === 0x0a) escaped = "\\n";
      else if (unit === 0x0c) escaped = "\\f";
      else if (unit === 0x0d) escaped = "\\r";
      else if (unit <= 0x1f) escaped = `\\u${unit.toString(16).padStart(4, "0")}`;
      const width = unit >= 0xd800 && unit <= 0xdbff ? 2 : 1;
      if (escaped !== null) {
        flush(index);
        append(escaped);
        index += width;
        runStart = index;
      } else {
        index += width;
        if (index - runStart >= 1_024) flush(index);
      }
    }
    flush(text.length);
    append("\"");
  };
  const serialize = (item) => {
    if (typeof item === "string") return string(item);
    if (item === null || typeof item === "boolean" || typeof item === "number") {
      append(JSON.stringify(item));
      return;
    }
    if (Array.isArray(item)) {
      append("[");
      item.forEach((child, index) => {
        if (index > 0) append(",");
        serialize(child);
      });
      append("]");
      return;
    }
    append("{");
    Object.keys(item).sort().forEach((key, index) => {
      if (index > 0) append(",");
      string(key);
      append(":");
      serialize(item[key]);
    });
    append("}");
  };
  serialize(value);
  return Buffer.concat(chunks, byteLength);
}

export function canonicalizeProvisioningJsonValueCandidate(rawValue) {
  try {
    const value = snapshotJsonValue(rawValue, { nodes: 0, ancestors: new WeakSet() });
    if (value === INVALID) return blocked("provisioning_jcs_value_invalid");
    const canonicalBytes = boundedJcs(value);
    return Object.freeze({
      status: "candidate",
      reason: "provisioning_record_schema_and_domain_separation_required",
      canonicalBytes,
      canonicalHash: createHash("sha256").update(canonicalBytes).digest("hex"),
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false
    });
  } catch (error) {
    if (error instanceof InputBudgetExceeded) return blocked("provisioning_jcs_budget_exceeded");
    return blocked("provisioning_jcs_value_invalid");
  }
}

function inspectSpki(input) {
  const spkiDer = ownedBuffer(input, PROVISIONING_SIGNATURE_INPUT_LIMITS.spkiDerBytes);
  if (!spkiDer) return null;
  const key = createPublicKey({ key: spkiDer, format: "der", type: "spki" });
  if (key.asymmetricKeyType !== "ed25519") return null;
  const canonicalDer = key.export({ format: "der", type: "spki" });
  if (!Buffer.prototype.equals.call(spkiDer, canonicalDer)) return null;
  return Object.freeze({ key, spkiDer });
}

function inspectP256Spki(input) {
  const spkiDer = ownedBuffer(input, PROVISIONING_SIGNATURE_INPUT_LIMITS.spkiDerBytes);
  if (!spkiDer || spkiDer.length !== 91) return null;
  const key = createPublicKey({ key: spkiDer, format: "der", type: "spki" });
  if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
    return null;
  }
  const canonicalDer = key.export({ format: "der", type: "spki" });
  if (!Buffer.prototype.equals.call(spkiDer, canonicalDer)) return null;
  return Object.freeze({ key, spkiDer });
}

function canonicalP256Signature(signature) {
  if (signature.length !== 64) return false;
  const r = BigInt(`0x${signature.subarray(0, 32).toString("hex")}`);
  const s = BigInt(`0x${signature.subarray(32).toString("hex")}`);
  return r > 0n && r < P256_ORDER && s > 0n && s <= P256_HALF_ORDER;
}

export function inspectProvisioningEd25519SpkiCandidate(input) {
  try {
    const inspected = inspectSpki(input);
    if (!inspected) return blocked("provisioning_ed25519_spki_invalid");
    return Object.freeze({
      status: "candidate",
      reason: "provisioning_trust_anchor_set_and_key_id_encoding_required",
      spkiSha256Digest: createHash("sha256").update(inspected.spkiDer).digest(),
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false
    });
  } catch {
    return blocked("provisioning_ed25519_spki_invalid");
  }
}

export function inspectProvisioningP256SpkiCandidate(input) {
  try {
    const inspected = inspectP256Spki(input);
    if (!inspected) return blocked("provisioning_p256_spki_invalid");
    return Object.freeze({
      status: "candidate",
      reason: "provisioning_hardware_key_binding_and_key_id_encoding_required",
      spkiSha256Digest: createHash("sha256").update(inspected.spkiDer).digest(),
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false
    });
  } catch {
    return blocked("provisioning_p256_spki_invalid");
  }
}

function snapshotExactInput(value, expectedKeys) {
  if (!value || typeof value !== "object" || utilTypes.isProxy(value) || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== expectedKeys.size || keys.some((key) =>
    typeof key !== "string" || !expectedKeys.has(key) || !dataDescriptor(descriptors[key]))) return null;
  return Object.freeze(Object.fromEntries(
    [...expectedKeys].map((key) => [key, descriptors[key].value])
  ));
}

export function verifyProvisioningEd25519PrimitiveCandidate(rawInput) {
  try {
    const input = snapshotExactInput(rawInput, VERIFY_KEYS);
    if (!input) return blocked("provisioning_ed25519_input_invalid");
    const inspected = inspectSpki(input.spkiDer);
    const message = ownedBuffer(input.message, PROVISIONING_SIGNATURE_INPUT_LIMITS.canonicalBytes);
    const signature = ownedBuffer(input.signature, PROVISIONING_SIGNATURE_INPUT_LIMITS.signatureBytes);
    if (!inspected || !message || !signature ||
        signature.length !== PROVISIONING_SIGNATURE_INPUT_LIMITS.signatureBytes) {
      return blocked("provisioning_ed25519_input_invalid");
    }
    if (!verify(null, message, inspected.key, signature)) {
      return blocked("provisioning_ed25519_cryptographic_mismatch");
    }
    return Object.freeze({
      status: "candidate",
      reason: "provisioning_domain_trust_revocation_and_envelope_verification_required",
      cryptographicMatch: true,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false
    });
  } catch {
    return blocked("provisioning_ed25519_input_invalid");
  }
}

export function verifyProvisioningEd25519Base64urlCandidate(rawInput) {
  try {
    const input = snapshotExactInput(rawInput, BASE64URL_VERIFY_KEYS);
    if (!input || typeof input.signatureBase64url !== "string" ||
        input.signatureBase64url.length !== 86 ||
        !UNPADDED_BASE64URL.test(input.signatureBase64url)) {
      return blocked("provisioning_ed25519_base64url_input_invalid");
    }
    const signature = Buffer.from(input.signatureBase64url, "base64url");
    if (signature.length !== PROVISIONING_SIGNATURE_INPUT_LIMITS.signatureBytes ||
        signature.toString("base64url") !== input.signatureBase64url) {
      return blocked("provisioning_ed25519_base64url_input_invalid");
    }
    return verifyProvisioningEd25519PrimitiveCandidate({
      spkiDer: input.spkiDer,
      message: input.message,
      signature
    });
  } catch {
    return blocked("provisioning_ed25519_base64url_input_invalid");
  }
}

export function verifyProvisioningP256Base64urlCandidate(rawInput) {
  try {
    const input = snapshotExactInput(rawInput, BASE64URL_VERIFY_KEYS);
    if (!input || typeof input.signatureBase64url !== "string" ||
        input.signatureBase64url.length !== 86 ||
        !UNPADDED_BASE64URL.test(input.signatureBase64url)) {
      return blocked("provisioning_p256_base64url_input_invalid");
    }
    const signature = Buffer.from(input.signatureBase64url, "base64url");
    if (signature.length !== PROVISIONING_SIGNATURE_INPUT_LIMITS.signatureBytes ||
        signature.toString("base64url") !== input.signatureBase64url) {
      return blocked("provisioning_p256_base64url_input_invalid");
    }
    if (!canonicalP256Signature(signature)) {
      return blocked("provisioning_p256_signature_noncanonical");
    }
    const inspected = inspectP256Spki(input.spkiDer);
    const message = ownedBuffer(input.message, PROVISIONING_SIGNATURE_INPUT_LIMITS.canonicalBytes);
    if (!inspected || !message || !verify("sha256", message, {
      key: inspected.key,
      dsaEncoding: "ieee-p1363"
    }, signature)) {
      return blocked(inspected && message
        ? "provisioning_p256_cryptographic_mismatch"
        : "provisioning_p256_input_invalid");
    }
    return Object.freeze({
      status: "candidate",
      reason: "provisioning_domain_trust_revocation_and_envelope_verification_required",
      cryptographicMatch: true,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false
    });
  } catch {
    return blocked("provisioning_p256_input_invalid");
  }
}

export function describeProvisioningSignaturePrimitivesContract() {
  return Object.freeze({
    contract: PROVISIONING_SIGNATURE_PRIMITIVES_CONTRACT,
    contractRevision: PROVISIONING_SIGNATURE_PRIMITIVES_CONTRACT_REVISION,
    jcsValueCanonicalization: "implemented_candidate_rfc_8785",
    rawJsonDuplicateKeyDecoder: "not_implemented",
    ed25519SpkiDerInspection: "implemented_candidate_rfc_8410",
    spkiSha256Digest: "implemented_candidate_not_key_id_encoding",
    ed25519PrimitiveVerification: "implemented_candidate_rfc_8032",
    ed25519SignatureBase64url: "implemented_candidate_rfc_4648_unpadded",
    p256SpkiDerInspection: "implemented_candidate_sec1_rfc_5480",
    p256PrimitiveVerification: "implemented_candidate_ecdsa_sha256_ieee_p1363",
    p256SignatureBase64url: "implemented_candidate_low_s_ieee_p1363_rfc_4648_unpadded",
    keyIdEncoding: "implemented_candidate_in_provisioning_record_pure_core",
    payloadSignatureEnvelopeTopology: PROVISIONING_SIGNATURE_ENVELOPE_TOPOLOGY,
    crddDomainSeparationFraming: "implemented_candidate_in_provisioning_record_pure_core",
    provisioningRecordPayloadSchema: "implemented_candidate_in_provisioning_record_pure_core",
    multiSignatureEnvelopeSchema: "implemented_candidate_in_provisioning_record_pure_core",
    multiSignatureAcceptanceRule: "implemented_candidate_in_provisioning_record_pure_core",
    multiSignatureAcceptancePolicy:
      "one_or_more_trusted_non_revoked_valid_and_no_unknown_revoked_duplicate_or_invalid_target",
    offlineBundledTrustEvaluation: "required_target_not_implemented",
    embeddedTrustAnchorSet: "candidate_codec_only_untrusted_input_in_provisioning_record_pure_core",
    revocationManifest: "candidate_codec_only_untrusted_input_in_provisioning_record_pure_core",
    aggregateRecordVerifier: "candidate_cryptographic_condition_only_in_provisioning_record_pure_core",
    existingCanonicalContractsMigratedToJcs: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  });
}
