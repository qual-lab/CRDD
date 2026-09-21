import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import { selectProviderModelCandidate } from "./provider-model-selection-runtime.ts";

export const DELEGATION_ROUTE_SELECTION_CONTRACT =
  "crdd-coordinator/delegation-route-selection";
export const DELEGATION_ROUTE_SELECTION_CONTRACT_REVISION = 3;

const MAXIMUM_DELEGATION_DEPTH = 2;
const MAXIMUM_ANCESTOR_OPERATIONS = 2;
const OPERATION_ID = /^OP-[0-9]{6,}$/u;
const REQUEST_KEYS = new Set([
  "frontProvider",
  "delegationNeed",
  "delegationReason",
  "requestedExecutorProvider",
  "subjectProvider",
  "requiresIndependentProvider",
  "role",
  "workClass",
  "planState",
  "risk",
  "difficulty",
  "decisionImpact",
  "isLocalCandidateOnly",
  "hasUnresolvedDirection",
  "requiresCrossContextAlignment",
  "operationId",
  "parentOperationId",
  "ancestorOperationIds",
  "delegationDepth",
]);
const OBSERVATION_KEYS = new Set(["providerEligibility"]);
const ELIGIBILITY_KEYS = new Set(["provider", "status", "reason"]);
const PROVIDERS = new Set(["codex", "claude"]);
const INELIGIBILITY_REASONS = new Set([
  "required_capability_unavailable",
  "subscription_auth_unavailable",
  "subscription_quota_unavailable",
  "provider_distribution_unavailable",
  "policy_blocked",
  "observation_unavailable",
]);
const SAME_PROVIDER_FALLBACK_REASONS = new Set([
  "required_capability_unavailable",
  "subscription_auth_unavailable",
  "subscription_quota_unavailable",
  "provider_distribution_unavailable",
  "policy_blocked",
]);
const REQUESTED_PROVIDERS = new Set(["auto", "codex", "claude"]);
const DELEGATION_NEEDS = new Set(["none", "beneficial", "required"]);
const DELEGATION_REASONS = new Set([
  "front_can_complete_without_specialized_or_independent_child",
  "specialized_executor_benefit",
  "independent_review_required",
  "parallel_execution_benefit",
  "explicit_user_delegation",
]);
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

/**
 * Providerが扱う値の構造を表す。
 *
 * @responsibility Providerに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape Providerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Providerで宣言した値と責務の対応を維持する。
 * @boundary N/A: Providerの宣言は外部境界を開かない。
 * @security ProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Providerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Provider = "codex" | "claude";
/**
 * ProviderEligibilityが扱う値の構造を表す。
 *
 * @responsibility ProviderEligibilityに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape ProviderEligibilityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProviderEligibilityで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProviderEligibilityの宣言は外部境界を開かない。
 * @security ProviderEligibilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProviderEligibilityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ProviderEligibility = Readonly<{
  provider: Provider;
  status: "eligible" | "ineligible";
  reason:
    | "ready"
    | "runtime_preflight_required"
    | "bounded_request_check"
    | "required_capability_unavailable"
    | "subscription_auth_unavailable"
    | "subscription_quota_unavailable"
    | "provider_distribution_unavailable"
    | "policy_blocked"
    | "observation_unavailable";
}>;

/**
 * createBlockedResultの処理を実行する。
 *
 * @responsibility createBlockedResultに対応する入力処理と結果生成を所有する。
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
    frontProvider: null,
    executorProvider: null,
    route: null,
    selectionReasonCodes: Object.freeze([] as string[]),
    selectionNotice: null,
    modelSelection: null,
    modelSelectionBasis: null,
    delegationDepth: null,
    selectionCapabilityIssued: false,
    providerAuthorityIssued: false,
    providerEffectAllowed: false,
    directProviderSpawnAllowed: false,
  });
}

/**
 * createBlockedSlateの処理を実行する。
 *
 * @responsibility createBlockedSlateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input reason: string
 * @returns createBlockedSlateの計算結果を返す。
 * @precondition 「reason: string」がcreateBlockedSlateの入力契約を満たす。
 * @postcondition createBlockedSlateの責務を完了した結果だけを返す。
 * @effect N/A: createBlockedSlateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createBlockedSlateは独自の失敗分岐を所有しない。
 * @invariant createBlockedSlateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createBlockedSlateはProcess内の同一Subsystemで完結する。
 * @security createBlockedSlateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createBlockedSlateは共有非同期状態を持たない同期処理である。
 */
function createBlockedSlate(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    executorProvider: null,
    reviewerProvider: null,
    reviewerIndependence: null,
    executorRoute: null,
    reviewerRoute: null,
    executorSelectionReasonCodes: Object.freeze([] as string[]),
    reviewerSelectionReasonCodes: Object.freeze([] as string[]),
    providerEffectAllowed: false,
  });
}

/**
 * isProviderの処理を実行する。
 *
 * @responsibility isProviderに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input value: unknown
 * @returns value is Providerを返す。
 * @precondition 「value: unknown」がisProviderの入力契約を満たす。
 * @postcondition isProviderの責務を完了した結果だけを返す。
 * @effect N/A: isProviderは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isProviderは独自の失敗分岐を所有しない。
 * @invariant isProviderは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isProviderはProcess内の同一Subsystemで完結する。
 * @security isProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isProviderは共有非同期状態を持たない同期処理である。
 */
function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && PROVIDERS.has(value);
}

/**
 * isBooleanの処理を実行する。
 *
 * @responsibility isBooleanに対応する入力処理と結果生成を所有する。
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
 * isDelegationDispositionValidの処理を実行する。
 *
 * @responsibility isDelegationDispositionValidに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input need: unknown、reason: unknown、role: unknown
 * @returns isDelegationDispositionValidの計算結果を返す。
 * @precondition 「need: unknown、reason: unknown、role: unknown」がisDelegationDispositionValidの入力契約を満たす。
 * @postcondition isDelegationDispositionValidの責務を完了した結果だけを返す。
 * @effect N/A: isDelegationDispositionValidは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isDelegationDispositionValidは独自の失敗分岐を所有しない。
 * @invariant isDelegationDispositionValidは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isDelegationDispositionValidはProcess内の同一Subsystemで完結する。
 * @security isDelegationDispositionValidはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isDelegationDispositionValidは共有非同期状態を持たない同期処理である。
 */
function isDelegationDispositionValid(
  need: unknown,
  reason: unknown,
  role: unknown,
) {
  if (
    typeof need !== "string" ||
    !DELEGATION_NEEDS.has(need) ||
    typeof reason !== "string" ||
    !DELEGATION_REASONS.has(reason)
  ) {
    return false;
  }
  if (need === "none") {
    return (
      reason ===
        "front_can_complete_without_specialized_or_independent_child" &&
      role !== "independent_reviewer"
    );
  }
  return (
    reason !== "front_can_complete_without_specialized_or_independent_child"
  );
}

/**
 * selectPreferredProviderの処理を実行する。
 *
 * @responsibility selectPreferredProviderに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input frontProvider: Provider、role: unknown、workClass: unknown、subjectProvider: Provider | null、shouldUseIndependentProvider: boolean
 * @returns Readonly<{ provider: Provider; reason: string }>を返す。
 * @precondition 「frontProvider: Provider、role: unknown、workClass: unknown、subjectProvider: Provider | null、shouldUseIndependentProvider: boolean」がselectPreferredProviderの入力契約を満たす。
 * @postcondition selectPreferredProviderの責務を完了した結果だけを返す。
 * @effect N/A: selectPreferredProviderは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectPreferredProviderは独自の失敗分岐を所有しない。
 * @invariant selectPreferredProviderは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectPreferredProviderはProcess内の同一Subsystemで完結する。
 * @security selectPreferredProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: selectPreferredProviderは共有非同期状態を持たない同期処理である。
 */
function selectPreferredProvider(
  frontProvider: Provider,
  role: unknown,
  workClass: unknown,
  subjectProvider: Provider | null,
  shouldUseIndependentProvider: boolean,
): Readonly<{ provider: Provider; reason: string }> {
  if (shouldUseIndependentProvider && subjectProvider) {
    return Object.freeze({
      provider: subjectProvider === "codex" ? "claude" : "codex",
      reason: "independent_provider_required",
    });
  }
  if (
    role === "independent_reviewer" &&
    !shouldUseIndependentProvider &&
    subjectProvider
  ) {
    return Object.freeze({
      provider: subjectProvider,
      reason: "independent_execution_context_same_provider_required",
    });
  }
  if (
    role === "coordinator" ||
    role === "result_integration" ||
    workClass === "bounded_verification" ||
    workClass === "diagnosis" ||
    workClass === "design_alignment" ||
    workClass === "architecture_review" ||
    workClass === "security_review" ||
    workClass === "gap_impact_audit"
  ) {
    return Object.freeze({
      provider: "codex",
      reason: "task_characteristic_codex_preference",
    });
  }
  return Object.freeze({
    provider: frontProvider === "codex" ? "claude" : "codex",
    reason: "cross_provider_credit_distribution_preference",
  });
}

/**
 * snapshotProviderEligibilityの処理を実行する。
 *
 * @responsibility snapshotProviderEligibilityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input raw: unknown
 * @returns snapshotProviderEligibilityの計算結果を返す。
 * @precondition 「raw: unknown」がsnapshotProviderEligibilityの入力契約を満たす。
 * @postcondition snapshotProviderEligibilityの責務を完了した結果だけを返す。
 * @effect N/A: snapshotProviderEligibilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: snapshotProviderEligibilityは独自の失敗分岐を所有しない。
 * @invariant snapshotProviderEligibilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotProviderEligibilityはProcess内の同一Subsystemで完結する。
 * @security snapshotProviderEligibilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotProviderEligibilityは共有非同期状態を持たない同期処理である。
 */
function snapshotProviderEligibility(raw: unknown) {
  const values = snapshotPlainArray<unknown>(raw, PROVIDERS.size);
  if (values.status !== "ok" || values.value.length !== PROVIDERS.size) {
    return null;
  }
  const entries: ProviderEligibility[] = [];
  for (const value of values.value) {
    const entry = snapshotPlainRecord(value, ELIGIBILITY_KEYS);
    if (
      !entry ||
      !isProvider(entry.provider) ||
      (entry.status !== "eligible" && entry.status !== "ineligible") ||
      typeof entry.reason !== "string" ||
      (entry.status === "eligible" &&
        entry.reason !== "ready" &&
        entry.reason !== "runtime_preflight_required" &&
        entry.reason !== "bounded_request_check") ||
      (entry.status === "ineligible" &&
        !INELIGIBILITY_REASONS.has(entry.reason))
    ) {
      return null;
    }
    entries.push(entry as ProviderEligibility);
  }
  if (new Set(entries.map((entry) => entry.provider)).size !== PROVIDERS.size) {
    return null;
  }
  return new Map(entries.map((entry) => [entry.provider, entry]));
}

/**
 * selectExecutorProviderの処理を実行する。
 *
 * @responsibility selectExecutorProviderに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input requestedProvider: "auto" | Provider、preferredProvider: Provider、preferredReason: string、frontProvider: Provider、providerEligibility: ReadonlyMap<Provider, ProviderEligibility>、subjectProvider: Provider | null、shouldUseIndependentProvider: boolean
 * @returns selectExecutorProviderの計算結果を返す。
 * @precondition 「requestedProvider: "auto" | Provider、preferredProvider: Provider、preferredReason: string、frontProvider: Provider、providerEligibility: ReadonlyMap<Provider, ProviderEligibility>、subjectProvider: Provider | null、shouldUseIndependentProvider: boolean」がselectExecutorProviderの入力契約を満たす。
 * @postcondition selectExecutorProviderの責務を完了した結果だけを返す。
 * @effect N/A: selectExecutorProviderは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectExecutorProviderは独自の失敗分岐を所有しない。
 * @invariant selectExecutorProviderは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectExecutorProviderはProcess内の同一Subsystemで完結する。
 * @security selectExecutorProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: selectExecutorProviderは共有非同期状態を持たない同期処理である。
 */
function selectExecutorProvider(
  requestedProvider: "auto" | Provider,
  preferredProvider: Provider,
  preferredReason: string,
  frontProvider: Provider,
  providerEligibility: ReadonlyMap<Provider, ProviderEligibility>,
  subjectProvider: Provider | null,
  shouldUseIndependentProvider: boolean,
) {
  const candidates = (["codex", "claude"] as const).filter(
    (provider) =>
      providerEligibility.get(provider)?.status === "eligible" &&
      (!shouldUseIndependentProvider || provider !== subjectProvider),
  );
  if (requestedProvider !== "auto") {
    return candidates.includes(requestedProvider)
      ? Object.freeze({
          provider: requestedProvider,
          reason:
            preferredReason ===
            "independent_execution_context_same_provider_required"
              ? preferredReason
              : "user_executor_constraint_satisfied",
        })
      : null;
  }
  if (candidates.includes(preferredProvider)) {
    return Object.freeze({
      provider: preferredProvider,
      reason: preferredReason,
    });
  }
  const preferredEligibility = providerEligibility.get(preferredProvider);
  if (
    preferredProvider !== frontProvider &&
    (preferredEligibility?.status !== "ineligible" ||
      !SAME_PROVIDER_FALLBACK_REASONS.has(preferredEligibility.reason))
  ) {
    return null;
  }
  const alternateProvider = candidates[0];
  return alternateProvider
    ? Object.freeze({
        provider: alternateProvider,
        reason:
          preferredProvider === frontProvider
            ? `task_preferred_provider_${preferredEligibility?.reason}_before_selection`
            : `cross_provider_${preferredEligibility?.reason}_before_selection`,
      })
    : null;
}

/**
 * validateOperationChainの処理を実行する。
 *
 * @responsibility validateOperationChainに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input operationId: unknown、parentOperationId: unknown、rawAncestorOperationIds: unknown、delegationDepth: unknown
 * @returns validateOperationChainの計算結果を返す。
 * @precondition 「operationId: unknown、parentOperationId: unknown、rawAncestorOperationIds: unknown、delegationDepth: unknown」がvalidateOperationChainの入力契約を満たす。
 * @postcondition validateOperationChainの責務を完了した結果だけを返す。
 * @effect N/A: validateOperationChainは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateOperationChainは独自の失敗分岐を所有しない。
 * @invariant validateOperationChainは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateOperationChainはProcess内の同一Subsystemで完結する。
 * @security validateOperationChainはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateOperationChainは共有非同期状態を持たない同期処理である。
 */
function validateOperationChain(
  operationId: unknown,
  parentOperationId: unknown,
  rawAncestorOperationIds: unknown,
  delegationDepth: unknown,
) {
  if (
    typeof operationId !== "string" ||
    !OPERATION_ID.test(operationId) ||
    !Number.isSafeInteger(delegationDepth) ||
    typeof delegationDepth !== "number" ||
    delegationDepth < 0 ||
    delegationDepth >= MAXIMUM_DELEGATION_DEPTH
  ) {
    return null;
  }
  const ancestors = snapshotPlainArray<unknown>(
    rawAncestorOperationIds,
    MAXIMUM_ANCESTOR_OPERATIONS,
  );
  if (
    ancestors.status !== "ok" ||
    !ancestors.value.every(
      (ancestor): ancestor is string =>
        typeof ancestor === "string" && OPERATION_ID.test(ancestor),
    ) ||
    new Set(ancestors.value).size !== ancestors.value.length ||
    ancestors.value.includes(operationId) ||
    ancestors.value.length !== delegationDepth
  ) {
    return null;
  }
  if (
    (delegationDepth === 0 && parentOperationId !== null) ||
    (delegationDepth > 0 &&
      (typeof parentOperationId !== "string" ||
        parentOperationId !== ancestors.value.at(-1)))
  ) {
    return null;
  }
  return Object.freeze({
    operationId,
    parentOperationId: parentOperationId as string | null,
    ancestorOperationIds: ancestors.value,
    delegationDepth,
  });
}

/**
 * describeSelectionNoticeの処理を実行する。
 *
 * @responsibility describeSelectionNoticeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input frontProvider: Provider、executorProvider: Provider、route: string、reasonCodes: readonly string[]、modelNotice: string
 * @returns describeSelectionNoticeの計算結果を返す。
 * @precondition 「frontProvider: Provider、executorProvider: Provider、route: string、reasonCodes: readonly string[]、modelNotice: string」がdescribeSelectionNoticeの入力契約を満たす。
 * @postcondition describeSelectionNoticeの責務を完了した結果だけを返す。
 * @effect N/A: describeSelectionNoticeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeSelectionNoticeは独自の失敗分岐を所有しない。
 * @invariant describeSelectionNoticeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeSelectionNoticeはProcess内の同一Subsystemで完結する。
 * @security describeSelectionNoticeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeSelectionNoticeは共有非同期状態を持たない同期処理である。
 */
function describeSelectionNotice(
  frontProvider: Provider,
  executorProvider: Provider,
  route: string,
  reasonCodes: readonly string[],
  modelNotice: string,
) {
  return [
    `[委譲経路選定] front=${frontProvider} executor=${executorProvider} route=${route}`,
    `経路選定理由=${reasonCodes.join(",")}`,
    modelNotice,
    "再選定条件=availability_change,scope_change,authority_change,policy_conflict",
  ].join("\n");
}

/**
 * selectDelegationRouteCandidateの処理を実行する。
 *
 * @responsibility selectDelegationRouteCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input rawRequest: unknown、rawRuntimeObservation: unknown
 * @returns selectDelegationRouteCandidateの計算結果を返す。
 * @precondition 「rawRequest: unknown、rawRuntimeObservation: unknown」がselectDelegationRouteCandidateの入力契約を満たす。
 * @postcondition selectDelegationRouteCandidateの責務を完了した結果だけを返す。
 * @effect N/A: selectDelegationRouteCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectDelegationRouteCandidateは独自の失敗分岐を所有しない。
 * @invariant selectDelegationRouteCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectDelegationRouteCandidateはProcess内の同一Subsystemで完結する。
 * @security selectDelegationRouteCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: selectDelegationRouteCandidateは共有非同期状態を持たない同期処理である。
 */
export function selectDelegationRouteCandidate(
  rawRequest: unknown,
  rawRuntimeObservation: unknown,
) {
  const request = snapshotPlainRecord(rawRequest, REQUEST_KEYS);
  const observation = snapshotPlainRecord(
    rawRuntimeObservation,
    OBSERVATION_KEYS,
  );
  if (!request || !observation) {
    return createBlockedResult("delegation_route_shape_invalid");
  }
  if (
    !isProvider(request.frontProvider) ||
    !isDelegationDispositionValid(
      request.delegationNeed,
      request.delegationReason,
      request.role,
    ) ||
    typeof request.requestedExecutorProvider !== "string" ||
    !REQUESTED_PROVIDERS.has(request.requestedExecutorProvider) ||
    (request.subjectProvider !== null &&
      !isProvider(request.subjectProvider)) ||
    !isBoolean(request.requiresIndependentProvider) ||
    !ROLES.has(request.role as string) ||
    !WORK_CLASSES.has(request.workClass as string) ||
    !PLAN_STATES.has(request.planState as string) ||
    !RISKS.has(request.risk as string) ||
    !DIFFICULTIES.has(request.difficulty as string) ||
    !DECISION_IMPACTS.has(request.decisionImpact as string) ||
    !isBoolean(request.isLocalCandidateOnly) ||
    !isBoolean(request.hasUnresolvedDirection) ||
    !isBoolean(request.requiresCrossContextAlignment)
  ) {
    return createBlockedResult("delegation_route_request_invalid");
  }
  if (
    request.delegationNeed === "none" &&
    (request.requestedExecutorProvider !== "auto" ||
      request.subjectProvider !== null ||
      request.requiresIndependentProvider !== false)
  ) {
    return createBlockedResult("delegation_route_request_invalid");
  }
  if (
    (request.requiresIndependentProvider === true &&
      request.subjectProvider === null) ||
    (request.role === "independent_reviewer" &&
      (request.subjectProvider === null ||
        (request.requiresIndependentProvider === false &&
          request.requestedExecutorProvider !== request.subjectProvider)))
  ) {
    return createBlockedResult("delegation_route_independence_invalid");
  }
  const operationChain = validateOperationChain(
    request.operationId,
    request.parentOperationId,
    request.ancestorOperationIds,
    request.delegationDepth,
  );
  if (!operationChain) {
    return createBlockedResult("delegation_route_operation_chain_invalid");
  }
  const frontProvider = request.frontProvider as Provider;
  if (request.delegationNeed === "none") {
    const route = `front_${frontProvider}_only`;
    const selectionReasonCodes = Object.freeze([
      request.delegationReason as string,
      "selection_grant_not_required",
    ]);
    return Object.freeze({
      ...createBlockedResult("front_agent_retained"),
      status: "retained" as const,
      reason: "front_agent_retained",
      frontProvider,
      route,
      selectionReasonCodes,
      selectionNotice: [
        `[委譲判断] front=${frontProvider} route=${route}`,
        `移譲しない理由=${request.delegationReason}`,
        "子Agent費用=no",
      ].join("\n"),
      operationId: operationChain.operationId,
      parentOperationId: operationChain.parentOperationId,
      ancestorOperationIds: operationChain.ancestorOperationIds,
      delegationDepth: operationChain.delegationDepth,
    });
  }
  const providerEligibility = snapshotProviderEligibility(
    observation.providerEligibility,
  );
  if (!providerEligibility) {
    return createBlockedResult("delegation_route_provider_eligibility_invalid");
  }
  const subjectProvider = request.subjectProvider as Provider | null;
  const preferred = selectPreferredProvider(
    frontProvider,
    request.role,
    request.workClass,
    subjectProvider,
    request.requiresIndependentProvider,
  );
  const selected = selectExecutorProvider(
    request.requestedExecutorProvider as "auto" | Provider,
    preferred.provider,
    preferred.reason,
    frontProvider,
    providerEligibility,
    subjectProvider,
    request.requiresIndependentProvider,
  );
  if (!selected) {
    return createBlockedResult("delegation_route_executor_unavailable");
  }
  const executorProvider = selected.provider;
  const modelSelectionBasis = Object.freeze({
    provider: executorProvider,
    role: request.role,
    workClass: request.workClass,
    planState: request.planState,
    risk: request.risk,
    difficulty: request.difficulty,
    decisionImpact: request.decisionImpact,
    isLocalCandidateOnly: request.isLocalCandidateOnly,
    hasUnresolvedDirection: request.hasUnresolvedDirection,
    requiresCrossContextAlignment: request.requiresCrossContextAlignment,
  });
  const modelSelection = selectProviderModelCandidate(modelSelectionBasis);
  if (
    modelSelection.status !== "candidate" ||
    !modelSelection.selectionNotice
  ) {
    return createBlockedResult("delegation_route_model_selection_invalid");
  }
  const route = `front_${frontProvider}__executor_${executorProvider}`;
  const selectionReasonCodes = Object.freeze([
    selected.reason,
    request.requiresIndependentProvider
      ? "independent_provider_required"
      : request.role === "independent_reviewer"
        ? "independent_execution_context_required"
        : executorProvider !== frontProvider
          ? "cross_provider_route_selected"
          : request.requestedExecutorProvider !== "auto"
            ? "same_provider_user_constraint"
            : selected.reason === "task_characteristic_codex_preference"
              ? "same_provider_due_task_characteristic"
              : "same_provider_due_cross_provider_ineligibility",
    `work_class_${request.workClass}`,
  ]);
  return Object.freeze({
    status: "candidate" as const,
    reason: "runtime_owned_selection_grant_required",
    frontProvider: request.frontProvider,
    executorProvider,
    route,
    selectionReasonCodes,
    selectionNotice: describeSelectionNotice(
      frontProvider,
      executorProvider,
      route,
      selectionReasonCodes,
      modelSelection.selectionNotice,
    ),
    modelSelection,
    modelSelectionBasis,
    operationId: operationChain.operationId,
    parentOperationId: operationChain.parentOperationId,
    ancestorOperationIds: operationChain.ancestorOperationIds,
    delegationDepth: operationChain.delegationDepth + 1,
    selectionCapabilityIssued: false,
    providerAuthorityIssued: false,
    providerEffectAllowed: false,
    directProviderSpawnAllowed: false,
  });
}

/**
 * sameProviderReviewerAllowedの処理を実行する。
 *
 * @responsibility sameProviderReviewerAllowedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input request: Readonly<Record<string, unknown>>
 * @returns sameProviderReviewerAllowedの計算結果を返す。
 * @precondition 「request: Readonly<Record<string, unknown>>」がsameProviderReviewerAllowedの入力契約を満たす。
 * @postcondition sameProviderReviewerAllowedの責務を完了した結果だけを返す。
 * @effect N/A: sameProviderReviewerAllowedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameProviderReviewerAllowedは独自の失敗分岐を所有しない。
 * @invariant sameProviderReviewerAllowedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameProviderReviewerAllowedはProcess内の同一Subsystemで完結する。
 * @security sameProviderReviewerAllowedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameProviderReviewerAllowedは共有非同期状態を持たない同期処理である。
 */
function sameProviderReviewerAllowed(
  request: Readonly<Record<string, unknown>>,
) {
  return (
    request.role === "executor" &&
    (request.workClass === "bounded_implementation" ||
      request.workClass === "bounded_verification") &&
    request.planState === "complete" &&
    request.risk === "low" &&
    request.decisionImpact === "limited" &&
    request.isLocalCandidateOnly === true &&
    request.hasUnresolvedDirection === false &&
    request.requiresCrossContextAlignment === false
  );
}

/**
 * selectDelegationExecutionSlateCandidateの処理を実行する。
 *
 * @responsibility selectDelegationExecutionSlateCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input rawExecutorRequest: unknown、rawRuntimeObservation: unknown
 * @returns selectDelegationExecutionSlateCandidateの計算結果を返す。
 * @precondition 「rawExecutorRequest: unknown、rawRuntimeObservation: unknown」がselectDelegationExecutionSlateCandidateの入力契約を満たす。
 * @postcondition selectDelegationExecutionSlateCandidateの責務を完了した結果だけを返す。
 * @effect N/A: selectDelegationExecutionSlateCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectDelegationExecutionSlateCandidateは独自の失敗分岐を所有しない。
 * @invariant selectDelegationExecutionSlateCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectDelegationExecutionSlateCandidateはProcess内の同一Subsystemで完結する。
 * @security selectDelegationExecutionSlateCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: selectDelegationExecutionSlateCandidateは共有非同期状態を持たない同期処理である。
 */
export function selectDelegationExecutionSlateCandidate(
  rawExecutorRequest: unknown,
  rawRuntimeObservation: unknown,
) {
  const request = snapshotPlainRecord(rawExecutorRequest, REQUEST_KEYS);
  const observation = snapshotPlainRecord(
    rawRuntimeObservation,
    OBSERVATION_KEYS,
  );
  if (!request || !observation) {
    return createBlockedSlate("delegation_slate_shape_invalid");
  }
  const eligibility = snapshotProviderEligibility(
    observation.providerEligibility,
  );
  if (!eligibility) {
    return createBlockedSlate("delegation_slate_provider_eligibility_invalid");
  }
  const stableObservation = Object.freeze({
    providerEligibility: Object.freeze(
      [...eligibility.values()].map((entry) => Object.freeze({ ...entry })),
    ),
  });
  const executor = selectDelegationRouteCandidate(request, stableObservation);
  if (executor.status !== "candidate") {
    return createBlockedSlate("delegation_slate_executor_unavailable");
  }
  const reviewerBase = Object.freeze({
    ...request,
    delegationNeed: "required",
    delegationReason: "independent_review_required",
    requestedExecutorProvider: "auto",
    subjectProvider: executor.executorProvider,
    requiresIndependentProvider: true,
    role: "independent_reviewer",
    workClass: "bounded_verification",
    planState: "complete",
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  });
  let reviewer = selectDelegationRouteCandidate(
    reviewerBase,
    stableObservation,
  );
  let reviewerIndependence:
    | "provider_independent"
    | "execution_context_independent" = "provider_independent";
  if (
    reviewer.status !== "candidate" &&
    reviewer.reason === "delegation_route_executor_unavailable" &&
    sameProviderReviewerAllowed(request)
  ) {
    reviewer = selectDelegationRouteCandidate(
      Object.freeze({
        ...reviewerBase,
        requestedExecutorProvider: executor.executorProvider,
        requiresIndependentProvider: false,
      }),
      stableObservation,
    );
    reviewerIndependence = "execution_context_independent";
  }
  if (reviewer.status !== "candidate") {
    return createBlockedSlate("delegation_slate_reviewer_unavailable");
  }
  return Object.freeze({
    status: "candidate" as const,
    reason: "delegation_execution_slate_candidate",
    executorProvider: executor.executorProvider,
    reviewerProvider: reviewer.executorProvider,
    reviewerIndependence,
    executorRoute: executor.route,
    reviewerRoute: reviewer.route,
    executorSelectionReasonCodes: executor.selectionReasonCodes,
    reviewerSelectionReasonCodes: reviewer.selectionReasonCodes,
    providerEffectAllowed: false,
  });
}

/**
 * describeDelegationRouteSelectionContractの処理を実行する。
 *
 * @responsibility describeDelegationRouteSelectionContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeDelegationRouteSelectionContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeDelegationRouteSelectionContractの入力契約を満たす。
 * @postcondition describeDelegationRouteSelectionContractの責務を完了した結果だけを返す。
 * @effect N/A: describeDelegationRouteSelectionContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeDelegationRouteSelectionContractは独自の失敗分岐を所有しない。
 * @invariant describeDelegationRouteSelectionContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeDelegationRouteSelectionContractはProcess内の同一Subsystemで完結する。
 * @security describeDelegationRouteSelectionContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeDelegationRouteSelectionContractは共有非同期状態を持たない同期処理である。
 */
export function describeDelegationRouteSelectionContract() {
  return Object.freeze({
    contract: DELEGATION_ROUTE_SELECTION_CONTRACT,
    contractRevision: DELEGATION_ROUTE_SELECTION_CONTRACT_REVISION,
    supportedRoutes: Object.freeze([
      "front_codex__executor_codex",
      "front_codex__executor_claude",
      "front_claude__executor_codex",
      "front_claude__executor_claude",
    ]),
    frontAndExecutorIndependentAxes: true,
    automaticSelection: "before_provider_effect_from_closed_runtime_facts",
    explicitUserExecutorConstraint:
      "restricts_candidates_never_silently_ignored",
    defaultRoutePreference:
      "cross_provider_to_distribute_front_subscription_capacity",
    taskRoleAffectsExecutorProvider:
      "only_explainable_provider_specific_characteristics",
    taskRoleAffectsModelAndEffort: true,
    frontOnlyDisposition:
      "implemented_as_retained_result_without_selection_grant_or_provider_effect",
    independentReview: Object.freeze({
      providerIndependent: "subject_provider_excluded",
      executionContextIndependent:
        "same_provider_only_when_explicitly_requested_by_preflighted_slate_policy",
    }),
    sameProviderRoute:
      "only_explainable_provider_specific_characteristic_explicit_user_constraint_or_runtime_observed_cross_provider_ineligibility",
    providerEligibilityReasons: Object.freeze([
      "required_capability_unavailable",
      "subscription_auth_unavailable",
      "subscription_quota_unavailable",
      "provider_distribution_unavailable",
      "policy_blocked",
    ]),
    unknownCrossProviderEligibilityAllowsSameProvider: false,
    maximumDelegationDepth: MAXIMUM_DELEGATION_DEPTH,
    cyclicOperationChainAllowed: false,
    directProviderSpawnAllowed: false,
    availabilityChangeAfterSelection:
      "return_to_coordinator_for_superseding_selection_grant",
    callerAvailabilityClaimTrusted: false,
    selectionCapabilityIssued: false,
    providerAuthorityIssued: false,
    providerEffectAllowed: false,
    executionSlate: Object.freeze({
      selectedBeforeProviderEffect: true,
      providerIndependentReviewerPreferred: true,
      sameProviderReviewerPolicy:
        "only_low_risk_local_bounded_work_with_separate_execution_context_when_other_provider_unavailable",
      highRiskSameProviderReviewerAllowed: false,
    }),
  });
}
