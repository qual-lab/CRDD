import path from "node:path";

export const AUTHORITY_ROOT_ABSOLUTE_PATH_MAX_BYTES = 4_096;

const WINDOWS_RESERVED_BASENAME =
  /^(?:CON|PRN|AUX|NUL|CLOCK\$|CONIN\$|CONOUT\$|COM[1-9\u00b9\u00b2\u00b3]|LPT[1-9\u00b9\u00b2\u00b3])$/iu;

function hasSupportedCommonPathBytes(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
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
    const basename = basenameCandidate.replace(/[. ]+$/u, "");
    return !WINDOWS_RESERVED_BASENAME.test(basename);
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
