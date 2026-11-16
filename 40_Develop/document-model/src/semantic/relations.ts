/**
 * 工程モデル間と品質Semanticの関係を評価する。
 *
 * @responsibility 解析済みモデルとSemantic IRの関係・重複・閉包を中立Issueへ変換する。
 * @trace ARCH-000008
 */

import path from "node:path";
import type {
  ArchitectureDetailModel,
  ArchitectureDetailTrace,
} from "../architecture/details.ts";
import type { ArchitectureRegistryModel } from "../architecture/relations.ts";
import type {
  ArchitectureAnalysis,
  ArchitectureCrossModel,
  ArchitectureDefinition,
  ArchitectureDetailAssignment,
  ArchitectureIndex,
} from "../architecture/validation.ts";
import { architectureCrossModelFiles } from "../architecture/validation.ts";
import { buildArtifactGraph } from "../artifact/graph.ts";
import type { IdentityDocument } from "../artifact/identity.ts";
import type {
  ArtifactModel,
  DocumentIssue,
  DocumentResult,
  ParseResult,
} from "../artifact/types.ts";
import type { ChangeIndex } from "../change/types.ts";
import type {
  IaAnalysisModel,
  IaCrossProjectionModel,
  IaDefinitionModel,
  IaIndexModel,
} from "../ia/types.ts";
import { iaIssue } from "../ia/validation.ts";
import type { parseRepositoryProjectContextMarkdown } from "../project-context/parse-context.ts";
import type {
  QualityAnalysis,
  QualityDetailTrace,
  QualityIntegration,
} from "../quality/analysis.ts";
import type {
  QualityDefinitionModel,
  QualityDetailAssignment,
} from "../quality/definition.ts";
import type {
  QualityCenter,
  QualityRealityAudit,
} from "../quality/readiness.ts";
import {
  inspectBranchCoverageTable,
  inspectRemediationTable,
} from "../quality/verification-tables.ts";
import type { CanonicalDocument, Changelog, Readme } from "../release/types.ts";
import type {
  SpecDefinition,
  SpecDefinitionCorrespondence,
  SpecDetailCorrespondence,
  SpecDetailIndex,
  SpecIndex,
} from "../spec/types.ts";
import type {
  UiAnalysis,
  UiDefinition,
  UiDetailIndex,
  UiIndex,
  UiScreen,
} from "../ui/types.ts";
import type {
  UxAnalysisModel,
  UxFormalInputObservation,
  UxIndexModel,
  UxProjectionModel,
} from "../ux/types.ts";
import type { SemanticIr } from "./ir.ts";
import { semanticDomainIssue } from "./ir.ts";

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
 * Quality DefinitionからMeaningとLocal ItemのRelation集合を生成する。
 *
 * @responsibility Required Meaningの未接続、未知Meaning、曖昧なLocal Itemを拒否する。
 * @trace ARCH-000008
 * @input sourceDocuments: readonly QualityDefinitionModel[]、semanticIrs: readonly SemanticIr[]
 * @returns DocumentResult<readonly QualitySemanticRelation[]>を返す。
 * @precondition sourceDocuments: readonly QualityDefinitionModel[]、semanticIrs: readonly SemanticIr[]がcompileQualitySemanticRelationsの入力契約を満たす。
 * @postcondition compileQualitySemanticRelationsの責務を完了した結果だけを返す。
 * @effect N/A: compileQualitySemanticRelationsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 不完全なRelation集合を成功結果として公開しない。
 * @invariant 成功結果のRelationは既知Meaningと一意なQA／Local Item組へ接続する。
 * @boundary N/A: compileQualitySemanticRelationsはProcess内の同一Subsystemで完結する。
 * @security N/A: compileQualitySemanticRelationsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: compileQualitySemanticRelationsは共有非同期状態を持たない同期処理である。
 */
export function compileQualitySemanticRelations(
  sourceDocuments: readonly QualityDefinitionModel[],
  semanticIrs: readonly SemanticIr[],
): DocumentResult<readonly QualitySemanticRelation[]> {
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
  const issues: DocumentIssue[] = [];
  const relations: QualitySemanticRelation[] = [];
  const relationKeys = new Set<string>();

  for (const sourceDocument of sourceDocuments) {
    const qaMatch = /(?:^|\/)(QA-[0-9]{6})\/quality_definition\.md$/u.exec(
      sourceDocument.source.path,
    );
    if (!qaMatch?.[1]) {
      issues.push(
        semanticDomainIssue(
          "quality.source.qa-id-missing",
          sourceDocument.source.path,
          "quality_identity_not_resolved_from_source_path",
        ),
      );
      continue;
    }
    const qaId = qaMatch[1];
    const semantic = sourceDocument.semantic;
    if (!semantic.heading) {
      issues.push(
        semanticDomainIssue(
          "quality.source.table-missing",
          sourceDocument.source.path,
          "quality_relation_heading_missing",
          { missingPart: "heading" },
        ),
      );
      continue;
    }
    if (!semantic.header) {
      issues.push(
        semanticDomainIssue(
          "quality.source.table-missing",
          sourceDocument.source.path,
          "quality_relation_table_missing",
          { missingPart: "table" },
        ),
      );
      continue;
    }
    if (
      JSON.stringify(semantic.header.cells) !== JSON.stringify(expectedHeaders)
    ) {
      issues.push(
        semanticDomainIssue(
          "quality.source.header-invalid",
          sourceDocument.source.path,
          "quality_relation_header_does_not_match_contract",
        ),
      );
      continue;
    }
    const separators = semantic.separator?.cells ?? [""];
    if (
      separators.length !== expectedHeaders.length ||
      separators.some((cell) => !/^:?-{3,}:?$/u.test(cell))
    ) {
      issues.push(
        semanticDomainIssue(
          "quality.source.separator-invalid",
          sourceDocument.source.path,
          "quality_relation_separator_invalid",
        ),
      );
      continue;
    }

    for (const row of semantic.rows) {
      const index = row.location.line - 1;
      const cells = row.cells;
      if (cells.length !== expectedHeaders.length) {
        issues.push(
          semanticDomainIssue(
            "quality.source.row-invalid",
            sourceDocument.source.path,
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
            sourceDocument.source.path,
            "quality_local_identity_shape_invalid",
            { row: index + 1 },
          ),
        );
        continue;
      }
      const localItemOccurrences =
        semantic.localItems.get(localId)?.occurrences ?? 0;
      if (localItemOccurrences < 2) {
        issues.push(
          semanticDomainIssue(
            "quality.relation.local-item-unresolved",
            sourceDocument.source.path,
            "quality_local_identity_does_not_resolve_required_pair",
            { localId },
            localId,
          ),
        );
      }
      const executionMode =
        semantic.localItems.get(localId)?.executionMode ?? null;
      if (!executionMode) {
        issues.push(
          semanticDomainIssue(
            "quality.relation.execution-mode-unresolved",
            sourceDocument.source.path,
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
            sourceDocument.source.path,
            "semantic_key_missing_from_quality_relation",
            { row: index + 1 },
          ),
        );
      for (const semanticKey of semanticKeys) {
        if (!knownSemanticKeys.has(semanticKey)) {
          issues.push(
            semanticDomainIssue(
              "quality.relation.semantic-key-unresolved",
              sourceDocument.source.path,
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
              sourceDocument.source.path,
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
          sourceDocument: sourceDocument.source.path,
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

/**
 * 観測済みDetail関係・定義・領域・件数の下流被覆検査入力を表す。
 * @responsibility 既読モデルと観測済み値を純粋な被覆検査へ渡す。
 * @trace ARCH-000008
 * @shape path、Architecture／Quality担当モデルと中央対応モデル、第一観測の内容モデル列、定義件数。
 * @invariant Owner／Area名は列挙Directory名であり、未観測値を空値で補完しない。
 * @boundary N/A: 観測Ownerから意味検査への値搬送。
 * @security Reader・Filesystem操作・認可・実行Authorityを含まない。
 * @compatibility 可視行のsubstring条件とQA側のIDサイズ比較、UI Directory件数を維持する。
 */
type DetailDownstreamObservation = Readonly<{
  path: string;
  architectureDefinitions: readonly ArchitectureDetailAssignment<"definition">[];
  qualityDefinitions: readonly QualityDetailAssignment[];
  areas: readonly ArchitectureDetailAssignment<"area">[];
  architectureTrace: ArchitectureDetailTrace;
  qualityTrace: QualityDetailTrace;
  architectureDefinitionObservations: readonly ArchitectureDefinition[];
  qualityDefinitionObservations: readonly QualityDefinitionModel[];
  uiDefinitionCount: number;
  specDefinitionCount: number;
}>;

const EXPECTED_HEADER =
  "| UI | SPEC | Shared UX／IA Context | Coverage分類 | 確認した観点 | 結果 | Gap Owner／人間判断 | Evidence |";
const evidenceHeadings = {
  State: ["## 状態と表示差", "## 振る舞い・状態・結果"],
  Trigger: ["## 操作とFeedback", "## 契機・事前条件・Authority"],
  Result: ["## 操作とFeedback", "## 振る舞い・状態・結果"],
  Failure: ["## 操作とFeedback", "## 失敗・回復・副作用"],
  Recovery: ["## 状態と表示差", "## 失敗・回復・副作用"],
  Authority: ["## 制約", "## 契機・事前条件・Authority"],
  Visibility: ["## 表示面と情報の優先順位", "## 受入条件と検証義務"],
  Constraint: ["## 制約", "## 制約"],
} as const;
/**
 * 対応根拠の比較文字列を正規化する。
 * @responsibility 対応根拠の比較文字列を正規化する。
 * @trace ARCH-000008
 * @input value: 根拠または本文。
 * @returns NFKCと既存記号除去・小文字化した値。
 * @precondition 対象本文は呼出し元が取得済みで、指定した本文は可視化済み。
 * @postcondition 入力を変更せず既存の出現順と短絡条件を維持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、不足する本文やCellを補完しない。
 * @invariant 既存の除去文字集合を追加・削除しない。
 * @boundary N/A: 同一Process内の定義対応根拠検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
const normalizeEvidenceText = (value: string): string =>
  value
    .normalize("NFKC")
    .replace(/[\s`*_[\]()（）「」『』、。・／/:：;；,.!?！？→←|+-]/gu, "")
    .toLowerCase();
/**
 * 根拠が対象Sectionの四文字連続部分を含むか確認する。
 * @responsibility 根拠が対象Sectionの四文字連続部分を含むか確認する。
 * @trace ARCH-000008
 * @input fact: 根拠記述。sourceSection: 対象Section。
 * @returns 既存の部分一致があればtrue。
 * @precondition 対象本文は呼出し元が取得済みで、指定した本文は可視化済み。
 * @postcondition 入力を変更せず既存の出現順と短絡条件を維持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、不足する本文やCellを補完しない。
 * @invariant 正規化後の最低四文字条件と任意位置の連続一致を維持する。
 * @boundary N/A: 同一Process内の定義対応根拠検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
const hasSourcePhrase = (fact: string, sourceSection: string): boolean => {
  const normalizedFact = normalizeEvidenceText(fact);
  const normalizedSource = normalizeEvidenceText(sourceSection);
  if (normalizedFact.length < 4 || normalizedSource.length < 4) return false;
  const width = Math.min(4, normalizedFact.length);
  for (let index = 0; index <= normalizedFact.length - width; index += 1)
    if (normalizedSource.includes(normalizedFact.slice(index, index + width)))
      return true;
  return false;
};

/**
 * 読取り直後の一組の定義モデルと根拠を評価する。
 * @responsibility 共有Context・八行・八観点とevery短絡を旧順序で照合する。
 * @trace ARCH-000008
 * @input pair: 対応モデルの一行。ui／spec: その行の直後に取得した定義モデル。
 * @returns invalidと実際に訪問した理由の出現列。未訪問理由は補完しない。
 * @failure 短CellのTypeErrorは従来どおり評価時に伝播する。
 * @effect N/A: Reader・保存・認可を発行しない。
 */
export function evaluateDefinitionPairEvidence(
  pair: SpecDefinitionCorrespondence["pairs"][number],
  ui: UiDefinition,
  spec: SpecDefinition,
): Readonly<{ invalid: boolean; reasons: readonly string[] }> {
  const cells = pair.cells;
  const expectedShared = new Set<string>();
  const correspondenceReasons: string[] = [];
  let isEvidenceInvalid = false;
  const uiFormal =
    ui.correspondenceSections.get("## 正式入力と変換根拠")?.text ?? "";
  const specFormal =
    spec.correspondenceSections.get("## 正式入力と変換根拠")?.text ?? "";
  const uiContext = new Set(uiFormal.match(/(?:UX|IA)-[0-9]{6}/gu) ?? []);
  const specContext = new Set(specFormal.match(/(?:UX|IA)-[0-9]{6}/gu) ?? []);
  for (const id of uiContext) if (specContext.has(id)) expectedShared.add(id);
  const recordedShared = new Set(
    (cells[2] as string).match(/(?:UX|IA)-[0-9]{6}/gu) ?? [],
  );
  const evidenceAnchor = `#${pair.uiId.toLowerCase()}${pair.specId.toLowerCase()}`;
  const evidenceRows = pair.evidenceRows.map((row) => row.cells);
  const expectedLenses = new Set([
    "State",
    "Trigger",
    "Result",
    "Failure",
    "Recovery",
    "Authority",
    "Visibility",
    "Constraint",
  ]);
  const isEvidenceValid =
    evidenceRows.length === 8 &&
    new Set(evidenceRows.map(([lens]) => lens)).size === 8 &&
    evidenceRows.every((values) => {
      const [lens, uiEvidence, specEvidence, result, reason] = values as [
        string,
        string,
        string,
        string,
        string,
      ];
      correspondenceReasons.push(reason);
      const concreteReason = reason.match(
        /^UI事実（(UI-[0-9]{6})）「(.+)」／SPEC事実（(SPEC-[0-9]{6})）「(.+)」／対応: (.+)$/u,
      );
      const headings = evidenceHeadings[lens as keyof typeof evidenceHeadings];
      const uiFact = concreteReason?.[2] ?? "";
      const specFact = concreteReason?.[4] ?? "";
      const uiTitle = ui.correspondenceTitle?.text ?? "";
      const specTitle = spec.correspondenceTitle?.text ?? "";
      const hasInvalidFactSyntax =
        /…|\[[^\]]*\]|^(?:上記|同上|題名|見出し)$/u.test(uiFact) ||
        /…|\[[^\]]*\]|^(?:上記|同上|題名|見出し)$/u.test(specFact);
      return (
        expectedLenses.has(lens) &&
        uiEvidence.includes(pair.uiId) &&
        uiEvidence.includes("#") &&
        specEvidence.includes(pair.specId) &&
        specEvidence.includes("#") &&
        /^(?:一致|N\/A)$/u.test(result) &&
        concreteReason?.[1] === pair.uiId &&
        concreteReason?.[3] === pair.specId &&
        uiFact.trim().length >= 4 &&
        specFact.trim().length >= 4 &&
        (concreteReason?.[5]?.trim().length ?? 0) >= 4 &&
        !hasInvalidFactSyntax &&
        normalizeEvidenceText(uiFact) !== normalizeEvidenceText(uiTitle) &&
        normalizeEvidenceText(specFact) !== normalizeEvidenceText(specTitle) &&
        headings !== undefined &&
        hasSourcePhrase(
          uiFact,
          ui.correspondenceSections.get(headings[0])?.text ?? "",
        ) &&
        hasSourcePhrase(
          specFact,
          spec.correspondenceSections.get(headings[1])?.text ?? "",
        ) &&
        !/^(?:表示状態と振る舞い状態|操作と発火条件|結果を利用者|失敗理由を正常状態|回復要否と次の行動|操作可能性とEffect権限|開示・不足・観測不能|片側で共通制約)/u.test(
          reason,
        )
      );
    });
  if (
    cells.length !== 8 ||
    cells.some((cell) => cell.length === 0) ||
    cells[3] !== "Shared" ||
    !(cells[4] as string).includes("8観点") ||
    !/^(?:作成者確認済み|Gap|N\/A)$/u.test(cells[5] as string) ||
    !(cells[7] as string).includes(evidenceAnchor) ||
    expectedShared.size !== recordedShared.size ||
    [...expectedShared].some((id) => !recordedShared.has(id)) ||
    !isEvidenceValid
  )
    isEvidenceInvalid = true;
  return { invalid: isEvidenceInvalid, reasons: correspondenceReasons };
}

/**
 * 工程間比較の解析済み集合と診断位置を定義する。
 * @responsibility 比較種別ごとの必須情報を閉じた判別Unionとして保持する。
 * @trace ARCH-000008
 * @shape kindごとの集合、重複を保持する出現列、診断位置。
 * @invariant 重複を保持し、取得済みモデル・既存観測断面を使い任意Ruleを受け付けない。
 * @boundary 同一Processの解析済み工程モデル。
 * @security 資源実在・認可・品質全体の成立を示さない。
 * @compatibility 比較条件と診断順を維持する。
 */
export type DocumentRelationsRequest =
  | Readonly<{
      kind: "project_context_identity";
      context: ReturnType<typeof parseRepositoryProjectContextMarkdown>;
      manifest: Record<string, unknown>;
    }>
  | Readonly<{
      kind: "artifact_relations";
      artifacts: readonly ArtifactModel[];
    }>
  | Readonly<{
      kind: "architecture_cross_model";
      document: ParseResult<ArchitectureCrossModel> &
        Readonly<{ result: ArchitectureCrossModel }>;
      index: ArchitectureIndex;
    }>
  | Readonly<{
      kind: "architecture_detail_map_coverage";
      document: ParseResult<
        import("../architecture/details.ts").ArchitectureDetailMapModel
      > &
        Readonly<{
          result: import("../architecture/details.ts").ArchitectureDetailMapModel;
        }>;
      actualDefinitions: ReadonlySet<string>;
    }>
  | (Readonly<{
      integration: QualityIntegration;
      localItemOwners: ReadonlyMap<string, string>;
      analysisDetailUnitLocalRelations: ReadonlySet<string>;
      physicalDetailUnits: ReadonlySet<string>;
      physicalDetailUnitLevels: ReadonlyMap<string, ReadonlySet<string>>;
      physicalDetailUnitBoundaryStages: ReadonlyMap<string, string>;
      localItemLevels: ReadonlyMap<string, string>;
      localItemBoundaryStages: ReadonlyMap<string, string>;
      analysisPath: string;
    }> &
      Readonly<{ kind: "quality_local_item_relations" }>)
  | Readonly<{
      kind: "quality_detail_coverage";
      integration: ParseResult<QualityIntegration> &
        Readonly<{ result: QualityIntegration }>;
      linkedDetailPaths: ReadonlySet<string>;
      physicalDetailPaths: ReadonlySet<string>;
      analysisPath: string;
    }>
  | Readonly<{
      kind: "architecture_readiness";
      documentType: "analysis" | "definition" | "detail";
      document: ParseResult<
        ArchitectureAnalysis | ArchitectureDefinition | ArchitectureDetailModel
      > &
        Readonly<{
          result:
            | ArchitectureAnalysis
            | ArchitectureDefinition
            | ArchitectureDetailModel;
        }>;
      isReady: boolean;
    }>
  | Readonly<{
      kind: "architecture_registry_coverage";
      sourcePath: string;
      registry: ArchitectureRegistryModel;
      actualDefinitions: ReadonlySet<string>;
    }>
  | Readonly<{
      kind: "architecture_component_coverage";
      model: ArchitectureCrossModel;
      actualDefinitions: ReadonlySet<string>;
    }>
  | (ArchitectureRelationsRequest &
      Readonly<{ kind: "architecture_relations" }>)
  | (ArchitectureDetailCoverageRequest &
      Readonly<{ kind: "architecture_detail_coverage" }>)
  | Readonly<{
      kind: "quality_design_states";
      artifacts: readonly ArtifactModel[];
    }>
  | (Readonly<{
      definitionSourceRelationEntries: readonly string[];
      definitionSourceRelations: ReadonlySet<string>;
      definitionGoalLocalRelationEntries: readonly string[];
      definitionGoalLocalRelations: ReadonlySet<string>;
      definitionDetailGoalRelationEntries: readonly string[];
      definitionDetailGoalRelations: ReadonlySet<string>;
      analysisDetailGoalRelations: ReadonlySet<string>;
      analysisSourceRelations: ReadonlySet<string>;
      definitionObligationKeyEntries: readonly string[];
      analysisObligationKeys: ReadonlyMap<string, string>;
      definitionObligationKeys: ReadonlyMap<string, string>;
      analysisSourceGoalLevels: ReadonlyMap<string, ReadonlySet<string>>;
      localItemLevels: ReadonlyMap<string, string>;
      summarySourceLevels: ReadonlyMap<string, ReadonlySet<string>>;
      definitionSourceGoalLevels: ReadonlyMap<string, ReadonlySet<string>>;
      analysisSourceConditions: ReadonlyMap<string, string>;
      definitionSourceConditions: ReadonlyMap<string, string>;
      definitionsRoot: string;
      analysisPath: string;
    }> &
      Readonly<{ kind: "quality_definition_relations" }>)
  | (Readonly<{
      listedGoalLocalRelationEntries: readonly string[];
      listedGoalLocalRelations: ReadonlySet<string>;
      definitionGoalLocalRelations: ReadonlySet<string>;
      analysisPath: string;
    }> &
      Readonly<{ kind: "quality_goal_local_relations" }>)
  | Readonly<{
      kind: "quality_reality_state";
      center: QualityCenter;
      reality: ParseResult<QualityRealityAudit> &
        Readonly<{ result: QualityRealityAudit }>;
    }>
  | Readonly<{
      kind: "ui_analysis_coverage";
      sourcePath: string;
      uxIds: ReadonlySet<string>;
      iaIds: ReadonlySet<string>;
      analysisUxIds: ReadonlySet<string>;
      analysisIaIds: ReadonlySet<string>;
    }>
  | Readonly<{
      kind: "ui_index_coverage";
      sourcePath: string;
      index: UiIndex;
      actualUiIds: ReadonlySet<string>;
    }>
  | Readonly<{
      kind: "ui_relations";
      sourcePath: string;
      index: UiIndex;
      analyses: readonly UiAnalysis[];
      definitions: readonly UiDefinition[];
    }>
  | (Readonly<{
      specIndexPath: string;
      specAnalysisRoot: string;
      uxIds: ReadonlySet<string>;
      iaIds: ReadonlySet<string>;
      analyzedUx: ReadonlySet<string>;
      analyzedIa: ReadonlySet<string>;
      analysisRelationOccurrences: readonly string[];
    }> &
      Readonly<{ kind: "spec_analysis_coverage" }>)
  | (Readonly<{
      specDefinitionsRoot: string;
      specIndexPath: string;
      definitionRelationOccurrences: readonly string[];
      definitionUiPairOccurrences: readonly string[];
      registryIds: ReadonlySet<string>;
      actualIds: ReadonlySet<string>;
    }> &
      Readonly<{ kind: "spec_definition_coverage" }>)
  | (Readonly<{
      specIndexPath: string;
      indexCountRows: readonly (readonly string[])[];
      expectedIndexCounts: ReadonlyMap<string, number>;
      registryRelations: ReadonlySet<string>;
      analysisRelations: ReadonlySet<string>;
      definitionRelations: ReadonlySet<string>;
    }> &
      Readonly<{ kind: "spec_coverage" }>)
  | Readonly<{
      kind: "ui_detail_coverage";
      detail: ParseResult<UiDetailIndex> & Readonly<{ result: UiDetailIndex }>;
      actualIds: ReadonlySet<string>;
    }>
  | Readonly<{
      kind: "spec_detail_coverage";
      detail: ParseResult<SpecDetailIndex> &
        Readonly<{ result: SpecDetailIndex }>;
      actualIds: ReadonlySet<string>;
    }>
  | Readonly<{
      kind: "ux_projection";
      projection: UxProjectionModel;
      canonicalIds: ReadonlySet<string>;
    }>
  | Readonly<{
      kind: "ux_formal_input";
      analysis: UxAnalysisModel;
      observation: UxFormalInputObservation;
    }>
  | Readonly<{
      kind: "ux_analysis_registration";
      analysis: ParseResult<UxAnalysisModel> &
        Readonly<{ result: UxAnalysisModel }>;
      registryLinkCount: number;
    }>
  | Readonly<{
      kind: "ux_relations";
      uxIndexPath: string;
      experienceMapPath: string;
      index: UxIndexModel;
      analysisRequirementRelations: ReadonlySet<string>;
      canonicalJourneyRelations: ReadonlySet<string>;
      analysisJourneyRelations: ReadonlySet<string>;
    }>
  | Readonly<{
      kind: "ia_analysis_coverage";
      expectedIds: ReadonlySet<string>;
      actualIds: ReadonlySet<string>;
      sourcePath: string;
    }>
  | Readonly<{
      kind: "ia_index_coverage";
      index: IaIndexModel;
      actualIds: ReadonlySet<string>;
      sourcePath: string;
    }>
  | Readonly<{
      kind: "ia_projection";
      projection: IaCrossProjectionModel;
      actualIds: ReadonlySet<string>;
    }>
  | Readonly<{
      kind: "ia_definition";
      definition: ParseResult<IaDefinitionModel> &
        Readonly<{ result: IaDefinitionModel }>;
      analyses: ReadonlyMap<string, IaAnalysisModel>;
    }>
  | Readonly<{
      kind: "ia_relations";
      index: IaIndexModel;
      analyses: readonly IaAnalysisModel[];
      definitions: readonly IaDefinitionModel[];
      sourcePath: string;
    }>
  | Readonly<{
      kind: "stable_canonical_documents";
      documents: readonly CanonicalDocument[];
      stableVersion: string;
    }>
  | Readonly<{
      kind: "stable_release_document";
      document: CanonicalDocument;
      stableVersion: string;
      stableTagCommit: string | null;
    }>
  | Readonly<{
      kind: "stable_changelog";
      changelog: Changelog;
      stableVersion: string;
    }>
  | Readonly<{ kind: "stable_readme"; readme: Readme; stableVersion: string }>
  | Readonly<{
      kind: "change_navigation";
      index: ChangeIndex;
      observedChangeIds: readonly string[];
    }>
  | Readonly<{ kind: "discovery_identity_links"; document: IdentityDocument }>
  | Readonly<{
      kind: "identity_ownership";
      definitions: ReadonlyMap<string, readonly string[]>;
    }>
  | Readonly<{
      kind: "ui_spec";
      uiDefinitionsRoot: string;
      specIndexPath: string;
      uiDefinitions: readonly UiDefinition[];
      specDefinitions: readonly SpecDefinition[];
      registry: SpecIndex;
    }>
  | Readonly<{
      kind: "ui_spec_details";
      correspondence: SpecDetailCorrespondence;
      screens: readonly UiScreen[];
      uiDetailIndex: UiDetailIndex | null;
      specDetailIndex: SpecDetailIndex | null;
      definitions: readonly SpecDefinition[];
    }>
  | (Readonly<{
      kind: "ui_spec_downstream";
      uiDetailIndex: UiDetailIndex | null;
      specDetailIndex: SpecDetailIndex | null;
      definitions: readonly SpecDefinition[];
    }> &
      DetailDownstreamObservation)
  | Readonly<{
      kind: "ui_spec_evidence";
      correspondence: SpecDefinitionCorrespondence;
      evaluations: readonly ReturnType<typeof evaluateDefinitionPairEvidence>[];
      registry: SpecIndex;
      actualFingerprint: string;
    }>
  | Readonly<{
      kind: "architecture_inputs";
      sourcePath: string;
      analysisPath: string;
      analyses: readonly ArchitectureAnalysis[];
      uiIds: ReadonlySet<string>;
      specIds: ReadonlySet<string>;
      actualAnalysisIds: ReadonlySet<string>;
    }>
  | Readonly<{
      kind: "quality_architecture_models";
      integration: QualityIntegration;
      architectureRoot: string;
      integrationDirectory: string;
      analysisPath: string;
    }>
  | Readonly<{
      kind: "quality_goals";
      rows: readonly (readonly string[])[];
      goalLabelToSlug: ReadonlyMap<string, string>;
      analysisPath: string;
    }>;

/**
 * 同じ取得のSPEC定義と両Detail索引から期待Relationを導出する。
 * @responsibility 欠測を補完せず、定義出現順・最後の有効対応を維持する。
 * @trace ARCH-000008
 * @input definitions: 取得済み定義。uiDetailIndex／specDetailIndex: 取得済み索引又は欠測。
 * @returns Relation Keyごとの最後の対応。入力は変更しない。
 * @effect N/A: 解析済み値だけを扱う。
 */
function deriveDetailRelations(
  definitions: readonly SpecDefinition[],
  uiDetailIndex: UiDetailIndex | null,
  specDetailIndex: SpecDetailIndex | null,
) {
  const pairs = definitions.flatMap((model) =>
    model.pairedInterfaces.map(
      (ref) => `${ref.identity}|${model.expectedIdentity}`,
    ),
  );
  const expectedRelations = new Map<
    string,
    Readonly<{ bhv: string; ui: string; spec: string; scr: string }>
  >();
  for (const pair of pairs) {
    const [ui, spec] = pair.split("|");
    const detail = uiDetailIndex?.bindings.get(ui ?? "");
    const bhv = specDetailIndex?.behaviors.get(spec ?? "");
    if (!detail || !bhv || !ui || !spec) continue;
    expectedRelations.set(`${detail.prt}.spec-${spec.slice(-6)}`, {
      bhv,
      ui,
      spec,
      scr: detail.scr,
    });
  }

  return expectedRelations;
}

/**
 * 解析済み工程モデルの対応と入力網羅性を検査する。
 * @responsibility UI重複→三者閉包、Architecture件数→Directory集合、Quality行→重複→処置→目標被覆の順で比較する。
 * @trace ARCH-000008
 * @input request: 種別ごとの必須集合・出現列・診断位置。
 * @returns 当該比較の違反を表す中立Issue列。
 * @precondition 対象の選定・観測・解析は利用側が完了している。
 * @postcondition 入力を変更せず、従来の条件・位置・順序を維持する。
 * @effect N/A: 同期的な集合比較のみ。
 * @failure 未対応kindは固定理由で拒否し、空結果や別の比較へ切り替えない。
 * @invariant 空列は当該比較の違反なしであり、全品質Passや実在確認ではない。
 * @boundary 工程モデルからSemanticへの比較境界。
 * @security 認可・実行許可・採用・公開判断を行わない。
 * @concurrency N/A: 共有可変状態・保存処理を持たない。
 */
export function inspectDocumentRelations(
  request: DocumentRelationsRequest,
): readonly DocumentIssue[] {
  switch (request.kind) {
    case "project_context_identity": {
      const identity = request.context.manifestIdentity,
        manifest = request.manifest;
      return manifest.schema !== "crdd/repository-manifest/v2" ||
        identity.projectId !== manifest.projectId ||
        identity.repositoryId !== manifest.repositoryId ||
        identity.repositoryRole !== manifest.repositoryRole
        ? [
            {
              kind: "artifact.project-context.manifest-identity-mismatch",
              targetIdentity: request.context.source.path,
              location: { path: request.context.source.path },
              reason: "project-context-manifest-identity-mismatch",
              details: {},
            },
          ]
        : [];
    }
    case "artifact_relations":
      return buildArtifactGraph({ artifacts: request.artifacts }).issues;
    case "architecture_cross_model": {
      const { document, index } = request;
      const issues = [...document.issues];
      if (
        !(index.sections[0]?.text ?? "").includes(
          `](${document.result.file})`,
        ) &&
        !issues.some(
          (issue) =>
            issue.kind === "artifact.architecture.cross-model-contract-invalid",
        )
      )
        issues.push({
          kind: "artifact.architecture.cross-model-contract-invalid",
          targetIdentity: document.result.file,
          location: { path: document.result.source.path },
          reason: "cross-model-contract-invalid",
          details: {},
        });
      return issues;
    }

    case "architecture_detail_map_coverage": {
      const { document, actualDefinitions } = request;
      const ids = document.result.closureIds;
      const issues = [...document.issues];
      if (
        (ids.size !== actualDefinitions.size ||
          [...actualDefinitions].some((id) => !ids.has(id))) &&
        !issues.some(
          (issue) =>
            issue.kind === "artifact.architecture.detail-map-contract-invalid",
        )
      )
        issues.push({
          kind: "artifact.architecture.detail-map-contract-invalid",
          targetIdentity: document.result.source.path,
          location: { path: document.result.source.path },
          reason: "detail-map-contract-invalid",
          details: {},
        });
      return issues;
    }
    case "quality_local_item_relations":
      return inspectQualityLocalItemRelations(request);
    case "quality_detail_coverage": {
      const {
        integration,
        linkedDetailPaths,
        physicalDetailPaths,
        analysisPath,
      } = request;
      const issues = integration.issues.filter((issue) =>
        issue.kind.startsWith("artifact.quality-analysis.architecture-detail-"),
      );
      if (
        linkedDetailPaths.size !== physicalDetailPaths.size ||
        [...physicalDetailPaths].some((p) => !linkedDetailPaths.has(p)) ||
        [...linkedDetailPaths].some((p) => !physicalDetailPaths.has(p))
      )
        issues.push({
          kind: "artifact.quality-analysis.architecture-detail-coverage-mismatch",
          targetIdentity: analysisPath,
          location: { path: analysisPath },
          reason: "architecture-detail-coverage-mismatch",
          details: {},
        });
      return issues;
    }

    case "architecture_readiness": {
      const { document, documentType, isReady } = request;
      const model = document.result;
      const reason = `${documentType}-contract-invalid`;
      const kind = `artifact.architecture.${reason}`;
      const issues = [...document.issues];
      if (
        isReady &&
        model.hasUnresolvedResults &&
        !issues.some((issue) => issue.kind === kind)
      )
        issues.push({
          kind,
          targetIdentity:
            "expectedIdentity" in model
              ? model.expectedIdentity
              : model.source.path,
          location: { path: model.source.path },
          reason,
          details: { checklistFailure: model.checklistContract.failure },
        });
      return issues;
    }

    case "architecture_registry_coverage":
      return inspectArchitectureRegistryCoverage(
        request.sourcePath,
        request.registry,
        request.actualDefinitions,
      );
    case "architecture_component_coverage":
      return inspectArchitectureComponentCoverage(
        request.model,
        request.actualDefinitions,
      );
    case "architecture_relations":
      return inspectArchitectureRelations(request);
    case "architecture_detail_coverage":
      return inspectArchitectureDetailCoverage(request);
    case "quality_design_states":
      return inspectQualityDesignStates(request.artifacts);
    case "quality_definition_relations":
      return inspectQualityDefinitionRelations(request);
    case "quality_goal_local_relations":
      return inspectQualityGoalLocalRelations(request);
    case "quality_reality_state": {
      const { center, reality } = request;
      const issues = reality.issues.filter(
        (issue) =>
          issue.kind ===
          "artifact.quality-analysis.reality-audit-state-invalid",
      );
      const state = reality.result.stateDeclarations[0]?.text ?? "";
      const allowed =
        (center.normalizedQualityState ===
          "Quality Design Under Review — Reality Audit Blocked" &&
          state === "Blocked — Quality Design Review Pending") ||
        (center.isQualityDesignReady &&
          ["Pending — Not Started", "In Progress"].includes(state)) ||
        (center.isQualityReady && state === "Complete");
      if (center.isQualityStateKnown && !allowed)
        issues.push({
          kind: "artifact.quality-analysis.state-reality-audit-state-mismatch",
          targetIdentity: center.source.path,
          location: { path: center.source.path },
          reason: "state-reality-audit-state-mismatch",
          details: {},
        });
      return issues;
    }

    case "ui_analysis_coverage":
      return inspectUiAnalysisCoverage(
        request.sourcePath,
        request.uxIds,
        request.iaIds,
        request.analysisUxIds,
        request.analysisIaIds,
      );
    case "ui_index_coverage":
      return inspectUiIndexCoverage(
        request.sourcePath,
        request.index,
        request.actualUiIds,
      );
    case "ui_relations":
      return inspectUiRelations(
        request.sourcePath,
        request.index,
        request.analyses,
        request.definitions,
      );
    case "spec_analysis_coverage":
      return inspectSpecAnalysisCoverage(request);
    case "spec_definition_coverage":
      return inspectSpecDefinitionCoverage(request);
    case "spec_coverage":
      return inspectSpecCoverage(request);
    case "ui_detail_coverage": {
      const { detail, actualIds } = request;
      const model = detail.result;
      const ids = model.entries.map((entry) => entry.identity);
      const invalid = detail.issues.find(
        (issue) => issue.kind === "artifact.ui.detail-current-coverage-invalid",
      );
      const mismatch =
        ids.length !== actualIds.size ||
        ids.some((id) => !actualIds.has(id)) ||
        [...actualIds].some((id) => !ids.includes(id)) ||
        new Set(
          model.entries.flatMap((entry) =>
            entry.screenId ? [entry.screenId] : [],
          ),
        ).size !== actualIds.size ||
        new Set(
          model.entries.flatMap((entry) =>
            entry.partId ? [entry.partId] : [],
          ),
        ).size !== actualIds.size;
      return invalid
        ? [invalid]
        : mismatch
          ? [
              {
                kind: "artifact.ui.detail-current-coverage-invalid",
                targetIdentity: model.source.path,
                location: { path: model.source.path },
                reason: "detail-current-coverage-invalid",
                details: {},
              },
            ]
          : [];
    }
    case "spec_detail_coverage": {
      const { detail, actualIds } = request;
      const model = detail.result;
      const ids = model.entries.map((entry) => entry.identity);
      const invalid = detail.issues.find(
        (issue) =>
          issue.kind === "artifact.spec.detail-current-coverage-invalid",
      );
      const mismatch =
        ids.length !== actualIds.size ||
        ids.some((id) => !actualIds.has(id)) ||
        [...actualIds].some((id) => !ids.includes(id)) ||
        new Set(
          model.entries.flatMap((entry) =>
            entry.behaviorId ? [entry.behaviorId] : [],
          ),
        ).size !== actualIds.size;
      return invalid
        ? [invalid]
        : mismatch
          ? [
              {
                kind: "artifact.spec.detail-current-coverage-invalid",
                targetIdentity: model.source.path,
                location: { path: model.source.path },
                reason: "detail-current-coverage-invalid",
                details: {},
              },
            ]
          : [];
    }

    case "ux_projection": {
      const p = request.projection;
      return p.selectedSection === null ||
        p.projectedKeys.length !== p.projectedIds.size ||
        p.projectedIds.size !== request.canonicalIds.size ||
        [...request.canonicalIds].some((id) => !p.projectedIds.has(id))
        ? [
            {
              kind: "artifact.ux.cross-projection-incomplete",
              targetIdentity: p.source.path,
              location: { path: p.source.path },
              reason: "cross-projection-incomplete",
              details: {},
            },
          ]
        : [];
    }
    case "ux_formal_input":
      return compareUxFormalInput(request.analysis, request.observation);
    case "ux_analysis_registration": {
      const issues = [...request.analysis.issues];
      if (
        request.registryLinkCount !== 1 &&
        !issues.some((i) => i.kind === "artifact.ux.analysis-contract-invalid")
      )
        issues.unshift({
          kind: "artifact.ux.analysis-contract-invalid",
          targetIdentity: request.analysis.result.expectedIdentity,
          location: { path: request.analysis.result.source.path },
          reason: "analysis-contract-invalid",
          details: {},
        });
      return issues;
    }
    case "ux_relations":
      return compareUxRelations(request);
    case "ia_analysis_coverage":
      return compareIaAnalysisCoverage(
        request.expectedIds,
        request.actualIds,
        request.sourcePath,
      );
    case "ia_index_coverage":
      return compareIaIndexCoverage(
        request.index,
        request.actualIds,
        request.sourcePath,
      );
    case "ia_projection": {
      const p = request.projection;
      return p.projectedKeys.length !== p.projectedIds.size ||
        p.projectedIds.size !== request.actualIds.size ||
        [...request.actualIds].some((id) => !p.projectedIds.has(id))
        ? [
            iaIssue(
              "cross-projection-coverage-mismatch",
              p.source.path,
              p.source.path,
            ),
          ]
        : [];
    }
    case "ia_definition": {
      const d = request.definition;
      const comparison = compareIaDefinitionEvidence(
        d.result,
        request.analyses,
      );
      return comparison.invalid &&
        !d.issues.some(
          (i) => i.kind === "artifact.ia.definition-contract-invalid",
        )
        ? [
            iaIssue(
              "definition-contract-invalid",
              d.result.source.path,
              d.result.expectedIdentity,
              { checklistFailure: d.result.checklistContract.failure },
            ),
          ]
        : [...d.issues];
    }
    case "ia_relations": {
      const analyses = new Map(
        request.analyses.map((a) => [a.expectedIdentity, a]),
      );
      const definitions = request.definitions.map((d) => ({
        ...d,
        mappingKeys: compareIaDefinitionEvidence(d, analyses).mappingKeys,
      }));
      return compareIaRelations(
        request.index,
        request.analyses,
        definitions,
        request.sourcePath,
      );
    }
    case "stable_canonical_documents": {
      const issues: DocumentIssue[] = [];
      for (const document of request.documents) {
        if (
          document.status === "Stable" &&
          document.version === request.stableVersion
        ) {
          continue;
        }
        issues.push({
          kind: "artifact.stable-release.stable-release-canonical-status-mismatch",
          targetIdentity: document.source.path,
          location: { path: document.source.path },
          reason: "stable-release-canonical-status-mismatch",
          details: { value0: String(request.stableVersion) },
        });
      }

      return issues;
    }
    case "stable_release_document": {
      const issues: DocumentIssue[] = [];
      const header = request.document.source.content;
      const file = request.document.source.path;
      const stableVersion = request.stableVersion;
      const stableTagCommit = request.stableTagCommit;
      if (request.document.candidateVersion === stableVersion) {
        issues.push({
          kind: "artifact.stable-release.stable-release-candidate-residue",
          targetIdentity: file,
          location: { path: file },
          reason: "stable-release-candidate-residue",
          details: { value0: String(stableVersion) },
        });
      }
      const isChangeTraceForStableRelease =
        /^99_Roadmap\/Changes\/CHG-[0-9]{6}\/change\.md$/u.test(file);
      if (!isChangeTraceForStableRelease) return issues;
      if (!header.includes(`対象版: \`${stableVersion}\``)) return issues;
      const isReadyForRelease = request.document.releaseStates.some(
        (entry) => entry.text === "状態: `Ready for Release Handoff`",
      );
      const released = request.document.releaseStates.some(
        (entry) => entry.text === "状態: `Released`",
      );
      if (!isReadyForRelease && !released) {
        issues.push({
          kind: "artifact.stable-release.stable-release-change-trace-not-ready",
          targetIdentity: file,
          location: { path: file },
          reason: "stable-release-change-trace-not-ready",
          details: { value0: String(stableVersion) },
        });
      }
      if (released && stableTagCommit === null) {
        issues.push({
          kind: "artifact.stable-release.stable-release-change-trace-premature-release",
          targetIdentity: file,
          location: { path: file },
          reason: "stable-release-change-trace-premature-release",
          details: { value0: String(stableVersion) },
        });
      }
      return issues;
    }
    case "stable_changelog": {
      const issues: DocumentIssue[] = [];
      const changelog = request.changelog.source.content,
        changelogPath = request.changelog.source.path;
      const stableVersion = request.stableVersion;
      const escapedStableVersion = stableVersion.replace(
        /[.*+?^${}()|[\]\\]/gu,
        "\\$&",
      );
      const releaseHeadingMatches = [
        ...changelog.matchAll(
          new RegExp(
            `^### ${escapedStableVersion} — (\\d{4}-\\d{2}-\\d{2})$`,
            "gmu",
          ),
        ),
      ];
      const releaseDates = new Set(
        releaseHeadingMatches.map((match) => match[1]).filter(Boolean),
      );
      if (releaseHeadingMatches.length !== 2 || releaseDates.size !== 1) {
        issues.push({
          kind: "artifact.stable-release.stable-release-changelog-bilingual-closure-mismatch",
          targetIdentity: changelogPath,
          location: { path: changelogPath },
          reason: "stable-release-changelog-bilingual-closure-mismatch",
          details: {
            value0: String(stableVersion),
            value1: String(releaseHeadingMatches.length),
            value2: String(releaseDates.size),
          },
        });
      }

      return issues;
    }
    case "stable_readme": {
      const issues: DocumentIssue[] = [];
      const sourcePath = request.readme.source.path;
      if (
        !request.readme.source.content.includes(
          `Version: **${request.stableVersion}**`,
        )
      )
        issues.push({
          kind: "artifact.stable-release.stable-release-readme-version-mismatch",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "stable-release-readme-version-mismatch",
          details: { value0: String(request.stableVersion) },
        });
      if (request.readme.candidateDeclarations.length > 0)
        issues.push({
          kind: "artifact.stable-release.stable-release-readme-candidate-residue",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "stable-release-readme-candidate-residue",
          details: {},
        });
      return issues;
    }
    case "change_navigation": {
      const indexedIds = request.index.entries
        .map((entry) => entry.identity)
        .sort();
      const uniqueIndexedIds = new Set(indexedIds);
      // 単体重複はParseが一件返す。追加すると旧一件診断を二重化する。
      if (indexedIds.length !== uniqueIndexedIds.size) return [];
      if (
        request.observedChangeIds.length === uniqueIndexedIds.size &&
        request.observedChangeIds.every((id) => uniqueIndexedIds.has(id))
      )
        return [];
      return [
        {
          kind: "artifact.change.navigation-population-mismatch",
          targetIdentity: request.index.source.path,
          location: { path: request.index.source.path },
          reason: "navigation-population-mismatch",
          details: {},
        },
      ];
    }
    case "discovery_identity_links": {
      const file = request.document.source.path;
      return request.document.links
        .filter(
          (link) =>
            link.identity.startsWith("REQ-") &&
            link.target
              .replaceAll("\\", "/")
              .includes("01_Discovery/Analysis/EXP-"),
        )
        .map((link) => ({
          kind: "artifact.document-identity.discovery-identity-link-owner-mismatch",
          targetIdentity: file,
          location: { path: file },
          reason: "discovery-identity-link-owner-mismatch",
          details: { value0: link.identity },
        }));
    }
    case "identity_ownership": {
      const definitionsById = request.definitions;
      const issues: DocumentIssue[] = [];
      for (const [stableId, definitions] of definitionsById) {
        if (definitions.length > 1)
          issues.push({
            kind: "artifact.document-identity.duplicate-stable-id-definition",
            targetIdentity: stableId,
            location: { path: definitions.join(", ") },
            reason: "duplicate-stable-id-definition",
            details: { stableId },
          });
      }
      return issues;
    }
    case "ui_spec": {
      const {
        uiDefinitionsRoot,
        specIndexPath,
        uiDefinitions,
        specDefinitions,
        registry,
      } = request;
      const uiPairOccurrences = uiDefinitions.flatMap((model) =>
        model.pairedSpecifications.map(
          (ref) => `${model.expectedIdentity}|${ref.identity}`,
        ),
      );
      const uiPairs = new Set(uiPairOccurrences);
      const registryUiPairs = new Set(
        registry.entries.flatMap((entry) =>
          entry.uiIds.map((id) => `${id}|${entry.identity}`),
        ),
      );
      const definitionUiPairs = new Set(
        specDefinitions.flatMap((model) =>
          model.pairedInterfaces.map(
            (ref) => `${ref.identity}|${model.expectedIdentity}`,
          ),
        ),
      );
      const issues: DocumentIssue[] = [];
      if (new Set(uiPairOccurrences).size !== uiPairOccurrences.length)
        issues.push({
          kind: "artifact.spec.ui-spec-pair-duplicate",
          targetIdentity: uiDefinitionsRoot,
          location: { path: uiDefinitionsRoot },
          reason: "ui-spec-pair-duplicate",
          details: {},
        });
      if (
        [...registryUiPairs].some(
          (r) => !definitionUiPairs.has(r) || !uiPairs.has(r),
        ) ||
        [...definitionUiPairs].some(
          (r) => !registryUiPairs.has(r) || !uiPairs.has(r),
        ) ||
        [...uiPairs].some(
          (r) => !registryUiPairs.has(r) || !definitionUiPairs.has(r),
        )
      )
        issues.push({
          kind: "artifact.spec.ui-spec-pair-closure-mismatch",
          targetIdentity: specIndexPath,
          location: { path: specIndexPath },
          reason: "ui-spec-pair-closure-mismatch",
          details: {},
        });

      return issues;
    }
    case "ui_spec_details": {
      const {
        correspondence,
        screens,
        uiDetailIndex,
        specDetailIndex,
        definitions,
      } = request;
      const pairs = definitions.flatMap((model) =>
        model.pairedInterfaces.map(
          (ref) => `${ref.identity}|${model.expectedIdentity}`,
        ),
      );
      const expectedRelations = deriveDetailRelations(
        definitions,
        uiDetailIndex,
        specDetailIndex,
      );
      const expectedTuples = new Set(
        [...expectedRelations].map(
          ([key, value]) =>
            `${key}|${value.bhv}|${value.ui}|${value.spec}|${value.scr}`,
        ),
      );
      const screenRelations = screens.flatMap((screen) =>
        screen.targetUi
          ? screen.relationRows.map(
              (row) =>
                `${row.interactionKey}|${row.behaviorId}|${screen.targetUi?.identity}|SPEC-${row.interactionKey.slice(-6)}|${screen.expectedIdentity}`,
            )
          : [],
      );
      const screenSet = new Set(screenRelations);
      const hasScreenRelationMismatch =
        screenRelations.length !== screenSet.size ||
        screenSet.size !== expectedTuples.size ||
        [...screenSet].some((tuple) => !expectedTuples.has(tuple)) ||
        [...expectedTuples].some((tuple) => !screenSet.has(tuple));
      const rows = correspondence.relations.map(
        (row) =>
          `${row.interactionKey}|${row.behaviorId}|${row.uiId}|${row.specId}|${row.screenId}`,
      );
      const tuples = new Set(rows);
      const contains = (token: string) =>
        correspondence.syntaxTokens.some(({ text }) => text.includes(token));
      if (
        !contains("状態: Pass") ||
        !contains("Definition対応とDetail対応を分けた") ||
        !contains("UIからBHVへのCoverageを全件評価した") ||
        !contains("BHVからUIへのCoverageを全件評価した") ||
        hasScreenRelationMismatch ||
        rows.length !== tuples.size ||
        tuples.size !== expectedTuples.size ||
        [...tuples].some((tuple) => !expectedTuples.has(tuple)) ||
        [...expectedTuples].some((tuple) => !tuples.has(tuple)) ||
        expectedTuples.size !== new Set(pairs).size
      )
        return [
          {
            kind: "artifact.spec.detail-correspondence-state-invalid",
            targetIdentity: correspondence.source.path,
            location: { path: correspondence.source.path },
            reason: "detail-correspondence-state-invalid",
            details: {},
          },
        ];
      return [];
    }
    case "ui_spec_downstream": {
      const expectedDetailRelations = deriveDetailRelations(
        request.definitions,
        request.uiDetailIndex,
        request.specDetailIndex,
      );
      const architectureCentralRelations = request.architectureTrace.relations;
      const qualityCentralRelations = request.qualityTrace.relations;
      const architectureCentralRelationRows =
        request.architectureTrace.relationRows;
      const qualityCentralRelationRows = request.qualityTrace.relationRows;
      const hasDuplicateCentralRelation =
        request.architectureTrace.hasDuplicateRelations ||
        request.qualityTrace.hasDuplicateRelations;
      const issuedScreenIds = request.architectureTrace.screens;
      const issuedPartIds = request.architectureTrace.parts;
      const issuedBehaviorIds = request.architectureTrace.behaviors;
      const qualityScreenIds = request.qualityTrace.screens;
      const qualityPartIds = request.qualityTrace.parts;
      const qualityBehaviorIds = request.qualityTrace.behaviors;
      const currentUiDefinitionCount = request.uiDefinitionCount;
      /**
       * 二つのOwner集合が完全一致するか確認する。
       * @responsibility 二つのOwner集合が完全一致するか確認する。
       * @trace ARCH-000008
       * @input left、right: 比較する集合。
       * @returns 要素数と要素がすべて一致する場合true。
       * @precondition 呼出し元が本文を可視化し、対象の観測を完了している。
       * @postcondition 入力を変更せず、既存の出現順・集合条件を保持する。
       * @effect N/A: 取得済み値だけを扱う同期処理。
       * @failure 解析例外を伝播し、観測不能を空値へ変換しない。
       * @invariant 要素数だけで一致を推定しない。
       * @boundary N/A: 同一Process内のDetail意味モデル。
       * @security 実在・認可・品質全体の成立を発行しない。
       * @concurrency N/A: 共有可変状態を持たない。
       */
      const sameSet = (
        left: ReadonlySet<string>,
        right: ReadonlySet<string>,
      ): boolean =>
        left.size === right.size && [...left].every((item) => right.has(item));
      /**
       * Relationまたは定義とOwnerを局所集合へ追加する。
       * @responsibility Relationまたは定義とOwnerを局所集合へ追加する。
       * @trace ARCH-000008
       * @input target: 局所Map。key: 対象ID。owner: 列挙されたOwner名。
       * @returns なし。
       * @precondition 呼出し元が本文を可視化し、対象の観測を完了している。
       * @postcondition 指定した局所Mapの対象集合へOwnerを追加する。同じOwnerはSetで重複除去する。
       * @effect 呼出し元が所有する局所Map／Setを更新し、外部Effectはない。
       * @failure 解析例外を伝播し、観測不能を空値へ変換しない。
       * @invariant 同じOwnerの重複はSetへ畳み、出現数は別途保持する。
       * @boundary N/A: 同一Process内のDetail意味モデル。
       * @security 実在・認可・品質全体の成立を発行しない。
       * @concurrency N/A: 共有可変状態を持たない。
       */
      const addOwner = (
        target: Map<string, Set<string>>,
        key: string,
        owner: string,
      ): void => {
        const owners = target.get(key) ?? new Set<string>();
        owners.add(owner);
        target.set(key, owners);
      };
      const architectureUiOwners = new Map<string, Set<string>>();
      const architectureSpecOwners = new Map<string, Set<string>>();
      const architectureRelationOwners = new Map<string, Set<string>>();
      const architectureAreaOwners = new Map<string, Set<string>>();
      const qualityUiOwners = new Map<string, Set<string>>();
      const qualitySpecOwners = new Map<string, Set<string>>();
      const qualityRelationOwners = new Map<string, Set<string>>();
      const areasByArchitecture = new Map<string, Set<string>>();
      let architectureRelationAssignmentRows = 0;
      let architectureAreaAssignmentRows = 0;
      let qualityRelationAssignmentRows = 0;
      let hasDuplicateRelationAssignment = false;
      for (const ownership of request.architectureDefinitions) {
        const owner = ownership.expectedIdentity;
        for (const ui of ownership.uiIds)
          addOwner(architectureUiOwners, ui, owner);
        for (const spec of ownership.specIds)
          addOwner(architectureSpecOwners, spec, owner);
        for (const key of ownership.relations)
          addOwner(architectureRelationOwners, key, owner);
        architectureRelationAssignmentRows += ownership.relations.length;
        if (ownership.hasDuplicateRelations)
          hasDuplicateRelationAssignment = true;
      }
      for (const ownership of request.areas) {
        const area = ownership.expectedIdentity;
        for (const owner of ownership.architectureIds)
          addOwner(areasByArchitecture, owner, area);
        for (const key of ownership.relations)
          addOwner(architectureAreaOwners, key, area);
        architectureAreaAssignmentRows += ownership.relations.length;
        if (ownership.hasDuplicateRelations)
          hasDuplicateRelationAssignment = true;
      }
      for (const ownership of request.qualityDefinitions) {
        const owner = ownership.expectedIdentity;
        for (const ui of ownership.uiIds) addOwner(qualityUiOwners, ui, owner);
        for (const spec of ownership.specIds)
          addOwner(qualitySpecOwners, spec, owner);
        for (const key of ownership.relations)
          addOwner(qualityRelationOwners, key, owner);
        qualityRelationAssignmentRows += ownership.relations.length;
        if (ownership.hasDuplicateRelations)
          hasDuplicateRelationAssignment = true;
      }
      /**
       * Relation別Owner集合の要素数を合計する。
       * @responsibility Relation別Owner集合の要素数を合計する。
       * @trace ARCH-000008
       * @input assignments: Relation別Owner集合。
       * @returns Owner集合の総要素数。
       * @precondition 呼出し元が本文を可視化し、対象の観測を完了している。
       * @postcondition 入力を変更せず、既存の出現順・集合条件を保持する。
       * @effect N/A: 取得済み値だけを扱う同期処理。
       * @failure 解析例外を伝播し、観測不能を空値へ変換しない。
       * @invariant 同一Ownerの重複をSetの要素数として数える。
       * @boundary N/A: 同一Process内のDetail意味モデル。
       * @security 実在・認可・品質全体の成立を発行しない。
       * @concurrency N/A: 共有可変状態を持たない。
       */
      const ownerAssignmentCount = (
        assignments: Map<string, Set<string>>,
      ): number =>
        [...assignments.values()].reduce(
          (total, owners) => total + owners.size,
          0,
        );
      let hasRelationClosureMismatch = false;
      for (const [relationKey, relation] of expectedDetailRelations) {
        const uiArchitecture =
          architectureUiOwners.get(relation.ui) ?? new Set();
        const specArchitecture =
          architectureSpecOwners.get(relation.spec) ?? new Set();
        const commonArchitecture = new Set(
          [...uiArchitecture].filter((owner) => specArchitecture.has(owner)),
        );
        const expectedArchitectureOwners = commonArchitecture.size
          ? commonArchitecture
          : new Set([...uiArchitecture, ...specArchitecture]);
        const expectedArchitectureMode =
          commonArchitecture.size === 0
            ? "Joint"
            : commonArchitecture.size === 1
              ? "Single"
              : "Shared";
        const allowedAreas = new Set<string>();
        for (const owner of expectedArchitectureOwners)
          for (const area of areasByArchitecture.get(owner) ?? [])
            allowedAreas.add(area);
        const expectedAreas =
          architectureAreaOwners.get(relationKey) ?? new Set<string>();
        const hasInvalidAreaAssignment =
          expectedAreas.size === 0 ||
          [...expectedAreas].some((area) => !allowedAreas.has(area)) ||
          [...expectedArchitectureOwners].some(
            (owner) =>
              ![...(areasByArchitecture.get(owner) ?? [])].some((area) =>
                expectedAreas.has(area),
              ),
          );
        const architectureCentral =
          architectureCentralRelations.get(relationKey);
        const uiQuality = qualityUiOwners.get(relation.ui) ?? new Set();
        const specQuality = qualitySpecOwners.get(relation.spec) ?? new Set();
        const commonQuality = new Set(
          [...uiQuality].filter((owner) => specQuality.has(owner)),
        );
        const expectedQualityOwners = commonQuality.size
          ? commonQuality
          : new Set([...uiQuality, ...specQuality]);
        const expectedQualityMode =
          commonQuality.size === 0
            ? "Joint"
            : commonQuality.size === 1
              ? "Single"
              : "Shared";
        const qualityCentral = qualityCentralRelations.get(relationKey);
        if (
          !architectureCentral ||
          architectureCentral.bhv !== relation.bhv ||
          architectureCentral.mode !== expectedArchitectureMode ||
          !sameSet(architectureCentral.owners, expectedArchitectureOwners) ||
          !sameSet(architectureCentral.areas, expectedAreas) ||
          hasInvalidAreaAssignment ||
          !sameSet(
            architectureRelationOwners.get(relationKey) ?? new Set(),
            expectedArchitectureOwners,
          ) ||
          !qualityCentral ||
          qualityCentral.bhv !== relation.bhv ||
          qualityCentral.mode !== expectedQualityMode ||
          !sameSet(qualityCentral.owners, expectedQualityOwners) ||
          !sameSet(
            qualityRelationOwners.get(relationKey) ?? new Set(),
            expectedQualityOwners,
          )
        )
          hasRelationClosureMismatch = true;
      }

      const allIssuedIds = [
        ...issuedScreenIds,
        ...issuedPartIds,
        ...issuedBehaviorIds,
      ];
      if (
        issuedScreenIds.size !== currentUiDefinitionCount ||
        issuedPartIds.size !== currentUiDefinitionCount ||
        issuedBehaviorIds.size !== request.specDefinitionCount ||
        qualityScreenIds.size !== issuedScreenIds.size ||
        qualityPartIds.size !== issuedPartIds.size ||
        qualityBehaviorIds.size !== issuedBehaviorIds.size ||
        allIssuedIds.some(
          (id) =>
            !request.architectureDefinitionObservations.some((model) =>
              model.syntaxTokens.some((line) => line.text.includes(id)),
            ) ||
            !request.qualityDefinitionObservations.some((model) =>
              model.visibleLines.some((line) => line.text.includes(id)),
            ),
        ) ||
        architectureCentralRelations.size !== expectedDetailRelations.size ||
        qualityCentralRelations.size !== expectedDetailRelations.size ||
        !sameSet(
          new Set(architectureAreaOwners.keys()),
          new Set(expectedDetailRelations.keys()),
        ) ||
        architectureCentralRelationRows !== architectureCentralRelations.size ||
        qualityCentralRelationRows !== qualityCentralRelations.size ||
        architectureRelationAssignmentRows !==
          ownerAssignmentCount(architectureRelationOwners) ||
        architectureAreaAssignmentRows !==
          ownerAssignmentCount(architectureAreaOwners) ||
        qualityRelationAssignmentRows !==
          ownerAssignmentCount(qualityRelationOwners) ||
        hasDuplicateRelationAssignment ||
        hasDuplicateCentralRelation ||
        hasRelationClosureMismatch
      )
        return [
          {
            kind: "artifact.spec.detail-downstream-coverage-invalid",
            targetIdentity: request.path,
            location: { path: request.path },
            reason: "detail-downstream-coverage-invalid",
            details: {},
          },
        ];
      return [];
    }
    case "ui_spec_evidence": {
      const contains = (token: string) =>
        request.correspondence.syntaxTokens.some(({ text }) =>
          text.includes(token),
        );
      const correspondencePairs = request.correspondence.pairs.map(
        (pair) => `${pair.uiId}|${pair.specId}`,
      );
      const correspondenceReasons = request.evaluations.flatMap(
        (item) => item.reasons,
      );
      const registryUiPairs = new Set(
        request.registry.entries.flatMap((entry) =>
          entry.uiIds.map((ui) => `${ui}|${entry.identity}`),
        ),
      );
      const recordedDefinitionFingerprint =
        request.correspondence.recordedFingerprint;
      const actualDefinitionFingerprint = request.actualFingerprint;
      const isCorrespondenceRevisionInvalid =
        recordedDefinitionFingerprint === undefined ||
        recordedDefinitionFingerprint !== actualDefinitionFingerprint;
      let isCorrespondenceEvidenceInvalid =
        request.evaluations.some((item) => item.invalid) ||
        !contains("## 1. レビュー対象") ||
        !contains(EXPECTED_HEADER);
      const issues: DocumentIssue[] = [];
      if (
        correspondenceReasons.length !== registryUiPairs.size * 8 ||
        new Set(correspondenceReasons).size !== correspondenceReasons.length
      )
        isCorrespondenceEvidenceInvalid = true;
      const correspondenceSet = new Set(correspondencePairs);
      if (
        correspondencePairs.length !== correspondenceSet.size ||
        [...registryUiPairs].some((pair) => !correspondenceSet.has(pair)) ||
        [...correspondenceSet].some((pair) => !registryUiPairs.has(pair))
      )
        issues.push({
          kind: "artifact.spec.correspondence-closure-mismatch",
          targetIdentity: request.correspondence.source.path,
          location: { path: request.correspondence.source.path },
          reason: "correspondence-closure-mismatch",
          details: {},
        });
      if (isCorrespondenceEvidenceInvalid)
        issues.push({
          kind: "artifact.spec.correspondence-evidence-invalid",
          targetIdentity: request.correspondence.source.path,
          location: { path: request.correspondence.source.path },
          reason: "correspondence-evidence-invalid",
          details: {},
        });
      if (isCorrespondenceRevisionInvalid)
        issues.push({
          kind: "artifact.spec.correspondence-revision-invalid",
          targetIdentity: request.correspondence.source.path,
          location: { path: request.correspondence.source.path },
          reason: "correspondence-revision-invalid",
          details: {
            recorded: recordedDefinitionFingerprint ?? null,
            actual: actualDefinitionFingerprint,
          },
        });
      return issues;
    }
    case "architecture_inputs": {
      const {
        sourcePath,
        analysisPath,
        analyses,
        uiIds,
        specIds,
        actualAnalysisIds,
      } = request;
      const analyzedUi = new Set(
        analyses
          .filter((model) => model.view === "UI")
          .map((model) => model.expectedIdentity),
      );
      const analyzedSpec = new Set(
        analyses
          .filter((model) => model.view === "SPEC")
          .map((model) => model.expectedIdentity),
      );
      const issues: DocumentIssue[] = [];
      if (analyzedUi.size !== uiIds.size || analyzedSpec.size !== specIds.size)
        issues.push({
          kind: "artifact.architecture.analysis-coverage-mismatch",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "analysis-coverage-mismatch",
          details: {},
        });
      const expectedAnalysisIds = new Set([...uiIds, ...specIds]);
      if (
        actualAnalysisIds.size !== expectedAnalysisIds.size ||
        [...actualAnalysisIds].some((id) => !expectedAnalysisIds.has(id)) ||
        [...expectedAnalysisIds].some((id) => !actualAnalysisIds.has(id))
      )
        issues.push({
          kind: "artifact.architecture.analysis-directory-coverage-mismatch",
          targetIdentity: analysisPath,
          location: { path: analysisPath },
          reason: "analysis-directory-coverage-mismatch",
          details: {},
        });

      return issues;
    }
    case "quality_architecture_models": {
      const expected = new Set(
        architectureCrossModelFiles.map((file) =>
          path.join(request.architectureRoot, file),
        ),
      );
      const linked = new Set(
        request.integration.crossModelReferences.map((target) =>
          path.resolve(request.integrationDirectory, target),
        ),
      );
      if (
        linked.size === expected.size &&
        [...expected].every((file) => linked.has(file)) &&
        [...linked].every((file) => expected.has(file))
      )
        return [];
      return [
        {
          kind: "artifact.quality-analysis.architecture-cross-model-coverage-mismatch",
          targetIdentity: request.analysisPath,
          location: { path: request.analysisPath },
          reason: "architecture-cross-model-coverage-mismatch",
          details: {},
        },
      ];
    }
    case "quality_goals": {
      const { rows: crossModelRows, goalLabelToSlug, analysisPath } = request;
      const issues: DocumentIssue[] = [];

      const crossModelGoals = new Set<string>();
      for (const cells of crossModelRows) {
        const goalSlug = goalLabelToSlug.get(cells[0] as string);
        if (!goalSlug || cells.length !== 6) {
          issues.push({
            kind: "artifact.quality-analysis.cross-model-row-invalid",
            targetIdentity: analysisPath,
            location: { path: analysisPath },
            reason: "cross-model-row-invalid",
            details: {},
          });
          continue;
        }
        if (crossModelGoals.has(goalSlug))
          issues.push({
            kind: "artifact.quality-analysis.cross-model-goal-duplicate",
            targetIdentity: analysisPath,
            location: { path: analysisPath },
            reason: "cross-model-goal-duplicate",
            details: { value0: String(goalSlug) },
          });
        crossModelGoals.add(goalSlug);
        for (const disposition of cells.slice(1))
          if (disposition !== "Required" && !/^N\/A:\s*\S.+/u.test(disposition))
            issues.push({
              kind: "artifact.quality-analysis.cross-model-disposition-invalid",
              targetIdentity: analysisPath,
              location: { path: analysisPath },
              reason: "cross-model-disposition-invalid",
              details: {},
            });
      }
      const goalSlugs = new Set(goalLabelToSlug.values());
      if (
        crossModelGoals.size !== goalSlugs.size ||
        [...goalSlugs].some((goalSlug) => !crossModelGoals.has(goalSlug)) ||
        [...crossModelGoals].some((goalSlug) => !goalSlugs.has(goalSlug))
      )
        issues.push({
          kind: "artifact.quality-analysis.cross-model-goal-coverage-mismatch",
          targetIdentity: analysisPath,
          location: { path: analysisPath },
          reason: "cross-model-goal-coverage-mismatch",
          details: {},
        });

      return issues;
    }
  }
  throw new TypeError("document_relation_kind_invalid");
}

/**
 * 正本文書の解析結果から版・Candidate相関とStable観測候補を導出する。
 * @responsibility 並行する手製DTOを受けず、実モデルの同じ断面から集合と診断を構築する。
 * @trace ARCH-000008
 * @input documents: 同じ取得から構築された正本文書のParse結果列。
 * @returns 版集合・Candidate Baseline・Stable候補版と順序付きIssue。
 * @precondition 取得・Root・文書列挙・適用範囲は利用側が所有する。
 * @postcondition 版不一致→局所Baseline不備→Candidate相関の順を維持する。
 * @effect N/A: モデル値だけを扱う。
 * @failure 既存の候補版取得不能を例外とし、欠測を補完しない。
 * @invariant Stable候補は純粋な宣言の相関であり、official／scope／Gitを観測しない。
 * @boundary 完成Parseと文書集合の関係評価。
 * @security 候補版や空Issueを品質成立・公開・実行許可へ昇格しない。
 * @concurrency N/A: 共有状態なし。
 */
export function inspectReleaseDocuments(
  documents: readonly (ParseResult<CanonicalDocument> &
    Readonly<{ result: CanonicalDocument }>)[],
): Readonly<{
  versions: ReadonlySet<string>;
  versionedDocumentCount: number;
  candidateReleasedBaseline: string | null;
  stableVersion: string | null;
  issues: readonly DocumentIssue[];
}> {
  const issues: DocumentIssue[] = [];
  const models = documents.map((document) => document.result);
  const versions = new Set(
    models.flatMap((document) =>
      document.version === null ? [] : [document.version],
    ),
  );
  if (versions.size > 1) {
    for (const document of models) {
      const { version } = document;
      if (version === null) continue;
      const file = document.source.path;
      issues.push({
        kind: "artifact.document-identity.version-mismatch",
        targetIdentity: file,
        location: { path: file },
        reason: "version-mismatch",
        details: {
          value0: String(version),
          value1: String(JSON.stringify([...versions].sort())),
        },
      });
    }
  }
  const candidateDocuments = models.filter(
    ({ status }) => status === "Candidate",
  );
  // Candidate局所不備は下の集合文脈で再構成し、件数・順序・集合値を保つ。
  for (const document of documents) {
    issues.push(
      ...document.issues.filter(
        (issue) =>
          issue.kind ===
          "artifact.document-identity.released-baseline-outside-candidate",
      ),
    );
  }
  let candidateReleasedBaseline: string | null = null;
  if (candidateDocuments.length > 0) {
    if (candidateDocuments.length !== models.length) {
      for (const document of models) {
        const file = document.source.path;
        const status = document.status;
        issues.push({
          kind: "artifact.document-identity.candidate-status-mismatch",
          targetIdentity: file,
          location: { path: file },
          reason: "candidate-status-mismatch",
          details: { value0: String(status ?? "missing") },
        });
      }
    }
    const baselines = new Set(
      candidateDocuments
        .map(({ releasedBaseline }) => releasedBaseline)
        .filter((value): value is string => typeof value === "string"),
    );
    if (
      baselines.size !== 1 ||
      candidateDocuments.some(({ releasedBaseline }) => !releasedBaseline)
    ) {
      for (const document of candidateDocuments) {
        const file = document.source.path;
        const releasedBaseline = document.releasedBaseline;
        issues.push({
          kind: "artifact.document-identity.candidate-released-baseline-mismatch",
          targetIdentity: file,
          location: { path: file },
          reason: "candidate-released-baseline-mismatch",
          details: {
            value0: String(releasedBaseline ?? "missing"),
            value1: String(JSON.stringify([...baselines].sort())),
          },
        });
      }
    } else {
      const [releasedBaseline] = baselines;
      if (releasedBaseline === undefined) {
        throw new Error("candidate_released_baseline_missing");
      }
      candidateReleasedBaseline = releasedBaseline;
      if (versions.has(releasedBaseline)) {
        for (const document of candidateDocuments) {
          const file = document.source.path;
          issues.push({
            kind: "artifact.document-identity.candidate-version-equals-released-baseline",
            targetIdentity: file,
            location: { path: file },
            reason: "candidate-version-equals-released-baseline",
            details: { value0: String(candidateReleasedBaseline) },
          });
        }
      }
    }
  }

  const stableDocuments = models.filter(
    (document) => document.status === "Stable",
  );
  let stableVersion: string | null = null;
  if (
    models.length > 1 &&
    stableDocuments.length > 0 &&
    new Set(stableDocuments.map((document) => document.version)).size === 1 &&
    stableDocuments.every((document) => document.version !== null) &&
    versions.size === 1
  ) {
    const selected = [...versions][0];
    if (selected === undefined)
      throw new Error("stable_release_version_missing");
    stableVersion = selected;
  }
  return {
    versions,
    versionedDocumentCount: models.filter(
      (document) => document.version !== null,
    ).length,
    candidateReleasedBaseline,
    stableVersion,
    issues,
  };
}

/**
 * 実在確認済みUX集合と分析対象の網羅性を照合する。
 * @responsibility 取得済みIAモデルの局所不変条件を既存順で照合する。
 * @trace ARCH-000008
 * @input expectedUxIds、actualUxIds: 観測済み集合。sourcePath: 入口の相対Path。
 * @returns 原文・投影内容と、旧不一致条件の中立Issueを分けたOutcome。
 * @precondition 対象の観測・本文取得は呼出し元が完了している。
 * @postcondition 重複・不足・余剰を成功へ補完しない。
 * @effect N/A: 取得済み入力と局所集合だけを扱う。
 * @failure 例外を伝播し、観測や移行を代行しない。
 * @invariant 現在のIA契約とIssueの順序を維持する。
 * @boundary N/A: 同一Process内のモデル比較。
 * @security 採用・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有状態を持たない。
 */
function compareIaAnalysisCoverage(
  expectedUxIds: ReadonlySet<string>,
  actualUxIds: ReadonlySet<string>,
  sourcePath: string,
): readonly DocumentIssue[] {
  return expectedUxIds.size !== actualUxIds.size ||
    [...expectedUxIds].some((id) => !actualUxIds.has(id))
    ? [iaIssue("analysis-coverage-mismatch", sourcePath, sourcePath)]
    : [];
}
/**
 * IA入口の登録集合と実在する定義集合を照合する。
 * @responsibility 取得済みIAモデルの局所不変条件を既存順で照合する。
 * @trace ARCH-000008
 * @input index: 解析済み入口。actualIaIds: 実在確認済み集合。sourcePath: 入口の相対Path。
 * @returns 不一致を表す中立Issue列。
 * @precondition 対象の観測・本文取得は呼出し元が完了している。
 * @postcondition 重複・不足・余剰を成功へ補完しない。
 * @effect N/A: 取得済み入力と局所集合だけを扱う。
 * @failure 例外を伝播し、観測や移行を代行しない。
 * @invariant 現在のIA契約とIssueの順序を維持する。
 * @boundary N/A: 同一Process内のモデル比較。
 * @security 採用・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有状態を持たない。
 */
function compareIaIndexCoverage(
  index: IaIndexModel,
  actualIaIds: ReadonlySet<string>,
  sourcePath: string,
): readonly DocumentIssue[] {
  return index.isRowInvalid ||
    index.ids.size !== actualIaIds.size ||
    [...index.ids].some((id) => !actualIaIds.has(id)) ||
    [...actualIaIds].some((id) => !index.ids.has(id))
    ? [iaIssue("definition-index-coverage-mismatch", sourcePath, sourcePath)]
    : [];
}
/**
 * IA入口・分析・定義の関係とObject対応の閉包を照合する。
 * @responsibility 取得済みIAモデルの局所不変条件を既存順で照合する。
 * @trace ARCH-000008
 * @input index、analyses、definitions: 解析済みIAモデル。sourcePath: 入口の相対Path。
 * @returns 不一致を表す中立Issue列。
 * @precondition 対象の観測・本文取得は呼出し元が完了している。
 * @postcondition 重複・不足・余剰を成功へ補完しない。
 * @effect N/A: 取得済み入力と局所集合だけを扱う。
 * @failure 例外を伝播し、観測や移行を代行しない。
 * @invariant 現在のIA契約とIssueの順序を維持する。
 * @boundary N/A: 同一Process内のモデル比較。
 * @security 採用・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有状態を持たない。
 */
function compareIaRelations(
  index: IaIndexModel,
  analyses: readonly IaAnalysisModel[],
  definitions: readonly IaDefinitionModel[],
  sourcePath: string,
): readonly DocumentIssue[] {
  const registryPairKeys = index.pairs;
  const registryPairs = new Set(registryPairKeys);
  const analysisPairKeys = analyses.flatMap((item) => [...item.pairs]);
  const analysisPairs = new Set(analysisPairKeys);
  const definitionPairKeys = definitions.flatMap((item) => [...item.pairs]);
  const definitionPairs = new Set(definitionPairKeys);
  const analysisMappingKeys = analyses.flatMap((item) => [...item.mappingKeys]);
  const analysisMappingKeySet = new Set(analysisMappingKeys);
  const definitionMappingKeys = definitions.flatMap((item) => [
    ...item.mappingKeys,
  ]);
  const definitionMappingKeySet = new Set(definitionMappingKeys);
  const issues: DocumentIssue[] = [];
  if (
    registryPairKeys.length !== registryPairs.size ||
    analysisPairKeys.length !== analysisPairs.size ||
    definitionPairKeys.length !== definitionPairs.size ||
    [...registryPairs].some((pair) => !analysisPairs.has(pair)) ||
    [...analysisPairs].some((pair) => !registryPairs.has(pair)) ||
    [...analysisPairs].some((pair) => !definitionPairs.has(pair)) ||
    [...definitionPairs].some((pair) => !analysisPairs.has(pair))
  )
    issues.push(
      iaIssue("analysis-definition-closure-mismatch", sourcePath, sourcePath),
    );
  if (
    analysisMappingKeys.length !== analysisMappingKeySet.size ||
    definitionMappingKeys.length !== definitionMappingKeySet.size ||
    analysisMappingKeySet.size !== definitionMappingKeySet.size ||
    [...analysisMappingKeySet].some(
      (key) => !definitionMappingKeySet.has(key),
    ) ||
    [...definitionMappingKeySet].some((key) => !analysisMappingKeySet.has(key))
  )
    issues.push(
      iaIssue("object-mapping-closure-mismatch", sourcePath, sourcePath),
    );
  return issues;
}
/**
 * UXとJourneyの関係集合の閉包を検査する。
 * @responsibility 用途ごとに異なる非空条件と双方向包含を既存順で照合する。
 * @trace ARCH-000008
 * @input request: 二成果物の位置、入口モデルと分析／Journey関係集合。
 * @returns UX、Journeyの順序付き中立Issue列。
 * @precondition 呼出し元が本文解析と旧Root観測を完了している。
 * @postcondition UXはID非空、Journeyは関係非空を要求し、既存のSet比較を維持する。
 * @effect N/A: 取得済み集合と局所配列だけを扱う同期検査。
 * @failure 集合操作の例外を伝播し不足を補完しない。
 * @invariant 両用途の空条件を一つへ丸めず、Issue順と位置を維持する。
 * @boundary N/A: 同一Process内の意味集合検査。
 * @security 集合一致を品質全体の成立・認可へ昇格しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
function compareUxRelations(
  request: Readonly<{
    uxIndexPath: string;
    experienceMapPath: string;
    index: UxIndexModel;
    analysisRequirementRelations: ReadonlySet<string>;
    canonicalJourneyRelations: ReadonlySet<string>;
    analysisJourneyRelations: ReadonlySet<string>;
  }>,
): readonly DocumentIssue[] {
  const { uxIndexPath, experienceMapPath } = request;
  const canonicalUxIds = request.index.ids;
  const canonicalRelationPairs = request.index.requirementRelations;
  const analysisRelationPairs = request.analysisRequirementRelations;
  const canonicalJourneyPairs = request.canonicalJourneyRelations;
  const analysisJourneyPairs = request.analysisJourneyRelations;
  const issues: DocumentIssue[] = [];
  if (
    canonicalUxIds.size === 0 ||
    [...canonicalRelationPairs].some(
      (pair) => !analysisRelationPairs.has(pair),
    ) ||
    [...analysisRelationPairs].some((pair) => !canonicalRelationPairs.has(pair))
  )
    issues.push({
      kind: "artifact.ux.outcome-relation-closure-mismatch",
      targetIdentity: uxIndexPath,
      location: { path: uxIndexPath },
      reason: "outcome-relation-closure-mismatch",
      details: {},
    });
  if (
    canonicalJourneyPairs.size === 0 ||
    [...canonicalJourneyPairs].some(
      (pair) => !analysisJourneyPairs.has(pair),
    ) ||
    [...analysisJourneyPairs].some((pair) => !canonicalJourneyPairs.has(pair))
  )
    issues.push({
      kind: "artifact.ux.journey-relation-closure-mismatch",
      targetIdentity: experienceMapPath,
      location: { path: experienceMapPath },
      reason: "journey-relation-closure-mismatch",
      details: {},
    });
  return issues;
}
/**
 * UX分析の正式入力Headerと観測済み事実を照合する。
 * @responsibility 可視Header・期待リンク・生本文の補完禁止を限定Issueへ変換する。
 * @trace ARCH-000008
 * @input source: 既読分析本文と位置。requirementId: 期待REQ ID。observation: 既存参照観測の六事実。
 * @returns 正式入力不正の中立Issue、または空列。
 * @precondition 呼出し元が定義read・参照解決・境界確認を完了している。
 * @postcondition 既存のFence除去→Comment除去と生本文禁止条件を維持する。
 * @effect N/A: 既読本文と局所値だけを扱う同期検査。
 * @failure 解析例外を伝播し観測不足を補完しない。
 * @invariant Path実在や認可を再判定せず、正式入力診断を本文診断と分離する。
 * @boundary 参照観測の事実と本文意味の境界。
 * @security Boolean(definition)をtrim等で強化せず、確認不能を安全と扱わない。
 * @concurrency N/A: 共有状態を持たない。
 */
function compareUxFormalInput(
  model: UxAnalysisModel,
  observation: UxFormalInputObservation,
): readonly DocumentIssue[] {
  const source = model.source;
  const requirementId = model.expectedIdentity;
  if (
    !observation.definitionHasContent ||
    model.formalInput.headers.length !== 1 ||
    !model.formalInput.expectedLinkMatches ||
    !observation.matchingDefinitionOnly ||
    observation.hasSourceAnalysis ||
    observation.hasInvalidDiscoveryTarget ||
    observation.hasInvalidEntity ||
    observation.hasUnsafeTarget ||
    model.formalInput.forbiddenDeclaration
  )
    return [
      {
        kind: "artifact.ux.requirement-formal-input-invalid",
        targetIdentity: requirementId,
        location: { path: source.path },
        reason: "requirement-formal-input-invalid",
        details: {},
      },
    ];
  return [];
}
/**
 * IA定義が記載した分析Objectと取得済み分析を比較する。
 * @responsibility 未取得参照とIdentity不一致を区別せず旧拒否条件へ接続し、受理された対応列だけを返す。
 * @trace ARCH-000008
 */
function compareIaDefinitionEvidence(
  definition: IaDefinitionModel,
  analyses: ReadonlyMap<string, IaAnalysisModel>,
) {
  const accepted = definition.mappingEvidence.filter((e) =>
    analyses.get(e.analysisId)?.objects.has(e.sourceObject),
  );
  const invalid =
    accepted.length !== definition.mappingEvidence.length ||
    definition.identityEvidence.some(
      (e) =>
        analyses
          .get(/^UX-[0-9]{6}/u.exec(e.sourceObject)?.[0] ?? "")
          ?.objectIdentities.get(
            e.sourceObject.replace(/^UX-[0-9]{6}: /u, ""),
          ) !== e.identity,
    );
  return { invalid, mappingKeys: accepted.map((e) => e.key) };
}

/**
 * 実在するUXとIA入力の分析網羅性を照合する。
 * @responsibility 実在するUXとIA入力の分析網羅性を照合する。既読本文と意味モデルだけを扱う。
 * @trace ARCH-000008
 * @input sourcePath: 診断位置。uxIds／iaIds: 正式入力集合。analysisUxIds／analysisIaIds: 観測済み分析ID集合。
 * @returns UX観点、IA観点の順序で返す網羅性違反Issue列。
 * @precondition 呼出し元が正式入力と実在分析の集合を観測している。
 * @postcondition 各集合の過不足だけを照合し、本文やFilesystemを再観測しない。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・重複・集合の受理条件を維持する。
 * @boundary N/A: 同一Process内のUIモデル検査。
 * @security 認可・実在確認・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
function inspectUiAnalysisCoverage(
  sourcePath: string,
  uxIds: ReadonlySet<string>,
  iaIds: ReadonlySet<string>,
  analysisUxIds: ReadonlySet<string>,
  analysisIaIds: ReadonlySet<string>,
): readonly DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  if (
    uxIds.size !== analysisUxIds.size ||
    [...uxIds].some((id) => !analysisUxIds.has(id)) ||
    [...analysisUxIds].some((id) => !uxIds.has(id))
  )
    issues.push({
      kind: "artifact.ui.ux-analysis-coverage-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "ux-analysis-coverage-mismatch",
      details: {},
    });
  if (
    iaIds.size !== analysisIaIds.size ||
    [...iaIds].some((id) => !analysisIaIds.has(id)) ||
    [...analysisIaIds].some((id) => !iaIds.has(id))
  )
    issues.push({
      kind: "artifact.ui.ia-analysis-coverage-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "ia-analysis-coverage-mismatch",
      details: {},
    });

  return issues;
}

/**
 * UI入口と実在する定義IDの集合を照合する。
 * @responsibility UI入口と実在する定義IDの集合を照合する。既読本文と意味モデルだけを扱う。
 * @trace ARCH-000008
 * @input sourcePath: 診断位置。index: 入口モデル。actualUiIds: 観測済み定義ID集合。
 * @returns 入口と実在定義の集合不一致を表すIssue列。
 * @precondition 入口解析と定義IDの観測が完了している。
 * @postcondition 二集合の過不足だけを照合し、本文やFilesystemを再観測しない。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・重複・集合の受理条件を維持する。
 * @boundary N/A: 同一Process内のUIモデル検査。
 * @security 認可・実在確認・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
function inspectUiIndexCoverage(
  sourcePath: string,
  index: UiIndex,
  actualUiIds: ReadonlySet<string>,
): readonly DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const registryUiIds = new Set(index.entries.map((entry) => entry.identity));
  if (
    registryUiIds.size !== actualUiIds.size ||
    [...registryUiIds].some((id) => !actualUiIds.has(id)) ||
    [...actualUiIds].some((id) => !registryUiIds.has(id))
  )
    issues.push({
      kind: "artifact.ui.definition-index-coverage-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "definition-index-coverage-mismatch",
      details: {},
    });

  return issues;
}

/**
 * UI入口と両観点の分析および定義の関係閉包を照合する。
 * @responsibility UI入口と両観点の分析および定義の関係閉包を照合する。既読本文と意味モデルだけを扱う。
 * @trace ARCH-000008
 * @input sourcePath: 診断位置。index: 入口モデル。analyses／definitions: 各本文から抽出した関係モデル列。
 * @returns 重複または関係閉包不一致を表すIssue列。
 * @precondition 不正本文からも抽出された関係を含め、対象モデルを取得している。
 * @postcondition 二観点の関係重複と閉包を照合し、入力列を変更しない。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・重複・集合の受理条件を維持する。
 * @boundary N/A: 同一Process内のUIモデル検査。
 * @security 認可・実在確認・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
function inspectUiRelations(
  sourcePath: string,
  index: UiIndex,
  analyses: readonly UiAnalysis[],
  definitions: readonly UiDefinition[],
): readonly DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const registryUxUiKeys = index.entries.flatMap((entry) =>
    entry.uxIds.map((id) => `${id}|${entry.identity}`),
  );
  const registryIaUiKeys = index.entries.flatMap((entry) =>
    entry.iaIds.map((id) => `${id}|${entry.identity}`),
  );
  const registryUxUi = new Set(registryUxUiKeys);
  const registryIaUi = new Set(registryIaUiKeys);
  const analysisUxUiKeys = analyses.flatMap((model) =>
    model.view === "ux"
      ? model.targets.map((ref) => `${model.expectedIdentity}|${ref.identity}`)
      : [],
  );
  const analysisIaUiKeys = analyses.flatMap((model) =>
    model.view === "ia"
      ? model.targets.map((ref) => `${model.expectedIdentity}|${ref.identity}`)
      : [],
  );
  const analysisUxUi = new Set(analysisUxUiKeys);
  const analysisIaUi = new Set(analysisIaUiKeys);
  const definitionUxUiKeys = definitions.flatMap((model) =>
    model.analysisInputs.ux.map(
      (ref) => `${ref.identity}|${model.expectedIdentity}`,
    ),
  );
  const definitionIaUiKeys = definitions.flatMap((model) =>
    model.analysisInputs.ia.map(
      (ref) => `${ref.identity}|${model.expectedIdentity}`,
    ),
  );
  const definitionUxUi = new Set(definitionUxUiKeys);
  const definitionIaUi = new Set(definitionIaUiKeys);
  if (
    registryUxUiKeys.length !== registryUxUi.size ||
    registryIaUiKeys.length !== registryIaUi.size ||
    analysisUxUiKeys.length !== analysisUxUi.size ||
    analysisIaUiKeys.length !== analysisIaUi.size ||
    definitionUxUiKeys.length !== definitionUxUi.size ||
    definitionIaUiKeys.length !== definitionIaUi.size ||
    [...registryUxUi].some(
      (key) => !analysisUxUi.has(key) || !definitionUxUi.has(key),
    ) ||
    [...analysisUxUi].some(
      (key) => !registryUxUi.has(key) || !definitionUxUi.has(key),
    ) ||
    [...definitionUxUi].some(
      (key) => !registryUxUi.has(key) || !analysisUxUi.has(key),
    ) ||
    [...registryIaUi].some(
      (key) => !analysisIaUi.has(key) || !definitionIaUi.has(key),
    ) ||
    [...analysisIaUi].some(
      (key) => !registryIaUi.has(key) || !definitionIaUi.has(key),
    ) ||
    [...definitionIaUi].some(
      (key) => !registryIaUi.has(key) || !analysisIaUi.has(key),
    )
  )
    issues.push({
      kind: "artifact.ui.analysis-definition-closure-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "analysis-definition-closure-mismatch",
      details: {},
    });
  return issues;
}

/**
 * SPEC分析の二観点網羅性と関係重複を検査する。
 * @responsibility SPEC分析の二観点網羅性と関係重複を検査する。
 * @trace ARCH-000008
 * @input request: 位置、UX／IA実在ID・分析済みID・関係出現列。
 * @returns UX網羅性、重複、IA網羅性の順のIssue。
 * @precondition 呼出し元が現在位置で必要な本文・集合を取得している。
 * @postcondition 旧条件・重複処置・Issue順を維持し入力を変更しない。
 * @effect N/A: 観測済み値と局所配列だけを扱う同期処理。
 * @failure 集合・文字列操作の例外を伝播し不足を補完しない。
 * @invariant 観測の先読みと新しい非空条件を追加しない。
 * @boundary N/A: 同一Process内のSPEC関係検査。
 * @security 実在・認可・品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function inspectSpecAnalysisCoverage(
  request: Readonly<{
    specIndexPath: string;
    specAnalysisRoot: string;
    uxIds: ReadonlySet<string>;
    iaIds: ReadonlySet<string>;
    analyzedUx: ReadonlySet<string>;
    analyzedIa: ReadonlySet<string>;
    analysisRelationOccurrences: readonly string[];
  }>,
): readonly DocumentIssue[] {
  const {
    specIndexPath,
    specAnalysisRoot,
    uxIds,
    iaIds,
    analyzedUx,
    analyzedIa,
    analysisRelationOccurrences,
  } = request;
  const issues: DocumentIssue[] = [];
  if (
    uxIds.size !== analyzedUx.size ||
    [...uxIds].some((id) => !analyzedUx.has(id)) ||
    [...analyzedUx].some((id) => !uxIds.has(id))
  )
    issues.push({
      kind: "artifact.spec.ux-analysis-coverage-mismatch",
      targetIdentity: specIndexPath,
      location: { path: specIndexPath },
      reason: "spec-ux-analysis-coverage-mismatch",
      details: {},
    });

  if (relationValuesHaveDuplicate(analysisRelationOccurrences))
    issues.push({
      kind: "artifact.spec.analysis-relation-duplicate",
      targetIdentity: specAnalysisRoot,
      location: { path: specAnalysisRoot },
      reason: "spec-analysis-relation-duplicate",
      details: {},
    });
  if (
    iaIds.size !== analyzedIa.size ||
    [...iaIds].some((id) => !analyzedIa.has(id)) ||
    [...analyzedIa].some((id) => !iaIds.has(id))
  )
    issues.push({
      kind: "artifact.spec.ia-analysis-coverage-mismatch",
      targetIdentity: specIndexPath,
      location: { path: specIndexPath },
      reason: "spec-ia-analysis-coverage-mismatch",
      details: {},
    });

  return issues;
}

/**
 * SPEC定義の関係重複と登録ID網羅性を検査する。
 * @responsibility SPEC定義の関係重複と登録ID網羅性を検査する。
 * @trace ARCH-000008
 * @input request: 位置、定義関係出現列・登録ID・実在ID。
 * @returns 重複、登録網羅性の順のIssue。
 * @precondition 呼出し元が現在位置で必要な本文・集合を取得している。
 * @postcondition 旧条件・重複処置・Issue順を維持し入力を変更しない。
 * @effect N/A: 観測済み値と局所配列だけを扱う同期処理。
 * @failure 集合・文字列操作の例外を伝播し不足を補完しない。
 * @invariant 観測の先読みと新しい非空条件を追加しない。
 * @boundary N/A: 同一Process内のSPEC関係検査。
 * @security 実在・認可・品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function inspectSpecDefinitionCoverage(
  request: Readonly<{
    specDefinitionsRoot: string;
    specIndexPath: string;
    definitionRelationOccurrences: readonly string[];
    definitionUiPairOccurrences: readonly string[];
    registryIds: ReadonlySet<string>;
    actualIds: ReadonlySet<string>;
  }>,
): readonly DocumentIssue[] {
  const {
    specDefinitionsRoot,
    specIndexPath,
    definitionRelationOccurrences,
    definitionUiPairOccurrences,
    registryIds,
    actualIds,
  } = request;
  const issues: DocumentIssue[] = [];
  if (
    relationValuesHaveDuplicate(definitionRelationOccurrences) ||
    relationValuesHaveDuplicate(definitionUiPairOccurrences)
  )
    issues.push({
      kind: "artifact.spec.definition-relation-duplicate",
      targetIdentity: specDefinitionsRoot,
      location: { path: specDefinitionsRoot },
      reason: "spec-definition-relation-duplicate",
      details: {},
    });

  if (
    registryIds.size !== actualIds.size ||
    [...registryIds].some((id) => !actualIds.has(id)) ||
    [...actualIds].some((id) => !registryIds.has(id))
  )
    issues.push({
      kind: "artifact.spec.definition-index-coverage-mismatch",
      targetIdentity: specIndexPath,
      location: { path: specIndexPath },
      reason: "spec-definition-index-coverage-mismatch",
      details: {},
    });
  return issues;
}

/**
 * SPEC件数表と三者の入力関係閉包を検査する。
 * @responsibility SPEC件数表と三者の入力関係閉包を検査する。
 * @trace ARCH-000008
 * @input request: 位置、件数行・観測件数と登録／分析／定義関係集合。
 * @returns 件数、三者閉包の順のIssue。
 * @precondition 呼出し元が現在位置で必要な本文・集合を取得している。
 * @postcondition 旧条件・重複処置・Issue順を維持し入力を変更しない。
 * @effect N/A: 観測済み値と局所配列だけを扱う同期処理。
 * @failure 集合・文字列操作の例外を伝播し不足を補完しない。
 * @invariant 観測の先読みと新しい非空条件を追加しない。
 * @boundary N/A: 同一Process内のSPEC関係検査。
 * @security 実在・認可・品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function inspectSpecCoverage(
  request: Readonly<{
    specIndexPath: string;
    indexCountRows: readonly (readonly string[])[];
    expectedIndexCounts: ReadonlyMap<string, number>;
    registryRelations: ReadonlySet<string>;
    analysisRelations: ReadonlySet<string>;
    definitionRelations: ReadonlySet<string>;
  }>,
): readonly DocumentIssue[] {
  const {
    specIndexPath,
    indexCountRows,
    expectedIndexCounts,
    registryRelations,
    analysisRelations,
    definitionRelations,
  } = request;
  const issues: DocumentIssue[] = [];
  const reportedIndexCounts = new Map(
    indexCountRows.map(([name, count]) => [
      name,
      Number.parseInt(count as string, 10),
    ]),
  );
  if (
    [...expectedIndexCounts].some(
      ([name, count]) => reportedIndexCounts.get(name) !== count,
    )
  )
    issues.push({
      kind: "artifact.spec.root-coverage-count-mismatch",
      targetIdentity: specIndexPath,
      location: { path: specIndexPath },
      reason: "spec-root-coverage-count-mismatch",
      details: {},
    });
  if (
    [...registryRelations].some(
      (r) => !analysisRelations.has(r) || !definitionRelations.has(r),
    ) ||
    [...analysisRelations].some(
      (r) => !registryRelations.has(r) || !definitionRelations.has(r),
    ) ||
    [...definitionRelations].some(
      (r) => !registryRelations.has(r) || !analysisRelations.has(r),
    )
  )
    issues.push({
      kind: "artifact.spec.analysis-definition-closure-mismatch",
      targetIdentity: specIndexPath,
      location: { path: specIndexPath },
      reason: "spec-analysis-definition-closure-mismatch",
      details: {},
    });

  return issues;
}

/** 関係の出現列に同じ値が複数あるかを判定する。 */
function relationValuesHaveDuplicate(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * Architecture登録表と実定義の完全被覆を検査する。
 * @responsibility Architecture登録表と実定義の完全被覆を検査する。
 * @trace ARCH-000008
 * @input sourcePath: 診断位置。registry: 解析済み登録表。actualDefinitions: 実定義集合。
 * @returns 登録表の重複・被覆不整合の中立Issue。
 * @precondition 呼出し元が従来位置で対象値と診断位置を取得している。
 * @postcondition 入力を変更せず既存条件の結果を返す。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播し、不明を正常値で補完しない。
 * @invariant 出現重複と両方向の集合差を検査する。
 * @boundary N/A: Architectureの取得済み本文・集合。
 * @security 実在・認可・工程全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function inspectArchitectureRegistryCoverage(
  sourcePath: string,
  registry: ArchitectureRegistryModel,
  actualDefinitions: ReadonlySet<string>,
): DocumentIssue[] {
  const {
    definitionEntries: registryDefinitionEntries,
    definitions: registryDefinitions,
  } = registry;
  const issues: DocumentIssue[] = [];
  if (
    registryDefinitionEntries.length !== registryDefinitions.size ||
    registryDefinitions.size !== actualDefinitions.size ||
    [...registryDefinitions].some((id) => !actualDefinitions.has(id)) ||
    [...actualDefinitions].some((id) => !registryDefinitions.has(id))
  )
    issues.push({
      kind: "artifact.architecture.definition-index-coverage-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "definition-index-coverage-mismatch",
      details: {},
    });

  return issues;
}

/**
 * Component責務表とArchitecture定義の完全被覆を検査する。
 * @responsibility Component責務表とArchitecture定義の完全被覆を検査する。
 * @trace ARCH-000008
 * @input model: Component文書の完成モデル。actualDefinitions: 実在定義集合。
 * @returns 捕捉済み参照の出現重複と被覆の不一致を返し、本文を再解析しない。
 * @precondition 呼出し元が従来位置で対象値と診断位置を取得している。
 * @postcondition 入力を変更せず既存条件の結果を返す。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播し、不明を正常値で補完しない。
 * @invariant 専用Section内の全Definition Link出現を重複も含めて照合する。
 * @boundary N/A: Architectureの取得済み本文・集合。
 * @security 実在・認可・工程全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function inspectArchitectureComponentCoverage(
  model: ArchitectureCrossModel,
  actualDefinitions: ReadonlySet<string>,
): DocumentIssue[] {
  const sourcePath = model.source.path;
  const issues: DocumentIssue[] = [];
  const componentDefinitionEntries = model.componentDefinitionEntries;
  const componentDefinitions = new Set(componentDefinitionEntries);
  if (
    componentDefinitionEntries.length !== componentDefinitions.size ||
    componentDefinitions.size !== actualDefinitions.size ||
    [...componentDefinitions].some((id) => !actualDefinitions.has(id)) ||
    [...actualDefinitions].some((id) => !componentDefinitions.has(id))
  )
    issues.push({
      kind: "artifact.architecture.component-definition-coverage-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "component-definition-coverage-mismatch",
      details: {},
    });

  return issues;
}

/**
 * 分析・定義・登録表の重複と関係閉包を検査する。
 * @responsibility 分析・定義・登録表の重複と関係閉包を検査する。
 * @trace ARCH-000008
 * @input request: 三者の関係集合、出現列と診断位置。
 * @returns 重複、分析定義閉包、登録閉包の順の中立Issue。
 * @precondition 呼出し元が従来位置で対象値と診断位置を取得している。
 * @postcondition 入力を変更せず既存条件の結果を返す。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播し、不明を正常値で補完しない。
 * @invariant 重複を集合化で消さず、両方向の関係差を保持する。
 * @boundary N/A: Architectureの取得済み本文・集合。
 * @security 実在・認可・工程全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function inspectArchitectureRelations(
  request: ArchitectureRelationsRequest,
): DocumentIssue[] {
  const {
    sourcePath,
    analysisRelations,
    definitionRelations,
    definitionRelationEntries,
    registryRelations,
    registryRelationEntries,
  } = request;
  const issues: DocumentIssue[] = [];
  if (
    registryRelationEntries.length !== registryRelations.size ||
    definitionRelationEntries.length !== definitionRelations.size
  )
    issues.push({
      kind: "artifact.architecture.relation-duplicate",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "relation-duplicate",
      details: {},
    });
  if (
    analysisRelations.size !== definitionRelations.size ||
    [...analysisRelations].some(
      (relation) => !definitionRelations.has(relation),
    ) ||
    [...definitionRelations].some(
      (relation) => !analysisRelations.has(relation),
    )
  )
    issues.push({
      kind: "artifact.architecture.analysis-definition-closure-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "analysis-definition-closure-mismatch",
      details: {},
    });
  if (
    registryRelations.size !== analysisRelations.size ||
    [...registryRelations].some(
      (relation) => !analysisRelations.has(relation),
    ) ||
    [...analysisRelations].some((relation) => !registryRelations.has(relation))
  )
    issues.push({
      kind: "artifact.architecture.registry-relation-closure-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "registry-relation-closure-mismatch",
      details: {},
    });
  return issues;
}

/**
 * 詳細設計の領域・関係・Covered所有者の閉包を検査する。
 * @responsibility 三つの既存集合不整合を順番に返す。
 * @trace ARCH-000008
 * @input request: 観測済みのMap・領域・本文関係集合、Ready状態と診断位置。
 * @returns 領域網羅性、関係閉包、Covered所有者の順の中立Issue。
 * @precondition 呼出し元が領域列挙後の関係集合・Ready状態・診断位置を確定している。
 * @postcondition 入力を変更せず、三種類の集合不整合だけを返す。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播し、欠落を正常へ補完しない。
 * @invariant ReadyだけでCovered所有者を要求し、他二条件は全状態で検査する。
 * @boundary N/A: 取得済みArchitecture文書の意味検査。
 * @security 実在・認可・工程全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function inspectArchitectureDetailCoverage(
  request: ArchitectureDetailCoverageRequest,
): DocumentIssue[] {
  const {
    sourcePath,
    registeredDetailAreas,
    actualDetailAreas,
    detailMapRelations,
    detailDocumentRelations,
    detailMapClosureRelations,
    actualDefinitions,
    detailCoveredDefinitions,
    isArchitectureReady,
  } = request;
  const issues: DocumentIssue[] = [];
  if (
    registeredDetailAreas.size !== actualDetailAreas.size ||
    [...registeredDetailAreas].some((area) => !actualDetailAreas.has(area)) ||
    [...actualDetailAreas].some((area) => !registeredDetailAreas.has(area))
  )
    issues.push({
      kind: "artifact.architecture.detail-area-coverage-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "detail-area-coverage-mismatch",
      details: {},
    });
  if (
    detailMapRelations.size !== detailDocumentRelations.size ||
    [...detailMapRelations].some(
      (relation) => !detailDocumentRelations.has(relation),
    ) ||
    [...detailDocumentRelations].some(
      (relation) => !detailMapRelations.has(relation),
    ) ||
    detailMapRelations.size !== detailMapClosureRelations.size ||
    [...detailMapRelations].some(
      (relation) => !detailMapClosureRelations.has(relation),
    ) ||
    [...detailMapClosureRelations].some(
      (relation) => !detailMapRelations.has(relation),
    ) ||
    [...actualDefinitions].some(
      (id) =>
        ![...detailMapRelations].some((relation) =>
          relation.endsWith(`|${id}`),
        ),
    )
  )
    issues.push({
      kind: "artifact.architecture.detail-relation-closure-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "detail-relation-closure-mismatch",
      details: {},
    });
  if (
    isArchitectureReady &&
    [...actualDefinitions].some((id) => !detailCoveredDefinitions.has(id))
  )
    issues.push({
      kind: "artifact.architecture.detail-covered-owner-missing",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "detail-covered-owner-missing",
      details: {},
    });

  return issues;
}

/**
 * 指定された各成果物にCanonical状態を要求する。
 *
 * @responsibility 欠落・非Canonicalを一成果物一Issueで返し、入力順を維持する。
 * @trace ARCH-000008
 * @input artifacts: 呼出し元が検査対象として選んだ解析済み成果物集合。
 * @returns 不一致のDocumentIssue列。元statusとnormalizedStatusを分離して返す。
 * @precondition 対象集合の選択とreadinessの適用判断は呼出し元が所有する。
 * @postcondition 正規化後がCanonical以外の成果物だけを入力順に返す。
 * @effect N/A: 入力の読取りと局所的な配列構築だけを行う。
 * @failure 欠落または非CanonicalをIssueで返し、例外や正常値へ丸めない。
 * @invariant 入力Artifact・集合・共有状態を変更しない。
 * @boundary N/A: 解析済みモデル間の純粋計算である。
 * @security 空のIssue列は与えられた集合の状態条件だけを表し、品質全体の完成を表さない。
 * @concurrency N/A: 共有可変状態を持たない同期処理である。
 */
function inspectQualityDesignStates(
  artifacts: readonly ArtifactModel[],
): readonly DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  for (const artifact of artifacts) {
    const normalizedStatus = normalizeQualityDesignState(artifact.status ?? "");
    if (normalizedStatus !== "Canonical")
      issues.push({
        kind: "artifact.quality-design.state-invalid",
        targetIdentity: artifact.canonicalId ?? artifact.sourceLocation.path,
        location: artifact.sourceLocation,
        reason: "canonical_state_required",
        details: { status: artifact.status, normalizedStatus },
      });
  }
  return issues;
}

/**
 * Quality分析と定義の情報源・条件・段階・Detail関係の双方向閉包を照合する。
 * @responsibility Quality分析と定義の情報源・条件・段階・Detail関係の双方向閉包を照合する。
 * @trace ARCH-000008
 * @input request: 分析・定義の関係集合、出現列、条件・段階・Obligation KeyのMap、診断位置。
 * @returns 重複、情報源・目標・条件・段階・Detail関係の閉包不一致Issue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 関係条件不一致をIssueで返し、入力を変更しない。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function inspectQualityDefinitionRelations(
  request: Readonly<{
    definitionSourceRelationEntries: readonly string[];
    definitionSourceRelations: ReadonlySet<string>;
    definitionGoalLocalRelationEntries: readonly string[];
    definitionGoalLocalRelations: ReadonlySet<string>;
    definitionDetailGoalRelationEntries: readonly string[];
    definitionDetailGoalRelations: ReadonlySet<string>;
    analysisDetailGoalRelations: ReadonlySet<string>;
    analysisSourceRelations: ReadonlySet<string>;
    definitionObligationKeyEntries: readonly string[];
    analysisObligationKeys: ReadonlyMap<string, string>;
    definitionObligationKeys: ReadonlyMap<string, string>;
    analysisSourceGoalLevels: ReadonlyMap<string, ReadonlySet<string>>;
    localItemLevels: ReadonlyMap<string, string>;
    summarySourceLevels: ReadonlyMap<string, ReadonlySet<string>>;
    definitionSourceGoalLevels: ReadonlyMap<string, ReadonlySet<string>>;
    analysisSourceConditions: ReadonlyMap<string, string>;
    definitionSourceConditions: ReadonlyMap<string, string>;
    definitionsRoot: string;
    analysisPath: string;
  }>,
) {
  const {
    definitionSourceRelationEntries,
    definitionSourceRelations,
    definitionGoalLocalRelationEntries,
    definitionGoalLocalRelations,
    definitionDetailGoalRelationEntries,
    definitionDetailGoalRelations,
    analysisDetailGoalRelations,
    analysisSourceRelations,
    definitionObligationKeyEntries,
    analysisObligationKeys,
    definitionObligationKeys,
    analysisSourceGoalLevels,
    localItemLevels,
    summarySourceLevels,
    definitionSourceGoalLevels,
    analysisSourceConditions,
    definitionSourceConditions,
    definitionsRoot,
    analysisPath,
  } = request;
  const issues: DocumentIssue[] = [];
  if (definitionSourceRelationEntries.length !== definitionSourceRelations.size)
    issues.push({
      kind: "artifact.quality-relations.definition-source-relation-duplicate",
      targetIdentity: definitionsRoot,
      location: { path: definitionsRoot },
      reason: "definition-source-relation-duplicate",
      details: {},
    });
  if (
    definitionGoalLocalRelationEntries.length !==
    definitionGoalLocalRelations.size
  )
    issues.push({
      kind: "artifact.quality-relations.definition-goal-local-relation-duplicate",
      targetIdentity: definitionsRoot,
      location: { path: definitionsRoot },
      reason: "definition-goal-local-relation-duplicate",
      details: {},
    });
  if (
    definitionDetailGoalRelationEntries.length !==
    definitionDetailGoalRelations.size
  )
    issues.push({
      kind: "artifact.quality-relations.definition-detail-goal-relation-duplicate",
      targetIdentity: definitionsRoot,
      location: { path: definitionsRoot },
      reason: "definition-detail-goal-relation-duplicate",
      details: {},
    });
  if (
    analysisDetailGoalRelations.size !== definitionDetailGoalRelations.size ||
    [...analysisDetailGoalRelations].some(
      (relation) => !definitionDetailGoalRelations.has(relation),
    ) ||
    [...definitionDetailGoalRelations].some(
      (relation) => !analysisDetailGoalRelations.has(relation),
    )
  )
    issues.push({
      kind: "artifact.quality-relations.detail-goal-relation-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "detail-goal-relation-closure-mismatch",
      details: {},
    });

  if (
    analysisSourceRelations.size !== definitionSourceRelations.size ||
    [...analysisSourceRelations].some(
      (relation) => !definitionSourceRelations.has(relation),
    ) ||
    [...definitionSourceRelations].some(
      (relation) => !analysisSourceRelations.has(relation),
    )
  )
    issues.push({
      kind: "artifact.quality-relations.source-local-relation-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "source-local-relation-closure-mismatch",
      details: {},
    });
  if (
    definitionObligationKeyEntries.length !==
      new Set(definitionObligationKeyEntries).size ||
    analysisObligationKeys.size !== definitionObligationKeys.size ||
    [...analysisObligationKeys].some(
      ([relation, obligationKey]) =>
        definitionObligationKeys.get(relation) !== obligationKey,
    ) ||
    [...definitionObligationKeys].some(
      ([relation, obligationKey]) =>
        analysisObligationKeys.get(relation) !== obligationKey,
    )
  )
    issues.push({
      kind: "artifact.quality-relations.obligation-key-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "obligation-key-closure-mismatch",
      details: {},
    });
  for (const [
    sourceGoalRelation,
    requestedLevels,
  ] of analysisSourceGoalLevels) {
    const relatedLocalIds = Array.from(analysisSourceRelations)
      .filter((relation) => relation.startsWith(`${sourceGoalRelation}|`))
      .map((relation) => relation.slice(sourceGoalRelation.length + 1));
    const relatedLevels = new Set(
      relatedLocalIds.flatMap((localId) => {
        const level = localItemLevels.get(localId);
        return level ? [level] : [];
      }),
    );
    for (const requestedLevel of requestedLevels)
      if (!relatedLevels.has(requestedLevel))
        issues.push({
          kind: "artifact.quality-relations.source-test-level-coverage-mismatch",
          targetIdentity: analysisPath,
          location: { path: analysisPath },
          reason: "source-test-level-coverage-mismatch",
          details: {},
        });
  }
  for (const [sourceId, requestedLevels] of summarySourceLevels) {
    const decomposedLevels = new Set<string>();
    for (const [sourceGoalRelation, levels] of analysisSourceGoalLevels)
      if (sourceGoalRelation.startsWith(`${sourceId}|`))
        for (const level of levels) decomposedLevels.add(level);
    if (
      requestedLevels.size !== decomposedLevels.size ||
      [...requestedLevels].some((level) => !decomposedLevels.has(level))
    )
      issues.push({
        kind: "artifact.quality-relations.source-test-level-decomposition-mismatch",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "source-test-level-decomposition-mismatch",
        details: { value0: String(sourceId) },
      });
  }
  if (
    analysisSourceGoalLevels.size !== definitionSourceGoalLevels.size ||
    [...analysisSourceGoalLevels].some(([relation, levels]) => {
      const definitionLevels = definitionSourceGoalLevels.get(relation);
      return (
        !definitionLevels ||
        levels.size !== definitionLevels.size ||
        [...levels].some((level) => !definitionLevels.has(level))
      );
    })
  )
    issues.push({
      kind: "artifact.quality-relations.definition-source-test-level-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "definition-source-test-level-closure-mismatch",
      details: {
        value0: String(
          JSON.stringify(
            [...analysisSourceGoalLevels].map(([relation, levels]) => [
              relation,
              [...levels],
            ]),
          ),
        ),
        value1: String(
          JSON.stringify(
            [...definitionSourceGoalLevels].map(([relation, levels]) => [
              relation,
              [...levels],
            ]),
          ),
        ),
      },
    });
  if (
    analysisSourceConditions.size !== definitionSourceConditions.size ||
    [...analysisSourceConditions].some(
      ([relation, condition]) =>
        definitionSourceConditions.get(relation) !== condition,
    ) ||
    [...definitionSourceConditions].some(
      ([relation, condition]) =>
        analysisSourceConditions.get(relation) !== condition,
    )
  )
    issues.push({
      kind: "artifact.quality-relations.source-condition-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "source-condition-closure-mismatch",
      details: {},
    });

  return issues;
}

/**
 * Quality統合と定義の目標別Local Item関係を照合する。
 * @responsibility Quality統合と定義の目標別Local Item関係を照合する。
 * @trace ARCH-000008
 * @input request: 統合・定義の目標とLocal Itemの関係集合、出現列、診断位置。
 * @returns 目標とLocal Itemの重複・閉包不一致Issue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不一致をIssueで返す。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function inspectQualityGoalLocalRelations(
  request: Readonly<{
    listedGoalLocalRelationEntries: readonly string[];
    listedGoalLocalRelations: ReadonlySet<string>;
    definitionGoalLocalRelations: ReadonlySet<string>;
    analysisPath: string;
  }>,
) {
  const {
    listedGoalLocalRelationEntries,
    listedGoalLocalRelations,
    definitionGoalLocalRelations,
    analysisPath,
  } = request;
  const issues: DocumentIssue[] = [];
  if (listedGoalLocalRelationEntries.length !== listedGoalLocalRelations.size)
    issues.push({
      kind: "artifact.quality-relations.goal-local-relation-duplicate",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "goal-local-relation-duplicate",
      details: {},
    });
  if (
    listedGoalLocalRelations.size !== definitionGoalLocalRelations.size ||
    [...listedGoalLocalRelations].some(
      (relation) => !definitionGoalLocalRelations.has(relation),
    ) ||
    [...definitionGoalLocalRelations].some(
      (relation) => !listedGoalLocalRelations.has(relation),
    )
  )
    issues.push({
      kind: "artifact.quality-relations.goal-local-relation-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "goal-local-relation-closure-mismatch",
      details: {},
    });

  return issues;
}

/**
 * 品質設計の状態文字列から版表記とReleased Baseline句を除く。
 *
 * @responsibility 先頭の版、末尾の全角括弧句、trimの既存適用順を維持する。
 * @trace ARCH-000008
 * @input state: 判定する状態文字列。
 * @returns Canonical判定用の状態文字列。
 * @precondition stateは文字列である。
 * @postcondition 正規化後の文字列だけを返す。
 * @effect N/A: 文字列の局所計算だけを行う。
 * @failure N/A: 独自の失敗分岐を持たない。
 * @invariant 入力や共有状態を変更しない。
 * @boundary N/A: 同一Process内の純粋計算である。
 * @security 正規化は品質の成立や認可を意味しない。
 * @concurrency N/A: 共有可変状態を持たない同期処理である。
 */
function normalizeQualityDesignState(state: string): string {
  return state
    .replace(/^v\d+\.\d+\.\d+\s+/u, "")
    .replace(/（Released Baseline:[^）]+）$/u, "")
    .trim();
}

/**
 * Architecture分析・定義・登録表の閉包検査入力を表す。
 * @responsibility Architecture分析・定義・登録表の閉包検査入力を表す。
 * @trace ARCH-000008
 * @shape sourcePath、analysisRelations、definitionRelations、definitionRelationEntries、registryRelations、registryRelationEntries。
 * @invariant 集合と出現配列を区別し、重複を失わない。
 * @boundary N/A: 取得済み値モデル。
 * @security 認可・実在・完成を保証しない。
 * @compatibility 現行の関係照合条件を維持する。
 */
type ArchitectureRelationsRequest = Readonly<{
  sourcePath: string;
  analysisRelations: ReadonlySet<string>;
  definitionRelations: ReadonlySet<string>;
  definitionRelationEntries: readonly string[];
  registryRelations: ReadonlySet<string>;
  registryRelationEntries: readonly string[];
}>;
/**
 * 詳細Map・実領域・本文から観測した閉包入力を表す。
 * @responsibility 詳細Map・実領域・本文から観測した閉包入力を表す。
 * @trace ARCH-000008
 * @shape sourcePath、registeredDetailAreas、actualDetailAreas、detailMapRelations、detailDocumentRelations、detailMapClosureRelations、actualDefinitions、detailCoveredDefinitions、isArchitectureReady。
 * @invariant 重複に対する既存の集合化と部分関係を保持する。
 * @boundary N/A: 取得済み値の結果モデル。
 * @security Fileの実在・認可・品質成立を保証しない。
 * @compatibility 現行の本文受理条件を維持する。
 */
type ArchitectureDetailCoverageRequest = Readonly<{
  sourcePath: string;
  registeredDetailAreas: ReadonlySet<string>;
  actualDetailAreas: ReadonlySet<string>;
  detailMapRelations: ReadonlySet<string>;
  detailDocumentRelations: ReadonlySet<string>;
  detailMapClosureRelations: ReadonlySet<string>;
  actualDefinitions: ReadonlySet<string>;
  detailCoveredDefinitions: ReadonlySet<string>;
  isArchitectureReady: boolean;
}>;

/**
 * 工程別Quality分析の情報源・目標・条件・Local Item関係を解析・照合する。
 * @responsibility 工程別Quality分析の情報源・目標・条件・Local Item関係を解析・照合する。
 * @trace ARCH-000008
 * @input phaseAnalyses: 解析済み工程文書。canonicalIds: 実在定義集合。integration: 解析済み統合文書。analysisRoot: 診断位置。
 * @returns 各モデルの関係を出現順・後勝ち規則で合成し、外部被覆・重複・閉包と旧診断順を返す。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不正な行と集合条件をIssueで返し、取得できた部分関係を保持する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectQualityAnalysis(
  phaseAnalyses: readonly QualityAnalysis[],
  canonicalIds: ReadonlySet<string>,
  integration: QualityIntegration,
  analysisRoot: string,
) {
  const analysisPath = integration.source.path;
  const data = phaseAnalyses.map((model) => model.relationData);
  const issues: DocumentIssue[] = [];
  const mappingRows = data.flatMap((d) => d.mappingRows);
  const mappedIds = new Set(data.flatMap((d) => [...d.mappedIds]));
  const summarySourceGoalRelationEntries = data.flatMap(
    (d) => d.summarySourceGoalRelationEntries,
  );
  const summarySourceGoalRelations = new Set(summarySourceGoalRelationEntries);
  const summarySourceLevels = new Map<string, Set<string>>();
  const goalLabelToSlug = new Map<string, string>();
  for (const d of data) {
    for (const [source, levels] of d.summarySourceLevels) {
      const merged = summarySourceLevels.get(source) ?? new Set<string>();
      for (const level of levels) merged.add(level);
      summarySourceLevels.set(source, merged);
    }
    for (const [label, slug] of d.goalLabelToSlug)
      goalLabelToSlug.set(label, slug);
  }
  const analysisSourceRelationEntries = data.flatMap(
    (d) => d.analysisSourceRelationEntries,
  );
  const analysisSourceRelations = new Set(analysisSourceRelationEntries);
  const analysisSourceGoalRelationEntries = data.flatMap(
    (d) => d.analysisSourceGoalRelationEntries,
  );
  const analysisSourceGoalRelations = new Set(
    analysisSourceGoalRelationEntries,
  );
  const analysisObligationKeyEntries = data.flatMap(
    (d) => d.analysisObligationKeyEntries,
  );
  const analysisSourceConditions = new Map(
    data.flatMap((d) => [...d.analysisSourceConditions]),
  );
  const analysisSourceGoalLevels = new Map(
    data.flatMap((d) => [...d.analysisSourceGoalLevels]),
  );
  const analysisObligationKeys = new Map(
    data.flatMap((d) => [...d.analysisObligationKeys]),
  );
  if (
    canonicalIds.size !== mappedIds.size ||
    [...canonicalIds].some((id) => !mappedIds.has(id)) ||
    [...mappedIds].some((id) => !canonicalIds.has(id))
  )
    issues.push({
      kind: "artifact.quality-analysis.canonical-mapping-coverage-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "canonical-mapping-coverage-mismatch",
      details: {},
    });

  if (new Set(mappingRows).size !== mappingRows.length)
    issues.push({
      kind: "artifact.quality-analysis.canonical-mapping-duplicate-row",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "canonical-mapping-duplicate-row",
      details: {},
    });
  if (
    summarySourceGoalRelationEntries.length !== summarySourceGoalRelations.size
  )
    issues.push({
      kind: "artifact.quality-analysis.canonical-source-goal-duplicate",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "canonical-source-goal-duplicate",
      details: {},
    });

  if (data.some((d) => !d.hasSourceRelations))
    issues.push({
      kind: "artifact.quality-analysis.source-local-relation-section-missing",
      targetIdentity: analysisRoot,
      location: { path: analysisRoot },
      reason: "source-local-relation-section-missing",
      details: {},
    });
  for (const d of data)
    for (const _line of d.incompleteRelations)
      issues.push({
        kind: "artifact.quality-analysis.source-local-relation-incomplete",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "source-local-relation-incomplete",
        details: {},
      });
  if (analysisSourceGoalRelations.size === 0)
    issues.push({
      kind: "artifact.quality-analysis.source-local-relation-section-missing-empty-relations",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "source-local-relation-section-missing-empty-relations",
      details: {},
    });
  if (
    analysisSourceGoalRelationEntries.length !==
      analysisSourceGoalRelations.size ||
    analysisSourceRelationEntries.length !== analysisSourceRelations.size ||
    analysisObligationKeyEntries.length !==
      new Set(analysisObligationKeyEntries).size
  )
    issues.push({
      kind: "artifact.quality-analysis.source-relation-duplicate",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "source-relation-duplicate",
      details: {},
    });
  if (
    summarySourceGoalRelations.size !== analysisSourceGoalRelations.size ||
    [...summarySourceGoalRelations].some(
      (relation) => !analysisSourceGoalRelations.has(relation),
    ) ||
    [...analysisSourceGoalRelations].some(
      (relation) => !summarySourceGoalRelations.has(relation),
    )
  )
    issues.push({
      kind: "artifact.quality-analysis.source-goal-relation-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "source-goal-relation-closure-mismatch",
      details: {},
    });

  const { crossModelRows, crossModelReferences } = integration;
  return {
    summarySourceLevels,
    goalLabelToSlug,
    analysisSourceRelations,
    analysisSourceConditions,
    analysisSourceGoalLevels,
    analysisObligationKeys,
    crossModelRows,
    crossModelReferences,
    issues,
  };
}

/**
 * Quality統合のLocal Item集合とDetailの必要段階・境界到達を照合する。
 * @responsibility Quality統合のLocal Item集合とDetailの必要段階・境界到達を照合する。
 * @trace ARCH-000008
 * @input request: 解析済み統合モデルと検証項目のOwner・段階・境界、実在詳細単位。
 * @returns 集合・段階・境界到達の不一致Issue列。解析済みの関係出現を変更しない。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不一致をIssueで返し、取得済みLocal Item関係を保持する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function inspectQualityLocalItemRelations(
  request: Readonly<{
    integration: QualityIntegration;
    localItemOwners: ReadonlyMap<string, string>;
    analysisDetailUnitLocalRelations: ReadonlySet<string>;
    physicalDetailUnits: ReadonlySet<string>;
    physicalDetailUnitLevels: ReadonlyMap<string, ReadonlySet<string>>;
    physicalDetailUnitBoundaryStages: ReadonlyMap<string, string>;
    localItemLevels: ReadonlyMap<string, string>;
    localItemBoundaryStages: ReadonlyMap<string, string>;
    analysisPath: string;
  }>,
) {
  const {
    integration,
    localItemOwners,
    analysisDetailUnitLocalRelations,
    physicalDetailUnits,
    physicalDetailUnitLevels,
    physicalDetailUnitBoundaryStages,
    localItemLevels,
    localItemBoundaryStages,
    analysisPath,
  } = request;
  const issues: DocumentIssue[] = [];
  const { listedLocalIds } = integration.localItemData;
  if (
    listedLocalIds.size !== localItemOwners.size ||
    [...listedLocalIds].some((localId) => !localItemOwners.has(localId)) ||
    [...localItemOwners].some(([localId]) => !listedLocalIds.has(localId))
  )
    issues.push({
      kind: "artifact.quality-relations.local-verification-item-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "local-verification-item-closure-mismatch",
      details: {},
    });
  for (const relation of analysisDetailUnitLocalRelations) {
    const localId = relation.slice(relation.lastIndexOf("|") + 1);
    if (!localItemOwners.has(localId))
      issues.push({
        kind: "artifact.quality-relations.architecture-detail-unit-local-item-unknown",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "architecture-detail-unit-local-item-unknown",
        details: { value0: String(localId) },
      });
  }
  const boundaryStageRank = new Map([
    ["N/A", 0],
    ["Direct Boundary", 1],
    ["Adjacent 1 Block", 2],
    ["Related 2 Blocks", 3],
    ["System/E2E", 4],
    ["User Acceptance", 5],
  ]);
  for (const unitKey of physicalDetailUnits) {
    const relatedLocalIds = Array.from(analysisDetailUnitLocalRelations)
      .filter((relation) => relation.startsWith(`${unitKey}|`))
      .map((relation) => relation.slice(unitKey.length + 1));
    const relatedLevels = new Set(
      relatedLocalIds.flatMap((localId) => {
        const level = localItemLevels.get(localId);
        return level ? [level] : [];
      }),
    );
    const requiredLevels =
      physicalDetailUnitLevels.get(unitKey) ?? new Set<string>();
    if (
      requiredLevels.size === 0 ||
      [...requiredLevels].some((level) => !relatedLevels.has(level))
    )
      issues.push({
        kind: "artifact.quality-relations.architecture-detail-unit-level-coverage-mismatch",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "architecture-detail-unit-level-coverage-mismatch",
        details: { value0: String(unitKey) },
      });
    const requiredBoundaryStage =
      physicalDetailUnitBoundaryStages.get(unitKey) ?? "";
    const requiredBoundaryRank = boundaryStageRank.get(requiredBoundaryStage);
    const actualBoundaryRank = Math.max(
      -1,
      ...relatedLocalIds.map(
        (localId) =>
          boundaryStageRank.get(localItemBoundaryStages.get(localId) ?? "") ??
          -1,
      ),
    );
    if (
      requiredBoundaryRank === undefined ||
      actualBoundaryRank < requiredBoundaryRank
    )
      issues.push({
        kind: "artifact.quality-relations.architecture-detail-unit-boundary-coverage-mismatch",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "architecture-detail-unit-boundary-coverage-mismatch",
        details: { value0: String(unitKey) },
      });
  }

  return issues;
}

/**
 * Local ID所有確認後の局所Mapと重複Issueを表す。
 * @responsibility Local ID所有確認後の局所Mapと重複Issueを表す。
 * @trace ARCH-000008
 * @shape owners、issues。
 * @invariant 入力Ownerは変更せず、先勝ちの所有と出現ごとの重複を維持する。
 * @boundary N/A: 取得済み本文の値モデル。
 * @security 認可・品質成立や実行許可を発行しない。
 * @compatibility 先勝ちの所有と、同じIDの後続出現ごとの重複診断を維持する。
 */
export type QualityLocalItemOwnershipModel = Readonly<{
  owners: ReadonlyMap<string, string>;
  issues: readonly DocumentIssue[];
}>;
/**
 * Local ID出現列の所有重複を検査する。
 * @responsibility Local ID出現列の所有重複を検査する。
 * @trace ARCH-000008
 * @input sourcePath: 現在の定義の診断位置。localIds: 項目の独立抽出出現列。existingOwners: 以前の定義までのOwner Map。
 * @returns 先勝ちのOwner Map複製と出現ごとの重複Issue。
 * @precondition 本文検査後の元位置で呼び、集合化していない出現列を渡す。
 * @postcondition 入力Mapを変更せず、重複時にOwnerを上書きしない。
 * @effect N/A: 同期的な値処理。
 * @failure 解析例外を伝播し、不明を正常値に補完しない。
 * @invariant 同一File内重複も検出し、既存のpreviousOwnerの真偽判定を維持する。
 * @boundary N/A: Process内のQuality文書意味検査。
 * @security 認可・実在・実行許可・品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectQualityLocalItemOwnership(
  sourcePath: string,
  localIds: readonly string[],
  existingOwners: ReadonlyMap<string, string>,
): QualityLocalItemOwnershipModel {
  const owners = new Map(existingOwners),
    issues: DocumentIssue[] = [];
  for (const localId of localIds) {
    const previousOwner = owners.get(localId);
    if (previousOwner)
      issues.push({
        kind: "artifact.quality.local-verification-id-duplicate",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "local-verification-id-duplicate",
        details: { localId, previousOwner },
      });
    else owners.set(localId, sourcePath);
  }
  return { owners, issues };
}

/** 取得済み成果物に含まれる検証表と是正表の完成評価結果。 */
export type QualityVerificationEvaluation = Readonly<{
  numericRowsChecked: number;
  remediationRowsChecked: number;
  branchIssues: readonly DocumentIssue[];
  remediationIssues: readonly DocumentIssue[];
  issues: readonly DocumentIssue[];
}>;

/**
 * 全Markdownに適用する既存の二種類の品質表評価を完了する。
 * @responsibility 解析済み表の算術・是正条件と診断区分を返し、本文を再解析しない。
 * @trace ARCH-000008
 * @input artifact: 同じ読取り位置で捕捉済みの成果物モデル。
 * @returns 件数と元の区分別診断。issuesは分岐表→是正表の順。
 * @effect N/A: 取得済みモデルだけを扱う。
 * @failure 観測不能を空表へ補完しない。呼出し元が取得失敗を所有する。
 */
export function inspectQualityVerification(
  artifact: ArtifactModel,
): QualityVerificationEvaluation {
  const branch = inspectBranchCoverageTable(artifact);
  const remediation = inspectRemediationTable(artifact);
  return {
    numericRowsChecked: branch.numericRowsChecked,
    remediationRowsChecked: remediation.remediationRowsChecked,
    branchIssues: branch.issues,
    remediationIssues: remediation.issues,
    issues: [...branch.issues, ...remediation.issues],
  };
}
