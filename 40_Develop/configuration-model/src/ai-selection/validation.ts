/**
 * Repository別AI選択設定の入力検査とJSON解析。
 * @packageDocumentation
 * @responsibility 希望設定・役割・分類と内容Identityを所有し、技術Catalogや実行を所有しない。
 * @trace ARCH-000004
 * @boundary 秘密値・実行Authorityを含めない設定データ。
 */
import { createHash } from "node:crypto";
import { types } from "node:util";
import type {
  AiSelectionRole,
  AiSelectionChoice,
  AiSelectionConfig,
  AiSelectionCatalog,
  AiSelectionConfigResult,
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

/** 元設定の後発変更から独立した浅い値を作る。 */
export function snapshotConfigurationRecord<const K extends string>(
  value: unknown,
  allowedKeys: ReadonlySet<K>,
): Readonly<Record<K, unknown>> | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      types.isProxy(value) ||
      Array.isArray(value)
    )
      return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length !== allowedKeys.size ||
      keys.some((key) => typeof key !== "string" || !allowedKeys.has(key as K))
    )
      return null;
    const snapshot = Object.create(null) as Record<K, unknown>;
    for (const key of allowedKeys) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      )
        return null;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

/**
 * JSON走査の次位置とnested重複keyの検出結果を保持する。
 *
 * @responsibility 再帰した値の走査位置と重複key有無を親走査へ返す。
 * @trace ARCH-000015
 * @shape nextIndexは消費した値の直後、hasDuplicateKeyは子孫を含む重複keyの有無。
 * @invariant 重複検出を上位へ伝播し、構文不正は本型でなくnullで返す。
 * @boundary JSON parser内の再帰走査だけで共有する非公開型。
 * @security 生文字列・key一覧・実行権限を結果へ含めない。
 * @compatibility 公開APIではなく、同じparser内の走査呼出しで利用する。
 */
type ScanResult = Readonly<{
  nextIndex: number;
  hasDuplicateKey: boolean;
}>;

const JSON_WHITESPACE = new Set([" ", "\t", "\r", "\n"]);
const HEX_DIGIT = /^[0-9a-f]$/iu;

/**
 * JSONで許可する空白だけを読み飛ばす。
 *
 * @responsibility 空白集合と走査位置の更新を所有する。
 * @trace ARCH-000015
 * @input rawと走査開始位置。
 * @returns 空白列直後の位置。末尾ならraw.length。
 * @precondition 開始位置は呼出し側のJSON走査位置である。
 * @postcondition 空白以外の最初の文字を消費しない。
 * @effect N/A: JSON文字列と呼出し内の走査値だけを扱う。
 * @failure N/A: 対象外文字は次の構文走査へ残す。
 * @invariant 空白集合をJSON仕様の4文字から拡張しない。
 * @boundary 構成モデル内部のJSON構文解析。CLI完了・Task採否は利用側が判定する。
 * @security 生本文、認証情報やAuthorityを外部へ公開しない。
 * @concurrency N/A: 呼出しごとの同期走査で共有状態と資源を持たない。
 */
function skipWhitespace(raw: string, startIndex: number) {
  let nextIndex = startIndex;
  while (nextIndex < raw.length && JSON_WHITESPACE.has(raw[nextIndex] ?? ""))
    nextIndex += 1;
  return nextIndex;
}

/**
 * JSON文字列の終端とescape構文を走査する。
 *
 * @responsibility 引用符、制御文字、escapeとUnicode escapeの境界を検査する。
 * @trace ARCH-000015
 * @input rawと開始引用符の位置。
 * @returns 閉じ引用符の直後の位置、又は不正・未完了のnull。
 * @precondition 開始位置は文字列候補の先頭である。
 * @postcondition 成功時だけ閉じ引用符までを消費する。
 * @effect N/A: JSON文字列と呼出し内の走査値だけを扱う。
 * @failure 開始引用符なし、制御文字、不正escape、未終端はnull。
 * @invariant 本文を復号・保存せず走査位置だけを返す。
 * @boundary 構成モデル内部のJSON構文解析。CLI完了・Task採否は利用側が判定する。
 * @security 生本文、認証情報やAuthorityを外部へ公開しない。
 * @concurrency N/A: 呼出しごとの同期走査で共有状態と資源を持たない。
 */
function scanString(raw: string, startIndex: number) {
  if (raw[startIndex] !== '"') return null;
  let nextIndex = startIndex + 1;
  while (nextIndex < raw.length) {
    const character = raw[nextIndex];
    if (character === '"') return nextIndex + 1;
    if (!character || character.charCodeAt(0) < 0x20) return null;
    if (character !== "\\") {
      nextIndex += 1;
      continue;
    }
    const escapeCharacter = raw[nextIndex + 1];
    if (!escapeCharacter || !'"\\/bfnrtu'.includes(escapeCharacter))
      return null;
    if (escapeCharacter !== "u") {
      nextIndex += 2;
      continue;
    }
    const hexadecimal = raw.slice(nextIndex + 2, nextIndex + 6);
    if (
      hexadecimal.length !== 4 ||
      ![...hexadecimal].every((value) => HEX_DIGIT.test(value))
    )
      return null;
    nextIndex += 6;
  }
  return null;
}

/**
 * JSON数値の構文に一致するprefixを走査する。
 *
 * @responsibility 符号・整数・小数・指数の字句境界を検査する。
 * @trace ARCH-000015
 * @input rawと数値候補の開始位置。
 * @returns 数値prefixの直後の位置、又は不一致のnull。
 * @precondition 親走査が後続の区切り又は文書末尾を検証する。
 * @postcondition 数値の後続文字を受理したとは主張しない。
 * @effect N/A: JSON文字列と呼出し内の走査値だけを扱う。
 * @failure 先頭から数値構文へ一致しない場合はnull。
 * @invariant 値への変換や有限性の業務判断を行わない。
 * @boundary 構成モデル内部のJSON構文解析。CLI完了・Task採否は利用側が判定する。
 * @security 生本文、認証情報やAuthorityを外部へ公開しない。
 * @concurrency N/A: 呼出しごとの同期走査で共有状態と資源を持たない。
 */
function scanNumber(raw: string, startIndex: number) {
  const match = raw
    .slice(startIndex)
    .match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u);
  return match ? startIndex + (match[0]?.length ?? 0) : null;
}

/**
 * JSON配列を再帰走査しnested重複keyを伝播する。
 *
 * @responsibility 要素間の区切り、終端と重複key検出結果の集約を所有する。
 * @trace ARCH-000015
 * @input rawと配列開始位置。
 * @returns 配列の次位置と重複key有無、又は不正のnull。
 * @precondition 呼出し元が開始文字を配列と判定している。
 * @postcondition 成功時は閉じ括弧の直後を返す。
 * @effect N/A: JSON文字列と呼出し内の走査値だけを扱う。
 * @failure 要素・区切り・終端の不正又は欠落はnull。
 * @invariant nested objectの重複keyを成功結果へ隠さない。
 * @boundary 構成モデル内部のJSON構文解析。CLI完了・Task採否は利用側が判定する。
 * @security 生本文、認証情報やAuthorityを外部へ公開しない。
 * @concurrency N/A: 呼出しごとの同期走査で共有状態と資源を持たない。
 */
function scanArray(raw: string, startIndex: number): ScanResult | null {
  let nextIndex = skipWhitespace(raw, startIndex + 1);
  let hasDuplicateKey = false;
  if (raw[nextIndex] === "]")
    return Object.freeze({ nextIndex: nextIndex + 1, hasDuplicateKey });
  while (nextIndex < raw.length) {
    const scanned = scanValue(raw, nextIndex);
    if (!scanned) return null;
    hasDuplicateKey ||= scanned.hasDuplicateKey;
    nextIndex = skipWhitespace(raw, scanned.nextIndex);
    if (raw[nextIndex] === "]")
      return Object.freeze({ nextIndex: nextIndex + 1, hasDuplicateKey });
    if (raw[nextIndex] !== ",") return null;
    nextIndex = skipWhitespace(raw, nextIndex + 1);
  }
  return null;
}

/**
 * JSON objectを走査し復号したkeyの重複を検出する。
 *
 * @responsibility keyの復号、key/value区切りとnested重複の伝播を所有する。
 * @trace ARCH-000015
 * @input rawとobject開始位置。
 * @returns objectの次位置と重複key有無、又は不正のnull。
 * @precondition 呼出し元が開始文字をobjectと判定している。
 * @postcondition 同じ復号keyをescape表記の差で別keyとしない。
 * @effect N/A: JSON文字列と呼出し内の走査値だけを扱う。
 * @failure key復号、colon、値、区切り又は終端の不正はnull。
 * @invariant key集合は一つのobjectだけに閉じる。
 * @boundary 構成モデル内部のJSON構文解析。CLI完了・Task採否は利用側が判定する。
 * @security 生本文、認証情報やAuthorityを外部へ公開しない。
 * @concurrency N/A: 呼出しごとの同期走査で共有状態と資源を持たない。
 */
function scanObject(raw: string, startIndex: number): ScanResult | null {
  const keys = new Set<string>();
  let nextIndex = skipWhitespace(raw, startIndex + 1);
  let hasDuplicateKey = false;
  if (raw[nextIndex] === "}")
    return Object.freeze({ nextIndex: nextIndex + 1, hasDuplicateKey });
  while (nextIndex < raw.length) {
    const keyEnd = scanString(raw, nextIndex);
    if (keyEnd === null) return null;
    let key: string;
    try {
      key = JSON.parse(raw.slice(nextIndex, keyEnd)) as string;
    } catch {
      return null;
    }
    if (keys.has(key)) hasDuplicateKey = true;
    keys.add(key);
    nextIndex = skipWhitespace(raw, keyEnd);
    if (raw[nextIndex] !== ":") return null;
    const scanned = scanValue(raw, skipWhitespace(raw, nextIndex + 1));
    if (!scanned) return null;
    hasDuplicateKey ||= scanned.hasDuplicateKey;
    nextIndex = skipWhitespace(raw, scanned.nextIndex);
    if (raw[nextIndex] === "}")
      return Object.freeze({ nextIndex: nextIndex + 1, hasDuplicateKey });
    if (raw[nextIndex] !== ",") return null;
    nextIndex = skipWhitespace(raw, nextIndex + 1);
  }
  return null;
}

/**
 * JSON値の先頭文字から対応する字句走査へ分岐する。
 *
 * @responsibility object・配列・文字列・literal・数値の走査結果を統一する。
 * @trace ARCH-000015
 * @input rawと値候補の走査開始位置。
 * @returns 値の次位置と重複key有無、又は不正のnull。
 * @precondition 文書全体の末尾判定は公開parserが所有する。
 * @postcondition 先行空白だけを読み飛ばし一つの値を走査する。
 * @effect N/A: JSON文字列と呼出し内の走査値だけを扱う。
 * @failure 対応しない字句又は下位走査の不正はnull。
 * @invariant 部分値の成功を文書全体の受理に昇格しない。
 * @boundary 構成モデル内部のJSON構文解析。CLI完了・Task採否は利用側が判定する。
 * @security 生本文、認証情報やAuthorityを外部へ公開しない。
 * @concurrency N/A: 呼出しごとの同期走査で共有状態と資源を持たない。
 */
function scanValue(raw: string, startIndex: number): ScanResult | null {
  const nextIndex = skipWhitespace(raw, startIndex);
  const character = raw[nextIndex];
  if (character === "{") return scanObject(raw, nextIndex);
  if (character === "[") return scanArray(raw, nextIndex);
  if (character === '"') {
    const stringEnd = scanString(raw, nextIndex);
    return stringEnd === null
      ? null
      : Object.freeze({ nextIndex: stringEnd, hasDuplicateKey: false });
  }
  for (const literal of ["true", "false", "null"]) {
    if (raw.startsWith(literal, nextIndex))
      return Object.freeze({
        nextIndex: nextIndex + literal.length,
        hasDuplicateKey: false,
      });
  }
  const numberEnd = scanNumber(raw, nextIndex);
  return numberEnd === null
    ? null
    : Object.freeze({ nextIndex: numberEnd, hasDuplicateKey: false });
}

/**
 * 重複keyと余剰文字のないJSON文書だけを構造化する。
 *
 * @responsibility 事前走査とJSON.parseを接続し曖昧な文書を拒否する。
 * @trace ARCH-000015
 * @input 未信頼のJSON文字列raw。
 * @returns 構造化値、又は不正のnull。JSON literal nullもnullとなる。
 * @precondition 入力は設定保存Ownerが読み取ったJSON本文である。
 * @postcondition 重複key、BOM、余剰文字のある文書を返さない。
 * @effect N/A: JSON文字列と呼出し内の走査値だけを扱う。
 * @failure 空文書、構文不正、重複key、BOM、末尾データとJSON.parse失敗はnull。
 * @invariant 純粋な解析結果を実行許可・Provider成功へ読み替えない。
 * @boundary 構成モデル内部のJSON構文解析。CLI完了・Task採否は利用側が判定する。
 * @security 生本文、認証情報やAuthorityを外部へ公開しない。
 * @concurrency N/A: 呼出しごとの同期走査で共有状態と資源を持たない。
 */
export function parseUnambiguousJsonDocument(raw: string) {
  if (raw.length === 0 || raw.charCodeAt(0) === 0xfeff) return null;
  const scanned = scanValue(raw, 0);
  if (
    !scanned ||
    scanned.hasDuplicateKey ||
    skipWhitespace(raw, scanned.nextIndex) !== raw.length
  ) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
