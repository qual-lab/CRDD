/**
 * Workbench AI助言の固定実行計画契約を検証する。
 *
 * @packageDocumentation
 * @responsibility Codex／Claudeのexact Profile伝播と、Repository非共有境界および不正候補のEffect前拒否を検証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary 検証済みProvider入力と純粋な実行計画生成の局所境界。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_AI_PROFILE_CATALOG,
  resolveAiProfileById,
} from "../../../ai-runtime/src/catalog.ts";
import type { ResolvedAiProfileIdentity } from "../../../ai-runtime/src/ai-profile-types.ts";
import type { WorkbenchAiProviderExecutionInput } from "../../src/security/workbench-ai-advice-execution-plan.ts";
import { prepareWorkbenchAiAdviceExecutionPlan } from "../../src/security/workbench-ai-advice-execution-plan.ts";

const taskHash = "a".repeat(64);
const projectionHash = "b".repeat(64);

/**
 * Catalog Profileから正常な実行入力を生成する。
 *
 * @responsibility 各反例が一項目だけを変更できる基準入力を提供する。
 * @trace ERB-UT-023
 * @input profile: Catalogから解決済みのProfile Identity。
 * @returns Workbench助言実行計画の正常入力。
 * @precondition profileはcoordinator Roleを持つ。
 * @postcondition Hash、Prompt、Catalog改訂を含む全Propertyが埋まる。
 * @effect N/A: 固定Fixtureを生成するだけである。
 * @failure N/A: 入力を一意に写像するだけである。
 * @invariant ProfileのProvider、Model、推論強度、Offeringを変更しない。
 * @stimulus executionInputの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 * @security 秘密値、Repository Pathおよび外部送信Authorityを含めない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function executionInput(
  profile: ResolvedAiProfileIdentity,
): WorkbenchAiProviderExecutionInput {
  return Object.freeze({
    catalogRevision: 1,
    provider: profile.provider,
    providerPrompt: "固定投影だけを根拠に現在状態を説明する",
    taskHash: taskHash,
    projectionHash: projectionHash,
    profileId: profile.profileId,
    exactModelId: profile.exactModelId,
    reasoningEffort: profile.defaultReasoningEffort,
    offering: profile.offering,
  });
}

for (const profileId of ["PROFILE-100001", "PROFILE-200001"] as const) {
  /**
   * ${profileId}をRepository非共有のexact実行計画へ変換するを検証する。
   *
   * @responsibility ${profileId}をRepository非共有のexact実行計画へ変換するを検証するの検証責務を所有する。
   * @trace ERB-UT-023
   * @precondition 対象契約を再現できる固定入力と依存を用意する。
   * @stimulus ${profileId}をRepository非共有のexact実行計画へ変換するの対象操作を実行する。
   * @observation 返却値、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionがSummaryの期待条件を満たす。
   * @cleanup N/A: Process外資源を生成しない局所検証である。
   * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`${profileId}をRepository非共有のexact実行計画へ変換する`, () => {
    const profile = resolveAiProfileById(DEFAULT_AI_PROFILE_CATALOG, profileId);
    assert.notEqual(profile, null);
    const result = prepareWorkbenchAiAdviceExecutionPlan(
      executionInput(profile as ResolvedAiProfileIdentity),
      profile as ResolvedAiProfileIdentity,
    );
    assert.equal(result.status, "prepared");
    assert.notEqual(result.executionPlan, null);
    const { providerCommand, ...executionPlan } = result.executionPlan ?? {
      providerCommand: null,
    };
    assert.deepEqual(executionPlan, {
      contract: "crdd-coordinator/workbench-ai-advice-execution-plan",
      contractRevision: 1,
      mode: "workbench_advice",
      catalogRevision: 1,
      provider: profile?.provider,
      profileId,
      exactModelId: profile?.exactModelId,
      reasoningEffort: profile?.defaultReasoningEffort,
      offering: profile?.offering,
      providerPrompt: "固定投影だけを根拠に現在状態を説明する",
      promptTransport: "stdin",
      taskHash: taskHash,
      projectionHash: projectionHash,
      repositoryMounted: false,
      workspaceMounted: false,
      toolsAllowed: false,
      sessionPersistenceAllowed: false,
      apiKeyFallbackAllowed: false,
      paidApiFallbackAllowed: false,
    });
    assert.equal(providerCommand?.provider, profile?.provider);
    assert.equal(providerCommand?.exactModelId, profile?.exactModelId);
    assert.equal(
      providerCommand?.reasoningEffort,
      profile?.defaultReasoningEffort,
    );
    assert.equal(providerCommand?.promptTransport, "stdin_only");
    assert.equal(providerCommand?.repositoryMounted, false);
    assert.equal(providerCommand?.workspaceMountRequired, false);
    assert.equal(providerCommand?.toolsAllowed, false);
    assert.equal(providerCommand?.sessionPersistenceAllowed, false);
    assert.equal(
      providerCommand?.argv.includes("固定投影だけを根拠に現在状態を説明する"),
      false,
    );
    assert.equal(
      providerCommand?.provider === "codex"
        ? providerCommand.argv.at(-1) === "-"
        : providerCommand?.argv.includes("-p"),
      true,
    );
  });
}

const codexProfile = resolveAiProfileById(
  DEFAULT_AI_PROFILE_CATALOG,
  "PROFILE-100001",
);
if (codexProfile === null) throw new Error("test_profile_required");

for (const [name, candidate] of [
  [
    "Offering不一致",
    { ...executionInput(codexProfile), offering: "claude_max" },
  ],
  ["Model不一致", { ...executionInput(codexProfile), exactModelId: "opus" }],
  ["Provider不一致", { ...executionInput(codexProfile), provider: "claude" }],
  ["Task Hash不正", { ...executionInput(codexProfile), taskHash: "invalid" }],
  [
    "未知Property混入",
    { ...executionInput(codexProfile), command: "arbitrary-command" },
  ],
] as const) {
  /**
   * ${name}を実行計画生成前に拒否するを検証する。
   *
   * @responsibility ${name}を実行計画生成前に拒否するを検証するの検証責務を所有する。
   * @trace ERB-UT-023
   * @precondition 対象契約を再現できる固定入力と依存を用意する。
   * @stimulus ${name}を実行計画生成前に拒否するの対象操作を実行する。
   * @observation 返却値、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionがSummaryの期待条件を満たす。
   * @cleanup N/A: Process外資源を生成しない局所検証である。
   * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`${name}を実行計画生成前に拒否する`, () => {
    const result = prepareWorkbenchAiAdviceExecutionPlan(
      candidate as WorkbenchAiProviderExecutionInput,
      codexProfile,
    );
    assert.deepEqual(result, {
      status: "blocked",
      reason: "workbench_ai_advice_execution_plan_invalid",
      executionPlan: null,
    });
  });
}
