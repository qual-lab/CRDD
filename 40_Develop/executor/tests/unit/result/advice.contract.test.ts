/**
 * 読取り助言結果の許可参照・閉形式・公開契約を検査する。
 * @packageDocumentation
 * @responsibility Coordinatorの受付やPacketを使わず結果契約を反証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 純粋な結果値。実AI・Docker・保存なし。
 * @boundary ExecutorのResult公開API。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProviderAdviceOutput } from "../../../src/result/advice.ts";
import {
  describeAdviceResultContract,
  normalizeAdviceResult,
  PROVIDER_ADVICE_RESULT_CONTRACT,
} from "../../../src/index.ts";

/**
 * 両ProviderのEnvelope変換と拒否を同じ内部契約へ拘束する。
 * @responsibility 生Envelopeを結果へ残さず、失敗理由を維持する。
 * @trace ERB-UT-023
 * @precondition 合成の助言JSONとProvider別Envelopeを用意する。
 * @stimulus 正常・不正出力を変換する。
 * @observation 内部契約、本文、拒否理由、余剰fieldの不存在を確認する。
 * @oracle 正常時は助言JSONだけ、拒否時は本文なしを返す。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary ERB-UT-023=Direct Boundary: Envelopeから内部結果。
 */
test("両Providerの助言Envelopeを本文だけへ変換し不正出力を拒否する", () => {
  const advice = JSON.stringify({ status: "completed" });
  const cases = [
    [
      "codex",
      [
        { type: "thread.started", thread_id: "synthetic-session" },
        {
          type: "item.completed",
          item: { type: "agent_message", text: advice },
        },
        { type: "turn.completed" },
      ]
        .map((event) => JSON.stringify(event))
        .join("\n"),
    ],
    [
      "claude",
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        num_turns: 2,
        total_cost_usd: 0,
        structured_output: JSON.parse(advice),
      }),
    ],
  ] as const;
  for (const [provider, raw] of cases) {
    const result = normalizeProviderAdviceOutput(provider, raw);
    assert.equal(result.status, "confirmed", provider);
    assert.deepEqual(result.normalizedResult, {
      contract: "crdd-coordinator/workbench-ai-advice-provider-output",
      contractRevision: 1,
      adviceJson: advice,
    });
    assert.equal("thread_id" in result, false);
    assert.equal("raw" in result, false);
    const rejected = normalizeProviderAdviceOutput(provider, "not-json");
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.normalizedResult, null);
    assert.ok(typeof rejected.reason === "string");
  }
});

/**
 * 読取り助言の単一JSONを許可済み根拠参照へ拘束するを検証する。
 *
 * @responsibility 読取り助言の単一JSONを許可済み根拠参照へ拘束するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 読取り助言の単一JSONを許可済み根拠参照へ拘束するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: Executor Test Source→対象契約
 */
test("読取り助言の単一JSONを許可済み根拠参照へ拘束する", () => {
  const raw = JSON.stringify({
    contract: PROVIDER_ADVICE_RESULT_CONTRACT,
    contractRevision: 1,
    status: "completed",
    facts: [{ text: "現在状態", references: ["PROJECT_CONTEXT.md#current"] }],
    sharedAnalysis: [],
    additionalInferences: [
      { text: "日程リスク", references: ["99_Roadmap/01_Roadmap.md#risk"] },
    ],
    nextOptions: [
      { text: "次の確認", references: ["PROJECT_CONTEXT.md#next"] },
    ],
  });
  const result = normalizeAdviceResult(raw, [
    "PROJECT_CONTEXT.md#current",
    "99_Roadmap/01_Roadmap.md#risk",
    "PROJECT_CONTEXT.md#next",
  ]);
  assert.equal(result.status, "confirmed");
  assert.deepEqual(result.normalizedResult?.facts, [
    { text: "現在状態", references: ["PROJECT_CONTEXT.md#current"] },
  ]);
  assert.equal(result.rawOutputReported, false);
});

/**
 * 読取り投影外参照・根拠なし・曖昧JSONを拒否するを検証する。
 *
 * @responsibility 読取り投影外参照・根拠なし・曖昧JSONを拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 読取り投影外参照・根拠なし・曖昧JSONを拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: Executor Test Source→対象契約
 */
test("読取り投影外参照・根拠なし・曖昧JSONを拒否する", () => {
  const fixture = {
    contract: PROVIDER_ADVICE_RESULT_CONTRACT,
    contractRevision: 1,
    status: "completed",
    facts: [{ text: "現在状態", references: ["PROJECT_CONTEXT.md#current"] }],
    sharedAnalysis: [],
    additionalInferences: [],
    nextOptions: [],
  };
  const allowedResults = ["PROJECT_CONTEXT.md#current"];
  assert.equal(
    normalizeAdviceResult(
      JSON.stringify({
        ...fixture,
        facts: [{ text: "推測", references: ["SECRET.md#unknown"] }],
      }),
      allowedResults,
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeAdviceResult(
      JSON.stringify({
        ...fixture,
        facts: [{ text: "根拠なし", references: [] }],
      }),
      allowedResults,
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeAdviceResult(
      `${JSON.stringify(fixture)}${JSON.stringify(fixture)}`,
      allowedResults,
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeAdviceResult(
      '{"contract":"crdd-coordinator/workbench-ai-advice-result","contract":"duplicate"}',
      allowedResults,
    ).status,
    "blocked",
  );
});

/**
 * 読取り助言結果契約は上限と生出力非公開を固定するを検証する。
 *
 * @responsibility 読取り助言結果契約は上限と生出力非公開を固定するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 読取り助言結果契約は上限と生出力非公開を固定するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: Executor Test Source→対象契約
 */
test("読取り助言結果契約は上限と生出力非公開を固定する", () => {
  const contract = describeAdviceResultContract();
  assert.equal(contract.contractRevision, 1);
  assert.equal(contract.duplicateKeysAllowed, false);
  assert.equal(contract.outOfProjectionReferencesAllowed, false);
  assert.equal(contract.rawOutputReported, false);
});
