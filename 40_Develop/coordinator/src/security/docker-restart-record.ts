/**
 * docker-restart-recordに属する責務をまとめる。
 *
 * @responsibility DockerRestartPhaseを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
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
/**
 * docker-restart-recordで使用するDocker Restart Phaseの値契約を定義する。
 *
 * @responsibility Docker Restart PhaseのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRestartPhaseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRestartPhaseで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRestartPhaseの宣言は外部境界を開かない。
 * @security DockerRestartPhaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerRestartPhaseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerRestartPhase = (typeof dockerRestartPhases)[number];
/**
 * docker-restart-recordで使用するDocker Restart Bindingの値契約を定義する。
 *
 * @responsibility Docker Restart BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRestartBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRestartBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRestartBindingの宣言は外部境界を開かない。
 * @security DockerRestartBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerRestartBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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
/**
 * docker-restart-recordで使用するDocker Restart 記録の値契約を定義する。
 *
 * @responsibility Docker Restart 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRestartRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRestartRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRestartRecordの宣言は外部境界を開かない。
 * @security DockerRestartRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerRestartRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * Bindingが有効か判定する。
 *
 * @responsibility Bindingの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: Record<string, unknown>
 * @returns booleanを返す。
 * @precondition 「value: Record<string, unknown>」がvalidBindingの入力契約を満たす。
 * @postcondition validBindingの責務を完了した結果だけを返す。
 * @effect N/A: validBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validBindingは独自の失敗分岐を所有しない。
 * @invariant validBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validBindingはProcess内の同一Subsystemで完結する。
 * @security validBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validBindingは共有非同期状態を持たない同期処理である。
 */
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

/**
 * docker-restart-recordを固定形式へ符号化する。
 *
 * @responsibility docker-restart-recordの入力値、符号化規則、出力byte列の境界を所有する。
 * @trace ARCH-000008
 * @input record: DockerRestartRecord
 * @returns Bufferを返す。
 * @precondition 「record: DockerRestartRecord」がencodeの入力契約を満たす。
 * @postcondition encodeの責務を完了した結果だけを返す。
 * @effect N/A: encodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: encodeは独自の失敗分岐を所有しない。
 * @invariant encodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: encodeはProcess内の同一Subsystemで完結する。
 * @security encodeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: encodeは共有非同期状態を持たない同期処理である。
 */
function encode(record: DockerRestartRecord): Buffer {
  return Buffer.from(
    `${JSON.stringify(Object.fromEntries(recordKeys.map((key) => [key, record[key]])))}\n`,
    "utf8",
  );
}

/**
 * Parses data only; acceptance does not confer restart or recovery authority.
 *
 * @responsibility Docker Restart 記録の入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000008
 * @input bytes: Uint8Array
 * @returns DockerRestartRecord | nullを返す。
 * @precondition 「bytes: Uint8Array」がparseDockerRestartRecordの入力契約を満たす。
 * @postcondition parseDockerRestartRecordの責務を完了した結果だけを返す。
 * @effect N/A: parseDockerRestartRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseDockerRestartRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseDockerRestartRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseDockerRestartRecordはProcess内の同一Subsystemで完結する。
 * @security parseDockerRestartRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseDockerRestartRecordは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Docker Restart 記録 Chainの契約を検証する。
 *
 * @responsibility Docker Restart 記録 Chainの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input records: readonly Uint8Array[]、expectedBinding: DockerRestartBinding
 * @returns readonly DockerRestartRecord[] | nullを返す。
 * @precondition 「records: readonly Uint8Array[]、expectedBinding: DockerRestartBinding」がvalidateDockerRestartRecordChainの入力契約を満たす。
 * @postcondition validateDockerRestartRecordChainの責務を完了した結果だけを返す。
 * @effect N/A: validateDockerRestartRecordChainは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateDockerRestartRecordChainは独自の失敗分岐を所有しない。
 * @invariant validateDockerRestartRecordChainは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateDockerRestartRecordChainはProcess内の同一Subsystemで完結する。
 * @security validateDockerRestartRecordChainはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateDockerRestartRecordChainは共有非同期状態を持たない同期処理である。
 */
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

/**
 * The caller must validate the complete persisted chain before appending.
 *
 * @responsibility Docker Restart 記録の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input binding: DockerRestartBinding、phase: DockerRestartPhase、previousRecordBytes: Uint8Array
 * @returns Bufferを返す。
 * @precondition 「binding: DockerRestartBinding、phase: DockerRestartPhase、previousRecordBytes: Uint8Array」がcreateDockerRestartRecordの入力契約を満たす。
 * @postcondition createDockerRestartRecordの責務を完了した結果だけを返す。
 * @effect N/A: createDockerRestartRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createDockerRestartRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createDockerRestartRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDockerRestartRecordはProcess内の同一Subsystemで完結する。
 * @security createDockerRestartRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDockerRestartRecordは共有非同期状態を持たない同期処理である。
 */
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
