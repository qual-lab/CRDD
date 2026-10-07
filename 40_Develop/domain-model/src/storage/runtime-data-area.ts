/**
 * 宣言済みRepository Runtime領域の作成。
 *
 * @responsibility 保存Ownerが許可した用途のDirectory作成とRepository-local Ignore登録を所有する。
 * @trace ARCH-000011
 */
import fs from "node:fs";
import { gitRepositoryLocalIgnoreAdapter } from "../../../version-control/src/git/repository-local-ignore-adapter.ts";
import {
  registerRepositoryLocalIgnore,
  type RepositoryLocalIgnoreAdapter,
} from "../../../version-control/src/repository-local-ignore.ts";
import {
  verifyRepositoryRootFromWorkingDirectory,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/repository-identity/index.ts";
import {
  REPOSITORY_AREAS,
  AREA_PATH_KEYS,
} from "../configuration/runtime-data-paths.ts";
import {
  resolveRepositoryRuntimeDataPathsForInternalUse,
  observeRepositoryRuntimeDataArea,
} from "../repository/runtime-data-path-resolver.ts";
import type { RepositoryRuntimeArea } from "../repository/types.ts";

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
 * 最新Coordinator領域を既存領域の再利用なしに新規作成する。
 * @responsibility Runtime Data Ownerで親境界と排他的mkdirの新規作成事実を結合する。
 * @trace ARCH-000011
 * @input capability: 検証済みRepository Root。
 * @returns 新規領域の境界観測とEffect情報、または停止。
 * @precondition Repository-localの.crdd親が既に正規配置で存在する。
 * @postcondition 既存ready領域を新品として返さない。
 * @effect 固定coordinator領域だけを排他的に作成する。
 * @failure 既存領域、alias、親置換、観測不能では停止し、自動削除しない。
 * @invariant 空観測やensureによる再利用を初期化証拠にしない。
 * @boundary Runtime Dataの領域作成からCoordinator初期化Owner。
 * @security 任意Path、旧保存形式や操作Authorityを受理しない。
 * @concurrency 呼出し側のCoordinator排他に加え、mkdirのEEXISTで競合作成を拒否する。
 */
export function createCoordinatorRuntimeDataArea(
  capability: VerifiedRepositoryRoot,
) {
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
    if (
      observeRepositoryRuntimeDataArea(capability, "coordinator").status !==
      "not_observed"
    )
      throw new Error("existing");
    const before = fs.lstatSync(paths.root, { bigint: true });
    if (root.dev !== before.dev || root.ino !== before.ino)
      throw new Error("parent_changed");
    effectIssued = true;
    fs.mkdirSync(paths.coordinator, { mode: 0o700 });
    const after = fs.lstatSync(paths.root, { bigint: true });
    const observation = observeRepositoryRuntimeDataArea(
      capability,
      "coordinator",
    );
    if (
      root.dev !== after.dev ||
      root.ino !== after.ino ||
      observation.status !== "ready" ||
      fs.readdirSync(paths.coordinator).length !== 0
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
 * Creates or verifies one declared repository-local area. Consumers receive
 *
 * @responsibility Repository Runtime Data Areaの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000011
 * @input capability: VerifiedRepositoryRoot、area: RepositoryRuntimeArea
 * @returns ensureRepositoryRuntimeDataAreaの計算結果を返す。
 * @precondition 「capability: VerifiedRepositoryRoot、area: RepositoryRuntimeArea」がensureRepositoryRuntimeDataAreaの入力契約を満たす。
 * @postcondition ensureRepositoryRuntimeDataAreaの責務を完了した結果だけを返す。
 * @effect N/A: ensureRepositoryRuntimeDataAreaは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ensureRepositoryRuntimeDataAreaは独自の失敗分岐を所有しない。
 * @invariant ensureRepositoryRuntimeDataAreaは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ensureRepositoryRuntimeDataAreaはProcess内の同一Subsystemで完結する。
 * @security ensureRepositoryRuntimeDataAreaはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ensureRepositoryRuntimeDataAreaは共有非同期状態を持たない同期処理である。
 */
export function ensureRepositoryRuntimeDataArea(
  capability: VerifiedRepositoryRoot,
  area: RepositoryRuntimeArea,
) {
  return ensureRepositoryRuntimeDataAreaWithAdapter(
    capability,
    area,
    gitRepositoryLocalIgnoreAdapter,
  );
}

/**
 * Internal test seam for exact Ignore lifecycle failure injection.
 *
 * @responsibility Repository Runtime Data Area With Adapterの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000011
 * @input capability: VerifiedRepositoryRoot、area: RepositoryRuntimeArea、ignoreAdapter: RepositoryLocalIgnoreAdapter
 * @returns ensureRepositoryRuntimeDataAreaWithAdapterの計算結果を返す。
 * @precondition 「capability: VerifiedRepositoryRoot、area: RepositoryRuntimeArea、ignoreAdapter: RepositoryLocalIgnoreAdapter」がensureRepositoryRuntimeDataAreaWithAdapterの入力契約を満たす。
 * @postcondition ensureRepositoryRuntimeDataAreaWithAdapterの責務を完了した結果だけを返す。
 * @effect N/A: ensureRepositoryRuntimeDataAreaWithAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ensureRepositoryRuntimeDataAreaWithAdapterは独自の失敗分岐を所有しない。
 * @invariant ensureRepositoryRuntimeDataAreaWithAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ensureRepositoryRuntimeDataAreaWithAdapterはProcess内の同一Subsystemで完結する。
 * @security ensureRepositoryRuntimeDataAreaWithAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ensureRepositoryRuntimeDataAreaWithAdapterは共有非同期状態を持たない同期処理である。
 */
export function ensureRepositoryRuntimeDataAreaWithAdapter(
  capability: VerifiedRepositoryRoot,
  area: RepositoryRuntimeArea,
  ignoreAdapter: RepositoryLocalIgnoreAdapter,
) {
  const paths = resolveRepositoryRuntimeDataPathsForInternalUse(capability);
  if (!paths || !REPOSITORY_AREAS.includes(area)) return null;
  const ignore = registerRepositoryLocalIgnore(
    capability,
    ".crdd/",
    ignoreAdapter,
  );
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
  const verified = verifyRepositoryRootFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? ensureRepositoryRuntimeDataArea(verified.capability, area)
    : null;
}
