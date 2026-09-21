/**
 * execution-intelligence:unit:event-contractの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility execution-intelligence:unit:event-contractが所有する検証責務を実行する。
 * @trace ERP-UT-006
 * @level UT
 * @scope execution、intelligence、observation、aggregation
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  BOUNDED_INTEGRATED_RESULT_EVALUATION_INPUT_CONTRACT,
  createTaskAttemptSettledEvent,
  evaluateBoundedIntegratedResult,
  inspectExecutionIntelligenceEvent,
  notApplicable,
  notObserved,
  observed,
  proposeExecutionImprovementCandidates,
  summarizeExecutionIntelligence,
  usageNotObserved,
} from "../../src/index.ts";

/**
 * public observation helpers preserve values, absence and non-applicabilityを検証する。
 *
 * @responsibility public observation helpers preserve values, absence and non-applicabilityの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus public observation helpers preserve values, absence and non-applicabilityの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("public observation helpers preserve values, absence and non-applicability", () => {
  assert.deepEqual(observed(12, "provider_receipt"), {
    state: "observed",
    value: 12,
    source: "provider_receipt",
  });
  assert.deepEqual(notObserved("usage_not_reported"), {
    state: "not_observed",
    reason: "usage_not_reported",
  });
  assert.deepEqual(notApplicable("human_time_not_measured"), {
    state: "not_applicable",
    reason: "human_time_not_measured",
  });
});

/**
 * eventのTest準備責務を実行する。
 *
 * @responsibility eventがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERP-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus eventを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
function event(
  status: "completed" | "blocked" = "completed",
  taskId = "task-a",
  provider: string | null = null,
) {
  return createTaskAttemptSettledEvent({
    occurredAt: "2026-09-05T00:00:01.000Z",
    identity: {
      projectId: "project-a",
      milestoneId: "milestone-a",
      objectiveId: "objective-a",
      taskId,
      attemptId: `attempt-${taskId}`,
      operationId: `operation-${taskId}`,
    },
    outcome: {
      status,
      reason: status === "completed" ? "task_completed" : "task_blocked",
      effectState: status === "completed" ? "settled" : "no_effect",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
    },
    execution: {
      role: "executor",
      provider:
        provider === null
          ? { state: "not_observed", reason: "provider_not_reported" }
          : { state: "observed", value: provider, source: "runtime_receipt" },
      model: { state: "not_observed", reason: "model_not_reported" },
      inputStrategyRef: {
        state: "observed",
        value: "test/input/v1",
        source: "unit_fixture",
      },
      durationMs: { state: "observed", value: 75, source: "unit_clock" },
      usage: usageNotObserved("usage_not_reported"),
      humanActiveMs: {
        state: "not_observed",
        reason: "human_time_not_reported",
      },
    },
    quality: {
      state: "not_applicable",
      reason: "attempt_settlement_is_not_acceptance",
    },
  });
}

/**
 * creates a closed metadata-only event and preserves missing observationsを検証する。
 *
 * @responsibility creates a closed metadata-only event and preserves missing observationsの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus creates a closed metadata-only event and preserves missing observationsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("creates a closed metadata-only event and preserves missing observations", () => {
  const created = event();
  assert.deepEqual(inspectExecutionIntelligenceEvent(created), created);
  assert.equal(created.execution.durationMs.state, "observed");
  assert.equal(created.execution.provider.state, "not_observed");
  assert.equal(created.execution.usage.inputTokens.state, "not_observed");
  assert.equal(created.quality.state, "not_applicable");
  assert.equal(Object.isFrozen(created.execution.provider), true);
  assert.equal(Object.isFrozen(created.identity), true);
  assert.equal(JSON.stringify(created).includes("prompt"), false);
  assert.equal(
    inspectExecutionIntelligenceEvent({
      ...created,
      rawProviderOutput: "forbidden",
    }),
    null,
  );
});

/**
 * accepts stable provider and role identifiers without Coordinator ownershipを検証する。
 *
 * @responsibility accepts stable provider and role identifiers without Coordinator ownershipの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus accepts stable provider and role identifiers without Coordinator ownershipの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("accepts stable provider and role identifiers without Coordinator ownership", () => {
  const created = event();
  const external = createTaskAttemptSettledEvent({
    occurredAt: created.occurredAt,
    identity: created.identity,
    execution: {
      ...created.execution,
      role: "verifier",
      provider: {
        state: "observed",
        value: "self-hosted-provider",
        source: "external_runtime_receipt",
      },
    },
    outcome: created.outcome,
    quality: created.quality,
  });
  assert.equal(external.execution.role, "verifier");
  assert.deepEqual(external.execution.provider, {
    state: "observed",
    value: "self-hosted-provider",
    source: "external_runtime_receipt",
  });
});

/**
 * aggregates observed facts without turning missing values into zeroを検証する。
 *
 * @responsibility aggregates observed facts without turning missing values into zeroの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus aggregates observed facts without turning missing values into zeroの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("aggregates observed facts without turning missing values into zero", () => {
  const summary = summarizeExecutionIntelligence([event()]);
  assert.ok(summary);
  assert.equal(summary.eventCount, 1);
  assert.equal(summary.totalObservedDurationMs, 75);
  assert.equal(summary.providerObservationCount, 0);
  assert.equal(summary.usageObservedEventCount, 0);
  assert.equal(summary.usageFullyObservedEventCount, 0);
  assert.equal(summary.observedUsageFieldCount, 0);
  assert.equal(summary.humanActiveObservationCount, 0);
  assert.equal(summary.missingnessPreserved, true);
});

/**
 * preserves partially observed AI API usage without inventing cost or cache valuesを検証する。
 *
 * @responsibility preserves partially observed AI API usage without inventing cost or cache valuesの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus preserves partially observed AI API usage without inventing cost or cache valuesの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("preserves partially observed AI API usage without inventing cost or cache values", () => {
  const base = event();
  const partial = createTaskAttemptSettledEvent({
    occurredAt: base.occurredAt,
    identity: base.identity,
    execution: {
      ...base.execution,
      usage: {
        inputTokens: observed(120, "provider_usage_receipt"),
        outputTokens: observed(45, "provider_usage_receipt"),
        cacheReadTokens: notObserved("provider_did_not_report_cache_read"),
        cacheWriteTokens: notApplicable("provider_has_no_cache_write_metric"),
        costOrCredits: notObserved("billing_receipt_not_available"),
      },
    },
    outcome: base.outcome,
    quality: base.quality,
  });
  const summary = summarizeExecutionIntelligence([partial]);
  assert.ok(summary);
  assert.equal(summary.usageObservedEventCount, 1);
  assert.equal(summary.usageFullyObservedEventCount, 0);
  assert.equal(summary.observedUsageFieldCount, 2);
  assert.equal(partial.execution.usage.costOrCredits.state, "not_observed");
});

/**
 * accepts an explicit cost unit and rejects invalid usage membersを検証する。
 *
 * @responsibility accepts an explicit cost unit and rejects invalid usage membersの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus accepts an explicit cost unit and rejects invalid usage membersの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("accepts an explicit cost unit and rejects invalid usage members", () => {
  const base = event();
  const measured = createTaskAttemptSettledEvent({
    occurredAt: base.occurredAt,
    identity: base.identity,
    execution: {
      ...base.execution,
      usage: {
        inputTokens: observed(120, "provider_usage_receipt"),
        outputTokens: observed(45, "provider_usage_receipt"),
        cacheReadTokens: observed(20, "provider_usage_receipt"),
        cacheWriteTokens: observed(0, "provider_usage_receipt"),
        costOrCredits: observed(
          { amount: 0.0025, unit: "USD" },
          "billing_receipt",
        ),
      },
    },
    outcome: base.outcome,
    quality: base.quality,
  });
  assert.equal(
    measured.execution.usage.costOrCredits.state === "observed" &&
      measured.execution.usage.costOrCredits.value.unit,
    "USD",
  );
  assert.equal(
    inspectExecutionIntelligenceEvent({
      ...measured,
      execution: {
        ...measured.execution,
        usage: {
          ...measured.execution.usage,
          costOrCredits: observed(
            { amount: -1, unit: "USD" },
            "billing_receipt",
          ),
        },
      },
    }),
    null,
  );
});

/**
 * returns non-authoritative improvement candidatesを検証する。
 *
 * @responsibility returns non-authoritative improvement candidatesの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus returns non-authoritative improvement candidatesの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("returns non-authoritative improvement candidates", () => {
  const proposal = proposeExecutionImprovementCandidates([event("blocked")]);
  assert.ok(proposal);
  assert.equal(proposal.status, "proposal");
  assert.equal(proposal.authorityConferred, false);
  assert.equal(proposal.automaticChangeAllowed, false);
  assert.deepEqual(
    proposal.candidates.map((entry) => entry.kind),
    ["investigate_noncompleted_attempts", "improve_provider_observation"],
  );
});

/**
 * rejects an invalid member instead of silently dropping itを検証する。
 *
 * @responsibility rejects an invalid member instead of silently dropping itの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus rejects an invalid member instead of silently dropping itの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("rejects an invalid member instead of silently dropping it", () => {
  assert.equal(
    summarizeExecutionIntelligence([event(), { status: "bad" }]),
    null,
  );
  assert.equal(
    proposeExecutionImprovementCandidates([{ status: "bad" }]),
    null,
  );
  const duplicate = event();
  assert.equal(summarizeExecutionIntelligence([duplicate, duplicate]), null);
});

/**
 * 公開Event検査はAccessor・Proxyを実行せずcanonical copyだけを返すを検証する。
 *
 * @responsibility 公開Event検査はAccessor・Proxyを実行せずcanonical copyだけを返すの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開Event検査はAccessor・Proxyを実行せずcanonical copyだけを返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("公開Event検査はAccessor・Proxyを実行せずcanonical copyだけを返す", () => {
  const base = event();
  let getterCalls = 0;
  const outcome = {
    ...base.outcome,
    get status() {
      getterCalls += 1;
      return "completed";
    },
  };
  assert.equal(inspectExecutionIntelligenceEvent({ ...base, outcome }), null);
  assert.equal(getterCalls, 0);
  assert.doesNotThrow(() =>
    assert.equal(
      inspectExecutionIntelligenceEvent(
        new Proxy(base, {
          getPrototypeOf: () => {
            throw new Error("trap");
          },
        }),
      ),
      null,
    ),
  );
  const inspected = inspectExecutionIntelligenceEvent(base);
  assert.ok(inspected);
  assert.notEqual(inspected, base);
  assert.deepEqual(inspected, base);
});

/**
 * Event生成は入力を一度だけsnapshotしIdentityと決定的IDを一致させるを検証する。
 *
 * @responsibility Event生成は入力を一度だけsnapshotしIdentityと決定的IDを一致させるの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Event生成は入力を一度だけsnapshotしIdentityと決定的IDを一致させるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("Event生成は入力を一度だけsnapshotしIdentityと決定的IDを一致させる", () => {
  const base = event();
  let getterCalls = 0;
  const input = {
    occurredAt: base.occurredAt,
    get identity() {
      getterCalls += 1;
      return base.identity;
    },
    execution: base.execution,
    outcome: base.outcome,
    quality: base.quality,
  };
  assert.throws(
    () => createTaskAttemptSettledEvent(input),
    /execution_intelligence_event_invalid/u,
  );
  assert.equal(getterCalls, 0);

  const forged = {
    ...base,
    eventId: `execution-${"a".repeat(64)}`,
  };
  assert.equal(inspectExecutionIntelligenceEvent(forged), null);
  assert.equal(event("completed", "task-a").eventId, base.eventId);
  assert.notEqual(event("completed", "task-b").eventId, base.eventId);
});

/**
 * evaluationInputのTest準備責務を実行する。
 *
 * @responsibility evaluationInputがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERP-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus evaluationInputを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
function evaluationInput() {
  /**
   * observedCountのTest準備責務を実行する。
   *
   * @responsibility observedCountがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERP-UT-006
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus observedCountを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
   */
  const observedCount = (value: number) => ({
    state: "observed" as const,
    value,
    source: "dogfooding_record",
  });
  return {
    contract: BOUNDED_INTEGRATED_RESULT_EVALUATION_INPUT_CONTRACT,
    evaluationId: "evaluation-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    expectedTaskIds: ["task-a", "task-b"],
    taskAttemptEvents: [
      event("completed", "task-a", "codex"),
      event("completed", "task-b", "claude"),
    ],
    integratedResult: {
      state: "observed" as const,
      value: { result: "accepted" as const, evidenceIds: ["evidence-a"] },
      source: "project_runtime_integration",
    },
    measurements: {
      timeToAcceptedResultMs: observedCount(1_200),
      humanActiveMs: observedCount(20),
      reviewLoopCount: observedCount(1),
      remediationCount: observedCount(0),
      retryCount: observedCount(0),
      integrationConflictCount: observedCount(0),
      postIntegrationFindingCount: observedCount(0),
    },
  };
}

/**
 * evaluates bounded work by the integrated accepted result rather than task successを検証する。
 *
 * @responsibility evaluates bounded work by the integrated accepted result rather than task successの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus evaluates bounded work by the integrated accepted result rather than task successの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("evaluates bounded work by the integrated accepted result rather than task success", () => {
  const result = evaluateBoundedIntegratedResult(evaluationInput());
  assert.ok(result);
  assert.equal(result.status, "completed");
  assert.equal(result.integratedAcceptedResult, true);
  assert.equal(result.attemptCount, 2);
  assert.equal(result.observedTaskCount, 2);
  assert.deepEqual(result.providerAttemptCounts, { codex: 1, claude: 1 });
  assert.equal(result.taskSuccessIsIntegrationAcceptance, false);
  assert.equal(result.authorityConferred, false);
});

/**
 * preserves an unobserved integrated result and missing task evidenceを検証する。
 *
 * @responsibility preserves an unobserved integrated result and missing task evidenceの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus preserves an unobserved integrated result and missing task evidenceの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("preserves an unobserved integrated result and missing task evidence", () => {
  const base = evaluationInput();
  const result = evaluateBoundedIntegratedResult({
    ...base,
    taskAttemptEvents: base.taskAttemptEvents.slice(0, 1),
    integratedResult: {
      state: "not_observed",
      reason: "integration_not_run",
    },
  });
  assert.ok(result);
  assert.equal(result.status, "incomplete");
  assert.equal(result.reason, "expected_task_attempt_not_observed");
  assert.equal(result.integratedAcceptedResult, null);
  assert.deepEqual(result.missingTaskIds, ["task-b"]);
  assert.equal(result.missingnessPreserved, true);
});

/**
 * rejects cross-project events and unknown evaluation fieldsを検証する。
 *
 * @responsibility rejects cross-project events and unknown evaluation fieldsの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus rejects cross-project events and unknown evaluation fieldsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("rejects cross-project events and unknown evaluation fields", () => {
  const base = evaluationInput();
  assert.equal(
    evaluateBoundedIntegratedResult({
      ...base,
      taskAttemptEvents: [
        {
          ...base.taskAttemptEvents[0],
          identity: {
            ...base.taskAttemptEvents[0]?.identity,
            projectId: "other-project",
          },
        },
      ],
    }),
    null,
  );
  assert.equal(
    evaluateBoundedIntegratedResult({ ...base, automaticAdoption: true }),
    null,
  );
});

/**
 * 限定統合入力はProxy・Accessor・疎な配列を例外なく拒否するを検証する。
 *
 * @responsibility 限定統合入力はProxy・Accessor・疎な配列を例外なく拒否するの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 限定統合入力はProxy・Accessor・疎な配列を例外なく拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("限定統合入力はProxy・Accessor・疎な配列を例外なく拒否する", () => {
  const base = evaluationInput();
  const trapped = new Proxy(base, {
    getPrototypeOf: () => {
      throw new Error("trap");
    },
  });
  assert.doesNotThrow(() =>
    assert.equal(evaluateBoundedIntegratedResult(trapped), null),
  );
  let getterCalls = 0;
  const accessor = {
    ...base,
    get projectId() {
      getterCalls += 1;
      return "project-a";
    },
  };
  assert.equal(evaluateBoundedIntegratedResult(accessor), null);
  assert.equal(getterCalls, 0);
  const sparseItems = [...base.expectedTaskIds];
  delete sparseItems[0];
  assert.equal(
    evaluateBoundedIntegratedResult({
      ...base,
      expectedTaskIds: sparseItems,
    }),
    null,
  );
});

/**
 * Provider集計はprototype名を通常の観測IDとして決定論的に数えるを検証する。
 *
 * @responsibility Provider集計はprototype名を通常の観測IDとして決定論的に数えるの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider集計はprototype名を通常の観測IDとして決定論的に数えるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("Provider集計はprototype名を通常の観測IDとして決定論的に数える", () => {
  const base = evaluationInput();
  const providers = ["constructor", "toString", "hasOwnProperty"];
  const result = evaluateBoundedIntegratedResult({
    ...base,
    expectedTaskIds: providers.map((_unusedProvider, index) => `task-${index}`),
    taskAttemptEvents: providers.map((provider, index) =>
      event("completed", `task-${index}`, provider),
    ),
  });
  assert.ok(result);
  assert.deepEqual(result.providerAttemptCounts, {
    constructor: 1,
    hasOwnProperty: 1,
    toString: 1,
  });
});

/**
 * 観測時間の合計が安全整数を越える場合は誤った数値を返さないを検証する。
 *
 * @responsibility 観測時間の合計が安全整数を越える場合は誤った数値を返さないの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 観測時間の合計が安全整数を越える場合は誤った数値を返さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("観測時間の合計が安全整数を越える場合は誤った数値を返さない", () => {
  /**
   * maximumEventのTest準備責務を実行する。
   *
   * @responsibility maximumEventがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERP-UT-006
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus maximumEventを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
   */
  const maximumEvent = (taskId: string) => {
    const base = event("completed", taskId);
    return createTaskAttemptSettledEvent({
      occurredAt: base.occurredAt,
      identity: base.identity,
      execution: {
        ...base.execution,
        durationMs: observed(Number.MAX_SAFE_INTEGER, "boundary_fixture"),
      },
      outcome: base.outcome,
      quality: base.quality,
    });
  };
  assert.equal(
    summarizeExecutionIntelligence([
      maximumEvent("task-max-a"),
      maximumEvent("task-max-b"),
      maximumEvent("task-max-c"),
    ]),
    null,
  );
});
