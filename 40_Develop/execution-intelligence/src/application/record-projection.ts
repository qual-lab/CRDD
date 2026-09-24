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
  classifyTemporalProvenance,
  type TemporalProvenanceResult,
} from "../core/temporal-provenance.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../boundary/plain-data-snapshot.ts";

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
