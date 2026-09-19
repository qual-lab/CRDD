import crypto from "node:crypto";

import { observeRepositoryRegularFile } from "../reality-traceability/repository-regular-file-observer.ts";
import type { LegacyRuntimeInventoryFinding } from "./legacy-runtime-inventory.ts";

export type SemanticIrMeaning = Readonly<{
  semanticKey: string;
  kind: string;
  statement: string;
  archIds: readonly string[];
  verification: "required" | "not-applicable";
  sourceSection: string;
  notApplicableReason: string | null;
}>;

export type SemanticIrPilot = Readonly<{
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

function finding(
  code: string,
  path: string,
  message: string,
): LegacyRuntimeInventoryFinding {
  return { code, path, message };
}

export function compileSemanticIrPilot(
  repositoryRoot: string,
  sourceDocument: string,
  subsystem: string,
): Readonly<{
  ir: SemanticIrPilot | null;
  findings: readonly LegacyRuntimeInventoryFinding[];
}> {
  const observation = observeRepositoryRegularFile(
    repositoryRoot,
    sourceDocument,
  );
  if (observation.status !== "resolved")
    return {
      ir: null,
      findings: [
        finding(
          "semantic-ir-source-unobservable",
          sourceDocument,
          observation.reason,
        ),
      ],
    };

  const lines = observation.source.split(/\r?\n/u);
  const headingIndex = lines.findIndex((line) =>
    /^#{2,3}\s+.*機械生成する意味要素\s*$/u.test(line),
  );
  if (headingIndex < 0)
    return {
      ir: null,
      findings: [
        finding(
          "semantic-ir-source-table-missing",
          sourceDocument,
          "visible semantic source table heading is missing",
        ),
      ],
    };

  const tableStart = lines.findIndex(
    (line, index) => index > headingIndex && line.trim().startsWith("|"),
  );
  if (tableStart < 0)
    return {
      ir: null,
      findings: [
        finding(
          "semantic-ir-source-table-missing",
          sourceDocument,
          "semantic source table is missing",
        ),
      ],
    };
  const headers = parseTableRow(lines[tableStart] ?? "");
  if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders))
    return {
      ir: null,
      findings: [
        finding(
          "semantic-ir-source-header-invalid",
          sourceDocument,
          "semantic source table headers do not match the pilot contract",
        ),
      ],
    };

  const separators = parseTableRow(lines[tableStart + 1] ?? "");
  if (
    separators.length !== expectedHeaders.length ||
    separators.some((cell) => !/^:?-{3,}:?$/u.test(cell))
  )
    return {
      ir: null,
      findings: [
        finding(
          "semantic-ir-source-separator-invalid",
          sourceDocument,
          "semantic source table separator is invalid",
        ),
      ],
    };

  const findings: LegacyRuntimeInventoryFinding[] = [];
  const meanings: SemanticIrMeaning[] = [];
  const semanticKeys = new Set<string>();
  for (let index = tableStart + 2; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line.trim().startsWith("|")) break;
    const cells = parseTableRow(line);
    if (cells.length !== expectedHeaders.length) {
      findings.push(
        finding(
          "semantic-ir-source-row-invalid",
          sourceDocument,
          `semantic source row ${index + 1} has ${cells.length} cells`,
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
      findings.push(
        finding(
          "semantic-ir-key-invalid",
          sourceDocument,
          `row ${index + 1} has an invalid pilot Semantic Key`,
        ),
      );
    else if (semanticKeys.has(semanticKey))
      findings.push(
        finding(
          "semantic-ir-key-duplicate",
          sourceDocument,
          `${semanticKey} is duplicated`,
        ),
      );
    else semanticKeys.add(semanticKey);
    if (!kind || !/^[a-z][a-z0-9-]*$/u.test(kind))
      findings.push(
        finding(
          "semantic-ir-kind-invalid",
          sourceDocument,
          `row ${index + 1} has an invalid pilot kind`,
        ),
      );
    if (!statement)
      findings.push(
        finding(
          "semantic-ir-statement-missing",
          sourceDocument,
          `row ${index + 1} has no required meaning`,
        ),
      );
    if (archIds.length === 0)
      findings.push(
        finding(
          "semantic-ir-architecture-id-missing",
          sourceDocument,
          `row ${index + 1} has no ARCH-ID`,
        ),
      );
    for (const archId of archIds) {
      const definition = observeRepositoryRegularFile(
        repositoryRoot,
        `06_Architecture/Definitions/${archId}/architecture_definition.md`,
      );
      if (definition.status !== "resolved")
        findings.push(
          finding(
            "semantic-ir-architecture-id-unknown",
            sourceDocument,
            `${archId} does not resolve to one regular definition file`,
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
      findings.push(
        finding(
          "semantic-ir-verification-invalid",
          sourceDocument,
          `row ${index + 1} must use Required or N/A`,
        ),
      );
    if (
      verification === "not-applicable" &&
      (!notApplicableReason || notApplicableReason.length === 0)
    )
      findings.push(
        finding(
          "semantic-ir-not-applicable-reason-missing",
          sourceDocument,
          `row ${index + 1} has N/A without an architecture reason`,
        ),
      );
    if (
      !sourceSection ||
      !lines.some((candidate) => candidate.trim() === sourceSection)
    )
      findings.push(
        finding(
          "semantic-ir-source-section-missing",
          sourceDocument,
          `row ${index + 1} does not resolve one exact source heading`,
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
    findings.push(
      finding(
        "semantic-ir-source-empty",
        sourceDocument,
        "semantic source table has no meaning rows",
      ),
    );
  if (findings.length > 0) return { ir: null, findings };

  return {
    ir: {
      contract: "crdd/semantic-ir-pilot",
      contractRevision: 0,
      stability: "pilot",
      subsystem,
      sourceDocument,
      sourceSha256: crypto
        .createHash("sha256")
        .update(observation.source, "utf8")
        .digest("hex"),
      meanings: meanings.sort((left, right) =>
        left.semanticKey.localeCompare(right.semanticKey),
      ),
    },
    findings: [],
  };
}
