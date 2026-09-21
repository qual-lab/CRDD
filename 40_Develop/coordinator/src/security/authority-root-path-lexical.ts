/**
 * authority-root-path-lexicalに属する責務をまとめる。
 *
 * @responsibility reservedNameLimitedUppercaseを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000014
 */
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

/**
 * reserved Name Limited Uppercaseを決定する。
 *
 * @responsibility reserved Name Limited Uppercaseの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input value: string
 * @returns reservedNameLimitedUppercaseの計算結果を返す。
 * @precondition 「value: string」がreservedNameLimitedUppercaseの入力契約を満たす。
 * @postcondition reservedNameLimitedUppercaseの責務を完了した結果だけを返す。
 * @effect N/A: reservedNameLimitedUppercaseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: reservedNameLimitedUppercaseは独自の失敗分岐を所有しない。
 * @invariant reservedNameLimitedUppercaseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reservedNameLimitedUppercaseはProcess内の同一Subsystemで完結する。
 * @security reservedNameLimitedUppercaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reservedNameLimitedUppercaseは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Supported Common Path Bytesが存在するかを判定する。
 *
 * @responsibility Supported Common Path Bytesの存在条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がhasSupportedCommonPathBytesの入力契約を満たす。
 * @postcondition hasSupportedCommonPathBytesの責務を完了した結果だけを返す。
 * @effect N/A: hasSupportedCommonPathBytesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hasSupportedCommonPathBytesは独自の失敗分岐を所有しない。
 * @invariant hasSupportedCommonPathBytesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hasSupportedCommonPathBytesはProcess内の同一Subsystemで完結する。
 * @security hasSupportedCommonPathBytesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hasSupportedCommonPathBytesは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Supported Windows Absolute Path 候補かを判定する。
 *
 * @responsibility Supported Windows Absolute Path 候補の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisSupportedWindowsAbsolutePathCandidateの入力契約を満たす。
 * @postcondition isSupportedWindowsAbsolutePathCandidateの責務を完了した結果だけを返す。
 * @effect N/A: isSupportedWindowsAbsolutePathCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSupportedWindowsAbsolutePathCandidateは独自の失敗分岐を所有しない。
 * @invariant isSupportedWindowsAbsolutePathCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSupportedWindowsAbsolutePathCandidateはProcess内の同一Subsystemで完結する。
 * @security isSupportedWindowsAbsolutePathCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isSupportedWindowsAbsolutePathCandidateは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Authority Root Path Lexical 契約の公開契約を記述する。
 *
 * @responsibility Authority Root Path Lexical 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeAuthorityRootPathLexicalContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeAuthorityRootPathLexicalContractの入力契約を満たす。
 * @postcondition describeAuthorityRootPathLexicalContractの責務を完了した結果だけを返す。
 * @effect N/A: describeAuthorityRootPathLexicalContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeAuthorityRootPathLexicalContractは独自の失敗分岐を所有しない。
 * @invariant describeAuthorityRootPathLexicalContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeAuthorityRootPathLexicalContractはProcess内の同一Subsystemで完結する。
 * @security describeAuthorityRootPathLexicalContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeAuthorityRootPathLexicalContractは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Supported Posix Absolute Path 候補かを判定する。
 *
 * @responsibility Supported Posix Absolute Path 候補の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisSupportedPosixAbsolutePathCandidateの入力契約を満たす。
 * @postcondition isSupportedPosixAbsolutePathCandidateの責務を完了した結果だけを返す。
 * @effect N/A: isSupportedPosixAbsolutePathCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSupportedPosixAbsolutePathCandidateは独自の失敗分岐を所有しない。
 * @invariant isSupportedPosixAbsolutePathCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSupportedPosixAbsolutePathCandidateはProcess内の同一Subsystemで完結する。
 * @security isSupportedPosixAbsolutePathCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isSupportedPosixAbsolutePathCandidateは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Supported Authority Root Absolute Pathかを判定する。
 *
 * @responsibility Supported Authority Root Absolute Pathの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisSupportedAuthorityRootAbsolutePathの入力契約を満たす。
 * @postcondition isSupportedAuthorityRootAbsolutePathの責務を完了した結果だけを返す。
 * @effect isSupportedAuthorityRootAbsolutePathは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: isSupportedAuthorityRootAbsolutePathは独自の失敗分岐を所有しない。
 * @invariant isSupportedAuthorityRootAbsolutePathは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security isSupportedAuthorityRootAbsolutePathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isSupportedAuthorityRootAbsolutePathは共有非同期状態を持たない同期処理である。
 */
export function isSupportedAuthorityRootAbsolutePath(
  value: unknown,
): value is string {
  return process.platform === "win32"
    ? isSupportedWindowsAbsolutePathCandidate(value)
    : isSupportedPosixAbsolutePathCandidate(value);
}
