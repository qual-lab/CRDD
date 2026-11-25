/**
 * 固定した助言選定とProvider実行入力を検証する。
 * @packageDocumentation
 * @responsibility 完全選定の搬送、未知項目拒否とEffect前検査を確認する。
 * @trace ERB-UT-023
 * @level UT
 * @scope advice、plan、selection
 * @boundary ERB-UT-023=N/A: 純粋な入力検査と固定。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { executionSelection } from "../../fixtures/ai-selection.ts";
import { prepareProviderAdviceInput } from "../../../src/lifecycle/selection.ts";
import type { ProviderAdviceExecutionInput } from "../../../src/lifecycle/types.ts";

type AdviceContent = Omit<ProviderAdviceExecutionInput, "executionSelection">;
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
function selectedFor(provider: "codex" | "claude") {
  return executionSelection("advice", {
    provider,
    model: provider === "codex" ? "gpt-5.6-sol" : "opus",
    effort: "medium",
  });
}

function executionInput(): AdviceContent {
  return {
    allowedReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
    additionalHosts: Object.freeze([]),
    providerPrompt: "固定投影だけを説明する",
    taskHash: "a".repeat(64),
    projectionHash: "b".repeat(64),
  };
}

/**
 * CodexとClaudeの固定選定を助言入力へ渡す。
 * @responsibility 固定選定と計画の整合・拒否を確認する。
 * @trace ERB-UT-023
 * @precondition 合成した選定だけを使う。
 * @stimulus 計画生成を呼ぶ。
 * @observation 入力値だけが変更不能な形で返ることを確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary ERB-UT-023=N/A: 局所計画生成。
 */
test("CodexとClaudeの固定選定を助言入力へ渡す", () => {
  for (const provider of ["codex", "claude"] as const) {
    const input = executionInput();
    const selection = selectedFor(provider);
    const result = prepareProviderAdviceInput(input, selection);
    assert.ok(result);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(result.executionSelection.provider, provider);
    assert.deepEqual(result, { ...input, executionSelection: selection });
    assert.equal(result.executionSelection, selection);
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
  const input = executionInput();
  const selection = selectedFor("codex");
  for (const change of [
    { offering: "chatgpt_subscription_oauth" },
    { exactModelId: selection.modelIdentifier },
    { reasoningEffort: selection.reasoningEffort },
    { provider: "claude" },
    { taskHash: "invalid" },
    { catalogRevision: -1 },
    { catalogRevision: 0 },
    { command: "arbitrary-command" },
    { profileId: "PROFILE-100001" },
    { executionSelection: selection },
    { providerPrompt: "" },
    { repositoryMounted: true },
    { workspaceMounted: true },
    { toolsAllowed: true },
    { sessionPersistenceAllowed: true },
    { apiKeyFallbackAllowed: true },
    { paidApiFallbackAllowed: true },
    { promptTransport: "argv" },
  ]) {
    const result = prepareProviderAdviceInput(
      {
        ...input,
        ...change,
      },
      selection,
    );
    assert.equal(result, null, JSON.stringify(change));
  }
  assert.equal(
    prepareProviderAdviceInput(input, {
      ...selection,
      identifierKind: "alias",
    }),
    null,
  );
  assert.equal(
    prepareProviderAdviceInput(input, { ...selection, role: "executor" }),
    null,
  );
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
test("Getter、Proxy、Hashの暗黙変換を実行せず拒否する", () => {
  let calls = 0;
  const selection = selectedFor("codex");
  const getter = Object.defineProperty(executionInput(), "providerPrompt", {
    get() {
      calls++;
      return "injected";
    },
  });
  assert.equal(prepareProviderAdviceInput(getter, selection), null);
  const proxy = new Proxy(executionInput(), {
    ownKeys() {
      calls++;
      throw Error();
    },
  });
  assert.equal(prepareProviderAdviceInput(proxy, selection), null);
  const hashObject = {
    toString() {
      calls++;
      return "a".repeat(64);
    },
  };
  for (const key of ["taskHash", "projectionHash"])
    assert.equal(
      prepareProviderAdviceInput(
        {
          ...executionInput(),
          [key]: hashObject,
        },
        selection,
      ),
      null,
    );
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
  const input = executionInput();
  const result = prepareProviderAdviceInput(input, selectedFor("codex"));
  assert.ok(result);
  assert.equal(Object.isFrozen(result.executionSelection), true);
  assert.equal(Object.isFrozen(result.allowedReferences), true);
  assert.equal(Object.isFrozen(result.additionalHosts), true);
  assert.notStrictEqual(result.allowedReferences, input.allowedReferences);
  assert.equal(Object.hasOwn(result, "profileId"), false);
  for (const key of ["exactModelId", "reasoningEffort", "offering"])
    assert.equal(Object.hasOwn(result, key), false, key);
  assert.equal(Object.hasOwn(result, "catalogRevision"), false);
});
