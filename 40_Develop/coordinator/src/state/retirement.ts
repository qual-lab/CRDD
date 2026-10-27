/**
 * 終了記録を履歴へ移し、現在状態から退役させる。
 * @responsibility 履歴確定と受付世代切替を調整し、未解決状態を保全する。
 * @trace ARCH-000004、ARCH-000008
 */

import {
  maintainCoordinatorSnapshotRecords,
  transferCoordinatorSnapshotHistoryRecords,
} from "../../../domain-model/src/index.ts";
import { verifyRuntimePersistenceRepository } from "../execution/persistence.ts";
import type { StoreResult } from "./result.ts";

/**
 * 終了要約を履歴へ移して現在記録を退役する。
 * @responsibility 履歴の確定後だけ閉じたQueueを除去し、同じ保存で受付世代を切り替える。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Repository、結合と固定評価時刻。
 * @returns 元の候補結果を保存・解放確認後に返す。
 * @precondition 操作認可は呼出し側が現在確認している。
 * @postcondition 未知・元参照・候補外区画を保つ。
 * @effect 既存の読取りと必要な候補保存だけ。
 * @failure 競合・観測不能・例外・解放不明は元の停止へ返す。
 * @invariant 生Owner・任意Snapshot callbackを公開しない。
 * @boundary 固定操作と唯一の短期保存Owner。
 * @security 観測関数を保存又は登録しない。
 * @concurrency 実行側の物理処置へ短期Lockを持ち越さない。
 */

export function maintainCoordinatorSnapshot(
  workingDirectory: string,
  binding: string,
  now = Date.now(),
): StoreResult<number> {
  return maintainCoordinatorSnapshotRecords(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    now,
  );
}

/**
 * 未搬送の終了要約を同じOwnerで履歴へ搬送する。
 * @responsibility 物理履歴と元行を確認できた要約だけを現在状態から除く。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Repository、結合と固定評価時刻。
 * @returns 元の候補結果を保存・解放確認後に返す。
 * @precondition 操作認可は呼出し側が現在確認している。
 * @postcondition 未知・元参照・候補外区画を保つ。
 * @effect 既存の読取りと必要な候補保存だけ。
 * @failure 競合・観測不能・例外・解放不明は元の停止へ返す。
 * @invariant 生Owner・任意Snapshot callbackを公開しない。
 * @boundary 固定操作と唯一の短期保存Owner。
 * @security 観測関数を保存又は登録しない。
 * @concurrency 実行側の物理処置へ短期Lockを持ち越さない。
 */

export function transferCoordinatorSnapshotHistory(
  workingDirectory: string,
  binding: string,
  now = Date.now(),
): StoreResult<Readonly<{ recorded: number; expired: number }>> {
  return transferCoordinatorSnapshotHistoryRecords(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    now,
  );
}
