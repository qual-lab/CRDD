import { createHash, createPublicKey, verify } from "node:crypto";
import { types as utilTypes } from "node:util";

export const PROVISIONING_SIGNATURE_PRIMITIVES_CONTRACT =
  "crdd-coordinator/provisioning-signature-primitives";
export const PROVISIONING_SIGNATURE_PRIMITIVES_CONTRACT_REVISION = 1;
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
      state.nodes >= PROVISIONING_SIGNATURE_INPUT_LIMITS.nodes) return null;
  state.nodes += 1;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    return !hasLoneSurrogate(value) &&
      Buffer.byteLength(value, "utf8") <= PROVISIONING_SIGNATURE_INPUT_LIMITS.stringBytes
      ? value : null;
  }
  if (!value || typeof value !== "object" || utilTypes.isProxy(value) || state.seen.has(value)) {
    return null;
  }
  state.seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (Array.isArray(value)) {
    const length = descriptors.length;
    if (prototype !== Array.prototype || !dataDescriptor(length, false) ||
        !Number.isSafeInteger(length.value) || length.value < 0 ||
        keys.length !== length.value + 1) return null;
    const result = [];
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!dataDescriptor(descriptor)) return null;
      const child = snapshotJsonValue(descriptor.value, state, depth + 1);
      if (child === null && descriptor.value !== null) return null;
      result.push(child);
    }
    return Object.freeze(result);
  }
  if (prototype !== Object.prototype && prototype !== null) return null;
  if (keys.some((key) => typeof key !== "string" || !dataDescriptor(descriptors[key]) ||
    hasLoneSurrogate(key) ||
    Buffer.byteLength(key, "utf8") > PROVISIONING_SIGNATURE_INPUT_LIMITS.stringBytes)) return null;
  const result = Object.create(null);
  for (const key of keys) {
    const child = snapshotJsonValue(descriptors[key].value, state, depth + 1);
    if (child === null && descriptors[key].value !== null) return null;
    result[key] = child;
  }
  return Object.freeze(result);
}

function serializeJcs(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(serializeJcs).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${serializeJcs(value[key])}`).join(",")}}`;
}

export function canonicalizeProvisioningJsonValueCandidate(rawValue) {
  try {
    const value = snapshotJsonValue(rawValue, { nodes: 0, seen: new WeakSet() });
    if (value === null && rawValue !== null) return blocked("provisioning_jcs_value_invalid");
    const source = serializeJcs(value);
    const canonicalBytes = Buffer.from(source, "utf8");
    if (canonicalBytes.length > PROVISIONING_SIGNATURE_INPUT_LIMITS.canonicalBytes) {
      return blocked("provisioning_jcs_bytes_exceeded");
    }
    return Object.freeze({
      status: "candidate",
      reason: "provisioning_record_schema_and_domain_separation_required",
      canonicalBytes,
      canonicalHash: createHash("sha256").update(canonicalBytes).digest("hex"),
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false
    });
  } catch {
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

function snapshotVerifyInput(value) {
  if (!value || typeof value !== "object" || utilTypes.isProxy(value) || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== VERIFY_KEYS.size || keys.some((key) =>
    typeof key !== "string" || !VERIFY_KEYS.has(key) || !dataDescriptor(descriptors[key]))) return null;
  return Object.freeze(Object.fromEntries([...VERIFY_KEYS].map((key) => [key, descriptors[key].value])));
}

export function verifyProvisioningEd25519PrimitiveCandidate(rawInput) {
  try {
    const input = snapshotVerifyInput(rawInput);
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

export function describeProvisioningSignaturePrimitivesContract() {
  return Object.freeze({
    contract: PROVISIONING_SIGNATURE_PRIMITIVES_CONTRACT,
    contractRevision: PROVISIONING_SIGNATURE_PRIMITIVES_CONTRACT_REVISION,
    jcsValueCanonicalization: "implemented_candidate_rfc_8785",
    rawJsonDuplicateKeyDecoder: "not_implemented",
    ed25519SpkiDerInspection: "implemented_candidate_rfc_8410",
    spkiSha256Digest: "implemented_candidate_not_key_id_encoding",
    ed25519PrimitiveVerification: "implemented_candidate_rfc_8032",
    crddDomainSeparationFraming: "not_implemented",
    provisioningRecordPayloadSchema: "not_implemented",
    multiSignatureEnvelopeSchema: "not_implemented",
    embeddedTrustAnchorSet: "not_implemented",
    revocationManifest: "not_implemented",
    aggregateRecordVerifier: "not_implemented",
    existingCanonicalContractsMigratedToJcs: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  });
}
