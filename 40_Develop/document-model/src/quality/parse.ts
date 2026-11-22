/**
 * Quality成果物の共通Artifactと文書別の完成Parseを所有する。
 * @packageDocumentation
 * @trace ARCH-000008
 */
import {
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
} from "../artifact/checklist.ts";
import {
  captureDocumentSections,
  captureDocumentTableRows,
  omitMarkdownCommentsAndFencedCode,
  parseMarkdownTableRow,
} from "../artifact/markdown.ts";
import {
  parseMarkdownArtifact,
  parseArtifact,
} from "../artifact/parse-markdown.ts";
import { parseDiagramDisposition } from "../artifact/phase-diagrams.ts";
import type {
  ArtifactSource,
  DocumentIssue,
  DocumentTableRow,
  DocumentText,
  ParseResult,
} from "../artifact/types.ts";
import type {
  QualityChecklistRequest,
  QualityChecklistContract,
  QualityDocument,
  QualityCenter,
  QualityCenterProjection,
  QualityRealityAudit,
  QualityStrategy,
  QualityVerificationDesign,
  QualityVerificationResult,
  QualityAnalysis,
  QualityAnalysisRelations,
  QualityIntegration,
  QualityDetailTrace,
  QualityDetailUnits,
  QualityDetailAnalysis,
  QualityDefinitionModel,
  QualityDetailAssignment,
  QualityTables,
  QualityIntegrationItems,
  QualityTemplate,
  RepositoryQualityProjection,
} from "./types.ts";
import {
  qualityChecklistItems,
  qualityChecklistIssues,
  inspectBranchCoverageTable,
  inspectRemediationTable,
} from "./validation.ts";

/**
 * 取得済みQuality文書の共通の内容断面を捕捉する。
 * @responsibility 状態・件数のraw先頭条件と、可視ChecklistのEOF境界を所有する。
 * @trace ARCH-000008
 * @input source: 原文と相対Path。checklistRequest: 必要な場合だけ明示する種別と方式。
 * @returns 原文・Artifact・出典・重複宣言を保持する内容モデル。
 * @effect N/A: 取得済み値だけを扱う。
 * @failure 解析例外は伝播し、不明を正常値で補完しない。
 */
export function captureQualityDocument(
  source: ArtifactSource,
  checklistRequest: QualityChecklistRequest,
): QualityDocument & { checklistContract: QualityChecklistContract };

export function captureQualityDocument(source: ArtifactSource): QualityDocument;

export function captureQualityDocument(
  source: ArtifactSource,
  checklistRequest?: QualityChecklistRequest,
): QualityDocument {
  const captured = { path: source.path, content: source.content };
  let checklistContract: QualityChecklistContract | null = null;
  if (checklistRequest !== undefined) {
    if (
      checklistRequest.mode !== "template" &&
      checklistRequest.mode !== "evaluated"
    )
      throw new Error("unknown_quality_checklist_mode");
    const expectedItems = qualityChecklistItems(checklistRequest.kind);
    checklistContract = {
      kind: checklistRequest.kind,
      mode: checklistRequest.mode,
      expectedItems,
      failure:
        checklistRequest.mode === "template"
          ? inspectTemplateChecklist(captured.content, expectedItems)
          : inspectEvaluatedChecklist(captured.content, expectedItems),
    };
  }
  const stateDeclarations = [
    ...captured.content.matchAll(/^状態:\s*(.+?)\s*$/gmu),
  ].map((match) => ({
    text: match[1] as string,
    location: {
      path: captured.path,
      line: captured.content
        .slice(0, match.index + match[0].indexOf(match[1] as string, 3))
        .split("\n").length,
    },
  }));
  const counts = [
    ...captured.content.matchAll(
      /^\|\s*Local Item数\s*\|\s*([0-9]+)\s*\|\s*$/gmu,
    ),
  ];
  const localItemDeclarations = counts.map((match) => ({
    text: match[1] as string,
    location: {
      path: captured.path,
      line: captured.content.slice(0, match.index).split("\n").length,
    },
  }));
  const visible = omitMarkdownCommentsAndFencedCode(captured.content);
  const match = visible.match(/^## Checklist\s*$([\s\S]*)$/mu);
  const checklist = match
    ? {
        text: match[1] ?? "",
        location: {
          path: captured.path,
          line: visible
            .slice(
              0,
              (match.index ?? 0) + match[0].length - (match[1]?.length ?? 0),
            )
            .split("\n").length,
        },
      }
    : null;
  return {
    diagramContract:
      checklistRequest?.mode === "template" &&
      checklistRequest.kind === "verification_design"
        ? parseDiagramDisposition(captured, [
            "検証義務・試験Level／Boundary対応図",
            "状態・分岐・Block別Coverage図",
            "検証結果・判断接続図",
          ])
        : null,
    checklistContract,
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    tableRows: captureDocumentTableRows(captured),
    stateDeclarations,
    localItemDeclarations,
    localItemCount: localItemDeclarations[0]
      ? Number.parseInt(localItemDeclarations[0].text, 10)
      : null,
    checklist,
    hasOpenChecklist:
      /^- (?:OPEN|FAIL):/mu.test(checklist?.text ?? "") ||
      /^- \[ \]/mu.test(checklist?.text ?? ""),
  };
}

/**
 * Quality Centerの有限状態を解析し、Ready分岐の条件を返す。
 * @responsibility Quality Centerの有限状態を解析し、Ready分岐の条件を返す。
 * @trace ARCH-000008
 * @input source: Quality Centerの原文と相対Path。
 * @returns 文書内容・正規化状態・分岐条件・表示表をresult、局所診断をissuesへ分離したOutcome。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 本文から解析できない状態をIssueで返す。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseQualityCenter(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<QualityCenter> & Readonly<{ result: QualityCenter }> {
  const document = captureQualityDocument(source, {
    kind: "center",
    mode: options.mode === undefined ? "evaluated" : options.mode,
  });
  const qualityCenterPath = document.source.path;
  const issues: DocumentIssue[] = [];

  const qualityCenterState = document.stateDeclarations[0]?.text ?? "";
  const normalizedQualityState = qualityCenterState
    .replace(/^v\d+\.\d+\.\d+\s+/u, "")
    .replace(/（Released Baseline:[^）]+）$/u, "")
    .trim();
  const qualityStateKinds = [
    "Quality Design Under Review — Reality Audit Blocked",
    "Quality Design Ready — Reality Audit Pending",
    "Quality Ready",
  ] as const;
  const isQualityStateKnown = qualityStateKinds.some(
    (state) => state === normalizedQualityState,
  );
  if (!isQualityStateKnown && options.mode !== "template")
    issues.push({
      kind: "artifact.quality-analysis.state-invalid",
      targetIdentity: qualityCenterPath,
      location: { path: qualityCenterPath },
      reason: "state-invalid",
      details: {},
    });
  const isQualityDesignReady =
    normalizedQualityState === "Quality Design Ready — Reality Audit Pending";
  const isQualityReady = normalizedQualityState === "Quality Ready";

  issues.push(...qualityChecklistIssues(document));
  return {
    status: issues.length ? "partial" : "complete",
    result: {
      ...document,
      normalizedQualityState,
      isQualityStateKnown,
      isQualityDesignReady,
      isQualityReady,
      currentProjection: captureQualityCenterProjection(
        document.source.content,
      ),
    },
    issues,
  };
}

/**
 * Reality Audit自身の内容と宣言状態を解析する。
 * @responsibility 文書内の状態・件数・Checklistを保持し、Centerとの比較を行わない。
 * @trace ARCH-000008
 * @input source: Reality文書の原文と位置。options: ひな型または評価済みの方式。
 * @returns Reality自身の宣言状態・件数・内容と局所診断。Centerとの状態対はSemanticで比較する。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 未知Reality状態・不一致をIssueで返す。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseQualityRealityAudit(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<QualityRealityAudit> &
  Readonly<{ result: QualityRealityAudit }> {
  const document = captureQualityDocument(source, {
    kind: "reality_audit",
    mode: options.mode === undefined ? "evaluated" : options.mode,
  });
  const realityAuditState = document.stateDeclarations[0]?.text ?? "";
  const realityAuditPath = document.source.path;
  const issues: DocumentIssue[] = [];

  const allowedRealityAuditStates = [
    "Blocked — Quality Design Review Pending",
    "Pending — Not Started",
    "In Progress",
    "Complete",
  ] as const;
  if (
    options.mode !== "template" &&
    !allowedRealityAuditStates.some((state) => state === realityAuditState)
  )
    issues.push({
      kind: "artifact.quality-analysis.reality-audit-state-invalid",
      targetIdentity: realityAuditPath,
      location: { path: realityAuditPath },
      reason: "reality-audit-state-invalid",
      details: {},
    });
  issues.push(...qualityChecklistIssues(document));
  return {
    status: issues.length ? "partial" : "complete",
    result: document,
    issues,
  };
}

/**
 * Strategy文書の内容と局所Checklist診断を返す。
 * @responsibility 捕捉した本文の不備だけを評価し、外部集合の比較を行わない。
 * @trace ARCH-000008
 */
export function parseQualityStrategy(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<QualityStrategy> & Readonly<{ result: QualityStrategy }> {
  const document = captureQualityDocument(source, {
    kind: "strategy",
    mode: options.mode === undefined ? "evaluated" : options.mode,
  });
  const result = {
    ...document,
    sections: [
      ...new Set(document.artifact.sections.map((section) => section.title)),
    ].flatMap((title) => captureDocumentSections(document.source, title)),
  };
  const issues = qualityChecklistIssues(document);
  return { status: issues.length ? "partial" : "complete", result, issues };
}

/**
 * VerificationDesign文書の内容と局所Checklist診断を返す。
 * @responsibility 捕捉した本文の不備だけを評価し、外部集合の比較を行わない。
 * @trace ARCH-000008
 */
export function parseQualityVerificationDesign(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<QualityVerificationDesign> &
  Readonly<{ result: QualityVerificationDesign }> {
  const document = captureQualityDocument(source, {
    kind: "verification_design",
    mode: options.mode === undefined ? "evaluated" : options.mode,
  });
  const result = {
    ...document,
    sections: [
      ...new Set(document.artifact.sections.map((section) => section.title)),
    ].flatMap((title) => captureDocumentSections(document.source, title)),
  };
  const issues = qualityChecklistIssues(document);
  return { status: issues.length ? "partial" : "complete", result, issues };
}

/**
 * VerificationResult文書の内容と局所Checklist診断を返す。
 * @responsibility 捕捉した本文の不備だけを評価し、外部集合の比較を行わない。
 * @trace ARCH-000008
 */
export function parseQualityVerificationResult(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<QualityVerificationResult> &
  Readonly<{ result: QualityVerificationResult }> {
  const document = captureQualityDocument(source, {
    kind: "verification_result",
    mode: options.mode === undefined ? "evaluated" : options.mode,
  });
  const templateContract =
    options.mode === "template"
      ? captureQualityTemplate(document.source, "verification_result")
      : null;
  const result = {
    templateContract,
    ...document,
    sections: [
      ...new Set(document.artifact.sections.map((section) => section.title)),
    ].flatMap((title) => captureDocumentSections(document.source, title)),
  };
  const issues = [
    ...qualityChecklistIssues(document),
    ...(templateContract && !templateContract.valid
      ? [
          {
            kind: "artifact.quality.template-content-invalid",
            targetIdentity: source.path,
            location: { path: source.path },
            reason: "template-content-invalid",
            details: {},
          },
        ]
      : []),
  ];
  return { status: issues.length ? "partial" : "complete", result, issues };
}

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
  const result: QualityAnalysis = {
    ...content,
    relationData,
    definitionReferences: Array.from(
      (content.coverage[0]?.text ?? "").matchAll(
        /\]\(\.\.\/\.\.\/Definitions\/(QA-[0-9]{6})\/quality_definition\.md\)/gu,
      ),
      (match) => match[1] as string,
    ),
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
    detailReferences: Array.from(
      (content.details[0]?.text ?? "").matchAll(
        /\]\((\.\.\/06_Architecture\/Details\/[a-z0-9-]+\/01_Architecture\.md)\)/gu,
      ),
      (match) => match[1] as string,
    ),
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
 * Quality中央対応表を出典付きモデルへ構築する。
 * @responsibility 可視本文の既存文法と部分情報を原文・出典へ結合する。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。期待Identityや種別は列挙元が確定する。
 * @returns 担当内容のモデル。入力を変更せず欠測を補完しない。
 * @effect N/A: 同一Processの純粋な値構築。Reader・診断・保存を追加しない。
 */
function captureQualityDetailTrace(
  document: QualityDocument,
): QualityDetailTrace {
  const captured = document.source;
  const content = omitMarkdownCommentsAndFencedCode(captured.content);
  const artifact = document.artifact;
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
): QualityAnalysisRelations & { issues: DocumentIssue[] } {
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
): QualityDetailUnits & { issues: DocumentIssue[] } {
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
function captureQualityIntegrationItems(
  analysis: string,
): QualityIntegrationItems {
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
    trace: captureQualityDetailTrace(document),
    sections: [
      ...new Set(document.artifact.sections.map((section) => section.title)),
    ].flatMap((title) => captureDocumentSections(document.source, title)),
  };
  const issues = qualityChecklistIssues(document);
  return { status: issues.length ? "partial" : "complete", result, issues };
}

/**
 * 情報源固有の条件文字列を正規化する。
 * @responsibility 情報源固有の条件文字列を正規化する。
 * @trace ARCH-000008
 * @input value: 条件セル文字列。
 * @returns trimと連続空白の単一空白化後の条件。
 * @precondition valueは解析した文字列である。
 * @postcondition 入力を変更しない。
 * @effect N/A: 同期的な値処理。
 * @failure 解析例外を伝播し、不明を正常値に補完しない。
 * @invariant 大小文字や記号を同一視しない。
 * @boundary N/A: Process内のQuality文書意味検査。
 * @security 認可・実在・実行許可・品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function normalizeQualityCondition(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

/**
 * Quality Definitionの本文条件と部分関係を検査する。
 * @responsibility Quality Definitionの本文条件と部分関係を検査する。
 * @trace ARCH-000008
 * @input artifact: 取得済み生本文と診断位置。qualityId: Directory由来のQA-ID。
 * @returns 関係集合・出現列、条件・段階・境界等のMap、Local ID出現列とIssue。
 * @precondition 呼出し元が正規QA DirectoryのIDと生本文を取得している。
 * @postcondition 不正本文でも解析できた関係を返し、Fileを読み直さない。
 * @effect N/A: 同期的な値処理。
 * @failure 解析例外を伝播し、不明を正常値に補完しない。
 * @invariant 生本文、単純pipe、後勝ちMap、Header不正後の継続とIssue順を維持する。
 * @boundary N/A: Process内のQuality文書意味検査。
 * @security 認可・実在・実行許可・品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseQualityDefinition(
  artifact: ArtifactSource,
  qualityId: string,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<QualityDefinitionModel> &
  Readonly<{ result: QualityDefinitionModel }> {
  const captured = { path: artifact.path, content: artifact.content };
  const definition = captured.content,
    sourcePath = artifact.path;
  const semanticLines = definition.split(/\r?\n/u).map((text, index) => ({
    text,
    location: { path: captured.path, line: index + 1 },
    cells: text
      .trim()
      .replace(/^\|/u, "")
      .replace(/\|$/u, "")
      .split("|")
      .map((cell) => cell.trim()),
  }));
  const semanticHeading = semanticLines.findIndex(
    (line) => line.text.trim() === "## Semantic Coverage Pilot",
  );
  const semanticStart =
    semanticHeading < 0
      ? -1
      : semanticLines.findIndex(
          (line, index) =>
            index > semanticHeading && line.text.trim().startsWith("|"),
        );
  const semanticRows: DocumentTableRow[] = [];
  if (semanticStart >= 0)
    for (const line of semanticLines.slice(semanticStart + 2)) {
      if (!line.text.trim().startsWith("|")) break;
      semanticRows.push({ cells: line.cells, location: line.location });
    }
  const modeHeader = semanticLines.findIndex(
    (line) =>
      line.text.trim().startsWith("|") &&
      line.cells.includes("Local ID") &&
      line.cells.includes("実行形態"),
  );
  const modeRows = new Map<string, "automated" | "manual" | null>();
  if (modeHeader >= 0) {
    const headers = semanticLines[modeHeader]?.cells ?? [];
    for (const line of semanticLines.slice(modeHeader + 2)) {
      if (!line.text.trim().startsWith("|")) break;
      const local = line.cells[headers.indexOf("Local ID")] ?? "";
      if (modeRows.has(local)) continue;
      const mode = line.cells[headers.indexOf("実行形態")];
      modeRows.set(
        local,
        mode === "Automated"
          ? "automated"
          : mode === "Manual"
            ? "manual"
            : null,
      );
    }
  }
  const localItems = new Map<
    string,
    { occurrences: number; executionMode: "automated" | "manual" | null }
  >();
  for (const row of semanticRows) {
    const id = row.cells[0]?.match(
      /^`([A-Z]{3}-(?:UT|IT|ST|UAT)-[0-9]{3})`$/u,
    )?.[1];
    if (id)
      localItems.set(id, {
        occurrences: definition.split(`| \`${id}\` |`).length - 1,
        executionMode: modeRows.get(`\`${id}\``) ?? null,
      });
  }
  const semantic = {
    heading:
      semanticHeading < 0 ? null : (semanticLines[semanticHeading] ?? null),
    header: semanticStart < 0 ? null : (semanticLines[semanticStart] ?? null),
    separator:
      semanticStart < 0 ? null : (semanticLines[semanticStart + 1] ?? null),
    rows: semanticRows,
    localItems,
  };
  const sections = {
    coverage: captureQualitySections(
      captured,
      /^## 1\. 情報源と網羅条件\s*$([\s\S]*?)(?=^##\s)/mu,
    ),
    architectureInput: captureQualitySections(
      captured,
      /^### Architecture詳細設計入力\s*$([\s\S]*?)(?=^##\s)/mu,
    ),
    conditionApplicability: captureQualitySections(
      captured,
      /^### 条件区分の適用\s*$([\s\S]*?)(?=^##\s)/mu,
    ),
    items: captureQualitySections(
      captured,
      /^## [0-9]+\. 検証項目\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
    ),
    stageApplicability: captureQualitySections(
      captured,
      /^## [0-9]+\. 試験段階と外部境界の適用\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
    ),
    additionalTypes: captureQualitySections(
      captured,
      /^## 追加試験種別の適用\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
    ),
  };
  const issues: DocumentIssue[] = [];
  const definitionSourceRelations = new Set<string>();
  const definitionSourceRelationEntries: string[] = [];
  const definitionSourceConditions = new Map<string, string>();
  const definitionSourceGoalLevels = new Map<string, Set<string>>();
  const definitionObligationKeys = new Map<string, string>();
  const definitionObligationKeyEntries: string[] = [];
  const definitionDetailGoalRelations = new Set<string>();
  const definitionDetailGoalRelationEntries: string[] = [];
  const definitionGoalLocalRelations = new Set<string>();
  const definitionGoalLocalRelationEntries: string[] = [];
  const localItemLevels = new Map<string, string>();
  const localItemBoundaryStages = new Map<string, string>();

  const declaredQualityId = definition.match(
    /^Quality ID:\s*`(QA-[0-9]{6})`\s*$/mu,
  )?.[1];
  if (
    declaredQualityId !== qualityId ||
    !new RegExp(`^# ${qualityId}\\s+\\S`, "mu").test(definition)
  )
    issues.push({
      kind: "artifact.quality.definition-identity-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "definition-identity-mismatch",
      details: {},
    });
  const coverageSection = sections.coverage[0]?.text;
  if (!coverageSection)
    issues.push({
      kind: "artifact.quality.definition-source-coverage-missing",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "definition-source-coverage-missing",
      details: {},
    });
  for (const line of (coverageSection ?? "").split(/\r?\n/u)) {
    const relation = line.match(
      /^\|\s*\[((?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6})\]\([^)]+\)\s*\|\s*`([a-z0-9.-]+)`\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*$/u,
    );
    if (!relation) continue;
    const [
      ,
      sourceId,
      obligationKey,
      derivationSource,
      condition,
      levelCell,
      localCell,
    ] = relation as [string, string, string, string, string, string, string];
    const requestedLevels = new Set(
      Array.from(levelCell.matchAll(/UT|IT|ST|UAT/gu), (match) => match[0]),
    );
    const localIds = Array.from(
      localCell.matchAll(/`([A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3})`/gu),
      (match) => match[1] as string,
    );
    if (
      obligationKey !==
        `${sourceId.toLowerCase()}.${qualityId.toLowerCase()}` ||
      derivationSource.trim().length === 0 ||
      condition.trim().length === 0 ||
      requestedLevels.size === 0 ||
      localIds.length === 0
    )
      issues.push({
        kind: "artifact.quality.definition-source-local-relation-incomplete",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "definition-source-local-relation-incomplete",
        details: {},
      });
    definitionSourceConditions.set(
      `${sourceId}|${qualityId}`,
      normalizeQualityCondition(condition),
    );
    definitionObligationKeyEntries.push(obligationKey);
    definitionObligationKeys.set(`${sourceId}|${qualityId}`, obligationKey);
    definitionSourceGoalLevels.set(`${sourceId}|${qualityId}`, requestedLevels);
    for (const localId of localIds) {
      const relation = `${sourceId}|${qualityId}|${localId}`;
      definitionSourceRelationEntries.push(relation);
      definitionSourceRelations.add(relation);
    }
  }
  const detailCoverageSection = sections.architectureInput[0]?.text;
  if (!detailCoverageSection)
    issues.push({
      kind: "artifact.quality.definition-detail-coverage-missing",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "definition-detail-coverage-missing",
      details: {},
    });
  for (const detail of (detailCoverageSection ?? "").matchAll(
    /\[([a-z0-9-]+)\]\(\.\.\/\.\.\/\.\.\/06_Architecture\/Details\/\1\/01_Architecture\.md\)/gu,
  )) {
    const relation = `${detail[1]}|${qualityId}`;
    definitionDetailGoalRelationEntries.push(relation);
    definitionDetailGoalRelations.add(relation);
  }
  const stateApplicabilitySection = sections.conditionApplicability[0]?.text;
  const stateApplicability = new Map<
    string,
    { applicability: string; localItems: string[]; rationale: string }
  >();
  for (const line of (stateApplicabilitySection ?? "").split(/\r?\n/u)) {
    const row = line.match(
      /^\|\s*(正常|境界|準正常|異常|回復)\s*\|\s*(Required|N\/A)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*$/u,
    );
    if (!row) continue;
    stateApplicability.set(row[1] as string, {
      applicability: row[2] as string,
      localItems: [
        ...(row[3] as string).matchAll(
          /[A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3}/gu,
        ),
      ].map((match) => match[0]),
      rationale: (row[4] as string).trim(),
    });
  }
  if (
    ["正常", "境界", "準正常", "異常", "回復"].some(
      (state) => !stateApplicability.has(state),
    )
  )
    issues.push({
      kind: "artifact.quality.verification-state-applicability-incomplete",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "verification-state-applicability-incomplete",
      details: {},
    });
  const itemSection = sections.items[0]?.text;
  const expectedItemColumns = [
    "Local ID",
    "条件区分",
    "試験段階",
    "試験種別",
    "対象／境界",
    "外部境界の段階",
    "事前状態／入力",
    "操作／刺激",
    "観測",
    "Oracle",
    "Evidence",
    "終了後条件",
    "実行形態",
  ];
  const itemTableLines = (itemSection ?? "")
    .split(/\r?\n/u)
    .filter((line) => /^\|.*\|\s*$/u.test(line));
  const localItemLevelStages: Array<{
    level: string;
    externalBoundaryStage: string;
  }> = [];
  const definitionLocalIds = new Set<string>();
  const definitionLocalConditionClasses = new Map<string, string>();
  const itemHeaderCells = itemTableLines[0]
    ?.slice(1, itemTableLines[0].lastIndexOf("|"))
    .split("|")
    .map((cell) => cell.trim());
  if (
    !itemHeaderCells ||
    itemHeaderCells.length !== expectedItemColumns.length ||
    itemHeaderCells.some((cell, index) => cell !== expectedItemColumns[index])
  )
    issues.push({
      kind: "artifact.quality.verification-item-schema-invalid",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "verification-item-schema-invalid",
      details: {},
    });
  for (const itemLine of itemTableLines.slice(2)) {
    if (
      !/^\|\s*`[A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3}`\s*\|/u.test(itemLine)
    )
      continue;
    const cells = itemLine
      .slice(1, itemLine.lastIndexOf("|"))
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length === expectedItemColumns.length)
      localItemLevelStages.push({
        level: cells[2] as string,
        externalBoundaryStage: cells[5] as string,
      });
    if (cells.length === expectedItemColumns.length) {
      const localId = (cells[0] as string).match(
        /^`([A-Z][A-Z0-9]*-(UT|IT|ST|UAT)-[0-9]{3})`$/u,
      )?.[1];
      if (localId) {
        const identifierLevel = (cells[0] as string).match(
          /^`[A-Z][A-Z0-9]*-(UT|IT|ST|UAT)-[0-9]{3}`$/u,
        )?.[1];
        if (identifierLevel !== (cells[2] as string))
          issues.push({
            kind: "artifact.quality.verification-item-id-level-mismatch",
            targetIdentity: sourcePath,
            location: { path: sourcePath },
            reason: "verification-item-id-level-mismatch",
            details: { localId },
          });
        localItemLevels.set(localId, cells[2] as string);
        localItemBoundaryStages.set(localId, cells[5] as string);
        definitionLocalIds.add(localId);
        definitionLocalConditionClasses.set(localId, cells[1] as string);
      }
    }
    if (
      cells.length !== expectedItemColumns.length ||
      cells.some((cell) => cell.length === 0)
    )
      issues.push({
        kind: "artifact.quality.verification-item-axis-missing",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "verification-item-axis-missing",
        details: {},
      });
    if (
      cells.length === expectedItemColumns.length &&
      !["正常", "境界", "準正常", "異常", "回復"].includes(cells[1] as string)
    )
      issues.push({
        kind: "artifact.quality.verification-item-condition-class-invalid",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "verification-item-condition-class-invalid",
        details: {},
      });
    if (
      cells.length === expectedItemColumns.length &&
      !["UT", "IT", "ST", "UAT"].includes(cells[2] as string)
    )
      issues.push({
        kind: "artifact.quality.verification-item-test-level-invalid",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "verification-item-test-level-invalid",
        details: {},
      });
    if (
      cells.length === expectedItemColumns.length &&
      ![
        "N/A",
        "Direct Boundary",
        "Adjacent 1 Block",
        "Related 2 Blocks",
        "System/E2E",
        "User Acceptance",
      ].includes(cells[5] as string)
    )
      issues.push({
        kind: "artifact.quality.verification-item-external-boundary-stage-invalid",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "verification-item-external-boundary-stage-invalid",
        details: {},
      });
    if (
      cells.length === expectedItemColumns.length &&
      !["Automated", "Manual", "Hybrid"].includes(cells[12] as string)
    )
      issues.push({
        kind: "artifact.quality.verification-item-execution-mode-invalid",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "verification-item-execution-mode-invalid",
        details: {},
      });
  }
  for (const [state, entry] of stateApplicability) {
    if (entry.rationale.length === 0)
      issues.push({
        kind: "artifact.quality.verification-state-applicability-invalid",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "verification-state-applicability-invalid",
        details: { state, violation: "rationale" },
      });
    const classLocalItems = [...definitionLocalConditionClasses]
      .filter(([, conditionClass]) => conditionClass === state)
      .map(([localId]) => localId);
    if (
      (entry.applicability === "Required" &&
        (entry.localItems.length === 0 ||
          entry.localItems.some(
            (localId) =>
              !definitionLocalIds.has(localId) ||
              definitionLocalConditionClasses.get(localId) !== state,
          ) ||
          classLocalItems.some(
            (localId) => !entry.localItems.includes(localId),
          ))) ||
      (entry.applicability === "N/A" &&
        (entry.localItems.length > 0 || classLocalItems.length > 0))
    )
      issues.push({
        kind: "artifact.quality.verification-state-applicability-invalid",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "verification-state-applicability-invalid",
        details: { state, violation: "local-items" },
      });
  }
  const applicabilitySection = sections.stageApplicability[0]?.text;
  const applicabilityRows = new Map<
    string,
    { applicability: string; externalBoundaryReach: string }
  >();
  for (const line of (applicabilitySection ?? "").split(/\r?\n/u)) {
    const row = line.match(
      /^\|\s*(UT|IT|ST|UAT)\s*\|\s*(Required|Conditional|N\/A)\s*\|\s*([^|]+)\|\s*(N\/A|Direct Boundary|Adjacent 1 Block|Related 2 Blocks|System\/E2E|User Acceptance)\s*\|\s*([^|]+)\|\s*$/u,
    );
    if (!row) continue;
    applicabilityRows.set(row[1] as string, {
      applicability: row[2] as string,
      externalBoundaryReach: row[4] as string,
    });
  }
  if (
    applicabilityRows.size !== 4 ||
    ["UT", "IT", "ST", "UAT"].some((level) => !applicabilityRows.has(level))
  )
    issues.push({
      kind: "artifact.quality.test-level-applicability-incomplete",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "test-level-applicability-incomplete",
      details: {},
    });
  const requiredLevelDisplay = new Map([
    ["UT", "Unit"],
    ["IT", "Integration"],
    ["ST", "System"],
    ["UAT", "User Acceptance"],
  ]);
  const primaryLevelText =
    definition.match(/^主な試験段階:\s*(.+?)\s*$/mu)?.[1];
  const expectedPrimaryLevels = ["UT", "IT", "ST", "UAT"]
    .filter(
      (level) => applicabilityRows.get(level)?.applicability === "Required",
    )
    .map((level) => requiredLevelDisplay.get(level));
  if (
    !primaryLevelText ||
    primaryLevelText
      .split("／")
      .map((level) => level.trim())
      .join("／") !== expectedPrimaryLevels.join("／")
  )
    issues.push({
      kind: "artifact.quality.primary-test-level-summary-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "primary-test-level-summary-mismatch",
      details: {},
    });

  const additionalTypeSection = sections.additionalTypes[0]?.text;
  const additionalTypeRows = new Map<
    string,
    { applicability: string; authorization: string }
  >();
  for (const line of (additionalTypeSection ?? "").split(/\r?\n/u)) {
    const row = line.match(
      /^\|\s*(RT|PT|LT)\s*\|\s*(Required|Conditional|N\/A)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*$/u,
    );
    if (!row) continue;
    additionalTypeRows.set(row[1] as string, {
      applicability: row[2] as string,
      authorization: (row[4] as string).trim(),
    });
  }
  if (
    additionalTypeRows.size !== 3 ||
    ["RT", "PT", "LT"].some((type) => !additionalTypeRows.has(type))
  )
    issues.push({
      kind: "artifact.quality.additional-test-type-applicability-incomplete",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "additional-test-type-applicability-incomplete",
      details: {},
    });
  for (const type of ["PT", "LT"]) {
    const row = additionalTypeRows.get(type);
    if (
      row &&
      ((row.applicability === "N/A" && row.authorization !== "N/A") ||
        (row.applicability !== "N/A" &&
          row.authorization !== "Human Explicit Authorization"))
    )
      issues.push({
        kind: "artifact.quality.expensive-test-authorization-invalid",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "expensive-test-authorization-invalid",
        details: {},
      });
  }
  const externalBoundaryStageOrder = new Map([
    ["N/A", 0],
    ["Direct Boundary", 1],
    ["Adjacent 1 Block", 2],
    ["Related 2 Blocks", 3],
    ["System/E2E", 4],
    ["User Acceptance", 5],
  ]);
  for (const level of ["UT", "IT", "ST", "UAT"]) {
    const applicability = applicabilityRows.get(level);
    if (!applicability) continue;
    const localItems = localItemLevelStages.filter(
      (item) => item.level === level,
    );
    const declaredReach = externalBoundaryStageOrder.get(
      applicability.externalBoundaryReach,
    );
    const hasItemBeyondDeclaredReach = localItems.some((item) => {
      const itemReach = externalBoundaryStageOrder.get(
        item.externalBoundaryStage,
      );
      return (
        declaredReach !== undefined &&
        itemReach !== undefined &&
        itemReach > declaredReach
      );
    });
    if (
      (applicability.applicability === "Required" && localItems.length === 0) ||
      (applicability.applicability === "N/A" && localItems.length > 0) ||
      hasItemBeyondDeclaredReach
    )
      issues.push({
        kind: "artifact.quality.test-level-applicability-conflict",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "test-level-applicability-conflict",
        details: {},
      });
  }
  const localIds = Array.from(
    (itemSection ?? "").matchAll(
      /^\|\s*`([A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3})`\s*\|/gmu,
    ),
    (match) => match[1] as string,
  );
  if (localIds.length === 0)
    issues.push({
      kind: "artifact.quality.definition-verification-items-missing",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "definition-verification-items-missing",
      details: {},
    });
  for (const localId of localIds) {
    const goalLocalRelation = `${qualityId}|${localId}`;
    definitionGoalLocalRelationEntries.push(goalLocalRelation);
    definitionGoalLocalRelations.add(goalLocalRelation);
  }

  const document = captureQualityDocument(captured, {
    kind: "definition",
    mode: options.mode === undefined ? "evaluated" : options.mode,
  });
  const finalIssues = [
    ...(options.mode === "template" ? [] : issues),
    ...qualityChecklistIssues(document),
  ];
  return {
    status: finalIssues.length ? "partial" : "complete",
    result: {
      assignment: captureQualityDetailAssignment(document, qualityId),
      ...document,
      expectedIdentity: qualityId,
      semantic,
      visibleLines: omitMarkdownCommentsAndFencedCode(captured.content)
        .split("\n")
        .map((text, index) => ({
          text,
          location: { path: captured.path, line: index + 1 },
        })),
      sections,
      sourceRelations: definitionSourceRelations,
      sourceRelationEntries: definitionSourceRelationEntries,
      sourceConditions: definitionSourceConditions,
      sourceGoalLevels: definitionSourceGoalLevels,
      obligationKeys: definitionObligationKeys,
      obligationKeyEntries: definitionObligationKeyEntries,
      detailGoalRelations: definitionDetailGoalRelations,
      detailGoalRelationEntries: definitionDetailGoalRelationEntries,
      goalLocalRelations: definitionGoalLocalRelations,
      goalLocalRelationEntries: definitionGoalLocalRelationEntries,
      localItemLevels: localItemLevels,
      localItemBoundaryStages: localItemBoundaryStages,
      localIds,
    },
    issues: finalIssues,
  };
}

/**
 * Quality固有のraw節境界を維持して全出現を捕捉する。
 * @responsibility 先頭選択前の本文・重複・欠測と元の行位置を保持する。
 * @trace ARCH-000008
 * @input source: 原文と相対Path。expression: 本文を第一Groupへ捕捉する工程固有条件。
 * @returns 出現順の本文と出典。
 * @effect N/A: 取得済み値のみを扱う。
 * @failure 正規表現例外は伝播する。
 */
function captureQualitySections(
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
 * Quality定義の担当モデルを構築する。
 * @responsibility 可視本文の既存文法と部分情報を原文・出典へ結合する。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。期待Identityや種別は列挙元が確定する。
 * @returns 担当内容のモデル。入力を変更せず欠測を補完しない。
 * @effect N/A: 同一Processの純粋な値構築。Reader・診断・保存を追加しない。
 */
function captureQualityDetailAssignment(
  document: QualityDocument,
  expectedIdentity: string,
): QualityDetailAssignment {
  const captured = document.source;
  const content = omitMarkdownCommentsAndFencedCode(captured.content);
  const artifact = document.artifact;
  const tableRows = captureDocumentTableRows({ path: captured.path, content });
  const declarations: DocumentText[] = content
    .split(/\r?\n/u)
    .flatMap((line, index) =>
      line.startsWith("担当Interaction Relation:")
        ? [
            {
              text: line,
              location: { path: captured.path, line: index + 1, column: 1 },
            },
          ]
        : [],
    );
  const uiIds = new Set<string>();
  const specIds = new Set<string>();
  const relations: string[] = [];
  let hasDuplicateRelations = false;
  for (const line of content.split(/\r?\n/u)) {
    const cells = parseMarkdownTableRow(line);
    if (cells) {
      const ui = cells[1]?.match(/UI-[0-9]{6}/u)?.[0];
      const spec = cells[1]?.match(/SPEC-[0-9]{6}/u)?.[0];
      if (ui && /SCR-[0-9]{6}/u.test(cells[0] ?? "")) uiIds.add(ui);
      if (spec && /BHV-[0-9]{6}/u.test(cells[0] ?? "")) specIds.add(spec);
    }
    if (!line.startsWith("担当Interaction Relation:")) continue;
    const keys = [...line.matchAll(/PRT-[0-9]{6}\.spec-[0-9]{6}/gu)].map(
      (match) => match[0],
    );
    relations.push(...keys);
    if (keys.length !== new Set(keys).size) hasDuplicateRelations = true;
  }
  return {
    artifact,
    source: captured,
    tableRows,
    expectedIdentity,
    declarations,
    uiIds,
    specIds,
    relations,
    hasDuplicateRelations,
  };
}

/**
 * 任意Markdownの品質表を内容モデルと局所診断へ受け付ける。
 * @responsibility 同じ取得本文から分岐表・是正表の件数と区分別Issueを構築する。
 * @trace ARCH-000008
 * @input source: 呼出し元が既存位置で取得した本文と出典。
 * @returns 品質表のParseResult。一般Artifactの局所Issueは混ぜない。
 * @effect N/A: 本文の同期解析のみ。実体を再観測しない。
 * @failure 解析例外を伝播し、不明を空表へ補完しない。
 * @invariant 分岐表→是正表の順と既存の件数・短絡条件を維持する。
 */
export function parseQualityTables(
  source: ArtifactSource,
): ParseResult<QualityTables> & Readonly<{ result: QualityTables }> {
  const artifact = parseArtifact(source).result;
  const branch = inspectBranchCoverageTable(artifact);
  const remediation = inspectRemediationTable(artifact);
  const issues = [...branch.issues, ...remediation.issues];
  return {
    status: issues.length ? "partial" : "complete",
    result: {
      artifact,
      numericRowsChecked: branch.numericRowsChecked,
      remediationRowsChecked: remediation.remediationRowsChecked,
      branchIssues: branch.issues,
      remediationIssues: remediation.issues,
    },
    issues,
  };
}

const REQUIRED_KEYS = Object.freeze([
  "全体状態",
  "現在対象",
  "観測済み",
  "未観測",
  "既知Gap",
  "次Gate",
  "現在人間判断",
] as const);

/**
 * Current Quality Projection Markdownを共通Read Modelへ変換する。
 *
 * @responsibility 固定表から現在品質の必須七項目と根拠を決定論的に取得する。
 * @trace ARCH-000005
 * @input markdownに07_Quality/01_Quality_Center.mdのUTF-8本文を受け取る。
 * @returns 表示表の結果または固定した未取得理由を返す。
 * @precondition Current Quality Projection見出しと固定三列表が存在する。
 * @postcondition 必須七項目と各根拠を同じ入力Snapshotから返す。
 * @effect N/A: Markdown文字列だけを解析する。
 * @failure 見出し、表、必須値または根拠が欠ける場合は表示表だけを未取得にする。
 * @invariant 欠落値、割合、Passまたは人間判断を推測しない。
 * @boundary Quality Center MarkdownとConsumer共通契約の直接境界。
 * @security Link表示名だけを保持し、URLやHTMLを評価しない。
 * @concurrency N/A: 共有状態を持たない同期解析である。
 */
function captureQualityCenterProjection(
  markdown: string,
): QualityCenterProjection {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const headingIndex = lines.indexOf("## Current Quality Projection");
  if (headingIndex < 0)
    return {
      status: "unavailable",
      reason: "quality_projection_section_missing",
    };
  const headerIndex = lines.findIndex(
    (line, index) =>
      index > headingIndex &&
      line.trim() === "| 項目 | 現在値 | 根拠・次の処置 |",
  );
  if (
    headerIndex < 0 ||
    !/^\|(?:\s*:?-+:?\s*\|)+$/u.test(lines[headerIndex + 1]?.trim() ?? "")
  )
    return {
      status: "unavailable",
      reason: "quality_projection_table_invalid",
    };
  const values = new Map<
    string,
    Readonly<{ value: string; rationale: string }>
  >();
  for (const line of lines.slice(headerIndex + 2)) {
    if (!/^\|.*\|$/u.test(line.trim())) break;
    const cells = line
      .trim()
      .slice(1, -1)
      .split("|")
      .map((cell) =>
        cell
          .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
          .replace(/`([^`]+)`/gu, "$1")
          .trim(),
      );
    if (cells.length !== 3 || cells.some((cell) => cell.length === 0))
      return {
        status: "unavailable",
        reason: "quality_projection_row_invalid",
      };
    values.set(
      cells[0] ?? "",
      Object.freeze({ value: cells[1] ?? "", rationale: cells[2] ?? "" }),
    );
  }
  for (const key of REQUIRED_KEYS)
    if (!values.has(key))
      return {
        status: "unavailable",
        reason: "quality_projection_value_missing",
      };
  const value = (key: (typeof REQUIRED_KEYS)[number]) =>
    values.get(key)?.value ?? "";
  const result: RepositoryQualityProjection = Object.freeze({
    overallState: value("全体状態"),
    target: value("現在対象"),
    observed: value("観測済み"),
    unobserved: value("未観測"),
    knownGap: value("既知Gap"),
    nextGate: value("次Gate"),
    humanDecision: value("現在人間判断"),
    rationale: Object.freeze(
      Object.fromEntries(
        REQUIRED_KEYS.map((key) => [key, values.get(key)?.rationale ?? ""]),
      ),
    ),
  });
  return { status: "complete", result };
}

/**
 * 三種類のQualityひな型を原文と出典付きで受け付ける。
 * @responsibility 検証結果はraw、分析・統合は可視本文の旧substring条件を適用する。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。kind: 既存の三種類のひな型。
 * @returns 不足時も原文・全表・期待表現と全出現を保持する内容モデル。
 * @precondition Filesystemの観測と種類選択は呼出し元が行う。
 * @postcondition 入力を変更せず、別のChecklist受付や読取りを統合しない。
 * @effect N/A: 同期的な値処理のみ。
 * @failure 未知kindは拒否し、解析例外は伝播する。
 * @invariant 節限定・正規化・列検査・重複拒否を追加しない。
 * @boundary 取得済み本文とQualityひな型モデルの境界。
 * @security 品質全体の成立・Authorityを発行しない。
 * @concurrency N/A: 局所値だけを扱う。
 */
export function captureQualityTemplate(
  source: ArtifactSource,
  kind: QualityTemplate["kind"],
): QualityTemplate {
  if (
    kind !== "verification_result" &&
    kind !== "analysis" &&
    kind !== "integration"
  )
    throw new Error("unknown_quality_template_kind");
  const captured = { path: source.path, content: source.content };
  const evaluatedContent =
    kind === "verification_result"
      ? captured.content
      : omitMarkdownCommentsAndFencedCode(captured.content);
  const requiredTexts =
    kind === "verification_result"
      ? [
          "### 必須の適用判断",
          "| 評価対象 | 判定 | 内容／理由 | 根拠／再評価契機 |",
          ...[
            "安全上重要な層間搬送",
            "耐久状態のAuthority分類",
            "発行前失敗／発行後失敗／retry",
            "残存資源／Recovery",
            "根拠の主張軸（入口形態）",
            "根拠の主張軸（観測基盤）",
            "根拠の主張軸（成果物Identity）",
            "根拠の主張軸（lifecycle）",
            "性能試験（PT）",
            "負荷試験（LT）",
            "人間による判断",
          ].map((item) => `| ${item} | Applicable／N/A／OPEN |`),
        ]
      : kind === "analysis"
        ? ["Source Layer", "Definition／Detail", "導出元／Relation"]
        : [
            "## 3. Definition／Detail入力の統合",
            "Source Layer",
            "Same／New／Merge",
          ];
  const requirements = requiredTexts.map((text) => {
    const occurrences: DocumentText[] = [];
    let offset = evaluatedContent.indexOf(text);
    while (offset >= 0) {
      occurrences.push({
        text,
        location: {
          path: captured.path,
          line: evaluatedContent.slice(0, offset).split("\n").length,
        },
      });
      offset = evaluatedContent.indexOf(text, offset + 1);
    }
    return { text, occurrences };
  });
  return {
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    kind,
    tableRows: captureDocumentTableRows(captured),
    evaluatedContent,
    requirements,
    valid: requirements.every(
      (requirement) => requirement.occurrences.length > 0,
    ),
  };
}
