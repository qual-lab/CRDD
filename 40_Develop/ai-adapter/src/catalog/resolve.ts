/**
 * 既定Catalogを初期化し、登録候補を一意に解決する。
 *
 * @responsibility 既定値を一回検証し、登録集合からのID・条件一致を解決する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 */
import type { AiProfileCatalog } from "./types.ts";
import type { AiModelCatalog, AiModelSelection } from "./types.ts";
import { createHash } from "node:crypto";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
import modelCatalogData from "./model-catalog.json" with { type: "json" };
import type {
  AiProfileResolutionRequest,
  ResolvedAiProfile,
  ResolvedAiProfileIdentity,
} from "../profile/types.ts";
import defaultCatalogData from "./default-catalog.json" with { type: "json" };
import {
  validateAiProfileCatalog,
  validateAiModelCatalog,
} from "./validation.ts";
export const defaultAiProfileCatalog: AiProfileCatalog = (() => {
  const catalog = validateAiProfileCatalog(defaultCatalogData).value;
  if (!catalog) throw new Error("ai_profile_default_catalog_invalid");
  return catalog;
})();

const modelCatalogSnapshot: AiModelCatalogSnapshot = (() => {
  const result = validateAiModelCatalog(modelCatalogData);
  if (result.status !== "valid")
    throw new Error("ai_model_default_catalog_invalid");
  return Object.freeze({
    catalog: result.value,
    identity: createHash("sha256")
      .update(JSON.stringify(result.value), "utf8")
      .digest("hex"),
  });
})();

/**
 * 同梱する技術カタログと内容Identityを返す。
 * @responsibility 選択可能な技術構成を一つの不変Snapshotとして提供する。
 * @trace ARCH-000010
 * @input N/A: Repository設定や認証値を受けない。
 * @returns カタログ本文と正規化した本文のSHA-256。
 * @precondition 同梱カタログはModule初期化時に検証済み。
 * @postcondition 生JSONや変更可能な配列を公開しない。
 * @effect N/A: 不変値の取得だけ。
 * @failure 不正な同梱構成はModule初期化時に停止する。
 * @invariant Model追加でRepositoryの選択設定を書き換えない。
 * @boundary 技術Catalogと選択UI／Coordinator。
 * @security Identityは完全性の相関値であり署名や実行Authorityではない。
 * @concurrency N/A: 共有可変状態なし。
 */
export function getAiModelCatalog(): AiModelCatalogSnapshot {
  return modelCatalogSnapshot;
}

/**
 * 一つのModel・用途・Effortを同梱カタログから解決する。
 * @responsibility 技術対応をexact照合し、役割・推奨・fallbackを決めない。
 * @trace ARCH-000010
 * @input candidate: provider、modelIdentifier、reasoningEffort、purposeだけの要求。
 * @returns resolvedの技術選定値又はblockedの固定理由。
 * @precondition 役割と作業分類の優先順位はCoordinatorが解決する。
 * @postcondition 識別子・Effort・用途を補正せず、同じカタログIdentityへ固定する。
 * @effect N/A: 同梱不変データとの値照合だけ。
 * @failure 不正要求・未登録・用途不対応・Effort不対応を区別する。
 * @invariant callerからカタログや別の既定Modelを注入できない。
 * @boundary Repository選択設定とProvider計画。
 * @security 対応一致だけで認証・外部送信・実行を許可しない。
 * @concurrency N/A: 不変Snapshotを同期参照する。
 */
export function resolveAiModelSelection(
  candidate: unknown,
): AiModelSelectionResult {
  const request = snapshotPlainRecord(
    candidate,
    new Set(["provider", "modelIdentifier", "reasoningEffort", "purpose"]),
  );
  if (
    !request ||
    (request.provider !== "codex" && request.provider !== "claude") ||
    typeof request.modelIdentifier !== "string" ||
    typeof request.reasoningEffort !== "string" ||
    (request.purpose !== "advice" && request.purpose !== "task")
  ) {
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_model_selection_invalid",
    });
  }
  const model = modelCatalogSnapshot.catalog.models.find(
    (entry) =>
      entry.provider === request.provider &&
      entry.modelIdentifier === request.modelIdentifier,
  );
  if (!model)
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_model_not_found",
    });
  if (!model.supportedPurposes.includes(request.purpose))
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_model_purpose_unsupported",
    });
  const effort = model.supportedEfforts.find(
    (value) => value === request.reasoningEffort,
  );
  if (!effort)
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_model_effort_unsupported",
    });
  return Object.freeze({
    status: "resolved",
    error: null,
    value: Object.freeze({
      provider: model.provider,
      modelIdentifier: model.modelIdentifier,
      identifierKind: model.identifierKind,
      reasoningEffort: effort,
      purpose: request.purpose,
      catalogIdentity: modelCatalogSnapshot.identity,
    }),
  });
}

/**
 * 同じ技術改訂を相関できる不変カタログを表す。
 * @responsibility 本文と内容Hashを一緒に提供する。
 * @trace ARCH-000010
 * @shape 検証済み本文とSHA-256。
 * @invariant Identityだけを認証済み配布元の証明にしない。
 * @boundary 技術定義とRepository設定の検証。
 * @security Path・秘密値・実行権限なし。
 * @compatibility 新形式専用。
 */
export type AiModelCatalogSnapshot = Readonly<{
  catalog: AiModelCatalog;
  identity: string;
}>;

/**
 * 技術選定の成功と拒否を区別する。
 * @responsibility 選択した値とカタログIdentityを同じ結果へ固定する。
 * @trace ARCH-000010
 * @shape resolved時だけ技術選定値を持つ直和型。
 * @invariant 拒否時に代替Modelを返さない。
 * @boundary 技術ResolverとCoordinator。
 * @security Authority・認証情報を含めない。
 * @compatibility aliasをexactへ変換しない新契約。
 */
export type AiModelSelectionResult = Readonly<
  | {
      status: "resolved";
      value: AiModelSelection & Readonly<{ catalogIdentity: string }>;
      error: null;
    }
  | {
      status: "blocked";
      value: null;
      error:
        | "ai_model_selection_invalid"
        | "ai_model_not_found"
        | "ai_model_purpose_unsupported"
        | "ai_model_effort_unsupported";
    }
>;

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
