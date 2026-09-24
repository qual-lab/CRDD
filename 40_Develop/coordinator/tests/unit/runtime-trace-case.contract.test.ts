/**
 * coordinator:unit:runtime-trace-caseの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:runtime-trace-caseが所有する検証責務を実行する。
 * @trace PPR-UT-006
 * @level UT
 * @scope runtime、trace、case
 * @boundary PPR-UT-006=N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRuntimeTraceCase,
  getRuntimeTraceCase,
} from "../support/runtime-trace-case.ts";

/**
 * 実観測のEffect差分がCanonical値から1件でもずれれば拒否するを検証する。
 *
 * @responsibility 実観測のEffect差分がCanonical値から1件でもずれれば拒否するの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実観測のEffect差分がCanonical値から1件でもずれれば拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。
 */
test("実観測のEffect差分がCanonical値から1件でもずれれば拒否する", () => {
  const canonical = getRuntimeTraceCase("CASE-RECOVERY-TO-RECOVERED");
  assert.throws(
    () =>
      assertRuntimeTraceCase(canonical.id, {
        ...canonical,
        effectObservations: {
          ...canonical.effectObservations,
          cleanup: canonical.effectObservations.cleanup + 1,
        },
      }),
    assert.AssertionError,
  );
});
