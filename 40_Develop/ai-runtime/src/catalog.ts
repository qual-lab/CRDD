/**
 * AI Profile Catalogの検証、既定値、解決処理を提供する。
 *
 * @responsibility 登録済みAdapterとProfileの閉じた関係、曖昧解決の拒否、利用可能性の分離を所有する。
 * @trace ARCH-000010
 */
import type {
  AiAdapterDefinition,
  AiModelTier,
  AiProfileAvailability,
  AiProfileAvailabilityObservation,
  AiProfileCatalog,
  AiProfileDefinition,
  AiProfileResolutionRequest,
  AiProvider,
  AiReasoningEffort,
  AiSelectionRole,
  ResolvedAiProfile,
  ResolvedAiProfileIdentity,
} from "./ai-profile-types.ts";

const IDENTIFIER = /^[a-z][a-z0-9._-]{1,63}$/u;
const PROFILE_ID = /^PROFILE-[0-9]{6,}$/u;
const MODEL_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const PROVIDERS = new Set<AiProvider>(["codex", "claude"]);
const ROLES = new Set<AiSelectionRole>([
  "coordinator",
  "executor",
  "independent_reviewer",
  "result_integration",
]);
const TIERS = new Set<AiModelTier>(["preferred", "upper_allowed"]);
const EFFORTS = new Set<AiReasoningEffort>([
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

export const DEFAULT_AI_PROFILE_CATALOG: AiProfileCatalog = Object.freeze({
  contract: "crdd/ai-profile-catalog",
  contractRevision: 1,
  adapters: Object.freeze([
    Object.freeze({
      adapterId: "codex-cli",
      provider: "codex",
      offering: "chatgpt_subscription_oauth",
      authorityOrigin: "https://chatgpt.com",
      allowedModelIds: Object.freeze(["gpt-5.5", "gpt-5.6-sol", "gpt-6-astra"]),
      allowedReasoningEfforts: Object.freeze([
        "low",
        "medium",
        "high",
        "xhigh",
        "max",
      ] as const),
    }),
    Object.freeze({
      adapterId: "claude-code",
      provider: "claude",
      offering: "claude_max",
      authorityOrigin: "https://claude.ai",
      allowedModelIds: Object.freeze(["opus"]),
      allowedReasoningEfforts: Object.freeze([
        "low",
        "medium",
        "high",
      ] as const),
    }),
  ]),
  profiles: Object.freeze([
    ...(["preferred", "upper_allowed"] as const).map((tier, tierIndex) =>
      Object.freeze({
        profileId: `PROFILE-${100001 + tierIndex}`,
        adapterId: "codex-cli",
        family: "sol",
        exactModelId: "gpt-5.6-sol",
        selectionRoles: Object.freeze([
          "coordinator",
          "result_integration",
        ] as const),
        modelTiers: Object.freeze([tier]),
        speedMode: "normal" as const,
        billingMode: "subscription_oauth" as const,
        defaultReasoningEffort: "medium" as const,
        compatibilityReason: null,
      }),
    ),
    ...(["preferred", "upper_allowed"] as const).map((tier, tierIndex) =>
      Object.freeze({
        profileId: `PROFILE-${100003 + tierIndex}`,
        adapterId: "codex-cli",
        family: "sol",
        exactModelId: "gpt-5.5",
        selectionRoles: Object.freeze([
          "executor",
          "independent_reviewer",
        ] as const),
        modelTiers: Object.freeze([tier]),
        speedMode: "normal" as const,
        billingMode: "subscription_oauth" as const,
        defaultReasoningEffort: "medium" as const,
        compatibilityReason:
          "gpt_5_6_code_mode_only_host_unavailable_in_fixed_linux_runtime",
      }),
    ),
    ...(["preferred", "upper_allowed"] as const).map((tier, index) =>
      Object.freeze({
        profileId: `PROFILE-${200001 + index}`,
        adapterId: "claude-code",
        family: "opus",
        exactModelId: "opus",
        selectionRoles: Object.freeze([
          "coordinator",
          "executor",
          "independent_reviewer",
          "result_integration",
        ] as const),
        modelTiers: Object.freeze([tier]),
        speedMode: "normal" as const,
        billingMode: "subscription_oauth" as const,
        defaultReasoningEffort: "medium" as const,
        compatibilityReason: null,
      }),
    ),
  ]),
});

/**
 * 候補が配列でないRecordか判定する。
 *
 * @responsibility 未信頼値をProperty参照前にObject境界へ絞る。
 * @trace ARCH-000010
 * @input value: 未信頼値。
 * @returns 配列でない非null Objectならtrue。
 * @precondition valueの型を仮定しない。
 * @postcondition trueの場合だけRecordとして参照できる。
 * @effect N/A: 型判定だけを行う。
 * @failure N/A: 全値をBooleanへ分類する。
 * @invariant 配列をRecord候補へ含めない。
 * @boundary 未信頼値と設定検証の境界。
 * @security Getterを列挙せず、基本型だけを確認する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recordが許可Propertyだけを持つか判定する。
 *
 * @responsibility 未知Propertyの黙示受理を防ぐ。
 * @trace ARCH-000010
 * @input value: 検査Record、expected: 許可Property集合。
 * @returns Property集合が完全一致すればtrue。
 * @precondition valueはRecordとして確認済みである。
 * @postcondition trueの場合は不足と余分Propertyがない。
 * @effect N/A: Property名を比較するだけである。
 * @failure N/A: 不一致をfalseで返す。
 * @invariant Property順序へ依存しない。
 * @boundary 設定Schemaと候補Objectの境界。
 * @security Secret等の未知Propertyを無視しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
) {
  const keys = Object.keys(value).sort();
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === [...expected].sort()[index])
  );
}

/**
 * 重複を許さない文字列配列を検証する。
 *
 * @responsibility 配列の非空、要素型、値制約、一意性をまとめて確認する。
 * @trace ARCH-000010
 * @input value: 未信頼値、predicate: 要素値の許可判定。
 * @returns 全条件を満たす配列ならtrue。
 * @precondition predicateはEffectを発行しない。
 * @postcondition trueの場合は一件以上の一意な許可文字列だけを含む。
 * @effect N/A: 配列要素を検査するだけである。
 * @failure N/A: 不正候補をfalseで返す。
 * @invariant 同じ値の重複を設定上の別意味として扱わない。
 * @boundary 未信頼配列と設定値集合の境界。
 * @security 非文字列をcoerceしない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function parseStringArray(
  value: unknown,
  predicate: (item: string) => boolean,
) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && predicate(item)) &&
    new Set(value).size === value.length
  );
}

/**
 * Adapter候補を検証済み定義へ変換する。
 *
 * @responsibility Provider接続部の固定Identity、許可Model、推論強度、Authority Originを検証する。
 * @trace ARCH-000010
 * @input value: 未信頼Adapter候補。
 * @returns 検証済みAdapter。拒否時はnull。
 * @precondition valueを信頼済みObjectと仮定しない。
 * @postcondition 返却値はHTTPS Originと閉じたProvider値を持つ。
 * @effect N/A: Snapshot作成だけを行う。
 * @failure 不正候補をnullで拒否する。
 * @invariant 任意実行PathとCLI引数を受理しない。
 * @boundary 外部設定とAdapter定義の境界。
 * @security HTTPS Origin以外を拒否し、Credentialを持たない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function parseAdapter(value: unknown): AiAdapterDefinition | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "adapterId",
      "provider",
      "offering",
      "authorityOrigin",
      "allowedModelIds",
      "allowedReasoningEfforts",
    ])
  )
    return null;
  if (
    typeof value.adapterId !== "string" ||
    !IDENTIFIER.test(value.adapterId) ||
    typeof value.provider !== "string" ||
    !PROVIDERS.has(value.provider as AiProvider) ||
    (value.offering !== "chatgpt_subscription_oauth" &&
      value.offering !== "claude_max") ||
    typeof value.authorityOrigin !== "string" ||
    !parseStringArray(value.allowedModelIds, (item) => MODEL_ID.test(item)) ||
    !parseStringArray(value.allowedReasoningEfforts, (item) =>
      EFFORTS.has(item as AiReasoningEffort),
    )
  )
    return null;
  let origin: URL;
  try {
    origin = new URL(value.authorityOrigin);
  } catch {
    return null;
  }
  if (origin.protocol !== "https:" || origin.origin !== value.authorityOrigin)
    return null;
  return Object.freeze({
    adapterId: value.adapterId,
    provider: value.provider as AiProvider,
    offering: value.offering,
    authorityOrigin: value.authorityOrigin,
    allowedModelIds: Object.freeze([...(value.allowedModelIds as string[])]),
    allowedReasoningEfforts: Object.freeze([
      ...(value.allowedReasoningEfforts as AiReasoningEffort[]),
    ]),
  });
}

/**
 * Profile候補を検証済み定義へ変換する。
 *
 * @responsibility 安定ID、Adapter参照、仕事Role、Tier、Model選択内容を検証する。
 * @trace ARCH-000010
 * @input value: 未信頼Profile候補。
 * @returns 検証済みProfile。拒否時はnull。
 * @precondition valueを信頼済みObjectと仮定しない。
 * @postcondition 返却値は閉じたRole、Tier、推論強度だけを持つ。
 * @effect N/A: Snapshot作成だけを行う。
 * @failure 不正候補をnullで拒否する。
 * @invariant Profile設定だけでAdapterを新設しない。
 * @boundary 外部設定とProfile定義の境界。
 * @security Credential、Path、任意引数を受理しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function parseProfile(value: unknown): AiProfileDefinition | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "profileId",
      "adapterId",
      "family",
      "exactModelId",
      "selectionRoles",
      "modelTiers",
      "speedMode",
      "billingMode",
      "defaultReasoningEffort",
      "compatibilityReason",
    ])
  )
    return null;
  if (
    typeof value.profileId !== "string" ||
    !PROFILE_ID.test(value.profileId) ||
    typeof value.adapterId !== "string" ||
    !IDENTIFIER.test(value.adapterId) ||
    typeof value.family !== "string" ||
    !IDENTIFIER.test(value.family) ||
    typeof value.exactModelId !== "string" ||
    !MODEL_ID.test(value.exactModelId) ||
    !parseStringArray(value.selectionRoles, (item) =>
      ROLES.has(item as AiSelectionRole),
    ) ||
    !parseStringArray(value.modelTiers, (item) =>
      TIERS.has(item as AiModelTier),
    ) ||
    value.speedMode !== "normal" ||
    value.billingMode !== "subscription_oauth" ||
    typeof value.defaultReasoningEffort !== "string" ||
    !EFFORTS.has(value.defaultReasoningEffort as AiReasoningEffort) ||
    (value.compatibilityReason !== null &&
      typeof value.compatibilityReason !== "string")
  )
    return null;
  return Object.freeze({
    profileId: value.profileId,
    adapterId: value.adapterId,
    family: value.family,
    exactModelId: value.exactModelId,
    selectionRoles: Object.freeze([
      ...(value.selectionRoles as AiSelectionRole[]),
    ]),
    modelTiers: Object.freeze([...(value.modelTiers as AiModelTier[])]),
    speedMode: "normal",
    billingMode: "subscription_oauth",
    defaultReasoningEffort: value.defaultReasoningEffort as AiReasoningEffort,
    compatibilityReason: value.compatibilityReason as string | null,
  });
}

/**
 * 未信頼の設定候補を閉じたAI Profile Catalogへ変換する。
 *
 * @responsibility 未知Property、重複Identity、未登録Adapter、許可外ModelをEffect前に拒否する。
 * @trace ARCH-000010
 * @input candidate: 未信頼の設定候補。
 * @returns 検証済みCatalog。拒否時はnull。
 * @precondition candidateを信頼済みObjectと仮定しない。
 * @postcondition 返却CatalogのProfileは一意な登録済みAdapterと許可Modelへ結合する。
 * @effect N/A: 入力の検証とSnapshot作成だけを行う。
 * @failure 不正または曖昧な候補をnullとして拒否する。
 * @invariant Secret、実行Path、任意引数を受理しない。
 * @boundary JSON等から受け取った未信頼設定とAI Runtimeの境界。
 * @security 未知Propertyを黙って無視せず、Authorityを設定値から生成しない。
 * @concurrency N/A: 共有状態を持たない同期検証である。
 */
export function validateAiProfileCatalog(
  candidate: unknown,
): AiProfileCatalog | null {
  if (
    !isRecord(candidate) ||
    !hasExactKeys(candidate, [
      "contract",
      "contractRevision",
      "adapters",
      "profiles",
    ]) ||
    candidate.contract !== "crdd/ai-profile-catalog" ||
    candidate.contractRevision !== 1 ||
    !Array.isArray(candidate.adapters) ||
    !Array.isArray(candidate.profiles) ||
    candidate.adapters.length === 0 ||
    candidate.profiles.length === 0
  )
    return null;
  const adapters = candidate.adapters.map(parseAdapter);
  const profiles = candidate.profiles.map(parseProfile);
  if (
    adapters.some((item) => item === null) ||
    profiles.some((item) => item === null)
  )
    return null;
  const validAdapters = adapters as AiAdapterDefinition[];
  const validProfiles = profiles as AiProfileDefinition[];
  if (
    new Set(validAdapters.map((item) => item.adapterId)).size !==
      validAdapters.length ||
    new Set(validProfiles.map((item) => item.profileId)).size !==
      validProfiles.length
  )
    return null;
  const adapterById = new Map(
    validAdapters.map((item) => [item.adapterId, item]),
  );
  for (const profile of validProfiles) {
    const adapter = adapterById.get(profile.adapterId);
    if (
      !adapter?.allowedModelIds.includes(profile.exactModelId) ||
      !adapter.allowedReasoningEfforts.includes(profile.defaultReasoningEffort)
    )
      return null;
  }
  for (const provider of PROVIDERS) {
    for (const role of ROLES) {
      for (const tier of TIERS) {
        const matches = validProfiles.filter((profile) => {
          const adapter = adapterById.get(profile.adapterId);
          return (
            adapter?.provider === provider &&
            profile.selectionRoles.includes(role) &&
            profile.modelTiers.includes(tier)
          );
        });
        const keys = matches.map(
          (item) => `${item.family}:${item.speedMode}:${item.billingMode}`,
        );
        if (new Set(keys).size !== keys.length) return null;
      }
    }
  }
  return Object.freeze({
    contract: "crdd/ai-profile-catalog",
    contractRevision: 1,
    adapters: Object.freeze(validAdapters),
    profiles: Object.freeze(validProfiles),
  });
}

/**
 * Profile要求をCatalogから一意に解決する。
 *
 * @responsibility Provider、Family、Role、Tierの完全一致だけを実行候補へ変換する。
 * @trace ARCH-000010
 * @input catalog: 検証済みCatalog、request: Profile解決要求。
 * @returns 一意なProfile。未登録または曖昧時はnull。
 * @precondition catalogはvalidateAiProfileCatalogで検証済みである。
 * @postcondition 返却値はAdapterのProvider・Offering・許可Modelを含む。
 * @effect N/A: Catalog検索だけを行う。
 * @failure 未登録または複数一致をnullとして拒否する。
 * @invariant 利用可能性、認証、実行Authorityを解決結果へ推測しない。
 * @boundary AI Profile設定とCoordinator等の選択利用側の境界。
 * @security Profile一致だけでProvider Effectを許可しない。
 * @concurrency N/A: 不変Catalogを読む同期処理である。
 */
export function resolveAiProfile(
  catalog: AiProfileCatalog,
  request: AiProfileResolutionRequest,
): ResolvedAiProfile | null {
  const adapterById = new Map(
    catalog.adapters.map((item) => [item.adapterId, item]),
  );
  const matches = catalog.profiles.filter((profile) => {
    const adapter = adapterById.get(profile.adapterId);
    return (
      adapter?.provider === request.provider &&
      profile.family === request.family &&
      profile.selectionRoles.includes(request.role) &&
      profile.modelTiers.includes(request.modelTier) &&
      profile.speedMode === request.speedMode &&
      profile.billingMode === request.billingMode
    );
  });
  if (matches.length !== 1) return null;
  const profile = matches[0];
  if (!profile) return null;
  const adapter = adapterById.get(profile.adapterId);
  if (!adapter) return null;
  return Object.freeze({
    ...profile,
    provider: adapter.provider,
    offering: adapter.offering,
    authorityOrigin: adapter.authorityOrigin,
    allowedReasoningEfforts: adapter.allowedReasoningEfforts,
    selectionRole: request.role,
    modelTier: request.modelTier,
  });
}

/**
 * 選択済みProfile IDを実行に必要なexact設定へ解決する。
 *
 * @responsibility 利用者が選んだ安定Profile IDを、同じCatalog Snapshot内のAdapter・Model・Reasoning設定へ結合する。
 * @trace ARCH-000010 ARCH-000015
 * @input catalog: 検証済みCatalog、profileId: 選択済みProfile ID。
 * @returns 一意なProfile Identity。未登録、重複またはAdapter不整合時はnull。
 * @precondition catalogはvalidateAiProfileCatalogで検証済みである。
 * @postcondition 返却値はProfileと対応Adapterの実行設定を同じSnapshotから保持する。
 * @effect N/A: Catalog検索だけを行う。
 * @failure 解決不能を既定Profileへ置換せずnullを返す。
 * @invariant Catalog外のModel、ReasoningまたはAuthority Originを補完しない。
 * @boundary AI Profile設定と選択済みProfile利用側の境界。
 * @security Profile解決だけで認証またはProvider実行Authorityを発行しない。
 * @concurrency N/A: 一つの不変Catalogだけを同期参照する。
 */
export function resolveAiProfileById(
  catalog: AiProfileCatalog,
  profileId: string,
): ResolvedAiProfileIdentity | null {
  const matches = catalog.profiles.filter(
    (profile) => profile.profileId === profileId,
  );
  if (matches.length !== 1) return null;
  const profile = matches[0];
  if (!profile) return null;
  const adapter = catalog.adapters.find(
    (candidate) => candidate.adapterId === profile.adapterId,
  );
  if (!adapter) return null;
  return Object.freeze({
    ...profile,
    provider: adapter.provider,
    offering: adapter.offering,
    authorityOrigin: adapter.authorityOrigin,
    allowedReasoningEfforts: adapter.allowedReasoningEfforts,
  });
}

/**
 * Profileの四つの利用可能性軸を一つの表示状態へ投影する。
 *
 * @responsibility 登録、Host、認証、実行Authorityを混同せず状態と理由を返す。
 * @trace ARCH-000010
 * @input observation: 各利用可能性軸の観測結果。
 * @returns available、unavailable、unknownの投影。
 * @precondition nullは未観測でありfalseへ畳まない。
 * @postcondition falseが一つでもあればunavailable、falseがなくnullがあればunknownになる。
 * @effect N/A: 観測値の投影だけを行う。
 * @failure N/A: 閉じたBoolean/null契約を処理する。
 * @invariant 未観測を利用可能として表示しない。
 * @boundary Runtime観測とWorkbench等の表示利用側の境界。
 * @security 認証状態からCredential値を公開しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function evaluateAiProfileAvailability(
  observation: AiProfileAvailabilityObservation,
): AiProfileAvailability {
  const entries = Object.entries(observation) as [
    keyof AiProfileAvailabilityObservation,
    boolean | null,
  ][];
  const unavailable = entries
    .filter(([, value]) => value === false)
    .map(([key]) => key);
  const unknown = entries
    .filter(([, value]) => value === null)
    .map(([key]) => key);
  return Object.freeze({
    ...observation,
    status:
      unavailable.length > 0
        ? "unavailable"
        : unknown.length > 0
          ? "unknown"
          : "available",
    reasons: Object.freeze(unavailable.length > 0 ? unavailable : unknown),
  });
}
