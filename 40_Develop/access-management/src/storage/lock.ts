/**
 * 管理状態操作の排他取得・exact回収・解放結果を所有する。
 * @packageDocumentation
 * @responsibility 保存処理の内容を知らず、既存Lockと内部結果の相関を維持する。
 * @trace ARCH-000013
 */
import {
  type FilesystemStoreRoot,
  observeFilesystemStoreLockOwnerAbsence,
  recoverFilesystemStoreLock,
  withFilesystemStoreLock,
} from "../../../domain-model/src/index.ts";
import type { StateStoreResult } from "./types.ts";

const LOCK = "access-management.lock";

/**
 * 既存Lockのexact回収と結果を保存Ownerへ閉じる。
 * @responsibility 新排他を作らず、既知出版とLock解放不明を別に保持する。
 * @trace ARCH-000013
 * @input Rootと同期保存処理。
 * @returns 内部StateStoreResult。
 * @precondition 同じ用途限定Rootと既存排他を使用する内部保存Ownerだけが呼び出す。
 * @postcondition 確認した事実だけを返し、観測不能を成功へ変換しない。
 * @effect 既存Lock取得・必要時exact回収・解放。
 * @failure 競合・Owner存在・観測不能・解放不明は未完了。
 * @invariant 回収は同じIDと既存Owner不存在Proofだけ。
 * @boundary 保存OwnerとDomain排他。
 * @security Snapshot・Verifier・salt・内部Pathを外部応答や例外本文へ出さない。
 * @concurrency 再入場は一回だけ、無限再試行なし。
 */
export function locked<T>(
  root: FilesystemStoreRoot,
  operation: () => StateStoreResult<T>,
): StateStoreResult<T> {
  let observed: StateStoreResult<T> = {
    status: "unavailable",
    reason: "state_store_observation_unknown",
    publication: "not_attempted",
    revision: null,
    cleanupConfirmed: false,
  };
  try {
    const execute = () => {
      observed = operation();
      return observed;
    };
    let lock = withFilesystemStoreLock(root, LOCK, execute);
    if (
      !lock.acquired &&
      lock.reason === "filesystem_store_lock_recovery_required"
    ) {
      const absence = observeFilesystemStoreLockOwnerAbsence(
        root,
        LOCK,
        lock.recoveryId,
      );
      if (
        absence.status === "confirmed" &&
        recoverFilesystemStoreLock(root, LOCK, absence.proof).status ===
          "completed"
      )
        lock = withFilesystemStoreLock(root, LOCK, execute);
    }
    if (!lock.acquired)
      return {
        status: "unavailable",
        reason: lock.reason,
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
        ...("recoveryId" in lock ? { lockRecoveryId: lock.recoveryId } : {}),
      };
    if (!lock.cleanupConfirmed)
      return {
        status: "unavailable",
        reason:
          observed.status === "unavailable" ? observed.reason : lock.reason,
        publication: observed.publication,
        revision: observed.revision,
        cleanupConfirmed: false,
        lockRecoveryId: lock.recoveryId,
        ...(observed.status === "unavailable"
          ? { secondaryReason: lock.reason }
          : {}),
      };
    return observed;
  } catch {
    const latest = observed as StateStoreResult<T>;
    return latest.status === "unavailable"
      ? { ...latest, cleanupConfirmed: false }
      : {
          status: "unavailable",
          reason: "state_store_lock_unknown",
          publication: latest.publication,
          revision: latest.revision,
          cleanupConfirmed: false,
        };
  }
}
