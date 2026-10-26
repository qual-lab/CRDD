/**
 * 終了記録を履歴へ移し、現在状態から退役させる。
 * @responsibility 履歴確定と受付世代切替を調整し、未解決状態を保全する。
 * @trace ARCH-000004、ARCH-000008
 */
import type { StoreResult } from "./result.ts";
import { observeCoordinatorSnapshotObligations } from "../storage/state.ts";
import { completed } from "./result.ts";
import { blocked } from "./result.ts";
import { withCoordinatorSnapshotOperation } from "../storage/state.ts";
import { coordinatorQueueIsClosed } from "./transition.ts";
import { coordinatorAdoptionWasRejected } from "./transition.ts";
import { coordinatorRejectedAdoptionEvidenceCanRetire } from "./transition.ts";
import { coordinatorStandaloneAdoptionIsClosed } from "./transition.ts";
import { encodeCoordinatorStateValue } from "./validation.ts";
import { randomUUID } from "node:crypto";
import { COORDINATOR_PROJECT_SNAPSHOT_SCHEMA } from "../storage/state.ts";
import type { HistoryRow } from "../storage/history.ts";
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
    (current, owner) => {
      if (
        !Number.isSafeInteger(now) ||
        now < 0 ||
        current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA
      )
        return blocked("orchestrator_history_time_invalid");
      const rows = current.queueEntries
        .filter(
          (queue) =>
            !current.historyPending.some((row) => row.id === queue.queueId) &&
            coordinatorQueueIsClosed(
              current,
              queue.queueId,
              observeCoordinatorSnapshotObligations(owner),
            ),
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
      for (const record of current.results) {
        if (
          current.historyPending.some((row) => row.id === record.identity) ||
          !coordinatorStandaloneAdoptionIsClosed(
            current,
            record.identity,
            observeCoordinatorSnapshotObligations(owner),
          )
        )
          continue;
        rows.push({
          id: record.identity,
          occurredAt: new Date(now).toISOString(),
          outcome: coordinatorAdoptionWasRejected(record)
            ? "failed"
            : "completed",
          primaryFailure: coordinatorAdoptionWasRejected(record)
            ? "execution"
            : null,
          cleanup: "confirmed",
        });
      }
      return completed("orchestrator_history_prepared", {
        next: rows.length
          ? { ...current, historyPending: [...current.historyPending, ...rows] }
          : null,
        value: rows.length,
      });
    },
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
          ? encodeCoordinatorStateValue(current.historyPending)
          : null,
        now,
      );
      if (trimmed.status !== "completed") return blocked(trimmed.reason, true);
      const retired = new Set<string>();
      for (const row of current.historyPending) {
        if (
          !coordinatorQueueIsClosed(
            current,
            row.id,
            observeCoordinatorSnapshotObligations(owner),
          ) &&
          !coordinatorStandaloneAdoptionIsClosed(
            current,
            row.id,
            observeCoordinatorSnapshotObligations(owner),
          )
        )
          continue;
        if (inspectCoordinatorHistorySettlement(owner, row, now) === null)
          return blocked("orchestrator_history_transfer_unconfirmed", true);
        retired.add(row.id);
      }
      return completed("orchestrator_terminal_records_retired", {
        next: retired.size
          ? {
              ...current,
              intakeEpoch: current.queueEntries.some((queue) =>
                retired.has(queue.queueId),
              )
                ? `epoch-${randomUUID()}`
                : current.intakeEpoch,
              queueEntries: current.queueEntries.filter(
                (item) => !retired.has(item.queueId),
              ),
              intakeBindings: current.intakeBindings.filter(
                (item) => !retired.has(item.queueId),
              ),
              leaseEvidence: current.leaseEvidence.filter(
                (item) =>
                  !current.queueEntries.some(
                    (queue) =>
                      item.content.kind === "project-operation" &&
                      retired.has(queue.queueId) &&
                      queue.queueId === item.content.queueId &&
                      queue.projectId === item.projectId,
                  ) &&
                  !coordinatorRejectedAdoptionEvidenceCanRetire(
                    current,
                    {
                      ...current,
                      results: current.results.filter(
                        (record) => !retired.has(record.identity),
                      ),
                    },
                    item,
                    observeCoordinatorSnapshotObligations(owner),
                  ) &&
                  !(
                    item.content.kind === "canonical-adoption" &&
                    !current.results.some(
                      (record) =>
                        record.kind === "adoption" &&
                        record.projectId === item.projectId &&
                        ((!retired.has(record.identity) &&
                          !current.queueEntries.some(
                            (queue) =>
                              retired.has(queue.queueId) &&
                              queue.queueId === record.queueId &&
                              queue.projectId === record.projectId &&
                              queue.milestoneId === record.milestoneId,
                          )) ||
                          current.projects.some(
                            (project) =>
                              project.milestone.criterionEvidenceIds.includes(
                                record.identity,
                              ) ||
                              project.objectives.some((objective) =>
                                objective.criterionEvidenceIds.includes(
                                  record.identity,
                                ),
                              ),
                          ) ||
                          current.queueEntries.some(
                            (queue) =>
                              !retired.has(queue.queueId) &&
                              queue.resultReference === record.identity,
                          )),
                    ) &&
                    !current.queueEntries.some(
                      (queue) =>
                        queue.projectId === item.projectId &&
                        !retired.has(queue.queueId),
                    ) &&
                    current.historyPending.some(
                      (row) =>
                        retired.has(row.id) &&
                        (current.queueEntries.some(
                          (queue) =>
                            queue.queueId === row.id &&
                            queue.projectId === item.projectId,
                        ) ||
                          current.results.some(
                            (record) =>
                              record.identity === row.id &&
                              record.projectId === item.projectId &&
                              !coordinatorAdoptionWasRejected(record),
                          )),
                    )
                  ),
              ),
              decisionRecoveries: current.decisionRecoveries.filter(
                (item) => !retired.has(item.value.queueId),
              ),
              results: current.results.filter(
                (item) =>
                  (!current.queueEntries.some(
                    (queue) =>
                      retired.has(queue.queueId) &&
                      queue.queueId === item.queueId &&
                      queue.projectId === item.projectId &&
                      queue.milestoneId === item.milestoneId,
                  ) &&
                    !retired.has(item.identity)) ||
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
                    (queue) =>
                      !retired.has(queue.queueId) &&
                      queue.resultReference === item.identity,
                  ),
              ),
              acceptanceDecisions: current.acceptanceDecisions.filter(
                (item) =>
                  !current.queueEntries.some(
                    (queue) =>
                      retired.has(queue.queueId) &&
                      queue.projectId === item.record.projectId &&
                      queue.milestoneId === item.record.milestoneId,
                  ) ||
                  current.queueEntries.some(
                    (queue) =>
                      !retired.has(queue.queueId) &&
                      queue.projectId === item.record.projectId &&
                      queue.milestoneId === item.record.milestoneId,
                  ),
              ),
              historyPending: current.historyPending.filter(
                (row) => !retired.has(row.id),
              ),
            }
          : null,
        value: retired.size,
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
      let recorded = 0;
      let expired = 0;
      if (current.historyPending.length) {
        const saved = updateCoordinatorHistoryOwned(
          owner,
          encodeCoordinatorStateValue(current.historyPending),
          now,
        );
        if (saved.status !== "completed") return blocked(saved.reason, true);
      }
      for (const row of current.historyPending) {
        const disposition = inspectCoordinatorHistorySettlement(
          owner,
          row,
          now,
        );
        if (disposition === null)
          return blocked("orchestrator_history_transfer_unconfirmed", true);
        if (disposition === "recorded") recorded += 1;
        else expired += 1;
      }
      return completed("orchestrator_history_transferred", {
        next: current.historyPending.length
          ? { ...current, historyPending: [] }
          : null,
        value: { recorded, expired },
      });
    },
    "history",
  );
}
