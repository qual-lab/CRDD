import { createHash } from "node:crypto";

import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "./provisioning-signature-primitives.ts";

export const PLATFORM_PROVISIONER_RELEASE_FLOOR_CONTRACT =
  "crdd-coordinator/platform-provisioner-release-floor";
export const PLATFORM_PROVISIONER_RELEASE_FLOOR_REVISION = 1;
export const PLATFORM_PROVISIONER_RELEASE_FLOOR_DOMAIN =
  "CRDD\0PLATFORM-PROVISIONER-RELEASE-FLOOR\0V1\0";

const RELEASE_KEYS = new Set([
  "manifestHash",
  "releaseSequence",
  "crddVersion",
  "crddCommit",
  "crddTree",
]);
const FLOOR_KEYS = new Set([
  "contract",
  "contractRevision",
  "manifestHash",
  "releaseSequence",
  "crddVersion",
  "crddCommit",
  "crddTree",
  "floorHash",
]);
const INPUT_KEYS = new Set(["currentFloor", "verifiedRelease"]);
const HEX64 = /^[0-9a-f]{64}$/u;
const GIT_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const CRDD_VERSION = /^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]{1,64})?$/u;

type ReleaseIdentity = Readonly<{
  manifestHash: string;
  releaseSequence: number;
  crddVersion: string;
  crddCommit: string;
  crddTree: string;
}>;

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    releaseSequence: null,
    floorHash: null,
    persistenceRequired: false,
    rollbackFloorConfirmed: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}

function normalizeRelease(raw: unknown): ReleaseIdentity | null {
  const value = snapshotPlainRecord(raw, RELEASE_KEYS);
  if (
    !value ||
    typeof value.manifestHash !== "string" ||
    !HEX64.test(value.manifestHash) ||
    typeof value.releaseSequence !== "number" ||
    !Number.isSafeInteger(value.releaseSequence) ||
    value.releaseSequence < 1 ||
    typeof value.crddVersion !== "string" ||
    !CRDD_VERSION.test(value.crddVersion) ||
    typeof value.crddCommit !== "string" ||
    !GIT_OBJECT_ID.test(value.crddCommit) ||
    typeof value.crddTree !== "string" ||
    !GIT_OBJECT_ID.test(value.crddTree)
  ) {
    return null;
  }
  return Object.freeze({
    manifestHash: value.manifestHash,
    releaseSequence: value.releaseSequence,
    crddVersion: value.crddVersion,
    crddCommit: value.crddCommit,
    crddTree: value.crddTree,
  });
}

function floorValue(release: ReleaseIdentity) {
  return Object.freeze({
    contract: PLATFORM_PROVISIONER_RELEASE_FLOOR_CONTRACT,
    contractRevision: PLATFORM_PROVISIONER_RELEASE_FLOOR_REVISION,
    ...release,
  });
}

function calculateFloorHash(value: ReturnType<typeof floorValue>) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(value);
  if (canonical.status !== "candidate") return null;
  const domain = Buffer.from(
    PLATFORM_PROVISIONER_RELEASE_FLOOR_DOMAIN,
    "ascii",
  );
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.canonicalBytes.length));
  return createHash("sha256")
    .update(domain)
    .update(length)
    .update(canonical.canonicalBytes)
    .digest("hex");
}

function normalizeFloor(raw: unknown) {
  const value = snapshotPlainRecord(raw, FLOOR_KEYS);
  if (!value) return null;
  if (
    value.contract !== PLATFORM_PROVISIONER_RELEASE_FLOOR_CONTRACT ||
    value.contractRevision !== PLATFORM_PROVISIONER_RELEASE_FLOOR_REVISION ||
    typeof value.floorHash !== "string" ||
    !HEX64.test(value.floorHash)
  ) {
    return null;
  }
  const release = normalizeRelease({
    manifestHash: value.manifestHash,
    releaseSequence: value.releaseSequence,
    crddVersion: value.crddVersion,
    crddCommit: value.crddCommit,
    crddTree: value.crddTree,
  });
  if (!release) return null;
  const normalizedValue = floorValue(release);
  const expectedHash = calculateFloorHash(normalizedValue);
  return expectedHash === value.floorHash
    ? Object.freeze({ ...normalizedValue, floorHash: expectedHash })
    : null;
}

function sameRelease(left: ReleaseIdentity, right: ReleaseIdentity) {
  return (
    left.manifestHash === right.manifestHash &&
    left.releaseSequence === right.releaseSequence &&
    left.crddVersion === right.crddVersion &&
    left.crddCommit === right.crddCommit &&
    left.crddTree === right.crddTree
  );
}

export function evaluatePlatformProvisionerReleaseFloorCandidate(
  rawInput: unknown,
) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    const release = input && normalizeRelease(input.verifiedRelease);
    if (!input || !release) return blocked("release_floor_input_invalid");
    const current =
      input.currentFloor === null ? null : normalizeFloor(input.currentFloor);
    if (input.currentFloor !== null && !current) {
      return blocked("release_floor_current_state_invalid");
    }
    if (current && release.releaseSequence < current.releaseSequence) {
      return blocked("release_floor_rollback_rejected");
    }
    if (
      current &&
      release.releaseSequence === current.releaseSequence &&
      !sameRelease(current, release)
    ) {
      return blocked("release_floor_same_sequence_identity_mismatch");
    }
    const nextValue = floorValue(release);
    const floorHash = calculateFloorHash(nextValue);
    if (!floorHash) return blocked("release_floor_state_invalid");
    const isPersistenceRequired =
      current === null || !sameRelease(current, release);
    return Object.freeze({
      status: "candidate" as const,
      reason: isPersistenceRequired
        ? "release_floor_persistence_required"
        : "release_floor_current_identity_matches",
      releaseSequence: release.releaseSequence,
      floorHash,
      nextFloor: Object.freeze({ ...nextValue, floorHash }),
      persistenceRequired: isPersistenceRequired,
      rollbackFloorConfirmed: !isPersistenceRequired,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("release_floor_input_invalid");
  }
}

export function describePlatformProvisionerReleaseFloorContract() {
  return Object.freeze({
    contract: PLATFORM_PROVISIONER_RELEASE_FLOOR_CONTRACT,
    contractRevision: PLATFORM_PROVISIONER_RELEASE_FLOOR_REVISION,
    domain: PLATFORM_PROVISIONER_RELEASE_FLOOR_DOMAIN,
    ordering: "strictly_monotonic_positive_safe_integer_release_sequence",
    sameSequencePolicy: "exact_release_identity_required",
    lowerSequencePolicy: "blocked_as_rollback",
    firstObservation: "candidate_persistence_required",
    persistedMatch: "candidate_without_persistence",
    stateHashVerification: "implemented_candidate",
    transitionEvaluation: "implemented_candidate",
    persistence: "not_implemented",
    callerStateMayConferAuthority: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}
