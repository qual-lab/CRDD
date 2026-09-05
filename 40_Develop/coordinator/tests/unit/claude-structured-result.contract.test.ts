import assert from "node:assert/strict";
import test from "node:test";

import {
  describeClaudeStructuredResultContract,
  normalizeClaudeStructuredResult,
} from "../../src/security/claude-structured-result.ts";

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

test("Claude JSON Envelopeからexact boolean Resultだけを正規化する", () => {
  const result = normalizeClaudeStructuredResult(`${createEnvelope()}\n`);
  assert.equal(result.status, "confirmed");
  assert.deepEqual(result.normalizedResult, { status: true });
  assert.equal(result.numberOfTurns, 2);
  assert.equal(result.providerReportedApiEquivalentCostUsd, 0.04699);
  assert.equal("sessionId" in result, false);
  assert.equal("rawOutput" in result, false);
});

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
