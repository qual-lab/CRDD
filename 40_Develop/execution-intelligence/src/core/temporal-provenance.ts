/**
 * 観測記録の改訂版と時刻から、現在値・履歴・古い値・不明を分類する。
 *
 * @responsibility 現行Revision、評価時点および鮮度境界を明示入力として受け取り、時系列上の由来を推測せず分類する。
 * @trace ARCH-000016
 * @boundary Process内の純粋比較境界。
 * @effect N/A: 読取り入力を分類するだけで外部または共有Effectを発行しない。
 */

import { snapshotPlainRecord } from "../boundary/plain-data-snapshot.ts";

const REVISION = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

/**
 * 時系列由来分類の入力契約を定義する。
 *
 * @responsibility 記録Revision、現行Revision、観測時点、評価時点および鮮度境界を型として固定する。
 * @trace ARCH-000016
 * @shape TemporalProvenanceInputが表すPropertyと時間比較入力を固定する。
 * @invariant Revisionの順序を文字列やGit固有機能から推測しない。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: Authority、秘密値または信頼判断を扱わない。
 * @compatibility 利用側は宣言済みPropertyと分類規則だけへ依存する。
 */
export type TemporalProvenanceInput = Readonly<{
  recordRevision: string;
  currentRevision: string;
  observedAt: string | null;
  evaluatedAt: string;
  staleBefore: string;
}>;

/**
 * 時系列由来分類の結果契約を定義する。
 *
 * @responsibility 分類、理由および判断に用いたRevision・時刻を同じ結果として保持する。
 * @trace ARCH-000016
 * @shape TemporalProvenanceResultが表す分類と根拠Propertyを固定する。
 * @invariant unknownをcurrent、historicalまたはstaleへ畳まない。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: Authority、秘密値または信頼判断を扱わない。
 * @compatibility 利用側はclassificationとreasonの組合せを維持する。
 */
export type TemporalProvenanceResult = Readonly<{
  classification: "current" | "historical" | "stale" | "unknown";
  reason:
    | "current_revision_fresh_observation"
    | "different_revision_observation"
    | "current_revision_stale_observation"
    | "observed_at_missing"
    | "observed_at_after_evaluation";
  recordRevision: string;
  currentRevision: string;
  observedAt: string | null;
  evaluatedAt: string;
  staleBefore: string;
}>;

/**
 * UTC時刻文字列を比較可能な値へ変換する。
 *
 * @responsibility RFC 3339のUTC表現だけを受理し、比較可能なepoch値を返す。
 * @trace ARCH-000016
 * @input value: unknown
 * @returns 有効なUTC時刻のepoch millisecond、無効ならnullを返す。
 * @precondition 呼出し元が検査対象の値を渡す。
 * @postcondition 受理した文字列だけを有限なepoch値へ変換する。
 * @effect N/A: 入力と局所値だけを扱い外部Effectを発行しない。
 * @failure 無効な型・形式・日時はnullとして返す。
 * @invariant LocaleやHost timezoneに依存しない。
 * @boundary N/A: Process内の純粋変換で完結する。
 * @security N/A: Authority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function utcInstant(value: unknown): number | null {
  if (typeof value !== "string" || !ISO_UTC.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 観測記録の時系列由来を分類する。
 *
 * @responsibility 明示された現行Revisionと時間境界だけを使用し、現在値・履歴・古い値・不明を分類する。
 * @trace ARCH-000016
 * @input value: TemporalProvenanceInput
 * @returns 有効な入力のTemporalProvenanceResult、契約不正ならnullを返す。
 * @precondition currentRevisionとrecordRevisionは順序を持たないIdentityであり、staleBeforeはevaluatedAt以前である。
 * @postcondition 時刻欠落と逆行時刻をunknownとして保持し、入力を変更しない。
 * @effect N/A: 読取り専用の純粋分類であり外部または共有Effectを発行しない。
 * @failure 入力契約不正はnull、観測時刻欠落・評価時点より未来の記録は理由付きunknownを返す。
 * @invariant Revision文字列の大小やGit履歴から新旧を推測しない。
 * @boundary N/A: Process内の純粋規則で完結する。
 * @security N/A: Authority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function classifyTemporalProvenance(
  value: unknown,
): TemporalProvenanceResult | null {
  const input = snapshotPlainRecord(
    value,
    new Set([
      "currentRevision",
      "evaluatedAt",
      "observedAt",
      "recordRevision",
      "staleBefore",
    ] as const),
  );
  if (
    !input ||
    typeof input.recordRevision !== "string" ||
    typeof input.currentRevision !== "string" ||
    !REVISION.test(input.recordRevision) ||
    !REVISION.test(input.currentRevision) ||
    (input.observedAt !== null && typeof input.observedAt !== "string")
  )
    return null;
  const evaluatedAt = utcInstant(input.evaluatedAt);
  const staleBefore = utcInstant(input.staleBefore);
  if (evaluatedAt === null || staleBefore === null || staleBefore > evaluatedAt)
    return null;
  const base = {
    recordRevision: input.recordRevision,
    currentRevision: input.currentRevision,
    observedAt: input.observedAt,
    evaluatedAt: input.evaluatedAt as string,
    staleBefore: input.staleBefore as string,
  } as const;
  if (input.observedAt === null)
    return Object.freeze({
      classification: "unknown",
      reason: "observed_at_missing",
      ...base,
    });
  const observedAt = utcInstant(input.observedAt);
  if (observedAt === null) return null;
  if (observedAt > evaluatedAt)
    return Object.freeze({
      classification: "unknown",
      reason: "observed_at_after_evaluation",
      ...base,
    });
  if (input.recordRevision !== input.currentRevision)
    return Object.freeze({
      classification: "historical",
      reason: "different_revision_observation",
      ...base,
    });
  if (observedAt < staleBefore)
    return Object.freeze({
      classification: "stale",
      reason: "current_revision_stale_observation",
      ...base,
    });
  return Object.freeze({
    classification: "current",
    reason: "current_revision_fresh_observation",
    ...base,
  });
}
