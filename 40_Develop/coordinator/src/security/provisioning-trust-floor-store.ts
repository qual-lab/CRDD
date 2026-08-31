import fs from "node:fs";
import path from "node:path";

import { PROVISIONING_RECORD_STORAGE_DIRECTORY } from "./provisioning-record-store.ts";
import {
  PROVISIONING_TRUST_FLOOR_MAXIMUM_BYTES,
  decodeProvisioningTrustFloorBytesCandidate,
  encodeProvisioningTrustFloorCandidate,
  evaluateProvisioningTrustFloorCandidate,
} from "./provisioning-trust-floor.ts";

export const PROVISIONING_TRUST_FLOOR_FILE = "trust-floor.json";
const PENDING_SUFFIX = ".pending";

function blocked(reason: string, isRecoveryRequired = false) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    trustEpoch: null,
    revocationRevision: null,
    floorHash: null,
    persistenceCompleted: false,
    recoveryRequired: isRecoveryRequired,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}

function floorPaths(storageRoot: unknown) {
  if (
    typeof storageRoot !== "string" ||
    !path.isAbsolute(storageRoot) ||
    path.basename(storageRoot) !== PROVISIONING_RECORD_STORAGE_DIRECTORY ||
    path.resolve(storageRoot) !== storageRoot
  ) {
    return null;
  }
  const metadata = fs.lstatSync(storageRoot);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(storageRoot) !== storageRoot
  ) {
    return null;
  }
  const target = path.join(storageRoot, PROVISIONING_TRUST_FLOOR_FILE);
  return Object.freeze({ target, pending: `${target}${PENDING_SUFFIX}` });
}

function readFloor(target: string) {
  const before = fs.lstatSync(target);
  if (!before.isFile() || before.isSymbolicLink()) return null;
  const handle = fs.openSync(target, "r");
  try {
    const opened = fs.fstatSync(handle);
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size < 1 ||
      opened.size > PROVISIONING_TRUST_FLOOR_MAXIMUM_BYTES
    ) {
      return null;
    }
    const bytes = Buffer.allocUnsafe(opened.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(
        handle,
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (count < 1) return null;
      offset += count;
    }
    const after = fs.fstatSync(handle);
    if (
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size
    ) {
      return null;
    }
    const decoded = decodeProvisioningTrustFloorBytesCandidate(bytes);
    return decoded.status === "candidate" ? decoded : null;
  } finally {
    fs.closeSync(handle);
  }
}

function syncDirectory(storageRoot: string) {
  try {
    const handle = fs.openSync(storageRoot, "r");
    try {
      fs.fsyncSync(handle);
      return true;
    } finally {
      fs.closeSync(handle);
    }
  } catch (error) {
    if (
      process.platform === "win32" &&
      error instanceof Error &&
      "code" in error &&
      ["EBADF", "EINVAL", "EPERM"].includes(String(error.code))
    ) {
      return false;
    }
    throw error;
  }
}

function trustObservation(
  floor: Readonly<{
    trustEpoch: number;
    trustAnchorSetHash: string;
    revocationRevision: number;
    revocationManifestHash: string;
  }>,
) {
  return Object.freeze({
    trustEpoch: floor.trustEpoch,
    trustAnchorSetHash: floor.trustAnchorSetHash,
    revocationRevision: floor.revocationRevision,
    revocationManifestHash: floor.revocationManifestHash,
  });
}

function replacePending(
  storageRoot: string,
  paths: NonNullable<ReturnType<typeof floorPaths>>,
  expected: Readonly<{
    trustEpoch: number;
    revocationRevision: number;
    floorHash: string;
  }>,
) {
  fs.renameSync(paths.pending, paths.target);
  const isParentDirectorySynced = syncDirectory(storageRoot);
  const confirmed = readFloor(paths.target);
  if (!confirmed || confirmed.floor.floorHash !== expected.floorHash) {
    return blocked("provisioning_trust_floor_store_reread_mismatch", true);
  }
  return Object.freeze({
    status: "candidate" as const,
    reason: "provisioning_trust_floor_store_persisted_and_reread",
    trustEpoch: expected.trustEpoch,
    revocationRevision: expected.revocationRevision,
    floorHash: expected.floorHash,
    persistenceCompleted: true,
    recoveryRequired: false,
    parentDirectorySynced: isParentDirectorySynced,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: true,
  });
}

export function loadProvisioningTrustFloorForEffect(storageRoot: unknown) {
  try {
    const paths = floorPaths(storageRoot);
    if (!paths) return blocked("provisioning_trust_floor_store_root_invalid");
    if (fs.existsSync(paths.pending)) {
      return blocked("provisioning_trust_floor_store_recovery_required", true);
    }
    if (!fs.existsSync(paths.target)) {
      return Object.freeze({
        status: "candidate" as const,
        reason: "provisioning_trust_floor_store_empty",
        floor: null,
        trustEpoch: null,
        revocationRevision: null,
        floorHash: null,
        persistenceCompleted: false,
        recoveryRequired: false,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
        filesystemEffectIssued: false,
      });
    }
    const decoded = readFloor(paths.target);
    if (!decoded)
      return blocked("provisioning_trust_floor_store_state_invalid");
    return Object.freeze({
      status: "candidate" as const,
      reason: "provisioning_trust_floor_store_loaded",
      floor: decoded.floor,
      trustEpoch: decoded.floor.trustEpoch,
      revocationRevision: decoded.floor.revocationRevision,
      floorHash: decoded.floor.floorHash,
      persistenceCompleted: false,
      recoveryRequired: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("provisioning_trust_floor_store_read_failed");
  }
}

export function persistProvisioningTrustFloorForEffect(
  storageRoot: unknown,
  nextFloor: unknown,
) {
  try {
    const paths = floorPaths(storageRoot);
    const encoded = encodeProvisioningTrustFloorCandidate(nextFloor);
    if (!paths || encoded.status !== "candidate") {
      return blocked("provisioning_trust_floor_store_input_invalid");
    }
    if (fs.existsSync(paths.pending)) {
      return blocked("provisioning_trust_floor_store_recovery_required", true);
    }
    if (fs.existsSync(paths.target)) {
      const current = readFloor(paths.target);
      const transition =
        current &&
        evaluateProvisioningTrustFloorCandidate({
          currentFloor: current.floor,
          verifiedTrust: trustObservation(encoded.floor),
        });
      if (!current || !transition || transition.status !== "candidate") {
        return blocked("provisioning_trust_floor_store_transition_rejected");
      }
      if (!transition.persistenceRequired) {
        return Object.freeze({
          status: "candidate" as const,
          reason: "provisioning_trust_floor_store_current_matches",
          trustEpoch: current.floor.trustEpoch,
          revocationRevision: current.floor.revocationRevision,
          floorHash: current.floor.floorHash,
          persistenceCompleted: true,
          recoveryRequired: false,
          parentDirectorySynced: false,
          runtimeAuthorityConferred: false,
          runtimeCapabilityIssued: false,
          filesystemEffectIssued: false,
        });
      }
    }
    const handle = fs.openSync(paths.pending, "wx", 0o600);
    try {
      fs.writeFileSync(handle, encoded.canonicalBytes);
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    return replacePending(storageRoot as string, paths, encoded.floor);
  } catch {
    return blocked("provisioning_trust_floor_store_persistence_failed", true);
  }
}

export function recoverProvisioningTrustFloorForEffect(storageRoot: unknown) {
  try {
    const paths = floorPaths(storageRoot);
    if (!paths || !fs.existsSync(paths.pending)) {
      return blocked("provisioning_trust_floor_store_recovery_not_available");
    }
    const pending = readFloor(paths.pending);
    if (!pending)
      return blocked("provisioning_trust_floor_store_pending_invalid", true);
    if (!fs.existsSync(paths.target)) {
      return replacePending(storageRoot as string, paths, pending.floor);
    }
    const current = readFloor(paths.target);
    if (!current)
      return blocked("provisioning_trust_floor_store_state_invalid", true);
    if (current.floor.floorHash === pending.floor.floorHash) {
      fs.unlinkSync(paths.pending);
      const isParentDirectorySynced = syncDirectory(storageRoot as string);
      return Object.freeze({
        status: "candidate" as const,
        reason: "provisioning_trust_floor_store_recovery_completed",
        trustEpoch: current.floor.trustEpoch,
        revocationRevision: current.floor.revocationRevision,
        floorHash: current.floor.floorHash,
        persistenceCompleted: true,
        recoveryRequired: false,
        parentDirectorySynced: isParentDirectorySynced,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
        filesystemEffectIssued: true,
      });
    }
    const transition = evaluateProvisioningTrustFloorCandidate({
      currentFloor: current.floor,
      verifiedTrust: trustObservation(pending.floor),
    });
    return transition.status === "candidate" && transition.persistenceRequired
      ? replacePending(storageRoot as string, paths, pending.floor)
      : blocked("provisioning_trust_floor_store_recovery_rejected", true);
  } catch {
    return blocked("provisioning_trust_floor_store_recovery_failed", true);
  }
}

export function describeProvisioningTrustFloorStoreContract() {
  return Object.freeze({
    contract: "crdd-coordinator/provisioning-trust-floor-store",
    contractRevision: 1,
    target: `${PROVISIONING_RECORD_STORAGE_DIRECTORY}/${PROVISIONING_TRUST_FLOOR_FILE}`,
    pending: `${PROVISIONING_RECORD_STORAGE_DIRECTORY}/${PROVISIONING_TRUST_FLOOR_FILE}.pending`,
    replacement:
      "pending_file_fsync_atomic_replace_parent_fsync_when_supported_and_reread",
    recovery: "explicit_monotonic_pending_recovery",
    persistence: "implemented_candidate",
    repositoryCanonicalStateStored: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
