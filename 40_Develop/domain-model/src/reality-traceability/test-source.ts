/**
 * Test Source内のskip宣言を既存の字句規則で判定する。
 *
 * @responsibility コメント・引用文字列を除いたskip宣言の既存検出を所有する。
 * @trace ARCH-000008
 */
/**
 * Test SourceがskipされたPlaceholderを含むか判定する。
 *
 * @responsibility Local Item Relationを実行されないTestへ接続する偽陽性を検出する。
 * @trace ARCH-000008
 * @input source: Test Source本文。
 * @returns test.skip、it.skipまたはdescribe.skipがあればtrue。
 * @precondition sourceは対象Test Fileから読み取った文字列である。
 * @postcondition Sourceを変更せず決定論的な真偽値を返す。
 * @effect N/A: 文字列を検査するだけである。
 * @failure N/A: 任意文字列をfalseまたはtrueへ分類する。
 * @invariant skipされないTest名やCommentだけを実行Evidenceと誤認しない。
 * @boundary N/A: Process内の文字列検査で完結する。
 * @security N/A: Authorityや秘密値を扱わない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function hasSkippedTestDeclaration(source: string): boolean {
  let executableSource = "";
  let sourceIndex = 0;
  let lexicalState:
    | "code"
    | "line-comment"
    | "block-comment"
    | "single-quote"
    | "double-quote"
    | "template" = "code";
  while (sourceIndex < source.length) {
    const currentCharacter = source[sourceIndex] ?? "";
    const nextCharacter = source[sourceIndex + 1] ?? "";
    if (lexicalState === "code") {
      if (currentCharacter === "/" && nextCharacter === "/") {
        lexicalState = "line-comment";
        executableSource += "  ";
        sourceIndex += 2;
        continue;
      }
      if (currentCharacter === "/" && nextCharacter === "*") {
        lexicalState = "block-comment";
        executableSource += "  ";
        sourceIndex += 2;
        continue;
      }
      if (currentCharacter === "'") lexicalState = "single-quote";
      else if (currentCharacter === '"') lexicalState = "double-quote";
      else if (currentCharacter === "`") lexicalState = "template";
      executableSource += lexicalState === "code" ? currentCharacter : " ";
      sourceIndex += 1;
      continue;
    }
    if (lexicalState === "line-comment") {
      if (currentCharacter === "\n") {
        lexicalState = "code";
        executableSource += "\n";
      } else executableSource += " ";
      sourceIndex += 1;
      continue;
    }
    if (lexicalState === "block-comment") {
      if (currentCharacter === "*" && nextCharacter === "/") {
        lexicalState = "code";
        executableSource += "  ";
        sourceIndex += 2;
      } else {
        executableSource += currentCharacter === "\n" ? "\n" : " ";
        sourceIndex += 1;
      }
      continue;
    }
    const closingCharacter =
      lexicalState === "single-quote"
        ? "'"
        : lexicalState === "double-quote"
          ? '"'
          : "`";
    if (currentCharacter === "\\") {
      executableSource += "  ";
      sourceIndex += 2;
      continue;
    }
    executableSource += currentCharacter === "\n" ? "\n" : " ";
    sourceIndex += 1;
    if (currentCharacter === closingCharacter) lexicalState = "code";
  }
  return /\b(?:test|it|describe)\s*\.\s*skip\s*\(/u.test(executableSource);
}
