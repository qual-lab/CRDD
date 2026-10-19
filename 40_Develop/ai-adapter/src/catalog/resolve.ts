/**
 * 既定Catalogを初期化し、登録候補を一意に解決する。
 *
 * @responsibility 既定値を一回検証し、登録集合からのID・条件一致を解決する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 */
import type { AiProfileCatalog } from "./types.ts";
import type {
  AiProfileResolutionRequest,
  ResolvedAiProfile,
  ResolvedAiProfileIdentity,
} from "../profile/types.ts";
import defaultCatalogData from "./default-catalog.json" with { type: "json" };
import { validateAiProfileCatalog } from "./validation.ts";
export const defaultAiProfileCatalog: AiProfileCatalog = (() => {
  const catalog = validateAiProfileCatalog(defaultCatalogData).value;
  if (!catalog) throw new Error("ai_profile_default_catalog_invalid");
  return catalog;
})();

/**
 * Profile要求をCatalogから一意に解決する。
 *
 * @responsibility Provider、Family、Role、Tierの完全一致だけを実行候補へ変換する。
 * @trace ARCH-000010
 * @input catalog: 検証済みCatalog、request: Profile解決要求。
 * @returns resolvedのProfile又は未登録・曖昧・不整合を示すblocked結果。
 * @precondition catalogはvalidateAiProfileCatalogで検証済みである。
 * @postcondition 返却値はAdapterのProvider・Offering・許可Modelを含む。
 * @effect N/A: Catalog検索だけを行う。
 * @failure 未登録・複数一致・参照不整合を固定理由付きblockedで区別する。
 * @invariant 利用可能性、認証、実行Authorityを解決結果へ推測しない。
 * @boundary AI Profile設定とCoordinator等の選択利用側の境界。
 * @security Profile一致だけでProvider Effectを許可しない。
 * @concurrency N/A: 不変Catalogを読む同期処理である。
 */
export function resolveAiProfile(
  catalog: AiProfileCatalog,
  request: AiProfileResolutionRequest,
): AiProfileResolutionResult<ResolvedAiProfile> {
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
  if (matches.length !== 1)
    return Object.freeze({
      status: "blocked",
      value: null,
      error:
        matches.length === 0 ? "ai_profile_not_found" : "ai_profile_ambiguous",
    });
  const profile = matches[0];
  if (!profile)
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_reference_invalid",
    });
  const adapter = adapterById.get(profile.adapterId);
  if (!adapter)
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_reference_invalid",
    });
  return Object.freeze({
    status: "resolved",
    error: null,
    value: Object.freeze({
      ...profile,
      provider: adapter.provider,
      offering: adapter.offering,
      authorityOrigin: adapter.authorityOrigin,
      allowedReasoningEfforts: adapter.allowedReasoningEfforts,
      selectionRole: request.role,
      modelTier: request.modelTier,
    }),
  });
}

/**
 * 選択済みProfile IDを実行に必要なexact設定へ解決する。
 *
 * @responsibility 利用者が選んだ安定Profile IDを、同じCatalog Snapshot内のAdapter・Model・Reasoning設定へ結合する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input catalog: 検証済みCatalog、profileId: 選択済みProfile ID。
 * @returns resolvedのProfile Identity又は未登録・曖昧・不整合を示すblocked結果。
 * @precondition catalogはvalidateAiProfileCatalogで検証済みである。
 * @postcondition 返却値はProfileと対応Adapterの実行設定を同じSnapshotから保持する。
 * @effect N/A: Catalog検索だけを行う。
 * @failure 解決不能を既定Profileへ置換せず固定理由付きblockedを返す。
 * @invariant Catalog外のModel、ReasoningまたはAuthority Originを補完しない。
 * @boundary AI Profile設定と選択済みProfile利用側の境界。
 * @security Profile解決だけで認証またはProvider実行Authorityを発行しない。
 * @concurrency N/A: 一つの不変Catalogだけを同期参照する。
 */
export function resolveAiProfileById(
  catalog: AiProfileCatalog,
  profileId: string,
): AiProfileResolutionResult<ResolvedAiProfileIdentity> {
  const matches = catalog.profiles.filter(
    (profile) => profile.profileId === profileId,
  );
  if (matches.length !== 1)
    return Object.freeze({
      status: "blocked",
      value: null,
      error:
        matches.length === 0 ? "ai_profile_not_found" : "ai_profile_ambiguous",
    });
  const profile = matches[0];
  if (!profile)
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_reference_invalid",
    });
  const adapter = catalog.adapters.find(
    (candidate) => candidate.adapterId === profile.adapterId,
  );
  if (!adapter)
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_reference_invalid",
    });
  return Object.freeze({
    status: "resolved",
    error: null,
    value: Object.freeze({
      ...profile,
      provider: adapter.provider,
      offering: adapter.offering,
      authorityOrigin: adapter.authorityOrigin,
      allowedReasoningEfforts: adapter.allowedReasoningEfforts,
    }),
  });
}

/**
 * Profile選択の値と未登録・曖昧・不整合を区別する。
 * @responsibility 成功値と固定拒否理由又は観測不能を型で区別する。
 * @trace ARCH-000010
 * @shape 状態で値と欠測を絞り込める読取り専用の直和型。
 * @invariant 型だけで認証、実行、保存又は回収の成立を主張しない。
 * @boundary AI Profile APIと直接利用側の値契約。
 * @security 秘密値、内部Path及び操作Authorityを含めない。
 * @compatibility 通信Envelopeと保存Schemaを変更せず、内部戻り値だけを移行する。
 */
export type AiProfileResolutionResult<T = ResolvedAiProfile> = Readonly<
  | { status: "resolved"; value: T; error: null }
  | {
      status: "blocked";
      value: null;
      error:
        | "ai_profile_not_found"
        | "ai_profile_ambiguous"
        | "ai_profile_reference_invalid"
        | "ai_profile_request_invalid"
        | "ai_profile_catalog_invalid";
    }
>;
