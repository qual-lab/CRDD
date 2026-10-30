/**
 * 固定した助言選定と非共有実行計画を検証する。
 * @packageDocumentation
 * @responsibility 完全選定の搬送、未知項目拒否とEffect前検査を確認する。
 * @trace ERB-UT-023
 * @level UT
 * @scope advice、plan、selection
 * @boundary ERB-UT-023=N/A: 純粋な計画生成。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { executionSelection } from "../../fixtures/ai-selection.ts";
import { fixtureNetworkPolicy } from "../../fixtures/network-policy.ts";
import {
  prepareProviderAdvicePlan,
  type ProviderAdviceExecutionInput,
} from "../../../src/execution/preparation.ts";
/**
 * 正規の助言選定から計画入力を合成する。
 * @responsibility Provider・Model・推論強度・購読を一致させる。
 * @trace ERB-UT-023
 * @precondition Providerは既存二種類。
 * @stimulus 完全選定を生成する。
 * @observation 計画入力を取得する。
 * @oracle 各試験が一項目ずつ反証できる。
 * @cleanup N/A: 値だけ。
 * @boundary ERB-UT-023=N/A: 合成入力。
 */
function executionInput(
  provider: "codex" | "claude",
): ProviderAdviceExecutionInput {
  const selected = executionSelection("advice", {
    provider,
    model: provider === "codex" ? "gpt-5.6-sol" : "opus",
    effort: "medium",
  });
  return {
    allowedReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
    networkPolicy: fixtureNetworkPolicy(provider),
    executionSelection: selected,
    provider,
    providerPrompt: "固定投影だけを説明する",
    taskHash: "a".repeat(64),
    projectionHash: "b".repeat(64),
    exactModelId: selected.modelIdentifier,
    reasoningEffort: selected.reasoningEffort,
    offering:
      provider === "codex" ? "chatgpt_subscription_oauth" : "claude_max",
  };
}

/**
 * CodexとClaudeの固定選定を非共有計画へ渡す。
 * @responsibility 固定選定と計画の整合・拒否を確認する。
 * @trace ERB-UT-023
 * @precondition 合成した選定だけを使う。
 * @stimulus 計画生成を呼ぶ。
 * @observation 値と非共有・拒否を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary ERB-UT-023=N/A: 局所計画生成。
 */
test("CodexとClaudeの固定選定を非共有計画へ渡す", () => {
  for (const provider of ["codex", "claude"] as const) {
    const input = executionInput(provider);
    const result = prepareProviderAdvicePlan(input);
    assert.equal(result.status, "prepared");
    assert.deepEqual(
      result.executionPlan?.executionSelection,
      input.executionSelection,
    );
    assert.equal(
      result.executionPlan?.providerCommand.modelIdentifier,
      input.executionSelection.modelIdentifier,
    );
    assert.equal(
      result.executionPlan?.providerCommand.identifierKind,
      input.executionSelection.identifierKind,
    );
    assert.equal(result.executionPlan?.repositoryMounted, false);
    assert.equal(result.executionPlan?.workspaceMounted, false);
    assert.equal(result.executionPlan?.toolsAllowed, false);
    assert.equal(result.executionPlan?.sessionPersistenceAllowed, false);
    assert.equal(result.executionPlan?.apiKeyFallbackAllowed, false);
    assert.equal(result.executionPlan?.paidApiFallbackAllowed, false);
  }
});

/**
 * 旧改訂・任意引数と不整合な計画を拒否する。
 * @responsibility 固定選定と計画の整合・拒否を確認する。
 * @trace ERB-UT-023
 * @precondition 合成した選定だけを使う。
 * @stimulus 計画生成を呼ぶ。
 * @observation 値と非共有・拒否を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary ERB-UT-023=N/A: 局所計画生成。
 */
test("旧改訂・任意引数と不整合な計画を拒否する", () => {
  const input = executionInput("codex");
  for (const change of [
    { offering: "claude_max" },
    { exactModelId: "opus" },
    { provider: "claude" },
    { taskHash: "invalid" },
    { catalogRevision: -1 },
    { catalogRevision: 0 },
    { command: "arbitrary-command" },
    { profileId: "PROFILE-100001" },
    {
      executionSelection: {
        ...input.executionSelection,
        identifierKind: "alias",
      },
    },
    { executionSelection: { ...input.executionSelection, role: "executor" } },
    { providerPrompt: "" },
  ]) {
    const result = prepareProviderAdvicePlan({
      ...input,
      ...change,
    } as ProviderAdviceExecutionInput);
    assert.equal(result.status, "blocked", JSON.stringify(change));
    assert.equal(result.executionPlan, null);
  }
});

/**
 * GetterとProxyを実行せず拒否する。
 * @responsibility 固定選定と計画の整合・拒否を確認する。
 * @trace ERB-UT-023
 * @precondition 合成した選定だけを使う。
 * @stimulus 計画生成を呼ぶ。
 * @observation 値と非共有・拒否を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary ERB-UT-023=N/A: 局所計画生成。
 */
test("GetterとProxyを実行せず拒否する", () => {
  let calls = 0;
  const getter = Object.defineProperty(
    executionInput("codex"),
    "providerPrompt",
    {
      get() {
        calls++;
        return "injected";
      },
    },
  );
  assert.equal(prepareProviderAdvicePlan(getter).status, "blocked");
  const proxy = new Proxy(executionInput("codex"), {
    ownKeys() {
      calls++;
      throw Error();
    },
  });
  assert.equal(prepareProviderAdvicePlan(proxy).status, "blocked");
  assert.equal(calls, 0);
});

/**
 * 選定値を後の設定再読取りなしに固定する。
 * @responsibility 固定選定と計画の整合・拒否を確認する。
 * @trace ERB-UT-023
 * @precondition 合成した選定だけを使う。
 * @stimulus 計画生成を呼ぶ。
 * @observation 値と非共有・拒否を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary ERB-UT-023=N/A: 局所計画生成。
 */
test("選定値を後の設定再読取りなしに固定する", () => {
  const input = executionInput("codex");
  const result = prepareProviderAdvicePlan(input);
  assert.equal(result.status, "prepared");
  assert.equal(Object.isFrozen(result.executionPlan?.executionSelection), true);
  assert.equal(Object.hasOwn(result.executionPlan ?? {}, "profileId"), false);
  assert.equal(
    Object.hasOwn(result.executionPlan ?? {}, "catalogRevision"),
    false,
  );
});
