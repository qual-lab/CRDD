import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { acquireRuntimeOwnedCandidateStoreKernelLock } from "./candidate-store-kernel-lock.ts";
import {
  consumeRuntimeOwnedCandidateStoreRootCapability,
  inspectRuntimeOwnedWindowsCandidateStore,
} from "./candidate-store-windows-adapter.ts";
import { parseUnambiguousJsonDocument } from "./claude-structured-result.ts";

export const CANDIDATE_BUNDLE_STORE_CONTRACT =
  "crdd-coordinator/candidate-bundle-store";
export const CANDIDATE_BUNDLE_STORE_CONTRACT_REVISION = 4;

const STORE_DIRECTORY_NAME = "crdd-coordinator-candidates-v2";
const STORE_LOCK_NAME = "candidate-store.lock";
const CANDIDATE_ID_PATTERN = /^candidate\.([0-9a-f]{64})\.([0-9a-f]{64})$/u;
const RECOVERY_ID_PATTERN =
  /^candidate-recovery\.([0-9a-f]{64})\.([0-9a-f]{64})$/u;
const STORE_RECOVERY_ID_PATTERN = /^candidate-store-recovery\.([0-9a-f]{64})$/u;
const STORE_ENTRY_PATTERN =
  /^(?:(?:candidate|staged)-[0-9a-f]{64}\.json|pending-[0-9a-f]{64}\.tmp)$/u;
const MAXIMUM_BUNDLE_BYTES = 24 * 1024 * 1024;
const MAXIMUM_STORE_ENTRIES = 128;
const MAXIMUM_STORE_BYTES = 256 * 1024 * 1024;
const MAXIMUM_INVENTORY_SCAN_ENTRIES = 512;
const STORE_LOCK_ATTEMPTS = 25;
const STORE_LOCK_RETRY_MILLISECONDS = 10;
const STORE_LOCK_STALE_OBSERVATION_MILLISECONDS = 5 * 60 * 1_000;
const SECRET_PATTERN =
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{32,}\b|\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b/u;

type CandidateBundle = Readonly<{
  schema: "crdd-coordinator-candidate-bundle/v1";
  baseCommit: string;
  baseTree: string;
  baseManifestHash: string;
  patchHash: string;
  contentManifestHash: string;
  allowedPathsHash: string;
  changedPaths: readonly string[];
  entries: readonly Readonly<{
    relativePath: string;
    operation: "upsert" | "delete";
    byteLength: number;
    sha256: string | null;
    contentBase64: string | null;
  }>[];
}>;
type StoredCandidate = Readonly<{
  schema: "crdd-coordinator/stored-candidate/v2";
  createdAtMs: number;
  expiresAtMs: number;
  informationClassification: "public" | "internal" | "confidential";
  bundle: CandidateBundle;
}>;

type CandidateStoreFaultOperation =
  | "after_pending_rename"
  | "after_publish_rename"
  | "before_discard_remove"
  | "before_gc_remove"
  | "before_lock_remove"
  | "before_pending_open"
  | "before_pending_sync"
  | "before_pending_write"
  | "before_staged_verify"
  | "before_published_verify";

type CandidateStoreRuntime = Readonly<{
  securityBoundary: "production" | "testing";
  temporaryDirectory: () => string;
  nowMs: () => number;
  randomBytes: (size: number) => Buffer;
  injectFault: (operation: CandidateStoreFaultOperation) => void;
}>;

type CandidateStoreTestingOptions = Readonly<{
  temporaryDirectory: string;
  nowMs?: () => number;
  randomBytes?: (size: number) => Buffer;
  injectFault?: (operation: CandidateStoreFaultOperation) => void;
}>;

const productionRuntime: CandidateStoreRuntime = Object.freeze({
  securityBoundary: "production",
  temporaryDirectory: () => "",
  nowMs: Date.now,
  randomBytes,
  injectFault: () => {},
});

class CandidateStoreFailure extends Error {
  readonly recoveryId: string | null;
  readonly storeRecoveryId: string | null;
  readonly manualRecoveryRequired: boolean;

  constructor(
    reason: string,
    recoveryId: string | null = null,
    manualRecoveryRequired = false,
    storeRecoveryId: string | null = null,
  ) {
    super(reason);
    this.recoveryId = recoveryId;
    this.storeRecoveryId = storeRecoveryId;
    this.manualRecoveryRequired = manualRecoveryRequired;
  }
}

function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? (error as { code?: unknown }).code
    : null;
}

function storeDirectory(runtime: CandidateStoreRuntime) {
  if (runtime.securityBoundary === "production") {
    const observation = inspectRuntimeOwnedWindowsCandidateStore(
      true,
      new Date().toISOString(),
    );
    const root = consumeRuntimeOwnedCandidateStoreRootCapability(
      observation.rootCapability,
    );
    if (
      observation.status !== "candidate" ||
      !root ||
      observation.selectedUserBindingVerified !== true ||
      observation.protectionVerified !== true ||
      observation.stableIdentityObserved !== true
    ) {
      throw new CandidateStoreFailure(
        observation.reason,
        null,
        observation.manualRecoveryRequired === true,
      );
    }
    return Object.freeze({
      store: root.rootPath,
      candidateStoreIdentityHash: root.candidateStoreIdentityHash,
      candidateStoreProtectionHash: root.candidateStoreProtectionHash,
      localUserBindingHash: root.localUserBindingHash,
    });
  }
  const temporaryParent = fs.realpathSync.native(runtime.temporaryDirectory());
  const parentMetadata = fs.lstatSync(temporaryParent);
  if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink())
    throw new Error("candidate_store_parent_invalid");
  const store = path.join(temporaryParent, STORE_DIRECTORY_NAME);
  try {
    fs.mkdirSync(store, { mode: 0o700 });
  } catch (error) {
    if (errorCode(error) !== "EEXIST") throw error;
  }
  const metadata = fs.lstatSync(store);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(store) !== store ||
    path.dirname(store) !== temporaryParent
  ) {
    throw new Error("candidate_store_directory_invalid");
  }
  return Object.freeze({
    store,
    candidateStoreIdentityHash: "testing",
    candidateStoreProtectionHash: "testing",
    localUserBindingHash: "testing",
  });
}

function verifyProductionStoreDirectory(
  runtime: CandidateStoreRuntime,
  expected: ReturnType<typeof storeDirectory>,
) {
  if (runtime.securityBoundary !== "production") return true;
  const observation = inspectRuntimeOwnedWindowsCandidateStore(
    false,
    new Date().toISOString(),
  );
  const root = consumeRuntimeOwnedCandidateStoreRootCapability(
    observation.rootCapability,
  );
  return (
    observation.status === "candidate" &&
    root !== null &&
    root.candidateStoreIdentityHash === expected.candidateStoreIdentityHash &&
    root.candidateStoreProtectionHash ===
      expected.candidateStoreProtectionHash &&
    root.localUserBindingHash === expected.localUserBindingHash &&
    root.rootPath === expected.store
  );
}

function candidateLocation(rawCandidateId: unknown) {
  if (typeof rawCandidateId !== "string") return null;
  const published = CANDIDATE_ID_PATTERN.exec(rawCandidateId);
  const recovery = RECOVERY_ID_PATTERN.exec(rawCandidateId);
  const match = published ?? recovery;
  if (!match?.[1] || !match[2]) return null;
  return Object.freeze({
    candidateId: rawCandidateId,
    storageId: match[1],
    expectedHash: match[2],
    kind: published ? ("published" as const) : ("staged" as const),
  });
}

function validDigest(value: unknown, bytes: 20 | 32) {
  return (
    typeof value === "string" &&
    new RegExp(`^[0-9a-f]{${bytes * 2}}$`, "u").test(value)
  );
}

function validRelativePath(value: unknown) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= 1_024 &&
    !path.isAbsolute(value) &&
    !value.includes("\\") &&
    value
      .split("/")
      .every((segment) => segment && segment !== "." && segment !== "..")
  );
}

function normalizeBundle(rawBundle: unknown): CandidateBundle | null {
  if (!rawBundle || typeof rawBundle !== "object" || Array.isArray(rawBundle))
    return null;
  const bundle = rawBundle as Record<string, unknown>;
  const keys = Object.keys(bundle).sort();
  const expectedKeys = [
    "allowedPathsHash",
    "baseCommit",
    "baseManifestHash",
    "baseTree",
    "changedPaths",
    "contentManifestHash",
    "entries",
    "patchHash",
    "schema",
  ].sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  )
    return null;
  if (
    bundle.schema !== "crdd-coordinator-candidate-bundle/v1" ||
    !validDigest(bundle.baseCommit, 20) ||
    !validDigest(bundle.baseTree, 20) ||
    !validDigest(bundle.baseManifestHash, 32) ||
    !validDigest(bundle.patchHash, 32) ||
    !validDigest(bundle.contentManifestHash, 32) ||
    !validDigest(bundle.allowedPathsHash, 32) ||
    !Array.isArray(bundle.changedPaths) ||
    !Array.isArray(bundle.entries) ||
    bundle.changedPaths.length > 1_000 ||
    bundle.entries.length !== bundle.changedPaths.length
  ) {
    return null;
  }
  const changedPaths: string[] = [];
  const entries: Array<CandidateBundle["entries"][number]> = [];
  for (let index = 0; index < bundle.changedPaths.length; index += 1) {
    const relativePath = bundle.changedPaths[index];
    const rawEntry = bundle.entries[index];
    if (
      !validRelativePath(relativePath) ||
      !rawEntry ||
      typeof rawEntry !== "object" ||
      Array.isArray(rawEntry)
    ) {
      return null;
    }
    const entry = rawEntry as Record<string, unknown>;
    if (
      Object.keys(entry).sort().join("\0") !==
        ["byteLength", "contentBase64", "operation", "relativePath", "sha256"]
          .sort()
          .join("\0") ||
      entry.relativePath !== relativePath ||
      (entry.operation !== "upsert" && entry.operation !== "delete") ||
      !Number.isSafeInteger(entry.byteLength) ||
      (entry.byteLength as number) < 0
    ) {
      return null;
    }
    if (entry.operation === "delete") {
      if (
        entry.byteLength !== 0 ||
        entry.sha256 !== null ||
        entry.contentBase64 !== null
      ) {
        return null;
      }
    } else {
      if (
        !validDigest(entry.sha256, 32) ||
        typeof entry.contentBase64 !== "string"
      ) {
        return null;
      }
      const content = Buffer.from(entry.contentBase64, "base64");
      if (
        content.byteLength !== entry.byteLength ||
        content.toString("base64") !== entry.contentBase64 ||
        createHash("sha256").update(content).digest("hex") !== entry.sha256
      ) {
        return null;
      }
    }
    changedPaths.push(relativePath);
    entries.push(
      Object.freeze({
        relativePath,
        operation: entry.operation,
        byteLength: entry.byteLength as number,
        sha256: entry.sha256 as string | null,
        contentBase64: entry.contentBase64 as string | null,
      }),
    );
  }
  const sortedPaths = [...changedPaths].sort((left, right) =>
    Buffer.from(left).compare(Buffer.from(right)),
  );
  if (
    new Set(changedPaths).size !== changedPaths.length ||
    changedPaths.some((value, index) => value !== sortedPaths[index])
  ) {
    return null;
  }
  return Object.freeze({
    schema: "crdd-coordinator-candidate-bundle/v1",
    baseCommit: bundle.baseCommit as string,
    baseTree: bundle.baseTree as string,
    baseManifestHash: bundle.baseManifestHash as string,
    patchHash: bundle.patchHash as string,
    contentManifestHash: bundle.contentManifestHash as string,
    allowedPathsHash: bundle.allowedPathsHash as string,
    changedPaths: Object.freeze(changedPaths),
    entries: Object.freeze(entries),
  });
}

function normalizeStoredCandidate(raw: unknown): StoredCandidate | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (
    Object.keys(value).sort().join("\0") !==
      [
        "bundle",
        "createdAtMs",
        "expiresAtMs",
        "informationClassification",
        "schema",
      ]
        .sort()
        .join("\0") ||
    value.schema !== "crdd-coordinator/stored-candidate/v2" ||
    !Number.isSafeInteger(value.createdAtMs) ||
    !Number.isSafeInteger(value.expiresAtMs) ||
    (value.createdAtMs as number) < 0 ||
    (value.expiresAtMs as number) <= (value.createdAtMs as number) ||
    !["public", "internal", "confidential"].includes(
      value.informationClassification as string,
    )
  ) {
    return null;
  }
  const bundle = normalizeBundle(value.bundle);
  return bundle
    ? Object.freeze({
        schema: "crdd-coordinator/stored-candidate/v2" as const,
        createdAtMs: value.createdAtMs as number,
        expiresAtMs: value.expiresAtMs as number,
        informationClassification: value.informationClassification as
          | "public"
          | "internal"
          | "confidential",
        bundle,
      })
    : null;
}

function containsRecognizedSecret(bundle: CandidateBundle) {
  return bundle.entries.some((entry) => {
    if (entry.operation !== "upsert" || entry.contentBase64 === null)
      return false;
    return SECRET_PATTERN.test(
      Buffer.from(entry.contentBase64, "base64").toString("utf8"),
    );
  });
}

type StableFileIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  size: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
}>;

function stableFileIdentity(metadata: fs.BigIntStats): StableFileIdentity {
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 0n) {
    throw new CandidateStoreFailure("candidate_store_entry_invalid");
  }
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
    size: metadata.size,
    mtimeNs: metadata.mtimeNs,
    ctimeNs: metadata.ctimeNs,
  });
}

function sameStableFileIdentity(
  left: StableFileIdentity,
  right: StableFileIdentity,
) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function candidateStoreRecoveryId(name: string, identity: StableFileIdentity) {
  return `candidate-store-recovery.${createHash("sha256")
    .update("crdd-candidate-store-recovery-v1\0")
    .update(name, "utf8")
    .update("\0")
    .update(identity.dev.toString(16))
    .update("\0")
    .update(identity.ino.toString(16))
    .update("\0")
    .update(identity.birthtimeNs.toString(16))
    .update("\0")
    .update(identity.size.toString(16))
    .update("\0")
    .update(identity.mtimeNs.toString(16))
    .update("\0")
    .update(identity.ctimeNs.toString(16))
    .digest("hex")}`;
}

function waitForLockRetry() {
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(4)),
    0,
    0,
    STORE_LOCK_RETRY_MILLISECONDS,
  );
}

function stableRemove(
  runtime: CandidateStoreRuntime,
  target: string,
  identity: StableFileIdentity,
  faultOperation: CandidateStoreFaultOperation,
) {
  const current = stableFileIdentity(fs.lstatSync(target, { bigint: true }));
  if (!sameStableFileIdentity(identity, current)) {
    throw new CandidateStoreFailure("candidate_store_entry_changed");
  }
  runtime.injectFault(faultOperation);
  fs.rmSync(target);
  try {
    fs.lstatSync(target);
    throw new CandidateStoreFailure("candidate_store_cleanup_unconfirmed");
  } catch (error) {
    if (error instanceof CandidateStoreFailure) throw error;
    if (errorCode(error) !== "ENOENT") throw error;
  }
}

function withStoreLock<T>(
  runtime: CandidateStoreRuntime,
  operation: (store: string, nowMs: number) => T,
) {
  let resolvedStore: ReturnType<typeof storeDirectory>;
  try {
    resolvedStore = storeDirectory(runtime);
  } catch (error) {
    const failure =
      error instanceof CandidateStoreFailure
        ? error
        : new CandidateStoreFailure("candidate_store_root_unavailable");
    return Object.freeze({
      status: "blocked" as const,
      reason: failure.message,
      value: null,
      recoveryId: failure.recoveryId,
      storeRecoveryId: failure.storeRecoveryId,
      manualRecoveryRequired: failure.manualRecoveryRequired,
    });
  }
  const store = resolvedStore.store;
  if (runtime.securityBoundary === "production") {
    const kernelLock = acquireRuntimeOwnedCandidateStoreKernelLock(
      resolvedStore.candidateStoreProtectionHash,
    );
    if (!kernelLock) {
      return Object.freeze({
        status: "blocked" as const,
        reason: "candidate_store_kernel_lock_unavailable",
        value: null,
        recoveryId: null,
        storeRecoveryId: null,
        manualRecoveryRequired: false,
      });
    }
    let value: T | null = null;
    let failure: CandidateStoreFailure | null = null;
    try {
      const nowMs = runtime.nowMs();
      if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
        throw new CandidateStoreFailure("candidate_store_clock_invalid");
      }
      value = operation(store, nowMs);
      if (!verifyProductionStoreDirectory(runtime, resolvedStore)) {
        throw new CandidateStoreFailure(
          "candidate_store_root_changed_recovery_required",
          recoverableCandidateIdFromValue(value),
          true,
        );
      }
    } catch (error) {
      failure =
        error instanceof CandidateStoreFailure
          ? error
          : new CandidateStoreFailure("candidate_store_operation_failed");
    }
    if (!kernelLock.release()) {
      return Object.freeze({
        status: "blocked" as const,
        reason: "candidate_store_kernel_lock_release_unconfirmed",
        value,
        recoveryId:
          failure?.recoveryId ?? recoverableCandidateIdFromValue(value),
        storeRecoveryId: failure?.storeRecoveryId ?? null,
        manualRecoveryRequired: true,
      });
    }
    return failure
      ? Object.freeze({
          status: "blocked" as const,
          reason: failure.message,
          value,
          recoveryId: failure.recoveryId,
          storeRecoveryId: failure.storeRecoveryId,
          manualRecoveryRequired: failure.manualRecoveryRequired,
        })
      : Object.freeze({
          status: "completed" as const,
          reason: "candidate_store_operation_completed",
          value: value as T,
          recoveryId: null,
          storeRecoveryId: null,
          manualRecoveryRequired: false,
        });
  }
  const lockTarget = path.join(store, STORE_LOCK_NAME);
  let handle: number | null = null;
  for (let attempt = 0; attempt < STORE_LOCK_ATTEMPTS; attempt += 1) {
    try {
      handle = fs.openSync(lockTarget, "wx", 0o600);
      break;
    } catch (error) {
      if (errorCode(error) !== "EEXIST") {
        return Object.freeze({
          status: "blocked" as const,
          reason: "candidate_store_lock_create_failed",
          value: null,
          recoveryId: null,
          storeRecoveryId: null,
          manualRecoveryRequired: true,
        });
      }
      if (attempt + 1 < STORE_LOCK_ATTEMPTS) waitForLockRetry();
    }
  }
  if (handle === null) {
    let isStale = false;
    try {
      const metadata = fs.lstatSync(lockTarget, { bigint: true });
      stableFileIdentity(metadata);
      const nowMs = runtime.nowMs();
      isStale =
        Number.isSafeInteger(nowMs) &&
        nowMs >= 0 &&
        metadata.mtimeNs +
          BigInt(STORE_LOCK_STALE_OBSERVATION_MILLISECONDS) * 1_000_000n <=
          BigInt(nowMs) * 1_000_000n;
    } catch {
      isStale = true;
    }
    return Object.freeze({
      status: "blocked" as const,
      reason: isStale
        ? "candidate_store_stale_lock_manual_recovery_required"
        : "candidate_store_lock_unavailable",
      value: null,
      recoveryId: null,
      storeRecoveryId: null,
      manualRecoveryRequired: isStale,
    });
  }

  let lockIdentity: StableFileIdentity;
  try {
    const nowMs = runtime.nowMs();
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
      throw new CandidateStoreFailure("candidate_store_clock_invalid");
    }
    fs.writeFileSync(
      handle,
      Buffer.from(
        `${JSON.stringify({ schema: "crdd-coordinator/candidate-store-lock/v1", acquiredAtMs: nowMs })}\n`,
        "utf8",
      ),
    );
    fs.fsyncSync(handle);
    lockIdentity = stableFileIdentity(fs.fstatSync(handle, { bigint: true }));
  } catch (error) {
    fs.closeSync(handle);
    try {
      const identity = stableFileIdentity(
        fs.lstatSync(lockTarget, { bigint: true }),
      );
      stableRemove(runtime, lockTarget, identity, "before_lock_remove");
    } catch {
      return Object.freeze({
        status: "blocked" as const,
        reason: "candidate_store_lock_initialization_recovery_required",
        value: null,
        recoveryId: null,
        storeRecoveryId: null,
        manualRecoveryRequired: true,
      });
    }
    return Object.freeze({
      status: "blocked" as const,
      reason:
        error instanceof CandidateStoreFailure
          ? error.message
          : "candidate_store_lock_initialization_failed",
      value: null,
      recoveryId: null,
      storeRecoveryId: null,
      manualRecoveryRequired: false,
    });
  }

  let value: T | null = null;
  let failure: CandidateStoreFailure | null = null;
  try {
    value = operation(store, runtime.nowMs());
  } catch (error) {
    failure =
      error instanceof CandidateStoreFailure
        ? error
        : new CandidateStoreFailure("candidate_store_operation_failed");
  } finally {
    fs.closeSync(handle);
  }
  try {
    stableRemove(runtime, lockTarget, lockIdentity, "before_lock_remove");
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "candidate_store_lock_release_recovery_required",
      value,
      recoveryId: failure?.recoveryId ?? null,
      storeRecoveryId: failure?.storeRecoveryId ?? null,
      manualRecoveryRequired: true,
    });
  }
  return failure
    ? Object.freeze({
        status: "blocked" as const,
        reason: failure.message,
        value,
        recoveryId: failure.recoveryId,
        storeRecoveryId: failure.storeRecoveryId,
        manualRecoveryRequired: failure.manualRecoveryRequired,
      })
    : Object.freeze({
        status: "completed" as const,
        reason: "candidate_store_operation_completed",
        value: value as T,
        recoveryId: null,
        storeRecoveryId: null,
        manualRecoveryRequired: false,
      });
}

function readStableCandidate(
  target: string,
  expectedHash: string,
  runtime?: CandidateStoreRuntime,
  verifyFault?: CandidateStoreFaultOperation,
) {
  if (runtime && verifyFault) runtime.injectFault(verifyFault);
  const handle = fs.openSync(target, "r");
  try {
    const before = fs.fstatSync(handle, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size <= 0n ||
      before.size > BigInt(MAXIMUM_BUNDLE_BYTES)
    ) {
      throw new Error("candidate_bundle_file_invalid");
    }
    const content = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < content.byteLength) {
      const readBytes = fs.readSync(
        handle,
        content,
        offset,
        content.byteLength - offset,
        offset,
      );
      if (readBytes <= 0) throw new Error("candidate_bundle_file_changed");
      offset += readBytes;
    }
    const after = fs.fstatSync(handle, { bigint: true });
    const current = fs.lstatSync(target, { bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.birthtimeNs !== after.birthtimeNs ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      !current.isFile() ||
      current.isSymbolicLink() ||
      current.dev !== before.dev ||
      current.ino !== before.ino ||
      current.birthtimeNs !== before.birthtimeNs ||
      createHash("sha256").update(content).digest("hex") !== expectedHash
    ) {
      throw new Error("candidate_bundle_file_changed");
    }
    return content;
  } finally {
    fs.closeSync(handle);
  }
}

function storedCandidate(content: Buffer) {
  const parsed = parseUnambiguousJsonDocument(
    new TextDecoder("utf-8", { fatal: true }).decode(content),
  );
  return normalizeStoredCandidate(parsed);
}

function recoveryId(storageId: string, bundleHash: string) {
  return `candidate-recovery.${storageId}.${bundleHash}`;
}

function physicalTargets(store: string, storageId: string) {
  return Object.freeze({
    pending: path.join(store, `pending-${storageId}.tmp`),
    staged: path.join(store, `staged-${storageId}.json`),
    published: path.join(store, `candidate-${storageId}.json`),
  });
}

function existingTargets(store: string, storageId: string) {
  const targets = physicalTargets(store, storageId);
  return Object.freeze(
    (Object.entries(targets) as Array<[keyof typeof targets, string]>).flatMap(
      ([kind, target]) => {
        try {
          const identity = stableFileIdentity(
            fs.lstatSync(target, { bigint: true }),
          );
          return [Object.freeze({ kind, target, identity })];
        } catch (error) {
          if (errorCode(error) === "ENOENT") return [];
          throw error;
        }
      },
    ),
  );
}

function storeInventoryAndGc(
  runtime: CandidateStoreRuntime,
  store: string,
  nowMs: number,
) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new CandidateStoreFailure("candidate_store_clock_invalid");
  }
  const directory = fs.opendirSync(store);
  const entries: Array<{
    name: string;
    target: string;
    identity: StableFileIdentity;
  }> = [];
  let scannedBytes = 0;
  try {
    while (true) {
      const entry = directory.readSync();
      if (!entry) break;
      if (entry.name === STORE_LOCK_NAME) continue;
      if (entries.length >= MAXIMUM_INVENTORY_SCAN_ENTRIES) {
        throw new CandidateStoreFailure(
          "candidate_store_inventory_scan_budget_exceeded",
        );
      }
      if (!entry.isFile() || !STORE_ENTRY_PATTERN.test(entry.name)) {
        let storeRecoveryId: string | null = null;
        if (entry.isFile()) {
          try {
            const identity = stableFileIdentity(
              fs.lstatSync(path.join(store, entry.name), { bigint: true }),
            );
            storeRecoveryId = candidateStoreRecoveryId(entry.name, identity);
          } catch {
            storeRecoveryId = null;
          }
        }
        throw new CandidateStoreFailure(
          "candidate_store_unknown_entry",
          null,
          true,
          storeRecoveryId,
        );
      }
      const target = path.join(store, entry.name);
      const identity = stableFileIdentity(
        fs.lstatSync(target, { bigint: true }),
      );
      scannedBytes += Number(identity.size);
      if (scannedBytes > MAXIMUM_STORE_BYTES) {
        throw new CandidateStoreFailure("candidate_store_byte_budget_exceeded");
      }
      entries.push({
        name: entry.name,
        target,
        identity,
      });
    }
  } finally {
    directory.closeSync();
  }

  let deletedEntries = 0;
  for (const entry of entries) {
    let stored: StoredCandidate | null = null;
    let hash: string | null = null;
    try {
      if (
        entry.identity.size <= 0n ||
        entry.identity.size > BigInt(MAXIMUM_BUNDLE_BYTES)
      ) {
        continue;
      }
      const content = fs.readFileSync(entry.target);
      hash = createHash("sha256").update(content).digest("hex");
      stored = storedCandidate(content);
    } catch {
      stored = null;
    }
    if (!stored) {
      throw new CandidateStoreFailure(
        "candidate_store_damaged_entry",
        null,
        true,
        candidateStoreRecoveryId(entry.name, entry.identity),
      );
    }
    if (stored.expiresAtMs > nowMs) continue;
    const storageId = /-([0-9a-f]{64})\.(?:json|tmp)$/u.exec(entry.name)?.[1];
    const ownedRecoveryId =
      storageId && hash ? recoveryId(storageId, hash) : null;
    try {
      stableRemove(runtime, entry.target, entry.identity, "before_gc_remove");
      deletedEntries += 1;
    } catch {
      throw new CandidateStoreFailure(
        "candidate_store_gc_cleanup_recovery_required",
        ownedRecoveryId,
        true,
      );
    }
  }

  let count = 0;
  let totalBytes = 0;
  const refreshed = fs.opendirSync(store);
  try {
    while (true) {
      const entry = refreshed.readSync();
      if (!entry) break;
      if (entry.name === STORE_LOCK_NAME) continue;
      if (!entry.isFile() || !STORE_ENTRY_PATTERN.test(entry.name)) {
        let storeRecoveryId: string | null = null;
        if (entry.isFile()) {
          try {
            const identity = stableFileIdentity(
              fs.lstatSync(path.join(store, entry.name), { bigint: true }),
            );
            storeRecoveryId = candidateStoreRecoveryId(entry.name, identity);
          } catch {
            storeRecoveryId = null;
          }
        }
        throw new CandidateStoreFailure(
          "candidate_store_unknown_entry",
          null,
          true,
          storeRecoveryId,
        );
      }
      count += 1;
      if (count > MAXIMUM_STORE_ENTRIES) {
        throw new CandidateStoreFailure(
          "candidate_store_entry_budget_exceeded",
        );
      }
      const metadata = stableFileIdentity(
        fs.lstatSync(path.join(store, entry.name), { bigint: true }),
      );
      totalBytes += Number(metadata.size);
      if (totalBytes > MAXIMUM_STORE_BYTES) {
        throw new CandidateStoreFailure("candidate_store_byte_budget_exceeded");
      }
    }
  } finally {
    refreshed.closeSync();
  }
  return Object.freeze({ count, totalBytes, deletedEntries });
}

function blockedResult(
  reason: string,
  candidateRecoveryId: string | null,
  manualRecoveryRequired: boolean,
  candidateStoreRecoveryId: string | null = null,
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    candidateRecoveryId,
    candidateStoreRecoveryId,
    manualRecoveryRequired,
    hostPathReported: false,
  });
}

function recoverableCandidateIdFromValue(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as Readonly<Record<string, unknown>>;
  if (
    typeof record.candidateRecoveryId === "string" &&
    RECOVERY_ID_PATTERN.test(record.candidateRecoveryId)
  ) {
    return record.candidateRecoveryId;
  }
  if (
    typeof record.candidateId === "string" &&
    CANDIDATE_ID_PATTERN.test(record.candidateId)
  ) {
    const location = candidateLocation(record.candidateId);
    return location
      ? recoveryId(location.storageId, location.expectedHash)
      : null;
  }
  return null;
}

function persistRuntimeOwnedCandidateBundleWithRuntime(
  runtime: CandidateStoreRuntime,
  rawBundle: unknown,
  rawPolicy: unknown,
) {
  try {
    const bundle = normalizeBundle(rawBundle);
    if (!rawPolicy || typeof rawPolicy !== "object" || Array.isArray(rawPolicy))
      return null;
    const policy = rawPolicy as Record<string, unknown>;
    if (
      !bundle ||
      containsRecognizedSecret(bundle) ||
      policy.candidatePersistenceAllowed !== true ||
      !Number.isSafeInteger(policy.candidateRetentionHours) ||
      (policy.candidateRetentionHours as number) < 1 ||
      (policy.candidateRetentionHours as number) > 168 ||
      !["public", "internal", "confidential"].includes(
        policy.informationClassification as string,
      )
    ) {
      return null;
    }
    const nowMs = runtime.nowMs();
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) return null;
    const stored = Object.freeze({
      schema: "crdd-coordinator/stored-candidate/v2" as const,
      createdAtMs: nowMs,
      expiresAtMs:
        nowMs + (policy.candidateRetentionHours as number) * 60 * 60 * 1_000,
      informationClassification: policy.informationClassification as
        | "public"
        | "internal"
        | "confidential",
      bundle,
    });
    const serialized = Buffer.from(`${JSON.stringify(stored)}\n`, "utf8");
    if (serialized.byteLength > MAXIMUM_BUNDLE_BYTES) return null;
    const bundleHash = createHash("sha256").update(serialized).digest("hex");
    const storageId = createHash("sha256")
      .update("crdd-candidate-storage-v1\0")
      .update(runtime.randomBytes(32))
      .digest("hex");
    const ownedRecoveryId = recoveryId(storageId, bundleHash);
    const locked = withStoreLock(runtime, (store, lockedNowMs) => {
      const inventory = storeInventoryAndGc(runtime, store, lockedNowMs);
      if (
        inventory.count >= MAXIMUM_STORE_ENTRIES ||
        inventory.totalBytes + serialized.byteLength > MAXIMUM_STORE_BYTES
      ) {
        throw new CandidateStoreFailure(
          "candidate_store_capacity_reservation_failed",
        );
      }
      const targets = physicalTargets(store, storageId);
      let handle: number | null = null;
      let pendingIdentity: StableFileIdentity | null = null;
      let ownedEntityCreated = false;
      try {
        runtime.injectFault("before_pending_open");
        handle = fs.openSync(targets.pending, "wx", 0o600);
        ownedEntityCreated = true;
        pendingIdentity = stableFileIdentity(
          fs.fstatSync(handle, { bigint: true }),
        );
        runtime.injectFault("before_pending_write");
        fs.writeFileSync(handle, serialized);
        runtime.injectFault("before_pending_sync");
        fs.fsyncSync(handle);
        pendingIdentity = stableFileIdentity(
          fs.fstatSync(handle, { bigint: true }),
        );
        fs.closeSync(handle);
        handle = null;
        fs.renameSync(targets.pending, targets.staged);
        runtime.injectFault("after_pending_rename");
        readStableCandidate(
          targets.staged,
          bundleHash,
          runtime,
          "before_staged_verify",
        );
      } catch {
        if (handle !== null) {
          try {
            pendingIdentity = stableFileIdentity(
              fs.fstatSync(handle, { bigint: true }),
            );
          } catch {
            pendingIdentity = null;
          }
          try {
            fs.closeSync(handle);
          } catch {
            throw new CandidateStoreFailure(
              "candidate_store_persist_recovery_required",
              ownedRecoveryId,
              true,
            );
          }
        }
        let existingTargetEntries: ReturnType<typeof existingTargets>;
        try {
          existingTargetEntries = existingTargets(store, storageId);
        } catch {
          throw new CandidateStoreFailure(
            "candidate_store_persist_recovery_required",
            ownedEntityCreated ? ownedRecoveryId : null,
            ownedEntityCreated,
          );
        }
        const stagedOrPublishedEntries = existingTargetEntries.filter(
          (entry) => entry.kind === "staged" || entry.kind === "published",
        );
        if (stagedOrPublishedEntries.length > 0) {
          throw new CandidateStoreFailure(
            "candidate_store_persist_recovery_required",
            ownedRecoveryId,
            false,
          );
        }
        const pending = existingTargetEntries.find(
          (entry) => entry.kind === "pending",
        );
        if (pending) {
          try {
            stableRemove(
              runtime,
              pending.target,
              pendingIdentity ?? pending.identity,
              "before_discard_remove",
            );
          } catch {
            throw new CandidateStoreFailure(
              "candidate_store_persist_recovery_required",
              ownedRecoveryId,
              true,
            );
          }
        }
        throw new CandidateStoreFailure("candidate_store_persist_failed");
      }
      return Object.freeze({
        status: "staged" as const,
        candidateRecoveryId: ownedRecoveryId,
        bundleHash,
        byteLength: serialized.byteLength,
        expiresAtMs: stored.expiresAtMs,
        hostPathReported: false,
        secretScanHeuristic: true,
        credentialAbsenceVerified: false,
      });
    });
    if (locked.status === "completed") return locked.value;
    const remainingRecoveryId =
      locked.recoveryId ?? locked.value?.candidateRecoveryId ?? null;
    return Object.freeze({
      ...blockedResult(
        locked.reason,
        remainingRecoveryId,
        locked.manualRecoveryRequired,
        locked.storeRecoveryId,
      ),
      bundleHash,
      byteLength: serialized.byteLength,
      expiresAtMs: stored.expiresAtMs,
      secretScanHeuristic: true,
      credentialAbsenceVerified: false,
    });
  } catch {
    return null;
  }
}

function readRuntimeOwnedCandidateBundleWithRuntime(
  runtime: CandidateStoreRuntime,
  rawCandidateId: unknown,
) {
  try {
    const location = candidateLocation(rawCandidateId);
    if (location?.kind !== "published") return null;
    const locked = withStoreLock(runtime, (store, nowMs) => {
      storeInventoryAndGc(runtime, store, nowMs);
      const target = physicalTargets(store, location.storageId).published;
      const content = readStableCandidate(target, location.expectedHash);
      const stored = storedCandidate(content);
      if (!stored || stored.expiresAtMs <= nowMs) {
        throw new CandidateStoreFailure("candidate_bundle_not_exportable");
      }
      return Object.freeze({
        status: "exported" as const,
        candidateId: location.candidateId,
        informationClassification: stored.informationClassification,
        expiresAtMs: stored.expiresAtMs,
        bundle: stored.bundle,
        hostPathReported: false,
        secretScanHeuristic: true,
        credentialAbsenceVerified: false,
      });
    });
    if (locked.status === "completed") return locked.value;
    return locked.reason === "candidate_store_operation_failed" &&
      !locked.manualRecoveryRequired &&
      !locked.recoveryId &&
      !locked.storeRecoveryId
      ? null
      : blockedResult(
          locked.reason,
          locked.recoveryId,
          locked.manualRecoveryRequired,
          locked.storeRecoveryId,
        );
  } catch {
    return null;
  }
}

function publishRuntimeOwnedCandidateBundleWithRuntime(
  runtime: CandidateStoreRuntime,
  rawRecoveryId: unknown,
) {
  try {
    const location = candidateLocation(rawRecoveryId);
    if (location?.kind !== "staged") return null;
    const locked = withStoreLock(runtime, (store, nowMs) => {
      try {
        storeInventoryAndGc(runtime, store, nowMs);
        const existingTargetEntries = existingTargets(
          store,
          location.storageId,
        );
        if (existingTargetEntries.length !== 1) {
          throw new CandidateStoreFailure(
            existingTargetEntries.length > 1
              ? "candidate_bundle_recovery_ambiguous"
              : "candidate_bundle_not_available",
            existingTargetEntries.length > 1 ? location.candidateId : null,
          );
        }
        const current = existingTargetEntries[0];
        if (!current) {
          throw new CandidateStoreFailure("candidate_bundle_not_available");
        }
        if (current.kind === "pending") {
          throw new CandidateStoreFailure(
            "candidate_bundle_pending_recovery_required",
            location.candidateId,
          );
        }
        const verifyFault =
          current.kind === "staged"
            ? "before_staged_verify"
            : "before_published_verify";
        const content = readStableCandidate(
          current.target,
          location.expectedHash,
          runtime,
          verifyFault,
        );
        const stored = storedCandidate(content);
        if (!stored || stored.expiresAtMs <= nowMs) {
          throw new CandidateStoreFailure(
            "candidate_bundle_not_publishable",
            location.candidateId,
          );
        }
        const targets = physicalTargets(store, location.storageId);
        if (current.kind === "staged") {
          fs.renameSync(current.target, targets.published);
          runtime.injectFault("after_publish_rename");
          readStableCandidate(
            targets.published,
            location.expectedHash,
            runtime,
            "before_published_verify",
          );
        }
        return Object.freeze({
          status: "published" as const,
          candidateId: `candidate.${location.storageId}.${location.expectedHash}`,
          expiresAtMs: stored.expiresAtMs,
          hostPathReported: false,
        });
      } catch (error) {
        if (error instanceof CandidateStoreFailure) throw error;
        let isOwnedEntityPresent = false;
        try {
          isOwnedEntityPresent =
            existingTargets(store, location.storageId).length > 0;
        } catch {
          isOwnedEntityPresent = true;
        }
        throw new CandidateStoreFailure(
          "candidate_bundle_publish_recovery_required",
          isOwnedEntityPresent ? location.candidateId : null,
          isOwnedEntityPresent,
        );
      }
    });
    return locked.status === "completed"
      ? locked.value
      : blockedResult(
          locked.reason,
          locked.recoveryId,
          locked.manualRecoveryRequired,
          locked.storeRecoveryId,
        );
  } catch {
    return null;
  }
}

function discardRuntimeOwnedCandidateBundleWithRuntime(
  runtime: CandidateStoreRuntime,
  rawCandidateId: unknown,
) {
  try {
    const location = candidateLocation(rawCandidateId);
    if (!location) return Object.freeze({ status: "blocked" as const });
    const ownedRecoveryId = recoveryId(
      location.storageId,
      location.expectedHash,
    );
    const locked = withStoreLock(runtime, (store) => {
      const existingTargetEntries = existingTargets(
        store,
        location.storageId,
      ).filter(
        (entry) => location.kind === "staged" || entry.kind === "published",
      );
      if (existingTargetEntries.length !== 1) {
        throw new CandidateStoreFailure(
          existingTargetEntries.length > 1
            ? "candidate_bundle_recovery_ambiguous"
            : "candidate_bundle_not_available",
          existingTargetEntries.length > 1 ? ownedRecoveryId : null,
        );
      }
      const target = existingTargetEntries[0];
      if (!target) {
        throw new CandidateStoreFailure("candidate_bundle_not_available");
      }
      if (target.kind !== "pending") {
        readStableCandidate(target.target, location.expectedHash);
      }
      try {
        stableRemove(
          runtime,
          target.target,
          target.identity,
          "before_discard_remove",
        );
      } catch {
        throw new CandidateStoreFailure(
          "candidate_bundle_discard_recovery_required",
          ownedRecoveryId,
          true,
        );
      }
      return Object.freeze({ status: "discarded" as const });
    });
    return locked.status === "completed"
      ? locked.value
      : blockedResult(
          locked.reason,
          locked.recoveryId,
          locked.manualRecoveryRequired,
          locked.storeRecoveryId,
        );
  } catch {
    return Object.freeze({ status: "blocked" as const });
  }
}

function recoverRuntimeOwnedCandidateStoreWithRuntime(
  runtime: CandidateStoreRuntime,
  rawRecoveryId: unknown,
) {
  try {
    if (
      typeof rawRecoveryId !== "string" ||
      !STORE_RECOVERY_ID_PATTERN.test(rawRecoveryId)
    ) {
      return blockedResult("candidate_store_recovery_id_invalid", null, false);
    }
    const locked = withStoreLock(runtime, (store) => {
      const directory = fs.opendirSync(store);
      const matches: Array<{
        target: string;
        identity: StableFileIdentity;
      }> = [];
      let scannedEntries = 0;
      try {
        while (true) {
          const entry = directory.readSync();
          if (!entry) break;
          if (entry.name === STORE_LOCK_NAME) continue;
          scannedEntries += 1;
          if (scannedEntries > MAXIMUM_INVENTORY_SCAN_ENTRIES) {
            throw new CandidateStoreFailure(
              "candidate_store_inventory_scan_budget_exceeded",
            );
          }
          if (!entry.isFile()) continue;
          const target = path.join(store, entry.name);
          const identity = stableFileIdentity(
            fs.lstatSync(target, { bigint: true }),
          );
          let isRecoverable = !STORE_ENTRY_PATTERN.test(entry.name);
          if (!isRecoverable) {
            try {
              if (
                identity.size <= 0n ||
                identity.size > BigInt(MAXIMUM_BUNDLE_BYTES)
              ) {
                isRecoverable = true;
              } else {
                isRecoverable =
                  storedCandidate(fs.readFileSync(target)) === null;
              }
            } catch {
              isRecoverable = true;
            }
          }
          if (
            isRecoverable &&
            candidateStoreRecoveryId(entry.name, identity) === rawRecoveryId
          ) {
            matches.push({ target, identity });
          }
        }
      } finally {
        directory.closeSync();
      }
      if (matches.length !== 1 || !matches[0]) {
        throw new CandidateStoreFailure(
          matches.length > 1
            ? "candidate_store_recovery_ambiguous"
            : "candidate_store_recovery_target_unavailable",
          null,
          true,
          rawRecoveryId,
        );
      }
      try {
        stableRemove(
          runtime,
          matches[0].target,
          matches[0].identity,
          "before_discard_remove",
        );
      } catch {
        throw new CandidateStoreFailure(
          "candidate_store_recovery_cleanup_unconfirmed",
          null,
          true,
          rawRecoveryId,
        );
      }
      return Object.freeze({
        status: "recovered" as const,
        reason: "candidate_store_exact_entry_recovered",
        manualRecoveryRequired: false,
        hostPathReported: false,
      });
    });
    return locked.status === "completed"
      ? locked.value
      : blockedResult(
          locked.reason,
          locked.recoveryId,
          locked.manualRecoveryRequired,
          locked.storeRecoveryId,
        );
  } catch {
    return blockedResult("candidate_store_recovery_failed", null, true);
  }
}

function runCandidateStoreGcWithRuntime(runtime: CandidateStoreRuntime) {
  try {
    const locked = withStoreLock(runtime, (store, nowMs) =>
      storeInventoryAndGc(runtime, store, nowMs),
    );
    return locked.status === "completed"
      ? Object.freeze({
          status: "completed" as const,
          reason: "candidate_store_gc_completed",
          deletedEntries: locked.value.deletedEntries,
          hostPathReported: false,
        })
      : blockedResult(
          locked.reason,
          locked.recoveryId,
          locked.manualRecoveryRequired,
          locked.storeRecoveryId,
        );
  } catch {
    return blockedResult("candidate_store_gc_failed", null, true);
  }
}

export function persistRuntimeOwnedCandidateBundle(
  rawBundle: unknown,
  rawPolicy: unknown,
) {
  return persistRuntimeOwnedCandidateBundleWithRuntime(
    productionRuntime,
    rawBundle,
    rawPolicy,
  );
}

export function readRuntimeOwnedCandidateBundle(rawCandidateId: unknown) {
  return readRuntimeOwnedCandidateBundleWithRuntime(
    productionRuntime,
    rawCandidateId,
  );
}

export function publishRuntimeOwnedCandidateBundle(rawRecoveryId: unknown) {
  return publishRuntimeOwnedCandidateBundleWithRuntime(
    productionRuntime,
    rawRecoveryId,
  );
}

export function discardRuntimeOwnedCandidateBundle(rawCandidateId: unknown) {
  return discardRuntimeOwnedCandidateBundleWithRuntime(
    productionRuntime,
    rawCandidateId,
  );
}

export function recoverRuntimeOwnedCandidateStore(rawRecoveryId: unknown) {
  return recoverRuntimeOwnedCandidateStoreWithRuntime(
    productionRuntime,
    rawRecoveryId,
  );
}

export function runRuntimeOwnedCandidateStoreStartupGc() {
  return runCandidateStoreGcWithRuntime(productionRuntime);
}

export function createCandidateBundleStoreTestingAdapter(
  options: CandidateStoreTestingOptions,
) {
  if (
    !options ||
    typeof options.temporaryDirectory !== "string" ||
    !path.isAbsolute(options.temporaryDirectory)
  ) {
    throw new Error("candidate_store_testing_options_invalid");
  }
  const runtime = Object.freeze({
    securityBoundary: "testing" as const,
    temporaryDirectory: () => options.temporaryDirectory,
    nowMs: options.nowMs ?? Date.now,
    randomBytes: options.randomBytes ?? randomBytes,
    injectFault: options.injectFault ?? (() => {}),
  });
  return Object.freeze({
    persist: (rawBundle: unknown, rawPolicy: unknown) =>
      persistRuntimeOwnedCandidateBundleWithRuntime(
        runtime,
        rawBundle,
        rawPolicy,
      ),
    read: (rawCandidateId: unknown) =>
      readRuntimeOwnedCandidateBundleWithRuntime(runtime, rawCandidateId),
    publish: (rawRecoveryId: unknown) =>
      publishRuntimeOwnedCandidateBundleWithRuntime(runtime, rawRecoveryId),
    discard: (rawCandidateId: unknown) =>
      discardRuntimeOwnedCandidateBundleWithRuntime(runtime, rawCandidateId),
    recoverStore: (rawRecoveryId: unknown) =>
      recoverRuntimeOwnedCandidateStoreWithRuntime(runtime, rawRecoveryId),
    startupGc: () => runCandidateStoreGcWithRuntime(runtime),
    testingStoreDirectory: () => storeDirectory(runtime).store,
  });
}

export function describeCandidateBundleStoreContract() {
  return Object.freeze({
    contract: CANDIDATE_BUNDLE_STORE_CONTRACT,
    contractRevision: CANDIDATE_BUNDLE_STORE_CONTRACT_REVISION,
    persistence: "approved_candidate_only_local_user_transient_store",
    lifecycle: "staged_then_published_after_operation_cleanup",
    retention:
      "repository_policy_bounded_1_to_168_hours_export_blocked_at_expiry_with_bounded_startup_and_entry_gc",
    physicalDeletion:
      "best_effort_bounded_gc_without_strict_instant_deletion_claim",
    crossProcessSerialization:
      "selected_user_sid_store_identity_and_protection_bound_windows_kernel_named_pipe_lock_released_on_process_termination",
    rootProtection:
      "windows_known_folder_fixed_volume_non_reparse_selected_user_owner_exact_protected_dacl_observed_before_and_after",
    recovery:
      "pending_staged_or_published_exact_one_candidate_recovery_and_unknown_or_damaged_exact_entry_store_recovery",
    capacity: Object.freeze({
      maximumEntries: MAXIMUM_STORE_ENTRIES,
      maximumBytes: MAXIMUM_STORE_BYTES,
    }),
    integrity: "candidate_id_bound_sha256_exact_bundle",
    canonicalRepositoryWriteAllowed: false,
    apiKeyFallbackAllowed: false,
    recognizedSecretPersistenceAllowed: false,
    credentialAbsenceVerified: false,
    hostPathReported: false,
  });
}
