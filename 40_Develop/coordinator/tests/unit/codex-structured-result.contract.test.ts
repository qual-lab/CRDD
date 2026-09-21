/**
 * coordinator:unit:codex-structured-resultの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:codex-structured-resultが所有する検証責務を実行する。
 * @trace RCM-UT-016
 * @level UT
 * @scope codex、structured、result
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  describeCodexStructuredResultContract,
  normalizeCodexStructuredResult,
} from "../../src/security/codex-structured-result.ts";

/**
 * Codexの単一exact Resultだけを正規化するを検証する。
 *
 * @responsibility Codexの単一exact Resultだけを正規化するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codexの単一exact Resultだけを正規化するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
test("Codexの単一exact Resultだけを正規化する", () => {
  const result = normalizeCodexStructuredResult('{"status":true}\n');
  assert.equal(result.status, "confirmed");
  assert.deepEqual(result.normalizedResult, { status: true });
  assert.equal(result.rawOutputReported, false);
});

/**
 * false・余分なkey・重複key・複数documentを拒否するを検証する。
 *
 * @responsibility false・余分なkey・重複key・複数documentを拒否するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus false・余分なkey・重複key・複数documentを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
test("false・余分なkey・重複key・複数documentを拒否する", () => {
  for (const raw of [
    '{"status":false}',
    '{"status":true,"extra":true}',
    '{"status":true,"status":false}',
    '{"status":true}{"status":true}',
    "not-json",
  ]) {
    assert.equal(normalizeCodexStructuredResult(raw).status, "blocked");
  }
});

/**
 * 公開契約はraw出力非公開とbyte上限を固定するを検証する。
 *
 * @responsibility 公開契約はraw出力非公開とbyte上限を固定するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約はraw出力非公開とbyte上限を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
test("公開契約はraw出力非公開とbyte上限を固定する", () => {
  const contract = describeCodexStructuredResultContract();
  assert.equal(contract.contractRevision, 1);
  assert.equal(contract.duplicateKeysAllowed, false);
  assert.equal(contract.maximumBytes, 16_384);
  assert.equal(contract.rawOutputReported, false);
});
