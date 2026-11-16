/**
 * Quality分析・統合の内容と文書内の条件を捕捉する。
 * @responsibility 関係の出現・条件・出典とQuality内部の整合を所有し、他工程との関係評価はSemanticへ渡す。
 * @trace ARCH-000008
 */

import {
  captureDocumentSections,
  captureDocumentTableRows,
  omitMarkdownCommentsAndFencedCode,
  parseMarkdownTableRow,
} from "../artifact/markdown.ts";
import { parseMarkdownArtifact } from "../artifact/parse-markdown.ts";
import type {
  ArtifactModel,
  ArtifactSource,
  DocumentIssue,
  DocumentTableRow,
  DocumentText,
  ParseResult,
} from "../artifact/types.ts";
import {
  collectQualityDefinitionRelations,
  type QualityDefinitionModel,
} from "./definition.ts";
import {
  captureQualityDocument,
  type QualityCenter,
  type QualityParsedDocument,
  type QualityRealityAudit,
  qualityChecklistIssues,
} from "./readiness.ts";
import { captureQualityTemplate, type QualityTemplate } from "./templates.ts";
/**
 * 工程別品質分析の本文・全出現と既存の先頭選択を保持する。
 * @responsibility 工程入力の欠測・重複・出典を横断照合へ渡す。
 * @trace ARCH-000008
 */
export type QualityAnalysis = QualityParsedDocument &
  Readonly<{
    templateContract: QualityTemplate | null;
    relationData: Omit<
      ReturnType<typeof captureQualityAnalysisRelations>,
      "issues"
    >;
    artifact: ArtifactModel;
    source: ArtifactSource;
    tableRows: readonly DocumentTableRow[];
    coverage: readonly DocumentText[];
    sourceRelations: readonly DocumentText[];
  }>;
/**
 * 品質統合の横断・詳細処置を本文モデルとして保持する。
 * @responsibility rawの節境界と部分内容を後続の関係評価へ渡す。
 * @trace ARCH-000008
 */
export type QualityIntegration = QualityParsedDocument &
  Readonly<{
    templateContract: QualityTemplate | null;
    crossModelRows: readonly (readonly string[])[];
    localItemData: ReturnType<typeof captureQualityIntegrationItems>;
    detailUnitData: Omit<
      ReturnType<typeof captureQualityDetailUnits>,
      "issues"
    >;
    artifact: ArtifactModel;
    source: ArtifactSource;
    tableRows: readonly DocumentTableRow[];
    crossModel: readonly DocumentText[];
    crossModelReferences: readonly string[];
    details: readonly DocumentText[];
  }>;
/**
 * Quality専用のraw節を元の終端条件で捕捉する。
 * @responsibility 先頭選択前の全出現と行位置を保持する。
 * @trace ARCH-000008
 * @input source: 原文。expression: 本文を第一Groupへ捕捉する固定条件。
 * @returns 本文と出典の出現列。
 * @effect N/A: 局所値のみ。
 * @failure 正規表現例外は伝播する。
 */
function captureQualityAnalysisSections(
  source: ArtifactSource,
  expression: RegExp,
): DocumentText[] {
  return [
    ...source.content.matchAll(new RegExp(`(?=(${expression.source}))`, "gmu")),
  ].map((match) => {
    const text = match[2] ?? "";
    const offset = (match.index ?? 0) + (match[1]?.length ?? 0) - text.length;
    return {
      text,
      location: {
        path: source.path,
        line: source.content.slice(0, offset).split("\n").length,
      },
    };
  });
}
/**
 * 取得済みの工程別Quality分析を構築する。
 * @responsibility Coverageと検証目標の正式な節を補完せず保持する。
 * @trace ARCH-000008
 * @input source: raw本文と相対Path。
 * @returns 原文から独立捕捉した内容モデル。
 * @effect N/A: 取得済み値のみ。
 * @failure 解析例外を伝播する。
 */
export function parseQualityAnalysis(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<QualityAnalysis> & Readonly<{ result: QualityAnalysis }> {
  const captured = { path: source.path, content: source.content };
  const document = captureQualityDocument(captured, {
    kind: "analysis",
    mode: options.mode === undefined ? "evaluated" : options.mode,
  });
  const templateContract =
    options.mode === "template"
      ? captureQualityTemplate(captured, "analysis")
      : null;
  const content = {
    templateContract,
    ...document,
    coverage: captureQualityAnalysisSections(
      captured,
      /^## 2\. 全件Coverage Index\s*$([\s\S]*?)(?=^##\s)/mu,
    ),
    sourceRelations: captureQualityAnalysisSections(
      captured,
      /^## 3\. 検証目標への統合\s*$([\s\S]*?)(?=^##\s)/mu,
    ),
  };
  const { issues: localIssues, ...relationData } =
    captureQualityAnalysisRelations(content);
  const result: QualityAnalysis = { ...content, relationData };
  const issues = [
    ...(options.mode === "template" ? [] : localIssues),
    ...qualityChecklistIssues(document),
  ];
  if (templateContract && !templateContract.valid)
    issues.push({
      kind: "artifact.quality.template-content-invalid",
      targetIdentity: source.path,
      location: { path: source.path },
      reason: "template-content-invalid",
      details: {},
    });
  return { status: issues.length ? "partial" : "complete", result, issues };
}
/**
 * 取得済みのQuality統合を構築する。
 * @responsibility 横断処置と詳細処置の異なるEOF条件を維持する。
 * @trace ARCH-000008
 * @input source: raw本文と相対Path。
 * @returns 原文・出典と名前付き本文。
 * @effect N/A: 取得済み値のみ。
 * @failure 解析例外を伝播する。
 */
export function parseQualityIntegration(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<QualityIntegration> & Readonly<{ result: QualityIntegration }> {
  const captured = { path: source.path, content: source.content };
  const crossModel = captureQualityAnalysisSections(
    captured,
    /^## 2\. Architecture横断モデルの処置\s*$([\s\S]*?)(?=^##\s)/mu,
  );
  const crossModelReferences = Array.from(
    (crossModel[0]?.text ?? "").matchAll(
      /\]\((\.\.\/06_Architecture\/[A-Za-z0-9_]+\.md)\)/gu,
    ),
    (match) => match[1] as string,
  );
  const document = captureQualityDocument(captured, {
    kind: "integration",
    mode: options.mode === undefined ? "evaluated" : options.mode,
  });
  const templateContract =
    options.mode === "template"
      ? captureQualityTemplate(captured, "integration")
      : null;
  const content = {
    templateContract,
    ...document,
    crossModel,
    crossModelReferences,
    details: captureQualityAnalysisSections(
      captured,
      /^## 3\. Architecture詳細設計領域の処置\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
    ),
  };
  const crossModelSection = content.crossModel[0]?.text;
  const crossModelRows: readonly (readonly string[])[] = (
    crossModelSection ?? ""
  )
    .split(/\r?\n/u)
    .filter((line) => /^\|\s*[^|]+\|/u.test(line))
    .filter((line) => !/^\|\s*(?:検証目標|---)/u.test(line))
    .map((line) =>
      line
        .slice(1, line.lastIndexOf("|"))
        .split("|")
        .map((cell) => cell.trim()),
    );

  const { issues: localIssues, ...detailUnitData } = captureQualityDetailUnits(
    content.details[0]?.text,
    content.source.path,
  );
  const result: QualityIntegration = {
    ...content,
    crossModelRows,
    detailUnitData,
    localItemData: captureQualityIntegrationItems(content.source.content),
  };
  const issues = [
    ...(options.mode === "template" ? [] : localIssues),
    ...qualityChecklistIssues(document),
  ];
  if (templateContract && !templateContract.valid)
    issues.push({
      kind: "artifact.quality.template-content-invalid",
      targetIdentity: source.path,
      location: { path: source.path },
      reason: "template-content-invalid",
      details: {},
    });
  return { status: issues.length ? "partial" : "complete", result, issues };
}

/**
 * Quality中央対応表の担当・発行済みIDを保持する。
 * @responsibility 可視本文全体のID、採用行数、行・Owner重複と後勝ちを保持する。
 * @trace ARCH-000008
 * @shape artifact、source、tableRows、relations、relationRows、ID集合、重複。
 * @invariant 原文・出典・出現を保持し、担当宣言を実在・認可・品質成立にしない。
 */
export type QualityDetailTrace = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  screens: ReadonlySet<string>;
  parts: ReadonlySet<string>;
  behaviors: ReadonlySet<string>;
  relationRows: number;
  hasDuplicateRelations: boolean;
  relations: ReadonlyMap<
    string,
    Readonly<{ bhv: string; owners: ReadonlySet<string>; mode: string }>
  >;
}>;
/**
 * Quality中央対応表を出典付きモデルへ構築する。
 * @responsibility 可視本文の既存文法と部分情報を原文・出典へ結合する。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。期待Identityや種別は列挙元が確定する。
 * @returns 担当内容のモデル。入力を変更せず欠測を補完しない。
 * @effect N/A: 同一Processの純粋な値構築。Reader・診断・保存を追加しない。
 */
function captureQualityDetailTrace(source: ArtifactSource): QualityDetailTrace {
  const captured = { path: source.path, content: source.content };
  const content = omitMarkdownCommentsAndFencedCode(captured.content);
  const artifact = parseMarkdownArtifact(captured);
  const tableRows = captureDocumentTableRows({ path: captured.path, content });
  const screens = new Set(
    [...content.matchAll(/SCR-[0-9]{6}/gu)].map((match) => match[0]),
  );
  const parts = new Set(
    [...content.matchAll(/PRT-[0-9]{6}/gu)].map((match) => match[0]),
  );
  const behaviors = new Set(
    [...content.matchAll(/BHV-[0-9]{6}/gu)].map((match) => match[0]),
  );
  let qualityCentralRelationRows = 0;
  let hasDuplicateCentralRelation = false;
  const qualityCentralRelations = new Map<
    string,
    Readonly<{ bhv: string; owners: Set<string>; mode: string }>
  >();
  for (const line of content.split(/\r?\n/u)) {
    const cells = parseMarkdownTableRow(line);
    const relationKey = cells?.[0]?.match(/PRT-[0-9]{6}\.spec-[0-9]{6}/u)?.[0];
    const bhv = cells?.[1]?.match(/BHV-[0-9]{6}/u)?.[0];
    if (!cells || !relationKey || !bhv || cells.length !== 5) continue;
    qualityCentralRelationRows += 1;
    const ownerRows = [...(cells[2] as string).matchAll(/QA-[0-9]{6}/gu)].map(
      (match) => match[0],
    );
    if (
      qualityCentralRelations.has(relationKey) ||
      ownerRows.length !== new Set(ownerRows).size
    )
      hasDuplicateCentralRelation = true;
    qualityCentralRelations.set(relationKey, {
      bhv,
      owners: new Set(ownerRows),
      mode: cells[3] as string,
    });
  }
  return {
    artifact,
    source: captured,
    tableRows,
    screens,
    parts,
    behaviors,
    relations: qualityCentralRelations,
    relationRows: qualityCentralRelationRows,
    hasDuplicateRelations: hasDuplicateCentralRelation,
  };
}

/** 品質分析一文書の明示行から関係・条件・重複出現と局所不備を捕捉する。@trace ARCH-000008 */
function captureQualityAnalysisRelations(
  model: Pick<QualityAnalysis, "source" | "coverage" | "sourceRelations">,
) {
  const analysisPath = model.source.path;
  const issues: DocumentIssue[] = [];
  const incompleteRelations: string[] = [];
  const mappingSection = model.coverage[0]?.text ?? "";

  const mappingRows = mappingSection
    .split(/\r?\n/u)
    .filter((line) =>
      /^\|\s*\[(?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6}\]\(/u.test(line),
    );
  const mappedIds = new Set(
    mappingRows.flatMap((line) => {
      const match = line.match(
        /^\|\s*\[((?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6})\]\(/u,
      );
      return match ? [match[1] as string] : [];
    }),
  );
  const summarySourceGoalRelations = new Set<string>();
  const summarySourceGoalRelationEntries: string[] = [];
  const summarySourceLevels = new Map<string, Set<string>>();
  const goalLabelToSlug = new Map<string, string>();
  for (const line of mappingRows) {
    const sourceId = line.match(
      /^\|\s*\[((?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6})\]\(/u,
    )?.[1];
    if (!sourceId) continue;
    const mappingCells = line
      .slice(1, line.lastIndexOf("|"))
      .split("|")
      .map((cell) => cell.trim());
    const requestedLevels = new Set(
      Array.from(
        mappingCells[4]?.matchAll(/UT|IT|ST|UAT/gu) ?? [],
        (match) => match[0],
      ),
    );
    for (const goal of line.matchAll(
      /\[([^\]]+)\]\(\.\.\/\.\.\/Definitions\/(QA-[0-9]{6})\/quality_definition\.md\)/gu,
    )) {
      goalLabelToSlug.set(goal[1] as string, goal[2] as string);
      const relation = `${sourceId}|${goal[2]}`;
      summarySourceGoalRelationEntries.push(relation);
      summarySourceGoalRelations.add(relation);
      const sourceLevels =
        summarySourceLevels.get(sourceId) ?? new Set<string>();
      for (const requestedLevel of requestedLevels)
        sourceLevels.add(requestedLevel);
      summarySourceLevels.set(sourceId, sourceLevels);
    }
  }
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

  const sourceRelationSection = model.sourceRelations[0]?.text;
  if (!sourceRelationSection)
    issues.push({
      kind: "artifact.quality-analysis.source-local-relation-section-missing",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "source-local-relation-section-missing",
      details: {},
    });
  const analysisSourceRelations = new Set<string>();
  const analysisSourceGoalRelations = new Set<string>();
  const analysisSourceRelationEntries: string[] = [];
  const analysisSourceGoalRelationEntries: string[] = [];
  const analysisSourceConditions = new Map<string, string>();
  const analysisSourceGoalLevels = new Map<string, Set<string>>();
  const analysisObligationKeys = new Map<string, string>();
  const analysisObligationKeyEntries: string[] = [];
  const normalizeQualityCondition = (value: string): string =>
    value.trim().replace(/\s+/gu, " ");
  for (const line of (sourceRelationSection ?? "").split(/\r?\n/u)) {
    const relation = line.match(
      /^\|\s*\[((?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6})\]\([^)]+\)\s*\|\s*`([a-z0-9.-]+)`\s*\|\s*([^|]+)\|\s*\[[^\]]+\]\(\.\.\/\.\.\/Definitions\/(QA-[0-9]{6})\/quality_definition\.md\)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*$/u,
    );
    if (!relation) continue;
    const [
      ,
      sourceId,
      obligationKey,
      derivationSource,
      goalSlug,
      condition,
      levelCell,
      boundaryStage,
      localCell,
    ] = relation as unknown as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const requestedLevels = new Set(
      Array.from(levelCell.matchAll(/UT|IT|ST|UAT/gu), (match) => match[0]),
    );
    const localIds = Array.from(
      localCell.matchAll(/`([A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3})`/gu),
      (match) => match[1],
    );
    const sourceGoalRelation = `${sourceId}|${goalSlug}`;
    const expectedObligationKey = `${sourceId.toLowerCase()}.${goalSlug.toLowerCase()}`;
    analysisObligationKeyEntries.push(obligationKey);
    analysisObligationKeys.set(sourceGoalRelation, obligationKey);
    analysisSourceGoalRelationEntries.push(sourceGoalRelation);
    analysisSourceGoalRelations.add(sourceGoalRelation);
    analysisSourceConditions.set(
      sourceGoalRelation,
      normalizeQualityCondition(condition),
    );
    analysisSourceGoalLevels.set(sourceGoalRelation, requestedLevels);
    if (
      obligationKey !== expectedObligationKey ||
      derivationSource.trim().length === 0 ||
      condition.trim().length === 0 ||
      requestedLevels.size === 0 ||
      boundaryStage.trim().length === 0 ||
      localIds.length === 0
    ) {
      incompleteRelations.push(line);
      issues.push({
        kind: "artifact.quality-analysis.source-local-relation-incomplete",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "source-local-relation-incomplete",
        details: {},
      });
    }
    for (const localId of localIds) {
      const sourceLocalRelation = `${sourceId}|${goalSlug}|${localId}`;
      analysisSourceRelationEntries.push(sourceLocalRelation);
      analysisSourceRelations.add(sourceLocalRelation);
    }
  }
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

  return {
    summarySourceLevels,
    goalLabelToSlug,
    analysisSourceRelations,
    analysisSourceConditions,
    analysisSourceGoalLevels,
    analysisObligationKeys,
    mappingRows,
    mappedIds,
    summarySourceGoalRelationEntries,
    summarySourceGoalRelations,
    analysisSourceGoalRelationEntries,
    analysisSourceGoalRelations,
    analysisSourceRelationEntries,
    analysisObligationKeyEntries,
    hasSourceRelations: Boolean(sourceRelationSection),
    incompleteRelations,
    issues,
  };
}

/** 統合文書内の詳細検証単位と関係を捕捉し、外部領域集合は比較しない。@trace ARCH-000008 */
function captureQualityDetailUnits(
  detailSection: string | undefined,
  analysisPath: string,
) {
  const issues: DocumentIssue[] = [];

  const analysisDetailGoalRelations = new Set<string>();
  const analysisDetailUnitGoalRelations = new Set<string>();
  const analysisDetailUnitLocalRelations = new Set<string>();
  const analysisDetailUnits = new Set<string>();
  for (const line of (detailSection ?? "").split(/\r?\n/u)) {
    const detailSlug = line.match(
      /^\|\s*\[([a-z0-9-]+)\]\([^)]*\/Details\/\1\/01_Architecture\.md\)\s*\|/u,
    )?.[1];
    if (!detailSlug) continue;
    const cells = line
      .slice(1, line.lastIndexOf("|"))
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length !== 6 || (cells[1] as string).length === 0) {
      issues.push({
        kind: "artifact.quality-analysis.architecture-detail-unit-row-invalid",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "architecture-detail-unit-row-invalid",
        details: {},
      });
      continue;
    }
    const unitKey = `${detailSlug}|${cells[1]}`;
    if (analysisDetailUnits.has(unitKey))
      issues.push({
        kind: "artifact.quality-analysis.architecture-detail-unit-duplicate",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "architecture-detail-unit-duplicate",
        details: { value0: String(unitKey) },
      });
    analysisDetailUnits.add(unitKey);
    if (cells[4] !== "Covered" && cells[4] !== "OPEN")
      issues.push({
        kind: "artifact.quality-analysis.architecture-detail-unit-disposition-invalid",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "architecture-detail-unit-disposition-invalid",
        details: {},
      });
    if ((cells[5] as string).length === 0)
      issues.push({
        kind: "artifact.quality-analysis.architecture-detail-unit-reevaluation-missing",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "architecture-detail-unit-reevaluation-missing",
        details: {},
      });
    for (const goal of line.matchAll(
      /\[[^\]]+\]\(Definitions\/(QA-[0-9]{6})\/quality_definition\.md\)/gu,
    )) {
      const relation = `${detailSlug}|${goal[1]}`;
      analysisDetailGoalRelations.add(relation);
      const unitGoalRelation = `${unitKey}|${goal[1]}`;
      if (analysisDetailUnitGoalRelations.has(unitGoalRelation))
        issues.push({
          kind: "artifact.quality-analysis.architecture-detail-unit-goal-duplicate",
          targetIdentity: analysisPath,
          location: { path: analysisPath },
          reason: "architecture-detail-unit-goal-duplicate",
          details: { value0: String(unitGoalRelation) },
        });
      analysisDetailUnitGoalRelations.add(unitGoalRelation);
    }
    for (const localMatch of (cells[3] as string).matchAll(
      /`([A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3})`/gu,
    ))
      analysisDetailUnitLocalRelations.add(`${unitKey}|${localMatch[1]}`);
    if (!/`[A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3}`/u.test(cells[3] as string))
      issues.push({
        kind: "artifact.quality-analysis.architecture-detail-unit-local-item-missing",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "architecture-detail-unit-local-item-missing",
        details: { value0: String(unitKey) },
      });
  }
  if (analysisDetailGoalRelations.size === 0)
    issues.push({
      kind: "artifact.quality-analysis.architecture-detail-goal-relation-missing",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "architecture-detail-goal-relation-missing",
      details: {},
    });
  return {
    analysisDetailGoalRelations,
    analysisDetailUnitLocalRelations,
    analysisDetailUnits,
    issues,
  };
}

/** 統合文書の検証項目閉包節から出現列と集合を捕捉する。@trace ARCH-000008 */
function captureQualityIntegrationItems(analysis: string) {
  const localItemSection = analysis.match(
    /^## 4\. 検証項目の閉包\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
  )?.[1];
  const listedLocalIds = new Set<string>();
  const listedGoalLocalRelations = new Set<string>();
  const listedGoalLocalRelationEntries: string[] = [];
  for (const line of (localItemSection ?? "").split(/\r?\n/u)) {
    const goalSlug = line.match(
      /^\|\s*\[[^\]]+\]\(Definitions\/([A-Z0-9-]+)\/quality_definition\.md\)\s*\|/u,
    )?.[1];
    if (!goalSlug) continue;
    for (const localMatch of line.matchAll(
      /`([A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3})`/gu,
    )) {
      listedLocalIds.add(localMatch[1] as string);
      const relation = `${goalSlug}|${localMatch[1]}`;
      listedGoalLocalRelationEntries.push(relation);
      listedGoalLocalRelations.add(relation);
    }
  }
  return {
    listedLocalIds,
    listedGoalLocalRelations,
    listedGoalLocalRelationEntries,
  };
}

/** DetailAnalysis文書の原文・節・出典を保持する。@trace ARCH-000008 */
export type QualityDetailAnalysis = QualityParsedDocument &
  Readonly<{
    trace: QualityDetailTrace;
    sections: readonly import("../artifact/types.ts").DocumentSection[];
  }>;
/**
 * DetailAnalysis文書の内容と局所Checklist診断を返す。
 * @responsibility 捕捉した本文の不備だけを評価し、外部集合の比較を行わない。
 * @trace ARCH-000008
 */
export function parseQualityDetailAnalysis(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<QualityDetailAnalysis> &
  Readonly<{ result: QualityDetailAnalysis }> {
  const document = captureQualityDocument(source, {
    kind: "analysis_detail",
    mode: options.mode === undefined ? "evaluated" : options.mode,
  });
  const result = {
    ...document,
    trace: captureQualityDetailTrace(document.source),
    sections: [
      ...new Set(document.artifact.sections.map((section) => section.title)),
    ].flatMap((title) => captureDocumentSections(document.source, title)),
  };
  const issues = qualityChecklistIssues(document);
  return { status: issues.length ? "partial" : "complete", result, issues };
}

/**
 * 工程別Quality分析の情報源・目標・条件・Local Item関係を解析・照合する。
 * @responsibility 工程別Quality分析の情報源・目標・条件・Local Item関係を解析・照合する。
 * @trace ARCH-000008
 * @input phaseAnalyses: 解析済み工程文書。canonicalIds: 同じ取得範囲の観測済み期待集合（全実在の保証ではない）。integration: 解析済み統合文書。analysisRoot: 診断位置。
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
 * @input request: 定義モデル列・完成分析結果・統合モデルと診断位置。関係・条件・段階は内部導出する。
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
  request: Extract<
    QualityConsistencyRequest,
    { kind: "quality_definition_relations" }
  >,
) {
  const { definitionsRoot, analysisPath } = request;
  const {
    definitionSourceRelations,
    definitionSourceRelationEntries,
    definitionSourceConditions,
    definitionSourceGoalLevels,
    definitionObligationKeys,
    definitionObligationKeyEntries,
    definitionDetailGoalRelations,
    definitionDetailGoalRelationEntries,
    definitionGoalLocalRelations,
    definitionGoalLocalRelationEntries,
    localItemLevels,
  } = collectQualityDefinitionRelations(request.definitions);
  const {
    analysisSourceRelations,
    analysisSourceConditions,
    analysisSourceGoalLevels,
    analysisObligationKeys,
    summarySourceLevels,
  } = request.analysis;
  const { analysisDetailGoalRelations } = request.integration.detailUnitData;
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
 * @input request: 定義モデル列・統合モデルと診断位置。目標とLocal Itemの関係は内部導出する。
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
  request: Extract<
    QualityConsistencyRequest,
    { kind: "quality_goal_local_relations" }
  >,
) {
  const { analysisPath } = request;
  const { listedGoalLocalRelationEntries, listedGoalLocalRelations } =
    request.integration.localItemData;
  const { definitionGoalLocalRelations } = collectQualityDefinitionRelations(
    request.definitions,
  );
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
 * Quality文書同士の状態・目標・定義閉包を比較する入力。
 * 集合と出現列を区別し、取得済み範囲を全実在・全品質の保証へ拡大しない。
 */
export type QualityConsistencyRequest =
  | Readonly<{
      kind: "quality_design_states";
      artifacts: readonly ArtifactModel[];
    }>
  | Readonly<{
      kind: "quality_definition_relations";
      definitions: readonly QualityDefinitionModel[];
      analysis: ReturnType<typeof inspectQualityAnalysis>;
      integration: QualityIntegration;
      definitionsRoot: string;
      analysisPath: string;
    }>
  | Readonly<{
      kind: "quality_goal_local_relations";
      definitions: readonly QualityDefinitionModel[];
      integration: QualityIntegration;
      analysisPath: string;
    }>
  | Readonly<{
      kind: "quality_reality_state";
      center: QualityCenter;
      reality: ParseResult<QualityRealityAudit> &
        Readonly<{ result: QualityRealityAudit }>;
    }>
  | Readonly<{
      kind: "quality_goals";
      analysis: ReturnType<typeof inspectQualityAnalysis>;
      analysisPath: string;
    }>;

/**
 * Quality内部の五条件を取得済みモデルと完成分析結果から比較する。
 * @responsibility 状態・内部閉包の診断を返し、他工程の意味判断や実体取得をしない。
 * @input request: 同じ呼出し位置で取得したQualityモデル・完成分析結果と診断位置。
 * @returns 既存の順序・理由の診断列。空結果は全品質Passではない。
 * @effect N/A: 入力の純粋比較だけを行う。
 * @failure 未知kindは拒否し、空成功や別条件へ切り替えない。
 */
export function inspectQualityConsistency(
  request: QualityConsistencyRequest,
): readonly DocumentIssue[] {
  switch (request.kind) {
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

    case "quality_goals": {
      const { analysisPath } = request;
      const { crossModelRows, goalLabelToSlug } = request.analysis;
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

    default:
      throw new TypeError("quality_consistency_kind_invalid");
  }
}
