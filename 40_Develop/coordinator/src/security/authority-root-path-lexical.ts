import path from "node:path";

export const AUTHORITY_ROOT_ABSOLUTE_PATH_MAX_BYTES = 4_096;

const WINDOWS_RESERVED_BASENAME =
  /^(?:CON|PRN|AUX|NUL|CLOCK\$|CONIN\$|CONOUT\$|COM[1-9\u00b9\u00b2\u00b3]|LPT[1-9\u00b9\u00b2\u00b3])$/u;
const RESERVED_NAME_SPECIAL_UPPERCASE_MAPPINGS = Object.freeze([
  Object.freeze(["ß", "SS"] as const),
  Object.freeze(["ı", "I"] as const),
  Object.freeze(["ſ", "S"] as const),
  Object.freeze(["K", "K"] as const),
  Object.freeze(["ﬀ", "FF"] as const),
  Object.freeze(["ﬁ", "FI"] as const),
  Object.freeze(["ﬂ", "FL"] as const),
  Object.freeze(["ﬃ", "FFI"] as const),
  Object.freeze(["ﬄ", "FFL"] as const),
  Object.freeze(["ﬅ", "ST"] as const),
  Object.freeze(["ﬆ", "ST"] as const),
]);
const reservedNameSpecialUppercaseMapping = new Map<string, string>(
  RESERVED_NAME_SPECIAL_UPPERCASE_MAPPINGS,
);

function reservedNameLimitedUppercase(value: string) {
  let normalized = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && codePoint >= 0x61 && codePoint <= 0x7a) {
      normalized += String.fromCodePoint(codePoint - 0x20);
      continue;
    }
    normalized +=
      reservedNameSpecialUppercaseMapping.get(character) ?? character;
  }
  return normalized;
}

function hasSupportedCommonPathBytes(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !/[\uD800-\uDFFF]/u.test(value) &&
    Buffer.byteLength(value, "utf8") <=
      AUTHORITY_ROOT_ABSOLUTE_PATH_MAX_BYTES &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

export function isSupportedWindowsAbsolutePathCandidate(
  value: unknown,
): value is string {
  if (
    !hasSupportedCommonPathBytes(value) ||
    !/^[A-Z]:\\/u.test(value) ||
    value.includes("/") ||
    path.win32.normalize(value) !== value
  )
    return false;
  const root = path.win32.parse(value).root;
  if (value === root) return true;
  if (value.endsWith("\\")) return false;
  const segments = value.slice(root.length).split("\\");
  return segments.every((segment) => {
    if (
      segment.length === 0 ||
      segment === "." ||
      segment === ".." ||
      /[<>:"|?*]/u.test(segment) ||
      /[. ]$/u.test(segment)
    )
      return false;
    const basenameCandidate = segment.split(".", 1)[0];
    if (basenameCandidate === undefined) return false;
    const basename = reservedNameLimitedUppercase(
      basenameCandidate.replace(/[. ]+$/u, ""),
    );
    return !WINDOWS_RESERVED_BASENAME.test(basename);
  });
}

export function describeAuthorityRootPathLexicalContract() {
  return Object.freeze({
    windowsReservedNameComparison: "repository_owned_limited_uppercase_mapping",
    asciiLowercaseMappings: Object.freeze(
      Array.from({ length: 26 }, (unusedValue, index) => {
        void unusedValue;
        return Object.freeze([
          String.fromCodePoint(0x61 + index),
          String.fromCodePoint(0x41 + index),
        ] as const);
      }),
    ),
    specialMappings: RESERVED_NAME_SPECIAL_UPPERCASE_MAPPINGS,
    unicodeNormalizationApplied: false,
    illFormedUtf16Accepted: false,
  });
}

export function isSupportedPosixAbsolutePathCandidate(
  value: unknown,
): value is string {
  return (
    hasSupportedCommonPathBytes(value) &&
    path.posix.isAbsolute(value) &&
    path.posix.normalize(value) === value &&
    (value === "/" || !value.endsWith("/"))
  );
}

export function isSupportedAuthorityRootAbsolutePath(
  value: unknown,
): value is string {
  return process.platform === "win32"
    ? isSupportedWindowsAbsolutePathCandidate(value)
    : isSupportedPosixAbsolutePathCandidate(value);
}
