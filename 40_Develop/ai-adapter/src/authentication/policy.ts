/**
 * ProviderごとのSubscription認証方針を宣言する。
 *
 * @packageDocumentation
 * @responsibility 認証方式・課金制約・未観測条件を固定し、実Home・実行Authorityの観測と分離する。
 * @trace ARCH-000010
 * @boundary AI Adapterの認証方針とCoordinatorの実行判断の間。
 * @effect N/A: 不変の宣言だけを公開する。
 * @security Secretを保持せず、認証済み・実行可能を宣言値から推定しない。
 */
export const PROVIDER_AUTHENTICATION_POLICIES = Object.freeze({
  codex: Object.freeze({
    provider: "codex",
    loginPolicy: "existing_chatgpt_plan_subscription_oauth",
    accountCardinality: 1,
    billingMode: "subscription_only",
    usageSource: "selected_chatgpt_plan_included_usage",
    automaticPlanSwitchAllowed: false,
    exactCliVersionRequired: true,
    exactCliVersionConfigured: false,
    quotaProbe: "not_implemented",
    billingProbe: "not_implemented",
    dedicatedHomeScope: "local_os_user_and_provider",
    paidApiProfileSelected: false,
  }),
  claude: Object.freeze({
    provider: "claude",
    loginPolicy: "existing_subscription_oauth",
    accountCardinality: 1,
    billingMode: "subscription_only",
    usageSource: "selected_subscription_included_usage",
    selectedAccountOfferingObserved: false,
    authenticatedServiceTermsIdentity: "unresolved",
    automatedSubscriptionUsePermission: "unresolved",
    humanAccountAuthorityConfirmed: false,
    accountAuthorityBinding: "not_implemented",
    automaticPlanSwitchAllowed: false,
    exactCliVersionRequired: true,
    exactCliVersionConfigured: false,
    quotaProbe: "not_implemented",
    billingProbe: "not_implemented",
    dedicatedHomeScope: "local_os_user_and_provider",
    paidApiProfileSelected: false,
  }),
});
