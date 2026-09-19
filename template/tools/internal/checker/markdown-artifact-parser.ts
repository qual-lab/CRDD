import type {
  ArtifactModel,
  ArtifactRelation,
  ArtifactSection,
  ArtifactSource,
  ChecklistResult,
} from "./artifact-model.ts";

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
      fence = { marker: opening[0], length: opening.length };
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

function stableIds(value: string): string[] {
  return [
    ...value.matchAll(/\b(?:REQ|UX|IA|UI|SPEC|ARCH|QA)-[0-9]{6}\b/gu),
  ].map((match) => match[0]);
}

export function parseMarkdownArtifact(source: ArtifactSource): ArtifactModel {
  const lines = visibleLines(source.content);
  const headingEntries = lines.flatMap(({ line, text }) => {
    const heading = text.match(/^(#{1,6})\s+(.+?)\s*$/u);
    return heading
      ? [{ level: heading[1].length, title: heading[2], line }]
      : [];
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
