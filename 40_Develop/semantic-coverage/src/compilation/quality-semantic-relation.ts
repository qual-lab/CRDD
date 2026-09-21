import type {
  SemanticIr,
  SemanticSourceDocument,
} from "./semantic-ir-compiler.ts";
import { semanticDomainIssue } from "./semantic-ir-compiler.ts";
import type {
  DomainIssue,
  DomainOutcome,
} from "../../../crdd-domain-library/src/index.ts";

/**
 * Quality Local Itemが検証するSemantic Meaningとの正方向Relationを表す。
 *
 * @responsibility QA Identity、Local Item、Semantic KeyおよびSourceを一組で保持する。
 * @trace ARCH-000008
 * @shape QualitySemanticRelationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant QualitySemanticRelationで宣言した値と責務の対応を維持する。
 * @boundary N/A: QualitySemanticRelationの宣言は外部境界を開かない。
 * @security N/A: QualitySemanticRelationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility QualitySemanticRelationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type QualitySemanticRelation = Readonly<{
  qaId: string;
  localId: string;
  semanticKey: string;
  sourceDocument: string;
}>;

const expectedHeaders = ["Local ID", "Semantic Key"] as const;

/**
 * Quality Definition内のRelation表をCell列へ分解する。
 *
 * @responsibility 表の外側DelimiterとCell余白だけを除き、列数検査を後段へ渡す。
 * @trace ARCH-000008
 * @input line: string
 * @returns string[]を返す。
 * @precondition line: stringがparseTableRowの入力契約を満たす。
 * @postcondition parseTableRowの責務を完了した結果だけを返す。
 * @effect N/A: parseTableRowは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseTableRowは独自の失敗分岐を所有しない。
 * @invariant parseTableRowは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseTableRowはProcess内の同一Subsystemで完結する。
 * @security N/A: parseTableRowはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseTableRowは共有非同期状態を持たない同期処理である。
 */
function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * Quality DefinitionからMeaningとLocal ItemのRelation集合を生成する。
 *
 * @responsibility Required Meaningの未接続、未知Meaning、曖昧なLocal Itemを拒否する。
 * @trace ARCH-000008
 * @input sourceDocuments: readonly SemanticSourceDocument[]、semanticIrs: readonly SemanticIr[]
 * @returns DomainOutcome<readonly QualitySemanticRelation[]>を返す。
 * @precondition sourceDocuments: readonly SemanticSourceDocument[]、semanticIrs: readonly SemanticIr[]がcompileQualitySemanticRelationsの入力契約を満たす。
 * @postcondition compileQualitySemanticRelationsの責務を完了した結果だけを返す。
 * @effect N/A: compileQualitySemanticRelationsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 不完全なRelation集合を成功結果として公開しない。
 * @invariant 成功結果のRelationは既知Meaningと一意なQA／Local Item組へ接続する。
 * @boundary N/A: compileQualitySemanticRelationsはProcess内の同一Subsystemで完結する。
 * @security N/A: compileQualitySemanticRelationsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: compileQualitySemanticRelationsは共有非同期状態を持たない同期処理である。
 */
export function compileQualitySemanticRelations(
  sourceDocuments: readonly SemanticSourceDocument[],
  semanticIrs: readonly SemanticIr[],
): DomainOutcome<readonly QualitySemanticRelation[]> {
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
  const issues: DomainIssue[] = [];
  const relations: QualitySemanticRelation[] = [];
  const relationKeys = new Set<string>();

  for (const sourceDocument of sourceDocuments) {
    const qaMatch = /(?:^|\/)(QA-[0-9]{6})\/quality_definition\.md$/u.exec(
      sourceDocument.path,
    );
    if (!qaMatch?.[1]) {
      issues.push(
        semanticDomainIssue(
          "quality.source.qa-id-missing",
          sourceDocument.path,
          "quality_identity_not_resolved_from_source_path",
        ),
      );
      continue;
    }
    const qaId = qaMatch[1];
    const lines = sourceDocument.source.split(/\r?\n/u);
    const headingIndex = lines.findIndex(
      (line) => line.trim() === "## Semantic Coverage Pilot",
    );
    if (headingIndex < 0) {
      issues.push(
        semanticDomainIssue(
          "quality.source.table-missing",
          sourceDocument.path,
          "quality_relation_heading_missing",
          { missingPart: "heading" },
        ),
      );
      continue;
    }
    const tableStart = lines.findIndex(
      (line, index) => index > headingIndex && line.trim().startsWith("|"),
    );
    if (tableStart < 0) {
      issues.push(
        semanticDomainIssue(
          "quality.source.table-missing",
          sourceDocument.path,
          "quality_relation_table_missing",
          { missingPart: "table" },
        ),
      );
      continue;
    }
    if (
      JSON.stringify(parseTableRow(lines[tableStart] ?? "")) !==
      JSON.stringify(expectedHeaders)
    ) {
      issues.push(
        semanticDomainIssue(
          "quality.source.header-invalid",
          sourceDocument.path,
          "quality_relation_header_does_not_match_contract",
        ),
      );
      continue;
    }
    const separators = parseTableRow(lines[tableStart + 1] ?? "");
    if (
      separators.length !== expectedHeaders.length ||
      separators.some((cell) => !/^:?-{3,}:?$/u.test(cell))
    ) {
      issues.push(
        semanticDomainIssue(
          "quality.source.separator-invalid",
          sourceDocument.path,
          "quality_relation_separator_invalid",
        ),
      );
      continue;
    }

    for (let index = tableStart + 2; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      if (!line.trim().startsWith("|")) break;
      const cells = parseTableRow(line);
      if (cells.length !== expectedHeaders.length) {
        issues.push(
          semanticDomainIssue(
            "quality.source.row-invalid",
            sourceDocument.path,
            "quality_relation_row_cell_count_invalid",
            { row: index + 1, cellCount: cells.length },
          ),
        );
        continue;
      }
      const localMatch = /^`([A-Z]{3}-(?:UT|IT|ST|UAT)-[0-9]{3})`$/u.exec(
        cells[0] ?? "",
      );
      const localId = localMatch?.[1];
      if (!localId) {
        issues.push(
          semanticDomainIssue(
            "quality.relation.local-id-invalid",
            sourceDocument.path,
            "quality_local_identity_shape_invalid",
            { row: index + 1 },
          ),
        );
        continue;
      }
      const localItemOccurrences =
        sourceDocument.source.split(`| \`${localId}\` |`).length - 1;
      if (localItemOccurrences < 2) {
        issues.push(
          semanticDomainIssue(
            "quality.relation.local-item-unresolved",
            sourceDocument.path,
            "quality_local_identity_does_not_resolve_required_pair",
            { localId },
            localId,
          ),
        );
      }
      const semanticKeys = [...(cells[1] ?? "").matchAll(/`([^`]+)`/gu)]
        .map((match) => match[1])
        .filter((semanticKey): semanticKey is string => Boolean(semanticKey));
      if (semanticKeys.length === 0)
        issues.push(
          semanticDomainIssue(
            "quality.relation.semantic-key-missing",
            sourceDocument.path,
            "semantic_key_missing_from_quality_relation",
            { row: index + 1 },
          ),
        );
      for (const semanticKey of semanticKeys) {
        if (!knownSemanticKeys.has(semanticKey)) {
          issues.push(
            semanticDomainIssue(
              "quality.relation.semantic-key-unresolved",
              sourceDocument.path,
              "semantic_key_unresolved_from_quality_relation",
              { localId, semanticKey },
              semanticKey,
            ),
          );
          continue;
        }
        const relationKey = `${qaId}:${localId}:${semanticKey}`;
        if (relationKeys.has(relationKey)) {
          issues.push(
            semanticDomainIssue(
              "quality.relation.duplicate",
              sourceDocument.path,
              "quality_semantic_relation_not_unique",
              { relationKey },
              relationKey,
            ),
          );
          continue;
        }
        relationKeys.add(relationKey);
        relations.push({
          qaId,
          localId,
          semanticKey,
          sourceDocument: sourceDocument.path,
        });
      }
    }
  }

  const relatedSemanticKeys = new Set(
    relations.map(({ semanticKey }) => semanticKey),
  );
  for (const semanticKey of requiredSemanticKeys)
    if (!relatedSemanticKeys.has(semanticKey))
      issues.push(
        semanticDomainIssue(
          "quality.relation.required-key-unmapped",
          "07_Quality/Definitions",
          "required_semantic_key_has_no_quality_relation",
          { semanticKey },
          semanticKey,
        ),
      );

  return {
    status: issues.length === 0 ? "complete" : "invalid",
    result:
      issues.length === 0
        ? relations.sort((left, right) =>
            `${left.qaId}:${left.localId}:${left.semanticKey}`.localeCompare(
              `${right.qaId}:${right.localId}:${right.semanticKey}`,
            ),
          )
        : null,
    issues,
  };
}
