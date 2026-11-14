/**
 * 実行履歴・記録退役の完成した保存・読取り操作を提供する。
 * @responsibility 共通保存処理へ接続し、既存の排他・改訂検査・通知順序を維持する。
 * @trace ARCH-000008
 */

import { randomUUID } from "node:crypto";
import type { Repository } from "../../../version-control/src/index.ts";
import { prepareDecisionRetirement } from "../decision/validation.ts";
import {
  observeSnapshotObligations,
  withSnapshotOperation,
} from "../state/crud.ts";
import {
  encodeStateValue,
  PROJECT_SNAPSHOT_SCHEMA,
} from "../state/validation.ts";
import type { HistoryRepositoryInput, StoreResult } from "../storage/lock.ts";
import { blocked, completed } from "../storage/lock.ts";
import {
  inspectDecisionHistorySettlement,
  inspectHistorySettlement,
  updateHistoryOwned,
} from "../storage/store.ts";
import type { HistoryRow } from "./types.ts";
import {
  prepareHistoryPending,
  prepareHistoryTransfer,
  prepareTerminalRecordRetirement,
} from "./validation.ts";

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
export function retireStateRecords(
  workingDirectory: Repository | HistoryRepositoryInput,
  binding: string,
  now = Date.now(),
): StoreResult<number> {
  const prepared = withSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) =>
      prepareHistoryPending(current, now, {
        obligations: () => observeSnapshotObligations(owner),
      }),
    "history",
  );
  if (prepared.status !== "completed") return prepared;
  return withSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      if (current.schema !== PROJECT_SNAPSHOT_SCHEMA)
        return blocked("orchestrator_snapshot_schema_invalid");
      const trimmed = updateHistoryOwned(
        owner,
        current.historyPending.length
          ? encodeStateValue(current.historyPending)
          : null,
        now,
      );
      if (trimmed.status !== "completed") return blocked(trimmed.reason, true);

      const terminal = prepareTerminalRecordRetirement(current, {
        obligations: () => observeSnapshotObligations(owner),
        historySettlement: (row: HistoryRow) =>
          inspectHistorySettlement(owner, row, now),
        nextEpoch: () => `epoch-${randomUUID()}`,
      });
      if (terminal.status !== "completed") return terminal;
      const decisions = prepareDecisionRetirement(
        terminal.value.next ?? current,
        (decision) => inspectDecisionHistorySettlement(owner, decision),
      );
      if (decisions.status !== "completed") return decisions;
      return completed(terminal.reason, {
        next: decisions.value.next ?? terminal.value.next,
        value: terminal.value.value + decisions.value.value,
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
export function transferHistory(
  workingDirectory: Repository | HistoryRepositoryInput,
  binding: string,
  now = Date.now(),
): StoreResult<Readonly<{ recorded: number; expired: number }>> {
  return withSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      if (current.historyPending.length) {
        const saved = updateHistoryOwned(
          owner,
          encodeStateValue(current.historyPending),
          now,
        );
        if (saved.status !== "completed") return blocked(saved.reason, true);
      }
      return prepareHistoryTransfer(current, {
        historySettlement: (row: HistoryRow) =>
          inspectHistorySettlement(owner, row, now),
      });
    },
    "history",
  );
}
