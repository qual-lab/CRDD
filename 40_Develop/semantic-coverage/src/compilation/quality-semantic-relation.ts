/**
 * quality-semantic-relationに属する責務をまとめる。
 *
 * @responsibility QualitySemanticRelationを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
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
  executionMode: "automated" | "manual";
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
 * Quality Definitionの検証項目表からLocal Itemの実行形態を解決する。
 *
 * @responsibility 手動UATを自動Test Symbol欠落へ畳まず、Quality正本の実行形態をRelationへ搬送する。
 * @trace ARCH-000008
 * @input source: string、localId: string
 * @returns "automated" | "manual" | nullを返す。
 * @precondition sourceはQuality Definition全文、localIdは同Definition内の既知候補である。
 * @postcondition 実行形態が一意に解決できる場合だけ正規化済み値を返す。
 * @effect N/A: 入力文字列だけを読み取り、共有状態を変更しない。
 * @failure 表、行または実行形態が解決不能ならnullを返す。
 * @invariant AutomatedとManualを同じ観測状態へ統合しない。
 * @boundary N/A: Process内のMarkdown解析で完結する。
 * @security N/A: Authority、秘密値または外部Effectを扱わない。
 * @concurrency N/A: 共有非同期状態を持たない同期処理である。
 */
function resolveExecutionMode(
  source: string,
  localId: string,
): "automated" | "manual" | null {
  const lines = source.split(/\r?\n/u);
  const headerIndex = lines.findIndex((line) => {
    if (!line.trim().startsWith("|")) return false;
    const cells = parseTableRow(line);
    return cells.includes("Local ID") && cells.includes("実行形態");
  });
  if (headerIndex < 0) return null;
  const headers = parseTableRow(lines[headerIndex] ?? "");
  const localIdIndex = headers.indexOf("Local ID");
  const executionModeIndex = headers.indexOf("実行形態");
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line.trim().startsWith("|")) break;
    const cells = parseTableRow(line);
    if (cells[localIdIndex] !== `\`${localId}\``) continue;
    if (cells[executionModeIndex] === "Automated") return "automated";
    if (cells[executionModeIndex] === "Manual") return "manual";
    return null;
  }
  return null;
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
      const executionMode = resolveExecutionMode(
        sourceDocument.source,
        localId,
      );
      if (!executionMode) {
        issues.push(
          semanticDomainIssue(
            "quality.relation.execution-mode-unresolved",
            sourceDocument.path,
            "quality_local_execution_mode_not_resolved",
            { localId },
            localId,
          ),
        );
        continue;
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
          executionMode,
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
