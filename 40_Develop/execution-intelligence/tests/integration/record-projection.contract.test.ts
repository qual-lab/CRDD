/**
 * execution-intelligence:integration:record-projectionの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Clock／Reader境界からProjectionまで時系列根拠と読取り状態を保持することを検証する。
 * @trace PPR-IT-010
 * @trace PPR-IT-012
 * @level IT
 * @scope execution-intelligence、clock、reader、projection、provenance
 * @boundary PPR-IT-010=Related 2 Blocks、PPR-IT-012=Adjacent 1 Block。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  projectTemporalRecords,
  readAndProjectRecordState,
} from "../../src/index.ts";

/**
 * Clock差と到着順から古いRevisionをcurrentへ昇格しない。
 *
 * @responsibility Clock Source→記録→Projectionの時系列分類を検証する。
 * @trace PPR-IT-010
 * @precondition 現行・履歴・stale・逆行・欠測記録と固定Clockを用意する。
 * @stimulus 到着順を意図的に新旧と逆にしてProjectionを実行する。
 * @observation Revision、Observed At、到着順、分類および理由を観測する。
 * @oracle 到着順に依存せずcurrent、historical、stale、unknownを理由付きで返す。
 * @cleanup N/A: Testは外部資源を作成しない。
 * @boundary PPR-IT-010=Related 2 Blocks: Clock Source→記録→Projectorを結合する。
 */
test("Clock差と到着順から古いRevisionをcurrentへ昇格しない", () => {
  let clockCalls = 0;
  const result = projectTemporalRecords(
    {
      currentRevision: "revision-current",
      staleBefore: "2026-09-22T09:00:00.000Z",
      records: [
        {
          recordId: "history-arrived-last",
          recordRevision: "revision-history",
          observedAt: "2026-09-22T09:59:00.000Z",
          arrivalOrder: 4,
        },
        {
          recordId: "current",
          recordRevision: "revision-current",
          observedAt: "2026-09-22T09:30:00.000Z",
          arrivalOrder: 1,
        },
        {
          recordId: "stale",
          recordRevision: "revision-current",
          observedAt: "2026-09-22T08:59:00.000Z",
          arrivalOrder: 2,
        },
        {
          recordId: "clock-ahead",
          recordRevision: "revision-current",
          observedAt: "2026-09-22T10:01:00.000Z",
          arrivalOrder: 3,
        },
        {
          recordId: "missing-time",
          recordRevision: "revision-current",
          observedAt: null,
          arrivalOrder: 5,
        },
      ],
    },
    {
      now: () => {
        clockCalls += 1;
        return "2026-09-22T10:00:00.000Z";
      },
    },
  );
  assert.ok(result);
  assert.equal(clockCalls, 1);
  assert.deepEqual(
    result.records.map((entry) => [
      entry.recordId,
      entry.arrivalOrder,
      entry.provenance.classification,
      entry.provenance.reason,
    ]),
    [
      [
        "history-arrived-last",
        4,
        "historical",
        "different_revision_observation",
      ],
      ["current", 1, "current", "current_revision_fresh_observation"],
      ["stale", 2, "stale", "current_revision_stale_observation"],
      ["clock-ahead", 3, "unknown", "observed_at_after_evaluation"],
      ["missing-time", 5, "unknown", "observed_at_missing"],
    ],
  );
});

/**
 * Clock失敗と重複IdentityをProjection成立へ畳まない。
 *
 * @responsibility Clock観測不能と記録Identity競合をEffect 0で拒否する。
 * @trace PPR-IT-010
 * @precondition 例外Clockと重複recordIdを用意する。
 * @stimulus 各入力でProjectionを実行する。
 * @observation null拒否結果を観測する。
 * @oracle Clock失敗と重複Identityを分類済み結果として返さない。
 * @cleanup N/A: Testは外部資源を作成しない。
 * @boundary PPR-IT-010=Related 2 Blocks: Clock Source→記録→Projectorを結合する。
 */
test("Clock失敗と重複IdentityをProjection成立へ畳まない", () => {
  const input = {
    currentRevision: "revision-current",
    staleBefore: "2026-09-22T09:00:00.000Z",
    records: [
      {
        recordId: "record-a",
        recordRevision: "revision-current",
        observedAt: "2026-09-22T09:30:00.000Z",
        arrivalOrder: 1,
      },
    ],
  };
  assert.equal(
    projectTemporalRecords(input, {
      now: () => {
        throw new Error("clock_unavailable");
      },
    }),
    null,
  );
  assert.equal(
    projectTemporalRecords(
      {
        ...input,
        records: [...input.records, { ...input.records[0], arrivalOrder: 2 }],
      },
      { now: () => "2026-09-22T10:00:00.000Z" },
    ),
    null,
  );
});

/**
 * Reader状態を同じ分類と根拠でProjectionへ搬送する。
 *
 * @responsibility observed、not_observed、unknownの三状態を隣接境界で保持する。
 * @trace PPR-IT-012
 * @precondition 三状態を返す固定Readerを用意する。
 * @stimulus 各ReaderをProjectionへ接続する。
 * @observation state、observedAtまたはreasonを観測する。
 * @oracle unknownをnot_observedや空値へ畳まず入力分類を保持する。
 * @cleanup N/A: Testは外部資源を作成しない。
 * @boundary PPR-IT-012=Adjacent 1 Block: Record Reader→Projectorを結合する。
 */
test("Reader状態を同じ分類と根拠でProjectionへ搬送する", () => {
  assert.deepEqual(
    readAndProjectRecordState(() => ({
      state: "observed",
      observedAt: "2026-09-22T10:00:00.000Z",
    })),
    { state: "observed", observedAt: "2026-09-22T10:00:00.000Z" },
  );
  assert.deepEqual(
    readAndProjectRecordState(() => ({
      state: "not_observed",
      reason: "record_absent",
    })),
    { state: "not_observed", reason: "record_absent" },
  );
  assert.deepEqual(
    readAndProjectRecordState(() => ({
      state: "unknown",
      reason: "source_unreadable",
    })),
    { state: "unknown", reason: "source_unreadable" },
  );
});

/**
 * Reader例外と空値反例を正常Projectionへ畳まない。
 *
 * @responsibility Reader失敗と未分類空値をnullで拒否する。
 * @trace PPR-IT-012
 * @precondition 例外、nullおよび空reasonを返すReaderを用意する。
 * @stimulus 各ReaderをProjectionへ接続する。
 * @observation null拒否結果を観測する。
 * @oracle いずれもobservedまたはnot_observedへ変換しない。
 * @cleanup N/A: Testは外部資源を作成しない。
 * @boundary PPR-IT-012=Adjacent 1 Block: Record Reader→Projectorを結合する。
 */
test("Reader例外と空値反例を正常Projectionへ畳まない", () => {
  assert.equal(
    readAndProjectRecordState(() => {
      throw new Error("reader_failed");
    }),
    null,
  );
  assert.equal(
    readAndProjectRecordState(() => null),
    null,
  );
  assert.equal(
    readAndProjectRecordState(() => ({ state: "unknown", reason: "" })),
    null,
  );
});
