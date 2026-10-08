/**
 * execution-intelligence:unit:event-contractの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility execution-intelligence:unit:event-contractが所有する検証責務を実行する。
 * @trace ERP-UT-006
 * @level UT
 * @scope execution、intelligence、observation、aggregation
 * @boundary ERP-UT-006=N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  BOUNDED_INTEGRATED_RESULT_EVALUATION_INPUT_CONTRACT,
  createTaskAttemptSettledEvent,
  createOperationSettledEvent,
  classifyExecutionUsageCompleteness,
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
 * 任意OperationのIdentityと安全観測のfixtureを構築する。
 * @responsibility Task Identityを含まない有効な入力を供給する。
 * @trace ERP-UT-006
 * @precondition N/A: 固定入力を使用する。
 * @stimulus task fixtureから共通観測だけを取得する。
 * @observation Operation構築入力。
 * @oracle Task Identityが含まれない。
 * @cleanup N/A: 外部資源なし。
 * @boundary ERP-UT-006=Direct Boundary。
 */
function operationInput() {
  const base = event("blocked");
  return {
    occurredAt: base.occurredAt,
    identity: {
      projectId: "project-a",
      operationId: "generate-a",
      executionId: "execution-a",
    },
    execution: {
      ...base.execution,
      provider: observed("provider-a", "runtime_assignment"),
      model: observed("model-a", "runtime_assignment"),
      profileId: observed("profile-a", "runtime_assignment"),
      profileRevision: observed("revision-a", "runtime_assignment"),
      reasoningEffort: observed("low", "runtime_assignment"),
      overrideApplied: observed(true, "runtime_assignment"),
      parentExecutionId: observed("execution-parent", "operation_parent"),
      diagnostic: observed(
        {
          stage: "schema_validation" as const,
          category: "invalid_response" as const,
          httpStatus: 200,
          type: null,
          code: null,
          finishReason: "stop" as const,
          refusal: false,
        },
        "sanitized_adapter",
      ),
      usage: {
        ...usageNotObserved("not_reported"),
        inputTokens: observed(12, "provider_usage"),
        outputTokens: observed(8, "provider_usage"),
      },
    },
    outcome: base.outcome,
    quality: base.quality,
  };
}

/**
 * v2はTaskを持たないOperationの実績と失敗時使用量を保持する。
 * @responsibility generic Identity、親参照、割当、診断、欠測を検証する。
 * @trace ERP-UT-006
 * @precondition schema検査で拒否した観測を用意する。
 * @stimulus Operationイベントを構築し、検査と集計を行う。
 * @observation Identity、観測値、summary。
 * @oracle Taskがなくても有効で、失敗使用量を保持し、費用は欠測。
 * @cleanup N/A: 外部資源なし。
 * @boundary ERP-UT-006=Direct Boundary。
 */
test("v2 generic operation preserves actual assignments diagnostics and failed usage", () => {
  const value = createOperationSettledEvent(operationInput());
  assert.equal(value.contract, "crdd/execution-intelligence-event/v2");
  assert.equal(value.eventType, "operation_settled");
  assert.deepEqual(Object.keys(value.identity).sort(), [
    "executionId",
    "operationId",
    "projectId",
  ]);
  assert.deepEqual(inspectExecutionIntelligenceEvent(value), value);
  assert.equal(value.execution.overrideApplied.state, "observed");
  assert.equal(value.execution.diagnostic.state, "observed");
  assert.equal(value.execution.usage.inputTokens.state, "observed");
  assert.equal(value.execution.usage.costOrCredits.state, "not_observed");
  assert.equal(
    classifyExecutionUsageCompleteness(value.execution.usage),
    "partial",
  );
  const summary = summarizeExecutionIntelligence([value]);
  assert.ok(summary);
  assert.equal(summary.assignmentFullyObservedEventCount, 1);
  assert.equal(summary.diagnosticObservationCount, 1);
  assert.equal(summary.usagePartialEventCount, 1);
  assert.equal(summary.costObservationCount, 0);
});

/**
 * 使用量の非該当と欠測を費用の存在から独立して分類する。
 * @responsibility 固定5fieldの完全性境界を検証する。
 * @trace ERP-UT-006
 * @precondition 全未観測と全非該当の使用量を用意する。
 * @stimulus field別の観測状態を変更する。
 * @observation 完全性分類。
 * @oracle 未観測は0へ補完せず、非該当fieldは完全性の必須集合から除外。
 * @cleanup N/A: 外部資源なし。
 * @boundary ERP-UT-006=Direct Boundary。
 */
test("usage completeness distinguishes missingness and non-applicability without cost guessing", () => {
  assert.equal(
    classifyExecutionUsageCompleteness(usageNotObserved("missing")),
    "not_observed",
  );
  const absent = {
    inputTokens: notApplicable("none"),
    outputTokens: notApplicable("none"),
    cacheReadTokens: notApplicable("none"),
    cacheWriteTokens: notApplicable("none"),
    costOrCredits: notApplicable("none"),
  };
  assert.equal(classifyExecutionUsageCompleteness(absent), "not_applicable");
  assert.equal(
    classifyExecutionUsageCompleteness({
      ...absent,
      inputTokens: observed(0, "receipt"),
    }),
    "complete",
  );
  assert.equal(
    classifyExecutionUsageCompleteness({
      ...absent,
      inputTokens: observed(0, "receipt"),
      costOrCredits: notObserved("cost_not_reported"),
    }),
    "partial",
  );
});

/**
 * v1保存済み記録と任意診断fieldを拒否する。
 * @responsibility 生情報の複製とIdentity混同を防ぐ境界を検証する。
 * @trace ERP-UT-006
 * @precondition 有効Operationと閉じた診断を用意する。
 * @stimulus 生本文、Header、自由code、旧contract、Task Identityを混入する。
 * @observation inspectorとconstructorの拒否。
 * @oracle 不正入力を受理せず、getterを実行しない。
 * @cleanup N/A: 外部資源なし。
 * @boundary ERP-UT-006=Direct Boundary。
 */
test("v2 rejects raw diagnostics invalid optional observations and identity fabrication", () => {
  const input = operationInput();
  assert.ok(input.execution.diagnostic.state === "observed");
  const value = createOperationSettledEvent(input);
  assert.equal(
    inspectExecutionIntelligenceEvent({
      ...value,
      contract: "crdd/execution-intelligence-event/v1",
    }),
    null,
  );
  for (const extra of [
    { message: "raw" },
    { headers: { authorization: "raw" } },
    { code: "arbitrary_provider_text" },
    { httpStatus: 600 },
    { refusal: "false" },
    { stage: "unknown_stage" },
  ]) {
    const diagnostic: Readonly<Record<string, unknown>> = {
      ...input.execution.diagnostic.value,
      ...extra,
    };
    assert.equal(
      inspectExecutionIntelligenceEvent({
        ...value,
        execution: {
          ...value.execution,
          diagnostic: observed(diagnostic, "sanitized_adapter"),
        },
      }),
      null,
    );
  }
  assert.throws(
    () =>
      createOperationSettledEvent({
        ...input,
        identity: { ...input.identity, taskId: "invented" },
      } as never),
    /execution_intelligence_event_invalid/,
  );
  assert.throws(
    () =>
      createOperationSettledEvent({
        ...input,
        execution: { ...input.execution, diagnostic: null },
      } as never),
    /execution_intelligence_event_invalid/,
  );
  assert.throws(
    () =>
      createOperationSettledEvent({
        ...input,
        execution: {
          ...input.execution,
          parentExecutionId: observed("execution-a", "parent"),
        },
      }),
    /execution_intelligence_event_invalid/,
  );
  let calls = 0;
  const accessor = {
    ...input.execution,
    get diagnostic() {
      calls += 1;
      return input.execution.diagnostic;
    },
  };
  assert.throws(
    () => createOperationSettledEvent({ ...input, execution: accessor }),
    /execution_intelligence_event_invalid/,
  );
  assert.equal(calls, 0);
});

/**
 * 旧constructor入力はv2の未観測を明示し、Task限定評価はgenericを拒否する。
 * @responsibility constructor互換と読取り互換の境界を区別する。
 * @trace ERP-UT-006
 * @precondition 追加観測を省略した既存task fixtureを使用する。
 * @stimulus Task構築とgenericのTask限定評価を実行する。
 * @observation 追加観測と評価結果。
 * @oracle v2 shapeは完成し、genericはTaskとして評価されない。
 * @cleanup N/A: 外部資源なし。
 * @boundary ERP-UT-006=Direct Boundary。
 */
test("old task constructor inputs emit v2 missing observations and task evaluation rejects generic operations", () => {
  const value = event();
  assert.equal(value.execution.profileId.state, "not_observed");
  assert.equal(value.execution.diagnostic.state, "not_observed");
  const base = evaluationInput();
  assert.equal(
    evaluateBoundedIntegratedResult({
      ...base,
      taskAttemptEvents: [createOperationSettledEvent(operationInput())],
    }),
    null,
  );
  const { diagnostic: omittedDiagnostic, ...incomplete } = value.execution;
  assert.equal(omittedDiagnostic.state, "not_observed");
  assert.equal(
    inspectExecutionIntelligenceEvent({ ...value, execution: incomplete }),
    null,
  );
});

/**
 * 診断enumは変換可能Objectを受理せず、変換hookも実行しない。
 * @responsibility 診断5fieldのprimitive境界と秘密の非搬送を検証する。
 * @trace ERP-UT-006
 * @precondition 許可enumへ文字列化できるObjectと機密sentinelを各fieldへ用意する。
 * @stimulus inspectorと公開Operation constructorへObject、Proxy、Accessor、各変換hookを投入する。
 * @observation 拒否結果、hook呼出し数、公開結果のserialization。
 * @oracle 全反証を拒否し、hook呼出し0、返却結果にsentinelを含まない。
 * @cleanup N/A: 局所fixtureだけを使用する。
 * @boundary ERP-UT-006=Direct Boundary: 診断入力→公開constructor／inspector。
 */
test("diagnostic enum fields reject object coercion and serialization hooks without executing them", () => {
  const input = operationInput();
  assert.ok(input.execution.diagnostic.state === "observed");
  const baseDiagnostic = input.execution.diagnostic.value;
  const baseEvent = createOperationSettledEvent(input);
  const diagnosticFieldCases = [
    { field: "stage", permittedValue: "http" },
    { field: "category", permittedValue: "quota" },
    { field: "type", permittedValue: "insufficient_quota" },
    { field: "code", permittedValue: "insufficient_quota" },
    { field: "finishReason", permittedValue: "stop" },
  ];
  const secretSentinel = "diagnostic-secret-sentinel-not-for-storage";
  for (const { field, permittedValue } of diagnosticFieldCases) {
    let hookCalls = 0;
    const maliciousFieldValues: readonly unknown[] = [
      { permittedValue, secret: secretSentinel },
      Object(permittedValue),
      {
        secret: secretSentinel,
        toString: () => {
          hookCalls += 1;
          return permittedValue;
        },
        toJSON: () => {
          hookCalls += 1;
          return secretSentinel;
        },
      },
      {
        [Symbol.toPrimitive]: () => {
          hookCalls += 1;
          return permittedValue;
        },
        toJSON: () => {
          hookCalls += 1;
          return secretSentinel;
        },
      },
      {
        toJSON: () => {
          hookCalls += 1;
          return secretSentinel;
        },
      },
      new Proxy(
        {},
        {
          get: () => {
            hookCalls += 1;
            throw new Error("proxy_get_must_not_run");
          },
          getPrototypeOf: () => {
            hookCalls += 1;
            throw new Error("proxy_prototype_must_not_run");
          },
          ownKeys: () => {
            hookCalls += 1;
            throw new Error("proxy_keys_must_not_run");
          },
        },
      ),
    ];
    for (const maliciousValue of maliciousFieldValues) {
      const maliciousDiagnostic = observed(
        { ...baseDiagnostic, [field]: maliciousValue },
        "sanitized_adapter",
      );
      const inspected = inspectExecutionIntelligenceEvent({
        ...baseEvent,
        execution: { ...baseEvent.execution, diagnostic: maliciousDiagnostic },
      });
      assert.equal(inspected, null, `${field}: nonprimitive rejection`);
      assert.equal(JSON.stringify(inspected).includes(secretSentinel), false);
      assert.throws(
        () =>
          createOperationSettledEvent({
            ...input,
            execution: { ...input.execution, diagnostic: maliciousDiagnostic },
          } as never),
        /execution_intelligence_event_invalid/,
      );
      assert.equal(hookCalls, 0, `${field}: conversion hooks must not run`);
    }
    const accessorDiagnostic = { ...baseDiagnostic };
    Object.defineProperty(accessorDiagnostic, field, {
      enumerable: true,
      get: () => {
        hookCalls += 1;
        return permittedValue;
      },
    });
    const accessorObservation = observed(
      accessorDiagnostic,
      "sanitized_adapter",
    );
    assert.equal(
      inspectExecutionIntelligenceEvent({
        ...baseEvent,
        execution: { ...baseEvent.execution, diagnostic: accessorObservation },
      }),
      null,
    );
    assert.throws(
      () =>
        createOperationSettledEvent({
          ...input,
          execution: { ...input.execution, diagnostic: accessorObservation },
        }),
      /execution_intelligence_event_invalid/,
    );
    assert.equal(hookCalls, 0, `${field}: getter must not run`);
  }
  const inspected = inspectExecutionIntelligenceEvent(baseEvent);
  assert.ok(inspected);
  assert.ok(inspected.execution.diagnostic.state === "observed");
  assert.equal(typeof inspected.execution.diagnostic.value.stage, "string");
  assert.equal(JSON.stringify(inspected).includes(secretSentinel), false);
});

/**
 * イベント種別と終端enumでも変換hookを実行しない。
 * @responsibility 診断と同じ非primitive拒否契約をEvent全体へ照合する。
 * @trace ERP-UT-006
 * @precondition 許可値へ変換可能なObjectと秘密sentinelを用意する。
 * @stimulus eventType、outcome.status、outcome.effectStateへ変換ObjectやAccessorを投入する。
 * @observation inspector／constructorの拒否、hook呼出し、返却値。
 * @oracle 不正値を拒否し、hook0、sentinel非搬送を維持する。
 * @cleanup N/A: 局所値以外の資源なし。
 * @boundary ERP-UT-006=Direct Boundary: Event入力→公開値検査。
 */
test("event and outcome enums reject coercion hooks and reconstruct only primitive values", () => {
  const input = operationInput();
  const baseEvent = createOperationSettledEvent(input);
  const eventFieldCases = [
    { field: "eventType", permittedValue: "operation_settled" },
    { field: "status", permittedValue: "blocked" },
    { field: "effectState", permittedValue: "no_effect" },
  ];
  const secretSentinel = "event-enum-secret-sentinel-not-for-storage";
  for (const { field, permittedValue } of eventFieldCases) {
    let hookCalls = 0;
    const maliciousFieldValues: readonly unknown[] = [
      { secret: secretSentinel },
      Object(permittedValue),
      {
        toString: () => {
          hookCalls += 1;
          return permittedValue;
        },
        toJSON: () => {
          hookCalls += 1;
          return secretSentinel;
        },
      },
      {
        [Symbol.toPrimitive]: () => {
          hookCalls += 1;
          return permittedValue;
        },
        toJSON: () => {
          hookCalls += 1;
          return secretSentinel;
        },
      },
      {
        toJSON: () => {
          hookCalls += 1;
          return secretSentinel;
        },
      },
      new Proxy(
        {},
        {
          get: () => {
            hookCalls += 1;
            throw new Error("proxy_must_not_run");
          },
          getPrototypeOf: () => {
            hookCalls += 1;
            throw new Error("proxy_must_not_run");
          },
          ownKeys: () => {
            hookCalls += 1;
            throw new Error("proxy_must_not_run");
          },
        },
      ),
    ];
    for (const maliciousValue of maliciousFieldValues) {
      const eventCandidate =
        field === "eventType"
          ? { ...baseEvent, eventType: maliciousValue }
          : {
              ...baseEvent,
              outcome: { ...baseEvent.outcome, [field]: maliciousValue },
            };
      const inspected = inspectExecutionIntelligenceEvent(eventCandidate);
      assert.equal(inspected, null, `${field}: object rejected`);
      assert.equal(JSON.stringify(inspected).includes(secretSentinel), false);
      const constructorInput =
        field === "eventType"
          ? { ...input, eventType: maliciousValue }
          : {
              ...input,
              outcome: { ...input.outcome, [field]: maliciousValue },
            };
      assert.throws(
        () => createOperationSettledEvent(constructorInput as never),
        /execution_intelligence_event_invalid/,
      );
      assert.equal(hookCalls, 0, `${field}: hooks must not run`);
    }
    const accessorEvent = { ...baseEvent, outcome: { ...baseEvent.outcome } };
    const accessorTarget =
      field === "eventType" ? accessorEvent : accessorEvent.outcome;
    Object.defineProperty(accessorTarget, field, {
      enumerable: true,
      get: () => {
        hookCalls += 1;
        return permittedValue;
      },
    });
    assert.equal(inspectExecutionIntelligenceEvent(accessorEvent), null);
    const accessorInput =
      field === "eventType"
        ? { ...input, eventType: undefined }
        : { ...input, outcome: accessorEvent.outcome };
    if (field === "eventType")
      Object.defineProperty(accessorInput, field, {
        enumerable: true,
        get: () => {
          hookCalls += 1;
          return permittedValue;
        },
      });
    assert.throws(
      () => createOperationSettledEvent(accessorInput as never),
      /execution_intelligence_event_invalid/,
    );
    assert.equal(hookCalls, 0, `${field}: accessor must not run`);
  }
  const inspected = inspectExecutionIntelligenceEvent(baseEvent);
  assert.ok(inspected);
  assert.equal(typeof inspected.eventType, "string");
  assert.equal(typeof inspected.outcome.status, "string");
  assert.equal(typeof inspected.outcome.effectState, "string");
  assert.equal(JSON.stringify(inspected).includes(secretSentinel), false);
});

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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
   * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
      source: "orchestrator_integration",
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
   * @boundary ERP-UT-006=Direct Boundary: execution-intelligence Test Source→対象契約
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
