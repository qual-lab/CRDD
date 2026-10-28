/**
 * Repository別AI選択設定の共有値契約。
 * @packageDocumentation
 * @responsibility 希望設定・役割・分類と内容Identityを所有し、技術Catalogや実行を所有しない。
 * @trace ARCH-000004
 * @boundary 秘密値・実行Authorityを含めない設定データ。
 */
import type { ExecutionSelection } from "./types.ts";
import type { TaskExecutionSelections } from "./types.ts";
import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import { snapshotPlainRecord } from "../plain-data/snapshot.ts";
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
  const value = snapshotPlainRecord(
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

/**
 * 完全な選定値の非Authority Identityを導く。
 * @responsibility Providerだけでなく選定元・当時の構成まで同じ相関へ含める。
 * @trace ARCH-000004
 * @input candidate: 十項目の選定候補。
 * @returns 正規化した選定のSHA-256、不正時null。
 * @precondition Hash自体で実行を許可しない。
 * @postcondition alias種別・設定Identity・役割・分類の差は別Hashになる。
 * @effect N/A: 局所検査と決定論的Hashだけ。
 * @failure 閉形式を満たさない値はnull。
 * @invariant 現在Catalogや設定を読まない。
 * @boundary Packet・Grant・保存選定の値相関。
 * @security Hashを資格や操作Capabilityにしない。
 * @concurrency 元値から独立したSnapshotだけをHash化する。
 */
export function hashExecutionSelection(candidate: unknown): string | null {
  const value = inspectExecutionSelection(candidate);
  return value
    ? createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex")
    : null;
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
      utilTypes.isProxy(candidate) ||
      Array.isArray(candidate)
    )
      return null;
    const prototype = Object.getPrototypeOf(candidate);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(candidate);
    if (keys.some((key) => typeof key !== "string")) return null;
    return snapshotPlainRecord(candidate, new Set(keys as string[]));
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
  const choice = snapshotPlainRecord(
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
 * @precondition Filesystem読取りのbyte上限とRoot検査は保存Ownerが所有する。
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
  const record = snapshotPlainRecord(
    candidate,
    new Set(["contract", "revision", "roleDefaults", "workTypes", "overrides"]),
  );
  if (record?.contract !== "crdd/ai-selection" || record.revision !== 1)
    return blocked;
  const defaults = snapshotPlainRecord(record.roleDefaults, new Set(ROLES));
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
    const value = snapshotPlainRecord(workTypes[id], new Set(["label"]));
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

/**
 * 保存された選定を現在Catalogで解き直さず独立値へ取り出す。
 * @responsibility 選定の十項目と相関だけを閉じて検査する。
 * @trace ARCH-000004
 * @input candidate: 保存済み又は搬送された未信頼選定。
 * @returns 不変な選定値、又はnull。
 * @precondition 新規実行の技術可否は別の技術Catalog検査を通す。
 * @postcondition alias・選定元・当時の内容Identityをそのまま保持する。
 * @effect N/A: 同期的な値検査と独立Objectの構築だけ。
 * @failure 不足・過剰・実行Property・相関不正はnull。
 * @invariant 復元成功は現在の実行許可や利用可能性を意味しない。
 * @boundary 保存選定とTask／Packetの値搬送。
 * @security Proxy・Getterを実行せず、Authorityを生成しない。
 * @concurrency 一度捕捉したdata descriptorの値だけを使用する。
 */
export function inspectExecutionSelection(
  candidate: unknown,
): ExecutionSelection | null {
  try {
    if (
      candidate === null ||
      typeof candidate !== "object" ||
      utilTypes.isProxy(candidate)
    )
      return null;
    const prototype = Object.getPrototypeOf(candidate);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(candidate);
    const keys = [
      "provider",
      "modelIdentifier",
      "identifierKind",
      "reasoningEffort",
      "purpose",
      "catalogIdentity",
      "configIdentity",
      "role",
      "workType",
      "source",
    ] as const;
    const actual = Reflect.ownKeys(descriptors);
    if (
      actual.length !== keys.length ||
      actual.some(
        (key) =>
          typeof key !== "string" || !keys.some((expected) => expected === key),
      )
    )
      return null;
    const value: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        descriptor.enumerable !== true ||
        Object.hasOwn(descriptor, "get") ||
        Object.hasOwn(descriptor, "set")
      )
        return null;
      value[key] = descriptor.value;
    }
    if (
      (value.provider !== "codex" && value.provider !== "claude") ||
      typeof value.modelIdentifier !== "string" ||
      !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value.modelIdentifier) ||
      (value.identifierKind !== "exact" && value.identifierKind !== "alias") ||
      typeof value.reasoningEffort !== "string" ||
      !["low", "medium", "high", "xhigh", "max"].includes(
        value.reasoningEffort,
      ) ||
      (value.purpose !== "advice" && value.purpose !== "task") ||
      typeof value.catalogIdentity !== "string" ||
      !/^[a-f0-9]{64}$/u.test(value.catalogIdentity) ||
      typeof value.configIdentity !== "string" ||
      !/^[a-f0-9]{64}$/u.test(value.configIdentity) ||
      typeof value.role !== "string" ||
      ![
        "coordinator",
        "executor",
        "independent_reviewer",
        "result_integration",
        "advice",
      ].includes(value.role) ||
      !(
        value.workType === null ||
        (typeof value.workType === "string" &&
          /^[a-z0-9][a-z0-9._-]*$/u.test(value.workType))
      ) ||
      typeof value.source !== "string" ||
      !["explicit", "work_type_override", "role_default"].includes(
        value.source,
      ) ||
      (value.source === "work_type_override" && value.workType === null) ||
      value.purpose !==
        (["executor", "independent_reviewer"].includes(value.role)
          ? "task"
          : "advice")
    )
      return null;
    return Object.freeze({ ...value }) as ExecutionSelection;
  } catch {
    return null;
  }
}

/**
 * 保存済みの役割別選定を現在設定で解き直さず検査する。
 * @responsibility stage間で選定組を混ぜない閉形式codecを所有する。
 * @trace ARCH-000004
 * @input candidate: 未信頼の二役割選定。
 * @returns 独立した不変値、不正時null。
 * @precondition 実行可否と認可は別のOwnerが確認する。
 * @postcondition 元のModel・alias・分類・選定元を維持する。
 * @effect N/A: 局所値検査だけ。
 * @failure 不足・過剰・Proxy・accessor・相関不正はnull。
 * @invariant 現在Catalog・設定Store・I/Oを参照しない。
 * @boundary 保存codecと実行Owner。
 * @security 選定の復元を実行許可にしない。
 * @concurrency 同期処理で元入力へ書き込まない。
 */
export function inspectTaskExecutionSelections(
  candidate: unknown,
): TaskExecutionSelections | null {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    utilTypes.isProxy(candidate)
  )
    return null;
  const prototype = Object.getPrototypeOf(candidate);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(candidate);
  if (Reflect.ownKeys(descriptors).length !== 2) return null;
  const values = ["executor", "reviewer"].map((key) => {
    const descriptor = descriptors[key];
    return descriptor && "value" in descriptor && descriptor.enumerable
      ? inspectExecutionSelection(descriptor.value)
      : null;
  });
  const [executor, reviewer] = values;
  if (
    !executor ||
    !reviewer ||
    executor.role !== "executor" ||
    reviewer.role !== "independent_reviewer" ||
    reviewer.source === "explicit" ||
    executor.configIdentity !== reviewer.configIdentity ||
    executor.catalogIdentity !== reviewer.catalogIdentity ||
    executor.workType !== reviewer.workType
  )
    return null;
  return Object.freeze({ executor, reviewer });
}
