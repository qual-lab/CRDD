/**
 * Docker Probeの回復記録を読み書きする。
 *
 * @responsibility exact token、記録bytes、Rootと子実体の照合・記録保存を所有する。Docker技術要求は発行しない。
 * @trace ARCH-000008
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describeDockerProbeResource } from "../probe/plan.ts";

/**
 * docker-isolationで使用するEntity Typeの値契約を定義する。
 *
 * @responsibility Entity TypeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape EntityTypeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant EntityTypeで宣言した値と責務の対応を維持する。
 * @boundary N/A: EntityTypeの宣言は外部境界を開かない。
 * @security EntityTypeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility EntityTypeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type EntityType = "file" | "directory";

/**
 * docker-isolationで使用するFilesystem Identityの値契約を定義する。
 *
 * @responsibility Filesystem IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape FilesystemIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FilesystemIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: FilesystemIdentityの宣言は外部境界を開かない。
 * @security FilesystemIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility FilesystemIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type FilesystemIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;

/**
 * docker-isolationで使用するSerializable Identityの値契約を定義する。
 *
 * @responsibility Serializable IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape SerializableIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SerializableIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: SerializableIdentityの宣言は外部境界を開かない。
 * @security SerializableIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SerializableIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SerializableIdentity = Readonly<{
  dev: string;
  ino: string;
  birthtimeNs: string;
}>;

/**
 * docker-isolationで使用するDocker Mountsの値契約を定義する。
 *
 * @responsibility Docker MountsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerMountsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerMountsで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerMountsの宣言は外部境界を開かない。
 * @security DockerMountsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerMountsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerMounts = Readonly<{
  workspace: string;
  providerHome: string;
  tmp: string;
  events: string;
  projection: string;
  management: string;
}>;

/**
 * docker-isolationで使用するDocker 回復 記録の値契約を定義する。
 *
 * @responsibility Docker 回復 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRecoveryRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRecoveryRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRecoveryRecordの宣言は外部境界を開かない。
 * @security DockerRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerRecoveryRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerRecoveryRecord = Readonly<{
  schema: "crdd-coordinator-docker-recovery/v1";
  probeId: string;
  nonceHash: string;
  rootName: string;
  rootIdentity: SerializableIdentity;
  childIdentities: Readonly<Record<string, SerializableIdentity>>;
  container: Readonly<{ id: string | null; name: string; label: string }>;
  engine: string;
  image: string;
  hostRecoveryId: string;
  createdAt: string;
}>;

/**
 * docker-isolationで使用するLoaded Docker 回復の値契約を定義する。
 *
 * @responsibility Loaded Docker 回復のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape LoadedDockerRecoveryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LoadedDockerRecoveryで宣言した値と責務の対応を維持する。
 * @boundary N/A: LoadedDockerRecoveryの宣言は外部境界を開かない。
 * @security LoadedDockerRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LoadedDockerRecoveryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LoadedDockerRecovery = Readonly<{
  parsed: Readonly<{
    rootName: string;
    probeId: string;
    nonce: string;
    recordHash: string;
  }>;
  record: DockerRecoveryRecord;
  root: string;
  children: DockerMounts;
  marker: string;
  present: ReadonlySet<string>;
}>;

const RECOVERY_FILE = "docker-probe-recovery-v1.json";

const OPERATION_PREFIX = "crdd-coordinator-doctor-";

/**
 * Objectかを判定する。
 *
 * @responsibility Objectの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisObjectの入力契約を満たす。
 * @postcondition isObjectの責務を完了した結果だけを返す。
 * @effect N/A: isObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isObjectは独自の失敗分岐を所有しない。
 * @invariant isObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isObjectはProcess内の同一Subsystemで完結する。
 * @security isObjectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isObjectは共有非同期状態を持たない同期処理である。
 */
function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * own Valueを決定する。
 *
 * @responsibility own Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: object、key: string
 * @returns unknownを返す。
 * @precondition 「value: object、key: string」がownValueの入力契約を満たす。
 * @postcondition ownValueの責務を完了した結果だけを返す。
 * @effect N/A: ownValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownValueは独自の失敗分岐を所有しない。
 * @invariant ownValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownValueはProcess内の同一Subsystemで完結する。
 * @security ownValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownValueは共有非同期状態を持たない同期処理である。
 */
function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor &&
    "value" in descriptor &&
    !descriptor.get &&
    !descriptor.set
    ? descriptor.value
    : undefined;
}

/**
 * own Stringを決定する。
 *
 * @responsibility own Stringの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、key: string
 * @returns string | nullを返す。
 * @precondition 「value: unknown、key: string」がownStringの入力契約を満たす。
 * @postcondition ownStringの責務を完了した結果だけを返す。
 * @effect N/A: ownStringは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownStringは独自の失敗分岐を所有しない。
 * @invariant ownStringは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownStringはProcess内の同一Subsystemで完結する。
 * @security ownStringはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownStringは共有非同期状態を持たない同期処理である。
 */
function ownString(value: unknown, key: string): string | null {
  const candidate = isObject(value) ? ownValue(value, key) : undefined;
  return typeof candidate === "string" ? candidate : null;
}

/**
 * error Codeを決定する。
 *
 * @responsibility error Codeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns string | nullを返す。
 * @precondition 「error: unknown」がerrorCodeの入力契約を満たす。
 * @postcondition errorCodeの責務を完了した結果だけを返す。
 * @effect N/A: errorCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorCodeは独自の失敗分岐を所有しない。
 * @invariant errorCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorCodeはProcess内の同一Subsystemで完結する。
 * @security errorCodeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorCodeは共有非同期状態を持たない同期処理である。
 */
function errorCode(error: unknown): string | null {
  return ownString(error, "code");
}

/**
 * Serializable Identityを固定Schemaへ正規化する。
 *
 * @responsibility Serializable Identityの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns SerializableIdentityを返す。
 * @precondition 「value: unknown」がnormalizeSerializableIdentityの入力契約を満たす。
 * @postcondition normalizeSerializableIdentityの責務を完了した結果だけを返す。
 * @effect N/A: normalizeSerializableIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure normalizeSerializableIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeSerializableIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeSerializableIdentityはProcess内の同一Subsystemで完結する。
 * @security normalizeSerializableIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeSerializableIdentityは共有非同期状態を持たない同期処理である。
 */
function normalizeSerializableIdentity(value: unknown): SerializableIdentity {
  if (!isObject(value)) throw new Error("docker_recovery_record_mismatch");
  const dev = ownString(value, "dev");
  const ino = ownString(value, "ino");
  const birthtimeNs = ownString(value, "birthtimeNs");
  if (!dev || !ino || !birthtimeNs)
    throw new Error("docker_recovery_record_mismatch");
  return Object.freeze({ dev, ino, birthtimeNs });
}

/**
 * Docker 回復 記録を固定Schemaへ正規化する。
 *
 * @responsibility Docker 回復 記録の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns DockerRecoveryRecordを返す。
 * @precondition 「value: unknown」がnormalizeDockerRecoveryRecordの入力契約を満たす。
 * @postcondition normalizeDockerRecoveryRecordの責務を完了した結果だけを返す。
 * @effect N/A: normalizeDockerRecoveryRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure normalizeDockerRecoveryRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeDockerRecoveryRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeDockerRecoveryRecordはProcess内の同一Subsystemで完結する。
 * @security normalizeDockerRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeDockerRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
function normalizeDockerRecoveryRecord(value: unknown): DockerRecoveryRecord {
  if (!isObject(value)) throw new Error("docker_recovery_record_mismatch");
  const schema = ownString(value, "schema");
  const probeId = ownString(value, "probeId");
  const nonceHash = ownString(value, "nonceHash");
  const rootName = ownString(value, "rootName");
  const hostRecoveryId = ownString(value, "hostRecoveryId");
  const createdAt = ownString(value, "createdAt");
  const engine = ownString(value, "engine");
  const image = ownString(value, "image");
  const childrenValue = ownValue(value, "childIdentities");
  const containerValue = ownValue(value, "container");
  if (
    schema !== "crdd-coordinator-docker-recovery/v1" ||
    !probeId ||
    !nonceHash ||
    !rootName ||
    !hostRecoveryId ||
    !createdAt ||
    !engine ||
    !image ||
    !isObject(childrenValue) ||
    !isObject(containerValue)
  )
    throw new Error("docker_recovery_record_mismatch");
  const childIdentities: Record<string, SerializableIdentity> = {};
  for (const key of Object.keys(childrenValue)) {
    childIdentities[key] = normalizeSerializableIdentity(
      ownValue(childrenValue, key),
    );
  }
  const idValue = ownValue(containerValue, "id");
  const id = typeof idValue === "string" ? idValue : null;
  const name = ownString(containerValue, "name");
  const label = ownString(containerValue, "label");
  if ((idValue !== null && id === null) || !name || !label) {
    throw new Error("docker_recovery_record_mismatch");
  }
  return Object.freeze({
    schema,
    probeId,
    nonceHash,
    rootName,
    rootIdentity: normalizeSerializableIdentity(
      ownValue(value, "rootIdentity"),
    ),
    childIdentities: Object.freeze(childIdentities),
    container: Object.freeze({ id, name, label }),
    engine,
    image,
    hostRecoveryId,
    createdAt,
  });
}

/**
 * filesystem Identityを決定する。
 *
 * @responsibility filesystem Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string、expectedType: EntityType
 * @returns FilesystemIdentityを返す。
 * @precondition 「target: string、expectedType: EntityType」がfilesystemIdentityの入力契約を満たす。
 * @postcondition filesystemIdentityの責務を完了した結果だけを返す。
 * @effect filesystemIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure filesystemIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant filesystemIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security filesystemIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: filesystemIdentityは共有非同期状態を持たない同期処理である。
 */
function filesystemIdentity(
  target: string,
  expectedType: EntityType,
): FilesystemIdentity {
  const metadata = fs.lstatSync(target, { bigint: true });
  const isTypeValid =
    expectedType === "file" ? metadata.isFile() : metadata.isDirectory();
  if (
    !isTypeValid ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    throw new Error("docker_cli_untrusted");
  }
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

/**
 * serializable Identityを決定する。
 *
 * @responsibility serializable Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string、expectedType: EntityType
 * @returns SerializableIdentityを返す。
 * @precondition 「target: string、expectedType: EntityType」がserializableIdentityの入力契約を満たす。
 * @postcondition serializableIdentityの責務を完了した結果だけを返す。
 * @effect N/A: serializableIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: serializableIdentityは独自の失敗分岐を所有しない。
 * @invariant serializableIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: serializableIdentityはProcess内の同一Subsystemで完結する。
 * @security serializableIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: serializableIdentityは共有非同期状態を持たない同期処理である。
 */
function serializableIdentity(
  target: string,
  expectedType: EntityType = "directory",
): SerializableIdentity {
  const identity = filesystemIdentity(target, expectedType);
  return {
    dev: identity.dev.toString(),
    ino: identity.ino.toString(),
    birthtimeNs: identity.birthtimeNs.toString(),
  };
}

/**
 * identity Matches 記録を決定する。
 *
 * @responsibility identity Matches 記録の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string、record: SerializableIdentity、expectedType: EntityType
 * @returns booleanを返す。
 * @precondition 「target: string、record: SerializableIdentity、expectedType: EntityType」がidentityMatchesRecordの入力契約を満たす。
 * @postcondition identityMatchesRecordの責務を完了した結果だけを返す。
 * @effect N/A: identityMatchesRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure identityMatchesRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant identityMatchesRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: identityMatchesRecordはProcess内の同一Subsystemで完結する。
 * @security identityMatchesRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: identityMatchesRecordは共有非同期状態を持たない同期処理である。
 */
function identityMatchesRecord(
  target: string,
  record: SerializableIdentity,
  expectedType: EntityType = "directory",
): boolean {
  try {
    const identity = filesystemIdentity(target, expectedType);
    return (
      identity.dev === BigInt(record.dev) &&
      identity.ino === BigInt(record.ino) &&
      identity.birthtimeNs === BigInt(record.birthtimeNs)
    );
  } catch {
    return false;
  }
}

/**
 * Docker Isolation 回復 Tokenを表示形式へ整形する。
 *
 * @responsibility Docker Isolation 回復 Tokenの入力値、表示規則、機密を含めない出力境界を所有する。
 * @trace ARCH-000008
 * @input rootName: string、probeId: string、nonce: string、recordHash: string
 * @returns stringを返す。
 * @precondition 「rootName: string、probeId: string、nonce: string、recordHash: string」がformatDockerIsolationRecoveryTokenの入力契約を満たす。
 * @postcondition formatDockerIsolationRecoveryTokenの責務を完了した結果だけを返す。
 * @effect N/A: formatDockerIsolationRecoveryTokenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: formatDockerIsolationRecoveryTokenは独自の失敗分岐を所有しない。
 * @invariant formatDockerIsolationRecoveryTokenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: formatDockerIsolationRecoveryTokenはProcess内の同一Subsystemで完結する。
 * @security formatDockerIsolationRecoveryTokenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: formatDockerIsolationRecoveryTokenは共有非同期状態を持たない同期処理である。
 */
export function formatDockerIsolationRecoveryToken(
  rootName: string,
  probeId: string,
  nonce: string,
  recordHash: string,
): string {
  return `docker.${rootName}.${probeId}.${nonce}.${recordHash}`;
}

/**
 * Docker Isolation 回復 Id 候補かを判定する。
 *
 * @responsibility Docker Isolation 回復 Id 候補の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisDockerIsolationRecoveryIdCandidateの入力契約を満たす。
 * @postcondition isDockerIsolationRecoveryIdCandidateの責務を完了した結果だけを返す。
 * @effect N/A: isDockerIsolationRecoveryIdCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure isDockerIsolationRecoveryIdCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant isDockerIsolationRecoveryIdCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isDockerIsolationRecoveryIdCandidateはProcess内の同一Subsystemで完結する。
 * @security isDockerIsolationRecoveryIdCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isDockerIsolationRecoveryIdCandidateは共有非同期状態を持たない同期処理である。
 */
export function isDockerIsolationRecoveryIdCandidate(
  value: unknown,
): value is string {
  if (typeof value !== "string" || value.length > 1024) return false;
  try {
    parseDockerProbeRecoveryToken(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 回復 Tokenを構造化値へ解析する。
 *
 * @responsibility 回復 Tokenの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns Readonly<{ rootName: string; probeId: string; nonce: string; recordHash: string; }>を返す。
 * @precondition 「token: unknown」がparseDockerProbeRecoveryTokenの入力契約を満たす。
 * @postcondition parseDockerProbeRecoveryTokenの責務を完了した結果だけを返す。
 * @effect N/A: parseDockerProbeRecoveryTokenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseDockerProbeRecoveryTokenは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseDockerProbeRecoveryTokenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseDockerProbeRecoveryTokenはProcess内の同一Subsystemで完結する。
 * @security parseDockerProbeRecoveryTokenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseDockerProbeRecoveryTokenは共有非同期状態を持たない同期処理である。
 */
export function parseDockerProbeRecoveryToken(token: unknown): Readonly<{
  rootName: string;
  probeId: string;
  nonce: string;
  recordHash: string;
}> {
  if (typeof token !== "string")
    throw new Error("docker_recovery_token_invalid");
  const match =
    /^docker\.(crdd-coordinator-doctor-[A-Za-z0-9_-]+)\.([0-9a-f-]{36})\.([0-9a-f-]{36})\.([0-9a-f]{64})$/u.exec(
      token,
    );
  if (!match) throw new Error("docker_recovery_token_invalid");
  const rootName = match[1];
  const probeId = match[2];
  const nonce = match[3];
  const recordHash = match[4];
  if (!rootName || !probeId || !nonce || !recordHash)
    throw new Error("docker_recovery_token_invalid");
  return { rootName, probeId, nonce, recordHash };
}

/**
 * recovery 記録 Pathを決定する。
 *
 * @responsibility recovery 記録 Pathの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input management: string
 * @returns stringを返す。
 * @precondition 「management: string」がrecoveryRecordPathの入力契約を満たす。
 * @postcondition recoveryRecordPathの責務を完了した結果だけを返す。
 * @effect N/A: recoveryRecordPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryRecordPathは独自の失敗分岐を所有しない。
 * @invariant recoveryRecordPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryRecordPathはProcess内の同一Subsystemで完結する。
 * @security recoveryRecordPathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoveryRecordPathは共有非同期状態を持たない同期処理である。
 */
function recoveryRecordPath(management: string): string {
  return path.join(management, RECOVERY_FILE);
}

/**
 * 回復 記録を書き込む。
 *
 * @responsibility 回復 記録の書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input mounts: DockerMounts、probeId: string、nonce: string、hostRecoveryId: string、containerId: string | null
 * @returns stringを返す。
 * @precondition 「mounts: DockerMounts、probeId: string、nonce: string、hostRecoveryId: string、containerId: string | null」がwriteDockerProbeRecoveryRecordの入力契約を満たす。
 * @postcondition writeDockerProbeRecoveryRecordの責務を完了した結果だけを返す。
 * @effect writeDockerProbeRecoveryRecordはFilesystemの読取りまたは書込みを実行する。
 * @failure writeDockerProbeRecoveryRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeDockerProbeRecoveryRecordは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security writeDockerProbeRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: writeDockerProbeRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
export function writeDockerProbeRecoveryRecord(
  mounts: DockerMounts,
  probeId: string,
  nonce: string,
  hostRecoveryId: string,
  containerId: string | null = null,
): string {
  const root = path.dirname(mounts.management);
  const rootName = path.basename(root);
  if (
    !rootName.startsWith(OPERATION_PREFIX) ||
    fs.realpathSync(root) !== root ||
    fs.realpathSync(path.dirname(root)) !== path.dirname(root)
  )
    throw new Error("docker_recovery_boundary_failed");
  const resource = describeDockerProbeResource(probeId);
  const record = {
    schema: "crdd-coordinator-docker-recovery/v1",
    probeId,
    nonceHash: createHash("sha256").update(nonce).digest("hex"),
    rootName,
    rootIdentity: serializableIdentity(root),
    childIdentities: {
      workspace: serializableIdentity(mounts.workspace),
      "provider-home": serializableIdentity(mounts.providerHome),
      tmp: serializableIdentity(mounts.tmp),
      events: serializableIdentity(mounts.events),
      projection: serializableIdentity(mounts.projection),
      management: serializableIdentity(mounts.management),
    },
    container: {
      id: containerId,
      name: resource.name,
      label: resource.label,
    },
    engine: resource.engine,
    image: resource.image,
    hostRecoveryId,
    createdAt: new Date().toISOString(),
  };
  const target = recoveryRecordPath(mounts.management);
  const temporary = `${target}.${randomUUID()}.tmp`;
  const serialized = `${JSON.stringify(record)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  fs.writeFileSync(temporary, serialized, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  fs.renameSync(temporary, target);
  if (
    !identityMatchesRecord(target, serializableIdentity(target, "file"), "file")
  )
    throw new Error("docker_recovery_record_failed");
  return formatDockerIsolationRecoveryToken(
    rootName,
    probeId,
    nonce,
    recordHash,
  );
}

/**
 * 回復 記録を読み込む。
 *
 * @responsibility 回復 記録の読取り元、Schema検証、読取不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns LoadedDockerRecoveryを返す。
 * @precondition 「token: unknown」がloadDockerProbeRecoveryRecordの入力契約を満たす。
 * @postcondition loadDockerProbeRecoveryRecordの責務を完了した結果だけを返す。
 * @effect loadDockerProbeRecoveryRecordはFilesystemの読取りまたは書込みを実行する。
 * @failure loadDockerProbeRecoveryRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant loadDockerProbeRecoveryRecordは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security loadDockerProbeRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: loadDockerProbeRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
export function loadDockerProbeRecoveryRecord(
  token: unknown,
  expectedRoot: unknown,
): LoadedDockerRecovery {
  const parsed = parseDockerProbeRecoveryToken(token);
  if (
    typeof expectedRoot !== "string" ||
    !path.isAbsolute(expectedRoot) ||
    path.resolve(expectedRoot) !== expectedRoot ||
    path.basename(expectedRoot) !== parsed.rootName
  )
    throw new Error("docker_recovery_boundary_failed");
  const parent = path.dirname(expectedRoot);
  const root = path.join(parent, parsed.rootName);
  if (
    path.dirname(root) !== parent ||
    fs.realpathSync(root) !== root ||
    fs.lstatSync(root).isSymbolicLink()
  )
    throw new Error("docker_recovery_boundary_failed");
  const management = path.join(root, "management");
  const marker = path.join(management, RECOVERY_FILE);
  const markerMetadata = fs.lstatSync(marker);
  if (!markerMetadata.isFile() || markerMetadata.isSymbolicLink())
    throw new Error("docker_recovery_record_replaced");
  const serialized = fs.readFileSync(marker, "utf8");
  if (
    createHash("sha256").update(serialized).digest("hex") !== parsed.recordHash
  )
    throw new Error("docker_recovery_record_mismatch");
  const record = normalizeDockerRecoveryRecord(JSON.parse(serialized));
  if (
    record.schema !== "crdd-coordinator-docker-recovery/v1" ||
    record.rootName !== parsed.rootName ||
    record.probeId !== parsed.probeId ||
    record.nonceHash !== createHash("sha256").update(parsed.nonce).digest("hex")
  )
    throw new Error("docker_recovery_record_mismatch");
  if (!identityMatchesRecord(root, record.rootIdentity))
    throw new Error("docker_recovery_root_replaced");
  const { children, present: presentChildren } =
    classifyDockerProbeRecoveryChildren(root, record.childIdentities);
  if (!presentChildren.includes("management"))
    throw new Error("docker_recovery_management_missing");
  return {
    parsed,
    record,
    root,
    children,
    marker,
    present: new Set(presentChildren),
  };
}

/**
 * 回復 Childrenを分類する。
 *
 * @responsibility 回復 Childrenの分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input root: string、childIdentities: Readonly<Record<string, SerializableIdentity>>
 * @returns classifyDockerProbeRecoveryChildrenの計算結果を返す。
 * @precondition 「root: string、childIdentities: Readonly<Record<string, SerializableIdentity>>」がclassifyDockerProbeRecoveryChildrenの入力契約を満たす。
 * @postcondition classifyDockerProbeRecoveryChildrenの責務を完了した結果だけを返す。
 * @effect classifyDockerProbeRecoveryChildrenはFilesystemの読取りまたは書込みを実行する。
 * @failure classifyDockerProbeRecoveryChildrenは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant classifyDockerProbeRecoveryChildrenは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security classifyDockerProbeRecoveryChildrenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyDockerProbeRecoveryChildrenは共有非同期状態を持たない同期処理である。
 */
export function classifyDockerProbeRecoveryChildren(
  root: string,
  childIdentities: Readonly<Record<string, SerializableIdentity>>,
) {
  const children = {
    workspace: path.join(root, "workspace"),
    providerHome: path.join(root, "provider-home"),
    tmp: path.join(root, "tmp"),
    events: path.join(root, "events"),
    projection: path.join(root, "projection"),
    management: path.join(root, "management"),
  };
  const byRecordName = {
    workspace: children.workspace,
    "provider-home": children.providerHome,
    tmp: children.tmp,
    events: children.events,
    projection: children.projection,
    management: children.management,
  };
  const knownNames = new Set(Object.keys(byRecordName));
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!knownNames.has(entry.name))
      throw new Error("docker_recovery_unknown_child");
  }
  const present = new Set<string>();
  for (const [name, target] of Object.entries(byRecordName)) {
    try {
      const metadata = fs.lstatSync(target);
      const recordedIdentity = childIdentities[name];
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.realpathSync(target) !== target ||
        path.dirname(target) !== root ||
        !recordedIdentity ||
        !identityMatchesRecord(target, recordedIdentity)
      )
        throw new Error("docker_recovery_child_replaced");
      present.add(name);
    } catch (error) {
      if (errorCode(error) === "ENOENT") continue;
      throw error;
    }
  }
  return { children, present: [...present].sort() };
}

/**
 * recovery Mountsを決定する。
 *
 * @responsibility recovery Mountsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input recovery: LoadedDockerRecovery
 * @returns DockerMountsを返す。
 * @precondition 「recovery: LoadedDockerRecovery」がrequireDockerProbeRecoveryMountsの入力契約を満たす。
 * @postcondition requireDockerProbeRecoveryMountsの責務を完了した結果だけを返す。
 * @effect N/A: requireDockerProbeRecoveryMountsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requireDockerProbeRecoveryMountsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requireDockerProbeRecoveryMountsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requireDockerProbeRecoveryMountsはProcess内の同一Subsystemで完結する。
 * @security requireDockerProbeRecoveryMountsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: requireDockerProbeRecoveryMountsは共有非同期状態を持たない同期処理である。
 */
export function requireDockerProbeRecoveryMounts(
  recovery: LoadedDockerRecovery,
): DockerMounts {
  for (const name of ["workspace", "provider-home", "tmp", "management"]) {
    if (!recovery.present.has(name))
      throw new Error("docker_recovery_mount_missing");
  }
  return recovery.children;
}
