/**
 * Providerの開始・終了と利用可否の観測を相関する。
 *
 * @responsibility 元の実行通知Ownerを保持し、結果コピーを終了根拠へ昇格しない。
 * @trace ARCH-000008
 */

import type { PrimaryFailureDiagnostic } from "./result.ts";
import {
  type ProviderAvailability,
  evaluateProviderAvailability,
} from "../../../ai-adapter/src/index.ts";
import type { DockerResourceCleanupObservation } from "../../../docker-isolation/src/index.ts";

/**
 * docker-process-controllerで使用するProvider Process Started Noticeの値契約を定義する。
 *
 * @responsibility Provider Process Started NoticeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ProviderProcessStartedNoticeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProviderProcessStartedNoticeで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProviderProcessStartedNoticeの宣言は外部境界を開かない。
 * @security ProviderProcessStartedNoticeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProviderProcessStartedNoticeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProviderProcessStartedNotice = Readonly<{
  event: "coordinator_provider_process_started";
  taskRole: "executor" | "reviewer" | null;
  provider: "codex" | "claude";
  operationId: string;
}>;

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
      event: "coordinator_provider_boundary_configured";
      taskRole: "executor" | "reviewer" | null;
      provider: "codex" | "claude";
      operationId: string;
      approvalModeConfigured:
        | "approve_for_me"
        | "never"
        | "not_applicable"
        | "other";
      sandboxModeConfigured:
        | "read_only"
        | "implicit"
        | "not_applicable"
        | "other";
      workspaceMountModeConfigured: "read_write" | "read_only" | null;
      networkPolicyHash: string | null;
      rootFilesystemReadOnlyConfigured: boolean;
      nonRootUserConfigured: boolean;
      workdirConfigured: boolean;
    }>
  | Readonly<{
      event: "coordinator_provider_boundary_settled";
      taskRole: "executor" | "reviewer" | null;
      provider: "codex" | "claude";
      operationId: string;
      providerContainerCreatedObserved: boolean;
      providerProcessStartedObserved: boolean;
      providerProcessCompletionObserved: boolean;
      providerProcessExitStatusClass:
        | "zero"
        | "one"
        | "one_two_six"
        | "one_two_seven"
        | "other_nonzero"
        | "signal"
        | "not_observed";
      processTreeTerminationObserved: boolean;
      containersAbsentObserved: boolean;
      networksAbsentObserved: boolean;
      cleanupConfirmed: boolean;
      primaryFailure: PrimaryFailureDiagnostic | null;
    }>;

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
 * 私有観測の値契約。
 * @responsibility 二つの既存WeakMapの値契約を維持する。
 * @trace ARCH-000008
 * @shape 元object・Owner・操作・回復参照の相関。
 * @invariant 永続化・復元しない。
 * @boundary N/A: 内部型のみ。
 * @security MapをRoot公開しない。
 * @compatibility 本番と候補は共有しない。
 */
type ObservationState = Readonly<{
  terminalObservations: WeakMap<
    object,
    Readonly<{
      managementCapability: object;
      operationId: string;
      recoveryId: string;
      resources: readonly DockerResourceCleanupObservation[];
      primaryFailure: PrimaryFailureDiagnostic | null;
      mountLeaseReleased: boolean;
      recoveryCompleted: boolean;
      homeLeaseReleased: boolean;
    }>
  >;
  submissionNotices: WeakMap<
    object,
    Readonly<{
      managementCapability: unknown;
      recoveryCapability: object;
      operationId: string;
      recoveryId: string;
      purpose: string;
      kind: "resource_not_issued" | "provider_submission";
    }>
  >;
}>;

/**
 * 同じ完了結果へ結合した終端観測を借用する。
 *
 * @responsibility Controller終了後も同じ操作・回復参照の非Authority観測を保持する。
 * @trace ARCH-000008
 * @input state、result、managementCapability、operationId、recoveryId: Ownerと照合対象。
 * @returns 資源・Mount・回復の観測、またはnull。
 * @precondition 同じControllerの元の完了結果と操作相関を渡す。
 * @postcondition コピー結果と別操作・別Ownerの借用を拒否する。
 * @effect N/A: 私有WeakMapの読取りだけを行う。
 * @failure 未登録・相関不一致ではnullを返す。
 * @invariant 借用はProvider起動、Host清掃、現在状態除去の許可を生成しない。
 * @boundary 完了結果から同じ操作の終端保存への搬送。
 * @security 管理Capabilityを返却観測へ複製しない。
 * @concurrency N/A: 同期照合であり外部待機を持たない。
 */
function borrowTerminalObservations(
  state: ObservationState,
  result: unknown,
  managementCapability: unknown,
  operationId: unknown,
  recoveryId: unknown,
) {
  if (!result || typeof result !== "object") return null;
  const observation = state.terminalObservations.get(result);
  if (
    !observation ||
    observation.managementCapability !== managementCapability ||
    observation.operationId !== operationId ||
    observation.recoveryId !== recoveryId
  )
    return null;
  return Object.freeze({
    resources: observation.resources,
    primaryFailure: observation.primaryFailure,
    mountLeaseReleased: observation.mountLeaseReleased,
    recoveryCompleted: observation.recoveryCompleted,
    homeLeaseReleased: observation.homeLeaseReleased,
  });
}

/**
 * 作成予定後の取消が実要求前に確定した元通知を照合する。
 * @responsibility 同期保存callback中だけ有効な未発行根拠の出自を確認する。
 * @trace ARCH-000008
 * @input state: 実行Owner、notice: 元通知、recoveryCapability: 元回復Owner、managementCapability: 元操作Owner、purpose: 資源用途、operationId: 実操作、recoveryId: exact参照。
 * @returns 全結合と通知の有効期間が一致する場合だけtrue。
 * @precondition 要求予定保存後、startCommand呼出し前の取消をControllerが確認している。
 * @postcondition コピー、別Owner、別用途、保存callback後の再利用を拒否する。
 * @effect N/A: Process内の元通知照合だけ。
 * @failure 登録欠落または結合不一致はfalse。
 * @invariant 要求呼出し後の例外・handle欠測を未発行根拠にしない。
 * @boundary Controllerの同期待機なし処理と現在状態保存Owner。
 * @security 通知は新しい要求・削除・回復Authorityを発行しない。
 * @concurrency 元保存callbackの終了時に失効し、別Processで再構成しない。
 */
function verifyUnissuedNotice(
  state: ObservationState,
  notice: unknown,
  recoveryCapability: unknown,
  managementCapability: unknown,
  purpose: unknown,
  operationId: unknown,
  recoveryId: unknown,
  kind: "resource_not_issued" | "provider_submission" = "resource_not_issued",
) {
  const value =
    notice && typeof notice === "object"
      ? state.submissionNotices.get(notice)
      : null;
  return (
    !!value &&
    value.kind === kind &&
    value.recoveryCapability === recoveryCapability &&
    value.managementCapability === managementCapability &&
    value.purpose === purpose &&
    value.operationId === operationId &&
    value.recoveryId === recoveryId
  );
}

/**
 * 本番または一候補だけの観測Ownerを作成する。
 * @responsibility 二WeakMapを私有に保持し、登録・失効・照合だけを提供する。
 * @trace ARCH-000008
 * @input N/A: 外部入力なし。
 * @returns 独立した観測Owner。
 * @precondition Controller生成時に呼び出す。
 * @postcondition 別Ownerの元objectを拒否する。
 * @effect Process内の二WeakMapを生成する。
 * @failure N/A: 外部I/Oなし。
 * @invariant 通知は同期callback後に失効する。
 * @boundary Controllerと保存Owner。
 * @security Mapや新しいAuthorityを公開しない。
 * @concurrency 同期操作だけを提供する。
 */
export function createProviderObservationOwner() {
  const state: ObservationState = {
    terminalObservations: new WeakMap(),
    submissionNotices: new WeakMap(),
  };
  return Object.freeze({
    registerTerminal: (
      result: object,
      value: NonNullable<
        ReturnType<ObservationState["terminalObservations"]["get"]>
      >,
    ) => {
      state.terminalObservations.set(result, value);
    },
    registerSubmission: (
      notice: object,
      value: NonNullable<
        ReturnType<ObservationState["submissionNotices"]["get"]>
      >,
    ) => {
      state.submissionNotices.set(notice, value);
    },
    revokeSubmission: (notice: object) => {
      state.submissionNotices.delete(notice);
    },
    borrowTerminalObservations: (
      ...args: Parameters<typeof borrowTerminalObservations> extends [
        ObservationState,
        ...infer Rest,
      ]
        ? Rest
        : never
    ) => borrowTerminalObservations(state, ...args),
    verifyUnissuedNotice: (
      ...args: Parameters<typeof verifyUnissuedNotice> extends [
        ObservationState,
        ...infer Rest,
      ]
        ? Rest
        : never
    ) => verifyUnissuedNotice(state, ...args),
  });
}

const runtimeOwnedProviderObservationOwner = createProviderObservationOwner();

/**
 * 本番Controllerの元終端結果を登録する。
 * @responsibility 元結果と観測の結合を保持する。
 * @trace ARCH-000008
 * @input result、value: 元結果と観測。
 * @returns N/A: 戻り値なし。
 * @precondition Controllerの終端位置から呼ぶ。
 * @postcondition 元objectへ結合する。
 * @effect 私有WeakMapを更新する。
 * @failure N/A: 外部I/Oなし。
 * @invariant 永続状態を更新しない。
 * @boundary Controllerの観測登録。
 * @security 新Authorityを生成しない。
 * @concurrency 同期登録。
 */
export function registerRuntimeOwnedProviderTerminalObservation(
  ...args: Parameters<
    ReturnType<typeof createProviderObservationOwner>["registerTerminal"]
  >
) {
  runtimeOwnedProviderObservationOwner.registerTerminal(...args);
}

/**
 * 本番Controllerの同期保存通知を登録する。
 * @responsibility callback中だけの相関を保持する。
 * @trace ARCH-000008
 * @input notice、value: 元通知と相関。
 * @returns N/A: 戻り値なし。
 * @precondition Controllerのcallback直前に呼ぶ。
 * @postcondition 元通知だけを照合可能にする。
 * @effect 私有WeakMapを更新する。
 * @failure N/A: 外部I/Oなし。
 * @invariant callback後に失効する。
 * @boundary Controllerの通知登録。
 * @security 新Authorityを生成しない。
 * @concurrency 同期登録。
 */
export function registerRuntimeOwnedProviderSubmissionNotice(
  ...args: Parameters<
    ReturnType<typeof createProviderObservationOwner>["registerSubmission"]
  >
) {
  runtimeOwnedProviderObservationOwner.registerSubmission(...args);
}

/**
 * 本番Controllerの同期保存通知を失効する。
 * @responsibility 正常・false・throw後の再利用を防ぐ。
 * @trace ARCH-000008
 * @input notice: 元通知。
 * @returns N/A: 戻り値なし。
 * @precondition 同期callbackのfinallyから呼ぶ。
 * @postcondition 同じ通知の照合はfalseとなる。
 * @effect 私有WeakMapから通知を除く。
 * @failure N/A: 外部I/Oなし。
 * @invariant 耐久記録を変更しない。
 * @boundary callback終了と通知寿命。
 * @security 通知を再生成しない。
 * @concurrency 同期失効。
 */
export function revokeRuntimeOwnedProviderSubmissionNotice(notice: object) {
  runtimeOwnedProviderObservationOwner.revokeSubmission(notice);
}

/**
 * 本番Controllerの元未発行通知を保存Ownerへ照合する。
 * @responsibility isolated試験の通知を本番根拠に混入させない。
 * @trace ARCH-000008
 * @input notice: 元通知、recoveryCapability: 元回復Owner、managementCapability: 元操作Owner、purpose: 用途、operationId: 実操作、recoveryId: exact参照。
 * @returns 本番の同期callback中に全結合が一致する場合だけtrue。
 * @precondition 本番Controllerの未発行保存callback中に呼び出す。
 * @postcondition callback後、コピーと別操作の通知はfalse。
 * @effect N/A: Process内の非Authority照合だけ。
 * @failure 根拠不在はfalse。保存・要求を再発行しない。
 * @invariant 過去unknownから未発行を推論しない。
 * @boundary 本番Controllerと現在状態Writer。
 * @security 返却値は操作Authorityではない。
 * @concurrency 同期callbackの寿命だけを使用する。
 */
export function verifyRuntimeOwnedDockerUnissuedNotice(
  notice: unknown,
  recoveryCapability: unknown,
  managementCapability: unknown,
  purpose: unknown,
  operationId: unknown,
  recoveryId: unknown,
) {
  return runtimeOwnedProviderObservationOwner.verifyUnissuedNotice(
    notice,
    recoveryCapability,
    managementCapability,
    purpose,
    operationId,
    recoveryId,
  );
}

/**
 * Provider要求直前だけ有効な元通知を照合する。
 * @responsibility 実行評価の保存根拠を同じController・操作・回復参照へ限定する。
 * @trace ARCH-000008
 * @input notice: 元通知、recoveryCapability: 元Owner、managementCapability: 操作Owner、operationId: 操作ID、recoveryId: exact参照。
 * @returns 本番の同期保存中に全相関が一致する場合だけtrue。
 * @precondition Provider要求をまだ発行していない同じControllerから呼び出す。
 * @postcondition コピー・別操作・失効通知と未発行通知の流用を拒否する。
 * @effect N/A: 既存私有通知の照合だけ。
 * @failure 根拠不在・相関不一致はfalse。
 * @invariant 保存予定をProvider実開始・外部送信成立と同一視しない。
 * @boundary Controllerと現在状態保存Owner。
 * @security 通知から実行・回復Authorityを発行しない。
 * @concurrency 同期保存callback終了時に失効する。
 */
export function verifyRuntimeOwnedDockerProviderSubmissionNotice(
  notice: unknown,
  recoveryCapability: unknown,
  managementCapability: unknown,
  operationId: unknown,
  recoveryId: unknown,
) {
  return runtimeOwnedProviderObservationOwner.verifyUnissuedNotice(
    notice,
    recoveryCapability,
    managementCapability,
    "start_provider_attached",
    operationId,
    recoveryId,
    "provider_submission",
  );
}

/**
 * 本番Controllerの同じ完了結果から終端観測を借用する。
 *
 * @responsibility 本番の終端観測と同じ操作・回復参照の照合を所有する。
 * @trace ARCH-000008
 * @input result、managementCapability、operationId、recoveryId: 本番結果と対象。
 * @returns 保持中の非Authority観測、またはnull。
 * @precondition 同じ本番Controllerの元の結果を渡す。
 * @postcondition 模擬Runtime・コピー・別操作の結果を拒否する。
 * @effect N/A: 本番Ownerの私有保持値だけを読む。
 * @failure 未登録・相関不一致ではnullへ閉じる。
 * @invariant 終端観測を清掃・保存・削除Authorityへ昇格しない。
 * @boundary Controller完了から同じ操作の終端保存への内部搬送。
 * @security 管理CapabilityやProvider本文を返さない。
 * @concurrency N/A: 同期照合だけであり外部待機を行わない。
 */
export function borrowRuntimeOwnedDockerTerminalObservations(
  result: unknown,
  managementCapability: unknown,
  operationId: unknown,
  recoveryId: unknown,
) {
  return runtimeOwnedProviderObservationOwner.borrowTerminalObservations(
    result,
    managementCapability,
    operationId,
    recoveryId,
  );
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
