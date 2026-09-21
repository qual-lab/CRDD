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

/**
 * textFromの処理を実行する。
 *
 * @responsibility textFromに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: string | Uint8Array
 * @returns textFromの計算結果を返す。
 * @precondition 「value: string | Uint8Array」がtextFromの入力契約を満たす。
 * @postcondition textFromの責務を完了した結果だけを返す。
 * @effect N/A: textFromは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: textFromは独自の失敗分岐を所有しない。
 * @invariant textFromは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: textFromはProcess内の同一Subsystemで完結する。
 * @security textFromはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: textFromは共有非同期状態を持たない同期処理である。
 */
function textFrom(value: string | Uint8Array) {
  return typeof value === "string"
    ? value
    : Buffer.from(value).toString("utf8");
}

/**
 * secretKeyNameの処理を実行する。
 *
 * @responsibility secretKeyNameに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: string
 * @returns secretKeyNameの計算結果を返す。
 * @precondition 「value: string」がsecretKeyNameの入力契約を満たす。
 * @postcondition secretKeyNameの責務を完了した結果だけを返す。
 * @effect N/A: secretKeyNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: secretKeyNameは独自の失敗分岐を所有しない。
 * @invariant secretKeyNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: secretKeyNameはProcess内の同一Subsystemで完結する。
 * @security secretKeyNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: secretKeyNameは共有非同期状態を持たない同期処理である。
 */
function secretKeyName(value: string) {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .replaceAll("-", "_")
    .toLowerCase();
  return SECRET_KEY_SUFFIX.test(normalized);
}

/**
 * assignmentKeyの処理を実行する。
 *
 * @responsibility assignmentKeyに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input doubleQuotedKey: string | undefined、singleQuotedKey: string | undefined、target: string | undefined
 * @returns assignmentKeyの計算結果を返す。
 * @precondition 「doubleQuotedKey: string | undefined、singleQuotedKey: string | undefined、target: string | undefined」がassignmentKeyの入力契約を満たす。
 * @postcondition assignmentKeyの責務を完了した結果だけを返す。
 * @effect N/A: assignmentKeyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: assignmentKeyは独自の失敗分岐を所有しない。
 * @invariant assignmentKeyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: assignmentKeyはProcess内の同一Subsystemで完結する。
 * @security assignmentKeyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: assignmentKeyは共有非同期状態を持たない同期処理である。
 */
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

/**
 * sourceIndirectionの処理を実行する。
 *
 * @responsibility sourceIndirectionに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: string、isSourceFileContext: boolean
 * @returns sourceIndirectionの計算結果を返す。
 * @precondition 「value: string、isSourceFileContext: boolean」がsourceIndirectionの入力契約を満たす。
 * @postcondition sourceIndirectionの責務を完了した結果だけを返す。
 * @effect N/A: sourceIndirectionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sourceIndirectionは独自の失敗分岐を所有しない。
 * @invariant sourceIndirectionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sourceIndirectionはProcess内の同一Subsystemで完結する。
 * @security sourceIndirectionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sourceIndirectionは共有非同期状態を持たない同期処理である。
 */
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

/**
 * containsRecognizedSecretPathSegmentの処理を実行する。
 *
 * @responsibility containsRecognizedSecretPathSegmentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input segment: string
 * @returns containsRecognizedSecretPathSegmentの計算結果を返す。
 * @precondition 「segment: string」がcontainsRecognizedSecretPathSegmentの入力契約を満たす。
 * @postcondition containsRecognizedSecretPathSegmentの責務を完了した結果だけを返す。
 * @effect N/A: containsRecognizedSecretPathSegmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: containsRecognizedSecretPathSegmentは独自の失敗分岐を所有しない。
 * @invariant containsRecognizedSecretPathSegmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: containsRecognizedSecretPathSegmentはProcess内の同一Subsystemで完結する。
 * @security containsRecognizedSecretPathSegmentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: containsRecognizedSecretPathSegmentは共有非同期状態を持たない同期処理である。
 */
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

/**
 * isPathOrNestedSuffixの処理を実行する。
 *
 * @responsibility isPathOrNestedSuffixに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input normalized: string、suffix: string
 * @returns isPathOrNestedSuffixの計算結果を返す。
 * @precondition 「normalized: string、suffix: string」がisPathOrNestedSuffixの入力契約を満たす。
 * @postcondition isPathOrNestedSuffixの責務を完了した結果だけを返す。
 * @effect N/A: isPathOrNestedSuffixは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isPathOrNestedSuffixは独自の失敗分岐を所有しない。
 * @invariant isPathOrNestedSuffixは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isPathOrNestedSuffixはProcess内の同一Subsystemで完結する。
 * @security isPathOrNestedSuffixはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isPathOrNestedSuffixは共有非同期状態を持たない同期処理である。
 */
function isPathOrNestedSuffix(normalized: string, suffix: string) {
  return normalized === suffix || normalized.endsWith(`/${suffix}`);
}

/**
 * isJavaScriptCodePositionの処理を実行する。
 *
 * @responsibility isJavaScriptCodePositionに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input text: string、targetIndex: number
 * @returns isJavaScriptCodePositionの計算結果を返す。
 * @precondition 「text: string、targetIndex: number」がisJavaScriptCodePositionの入力契約を満たす。
 * @postcondition isJavaScriptCodePositionの責務を完了した結果だけを返す。
 * @effect N/A: isJavaScriptCodePositionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isJavaScriptCodePositionは独自の失敗分岐を所有しない。
 * @invariant isJavaScriptCodePositionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isJavaScriptCodePositionはProcess内の同一Subsystemで完結する。
 * @security isJavaScriptCodePositionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isJavaScriptCodePositionは共有非同期状態を持たない同期処理である。
 */
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

/**
 * normalizeBlockCommentPayloadの処理を実行する。
 *
 * @responsibility normalizeBlockCommentPayloadに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: string
 * @returns normalizeBlockCommentPayloadの計算結果を返す。
 * @precondition 「value: string」がnormalizeBlockCommentPayloadの入力契約を満たす。
 * @postcondition normalizeBlockCommentPayloadの責務を完了した結果だけを返す。
 * @effect N/A: normalizeBlockCommentPayloadは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeBlockCommentPayloadは独自の失敗分岐を所有しない。
 * @invariant normalizeBlockCommentPayloadは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeBlockCommentPayloadはProcess内の同一Subsystemで完結する。
 * @security normalizeBlockCommentPayloadはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeBlockCommentPayloadは共有非同期状態を持たない同期処理である。
 */
function normalizeBlockCommentPayload(value: string) {
  return value.replace(/(^|[\r\n])[\t ]*[*!]+/gu, "$1");
}

/**
 * javascriptNonCodeFragmentsの処理を実行する。
 *
 * @responsibility javascriptNonCodeFragmentsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input text: string
 * @returns javascriptNonCodeFragmentsの計算結果を返す。
 * @precondition 「text: string」がjavascriptNonCodeFragmentsの入力契約を満たす。
 * @postcondition javascriptNonCodeFragmentsの責務を完了した結果だけを返す。
 * @effect N/A: javascriptNonCodeFragmentsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: javascriptNonCodeFragmentsは独自の失敗分岐を所有しない。
 * @invariant javascriptNonCodeFragmentsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: javascriptNonCodeFragmentsはProcess内の同一Subsystemで完結する。
 * @security javascriptNonCodeFragmentsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: javascriptNonCodeFragmentsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * literalSecretValueの処理を実行する。
 *
 * @responsibility literalSecretValueに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: string、isQuoted: boolean、isSourceFileContext: boolean
 * @returns literalSecretValueの計算結果を返す。
 * @precondition 「value: string、isQuoted: boolean、isSourceFileContext: boolean」がliteralSecretValueの入力契約を満たす。
 * @postcondition literalSecretValueの責務を完了した結果だけを返す。
 * @effect N/A: literalSecretValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: literalSecretValueは独自の失敗分岐を所有しない。
 * @invariant literalSecretValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: literalSecretValueはProcess内の同一Subsystemで完結する。
 * @security literalSecretValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: literalSecretValueは共有非同期状態を持たない同期処理である。
 */
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

/**
 * containsRecognizedSecretTextInContextの処理を実行する。
 *
 * @responsibility containsRecognizedSecretTextInContextに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: string | Uint8Array、isJavascriptSourceContext: boolean
 * @returns containsRecognizedSecretTextInContextの計算結果を返す。
 * @precondition 「value: string | Uint8Array、isJavascriptSourceContext: boolean」がcontainsRecognizedSecretTextInContextの入力契約を満たす。
 * @postcondition containsRecognizedSecretTextInContextの責務を完了した結果だけを返す。
 * @effect N/A: containsRecognizedSecretTextInContextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: containsRecognizedSecretTextInContextは独自の失敗分岐を所有しない。
 * @invariant containsRecognizedSecretTextInContextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: containsRecognizedSecretTextInContextはProcess内の同一Subsystemで完結する。
 * @security containsRecognizedSecretTextInContextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: containsRecognizedSecretTextInContextは共有非同期状態を持たない同期処理である。
 */
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

/**
 * containsRecognizedSecretTextの処理を実行する。
 *
 * @responsibility containsRecognizedSecretTextに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: string | Uint8Array
 * @returns containsRecognizedSecretTextの計算結果を返す。
 * @precondition 「value: string | Uint8Array」がcontainsRecognizedSecretTextの入力契約を満たす。
 * @postcondition containsRecognizedSecretTextの責務を完了した結果だけを返す。
 * @effect N/A: containsRecognizedSecretTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: containsRecognizedSecretTextは独自の失敗分岐を所有しない。
 * @invariant containsRecognizedSecretTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: containsRecognizedSecretTextはProcess内の同一Subsystemで完結する。
 * @security containsRecognizedSecretTextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: containsRecognizedSecretTextは共有非同期状態を持たない同期処理である。
 */
export function containsRecognizedSecretText(value: string | Uint8Array) {
  return containsRecognizedSecretTextInContext(value, false);
}

/**
 * isRecognizedSourceCodePathの処理を実行する。
 *
 * @responsibility isRecognizedSourceCodePathに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input relativePath: string
 * @returns isRecognizedSourceCodePathの計算結果を返す。
 * @precondition 「relativePath: string」がisRecognizedSourceCodePathの入力契約を満たす。
 * @postcondition isRecognizedSourceCodePathの責務を完了した結果だけを返す。
 * @effect N/A: isRecognizedSourceCodePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isRecognizedSourceCodePathは独自の失敗分岐を所有しない。
 * @invariant isRecognizedSourceCodePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isRecognizedSourceCodePathはProcess内の同一Subsystemで完結する。
 * @security isRecognizedSourceCodePathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isRecognizedSourceCodePathは共有非同期状態を持たない同期処理である。
 */
function isRecognizedSourceCodePath(relativePath: string) {
  const normalized = relativePath.replaceAll("\\", "/").toLowerCase();
  const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
  const extensionIndex = basename.lastIndexOf(".");
  return (
    extensionIndex >= 0 &&
    SOURCE_CODE_EXTENSIONS.has(basename.slice(extensionIndex))
  );
}

/**
 * isRecognizedSecretBearingPathの処理を実行する。
 *
 * @responsibility isRecognizedSecretBearingPathに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input relativePath: string
 * @returns isRecognizedSecretBearingPathの計算結果を返す。
 * @precondition 「relativePath: string」がisRecognizedSecretBearingPathの入力契約を満たす。
 * @postcondition isRecognizedSecretBearingPathの責務を完了した結果だけを返す。
 * @effect N/A: isRecognizedSecretBearingPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isRecognizedSecretBearingPathは独自の失敗分岐を所有しない。
 * @invariant isRecognizedSecretBearingPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isRecognizedSecretBearingPathはProcess内の同一Subsystemで完結する。
 * @security isRecognizedSecretBearingPathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isRecognizedSecretBearingPathは共有非同期状態を持たない同期処理である。
 */
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

/**
 * containsRecognizedSecretScopeの処理を実行する。
 *
 * @responsibility containsRecognizedSecretScopeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input objective: string、acceptanceCriteria: readonly string[]、allowedPaths: readonly string[]、readPaths: readonly string[]
 * @returns containsRecognizedSecretScopeの計算結果を返す。
 * @precondition 「objective: string、acceptanceCriteria: readonly string[]、allowedPaths: readonly string[]、readPaths: readonly string[]」がcontainsRecognizedSecretScopeの入力契約を満たす。
 * @postcondition containsRecognizedSecretScopeの責務を完了した結果だけを返す。
 * @effect N/A: containsRecognizedSecretScopeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: containsRecognizedSecretScopeは独自の失敗分岐を所有しない。
 * @invariant containsRecognizedSecretScopeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: containsRecognizedSecretScopeはProcess内の同一Subsystemで完結する。
 * @security containsRecognizedSecretScopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: containsRecognizedSecretScopeは共有非同期状態を持たない同期処理である。
 */
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

/**
 * containsRecognizedSecretMaterialの処理を実行する。
 *
 * @responsibility containsRecognizedSecretMaterialに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input relativePath: string | null、value: string | Uint8Array
 * @returns containsRecognizedSecretMaterialの計算結果を返す。
 * @precondition 「relativePath: string | null、value: string | Uint8Array」がcontainsRecognizedSecretMaterialの入力契約を満たす。
 * @postcondition containsRecognizedSecretMaterialの責務を完了した結果だけを返す。
 * @effect N/A: containsRecognizedSecretMaterialは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: containsRecognizedSecretMaterialは独自の失敗分岐を所有しない。
 * @invariant containsRecognizedSecretMaterialは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: containsRecognizedSecretMaterialはProcess内の同一Subsystemで完結する。
 * @security containsRecognizedSecretMaterialはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: containsRecognizedSecretMaterialは共有非同期状態を持たない同期処理である。
 */
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

/**
 * describeSecretMaterialPolicyContractの処理を実行する。
 *
 * @responsibility describeSecretMaterialPolicyContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeSecretMaterialPolicyContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeSecretMaterialPolicyContractの入力契約を満たす。
 * @postcondition describeSecretMaterialPolicyContractの責務を完了した結果だけを返す。
 * @effect N/A: describeSecretMaterialPolicyContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeSecretMaterialPolicyContractは独自の失敗分岐を所有しない。
 * @invariant describeSecretMaterialPolicyContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeSecretMaterialPolicyContractはProcess内の同一Subsystemで完結する。
 * @security describeSecretMaterialPolicyContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeSecretMaterialPolicyContractは共有非同期状態を持たない同期処理である。
 */
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
