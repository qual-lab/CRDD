import { createHash } from "node:crypto";
import { isSha256Hex } from "./docker-recovery-identity.ts";
import {
  type DockerRestartBinding,
  type DockerRestartRecord,
  parseDockerRestartRecord,
  validateDockerRestartRecordChain,
} from "./docker-restart-record.ts";

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
