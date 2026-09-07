import { createHash } from "node:crypto";
import { isSha256Hex } from "./docker-recovery-identity.ts";
import {
  type DockerRestartBinding,
  validateDockerRestartRecordChain,
} from "./docker-restart-record.ts";

/** Data provenance only. No signature, filesystem, lock or effect authority. */
export type DockerRestartHandoffRecord = Readonly<{
  contract: "crdd-coordinator/docker-restart-handoff-record";
  contractRevision: 1;
  originRecordRevision: 1;
  originBindingSha256: string;
  originTipSha256: string;
  fromRuntimeIdentitySha256: string;
  toRuntimeIdentitySha256: string;
  sequence: number;
  previousHandoffSha256: string | null;
}>;
const keys = [
  "contract",
  "contractRevision",
  "originRecordRevision",
  "originBindingSha256",
  "originTipSha256",
  "fromRuntimeIdentitySha256",
  "toRuntimeIdentitySha256",
  "sequence",
  "previousHandoffSha256",
] as const;
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const encode = (record: DockerRestartHandoffRecord) =>
  Buffer.from(
    `${JSON.stringify(Object.fromEntries(keys.map((key) => [key, record[key]])))}\n`,
  );

export function parseDockerRestartHandoffRecord(
  bytes: Uint8Array,
): DockerRestartHandoffRecord | null {
  if (!bytes.byteLength || bytes.byteLength > 4096) return null;
  try {
    const value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).length !== keys.length ||
      !keys.every((key) => Object.hasOwn(value, key)) ||
      value.contract !== "crdd-coordinator/docker-restart-handoff-record" ||
      value.contractRevision !== 1 ||
      value.originRecordRevision !== 1 ||
      ![
        value.originBindingSha256,
        value.originTipSha256,
        value.fromRuntimeIdentitySha256,
        value.toRuntimeIdentitySha256,
      ].every(isSha256Hex) ||
      value.fromRuntimeIdentitySha256 === value.toRuntimeIdentitySha256 ||
      !Number.isInteger(value.sequence) ||
      value.sequence < 0 ||
      value.sequence >= 8 ||
      (value.sequence === 0
        ? value.previousHandoffSha256 !== null
        : !isSha256Hex(value.previousHandoffSha256))
    )
      return null;
    return Buffer.from(bytes).equals(encode(value))
      ? Object.freeze(value)
      : null;
  } catch {
    return null;
  }
}

/** Origin binding must come from separately verified historical provenance.
 * Current identity must come from separately verified current authority.
 * This function validates neither of those authorities and issues none. */
export function validateDockerRestartHandoffChain(
  originRecords: readonly Uint8Array[],
  originBinding: DockerRestartBinding,
  handoffs: readonly Uint8Array[],
  currentRuntimeIdentitySha256: string,
): readonly DockerRestartHandoffRecord[] | null {
  const oldRecords = validateDockerRestartRecordChain(
    originRecords,
    originBinding,
  );
  if (
    !oldRecords ||
    oldRecords.at(-1)?.phase === "settled" ||
    !handoffs.length ||
    handoffs.length > 8 ||
    !isSha256Hex(currentRuntimeIdentitySha256)
  )
    return null;
  // The canonical first record commits every exact binding field, including Task.
  const bindingHash = digest(originRecords[0] as Uint8Array);
  const tipHash = digest(originRecords.at(-1) as Uint8Array);
  let runtime = originBinding.runtimeExecutionIdentitySha256;
  const visited = new Set([runtime]);
  const parsedRecords: DockerRestartHandoffRecord[] = [];
  for (const [index, bytes] of handoffs.entries()) {
    const record = parseDockerRestartHandoffRecord(bytes);
    if (
      !record ||
      record.sequence !== index ||
      record.originBindingSha256 !== bindingHash ||
      record.originTipSha256 !== tipHash ||
      record.fromRuntimeIdentitySha256 !== runtime ||
      visited.has(record.toRuntimeIdentitySha256) ||
      record.previousHandoffSha256 !==
        (index ? digest(handoffs[index - 1] as Uint8Array) : null)
    )
      return null;
    runtime = record.toRuntimeIdentitySha256;
    visited.add(runtime);
    parsedRecords.push(record);
  }
  return runtime === currentRuntimeIdentitySha256
    ? Object.freeze(parsedRecords)
    : null;
}

/** Builds bytes only; caller owns exclusive append and durable re-read. */
export function createDockerRestartHandoffRecord(
  originRecords: readonly Uint8Array[],
  originBinding: DockerRestartBinding,
  previous: readonly Uint8Array[],
  currentRuntimeIdentitySha256: string,
): Buffer {
  const from = previous.length
    ? parseDockerRestartHandoffRecord(previous.at(-1) as Uint8Array)
        ?.toRuntimeIdentitySha256
    : originBinding.runtimeExecutionIdentitySha256;
  if (
    !from ||
    previous.length >= 8 ||
    (previous.length &&
      !validateDockerRestartHandoffChain(
        originRecords,
        originBinding,
        previous,
        from,
      ))
  )
    throw new Error("docker_restart_handoff_predecessor_invalid");
  const bytes = encode({
    contract: "crdd-coordinator/docker-restart-handoff-record",
    contractRevision: 1,
    originRecordRevision: 1,
    originBindingSha256: originRecords.length
      ? digest(originRecords[0] as Uint8Array)
      : "",
    originTipSha256: originRecords.length
      ? digest(originRecords.at(-1) as Uint8Array)
      : "",
    fromRuntimeIdentitySha256: from,
    toRuntimeIdentitySha256: currentRuntimeIdentitySha256,
    sequence: previous.length,
    previousHandoffSha256: previous.length
      ? digest(previous.at(-1) as Uint8Array)
      : null,
  });
  if (
    !validateDockerRestartHandoffChain(
      originRecords,
      originBinding,
      [...previous, bytes],
      currentRuntimeIdentitySha256,
    )
  )
    throw new Error("docker_restart_handoff_binding_invalid");
  return bytes;
}
