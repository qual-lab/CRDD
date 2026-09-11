import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { resolveRepositoryRuntimeDataPaths } from "../platform/runtime-data-path-resolver.ts";
import type { VerifiedRepositoryRoot } from "../platform/repository-root-capability.ts";

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const OUTCOMES = new Set([
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "parent_lost",
]);
const operations = new WeakMap<object, OperationRecord>();
const promotionReceipts = new WeakMap<object, PromotionRecord>();

export type TemporaryOperationCapability = Readonly<{
  contract: "crdd/runtime-data/temporary-operation-capability/v1";
}>;
export type TemporaryEvidencePromotionReceipt = Readonly<{
  contract: "crdd/runtime-data/temporary-evidence-promotion-receipt/v1";
}>;
export type TemporaryOperationRecoveryReference = Readonly<{
  operationId: string;
  owner: string;
  identity: string;
  generation: number;
}>;
type OperationRecord = Readonly<{
  allowedContent: readonly string[];
  directory: string;
  evidencePromotionRequired: boolean;
  generation: number;
  identity: string;
  operationId: string;
  owner: string;
}>;
type PromotionRecord = Readonly<{
  generation: number;
  identity: string;
  operationId: string;
  sha256: string;
  source: string;
  target: string;
}>;
type TemporaryOperationInput = Readonly<{
  operationId: string;
  owner: string;
  purpose: string;
  allowedContent: readonly string[];
  evidencePromotion: "required" | "not_required";
}>;
type TemporaryOperationDocument = Readonly<{
  schema: "crdd/runtime-data/temporary-operation/v3";
  operationId: string;
  identity: string;
  owner: string;
  generation: number;
  ownerProcessId: number;
  previousGeneration: number | null;
  state: "active" | "recovery_required";
  purpose: string;
  allowedContent: readonly string[];
  terminalPaths: readonly string[];
  evidencePromotion: "required" | "not_required";
}>;
type LifecycleLock = Readonly<{
  directory: string;
  identity: string;
}>;
type LifecycleLockDocument = Readonly<{
  schema: "crdd/runtime-data/lifecycle-lock/v1";
  identity: string;
  ownerProcessId: number;
  state: "active" | "released";
}>;

function isSafeDirectory(target: string): boolean {
  const metadata = fs.lstatSync(target);
  return (
    metadata.isDirectory() &&
    !metadata.isSymbolicLink() &&
    fs.realpathSync.native(target) === path.resolve(target)
  );
}
function ensureDirectory(target: string): void {
  try {
    fs.mkdirSync(target, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if (!isSafeDirectory(target))
    throw new Error("temporary_operation_boundary_invalid");
}
function validInput(input: TemporaryOperationInput): boolean {
  return (
    ID.test(input.operationId) &&
    ID.test(input.owner) &&
    typeof input.purpose === "string" &&
    input.purpose.length > 0 &&
    input.purpose.length <= 512 &&
    Array.isArray(input.allowedContent) &&
    input.allowedContent.length > 0 &&
    input.allowedContent.length <= 64 &&
    input.allowedContent.every(
      (item) => typeof item === "string" && ID.test(item),
    ) &&
    new Set(input.allowedContent).size === input.allowedContent.length &&
    ["required", "not_required"].includes(input.evidencePromotion)
  );
}
function recoveryReference(
  record: OperationRecord,
): TemporaryOperationRecoveryReference {
  return Object.freeze({
    operationId: record.operationId,
    owner: record.owner,
    identity: record.identity,
    generation: record.generation,
  });
}
function inspectDocument(value: unknown): TemporaryOperationDocument | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const r = value as Readonly<Record<string, unknown>>;
  const expectedKeys = [
    "allowedContent",
    "evidencePromotion",
    "generation",
    "identity",
    "operationId",
    "owner",
    "ownerProcessId",
    "previousGeneration",
    "purpose",
    "schema",
    "state",
    "terminalPaths",
  ];
  const keys = Object.keys(r).sort();
  if (
    keys.length !== expectedKeys.length ||
    !keys.every((key, index) => key === expectedKeys[index]) ||
    r.schema !== "crdd/runtime-data/temporary-operation/v3" ||
    typeof r.operationId !== "string" ||
    !ID.test(r.operationId) ||
    typeof r.owner !== "string" ||
    !ID.test(r.owner) ||
    typeof r.identity !== "string" ||
    !ID.test(r.identity) ||
    !Number.isSafeInteger(r.generation) ||
    Number(r.generation) < 1 ||
    !Number.isSafeInteger(r.ownerProcessId) ||
    Number(r.ownerProcessId) < 1 ||
    (r.previousGeneration !== null &&
      (!Number.isSafeInteger(r.previousGeneration) ||
        Number(r.previousGeneration) < 1 ||
        Number(r.previousGeneration) >= Number(r.generation))) ||
    !["active", "recovery_required"].includes(String(r.state)) ||
    typeof r.purpose !== "string" ||
    r.purpose.length < 1 ||
    r.purpose.length > 512 ||
    !Array.isArray(r.allowedContent) ||
    r.allowedContent.length < 1 ||
    r.allowedContent.length > 64 ||
    !r.allowedContent.every(
      (item) => typeof item === "string" && ID.test(item),
    ) ||
    new Set(r.allowedContent).size !== r.allowedContent.length ||
    !Array.isArray(r.terminalPaths) ||
    r.terminalPaths.join("\n") !==
      "completed\nfailed\ncancelled\ntimed_out\nparent_lost" ||
    !["required", "not_required"].includes(String(r.evidencePromotion))
  )
    return null;
  return r as TemporaryOperationDocument;
}
function readDocument(directory: string): TemporaryOperationDocument {
  const target = path.join(directory, "operation.json");
  const metadata = fs.lstatSync(target);
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error("temporary_operation_boundary_invalid");
  const document = inspectDocument(JSON.parse(fs.readFileSync(target, "utf8")));
  if (!document) throw new Error("temporary_operation_document_invalid");
  return document;
}
function writeDocument(
  directory: string,
  document: TemporaryOperationDocument,
): void {
  const target = path.join(directory, "operation.json");
  const temporary = path.join(directory, `.operation-${randomUUID()}.tmp`);
  const descriptor = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(document)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.renameSync(temporary, target);
    const observed = readDocument(directory);
    if (
      observed.identity !== document.identity ||
      observed.generation !== document.generation ||
      observed.state !== document.state
    )
      throw new Error("temporary_operation_document_publish_unconfirmed");
  } finally {
    try {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    } catch {
      // A failed replacement remains a recovery obligation at the caller.
    }
  }
}

function processIsAlive(processId: number) {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
function readLockDocument(directory: string): LifecycleLockDocument | null {
  try {
    const target = path.join(directory, "owner.json");
    const metadata = fs.lstatSync(target);
    if (!metadata.isFile() || metadata.isSymbolicLink()) return null;
    const value = JSON.parse(fs.readFileSync(target, "utf8")) as Record<
      string,
      unknown
    >;
    if (
      Object.keys(value).sort().join("\n") !==
        "identity\nownerProcessId\nschema\nstate" ||
      value.schema !== "crdd/runtime-data/lifecycle-lock/v1" ||
      typeof value.identity !== "string" ||
      !ID.test(value.identity) ||
      !Number.isSafeInteger(value.ownerProcessId) ||
      Number(value.ownerProcessId) < 1 ||
      !["active", "released"].includes(String(value.state))
    )
      return null;
    return value as LifecycleLockDocument;
  } catch {
    return null;
  }
}
function publishLockDocument(
  directory: string,
  document: LifecycleLockDocument,
): void {
  const target = path.join(directory, "owner.json");
  const temporary = path.join(directory, `.owner-${randomUUID()}.tmp`);
  const descriptor = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(document)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.renameSync(temporary, target);
    const observed = readLockDocument(directory);
    if (
      observed?.identity !== document.identity ||
      observed.ownerProcessId !== document.ownerProcessId ||
      observed.state !== document.state
    )
      throw new Error("temporary_operation_lock_publish_unconfirmed");
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}
function removeLockDirectory(directory: string): void {
  fs.rmSync(directory, { recursive: true });
}
function acquireLock(directory: string): LifecycleLock {
  const lockDirectory = path.join(directory, ".lifecycle-lock");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      fs.mkdirSync(lockDirectory, { mode: 0o700 });
      if (!isSafeDirectory(lockDirectory))
        throw new Error("temporary_operation_boundary_invalid");
      const identity = randomUUID();
      publishLockDocument(
        lockDirectory,
        Object.freeze({
          schema: "crdd/runtime-data/lifecycle-lock/v1",
          identity,
          ownerProcessId: process.pid,
          state: "active",
        }),
      );
      return Object.freeze({ directory: lockDirectory, identity });
    } catch (error) {
      if (
        error instanceof Error &&
        /^temporary_operation_(boundary|lock_publish)_/u.test(error.message)
      )
        throw error;
      const previous = readLockDocument(lockDirectory);
      if (
        !previous ||
        (previous.state === "active" && processIsAlive(previous.ownerProcessId))
      )
        throw new Error("temporary_operation_lifecycle_busy");
      try {
        removeLockDirectory(lockDirectory);
      } catch {
        throw new Error("temporary_operation_lock_cleanup_unconfirmed");
      }
    }
  }
  throw new Error("temporary_operation_lifecycle_busy");
}
function releaseLock(
  lock: LifecycleLock,
  remove: (directory: string) => void = removeLockDirectory,
): boolean {
  try {
    const current = readLockDocument(lock.directory);
    if (
      !current ||
      current.identity !== lock.identity ||
      current.ownerProcessId !== process.pid ||
      current.state !== "active"
    )
      return false;
    publishLockDocument(
      lock.directory,
      Object.freeze({ ...current, state: "released" }),
    );
    remove(lock.directory);
    return !fs.existsSync(lock.directory);
  } catch {
    return false;
  }
}
function issueCapability(
  directory: string,
  document: TemporaryOperationDocument,
) {
  const capability = Object.freeze({
    contract: "crdd/runtime-data/temporary-operation-capability/v1" as const,
  });
  const record = Object.freeze({
    allowedContent: document.allowedContent,
    directory,
    evidencePromotionRequired: document.evidencePromotion === "required",
    generation: document.generation,
    identity: document.identity,
    operationId: document.operationId,
    owner: document.owner,
  });
  operations.set(capability, record);
  return { capability, record };
}

export function createTemporaryOperation(
  rootCapability: VerifiedRepositoryRoot,
  input: TemporaryOperationInput,
) {
  let createdDirectory: string | null = null;
  let pendingReference: TemporaryOperationRecoveryReference | null = null;
  try {
    if (!validInput(input))
      throw new Error("temporary_operation_input_invalid");
    const paths = resolveRepositoryRuntimeDataPaths(rootCapability);
    if (!paths) throw new Error("temporary_operation_root_invalid");
    ensureDirectory(paths.root);
    ensureDirectory(paths.temporary);
    const directory = path.join(paths.temporary, input.operationId);
    const identity = randomUUID();
    fs.mkdirSync(directory, { mode: 0o700 });
    createdDirectory = directory;
    const document: TemporaryOperationDocument = Object.freeze({
      schema: "crdd/runtime-data/temporary-operation/v3",
      operationId: input.operationId,
      identity,
      owner: input.owner,
      generation: 1,
      ownerProcessId: process.pid,
      previousGeneration: null,
      state: "active",
      purpose: input.purpose,
      allowedContent: Object.freeze([...input.allowedContent]),
      terminalPaths: Object.freeze([
        "completed",
        "failed",
        "cancelled",
        "timed_out",
        "parent_lost",
      ]),
      evidencePromotion: input.evidencePromotion,
    });
    pendingReference = Object.freeze({
      operationId: input.operationId,
      owner: input.owner,
      identity,
      generation: 1,
    });
    if (
      !isSafeDirectory(directory) ||
      path.dirname(directory) !== paths.temporary
    )
      throw new Error("temporary_operation_boundary_invalid");
    const descriptor = fs.openSync(
      path.join(directory, "operation.json"),
      "wx",
      0o600,
    );
    try {
      fs.writeFileSync(descriptor, `${JSON.stringify(document)}\n`, "utf8");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    ensureDirectory(path.join(directory, "work"));
    const issued = issueCapability(directory, document);
    return Object.freeze({
      status: "completed" as const,
      reason: "temporary_operation_created" as const,
      capability: issued.capability,
      workDirectory: path.join(directory, "work"),
      recoveryReference: recoveryReference(issued.record),
    });
  } catch (error) {
    let cleanupConfirmed = createdDirectory === null;
    if (createdDirectory !== null) {
      try {
        if (!isSafeDirectory(createdDirectory)) throw new Error();
        fs.rmSync(createdDirectory, { recursive: true });
        cleanupConfirmed = !fs.existsSync(createdDirectory);
      } catch {
        cleanupConfirmed = false;
      }
    }
    const reason =
      error instanceof Error &&
      /^temporary_operation_[a-z_]+$/u.test(error.message)
        ? error.message
        : "temporary_operation_creation_failed";
    return Object.freeze({
      status: "blocked" as const,
      reason,
      capability: null,
      workDirectory: null,
      cleanupConfirmed,
      recoveryRequired: !cleanupConfirmed,
      recoveryReference: cleanupConfirmed ? null : pendingReference,
    });
  }
}

export function resumeTemporaryOperation(
  rootCapability: VerifiedRepositoryRoot,
  reference: TemporaryOperationRecoveryReference,
) {
  let lock: LifecycleLock | null = null;
  let directory: string | null = null;
  let pendingRecoveryDocument: TemporaryOperationDocument | null = null;
  try {
    if (
      typeof reference !== "object" ||
      reference === null ||
      !ID.test(reference.operationId) ||
      !ID.test(reference.owner) ||
      !ID.test(reference.identity) ||
      !Number.isSafeInteger(reference.generation) ||
      reference.generation < 1
    )
      throw new Error("temporary_operation_recovery_reference_invalid");
    const paths = resolveRepositoryRuntimeDataPaths(rootCapability);
    if (!paths) throw new Error("temporary_operation_root_invalid");
    directory = path.join(paths.temporary, reference.operationId);
    if (
      path.dirname(directory) !== paths.temporary ||
      !isSafeDirectory(directory) ||
      !isSafeDirectory(path.join(directory, "work"))
    )
      throw new Error("temporary_operation_boundary_invalid");
    lock = acquireLock(directory);
    let document = readDocument(directory);
    if (
      document.operationId !== reference.operationId ||
      document.owner !== reference.owner ||
      document.identity !== reference.identity ||
      (document.generation !== reference.generation &&
        document.previousGeneration !== reference.generation)
    )
      throw new Error("temporary_operation_recovery_identity_mismatch");
    if (document.state === "active") {
      if (processIsAlive(document.ownerProcessId))
        throw new Error("temporary_operation_recovery_not_required");
      document = Object.freeze({
        ...document,
        state: "recovery_required" as const,
      });
      writeDocument(directory, document);
    }
    if (
      document.state !== "recovery_required" ||
      (document.generation !== reference.generation &&
        document.previousGeneration !== reference.generation)
    )
      throw new Error("temporary_operation_recovery_identity_mismatch");
    const resumed: TemporaryOperationDocument = Object.freeze({
      ...document,
      state: "active",
      generation: document.generation + 1,
      ownerProcessId: process.pid,
      previousGeneration: document.generation,
    });
    writeDocument(directory, resumed);
    pendingRecoveryDocument = resumed;
    if (!releaseLock(lock))
      throw new Error("temporary_operation_lock_cleanup_unconfirmed");
    lock = null;
    const issued = issueCapability(directory, resumed);
    pendingRecoveryDocument = null;
    return Object.freeze({
      status: "completed" as const,
      reason: "temporary_operation_resumed" as const,
      capability: issued.capability,
      workDirectory: path.join(directory, "work"),
      recoveryReference: recoveryReference(issued.record),
    });
  } catch (error) {
    let recoveryReferenceValue: TemporaryOperationRecoveryReference | null =
      null;
    if (directory !== null && pendingRecoveryDocument !== null) {
      try {
        const recoverable = Object.freeze({
          ...pendingRecoveryDocument,
          state: "recovery_required" as const,
        });
        writeDocument(directory, recoverable);
        recoveryReferenceValue = Object.freeze({
          operationId: recoverable.operationId,
          owner: recoverable.owner,
          identity: recoverable.identity,
          generation: recoverable.generation,
        });
      } catch {
        recoveryReferenceValue = null;
      }
    }
    if (lock !== null) releaseLock(lock);
    const reason =
      error instanceof Error &&
      /^temporary_operation_[a-z_]+$/u.test(error.message)
        ? error.message
        : "temporary_operation_resume_failed";
    return Object.freeze({
      status: "blocked" as const,
      reason,
      capability: null,
      workDirectory: null,
      recoveryReference: recoveryReferenceValue,
    });
  }
}

export function verifyTemporaryOperationEvidencePromotion(
  rootCapability: VerifiedRepositoryRoot,
  capability: TemporaryOperationCapability,
  input: Readonly<{ recordId: string; artifactName: string; sha256: string }>,
) {
  try {
    const record = operations.get(capability);
    if (!record) throw new Error("temporary_operation_capability_invalid");
    if (
      !input ||
      !ID.test(input.recordId) ||
      !ID.test(input.artifactName) ||
      !SHA256.test(input.sha256) ||
      !record.allowedContent.includes(input.artifactName)
    )
      throw new Error("temporary_operation_evidence_receipt_invalid");
    const paths = resolveRepositoryRuntimeDataPaths(rootCapability);
    if (!paths) throw new Error("temporary_operation_root_invalid");
    const target = path.join(
      paths.verification,
      input.recordId,
      "artifacts",
      input.artifactName,
    );
    const source = path.join(record.directory, "work", input.artifactName);
    const sourceMetadata = fs.lstatSync(source);
    const metadata = fs.lstatSync(target);
    if (
      !sourceMetadata.isFile() ||
      sourceMetadata.isSymbolicLink() ||
      fs.realpathSync.native(source) !== source ||
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      fs.realpathSync.native(target) !== target
    )
      throw new Error("temporary_operation_evidence_target_invalid");
    const sourceHash = createHash("sha256")
      .update(fs.readFileSync(source))
      .digest("hex");
    const observed = createHash("sha256")
      .update(fs.readFileSync(target))
      .digest("hex");
    if (sourceHash !== input.sha256 || observed !== input.sha256)
      throw new Error("temporary_operation_evidence_hash_mismatch");
    const receipt = Object.freeze({
      contract:
        "crdd/runtime-data/temporary-evidence-promotion-receipt/v1" as const,
    });
    promotionReceipts.set(
      receipt,
      Object.freeze({
        operationId: record.operationId,
        identity: record.identity,
        generation: record.generation,
        sha256: observed,
        source,
        target,
      }),
    );
    return Object.freeze({
      status: "completed" as const,
      reason: "temporary_operation_evidence_promotion_verified" as const,
      receipt,
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason:
        error instanceof Error &&
        /^temporary_operation_[a-z_]+$/u.test(error.message)
          ? error.message
          : "temporary_operation_evidence_verification_failed",
      receipt: null,
    });
  }
}

function settleTemporaryOperationWithRemoval(
  capability: TemporaryOperationCapability,
  outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost",
  promotionReceipt: TemporaryEvidencePromotionReceipt | null,
  removeDirectory: (directory: string) => void,
  removeLifecycleLock: (directory: string) => void = removeLockDirectory,
) {
  const record = operations.get(capability);
  if (!record)
    return Object.freeze({
      status: "blocked" as const,
      reason: "temporary_operation_capability_invalid" as const,
      cleanupConfirmed: false,
      recoveryRequired: true,
      recoveryReference: null,
    });
  if (typeof outcome !== "string" || !OUTCOMES.has(outcome))
    return Object.freeze({
      status: "blocked" as const,
      reason: "temporary_operation_outcome_invalid" as const,
      cleanupConfirmed: false,
      recoveryRequired: true,
      recoveryReference: recoveryReference(record),
    });
  let lock: LifecycleLock | null = null;
  let durableRecoveryConfirmed = false;
  try {
    lock = acquireLock(record.directory);
    const document = readDocument(record.directory);
    if (
      document.state !== "active" ||
      document.identity !== record.identity ||
      document.generation !== record.generation
    )
      throw new Error("temporary_operation_capability_stale");
    if (outcome === "parent_lost") {
      writeDocument(
        record.directory,
        Object.freeze({ ...document, state: "recovery_required" }),
      );
      durableRecoveryConfirmed = true;
      operations.delete(capability);
      const released = releaseLock(lock, removeLifecycleLock);
      lock = null;
      if (!released)
        throw new Error("temporary_operation_lock_cleanup_unconfirmed");
      return Object.freeze({
        status: "blocked" as const,
        reason: "temporary_operation_parent_lost" as const,
        cleanupConfirmed: false,
        recoveryRequired: true,
        recoveryReference: recoveryReference(record),
      });
    }
    if (record.evidencePromotionRequired) {
      const promotion =
        promotionReceipt === null
          ? undefined
          : promotionReceipts.get(promotionReceipt);
      if (
        !promotion ||
        promotion.operationId !== record.operationId ||
        promotion.identity !== record.identity ||
        promotion.generation !== record.generation
      )
        throw new Error("temporary_operation_evidence_not_promoted");
      const sourceMetadata = fs.lstatSync(promotion.source);
      const targetMetadata = fs.lstatSync(promotion.target);
      if (
        !sourceMetadata.isFile() ||
        sourceMetadata.isSymbolicLink() ||
        fs.realpathSync.native(promotion.source) !== promotion.source ||
        !targetMetadata.isFile() ||
        targetMetadata.isSymbolicLink() ||
        fs.realpathSync.native(promotion.target) !== promotion.target ||
        createHash("sha256")
          .update(fs.readFileSync(promotion.source))
          .digest("hex") !== promotion.sha256 ||
        createHash("sha256")
          .update(fs.readFileSync(promotion.target))
          .digest("hex") !== promotion.sha256
      )
        throw new Error("temporary_operation_evidence_not_promoted");
    }
    writeDocument(
      record.directory,
      Object.freeze({ ...document, state: "recovery_required" }),
    );
    durableRecoveryConfirmed = true;
    operations.delete(capability);
    const released = releaseLock(lock, removeLifecycleLock);
    lock = null;
    if (!released)
      throw new Error("temporary_operation_lock_cleanup_unconfirmed");
    removeDirectory(record.directory);
    const cleanupConfirmed = !fs.existsSync(record.directory);
    if (cleanupConfirmed) {
      if (promotionReceipt) promotionReceipts.delete(promotionReceipt);
    }
    return Object.freeze({
      status: cleanupConfirmed ? ("completed" as const) : ("blocked" as const),
      reason: cleanupConfirmed
        ? ("temporary_operation_settled" as const)
        : ("temporary_operation_cleanup_unconfirmed" as const),
      cleanupConfirmed,
      recoveryRequired: !cleanupConfirmed,
      recoveryReference: cleanupConfirmed ? null : recoveryReference(record),
    });
  } catch (error) {
    if (lock !== null) releaseLock(lock);
    const reason =
      error instanceof Error &&
      /^temporary_operation_[a-z_]+$/u.test(error.message)
        ? error.message
        : "temporary_operation_cleanup_unconfirmed";
    return Object.freeze({
      status: "blocked" as const,
      reason,
      cleanupConfirmed: false,
      recoveryRequired: durableRecoveryConfirmed,
      recoveryReference: durableRecoveryConfirmed
        ? recoveryReference(record)
        : null,
    });
  }
}

export function settleTemporaryOperation(
  capability: TemporaryOperationCapability,
  outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost",
  promotionReceipt: TemporaryEvidencePromotionReceipt | null,
) {
  return settleTemporaryOperationWithRemoval(
    capability,
    outcome,
    promotionReceipt,
    (directory) => fs.rmSync(directory, { recursive: true }),
  );
}

/** Internal contract-test entry; omitted from the package public index. */
export function settleTemporaryOperationWithRemovalForVerification(
  capability: TemporaryOperationCapability,
  outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost",
  promotionReceipt: TemporaryEvidencePromotionReceipt | null,
  removeDirectory: (directory: string) => void,
  removeLifecycleLock: (directory: string) => void = removeLockDirectory,
) {
  return settleTemporaryOperationWithRemoval(
    capability,
    outcome,
    promotionReceipt,
    removeDirectory,
    removeLifecycleLock,
  );
}
