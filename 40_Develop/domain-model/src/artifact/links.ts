/**
 * Markdown本文と参照文字列を解析する。
 *
 * @responsibility 参照先の抽出順・Label解決・targetとAnchorの一回Decodeを所有する。
 * @trace ARCH-000008
 * @boundary N/A: 文字列の構文だけを扱い、Filesystem・Git・Checkerへ依存しない。
 * @effect N/A: 外部I/Oや共有状態の変更を行わない。
 * @security 参照の存在・認可・Root内外やURLの安全性を判定しない。
 */
import type { MarkdownLinkReference } from "./types.ts";
import { omitMarkdownFencedCode } from "./anchors.ts";

/**
 * Markdown本文から参照先文字列を抽出する。
 *
 * @responsibility Inline・参照形式・短縮参照の順序と重複を保ち、Labelを解決する。
 * @trace ARCH-000008
 * @input text: string
 * @returns 未Decodeの参照先配列。本文順への並替え・重複排除・Path解決は行わない。
 * @precondition 「text: string」がparseMarkdownLinkTargetsの入力契約を満たす。
 * @postcondition parseMarkdownLinkTargetsの責務を完了した結果だけを返す。
 * @effect N/A: parseMarkdownLinkTargetsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseMarkdownLinkTargetsは独自の失敗分岐を所有しない。
 * @invariant parseMarkdownLinkTargetsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseMarkdownLinkTargetsはProcess内の同一Subsystemで完結する。
 * @security N/A: parseMarkdownLinkTargetsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseMarkdownLinkTargetsは共有非同期状態を持たない同期処理である。
 */
export function parseMarkdownLinkTargets(text: string): string[] {
  const content = omitMarkdownFencedCode(text);
  const definitions = new Map<string, string>();
  for (const match of content.matchAll(
    /^\s{0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)(?:\s+(?:["'(].*)?)?$/gmu,
  )) {
    definitions.set(normalizeReferenceLabel(match[1] ?? ""), match[2] ?? "");
  }
  const targets = [...content.matchAll(/(?<!!)\[[^\]]+\]\(([^)\n]+)\)/gu)].map(
    (match) => match[1] ?? "",
  );
  for (const match of content.matchAll(/(?<!!)\[([^\]]+)\]\[([^\]]*)\]/gu)) {
    const label = normalizeReferenceLabel(match[2] || match[1] || "");
    const target = definitions.get(label);
    if (target) targets.push(target);
  }
  for (const match of content.matchAll(/(?<!!)\[([^\]\n]+)\](?!\[|\()/gu)) {
    const matchEnd = (match.index ?? 0) + match[0].length;
    if (content[matchEnd] === ":") continue;
    const target = definitions.get(normalizeReferenceLabel(match[1] ?? ""));
    if (target) targets.push(target);
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
