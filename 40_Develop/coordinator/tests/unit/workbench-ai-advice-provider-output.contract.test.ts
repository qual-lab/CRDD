/**
 * Workbench助言のProvider出力抽出契約を検証する。
 *
 * @packageDocumentation
 * @responsibility Codex JSONLとClaude Envelopeから助言JSONだけを抽出し、未知通知・失敗・曖昧出力を拒否する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Provider固有Transportと共通助言Normalizerの局所境界。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { dockerProcessControllerPublicCompletionReasons } from "../../src/docker-runtime/docker-process-controller-result-reasons.ts";
import { coordinatorTaskPublicReasons } from "../../src/task/coordinator-task-result-reasons.ts";
import {
  extractWorkbenchAiAdviceProviderOutput,
  WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_REASONS,
} from "../../src/workbench-ai/workbench-ai-advice-provider-output.ts";

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
 * @responsibility 各独立した拒否入力から実際の理由集合を取得し、宣言集合と公開集合の欠落を検出する。
 * @trace ERB-UT-023
 * @precondition 不正入力、JSONL、Tool EventおよびClaude Envelopeの固定反例を用意する。
 * @stimulus 各反例を実抽出器へ渡して拒否理由を取得する。
 * @observation 状態、理由、結果本文の不存在と公開Registryのexact inclusionを観測する。
 * @oracle 観測した全理由が宣言集合と一致し、全件が公開可能で、同prefix自由文は含まれない。
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
        { type: "item.completed", item: { type: "unknown_item" } },
        { type: "turn.completed" },
      ]
        .map((event) => JSON.stringify(event))
        .join("\n"),
    ],
    ["codex", JSON.stringify({ type: "turn.completed" })],
    ["claude", "null"],
    ["claude", "{}"],
    ["claude", '{"type":"result","subtype":"success","is_error":false}'],
    [
      "claude",
      '{"type":"result","subtype":"success","is_error":false,"num_turns":1}',
    ],
    [
      "claude",
      '{"type":"result","subtype":"success","is_error":false,"num_turns":1,"total_cost_usd":0}',
    ],
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
  assert.equal(observed.size, 10);
  assert.deepEqual(
    [...observed].sort(),
    [...WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_REASONS].sort(),
  );
  const publicReasons = new Set<string>(
    dockerProcessControllerPublicCompletionReasons,
  );
  for (const reason of observed)
    assert.equal(publicReasons.has(reason), true, reason);
  for (const reason of observed)
    assert.equal(
      new Set<string>(coordinatorTaskPublicReasons).has(reason),
      true,
      reason,
    );
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
 * Codexの未知・不正Itemを拒否する。
 *
 * @responsibility 公式Schema外のItemとErrorを最終回答へ混入させない。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus CodexのCommand／File Change Eventを拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Codexの未知・不正Itemを拒否する", () => {
  for (const itemType of ["unknown_item", "error", "warning"]) {
    for (const eventType of [
      "item.started",
      "item.updated",
      "item.completed",
    ]) {
      const raw = [
        JSON.stringify({ type: "turn.started" }),
        JSON.stringify({
          type: eventType,
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
  }
});

/**
 * 公式CLIの既知通知を非公開のまま最終助言と分離する。
 *
 * @responsibility 内部通知だけを理由に正常な助言を拒否せず、通知本文を公開しない。
 * @trace ERB-UT-023
 * @precondition 公式0.159.2の既知Item種別と一つの最終回答を用意する。
 * @stimulus 各Itemの開始・更新・完了通知を抽出器へ渡す。
 * @observation 受理結果と最終助言JSONだけの返却を観測する。
 * @oracle 既知通知があっても唯一の最終本文だけを返し、通知だけでは成功しない。
 * @cleanup N/A: 局所文字列処理だけで外部資源を作らない。
 * @boundary ERB-UT-023=Direct Boundary: 公式JSONL→助言抽出
 */
test("公式CLIの既知通知を最終助言と分離する", () => {
  for (const type of [
    "command_execution",
    "file_change",
    "mcp_tool_call",
    "collab_tool_call",
    "web_search",
    "todo_list",
  ]) {
    for (const eventType of [
      "item.started",
      "item.updated",
      "item.completed",
    ]) {
      const events = [
        {
          type: eventType,
          item: { type, status: "completed", text: "private-marker" },
        },
        { type: "turn.completed" },
      ];
      const missing = extractWorkbenchAiAdviceProviderOutput(
        "codex",
        events.map((event) => JSON.stringify(event)).join("\n"),
      );
      assert.equal(missing.status, "blocked");
      events.unshift({
        type: "item.completed",
        item: {
          type: "agent_message",
          status: "completed",
          text: JSON.stringify(ADVICE),
        },
      });
      const result = extractWorkbenchAiAdviceProviderOutput(
        "codex",
        events.map((event) => JSON.stringify(event)).join("\n"),
      );
      assert.equal(result.status, "confirmed");
      assert.equal(result.adviceJson, JSON.stringify(ADVICE));
      assert.equal(JSON.stringify(result).includes("private-marker"), false);
    }
  }
});

/**
 * 正常な思考通知を最終助言と分離する。
 *
 * @responsibility 思考通知をTool操作へ誤分類せず、思考本文を返却しないことを確認する。
 * @trace ERB-UT-023
 * @precondition 思考本文に助言JSONと非公開markerを含む固定通知を用意する。
 * @stimulus 開始、更新、完了の思考通知と一つの最終回答を抽出器へ渡す。
 * @observation 受理結果、助言JSONと非公開markerの不存在を観測する。
 * @oracle 最終回答だけを返し、思考通知だけでは成功しない。
 * @cleanup N/A: 局所文字列処理だけで外部資源を作らない。
 * @boundary ERB-UT-023=Direct Boundary: Codex JSONL→助言抽出
 */
test("正常な思考通知を非公開のまま最終助言と分離する", () => {
  const reasoningEvents = [
    "item.started",
    "item.updated",
    "item.completed",
  ].map((type) => ({
    type,
    item: {
      type: "reasoning",
      text: `private-marker ${JSON.stringify(ADVICE)}`,
    },
  }));
  const raw = [
    ...reasoningEvents,
    {
      type: "item.completed",
      item: { type: "agent_message", text: JSON.stringify(ADVICE) },
    },
    { type: "turn.completed" },
  ]
    .map((event) => JSON.stringify(event))
    .join("\n");
  const result = extractWorkbenchAiAdviceProviderOutput("codex", raw);
  assert.equal(result.status, "confirmed");
  assert.equal(result.adviceJson, JSON.stringify(ADVICE));
  assert.equal(JSON.stringify(result).includes("private-marker"), false);
  assert.equal(result.rawOutputReported, false);
  const reasoningOnly = [...reasoningEvents, { type: "turn.completed" }]
    .map((event) => JSON.stringify(event))
    .join("\n");
  assert.equal(
    extractWorkbenchAiAdviceProviderOutput("codex", reasoningOnly).status,
    "blocked",
  );
});

/**
 * 正常回答があっても不正通知を無視しない。
 *
 * @responsibility 不正Itemと不正本文を正常回答によって隠せないことを確認する。
 * @trace ERB-UT-023
 * @precondition 欠落、null、配列、本文欠落と未知Item通知の反例を用意する。
 * @stimulus 各反例を正常な最終回答と同じJSONLへ入れる。
 * @observation 状態、拒否理由と助言本文の不存在を観測する。
 * @oracle 全反例がblockedで、正常回答を部分公開しない。
 * @cleanup N/A: 局所文字列処理だけで外部資源を作らない。
 * @boundary ERB-UT-023=Direct Boundary: Codex JSONL→助言抽出
 */
test("正常回答があっても不正Itemと不正本文を無視しない", () => {
  const invalidEvents = [
    { type: "item.started" },
    { type: "item.updated", item: null },
    { type: "item.completed", item: [] },
    { type: "item.completed", item: { type: "agent_message" } },
    { type: "item.completed", item: { type: "agent_message", text: 42 } },
    { type: "item.future", item: { type: "reasoning", text: "text" } },
  ];
  for (const invalid of invalidEvents) {
    const raw = [
      invalid,
      {
        type: "item.completed",
        item: { type: "agent_message", text: JSON.stringify(ADVICE) },
      },
      { type: "turn.completed" },
    ]
      .map((event) => JSON.stringify(event))
      .join("\n");
    const result = extractWorkbenchAiAdviceProviderOutput("codex", raw);
    assert.equal(result.status, "blocked");
    assert.equal(result.adviceJson, null);
    assert.equal(result.rawOutputReported, false);
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
  for (const numberOfTurns of [1, 2]) {
    const result = extractWorkbenchAiAdviceProviderOutput(
      "claude",
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        num_turns: numberOfTurns,
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
  }
});

/**
 * ClaudeのError、Turn上限外、Cost不正および出力欠落を拒否するを検証する。
 *
 * @responsibility ClaudeのError、Turn上限外、Cost不正および出力欠落を拒否する検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus ClaudeのError、Turn上限外、Cost不正および出力欠落を拒否する対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("ClaudeのError、Turn上限外、Cost不正および出力欠落を拒否する", () => {
  for (const overrides of [
    { is_error: true },
    { num_turns: 0 },
    { num_turns: 3 },
    { num_turns: -1 },
    { num_turns: 1.5 },
    { num_turns: "2" },
    { num_turns: null },
    { num_turns: undefined },
    { num_turns: Number.NaN },
    { num_turns: Number.POSITIVE_INFINITY },
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

/**
 * Claude拒否層の優先順と受理集合の不変を確認する。
 *
 * @responsibility 固定理由の細分化が受理条件や秘密情報の公開を変えないことを検証する。
 * @trace ERB-UT-023
 * @precondition 成功Envelopeと各層の単独・複合反例を用意する。
 * @stimulus 反例および成功条件の組合せを実抽出器へ渡す。
 * @observation 拒否理由、助言本文不存在、metadata非公開と成功集合を観測する。
 * @oracle 最初の不成立層だけを返し、旧七条件と受理結果が一致する。
 * @cleanup N/A: 局所のJSON解析だけで外部資源を作らない。
 * @boundary ERB-UT-023=Direct Boundary: Claude Envelope→固定理由→公開理由集合
 */
test("Claude拒否層は先頭不成立だけを返し受理集合を変えない", () => {
  const baseline = {
    type: "result",
    subtype: "success",
    is_error: false,
    num_turns: 1,
    total_cost_usd: 0,
    structured_output: ADVICE,
    session_id: "private-marker",
  };
  const cases: readonly (readonly [Record<string, unknown>, string])[] = [
    [{ type: "private-marker" }, "completion_invalid"],
    [{ subtype: "private-marker" }, "completion_invalid"],
    [{ is_error: true }, "completion_invalid"],
    [{ num_turns: 3 }, "turn_count_invalid"],
    [{ num_turns: "private-marker" }, "turn_count_invalid"],
    [{ total_cost_usd: -1 }, "metadata_invalid"],
    [{ total_cost_usd: "private-marker" }, "metadata_invalid"],
    [{ structured_output: undefined }, "structured_output_invalid"],
    [{ structured_output: [] }, "structured_output_invalid"],
    [{ structured_output: "private-marker" }, "structured_output_invalid"],
    [
      {
        is_error: true,
        num_turns: 3,
        total_cost_usd: -1,
        structured_output: null,
      },
      "completion_invalid",
    ],
    [
      { num_turns: 3, total_cost_usd: -1, structured_output: null },
      "turn_count_invalid",
    ],
    [{ total_cost_usd: -1, structured_output: null }, "metadata_invalid"],
  ];
  for (const [overrides, suffix] of cases) {
    const result = extractWorkbenchAiAdviceProviderOutput(
      "claude",
      JSON.stringify({ ...baseline, ...overrides }),
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, `workbench_ai_claude_${suffix}`);
    assert.equal(result.adviceJson, null);
    assert.equal(JSON.stringify(result).includes("private-marker"), false);
  }
  for (const raw of ["null", "[]", "not-json"])
    assert.equal(
      extractWorkbenchAiAdviceProviderOutput("claude", raw).reason,
      "workbench_ai_claude_envelope_invalid",
    );
  for (const type of ["result", "other"])
    for (const subtype of ["success", "error"])
      for (const isError of [false, true])
        for (const turnCount of [1, 2, 0, 3, 1.5, "2", null])
          for (const totalCostUsd of [0, -1, "0", null])
            for (const structuredOutput of [ADVICE, null, []]) {
              const result = extractWorkbenchAiAdviceProviderOutput(
                "claude",
                JSON.stringify({
                  type,
                  subtype,
                  is_error: isError,
                  num_turns: turnCount,
                  total_cost_usd: totalCostUsd,
                  structured_output: structuredOutput,
                }),
              );
              const wasPreviouslyAccepted =
                type === "result" &&
                subtype === "success" &&
                isError === false &&
                typeof turnCount === "number" &&
                Number.isInteger(turnCount) &&
                turnCount >= 1 &&
                turnCount <= 2 &&
                typeof totalCostUsd === "number" &&
                Number.isFinite(totalCostUsd) &&
                totalCostUsd >= 0 &&
                structuredOutput === ADVICE;
              assert.equal(
                result.status === "confirmed",
                wasPreviouslyAccepted,
              );
            }
});
