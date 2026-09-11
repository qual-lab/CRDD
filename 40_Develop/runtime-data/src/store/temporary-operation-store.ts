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
  identity: string;
  operationId: string;
  owner: string;
}>;

type TemporaryOperationInput = Readonly<{
  operationId: string;
  owner: string;
  purpose: string;
  allowedContent: readonly string[];
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
    new Set(input.allowedContent).size === input.allowedContent.length
  );
}

export function createTemporaryOperation(
  rootCapability: VerifiedRepositoryRoot,
  input: TemporaryOperationInput,
) {
  try {
    if (!validInput(input))
      throw new Error("temporary_operation_input_invalid");
    const paths = resolveRepositoryRuntimeDataPaths(rootCapability);
    if (!paths) throw new Error("temporary_operation_root_invalid");
    ensureDirectory(paths.root);
    ensureDirectory(paths.temporary);
    const directory = path.join(paths.temporary, input.operationId);
    fs.mkdirSync(directory, { mode: 0o700 });
    if (
      !isSafeDirectory(directory) ||
      path.dirname(directory) !== paths.temporary
    )
      throw new Error("temporary_operation_boundary_invalid");
    const identity = randomUUID();
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
      promotionRequiredBeforeCleanup: true,
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
    operations.set(
      capability,
      Object.freeze({
        directory,
        identity,
        operationId: input.operationId,
        owner: input.owner,
      }),
    );
    return Object.freeze({
      status: "completed" as const,
      reason: "temporary_operation_created" as const,
      capability,
      workDirectory: path.join(directory, "work"),
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason:
        error instanceof Error
          ? error.message
          : "temporary_operation_creation_failed",
      capability: null,
      workDirectory: null,
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
  if (outcome === "parent_lost")
    return Object.freeze({
      status: "blocked" as const,
      reason: "temporary_operation_parent_lost" as const,
      cleanupConfirmed: false,
      recoveryRequired: true,
      recoveryReference: Object.freeze({
        operationId: record.operationId,
        owner: record.owner,
        identity: record.identity,
      }),
    });
  if (!isEvidencePromoted)
    return Object.freeze({
      status: "blocked" as const,
      reason: "temporary_operation_evidence_not_promoted" as const,
      cleanupConfirmed: false,
      recoveryRequired: true,
      recoveryReference: Object.freeze({
        operationId: record.operationId,
        owner: record.owner,
        identity: record.identity,
      }),
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
      recoveryReference: cleanupConfirmed
        ? null
        : Object.freeze({
            operationId: record.operationId,
            owner: record.owner,
            identity: record.identity,
          }),
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "temporary_operation_cleanup_unconfirmed" as const,
      cleanupConfirmed: false,
      recoveryRequired: true,
      recoveryReference: Object.freeze({
        operationId: record.operationId,
        owner: record.owner,
        identity: record.identity,
      }),
    });
  }
}
