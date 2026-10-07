/**
 * Provider出力の曖昧でないJSON構文解析を所有する。
 *
 * @packageDocumentation
 * @responsibility 重複key・不正文法・末尾データを拒否し、ProviderのEnvelope判定と分離する。
 * @trace ARCH-000015
 * @boundary 未信頼JSON文字列から構造化値への純粋解析境界。
 */
import type { ScanResult } from "./types.ts";

const JSON_WHITESPACE = new Set([" ", "\t", "\r", "\n"]);
const HEX_DIGIT = /^[0-9a-f]$/iu;

/**
 * Whitespaceを読み飛ばして次位置を返す。
 *
 * @responsibility Whitespaceの対象文字、走査上限、次位置境界を所有する。
 * @trace ARCH-000015
 * @input raw: string、startIndex: number
 * @returns skipWhitespaceの計算結果を返す。
 * @precondition 「raw: string、startIndex: number」がskipWhitespaceの入力契約を満たす。
 * @postcondition skipWhitespaceの責務を完了した結果だけを返す。
 * @effect N/A: skipWhitespaceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: skipWhitespaceは独自の失敗分岐を所有しない。
 * @invariant skipWhitespaceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: skipWhitespaceはProcess内の同一Subsystemで完結する。
 * @security skipWhitespaceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: skipWhitespaceは共有非同期状態を持たない同期処理である。
 */
function skipWhitespace(raw: string, startIndex: number) {
  let nextIndex = startIndex;
  while (nextIndex < raw.length && JSON_WHITESPACE.has(raw[nextIndex] ?? ""))
    nextIndex += 1;
  return nextIndex;
}

/**
 * Stringを構文単位として走査する。
 *
 * @responsibility Stringの走査開始点、終了点、不正文法の拒否境界を所有する。
 * @trace ARCH-000015
 * @input raw: string、startIndex: number
 * @returns scanStringの計算結果を返す。
 * @precondition 「raw: string、startIndex: number」がscanStringの入力契約を満たす。
 * @postcondition scanStringの責務を完了した結果だけを返す。
 * @effect N/A: scanStringは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: scanStringは独自の失敗分岐を所有しない。
 * @invariant scanStringは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: scanStringはProcess内の同一Subsystemで完結する。
 * @security scanStringはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: scanStringは共有非同期状態を持たない同期処理である。
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
 * Numberを構文単位として走査する。
 *
 * @responsibility Numberの走査開始点、終了点、不正文法の拒否境界を所有する。
 * @trace ARCH-000015
 * @input raw: string、startIndex: number
 * @returns scanNumberの計算結果を返す。
 * @precondition 「raw: string、startIndex: number」がscanNumberの入力契約を満たす。
 * @postcondition scanNumberの責務を完了した結果だけを返す。
 * @effect N/A: scanNumberは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: scanNumberは独自の失敗分岐を所有しない。
 * @invariant scanNumberは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: scanNumberはProcess内の同一Subsystemで完結する。
 * @security scanNumberはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: scanNumberは共有非同期状態を持たない同期処理である。
 */
function scanNumber(raw: string, startIndex: number) {
  const match = raw
    .slice(startIndex)
    .match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u);
  return match ? startIndex + (match[0]?.length ?? 0) : null;
}

/**
 * Arrayを構文単位として走査する。
 *
 * @responsibility Arrayの走査開始点、終了点、不正文法の拒否境界を所有する。
 * @trace ARCH-000015
 * @input raw: string、startIndex: number
 * @returns ScanResult | nullを返す。
 * @precondition 「raw: string、startIndex: number」がscanArrayの入力契約を満たす。
 * @postcondition scanArrayの責務を完了した結果だけを返す。
 * @effect N/A: scanArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: scanArrayは独自の失敗分岐を所有しない。
 * @invariant scanArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: scanArrayはProcess内の同一Subsystemで完結する。
 * @security scanArrayはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: scanArrayは共有非同期状態を持たない同期処理である。
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
 * Objectを構文単位として走査する。
 *
 * @responsibility Objectの走査開始点、終了点、不正文法の拒否境界を所有する。
 * @trace ARCH-000015
 * @input raw: string、startIndex: number
 * @returns ScanResult | nullを返す。
 * @precondition 「raw: string、startIndex: number」がscanObjectの入力契約を満たす。
 * @postcondition scanObjectの責務を完了した結果だけを返す。
 * @effect N/A: scanObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure scanObjectは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant scanObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: scanObjectはProcess内の同一Subsystemで完結する。
 * @security scanObjectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: scanObjectは共有非同期状態を持たない同期処理である。
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
 * Valueを構文単位として走査する。
 *
 * @responsibility Valueの走査開始点、終了点、不正文法の拒否境界を所有する。
 * @trace ARCH-000015
 * @input raw: string、startIndex: number
 * @returns ScanResult | nullを返す。
 * @precondition 「raw: string、startIndex: number」がscanValueの入力契約を満たす。
 * @postcondition scanValueの責務を完了した結果だけを返す。
 * @effect N/A: scanValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: scanValueは独自の失敗分岐を所有しない。
 * @invariant scanValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: scanValueはProcess内の同一Subsystemで完結する。
 * @security scanValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: scanValueは共有非同期状態を持たない同期処理である。
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
 * Unambiguous Json Documentを構造化値へ解析する。
 *
 * @responsibility Unambiguous Json Documentの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000015
 * @input raw: string
 * @returns parseUnambiguousJsonDocumentの計算結果を返す。
 * @precondition 「raw: string」がparseUnambiguousJsonDocumentの入力契約を満たす。
 * @postcondition parseUnambiguousJsonDocumentの責務を完了した結果だけを返す。
 * @effect N/A: parseUnambiguousJsonDocumentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseUnambiguousJsonDocumentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseUnambiguousJsonDocumentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseUnambiguousJsonDocumentはProcess内の同一Subsystemで完結する。
 * @security parseUnambiguousJsonDocumentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseUnambiguousJsonDocumentは共有非同期状態を持たない同期処理である。
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
