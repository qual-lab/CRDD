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

type Provider = "codex" | "claude";
type ObservationState =
  | "confirmed"
  | "runtime_preflight_required"
  | "bounded_request_check"
  | "unavailable"
  | "unknown";
type ProviderObservation = Readonly<{
  requiredCapability: ObservationState;
  subscriptionAuth: ObservationState;
  subscriptionQuota: ObservationState;
  officialDistribution: ObservationState;
  policy: ObservationState;
}>;
type RuntimeDependencies = Readonly<{
  observeProvider: (provider: Provider) => unknown;
}>;

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

export function observeRuntimeOwnedProviderEligibility() {
  return observeEligibility(productionDependencies);
}

export function createIsolatedProviderEligibilityRuntimeCandidate(
  dependencies: RuntimeDependencies,
) {
  return Object.freeze({
    productionAuthority: false as const,
    observe: () => observeEligibility(dependencies),
  });
}

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
