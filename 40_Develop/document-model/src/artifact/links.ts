/**
 * Markdown本文と参照文字列を解析する。
 *
 * @responsibility 参照先の抽出順・Label解決・targetとAnchorの一回Decodeを所有する。
 * @trace ARCH-000008
 * @boundary N/A: 文字列の構文だけを扱い、Filesystem・Git・Checkerへ依存しない。
 * @effect N/A: 外部I/Oや共有状態の変更を行わない。
 * @security 参照の存在・認可・Root内外やURLの安全性を判定しない。
 */

import { omitMarkdownFencedCode } from "./anchors.ts";
import { omitMarkdownCommentsAndFencedCode } from "./markdown.ts";
import type {
  ArtifactModel,
  ArtifactSource,
  MarkdownLinkReference,
} from "./types.ts";

const inlineLinkPattern = /(?<!!)\[[^\]]+\]\(([^)\n]+)\)/gu;

/**
 * 表示される本文のインラインリンクと、各見出しレベルの直前出典を捕捉する。
 * @trace ARCH-000008
 * @boundary 一覧候補用の構文観測。Checkerの診断リンク集合には混ぜず、Path・認可も判断しない。
 */
export function captureBodyInlineLinks(
  source: ArtifactSource,
): ArtifactModel["bodyInlineLinks"] {
  const body = omitMarkdownCommentsAndFencedCode(
    source.content.replace(/\r\n?/gu, "\n"),
  );
  const visible = body.replace(
    /(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/gu,
    (span) => span.replace(/[^\n]/g, " "),
  );
  const visibleLines = visible.split("\n");
  const precedingHeadings = new Map<number, string>();
  const links: ArtifactModel["bodyInlineLinks"][number][] = [];
  for (const [index, line] of body.split("\n").entries()) {
    const visibleLine = visibleLines[index] ?? "";
    const heading = /^(#{1,6})\s+(.+?)\s*$/u.exec(line);
    if (heading?.[1] && heading[2] && visibleLine.startsWith("#"))
      precedingHeadings.set(heading[1].length, heading[2]);
    for (const match of line.matchAll(inlineLinkPattern)) {
      if (visibleLine[match.index] !== "[") continue;
      links.push({
        target: match[1] ?? "",
        location: { path: source.path, line: index + 1 },
        precedingHeadings: [...precedingHeadings].map(([level, title]) => ({
          level,
          title,
        })),
      });
    }
  }
  return links;
}

/**
 * Markdown本文から参照先と出現単位の注記を抽出する。
 *
 * @responsibility Inline・参照形式・短縮参照の順序と重複を保ち、Labelを解決する。
 * @trace ARCH-000008
 * @input text: string
 * @returns 未Decodeの参照先・位置と出現単位の旧参照注記。走査順と重複を維持する。
 * @precondition textは取得済みの本文である。
 * @postcondition 通常参照の三走査順と重複を保持し、注記した出現だけを分類する。
 * @effect N/A: 入力と局所値だけを扱う。
 * @failure N/A: 独自の失敗分岐を持たない。
 * @invariant 未Decodeのtargetを保持し、並替え・重複排除しない。
 * @boundary N/A: Process内の純粋な構文解析である。
 * @security historicalは存在・安全・認可の証明ではない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function parseMarkdownLinks(text: string): readonly Readonly<{
  target: string;
  historical: boolean;
  related: boolean;
  offset: number;
}>[] {
  const content = omitMarkdownFencedCode(text);
  const commentVisible = omitMarkdownCommentsAndFencedCode(content);
  const visible = commentVisible.replace(/(`+)[\s\S]*?\1(?!`)/gu, (span) =>
    span.replace(/[^\n]/g, " "),
  );
  const definitions = new Map<string, string>();
  for (const match of content.matchAll(
    /^\s{0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)(?:\s+(?:["'(].*)?)?$/gmu,
  )) {
    definitions.set(normalizeReferenceLabel(match[1] ?? ""), match[2] ?? "");
  }
  const annotatedRanges: Array<readonly [number, number]> = [];
  const relatedRanges = [
    ...content.matchAll(/^Related:\n(?:- [^\n]*(?:\n|$))+/gmu),
  ].map((match) => [match.index, match.index + match[0].length] as const);
  const targets = [...content.matchAll(inlineLinkPattern)].map((match) => {
    const start = match.index;
    const prefixStart = start - "[旧参照]".length;
    const slashes =
      content.slice(0, prefixStart).match(/\\+$/u)?.[0].length ?? 0;
    const historical =
      prefixStart >= 0 &&
      visible.slice(prefixStart, start) === "[旧参照]" &&
      visible[start] === "[" &&
      commentVisible.slice(start, start + match[0].length) === match[0] &&
      slashes % 2 === 0;
    if (historical)
      annotatedRanges.push([prefixStart, start + match[0].length]);
    const related = relatedRanges.some(
      ([from, to]) => start >= from && start < to,
    );
    return {
      target: match[1] ?? "",
      historical,
      related,
      offset: start,
    };
  });
  for (const match of content.matchAll(/(?<!!)\[([^\]]+)\]\[([^\]]*)\]/gu)) {
    if (
      annotatedRanges.some(
        ([start, end]) => match.index >= start && match.index < end,
      )
    )
      continue;
    const label = normalizeReferenceLabel(match[2] || match[1] || "");
    const target = definitions.get(label);
    if (target)
      targets.push({
        target,
        historical: false,
        offset: match.index,
        related: relatedRanges.some(
          ([from, to]) => match.index >= from && match.index < to,
        ),
      });
  }
  for (const match of content.matchAll(/(?<!!)\[([^\]\n]+)\](?!\[|\()/gu)) {
    if (
      annotatedRanges.some(
        ([start, end]) => match.index >= start && match.index < end,
      )
    )
      continue;
    const matchEnd = (match.index ?? 0) + match[0].length;
    if (content[matchEnd] === ":") continue;
    const target = definitions.get(normalizeReferenceLabel(match[1] ?? ""));
    if (target)
      targets.push({
        target,
        historical: false,
        offset: match.index,
        related: relatedRanges.some(
          ([from, to]) => match.index >= from && match.index < to,
        ),
      });
  }
  return targets;
}

/**
 * 参照Labelの前後空白を除き、連続空白と大小文字を正規化する。
 *
 * @responsibility trim・空白縮約・小文字化による参照定義照合用の文字列変換を所有する。
 * @trace ARCH-000008
 * @input value: string
 * @returns stringを返す。
 * @precondition 「value: string」がnormalizeReferenceLabelの入力契約を満たす。
 * @postcondition normalizeReferenceLabelの責務を完了した結果だけを返す。
 * @effect N/A: normalizeReferenceLabelは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeReferenceLabelは独自の失敗分岐を所有しない。
 * @invariant normalizeReferenceLabelは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeReferenceLabelはProcess内の同一Subsystemで完結する。
 * @security N/A: normalizeReferenceLabelはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: normalizeReferenceLabelは共有非同期状態を持たない同期処理である。
 */
function normalizeReferenceLabel(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLowerCase();
}

/**
 * URI文字列を一度Decodeし、失敗した場合は原文を返す。
 *
 * @responsibility URI Decodeの結果または元文字列と、失敗flagを返す。
 * @trace ARCH-000008
 * @input value: string
 * @returns Readonly<{ value: string; error: boolean }>を返す。
 * @precondition 「value: string」がsafeDecodeの入力契約を満たす。
 * @postcondition safeDecodeの責務を完了した結果だけを返す。
 * @effect N/A: safeDecodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure Decode例外は外へ投げず、元文字列とerror:trueで表す。拒否や安全性判断は行わない。
 * @invariant safeDecodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: safeDecodeはProcess内の同一Subsystemで完結する。
 * @security N/A: safeDecodeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: safeDecodeは共有非同期状態を持たない同期処理である。
 */
function safeDecode(
  value: string,
): Readonly<{ value: string; error: boolean }> {
  try {
    return { value: decodeURIComponent(value), error: false };
  } catch {
    return { value, error: true };
  }
}

/**
 * 参照文字列からtargetとAnchorを分け、一度だけURI Decodeする。
 *
 * @responsibility 山括弧・引用Titleの処置、最初の#での分割と部分Decode失敗の保持を所有する。
 * @trace ARCH-000008
 * @input raw: string
 * @returns 参照文字列とAnchor、Decode失敗の有無。存在・Root内外・URL安全性は表さない。
 * @precondition 「raw: string」がparseMarkdownLinkReferenceの入力契約を満たす。
 * @postcondition parseMarkdownLinkReferenceの責務を完了した結果だけを返す。
 * @effect N/A: parseMarkdownLinkReferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseMarkdownLinkReferenceは独自の失敗分岐を所有しない。
 * @invariant parseMarkdownLinkReferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseMarkdownLinkReferenceはProcess内の同一Subsystemで完結する。
 * @security N/A: parseMarkdownLinkReferenceはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseMarkdownLinkReferenceは共有非同期状態を持たない同期処理である。
 */
export function parseMarkdownLinkReference(raw: string): MarkdownLinkReference {
  let value = raw.trim();
  if (value.startsWith("<") && value.includes(">")) {
    value = value.slice(1, value.indexOf(">"));
  } else {
    value = value.split(/\s+["']/u, 1)[0] ?? "";
  }
  const index = value.indexOf("#");
  const target = index >= 0 ? value.slice(0, index) : value;
  const anchor = index >= 0 ? value.slice(index + 1) : "";
  const decodedTarget = safeDecode(target);
  const decodedAnchor = safeDecode(anchor);
  return {
    target: decodedTarget.value,
    anchor: decodedAnchor.value,
    decodeError: decodedTarget.error || decodedAnchor.error,
  };
}
