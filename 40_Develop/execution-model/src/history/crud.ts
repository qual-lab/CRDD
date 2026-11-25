/**
 * 実行履歴・記録退役の完成した保存・読取り操作を提供する。
 * @responsibility 共通保存処理へ接続し、既存の排他・改訂検査・通知順序を維持する。
 * @trace ARCH-000008
 */
import type { StorageRootInput } from "../storage/lock.ts";
import { prepareDecisionRetirement } from "../decision/validation.ts";
import {
  observeSnapshotObligations,
  withSnapshotOperation,
  queueIsClosed,
} from "../composition/crud.ts";
import { PROJECT_SNAPSHOT_SCHEMA } from "../composition/types.ts";
import {
  prepareRecoveredHistoryPublication,
  prepareRepairHistoryPublication,
} from "../composition/transition.ts";
import { encodeStateValue } from "../composition/validation.ts";
import type { HistoryRepositoryInput, StoreResult } from "../storage/lock.ts";
import {
  acquireStorageOwnerForRepository,
  blocked,
  completed,
  readHistoryRetentionDays,
  type StorageOwner,
} from "../storage/lock.ts";
import type { RecoveryHistoryRepository } from "../storage/store.ts";
import {
  publishRecoveryState,
  writeStateSnapshot,
  inspectDecisionHistorySettlement,
  inspectHistorySettlement,
  readStateSnapshot,
  updateHistoryOwned,
} from "../storage/store.ts";
import type { HistoryRow } from "./types.ts";
import type { Snapshot, SnapshotObservations } from "../composition/types.ts";
/**
 * 終了要約の生成、履歴確定、実行IDの保持を接続する。
 * @responsibility 閉じたQueueと専属の終了証拠を現在状態から退役する。
 * @trace ARCH-000004
 * @input Repository Root、binding、評価時刻。
 * @returns 退役件数または保全停止。
 * @precondition 本番の終了処置後に呼ぶ。Queryからは呼ばない。
 * @postcondition 履歴確定後だけhistorySettledを確定し、Queueの実行ID・要求Hash・終端を保持する。
 * @effect 固定history.jsonlとstate.jsonを保存する。
 * @failure 保存失敗時は同じ終了時刻の要約を再送可能に保持する。
 * @invariant 最新Project、結果、受入判断、候補、保護Authorityは保持する。
 * @boundary 終了処置から現在状態と30日履歴。
 * @security 未解決状態を期間だけで退役しない。
 * @concurrency 各段階を同Rootの短期Ownerで直列化する。
 */
export function retireStateRecords(
  workingDirectory: StorageRootInput | HistoryRepositoryInput,
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
        return blocked("coordinator_snapshot_schema_invalid");
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
  workingDirectory: StorageRootInput | HistoryRepositoryInput,
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
 * @input repository、recoveryId、assertOwner、operationKind: 元保存Ownerとexact対象。所有者・設定の再確認は同期観測に限定し、保存領域を書き換えない。
 * @returns 履歴確認、最終Snapshot確認、Lock解放、累積Effectを区別した結果。
 * @precondition docker_task又はdocker_repairの終端条件が既存Readerで成立する。
 * @postcondition 確定済みの再入場、または最大二回の保存と単一Lockの解放後だけ履歴確認済みにする。
 * @effect 既存のRepository-local現在状態と履歴だけ。
 * @failure 段階不変・別対象・保存/読取り/排他不明では次段へ進まず保全する。
 * @invariant 保持判断、Task配送、Operation除去、Host処置は実施しない。
 * @boundary 完成した履歴保存と私有Reader/Writer。
 * @security 任意Path・候補・時刻や用途間fallbackを受け付けない。
 * @concurrency 既存短期Lockを操作全体で一度だけ取得・解放する。各段は同じOwnerを借用する。
 */
export function saveRecoveryHistory(
  repository: RecoveryHistoryRepository,
  recoveryId: string,
  assertOwner: () => boolean,
  operationKind: "docker_task" | "docker_repair",
) {
  const progress: { filesystemEffectIssued: boolean | null; writing: boolean } =
    { filesystemEffectIssued: false, writing: false };
  const refused = () =>
    Object.freeze({
      ...writeStateSnapshot(null, null, null, null),
      historyConfirmed: false,
      filesystemEffectIssued: progress.filesystemEffectIssued,
    });
  if (operationKind !== "docker_task" && operationKind !== "docker_repair")
    return refused();
  const save = (owner: StorageOwner) => {
    const observed = readStateSnapshot(
      repository,
      recoveryId,
      recoveryId,
      null,
      operationKind,
      "docker_task",
      false,
      null,
      null,
      owner,
    );
    const initial = observed.currentHistoryPublication;
    const operation = observed.value?.snapshot.operations.find(
      (item) => item.kind === operationKind && item.recoveryId === recoveryId,
    );
    if (
      observed.status !== "completed" ||
      !observed.value ||
      !("ownerHeld" in observed) ||
      !initial ||
      !operation ||
      operation.kind === "host_operation" ||
      assertOwner() !== true
    )
      return Object.freeze({ ...refused(), reason: observed.reason });
    if (initial.operationKind !== operationKind) return refused();
    if (!initial.needsWrite) {
      if (
        initial.stage !== "confirmed" ||
        operation.history?.confirmed !== true
      )
        return refused();
      return Object.freeze({
        status: "completed" as const,
        reason: "coordinator_state_snapshot_confirmed",
        revision: observed.value.snapshot.revision,
        payloadSha256: observed.value.payloadSha256,
        snapshotConfirmed: true,
        filesystemEffectIssued: progress.filesystemEffectIssued,
        historyConfirmed: true,
      });
    }
    let publication = initial;
    for (let step = 0; step < 2; step++) {
      if (
        publication.stage === "confirmed" ||
        publication.stage === "terminal_checkpoint"
      )
        return refused();
      progress.writing = true;
      const saved = publishRecoveryState(
        {
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
          ...(publication.taskState
            ? { taskState: publication.taskState }
            : {}),
          assertOwner,
        },
        owner,
      );
      progress.writing = false;
      if (saved.filesystemEffectIssued) progress.filesystemEffectIssued = true;
      if (saved.status !== "completed" || !saved.snapshotConfirmed)
        return Object.freeze({
          ...saved,
          filesystemEffectIssued: progress.filesystemEffectIssued,
          historyConfirmed: false,
        });
      if (publication.stage === "publish") {
        return Object.freeze({
          status: "completed" as const,
          reason: saved.reason,
          revision: saved.revision,
          payloadSha256: saved.payloadSha256,
          snapshotConfirmed: true,
          filesystemEffectIssued: progress.filesystemEffectIssued,
          historyConfirmed: true,
        });
      }
      // この呼出しが同じLock内で確定した本文だけを次段の元版にする。
      // 上位へは渡さず、Writerが次段の現物と元版・履歴・設定を再照合する。
      if (assertOwner() !== true) return refused();
      const retentionDays = readHistoryRetentionDays(repository);
      if (retentionDays === null) return refused();
      const input = [
        publication.candidate,
        recoveryId,
        publication.historyFile?.bytes ?? Buffer.alloc(0),
        null,
        retentionDays,
        repository.repositoryBinding,
      ] as const;
      const taskNext =
        operationKind === "docker_task"
          ? prepareRecoveredHistoryPublication(
              ...input,
              publication.taskState
                ? { current: publication.taskState.candidate }
                : undefined,
            )
          : null;
      const next =
        operationKind === "docker_task"
          ? taskNext
          : prepareRepairHistoryPublication(...input);
      if (!next) return refused();
      publication = {
        ...publication,
        stage: "publish",
        before: publication.candidate,
        candidate: next.snapshotBytes,
        retentionDays,
        ...(taskNext && publication.taskState
          ? {
              taskState: {
                ...publication.taskState,
                owner,
                before: publication.taskState.candidate,
                candidate: {
                  bytes: taskNext.snapshotBytes,
                  decoded: taskNext.decoded,
                },
              },
            }
          : {}),
      };
    }
    return refused();
  };
  let owner: StorageOwner | null = null;
  let result: ReturnType<typeof save>;
  let lockReleased = true;
  try {
    if (typeof assertOwner !== "function" || assertOwner() !== true)
      return refused();
    const acquired = acquireStorageOwnerForRepository(repository);
    if (acquired.status !== "completed")
      return Object.freeze({
        ...refused(),
        reason: acquired.reason,
        lockReleased: false,
      });
    owner = acquired.value;
    result = save(owner);
  } catch {
    if (progress.writing && progress.filesystemEffectIssued !== true)
      progress.filesystemEffectIssued = null;
    result = refused();
  } finally {
    if (owner) {
      try {
        lockReleased = owner.release();
      } catch {
        lockReleased = false;
      }
    }
  }
  if (lockReleased && result.historyConfirmed) {
    // 旧Readerと同じく、解放後の現在Ownerは本文を開き直さず確認する。
    try {
      if (assertOwner() !== true) result = refused();
    } catch {
      result = refused();
    }
  }
  return Object.freeze({
    ...result,
    ...(lockReleased
      ? {}
      : {
          status: "blocked" as const,
          reason: "coordinator_state_lock_release_unconfirmed",
          historyConfirmed: false,
        }),
    lockReleased,
  });
}

/**
 * 終了要約のpending候補を生成する。
 * @responsibility 同じ短期Ownerの用途固定観測を元の短絡位置で利用し対象外を保持する。
 * @trace ARCH-000004、ARCH-000008
 * @input fresh元版、用途固定の同期観測、必要な評価時刻。
 * @returns 元の固定結果封筒と候補又は無変更。
 * @precondition 同じ短期Ownerがfresh Snapshotを検証済み。履歴出版前に呼ぶ。
 * @postcondition 未解決・未搬送・参照中の記録を成功や退役へ補正しない。
 * @effect 値操作と同Ownerの有限同期観測。物理出版は呼ばない。
 * @failure 元の理由・観測順・再入場時のpendingを維持する。
 * @invariant 候補を保存・回復・排他解放の成立としない。
 * @boundary Domain値と既存Ownerへ束縛された履歴／資源観測。
 * @security 生Owner、publisher、handle、任意Snapshot callbackを受け取らない。
 * @concurrency 元の短期Owner内だけで適用する。観測値を対象間でmemoizeしない。
 */
function prepareHistoryPending(
  current: Snapshot,
  now: number,
  observations: Readonly<{
    obligations: () => SnapshotObservations;
  }>,
) {
  if (
    !Number.isSafeInteger(now) ||
    now < 0 ||
    current.schema !== PROJECT_SNAPSHOT_SCHEMA
  )
    return historyCandidateBlocked("coordinator_history_time_invalid");
  const rows = current.queueEntries
    .filter(
      (queue) =>
        !queue.historySettled &&
        !current.historyPending.some((row) => row.id === queue.queueId) &&
        queueIsClosed(current, queue.queueId, observations.obligations()),
    )
    .map(
      (queue): HistoryRow => ({
        id: queue.queueId,
        occurredAt: new Date(now).toISOString(),
        outcome: queue.state === "cancelled" ? "cancelled" : "completed",
        primaryFailure: queue.state === "cancelled" ? "cancel" : null,
        cleanup: "confirmed",
      }),
    );
  return historyCandidateCompleted("coordinator_history_prepared", {
    next: rows.length
      ? { ...current, historyPending: [...current.historyPending, ...rows] }
      : null,
    value: rows.length,
  });
}

/**
 * 履歴出版成功後の終了記録退役候補を生成する。
 * @responsibility 同じ短期Ownerの用途固定観測を元の短絡位置で利用し対象外を保持する。
 * @trace ARCH-000004、ARCH-000008
 * @input fresh元版、用途固定の同期観測、必要な評価時刻。
 * @returns 元の固定結果封筒と候補又は無変更。
 * @precondition Coordinatorが必要な履歴出版を元の位置で成功させている。
 * @postcondition 未解決・未搬送・参照中の記録を成功や退役へ補正しない。
 * @effect 値操作と同Ownerの有限同期観測。物理出版は呼ばない。
 * @failure 元の理由・観測順・再入場時のpendingを維持する。
 * @invariant 候補を保存・回復・排他解放の成立としない。
 * @boundary Domain値と既存Ownerへ束縛された履歴／資源観測。
 * @security 生Owner、publisher、handle、任意Snapshot callbackを受け取らない。
 * @concurrency 元の短期Owner内だけで適用する。観測値を対象間でmemoizeしない。
 */
function prepareTerminalRecordRetirement(
  current: Snapshot,
  observations: Readonly<{
    obligations: () => SnapshotObservations;
    historySettlement: (row: HistoryRow) => "recorded" | "expired" | null;
  }>,
) {
  const retired = new Set<string>();
  for (const row of current.historyPending) {
    if (!queueIsClosed(current, row.id, observations.obligations())) continue;
    const disposition = observations.historySettlement(row);
    if (disposition !== "recorded" && disposition !== "expired")
      return historyCandidateBlocked(
        "coordinator_history_transfer_unconfirmed",
        true,
      );
    retired.add(row.id);
  }
  return historyCandidateCompleted("coordinator_terminal_records_retired", {
    next: retired.size
      ? {
          ...current,
          queueEntries: current.queueEntries.map((item) =>
            retired.has(item.queueId)
              ? {
                  ...item,
                  historySettled: true,
                  generation: item.generation + 1,
                }
              : item,
          ),
          leaseEvidence: current.leaseEvidence.filter(
            (item) =>
              !current.queueEntries.some(
                (queue) =>
                  retired.has(queue.queueId) &&
                  queue.queueId === item.content.queueId &&
                  queue.projectId === item.projectId,
              ),
          ),
          results: current.results.filter(
            (item) =>
              !current.queueEntries.some(
                (queue) =>
                  retired.has(queue.queueId) &&
                  queue.queueId === item.queueId &&
                  queue.projectId === item.projectId &&
                  queue.milestoneId === item.milestoneId,
              ) ||
              current.projects.some(
                (project) =>
                  project.milestone.criterionEvidenceIds.includes(
                    item.identity,
                  ) ||
                  project.objectives.some((objective) =>
                    objective.criterionEvidenceIds.includes(item.identity),
                  ),
              ) ||
              current.queueEntries.some(
                (queue) => queue.resultReference === item.identity,
              ),
          ),
          historyPending: current.historyPending.filter(
            (row) => !retired.has(row.id),
          ),
        }
      : null,
    value: retired.size,
  });
}

/**
 * 出版済みpendingの搬送確認候補を生成する。
 * @responsibility 同じ短期Ownerの用途固定観測を元の短絡位置で利用し対象外を保持する。
 * @trace ARCH-000004、ARCH-000008
 * @input fresh元版、用途固定の同期観測、必要な評価時刻。
 * @returns 元の固定結果封筒と候補又は無変更。
 * @precondition Coordinatorが必要な履歴出版を元の位置で成功させている。
 * @postcondition 未解決・未搬送・参照中の記録を成功や退役へ補正しない。
 * @effect 値操作と同Ownerの有限同期観測。物理出版は呼ばない。
 * @failure 元の理由・観測順・再入場時のpendingを維持する。
 * @invariant 候補を保存・回復・排他解放の成立としない。
 * @boundary Domain値と既存Ownerへ束縛された履歴／資源観測。
 * @security 生Owner、publisher、handle、任意Snapshot callbackを受け取らない。
 * @concurrency 元の短期Owner内だけで適用する。観測値を対象間でmemoizeしない。
 */
function prepareHistoryTransfer(
  current: Snapshot,
  observations: Readonly<{
    historySettlement: (row: HistoryRow) => "recorded" | "expired" | null;
  }>,
) {
  let recorded = 0;
  let expired = 0;

  for (const row of current.historyPending) {
    const disposition = observations.historySettlement(row);
    if (disposition !== "recorded" && disposition !== "expired")
      return historyCandidateBlocked(
        "coordinator_history_transfer_unconfirmed",
        true,
      );
    if (disposition === "recorded") recorded += 1;
    else expired += 1;
  }
  return historyCandidateCompleted("coordinator_history_transferred", {
    next: current.historyPending.length
      ? { ...current, historyPending: [] }
      : null,
    value: { recorded, expired },
  });
}

/** 元の成功封筒を局所値として返す。 */
function historyCandidateCompleted<T>(reason: string, value: T) {
  return Object.freeze({ status: "completed" as const, reason, value });
}

/** 元の固定拒否と手動回復フラグを保持する。 */
function historyCandidateBlocked(
  reason: string,
  manualRecoveryRequired = false,
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    value: null,
    manualRecoveryRequired,
    recoveryId: null,
  });
}
