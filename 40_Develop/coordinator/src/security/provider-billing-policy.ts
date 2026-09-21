export const PROVIDER_BILLING_POLICY_CONTRACT =
  "crdd-coordinator/provider-billing-policy";
export const PROVIDER_BILLING_POLICY_CONTRACT_REVISION = 1;

const FUTURE_PAID_API_REQUIREMENTS = Object.freeze([
  "explicit_user_configured_paid_api_profile",
  "exact_provider_and_account_binding",
  "dedicated_credential_source_binding",
  "explicit_spend_budget",
  "operation_authority",
]);

/**
 * describeProviderBillingPolicyContractの処理を実行する。
 *
 * @responsibility describeProviderBillingPolicyContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderBillingPolicyContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderBillingPolicyContractの入力契約を満たす。
 * @postcondition describeProviderBillingPolicyContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderBillingPolicyContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderBillingPolicyContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderBillingPolicyContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderBillingPolicyContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderBillingPolicyContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderBillingPolicyContractは共有非同期状態を持たない同期処理である。
 */
export function describeProviderBillingPolicyContract() {
  return Object.freeze({
    contract: PROVIDER_BILLING_POLICY_CONTRACT,
    contractRevision: PROVIDER_BILLING_POLICY_CONTRACT_REVISION,
    defaultProfile: "subscription_only",
    defaultPaidApiDisposition: "prohibited_and_unsupported",
    paidApiCapability: "not_implemented_separate_opt_in_profile",
    apiKeyConfigurationSurface: "not_implemented",
    implicitFallbackAllowed: false,
    quotaExhaustionFallbackAllowed: false,
    additionalCreditPurchaseAllowed: false,
    automaticPlanSwitchAllowed: false,
    subscriptionCredentialReuseForPaidApiAllowed: false,
    userConfigurationRequired: true,
    userConfigurationEffect: "enables_separate_paid_api_policy_evaluation_only",
    userConfigurationAloneIssuesExecutionAuthority: false,
    futurePaidApiRequirements: FUTURE_PAID_API_REQUIREMENTS,
    paidApiIsSubscriptionActivationBlocker: false,
  });
}
