/**
 * 技術Catalogの閉形式・一意性と値境界を検査する。
 * @responsibility 同梱構成を不変値へ固定し、役割選択・保存・認可を所有しない。
 * @trace ARCH-000010
 */
import type { AiReasoningEffort } from "../provider/types.ts";
import type { AiModelCatalog, AiModelDefinition } from "./types.ts";
import {
  snapshotPlainRecord,
  snapshotPlainArray,
} from "../../../domain-model/src/index.ts";
const MODEL_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const EFFORTS = new Set<AiReasoningEffort>([
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

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
 * 技術カタログを閉形式の不変データへ検証する。
 * @responsibility Model組の一意性と用途・Effort・識別方式の値境界だけを検査する。
 * @trace ARCH-000010
 * @input candidate: 同梱する技術カタログの未信頼値。
 * @returns validの不変カタログ又はblockedの固定理由。
 * @precondition 技術的な対応根拠の採用判断はSource更新時に別途確認する。
 * @postcondition Getter・Proxy・旧Profile形式を読み替えず、入力とは別の不変値を返す。
 * @effect N/A: 値検査だけ。
 * @failure 未知field、不正値、重複した組を拒否する。
 * @invariant Schema妥当性を実行対応の実測や認証成功へ昇格しない。
 * @boundary Source管理のカタログと技術選定。
 * @security 任意CLI引数・Path・秘密値・役割設定を受け付けない。
 * @concurrency N/A: 局所値だけを使う同期処理。
 */
export function validateAiModelCatalog(
  candidate: unknown,
): AiModelCatalogValidationResult {
  const blocked = Object.freeze({
    status: "blocked" as const,
    value: null,
    error: "ai_model_catalog_invalid" as const,
  });
  const record = snapshotPlainRecord(
    candidate,
    new Set(["contract", "contractRevision", "models"]),
  );
  if (
    !record ||
    !hasExactKeys(record, ["contract", "contractRevision", "models"]) ||
    record.contract !== "crdd/ai-model-catalog" ||
    record.contractRevision !== 1
  )
    return blocked;
  const entries = snapshotPlainArray(record.models, Number.MAX_SAFE_INTEGER);
  if (entries.status !== "ok" || entries.value.length === 0) return blocked;
  const models: AiModelDefinition[] = [];
  const identities = new Set<string>();
  const keys = [
    "provider",
    "modelIdentifier",
    "identifierKind",
    "supportedEfforts",
    "supportedPurposes",
    "compatibilityReason",
  ];
  for (const candidateModel of entries.value) {
    const model = snapshotPlainRecord(candidateModel, new Set(keys));
    if (!model || !hasExactKeys(model, keys)) return blocked;
    const efforts = snapshotPlainArray(model.supportedEfforts, EFFORTS.size);
    const purposes = snapshotPlainArray(model.supportedPurposes, 2);
    if (
      (model.provider !== "codex" && model.provider !== "claude") ||
      typeof model.modelIdentifier !== "string" ||
      !MODEL_ID.test(model.modelIdentifier) ||
      (model.identifierKind !== "exact" && model.identifierKind !== "alias") ||
      efforts.status !== "ok" ||
      !parseStringArray(efforts.value, (item) =>
        EFFORTS.has(item as AiReasoningEffort),
      ) ||
      purposes.status !== "ok" ||
      !parseStringArray(
        purposes.value,
        (item) => item === "advice" || item === "task",
      ) ||
      (model.compatibilityReason !== null &&
        model.compatibilityReason !==
          "gpt_5_6_task_not_verified_in_current_runtime")
    )
      return blocked;
    const identity = JSON.stringify([model.provider, model.modelIdentifier]);
    if (identities.has(identity)) return blocked;
    identities.add(identity);
    models.push(
      Object.freeze({
        provider: model.provider,
        modelIdentifier: model.modelIdentifier,
        identifierKind: model.identifierKind,
        supportedEfforts: Object.freeze([
          ...efforts.value,
        ]) as readonly AiReasoningEffort[],
        supportedPurposes: Object.freeze([...purposes.value]) as readonly (
          | "advice"
          | "task"
        )[],
        compatibilityReason: model.compatibilityReason,
      }),
    );
  }
  return Object.freeze({
    status: "valid",
    error: null,
    value: Object.freeze({
      contract: "crdd/ai-model-catalog",
      contractRevision: 1,
      models: Object.freeze(models),
    }),
  });
}

/**
 * 技術カタログの検証成功と固定拒否を区別する。
 * @responsibility 未検証値を成功値として返さない。
 * @trace ARCH-000010
 * @shape statusで絞り込める閉じた結果型。
 * @invariant blockedはカタログ値を持たない。
 * @boundary カタログ検査と同梱構成の初期化。
 * @security 認証・実行許可を含めない。
 * @compatibility 新形式専用。
 */
export type AiModelCatalogValidationResult = Readonly<
  | { status: "valid"; value: AiModelCatalog; error: null }
  | { status: "blocked"; value: null; error: "ai_model_catalog_invalid" }
>;
