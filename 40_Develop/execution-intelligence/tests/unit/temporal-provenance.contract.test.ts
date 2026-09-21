/**
 * 時系列由来の純粋分類規則を検証する。
 *
 * @packageDocumentation
 * @responsibility current、historical、stale、逆行Clockおよび欠測時刻の分類を反証する。
 * @trace PPR-UT-013
 * @level UT
 * @scope temporal-provenance、revision、observed-at、freshness
 * @boundary PPR-UT-013=N/A: 純粋比較規則は外部境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { classifyTemporalProvenance } from "../../src/index.ts";

const base = {
  recordRevision: "revision-current",
  currentRevision: "revision-current",
  observedAt: "2026-09-22T09:30:00.000Z",
  staleBefore: "2026-09-22T09:00:00.000Z",
  evaluatedAt: "2026-09-22T10:00:00.000Z",
} as const;

/**
 * 現行Revisionの新しい観測をcurrentへ分類する。
 *
 * @responsibility 鮮度境界内の現行Revisionをcurrentへ分類する規則を検証する。
 * @trace PPR-UT-013
 * @precondition 現行Revisionと鮮度境界内のObserved Atを用意する。
 * @stimulus 時系列由来分類を実行する。
 * @observation classification、reasonおよび入力根拠を観測する。
 * @oracle currentとcurrent_revision_fresh_observationを返す。
 * @cleanup N/A: Testは外部資源を作成しない。
 * @boundary PPR-UT-013=N/A: 純粋比較規則は外部境界を持たない。
 */
test("現行Revisionの新しい観測をcurrentへ分類する", () => {
  const result = classifyTemporalProvenance(base);
  assert.equal(result?.classification, "current");
  assert.equal(result?.reason, "current_revision_fresh_observation");
});

/**
 * 異なるRevisionの観測を時刻順だけでcurrentへ昇格しない。
 *
 * @responsibility Revision不一致をhistoricalとして保持する規則を検証する。
 * @trace PPR-UT-013
 * @precondition 現行Revisionと異なる記録Revisionを用意する。
 * @stimulus 時系列由来分類を実行する。
 * @observation classificationとreasonを観測する。
 * @oracle historicalとdifferent_revision_observationを返す。
 * @cleanup N/A: Testは外部資源を作成しない。
 * @boundary PPR-UT-013=N/A: 純粋比較規則は外部境界を持たない。
 */
test("異なるRevisionの観測を時刻順だけでcurrentへ昇格しない", () => {
  const result = classifyTemporalProvenance({
    ...base,
    recordRevision: "revision-history",
  });
  assert.equal(result?.classification, "historical");
  assert.equal(result?.reason, "different_revision_observation");
});

/**
 * 現行Revisionでも鮮度境界より古い観測をstaleへ分類する。
 *
 * @responsibility 現行Identityと観測鮮度を別に評価する規則を検証する。
 * @trace PPR-UT-013
 * @precondition 現行Revisionと鮮度境界より古いObserved Atを用意する。
 * @stimulus 時系列由来分類を実行する。
 * @observation classificationとreasonを観測する。
 * @oracle staleとcurrent_revision_stale_observationを返す。
 * @cleanup N/A: Testは外部資源を作成しない。
 * @boundary PPR-UT-013=N/A: 純粋比較規則は外部境界を持たない。
 */
test("現行Revisionでも鮮度境界より古い観測をstaleへ分類する", () => {
  const result = classifyTemporalProvenance({
    ...base,
    observedAt: "2026-09-22T08:59:59.999Z",
  });
  assert.equal(result?.classification, "stale");
  assert.equal(result?.reason, "current_revision_stale_observation");
});

/**
 * 評価時点より未来の逆行Clockをunknownへ保持する。
 *
 * @responsibility Clock差から現在値を捏造せず判断不能を保持する規則を検証する。
 * @trace PPR-UT-013
 * @precondition 評価時点より未来のObserved Atを用意する。
 * @stimulus 時系列由来分類を実行する。
 * @observation classificationとreasonを観測する。
 * @oracle unknownとobserved_at_after_evaluationを返す。
 * @cleanup N/A: Testは外部資源を作成しない。
 * @boundary PPR-UT-013=N/A: 純粋比較規則は外部境界を持たない。
 */
test("評価時点より未来の逆行Clockをunknownへ保持する", () => {
  const result = classifyTemporalProvenance({
    ...base,
    observedAt: "2026-09-22T10:00:00.001Z",
  });
  assert.equal(result?.classification, "unknown");
  assert.equal(result?.reason, "observed_at_after_evaluation");
});

/**
 * 欠測時刻を既知の現行性へ畳まない。
 *
 * @responsibility Observed At欠測をunknownとして保持する規則を検証する。
 * @trace PPR-UT-013
 * @precondition observedAtをnullにする。
 * @stimulus 時系列由来分類を実行する。
 * @observation classificationとreasonを観測する。
 * @oracle unknownとobserved_at_missingを返す。
 * @cleanup N/A: Testは外部資源を作成しない。
 * @boundary PPR-UT-013=N/A: 純粋比較規則は外部境界を持たない。
 */
test("欠測時刻を既知の現行性へ畳まない", () => {
  const result = classifyTemporalProvenance({ ...base, observedAt: null });
  assert.equal(result?.classification, "unknown");
  assert.equal(result?.reason, "observed_at_missing");
});

/**
 * 不正な時刻と鮮度境界を契約不正として拒否する。
 *
 * @responsibility 曖昧な日時形式と逆転した評価境界を分類結果へ混入させない。
 * @trace PPR-UT-013
 * @precondition 非UTC時刻とevaluatedAtより後のstaleBeforeを用意する。
 * @stimulus 時系列由来分類を実行する。
 * @observation null拒否結果を観測する。
 * @oracle 両入力をnullで拒否する。
 * @cleanup N/A: Testは外部資源を作成しない。
 * @boundary PPR-UT-013=N/A: 純粋比較規則は外部境界を持たない。
 */
test("不正な時刻と鮮度境界を契約不正として拒否する", () => {
  assert.equal(
    classifyTemporalProvenance({ ...base, observedAt: "2026-09-22" }),
    null,
  );
  assert.equal(
    classifyTemporalProvenance({
      ...base,
      staleBefore: "2026-09-22T10:00:00.001Z",
    }),
    null,
  );
});
