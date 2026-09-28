/**
 * Workbench AI読取り助言Dispatch Runtimeの契約試験。
 *
 * @responsibility 一回確認、Identity拘束、取消、Effect不明、cleanupおよび結果Schemaを検証する。
 * @trace ERB-UT-023 ERB-IT-004
 * @boundary Coordinator Dispatchと固定Fake Provider Adapterの局所境界。
 * @effect 外部Providerを使わず、Process内Fake Adapterだけを実行する。
 * @security 生Provider出力、CredentialまたはRepository Pathを外部へ送信しない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_AI_PROFILE_CATALOG,
  resolveAiProfileById,
} from "../../../ai-runtime/src/index.ts";
import { createWorkbenchAiAdviceDispatchRuntime } from "../../src/security/workbench-ai-advice-dispatch-runtime.ts";
import { prepareWorkbenchAiAdviceTask } from "../../src/security/workbench-ai-advice-task.ts";

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

const rawResult = JSON.stringify({
  contract: "crdd-coordinator/workbench-ai-advice-result",
  contractRevision: 1,
  status: "completed",
  facts: [{ text: "現在状態を確認した", references: ["PROJECT_CONTEXT.md"] }],
  sharedAnalysis: [],
  additionalInferences: [],
  nextOptions: [{ text: "次の確認へ進む", references: ["PROJECT_CONTEXT.md"] }],
});

function dispatchInput(externalSendConfirmed = true) {
  return Object.freeze({
    taskPacket,
    catalogRevision: 1,
    profile,
    externalSendConfirmed,
  });
}

test("明示確認済みの一依頼だけをProviderへ渡して根拠付き結果を返す", async () => {
  let calls = 0;
  const dispatch = createWorkbenchAiAdviceDispatchRuntime(async () => {
    calls += 1;
    return Object.freeze({
      status: "completed" as const,
      reason: null,
      rawOutput: rawResult,
      providerEffectIssued: true,
      cleanupConfirmed: true,
    });
  });
  const result = await dispatch(dispatchInput(), new AbortController().signal);
  assert.equal(result.status, "completed");
  assert.equal(calls, 1);
  assert.equal(result.facts[0]?.references[0], "PROJECT_CONTEXT.md");
});

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

test("cleanupを確認できない完了をunknownへ保つ", async () => {
  const dispatch = createWorkbenchAiAdviceDispatchRuntime(async () =>
    Object.freeze({
      status: "completed" as const,
      reason: null,
      rawOutput: rawResult,
      providerEffectIssued: true,
      cleanupConfirmed: false,
    }),
  );
  const result = await dispatch(dispatchInput(), new AbortController().signal);
  assert.equal(result.status, "unknown");
  assert.equal(result.reason, "workbench_ai_provider_cleanup_unknown");
});

test("投影外参照を含むProvider結果を部分公開せず拒否する", async () => {
  const dispatch = createWorkbenchAiAdviceDispatchRuntime(async () =>
    Object.freeze({
      status: "completed" as const,
      reason: null,
      rawOutput: rawResult.replace('PROJECT_CONTEXT.md"', 'OTHER.md"'),
      providerEffectIssued: true,
      cleanupConfirmed: true,
    }),
  );
  const result = await dispatch(dispatchInput(), new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(result.facts.length, 0);
});

test("Provider例外後はEffect不存在を推測せずunknownへ保つ", async () => {
  const dispatch = createWorkbenchAiAdviceDispatchRuntime(async () => {
    throw new Error("provider failed after an unknown boundary");
  });
  const result = await dispatch(dispatchInput(), new AbortController().signal);
  assert.equal(result.status, "unknown");
  assert.equal(result.reason, "workbench_ai_provider_effect_state_unknown");
});

test("Provider Effect後の取消競合をcompletedへ畳まない", async () => {
  const controller = new AbortController();
  const dispatch = createWorkbenchAiAdviceDispatchRuntime(async () => {
    controller.abort();
    return Object.freeze({
      status: "completed" as const,
      reason: null,
      rawOutput: rawResult,
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
