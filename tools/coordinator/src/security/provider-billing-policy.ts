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
