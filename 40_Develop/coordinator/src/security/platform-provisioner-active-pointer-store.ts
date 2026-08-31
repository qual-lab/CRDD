import fs from "node:fs";
import path from "node:path";

import { decodePlatformProvisionerActivePointerBytesCandidate } from "./platform-provisioner-active-pointer.ts";
import { PLATFORM_PROVISIONER_ACTIVE_POINTER_FILE } from "./platform-provisioner-install-layout.ts";

const STATE_DIRECTORY = "state";
const MAXIMUM_ACTIVE_POINTER_BYTES = 16_384;

function blocked(reason: string, isRecoveryRequired = false) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    activePointer: null,
    activeHash: null,
    recoveryRequired: isRecoveryRequired,
    persistenceCompleted: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}

function pointerPath(stateRoot: unknown) {
  if (
    typeof stateRoot !== "string" ||
    !path.isAbsolute(stateRoot) ||
    path.basename(stateRoot) !== STATE_DIRECTORY ||
    path.resolve(stateRoot) !== stateRoot
  ) {
    return null;
  }
  const metadata = fs.lstatSync(stateRoot, { bigint: true });
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
  if (fs.realpathSync.native(stateRoot) !== stateRoot) return null;
  return path.join(stateRoot, PLATFORM_PROVISIONER_ACTIVE_POINTER_FILE);
}

export function loadPlatformProvisionerActivePointerCandidate(
  stateRoot: unknown,
) {
  try {
    const target = pointerPath(stateRoot);
    if (!target) return blocked("active_pointer_store_root_invalid");
    const metadata = fs.lstatSync(target, { bigint: true });
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.size < 1n ||
      metadata.size > BigInt(MAXIMUM_ACTIVE_POINTER_BYTES)
    ) {
      return blocked("active_pointer_store_state_invalid");
    }
    const handle = fs.openSync(target, "r");
    try {
      const opened = fs.fstatSync(handle, { bigint: true });
      if (
        opened.dev !== metadata.dev ||
        opened.ino !== metadata.ino ||
        opened.birthtimeNs !== metadata.birthtimeNs ||
        opened.size !== metadata.size
      ) {
        return blocked("active_pointer_store_identity_mismatch");
      }
      const length = Number(opened.size);
      const bytes = Buffer.allocUnsafe(length);
      let offset = 0;
      while (offset < length) {
        const count = fs.readSync(
          handle,
          bytes,
          offset,
          length - offset,
          offset,
        );
        if (count < 1) return blocked("active_pointer_store_short_read");
        offset += count;
      }
      const after = fs.fstatSync(handle, { bigint: true });
      if (
        after.dev !== opened.dev ||
        after.ino !== opened.ino ||
        after.birthtimeNs !== opened.birthtimeNs ||
        after.size !== opened.size ||
        after.mtimeNs !== opened.mtimeNs ||
        after.ctimeNs !== opened.ctimeNs ||
        after.mode !== opened.mode
      ) {
        return blocked("active_pointer_store_identity_mismatch");
      }
      const decoded =
        decodePlatformProvisionerActivePointerBytesCandidate(bytes);
      if (decoded.status !== "candidate") {
        return blocked("active_pointer_store_state_invalid");
      }
      return Object.freeze({
        status: "candidate" as const,
        reason: "active_pointer_store_stable_read_candidate",
        activePointer: decoded.activePointer,
        activeHash: decoded.activeHash,
        recoveryRequired: false,
        persistenceCompleted: false,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
        filesystemEffectIssued: false,
      });
    } finally {
      fs.closeSync(handle);
    }
  } catch {
    return blocked("active_pointer_store_read_failed");
  }
}

export function persistPlatformProvisionerActivePointerForEffect(
  stateRoot: unknown,
  nextActivePointer: unknown,
) {
  void stateRoot;
  void nextActivePointer;
  return blocked("active_pointer_native_durable_store_not_implemented");
}

export function readPlatformProvisionerActivePointerForRuntime(
  stateRoot: unknown,
) {
  void stateRoot;
  return blocked(
    "active_pointer_protected_root_and_verified_image_binding_not_implemented",
  );
}

export function describePlatformProvisionerActivePointerStoreContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-active-pointer-store",
    contractRevision: 1,
    canonicalStableRead: "implemented_candidate_same_file_identity",
    nativeDurablePersistence: "not_implemented_blocked",
    runtimeRead: "blocked_until_protected_root_and_verified_image_binding",
    pendingRecovery: "no_automatic_repair_or_fallback",
    directoryFallback: "prohibited",
    compatibilityState: "prohibited",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}
