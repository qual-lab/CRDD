/**
 * ai-adapter:unit:codex-structured-resultの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility ai-adapter:unit:codex-structured-resultが所有する検証責務を実行する。
 * @trace ERB-UT-032
 * @level UT
 * @scope codex、structured、result
 * @boundary ERB-UT-032=N/A: Provider結果の純粋解析・変換であり外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  describeCodexStructuredResultContract,
  normalizeCodexStructuredResult,
} from "../../../src/index.ts";

/**
 * Codexの単一exact Resultだけを正規化するを検証する。
 *
 * @responsibility Codexの単一exact Resultだけを正規化するの合否判定を所有する。
 * @trace ERB-UT-032
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codexの単一exact Resultだけを正規化するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-032=N/A: AI Adapter内の純粋解析・変換。
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
 * @trace ERB-UT-032
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus false・余分なkey・重複key・複数documentを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-032=N/A: AI Adapter内の純粋解析・変換。
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
 * @trace ERB-UT-032
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約はraw出力非公開とbyte上限を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-032=N/A: AI Adapter内の純粋解析・変換。
 */
test("公開契約はraw出力非公開とbyte上限を固定する", () => {
  const contract = describeCodexStructuredResultContract();
  assert.equal(contract.contractRevision, 1);
  assert.equal(contract.duplicateKeysAllowed, false);
  assert.equal(contract.maximumBytes, 16_384);
  assert.equal(contract.rawOutputReported, false);
});

/**
 * Codex結果の16KiB境界を実入力で確認する。
 *
 * @responsibility 容量契約値の記述と実際の受理・拒否境界が一致することを検証する。
 * @trace ERB-UT-032
 * @precondition 単一exact結果へJSONとして有効なASCII空白を付加する。
 * @stimulus UTF-8で16,383、16,384、16,385 bytesの入力を渡す。
 * @observation 入力bytes数、status、正規化値と生出力非公開を観測する。
 * @oracle 上限以下は同じexact結果を受理し、上限超過は本文なしで拒否する。
 * @cleanup N/A: 純粋な文字列解析で外部資源を生成しない。
 * @boundary ERB-UT-032=N/A: AI Adapter内の純粋解析・変換。
 */
test("Codex結果は16KiBを含む上限以下だけを受理する", () => {
  const document = '{"status":true}';
  for (const bytes of [16_383, 16_384, 16_385]) {
    const input = document + " ".repeat(bytes - Buffer.byteLength(document));
    assert.equal(Buffer.byteLength(input, "utf8"), bytes);
    const result = normalizeCodexStructuredResult(input);
    assert.deepEqual(result, {
      status: bytes <= 16_384 ? "confirmed" : "blocked",
      normalizedResult: bytes <= 16_384 ? { status: true } : null,
      rawOutputReported: false,
    });
    assert.equal("rawOutput" in result, false);
  }
});
