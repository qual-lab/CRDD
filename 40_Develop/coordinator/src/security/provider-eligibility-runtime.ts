/**
 * provider-eligibility-runtimeに属する責務をまとめる。
 *
 * @responsibility Providerを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000010
 */
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

export const PROVIDER_ELIGIBILITY_RUNTIME_CONTRACT =
  "crdd-coordinator/provider-eligibility-runtime";
export const PROVIDER_ELIGIBILITY_RUNTIME_CONTRACT_REVISION = 4;

const OBSERVATION_KEYS = new Set([
  "requiredCapability",
  "subscriptionAuth",
  "subscriptionQuota",
  "officialDistribution",
  "policy",
]);
const OBSERVATION_STATES = new Set([
  "confirmed",
  "runtime_preflight_required",
  "bounded_request_check",
  "unavailable",
  "unknown",
]);

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
 * provider-eligibility-runtimeで使用するObservation 状態の値契約を定義する。
 *
 * @responsibility Observation 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000010
 * @shape ObservationStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ObservationStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: ObservationStateの宣言は外部境界を開かない。
 * @security ObservationStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ObservationStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ObservationState =
  | "confirmed"
  | "runtime_preflight_required"
  | "bounded_request_check"
  | "unavailable"
  | "unknown";
/**
 * provider-eligibility-runtimeで使用するProvider Observationの値契約を定義する。
 *
 * @responsibility Provider ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000010
 * @shape ProviderObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProviderObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProviderObservationの宣言は外部境界を開かない。
 * @security ProviderObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProviderObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ProviderObservation = Readonly<{
  requiredCapability: ObservationState;
  subscriptionAuth: ObservationState;
  subscriptionQuota: ObservationState;
  officialDistribution: ObservationState;
  policy: ObservationState;
}>;
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
 * Provider Observationを所有Snapshotへ変換する。
 *
 * @responsibility Provider Observationの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000010
 * @input rawObservation: unknown
 * @returns snapshotProviderObservationの計算結果を返す。
 * @precondition 「rawObservation: unknown」がsnapshotProviderObservationの入力契約を満たす。
 * @postcondition snapshotProviderObservationの責務を完了した結果だけを返す。
 * @effect N/A: snapshotProviderObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: snapshotProviderObservationは独自の失敗分岐を所有しない。
 * @invariant snapshotProviderObservationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotProviderObservationはProcess内の同一Subsystemで完結する。
 * @security snapshotProviderObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotProviderObservationは共有非同期状態を持たない同期処理である。
 */
function snapshotProviderObservation(rawObservation: unknown) {
  const observation = snapshotPlainRecord(rawObservation, OBSERVATION_KEYS);
  if (
    !observation ||
    !OBSERVATION_STATES.has(observation.requiredCapability as string) ||
    !OBSERVATION_STATES.has(observation.subscriptionAuth as string) ||
    !OBSERVATION_STATES.has(observation.subscriptionQuota as string) ||
    !OBSERVATION_STATES.has(observation.officialDistribution as string) ||
    !OBSERVATION_STATES.has(observation.policy as string)
  ) {
    return null;
  }
  return Object.freeze({
    requiredCapability: observation.requiredCapability as ObservationState,
    subscriptionAuth: observation.subscriptionAuth as ObservationState,
    subscriptionQuota: observation.subscriptionQuota as ObservationState,
    officialDistribution: observation.officialDistribution as ObservationState,
    policy: observation.policy as ObservationState,
  });
}

/**
 * Eligibilityを構築する。
 *
 * @responsibility Eligibilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000010
 * @input provider: Provider、observation: ProviderObservation | null
 * @returns createEligibilityの計算結果を返す。
 * @precondition 「provider: Provider、observation: ProviderObservation | null」がcreateEligibilityの入力契約を満たす。
 * @postcondition createEligibilityの責務を完了した結果だけを返す。
 * @effect N/A: createEligibilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createEligibilityは独自の失敗分岐を所有しない。
 * @invariant createEligibilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createEligibilityはProcess内の同一Subsystemで完結する。
 * @security createEligibilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createEligibilityは共有非同期状態を持たない同期処理である。
 */
function createEligibility(
  provider: Provider,
  observation: ProviderObservation | null,
) {
  if (!observation) {
    return Object.freeze({
      provider,
      status: "ineligible" as const,
      reason: "observation_unavailable" as const,
    });
  }
  if (observation.requiredCapability === "unavailable") {
    return Object.freeze({
      provider,
      status: "ineligible" as const,
      reason: "required_capability_unavailable" as const,
    });
  }
  if (observation.subscriptionAuth === "unavailable") {
    return Object.freeze({
      provider,
      status: "ineligible" as const,
      reason: "subscription_auth_unavailable" as const,
    });
  }
  if (observation.subscriptionQuota === "unavailable") {
    return Object.freeze({
      provider,
      status: "ineligible" as const,
      reason: "subscription_quota_unavailable" as const,
    });
  }
  if (observation.officialDistribution === "unavailable") {
    return Object.freeze({
      provider,
      status: "ineligible" as const,
      reason: "provider_distribution_unavailable" as const,
    });
  }
  if (observation.policy === "unavailable") {
    return Object.freeze({
      provider,
      status: "ineligible" as const,
      reason: "policy_blocked" as const,
    });
  }
  if (
    observation.requiredCapability === "confirmed" &&
    ["confirmed", "runtime_preflight_required"].includes(
      observation.officialDistribution,
    ) &&
    ["confirmed", "runtime_preflight_required"].includes(observation.policy) &&
    ["confirmed", "runtime_preflight_required"].includes(
      observation.subscriptionAuth,
    ) &&
    ["confirmed", "bounded_request_check"].includes(
      observation.subscriptionQuota,
    ) &&
    (observation.subscriptionAuth === "runtime_preflight_required" ||
      observation.subscriptionQuota === "bounded_request_check" ||
      observation.officialDistribution === "runtime_preflight_required" ||
      observation.policy === "runtime_preflight_required")
  ) {
    return Object.freeze({
      provider,
      status: "eligible" as const,
      reason: "runtime_preflight_required" as const,
    });
  }
  if (
    observation.requiredCapability !== "confirmed" ||
    observation.subscriptionAuth !== "confirmed" ||
    observation.subscriptionQuota !== "confirmed" ||
    observation.officialDistribution !== "confirmed" ||
    observation.policy !== "confirmed"
  ) {
    return Object.freeze({
      provider,
      status: "ineligible" as const,
      reason: "observation_unavailable" as const,
    });
  }
  return Object.freeze({
    provider,
    status: "eligible" as const,
    reason: "ready" as const,
  });
}

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
      return createEligibility(
        provider,
        snapshotProviderObservation(dependencies.observeProvider(provider)),
      );
    } catch {
      return createEligibility(provider, null);
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
