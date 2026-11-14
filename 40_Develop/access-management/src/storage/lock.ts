/**
 * 管理状態操作の排他取得・解放結果を所有する。残存を自動回復しない。
 * @packageDocumentation
 * @responsibility 保存処理の内容を知らず、既存Lockと内部結果の相関を維持する。
 * @trace ARCH-000013
 */
import {
  type FilesystemStoreRoot,
  resolveFilesystemStorePath,
} from "../initialization/root.ts";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { acquireLock } from "../../../lock/src/index.ts";
import type { StateStoreResult } from "./types.ts";

const LOCK = "access-management.state.lock";

/**
 * 共通wx Lockの取得結果を保存Ownerへ閉じる。
 * @responsibility 新排他を作らず、既知出版とLock解放不明を別に保持する。
 * @trace ARCH-000013
 * @input Rootと同期保存処理。
 * @returns 内部StateStoreResult。
 * @precondition 同じ用途限定Rootと既存排他を使用する内部保存Ownerだけが呼び出す。
 * @postcondition 確認した事実だけを返し、観測不能を成功へ変換しない。
 * @effect 共通wx Lockの取得と同世代解放。残存の回収や再取得はしない。
 * @failure 競合・Owner存在・観測不能・解放不明は未完了。
 * @invariant EEXIST・不明は停止し、PID不存在を回復許可にしない。
 * @boundary 保存OwnerとDomain排他。
 * @security Snapshot・Verifier・salt・内部Pathを外部応答や例外本文へ出さない。
 * @concurrency 全利用Process停止下の明示Recoveryは通常保存から分離する。
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
    const lock = withFilesystemStoreLock(root, LOCK, execute);
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

type FilesystemStoreLockResult<T> =
  | Readonly<{
      acquired: false;
      reason:
        | "filesystem_store_lock_exists"
        | "filesystem_store_lock_observation_unknown";
    }>
  | Readonly<{
      acquired: false;
      reason: "filesystem_store_lock_recovery_required";
      recoveryId: string;
    }>
  | Readonly<{ acquired: true; cleanupConfirmed: true; value: T }>
  | Readonly<{
      acquired: true;
      cleanupConfirmed: false;
      operationCompleted: true;
      reason: "filesystem_store_lock_operation_completed_cleanup_unknown";
      recoveryId: string;
      value: T;
    }>
  | Readonly<{
      acquired: true;
      cleanupConfirmed: false;
      operationCompleted: false;
      reason: "filesystem_store_lock_operation_failed_cleanup_unknown";
      recoveryId: string;
      error: unknown;
    }>;

/**
 * 同じRoot内の取得・同期操作・同世代解放を共通wx実装へ接続する。
 * @effect Lock File作成・通常解放とoperationのEffect。残存削除・PID照会はしない。
 * @failure 未取得ではoperationを呼ばず、解放不明は元の操作結果と別に返す。
 * @concurrency Reader・Writer・清掃は同じLockへ参加し、Recoveryは全利用Process停止下だけ。
 */
export function withFilesystemStoreLock<T>(
  capability: FilesystemStoreRoot,
  lockRelativePath: string,
  operation: () => T,
): FilesystemStoreLockResult<T> {
  const lockFile = resolveFilesystemStorePath(capability, lockRelativePath);
  // 旧清掃義務は読取り拒否だけに使い、自動変換・自動回収しない。
  try {
    fs.lstatSync(`${lockFile}.recovery-obligation`);
    return Object.freeze({
      acquired: false,
      reason: "filesystem_store_lock_observation_unknown",
    });
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "ENOENT"
    )
      return Object.freeze({
        acquired: false,
        reason: "filesystem_store_lock_observation_unknown",
      });
  }
  const identity = createHash("sha256")
    .update("crdd-filesystem-store-lock-v2\0")
    .update(capability.root)
    .update("\0")
    .update(lockRelativePath)
    .digest("hex");
  const acquired = acquireLock({
    directory: path.dirname(lockFile),
    name: path.basename(lockFile),
    identity: `filesystem-store:${identity}`,
  });
  if (acquired.status !== "acquired") {
    if (acquired.reference)
      return Object.freeze({
        acquired: false,
        reason: "filesystem_store_lock_recovery_required",
        recoveryId: `filesystem-store-lock.${acquired.reference.generation}`,
      });
    return Object.freeze({
      acquired: false,
      reason:
        acquired.reason === "lock_exists"
          ? "filesystem_store_lock_exists"
          : "filesystem_store_lock_observation_unknown",
    });
  }
  let outcome:
    | Readonly<{ status: "completed"; value: T }>
    | Readonly<{ status: "failed"; error: unknown }>;
  try {
    outcome = { status: "completed", value: operation() };
  } catch (error) {
    outcome = { status: "failed", error };
  }
  const cleanupConfirmed = acquired.lock.release();
  if (!cleanupConfirmed) {
    const recoveryId = `filesystem-store-lock.${acquired.lock.reference.generation}`;
    return outcome.status === "completed"
      ? Object.freeze({
          acquired: true,
          cleanupConfirmed: false as const,
          operationCompleted: true as const,
          reason: "filesystem_store_lock_operation_completed_cleanup_unknown",
          recoveryId,
          value: outcome.value,
        })
      : Object.freeze({
          acquired: true,
          cleanupConfirmed: false as const,
          operationCompleted: false as const,
          reason: "filesystem_store_lock_operation_failed_cleanup_unknown",
          recoveryId,
          error: outcome.error,
        });
  }
  if (outcome.status === "failed") throw outcome.error;
  return Object.freeze({
    acquired: true,
    cleanupConfirmed: true as const,
    value: outcome.value,
  });
}
