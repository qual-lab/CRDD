/**
 * coordinator:unit:claude-structured-resultの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:claude-structured-resultが所有する検証責務を実行する。
 * @trace RCM-UT-016
 * @level UT
 * @scope claude、structured、result
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { parseUnambiguousJsonDocument } from "../../../ai-adapter/src/index.ts";

import {
  describeClaudeStructuredResultContract,
  normalizeClaudeStructuredResult,
} from "../../../ai-adapter/src/index.ts";

/**
 * createEnvelopeのTest準備責務を実行する。
 *
 * @responsibility createEnvelopeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-UT-016
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createEnvelopeを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
function createEnvelope(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    num_turns: 2,
    total_cost_usd: 0.04699,
    result: "",
    session_id: "not-reported-by-normalizer",
    usage: { input_tokens: 2, output_tokens: 244 },
    structured_output: { status: true },
    ...overrides,
  });
}

/**
 * 共通JSON解析の移管後も曖昧な入力を拒否することを検証する。
 *
 * @responsibility Provider固有Envelopeに依存しない構文拒否条件を固定する。
 * @trace RCM-UT-016
 * @precondition 入力は未信頼なJSON文字列である。
 * @stimulus 正常な入れ子と重複key、escape同値key、末尾データ、不正文法を渡す。
 * @observation 解析された値またはnullを観測する。
 * @oracle 正常値は保持し、曖昧・不正入力はnullとなる。
 * @cleanup N/A: 純粋解析で外部資源を作らない。
 * @boundary RCM-UT-016=Direct Boundary: Coordinator試験→AI Adapter共通出力解析。
 */
test("共通JSON解析はProviderに依存せず曖昧な構文を拒否する", () => {
  assert.deepEqual(
    parseUnambiguousJsonDocument(' {"items":[{"value":1},true,"x"]} \n'),
    { items: [{ value: 1 }, true, "x"] },
  );
  for (const raw of [
    '{"key":1,"key":2}',
    '{"key":1,"\\u006bey":2}',
    '{"nested":[{"key":1,"key":2}]}',
    '{"ok":true} trailing',
    '{"ok":true}{"other":false}',
    '{"key":1,}',
    "[1,]",
    '\uFEFF{"ok":true}',
    "",
  ]) {
    assert.equal(parseUnambiguousJsonDocument(raw), null);
  }
});

/**
 * Claude JSON Envelopeからexact boolean Resultだけを正規化するを検証する。
 *
 * @responsibility Claude JSON Envelopeからexact boolean Resultだけを正規化するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Claude JSON Envelopeからexact boolean Resultだけを正規化するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("Claude JSON Envelopeからexact boolean Resultだけを正規化する", () => {
  const result = normalizeClaudeStructuredResult(`${createEnvelope()}\n`);
  assert.equal(result.status, "confirmed");
  assert.deepEqual(result.normalizedResult, { status: true });
  assert.equal(result.numberOfTurns, 2);
  assert.equal(result.providerReportedApiEquivalentCostUsd, 0.04699);
  assert.equal("sessionId" in result, false);
  assert.equal("rawOutput" in result, false);
});

/**
 * 失敗Envelope、turn超過とbudget超過を拒否するを検証する。
 *
 * @responsibility 失敗Envelope、turn超過とbudget超過を拒否するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 失敗Envelope、turn超過とbudget超過を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("失敗Envelope、turn超過とbudget超過を拒否する", () => {
  for (const envelope of [
    createEnvelope({ subtype: "error_max_turns" }),
    createEnvelope({ is_error: true }),
    createEnvelope({ num_turns: 3 }),
    createEnvelope({ total_cost_usd: 0.1000001 }),
  ]) {
    assert.equal(normalizeClaudeStructuredResult(envelope).status, "blocked");
  }
});

/**
 * Structured Outputのfalse、余分なkeyと型差を拒否するを検証する。
 *
 * @responsibility Structured Outputのfalse、余分なkeyと型差を拒否するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Structured Outputのfalse、余分なkeyと型差を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("Structured Outputのfalse、余分なkeyと型差を拒否する", () => {
  for (const structuredOutput of [
    { status: false },
    { status: true, extra: true },
    { Status: true },
    { status: "true" },
    null,
  ]) {
    assert.equal(
      normalizeClaudeStructuredResult(
        createEnvelope({ structured_output: structuredOutput }),
      ).status,
      "blocked",
    );
  }
});

/**
 * 重複key、複数document、BOMと不正JSONを曖昧入力として拒否するを検証する。
 *
 * @responsibility 重複key、複数document、BOMと不正JSONを曖昧入力として拒否するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 重複key、複数document、BOMと不正JSONを曖昧入力として拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("重複key、複数document、BOMと不正JSONを曖昧入力として拒否する", () => {
  const duplicateEnvelope =
    '{"type":"result","subtype":"success","is_error":false,"num_turns":2,"total_cost_usd":0.01,"structured_output":{"status":true,"status":false}}';
  for (const raw of [
    duplicateEnvelope,
    `${createEnvelope()}${createEnvelope()}`,
    `\ufeff${createEnvelope()}`,
    "not-json",
    "",
  ]) {
    assert.equal(normalizeClaudeStructuredResult(raw).status, "blocked");
  }
});

/**
 * metadata内のJSON全型とescapeを走査しnested重複も拒否するを検証する。
 *
 * @responsibility metadata内のJSON全型とescapeを走査しnested重複も拒否するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus metadata内のJSON全型とescapeを走査しnested重複も拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("metadata内のJSON全型とescapeを走査しnested重複も拒否する", () => {
  const confirmed = normalizeClaudeStructuredResult(
    createEnvelope({
      metadata: {
        emptyObject: {},
        values: [
          true,
          false,
          null,
          0,
          -125.5e2,
          [],
          "escaped\nvalue",
          "unicode-あ",
        ],
      },
    }),
  );
  assert.equal(confirmed.status, "confirmed");
  assert.equal(
    normalizeClaudeStructuredResult(
      createEnvelope({ metadata: JSON.parse('{"x":1,"nested":{"a":1}}') }),
    ).status,
    "confirmed",
  );
  const nestedDuplicate = createEnvelope().replace(
    '"structured_output":{"status":true}',
    '"metadata":{"x":1,"x":2},"structured_output":{"status":true}',
  );
  assert.equal(
    normalizeClaudeStructuredResult(nestedDuplicate).status,
    "blocked",
  );
});

/**
 * 不完全なstring、array、objectと数値tokenを例外なく拒否するを検証する。
 *
 * @responsibility 不完全なstring、array、objectと数値tokenを例外なく拒否するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 不完全なstring、array、objectと数値tokenを例外なく拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("不完全なstring、array、objectと数値tokenを例外なく拒否する", () => {
  for (const raw of [
    '"unterminated',
    '"bad\\q"',
    '"bad\\u12xz"',
    "[",
    "[1",
    "[1;2]",
    "[1,]",
    "{",
    "{x:1}",
    '{"x" 1}',
    '{"x":}',
    '{"x":1;"y":2}',
    '{"x":1',
    "-",
    ".1",
  ]) {
    assert.doesNotThrow(() => normalizeClaudeStructuredResult(raw));
    assert.equal(normalizeClaudeStructuredResult(raw).status, "blocked");
  }
});

/**
 * Envelope型、欠落field、非有限相当と0境界を区別するを検証する。
 *
 * @responsibility Envelope型、欠落field、非有限相当と0境界を区別するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Envelope型、欠落field、非有限相当と0境界を区別するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("Envelope型、欠落field、非有限相当と0境界を区別する", () => {
  assert.equal(normalizeClaudeStructuredResult(1).status, "blocked");
  assert.equal(normalizeClaudeStructuredResult("[]").status, "blocked");
  assert.equal(normalizeClaudeStructuredResult("null").status, "blocked");
  for (const overrides of [
    { type: "message" },
    { num_turns: 0 },
    { num_turns: 1.5 },
    { num_turns: "2" },
    { total_cost_usd: -0.01 },
    { total_cost_usd: "0.01" },
    { total_cost_usd: null },
  ]) {
    assert.equal(
      normalizeClaudeStructuredResult(createEnvelope(overrides)).status,
      "blocked",
    );
  }
  assert.equal(
    normalizeClaudeStructuredResult(
      createEnvelope({ num_turns: 1, total_cost_usd: 0 }),
    ).status,
    "confirmed",
  );
  assert.equal(
    normalizeClaudeStructuredResult(createEnvelope({ total_cost_usd: 0.1 }))
      .status,
    "confirmed",
  );
});

/**
 * 公開契約は単一JSON、重複拒否、2 turnsと$0.10上限を固定するを検証する。
 *
 * @responsibility 公開契約は単一JSON、重複拒否、2 turnsと$0.10上限を固定するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約は単一JSON、重複拒否、2 turnsと$0.10上限を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("公開契約は単一JSON、重複拒否、2 turnsと$0.10上限を固定する", () => {
  const contract = describeClaudeStructuredResultContract();
  assert.equal(contract.envelope, "single_unambiguous_json_document");
  assert.equal(contract.duplicateKeysAllowed, false);
  assert.deepEqual(contract.normalizedResult, { status: true });
  assert.equal(contract.rawOutputReported, false);
  assert.deepEqual(contract.requiredEnvelopeFields, [
    "type=result",
    "subtype=success",
    "is_error=false",
    "num_turns=integer_1_to_2",
    "total_cost_usd=finite_0_to_0.10",
    "structured_output=exact_status_true",
  ]);
});
