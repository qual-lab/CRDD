/**
 * 終了記録を履歴へ移し、現在状態から退役させる。
 * @responsibility 履歴確定と受付世代切替を調整し、未解決状態を保全する。
 * @trace ARCH-000004、ARCH-000008
 */
import {
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  type HistoryRow,
} from "../../../domain-model/src/index.ts";
import { encodeRuntimeStateValue } from "../../../domain-model/src/index.ts";
import type { StoreResult } from "./result.ts";
import { observeCoordinatorSnapshotObligations } from "../storage/state.ts";
import { blocked } from "./result.ts";
import { withCoordinatorSnapshotOperation } from "../storage/state.ts";
import {
  prepareCoordinatorHistoryPending,
  prepareCoordinatorTerminalRecordRetirement,
  prepareCoordinatorHistoryTransfer,
} from "../../../domain-model/src/index.ts";

import { randomUUID } from "node:crypto";

import { inspectCoordinatorHistorySettlement } from "../storage/history.ts";
import { updateCoordinatorHistoryOwned } from "../storage/history.ts";

/**
 * 終了要約の生成、履歴確定、受付世代切替を接続する。
 * @responsibility 閉じたQueueと専属の終了証拠を現在状態から退役する。
 * @trace ARCH-000004
 * @input Repository Root、binding、評価時刻。
 * @returns 退役件数または保全停止。
 * @precondition 本番の終了処置後に呼ぶ。Queryからは呼ばない。
 * @postcondition 履歴確定後だけQueueを除き、同じ保存で受付世代を切り替える。
 * @effect 固定history.jsonlとstate.jsonを保存する。
 * @failure 保存失敗時は同じ終了時刻の要約を再送可能に保持する。
 * @invariant 最新Project、結果、受入判断、候補、保護Authorityは保持する。
 * @boundary 終了処置から現在状態と30日履歴。
 * @security 未解決状態を期間だけで退役しない。
 * @concurrency 各段階を同Rootの短期Ownerで直列化する。
 */
export function maintainCoordinatorSnapshot(
  workingDirectory: string,
  binding: string,
  now = Date.now(),
): StoreResult<number> {
  const prepared = withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) =>
      prepareCoordinatorHistoryPending(current, now, {
        obligations: () => observeCoordinatorSnapshotObligations(owner),
      }),
    "history",
  );
  if (prepared.status !== "completed") return prepared;
  return withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      if (current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA)
        return blocked("orchestrator_snapshot_schema_invalid");
      const trimmed = updateCoordinatorHistoryOwned(
        owner,
        current.historyPending.length
          ? encodeRuntimeStateValue(current.historyPending)
          : null,
        now,
      );
      if (trimmed.status !== "completed") return blocked(trimmed.reason, true);

      return prepareCoordinatorTerminalRecordRetirement(current, {
        obligations: () => observeCoordinatorSnapshotObligations(owner),
        historySettlement: (row: HistoryRow) =>
          inspectCoordinatorHistorySettlement(owner, row, now),
        nextEpoch: () => `epoch-${randomUUID()}`,
      });
    },
    "history",
  );
}

/**
 * 未搬送の終了要約を同じOwnerで履歴へ搬送する。
 * @responsibility 履歴確定と現在値からの除去を別の確定として接続する。
 * @trace ARCH-000004
 * @input workingDirectory、binding、固定する評価時刻。
 * @returns 保存済みと期限処置の件数、または保全停止。
 * @precondition 検証済みSnapshotの終了要約だけを扱う。
 * @postcondition 履歴を確認できた要約だけを現在値から除去する。
 * @effect 履歴と現在状態の固定pendingを順に保存する。
 * @failure 履歴失敗では現在値を保持し、現在値保存失敗では再送可能な要約を保持する。
 * @invariant Queue、Project、回復義務、候補本体を除去しない。
 * @boundary 現在状態と30日保持の履歴。
 * @security 期限超過を未解決状態の削除へ広げない。
 * @concurrency 同じ実発行Ownerを借用し自己再取得しない。
 */
export function transferCoordinatorSnapshotHistory(
  workingDirectory: string,
  binding: string,
  now = Date.now(),
): StoreResult<Readonly<{ recorded: number; expired: number }>> {
  return withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      if (current.historyPending.length) {
        const saved = updateCoordinatorHistoryOwned(
          owner,
          encodeRuntimeStateValue(current.historyPending),
          now,
        );
        if (saved.status !== "completed") return blocked(saved.reason, true);
      }
      return prepareCoordinatorHistoryTransfer(current, {
        historySettlement: (row: HistoryRow) =>
          inspectCoordinatorHistorySettlement(owner, row, now),
      });
    },
    "history",
  );
}
