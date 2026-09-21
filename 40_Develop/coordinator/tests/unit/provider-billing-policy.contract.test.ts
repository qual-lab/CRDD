/**
 * coordinator:unit:provider-billing-policyの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:provider-billing-policyが所有する検証責務を実行する。
 * @trace AIT-UT-005
 * @level UT
 * @scope provider、billing、policy
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  describeProviderBillingPolicyContract,
  PROVIDER_BILLING_POLICY_CONTRACT,
  PROVIDER_BILLING_POLICY_CONTRACT_REVISION,
} from "../../src/security/provider-billing-policy.ts";

/**
 * 標準ProfileはSubscriptionだけを許し有料APIへfallbackしないを検証する。
 *
 * @responsibility 標準ProfileはSubscriptionだけを許し有料APIへfallbackしないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 標準ProfileはSubscriptionだけを許し有料APIへfallbackしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("標準ProfileはSubscriptionだけを許し有料APIへfallbackしない", () => {
  const contract = describeProviderBillingPolicyContract();
  assert.equal(contract.contract, PROVIDER_BILLING_POLICY_CONTRACT);
  assert.equal(
    contract.contractRevision,
    PROVIDER_BILLING_POLICY_CONTRACT_REVISION,
  );
  assert.equal(contract.defaultProfile, "subscription_only");
  assert.equal(
    contract.defaultPaidApiDisposition,
    "prohibited_and_unsupported",
  );
  assert.equal(
    contract.paidApiCapability,
    "not_implemented_separate_opt_in_profile",
  );
  assert.equal(contract.apiKeyConfigurationSurface, "not_implemented");
  assert.equal(contract.implicitFallbackAllowed, false);
  assert.equal(contract.quotaExhaustionFallbackAllowed, false);
  assert.equal(contract.additionalCreditPurchaseAllowed, false);
  assert.equal(contract.automaticPlanSwitchAllowed, false);
  assert.equal(contract.subscriptionCredentialReuseForPaidApiAllowed, false);
});

/**
 * 将来の有料APIはユーザー設定だけで実行Authorityを発行しないを検証する。
 *
 * @responsibility 将来の有料APIはユーザー設定だけで実行Authorityを発行しないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 将来の有料APIはユーザー設定だけで実行Authorityを発行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("将来の有料APIはユーザー設定だけで実行Authorityを発行しない", () => {
  const contract = describeProviderBillingPolicyContract();
  assert.equal(contract.userConfigurationRequired, true);
  assert.equal(
    contract.userConfigurationEffect,
    "enables_separate_paid_api_policy_evaluation_only",
  );
  assert.equal(contract.userConfigurationAloneIssuesExecutionAuthority, false);
  assert.deepEqual(contract.futurePaidApiRequirements, [
    "explicit_user_configured_paid_api_profile",
    "exact_provider_and_account_binding",
    "dedicated_credential_source_binding",
    "explicit_spend_budget",
    "operation_authority",
  ]);
  assert.equal(contract.paidApiIsSubscriptionActivationBlocker, false);
});
