import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { resolveRepositoryRuntimeDataPaths } from "../platform/runtime-data-path-resolver.ts";
import type { VerifiedRepositoryRoot } from "../platform/repository-root-capability.ts";

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const operations = new WeakMap<object, OperationRecord>();

export type TemporaryOperationCapability = Readonly<{
  contract: "crdd/runtime-data/temporary-operation-capability/v1";
}>;

type OperationRecord = Readonly<{
  directory: string;
  evidencePromotionRequired: boolean;
  identity: string;
  operationId: string;
  owner: string;
}>;

export type TemporaryOperationRecoveryReference = Readonly<{
  operationId: string;
  owner: string;
  identity: string;
}>;

type TemporaryOperationInput = Readonly<{
  operationId: string;
  owner: string;
  purpose: string;
  allowedContent: readonly string[];
  evidencePromotion: "required" | "not_required";
}>;

type TemporaryOperationDocument = Readonly<{
  schema: "crdd/runtime-data/temporary-operation/v1";
  operationId: string;
  identity: string;
  owner: string;
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

function recoveryReference(record: OperationRecord) {
  return Object.freeze({
    operationId: record.operationId,
    owner: record.owner,
    identity: record.identity,
  });
}

function inspectOperationDocument(
  value: unknown,
): TemporaryOperationDocument | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const record = value as Readonly<Record<string, unknown>>;
  const keys = Object.keys(record).sort();
  const expectedKeys = [
    "allowedContent",
    "evidencePromotion",
    "identity",
    "operationId",
    "owner",
    "purpose",
    "schema",
    "terminalPaths",
  ];
  if (
    keys.length !== expectedKeys.length ||
    !keys.every((key, index) => key === expectedKeys[index]) ||
    record.schema !== "crdd/runtime-data/temporary-operation/v1" ||
    typeof record.operationId !== "string" ||
    !ID.test(record.operationId) ||
    typeof record.owner !== "string" ||
    !ID.test(record.owner) ||
    typeof record.identity !== "string" ||
    !ID.test(record.identity) ||
    typeof record.purpose !== "string" ||
    record.purpose.length < 1 ||
    record.purpose.length > 512 ||
    !Array.isArray(record.allowedContent) ||
    record.allowedContent.length < 1 ||
    record.allowedContent.length > 64 ||
    !record.allowedContent.every(
      (item) => typeof item === "string" && ID.test(item),
    ) ||
    new Set(record.allowedContent).size !== record.allowedContent.length ||
    !Array.isArray(record.terminalPaths) ||
    record.terminalPaths.join("\n") !==
      "completed\nfailed\ncancelled\ntimed_out\nparent_lost" ||
    !["required", "not_required"].includes(String(record.evidencePromotion))
  )
    return null;
  return record as TemporaryOperationDocument;
}

export function createTemporaryOperation(
  rootCapability: VerifiedRepositoryRoot,
  input: TemporaryOperationInput,
) {
  let createdDirectory: string | null = null;
  let pendingRecoveryReference: TemporaryOperationRecoveryReference | null =
    null;
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
    pendingRecoveryReference = Object.freeze({
      operationId: input.operationId,
      owner: input.owner,
      identity,
    });
    if (
      !isSafeDirectory(directory) ||
      path.dirname(directory) !== paths.temporary
    )
      throw new Error("temporary_operation_boundary_invalid");
    const operation = Object.freeze({
      schema: "crdd/runtime-data/temporary-operation/v1",
      operationId: input.operationId,
      identity,
      owner: input.owner,
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
    fs.writeFileSync(
      path.join(directory, "operation.json"),
      `${JSON.stringify(operation)}\n`,
      { flag: "wx", mode: 0o600 },
    );
    ensureDirectory(path.join(directory, "work"));
    const capability = Object.freeze({
      contract: "crdd/runtime-data/temporary-operation-capability/v1" as const,
    });
    const record = Object.freeze({
      directory,
      evidencePromotionRequired: input.evidencePromotion === "required",
      identity,
      operationId: input.operationId,
      owner: input.owner,
    });
    operations.set(capability, record);
    return Object.freeze({
      status: "completed" as const,
      reason: "temporary_operation_created" as const,
      capability,
      workDirectory: path.join(directory, "work"),
      recoveryReference: recoveryReference(record),
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
    const knownReason =
      error instanceof Error &&
      /^temporary_operation_[a-z_]+$/u.test(error.message)
        ? error.message
        : "temporary_operation_creation_failed";
    return Object.freeze({
      status: "blocked" as const,
      reason: knownReason,
      capability: null,
      workDirectory: null,
      cleanupConfirmed,
      recoveryRequired: !cleanupConfirmed,
      recoveryReference: cleanupConfirmed ? null : pendingRecoveryReference,
    });
  }
}

export function resumeTemporaryOperation(
  rootCapability: VerifiedRepositoryRoot,
  reference: TemporaryOperationRecoveryReference,
) {
  try {
    if (
      typeof reference !== "object" ||
      reference === null ||
      !ID.test(reference.operationId) ||
      !ID.test(reference.owner) ||
      !ID.test(reference.identity)
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
    const documentPath = path.join(directory, "operation.json");
    const metadata = fs.lstatSync(documentPath);
    if (!metadata.isFile() || metadata.isSymbolicLink())
      throw new Error("temporary_operation_boundary_invalid");
    const document = inspectOperationDocument(
      JSON.parse(fs.readFileSync(documentPath, "utf8")),
    );
    if (
      !document ||
      document.operationId !== reference.operationId ||
      document.owner !== reference.owner ||
      document.identity !== reference.identity
    )
      throw new Error("temporary_operation_recovery_identity_mismatch");
    const capability = Object.freeze({
      contract: "crdd/runtime-data/temporary-operation-capability/v1" as const,
    });
    const record = Object.freeze({
      directory,
      evidencePromotionRequired: document.evidencePromotion === "required",
      identity: document.identity,
      operationId: document.operationId,
      owner: document.owner,
    });
    operations.set(capability, record);
    return Object.freeze({
      status: "completed" as const,
      reason: "temporary_operation_resumed" as const,
      capability,
      workDirectory: path.join(directory, "work"),
      recoveryReference: recoveryReference(record),
    });
  } catch (error) {
    const knownReason =
      error instanceof Error &&
      /^temporary_operation_[a-z_]+$/u.test(error.message)
        ? error.message
        : "temporary_operation_resume_failed";
    return Object.freeze({
      status: "blocked" as const,
      reason: knownReason,
      capability: null,
      workDirectory: null,
      recoveryReference: null,
    });
  }
}

export function settleTemporaryOperation(
  capability: TemporaryOperationCapability,
  outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost",
  isEvidencePromoted: boolean,
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
  if (outcome === "parent_lost") {
    operations.delete(capability);
    return Object.freeze({
      status: "blocked" as const,
      reason: "temporary_operation_parent_lost" as const,
      cleanupConfirmed: false,
      recoveryRequired: true,
      recoveryReference: recoveryReference(record),
    });
  }
  if (record.evidencePromotionRequired && !isEvidencePromoted)
    return Object.freeze({
      status: "blocked" as const,
      reason: "temporary_operation_evidence_not_promoted" as const,
      cleanupConfirmed: false,
      recoveryRequired: true,
      recoveryReference: recoveryReference(record),
    });
  try {
    if (!isSafeDirectory(record.directory)) throw new Error();
    fs.rmSync(record.directory, { recursive: true });
    const cleanupConfirmed = !fs.existsSync(record.directory);
    if (cleanupConfirmed) operations.delete(capability);
    return Object.freeze({
      status: cleanupConfirmed ? ("completed" as const) : ("blocked" as const),
      reason: cleanupConfirmed
        ? ("temporary_operation_settled" as const)
        : ("temporary_operation_cleanup_unconfirmed" as const),
      cleanupConfirmed,
      recoveryRequired: !cleanupConfirmed,
      recoveryReference: cleanupConfirmed ? null : recoveryReference(record),
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "temporary_operation_cleanup_unconfirmed" as const,
      cleanupConfirmed: false,
      recoveryRequired: true,
      recoveryReference: recoveryReference(record),
    });
  }
}
