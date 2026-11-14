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
import { PROJECT_SNAPSHOT_SCHEMA } from "../state/validation.ts";
import { encodeStateValue } from "../state/operations.ts";
import type { HistoryRepositoryInput, StoreResult } from "../storage/lock.ts";
import { blocked, completed } from "../storage/lock.ts";
import {
  publishRecoveryState,
  writeStateSnapshot,
} from "../storage/publication.ts";
import type { StorageRepository } from "../storage/store.ts";
import {
  inspectDecisionHistorySettlement,
  inspectHistorySettlement,
  readStateSnapshot,
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

/**
 * 対象の終了要約固定から履歴確定までを一つの保存操作として実行する。
 * @responsibility 保存段階とfresh確認をHistory内に閉じ、元対象・Ownerを維持する。
 * @trace ARCH-000008
 * @input repository、recoveryId、assertOwner、operationKind: 元保存Ownerとexact対象。
 * @returns 履歴確認、最終Snapshot確認、Lock解放、累積Effectを区別した結果。
 * @precondition docker_task又はruntime_repairの終端条件が既存Readerで成立する。
 * @postcondition 最大二回の保存と最終fresh読取りが揃うまで履歴確認済みにしない。
 * @effect 既存のRepository-local現在状態と履歴だけ。
 * @failure 段階不変・別対象・保存/読取り/排他不明では次段へ進まず保全する。
 * @invariant 保持判断、Task配送、Operation除去、Host処置は実施しない。
 * @boundary 完成した履歴保存と私有Reader/Writer。
 * @security 任意Path・候補・時刻や用途間fallbackを受け付けない。
 * @concurrency 各段で同じ現在Ownerを確認し、既存短期Lockと単一Writerを使う。
 */
export function saveRecoveryHistory(
  repository: StorageRepository & { operationId: string },
  recoveryId: string,
  assertOwner: () => boolean,
  operationKind: "docker_task" | "runtime_repair",
) {
  let filesystemEffectIssued: boolean | null = false;
  let writing = false;
  let lockReleased = true;
  const refused = () =>
    Object.freeze({
      ...writeStateSnapshot(null, null, null, null),
      historyConfirmed: false,
      filesystemEffectIssued,
      lockReleased,
    });
  if (operationKind !== "docker_task" && operationKind !== "runtime_repair")
    return refused();
  let nextStage: "publish" | "confirmed" | null = null;
  let identityJson: string | null = null;
  try {
    for (let step = 0; step <= 2; step++) {
      if (typeof assertOwner !== "function" || assertOwner() !== true)
        return refused();
      lockReleased = false;
      const observed = readStateSnapshot(
        repository,
        recoveryId,
        null,
        recoveryId,
        null,
        operationKind,
      );
      lockReleased = observed.lockReleased;
      const publication = observed.currentHistoryPublication;
      const operation = observed.value?.snapshot.operations.find(
        (item) => item.kind === operationKind && item.recoveryId === recoveryId,
      );
      if (
        observed.status !== "completed" ||
        !observed.value ||
        !observed.lockReleased ||
        !publication ||
        !operation ||
        assertOwner() !== true
      )
        return Object.freeze({
          ...refused(),
          reason: observed.reason,
          lockReleased: observed.lockReleased,
        });
      if (
        publication.operationKind !== operationKind ||
        (nextStage !== null && publication.stage !== nextStage) ||
        (identityJson !== null && operation.identityJson !== identityJson)
      )
        return refused();
      identityJson = operation.identityJson;
      if (!publication.needsWrite) {
        if (
          publication.stage !== "confirmed" ||
          operation.history?.confirmed !== true
        )
          return refused();
        return Object.freeze({
          status: "completed" as const,
          reason: "coordinator_state_snapshot_confirmed",
          revision: observed.value.snapshot.revision,
          payloadSha256: observed.value.payloadSha256,
          snapshotConfirmed: true,
          lockReleased: true,
          filesystemEffectIssued,
          historyConfirmed: true,
        });
      }
      if (step === 2 || publication.stage === "confirmed") return refused();
      writing = true;
      lockReleased = false;
      const saved = publishRecoveryState({
        kind: "current_history" as const,
        operationKind: publication.operationKind,
        repository,
        recoveryId,
        before: Buffer.from(publication.before),
        candidate: Buffer.from(publication.candidate),
        stage: publication.stage,
        historyFile:
          publication.historyFile === null
            ? null
            : {
                bytes: Buffer.from(publication.historyFile.bytes),
                identity: publication.historyFile.identity,
              },
        pendingHistoryFile:
          publication.pendingHistoryFile === null
            ? null
            : {
                bytes: Buffer.from(publication.pendingHistoryFile.bytes),
                identity: publication.pendingHistoryFile.identity,
              },
        retentionDays: publication.retentionDays,
        assertOwner,
      });
      writing = false;
      lockReleased = saved.lockReleased;
      if (saved.filesystemEffectIssued) filesystemEffectIssued = true;
      if (
        saved.status !== "completed" ||
        !saved.snapshotConfirmed ||
        !saved.lockReleased
      )
        return Object.freeze({
          ...saved,
          filesystemEffectIssued,
          historyConfirmed: false,
        });
      nextStage = publication.stage === "checkpoint" ? "publish" : "confirmed";
    }
  } catch {
    if (writing && filesystemEffectIssued !== true)
      filesystemEffectIssued = null;
  }
  return refused();
}
