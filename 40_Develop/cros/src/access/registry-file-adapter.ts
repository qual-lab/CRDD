/**
 * CROS Credential RegistryをOS管理Runtime Rootへ不変Snapshotとして保存する。
 *
 * @packageDocumentation
 * @responsibility 検証済みCROS Runtime RootのCredential Registryを観測し、revision競合なしで排他的公開する。
 * @trace ARCH-000013
 * @boundary Runtime Data Root Resolver、FilesystemおよびCredential Registry Portの境界。
 * @effect CROS state Root内のcredential-registry Directoryと不変Snapshot fileを作成する。
 * @security 生Secretを受理せず、Credential RecordのVerifierだけを保存する。
 */

import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  resolveCrosRuntimeRoots,
  type CrosRootInput,
} from "../../../domain-model/src/index.ts";

import type {
  ConnectionCredentialRecord,
  ConnectionCredentialRegistry,
  ConnectionCredentialRegistrySnapshot,
} from "./credential.ts";

const SNAPSHOT_PATTERN = /^registry-(\d{10})\.json$/u;

/**
 * File Credential Registry Adapterの生成結果を定義する。
 *
 * @responsibility Runtime Root解決失敗と利用可能Adapterを区別する。
 * @trace ARCH-000013
 * @shape readyとblockedの判別Union。
 * @invariant readyだけがRegistryを持つ。
 * @boundary CROS構成RootとCredential Applicationの境界。
 * @security Host絶対Pathを公開結果へ含めない。
 * @compatibility blocked reasonは安定した機械値として扱う。
 */
export type CredentialRegistryFileAdapterResult = Readonly<
  | {
      status: "ready";
      reason: "credential_registry_file_adapter_ready";
      registry: ConnectionCredentialRegistry;
    }
  | {
      status: "blocked";
      reason: "credential_registry_runtime_root_invalid";
      registry: null;
    }
>;

/**
 * OS管理CROS Runtime RootへCredential Registry Adapterを構成する。
 *
 * @responsibility 任意Path入力を受けず、共通Resolverが確定したTrust Domain RootだけをRegistryへ渡す。
 * @trace ARCH-000013
 * @input Runtime Data契約のCrosRootInput。
 * @returns readyなRegistry PortまたはEffect 0のblocked結果。
 * @precondition Publisher、Application、Trust DomainおよびOS Rootを明示する。
 * @postcondition ready時もRegistry Directoryは最初のinspect／publishまで作成しない。
 * @effect 構成時はFilesystem Effectを発行しない。
 * @failure Root不正をPath非開示のblockedへ変換する。
 * @invariant Repository-local .crddまたはcaller指定の任意Pathを使用しない。
 * @boundary Runtime Data Resolver→CROS Credential Registry Adapter。
 * @security 解決したRootを公開結果へ返さない。
 * @concurrency 各publishは次revision fileの排他的linkで競合を決める。
 */
export function createCredentialRegistryFileAdapter(
  input: CrosRootInput,
): CredentialRegistryFileAdapterResult {
  const roots = resolveCrosRuntimeRoots(input);
  if (!roots)
    return Object.freeze({
      status: "blocked",
      reason: "credential_registry_runtime_root_invalid",
      registry: null,
    });
  const directory = path.join(roots.state, "credential-registry");
  return Object.freeze({
    status: "ready",
    reason: "credential_registry_file_adapter_ready",
    registry: createFileRegistry(directory),
  });
}

/**
 * 解決済みCredential Registry DirectoryへFile Adapterを構成する。
 *
 * @responsibility inspectとimmutable publishをConnectionCredentialRegistry契約へ実装する。
 * @trace ARCH-000013
 * @input Runtime Data Resolverから得たCredential Registry Directory。
 * @returns File-backed ConnectionCredentialRegistry。
 * @precondition directoryはCROS state Root直下から導出済みである。
 * @postcondition inspectは最新の完全Snapshotだけを返す。
 * @effect publish時だけDirectoryとSnapshot fileを作成する。
 * @failure 読取り不能・破損は例外、競合publishはfalseで返す。
 * @invariant 既存Snapshotを上書き・削除しない。
 * @boundary Credential Registry PortとFilesystemの内部境界。
 * @security Record以外の値と生Secretを書かない。
 * @concurrency 次revisionの排他的linkに成功したWriterだけを完了とする。
 */
function createFileRegistry(directory: string): ConnectionCredentialRegistry {
  return Object.freeze({
    inspect: () => inspectFileRegistry(directory),
    publish: (expectedRevision, records) =>
      publishFileRegistry(directory, expectedRevision, records),
  });
}

/**
 * File Registryの最新完全Snapshotを観測する。
 *
 * @responsibility 不変Snapshot列から最大revisionを一意に選びSchemaを検証する。
 * @trace ARCH-000013
 * @input 解決済みCredential Registry Directory。
 * @returns 空または最新のRegistry Snapshot。
 * @precondition directoryはCROS state Root直下から導出済みである。
 * @postcondition Filesystemを変更しない。
 * @effect N/A: Directoryとfileを読取るだけである。
 * @failure 破損、重複Identity、不連続revisionまたは不正Schemaは例外で停止する。
 * @invariant 観測不能を空Registryへ畳まない。
 * @boundary File Registry内部の観測境界。
 * @security file内容を例外messageへ含めない。
 * @concurrency 完全公開済みfileだけを列挙し、staging fileを無視する。
 */
function inspectFileRegistry(
  directory: string,
): ConnectionCredentialRegistrySnapshot {
  if (!existsSync(directory))
    return Object.freeze({ revision: 0, records: [] });
  const revisions = readdirSync(directory)
    .map((name) => ({ name, match: SNAPSHOT_PATTERN.exec(name) }))
    .filter(
      (entry): entry is { name: string; match: RegExpExecArray } =>
        entry.match !== null,
    )
    .map((entry) => ({ name: entry.name, revision: Number(entry.match[1]) }))
    .sort((left, right) => left.revision - right.revision);
  if (revisions.length === 0)
    return Object.freeze({ revision: 0, records: [] });
  revisions.forEach((entry, index) => {
    if (entry.revision !== index + 1)
      throw new Error("connection_credential_registry_revision_invalid");
  });
  const latest = revisions.at(-1);
  if (!latest)
    throw new Error("connection_credential_registry_revision_invalid");
  return parseSnapshot(
    readFileSync(path.join(directory, latest.name), "utf8"),
    latest.revision,
  );
}

/**
 * 次Credential Registry Snapshotを排他的に公開する。
 *
 * @responsibility 完全にflushしたstaging fileを次revision名へhard linkし、競合時はEffect 0で終了する。
 * @trace ARCH-000013
 * @input directory、expectedRevisionおよび次Record集合。
 * @returns 不変Snapshotを公開した場合だけtrue。
 * @precondition recordsは生Secretを含まないConnectionCredentialRecordである。
 * @postcondition 成功時はexpectedRevision+1のSnapshotがread-back可能である。
 * @effect CROS state Root内にDirectory、stagingおよびSnapshotを作成し、stagingを清掃する。
 * @failure revision競合はfalse、観測不能・清掃不能・書込み失敗は例外で停止する。
 * @invariant 既存Snapshotを置換または削除しない。
 * @boundary File Registry内部のpublish境界。
 * @security JSONへRecord以外のRuntime値を含めない。
 * @concurrency 同じ次revision名への排他的linkをlinearization pointとする。
 */
function publishFileRegistry(
  directory: string,
  expectedRevision: number,
  records: readonly ConnectionCredentialRecord[],
): boolean {
  const current = inspectFileRegistry(directory);
  if (current.revision !== expectedRevision) return false;
  validateRecords(records);
  mkdirSync(directory, { recursive: true });
  const nextRevision = expectedRevision + 1;
  const name = `registry-${String(nextRevision).padStart(10, "0")}.json`;
  const target = path.join(directory, name);
  const staging = path.join(
    directory,
    `.registry-${String(nextRevision).padStart(10, "0")}-${process.pid}-${Date.now()}.tmp`,
  );
  const payload = `${JSON.stringify({ revision: nextRevision, records })}\n`;
  const handle = openSync(staging, "wx", 0o600);
  try {
    writeFileSync(handle, payload, "utf8");
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }
  try {
    linkSync(staging, target);
  } catch (error) {
    unlinkSync(staging);
    if (isAlreadyExists(error)) return false;
    throw error;
  }
  try {
    const published = readFileSync(target, "utf8");
    if (published !== payload)
      throw new Error("connection_credential_registry_publish_unconfirmed");
  } finally {
    unlinkSync(staging);
  }
  return true;
}

/**
 * Credential Registry Snapshot JSONを検証済み値へ変換する。
 *
 * @responsibility JSON構文、revisionおよび全Recordの閉じたSchemaを検証する。
 * @trace ARCH-000013
 * @input JSON textとFilenameから得たexpectedRevision。
 * @returns freezeしたConnectionCredentialRegistrySnapshot。
 * @precondition textは一つのSnapshot file全体である。
 * @postcondition 不明fieldまたは不正値を受理しない。
 * @effect N/A: 入力文字列を解析するだけである。
 * @failure 不正JSONまたはSchemaを例外で拒否する。
 * @invariant Filename revisionと本文revisionが一致する。
 * @boundary File bytesとCredential Registry型の境界。
 * @security 入力本文を例外へ含めない。
 * @concurrency N/A: 一つの不変fileだけを読む。
 */
function parseSnapshot(
  text: string,
  expectedRevision: number,
): ConnectionCredentialRegistrySnapshot {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("connection_credential_registry_json_invalid");
  }
  if (!isPlainRecord(value) || value.revision !== expectedRevision)
    throw new Error("connection_credential_registry_schema_invalid");
  if (!Array.isArray(value.records))
    throw new Error("connection_credential_registry_schema_invalid");
  const records = value.records.map(parseRecord);
  validateRecords(records);
  return Object.freeze({
    revision: expectedRevision,
    records: Object.freeze(records),
  });
}

/**
 * 一つの未知値をCredential Recordへ検証する。
 *
 * @responsibility Recordの必須field、型、Profile、Token versionおよび配列値を検証する。
 * @trace ARCH-000013
 * @input JSON由来のunknown値。
 * @returns freezeしたConnectionCredentialRecord。
 * @precondition 値を信頼しない。
 * @postcondition 閉じたfield集合だけを返す。
 * @effect N/A: 値を検証するだけである。
 * @failure 不正Schemaを例外で拒否する。
 * @invariant 生Token fieldを受理しない。
 * @boundary JSON RecordとCredential Domain型の境界。
 * @security tokenSaltとtokenVerifier以外の秘密関連fieldを受理しない。
 * @concurrency N/A: 共有状態を持たない。
 */
function parseRecord(value: unknown): ConnectionCredentialRecord {
  if (!isPlainRecord(value))
    throw new Error("connection_credential_registry_schema_invalid");
  const keys = Object.keys(value).sort();
  const expectedKeys = [
    "credentialId",
    "profile",
    "revision",
    "revoked",
    "systemAdmin",
    "tokenSalt",
    "tokenVerifier",
    "tokenVersion",
    "workspaceIds",
  ].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys))
    throw new Error("connection_credential_registry_schema_invalid");
  if (
    typeof value.credentialId !== "string" ||
    !isProfile(value.profile) ||
    !Array.isArray(value.workspaceIds) ||
    !value.workspaceIds.every((item) => typeof item === "string") ||
    typeof value.systemAdmin !== "boolean" ||
    typeof value.revoked !== "boolean" ||
    value.tokenVersion !== 1 ||
    typeof value.tokenSalt !== "string" ||
    typeof value.tokenVerifier !== "string" ||
    typeof value.revision !== "number" ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1
  )
    throw new Error("connection_credential_registry_schema_invalid");
  return Object.freeze({
    credentialId: value.credentialId,
    profile: value.profile,
    workspaceIds: Object.freeze([...value.workspaceIds]),
    systemAdmin: value.systemAdmin,
    revoked: value.revoked,
    tokenVersion: 1,
    tokenSalt: value.tokenSalt,
    tokenVerifier: value.tokenVerifier,
    revision: value.revision,
  });
}

/**
 * Credential Record集合の横断不変条件を検証する。
 *
 * @responsibility Credential ID一意性、Workspace一意性および秘密field非存在を確認する。
 * @trace ARCH-000013
 * @input 保存候補Record集合。
 * @returns N/A: 成功時は戻り値を使用しない。
 * @precondition RecordはConnectionCredentialRecord型として渡される。
 * @postcondition 不変条件違反時はpublish前に停止する。
 * @effect N/A: 候補値を検証するだけである。
 * @failure 重複Identity、空Workspaceまたは重複Workspaceを例外で拒否する。
 * @invariant Record集合へ生Tokenを追加しない。
 * @boundary Credential Domain型と永続化Schemaの境界。
 * @security tokenという追加fieldを持つ値を拒否する。
 * @concurrency N/A: 一つの候補Snapshotだけを検証する。
 */
function validateRecords(records: readonly ConnectionCredentialRecord[]): void {
  if (
    new Set(records.map((record) => record.credentialId)).size !==
    records.length
  )
    throw new Error("connection_credential_registry_duplicate_id");
  for (const record of records) {
    if (
      Object.hasOwn(record, "token") ||
      record.credentialId.length === 0 ||
      record.workspaceIds.some((workspaceId) => workspaceId.length === 0) ||
      new Set(record.workspaceIds).size !== record.workspaceIds.length
    )
      throw new Error("connection_credential_registry_record_invalid");
  }
}

/**
 * unknown値が通常のObject Recordか判定する。
 *
 * @responsibility JSON由来値からprototypeを持たない通常Objectだけを後続検証へ渡す。
 * @trace ARCH-000013
 * @input unknown値。
 * @returns 通常Object Recordの場合だけtrue。
 * @precondition 入力を信頼しない。
 * @postcondition Arrayとnullを除外する。
 * @effect N/A: 型判定だけを行う。
 * @failure N/A: 不正値はfalseで返す。
 * @invariant prototype chainの意味を認証判断へ使用しない。
 * @boundary JSON ParserとSchema検証の内部境界。
 * @security Getter等を持つ非JSON ObjectはJSON.parse経路では生成されない。
 * @concurrency N/A: 共有状態を持たない。
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * unknown値が固定Credential Profileか判定する。
 *
 * @responsibility 永続値を閉じたProfile集合へ限定する。
 * @trace ARCH-000013
 * @input unknown値。
 * @returns 三Profileのいずれかならtrue。
 * @precondition 入力を信頼しない。
 * @postcondition 権限判断を行わず型だけを絞る。
 * @effect N/A: 値比較だけを行う。
 * @failure N/A: 未知値はfalseで返す。
 * @invariant Profileを権限階層へ変換しない。
 * @boundary JSON Schema検証の内部境界。
 * @security N/A: 公開Profile名だけを扱う。
 * @concurrency N/A: 共有状態を持たない。
 */
function isProfile(
  value: unknown,
): value is ConnectionCredentialRecord["profile"] {
  return (
    value === "administrator" || value === "management" || value === "developer"
  );
}

/**
 * Filesystem errorが排他的公開の既存対象競合か判定する。
 *
 * @responsibility EEXISTだけを正常なrevision競合へ変換する。
 * @trace ARCH-000013
 * @input catchしたunknown error。
 * @returns code=EEXISTの場合だけtrue。
 * @precondition errorを信頼しない。
 * @postcondition 他のFilesystem失敗を隠さない。
 * @effect N/A: error Propertyを読むだけである。
 * @failure N/A: 不明値はfalseで返す。
 * @invariant Access deniedやI/O失敗を競合へ畳まない。
 * @boundary Node Filesystem errorとRegistry公開結果の境界。
 * @security error messageやPathを公開結果へ搬送しない。
 * @concurrency EEXISTを同revision Writerとの競合として扱う。
 */
function isAlreadyExists(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EEXIST"
  );
}
