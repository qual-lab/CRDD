import crypto from "node:crypto";

import type { DomainIssue, DomainOutcome } from "../result/index.ts";

export type SemanticSourceDocument = Readonly<{
  path: string;
  source: string;
}>;

export type SemanticIrMeaning = Readonly<{
  semanticKey: string;
  kind: string;
  statement: string;
  archIds: readonly string[];
  verification: "required" | "not-applicable";
  sourceSection: string;
  notApplicableReason: string | null;
}>;

export type SemanticIr = Readonly<{
  contract: "crdd/semantic-ir-pilot";
  contractRevision: 0;
  stability: "pilot";
  subsystem: string;
  sourceDocument: string;
  sourceSha256: string;
  meanings: readonly SemanticIrMeaning[];
}>;

const expectedHeaders = [
  "Semantic Key",
  "種別",
  "要求する意味",
  "Architecture定義",
  "検証要否",
  "根拠節",
  "N/A理由",
] as const;

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((cell) => cell.trim());
}

function unwrapCode(value: string): string | null {
  const match = /^`([^`]+)`$/u.exec(value);
  return match?.[1] ?? null;
}

export function semanticDomainIssue(
  kind: string,
  path: string,
  reason: string,
  details: DomainIssue["details"] = {},
  targetIdentity = path,
): DomainIssue {
  return {
    kind,
    targetIdentity,
    location: { path },
    reason,
    details,
  };
}

export function compileSemanticIr(
  sourceDocument: SemanticSourceDocument,
  subsystem: string,
  architectureDefinitionIds: ReadonlySet<string>,
): DomainOutcome<SemanticIr> {
  const lines = sourceDocument.source.split(/\r?\n/u);
  const headingIndex = lines.findIndex((line) =>
    /^#{2,3}\s+.*機械生成する意味要素\s*$/u.test(line),
  );
  if (headingIndex < 0)
    return {
      status: "invalid",
      result: null,
      issues: [
        semanticDomainIssue(
          "ir.source.table-missing",
          sourceDocument.path,
          "source_heading_missing",
          { missingPart: "heading" },
        ),
      ],
    };

  const tableStart = lines.findIndex(
    (line, index) => index > headingIndex && line.trim().startsWith("|"),
  );
  if (tableStart < 0)
    return {
      status: "invalid",
      result: null,
      issues: [
        semanticDomainIssue(
          "ir.source.table-missing",
          sourceDocument.path,
          "source_table_missing",
          { missingPart: "table" },
        ),
      ],
    };
  const headers = parseTableRow(lines[tableStart] ?? "");
  if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders))
    return {
      status: "invalid",
      result: null,
      issues: [
        semanticDomainIssue(
          "ir.source.header-invalid",
          sourceDocument.path,
          "source_header_does_not_match_contract",
        ),
      ],
    };

  const separators = parseTableRow(lines[tableStart + 1] ?? "");
  if (
    separators.length !== expectedHeaders.length ||
    separators.some((cell) => !/^:?-{3,}:?$/u.test(cell))
  )
    return {
      status: "invalid",
      result: null,
      issues: [
        semanticDomainIssue(
          "ir.source.separator-invalid",
          sourceDocument.path,
          "source_separator_invalid",
        ),
      ],
    };

  const issues: DomainIssue[] = [];
  const meanings: SemanticIrMeaning[] = [];
  const semanticKeys = new Set<string>();
  for (let index = tableStart + 2; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line.trim().startsWith("|")) break;
    const cells = parseTableRow(line);
    if (cells.length !== expectedHeaders.length) {
      issues.push(
        semanticDomainIssue(
          "ir.source.row-invalid",
          sourceDocument.path,
          "source_row_cell_count_invalid",
          { row: index + 1, cellCount: cells.length },
        ),
      );
      continue;
    }
    const semanticKey = unwrapCode(cells[0] ?? "");
    const kind = unwrapCode(cells[1] ?? "");
    const statement = cells[2] ?? "";
    const archIds = [...(cells[3] ?? "").matchAll(/`(ARCH-[0-9]{6})`/gu)]
      .map((match) => match[1])
      .filter((id): id is string => Boolean(id));
    const verificationValue = unwrapCode(cells[4] ?? "");
    const sourceSection = unwrapCode(cells[5] ?? "");
    const notApplicableReason = cells[6] === "—" ? null : (cells[6] ?? null);

    if (!semanticKey?.startsWith(`${subsystem}.`))
      issues.push(
        semanticDomainIssue(
          "ir.meaning.key-invalid",
          sourceDocument.path,
          "meaning_key_not_in_subsystem_namespace",
          { row: index + 1, subsystem },
        ),
      );
    else if (semanticKeys.has(semanticKey))
      issues.push(
        semanticDomainIssue(
          "ir.meaning.key-duplicate",
          sourceDocument.path,
          "meaning_key_not_unique",
          { semanticKey },
          semanticKey,
        ),
      );
    else semanticKeys.add(semanticKey);
    if (!kind || !/^[a-z][a-z0-9-]*$/u.test(kind))
      issues.push(
        semanticDomainIssue(
          "ir.meaning.kind-invalid",
          sourceDocument.path,
          "meaning_kind_shape_invalid",
          { row: index + 1 },
        ),
      );
    if (!statement)
      issues.push(
        semanticDomainIssue(
          "ir.meaning.statement-missing",
          sourceDocument.path,
          "meaning_statement_missing",
          { row: index + 1 },
        ),
      );
    if (archIds.length === 0)
      issues.push(
        semanticDomainIssue(
          "ir.meaning.architecture-id-missing",
          sourceDocument.path,
          "architecture_identity_missing",
          { row: index + 1 },
        ),
      );
    for (const archId of archIds) {
      if (!architectureDefinitionIds.has(archId))
        issues.push(
          semanticDomainIssue(
            "ir.meaning.architecture-id-unresolved",
            sourceDocument.path,
            "architecture_identity_unresolved",
            { archId },
            archId,
          ),
        );
    }
    const verification =
      verificationValue === "Required"
        ? "required"
        : verificationValue === "N/A"
          ? "not-applicable"
          : null;
    if (!verification)
      issues.push(
        semanticDomainIssue(
          "ir.meaning.verification-invalid",
          sourceDocument.path,
          "verification_value_not_supported",
          { row: index + 1 },
        ),
      );
    if (
      verification === "not-applicable" &&
      (!notApplicableReason || notApplicableReason.length === 0)
    )
      issues.push(
        semanticDomainIssue(
          "ir.meaning.not-applicable-reason-missing",
          sourceDocument.path,
          "not_applicable_reason_missing",
          { row: index + 1 },
        ),
      );
    if (
      !sourceSection ||
      !lines.some((candidate) => candidate.trim() === sourceSection)
    )
      issues.push(
        semanticDomainIssue(
          "ir.meaning.source-section-unresolved",
          sourceDocument.path,
          "source_section_unresolved",
          { row: index + 1 },
        ),
      );

    if (
      semanticKey &&
      kind &&
      statement &&
      archIds.length > 0 &&
      verification &&
      sourceSection
    )
      meanings.push({
        semanticKey,
        kind,
        statement,
        archIds: [...new Set(archIds)].sort(),
        verification,
        sourceSection,
        notApplicableReason,
      });
  }

  if (meanings.length === 0)
    issues.push(
      semanticDomainIssue(
        "ir.source.meanings-empty",
        sourceDocument.path,
        "source_has_no_meaning_rows",
      ),
    );
  if (issues.length > 0) return { status: "invalid", result: null, issues };

  return {
    status: "complete",
    result: {
      contract: "crdd/semantic-ir-pilot",
      contractRevision: 0,
      stability: "pilot",
      subsystem,
      sourceDocument: sourceDocument.path,
      sourceSha256: crypto
        .createHash("sha256")
        .update(sourceDocument.source, "utf8")
        .digest("hex"),
      meanings: meanings.sort((left, right) =>
        left.semanticKey.localeCompare(right.semanticKey),
      ),
    },
    issues: [],
  };
}
