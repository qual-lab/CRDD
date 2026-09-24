/**
 * coordinator:unit:provider-task-structured-resultの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:provider-task-structured-resultが所有する検証責務を実行する。
 * @trace RCM-UT-016
 * @level UT
 * @scope provider、task、structured、result
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  planClaudeIsolatedTask,
  planClaudeTaskTurnBudget,
} from "../../src/security/claude-execution-plan.ts";
import {
  describeProviderTaskStructuredResultContract,
  normalizeProviderTaskStructuredResult,
} from "../../src/security/provider-task-structured-result.ts";

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

/**
 * normalizeFixtureTaskResultのTest準備責務を実行する。
 *
 * @responsibility normalizeFixtureTaskResultがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-UT-016
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus normalizeFixtureTaskResultを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
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

/**
 * claudeのTest準備責務を実行する。
 *
 * @responsibility claudeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-UT-016
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus claudeを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
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

/**
 * claudeReviewerのTest準備責務を実行する。
 *
 * @responsibility claudeReviewerがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-UT-016
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus claudeReviewerを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
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

/**
 * Codex ExecutorとClaude Reviewerのexact Resultを正規化するを検証する。
 *
 * @responsibility Codex ExecutorとClaude Reviewerのexact Resultを正規化するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codex ExecutorとClaude Reviewerのexact Resultを正規化するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
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
  assert.deepEqual(normalized.findingDiagnostics, [
    {
      severity: "medium",
      path: "fixture.txt",
      category: "acceptance_criterion_not_met",
      criterionNumber: 1,
      messageSha256:
        "7575966d1d25626e90f680efae8d0072505e4d4018462c7e5dfd5442959109f4",
    },
  ]);
  assert.ok(normalized.remediationCapability);
  assert.deepEqual(normalized.providerTurnObservation, {
    provider: "claude",
    taskRole: "reviewer",
    requestedMaximumTurns: 5,
    providerReportedTurns: 3,
    resultAcceptanceMaximumTurns: 16,
    requestedTurnTargetExceeded: false,
  });
  assert.equal(claudeResult.untrustedProviderTextReported, false);
  assert.equal(claudeResult.credentialAbsenceVerified, false);
});

/**
 * Codex JSONLは本文を公開せずTool種別と終了状態だけを投影するを検証する。
 *
 * @responsibility Codex JSONLは本文を公開せずTool種別と終了状態だけを投影するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codex JSONLは本文を公開せずTool種別と終了状態だけを投影するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
test("Codex JSONLは本文を公開せずTool種別と終了状態だけを投影する", () => {
  const raw = [
    JSON.stringify({ type: "thread.started", thread_id: "thread" }),
    JSON.stringify({ type: "turn.started" }),
    JSON.stringify({
      type: "item.started",
      item: { id: "item-1", type: "command_execution", status: "in_progress" },
    }),
    JSON.stringify({
      type: "item.completed",
      item: {
        id: "item-1",
        type: "command_execution",
        status: "completed",
        exit_code: 0,
      },
    }),
    JSON.stringify({
      type: "item.started",
      item: { id: "item-2", type: "file_change", status: "in_progress" },
    }),
    JSON.stringify({
      type: "item.completed",
      item: { id: "item-2", type: "file_change", status: "declined" },
    }),
    JSON.stringify({
      type: "item.completed",
      item: { id: "item-3", type: "agent_message", text: EXECUTOR },
    }),
    JSON.stringify({ type: "turn.completed" }),
  ].join("\n");
  const result = normalizeFixtureTaskResult("codex", "executor", "low", raw);
  assert.equal(result.status, "confirmed");
  assert.deepEqual(result.normalizedResult?.providerExecutionObservation, {
    transport: "fixed_cli_jsonl_v0_149_1",
    turnCompleted: true,
    commandExecutionStartedCount: 1,
    commandExecutionCompletedCount: 1,
    commandExecutionFailedCount: 0,
    commandExecutionDeclinedCount: 0,
    commandExecutionExitCode0Count: 1,
    commandExecutionExitCode1Count: 0,
    commandExecutionExitCode126Count: 0,
    commandExecutionExitCode127Count: 0,
    commandExecutionOtherNonzeroExitCodeCount: 0,
    commandExecutionMissingExitCodeCount: 0,
    commandFamilyPythonCount: 0,
    commandFamilyPosixTextCount: 0,
    commandFamilyGitCount: 0,
    commandFamilyApplyPatchCount: 0,
    commandFailurePermissionCount: 0,
    commandFailureReadOnlyFilesystemCount: 0,
    commandFailureMissingPathCount: 0,
    commandFailureCommandNotFoundCount: 0,
    commandFailureSyntaxCount: 0,
    commandFailureSandboxCount: 0,
    commandFailureUnclassifiedCount: 0,
    fileChangeStartedCount: 1,
    fileChangeCompletedCount: 0,
    fileChangeFailedCount: 0,
    fileChangeDeclinedCount: 1,
    rawEventReported: false,
    commandReported: false,
    pathReported: false,
    providerTextReported: false,
  });
});

/**
 * Codex JSONLのCommand終了codeは本文なしの閉じた区分へ集計するを検証する。
 *
 * @responsibility Codex JSONLのCommand終了codeは本文なしの閉じた区分へ集計するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codex JSONLのCommand終了codeは本文なしの閉じた区分へ集計するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
test("Codex JSONLのCommand終了codeは本文なしの閉じた区分へ集計する", () => {
  const commands = [0, 1, 126, 127, 42, null].flatMap((exitCode, index) => [
    JSON.stringify({
      type: "item.started",
      item: {
        id: `command-${index}`,
        type: "command_execution",
        status: "in_progress",
      },
    }),
    JSON.stringify({
      type: "item.completed",
      item: {
        id: `command-${index}`,
        type: "command_execution",
        status: exitCode === 0 ? "completed" : "failed",
        ...(exitCode === null ? {} : { exit_code: exitCode }),
      },
    }),
  ]);
  const raw = [
    JSON.stringify({ type: "thread.started", thread_id: "thread" }),
    JSON.stringify({ type: "turn.started" }),
    ...commands,
    JSON.stringify({
      type: "item.completed",
      item: { id: "message", type: "agent_message", text: EXECUTOR },
    }),
    JSON.stringify({ type: "turn.completed" }),
  ].join("\n");

  const result = normalizeFixtureTaskResult("codex", "executor", "low", raw);
  assert.equal(result.status, "confirmed");
  assert.deepEqual(result.normalizedResult?.providerExecutionObservation, {
    transport: "fixed_cli_jsonl_v0_149_1",
    turnCompleted: true,
    commandExecutionStartedCount: 6,
    commandExecutionCompletedCount: 1,
    commandExecutionFailedCount: 5,
    commandExecutionDeclinedCount: 0,
    commandExecutionExitCode0Count: 1,
    commandExecutionExitCode1Count: 1,
    commandExecutionExitCode126Count: 1,
    commandExecutionExitCode127Count: 1,
    commandExecutionOtherNonzeroExitCodeCount: 1,
    commandExecutionMissingExitCodeCount: 1,
    commandFamilyPythonCount: 0,
    commandFamilyPosixTextCount: 0,
    commandFamilyGitCount: 0,
    commandFamilyApplyPatchCount: 0,
    commandFailurePermissionCount: 0,
    commandFailureReadOnlyFilesystemCount: 0,
    commandFailureMissingPathCount: 0,
    commandFailureCommandNotFoundCount: 0,
    commandFailureSyntaxCount: 0,
    commandFailureSandboxCount: 0,
    commandFailureUnclassifiedCount: 5,
    fileChangeStartedCount: 0,
    fileChangeCompletedCount: 0,
    fileChangeFailedCount: 0,
    fileChangeDeclinedCount: 0,
    rawEventReported: false,
    commandReported: false,
    pathReported: false,
    providerTextReported: false,
  });
});

/**
 * Codex JSONLは生Commandと出力を公開せずTool系統と失敗理由だけを分類するを検証する。
 *
 * @responsibility Codex JSONLは生Commandと出力を公開せずTool系統と失敗理由だけを分類するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codex JSONLは生Commandと出力を公開せずTool系統と失敗理由だけを分類するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
test("Codex JSONLは生Commandと出力を公開せずTool系統と失敗理由だけを分類する", () => {
  const commands = [
    {
      id: "python",
      command: "python3 -c '<untrusted>'",
      aggregated_output: "Permission denied: <secret path>",
    },
    {
      id: "text",
      command: "sed -i '<untrusted>' <secret path>",
      aggregated_output: "Read-only file system",
    },
    {
      id: "git",
      command: "git status",
      aggregated_output: "git: command not found",
    },
    {
      id: "patch",
      command: "apply_patch < <secret path>",
      aggregated_output: "apply_patch: not found",
    },
  ].flatMap((item) => [
    JSON.stringify({
      type: "item.started",
      item: { id: item.id, type: "command_execution", status: "in_progress" },
    }),
    JSON.stringify({
      type: "item.completed",
      item: {
        ...item,
        type: "command_execution",
        status: "failed",
        exit_code: 1,
      },
    }),
  ]);
  const raw = [
    JSON.stringify({ type: "thread.started", thread_id: "thread" }),
    JSON.stringify({ type: "turn.started" }),
    ...commands,
    JSON.stringify({
      type: "item.completed",
      item: { id: "message", type: "agent_message", text: EXECUTOR },
    }),
    JSON.stringify({ type: "turn.completed" }),
  ].join("\n");

  const result = normalizeFixtureTaskResult("codex", "executor", "low", raw);
  const observation = result.normalizedResult?.providerExecutionObservation;
  assert.equal(observation?.commandFamilyPythonCount, 1);
  assert.equal(observation?.commandFamilyPosixTextCount, 1);
  assert.equal(observation?.commandFamilyGitCount, 1);
  assert.equal(observation?.commandFamilyApplyPatchCount, 1);
  assert.equal(observation?.commandFailurePermissionCount, 1);
  assert.equal(observation?.commandFailureReadOnlyFilesystemCount, 1);
  assert.equal(observation?.commandFailureCommandNotFoundCount, 2);
  assert.equal(observation?.commandFailureUnclassifiedCount, 0);
  assert.equal(observation?.commandReported, false);
  assert.equal(observation?.pathReported, false);
  assert.equal(observation?.providerTextReported, false);
  assert.equal(JSON.stringify(observation).includes("<secret path>"), false);
});

/**
 * Reviewer decisionとfinding件数の矛盾、余分field、path traversalを拒否するを検証する。
 *
 * @responsibility Reviewer decisionとfinding件数の矛盾、余分field、path traversalを拒否するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reviewer decisionとfinding件数の矛盾、余分field、path traversalを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
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
      /^provider_task_reviewer_(?:shape|keys|decision|summary|findings|finding)_/u,
    );
  }
});

/**
 * Claude Reviewer本文と既知の終了EnvelopeをCRDD側で分類するを検証する。
 *
 * @responsibility Claude Reviewer本文と既知の終了EnvelopeをCRDD側で分類するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Claude Reviewer本文と既知の終了EnvelopeをCRDD側で分類するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
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

/**
 * Claude Envelope拒否を値の非公開と受理条件を維持して分類するを検証する。
 *
 * @responsibility Claude Envelope拒否を値の非公開と受理条件を維持して分類するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Claude Envelope拒否を値の非公開と受理条件を維持して分類するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
test("Claude Envelope拒否を値の非公開と受理条件を維持して分類する", () => {
  const cases = [
    [
      { type: "untrusted-value" },
      "provider_task_result_envelope_status_invalid",
    ],
    [{ subtype: "unknown" }, "provider_task_result_envelope_status_invalid"],
    [{ is_error: true }, "provider_task_result_envelope_status_invalid"],
    ...[undefined, null, "3", 0, -1, 1.5].map((turnCount) => [
      { num_turns: turnCount },
      "provider_task_result_turn_count_invalid",
    ]),
    [{ num_turns: 17 }, "provider_task_result_turn_limit_mismatch"],
    ...[undefined, null, "0", -1].map((totalCostUsd) => [
      { total_cost_usd: totalCostUsd },
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

/**
 * Provider Result拒否はrawを出さず固定理由で意味分類するを検証する。
 *
 * @responsibility Provider Result拒否はrawを出さず固定理由で意味分類するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider Result拒否はrawを出さず固定理由で意味分類するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
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
      "provider_task_reviewer_keys_invalid",
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

/**
 * Codex搬送Schemaに委ねない重複・件数・byte上限をRuntimeで拒否するを検証する。
 *
 * @responsibility Codex搬送Schemaに委ねない重複・件数・byte上限をRuntimeで拒否するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codex搬送Schemaに委ねない重複・件数・byte上限をRuntimeで拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
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
  assert.equal(result.reason, "provider_task_reviewer_findings_invalid");
});

/**
 * Reviewerの外形拒否は本文を出さず構造条件ごとに分類するを検証する。
 *
 * @responsibility Reviewerの外形拒否は本文を出さず構造条件ごとに分類するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reviewerの外形拒否は本文を出さず構造条件ごとに分類するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
test("Reviewerの外形拒否は本文を出さず構造条件ごとに分類する", () => {
  const cases = [
    [
      { decision: "approved|changes_requested", summary: "ok", findings: [] },
      "provider_task_reviewer_decision_invalid",
    ],
    [
      { decision: "approved", summary: "", findings: [] },
      "provider_task_reviewer_summary_invalid",
    ],
    [
      { decision: "approved", summary: "ok", findings: "none" },
      "provider_task_reviewer_findings_invalid",
    ],
  ] as const;
  for (const [value, reason] of cases) {
    const result = normalizeFixtureTaskResult(
      "codex",
      "reviewer",
      "medium",
      JSON.stringify(value),
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, reason);
    assert.equal(result.normalizedResult, null);
    assert.equal(result.rawOutputReported, false);
    assert.equal(result.untrustedProviderTextReported, false);
  }
});

/**
 * Claudeの実行目標と結果受理の絶対上限を分離するを検証する。
 *
 * @responsibility Claudeの実行目標と結果受理の絶対上限を分離するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Claudeの実行目標と結果受理の絶対上限を分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
test("Claudeの実行目標と結果受理の絶対上限を分離する", () => {
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
      assert.equal(plan.hardMaximumTurns, 16);
      assert.equal(
        plan.hardMaximumTurnsBasis,
        "runtime_result_acceptance_guard_independent_of_provider_requested_turn_target",
      );
      for (const turns of [
        -1,
        0,
        1,
        1.5,
        limit - 1,
        limit,
        limit + 1,
        16,
        17,
      ]) {
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
          Number.isInteger(turns) && turns >= 1 && turns <= 16
            ? "confirmed"
            : "blocked",
          `${taskRole}/${effort}/${turns}`,
        );
        if (result.status === "confirmed") {
          assert.deepEqual(result.normalizedResult?.providerTurnObservation, {
            provider: "claude",
            taskRole,
            requestedMaximumTurns: limit,
            providerReportedTurns: turns,
            resultAcceptanceMaximumTurns: 16,
            requestedTurnTargetExceeded: turns > limit,
          });
        }
      }
    }
  }
});

/**
 * 作業量の有限見積りは全推論で一致し、選定上限を超える結果を拒否するを検証する。
 *
 * @responsibility 作業量の有限見積りは全推論で一致し、選定上限を超える結果を拒否するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 作業量の有限見積りは全推論で一致し、選定上限を超える結果を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
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
      for (const turns of [expected, expected + 1, 16, 17]) {
        assert.equal(
          normalizeFixtureTaskResult(
            "claude",
            "reviewer",
            effort,
            claudeReviewer(JSON.parse(REVIEWER), { num_turns: turns }),
            workload,
          ).status,
          turns <= 16 ? "confirmed" : "blocked",
        );
      }
    }
  }
});

/**
 * 不明または予算超過の作業量を旧固定値へfallbackしないを検証する。
 *
 * @responsibility 不明または予算超過の作業量を旧固定値へfallbackしないの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 不明または予算超過の作業量を旧固定値へfallbackしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
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

/**
 * Claude turn上限、不正cost、重複JSON key、複数documentと巨大出力を拒否するを検証する。
 *
 * @responsibility Claude turn上限、不正cost、重複JSON key、複数documentと巨大出力を拒否するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Claude turn上限、不正cost、重複JSON key、複数documentと巨大出力を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
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

/**
 * SubscriptionのAPI相当costは課金Authorityへ昇格せず有限非負なら受理するを検証する。
 *
 * @responsibility SubscriptionのAPI相当costは課金Authorityへ昇格せず有限非負なら受理するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus SubscriptionのAPI相当costは課金Authorityへ昇格せず有限非負なら受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
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

/**
 * 公開契約は両Provider、両Role、上限とraw非公開を固定するを検証する。
 *
 * @responsibility 公開契約は両Provider、両Role、上限とraw非公開を固定するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約は両Provider、両Role、上限とraw非公開を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
test("公開契約は両Provider、両Role、上限とraw非公開を固定する", () => {
  const contract = describeProviderTaskStructuredResultContract();
  assert.equal(contract.contractRevision, 19);
  assert.deepEqual(contract.providers, ["codex", "claude"]);
  assert.deepEqual(contract.roles, ["executor", "reviewer"]);
  assert.equal(contract.claudeResultAcceptanceMaximumTurns, 16);
  assert.equal(
    contract.claudeResultAcceptanceMaximumTurnsBasis,
    "runtime_guard_independent_of_provider_requested_turn_target",
  );
  assert.equal(
    contract.acceptedClaudeTurnObservation,
    "requested_target_reported_turns_absolute_acceptance_maximum_and_target_exceeded_after_validation",
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
    "fixed_structural_reason_identifier_only_without_raw_provider_output",
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
