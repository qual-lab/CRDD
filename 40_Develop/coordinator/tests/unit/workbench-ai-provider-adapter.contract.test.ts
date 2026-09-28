/**
 * Workbench AI Provider Adapterの固定選択契約を検証する。
 *
 * @packageDocumentation
 * @responsibility exact Profile伝播、Provider分岐、Effect前拒否およびfallback禁止を検証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Provider非依存Adapterと固定Fake Executorの局所境界。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_AI_PROFILE_CATALOG,
  resolveAiProfileById,
} from "../../../ai-runtime/src/catalog.ts";
import { prepareWorkbenchAiAdviceTask } from "../../src/security/workbench-ai-advice-task.ts";
import { createWorkbenchAiProviderAdapter } from "../../src/security/workbench-ai-provider-adapter.ts";

const profile = resolveAiProfileById(
  DEFAULT_AI_PROFILE_CATALOG,
  "PROFILE-100001",
);
if (profile === null) throw new Error("test_profile_required");
const prepared = prepareWorkbenchAiAdviceTask({
  profileId: profile.profileId,
  prompt: "現在状態を説明する",
  projection: [
    {
      reference: "PROJECT_CONTEXT.md",
      content: "# Project Context\n",
      sha256:
        "f2e9caaf190981cfb75bb7e6ff59e7609b79b8e79280a721701dc88cfcef607d",
    },
  ],
});
if (prepared.status !== "prepared" || prepared.taskPacket === null)
  throw new Error("test_task_packet_required");

/**
 * exact Codex Profileを変更せず一つのExecutorへ渡すを検証する。
 *
 * @responsibility exact Codex Profileを変更せず一つのExecutorへ渡すを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus exact Codex Profileを変更せず一つのExecutorへ渡すの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("exact Codex Profileを変更せず一つのExecutorへ渡す", async () => {
  let codexInput: unknown = null;
  let claudeCalls = 0;
  const adapter = createWorkbenchAiProviderAdapter({
    codex: async (input) => {
      codexInput = input;
      return Object.freeze({
        status: "blocked" as const,
        reason: "fixture_completed",
        rawOutput: null,
        providerEffectIssued: false,
        cleanupConfirmed: true,
      });
    },
    claude: async () => {
      claudeCalls += 1;
      throw new Error("unreachable");
    },
  });
  const result = await adapter(
    Object.freeze({
      taskPacket: prepared.taskPacket,
      catalogRevision: 1,
      profile,
    }),
    new AbortController().signal,
  );
  assert.equal(result.reason, "fixture_completed");
  assert.equal(typeof codexInput, "object");
  const { providerCommand, ...flatInput } = codexInput as Record<
    string,
    unknown
  >;
  assert.deepEqual(flatInput, {
    contract: "crdd-coordinator/workbench-ai-advice-execution-plan",
    contractRevision: 1,
    mode: "workbench_advice",
    catalogRevision: 1,
    provider: profile.provider,
    providerPrompt: prepared.taskPacket.providerPrompt,
    taskHash: prepared.taskPacket.taskHash,
    projectionHash: prepared.taskPacket.projectionHash,
    profileId: profile.profileId,
    exactModelId: profile.exactModelId,
    reasoningEffort: profile.defaultReasoningEffort,
    offering: profile.offering,
    promptTransport: "stdin",
    repositoryMounted: false,
    workspaceMounted: false,
    toolsAllowed: false,
    sessionPersistenceAllowed: false,
    apiKeyFallbackAllowed: false,
    paidApiFallbackAllowed: false,
  });
  assert.deepEqual(
    {
      provider: (providerCommand as { provider: unknown }).provider,
      exactModelId: (providerCommand as { exactModelId: unknown }).exactModelId,
      reasoningEffort: (providerCommand as { reasoningEffort: unknown })
        .reasoningEffort,
      repositoryMounted: (providerCommand as { repositoryMounted: unknown })
        .repositoryMounted,
      workspaceMountRequired: (
        providerCommand as { workspaceMountRequired: unknown }
      ).workspaceMountRequired,
      toolsAllowed: (providerCommand as { toolsAllowed: unknown }).toolsAllowed,
    },
    {
      provider: "codex",
      exactModelId: profile.exactModelId,
      reasoningEffort: profile.defaultReasoningEffort,
      repositoryMounted: false,
      workspaceMountRequired: false,
      toolsAllowed: false,
    },
  );
  assert.equal(claudeCalls, 0);
});

/**
 * Profile契約不整合を全Executor Effect前に拒否するを検証する。
 *
 * @responsibility Profile契約不整合を全Executor Effect前に拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Profile契約不整合を全Executor Effect前に拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Profile契約不整合を全Executor Effect前に拒否する", async () => {
  let calls = 0;
  const adapter = createWorkbenchAiProviderAdapter({
    codex: async () => {
      calls += 1;
      throw new Error("unreachable");
    },
    claude: async () => {
      calls += 1;
      throw new Error("unreachable");
    },
  });
  const result = await adapter(
    Object.freeze({
      taskPacket: prepared.taskPacket,
      catalogRevision: 1,
      profile: Object.freeze({
        ...profile,
        offering: "claude_max" as const,
      }),
    }),
    new AbortController().signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "workbench_ai_provider_profile_invalid");
  assert.equal(result.providerEffectIssued, false);
  assert.equal(calls, 0);
});
