import fs from "node:fs";
import path from "node:path";

import {
  decodePlatformProvisionerReleaseFloorBytesCandidate,
  encodePlatformProvisionerReleaseFloorCandidate,
  evaluatePlatformProvisionerReleaseFloorCandidate,
} from "./platform-provisioner-release-floor.ts";
import { PLATFORM_PROVISIONER_RELEASE_FLOOR_FILE } from "./platform-provisioner-install-layout.ts";

const STATE_DIRECTORY = "state";
const PENDING_SUFFIX = ".pending";
const MAXIMUM_FLOOR_BYTES = 8_192;

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    releaseSequence: null,
    floorHash: null,
    persistenceCompleted: false,
    recoveryRequired: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}

function statePaths(stateRoot: unknown) {
  if (
    typeof stateRoot !== "string" ||
    !path.isAbsolute(stateRoot) ||
    path.basename(stateRoot) !== STATE_DIRECTORY ||
    path.resolve(stateRoot) !== stateRoot
  ) {
    return null;
  }
  const rootStatus = fs.lstatSync(stateRoot);
  if (!rootStatus.isDirectory() || rootStatus.isSymbolicLink()) return null;
  const realRoot = fs.realpathSync.native(stateRoot);
  if (realRoot !== stateRoot) return null;
  const target = path.join(stateRoot, PLATFORM_PROVISIONER_RELEASE_FLOOR_FILE);
  return Object.freeze({ target, pending: `${target}${PENDING_SUFFIX}` });
}

function readCanonicalFloor(target: string) {
  const before = fs.lstatSync(target);
  if (!before.isFile() || before.isSymbolicLink()) return null;
  const handle = fs.openSync(target, "r");
  try {
    const opened = fs.fstatSync(handle);
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size < 1 ||
      opened.size > MAXIMUM_FLOOR_BYTES
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
    const decoded = decodePlatformProvisionerReleaseFloorBytesCandidate(bytes);
    return decoded.status === "candidate" ? decoded : null;
  } finally {
    fs.closeSync(handle);
  }
}

function sameFloor(
  left: Readonly<{ floorHash: string }>,
  right: Readonly<{ floorHash: string }>,
) {
  return left.floorHash === right.floorHash;
}

function syncDirectory(stateRoot: string) {
  try {
    const handle = fs.openSync(stateRoot, "r");
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

function replacePending(
  stateRoot: string,
  pending: string,
  target: string,
  expected: Readonly<{ floorHash: string; releaseSequence: number }>,
) {
  fs.renameSync(pending, target);
  const isParentDirectorySynced = syncDirectory(stateRoot);
  const confirmed = readCanonicalFloor(target);
  if (!confirmed || !sameFloor(confirmed.floor, expected)) {
    return blocked("release_floor_store_reread_mismatch");
  }
  return Object.freeze({
    status: "candidate" as const,
    reason: "release_floor_store_persisted_and_reread",
    releaseSequence: expected.releaseSequence,
    floorHash: expected.floorHash,
    persistenceCompleted: true,
    recoveryRequired: false,
    parentDirectorySynced: isParentDirectorySynced,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: true,
  });
}

export function loadPlatformProvisionerReleaseFloorForEffect(
  stateRoot: unknown,
) {
  try {
    const paths = statePaths(stateRoot);
    if (!paths) return blocked("release_floor_store_root_invalid");
    if (fs.existsSync(paths.pending)) {
      return Object.freeze({
        ...blocked("release_floor_store_recovery_required"),
        recoveryRequired: true,
      });
    }
    if (!fs.existsSync(paths.target)) {
      return Object.freeze({
        status: "candidate" as const,
        reason: "release_floor_store_empty",
        floor: null,
        releaseSequence: null,
        floorHash: null,
        persistenceCompleted: false,
        recoveryRequired: false,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
        filesystemEffectIssued: false,
      });
    }
    const decoded = readCanonicalFloor(paths.target);
    if (!decoded) return blocked("release_floor_store_state_invalid");
    return Object.freeze({
      status: "candidate" as const,
      reason: "release_floor_store_loaded",
      floor: decoded.floor,
      releaseSequence: decoded.floor.releaseSequence,
      floorHash: decoded.floor.floorHash,
      persistenceCompleted: false,
      recoveryRequired: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("release_floor_store_read_failed");
  }
}

export function persistPlatformProvisionerReleaseFloorForEffect(
  stateRoot: unknown,
  nextFloor: unknown,
) {
  try {
    const paths = statePaths(stateRoot);
    const encoded = encodePlatformProvisionerReleaseFloorCandidate(nextFloor);
    if (!paths || encoded.status !== "candidate") {
      return blocked("release_floor_store_input_invalid");
    }
    if (fs.existsSync(paths.pending)) {
      return Object.freeze({
        ...blocked("release_floor_store_recovery_required"),
        recoveryRequired: true,
      });
    }
    const handle = fs.openSync(paths.pending, "wx", 0o600);
    try {
      fs.writeFileSync(handle, encoded.canonicalBytes);
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    return replacePending(
      stateRoot as string,
      paths.pending,
      paths.target,
      encoded.floor,
    );
  } catch {
    return Object.freeze({
      ...blocked("release_floor_store_persistence_failed"),
      recoveryRequired: true,
    });
  }
}

export function recoverPlatformProvisionerReleaseFloorForEffect(
  stateRoot: unknown,
) {
  try {
    const paths = statePaths(stateRoot);
    if (!paths || !fs.existsSync(paths.pending)) {
      return blocked("release_floor_store_recovery_not_available");
    }
    const pending = readCanonicalFloor(paths.pending);
    if (!pending) return blocked("release_floor_store_pending_invalid");
    if (!fs.existsSync(paths.target)) {
      return replacePending(
        stateRoot as string,
        paths.pending,
        paths.target,
        pending.floor,
      );
    }
    const current = readCanonicalFloor(paths.target);
    if (!current) return blocked("release_floor_store_state_invalid");
    if (sameFloor(current.floor, pending.floor)) {
      fs.unlinkSync(paths.pending);
      const isParentDirectorySynced = syncDirectory(stateRoot as string);
      return Object.freeze({
        status: "candidate" as const,
        reason: "release_floor_store_recovery_completed",
        releaseSequence: current.floor.releaseSequence,
        floorHash: current.floor.floorHash,
        persistenceCompleted: true,
        recoveryRequired: false,
        parentDirectorySynced: isParentDirectorySynced,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
        filesystemEffectIssued: true,
      });
    }
    const transition = evaluatePlatformProvisionerReleaseFloorCandidate({
      currentFloor: current.floor,
      verifiedRelease: pending.floor,
    });
    if (transition.status !== "candidate" || !transition.persistenceRequired) {
      return blocked("release_floor_store_recovery_transition_rejected");
    }
    return replacePending(
      stateRoot as string,
      paths.pending,
      paths.target,
      pending.floor,
    );
  } catch {
    return blocked("release_floor_store_recovery_failed");
  }
}

export function describePlatformProvisionerReleaseFloorStoreContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-release-floor-store",
    contractRevision: 1,
    target: "state/release-floor.json",
    pending: "state/release-floor.json.pending",
    encoding: "canonical_json_utf8",
    replacement:
      "pending_file_fsync_atomic_replace_parent_fsync_when_supported_and_reread",
    windowsParentDirectorySync:
      "platform_not_supported_is_reported_without_skipping_reread_recovery",
    recovery: "explicit_monotonic_pending_recovery",
    compatibilityState: "prohibited",
    persistence: "implemented_candidate",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
