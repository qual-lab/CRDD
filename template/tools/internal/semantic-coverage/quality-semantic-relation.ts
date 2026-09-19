import { observeRepositoryRegularFile } from "../reality-traceability/repository-regular-file-observer.ts";
import type { RealitySymbolFinding } from "../reality-traceability/symbol-manifest-model.ts";
import type { SemanticIrPilot } from "./semantic-ir-compiler.ts";

export type QualitySemanticRelation = Readonly<{
  qaId: string;
  localId: string;
  semanticKey: string;
  sourceDocument: string;
}>;

const expectedHeaders = ["Local ID", "Semantic Key"] as const;

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((cell) => cell.trim());
}

function finding(
  code: string,
  path: string,
  message: string,
): RealitySymbolFinding {
  return { code, path, message };
}

export function compileQualitySemanticRelations(
  repositoryRoot: string,
  sourceDocuments: readonly string[],
  semanticIrs: readonly SemanticIrPilot[],
): Readonly<{
  relations: readonly QualitySemanticRelation[] | null;
  findings: readonly RealitySymbolFinding[];
}> {
  const knownSemanticKeys = new Set(
    semanticIrs.flatMap(({ meanings }) =>
      meanings.map(({ semanticKey }) => semanticKey),
    ),
  );
  const requiredSemanticKeys = new Set(
    semanticIrs.flatMap(({ meanings }) =>
      meanings
        .filter(({ verification }) => verification === "required")
        .map(({ semanticKey }) => semanticKey),
    ),
  );
  const findings: RealitySymbolFinding[] = [];
  const relations: QualitySemanticRelation[] = [];
  const relationKeys = new Set<string>();

  for (const sourceDocument of sourceDocuments) {
    const observation = observeRepositoryRegularFile(
      repositoryRoot,
      sourceDocument,
    );
    if (observation.status !== "resolved") {
      findings.push(
        finding(
          "quality-semantic-source-unobservable",
          sourceDocument,
          observation.reason,
        ),
      );
      continue;
    }
    const qaMatch = /(?:^|\/)(QA-[0-9]{6})\/quality_definition\.md$/u.exec(
      sourceDocument,
    );
    if (!qaMatch?.[1]) {
      findings.push(
        finding(
          "quality-semantic-qa-id-missing",
          sourceDocument,
          "Quality source path does not contain one QA-ID.",
        ),
      );
      continue;
    }
    const qaId = qaMatch[1];
    const lines = observation.source.split(/\r?\n/u);
    const headingIndex = lines.findIndex(
      (line) => line.trim() === "## Semantic Coverage Pilot",
    );
    if (headingIndex < 0) {
      findings.push(
        finding(
          "quality-semantic-table-missing",
          sourceDocument,
          "Visible Semantic Coverage Pilot table is missing.",
        ),
      );
      continue;
    }
    const tableStart = lines.findIndex(
      (line, index) => index > headingIndex && line.trim().startsWith("|"),
    );
    if (tableStart < 0) {
      findings.push(
        finding(
          "quality-semantic-table-missing",
          sourceDocument,
          "Semantic Coverage Pilot table is missing.",
        ),
      );
      continue;
    }
    if (
      JSON.stringify(parseTableRow(lines[tableStart] ?? "")) !==
      JSON.stringify(expectedHeaders)
    ) {
      findings.push(
        finding(
          "quality-semantic-header-invalid",
          sourceDocument,
          "Semantic Coverage Pilot headers do not match the pilot contract.",
        ),
      );
      continue;
    }
    const separators = parseTableRow(lines[tableStart + 1] ?? "");
    if (
      separators.length !== expectedHeaders.length ||
      separators.some((cell) => !/^:?-{3,}:?$/u.test(cell))
    ) {
      findings.push(
        finding(
          "quality-semantic-separator-invalid",
          sourceDocument,
          "Semantic Coverage Pilot separator is invalid.",
        ),
      );
      continue;
    }

    for (let index = tableStart + 2; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      if (!line.trim().startsWith("|")) break;
      const cells = parseTableRow(line);
      if (cells.length !== expectedHeaders.length) {
        findings.push(
          finding(
            "quality-semantic-row-invalid",
            sourceDocument,
            `Semantic relation row ${index + 1} is invalid.`,
          ),
        );
        continue;
      }
      const localMatch = /^`([A-Z]{3}-[0-9]{2})`$/u.exec(cells[0] ?? "");
      const localId = localMatch?.[1];
      if (!localId) {
        findings.push(
          finding(
            "quality-semantic-local-id-invalid",
            sourceDocument,
            `Row ${index + 1} has an invalid Local ID.`,
          ),
        );
        continue;
      }
      const localItemOccurrences =
        observation.source.split(`| \`${localId}\` |`).length - 1;
      if (localItemOccurrences < 2) {
        findings.push(
          finding(
            "quality-semantic-local-item-unknown",
            sourceDocument,
            `${localId} does not resolve to one verification item and one relation row.`,
          ),
        );
      }
      const semanticKeys = [...(cells[1] ?? "").matchAll(/`([^`]+)`/gu)]
        .map((match) => match[1])
        .filter((semanticKey): semanticKey is string => Boolean(semanticKey));
      if (semanticKeys.length === 0)
        findings.push(
          finding(
            "quality-semantic-key-missing",
            sourceDocument,
            `Row ${index + 1} has no Semantic Key.`,
          ),
        );
      for (const semanticKey of semanticKeys) {
        if (!knownSemanticKeys.has(semanticKey)) {
          findings.push(
            finding(
              "quality-semantic-key-unknown",
              sourceDocument,
              `${localId} verifies unknown Semantic Key ${semanticKey}.`,
            ),
          );
          continue;
        }
        const relationKey = `${qaId}:${localId}:${semanticKey}`;
        if (relationKeys.has(relationKey)) {
          findings.push(
            finding(
              "quality-semantic-relation-duplicate",
              sourceDocument,
              `${relationKey} is duplicated.`,
            ),
          );
          continue;
        }
        relationKeys.add(relationKey);
        relations.push({ qaId, localId, semanticKey, sourceDocument });
      }
    }
  }

  const relatedSemanticKeys = new Set(
    relations.map(({ semanticKey }) => semanticKey),
  );
  for (const semanticKey of requiredSemanticKeys)
    if (!relatedSemanticKeys.has(semanticKey))
      findings.push(
        finding(
          "quality-semantic-relation-missing",
          "07_Quality/Definitions",
          `${semanticKey} has no Quality Local Item relation.`,
        ),
      );

  return {
    relations:
      findings.length === 0
        ? relations.sort((left, right) =>
            `${left.qaId}:${left.localId}:${left.semanticKey}`.localeCompare(
              `${right.qaId}:${right.localId}:${right.semanticKey}`,
            ),
          )
        : null,
    findings,
  };
}
