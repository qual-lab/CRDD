import { createHash } from "node:crypto";

import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "./provisioning-signature-primitives.ts";

export const PROVISIONING_TRUST_FLOOR_CONTRACT =
  "crdd-coordinator/provisioning-trust-floor";
export const PROVISIONING_TRUST_FLOOR_REVISION = 1;
export const PROVISIONING_TRUST_FLOOR_DOMAIN =
  "CRDD\0PROVISIONING-TRUST-FLOOR\0V1\0";
export const PROVISIONING_TRUST_FLOOR_MAXIMUM_BYTES = 4_096;

const OBSERVATION_KEYS = new Set([
  "trustEpoch",
  "trustAnchorSetHash",
  "revocationRevision",
  "revocationManifestHash",
]);
const floorKeys = new Set([
  "contract",
  "contractRevision",
  ...OBSERVATION_KEYS,
  "floorHash",
]);
const INPUT_KEYS = new Set(["currentFloor", "verifiedTrust"]);
const HEX64 = /^[a-f0-9]{64}$/u;
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get as () => number;

type TrustObservation = Readonly<{
  trustEpoch: number;
  trustAnchorSetHash: string;
  revocationRevision: number;
  revocationManifestHash: string;
}>;

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    trustEpoch: null,
    revocationRevision: null,
    floorHash: null,
    persistenceRequired: false,
    rollbackFloorConfirmed: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}

function normalizeObservation(raw: unknown): TrustObservation | null {
  const value = snapshotPlainRecord(raw, OBSERVATION_KEYS);
  if (
    !value ||
    typeof value.trustEpoch !== "number" ||
    !Number.isSafeInteger(value.trustEpoch) ||
    value.trustEpoch < 1 ||
    typeof value.trustAnchorSetHash !== "string" ||
    !HEX64.test(value.trustAnchorSetHash) ||
    typeof value.revocationRevision !== "number" ||
    !Number.isSafeInteger(value.revocationRevision) ||
    value.revocationRevision < 1 ||
    typeof value.revocationManifestHash !== "string" ||
    !HEX64.test(value.revocationManifestHash)
  ) {
    return null;
  }
  return Object.freeze({
    trustEpoch: value.trustEpoch,
    trustAnchorSetHash: value.trustAnchorSetHash,
    revocationRevision: value.revocationRevision,
    revocationManifestHash: value.revocationManifestHash,
  });
}

function floorValue(observation: TrustObservation) {
  return Object.freeze({
    contract: PROVISIONING_TRUST_FLOOR_CONTRACT,
    contractRevision: PROVISIONING_TRUST_FLOOR_REVISION,
    ...observation,
  });
}

function calculateFloorHash(value: ReturnType<typeof floorValue>) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(value);
  if (canonical.status !== "candidate") return null;
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.canonicalBytes.length));
  return createHash("sha256")
    .update(Buffer.from(PROVISIONING_TRUST_FLOOR_DOMAIN, "ascii"))
    .update(length)
    .update(canonical.canonicalBytes)
    .digest("hex");
}

function normalizeFloor(raw: unknown) {
  const value = snapshotPlainRecord(raw, floorKeys);
  if (
    !value ||
    value.contract !== PROVISIONING_TRUST_FLOOR_CONTRACT ||
    value.contractRevision !== PROVISIONING_TRUST_FLOOR_REVISION ||
    typeof value.floorHash !== "string" ||
    !HEX64.test(value.floorHash)
  ) {
    return null;
  }
  const observation = normalizeObservation({
    trustEpoch: value.trustEpoch,
    trustAnchorSetHash: value.trustAnchorSetHash,
    revocationRevision: value.revocationRevision,
    revocationManifestHash: value.revocationManifestHash,
  });
  if (!observation) return null;
  const canonical = floorValue(observation);
  const floorHash = calculateFloorHash(canonical);
  return floorHash === value.floorHash
    ? Object.freeze({ ...canonical, floorHash })
    : null;
}

export function encodeProvisioningTrustFloorCandidate(raw: unknown) {
  try {
    const floor = normalizeFloor(raw);
    if (!floor) return blocked("provisioning_trust_floor_state_invalid");
    const encoded = canonicalizeProvisioningJsonValueCandidate(floor);
    if (
      encoded.status !== "candidate" ||
      encoded.canonicalBytes.length > PROVISIONING_TRUST_FLOOR_MAXIMUM_BYTES
    ) {
      return blocked("provisioning_trust_floor_state_invalid");
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "provisioning_trust_floor_canonical_bytes_encoded",
      floor,
      canonicalBytes: Buffer.from(encoded.canonicalBytes),
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("provisioning_trust_floor_state_invalid");
  }
}

export function decodeProvisioningTrustFloorBytesCandidate(raw: unknown) {
  try {
    if (!Buffer.isBuffer(raw))
      return blocked("provisioning_trust_floor_bytes_required");
    const byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, raw, []);
    if (byteLength < 1 || byteLength > PROVISIONING_TRUST_FLOOR_MAXIMUM_BYTES) {
      return blocked("provisioning_trust_floor_bytes_invalid");
    }
    const ownedBytes = Buffer.allocUnsafe(byteLength);
    Buffer.prototype.copy.call(raw, ownedBytes);
    if (
      ownedBytes.length >= 3 &&
      ownedBytes[0] === 0xef &&
      ownedBytes[1] === 0xbb &&
      ownedBytes[2] === 0xbf
    ) {
      return blocked("provisioning_trust_floor_bytes_invalid");
    }
    const parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(ownedBytes),
    );
    const encoded = encodeProvisioningTrustFloorCandidate(parsed);
    return encoded.status === "candidate" &&
      Buffer.prototype.equals.call(ownedBytes, encoded.canonicalBytes)
      ? encoded
      : blocked("provisioning_trust_floor_bytes_noncanonical");
  } catch {
    return blocked("provisioning_trust_floor_bytes_invalid");
  }
}

function sameObservation(left: TrustObservation, right: TrustObservation) {
  return (
    left.trustEpoch === right.trustEpoch &&
    left.trustAnchorSetHash === right.trustAnchorSetHash &&
    left.revocationRevision === right.revocationRevision &&
    left.revocationManifestHash === right.revocationManifestHash
  );
}

export function evaluateProvisioningTrustFloorCandidate(raw: unknown) {
  try {
    const input = snapshotPlainRecord(raw, INPUT_KEYS);
    const observation = input && normalizeObservation(input.verifiedTrust);
    if (!input || !observation)
      return blocked("provisioning_trust_floor_input_invalid");
    const current =
      input.currentFloor === null ? null : normalizeFloor(input.currentFloor);
    if (input.currentFloor !== null && !current) {
      return blocked("provisioning_trust_floor_current_state_invalid");
    }
    if (current && observation.trustEpoch < current.trustEpoch) {
      return blocked("provisioning_trust_floor_epoch_rollback_rejected");
    }
    if (
      current &&
      observation.trustEpoch === current.trustEpoch &&
      observation.trustAnchorSetHash !== current.trustAnchorSetHash
    ) {
      return blocked("provisioning_trust_floor_same_epoch_anchor_mismatch");
    }
    if (
      current &&
      observation.trustEpoch === current.trustEpoch &&
      observation.revocationRevision < current.revocationRevision
    ) {
      return blocked("provisioning_trust_floor_revocation_rollback_rejected");
    }
    if (
      current &&
      observation.trustEpoch === current.trustEpoch &&
      observation.revocationRevision === current.revocationRevision &&
      observation.revocationManifestHash !== current.revocationManifestHash
    ) {
      return blocked(
        "provisioning_trust_floor_same_revocation_revision_mismatch",
      );
    }
    const value = floorValue(observation);
    const floorHash = calculateFloorHash(value);
    if (!floorHash) return blocked("provisioning_trust_floor_state_invalid");
    const isPersistenceRequired =
      current === null || !sameObservation(current, observation);
    return Object.freeze({
      status: "candidate" as const,
      reason: isPersistenceRequired
        ? "provisioning_trust_floor_persistence_required"
        : "provisioning_trust_floor_current_identity_matches",
      trustEpoch: observation.trustEpoch,
      revocationRevision: observation.revocationRevision,
      floorHash,
      nextFloor: Object.freeze({ ...value, floorHash }),
      persistenceRequired: isPersistenceRequired,
      rollbackFloorConfirmed: !isPersistenceRequired,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("provisioning_trust_floor_input_invalid");
  }
}

export function describeProvisioningTrustFloorContract() {
  return Object.freeze({
    contract: PROVISIONING_TRUST_FLOOR_CONTRACT,
    contractRevision: PROVISIONING_TRUST_FLOOR_REVISION,
    domain: PROVISIONING_TRUST_FLOOR_DOMAIN,
    epochOrdering: "monotonic_positive_safe_integer",
    sameEpochPolicy: "exact_trust_anchor_set_hash_required",
    revocationOrdering: "monotonic_within_trust_epoch",
    sameRevocationRevisionPolicy: "exact_manifest_hash_required",
    newEpochPolicy: "new_anchor_hash_and_revocation_series_allowed",
    canonicalByteCodec: "implemented_candidate",
    transitionEvaluation: "implemented_candidate",
    persistence: "dedicated_store_implemented_candidate",
    callerStateMayConferAuthority: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}
