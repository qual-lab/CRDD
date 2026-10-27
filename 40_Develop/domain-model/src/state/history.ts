/**
 * 現在状態へ結合する終了履歴の値検査と保持候補を所有する。
 * @packageDocumentation
 * @responsibility 全行検査と期間整理を物理保存・現在Ownerの確認から分離する。
 * @trace ARCH-000004、ARCH-000008
 * @boundary メモリ内のbyteと検査済みSnapshotだけ。File・Lock・実行資源を操作しない。
 */
import { createHash } from "node:crypto";
import {
  RUNTIME_STATE_MAXIMUM_BYTES,
  encodeRuntimeStateValue,
} from "./codec.ts";
import {
  exactRecordKeys,
  isSha256Hex,
  historyRow,
  decodeRuntimeDomainSnapshot as decodeCoordinatorStateSnapshot,
} from "./validation.ts";
import {
  validCoordinatorRepairSummary,
  isDockerRestartCheckpointSettled,
  validCoordinatorPrimaryFailure,
  validCoordinatorOutcome,
  parseDockerTaskRecoveryId,
} from "../attempt/validation.ts";
import { coordinatorConsumerCompletionPolicy } from "../task/validation.ts";

/**
 * 終了履歴を全行検査し、exact行の相関だけを返す。
 * @responsibility 破損、部分行、重複、未知値を期間整理へ渡さない。
 * @trace ARCH-000008
 * @input bytes: 固定履歴Fileから安定読取りしたUTF-8本文。
 * @returns 正規行・時刻・回復参照・両Hashの不変集合、またはnull。
 * @precondition File実体とRootは物理Ownerが確認する。
 * @postcondition 全行を検証するまで部分結果を返さない。
 * @effect N/A: メモリ内の復号と検査だけ。
 * @failure 容量超過、不正UTF-8、部分行、未知Schema、重複はnull。
 * @invariant 容量・破損を行削除で解消せず、履歴をAuthorityへ昇格しない。
 * @boundary 終了履歴の値契約と物理Writer。
 * @security 自由本文、秘密値、任意Pathを許可しない。
 * @concurrency 元Fileと元状態の再照合は物理Ownerが行う。
 */
export function decodeCoordinatorHistoryRows(bytes: unknown) {
  try {
    if (!Buffer.isBuffer(bytes) || bytes.length > RUNTIME_STATE_MAXIMUM_BYTES)
      return null;
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
        if (summary?.schema === "crdd-coordinator/task-summary/v1") {
          if (
            !exactRecordKeys(row, ["schema", "occurredAt", "summary"]) ||
            row.schema !== "crdd-coordinator/history-row/v2" ||
            !exactRecordKeys(summary, ["schema", "record"]) ||
            `${encodeRuntimeStateValue(row)}\n` !== `${line}\n`
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
              .update(`${encodeRuntimeStateValue(summary)}\n`)
              .digest("hex"),
          });
        }
        if (summary?.schema === "crdd-coordinator/repair-summary/v1") {
          if (
            !exactRecordKeys(row, ["schema", "occurredAt", "summary"]) ||
            row.schema !== "crdd-coordinator/history-row/v2" ||
            typeof row.occurredAt !== "string" ||
            !Number.isFinite(Date.parse(row.occurredAt)) ||
            new Date(row.occurredAt).toISOString() !== row.occurredAt ||
            `${encodeRuntimeStateValue(row)}\n` !== `${line}\n` ||
            !validCoordinatorRepairSummary(summary) ||
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
              .update(`${encodeRuntimeStateValue(summary)}\n`)
              .digest("hex"),
          });
        }
        if (
          !exactRecordKeys(row, ["schema", "occurredAt", "summary"]) ||
          row.schema !== "crdd-coordinator/history-row/v2" ||
          typeof row.occurredAt !== "string" ||
          !Number.isFinite(Date.parse(row.occurredAt)) ||
          new Date(Date.parse(row.occurredAt)).toISOString() !==
            row.occurredAt ||
          `${encodeRuntimeStateValue(row)}\n` !== `${line}\n` ||
          !exactRecordKeys(summary, [
            "schema",
            ...(summary?.schema === "crdd-coordinator/operation-summary/v4"
              ? ["consumer", "recoveryCorrelationId"]
              : []),
            ...(summary?.schema === "crdd-coordinator/operation-summary/v3" ||
            (summary?.schema === "crdd-coordinator/operation-summary/v4" &&
              Object.hasOwn(summary, "dockerRestart"))
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
          ![
            "crdd-coordinator/operation-summary/v2",
            "crdd-coordinator/operation-summary/v3",
            "crdd-coordinator/operation-summary/v4",
          ].includes(summary.schema) ||
          (summary.schema === "crdd-coordinator/operation-summary/v4" &&
            (coordinatorConsumerCompletionPolicy(summary.consumer) === null ||
              !(
                summary.recoveryCorrelationId === null ||
                (typeof summary.recoveryCorrelationId === "string" &&
                  /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(
                    summary.recoveryCorrelationId,
                  ))
              ))) ||
          ((summary.schema === "crdd-coordinator/operation-summary/v3" ||
            (summary.schema === "crdd-coordinator/operation-summary/v4" &&
              Object.hasOwn(summary, "dockerRestart"))) &&
            (summary.dockerRestart === null ||
              !isDockerRestartCheckpointSettled(summary.dockerRestart))) ||
          typeof summary.operationId !== "string" ||
          !/^OP-[0-9]{6,}$/u.test(summary.operationId) ||
          !isSha256Hex(summary.operationNonce) ||
          !isSha256Hex(summary.identitySha256) ||
          !validCoordinatorPrimaryFailure(summary.primaryFailure) ||
          !exactRecordKeys(summary.execution, [
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
          !validCoordinatorOutcome(summary.outcome) ||
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
            .update(`${encodeRuntimeStateValue(summary)}\n`)
            .digest("hex"),
        });
      });
    return Object.freeze(rows);
  } catch {
    return null;
  }
}

/**
 * 検査済み終了履歴から保持期間内・保持期限前・未終了参照の行を残す候補を作る。
 * @responsibility 期間整理と保存確認の順序を現在状態へ結合する。
 * @trace ARCH-000008
 * @input currentBytes: 現在Snapshot、historyBytes: 履歴本文、now: 固定UTC時刻、retentionDays: 設定日数、repositoryBinding: 現在結合。
 * @returns 元の行順と本文を維持した候補、またはnull。
 * @precondition 更新排他内の元File実体・版・設定を物理Writerが再照合する。
 * @postcondition 未確認行は期限外でも保持し、確認済みの欠落行を再追加しない。
 * @effect N/A: メモリ内の候補生成だけ。
 * @failure 全行検査失敗、設定不正、未確認行欠落または相関不一致はnull。
 * @invariant 件数・容量を理由に削除せず、状態の操作・搬送を変更しない。
 * @boundary 現在状態と通常履歴の保持期間。
 * @security 候補生成は実保存・読戻し・操作除去のAuthorityを発行しない。
 * @concurrency 判定時刻・設定と元本文への結合を保存側が保持する。
 */
export function prepareCoordinatorHistoryRetention(
  currentBytes: unknown,
  historyBytes: unknown,
  now: unknown,
  retentionDays: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const rows = decodeCoordinatorHistoryRows(historyBytes);
  if (
    !current ||
    !rows ||
    typeof now !== "string" ||
    !Number.isFinite(Date.parse(now)) ||
    new Date(Date.parse(now)).toISOString() !== now ||
    typeof retentionDays !== "number" ||
    !Number.isSafeInteger(retentionDays) ||
    retentionDays < 1 ||
    retentionDays > 104249991
  )
    return null;
  const cutoff = Date.parse(now) - retentionDays * 86400000;
  if (!Number.isSafeInteger(cutoff)) return null;
  const byRecovery = new Map(rows.map((row) => [row.recoveryId, row]));
  const protectedRecoveries = new Set<string>();
  for (const row of current.snapshot.historyPending)
    protectedRecoveries.add(`task-history.${row.id}`);
  for (const delivery of current.snapshot.pendingDeliveries)
    protectedRecoveries.add(delivery.recoveryId);
  for (const recovery of current.snapshot.unresolvedRecoveries)
    protectedRecoveries.add(recovery.recoveryId);
  for (const operation of current.snapshot.operations) {
    if (!operation.history) continue;
    const activeRetention =
      operation.kind === "runtime_repair" && operation.retention !== undefined;
    const row = byRecovery.get(operation.recoveryId);
    if (
      (row &&
        (row.lineSha256 !== operation.history.lineSha256 ||
          row.summarySha256 !== operation.summarySha256)) ||
      (!row &&
        (!operation.history.confirmed ||
          activeRetention ||
          protectedRecoveries.has(operation.recoveryId)))
    )
      return null;
    if (!operation.history.confirmed || activeRetention)
      protectedRecoveries.add(operation.recoveryId);
  }
  return Buffer.from(
    rows
      .filter(
        (row) =>
          protectedRecoveries.has(row.recoveryId) ||
          ("reviewAfter" in row &&
            typeof row.reviewAfter === "string" &&
            Date.parse(now) < Date.parse(row.reviewAfter)) ||
          Date.parse(row.occurredAt) >= cutoff,
      )
      .map((row) => row.line)
      .join(""),
    "utf8",
  );
}
