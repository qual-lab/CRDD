import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

export const PROVIDER_MODEL_SELECTION_RUNTIME_CONTRACT =
  "crdd-coordinator/provider-model-selection-runtime";
export const PROVIDER_MODEL_SELECTION_RUNTIME_CONTRACT_REVISION = 2;

const SELECTION_KEYS = new Set([
  "provider",
  "role",
  "workClass",
  "planState",
  "risk",
  "difficulty",
  "decisionImpact",
  "isLocalCandidateOnly",
  "hasUnresolvedDirection",
  "requiresCrossContextAlignment",
]);
const PROVIDERS = new Set(["codex", "claude"]);
const ROLES = new Set([
  "coordinator",
  "executor",
  "independent_reviewer",
  "result_integration",
]);
const WORK_CLASSES = new Set([
  "bounded_implementation",
  "bounded_verification",
  "diagnosis",
  "design_alignment",
  "architecture_review",
  "security_review",
  "gap_impact_audit",
]);
const PLAN_STATES = new Set(["complete", "partial", "open"]);
const RISKS = new Set(["low", "material", "high"]);
const DIFFICULTIES = new Set(["low", "medium", "high"]);
const DECISION_IMPACTS = new Set(["limited", "material", "critical"]);
const HIGH_COST_REASON_CODES = new Set([
  "high_difficulty",
  "critical_decision_impact",
  "high_risk_change",
  "compound_unresolved_cross_context_alignment",
]);

type Provider = "codex" | "claude";
type Effort = "low" | "medium" | "high";

function createBlockedResult(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    provider: null,
    role: null,
    familyPreference: null,
    effort: null,
    modelTier: null,
    speedMode: null,
    rationaleCodes: Object.freeze([] as string[]),
    selectionNotice: null,
    exactModelId: null,
    selectionCapabilityIssued: false,
    providerEffectAllowed: false,
    automaticProviderFallbackAllowed: false,
    highCostSelection: false,
  });
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function selectFamilyPreference(provider: Provider) {
  return provider === "codex" ? "sol" : "opus";
}

function selectRationaleCodes(value: Readonly<Record<string, unknown>>) {
  const rationaleCodes: string[] = [];
  if (value.role === "coordinator") {
    rationaleCodes.push("coordinator_direction_ownership");
  }
  if (value.role === "independent_reviewer") {
    rationaleCodes.push("independent_review_requires_critique");
  }
  if (value.role === "result_integration") {
    rationaleCodes.push("result_integration_requires_alignment");
  }
  if (value.workClass === "design_alignment") {
    rationaleCodes.push("design_or_policy_alignment_required");
  }
  if (
    value.workClass === "architecture_review" ||
    value.workClass === "security_review"
  ) {
    rationaleCodes.push("architecture_or_security_review_required");
  }
  if (value.workClass === "gap_impact_audit") {
    rationaleCodes.push("gap_impact_audit_required");
  }
  if (value.hasUnresolvedDirection === true || value.planState === "open") {
    rationaleCodes.push("unresolved_direction_requires_reasoning");
  }
  if (value.requiresCrossContextAlignment === true) {
    rationaleCodes.push("cross_context_alignment_required");
  }
  if (value.risk === "high") {
    rationaleCodes.push("high_risk_change");
  }
  if (value.difficulty === "high") {
    rationaleCodes.push("high_difficulty");
  }
  if (value.decisionImpact === "critical") {
    rationaleCodes.push("critical_decision_impact");
  }
  if (
    value.hasUnresolvedDirection === true &&
    value.requiresCrossContextAlignment === true
  ) {
    rationaleCodes.push("compound_unresolved_cross_context_alignment");
  }
  const isBoundedLow =
    value.role === "executor" &&
    value.workClass === "bounded_implementation" &&
    value.planState === "complete" &&
    value.risk === "low" &&
    value.difficulty === "low" &&
    value.decisionImpact === "limited" &&
    value.isLocalCandidateOnly === true &&
    value.hasUnresolvedDirection === false &&
    value.requiresCrossContextAlignment === false;
  if (isBoundedLow) {
    rationaleCodes.push("complete_bounded_local_plan");
  } else if (
    !rationaleCodes.some((reason) => HIGH_COST_REASON_CODES.has(reason))
  ) {
    rationaleCodes.push("bounded_work_requires_limited_reasoning");
  }
  return Object.freeze(rationaleCodes);
}

function selectEffort(rationaleCodes: readonly string[]): Effort {
  if (rationaleCodes.includes("complete_bounded_local_plan")) return "low";
  return "medium";
}

function describeSelectionNotice(
  provider: Provider,
  role: string,
  family: string,
  effort: Effort,
  rationaleCodes: readonly string[],
) {
  return [
    `[委譲選定] provider=${provider} role=${role} family=${family} effort=${effort} speed=normal`,
    `選定理由=${rationaleCodes.join(",")}`,
    `高コスト選択=${effort === "high" ? "yes" : "no"}`,
    "再選定条件=scope_change,policy_conflict,material_risk,plan_insufficient",
  ].join("\n");
}

export function selectProviderModelCandidate(candidate: unknown) {
  const value = snapshotPlainRecord(candidate, SELECTION_KEYS);
  if (!value)
    return createBlockedResult("provider_model_selection_shape_invalid");
  if (!PROVIDERS.has(value.provider as string)) {
    return createBlockedResult("provider_model_selection_provider_invalid");
  }
  if (!ROLES.has(value.role as string)) {
    return createBlockedResult("provider_model_selection_role_invalid");
  }
  if (!WORK_CLASSES.has(value.workClass as string)) {
    return createBlockedResult("provider_model_selection_work_class_invalid");
  }
  if (!PLAN_STATES.has(value.planState as string)) {
    return createBlockedResult("provider_model_selection_plan_state_invalid");
  }
  if (!RISKS.has(value.risk as string)) {
    return createBlockedResult("provider_model_selection_risk_invalid");
  }
  if (!DIFFICULTIES.has(value.difficulty as string)) {
    return createBlockedResult("provider_model_selection_difficulty_invalid");
  }
  if (!DECISION_IMPACTS.has(value.decisionImpact as string)) {
    return createBlockedResult(
      "provider_model_selection_decision_impact_invalid",
    );
  }
  if (
    !isBoolean(value.isLocalCandidateOnly) ||
    !isBoolean(value.hasUnresolvedDirection) ||
    !isBoolean(value.requiresCrossContextAlignment)
  ) {
    return createBlockedResult("provider_model_selection_fact_invalid");
  }
  const provider = value.provider as Provider;
  const role = value.role as string;
  const family = selectFamilyPreference(provider);
  const rationaleCodes = selectRationaleCodes(value);
  const requestedEffort = rationaleCodes.some((reason) =>
    HIGH_COST_REASON_CODES.has(reason),
  )
    ? "high"
    : selectEffort(rationaleCodes);
  const effort: Effort =
    requestedEffort === "high" ? "medium" : requestedEffort;
  const effectiveRationaleCodes =
    requestedEffort === "high"
      ? Object.freeze([
          ...rationaleCodes,
          "high_cost_requires_explicit_user_policy",
        ])
      : rationaleCodes;
  const highCostSelection = false;
  return Object.freeze({
    status: "candidate" as const,
    reason: "verified_runtime_profile_and_selection_grant_required",
    provider,
    role,
    familyPreference: family,
    effort,
    modelTier: highCostSelection ? "upper_allowed" : "preferred",
    speedMode: "normal" as const,
    rationaleCodes: effectiveRationaleCodes,
    selectionNotice: describeSelectionNotice(
      provider,
      role,
      family,
      effort,
      effectiveRationaleCodes,
    ),
    exactModelId: null,
    modelResolution: "verified_runtime_profile_required" as const,
    selectionCapabilityIssued: false,
    providerEffectAllowed: false,
    automaticProviderFallbackAllowed: false,
    highCostSelection,
  });
}

export function describeProviderModelSelectionRuntimeContract() {
  return Object.freeze({
    contract: PROVIDER_MODEL_SELECTION_RUNTIME_CONTRACT,
    contractRevision: PROVIDER_MODEL_SELECTION_RUNTIME_CONTRACT_REVISION,
    selectionOwner: "coordinator_runtime",
    selectionTiming: "before_provider_effect",
    selectionUnit: "operation_role",
    defaultFamilies: Object.freeze({ codex: "sol", claude: "opus" }),
    alternateFamilies: Object.freeze({
      codex: "verified_profile_only",
      claude: "fable_candidate_not_activated_until_verified",
    }),
    effortPolicy: Object.freeze({
      completeBoundedLocalImplementation: "low",
      ordinaryCoordinationReviewOrLimitedReasoning: "medium",
      highDifficultyCriticalImpactHighRiskOrCompoundConflict:
        "medium_until_explicit_user_high_cost_policy",
      automaticXhighOrMax: false,
    }),
    roleAloneAllowsHighCostSelection: false,
    highCostSelectionRequiresDecisiveReason: true,
    highCostSelectionRequiresExplicitUserPolicy: true,
    productionHighCostSelectionActivated: false,
    upperModelSelection: "not_activated_without_explicit_user_policy",
    speedMode: "normal_only",
    providerFallback: "forbidden",
    midExecutionSwitching: "forbidden",
    reselection: "return_to_coordinator_and_issue_superseding_selection_grant",
    rationaleRequired: true,
    rationaleSource: "closed_work_class_and_verified_operation_facts",
    selectionNotice:
      "required_in_coordinator_operation_context_before_delegation",
    selectionNoticeContainsPrivateReasoning: false,
    exactModelIdSource: "verified_runtime_profile",
    selectedModelAndEffortBoundToAuthority:
      "selection_grant_and_process_plan_connected",
    selectionCapabilityIssued: false,
    providerEffectAllowed: false,
  });
}
