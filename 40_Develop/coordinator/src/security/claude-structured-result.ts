export const CLAUDE_STRUCTURED_RESULT_CONTRACT =
  "crdd-coordinator/claude-structured-result";
export const CLAUDE_STRUCTURED_RESULT_CONTRACT_REVISION = 1;

const MAXIMUM_TURNS = 2;
const MAXIMUM_API_EQUIVALENT_COST_USD = 0.1;
const JSON_WHITESPACE = new Set([" ", "\t", "\r", "\n"]);
const HEX_DIGIT = /^[0-9a-f]$/iu;

/**
 * ScanResultが扱う値の構造を表す。
 *
 * @responsibility ScanResultに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape ScanResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ScanResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ScanResultの宣言は外部境界を開かない。
 * @security ScanResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ScanResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ScanResult = Readonly<{
  nextIndex: number;
  hasDuplicateKey: boolean;
}>;

/**
 * skipWhitespaceの処理を実行する。
 *
 * @responsibility skipWhitespaceに対応する入力処理と結果生成を所有する。
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
 * scanStringの処理を実行する。
 *
 * @responsibility scanStringに対応する入力処理と結果生成を所有する。
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
 * scanNumberの処理を実行する。
 *
 * @responsibility scanNumberに対応する入力処理と結果生成を所有する。
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
 * scanArrayの処理を実行する。
 *
 * @responsibility scanArrayに対応する入力処理と結果生成を所有する。
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
 * scanObjectの処理を実行する。
 *
 * @responsibility scanObjectに対応する入力処理と結果生成を所有する。
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
 * scanValueの処理を実行する。
 *
 * @responsibility scanValueに対応する入力処理と結果生成を所有する。
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
 * parseUnambiguousJsonDocumentの処理を実行する。
 *
 * @responsibility parseUnambiguousJsonDocumentに対応する入力処理と結果生成を所有する。
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

/**
 * isRecordの処理を実行する。
 *
 * @responsibility isRecordに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns value is Record<string, unknown>を返す。
 * @precondition 「value: unknown」がisRecordの入力契約を満たす。
 * @postcondition isRecordの責務を完了した結果だけを返す。
 * @effect N/A: isRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isRecordは独自の失敗分岐を所有しない。
 * @invariant isRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isRecordはProcess内の同一Subsystemで完結する。
 * @security isRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isRecordは共有非同期状態を持たない同期処理である。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * ownValueの処理を実行する。
 *
 * @responsibility ownValueに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input value: Record<string, unknown>、key: string
 * @returns ownValueの計算結果を返す。
 * @precondition 「value: Record<string, unknown>、key: string」がownValueの入力契約を満たす。
 * @postcondition ownValueの責務を完了した結果だけを返す。
 * @effect N/A: ownValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownValueは独自の失敗分岐を所有しない。
 * @invariant ownValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownValueはProcess内の同一Subsystemで完結する。
 * @security ownValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownValueは共有非同期状態を持たない同期処理である。
 */
function ownValue(value: Record<string, unknown>, key: string) {
  return Object.hasOwn(value, key) ? value[key] : undefined;
}

/**
 * createBlockedResultの処理を実行する。
 *
 * @responsibility createBlockedResultに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns createBlockedResultの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateBlockedResultの入力契約を満たす。
 * @postcondition createBlockedResultの責務を完了した結果だけを返す。
 * @effect N/A: createBlockedResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createBlockedResultは独自の失敗分岐を所有しない。
 * @invariant createBlockedResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createBlockedResultはProcess内の同一Subsystemで完結する。
 * @security createBlockedResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createBlockedResultは共有非同期状態を持たない同期処理である。
 */
function createBlockedResult() {
  return Object.freeze({
    status: "blocked" as const,
    reason: "claude_structured_result_invalid",
    normalizedResult: null,
    numberOfTurns: null,
    providerReportedApiEquivalentCostUsd: null,
  });
}

/**
 * normalizeClaudeStructuredResultの処理を実行する。
 *
 * @responsibility normalizeClaudeStructuredResultに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input raw: unknown
 * @returns normalizeClaudeStructuredResultの計算結果を返す。
 * @precondition 「raw: unknown」がnormalizeClaudeStructuredResultの入力契約を満たす。
 * @postcondition normalizeClaudeStructuredResultの責務を完了した結果だけを返す。
 * @effect N/A: normalizeClaudeStructuredResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeClaudeStructuredResultは独自の失敗分岐を所有しない。
 * @invariant normalizeClaudeStructuredResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeClaudeStructuredResultはProcess内の同一Subsystemで完結する。
 * @security normalizeClaudeStructuredResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeClaudeStructuredResultは共有非同期状態を持たない同期処理である。
 */
export function normalizeClaudeStructuredResult(raw: unknown) {
  if (typeof raw !== "string") return createBlockedResult();
  const envelope = parseUnambiguousJsonDocument(raw);
  if (!isRecord(envelope)) return createBlockedResult();
  const numberOfTurns = ownValue(envelope, "num_turns");
  const providerReportedApiEquivalentCostUsd = ownValue(
    envelope,
    "total_cost_usd",
  );
  const structuredOutput = ownValue(envelope, "structured_output");
  if (
    ownValue(envelope, "type") !== "result" ||
    ownValue(envelope, "subtype") !== "success" ||
    ownValue(envelope, "is_error") !== false ||
    !Number.isInteger(numberOfTurns) ||
    typeof numberOfTurns !== "number" ||
    numberOfTurns < 1 ||
    numberOfTurns > MAXIMUM_TURNS ||
    typeof providerReportedApiEquivalentCostUsd !== "number" ||
    !Number.isFinite(providerReportedApiEquivalentCostUsd) ||
    providerReportedApiEquivalentCostUsd < 0 ||
    providerReportedApiEquivalentCostUsd > MAXIMUM_API_EQUIVALENT_COST_USD ||
    !isRecord(structuredOutput) ||
    Object.keys(structuredOutput).length !== 1 ||
    ownValue(structuredOutput, "status") !== true
  ) {
    return createBlockedResult();
  }
  return Object.freeze({
    status: "confirmed" as const,
    reason: "claude_structured_result_confirmed",
    normalizedResult: Object.freeze({ status: true as const }),
    numberOfTurns,
    providerReportedApiEquivalentCostUsd,
  });
}

/**
 * describeClaudeStructuredResultContractの処理を実行する。
 *
 * @responsibility describeClaudeStructuredResultContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeClaudeStructuredResultContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeClaudeStructuredResultContractの入力契約を満たす。
 * @postcondition describeClaudeStructuredResultContractの責務を完了した結果だけを返す。
 * @effect N/A: describeClaudeStructuredResultContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeClaudeStructuredResultContractは独自の失敗分岐を所有しない。
 * @invariant describeClaudeStructuredResultContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeClaudeStructuredResultContractはProcess内の同一Subsystemで完結する。
 * @security describeClaudeStructuredResultContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeClaudeStructuredResultContractは共有非同期状態を持たない同期処理である。
 */
export function describeClaudeStructuredResultContract() {
  return Object.freeze({
    contract: CLAUDE_STRUCTURED_RESULT_CONTRACT,
    contractRevision: CLAUDE_STRUCTURED_RESULT_CONTRACT_REVISION,
    envelope: "single_unambiguous_json_document",
    duplicateKeysAllowed: false,
    requiredEnvelopeFields: Object.freeze([
      "type=result",
      "subtype=success",
      "is_error=false",
      "num_turns=integer_1_to_2",
      "total_cost_usd=finite_0_to_0.10",
      "structured_output=exact_status_true",
    ]),
    normalizedResult: Object.freeze({ status: true }),
    rawOutputReported: false,
  });
}
