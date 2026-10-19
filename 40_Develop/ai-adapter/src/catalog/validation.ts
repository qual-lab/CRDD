/**
 * CatalogとProfile登録内容を検証する。
 *
 * @responsibility 閉じた入力・Adapterとの関係・不正値の拒否を所有し、候補選定や保存を行わない。
 * @trace ARCH-000010
 */
import type {
  AiProvider,
  AiReasoningEffort,
  AiAdapterDefinition,
} from "../provider/types.ts";
import type { AiProfileCatalog } from "./types.ts";
import type {
  AiSelectionRole,
  AiModelTier,
  AiProfileDefinition,
} from "../profile/types.ts";
import {
  snapshotPlainRecord,
  snapshotPlainArray,
} from "../../../domain-model/src/index.ts";
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
 * @input value: 検査Record、expectedKeys: 許可Property集合。
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
  expectedKeys: readonly string[],
) {
  const keys = Object.keys(value).sort();
  return (
    keys.length === expectedKeys.length &&
    keys.every((key, index) => key === [...expectedKeys].sort()[index])
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
function parseAdapter(candidate: unknown): AiAdapterDefinition | null {
  const record = snapshotPlainRecord(
    candidate,
    new Set([
      "adapterId",
      "provider",
      "offering",
      "authorityOrigin",
      "allowedModelIds",
      "allowedReasoningEfforts",
    ]),
  );
  if (!record) return null;
  const models = snapshotPlainArray(
    record.allowedModelIds,
    Number.MAX_SAFE_INTEGER,
  );
  const efforts = snapshotPlainArray(
    record.allowedReasoningEfforts,
    EFFORTS.size,
  );
  if (models.status !== "ok" || efforts.status !== "ok") return null;
  const value: Record<string, unknown> = {
    ...record,
    allowedModelIds: models.value,
    allowedReasoningEfforts: efforts.value,
  };
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
 * @returns validのProfile又は固定拒否理由付きblocked結果。
 * @precondition valueを信頼済みObjectと仮定しない。
 * @postcondition 返却値は閉じたRole、Tier、推論強度だけを持つ。
 * @effect N/A: Snapshot作成だけを行う。
 * @failure 不正候補を固定理由付きblockedで拒否する。
 * @invariant Profile設定だけでAdapterを新設しない。
 * @boundary 外部設定とProfile定義の境界。
 * @security Credential、Path、任意引数を受理しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function validateAiProfileDefinition(
  candidate: unknown,
): AiProfileValidationResult {
  const record = snapshotPlainRecord(
    candidate,
    new Set([
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
    ]),
  );
  if (!record)
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_invalid",
    });
  const roles = snapshotPlainArray(record.selectionRoles, ROLES.size);
  const tiers = snapshotPlainArray(record.modelTiers, TIERS.size);
  if (roles.status !== "ok" || tiers.status !== "ok")
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_invalid",
    });
  const value: Record<string, unknown> = {
    ...record,
    selectionRoles: roles.value,
    modelTiers: tiers.value,
  };
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
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_invalid",
    });
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
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_invalid",
    });
  return Object.freeze({
    status: "valid",
    error: null,
    value: Object.freeze({
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
    }),
  });
}

/**
 * 未信頼の設定候補を閉じたAI Profile Catalogへ変換する。
 *
 * @responsibility 未知Property、重複Identity、未登録Adapter、許可外ModelをEffect前に拒否する。
 * @trace ARCH-000010
 * @input candidate: 未信頼の設定候補。
 * @returns validのCatalog又は固定拒否理由を持つblocked結果。
 * @precondition candidateを信頼済みObjectと仮定しない。
 * @postcondition 返却CatalogのProfileは一意な登録済みAdapterと許可Modelへ結合する。
 * @effect N/A: 入力の検証とSnapshot作成だけを行う。
 * @failure 不正または曖昧な候補を固定理由付きblockedとして拒否する。
 * @invariant Secret、実行Path、任意引数を受理しない。
 * @boundary JSON等から受け取った未信頼設定とAI Adapterの境界。
 * @security 未知Propertyを黙って無視せず、Authorityを設定値から生成しない。
 * @concurrency N/A: 共有状態を持たない同期検証である。
 */
export function validateAiProfileCatalog(
  candidate: unknown,
): AiProfileCatalogValidationResult {
  const record = snapshotPlainRecord(
    candidate,
    new Set(["contract", "contractRevision", "adapters", "profiles"]),
  );
  if (!record)
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_catalog_invalid",
    });
  const adapterValues = snapshotPlainArray(
    record.adapters,
    Number.MAX_SAFE_INTEGER,
  );
  const profileValues = snapshotPlainArray(
    record.profiles,
    Number.MAX_SAFE_INTEGER,
  );
  if (adapterValues.status !== "ok" || profileValues.status !== "ok")
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_catalog_invalid",
    });
  candidate = {
    ...record,
    adapters: [...adapterValues.value],
    profiles: [...profileValues.value],
  };
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
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_catalog_invalid",
    });
  const adapters = candidate.adapters.map(parseAdapter);
  const profiles = candidate.profiles.map(
    (profile) => validateAiProfileDefinition(profile).value,
  );
  if (
    adapters.some((item) => item === null) ||
    profiles.some((item) => item === null)
  )
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_catalog_invalid",
    });
  const validAdapters = adapters as AiAdapterDefinition[];
  const validProfiles = profiles as AiProfileDefinition[];
  if (
    new Set(validAdapters.map((item) => item.adapterId)).size !==
      validAdapters.length ||
    new Set(validProfiles.map((item) => item.profileId)).size !==
      validProfiles.length
  )
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_catalog_invalid",
    });
  const adapterById = new Map(
    validAdapters.map((item) => [item.adapterId, item]),
  );
  for (const profile of validProfiles) {
    const adapter = adapterById.get(profile.adapterId);
    if (
      !adapter?.allowedModelIds.includes(profile.exactModelId) ||
      !adapter.allowedReasoningEfforts.includes(profile.defaultReasoningEffort)
    )
      return Object.freeze({
        status: "blocked",
        value: null,
        error: "ai_profile_catalog_invalid",
      });
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
        if (new Set(keys).size !== keys.length)
          return Object.freeze({
            status: "blocked",
            value: null,
            error: "ai_profile_catalog_invalid",
          });
      }
    }
  }
  return Object.freeze({
    status: "valid",
    error: null,
    value: Object.freeze({
      contract: "crdd/ai-profile-catalog",
      contractRevision: 1,
      adapters: Object.freeze(validAdapters),
      profiles: Object.freeze(validProfiles),
    }),
  });
}

/**
 * 検証済みProfile又は固定拒否理由。
 * @responsibility 成功値と固定拒否理由又は観測不能を型で区別する。
 * @trace ARCH-000010
 * @shape 状態で値と欠測を絞り込める読取り専用の直和型。
 * @invariant 型だけで認証、実行、保存又は回収の成立を主張しない。
 * @boundary AI Profile APIと直接利用側の値契約。
 * @security 秘密値、内部Path及び操作Authorityを含めない。
 * @compatibility 通信Envelopeと保存Schemaを変更せず、内部戻り値だけを移行する。
 */
export type AiProfileValidationResult = Readonly<
  | { status: "valid"; value: AiProfileDefinition; error: null }
  | { status: "blocked"; value: null; error: "ai_profile_invalid" }
>;
/**
 * 検証済みCatalog又は固定拒否理由。
 * @responsibility 成功値と固定拒否理由又は観測不能を型で区別する。
 * @trace ARCH-000010
 * @shape 状態で値と欠測を絞り込める読取り専用の直和型。
 * @invariant 型だけで認証、実行、保存又は回収の成立を主張しない。
 * @boundary AI Profile APIと直接利用側の値契約。
 * @security 秘密値、内部Path及び操作Authorityを含めない。
 * @compatibility 通信Envelopeと保存Schemaを変更せず、内部戻り値だけを移行する。
 */
export type AiProfileCatalogValidationResult = Readonly<
  | { status: "valid"; value: AiProfileCatalog; error: null }
  | { status: "blocked"; value: null; error: "ai_profile_catalog_invalid" }
>;
