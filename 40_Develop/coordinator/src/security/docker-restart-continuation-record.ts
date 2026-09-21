/**
 * docker-restart-continuation-recordに属する責務をまとめる。
 *
 * @responsibility Continuationを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import { createHash } from "node:crypto";
import { isSha256Hex } from "./docker-recovery-identity.ts";
import { parseDockerRestartHandoffRecord } from "./docker-restart-handoff-record.ts";
import {
  createDockerRestartRecord,
  type DockerRestartBinding,
  type DockerRestartRecord,
  parseDockerRestartRecord,
  validateDockerRestartRecordChain,
} from "./docker-restart-record.ts";

/**
 * docker-restart-continuation-recordで使用するContinuationの値契約を定義する。
 *
 * @responsibility ContinuationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape Continuationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Continuationで宣言した値と責務の対応を維持する。
 * @boundary N/A: Continuationの宣言は外部境界を開かない。
 * @security ContinuationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Continuationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Continuation = Readonly<{
  contract: "crdd-coordinator/docker-restart-continuation";
  contractRevision: 1;
  handoffSha256: string;
  record: DockerRestartRecord;
}>;
const encode = (value: Continuation) =>
  Buffer.from(`${JSON.stringify(value)}\n`);
/**
 * Pure record wrapping, never execution authority.
 *
 * @responsibility Docker Restart Continuation 記録の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input recordBytes: Uint8Array、handoffSha256: string
 * @returns Bufferを返す。
 * @precondition 「recordBytes: Uint8Array、handoffSha256: string」がcreateDockerRestartContinuationRecordの入力契約を満たす。
 * @postcondition createDockerRestartContinuationRecordの責務を完了した結果だけを返す。
 * @effect N/A: createDockerRestartContinuationRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createDockerRestartContinuationRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createDockerRestartContinuationRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDockerRestartContinuationRecordはProcess内の同一Subsystemで完結する。
 * @security createDockerRestartContinuationRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDockerRestartContinuationRecordは共有非同期状態を持たない同期処理である。
 */
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
/**
 * Docker Restart Continuation 記録を構造化値へ解析する。
 *
 * @responsibility Docker Restart Continuation 記録の入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000008
 * @input bytes: Uint8Array
 * @returns Continuation | nullを返す。
 * @precondition 「bytes: Uint8Array」がparseDockerRestartContinuationRecordの入力契約を満たす。
 * @postcondition parseDockerRestartContinuationRecordの責務を完了した結果だけを返す。
 * @effect N/A: parseDockerRestartContinuationRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseDockerRestartContinuationRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseDockerRestartContinuationRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseDockerRestartContinuationRecordはProcess内の同一Subsystemで完結する。
 * @security parseDockerRestartContinuationRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseDockerRestartContinuationRecordは共有非同期状態を持たない同期処理である。
 */
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
/**
 * Docker Restart Continuation Chainの契約を検証する。
 *
 * @responsibility Docker Restart Continuation Chainの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input bytes: readonly Uint8Array[]、binding: DockerRestartBinding、handoffBytes: Uint8Array
 * @returns readonly DockerRestartRecord[] | nullを返す。
 * @precondition 「bytes: readonly Uint8Array[]、binding: DockerRestartBinding、handoffBytes: Uint8Array」がvalidateDockerRestartContinuationChainの入力契約を満たす。
 * @postcondition validateDockerRestartContinuationChainの責務を完了した結果だけを返す。
 * @effect N/A: validateDockerRestartContinuationChainは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateDockerRestartContinuationChainは独自の失敗分岐を所有しない。
 * @invariant validateDockerRestartContinuationChainは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateDockerRestartContinuationChainはProcess内の同一Subsystemで完結する。
 * @security validateDockerRestartContinuationChainはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateDockerRestartContinuationChainは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Resolves immutable evidence only. Signature, lock and effect authority remain
 *
 * @responsibility Docker Restart Historyの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input originBytes: readonly Uint8Array[]、binding: DockerRestartBinding、handoffBytes: readonly Uint8Array[]、continuationBytes: readonly Uint8Array[]
 * @returns resolveDockerRestartHistoryの計算結果を返す。
 * @precondition 「originBytes: readonly Uint8Array[]、binding: DockerRestartBinding、handoffBytes: readonly Uint8Array[]、continuationBytes: readonly Uint8Array[]」がresolveDockerRestartHistoryの入力契約を満たす。
 * @postcondition resolveDockerRestartHistoryの責務を完了した結果だけを返す。
 * @effect N/A: resolveDockerRestartHistoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveDockerRestartHistoryは独自の失敗分岐を所有しない。
 * @invariant resolveDockerRestartHistoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveDockerRestartHistoryはProcess内の同一Subsystemで完結する。
 * @security resolveDockerRestartHistoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveDockerRestartHistoryは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Append-only migration proposal. Does not publish or acquire authority.
 *
 * @responsibility Docker Restart Migration 記録の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input originBytes: readonly Uint8Array[]、binding: DockerRestartBinding、handoffBytes: readonly Uint8Array[]、continuationBytes: readonly Uint8Array[]
 * @returns createDockerRestartMigrationRecordの計算結果を返す。
 * @precondition 「originBytes: readonly Uint8Array[]、binding: DockerRestartBinding、handoffBytes: readonly Uint8Array[]、continuationBytes: readonly Uint8Array[]」がcreateDockerRestartMigrationRecordの入力契約を満たす。
 * @postcondition createDockerRestartMigrationRecordの責務を完了した結果だけを返す。
 * @effect N/A: createDockerRestartMigrationRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createDockerRestartMigrationRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createDockerRestartMigrationRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDockerRestartMigrationRecordはProcess内の同一Subsystemで完結する。
 * @security createDockerRestartMigrationRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDockerRestartMigrationRecordは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Docker Restart Migrated Phaseを構築する。
 *
 * @responsibility Docker Restart Migrated Phaseの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input binding: DockerRestartBinding、phase: DockerRestartRecord["phase"]、previous: Uint8Array
 * @returns createDockerRestartMigratedPhaseの計算結果を返す。
 * @precondition 「binding: DockerRestartBinding、phase: DockerRestartRecord["phase"]、previous: Uint8Array」がcreateDockerRestartMigratedPhaseの入力契約を満たす。
 * @postcondition createDockerRestartMigratedPhaseの責務を完了した結果だけを返す。
 * @effect N/A: createDockerRestartMigratedPhaseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDockerRestartMigratedPhaseは独自の失敗分岐を所有しない。
 * @invariant createDockerRestartMigratedPhaseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDockerRestartMigratedPhaseはProcess内の同一Subsystemで完結する。
 * @security createDockerRestartMigratedPhaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDockerRestartMigratedPhaseは共有非同期状態を持たない同期処理である。
 */
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
