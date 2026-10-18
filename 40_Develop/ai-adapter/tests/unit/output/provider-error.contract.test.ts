/**
 * 非0終了の分類を出力媒体・容量・曖昧性の境界で検証する。
 * @responsibility 生本文を返さず固定理由だけを導出する。
 * @trace ERB-UT-032
 * @level UT
 * @scope Codex JSONLと既存stderr／Claudeの分類。
 * @boundary 外部Process・通信なし。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { classifyProviderNonzeroExit } from "../../../src/output/provider-error.ts";

/**
 * 正式エラーイベントだけを既存理由へ分類する。
 * @trace ERB-UT-032
 * @precondition 合成本文のみ。
 * @stimulus error、turn.failed、通常回答、未知・曖昧・過大入力。
 * @observation 固定理由。
 * @oracle stderr優先、異常形はgeneric、秘密の本文非返却。
 * @cleanup N/A: 純粋同期処理。
 */
test("Codex非0終了は有界な構造化エラーだけを分類する", () => {
  const error = JSON.stringify({
    type: "error",
    message: "unexpected argument '--approve-for-me' found",
  });
  const failed = JSON.stringify({
    type: "turn.failed",
    error: { message: "unsupported model: synthetic-secret" },
  });
  for (const stdout of [
    error,
    `${JSON.stringify({ type: "thread.started", thread_id: "synthetic" })}\n${failed}\n`,
  ])
    assert.equal(
      classifyProviderNonzeroExit("codex", { stdout, stderr: "" }),
      "provider_invocation_rejected",
    );
  assert.equal(
    classifyProviderNonzeroExit("codex", {
      stdout: failed,
      stderr: "authentication failed",
    }),
    "provider_authentication_expired",
  );
  for (const stdout of [
    JSON.stringify({
      type: "item.completed",
      item: { type: "agent_message", text: "unsupported model" },
    }),
    JSON.stringify({ type: "future.error", message: "unsupported model" }),
    '{"type":"error","message":"unsupported model","message":"network error"}',
    JSON.stringify({ type: "error", message: 42 }),
    JSON.stringify({ type: "turn.failed", error: "unsupported model" }),
    `${error}\nnot-json`,
    JSON.stringify({
      type: "error",
      message: `unsupported model${"x".repeat(8192)}`,
    }),
    Array(129).fill(error).join("\n"),
    `${" ".repeat(65_537)}${error}`,
    `${error}\0`,
  ])
    assert.equal(
      classifyProviderNonzeroExit("codex", { stdout, stderr: "" }),
      "provider_process_exit_nonzero",
    );
  for (const stderr of ["\0", "x".repeat(8193)])
    assert.equal(
      classifyProviderNonzeroExit("codex", { stdout: error, stderr }),
      "provider_process_exit_nonzero",
    );
  assert.equal(
    classifyProviderNonzeroExit("claude", { stdout: error, stderr: "" }),
    "provider_process_exit_nonzero",
  );
  assert.equal(
    classifyProviderNonzeroExit("claude", {
      stdout: JSON.stringify({ type: "result", subtype: "error_max_turns" }),
      stderr: "",
    }),
    "provider_turn_limit_exceeded",
  );
});
