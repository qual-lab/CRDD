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
import {
  inspectDecisionHistoryEvent,
  projectDecisionHistory,
} from "../decision/validation.ts";
import type { Decision } from "../decision/types.ts";
import { decisionHistoryLine, taskHistoryLine } from "./operations.ts";
import {
  encodeStateValue,
  hasExecutionStateRecordKeys,
  isSha256Hex,
  ID,
} from "../state/operations.ts";
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
 * 終了要約を固定順序へ検証する。
 *
 * @responsibility 保存可能な分類だけを受け入れる。
 * @trace ARCH-000004
 * @input JSON値と現在時刻。
 * @returns 閉じた終了要約。
 * @precondition 入力はJSON由来。
 * @postcondition ID、時刻、分類を検証済み。
 * @effect N/A: 局所値のみ。
 * @failure 許可外値で例外。
 * @invariant 未解決義務を履歴へ移さない。
 * @boundary 終了要約入力。
 * @security 自由記述や秘密値を拒否する。
 * @concurrency N/A: 同期判定。
 */
export function historyRow(value: unknown, now: number): HistoryRow {
  const row = closedObject(value, [
    "id",
    "occurredAt",
    "outcome",
    "primaryFailure",
    "cleanup",
  ]);
  if (typeof row.id !== "string" || !ID.test(row.id)) throw new Error("id");
  if (
    row.outcome !== "completed" &&
    row.outcome !== "failed" &&
    row.outcome !== "cancelled"
  )
    throw new Error("outcome");
  if (
    row.primaryFailure !== null &&
    row.primaryFailure !== "execution" &&
    row.primaryFailure !== "storage" &&
    row.primaryFailure !== "delivery" &&
    row.primaryFailure !== "cleanup" &&
    row.primaryFailure !== "cancel"
  )
    throw new Error("failure");
  if (
    row.cleanup !== "confirmed" &&
    row.cleanup !== "unknown" &&
    row.cleanup !== "not_required"
  )
    throw new Error("cleanup");
  return {
    id: row.id,
    occurredAt: timestamp(row.occurredAt, now),
    outcome: row.outcome,
    primaryFailure: row.primaryFailure,
    cleanup: row.cleanup,
  };
}

/**
 * JSONの閉じたProperty集合を確認する。
 *
 * @responsibility 未知のPropertyや配列を拒否する。
 * @trace ARCH-000004
 * @input 未検証値と許可Key。
 * @returns 閉じたObject。
 * @precondition JSONから得た値。
 * @postcondition Keyの過不足を拒否済み。
 * @effect N/A: 局所値のみ。
 * @failure 不正shapeで例外。
 * @invariant 未知値を既知へ畳まない。
 * @boundary JSON入力。
 * @security 許可外情報を保存しない。
 * @concurrency N/A: 同期判定。
 */
function closedObject(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("shape");
  const record = value as Record<string, unknown>;
  const actualKeys = Object.keys(record).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify([...keys].sort()))
    throw new Error("keys");
  return record;
}

/**
 * UTC時刻を検証する。
 *
 * @responsibility 不正値と未来時刻を拒否する。
 * @trace ARCH-000004
 * @input ISO時刻と現在時刻。
 * @returns 検証済みISO時刻。
 * @precondition 現在時刻は安全な整数。
 * @postcondition 正規UTC表現で未来ではない。
 * @effect N/A: 局所値のみ。
 * @failure 時刻不正で例外。
 * @invariant 時計逆行を期限切れへ畳まない。
 * @boundary 保存時刻。
 * @security 時刻からAuthorityを発行しない。
 * @concurrency N/A: 同期判定。
 */
function timestamp(value: unknown, now: number): string {
  if (typeof value !== "string") throw new Error("time");
  const milliseconds = Date.parse(value);
  if (
    !Number.isSafeInteger(milliseconds) ||
    new Date(milliseconds).toISOString() !== value ||
    milliseconds > now
  )
    throw new Error("time");
  return value;
}

/**
 * 現行履歴とTask入力・判断記録から、追記候補だけを生成する。
 * @responsibility 全行検査、時刻、重複・衝突とTask→Decisionの行順を所有する。
 * @trace ARCH-000008
 * @input before: 安定読取り本文、recordJson: Task終了要約又はnull、decisions: 同版判断、now: 検査済み時刻。
 * @returns 元byteを保持した候補、又は不正相関のnull。追加なしはbeforeと同じ参照。
 * @precondition 呼出し元がOwner・保存領域・時刻の文法を検査している。
 * @postcondition 同ID同本文は追加せず、異本文は全体を拒否する。
 * @effect N/A: 同期の値検査と候補生成だけ。
 * @failure JSON・行生成の例外は呼出し元へ伝播し、破損・未来・衝突はnull。
 * @invariant 保持期間・pending・保存成功・退役を判断しない。
 * @boundary 未信頼履歴入力と既存保存Writerへ渡す候補。
 * @security 保存資格や現在認可を値から復元しない。
 * @concurrency 同版・fresh・File実体の照合はStorageが継続する。
 */
export function prepareHistoryAppend(
  before: Buffer,
  recordJson: string | null,
  decisions: readonly Decision[],
  now: number,
): Buffer | null {
  const rows = decodeHistoryRows(before);
  if (!rows || rows.some((row) => Date.parse(row.occurredAt) > now))
    return null;
  const parsed: unknown = recordJson === null ? [] : JSON.parse(recordJson);
  const incoming = Array.isArray(parsed) ? parsed : [parsed];
  const known = new Map<string, Buffer>(
    rows.map((row) => [row.recoveryId, Buffer.from(row.line)]),
  );
  const additions: Buffer[] = [];
  for (const value of incoming) {
    const record = historyRow(value, now);
    const line = taskHistoryLine(record);
    const id = `task-history.${record.id}`;
    const same = known.get(id);
    if (same && !line.equals(same)) return null;
    if (!same) {
      known.set(id, line);
      additions.push(line);
    }
  }
  // 未搬送の判断履歴はStateの元記録から再構成する。別のpending集合は持たない。
  for (const decision of decisions) {
    const events = projectDecisionHistory(decision);
    if (!events) return null;
    for (const event of events) {
      if (Date.parse(event.occurredAt) > now) return null;
      const line = decisionHistoryLine(event);
      const id = `decision-history.${event.eventId}`;
      const same = known.get(id);
      if (same && !line.equals(same)) return null;
      if (!same) {
        known.set(id, line);
        additions.push(line);
      }
    }
  }
  return additions.length ? Buffer.concat([before, ...additions]) : before;
}
