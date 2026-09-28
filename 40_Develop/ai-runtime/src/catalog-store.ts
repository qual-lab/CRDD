/**
 * AI Profile CatalogのOwner別耐久保存Adapter。
 *
 * @packageDocumentation
 * @responsibility Repository単体設定とCROS設定を別Rootへ不変Snapshotとして保存し、同じCatalog Schemaで観測する。
 * @trace ARCH-000010 ARCH-000011
 * @boundary Runtime Data Root Resolver、FilesystemおよびAI Profile Catalog Store Portの境界。
 * @effect 採用時だけ検証済みRoot内へ不変Snapshot fileを公開する。
 * @security 秘密値、任意実行Pathおよび任意CLI引数をSchema検証で拒否し、Pathを公開結果へ含めない。
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
  resolveRepositoryRuntimeDataPathsFromWorkingDirectory,
  type CrosRootInput,
} from "../../runtime-data/src/index.ts";
import {
  DEFAULT_AI_PROFILE_CATALOG,
  validateAiProfileCatalog,
} from "./catalog.ts";
import type {
  AiProfileCatalogAdoptionRequest,
  AiProfileCatalogAdoptionResult,
  AiProfileCatalogSnapshot,
  AiProfileCatalogStore,
  AiProfileCatalogStoreAdapterResult,
} from "./ai-profile-types.ts";

const SNAPSHOT_PATTERN = /^catalog-(\d{10})\.json$/u;

/**
 * Repository-local設定RootへAI Profile Catalog Storeを構成する。
 *
 * @responsibility 検証済みRepository Rootから固定config領域だけを選びStoreへ渡す。
 * @trace ARCH-000010 ARCH-000011
 * @input workingDirectory: Repository内の開始Directory。
 * @returns readyなStoreまたはEffect 0のblocked結果。
 * @precondition workingDirectoryを検証済みRootと仮定しない。
 * @postcondition ready時も最初の採用までDirectoryを作成しない。
 * @effect N/A: 構成時はFilesystemへ書き込まない。
 * @failure Rootを一意に検証できない場合はblockedを返す。
 * @invariant Repository直下の`.crdd/config/ai-profile-catalog`以外を選ばない。
 * @boundary Repository Root ResolverからAI Profile Catalog Storeへの境界。
 * @security 解決したHost Pathを返却結果へ含めない。
 * @concurrency 採用時は次Revision名への排他的linkで競合を決める。
 */
export function createRepositoryAiProfileCatalogStore(
  workingDirectory: unknown,
): AiProfileCatalogStoreAdapterResult {
  const paths =
    resolveRepositoryRuntimeDataPathsFromWorkingDirectory(workingDirectory);
  if (!paths) return blockedStore();
  return readyStore(path.join(paths.config, "ai-profile-catalog"));
}

/**
 * OS管理CROS設定RootへAI Profile Catalog Storeを構成する。
 *
 * @responsibility CROS Trust Domainごとの設定OwnerをRepository単体設定から物理分離する。
 * @trace ARCH-000010 ARCH-000011
 * @input input: 検証対象のCROS Runtime Root入力。
 * @returns readyなStoreまたはEffect 0のblocked結果。
 * @precondition inputのPath、PublisherおよびTrust Domainを信頼済みと仮定しない。
 * @postcondition ready時も最初の採用までDirectoryを作成しない。
 * @effect N/A: 構成時はFilesystemへ書き込まない。
 * @failure Rootを一意に検証できない場合はblockedを返す。
 * @invariant CROS config RootとRepository-local `.crdd`を混在させない。
 * @boundary CROS Runtime Root ResolverからAI Profile Catalog Storeへの境界。
 * @security 解決したOS Pathを返却結果へ含めない。
 * @concurrency 採用時は次Revision名への排他的linkで競合を決める。
 */
export function createCrosAiProfileCatalogStore(
  input: CrosRootInput,
): AiProfileCatalogStoreAdapterResult {
  const roots = resolveCrosRuntimeRoots(input);
  if (!roots) return blockedStore();
  return readyStore(path.join(roots.config, "ai-profile-catalog"));
}

/**
 * 解決済みDirectoryへFile Storeを構成する。
 *
 * @responsibility Snapshot観測と改訂競合付き採用を一つのStore Portへ閉じる。
 * @trace ARCH-000010
 * @input directory: 検証済みOwner Root配下の固定Directory。
 * @returns readyなAI Profile Catalog Store Adapter結果。
 * @precondition directoryはRepositoryまたはCROS Resolverから導出済みである。
 * @postcondition Store操作以外からPathを取得できない。
 * @effect N/A: Store構成だけではFilesystemを書き換えない。
 * @failure N/A: 実観測・採用失敗は各操作で処理する。
 * @invariant Repository OwnerとCROS Ownerは同じStore Instanceを共有しない。
 * @boundary 解決済みDirectoryとStore Portの内部境界。
 * @security Pathを公開値へ含めない。
 * @concurrency Store採用はFilesystemの排他的公開で競合を処理する。
 */
function readyStore(directory: string): AiProfileCatalogStoreAdapterResult {
  return Object.freeze({
    status: "ready" as const,
    reason: "ai_profile_catalog_store_ready" as const,
    store: createFileStore(directory),
  });
}

/**
 * Root不正をEffect 0のStore構成結果へ変換する。
 *
 * @responsibility 不正Rootと正常な空Catalogを区別する。
 * @trace ARCH-000010
 * @input N/A: 固定blocked結果を生成する。
 * @returns Path非開示のblocked結果。
 * @precondition Root Resolverが非成立を返している。
 * @postcondition Storeを公開しない。
 * @effect N/A: Filesystemへ触れない。
 * @failure N/A: 固定結果を返す。
 * @invariant 不正Rootを既定Catalogへ畳まない。
 * @boundary Root検証失敗と設定利用側の境界。
 * @security 入力Pathを返さない。
 * @concurrency N/A: 共有状態を持たない。
 */
function blockedStore(): AiProfileCatalogStoreAdapterResult {
  return Object.freeze({
    status: "blocked" as const,
    reason: "ai_profile_catalog_storage_root_invalid" as const,
    store: null,
  });
}

/**
 * 不変Snapshotを用いるFile Storeを生成する。
 *
 * @responsibility 現在Snapshotの観測、Candidate検証、Revision照合および不可分公開を所有する。
 * @trace ARCH-000010
 * @input directory: 検証済み設定Directory。
 * @returns Catalog Store Port。
 * @precondition directoryは固定Owner Root配下である。
 * @postcondition 採用成功時だけRevisionが一つ進む。
 * @effect adopt成功時だけSnapshot fileを作成する。
 * @failure 破損は例外、Candidate不正・Revision競合は拒否結果とする。
 * @invariant 既存Snapshotを上書き・削除しない。
 * @boundary Catalog DomainとFilesystem Snapshotの境界。
 * @security 検証済みCatalog以外を書き込まない。
 * @concurrency 排他的hard linkをLinearization Pointにする。
 */
function createFileStore(directory: string): AiProfileCatalogStore {
  return Object.freeze({
    snapshot: () => inspectSnapshot(directory),
    adopt: (request) => adoptSnapshot(directory, request),
  });
}

/**
 * 最新の完全なCatalog Snapshotを観測する。
 *
 * @responsibility 空Storeの既定Catalogと、連続した不変Snapshot列の最新値を区別して返す。
 * @trace ARCH-000010
 * @input directory: 検証済み設定Directory。
 * @returns Revision 0の既定Catalogまたは最新Snapshot。
 * @precondition directoryは固定Owner Root配下である。
 * @postcondition Filesystemを変更しない。
 * @effect N/A: Directoryとfileを読取るだけである。
 * @failure 破損、不連続Revision、不正Schemaを例外で停止する。
 * @invariant 観測不能を空Storeへ畳まない。
 * @boundary Filesystem SnapshotとCatalog Domainの境界。
 * @security file内容やPathを例外messageへ含めない。
 * @concurrency 完全公開済みSnapshotだけを列挙する。
 */
function inspectSnapshot(directory: string): AiProfileCatalogSnapshot {
  if (!existsSync(directory))
    return Object.freeze({ revision: 0, catalog: DEFAULT_AI_PROFILE_CATALOG });
  const snapshots = readdirSync(directory)
    .map((name) => ({ name, match: SNAPSHOT_PATTERN.exec(name) }))
    .filter(
      (entry): entry is { name: string; match: RegExpExecArray } =>
        entry.match !== null,
    )
    .map((entry) => ({ name: entry.name, revision: Number(entry.match[1]) }))
    .sort((left, right) => left.revision - right.revision);
  if (snapshots.length === 0)
    return Object.freeze({ revision: 0, catalog: DEFAULT_AI_PROFILE_CATALOG });
  snapshots.forEach((entry, index) => {
    if (entry.revision !== index + 1)
      throw new Error("ai_profile_catalog_snapshot_revision_invalid");
  });
  const latest = snapshots.at(-1);
  if (!latest) throw new Error("ai_profile_catalog_snapshot_revision_invalid");
  return parseSnapshot(
    readFileSync(path.join(directory, latest.name), "utf8"),
    latest.revision,
  );
}

/**
 * Candidateを検証し次Revisionへ排他的に採用する。
 *
 * @responsibility Candidateと現在値を分離し、検証・Revision照合・公開確認を順序固定する。
 * @trace ARCH-000010
 * @input directoryとCatalog採用要求。
 * @returns adoptedまたは理由付きrejected結果。
 * @precondition requestのCandidateとRevisionを未信頼入力として扱う。
 * @postcondition adopted時はread-back可能な次Snapshotが存在する。
 * @effect 成功候補に限りDirectory、staging file、Snapshot fileを作成する。
 * @failure Candidate不正・競合は拒否、観測不能・清掃不能・書込み失敗は例外で停止する。
 * @invariant Candidateを公開してから検証しない。
 * @boundary Catalog採用ApplicationとFilesystem公開の境界。
 * @security Catalog Schema外の秘密値や任意実行情報を保存しない。
 * @concurrency 同じ次Revision名の排他的linkに成功したWriterだけがadoptedを返す。
 */
function adoptSnapshot(
  directory: string,
  request: AiProfileCatalogAdoptionRequest,
): AiProfileCatalogAdoptionResult {
  const current = inspectSnapshot(directory);
  if (request.expectedRevision !== current.revision)
    return rejected("revision_conflict", current);
  const catalog = validateAiProfileCatalog(request.candidate);
  if (!catalog) return rejected("catalog_invalid", current);
  mkdirSync(directory, { recursive: true });
  const revision = current.revision + 1;
  const target = path.join(
    directory,
    `catalog-${String(revision).padStart(10, "0")}.json`,
  );
  const staging = path.join(
    directory,
    `.catalog-${String(revision).padStart(10, "0")}-${process.pid}-${Date.now()}.tmp`,
  );
  const payload = `${JSON.stringify({
    contract: "crdd/ai-profile-catalog-snapshot",
    contractRevision: 1,
    revision,
    catalog,
  })}\n`;
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
    if (isAlreadyExists(error))
      return rejected("revision_conflict", inspectSnapshot(directory));
    throw error;
  }
  try {
    if (readFileSync(target, "utf8") !== payload)
      throw new Error("ai_profile_catalog_snapshot_publish_unconfirmed");
  } finally {
    unlinkSync(staging);
  }
  const snapshot = Object.freeze({ revision, catalog });
  return Object.freeze({ status: "adopted" as const, revision, snapshot });
}

/**
 * Catalog Snapshot JSONを閉じたEnvelopeとして検証する。
 *
 * @responsibility Snapshot Envelope、RevisionおよびCatalog Schemaの一致を確認する。
 * @trace ARCH-000010
 * @input source: file内容、expectedRevision: file名から得たRevision。
 * @returns 検証済みCatalog Snapshot。
 * @precondition sourceを信頼済みJSONと仮定しない。
 * @postcondition 戻り値のRevisionはfile名と一致する。
 * @effect N/A: JSON解析と検証だけを行う。
 * @failure JSON、Envelope、Revision、Catalog不正を固定Errorで拒否する。
 * @invariant 未知Propertyを無視しない。
 * @boundary File bytesとCatalog Snapshotの境界。
 * @security file内容をErrorへ含めない。
 * @concurrency N/A: 読取った一つの不変fileだけを扱う。
 */
function parseSnapshot(
  source: string,
  expectedRevision: number,
): AiProfileCatalogSnapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    throw new Error("ai_profile_catalog_snapshot_invalid");
  }
  if (
    typeof raw !== "object" ||
    raw === null ||
    Array.isArray(raw) ||
    Object.keys(raw).sort().join("|") !==
      "catalog|contract|contractRevision|revision" ||
    (raw as Record<string, unknown>).contract !==
      "crdd/ai-profile-catalog-snapshot" ||
    (raw as Record<string, unknown>).contractRevision !== 1 ||
    (raw as Record<string, unknown>).revision !== expectedRevision
  )
    throw new Error("ai_profile_catalog_snapshot_invalid");
  const catalog = validateAiProfileCatalog(
    (raw as Record<string, unknown>).catalog,
  );
  if (!catalog) throw new Error("ai_profile_catalog_snapshot_invalid");
  return Object.freeze({ revision: expectedRevision, catalog });
}

/**
 * Store採用拒否結果を現在Snapshot付きで構築する。
 *
 * @responsibility Candidate不正とRevision競合を固定語彙で区別する。
 * @trace ARCH-000010
 * @input reasonと現在Snapshot。
 * @returns Effect 0のrejected結果。
 * @precondition Snapshotは直前に観測済みである。
 * @postcondition RevisionとSnapshotが一致する。
 * @effect N/A: Resultを構築するだけである。
 * @failure N/A: 固定結果を返す。
 * @invariant 拒否Candidateを結果へ含めない。
 * @boundary Store内部判定と利用側の境界。
 * @security Candidate内容とPathを公開しない。
 * @concurrency N/A: 不変Snapshotを参照する。
 */
function rejected(
  reason: "catalog_invalid" | "revision_conflict",
  snapshot: AiProfileCatalogSnapshot,
): AiProfileCatalogAdoptionResult {
  return Object.freeze({
    status: "rejected" as const,
    reason,
    revision: snapshot.revision,
    snapshot,
  });
}

/**
 * Filesystem Errorが排他的公開競合か判定する。
 *
 * @responsibility EEXISTだけをRevision競合として安全に分類する。
 * @trace ARCH-000010
 * @input error: Filesystem境界からの未信頼Error。
 * @returns codeがEEXISTの場合だけtrue。
 * @precondition errorの型を仮定しない。
 * @postcondition その他のErrorを競合へ畳まない。
 * @effect N/A: 値を検査するだけである。
 * @failure N/A: 判定不能をfalseにする。
 * @invariant message文字列へ依存しない。
 * @boundary Node Filesystem ErrorとStore失敗分類の境界。
 * @security Error内容を外部へ公開しない。
 * @concurrency N/A: 共有状態を持たない。
 */
function isAlreadyExists(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "EEXIST"
  );
}
