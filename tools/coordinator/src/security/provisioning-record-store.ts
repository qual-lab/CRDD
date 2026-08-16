import fs from "node:fs";
import path from "node:path";

import {
  PROVISIONING_RECORD_PURE_CORE_LIMITS,
  decodeProvisioningRecordEnvelopeCandidate,
  verifyProvisioningRecordAggregateCandidate,
  verifyProvisioningRecordLineageCandidate,
} from "./provisioning-record-pure-core.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "./provisioning-signature-primitives.ts";

export const PROVISIONING_RECORD_STORAGE_DIRECTORY = ".crdd-provisioning";
export const PROVISIONING_RECORDS_DIRECTORY = "records";
export const PROVISIONING_RECORD_CURRENT_FILE = "current.json";
const POINTER_CONTRACT = "crdd-coordinator/provisioning-record-current-pointer";
const POINTER_REVISION = 1;
const POINTER_KEYS = Object.freeze([
  "contract",
  "contractRevision",
  "recordHash",
]);
const HASH = /^[a-f0-9]{64}$/u;
const POINTER_MAXIMUM_BYTES = 1_024;
const PENDING_SUFFIX = ".pending";

type CurrentPointer = Readonly<{
  contract: typeof POINTER_CONTRACT;
  contractRevision: typeof POINTER_REVISION;
  recordHash: string;
}>;

function blocked(reason: string, isRecoveryRequired = false) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    recordHash: null,
    persistenceCompleted: false,
    recoveryRequired: isRecoveryRequired,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}

function exactPointer(value: unknown): CurrentPointer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== POINTER_KEYS.length ||
    !POINTER_KEYS.every((key) => keys.includes(key))
  ) {
    return null;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    !POINTER_KEYS.every((key) => {
      const descriptor = descriptors[key];
      return Boolean(
        descriptor &&
          Object.hasOwn(descriptor, "value") &&
          descriptor.enumerable &&
          descriptor.get === undefined &&
          descriptor.set === undefined,
      );
    })
  ) {
    return null;
  }
  const pointer = value as Record<string, unknown>;
  if (
    pointer.contract !== POINTER_CONTRACT ||
    pointer.contractRevision !== POINTER_REVISION ||
    typeof pointer.recordHash !== "string" ||
    !HASH.test(pointer.recordHash)
  ) {
    return null;
  }
  return Object.freeze({
    contract: POINTER_CONTRACT,
    contractRevision: POINTER_REVISION,
    recordHash: pointer.recordHash,
  });
}

function canonicalPointer(pointer: CurrentPointer) {
  const compiled = canonicalizeProvisioningJsonValueCandidate(pointer);
  return compiled.status === "candidate"
    ? Buffer.from(compiled.canonicalBytes)
    : null;
}

function readStableBytes(target: string, maximumBytes: number) {
  const before = fs.lstatSync(target);
  if (!before.isFile() || before.isSymbolicLink()) return null;
  const handle = fs.openSync(target, "r");
  try {
    const opened = fs.fstatSync(handle);
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size < 1 ||
      opened.size > maximumBytes
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
    return after.dev === opened.dev &&
      after.ino === opened.ino &&
      after.size === opened.size
      ? bytes
      : null;
  } finally {
    fs.closeSync(handle);
  }
}

function storagePaths(storageRoot: unknown) {
  if (
    typeof storageRoot !== "string" ||
    !path.isAbsolute(storageRoot) ||
    path.basename(storageRoot) !== PROVISIONING_RECORD_STORAGE_DIRECTORY ||
    path.resolve(storageRoot) !== storageRoot
  ) {
    return null;
  }
  const rootMetadata = fs.lstatSync(storageRoot);
  if (
    !rootMetadata.isDirectory() ||
    rootMetadata.isSymbolicLink() ||
    fs.realpathSync.native(storageRoot) !== storageRoot
  ) {
    return null;
  }
  const recordsRoot = path.join(storageRoot, PROVISIONING_RECORDS_DIRECTORY);
  const recordsMetadata = fs.lstatSync(recordsRoot);
  if (
    !recordsMetadata.isDirectory() ||
    recordsMetadata.isSymbolicLink() ||
    fs.realpathSync.native(recordsRoot) !== recordsRoot
  ) {
    return null;
  }
  const current = path.join(storageRoot, PROVISIONING_RECORD_CURRENT_FILE);
  return Object.freeze({
    recordsRoot,
    current,
    pending: `${current}${PENDING_SUFFIX}`,
  });
}

function decodePointer(bytes: Buffer) {
  try {
    if (
      bytes.length > POINTER_MAXIMUM_BYTES ||
      (bytes.length >= 3 &&
        bytes[0] === 0xef &&
        bytes[1] === 0xbb &&
        bytes[2] === 0xbf)
    ) {
      return null;
    }
    const parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    const pointer = exactPointer(parsed);
    const canonical = pointer ? canonicalPointer(pointer) : null;
    return canonical && Buffer.prototype.equals.call(bytes, canonical)
      ? pointer
      : null;
  } catch {
    return null;
  }
}

function syncDirectory(directory: string) {
  try {
    const handle = fs.openSync(directory, "r");
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

function loadCurrent(paths: NonNullable<ReturnType<typeof storagePaths>>) {
  if (fs.existsSync(paths.pending)) return null;
  return loadPointerTarget(paths, paths.current);
}

function loadPointerTarget(
  paths: NonNullable<ReturnType<typeof storagePaths>>,
  pointerPath: string,
) {
  const pointerBytes = readStableBytes(pointerPath, POINTER_MAXIMUM_BYTES);
  const pointer = pointerBytes ? decodePointer(pointerBytes) : null;
  if (!pointer) return null;
  const recordPath = path.join(paths.recordsRoot, `${pointer.recordHash}.json`);
  const recordBytes = readStableBytes(
    recordPath,
    PROVISIONING_RECORD_PURE_CORE_LIMITS.artifactBytes,
  );
  const decoded = recordBytes
    ? decodeProvisioningRecordEnvelopeCandidate(recordBytes)
    : null;
  return recordBytes &&
    decoded?.status === "candidate" &&
    decoded.canonicalHash === pointer.recordHash
    ? Object.freeze({ pointer, recordBytes: Buffer.from(recordBytes) })
    : null;
}

export function loadCurrentProvisioningRecordCandidate(storageRoot: unknown) {
  try {
    const paths = storagePaths(storageRoot);
    if (!paths) return blocked("provisioning_record_store_root_invalid");
    if (fs.existsSync(paths.pending)) {
      return blocked("provisioning_record_store_recovery_required", true);
    }
    if (!fs.existsSync(paths.current)) {
      return blocked("provisioning_record_store_current_missing");
    }
    const current = loadCurrent(paths);
    return current
      ? Object.freeze({
          status: "candidate" as const,
          reason: "provisioning_record_store_current_loaded",
          recordHash: current.pointer.recordHash,
          persistenceCompleted: false,
          recoveryRequired: false,
          runtimeAuthorityConferred: false,
          runtimeCapabilityIssued: false,
          filesystemEffectIssued: false,
        })
      : blocked("provisioning_record_store_current_invalid");
  } catch {
    return blocked("provisioning_record_store_read_failed");
  }
}

export function verifyCurrentProvisioningRecordAggregateCandidate(
  storageRoot: unknown,
  trustAnchorSetBytes: unknown,
  revocationManifestBytes: unknown,
  evaluationTime: unknown,
) {
  try {
    const paths = storagePaths(storageRoot);
    const current = paths ? loadCurrent(paths) : null;
    if (!current) {
      return Object.freeze({
        status: "blocked" as const,
        reason: "provisioning_record_store_current_verification_unavailable",
        cryptographicConditionSatisfied: false,
        verifiedSignatureCount: 0,
        filesystemEffectIssued: false,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
      });
    }
    return verifyProvisioningRecordAggregateCandidate({
      envelopeBytes: current.recordBytes,
      trustAnchorSetBytes,
      revocationManifestBytes,
      evaluationTime,
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "provisioning_record_store_current_verification_failed",
      cryptographicConditionSatisfied: false,
      verifiedSignatureCount: 0,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  }
}

export function verifyCurrentProvisioningRecordLocatorBindingCandidate(
  storageRoot: unknown,
  authorityRootAbsolutePath: unknown,
  authorityRootIdentityHash: unknown,
) {
  try {
    const paths = storagePaths(storageRoot);
    const current = paths ? loadCurrent(paths) : null;
    if (!current) {
      return Object.freeze({
        status: "blocked" as const,
        reason: "provisioning_record_store_current_locator_binding_unavailable",
        recordHash: null,
        locatorBindingMatch: false,
        filesystemEffectIssued: false,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
      });
    }
    const decoded = decodeProvisioningRecordEnvelopeCandidate(
      current.recordBytes,
    );
    const parsed = JSON.parse(current.recordBytes.toString("utf8")) as {
      payload?: {
        authorityRootAbsolutePath?: unknown;
        authorityRootIdentityHash?: unknown;
      };
    };
    if (
      decoded.status !== "candidate" ||
      parsed.payload?.authorityRootAbsolutePath !== authorityRootAbsolutePath ||
      parsed.payload?.authorityRootIdentityHash !== authorityRootIdentityHash
    ) {
      return Object.freeze({
        status: "blocked" as const,
        reason: "provisioning_record_store_current_locator_binding_mismatch",
        recordHash: decoded.canonicalHash,
        locatorBindingMatch: false,
        filesystemEffectIssued: false,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
      });
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "provisioning_record_store_current_locator_binding_candidate",
      recordHash: decoded.canonicalHash,
      locatorBindingMatch: true,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "provisioning_record_store_current_locator_binding_failed",
      recordHash: null,
      locatorBindingMatch: false,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  }
}

export function persistCurrentProvisioningRecordForEffect(
  storageRoot: unknown,
  envelopeBytes: unknown,
) {
  try {
    const paths = storagePaths(storageRoot);
    const decoded = decodeProvisioningRecordEnvelopeCandidate(envelopeBytes);
    const ownedEnvelope =
      decoded.status === "candidate" && decoded.canonicalBytes
        ? Buffer.from(decoded.canonicalBytes)
        : null;
    if (
      !paths ||
      !ownedEnvelope ||
      decoded.status !== "candidate" ||
      !decoded.canonicalHash
    ) {
      return blocked("provisioning_record_store_input_invalid");
    }
    if (fs.existsSync(paths.pending)) {
      return blocked("provisioning_record_store_recovery_required", true);
    }
    if (fs.existsSync(paths.current)) {
      const current = loadCurrent(paths);
      const lineage =
        current && current.pointer.recordHash !== decoded.canonicalHash
          ? verifyProvisioningRecordLineageCandidate({
              previousEnvelopeBytes: current.recordBytes,
              nextEnvelopeBytes: ownedEnvelope,
            })
          : null;
      if (
        !current ||
        (current.pointer.recordHash !== decoded.canonicalHash &&
          (lineage?.status !== "candidate" ||
            lineage.nextRecordHash !== decoded.canonicalHash))
      ) {
        return blocked("provisioning_record_store_lineage_invalid");
      }
    }
    const recordPath = path.join(
      paths.recordsRoot,
      `${decoded.canonicalHash}.json`,
    );
    if (fs.existsSync(recordPath)) {
      const existing = readStableBytes(
        recordPath,
        PROVISIONING_RECORD_PURE_CORE_LIMITS.artifactBytes,
      );
      if (!existing || !Buffer.prototype.equals.call(existing, ownedEnvelope)) {
        return blocked("provisioning_record_store_immutable_conflict");
      }
    } else {
      const recordHandle = fs.openSync(recordPath, "wx", 0o600);
      try {
        fs.writeFileSync(recordHandle, ownedEnvelope);
        fs.fsyncSync(recordHandle);
      } finally {
        fs.closeSync(recordHandle);
      }
      syncDirectory(paths.recordsRoot);
    }
    const pointer = Object.freeze({
      contract: POINTER_CONTRACT,
      contractRevision: POINTER_REVISION,
      recordHash: decoded.canonicalHash,
    });
    const pointerBytes = canonicalPointer(pointer);
    if (!pointerBytes)
      return blocked("provisioning_record_store_pointer_invalid");
    const pointerHandle = fs.openSync(paths.pending, "wx", 0o600);
    try {
      fs.writeFileSync(pointerHandle, pointerBytes);
      fs.fsyncSync(pointerHandle);
    } finally {
      fs.closeSync(pointerHandle);
    }
    fs.renameSync(paths.pending, paths.current);
    const isParentDirectorySynced = syncDirectory(storageRoot as string);
    const confirmed = loadCurrent(paths);
    if (!confirmed || confirmed.pointer.recordHash !== decoded.canonicalHash) {
      return blocked("provisioning_record_store_reread_mismatch", true);
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "provisioning_record_store_persisted_and_reread",
      recordHash: decoded.canonicalHash,
      persistenceCompleted: true,
      recoveryRequired: false,
      parentDirectorySynced: isParentDirectorySynced,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: true,
    });
  } catch {
    return blocked("provisioning_record_store_persistence_failed", true);
  }
}

export function recoverCurrentProvisioningRecordForEffect(
  storageRoot: unknown,
) {
  try {
    const paths = storagePaths(storageRoot);
    if (!paths) return blocked("provisioning_record_store_root_invalid");
    if (!fs.existsSync(paths.pending)) {
      return blocked("provisioning_record_store_recovery_not_required");
    }
    const pending = loadPointerTarget(paths, paths.pending);
    if (!pending) {
      return blocked("provisioning_record_store_pending_invalid", true);
    }
    const current = fs.existsSync(paths.current)
      ? loadPointerTarget(paths, paths.current)
      : null;
    if (fs.existsSync(paths.current) && !current) {
      return blocked("provisioning_record_store_current_invalid", true);
    }
    if (current && current.pointer.recordHash !== pending.pointer.recordHash) {
      const lineage = verifyProvisioningRecordLineageCandidate({
        previousEnvelopeBytes: current.recordBytes,
        nextEnvelopeBytes: pending.recordBytes,
      });
      if (
        lineage.status !== "candidate" ||
        lineage.nextRecordHash !== pending.pointer.recordHash
      ) {
        return blocked(
          "provisioning_record_store_recovery_lineage_invalid",
          true,
        );
      }
    }
    if (current?.pointer.recordHash === pending.pointer.recordHash) {
      fs.unlinkSync(paths.pending);
    } else {
      fs.renameSync(paths.pending, paths.current);
    }
    const isParentDirectorySynced = syncDirectory(storageRoot as string);
    const confirmed = loadCurrent(paths);
    if (
      !confirmed ||
      confirmed.pointer.recordHash !== pending.pointer.recordHash
    ) {
      return blocked(
        "provisioning_record_store_recovery_reread_mismatch",
        true,
      );
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "provisioning_record_store_recovered_and_reread",
      recordHash: confirmed.pointer.recordHash,
      persistenceCompleted: true,
      recoveryRequired: false,
      parentDirectorySynced: isParentDirectorySynced,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: true,
    });
  } catch {
    return blocked("provisioning_record_store_recovery_failed", true);
  }
}

export function describeProvisioningRecordStoreContract() {
  return Object.freeze({
    contract: "crdd-coordinator/provisioning-record-store",
    contractRevision: 1,
    storageDirectory: PROVISIONING_RECORD_STORAGE_DIRECTORY,
    recordsDirectory: PROVISIONING_RECORDS_DIRECTORY,
    currentPointerFile: PROVISIONING_RECORD_CURRENT_FILE,
    recordLayout: "immutable_content_addressed_envelope_hash_json",
    currentPointerContract: POINTER_CONTRACT,
    filesystemRead: "implemented_candidate",
    filesystemWrite: "implemented_candidate",
    currentPointerPersistence: "implemented_candidate",
    recovery: "implemented_candidate_explicit_only",
    repositoryCanonicalRecordStored: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
