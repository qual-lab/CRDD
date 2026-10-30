/**
 * Provider応答の曖昧でないJSON構文解析を所有する。
 *
 * @responsibility 重複key・不正文法・末尾データを拒否し、ProviderのEnvelope判定と分離する。
 * @trace ARCH-000015
 * @boundary 未信頼JSON文字列から構造化値への純粋解析境界。
 */
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
 * @boundary Provider共通のJSON構文解析。CLI完了・Task採否は利用側が判定する。
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
 * @boundary Provider共通のJSON構文解析。CLI完了・Task採否は利用側が判定する。
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
 * @boundary Provider共通のJSON構文解析。CLI完了・Task採否は利用側が判定する。
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
 * @boundary Provider共通のJSON構文解析。CLI完了・Task採否は利用側が判定する。
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
 * @boundary Provider共通のJSON構文解析。CLI完了・Task採否は利用側が判定する。
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
 * @boundary Provider共通のJSON構文解析。CLI完了・Task採否は利用側が判定する。
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
 * @precondition 容量制限は利用側が用途ごとに確認する。
 * @postcondition 重複key、BOM、余剰文字のある文書を返さない。
 * @effect N/A: JSON文字列と呼出し内の走査値だけを扱う。
 * @failure 空文書、構文不正、重複key、BOM、末尾データとJSON.parse失敗はnull。
 * @invariant 純粋な解析結果を実行許可・Provider成功へ読み替えない。
 * @boundary Provider共通のJSON構文解析。CLI完了・Task採否は利用側が判定する。
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
