/**
 * provider-model-selection-runtimeに属する責務をまとめる。
 *
 * @responsibility Providerを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000010
 */
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

/**
 * provider-model-selection-runtimeで使用するProviderの値契約を定義する。
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
 * provider-model-selection-runtimeで使用するEffortの値契約を定義する。
 *
 * @responsibility EffortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000010
 * @shape Effortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Effortで宣言した値と責務の対応を維持する。
 * @boundary N/A: Effortの宣言は外部境界を開かない。
 * @security EffortはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Effortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Effort = "low" | "medium" | "high";

/**
 * Blocked 結果を構築する。
 *
 * @responsibility Blocked 結果の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000010
 * @input reason: string
 * @returns createBlockedResultの計算結果を返す。
 * @precondition 「reason: string」がcreateBlockedResultの入力契約を満たす。
 * @postcondition createBlockedResultの責務を完了した結果だけを返す。
 * @effect N/A: createBlockedResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createBlockedResultは独自の失敗分岐を所有しない。
 * @invariant createBlockedResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createBlockedResultはProcess内の同一Subsystemで完結する。
 * @security createBlockedResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createBlockedResultは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Booleanかを判定する。
 *
 * @responsibility Booleanの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000010
 * @input value: unknown
 * @returns value is booleanを返す。
 * @precondition 「value: unknown」がisBooleanの入力契約を満たす。
 * @postcondition isBooleanの責務を完了した結果だけを返す。
 * @effect N/A: isBooleanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isBooleanは独自の失敗分岐を所有しない。
 * @invariant isBooleanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isBooleanはProcess内の同一Subsystemで完結する。
 * @security isBooleanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isBooleanは共有非同期状態を持たない同期処理である。
 */
function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * Family Preferenceを選択する。
 *
 * @responsibility Family Preferenceの候補集合、選択理由、選択不能時の境界を所有する。
 * @trace ARCH-000010
 * @input provider: Provider
 * @returns selectFamilyPreferenceの計算結果を返す。
 * @precondition 「provider: Provider」がselectFamilyPreferenceの入力契約を満たす。
 * @postcondition selectFamilyPreferenceの責務を完了した結果だけを返す。
 * @effect N/A: selectFamilyPreferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectFamilyPreferenceは独自の失敗分岐を所有しない。
 * @invariant selectFamilyPreferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectFamilyPreferenceはProcess内の同一Subsystemで完結する。
 * @security selectFamilyPreferenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: selectFamilyPreferenceは共有非同期状態を持たない同期処理である。
 */
function selectFamilyPreference(provider: Provider) {
  return provider === "codex" ? "sol" : "opus";
}

/**
 * Rationale Codesを選択する。
 *
 * @responsibility Rationale Codesの候補集合、選択理由、選択不能時の境界を所有する。
 * @trace ARCH-000010
 * @input value: Readonly<Record<string, unknown>>
 * @returns selectRationaleCodesの計算結果を返す。
 * @precondition 「value: Readonly<Record<string, unknown>>」がselectRationaleCodesの入力契約を満たす。
 * @postcondition selectRationaleCodesの責務を完了した結果だけを返す。
 * @effect N/A: selectRationaleCodesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectRationaleCodesは独自の失敗分岐を所有しない。
 * @invariant selectRationaleCodesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectRationaleCodesはProcess内の同一Subsystemで完結する。
 * @security selectRationaleCodesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: selectRationaleCodesは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Effortを選択する。
 *
 * @responsibility Effortの候補集合、選択理由、選択不能時の境界を所有する。
 * @trace ARCH-000010
 * @input rationaleCodes: readonly string[]
 * @returns Effortを返す。
 * @precondition 「rationaleCodes: readonly string[]」がselectEffortの入力契約を満たす。
 * @postcondition selectEffortの責務を完了した結果だけを返す。
 * @effect N/A: selectEffortは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectEffortは独自の失敗分岐を所有しない。
 * @invariant selectEffortは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectEffortはProcess内の同一Subsystemで完結する。
 * @security selectEffortはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: selectEffortは共有非同期状態を持たない同期処理である。
 */
function selectEffort(rationaleCodes: readonly string[]): Effort {
  if (rationaleCodes.includes("complete_bounded_local_plan")) return "low";
  return "medium";
}

/**
 * Selection Noticeの公開契約を記述する。
 *
 * @responsibility Selection Noticeの公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000010
 * @input provider: Provider、role: string、family: string、effort: Effort、rationaleCodes: readonly string[]
 * @returns describeSelectionNoticeの計算結果を返す。
 * @precondition 「provider: Provider、role: string、family: string、effort: Effort、rationaleCodes: readonly string[]」がdescribeSelectionNoticeの入力契約を満たす。
 * @postcondition describeSelectionNoticeの責務を完了した結果だけを返す。
 * @effect N/A: describeSelectionNoticeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeSelectionNoticeは独自の失敗分岐を所有しない。
 * @invariant describeSelectionNoticeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeSelectionNoticeはProcess内の同一Subsystemで完結する。
 * @security describeSelectionNoticeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeSelectionNoticeは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Provider Model 候補を選択する。
 *
 * @responsibility Provider Model 候補の候補集合、選択理由、選択不能時の境界を所有する。
 * @trace ARCH-000010
 * @input candidate: unknown
 * @returns selectProviderModelCandidateの計算結果を返す。
 * @precondition 「candidate: unknown」がselectProviderModelCandidateの入力契約を満たす。
 * @postcondition selectProviderModelCandidateの責務を完了した結果だけを返す。
 * @effect N/A: selectProviderModelCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectProviderModelCandidateは独自の失敗分岐を所有しない。
 * @invariant selectProviderModelCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectProviderModelCandidateはProcess内の同一Subsystemで完結する。
 * @security selectProviderModelCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: selectProviderModelCandidateは共有非同期状態を持たない同期処理である。
 */
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
  const isHighCostSelection = false;
  return Object.freeze({
    status: "candidate" as const,
    reason: "verified_runtime_profile_and_selection_grant_required",
    provider,
    role,
    familyPreference: family,
    effort,
    modelTier: isHighCostSelection ? "upper_allowed" : "preferred",
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
    highCostSelection: isHighCostSelection,
  });
}

/**
 * Provider Model Selection Runtime 契約の公開契約を記述する。
 *
 * @responsibility Provider Model Selection Runtime 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderModelSelectionRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderModelSelectionRuntimeContractの入力契約を満たす。
 * @postcondition describeProviderModelSelectionRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderModelSelectionRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderModelSelectionRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderModelSelectionRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderModelSelectionRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderModelSelectionRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderModelSelectionRuntimeContractは共有非同期状態を持たない同期処理である。
 */
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
