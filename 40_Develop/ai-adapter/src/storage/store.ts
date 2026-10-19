/**
 * AI Profile CatalogのOwner別耐久保存Store。
 *
 * @packageDocumentation
 * @responsibility Repository単体設定とCROS設定を別Rootへ不変Snapshotとして保存し、同じCatalog Schemaで観測する。
 * @trace ARCH-000010
 * @trace ARCH-000011
 * @boundary Runtime Data Root Resolver、FilesystemおよびAI Profile Catalog Store Portの境界。
 * @effect 採用時だけ検証済みRoot内へ不変Snapshot fileを公開する。
 * @security 秘密値、任意実行Pathおよび任意CLI引数をSchema検証で拒否し、Pathを公開結果へ含めない。
 */
import type { AiProfileCatalog } from "../catalog/types.ts";
import {
  closeSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  resolveCrosRuntimeRoots,
  resolveRepositoryRuntimeDataPathsFromWorkingDirectory,
  type CrosRootInput,
} from "../../../domain-model/src/index.ts";
import { defaultAiProfileCatalog } from "../catalog/resolve.ts";
import { validateAiProfileCatalog } from "../catalog/validation.ts";

const SNAPSHOT_PATTERN = /^catalog-(\d{10})\.json$/u;

/**
 * Repository-local設定RootへAI Profile Catalog Storeを構成する。
 *
 * @responsibility 検証済みRepository Rootから固定config領域だけを選びStoreへ渡す。
 * @trace ARCH-000010
 * @trace ARCH-000011
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
): AiProfileCatalogStoreResult {
  const paths =
    resolveRepositoryRuntimeDataPathsFromWorkingDirectory(workingDirectory);
  if (!paths) return blockedStore();
  return readyStore(path.join(paths.config, "ai-profile-catalog"));
}

/**
 * OS管理CROS設定RootへAI Profile Catalog Storeを構成する。
 *
 * @responsibility CROS Trust Domainごとの設定OwnerをRepository単体設定から物理分離する。
 * @trace ARCH-000010
 * @trace ARCH-000011
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
export function createHostAiProfileCatalogStore(
  input: CrosRootInput,
): AiProfileCatalogStoreResult {
  const roots = resolveCrosRuntimeRoots(input);
  if (!roots) return blockedStore();
  const directory = path.join(roots.config, "ai-profile-catalog");
  try {
    verifyHostCatalogDirectory(directory, false);
    return readyStore(directory, true);
  } catch {
    return blockedStore();
  }
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
function readyStore(
  directory: string,
  isHostStore = false,
): AiProfileCatalogStoreResult {
  return Object.freeze({
    status: "ready" as const,
    reason: "ai_profile_catalog_store_ready" as const,
    store: createFileStore(directory, isHostStore),
  });
}

/**
 * Root不正をEffect 0のStore構成結果へ変換する。
 *
 * @responsibility 不正Rootと正常な空Catalogを区別する。
 * @trace ARCH-000010
 * @input N/A: 固定blocked結果を生成する。
 * @returns Path非開示のblocked結果。
 * @precondition N/A: 実行時入力を持たない。
 * @postcondition Storeを公開しない。
 * @effect N/A: Filesystemへ触れない。
 * @failure N/A: 固定結果を返す。
 * @invariant 不正Rootを既定Catalogへ畳まない。
 * @boundary Root検証失敗と設定利用側の境界。
 * @security 入力Pathを返さない。
 * @concurrency N/A: 共有状態を持たない。
 */
function blockedStore(): AiProfileCatalogStoreResult {
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
 * @postcondition adoptedは次Revisionの確認済み保存を示し、unknownでは公開済みの可能性が残る。
 * @effect 検証済み候補のadopt試行でSnapshot fileを作成し得る。unknownでも未保存とは限らない。
 * @failure 読取り不成立はblocked、採用処理の故障は段階付きunknownで返す。
 * @invariant 既存Snapshotを上書き・削除しない。
 * @boundary Catalog DomainとFilesystem Snapshotの境界。
 * @security 検証済みCatalog以外を書き込まない。
 * @concurrency 排他的hard linkをLinearization Pointにする。
 */
function createFileStore(
  directory: string,
  isHostStore = false,
): AiProfileCatalogStore {
  return Object.freeze({
    snapshot: () => {
      try {
        if (isHostStore) verifyHostCatalogDirectory(directory, false);
        return Object.freeze({
          status: "read",
          value: inspectSnapshot(directory),
          error: null,
        });
      } catch (error) {
        return Object.freeze({
          status: "blocked",
          value: null,
          error:
            error instanceof Error &&
            [
              "ai_profile_catalog_snapshot_invalid",
              "ai_profile_catalog_snapshot_revision_invalid",
            ].includes(error.message)
              ? "ai_profile_catalog_invalid"
              : "ai_profile_catalog_read_failed",
        });
      }
    },
    adopt: (request) => adoptSnapshot(directory, request, isHostStore),
  });
}

/**
 * CROS Catalogの固定保存候補と既存親chainを直接検証する。
 * @responsibility Linkや観測不能を空Storeへ変換せず、不足Directoryだけを逐次準備する。
 * @trace ARCH-000010
 * @trace ARCH-000011
 * @input CROS Resolverから導出したCatalog Directoryと作成要否。
 * @returns N/A: 検証成功時だけ復帰する。
 * @precondition 固定CROS config用途の絶対Pathである。
 * @postcondition 既存全親は通常Directoryで実Path一致、作成時は親Identityを再確認する。
 * @effect 読取り検証。shouldCreate時だけ不足suffixを一段ずつ非再帰mkdirする。
 * @failure Link・非Directory・観測不能・親置換は固定例外で停止する。
 * @invariant ENOENT以外を不存在へ変換せず、状態Rootや既存Snapshotを変更しない。
 * @boundary CROS config保存OwnerとFilesystem実体。
 * @security Repositoryや任意入力Rootを検証APIとして公開しない。
 * @concurrency 各Store操作と書込み段階で再検証し、恒久的な置換耐性は主張しない。
 */
function verifyHostCatalogDirectory(
  directory: string,
  shouldCreate: boolean,
): void {
  const missingDirectories: string[] = [];
  let ancestor = directory;
  for (;;) {
    try {
      lstatSync(ancestor);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new Error("ai_profile_catalog_root_unavailable");
      missingDirectories.push(ancestor);
      const parent = path.dirname(ancestor);
      if (parent === ancestor)
        throw new Error("ai_profile_catalog_root_invalid");
      ancestor = parent;
    }
  }
  let cursor = ancestor;
  for (;;) {
    const metadata = lstatSync(cursor);
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      realpathSync.native(cursor) !== cursor
    )
      throw new Error("ai_profile_catalog_root_invalid");
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  if (!shouldCreate) return;
  for (const next of missingDirectories.reverse()) {
    verifyHostCatalogDirectory(ancestor, false);
    const before = lstatSync(ancestor, { bigint: true });
    try {
      mkdirSync(next);
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
    }
    verifyHostCatalogDirectory(next, false);
    const after = lstatSync(ancestor, { bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino)
      throw new Error("ai_profile_catalog_root_changed");
    ancestor = next;
  }
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
  try {
    lstatSync(directory);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return Object.freeze({
        revision: 0,
        catalog: defaultAiProfileCatalog,
      });
    throw error;
  }
  const snapshots = readdirSync(directory)
    .map((name) => ({ name, match: SNAPSHOT_PATTERN.exec(name) }))
    .filter(
      (entry): entry is { name: string; match: RegExpExecArray } =>
        entry.match !== null,
    )
    .map((entry) => ({ name: entry.name, revision: Number(entry.match[1]) }))
    .sort((left, right) => left.revision - right.revision);
  if (snapshots.length === 0)
    return Object.freeze({ revision: 0, catalog: defaultAiProfileCatalog });
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
 * @returns adopted、理由付きrejected又は段階付きunknown結果。
 * @precondition requestのCandidateとRevisionを未信頼入力として扱う。
 * @postcondition adopted時はread-back可能な次Snapshotが存在する。
 * @effect 成功候補に限りDirectory、staging file、Snapshot fileを作成する。
 * @failure Candidate不正・競合はrejected、観測不能・清掃不能・書込み失敗は段階付きunknownで返す。
 * @invariant Candidateを公開してから検証しない。
 * @boundary Catalog採用ApplicationとFilesystem公開の境界。
 * @security Catalog Schema外の秘密値や任意実行情報を保存しない。
 * @concurrency 同じ次Revision名の排他的linkに成功したWriterだけがadoptedを返す。
 */
function adoptSnapshot(
  directory: string,
  request: AiProfileCatalogAdoptionRequest,
  isHostStore = false,
): AiProfileCatalogAdoptionResult {
  let phase: "read" | "prepare" | "write" | "publish" | "verify" | "cleanup" =
    "read";
  try {
    if (isHostStore) verifyHostCatalogDirectory(directory, false);
    const current = inspectSnapshot(directory);
    if (request.expectedRevision !== current.revision)
      return rejected("revision_conflict", current);
    const catalog = validateAiProfileCatalog(request.candidate).value;
    if (!catalog) return rejected("catalog_invalid", current);
    phase = "prepare";
    if (isHostStore) verifyHostCatalogDirectory(directory, true);
    else mkdirSync(directory, { recursive: true });
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
    phase = "write";
    const handle = openSync(staging, "wx", 0o600);
    try {
      if (isHostStore) verifyHostCatalogDirectory(directory, false);
      writeFileSync(handle, payload, "utf8");
      fsyncSync(handle);
    } finally {
      closeSync(handle);
    }
    phase = "publish";
    try {
      if (isHostStore) verifyHostCatalogDirectory(directory, false);
      linkSync(staging, target);
    } catch (error) {
      phase = "cleanup";
      unlinkSync(staging);
      phase = "publish";
      if (isAlreadyExists(error))
        return rejected("revision_conflict", inspectSnapshot(directory));
      throw error;
    }
    phase = "verify";
    try {
      if (readFileSync(target, "utf8") !== payload)
        throw new Error("ai_profile_catalog_snapshot_publish_unconfirmed");
    } finally {
      const previousPhase = phase;
      phase = "cleanup";
      unlinkSync(staging);
      phase = previousPhase;
    }
    const snapshot = Object.freeze({ revision, catalog });
    return Object.freeze({ status: "adopted" as const, revision, snapshot });
  } catch {
    return Object.freeze({
      status: "unknown",
      reason: "ai_profile_catalog_save_unconfirmed",
      phase,
      revision: null,
      snapshot: null,
    });
  }
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
  ).value;
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

/**
 * Catalogとその保存改訂番号の組を表す。
 * @responsibility Catalogとその保存改訂番号の組を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary storage/store.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type AiProfileCatalogSnapshot = Readonly<{
  revision: number;
  catalog: AiProfileCatalog;
}>;

/**
 * 期待改訂と採用候補を渡す保存要求を表す。
 * @responsibility 期待改訂と採用候補を渡す保存要求を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary storage/store.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type AiProfileCatalogAdoptionRequest = Readonly<{
  expectedRevision: number;
  candidate: unknown;
}>;

/**
 * 保存採用または不正・改訂競合の拒否結果を表す。
 * @responsibility 保存採用または不正・改訂競合の拒否結果を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary storage/store.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type AiProfileCatalogAdoptionResult =
  | Readonly<{
      status: "unknown";
      reason: "ai_profile_catalog_save_unconfirmed";
      phase: "read" | "prepare" | "write" | "publish" | "verify" | "cleanup";
      revision: null;
      snapshot: null;
    }>
  | Readonly<{
      status: "adopted";
      revision: number;
      snapshot: AiProfileCatalogSnapshot;
    }>
  | Readonly<{
      status: "rejected";
      reason: "catalog_invalid" | "revision_conflict";
      revision: number;
      snapshot: AiProfileCatalogSnapshot;
    }>;

/**
 * Snapshotの取得と明示的な採用操作の契約を表す。
 * @responsibility Snapshotの取得と明示的な採用操作の契約を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary storage/store.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type AiProfileCatalogStore = Readonly<{
  snapshot: () => AiProfileCatalogReadResult;
  adopt: (
    request: AiProfileCatalogAdoptionRequest,
  ) => AiProfileCatalogAdoptionResult;
}>;

/**
 * Owner保存先の構成成功またはRoot不正の停止結果を表す。
 * @responsibility Owner保存先の構成成功またはRoot不正の停止結果を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary storage/store.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type AiProfileCatalogStoreResult = Readonly<
  | {
      status: "ready";
      reason: "ai_profile_catalog_store_ready";
      store: AiProfileCatalogStore;
    }
  | {
      status: "blocked";
      reason: "ai_profile_catalog_storage_root_invalid";
      store: null;
    }
>;
/**
 * 読取り成功と観測不能を区別し、失敗時に既定値へ縮退しない。
 * @responsibility 成功値と固定拒否理由又は観測不能を型で区別する。
 * @trace ARCH-000010
 * @shape 状態で値と欠測を絞り込める読取り専用の直和型。
 * @invariant 型だけで認証、実行、保存又は回収の成立を主張しない。
 * @boundary AI Profile APIと直接利用側の値契約。
 * @security 秘密値、内部Path及び操作Authorityを含めない。
 * @compatibility 通信Envelopeと保存Schemaを変更せず、内部戻り値だけを移行する。
 */
export type AiProfileCatalogReadResult = Readonly<
  | { status: "read"; value: AiProfileCatalogSnapshot; error: null }
  | {
      status: "blocked";
      value: null;
      error: "ai_profile_catalog_read_failed" | "ai_profile_catalog_invalid";
    }
>;
