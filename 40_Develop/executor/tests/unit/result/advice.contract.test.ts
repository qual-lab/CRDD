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
  const advice = JSON.stringify({
    status: "completed",
    facts: [{ text: "Synthetic fact.", references: ["synthetic-context"] }],
    sharedAnalysis: [],
    additionalInferences: [],
    nextOptions: [],
  });
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
    const result = normalizeProviderAdviceOutput(provider, raw, [
      "synthetic-context",
    ]);
    assert.equal(result.status, "confirmed", provider);
    assert.equal(result.normalizedResult?.status, "completed");
    assert.equal("thread_id" in result, false);
    assert.equal("raw" in result, false);
    const rejected = normalizeProviderAdviceOutput(provider, "not-json", [
      "synthetic-context",
    ]);
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.normalizedResult, null);
    assert.ok(typeof rejected.reason === "string");
  }
});
