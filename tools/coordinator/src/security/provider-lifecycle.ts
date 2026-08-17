import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";

export const PROVIDER_LIFECYCLE_CONTRACT =
  "crdd-coordinator/provider-lifecycle";
export const PROVIDER_LIFECYCLE_CONTRACT_REVISION = 1;

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
const OBSERVATION_KEYS = new Set([
  "contract",
  "contractRevision",
  "provider",
  "mode",
  "states",
  "elapsedMs",
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
    method: "existing_chatgpt_plan_subscription_oauth",
    dedicatedHomeScope: "local_os_user_and_provider",
  }),
  claude: Object.freeze({
    provider: "claude",
    method: "existing_subscription_oauth",
    dedicatedHomeScope: "local_os_user_and_provider",
  }),
});

function isMember<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.some((item) => item === value);
}

function isBoundedInteger(value: unknown, maximum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= maximum
  );
}

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked",
    reason,
    spawnAllowed: false,
    operationCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}

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
        : "provider_egress_auth_and_fixed_image_binding_not_implemented",
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
    shellAllowed: false,
    pathLookupAllowed: false,
  });
}

function fakeObservationInternal(candidate: unknown) {
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
  if (!value.processTreeTerminated || !value.containerAbsent)
    return blocked("provider_process_absence_unconfirmed");
  if (value.stdoutBytes > PROVIDER_LIFECYCLE_LIMITS.stdoutBytes)
    return blocked("provider_stdout_limit_exceeded");
  if (value.stderrBytes > PROVIDER_LIFECYCLE_LIMITS.stderrBytes)
    return blocked("provider_stderr_limit_exceeded");
  if (value.timedOut || value.elapsedMs > PROVIDER_LIFECYCLE_LIMITS.deadlineMs)
    return blocked("provider_deadline_exceeded");
  if (value.cancellationRequested)
    return blocked("provider_operation_cancelled");
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
    status: "confirmed",
    reason: null,
    spawnAllowed: false,
    fakeProviderOnly: true,
    operationCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processTreeTerminated: true,
    containerAbsent: true,
  });
}

export function evaluateFakeProviderLifecycle(candidate: unknown) {
  return fakeObservationInternal(candidate);
}

export function describeProviderLifecycleContract() {
  return Object.freeze({
    contract: PROVIDER_LIFECYCLE_CONTRACT,
    contractRevision: PROVIDER_LIFECYCLE_CONTRACT_REVISION,
    implementationState: "fake_provider_candidate_only",
    providers: PROVIDERS,
    modes: MODES,
    authPolicies: AUTH_POLICIES,
    authenticationPolicyState: "approved_policy_only",
    dedicatedProviderHome: Object.freeze({
      scope: "local_os_user_and_provider",
      persistentAcrossOperations: true,
      sharedAcrossRepositoriesForSameOsUser: true,
      hostDefaultHomeImportAllowed: false,
      otherProviderHomeSharingAllowed: false,
      operationCleanupOwned: false,
      explicitLoginRequired: true,
      protectionVerification: "not_implemented",
      authSessionProbe: "not_implemented",
    }),
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
    rawAuthOutputRecorded: false,
    oauthTokenReadByRuntime: false,
    fakeProviderConfersRealProviderReadiness: false,
    operationCapabilityIssued: false,
  });
}
