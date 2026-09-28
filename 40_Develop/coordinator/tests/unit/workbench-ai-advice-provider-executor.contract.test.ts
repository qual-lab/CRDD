/**
 * Workbench助言Provider ExecutorのLifecycle契約を検証する。
 *
 * @responsibility Effect前拒否、exact計画伝播、取消、cleanup、出力抽出および例外Fail-closedを検証する。
 * @trace ERB-UT-023 ERB-IT-004
 * @boundary Provider AdapterとFake Runtime Portの局所境界。
 * @effect 外部Providerを使わずProcess内Fake Runtimeだけを実行する。
 * @security Credential、Repository Pathおよび外部Networkを使用しない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_AI_PROFILE_CATALOG,
  resolveAiProfileById,
} from "../../../ai-runtime/src/catalog.ts";
import { prepareWorkbenchAiAdviceExecutionPlan } from "../../src/security/workbench-ai-advice-execution-plan.ts";
import { createWorkbenchAiAdviceProviderExecutor } from "../../src/security/workbench-ai-advice-provider-executor.ts";

const profile = resolveAiProfileById(
  DEFAULT_AI_PROFILE_CATALOG,
  "PROFILE-100001",
);
if (profile === null) throw new Error("test_profile_required");
const prepared = prepareWorkbenchAiAdviceExecutionPlan(
  Object.freeze({
    catalogRevision: 1,
    provider: profile.provider,
    providerPrompt: "固定投影だけを根拠に説明する",
    taskHash: "a".repeat(64),
    projectionHash: "b".repeat(64),
    profileId: profile.profileId,
    exactModelId: profile.exactModelId,
    reasoningEffort: profile.defaultReasoningEffort,
    offering: profile.offering,
  }),
  profile,
);
if (prepared.status !== "prepared" || prepared.executionPlan === null)
  throw new Error("test_execution_plan_required");
const executionPlan = prepared.executionPlan;
const advice = JSON.stringify({
  contract: "crdd-coordinator/workbench-ai-advice-result",
  contractRevision: 1,
  status: "completed",
  facts: [{ text: "現在値", references: ["PROJECT_CONTEXT.md"] }],
  sharedAnalysis: [],
  additionalInferences: [],
  nextOptions: [],
});

test("exact計画とPromptを一回だけRuntimeへ渡して抽出済み助言JSONを受け取る", async () => {
  let calls = 0;
  const executor = createWorkbenchAiAdviceProviderExecutor(async (plan) => {
    calls += 1;
    assert.equal(plan, executionPlan);
    return Object.freeze({
      status: "completed" as const,
      reason: null,
      adviceJson: advice,
      providerEffectIssued: true as const,
      cleanupConfirmed: true as const,
    });
  });
  const result = await executor(executionPlan, new AbortController().signal);
  assert.equal(calls, 1);
  assert.deepEqual(result, {
    status: "completed",
    reason: null,
    rawOutput: advice,
    providerEffectIssued: true,
    cleanupConfirmed: true,
  });
});

test("事前取消はRuntime Effect 0で拒否する", async () => {
  let calls = 0;
  const executor = createWorkbenchAiAdviceProviderExecutor(async () => {
    calls += 1;
    throw new Error("unreachable");
  });
  const controller = new AbortController();
  controller.abort();
  const result = await executor(executionPlan, controller.signal);
  assert.equal(result.status, "blocked");
  assert.equal(result.providerEffectIssued, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(calls, 0);
});

test("Runtime拒否とcleanup未確認をcompletedへ昇格しない", async () => {
  const executor = createWorkbenchAiAdviceProviderExecutor(async () =>
    Object.freeze({
      status: "blocked" as const,
      reason: "runtime_cleanup_unknown",
      adviceJson: null,
      providerEffectIssued: true,
      cleanupConfirmed: false,
    }),
  );
  const result = await executor(executionPlan, new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "runtime_cleanup_unknown");
  assert.equal(result.providerEffectIssued, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.rawOutput, null);
});

test("Runtime例外はEffect発行可能性とcleanup不明を保持する", async () => {
  const executor = createWorkbenchAiAdviceProviderExecutor(async () => {
    throw new Error("provider failed");
  });
  const result = await executor(executionPlan, new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "workbench_ai_advice_runtime_failed_closed");
  assert.equal(result.providerEffectIssued, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.rawOutput, null);
});
