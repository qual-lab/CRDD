const WHITESPACE = new Set([" ", "\t", "\r", "\n"]);
const HEX = /^[0-9a-f]$/iu;
type Scan = Readonly<{ nextIndex: number; hasDuplicateKey: boolean }>;

function skip(raw: string, start: number) {
  let index = start;
  while (index < raw.length && WHITESPACE.has(raw[index] ?? "")) index += 1;
  return index;
}

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
    const escapeCharacter = raw[index + 1];
    if (!escapeCharacter || !'"\\/bfnrtu'.includes(escapeCharacter))
      return null;
    if (escapeCharacter !== "u") {
      index += 2;
      continue;
    }
    const hexadecimal = raw.slice(index + 2, index + 6);
    if (
      hexadecimal.length !== 4 ||
      ![...hexadecimal].every((value) => HEX.test(value))
    )
      return null;
    index += 6;
  }
  return null;
}

function scanArray(raw: string, start: number): Scan | null {
  let index = skip(raw, start + 1);
  let hasDuplicateKey = false;
  if (raw[index] === "]")
    return { nextIndex: index + 1, hasDuplicateKey: false };
  while (index < raw.length) {
    const value = scanValue(raw, index);
    if (!value) return null;
    hasDuplicateKey ||= value.hasDuplicateKey;
    index = skip(raw, value.nextIndex);
    if (raw[index] === "]") return { nextIndex: index + 1, hasDuplicateKey };
    if (raw[index] !== ",") return null;
    index = skip(raw, index + 1);
  }
  return null;
}

function scanObject(raw: string, start: number): Scan | null {
  const keys = new Set<string>();
  let index = skip(raw, start + 1);
  let hasDuplicateKey = false;
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
    hasDuplicateKey ||= keys.has(key);
    keys.add(key);
    index = skip(raw, keyEnd);
    if (raw[index] !== ":") return null;
    const value = scanValue(raw, skip(raw, index + 1));
    if (!value) return null;
    hasDuplicateKey ||= value.hasDuplicateKey;
    index = skip(raw, value.nextIndex);
    if (raw[index] === "}") return { nextIndex: index + 1, hasDuplicateKey };
    if (raw[index] !== ",") return null;
    index = skip(raw, index + 1);
  }
  return null;
}

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
