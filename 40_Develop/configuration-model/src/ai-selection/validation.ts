/**
 * Repository別AI選択設定の共有値契約。
 * @packageDocumentation
 * @responsibility 希望設定・役割・分類と内容Identityを所有し、技術Catalogや実行を所有しない。
 * @trace ARCH-000004
 * @boundary 秘密値・実行Authorityを含めない設定データ。
 */
import { createHash } from "node:crypto";
import { types } from "node:util";
import { snapshotConfigurationRecord } from "./snapshot.ts";
import type {
  AiSelectionRole,
  AiSelectionChoice,
  AiSelectionConfig,
  AiSelectionSnapshot,
  AiSelectionCatalog,
} from "./types.ts";

/**
 * 明示選択の三項目を独立した値へ固定する。
 * @responsibility 公開入力の構造検査を現在Catalogによる用途検査から分離する。
 * @trace ARCH-000004
 * @input candidate: 未信頼のProvider・Model・Effort。
 * @returns 不変の三項目、又はnull。
 * @precondition 技術対応は新規選定時に別途検査する。
 * @postcondition 既定値・fallback・Authorityを作らない。
 * @effect N/A: 同期の値検査のみ。
 * @failure 欠落・過剰・Proxy・getter・不正文字列はnull。
 * @invariant 保存済み選定を現在Catalogで再解釈しない。
 * @boundary 公開Task／Objective入力と選定Owner。
 * @security CLI引数・Path・秘密値のfieldを受けない。
 * @concurrency 元入力の変更から分離する。
 */
export function inspectAiSelectionChoice(
  candidate: unknown,
): AiSelectionChoice | null {
  const value = snapshotConfigurationRecord(
    candidate,
    new Set(["provider", "model", "effort"]),
  );
  if (
    !value ||
    (value.provider !== "codex" && value.provider !== "claude") ||
    typeof value.model !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value.model) ||
    typeof value.effort !== "string" ||
    !["low", "medium", "high", "xhigh", "max"].includes(value.effort)
  )
    return null;
  return Object.freeze({
    provider: value.provider,
    model: value.model,
    effort: value.effort as AiSelectionChoice["effort"],
  });
}

const ROLES = Object.freeze([
  "coordinator",
  "executor",
  "independent_reviewer",
  "result_integration",
  "advice",
] as const);
const WORK_TYPE_ID = /^[a-z0-9][a-z0-9._-]*$/u;

/**
 * 任意分類の辞書を実行可能Propertyなしに取得する。
 * @responsibility Proxy判定を先に行い、通常のdata propertyだけを既存Snapshotへ渡す。
 * @trace ARCH-000004
 * @input candidate: 未信頼辞書。
 * @returns 不変の浅いSnapshot又はnull。
 * @precondition 個々の値は呼出し元で別途検証する。
 * @postcondition Getter・Proxyのhookを実行しない。
 * @effect N/A: 局所取得だけ。
 * @failure Symbol・特殊prototype・accessorは拒否する。
 * @invariant 件数や表示名文字数による独自の製品制限を加えない。
 * @boundary 任意キーを持つ設定値と閉形式検査。
 * @security Objectの継承Propertyを設定値として扱わない。
 * @concurrency N/A: 同期処理で共有可変状態なし。
 */
function snapshotEntries(
  candidate: unknown,
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      types.isProxy(candidate) ||
      Array.isArray(candidate)
    )
      return null;
    const prototype = Object.getPrototypeOf(candidate);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(candidate);
    if (keys.some((key) => typeof key !== "string")) return null;
    return snapshotConfigurationRecord(candidate, new Set(keys as string[]));
  } catch {
    return null;
  }
}

/**
 * 設定値を役割が必要とする技術用途へ照合する。
 * @responsibility 業務上の担当を既存advice／task計画の用途へ対応付ける。
 * @trace ARCH-000004
 * @input candidate: 設定値、role: 検証済み役割。
 * @returns 対応する不変選択値又はnull。
 * @precondition roleは固定五役割の一つ。
 * @postcondition Model・Effortを補完又は昇格しない。
 * @effect N/A: 純粋な技術検査だけ。
 * @failure 用途又はEffort不対応はnull。
 * @invariant 役割からTool・Filesystem権限を作らない。
 * @boundary Repository希望と技術カタログ。
 * @security ログイン状態や外部送信同意を推定しない。
 * @concurrency N/A: 不変値を同期参照する。
 */
function inspectChoice(
  candidate: unknown,
  role: AiSelectionRole,
  catalog: AiSelectionCatalog,
): AiSelectionChoice | null {
  const choice = snapshotConfigurationRecord(
    candidate,
    new Set(["provider", "model", "effort"]),
  );
  if (!choice) return null;
  const purpose =
    role === "executor" || role === "independent_reviewer" ? "task" : "advice";
  const model = catalog.models.find(
    (entry) =>
      entry.provider === choice.provider &&
      entry.modelIdentifier === choice.model,
  );
  const effort = model?.supportedEfforts.find(
    (value) => value === choice.effort,
  );
  return model && effort && model.supportedPurposes.includes(purpose)
    ? Object.freeze({
        provider: model.provider,
        model: model.modelIdentifier,
        effort,
      })
    : null;
}

/**
 * RepositoryのAI選択設定を検査し内容Identityへ固定する。
 * @responsibility 五役割・任意分類・上書きの参照と技術対応を一括検証する。
 * @trace ARCH-000004
 * @input candidate: 新形式設定の未信頼値。
 * @returns validの不変設定又はblockedの固定理由。
 * @precondition Filesystem読取りとRoot検査は設定保存Ownerが所有する。
 * @postcondition 辞書順を正規化し、同じ意味の設定から同じIdentityを導く。
 * @effect N/A: 値検査とHash計算だけ。
 * @failure 欠落・未知field・未知役割／分類・参照不整合・技術不対応を拒否する。
 * @invariant 一部分が正しいだけで設定全体を受理しない。
 * @boundary Repository設定とTask選定。
 * @security 設定値からAuthorityや実行を生成しない。
 * @concurrency N/A: 元入力を変更しない同期処理。
 */
export function validateAiSelectionConfig(
  candidate: unknown,
  catalog: AiSelectionCatalog,
): AiSelectionConfigResult {
  const blocked = Object.freeze({
    status: "blocked" as const,
    value: null,
    reason: "ai_selection_config_invalid" as const,
  });
  const record = snapshotConfigurationRecord(
    candidate,
    new Set(["contract", "revision", "roleDefaults", "workTypes", "overrides"]),
  );
  if (record?.contract !== "crdd/ai-selection" || record.revision !== 1)
    return blocked;
  const defaults = snapshotConfigurationRecord(
    record.roleDefaults,
    new Set(ROLES),
  );
  const workTypes = snapshotEntries(record.workTypes);
  const overrides = snapshotEntries(record.overrides);
  if (
    !defaults ||
    !workTypes ||
    !overrides ||
    Object.keys(overrides).some(
      (role) => !ROLES.some((value) => value === role),
    )
  )
    return blocked;
  const checkedDefaults: [AiSelectionRole, AiSelectionChoice][] = [];
  for (const role of ROLES) {
    const choice = inspectChoice(defaults[role], role, catalog);
    if (!choice) return blocked;
    checkedDefaults.push([role, choice]);
  }
  const checkedWorkTypes: [string, Readonly<{ label: string }>][] = [];
  for (const id of Object.keys(workTypes).sort()) {
    if (!WORK_TYPE_ID.test(id)) return blocked;
    const value = snapshotConfigurationRecord(
      workTypes[id],
      new Set(["label"]),
    );
    if (
      !value ||
      typeof value.label !== "string" ||
      !value.label.trim() ||
      /[\u0000-\u001f\u007f]/u.test(value.label)
    )
      return blocked;
    checkedWorkTypes.push([id, Object.freeze({ label: value.label })]);
  }
  const checkedOverrides: [
    AiSelectionRole,
    Readonly<Record<string, AiSelectionChoice>>,
  ][] = [];
  for (const role of ROLES) {
    if (!Object.hasOwn(overrides, role)) continue;
    const values = snapshotEntries(overrides[role]);
    if (!values) return blocked;
    const choices: [string, AiSelectionChoice][] = [];
    for (const id of Object.keys(values).sort()) {
      if (!Object.hasOwn(workTypes, id)) return blocked;
      const choice = inspectChoice(values[id], role, catalog);
      if (!choice) return blocked;
      choices.push([id, choice]);
    }
    checkedOverrides.push([role, Object.freeze(Object.fromEntries(choices))]);
  }
  const config: AiSelectionConfig = Object.freeze({
    contract: "crdd/ai-selection",
    revision: 1,
    roleDefaults: Object.freeze(
      Object.fromEntries(checkedDefaults),
    ) as AiSelectionConfig["roleDefaults"],
    workTypes: Object.freeze(Object.fromEntries(checkedWorkTypes)),
    overrides: Object.freeze(Object.fromEntries(checkedOverrides)),
  });
  return Object.freeze({
    status: "valid",
    reason: null,
    value: Object.freeze({
      config,
      identity: createHash("sha256")
        .update(JSON.stringify(config), "utf8")
        .digest("hex"),
    }),
  });
}

/**
 * 設定検査の成功値と固定拒否。
 * @responsibility 不正設定を空設定へ畳まない。
 * @trace ARCH-000004
 * @shape valid時だけSnapshotを持つ直和型。
 * @invariant 未設定と有効設定を同一視しない。
 * @boundary 設定Storeと検査。
 * @security 認証・実行許可なし。
 * @compatibility 新形式専用。
 */
export type AiSelectionConfigResult = Readonly<
  | { status: "valid"; value: AiSelectionSnapshot; reason: null }
  | { status: "blocked"; value: null; reason: "ai_selection_config_invalid" }
>;
