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
} from "../../../../ai-adapter/src/catalog/resolve.ts";
import type { ResolvedAiProfileIdentity } from "../../../../ai-adapter/src/catalog/types.ts";
import type { WorkbenchAiProviderExecutionInput } from "../../../src/workbench-ai/advice-execution-plan.ts";
import { prepareWorkbenchAiAdviceExecutionPlan } from "../../../src/workbench-ai/advice-execution-plan.ts";

const taskHash = "a".repeat(64);
const projectionHash = "b".repeat(64);

/**
 * Catalog Profileから正常な実行入力を生成する。
 *
 * @responsibility 各反例が一項目だけを変更できる基準入力を提供する。
 * @trace ERB-UT-023
 * @input profile: Catalogから解決済みのProfile Identity、catalogRevision: 実行入力へ設定するCatalog改訂（既定値1）。
 * @returns Workbench助言実行計画の正常入力。
 * @precondition profileはcoordinator Roleを持ち、catalogRevisionは0以上のsafe integerであり、0は検証済み既定Catalogを表す。
 * @postcondition Hash、Prompt、指定されたCatalog改訂を含む全Propertyが埋まる。
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
  catalogRevision = 1,
): WorkbenchAiProviderExecutionInput {
  return Object.freeze({
    catalogRevision,
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

/**
 * 永続Snapshot未作成の既定Catalog revision 0を実行計画へ受理する。
 *
 * @responsibility 解決済みProfileとRevision 0を変更せず実行計画へ固定する回帰保証を所有する。
 * @trace ERB-UT-023
 * @precondition 検証済み既定CatalogのCoordinator Profileを使用する。
 * @stimulus catalogRevision 0で実行計画を生成する。
 * @observation 生成状態と計画内revisionを観測する。
 * @oracle preparedとなり、revision 0が変更されず保持される。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: 解決済みAI Profile／Catalog Revision→助言実行計画
 */
test("既定Catalog revision 0を助言実行計画へ受理する", () => {
  const profile = resolveAiProfileById(
    DEFAULT_AI_PROFILE_CATALOG,
    "PROFILE-100001",
  );
  assert.notEqual(profile, null);
  const result = prepareWorkbenchAiAdviceExecutionPlan(
    executionInput(profile as ResolvedAiProfileIdentity, 0),
    profile as ResolvedAiProfileIdentity,
  );
  assert.equal(result.status, "prepared");
  assert.equal(result.executionPlan?.catalogRevision, 0);
});

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
    "負のCatalog revision",
    { ...executionInput(codexProfile), catalogRevision: -1 },
  ],
  [
    "小数のCatalog revision",
    { ...executionInput(codexProfile), catalogRevision: 0.5 },
  ],
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
