/**
 * 共通の保存形式・Filesystem入出力と一時保存資源を管理する。
 * @responsibility 共通の保存形式・Filesystem入出力と一時保存資源を管理する。
 * @trace ARCH-000008
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Lock } from "../../../lock/src/index.ts";
import { acquireLock } from "../../../lock/src/index.ts";
import type { Repository } from "../../../version-control/src/index.ts";
import {
  getRepository,
  getRepositoryFromWorkingDirectory,
  registerRepositoryLocalIgnore,
  resolveVerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";
import type { CoordinatorStateTaskOperation } from "../attempt/types.ts";
import {
  coordinatorTaskResourcesAreSettled,
  dockerRuntimeRepairDisposalIsSettled,
  isDockerRestartCheckpointSettled,
  parseDockerTaskRecoveryId,
} from "../attempt/validation.ts";
import type { Decision, DecisionHistoryEvent } from "../decision/types.ts";
import {
  inspectDecisionHistoryEvent,
  projectDecisionHistory,
} from "../decision/validation.ts";
import type { HistoryRow } from "../history/types.ts";
import {
  decodeCoordinatorHistoryRows,
  prepareCoordinatorHistoryRetention,
} from "../history/validation.ts";
import type { CoordinatorSnapshot } from "../state/types.ts";
import {
  COORDINATOR_DURABLE_FOUNDATION_CONTRACT,
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  classifyCoordinatorResourcePublication,
  decodeRuntimeDomainSnapshot,
  encodeRuntimeStateValue,
  historyRow,
  prepareCoordinatorRecoveredHistoryPublication,
  prepareCoordinatorRepairHistoryLine,
  prepareCoordinatorRepairHistoryPublication,
  prepareCoordinatorRepairHistorySnapshot,
  prepareCoordinatorRepairHistorySummary,
  prepareCoordinatorStateCompletionSnapshot,
  prepareCoordinatorStateHistoryLine,
  prepareCoordinatorStateHistorySnapshot,
  prepareCoordinatorStateHostSnapshot,
  prepareCoordinatorStateRepairCompletionSnapshot,
  prepareCoordinatorStateResultDeliverySnapshot,
  validId,
} from "../state/validation.ts";
import {
  coordinatorConsumerCompletionPolicy,
  projectCoordinatorTaskSnapshot,
} from "../task/validation.ts";
import type {
  CoordinatorSnapshotOwner,
  CoordinatorStorageOwner,
  HistoryRepositoryInput,
  StoreResult,
} from "./lock.ts";
import {
  acquireCoordinatorSnapshotPilotLock,
  acquireCoordinatorStorageOwner,
  acquireCoordinatorStorageOwnerForRepository,
  acquireRuntimeStateLock,
  blocked,
  borrowCoordinatorStorageOwner,
  completed,
  isLiveCoordinatorSnapshotOwner,
  isLiveCoordinatorStorageOwner,
  observeRuntimeExecutionRepository,
  observeRuntimeRecoveryRepository,
  readCoordinatorStorageOwnerBinding,
  readHistoryRetentionDays,
  storageLockFailure,
} from "./lock.ts";

/**
 * require Ready Repository Runtime Data Areaを決定する。
 *
 * @responsibility require Ready Repository Runtime Data Areaの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000011
 * @input result: ReturnType<typeof ensureRepositoryRuntimeDataArea>、invalidReason: string
 * @returns requireReadyRepositoryRuntimeDataAreaの計算結果を返す。
 * @precondition 「result: ReturnType<typeof ensureRepositoryRuntimeDataArea>、invalidReason: string」がrequireReadyRepositoryRuntimeDataAreaの入力契約を満たす。
 * @postcondition requireReadyRepositoryRuntimeDataAreaの責務を完了した結果だけを返す。
 * @effect N/A: requireReadyRepositoryRuntimeDataAreaは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requireReadyRepositoryRuntimeDataAreaは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requireReadyRepositoryRuntimeDataAreaは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requireReadyRepositoryRuntimeDataAreaはProcess内の同一Subsystemで完結する。
 * @security N/A: requireReadyRepositoryRuntimeDataAreaはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: requireReadyRepositoryRuntimeDataAreaは共有非同期状態を持たない同期処理である。
 */
export function requireReadyRepositoryRuntimeDataArea(
  result: ReturnType<typeof ensureRepositoryRuntimeDataArea>,
  invalidReason: string,
) {
  if (result?.status === "ready") return result;
  if (result?.status === "blocked")
    throw new RepositoryRuntimeDataAreaBlockedError(result);
  throw new Error(invalidReason);
}

/** 保存先はPackage名でなく既存永続所在の契約。 */
export const REPOSITORY_AREAS = Object.freeze(["domain-model", "tmp"] as const);

export const AREA_PATH_KEYS = Object.freeze({
  "domain-model": "domainModel",
  tmp: "temporary",
} as const);

/**
 * Resolves only canonical paths. The caller remains responsible for proving
 *
 * @responsibility Repository Runtime Data Paths From Validated Rootの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input repositoryRoot: string
 * @returns resolveRepositoryRuntimeDataPathsFromValidatedRootの計算結果を返す。
 * @precondition 「repositoryRoot: string」がresolveRepositoryRuntimeDataPathsFromValidatedRootの入力契約を満たす。
 * @postcondition resolveRepositoryRuntimeDataPathsFromValidatedRootの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryRuntimeDataPathsFromValidatedRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryRuntimeDataPathsFromValidatedRootは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryRuntimeDataPathsFromValidatedRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryRuntimeDataPathsFromValidatedRootはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveRepositoryRuntimeDataPathsFromValidatedRootはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveRepositoryRuntimeDataPathsFromValidatedRootは共有非同期状態を持たない同期処理である。
 */
function resolveRepositoryRuntimeDataPathsFromValidatedRoot(
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
    allowedTopLevelAreas: REPOSITORY_AREAS,
  });
}

/**
 * Repository Runtime Data Pathsを一意に解決する。
 *
 * @responsibility Repository Runtime Data Pathsの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input capability: Repository
 * @returns resolveRepositoryRuntimeDataPathsの計算結果を返す。
 * @precondition 「capability: Repository」がresolveRepositoryRuntimeDataPathsの入力契約を満たす。
 * @postcondition resolveRepositoryRuntimeDataPathsの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryRuntimeDataPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryRuntimeDataPathsは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryRuntimeDataPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryRuntimeDataPathsはProcess内の同一Subsystemで完結する。
 * @security resolveRepositoryRuntimeDataPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRepositoryRuntimeDataPathsは共有非同期状態を持たない同期処理である。
 */
export function resolveRepositoryRuntimeDataPaths(capability: Repository) {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  if (repositoryRoot === null) return null;
  const resolved =
    resolveRepositoryRuntimeDataPathsFromValidatedRoot(repositoryRoot);
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
 * @returns resolveRepositoryRuntimeDataPathsForInternalUseの計算結果を返す。
 * @precondition 「capability: Repository」がresolveRepositoryRuntimeDataPathsForInternalUseの入力契約を満たす。
 * @postcondition resolveRepositoryRuntimeDataPathsForInternalUseの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryRuntimeDataPathsForInternalUseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryRuntimeDataPathsForInternalUseは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryRuntimeDataPathsForInternalUseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryRuntimeDataPathsForInternalUseはProcess内の同一Subsystemで完結する。
 * @security resolveRepositoryRuntimeDataPathsForInternalUseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRepositoryRuntimeDataPathsForInternalUseは共有非同期状態を持たない同期処理である。
 */
export function resolveRepositoryRuntimeDataPathsForInternalUse(
  capability: Repository,
) {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null
    ? null
    : resolveRepositoryRuntimeDataPathsFromValidatedRoot(repositoryRoot);
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
export function observeRepositoryRuntimeDataArea(
  capability: Repository,
  area: RepositoryRuntimeArea,
): RepositoryRuntimeDataAreaObservation {
  try {
    const paths = resolveRepositoryRuntimeDataPathsForInternalUse(capability);
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
 * @returns resolveRepositoryRuntimeDataPathsFromWorkingDirectoryの計算結果を返す。
 * @precondition 「workingDirectory: unknown」がresolveRepositoryRuntimeDataPathsFromWorkingDirectoryの入力契約を満たす。
 * @postcondition resolveRepositoryRuntimeDataPathsFromWorkingDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryRuntimeDataPathsFromWorkingDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryRuntimeDataPathsFromWorkingDirectoryは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryRuntimeDataPathsFromWorkingDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryRuntimeDataPathsFromWorkingDirectoryはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveRepositoryRuntimeDataPathsFromWorkingDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveRepositoryRuntimeDataPathsFromWorkingDirectoryは共有非同期状態を持たない同期処理である。
 */
export function resolveRepositoryRuntimeDataPathsFromWorkingDirectory(
  workingDirectory: unknown,
) {
  const verified = getRepositoryFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? resolveRepositoryRuntimeDataPaths(verified.capability)
    : null;
}

export type RepositoryRuntimeArea = "domain-model" | "tmp";

export type RepositoryRuntimeDataAreaObservation =
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
export function createCoordinatorRuntimeDataArea(capability: Repository) {
  let effectIssued = false;
  try {
    const paths = resolveRepositoryRuntimeDataPathsForInternalUse(capability);
    if (!paths) throw new Error("root");
    const root = fs.lstatSync(paths.root, { bigint: true });
    if (
      !root.isDirectory() ||
      root.isSymbolicLink() ||
      fs.realpathSync.native(paths.root) !== paths.root
    )
      throw new Error("parent");
    assertRuntimeStateInitializationBoundary(capability);
    if (
      observeRepositoryRuntimeDataArea(capability, "domain-model").status !==
      "not_observed"
    )
      throw new Error("existing");
    const before = fs.lstatSync(paths.root, { bigint: true });
    if (root.dev !== before.dev || root.ino !== before.ino)
      throw new Error("parent_changed");
    effectIssued = true;
    fs.mkdirSync(paths.domainModel, { mode: 0o700 });
    assertRuntimeStateInitializationBoundary(capability);
    const after = fs.lstatSync(paths.root, { bigint: true });
    const observation = observeRepositoryRuntimeDataArea(
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
export function assertRuntimeStateInitializationBoundary(
  capability: Repository,
): void {
  const paths = resolveRepositoryRuntimeDataPathsForInternalUse(capability);
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
export function ensureRepositoryRuntimeDataArea(
  capability: Repository,
  area: RepositoryRuntimeArea,
) {
  const paths = resolveRepositoryRuntimeDataPathsForInternalUse(capability);
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
 * @input workingDirectory: unknown、area: RepositoryRuntimeArea
 * @returns ensureRepositoryRuntimeDataAreaFromWorkingDirectoryの計算結果を返す。
 * @precondition 「workingDirectory: unknown、area: RepositoryRuntimeArea」がensureRepositoryRuntimeDataAreaFromWorkingDirectoryの入力契約を満たす。
 * @postcondition ensureRepositoryRuntimeDataAreaFromWorkingDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: ensureRepositoryRuntimeDataAreaFromWorkingDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ensureRepositoryRuntimeDataAreaFromWorkingDirectoryは独自の失敗分岐を所有しない。
 * @invariant ensureRepositoryRuntimeDataAreaFromWorkingDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ensureRepositoryRuntimeDataAreaFromWorkingDirectoryはProcess内の同一Subsystemで完結する。
 * @security N/A: ensureRepositoryRuntimeDataAreaFromWorkingDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ensureRepositoryRuntimeDataAreaFromWorkingDirectoryは共有非同期状態を持たない同期処理である。
 */
export function ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
  workingDirectory: unknown,
  area: RepositoryRuntimeArea,
) {
  const verified = getRepositoryFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? ensureRepositoryRuntimeDataArea(verified.capability, area)
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
 * Task要約を共通履歴の閉じた行へ変換する。
 * @responsibility 技術操作の回復参照とTask要約IDの名前空間を分離する。
 * @trace ARCH-000004
 * @input row: 検査済み要約。
 * @returns 正規UTF-8の一行。
 * @precondition historyRow検査を完了している。
 * @postcondition 自由文や秘密値を追加しない。
 * @effect N/A: 同期変換。
 * @failure 値の符号化失敗は例外。
 * @invariant 同じIDと本文は同じbyteとなる。
 * @boundary Task要約と共通履歴。
 * @security 要約をAuthorityへ昇格しない。
 * @concurrency N/A: 純粋処理。
 */
function taskHistoryLine(row: HistoryRow): Buffer {
  return Buffer.from(
    `${encodeRuntimeStateValue({
      schema: "crdd-coordinator/history-row/v2",
      occurredAt: row.occurredAt,
      summary: { schema: "crdd-coordinator/task-summary/v1", record: row },
    })}\n`,
  );
}

/** 同じ判断イベントを出版と退役確認で同じ正規行へ変換する。 */
function decisionHistoryLine(event: DecisionHistoryEvent): Buffer {
  return Buffer.from(
    `${encodeRuntimeStateValue({
      schema: "crdd-coordinator/history-row/v2",
      occurredAt: event.occurredAt,
      summary: { schema: "crdd-coordinator/decision-event/v1", record: event },
    })}\n`,
  );
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
export function updateCoordinatorHistoryOwned(
  owner: CoordinatorStorageOwner,
  recordJson: string | null,
  now = Date.now(),
  mode: "update" | "decision" | "resume_decision" = "update",
) {
  const blocked = {
    status: "blocked" as const,
    reason: "coordinator_history_unconfirmed",
  };
  if (
    !isLiveCoordinatorStorageOwner(owner) ||
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
    const area = observeRepositoryRuntimeDataArea(
      root.capability,
      "domain-model",
    );
    const policy = readHistoryRetentionDays(
      readCoordinatorStorageOwnerBinding(owner)?.repository,
    );
    const state = readCoordinatorStorageSnapshotOwned(owner, "history");
    if (
      area.status !== "ready" ||
      policy === null ||
      state.status !== "completed" ||
      !state.value
    )
      return blocked;
    const directory = area.directory;
    const stateBytes = Buffer.from(
      `${encodeRuntimeStateValue(state.value.snapshot)}\n`,
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
      const fresh = observeRepositoryRuntimeDataArea(
        root.capability,
        "domain-model",
      );
      const config = readHistoryRetentionDays(
        readCoordinatorStorageOwnerBinding(owner)?.repository,
      );
      if (
        !isLiveCoordinatorStorageOwner(owner) ||
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
    const rows = decodeCoordinatorHistoryRows(before);
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
        ? prepareCoordinatorHistoryRetention(
            stateBytes,
            joined,
            new Date(now).toISOString(),
            policy,
            owner.repositoryBinding,
          )
        : decodeCoordinatorHistoryRows(joined)
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
export function updateCoordinatorHistoryPilot(
  workingDirectory: string | Repository | HistoryRepositoryInput,
  recordJson: string | null,
  now = Date.now(),
) {
  const acquired = acquireCoordinatorStorageOwner(workingDirectory);
  if (acquired.status !== "completed")
    return {
      status: "blocked" as const,
      reason: acquired.reason,
      manualRecoveryRequired: acquired.manualRecoveryRequired,
      recoveryId: acquired.recoveryId,
    };
  const owner = acquired.value;
  const result = updateCoordinatorHistoryOwned(owner, recordJson, now);
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
export function inspectCoordinatorHistorySettlement(
  owner: CoordinatorStorageOwner,
  row: HistoryRow,
  now = Date.now(),
): "recorded" | "expired" | null {
  if (!isLiveCoordinatorStorageOwner(owner)) return null;
  try {
    const root = getRepository(owner.repositoryRoot);
    if (root.status !== "completed") return null;
    const area = observeRepositoryRuntimeDataArea(
      root.capability,
      "domain-model",
    );
    const policy = readHistoryRetentionDays(
      readCoordinatorStorageOwnerBinding(owner)?.repository,
    );
    if (
      area.status !== "ready" ||
      policy === null ||
      readHistoryFile(path.join(area.directory, "history.pending.jsonl")) !==
        null
    )
      return null;
    const rows = decodeCoordinatorHistoryRows(
      readHistoryFile(path.join(area.directory, "history.jsonl")) ??
        Buffer.alloc(0),
    );
    const expected = taskHistoryLine(historyRow(row, now));
    const matched = rows?.some(
      (item) =>
        item.recoveryId === `task-history.${row.id}` &&
        expected.equals(Buffer.from(item.line)),
    );
    const final = observeRepositoryRuntimeDataArea(
      root.capability,
      "domain-model",
    );
    const finalPolicy = readHistoryRetentionDays(
      readCoordinatorStorageOwnerBinding(owner)?.repository,
    );
    return matched &&
      finalPolicy !== null &&
      finalPolicy === policy &&
      final.status === "ready" &&
      final.boundaryIdentity === area.boundaryIdentity &&
      isLiveCoordinatorStorageOwner(owner)
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
  owner: CoordinatorStorageOwner,
  decision: Decision,
): "recorded" | null {
  const observed = readDecisionHistoryOwned(owner, {
    decisionId: decision.decisionId,
  });
  const expected = projectDecisionHistory(decision);
  return observed &&
    expected?.every((event) =>
      observed.some(
        (record) =>
          encodeRuntimeStateValue(event) === encodeRuntimeStateValue(record),
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
  owner: CoordinatorStorageOwner,
  identity: Readonly<{ decisionId: string }> | Readonly<{ blockerId: string }>,
): readonly DecisionHistoryEvent[] | null {
  const key = "decisionId" in identity ? "decisionId" : "blockerId";
  const id =
    "decisionId" in identity ? identity.decisionId : identity.blockerId;
  if (
    !isLiveCoordinatorStorageOwner(owner) ||
    typeof id !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(id)
  )
    return null;
  try {
    const root = getRepository(owner.repositoryRoot);
    if (root.status !== "completed") return null;
    const area = observeRepositoryRuntimeDataArea(
      root.capability,
      "domain-model",
    );
    if (
      area.status !== "ready" ||
      readHistoryFile(path.join(area.directory, "history.pending.jsonl")) !==
        null
    )
      return null;
    const rows = decodeCoordinatorHistoryRows(
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
    const final = observeRepositoryRuntimeDataArea(
      root.capability,
      "domain-model",
    );
    return final.status === "ready" &&
      final.boundaryIdentity === area.boundaryIdentity &&
      isLiveCoordinatorStorageOwner(owner)
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
export class RepositoryRuntimeDataAreaBlockedError extends Error {
  readonly reason: string;
  readonly effectIssued: boolean;
  readonly effectStateUnknown: boolean;
  readonly cleanupConfirmed: boolean;
  readonly retryAllowed: boolean;
  readonly recoveryReference: string | null;
  readonly repositoryPathReported = false as const;

  constructor(
    result: Exclude<
      ReturnType<typeof ensureRepositoryRuntimeDataArea>,
      null | { status: "ready" }
    >,
  ) {
    super(result.reason);
    this.name = "RepositoryRuntimeDataAreaBlockedError";
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
export type CoordinatorStorageRepository = Pick<
  NonNullable<ReturnType<typeof observeRuntimeRecoveryRepository>>,
  "repositoryRoot" | "repositoryBinding" | "revalidate"
>;

/**
 * 本番Portを現在の受付世代へ接続するための読取りを行う。
 * @responsibility 生Ownerを外へ渡さず、元の読取りモードと解放条件で受付世代だけを返す。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory: Repository内起点、binding: 期待する保存結合。
 * @returns 保存済みの受付世代、又は構成停止理由。
 * @precondition 明示初期化が完了している。
 * @postcondition 旧形式・不存在・不正を受付世代へ補完しない。
 * @effect 同じ短期排他の取得・読取り・解放だけ。
 * @failure 取得不能・不正本文は未初期化、解放不明は専用停止。
 * @invariant 受付世代の照会で状態・実行Authorityを生成しない。
 * @boundary Port構成と保存内部のOwner。
 * @security Snapshot全体・Kernel handleを返さない。
 * @concurrency 読取りと解放確認を同じ呼出しに閉じる。
 */
export function readCoordinatorSnapshotIntakeEpoch(
  workingDirectory: Repository,
  binding: string,
): StoreResult<string> {
  if (typeof workingDirectory !== "object" || workingDirectory === null)
    return blocked("orchestrator_repository_root_invalid");
  const acquired = acquireCoordinatorSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed")
    return blocked("orchestrator_snapshot_not_initialized");
  const observed = readCoordinatorSnapshotOwned(acquired.value, binding, true);
  if (!acquired.value.release())
    return blocked("orchestrator_snapshot_lock_release_unconfirmed", true);
  if (
    observed.status !== "completed" ||
    !observed.value ||
    observed.value.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA
  )
    return blocked("orchestrator_snapshot_not_initialized");
  return completed(
    "orchestrator_snapshot_intake_epoch_observed",
    observed.value.intakeEpoch,
  );
}

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

export function resolveCoordinatorNamedPaths(workingDirectory: string) {
  const verified = getRepositoryFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? resolveRepositoryRuntimeDataPaths(verified.capability)
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
export function observeCoordinatorArea(
  repositoryRoot: string,
  area: "domain-model" | "tmp",
) {
  const verified = getRepository(repositoryRoot);
  if (verified.status !== "completed")
    throw new Error("orchestrator_repository_root_invalid");
  const observation = observeRepositoryRuntimeDataArea(
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
export function assertCoordinatorArea(
  repositoryRoot: string,
  area: "domain-model" | "tmp",
  directory: string,
) {
  const observation = observeCoordinatorArea(repositoryRoot, area);
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
export function assertCoordinatorAreaUnchanged(
  repositoryRoot: string,
  area: "domain-model" | "tmp",
  initial: Exclude<RepositoryRuntimeDataAreaObservation, { status: "blocked" }>,
) {
  const current = observeCoordinatorArea(repositoryRoot, area);
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
export function readCoordinatorSnapshot(
  workingDirectory: string | Repository,
  binding: string,
): StoreResult<CoordinatorSnapshot | null> {
  if (!validId(binding)) return blocked("orchestrator_snapshot_input_invalid");
  const acquired = acquireCoordinatorSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const lock = acquired.value;
  const outcome = readCoordinatorSnapshotOwned(lock, binding);
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
export function readCoordinatorSnapshotOwned(
  lock: CoordinatorSnapshotOwner,
  binding: string,
  readMode: boolean | "history" = false,
): StoreResult<CoordinatorSnapshot | null> {
  if (!isLiveCoordinatorSnapshotOwner(lock))
    return blocked("orchestrator_snapshot_lock_owner_invalid", true);
  const observed = readCoordinatorStorageSnapshotOwned(lock, readMode);
  if (observed.status !== "completed")
    return observed.reason === "coordinator_state_uninitialized"
      ? completed("orchestrator_snapshot_absent", null)
      : blocked(observed.reason, true);
  if (!observed.value)
    return blocked("orchestrator_snapshot_invalid_or_unconfirmed", true);
  const decoded = decodeRuntimeDomainSnapshot(
    Buffer.from(`${encodeRuntimeStateValue(observed.value.snapshot)}\n`),
    lock.repositoryBinding,
  );
  if (!decoded)
    return blocked("orchestrator_snapshot_invalid_or_unconfirmed", true);
  const value = projectCoordinatorTaskSnapshot(
    decoded,
    lock.repositoryRootHash,
  );
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
 * @returns describeCoordinatorDurableFoundationの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCoordinatorDurableFoundationの入力契約を満たす。
 * @postcondition describeCoordinatorDurableFoundationの責務を完了した結果だけを返す。
 * @effect N/A: describeCoordinatorDurableFoundationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCoordinatorDurableFoundationは独自の失敗分岐を所有しない。
 * @invariant describeCoordinatorDurableFoundationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeCoordinatorDurableFoundationはProcess内の同一Subsystemで完結する。
 * @security describeCoordinatorDurableFoundationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeCoordinatorDurableFoundationは共有非同期状態を持たない同期処理である。
 */
export function describeCoordinatorDurableFoundation() {
  return Object.freeze({
    contract: COORDINATOR_DURABLE_FOUNDATION_CONTRACT,
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
 * 保存確定済みの最新Snapshotを現在の操作Ownerへ返す。
 * @responsibility 保存途中・不存在・観測不能を成功へ畳まず、版と本文Hashを取得する。
 * @trace ARCH-000008
 * @input managementCapability: 検証済みRepositoryへ結合した現在操作Owner。
 * @returns 確認済みSnapshotと本文Hash、または値を持たないblocked結果。
 * @precondition Repository操作Ownerが有効である。
 * @postcondition 排他解放と読取り確認の両方が成立した場合だけ値を返す。
 * @effect 固定領域・Fileの読取りと短期OS排他だけ。保存物を作成・修復しない。
 * @failure Root不一致、保存途中、本文不正、解放不明は停止する。
 * @invariant 不在を新品状態と解釈せず、読取りからRecovery完了を推定しない。
 * @boundary Repository-local現在状態と操作Owner。
 * @security 呼出し元Pathや旧形式から保存先を選ばない。
 * @concurrency Writerと同じ短期排他下で取得し、上位待機へLockを搬送しない。
 */
export function readRuntimeOwnedCoordinatorStateSnapshot(
  managementCapability: unknown,
) {
  const repository = observeRuntimeExecutionRepository(managementCapability);
  return readCoordinatorStateSnapshot(repository, null);
}

/**
 * Task入場専用に現在本文または厳密な未初期化を観測する。
 * @responsibility 通常Readerの不在拒否を変えず初回入場だけを区別する。
 * @trace ARCH-000008
 * @input rootCapability: 呼出し元が検証したRepository Root。
 * @returns 通常Snapshot、専用の未初期化理由、または停止結果。
 * @precondition 入場結果から初期化や実行Authorityを発行しない。
 * @postcondition 未初期化の結果にもRootと排他解放の確認を要求する。
 * @effect 既存ReaderとKernel排他による読取りだけ。
 * @failure pending・未知物・不正本文・Root変化・解放不明は拒否する。
 * @invariant 空領域や観測不能を未初期化へ変換しない。
 * @boundary 検証済みRepositoryと現在状態の初回入場。
 * @security 内部結果は入場投影だけが利用し、処置資格にしない。
 * @concurrency 通常Readerと同じ短期排他を解放してから返す。
 */
export function readRuntimeOwnedCoordinatorAdmissionSnapshot(
  rootCapability: unknown,
) {
  return readCoordinatorStateSnapshot(
    observeRuntimeRecoveryRepository(rootCapability),
    null,
    null,
    null,
    null,
    null,
    "docker_task",
    "docker_task",
    true,
  );
}

/**
 * 出版済み現在状態に残ったRepository結合markerだけを回収する。
 * @responsibility Taskや受領の根拠を使わず、同じ保存本文を保全して短命markerだけを除去する。
 * @trace ARCH-000008
 * @input rootCapability: 明示検証済みの現在Repository Root。
 * @returns markerの処置・不存在、保存内容保全と排他解放の個別確認。
 * @precondition 正規currentが既に出版済みで、pendingや未知Fileが存在しない。
 * @postcondition Task結果・履歴・配送・実行Authorityを生成せず、処置不明を完了にしない。
 * @effect 既存Kernel排他、固定三Fileの読取りとexact state.lockへのunlink一回だけ。
 * @failure 不正・置換・観測不能は停止し、unlinkや解放の例外を自動再試行しない。
 * @invariant 通常ReaderやTask Writerの成立条件を緩めない。
 * @boundary 現在Repositoryの保存領域と短命出版marker。
 * @security 任意Path・Task ID・Consumer・成功値を入力に受け取らない。
 * @concurrency 既存短期排他と前後の実体・全文照合を使い、非協調Processとの原子性を主張しない。
 */
export function cleanupRuntimeOwnedCoordinatorStateMarker(
  rootCapability: unknown,
) {
  let markerRemoved = false,
    markerAbsentConfirmed = false,
    storageConfirmed = false,
    filesystemEffectIssued = false,
    lockReleased = true;
  let reason = "coordinator_state_marker_cleanup_unconfirmed";
  const repository = observeRuntimeRecoveryRepository(rootCapability);
  let lock: Lock | null = null;
  try {
    if (!repository) throw new Error("root");
    lockReleased = false;
    const acquisition = acquireRuntimeStateLock(
      repository.repositoryBinding,
      repository.repositoryRoot,
    );
    if (acquisition.status !== "acquired") {
      reason = storageLockFailure(acquisition).reason;
      throw new Error(reason);
    }
    lock = acquisition.lock;
    let boundary: string | null = null;
    let originalNames: string[] = [];
    const original = new Map<
      string,
      ReturnType<typeof readStableFileSnapshot>
    >();
    // 取得、処置直前、処置後の三観測。同じ本文でも別実体は拒否する。
    for (let pass = 0; pass < 3; pass++) {
      if (!repository.revalidate() || !lock.assertLive())
        throw new Error("owner");
      const verified = getRepository(repository.repositoryRoot);
      if (verified.status !== "completed") throw new Error("root");
      const area = observeRepositoryRuntimeDataArea(
        verified.capability,
        "domain-model",
      );
      if (
        area.status !== "ready" ||
        area.repositoryRoot !== repository.repositoryRoot ||
        (boundary !== null && area.boundaryIdentity !== boundary)
      )
        throw new Error("area");
      boundary = area.boundaryIdentity;
      const names = fs.readdirSync(area.directory).sort();
      if (
        !names.includes("state.json") ||
        names.some(
          (name) =>
            !["state.json", "history.jsonl", "state.lock"].includes(name),
        )
      )
        throw new Error("pending_or_unknown");
      if (pass === 0) originalNames = names;
      else {
        const expected =
          pass === 2
            ? originalNames.filter((name) => name !== "state.lock")
            : originalNames;
        if (JSON.stringify(names) !== JSON.stringify(expected))
          throw new Error("names_changed");
      }
      for (const name of names) {
        const file = path.join(area.directory, name);
        const metadata = fs.lstatSync(file, { bigint: true });
        if (
          !metadata.isFile() ||
          metadata.isSymbolicLink() ||
          metadata.nlink !== 1n
        )
          throw new Error("file");
        const observed = readStableFileSnapshot(file);
        const final = fs.lstatSync(file, { bigint: true });
        if (
          final.nlink !== 1n ||
          !sameStableFileIdentity(observed.identity, final)
        )
          throw new Error("file_changed");
        if (
          (name === "state.json" &&
            !decodeRuntimeDomainSnapshot(
              observed.bytes,
              repository.repositoryBinding,
            )) ||
          (name === "history.jsonl" &&
            !decodeCoordinatorHistoryRows(observed.bytes)) ||
          (name === "state.lock" &&
            !observed.bytes.equals(
              Buffer.from(
                `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: repository.repositoryBinding })}\n`,
              ),
            ))
        )
          throw new Error("content");
        if (pass === 0) original.set(name, observed);
        else {
          const before = original.get(name);
          if (
            !before ||
            !sameStableFileIdentity(before.identity, observed.identity) ||
            !before.bytes.equals(observed.bytes)
          )
            throw new Error("changed");
        }
      }
      if (
        !repository.revalidate() ||
        !lock.assertLive() ||
        JSON.stringify(fs.readdirSync(area.directory).sort()) !==
          JSON.stringify(names)
      )
        throw new Error("changed");
      const currentArea = observeRepositoryRuntimeDataArea(
        verified.capability,
        "domain-model",
      );
      if (
        currentArea.status !== "ready" ||
        currentArea.directory !== area.directory ||
        currentArea.boundaryIdentity !== boundary
      )
        throw new Error("area_changed");
      for (const name of names) {
        const file = path.join(area.directory, name);
        const current = readStableFileSnapshot(file);
        const before = original.get(name);
        if (
          !before ||
          fs.lstatSync(file, { bigint: true }).nlink !== 1n ||
          !sameStableFileIdentity(before.identity, current.identity) ||
          !before.bytes.equals(current.bytes)
        )
          throw new Error("changed_before_effect");
      }
      if (pass === 1 && names.includes("state.lock")) {
        const marker = path.join(area.directory, "state.lock");
        filesystemEffectIssued = true;
        try {
          fs.unlinkSync(marker);
          markerRemoved = true;
        } catch {
          try {
            fs.lstatSync(marker);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
              markerRemoved = true;
              markerAbsentConfirmed = true;
            }
          }
          throw new Error("unlink_unconfirmed");
        }
      }
      if (pass === 2) {
        markerAbsentConfirmed = true;
        storageConfirmed = true;
      }
    }
    reason = markerRemoved
      ? "coordinator_state_marker_cleanup_confirmed"
      : "coordinator_state_marker_absent";
  } catch {
    // 一次失敗と、既に確認できた処置事実を保持する。
  } finally {
    if (lock) {
      try {
        lockReleased = lock.release();
      } catch {
        lockReleased = false;
      }
    }
  }
  return Object.freeze({
    status:
      storageConfirmed && markerAbsentConfirmed && lockReleased
        ? ("completed" as const)
        : ("blocked" as const),
    reason:
      storageConfirmed && !lockReleased
        ? "coordinator_state_lock_release_unconfirmed"
        : reason,
    markerRemoved,
    markerAbsentConfirmed,
    storageConfirmed,
    filesystemEffectIssued,
    lockReleased,
    cleanupReason: lockReleased
      ? null
      : "coordinator_state_lock_release_unconfirmed",
  });
}

/**
 * 現在回収の耐久配送登録だけを同じRootから再構成する。
 * @responsibility ACK前のexact登録候補を通常Readerから分離する。
 * @trace ARCH-000008
 * @input rootCapability: 検証済みRoot。recoveryId: exact回復参照。
 * @returns 現在本文と内部登録候補、または値なし停止。
 * @precondition 書込みOwnerと現在資源不存在は別に確認する。
 * @postcondition 読取りだけでは配送・ACK・操作除去を発行しない。
 * @effect 固定state／history／短命保存物と既存短期排他の読取り。
 * @failure 未終端、未確認履歴、交差候補、未知Fileと観測不明は停止する。
 * @invariant 保存済み利用側以外の配送を追加しない。
 * @boundary 現在Repositoryと耐久配送登録の有限形。
 * @security 任意Root Path、候補、利用側を受け取らない。
 * @concurrency 同じKernel排他と実体の前後照合を使う。
 */
export function readRuntimeOwnedCoordinatorCurrentDeliverySnapshot(
  rootCapability: unknown,
  recoveryId: unknown,
) {
  return readCoordinatorStateSnapshot(
    typeof recoveryId === "string" && parseDockerTaskRecoveryId(recoveryId)
      ? observeRuntimeRecoveryRepository(rootCapability)
      : null,
    null,
    null,
    null,
    typeof recoveryId === "string" ? recoveryId : null,
  );
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
export function readCoordinatorStateSnapshot(
  repository:
    | (Pick<
        NonNullable<ReturnType<typeof observeRuntimeExecutionRepository>>,
        "repositoryRoot" | "repositoryBinding" | "revalidate"
      > & { operationId?: string })
    | null,
  recoveryId: string | null,
  hostCleanupRecoveryId: string | null = null,
  currentHistoryRecoveryId: string | null = null,
  currentDeliveryRecoveryId: string | null = null,
  currentCompletionRecoveryId: string | null = null,
  currentHistoryKind: "docker_task" | "runtime_repair" = "docker_task",
  currentCompletionKind: "docker_task" | "runtime_repair" = "docker_task",
  allowUninitialized = false,
  resourcePublicationRecoveryId: string | null = null,
  completedTransientTask: Readonly<{
    recoveryId: string;
    correlationId: string;
    consumer: "workbench" | "coordinator_cli";
  }> | null = null,
  storageOwner: CoordinatorStorageOwner | null = null,
  taskPublicationRead: boolean | "history" = false,
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
      deliveryAbsent: false,
      hostCleanupPublication: null,
      currentHistoryPublication: null,
      repairHistoryState: null,
      currentDeliveryPublication: null,
      currentCompletionPublication: null,
      repairCompletionAbsent: false,
      repairRetentionReviewAfter: null,
      resourcePublication: null,
    });
  if (!repository) return blocked("coordinator_state_owner_invalid", true);
  const borrowedOwner = storageOwner
    ? borrowCoordinatorStorageOwner(storageOwner, repository)
    : null;
  if (storageOwner && !borrowedOwner)
    return blocked("coordinator_state_owner_invalid", false);
  const acquisition = borrowedOwner
    ? null
    : acquireCoordinatorStorageOwnerForRepository(repository);
  if (acquisition?.status === "blocked")
    return {
      ...blocked(acquisition.reason, false),
      manualRecoveryRequired: acquisition.manualRecoveryRequired,
      recoveryId: acquisition.recoveryId,
    };
  const ownedOwner = acquisition?.value ?? null;
  const lock =
    borrowedOwner?.lock ??
    (ownedOwner ? readCoordinatorStorageOwnerBinding(ownedOwner)?.lock : null);
  if (!lock) return blocked("coordinator_state_lock_unavailable", false);
  let value: ReturnType<typeof decodeRuntimeDomainSnapshot> = null;
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
  let currentDeliveryPublication: Readonly<{
    before: Buffer;
    candidate: Buffer;
    needsWrite: boolean;
    deliveryPending: boolean;
    historyFile: Readonly<{
      bytes: Buffer;
      identity: StableFileIdentity;
    }> | null;
  }> | null = null;
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
  let deliveryAbsent = false;
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
    const initial = observeRepositoryRuntimeDataArea(
      verified.capability,
      "domain-model",
    );
    if (allowUninitialized && initial.status === "not_observed") {
      const fresh = observeRepositoryRuntimeDataArea(
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
              "state.lock",
              "history.pending.jsonl",
            ]
          : taskPublicationRead ||
              resourcePublicationRecoveryId !== null ||
              hostCleanupRecoveryId !== null ||
              currentDeliveryRecoveryId !== null ||
              currentCompletionRecoveryId !== null
            ? [
                "state.json",
                "history.jsonl",
                "state.pending.json",
                "state.lock",
              ]
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
    const decoded = decodeRuntimeDomainSnapshot(
      observed.bytes,
      repository.repositoryBinding,
    );
    if (!decoded) throw new Error("content");
    let completedHistory: ReturnType<typeof readStableFileSnapshot> | null =
      null;
    const completedHistoryFile = path.join(initial.directory, "history.jsonl");
    if (completedTransientTask) {
      const target = completedTransientTask.recoveryId;
      const parsed = parseDockerTaskRecoveryId(target);
      if (
        !parsed ||
        [
          decoded.snapshot.operations,
          decoded.snapshot.unresolvedRecoveries,
          decoded.snapshot.pendingDeliveries,
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
      const rows = decodeCoordinatorHistoryRows(completedHistory.bytes);
      const row = rows?.find((entry) => entry.recoveryId === target);
      const summary = row ? JSON.parse(row.line).summary : null;
      if (
        !row ||
        summary.schema !== "crdd-coordinator/operation-summary/v4" ||
        summary.consumer !== completedTransientTask.consumer ||
        summary.recoveryCorrelationId !== completedTransientTask.correlationId
      )
        throw new Error("completion_history_unconfirmed");
      deliveryAbsent = true;
    }
    let pending: ReturnType<typeof readStableFileSnapshot> | null = null;
    let marker: ReturnType<typeof readStableFileSnapshot> | null = null;
    const markerFile = path.join(initial.directory, "state.lock");
    if (
      (resourcePublicationRecoveryId !== null ||
        hostCleanupRecoveryId !== null ||
        currentHistoryRecoveryId !== null ||
        currentDeliveryRecoveryId !== null ||
        currentCompletionRecoveryId !== null) &&
      names.includes("state.lock")
    ) {
      const metadata = fs.lstatSync(markerFile);
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.nlink !== 1
      )
        throw new Error("marker_file");
      marker = readStableFileSnapshot(markerFile);
      const expected = Buffer.from(
        `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: repository.repositoryBinding })}\n`,
      );
      if (!marker.bytes.equals(expected)) throw new Error("marker_binding");
    }
    const pendingFile = path.join(initial.directory, "state.pending.json");
    if (resourcePublicationRecoveryId !== null) {
      if (!marker || !names.includes("state.pending.json"))
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
        !classifyCoordinatorResourcePublication(
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
      if (!marker) throw new Error("host_cleanup_reentry_marker_required");
      const operation = decoded.snapshot.operations.find(
        (item): item is CoordinatorStateTaskOperation =>
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
        !coordinatorTaskResourcesAreSettled(operation)
      )
        throw new Error("host_cleanup_reentry_target_invalid");
      const current = Buffer.from(
        `${encodeRuntimeStateValue(decoded.snapshot)}\n`,
      );
      const candidate =
        operation.host.cleanup === "confirmed"
          ? current
          : prepareCoordinatorStateHostSnapshot(
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
      currentHistoryRecoveryId ??
      currentDeliveryRecoveryId ??
      currentCompletionRecoveryId;
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
        currentDeliveryRecoveryId !== null ||
        names.includes("state.pending.json")
      )
        throw new Error("repair_completion_absence_scope_invalid");
      const nonce = currentCompletionRecoveryId.split(".")[1];
      if (
        [
          decoded.snapshot.operations,
          decoded.snapshot.unresolvedRecoveries,
          decoded.snapshot.pendingDeliveries,
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
      const rows = decodeCoordinatorHistoryRows(recoveryHistory.bytes);
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
            dockerRuntimeRepairDisposalIsSettled(
              summary.disposal.checkpoint,
            )) ||
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
        [
          currentHistoryRecoveryId,
          currentDeliveryRecoveryId,
          currentCompletionRecoveryId,
        ].filter((value) => value !== null).length !== 1
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
                !dockerRuntimeRepairDisposalIsSettled(
                  operation.disposal.checkpoint,
                ))))) &&
        operation.summarySha256 === null &&
        operation.history === null;
      if (
        !operation ||
        (operation.kind === "runtime_repair"
          ? (!technicalState &&
              !prepareCoordinatorRepairHistorySummary(
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
            !coordinatorTaskResourcesAreSettled(operation) ||
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
      const before = Buffer.from(
        `${encodeRuntimeStateValue(decoded.snapshot)}\n`,
      );
      let candidate: Buffer | null = null;
      let stage: "checkpoint" | "publish" | "confirmed" | null = null;
      if (technicalState) {
        const rows = decodeCoordinatorHistoryRows(
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
        const identity = JSON.parse(operation.identityJson);
        const line = (
          currentCompletionKind === "runtime_repair"
            ? prepareCoordinatorRepairHistoryLine
            : prepareCoordinatorStateHistoryLine
        )(before, currentCompletionRecoveryId, repository.repositoryBinding);
        const rows = decodeCoordinatorHistoryRows(
          recoveryHistory?.bytes ?? Buffer.alloc(0),
        );
        const row = rows?.find(
          (item) => item.recoveryId === currentCompletionRecoveryId,
        );
        candidate = (
          currentCompletionKind === "runtime_repair"
            ? prepareCoordinatorStateRepairCompletionSnapshot
            : prepareCoordinatorStateCompletionSnapshot
        )(before, currentCompletionRecoveryId, repository.repositoryBinding);
        if (
          (currentCompletionKind === "docker_task" &&
            coordinatorConsumerCompletionPolicy(identity.consumer) !==
              "transient") ||
          !operation.history?.confirmed ||
          !line ||
          !rows ||
          (currentCompletionKind === "runtime_repair" && !row) ||
          (row && !Buffer.from(row.line).equals(line)) ||
          createHash("sha256").update(line).digest("hex") !==
            operation.history.lineSha256 ||
          recoveryHistoryPending ||
          !candidate ||
          (pending && (!marker || !pending.bytes.equals(candidate)))
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
      } else if (currentDeliveryRecoveryId !== null) {
        if (operation.kind !== "docker_task")
          throw new Error("current_delivery_kind_invalid");
        const identity = JSON.parse(operation.identityJson);
        const policy = coordinatorConsumerCompletionPolicy(identity.consumer);
        const line = prepareCoordinatorStateHistoryLine(
          before,
          currentDeliveryRecoveryId,
          repository.repositoryBinding,
        );
        const rows = decodeCoordinatorHistoryRows(
          recoveryHistory?.bytes ?? Buffer.alloc(0),
        );
        const row = rows?.find(
          (item) => item.recoveryId === currentDeliveryRecoveryId,
        );
        if (
          !policy ||
          !operation.history?.confirmed ||
          !line ||
          !rows ||
          createHash("sha256").update(line).digest("hex") !==
            operation.history.lineSha256 ||
          (row && !Buffer.from(row.line).equals(line)) ||
          recoveryHistoryPending ||
          decoded.snapshot.resultReceipts.some(
            (item) => item.recoveryId === currentDeliveryRecoveryId,
          ) ||
          (pending && !marker) ||
          (policy === "transient" && (pending || marker))
        )
          throw new Error("current_delivery_target_invalid");
        candidate = prepareCoordinatorStateResultDeliverySnapshot(
          before,
          currentDeliveryRecoveryId,
          policy === "durable" ? ["orchestrator"] : [],
          repository.repositoryBinding,
        );
        stage = "confirmed";
        if (!candidate || (pending && !pending.bytes.equals(candidate)))
          throw new Error("current_delivery_candidate_invalid");
        if (pending && candidate.equals(before))
          throw new Error("current_delivery_already_published_pending");
        currentDeliveryPublication = Object.freeze({
          before,
          candidate: Buffer.from(candidate),
          needsWrite: !candidate.equals(before) || marker !== null,
          deliveryPending: policy === "durable",
          historyFile:
            recoveryHistory === null
              ? null
              : {
                  bytes: Buffer.from(recoveryHistory.bytes),
                  identity: recoveryHistory.identity,
                },
        });
      } else if (operation.history === null) {
        if (recoveryHistoryPending || (pending && !marker))
          throw new Error("history_checkpoint_pending_invalid");
        const priorRows = decodeCoordinatorHistoryRows(
          recoveryHistory?.bytes ?? Buffer.alloc(0),
        );
        if (
          !priorRows ||
          priorRows.some((row) => row.recoveryId === currentHistoryRecoveryId)
        )
          throw new Error("history_checkpoint_prior_line_invalid");
        const pendingState = pending
          ? decodeRuntimeDomainSnapshot(
              pending.bytes,
              repository.repositoryBinding,
            )
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
            ? prepareCoordinatorRepairHistorySnapshot
            : prepareCoordinatorStateHistorySnapshot
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
            ? prepareCoordinatorRepairHistoryPublication
            : prepareCoordinatorRecoveredHistoryPublication
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
          (!marker ||
            recoveryHistoryPending ||
            publication?.historyChanged !== false)
        )
          throw new Error("history_state_pending_order_invalid");
      } else {
        if (pending || recoveryHistoryPending)
          throw new Error("history_confirmed_pending_invalid");
        const line = (
          operation.kind === "runtime_repair"
            ? prepareCoordinatorRepairHistoryLine
            : prepareCoordinatorStateHistoryLine
        )(before, currentHistoryRecoveryId, repository.repositoryBinding);
        const rows = decodeCoordinatorHistoryRows(
          recoveryHistory?.bytes ?? Buffer.alloc(0),
        );
        const row = rows?.find(
          (item) => item.recoveryId === currentHistoryRecoveryId,
        );
        if (
          !line ||
          !rows ||
          (!row &&
            [
              ...decoded.snapshot.pendingDeliveries,
              ...decoded.snapshot.unresolvedRecoveries,
            ].some((item) => item.recoveryId === operation.recoveryId)) ||
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
          needsWrite: stage !== "confirmed" || marker !== null,
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
    const fresh = observeRepositoryRuntimeDataArea(
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
      (currentPublicationRecoveryId !== null &&
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
      (marker !== null &&
        (!sameStableFileIdentity(
          marker.identity,
          fs.lstatSync(markerFile, { bigint: true }),
        ) ||
          fs.lstatSync(markerFile, { bigint: true }).nlink !== 1n)) ||
      names.includes("state.lock") !==
        fs.readdirSync(initial.directory).includes("state.lock") ||
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
    value = decoded;
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
  } else if (!borrowCoordinatorStorageOwner(storageOwner, repository)) {
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
    deliveryAbsent,
    hostCleanupPublication,
    currentHistoryPublication,
    repairHistoryState,
    currentDeliveryPublication,
    currentCompletionPublication,
    repairCompletionAbsent,
    repairRetentionReviewAfter,
    resourcePublication,
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
export function readCoordinatorStorageSnapshotOwned(
  owner: unknown,
  taskPublicationRead: boolean | "history" = false,
) {
  const binding =
    owner && typeof owner === "object"
      ? readCoordinatorStorageOwnerBinding(owner)
      : null;
  if (!binding) return readCoordinatorStateSnapshot(null, null);
  return readCoordinatorStateSnapshot(
    binding.repository,
    null,
    null,
    null,
    null,
    null,
    "docker_task",
    "docker_task",
    true,
    null,
    null,
    owner as CoordinatorStorageOwner,
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
export function classifyRuntimeSnapshotReentry(
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
export type RuntimeStateFileName =
  | "state.json"
  | "state.pending.json"
  | "state.lock"
  | "history.jsonl"
  | "history.pending.jsonl";

/** 確定前の排他的作成を許す閉集合。 */
export type RuntimeStatePendingFileName =
  | "state.pending.json"
  | "state.lock"
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
export function readRuntimeStateFile(
  directory: string,
  name: RuntimeStateFileName,
  identities: Map<string, StableFileIdentity>,
  assertBoundary: () => void,
): Buffer | null {
  if (
    ![
      "state.json",
      "state.pending.json",
      "state.lock",
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
export function createRuntimeStatePendingFile(
  directory: string,
  name: RuntimeStatePendingFileName,
  content: Buffer,
  identities: Map<string, StableFileIdentity>,
  assertBoundary: () => void,
  markEffect: () => void,
): void {
  if (
    !["state.pending.json", "state.lock", "history.pending.jsonl"].includes(
      name,
    )
  )
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
  const saved = readRuntimeStateFile(
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
export function flushRuntimeStateFile(
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

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

const SHA256 = /^[a-f0-9]{64}$/u;

const OUTCOMES = new Set([
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "parent_lost",
]);

const operations = new WeakMap<object, OperationRecord>();

const promotionReceipts = new WeakMap<object, PromotionRecord>();

/**
 * temporary-operation-storeで使用するOperation 記録の値契約を定義する。
 *
 * @responsibility Operation 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape OperationRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OperationRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: OperationRecordの宣言は外部境界を開かない。
 * @security N/A: OperationRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OperationRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OperationRecord = Readonly<{
  allowedContent: readonly string[];
  repositoryRoot: string;
  controlRoot: string;
  directory: string;
  documentPath: string;
  evidencePromotionRequired: boolean;
  generation: number;
  identity: string;
  operationId: string;
  owner: string;
}>;

/**
 * temporary-operation-storeで使用するPromotion 記録の値契約を定義する。
 *
 * @responsibility Promotion 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape PromotionRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PromotionRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: PromotionRecordの宣言は外部境界を開かない。
 * @security N/A: PromotionRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility PromotionRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PromotionRecord = Readonly<{
  generation: number;
  identity: string;
  operationId: string;
  sha256: string;
  source: string;
  target: string;
  repositoryRoot: string;
  evidenceRelativePath: string;
}>;

/**
 * temporary-operation-storeで使用するTemporary Operation 入力の値契約を定義する。
 *
 * @responsibility Temporary Operation 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape TemporaryOperationInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TemporaryOperationInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: TemporaryOperationInputの宣言は外部境界を開かない。
 * @security N/A: TemporaryOperationInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TemporaryOperationInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TemporaryOperationInput = Readonly<{
  operationId: string;
  owner: string;
  identity: string;
  purpose: string;
  allowedContent: readonly string[];
  evidencePromotion: "required" | "not_required";
}>;

/**
 * temporary-operation-storeで使用するTemporary Operation Documentの値契約を定義する。
 *
 * @responsibility Temporary Operation DocumentのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape TemporaryOperationDocumentが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TemporaryOperationDocumentで宣言した値と責務の対応を維持する。
 * @boundary N/A: TemporaryOperationDocumentの宣言は外部境界を開かない。
 * @security N/A: TemporaryOperationDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TemporaryOperationDocumentの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TemporaryOperationDocument = Readonly<{
  schema: "crdd/runtime-data/temporary-operation/v3";
  operationId: string;
  identity: string;
  owner: string;
  generation: number;
  ownerProcessId: number;
  previousGeneration: number | null;
  state: "preparing" | "active" | "recovery_required";
  purpose: string;
  allowedContent: readonly string[];
  terminalPaths: readonly string[];
  evidencePromotion: "required" | "not_required";
}>;

/**
 * Safe Directoryかを判定する。
 *
 * @responsibility Safe Directoryの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000011
 * @input target: string
 * @returns booleanを返す。
 * @precondition 「target: string」がisSafeDirectoryの入力契約を満たす。
 * @postcondition isSafeDirectoryの責務を完了した結果だけを返す。
 * @effect isSafeDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: isSafeDirectoryは独自の失敗分岐を所有しない。
 * @invariant isSafeDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: isSafeDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isSafeDirectoryは共有非同期状態を持たない同期処理である。
 */
function isSafeDirectory(target: string): boolean {
  const metadata = fs.lstatSync(target);
  return (
    metadata.isDirectory() &&
    !metadata.isSymbolicLink() &&
    fs.realpathSync.native(target) === path.resolve(target)
  );
}

/**
 * Directoryが成立する状態を確保する。
 *
 * @responsibility Directoryの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000011
 * @input target: string
 * @returns N/A: ensureDirectoryは戻り値を返さない。
 * @precondition 「target: string」がensureDirectoryの入力契約を満たす。
 * @postcondition ensureDirectoryの責務を完了して呼出し元へ制御を戻す。
 * @effect ensureDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure ensureDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ensureDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: ensureDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ensureDirectoryは共有非同期状態を持たない同期処理である。
 */
function ensureTemporaryOperationDirectory(target: string): void {
  try {
    fs.mkdirSync(target, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if (!isSafeDirectory(target))
    throw new Error("temporary_operation_boundary_invalid");
}

/**
 * 入力が有効か判定する。
 *
 * @responsibility 入力の有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000011
 * @input input: TemporaryOperationInput
 * @returns booleanを返す。
 * @precondition 「input: TemporaryOperationInput」がvalidInputの入力契約を満たす。
 * @postcondition validInputの責務を完了した結果だけを返す。
 * @effect N/A: validInputは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validInputは独自の失敗分岐を所有しない。
 * @invariant validInputは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: validInputはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validInputは共有非同期状態を持たない同期処理である。
 */
function validInput(input: TemporaryOperationInput): boolean {
  return (
    ID.test(input.operationId) &&
    !/^signature\.*$/iu.test(input.operationId) &&
    !("storage" in input) &&
    ID.test(input.owner) &&
    ID.test(input.identity) &&
    typeof input.purpose === "string" &&
    input.purpose.length > 0 &&
    Array.isArray(input.allowedContent) &&
    input.allowedContent.length > 0 &&
    input.allowedContent.every(
      (item) => typeof item === "string" && ID.test(item),
    ) &&
    new Set(input.allowedContent).size === input.allowedContent.length &&
    ["required", "not_required"].includes(input.evidencePromotion)
  );
}

/**
 * recovery Referenceを決定する。
 *
 * @responsibility recovery Referenceの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000011
 * @input record: OperationRecord
 * @returns TemporaryOperationRecoveryReferenceを返す。
 * @precondition 「record: OperationRecord」がrecoveryReferenceの入力契約を満たす。
 * @postcondition recoveryReferenceの責務を完了した結果だけを返す。
 * @effect N/A: recoveryReferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryReferenceは独自の失敗分岐を所有しない。
 * @invariant recoveryReferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: recoveryReferenceはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recoveryReferenceは共有非同期状態を持たない同期処理である。
 */
function recoveryReference(
  record: OperationRecord,
): TemporaryOperationRecoveryReference {
  return Object.freeze({
    operationId: record.operationId,
    owner: record.owner,
    identity: record.identity,
    generation: record.generation,
  });
}

/**
 * Documentを観測する。
 *
 * @responsibility Documentの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000011
 * @input value: unknown
 * @returns TemporaryOperationDocument | nullを返す。
 * @precondition 「value: unknown」がinspectDocumentの入力契約を満たす。
 * @postcondition inspectDocumentの責務を完了した結果だけを返す。
 * @effect N/A: inspectDocumentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectDocumentは独自の失敗分岐を所有しない。
 * @invariant inspectDocumentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: inspectDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectDocumentは共有非同期状態を持たない同期処理である。
 */
function inspectDocument(value: unknown): TemporaryOperationDocument | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const r = value as Readonly<Record<string, unknown>>;
  const expectedKeys = [
    "allowedContent",
    "evidencePromotion",
    "generation",
    "identity",
    "operationId",
    "owner",
    "ownerProcessId",
    "previousGeneration",
    "purpose",
    "schema",
    "state",
    "terminalPaths",
  ];
  expectedKeys.sort();
  const keys = Object.keys(r).sort();
  if (
    keys.length !== expectedKeys.length ||
    !keys.every((key, index) => key === expectedKeys[index]) ||
    r.schema !== "crdd/runtime-data/temporary-operation/v3" ||
    typeof r.operationId !== "string" ||
    !ID.test(r.operationId) ||
    typeof r.owner !== "string" ||
    !ID.test(r.owner) ||
    typeof r.identity !== "string" ||
    !ID.test(r.identity) ||
    !Number.isSafeInteger(r.generation) ||
    Number(r.generation) < 1 ||
    !Number.isSafeInteger(r.ownerProcessId) ||
    Number(r.ownerProcessId) < 1 ||
    (r.previousGeneration !== null &&
      (!Number.isSafeInteger(r.previousGeneration) ||
        Number(r.previousGeneration) < 1 ||
        Number(r.previousGeneration) >= Number(r.generation))) ||
    !["preparing", "active", "recovery_required"].includes(String(r.state)) ||
    typeof r.purpose !== "string" ||
    r.purpose.length < 1 ||
    !Array.isArray(r.allowedContent) ||
    r.allowedContent.length < 1 ||
    !r.allowedContent.every(
      (item) => typeof item === "string" && ID.test(item),
    ) ||
    new Set(r.allowedContent).size !== r.allowedContent.length ||
    !Array.isArray(r.terminalPaths) ||
    r.terminalPaths.join("\n") !==
      "completed\nfailed\ncancelled\ntimed_out\nparent_lost" ||
    !["required", "not_required"].includes(String(r.evidencePromotion))
  )
    return null;
  return r as TemporaryOperationDocument;
}

/**
 * Documentを読み取る。
 *
 * @responsibility Documentの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000011
 * @input documentPath: string
 * @returns TemporaryOperationDocumentを返す。
 * @precondition 「documentPath: string」がreadDocumentの入力契約を満たす。
 * @postcondition readDocumentの責務を完了した結果だけを返す。
 * @effect readDocumentはFilesystemの読取りまたは書込みを実行する。
 * @failure readDocumentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readDocumentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readDocumentは共有非同期状態を持たない同期処理である。
 */
function readDocument(documentPath: string): TemporaryOperationDocument {
  const metadata = fs.lstatSync(documentPath);
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error("temporary_operation_boundary_invalid");
  const document = inspectDocument(
    JSON.parse(fs.readFileSync(documentPath, "utf8")),
  );
  if (!document) throw new Error("temporary_operation_document_invalid");
  return document;
}

/**
 * Documentを書き込む。
 *
 * @responsibility Documentの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000011
 * @input documentPath: string、document: TemporaryOperationDocument
 * @returns N/A: writeDocumentは戻り値を返さない。
 * @precondition 「documentPath: string、document: TemporaryOperationDocument」がwriteDocumentの入力契約を満たす。
 * @postcondition writeDocumentの責務を完了して呼出し元へ制御を戻す。
 * @effect writeDocumentはFilesystemの読取りまたは書込みを実行する。
 * @failure writeDocumentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeDocumentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: writeDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: writeDocumentは共有非同期状態を持たない同期処理である。
 */
function writeDocument(
  documentPath: string,
  document: TemporaryOperationDocument,
): void {
  const directory = path.dirname(documentPath);
  const stagingDirectory = path.join(directory, ".staging");
  ensureTemporaryOperationDirectory(stagingDirectory);
  const temporary = path.join(
    stagingDirectory,
    `${document.operationId}.${document.identity}.${document.generation}.${document.state}.json`,
  );
  if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  const descriptor = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(document)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.renameSync(temporary, documentPath);
    const observed = readDocument(documentPath);
    if (
      observed.identity !== document.identity ||
      observed.generation !== document.generation ||
      observed.state !== document.state
    )
      throw new Error("temporary_operation_document_publish_unconfirmed");
  } finally {
    try {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    } catch {
      // A failed replacement remains a recovery obligation at the caller.
    }
  }
}

/**
 * Documentを構築する。
 *
 * @responsibility Documentの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000011
 * @input documentPath: string、document: TemporaryOperationDocument、afterStagingDocumentCreated: () => void、afterStagingDocumentWritten: () => void、afterCanonicalDocumentLinked: () => void
 * @returns N/A: createDocumentは戻り値を返さない。
 * @precondition 「documentPath: string、document: TemporaryOperationDocument、afterStagingDocumentCreated: () => void、afterStagingDocumentWritten: () => void、afterCanonicalDocumentLinked: () => void」がcreateDocumentの入力契約を満たす。
 * @postcondition createDocumentの責務を完了して呼出し元へ制御を戻す。
 * @effect createDocumentはFilesystemの読取りまたは書込みを実行する。
 * @failure createDocumentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createDocumentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: createDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createDocumentは共有非同期状態を持たない同期処理である。
 */
function createDocument(
  documentPath: string,
  document: TemporaryOperationDocument,
  afterStagingDocumentCreated: () => void,
  afterStagingDocumentWritten: () => void,
  afterCanonicalDocumentLinked: () => void,
): void {
  const directory = path.dirname(documentPath);
  const stagingDirectory = path.join(directory, ".staging");
  ensureTemporaryOperationDirectory(stagingDirectory);
  const temporary = path.join(
    stagingDirectory,
    `${document.operationId}.${document.identity}.${document.generation}.preparing.json`,
  );
  if (fs.existsSync(temporary))
    throw new Error("temporary_operation_creation_in_progress");
  const descriptor = fs.openSync(temporary, "wx", 0o600);
  try {
    afterStagingDocumentCreated();
    fs.writeFileSync(descriptor, `${JSON.stringify(document)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  afterStagingDocumentWritten();
  try {
    fs.linkSync(temporary, documentPath);
    afterCanonicalDocumentLinked();
    const observed = readDocument(documentPath);
    if (
      observed.identity !== document.identity ||
      observed.generation !== document.generation ||
      observed.state !== document.state
    )
      throw new Error("temporary_operation_document_publish_unconfirmed");
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

/**
 * initial Document Staging Pathを決定する。
 *
 * @responsibility initial Document Staging Pathの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000011
 * @input documentPath: string、reference: TemporaryOperationRecoveryReference
 * @returns stringを返す。
 * @precondition 「documentPath: string、reference: TemporaryOperationRecoveryReference」がinitialDocumentStagingPathの入力契約を満たす。
 * @postcondition initialDocumentStagingPathの責務を完了した結果だけを返す。
 * @effect N/A: initialDocumentStagingPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: initialDocumentStagingPathは独自の失敗分岐を所有しない。
 * @invariant initialDocumentStagingPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: initialDocumentStagingPathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: initialDocumentStagingPathは共有非同期状態を持たない同期処理である。
 */
function initialDocumentStagingPath(
  documentPath: string,
  reference: TemporaryOperationRecoveryReference,
): string {
  return path.join(
    path.dirname(documentPath),
    ".staging",
    `${reference.operationId}.${reference.identity}.${reference.generation}.preparing.json`,
  );
}

/**
 * Confirmed Initial Document Staging Aliasを除去する。
 *
 * @responsibility Confirmed Initial Document Staging Aliasの対象Identity、除去条件、終了後状態の境界を所有する。
 * @trace ARCH-000011
 * @input documentPath: string、reference: TemporaryOperationRecoveryReference
 * @returns voidを返す。
 * @precondition 「documentPath: string、reference: TemporaryOperationRecoveryReference」がremoveConfirmedInitialDocumentStagingAliasの入力契約を満たす。
 * @postcondition removeConfirmedInitialDocumentStagingAliasの責務を完了した結果だけを返す。
 * @effect removeConfirmedInitialDocumentStagingAliasはFilesystemの読取りまたは書込みを実行する。
 * @failure removeConfirmedInitialDocumentStagingAliasは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant removeConfirmedInitialDocumentStagingAliasは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: removeConfirmedInitialDocumentStagingAliasはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: removeConfirmedInitialDocumentStagingAliasは共有非同期状態を持たない同期処理である。
 */
function removeConfirmedInitialDocumentStagingAlias(
  documentPath: string,
  reference: TemporaryOperationRecoveryReference,
): void {
  const stagingDocumentPath = initialDocumentStagingPath(
    documentPath,
    reference,
  );
  if (!fs.existsSync(stagingDocumentPath)) return;
  if (!fs.existsSync(documentPath))
    throw new Error("temporary_operation_staging_alias_unconfirmed");
  const canonicalMetadata = fs.lstatSync(documentPath);
  const stagingMetadata = fs.lstatSync(stagingDocumentPath);
  if (
    !canonicalMetadata.isFile() ||
    canonicalMetadata.isSymbolicLink() ||
    !stagingMetadata.isFile() ||
    stagingMetadata.isSymbolicLink() ||
    canonicalMetadata.dev !== stagingMetadata.dev ||
    canonicalMetadata.ino !== stagingMetadata.ino ||
    !fs.readFileSync(documentPath).equals(fs.readFileSync(stagingDocumentPath))
  )
    throw new Error("temporary_operation_staging_alias_unconfirmed");
  const stagedDocument = readDocument(stagingDocumentPath);
  if (
    stagedDocument.operationId !== reference.operationId ||
    stagedDocument.owner !== reference.owner ||
    stagedDocument.identity !== reference.identity ||
    stagedDocument.generation !== reference.generation ||
    stagedDocument.state !== "preparing"
  )
    throw new Error("temporary_operation_staging_alias_unconfirmed");
  fs.unlinkSync(stagingDocumentPath);
  if (fs.existsSync(stagingDocumentPath))
    throw new Error("temporary_operation_staging_alias_cleanup_unconfirmed");
}

/**
 * process Is Aliveを決定する。
 *
 * @responsibility process Is Aliveの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000011
 * @input processId: number
 * @returns processIsAliveの計算結果を返す。
 * @precondition 「processId: number」がprocessIsAliveの入力契約を満たす。
 * @postcondition processIsAliveの責務を完了した結果だけを返す。
 * @effect processIsAliveは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure processIsAliveは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant processIsAliveは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: processIsAliveはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: processIsAliveは共有非同期状態を持たない同期処理である。
 */
function processIsAlive(processId: number) {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Operationごとの短い更新区間を共通wx排他へ接続する。
 * @trace ARCH-000011
 * @concurrency 既存FileはPID・内容によらず保持し、停止下の明示回復なしに再取得しない。
 */
function acquireLifecycleLock(controlRoot: string, operationId: string): Lock {
  const result = acquireLock({
    directory: controlRoot,
    name: `${operationId}.lock`,
    identity: `temporary-operation:${operationId}`,
  });
  if (result.status === "acquired") return result.lock;
  throw new Error(
    result.reason === "lock_exists"
      ? "temporary_operation_lifecycle_busy"
      : "temporary_operation_lock_initialization_failed",
    { cause: result },
  );
}

/** 共通Lockが返した初期化残存・descriptor終了不明を業務失敗でも失わない。 */
function acquisitionCleanupUnconfirmed(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : null;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "status" in cause &&
    cause.status === "blocked" &&
    (("cleanupConfirmed" in cause && cause.cleanupConfirmed === false) ||
      ("descriptorClosed" in cause && cause.descriptorClosed === false))
  );
}

/**
 * Capabilityを発行する。
 *
 * @responsibility Capabilityの発行条件、Identity、非発行時のEffect 0境界を所有する。
 * @trace ARCH-000011
 * @input repositoryRoot: 検証済みRoot、controlRoot、directory、documentPath、document: 同RootのOperation。
 * @returns issueCapabilityの計算結果を返す。
 * @precondition 作成または再入場のOwnerが検証したRootから全Operation Pathを導出済みである。
 * @postcondition issueCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: issueCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: issueCapabilityは独自の失敗分岐を所有しない。
 * @invariant issueCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: issueCapabilityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: issueCapabilityは共有非同期状態を持たない同期処理である。
 */
function issueCapability(
  repositoryRoot: string,
  controlRoot: string,
  directory: string,
  documentPath: string,
  document: TemporaryOperationDocument,
) {
  const capability = Object.freeze({
    contract: "crdd/runtime-data/temporary-operation-capability/v1" as const,
  });
  const record = Object.freeze({
    allowedContent: document.allowedContent,
    repositoryRoot,
    controlRoot,
    directory,
    documentPath,
    evidencePromotionRequired: document.evidencePromotion === "required",
    generation: document.generation,
    identity: document.identity,
    operationId: document.operationId,
    owner: document.owner,
  });
  operations.set(capability, record);
  return { capability, record };
}

/**
 * Temporary Operation Internalを構築する。
 *
 * @responsibility Temporary Operation Internalの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000011
 * @input rootCapability: Repository、input: TemporaryOperationInput、afterStagingDocumentCreated: () => void、afterStagingDocumentWritten: () => void、afterCanonicalDocumentLinked: () => void、afterControlDocumentPublished: () => void
 * @returns createTemporaryOperationInternalの計算結果を返す。
 * @precondition 「rootCapability: Repository、input: TemporaryOperationInput、afterStagingDocumentCreated: () => void、afterStagingDocumentWritten: () => void、afterCanonicalDocumentLinked: () => void、afterControlDocumentPublished: () => void」がcreateTemporaryOperationInternalの入力契約を満たす。
 * @postcondition createTemporaryOperationInternalの責務を完了した結果だけを返す。
 * @effect createTemporaryOperationInternalはFilesystemの読取りまたは書込みを実行する。
 * @failure createTemporaryOperationInternalは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createTemporaryOperationInternalは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: createTemporaryOperationInternalはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createTemporaryOperationInternalは共有非同期状態を持たない同期処理である。
 */
function createTemporaryOperationInternal(
  rootCapability: Repository,
  input: TemporaryOperationInput,
  afterStagingDocumentCreated: () => void,
  afterStagingDocumentWritten: () => void,
  afterCanonicalDocumentLinked: () => void,
  afterControlDocumentPublished: () => void,
) {
  let createdDirectory: string | null = null;
  let documentPath: string | null = null;
  let isDocumentPublished = false;
  let workspaceOwnershipConfirmed = false;
  let pendingReference: TemporaryOperationRecoveryReference | null = null;
  try {
    if (!validInput(input))
      throw new Error("temporary_operation_input_invalid");
    const paths =
      resolveRepositoryRuntimeDataPathsForInternalUse(rootCapability);
    if (!paths) throw new Error("temporary_operation_root_invalid");
    ensureTemporaryOperationDirectory(paths.root);
    ensureTemporaryOperationDirectory(paths.temporary);
    const controlRoot = path.join(paths.temporary, ".operations");
    ensureTemporaryOperationDirectory(controlRoot);
    const directory = path.join(paths.temporary, input.operationId);
    documentPath = path.join(controlRoot, `${input.operationId}.json`);
    if (fs.existsSync(directory))
      throw new Error("temporary_operation_creation_failed");
    const preparing: TemporaryOperationDocument = Object.freeze({
      schema: "crdd/runtime-data/temporary-operation/v3",
      operationId: input.operationId,
      identity: input.identity,
      owner: input.owner,
      generation: 1,
      ownerProcessId: process.pid,
      previousGeneration: null,
      state: "preparing",
      purpose: input.purpose,
      allowedContent: Object.freeze([...input.allowedContent]),
      terminalPaths: Object.freeze([
        "completed",
        "failed",
        "cancelled",
        "timed_out",
        "parent_lost",
      ]),
      evidencePromotion: input.evidencePromotion,
    });
    pendingReference = Object.freeze({
      operationId: input.operationId,
      owner: input.owner,
      identity: input.identity,
      generation: 1,
    });
    try {
      createDocument(
        documentPath,
        preparing,
        afterStagingDocumentCreated,
        afterStagingDocumentWritten,
        afterCanonicalDocumentLinked,
      );
      isDocumentPublished = true;
    } catch (error) {
      isDocumentPublished = fs.existsSync(documentPath);
      throw error;
    }
    afterControlDocumentPublished();
    fs.mkdirSync(directory, { mode: 0o700 });
    createdDirectory = directory;
    workspaceOwnershipConfirmed = true;
    if (
      !isSafeDirectory(directory) ||
      path.dirname(directory) !== paths.temporary
    )
      throw new Error("temporary_operation_boundary_invalid");
    ensureTemporaryOperationDirectory(path.join(directory, "work"));
    const active = Object.freeze({ ...preparing, state: "active" as const });
    writeDocument(documentPath, active);
    const issued = issueCapability(
      paths.repositoryRoot,
      controlRoot,
      directory,
      documentPath,
      active,
    );
    return Object.freeze({
      status: "completed" as const,
      reason: "temporary_operation_created" as const,
      capability: issued.capability,
      workDirectory: path.join(directory, "work"),
      recoveryReference: recoveryReference(issued.record),
    });
  } catch (error) {
    let cleanupConfirmed = createdDirectory === null && !isDocumentPublished;
    if (
      isDocumentPublished &&
      !workspaceOwnershipConfirmed &&
      documentPath !== null
    ) {
      try {
        fs.unlinkSync(documentPath);
        cleanupConfirmed = !fs.existsSync(documentPath);
        isDocumentPublished = !cleanupConfirmed;
      } catch {
        cleanupConfirmed = false;
      }
    }
    if (
      isDocumentPublished &&
      workspaceOwnershipConfirmed &&
      documentPath !== null &&
      pendingReference
    ) {
      try {
        const current = readDocument(documentPath);
        writeDocument(
          documentPath,
          Object.freeze({ ...current, state: "recovery_required" }),
        );
      } catch {
        // The exact caller-owned identity still identifies the failed creation.
      }
    } else if (createdDirectory !== null) {
      try {
        if (!isSafeDirectory(createdDirectory)) throw new Error();
        fs.rmSync(createdDirectory, { recursive: true });
        cleanupConfirmed = !fs.existsSync(createdDirectory);
      } catch {
        cleanupConfirmed = false;
      }
    }
    const reason =
      error instanceof Error &&
      /^temporary_operation_[a-z_]+$/u.test(error.message)
        ? error.message
        : "temporary_operation_creation_failed";
    return Object.freeze({
      status: "blocked" as const,
      reason,
      capability: null,
      workDirectory: null,
      cleanupConfirmed,
      recoveryRequired: isDocumentPublished || !cleanupConfirmed,
      recoveryReference:
        isDocumentPublished || !cleanupConfirmed ? pendingReference : null,
    });
  }
}

/**
 * Temporary Operationを構築する。
 *
 * @responsibility Temporary Operationの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000011
 * @input rootCapability: Repository、input: TemporaryOperationInput
 * @returns createTemporaryOperationの計算結果を返す。
 * @precondition 「rootCapability: Repository、input: TemporaryOperationInput」がcreateTemporaryOperationの入力契約を満たす。
 * @postcondition createTemporaryOperationの責務を完了した結果だけを返す。
 * @effect N/A: createTemporaryOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createTemporaryOperationは独自の失敗分岐を所有しない。
 * @invariant createTemporaryOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: createTemporaryOperationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createTemporaryOperationは共有非同期状態を持たない同期処理である。
 */
export function createTemporaryOperation(
  rootCapability: Repository,
  input: TemporaryOperationInput,
) {
  return createTemporaryOperationInternal(
    rootCapability,
    input,
    () => {},
    () => {},
    () => {},
    () => {},
  );
}

/**
 * Direct-file verification seam; intentionally omitted from the public index.
 *
 * @responsibility Temporary Operation With Interruption For Verificationの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000011
 * @input rootCapability: Repository、input: TemporaryOperationInput、phase: | "after_staging_created" | "after_staging" | "after_staging_linked" | "after_control"、interrupt: () => void
 * @returns createTemporaryOperationWithInterruptionForVerificationの計算結果を返す。
 * @precondition 「rootCapability: Repository、input: TemporaryOperationInput、phase: | "after_staging_created" | "after_staging" | "after_staging_linked" | "after_control"、interrupt: () => void」がcreateTemporaryOperationWithInterruptionForVerificationの入力契約を満たす。
 * @postcondition createTemporaryOperationWithInterruptionForVerificationの責務を完了した結果だけを返す。
 * @effect N/A: createTemporaryOperationWithInterruptionForVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createTemporaryOperationWithInterruptionForVerificationは独自の失敗分岐を所有しない。
 * @invariant createTemporaryOperationWithInterruptionForVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: createTemporaryOperationWithInterruptionForVerificationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createTemporaryOperationWithInterruptionForVerificationは共有非同期状態を持たない同期処理である。
 */
export function createTemporaryOperationWithInterruptionForVerification(
  rootCapability: Repository,
  input: TemporaryOperationInput,
  phase:
    | "after_staging_created"
    | "after_staging"
    | "after_staging_linked"
    | "after_control",
  interrupt: () => void,
) {
  return createTemporaryOperationInternal(
    rootCapability,
    input,
    phase === "after_staging_created" ? interrupt : () => {},
    phase === "after_staging" ? interrupt : () => {},
    phase === "after_staging_linked" ? interrupt : () => {},
    phase === "after_control" ? interrupt : () => {},
  );
}

/**
 * resume Temporary Operation Internalを決定する。
 *
 * @responsibility resume Temporary Operation Internalの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000011
 * @input rootCapability: Repository、reference: TemporaryOperationRecoveryReference、nextIdentity: string、afterLockAcquired: () => void、afterNextGenerationPublished: () => void
 * @returns resumeTemporaryOperationInternalの計算結果を返す。
 * @precondition 「rootCapability: Repository、reference: TemporaryOperationRecoveryReference、nextIdentity: string、afterLockAcquired: () => void、afterNextGenerationPublished: () => void」がresumeTemporaryOperationInternalの入力契約を満たす。
 * @postcondition resumeTemporaryOperationInternalの責務を完了した結果だけを返す。
 * @effect resumeTemporaryOperationInternalはFilesystemの読取りまたは書込みを実行する。
 * @failure resumeTemporaryOperationInternalは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resumeTemporaryOperationInternalは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: resumeTemporaryOperationInternalはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resumeTemporaryOperationInternalは共有非同期状態を持たない同期処理である。
 */
function resumeTemporaryOperationInternal(
  rootCapability: Repository,
  reference: TemporaryOperationRecoveryReference,
  nextIdentity: string,
  afterLockAcquired: () => void,
  afterNextGenerationPublished: () => void,
) {
  let lock: Lock | null = null;
  let directory: string | null = null;
  let documentPath: string | null = null;
  let pendingRecoveryDocument: TemporaryOperationDocument | null = null;
  try {
    if (
      typeof reference !== "object" ||
      reference === null ||
      !ID.test(reference.operationId) ||
      /^signature\.*$/iu.test(reference.operationId) ||
      "storage" in reference ||
      !ID.test(reference.owner) ||
      !ID.test(reference.identity) ||
      !ID.test(nextIdentity) ||
      nextIdentity === reference.identity ||
      !Number.isSafeInteger(reference.generation) ||
      reference.generation < 1
    )
      throw new Error("temporary_operation_recovery_reference_invalid");
    const paths =
      resolveRepositoryRuntimeDataPathsForInternalUse(rootCapability);
    if (!paths) throw new Error("temporary_operation_root_invalid");
    const controlRoot = path.join(paths.temporary, ".operations");
    if (!isSafeDirectory(controlRoot))
      throw new Error("temporary_operation_boundary_invalid");
    directory = path.join(paths.temporary, reference.operationId);
    documentPath = path.join(controlRoot, `${reference.operationId}.json`);
    if (path.dirname(directory) !== paths.temporary)
      throw new Error("temporary_operation_boundary_invalid");
    lock = acquireLifecycleLock(controlRoot, reference.operationId);
    afterLockAcquired();
    if (!fs.existsSync(documentPath)) {
      const stagingDocumentPath = initialDocumentStagingPath(
        documentPath,
        reference,
      );
      if (!fs.existsSync(stagingDocumentPath))
        throw new Error("temporary_operation_recovery_identity_mismatch");
      let stagedDocument: TemporaryOperationDocument | null = null;
      try {
        stagedDocument = readDocument(stagingDocumentPath);
      } catch {
        const metadata = fs.lstatSync(stagingDocumentPath);
        if (!metadata.isFile() || metadata.isSymbolicLink())
          throw new Error("temporary_operation_boundary_invalid");
        fs.rmSync(stagingDocumentPath);
        throw new Error("temporary_operation_prepublication_cleanup_confirmed");
      }
      if (
        stagedDocument.operationId !== reference.operationId ||
        stagedDocument.owner !== reference.owner ||
        stagedDocument.identity !== reference.identity ||
        stagedDocument.generation !== reference.generation ||
        stagedDocument.state !== "preparing"
      )
        throw new Error("temporary_operation_recovery_identity_mismatch");
      fs.linkSync(stagingDocumentPath, documentPath);
      fs.rmSync(stagingDocumentPath);
    } else {
      removeConfirmedInitialDocumentStagingAlias(documentPath, reference);
    }
    let document = readDocument(documentPath);
    if (
      document.operationId !== reference.operationId ||
      document.owner !== reference.owner ||
      document.identity !== reference.identity
    )
      throw new Error("temporary_operation_recovery_identity_mismatch");
    const isOwnerAlive = processIsAlive(document.ownerProcessId);
    if (document.state === "preparing") {
      if (isOwnerAlive)
        throw new Error("temporary_operation_recovery_not_required");
      if (document.generation !== reference.generation)
        throw new Error("temporary_operation_recovery_identity_mismatch");
      if (!fs.existsSync(directory)) fs.mkdirSync(directory, { mode: 0o700 });
      if (!isSafeDirectory(directory))
        throw new Error("temporary_operation_boundary_invalid");
      const work = path.join(directory, "work");
      if (!fs.existsSync(work)) ensureTemporaryOperationDirectory(work);
      if (!isSafeDirectory(work))
        throw new Error("temporary_operation_boundary_invalid");
      document = Object.freeze({
        ...document,
        state: "recovery_required" as const,
      });
      writeDocument(documentPath, document);
    } else if (document.state === "active") {
      if (document.generation !== reference.generation)
        throw new Error("temporary_operation_recovery_identity_mismatch");
      if (isOwnerAlive)
        throw new Error("temporary_operation_recovery_not_required");
      if (
        !isSafeDirectory(directory) ||
        !isSafeDirectory(path.join(directory, "work"))
      )
        throw new Error("temporary_operation_boundary_invalid");
      document = Object.freeze({
        ...document,
        state: "recovery_required" as const,
      });
      writeDocument(documentPath, document);
    }
    if (
      document.state !== "recovery_required" ||
      document.generation !== reference.generation
    )
      throw new Error("temporary_operation_recovery_identity_mismatch");
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, { mode: 0o700 });
    if (!isSafeDirectory(directory))
      throw new Error("temporary_operation_boundary_invalid");
    const work = path.join(directory, "work");
    if (!fs.existsSync(work)) ensureTemporaryOperationDirectory(work);
    if (!isSafeDirectory(work))
      throw new Error("temporary_operation_boundary_invalid");
    const resumed: TemporaryOperationDocument = Object.freeze({
      ...document,
      identity: nextIdentity,
      state: "active",
      generation: document.generation + 1,
      ownerProcessId: process.pid,
      previousGeneration: document.generation,
    });
    pendingRecoveryDocument = resumed;
    writeDocument(documentPath, resumed);
    afterNextGenerationPublished();
    if (!lock.release())
      throw new Error("temporary_operation_lock_cleanup_unconfirmed");
    lock = null;
    const issued = issueCapability(
      paths.repositoryRoot,
      controlRoot,
      directory,
      documentPath,
      resumed,
    );
    pendingRecoveryDocument = null;
    return Object.freeze({
      status: "completed" as const,
      reason: "temporary_operation_resumed" as const,
      capability: issued.capability,
      workDirectory: path.join(directory, "work"),
      recoveryReference: recoveryReference(issued.record),
    });
  } catch (error) {
    let recoveryReferenceValue: TemporaryOperationRecoveryReference | null =
      null;
    if (documentPath !== null && pendingRecoveryDocument !== null) {
      let known = pendingRecoveryDocument;
      let hasObservedNext = false;
      try {
        const observed = readDocument(documentPath);
        if (
          observed.operationId === reference.operationId &&
          observed.owner === reference.owner
        ) {
          if (
            observed.identity === reference.identity &&
            observed.generation === reference.generation
          )
            known = observed;
          else if (
            observed.identity === pendingRecoveryDocument.identity &&
            observed.generation === pendingRecoveryDocument.generation
          ) {
            known = observed;
            hasObservedNext = true;
          }
        }
      } catch {
        // 公開結果不明でも試行したIdentityを非Authorityの参照として保持する。
      }
      recoveryReferenceValue = Object.freeze({
        operationId: known.operationId,
        owner: known.owner,
        identity: known.identity,
        generation: known.generation,
      });
      if (hasObservedNext) {
        try {
          writeDocument(
            documentPath,
            Object.freeze({ ...known, state: "recovery_required" as const }),
          );
        } catch {
          // 再保存不明を成功にせず、既知参照を失わない。
        }
      }
    }
    const released =
      lock === null ? !acquisitionCleanupUnconfirmed(error) : lock.release();
    if (!released && recoveryReferenceValue === null && documentPath !== null) {
      recoveryReferenceValue = Object.freeze({
        operationId: reference.operationId,
        owner: reference.owner,
        identity: reference.identity,
        generation: reference.generation,
      });
    }
    const reason =
      error instanceof Error &&
      /^temporary_operation_[a-z_]+$/u.test(error.message)
        ? error.message
        : "temporary_operation_resume_failed";
    const cleanupConfirmed =
      reason === "temporary_operation_prepublication_cleanup_confirmed" &&
      released;
    return Object.freeze({
      status: "blocked" as const,
      reason,
      capability: null,
      workDirectory: null,
      cleanupConfirmed,
      recoveryReference: recoveryReferenceValue,
    });
  }
}

/**
 * resume Temporary Operationを決定する。
 *
 * @responsibility resume Temporary Operationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000011
 * @input rootCapability: Repository、reference: TemporaryOperationRecoveryReference、nextIdentity: string
 * @returns resumeTemporaryOperationの計算結果を返す。
 * @precondition 「rootCapability: Repository、reference: TemporaryOperationRecoveryReference、nextIdentity: string」がresumeTemporaryOperationの入力契約を満たす。
 * @postcondition resumeTemporaryOperationの責務を完了した結果だけを返す。
 * @effect N/A: resumeTemporaryOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resumeTemporaryOperationは独自の失敗分岐を所有しない。
 * @invariant resumeTemporaryOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: resumeTemporaryOperationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resumeTemporaryOperationは共有非同期状態を持たない同期処理である。
 */
export function resumeTemporaryOperation(
  rootCapability: Repository,
  reference: TemporaryOperationRecoveryReference,
  nextIdentity: string,
) {
  return resumeTemporaryOperationInternal(
    rootCapability,
    reference,
    nextIdentity,
    () => {},
    () => {},
  );
}

/**
 * Direct-file verification seam; intentionally omitted from the public index.
 *
 * @responsibility temporary-operation-storeの入力からresume Temporary Operation With Interruption For Verificationを導く規則と結果境界を所有する。
 * @trace ARCH-000011
 * @input rootCapability: Repository、reference: TemporaryOperationRecoveryReference、nextIdentity: string、phase: | "after_lock_acquired" | "after_generation"、afterNextGenerationPublished: () => void
 * @returns resumeTemporaryOperationWithInterruptionForVerificationの計算結果を返す。
 * @precondition 「rootCapability: Repository、reference: TemporaryOperationRecoveryReference、nextIdentity: string、phase: | "after_lock_acquired" | "after_generation"、afterNextGenerationPublished: () => void」がresumeTemporaryOperationWithInterruptionForVerificationの入力契約を満たす。
 * @postcondition resumeTemporaryOperationWithInterruptionForVerificationの責務を完了した結果だけを返す。
 * @effect N/A: resumeTemporaryOperationWithInterruptionForVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resumeTemporaryOperationWithInterruptionForVerificationは独自の失敗分岐を所有しない。
 * @invariant resumeTemporaryOperationWithInterruptionForVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: resumeTemporaryOperationWithInterruptionForVerificationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resumeTemporaryOperationWithInterruptionForVerificationは共有非同期状態を持たない同期処理である。
 */
export function resumeTemporaryOperationWithInterruptionForVerification(
  rootCapability: Repository,
  reference: TemporaryOperationRecoveryReference,
  nextIdentity: string,
  phase: "after_lock_acquired" | "after_generation",
  afterNextGenerationPublished: () => void,
) {
  return resumeTemporaryOperationInternal(
    rootCapability,
    reference,
    nextIdentity,
    phase === "after_lock_acquired" ? afterNextGenerationPublished : () => {},
    phase === "after_generation" ? afterNextGenerationPublished : () => {},
  );
}

/**
 * 同一Repositoryの正式Evidenceを読取り、全Path境界と単一fileのHashを確認する。
 *
 * @responsibility CHG／Release Evidenceだけの有限Path文法とalias／hardlink拒否を所有する。
 * @trace ARCH-000011
 * @input repositoryRoot: 検証済みRoot、evidenceRelativePath: 相対POSIX Path。
 * @returns 既存Evidence fileのSHA-256。
 * @precondition 正式copyは呼出し側が所有し、この処理は作成しない。
 * @postcondition Rootからfileまでの実体が正規Pathと一致し読取り前後で変わらない。
 * @effect 既存Directory metadataと単一file descriptorを読取り、必ずcloseする。
 * @failure 不正文法、dot segment、alias、hardlink、観測不能または途中置換を拒否する。
 * @invariant tests／tmpのcopyを正式Evidenceへ昇格せず、任意absolute Pathを受けない。
 * @boundary 検証済みRepositoryと正式CHG／Release EvidenceのFilesystem境界。
 * @security 同一Root内の有限allowlistだけを読み、Authorityを発行しない。
 * @concurrency 親Directoryとfile Identityを前後照合し途中差を拒否する。
 */
function readTemporaryOperationEvidenceHash(
  repositoryRoot: string,
  evidenceRelativePath: string,
) {
  if (
    typeof evidenceRelativePath !== "string" ||
    !/^99_Roadmap\/(?:Changes\/CHG-[0-9]{6}|Releases\/v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]{1,64})?)\/Evidence\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}(?:\/[A-Za-z0-9][A-Za-z0-9._-]{0,127})*$/u.test(
      evidenceRelativePath,
    )
  )
    throw new Error("temporary_operation_evidence_target_invalid");
  const segments = evidenceRelativePath.split("/");
  const target = path.join(repositoryRoot, ...segments);
  const parents = [repositoryRoot];
  for (const segment of segments.slice(0, -1))
    parents.push(path.join(parents.at(-1) ?? repositoryRoot, segment));
  const observations = parents.map((parent) => {
    const metadata = fs.lstatSync(parent, { bigint: true });
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      fs.realpathSync.native(parent) !== parent
    )
      throw new Error("temporary_operation_evidence_target_invalid");
    return { parent, metadata };
  });
  const before = fs.lstatSync(target, { bigint: true });
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.nlink !== 1n ||
    fs.realpathSync.native(target) !== target
  )
    throw new Error("temporary_operation_evidence_target_invalid");
  const descriptor = fs.openSync(target, "r");
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (
      !opened.isFile() ||
      opened.nlink !== 1n ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.birthtimeNs !== before.birthtimeNs
    )
      throw new Error("temporary_operation_evidence_target_invalid");
    const hash = createHash("sha256")
      .update(fs.readFileSync(descriptor))
      .digest("hex");
    const after = fs.lstatSync(target, { bigint: true });
    const finished = fs.fstatSync(descriptor, { bigint: true });
    if (
      !after.isFile() ||
      after.isSymbolicLink() ||
      after.nlink !== 1n ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.birthtimeNs !== opened.birthtimeNs ||
      after.size !== opened.size ||
      after.mtimeNs !== opened.mtimeNs ||
      finished.size !== opened.size ||
      finished.mtimeNs !== opened.mtimeNs ||
      fs.realpathSync.native(target) !== target
    )
      throw new Error("temporary_operation_evidence_target_invalid");
    for (const { parent, metadata } of observations) {
      const current = fs.lstatSync(parent, { bigint: true });
      if (
        !current.isDirectory() ||
        current.isSymbolicLink() ||
        current.dev !== metadata.dev ||
        current.ino !== metadata.ino ||
        current.birthtimeNs !== metadata.birthtimeNs ||
        fs.realpathSync.native(parent) !== parent
      )
        throw new Error("temporary_operation_evidence_target_invalid");
    }
    return hash;
  } finally {
    fs.closeSync(descriptor);
  }
}

/**
 * Temporary Operation Evidence Promotionを検証する。
 *
 * @responsibility Temporary Operation Evidence Promotionの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input rootCapability: Repository、capability: TemporaryOperationCapability、input: 正式Evidence相対Path、artifactName、sha256。
 * @returns verifyTemporaryOperationEvidencePromotionの計算結果を返す。
 * @precondition 呼出し側が同一RootのCHG／Release Evidenceへ正式copyを完了している。
 * @postcondition verifyTemporaryOperationEvidencePromotionの責務を完了した結果だけを返す。
 * @effect verifyTemporaryOperationEvidencePromotionはFilesystemの読取りまたは書込みを実行する。
 * @failure verifyTemporaryOperationEvidencePromotionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyTemporaryOperationEvidencePromotionは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security verifyTemporaryOperationEvidencePromotionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyTemporaryOperationEvidencePromotionは共有非同期状態を持たない同期処理である。
 */
export function verifyTemporaryOperationEvidencePromotion(
  rootCapability: Repository,
  capability: TemporaryOperationCapability,
  input: Readonly<{
    evidenceRelativePath: string;
    artifactName: string;
    sha256: string;
  }>,
) {
  try {
    const record = operations.get(capability);
    if (!record) throw new Error("temporary_operation_capability_invalid");
    if (
      !input ||
      !ID.test(input.artifactName) ||
      !SHA256.test(input.sha256) ||
      !record.allowedContent.includes(input.artifactName)
    )
      throw new Error("temporary_operation_evidence_receipt_invalid");
    const paths =
      resolveRepositoryRuntimeDataPathsForInternalUse(rootCapability);
    if (!paths || paths.repositoryRoot !== record.repositoryRoot)
      throw new Error("temporary_operation_root_invalid");
    const observed = readTemporaryOperationEvidenceHash(
      paths.repositoryRoot,
      input.evidenceRelativePath,
    );
    const target = path.join(
      paths.repositoryRoot,
      ...input.evidenceRelativePath.split("/"),
    );
    const source = path.join(record.directory, "work", input.artifactName);
    const sourceMetadata = fs.lstatSync(source);
    const metadata = fs.lstatSync(target);
    if (
      !sourceMetadata.isFile() ||
      sourceMetadata.isSymbolicLink() ||
      sourceMetadata.nlink !== 1 ||
      fs.realpathSync.native(source) !== source ||
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      fs.realpathSync.native(target) !== target
    )
      throw new Error("temporary_operation_evidence_target_invalid");
    const sourceHash = createHash("sha256")
      .update(fs.readFileSync(source))
      .digest("hex");
    if (sourceHash !== input.sha256 || observed !== input.sha256)
      throw new Error("temporary_operation_evidence_hash_mismatch");
    const receipt = Object.freeze({
      contract:
        "crdd/runtime-data/temporary-evidence-promotion-receipt/v1" as const,
    });
    promotionReceipts.set(
      receipt,
      Object.freeze({
        operationId: record.operationId,
        identity: record.identity,
        generation: record.generation,
        sha256: observed,
        source,
        target,
        repositoryRoot: paths.repositoryRoot,
        evidenceRelativePath: input.evidenceRelativePath,
      }),
    );
    return Object.freeze({
      status: "completed" as const,
      reason: "temporary_operation_evidence_promotion_verified" as const,
      receipt,
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason:
        error instanceof Error &&
        /^temporary_operation_[a-z_]+$/u.test(error.message)
          ? error.message
          : "temporary_operation_evidence_verification_failed",
      receipt: null,
    });
  }
}

/**
 * Temporary Operation With Removalを終端状態へ確定する。
 *
 * @responsibility Temporary Operation With Removalの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000011
 * @input capability: TemporaryOperationCapability、outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost"、promotionReceipt: TemporaryEvidencePromotionReceipt | null、removeDirectory: (directory: string) => void
 * @returns settleTemporaryOperationWithRemovalの計算結果を返す。
 * @precondition 「capability: TemporaryOperationCapability、outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost"、promotionReceipt: TemporaryEvidencePromotionReceipt | null、removeDirectory: (directory: string) => void」がsettleTemporaryOperationWithRemovalの入力契約を満たす。
 * @postcondition settleTemporaryOperationWithRemovalの責務を完了した結果だけを返す。
 * @effect settleTemporaryOperationWithRemovalはFilesystemの読取りまたは書込みを実行する。
 * @failure settleTemporaryOperationWithRemovalは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant settleTemporaryOperationWithRemovalは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security settleTemporaryOperationWithRemovalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settleTemporaryOperationWithRemovalは共有非同期状態を持たない同期処理である。
 */
function settleTemporaryOperationWithRemoval(
  capability: TemporaryOperationCapability,
  outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost",
  promotionReceipt: TemporaryEvidencePromotionReceipt | null,
  removeDirectory: (directory: string) => void,
) {
  const record = operations.get(capability);
  if (!record)
    return Object.freeze({
      status: "blocked" as const,
      reason: "temporary_operation_capability_invalid" as const,
      cleanupConfirmed: false,
      recoveryRequired: true,
      recoveryReference: null,
    });
  if (typeof outcome !== "string" || !OUTCOMES.has(outcome))
    return Object.freeze({
      status: "blocked" as const,
      reason: "temporary_operation_outcome_invalid" as const,
      cleanupConfirmed: false,
      recoveryRequired: true,
      recoveryReference: recoveryReference(record),
    });
  let lock: Lock | null = null;
  let durableRecoveryConfirmed = false;
  try {
    lock = acquireLifecycleLock(record.controlRoot, record.operationId);
    const document = readDocument(record.documentPath);
    if (
      document.operationId !== record.operationId ||
      document.owner !== record.owner ||
      document.state !== "active" ||
      document.identity !== record.identity ||
      document.generation !== record.generation
    )
      throw new Error("temporary_operation_capability_stale");
    if (outcome === "parent_lost") {
      writeDocument(
        record.documentPath,
        Object.freeze({ ...document, state: "recovery_required" }),
      );
      durableRecoveryConfirmed = true;
      operations.delete(capability);
      const released = lock.release();
      lock = null;
      if (!released)
        throw new Error("temporary_operation_lock_cleanup_unconfirmed");
      return Object.freeze({
        status: "blocked" as const,
        reason: "temporary_operation_parent_lost" as const,
        cleanupConfirmed: false,
        recoveryRequired: true,
        recoveryReference: recoveryReference(record),
      });
    }
    if (record.evidencePromotionRequired) {
      const promotion =
        promotionReceipt === null
          ? undefined
          : promotionReceipts.get(promotionReceipt);
      if (
        !promotion ||
        promotion.repositoryRoot !== record.repositoryRoot ||
        promotion.operationId !== record.operationId ||
        promotion.identity !== record.identity ||
        promotion.generation !== record.generation
      )
        throw new Error("temporary_operation_evidence_not_promoted");
      const sourceMetadata = fs.lstatSync(promotion.source);
      const targetMetadata = fs.lstatSync(promotion.target);
      if (
        !sourceMetadata.isFile() ||
        sourceMetadata.isSymbolicLink() ||
        sourceMetadata.nlink !== 1 ||
        fs.realpathSync.native(promotion.source) !== promotion.source ||
        !targetMetadata.isFile() ||
        targetMetadata.isSymbolicLink() ||
        fs.realpathSync.native(promotion.target) !== promotion.target ||
        createHash("sha256")
          .update(fs.readFileSync(promotion.source))
          .digest("hex") !== promotion.sha256 ||
        readTemporaryOperationEvidenceHash(
          promotion.repositoryRoot,
          promotion.evidenceRelativePath,
        ) !== promotion.sha256
      )
        throw new Error("temporary_operation_evidence_not_promoted");
    }
    writeDocument(
      record.documentPath,
      Object.freeze({ ...document, state: "recovery_required" }),
    );
    durableRecoveryConfirmed = true;
    operations.delete(capability);
    removeDirectory(record.directory);
    if (fs.existsSync(record.directory))
      throw new Error("temporary_operation_cleanup_unconfirmed");
    removeConfirmedInitialDocumentStagingAlias(
      record.documentPath,
      recoveryReference(record),
    );
    fs.unlinkSync(record.documentPath);
    const stagingDocumentPath = initialDocumentStagingPath(
      record.documentPath,
      recoveryReference(record),
    );
    const cleanupConfirmed =
      !fs.existsSync(record.directory) &&
      !fs.existsSync(record.documentPath) &&
      !fs.existsSync(stagingDocumentPath);
    if (cleanupConfirmed) {
      if (promotionReceipt) promotionReceipts.delete(promotionReceipt);
    }
    const released = lock.release();
    lock = null;
    if (!released)
      throw new Error("temporary_operation_lock_cleanup_unconfirmed");
    return Object.freeze({
      status: cleanupConfirmed ? ("completed" as const) : ("blocked" as const),
      reason: cleanupConfirmed
        ? ("temporary_operation_settled" as const)
        : ("temporary_operation_cleanup_unconfirmed" as const),
      cleanupConfirmed,
      recoveryRequired: !cleanupConfirmed,
      recoveryReference: cleanupConfirmed ? null : recoveryReference(record),
    });
  } catch (error) {
    const released = lock === null || lock.release();
    const recoveryRequired =
      durableRecoveryConfirmed ||
      !released ||
      acquisitionCleanupUnconfirmed(error);
    const reason =
      error instanceof Error &&
      /^temporary_operation_[a-z_]+$/u.test(error.message)
        ? error.message
        : "temporary_operation_cleanup_unconfirmed";
    return Object.freeze({
      status: "blocked" as const,
      reason,
      cleanupConfirmed: false,
      recoveryRequired,
      recoveryReference: recoveryRequired ? recoveryReference(record) : null,
    });
  }
}

/**
 * Temporary Operationを終端状態へ確定する。
 *
 * @responsibility Temporary Operationの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000011
 * @input capability: TemporaryOperationCapability、outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost"、promotionReceipt: TemporaryEvidencePromotionReceipt | null
 * @returns settleTemporaryOperationの計算結果を返す。
 * @precondition 「capability: TemporaryOperationCapability、outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost"、promotionReceipt: TemporaryEvidencePromotionReceipt | null」がsettleTemporaryOperationの入力契約を満たす。
 * @postcondition settleTemporaryOperationの責務を完了した結果だけを返す。
 * @effect settleTemporaryOperationはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: settleTemporaryOperationは独自の失敗分岐を所有しない。
 * @invariant settleTemporaryOperationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security settleTemporaryOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settleTemporaryOperationは共有非同期状態を持たない同期処理である。
 */
export function settleTemporaryOperation(
  capability: TemporaryOperationCapability,
  outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost",
  promotionReceipt: TemporaryEvidencePromotionReceipt | null,
) {
  return settleTemporaryOperationWithRemoval(
    capability,
    outcome,
    promotionReceipt,
    (directory) => fs.rmSync(directory, { recursive: true }),
  );
}

/**
 * Internal contract-test entry; omitted from the package public index.
 *
 * @responsibility Temporary Operation With Removal For Verificationの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000011
 * @input capability: TemporaryOperationCapability、outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost"、promotionReceipt: TemporaryEvidencePromotionReceipt | null、removeDirectory: (directory: string) => void
 * @returns settleTemporaryOperationWithRemovalForVerificationの計算結果を返す。
 * @precondition 「capability: TemporaryOperationCapability、outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost"、promotionReceipt: TemporaryEvidencePromotionReceipt | null、removeDirectory: (directory: string) => void」がsettleTemporaryOperationWithRemovalForVerificationの入力契約を満たす。
 * @postcondition settleTemporaryOperationWithRemovalForVerificationの責務を完了した結果だけを返す。
 * @effect N/A: settleTemporaryOperationWithRemovalForVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: settleTemporaryOperationWithRemovalForVerificationは独自の失敗分岐を所有しない。
 * @invariant settleTemporaryOperationWithRemovalForVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security settleTemporaryOperationWithRemovalForVerificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settleTemporaryOperationWithRemovalForVerificationは共有非同期状態を持たない同期処理である。
 */
export function settleTemporaryOperationWithRemovalForVerification(
  capability: TemporaryOperationCapability,
  outcome: "completed" | "failed" | "cancelled" | "timed_out" | "parent_lost",
  promotionReceipt: TemporaryEvidencePromotionReceipt | null,
  removeDirectory: (directory: string) => void,
) {
  return settleTemporaryOperationWithRemoval(
    capability,
    outcome,
    promotionReceipt,
    removeDirectory,
  );
}

/**
 * temporary-operation-storeで使用するTemporary Operation Capabilityの値契約を定義する。
 *
 * @responsibility Temporary Operation CapabilityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape TemporaryOperationCapabilityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TemporaryOperationCapabilityで宣言した値と責務の対応を維持する。
 * @boundary N/A: TemporaryOperationCapabilityの宣言は外部境界を開かない。
 * @security N/A: TemporaryOperationCapabilityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TemporaryOperationCapabilityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TemporaryOperationCapability = Readonly<{
  contract: "crdd/runtime-data/temporary-operation-capability/v1";
}>;

/**
 * temporary-operation-storeで使用するTemporary Evidence Promotion Receiptの値契約を定義する。
 *
 * @responsibility Temporary Evidence Promotion ReceiptのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape TemporaryEvidencePromotionReceiptが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TemporaryEvidencePromotionReceiptで宣言した値と責務の対応を維持する。
 * @boundary N/A: TemporaryEvidencePromotionReceiptの宣言は外部境界を開かない。
 * @security N/A: TemporaryEvidencePromotionReceiptはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TemporaryEvidencePromotionReceiptの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TemporaryEvidencePromotionReceipt = Readonly<{
  contract: "crdd/runtime-data/temporary-evidence-promotion-receipt/v1";
}>;

/**
 * temporary-operation-storeで使用するTemporary Operation 回復 Referenceの値契約を定義する。
 *
 * @responsibility Temporary Operation 回復 ReferenceのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape TemporaryOperationRecoveryReferenceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TemporaryOperationRecoveryReferenceで宣言した値と責務の対応を維持する。
 * @boundary N/A: TemporaryOperationRecoveryReferenceの宣言は外部境界を開かない。
 * @security N/A: TemporaryOperationRecoveryReferenceはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TemporaryOperationRecoveryReferenceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TemporaryOperationRecoveryReference = Readonly<{
  operationId: string;
  owner: string;
  identity: string;
  generation: number;
}>;
