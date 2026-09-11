import { createHash } from "node:crypto";
import {
  isSha256Hex,
  parseDockerTaskRecoveryId,
} from "./docker-recovery-identity.ts";

export const dockerRestartPhases = [
  "stop_intent",
  "stopped",
  "start_intent",
  "ready",
  "settled",
] as const;
export type DockerRestartPhase = (typeof dockerRestartPhases)[number];
export type DockerRestartBinding = Readonly<{
  recoveryId: string;
  operationNonce: string;
  runtimeExecutionIdentitySha256: string;
  localUserBindingHash: string;
  runtimeStateIdentityHash: string;
  runtimeStateProtectionHash: string;
  stableLogicalHomeBindingHash: string;
  pendingSubmissionSha256: string;
}>;
export type DockerRestartRecord = DockerRestartBinding &
  Readonly<{
    contract: "crdd-coordinator/docker-restart-record";
    contractRevision: 1;
    sequence: number;
    previousRecordSha256: string | null;
    phase: DockerRestartPhase;
  }>;
const hashKeys = [
  "operationNonce",
  "runtimeExecutionIdentitySha256",
  "localUserBindingHash",
  "runtimeStateIdentityHash",
  "runtimeStateProtectionHash",
  "stableLogicalHomeBindingHash",
  "pendingSubmissionSha256",
] as const;
const bindingKeys = ["recoveryId", ...hashKeys] as const;
const recordKeys = [
  "contract",
  "contractRevision",
  ...bindingKeys,
  "sequence",
  "previousRecordSha256",
  "phase",
] as const;
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

function validBinding(value: Record<string, unknown>): boolean {
  const parsedRecoveryId = parseDockerTaskRecoveryId(value.recoveryId);
  return (
    parsedRecoveryId !== null &&
    hashKeys.every((key) => isSha256Hex(value[key])) &&
    parsedRecoveryId.operationNonce === value.operationNonce &&
    parsedRecoveryId.stableLogicalHomeBindingHash ===
      value.stableLogicalHomeBindingHash
  );
}

function encode(record: DockerRestartRecord): Buffer {
  return Buffer.from(
    `${JSON.stringify(Object.fromEntries(recordKeys.map((key) => [key, record[key]])))}\n`,
    "utf8",
  );
}

/** Parses data only; acceptance does not confer restart or recovery authority. */
export function parseDockerRestartRecord(
  bytes: Uint8Array,
): DockerRestartRecord | null {
  if (bytes.byteLength === 0 || bytes.byteLength > 65_536) return null;
  try {
    const value: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const record = value as Record<string, unknown>;
    if (
      Object.keys(record).length !== recordKeys.length ||
      !recordKeys.every((key) => Object.hasOwn(record, key)) ||
      !validBinding(record)
    )
      return null;
    if (
      record.contract !== "crdd-coordinator/docker-restart-record" ||
      record.contractRevision !== 1
    )
      return null;
    const index = dockerRestartPhases.indexOf(
      record.phase as DockerRestartPhase,
    );
    if (
      index < 0 ||
      record.sequence !== index ||
      (index === 0
        ? record.previousRecordSha256 !== null
        : !isSha256Hex(record.previousRecordSha256))
    )
      return null;
    const result = record as DockerRestartRecord;
    return Buffer.from(bytes).equals(encode(result))
      ? Object.freeze(result)
      : null;
  } catch {
    return null;
  }
}

export function validateDockerRestartRecordChain(
  records: readonly Uint8Array[],
  expectedBinding: DockerRestartBinding,
): readonly DockerRestartRecord[] | null {
  if (records.length === 0 || records.length > dockerRestartPhases.length)
    return null;
  const parsedRecords: DockerRestartRecord[] = [];
  for (const [index, bytes] of records.entries()) {
    const record = parseDockerRestartRecord(bytes);
    const previous = records[index - 1];
    if (
      !record ||
      record.sequence !== index ||
      !bindingKeys.every((key) => record[key] === expectedBinding[key]) ||
      record.previousRecordSha256 !== (previous ? digest(previous) : null)
    )
      return null;
    parsedRecords.push(record);
  }
  return Object.freeze(parsedRecords);
}

/** The caller must validate the complete persisted chain before appending. */
export function createDockerRestartRecord(
  binding: DockerRestartBinding,
  phase: DockerRestartPhase,
  previousRecordBytes?: Uint8Array,
): Buffer {
  const sequence = dockerRestartPhases.indexOf(phase);
  const previous = previousRecordBytes
    ? parseDockerRestartRecord(previousRecordBytes)
    : null;
  if (
    sequence < 0 ||
    (sequence === 0
      ? previousRecordBytes !== undefined
      : !previous ||
        previous.sequence !== sequence - 1 ||
        !bindingKeys.every((key) => previous[key] === binding[key]))
  )
    throw new Error("docker_restart_record_predecessor_invalid");
  const bytes = encode({
    ...binding,
    contract: "crdd-coordinator/docker-restart-record",
    contractRevision: 1,
    sequence,
    previousRecordSha256: previousRecordBytes
      ? digest(previousRecordBytes)
      : null,
    phase,
  });
  if (!parseDockerRestartRecord(bytes))
    throw new Error("docker_restart_record_binding_invalid");
  return bytes;
}
