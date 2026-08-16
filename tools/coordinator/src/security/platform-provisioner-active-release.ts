import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";

import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "./provisioning-signature-primitives.ts";

export const PLATFORM_PROVISIONER_ACTIVE_RELEASE_CONTRACT =
  "crdd-coordinator/platform-provisioner-active-release";
export const PLATFORM_PROVISIONER_ACTIVE_RELEASE_REVISION = 1;
export const PLATFORM_PROVISIONER_ACTIVE_RELEASE_DOMAIN =
  "CRDD\0PLATFORM-PROVISIONER-ACTIVE-RELEASE\0V1\0";

const RELEASE_KEYS = new Set([
  "manifestHash",
  "releaseSequence",
  "crddVersion",
  "crddCommit",
  "crddTree",
  "packageContentRootSha256",
]);
const FLOOR_KEYS = new Set(["floorHash", "releaseSequence"]);
const ACTIVE_KEYS = new Set([
  "contract",
  "contractRevision",
  "manifestHash",
  "releaseSequence",
  "crddVersion",
  "crddCommit",
  "crddTree",
  "packageContentRootSha256",
  "floorHash",
  "activeHash",
]);
const INPUT_KEYS = new Set(["verifiedRelease", "confirmedFloor"]);
const HEX64 = /^[0-9a-f]{64}$/u;
const GIT_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const CRDD_VERSION = /^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]{1,64})?$/u;
const MAXIMUM_ACTIVE_RELEASE_BYTES = 8_192;
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get as () => number;

type ReleaseIdentity = Readonly<{
  manifestHash: string;
  releaseSequence: number;
  crddVersion: string;
  crddCommit: string;
  crddTree: string;
  packageContentRootSha256: string;
}>;

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    releaseSequence: null,
    activeHash: null,
    activationPersistenceRequired: false,
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
    !GIT_OBJECT_ID.test(value.crddTree) ||
    typeof value.packageContentRootSha256 !== "string" ||
    !HEX64.test(value.packageContentRootSha256)
  ) {
    return null;
  }
  return Object.freeze({
    manifestHash: value.manifestHash,
    releaseSequence: value.releaseSequence,
    crddVersion: value.crddVersion,
    crddCommit: value.crddCommit,
    crddTree: value.crddTree,
    packageContentRootSha256: value.packageContentRootSha256,
  });
}

function activeValue(release: ReleaseIdentity, floorHash: string) {
  return Object.freeze({
    contract: PLATFORM_PROVISIONER_ACTIVE_RELEASE_CONTRACT,
    contractRevision: PLATFORM_PROVISIONER_ACTIVE_RELEASE_REVISION,
    ...release,
    floorHash,
  });
}

function calculateActiveHash(value: ReturnType<typeof activeValue>) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(value);
  if (canonical.status !== "candidate") return null;
  const domain = Buffer.from(
    PLATFORM_PROVISIONER_ACTIVE_RELEASE_DOMAIN,
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

function normalizeActiveRelease(raw: unknown) {
  const value = snapshotPlainRecord(raw, ACTIVE_KEYS);
  if (
    !value ||
    value.contract !== PLATFORM_PROVISIONER_ACTIVE_RELEASE_CONTRACT ||
    value.contractRevision !== PLATFORM_PROVISIONER_ACTIVE_RELEASE_REVISION ||
    typeof value.floorHash !== "string" ||
    !HEX64.test(value.floorHash) ||
    typeof value.activeHash !== "string" ||
    !HEX64.test(value.activeHash)
  ) {
    return null;
  }
  const release = normalizeRelease({
    manifestHash: value.manifestHash,
    releaseSequence: value.releaseSequence,
    crddVersion: value.crddVersion,
    crddCommit: value.crddCommit,
    crddTree: value.crddTree,
    packageContentRootSha256: value.packageContentRootSha256,
  });
  if (!release) return null;
  const normalized = activeValue(release, value.floorHash);
  const activeHash = calculateActiveHash(normalized);
  return activeHash === value.activeHash
    ? Object.freeze({ ...normalized, activeHash })
    : null;
}

export function encodePlatformProvisionerActiveReleaseCandidate(raw: unknown) {
  try {
    const activeRelease = normalizeActiveRelease(raw);
    if (!activeRelease) return blocked("active_release_state_invalid");
    const canonical = canonicalizeProvisioningJsonValueCandidate(activeRelease);
    if (
      canonical.status !== "candidate" ||
      canonical.canonicalBytes.length > MAXIMUM_ACTIVE_RELEASE_BYTES
    ) {
      return blocked("active_release_state_invalid");
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "active_release_canonical_bytes_encoded",
      canonicalBytes: Buffer.from(canonical.canonicalBytes),
      activeRelease,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("active_release_state_invalid");
  }
}

export function decodePlatformProvisionerActiveReleaseBytesCandidate(
  rawBytes: unknown,
) {
  try {
    if (!Buffer.isBuffer(rawBytes)) {
      return blocked("active_release_bytes_required");
    }
    const byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, rawBytes, []);
    if (byteLength < 1 || byteLength > MAXIMUM_ACTIVE_RELEASE_BYTES) {
      return blocked("active_release_bytes_invalid");
    }
    const ownedBytes = Buffer.allocUnsafe(byteLength);
    Buffer.prototype.copy.call(rawBytes, ownedBytes);
    if (
      ownedBytes.length >= 3 &&
      ownedBytes[0] === 0xef &&
      ownedBytes[1] === 0xbb &&
      ownedBytes[2] === 0xbf
    ) {
      return blocked("active_release_bytes_invalid");
    }
    const parsed = JSON.parse(utf8Decoder.decode(ownedBytes));
    const encoded = encodePlatformProvisionerActiveReleaseCandidate(parsed);
    if (
      encoded.status !== "candidate" ||
      !Buffer.prototype.equals.call(ownedBytes, encoded.canonicalBytes)
    ) {
      return blocked("active_release_bytes_noncanonical");
    }
    return encoded;
  } catch {
    return blocked("active_release_bytes_invalid");
  }
}

export function evaluatePlatformProvisionerActiveReleaseCandidate(
  rawInput: unknown,
) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    const release = input && normalizeRelease(input.verifiedRelease);
    const floor =
      input && snapshotPlainRecord(input.confirmedFloor, FLOOR_KEYS);
    if (
      !input ||
      !release ||
      !floor ||
      typeof floor.floorHash !== "string" ||
      !HEX64.test(floor.floorHash) ||
      floor.releaseSequence !== release.releaseSequence
    ) {
      return blocked("active_release_input_invalid");
    }
    const value = activeValue(release, floor.floorHash);
    const activeHash = calculateActiveHash(value);
    if (!activeHash) return blocked("active_release_state_invalid");
    return Object.freeze({
      status: "candidate" as const,
      reason: "active_release_persistence_required",
      releaseSequence: release.releaseSequence,
      activeHash,
      nextActiveRelease: Object.freeze({ ...value, activeHash }),
      activationPersistenceRequired: true,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("active_release_input_invalid");
  }
}

export function describePlatformProvisionerActiveReleaseContract() {
  return Object.freeze({
    contract: PLATFORM_PROVISIONER_ACTIVE_RELEASE_CONTRACT,
    contractRevision: PLATFORM_PROVISIONER_ACTIVE_RELEASE_REVISION,
    domain: PLATFORM_PROVISIONER_ACTIVE_RELEASE_DOMAIN,
    releaseIdentityBinding:
      "manifest_sequence_version_commit_tree_and_package_content_root",
    rollbackFloorBinding: "exact_release_sequence_and_floor_hash_required",
    canonicalByteCodec: "implemented_candidate",
    canonicalByteLimit: MAXIMUM_ACTIVE_RELEASE_BYTES,
    persistence: "dedicated_store_required",
    repositoryRuntimeStateRequired: false,
    compatibilityState: "prohibited",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}
