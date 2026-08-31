export const SECRET_MATERIAL_POLICY_CONTRACT =
  "crdd-coordinator/secret-material-policy";
export const SECRET_MATERIAL_POLICY_CONTRACT_REVISION = 1;

const FIXED_FORMAT_SECRET_PATTERN =
  /-----BEGIN (?:(?:RSA|EC|OPENSSH|DSA|ENCRYPTED) )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{32,}\b|\bgithub_pat_[A-Za-z0-9_]{32,}\b|\bglpat-[A-Za-z0-9_-]{20,}\b|\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/u;
const PATH_SEGMENT_ASSIGNMENT_PATTERN =
  /^(?:"([A-Za-z][A-Za-z0-9_-]{0,127})"|'([A-Za-z][A-Za-z0-9_-]{0,127})'|([A-Za-z][A-Za-z0-9_-]{0,127}))\s*[:=]\s*(?:"([^"\r\n]{1,4096})"|'([^'\r\n]{1,4096})'|([^\r\n]{1,4096}))$/u;
const NAMED_SECRET_ASSIGNMENT_PATTERN =
  /(?:^|[\s,{;/"'`>])(?:"([A-Za-z][A-Za-z0-9_-]{0,127})"|'([A-Za-z][A-Za-z0-9_-]{0,127})'|([A-Za-z_$][A-Za-z0-9_$]*(?:(?:\?\.|\.)[A-Za-z_$][A-Za-z0-9_$]*|(?:\?\.)?\[\s*(?:"[A-Za-z0-9_-]{1,128}"|'[A-Za-z0-9_-]{1,128}'|[A-Za-z_$][A-Za-z0-9_$]*|[0-9]{1,10})\s*\])*))\s*[:=]\s*(?:"([^"\r\n]{1,4096})"|'([^'\r\n]{1,4096})'|([^\s,;}{]{1,4096}))/gu;
const EMBEDDED_NAMED_SECRET_PATTERN =
  /\/([A-Za-z][A-Za-z0-9_-]{0,127})\s*[:=]\s*(?:"([^"\r\n]{1,4096})"|'([^'\r\n]{1,4096})'|([A-Za-z0-9_!@#$%^&*+=.-]{1,4096}))/gu;
const EXAMPLE_VALUE_PATTERN =
  /^(?:example(?:[-_].*)?|sample(?:[-_].*)?|dummy(?:[-_].*)?|placeholder(?:[-_].*)?|redacted|replace[-_]?me|not[-_]?a[-_]?secret|test[-_]?only|your[-_].*(?:here)?|x{8,}|\*{8,}|<[^>]+>)$/iu;
const SECRET_KEY_SUFFIX =
  /(?:^|_)(?:password|passwd|pwd|client_secret|api_key|apikey|access_token|accesstoken|refresh_token|refreshtoken|session_token|sessiontoken|auth_token|authtoken|private_key|privatekey|secret_access_key|secret_key)$/u;
const SOURCE_IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z_$]*$/u;
const STANDARD_IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;
const MEMBER_EXPRESSION_PATTERN =
  /^[A-Za-z_$][A-Za-z0-9_$]*(?:(?:\?\.|\.)[A-Za-z_$][A-Za-z0-9_$]*|(?:\?\.)?\[\s*(?:"[A-Za-z0-9_-]{1,128}"|'[A-Za-z0-9_-]{1,128}'|[A-Za-z_$][A-Za-z0-9_$]*|[0-9]{1,10})\s*\])+$/u;
const CALL_EXPRESSION_PATTERN =
  /^[A-Za-z_$][A-Za-z0-9_$]*(?:(?:\?\.|\.)[A-Za-z_$][A-Za-z0-9_$]*|(?:\?\.)?\[\s*(?:"[A-Za-z0-9_-]{1,128}"|'[A-Za-z0-9_-]{1,128}'|[A-Za-z_$][A-Za-z0-9_$]*|[0-9]{1,10})\s*\])*\([^\r\n]{0,1024}\)$/u;
const SENSITIVE_BASENAMES = new Set([
  ".env",
  ".netrc",
  ".npmrc",
  ".pypirc",
  "credentials.json",
  ".git-credentials",
  "id_ed25519",
  "id_rsa",
  "application_default_credentials.json",
  "secrets.json",
  "secrets.yaml",
  "secrets.yml",
  "service-account.json",
]);
const SENSITIVE_EXTENSIONS = new Set([".key", ".p12", ".pfx"]);
const NON_SECRET_ENV_SUFFIXES = new Set([".example", ".sample", ".template"]);
const SOURCE_CODE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".mjs",
  ".mts",
  ".ts",
]);

function textFrom(value: string | Uint8Array) {
  return typeof value === "string"
    ? value
    : Buffer.from(value).toString("utf8");
}

function secretKeyName(value: string) {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .replaceAll("-", "_")
    .toLowerCase();
  return SECRET_KEY_SUFFIX.test(normalized);
}

function assignmentKey(
  doubleQuotedKey: string | undefined,
  singleQuotedKey: string | undefined,
  target: string | undefined,
) {
  if (doubleQuotedKey !== undefined) return doubleQuotedKey;
  if (singleQuotedKey !== undefined) return singleQuotedKey;
  if (!target) return "";
  const bracket = target.match(/\[\s*["']([A-Za-z0-9_-]{1,128})["']\s*\]$/u);
  if (bracket?.[1]) return bracket[1];
  const segments = target.replaceAll("?.", ".").split(".");
  return segments.at(-1) ?? "";
}

function sourceIndirection(value: string, isSourceFileContext: boolean) {
  const expression = value.replace(/!+(?=(?:\?\.|\.|\[))/gu, "");
  const withoutTerminalAssertion = expression.endsWith("!")
    ? expression.slice(0, -1)
    : null;
  return (
    expression.startsWith("${") ||
    (isSourceFileContext
      ? STANDARD_IDENTIFIER_PATTERN.test(expression)
      : SOURCE_IDENTIFIER_PATTERN.test(expression)) ||
    MEMBER_EXPRESSION_PATTERN.test(expression) ||
    CALL_EXPRESSION_PATTERN.test(expression) ||
    (withoutTerminalAssertion !== null &&
      ((isSourceFileContext &&
        STANDARD_IDENTIFIER_PATTERN.test(withoutTerminalAssertion)) ||
        MEMBER_EXPRESSION_PATTERN.test(withoutTerminalAssertion) ||
        CALL_EXPRESSION_PATTERN.test(withoutTerminalAssertion)))
  );
}

function containsRecognizedSecretPathSegment(segment: string) {
  if (containsRecognizedSecretText(segment)) return true;
  const match = PATH_SEGMENT_ASSIGNMENT_PATTERN.exec(segment);
  if (!match) return false;
  const key = match[1] ?? match[2] ?? match[3] ?? "";
  if (!secretKeyName(key)) return false;
  const assignedValue = (match[4] ?? match[5] ?? match[6] ?? "").trim();
  return (
    assignedValue.length >= 8 &&
    !EXAMPLE_VALUE_PATTERN.test(assignedValue) &&
    !/^(?:null|undefined|true|false)$/iu.test(assignedValue)
  );
}

function isPathOrNestedSuffix(normalized: string, suffix: string) {
  return normalized === suffix || normalized.endsWith(`/${suffix}`);
}

function isJavaScriptCodePosition(text: string, targetIndex: number) {
  let state: "code" | "single" | "double" | "template" | "line" | "block" =
    "code";
  let isEscaped = false;
  for (let index = 0; index < targetIndex; index += 1) {
    const current = text[index] ?? "";
    const next = text[index + 1] ?? "";
    if (state === "line") {
      if (current === "\n" || current === "\r") state = "code";
      continue;
    }
    if (state === "block") {
      if (current === "*" && next === "/" && index + 1 < targetIndex) {
        state = "code";
        index += 1;
      }
      continue;
    }
    if (state !== "code") {
      if (isEscaped) isEscaped = false;
      else if (current === "\\") isEscaped = true;
      else if (
        (state === "single" && current === "'") ||
        (state === "double" && current === '"') ||
        (state === "template" && current === "`")
      )
        state = "code";
      continue;
    }
    if (current === "/" && next === "/") {
      state = "line";
      index += 1;
    } else if (current === "/" && next === "*") {
      state = "block";
      index += 1;
    } else if (current === "'") state = "single";
    else if (current === '"') state = "double";
    else if (current === "`") state = "template";
  }
  return state === "code";
}

function normalizeBlockCommentPayload(value: string) {
  return value.replace(/(^|[\r\n])[\t ]*[*!]+/gu, "$1");
}

function javascriptNonCodeFragments(text: string) {
  const fragments: string[] = [];
  let state: "code" | "single" | "double" | "template" | "line" | "block" =
    "code";
  let start = -1;
  let isEscaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const current = text[index] ?? "";
    const next = text[index + 1] ?? "";
    if (state === "code") {
      if (current === "/" && next === "/") {
        state = "line";
        start = index + 2;
        index += 1;
      } else if (current === "/" && next === "*") {
        state = "block";
        start = index + 2;
        index += 1;
      } else if (current === "'") {
        state = "single";
        start = index + 1;
      } else if (current === '"') {
        state = "double";
        start = index + 1;
      } else if (current === "`") {
        state = "template";
        start = index + 1;
      }
      continue;
    }
    if (state === "line") {
      if (current === "\n" || current === "\r") {
        fragments.push(text.slice(start, index));
        state = "code";
        start = -1;
      }
      continue;
    }
    if (state === "block") {
      if (current === "*" && next === "/") {
        fragments.push(normalizeBlockCommentPayload(text.slice(start, index)));
        state = "code";
        start = -1;
        index += 1;
      }
      continue;
    }
    if (isEscaped) {
      isEscaped = false;
    } else if (current === "\\") {
      isEscaped = true;
    } else if (
      (state === "single" && current === "'") ||
      (state === "double" && current === '"') ||
      (state === "template" && current === "`")
    ) {
      fragments.push(text.slice(start, index));
      state = "code";
      start = -1;
    }
  }
  if (state !== "code" && start >= 0) {
    const fragment = text.slice(start);
    fragments.push(
      state === "block" ? normalizeBlockCommentPayload(fragment) : fragment,
    );
  }
  return fragments;
}

function literalSecretValue(
  value: string,
  isQuoted: boolean,
  isSourceFileContext: boolean,
) {
  const normalized = value.trim();
  if (
    normalized.length < 8 ||
    EXAMPLE_VALUE_PATTERN.test(normalized) ||
    /^(?:null|undefined|true|false)$/iu.test(normalized)
  ) {
    return false;
  }
  if (isQuoted) return true;
  if (sourceIndirection(normalized, isSourceFileContext)) return false;
  return (
    normalized.length >= 20 ||
    /[0-9_-]/u.test(normalized) ||
    !/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(normalized)
  );
}

function containsRecognizedSecretTextInContext(
  value: string | Uint8Array,
  isJavascriptSourceContext: boolean,
) {
  const text = textFrom(value);
  if (FIXED_FORMAT_SECRET_PATTERN.test(text)) return true;
  if (
    isJavascriptSourceContext &&
    javascriptNonCodeFragments(text).some((fragment) =>
      containsRecognizedSecretTextInContext(fragment, false),
    )
  ) {
    return true;
  }
  for (const match of text.matchAll(EMBEDDED_NAMED_SECRET_PATTERN)) {
    if (
      isJavascriptSourceContext &&
      !isJavaScriptCodePosition(text, match.index ?? 0)
    ) {
      continue;
    }
    if (!secretKeyName(match[1] ?? "")) continue;
    const doubleQuoted = match[2];
    const singleQuoted = match[3];
    if (
      literalSecretValue(
        doubleQuoted ?? singleQuoted ?? match[4] ?? "",
        doubleQuoted !== undefined || singleQuoted !== undefined,
        false,
      )
    ) {
      return true;
    }
  }
  for (const match of text.matchAll(NAMED_SECRET_ASSIGNMENT_PATTERN)) {
    const key = assignmentKey(match[1], match[2], match[3]);
    if (!secretKeyName(key)) continue;
    const doubleQuoted = match[4];
    const singleQuoted = match[5];
    const assignedValue = doubleQuoted ?? singleQuoted ?? match[6] ?? "";
    const leadingBoundary = match[0][0] ?? "";
    const keyPosition =
      (match.index ?? 0) + (leadingBoundary.length > 0 ? 1 : 0);
    const isSourceExpressionContext =
      isJavascriptSourceContext && isJavaScriptCodePosition(text, keyPosition);
    if (
      literalSecretValue(
        assignedValue,
        doubleQuoted !== undefined || singleQuoted !== undefined,
        isSourceExpressionContext,
      )
    ) {
      return true;
    }
  }
  return false;
}

export function containsRecognizedSecretText(value: string | Uint8Array) {
  return containsRecognizedSecretTextInContext(value, false);
}

function isRecognizedSourceCodePath(relativePath: string) {
  const normalized = relativePath.replaceAll("\\", "/").toLowerCase();
  const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
  const extensionIndex = basename.lastIndexOf(".");
  return (
    extensionIndex >= 0 &&
    SOURCE_CODE_EXTENSIONS.has(basename.slice(extensionIndex))
  );
}

export function isRecognizedSecretBearingPath(relativePath: string) {
  const normalized = relativePath.replaceAll("\\", "/").toLowerCase();
  const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
  if (
    basename.startsWith(".env.") &&
    ![...NON_SECRET_ENV_SUFFIXES].some((suffix) => basename.endsWith(suffix))
  ) {
    return true;
  }
  if (
    isPathOrNestedSuffix(normalized, ".aws/credentials") ||
    isPathOrNestedSuffix(normalized, ".docker/config.json") ||
    isPathOrNestedSuffix(
      normalized,
      ".config/gcloud/application_default_credentials.json",
    ) ||
    (/(?:^|\/)\.ssh\/id_[a-z0-9_]+$/u.test(normalized) &&
      !normalized.endsWith(".pub"))
  ) {
    return true;
  }
  const extensionIndex = basename.lastIndexOf(".");
  const extension = extensionIndex >= 0 ? basename.slice(extensionIndex) : "";
  return (
    SENSITIVE_BASENAMES.has(basename) || SENSITIVE_EXTENSIONS.has(extension)
  );
}

export function containsRecognizedSecretScope(
  objective: string,
  acceptanceCriteria: readonly string[],
  allowedPaths: readonly string[],
  readPaths: readonly string[],
) {
  return (
    containsRecognizedSecretText(objective) ||
    acceptanceCriteria.some(containsRecognizedSecretText) ||
    allowedPaths.some((relativePath) =>
      containsRecognizedSecretMaterial(relativePath, ""),
    ) ||
    readPaths.some((relativePath) =>
      containsRecognizedSecretMaterial(relativePath, ""),
    )
  );
}

export function containsRecognizedSecretMaterial(
  relativePath: string | null,
  value: string | Uint8Array,
) {
  return (
    (relativePath !== null &&
      (isRecognizedSecretBearingPath(relativePath) ||
        relativePath
          .replaceAll("\\", "/")
          .split("/")
          .some(containsRecognizedSecretPathSegment))) ||
    containsRecognizedSecretTextInContext(
      value,
      relativePath !== null && isRecognizedSourceCodePath(relativePath),
    )
  );
}

export function describeSecretMaterialPolicyContract() {
  return Object.freeze({
    contract: SECRET_MATERIAL_POLICY_CONTRACT,
    contractRevision: SECRET_MATERIAL_POLICY_CONTRACT_REVISION,
    recognizedSecretAction: "fail_closed_before_provider_effect",
    promptSecretValuesAllowed: false,
    readProjectionSecretValuesAllowed: false,
    repositoryFileBytesEmbeddedInPrompt: false,
    authorizedSourceProjectionAllowed: true,
    detectionClaim: "bounded_high_confidence_not_complete_secret_discovery",
    unknownSecretAbsenceVerified: false,
  });
}
