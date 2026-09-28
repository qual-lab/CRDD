/**
 * Workbench助言のProvider出力抽出契約を検証する。
 *
 * @responsibility Codex JSONLとClaude Envelopeから助言JSONだけを抽出し、Tool Event・失敗・曖昧出力を拒否する。
 * @trace ERB-UT-023 ERB-IT-004
 * @boundary Provider固有Transportと共通助言Normalizerの局所境界。
 * @effect 外部Provider、Process、FilesystemおよびNetworkを使用しない。
 * @security 生Provider metadata、Session ID、CommandおよびPathを公開しない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { extractWorkbenchAiAdviceProviderOutput } from "../../src/security/workbench-ai-advice-provider-output.ts";

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
