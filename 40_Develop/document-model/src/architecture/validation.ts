/**
 * Architecture分析・定義とDetail引渡しの本文モデルを検査する。
 * @responsibility 取得済み本文の正式入力・九観点・統合責務・引渡し条件を中立Issueへ変換する。
 * @trace ARCH-000008
 */

import {
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
} from "../artifact/checklist.ts";
import {
  captureDocumentSections,
  captureDocumentTableRows,
  isMarkdownTableSeparator,
  omitMarkdownCommentsAndFencedCode,
  omitMarkdownCommentsOutsideFencedCode,
  parseMarkdownTableRow,
} from "../artifact/markdown.ts";
import { parseMarkdownArtifact } from "../artifact/parse-markdown.ts";
import { parseDiagramDisposition } from "../artifact/phase-diagrams.ts";
import type {
  ArtifactModel,
  ArtifactSource,
  ChecklistFailure,
  DocumentIssue,
  DocumentSection,
  DocumentTableRow,
  DocumentText,
  ParseResult,
} from "../artifact/types.ts";
import {
  type ArchitectureRegistryModel,
  captureArchitectureRegistry,
} from "./relations.ts";

/**
 * Architecture文書の有限なChecklist受付条件を指定する。
 * @responsibility 種別と方式を明示し、Path推定や期待列の外部組立てを避ける。
 * @trace ARCH-000008
 */
type ArchitectureChecklistRequest = Readonly<{
  kind:
    | "analysis_ui"
    | "analysis_spec"
    | "definition"
    | "definition_template"
    | "detail"
    | "detail_template";
  mode: "template" | "evaluated";
}>;

/**
 * Architecture文書の原文・構造とChecklist受付結果を保持する。
 * @responsibility 部分内容と出典を保持し、局所構造と工程品質を分離する。
 * @trace ARCH-000008
 * @invariant failure=nullは構造検査だけの成立であり、品質Passや認可を意味しない。
 */
export type ArchitectureDocument = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  checklist: readonly DocumentSection[];
  checklistContract: ArchitectureChecklistRequest &
    Readonly<{
      expectedItems: readonly string[];
      failure: ChecklistFailure | null;
    }>;
}>;

/**
 * Architectureが所有する期待項目を選択する。
 * @responsibility 旧文言・順序・派生列と受付間の独立性を維持する。
 * @trace ARCH-000008
 * @input kind: 明示された文書種別。
 * @returns 今回の受付だけが所有する期待項目配列。
 * @precondition 種別を方式やPathから推定しない。
 * @postcondition 固定定義・別受付と配列を共有しない。
 * @effect N/A: 固定値の局所構築のみ。
 * @failure 未知kindを拒否する。
 * @invariant 通常用とTemplate専用の期待列を自動統合しない。
 * @boundary Architectureの固定条件選択。
 * @security 期待列から品質成立やAuthorityを発行しない。
 * @concurrency N/A: 共有可変値を持たない。
 */
function architectureChecklistItems(
  kind: ArchitectureChecklistRequest["kind"],
): string[] {
  const architectureUiAnalysisChecklistItemTexts = [
    "自分自身のUI定義だけを正式入力として処置した",
    "利用者が得る結果、認識、操作、Feedbackおよび状態差を保持した",
    "Architectureが担う責務と担わない責務を評価した",
    "Boundary、主要ComponentおよびInterfaceの必要性を評価した",
    "Data／State Ownershipを評価した",
    "Authority、Effectおよび開示境界を評価した",
    "Failure BoundaryとRecovery責任を評価した",
    "Security／TrustとQuality Constraintを評価した",
    "Human Inputの必要性を評価した",
    "Open／GapとOwner工程へ戻す条件を明示した",
    "Verification Intentを評価した",
    "現行Sourceや実装構造から意味を逆輸入していない",
    "SPEC観点との統合時に確認する事項を明示した",
  ];

  const architectureSpecAnalysisChecklistItemTexts = [
    "自分自身のSPEC定義だけを正式入力として処置した",
    "契機、事前条件、Authority、状態、結果およびEffectを保持した",
    "Architectureが担う責務と担わない責務を評価した",
    "Boundary、主要ComponentおよびInterfaceの必要性を評価した",
    "Data／State Ownershipを評価した",
    "External Boundaryと終了後観測を評価した",
    "Failure BoundaryとRecovery責任を評価した",
    "Security／TrustとQuality Constraintを評価した",
    "Human Inputの必要性を評価した",
    "Open／GapとOwner工程へ戻す条件を明示した",
    "Verification Intentを評価した",
    "現行Sourceや実装構造から意味を逆輸入していない",
    "UI観点との統合時に確認する事項を明示した",
  ];

  const architectureDefinitionChecklistItemTexts = [
    "UI分析とSPEC分析だけを正式入力として統合した",
    "UI ContractとSPEC Contractを入力別に保持した",
    "独立したArchitecture Responsibilityを説明できる",
    "所有する責務、所有しない責務およびBoundaryを明示した",
    "Major Component、Interfaceおよび依存方向を明示した",
    "Data／State Ownershipを明示した",
    "Authority、EffectおよびLifecycleを入力別に評価した",
    "Failure Boundary、Recovery責任および観測を明示した",
    "Security／TrustとQuality Constraintを評価した",
    "Human Inputの必要性とOpen／Gapを評価した",
    "DetailsへのHandoffを明示した",
    "Qualityへ渡すVerification Intentを明示した",
    "現行Sourceや実装構造から意味を逆輸入していない",
    "上流の観測可能な振る舞いをArchitectureで変更していない",
  ];

  const architectureDefinitionTemplateChecklistItemTexts = [
    "UI／SPEC Definitionの意味統合と、適用するUI／SPEC Detailの配置制約を区別した",
    "UI ContractとSPEC Contractを入力別に保持した",
    "SCR／PRT／Interaction／BHVのN:N Relation、CoverageおよびGapを保持した",
    ...architectureDefinitionChecklistItemTexts.slice(2),
  ];

  const architectureDetailChecklistItemTexts = [
    "関連するARCH-IDと担当する責務断面を明示した",
    "10種類の詳細成果物を全数Applicability判定した",
    "Requiredを実在する節または成果物へ接続した",
    "N/AにArchitecture上の理由を記録した",
    "8種類のEngineering Concernを全数評価した",
    "PASSを設計済みの意味に限定した",
    "Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した",
    "Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した",
    "7種類のImplementation Structure観点を全数Applicability判定した",
    "二つ目の具象実装がある責務で、共通契約への昇格または非昇格理由を評価した",
    "Qualityへ渡す設計項目を局所的な導出キーまたは同等に一意な参照へ接続した",
    "Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した",
    "Human Inputの必要性とOpen／Gapを評価した",
    "現行実装との照合をReality Auditとして分離した",
    "Source構造をCanonical詳細設計へ逆輸入していない",
  ];

  const architectureDetailTemplateChecklistItemTexts = [
    architectureDetailChecklistItemTexts[0] as string,
    "適用するUI／SPEC Detailと担当構造の逆引きを保持した",
    ...architectureDetailChecklistItemTexts.slice(1),
  ];
  const items = {
    analysis_ui: architectureUiAnalysisChecklistItemTexts,
    analysis_spec: architectureSpecAnalysisChecklistItemTexts,
    definition: architectureDefinitionChecklistItemTexts,
    definition_template: architectureDefinitionTemplateChecklistItemTexts,
    detail: architectureDetailChecklistItemTexts,
    detail_template: architectureDetailTemplateChecklistItemTexts,
  };
  if (!Object.hasOwn(items, kind))
    throw new Error("unknown_architecture_checklist_kind");
  return items[kind];
}

/**
 * Architecture文書の内容とChecklist検査を一つの受付で完了する。
 * @responsibility 原文・出典・可視Checklistを捕捉し、固有条件を共通構文へ接続する。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。request: 明示する種別と方式。
 * @returns 部分内容も保持した文書モデルと元のChecklist失敗理由。
 * @precondition File観測・適用判断は呼出し元が所有する。
 * @postcondition 同じ捕捉本文を評価し、追加read・診断・保存を行わない。
 * @effect N/A: 同期的な局所値処理のみ。
 * @failure 未知kind／modeを拒否し、解析例外は伝播する。
 * @invariant 旧期待列で共通構文エンジンを一回だけ呼び、元の理由を保持する。
 * @boundary 取得済み原文とArchitecture内容モデルの境界。
 * @security 構造成立を品質Pass・認可へ読み替えない。
 * @concurrency N/A: 入力・別受付を変更しない。
 */
export function captureArchitectureDocument(
  source: ArtifactSource,
  request: ArchitectureChecklistRequest,
): ArchitectureDocument {
  const captured = { path: source.path, content: source.content };
  if (request.mode !== "template" && request.mode !== "evaluated")
    throw new Error("unknown_architecture_checklist_mode");
  const expectedItems = architectureChecklistItems(request.kind);
  const failure =
    request.mode === "template"
      ? inspectTemplateChecklist(captured.content, expectedItems)
      : inspectEvaluatedChecklist(captured.content, expectedItems);
  return {
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    tableRows: captureDocumentTableRows(captured),
    checklist: captureDocumentSections(
      {
        path: captured.path,
        content: omitMarkdownCommentsAndFencedCode(captured.content),
      },
      "Checklist",
    ),
    checklistContract: {
      kind: request.kind,
      mode: request.mode,
      expectedItems,
      failure,
    },
  };
}

/**
 * UI／SPEC観点のArchitecture分析を保持する。
 * @responsibility 名前付きの明示内容・出現・原文出典と、局所診断を分けて保持する。
 * @trace ARCH-000008
 * @invariant 自由文から状態機械・認可・実装や品質成立を生成しない。
 */
export type ArchitectureAnalysis = Readonly<{
  checklistSource: ArtifactSource;
  checklistContract: ArchitectureDocument["checklistContract"];
  hasUnresolvedResults: boolean;

  artifact: ArtifactModel;
  source: ArtifactSource;
  expectedIdentity: string;
  declarations: readonly DocumentText[];
  syntaxTokens: readonly DocumentText[];
  tableRows: readonly DocumentTableRow[];
  relations: readonly string[];
  view: "UI" | "SPEC";
  formalInput: readonly DocumentText[];
  inheritedContract: readonly DocumentText[];
  design: readonly DocumentText[];
  evaluation: readonly DocumentText[];
  disposition: readonly DocumentText[];
  integrationQuestions: readonly DocumentText[];
  checklist: readonly DocumentText[];
  evaluationRows: readonly DocumentTableRow[] | null;
}>;
/**
 * Architecture定義の統合責務と入力別の境界を保持する。
 * @responsibility 名前付きの明示内容・出現・原文出典と、局所診断を分けて保持する。
 * @trace ARCH-000008
 * @invariant 自由文から状態機械・認可・実装や品質成立を生成しない。
 */
export type ArchitectureDefinition = Readonly<{
  assignment: ArchitectureDetailAssignment<"definition">;
  checklistSource: ArtifactSource;
  checklistContract: ArchitectureDocument["checklistContract"];
  hasUnresolvedResults: boolean;
  templateContract: ArchitectureDetailTemplate | null;

  artifact: ArtifactModel;
  source: ArtifactSource;
  expectedIdentity: string;
  declarations: readonly DocumentText[];
  syntaxTokens: readonly DocumentText[];
  tableRows: readonly DocumentTableRow[];
  relations: readonly string[];
  responsibility: readonly DocumentText[];
  uiInput: readonly DocumentText[];
  specInput: readonly DocumentText[];
  integration: readonly DocumentText[];
  structure: readonly DocumentText[];
  data: readonly DocumentText[];
  failure: readonly DocumentText[];
  quality: readonly DocumentText[];
  unresolved: readonly DocumentText[];
  compatibility: readonly DocumentText[];
  handoff: readonly DocumentText[];
  observation: readonly DocumentText[];
  checklist: readonly DocumentText[];
  unknownRows: readonly DocumentTableRow[] | null;
}>;

/**
 * exact見出しの全出現を、旧先頭選択の前に出典付きで捕捉する。
 * @responsibility 名前付きの明示内容・出現・原文出典と、局所診断を分けて保持する。
 * @trace ARCH-000008
 * @invariant 自由文から状態機械・認可・実装や品質成立を生成しない。
 */
function captureArchitectureSections(
  source: ArtifactSource,
  heading: string,
): DocumentText[] {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const expression = new RegExp(
    `(?=(^${escaped}\\s*$)([\\s\\S]*?)(?=^## |(?![\\s\\S])))`,
    "gmu",
  );
  return [...source.content.matchAll(expression)].map((match) => ({
    text: match[2] ?? "",
    location: {
      path: source.path,
      line: source.content
        .slice(0, (match.index ?? 0) + (match[1]?.length ?? 0))
        .split("\n").length,
    },
  }));
}

/**
 * Architectureの固定列表を解析する。
 * @responsibility Architectureの固定列表を解析する。
 * @trace ARCH-000008
 * @input source: 可視本文。expectedHeaders: 列名。
 * @returns 固定列の行、または構造不正時null。
 * @precondition 呼出し元が対象の可視本文と期待列名を取得している。
 * @postcondition 固定列の連続行を返し、列数不正を空の正常表へ畳まない。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、本文の欠落を補完しない。
 * @invariant 最初のHeader／Separatorを要求し、途中の列数不一致はnullで返す。
 * @boundary N/A: 同一Process内のArchitecture本文意味検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function captureArchitectureTable(
  source: DocumentText | undefined,
  expectedHeaders: readonly string[],
): DocumentTableRow[] | null {
  const lines = (source?.text ?? "").split(/\r?\n/u);
  const headerIndex = lines.findIndex((line) => {
    const cells = parseMarkdownTableRow(line);
    return (
      cells?.length === expectedHeaders.length &&
      cells.every((cell, index) => cell === expectedHeaders[index])
    );
  });
  if (
    headerIndex < 0 ||
    !isMarkdownTableSeparator(
      lines[headerIndex + 1] ?? "",
      expectedHeaders.length,
    )
  )
    return null;
  const rows: DocumentTableRow[] = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const cells = parseMarkdownTableRow(lines[index] as string);
    if (!cells) break;
    if (cells.length !== expectedHeaders.length) return null;
    rows.push({
      cells,
      location: {
        path: source?.location.path ?? "",
        line: (source?.location.line ?? 1) + index,
      },
    });
  }
  return rows;
}

/**
 * UI／SPEC観点別のArchitecture分析本文を検査する。
 * @responsibility UI／SPEC観点別のArchitecture分析本文を検査する。
 * @trace ARCH-000008
 * @input artifact: 初回の原文と位置。kind／id: 列挙元の観点と期待ID。options: 方式と別取得のChecklist原文。
 * @returns 捕捉した分析モデルと文書内診断。Ready宣言との比較はSemanticが所有する。
 * @precondition File取得と外部集合・Ready宣言の適用判断は呼出し元が所有する。
 * @postcondition 入力を変更せず、不正本文からも抽出した関係を保持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、本文の欠落を補完しない。
 * @invariant 九観点の語彙・Human Input・入力境界・Ready時OPENFAIL拒否を維持する。
 * @boundary N/A: 同一Process内のArchitecture本文意味検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseArchitectureAnalysis(
  artifact: ArtifactSource,
  kind: "UI" | "SPEC",
  id: string,
  options: Readonly<{
    mode?: "template" | "evaluated";
    checklistSource?: ArtifactSource;
  }> = {},
): ParseResult<ArchitectureAnalysis> &
  Readonly<{ result: ArchitectureAnalysis }> {
  const captured = { path: artifact.path, content: artifact.content };
  const mode = options.mode === undefined ? "evaluated" : options.mode;
  const checklistDocument = captureArchitectureDocument(
    options.checklistSource === undefined ? captured : options.checklistSource,
    { kind: kind === "UI" ? "analysis_ui" : "analysis_spec", mode },
  );
  const checklistError = checklistDocument.checklistContract.failure;
  const visible = {
    path: captured.path,
    content: omitMarkdownCommentsAndFencedCode(captured.content),
  };
  const syntaxTokens = visible.content.split("\n").map((text, index) => ({
    text,
    location: { path: captured.path, line: index + 1 },
  }));
  const contains = (token: string) =>
    syntaxTokens.some(({ text }) => text.includes(token));
  const fields = {
    formalInput: captureArchitectureSections(visible, "## 1. 正式入力"),
    inheritedContract: captureArchitectureSections(
      visible,
      `## 2. Architectureへ引き継ぐ${kind}契約`,
    ),
    design: captureArchitectureSections(
      visible,
      "## 3. Architecture観点の分析",
    ),
    evaluation: captureArchitectureSections(visible, "### 観点別評価"),
    disposition: captureArchitectureSections(visible, "## 4. Architecture処置"),
    integrationQuestions: captureArchitectureSections(
      visible,
      `## 5. ${kind === "UI" ? "SPEC" : "UI"}観点との統合時に確認すること`,
    ),
    checklist: captureArchitectureSections(visible, "## Checklist"),
  };
  const sectionsByHeading = new Map<string, readonly DocumentText[]>([
    ["## 1. 正式入力", fields.formalInput],
    [`## 2. Architectureへ引き継ぐ${kind}契約`, fields.inheritedContract],
    ["## 3. Architecture観点の分析", fields.design],
    ["### 観点別評価", fields.evaluation],
    ["## 4. Architecture処置", fields.disposition],
    [
      `## 5. ${kind === "UI" ? "SPEC" : "UI"}観点との統合時に確認すること`,
      fields.integrationQuestions,
    ],
    ["## Checklist", fields.checklist],
  ]);
  const sectionValue = (heading: string) =>
    sectionsByHeading.get(heading)?.[0]?.text ?? "";

  const issues: DocumentIssue[] = [];
  const inputSection = sectionValue("## 1. 正式入力");
  const expectedInput =
    kind === "UI"
      ? `../../../04_UI/Definitions/${id}/ui_definition.md`
      : `../../../05_SPEC/Definitions/${id}/spec_definition.md`;
  const forbiddenInput =
    kind === "UI"
      ? /01_Discovery|02_UX|03_IA|05_SPEC|40_Develop/u
      : /01_Discovery|02_UX|03_IA|04_UI|40_Develop/u;
  const requiredHeadings =
    kind === "UI"
      ? [
          "## 2. Architectureへ引き継ぐUI契約",
          "## 3. Architecture観点の分析",
          "## 4. Architecture処置",
          "## 5. SPEC観点との統合時に確認すること",
        ]
      : [
          "## 2. Architectureへ引き継ぐSPEC契約",
          "## 3. Architecture観点の分析",
          "## 4. Architecture処置",
          "## 5. UI観点との統合時に確認すること",
        ];
  const evaluation = sectionValue("### 観点別評価");
  const requiredEvaluationRows = [
    "Responsibility",
    "Boundary／Component／Interface",
    "Data／State Ownership",
    "Failure／Recovery",
    "Security／Trust",
    "Quality Constraint",
    "Human Input",
    "Open／Gap",
    "Verification Intent",
  ];
  const capturedEvaluationRows = captureArchitectureTable(
    fields.evaluation[0],
    ["観点", "判定", "根拠・引渡し"],
  );
  const evaluationRows =
    capturedEvaluationRows?.map((row) => [...row.cells]) ?? null;
  const evaluationDecisions: Readonly<Record<string, readonly string[]>> = {
    Responsibility: ["評価済み", "OPEN", "FAIL"],
    "Boundary／Component／Interface": ["評価済み", "OPEN", "FAIL"],
    "Data／State Ownership": ["評価済み", "OPEN", "FAIL"],
    "Failure／Recovery": ["評価済み", "OPEN", "FAIL"],
    "Security／Trust": ["評価済み", "OPEN", "FAIL"],
    "Quality Constraint": ["評価済み", "OPEN", "FAIL"],
    "Human Input": ["なし", "継承あり", "OPEN"],
    "Open／Gap": ["なし", "上流確認を継承", "OPEN", "FAIL"],
    "Verification Intent": ["評価済み", "OPEN", "FAIL"],
  };
  const isEvaluationContractValid =
    evaluationRows !== null &&
    evaluationRows.length === requiredEvaluationRows.length &&
    requiredEvaluationRows.every((name) => {
      const matches = evaluationRows.filter(([row]) => row === name);
      return (
        matches.length === 1 &&
        (evaluationDecisions[name] ?? []).includes(
          (matches[0] as string[])[1] as string,
        ) &&
        ((matches[0] as string[])[2] as string).trim().length > 0
      );
    });
  const checklistBody = sectionValue("## Checklist");
  const hasBlockingChecklistResult = /^- (?:OPEN|FAIL): /mu.test(checklistBody);
  const disposition = sectionValue("## 4. Architecture処置");
  const relations = [
    ...disposition.matchAll(
      /\]\(\.\.\/\.\.\/Definitions\/(ARCH-[0-9]{6})\/architecture_definition\.md\)/gu,
    ),
  ].map((match) => `${id}|${match[1]}`);
  if (
    !contains(`成果物種別: Architecture分析（${kind}観点）`) ||
    !contains(`分析単位: \u0060${id}\u0060`) ||
    !inputSection.includes(expectedInput) ||
    forbiddenInput.test(inputSection) ||
    !requiredHeadings.every((heading) => contains(heading)) ||
    !isEvaluationContractValid ||
    !evaluation.includes("Human Inputの判断者") ||
    relations.length === 0 ||
    new Set(relations).size !== relations.length ||
    checklistError
  )
    issues.push({
      kind: "artifact.architecture.analysis-contract-invalid",
      targetIdentity: id,
      location: { path: artifact.path },
      reason: "analysis-contract-invalid",
      details: { checklistFailure: checklistError },
    });
  const finalIssues =
    mode === "template"
      ? checklistError
        ? [
            {
              kind: "artifact.architecture.analysis-contract-invalid",
              targetIdentity: id,
              location: { path: artifact.path },
              reason: "analysis-contract-invalid",
              details: { checklistFailure: checklistError },
            },
          ]
        : []
      : issues;
  return {
    status: finalIssues.length ? "partial" : "complete",
    result: {
      checklistSource: checklistDocument.source,
      checklistContract: checklistDocument.checklistContract,
      hasUnresolvedResults: hasBlockingChecklistResult,
      artifact: parseMarkdownArtifact(captured),
      source: captured,
      expectedIdentity: id,
      view: kind,
      declarations: syntaxTokens.filter(
        ({ text }) =>
          text.includes("成果物種別: ") || text.includes("分析単位: "),
      ),
      syntaxTokens,
      tableRows: captureDocumentTableRows(visible),
      ...fields,
      evaluationRows: capturedEvaluationRows,
      relations,
    },
    issues: finalIssues,
  };
}
/**
 * Architecture定義の統合責務本文を検査する。
 * @responsibility Architecture定義の統合責務本文を検査する。
 * @trace ARCH-000008
 * @input artifact: 初回の原文と位置。identity: 列挙元ID。options: 方式と別取得のChecklist原文。
 * @returns 定義内容・担当宣言・文書内診断。ひな型は既存の固定条件だけを検査する。
 * @precondition File取得と外部集合・Ready宣言の適用判断は呼出し元が所有する。
 * @postcondition 入力を変更せず、不正本文からも抽出した関係を保持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、本文の欠落を補完しない。
 * @invariant 両分析入力・未確認表の完全被覆・構造・Placeholder・Ready時OPENFAIL条件を維持する。
 * @boundary N/A: 同一Process内のArchitecture本文意味検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseArchitectureDefinition(
  artifact: ArtifactSource,
  identity: string,
  options: Readonly<{
    mode?: "template" | "evaluated";
    checklistSource?: ArtifactSource;
  }> = {},
): ParseResult<ArchitectureDefinition> &
  Readonly<{ result: ArchitectureDefinition }> {
  const captured = { path: artifact.path, content: artifact.content };
  const mode = options.mode === undefined ? "evaluated" : options.mode;
  const checklistDocument = captureArchitectureDocument(
    options.checklistSource === undefined ? captured : options.checklistSource,
    { kind: mode === "template" ? "definition_template" : "definition", mode },
  );
  const checklistError = checklistDocument.checklistContract.failure;
  const visible = {
    path: captured.path,
    content: omitMarkdownCommentsAndFencedCode(captured.content),
  };
  const syntaxTokens = visible.content.split("\n").map((text, index) => ({
    text,
    location: { path: captured.path, line: index + 1 },
  }));
  const contains = (token: string) =>
    syntaxTokens.some(({ text }) => text.includes(token));
  const fields = {
    responsibility: captureArchitectureSections(visible, "## 1. 責務と境界"),
    uiInput: captureArchitectureSections(visible, "## 2. UI観点の入力"),
    specInput: captureArchitectureSections(visible, "## 3. SPEC観点の入力"),
    integration: captureArchitectureSections(visible, "## 4. 両観点の統合判断"),
    structure: captureArchitectureSections(visible, "## 5. 構造と依存方向"),
    data: captureArchitectureSections(visible, "## 6. データ・状態・Interface"),
    failure: captureArchitectureSections(visible, "## 7. 失敗・回復・観測"),
    quality: captureArchitectureSections(visible, "## 8. 品質・保護・運用"),
    unresolved: captureArchitectureSections(
      visible,
      "### 未確認事項・人間判断・戻り条件",
    ),
    compatibility: captureArchitectureSections(
      visible,
      "## 9. 互換性・移行・成立済み能力",
    ),
    handoff: captureArchitectureSections(
      visible,
      "## 10. 実装と検証への引き渡し",
    ),
    observation: captureArchitectureSections(
      visible,
      "## 11. 情報源と現行照合",
    ),
    checklist: captureArchitectureSections(visible, "## Checklist"),
  };
  const sectionsByHeading = new Map<string, readonly DocumentText[]>([
    ["## 1. 責務と境界", fields.responsibility],
    ["## 2. UI観点の入力", fields.uiInput],
    ["## 3. SPEC観点の入力", fields.specInput],
    ["## 4. 両観点の統合判断", fields.integration],
    ["## 5. 構造と依存方向", fields.structure],
    ["## 6. データ・状態・Interface", fields.data],
    ["## 7. 失敗・回復・観測", fields.failure],
    ["## 8. 品質・保護・運用", fields.quality],
    ["### 未確認事項・人間判断・戻り条件", fields.unresolved],
    ["## 9. 互換性・移行・成立済み能力", fields.compatibility],
    ["## 10. 実装と検証への引き渡し", fields.handoff],
    ["## 11. 情報源と現行照合", fields.observation],
    ["## Checklist", fields.checklist],
  ]);
  const sectionValue = (heading: string) =>
    sectionsByHeading.get(heading)?.[0]?.text ?? "";

  const issues: DocumentIssue[] = [];
  const uiSection = sectionValue("## 2. UI観点の入力");
  const specSection = sectionValue("## 3. SPEC観点の入力");
  const relations = [
    ...`${uiSection}\n${specSection}`.matchAll(
      /\[((?:UI|SPEC)-[0-9]{6})\]\(\.\.\/\.\.\/Analysis\/\1\/architecture_analysis\.md\)/gu,
    ),
  ].map((match) => `${match[1]}|${identity}`);
  const requiredHeadings = [
    "## 1. 責務と境界",
    "## 2. UI観点の入力",
    "## 3. SPEC観点の入力",
    "## 4. 両観点の統合判断",
    "## 5. 構造と依存方向",
    "## 6. データ・状態・Interface",
    "## 7. 失敗・回復・観測",
    "## 8. 品質・保護・運用",
    "## 9. 互換性・移行・成立済み能力",
    "## 10. 実装と検証への引き渡し",
    "## 11. 情報源と現行照合",
  ];
  const unknownSection = sectionValue("### 未確認事項・人間判断・戻り条件");
  const definitionInputIds = new Set(
    [uiSection, specSection]
      .flatMap((inputSection) => [
        ...inputSection.matchAll(/\[((?:UI|SPEC)-[0-9]{6})\]\(/gu),
      ])
      .map((match) => match[1] as string),
  );
  const capturedUnknownRows = captureArchitectureTable(fields.unresolved[0], [
    "入力",
    "継承する未確認事項",
    "判断者",
    "現在判定",
    "再評価契機",
  ]);
  const unknownRows = capturedUnknownRows?.map((row) => [...row.cells]) ?? null;
  const unknownInputIds = unknownRows?.map((cells) => cells[0] as string) ?? [];
  const isUnknownContractValid =
    unknownRows !== null &&
    unknownRows.length === definitionInputIds.size &&
    unknownRows.every(
      (cells) =>
        cells.every((cell) => cell.trim().length > 0) &&
        definitionInputIds.has(cells[0] as string),
    ) &&
    new Set(unknownInputIds).size === unknownInputIds.length &&
    [...definitionInputIds].every((id) => unknownInputIds.includes(id));
  const checklistBody = sectionValue("## Checklist");
  const hasBlockingChecklistResult = /^- (?:OPEN|FAIL): /mu.test(checklistBody);
  const requiredStructures = [
    "| 状態Owner |",
    "| 所有する責務 |",
    "| 所有しない責務 |",
    "| 主な外部境界 |",
    "| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |",
    "| 入力 | State Owner | Authority | Effect／非該当 |",
    "| 入力 | 保護する失敗境界 | 検証意図 |",
    "| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |",
  ];
  const hasPlaceholderOnlySection = requiredHeadings.some((heading) => {
    const body = sectionValue(heading).trim();
    const firstParagraph = body.split(/\n\s*\n/u)[0]?.trim() ?? "";
    return /^(?:責務|統合|構造|状態|失敗|品質|移行|引渡し|照合)[。.]?$/u.test(
      firstParagraph,
    );
  });
  if (
    !contains("成果物種別: Architecture定義") ||
    !contains(`Architecture ID: \u0060${identity}\u0060`) ||
    !requiredHeadings.every((heading) => contains(heading)) ||
    !requiredStructures.every((fragment) => contains(fragment)) ||
    !isUnknownContractValid ||
    !unknownSection.includes("Architecture固有の追加人間判断") ||
    hasPlaceholderOnlySection ||
    !/UI-[0-9]{6}/u.test(uiSection) ||
    !/SPEC-[0-9]{6}/u.test(specSection) ||
    checklistError
  )
    issues.push({
      kind: "artifact.architecture.definition-contract-invalid",
      targetIdentity: identity,
      location: { path: artifact.path },
      reason: "definition-contract-invalid",
      details: { checklistFailure: checklistError },
    });
  const templateContract =
    mode === "template"
      ? captureArchitectureDetailTemplate(captured, "definition")
      : null;
  const finalIssues =
    mode === "template"
      ? [
          ...(templateContract?.issues ?? []),
          ...(checklistError
            ? [
                {
                  kind: "artifact.architecture.definition-contract-invalid",
                  targetIdentity: identity,
                  location: { path: artifact.path },
                  reason: "definition-contract-invalid",
                  details: { checklistFailure: checklistError },
                },
              ]
            : []),
        ]
      : issues;
  return {
    status: finalIssues.length ? "partial" : "complete",
    result: {
      assignment: captureArchitectureDetailAssignment(
        captured,
        identity,
        "definition",
      ),
      templateContract: templateContract?.result ?? null,
      checklistSource: checklistDocument.source,
      checklistContract: checklistDocument.checklistContract,
      hasUnresolvedResults: hasBlockingChecklistResult,
      artifact: parseMarkdownArtifact(captured),
      source: captured,
      expectedIdentity: identity,
      declarations: syntaxTokens.filter(
        ({ text }) =>
          text.includes("成果物種別: ") || text.includes("Architecture ID: "),
      ),
      syntaxTokens,
      tableRows: captureDocumentTableRows(visible),
      ...fields,
      unknownRows: capturedUnknownRows,
      relations,
    },
    issues: finalIssues,
  };
}
/**
 * Architecture Detailひな型の内容と必須表現の出現を保持する。
 * @responsibility 原文と可視評価を区別し、部分内容・重複・出典を残す。
 * @trace ARCH-000008
 * @invariant validは二種類のひな型の固定表現だけを評価し、品質全体を保証しない。
 */
export type ArchitectureDetailTemplate = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  kind: "definition" | "area";
  tableRows: readonly DocumentTableRow[];
  visibleContent: string;
  requirements: readonly Readonly<{
    text: string;
    occurrences: readonly DocumentText[];
  }>[];
  valid: boolean;
}>;

/**
 * ArchitectureのDefinition／Areaひな型を内容モデルとして受け付ける。
 * @responsibility 元の可視化とsubstring条件を同じ順序で評価し、局所Issueを分ける。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。kind: 定義または領域。
 * @returns 原文・Artifact・全表・必須表現出現の内容モデルと既存Issue。
 * @precondition 対象Fileの選択・読取りは呼出し元が所有する。
 * @postcondition 不足時も内容を保持し、原文を変更しない。
 * @effect N/A: 同期的な値処理のみ。
 * @failure 未知kindは拒否し、解析例外は伝播する。
 * @invariant 完全見出し一致・節限定・表列検査を追加しない。
 * @boundary 取得済み本文とArchitectureひな型モデルの境界。
 * @security 実在・認可・品質Gateを発行しない。
 * @concurrency N/A: 局所値のみ。
 */
export function captureArchitectureDetailTemplate(
  source: ArtifactSource,
  kind: ArchitectureDetailTemplate["kind"],
): ParseResult<ArchitectureDetailTemplate> & {
  result: ArchitectureDetailTemplate;
} {
  if (kind !== "definition" && kind !== "area")
    throw new Error("unknown_architecture_detail_template_kind");
  const captured = { path: source.path, content: source.content };
  const visibleContent = omitMarkdownCommentsAndFencedCode(captured.content);
  const requiredTexts =
    kind === "definition"
      ? [
          "### 4.1 UI／SPEC Detailの配置制約",
          "| Detail Source | Source Definition | SCR／PRT／Interaction／BHV | Relation／N:N | Coverage | 未解決Gap／戻し先 |",
        ]
      : [
          "## 上流UI／SPEC Detailとの関係",
          "| Detail Source | UI／SPEC Definition | この領域が担当するSCR／PRT／Interaction／BHV | Relation状態 | 未解決Gap／戻し先 |",
        ];
  const requirements = requiredTexts.map((text) => {
    const occurrences: DocumentText[] = [];
    let offset = visibleContent.indexOf(text);
    while (offset >= 0) {
      occurrences.push({
        text,
        location: {
          path: captured.path,
          line: visibleContent.slice(0, offset).split("\n").length,
        },
      });
      offset = visibleContent.indexOf(text, offset + 1);
    }
    return { text, occurrences };
  });
  const valid = requirements.every(
    (requirement) => requirement.occurrences.length > 0,
  );
  const reason =
    kind === "definition"
      ? "detail-relation-contract-missing"
      : "detail-owner-mapping-missing";
  return {
    status: valid ? "complete" : "partial",
    result: {
      artifact: parseMarkdownArtifact(captured),
      source: captured,
      kind,
      tableRows: captureDocumentTableRows(captured),
      visibleContent,
      requirements,
      valid,
    },
    issues: valid
      ? []
      : [
          {
            kind: `artifact.architecture.${reason}`,
            targetIdentity: captured.path,
            location: { path: captured.path },
            reason,
            details: {},
          },
        ],
  };
}

/**
 * 横断モデル登録の検査結果と、取得対象の順序を表す。
 * @responsibility 登録節の不在と固定五文書の取得対象を区別する。
 * @trace ARCH-000008
 * @shape 原文・出典・登録節と固定取得対象files。
 * @invariant 登録節が空なら取得対象は空、存在すれば固定五文書順。
 * @boundary N/A: 可視本文から導く値モデル。
 * @security Fileの実在・認可・Ready成立を保証しない。
 * @compatibility 既存の空Section時の観測停止を維持する。
 */
export type ArchitectureIndex = Readonly<{
  registry: ArchitectureRegistryModel;
  diagramContract: ReturnType<typeof parseDiagramDisposition>;
  artifact: ArtifactModel;
  source: ArtifactSource;
  sections: readonly DocumentText[];
  tableRows: readonly DocumentTableRow[];
  files: readonly string[];
}>;

/**
 * 横断文書の明示内容と、可視／構造表現の出典を保持する。
 * @responsibility 五種類の技術文書を固定識別し、本文と診断を分離する。
 * @trace ARCH-000008
 */
export type ArchitectureCrossModel = Readonly<{
  componentDefinitionEntries: readonly string[];
  artifact: ArtifactModel;
  source: ArtifactSource;
  file: string;
  visibleLines: readonly DocumentText[];
  structureSections: ReadonlyMap<string, readonly DocumentText[]>;
  tableRows: readonly DocumentTableRow[];
}>;

/**
 * 横断モデルの固定文書と要求構造を定義する。
 * @responsibility 現行Architecture五文書の見出しと構造断片を所有する。
 * @trace ARCH-000008
 */
const architectureCrossModels: ReadonlyArray<{
  file: string;
  headings: readonly string[];
  sectionStructures: ReadonlyArray<readonly [string, readonly string[]]>;
}> = [
  {
    file: "02_Component_and_Responsibility_Model.md",
    headings: [
      "## 2. 全体ブロック図",
      "## 3. Component責務表",
      "## 5. QAへ渡す検証単位",
    ],
    sectionStructures: [
      ["## 2. 全体ブロック図", ["```text"]],
      [
        "## 3. Component責務表",
        [
          "| Component | 含むArchitecture定義 | 状態Owner | 所有すること | 所有しないこと |",
        ],
      ],
    ],
  },
  {
    file: "03_Boundary_and_Interface_Model.md",
    headings: [
      "## 2. 境界表",
      "## 3. 型とPortの関係",
      "## 4. 主要なブロック間シーケンス",
      "## 6. Qualityへの引渡し",
    ],
    sectionStructures: [
      [
        "## 2. 境界表",
        ["| 境界 | 呼出し側 | 受け側 | 越えるもの | 越えないもの | 不明時 |"],
      ],
      ["## 3. 型とPortの関係", ["```text"]],
      [
        "## 5. Schema責務",
        ["| 情報 | Canonical Owner | Writer | Reader | 所有禁止 |"],
      ],
    ],
  },
  {
    file: "04_Runtime_and_Data_Flow_Model.md",
    headings: [
      "## 2. 主要データフロー",
      "## 3. 横断状態遷移",
      "## 4. 概念Entity関係",
      "## 6. Qualityへの引渡し",
    ],
    sectionStructures: [
      ["## 2. 主要データフロー", ["<<E", "(P", "[(D"]],
      [
        "## 3. 横断状態遷移",
        [
          "[S",
          "| 現在状態 | 契機 | 事前条件 | 処置 | Effect | 次状態 | 失敗時 | cleanup・Recovery | 終了後観測 |",
        ],
      ],
      ["## 4. 概念Entity関係", ["[ER"]],
      ["## 5. 整合条件", ["| 対象 | 必須の相関 | 禁止する畳み込み |"]],
    ],
  },
  {
    file: "05_Failure_Recovery_and_Resilience_Model.md",
    headings: [
      "## 2. 故障と回復の全体図",
      "## 3. Failure Matrix",
      "## 4. 回復の不変条件",
      "## 6. Qualityへの引渡し",
    ],
    sectionStructures: [
      ["## 2. 故障と回復の全体図", ["```text"]],
      [
        "## 3. Failure Matrix",
        ["| 故障領域 | 対象Component | 守る対象 | 即時処置 | 回復／終了条件 |"],
      ],
    ],
  },
  {
    file: "06_Deployment_and_Execution_Model.md",
    headings: [
      "## 2. 論理配置図",
      "## 3. 実行単位とResource",
      "## 4. 段階的な結合単位",
      "## 5. Reality Auditへの引渡し",
      "## 6. Qualityへの引渡し",
    ],
    sectionStructures: [
      ["## 2. 論理配置図", ["```text"]],
      [
        "## 3. 実行単位とResource",
        ["| 論理単位 | 主なResource | 並行性の境界 | 終了条件 |"],
      ],
      ["## 4. 段階的な結合単位", ["| 段階 | 主な目的 | 対象境界 |"]],
      [
        "## 5. Reality Auditへの引渡し",
        ["| 照合対象 | 確認すること | 参照先 |"],
      ],
    ],
  },
];

/**
 * Architectureの固定横断文書名を内部の関係評価へ渡す。
 * @responsibility 要求構造と期待文書名を同じ正本から導出する。
 * @trace ARCH-000008
 * @invariant 取得済み・実在・品質成立を表すCatalogではない。
 */
export const architectureCrossModelFiles: readonly string[] = Object.freeze(
  architectureCrossModels.map((model) => model.file),
);

/**
 * Architecture横断モデルの登録節を検査する。
 * @responsibility 空SectionのIssueと、存在時だけの固定取得順を返す。
 * @trace ARCH-000008
 * @input artifact: 取得済み登録本文と位置。
 * @returns 固定文書名列と中立Issue。
 * @precondition 原文は呼出し元が取得している。
 * @postcondition 空Sectionでは取得対象を返さない。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播する。
 * @invariant Ready状態にかかわらず同じ条件を使用する。
 * @boundary N/A: 取得済み文書モデル。
 * @security 実在確認やFile読取りを行わない。
 * @concurrency N/A: 共有可変状態なし。
 */
export function parseArchitectureIndex(
  artifact: ArtifactSource,
): ParseResult<ArchitectureIndex> & Readonly<{ result: ArchitectureIndex }> {
  const source = { path: artifact.path, content: artifact.content };
  const visible = {
    path: source.path,
    content: omitMarkdownCommentsAndFencedCode(source.content),
  };
  const sections = captureArchitectureSections(
    visible,
    "## Architecture横断モデル",
  );
  const files = sections[0]?.text.trim().length
    ? architectureCrossModels.map((model) => model.file)
    : [];
  const result = {
    registry: captureArchitectureRegistry(source),
    diagramContract: parseDiagramDisposition(source, [
      "全体／内部ブロック図",
      "状態遷移表／状態遷移図",
      "ブロック間シーケンス図",
      "クラス／型関係図",
      "データフロー図（DFD）",
      "エンティティ関係図（ER図）",
      "スキーマ責務図（Schema Responsibility Map）",
    ]),
    artifact: parseMarkdownArtifact(source),
    source,
    sections,
    tableRows: captureDocumentTableRows(visible),
    files,
  };
  const issues: DocumentIssue[] = files.length
    ? []
    : [
        {
          kind: "artifact.architecture.cross-model-section-missing",
          targetIdentity: artifact.path,
          location: { path: artifact.path },
          reason: "cross-model-section-missing",
          details: {},
        },
      ];
  if (
    result.registry.definitionEntries.length !==
    result.registry.definitions.size
  )
    issues.push({
      kind: "artifact.architecture.definition-index-coverage-mismatch",
      targetIdentity: artifact.path,
      location: { path: artifact.path },
      reason: "definition-index-coverage-mismatch",
      details: {},
    });
  return {
    status: issues.length ? "partial" : "complete",
    result,
    issues,
  };
}

/**
 * 横断モデル文書の登録・見出し・構造断片を検査する。
 * @responsibility 可視本文とFence保持本文を既存の異なる条件で検査する。
 * @trace ARCH-000008
 * @input artifact: 取得済み原文と位置。file: 固定文書の種類。
 * @returns 内容・構造と文書内診断。登録Indexとの照合はSemanticで行う。
 * @precondition File取得と外部集合・Ready宣言の適用判断は呼出し元が所有する。
 * @postcondition 入力を変更せず既存の部分文字列条件だけを評価する。
 * @effect N/A: 同期的な値検査。
 * @failure 未知の固定文書名と解析例外を拒否する。
 * @invariant 必須見出しと構造Sectionの集合を相互補完しない。
 * @boundary N/A: 取得済み文書モデル。
 * @security 実在・認可・図の構文妥当性を保証しない。
 * @concurrency N/A: 共有可変状態なし。
 */
export function parseArchitectureCrossModel(
  artifact: ArtifactSource,
  file: string,
): ParseResult<ArchitectureCrossModel> &
  Readonly<{ result: ArchitectureCrossModel }> {
  const model = architectureCrossModels.find(
    (candidate) => candidate.file === file,
  );
  if (!model) throw new Error("unknown_architecture_cross_model");
  const source = { path: artifact.path, content: artifact.content };
  const visible = {
    path: source.path,
    content: omitMarkdownCommentsAndFencedCode(source.content),
  };
  const structure = {
    path: source.path,
    content: omitMarkdownCommentsOutsideFencedCode(source.content),
  };
  const result: ArchitectureCrossModel = {
    componentDefinitionEntries: Array.from(
      (
        captureArchitectureSections(visible, "## 3. Component責務表")[0]
          ?.text ?? ""
      ).matchAll(
        /\]\(Definitions\/(ARCH-[0-9]{6})\/architecture_definition\.md\)/gu,
      ),
      (match) => match[1] as string,
    ),
    artifact: parseMarkdownArtifact(source),
    source,
    file,
    visibleLines: visible.content.split("\n").map((text, offset) => ({
      text,
      location: { path: source.path, line: offset + 1 },
    })),
    structureSections: new Map(
      model.sectionStructures.map(([heading]) => [
        heading,
        captureArchitectureSections(structure, heading),
      ]),
    ),
    tableRows: captureDocumentTableRows(visible),
  };
  const valid =
    model.headings.every((heading) => visible.content.includes(heading)) &&
    model.sectionStructures.every(([heading, structures]) => {
      const body = result.structureSections.get(heading)?.[0]?.text ?? "";
      return structures.every((structure) => body.includes(structure));
    });
  return {
    status: valid ? "complete" : "partial",
    result,
    issues: valid
      ? []
      : [
          {
            kind: "artifact.architecture.cross-model-contract-invalid",
            targetIdentity: file,
            location: { path: artifact.path },
            reason: "cross-model-contract-invalid",
            details: {},
          },
        ],
  };
}

/**
 * Architectureの定義・領域が明示する担当を保持する。
 * @responsibility 定義と領域の種別・期待Identity、本文宣言、担当出現と所属を区別する。
 * @trace ARCH-000008
 * @shape artifact、source、kind、expectedIdentity、tableRows、declarations、architectureDeclaration、各担当集合。
 * @invariant 原文・出典・出現を保持し、担当宣言を実在・認可・品質成立にしない。
 */
export type ArchitectureDetailAssignment<
  K extends "definition" | "area" = "definition" | "area",
> = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  expectedIdentity: string;
  declarations: readonly DocumentText[];
  uiIds: ReadonlySet<string>;
  specIds: ReadonlySet<string>;
  relations: readonly string[];
  hasDuplicateRelations: boolean;
  kind: K;
  architectureIds: ReadonlySet<string>;
  architectureDeclaration: DocumentText | null;
}>;
/**
 * 取得済みArchitecture定義又は領域の担当モデルを構築する。
 * @responsibility 可視本文の既存文法と部分情報を原文・出典へ結合する。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。期待Identityや種別は列挙元が確定する。
 * @returns 担当内容のモデル。入力を変更せず欠測を補完しない。
 * @effect N/A: 同一Processの純粋な値構築。Reader・診断・保存を追加しない。
 */
export function captureArchitectureDetailAssignment<
  K extends "definition" | "area",
>(
  source: ArtifactSource,
  expectedIdentity: string,
  kind: K,
): ArchitectureDetailAssignment<K> {
  if (kind !== "definition" && kind !== "area")
    throw new TypeError("architecture_detail_assignment_kind_invalid");
  const captured = { path: source.path, content: source.content };
  const content = omitMarkdownCommentsAndFencedCode(captured.content);
  const artifact = parseMarkdownArtifact(captured);
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
  const ownerLine = content
    .split(/\r?\n/u)
    .find((line) =>
      line.includes("[UI／SPEC Detail Architecture Traceability]"),
    );
  const architectureIds = new Set(
    [...(ownerLine ?? "").matchAll(/ARCH-[0-9]{6}/gu)].map((match) => match[0]),
  );
  const ownerIndex = content
    .split(/\r?\n/u)
    .findIndex((line) =>
      line.includes("[UI／SPEC Detail Architecture Traceability]"),
    );
  const architectureDeclaration =
    ownerIndex < 0
      ? null
      : {
          text: ownerLine ?? "",
          location: { path: captured.path, line: ownerIndex + 1, column: 1 },
        };
  return {
    artifact,
    source: captured,
    tableRows,
    expectedIdentity,
    kind,
    declarations,
    uiIds,
    specIds,
    relations,
    hasDuplicateRelations,
    architectureIds,
    architectureDeclaration,
  };
}
