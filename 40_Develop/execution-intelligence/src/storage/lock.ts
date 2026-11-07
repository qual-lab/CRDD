/**
 * EIの保持区間と結果分類を共通wx排他へ接続する。
 * @responsibility pending・保存・回復判断はStoreに残し、取得と解放は共通Lockへ委譲する。
 * @trace ARCH-000007
 */
import fs from "node:fs";
import path from "node:path";
import { acquireLock, type Lock } from "../../../lock/src/index.ts";
import { MutationBoundaryError } from "./result.ts";

/**
 * 不存在と観測不能を区別してDirectory Entryを観測する。
 * @responsibility ENOENTだけを不存在とし、権限不足やI/O障害を空状態へ畳まない。
 * @trace ARCH-000007
 * @input target: 検証済みRoot内の固定Path。
 * @returns 観測した存在の真偽。
 * @precondition 呼出し側がRootとPathの境界を検証済みである。
 * @postcondition 不明をfalseへ補完しない。
 * @effect Filesystem metadataを読み取る。書込みEffectは0。
 * @failure ENOENT以外の観測障害を呼出し側へ伝播する。
 * @invariant broken linkも存在として検査側へ渡す。
 * @boundary StoreとFilesystem metadataの境界。
 * @security 任意Pathを公開入力から受け取らない。
 * @concurrency 原子的なlstat一回の観測だけを表し将来の不存在を保証しない。
 */
export function entryExists(target: string): boolean {
  try {
    fs.lstatSync(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

/** history.lockを一度取得する。残存を待機・削除・自動奪取しない。 */
export function acquireMutationLock(
  layout: Readonly<{ lock: string }>,
): Lock | null {
  const result = acquireLock({
    directory: path.dirname(layout.lock),
    name: path.basename(layout.lock),
    identity: "execution-intelligence:history",
  });
  if (result.status === "acquired") return result.lock;
  if (result.reason === "lock_exists") return null;
  throw new MutationBoundaryError(
    result.reason === "lock_initialization_failed"
      ? "execution_store_lock_initialization_failed"
      : "execution_store_lock_unavailable",
    result.cleanupConfirmed ? [] : ["history.lock"],
  );
}
