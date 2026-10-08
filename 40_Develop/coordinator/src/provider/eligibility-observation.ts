/**
 * provider-eligibility-runtimeに属する責務をまとめる。
 *
 * @responsibility Providerを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000010
 */
import { evaluateProviderEligibility } from "../../../ai-adapter/src/index.ts";

export const PROVIDER_ELIGIBILITY_RUNTIME_CONTRACT =
  "crdd-coordinator/provider-eligibility-runtime";
export const PROVIDER_ELIGIBILITY_RUNTIME_CONTRACT_REVISION = 4;

/**
 * provider-eligibility-runtimeで使用するProviderの値契約を定義する。
 *
 * @responsibility ProviderのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000010
 * @shape Providerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Providerで宣言した値と責務の対応を維持する。
 * @boundary N/A: Providerの宣言は外部境界を開かない。
 * @security ProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Providerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Provider = "codex" | "claude";
/**
 * provider-eligibility-runtimeで使用するRuntime Dependenciesの値契約を定義する。
 *
 * @responsibility Runtime DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000010
 * @shape RuntimeDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDependenciesの宣言は外部境界を開かない。
 * @security RuntimeDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeDependencies = Readonly<{
  observeProvider: (provider: Provider) => unknown;
}>;

/**
 * Eligibilityを観測する。
 *
 * @responsibility Eligibilityの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000010
 * @input dependencies: RuntimeDependencies
 * @returns observeEligibilityの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がobserveEligibilityの入力契約を満たす。
 * @postcondition observeEligibilityの責務を完了した結果だけを返す。
 * @effect N/A: observeEligibilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observeEligibilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeEligibilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeEligibilityはProcess内の同一Subsystemで完結する。
 * @security observeEligibilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeEligibilityは共有非同期状態を持たない同期処理である。
 */
function observeEligibility(dependencies: RuntimeDependencies) {
  const observe = (provider: Provider) => {
    try {
      return evaluateProviderEligibility(
        provider,
        dependencies.observeProvider(provider),
      );
    } catch {
      return evaluateProviderEligibility(provider, null);
    }
  };
  return Object.freeze([observe("codex"), observe("claude")]);
}

const productionDependencies: RuntimeDependencies = Object.freeze({
  observeProvider: (_provider: Provider) =>
    Object.freeze({
      requiredCapability: "confirmed",
      subscriptionAuth: "runtime_preflight_required",
      subscriptionQuota: "bounded_request_check",
      officialDistribution: "runtime_preflight_required",
      policy: "runtime_preflight_required",
    }),
});

/**
 * Runtime 所有 Provider Eligibilityを観測する。
 *
 * @responsibility Runtime 所有 Provider Eligibilityの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns observeRuntimeOwnedProviderEligibilityの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がobserveRuntimeOwnedProviderEligibilityの入力契約を満たす。
 * @postcondition observeRuntimeOwnedProviderEligibilityの責務を完了した結果だけを返す。
 * @effect N/A: observeRuntimeOwnedProviderEligibilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observeRuntimeOwnedProviderEligibilityは独自の失敗分岐を所有しない。
 * @invariant observeRuntimeOwnedProviderEligibilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeRuntimeOwnedProviderEligibilityはProcess内の同一Subsystemで完結する。
 * @security observeRuntimeOwnedProviderEligibilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeRuntimeOwnedProviderEligibilityは共有非同期状態を持たない同期処理である。
 */
export function observeRuntimeOwnedProviderEligibility() {
  return observeEligibility(productionDependencies);
}

/**
 * Isolated Provider Eligibility Runtime 候補を構築する。
 *
 * @responsibility Isolated Provider Eligibility Runtime 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000010
 * @input dependencies: RuntimeDependencies
 * @returns createIsolatedProviderEligibilityRuntimeCandidateの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateIsolatedProviderEligibilityRuntimeCandidateの入力契約を満たす。
 * @postcondition createIsolatedProviderEligibilityRuntimeCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedProviderEligibilityRuntimeCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedProviderEligibilityRuntimeCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedProviderEligibilityRuntimeCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedProviderEligibilityRuntimeCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedProviderEligibilityRuntimeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedProviderEligibilityRuntimeCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedProviderEligibilityRuntimeCandidate(
  dependencies: RuntimeDependencies,
) {
  return Object.freeze({
    productionAuthority: false as const,
    observe: () => observeEligibility(dependencies),
  });
}

/**
 * Provider Eligibility Runtime 契約の公開契約を記述する。
 *
 * @responsibility Provider Eligibility Runtime 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderEligibilityRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderEligibilityRuntimeContractの入力契約を満たす。
 * @postcondition describeProviderEligibilityRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderEligibilityRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderEligibilityRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderEligibilityRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderEligibilityRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderEligibilityRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderEligibilityRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeProviderEligibilityRuntimeContract() {
  return Object.freeze({
    contract: PROVIDER_ELIGIBILITY_RUNTIME_CONTRACT,
    contractRevision: PROVIDER_ELIGIBILITY_RUNTIME_CONTRACT_REVISION,
    providers: Object.freeze(["codex", "claude"]),
    observationAxes: Object.freeze([
      "required_capability",
      "subscription_auth",
      "subscription_quota",
      "official_distribution",
      "policy",
    ]),
    authority: "runtime_owned_preselection_candidate_only",
    callerClaimsAccepted: false,
    unknownHandling: "ineligible_observation_unavailable",
    nonPreobservableSubscriptionState:
      "network_none_auth_preflight_then_bounded_request_checks_quota",
    paidApiFallback: "prohibited_unsupported_by_default",
    productionState:
      "both_providers_require_home_distribution_policy_and_auth_preflight_with_quota_checked_only_by_bounded_request",
    verifiedEligibilityClaimAllowed: false,
    automaticFallbackAfterProviderRequestAllowed: false,
    reselection:
      "new_coordinator_operation_after_cleanup_only_for_nonpreobservable_failure",
  });
}
