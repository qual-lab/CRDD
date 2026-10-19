/**
 * Subscription専用の課金方針と将来の未実装条件を記述する。
 *
 * @responsibility describeProviderBillingPolicyを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000010
 */
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
 * Subscription専用の課金方針を記述する。
 *
 * @responsibility 暗黙Fallbackと追加支出の禁止、将来の明示採用条件を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns 固定の課金方針。
 * @precondition N/A: 実行時入力を持たない。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: describeProviderBillingPolicyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: 固定宣言を返す。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
 * @security describeProviderBillingPolicyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderBillingPolicyは共有非同期状態を持たない同期処理である。
 */
export function describeProviderBillingPolicy(): ProviderBillingPolicy {
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

/**
 * Subscription専用の現在方針と未実装の将来条件を表す。
 * @responsibility API課金・暗黙Fallbackの禁止と追加採用条件を固定する。
 * @trace ARCH-000010
 * @shape 現在の契約ID・改訂・方針値を持つ読取り専用型。
 * @invariant 宣言取得で有料API実行や資格を有効化しない。
 * @boundary Provider計画とCoordinatorの方針説明。
 * @security Credential値及び支出Authorityを含めない。
 * @compatibility 既存のfield・値・固定契約IDを維持する。
 */
export type ProviderBillingPolicy = Readonly<{
  contract: typeof PROVIDER_BILLING_POLICY_CONTRACT;
  contractRevision: typeof PROVIDER_BILLING_POLICY_CONTRACT_REVISION;
  defaultProfile: "subscription_only";
  defaultPaidApiDisposition: "prohibited_and_unsupported";
  paidApiCapability: "not_implemented_separate_opt_in_profile";
  apiKeyConfigurationSurface: "not_implemented";
  implicitFallbackAllowed: false;
  quotaExhaustionFallbackAllowed: false;
  additionalCreditPurchaseAllowed: false;
  automaticPlanSwitchAllowed: false;
  subscriptionCredentialReuseForPaidApiAllowed: false;
  userConfigurationRequired: true;
  userConfigurationEffect: "enables_separate_paid_api_policy_evaluation_only";
  userConfigurationAloneIssuesExecutionAuthority: false;
  futurePaidApiRequirements: typeof FUTURE_PAID_API_REQUIREMENTS;
  paidApiIsSubscriptionActivationBlocker: false;
}>;
