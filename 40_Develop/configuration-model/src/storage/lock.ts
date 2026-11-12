/**
 * AI設定の既存wx Lock取得・通常解放を接続する。
 * @responsibility 構成モデル内部の固定設定保存だけを扱う。
 * @trace ARCH-000011
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { acquireLock } from "../../../lock/src/index.ts";
import {
  type ConfigurationStoreRoot,
  resolveConfigurationFile,
} from "./store.ts";

type ConfigurationLockResult<T> =
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
export function withConfigurationLock<T>(
  capability: ConfigurationStoreRoot,
  operation: () => T,
): ConfigurationLockResult<T> {
  const lockRelativePath = "ai-selection.lock";
  const lockFile = resolveConfigurationFile(capability, lockRelativePath);
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
