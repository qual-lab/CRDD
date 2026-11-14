/**
 * 実行履歴・記録退役の値検査と純粋な遷移・投影を所有する。
 * @responsibility I/Oや新しい権限を発行せず、モデル固有の受入条件を判定する。
 * @trace ARCH-000008
 */

import { createHash } from "node:crypto";

import {
  isDockerRestartCheckpointSettled,
  parseDockerTaskRecoveryId,
  validOutcome,
  validPrimaryFailure,
  validRepairSummary,
} from "../attempt/validation.ts";
import { inspectDecisionHistoryEvent } from "../decision/validation.ts";
import type { Snapshot, SnapshotObservations } from "../state/types.ts";
import {
  adoptionWasRejected,
  historyRow,
  PROJECT_SNAPSHOT_SCHEMA,
  queueIsClosed,
  rejectedAdoptionEvidenceCanRetire,
  standaloneAdoptionIsClosed,
} from "../state/validation.ts";
import {
  encodeStateValue,
  hasExecutionStateRecordKeys,
  isSha256Hex,
} from "../state/value.ts";

import type { HistoryRow } from "./types.ts";

/**
 * 実行・判断履歴を全行検査し、exact行の相関だけを返す。
 * @responsibility 破損、部分行、重複、未知値を期間整理へ渡さない。
 * @trace ARCH-000008
 * @input bytes: 固定履歴Fileから安定読取りしたUTF-8本文。
 * @returns 正規行・時刻・回復参照・両Hashの不変集合、またはnull。
 * @precondition File実体とRootは物理Ownerが確認する。
 * @postcondition 全行を検証するまで部分結果を返さない。
 * @effect N/A: メモリ内の復号と検査だけ。
 * @failure 不正UTF-8、部分行、未知Schema、重複はnull。
 * @invariant 容量・破損を行削除で解消せず、履歴をAuthorityへ昇格しない。
 * @boundary 終了履歴の値契約と物理Writer。
 * @security 未検査fieldや任意Pathを許可せず、判断本文を現在のAuthorityへ昇格しない。
 * @concurrency 元Fileと元状態の再照合は物理Ownerが行う。
 */
export function decodeHistoryRows(bytes: unknown) {
  try {
    if (!Buffer.isBuffer(bytes)) return null;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!Buffer.from(text, "utf8").equals(bytes)) return null;
    if (text === "") return Object.freeze([]);
    if (!text.endsWith("\n")) return null;
    const seen = new Set<string>();
    const rows = text
      .slice(0, -1)
      .split("\n")
      .map((line) => {
        const row = JSON.parse(line);
        const summary = row?.summary;
        if (summary?.schema === "crdd-coordinator/decision-event/v1") {
          const event = inspectDecisionHistoryEvent(summary.record);
          if (
            !event ||
            !hasExecutionStateRecordKeys(row, [
              "schema",
              "occurredAt",
              "summary",
            ]) ||
            row.schema !== "crdd-coordinator/history-row/v2" ||
            !hasExecutionStateRecordKeys(summary, ["schema", "record"]) ||
            row.occurredAt !== event.occurredAt ||
            `${encodeStateValue(row)}\n` !== `${line}\n`
          )
            throw new Error("decision_history_row_invalid");
          const recoveryId = `decision-history.${event.eventId}`;
          if (seen.has(recoveryId))
            throw new Error("decision_history_identity_duplicate");
          seen.add(recoveryId);
          return Object.freeze({
            line: `${line}\n`,
            occurredAt: event.occurredAt,
            recoveryId,
            lineSha256: createHash("sha256").update(`${line}\n`).digest("hex"),
            summarySha256: createHash("sha256")
              .update(`${encodeStateValue(summary)}\n`)
              .digest("hex"),
          });
        }
        if (summary?.schema === "crdd-coordinator/task-summary/v1") {
          if (
            !hasExecutionStateRecordKeys(row, [
              "schema",
              "occurredAt",
              "summary",
            ]) ||
            row.schema !== "crdd-coordinator/history-row/v2" ||
            !hasExecutionStateRecordKeys(summary, ["schema", "record"]) ||
            `${encodeStateValue(row)}\n` !== `${line}\n`
          )
            throw new Error("task_history_row_invalid");
          const record = historyRow(summary.record, Date.parse(row.occurredAt));
          const recoveryId = `task-history.${record.id}`;
          if (record.occurredAt !== row.occurredAt || seen.has(recoveryId))
            throw new Error("task_history_identity_invalid");
          seen.add(recoveryId);
          return Object.freeze({
            line: `${line}\n`,
            occurredAt: record.occurredAt,
            recoveryId,
            lineSha256: createHash("sha256").update(`${line}\n`).digest("hex"),
            summarySha256: createHash("sha256")
              .update(`${encodeStateValue(summary)}\n`)
              .digest("hex"),
          });
        }
        if (summary?.schema === "crdd-coordinator/repair-summary/v1") {
          if (
            !hasExecutionStateRecordKeys(row, [
              "schema",
              "occurredAt",
              "summary",
            ]) ||
            row.schema !== "crdd-coordinator/history-row/v2" ||
            typeof row.occurredAt !== "string" ||
            !Number.isFinite(Date.parse(row.occurredAt)) ||
            new Date(row.occurredAt).toISOString() !== row.occurredAt ||
            `${encodeStateValue(row)}\n` !== `${line}\n` ||
            !validRepairSummary(summary) ||
            (summary.retention !== undefined &&
              row.occurredAt !== summary.retention.decidedAt) ||
            seen.has(summary.recoveryId)
          )
            throw new Error("repair_history_row_invalid");
          seen.add(summary.recoveryId);
          return Object.freeze({
            line: `${line}\n`,
            occurredAt: row.occurredAt as string,
            ...(summary.retention === undefined
              ? {}
              : { reviewAfter: summary.retention.reviewAfter as string }),
            recoveryId: summary.recoveryId as string,
            lineSha256: createHash("sha256").update(`${line}\n`).digest("hex"),
            summarySha256: createHash("sha256")
              .update(`${encodeStateValue(summary)}\n`)
              .digest("hex"),
          });
        }
        if (
          !hasExecutionStateRecordKeys(row, [
            "schema",
            "occurredAt",
            "summary",
          ]) ||
          row.schema !== "crdd-coordinator/history-row/v2" ||
          typeof row.occurredAt !== "string" ||
          !Number.isFinite(Date.parse(row.occurredAt)) ||
          new Date(Date.parse(row.occurredAt)).toISOString() !==
            row.occurredAt ||
          `${encodeStateValue(row)}\n` !== `${line}\n` ||
          !hasExecutionStateRecordKeys(summary, [
            "schema",
            "recoveryCorrelationId",
            ...(Object.hasOwn(summary, "dockerRestart")
              ? ["dockerRestart"]
              : []),
            "operationId",
            "operationNonce",
            "recoveryId",
            "identitySha256",
            "primaryFailure",
            "execution",
            "outcome",
            "hostCleanup",
            "lease",
          ]) ||
          summary.schema !== "crdd-execution-model/operation-summary/v5" ||
          typeof summary.recoveryCorrelationId !== "string" ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(
            summary.recoveryCorrelationId,
          ) ||
          (Object.hasOwn(summary, "dockerRestart") &&
            (summary.dockerRestart === null ||
              !isDockerRestartCheckpointSettled(summary.dockerRestart))) ||
          typeof summary.operationId !== "string" ||
          !/^OP-[0-9]{6,}$/u.test(summary.operationId) ||
          !isSha256Hex(summary.operationNonce) ||
          !isSha256Hex(summary.identitySha256) ||
          !validPrimaryFailure(summary.primaryFailure) ||
          !hasExecutionStateRecordKeys(summary.execution, [
            "providerStart",
            "externalSend",
            "sharedWrite",
            "ownerEffect",
            "workspaceReusable",
          ]) ||
          !["not_started", "started", "unknown"].includes(
            summary.execution.providerStart,
          ) ||
          !["not_issued", "issued", "unknown"].includes(
            summary.execution.externalSend,
          ) ||
          !["not_issued", "possible", "unknown"].includes(
            summary.execution.sharedWrite,
          ) ||
          summary.execution.ownerEffect !== "disabled" ||
          summary.execution.workspaceReusable !== false ||
          !validOutcome(summary.outcome) ||
          summary.outcome?.cleanupConfirmed !== true ||
          summary.hostCleanup !== "confirmed" ||
          summary.lease !== "released"
        )
          throw new Error("history_row_invalid");
        const recovery = parseDockerTaskRecoveryId(summary.recoveryId);
        if (
          !recovery ||
          recovery.operationNonce !== summary.operationNonce ||
          recovery.baseHash !== summary.identitySha256 ||
          seen.has(summary.recoveryId)
        )
          throw new Error("history_identity_invalid");
        seen.add(summary.recoveryId);
        return Object.freeze({
          line: `${line}\n`,
          occurredAt: row.occurredAt as string,
          recoveryId: summary.recoveryId as string,
          lineSha256: createHash("sha256").update(`${line}\n`).digest("hex"),
          summarySha256: createHash("sha256")
            .update(`${encodeStateValue(summary)}\n`)
            .digest("hex"),
        });
      });
    return Object.freeze(rows);
  } catch {
    return null;
  }
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
export function prepareHistoryPending(
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
    return blocked("orchestrator_history_time_invalid");
  const rows = current.queueEntries
    .filter(
      (queue) =>
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
  for (const record of current.results) {
    if (
      current.historyPending.some((row) => row.id === record.identity) ||
      !standaloneAdoptionIsClosed(
        current,
        record.identity,
        observations.obligations(),
      )
    )
      continue;
    rows.push({
      id: record.identity,
      occurredAt: new Date(now).toISOString(),
      outcome: adoptionWasRejected(record) ? "failed" : "completed",
      primaryFailure: adoptionWasRejected(record) ? "execution" : null,
      cleanup: "confirmed",
    });
  }
  return completed("orchestrator_history_prepared", {
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
export function prepareTerminalRecordRetirement(
  current: Snapshot,
  observations: Readonly<{
    obligations: () => SnapshotObservations;
    historySettlement: (row: HistoryRow) => "recorded" | "expired" | null;
    nextEpoch: () => string;
  }>,
) {
  const retired = new Set<string>();
  for (const row of current.historyPending) {
    if (
      !queueIsClosed(current, row.id, observations.obligations()) &&
      !standaloneAdoptionIsClosed(current, row.id, observations.obligations())
    )
      continue;
    const disposition = observations.historySettlement(row);
    if (disposition !== "recorded" && disposition !== "expired")
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
            ? observations.nextEpoch()
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
              !rejectedAdoptionEvidenceCanRetire(
                current,
                {
                  ...current,
                  results: current.results.filter(
                    (record) => !retired.has(record.identity),
                  ),
                },
                item,
                observations.obligations(),
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
                          !adoptionWasRejected(record),
                      )),
                )
              ),
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
export function prepareHistoryTransfer(
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
}

/** 元の成功封筒を局所値として返す。 */
function completed<T>(reason: string, value: T) {
  return Object.freeze({ status: "completed" as const, reason, value });
}

/** 元の固定拒否と手動回復フラグを保持する。 */
function blocked(reason: string, manualRecoveryRequired = false) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    value: null,
    manualRecoveryRequired,
    recoveryId: null,
  });
}
