import fs from "node:fs";
import path from "node:path";

import {
  decodePlatformProvisionerActiveReleaseBytesCandidate,
  encodePlatformProvisionerActiveReleaseCandidate,
} from "./platform-provisioner-active-release.ts";
import { PLATFORM_PROVISIONER_ACTIVE_RELEASE_FILE } from "./platform-provisioner-install-layout.ts";

const STATE_DIRECTORY = "state";
const PENDING_SUFFIX = ".pending";
const MAXIMUM_ACTIVE_RELEASE_BYTES = 8_192;

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    releaseSequence: null,
    activeHash: null,
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
  const target = path.join(stateRoot, PLATFORM_PROVISIONER_ACTIVE_RELEASE_FILE);
  return Object.freeze({ target, pending: `${target}${PENDING_SUFFIX}` });
}

function readCanonicalActiveRelease(target: string) {
  const before = fs.lstatSync(target);
  if (!before.isFile() || before.isSymbolicLink()) return null;
  const handle = fs.openSync(target, "r");
  try {
    const opened = fs.fstatSync(handle);
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size < 1 ||
      opened.size > MAXIMUM_ACTIVE_RELEASE_BYTES
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
    const decoded = decodePlatformProvisionerActiveReleaseBytesCandidate(bytes);
    return decoded.status === "candidate" ? decoded : null;
  } finally {
    fs.closeSync(handle);
  }
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
  expected: Readonly<{
    activeHash: string;
    releaseSequence: number;
  }>,
) {
  fs.renameSync(pending, target);
  const isParentDirectorySynced = syncDirectory(stateRoot);
  const confirmed = readCanonicalActiveRelease(target);
  if (
    !confirmed ||
    confirmed.activeRelease.activeHash !== expected.activeHash
  ) {
    return blocked("active_release_store_reread_mismatch");
  }
  return Object.freeze({
    status: "candidate" as const,
    reason: "active_release_store_persisted_and_reread",
    releaseSequence: expected.releaseSequence,
    activeHash: expected.activeHash,
    persistenceCompleted: true,
    recoveryRequired: false,
    parentDirectorySynced: isParentDirectorySynced,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: true,
  });
}

export function loadPlatformProvisionerActiveReleaseForEffect(
  stateRoot: unknown,
) {
  try {
    const paths = statePaths(stateRoot);
    if (!paths) return blocked("active_release_store_root_invalid");
    if (fs.existsSync(paths.pending)) {
      return Object.freeze({
        ...blocked("active_release_store_recovery_required"),
        recoveryRequired: true,
      });
    }
    if (!fs.existsSync(paths.target)) {
      return Object.freeze({
        status: "candidate" as const,
        reason: "active_release_store_empty",
        activeRelease: null,
        releaseSequence: null,
        activeHash: null,
        persistenceCompleted: false,
        recoveryRequired: false,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
        filesystemEffectIssued: false,
      });
    }
    const decoded = readCanonicalActiveRelease(paths.target);
    if (!decoded) return blocked("active_release_store_state_invalid");
    return Object.freeze({
      status: "candidate" as const,
      reason: "active_release_store_loaded",
      activeRelease: decoded.activeRelease,
      releaseSequence: decoded.activeRelease.releaseSequence,
      activeHash: decoded.activeRelease.activeHash,
      persistenceCompleted: false,
      recoveryRequired: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("active_release_store_read_failed");
  }
}

export function persistPlatformProvisionerActiveReleaseForEffect(
  stateRoot: unknown,
  nextActiveRelease: unknown,
) {
  try {
    const paths = statePaths(stateRoot);
    const encoded =
      encodePlatformProvisionerActiveReleaseCandidate(nextActiveRelease);
    if (!paths || encoded.status !== "candidate") {
      return blocked("active_release_store_input_invalid");
    }
    if (fs.existsSync(paths.pending)) {
      return Object.freeze({
        ...blocked("active_release_store_recovery_required"),
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
      encoded.activeRelease,
    );
  } catch {
    return Object.freeze({
      ...blocked("active_release_store_persistence_failed"),
      recoveryRequired: true,
    });
  }
}

export function recoverPlatformProvisionerActiveReleaseForEffect(
  stateRoot: unknown,
) {
  try {
    const paths = statePaths(stateRoot);
    if (!paths || !fs.existsSync(paths.pending)) {
      return blocked("active_release_store_recovery_not_available");
    }
    const pending = readCanonicalActiveRelease(paths.pending);
    if (!pending) return blocked("active_release_store_pending_invalid");
    if (!fs.existsSync(paths.target)) {
      return replacePending(
        stateRoot as string,
        paths.pending,
        paths.target,
        pending.activeRelease,
      );
    }
    const current = readCanonicalActiveRelease(paths.target);
    if (!current) return blocked("active_release_store_state_invalid");
    if (current.activeRelease.activeHash !== pending.activeRelease.activeHash) {
      return blocked("active_release_store_pending_conflict");
    }
    fs.unlinkSync(paths.pending);
    const isParentDirectorySynced = syncDirectory(stateRoot as string);
    return Object.freeze({
      status: "candidate" as const,
      reason: "active_release_store_recovery_completed",
      releaseSequence: current.activeRelease.releaseSequence,
      activeHash: current.activeRelease.activeHash,
      persistenceCompleted: true,
      recoveryRequired: false,
      parentDirectorySynced: isParentDirectorySynced,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: true,
    });
  } catch {
    return Object.freeze({
      ...blocked("active_release_store_recovery_failed"),
      recoveryRequired: true,
    });
  }
}

export function describePlatformProvisionerActiveReleaseStoreContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-active-release-store",
    contractRevision: 1,
    persistence: "implemented_candidate",
    path: "state/active-release.json",
    pendingPath: "state/active-release.json.pending",
    replacement: "exclusive_pending_fsync_atomic_rename_and_reread",
    recovery: "explicit_pending_recovery_required",
    compatibilityState: "prohibited",
    repositoryRuntimeStateRequired: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
