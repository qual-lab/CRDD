import { createHash } from "node:crypto";
import { isSha256Hex } from "./docker-recovery-identity.ts";
import {
  type DockerRestartBinding,
  type DockerRestartRecord,
  parseDockerRestartRecord,
  validateDockerRestartRecordChain,
  createDockerRestartRecord,
} from "./docker-restart-record.ts";
import { parseDockerRestartHandoffRecord } from "./docker-restart-handoff-record.ts";

type Continuation = Readonly<{
  contract: "crdd-coordinator/docker-restart-continuation";
  contractRevision: 1;
  handoffSha256: string;
  record: DockerRestartRecord;
}>;
const encode = (value: Continuation) =>
  Buffer.from(`${JSON.stringify(value)}\n`);
/** Pure record wrapping, never execution authority. */
export function createDockerRestartContinuationRecord(
  recordBytes: Uint8Array,
  handoffSha256: string,
): Buffer {
  const record = parseDockerRestartRecord(recordBytes);
  if (!record || !isSha256Hex(handoffSha256))
    throw new Error("docker_restart_continuation_invalid");
  return encode({
    contract: "crdd-coordinator/docker-restart-continuation",
    contractRevision: 1,
    handoffSha256,
    record,
  });
}
export function parseDockerRestartContinuationRecord(
  bytes: Uint8Array,
): Continuation | null {
  if (!bytes.byteLength || bytes.byteLength > 8192) return null;
  try {
    const value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (
      !value ||
      Object.keys(value).join(",") !==
        "contract,contractRevision,handoffSha256,record" ||
      value.contract !== "crdd-coordinator/docker-restart-continuation" ||
      value.contractRevision !== 1 ||
      !isSha256Hex(value.handoffSha256)
    )
      return null;
    const record = parseDockerRestartRecord(
      Buffer.from(`${JSON.stringify(value.record)}\n`),
    );
    if (!record || !Buffer.from(bytes).equals(encode(value))) return null;
    return Object.freeze({ ...value, record });
  } catch {
    return null;
  }
}
export function validateDockerRestartContinuationChain(
  bytes: readonly Uint8Array[],
  binding: DockerRestartBinding,
  handoffBytes: Uint8Array,
): readonly DockerRestartRecord[] | null {
  const hash = createHash("sha256").update(handoffBytes).digest("hex");
  const rawRecords: Buffer[] = [];
  for (const value of bytes) {
    const parsed = parseDockerRestartContinuationRecord(value);
    if (!parsed || parsed.handoffSha256 !== hash) return null;
    rawRecords.push(Buffer.from(`${JSON.stringify(parsed.record)}\n`));
  }
  return validateDockerRestartRecordChain(rawRecords, binding);
}

const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const fixedBindingKeys = [
  "recoveryId",
  "operationNonce",
  "localUserBindingHash",
  "runtimeStateIdentityHash",
  "runtimeStateProtectionHash",
  "stableLogicalHomeBindingHash",
  "pendingSubmissionSha256",
] as const;

/** Resolves immutable evidence only. Signature, lock and effect authority remain
 * the caller's responsibility. Every consumer uses the same generation cuts. */
export function resolveDockerRestartHistory(
  originBytes: readonly Uint8Array[],
  binding: DockerRestartBinding,
  handoffBytes: readonly Uint8Array[],
  continuationBytes: readonly Uint8Array[],
) {
  const origin = originBytes[0] && parseDockerRestartRecord(originBytes[0]);
  if (
    !origin ||
    originBytes.length !== 1 ||
    origin.phase !== "stop_intent" ||
    !fixedBindingKeys.every((key) => origin[key] === binding[key]) ||
    handoffBytes.length === 0 ||
    handoffBytes.length > 8 ||
    continuationBytes.length > 5
  )
    return null;
  let runtime = origin.runtimeExecutionIdentitySha256;
  let cut = 0;
  let hasRevisionTwo = false;
  const visited = new Set([runtime]);
  const generations: Array<{ cut: number; runtime: string; hash: string }> = [];
  for (const [index, bytes] of handoffBytes.entries()) {
    const handoff = parseDockerRestartHandoffRecord(bytes);
    if (
      !handoff ||
      handoff.sequence !== index ||
      handoff.originBindingSha256 !== digest(originBytes[0] as Uint8Array) ||
      handoff.originTipSha256 !== digest(originBytes[0] as Uint8Array) ||
      handoff.fromRuntimeIdentitySha256 !== runtime ||
      visited.has(handoff.toRuntimeIdentitySha256) ||
      handoff.previousHandoffSha256 !==
        (index ? digest(handoffBytes[index - 1] as Uint8Array) : null)
    )
      return null;
    if (handoff.contractRevision === 1 && hasRevisionTwo) return null;
    const nextCut =
      handoff.contractRevision === 2
        ? (handoff.continuationCount as number)
        : 0;
    if (
      nextCut < cut ||
      nextCut > continuationBytes.length ||
      (handoff.contractRevision === 2 &&
        handoff.continuationTipSha256 !==
          (nextCut
            ? digest(continuationBytes[nextCut - 1] as Uint8Array)
            : null))
    )
      return null;
    hasRevisionTwo ||= handoff.contractRevision === 2;
    cut = nextCut;
    runtime = handoff.toRuntimeIdentitySha256;
    visited.add(runtime);
    generations.push({ cut, runtime, hash: digest(bytes) });
  }
  if (runtime !== binding.runtimeExecutionIdentitySha256) return null;
  const records: DockerRestartRecord[] = [];
  const rawRecords: Buffer[] = [];
  for (const [index, bytes] of continuationBytes.entries()) {
    const wrapper = parseDockerRestartContinuationRecord(bytes);
    const generation = generations.filter((entry) => entry.cut <= index).at(-1);
    if (
      !wrapper ||
      !generation ||
      wrapper.handoffSha256 !== generation.hash ||
      wrapper.record.sequence !== index ||
      wrapper.record.runtimeExecutionIdentitySha256 !== generation.runtime ||
      !fixedBindingKeys.every((key) => wrapper.record[key] === binding[key]) ||
      wrapper.record.previousRecordSha256 !==
        (index ? digest(rawRecords[index - 1] as Buffer) : null)
    )
      return null;
    records.push(wrapper.record);
    rawRecords.push(Buffer.from(`${JSON.stringify(wrapper.record)}\n`));
  }
  return Object.freeze({
    records: Object.freeze(records),
    rawRecords: Object.freeze(rawRecords),
    currentPhase: records.at(-1)?.phase ?? origin.phase,
  });
}

/** Append-only migration proposal. Does not publish or acquire authority. */
export function createDockerRestartMigrationRecord(
  originBytes: readonly Uint8Array[],
  binding: DockerRestartBinding,
  handoffBytes: readonly Uint8Array[],
  continuationBytes: readonly Uint8Array[],
) {
  const origin = originBytes[0] && parseDockerRestartRecord(originBytes[0]);
  const previous = handoffBytes.length
    ? parseDockerRestartHandoffRecord(handoffBytes.at(-1) as Uint8Array)
    : null;
  if (
    !origin ||
    (handoffBytes.length && !previous) ||
    (!handoffBytes.length && continuationBytes.length)
  )
    throw new Error("docker_restart_migration_invalid");
  const from =
    previous?.toRuntimeIdentitySha256 ?? origin.runtimeExecutionIdentitySha256;
  if (
    handoffBytes.length &&
    !resolveDockerRestartHistory(
      originBytes,
      { ...binding, runtimeExecutionIdentitySha256: from },
      handoffBytes,
      continuationBytes,
    )
  )
    throw new Error("docker_restart_migration_invalid");
  const bytes = Buffer.from(
    `${JSON.stringify({
      contract: "crdd-coordinator/docker-restart-handoff-record",
      contractRevision: 2,
      originRecordRevision: 1,
      originBindingSha256: digest(originBytes[0] as Uint8Array),
      originTipSha256: digest(originBytes.at(-1) as Uint8Array),
      fromRuntimeIdentitySha256: from,
      toRuntimeIdentitySha256: binding.runtimeExecutionIdentitySha256,
      sequence: handoffBytes.length,
      previousHandoffSha256: handoffBytes.length
        ? digest(handoffBytes.at(-1) as Uint8Array)
        : null,
      continuationCount: continuationBytes.length,
      continuationTipSha256: continuationBytes.length
        ? digest(continuationBytes.at(-1) as Uint8Array)
        : null,
    })}\n`,
  );
  if (
    !resolveDockerRestartHistory(
      originBytes,
      binding,
      [...handoffBytes, bytes],
      continuationBytes,
    )
  )
    throw new Error("docker_restart_migration_invalid");
  return bytes;
}

export function createDockerRestartMigratedPhase(
  binding: DockerRestartBinding,
  phase: DockerRestartRecord["phase"],
  previous?: Uint8Array,
) {
  const prior = previous && parseDockerRestartRecord(previous);
  const bytes = createDockerRestartRecord(
    prior
      ? {
          ...binding,
          runtimeExecutionIdentitySha256: prior.runtimeExecutionIdentitySha256,
        }
      : binding,
    phase,
    previous,
  );
  const value = JSON.parse(bytes.toString());
  value.runtimeExecutionIdentitySha256 = binding.runtimeExecutionIdentitySha256;
  return Buffer.from(`${JSON.stringify(value)}\n`);
}
