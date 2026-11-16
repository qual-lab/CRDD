/**
 * 工程モデル間と品質Semanticの関係を評価する。
 *
 * @responsibility 解析済みモデルとSemantic IRの関係・重複・閉包を中立Issueへ変換する。
 * @trace ARCH-000008
 */

import path from "node:path";
import type { ArchitectureDetailTrace } from "../architecture/details.ts";
import type {
  ArchitectureDefinition,
  ArchitectureDetailAssignment,
} from "../architecture/validation.ts";
import { architectureCrossModelFiles } from "../architecture/validation.ts";
import { buildArtifactGraph } from "../artifact/graph.ts";
import type {
  ArtifactModel,
  DocumentIssue,
  DocumentResult,
  ParseResult,
} from "../artifact/types.ts";
import type { parseRepositoryProjectContextMarkdown } from "../project-context/parse-context.ts";
import type {
  QualityDetailTrace,
  QualityIntegration,
} from "../quality/analysis.ts";
import type {
  QualityDefinitionModel,
  QualityDetailAssignment,
} from "../quality/definition.ts";
import type {
  SpecDefinition,
  SpecDefinitionCorrespondence,
  SpecDetailCorrespondence,
  SpecDetailIndex,
  SpecIndex,
} from "../spec/types.ts";
import type { UiDefinition, UiDetailIndex, UiScreen } from "../ui/types.ts";
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
      kind: "quality_architecture_models";
      integration: QualityIntegration;
      architectureRoot: string;
      integrationDirectory: string;
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
  }
  throw new TypeError("document_relation_kind_invalid");
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
