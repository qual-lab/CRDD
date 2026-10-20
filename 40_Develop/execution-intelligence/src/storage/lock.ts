/**
 * 履歴更新の既存排他と不存在／観測不能の区別を所有する。
 * @responsibility 履歴更新の既存排他と不存在／観測不能の区別を所有する。
 * @trace ARCH-000007
 */
import fs from "node:fs";
import { randomUUID } from "node:crypto";

import { MutationBoundaryError } from "./result.ts";

export const LOCK_ATTEMPTS = 200;

export const LOCK_RETRY_MS = 10;

export const waitArray = new Int32Array(new SharedArrayBuffer(4));

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

/**
 * execution-intelligence-storeで使用するMutation Lockの値契約を定義する。
 *
 * @responsibility Mutation LockのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape MutationLockが表すProperty、識別子およびRelationを型として固定する。
 * @invariant MutationLockで宣言した値と責務の対応を維持する。
 * @boundary N/A: MutationLockの宣言は外部境界を開かない。
 * @security N/A: MutationLockはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility MutationLockの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type MutationLock = Readonly<{
  owner: string;
  identity: string;
}>;

/**
 * Mutation Lockを取得する。
 *
 * @responsibility Mutation Lockの取得条件、所有権、失敗時の非取得境界を所有する。
 * @trace ARCH-000007
 * @input layout: Readonly<{lock: string}>
 * @returns MutationLock | nullを返す。
 * @precondition 「layout: Readonly<{lock: string}>」がacquireMutationLockの入力契約を満たす。
 * @postcondition acquireMutationLockの責務を完了した結果だけを返す。
 * @effect acquireMutationLockはFilesystemの読取りまたは書込みを実行する。
 * @failure acquireMutationLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant acquireMutationLockは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: acquireMutationLockはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency Root全体のhistory.lockをwxで排他的に取得し、未所有Lockを自動奪取しない。
 */
export function acquireMutationLock(
  layout: Readonly<{ lock: string }>,
): MutationLock | null {
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
    let descriptor: number;
    try {
      descriptor = fs.openSync(layout.lock, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      Atomics.wait(waitArray, 0, 0, LOCK_RETRY_MS);
      continue;
    }
    const identity = randomUUID();
    try {
      try {
        fs.writeFileSync(
          descriptor,
          `${JSON.stringify({
            contract: "crdd/execution-store-lock/v2",
            identity,
          })}\n`,
          "utf8",
        );
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      return Object.freeze({ owner: layout.lock, identity });
    } catch {
      let isCleanupConfirmed = false;
      try {
        fs.unlinkSync(layout.lock);
        isCleanupConfirmed = !entryExists(layout.lock);
      } catch {
        isCleanupConfirmed = false;
      }
      throw new MutationBoundaryError(
        "execution_store_lock_initialization_failed",
        isCleanupConfirmed ? [] : ["history.lock"],
      );
    }
  }
  return null;
}

/**
 * Mutation Lockを解放する。
 *
 * @responsibility Mutation Lockの所有権、解放条件、終了後不存在の確認境界を所有する。
 * @trace ARCH-000007
 * @input lock: MutationLock
 * @returns booleanを返す。
 * @precondition 「lock: MutationLock」がreleaseMutationLockの入力契約を満たす。
 * @postcondition releaseMutationLockの責務を完了した結果だけを返す。
 * @effect releaseMutationLockはFilesystemの読取りまたは書込みを実行する。
 * @failure releaseMutationLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant releaseMutationLockは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: releaseMutationLockはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency exactな所有Identityが一致するLockだけを解放する。
 */
export function releaseMutationLock(lock: MutationLock): boolean {
  try {
    const status = fs.lstatSync(lock.owner);
    if (!status.isFile() || status.isSymbolicLink() || status.nlink !== 1)
      return false;
    const parsed = JSON.parse(fs.readFileSync(lock.owner, "utf8")) as {
      identity?: unknown;
      contract?: unknown;
    };
    if (
      parsed.contract !== "crdd/execution-store-lock/v2" ||
      parsed.identity !== lock.identity
    )
      return false;
    fs.unlinkSync(lock.owner);
    return !entryExists(lock.owner);
  } catch {
    return false;
  }
}
