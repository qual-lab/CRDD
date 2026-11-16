/**
 * Markdown本文の可視範囲・表行・先頭Header・Fence構造を取り出す。
 *
 * @responsibility 既存Checkerが用いる文字列の受理範囲と位置保持を所有する。
 * @trace ARCH-000008
 * @boundary N/A: 本文文字列のみを入力しFilesystemやChecker契約を扱わない。
 * @effect N/A: 外部I/O・共有状態変更を行わない。
 * @security 返却本文の意味妥当性やPathの安全性を保証しない。
 */
import type {
  ArtifactSource,
  DocumentReference,
  DocumentSection,
  DocumentTableRow,
  DocumentText,
  MarkdownFence,
  MarkdownFenceLine,
} from "./types.ts";
/**
 * HTMLコメントとFence内の本文を構造検査から除外する。
 *
 * @responsibility コメントを同幅の空白へ、Fenceとその内部を空行へ置き換える。
 * @trace ARCH-000008
 * @input text: string
 * @returns stringを返す。
 * @precondition 「text: string」がomitMarkdownCommentsAndFencedCodeの入力契約を満たす。
 * @postcondition omitMarkdownCommentsAndFencedCodeの責務を完了した結果だけを返す。
 * @effect N/A: omitMarkdownCommentsAndFencedCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: omitMarkdownCommentsAndFencedCodeは独自の失敗分岐を所有しない。
 * @invariant omitMarkdownCommentsAndFencedCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: omitMarkdownCommentsAndFencedCodeはProcess内の同一Subsystemで完結する。
 * @security N/A: omitMarkdownCommentsAndFencedCodeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: omitMarkdownCommentsAndFencedCodeは共有非同期状態を持たない同期処理である。
 */
export function omitMarkdownCommentsAndFencedCode(text: string): string {
  let fence:
    | Readonly<{
        marker: "`" | "~";
        length: number;
      }>
    | undefined;
  let isInHtmlComment = false;

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

      let visible = "";
      let cursor = 0;
      while (cursor < line.length) {
        if (isInHtmlComment) {
          const commentEnd = line.indexOf("-->", cursor);
          if (commentEnd < 0) {
            visible += " ".repeat(line.length - cursor);
            cursor = line.length;
            continue;
          }
          visible += " ".repeat(commentEnd + 3 - cursor);
          cursor = commentEnd + 3;
          isInHtmlComment = false;
          continue;
        }

        const commentStart = line.indexOf("<!--", cursor);
        if (commentStart < 0) {
          visible += line.slice(cursor);
          cursor = line.length;
          continue;
        }
        visible += line.slice(cursor, commentStart);
        visible += " ".repeat(4);
        cursor = commentStart + 4;
        isInHtmlComment = true;
      }

      const opening = visible.match(/^\s{0,3}(?<marker>`{3,}|~{3,})/u);
      if (opening?.groups?.marker) {
        fence = {
          marker: opening.groups.marker[0] as "`" | "~",
          length: opening.groups.marker.length,
        };
        return "";
      }
      return visible;
    })
    .join("\n");
}

/**
 * Fence内を保ち、Fence外のHTMLコメントだけを除外する。
 *
 * @responsibility Fence内の原文とコメント記法を維持し、外側コメントを同幅空白へ置き換える。
 * @trace ARCH-000008
 * @input text: string
 * @returns stringを返す。
 * @precondition 「text: string」がomitMarkdownCommentsOutsideFencedCodeの入力契約を満たす。
 * @postcondition omitMarkdownCommentsOutsideFencedCodeの責務を完了した結果だけを返す。
 * @effect N/A: omitMarkdownCommentsOutsideFencedCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: omitMarkdownCommentsOutsideFencedCodeは独自の失敗分岐を所有しない。
 * @invariant omitMarkdownCommentsOutsideFencedCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: omitMarkdownCommentsOutsideFencedCodeはProcess内の同一Subsystemで完結する。
 * @security N/A: omitMarkdownCommentsOutsideFencedCodeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: omitMarkdownCommentsOutsideFencedCodeは共有非同期状態を持たない同期処理である。
 */
export function omitMarkdownCommentsOutsideFencedCode(text: string): string {
  let fence:
    | Readonly<{
        marker: "`" | "~";
        length: number;
      }>
    | undefined;
  let isInHtmlComment = false;

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
        return line;
      }

      let visible = "";
      let cursor = 0;
      while (cursor < line.length) {
        if (isInHtmlComment) {
          const commentEnd = line.indexOf("-->", cursor);
          if (commentEnd < 0) {
            visible += " ".repeat(line.length - cursor);
            cursor = line.length;
            continue;
          }
          visible += " ".repeat(commentEnd + 3 - cursor);
          cursor = commentEnd + 3;
          isInHtmlComment = false;
          continue;
        }
        const commentStart = line.indexOf("<!--", cursor);
        if (commentStart < 0) {
          visible += line.slice(cursor);
          cursor = line.length;
          continue;
        }
        visible += line.slice(cursor, commentStart);
        visible += " ".repeat(4);
        cursor = commentStart + 4;
        isInHtmlComment = true;
      }

      const opening = visible.match(/^\s{0,3}(?<marker>`{3,}|~{3,})/u);
      if (opening?.groups?.marker)
        fence = {
          marker: opening.groups.marker[0] as "`" | "~",
          length: opening.groups.marker.length,
        };
      return visible;
    })
    .join("\n");
}

/**
 * Markdown表の一行をCell配列へ解析する。
 *
 * @responsibility EscapeとCode Span内のPipeを区切りから除外し、任意の外側Pipeを取り除く。
 * @trace ARCH-000008
 * @input line: string
 * @returns Pipeがなければnull、それ以外はtrimとBacktick除去後のCell配列。表全体の妥当性は判定しない。
 * @precondition 「line: string」がparseMarkdownTableRowの入力契約を満たす。
 * @postcondition parseMarkdownTableRowの責務を完了した結果だけを返す。
 * @effect N/A: parseMarkdownTableRowは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseMarkdownTableRowは独自の失敗分岐を所有しない。
 * @invariant parseMarkdownTableRowは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseMarkdownTableRowはProcess内の同一Subsystemで完結する。
 * @security N/A: parseMarkdownTableRowはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseMarkdownTableRowは共有非同期状態を持たない同期処理である。
 */
export function parseMarkdownTableRow(line: string): string[] | null {
  const value = line.trim();
  if (!value.includes("|")) return null;
  const cells = [""];
  let codeDelimiter = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "\\" && index + 1 < value.length) {
      cells[cells.length - 1] =
        (cells[cells.length - 1] ?? "") + value.charAt(index + 1);
      index += 1;
      continue;
    }
    if (value[index] === "`") {
      let length = 1;
      while (value[index + length] === "`") length += 1;
      if (codeDelimiter === 0) codeDelimiter = length;
      else if (codeDelimiter === length) codeDelimiter = 0;
      cells[cells.length - 1] += "`".repeat(length);
      index += length - 1;
      continue;
    }
    if (value[index] === "|" && codeDelimiter === 0) {
      cells.push("");
      continue;
    }
    cells[cells.length - 1] =
      (cells[cells.length - 1] ?? "") + value.charAt(index);
  }
  if (value.startsWith("|")) cells.shift();
  if (value.endsWith("|") && !value.endsWith("\\|")) cells.pop();
  return cells.map((cell) => cell.trim().replaceAll("`", ""));
}

/**
 * 表の区切り行が期待するCell数と記法に一致するかを判定する。
 *
 * @responsibility 表行の共通解析後にCell数と各Cellのハイフン・配置記号を照合する。
 * @trace ARCH-000008
 * @input line: string、expectedCells: number
 * @returns booleanを返す。
 * @precondition 「line: string、expectedCells: number」がisMarkdownTableSeparatorの入力契約を満たす。
 * @postcondition isMarkdownTableSeparatorの責務を完了した結果だけを返す。
 * @effect N/A: isMarkdownTableSeparatorは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isMarkdownTableSeparatorは独自の失敗分岐を所有しない。
 * @invariant isMarkdownTableSeparatorは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isMarkdownTableSeparatorはProcess内の同一Subsystemで完結する。
 * @security N/A: isMarkdownTableSeparatorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isMarkdownTableSeparatorは共有非同期状態を持たない同期処理である。
 */
export function isMarkdownTableSeparator(
  line: string,
  expectedCells: number,
): boolean {
  const cells = parseMarkdownTableRow(line);
  return (
    cells !== null &&
    cells.length === expectedCells &&
    cells.every((cell) => /^:?-+:?$/u.test(cell))
  );
}

/**
 * 文書先頭から正本MetadataのHeader本文を取り出す。
 *
 * @responsibility BOM・初期Anchor・最初のH1を除き、先頭の英字Key行を順序と重複を保って収集する。
 * @trace ARCH-000008
 * @input content: string
 * @returns Header行をLFで連結した文字列。Headerがなければ空文字列。値の妥当性は判定しない。
 * @precondition 「content: string」がreadCanonicalDocumentHeaderの入力契約を満たす。
 * @postcondition readCanonicalDocumentHeaderの責務を完了した結果だけを返す。
 * @effect N/A: readCanonicalDocumentHeaderは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readCanonicalDocumentHeaderは独自の失敗分岐を所有しない。
 * @invariant readCanonicalDocumentHeaderは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readCanonicalDocumentHeaderはProcess内の同一Subsystemで完結する。
 * @security N/A: readCanonicalDocumentHeaderはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readCanonicalDocumentHeaderは共有非同期状態を持たない同期処理である。
 */
export function readCanonicalDocumentHeader(content: string): string {
  const headerLines: string[] = [];
  let hasFields = false;
  let hasTitle = false;
  for (const line of content.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    if (line.trim() === "") continue;
    if (!hasFields && /^<a id="[^"]+"><\/a>$/u.test(line)) continue;
    if (!hasFields && !hasTitle && /^#\s+\S/u.test(line)) {
      hasTitle = true;
      continue;
    }
    if (!/^[A-Za-z][A-Za-z ]*:[ \t]*.*$/u.test(line)) break;
    hasFields = true;
    headerLines.push(line);
  }
  return headerLines.join("\n");
}

/**
 * 行位置とコードFenceの内外・閉鎖状態を解析する。
 *
 * @responsibility 開始・終了・未閉鎖を行列とFenceへ構造化し、本文の採否判断を行わない。
 * @trace ARCH-000008
 * @input lines: 呼出し側で分割済みの文字列行。
 * @returns 全行のentriesと開始順のfences。内容行は同じObjectを共有する。
 * @precondition BOM除去・改行分割は呼出し側が行う。
 * @postcondition 入力順と0始まりindex、未閉鎖end:null／closed:falseを保持する。
 * @effect N/A: 入力読取りと局所値の構築だけ。
 * @failure N/A: 不成立な開始行は通常行とし、未閉鎖も解析結果として返す。
 * @invariant 開始・終了行はoutside:falseだがcontentsへ含めない。
 * @boundary N/A: Repositoryを観測しない同期解析。
 * @security 返却値から宣言・リリース・Pathの妥当性を保証しない。
 * @concurrency 呼出しごとに局所配列を構築し共有状態を持たない。
 */
export function parseMarkdownFences(lines: readonly string[]): {
  entries: MarkdownFenceLine[];
  fences: MarkdownFence[];
} {
  const entries: MarkdownFenceLine[] = [];
  const fences: MarkdownFence[] = [];
  let activeFence: MarkdownFence | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as string;
    if (activeFence) {
      const closing = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/u);
      if (
        closing &&
        (closing[1] as string)[0] === activeFence.marker &&
        (closing[1] as string).length >= activeFence.length
      ) {
        entries.push({
          index,
          text: line,
          outside: false,
          fenceId: activeFence.id,
        });
        activeFence.end = index;
        activeFence.closed = true;
        activeFence = null;
      } else {
        const entry = {
          index,
          text: line,
          outside: false,
          fenceId: activeFence.id,
        };
        entries.push(entry);
        activeFence.contents.push(entry);
      }
      continue;
    }
    const opening = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
    const isValidOpening =
      opening &&
      !(
        (opening[1] as string)[0] === "`" &&
        (opening[2] as string).includes("`")
      );
    if (!isValidOpening) {
      entries.push({ index, text: line, outside: true, fenceId: null });
      continue;
    }
    const fence: MarkdownFence = {
      id: fences.length,
      marker: (opening[1] as string)[0] as string,
      length: (opening[1] as string).length,
      language: (
        (opening[2] as string).trim().split(/\s+/u)[0] as string
      ).toLowerCase(),
      start: index,
      end: null,
      closed: false,
      contents: [],
    };
    fences.push(fence);
    activeFence = fence;
    entries.push({ index, text: line, outside: false, fenceId: fence.id });
  }
  return { entries, fences };
}

/**
 * Markdownの指定第二階層Section本文を抽出する。
 * @responsibility Markdownの指定第二階層Section本文を抽出する。
 * @trace ARCH-000008
 * @input source: 可視本文。heading: 対象見出し。
 * @returns 既存のSection本文、または空文字列。
 * @precondition 呼出し元が対象を選択し本文を取得している。
 * @postcondition 最初に一致したSectionの本文だけを返す。
 * @effect N/A: 既読本文と局所値だけを扱う同期処理。
 * @failure 解析例外を伝播し不足を補完しない。
 * @invariant 最初の一致と次の第二階層見出しで区切る。
 * @boundary N/A: 同一Process内のMarkdown意味モデル検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
export const readMarkdownSection = (
  source: string,
  heading: string,
): string => {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return (
    source.match(
      new RegExp(`^${escaped}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "mu"),
    )?.[1] ?? ""
  );
};

/**
 * 指定したH2節の全出現を位置付きで捕捉する。
 * @responsibility 最初／一意という工程側の選択前に、欠測と重複を保持する。
 * @trace ARCH-000008
 * @input source: 可視本文とPath。heading: H2の表示名。
 * @returns 出現順の見出しと本文。欠測は空配列。
 * @effect N/A: 既読文字列だけを扱う。
 * @failure 解析例外を伝播する。
 */
export function captureDocumentSections(
  source: ArtifactSource,
  heading: string,
): readonly DocumentSection[] {
  const escaped = heading.replace(/[.*+?^$()|[\]{}\\]/gu, "\\$&");
  return [
    ...source.content.matchAll(
      new RegExp(`^## ${escaped}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "gmu"),
    ),
  ].map((match) => {
    const start = match.index ?? 0;
    const body = match[1] ?? "";
    const bodyStart = start + match[0].length - body.length;
    return {
      heading: {
        text: `## ${heading}`,
        location: {
          path: source.path,
          line: source.content.slice(0, start).split("\n").length,
        },
      },
      body: {
        text: body,
        location: {
          path: source.path,
          line: source.content.slice(0, bodyStart).split("\n").length,
        },
      },
      boundary: source.content.slice(start + match[0].length).startsWith("## ")
        ? "heading"
        : "end_of_document",
      tableRows: body.split("\n").flatMap((line, index) => {
        const cells = parseMarkdownTableRow(line);
        return cells === null
          ? []
          : [
              {
                cells,
                location: {
                  path: source.path,
                  line:
                    source.content.slice(0, bodyStart).split("\n").length +
                    index,
                },
              },
            ];
      }),
    };
  });
}
/**
 * 指定構文に一致した参照を本文中の位置付きで捕捉する。
 * @responsibility 呼出し側の工程構文を使い、順序と重複を消さない。
 * @trace ARCH-000008
 * @input body: 節本文。pattern: IDを第1捕捉に持つ全体参照の正規表現。
 * @returns 正式構文に一致した参照列。未一致の原文は節本文に残る。
 * @effect N/A: 既読文字列だけを扱う。
 * @failure 解析例外を伝播する。
 */
export function captureDocumentReferences(
  body: DocumentText | null,
  pattern: RegExp,
): readonly DocumentReference[] {
  if (!body) return [];
  return [...body.text.matchAll(pattern)].map((match) => ({
    identity: match[1] ?? "",
    target: /\]\(([^)]*)\)/u.exec(match[0])?.[1] ?? "",
    location: {
      path: body.location.path,
      line:
        body.location.line +
        body.text.slice(0, match.index ?? 0).split("\n").length -
        1,
    },
  }));
}

/**
 * 取得済み本文の表行と出典を捕捉する。
 * @responsibility 既存Cell分割だけを利用し、登録や被覆の適否を判断しない。
 * @trace ARCH-000008
 * @input source: 呼出し側が選択した本文とPath。
 * @returns Header・Separatorを含む出現順の表行。
 * @effect N/A: 既読文字列だけを扱う。
 * @failure 解析例外を伝播し、未認識行を捏造しない。
 */
export function captureDocumentTableRows(
  source: ArtifactSource,
): readonly DocumentTableRow[] {
  return source.content.split(/\r?\n/u).flatMap((line, index) => {
    const cells = parseMarkdownTableRow(line);
    return cells === null
      ? []
      : [{ cells, location: { path: source.path, line: index + 1 } }];
  });
}
