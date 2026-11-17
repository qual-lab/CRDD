/**
 * markdown-artifact-parserに属する責務をまとめる。
 *
 * @responsibility visibleLinesを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import { omitMarkdownFencedCode, parseMarkdownAnchors } from "./anchors.ts";
import { inspectRelatedOrder } from "./document-header.ts";
import { captureArtifactIdentity } from "./identity.ts";
import { parseMarkdownLinkReference, parseMarkdownLinks } from "./links.ts";
import { isMarkdownTableSeparator, parseMarkdownTableRow } from "./markdown.ts";
import type {
  ArtifactModel,
  ArtifactRelation,
  ArtifactSection,
  ArtifactSource,
  ChecklistResult,
  ParseResult,
} from "./types.ts";
import {
  type ArtifactSchema,
  validateArtifactSchema,
} from "./validate-schema.ts";

/**
 * visible Linesを決定する。
 *
 * @responsibility visible Linesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input content: string
 * @returns 既存の可視行と、UTF-16単位の表示列→元列の区間対応を返す。
 * @precondition 「content: string」がvisibleLinesの入力契約を満たす。
 * @postcondition visibleLinesの責務を完了した結果だけを返す。
 * @effect N/A: visibleLinesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: visibleLinesは独自の失敗分岐を所有しない。
 * @invariant visibleLinesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: visibleLinesはProcess内の同一Subsystemで完結する。
 * @security N/A: visibleLinesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: visibleLinesは共有非同期状態を持たない同期処理である。
 */
function visibleLines(content: string): readonly Readonly<{
  line: number;
  text: string;
  columns: readonly (readonly [rendered: number, original: number])[];
}>[] {
  const visibleLineEntries: Array<
    Readonly<{
      line: number;
      text: string;
      columns: readonly (readonly [number, number])[];
    }>
  > = [];
  let fence: Readonly<{ marker: string; length: number }> | null = null;
  let isInComment = false;
  for (const [index, original] of content.split(/\r?\n/u).entries()) {
    let line = original;
    if (fence) {
      const closing = line.match(/^\s*(`{3,}|~{3,})\s*$/u)?.[1];
      if (
        closing &&
        closing[0] === fence.marker &&
        closing.length >= fence.length
      )
        fence = null;
      continue;
    }
    const opening = line.match(/^\s*(`{3,}|~{3,})/u)?.[1];
    if (opening) {
      fence = { marker: opening.charAt(0), length: opening.length };
      continue;
    }
    let rendered = "";
    const columns: Array<readonly [number, number]> = [];
    for (let cursor = 0; cursor < line.length; ) {
      if (isInComment) {
        const end = line.indexOf("-->", cursor);
        if (end < 0) {
          cursor = line.length;
          continue;
        }
        isInComment = false;
        cursor = end + 3;
        continue;
      }
      const start = line.indexOf("<!--", cursor);
      if (start < 0) {
        if (cursor < line.length) columns.push([rendered.length, cursor]);
        rendered += line.slice(cursor);
        break;
      }
      if (start > cursor) columns.push([rendered.length, cursor]);
      rendered += line.slice(cursor, start);
      isInComment = true;
      cursor = start + 4;
    }
    line = rendered;
    visibleLineEntries.push({ line: index + 1, text: line, columns });
  }
  return visibleLineEntries;
}

/**
 * propertyを決定する。
 *
 * @responsibility propertyの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input lines: readonly Readonly<{ line: number; text: string }>[]、name: string
 * @returns string | nullを返す。
 * @precondition 「lines: readonly Readonly<{ line: number; text: string }>[]、name: string」がpropertyの入力契約を満たす。
 * @postcondition propertyの責務を完了した結果だけを返す。
 * @effect N/A: propertyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: propertyは独自の失敗分岐を所有しない。
 * @invariant propertyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: propertyはProcess内の同一Subsystemで完結する。
 * @security N/A: propertyはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: propertyは共有非同期状態を持たない同期処理である。
 */
function property(
  lines: readonly Readonly<{ line: number; text: string }>[],
  name: string,
): string | null {
  const expression = new RegExp(`^${name}:\\s*(.+?)\\s*$`, "u");
  return (
    lines
      .map(({ text }) => text.match(expression)?.[1] ?? null)
      .find(Boolean) ?? null
  );
}

/**
 * Idsを安定Identityへ変換する。
 *
 * @responsibility Idsの正規化条件、一意性、変換不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: string
 * @returns string[]を返す。
 * @precondition 「value: string」がstableIdsの入力契約を満たす。
 * @postcondition stableIdsの責務を完了した結果だけを返す。
 * @effect N/A: stableIdsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: stableIdsは独自の失敗分岐を所有しない。
 * @invariant stableIdsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: stableIdsはProcess内の同一Subsystemで完結する。
 * @security N/A: stableIdsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: stableIdsは共有非同期状態を持たない同期処理である。
 */
function stableIds(value: string): string[] {
  return [
    ...value.matchAll(/\b(?:REQ|UX|IA|UI|SPEC|ARCH|QA)-[0-9]{6}\b/gu),
  ].map((match) => match[0]);
}

/**
 * Markdown Artifactを構造化値へ解析する。
 *
 * @responsibility Markdown Artifactの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000008
 * @input source: ArtifactSource
 * @returns ArtifactModelを返す。
 * @precondition 「source: ArtifactSource」がparseMarkdownArtifactの入力契約を満たす。
 * @postcondition parseMarkdownArtifactの責務を完了した結果だけを返す。
 * @effect N/A: parseMarkdownArtifactは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseMarkdownArtifactは独自の失敗分岐を所有しない。
 * @invariant parseMarkdownArtifactは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseMarkdownArtifactはProcess内の同一Subsystemで完結する。
 * @security N/A: parseMarkdownArtifactはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseMarkdownArtifactは共有非同期状態を持たない同期処理である。
 */
export function parseMarkdownArtifact(source: ArtifactSource): ArtifactModel {
  source = { path: source.path, content: source.content };
  const identity = captureArtifactIdentity(source);
  const related = inspectRelatedOrder(source);
  const lines = visibleLines(source.content);
  const parsedLinks = parseMarkdownLinks(source.content);
  const historicalDocument =
    /(?:^|\/)Evidence\//u.test(source.path) ||
    /(?:^|\/)Changes\/CHG-\d{6}\//u.test(source.path) ||
    /(?:^|\/)CHANGELOG\.md$/u.test(source.path);
  const links: ArtifactModel["links"] = parsedLinks.map((link) => ({
    target: link.target,
    related: link.related,
    historical: !link.historical
      ? null
      : historicalDocument &&
          !link.related &&
          !/^(?:https?|mailto|tel):/iu.test(
            parseMarkdownLinkReference(link.target).target,
          )
        ? "declared"
        : "invalid",
  }));
  const historicalPositions = new Set<string>();
  const linkContent = omitMarkdownFencedCode(source.content);
  let linkLine = 1;
  let previousOffset = 0;
  for (const [index, link] of parsedLinks.entries()) {
    if (links[index]?.historical !== "declared") continue;
    linkLine +=
      linkContent.slice(previousOffset, link.offset).match(/\n/gu)?.length ?? 0;
    const column =
      link.offset - linkContent.lastIndexOf("\n", link.offset - 1) - 1;
    historicalPositions.add(`${linkLine}:${column}`);
    previousOffset = link.offset;
  }
  const linkIssues = links
    .filter((link) => link.historical === "invalid")
    .map((link) => ({
      kind: "artifact.link.historical-reference-not-allowed",
      targetIdentity: source.path,
      location: { path: source.path },
      reason: "historical_annotation_not_allowed",
      details: { target: link.target },
    }));
  const headingEntries = lines.flatMap(({ line, text }) => {
    const heading = text.match(/^(#{1,6})\s+(.+?)\s*$/u);
    const marker = heading?.[1];
    const title = heading?.[2];
    return marker && title ? [{ level: marker.length, title, line }] : [];
  });
  const documentEnd = (lines.at(-1)?.line ?? 0) + 1;
  const sections: ArtifactSection[] = headingEntries.map((heading, index) => {
    const end = headingEntries[index + 1]?.line ?? documentEnd;
    return {
      level: heading.level,
      title: heading.title,
      body: lines
        .filter(({ line }) => line > heading.line && line < end)
        .map(({ text }) => text)
        .join("\n"),
      location: { path: source.path, line: heading.line },
    };
  });
  const canonicalId =
    property(
      lines,
      "(?:要求ID|UX ID|IA ID|UI ID|SPEC ID|Architecture ID|Quality ID)",
    ) ??
    stableIds(headingEntries[0]?.title ?? "")[0] ??
    null;
  const formalInputs = [
    ...new Set(
      lines
        .filter(({ text }) =>
          /^(?:正式入力|分析対象|Canonical入力):/u.test(text),
        )
        .flatMap(({ text }) => stableIds(text)),
    ),
  ];
  const provenanceIds = [
    ...new Set(
      lines
        .filter(({ text }) =>
          /^(?:探索元|情報源|Source Context|由来):/u.test(text),
        )
        .flatMap(({ text }) => stableIds(text)),
    ),
  ];
  const relations: ArtifactRelation[] = [];
  for (const { line, text, columns } of lines) {
    for (const match of text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/gu)) {
      const position = columns.findLast(
        ([rendered]) => rendered <= match.index,
      );
      const originalColumn = position
        ? position[1] + match.index - position[0]
        : match.index;
      if (historicalPositions.has(`${line}:${originalColumn}`)) continue;
      const targets = stableIds(`${match[1]} ${match[2]}`);
      for (const target of targets)
        relations.push({
          type: "markdown-link",
          target,
          location: { path: source.path, line },
        });
    }
  }
  const checklistResults: ChecklistResult[] = [];
  const checklistSection = sections.find(
    (section) => section.title === "Checklist",
  );
  if (checklistSection)
    for (const [offset, text] of checklistSection.body
      .split(/\r?\n/u)
      .entries()) {
      const checked = text.match(/^- \[x\]\s+(.+)$/iu);
      const unchecked = text.match(/^- \[ \]\s+(.+)$/u);
      const classified = text.match(/^- (OPEN|FAIL|N\/A):\s*(.+)$/u);
      if (!checked && !unchecked && !classified) continue;
      const result = checked
        ? "passed"
        : unchecked
          ? "unchecked"
          : classified?.[1] === "OPEN"
            ? "open"
            : classified?.[1] === "FAIL"
              ? "failed"
              : "not_applicable";
      const value = checked?.[1] ?? unchecked?.[1] ?? classified?.[2] ?? "";
      const [reason, item] = classified
        ? value.split(/\s+—\s+/u, 2)
        : [null, value];
      checklistResults.push({
        result,
        text: item ?? value,
        reason,
        location: {
          path: source.path,
          line: checklistSection.location.line + offset + 1,
        },
      });
    }
  return {
    source,
    anchors: parseMarkdownAnchors(source.content),
    links,
    identity: identity.result,
    hasRelated: related.hasRelated,
    localIssues: [...identity.issues, ...related.issues, ...linkIssues],
    verificationLines: omitMarkdownFencedCode(source.content)
      .split(/\r?\n/u)
      .map((text) => {
        const cells = parseMarkdownTableRow(text);
        return {
          text,
          cells,
          separatorCellCount:
            cells && isMarkdownTableSeparator(text, cells.length)
              ? cells.length
              : null,
        };
      }),
    artifactType: property(lines, "成果物種別"),
    canonicalId,
    status: property(lines, "状態"),
    formalInputs,
    provenance: provenanceIds,
    sections,
    relations,
    checklist: checklistResults,
    sourceLocation: { path: source.path, line: 1 },
  };
}

/**
 * 取得済み成果物を内容モデルと局所診断へ一括して受け付ける。
 * @responsibility 構造・参照・Identity・Relatedと明示Schemaの診断を返す。
 * @trace ARCH-000008
 * @input source: 取得済み本文。options.schemas: 明示された適用Schema。
 * @returns 部分内容も保持するParseResult。completeは品質Passではない。
 * @effect N/A: File読取り・保存・外部送信は行わない。
 * @failure Schema callbackの例外は伝播し、適用判定を省略しない。
 */
export function parseArtifact(
  source: ArtifactSource,
  options: Readonly<{ schemas?: readonly ArtifactSchema[] }> = {},
): ParseResult<ArtifactModel> & Readonly<{ result: ArtifactModel }> {
  const result = parseMarkdownArtifact(source);
  const issues = [...result.localIssues];
  for (const schema of options.schemas ?? [])
    if (schema.matches(result))
      issues.push(...validateArtifactSchema(result, schema).issues);
  return { status: issues.length ? "partial" : "complete", result, issues };
}
