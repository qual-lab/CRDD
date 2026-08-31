import assert from "node:assert/strict";
import test from "node:test";

import {
  describeProviderBillingPolicyContract,
  PROVIDER_BILLING_POLICY_CONTRACT,
  PROVIDER_BILLING_POLICY_CONTRACT_REVISION,
} from "../src/security/provider-billing-policy.ts";

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
