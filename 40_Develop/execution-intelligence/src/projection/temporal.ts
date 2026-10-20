/**
 * 実行記録Reader、Clock SourceおよびProjectionのApplication境界を所有する。
 *
 * @responsibility 読取り状態と時系列由来を、欠測・不明・時刻差を失わず利用側Projectionへ搬送する。
 * @trace ARCH-000007
 * @trace ARCH-000016
 * @boundary ReaderおよびClock SourceからProjectionへ値を搬送する隣接境界。
 * @effect N/A: Sourceを読取り分類するだけで正本または入力記録を変更しない。
 */
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../record/validation.ts";

const ID = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/u;
const MAXIMUM_RECORDS = 256;

/**
 * Projectionが利用するClock Source契約を定義する。
 *
 * @responsibility 評価時点を一回だけ供給する責務を型として固定する。
 * @trace ARCH-000016
 * @shape nowがUTC時刻文字列を返すPortを表す。
 * @invariant 一回のProjection内では一つの評価時点だけを使用する。
 * @boundary Clock SourceとProjectionの隣接境界。
 * @security N/A: Authority、秘密値または信頼判断を扱わない。
 * @compatibility 利用側はnowの返却文字列だけへ依存する。
 */
export type TemporalClockSource = Readonly<{ now: () => string }>;

/**
 * 時系列Projectionの入力契約を定義する。
 *
 * @responsibility 現行Revision、鮮度境界、到着順および記録の時系列根拠を型として固定する。
 * @trace ARCH-000016
 * @shape TemporalRecordProjectionInputのPropertyと記録集合を固定する。
 * @invariant 到着順をRevisionの新旧や現在性へ読み替えない。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: Authority、秘密値または信頼判断を扱わない。
 * @compatibility 利用側は宣言済みPropertyだけへ依存する。
 */
export type TemporalRecordProjectionInput = Readonly<{
  currentRevision: string;
  staleBefore: string;
  records: readonly Readonly<{
    recordId: string;
    recordRevision: string;
    observedAt: string | null;
    arrivalOrder: number;
  }>[];
}>;

/**
 * 時系列Projectionの結果契約を定義する。
 *
 * @responsibility 各記録の到着順、分類および分類根拠を変更せず返す。
 * @trace ARCH-000016
 * @shape TemporalRecordProjectionResultの評価時点と記録別結果を固定する。
 * @invariant unknownを除去せず、複数currentがあっても勝手に一件へ統合しない。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: Authority、秘密値または信頼判断を扱わない。
 * @compatibility 利用側は記録別分類を根拠として扱う。
 */
export type TemporalRecordProjectionResult = Readonly<{
  evaluatedAt: string;
  records: readonly Readonly<{
    recordId: string;
    arrivalOrder: number;
    provenance: TemporalProvenanceResult;
  }>[];
}>;

/**
 * Readerの状態をProjectionへ搬送した結果を定義する。
 *
 * @responsibility observed、not_observed、unknownと理由・観測時点を同じ結果に保持する。
 * @trace ARCH-000007
 * @shape RecordStateProjectionResultの閉じた三状態を固定する。
 * @invariant unknownをnot_observedまたは空値へ畳まない。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: Authority、秘密値または信頼判断を扱わない。
 * @compatibility 利用側はstateとreasonの組合せを維持する。
 */
export type RecordStateProjectionResult =
  | Readonly<{ state: "observed"; observedAt: string }>
  | Readonly<{ state: "not_observed" | "unknown"; reason: string }>;

/**
 * Clock Sourceと実行記録を時系列Projectionへ接続する。
 *
 * @responsibility Clockを一回観測し、各記録を同じ評価時点で分類して到着順とともに返す。
 * @trace ARCH-000016
 * @input value: TemporalRecordProjectionInput、clock: TemporalClockSource
 * @returns 有効な入力のTemporalRecordProjectionResult、契約不正またはClock失敗ならnullを返す。
 * @precondition 記録IDと到着順は入力集合内で一意である。
 * @postcondition 入力記録を変更せず、欠測・逆行Clockをunknownのまま返す。
 * @effect Clock Sourceのnowを一回呼ぶ以外の外部または共有Effectを発行しない。
 * @failure Clock例外、重複、疎な配列または分類不能入力はnullで拒否する。
 * @invariant 到着順だけで異なるRevisionをcurrentへ昇格しない。
 * @boundary Clock Source→記録→Projectionの関連2 blocks境界。
 * @security N/A: Authority、秘密値または信頼判断を扱わない。
 * @concurrency 一回の呼出しでClockを一回だけ観測し、共有状態を保持しない。
 */
export function projectTemporalRecords(
  value: unknown,
  clock: TemporalClockSource,
): TemporalRecordProjectionResult | null {
  const input = snapshotPlainRecord(
    value,
    new Set(["currentRevision", "records", "staleBefore"] as const),
  );
  const records = input
    ? snapshotPlainArray(input.records, MAXIMUM_RECORDS)
    : { status: "blocked" as const, value: null };
  if (
    !input ||
    typeof input.currentRevision !== "string" ||
    !ID.test(input.currentRevision) ||
    typeof input.staleBefore !== "string" ||
    records.status !== "ok" ||
    records.value.length === 0 ||
    !clock ||
    typeof clock.now !== "function"
  )
    return null;
  let evaluatedAt: string;
  try {
    evaluatedAt = clock.now();
  } catch {
    return null;
  }
  const projectedRecords: Array<{
    recordId: string;
    arrivalOrder: number;
    provenance: TemporalProvenanceResult;
  }> = [];
  for (const entry of records.value) {
    const record = snapshotPlainRecord(
      entry,
      new Set([
        "arrivalOrder",
        "observedAt",
        "recordId",
        "recordRevision",
      ] as const),
    );
    if (
      !record ||
      typeof record.recordId !== "string" ||
      !ID.test(record.recordId) ||
      typeof record.recordRevision !== "string" ||
      !ID.test(record.recordRevision) ||
      (record.observedAt !== null && typeof record.observedAt !== "string") ||
      !Number.isSafeInteger(record.arrivalOrder) ||
      Number(record.arrivalOrder) < 0
    )
      return null;
    const provenance = classifyTemporalProvenance({
      recordRevision: record.recordRevision,
      currentRevision: input.currentRevision,
      observedAt: record.observedAt,
      evaluatedAt,
      staleBefore: input.staleBefore,
    });
    if (!provenance) return null;
    projectedRecords.push({
      recordId: record.recordId,
      arrivalOrder: Number(record.arrivalOrder),
      provenance,
    });
  }
  if (
    new Set(projectedRecords.map((entry) => entry.recordId)).size !==
      projectedRecords.length ||
    new Set(projectedRecords.map((entry) => entry.arrivalOrder)).size !==
      projectedRecords.length
  )
    return null;
  return Object.freeze({
    evaluatedAt,
    records: Object.freeze(
      projectedRecords.map((entry) => Object.freeze(entry)),
    ),
  });
}

/**
 * Record Readerの状態をProjectionへ接続する。
 *
 * @responsibility Readerが返したobserved、not_observed、unknownを同じ分類と根拠のままProjectionへ搬送する。
 * @trace ARCH-000007
 * @input reader: () => unknown
 * @returns 有効なRecordStateProjectionResult、Reader失敗または契約不正ならnullを返す。
 * @precondition Readerは閉じた状態契約を返し、共有状態の変更をProjectionへ委ねない。
 * @postcondition observedAtまたはreasonを保持し、Sourceを変更しない。
 * @effect Readerを一回呼ぶ以外の外部または共有Effectを発行しない。
 * @failure Reader例外、未知状態、余剰Propertyおよび不正値はnullで拒否する。
 * @invariant unknownをnot_observed、空値または正常へ畳まない。
 * @boundary Record Reader→Projectorの隣接1 block境界。
 * @security N/A: Authority、秘密値または信頼判断を扱わない。
 * @concurrency Readerを一回だけ呼び、共有状態を保持しない。
 */
export function readAndProjectRecordState(
  reader: () => unknown,
): RecordStateProjectionResult | null {
  let value: unknown;
  try {
    value = reader();
  } catch {
    return null;
  }
  const observed = snapshotPlainRecord(
    value,
    new Set(["observedAt", "state"] as const),
  );
  if (observed?.state === "observed" && typeof observed.observedAt === "string")
    return Object.freeze({
      state: "observed",
      observedAt: observed.observedAt,
    });
  const absent = snapshotPlainRecord(
    value,
    new Set(["reason", "state"] as const),
  );
  if (
    absent &&
    (absent.state === "not_observed" || absent.state === "unknown") &&
    typeof absent.reason === "string" &&
    absent.reason.length > 0 &&
    absent.reason.length <= 256 &&
    !absent.reason.includes("\0")
  )
    return Object.freeze({ state: absent.state, reason: absent.reason });
  return null;
}

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
