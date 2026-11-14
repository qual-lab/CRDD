/**
 * 履歴の要約・行生成と保持・出版候補の純粋な規則を所有する。
 * @responsibility State全体の復号・候補・保存を参照せず、検査済み値を処理する。
 * @trace ARCH-000004、ARCH-000008
 */

import { createHash } from "node:crypto";
import { types } from "node:util";
import type {
  ExecutionOperationRecord,
  RepairOperationRecord,
} from "../attempt/types.ts";
import type { DecisionHistoryEvent } from "../decision/types.ts";
import { encodeStateValue } from "../state/operations.ts";
import type {
  HistoryEntry,
  HistoryRetentionReferences,
  HistoryRow,
} from "./types.ts";

/**
 * 終了要約を利用側別の形式へ分岐せず符号化する。
 * @responsibility 終了事実だけを共通の固定Schemaへ投影する。
 * @trace ARCH-000008
 * @input operation: 検査済み操作。
 * @returns LF付きの正規要約本文。
 * @precondition 終端条件はAttemptとStateが確認する。
 * @postcondition 利用側分類や保存資格を要約へ加えない。
 * @effect N/A: メモリ内の符号化だけ。
 * @failure 不正な内部Identity・符号化値は例外。
 * @invariant 旧形式へのfallbackを行わず一次失敗と不明を維持する。
 * @boundary 操作事実と履歴の値形式。
 * @security Path・出力本文・秘密を投影しない。
 * @concurrency N/A: 保存・共有状態なし。
 */
export function operationSummaryBytes(
  operation: ExecutionOperationRecord,
): Buffer {
  const identity = JSON.parse(operation.identityJson);
  return Buffer.from(
    encodeStateValue({
      schema: "crdd-execution-model/operation-summary/v5",
      recoveryCorrelationId:
        identity.recoveryCorrelationId ?? identity.operationId,
      ...(operation.dockerRestart === null
        ? {}
        : { dockerRestart: operation.dockerRestart }),
      operationId: identity.operationId,
      operationNonce: identity.operationNonce,
      recoveryId: operation.recoveryId,
      identitySha256: operation.identitySha256,
      primaryFailure: operation.primaryFailure,
      execution: operation.execution,
      outcome: operation.outcome,
      hostCleanup: operation.host.cleanup,
      lease: operation.lease,
    }) + "\n",
  );
}

/**
 * 固定した要約時刻を含む履歴行を符号化する。
 * @responsibility 確認状態を除外したexact行Identityを所有する。
 * @trace ARCH-000008
 * @input operation: 検証済み操作、occurredAt: 最初の正規UTC時刻。
 * @returns 履歴行の正規本文。
 * @precondition 時刻と操作内容を呼出し元で確認する。
 * @postcondition confirmedを行Hashへ含めない。
 * @effect N/A: メモリ内の符号化。
 * @failure 不正内容は例外。
 * @invariant 再入場の現在時刻で行を再生成しない。
 * @boundary 操作の終了要約と時刻込み履歴行。
 * @security 生出力やPathを追加しない。
 * @concurrency N/A: 保存を行わない。
 */
export function historyLineBytes(
  operation: ExecutionOperationRecord,
  occurredAt: string,
): Buffer {
  return Buffer.from(
    `${encodeStateValue({
      schema: "crdd-coordinator/history-row/v2",
      occurredAt,
      summary: JSON.parse(operationSummaryBytes(operation).toString("utf8")),
    })}\n`,
  );
}

/**
 * 修復checkpointから公開可能な終了要約だけを符号化する。
 * @responsibility 通常はDirectory実体を投影せず、明示保持receiptだけ非Authority Node実体を含める。Owner・Scope・Task fieldは投影しない。
 * @trace ARCH-000008
 * @input operation: 検証済みの終端修復。
 * @returns LF付きcanonical要約bytes。
 * @precondition 外側で共同終端を確認する。
 * @postcondition discardの判断時刻・進捗、handoffの固定期限・三用途実体を保持し、出版時刻・確認flag・Snapshot改訂を含めない。
 * @effect N/A: 値の符号化のみ。
 * @failure 不正な内部Identityは例外。
 * @invariant 要約から実行Authorityや保持物の実体を復元しない。
 * @boundary 保存済み技術値と履歴投影。
 * @security 生Path・秘密・生出力を含めない。
 * @concurrency N/A: 同期構築。
 */
export function repairSummaryBytes(operation: RepairOperationRecord): Buffer {
  const identity = JSON.parse(operation.identityJson);
  const checkpoint = operation.checkpoint;
  if (!checkpoint) throw new Error("repair_checkpoint_missing");
  return Buffer.from(
    `${encodeStateValue({
      schema: "crdd-coordinator/repair-summary/v1",
      operationId: identity.operationId,
      operationNonce: identity.operationNonce,
      recoveryId: operation.recoveryId,
      identitySha256: operation.identitySha256,
      primaryFailure: operation.primaryFailure,
      outcome: operation.outcome,
      disposition: operation.disposition,
      ...(operation.retention !== undefined
        ? { retention: operation.retention }
        : {}),
      ...(operation.disposition === "discard"
        ? { disposal: operation.disposal }
        : {}),
      technical: {
        actions: checkpoint.actions,
        engine: checkpoint.engine,
        stale: checkpoint.stale,
        hostSafety: checkpoint.hostSafety,
        cleanup: checkpoint.cleanup,
        cleanupFailure: checkpoint.cleanupFailure,
      },
    })}\n`,
  );
}

/**
 * 修復の固定時刻を履歴行へ結合する。
 * @responsibility 要約Hashと時刻込み行Hashを区別する。
 * @trace ARCH-000008
 * @input operation: 終端修復、occurredAt: 最初の正規UTC時刻。
 * @returns LF付きcanonical履歴行。
 * @precondition 値と時刻は呼出し元で確認済み。
 * @postcondition confirmedを行へ含めない。
 * @effect N/A: メモリ内構築。
 * @failure 内部値の符号化不正は例外。
 * @invariant 再試行時刻で行を変えない。
 * @boundary 現在状態と履歴行。
 * @security 行はAuthorityではない。
 * @concurrency N/A: 保存を行わない。
 */
export function repairHistoryLineBytes(
  operation: RepairOperationRecord,
  occurredAt: string,
): Buffer {
  return Buffer.from(
    `${encodeStateValue({
      schema: "crdd-coordinator/history-row/v2",
      occurredAt,
      summary: JSON.parse(repairSummaryBytes(operation).toString("utf8")),
    })}\n`,
  );
}

/**
 * Task要約を共通履歴の閉じた行へ変換する。
 * @responsibility 技術操作の回復参照とTask要約IDの名前空間を分離する。
 * @trace ARCH-000004
 * @input row: 検査済み要約。
 * @returns 正規UTF-8の一行。
 * @precondition historyRow検査を完了している。
 * @postcondition 自由文や秘密値を追加しない。
 * @effect N/A: 同期変換。
 * @failure 値の符号化失敗は例外。
 * @invariant 同じIDと本文は同じbyteとなる。
 * @boundary Task要約と共通履歴。
 * @security 要約をAuthorityへ昇格しない。
 * @concurrency N/A: 純粋処理。
 */
export function taskHistoryLine(row: HistoryRow): Buffer {
  return Buffer.from(
    `${encodeStateValue({
      schema: "crdd-coordinator/history-row/v2",
      occurredAt: row.occurredAt,
      summary: { schema: "crdd-coordinator/task-summary/v1", record: row },
    })}\n`,
  );
}

/**
 * 同じ判断イベントを出版と退役確認で同じ正規行へ変換する。
 * @responsibility 判断履歴の固定Schemaと発生時刻を同じ本文へ結合する。
 * @trace ARCH-000004、ARCH-000008
 * @input event: 判断Ownerが検査した履歴イベント。
 * @returns LF付きの正規履歴行。
 * @precondition 回答・適用結果の相関は判断Ownerが確認する。
 * @postcondition 出版時の現在時刻や確認flagを加えない。
 * @effect N/A: メモリ内の符号化だけ。
 * @failure 不正な符号化値は例外。
 * @invariant 同じ元イベントは同じ本文へ符号化する。
 * @boundary 判断イベントと共通履歴。
 * @security 履歴を現在の認可・操作許可へ転用しない。
 * @concurrency N/A: 保存・共有状態なし。
 */
export function decisionHistoryLine(event: DecisionHistoryEvent): Buffer {
  return Buffer.from(
    `${encodeStateValue({
      schema: "crdd-coordinator/history-row/v2",
      occurredAt: event.occurredAt,
      summary: { schema: "crdd-coordinator/decision-event/v1", record: event },
    })}\n`,
  );
}

/**
 * 入力Bufferをintrinsic情報だけで独立捕捉する。
 * @responsibility own method・getter・Proxyを履歴照合の根拠にしない。
 * @trace ARCH-000008
 * @input input: 未信頼のcanonical又はpending。
 * @returns 独立Buffer、又はnull。
 * @precondition 不存在は呼出側が明示する。
 * @postcondition 元値を変更しない。
 * @effect N/A: 同期コピーだけ。
 * @failure 非Buffer・Proxy・intrinsic取得失敗はnull。
 * @invariant 不明を空本文へ補完しない。
 * @boundary byte値の捕捉。
 * @security 外部値のequalsを呼ばない。
 * @concurrency N/A: 共有状態なし。
 */
export function copyHistoryBytes(input: unknown): Buffer | null {
  try {
    if (types.isProxy(input) || !Buffer.isBuffer(input)) return null;
    const intrinsic = Object.getPrototypeOf(Uint8Array.prototype);
    const length = Object.getOwnPropertyDescriptor(
      intrinsic,
      "byteLength",
    )?.get?.call(input);
    if (!Number.isSafeInteger(length) || length < 0) return null;
    const buffer = Object.getOwnPropertyDescriptor(
      intrinsic,
      "buffer",
    )?.get?.call(input);
    const offset = Object.getOwnPropertyDescriptor(
      intrinsic,
      "byteOffset",
    )?.get?.call(input);
    return Buffer.from(new Uint8Array(buffer, offset, length));
  } catch {
    return null;
  }
}

/**
 * 全行検査済みの履歴を現在参照と保持期間へ照合する。
 * @responsibility 必須行と両Hashを選別前に確認し元の行順・本文を保持する。
 * @trace ARCH-000008
 * @input rows: 検査済み行、references: 同じStateの参照、now・retentionDays: 評価条件。
 * @returns 選別後の正規本文、又はnull。
 * @precondition 行の重複・構造とState相関はそれぞれのOwnerが検査する。
 * @postcondition 参照中・保持期限前の行は期間外でも残す。
 * @effect N/A: メモリ内の値選別だけ。
 * @failure 必須行欠測・Hash差・時刻又は日数不正はnull。
 * @invariant confirmedによって必須行の検査を省かない。
 * @boundary Historyの保持規則とStateの参照投影。
 * @security 行を回復Authorityへ昇格しない。
 * @concurrency 同じ元版との結合はState／物理Writerが維持する。
 */
export function retainHistoryRows(
  rows: readonly HistoryEntry[],
  references: HistoryRetentionReferences,
  now: unknown,
  retentionDays: unknown,
): Buffer | null {
  if (
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
  for (const required of references.requiredRows) {
    const row = byRecovery.get(required.recoveryId);
    if (
      !row ||
      row.lineSha256 !== required.lineSha256 ||
      row.summarySha256 !== required.summarySha256
    )
      return null;
  }
  return Buffer.from(
    rows
      .filter(
        (row) =>
          references.protectedRecoveries.has(row.recoveryId) ||
          (typeof row.reviewAfter === "string" &&
            Date.parse(now) < Date.parse(row.reviewAfter)) ||
          Date.parse(row.occurredAt) >= cutoff,
      )
      .map((row) => row.line)
      .join(""),
    "utf8",
  );
}

/**
 * 同じ固定行の出版候補を現在履歴とpending全文へ結合する。
 * @responsibility 既存行とのexact比較、再追記抑止、保持とpending一致を所有する。
 * @trace ARCH-000008
 * @input input: 独立捕捉した本文、検査済み行、同版参照と評価条件。
 * @returns 履歴候補・変更有無、又はnull。
 * @precondition canonical全行と新規一行はDecoderで検査済み。
 * @postcondition 同ID異本文を再生成・上書きしない。
 * @effect N/A: 純粋な候補生成だけ。
 * @failure 行衝突・保持条件不成立・pending差はnull。
 * @invariant 候補を実保存・確認・退役成功としない。
 * @boundary 履歴値の出版条件。State候補は扱わない。
 * @security 任意Path・Owner・Writerを受けない。
 * @concurrency 保存側が同じ元版・設定・本文を再照合する。
 */
export function prepareHistoryPublication(
  input: Readonly<{
    canonical: Buffer;
    pending: Buffer | null;
    rows: readonly HistoryEntry[];
    line: HistoryEntry;
    recoveryId: string;
    references: HistoryRetentionReferences;
    occurredAt: unknown;
    retentionDays: unknown;
  }>,
) {
  const existing = input.rows.find(
    (row) => row.recoveryId === input.recoveryId,
  );
  if (existing && existing.line !== input.line.line) return null;
  const historyBytes = retainHistoryRows(
    existing ? input.rows : [...input.rows, input.line],
    input.references,
    input.occurredAt,
    input.retentionDays,
  );
  if (
    !historyBytes ||
    (input.pending !== null && !input.pending.equals(historyBytes))
  )
    return null;
  return Object.freeze({
    historyBytes,
    historyChanged: !input.canonical.equals(historyBytes),
  });
}

/**
 * Task操作の固定済み履歴行を生成し、保存された行Hashと照合する。
 * @responsibility 未固定の候補行生成と固定済み行の検査を混同しない。
 * @trace ARCH-000008
 * @input operation: 検査済み操作、または未取得。
 * @returns 固定済みLF付き行、欠測・Hash差はnull。
 * @precondition Operationの値検査は呼出し元が完了している。
 * @postcondition 保存済みoccurredAtだけを使い、confirmedをHashに加えない。
 * @effect N/A: 保存しない同期の値計算。
 * @failure 行生成の例外は呼出し元の契約へ伝播する。
 * @invariant historyLineBytesの初回候補生成契約を変更しない。
 * @boundary Historyの固定行とOperation相関。
 * @security 値やHashを保存・操作Authorityへ昇格しない。
 * @concurrency 元Stateとの版結合はState、実保存はWriterが確認する。
 */
export function operationHistoryLine(
  operation: ExecutionOperationRecord | undefined,
): Buffer | null {
  if (!operation?.history) return null;
  const bytes = historyLineBytes(operation, operation.history.occurredAt);
  return createHash("sha256").update(bytes).digest("hex") ===
    operation.history.lineSha256
    ? bytes
    : null;
}

/**
 * 履歴要約の元byte列をHash化し、既に固定されたHashと照合する。
 * @responsibility Task／Repairに共通するbyteと固定Hashの相関だけを計算する。
 * @trace ARCH-000008
 * @input summaryBytes: 既存encoderの正規byte列、expectedSha: 固定Hashまたは未固定のnull。
 * @returns 同じ要約Bufferと導出Hash、固定Hash差はnull。
 * @precondition 要約可能条件と元Operationの検査はAttempt／Stateが行う。
 * @postcondition 再符号化・LF追加・Buffer複製を行わない。
 * @effect N/A: 保存しない同期の値計算。
 * @failure Hash計算の例外はそのまま呼出し元へ返す。
 * @invariant Task／Repairの終了条件や元Stateを検査したとは主張しない。
 * @boundary Historyの要約byteと固定相関。
 * @security 値やHashを保存・操作Authorityへ昇格しない。
 * @concurrency 共有可変状態を持たず、同版結合と保存確認は呼出し元が行う。
 */
export function prepareHistorySummary(
  summaryBytes: Buffer,
  expectedSha: string | null,
) {
  const summarySha256 = createHash("sha256").update(summaryBytes).digest("hex");
  if (expectedSha !== null && expectedSha !== summarySha256) return null;
  return Object.freeze({ summaryBytes, summarySha256 });
}
