import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  DELEGATION_ROUTE_SELECTION_CONTRACT,
  selectDelegationExecutionSlateCandidate,
  selectDelegationRouteCandidate,
} from "./delegation-route-selection.ts";
import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import { observeRuntimeOwnedProviderEligibility } from "./provider-eligibility-runtime.ts";
import { resolveRuntimeOwnedProviderModelProfile } from "./provider-model-profile-runtime.ts";
import { verifyRuntimeOwnedRepositoryOperation } from "./repository-operation-runtime.ts";

export const DELEGATION_SELECTION_GRANT_RUNTIME_CONTRACT =
  "crdd-coordinator/delegation-selection-grant-runtime";
export const DELEGATION_SELECTION_GRANT_RUNTIME_CONTRACT_REVISION = 4;

const SELECTION_LIFETIME_MS = 30_000;
const PROFILE_ID = /^PROFILE-[0-9]{6,}$/u;
const EXACT_MODEL_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;

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
 * SelectionRoleが扱う値の構造を表す。
 *
 * @responsibility SelectionRoleに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape SelectionRoleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SelectionRoleで宣言した値と責務の対応を維持する。
 * @boundary N/A: SelectionRoleの宣言は外部境界を開かない。
 * @security SelectionRoleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SelectionRoleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SelectionRole =
  | "coordinator"
  | "executor"
  | "independent_reviewer"
  | "result_integration";
/**
 * CandidateRouteが扱う値の構造を表す。
 *
 * @responsibility CandidateRouteに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape CandidateRouteが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CandidateRouteで宣言した値と責務の対応を維持する。
 * @boundary N/A: CandidateRouteの宣言は外部境界を開かない。
 * @security CandidateRouteはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CandidateRouteの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CandidateRoute = Extract<
  ReturnType<typeof selectDelegationRouteCandidate>,
  { status: "candidate" }
>;
/**
 * ResolvedModelProfileが扱う値の構造を表す。
 *
 * @responsibility ResolvedModelProfileに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape ResolvedModelProfileが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ResolvedModelProfileで宣言した値と責務の対応を維持する。
 * @boundary N/A: ResolvedModelProfileの宣言は外部境界を開かない。
 * @security ResolvedModelProfileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ResolvedModelProfileの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ResolvedModelProfile = Readonly<{
  provider: Provider;
  profileId: string;
  exactModelId: string;
  family: string;
  selectionRole: string;
  modelTier: string;
  speedMode: "normal";
  billingMode: "subscription_oauth";
  compatibilityReason: string | null;
}>;
/**
 * ModelProfileRequestが扱う値の構造を表す。
 *
 * @responsibility ModelProfileRequestに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape ModelProfileRequestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ModelProfileRequestで宣言した値と責務の対応を維持する。
 * @boundary N/A: ModelProfileRequestの宣言は外部境界を開かない。
 * @security ModelProfileRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ModelProfileRequestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ModelProfileRequest = Readonly<{
  provider: Provider;
  family: string;
  role: string;
  modelTier: string;
  speedMode: "normal";
  billingMode: "subscription_oauth";
}>;
/**
 * SelectionRecordが扱う値の構造を表す。
 *
 * @responsibility SelectionRecordに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape SelectionRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SelectionRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: SelectionRecordの宣言は外部境界を開かない。
 * @security SelectionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SelectionRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SelectionRecord = {
  selectionRecordId: string;
  operationId: string;
  managementCapability: object;
  route: CandidateRoute;
  profile: ResolvedModelProfile;
  selectionNotice: string;
  issuedWallClockMs: number;
  issuedMonotonicMs: number;
  controlCapability: object;
  useCapability: object;
};
/**
 * RuntimeStateが扱う値の構造を表す。
 *
 * @responsibility RuntimeStateに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape RuntimeStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeStateの宣言は外部境界を開かない。
 * @security RuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeState = Readonly<{
  records: Map<string, SelectionRecord>;
  controlCapabilities: WeakMap<object, string>;
  useCapabilities: WeakMap<object, string>;
  verifyOperation: (
    managementCapability: unknown,
  ) => Readonly<{ operationId: string; createdAt: string }>;
  observeProviderEligibility: () => unknown;
  resolveModelProfile: (
    request: ModelProfileRequest,
  ) => ResolvedModelProfile | null;
  wallNow: () => number;
  monotonicNow: () => number;
  randomBytes: (size: number) => Buffer;
}>;

/**
 * createRuntimeStateの処理を実行する。
 *
 * @responsibility createRuntimeStateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input dependencies: Omit< RuntimeState, "records" | "controlCapabilities" | "useCapabilities" >
 * @returns RuntimeStateを返す。
 * @precondition 「dependencies: Omit< RuntimeState, "records" | "controlCapabilities" | "useCapabilities" >」がcreateRuntimeStateの入力契約を満たす。
 * @postcondition createRuntimeStateの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createRuntimeStateは独自の失敗分岐を所有しない。
 * @invariant createRuntimeStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRuntimeStateはProcess内の同一Subsystemで完結する。
 * @security createRuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createRuntimeStateは共有非同期状態を持たない同期処理である。
 */
function createRuntimeState(
  dependencies: Omit<
    RuntimeState,
    "records" | "controlCapabilities" | "useCapabilities"
  >,
): RuntimeState {
  return Object.freeze({
    records: new Map(),
    controlCapabilities: new WeakMap(),
    useCapabilities: new WeakMap(),
    ...dependencies,
  });
}

const productionState = createRuntimeState({
  verifyOperation: (managementCapability) => {
    const operation =
      verifyOwnedOperationManagementCapability(managementCapability);
    const repository =
      verifyRuntimeOwnedRepositoryOperation(managementCapability);
    if (!repository || repository.operationId !== operation.operationId)
      throw new Error("repository_operation_binding_required");
    return operation;
  },
  observeProviderEligibility: observeRuntimeOwnedProviderEligibility,
  resolveModelProfile: resolveRuntimeOwnedProviderModelProfile,
  wallNow: Date.now,
  monotonicNow: performance.now.bind(performance),
  randomBytes,
});

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
    selectionRecordId: null,
    controlCapability: null,
    useCapability: null,
    operationId: null,
    frontProvider: null,
    executorProvider: null,
    route: null,
    profileId: null,
    selectedModel: null,
    selectedEffort: null,
    speedMode: null,
    selectionNotice: null,
    expiresInMs: null,
    selectionCapabilityIssued: false,
    providerAuthorityIssued: false,
    providerEffectAllowed: false,
  });
}

/**
 * isSelectionRoleの処理を実行する。
 *
 * @responsibility isSelectionRoleに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input value: unknown
 * @returns value is SelectionRoleを返す。
 * @precondition 「value: unknown」がisSelectionRoleの入力契約を満たす。
 * @postcondition isSelectionRoleの責務を完了した結果だけを返す。
 * @effect N/A: isSelectionRoleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSelectionRoleは独自の失敗分岐を所有しない。
 * @invariant isSelectionRoleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSelectionRoleはProcess内の同一Subsystemで完結する。
 * @security isSelectionRoleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isSelectionRoleは共有非同期状態を持たない同期処理である。
 */
function isSelectionRole(value: unknown): value is SelectionRole {
  return (
    value === "coordinator" ||
    value === "executor" ||
    value === "independent_reviewer" ||
    value === "result_integration"
  );
}

/**
 * performSafelyの処理を実行する。
 *
 * @responsibility performSafelyに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input reason: string、action: () => T
 * @returns performSafelyの計算結果を返す。
 * @precondition 「reason: string、action: () => T」がperformSafelyの入力契約を満たす。
 * @postcondition performSafelyの責務を完了した結果だけを返す。
 * @effect N/A: performSafelyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure performSafelyは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant performSafelyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: performSafelyはProcess内の同一Subsystemで完結する。
 * @security performSafelyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: performSafelyは共有非同期状態を持たない同期処理である。
 */
function performSafely<T>(reason: string, action: () => T) {
  try {
    return action();
  } catch {
    return createBlockedResult(reason);
  }
}

/**
 * createSelectionRecordIdの処理を実行する。
 *
 * @responsibility createSelectionRecordIdに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState
 * @returns createSelectionRecordIdの計算結果を返す。
 * @precondition 「state: RuntimeState」がcreateSelectionRecordIdの入力契約を満たす。
 * @postcondition createSelectionRecordIdの責務を完了した結果だけを返す。
 * @effect N/A: createSelectionRecordIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createSelectionRecordIdは独自の失敗分岐を所有しない。
 * @invariant createSelectionRecordIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createSelectionRecordIdはProcess内の同一Subsystemで完結する。
 * @security createSelectionRecordIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createSelectionRecordIdは共有非同期状態を持たない同期処理である。
 */
function createSelectionRecordId(state: RuntimeState) {
  const value = state.randomBytes(12);
  return Buffer.isBuffer(value) && value.byteLength === 12
    ? `MODELSEL-${value.toString("hex").toUpperCase()}`
    : null;
}

/**
 * isResolvedProfileValidの処理を実行する。
 *
 * @responsibility isResolvedProfileValidに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input profile: ResolvedModelProfile、route: CandidateRoute
 * @returns isResolvedProfileValidの計算結果を返す。
 * @precondition 「profile: ResolvedModelProfile、route: CandidateRoute」がisResolvedProfileValidの入力契約を満たす。
 * @postcondition isResolvedProfileValidの責務を完了した結果だけを返す。
 * @effect N/A: isResolvedProfileValidは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isResolvedProfileValidは独自の失敗分岐を所有しない。
 * @invariant isResolvedProfileValidは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isResolvedProfileValidはProcess内の同一Subsystemで完結する。
 * @security isResolvedProfileValidはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isResolvedProfileValidは共有非同期状態を持たない同期処理である。
 */
function isResolvedProfileValid(
  profile: ResolvedModelProfile,
  route: CandidateRoute,
) {
  return (
    profile.provider === route.executorProvider &&
    PROFILE_ID.test(profile.profileId) &&
    EXACT_MODEL_ID.test(profile.exactModelId) &&
    profile.family === route.modelSelection.familyPreference &&
    profile.selectionRole === route.modelSelectionBasis.role &&
    profile.modelTier === route.modelSelection.modelTier &&
    profile.speedMode === "normal" &&
    profile.billingMode === "subscription_oauth"
  );
}

/**
 * describeResolvedSelectionNoticeの処理を実行する。
 *
 * @responsibility describeResolvedSelectionNoticeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input route: CandidateRoute、profile: ResolvedModelProfile
 * @returns describeResolvedSelectionNoticeの計算結果を返す。
 * @precondition 「route: CandidateRoute、profile: ResolvedModelProfile」がdescribeResolvedSelectionNoticeの入力契約を満たす。
 * @postcondition describeResolvedSelectionNoticeの責務を完了した結果だけを返す。
 * @effect N/A: describeResolvedSelectionNoticeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeResolvedSelectionNoticeは独自の失敗分岐を所有しない。
 * @invariant describeResolvedSelectionNoticeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeResolvedSelectionNoticeはProcess内の同一Subsystemで完結する。
 * @security describeResolvedSelectionNoticeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeResolvedSelectionNoticeは共有非同期状態を持たない同期処理である。
 */
function describeResolvedSelectionNotice(
  route: CandidateRoute,
  profile: ResolvedModelProfile,
) {
  return [
    route.selectionNotice,
    `実効モデル=${profile.exactModelId}`,
    profile.compatibilityReason
      ? `互換性選定理由=${profile.compatibilityReason}`
      : "互換性選定理由=none",
  ].join("\n");
}

/**
 * isSelectionFreshの処理を実行する。
 *
 * @responsibility isSelectionFreshに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、record: SelectionRecord
 * @returns isSelectionFreshの計算結果を返す。
 * @precondition 「state: RuntimeState、record: SelectionRecord」がisSelectionFreshの入力契約を満たす。
 * @postcondition isSelectionFreshの責務を完了した結果だけを返す。
 * @effect N/A: isSelectionFreshは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSelectionFreshは独自の失敗分岐を所有しない。
 * @invariant isSelectionFreshは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSelectionFreshはProcess内の同一Subsystemで完結する。
 * @security isSelectionFreshはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isSelectionFreshは共有非同期状態を持たない同期処理である。
 */
function isSelectionFresh(state: RuntimeState, record: SelectionRecord) {
  const wallAge = state.wallNow() - record.issuedWallClockMs;
  const monotonicAge = state.monotonicNow() - record.issuedMonotonicMs;
  return (
    Number.isFinite(wallAge) &&
    Number.isFinite(monotonicAge) &&
    wallAge >= 0 &&
    monotonicAge >= 0 &&
    wallAge < SELECTION_LIFETIME_MS &&
    monotonicAge < SELECTION_LIFETIME_MS
  );
}

/**
 * removeSelectionRecordの処理を実行する。
 *
 * @responsibility removeSelectionRecordに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、record: SelectionRecord
 * @returns N/A: removeSelectionRecordは戻り値を返さない。
 * @precondition 「state: RuntimeState、record: SelectionRecord」がremoveSelectionRecordの入力契約を満たす。
 * @postcondition removeSelectionRecordの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: removeSelectionRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: removeSelectionRecordは独自の失敗分岐を所有しない。
 * @invariant removeSelectionRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: removeSelectionRecordはProcess内の同一Subsystemで完結する。
 * @security removeSelectionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: removeSelectionRecordは共有非同期状態を持たない同期処理である。
 */
function removeSelectionRecord(state: RuntimeState, record: SelectionRecord) {
  state.records.delete(record.selectionRecordId);
  state.controlCapabilities.delete(record.controlCapability);
  state.useCapabilities.delete(record.useCapability);
}

/**
 * issueSelectionGrantの処理を実行する。
 *
 * @responsibility issueSelectionGrantに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、managementCapability: unknown、rawRequest: unknown
 * @returns issueSelectionGrantの計算結果を返す。
 * @precondition 「state: RuntimeState、managementCapability: unknown、rawRequest: unknown」がissueSelectionGrantの入力契約を満たす。
 * @postcondition issueSelectionGrantの責務を完了した結果だけを返す。
 * @effect N/A: issueSelectionGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: issueSelectionGrantは独自の失敗分岐を所有しない。
 * @invariant issueSelectionGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: issueSelectionGrantはProcess内の同一Subsystemで完結する。
 * @security issueSelectionGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: issueSelectionGrantは共有非同期状態を持たない同期処理である。
 */
function issueSelectionGrant(
  state: RuntimeState,
  managementCapability: unknown,
  rawRequest: unknown,
) {
  if (!managementCapability || typeof managementCapability !== "object") {
    return createBlockedResult(
      "delegation_selection_management_capability_invalid",
    );
  }
  const operation = state.verifyOperation(managementCapability);
  const providerEligibility = state.observeProviderEligibility();
  if (!providerEligibility) {
    return createBlockedResult(
      "delegation_selection_provider_observation_unavailable",
    );
  }
  const route = selectDelegationRouteCandidate(rawRequest, {
    providerEligibility,
  });
  if (
    route.status !== "candidate" ||
    route.operationId !== operation.operationId ||
    !isSelectionRole(route.modelSelectionBasis.role)
  ) {
    return createBlockedResult("delegation_selection_route_invalid");
  }
  const profile = state.resolveModelProfile(
    Object.freeze({
      provider: route.executorProvider,
      family: route.modelSelection.familyPreference ?? "",
      role: route.modelSelectionBasis.role,
      modelTier: route.modelSelection.modelTier ?? "",
      speedMode: "normal",
      billingMode: "subscription_oauth",
    }),
  );
  if (!profile || !isResolvedProfileValid(profile, route)) {
    return createBlockedResult("delegation_selection_profile_invalid");
  }
  const issuedWallClockMs = state.wallNow();
  const issuedMonotonicMs = state.monotonicNow();
  const selectionRecordId = createSelectionRecordId(state);
  if (
    !Number.isFinite(issuedWallClockMs) ||
    !Number.isFinite(issuedMonotonicMs) ||
    issuedWallClockMs < 0 ||
    issuedMonotonicMs < 0 ||
    !selectionRecordId ||
    state.records.has(selectionRecordId)
  ) {
    return createBlockedResult("delegation_selection_runtime_state_invalid");
  }
  const controlCapability = Object.freeze({});
  const useCapability = Object.freeze({});
  const record: SelectionRecord = {
    selectionRecordId,
    operationId: operation.operationId,
    managementCapability,
    route,
    profile,
    selectionNotice: describeResolvedSelectionNotice(route, profile),
    issuedWallClockMs,
    issuedMonotonicMs,
    controlCapability,
    useCapability,
  };
  state.records.set(selectionRecordId, record);
  state.controlCapabilities.set(controlCapability, selectionRecordId);
  state.useCapabilities.set(useCapability, selectionRecordId);
  return Object.freeze({
    status: "issued" as const,
    reason: "delegation_selection_grant_issued",
    selectionRecordId,
    controlCapability,
    useCapability,
    operationId: operation.operationId,
    frontProvider: route.frontProvider,
    executorProvider: route.executorProvider,
    route: route.route,
    profileId: profile.profileId,
    selectedModel: profile.exactModelId,
    selectedEffort: route.modelSelection.effort,
    speedMode: profile.speedMode,
    selectionNotice: record.selectionNotice,
    expiresInMs: SELECTION_LIFETIME_MS,
    selectionCapabilityIssued: true,
    providerAuthorityIssued: false,
    providerEffectAllowed: false,
  });
}

/**
 * findSelectionRecordの処理を実行する。
 *
 * @responsibility findSelectionRecordに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、capability: unknown、aliases: WeakMap<object, string>、managementCapability: unknown
 * @returns findSelectionRecordの計算結果を返す。
 * @precondition 「state: RuntimeState、capability: unknown、aliases: WeakMap<object, string>、managementCapability: unknown」がfindSelectionRecordの入力契約を満たす。
 * @postcondition findSelectionRecordの責務を完了した結果だけを返す。
 * @effect N/A: findSelectionRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: findSelectionRecordは独自の失敗分岐を所有しない。
 * @invariant findSelectionRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: findSelectionRecordはProcess内の同一Subsystemで完結する。
 * @security findSelectionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: findSelectionRecordは共有非同期状態を持たない同期処理である。
 */
function findSelectionRecord(
  state: RuntimeState,
  capability: unknown,
  aliases: WeakMap<object, string>,
  managementCapability: unknown,
) {
  if (
    !capability ||
    typeof capability !== "object" ||
    !managementCapability ||
    typeof managementCapability !== "object"
  ) {
    return null;
  }
  const recordId = aliases.get(capability);
  const record = recordId ? state.records.get(recordId) : null;
  return record?.managementCapability === managementCapability ? record : null;
}

/**
 * consumeSelectionGrantの処理を実行する。
 *
 * @responsibility consumeSelectionGrantに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、useCapability: unknown、managementCapability: unknown
 * @returns consumeSelectionGrantの計算結果を返す。
 * @precondition 「state: RuntimeState、useCapability: unknown、managementCapability: unknown」がconsumeSelectionGrantの入力契約を満たす。
 * @postcondition consumeSelectionGrantの責務を完了した結果だけを返す。
 * @effect N/A: consumeSelectionGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: consumeSelectionGrantは独自の失敗分岐を所有しない。
 * @invariant consumeSelectionGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consumeSelectionGrantはProcess内の同一Subsystemで完結する。
 * @security consumeSelectionGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeSelectionGrantは共有非同期状態を持たない同期処理である。
 */
function consumeSelectionGrant(
  state: RuntimeState,
  useCapability: unknown,
  managementCapability: unknown,
) {
  const record = findSelectionRecord(
    state,
    useCapability,
    state.useCapabilities,
    managementCapability,
  );
  if (!record || !isSelectionFresh(state, record)) {
    if (record) removeSelectionRecord(state, record);
    return null;
  }
  removeSelectionRecord(state, record);
  return Object.freeze({
    selectionRecordId: record.selectionRecordId,
    operationId: record.operationId,
    frontProvider: record.route.frontProvider,
    executorProvider: record.route.executorProvider,
    route: record.route.route,
    profileId: record.profile.profileId,
    model: record.profile.exactModelId,
    basis: record.route.modelSelectionBasis,
    effort: record.route.modelSelection.effort,
    modelTier: record.route.modelSelection.modelTier,
    speedMode: record.profile.speedMode,
    selectionNotice: record.selectionNotice,
    delegationDepth: record.route.delegationDepth,
  });
}

/**
 * revokeSelectionGrantの処理を実行する。
 *
 * @responsibility revokeSelectionGrantに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、controlCapability: unknown、managementCapability: unknown
 * @returns revokeSelectionGrantの計算結果を返す。
 * @precondition 「state: RuntimeState、controlCapability: unknown、managementCapability: unknown」がrevokeSelectionGrantの入力契約を満たす。
 * @postcondition revokeSelectionGrantの責務を完了した結果だけを返す。
 * @effect N/A: revokeSelectionGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeSelectionGrantは独自の失敗分岐を所有しない。
 * @invariant revokeSelectionGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeSelectionGrantはProcess内の同一Subsystemで完結する。
 * @security revokeSelectionGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeSelectionGrantは共有非同期状態を持たない同期処理である。
 */
function revokeSelectionGrant(
  state: RuntimeState,
  controlCapability: unknown,
  managementCapability: unknown,
) {
  const record = findSelectionRecord(
    state,
    controlCapability,
    state.controlCapabilities,
    managementCapability,
  );
  if (!record) {
    return createBlockedResult("delegation_selection_control_invalid");
  }
  removeSelectionRecord(state, record);
  return Object.freeze({
    ...createBlockedResult("delegation_selection_grant_revoked"),
    status: "revoked" as const,
    reason: "delegation_selection_grant_revoked",
    selectionRecordId: record.selectionRecordId,
    operationId: record.operationId,
  });
}

/**
 * supersedeSelectionGrantの処理を実行する。
 *
 * @responsibility supersedeSelectionGrantに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、controlCapability: unknown、managementCapability: unknown、rawReplacementRequest: unknown
 * @returns supersedeSelectionGrantの計算結果を返す。
 * @precondition 「state: RuntimeState、controlCapability: unknown、managementCapability: unknown、rawReplacementRequest: unknown」がsupersedeSelectionGrantの入力契約を満たす。
 * @postcondition supersedeSelectionGrantの責務を完了した結果だけを返す。
 * @effect N/A: supersedeSelectionGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: supersedeSelectionGrantは独自の失敗分岐を所有しない。
 * @invariant supersedeSelectionGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: supersedeSelectionGrantはProcess内の同一Subsystemで完結する。
 * @security supersedeSelectionGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: supersedeSelectionGrantは共有非同期状態を持たない同期処理である。
 */
function supersedeSelectionGrant(
  state: RuntimeState,
  controlCapability: unknown,
  managementCapability: unknown,
  rawReplacementRequest: unknown,
) {
  const previousRecord = findSelectionRecord(
    state,
    controlCapability,
    state.controlCapabilities,
    managementCapability,
  );
  if (!previousRecord || !isSelectionFresh(state, previousRecord)) {
    if (previousRecord) removeSelectionRecord(state, previousRecord);
    return createBlockedResult("delegation_selection_control_invalid");
  }

  const replacement = issueSelectionGrant(
    state,
    managementCapability,
    rawReplacementRequest,
  );
  if (replacement.status !== "issued") {
    return replacement;
  }

  removeSelectionRecord(state, previousRecord);
  return Object.freeze({
    ...replacement,
    reason: "delegation_selection_grant_superseded",
    supersededSelectionRecordId: previousRecord.selectionRecordId,
  });
}

/**
 * issueRuntimeOwnedDelegationSelectionGrantの処理を実行する。
 *
 * @responsibility issueRuntimeOwnedDelegationSelectionGrantに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input managementCapability: unknown、rawRequest: unknown
 * @returns issueRuntimeOwnedDelegationSelectionGrantの計算結果を返す。
 * @precondition 「managementCapability: unknown、rawRequest: unknown」がissueRuntimeOwnedDelegationSelectionGrantの入力契約を満たす。
 * @postcondition issueRuntimeOwnedDelegationSelectionGrantの責務を完了した結果だけを返す。
 * @effect N/A: issueRuntimeOwnedDelegationSelectionGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: issueRuntimeOwnedDelegationSelectionGrantは独自の失敗分岐を所有しない。
 * @invariant issueRuntimeOwnedDelegationSelectionGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: issueRuntimeOwnedDelegationSelectionGrantはProcess内の同一Subsystemで完結する。
 * @security issueRuntimeOwnedDelegationSelectionGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: issueRuntimeOwnedDelegationSelectionGrantは共有非同期状態を持たない同期処理である。
 */
export function issueRuntimeOwnedDelegationSelectionGrant(
  managementCapability: unknown,
  rawRequest: unknown,
) {
  return performSafely("delegation_selection_issue_failed_closed", () =>
    issueSelectionGrant(productionState, managementCapability, rawRequest),
  );
}

/**
 * preflightRuntimeOwnedDelegationExecutionSlateの処理を実行する。
 *
 * @responsibility preflightRuntimeOwnedDelegationExecutionSlateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input managementCapability: unknown、rawExecutorRequest: unknown
 * @returns preflightRuntimeOwnedDelegationExecutionSlateの計算結果を返す。
 * @precondition 「managementCapability: unknown、rawExecutorRequest: unknown」がpreflightRuntimeOwnedDelegationExecutionSlateの入力契約を満たす。
 * @postcondition preflightRuntimeOwnedDelegationExecutionSlateの責務を完了した結果だけを返す。
 * @effect N/A: preflightRuntimeOwnedDelegationExecutionSlateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: preflightRuntimeOwnedDelegationExecutionSlateは独自の失敗分岐を所有しない。
 * @invariant preflightRuntimeOwnedDelegationExecutionSlateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: preflightRuntimeOwnedDelegationExecutionSlateはProcess内の同一Subsystemで完結する。
 * @security preflightRuntimeOwnedDelegationExecutionSlateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: preflightRuntimeOwnedDelegationExecutionSlateは共有非同期状態を持たない同期処理である。
 */
export function preflightRuntimeOwnedDelegationExecutionSlate(
  managementCapability: unknown,
  rawExecutorRequest: unknown,
) {
  return performSafely("delegation_slate_preflight_failed", () => {
    if (!managementCapability || typeof managementCapability !== "object") {
      return Object.freeze({
        status: "blocked" as const,
        reason: "delegation_slate_management_capability_invalid",
        providerEffectAllowed: false,
      });
    }
    const operation = productionState.verifyOperation(managementCapability);
    const providerEligibility = productionState.observeProviderEligibility();
    if (!providerEligibility) {
      return Object.freeze({
        status: "blocked" as const,
        reason: "delegation_slate_provider_observation_unavailable",
        providerEffectAllowed: false,
      });
    }
    const slate = selectDelegationExecutionSlateCandidate(rawExecutorRequest, {
      providerEligibility,
    });
    return slate.status === "candidate"
      ? Object.freeze({
          ...slate,
          operationId: operation.operationId,
          selectionCapabilityIssued: false,
          providerAuthorityIssued: false,
          providerEffectAllowed: false,
        })
      : slate;
  });
}

/**
 * consumeRuntimeOwnedDelegationSelectionGrantの処理を実行する。
 *
 * @responsibility consumeRuntimeOwnedDelegationSelectionGrantに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input useCapability: unknown、managementCapability: unknown
 * @returns consumeRuntimeOwnedDelegationSelectionGrantの計算結果を返す。
 * @precondition 「useCapability: unknown、managementCapability: unknown」がconsumeRuntimeOwnedDelegationSelectionGrantの入力契約を満たす。
 * @postcondition consumeRuntimeOwnedDelegationSelectionGrantの責務を完了した結果だけを返す。
 * @effect N/A: consumeRuntimeOwnedDelegationSelectionGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure consumeRuntimeOwnedDelegationSelectionGrantは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant consumeRuntimeOwnedDelegationSelectionGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consumeRuntimeOwnedDelegationSelectionGrantはProcess内の同一Subsystemで完結する。
 * @security consumeRuntimeOwnedDelegationSelectionGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeRuntimeOwnedDelegationSelectionGrantは共有非同期状態を持たない同期処理である。
 */
export function consumeRuntimeOwnedDelegationSelectionGrant(
  useCapability: unknown,
  managementCapability: unknown,
) {
  try {
    return consumeSelectionGrant(
      productionState,
      useCapability,
      managementCapability,
    );
  } catch {
    return null;
  }
}

/**
 * revokeRuntimeOwnedDelegationSelectionGrantの処理を実行する。
 *
 * @responsibility revokeRuntimeOwnedDelegationSelectionGrantに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input controlCapability: unknown、managementCapability: unknown
 * @returns revokeRuntimeOwnedDelegationSelectionGrantの計算結果を返す。
 * @precondition 「controlCapability: unknown、managementCapability: unknown」がrevokeRuntimeOwnedDelegationSelectionGrantの入力契約を満たす。
 * @postcondition revokeRuntimeOwnedDelegationSelectionGrantの責務を完了した結果だけを返す。
 * @effect N/A: revokeRuntimeOwnedDelegationSelectionGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeRuntimeOwnedDelegationSelectionGrantは独自の失敗分岐を所有しない。
 * @invariant revokeRuntimeOwnedDelegationSelectionGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeRuntimeOwnedDelegationSelectionGrantはProcess内の同一Subsystemで完結する。
 * @security revokeRuntimeOwnedDelegationSelectionGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeRuntimeOwnedDelegationSelectionGrantは共有非同期状態を持たない同期処理である。
 */
export function revokeRuntimeOwnedDelegationSelectionGrant(
  controlCapability: unknown,
  managementCapability: unknown,
) {
  return performSafely("delegation_selection_revoke_failed_closed", () =>
    revokeSelectionGrant(
      productionState,
      controlCapability,
      managementCapability,
    ),
  );
}

/**
 * supersedeRuntimeOwnedDelegationSelectionGrantの処理を実行する。
 *
 * @responsibility supersedeRuntimeOwnedDelegationSelectionGrantに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input controlCapability: unknown、managementCapability: unknown、rawReplacementRequest: unknown
 * @returns supersedeRuntimeOwnedDelegationSelectionGrantの計算結果を返す。
 * @precondition 「controlCapability: unknown、managementCapability: unknown、rawReplacementRequest: unknown」がsupersedeRuntimeOwnedDelegationSelectionGrantの入力契約を満たす。
 * @postcondition supersedeRuntimeOwnedDelegationSelectionGrantの責務を完了した結果だけを返す。
 * @effect N/A: supersedeRuntimeOwnedDelegationSelectionGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: supersedeRuntimeOwnedDelegationSelectionGrantは独自の失敗分岐を所有しない。
 * @invariant supersedeRuntimeOwnedDelegationSelectionGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: supersedeRuntimeOwnedDelegationSelectionGrantはProcess内の同一Subsystemで完結する。
 * @security supersedeRuntimeOwnedDelegationSelectionGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: supersedeRuntimeOwnedDelegationSelectionGrantは共有非同期状態を持たない同期処理である。
 */
export function supersedeRuntimeOwnedDelegationSelectionGrant(
  controlCapability: unknown,
  managementCapability: unknown,
  rawReplacementRequest: unknown,
) {
  return performSafely("delegation_selection_supersede_failed_closed", () =>
    supersedeSelectionGrant(
      productionState,
      controlCapability,
      managementCapability,
      rawReplacementRequest,
    ),
  );
}

/**
 * createIsolatedDelegationSelectionGrantRuntimeCandidateの処理を実行する。
 *
 * @responsibility createIsolatedDelegationSelectionGrantRuntimeCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input dependencies: Omit< RuntimeState, "records" | "controlCapabilities" | "useCapabilities" >
 * @returns createIsolatedDelegationSelectionGrantRuntimeCandidateの計算結果を返す。
 * @precondition 「dependencies: Omit< RuntimeState, "records" | "controlCapabilities" | "useCapabilities" >」がcreateIsolatedDelegationSelectionGrantRuntimeCandidateの入力契約を満たす。
 * @postcondition createIsolatedDelegationSelectionGrantRuntimeCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedDelegationSelectionGrantRuntimeCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createIsolatedDelegationSelectionGrantRuntimeCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createIsolatedDelegationSelectionGrantRuntimeCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedDelegationSelectionGrantRuntimeCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedDelegationSelectionGrantRuntimeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedDelegationSelectionGrantRuntimeCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedDelegationSelectionGrantRuntimeCandidate(
  dependencies: Omit<
    RuntimeState,
    "records" | "controlCapabilities" | "useCapabilities"
  >,
) {
  const state = createRuntimeState(dependencies);
  return Object.freeze({
    productionAuthority: false as const,
    issue: (managementCapability: unknown, rawRequest: unknown) =>
      performSafely("delegation_selection_issue_failed_closed", () =>
        issueSelectionGrant(state, managementCapability, rawRequest),
      ),
    consume: (useCapability: unknown, managementCapability: unknown) => {
      try {
        return consumeSelectionGrant(
          state,
          useCapability,
          managementCapability,
        );
      } catch {
        return null;
      }
    },
    revoke: (controlCapability: unknown, managementCapability: unknown) =>
      performSafely("delegation_selection_revoke_failed_closed", () =>
        revokeSelectionGrant(state, controlCapability, managementCapability),
      ),
    supersede: (
      controlCapability: unknown,
      managementCapability: unknown,
      rawReplacementRequest: unknown,
    ) =>
      performSafely("delegation_selection_supersede_failed_closed", () =>
        supersedeSelectionGrant(
          state,
          controlCapability,
          managementCapability,
          rawReplacementRequest,
        ),
      ),
  });
}

/**
 * describeDelegationSelectionGrantRuntimeContractの処理を実行する。
 *
 * @responsibility describeDelegationSelectionGrantRuntimeContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeDelegationSelectionGrantRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeDelegationSelectionGrantRuntimeContractの入力契約を満たす。
 * @postcondition describeDelegationSelectionGrantRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeDelegationSelectionGrantRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeDelegationSelectionGrantRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeDelegationSelectionGrantRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeDelegationSelectionGrantRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeDelegationSelectionGrantRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeDelegationSelectionGrantRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeDelegationSelectionGrantRuntimeContract() {
  return Object.freeze({
    contract: DELEGATION_SELECTION_GRANT_RUNTIME_CONTRACT,
    contractRevision: DELEGATION_SELECTION_GRANT_RUNTIME_CONTRACT_REVISION,
    routeContract: DELEGATION_ROUTE_SELECTION_CONTRACT,
    selectionLifetimeMs: SELECTION_LIFETIME_MS,
    clocks: Object.freeze(["runtime_wall", "runtime_monotonic"]),
    aliases: Object.freeze(["control", "use"]),
    maximumUses: 1,
    operationBinding: "runtime_owned_management_capability",
    providerEligibility:
      "runtime_owned_preselection_candidate_with_home_distribution_policy_auth_preflight_deferred",
    exactModelId: "runtime_owned_verified_provider_profile_connected",
    billingMode: "subscription_oauth_only",
    speedMode: "normal_only",
    selectionNotice: "issued_before_provider_effect",
    executionSlatePreflight:
      "executor_and_reviewer_candidates_from_one_runtime_owned_eligibility_observation_before_selection_grants",
    executionSlateCapabilityIssued: false,
    providerFallback:
      "forbidden_after_provider_request_or_when_effect_state_is_uncertain",
    reselection:
      "process_local_supersede_api_exists_but_general_task_uses_new_operation_after_cleanup",
    providerAuthorityIssued: false,
    providerEffectAllowed: false,
  });
}
