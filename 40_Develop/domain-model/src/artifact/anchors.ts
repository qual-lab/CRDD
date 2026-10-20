/**
 * Markdown本文からリンク先Anchorを解析する。
 *
 * @responsibility 見出しの可視文字・重複接尾辞・明示Anchorと、Fence除外を所有する。
 * @trace ARCH-000008
 * @boundary N/A: 本文文字列だけを扱い、RepositoryやCheckerへ依存しない。
 * @effect N/A: Filesystem読取り・共有状態の変更を行わない。
 * @security N/A: Pathや認可を解決せず、入力から文字列集合を導出する。
 */
/**
 * markdown Code Point Beforeを決定する。
 *
 * @responsibility markdown Code Point Beforeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: string、index: number
 * @returns stringを返す。
 * @precondition 「value: string、index: number」がmarkdownCodePointBeforeの入力契約を満たす。
 * @postcondition markdownCodePointBeforeの責務を完了した結果だけを返す。
 * @effect N/A: markdownCodePointBeforeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: markdownCodePointBeforeは独自の失敗分岐を所有しない。
 * @invariant markdownCodePointBeforeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: markdownCodePointBeforeはProcess内の同一Subsystemで完結する。
 * @security N/A: markdownCodePointBeforeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: markdownCodePointBeforeは共有非同期状態を持たない同期処理である。
 */
function markdownCodePointBefore(value: string, index: number): string {
  return Array.from(value.slice(0, index)).at(-1) ?? "";
}

/**
 * markdown Code Point Afterを決定する。
 *
 * @responsibility markdown Code Point Afterの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: string、index: number
 * @returns stringを返す。
 * @precondition 「value: string、index: number」がmarkdownCodePointAfterの入力契約を満たす。
 * @postcondition markdownCodePointAfterの責務を完了した結果だけを返す。
 * @effect N/A: markdownCodePointAfterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: markdownCodePointAfterは独自の失敗分岐を所有しない。
 * @invariant markdownCodePointAfterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: markdownCodePointAfterはProcess内の同一Subsystemで完結する。
 * @security N/A: markdownCodePointAfterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: markdownCodePointAfterは共有非同期状態を持たない同期処理である。
 */
function markdownCodePointAfter(value: string, index: number): string {
  return Array.from(value.slice(index)).at(0) ?? "";
}

/**
 * markdown Whitespaceを決定する。
 *
 * @responsibility markdown Whitespaceの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: string
 * @returns booleanを返す。
 * @precondition 「value: string」がmarkdownWhitespaceの入力契約を満たす。
 * @postcondition markdownWhitespaceの責務を完了した結果だけを返す。
 * @effect N/A: markdownWhitespaceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: markdownWhitespaceは独自の失敗分岐を所有しない。
 * @invariant markdownWhitespaceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: markdownWhitespaceはProcess内の同一Subsystemで完結する。
 * @security N/A: markdownWhitespaceはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: markdownWhitespaceは共有非同期状態を持たない同期処理である。
 */
function markdownWhitespace(value: string): boolean {
  return value === "" || /[\t\n\f\r\p{Zs}]/u.test(value);
}

/**
 * markdown Punctuationを決定する。
 *
 * @responsibility markdown Punctuationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: string
 * @returns booleanを返す。
 * @precondition 「value: string」がmarkdownPunctuationの入力契約を満たす。
 * @postcondition markdownPunctuationの責務を完了した結果だけを返す。
 * @effect N/A: markdownPunctuationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: markdownPunctuationは独自の失敗分岐を所有しない。
 * @invariant markdownPunctuationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: markdownPunctuationはProcess内の同一Subsystemで完結する。
 * @security N/A: markdownPunctuationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: markdownPunctuationは共有非同期状態を持たない同期処理である。
 */
function markdownPunctuation(value: string): boolean {
  return (
    value !== "" &&
    (/\p{P}/u.test(value) ||
      /[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/u.test(value))
  );
}

/**
 * underscore Flankingを決定する。
 *
 * @responsibility underscore Flankingの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: string、index: number、length: number
 * @returns underscoreFlankingの計算結果を返す。
 * @precondition 「value: string、index: number、length: number」がunderscoreFlankingの入力契約を満たす。
 * @postcondition underscoreFlankingの責務を完了した結果だけを返す。
 * @effect N/A: underscoreFlankingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: underscoreFlankingは独自の失敗分岐を所有しない。
 * @invariant underscoreFlankingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: underscoreFlankingはProcess内の同一Subsystemで完結する。
 * @security N/A: underscoreFlankingはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: underscoreFlankingは共有非同期状態を持たない同期処理である。
 */
function underscoreFlanking(value: string, index: number, length: number) {
  const previous = markdownCodePointBefore(value, index);
  const next = markdownCodePointAfter(value, index + length);
  const isPreviousWhitespace = markdownWhitespace(previous);
  const isNextWhitespace = markdownWhitespace(next);
  const isPreviousPunctuation = markdownPunctuation(previous);
  const isNextPunctuation = markdownPunctuation(next);
  return {
    left:
      !isNextWhitespace &&
      (!isNextPunctuation || isPreviousWhitespace || isPreviousPunctuation),
    right:
      !isPreviousWhitespace &&
      (!isPreviousPunctuation || isNextWhitespace || isNextPunctuation),
    isPreviousPunctuation,
    isNextPunctuation,
  };
}

/**
 * underscore Can Openを決定する。
 *
 * @responsibility underscore Can Openの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: string、index: number、length: number
 * @returns booleanを返す。
 * @precondition 「value: string、index: number、length: number」がunderscoreCanOpenの入力契約を満たす。
 * @postcondition underscoreCanOpenの責務を完了した結果だけを返す。
 * @effect N/A: underscoreCanOpenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: underscoreCanOpenは独自の失敗分岐を所有しない。
 * @invariant underscoreCanOpenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: underscoreCanOpenはProcess内の同一Subsystemで完結する。
 * @security N/A: underscoreCanOpenはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: underscoreCanOpenは共有非同期状態を持たない同期処理である。
 */
function underscoreCanOpen(
  value: string,
  index: number,
  length: number,
): boolean {
  const flanking = underscoreFlanking(value, index, length);
  return flanking.left && (!flanking.right || flanking.isPreviousPunctuation);
}

/**
 * underscore Can Closeを決定する。
 *
 * @responsibility underscore Can Closeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: string、index: number、length: number
 * @returns booleanを返す。
 * @precondition 「value: string、index: number、length: number」がunderscoreCanCloseの入力契約を満たす。
 * @postcondition underscoreCanCloseの責務を完了した結果だけを返す。
 * @effect N/A: underscoreCanCloseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: underscoreCanCloseは独自の失敗分岐を所有しない。
 * @invariant underscoreCanCloseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: underscoreCanCloseはProcess内の同一Subsystemで完結する。
 * @security N/A: underscoreCanCloseはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: underscoreCanCloseは共有非同期状態を持たない同期処理である。
 */
function underscoreCanClose(
  value: string,
  index: number,
  length: number,
): boolean {
  const flanking = underscoreFlanking(value, index, length);
  return flanking.right && (!flanking.left || flanking.isNextPunctuation);
}

/**
 * delimiter Run Lengthを決定する。
 *
 * @responsibility delimiter Run Lengthの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: string、start: number、character: string
 * @returns numberを返す。
 * @precondition 「value: string、start: number、character: string」がdelimiterRunLengthの入力契約を満たす。
 * @postcondition delimiterRunLengthの責務を完了した結果だけを返す。
 * @effect N/A: delimiterRunLengthは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: delimiterRunLengthは独自の失敗分岐を所有しない。
 * @invariant delimiterRunLengthは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: delimiterRunLengthはProcess内の同一Subsystemで完結する。
 * @security N/A: delimiterRunLengthはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: delimiterRunLengthは共有非同期状態を持たない同期処理である。
 */
function delimiterRunLength(
  value: string,
  start: number,
  character: string,
): number {
  let end = start;
  while (value[end] === character) end += 1;
  return end - start;
}

/**
 * closing Delimiterを決定する。
 *
 * @responsibility closing Delimiterの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: string、delimiter: string、start: number
 * @returns numberを返す。
 * @precondition 「value: string、delimiter: string、start: number」がclosingDelimiterの入力契約を満たす。
 * @postcondition closingDelimiterの責務を完了した結果だけを返す。
 * @effect N/A: closingDelimiterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: closingDelimiterは独自の失敗分岐を所有しない。
 * @invariant closingDelimiterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: closingDelimiterはProcess内の同一Subsystemで完結する。
 * @security N/A: closingDelimiterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: closingDelimiterは共有非同期状態を持たない同期処理である。
 */
function closingDelimiter(
  value: string,
  delimiter: string,
  start: number,
): number {
  const isUnderscore = delimiter.startsWith("_");
  let index = value.indexOf(delimiter, start);
  while (index >= 0) {
    const isExactRun =
      !isUnderscore ||
      delimiterRunLength(value, index, "_") === delimiter.length;
    if (
      isExactRun &&
      (!isUnderscore || underscoreCanClose(value, index, delimiter.length))
    ) {
      return index;
    }
    index = value.indexOf(delimiter, index + 1);
  }
  return -1;
}

/**
 * backtick Run Lengthを決定する。
 *
 * @responsibility backtick Run Lengthの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: string、start: number
 * @returns numberを返す。
 * @precondition 「value: string、start: number」がbacktickRunLengthの入力契約を満たす。
 * @postcondition backtickRunLengthの責務を完了した結果だけを返す。
 * @effect N/A: backtickRunLengthは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: backtickRunLengthは独自の失敗分岐を所有しない。
 * @invariant backtickRunLengthは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: backtickRunLengthはProcess内の同一Subsystemで完結する。
 * @security N/A: backtickRunLengthはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: backtickRunLengthは共有非同期状態を持たない同期処理である。
 */
function backtickRunLength(value: string, start: number): number {
  let end = start;
  while (value[end] === "`") end += 1;
  return end - start;
}

/**
 * closing Backticksを決定する。
 *
 * @responsibility closing Backticksの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: string、start: number、length: number
 * @returns numberを返す。
 * @precondition 「value: string、start: number、length: number」がclosingBackticksの入力契約を満たす。
 * @postcondition closingBackticksの責務を完了した結果だけを返す。
 * @effect N/A: closingBackticksは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: closingBackticksは独自の失敗分岐を所有しない。
 * @invariant closingBackticksは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: closingBackticksはProcess内の同一Subsystemで完結する。
 * @security N/A: closingBackticksはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: closingBackticksは共有非同期状態を持たない同期処理である。
 */
function closingBackticks(
  value: string,
  start: number,
  length: number,
): number {
  let index = start;
  while (index < value.length) {
    if (value[index] !== "`") {
      index += 1;
      continue;
    }
    const candidateLength = backtickRunLength(value, index);
    if (candidateLength === length) return index;
    index += candidateLength;
  }
  return -1;
}

/**
 * Code Spanを固定Schemaへ正規化する。
 *
 * @responsibility Code Spanの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: string
 * @returns stringを返す。
 * @precondition 「value: string」がnormalizedCodeSpanの入力契約を満たす。
 * @postcondition normalizedCodeSpanの責務を完了した結果だけを返す。
 * @effect N/A: normalizedCodeSpanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizedCodeSpanは独自の失敗分岐を所有しない。
 * @invariant normalizedCodeSpanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizedCodeSpanはProcess内の同一Subsystemで完結する。
 * @security N/A: normalizedCodeSpanはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: normalizedCodeSpanは共有非同期状態を持たない同期処理である。
 */
function normalizedCodeSpan(value: string): string {
  const normalized = value.replace(/[ \t\r\n]+/gu, " ");
  if (/^ \S(?:.*\S)? $/u.test(normalized)) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

/**
 * github Heading Textを決定する。
 *
 * @responsibility github Heading Textの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: string
 * @returns stringを返す。
 * @precondition 「value: string」がgithubHeadingTextの入力契約を満たす。
 * @postcondition githubHeadingTextの責務を完了した結果だけを返す。
 * @effect N/A: githubHeadingTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: githubHeadingTextは独自の失敗分岐を所有しない。
 * @invariant githubHeadingTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: githubHeadingTextはProcess内の同一Subsystemで完結する。
 * @security N/A: githubHeadingTextはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: githubHeadingTextは共有非同期状態を持たない同期処理である。
 */
function githubHeadingText(value: string): string {
  let result = "";
  let index = 0;
  while (index < value.length) {
    if (
      value[index] === "\\" &&
      index + 1 < value.length &&
      /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/u.test(value.charAt(index + 1))
    ) {
      result += value[index + 1];
      index += 2;
      continue;
    }

    if (value[index] === "`") {
      const length = backtickRunLength(value, index);
      const close = closingBackticks(value, index + length, length);
      if (close >= 0) {
        result += normalizedCodeSpan(value.slice(index + length, close));
        index = close + length;
        continue;
      }
    }

    const html = value.slice(index).match(/^<\/?[A-Za-z][^>]*>/u);
    if (html) {
      index += html[0].length;
      continue;
    }

    const isImage = value.startsWith("![", index);
    if (isImage || value[index] === "[") {
      const labelStart = index + (isImage ? 2 : 1);
      const labelEnd = value.indexOf("]", labelStart);
      if (labelEnd >= 0) {
        const targetStart = labelEnd + 1;
        const targetOpen = value[targetStart];
        const targetClose =
          targetOpen === "(" ? ")" : targetOpen === "[" ? "]" : "";
        const targetEnd = targetClose
          ? value.indexOf(targetClose, targetStart + 1)
          : -1;
        if (targetEnd >= 0) {
          result += githubHeadingText(value.slice(labelStart, labelEnd));
          index = targetEnd + 1;
          continue;
        }
      }
    }

    let delimiter = "";
    if (value[index] === "_") {
      const length = delimiterRunLength(value, index, "_");
      if (length > 2) {
        result += value.slice(index, index + length);
        index += length;
        continue;
      }
      delimiter = "_".repeat(length);
    } else {
      delimiter =
        ["**", "~~", "*"].find((item) => value.startsWith(item, index)) ?? "";
    }
    if (
      delimiter &&
      (!delimiter.startsWith("_") ||
        underscoreCanOpen(value, index, delimiter.length))
    ) {
      const close = closingDelimiter(
        value,
        delimiter,
        index + delimiter.length,
      );
      if (close >= 0) {
        result += githubHeadingText(
          value.slice(index + delimiter.length, close),
        );
        index = close + delimiter.length;
        continue;
      }
    }

    result += value[index];
    index += 1;
  }
  return result;
}

/**
 * github Anchorを決定する。
 *
 * @responsibility github Anchorの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: string
 * @returns stringを返す。
 * @precondition 「value: string」がgithubAnchorの入力契約を満たす。
 * @postcondition githubAnchorの責務を完了した結果だけを返す。
 * @effect N/A: githubAnchorは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: githubAnchorは独自の失敗分岐を所有しない。
 * @invariant githubAnchorは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: githubAnchorはProcess内の同一Subsystemで完結する。
 * @security N/A: githubAnchorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: githubAnchorは共有非同期状態を持たない同期処理である。
 */
function githubAnchor(value: string): string {
  return githubHeadingText(value)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}_\- ]/gu, "")
    .replaceAll(" ", "-");
}

/**
 * Markdown本文から明示Anchorと見出しAnchorを解析する。
 *
 * @responsibility Fence内を除き、可視見出し文字と重複順からリンク先集合を返す。
 * @trace ARCH-000008
 * @input content: string
 * @returns Set<string>を返す。
 * @precondition 「content: string」がparseMarkdownAnchorsの入力契約を満たす。
 * @postcondition parseMarkdownAnchorsの責務を完了した結果だけを返す。
 * @effect N/A: parseMarkdownAnchorsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseMarkdownAnchorsは独自の失敗分岐を所有しない。
 * @invariant parseMarkdownAnchorsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseMarkdownAnchorsはProcess内の同一Subsystemで完結する。
 * @security N/A: parseMarkdownAnchorsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseMarkdownAnchorsは共有非同期状態を持たない同期処理である。
 */
export function parseMarkdownAnchors(content: string): Set<string> {
  const text = omitMarkdownFencedCode(content);
  const anchors = new Set<string>();
  for (const match of text.matchAll(/<a\s+id=["']([^"']+)["']\s*>\s*<\/a>/gi)) {
    anchors.add(match[1] ?? "");
  }
  const generated = new Set<string>();
  const occurrences = new Map<string, number>();
  for (const match of text.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = githubAnchor(match[1] ?? "");
    if (!base) continue;
    let count = occurrences.get(base) ?? 0;
    let anchor = count === 0 ? base : `${base}-${count}`;
    while (generated.has(anchor)) {
      count += 1;
      anchor = `${base}-${count}`;
    }
    occurrences.set(base, count + 1);
    generated.add(anchor);
    anchors.add(anchor);
  }
  return anchors;
}

/**
 * MarkdownのFenceとその内部を空行へ置き換える。
 *
 * @responsibility Fenceの記号・長さ・閉じ忘れを判定し、行数を維持して本文を返す。
 * @trace ARCH-000008
 * @input text: string
 * @returns stringを返す。
 * @precondition 「text: string」がomitMarkdownFencedCodeの入力契約を満たす。
 * @postcondition omitMarkdownFencedCodeの責務を完了した結果だけを返す。
 * @effect N/A: omitMarkdownFencedCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: omitMarkdownFencedCodeは独自の失敗分岐を所有しない。
 * @invariant omitMarkdownFencedCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: omitMarkdownFencedCodeはProcess内の同一Subsystemで完結する。
 * @security N/A: omitMarkdownFencedCodeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: omitMarkdownFencedCodeは共有非同期状態を持たない同期処理である。
 */
export function omitMarkdownFencedCode(text: string): string {
  let fence:
    | Readonly<{
        marker: "`" | "~";
        length: number;
      }>
    | undefined;
  return text
    .split(/\r?\n/u)
    .map((line) => {
      if (fence) {
        const closing = line.match(/^\s{0,3}(?<marker>`+|~+)\s*$/u);
        if (
          closing?.groups?.marker?.startsWith(fence.marker) &&
          closing.groups.marker.length >= fence.length
        )
          fence = undefined;
        return "";
      }
      const opening = line.match(/^\s{0,3}(?<marker>`{3,}|~{3,})/u);
      if (opening?.groups?.marker) {
        fence = {
          marker: opening.groups.marker[0] as "`" | "~",
          length: opening.groups.marker.length,
        };
        return "";
      }
      return line;
    })
    .join("\n");
}
