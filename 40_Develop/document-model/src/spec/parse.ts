/**
 * SPEC文書を明示内容と出典のモデルへ構築する。
 * @responsibility SPEC文書と対応根拠の内容・出典・部分情報を捕捉し、対応する局所検査へ接続する。
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
  isMarkdownTableSeparator,
  omitMarkdownCommentsAndFencedCode,
  parseMarkdownTableRow,
} from "../artifact/markdown.ts";
import { parseMarkdownArtifact } from "../artifact/parse-markdown.ts";
import { parseDiagramDisposition } from "../artifact/phase-diagrams.ts";
import type {
  ArtifactSource,
  DocumentIssue,
  DocumentTableRow,
  DocumentText,
  ParseResult,
} from "../artifact/types.ts";
import type {
  SpecAnalysis,
  SpecBehavior,
  SpecChecklistRequest,
  SpecDefinition,
  SpecDefinitionCorrespondence,
  SpecDetailCorrespondence,
  SpecDetailIndex,
  SpecDocument,
  SpecIndex,
} from "./types.ts";
import {
  specChecklistIssues,
  specChecklistItems,
  validateSpecAnalysis,
  validateSpecDefinition,
  validateSpecDetailIndex,
  validateSpecIndex,
} from "./validation.ts";

/**
 * SPEC文書の内容とChecklist検査を一つの受付で完了する。
 * @responsibility 原文・出典・可視Checklistを捕捉し、固有条件を共通構文へ接続する。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。request: 明示する種別と方式。
 * @returns 部分内容も保持した文書モデルと元のChecklist失敗理由。
 * @precondition File観測・適用判断は呼出し元が所有する。
 * @postcondition 同じ捕捉本文を評価し、追加read・診断・保存を行わない。
 * @effect N/A: 同期的な局所値処理のみ。
 * @failure 未知kind／modeを拒否し、解析例外は伝播する。
 * @invariant 旧期待列で共通構文エンジンを一回だけ呼び、元の理由を保持する。
 * @boundary 取得済み原文とSPEC内容モデルの境界。
 * @security 構造成立を品質Pass・認可へ読み替えない。
 * @concurrency N/A: 入力・別受付を変更しない。
 */
function captureSpecDocument(
  source: ArtifactSource,
  request: SpecChecklistRequest,
  checklistContent = source.content,
): SpecDocument {
  const captured = { path: source.path, content: source.content };
  if (request.mode !== "template" && request.mode !== "evaluated")
    throw new Error("unknown_spec_checklist_mode");
  const expectedItems = specChecklistItems(request.kind);
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
 * 取得済みSPEC定義を局所診断付きのモデルとして返す。
 * @responsibility 期待IDと本文宣言、欠測と空本文、重複を区別して保持する。
 * @trace ARCH-000008
 * @input source: 取得済み本文とPath。expectedIdentity: 列挙元の期待ID。
 * @returns 診断なしはcomplete、局所違反があっても取得できたモデルはpartial。
 * @effect N/A: Filesystem観測や外部Effectを発行しない。
 * @failure 解析例外は伝播し、違反によって抽出済み参照を捨てない。
 * @security 宣言内容を実在、認可、検証済みの証明へ読み替えない。
 */
export function parseSpecDefinition(
  source: ArtifactSource,
  expectedIdentity: string,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<SpecDefinition> & Readonly<{ result: SpecDefinition }> {
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
    purpose: captureDocumentSections(visible, "振る舞いの目的"),
    uxAnalysis: captureDocumentSections(visible, "UX観点の分析結果"),
    iaAnalysis: captureDocumentSections(visible, "IA観点の分析結果"),
    formalInputs: captureDocumentSections(visible, "正式入力と変換根拠"),
    integration: captureDocumentSections(visible, "両観点の統合判断"),
    conditions: captureDocumentSections(visible, "契機・事前条件・Authority"),
    behavior: captureDocumentSections(visible, "振る舞い・状態・結果"),
    recovery: captureDocumentSections(visible, "失敗・回復・副作用"),
    acceptance: captureDocumentSections(visible, "受入条件と検証義務"),
    interfaces: captureDocumentSections(visible, "対応するUI"),
    constraints: captureDocumentSections(visible, "制約"),
    unresolved: captureDocumentSections(
      visible,
      "未確認事項・人間判断・戻り条件",
    ),
    verification: captureDocumentSections(visible, "検証意図"),
  };

  const uiBody = sections.interfaces[0]?.body ?? null;
  const pairMatch = uiBody?.text.match(/^- pairs_with:\s*(.+)$/mu);
  const value = pairMatch?.[1]?.trim() ?? "";
  const interfaceDisposition =
    pairMatch && uiBody
      ? {
          text: value,
          location: {
            ...uiBody.location,
            line:
              uiBody.location.line +
              uiBody.text
                .slice(
                  0,
                  (pairMatch.index ?? 0) +
                    pairMatch[0].length -
                    (pairMatch[1]?.length ?? 0) +
                    (pairMatch[1]?.indexOf(value) ?? 0),
                )
                .split("\n").length -
              1,
          },
        }
      : null;
  const analysisInputs = [
    ...captureDocumentReferences(
      sections.uxAnalysis[0]?.body ?? null,
      /\[((?:UX|IA)-[0-9]{6})\]\(\.\.\/\.\.\/Analysis\/\1\/spec_analysis\.md\)/gu,
    ),
    ...captureDocumentReferences(
      sections.iaAnalysis[0]?.body ?? null,
      /\[((?:UX|IA)-[0-9]{6})\]\(\.\.\/\.\.\/Analysis\/\1\/spec_analysis\.md\)/gu,
    ),
  ];
  const pairedInterfaces = captureDocumentReferences(
    interfaceDisposition,
    /\[(UI-[0-9]{6})\]\(\.\.\/\.\.\/\.\.\/04_UI\/Definitions\/\1\/ui_definition\.md\)/gu,
  );

  const correspondenceSections = new Map<string, DocumentText>();
  for (const heading of [
    "## 正式入力と変換根拠",
    "## 振る舞い・状態・結果",
    "## 契機・事前条件・Authority",
    "## 失敗・回復・副作用",
    "## 受入条件と検証義務",
    "## 制約",
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
  const titleMatch = visible.content.match(/^#\s+SPEC-[0-9]{6}\s+(.+)$/mu);
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
  const base = captureSpecDocument(
    captured,
    {
      kind: "definition",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    },
    visible.content,
  );
  const model: SpecDefinition = {
    ...base,
    correspondenceTitle,
    correspondenceSections,
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    expectedIdentity,
    declarations: lines.filter(({ text }) => text.includes("SPEC ID: ")),
    syntaxTokens: lines.filter(
      ({ text }) =>
        text.includes("## ") ||
        text.includes("成果物種別: ") ||
        text.includes("SPEC ID: "),
    ),
    ...sections,
    analysisInputs,
    pairedInterfaces,
    interfaceDisposition,
  };
  const issues: DocumentIssue[] =
    options.mode === "template" ? [] : [...validateSpecDefinition(model)];
  const checklistFailure = base.checklistContract.failure;
  if (checklistFailure)
    issues.push({
      kind: "artifact.spec.definition-checklist-invalid",
      targetIdentity: expectedIdentity,
      location: { path: captured.path },
      reason: "definition-checklist-invalid",
      details: { checklistFailure },
    });
  const finalIssues =
    options.mode === "template" ? specChecklistIssues(model) : issues;
  return {
    status: finalIssues.length === 0 ? "complete" : "partial",
    result: model,
    issues: finalIssues,
  };
}

/**
 * 取得済みSPEC分析を観点別モデルと局所診断へ構築する。
 * @responsibility 正式入力・分析内容・処置を一度捕捉し、不正本文の部分情報も残す。
 * @trace ARCH-000008
 * @input source: 取得済み本文。expectedIdentity: 列挙元のUX/IA ID。
 * @returns 局所違反なしはcomplete、取得済みモデルと違反がある場合はpartial。
 * @effect N/A: 既読文字列だけを扱い、他文書を取得しない。
 * @failure 解析例外を伝播し、未確認の内容を補完しない。
 * @security completeは全工程の品質や人間の承認を表さない。
 */
export function parseSpecAnalysis(
  source: ArtifactSource,
  expectedIdentity: string,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<SpecAnalysis> & Readonly<{ result: SpecAnalysis }> {
  const captured = { path: source.path, content: source.content };
  const visible = {
    path: captured.path,
    content: omitMarkdownCommentsAndFencedCode(captured.content),
  };
  const view = expectedIdentity.startsWith("UX-") ? "ux" : "ia";
  const base = captureSpecDocument(
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
  const dispositions = captureDocumentSections(
    visible,
    view === "ux" ? "5. SPEC処置" : "6. SPEC処置",
  );
  const targets = captureDocumentReferences(
    dispositions[0]?.body ?? null,
    /\[(SPEC-[0-9]{6})[^\]]*\]\(\.\.\/\.\.\/Definitions\/\1\/spec_definition\.md\)/gu,
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
        : "7. UX観点との統合時に確認すること",
    ),
    unresolved: captureDocumentSections(
      visible,
      "未確認事項・人間判断・戻り条件",
    ),
    verification: captureDocumentSections(visible, "検証意図"),
  };
  const model: SpecAnalysis =
    view === "ux"
      ? {
          ...common,
          view: "ux",
          outcomes: captureDocumentSections(
            visible,
            "2. 振る舞いへ引き継ぐ利用者成果",
          ),
          observations: captureDocumentSections(
            visible,
            "3. 観測可能にする契機・結果・失敗",
          ),
          acceptance: captureDocumentSections(visible, "4. 受入条件と適用範囲"),
        }
      : {
          ...common,
          view: "ia",
          usageMeanings: captureDocumentSections(
            visible,
            "2. 利用場面ごとに保持する意味",
          ),
          objectsAndRelations: captureDocumentSections(
            visible,
            "3. 対象・識別・関係",
          ),
          statesAndVisibility: captureDocumentSections(
            visible,
            "4. 状態・可視性・時間的意味",
          ),
          responsibilitiesAndFailure: captureDocumentSections(
            visible,
            "5. 導線・責任・失敗時の保持",
          ),
        };
  const issues: DocumentIssue[] =
    options.mode === "template" ? [] : [...validateSpecAnalysis(model)];
  const checklistFailure = base.checklistContract.failure;
  if (checklistFailure)
    issues.push({
      kind: "artifact.spec.analysis-checklist-invalid",
      targetIdentity: expectedIdentity,
      location: { path: captured.path },
      reason: "analysis-checklist-invalid",
      details: { checklistFailure },
    });
  const finalIssues =
    options.mode === "template" ? specChecklistIssues(model) : issues;
  return {
    status: finalIssues.length === 0 ? "complete" : "partial",
    result: model,
    issues: finalIssues,
  };
}

/**
 * SPEC登録台帳を出典付きの行モデルと局所診断へ構築する。
 * @responsibility 厳密な登録行の受理と全表行の保持を分け、重複を消さない。
 * @trace ARCH-000008
 * @input source: 取得済み台帳本文とPath。
 * @returns 取得済みモデルを必ず保持し、局所違反はpartialで返す。
 * @effect N/A: 文字列だけを扱い実在や品質成立を発行しない。
 * @failure 解析例外を伝播し、認識できない行を登録へ補完しない。
 */
export function parseSpecIndex(
  source: ArtifactSource,
): ParseResult<SpecIndex> & Readonly<{ result: SpecIndex }> {
  const captured = { path: source.path, content: source.content };
  const visible = {
    path: captured.path,
    content: omitMarkdownCommentsAndFencedCode(captured.content),
  };
  const lines = visible.content.split("\n");
  const tableRows = captureDocumentTableRows(visible);
  const entries: SpecIndex["entries"][number][] = [];
  for (const row of tableRows) {
    const match = (lines[row.location.line - 1] ?? "").match(
      /^\| \[(SPEC-[0-9]{6})\]\(Definitions\/\1\/spec_definition\.md\) \| (?<name>[^|]+) \| (?<ux>[^|]+) \| (?<ia>[^|]+) \| (?<ui>[^|]+) \|$/u,
    );
    if (!match?.groups) continue;
    const identity = match[1] ?? "";
    entries.push({
      identity,
      name: match.groups.name ?? "",
      definitionTarget: `Definitions/${identity}/spec_definition.md`,
      uxIds: [...(match.groups.ux ?? "").matchAll(/UX-[0-9]{6}/gu)].map(
        (item) => item[0],
      ),
      iaIds: [...(match.groups.ia ?? "").matchAll(/IA-[0-9]{6}/gu)].map(
        (item) => item[0],
      ),
      uiIds: [...(match.groups.ui ?? "").matchAll(/UI-[0-9]{6}/gu)].map(
        (item) => item[0],
      ),
      cells: row.cells,
      location: row.location,
    });
  }

  const counts: SpecIndex["counts"][number][] = [];
  const headerIndex = lines.findIndex((line) => {
    const cells = parseMarkdownTableRow(line);
    return (
      cells?.length === 3 &&
      cells.every(
        (cell, index) => cell === ["入力／成果", "件数", "現在の処置"][index],
      )
    );
  });
  if (
    headerIndex >= 0 &&
    isMarkdownTableSeparator(lines[headerIndex + 1] ?? "", 3)
  ) {
    for (let index = headerIndex + 2; index < lines.length; index += 1) {
      const cells = parseMarkdownTableRow(lines[index] ?? "");
      if (cells === null || cells.length !== 3) break;
      counts.push({
        inputOrArtifact: cells[0] ?? "",
        count: cells[1] ?? "",
        disposition: cells[2] ?? "",
        cells,
        location: { path: captured.path, line: index + 1 },
      });
    }
  }

  const model: SpecIndex = {
    diagramContract: parseDiagramDisposition(captured, [
      "Use Case／振る舞いFlow",
      "状態遷移表／状態遷移図",
      "Actor／System間Sequence図",
      "Error／Effect分岐図",
      "UI／SPEC対応図",
    ]),
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    tableRows,
    entries,
    counts,
  };
  const issues = validateSpecIndex(model);
  return {
    status: issues.length === 0 ? "complete" : "partial",
    result: model,
    issues,
  };
}

/**
 * SPEC Detail統合台帳の内容と抽出可能な対応を捕捉する。
 * @responsibility 不正行も出典付きで残し、最後の抽出成立行だけで対応Mapを更新する。
 * @trace ARCH-000008
 * @input source: 取得済み台帳本文とPath。
 * @returns 原文と出典を保持した内容モデルをresult、文書内の診断をissuesへ返す。
 * @effect N/A: 同一Processの値構築のみ。
 * @failure 欠測をnullへ区別し、解析例外を伝播する。
 */
export function parseSpecDetailIndex(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<SpecDetailIndex> & Readonly<{ result: SpecDetailIndex }> {
  const captured = { path: source.path, content: source.content };
  const visible = {
    path: captured.path,
    content: omitMarkdownCommentsAndFencedCode(captured.content),
  };
  const tableRows = captureDocumentTableRows(visible);
  const entries = tableRows
    .filter((row) => /^SPEC-[0-9]{6}$/u.test(row.cells[0] ?? ""))
    .map((row) => ({
      identity: row.cells[0] ?? "",
      definition: row.cells[1] ?? null,
      applicability: row.cells[2] ?? null,
      behaviorReference: row.cells[3] ?? null,
      reason: row.cells[4] ?? null,
      behaviorId: row.cells[3]?.match(/BHV-[0-9]{6}/u)?.[0] ?? null,
      cells: row.cells,
      location: row.location,
    }));
  const behaviors = new Map<string, string>();
  for (const entry of entries)
    if (entry.behaviorId) behaviors.set(entry.identity, entry.behaviorId);
  const model: SpecDetailIndex = {
    ...captureSpecDocument(
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
    behaviors,
  };
  const issues = [
    ...(options.mode === "template" ? [] : validateSpecDetailIndex(model)),
    ...specChecklistIssues(model),
  ];
  return {
    status: issues.length ? "partial" : "complete",
    result: model,
    issues,
  };
}

/**
 * Detail対応根拠を両方向被覆・関係・Gapのモデルへ構築する。
 * @responsibility 完全な対応行の旧抽出条件と、全表行・原文の保持を分ける。
 * @trace ARCH-000008
 * @input source: 取得済みの対応根拠本文とPath。
 * @returns 原文と出典を保持した内容モデルをresult、文書内の診断をissuesへ返す。
 * @effect N/A: 他文書の取得や結果出版を行わない。
 * @failure 不完全行は原文と全表行へ残し、参照を補完しない。
 */
export function parseSpecDetailCorrespondence(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<SpecDetailCorrespondence> &
  Readonly<{ result: SpecDetailCorrespondence }> {
  const captured = { path: source.path, content: source.content };
  const visible = {
    path: captured.path,
    content: omitMarkdownCommentsAndFencedCode(captured.content),
  };
  const tableRows = captureDocumentTableRows(visible);
  const relations = tableRows.flatMap((row) => {
    const screenId = row.cells[0]?.match(/SCR-[0-9]{6}/u)?.[0];
    const interactionKey = row.cells[0]?.match(
      /PRT-[0-9]{6}\.spec-[0-9]{6}/u,
    )?.[0];
    const behaviorId = row.cells[1]?.match(/BHV-[0-9]{6}/u)?.[0];
    const uiId = row.cells[2]?.match(/UI-[0-9]{6}/u)?.[0];
    const specId = row.cells[3]?.match(/SPEC-[0-9]{6}/u)?.[0];
    return screenId && interactionKey && behaviorId && uiId && specId
      ? [
          {
            screenId,
            interactionKey,
            behaviorId,
            uiId,
            specId,
            cells: row.cells,
            location: row.location,
          },
        ]
      : [];
  });
  const model: SpecDetailCorrespondence = {
    ...captureSpecDocument(
      captured,
      {
        kind: "detail_correspondence",
        mode: options.mode === undefined ? "evaluated" : options.mode,
      },
      visible.content,
    ),
    source: captured,
    tableRows,
    relations,
    scope: ["1. 対象範囲", "1. 対象と判定境界"]
      .flatMap((heading) => captureDocumentSections(visible, heading))
      .sort((a, b) => a.heading.location.line - b.heading.location.line),
    uiCoverage: captureDocumentSections(visible, "2. UIからBHVへのCoverage"),
    behaviorCoverage: captureDocumentSections(
      visible,
      "3. BHVからUIへのCoverage",
    ),
    relationSections: captureDocumentSections(visible, "4. N:N Relation"),
    gaps: ["4. Definitionへ戻すGap", "5. Gap／戻り条件"]
      .flatMap((heading) => captureDocumentSections(visible, heading))
      .sort((a, b) => a.heading.location.line - b.heading.location.line),
    handoff: [
      "5. Architecture／Qualityへの引き渡し",
      "6. Architecture／Qualityへの引き渡し",
    ]
      .flatMap((heading) => captureDocumentSections(visible, heading))
      .sort((a, b) => a.heading.location.line - b.heading.location.line),
    syntaxTokens: visible.content
      .split("\n")
      .flatMap((text, index) =>
        [
          "状態: Pass",
          "Definition対応とDetail対応を分けた",
          "UIからBHVへのCoverageを全件評価した",
          "BHVからUIへのCoverageを全件評価した",
        ].some((token) => text.includes(token))
          ? [{ text, location: { path: captured.path, line: index + 1 } }]
          : [],
      ),
  };
  const issues = [...specChecklistIssues(model)];
  return {
    status: issues.length ? "partial" : "complete",
    result: model,
    issues,
  };
}

/**
 * 対応根拠の最初の表を既存列条件で抽出する。
 * @responsibility 対応根拠の最初の表を既存列条件で抽出する。
 * @trace ARCH-000008
 * @input content: 可視本文。headers: 列名。
 * @returns 一致する連続表行。
 * @precondition 対象本文は呼出し元が取得済みで、指定した本文は可視化済み。
 * @postcondition 入力を変更せず既存の出現順と短絡条件を維持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、不足する本文やCellを補完しない。
 * @invariant 最初のHeaderと直後のSeparatorを要求し、列数が変われば打ち切る。
 * @boundary N/A: 同一Process内の定義対応根拠検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function correspondenceTableRows(
  content: DocumentText,
  headers: readonly string[],
): DocumentTableRow[] {
  const lines = content.text.split(/\r?\n/u);
  const headerIndex = lines.findIndex((line) => {
    const cells = parseMarkdownTableRow(line);
    return (
      cells !== null &&
      cells.length === headers.length &&
      cells.every((cell, index) => cell === headers[index])
    );
  });
  if (
    headerIndex < 0 ||
    !isMarkdownTableSeparator(lines[headerIndex + 1] ?? "", headers.length)
  )
    return [];
  const rows: DocumentTableRow[] = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const cells = parseMarkdownTableRow(lines[index] as string);
    if (cells === null || cells.length !== headers.length) break;
    rows.push({
      cells,
      location: {
        path: content.location.path,
        line: (content.location.line ?? 1) + index,
      },
    });
  }
  return rows;
}

/**
 * 定義対応文書の原文・正規行・根拠表・改訂を出典付きで構築する。
 * @responsibility 比較前の全明示内容を保持し、短Cellの評価や品質判定は行わない。
 * @trace ARCH-000008
 * @input source: 取得済み本文と相対Path。
 * @returns 原文と出典を保持した内容モデルをresult、文書内の診断をissuesへ返す。
 * @effect N/A: 追加Reader・保存・診断を発行しない。
 */
export function parseSpecDefinitionCorrespondence(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<SpecDefinitionCorrespondence> &
  Readonly<{ result: SpecDefinitionCorrespondence }> {
  const captured = { path: source.path, content: source.content };
  const visible = {
    path: captured.path,
    content: omitMarkdownCommentsAndFencedCode(captured.content),
  };
  const lines = visible.content.split(/\r?\n/u);
  const revisionRows = correspondenceTableRows(
    { text: visible.content, location: { path: captured.path, line: 1 } },
    ["項目", "対象"],
  );
  const revision =
    revisionRows.find((row) => row.cells[0] === "対象改訂版")?.cells[1] ?? "";
  const recordedFingerprint = revision.match(
    /UI／SPEC Definition集合 SHA-256: ([0-9a-f]{64})/u,
  )?.[1];
  const pairs: SpecDefinitionCorrespondence["pairs"][number][] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const row = line.match(
      /^\| \[(UI-[0-9]{6})\]\(\.\.\/04_UI\/Definitions\/\1\/ui_definition\.md\) \| \[(SPEC-[0-9]{6})\]\(Definitions\/\2\/spec_definition\.md\) \|/u,
    );
    if (!row) continue;
    const uiId = row[1] as string,
      specId = row[2] as string;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const heading = `### ${uiId}／${specId}`;
    const escaped = heading.replace(/[.*+?^$()|[\]{}\\]/gu, "\\$&");
    const match = visible.content.match(
      new RegExp(`^${escaped}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "mu"),
    );
    const start = match
      ? (match.index ?? 0) + match[0].length - (match[1]?.length ?? 0)
      : 0;
    const evidenceSection = match
      ? {
          text: match[1] ?? "",
          location: {
            path: captured.path,
            line: visible.content.slice(0, start).split("\n").length,
          },
        }
      : null;
    const evidenceRows = correspondenceTableRows(
      evidenceSection ?? {
        text: "",
        location: { path: captured.path, line: 1 },
      },
      ["観点", "UI側の根拠", "SPEC側の根拠", "判定", "理由"],
    );
    pairs.push({
      uiId,
      specId,
      cells,
      location: { path: captured.path, line: index + 1 },
      evidenceSection,
      evidenceRows,
    });
  }
  const model: SpecDefinitionCorrespondence = {
    ...captureSpecDocument(
      captured,
      {
        kind: "correspondence",
        mode: options.mode === undefined ? "evaluated" : options.mode,
      },
      visible.content,
    ),
    source: captured,
    tableRows: captureDocumentTableRows(visible),
    revisionRows,
    recordedFingerprint,
    pairs,
    syntaxTokens: lines.map((text, index) => ({
      text,
      location: { path: captured.path, line: index + 1 },
    })),
  };
  const issues = [...specChecklistIssues(model)];
  return {
    status: issues.length ? "partial" : "complete",
    result: model,
    issues,
  };
}

/**
 * SpecBehavior文書の取得済み内容・出典とChecklist診断を返す。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export function parseSpecBehavior(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<SpecBehavior> & Readonly<{ result: SpecBehavior }> {
  const captured = { path: source.path, content: source.content };
  const model: SpecBehavior = {
    ...captureSpecDocument(captured, {
      kind: "behavior",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    sections: [
      "1. 目的とSource Definition",
      "2. Detailed Behavior",
      "3. Behavior Flow",
      "4. UI Detail対応",
      "5. Verification Intent",
      "6. Architectureへの引き渡し",
      "7. 未確認事項・戻り条件",
    ].flatMap((heading) => captureDocumentSections(captured, heading)),
    declarations: captured.content.split(/\r?\n/u).map((text, index) => ({
      text,
      location: { path: captured.path, line: index + 1 },
    })),
  };
  const issues = specChecklistIssues(model);
  return {
    status: issues.length ? "partial" : "complete",
    result: model,
    issues,
  };
}
