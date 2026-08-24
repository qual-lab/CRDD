import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

export const PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT =
  "crdd-coordinator/provider-model-profile-runtime";
export const PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT_REVISION = 1;

const REQUEST_KEYS = new Set([
  "provider",
  "family",
  "modelTier",
  "speedMode",
  "billingMode",
]);
const MODEL_TIERS = new Set(["preferred", "upper_allowed"]);

type Provider = "codex" | "claude";

function resolveProfile(
  provider: Provider,
  family: "sol" | "opus",
  modelTier: "preferred" | "upper_allowed",
) {
  const isUpperModelTier = modelTier === "upper_allowed";
  if (provider === "codex" && family === "sol") {
    return Object.freeze({
      provider,
      profileId: isUpperModelTier ? "PROFILE-100002" : "PROFILE-100001",
      exactModelId: "gpt-5.6-sol",
      family,
      modelTier,
      speedMode: "normal" as const,
      billingMode: "subscription_oauth" as const,
    });
  }
  if (provider === "claude" && family === "opus") {
    return Object.freeze({
      provider,
      profileId: isUpperModelTier ? "PROFILE-200002" : "PROFILE-200001",
      exactModelId: "opus",
      family,
      modelTier,
      speedMode: "normal" as const,
      billingMode: "subscription_oauth" as const,
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
    !MODEL_TIERS.has(request.modelTier as string) ||
    request.speedMode !== "normal" ||
    request.billingMode !== "subscription_oauth"
  ) {
    return null;
  }
  return resolveProfile(
    request.provider,
    request.family,
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
      "PROFILE-200001",
      "PROFILE-200002",
    ]),
    codex: Object.freeze({
      family: "sol",
      exactModelId: "gpt-5.6-sol",
      verifiedEfforts: Object.freeze(["low", "medium", "high"]),
      evidence: "official_openai_model_documentation_reviewed_2026_08_25",
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
    fableActivated: false,
    xhighOrMaxActivated: false,
    availabilityAuthority: "provider_eligibility_runtime_separate",
    providerEffectAllowed: false,
  });
}
