export const CLAUDE_STRUCTURED_RESULT_CONTRACT =
  "crdd-coordinator/claude-structured-result";
export const CLAUDE_STRUCTURED_RESULT_CONTRACT_REVISION = 1;

const MAXIMUM_TURNS = 2;
const MAXIMUM_API_EQUIVALENT_COST_USD = 0.1;
const JSON_WHITESPACE = new Set([" ", "\t", "\r", "\n"]);
const HEX_DIGIT = /^[0-9a-f]$/iu;

type ScanResult = Readonly<{
  nextIndex: number;
  hasDuplicateKey: boolean;
}>;

function skipWhitespace(raw: string, startIndex: number) {
  let nextIndex = startIndex;
  while (nextIndex < raw.length && JSON_WHITESPACE.has(raw[nextIndex] ?? ""))
    nextIndex += 1;
  return nextIndex;
}

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

function scanNumber(raw: string, startIndex: number) {
  const match = raw
    .slice(startIndex)
    .match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u);
  return match ? startIndex + (match[0]?.length ?? 0) : null;
}

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

function parseUnambiguousJson(raw: string) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function ownValue(value: Record<string, unknown>, key: string) {
  return Object.hasOwn(value, key) ? value[key] : undefined;
}

function createBlockedResult() {
  return Object.freeze({
    status: "blocked" as const,
    reason: "claude_structured_result_invalid",
    normalizedResult: null,
    numberOfTurns: null,
    providerReportedApiEquivalentCostUsd: null,
  });
}

export function normalizeClaudeStructuredResult(raw: unknown) {
  if (typeof raw !== "string") return createBlockedResult();
  const envelope = parseUnambiguousJson(raw);
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
