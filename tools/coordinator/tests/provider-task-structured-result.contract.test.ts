import assert from "node:assert/strict";
import test from "node:test";

import {
  describeProviderTaskStructuredResultContract,
  normalizeProviderTaskStructuredResult,
} from "../src/security/provider-task-structured-result.ts";

const EXECUTOR = JSON.stringify({
  status: "completed",
  summary: "Updated the isolated fixture.",
  changedPaths: ["fixture.txt"],
  verification: ["Reviewed the resulting file."],
});
const REVIEWER = JSON.stringify({
  decision: "changes_requested",
  summary: "One issue remains.",
  findings: [
    {
      severity: "medium",
      path: "fixture.txt",
      category: "acceptance_criterion_not_met",
      criterionNumber: 1,
      message: "Clarify the value.",
    },
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
    "low",
    EXECUTOR,
  );
  assert.equal(codex.status, "confirmed");
  assert.deepEqual(codex.normalizedResult, {
    status: "completed",
    changedPaths: ["fixture.txt"],
    verificationCount: 1,
  });
  const claudeResult = normalizeProviderTaskStructuredResult(
    "claude",
    "reviewer",
    "medium",
    claude(JSON.parse(REVIEWER)),
  );
  assert.equal(claudeResult.status, "confirmed");
  const normalized = claudeResult.normalizedResult;
  assert.ok(normalized && "decision" in normalized);
  assert.equal(normalized.decision, "changes_requested");
  assert.equal(normalized.findingCount, 1);
  assert.ok(normalized.remediationCapability);
  assert.equal(claudeResult.untrustedProviderTextReported, false);
  assert.equal(claudeResult.credentialAbsenceVerified, false);
});

test("Reviewer decisionとfinding件数の矛盾、余分field、path traversalを拒否する", () => {
  for (const value of [
    {
      decision: "approved",
      summary: "ok",
      findings: [
        {
          severity: "low",
          path: "a",
          category: "implementation_defect",
          criterionNumber: 1,
          message: "x",
        },
      ],
    },
    { decision: "changes_requested", summary: "bad", findings: [] },
    { decision: "approved", summary: "ok", findings: [], extra: true },
    {
      decision: "changes_requested",
      summary: "bad",
      findings: [
        {
          severity: "high",
          path: "../auth.json",
          category: "security_or_authority_defect",
          criterionNumber: 1,
          message: "x",
        },
      ],
    },
    {
      decision: "changes_requested",
      summary: "bad",
      findings: [
        {
          severity: "high",
          path: "fixture.txt",
          category: "unknown",
          criterionNumber: 1,
          message: "x",
        },
      ],
    },
    {
      decision: "changes_requested",
      summary: "bad",
      findings: [
        {
          severity: "high",
          path: "fixture.txt",
          category: "acceptance_criterion_not_met",
          criterionNumber: 0,
          message: "x",
        },
      ],
    },
  ]) {
    assert.equal(
      normalizeProviderTaskStructuredResult(
        "codex",
        "reviewer",
        "medium",
        JSON.stringify(value),
      ).status,
      "blocked",
    );
  }
});

test("Claude turn／cost上限、重複JSON key、複数documentと巨大出力を拒否する", () => {
  assert.equal(
    normalizeProviderTaskStructuredResult(
      "claude",
      "executor",
      "high",
      claude(JSON.parse(EXECUTOR), { num_turns: 9 }),
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeProviderTaskStructuredResult(
      "claude",
      "executor",
      "high",
      claude(JSON.parse(EXECUTOR), { total_cost_usd: 0.51 }),
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeProviderTaskStructuredResult(
      "codex",
      "executor",
      "low",
      '{"status":"completed","status":"completed","summary":"x","changedPaths":[],"verification":[]}',
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeProviderTaskStructuredResult(
      "codex",
      "executor",
      "low",
      `${EXECUTOR}\n{}`,
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeProviderTaskStructuredResult(
      "codex",
      "executor",
      "low",
      "x".repeat(65_537),
    ).status,
    "blocked",
  );
});

test("Claude costはSelectionで固定したeffort上限を超えられない", () => {
  assert.equal(
    normalizeProviderTaskStructuredResult(
      "claude",
      "executor",
      "low",
      claude(JSON.parse(EXECUTOR), { total_cost_usd: 0.21 }),
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeProviderTaskStructuredResult(
      "claude",
      "executor",
      "medium",
      claude(JSON.parse(EXECUTOR), { total_cost_usd: 0.36 }),
    ).status,
    "blocked",
  );
});

test("公開契約は両Provider、両Role、上限とraw非公開を固定する", () => {
  const contract = describeProviderTaskStructuredResultContract();
  assert.equal(contract.contractRevision, 6);
  assert.deepEqual(contract.providers, ["codex", "claude"]);
  assert.deepEqual(contract.roles, ["executor", "reviewer"]);
  assert.equal(contract.claudeMaximumTurns, 8);
  assert.deepEqual(contract.claudeMaximumApiEquivalentCostUsdByEffort, {
    low: 0.2,
    medium: 0.35,
    high: 0.5,
  });
  assert.equal(contract.rawOutputReported, false);
  assert.equal(contract.untrustedProviderTextReported, false);
  assert.equal(contract.reviewerMessageForwardedToExecutor, false);
  assert.equal(contract.credentialAbsenceVerified, false);
});
