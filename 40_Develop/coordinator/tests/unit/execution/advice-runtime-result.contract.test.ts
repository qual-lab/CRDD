/**
 * Workbench助言Adapterの一回実行・取消・結果受理を検証する。
 *
 * @packageDocumentation
 * @responsibility Effect前拒否、exact計画伝播、取消、cleanup、出力抽出および例外Fail-closedを検証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Provider AdapterとFake Runtime Portの局所境界。
 */
import assert from "node:assert/strict";
import { fixtureNetworkPolicy } from "../../fixtures/network-policy.ts";
import test from "node:test";

import { executionSelection } from "../../fixtures/ai-selection.ts";
import { prepareProviderAdvicePlan } from "../../../src/execution/preparation.ts";
import { createProviderAdviceAdapter } from "../../../src/execution/advice.ts";
import { prepareAdviceTask } from "../../../src/execution/preparation.ts";

const selection = executionSelection("advice");
const task = prepareAdviceTask({
  executionSelection: selection,
  prompt: "固定投影だけを根拠に説明する",
  projection: [
    {
      reference: "PROJECT_CONTEXT.md",
      content: "# Project Context\n",
      sha256:
        "f2e9caaf190981cfb75bb7e6ff59e7609b79b8e79280a721701dc88cfcef607d",
    },
  ],
});
if (!task.taskPacket) throw new Error("test_task_required");
const dispatchInput = {
  networkPolicy: fixtureNetworkPolicy(selection.provider),
  taskPacket: task.taskPacket,
  executionSelection: selection,
};
const prepared = prepareProviderAdvicePlan(
  Object.freeze({
    networkPolicy: fixtureNetworkPolicy(selection.provider),
    provider: selection.provider,
    providerPrompt: task.taskPacket.providerPrompt,
    allowedReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
    taskHash: task.taskPacket.taskHash,
    projectionHash: task.taskPacket.projectionHash,
    executionSelection: selection,
    exactModelId: selection.modelIdentifier,
    reasoningEffort: selection.reasoningEffort,
    offering:
      selection.provider === "codex"
        ? ("chatgpt_subscription_oauth" as const)
        : ("claude_max" as const),
  }),
);
if (prepared.status !== "prepared" || prepared.executionPlan === null)
  throw new Error("test_execution_plan_required");
const executionPlan = prepared.executionPlan;
const ADVICE = JSON.stringify({
  status: "completed",
  facts: [{ text: "現在値", references: ["PROJECT_CONTEXT.md"] }],
  sharedAnalysis: [],
  additionalInferences: [],
  nextOptions: [],
});

/**
 * exact計画とPromptを一回だけRuntimeへ渡して抽出済み助言JSONを受け取るを検証する。
 *
 * @responsibility exact計画とPromptを一回だけRuntimeへ渡して抽出済み助言JSONを受け取るを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus exact計画とPromptを一回だけRuntimeへ渡して抽出済み助言JSONを受け取るの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("exact計画とPromptを一回だけRuntimeへ渡して抽出済み助言JSONを受け取る", async () => {
  let calls = 0;
  const executor = createProviderAdviceAdapter(async (plan) => {
    calls += 1;
    assert.deepEqual(plan, executionPlan);
    return Object.freeze({
      status: "completed" as const,
      reason: null,
      adviceJson: ADVICE,
      providerEffectIssued: true as const,
      cleanupConfirmed: true as const,
    });
  });
  const result = await executor(dispatchInput, new AbortController().signal);
  assert.equal(calls, 1);
  assert.deepEqual(result, {
    status: "completed",
    reason: null,
    rawOutput: ADVICE,
    providerEffectIssued: true,
    cleanupConfirmed: true,
  });
});

/**
 * 事前取消はRuntime Effect 0で拒否するを検証する。
 *
 * @responsibility 事前取消はRuntime Effect 0で拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 事前取消はRuntime Effect 0で拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("事前取消はRuntime Effect 0で拒否する", async () => {
  let calls = 0;
  const executor = createProviderAdviceAdapter(async () => {
    calls += 1;
    throw new Error("unreachable");
  });
  const controller = new AbortController();
  controller.abort();
  const result = await executor(dispatchInput, controller.signal);
  assert.equal(result.status, "blocked");
  assert.equal(result.providerEffectIssued, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(calls, 0);
});

/**
 * Runtime拒否とcleanup未確認をcompletedへ昇格しないを検証する。
 *
 * @responsibility Runtime拒否とcleanup未確認をcompletedへ昇格しないを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Runtime拒否とcleanup未確認をcompletedへ昇格しないの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Runtime拒否とcleanup未確認をcompletedへ昇格しない", async () => {
  const executor = createProviderAdviceAdapter(async () =>
    Object.freeze({
      status: "blocked" as const,
      reason: "runtime_cleanup_unknown",
      adviceJson: null,
      providerEffectIssued: true,
      cleanupConfirmed: false,
    }),
  );
  const result = await executor(dispatchInput, new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "runtime_cleanup_unknown");
  assert.equal(result.providerEffectIssued, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.rawOutput, null);
});

/**
 * Runtime例外はEffect発行可能性とcleanup不明を保持するを検証する。
 *
 * @responsibility Runtime例外はEffect発行可能性とcleanup不明を保持するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Runtime例外はEffect発行可能性とcleanup不明を保持するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Runtime例外はEffect発行可能性とcleanup不明を保持する", async () => {
  const executor = createProviderAdviceAdapter(async () => {
    throw new Error("provider failed");
  });
  const result = await executor(dispatchInput, new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "workbench_ai_advice_runtime_failed_closed");
  assert.equal(result.providerEffectIssued, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.rawOutput, null);
});
