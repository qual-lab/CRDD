import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import { describeProviderBillingPolicyContract } from "./provider-billing-policy.ts";
import { describeProviderHomeContract } from "./provider-home.ts";
import { describeProviderHomeMountGrantContract } from "./provider-home-mount-grant.ts";

export const PROVIDER_LIFECYCLE_CONTRACT =
  "crdd-coordinator/provider-lifecycle";
export const PROVIDER_LIFECYCLE_CONTRACT_REVISION = 6;

const PROVIDERS = Object.freeze(["codex", "claude"] as const);
const MODES = Object.freeze(["login", "run"] as const);
const FAKE_STATES = Object.freeze([
  "prepared",
  "submission_started",
  "created",
  "inspect_verified",
  "started",
  "exited_or_terminated",
  "absence_confirmed",
  "cleanup_confirmed",
]);
const PLAN_KEYS = new Set(["provider", "mode"]);
const billingPolicy = describeProviderBillingPolicyContract();
const OBSERVATION_KEYS = new Set([
  "contract",
  "contractRevision",
  "provider",
  "mode",
  "states",
  "stdinBytes",
  "elapsedMs",
  "cancellationElapsedMs",
  "stdoutBytes",
  "stderrBytes",
  "exitCode",
  "signal",
  "timedOut",
  "cancellationRequested",
  "processTreeTerminated",
  "containerAbsent",
  "resultCount",
  "resultFormat",
  "quotaState",
]);

export const PROVIDER_LIFECYCLE_LIMITS = Object.freeze({
  deadlineMs: 300_000,
  cancellationGraceMs: 5_000,
  stdinBytes: 1_048_576,
  stdoutBytes: 1_048_576,
  stderrBytes: 262_144,
  resultCount: 1,
});

const AUTH_POLICIES = Object.freeze({
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

/**
 * isMemberの処理を実行する。
 *
 * @responsibility isMemberに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input values: T、value: unknown
 * @returns value is T[number]を返す。
 * @precondition 「values: T、value: unknown」がisMemberの入力契約を満たす。
 * @postcondition isMemberの責務を完了した結果だけを返す。
 * @effect N/A: isMemberは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isMemberは独自の失敗分岐を所有しない。
 * @invariant isMemberは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isMemberはProcess内の同一Subsystemで完結する。
 * @security isMemberはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isMemberは共有非同期状態を持たない同期処理である。
 */
function isMember<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.some((item) => item === value);
}

/**
 * isBoundedIntegerの処理を実行する。
 *
 * @responsibility isBoundedIntegerに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown、maximum: number
 * @returns value is numberを返す。
 * @precondition 「value: unknown、maximum: number」がisBoundedIntegerの入力契約を満たす。
 * @postcondition isBoundedIntegerの責務を完了した結果だけを返す。
 * @effect N/A: isBoundedIntegerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isBoundedIntegerは独自の失敗分岐を所有しない。
 * @invariant isBoundedIntegerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isBoundedIntegerはProcess内の同一Subsystemで完結する。
 * @security isBoundedIntegerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isBoundedIntegerは共有非同期状態を持たない同期処理である。
 */
function isBoundedInteger(value: unknown, maximum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= maximum
  );
}

/**
 * blockedの処理を実行する。
 *
 * @responsibility blockedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input reason: string
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect blockedは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(reason: string) {
  return Object.freeze({
    status: "blocked",
    reason,
    spawnAllowed: false,
    operationCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    observationAuthority: false,
    fakeProviderExecuted: false,
    processAbsenceVerified: false,
    resultNormalizationVerified: false,
    providerHomeMountGrantIssued: false,
    billingPolicy: billingPolicy,
  });
}

/**
 * planProviderLifecycleの処理を実行する。
 *
 * @responsibility planProviderLifecycleに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input candidate: unknown
 * @returns planProviderLifecycleの計算結果を返す。
 * @precondition 「candidate: unknown」がplanProviderLifecycleの入力契約を満たす。
 * @postcondition planProviderLifecycleの責務を完了した結果だけを返す。
 * @effect N/A: planProviderLifecycleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: planProviderLifecycleは独自の失敗分岐を所有しない。
 * @invariant planProviderLifecycleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: planProviderLifecycleはProcess内の同一Subsystemで完結する。
 * @security planProviderLifecycleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: planProviderLifecycleは共有非同期状態を持たない同期処理である。
 */
export function planProviderLifecycle(candidate: unknown) {
  const value = snapshotPlainRecord(candidate, PLAN_KEYS);
  if (!value) return blocked("provider_lifecycle_plan_shape_invalid");
  if (!isMember(PROVIDERS, value.provider))
    return blocked("provider_lifecycle_provider_not_supported");
  if (!isMember(MODES, value.mode))
    return blocked("provider_lifecycle_mode_not_supported");

  const authPolicy = AUTH_POLICIES[value.provider];
  return Object.freeze({
    ...blocked(
      value.mode === "login"
        ? "provider_explicit_login_effect_not_implemented"
        : "provider_home_protection_egress_auth_and_fixed_image_binding_not_implemented",
    ),
    provider: value.provider,
    mode: value.mode,
    authPolicy,
    fixedImageRequired: true,
    fixedImageConfigured: false,
    autoUpdateAllowed: false,
    hostCredentialImportAllowed: false,
    apiKeyAllowed: false,
    additionalCreditPurchaseAllowed: false,
    billingPolicy: billingPolicy,
    shellAllowed: false,
    pathLookupAllowed: false,
  });
}

/**
 * syntheticFakeObservationInternalの処理を実行する。
 *
 * @responsibility syntheticFakeObservationInternalに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input candidate: unknown
 * @returns syntheticFakeObservationInternalの計算結果を返す。
 * @precondition 「candidate: unknown」がsyntheticFakeObservationInternalの入力契約を満たす。
 * @postcondition syntheticFakeObservationInternalの責務を完了した結果だけを返す。
 * @effect syntheticFakeObservationInternalは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: syntheticFakeObservationInternalは独自の失敗分岐を所有しない。
 * @invariant syntheticFakeObservationInternalは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security syntheticFakeObservationInternalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: syntheticFakeObservationInternalは共有非同期状態を持たない同期処理である。
 */
function syntheticFakeObservationInternal(candidate: unknown) {
  const value = snapshotPlainRecord(candidate, OBSERVATION_KEYS);
  if (!value) return blocked("provider_lifecycle_observation_shape_invalid");
  if (
    value.contract !== PROVIDER_LIFECYCLE_CONTRACT ||
    value.contractRevision !== PROVIDER_LIFECYCLE_CONTRACT_REVISION ||
    value.provider !== "fake" ||
    value.mode !== "run"
  ) {
    return blocked("provider_lifecycle_observation_contract_mismatch");
  }
  const states = snapshotPlainArray<string>(value.states, FAKE_STATES.length);
  if (
    states.status !== "ok" ||
    states.value.length !== FAKE_STATES.length ||
    states.value.some((state, index) => state !== FAKE_STATES[index])
  ) {
    return blocked("provider_lifecycle_state_sequence_invalid");
  }
  if (
    !isBoundedInteger(
      value.stdinBytes,
      PROVIDER_LIFECYCLE_LIMITS.stdinBytes * 2,
    ) ||
    !isBoundedInteger(
      value.elapsedMs,
      PROVIDER_LIFECYCLE_LIMITS.deadlineMs * 2,
    ) ||
    !isBoundedInteger(
      value.stdoutBytes,
      PROVIDER_LIFECYCLE_LIMITS.stdoutBytes * 2,
    ) ||
    !isBoundedInteger(
      value.stderrBytes,
      PROVIDER_LIFECYCLE_LIMITS.stderrBytes * 2,
    ) ||
    !isBoundedInteger(value.resultCount, 2) ||
    (value.exitCode !== null && !isBoundedInteger(value.exitCode, 255)) ||
    (value.signal !== null && typeof value.signal !== "string") ||
    typeof value.timedOut !== "boolean" ||
    typeof value.cancellationRequested !== "boolean" ||
    typeof value.processTreeTerminated !== "boolean" ||
    typeof value.containerAbsent !== "boolean" ||
    typeof value.resultFormat !== "string" ||
    typeof value.quotaState !== "string"
  ) {
    return blocked("provider_lifecycle_observation_value_invalid");
  }
  if (
    (value.cancellationRequested === false &&
      value.cancellationElapsedMs !== null) ||
    (value.cancellationRequested === true &&
      !isBoundedInteger(
        value.cancellationElapsedMs,
        PROVIDER_LIFECYCLE_LIMITS.cancellationGraceMs * 2,
      ))
  ) {
    return blocked("provider_cancellation_observation_inconsistent");
  }
  if (!value.processTreeTerminated || !value.containerAbsent)
    return blocked("provider_process_absence_unconfirmed");
  if (value.stdinBytes > PROVIDER_LIFECYCLE_LIMITS.stdinBytes)
    return blocked("provider_stdin_limit_exceeded");
  if (value.stdoutBytes > PROVIDER_LIFECYCLE_LIMITS.stdoutBytes)
    return blocked("provider_stdout_limit_exceeded");
  if (value.stderrBytes > PROVIDER_LIFECYCLE_LIMITS.stderrBytes)
    return blocked("provider_stderr_limit_exceeded");
  if (value.timedOut || value.elapsedMs > PROVIDER_LIFECYCLE_LIMITS.deadlineMs)
    return blocked("provider_deadline_exceeded");
  if (value.cancellationRequested)
    return blocked(
      (value.cancellationElapsedMs as number) >
        PROVIDER_LIFECYCLE_LIMITS.cancellationGraceMs
        ? "provider_cancellation_grace_exceeded"
        : "provider_operation_cancelled",
    );
  if (value.quotaState === "exhausted")
    return blocked("provider_subscription_quota_exhausted");
  if (value.quotaState !== "available")
    return blocked("provider_subscription_quota_state_unknown");
  if (value.signal !== null) return blocked("provider_process_signalled");
  if (value.exitCode !== 0) return blocked("provider_process_exit_nonzero");
  if (
    value.resultCount !== PROVIDER_LIFECYCLE_LIMITS.resultCount ||
    value.resultFormat !== "exact_json_object"
  ) {
    return blocked("provider_result_invalid");
  }
  return Object.freeze({
    status: "candidate",
    reason: "synthetic_fake_observation_non_authoritative",
    spawnAllowed: false,
    syntheticFakeObservationOnly: true,
    observationAuthority: false,
    fakeProviderExecuted: false,
    processAbsenceVerified: false,
    resultNormalizationVerified: false,
    providerHomeMountGrantIssued: false,
    operationCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processTreeTerminationClaimed: true,
    containerAbsenceClaimed: true,
  });
}

/**
 * evaluateSyntheticFakeProviderObservationCandidateの処理を実行する。
 *
 * @responsibility evaluateSyntheticFakeProviderObservationCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input candidate: unknown
 * @returns evaluateSyntheticFakeProviderObservationCandidateの計算結果を返す。
 * @precondition 「candidate: unknown」がevaluateSyntheticFakeProviderObservationCandidateの入力契約を満たす。
 * @postcondition evaluateSyntheticFakeProviderObservationCandidateの責務を完了した結果だけを返す。
 * @effect N/A: evaluateSyntheticFakeProviderObservationCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: evaluateSyntheticFakeProviderObservationCandidateは独自の失敗分岐を所有しない。
 * @invariant evaluateSyntheticFakeProviderObservationCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateSyntheticFakeProviderObservationCandidateはProcess内の同一Subsystemで完結する。
 * @security evaluateSyntheticFakeProviderObservationCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateSyntheticFakeProviderObservationCandidateは共有非同期状態を持たない同期処理である。
 */
export function evaluateSyntheticFakeProviderObservationCandidate(
  candidate: unknown,
) {
  return syntheticFakeObservationInternal(candidate);
}

/**
 * describeProviderLifecycleContractの処理を実行する。
 *
 * @responsibility describeProviderLifecycleContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderLifecycleContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderLifecycleContractの入力契約を満たす。
 * @postcondition describeProviderLifecycleContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderLifecycleContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderLifecycleContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderLifecycleContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderLifecycleContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderLifecycleContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderLifecycleContractは共有非同期状態を持たない同期処理である。
 */
export function describeProviderLifecycleContract() {
  return Object.freeze({
    contract: PROVIDER_LIFECYCLE_CONTRACT,
    contractRevision: PROVIDER_LIFECYCLE_CONTRACT_REVISION,
    implementationState:
      "synthetic_candidate_and_repository_owned_docker_fake_observation",
    providers: PROVIDERS,
    modes: MODES,
    authPolicies: AUTH_POLICIES,
    authenticationPolicyState: "approved_policy_only",
    dedicatedProviderHome: describeProviderHomeContract(),
    providerHomeMountGrant: describeProviderHomeMountGrantContract(),
    limits: PROVIDER_LIFECYCLE_LIMITS,
    fixedDigestImageRequired: true,
    fixedDigestImageConfigured: false,
    providerAutoUpdateAllowed: false,
    providerSessionResumeAllowed: false,
    telemetryDecision: "not_implemented",
    realProviderSpawn: "blocked_before_spawn",
    realProviderEgress: "not_implemented",
    apiKeyAllowed: false,
    additionalCreditPurchaseAllowed: false,
    billingPolicy: billingPolicy,
    rawAuthOutputRecorded: false,
    oauthTokenReadByRuntime: false,
    syntheticFakeObservationState: "candidate_non_authoritative",
    dynamicFakeProviderObservation: Object.freeze({
      implementationState: "implemented_for_doctor_isolation_success_probe",
      provenance: "repository_owned_docker_fake_provider",
      normalExecution: "implemented_candidate",
      exactResultNormalization: "implemented_candidate",
      containerAndProcessTreeAbsence:
        "implemented_candidate_after_owned_cleanup",
      timeoutAndOutputLimitClassification: "implemented",
      inFlightCancellation: "not_implemented",
      actualFailureScenarioVerification: "not_verified",
      diagnosticDockerContainerEffectIssued: true,
      diagnosticFilesystemEffectIssued: true,
      providerNetworkEffectIssued: false,
      runtimeAuthorityIssued: false,
      operationCapabilityIssued: false,
      realProviderReadiness: false,
    }),
    fakeProviderExecution: "implemented_for_doctor_isolation_success_probe",
    fakeProviderConfersRealProviderReadiness: false,
    operationCapabilityIssued: false,
  });
}
