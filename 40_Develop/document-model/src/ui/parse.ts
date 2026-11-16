/**
 * UI文書を明示内容と出典のモデルへ構築する。
 * @responsibility UI文書の内容・出典・部分情報を捕捉し、対応する局所検査へ接続する。
 * @trace ARCH-000008
 */

import {
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
} from "../artifact/checklist.ts";
import {
  captureDocumentReferences,
  captureDocumentSections,
  captureDocumentTableRows,
  omitMarkdownCommentsAndFencedCode,
} from "../artifact/markdown.ts";
import { parseMarkdownArtifact } from "../artifact/parse-markdown.ts";
import { parseDiagramDisposition } from "../artifact/phase-diagrams.ts";
import type {
  ArtifactSource,
  DocumentIssue,
  DocumentText,
  ParseResult,
} from "../artifact/types.ts";
import type {
  UiAnalysis,
  UiArea,
  UiChecklistRequest,
  UiComponent,
  UiDefinition,
  UiDetailIndex,
  UiDocument,
  UiHandoff,
  UiIndex,
  UiScreen,
  UiVisualBaseline,
} from "./types.ts";
import {
  uiChecklistIssues,
  uiChecklistItems,
  validateUiAnalysis,
  validateUiDefinition,
  validateUiDetailIndex,
  validateUiIndex,
} from "./validation.ts";

/**
 * UI文書の内容とChecklist検査を一つの受付で完了する。
 * @responsibility 原文・出典・可視Checklistを捕捉し、固有条件を共通構文へ接続する。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。request: 明示する種別と方式。
 * @returns 部分内容も保持した文書モデルと元のChecklist失敗理由。
 * @precondition File観測・適用判断は呼出し元が所有する。
 * @postcondition 同じ捕捉本文を評価し、追加read・診断・保存を行わない。
 * @effect N/A: 同期的な局所値処理のみ。
 * @failure 未知kind／modeを拒否し、解析例外は伝播する。
 * @invariant 旧期待列で共通構文エンジンを一回だけ呼び、元の理由を保持する。
 * @boundary 取得済み原文とUI内容モデルの境界。
 * @security 構造成立を品質Pass・認可へ読み替えない。
 * @concurrency N/A: 入力・別受付を変更しない。
 */
function captureUiDocument(
  source: ArtifactSource,
  request: UiChecklistRequest,
  checklistContent = source.content,
): UiDocument {
  const captured = { path: source.path, content: source.content };
  if (request.mode !== "template" && request.mode !== "evaluated")
    throw new Error("unknown_ui_checklist_mode");
  const expectedItems = uiChecklistItems(request.kind);
  const failure =
    request.mode === "template"
      ? inspectTemplateChecklist(checklistContent, expectedItems)
      : inspectEvaluatedChecklist(checklistContent, expectedItems);
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
 * 取得済みUI定義を局所診断付きのモデルとして返す。
 * @responsibility 期待IDと本文宣言、欠測と空本文、重複を区別して保持する。
 * @trace ARCH-000008
 * @input source: 取得済み本文とPath。expectedIdentity: 列挙元の期待ID。
 * @returns 診断なしはcomplete、局所違反があっても取得できたモデルはpartial。
 * @effect N/A: Filesystem観測や外部Effectを発行しない。
 * @failure 解析例外は伝播し、違反によって抽出済み参照を捨てない。
 * @security 宣言内容を実在、認可、検証済みの証明へ読み替えない。
 */
export function parseUiDefinition(
  source: ArtifactSource,
  expectedIdentity: string,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<UiDefinition> & Readonly<{ result: UiDefinition }> {
  const captured = { path: source.path, content: source.content };
  const visible = {
    path: captured.path,
    content: omitMarkdownCommentsAndFencedCode(captured.content),
  };
  const lines = visible.content.split("\n").map((text, index) => ({
    text,
    location: { path: captured.path, line: index + 1 },
  }));
  const sections = {
    outcome: captureDocumentSections(visible, "利用者成果"),
    uxAnalysis: captureDocumentSections(visible, "UX観点の分析結果"),
    iaAnalysis: captureDocumentSections(visible, "IA観点の分析結果"),
    formalInputs: captureDocumentSections(visible, "正式入力と変換根拠"),
    integration: captureDocumentSections(visible, "両観点の統合判断"),
    presentation: captureDocumentSections(visible, "表示面と情報の優先順位"),
    interaction: captureDocumentSections(visible, "操作とFeedback"),
    states: captureDocumentSections(visible, "状態と表示差"),
    accessibility: captureDocumentSections(
      visible,
      "視覚表現とアクセシビリティ",
    ),
    constraints: captureDocumentSections(visible, "制約"),
    specificationReview: captureDocumentSections(
      visible,
      "UI／SPEC対応レビューへ渡す項目",
    ),
    specifications: captureDocumentSections(visible, "対応するSPEC"),
    unresolved: captureDocumentSections(
      visible,
      "未確認事項・人間判断・戻り条件",
    ),
    verification: captureDocumentSections(visible, "検証意図"),
  };

  const uxBody =
    sections.uxAnalysis.length === 1
      ? (sections.uxAnalysis[0]?.body ?? null)
      : null;
  const iaBody =
    sections.iaAnalysis.length === 1
      ? (sections.iaAnalysis[0]?.body ?? null)
      : null;
  const pairBody = sections.specifications[0]?.body ?? null;
  const pairMatch = pairBody?.text.match(/^- pairs_with:\s*(.+)$/mu);
  const pairLine = pairMatch?.[1] ?? "";
  const pairText = pairBody
    ? {
        text: pairLine,
        location: {
          ...pairBody.location,
          line:
            pairBody.location.line +
            pairBody.text
              .slice(
                0,
                (pairMatch?.index ?? 0) +
                  (pairMatch
                    ? pairMatch[0].length - (pairMatch[1]?.length ?? 0)
                    : 0),
              )
              .split("\n").length -
            1,
        },
      }
    : null;
  const analysisInputs = {
    ux: captureDocumentReferences(
      uxBody,
      /\[(UX-[0-9]{6})\]\(\.\.\/\.\.\/Analysis\/\1\/ui_analysis\.md\)/gu,
    ),
    ia: captureDocumentReferences(
      iaBody,
      /\[(IA-[0-9]{6})\]\(\.\.\/\.\.\/Analysis\/\1\/ui_analysis\.md\)/gu,
    ),
  };
  const pairedSpecifications = captureDocumentReferences(
    pairText,
    /\[(SPEC-[0-9]{6})\]\(\.\.\/\.\.\/\.\.\/05_SPEC\/Definitions\/\1\/spec_definition\.md\)/gu,
  );

  const correspondenceSections = new Map<string, DocumentText>();
  for (const heading of [
    "## 正式入力と変換根拠",
    "## 状態と表示差",
    "## 操作とFeedback",
    "## 制約",
    "## 表示面と情報の優先順位",
  ]) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const match = visible.content.match(
      new RegExp(`^${escaped}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "mu"),
    );
    if (match) {
      const start =
        (match.index ?? 0) + match[0].length - (match[1]?.length ?? 0);
      correspondenceSections.set(heading, {
        text: match[1] ?? "",
        location: {
          path: captured.path,
          line: visible.content.slice(0, start).split("\n").length,
        },
      });
    }
  }
  const titleMatch = visible.content.match(/^#\s+UI-[0-9]{6}\s+(.+)$/mu);
  const correspondenceTitle = titleMatch
    ? {
        text: (titleMatch[1] ?? "").trim(),
        location: {
          path: captured.path,
          line: visible.content
            .slice(
              0,
              (titleMatch.index ?? 0) +
                titleMatch[0].lastIndexOf(titleMatch[1] ?? ""),
            )
            .split("\n").length,
        },
      }
    : null;
  const base = captureUiDocument(
    captured,
    {
      kind: "definition",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    },
    visible.content,
  );
  const model: UiDefinition = {
    ...base,
    correspondenceTitle,
    correspondenceSections,
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    expectedIdentity,
    declarations: lines.filter(({ text }) => text.includes("UI ID: ")),
    syntaxTokens: lines.filter(
      ({ text }) =>
        text.includes("## ") ||
        text.includes("成果物種別: ") ||
        text.includes("UI ID: "),
    ),
    ...sections,
    analysisInputs,
    pairedSpecifications,
  };
  const issues: DocumentIssue[] =
    options.mode === "template" ? [] : [...validateUiDefinition(model)];
  const checklistFailure = base.checklistContract.failure;
  if (checklistFailure)
    issues.push({
      kind: "artifact.ui.definition-checklist-invalid",
      targetIdentity: captured.path,
      location: { path: captured.path },
      reason: "definition-checklist-invalid",
      details: { checklistFailure },
    });
  const finalIssues =
    options.mode === "template" ? uiChecklistIssues(model) : issues;
  return {
    status: finalIssues.length === 0 ? "complete" : "partial",
    result: model,
    issues: finalIssues,
  };
}

/**
 * 取得済みUI分析を観点別モデルと局所診断へ構築する。
 * @responsibility 正式入力・分析内容・処置を一度捕捉し、不正本文の部分情報も残す。
 * @trace ARCH-000008
 * @input source: 取得済み本文。expectedIdentity: 列挙元のUX/IA ID。
 * @returns 局所違反なしはcomplete、取得済みモデルと違反がある場合はpartial。
 * @effect N/A: 既読文字列だけを扱い、他文書を取得しない。
 * @failure 解析例外を伝播し、未確認の内容を補完しない。
 * @security completeは全工程の品質や人間の承認を表さない。
 */
export function parseUiAnalysis(
  source: ArtifactSource,
  expectedIdentity: string,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<UiAnalysis> & Readonly<{ result: UiAnalysis }> {
  const captured = { path: source.path, content: source.content };
  const visible = {
    path: captured.path,
    content: omitMarkdownCommentsAndFencedCode(captured.content),
  };
  const view = expectedIdentity.startsWith("UX-") ? "ux" : "ia";
  const base = captureUiDocument(
    captured,
    {
      kind: view === "ux" ? "analysis_ux" : "analysis_ia",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    },
    visible.content,
  );
  const lines = visible.content.split("\n").map((text, index) => ({
    text,
    location: { path: captured.path, line: index + 1 },
  }));
  const dispositions = captureDocumentSections(visible, "5. UI処置");
  const targets = captureDocumentReferences(
    dispositions.length === 1 ? (dispositions[0]?.body ?? null) : null,
    /\[(UI-[0-9]{6})[^\]]*\]\(\.\.\/\.\.\/Definitions\/\1\/ui_definition\.md\)/gu,
  );
  const common = {
    ...base,
    source: captured,
    artifact: parseMarkdownArtifact(captured),
    expectedIdentity,
    declarations: lines.filter(({ text }) => text.includes("分析単位: ")),
    syntaxTokens: lines.filter(
      ({ text }) =>
        text.includes("## ") ||
        text.includes("成果物種別: ") ||
        text.includes("分析単位: "),
    ),
    formalInputs: captureDocumentSections(visible, "1. 正式入力"),
    dispositions,
    targets,
    integrationQuestions: captureDocumentSections(
      visible,
      view === "ux"
        ? "6. IA観点との統合時に確認すること"
        : "6. UX観点との統合時に確認すること",
    ),
    unresolved: captureDocumentSections(
      visible,
      "未確認事項・人間判断・戻り条件",
    ),
    verification: captureDocumentSections(visible, "検証意図"),
  };
  const model: UiAnalysis =
    view === "ux"
      ? {
          ...common,
          view: "ux",
          outcomes: captureDocumentSections(
            visible,
            "2. UIへ引き継ぐ利用者成果",
          ),
          recognition: captureDocumentSections(
            visible,
            "3. 必要な認識・操作・Feedback",
          ),
          experience: captureDocumentSections(visible, "4. 状況による体験差"),
        }
      : {
          ...common,
          view: "ia",
          informationStructure: captureDocumentSections(
            visible,
            "2. UIへ引き継ぐ情報構造",
          ),
          priorities: captureDocumentSections(
            visible,
            "3. 表示の優先順位とNavigation",
          ),
          visibility: captureDocumentSections(visible, "4. 表示差と開示境界"),
        };
  const issues: DocumentIssue[] =
    options.mode === "template" ? [] : [...validateUiAnalysis(model)];
  const checklistFailure = base.checklistContract.failure;
  if (checklistFailure)
    issues.push({
      kind: "artifact.ui.analysis-checklist-invalid",
      targetIdentity: captured.path,
      location: { path: captured.path },
      reason: "analysis-checklist-invalid",
      details: { checklistFailure },
    });
  const finalIssues =
    options.mode === "template" ? uiChecklistIssues(model) : issues;
  return {
    status: finalIssues.length === 0 ? "complete" : "partial",
    result: model,
    issues: finalIssues,
  };
}

/**
 * UI登録台帳を出典付きの行モデルと局所診断へ構築する。
 * @responsibility 厳密な登録行の受理と全表行の保持を分け、重複を消さない。
 * @trace ARCH-000008
 * @input source: 取得済み台帳本文とPath。
 * @returns 取得済みモデルを必ず保持し、局所違反はpartialで返す。
 * @effect N/A: 文字列だけを扱い実在や品質成立を発行しない。
 * @failure 解析例外を伝播し、認識できない行を登録へ補完しない。
 */
export function parseUiIndex(
  source: ArtifactSource,
): ParseResult<UiIndex> & Readonly<{ result: UiIndex }> {
  const captured = { path: source.path, content: source.content };
  const visible = {
    path: captured.path,
    content: omitMarkdownCommentsAndFencedCode(captured.content),
  };
  const lines = visible.content.split("\n");
  const tableRows = captureDocumentTableRows(visible);
  const entries: UiIndex["entries"][number][] = [];
  for (const row of tableRows) {
    const match = (lines[row.location.line - 1] ?? "").match(
      /^\| \[(UI-[0-9]{6})\]\(Definitions\/\1\/ui_definition\.md\) \| (?<name>[^|]+) \| (?<ux>[^|]+) \| (?<ia>[^|]+) \|$/u,
    );
    if (!match?.groups) continue;
    const identity = match[1] ?? "";
    entries.push({
      identity,
      name: match.groups.name ?? "",
      definitionTarget: `Definitions/${identity}/ui_definition.md`,
      uxIds: [...(match.groups.ux ?? "").matchAll(/UX-[0-9]{6}/gu)].map(
        (item) => item[0],
      ),
      iaIds: [...(match.groups.ia ?? "").matchAll(/IA-[0-9]{6}/gu)].map(
        (item) => item[0],
      ),
      cells: row.cells,
      location: row.location,
    });
  }

  const model: UiIndex = {
    diagramContract: parseDiagramDisposition(captured, [
      "論理画面／領域構成図",
      "画面／操作Flow",
      "表示状態／Variant図",
      "主要Component関係図",
      "UI／SPEC対応図",
    ]),
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    tableRows,
    entries,
  };
  const issues = validateUiIndex(model);
  return {
    status: issues.length === 0 ? "complete" : "partial",
    result: model,
    issues,
  };
}

/**
 * UI Detail統合台帳の内容と抽出可能な対応を捕捉する。
 * @responsibility 不正行も出典付きで残し、最後の抽出成立行だけで対応Mapを更新する。
 * @trace ARCH-000008
 * @input source: 取得済み台帳本文とPath。
 * @returns 原文と出典を保持した内容モデルをresult、文書内の診断をissuesへ返す。
 * @effect N/A: 同一Processの値構築のみ。
 * @failure 欠測をnullへ区別し、解析例外を伝播する。
 */
export function parseUiDetailIndex(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<UiDetailIndex> & Readonly<{ result: UiDetailIndex }> {
  const captured = { path: source.path, content: source.content };
  const visible = {
    path: captured.path,
    content: omitMarkdownCommentsAndFencedCode(captured.content),
  };
  const tableRows = captureDocumentTableRows(visible);
  const entries = tableRows
    .filter((row) => /^UI-[0-9]{6}$/u.test(row.cells[0] ?? ""))
    .map((row) => ({
      identity: row.cells[0] ?? "",
      definition: row.cells[1] ?? null,
      applicability: row.cells[2] ?? null,
      area: row.cells[3] ?? null,
      detailReference: row.cells[4] ?? null,
      reason: row.cells[5] ?? null,
      screenId: row.cells[4]?.match(/SCR-[0-9]{6}/u)?.[0] ?? null,
      partId: row.cells[4]?.match(/PRT-[0-9]{6}/u)?.[0] ?? null,
      cells: row.cells,
      location: row.location,
    }));
  const bindings = new Map<string, Readonly<{ scr: string; prt: string }>>();
  for (const entry of entries)
    if (entry.screenId && entry.partId)
      bindings.set(entry.identity, { scr: entry.screenId, prt: entry.partId });
  const model: UiDetailIndex = {
    ...captureUiDocument(
      captured,
      {
        kind: "detail_index",
        mode: options.mode === undefined ? "evaluated" : options.mode,
      },
      visible.content,
    ),
    source: captured,
    tableRows,
    entries,
    declarations: visible.content
      .split("\n")
      .flatMap((text, index) =>
        text.includes("状態:")
          ? [{ text, location: { path: captured.path, line: index + 1 } }]
          : [],
      ),
    bindings,
  };
  const issues = [
    ...(options.mode === "template" ? [] : validateUiDetailIndex(model)),
    ...uiChecklistIssues(model),
  ];
  return {
    status: issues.length ? "partial" : "complete",
    result: model,
    issues,
  };
}

/**
 * 取得済みScreenをPartとInteractionを含む文書モデルへ構築する。
 * @responsibility 全節・表行と既存対応抽出の出現を保持し、別のPart文書を仮定しない。
 * @trace ARCH-000008
 * @input source: 取得済みScreen。expectedIdentity: 列挙元のScreen ID。
 * @returns 原文と出典を保持した内容モデルをresult、文書内の診断をissuesへ返す。
 * @effect N/A: 文字列の捕捉だけを行う。
 * @failure 欠測を補完せず、解析例外を伝播する。
 */
export function parseUiScreen(
  source: ArtifactSource,
  expectedIdentity: string,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<UiScreen> & Readonly<{ result: UiScreen }> {
  const captured = { path: source.path, content: source.content };
  const visible = {
    path: captured.path,
    content: omitMarkdownCommentsAndFencedCode(captured.content),
  };
  const tableRows = captureDocumentTableRows(visible);
  const composition = captureDocumentSections(visible, "2. Screen Composition");
  const target = visible.content.match(
    /対象UI Definition:\s*\[?(UI-[0-9]{6})/u,
  );
  const targetUi = target?.[1]
    ? {
        identity: target[1],
        location: {
          path: captured.path,
          line: visible.content
            .slice(0, (target.index ?? 0) + target[0].length - target[1].length)
            .split("\n").length,
        },
      }
    : null;
  const parts = composition.flatMap((section) =>
    section.tableRows
      .filter((row) => /^PRT-[0-9]{6}$/u.test(row.cells[0] ?? ""))
      .map((row) => ({
        identity: row.cells[0] ?? "",
        responsibility: row.cells[1] ?? null,
        information: row.cells[2] ?? null,
        operation: row.cells[3] ?? null,
        stateOrVariant: row.cells[4] ?? null,
        cells: row.cells,
        location: row.location,
      })),
  );
  const relationRows = tableRows.flatMap((row) => {
    const interactionKey = row.cells[0]?.match(
      /PRT-[0-9]{6}\.spec-[0-9]{6}/u,
    )?.[0];
    const behaviorId = row.cells[4]?.match(/BHV-[0-9]{6}/u)?.[0];
    return interactionKey && behaviorId
      ? [
          {
            interactionKey,
            behaviorId,
            cells: row.cells,
            location: row.location,
          },
        ]
      : [];
  });
  const model: UiScreen = {
    ...captureUiDocument(
      captured,
      {
        kind: "screen",
        mode: options.mode === undefined ? "evaluated" : options.mode,
      },
      visible.content,
    ),
    source: captured,
    expectedIdentity,
    targetUi,
    declarations: visible.content
      .split("\n")
      .flatMap((text, index) =>
        text.includes("Screen ID:") ||
        text.includes("対象UI Definition:") ||
        text.includes("状態:")
          ? [{ text, location: { path: captured.path, line: index + 1 } }]
          : [],
      ),
    purpose: captureDocumentSections(
      visible,
      "1. Screenの目的と入口・終了条件",
    ),
    composition,
    interactions: captureDocumentSections(visible, "3. InteractionとBHV対応"),
    states: captureDocumentSections(visible, "4. State／Variant"),
    accessibility: captureDocumentSections(visible, "5. VisualとAccessibility"),
    promotion: captureDocumentSections(visible, "6. Pattern／CMP昇格判断"),
    unresolved: captureDocumentSections(visible, "7. 未確認事項・戻り条件"),
    tableRows,
    parts,
    relationRows,
  };
  const issues = [...uiChecklistIssues(model)];
  return {
    status: issues.length ? "partial" : "complete",
    result: model,
    issues,
  };
}

/**
 * UiArea文書の取得済み内容・出典とChecklist診断を返す。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export function parseUiArea(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<UiArea> & Readonly<{ result: UiArea }> {
  const captured = { path: source.path, content: source.content };
  const model: UiArea = {
    ...captureUiDocument(captured, {
      kind: "area",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    sections: [
      "1. Areaの目的と利用者成果",
      "2. 情報構造と優先順位",
      "3. Screen InventoryとFlow",
      "4. Area共通のComposition",
      "5. Interaction原則",
      "6. 状態・失敗・回復の表現",
      "7. Visual Baselineの適用とArea固有差分",
      "8. PatternとReusable Component",
      "9. Accessibility",
      "10. 避ける表現",
      "11. 未確認事項・人間判断・戻り条件",
    ].flatMap((heading) => captureDocumentSections(captured, heading)),
    declarations: captured.content.split(/\r?\n/u).map((text, index) => ({
      text,
      location: { path: captured.path, line: index + 1 },
    })),
  };
  const issues = uiChecklistIssues(model);
  return {
    status: issues.length ? "partial" : "complete",
    result: model,
    issues,
  };
}

/**
 * UiComponent文書の取得済み内容・出典とChecklist診断を返す。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export function parseUiComponent(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<UiComponent> & Readonly<{ result: UiComponent }> {
  const captured = { path: source.path, content: source.content };
  const model: UiComponent = {
    ...captureUiDocument(captured, {
      kind: "component",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    sections: [
      "1. 昇格理由",
      "2. Contract",
      "3. 利用規則と禁止事項",
      "4. UI／SPEC Detail対応",
      "5. 未確認事項・戻り条件",
    ].flatMap((heading) => captureDocumentSections(captured, heading)),
    declarations: captured.content.split(/\r?\n/u).map((text, index) => ({
      text,
      location: { path: captured.path, line: index + 1 },
    })),
  };
  const issues = uiChecklistIssues(model);
  return {
    status: issues.length ? "partial" : "complete",
    result: model,
    issues,
  };
}

/**
 * UiVisualBaseline文書の取得済み内容・出典とChecklist診断を返す。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export function parseUiVisualBaseline(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<UiVisualBaseline> & Readonly<{ result: UiVisualBaseline }> {
  const captured = { path: source.path, content: source.content };
  const model: UiVisualBaseline = {
    ...captureUiDocument(captured, {
      kind: "visual_baseline",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    sections: [
      "1. Productの表現意図",
      "2. Hero Screen選定",
      "3. Visual Direction比較",
      "4. Human Direction Decision",
      "5. Baseline",
      "6. SourceとRendered View",
      "7. Secondary Screenでの検証",
      "8. 未確認事項・戻り条件",
    ].flatMap((heading) => captureDocumentSections(captured, heading)),
    declarations: captured.content.split(/\r?\n/u).map((text, index) => ({
      text,
      location: { path: captured.path, line: index + 1 },
    })),
  };
  const issues = uiChecklistIssues(model);
  return {
    status: issues.length ? "partial" : "complete",
    result: model,
    issues,
  };
}

/**
 * UiHandoff文書の取得済み内容・出典とChecklist診断を返す。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export function parseUiHandoff(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<UiHandoff> & Readonly<{ result: UiHandoff }> {
  const captured = { path: source.path, content: source.content };
  const model: UiHandoff = {
    ...captureUiDocument(captured, {
      kind: "handoff",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    sections: [
      "1. 共通の正式入力",
      "2. 責任分担",
      "3. UI側の引き渡し",
      "4. 未確認事項・戻り条件",
      "5. 補足分析",
    ].flatMap((heading) => captureDocumentSections(captured, heading)),
    declarations: captured.content.split(/\r?\n/u).map((text, index) => ({
      text,
      location: { path: captured.path, line: index + 1 },
    })),
  };
  const issues = uiChecklistIssues(model);
  return {
    status: issues.length ? "partial" : "complete",
    result: model,
    issues,
  };
}
