/**
 * Providerの開始・終了と利用可否の観測を相関する。
 *
 * @responsibility 元の実行通知Ownerを保持し、結果コピーを終了根拠へ昇格しない。
 * @trace ARCH-000008
 */

import type {
  CandidateValidationFailureDiagnostic,
  TaskStageDiagnostic,
} from "./result.ts";
import {
  type ProviderAvailability,
  evaluateProviderAvailability,
} from "../../../ai-adapter/src/index.ts";
import type { ProviderAttemptDiagnosticNotice } from "../../../executor/src/index.ts";

/**
 * Provider境界の設定と終了後の診断を表す。
 *
 * @responsibility 設定、一次失敗と清掃観測を区別して搬送する。
 * @trace ARCH-000008
 * @shape configuredとsettledの固定Event集合。
 * @invariant 設定や診断をEffect成立の根拠へ変換しない。
 * @boundary Runtimeから受動診断の利用側への搬送。
 * @security 秘密値、Pathや生出力を含めない。
 * @compatibility 診断失敗で処理結果を変更しない。
 */
export type ProviderBoundaryDiagnosticNotice =
  | Readonly<{
      event: "coordinator_task_stage_observed";
      taskRole: "executor" | "reviewer";
      provider: "codex" | "claude";
      operationId: string;
      taskAttempt: 0 | 1;
      recoveryCorrelationId: string | null;
      diagnostic: TaskStageDiagnostic;
    }>
  | Readonly<{
      event: "coordinator_task_candidate_validation_failed";
      taskRole: "executor";
      provider: "codex" | "claude";
      operationId: string;
      taskAttempt: 0 | 1;
      recoveryCorrelationId: string | null;
      diagnostic: CandidateValidationFailureDiagnostic;
    }>
  | ProviderAttemptDiagnosticNotice;

/**
 * 開始済みTaskへ取消を搬送し、元の完了結果を待つ。
 *
 * @responsibility 取消搬送、完了待機と監視解除を一つの呼出しへ収束させる。
 * @trace ARCH-000004
 * @input 検証済みのTask制御参照、完了Promise、固定取消操作と取消Signal。
 * @returns 完了の観測結果。Promise拒否はunknownとして返す。
 * @precondition 呼出し側が開始結果と各入力の形を検証済みである。
 * @postcondition 元の完了待機が終端し、登録したabort監視を解除する。
 * @effect 同じTaskへ取消要求を渡す。新しいTaskやProvider要求は作らない。
 * @failure 取消の失敗で完了待機を切り離さず、完了拒否は未観測として保持する。
 * @invariant Signalによる取消搬送は一度だけで、取消の応答をcleanupの根拠にしない。
 * @boundary 開始済みTaskの制御参照と完了通知のProcess内境界。
 * @security 制御参照や未検証の完了値を公開結果・ログへ出さない。
 * @concurrency 登録前の同期取消も確認し、元のPromiseを必ず待つ。
 */
export async function observeCoordinatorTaskCompletion(
  started: Readonly<{
    controlCapability: object;
    completion: Promise<unknown>;
  }>,
  cancelTask: (controlCapability: object) => unknown,
  cancellationSignal: AbortSignal,
): Promise<TaskCompletionObservation> {
  let cancellationTransferred = false;
  /**
   * 同じTaskへSignal取消を一度だけ転送する。
   *
   * @responsibility 取消搬送の重複と未処理rejectionを防ぎ、元の完了待機を維持する。
   * @trace ARCH-000004
   * @input N/A: 閉包内の制御参照と搬送状態を使用する。
   * @returns N/A: 完了結果を返さない。
   * @precondition 開始結果の制御参照が検証済みである。
   * @postcondition 取消搬送済みの事実を保持し、再呼出しで重複搬送しない。
   * @effect 同じTaskの固定取消操作へ要求を渡す。
   * @failure 同期例外とPromise拒否を処置し、完了待機へ委ねる。
   * @invariant 取消搬送をcleanup成立として扱わない。
   * @boundary Process内の取消SignalとTask制御操作。
   * @security 新しいAuthorityやTaskを作らない。
   * @concurrency 搬送済みフラグを取消呼出し前に確定する。
   */
  const forwardCancellation = () => {
    if (cancellationTransferred) return;
    cancellationTransferred = true;
    try {
      const settlement = cancelTask(started.controlCapability);
      if (settlement instanceof Promise) settlement.catch(() => {});
    } catch {
      // 取消入口の失敗で元の完了待機を切り離さない。
    }
  };
  cancellationSignal.addEventListener("abort", forwardCancellation, {
    once: true,
  });
  if (cancellationSignal.aborted) forwardCancellation();
  try {
    const rawCompletion: unknown = await started.completion;
    return { status: "observed", rawCompletion, cancellationTransferred };
  } catch {
    return { status: "unknown" };
  } finally {
    cancellationSignal.removeEventListener("abort", forwardCancellation);
  }
}

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
    let availability: ProviderAvailability;
    try {
      availability = evaluateProviderAvailability(
        provider,
        dependencies.observeProvider(provider),
      );
    } catch {
      availability = evaluateProviderAvailability(provider, null);
    }
    // この既存選択契約のeligibleは、実行許可ではなく直前確認へ進める候補を含む。
    return Object.freeze({
      provider,
      status:
        availability.status === "available" ||
        availability.status === "preflight_required"
          ? ("eligible" as const)
          : ("ineligible" as const),
      reason: availability.reason,
    });
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

/**
 * 完了Promiseの観測結果を表す。
 *
 * @responsibility 未検証の完了値と取消搬送事実、完了拒否を区別する。
 * @trace ARCH-000004
 * @shape observedはrawCompletionとcancellationTransferred、unknownは観測不能だけを保持する。
 * @invariant observedはTask成功や資源回収の成立を意味しない。
 * @boundary Process内の完了観測と上位結果検証の境界。
 * @security rawCompletionを公開結果やログへ直接搬送しない。
 * @compatibility 利用側はstatusで分岐し、未検証値を正式なTask結果として扱わない。
 */
export type TaskCompletionObservation =
  | Readonly<{
      status: "observed";
      rawCompletion: unknown;
      cancellationTransferred: boolean;
    }>
  | Readonly<{ status: "unknown" }>;
