/**
 * Workbench AI読取り助言Dispatch Runtimeの契約試験。
 *
 * @packageDocumentation
 * @responsibility 一回確認、Identity拘束、取消、Effect不明、cleanupおよび結果Schemaを検証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Coordinator Dispatchと固定Fake Provider Adapterの局所境界。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_AI_PROFILE_CATALOG,
  resolveAiProfileById,
} from "../../../../ai-adapter/src/index.ts";
import { createWorkbenchAiAdviceDispatchRuntime } from "../../../src/workbench-ai/advice-dispatch.ts";
import { prepareWorkbenchAiAdviceTask } from "../../../src/workbench-ai/advice-task.ts";

const resolvedProfile = resolveAiProfileById(
  DEFAULT_AI_PROFILE_CATALOG,
  "PROFILE-100001",
);
if (resolvedProfile === null) throw new Error("test_profile_required");
const profile = resolvedProfile;

const prepared = prepareWorkbenchAiAdviceTask({
  profileId: profile.profileId,
  prompt: "現在の状況と次の選択肢を整理する",
  projection: [
    {
      reference: "PROJECT_CONTEXT.md",
      content: "# Project Context\n\nStatus: Current\n",
      sha256:
        "cd23b32223047696c7913a695cfc289cb39afbaa4874b13247bfdaf90d6732cc",
    },
  ],
});
assert.equal(prepared.status, "prepared");
assert.ok(prepared.taskPacket);
if (prepared.taskPacket === null) throw new Error("test_task_packet_required");
const taskPacket = prepared.taskPacket;

const RAW_RESULT = JSON.stringify({
  contract: "crdd-coordinator/workbench-ai-advice-result",
  contractRevision: 1,
  status: "completed",
  facts: [{ text: "現在状態を確認した", references: ["PROJECT_CONTEXT.md"] }],
  sharedAnalysis: [],
  additionalInferences: [],
  nextOptions: [{ text: "次の確認へ進む", references: ["PROJECT_CONTEXT.md"] }],
});

/**
 * dispatchInput用の試験入力または観測処理を提供する。
 *
 * @responsibility dispatchInput用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus dispatchInputの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
function dispatchInput(externalSendConfirmed = true) {
  return Object.freeze({
    taskPacket,
    catalogRevision: 1,
    profile,
    externalSendConfirmed,
  });
}

/**
 * 明示確認済みの一依頼だけをProviderへ渡して根拠付き結果を返すを検証する。
 *
 * @responsibility 明示確認済みの一依頼だけをProviderへ渡して根拠付き結果を返すを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 明示確認済みの一依頼だけをProviderへ渡して根拠付き結果を返すの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("明示確認済みの一依頼だけをProviderへ渡して根拠付き結果を返す", async () => {
  let calls = 0;
  const dispatch = createWorkbenchAiAdviceDispatchRuntime(async () => {
    calls += 1;
    return Object.freeze({
      status: "completed" as const,
      reason: null,
      rawOutput: RAW_RESULT,
      providerEffectIssued: true,
      cleanupConfirmed: true,
    });
  });
  const result = await dispatch(dispatchInput(), new AbortController().signal);
  assert.equal(result.status, "completed");
  assert.equal(calls, 1);
  assert.equal(result.facts[0]?.references[0], "PROJECT_CONTEXT.md");
});

/**
 * 外部送信の明示確認がなければEffect 0で拒否するを検証する。
 *
 * @responsibility 外部送信の明示確認がなければEffect 0で拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 外部送信の明示確認がなければEffect 0で拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("外部送信の明示確認がなければEffect 0で拒否する", async () => {
  let calls = 0;
  const dispatch = createWorkbenchAiAdviceDispatchRuntime(async () => {
    calls += 1;
    throw new Error("unreachable");
  });
  const result = await dispatch(
    dispatchInput(false),
    new AbortController().signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "workbench_ai_external_send_confirmation_required",
  );
  assert.equal(calls, 0);
});

/**
 * Effect前の取消ではProviderを呼ばないを検証する。
 *
 * @responsibility Effect前の取消ではProviderを呼ばないを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Effect前の取消ではProviderを呼ばないの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Effect前の取消ではProviderを呼ばない", async () => {
  let calls = 0;
  const dispatch = createWorkbenchAiAdviceDispatchRuntime(async () => {
    calls += 1;
    throw new Error("unreachable");
  });
  const controller = new AbortController();
  controller.abort();
  const result = await dispatch(dispatchInput(), controller.signal);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_ai_request_cancelled");
  assert.equal(calls, 0);
});

/**
 * cleanupを確認できない完了をunknownへ保つを検証する。
 *
 * @responsibility cleanupを確認できない完了をunknownへ保つを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus cleanupを確認できない完了をunknownへ保つの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("cleanupを確認できない完了をunknownへ保つ", async () => {
  const dispatch = createWorkbenchAiAdviceDispatchRuntime(async () =>
    Object.freeze({
      status: "completed" as const,
      reason: null,
      rawOutput: RAW_RESULT,
      providerEffectIssued: true,
      cleanupConfirmed: false,
    }),
  );
  const result = await dispatch(dispatchInput(), new AbortController().signal);
  assert.equal(result.status, "unknown");
  assert.equal(result.reason, "workbench_ai_provider_cleanup_unknown");
});

/**
 * 投影外参照を含むProvider結果を部分公開せず拒否するを検証する。
 *
 * @responsibility 投影外参照を含むProvider結果を部分公開せず拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 投影外参照を含むProvider結果を部分公開せず拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("投影外参照を含むProvider結果を部分公開せず拒否する", async () => {
  const dispatch = createWorkbenchAiAdviceDispatchRuntime(async () =>
    Object.freeze({
      status: "completed" as const,
      reason: null,
      rawOutput: RAW_RESULT.replace('PROJECT_CONTEXT.md"', 'OTHER.md"'),
      providerEffectIssued: true,
      cleanupConfirmed: true,
    }),
  );
  const result = await dispatch(dispatchInput(), new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(result.facts.length, 0);
});

/**
 * Provider例外後はEffect不存在を推測せずunknownへ保つを検証する。
 *
 * @responsibility Provider例外後はEffect不存在を推測せずunknownへ保つを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Provider例外後はEffect不存在を推測せずunknownへ保つの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider例外後はEffect不存在を推測せずunknownへ保つ", async () => {
  const dispatch = createWorkbenchAiAdviceDispatchRuntime(async () => {
    throw new Error("provider failed after an unknown boundary");
  });
  const result = await dispatch(dispatchInput(), new AbortController().signal);
  assert.equal(result.status, "unknown");
  assert.equal(result.reason, "workbench_ai_provider_effect_state_unknown");
});

/**
 * Provider Effect後の取消競合をcompletedへ畳まないを検証する。
 *
 * @responsibility Provider Effect後の取消競合をcompletedへ畳まないを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Provider Effect後の取消競合をcompletedへ畳まないの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider Effect後の取消競合をcompletedへ畳まない", async () => {
  const controller = new AbortController();
  const dispatch = createWorkbenchAiAdviceDispatchRuntime(async () => {
    controller.abort();
    return Object.freeze({
      status: "completed" as const,
      reason: null,
      rawOutput: RAW_RESULT,
      providerEffectIssued: true,
      cleanupConfirmed: true,
    });
  });
  const result = await dispatch(dispatchInput(), controller.signal);
  assert.equal(result.status, "unknown");
  assert.equal(
    result.reason,
    "workbench_ai_provider_effect_after_cancellation_unknown",
  );
});
