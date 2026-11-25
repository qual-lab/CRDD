/**
 * 現在状態・履歴の固定保存領域、単一Writerと保存途中の再入場を管理する。
 * @responsibility 実体照合、CAS、短命証拠、pending、読戻しと失敗・回復情報を同じ保存Ownerへ結合する。
 * @trace ARCH-000008
 */
import fs from "node:fs";
import path from "node:path";
import { STORAGE_CONTRACT } from "../composition/types.ts";
import { createHash } from "node:crypto";
import { types } from "node:util";
import {
  authenticationUnknownAbsenceChanged,
  hasAuthenticationUnknownAbsence,
} from "../attempt/transition.ts";
import type {
  ExecutionOperationRecord,
  RepairWritePurpose,
} from "../attempt/types.ts";
import {
  areTaskResourcesSettled,
  readOperationHost,
  isDockerRestartCheckpointSettled,
  isRepairDisposalSettled,
  parseDockerTaskRecoveryId,
  projectOperationState,
} from "../attempt/validation.ts";
import type { Decision, DecisionHistoryEvent } from "../decision/types.ts";
import {
  inspectDecisionHistoryEvent,
  projectDecisionHistory,
} from "../decision/validation.ts";
import { operationHistoryLine, taskHistoryLine } from "../history/records.ts";
import type { HistoryRow } from "../history/types.ts";
import {
  decodeHistoryRows,
  historyRow,
  prepareHistoryAppend,
} from "../history/validation.ts";
import { prepareExecutionDefinitionChange } from "../objective/transition.ts";
import type { ExecutionStateSnapshot, Snapshot } from "../composition/types.ts";
import {
  classifyRepairPublication,
  classifyResourcePublication,
  decodeStateSnapshot,
  initialStateOperationsMatch,
  prepareAuthenticationUnknownClosureSnapshot,
  prepareHistoryRetention,
  retainHistoryFromSnapshot,
  prepareRecoveryTerminalSnapshot,
  validateDecodedUnifiedTransition,
  validateDecodedStateTransition,
  prepareRecoveredHistoryPublication,
  prepareRepairHistoryLine,
  prepareRepairHistoryPublication,
  prepareRepairHistorySnapshot,
  prepareRepairHistorySummary,
  prepareStateCleanupSnapshot,
  prepareStateHostOperationSnapshot,
  prepareStateCompletionSnapshot,
  prepareStateHistoryLine,
  prepareTaskHistorySnapshot,
  type TaskHistorySnapshot,
  prepareStateHistorySnapshot,
  prepareStateRepairCompletionSnapshot,
  prepareUnifiedTaskSections,
  projectTaskSnapshot,
  validateRepairWriteCandidate,
  validateStateTransition,
  validateUnifiedTransition,
} from "../composition/transition.ts";
import { validId, encodeStateValue } from "../composition/validation.ts";
import type {
  ExecutionTerminalStorageObservation,
  SnapshotOwner,
  StorageOwner,
  StoreResult,
} from "./lock.ts";
import {
  acquireExecutionStateLock,
  acquireSnapshotPilotLock,
  acquireStorageOwner,
  acquireStorageOwnerForRepository,
  blocked,
  borrowStorageOwner,
  completed,
  executionStorageOperationIdentity,
  isLiveSnapshotOwner,
  isLiveStorageOwner,
  normalizeFileId,
  observeExecutionRecoveryRepository,
  observeOperationRepository,
  readExecutionStorageBinding,
  readHistoryRetentionDays,
  readStorageOwnerBinding,
  storageLockFailure,
} from "./lock.ts";
/** 保存先はPackage名でなく既存永続所在の契約。 */
export const REPOSITORY_AREAS = Object.freeze([
  "execution-model",
  "tmp",
  "lock",
] as const);

export const AREA_PATH_KEYS = Object.freeze({
  "execution-model": "executionModel",
  tmp: "temporary",
  lock: "locks",
} as const);

/**
 * Resolves only canonical paths. The caller remains responsible for proving
 *
 * @responsibility Repository Runtime Data Paths From Validated Rootの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input repositoryRoot: string
 * @returns resolveRepositoryExecutionDataPathsFromValidatedRootの計算結果を返す。
 * @precondition 「repositoryRoot: string」がresolveRepositoryExecutionDataPathsFromValidatedRootの入力契約を満たす。
 * @postcondition resolveRepositoryExecutionDataPathsFromValidatedRootの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryExecutionDataPathsFromValidatedRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryExecutionDataPathsFromValidatedRootは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryExecutionDataPathsFromValidatedRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryExecutionDataPathsFromValidatedRootはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveRepositoryExecutionDataPathsFromValidatedRootはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveRepositoryExecutionDataPathsFromValidatedRootは共有非同期状態を持たない同期処理である。
 */
function resolveRepositoryExecutionDataPathsFromValidatedRoot(
  repositoryRoot: string,
) {
  if (
    !path.isAbsolute(repositoryRoot) ||
    path.resolve(repositoryRoot) !== repositoryRoot
  )
    return null;
  const root = path.join(repositoryRoot, ".crdd");
  return Object.freeze({
    repositoryRoot,
    root,
    executionModel: path.join(root, "execution-model"),
    temporary: path.join(root, "tmp"),
    locks: path.join(root, "lock"),
    allowedTopLevelAreas: REPOSITORY_AREAS,
  });
}

function directoryIdentity(stat: fs.BigIntStats) {
  return `${stat.dev}:${stat.ino}:${stat.birthtimeNs}`;
}

/** 同じTask保存Lockで確定した親・保存領域と、祖先を含む正規パスを照合する。 @trace ARCH-000008 */
function assertTaskExecutionAreaCurrent(
  area: Extract<RepositoryExecutionDataAreaObservation, { status: "ready" }>,
): void {
  if (fs.realpathSync.native(area.directory) !== area.directory)
    throw new Error("task_storage_area_changed");
  const parent = fs.lstatSync(path.dirname(area.directory), { bigint: true });
  const leaf = fs.lstatSync(area.directory, { bigint: true });
  if (
    !parent.isDirectory() ||
    parent.isSymbolicLink() ||
    directoryIdentity(parent) !== area.parentIdentity ||
    !leaf.isDirectory() ||
    leaf.isSymbolicLink() ||
    directoryIdentity(leaf) !== area.leafIdentity
  )
    throw new Error("task_storage_area_changed");
}

/**
 * 呼出し元が確認したRootに対し、Filesystem上の領域だけを観測する。
 * @trace ARCH-000011
 * @precondition verifiedAreaは同じWriterの完全観測から渡し、固定ファイルの読取り前後にだけ使う。
 * @postcondition verifiedArea付きでは固定領域自身の実体を再確認する。親は読取り区間の入口が確認する。
 * @invariant 書込み・最終確定では正規パスを含む完全観測を別に行う。
 */
export function observePhysicalExecutionDataArea(
  repositoryRoot: string | null,
  area: RepositoryExecutionArea,
  verifiedArea?: Pick<
    Extract<RepositoryExecutionDataAreaObservation, { status: "ready" }>,
    "directory" | "boundaryIdentity" | "parentIdentity" | "leafIdentity"
  >,
): RepositoryExecutionDataAreaObservation {
  try {
    const paths =
      repositoryRoot === null
        ? null
        : resolveRepositoryExecutionDataPathsFromValidatedRoot(repositoryRoot);
    if (!paths || !REPOSITORY_AREAS.includes(area))
      return Object.freeze({
        status: "blocked",
        reason: "repository_runtime_data_root_capability_invalid",
        effectIssued: false,
      });
    const directory = paths[AREA_PATH_KEYS[area]];
    const identities: string[] = [];
    let parentIdentity = verifiedArea?.parentIdentity ?? "";
    let leafIdentity = "";
    const targets = verifiedArea
      ? [directory]
      : [paths.repositoryRoot, paths.root, directory];
    for (const target of targets) {
      let metadata: fs.BigIntStats;
      try {
        metadata = fs.lstatSync(target, { bigint: true });
      } catch (error) {
        if (target === paths.repositoryRoot) throw error;
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          return Object.freeze({
            status: "not_observed",
            reason: "repository_runtime_data_area_absent",
            effectIssued: false,
          });
        throw error;
      }
      if (!metadata.isDirectory() || metadata.isSymbolicLink())
        return Object.freeze({
          status: "blocked",
          reason: "repository_runtime_data_area_boundary_invalid",
          effectIssued: false,
        });
      if (!verifiedArea) {
        const canonicalPath = fs.realpathSync.native(target);
        if (canonicalPath !== target)
          return Object.freeze({
            status: "blocked",
            reason: "repository_runtime_data_area_boundary_invalid",
            effectIssued: false,
          });
        const canonical = fs.lstatSync(canonicalPath, { bigint: true });
        if (canonical.dev !== metadata.dev || canonical.ino !== metadata.ino)
          return Object.freeze({
            status: "blocked",
            reason: "repository_runtime_data_area_boundary_invalid",
            effectIssued: false,
          });
      }
      if (target === paths.root) parentIdentity = directoryIdentity(metadata);
      if (target === directory) leafIdentity = directoryIdentity(metadata);
      if (!verifiedArea && target !== paths.repositoryRoot)
        identities.push(metadata.dev.toString(), metadata.ino.toString());
    }
    if (
      verifiedArea &&
      (directory !== verifiedArea.directory ||
        leafIdentity !== verifiedArea.leafIdentity)
    )
      return Object.freeze({
        status: "blocked",
        reason: "repository_runtime_data_area_boundary_invalid",
        effectIssued: false,
      });
    return Object.freeze({
      status: "ready",
      repositoryRoot: paths.repositoryRoot,
      directory,
      boundaryIdentity:
        verifiedArea?.boundaryIdentity ??
        createHash("sha256").update(identities.join("\0")).digest("hex"),
      parentIdentity,
      leafIdentity,
      effectIssued: false,
    });
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "repository_runtime_data_area_observation_failed",
      effectIssued: false,
    });
  }
}

export type RepositoryExecutionArea = "execution-model" | "tmp" | "lock";

export type RepositoryExecutionDataAreaObservation =
  | Readonly<{
      status: "ready";
      repositoryRoot: string;
      directory: string;
      boundaryIdentity: string;
      parentIdentity: string;
      leafIdentity: string;
      effectIssued: false;
    }>
  | Readonly<{
      status: "not_observed";
      reason: "repository_runtime_data_area_absent";
      effectIssued: false;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "repository_runtime_data_root_capability_invalid"
        | "repository_runtime_data_area_boundary_invalid"
        | "repository_runtime_data_area_observation_failed";
      effectIssued: false;
    }>;

/**
 * Canonical Directoryが成立する状態を確保する。
 *
 * @responsibility Canonical Directoryの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000011
 * @input target: string
 * @returns N/A: ensureCanonicalDirectoryは戻り値を返さない。
 * @precondition 「target: string」がensureCanonicalDirectoryの入力契約を満たす。
 * @postcondition ensureCanonicalDirectoryの責務を完了して呼出し元へ制御を戻す。
 * @effect ensureCanonicalDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure ensureCanonicalDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ensureCanonicalDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: ensureCanonicalDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ensureCanonicalDirectoryは共有非同期状態を持たない同期処理である。
 */
function ensureCanonicalDirectory(target: string): void {
  try {
    fs.mkdirSync(target, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const metadata = fs.lstatSync(target);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(target) !== target
  )
    throw new Error("runtime_data_area_boundary_invalid");
}

/**
 * 共通状態領域を既存領域の再利用なしに新規作成する。
 * @responsibility Runtime Data Ownerで親境界と排他的mkdirの新規作成事実を結合する。
 * @trace ARCH-000011
 * @input repositoryRoot: 保存Ownerに結合済みの絶対ディレクトリ。
 * @returns 新規領域の境界観測とEffect情報、または停止。
 * @precondition Repository-localの.crdd親が既に正規配置で存在する。
 * @postcondition 既存ready領域を新品として返さない。
 * @effect 固定execution-model領域だけを排他的に作成する。
 * @failure 既存領域、alias、親置換、観測不能では停止し、自動削除しない。
 * @invariant 空観測やensureによる再利用を初期化証拠にしない。
 * @boundary Runtime Dataの領域作成からCoordinator初期化Owner。
 * @security 任意Path、旧保存形式や操作Authorityを受理しない。
 * @concurrency 呼出し側のCoordinator排他に加え、mkdirのEEXISTで競合作成を拒否する。
 */
export function createExecutionDataArea(repositoryRoot: string) {
  let effectIssued = false;
  try {
    const paths =
      resolveRepositoryExecutionDataPathsFromValidatedRoot(repositoryRoot);
    if (!paths) throw new Error("root");
    const root = fs.lstatSync(paths.root, { bigint: true });
    if (
      !root.isDirectory() ||
      root.isSymbolicLink() ||
      fs.realpathSync.native(paths.root) !== paths.root
    )
      throw new Error("parent");
    assertExecutionStateInitializationBoundary(repositoryRoot);
    if (
      observePhysicalExecutionDataArea(repositoryRoot, "execution-model")
        .status !== "not_observed"
    )
      throw new Error("existing");
    const before = fs.lstatSync(paths.root, { bigint: true });
    if (root.dev !== before.dev || root.ino !== before.ino)
      throw new Error("parent_changed");
    effectIssued = true;
    fs.mkdirSync(paths.executionModel, { mode: 0o700 });
    assertExecutionStateInitializationBoundary(repositoryRoot);
    const after = fs.lstatSync(paths.root, { bigint: true });
    const observation = observePhysicalExecutionDataArea(
      repositoryRoot,
      "execution-model",
    );
    if (
      root.dev !== after.dev ||
      root.ino !== after.ino ||
      observation.status !== "ready" ||
      fs.readdirSync(paths.executionModel).length !== 0
    )
      throw new Error("changed");
    return Object.freeze({
      status: "created" as const,
      observation,
      effectIssued,
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "coordinator_runtime_data_initialization_unconfirmed",
      effectIssued,
    });
  }
}

/**
 * 旧domain-model保存先を残した空の新版初期化を拒否する。
 * @responsibility 旧domain-model領域の明示不存在と親の同一性だけを検査する。Coordinatorの作業領域は対象外とする。
 * @trace ARCH-000011
 * @input repositoryRoot: 保存Ownerに結合済みの絶対ディレクトリ。
 * @returns N/A: 存在又は観測不能なら例外。
 * @precondition 呼出し側が同じ既存保存排他を保持する。
 * @postcondition 内容・旧Schemaを読まず、ENOENTだけを不存在として受理する。
 * @effect 固定旧Pathと親のmetadata読取りのみ。作成・移動・削除なし。
 * @failure 存在、link、観測不能、親置換では停止する。
 * @invariant 移行完了や旧Effectの終了を推定しない。
 * @boundary 共通保存の初期化とフロントAIの明示移行。
 * @security 任意Pathを受けず、内容や存在を公開結果へ開示しない。
 * @concurrency 同じKernel排他下で処置直前と出版境界を再確認する。
 */
export function assertExecutionStateInitializationBoundary(
  repositoryRoot: string,
): void {
  const paths =
    resolveRepositoryExecutionDataPathsFromValidatedRoot(repositoryRoot);
  if (!paths) throw new Error("runtime_initialization_boundary_unavailable");
  const initialRoot = fs.lstatSync(repositoryRoot, { bigint: true });
  if (
    !initialRoot.isDirectory() ||
    initialRoot.isSymbolicLink() ||
    fs.realpathSync.native(repositoryRoot) !== repositoryRoot
  )
    throw new Error("runtime_initialization_boundary_unavailable");
  let before: fs.BigIntStats | null = null;
  try {
    before = fs.lstatSync(paths.root, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (
    before &&
    (!before.isDirectory() ||
      before.isSymbolicLink() ||
      fs.realpathSync.native(paths.root) !== paths.root)
  )
    throw new Error("runtime_initialization_boundary_unavailable");
  try {
    fs.lstatSync(path.join(paths.root, "domain-model"));
    throw new Error("runtime_initialization_boundary_unavailable");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  let after: fs.BigIntStats | null = null;
  try {
    after = fs.lstatSync(paths.root, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const finalRoot = fs.lstatSync(repositoryRoot, { bigint: true });
  if (
    !finalRoot.isDirectory() ||
    finalRoot.isSymbolicLink() ||
    finalRoot.dev !== initialRoot.dev ||
    finalRoot.ino !== initialRoot.ino ||
    finalRoot.birthtimeNs !== initialRoot.birthtimeNs ||
    fs.realpathSync.native(repositoryRoot) !== repositoryRoot
  )
    throw new Error("runtime_initialization_boundary_unavailable");
  if (
    before === null
      ? after !== null
      : !after?.isDirectory() ||
        after.isSymbolicLink() ||
        before.dev !== after.dev ||
        before.ino !== after.ino ||
        fs.realpathSync.native(paths.root) !== paths.root
  )
    throw new Error("runtime_initialization_boundary_unavailable");
}

/**
 * 呼出し側が準備した対象内で、固定の保存領域を確保する。
 * @responsibility 名前付きディレクトリの作成と実体確認を行う。
 * @trace ARCH-000011
 * @input repositoryRoot: 保存Ownerに結合済みの絶対パス、area: 固定領域名。
 * @returns ready又は無効入力のnull。
 * @precondition Git除外等の必要な環境準備は呼出し側の責務。
 * @postcondition 正規ディレクトリ内の指定領域だけを確保する。
 * @effect 固定領域の作成。Git操作は行わない。
 * @failure 不正親、置換、作成不能は例外。
 * @invariant 作成結果をSnapshotの出版又は回収成功とみなさない。
 * @boundary 保存OwnerからFilesystem。
 * @security ルート外やLinkへの書込みを行わない。
 * @concurrency 既存の親と領域の実体を作成時に確認する。
 */
export function ensurePhysicalExecutionDataArea(
  repositoryRoot: string,
  area: RepositoryExecutionArea,
) {
  const paths =
    resolveRepositoryExecutionDataPathsFromValidatedRoot(repositoryRoot);
  if (!paths || !REPOSITORY_AREAS.includes(area)) return null;
  const target = fs.lstatSync(repositoryRoot);
  if (
    !target.isDirectory() ||
    target.isSymbolicLink() ||
    fs.realpathSync.native(repositoryRoot) !== repositoryRoot
  )
    throw new Error("runtime_data_area_boundary_invalid");
  ensureCanonicalDirectory(paths.root);
  const directory = paths[AREA_PATH_KEYS[area]];
  ensureCanonicalDirectory(directory);
  return Object.freeze({
    status: "ready" as const,
    repositoryRoot,
    directory,
  });
}

/**
 * file-snapshotで使用するStable File Identityの値契約を定義する。
 *
 * @responsibility Stable File IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape StableFileIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StableFileIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: StableFileIdentityの宣言は外部境界を開かない。
 * @security StableFileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility StableFileIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type StableFileIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  ctimeNs: bigint;
  mtimeNs: bigint;
  size: bigint;
  mode: bigint;
}>;

/**
 * identityを決定する。
 *
 * @responsibility identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input metadata: fs.BigIntStats
 * @returns identityの計算結果を返す。
 * @precondition 「metadata: fs.BigIntStats」がidentityの入力契約を満たす。
 * @postcondition identityの責務を完了した結果だけを返す。
 * @effect N/A: identityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure identityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant identityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: identityはProcess内の同一Subsystemで完結する。
 * @security identityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: identityは共有非同期状態を持たない同期処理である。
 */
function identity(metadata: fs.BigIntStats) {
  const ino = normalizeFileId(metadata.ino);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    typeof ino !== "bigint" ||
    metadata.dev <= 0n ||
    ino <= 0n ||
    metadata.birthtimeNs <= 0n ||
    metadata.size <= 0n
  )
    throw new Error("file_snapshot_invalid");
  return Object.freeze({
    dev: metadata.dev,
    ino,
    birthtimeNs: metadata.birthtimeNs,
    ctimeNs: metadata.ctimeNs,
    mtimeNs: metadata.mtimeNs,
    size: metadata.size,
    mode: metadata.mode,
  });
}

/**
 * Stable File Identityが同一かを判定する。
 *
 * @responsibility Stable File Identityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000014
 * @input left: StableFileIdentity、right: StableFileIdentity
 * @returns sameStableFileIdentityの計算結果を返す。
 * @precondition 「left: StableFileIdentity、right: StableFileIdentity」がsameStableFileIdentityの入力契約を満たす。
 * @postcondition sameStableFileIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameStableFileIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameStableFileIdentityは独自の失敗分岐を所有しない。
 * @invariant sameStableFileIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameStableFileIdentityはProcess内の同一Subsystemで完結する。
 * @security sameStableFileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameStableFileIdentityは共有非同期状態を持たない同期処理である。
 */
export function sameStableFileIdentity(
  left: StableFileIdentity,
  right: StableFileIdentity,
) {
  return (
    left.dev === right.dev &&
    normalizeFileId(left.ino) === normalizeFileId(right.ino) &&
    left.birthtimeNs === right.birthtimeNs &&
    left.ctimeNs === right.ctimeNs &&
    left.mtimeNs === right.mtimeNs &&
    left.size === right.size &&
    left.mode === right.mode
  );
}

/**
 * Stable File Snapshotを読み取る。
 *
 * @responsibility Stable File Snapshotの読取り元と読取不能時の結果境界を所有する。
 * @trace ARCH-000014
 * @input file: 絶対パス。namedBeforeは固定ファイルReaderが直前に得た通常File・単一Linkの観測。
 * @returns readStableFileSnapshotの計算結果を返す。
 * @precondition 「file: string」がreadStableFileSnapshotの入力契約を満たす。
 * @postcondition readStableFileSnapshotの責務を完了した結果だけを返す。
 * @effect Filesystemを読み取り、読取り用descriptorを開閉する。書込みは行わない。
 * @failure readStableFileSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readStableFileSnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readStableFileSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readStableFileSnapshotは共有非同期状態を持たない同期処理である。
 */
export function readStableFileSnapshot(
  file: string,
  namedBefore?: fs.BigIntStats,
) {
  if (!path.isAbsolute(file)) throw new Error("file_snapshot_invalid");
  const resolved = path.resolve(file);
  const before = identity(
    namedBefore ?? fs.lstatSync(resolved, { bigint: true }),
  );
  if (fs.realpathSync.native(resolved) !== resolved)
    throw new Error("file_snapshot_invalid");
  const descriptor = fs.openSync(resolved, fs.constants.O_RDONLY);
  let opened: StableFileIdentity;
  let bytes: Buffer;
  try {
    opened = identity(fs.fstatSync(descriptor, { bigint: true }));
    if (!sameStableFileIdentity(before, opened))
      throw new Error("file_snapshot_changed");
    const chunks: Buffer[] = [];
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let byteLength = 0;
    while (true) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      byteLength += count;
      chunks.push(Buffer.from(buffer.subarray(0, count)));
    }
    const after = identity(fs.fstatSync(descriptor, { bigint: true }));
    if (
      byteLength !== Number(opened.size) ||
      !sameStableFileIdentity(opened, after)
    )
      throw new Error("file_snapshot_changed");
    bytes = Buffer.concat(chunks, byteLength);
  } finally {
    fs.closeSync(descriptor);
  }
  if (fs.realpathSync.native(resolved) !== resolved)
    throw new Error("file_snapshot_changed");
  const pathAfter = fs.lstatSync(resolved, { bigint: true });
  if (!sameStableFileIdentity(opened, identity(pathAfter)))
    throw new Error("file_snapshot_changed");
  if (namedBefore && pathAfter.nlink !== 1n) throw new Error("links");
  return Object.freeze({ path: resolved, identity: opened, bytes });
}

/**
 * 共通履歴の実体を固定して読み取る。
 * @responsibility 不存在と観測不能、aliasと通常Fileを区別する。
 * @trace ARCH-000004
 * @input file: 検証済みRoot内のexact Path。
 * @returns 安定したbyte、又は真正不存在のnull。
 * @precondition 保存Ownerを保持する。
 * @postcondition 開いた実体と読取り前後の同一性を確認する。
 * @effect Fileを読みfinallyでhandleを閉じる。
 * @failure 置換・link・過大・観測不能で例外。
 * @invariant 不明を空履歴へ畳まない。
 * @boundary Filesystemと履歴codec。
 * @security link先へ追従しない。
 * @concurrency 同じ短期Owner内で使用する。
 */
function readHistoryFile(file: string): Buffer | null {
  let before: fs.Stats;
  try {
    before = fs.lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1)
    throw new Error("history_file_invalid");
  const fd = fs.openSync(file, "r");
  try {
    const opened = fs.fstatSync(fd);
    if (opened.dev !== before.dev || opened.ino !== before.ino)
      throw new Error("history_file_replaced");
    const bytes = fs.readFileSync(fd);
    const after = fs.lstatSync(file);
    if (
      !after.isFile() ||
      after.isSymbolicLink() ||
      after.nlink !== 1 ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs
    )
      throw new Error("history_file_changed");
    return bytes;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Task要約とState由来の判断イベントを同じ保存Ownerで共通履歴へ確定する。
 * @responsibility 全行検査・保持期間・中断候補の完全一致・読戻しを接続する。
 * @trace ARCH-000004、ARCH-000008
 * @input owner: 真正保存Owner、recordJson: 要約又はnull、now: 評価時刻、mode: 既存更新・判断出版・判断再入場。
 * @returns 履歴確定結果。借用Ownerは解放しない。
 * @precondition 統一state.jsonを初期化済み。
 * @postcondition completedでは確定履歴とpending不存在を観測済み。
 * @effect history.pending.jsonl作成・flush・rename・読戻し。
 * @failure 不一致・破損・不明では候補を保持して停止する。
 * @invariant 判断出版は既存行を保持し、現在時刻による期限整理と元候補再入場を混同しない。
 * @boundary 共通履歴と単一保存Root。
 * @security 任意Path・外部callbackを受け付けない。
 * @concurrency 同じOwnerを借用し外部待機をしない。
 */
export function updateHistoryOwned(
  owner: StorageOwner,
  recordJson: string | null,
  now = Date.now(),
  mode: "update" | "decision" | "resume_decision" = "update",
) {
  const blocked = {
    status: "blocked" as const,
    reason: "coordinator_history_unconfirmed",
  };
  if (
    !isLiveStorageOwner(owner) ||
    !Number.isSafeInteger(now) ||
    now < 0 ||
    now > 8_640_000_000_000_000 ||
    !["update", "decision", "resume_decision"].includes(mode) ||
    (mode !== "update" && recordJson !== null)
  )
    return blocked;
  try {
    const area = observePhysicalExecutionDataArea(
      owner.repositoryRoot,
      "execution-model",
    );
    const policy = readHistoryRetentionDays(
      readStorageOwnerBinding(owner)?.repository,
    );
    const state = readStorageSnapshotOwned(owner, "history");
    if (
      area.status !== "ready" ||
      policy === null ||
      state.status !== "completed" ||
      !state.value
    )
      return blocked;
    const directory = area.directory;
    const stateBytes = Buffer.from(state.value.sourceText, "utf8");
    const currentFile = path.join(directory, "history.jsonl"),
      pendingFile = path.join(directory, "history.pending.jsonl");
    // 新しい業務更新より先に、前回の物理出版だけを完了する。
    if (mode === "resume_decision" && readHistoryFile(pendingFile) === null)
      return {
        status: "completed" as const,
        reason: "coordinator_history_no_pending",
      };
    const assertOwner = () => {
      const fresh = observePhysicalExecutionDataArea(
        owner.repositoryRoot,
        "execution-model",
      );
      const config = readHistoryRetentionDays(
        readStorageOwnerBinding(owner)?.repository,
      );
      if (
        !isLiveStorageOwner(owner) ||
        fresh.status !== "ready" ||
        fresh.boundaryIdentity !== area.boundaryIdentity ||
        !readHistoryFile(path.join(directory, "state.json"))?.equals(
          stateBytes,
        ) ||
        config === null ||
        config !== policy
      )
        throw new Error("history_owner_changed");
    };
    const before = readHistoryFile(currentFile) ?? Buffer.alloc(0);
    const joined = prepareHistoryAppend(
      before,
      recordJson,
      state.value.snapshot.decisions,
      now,
    );
    if (!joined) return blocked;
    // 判断の出版と期限整理を分離し、再入場の候補を時刻経過だけで変形しない。
    const after =
      mode === "update"
        ? retainHistoryFromSnapshot(
            state.value.snapshot,
            joined,
            new Date(now).toISOString(),
            policy,
          )
        : decodeHistoryRows(joined)
          ? joined
          : null;
    if (!after) return blocked;
    const pending = readHistoryFile(pendingFile);
    if (pending && !pending.equals(after)) return blocked;
    assertOwner();
    if (!after.equals(before)) {
      if (!pending) {
        const fd = fs.openSync(pendingFile, "wx", 0o600);
        try {
          fs.writeFileSync(fd, after);
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
      }
      if (
        !readHistoryFile(pendingFile)?.equals(after) ||
        !(readHistoryFile(currentFile) ?? Buffer.alloc(0)).equals(before)
      )
        return blocked;
      assertOwner();
      const fd = fs.openSync(pendingFile, "r+");
      try {
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      if (!readHistoryFile(pendingFile)?.equals(after)) return blocked;
      assertOwner();
      fs.renameSync(pendingFile, currentFile);
    } else if (pending) {
      assertOwner();
      fs.unlinkSync(pendingFile);
    }
    if (
      !(readHistoryFile(currentFile) ?? Buffer.alloc(0)).equals(after) ||
      readHistoryFile(pendingFile) !== null
    )
      return blocked;
    assertOwner();
    return {
      status: "completed" as const,
      reason: "coordinator_history_saved",
    };
  } catch {
    return blocked;
  }
}

/**
 * 単独履歴要求を共通Ownerの取得・保存・一回解放へ閉じる。
 * @responsibility 借用保存と外側の解放を分離する。
 * @trace ARCH-000004
 * @input workingDirectory: Repository内、recordJson: 要約又はnull、now: 評価時刻。
 * @returns 保存と解放の確認結果。
 * @precondition Repositoryを検証できる。
 * @postcondition completedではOwnerを解放済み。
 * @effect 共通短期排他と履歴保存。
 * @failure 取得・保存・解放不明はblocked。
 * @invariant stateと保持物を削除しない。
 * @boundary 公開履歴入口と保存Owner。
 * @security 保存Rootを入力Pathから直接構築しない。
 * @concurrency 外部待機を含めない。
 */
export function updateHistoryPilot(
  workingDirectory: Parameters<typeof acquireStorageOwner>[0],
  recordJson: string | null,
  now = Date.now(),
) {
  const acquired = acquireStorageOwner(workingDirectory);
  if (acquired.status !== "completed")
    return {
      status: "blocked" as const,
      reason: acquired.reason,
      manualRecoveryRequired: acquired.manualRecoveryRequired,
      recoveryId: acquired.recoveryId,
    };
  const owner = acquired.value;
  const result = updateHistoryOwned(owner, recordJson, now);
  return owner.release()
    ? result
    : {
        status: "blocked" as const,
        reason: "coordinator_history_owner_release_unknown",
      };
}

/**
 * stateから除去するTask要約の確定行を確認する。
 * @responsibility 期限推定ではなく同じ本文の実保存を確認する。
 * @trace ARCH-000004
 * @input owner: 真正保存Owner、row: exact要約、now: 評価時刻。
 * @returns recorded又は観測不能のnull。
 * @precondition 同Rootの短期排他を保持する。
 * @postcondition 記録済みの場合は全履歴検査と同内容行を確認済み。
 * @effect 履歴とRootの読取りだけ。
 * @failure pending・破損・別本文・観測不能はnull。
 * @invariant historyPendingが保護されるため期限だけで搬送済みにしない。
 * @boundary 現在状態と履歴。
 * @security IDだけを根拠にしない。
 * @concurrency 同じOwnerを借用する。
 */
export function inspectHistorySettlement(
  owner: StorageOwner,
  row: HistoryRow,
  now = Date.now(),
): "recorded" | "expired" | null {
  if (!isLiveStorageOwner(owner)) return null;
  try {
    const area = observePhysicalExecutionDataArea(
      owner.repositoryRoot,
      "execution-model",
    );
    const policy = readHistoryRetentionDays(
      readStorageOwnerBinding(owner)?.repository,
    );
    if (
      area.status !== "ready" ||
      policy === null ||
      readHistoryFile(path.join(area.directory, "history.pending.jsonl")) !==
        null
    )
      return null;
    const rows = decodeHistoryRows(
      readHistoryFile(path.join(area.directory, "history.jsonl")) ??
        Buffer.alloc(0),
    );
    const expected = taskHistoryLine(historyRow(row, now));
    const matched = rows?.some(
      (item) =>
        item.recoveryId === `task-history.${row.id}` &&
        expected.equals(Buffer.from(item.line)),
    );
    const final = observePhysicalExecutionDataArea(
      owner.repositoryRoot,
      "execution-model",
    );
    const finalPolicy = readHistoryRetentionDays(
      readStorageOwnerBinding(owner)?.repository,
    );
    return matched &&
      finalPolicy !== null &&
      finalPolicy === policy &&
      final.status === "ready" &&
      final.boundaryIdentity === area.boundaryIdentity &&
      isLiveStorageOwner(owner)
      ? "recorded"
      : null;
  } catch {
    return null;
  }
}

/**
 * 判断の全出来事が同じ本文で履歴へ確定したことを確認する。
 * @responsibility pending・不在・破損・同ID別本文を退役可能へ畳まない。
 * @trace ARCH-000004、ARCH-000008
 * @input owner: 保持中の保存Owner、decision: 退役予定のexact記録。
 * @returns 全行確定の場合recorded、それ以外null。
 * @precondition 判断の終端・現在参照は別の純粋候補で検査する。
 * @postcondition 同じIDだけでなく同じ本文を全出来事で確認する。
 * @effect 固定Rootと履歴の読取りのみ。
 * @failure 観測不能・pending・一部欠測・本文不一致はnull。
 * @invariant 期限だけで確定や退役を認めない。
 * @boundary Stateの判断記録と長期履歴の実保存。
 * @security 履歴を現在の操作認可として使わない。
 * @concurrency 同じ短期Ownerを借用し、取得・解放しない。
 */
export function inspectDecisionHistorySettlement(
  owner: StorageOwner,
  decision: Decision,
): "recorded" | null {
  const observed = readDecisionHistoryOwned(owner, {
    decisionId: decision.decisionId,
  });
  const expected = projectDecisionHistory(decision);
  return observed &&
    expected?.every((event) =>
      observed.some(
        (record) => encodeStateValue(event) === encodeStateValue(record),
      ),
    )
    ? "recorded"
    : null;
}

/**
 * 保持中の判断履歴を読取り、真正な欠測と観測不能を区別する。
 * @responsibility 同じIDの再発行拒否と退役確認へ、検査済みの出来事だけを返す。
 * @trace ARCH-000004、ARCH-000008
 * @input owner: 同Rootの保持Owner、identity: 非Authorityな提案又はBlockerの識別子。
 * @returns 検査済みイベント配列（空は真正欠測）、観測不能はnull。
 * @precondition 認可・公開範囲は呼出し側が確認する。
 * @postcondition pendingや破損を空配列へ丸めない。
 * @effect 固定履歴とRoot境界の読取りのみ。
 * @failure 不正ID・Root差・不正行・pending・I/O不明はnull。
 * @invariant 履歴から現在の操作Authorityを発行しない。
 * @boundary 長期履歴と現在の要求・退役判定。
 * @security Pathを受けず、外部へ保存所在を返さない。
 * @concurrency 同じ短期Ownerを借用する。
 */
export function readDecisionHistoryOwned(
  owner: StorageOwner,
  identity: Readonly<{ decisionId: string }> | Readonly<{ blockerId: string }>,
): readonly DecisionHistoryEvent[] | null {
  const key = "decisionId" in identity ? "decisionId" : "blockerId";
  const id =
    "decisionId" in identity ? identity.decisionId : identity.blockerId;
  if (
    !isLiveStorageOwner(owner) ||
    typeof id !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(id)
  )
    return null;
  try {
    const area = observePhysicalExecutionDataArea(
      owner.repositoryRoot,
      "execution-model",
    );
    if (
      area.status !== "ready" ||
      readHistoryFile(path.join(area.directory, "history.pending.jsonl")) !==
        null
    )
      return null;
    const rows = decodeHistoryRows(
      readHistoryFile(path.join(area.directory, "history.jsonl")) ??
        Buffer.alloc(0),
    );
    if (!rows) return null;
    const events: DecisionHistoryEvent[] = [];
    for (const row of rows) {
      if (!row.recoveryId.startsWith("decision-history.")) continue;
      const event = inspectDecisionHistoryEvent(
        JSON.parse(row.line).summary.record,
      );
      if (!event || row.recoveryId !== `decision-history.${event.eventId}`)
        return null;
      if (event[key] === id) events.push(event);
    }
    const final = observePhysicalExecutionDataArea(
      owner.repositoryRoot,
      "execution-model",
    );
    return final.status === "ready" &&
      final.boundaryIdentity === area.boundaryIdentity &&
      isLiveStorageOwner(owner)
      ? events
      : null;
  } catch {
    return null;
  }
}

/**
 * 実行保存領域の初期化が停止した事実を利用側へ伝える。
 * @responsibility 発行済みEffect、不明状態、清掃・再試行の観測結果を保持する。
 * @trace ARCH-000011
 * @invariant 原因と回復参照を保持し、失敗を未実施や成功へ読み替えない。
 */
export class ExecutionStorageBlockedError extends Error {
  readonly reason: string;
  readonly effectIssued: boolean;
  readonly effectStateUnknown: boolean;
  readonly cleanupConfirmed: boolean;
  readonly retryAllowed: boolean;
  readonly recoveryReference: string | null;
  readonly repositoryPathReported = false as const;

  constructor(
    result: Readonly<{
      status: "blocked";
      reason: "repository_runtime_data_ignore_registration_blocked";
      effectIssued: boolean;
      effectStateUnknown: boolean;
      effectConfirmation: "not_issued" | "unknown";
      cleanupConfirmed: boolean;
      retryAllowed: boolean;
      recoveryReference: string | null;
      repositoryPathReported: false;
    }>,
  ) {
    super(result.reason);
    this.name = "ExecutionStorageBlockedError";
    this.reason = result.reason;
    this.effectIssued = result.effectIssued;
    this.effectStateUnknown = result.effectStateUnknown;
    this.cleanupConfirmed = result.cleanupConfirmed;
    this.retryAllowed = result.retryAllowed;
    this.recoveryReference = result.recoveryReference;
  }
}

/**
 * 現行Writer内で既に照合されたRepositoryのI/O用投影。
 * @responsibility Rootと結合の再観測を保ち、用途別Host Contextを保存値へ含めない。
 * @trace ARCH-000008
 * @shape 元のRoot、結合Hash、同期再検証だけ。
 * @invariant この構造自体をOwner・用途・操作Authorityの証明にしない。
 * @boundary 保存Module内部限定。移管後の公開Contextではない。
 * @security 生Root参照や用途識別子をJSONへ複製しない。
 * @compatibility 既存Writerの構造的入力を狭めも広げもしない。
 */
export type StorageRepository = Pick<
  NonNullable<ReturnType<typeof observeExecutionRecoveryRepository>>,
  "repositoryRoot" | "repositoryBinding" | "revalidate"
>;

/** 履歴保存では設定の観測を保存起点の現在性から分離できる。 */
export type RecoveryHistoryRepository = StorageRepository &
  Readonly<{
    operationId: string;
    historyRetentionDays?: number | null;
    revalidateRetention?: (expectedHistoryRetentionDays: number) => boolean;
  }>;

/**
 * 既存の名前付き領域をEffect0で観測する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns readyまたは真正不存在のnot_observed。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect Filesystemの実体を読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary 保存Ownerに結合済みの起点とFilesystem。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */
export function observeArea(
  repositoryRoot: string,
  area: "execution-model" | "tmp" | "lock",
) {
  const observation = observePhysicalExecutionDataArea(repositoryRoot, area);
  if (observation.status === "blocked") throw new Error(observation.reason);
  if (
    observation.status === "ready" &&
    observation.repositoryRoot !== repositoryRoot
  )
    throw new Error("coordinator_repository_root_invalid");
  return observation;
}

/**
 * I/O対象の名前付き領域が現在も成立することを確認する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns 確認済みready観測。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect Filesystemの実体を観測する。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary 保存Ownerに結合済みのディレクトリとFilesystem。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */
export function assertArea(
  repositoryRoot: string,
  area: "execution-model" | "tmp" | "lock",
  directory: string,
) {
  const observation = observeArea(repositoryRoot, area);
  if (observation.status !== "ready" || observation.directory !== directory)
    throw new Error("coordinator_storage_boundary_invalid");
  return observation;
}

/**
 * I/O前後の同じ境界観測を照合する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns 初回と一致する最新の領域観測。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect Filesystemの実体を観測する。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary 保存Ownerに結合済みのディレクトリとFilesystem。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */
export function assertAreaUnchanged(
  repositoryRoot: string,
  area: "execution-model" | "tmp" | "lock",
  initial: Exclude<
    RepositoryExecutionDataAreaObservation,
    { status: "blocked" }
  >,
) {
  const current = observeArea(repositoryRoot, area);
  if (
    initial.status !== current.status ||
    (initial.status === "ready" &&
      (current.status !== "ready" ||
        current.directory !== initial.directory ||
        current.boundaryIdentity !== initial.boundaryIdentity))
  )
    throw new Error("coordinator_storage_boundary_changed");
  return current;
}

/**
 * error Codeを決定する。
 *
 * @responsibility error Codeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns errorCodeの計算結果を返す。
 * @precondition 「error: unknown」がerrorCodeの入力契約を満たす。
 * @postcondition errorCodeの責務を完了した結果だけを返す。
 * @effect N/A: errorCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorCodeは独自の失敗分岐を所有しない。
 * @invariant errorCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorCodeはProcess内の同一Subsystemで完結する。
 * @security errorCodeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorCodeは共有非同期状態を持たない同期処理である。
 */
export function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : null;
}

/**
 * lease Acquisition Temporary Prefixを決定する。
 *
 * @responsibility lease Acquisition Temporary Prefixの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input identity: string
 * @returns leaseAcquisitionTemporaryPrefixの計算結果を返す。
 * @precondition 「identity: string」がleaseAcquisitionTemporaryPrefixの入力契約を満たす。
 * @postcondition leaseAcquisitionTemporaryPrefixの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionTemporaryPrefixは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseAcquisitionTemporaryPrefixは独自の失敗分岐を所有しない。
 * @invariant leaseAcquisitionTemporaryPrefixは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionTemporaryPrefixはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionTemporaryPrefixはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionTemporaryPrefixは共有非同期状態を持たない同期処理である。
 */
export function leaseAcquisitionTemporaryPrefix(identity: string) {
  return `.pending-${identity}-acquisition-`;
}

/**
 * lease Acquisition Temporary Filesを決定する。
 *
 * @responsibility lease Acquisition Temporary Filesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input directory: string、identity: string
 * @returns leaseAcquisitionTemporaryFilesの計算結果を返す。
 * @precondition 「directory: string、identity: string」がleaseAcquisitionTemporaryFilesの入力契約を満たす。
 * @postcondition leaseAcquisitionTemporaryFilesの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionTemporaryFilesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure leaseAcquisitionTemporaryFilesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant leaseAcquisitionTemporaryFilesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionTemporaryFilesはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionTemporaryFilesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionTemporaryFilesは共有非同期状態を持たない同期処理である。
 */
export function leaseAcquisitionTemporaryFiles(
  directory: string,
  identity: string,
) {
  assertDirectory(directory);
  const prefix = leaseAcquisitionTemporaryPrefix(identity);
  const names = fs
    .readdirSync(directory)
    .filter((name) => name.startsWith(prefix));
  if (names.some((name) => !name.endsWith(".tmp")))
    throw new Error("coordinator_lease_acquisition_inventory_invalid");
  return Object.freeze(names);
}

/**
 * path Confirmed Absentを決定する。
 *
 * @responsibility path Confirmed Absentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input candidate: string
 * @returns pathConfirmedAbsentの計算結果を返す。
 * @precondition 「candidate: string」がpathConfirmedAbsentの入力契約を満たす。
 * @postcondition pathConfirmedAbsentの責務を完了した結果だけを返す。
 * @effect pathConfirmedAbsentはFilesystemの読取りまたは書込みを実行する。
 * @failure pathConfirmedAbsentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant pathConfirmedAbsentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security pathConfirmedAbsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: pathConfirmedAbsentは共有非同期状態を持たない同期処理である。
 */
export function pathConfirmedAbsent(candidate: string) {
  try {
    fs.lstatSync(candidate);
    return false;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return true;
    throw error;
  }
}

/**
 * lease Acquisition Footprint Absentを決定する。
 *
 * @responsibility lease Acquisition Footprint Absentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input directory: string、identity: string、paths: readonly string[]
 * @returns leaseAcquisitionFootprintAbsentの計算結果を返す。
 * @precondition 「directory: string、identity: string、paths: readonly string[]」がleaseAcquisitionFootprintAbsentの入力契約を満たす。
 * @postcondition leaseAcquisitionFootprintAbsentの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionFootprintAbsentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseAcquisitionFootprintAbsentは独自の失敗分岐を所有しない。
 * @invariant leaseAcquisitionFootprintAbsentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionFootprintAbsentはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionFootprintAbsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionFootprintAbsentは共有非同期状態を持たない同期処理である。
 */
export function leaseAcquisitionFootprintAbsent(
  directory: string,
  identity: string,
  paths: readonly string[],
) {
  return (
    paths.every(pathConfirmedAbsent) &&
    leaseAcquisitionTemporaryFiles(directory, identity).length === 0
  );
}

/**
 * Directoryを表明どおりか検査する。
 *
 * @responsibility Directoryの必須条件と違反時の停止境界を所有する。
 * @trace ARCH-000004
 * @input directory: string
 * @returns N/A: assertDirectoryは戻り値を返さない。
 * @precondition 「directory: string」がassertDirectoryの入力契約を満たす。
 * @postcondition assertDirectoryの責務を完了して呼出し元へ制御を戻す。
 * @effect assertDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure assertDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant assertDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security assertDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: assertDirectoryは共有非同期状態を持たない同期処理である。
 */
export function assertDirectory(directory: string) {
  const metadata = fs.lstatSync(directory);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(directory) !== directory
  ) {
    throw new Error("coordinator_storage_boundary_invalid");
  }
}

/**
 * Directoryが成立する状態を確保する。
 *
 * @responsibility Directoryの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000004
 * @input parent: string、name: string
 * @returns ensureDirectoryの計算結果を返す。
 * @precondition 「parent: string、name: string」がensureDirectoryの入力契約を満たす。
 * @postcondition ensureDirectoryの責務を完了した結果だけを返す。
 * @effect ensureDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure ensureDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ensureDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security ensureDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ensureDirectoryは共有非同期状態を持たない同期処理である。
 */
export function ensureDirectory(parent: string, name: string) {
  if (!/^[A-Za-z0-9._-]{1,128}$/u.test(name) || name === "." || name === "..")
    throw new Error("coordinator_storage_identity_invalid");
  const target = path.join(parent, name);
  try {
    fs.mkdirSync(target, { mode: 0o700 });
  } catch (error) {
    if (
      !(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "EEXIST"
      )
    )
      throw error;
  }
  assertDirectory(target);
  if (path.dirname(target) !== parent)
    throw new Error("coordinator_storage_boundary_invalid");
  return target;
}

/**
 * 統合保存の現在値を変更せず読み取る。
 * @responsibility 真正不存在と未確定保存・観測不能を区別する。
 * @trace ARCH-000004
 * @input workingDirectory: Repository内の起点、binding: 期待する保存結合。
 * @returns 検証済みSnapshot、真正不存在のnull、または停止。
 * @precondition 本番切替は呼出し側が別途管理する。
 * @postcondition Root・全区画・Hashと排他解放を確認した時だけ成功する。
 * @effect Fileの読取りと短期排他のみ。保存領域を作成しない。
 * @failure alias、途中消失、pending、破損と結合不明を拒否する。
 * @invariant 新版破損を旧形式へのFallback許可にしない。
 * @boundary Repository-localの統合保存から内部Portへの境界。
 * @security 読取りだけでAuthorityや手動Recovery義務を発行しない。
 * @concurrency 同Rootの短期OS排他を取得し解放確認まで成功を保留する。
 */
export function readSnapshot(
  workingDirectory: Parameters<typeof acquireSnapshotPilotLock>[0],
  binding: string,
  readMode: boolean | "history" = false,
): StoreResult<Snapshot | null> {
  if (!validId(binding)) return blocked("coordinator_snapshot_input_invalid");
  const acquired = acquireSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const lock = acquired.value;
  const outcome =
    readMode === false
      ? readSnapshotOwned(lock, binding)
      : readSnapshotOwned(lock, binding, readMode);
  if (!lock.release())
    return blocked("coordinator_snapshot_lock_release_unconfirmed", true);
  return outcome;
}

/**
 * 同じ排他Owner内で現在値を読み取る。
 * @responsibility 自己再取得せず、読取りと保存の一連の処置を支える。
 * @trace ARCH-000004
 * @input lock: 取得済みOwner、binding: 期待する保存結合。
 * @returns 検証済みSnapshot、真正不存在、または停止。
 * @precondition 呼出し側が短期排他を取得し解放を担当する。
 * @postcondition pendingを確定・回収せず現在値だけを返す。
 * @effect File読取りのみ。保存領域を作成しない。
 * @failure Root・親・File・内容の不正または観測不能で停止する。
 * @invariant 取得・解放を内部で繰り返さない。
 * @boundary 排他Owner内の保存読取り。
 * @security 旧形式への自動Fallbackをしない。
 * @concurrency 取得済み短期排他の保持を呼出し側が管理する。
 */
export function readSnapshotOwned(
  lock: SnapshotOwner,
  binding: string,
  readMode: boolean | "history" = false,
): StoreResult<Snapshot | null> {
  if (!isLiveSnapshotOwner(lock))
    return blocked("coordinator_snapshot_lock_owner_invalid", true);
  const observed = readStorageSnapshotOwned(lock, readMode);
  if (observed.status !== "completed")
    return observed.reason === "coordinator_state_uninitialized"
      ? completed("coordinator_snapshot_absent", null)
      : blocked(observed.reason, true);
  if (!observed.value)
    return blocked("coordinator_snapshot_invalid_or_unconfirmed", true);
  // 物理Readerが結合・正規本文・全Stateを検証済み。同じ読取り結果を投影する。
  const value = projectTaskSnapshot(observed.value, lock.repositoryRootHash);
  if (value && value.repositoryBindingId !== binding)
    return blocked("coordinator_snapshot_binding_invalid", true);
  return completed(
    value ? "coordinator_snapshot_observed" : "coordinator_snapshot_absent",
    value,
  );
}

/**
 * Coordinator Durable Foundationの公開契約を記述する。
 *
 * @responsibility Coordinator Durable Foundationの公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeDurableFoundationの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeDurableFoundationの入力契約を満たす。
 * @postcondition describeDurableFoundationの責務を完了した結果だけを返す。
 * @effect N/A: describeDurableFoundationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeDurableFoundationは独自の失敗分岐を所有しない。
 * @invariant describeDurableFoundationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeDurableFoundationはProcess内の同一Subsystemで完結する。
 * @security describeDurableFoundationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeDurableFoundationは共有非同期状態を持たない同期処理である。
 */
export function describeDurableFoundation() {
  return Object.freeze({
    contract: STORAGE_CONTRACT,
    recordStrategy: "single_current_snapshot_with_pending_atomic_replace",
    queueMutation: "short_exclusive_repository_local_lock",
    operationLease:
      "exclusive_lock_with_owner_generation_and_no_stale_takeover",
    staleLockDisposition: "blocked_manual_reconciliation_required_before_reuse",
    externalWaitWhileMutationLockHeld: false,
    taskManagementCapabilityComplete: false,
  });
}

const stateVersionEvidenceKey = Symbol("stateVersionEvidence");

/**
 * 読取り時の正規保存本文を、完全一致のためだけに独立保持する。
 * @trace ARCH-000008
 * @boundary 上位には比較だけを提供し、保存の認可や元版の再確認は既存Writerが所有する。
 */
class StateVersionEvidence {
  readonly #text: string;

  constructor(key: symbol, text: string) {
    if (key !== stateVersionEvidenceKey)
      throw Error("state_version_evidence_owner_invalid");
    this.#text = text;
    Object.freeze(this);
  }

  /** 同じ保存本文か、Hashだけに置換せず完全比較する。 @trace ARCH-000008 */
  matches(other: unknown): boolean {
    return (
      this.#text === StateVersionEvidence.read(other, stateVersionEvidenceKey)
    );
  }

  /** Writer内部だけが既存の完全一致に使う本文を取得する。 @trace ARCH-000008 */
  static read(observed: unknown, key: symbol): string | null {
    return key === stateVersionEvidenceKey &&
      typeof observed === "object" &&
      observed !== null &&
      #text in observed
      ? observed.#text
      : null;
  }
}
Object.freeze(StateVersionEvidence.prototype);
Object.freeze(StateVersionEvidence);

/** 検証した正規本文だけを公開Readerからの比較値にする。 @trace ARCH-000008 */
export function captureStateVersionEvidence(sourceText: string) {
  return new StateVersionEvidence(stateVersionEvidenceKey, sourceText);
}

/** 保存Module内で従来の完全byte比較に使う元版を得る。 @trace ARCH-000008 */
export function readStateVersionEvidence(observed: unknown): Buffer | null {
  const text = StateVersionEvidence.read(observed, stateVersionEvidenceKey);
  return text === null ? null : Buffer.from(text, "utf8");
}

const resourcePublicationKey = Symbol("resourcePublication");
type ResourcePublicationBytes = Readonly<{ before: Buffer; candidate: Buffer }>;

/**
 * 資源回収の途中保存で観測した元版と候補を一組で保持する。
 * @trace ARCH-000008
 * @boundary 本文は保存Owner内だけに留め、上位へ完全一致の判定だけを返す。
 * @invariant この値自体は保存権限ではなく、保存時に元Ownerと現在の組を再確認する。
 */
class ResourcePublication {
  readonly #bytes: ResourcePublicationBytes;

  constructor(key: symbol, before: Buffer, candidate: Buffer) {
    if (key !== resourcePublicationKey)
      throw Error("resource_publication_owner_invalid");
    this.#bytes = {
      before: Buffer.from(before),
      candidate: Buffer.from(candidate),
    };
    Object.freeze(this);
  }

  /** 元版と候補の両方の完全一致を確認する。 @trace ARCH-000008 */
  matches(other: unknown): boolean {
    const candidate = readResourcePublicationBytes(other);
    return (
      candidate !== null &&
      this.#bytes.before.equals(candidate.before) &&
      this.#bytes.candidate.equals(candidate.candidate)
    );
  }

  /** 従来と同じUTF-8本文の比較で保存直後の候補を確かめる。 @trace ARCH-000008 */
  matchesCandidate(versionEvidence: unknown): boolean {
    const bytes = readStateVersionEvidence(versionEvidence);
    return bytes !== null && this.#bytes.candidate.equals(bytes);
  }

  /** 同じ保存ModuleだけがWriterへの元版と候補を開ける。 @trace ARCH-000008 */
  static read(observed: unknown, key: symbol): ResourcePublicationBytes | null {
    return key === resourcePublicationKey &&
      typeof observed === "object" &&
      observed !== null &&
      #bytes in observed
      ? observed.#bytes
      : null;
  }
}
Object.freeze(ResourcePublication.prototype);
Object.freeze(ResourcePublication);

/** 検査済みの組を独立捕捉し、上位には本文を渡さない。 @trace ARCH-000008 */
export function captureResourcePublication(before: Buffer, candidate: Buffer) {
  return new ResourcePublication(resourcePublicationKey, before, candidate);
}

/** 不正な入力のPropertyを評価せず、実際に発行した組だけをWriterに渡す。 @trace ARCH-000008 */
export function readResourcePublicationBytes(
  observed: unknown,
): ResourcePublicationBytes | null {
  return ResourcePublication.read(observed, resourcePublicationKey);
}

/**
 * 検証済み保存結合のSnapshotを共通経路で取得する。
 * @responsibility 通常と終端の同じRoot・File・版・排他観測を所有する。
 * @trace ARCH-000008
 * @input repository: 内部保存結合、recoveryId: 対象参照。用途別の固定参照は専用再入場、allowUninitializedは初期化、storageOwnerは同じ短期排他の借用に限定する。
 * @returns 確認済みSnapshotまたは値を持たないblocked。
 * @precondition 保存結合は現在Owner、検証済みRootまたは登録済み終端Contextから得る。
 * @postcondition 排他解放不明の本文を利用側へ渡さない。
 * @effect 現在Rootと固定Fileの読取り、既存短期排他だけ。
 * @failure Root・File・対象操作不一致、通常Readerの保存途中、限定準備の別候補、解放不明は停止する。
 * @invariant 読取りは処置Authorityや初期化Writer資格を作らず、入場用の不存在観測をそれらの代わりにしない。
 * @boundary Repository-local現在状態と内部利用側。
 * @security 任意Pathや旧記録を保存先選択へ使用しない。
 * @concurrency 通常Writerと同じKernel Lockを短期間だけ保持する。
 */
export function readStateSnapshot(
  repository:
    | (Pick<
        NonNullable<ReturnType<typeof observeOperationRepository>>,
        "repositoryRoot" | "repositoryBinding" | "revalidate"
      > & { operationId?: string })
    | null,
  recoveryId: string | null,
  currentHistoryRecoveryId: string | null = null,
  currentCompletionRecoveryId: string | null = null,
  currentHistoryKind: "docker_task" | "docker_repair" = "docker_task",
  currentCompletionKind: "docker_task" | "docker_repair" = "docker_task",
  allowUninitialized = false,
  resourcePublicationRecoveryId: string | null = null,
  completedOperation: Readonly<{
    recoveryId: string;
    correlationId: string;
  }> | null = null,
  storageOwner: StorageOwner | null = null,
  taskPublicationRead: boolean | "history" = false,
  includeHistory = false,
) {
  /**
   * 未確認の読取り結果を値なしで返す。
   * @responsibility 拒否理由と排他終了を保持し、未確認本文を搬送しない。
   * @trace ARCH-000008
   * @input reason: 拒否理由、lockReleased: 排他終了の観測。
   * @returns 固定blocked結果。
   * @precondition 呼出し元が原因と排他観測を確定している。
   * @postcondition valueは常にnullとなる。
   * @effect N/A: 局所結果の構築だけ。
   * @failure N/A: 独自のI/Oを発行しない。
   * @invariant blockedを新品・正常状態へ変換しない。
   * @boundary N/A: Process内の値構築だけ。
   * @security 本文・Path・Authorityを含めない。
   * @concurrency N/A: 同期の値構築だけ。
   */
  const blocked = (reason: string, lockReleased: boolean) =>
    Object.freeze({
      status: "blocked" as const,
      reason,
      lockReleased,
      value: null,
      operationCompletionConfirmed: false,
      currentHistoryPublication: null,
      repairHistoryState: null,
      currentCompletionPublication: null,
      repairCompletionAbsent: false,
      repairRetentionReviewAfter: null,
      resourcePublication: null,
      historyRows: null,
    });
  if (!repository) return blocked("coordinator_state_owner_invalid", true);
  const registeredOwner = storageOwner
    ? readStorageOwnerBinding(storageOwner)
    : undefined;
  const sameHistoryOwner =
    currentHistoryRecoveryId !== null &&
    currentHistoryRecoveryId === recoveryId &&
    registeredOwner?.repository === repository;
  const borrowedOwner = storageOwner
    ? sameHistoryOwner
      ? registeredOwner
      : borrowStorageOwner(storageOwner, repository)
    : null;
  if (storageOwner && !borrowedOwner)
    return blocked("coordinator_state_owner_invalid", false);
  const acquisition = borrowedOwner
    ? null
    : acquireStorageOwnerForRepository(repository);
  if (acquisition?.status === "blocked")
    return {
      ...blocked(acquisition.reason, false),
      manualRecoveryRequired: acquisition.manualRecoveryRequired,
      recoveryId: acquisition.recoveryId,
    };
  const ownedOwner = acquisition?.value ?? null;
  const lock =
    borrowedOwner?.lock ??
    (ownedOwner ? readStorageOwnerBinding(ownedOwner)?.lock : null);
  if (!lock) return blocked("coordinator_state_lock_unavailable", false);
  let value:
    | (NonNullable<ReturnType<typeof decodeStateSnapshot>> & {
        readonly sourceText: string;
        readonly operationStates: readonly ReturnType<
          typeof projectOperationState
        >[];
      })
    | null = null;
  let historyRows: ReturnType<typeof decodeHistoryRows> = null;
  let resourcePublication: ResourcePublication | null = null;
  let reason = "coordinator_state_read_unconfirmed";
  let currentCompletionPublication: Readonly<{
    before: Buffer;
    candidate: Buffer;
    historyFile: Readonly<{
      bytes: Buffer;
      identity: StableFileIdentity;
    }> | null;
  }> | null = null;
  let currentHistoryPublication: Readonly<{
    operationKind: "docker_task" | "docker_repair";
    before: Buffer;
    candidate: Buffer;
    stage: "terminal_checkpoint" | "checkpoint" | "publish" | "confirmed";
    needsWrite: boolean;
    historyFile: Readonly<{
      bytes: Buffer;
      identity: StableFileIdentity;
    }> | null;
    pendingHistoryFile: Readonly<{
      bytes: Buffer;
      identity: StableFileIdentity;
    }> | null;
    retentionDays: number | null;
    taskState?: TaskHistoryState;
  }> | null = null;
  let repairHistoryState: "technical_state" | "publication" | null = null;
  let recoveryHistory: ReturnType<typeof readStableFileSnapshot> | null = null;
  let recoveryHistoryPending: ReturnType<typeof readStableFileSnapshot> | null =
    null;
  let recoveryRetentionDays: number | null = null;
  let operationCompletionConfirmed = false;
  let repairCompletionAbsent = false;
  let repairRetentionReviewAfter: string | null = null;
  try {
    const metadataOnly = borrowedOwner?.metadataOnly === true;
    // 通常の借用は入口で保存先・Lockを照合済み。履歴専用の登録照合は実体を読まない。
    // 最後の現在性検査と解放の判定は、この入口の確認と別に維持する。
    if (
      (borrowedOwner?.repository !== repository || sameHistoryOwner) &&
      (!repository.revalidate() || !lock.assertLive())
    )
      throw new Error("owner");
    const initial = observePhysicalExecutionDataArea(
      repository.repositoryRoot,
      "execution-model",
    );
    if (
      allowUninitialized &&
      !metadataOnly &&
      initial.status === "not_observed"
    ) {
      assertExecutionStateInitializationBoundary(repository.repositoryRoot);
      const fresh = observePhysicalExecutionDataArea(
        repository.repositoryRoot,
        "execution-model",
      );
      if (
        fresh.status === "not_observed" &&
        repository.revalidate() &&
        lock.assertLive()
      )
        reason = "coordinator_state_uninitialized";
      throw new Error("admission_area_not_ready");
    }
    if (
      initial.status !== "ready" ||
      initial.repositoryRoot !== repository.repositoryRoot
    )
      throw new Error("area");
    const names = fs.readdirSync(initial.directory);
    const allowedNames =
      taskPublicationRead === "history"
        ? ["state.json", "history.jsonl", "history.pending.jsonl"]
        : currentHistoryRecoveryId !== null
          ? [
              "state.json",
              "history.jsonl",
              "state.pending.json",
              "history.pending.jsonl",
            ]
          : taskPublicationRead ||
              resourcePublicationRecoveryId !== null ||
              currentCompletionRecoveryId !== null
            ? ["state.json", "history.jsonl", "state.pending.json"]
            : ["state.json", "history.jsonl"];
    if (names.some((name) => !allowedNames.includes(name))) {
      reason = "coordinator_state_reentry_required";
      throw new Error("pending_or_unknown_content");
    }
    const file = path.join(initial.directory, "state.json");
    const metadata = fs.lstatSync(file, { bigint: true });
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.nlink !== 1n
    )
      throw new Error("file");
    const observed = readStableFileSnapshot(file, metadata);
    const decoded = decodeStateSnapshot(
      observed.bytes,
      repository.repositoryBinding,
    );
    if (!decoded) throw new Error("content");
    if (includeHistory) {
      if (names.includes("history.jsonl")) {
        const historyFile = path.join(initial.directory, "history.jsonl");
        const metadata = fs.lstatSync(historyFile);
        if (
          !metadata.isFile() ||
          metadata.isSymbolicLink() ||
          metadata.nlink !== 1
        )
          throw new Error("history_file");
        recoveryHistory = readStableFileSnapshot(historyFile);
      }
      historyRows = decodeHistoryRows(
        recoveryHistory?.bytes ?? Buffer.alloc(0),
      );
      if (!historyRows) throw new Error("history_content");
    }
    let completedHistory: ReturnType<typeof readStableFileSnapshot> | null =
      null;
    const completedHistoryFile = path.join(initial.directory, "history.jsonl");
    if (completedOperation) {
      const target = completedOperation.recoveryId;
      const parsed = parseDockerTaskRecoveryId(target);
      if (
        !parsed ||
        [
          decoded.snapshot.operations,
          decoded.snapshot.unresolvedRecoveries,
        ].some((entries) =>
          entries.some(
            (entry) =>
              entry.recoveryId === target ||
              parseDockerTaskRecoveryId(entry.recoveryId)?.operationNonce ===
                parsed.operationNonce,
          ),
        )
      )
        throw new Error("completion_target_present");
      const metadata = fs.lstatSync(completedHistoryFile);
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.nlink !== 1
      )
        throw new Error("completion_history_file");
      completedHistory = readStableFileSnapshot(completedHistoryFile);
      const rows = decodeHistoryRows(completedHistory.bytes);
      const row = rows?.find((entry) => entry.recoveryId === target);
      const summary = row ? JSON.parse(row.line).summary : null;
      if (
        !row ||
        summary.schema !== "crdd-execution-model/operation-summary/v7" ||
        summary.recoveryCorrelationId !== completedOperation.correlationId
      )
        throw new Error("completion_history_unconfirmed");
      operationCompletionConfirmed = true;
    }
    let pending: ReturnType<typeof readStableFileSnapshot> | null = null;
    const pendingFile = path.join(initial.directory, "state.pending.json");
    if (resourcePublicationRecoveryId !== null) {
      if (!names.includes("state.pending.json"))
        throw new Error("resource_publication_pair_required");
      const metadata = fs.lstatSync(pendingFile);
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.nlink !== 1
      )
        throw new Error("pending_file");
      pending = readStableFileSnapshot(pendingFile);
      if (
        !classifyResourcePublication(
          observed.bytes,
          pending.bytes,
          resourcePublicationRecoveryId,
          repository.repositoryBinding,
        )
      )
        throw new Error("resource_publication_candidate_mismatch");
      resourcePublication = captureResourcePublication(
        observed.bytes,
        pending.bytes,
      );
    }
    const currentPublicationRecoveryId =
      currentHistoryRecoveryId ?? currentCompletionRecoveryId;
    if (
      currentCompletionRecoveryId !== null &&
      currentCompletionKind === "docker_repair" &&
      !decoded.snapshot.operations.some(
        (item) => item.recoveryId === currentCompletionRecoveryId,
      )
    ) {
      if (
        currentHistoryRecoveryId !== null ||
        names.includes("state.pending.json")
      )
        throw new Error("repair_completion_absence_scope_invalid");
      const nonce = currentCompletionRecoveryId.split(".")[1];
      if (
        [
          decoded.snapshot.operations,
          decoded.snapshot.unresolvedRecoveries,
        ].some((entries) =>
          entries.some(
            (item) =>
              item.recoveryId === currentCompletionRecoveryId ||
              ("kind" in item && item.kind === "host_operation"
                ? item.operationId
                : "identityJson" in item
                  ? JSON.parse(item.identityJson).operationNonce
                  : item.operationNonce) === nonce,
          ),
        )
      )
        throw new Error("repair_completion_reference_present");
      const historyFile = path.join(initial.directory, "history.jsonl");
      const metadata = fs.lstatSync(historyFile);
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.nlink !== 1
      )
        throw new Error("repair_completion_history_invalid");
      recoveryHistory = readStableFileSnapshot(historyFile);
      const rows = decodeHistoryRows(recoveryHistory.bytes);
      const row = rows?.find(
        (item) => item.recoveryId === currentCompletionRecoveryId,
      );
      const summary = row ? JSON.parse(row.line).summary : null;
      if (
        !rows ||
        !summary ||
        summary.schema !== "crdd-coordinator/repair-summary/v1" ||
        summary.outcome.status !== "recovered" ||
        summary.outcome.reason !== "docker_repair_recovered" ||
        summary.outcome.cleanupConfirmed !== true ||
        summary.primaryFailure !== null ||
        summary.technical.engine !== "ready" ||
        summary.technical.hostSafety !== "safe" ||
        summary.technical.cleanup !== "confirmed" ||
        summary.technical.cleanupFailure !== null ||
        !(
          (summary.technical.stale === "absent" &&
            summary.disposition === "not_applicable") ||
          (summary.technical.stale === "retained" &&
            summary.disposition === "discard" &&
            summary.disposal &&
            isRepairDisposalSettled(summary.disposal.checkpoint)) ||
          (summary.technical.stale === "retained" &&
            summary.disposition === "retained_by_human_decision" &&
            summary.retention !== undefined)
        ) ||
        (repository.operationId !== undefined &&
          summary.operationId !== repository.operationId)
      )
        throw new Error("repair_completion_history_missing_or_mismatched");
      repairCompletionAbsent = true;
      repairRetentionReviewAfter =
        row && "reviewAfter" in row && typeof row.reviewAfter === "string"
          ? row.reviewAfter
          : null;
    }
    if (currentPublicationRecoveryId !== null && !repairCompletionAbsent) {
      if (
        [currentHistoryRecoveryId, currentCompletionRecoveryId].filter(
          (value) => value !== null,
        ).length !== 1
      )
        throw new Error("history_reentry_mode_conflict");
      const expectedKind =
        currentHistoryRecoveryId !== null
          ? currentHistoryKind
          : currentCompletionRecoveryId !== null
            ? currentCompletionKind
            : "docker_task";
      const operation = decoded.snapshot.operations.find(
        (item) =>
          item.kind === expectedKind &&
          item.recoveryId === currentPublicationRecoveryId,
      );
      const technicalState =
        operation?.kind === "docker_repair" &&
        ((operation.phase === "repairing" && operation.outcome === null) ||
          (currentHistoryRecoveryId !== null &&
            currentHistoryKind === "docker_repair" &&
            operation.outcome?.status === "recovered" &&
            operation.primaryFailure === null &&
            ((operation.phase === "awaiting_disposition" &&
              operation.disposition === "pending_human_decision" &&
              operation.disposal === null) ||
              (operation.phase === "settling" &&
                operation.disposition === "discard" &&
                operation.disposal !== null &&
                !isRepairDisposalSettled(operation.disposal.checkpoint))))) &&
        operation.summarySha256 === null &&
        operation.history === null;
      const taskTerminalReady =
        operation?.kind === "docker_task" &&
        operation.phase !== "executing" &&
        operation.lease === "released" &&
        operation.execution.ownerEffect === "disabled" &&
        operation.outcome?.cleanupConfirmed === true &&
        readOperationHost(decoded.snapshot.operations, operation)?.cleanup ===
          "confirmed" &&
        areTaskResourcesSettled(operation) &&
        isDockerRestartCheckpointSettled(operation.dockerRestart);
      if (
        !operation ||
        operation.kind === "host_operation" ||
        (operation.kind === "docker_repair"
          ? (!technicalState &&
              !prepareRepairHistorySummary(
                observed.bytes,
                operation.recoveryId,
                repository.repositoryBinding,
              )) ||
            (repository.operationId !== undefined &&
              JSON.parse(operation.identityJson).operationId !==
                repository.operationId)
          : !(
              currentHistoryRecoveryId !== null &&
              operation.history === null &&
              names.includes("state.pending.json") &&
              !names.includes("history.pending.jsonl")
            ) && !taskTerminalReady)
      )
        throw new Error("history_terminal_unconfirmed");
      for (const name of [
        "history.jsonl",
        "history.pending.jsonl",
        "state.pending.json",
      ] as const) {
        if (!names.includes(name)) continue;
        const target = path.join(initial.directory, name),
          metadata = fs.lstatSync(target, { bigint: true });
        if (
          !metadata.isFile() ||
          metadata.isSymbolicLink() ||
          metadata.nlink !== 1n
        )
          throw new Error("history_file");
        const contents = readStableFileSnapshot(target, metadata);
        if (name === "history.jsonl") recoveryHistory = contents;
        else if (name === "history.pending.jsonl")
          recoveryHistoryPending = contents;
        else pending = contents;
      }
      // decodeStateSnapshotはこの保存本文の正規表現との一致を確認済み。
      const before = Buffer.from(observed.bytes);
      let candidate: Buffer | null = null;
      let taskCandidate: TaskHistorySnapshot | undefined;
      let taskHistoryPublication: TaskHistoryState["publication"];
      let stage:
        | "terminal_checkpoint"
        | "checkpoint"
        | "publish"
        | "confirmed"
        | null = null;
      if (technicalState) {
        const rows = decodeHistoryRows(
          recoveryHistory?.bytes ?? Buffer.alloc(0),
        );
        if (
          !rows ||
          rows.some((row) => row.recoveryId === operation.recoveryId) ||
          recoveryHistoryPending
        )
          throw new Error("repair_technical_history_invalid");
        repairHistoryState = "technical_state";
        // この分類は履歴領域の健全性だけで、pendingの採用は既存修復publisherが判断する。
      } else if (currentCompletionRecoveryId !== null) {
        if (operation.kind !== currentCompletionKind)
          throw new Error("current_completion_kind_invalid");
        const line = (
          currentCompletionKind === "docker_repair"
            ? prepareRepairHistoryLine
            : prepareStateHistoryLine
        )(before, currentCompletionRecoveryId, repository.repositoryBinding);
        const rows = decodeHistoryRows(
          recoveryHistory?.bytes ?? Buffer.alloc(0),
        );
        const row = rows?.find(
          (item) => item.recoveryId === currentCompletionRecoveryId,
        );
        candidate = (
          currentCompletionKind === "docker_repair"
            ? prepareStateRepairCompletionSnapshot
            : prepareStateCompletionSnapshot
        )(before, currentCompletionRecoveryId, repository.repositoryBinding);
        if (
          !operation.history?.confirmed ||
          !line ||
          !rows ||
          (currentCompletionKind === "docker_repair" && !row) ||
          (row && !Buffer.from(row.line).equals(line)) ||
          createHash("sha256").update(line).digest("hex") !==
            operation.history.lineSha256 ||
          recoveryHistoryPending ||
          !candidate ||
          (pending && !pending.bytes.equals(candidate))
        )
          throw new Error("current_completion_target_invalid");
        if (currentCompletionKind === "docker_repair")
          repairRetentionReviewAfter =
            row && "reviewAfter" in row && typeof row.reviewAfter === "string"
              ? row.reviewAfter
              : null;
        stage = "confirmed";
        currentCompletionPublication = Object.freeze({
          before,
          candidate: Buffer.from(candidate),
          historyFile:
            recoveryHistory === null
              ? null
              : {
                  bytes: Buffer.from(recoveryHistory.bytes),
                  identity: recoveryHistory.identity,
                },
        });
      } else if (operation.history === null) {
        if (recoveryHistoryPending)
          throw new Error("history_checkpoint_pending_invalid");
        const priorRows = decodeHistoryRows(
          recoveryHistory?.bytes ?? Buffer.alloc(0),
        );
        if (
          !priorRows ||
          priorRows.some((row) => row.recoveryId === currentHistoryRecoveryId)
        )
          throw new Error("history_checkpoint_prior_line_invalid");
        const pendingState = pending
          ? decodeStateSnapshot(pending.bytes, repository.repositoryBinding)
          : null;
        const target = pendingState?.snapshot.operations.find(
          (item): item is Exclude<typeof item, { kind: "host_operation" }> =>
            item.kind === expectedKind &&
            item.recoveryId === currentHistoryRecoveryId,
        );
        if (pending && (!target?.history || target.history.confirmed))
          throw new Error("history_checkpoint_target_invalid");
        const occurredAt =
          target?.history?.occurredAt ??
          (operation.kind === "docker_repair"
            ? operation.retention?.decidedAt
            : undefined) ??
          new Date().toISOString();
        if (operation.kind === "docker_repair") {
          candidate = prepareRepairHistorySnapshot(
            before,
            currentHistoryRecoveryId,
            occurredAt,
            false,
            repository.repositoryBinding,
          );
        } else if (taskTerminalReady) {
          taskCandidate =
            prepareTaskHistorySnapshot(
              decoded,
              currentHistoryRecoveryId,
              occurredAt,
              false,
              repository.repositoryBinding,
              pending && pendingState
                ? { bytes: pending.bytes, decoded: pendingState }
                : undefined,
            ) ?? undefined;
          candidate = taskCandidate?.bytes ?? null;
        }
        stage = "checkpoint";
        if (operation.kind === "docker_task" && pending && target?.history) {
          const terminal = prepareRecoveryTerminalSnapshot(
            decoded,
            operation.recoveryId,
            repository.operationId,
            target.history.occurredAt,
          );
          if (
            terminal?.status === "prepared" &&
            terminal.bytes.equals(pending.bytes) &&
            validateStateTransition(
              before,
              terminal.bytes,
              repository.repositoryBinding,
            )
          ) {
            candidate = terminal.bytes;
            taskCandidate = undefined;
            stage = "terminal_checkpoint";
          }
        }
      } else if (!operation.history.confirmed) {
        const configuration = readHistoryRetentionDays(repository);
        if (configuration === null) throw new Error("history_config_invalid");
        recoveryRetentionDays = configuration;
        const historyInput = [
          before,
          currentHistoryRecoveryId,
          recoveryHistory?.bytes ?? Buffer.alloc(0),
          recoveryHistoryPending?.bytes ?? null,
          recoveryRetentionDays,
          repository.repositoryBinding,
        ] as const;
        const taskPublication =
          operation.kind === "docker_task"
            ? prepareRecoveredHistoryPublication(...historyInput, {
                current: { bytes: before, decoded },
              })
            : null;
        const publication =
          operation.kind === "docker_task"
            ? taskPublication
            : prepareRepairHistoryPublication(...historyInput);
        if (taskPublication) {
          taskCandidate = {
            bytes: taskPublication.snapshotBytes,
            decoded: taskPublication.decoded,
          };
          if (
            !pending &&
            !recoveryHistoryPending &&
            taskPublication.historyChanged
          )
            taskHistoryPublication = {
              recoveryId: operation.recoveryId,
              before: recoveryHistory?.bytes ?? null,
              retentionDays: configuration,
              candidate: taskPublication,
            };
        }
        candidate = publication?.snapshotBytes ?? null;
        stage = "publish";
        if (
          pending &&
          (recoveryHistoryPending || publication?.historyChanged !== false)
        )
          throw new Error("history_state_pending_order_invalid");
      } else {
        if (pending || recoveryHistoryPending)
          throw new Error("history_confirmed_pending_invalid");
        const line =
          operation.kind === "docker_task"
            ? operationHistoryLine(operation)
            : prepareRepairHistoryLine(
                before,
                currentHistoryRecoveryId,
                repository.repositoryBinding,
              );
        const rows = decodeHistoryRows(
          recoveryHistory?.bytes ?? Buffer.alloc(0),
        );
        const row = rows?.find(
          (item) => item.recoveryId === currentHistoryRecoveryId,
        );
        if (
          !line ||
          !rows ||
          (!row &&
            [...decoded.snapshot.unresolvedRecoveries].some(
              (item) => item.recoveryId === operation.recoveryId,
            )) ||
          (row && !Buffer.from(row.line).equals(line))
        )
          throw new Error("history_confirmed_line_invalid");
        candidate = before;
        stage = "confirmed";
      }
      if (
        !technicalState &&
        (!candidate || (pending && !pending.bytes.equals(candidate)))
      )
        throw new Error("history_reentry_candidate_mismatch");
      if (
        currentHistoryRecoveryId !== null &&
        !technicalState &&
        candidate &&
        stage
      ) {
        if (operation.kind === "docker_repair")
          repairHistoryState = "publication";
        currentHistoryPublication = Object.freeze({
          operationKind: operation.kind,
          before,
          candidate: Buffer.from(candidate),
          stage,
          needsWrite: stage !== "confirmed",
          historyFile:
            recoveryHistory === null
              ? null
              : {
                  bytes: Buffer.from(recoveryHistory.bytes),
                  identity: recoveryHistory.identity,
                },
          pendingHistoryFile:
            recoveryHistoryPending === null
              ? null
              : {
                  bytes: Buffer.from(recoveryHistoryPending.bytes),
                  identity: recoveryHistoryPending.identity,
                },
          retentionDays: recoveryRetentionDays,
          ...(storageOwner && borrowedOwner && taskCandidate
            ? {
                taskState: {
                  [taskHistoryKey]: true as const,
                  owner: storageOwner,
                  area: initial,
                  before: { bytes: before, decoded },
                  candidate: taskCandidate,
                  ...(taskHistoryPublication
                    ? { publication: taskHistoryPublication }
                    : {}),
                },
              }
            : {}),
        });
      }
    }
    if (recoveryId !== null) {
      const operation = decoded.snapshot.operations.find(
        (value) =>
          value.kind ===
            (currentHistoryRecoveryId !== null
              ? currentHistoryKind
              : "docker_task") && value.recoveryId === recoveryId,
      );
      if (
        !operation ||
        operation.kind === "host_operation" ||
        typeof repository.operationId !== "string" ||
        JSON.parse(operation.identityJson).operationId !==
          repository.operationId
      ) {
        reason = "coordinator_state_settlement_target_invalid";
        throw new Error("settlement_target");
      }
    }
    const taskHistoryReader =
      sameHistoryOwner && currentHistoryKind === "docker_task";
    const taskHistoryRetentionUnchanged =
      !taskHistoryReader ||
      recoveryRetentionDays === null ||
      readHistoryRetentionDays(repository) === recoveryRetentionDays;
    const finalFile = fs.lstatSync(file, { bigint: true });
    if (taskHistoryReader) assertTaskExecutionAreaCurrent(initial);
    const fresh = taskHistoryReader
      ? initial
      : observePhysicalExecutionDataArea(
          repository.repositoryRoot,
          "execution-model",
        );
    // 借用中のTask履歴では、同じ一覧を名前ごとに取得し直さない。
    const finalHistoryNames = taskHistoryReader
      ? fs.readdirSync(initial.directory)
      : null;
    const matchesReadFile = (file: string, previous: StableFileIdentity) => {
      const stat = fs.lstatSync(file, { bigint: true });
      return stat.nlink === 1n && sameStableFileIdentity(previous, stat);
    };
    if (
      (!sameHistoryOwner && (!repository.revalidate() || !lock.assertLive())) ||
      (
        [
          ["history.jsonl", recoveryHistory],
          ["history.pending.jsonl", recoveryHistoryPending],
        ] as const
      ).some(
        ([name, entry]) =>
          entry !== null &&
          !matchesReadFile(path.join(initial.directory, name), entry.identity),
      ) ||
      ((currentPublicationRecoveryId !== null || includeHistory) &&
        (names.includes("history.jsonl") !==
          (finalHistoryNames ?? fs.readdirSync(initial.directory)).includes(
            "history.jsonl",
          ) ||
          names.includes("history.pending.jsonl") !==
            (finalHistoryNames ?? fs.readdirSync(initial.directory)).includes(
              "history.pending.jsonl",
            ) ||
          !taskHistoryRetentionUnchanged ||
          (!taskHistoryReader &&
            recoveryRetentionDays !== null &&
            (() => {
              const config = readHistoryRetentionDays(repository);
              return config === null || config !== recoveryRetentionDays;
            })()))) ||
      !sameStableFileIdentity(observed.identity, finalFile) ||
      finalFile.nlink !== 1n ||
      fresh.status !== "ready" ||
      fresh.directory !== initial.directory ||
      fresh.boundaryIdentity !== initial.boundaryIdentity ||
      (completedHistory !== null &&
        !matchesReadFile(completedHistoryFile, completedHistory.identity)) ||
      (pending !== null && !matchesReadFile(pendingFile, pending.identity)) ||
      names.includes("state.pending.json") !==
        (finalHistoryNames ?? fs.readdirSync(initial.directory)).includes(
          "state.pending.json",
        ) ||
      (finalHistoryNames ?? fs.readdirSync(initial.directory)).some(
        (name) => !allowedNames.includes(name),
      )
    )
      throw new Error("changed");
    value = Object.freeze({
      ...decoded,
      sourceText: observed.bytes.toString("utf8"),
      operationStates: Object.freeze(
        decoded.snapshot.operations.map(projectOperationState),
      ),
    });
  } catch {
    value = null;
  }
  let lockReleased = false;
  if (!borrowedOwner) {
    try {
      lockReleased = ownedOwner?.release() === true;
    } catch {
      lockReleased = false;
    }
  } else if (!borrowStorageOwner(storageOwner, repository)) {
    return blocked("coordinator_state_owner_invalid", false);
  }
  if (!borrowedOwner && !lockReleased)
    return blocked("coordinator_state_lock_release_unconfirmed", false);
  if (!value)
    return borrowedOwner
      ? Object.freeze({ ...blocked(reason, false), ownerHeld: true as const })
      : blocked(reason, true);
  return Object.freeze({
    status: "completed" as const,
    reason: "coordinator_state_read_confirmed",
    lockReleased,
    ...(borrowedOwner ? { ownerHeld: true as const } : {}),
    value,
    operationCompletionConfirmed,
    currentHistoryPublication,
    repairHistoryState,
    currentCompletionPublication,
    repairCompletionAbsent,
    repairRetentionReviewAfter,
    resourcePublication,
    historyRows,
  });
}

/**
 * 同じ保存Ownerのまま現在本文を読み取る。
 * @responsibility Kernel再取得・解放なしの読取りを通常Readerの実体検査へ接続する。
 * @trace ARCH-000004、ARCH-000008
 * @input owner: このModuleが発行した保持中Owner。
 * @returns 読取り結果。借用時はownerHeld=true、lockReleased=false。
 * @precondition 呼出し元が同じOwnerの解放を必ず行う。
 * @postcondition 取得済みOwnerを入れ替えず、読取りで初期化しない。
 * @effect 検証済みRootと固定Fileの読取りだけ。
 * @failure 偽造・解放済み・別結合・観測不能は値なしの停止。
 * @invariant ownerHeldと解放済みを同一視しない。
 * @boundary 同じ短期排他内の保存利用側と現在Reader。
 * @security 入力OwnerのPropertyや関数を信用しない。
 * @concurrency 下位Readerは同じKernelを借用し再取得しない。
 */
export function readStorageSnapshotOwned(
  owner: unknown,
  taskPublicationRead: boolean | "history" = false,
) {
  const binding =
    owner && typeof owner === "object" ? readStorageOwnerBinding(owner) : null;
  if (!binding) return readStateSnapshot(null, null);
  return readStateSnapshot(
    binding.repository,
    null,
    null,
    null,
    "docker_task",
    "docker_task",
    true,
    null,
    null,
    owner as StorageOwner,
    taskPublicationRead,
  );
}

/**
 * Coordinator現在状態の保存途中から予定できる次処置を分類する。
 *
 * @responsibility 元版・次版のexact内容結合と初回条件を照合し、不明な状態を停止へ分類する。
 * @trace ARCH-000008
 * @input current: 正規Fileの閉じた観測、pending: 検証済みSnapshotの版・結合・exact bytes Hash、repositoryBinding: 期待するRepository結合、rootState: 初回Root条件の観測。
 * @returns publish_pending、remove_pendingまたはblockedという処置候補を返す。
 * @precondition 呼出し側がSnapshot全体を検証し、Hashをexact UTF-8 bytesから取得している。
 * @postcondition 元版結合または確定済み同内容の確認なしに処置候補を返さない。
 * @effect N/A: File、Lock、Process、Dockerを操作しない純粋な判定である。
 * @failure 不正な版、結合差、同版異内容、既知元版喪失、観測不能はblockedへ分類する。
 * @invariant 正規Fileの観測不能を不存在へ変換せず、履歴から旧状態を復元しない。
 * @boundary 検証済みSnapshotのIdentityと再入場処置候補の境界。全Snapshotの妥当性検証は所有しない。
 * @security 返却値は保存・削除・次EffectのAuthorityでも、cleanup成立の証明でもない。
 * @concurrency N/A: 排他を取得しない。利用側が同じ短期排他内でfresh観測と実処置を所有する。
 */
export function classifyExecutionSnapshotReentry(
  current:
    | Readonly<{
        status: "present";
        revision: number;
        repositoryBinding: string;
        payloadSha256: string;
      }>
    | Readonly<{ status: "absent" }>
    | Readonly<{ status: "unknown" }>,
  pending: Readonly<{
    revision: number;
    previous: Readonly<{ revision: number; payloadSha256: string }> | null;
    repositoryBinding: string;
    payloadSha256: string;
  }>,
  repositoryBinding: string,
  rootState: "new" | "existing" | "unknown",
) {
  if (
    repositoryBinding.length === 0 ||
    pending.repositoryBinding !== repositoryBinding ||
    !Number.isSafeInteger(pending.revision) ||
    pending.revision < 1 ||
    !/^[a-f0-9]{64}$/.test(pending.payloadSha256) ||
    (pending.previous === null
      ? pending.revision !== 1
      : !Number.isSafeInteger(pending.previous.revision) ||
        pending.previous.revision < 1 ||
        pending.previous.revision >= Number.MAX_SAFE_INTEGER ||
        pending.revision !== pending.previous.revision + 1 ||
        !/^[a-f0-9]{64}$/.test(pending.previous.payloadSha256))
  )
    return "blocked" as const;
  if (current.status === "unknown" || rootState === "unknown")
    return "blocked" as const;
  if (current.status === "absent")
    return pending.previous === null && rootState === "new"
      ? ("publish_pending" as const)
      : ("blocked" as const);
  if (
    current.repositoryBinding !== repositoryBinding ||
    !Number.isSafeInteger(current.revision) ||
    current.revision < 1 ||
    !/^[a-f0-9]{64}$/.test(current.payloadSha256)
  )
    return "blocked" as const;
  if (
    current.revision === pending.revision &&
    current.payloadSha256 === pending.payloadSha256
  )
    return "remove_pending" as const;
  if (
    pending.previous !== null &&
    current.revision === pending.previous.revision &&
    current.payloadSha256 === pending.previous.payloadSha256
  )
    return "publish_pending" as const;
  return "blocked" as const;
}

/** 固定保存ファイルの閉集合。 */
export type StateFileName =
  | "state.json"
  | "state.pending.json"
  | "history.jsonl"
  | "history.pending.jsonl";

/** 確定前の排他的作成を許す閉集合。 */
export type StatePendingFileName =
  | "state.pending.json"
  | "history.pending.jsonl";

/**
 * 同じ取引で観測した固定ファイルの実体と本文を読む。
 * @responsibility 観測不能と明示不存在、置換と同一実体を区別する。
 * @trace ARCH-000008
 * @input 検証済みdirectory、固定name、同じ取引のidentities、現在Owner照合。
 * @returns 安定したbyte又は初回の明示不存在null。
 * @precondition 呼出し側が短期排他を保持し、Mapを取引全体で共有する。
 * @postcondition 同名置換・既観測ファイルの消失を拒否する。
 * @effect metadataと本文を読み、既存Mapへ実体を記録する。
 * @failure 不正名・link・過大・置換・I/O故障は例外。nullへ畳まない。
 * @invariant 元の照合順序・例外を保持する。
 * @boundary 保存OwnerとFilesystem。領域を作成しない。
 * @security nameは型だけでなく実行時にも検査する。
 * @concurrency 呼出し前後のassertBoundaryを省略・キャッシュしない。
 */
export function readExecutionStateFile(
  directory: string,
  name: StateFileName,
  identities: Map<string, StableFileIdentity>,
  assertBoundary: () => void,
): Buffer | null {
  if (
    ![
      "state.json",
      "state.pending.json",
      "history.jsonl",
      "history.pending.jsonl",
    ].includes(name)
  )
    throw new Error("state_file_name_invalid");
  assertBoundary();
  const file = path.join(directory, name);
  let metadata: fs.BigIntStats;
  try {
    metadata = fs.lstatSync(file, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (identities.has(name)) throw new Error("file_disappeared");
    assertBoundary();
    return null;
  }
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1n)
    throw new Error("file");
  const observed = readStableFileSnapshot(file, metadata);
  const expected = identities.get(name);
  if (expected && !sameStableFileIdentity(expected, observed.identity))
    throw new Error("file_replaced");
  identities.set(name, observed.identity);
  assertBoundary();
  return observed.bytes;
}

/**
 * 固定された確定前ファイルを排他的に作成・flush・読戻しする。
 * @responsibility Effect発行前記録、wx、fsync、closeとexact byte確認を保持する。
 * @trace ARCH-000008
 * @input 同じ検証済み領域・Map・Owner照合と作成本文、Effect記録callback。
 * @returns 成功時はvoid。保存全体の成立・CAS成立は宣言しない。
 * @precondition 同じ短期排他を保持し、上位が失敗時の元回復参照を保全する。
 * @postcondition 既存ファイルを上書きせず、同じReaderで本文を再確認する。
 * @effect markEffect後にwx作成・書込み・flush・closeを行う。
 * @failure open・write・fsync・close・読戻し失敗を伝播し、残存を自動削除しない。
 * @invariant 作成失敗時も発行済みEffect記録を戻さない。
 * @boundary 保存OwnerとFilesystem。業務Schema・Authorityは解釈しない。
 * @security 任意ファイル名・正本の直接上書きを受け付けない。
 * @concurrency 同じMapを使う。読戻しの照合を省略せず、読取り専用の照合が渡された場合はそれを使う。
 */
export function createExecutionStatePendingFile(
  directory: string,
  name: StatePendingFileName,
  content: Buffer,
  identities: Map<string, StableFileIdentity>,
  assertBoundary: () => void,
  markEffect: () => void,
  assertReadBoundary = assertBoundary,
): void {
  if (!["state.pending.json", "history.pending.jsonl"].includes(name))
    throw new Error("state_pending_file_name_invalid");
  assertBoundary();
  markEffect();
  const fd = fs.openSync(path.join(directory, name), "wx", 0o600);
  try {
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
    identities.set(name, fs.fstatSync(fd, { bigint: true }));
  } finally {
    fs.closeSync(fd);
  }
  const saved = readExecutionStateFile(
    directory,
    name,
    identities,
    assertReadBoundary,
  );
  if (!saved?.equals(content)) throw new Error("readback");
}

/**
 * 出版直前の固定ファイルを同じ実体のdescriptorでflushする。
 * @responsibility 三つの既存出版箇所の照合・発行記録・closeの順序を保持する。
 * @trace ARCH-000008
 * @input 検証済み領域、固定対象名、実体Map、既存Ownerの照合・発行記録、単一Linkの追加照合要否。
 * @returns 成功時void。Snapshot確定や履歴成立は宣言しない。
 * @precondition 呼出し側が短期排他を保持し、本文と出版条件を確認済みである。
 * @postcondition 同じ実体をflushし、open成功時は必ずcloseを試みる。
 * @effect 履歴はfsync直前に発行記録する。状態pendingは既存作成時の記録を利用する。
 * @failure 欠測・置換・Owner失効とI/O例外を伝播し、自動清掃・再試行しない。
 * @invariant 対象ごとの期待Identity取得時点とOwner照合時点を変更しない。
 * @boundary 物理保存のみ。状態判断・CAS・一回使用証拠を解釈しない。
 * @security 対象名は実行時にも閉集合として検査する。
 * @concurrency 現在取引のMapとOwnerを使い、事前観測をキャッシュしない。
 */
export function flushExecutionStateFile(
  directory: string,
  name: "history.pending.jsonl" | "history.jsonl" | "state.pending.json",
  identities: Map<string, StableFileIdentity>,
  assertBoundary: () => void,
  markEffect: () => void,
  requireSingleLink = false,
): void {
  if (
    name !== "history.pending.jsonl" &&
    name !== "history.jsonl" &&
    name !== "state.pending.json"
  )
    throw new Error("state_flush_file_name_invalid");
  // 正本履歴だけは従来どおりopen前の期待実体を固定する。
  const canonicalIdentity =
    name === "history.jsonl" ? identities.get(name) : undefined;
  if (name !== "history.jsonl") assertBoundary();
  const descriptor = fs.openSync(path.join(directory, name), "r+");
  try {
    const expected =
      name === "history.jsonl" ? canonicalIdentity : identities.get(name);
    const opened = expected ? fs.fstatSync(descriptor, { bigint: true }) : null;
    if (
      !expected ||
      !opened ||
      (requireSingleLink && opened.nlink !== 1n) ||
      !sameStableFileIdentity(expected, opened)
    )
      throw new Error(
        name === "history.jsonl"
          ? "history_canonical_replaced"
          : name === "history.pending.jsonl"
            ? "history_pending_replaced"
            : "pending_replaced",
      );
    if (name === "history.jsonl") assertBoundary();
    if (name !== "state.pending.json") markEffect();
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

// 一回の保存呼出しのContextに候補・元版・Ownerを結合する。
// Writerで一度だけ消費し、publishRecoveryStateのfinallyで失効させる。
// 同じ履歴保存のLock内だけで使う、元本文と候補の検査結果。
const taskHistoryKey = Symbol("taskHistoryState");
type TaskHistoryState = Readonly<{
  [taskHistoryKey]: true;
  owner: StorageOwner;
  area: Extract<RepositoryExecutionDataAreaObservation, { status: "ready" }>;
  before: TaskHistorySnapshot;
  candidate: TaskHistorySnapshot;
  publication?: Readonly<{
    recoveryId: string;
    before: Buffer | null;
    retentionDays: number;
    candidate: NonNullable<
      ReturnType<typeof prepareRecoveredHistoryPublication>
    >;
  }>;
}>;

const settlements = new WeakMap<
  object,
  | {
      kind: "authentication_unknown_closure";
      repository: StorageRepository & { operationId: string };
      recoveryId: string;
      before: Buffer;
      candidate: Buffer;
      observations: unknown;
      assertOwner: () => boolean;
      used: boolean;
    }
  | {
      kind: "docker_repair";
      purpose: RepairWritePurpose;
      repository: StorageRepository & { operationId: string };
      recoveryId: string;
      before: Buffer | null;
      candidate: Buffer;
      assertOwner: () => boolean;
      assertFileOwner?: () => boolean;
      used: boolean;
      publication?: Readonly<{
        boundaryIdentity: string;
        files: ReadonlyMap<
          string,
          Readonly<{ bytes: Buffer; identity: StableFileIdentity }>
        >;
      }>;
    }
  | {
      kind: "current_completion";
      operationKind: "docker_task" | "docker_repair";
      repository: StorageRepository & { operationId: string };
      recoveryId: string;
      before: Buffer;
      candidate: Buffer;
      historyFile: Readonly<{
        bytes: Buffer;
        identity: StableFileIdentity;
      }> | null;
      assertOwner: () => boolean;
      used: boolean;
    }
  | {
      kind: "current_history";
      operationKind: "docker_task" | "docker_repair";
      repository: RecoveryHistoryRepository;
      recoveryId: string;
      before: Buffer;
      candidate: Buffer;
      stage: "checkpoint" | "publish" | "confirmed";
      taskState?: TaskHistoryState;
      historyFile: Readonly<{
        bytes: Buffer;
        identity: StableFileIdentity;
      }> | null;
      pendingHistoryFile: Readonly<{
        bytes: Buffer;
        identity: StableFileIdentity;
      }> | null;
      retentionDays: number | null;
      assertOwner: (
        expectedHistoryRetentionDays?: number,
        includeUnscopedRevalidation?: true,
      ) => boolean;
      used: boolean;
    }
>();

// exact新規領域と初回本文の証拠。準備・解放成功時は後続出版まで保持する。
// 解放失敗、既存の出版終了またはContext失効条件で削除し、既存領域へ再発行しない。
const initializations = new WeakMap<
  object,
  {
    repositoryBinding: string;
    boundaryIdentity: string;
    payloadSha256: string;
    publicationIssued: boolean;
  }
>();

// 同じ生存Ownerの履歴試行とpending候補を保持する。呼出し間の再入場に
// 必要なため毎回finallyでは消さず、Owner参照の寿命に従う。
// Process再起動後の保存正本や、元本文・File・設定のfresh照合の代替ではない。
const historyAttempts = new WeakMap<
  object,
  Map<
    string,
    {
      lineSha256: string;
      issued: boolean;
      pending: null | {
        before: Buffer;
        after: Buffer;
        beforeIdentity: StableFileIdentity | null;
        stateCandidate: Buffer;
        retentionDays: number;
        now: string;
      };
    }
  >
>();

/**
 * 現在呼出しの種別へ結合した初期本文を準備する。
 * @responsibility Taskと修復の資格を混同せず同じ領域作成・排他を再利用する。
 * @trace ARCH-000008
 * @input managementCapability: 私有の初期化Owner、repository: 検証済み結合、candidateBytes: 固定本文。
 * @returns 新規領域作成・準備・解放の観測。
 * @precondition 公開内部wrapperが種別別の真正Ownerを結合済み。
 * @postcondition 既存の空領域を初期化資格にしない。
 * @effect 既存Domain Ownerを通した固定領域作成だけ。
 * @failure Root・本文・Owner・解放不明は停止。
 * @invariant Task管理Capabilityを修復用に偽造しない。
 * @boundary 種別別保存Ownerと共通初期化I/O。
 * @security Repository借用だけで呼べる公開APIにしない。
 * @concurrency 既存の短期Kernel排他下で領域を作成する。
 */
function prepareStateInitialization(
  managementCapability: unknown,
  repository:
    | (Pick<
        NonNullable<ReturnType<typeof observeOperationRepository>>,
        "repositoryRoot" | "repositoryBinding" | "revalidate"
      > & { operationId?: string })
    | null,
  candidateBytes: unknown,
) {
  const initializationOwner =
    managementCapability &&
    typeof managementCapability === "object" &&
    settlements.get(managementCapability)?.kind === "docker_repair"
      ? managementCapability
      : executionStorageOperationIdentity(managementCapability);
  const candidate = repository
    ? decodeStateSnapshot(candidateBytes, repository.repositoryBinding)
    : null;
  if (
    !repository ||
    !candidate ||
    !managementCapability ||
    typeof managementCapability !== "object" ||
    !initializationOwner ||
    !validateStateTransition(
      null,
      candidateBytes,
      repository.repositoryBinding,
    ) ||
    initializations.has(initializationOwner) ||
    !initialStateOperationsMatch(candidate.snapshot, repository.operationId)
  )
    return Object.freeze({
      status: "blocked",
      effectIssued: false,
      lockReleased: true,
    });
  const acquisition = acquireStorageOwnerForRepository(repository);
  const storageOwner =
    acquisition.status === "completed" ? acquisition.value : null;
  const lock = storageOwner
    ? readStorageOwnerBinding(storageOwner)?.lock
    : null;
  if (!storageOwner || !lock)
    return Object.freeze({
      status: "blocked",
      effectIssued: false,
      lockReleased: false,
    });
  let effectIssued = false;
  let isPrepared = false;
  try {
    if (!repository.revalidate() || !lock.assertLive())
      throw new Error("owner");
    const created = createExecutionDataArea(repository.repositoryRoot);
    effectIssued = created.effectIssued;
    if (
      created.status !== "created" ||
      !repository.revalidate() ||
      !lock.assertLive()
    )
      throw new Error("created");
    initializations.set(initializationOwner, {
      repositoryBinding: repository.repositoryBinding,
      boundaryIdentity: created.observation.boundaryIdentity,
      payloadSha256: candidate.payloadSha256,
      publicationIssued: false,
    });
    isPrepared = true;
  } catch {
    isPrepared = false;
  }
  let lockReleased = false;
  try {
    lockReleased = storageOwner.release();
  } catch {
    lockReleased = false;
  }
  if (!lockReleased) initializations.delete(initializationOwner);
  return Object.freeze({
    status: isPrepared && lockReleased ? "prepared" : "blocked",
    effectIssued,
    lockReleased,
  });
}

/**
 * 最新現在状態の保存と同じpendingへの再入場を処置する。
 * @responsibility 保存確定と排他終了を別結果で返し、部分成功を隠さない。
 * @trace ARCH-000008
 * @input managementCapability: 現在操作Owner、candidateBytes: 次Snapshotの正規本文。
 * @returns status、保存確認、排他終了、Effect発行、試行版とHash、exact回復参照。
 * @precondition 操作OwnerとRepository結合を確認済み。
 * @postcondition 失敗・観測不能を成功や不存在にしない。
 * @effect 固定pending/stateの作成・置換・短命物回収だけ。
 * @failure 不一致やI/O失敗は例外で上位へ返す。
 * @invariant 本番Producerの全面切替やHost回収成立をこの保存だけから主張しない。
 * @boundary Coordinator現在状態とFilesystem。
 * @security 任意Pathや過去JSONから保存先を選択しない。
 * @concurrency 同じRepositoryの短期排他下で処置する。
 */
export function writeOwnedStateSnapshot(
  managementCapability: unknown,
  candidateBytes: unknown,
) {
  return writeStateSnapshot(
    managementCapability,
    observeOperationRepository(managementCapability),
    candidateBytes,
    null,
  );
}

/**
 * 現在Ownerがexact修復の短命出版だけを既存Writerへ結合する。
 * @responsibility 旧初期化Ownerを復元せず、保存途中の同じ本文だけを確定する。
 * @trace ARCH-000008
 * @input rootCapability: 検証Root、recoveryId: exact参照、assertInvocation: 現在呼出し確認。
 * @returns no_pending、または保存・Effect・排他確認を分離したWriter結果。
 * @precondition 明示修復入口内だけから呼び、技術再開は別に確認する。
 * @postcondition 観測不明をpending不存在へ変更しない。
 * @effect 固定保存物の読取り、既存Kernel排他、同じpendingの出版／回収だけ。
 * @failure 不正・実体差・Owner失効・解放不明は停止し再試行しない。
 * @invariant 通常初期化の新品証明・WeakMapを変更しない。
 * @boundary 修復compositionと現在Repositoryの保存途中材料。
 * @security 任意Path・候補本文・初期化許可boolを受け取らない。
 * @concurrency 読取りとWriterの両排他下で実体・全文を再照合する。
 */
export function resumeRepairRecordSave(
  rootCapability: unknown,
  recoveryId: string,
  assertInvocation: () => unknown,
) {
  const refused = () => writeStateSnapshot(null, null, null, null);
  const repository = observeExecutionRecoveryRepository(rootCapability);
  /**
   * metadata出版の現在Ownerだけを再確認する。
   * @responsibility 取消と保存Ownerを分離する。
   * @trace ARCH-000008
   * @input N/A: 現在Rootと同期確認を捕捉済み。
   * @returns 両方が同期trueの場合だけtrue。
   * @precondition 内部明示修復呼出し。
   * @postcondition JSONから旧Ownerを復元しない。
   * @effect Root／Revision観測と同期確認。
   * @failure 非同期・Proxy・例外・失効はfalse。
   * @invariant 出版許可は技術処置許可ではない。
   * @boundary 呼出しと保存Owner。
   * @security 未信頼thenableを実行しない。
   * @concurrency 同期確認。
   */
  const assertOwner = () => {
    try {
      if (
        !repository ||
        typeof assertInvocation !== "function" ||
        types.isProxy(assertInvocation) ||
        types.isAsyncFunction(assertInvocation)
      )
        return false;
      const value = assertInvocation();
      if (types.isPromise(value))
        void Promise.prototype.then.call(
          value,
          () => undefined,
          () => undefined,
        );
      return value === true && repository.revalidate();
    } catch {
      return false;
    }
  };
  if (!assertOwner() || !repository) return refused();
  const acquisition = acquireExecutionStateLock(
    repository.repositoryBinding,
    repository.repositoryRoot,
  );
  if (acquisition.status !== "acquired")
    return {
      ...refused(),
      reason: storageLockFailure(acquisition).reason,
      lockReleased: false,
    };
  const lock = acquisition.lock;
  let files: Map<string, ReturnType<typeof readStableFileSnapshot>> | null =
    null;
  let boundaryIdentity: string | null = null;
  let publication: ReturnType<typeof classifyRepairPublication> = null;
  let noPending = false;
  let lockReleased = false;
  try {
    if (!assertOwner() || !lock.assertLive()) throw new Error("owner");
    const area = observePhysicalExecutionDataArea(
      repository.repositoryRoot,
      "execution-model",
    );
    if (
      area.status !== "ready" ||
      area.repositoryRoot !== repository.repositoryRoot
    )
      throw new Error("area");
    boundaryIdentity = area.boundaryIdentity;
    const names = fs.readdirSync(area.directory).sort();
    if (
      names.some(
        (name) =>
          !["state.json", "state.pending.json", "history.jsonl"].includes(name),
      )
    )
      throw new Error("names");
    files = new Map();
    for (const name of names) {
      const file = path.join(area.directory, name);
      const stat = fs.lstatSync(file, { bigint: true });
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n)
        throw new Error("file");
      const value = readStableFileSnapshot(file);
      if (!sameStableFileIdentity(value.identity, stat))
        throw new Error("changed");
      files.set(name, value);
    }
    const current = files.get("state.json")?.bytes ?? null;
    const pending = files.get("state.pending.json")?.bytes ?? null;
    if (current && !decodeStateSnapshot(current, repository.repositoryBinding))
      throw new Error("current");
    const history = files.get("history.jsonl");
    if (history && !decodeHistoryRows(history.bytes))
      throw new Error("history");
    if (pending) {
      publication = classifyRepairPublication(
        current,
        pending,
        recoveryId,
        repository.repositoryBinding,
      );
      if (
        !publication ||
        (publication.mode === "initial_publication" &&
          names.join("|") !== "state.pending.json")
      )
        throw new Error("publication");
    } else {
      if (!current) throw new Error("current_absent");
      noPending = true;
    }
    for (const [name, previous] of files) {
      const file = path.join(area.directory, name);
      const value = readStableFileSnapshot(file);
      if (
        !sameStableFileIdentity(previous.identity, value.identity) ||
        !previous.bytes.equals(value.bytes) ||
        fs.lstatSync(file, { bigint: true }).nlink !== 1n
      )
        throw new Error("changed");
    }
    const final = observePhysicalExecutionDataArea(
      repository.repositoryRoot,
      "execution-model",
    );
    if (
      !assertOwner() ||
      !lock.assertLive() ||
      final.status !== "ready" ||
      final.boundaryIdentity !== boundaryIdentity ||
      JSON.stringify(fs.readdirSync(area.directory).sort()) !==
        JSON.stringify(names)
    )
      throw new Error("changed");
  } catch {
    files = null;
    publication = null;
    noPending = false;
  } finally {
    try {
      lockReleased = lock.release();
    } catch {
      lockReleased = false;
    }
  }
  if (!files || !boundaryIdentity || !lockReleased || !assertOwner())
    return { ...refused(), lockReleased };
  if (noPending)
    return {
      status: "no_pending" as const,
      snapshotConfirmed: false,
      filesystemEffectIssued: false,
      lockReleased: true,
    };
  if (!publication) return refused();
  const target = decodeStateSnapshot(
    publication.candidate,
    repository.repositoryBinding,
  )?.snapshot.operations.find((item) => item.recoveryId === recoveryId);
  if (target?.kind !== "docker_repair") return refused();
  const bound = Object.freeze({
    ...repository,
    operationId: JSON.parse(target.identityJson).operationId as string,
    revalidate: assertOwner,
  });
  return publishRecoveryState({
    kind: "docker_repair",
    purpose:
      publication.mode === "initial_publication" ||
      publication.mode === "identity" ||
      publication.mode === "remove_pending"
        ? "checkpoint"
        : publication.mode,
    repository: bound,
    recoveryId,
    before: publication.before,
    candidate: publication.candidate,
    assertOwner,
    publication: { boundaryIdentity, files },
  });
}

/**
 * 通常保存と終端限定保存の候補・用途・短期排他を準備する。
 * @responsibility 検証済み結合、限定差分と元版を固定し、取得済み排他をOwned確定へ渡す。
 * @trace ARCH-000008
 * @input managementCapability: 通常初期化Ownerまたはnull、repository: 検証済み借用、candidateBytes: 次本文、settlement: 終端制約またはnull。
 * @returns 取得前の停止結果、又は検証済み入力と取得済み排他の私有組。
 * @precondition 公開内部wrapperが借用を検証している。
 * @postcondition 終端経路から初期化・新要求・他操作変更を発行しない。
 * @effect 固定現在状態の読取りと既存短期排他の取得。候補の出版は行わない。
 * @failure 結合、差分、元版、保存または排他不明はblocked。
 * @invariant 旧形式fallbackと二重Writerを作らない。
 * @boundary Coordinator現在状態とFilesystem。
 * @security 任意PathやCaller supplied借用を受けない。
 * @concurrency 既存Repository単位排他を短期保持する。
 */
function prepareStateWrite(
  managementCapability: unknown,
  repository:
    | (Pick<
        NonNullable<ReturnType<typeof observeOperationRepository>>,
        "repositoryRoot" | "repositoryBinding" | "revalidate"
      > & { operationId?: string })
    | null,
  candidateBytes: unknown,
  settlement: {
    recoveryId: string;
    cleanupStatus: string | null;
    dockerTerminal: ExecutionTerminalStorageObservation | null;
    historyInitial?: true;
    historyPublish?: true;
    recoveryTerminal?: Readonly<{
      before: Buffer;
    }>;
    currentHistory?: object;
    currentCompletion?: object;
    consumer?: string;
    completion?: { before: Buffer; candidate: Buffer };
    managementCapability?: unknown;
  } | null,
  unissued?: Readonly<{
    recoveryId: string;
    purpose: string;
  }>,
  repairContext?: object,
  historyOwner?: StorageOwner,
) {
  const repairBinding = repairContext ? settlements.get(repairContext) : null;
  const currentRepair =
    repairBinding?.kind === "docker_repair" ? repairBinding : null;
  const currentAuthenticationClosure =
    repairBinding?.kind === "authentication_unknown_closure"
      ? repairBinding
      : null;
  const initializationOwner =
    repairContext ?? executionStorageOperationIdentity(managementCapability);
  const historyBinding = settlement?.currentHistory
    ? settlements.get(settlement.currentHistory)
    : null;
  const currentHistory =
    historyBinding?.kind === "current_history" ? historyBinding : null;
  const completionBinding = settlement?.currentCompletion
    ? settlements.get(settlement.currentCompletion)
    : null;
  const currentCompletion =
    completionBinding?.kind === "current_completion" ? completionBinding : null;
  const taskHistoryState = currentHistory?.taskState;
  const taskHistoryMatches =
    !taskHistoryState ||
    (taskHistoryState[taskHistoryKey] === true &&
      currentHistory?.operationKind === "docker_task" &&
      taskHistoryState.owner === historyOwner &&
      Buffer.isBuffer(candidateBytes) &&
      taskHistoryState.candidate.bytes.equals(candidateBytes) &&
      taskHistoryState.before.bytes.equals(currentHistory.before) &&
      taskHistoryState.before.decoded.snapshot.repositoryBinding ===
        repository?.repositoryBinding &&
      taskHistoryState.candidate.decoded.snapshot.repositoryBinding ===
        repository?.repositoryBinding);
  const candidate =
    repository && taskHistoryMatches && !settlement?.recoveryTerminal
      ? (taskHistoryState?.candidate.decoded ??
        decodeStateSnapshot(candidateBytes, repository.repositoryBinding))
      : null;
  const bytes = candidate
    ? (taskHistoryState?.candidate.bytes ??
      Buffer.from(`${encodeStateValue(candidate.snapshot)}\n`))
    : null;
  const attempt = {
    revision: candidate?.snapshot.revision ?? null,
    payloadSha256: candidate?.payloadSha256 ?? null,
    recoveryIds: Object.freeze(
      candidate?.snapshot.operations.map((operation) => operation.recoveryId) ??
        [],
    ),
  };
  if (
    !repository ||
    (settlement?.recoveryTerminal
      ? candidateBytes !== null ||
        !repository.operationId ||
        repairContext !== undefined ||
        unissued !== undefined ||
        managementCapability !== null ||
        settlement.cleanupStatus !== null ||
        settlement.dockerTerminal !== null ||
        settlement.currentHistory ||
        settlement.currentCompletion ||
        settlement.historyInitial ||
        settlement.historyPublish ||
        settlement.completion
      : !candidate || !bytes) ||
    (repairContext &&
      ((!currentRepair && !currentAuthenticationClosure) ||
        currentRepair?.used ||
        currentAuthenticationClosure?.used ||
        settlement !== null)) ||
    (settlement?.currentHistory && (!currentHistory || currentHistory.used)) ||
    (settlement?.currentCompletion &&
      (!currentCompletion || currentCompletion.used)) ||
    [currentHistory, currentCompletion].filter((value) => value !== null)
      .length > 1 ||
    !taskHistoryMatches
  )
    return Object.freeze({
      ...attempt,
      status: "blocked",
      reason: "coordinator_state_input_invalid",
      filesystemEffectIssued: false,
      snapshotConfirmed: false,
      lockReleased: true,
    });
  if (
    !currentAuthenticationClosure &&
    candidate &&
    bytes &&
    hasAuthenticationUnknownAbsence(candidate.snapshot)
  ) {
    // 私有pairは差分の基準であり保存資格ではない。元版・実体・Ownerは
    // 主Kernel内で必ず再検査する。一般入口だけは通常Readerを用いる。
    const fixedPairs = [
      currentHistory,
      currentCompletion,
      currentRepair,
      settlement?.completion,
    ].filter((pair) => pair !== null && pair !== undefined);
    let previousSnapshot: ExecutionStateSnapshot | null = null;
    let previousLockReleased = true;
    if (fixedPairs.length === 1) {
      const fixed = fixedPairs[0];
      if (fixed?.candidate.equals(bytes))
        previousSnapshot =
          taskHistoryState?.before.decoded.snapshot ??
          decodeStateSnapshot(fixed.before, repository.repositoryBinding)
            ?.snapshot ??
          null;
    } else if (fixedPairs.length === 0) {
      const previous = readStateSnapshot(repository, null);
      previousLockReleased = previous.lockReleased;
      if (previous.status === "completed" && previous.value)
        previousSnapshot = previous.value.snapshot;
    }
    if (
      !previousSnapshot ||
      !previousLockReleased ||
      authenticationUnknownAbsenceChanged(previousSnapshot, candidate.snapshot)
    )
      return Object.freeze({
        ...attempt,
        status: "blocked",
        reason: "coordinator_state_authentication_closure_owner_required",
        filesystemEffectIssued: false,
        snapshotConfirmed: false,
        lockReleased: previousLockReleased,
      });
  }
  const acquisition = historyOwner
    ? null
    : acquireStorageOwnerForRepository(repository);
  const storageOwner =
    historyOwner ??
    (acquisition?.status === "completed" ? acquisition.value : null);
  const historyOwnerBinding = historyOwner
    ? readStorageOwnerBinding(historyOwner, repository)
    : undefined;
  const lock = historyOwner
    ? currentHistory &&
      (historyOwnerBinding?.repository === currentHistory.repository
        ? historyOwnerBinding.lock
        : borrowStorageOwner(historyOwner, repository)?.lock)
    : storageOwner && readStorageOwnerBinding(storageOwner)?.lock;
  if (!storageOwner || !lock)
    return Object.freeze({
      ...attempt,
      status: "blocked",
      reason:
        acquisition?.status === "blocked"
          ? acquisition.reason
          : "coordinator_state_lock_unavailable",
      filesystemEffectIssued: false,
      snapshotConfirmed: false,
      lockReleased: false,
    });
  return {
    repository,
    candidate,
    bytes,
    settlement,
    unissued,
    currentRepair,
    currentAuthenticationClosure,
    initializationOwner,
    currentHistory,
    currentCompletion,
    attempt,
    storageOwner,
    lock,
    managementCapability,
  };
}

/**
 * 取得済み保存排他の中で候補を一箇所から物理確定する。
 * @responsibility 固定I/O、境界照合、pending、rename、読戻しを既存順で所有する。
 * @trace ARCH-000008
 * @input prepared: このModuleが検査・取得した私有準備結果。
 * @returns 保存Effect・本文確認・理由と履歴の確定値。排他解放は含めない。
 * @precondition 既存短期排他を保持し、呼出し側が解放を所有する。
 * @postcondition File確認と排他解放を別の事実として返す。
 * @effect 固定State・履歴Fileと短命Fileの既存I/O。
 * @failure 途中失敗は候補と元参照を保全し保存未確認を返す。
 * @invariant Contextの消費順と生存照合を変更しない。
 * @boundary 同じOwner内の保存確定。新Writerや同期層は作らない。
 * @security 私有準備結果・任意Path・外部callbackを公開しない。
 * @concurrency Lockを再取得・解放せず、保持中の固定I/Oだけを行う。
 */
function commitStateSnapshotOwned(
  prepared: Extract<ReturnType<typeof prepareStateWrite>, { lock: unknown }> & {
    hostPublication?: Readonly<{
      before: Buffer | null;
      value: unknown;
      initialBoundary: string | null;
    }>;
    corePublication?: Readonly<{
      before: Buffer;
      kind: Parameters<typeof prepareExecutionDefinitionChange>[1];
      request: unknown;
      initialSourceRevision: string | null;
    }>;
    taskPublication?: Readonly<{
      before: Buffer | null;
      view: unknown;
      facts: readonly Record<string, unknown>[];
      rootHash: string;
      initialBoundary: string | null;
    }>;
  },
) {
  const {
    repository,
    settlement,
    unissued,
    currentRepair,
    currentAuthenticationClosure,
    initializationOwner,
    currentHistory,
    currentCompletion,
    taskPublication,
    corePublication,
    hostPublication,
    lock,
  } = prepared;
  let { candidate, attempt } = prepared;
  let bytes: Buffer | null = prepared.bytes;
  const taskHistoryState = currentHistory?.taskState;
  if (currentHistory) currentHistory.used = true;
  if (currentCompletion) currentCompletion.used = true;
  if (currentRepair) currentRepair.used = true;
  if (currentAuthenticationClosure) currentAuthenticationClosure.used = true;
  let filesystemEffectIssued = false;
  let snapshotConfirmed = false;
  let reason = "coordinator_state_storage_unconfirmed";
  let initialHistoryLine: string | null = null;
  let historyAlreadyConfirmed = false;
  let terminalPrepared = false;
  // 同じLock内の安定した本文を候補生成に使い、確定前は現物のCASを行う。
  let preparedHistory: Readonly<{
    before: Buffer | null;
    pending: Buffer | null;
    historyBytes: Buffer;
    retentionDays: number;
  }> | null = null;
  let publishedHistoryRows: ReturnType<typeof decodeHistoryRows> = null;
  let taskHistoryPendingState: Buffer | null | undefined;
  let freshTaskHistory = false;
  let taskHistoryRetentionFixed = false;
  try {
    const boundOwner =
      initializationOwner && typeof initializationOwner === "object"
        ? readStorageOwnerBinding(initializationOwner)
        : null;
    const metadataOnly =
      boundOwner?.repository === repository &&
      boundOwner?.metadataOnly === true;
    const observeStorage = (
      initializing = false,
      verifiedArea?: Parameters<typeof observePhysicalExecutionDataArea>[2],
    ) => {
      if (initializing) {
        if (metadataOnly) throw new Error("metadata_initialization");
        assertExecutionStateInitializationBoundary(repository.repositoryRoot);
      }
      return observePhysicalExecutionDataArea(
        repository.repositoryRoot,
        "execution-model",
        verifiedArea,
      );
    };
    // Task履歴では同じ実発行OwnerをReader（初回固定後は前段Writer）から借りる。
    // ここは読取りだけ。処置・確定の直前にはLockを改めて検査する。
    if (!repository.revalidate() || (!taskHistoryState && !lock.assertLive()))
      throw new Error("owner");
    const initial = taskHistoryState?.area ?? observeStorage();
    if (
      initial.status !== "ready" ||
      initial.repositoryRoot !== repository.repositoryRoot
    )
      throw new Error("area");
    if (taskHistoryState) assertTaskExecutionAreaCurrent(initial);
    const directory = initial.directory;
    const fileIdentities = new Map<string, StableFileIdentity>();
    let initializationBoundaryRequired = false;
    const repairOwnsRevalidation =
      currentRepair?.assertOwner === repository.revalidate;
    const assertFileOwner = currentRepair?.assertFileOwner;
    /**
     * 保存I/Oの前後で同じ操作Ownerと領域を再確認する。
     * @responsibility Rootと.crddと保存領域の置換を拒否する。保持日数は履歴候補の判断と書込み側で確認する。
     * @trace ARCH-000008
     * @input mode: 読取りの入口・読取り区間・固定ファイルの読取り・物理処置と確定を分ける。
     * @returns N/A: 一致しなければ例外。
     * @precondition 操作OwnerとRepository結合を確認済み。
     * @postcondition 失敗・観測不能を成功や不存在にしない。
     * @effect 現在Rootと領域metadataの読取り。
     * @failure 不一致やI/O失敗は例外で上位へ返す。
     * @invariant LockだけをRoot実体の証明にしない。
     * @boundary Coordinator現在状態とFilesystem。
     * @security 任意Pathや過去JSONから保存先を選択しない。
     * @concurrency 同じRepositoryの短期排他下で処置する。
     */
    const assertBoundary = (
      mode: "effect" | "read" | "read-entry" | "read-group" = "effect",
    ) => {
      const fileRead = mode !== "effect" && assertFileOwner !== undefined;
      // 連続読取りでは固定ファイルと保存領域の実体を照合する。
      // 終端WriterのOwner・Lock・親領域は物理処置の直前にも確認する。
      const groupedFileRead =
        mode === "read" &&
        (currentHistory !== null || settlement?.recoveryTerminal !== undefined);
      const taskHistoryReadGroup =
        mode === "read-group" && taskHistoryState !== undefined;
      const groupedTaskHistoryEffect = mode === "effect" && freshTaskHistory;
      if (
        !groupedFileRead &&
        !taskHistoryReadGroup &&
        !groupedTaskHistoryEffect &&
        ((fileRead
          ? readExecutionStorageBinding(repository.repositoryRoot) !==
            repository.repositoryBinding
          : !repairOwnsRevalidation && !repository.revalidate()) ||
          (!currentHistory && !lock.assertLive()))
      )
        throw new Error("owner");
      if (
        currentRepair &&
        (fileRead ? assertFileOwner() : currentRepair.assertOwner()) !== true
      )
        throw new Error("repair_owner");
      if (currentCompletion && currentCompletion.assertOwner() !== true)
        throw new Error("current_completion_owner");
      if (
        mode === "effect" &&
        currentHistory &&
        currentHistory.retentionDays !== null
      ) {
        // 新規Task履歴の最初の書込み後は日数を固定し、Ownerと保存先は引き続き確認する。
        const current = groupedTaskHistoryEffect
          ? (taskHistoryRetentionFixed
              ? currentHistory.assertOwner()
              : currentHistory.assertOwner(
                  currentHistory.retentionDays,
                  true,
                )) === true
          : readHistoryRetentionDays(repository) ===
            currentHistory.retentionDays;
        if (!current) throw new Error("current_history_config_changed");
      }
      if (
        currentHistory &&
        mode !== "read-group" &&
        !groupedFileRead &&
        !lock.assertLive()
      )
        throw new Error("owner");
      // RootはOwnerが確認する。親の実体は区間単位、保存領域自身は各readで照合する。
      if (mode === "read-group") {
        const parent = fs.lstatSync(path.dirname(directory), { bigint: true });
        if (
          !parent.isDirectory() ||
          parent.isSymbolicLink() ||
          directoryIdentity(parent) !== initial.parentIdentity
        )
          throw new Error("history_read_parent_changed");
        return;
      }
      if (
        mode === "effect" &&
        (taskHistoryState || settlement?.recoveryTerminal)
      ) {
        assertTaskExecutionAreaCurrent(initial);
        return;
      }
      const observed = observeStorage(
        initializationBoundaryRequired,
        groupedFileRead ? initial : undefined,
      );
      if (
        observed.status !== "ready" ||
        observed.directory !== directory ||
        observed.boundaryIdentity !== initial.boundaryIdentity
      )
        throw new Error("boundary");
    };
    const assertReadBoundary = () => assertBoundary("read");
    // 履歴の連続読取りでは各Fileと親の実体を照合する。
    // TaskではOwner・Lock・設定の照合を物理処置と確定の境界で行う。
    // 修復では従来どおり読取り区間ごとにもOwnerを照合する。
    const assertHistoryReadGroup = () => {
      if (currentHistory) assertBoundary("read-group");
    };
    const assertCasFileIdentities = (
      names: readonly StateFileName[],
      absent: readonly StateFileName[] = [],
      groupedTaskWrite = false,
    ) => {
      if (!groupedTaskWrite && !currentHistory && !settlement?.recoveryTerminal)
        return;
      // 直前の境界確認でCAS対象が変わっていないかを本文の再読なしで確認する。
      for (const name of names) {
        const observed = fs.lstatSync(path.join(directory, name), {
          bigint: true,
        });
        const expected = fileIdentities.get(name);
        if (
          !expected ||
          !observed.isFile() ||
          observed.nlink !== 1n ||
          !sameStableFileIdentity(expected, observed)
        )
          throw new Error("history_write_cas_changed");
      }
      for (const name of absent) {
        if (
          fs.lstatSync(path.join(directory, name), {
            throwIfNoEntry: false,
          }) !== undefined
        )
          throw new Error("history_write_cas_changed");
      }
    };
    const observeRenamedFile = (
      name: "state.json" | "history.jsonl",
      source: StableFileIdentity | undefined,
      expectedBytes: Buffer,
    ) => {
      const file = path.join(directory, name);
      const stat = fs.lstatSync(file, { bigint: true });
      if (!source || !stat.isFile() || stat.nlink !== 1n)
        throw new Error("published_replaced");
      const renamed = { ...identity(stat), ctimeNs: source.ctimeNs };
      if (sameStableFileIdentity(source, renamed)) return stat;
      // Windowsでは置換先の名前に以前の作成時刻が引き継がれることがある。
      // 同じ実体で作成時刻だけが異なるときに限り、候補本文との照合で補う。
      if (
        process.platform !== "win32" ||
        !sameStableFileIdentity(source, {
          ...renamed,
          birthtimeNs: source.birthtimeNs,
        }) ||
        !readStableFileSnapshot(file, stat).bytes.equals(expectedBytes)
      )
        throw new Error("published_replaced");
      return stat;
    };
    /**
     * 固定Fileの明示不存在と安定本文を区別する。
     * @responsibility 通常File・nlink1・bounded本文と前後境界を照合する。
     * @trace ARCH-000008
     * @input name: 固定された保存File名。
     * @returns 安定byte列、または明示不存在のnull。
     * @precondition 操作OwnerとRepository結合を確認済み。
     * @postcondition 失敗・観測不能を成功や不存在にしない。
     * @effect 固定Fileの読取りだけ。
     * @failure 不一致やI/O失敗は例外で上位へ返す。
     * @invariant 観測不能や途中消失を不存在にしない。
     * @boundary Coordinator現在状態とFilesystem。
     * @security 任意Pathや過去JSONから保存先を選択しない。
     * @concurrency 同じRepositoryの短期排他下で処置する。
     */
    const read = (
      name:
        | "state.json"
        | "state.pending.json"
        | "history.jsonl"
        | "history.pending.jsonl",
      groupedTaskRead = false,
    ) => {
      return readExecutionStateFile(
        directory,
        name,
        fileIdentities,
        groupedTaskRead
          ? () => assertTaskExecutionAreaCurrent(initial)
          : assertReadBoundary,
      );
    };
    /**
     * 固定の短命Fileを排他的に作成してflushする。
     * @responsibility 既存File非上書きと保存途中の残存保持を所有する。
     * @trace ARCH-000008
     * @input name: pendingまたはlock、content: 確定本文。
     * @returns N/A: 作成とflushを実行する。
     * @precondition 操作OwnerとRepository結合を確認済み。
     * @postcondition 失敗・観測不能を成功や不存在にしない。
     * @effect 固定Fileのwx作成、書込み、fsync、close。
     * @failure 不一致やI/O失敗は例外で上位へ返す。
     * @invariant 失敗後にpendingを自動削除しない。
     * @boundary Coordinator現在状態とFilesystem。
     * @security 任意Pathや過去JSONから保存先を選択しない。
     * @concurrency 同じRepositoryの短期排他下で処置する。
     */
    const create = (
      name: "state.pending.json" | "history.pending.jsonl",
      content: Buffer,
    ) => {
      createExecutionStatePendingFile(
        directory,
        name,
        content,
        fileIdentities,
        assertBoundary,
        () => {
          // createは直前に保持設定・Owner・Lockを確認済み。固定値はこのWriterだけで使う。
          if (
            name === "history.pending.jsonl" &&
            freshTaskHistory &&
            taskHistoryState?.publication &&
            currentHistory?.repository.revalidateRetention !== undefined
          )
            taskHistoryRetentionFixed = true;
          filesystemEffectIssued = true;
        },
        assertReadBoundary,
      );
    };
    // 現在履歴では、このWriterの開始時点で同じOwner・Lock・領域を既に確認した。
    if (!currentHistory && !settlement?.recoveryTerminal)
      assertBoundary("read-entry");
    const names = fs.readdirSync(directory);
    if (
      names.some(
        (name) =>
          ![
            "state.json",
            "state.pending.json",
            "history.jsonl",
            "history.pending.jsonl",
          ].includes(name),
      )
    )
      throw new Error("unknown_content");
    let currentBytes = read("state.json");
    initializationBoundaryRequired = currentBytes === null;
    if (initializationBoundaryRequired) assertBoundary();
    let current =
      currentBytes === null
        ? null
        : taskHistoryState
          ? taskHistoryState.before.bytes.equals(currentBytes)
            ? taskHistoryState.before.decoded
            : null
          : decodeStateSnapshot(currentBytes, repository.repositoryBinding);
    if (currentBytes !== null && !current) throw new Error("current");
    const recoveryTerminal = settlement?.recoveryTerminal;
    let terminalPending: Buffer | null = null;
    if (recoveryTerminal) {
      const recoveryId = settlement.recoveryId;
      if (!current || !currentBytes?.equals(recoveryTerminal.before))
        throw new Error("recovery_terminal_scope_invalid");
      terminalPending = names.includes("state.pending.json")
        ? read("state.pending.json")
        : null;
      if (names.includes("state.pending.json") && !terminalPending)
        throw new Error("recovery_terminal_pending_invalid");
      const pendingCandidate = terminalPending
        ? decodeStateSnapshot(terminalPending, repository.repositoryBinding)
        : null;
      const pendingOperation = pendingCandidate?.snapshot.operations.find(
        (item): item is ExecutionOperationRecord =>
          item.kind === "docker_task" && item.recoveryId === recoveryId,
      );
      const terminal = prepareRecoveryTerminalSnapshot(
        current,
        recoveryId,
        repository.operationId,
        pendingOperation?.history?.occurredAt ?? new Date().toISOString(),
      );
      if (!terminal) throw new Error("recovery_terminal_candidate_invalid");
      if (terminal.status === "unchanged") {
        // 既存の履歴途中保存は同じLockで用途限定Readerを通し、ここでは確定しない。
        if (
          (terminalPending || names.includes("history.pending.jsonl")) &&
          readStateSnapshot(
            repository,
            recoveryId,
            recoveryId,
            null,
            "docker_task",
            "docker_task",
            false,
            null,
            null,
            prepared.storageOwner,
          ).status !== "completed"
        )
          throw new Error("recovery_terminal_pending_invalid");
        assertBoundary();
        assertCasFileIdentities(["state.json"]);
        const observedNames = fs.readdirSync(directory);
        if (
          observedNames.length !== names.length ||
          observedNames.some((name) => !names.includes(name))
        )
          throw new Error("recovery_terminal_pending_invalid");
        return {
          filesystemEffectIssued,
          snapshotConfirmed: true,
          reason: "coordinator_state_snapshot_confirmed",
          initialHistoryLine,
          attempt: {
            revision: current.snapshot.revision,
            payloadSha256: current.payloadSha256,
            recoveryIds: Object.freeze([recoveryId]),
          },
        };
      }
      if (names.includes("history.pending.jsonl"))
        throw new Error("recovery_terminal_history_pending");
      const history = read("history.jsonl");
      const rows = decodeHistoryRows(history ?? Buffer.alloc(0));
      if (
        (names.includes("history.jsonl") && !history) ||
        !rows ||
        rows.some((row) => row.recoveryId === recoveryId)
      )
        throw new Error("recovery_terminal_history_invalid");
      if (
        terminalPending &&
        (!pendingOperation?.history ||
          pendingOperation.history.confirmed ||
          !terminal.bytes.equals(terminalPending))
      )
        throw new Error("recovery_terminal_pending_invalid");
      bytes = terminal.bytes;
      candidate =
        pendingCandidate ??
        decodeStateSnapshot(bytes, repository.repositoryBinding);
      if (!candidate) throw new Error("candidate");
      attempt = {
        revision: candidate.snapshot.revision,
        payloadSha256: candidate.payloadSha256,
        recoveryIds: Object.freeze(
          candidate.snapshot.operations.map((item) => item.recoveryId),
        ),
      };
      terminalPrepared = true;
    }
    if (!candidate || !bytes) throw new Error("candidate");
    if (currentAuthenticationClosure) {
      const bound = currentAuthenticationClosure;
      const beforeTasks = current?.snapshot.operations.filter(
        (item): item is ExecutionOperationRecord =>
          item.kind === "docker_task" && item.recoveryId === bound.recoveryId,
      );
      const candidateTasks = candidate.snapshot.operations.filter(
        (item): item is ExecutionOperationRecord =>
          item.kind === "docker_task" && item.recoveryId === bound.recoveryId,
      );
      const expected = prepareAuthenticationUnknownClosureSnapshot(
        bound.before,
        bound.recoveryId,
        bound.observations,
        repository.repositoryBinding,
      );
      if (
        bound.repository.repositoryRoot !== repository.repositoryRoot ||
        bound.repository.repositoryBinding !== repository.repositoryBinding ||
        bound.repository.operationId !== repository.operationId ||
        beforeTasks?.length !== 1 ||
        candidateTasks.length !== 1 ||
        beforeTasks[0]?.identityJson !== candidateTasks[0]?.identityJson ||
        JSON.parse(beforeTasks[0]?.identityJson ?? "null")?.operationId !==
          repository.operationId ||
        JSON.parse(candidateTasks[0]?.identityJson ?? "null")?.operationId !==
          repository.operationId ||
        !currentBytes?.equals(bound.before) ||
        !bytes.equals(bound.candidate) ||
        !expected?.equals(bytes) ||
        bound.assertOwner() !== true
      )
        throw new Error("authentication_closure_context");
    } else if (
      authenticationUnknownAbsenceChanged(
        current?.snapshot ?? null,
        candidate.snapshot,
      )
    ) {
      throw new Error("authentication_closure_owner_required");
    }
    let repairPublication: ReturnType<typeof classifyRepairPublication> = null;
    if (currentRepair?.publication) {
      const observed = currentRepair.publication;
      if (
        initial.boundaryIdentity !== observed.boundaryIdentity ||
        JSON.stringify([...observed.files.keys()].sort()) !==
          JSON.stringify([...names].sort())
      )
        throw new Error("publication_boundary");
      for (const [name, previous] of observed.files) {
        const value = read(
          name as "state.json" | "state.pending.json" | "history.jsonl",
        );
        const identity = fileIdentities.get(name);
        if (
          !value?.equals(previous.bytes) ||
          !identity ||
          !sameStableFileIdentity(previous.identity, identity)
        )
          throw new Error("publication_file_changed");
      }
      const pending = read("state.pending.json");
      if (!pending) throw new Error("publication_missing");
      repairPublication = classifyRepairPublication(
        currentBytes,
        pending,
        currentRepair.recoveryId,
        repository.repositoryBinding,
      );
      if (
        !repairPublication?.candidate.equals(bytes) ||
        (!["initial_publication", "identity", "remove_pending"].includes(
          repairPublication.mode,
        ) &&
          repairPublication.mode !== currentRepair.purpose) ||
        (repairPublication.mode === "initial_publication" &&
          names.sort().join("|") !== "state.pending.json")
      )
        throw new Error("publication_invalid");
    }
    if (currentRepair) {
      const target = candidate.snapshot.operations.find(
        (operation) => operation.recoveryId === currentRepair.recoveryId,
      );
      const beforeTarget = current?.snapshot.operations.find(
        (operation) => operation.recoveryId === currentRepair.recoveryId,
      );
      if (
        currentRepair.repository.repositoryRoot !== repository.repositoryRoot ||
        currentRepair.repository.repositoryBinding !==
          repository.repositoryBinding ||
        currentRepair.repository.operationId !== repository.operationId ||
        !bytes.equals(currentRepair.candidate) ||
        (currentRepair.before === null
          ? currentBytes !== null
          : !currentBytes?.equals(currentRepair.before)) ||
        target?.kind !== "docker_repair" ||
        (beforeTarget && beforeTarget.kind !== "docker_repair") ||
        target.summarySha256 !== (beforeTarget?.summarySha256 ?? null) ||
        encodeStateValue(target.history) !==
          encodeStateValue(beforeTarget?.history ?? null) ||
        JSON.parse(target.identityJson).operationId !==
          repository.operationId ||
        (beforeTarget && beforeTarget.identityJson !== target.identityJson) ||
        encodeStateValue(
          current?.snapshot.operations.filter(
            (operation) => operation.recoveryId !== currentRepair.recoveryId,
          ) ?? [],
        ) !==
          encodeStateValue(
            candidate.snapshot.operations.filter(
              (operation) => operation.recoveryId !== currentRepair.recoveryId,
            ),
          ) ||
        encodeStateValue(current?.snapshot.unresolvedRecoveries ?? []) !==
          encodeStateValue(candidate.snapshot.unresolvedRecoveries) ||
        (!currentRepair.assertFileOwner && currentRepair.assertOwner() !== true)
      )
        throw new Error("repair_writer_scope_invalid");
      if (currentRepair.assertFileOwner) assertReadBoundary();
    }
    if (corePublication) {
      const expected = prepareExecutionDefinitionChange(
        corePublication.before,
        corePublication.kind,
        corePublication.request,
        repository.repositoryBinding,
        corePublication.initialSourceRevision,
      );
      if (
        taskPublication ||
        hostPublication ||
        settlement ||
        currentRepair ||
        currentHistory ||
        currentCompletion ||
        !currentBytes?.equals(corePublication.before) ||
        expected.status !== "prepared" ||
        !expected.bytes.equals(bytes) ||
        !validateUnifiedTransition(
          currentBytes,
          bytes,
          repository.repositoryBinding,
        )
      )
        throw new Error("core_publication_scope_invalid");
    }
    if (hostPublication) {
      const expected = prepareStateHostOperationSnapshot(
        hostPublication.before,
        hostPublication.value,
        repository.repositoryBinding,
      );
      if (
        taskPublication ||
        corePublication ||
        settlement ||
        currentRepair ||
        currentHistory ||
        currentCompletion ||
        !expected?.equals(bytes) ||
        (hostPublication.before === null
          ? currentBytes !== null ||
            hostPublication.initialBoundary !== initial.boundaryIdentity
          : !currentBytes?.equals(hostPublication.before))
      )
        throw new Error("host_publication_scope_invalid");
    }
    let completionConfirmed = false;
    let savedTerminalConfirmed = false;
    let repairHistoryScopeConfirmed = false;
    if (taskPublication) {
      // 候補作成に元版を再利用しても、書込み時の履歴途中物は通常保存で受け付けない。
      if (names.includes("history.pending.jsonl"))
        throw new Error("task_publication_history_pending");
      const same = currentBytes?.equals(bytes) === true;
      if (
        !same &&
        (taskPublication.before === null
          ? currentBytes !== null ||
            taskPublication.initialBoundary !== initial.boundaryIdentity ||
            candidate.snapshot.operations.length !== 0 ||
            candidate.snapshot.projects.length !== 0 ||
            candidate.snapshot.queueEntries.length !== 0 ||
            !validateDecodedUnifiedTransition(null, candidate)
          : !current ||
            !currentBytes?.equals(taskPublication.before) ||
            !prepareUnifiedTaskSections(
              current,
              taskPublication.view,
              taskPublication.rootHash,
              taskPublication.facts,
            )?.equals(bytes))
      )
        throw new Error("task_publication_scope_invalid");
      const projected = projectTaskSnapshot(
        candidate,
        taskPublication.rootHash,
      );
      if (
        encodeStateValue(projected) !== encodeStateValue(taskPublication.view)
      )
        throw new Error("task_publication_view_invalid");
      for (const fact of taskPublication.facts) {
        const task = candidate.snapshot.managedExecutions
          .find((p) => p.projectId === fact.projectId)
          ?.tasks.find(
            (t) =>
              t.taskId === fact.taskId &&
              t.attemptId === fact.attemptId &&
              t.operationId === fact.operationId,
          );
        if (
          !task ||
          (task.settlement.kind === "operations"
            ? task.settlement.resultUnresolved
            : task.settlement.kind === "executor_result"
              ? task.settlement.recoveryUnresolved
              : false) !== fact.recoveryUnresolved
        )
          throw new Error("task_result_fact_invalid");
      }
      for (const operation of current?.snapshot.operations ?? []) {
        if (
          candidate.snapshot.operations.some(
            (o) => o.recoveryId === operation.recoveryId,
          )
        )
          continue;
        const line = currentBytes
          ? prepareStateHistoryLine(
              currentBytes,
              operation.recoveryId,
              repository.repositoryBinding,
            )
          : null;
        const rows = decodeHistoryRows(
          read("history.jsonl") ?? Buffer.alloc(0),
        );
        if (
          !line ||
          !rows?.some(
            (row) =>
              row.recoveryId === operation.recoveryId &&
              Buffer.from(row.line).equals(line),
          )
        )
          throw new Error("task_operation_history_unconfirmed");
      }
      completionConfirmed = true;
      savedTerminalConfirmed = true;
    }
    if (currentCompletion) {
      const history = read("history.jsonl"),
        expectedHistory = currentCompletion.historyFile;
      const historyIdentity = fileIdentities.get("history.jsonl") ?? null;
      if (
        !settlement ||
        currentCompletion.repository.repositoryRoot !==
          repository.repositoryRoot ||
        currentCompletion.repository.repositoryBinding !==
          repository.repositoryBinding ||
        currentCompletion.repository.operationId !== repository.operationId ||
        currentCompletion.recoveryId !== settlement.recoveryId ||
        !current ||
        !currentBytes?.equals(currentCompletion.before) ||
        !bytes.equals(currentCompletion.candidate) ||
        currentCompletion.assertOwner() !== true ||
        settlement.currentHistory ||
        settlement.completion ||
        settlement.historyInitial ||
        settlement.historyPublish ||
        settlement.managementCapability ||
        settlement.cleanupStatus !== null ||
        settlement.dockerTerminal !== null ||
        read("history.pending.jsonl") !== null ||
        (expectedHistory === null
          ? history !== null
          : !history ||
            !historyIdentity ||
            !history.equals(expectedHistory.bytes) ||
            !sameStableFileIdentity(expectedHistory.identity, historyIdentity))
      )
        throw new Error("current_completion_scope_invalid");
      const operation = current.snapshot.operations.find(
        (item) =>
          item.kind === currentCompletion.operationKind &&
          item.recoveryId === settlement.recoveryId,
      );
      const identity =
        operation && operation.kind !== "host_operation"
          ? JSON.parse(operation.identityJson)
          : null;
      const expected = (
        currentCompletion.operationKind === "docker_repair"
          ? prepareStateRepairCompletionSnapshot
          : prepareStateCompletionSnapshot
      )(currentBytes, settlement.recoveryId, repository.repositoryBinding);
      const line = (
        currentCompletion.operationKind === "docker_repair"
          ? prepareRepairHistoryLine
          : prepareStateHistoryLine
      )(currentBytes, settlement.recoveryId, repository.repositoryBinding);
      const rows = decodeHistoryRows(history ?? Buffer.alloc(0));
      const row = rows?.find(
        (item) => item.recoveryId === settlement.recoveryId,
      );
      if (
        operation?.kind === "host_operation" ||
        !operation?.history?.confirmed ||
        identity?.operationId !== repository.operationId ||
        !expected?.equals(bytes) ||
        !line ||
        !rows ||
        (currentCompletion.operationKind === "docker_repair" && !row) ||
        createHash("sha256").update(line).digest("hex") !==
          operation.history.lineSha256 ||
        (row && !Buffer.from(row.line).equals(line)) ||
        currentCompletion.assertOwner() !== true
      )
        throw new Error("current_completion_candidate_invalid");
      completionConfirmed = true;
      savedTerminalConfirmed = true;
    } else if (currentHistory) {
      // 初回の空履歴だけ、二つの不存在観測の前後で保存領域を一度ずつ照合する。
      // 各名前は実際に観測し、途中ファイルのある再開では従来の読取りを維持する。
      const emptyTaskHistory =
        taskHistoryState !== undefined &&
        currentHistory.stage === "publish" &&
        currentHistory.historyFile === null &&
        currentHistory.pendingHistoryFile === null &&
        !names.includes("state.pending.json") &&
        !names.includes("history.jsonl") &&
        !names.includes("history.pending.jsonl");
      let observedHistory: Buffer | null = null;
      let observedPendingHistory: Buffer | null = null;
      if (emptyTaskHistory) {
        assertReadBoundary();
        assertCasFileIdentities([], ["history.jsonl", "history.pending.jsonl"]);
        assertReadBoundary();
      } else {
        observedHistory = read("history.jsonl");
        observedPendingHistory = read("history.pending.jsonl");
      }
      for (const [name, actual, expected] of [
        ["history.jsonl", observedHistory, currentHistory.historyFile],
        [
          "history.pending.jsonl",
          observedPendingHistory,
          currentHistory.pendingHistoryFile,
        ],
      ] as const) {
        const identity = fileIdentities.get(name) ?? null;
        if (
          expected === null
            ? actual !== null
            : actual === null ||
              identity === null ||
              !actual.equals(expected.bytes) ||
              !sameStableFileIdentity(expected.identity, identity)
        )
          throw new Error("current_history_file_changed");
      }
      if (
        !settlement ||
        settlement.recoveryId !== currentHistory.recoveryId ||
        repository.repositoryRoot !==
          currentHistory.repository.repositoryRoot ||
        repository.repositoryBinding !==
          currentHistory.repository.repositoryBinding ||
        repository.operationId !== currentHistory.repository.operationId ||
        settlement.cleanupStatus !== null ||
        settlement.dockerTerminal !== null ||
        settlement.completion ||
        settlement.historyInitial ||
        settlement.historyPublish ||
        settlement.managementCapability ||
        currentHistory.assertOwner() !== true ||
        !currentBytes?.equals(currentHistory.before) ||
        !bytes.equals(currentHistory.candidate) ||
        !current
      )
        throw new Error("current_history_scope_invalid");
      const operation = current.snapshot.operations.find(
        (item) =>
          item.kind === currentHistory.operationKind &&
          item.recoveryId === settlement.recoveryId,
      );
      const target = candidate.snapshot.operations.find(
        (item) =>
          item.kind === currentHistory.operationKind &&
          item.recoveryId === settlement.recoveryId,
      );
      if (
        !operation ||
        !target ||
        operation.kind === "host_operation" ||
        target.kind === "host_operation" ||
        JSON.parse(operation.identityJson).operationId !==
          repository.operationId ||
        JSON.parse(target.identityJson).operationId !== repository.operationId
      )
        throw new Error("current_history_operation_invalid");
      let expected: Buffer | null = null;
      if (currentHistory.stage === "checkpoint") {
        assertHistoryReadGroup();
        if (
          operation?.history !== null ||
          !target?.history ||
          target.history.confirmed
        )
          throw new Error("current_history_checkpoint_invalid");
        expected = taskHistoryState
          ? (prepareTaskHistorySnapshot(
              current,
              settlement.recoveryId,
              target.history.occurredAt,
              false,
              repository.repositoryBinding,
              taskHistoryState.candidate,
            )?.bytes ?? null)
          : (currentHistory.operationKind === "docker_repair"
              ? prepareRepairHistorySnapshot
              : prepareStateHistorySnapshot)(
              currentBytes,
              settlement.recoveryId,
              target.history.occurredAt,
              false,
              repository.repositoryBinding,
            );
        if (observedPendingHistory !== null)
          throw new Error("current_history_checkpoint_order_invalid");
      } else if (currentHistory.stage === "publish") {
        const observedPublication = taskHistoryState?.publication;
        // 同じLockのReaderで作った新規追記候補は、確認済みの日数で照合する。
        // 保存先の現在性と、物理処置直前の保持設定の照合は残す。
        const config =
          observedPublication &&
          currentHistory.repository.revalidateRetention !== undefined
            ? repository.revalidate() === true
              ? observedPublication.retentionDays
              : null
            : readHistoryRetentionDays(repository);
        if (config === null || config !== currentHistory.retentionDays)
          throw new Error("current_history_config_invalid");
        assertHistoryReadGroup();
        const before = observedHistory;
        const pending = observedPendingHistory;
        if (
          observedPublication &&
          (observedPublication.recoveryId !== settlement.recoveryId ||
            observedPublication.retentionDays !== config ||
            pending !== null ||
            (observedPublication.before === null
              ? before !== null
              : !before?.equals(observedPublication.before)))
        )
          throw new Error("current_history_publication_changed");
        const historyInput = [
          currentBytes,
          settlement.recoveryId,
          before ?? Buffer.alloc(0),
          pending,
          config,
          repository.repositoryBinding,
        ] as const;
        const publication =
          currentHistory.operationKind === "docker_repair"
            ? prepareRepairHistoryPublication(...historyInput)
            : (observedPublication?.candidate ??
              prepareRecoveredHistoryPublication(
                ...historyInput,
                taskHistoryState
                  ? {
                      current: taskHistoryState.before,
                      candidate: taskHistoryState.candidate,
                    }
                  : undefined,
              ));
        const observedPendingState = read("state.pending.json");
        if (taskHistoryState) taskHistoryPendingState = observedPendingState;
        if (
          observedPendingState !== null &&
          publication?.historyChanged !== false
        )
          throw new Error("current_history_state_pending_order_invalid");
        expected = publication?.snapshotBytes ?? null;
        if (publication)
          preparedHistory = {
            before,
            pending,
            historyBytes: publication.historyBytes,
            retentionDays: config,
          };
      } else {
        assertHistoryReadGroup();
        if (
          !operation?.history?.confirmed ||
          read("history.pending.jsonl") !== null ||
          read("state.pending.json") !== null
        )
          throw new Error("current_history_confirmed_invalid");
        const line = (
          currentHistory.operationKind === "docker_repair"
            ? prepareRepairHistoryLine
            : prepareStateHistoryLine
        )(currentBytes, settlement.recoveryId, repository.repositoryBinding);
        const rows = decodeHistoryRows(
          read("history.jsonl") ?? Buffer.alloc(0),
        );
        const row = rows?.find(
          (item) => item.recoveryId === settlement.recoveryId,
        );
        if (!line || !rows || (row && !Buffer.from(row.line).equals(line)))
          throw new Error("current_history_line_invalid");
        expected = currentBytes;
      }
      if (!expected?.equals(bytes) || currentHistory.assertOwner() !== true)
        throw new Error("current_history_candidate_invalid");
      assertHistoryReadGroup();
      repairHistoryScopeConfirmed =
        currentHistory.operationKind === "docker_repair";
      savedTerminalConfirmed = true;
    } else if (settlement?.completion) {
      const before = decodeStateSnapshot(
        settlement.completion.before,
        repository.repositoryBinding,
      );
      const previous = before?.snapshot.operations.find(
        (operation): operation is ExecutionOperationRecord =>
          operation.kind === "docker_task" &&
          operation.recoveryId === settlement.recoveryId,
      );
      const expected = prepareStateCompletionSnapshot(
        settlement.completion.before,
        settlement.recoveryId,
        repository.repositoryBinding,
      );
      if (
        !before ||
        !previous ||
        JSON.parse(previous.identityJson).operationId !==
          repository.operationId ||
        !expected?.equals(bytes) ||
        !settlement.completion.candidate.equals(bytes) ||
        !(
          currentBytes?.equals(settlement.completion.before) ||
          currentBytes?.equals(bytes)
        ) ||
        !settlement.cleanupStatus ||
        !settlement.dockerTerminal?.homeLeaseReleased ||
        !settlement.dockerTerminal.recoveryCompleted ||
        settlement.historyInitial ||
        settlement.historyPublish
      )
        throw new Error("completion_scope_unconfirmed");
      const observed = prepareStateCleanupSnapshot(
        settlement.completion.before,
        settlement.recoveryId,
        {
          snapshot: settlement.dockerTerminal.resourceSnapshot,
          observations: settlement.dockerTerminal.resources,
        },
        repository.repositoryBinding,
      );
      const observedOperation = observed
        ? decodeStateSnapshot(
            observed,
            repository.repositoryBinding,
          )?.snapshot.operations.find(
            (operation): operation is ExecutionOperationRecord =>
              operation.kind === "docker_task" &&
              operation.recoveryId === settlement.recoveryId,
          )
        : null;
      if (
        !observedOperation ||
        encodeStateValue(observedOperation.resources) !==
          encodeStateValue(previous.resources)
      )
        throw new Error("completion_terminal_or_acceptance_unconfirmed");
      const fixedLine = prepareStateHistoryLine(
        settlement.completion.before,
        settlement.recoveryId,
        repository.repositoryBinding,
      );
      const rows = decodeHistoryRows(read("history.jsonl") ?? Buffer.alloc(0));
      const row = rows?.find(
        (entry) => entry.recoveryId === settlement.recoveryId,
      );
      if (
        !fixedLine ||
        !previous.history?.confirmed ||
        !rows ||
        createHash("sha256").update(fixedLine).digest("hex") !==
          previous.history.lineSha256 ||
        (row !== undefined && !Buffer.from(row.line).equals(fixedLine)) ||
        read("history.pending.jsonl") !== null
      )
        throw new Error("completion_history_unconfirmed");
      completionConfirmed = true;
    }
    historyAlreadyConfirmed =
      settlement?.historyPublish === true &&
      currentBytes?.equals(bytes) === true &&
      ![...(current?.snapshot.unresolvedRecoveries ?? [])].some(
        (item) => item.recoveryId === settlement.recoveryId,
      ) &&
      current?.snapshot.operations.some(
        (operation) =>
          operation.kind !== "host_operation" &&
          operation.recoveryId === settlement.recoveryId &&
          operation.history?.confirmed === true,
      ) === true;
    const pendingBytes = recoveryTerminal
      ? terminalPending
      : taskHistoryPendingState !== undefined
        ? taskHistoryPendingState
        : read("state.pending.json");
    if (taskHistoryPendingState !== undefined)
      assertCasFileIdentities(
        taskHistoryPendingState === null ? [] : ["state.pending.json"],
        taskHistoryPendingState === null ? ["state.pending.json"] : [],
      );
    if (pendingBytes !== null && !pendingBytes.equals(bytes))
      throw new Error("other_pending");
    const isInitialRoot =
      currentBytes === null &&
      (hostPublication?.initialBoundary === initial.boundaryIdentity ||
        taskPublication?.initialBoundary === initial.boundaryIdentity ||
        (initializationOwner !== null &&
          typeof initializationOwner === "object" &&
          initializations.get(initializationOwner)?.repositoryBinding ===
            repository.repositoryBinding &&
          initializations.get(initializationOwner)?.boundaryIdentity ===
            initial.boundaryIdentity &&
          initializations.get(initializationOwner)?.payloadSha256 ===
            candidate.payloadSha256 &&
          initializations.get(initializationOwner)?.publicationIssued ===
            false)) &&
      names.every((name) => name === "state.pending.json");
    const isInitialRepairPublication =
      repairPublication?.mode === "initial_publication";
    if (pendingBytes !== null) {
      const pending =
        recoveryTerminal || taskHistoryState
          ? candidate
          : decodeStateSnapshot(pendingBytes, repository.repositoryBinding);
      if (!pending) throw new Error("pending");
      const treatment = classifyExecutionSnapshotReentry(
        current
          ? {
              status: "present",
              revision: current.snapshot.revision,
              repositoryBinding: repository.repositoryBinding,
              payloadSha256: current.payloadSha256,
            }
          : { status: "absent" },
        { ...pending.snapshot, payloadSha256: pending.payloadSha256 },
        repository.repositoryBinding,
        isInitialRoot || isInitialRepairPublication ? "new" : "existing",
      );
      if (treatment === "blocked") throw new Error("pending_conflict");
      if (
        treatment === "publish_pending" &&
        !completionConfirmed &&
        !corePublication &&
        !(currentRepair
          ? validateRepairWriteCandidate(
              currentBytes,
              pendingBytes,
              currentRepair.recoveryId,
              currentRepair.purpose,
              repository.repositoryBinding,
            )
          : recoveryTerminal || taskHistoryState
            ? validateDecodedStateTransition(current, candidate)
            : validateStateTransition(
                currentBytes,
                pendingBytes,
                repository.repositoryBinding,
              ))
      )
        throw new Error("transition");
    } else if (
      !currentBytes?.equals(bytes) &&
      !completionConfirmed &&
      !corePublication &&
      (!(currentRepair
        ? validateRepairWriteCandidate(
            currentBytes,
            bytes,
            currentRepair.recoveryId,
            currentRepair.purpose,
            repository.repositoryBinding,
          )
        : recoveryTerminal || taskHistoryState
          ? validateDecodedStateTransition(current, candidate)
          : validateStateTransition(
              currentBytes,
              bytes,
              repository.repositoryBinding,
            )) ||
        (currentBytes === null && !isInitialRoot))
    )
      throw new Error("transition");

    if (settlement && !recoveryTerminal && !savedTerminalConfirmed) {
      if (!current) throw new Error("settlement_current_missing");
      if (
        !completionConfirmed &&
        (!current ||
          current.snapshot.operations.length !==
            candidate.snapshot.operations.length ||
          encodeStateValue(current.snapshot.unresolvedRecoveries) !==
            encodeStateValue(candidate.snapshot.unresolvedRecoveries))
      )
        throw new Error("settlement_scope");
      for (const previous of current.snapshot.operations) {
        if (previous.kind !== "docker_task") {
          const retained = candidate.snapshot.operations.find(
            (value) => value.recoveryId === previous.recoveryId,
          );
          if (encodeStateValue(retained) !== encodeStateValue(previous))
            throw new Error("repair_state_changed_by_task_settlement");
          continue;
        }
        const next = candidate.snapshot.operations.find(
          (value): value is ExecutionOperationRecord =>
            value.kind === "docker_task" &&
            value.recoveryId === previous.recoveryId,
        );
        if (!next) {
          if (
            completionConfirmed &&
            previous.recoveryId === settlement.recoveryId
          )
            continue;
          throw new Error("settlement_removal");
        }
        if (previous.recoveryId !== settlement.recoveryId) {
          if (encodeStateValue(previous) !== encodeStateValue(next))
            throw new Error("settlement_other_operation");
          continue;
        }
        if (
          encodeStateValue(previous.resources) !==
          encodeStateValue(next.resources)
        ) {
          const observedBytes = settlement.dockerTerminal
            ? prepareStateCleanupSnapshot(
                currentBytes,
                settlement.recoveryId,
                {
                  snapshot: settlement.dockerTerminal.resourceSnapshot,
                  observations: settlement.dockerTerminal.resources,
                },
                repository.repositoryBinding,
              )
            : null;
          const observedOperation = observedBytes
            ? decodeStateSnapshot(
                observedBytes,
                repository.repositoryBinding,
              )?.snapshot.operations.find(
                (value): value is ExecutionOperationRecord =>
                  value.kind === "docker_task" &&
                  value.recoveryId === settlement.recoveryId,
              )
            : null;
          if (
            !observedOperation ||
            encodeStateValue(observedOperation.resources) !==
              encodeStateValue(next.resources)
          )
            throw new Error("settlement_resource_observation_invalid");
        }
        const nextPrimaryFailure = encodeStateValue(next.primaryFailure);
        if (
          settlement.dockerTerminal
            ? nextPrimaryFailure !==
              encodeStateValue(settlement.dockerTerminal.primaryFailure)
            : nextPrimaryFailure !== encodeStateValue(previous.primaryFailure)
        )
          throw new Error("settlement_primary_failure_unconfirmed");
        if (
          next.phase === "executing" ||
          next.execution.ownerEffect === "active"
        )
          throw new Error("settlement_effect");
        if (
          next.lease !== previous.lease &&
          next.lease === "released" &&
          settlement.dockerTerminal?.homeLeaseReleased !== true
        )
          throw new Error("settlement_lease_observation_invalid");
        if (
          next.outcome?.cleanupConfirmed &&
          (readOperationHost(candidate.snapshot.operations, next)?.cleanup !==
            "confirmed" ||
            !settlement.cleanupStatus ||
            next.lease !== "released" ||
            settlement.dockerTerminal?.homeLeaseReleased !== true ||
            settlement.dockerTerminal?.recoveryCompleted !== true ||
            !areTaskResourcesSettled(next))
        )
          throw new Error("settlement_cleanup_unconfirmed");
      }
    }
    // 保存対象を変更する操作だけを現在のOwnerへ結合する。
    const previousOperations = new Map(
      current?.snapshot.operations.map((operation) => [
        operation.recoveryId,
        operation,
      ]) ?? [],
    );
    for (const operation of candidate.snapshot.operations) {
      const previous = previousOperations.get(operation.recoveryId);
      if (operation.kind === "host_operation") {
        if (
          (!previous ||
            encodeStateValue(previous) !== encodeStateValue(operation)) &&
          !hostPublication
        )
          throw new Error("host_writer_unconnected");
        continue;
      }
      if (operation.kind !== "docker_task") {
        if (
          (!previous ||
            encodeStateValue(previous) !== encodeStateValue(operation)) &&
          currentRepair?.recoveryId !== operation.recoveryId &&
          !(
            repairHistoryScopeConfirmed &&
            currentHistory?.recoveryId === operation.recoveryId
          )
        )
          throw new Error("repair_writer_unconnected");
        continue;
      }
      if (previous && previous.kind !== "docker_task")
        throw new Error("operation_kind_changed");
      for (const resource of operation.resources?.checkpoints ?? []) {
        const before = previous?.resources?.checkpoints.find(
          (value) => value.key === resource.key,
        );
        if (
          resource.submission === "not_issued" &&
          before?.submission !== "not_issued" &&
          (!unissued ||
            before?.submission !== "intent_saved" ||
            unissued.recoveryId !== operation.recoveryId ||
            unissued.purpose !== resource.key)
        )
          throw new Error("resource_not_issued_proof_missing");
      }
      if (
        !currentHistory &&
        !(
          settlement?.recoveryTerminal &&
          settlement.recoveryId === operation.recoveryId
        ) &&
        (((settlement?.historyInitial || settlement?.historyPublish) &&
          operation.recoveryId === settlement.recoveryId) ||
          encodeStateValue(operation.history) !==
            encodeStateValue(previous?.history ?? null))
      ) {
        if (
          (!settlement?.historyInitial && !settlement?.historyPublish) ||
          settlement.recoveryId !== operation.recoveryId ||
          !currentBytes ||
          !previous ||
          !operation.history ||
          (settlement.historyPublish
            ? !operation.history.confirmed || !previous.history
            : operation.history.confirmed || previous.history?.confirmed) ||
          !settlement.cleanupStatus ||
          settlement.dockerTerminal?.homeLeaseReleased !== true ||
          settlement.dockerTerminal.recoveryCompleted !== true
        )
          throw new Error("history_checkpoint_unconnected");
        const observedBytes = prepareStateCleanupSnapshot(
          currentBytes,
          operation.recoveryId,
          {
            snapshot: settlement.dockerTerminal.resourceSnapshot,
            observations: settlement.dockerTerminal.resources,
          },
          repository.repositoryBinding,
        );
        const observedOperation = observedBytes
          ? decodeStateSnapshot(
              observedBytes,
              repository.repositoryBinding,
            )?.snapshot.operations.find(
              (value): value is ExecutionOperationRecord =>
                value.kind === "docker_task" &&
                value.recoveryId === operation.recoveryId,
            )
          : null;
        if (
          !observedOperation ||
          encodeStateValue(observedOperation.resources) !==
            encodeStateValue(previous.resources)
        )
          throw new Error("history_resource_observation_invalid");
        const expected = prepareStateHistorySnapshot(
          currentBytes,
          operation.recoveryId,
          operation.history.occurredAt,
          settlement.historyPublish === true,
          repository.repositoryBinding,
        );
        if (
          !expected?.equals(bytes) &&
          !(
            settlement.historyPublish &&
            previous.history?.confirmed &&
            currentBytes.equals(bytes)
          )
        )
          throw new Error("history_checkpoint_difference_invalid");
        if (settlement.historyInitial && previous.history === null)
          initialHistoryLine = operation.history.lineSha256;
      }
      if (
        (!previous ||
          encodeStateValue(previous) !== encodeStateValue(operation)) &&
        JSON.parse(operation.identityJson).operationId !==
          repository.operationId
      )
        throw new Error("operation_owner");
    }
    for (const collection of ["unresolvedRecoveries"] as const) {
      for (const item of candidate.snapshot[collection]) {
        const previous = current?.snapshot[collection].find(
          (value) => value.operationNonce === item.operationNonce,
        );
        if (
          !previous ||
          encodeStateValue(previous) !== encodeStateValue(item)
        ) {
          const operation = candidate.snapshot.operations.find(
            (value): value is ExecutionOperationRecord =>
              value.kind === "docker_task" &&
              value.recoveryId === item.recoveryId,
          );
          if (
            !operation ||
            JSON.parse(operation.identityJson).operationId !==
              repository.operationId
          )
            throw new Error("reference_owner");
        }
      }
    }
    freshTaskHistory =
      taskHistoryState !== undefined &&
      currentHistory?.stage === "publish" &&
      taskHistoryPendingState === null &&
      preparedHistory !== null &&
      preparedHistory.pending === null &&
      !(preparedHistory.before ?? Buffer.alloc(0)).equals(
        preparedHistory.historyBytes,
      );
    if (
      settlement &&
      ((settlement.historyPublish && !historyAlreadyConfirmed) ||
        currentHistory?.stage === "publish")
    ) {
      if (!currentBytes || !current) throw new Error("history_current_missing");
      const target = current.snapshot.operations.find(
        (value) =>
          value.kind === (currentHistory?.operationKind ?? "docker_task") &&
          value.recoveryId === settlement.recoveryId,
      );
      const line =
        taskHistoryState && target?.kind === "docker_task"
          ? operationHistoryLine(target)
          : (currentHistory?.operationKind === "docker_repair"
              ? prepareRepairHistoryLine
              : prepareStateHistoryLine)(
              currentBytes,
              settlement.recoveryId,
              repository.repositoryBinding,
            );
      if (!line || target?.kind === "host_operation" || !target?.history)
        throw new Error("history_unfixed");
      const priorHistory = preparedHistory
        ? preparedHistory.before
        : read("history.jsonl");
      const before = priorHistory ?? Buffer.alloc(0);
      const rows = preparedHistory ? null : decodeHistoryRows(before);
      if (!preparedHistory && !rows) throw new Error("history_invalid");
      const sameRow = rows?.find(
        (row) => row.recoveryId === settlement.recoveryId,
      );
      if (sameRow && !Buffer.from(sameRow.line).equals(line))
        throw new Error("history_row_conflict");
      const owner = executionStorageOperationIdentity(
        settlement.managementCapability,
      );
      const admission =
        owner && typeof owner === "object"
          ? historyAttempts.get(owner)?.get(settlement.recoveryId)
          : null;
      const pendingHistory = preparedHistory
        ? preparedHistory.pending
        : read("history.pending.jsonl");
      if (!sameRow && target.history.confirmed)
        throw new Error("history_confirmed_row_absent");
      if (!sameRow && !admission && !currentHistory)
        throw new Error("history_initial_proof_missing");
      if (admission && admission.lineSha256 !== target.history.lineSha256)
        throw new Error("history_proof_conflict");
      // 同じ候補生成で確認した日数を使う。新規候補を作る直前の
      // assertBoundaryは、設定とOwnerを再観測してからEffectを許可する。
      const configuration = freshTaskHistory
        ? (preparedHistory?.retentionDays ?? null)
        : readHistoryRetentionDays(repository);
      if (
        configuration === null ||
        (currentHistory && configuration !== currentHistory.retentionDays)
      )
        throw new Error("history_config_invalid");
      const days = configuration;
      const now = currentHistory
        ? target.history.occurredAt
        : (admission?.pending?.now ?? new Date().toISOString());
      let after: Buffer;
      if (currentHistory) {
        if (
          !preparedHistory ||
          preparedHistory.retentionDays !== days ||
          currentHistory.assertOwner() !== true
        )
          throw new Error("current_history_publication_invalid");
        after = preparedHistory.historyBytes;
        assertHistoryReadGroup();
        assertCasFileIdentities(
          [
            "state.json",
            ...(priorHistory === null ? [] : (["history.jsonl"] as const)),
            ...(pendingHistory === null
              ? []
              : (["history.pending.jsonl"] as const)),
          ],
          [
            ...(priorHistory === null ? (["history.jsonl"] as const) : []),
            ...(pendingHistory === null
              ? (["history.pending.jsonl"] as const)
              : []),
          ],
        );
      } else if (pendingHistory !== null) {
        const binding = admission?.pending;
        const originalIdentity = fileIdentities.get("history.jsonl") ?? null;
        if (
          !binding?.before.equals(before) ||
          !binding.after.equals(pendingHistory) ||
          binding.retentionDays !== days ||
          (binding.beforeIdentity === null
            ? originalIdentity !== null
            : !originalIdentity ||
              !sameStableFileIdentity(binding.beforeIdentity, originalIdentity))
        )
          throw new Error("history_pending_unbound");
        after = binding.after;
      } else {
        if (!sameRow && admission?.issued)
          throw new Error("history_prior_attempt_unknown");
        const joined = sameRow ? before : Buffer.concat([before, line]);
        const retained = prepareHistoryRetention(
          currentBytes,
          joined,
          now,
          days,
          repository.repositoryBinding,
          settlement.recoveryId,
        );
        if (!retained) throw new Error("history_retention_invalid");
        after = retained;
        if (admission) {
          admission.pending = {
            before,
            after,
            beforeIdentity: fileIdentities.get("history.jsonl") ?? null,
            stateCandidate: bytes,
            retentionDays: days,
            now,
          };
          admission.issued = true;
        }
        if (!before.equals(after)) create("history.pending.jsonl", after);
      }
      if (!before.equals(after)) {
        // この場で作成した候補は、createが同じWriter内で既に読戻している。
        const newHistoryPending =
          currentHistory !== null && pendingHistory === null;
        if (newHistoryPending) create("history.pending.jsonl", after);
        if (newHistoryPending && !freshTaskHistory) assertHistoryReadGroup();
        // 新規Task候補だけはReaderとWriterで照合済みの元本文を再利用する。
        // 置換直前はOwner・Lock・設定と、同じ元State／履歴の実体をCASで確認する。
        if (
          (!newHistoryPending &&
            !read("history.pending.jsonl")?.equals(after)) ||
          (!freshTaskHistory &&
            (!(read("history.jsonl") ?? Buffer.alloc(0)).equals(before) ||
              !read("state.json")?.equals(currentBytes)))
        )
          throw new Error("history_changed");
        if (!currentHistory) {
          const freshConfig = readHistoryRetentionDays(repository);
          if (freshConfig === null || freshConfig !== days)
            throw new Error("history_config_changed");
        }
        // 今回作った実体は作成時に同期済み。再入場の途中ファイルだけを同期し直す。
        if (!newHistoryPending)
          flushExecutionStateFile(
            directory,
            "history.pending.jsonl",
            fileIdentities,
            assertBoundary,
            () => {
              filesystemEffectIssued = true;
            },
          );
        if (!freshTaskHistory) assertHistoryReadGroup();
        if (!newHistoryPending && !read("history.pending.jsonl")?.equals(after))
          throw new Error("history_pending_changed");
        assertBoundary();
        assertCasFileIdentities(
          priorHistory === null
            ? ["history.pending.jsonl", "state.json"]
            : ["history.pending.jsonl", "history.jsonl", "state.json"],
          [
            ...(priorHistory === null ? (["history.jsonl"] as const) : []),
            ...(taskHistoryState ? (["state.pending.json"] as const) : []),
          ],
        );
        const pendingIdentity = fileIdentities.get("history.pending.jsonl");
        if (currentHistory && !pendingIdentity)
          throw new Error("history_pending_changed");
        filesystemEffectIssued = true;
        fs.renameSync(
          path.join(directory, "history.pending.jsonl"),
          path.join(directory, "history.jsonl"),
        );
        fileIdentities.delete("history.pending.jsonl");
        fileIdentities.delete("history.jsonl");
        if (currentHistory) {
          fileIdentities.set(
            "history.jsonl",
            observeRenamedFile("history.jsonl", pendingIdentity, after),
          );
        } else {
          const saved = read("history.jsonl");
          const savedIdentity = fileIdentities.get("history.jsonl");
          if (
            !saved?.equals(after) ||
            !pendingIdentity ||
            !savedIdentity ||
            pendingIdentity.dev !== savedIdentity.dev ||
            pendingIdentity.ino !== savedIdentity.ino
          )
            throw new Error("history_publication_unconfirmed");
        }
      } else if (currentHistory && pendingHistory !== null) {
        if (
          !read("history.pending.jsonl")?.equals(after) ||
          !read("history.jsonl")?.equals(before) ||
          !read("state.json")?.equals(currentBytes)
        )
          throw new Error("current_history_pending_changed");
        assertBoundary();
        assertCasFileIdentities([
          "history.pending.jsonl",
          "history.jsonl",
          "state.json",
        ]);
        filesystemEffectIssued = true;
        fs.unlinkSync(path.join(directory, "history.pending.jsonl"));
        fileIdentities.delete("history.pending.jsonl");
      }
      flushExecutionStateFile(
        directory,
        "history.jsonl",
        fileIdentities,
        assertBoundary,
        () => {
          filesystemEffectIssued = true;
        },
      );
      assertHistoryReadGroup();
      const savedHistory = read("history.jsonl");
      if (currentHistory && !savedHistory?.equals(after))
        throw new Error("history_publication_unconfirmed");
      const savedRows = decodeHistoryRows(savedHistory);
      // 履歴本文を読んだ直後なので、同じ領域で途中名の不存在だけ確認する。
      // 別呼出しからの再開や修復は従来の完全な読取りを維持する。
      if (freshTaskHistory)
        assertCasFileIdentities([], ["history.pending.jsonl"]);
      if (
        !savedRows?.some(
          (row) =>
            row.recoveryId === settlement.recoveryId &&
            Buffer.from(row.line).equals(line),
        ) ||
        (!freshTaskHistory && read("history.pending.jsonl") !== null)
      )
        throw new Error("history_readback_unconfirmed");
      if (currentHistory) publishedHistoryRows = savedRows;
    }
    let syncedTaskPending: StableFileIdentity | undefined;
    if (!currentBytes?.equals(bytes)) {
      if (currentHistory?.stage === "checkpoint")
        assertCasFileIdentities([], ["history.pending.jsonl"]);
      const newStatePendingAlreadySynced =
        (currentHistory !== null || recoveryTerminal !== undefined) &&
        pendingBytes === null;
      // 通常の新規pendingはcreateで同期・読戻し済み。再同期せず、置換直前の本文CASへ進む。
      const freshTaskWrite =
        taskPublication?.before != null &&
        currentBytes !== null &&
        pendingBytes === null;
      const skipIntermediate = newStatePendingAlreadySynced || freshTaskWrite;
      if (pendingBytes === null) create("state.pending.json", bytes);
      if (pendingBytes === null && !freshTaskHistory) assertHistoryReadGroup();
      const samePending = skipIntermediate ? null : read("state.pending.json");
      const skipEarlyCurrent =
        freshTaskWrite ||
        currentHistory !== null ||
        (recoveryTerminal !== undefined && newStatePendingAlreadySynced);
      const sameCurrent = skipEarlyCurrent ? null : read("state.json");
      if (
        (!skipIntermediate && !samePending?.equals(bytes)) ||
        (!skipEarlyCurrent &&
          (currentBytes === null
            ? sameCurrent !== null
            : !sameCurrent?.equals(currentBytes)))
      )
        throw new Error("changed");
      // 新規の場合も次の本文CASと、置換直前の実体照合は残す。
      if (!skipIntermediate)
        flushExecutionStateFile(
          directory,
          "state.pending.json",
          fileIdentities,
          assertBoundary,
          () => {
            filesystemEffectIssued = true;
          },
        );
      assertHistoryReadGroup();
      if (
        !newStatePendingAlreadySynced &&
        !read("state.pending.json", freshTaskWrite)?.equals(bytes)
      )
        throw new Error("pending_changed");
      const target = read("state.json", freshTaskWrite);
      if (
        currentBytes === null ? target !== null : !target?.equals(currentBytes)
      )
        throw new Error("target_changed");
      if (
        freshTaskWrite ||
        assertFileOwner ||
        currentHistory ||
        recoveryTerminal
      )
        assertBoundary();
      assertCasFileIdentities(
        currentHistory?.stage === "publish"
          ? ["state.pending.json", "state.json", "history.jsonl"]
          : ["state.pending.json", "state.json"],
        ["history.pending.jsonl"],
        freshTaskWrite,
      );
      filesystemEffectIssued = true;
      const publishedIdentity = fileIdentities.get("state.pending.json");
      if (
        initializationOwner !== null &&
        typeof initializationOwner === "object"
      ) {
        const proof = initializations.get(initializationOwner);
        if (proof) proof.publicationIssued = true;
      }
      fs.renameSync(
        path.join(directory, "state.pending.json"),
        path.join(directory, "state.json"),
      );
      fileIdentities.delete("state.json");
      fileIdentities.delete("state.pending.json");
      // 履歴保存とTask回復終端では同じLock内で候補を同期済み。置換先の実体は確認するが、
      // 通常は今書き込んだ本文を成功確認だけのために開き直さない。
      if (currentHistory || recoveryTerminal) {
        fileIdentities.set(
          "state.json",
          observeRenamedFile("state.json", publishedIdentity, bytes),
        );
        currentBytes = bytes;
        current = candidate;
      } else if (freshTaskWrite) {
        if (!publishedIdentity) throw new Error("published_identity_missing");
        // 同期済み候補を参照し、成功前に置換先の実体を照合する。正本は開かない。
        syncedTaskPending = publishedIdentity;
        currentBytes = bytes;
        current = candidate;
      } else {
        currentBytes = read("state.json");
        const published = fileIdentities.get("state.json");
        if (
          !publishedIdentity ||
          !published ||
          published.dev !== publishedIdentity.dev ||
          published.ino !== publishedIdentity.ino
        )
          throw new Error("published_replaced");
        current =
          currentBytes === null
            ? null
            : decodeStateSnapshot(currentBytes, repository.repositoryBinding);
      }
    } else if (pendingBytes !== null) {
      if (
        !read("state.pending.json")?.equals(bytes) ||
        !read("state.json")?.equals(bytes)
      )
        throw new Error("changed");
      assertBoundary();
      assertCasFileIdentities(
        ["state.pending.json", "state.json"],
        ["history.pending.jsonl"],
      );
      filesystemEffectIssued = true;
      fs.unlinkSync(path.join(directory, "state.pending.json"));
      fileIdentities.delete("state.pending.json");
    }
    if (
      !currentBytes?.equals(bytes) ||
      !current ||
      (!currentHistory &&
        !recoveryTerminal &&
        read("state.pending.json") !== null)
    )
      throw new Error("final");
    if (
      settlement &&
      ((settlement.historyPublish && !historyAlreadyConfirmed) ||
        currentHistory?.stage === "publish")
    ) {
      const finalLine = taskHistoryState
        ? operationHistoryLine(
            current.snapshot.operations.find(
              (item): item is ExecutionOperationRecord =>
                item.kind === "docker_task" &&
                item.recoveryId === settlement.recoveryId,
            ),
          )
        : (currentHistory?.operationKind === "docker_repair"
            ? prepareRepairHistoryLine
            : prepareStateHistoryLine)(
            bytes,
            settlement.recoveryId,
            repository.repositoryBinding,
          );
      const finalRows = currentHistory
        ? publishedHistoryRows
        : decodeHistoryRows(read("history.jsonl"));
      if (
        !finalLine ||
        !finalRows?.some(
          (row) =>
            row.recoveryId === settlement.recoveryId &&
            Buffer.from(row.line).equals(finalLine),
        ) ||
        (!currentHistory && read("history.pending.jsonl") !== null)
      )
        throw new Error("history_final_readback_unconfirmed");
    }
    if (currentCompletion) {
      const history = read("history.jsonl");
      if (
        currentCompletion.historyFile === null
          ? history !== null
          : !history?.equals(currentCompletion.historyFile.bytes)
      )
        throw new Error("current_completion_history_changed");
    }
    if (!assertFileOwner) assertBoundary();
    if (syncedTaskPending) {
      const stat = fs.lstatSync(path.join(directory, "state.json"), {
        bigint: true,
      });
      const published = identity(stat);
      if (
        !stat.isFile() ||
        stat.nlink !== 1n ||
        !sameStableFileIdentity(syncedTaskPending, {
          ...published,
          ctimeNs: syncedTaskPending.ctimeNs,
          // Windowsの置換は置換先の作成時刻を保持し得る。ファイルID等は引き続き照合する。
          birthtimeNs:
            process.platform === "win32"
              ? syncedTaskPending.birthtimeNs
              : published.birthtimeNs,
        })
      )
        throw new Error("published_replaced");
    } else if (
      !currentHistory &&
      !recoveryTerminal &&
      !read("state.json")?.equals(bytes)
    )
      throw new Error("final");
    if (currentHistory || recoveryTerminal) {
      const finalNames = fs.readdirSync(directory);
      if (
        finalNames.some(
          (name) => name !== "state.json" && name !== "history.jsonl",
        ) ||
        !finalNames.includes("state.json") ||
        (currentHistory?.stage === "publish" &&
          !finalNames.includes("history.jsonl"))
      )
        throw new Error("history_final_files_changed");
      const seenHistory = fileIdentities.get("history.jsonl");
      if (currentHistory?.stage === "publish") {
        const history = fs.lstatSync(path.join(directory, "history.jsonl"), {
          bigint: true,
        });
        if (
          !seenHistory ||
          !sameStableFileIdentity(seenHistory, history) ||
          history.nlink !== 1n ||
          !history.isFile()
        )
          throw new Error("history_final_files_changed");
      }
      const published = fs.lstatSync(path.join(directory, "state.json"), {
        bigint: true,
      });
      const confirmed = fileIdentities.get("state.json");
      if (
        !confirmed ||
        !sameStableFileIdentity(confirmed, published) ||
        published.nlink !== 1n ||
        !published.isFile()
      )
        throw new Error("published_replaced");
    }
    if (assertFileOwner) assertBoundary();
    snapshotConfirmed = true;
    if (initializationOwner !== null && typeof initializationOwner === "object")
      initializations.delete(initializationOwner);
    reason = "coordinator_state_snapshot_confirmed";
  } catch (error) {
    if (
      settlement?.recoveryTerminal &&
      !terminalPrepared &&
      error instanceof Error &&
      error.message !== "recovery_terminal_history_invalid"
    ) {
      reason =
        error.message === "unknown_content" ||
        error.message === "recovery_terminal_pending_invalid" ||
        error.message === "recovery_terminal_history_pending"
          ? "coordinator_state_reentry_required"
          : error.message === "recovery_terminal_scope_invalid" ||
              error.message === "recovery_terminal_candidate_invalid"
            ? "coordinator_state_input_invalid"
            : "coordinator_state_read_unconfirmed";
    } else {
      reason = "coordinator_state_storage_unconfirmed";
    }
  }
  return {
    attempt,
    filesystemEffectIssued,
    snapshotConfirmed,
    reason,
    initialHistoryLine,
  };
}

/**
 * 保存準備・Owned確定・排他解放を既存Writer入口で結合する。
 * @responsibility 保存確認と解放確認の両方が揃った場合だけ完了を返す。
 * @trace ARCH-000008
 * @input input: 既存の操作Owner、固定候補と用途別保存入力。
 * @returns 保存Effect・Snapshot確認・解放確認を分離した結果。
 * @precondition 外側の用途別入口が既存の借用を検証する。
 * @postcondition 取得済みContextを一度だけ確定し、解放失敗を成功へ畳まない。
 * @effect 既存短期排他と固定保存FileのI/O。
 * @failure 取得前・保存途中・解放失敗は既存のblocked結果。
 * @invariant 新しい保存方式・Authority・第三Writerを追加しない。
 * @boundary 保存公開Wrapperと私有確定処理。
 * @security 任意Pathや外部callbackを受け付けない。
 * @concurrency 短期排他の取得と解放をこの入口が所有する。
 */
export function writeStateSnapshot(
  ...input: [
    Parameters<typeof prepareStateWrite>[0],
    Parameters<typeof prepareStateWrite>[1],
    Parameters<typeof prepareStateWrite>[2],
    Parameters<typeof prepareStateWrite>[3],
    Parameters<typeof prepareStateWrite>[4]?,
    Parameters<typeof prepareStateWrite>[5]?,
  ]
) {
  const prepared = prepareStateWrite(...input);
  if (!("lock" in prepared)) return prepared;
  const { storageOwner, initializationOwner, settlement } = prepared;
  let {
    attempt,
    filesystemEffectIssued,
    snapshotConfirmed,
    reason,
    initialHistoryLine,
  } = commitStateSnapshotOwned(prepared);
  let lockReleased = false;
  try {
    lockReleased = storageOwner.release();
  } catch {
    lockReleased = false;
  }
  if (!lockReleased) {
    if (initializationOwner !== null && typeof initializationOwner === "object")
      initializations.delete(initializationOwner);
    // 書込み不要の経路は旧Reader同様、解放を確認できなければ観測値を返さない。
    if (
      settlement?.recoveryTerminal &&
      snapshotConfirmed &&
      !filesystemEffectIssued
    ) {
      snapshotConfirmed = false;
      attempt = prepared.attempt;
    }
    reason = "coordinator_state_lock_release_unconfirmed";
  }
  if (
    snapshotConfirmed &&
    lockReleased &&
    initialHistoryLine &&
    settlement?.managementCapability &&
    typeof settlement.managementCapability === "object"
  ) {
    let attempts = historyAttempts.get(
      executionStorageOperationIdentity(
        settlement.managementCapability,
      ) as object,
    );
    if (!attempts) {
      attempts = new Map();
      historyAttempts.set(
        executionStorageOperationIdentity(
          settlement.managementCapability,
        ) as object,
        attempts,
      );
    }
    if (!attempts.has(settlement.recoveryId))
      attempts.set(settlement.recoveryId, {
        lineSha256: initialHistoryLine,
        issued: false,
        pending: null,
      });
  }
  return Object.freeze({
    ...attempt,
    status: snapshotConfirmed && lockReleased ? "completed" : "blocked",
    reason,
    filesystemEffectIssued,
    snapshotConfirmed,
    lockReleased,
  });
}

/**
 * 同じ操作の履歴出版で既に固定した再入場候補を参照する。
 * @responsibility 初回出版の証拠を複製せず、正常終了の再入場へ同じ候補を渡す。
 * @trace ARCH-000008
 * @input owner: 元実行Owner、recoveryId: exact回復参照。
 * @returns 固定済み候補、又はnull。
 * @precondition 呼出し側が正常終了Contextの真正性を確認する。
 * @postcondition 新しい証拠・Authorityを生成しない。
 * @effect N/A: 私有Map読取りだけ。
 * @failure 未登録又は不正Ownerではnull。
 * @invariant 候補参照は保存許可や履歴完了を表さない。
 * @boundary 正常終了Ownerと履歴出版証拠。
 * @security 可変Mapや証拠recordを返さない。
 * @concurrency 元の一回出版証拠を同じ寿命で参照する。
 */
export function readHistoryResumeCandidate(owner: unknown, recoveryId: string) {
  return owner && typeof owner === "object"
    ? historyAttempts.get(owner)?.get(recoveryId)?.pending?.stateCandidate
    : null;
}
type RecoveryPublication = (
  typeof settlements extends WeakMap<object, infer T>
    ? T
    : never
) extends infer T
  ? T extends { used: boolean }
    ? Omit<T, "used">
    : never
  : never;

/**
 * 検査済み回復候補を一回保存し、短命証拠を全終了経路で失効する。
 * @responsibility 証拠生成・初期化・一回保存・失効を物理Writerへ閉じる。
 * @trace ARCH-000008
 * @input request: 閉じた用途別候補と現在Owner。
 * @returns 保存、初期化Effect、排他解放の観測。
 * @precondition 意味側のReaderと候補検査を通過している。
 * @postcondition 私有Contextを返さず破棄する。
 * @effect 初回領域作成と既存Writerだけ。
 * @failure 不明用途・失効・元版差・保存不明は停止する。
 * @invariant 証拠消費と履歴試行登録の既存順序を維持する。
 * @boundary 意味側候補とStorageの保存。
 * @security Root公開せず、Map操作の汎用APIを作らない。
 * @concurrency 既存の短期排他を利用する。
 */
export function publishRecoveryState(
  request: RecoveryPublication,
  historyOwner?: StorageOwner,
) {
  const refused = () => writeStateSnapshot(null, null, null, null);
  if (
    !request ||
    (historyOwner !== undefined && request.kind !== "current_history") ||
    ![
      "docker_repair",
      "current_completion",
      "current_history",
      "authentication_unknown_closure",
    ].includes(request.kind) ||
    (request.kind === "docker_repair" &&
      ![
        "checkpoint",
        "session_begin",
        "retention_handoff",
        "disposal_decision",
        "disposal_primary",
        "disposal_failed",
        "disposal_auxiliary",
      ].includes(request.purpose)) ||
    ((request.kind === "current_completion" ||
      request.kind === "current_history") &&
      request.operationKind !== "docker_task" &&
      request.operationKind !== "docker_repair") ||
    (request.kind === "current_history" &&
      !["checkpoint", "publish", "confirmed"].includes(request.stage)) ||
    (request.kind !== "docker_repair" &&
      ("purpose" in request ||
        "publication" in request ||
        "assertFileOwner" in request)) ||
    (request.kind === "docker_repair" &&
      request.assertFileOwner !== undefined &&
      (typeof request.assertFileOwner !== "function" ||
        request.purpose !== "checkpoint" ||
        request.before === null ||
        request.publication !== undefined ||
        request.repository.revalidate !== request.assertOwner)) ||
    (request.kind !== "current_history" &&
      ("stage" in request || "pendingHistoryFile" in request))
  )
    return refused();
  const context = Object.freeze({});
  let active = true;
  let initializationEffectIssued = false;
  const repository = request.repository;
  const binding = { ...request, used: false };
  if (binding.kind === "current_history") {
    const historyRepository = binding.repository;
    binding.assertOwner = (days?: number, includeUnscopedRevalidation?: true) =>
      active &&
      settlements.get(context) === binding &&
      binding.used &&
      (days !== undefined && historyRepository.revalidateRetention !== undefined
        ? // 元Ownerの後に保存起点を一度照合し、設定だけを読む。
          request.assertOwner() === true &&
          readHistoryRetentionDays(historyRepository) === days
        : (!includeUnscopedRevalidation ||
            historyRepository.revalidate(undefined)) &&
          request.assertOwner() === true &&
          historyRepository.revalidate(days));
  } else if (binding.kind === "authentication_unknown_closure") {
    binding.assertOwner = () =>
      active && request.assertOwner() === true && repository.revalidate();
  }
  settlements.set(context, binding);
  try {
    if (
      binding.kind === "docker_repair" &&
      binding.before === null &&
      !binding.publication
    ) {
      const initialized = prepareStateInitialization(
        context,
        repository,
        binding.candidate,
      );
      initializationEffectIssued ||= initialized.effectIssued;
      if (initialized.status !== "prepared" || !initialized.lockReleased)
        return Object.freeze({
          ...refused(),
          reason: "coordinator_state_initialization_unconfirmed",
          filesystemEffectIssued: initializationEffectIssued,
          lockReleased: initialized.lockReleased,
        });
    }
    const bound =
      binding.kind === "authentication_unknown_closure"
        ? {
            ...repository,
            revalidate: (days?: number) =>
              active &&
              settlements.get(context) === binding &&
              binding.used &&
              binding.assertOwner() &&
              repository.revalidate(days),
          }
        : binding.kind === "current_history"
          ? { ...repository, revalidate: binding.assertOwner }
          : repository;
    const input = [
      null,
      bound,
      binding.candidate,
      binding.kind === "current_history" ||
      binding.kind === "current_completion"
        ? {
            recoveryId: binding.recoveryId,
            cleanupStatus: null,
            dockerTerminal: null,
            ...(binding.kind === "current_history"
              ? { currentHistory: context }
              : { currentCompletion: context }),
          }
        : null,
      undefined,
      binding.kind === "docker_repair" ||
      binding.kind === "authentication_unknown_closure"
        ? context
        : undefined,
    ] satisfies Parameters<typeof writeStateSnapshot>;
    if (historyOwner) {
      const prepared = prepareStateWrite(...input, historyOwner);
      if (!("lock" in prepared)) return prepared;
      const saved = commitStateSnapshotOwned(prepared);
      return Object.freeze({
        ...prepared.attempt,
        status: saved.snapshotConfirmed ? "completed" : "blocked",
        reason: saved.reason,
        filesystemEffectIssued: saved.filesystemEffectIssued,
        snapshotConfirmed: saved.snapshotConfirmed,
        lockReleased: false,
      });
    }
    const saved = writeStateSnapshot(...input);
    return Object.freeze({
      ...saved,
      filesystemEffectIssued:
        initializationEffectIssued || saved.filesystemEffectIssued,
    });
  } catch (error) {
    if (historyOwner) throw error;
    return Object.freeze({
      ...refused(),
      filesystemEffectIssued: initializationEffectIssued,
    });
  } finally {
    active = false;
    settlements.delete(context);
    initializations.delete(context);
  }
}

type OwnedPublication =
  | Readonly<{
      kind: "host";
      before: Buffer | null;
      value: unknown;
      initialBoundary: string | null;
    }>
  | Readonly<
      { kind: "task" } & NonNullable<
        Parameters<typeof commitStateSnapshotOwned>[0]["taskPublication"]
      >
    >
  | Readonly<{
      kind: "definition";
      operation: Parameters<typeof prepareExecutionDefinitionChange>[1];
      before: Buffer;
      request: unknown;
      initialSourceRevision: string | null;
    }>;

/**
 * 取得済みOwnerでTask又は定義候補を同じWriterへ渡す。
 * @responsibility 私有commit入力の構築を物理保存Ownerへ閉じる。
 * @trace ARCH-000008
 * @input owner: 取得済みOwner、bytes: 候補、publication: 閉じた保存用途。
 * @returns 既存Writerの保存観測。
 * @precondition 同じOwner内で現在版と意味の遷移を確認済み。
 * @postcondition Ownerを再取得・解放しない。
 * @effect 既存のpending・rename・読戻しだけ。
 * @failure 偽Owner・不明用途・候補不正はEffect前に拒否する。
 * @invariant 呼出し元が一回だけOwnerを解放する。
 * @boundary 意味側候補と単一Writer。
 * @security preparedやMapを返さない。
 * @concurrency 元Ownerの保持区間を分割しない。
 */
export function publishStateOwned(
  owner: StorageOwner,
  bytes: Buffer,
  publication: OwnedPublication,
) {
  const binding = readStorageOwnerBinding(owner);
  const candidate = binding
    ? decodeStateSnapshot(bytes, binding.repository.repositoryBinding)
    : null;
  if (
    !binding ||
    !candidate ||
    !isLiveStorageOwner(owner) ||
    (publication.kind !== "task" &&
      publication.kind !== "definition" &&
      publication.kind !== "host")
  )
    return {
      filesystemEffectIssued: false,
      snapshotConfirmed: false,
      reason: "coordinator_state_storage_unconfirmed",
      initialHistoryLine: null,
    };
  return commitStateSnapshotOwned({
    repository: binding.repository,
    candidate,
    bytes: Buffer.from(bytes),
    settlement: null,
    unissued: undefined,
    managementCapability: null,
    currentRepair: null,
    currentAuthenticationClosure: null,
    initializationOwner: owner,
    currentHistory: null,
    currentCompletion: null,
    attempt: {
      revision: candidate.snapshot.revision,
      payloadSha256: candidate.payloadSha256,
      recoveryIds: Object.freeze(
        candidate.snapshot.operations.map((o) => o.recoveryId),
      ),
    },
    storageOwner: owner,
    lock: binding.lock,
    ...(publication.kind === "task"
      ? {
          taskPublication: {
            before: publication.before,
            view: publication.view,
            facts: publication.facts,
            rootHash: publication.rootHash,
            initialBoundary: publication.initialBoundary,
          },
        }
      : publication.kind === "host"
        ? {
            hostPublication: {
              before: publication.before,
              value: publication.value,
              initialBoundary: publication.initialBoundary,
            },
          }
        : {
            corePublication: {
              before: publication.before,
              kind: publication.operation,
              request: publication.request,
              initialSourceRevision: publication.initialSourceRevision,
            },
          }),
  });
}
