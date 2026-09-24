/**
 * markdown-artifact-parserに属する責務をまとめる。
 *
 * @responsibility visibleLinesを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import type {
  ArtifactModel,
  ArtifactRelation,
  ArtifactSection,
  ArtifactSource,
  ChecklistResult,
} from "./artifact-model.ts";

/**
 * visible Linesを決定する。
 *
 * @responsibility visible Linesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input content: string
 * @returns readonly Readonly<{ line: number; text: string; }>[]を返す。
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
}>[] {
  const visibleLineEntries: Array<Readonly<{ line: number; text: string }>> =
    [];
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
        rendered += line.slice(cursor);
        break;
      }
      rendered += line.slice(cursor, start);
      isInComment = true;
      cursor = start + 4;
    }
    line = rendered;
    visibleLineEntries.push({ line: index + 1, text: line });
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
  const lines = visibleLines(source.content);
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
  for (const { line, text } of lines)
    for (const match of text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/gu)) {
      const targets = stableIds(`${match[1]} ${match[2]}`);
      for (const target of targets)
        relations.push({
          type: "markdown-link",
          target,
          location: { path: source.path, line },
        });
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
