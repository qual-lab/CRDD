/**
 * Coordinatorの短期保存排他と実発行された保存Ownerを管理する。
 * @responsibility 同じRootの現在照合、wx保持、借用と解放を一つのOwnerへ結合する。
 * @trace ARCH-000004、ARCH-000008
 */

import {
  type Repository,
  getRepositoryFromWorkingDirectory,
} from "../../../version-control/src/index.ts";
import type { Lock, LockResult } from "../../../lock/src/index.ts";
import { acquireRuntimeStateLock } from "./runtime-kernel-lock.ts";
import {
  type observeRuntimeRecoveryRepository,
  observeRuntimeStorageRepository,
} from "./runtime-repository.ts";
import type { StoreResult } from "./runtime-result.ts";
import { blocked, completed } from "./runtime-result.ts";

/**
 * 同じ短期排他を読取りと保存確定で借用する私有Owner。
 * @responsibility 現在Repository結合とwx保持を一つの実発行値へ結合する。
 * @trace ARCH-000004、ARCH-000008
 * @shape Root、物理結合、生存照合、解放操作。
 * @invariant JSONや同じProperty値からOwnerを再構成しない。
 * @boundary storage内の取得済みOwner借用。Package公開APIではない。
 * @security このOwnerはProvider実行・Docker処置のAuthorityを持たない。
 * @compatibility CurrentStateのReader・Writerと同じwx Scopeを使う。
 */
export type CoordinatorStorageOwner = Readonly<{
  repositoryRoot: string;
  repositoryBinding: string;
  repositoryRootHash: string;
  assertLive: () => boolean;
  release: () => boolean;
}>;

const storageOwners = new WeakMap<
  object,
  Readonly<{
    repository: Pick<
      NonNullable<ReturnType<typeof observeRuntimeRecoveryRepository>>,
      "repositoryRoot" | "repositoryBinding" | "revalidate"
    >;
    lock: Lock;
  }>
>();

/**
 * 実発行した保存Ownerの内部結合だけを取得する。
 * @responsibility 私有Mapを外へ渡さず、保存処理の既存照合点へ同じ記録を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input owner: 既存保存Ownerの候補。
 * @returns 実発行記録、又はundefined。
 * @precondition 生存・Root再照合は呼出し側の既存検査点で行う。
 * @postcondition 値が等しいだけのObjectを受け入れない。
 * @effect N/A: 私有Mapの同期読取りだけ。
 * @failure 未発行・解放済みではundefined。
 * @invariant 記録の取得だけを現在保持や書込み許可としない。
 * @boundary 保存処理内の私有Owner参照。
 * @security 入力のPropertyやcallbackを評価しない。
 * @concurrency 取得・消費・解放の順序は変更しない。
 */
export function readCoordinatorStorageOwnerBinding(owner: object) {
  return storageOwners.get(owner);
}

/**
 * 検証済みRootの短期wx排他を取得する。
 * @responsibility 保存Ownerの実発行、同Root再観測と解放を保持する。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory: 選択Repository内の起動位置。
 * @returns 保持中Owner、又は取得失敗と回復参照を持つ結果。
 * @precondition 呼出し側が短期処理後の解放を所有する。
 * @postcondition Root・Git Identity・wx保持を結合し、保存領域を初期化しない。
 * @effect Repository読取りと共通wx Lock取得。
 * @failure Root不正・観測不能・競合を拒否し、初期化失敗とdescriptor終了不明を区別する。
 * @invariant 新しいLock、Registry、永続状態を作らない。
 * @boundary 既存Root検証と保存短期排他。
 * @security 任意HashやCaller supplied handleを受け付けない。
 * @concurrency このOwnerの内部借用ではLockを再取得しない。
 */
export function acquireCoordinatorStorageOwner(
  workingDirectory: string | Repository,
): StoreResult<CoordinatorStorageOwner> {
  const verified =
    typeof workingDirectory === "string"
      ? getRepositoryFromWorkingDirectory(workingDirectory)
      : null;
  const repository =
    typeof workingDirectory !== "string"
      ? observeRuntimeStorageRepository(workingDirectory)
      : verified?.status === "completed"
        ? observeRuntimeStorageRepository(verified.capability)
        : null;
  return repository
    ? acquireCoordinatorStorageOwnerForRepository(repository)
    : blocked("coordinator_state_owner_invalid");
}

/**
 * 検証済み内部Repository結合へ保存排他を実発行する。
 * @responsibility 通常Reader・Writerと借用Ownerの取得経路を共有する。
 * @trace ARCH-000004、ARCH-000008
 * @input repository: 既存Ownerから取得したRoot・結合・現在照合。
 * @returns 保持中Owner、又は取得失敗と回復参照を持つ結果。
 * @precondition 外部入力を直接渡さず内部の検証済み借用だけを使う。
 * @postcondition 同じwx Scopeと保持区間を維持する。
 * @effect 共通wx排他の取得とRoot読取り。
 * @failure 不正Root・競合と、新規残存・descriptor終了不明を区別する。
 * @invariant 新しいLock・永続Registry・保存資格を作らない。
 * @boundary 私有Repository結合と短期保存排他。
 * @security このOwnerだけでは候補の書込みを許可しない。
 * @concurrency 取得したOwnerの解放は呼出し側が所有する。
 */
export function acquireCoordinatorStorageOwnerForRepository(
  repository: Pick<
    NonNullable<ReturnType<typeof observeRuntimeRecoveryRepository>>,
    "repositoryRoot" | "repositoryBinding" | "revalidate"
  >,
): StoreResult<CoordinatorStorageOwner> {
  if (!repository) return blocked("coordinator_state_owner_invalid");
  const acquisition = acquireRuntimeStateLock(
    repository.repositoryBinding,
    repository.repositoryRoot,
  );
  if (acquisition.status !== "acquired") return storageLockFailure(acquisition);
  const lock = acquisition.lock;
  const owner: CoordinatorStorageOwner = Object.freeze({
    repositoryRoot: repository.repositoryRoot,
    repositoryBinding: repository.repositoryBinding,
    repositoryRootHash: repository.repositoryBinding,
    assertLive() {
      try {
        return (
          storageOwners.has(owner) &&
          repository.revalidate() &&
          lock.assertLive()
        );
      } catch {
        return false;
      }
    },
    release() {
      if (!storageOwners.delete(owner)) return false;
      try {
        return lock.release();
      } catch {
        return false;
      }
    },
  });
  storageOwners.set(owner, { repository, lock });
  return completed("coordinator_state_lock_acquired", owner);
}

/**
 * 借用Ownerの実発行・結合・現在保持を内部で照合する。
 * @responsibility 同値の偽造、解放済み、別Rootへの借用を拒否する。
 * @trace ARCH-000004、ARCH-000008
 * @input owner: 借用候補、repository: 呼出し先の検証済みRootと結合。
 * @returns 同じ実発行の内部結合、又はnull。
 * @precondition 値だけを生存根拠にしない。
 * @postcondition 入力側の関数を呼ばず真正な内部Ownerだけを照合する。
 * @effect 現在RepositoryとKernel保持の読取り。
 * @failure 不正値、別結合、Owner喪失はnull。
 * @invariant 借用だけで新しい資格やLockを発行しない。
 * @boundary 私有Ownerと保存処理。
 * @security 任意ObjectのGetterやcallbackを実行しない。
 * @concurrency 同じ保持中Kernelを再取得しない。
 */
export function borrowCoordinatorStorageOwner(
  owner: unknown,
  repository: Readonly<{ repositoryRoot: string; repositoryBinding: string }>,
) {
  if (!owner || typeof owner !== "object") return null;
  const binding = storageOwners.get(owner);
  try {
    return binding &&
      binding.repository.repositoryRoot === repository.repositoryRoot &&
      binding.repository.repositoryBinding === repository.repositoryBinding &&
      binding.repository.revalidate() &&
      binding.lock.assertLive()
      ? binding
      : null;
  } catch {
    return null;
  }
}

/**
 * 保存Ownerの実発行と現在保持を利用側へ確認する。
 * @responsibility 構造が同じだけの値と解放済みOwnerを拒否する。
 * @trace ARCH-000004、ARCH-000008
 * @input owner: 内部Owner候補。
 * @returns 真正かつ現在保持中だけtrue。
 * @precondition 値からOwnerを再構成しない。
 * @postcondition 入力のPropertyやcallbackを実行しない。
 * @effect 同じRootとKernel保持の読取り。
 * @failure 観測不能はfalse。
 * @invariant 新しい排他・保存資格を発行しない。
 * @boundary 保存Ownerと業務処理。
 * @security Owner自体は業務認可ではない。
 * @concurrency 同じ取得済み排他だけを確認する。
 */
export function isLiveCoordinatorStorageOwner(
  owner: unknown,
): owner is CoordinatorStorageOwner {
  const binding =
    owner && typeof owner === "object" ? storageOwners.get(owner) : null;
  return (
    !!binding && !!borrowCoordinatorStorageOwner(owner, binding.repository)
  );
}

/**
 * 検証済みRepositoryに結合した保存試行用排他を取得する。
 *
 * @responsibility 起動Directoryから同じRootのOS排他へ接続する。
 * @trace ARCH-000004
 * @input workingDirectory: 対象Repository内の起動Directory。
 * @returns 保持確認・解放handle、または停止結果。
 * @precondition WindowsのRepositoryとして一意に解決できる。
 * @postcondition native realpathが取れなければ文字列Pathへfallbackしない。
 * @effect Filesystemを読み、WorkerとOS排他を取得する。保存Fileは作らない。
 * @failure Root不正、観測不能、競合と取得確認不能では停止する。
 * @invariant 排他取得だけで保存・移行・旧Writer停止を主張しない。
 * @boundary Repository検証からWindows短期排他への境界。
 * @security 呼出し元から任意のRoot Hashを受け取らない。
 * @concurrency 同Rootのcase差と配下起動を同じ排他へ結合する。
 */
export function acquireCoordinatorSnapshotPilotLock(
  workingDirectory: string | Repository,
): StoreResult<CoordinatorSnapshotOwner> {
  const result = acquireCoordinatorStorageOwner(workingDirectory);
  return result.status === "completed"
    ? completed("orchestrator_snapshot_lock_acquired", result.value)
    : result.reason === "coordinator_state_lock_unavailable"
      ? blocked("orchestrator_snapshot_lock_unavailable", false)
      : result;
}

/**
 * 取得済み排他Ownerの値契約を定義する。
 * @responsibility 保存の内部処置へRoot結合と生存確認を渡す。
 * @trace ARCH-000004
 * @shape OS排他handle、repositoryRoot、repositoryRootHash。
 * @invariant 呼出し元指定のHashを取得済みOwnerとして扱わない。
 * @boundary 保存処置のProcess内境界。
 * @security JSONから構築せず検証済み取得結果だけを用いる。
 * @compatibility 既存の短期排他取得結果と同じ値契約。
 */
export type CoordinatorSnapshotOwner = CoordinatorStorageOwner;

/**
 * 借用する保存Ownerの実発行と生存を確認する。
 * @responsibility 値が同じだけの偽造handleを拒否する。
 * @trace ARCH-000004
 * @input owner: 未検証handle。
 * @returns 発行済みで現在保持中ならtrue。
 * @precondition 同じModuleの発行集合を用いる。
 * @postcondition 解放済みと偽造値を拒否する。
 * @effect Rootの読取りだけを行う。
 * @failure 観測不能はfalse。
 * @invariant JSONや構造的な型から排他を生成しない。
 * @boundary 保存Ownerと履歴借用入口。
 * @security Root以外の書込み許可を与えない。
 * @concurrency 取得・解放は呼出し側が所有する。
 */
export function isLiveCoordinatorSnapshotOwner(
  owner: unknown,
): owner is CoordinatorSnapshotOwner {
  return isLiveCoordinatorStorageOwner(owner);
}

/** 取得失敗を公開可能な固定理由と非Authority参照へ投影し、PathやRecordを返さない。 */
export function storageLockFailure<T>(result: LockResult): StoreResult<T> {
  if (result.status === "acquired")
    throw Error("storage_lock_failure_requires_blocked");
  const retained = result.reference !== null || !result.cleanupConfirmed;
  return blocked(
    !result.descriptorClosed
      ? "coordinator_state_lock_descriptor_close_unconfirmed"
      : result.reason === "lock_initialization_failed"
        ? "coordinator_state_lock_initialization_failed"
        : "coordinator_state_lock_unavailable",
    retained,
    result.reference
      ? `current-state-lock.${result.reference.generation}`
      : null,
  );
}
