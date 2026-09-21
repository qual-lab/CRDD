/**
 * coordinator:unit:provider-model-profile-runtimeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:provider-model-profile-runtimeが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope provider、model、profile、runtime
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  describeProviderModelProfileRuntimeContract,
  resolveRuntimeOwnedProviderModelProfile,
} from "../../src/security/provider-model-profile-runtime.ts";

/**
 * createRequestのTest準備責務を実行する。
 *
 * @responsibility createRequestがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createRequestを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    provider: "codex",
    family: "sol",
    role: "executor",
    modelTier: "preferred",
    speedMode: "normal",
    billingMode: "subscription_oauth",
    ...overrides,
  };
}

/**
 * Codex SolとClaude Opusのpreferred／upper profileを固定解決するを検証する。
 *
 * @responsibility Codex SolとClaude Opusのpreferred／upper profileを固定解決するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codex SolとClaude Opusのpreferred／upper profileを固定解決するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("Codex SolとClaude Opusのpreferred／upper profileを固定解決する", () => {
  assert.deepEqual(resolveRuntimeOwnedProviderModelProfile(createRequest()), {
    provider: "codex",
    profileId: "PROFILE-100003",
    exactModelId: "gpt-5.5",
    family: "sol",
    selectionRole: "executor",
    modelTier: "preferred",
    speedMode: "normal",
    billingMode: "subscription_oauth",
    compatibilityReason:
      "gpt_5_6_code_mode_only_host_unavailable_in_fixed_linux_runtime",
  });
  assert.equal(
    resolveRuntimeOwnedProviderModelProfile(
      createRequest({ modelTier: "upper_allowed" }),
    )?.profileId,
    "PROFILE-100004",
  );
  assert.deepEqual(
    resolveRuntimeOwnedProviderModelProfile(
      createRequest({ provider: "claude", family: "opus" }),
    ),
    {
      provider: "claude",
      profileId: "PROFILE-200001",
      exactModelId: "opus",
      family: "opus",
      selectionRole: "executor",
      modelTier: "preferred",
      speedMode: "normal",
      billingMode: "subscription_oauth",
      compatibilityReason: null,
    },
  );
  assert.equal(
    resolveRuntimeOwnedProviderModelProfile(
      createRequest({
        provider: "claude",
        family: "opus",
        modelTier: "upper_allowed",
      }),
    )?.profileId,
    "PROFILE-200002",
  );
});

/**
 * family差、fast、API課金、未知tierと余分keyを解決しないを検証する。
 *
 * @responsibility family差、fast、API課金、未知tierと余分keyを解決しないの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus family差、fast、API課金、未知tierと余分keyを解決しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("family差、fast、API課金、未知tierと余分keyを解決しない", () => {
  for (const request of [
    createRequest({ family: "opus" }),
    createRequest({ speedMode: "fast" }),
    createRequest({ billingMode: "api_key" }),
    createRequest({ modelTier: "maximum" }),
    createRequest({ fallbackModel: "gpt-5.6-terra" }),
  ]) {
    assert.equal(resolveRuntimeOwnedProviderModelProfile(request), null);
  }
});

/**
 * accessorとProxyを実行せずProfile解決をfail closedにするを検証する。
 *
 * @responsibility accessorとProxyを実行せずProfile解決をfail closedにするの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus accessorとProxyを実行せずProfile解決をfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("accessorとProxyを実行せずProfile解決をfail closedにする", () => {
  let getterExecuted = false;
  const accessor = createRequest();
  Object.defineProperty(accessor, "family", {
    enumerable: true,
    get: () => {
      getterExecuted = true;
      return "sol";
    },
  });
  assert.equal(resolveRuntimeOwnedProviderModelProfile(accessor), null);
  assert.equal(getterExecuted, false);
  assert.equal(
    resolveRuntimeOwnedProviderModelProfile(new Proxy(createRequest(), {})),
    null,
  );
});

/**
 * 公開契約は通常速度、Subscription、同family内effort切替だけを許すを検証する。
 *
 * @responsibility 公開契約は通常速度、Subscription、同family内effort切替だけを許すの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約は通常速度、Subscription、同family内effort切替だけを許すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("公開契約は通常速度、Subscription、同family内effort切替だけを許す", () => {
  const contract = describeProviderModelProfileRuntimeContract();
  assert.equal(contract.codex.preferredFamily, "sol");
  assert.equal(contract.codex.toolFreeExactModelId, "gpt-5.6-sol");
  assert.equal(contract.codex.isolatedTaskExactModelId, "gpt-5.5");
  assert.equal(contract.compatibilityProfileIsFixed, true);
  assert.equal(contract.claude.exactModelId, "opus");
  assert.deepEqual(contract.codex.verifiedEfforts, ["low", "medium", "high"]);
  assert.equal(contract.upperTierChangesFamily, false);
  assert.equal(contract.upperTierChangesExactModel, false);
  assert.equal(contract.speedMode, "normal_only");
  assert.equal(contract.billingMode, "subscription_oauth_only");
  assert.equal(contract.automaticFallback, false);
  assert.equal(contract.fableActivated, false);
  assert.equal(contract.xhighOrMaxActivated, false);
  assert.equal(contract.providerEffectAllowed, false);
});
