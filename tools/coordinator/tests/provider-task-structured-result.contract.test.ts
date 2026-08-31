import assert from "node:assert/strict";
import test from "node:test";

import {
  planClaudeIsolatedTask,
  planClaudeTaskTurnBudget,
} from "../src/security/claude-execution-plan.ts";
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
const TASK_WORKLOAD = Object.freeze({
  readPathCount: 1,
  allowedPathCount: 1,
  acceptanceCriterionCount: 1,
  remediationFindingCount: 0,
});

function normalizeFixtureTaskResult(
  provider: unknown,
  role: unknown,
  effort: unknown,
  raw: unknown,
  workload: unknown = TASK_WORKLOAD,
) {
  return normalizeProviderTaskStructuredResult(
    provider,
    role,
    effort,
    raw,
    workload,
  );
}
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

function claudeReviewer(result: unknown, overrides = {}) {
  return JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    num_turns: 3,
    total_cost_usd: 0.12,
    result: typeof result === "string" ? result : JSON.stringify(result),
    ...overrides,
  });
}

test("Codex ExecutorとClaude Reviewerのexact Resultを正規化する", () => {
  const codex = normalizeFixtureTaskResult(
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
  const claudeResult = normalizeFixtureTaskResult(
    "claude",
    "reviewer",
    "medium",
    claudeReviewer(JSON.parse(REVIEWER)),
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
  ] as const) {
    const result = normalizeFixtureTaskResult(
      "codex",
      "reviewer",
      "medium",
      JSON.stringify(value),
    );
    assert.equal(result.status, "blocked");
    assert.match(
      result.reason,
      /^provider_task_reviewer_(?:shape|finding|decision)_/u,
    );
  }
});

test("Claude Reviewer本文と既知の終了EnvelopeをCRDD側で分類する", () => {
  const invalidDocument = normalizeFixtureTaskResult(
    "claude",
    "reviewer",
    "medium",
    claudeReviewer("```json\n{}\n```"),
  );
  assert.equal(invalidDocument.status, "blocked");
  assert.equal(invalidDocument.reason, "provider_task_result_json_invalid");

  for (const [subtype, reason] of [
    ["error_max_turns", "provider_turn_limit_exceeded"],
    [
      "error_max_structured_output_retries",
      "provider_structured_output_retry_exhausted",
    ],
  ] as const) {
    const result = normalizeFixtureTaskResult(
      "claude",
      "reviewer",
      "medium",
      JSON.stringify({ type: "result", subtype }),
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, reason);
    assert.equal(result.rawOutputReported, false);
  }
});

test("Claude Envelope拒否を値の非公開と受理条件を維持して分類する", () => {
  const cases = [
    [
      { type: "untrusted-value" },
      "provider_task_result_envelope_status_invalid",
    ],
    [{ subtype: "unknown" }, "provider_task_result_envelope_status_invalid"],
    [{ is_error: true }, "provider_task_result_envelope_status_invalid"],
    ...[undefined, null, "3", 0, -1, 1.5].map((num_turns) => [
      { num_turns },
      "provider_task_result_turn_count_invalid",
    ]),
    [{ num_turns: 17 }, "provider_task_result_turn_limit_mismatch"],
    ...[undefined, null, "0", -1].map((total_cost_usd) => [
      { total_cost_usd },
      "provider_task_result_cost_metadata_invalid",
    ]),
    [{ result: undefined }, "provider_task_reviewer_result_transport_invalid"],
    [{ result: {} }, "provider_task_reviewer_result_transport_invalid"],
  ] as const;
  for (const [overrides, reason] of cases) {
    const result = normalizeFixtureTaskResult(
      "claude",
      "reviewer",
      "medium",
      claudeReviewer(JSON.parse(REVIEWER), overrides),
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, reason);
    assert.equal(result.normalizedResult, null);
    assert.ok("rawOutputReported" in result);
    assert.equal(result.rawOutputReported, false);
    assert.equal(JSON.stringify(result).includes("untrusted-value"), false);
  }
});

test("Provider Result拒否はrawを出さず固定理由で意味分類する", () => {
  const cases = [
    ["not-json", "provider_task_result_json_invalid"],
    [
      JSON.stringify({
        decision: "approved",
        summary: "ok",
        findings: [],
        extra: true,
      }),
      "provider_task_reviewer_shape_invalid",
    ],
    [
      JSON.stringify({
        decision: "changes_requested",
        summary: "bad",
        findings: [],
      }),
      "provider_task_reviewer_decision_inconsistent",
    ],
  ] as const;
  for (const [raw, expectedReason] of cases) {
    const result = normalizeFixtureTaskResult(
      "codex",
      "reviewer",
      "medium",
      raw,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, expectedReason);
    assert.equal(result.normalizedResult, null);
    assert.equal(result.rawOutputReported, false);
  }
});

test("Codex搬送Schemaに委ねない重複・件数・byte上限をRuntimeで拒否する", () => {
  const executorCases = [
    {
      status: "completed",
      summary: "ok",
      changedPaths: ["fixture.txt", "FIXTURE.TXT"],
      verification: [],
    },
    {
      status: "completed",
      summary: "x".repeat(8_193),
      changedPaths: [],
      verification: [],
    },
    {
      status: "completed",
      summary: "ok",
      changedPaths: Array.from(
        { length: 1_001 },
        (_value, index) => `${index}.txt`,
      ),
      verification: [],
    },
    {
      status: "completed",
      summary: "ok",
      changedPaths: [],
      verification: Array.from({ length: 33 }, () => "checked"),
    },
  ];
  for (const value of executorCases) {
    const result = normalizeFixtureTaskResult(
      "codex",
      "executor",
      "low",
      JSON.stringify(value),
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "provider_task_executor_shape_invalid");
  }

  const reviewer = {
    decision: "changes_requested",
    summary: "issue",
    findings: Array.from({ length: 65 }, () => ({
      severity: "low",
      path: "fixture.txt",
      category: "implementation_defect",
      criterionNumber: 1,
      message: "x",
    })),
  };
  const result = normalizeFixtureTaskResult(
    "codex",
    "reviewer",
    "medium",
    JSON.stringify(reviewer),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "provider_task_reviewer_shape_invalid");
});

test("Claudeの実行計画・argv・結果受理は推論から独立した同じ作業量上限に従う", () => {
  const expectedLimits = {
    executor: { low: 8, medium: 8, high: 8 },
    reviewer: { low: 5, medium: 5, high: 5 },
  };
  for (const taskRole of ["executor", "reviewer"] as const) {
    for (const effort of ["low", "medium", "high"] as const) {
      const plan = planClaudeIsolatedTask({
        provider: "claude",
        mode: "isolated_task",
        taskRole,
        effort,
        taskWorkload: TASK_WORKLOAD,
      });
      assert.equal(plan.status, "candidate");
      if (plan.status !== "candidate") throw new Error("plan_not_candidate");
      const limit = expectedLimits[taskRole][effort];
      assert.equal(plan.maximumTurns, limit);
      assert.equal(
        plan.argv[plan.argv.indexOf("--max-turns") + 1],
        String(limit),
      );
      for (const turns of [-1, 0, 1, 1.5, limit - 1, limit, limit + 1, 17]) {
        const raw =
          taskRole === "executor"
            ? claude(JSON.parse(EXECUTOR), { num_turns: turns })
            : claudeReviewer(JSON.parse(REVIEWER), { num_turns: turns });
        const result = normalizeFixtureTaskResult(
          "claude",
          taskRole,
          effort,
          raw,
        );
        assert.equal(
          result.status,
          Number.isInteger(turns) && turns >= 1 && turns <= limit
            ? "confirmed"
            : "blocked",
          `${taskRole}/${effort}/${turns}`,
        );
      }
    }
  }
});

test("作業量の有限見積りは全推論で一致し、選定上限を超える結果を拒否する", () => {
  for (const [
    readPathCount,
    allowedPathCount,
    acceptanceCriterionCount,
    remediationFindingCount,
    expected,
  ] of [
    [6, 1, 4, 0, 10],
    [12, 1, 4, 0, 16],
    [6, 1, 5, 0, 11],
    [6, 1, 4, 5, 12],
  ] as const) {
    const workload = {
      readPathCount,
      allowedPathCount,
      acceptanceCriterionCount,
      remediationFindingCount,
    };
    for (const effort of ["low", "medium", "high"]) {
      const plan = planClaudeIsolatedTask({
        provider: "claude",
        mode: "isolated_task",
        taskRole: "reviewer",
        effort,
        taskWorkload: workload,
      });
      assert.equal(plan.status, "candidate");
      if (plan.status !== "candidate") throw new Error("plan_invalid");
      assert.equal(plan.maximumTurns, expected);
      assert.equal(
        plan.argv[plan.argv.indexOf("--max-turns") + 1],
        String(expected),
      );
      for (const turns of [expected, expected + 1]) {
        assert.equal(
          normalizeFixtureTaskResult(
            "claude",
            "reviewer",
            effort,
            claudeReviewer(JSON.parse(REVIEWER), { num_turns: turns }),
            workload,
          ).status,
          turns === expected ? "confirmed" : "blocked",
        );
      }
    }
  }
});

test("不明または予算超過の作業量を旧固定値へfallbackしない", () => {
  for (const workload of [
    undefined,
    null,
    {},
    { ...TASK_WORKLOAD, extra: 1 },
    ...[-1, 0, 1.5, NaN, Infinity, 65].map((readPathCount) => ({
      ...TASK_WORKLOAD,
      readPathCount,
    })),
    { ...TASK_WORKLOAD, acceptanceCriterionCount: 17 },
    { ...TASK_WORKLOAD, remediationFindingCount: -1 },
    { ...TASK_WORKLOAD, readPathCount: 13 },
  ]) {
    assert.equal(
      planClaudeTaskTurnBudget("reviewer", workload).status,
      "blocked",
    );
    assert.equal(
      normalizeProviderTaskStructuredResult(
        "claude",
        "reviewer",
        "medium",
        claudeReviewer(JSON.parse(REVIEWER)),
        workload,
      ).status,
      "blocked",
    );
  }
  let trapCount = 0;
  for (const workload of [
    new Proxy(TASK_WORKLOAD, {
      ownKeys() {
        trapCount++;
        return [];
      },
    }),
    {
      ...TASK_WORKLOAD,
      get readPathCount() {
        trapCount++;
        return 1;
      },
    },
  ]) {
    assert.equal(
      planClaudeTaskTurnBudget("reviewer", workload).status,
      "blocked",
    );
  }
  assert.equal(trapCount, 0);
  const split = planClaudeTaskTurnBudget("reviewer", {
    ...TASK_WORKLOAD,
    readPathCount: 13,
  });
  assert.equal(split.status, "blocked");
  if (split.status === "blocked")
    assert.equal(split.reason, "claude_task_workload_split_required");
});

test("Claude turn上限、不正cost、重複JSON key、複数documentと巨大出力を拒否する", () => {
  assert.equal(
    normalizeFixtureTaskResult(
      "claude",
      "executor",
      "high",
      claude(JSON.parse(EXECUTOR), { num_turns: 17 }),
    ).status,
    "blocked",
  );
  for (const totalCostUsd of [-0.01, Number.POSITIVE_INFINITY, Number.NaN]) {
    assert.equal(
      normalizeFixtureTaskResult(
        "claude",
        "executor",
        "high",
        claude(JSON.parse(EXECUTOR), { total_cost_usd: totalCostUsd }),
      ).status,
      "blocked",
    );
  }
  assert.equal(
    normalizeFixtureTaskResult(
      "codex",
      "executor",
      "low",
      '{"status":"completed","status":"completed","summary":"x","changedPaths":[],"verification":[]}',
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeFixtureTaskResult("codex", "executor", "low", `${EXECUTOR}\n{}`)
      .status,
    "blocked",
  );
  assert.equal(
    normalizeFixtureTaskResult("codex", "executor", "low", "x".repeat(65_537))
      .status,
    "blocked",
  );
});

test("SubscriptionのAPI相当costは課金Authorityへ昇格せず有限非負なら受理する", () => {
  assert.equal(
    normalizeFixtureTaskResult(
      "claude",
      "executor",
      "low",
      claude(JSON.parse(EXECUTOR), { total_cost_usd: 0.21 }),
    ).status,
    "confirmed",
  );
  assert.equal(
    normalizeFixtureTaskResult(
      "claude",
      "executor",
      "medium",
      claude(JSON.parse(EXECUTOR), { total_cost_usd: 0.36 }),
    ).status,
    "confirmed",
  );
});

test("公開契約は両Provider、両Role、上限とraw非公開を固定する", () => {
  const contract = describeProviderTaskStructuredResultContract();
  assert.equal(contract.contractRevision, 14);
  assert.deepEqual(contract.providers, ["codex", "claude"]);
  assert.deepEqual(contract.roles, ["executor", "reviewer"]);
  assert.equal(contract.claudeMaximumTurns, 16);
  assert.equal(
    contract.claudeMaximumTurnsBasis,
    "same_validated_task_scope_counts_as_execution_plan",
  );
  assert.equal(contract.claudeMaximumApiEquivalentCostUsdByEffort, null);
  assert.equal(
    contract.claudeApiEquivalentCostDisposition,
    "validated_nonnegative_finite_usage_metadata_not_billing_authority",
  );
  assert.equal(contract.rawOutputReported, false);
  assert.equal(contract.untrustedProviderTextReported, false);
  assert.equal(
    contract.mismatchDiagnostics,
    "fixed_reason_identifier_only_without_raw_provider_output",
  );
  assert.deepEqual(contract.claudeResultTransport, {
    executor: "provider_structured_output_then_crdd_validation",
    reviewer: "provider_json_envelope_result_then_crdd_validation",
  });
  assert.equal(
    contract.reviewerMessageForwardedToExecutor,
    "bounded_untrusted_defect_claim_after_secret_screening",
  );
  assert.equal(contract.credentialAbsenceVerified, false);
});
