/**
 * provider-model-profile-runtimeに属する責務をまとめる。
 *
 * @responsibility Providerを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000010
 */
import {
  DEFAULT_AI_PROFILE_CATALOG,
  resolveAiProfile,
  validateAiProfileCatalog,
} from "../catalog/index.ts";
import type { AiProfileCatalog } from "../catalog/types.ts";
import { snapshotPlainRecord } from "../../../domain-model/src/plain-data/index.ts";

export const PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT =
  "crdd-coordinator/provider-model-profile-runtime";
export const PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT_REVISION = 2;

const REQUEST_KEYS = new Set([
  "provider",
  "profileId",
  "family",
  "role",
  "modelTier",
  "speedMode",
  "billingMode",
]);
const AUTOMATIC_REQUEST_KEYS = new Set([
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
const PROFILE_ID = /^PROFILE-[0-9]{6,}$/u;

/**
 * Runtime 所有 Provider Model Profileを一意に解決する。
 *
 * @responsibility Runtime 所有 Provider Model Profileの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000010
 * @input rawRequest: unknown
 * @returns resolveRuntimeOwnedProviderModelProfileの計算結果を返す。
 * @precondition 「rawRequest: unknown」がresolveRuntimeOwnedProviderModelProfileの入力契約を満たす。
 * @postcondition resolveRuntimeOwnedProviderModelProfileの責務を完了した結果だけを返す。
 * @effect N/A: resolveRuntimeOwnedProviderModelProfileは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRuntimeOwnedProviderModelProfileは独自の失敗分岐を所有しない。
 * @invariant resolveRuntimeOwnedProviderModelProfileは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRuntimeOwnedProviderModelProfileはProcess内の同一Subsystemで完結する。
 * @security resolveRuntimeOwnedProviderModelProfileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRuntimeOwnedProviderModelProfileは共有非同期状態を持たない同期処理である。
 */
export function resolveRuntimeOwnedProviderModelProfile(rawRequest: unknown) {
  return resolveRuntimeOwnedProviderModelProfileFromCatalog(
    DEFAULT_AI_PROFILE_CATALOG,
    rawRequest,
  );
}

/**
 * 検証済みCatalog SnapshotからRuntime所有Profileを一意に解決する。
 *
 * @responsibility 外部構成で追加したFamilyを中核の固定列挙へ戻さず、閉じたCatalog契約から解決する。
 * @trace ARCH-000010
 * @input rawCatalog: 採用候補または採用済みCatalog、rawRequest: Profile解決要求。
 * @returns 既存Coordinator公開形の解決結果。拒否時はnull。
 * @precondition rawCatalogとrawRequestを信頼済みObjectと仮定しない。
 * @postcondition Profile、Adapter、Modelの参照整合と一意性を満たす結果だけを返す。
 * @effect N/A: Snapshot検証とCatalog検索だけを行う。
 * @failure 不正Catalog、未知値、余分Key、0件または複数一致をnullとして拒否する。
 * @invariant Catalog選択だけでProvider実行Authorityを発行しない。
 * @boundary AI Runtime CatalogとCoordinator選択Consumerの境界。
 * @security 秘密値、任意実行Pathまたは任意引数をCatalogから受理しない。
 * @concurrency N/A: 不変Snapshotを読む同期処理である。
 */
export function resolveRuntimeOwnedProviderModelProfileFromCatalog(
  rawCatalog: unknown,
  rawRequest: unknown,
) {
  const catalog: AiProfileCatalog | null = validateAiProfileCatalog(rawCatalog);
  if (!catalog) return null;
  const request =
    snapshotPlainRecord(rawRequest, REQUEST_KEYS) ??
    snapshotPlainRecord(rawRequest, AUTOMATIC_REQUEST_KEYS);
  if (
    !request ||
    (request.provider !== "codex" && request.provider !== "claude") ||
    typeof request.family !== "string" ||
    request.family.length === 0 ||
    typeof request.role !== "string" ||
    !ROLES.has(request.role) ||
    !MODEL_TIERS.has(request.modelTier as string) ||
    request.speedMode !== "normal" ||
    request.billingMode !== "subscription_oauth"
  ) {
    return null;
  }
  if (
    request.profileId !== undefined &&
    (typeof request.profileId !== "string" ||
      !PROFILE_ID.test(request.profileId))
  )
    return null;
  if (typeof request.profileId === "string") {
    const profile = catalog.profiles.find(
      (candidate) => candidate.profileId === request.profileId,
    );
    const adapter = catalog.adapters.find(
      (candidate) => candidate.adapterId === profile?.adapterId,
    );
    if (
      profile === undefined ||
      adapter === undefined ||
      adapter.provider !== request.provider ||
      !profile.selectionRoles.includes(
        request.role as
          | "coordinator"
          | "executor"
          | "independent_reviewer"
          | "result_integration",
      ) ||
      !profile.modelTiers.includes(
        request.modelTier as "preferred" | "upper_allowed",
      )
    )
      return null;
    return Object.freeze({
      provider: adapter.provider,
      profileId: profile.profileId,
      exactModelId: profile.exactModelId,
      family: profile.family,
      selectionRole: request.role as
        | "coordinator"
        | "executor"
        | "independent_reviewer"
        | "result_integration",
      modelTier: request.modelTier as "preferred" | "upper_allowed",
      speedMode: profile.speedMode,
      billingMode: profile.billingMode,
      compatibilityReason: profile.compatibilityReason,
    });
  }
  const resolved = resolveAiProfile(catalog, {
    provider: request.provider,
    family: request.family,
    role: request.role as
      | "coordinator"
      | "executor"
      | "independent_reviewer"
      | "result_integration",
    modelTier: request.modelTier as "preferred" | "upper_allowed",
    speedMode: "normal",
    billingMode: "subscription_oauth",
  });
  if (!resolved) return null;
  return Object.freeze({
    provider: resolved.provider,
    profileId: resolved.profileId,
    exactModelId: resolved.exactModelId,
    family: resolved.family,
    selectionRole: resolved.selectionRole,
    modelTier: resolved.modelTier,
    speedMode: resolved.speedMode,
    billingMode: resolved.billingMode,
    compatibilityReason: resolved.compatibilityReason,
  });
}

/**
 * Provider Model Profile Runtime 契約の公開契約を記述する。
 *
 * @responsibility Provider Model Profile Runtime 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderModelProfileRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderModelProfileRuntimeContractの入力契約を満たす。
 * @postcondition describeProviderModelProfileRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderModelProfileRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderModelProfileRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderModelProfileRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderModelProfileRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderModelProfileRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderModelProfileRuntimeContractは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Family Preferenceを選択する。
 *
 * @responsibility Family Preferenceの候補集合、選択理由、選択不能時の境界を所有する。
 * @trace ARCH-000010
 * @input provider: Provider
 * @returns selectProviderFamilyPreferenceの計算結果を返す。
 * @precondition 「provider: Provider」がselectProviderFamilyPreferenceの入力契約を満たす。
 * @postcondition selectProviderFamilyPreferenceの責務を完了した結果だけを返す。
 * @effect N/A: selectProviderFamilyPreferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectProviderFamilyPreferenceは独自の失敗分岐を所有しない。
 * @invariant selectProviderFamilyPreferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectProviderFamilyPreferenceはProcess内の同一Subsystemで完結する。
 * @security selectProviderFamilyPreferenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: selectProviderFamilyPreferenceは共有非同期状態を持たない同期処理である。
 */
export function selectProviderFamilyPreference(provider: "codex" | "claude") {
  return provider === "codex" ? "sol" : "opus";
}
