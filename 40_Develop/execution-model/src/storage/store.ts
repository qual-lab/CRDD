/**
 * 現在状態・履歴の固定保存領域とFilesystem入出力を管理する。
 * @responsibility 実体照合、出版pending、読戻しと失敗・回復情報を保持する。
 * @trace ARCH-000008
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Repository } from "../../../version-control/src/index.ts";
import {
  getRepository,
  getRepositoryFromWorkingDirectory,
  registerRepositoryLocalIgnore,
  resolveVerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";
import type { ExecutionOperationRecord } from "../attempt/types.ts";
import {
  areTaskResourcesSettled,
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
import { decisionHistoryLine, taskHistoryLine } from "../history/operations.ts";
import type { HistoryRow } from "../history/types.ts";
import { decodeHistoryRows } from "../history/validation.ts";
import type { Snapshot } from "../state/types.ts";
import {
  classifyResourcePublication,
  decodeStateSnapshot,
  historyRow,
  isInitialOperationHost,
  prepareHistoryRetention,
  prepareRecoveredHistoryPublication,
  prepareRepairHistoryLine,
  prepareRepairHistoryPublication,
  prepareRepairHistorySnapshot,
  prepareRepairHistorySummary,
  prepareStateCompletionSnapshot,
  prepareStateHistoryLine,
  prepareStateHistorySnapshot,
  prepareStateHostSnapshot,
  prepareStateRepairCompletionSnapshot,
  STORAGE_CONTRACT,
  validId,
} from "../state/validation.ts";
import { encodeStateValue } from "../state/value.ts";
import { projectTaskSnapshot } from "../task/validation.ts";
import type {
  HistoryRepositoryInput,
  SnapshotOwner,
  StorageOwner,
  StoreResult,
} from "./lock.ts";
import {
  acquireSnapshotPilotLock,
  acquireStorageOwner,
  acquireStorageOwnerForRepository,
  blocked,
  borrowStorageOwner,
  completed,
  isLiveSnapshotOwner,
  isLiveStorageOwner,
  type observeExecutionRecoveryRepository,
  type observeOperationRepository,
  readHistoryRetentionDays,
  readStorageOwnerBinding,
} from "./lock.ts";

/**
 * require Ready Repository Runtime Data Areaを決定する。
 *
 * @responsibility require Ready Repository Runtime Data Areaの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000011
 * @input result: ReturnType<typeof ensureRepositoryExecutionDataArea>、invalidReason: string
 * @returns requireReadyRepositoryExecutionDataAreaの計算結果を返す。
 * @precondition 「result: ReturnType<typeof ensureRepositoryExecutionDataArea>、invalidReason: string」がrequireReadyRepositoryExecutionDataAreaの入力契約を満たす。
 * @postcondition requireReadyRepositoryExecutionDataAreaの責務を完了した結果だけを返す。
 * @effect N/A: requireReadyRepositoryExecutionDataAreaは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requireReadyRepositoryExecutionDataAreaは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requireReadyRepositoryExecutionDataAreaは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requireReadyRepositoryExecutionDataAreaはProcess内の同一Subsystemで完結する。
 * @security N/A: requireReadyRepositoryExecutionDataAreaはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: requireReadyRepositoryExecutionDataAreaは共有非同期状態を持たない同期処理である。
 */
export function requireReadyRepositoryExecutionDataArea(
  result: ReturnType<typeof ensureRepositoryExecutionDataArea>,
  invalidReason: string,
) {
  if (result?.status === "ready") return result;
  if (result?.status === "blocked")
    throw new ExecutionStorageBlockedError(result);
  throw new Error(invalidReason);
}

/** 保存先はPackage名でなく既存永続所在の契約。 */
export const REPOSITORY_AREAS = Object.freeze([
  "domain-model",
  "tmp",
  "lock",
] as const);

export const AREA_PATH_KEYS = Object.freeze({
  "domain-model": "domainModel",
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
    domainModel: path.join(root, "domain-model"),
    temporary: path.join(root, "tmp"),
    locks: path.join(root, "lock"),
    allowedTopLevelAreas: REPOSITORY_AREAS,
  });
}

/**
 * Repository Runtime Data Pathsを一意に解決する。
 *
 * @responsibility Repository Runtime Data Pathsの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input capability: Repository
 * @returns resolveRepositoryExecutionDataPathsの計算結果を返す。
 * @precondition 「capability: Repository」がresolveRepositoryExecutionDataPathsの入力契約を満たす。
 * @postcondition resolveRepositoryExecutionDataPathsの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryExecutionDataPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryExecutionDataPathsは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryExecutionDataPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryExecutionDataPathsはProcess内の同一Subsystemで完結する。
 * @security resolveRepositoryExecutionDataPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRepositoryExecutionDataPathsは共有非同期状態を持たない同期処理である。
 */
export function resolveRepositoryExecutionDataPaths(capability: Repository) {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  if (repositoryRoot === null) return null;
  const resolved =
    resolveRepositoryExecutionDataPathsFromValidatedRoot(repositoryRoot);
  if (!resolved) return null;
  const { root: internalRoot, ...publicPaths } = resolved;
  if (path.dirname(internalRoot) !== resolved.repositoryRoot) return null;
  return Object.freeze(publicPaths);
}

/**
 * Runtime Data implementation-only path set; omitted from the public index.
 *
 * @responsibility Repository Runtime Data Paths For Internal Useの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input capability: Repository
 * @returns resolveRepositoryExecutionDataPathsForInternalUseの計算結果を返す。
 * @precondition 「capability: Repository」がresolveRepositoryExecutionDataPathsForInternalUseの入力契約を満たす。
 * @postcondition resolveRepositoryExecutionDataPathsForInternalUseの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryExecutionDataPathsForInternalUseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryExecutionDataPathsForInternalUseは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryExecutionDataPathsForInternalUseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryExecutionDataPathsForInternalUseはProcess内の同一Subsystemで完結する。
 * @security resolveRepositoryExecutionDataPathsForInternalUseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRepositoryExecutionDataPathsForInternalUseは共有非同期状態を持たない同期処理である。
 */
export function resolveRepositoryExecutionDataPathsForInternalUse(
  capability: Repository,
) {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null
    ? null
    : resolveRepositoryExecutionDataPathsFromValidatedRoot(repositoryRoot);
}

/**
 * private Rootと名前付き領域の既存境界をOwner内で観測する。
 * @responsibility 利用側によるParent Rootの復元を不要にし、真正不存在と観測障害を分ける。
 * @trace ARCH-000011
 * @input capability: 検証済みRepository Root能力、area: 宣言済み領域名。
 * @returns ready、not_observed、blockedの閉じた観測結果。
 * @precondition Callerは公開されたRepository Root能力を渡す。
 * @postcondition readyではRootとareaのlstat/realpath相関を確認済みである。
 * @effect Filesystem metadataとVCS境界を読む。Ignore登録、mkdir、Lock、書込みは0。
 * @failure 無効能力、link/type不正、観測障害を閉じたreasonで返す。
 * @invariant ENOENTだけをnot_observedとし、時刻やmtimeをIdentityに使わない。
 * @boundary private Runtime Rootと公開された名前付きareaの観測境界。
 * @security raw Root、秘密値、回復Authorityを公開しない。
 * @concurrency 開始・終了の不透明Identity比較で境界置換を検出できる。将来の状態を保証しない。
 */
export function observeRepositoryExecutionDataArea(
  capability: Repository,
  area: RepositoryExecutionArea,
): RepositoryExecutionDataAreaObservation {
  try {
    const paths = resolveRepositoryExecutionDataPathsForInternalUse(capability);
    if (!paths || !REPOSITORY_AREAS.includes(area))
      return Object.freeze({
        status: "blocked",
        reason: "repository_runtime_data_root_capability_invalid",
        effectIssued: false,
      });
    const directory = paths[AREA_PATH_KEYS[area]];
    const identities: string[] = [];
    for (const target of [paths.root, directory]) {
      let metadata: fs.BigIntStats;
      try {
        metadata = fs.lstatSync(target, { bigint: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          return Object.freeze({
            status: "not_observed",
            reason: "repository_runtime_data_area_absent",
            effectIssued: false,
          });
        throw error;
      }
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.realpathSync.native(target) !== target
      )
        return Object.freeze({
          status: "blocked",
          reason: "repository_runtime_data_area_boundary_invalid",
          effectIssued: false,
        });
      const canonical = fs.lstatSync(fs.realpathSync.native(target), {
        bigint: true,
      });
      if (canonical.dev !== metadata.dev || canonical.ino !== metadata.ino)
        return Object.freeze({
          status: "blocked",
          reason: "repository_runtime_data_area_boundary_invalid",
          effectIssued: false,
        });
      identities.push(metadata.dev.toString(), metadata.ino.toString());
    }
    const boundaryIdentity = createHash("sha256")
      .update(identities.join("\0"))
      .digest("hex");
    return Object.freeze({
      status: "ready",
      repositoryRoot: paths.repositoryRoot,
      directory,
      boundaryIdentity,
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

/**
 * Repository Runtime Data Paths From Working Directoryを一意に解決する。
 *
 * @responsibility Repository Runtime Data Paths From Working Directoryの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input workingDirectory: unknown
 * @returns resolveRepositoryExecutionDataPathsFromWorkingDirectoryの計算結果を返す。
 * @precondition 「workingDirectory: unknown」がresolveRepositoryExecutionDataPathsFromWorkingDirectoryの入力契約を満たす。
 * @postcondition resolveRepositoryExecutionDataPathsFromWorkingDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryExecutionDataPathsFromWorkingDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryExecutionDataPathsFromWorkingDirectoryは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryExecutionDataPathsFromWorkingDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryExecutionDataPathsFromWorkingDirectoryはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveRepositoryExecutionDataPathsFromWorkingDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveRepositoryExecutionDataPathsFromWorkingDirectoryは共有非同期状態を持たない同期処理である。
 */
export function resolveRepositoryExecutionDataPathsFromWorkingDirectory(
  workingDirectory: unknown,
) {
  const verified = getRepositoryFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? resolveRepositoryExecutionDataPaths(verified.capability)
    : null;
}

export type RepositoryExecutionArea = "domain-model" | "tmp" | "lock";

export type RepositoryExecutionDataAreaObservation =
  | Readonly<{
      status: "ready";
      repositoryRoot: string;
      directory: string;
      boundaryIdentity: string;
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
 * @input capability: 検証済みRepository Root。
 * @returns 新規領域の境界観測とEffect情報、または停止。
 * @precondition Repository-localの.crdd親が既に正規配置で存在する。
 * @postcondition 既存ready領域を新品として返さない。
 * @effect 固定domain-model領域だけを排他的に作成する。
 * @failure 既存領域、alias、親置換、観測不能では停止し、自動削除しない。
 * @invariant 空観測やensureによる再利用を初期化証拠にしない。
 * @boundary Runtime Dataの領域作成からCoordinator初期化Owner。
 * @security 任意Path、旧保存形式や操作Authorityを受理しない。
 * @concurrency 呼出し側のCoordinator排他に加え、mkdirのEEXISTで競合作成を拒否する。
 */
export function createExecutionDataArea(capability: Repository) {
  let effectIssued = false;
  try {
    const paths = resolveRepositoryExecutionDataPathsForInternalUse(capability);
    if (!paths) throw new Error("root");
    const root = fs.lstatSync(paths.root, { bigint: true });
    if (
      !root.isDirectory() ||
      root.isSymbolicLink() ||
      fs.realpathSync.native(paths.root) !== paths.root
    )
      throw new Error("parent");
    assertExecutionStateInitializationBoundary(capability);
    if (
      observeRepositoryExecutionDataArea(capability, "domain-model").status !==
      "not_observed"
    )
      throw new Error("existing");
    const before = fs.lstatSync(paths.root, { bigint: true });
    if (root.dev !== before.dev || root.ino !== before.ino)
      throw new Error("parent_changed");
    effectIssued = true;
    fs.mkdirSync(paths.domainModel, { mode: 0o700 });
    assertExecutionStateInitializationBoundary(capability);
    const after = fs.lstatSync(paths.root, { bigint: true });
    const observation = observeRepositoryExecutionDataArea(
      capability,
      "domain-model",
    );
    if (
      root.dev !== after.dev ||
      root.ino !== after.ino ||
      observation.status !== "ready" ||
      fs.readdirSync(paths.domainModel).length !== 0
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
 * 旧保存先を残した空の新版初期化を拒否する。
 * @responsibility 旧領域の明示不存在と親の同一性だけを検査する。
 * @trace ARCH-000011
 * @input capability: 現在の真正Repository Root。
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
  capability: Repository,
): void {
  const paths = resolveRepositoryExecutionDataPathsForInternalUse(capability);
  if (!paths) throw new Error("runtime_initialization_boundary_unavailable");
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
    fs.lstatSync(path.join(paths.root, "coordinator"));
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
 * 宣言済みRuntime領域を、ローカル除外の確定後だけ作成する。
 * @responsibility VCの完成した登録結果を受け、保存領域の判断と失敗情報を保持する。
 * @trace ARCH-000011
 * @effect 除外登録後に既存のRepository内領域を作成する。
 * @failure 除外のEffect不明・回収不明はblockedのまま返し、領域を作らない。
 */
export function ensureRepositoryExecutionDataArea(
  capability: Repository,
  area: RepositoryExecutionArea,
) {
  const paths = resolveRepositoryExecutionDataPathsForInternalUse(capability);
  if (!paths || !REPOSITORY_AREAS.includes(area)) return null;
  const ignore = registerRepositoryLocalIgnore(capability, ".crdd/");
  if (ignore.status !== "registered")
    return Object.freeze({
      status: "blocked" as const,
      reason: "repository_runtime_data_ignore_registration_blocked" as const,
      effectIssued: ignore.effectIssued,
      effectStateUnknown: ignore.effectStateUnknown,
      effectConfirmation: ignore.effectConfirmation,
      cleanupConfirmed: ignore.cleanupConfirmed,
      retryAllowed: ignore.retryAllowed,
      recoveryReference: ignore.recoveryReference,
      repositoryPathReported: false as const,
    });
  ensureCanonicalDirectory(paths.root);
  const directory = paths[AREA_PATH_KEYS[area]];
  ensureCanonicalDirectory(directory);
  return Object.freeze({
    status: "ready" as const,
    repositoryRoot: paths.repositoryRoot,
    directory,
  });
}

/**
 * Repository Runtime Data Area From Working Directoryが成立する状態を確保する。
 *
 * @responsibility Repository Runtime Data Area From Working Directoryの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000011
 * @input workingDirectory: unknown、area: RepositoryExecutionArea
 * @returns ensureRepositoryExecutionDataAreaFromWorkingDirectoryの計算結果を返す。
 * @precondition 「workingDirectory: unknown、area: RepositoryExecutionArea」がensureRepositoryExecutionDataAreaFromWorkingDirectoryの入力契約を満たす。
 * @postcondition ensureRepositoryExecutionDataAreaFromWorkingDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: ensureRepositoryExecutionDataAreaFromWorkingDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ensureRepositoryExecutionDataAreaFromWorkingDirectoryは独自の失敗分岐を所有しない。
 * @invariant ensureRepositoryExecutionDataAreaFromWorkingDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ensureRepositoryExecutionDataAreaFromWorkingDirectoryはProcess内の同一Subsystemで完結する。
 * @security N/A: ensureRepositoryExecutionDataAreaFromWorkingDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ensureRepositoryExecutionDataAreaFromWorkingDirectoryは共有非同期状態を持たない同期処理である。
 */
export function ensureRepositoryExecutionDataAreaFromWorkingDirectory(
  workingDirectory: unknown,
  area: RepositoryExecutionArea,
) {
  const verified = getRepositoryFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? ensureRepositoryExecutionDataArea(verified.capability, area)
    : null;
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
 * Windowsの符号付き64bit File IDを同じ実体の符号なし表現に揃える。
 * @responsibility Readerと保存Writerの同一性比較で同じ表現規則を使う。
 * @trace ARCH-000014
 * @input ino: OSから観測したFile ID。
 * @returns Windowsの有効な負の64bit表現だけを正規化する。
 * @precondition 呼出し側がFile Identity全体の妥当性を検査する。
 * @postcondition 同じ64bit IDの意味を変えず、範囲外の値を補正しない。
 * @effect N/A: 入力値だけを変換する。
 * @failure N/A: 不正値の拒否は呼出し側が所有する。
 * @invariant Windows以外と他のIdentity項目を変更しない。
 * @boundary Process内の保存部品。
 * @security 異なるFile IDを同一と扱わない。
 * @concurrency N/A: 共有状態を持たない。
 */
function normalizeFileId(ino: bigint): bigint {
  return process.platform === "win32" &&
    typeof ino === "bigint" &&
    ino >= -(1n << 63n) &&
    ino < 0n
    ? BigInt.asUintN(64, ino)
    : ino;
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
 * @input file: string
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
export function readStableFileSnapshot(file: string) {
  if (!path.isAbsolute(file)) throw new Error("file_snapshot_invalid");
  const resolved = path.resolve(file);
  const before = identity(fs.lstatSync(resolved, { bigint: true }));
  if (fs.realpathSync.native(resolved) !== resolved)
    throw new Error("file_snapshot_invalid");
  const descriptor = fs.openSync(resolved, fs.constants.O_RDONLY);
  try {
    const opened = identity(fs.fstatSync(descriptor, { bigint: true }));
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
    const pathAfter = identity(fs.lstatSync(resolved, { bigint: true }));
    if (
      byteLength !== Number(opened.size) ||
      !sameStableFileIdentity(opened, after) ||
      !sameStableFileIdentity(opened, pathAfter) ||
      fs.realpathSync.native(resolved) !== resolved
    )
      throw new Error("file_snapshot_changed");
    return Object.freeze({
      path: resolved,
      identity: opened,
      bytes: Buffer.concat(chunks, byteLength),
    });
  } finally {
    fs.closeSync(descriptor);
  }
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
    const root = getRepository(owner.repositoryRoot);
    if (root.status !== "completed") return blocked;
    const area = observeRepositoryExecutionDataArea(
      root.capability,
      "domain-model",
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
    const stateBytes = Buffer.from(
      `${encodeStateValue(state.value.snapshot)}\n`,
    );
    const currentFile = path.join(directory, "history.jsonl"),
      pendingFile = path.join(directory, "history.pending.jsonl");
    // 新しい業務更新より先に、前回の物理出版だけを完了する。
    if (mode === "resume_decision" && readHistoryFile(pendingFile) === null)
      return {
        status: "completed" as const,
        reason: "coordinator_history_no_pending",
      };
    const assertOwner = () => {
      const fresh = observeRepositoryExecutionDataArea(
        root.capability,
        "domain-model",
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
    const rows = decodeHistoryRows(before);
    if (!rows || rows.some((row) => Date.parse(row.occurredAt) > now))
      return blocked;
    const parsed: unknown = recordJson === null ? [] : JSON.parse(recordJson);
    const incoming = Array.isArray(parsed) ? parsed : [parsed];
    const known = new Map<string, Buffer>(
      rows.map((row) => [row.recoveryId, Buffer.from(row.line)]),
    );
    const additions: Buffer[] = [];
    for (const value of incoming) {
      const record = historyRow(value, now);
      const line = taskHistoryLine(record);
      const id = `task-history.${record.id}`;
      const same = known.get(id);
      if (same && !line.equals(same)) return blocked;
      if (!same) {
        known.set(id, line);
        additions.push(line);
      }
    }
    // 未搬送の判断履歴はStateの元記録から再構成する。別のpending集合は持たない。
    for (const decision of state.value.snapshot.decisions) {
      const events = projectDecisionHistory(decision);
      if (!events) return blocked;
      for (const event of events) {
        if (Date.parse(event.occurredAt) > now) return blocked;
        const line = decisionHistoryLine(event);
        const id = `decision-history.${event.eventId}`;
        const same = known.get(id);
        if (same && !line.equals(same)) return blocked;
        if (!same) {
          known.set(id, line);
          additions.push(line);
        }
      }
    }
    const joined = additions.length
      ? Buffer.concat([before, ...additions])
      : before;
    // 判断の出版と期限整理を分離し、再入場の候補を時刻経過だけで変形しない。
    const after =
      mode === "update"
        ? prepareHistoryRetention(
            stateBytes,
            joined,
            new Date(now).toISOString(),
            policy,
            owner.repositoryBinding,
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
  workingDirectory: string | Repository | HistoryRepositoryInput,
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
    const root = getRepository(owner.repositoryRoot);
    if (root.status !== "completed") return null;
    const area = observeRepositoryExecutionDataArea(
      root.capability,
      "domain-model",
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
    const final = observeRepositoryExecutionDataArea(
      root.capability,
      "domain-model",
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
    const root = getRepository(owner.repositoryRoot);
    if (root.status !== "completed") return null;
    const area = observeRepositoryExecutionDataArea(
      root.capability,
      "domain-model",
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
    const final = observeRepositoryExecutionDataArea(
      root.capability,
      "domain-model",
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
    result: Exclude<
      ReturnType<typeof ensureRepositoryExecutionDataArea>,
      null | { status: "ready" }
    >,
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

/**
 * 検証済みRootから名前付きPathだけを投影する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns 公開投影または無効Rootのnull。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect VCSとFilesystemを読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary Coordinator永続基盤からRuntime Data/Version Control公開入口。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */

export function resolveNamedPaths(workingDirectory: string) {
  const verified = getRepositoryFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? resolveRepositoryExecutionDataPaths(verified.capability)
    : null;
}

/**
 * 既存の名前付き領域をEffect0で観測する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns readyまたは真正不存在のnot_observed。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect VCSとFilesystemを読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary Coordinator永続基盤からRuntime Data/Version Control公開入口。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */
export function observeArea(
  repositoryRoot: string,
  area: "domain-model" | "tmp" | "lock",
) {
  const verified = getRepository(repositoryRoot);
  if (verified.status !== "completed")
    throw new Error("orchestrator_repository_root_invalid");
  const observation = observeRepositoryExecutionDataArea(
    verified.capability,
    area,
  );
  if (observation.status === "blocked") throw new Error(observation.reason);
  if (
    observation.status === "ready" &&
    observation.repositoryRoot !== repositoryRoot
  )
    throw new Error("orchestrator_repository_root_invalid");
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
 * @effect VCSとFilesystemを読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary Coordinator永続基盤からRuntime Data/Version Control公開入口。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */
export function assertArea(
  repositoryRoot: string,
  area: "domain-model" | "tmp" | "lock",
  directory: string,
) {
  const observation = observeArea(repositoryRoot, area);
  if (observation.status !== "ready" || observation.directory !== directory)
    throw new Error("orchestrator_storage_boundary_invalid");
  return observation;
}

/**
 * I/O前後の同じ境界観測を照合する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns N/A: 一致確認のみ。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect VCSとFilesystemを読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary Coordinator永続基盤からRuntime Data/Version Control公開入口。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */
export function assertAreaUnchanged(
  repositoryRoot: string,
  area: "domain-model" | "tmp" | "lock",
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
    throw new Error("orchestrator_storage_boundary_changed");
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
    throw new Error("orchestrator_lease_acquisition_inventory_invalid");
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
    throw new Error("orchestrator_storage_boundary_invalid");
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
    throw new Error("orchestrator_storage_identity_invalid");
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
    throw new Error("orchestrator_storage_boundary_invalid");
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
  workingDirectory: string | Repository,
  binding: string,
  readMode: boolean | "history" = false,
): StoreResult<Snapshot | null> {
  if (!validId(binding)) return blocked("orchestrator_snapshot_input_invalid");
  const acquired = acquireSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const lock = acquired.value;
  const outcome =
    readMode === false
      ? readSnapshotOwned(lock, binding)
      : readSnapshotOwned(lock, binding, readMode);
  if (!lock.release())
    return blocked("orchestrator_snapshot_lock_release_unconfirmed", true);
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
    return blocked("orchestrator_snapshot_lock_owner_invalid", true);
  const observed = readStorageSnapshotOwned(lock, readMode);
  if (observed.status !== "completed")
    return observed.reason === "coordinator_state_uninitialized"
      ? completed("orchestrator_snapshot_absent", null)
      : blocked(observed.reason, true);
  if (!observed.value)
    return blocked("orchestrator_snapshot_invalid_or_unconfirmed", true);
  const decoded = decodeStateSnapshot(
    Buffer.from(`${encodeStateValue(observed.value.snapshot)}\n`),
    lock.repositoryBinding,
  );
  if (!decoded)
    return blocked("orchestrator_snapshot_invalid_or_unconfirmed", true);
  const value = projectTaskSnapshot(decoded, lock.repositoryRootHash);
  if (value && value.repositoryBindingId !== binding)
    return blocked("orchestrator_snapshot_binding_invalid", true);
  return completed(
    value ? "orchestrator_snapshot_observed" : "orchestrator_snapshot_absent",
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
    recordStrategy:
      "single_current_snapshot_with_pending_atomic_replace_and_exact_readback",
    queueMutation: "short_exclusive_repository_local_lock",
    operationLease:
      "exclusive_lock_with_owner_generation_and_no_stale_takeover",
    adoptionLease: "separate_exclusive_lock_with_no_stale_takeover",
    staleLockDisposition: "blocked_manual_reconciliation_required_before_reuse",
    externalWaitWhileMutationLockHeld: false,
    taskManagementCapabilityComplete: false,
  });
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
  hostCleanupRecoveryId: string | null = null,
  currentHistoryRecoveryId: string | null = null,
  currentCompletionRecoveryId: string | null = null,
  currentHistoryKind: "docker_task" | "runtime_repair" = "docker_task",
  currentCompletionKind: "docker_task" | "runtime_repair" = "docker_task",
  allowUninitialized = false,
  resourcePublicationRecoveryId: string | null = null,
  completedOperation: Readonly<{
    recoveryId: string;
    correlationId: string;
  }> | null = null,
  storageOwner: StorageOwner | null = null,
  taskPublicationRead: boolean | "history" = false,
  initialHostRecoveryId: string | null = null,
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
      hostCleanupPublication: null,
      currentHistoryPublication: null,
      repairHistoryState: null,
      currentCompletionPublication: null,
      repairCompletionAbsent: false,
      repairRetentionReviewAfter: null,
      resourcePublication: null,
      unsubmittedHostRecoveryIds: Object.freeze([] as string[]),
      historyRows: null,
    });
  if (!repository) return blocked("coordinator_state_owner_invalid", true);
  const borrowedOwner = storageOwner
    ? borrowStorageOwner(storageOwner, repository)
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
  let unsubmittedHostRecoveryIds: readonly string[] = Object.freeze([]);
  let resourcePublication: Readonly<{
    before: Buffer;
    candidate: Buffer;
  }> | null = null;
  let hostCleanupPublication: Readonly<{
    before: Buffer;
    candidate: Buffer;
    mode: "A" | "B" | "C";
  }> | null = null;
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
    operationKind: "docker_task" | "runtime_repair";
    before: Buffer;
    candidate: Buffer;
    stage: "checkpoint" | "publish" | "confirmed";
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
    const verified = getRepository(repository.repositoryRoot);
    if (
      verified.status !== "completed" ||
      !repository.revalidate() ||
      !lock.assertLive()
    )
      throw new Error("owner");
    const initial = observeRepositoryExecutionDataArea(
      verified.capability,
      "domain-model",
    );
    if (allowUninitialized && initial.status === "not_observed") {
      const fresh = observeRepositoryExecutionDataArea(
        verified.capability,
        "domain-model",
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
              hostCleanupRecoveryId !== null ||
              currentCompletionRecoveryId !== null
            ? ["state.json", "history.jsonl", "state.pending.json"]
            : ["state.json", "history.jsonl"];
    if (names.some((name) => !allowedNames.includes(name))) {
      reason = "coordinator_state_reentry_required";
      throw new Error("pending_or_unknown_content");
    }
    const file = path.join(initial.directory, "state.json");
    const metadata = fs.lstatSync(file);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1)
      throw new Error("file");
    const observed = readStableFileSnapshot(file);
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
        summary.schema !== "crdd-execution-model/operation-summary/v5" ||
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
      resourcePublication = Object.freeze({
        before: Buffer.from(observed.bytes),
        candidate: Buffer.from(pending.bytes),
      });
    }
    if (hostCleanupRecoveryId !== null) {
      const operation = decoded.snapshot.operations.find(
        (item): item is ExecutionOperationRecord =>
          item.kind === "docker_task" &&
          item.recoveryId === hostCleanupRecoveryId,
      );
      if (
        !operation ||
        operation.lease === "released" ||
        operation.outcome?.cleanupConfirmed === true ||
        operation.history !== null ||
        !["pending", "unknown", "confirmed"].includes(operation.host.cleanup) ||
        operation.host.pendingTransitionJson !== null ||
        operation.execution.ownerEffect !== "disabled" ||
        !areTaskResourcesSettled(operation)
      )
        throw new Error("host_cleanup_reentry_target_invalid");
      const current = Buffer.from(`${encodeStateValue(decoded.snapshot)}\n`);
      const candidate =
        operation.host.cleanup === "confirmed"
          ? current
          : prepareStateHostSnapshot(
              current,
              hostCleanupRecoveryId,
              { ...operation.host, cleanup: "confirmed" },
              repository.repositoryBinding,
            );
      if (!candidate) throw new Error("host_cleanup_reentry_candidate_invalid");
      if (names.includes("state.pending.json")) {
        const metadata = fs.lstatSync(pendingFile);
        if (
          !metadata.isFile() ||
          metadata.isSymbolicLink() ||
          metadata.nlink !== 1
        )
          throw new Error("pending_file");
        pending = readStableFileSnapshot(pendingFile);
        if (
          operation.host.cleanup === "confirmed" ||
          !pending.bytes.equals(candidate)
        )
          throw new Error("host_cleanup_reentry_candidate_mismatch");
      }
      hostCleanupPublication = Object.freeze({
        before: current,
        candidate: Buffer.from(candidate),
        mode:
          operation.host.cleanup === "confirmed" ? "C" : pending ? "B" : "A",
      });
    }
    const currentPublicationRecoveryId =
      currentHistoryRecoveryId ?? currentCompletionRecoveryId;
    if (
      currentCompletionRecoveryId !== null &&
      currentCompletionKind === "runtime_repair" &&
      !decoded.snapshot.operations.some(
        (item) => item.recoveryId === currentCompletionRecoveryId,
      )
    ) {
      if (
        hostCleanupRecoveryId !== null ||
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
              ("identityJson" in item
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
        summary.outcome.reason !== "runtime_repair_recovered" ||
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
        hostCleanupRecoveryId !== null ||
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
        operation?.kind === "runtime_repair" &&
        ((operation.phase === "repairing" && operation.outcome === null) ||
          (currentHistoryRecoveryId !== null &&
            currentHistoryKind === "runtime_repair" &&
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
      if (
        !operation ||
        (operation.kind === "runtime_repair"
          ? (!technicalState &&
              !prepareRepairHistorySummary(
                observed.bytes,
                operation.recoveryId,
                repository.repositoryBinding,
              )) ||
            (repository.operationId !== undefined &&
              JSON.parse(operation.identityJson).operationId !==
                repository.operationId)
          : operation.phase === "executing" ||
            operation.lease !== "released" ||
            operation.execution.ownerEffect !== "disabled" ||
            !operation.outcome?.cleanupConfirmed ||
            operation.host.cleanup !== "confirmed" ||
            operation.host.pendingTransitionJson !== null ||
            !areTaskResourcesSettled(operation) ||
            !isDockerRestartCheckpointSettled(operation.dockerRestart))
      )
        throw new Error("history_terminal_unconfirmed");
      for (const name of [
        "history.jsonl",
        "history.pending.jsonl",
        "state.pending.json",
      ] as const) {
        if (!names.includes(name)) continue;
        const target = path.join(initial.directory, name),
          metadata = fs.lstatSync(target);
        if (
          !metadata.isFile() ||
          metadata.isSymbolicLink() ||
          metadata.nlink !== 1
        )
          throw new Error("history_file");
        const contents = readStableFileSnapshot(target);
        if (name === "history.jsonl") recoveryHistory = contents;
        else if (name === "history.pending.jsonl")
          recoveryHistoryPending = contents;
        else pending = contents;
      }
      const before = Buffer.from(`${encodeStateValue(decoded.snapshot)}\n`);
      let candidate: Buffer | null = null;
      let stage: "checkpoint" | "publish" | "confirmed" | null = null;
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
          currentCompletionKind === "runtime_repair"
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
          currentCompletionKind === "runtime_repair"
            ? prepareStateRepairCompletionSnapshot
            : prepareStateCompletionSnapshot
        )(before, currentCompletionRecoveryId, repository.repositoryBinding);
        if (
          !operation.history?.confirmed ||
          !line ||
          !rows ||
          (currentCompletionKind === "runtime_repair" && !row) ||
          (row && !Buffer.from(row.line).equals(line)) ||
          createHash("sha256").update(line).digest("hex") !==
            operation.history.lineSha256 ||
          recoveryHistoryPending ||
          !candidate ||
          (pending && !pending.bytes.equals(candidate))
        )
          throw new Error("current_completion_target_invalid");
        if (currentCompletionKind === "runtime_repair")
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
          (item) =>
            item.kind === expectedKind &&
            item.recoveryId === currentHistoryRecoveryId,
        );
        if (pending && (!target?.history || target.history.confirmed))
          throw new Error("history_checkpoint_target_invalid");
        candidate = (
          operation.kind === "runtime_repair"
            ? prepareRepairHistorySnapshot
            : prepareStateHistorySnapshot
        )(
          before,
          currentHistoryRecoveryId,
          target?.history?.occurredAt ??
            (operation.kind === "runtime_repair"
              ? operation.retention?.decidedAt
              : undefined) ??
            new Date().toISOString(),
          false,
          repository.repositoryBinding,
        );
        stage = "checkpoint";
      } else if (!operation.history.confirmed) {
        const configuration = readHistoryRetentionDays(repository);
        if (configuration === null) throw new Error("history_config_invalid");
        recoveryRetentionDays = configuration;
        const publication = (
          operation.kind === "runtime_repair"
            ? prepareRepairHistoryPublication
            : prepareRecoveredHistoryPublication
        )(
          before,
          currentHistoryRecoveryId,
          recoveryHistory?.bytes ?? Buffer.alloc(0),
          recoveryHistoryPending?.bytes ?? null,
          recoveryRetentionDays,
          repository.repositoryBinding,
        );
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
        const line = (
          operation.kind === "runtime_repair"
            ? prepareRepairHistoryLine
            : prepareStateHistoryLine
        )(before, currentHistoryRecoveryId, repository.repositoryBinding);
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
        if (operation.kind === "runtime_repair")
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
        typeof repository.operationId !== "string" ||
        JSON.parse(operation.identityJson).operationId !==
          repository.operationId
      ) {
        reason = "coordinator_state_settlement_target_invalid";
        throw new Error("settlement_target");
      }
    }
    const finalFile = fs.lstatSync(file, { bigint: true });
    const freshRoot = getRepository(repository.repositoryRoot);
    if (freshRoot.status !== "completed") throw new Error("root");
    const fresh = observeRepositoryExecutionDataArea(
      freshRoot.capability,
      "domain-model",
    );
    if (
      !repository.revalidate() ||
      !lock.assertLive() ||
      (
        [
          ["history.jsonl", recoveryHistory],
          ["history.pending.jsonl", recoveryHistoryPending],
        ] as const
      ).some(
        ([name, entry]) =>
          entry !== null &&
          (!sameStableFileIdentity(
            entry.identity,
            fs.lstatSync(path.join(initial.directory, name), { bigint: true }),
          ) ||
            fs.lstatSync(path.join(initial.directory, name), { bigint: true })
              .nlink !== 1n),
      ) ||
      ((currentPublicationRecoveryId !== null || includeHistory) &&
        (names.includes("history.jsonl") !==
          fs.readdirSync(initial.directory).includes("history.jsonl") ||
          names.includes("history.pending.jsonl") !==
            fs
              .readdirSync(initial.directory)
              .includes("history.pending.jsonl") ||
          (recoveryRetentionDays !== null &&
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
        (!sameStableFileIdentity(
          completedHistory.identity,
          fs.lstatSync(completedHistoryFile, { bigint: true }),
        ) ||
          fs.lstatSync(completedHistoryFile, { bigint: true }).nlink !== 1n)) ||
      (pending !== null &&
        (!sameStableFileIdentity(
          pending.identity,
          fs.lstatSync(pendingFile, { bigint: true }),
        ) ||
          fs.lstatSync(pendingFile, { bigint: true }).nlink !== 1n)) ||
      names.includes("state.pending.json") !==
        fs.readdirSync(initial.directory).includes("state.pending.json") ||
      fs
        .readdirSync(initial.directory)
        .some((name) => !allowedNames.includes(name))
    )
      throw new Error("changed");
    const initialHostOperation =
      initialHostRecoveryId === null
        ? null
        : decoded.snapshot.operations.find(
            (operation) => operation.recoveryId === initialHostRecoveryId,
          );
    unsubmittedHostRecoveryIds = Object.freeze(
      initialHostOperation?.kind === "docker_task" &&
        isInitialOperationHost(initialHostOperation, decoded.snapshot)
        ? [initialHostOperation.recoveryId]
        : [],
    );
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
    hostCleanupPublication,
    currentHistoryPublication,
    repairHistoryState,
    currentCompletionPublication,
    repairCompletionAbsent,
    repairRetentionReviewAfter,
    resourcePublication,
    unsubmittedHostRecoveryIds,
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
  let metadata: fs.Stats;
  try {
    metadata = fs.lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (identities.has(name)) throw new Error("file_disappeared");
    assertBoundary();
    return null;
  }
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1)
    throw new Error("file");
  const observed = readStableFileSnapshot(file);
  const expected = identities.get(name);
  if (expected && !sameStableFileIdentity(expected, observed.identity))
    throw new Error("file_replaced");
  identities.set(name, observed.identity);
  if (fs.lstatSync(file).nlink !== 1) throw new Error("links");
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
 * @concurrency 同じMapと動的なassertBoundaryを読戻しにも使用する。
 */
export function createExecutionStatePendingFile(
  directory: string,
  name: StatePendingFileName,
  content: Buffer,
  identities: Map<string, StableFileIdentity>,
  assertBoundary: () => void,
  markEffect: () => void,
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
    assertBoundary,
  );
  if (!saved?.equals(content)) throw new Error("readback");
}

/**
 * 出版直前の固定ファイルを同じ実体のdescriptorでflushする。
 * @responsibility 三つの既存出版箇所の照合・発行記録・closeの順序を保持する。
 * @trace ARCH-000008
 * @input 検証済み領域、固定対象名、同じ取引の実体Mapと既存Ownerの照合・発行記録。
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
    if (
      !expected ||
      !sameStableFileIdentity(
        expected,
        fs.fstatSync(descriptor, { bigint: true }),
      )
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
