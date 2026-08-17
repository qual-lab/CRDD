import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";

import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "./provisioning-signature-primitives.ts";

export const PLATFORM_PROVISIONER_ACTIVE_POINTER_CONTRACT =
  "crdd-coordinator/platform-provisioner-active-pointer";
export const PLATFORM_PROVISIONER_ACTIVE_POINTER_REVISION = 1;
export const PLATFORM_PROVISIONER_ACTIVE_POINTER_DOMAIN =
  "CRDD\0PLATFORM-PROVISIONER-ACTIVE-POINTER\0V1\0";

const MAXIMUM_ACTIVE_POINTER_BYTES = 16_384;
const HEX64 = /^[0-9a-f]{64}$/u;
const GIT_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const CRDD_VERSION = /^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]{1,64})?$/u;
const ACTIVE_ID = /^[0-9a-f]{32}$/u;
const RUNTIME_PRINCIPAL_MODE = "local_interactive_selected_user";
const POINTER_KEYS = new Set([
  "activeHash",
  "activeId",
  "contract",
  "contractRevision",
  "crddCommit",
  "crddTree",
  "crddVersion",
  "manifestHash",
  "packageContentRootSha256",
  "platformAccessArtifactByteLength",
  "platformAccessArtifactIdentityHash",
  "platformAccessArtifactSha256",
  "previousActiveHash",
  "releaseSequence",
  "rootIdentityHash",
  "rootProtectionHash",
  "runtimePrincipalIdentityHash",
  "runtimePrincipalMode",
]);
const INPUT_KEYS = new Set([
  "activeId",
  "crddCommit",
  "crddTree",
  "crddVersion",
  "manifestHash",
  "packageContentRootSha256",
  "platformAccessArtifactByteLength",
  "platformAccessArtifactIdentityHash",
  "platformAccessArtifactSha256",
  "previousActiveHash",
  "releaseSequence",
  "rootIdentityHash",
  "rootProtectionHash",
  "runtimePrincipalIdentityHash",
  "runtimePrincipalMode",
]);
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get as () => number;

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    activeHash: null,
    activeId: null,
    releaseSequence: null,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}

function nullableHash(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && HEX64.test(value));
}

function activeValue(value: Readonly<Record<string, unknown>>) {
  return Object.freeze({
    contract: PLATFORM_PROVISIONER_ACTIVE_POINTER_CONTRACT,
    contractRevision: PLATFORM_PROVISIONER_ACTIVE_POINTER_REVISION,
    activeId: value.activeId,
    previousActiveHash: value.previousActiveHash,
    releaseSequence: value.releaseSequence,
    crddVersion: value.crddVersion,
    crddCommit: value.crddCommit,
    crddTree: value.crddTree,
    manifestHash: value.manifestHash,
    packageContentRootSha256: value.packageContentRootSha256,
    rootIdentityHash: value.rootIdentityHash,
    rootProtectionHash: value.rootProtectionHash,
    runtimePrincipalMode: value.runtimePrincipalMode,
    runtimePrincipalIdentityHash: value.runtimePrincipalIdentityHash,
    platformAccessArtifactIdentityHash:
      value.platformAccessArtifactIdentityHash,
    platformAccessArtifactSha256: value.platformAccessArtifactSha256,
    platformAccessArtifactByteLength: value.platformAccessArtifactByteLength,
  });
}

function calculateActiveHash(value: ReturnType<typeof activeValue>) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(value);
  if (canonical.status !== "candidate") return null;
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.canonicalBytes.length));
  return createHash("sha256")
    .update(Buffer.from(PLATFORM_PROVISIONER_ACTIVE_POINTER_DOMAIN, "ascii"))
    .update(length)
    .update(canonical.canonicalBytes)
    .digest("hex");
}

function normalizeCore(raw: unknown) {
  const value = snapshotPlainRecord(raw, INPUT_KEYS);
  if (
    !value ||
    typeof value.activeId !== "string" ||
    !ACTIVE_ID.test(value.activeId) ||
    !nullableHash(value.previousActiveHash) ||
    typeof value.releaseSequence !== "number" ||
    !Number.isSafeInteger(value.releaseSequence) ||
    value.releaseSequence < 1 ||
    typeof value.crddVersion !== "string" ||
    !CRDD_VERSION.test(value.crddVersion) ||
    typeof value.crddCommit !== "string" ||
    !GIT_OBJECT_ID.test(value.crddCommit) ||
    typeof value.crddTree !== "string" ||
    !GIT_OBJECT_ID.test(value.crddTree) ||
    typeof value.platformAccessArtifactByteLength !== "number" ||
    !Number.isSafeInteger(value.platformAccessArtifactByteLength) ||
    value.platformAccessArtifactByteLength < 1 ||
    value.runtimePrincipalMode !== RUNTIME_PRINCIPAL_MODE
  ) {
    return null;
  }
  for (const key of [
    "manifestHash",
    "packageContentRootSha256",
    "rootIdentityHash",
    "rootProtectionHash",
    "runtimePrincipalIdentityHash",
    "platformAccessArtifactIdentityHash",
    "platformAccessArtifactSha256",
  ] as const) {
    if (typeof value[key] !== "string" || !HEX64.test(value[key])) return null;
  }
  return activeValue(value);
}

function normalizePointer(raw: unknown) {
  const value = snapshotPlainRecord(raw, POINTER_KEYS);
  if (
    !value ||
    value.contract !== PLATFORM_PROVISIONER_ACTIVE_POINTER_CONTRACT ||
    value.contractRevision !== PLATFORM_PROVISIONER_ACTIVE_POINTER_REVISION ||
    typeof value.activeHash !== "string" ||
    !HEX64.test(value.activeHash)
  ) {
    return null;
  }
  const core = normalizeCore({
    activeId: value.activeId,
    previousActiveHash: value.previousActiveHash,
    releaseSequence: value.releaseSequence,
    crddVersion: value.crddVersion,
    crddCommit: value.crddCommit,
    crddTree: value.crddTree,
    manifestHash: value.manifestHash,
    packageContentRootSha256: value.packageContentRootSha256,
    rootIdentityHash: value.rootIdentityHash,
    rootProtectionHash: value.rootProtectionHash,
    runtimePrincipalMode: value.runtimePrincipalMode,
    runtimePrincipalIdentityHash: value.runtimePrincipalIdentityHash,
    platformAccessArtifactIdentityHash:
      value.platformAccessArtifactIdentityHash,
    platformAccessArtifactSha256: value.platformAccessArtifactSha256,
    platformAccessArtifactByteLength: value.platformAccessArtifactByteLength,
  });
  if (!core) return null;
  const activeHash = calculateActiveHash(core);
  return activeHash === value.activeHash
    ? Object.freeze({ ...core, activeHash })
    : null;
}

export function createPlatformProvisionerActivePointerCandidate(raw: unknown) {
  try {
    const core = normalizeCore(raw);
    if (!core) return blocked("active_pointer_input_invalid");
    if (core.previousActiveHash === calculateActiveHash(core)) {
      return blocked("active_pointer_cycle_rejected");
    }
    const activeHash = calculateActiveHash(core);
    if (!activeHash) return blocked("active_pointer_state_invalid");
    return Object.freeze({
      status: "candidate" as const,
      reason: "active_pointer_persistence_required",
      activeId: core.activeId as string,
      activeHash,
      releaseSequence: core.releaseSequence as number,
      nextActivePointer: Object.freeze({ ...core, activeHash }),
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("active_pointer_input_invalid");
  }
}

export function encodePlatformProvisionerActivePointerCandidate(raw: unknown) {
  try {
    const activePointer = normalizePointer(raw);
    if (!activePointer) return blocked("active_pointer_state_invalid");
    const canonical = canonicalizeProvisioningJsonValueCandidate(activePointer);
    if (
      canonical.status !== "candidate" ||
      canonical.canonicalBytes.length > MAXIMUM_ACTIVE_POINTER_BYTES
    ) {
      return blocked("active_pointer_state_invalid");
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "active_pointer_canonical_bytes_encoded",
      activeId: activePointer.activeId as string,
      activeHash: activePointer.activeHash,
      releaseSequence: activePointer.releaseSequence as number,
      canonicalBytes: Buffer.from(canonical.canonicalBytes),
      activePointer,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("active_pointer_state_invalid");
  }
}

export function decodePlatformProvisionerActivePointerBytesCandidate(
  rawBytes: unknown,
) {
  try {
    if (!Buffer.isBuffer(rawBytes))
      return blocked("active_pointer_bytes_required");
    const byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, rawBytes, []);
    if (byteLength < 1 || byteLength > MAXIMUM_ACTIVE_POINTER_BYTES) {
      return blocked("active_pointer_bytes_invalid");
    }
    const ownedBytes = Buffer.allocUnsafe(byteLength);
    Buffer.prototype.copy.call(rawBytes, ownedBytes);
    const parsed = JSON.parse(utf8Decoder.decode(ownedBytes));
    const encoded = encodePlatformProvisionerActivePointerCandidate(parsed);
    if (
      encoded.status !== "candidate" ||
      !Buffer.prototype.equals.call(ownedBytes, encoded.canonicalBytes)
    ) {
      return blocked("active_pointer_bytes_noncanonical");
    }
    return encoded;
  } catch {
    return blocked("active_pointer_bytes_invalid");
  }
}

export function evaluatePlatformProvisionerActivePointerTransitionCandidate(
  currentRaw: unknown,
  nextRaw: unknown,
) {
  try {
    const next = normalizePointer(nextRaw);
    if (!next) return blocked("active_pointer_transition_invalid");
    if (currentRaw === null) {
      return next.previousActiveHash === null && next.releaseSequence === 1
        ? Object.freeze({
            status: "candidate" as const,
            reason: "active_pointer_initial_transition_candidate",
            activeId: next.activeId as string,
            activeHash: next.activeHash,
            releaseSequence: next.releaseSequence as number,
            runtimeAuthorityConferred: false,
            runtimeCapabilityIssued: false,
            filesystemEffectIssued: false,
          })
        : blocked("active_pointer_initial_transition_rejected");
    }
    const current = normalizePointer(currentRaw);
    if (
      !current ||
      next.previousActiveHash !== current.activeHash ||
      (next.releaseSequence as number) !==
        (current.releaseSequence as number) + 1 ||
      next.activeId === current.activeId
    ) {
      return blocked("active_pointer_transition_rejected");
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "active_pointer_monotonic_transition_candidate",
      activeId: next.activeId as string,
      activeHash: next.activeHash,
      releaseSequence: next.releaseSequence as number,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("active_pointer_transition_invalid");
  }
}

export function describePlatformProvisionerActivePointerContract() {
  return Object.freeze({
    contract: PLATFORM_PROVISIONER_ACTIVE_POINTER_CONTRACT,
    contractRevision: PLATFORM_PROVISIONER_ACTIVE_POINTER_REVISION,
    domain: PLATFORM_PROVISIONER_ACTIVE_POINTER_DOMAIN,
    stateModel: "exactly_one_staging_and_one_atomic_active_pointer",
    compatibilityState: "prohibited",
    automaticRollback: "prohibited",
    directoryFallback: "prohibited",
    protectedIdentityBinding:
      "active_id_root_identity_protection_runtime_principal_and_platform_access_image",
    runtimePrincipalMode: RUNTIME_PRINCIPAL_MODE,
    runtimePrincipalIdentity:
      "native_current_token_user_sid_hash_bound_without_raw_sid_output",
    serviceAccountMode: "not_implemented_blocked",
    previousPointerBinding: "exact_previous_active_hash_or_null",
    transition:
      "initial_sequence_one_or_exact_previous_hash_and_next_sequence_only",
    canonicalByteLimit: MAXIMUM_ACTIVE_POINTER_BYTES,
    persistence: "native_durable_store_required",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}
