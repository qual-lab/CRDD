/**
 * Workbench助言のProvider出力抽出契約を検証する。
 *
 * @packageDocumentation
 * @responsibility Codex JSONLとClaude Envelopeから助言JSONだけを抽出し、Tool Event・失敗・曖昧出力を拒否する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Provider固有Transportと共通助言Normalizerの局所境界。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { DOCKER_PROCESS_CONTROLLER_PUBLIC_COMPLETION_REASONS } from "../../src/security/docker-process-controller-result-reasons.ts";
import {
  extractWorkbenchAiAdviceProviderOutput,
  WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_REASONS,
} from "../../src/security/workbench-ai-advice-provider-output.ts";

const ADVICE = Object.freeze({
  contract: "crdd-coordinator/workbench-ai-advice-result",
  contractRevision: 1,
  status: "completed",
  facts: Object.freeze([
    Object.freeze({ text: "現在値", references: ["PROJECT_CONTEXT.md"] }),
  ]),
  sharedAnalysis: Object.freeze([]),
  additionalInferences: Object.freeze([]),
  nextOptions: Object.freeze([]),
});

/**
 * 助言抽出の全拒否理由を閉じた公開語彙へ接続する。
 *
 * @responsibility 六つの独立した拒否入力から実際の理由集合を取得し、宣言集合と公開集合の欠落を検出する。
 * @trace ERB-UT-023
 * @precondition 不正入力、JSONL、Tool EventおよびClaude Envelopeの固定反例を用意する。
 * @stimulus 各反例を実抽出器へ渡して拒否理由を取得する。
 * @observation 状態、理由、結果本文の不存在と公開Registryのexact inclusionを観測する。
 * @oracle 観測した六理由が宣言集合と一致し、全件が公開可能で、同prefix自由文は含まれない。
 * @cleanup N/A: 文字列と不変Registryだけを扱い外部資源を作らない。
 * @boundary ERB-UT-023=Direct Boundary: Provider出力抽出→固定診断語彙
 */
test("助言抽出の全拒否理由を閉じた公開語彙へ接続する", () => {
  const cases = [
    ["codex", ""],
    ["codex", "not-json"],
    ["codex", JSON.stringify({ type: "turn.failed" })],
    [
      "codex",
      [
        { type: "item.completed", item: { type: "command_execution" } },
        { type: "turn.completed" },
      ]
        .map((event) => JSON.stringify(event))
        .join("\n"),
    ],
    ["codex", JSON.stringify({ type: "turn.completed" })],
    ["claude", "{}"],
  ] as const;
  const observed = new Set<string>();
  for (const [provider, raw] of cases) {
    const result = extractWorkbenchAiAdviceProviderOutput(provider, raw);
    assert.equal(result.status, "blocked");
    assert.equal(result.adviceJson, null);
    assert.equal(result.rawOutputReported, false);
    assert.ok(typeof result.reason === "string");
    observed.add(result.reason);
  }
  assert.equal(observed.size, 6);
  assert.deepEqual(
    [...observed].sort(),
    [...WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_REASONS].sort(),
  );
  const publicReasons = new Set<string>(
    DOCKER_PROCESS_CONTROLLER_PUBLIC_COMPLETION_REASONS,
  );
  for (const reason of observed)
    assert.equal(publicReasons.has(reason), true, reason);
  assert.equal(
    publicReasons.has("workbench_ai_caller_controlled_secret"),
    false,
  );
});

/**
 * Codex JSONLからToolなしの唯一の最終本文を抽出するを検証する。
 *
 * @responsibility Codex JSONLからToolなしの唯一の最終本文を抽出するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Codex JSONLからToolなしの唯一の最終本文を抽出するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Codex JSONLからToolなしの唯一の最終本文を抽出する", () => {
  const raw = [
    JSON.stringify({ type: "thread.started", thread_id: "secret" }),
    JSON.stringify({ type: "turn.started" }),
    JSON.stringify({
      type: "item.completed",
      item: { type: "agent_message", text: JSON.stringify(ADVICE) },
    }),
    JSON.stringify({ type: "turn.completed" }),
  ].join("\n");
  const result = extractWorkbenchAiAdviceProviderOutput("codex", raw);
  assert.equal(result.status, "confirmed");
  assert.equal(result.adviceJson, JSON.stringify(ADVICE));
  assert.equal("thread_id" in result, false);
  assert.equal(result.rawOutputReported, false);
});

/**
 * CodexのCommand／File Change Eventを拒否するを検証する。
 *
 * @responsibility CodexのCommand／File Change Eventを拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus CodexのCommand／File Change Eventを拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("CodexのCommand／File Change Eventを拒否する", () => {
  for (const itemType of ["command_execution", "file_change"]) {
    const raw = [
      JSON.stringify({ type: "turn.started" }),
      JSON.stringify({
        type: "item.completed",
        item: { type: itemType, status: "completed" },
      }),
      JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: JSON.stringify(ADVICE) },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");
    const result = extractWorkbenchAiAdviceProviderOutput("codex", raw);
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "workbench_ai_codex_tool_event_forbidden");
    assert.equal(result.adviceJson, null);
  }
});

/**
 * Codexの失敗Turnと複数最終本文を拒否するを検証する。
 *
 * @responsibility Codexの失敗Turnと複数最終本文を拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Codexの失敗Turnと複数最終本文を拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Codexの失敗Turnと複数最終本文を拒否する", () => {
  for (const raw of [
    [
      JSON.stringify({ type: "turn.started" }),
      JSON.stringify({ type: "turn.failed" }),
    ].join("\n"),
    [
      JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: JSON.stringify(ADVICE) },
      }),
      JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: JSON.stringify(ADVICE) },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n"),
  ]) {
    assert.equal(
      extractWorkbenchAiAdviceProviderOutput("codex", raw).status,
      "blocked",
    );
  }
});

/**
 * Claude成功Envelopeからstructured_outputだけを抽出するを検証する。
 *
 * @responsibility Claude成功Envelopeからstructured_outputだけを抽出するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Claude成功Envelopeからstructured_outputだけを抽出するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Claude成功Envelopeからstructured_outputだけを抽出する", () => {
  const result = extractWorkbenchAiAdviceProviderOutput(
    "claude",
    JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      num_turns: 1,
      total_cost_usd: 0.01,
      session_id: "secret-session",
      usage: { input_tokens: 1, output_tokens: 2 },
      structured_output: ADVICE,
    }),
  );
  assert.equal(result.status, "confirmed");
  assert.equal(result.adviceJson, JSON.stringify(ADVICE));
  assert.equal("session_id" in result, false);
  assert.equal("total_cost_usd" in result, false);
  assert.equal(result.rawOutputReported, false);
});

/**
 * ClaudeのError、複数Turn、Cost不正および出力欠落を拒否するを検証する。
 *
 * @responsibility ClaudeのError、複数Turn、Cost不正および出力欠落を拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus ClaudeのError、複数Turn、Cost不正および出力欠落を拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("ClaudeのError、複数Turn、Cost不正および出力欠落を拒否する", () => {
  for (const overrides of [
    { is_error: true },
    { num_turns: 2 },
    { total_cost_usd: -1 },
    { structured_output: undefined },
  ]) {
    const result = extractWorkbenchAiAdviceProviderOutput(
      "claude",
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        num_turns: 1,
        total_cost_usd: 0,
        structured_output: ADVICE,
        ...overrides,
      }),
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.adviceJson, null);
  }
});
