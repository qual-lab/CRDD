/**
 * 非0終了の分類を出力媒体・容量・曖昧性の境界で検証する。
 * @packageDocumentation
 * @responsibility 生本文を返さず固定理由だけを導出する。
 * @trace ERB-UT-032
 * @level UT
 * @scope Codex JSONLと既存stderr／Claudeの分類。
 * @boundary 外部Process・通信なし。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { convertProviderError } from "../../../src/provider/error.ts";

/**
 * 正式エラーイベントだけを既存理由へ分類する。
 * @trace ERB-UT-032
 * @precondition 合成本文のみ。
 * @stimulus error、turn.failed、通常回答、未知・曖昧・過大入力。
 * @observation 固定理由。
 * @oracle stderr優先、異常形はgeneric、秘密の本文非返却。
 * @cleanup N/A: 純粋同期処理。
 * @responsibility 正式エラーイベントだけを既存理由へ分類する。
 * @boundary Provider出力の合成値と固定分類。Process・通信なし。
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
      convertProviderError("codex", { stdout, stderr: "" }).reason,
      "provider_invocation_rejected",
    );
  assert.equal(
    convertProviderError("codex", {
      stdout: failed,
      stderr: "authentication failed",
    }).reason,
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
      convertProviderError("codex", { stdout, stderr: "" }).reason,
      "provider_process_exit_nonzero",
    );
  for (const stderr of ["\0", "x".repeat(8193)])
    assert.equal(
      convertProviderError("codex", { stdout: error, stderr }).reason,
      "provider_process_exit_nonzero",
    );
  assert.equal(
    convertProviderError("claude", { stdout: error, stderr: "" }).reason,
    "provider_process_exit_nonzero",
  );
  assert.equal(
    convertProviderError("claude", {
      stdout: JSON.stringify({ type: "result", subtype: "error_max_turns" }),
      stderr: "",
    }).reason,
    "provider_turn_limit_exceeded",
  );
  for (const provider of ["codex", "claude"] as const) {
    const result = convertProviderError(provider, {
      stdout: "synthetic-secret",
      stderr: "authentication failed synthetic-secret",
    });
    assert.deepEqual(result, {
      provider,
      reason: "provider_authentication_expired",
    });
    assert.equal(Object.isFrozen(result), true);
  }
});

/**
 * Claudeの実行失敗JSONだけを既存理由へ変換する。
 * @responsibility stderr・既知subtypeの優先と本文非返却を確認する。
 * @trace ERB-UT-032
 * @precondition 合成入力だけを使用する。
 * @stimulus 既知の失敗説明、複数説明、競合するstderrと上限subtype。
 * @observation 共通エラーの理由・field・不変性。
 * @oracle 理由は既存閉集合だけで、本文・秘密値を返さない。
 * @cleanup N/A: 純粋同期処理。
 * @boundary 外部AI・Process・保存なし。
 */
test("Claude非0終了は有界な実行失敗JSONを既存理由へ変換する", () => {
  const encode = (
    errors: readonly string[],
    subtype = "error_during_execution",
  ) => JSON.stringify({ type: "result", subtype, is_error: true, errors });
  for (const [message, reason] of [
    ["quota exceeded", "provider_subscription_quota_exhausted"],
    ["authentication failed", "provider_authentication_expired"],
    ["unsupported model", "provider_invocation_rejected"],
    ["proxy connection failed", "provider_network_unavailable"],
    ["HTTP 503", "provider_service_unavailable"],
    ["unclassified failure", "provider_process_exit_nonzero"],
  ] as const) {
    const result = convertProviderError("claude", {
      stdout: encode([`${message} synthetic-secret`]),
      stderr: "",
    });
    assert.deepEqual(result, { provider: "claude", reason });
    assert.equal(Object.isFrozen(result), true);
    assert.equal(JSON.stringify(result).includes("synthetic-secret"), false);
  }
  assert.equal(
    convertProviderError("claude", {
      stdout: encode(["authentication failed", "quota exceeded"]),
      stderr: "",
    }).reason,
    "provider_subscription_quota_exhausted",
  );
  assert.equal(
    convertProviderError("claude", {
      stdout: encode(["quota exceeded"]),
      stderr: "authentication failed",
    }).reason,
    "provider_authentication_expired",
  );
  for (const [subtype, reason] of [
    ["error_max_budget_usd", "provider_operation_budget_exceeded"],
    ["error_max_turns", "provider_turn_limit_exceeded"],
    [
      "error_max_structured_output_retries",
      "provider_structured_output_retry_exhausted",
    ],
  ] as const)
    assert.equal(
      convertProviderError("claude", {
        stdout: encode(["quota exceeded"], subtype),
        stderr: "authentication failed",
      }).reason,
      reason,
    );
  const prefix = "authentication failed";
  const message = prefix + "x".repeat(8_192 - Buffer.byteLength(prefix));
  assert.equal(
    convertProviderError("claude", { stdout: encode([message]), stderr: "" })
      .reason,
    "provider_authentication_expired",
  );
  assert.equal(
    convertProviderError("claude", {
      stdout: encode([
        prefix,
        "x".repeat(8_192 - Buffer.byteLength(prefix) - 1),
      ]),
      stderr: "",
    }).reason,
    "provider_authentication_expired",
  );
  const messages = [...Array(127).fill("x"), prefix];
  assert.equal(
    convertProviderError("claude", { stdout: encode(messages), stderr: "" })
      .reason,
    "provider_authentication_expired",
  );
  const base = JSON.stringify({
    type: "result",
    subtype: "error_during_execution",
    is_error: true,
    errors: [prefix],
    padding: "",
  });
  const exact = base.replace(
    '"padding":""',
    `"padding":"${"x".repeat(65_536 - Buffer.byteLength(base))}"`,
  );
  assert.equal(Buffer.byteLength(exact), 65_536);
  assert.equal(
    convertProviderError("claude", { stdout: exact, stderr: "" }).reason,
    "provider_authentication_expired",
  );
  assert.equal(
    convertProviderError("claude", { stdout: ` ${exact}`, stderr: "" }).reason,
    "provider_process_exit_nonzero",
  );
});

/**
 * Claudeの未知・曖昧・過大な入力を説明として利用しない。
 * @responsibility 通常回答の誤分類とエラー説明の容量逸脱を防ぐ。
 * @trace ERB-UT-032
 * @precondition 合成入力だけを使用する。
 * @stimulus 件数・UTF-8容量境界、不正JSON、深いJSON、未知Envelope。
 * @observation 固定理由と例外の不在。
 * @oracle 不正stdoutは分類に使わず、既知stderrの判定は維持する。
 * @cleanup N/A: 純粋同期処理。
 * @boundary 外部AI・Process・保存なし。
 */
test("Claude非0終了は通常回答・未知形・不正なエラー説明を分類に使わない", () => {
  const envelope = {
    type: "result",
    subtype: "error_during_execution",
    is_error: true,
    errors: ["authentication failed"],
  };
  const encode = (changes: Record<string, unknown>) =>
    JSON.stringify({ ...envelope, ...changes });
  for (const stdout of [
    encode({ type: "assistant" }),
    encode({ subtype: "success" }),
    encode({ subtype: "future_error" }),
    encode({ is_error: false }),
    encode({ is_error: undefined }),
    encode({ errors: undefined }),
    encode({ errors: [], result: "authentication failed" }),
    encode({ errors: "authentication failed" }),
    encode({ errors: [42] }),
    encode({ errors: [null] }),
    encode({ errors: [{}] }),
    encode({ errors: [""] }),
    encode({ errors: ["authentication failed\0"] }),
    encode({ errors: ["authentication failed", "x".repeat(8_193)] }),
    encode({ errors: ["authentication failed", "あ".repeat(2_731)] }),
    encode({
      errors: [
        "authentication failed",
        "x".repeat(8_192 - Buffer.byteLength("authentication failed")),
      ],
    }),
    encode({ errors: Array(129).fill("authentication failed") }),
    '{"type":"result","subtype":"error_during_execution","is_error":true,"errors":["authentication failed"],"errors":["network error"]}',
    `${JSON.stringify(envelope)}\n{}`,
    `${JSON.stringify(envelope)}\0`,
    "not-json",
    `${"[".repeat(8_000)}0${"]".repeat(8_000)}`,
  ]) {
    assert.equal(
      convertProviderError("claude", { stdout, stderr: "" }).reason,
      "provider_process_exit_nonzero",
    );
    assert.equal(
      convertProviderError("claude", {
        stdout,
        stderr: "authentication failed",
      }).reason,
      "provider_authentication_expired",
    );
  }
  for (const stderr of ["\0", "x".repeat(8_193)])
    assert.equal(
      convertProviderError("claude", {
        stdout: JSON.stringify(envelope),
        stderr,
      }).reason,
      "provider_process_exit_nonzero",
    );
});
