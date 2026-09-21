const WHITESPACE = new Set([" ", "\t", "\r", "\n"]);
const HEX = /^[0-9a-f]$/iu;
/**
 * Scanが扱う値の構造を表す。
 *
 * @responsibility Scanに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000012
 * @shape Scanが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Scanで宣言した値と責務の対応を維持する。
 * @boundary N/A: Scanの宣言は外部境界を開かない。
 * @security N/A: ScanはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility Scanの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Scan = Readonly<{ nextIndex: number; hasDuplicateKey: boolean }>;

/**
 * skipの処理を実行する。
 *
 * @responsibility skipに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000012
 * @input raw: string、start: number
 * @returns skipの計算結果を返す。
 * @precondition 「raw: string、start: number」がskipの入力契約を満たす。
 * @postcondition skipの責務を完了した結果だけを返す。
 * @effect N/A: skipは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: skipは独自の失敗分岐を所有しない。
 * @invariant skipは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: skipはProcess内の同一Subsystemで完結する。
 * @security N/A: skipはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: skipは共有非同期状態を持たない同期処理である。
 */
function skip(raw: string, start: number) {
  let index = start;
  while (index < raw.length && WHITESPACE.has(raw[index] ?? "")) index += 1;
  return index;
}
/**
 * scanStringの処理を実行する。
 *
 * @responsibility scanStringに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000012
 * @input raw: string、start: number
 * @returns scanStringの計算結果を返す。
 * @precondition 「raw: string、start: number」がscanStringの入力契約を満たす。
 * @postcondition scanStringの責務を完了した結果だけを返す。
 * @effect N/A: scanStringは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: scanStringは独自の失敗分岐を所有しない。
 * @invariant scanStringは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: scanStringはProcess内の同一Subsystemで完結する。
 * @security N/A: scanStringはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: scanStringは共有非同期状態を持たない同期処理である。
 */
function scanString(raw: string, start: number) {
  if (raw[start] !== '"') return null;
  let index = start + 1;
  while (index < raw.length) {
    const character = raw[index];
    if (character === '"') return index + 1;
    if (!character || character.charCodeAt(0) < 0x20) return null;
    if (character !== "\\") {
      index += 1;
      continue;
    }
    const escaped = raw[index + 1];
    if (!escaped || !'"\\/bfnrtu'.includes(escaped)) return null;
    if (escaped !== "u") {
      index += 2;
      continue;
    }
    const hexadecimal = raw.slice(index + 2, index + 6);
    if (
      hexadecimal.length !== 4 ||
      ![...hexadecimal].every((entry) => HEX.test(entry))
    )
      return null;
    index += 6;
  }
  return null;
}
/**
 * scanArrayの処理を実行する。
 *
 * @responsibility scanArrayに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000012
 * @input raw: string、start: number
 * @returns Scan | nullを返す。
 * @precondition 「raw: string、start: number」がscanArrayの入力契約を満たす。
 * @postcondition scanArrayの責務を完了した結果だけを返す。
 * @effect N/A: scanArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: scanArrayは独自の失敗分岐を所有しない。
 * @invariant scanArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: scanArrayはProcess内の同一Subsystemで完結する。
 * @security N/A: scanArrayはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: scanArrayは共有非同期状態を持たない同期処理である。
 */
function scanArray(raw: string, start: number): Scan | null {
  let index = skip(raw, start + 1);
  let hasDuplicate = false;
  if (raw[index] === "]")
    return { nextIndex: index + 1, hasDuplicateKey: false };
  while (index < raw.length) {
    const value = scanValue(raw, index);
    if (!value) return null;
    hasDuplicate ||= value.hasDuplicateKey;
    index = skip(raw, value.nextIndex);
    if (raw[index] === "]")
      return { nextIndex: index + 1, hasDuplicateKey: hasDuplicate };
    if (raw[index] !== ",") return null;
    index = skip(raw, index + 1);
  }
  return null;
}
/**
 * scanObjectの処理を実行する。
 *
 * @responsibility scanObjectに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000012
 * @input raw: string、start: number
 * @returns Scan | nullを返す。
 * @precondition 「raw: string、start: number」がscanObjectの入力契約を満たす。
 * @postcondition scanObjectの責務を完了した結果だけを返す。
 * @effect N/A: scanObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure scanObjectは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant scanObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: scanObjectはProcess内の同一Subsystemで完結する。
 * @security N/A: scanObjectはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: scanObjectは共有非同期状態を持たない同期処理である。
 */
function scanObject(raw: string, start: number): Scan | null {
  const keys = new Set<string>();
  let index = skip(raw, start + 1);
  let hasDuplicate = false;
  if (raw[index] === "}")
    return { nextIndex: index + 1, hasDuplicateKey: false };
  while (index < raw.length) {
    const keyEnd = scanString(raw, index);
    if (keyEnd === null) return null;
    let key: string;
    try {
      key = JSON.parse(raw.slice(index, keyEnd)) as string;
    } catch {
      return null;
    }
    hasDuplicate ||= keys.has(key);
    keys.add(key);
    index = skip(raw, keyEnd);
    if (raw[index] !== ":") return null;
    const value = scanValue(raw, skip(raw, index + 1));
    if (!value) return null;
    hasDuplicate ||= value.hasDuplicateKey;
    index = skip(raw, value.nextIndex);
    if (raw[index] === "}")
      return { nextIndex: index + 1, hasDuplicateKey: hasDuplicate };
    if (raw[index] !== ",") return null;
    index = skip(raw, index + 1);
  }
  return null;
}
/**
 * scanValueの処理を実行する。
 *
 * @responsibility scanValueに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000012
 * @input raw: string、start: number
 * @returns Scan | nullを返す。
 * @precondition 「raw: string、start: number」がscanValueの入力契約を満たす。
 * @postcondition scanValueの責務を完了した結果だけを返す。
 * @effect N/A: scanValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: scanValueは独自の失敗分岐を所有しない。
 * @invariant scanValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: scanValueはProcess内の同一Subsystemで完結する。
 * @security N/A: scanValueはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: scanValueは共有非同期状態を持たない同期処理である。
 */
function scanValue(raw: string, start: number): Scan | null {
  const index = skip(raw, start);
  if (raw[index] === "{") return scanObject(raw, index);
  if (raw[index] === "[") return scanArray(raw, index);
  if (raw[index] === '"') {
    const end = scanString(raw, index);
    return end === null ? null : { nextIndex: end, hasDuplicateKey: false };
  }
  for (const literal of ["true", "false", "null"])
    if (raw.startsWith(literal, index))
      return { nextIndex: index + literal.length, hasDuplicateKey: false };
  const number = raw
    .slice(index)
    .match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u);
  return number
    ? { nextIndex: index + (number[0]?.length ?? 0), hasDuplicateKey: false }
    : null;
}
/**
 * parseUnambiguousJsonDocumentの処理を実行する。
 *
 * @responsibility parseUnambiguousJsonDocumentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000012
 * @input raw: string
 * @returns parseUnambiguousJsonDocumentの計算結果を返す。
 * @precondition 「raw: string」がparseUnambiguousJsonDocumentの入力契約を満たす。
 * @postcondition parseUnambiguousJsonDocumentの責務を完了した結果だけを返す。
 * @effect N/A: parseUnambiguousJsonDocumentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseUnambiguousJsonDocumentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseUnambiguousJsonDocumentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseUnambiguousJsonDocumentはProcess内の同一Subsystemで完結する。
 * @security N/A: parseUnambiguousJsonDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseUnambiguousJsonDocumentは共有非同期状態を持たない同期処理である。
 */
export function parseUnambiguousJsonDocument(raw: string) {
  if (raw.length === 0 || raw.charCodeAt(0) === 0xfeff) return null;
  const scanned = scanValue(raw, 0);
  if (
    !scanned ||
    scanned.hasDuplicateKey ||
    skip(raw, scanned.nextIndex) !== raw.length
  )
    return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
