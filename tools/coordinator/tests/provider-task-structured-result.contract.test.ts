import assert from "node:assert/strict";
import test from "node:test";

import {
  describeProviderTaskStructuredResultContract,
  normalizeProviderTaskStructuredResult,
} from "../src/security/provider-task-structured-result.ts";

const executor = JSON.stringify({
  status: "completed",
  summary: "Updated the isolated fixture.",
  changedPaths: ["fixture.txt"],
  verification: ["Reviewed the resulting file."],
});
const reviewer = JSON.stringify({
  decision: "changes_requested",
  summary: "One issue remains.",
  findings: [
    { severity: "medium", path: "fixture.txt", message: "Clarify the value." },
  ],
});

function claude(structuredOutput: unknown, overrides = {}) {
  return JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    num_turns: 3,
    total_cost_usd: 0.12,
    structured_output: structuredOutput,
    ...overrides,
  });
}

test("Codex ExecutorとClaude Reviewerのexact Resultを正規化する", () => {
  const codex = normalizeProviderTaskStructuredResult(
    "codex",
    "executor",
    executor,
  );
  assert.equal(codex.status, "confirmed");
  assert.deepEqual(codex.normalizedResult, JSON.parse(executor));
  const claudeResult = normalizeProviderTaskStructuredResult(
    "claude",
    "reviewer",
    claude(JSON.parse(reviewer)),
  );
  assert.equal(claudeResult.status, "confirmed");
  assert.deepEqual(claudeResult.normalizedResult, JSON.parse(reviewer));
});

test("Reviewer decisionとfinding件数の矛盾、余分field、path traversalを拒否する", () => {
  for (const value of [
    { decision: "approved", summary: "ok", findings: [{ severity: "low", path: "a", message: "x" }] },
    { decision: "changes_requested", summary: "bad", findings: [] },
    { decision: "approved", summary: "ok", findings: [], extra: true },
    { decision: "changes_requested", summary: "bad", findings: [{ severity: "high", path: "../auth.json", message: "x" }] },
  ]) {
    assert.equal(
      normalizeProviderTaskStructuredResult("codex", "reviewer", JSON.stringify(value)).status,
      "blocked",
    );
  }
});

test("Claude turn／cost上限、重複JSON key、複数documentと巨大出力を拒否する", () => {
  assert.equal(
    normalizeProviderTaskStructuredResult(
      "claude",
      "executor",
      claude(JSON.parse(executor), { num_turns: 9 }),
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeProviderTaskStructuredResult(
      "claude",
      "executor",
      claude(JSON.parse(executor), { total_cost_usd: 0.51 }),
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeProviderTaskStructuredResult(
      "codex",
      "executor",
      '{"status":"completed","status":"completed","summary":"x","changedPaths":[],"verification":[]}',
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeProviderTaskStructuredResult("codex", "executor", `${executor}\n{}`).status,
    "blocked",
  );
  assert.equal(
    normalizeProviderTaskStructuredResult("codex", "executor", "x".repeat(65_537)).status,
    "blocked",
  );
});

test("公開契約は両Provider、両Role、上限とraw非公開を固定する", () => {
  const contract = describeProviderTaskStructuredResultContract();
  assert.equal(contract.contractRevision, 1);
  assert.deepEqual(contract.providers, ["codex", "claude"]);
  assert.deepEqual(contract.roles, ["executor", "reviewer"]);
  assert.equal(contract.claudeMaximumTurns, 8);
  assert.equal(contract.claudeMaximumApiEquivalentCostUsd, 0.5);
  assert.equal(contract.rawOutputReported, false);
});
