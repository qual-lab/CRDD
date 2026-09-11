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
  schema: "crdd/runtime-data/temporary-operation/v2";
  operationId: string;
  identity: string;
  owner: string;
  generation: number;
  state: "active" | "recovery_required";
  purpose: string;
  allowedContent: readonly string[];
  terminalPaths: readonly string[];
  evidencePromotion: "required" | "not_required";
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
    "purpose",
    "schema",
    "state",
    "terminalPaths",
  ];
  const keys = Object.keys(r).sort();
  if (
    keys.length !== expectedKeys.length ||
    !keys.every((key, index) => key === expectedKeys[index]) ||
    r.schema !== "crdd/runtime-data/temporary-operation/v2" ||
    typeof r.operationId !== "string" ||
    !ID.test(r.operationId) ||
    typeof r.owner !== "string" ||
    !ID.test(r.owner) ||
    typeof r.identity !== "string" ||
    !ID.test(r.identity) ||
    !Number.isSafeInteger(r.generation) ||
    Number(r.generation) < 1 ||
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
  const descriptor = fs.openSync(
    path.join(directory, "operation.json"),
    "w",
    0o600,
  );
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(document)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}
function acquireLock(directory: string): string {
  const lock = path.join(directory, ".lifecycle-lock");
  try {
    fs.mkdirSync(lock, { mode: 0o700 });
  } catch {
    throw new Error("temporary_operation_lifecycle_busy");
  }
  if (!isSafeDirectory(lock))
    throw new Error("temporary_operation_boundary_invalid");
  return lock;
}
function releaseLock(lock: string): boolean {
  try {
    fs.rmdirSync(lock);
    return !fs.existsSync(lock);
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
      schema: "crdd/runtime-data/temporary-operation/v2",
      operationId: input.operationId,
      identity,
      owner: input.owner,
      generation: 1,
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
    fs.writeFileSync(
      path.join(directory, "operation.json"),
      `${JSON.stringify(document)}\n`,
      { flag: "wx", mode: 0o600 },
    );
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
  let lock: string | null = null;
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
    const directory = path.join(paths.temporary, reference.operationId);
    if (
      path.dirname(directory) !== paths.temporary ||
      !isSafeDirectory(directory) ||
      !isSafeDirectory(path.join(directory, "work"))
    )
      throw new Error("temporary_operation_boundary_invalid");
    lock = acquireLock(directory);
    const document = readDocument(directory);
    if (
      document.operationId !== reference.operationId ||
      document.owner !== reference.owner ||
      document.identity !== reference.identity ||
      document.generation !== reference.generation
    )
      throw new Error("temporary_operation_recovery_identity_mismatch");
    if (document.state !== "recovery_required")
      throw new Error("temporary_operation_recovery_not_required");
    const resumed: TemporaryOperationDocument = Object.freeze({
      ...document,
      state: "active",
      generation: document.generation + 1,
    });
    writeDocument(directory, resumed);
    const issued = issueCapability(directory, resumed);
    if (!releaseLock(lock))
      throw new Error("temporary_operation_lock_cleanup_unconfirmed");
    lock = null;
    return Object.freeze({
      status: "completed" as const,
      reason: "temporary_operation_resumed" as const,
      capability: issued.capability,
      workDirectory: path.join(directory, "work"),
      recoveryReference: recoveryReference(issued.record),
    });
  } catch (error) {
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
      recoveryReference: null,
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
      !SHA256.test(input.sha256)
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
    const metadata = fs.lstatSync(target);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      fs.realpathSync.native(target) !== target
    )
      throw new Error("temporary_operation_evidence_target_invalid");
    const observed = createHash("sha256")
      .update(fs.readFileSync(target))
      .digest("hex");
    if (observed !== input.sha256)
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

export function settleTemporaryOperation(
  capability: TemporaryOperationCapability,
  outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost",
  promotionReceipt: TemporaryEvidencePromotionReceipt | null,
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
  let lock: string | null = null;
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
      operations.delete(capability);
      if (!releaseLock(lock))
        throw new Error("temporary_operation_lock_cleanup_unconfirmed");
      lock = null;
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
    }
    if (!releaseLock(lock))
      throw new Error("temporary_operation_lock_cleanup_unconfirmed");
    lock = null;
    fs.rmSync(record.directory, { recursive: true });
    const cleanupConfirmed = !fs.existsSync(record.directory);
    if (cleanupConfirmed) {
      operations.delete(capability);
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
      recoveryRequired: true,
      recoveryReference: recoveryReference(record),
    });
  }
}
