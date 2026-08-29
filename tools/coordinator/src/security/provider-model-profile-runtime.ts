import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

export const PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT =
  "crdd-coordinator/provider-model-profile-runtime";
export const PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT_REVISION = 2;

const REQUEST_KEYS = new Set([
  "provider",
  "family",
  "role",
  "modelTier",
  "speedMode",
  "billingMode",
]);
const MODEL_TIERS = new Set(["preferred", "upper_allowed"]);
const ROLES = new Set([
  "coordinator",
  "executor",
  "independent_reviewer",
  "result_integration",
]);

type Provider = "codex" | "claude";

function resolveProfile(
  provider: Provider,
  family: "sol" | "opus",
  role:
    | "coordinator"
    | "executor"
    | "independent_reviewer"
    | "result_integration",
  modelTier: "preferred" | "upper_allowed",
) {
  const isUpperModelTier = modelTier === "upper_allowed";
  if (provider === "codex" && family === "sol") {
    const isolatedTaskRole =
      role === "executor" || role === "independent_reviewer";
    return Object.freeze({
      provider,
      profileId: isolatedTaskRole
        ? isUpperModelTier
          ? "PROFILE-100004"
          : "PROFILE-100003"
        : isUpperModelTier
          ? "PROFILE-100002"
          : "PROFILE-100001",
      exactModelId: isolatedTaskRole ? "gpt-5.5" : "gpt-5.6-sol",
      family,
      selectionRole: role,
      modelTier,
      speedMode: "normal" as const,
      billingMode: "subscription_oauth" as const,
      compatibilityReason: isolatedTaskRole
        ? ("gpt_5_6_code_mode_only_host_unavailable_in_fixed_linux_runtime" as const)
        : null,
    });
  }
  if (provider === "claude" && family === "opus") {
    return Object.freeze({
      provider,
      profileId: isUpperModelTier ? "PROFILE-200002" : "PROFILE-200001",
      exactModelId: "opus",
      family,
      selectionRole: role,
      modelTier,
      speedMode: "normal" as const,
      billingMode: "subscription_oauth" as const,
      compatibilityReason: null,
    });
  }
  return null;
}

export function resolveRuntimeOwnedProviderModelProfile(rawRequest: unknown) {
  const request = snapshotPlainRecord(rawRequest, REQUEST_KEYS);
  if (
    !request ||
    (request.provider !== "codex" && request.provider !== "claude") ||
    (request.family !== "sol" && request.family !== "opus") ||
    typeof request.role !== "string" ||
    !ROLES.has(request.role) ||
    !MODEL_TIERS.has(request.modelTier as string) ||
    request.speedMode !== "normal" ||
    request.billingMode !== "subscription_oauth"
  ) {
    return null;
  }
  return resolveProfile(
    request.provider,
    request.family,
    request.role as
      | "coordinator"
      | "executor"
      | "independent_reviewer"
      | "result_integration",
    request.modelTier as "preferred" | "upper_allowed",
  );
}

export function describeProviderModelProfileRuntimeContract() {
  return Object.freeze({
    contract: PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT,
    contractRevision: PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT_REVISION,
    profileIds: Object.freeze([
      "PROFILE-100001",
      "PROFILE-100002",
      "PROFILE-100003",
      "PROFILE-100004",
      "PROFILE-200001",
      "PROFILE-200002",
    ]),
    codex: Object.freeze({
      preferredFamily: "sol",
      toolFreeExactModelId: "gpt-5.6-sol",
      isolatedTaskExactModelId: "gpt-5.5",
      compatibilityReason:
        "gpt_5_6_code_mode_only_host_unavailable_in_fixed_linux_runtime",
      verifiedEfforts: Object.freeze(["low", "medium", "high"]),
      evidence:
        "official_cli_direct_isolated_task_verified_2026_08_30_and_upstream_issue_41255",
    }),
    claude: Object.freeze({
      family: "opus",
      exactModelId: "opus",
      verifiedEfforts: Object.freeze(["low", "medium", "high"]),
      evidence: "fixed_claude_code_2_1_220_offline_help_verified_2026_08_25",
    }),
    modelTiers: Object.freeze(["preferred", "upper_allowed"]),
    upperTierChangesFamily: false,
    upperTierChangesExactModel: false,
    speedMode: "normal_only",
    billingMode: "subscription_oauth_only",
    automaticFallback: false,
    compatibilityProfileIsFixed: true,
    compatibilityProfileReevaluationTrigger:
      "fixed_codex_release_proves_gpt_5_6_code_mode_host_execution",
    fableActivated: false,
    xhighOrMaxActivated: false,
    availabilityAuthority: "provider_eligibility_runtime_separate",
    providerEffectAllowed: false,
  });
}
