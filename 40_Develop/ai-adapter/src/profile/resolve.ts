/**
 * Profile要求をCatalogの一意な実行設定へ解決する。
 *
 * @responsibility 明示Profile又はFamily・Role・Tier条件を検証し、対応する設定だけを返す。
 * @trace ARCH-000010
 */
import {
  DEFAULT_AI_PROFILE_CATALOG,
  resolveAiProfile,
  validateAiProfileCatalog,
} from "../catalog/resolve.ts";
import type { AiProfileCatalog } from "../catalog/types.ts";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";

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
 * 同梱Catalogから明示要求のProfileを一意に解決する。
 *
 * @responsibility 既定Catalogを指定した同じ検証・選定経路へ要求を渡す。
 * @trace ARCH-000010
 * @input 未信頼のProfile要求。
 * @returns 対応するProfile設定、又は拒否時null。
 * @precondition 同梱CatalogはModule初期化時に検証されている。
 * @postcondition Catalog指定版と同じ要求の受理・拒否条件を使う。
 * @effect N/A: 入力又は固定値の同期評価だけで、保存・Process・通信を行わない。
 * @failure 不正要求、非対応値、不一致又は曖昧な選定はnull。
 * @invariant 別Modelや別Providerへの暗黙fallbackを行わない。
 * @boundary Profile Catalogと実行設定を利用するConsumerの間。
 * @security 秘密値・Host Path・実行Authorityを返さない。
 * @concurrency N/A: 共有状態を更新しない同期処理。
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
 * 既定Profileの固定互換構成と未対応範囲を記述する。
 *
 * @responsibility 固定Profile ID、Model互換性、Tier、速度・課金制約の宣言を返す。
 * @trace ARCH-000010
 * @input N/A: 実行時入力を持たない。
 * @returns 固定互換Profileの記述Object。
 * @precondition N/A: 宣言値だけで構成する。
 * @postcondition Provider実行やCatalog採用を開始しない。
 * @effect N/A: 入力又は固定値の同期評価だけで、保存・Process・通信を行わない。
 * @failure N/A: 固定Objectの生成だけで拒否分岐を持たない。
 * @invariant 宣言した検証済み範囲を全Profile・全Providerの成立へ一般化しない。
 * @boundary Profile Catalogと実行設定を利用するConsumerの間。
 * @security 秘密値・Host Path・実行Authorityを返さない。
 * @concurrency N/A: 共有状態を更新しない同期処理。
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
 * Providerに対応する既定Familyを返す。
 *
 * @responsibility CodexのsolとClaudeのopusの既存対応を所有する。
 * @trace ARCH-000010
 * @input 型契約で限定されたProvider。
 * @returns 対応するFamily名。
 * @precondition Providerはcodex又はclaudeである。
 * @postcondition Profile・Model・実行権限を選定したとは扱わない。
 * @effect N/A: 入力又は固定値の同期評価だけで、保存・Process・通信を行わない。
 * @failure N/A: 型契約内の二Providerを既存の対応で処理する。
 * @invariant Family選択から費用・速度・上位Modelの自動切替を行わない。
 * @boundary Profile Catalogと実行設定を利用するConsumerの間。
 * @security 秘密値・Host Path・実行Authorityを返さない。
 * @concurrency N/A: 共有状態を更新しない同期処理。
 */
export function selectProviderFamilyPreference(provider: "codex" | "claude") {
  return provider === "codex" ? "sol" : "opus";
}
