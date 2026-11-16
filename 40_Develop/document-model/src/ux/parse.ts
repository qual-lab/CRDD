/**
 * Uxの文書別完成Parseを提供する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
import { omitMarkdownFencedCode } from "../artifact/anchors.ts";
import {
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
} from "../artifact/checklist.ts";
import {
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
import { parseUxHandoff } from "./handoff.ts";
import { parseUxFormalInputTargets } from "./inputs.ts";
import type {
  UxAnalysisModel,
  UxChecklistRequest,
  UxDefinitionModel,
  UxDocument,
  UxExperienceMap,
  UxIndexModel,
  UxPersonas,
  UxProjectionModel,
  UxQualityExpectations,
  UxServiceBlueprint,
} from "./types.ts";
import { uxChecklistIssues, uxChecklistItems } from "./validation.ts";

/**
 * UX文書の内容とChecklist検査を一つの受付で完了する。
 * @responsibility 原文・出典・可視Checklistを捕捉し、UX固有条件を共通構文へ接続する。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。request: 明示する種別と方式。
 * @returns 部分内容も保持した文書モデルと元のChecklist失敗理由。
 * @precondition File観測・適用判断は呼出し元が所有する。
 * @postcondition 同じ捕捉本文を評価し、追加read・診断・保存を行わない。
 * @effect N/A: 同期的な局所値処理のみ。
 * @failure 未知kind／modeを拒否し、解析例外は伝播する。
 * @invariant 旧期待列で共通構文エンジンを一回だけ呼び、元の失敗理由を保持する。
 * @boundary 取得済み原文とUX内容モデルの境界。
 * @security 構造成立から体験品質・認可を発行しない。
 * @concurrency N/A: 入力・別受付の値を変更しない。
 */
function captureUxDocument(
  source: ArtifactSource,
  request: UxChecklistRequest,
  checklistContent = source.content,
): UxDocument {
  const captured = { path: source.path, content: source.content };
  if (request.mode !== "template" && request.mode !== "evaluated")
    throw new Error("unknown_ux_checklist_mode");
  const expectedItems = uxChecklistItems(request.kind);
  const failure =
    request.mode === "template"
      ? inspectTemplateChecklist(checklistContent, expectedItems)
      : inspectEvaluatedChecklist(checklistContent, expectedItems);
  return {
    diagramContract:
      request.mode === "template" && request.kind === "index"
        ? parseDiagramDisposition(captured, [
            "利用の流れ",
            "重要場面・失敗／回復体験図",
            "サービス提供の流れ",
          ])
        : null,
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
 * 横断文書の可視投影節・ID全出現・集合・出典を捕捉する。
 * @responsibility 文書内の内容捕捉を外部集合との比較から分離する。
 * @trace ARCH-000008
 * @input artifact: 投影原文と相対Path。heading: 先頭substringの選択文字列。
 * @returns 選択節・ID全出現・集合と出典を持つ内容モデル。
 * @precondition 呼出し元が本文と対象見出しを選択している。
 * @postcondition 次の第二階層見出しより前の可視本文だけを捕捉する。
 * @effect N/A: 文字列と局所集合だけを扱う同期的な内容捕捉。
 * @failure 文字列操作の例外は伝播する。
 * @invariant indexOfの先頭選択・終端条件を維持し、重複IDを列から失わない。
 * @boundary 既読本文の限定節。外部集合比較とIssue生成はSemanticが所有する。
 * @security 捕捉できた集合を被覆・品質の成立としない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function captureUxProjection(
  artifact: ArtifactSource,
  heading: string,
): UxProjectionModel {
  const captured = { path: artifact.path, content: artifact.content };
  const source = omitMarkdownCommentsAndFencedCode(captured.content);
  const start = source.indexOf(heading);
  const tail = start < 0 ? "" : source.slice(start + heading.length);
  const next = tail.search(/^## /mu);
  const projection = next < 0 ? tail : tail.slice(0, next);
  const projectedIds = [
    ...projection.matchAll(/^\| \[(UX-[0-9]{6})\]\(/gmu),
  ].map((match) => match[1] as string);
  const projectedSet = new Set(projectedIds);
  const result = {
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    heading,
    selectedSection:
      start < 0
        ? null
        : {
            text: projection,
            location: {
              path: captured.path,
              line: source.slice(0, start + heading.length).split("\n").length,
            },
          },
    tableRows: captureDocumentTableRows({
      path: captured.path,
      content: source,
    }),
    projectedKeys: projectedIds,
    projectedIds: projectedSet,
  };
  return result;
}
/**
 * UX正式入力の本文宣言を観測との比較から分離して捕捉する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
function captureUxFormalInput(
  analysis: string,
  requirementId: string,
): UxAnalysisModel["formalInput"] {
  const expectedDefinitionLink = new RegExp(
    `^分析対象: \\[${requirementId} [^\\]]+\\]\\(\\.\\.\\/\\.\\.\\/\\.\\.\\/01_Discovery/Definitions/${requirementId}/requirement\\.md\\)$`,
    "mu",
  );

  const structuralAnalysis = omitMarkdownFencedCode(analysis).replace(
    /<!--[\s\S]*?-->/gu,
    "",
  );
  const formalInputHeaders = structuralAnalysis.match(/^分析対象:.*$/gmu) ?? [];

  return {
    headers: formalInputHeaders,
    expectedLinkMatches: expectedDefinitionLink.test(structuralAnalysis),
    forbiddenDeclaration: /^判断根拠:|^探索元:/mu.test(analysis),
  };
}

/**
 * UX入口の生本文からIDと正式要求の関係を解析する。
 * @responsibility UX行と二列目のREQを既存の規則で集合化する。
 * @trace ARCH-000008
 * @input source: 取得済みの生UX入口本文と相対Path。
 * @returns ID集合とREQ–UX関係集合を持つUxIndexModel。
 * @precondition 呼出し元が入口本文を取得している。
 * @postcondition コメントやFenceを新たに除去せず、既存の集合を返す。
 * @effect N/A: 文字列と局所集合だけを扱う純粋な同期解析。
 * @failure 文字列操作の例外は伝播する。
 * @invariant 行の認識・セル位置・重複処置を変更しない。
 * @boundary N/A: 既読本文の解析だけを行う。
 * @security 実在確認や認可を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseUxIndex(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<UxIndexModel> & Readonly<{ result: UxIndexModel }> {
  const captured = { path: source.path, content: source.content };
  const identityDefinitions = new Map<string, string[]>();
  const definitionLines = omitMarkdownFencedCode(captured.content).split(
    /\r?\n/u,
  );
  for (let lineIndex = 0; lineIndex < definitionLines.length; lineIndex += 1) {
    const match = (definitionLines[lineIndex] as string).match(
      /^\| `(UX-[0-9]{6})`\s+[^|]+\|/u,
    );
    if (!match) continue;
    const definitions = identityDefinitions.get(match[1] as string) ?? [];
    definitions.push(`${captured.path}:${lineIndex + 1}`);
    identityDefinitions.set(match[1] as string, definitions);
  }
  const markdown = captured.content;
  const entries = markdown.split(/\r?\n/u).flatMap((text, index) => {
    const identity = text.match(/^\| (?:`|\[)(?<id>UX-[0-9]{6})/u)?.groups?.id;
    if (!identity) return [];
    return [
      {
        identity,
        requirementIds: [
          ...(text.split("|")[2] ?? "").matchAll(/REQ-[0-9]{6}/gu),
        ].map((match) => match[0]),
        source: { text, location: { path: captured.path, line: index + 1 } },
      },
    ];
  });
  const ids = new Set(entries.map((entry) => entry.identity));
  const requirementRelations = new Set(
    entries.flatMap((entry) =>
      entry.requirementIds.map((id) => `${id}|${entry.identity}`),
    ),
  );
  const result: UxIndexModel = {
    ...captureUxDocument(captured, {
      kind: "index",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    handoffContract: parseUxHandoff(
      captured,
      options.mode === "template"
        ? "## 6. 現在状態と次工程への引き渡し"
        : "## 4. 現在状態と次工程への引き渡し",
      "root",
    ),
    forbiddenDownstream: (options.mode === "template"
      ? ["IA／UI／SPEC／Verification"]
      : ["IA／UI／SPEC／Verification", "UIへは", "SPECへは"]
    ).some((part) =>
      omitMarkdownCommentsAndFencedCode(captured.content).includes(part),
    ),
    identityDefinitions,
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    tableRows: captureDocumentTableRows(captured),
    entries,
    ids,
    requirementRelations,
  };
  const issues = uxChecklistIssues(result);
  return { status: issues.length ? "partial" : "complete", result, issues };
}

/**
 * 既読UX定義の構造・引渡し・Checklistを検査する。
 * @responsibility UX定義本文の三種類の違反を既存順の中立Issueへ変換する。
 * @trace ARCH-000008
 * @input source: 取得済み生本文と位置。uxId: 列挙元の期待UX ID。
 * @returns 内容モデルと、本文構造・直接Handoff・Checklist順の局所診断。
 * @precondition 呼出し元が対象を選択し本文を取得している。
 * @postcondition 本文不正でも後続検査を続行し、Checklist理由を保持する。
 * @effect N/A: 取得済み本文と局所値だけを扱う同期検査。
 * @failure 解析例外を伝播し、不正を成功へ補完しない。
 * @invariant 生本文の状態行と可視Checklistの従来の受理条件を維持する。
 * @boundary N/A: 同一Process内の本文意味検査。
 * @security 実在確認・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseUxDefinition(
  source: ArtifactSource,
  uxId: string,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<UxDefinitionModel> & Readonly<{ result: UxDefinitionModel }> {
  const captured = { path: source.path, content: source.content };
  const definition = captured.content;
  const base = captureUxDocument(captured, {
    kind: "definition",
    mode: options.mode === undefined ? "evaluated" : options.mode,
  });
  const result: UxDefinitionModel = {
    ...base,
    handoffContract: parseUxHandoff(
      captured,
      "## 下流への引き渡し",
      "contract",
    ),
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    expectedIdentity: uxId,
    tableRows: captureDocumentTableRows(captured),
    stateDeclarations: [...definition.matchAll(/^状態:.*$/gmu)].map(
      (match) => ({
        text: match[0],
        location: {
          path: captured.path,
          line: definition.slice(0, match.index).split("\n").length,
        },
      }),
    ),
    outcome: captureDocumentSections(captured, "利用者成果"),
    change: captureDocumentSections(captured, "利用者に起きる変化"),
    conditions: captureDocumentSections(captured, "成立条件"),
    experience: captureDocumentSections(captured, "重要な体験・失敗・品質期待"),
    boundary: captureDocumentSections(captured, "責任境界・制約・対象外"),
    unknown: captureDocumentSections(captured, "未確認事項と戻り条件"),
    verification: captureDocumentSections(captured, "検証意図"),
    handoff: captureDocumentSections(captured, "下流への引き渡し"),
    relations: captureDocumentSections(captured, "関係"),
    checklist: captureDocumentSections(captured, "Checklist"),
  };
  const issues: DocumentIssue[] = [];
  const stateHeaders = result.stateDeclarations.map(
    (declaration) => declaration.text,
  );
  if (
    !definition.includes(`UX ID: \`${uxId}\``) ||
    !definition.includes("成果物種別: UX定義") ||
    stateHeaders.length !== 1 ||
    !/^状態: (Canonical|Superseded)$/u.test(stateHeaders[0] ?? "") ||
    !definition.includes("## 利用者成果") ||
    !definition.includes("## 利用者に起きる変化") ||
    !definition.includes("## 成立条件") ||
    !definition.includes("## 重要な体験・失敗・品質期待") ||
    !definition.includes("### 重要な失敗") ||
    !definition.includes("### 体験品質への期待") ||
    !definition.includes("## 責任境界・制約・対象外") ||
    !definition.includes("## 未確認事項と戻り条件") ||
    !definition.includes("現在判定:") ||
    !definition.includes("確認事項:") ||
    !definition.includes("判断者:") ||
    !definition.includes("未確認時の影響:") ||
    !definition.includes("## 検証意図") ||
    !definition.includes("IA（直後工程への正式な引き渡し）") ||
    !definition.includes("Quality Analysis / UX（伴走）") ||
    !definition.includes("UI（後続Contract Relation）") ||
    !definition.includes("SPEC（後続Contract Relation）") ||
    !definition.includes("## 関係")
  )
    issues.push({
      kind: "artifact.ux.definition-contract-invalid",
      targetIdentity: uxId,
      location: { path: source.path },
      reason: "definition-contract-invalid",
      details: {},
    });
  const definitionChecklistError = base.checklistContract.failure;
  if (
    definition.includes("### 要求固有の後続義務") ||
    definition.includes("UXからArchitectureまたは検証への直接Handoff") ||
    !result.handoffContract.valid
  )
    issues.push({
      kind: "artifact.ux.definition-handoff-invalid",
      targetIdentity: uxId,
      location: { path: source.path },
      reason: "definition-handoff-invalid",
      details: {},
    });
  if (definitionChecklistError)
    issues.push({
      kind: "artifact.ux.definition-checklist-invalid",
      targetIdentity: uxId,
      location: { path: source.path },
      reason: "definition-checklist-invalid",
      details: { checklistFailure: definitionChecklistError },
    });
  const finalIssues =
    options.mode === "template" ? uxChecklistIssues(result, uxId) : issues;
  return {
    status: finalIssues.length ? "partial" : "complete",
    result,
    issues: finalIssues,
  };
}

/**
 * UX分析の既読本文を検査し関係を解析する。
 * @responsibility 構造・引渡し・Checklist・統合関係・責任表・Blueprint処置を所有する。
 * @trace ARCH-000008
 * @input source: 生本文と位置。requirementId: 期待REQ ID。options: 方式と参照組立て用Root文字列。
 * @returns 内容・関係をresult、既存順の局所診断をissuesへ分離したOutcome。
 * @precondition 呼出し元が本文を取得している。正式入力観測・台帳登録数はSemanticで比較する。
 * @postcondition 本文不正でも関係抽出と後続検査を継続する。
 * @effect N/A: 既読本文と局所集合だけを扱う同期処理。
 * @failure 解析例外を伝播し不足情報を補完しない。
 * @invariant 生本文・可視Checklist・表列・重複処置・Issue順を変更しない。
 * @boundary N/A: 同一Process内のUX本文検査。
 * @security Path安全性・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseUxAnalysis(
  source: ArtifactSource,
  requirementId: string,
  options: Readonly<{
    mode?: "template" | "evaluated";
    referenceRoot?: string;
  }> = {},
): ParseResult<UxAnalysisModel> & Readonly<{ result: UxAnalysisModel }> {
  const captured = { path: source.path, content: source.content };
  const analysis = captured.content;
  const base = captureUxDocument(captured, {
    kind: "analysis",
    mode: options.mode === undefined ? "evaluated" : options.mode,
  });
  const handoffContract = parseUxHandoff(
    captured,
    "## 6. 下流への引き渡し",
    "contract",
  );
  const issues: DocumentIssue[] = [];
  const requirementRelations = new Set<string>();
  const journeyRelations = new Set<string>();
  const requiredParts = [
    "成果物種別: UX分析",
    `分析対象: [${requirementId} `,
    "## 1. 要求の一次分析",
    "| 解決する問題 |",
    "| 利用者に必要なこと |",
    "## 2. 利用者・目標・成果",
    "| 主な想定利用者 |",
    "| 目的 |",
    "| 得られる結果 |",
    "## 3. 利用者に起きる変化",
    "## 4. 利用者成果への統合",
    "| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |",
    "## 5. 重要な体験",
    "### この要求での利用の流れ",
    "### サービス提供の流れの処置",
    "処置:",
    "### 製品全体の整理への接続",
    "- 利用の流れの統合先:",
    "- サービス提供の流れの統合先:",
    "### この要求での責任境界",
    "| 担い手 | この要求で担うこと | 越えてはならない境界 |",
    "### 補足する品質",
    "## 6. 下流への引き渡し",
    "IA（直後工程への正式な引き渡し）",
    "Quality Analysis / UX（伴走）",
    "UI（後続Contract Relation）",
    "SPEC（後続Contract Relation）",
    "### 妥当性確認と未確認事項",
    "現在判定:",
    "確認事項:",
    "判断者:",
    "未確認時の影響:",
    "Discoveryへ戻す条件",
  ];
  const hasExperienceChange =
    /```text\r?\n変更前\r?\n[\s\S]+?\r?\n変更後\r?\n/u.test(analysis);
  if (
    requiredParts.some((part) => !analysis.includes(part)) ||
    !hasExperienceChange
  )
    issues.push({
      kind: "artifact.ux.analysis-contract-invalid",
      targetIdentity: requirementId,
      location: { path: source.path },
      reason: "analysis-contract-invalid",
      details: {},
    });
  const analysisChecklistError = base.checklistContract.failure;
  if (
    analysis.includes("### 後続工程が保持する義務") ||
    analysis.includes("UXからArchitectureまたは検証への直接Handoff") ||
    !handoffContract.valid
  )
    issues.push({
      kind: "artifact.ux.analysis-handoff-invalid",
      targetIdentity: requirementId,
      location: { path: source.path },
      reason: "analysis-handoff-invalid",
      details: {},
    });
  if (analysisChecklistError)
    issues.push({
      kind: "artifact.ux.analysis-checklist-invalid",
      targetIdentity: requirementId,
      location: { path: source.path },
      reason: "analysis-checklist-invalid",
      details: { checklistFailure: analysisChecklistError },
    });
  const relationRows = analysis
    .split(/\r?\n/u)
    .filter((line) => /^\| [^|]+ \| `(New|Same) → UX-[0-9]{6}` \|/u.test(line));
  const relationDiagramSection = analysis
    .split("## 4. 利用者成果への統合")[1]
    ?.split("| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |")[0];
  const relationDiagramEntries = [
    ...(relationDiagramSection?.matchAll(
      /(?:├|└)─ (?<mode>New|Same)\s+→ (?<id>UX-[0-9]{6})\b/gu,
    ) ?? []),
  ].flatMap((match) =>
    match.groups?.mode && match.groups.id
      ? [`${match.groups.mode}|${match.groups.id}`]
      : [],
  );
  const relationTableEntries = relationRows.flatMap((line) => {
    const match = line.match(/`(?<mode>New|Same) → (?<id>UX-[0-9]{6})`/u);
    return match?.groups?.mode && match.groups.id
      ? [`${match.groups.mode}|${match.groups.id}`]
      : [];
  });
  const doesRelationDiagramMatchTable =
    relationDiagramEntries.length === relationTableEntries.length &&
    [...relationDiagramEntries]
      .sort()
      .every(
        (value, index) => value === [...relationTableEntries].sort()[index],
      );
  const responsibilitySectionMatches = [
    ...analysis.matchAll(/^### この要求での責任境界\s*$/gmu),
  ];
  const responsibilitySection = analysis
    .split(/^### この要求での責任境界\s*$/mu)[1]
    ?.split(/^### |^## /mu)[0];
  const responsibilityHeaders = (responsibilitySection ?? "")
    .split(/\r?\n/u)
    .filter((line, index, lines) => {
      const next = lines[index + 1] ?? "";
      return /^\|.*\|$/u.test(line) && /^\|(?:\s*:?-+:?\s*\|)+$/u.test(next);
    });
  const hasExactResponsibilityHeader =
    responsibilitySectionMatches.length === 1 &&
    responsibilityHeaders.length === 1 &&
    responsibilityHeaders[0] ===
      "| 担い手 | この要求で担うこと | 越えてはならない境界 |";
  const notApplicableRows = analysis
    .split(/\r?\n/u)
    .filter((line) => /^\| [^|]+ \| `Not Applicable` \|/u.test(line));
  const sameRelationIds = relationRows.flatMap((line) => {
    const match = line.match(/`Same → (?<id>UX-[0-9]{6})`/u);
    return match?.groups?.id ? [match.groups.id] : [];
  });
  const hasCompleteSameComparison = sameRelationIds.every((uxId) => {
    const block = analysis.match(
      new RegExp(
        `^#### [^\\r\\n]+\\r?\\n\\r?\\n比較対象: \`${uxId}\`\\r?\\n(?<body>[\\s\\S]*?)(?=^#### |^## |(?![\\s\\S]))`,
        "mu",
      ),
    )?.groups?.body;
    if (!block?.includes("統合理由:")) return false;
    return ["担い手", "利用のきっかけ", "得られる結果", "避ける失敗"].every(
      (axis) =>
        new RegExp(
          `^\\| ${axis} \\| [^|]+ \\| [^|]+ \\| [^|]+ \\|$`,
          "mu",
        ).test(block),
    );
  });
  for (const line of relationRows) {
    const match = line.match(/`(?:New|Same) → (?<id>UX-[0-9]{6})`/u);
    if (match?.groups?.id)
      requirementRelations.add(`${requirementId}|${match.groups.id}`);
  }
  const journeyLine = analysis
    .split(/\r?\n/u)
    .find((line) => line.startsWith("- 利用の流れの統合先:"));
  for (const match of journeyLine?.matchAll(
    /\[([^\]]+)\]\([^)]*03_Experience_Map\.md#[^)]+\)/gu,
  ) ?? [])
    journeyRelations.add(`${requirementId}|${match[1]}`);
  const blueprintSection = analysis
    .split("### サービス提供の流れの処置")[1]
    ?.split("### 製品全体の整理への接続")[0];
  const blueprintDisposition =
    blueprintSection?.match(/^処置: `(作成|非該当)`$/mu)?.[1];
  const isBlueprintDispositionInvalid =
    !blueprintDisposition ||
    (blueprintDisposition === "作成" &&
      (!/```text\r?\n[\s\S]+?\r?\n```/u.test(blueprintSection ?? "") ||
        ![
          "【利用者・責任者】",
          "【利用者接点】",
          "【提供側】",
          "【回復・判断する人】",
          "可視境界",
          "時間差:",
          "完了時:",
          "失敗時:",
          "次の行動:",
        ].every((label) => blueprintSection?.includes(label)))) ||
    (blueprintDisposition === "非該当" &&
      !/再評価/u.test(blueprintSection ?? ""));
  if (
    relationRows.length + notApplicableRows.length === 0 ||
    relationRows.some(
      (line) =>
        !/^\| [^|]+ \| `(New|Same) → UX-[0-9]{6}` \| [^|]+ \| [^|]+ \|$/u.test(
          line,
        ),
    ) ||
    notApplicableRows.some(
      (line) =>
        !/^\| [^|]+ \| `Not Applicable` \| [^|]+ \| [^|]+ \|$/u.test(line),
    ) ||
    !hasCompleteSameComparison ||
    !doesRelationDiagramMatchTable
  )
    issues.push({
      kind: "artifact.ux.analysis-relation-invalid",
      targetIdentity: requirementId,
      location: { path: source.path },
      reason: "analysis-relation-invalid",
      details: {},
    });
  if (!hasExactResponsibilityHeader)
    issues.push({
      kind: "artifact.ux.analysis-responsibility-header-invalid",
      targetIdentity: requirementId,
      location: { path: source.path },
      reason: "analysis-responsibility-header-invalid",
      details: {},
    });
  if (isBlueprintDispositionInvalid)
    issues.push({
      kind: "artifact.ux.analysis-blueprint-disposition-invalid",
      targetIdentity: requirementId,
      location: { path: source.path },
      reason: "analysis-blueprint-disposition-invalid",
      details: {},
    });
  const finalIssues =
    options.mode === "template"
      ? uxChecklistIssues(base, requirementId)
      : issues;
  return {
    status: finalIssues.length ? "partial" : "complete",
    result: {
      ...base,
      formalInputTargets: parseUxFormalInputTargets(
        analysis,
        options.referenceRoot ?? "",
      ),
      formalInput: captureUxFormalInput(analysis, requirementId),
      handoffContract,
      artifact: parseMarkdownArtifact(captured),
      source: captured,
      expectedIdentity: requirementId,
      tableRows: captureDocumentTableRows(captured),
      primary: captureDocumentSections(captured, "1. 要求の一次分析"),
      actors: captureDocumentSections(captured, "2. 利用者・目標・成果"),
      change: captureDocumentSections(captured, "3. 利用者に起きる変化"),
      integration: captureDocumentSections(captured, "4. 利用者成果への統合"),
      experience: captureDocumentSections(captured, "5. 重要な体験"),
      handoff: captureDocumentSections(captured, "6. 下流への引き渡し"),
      checklist: captureDocumentSections(captured, "Checklist"),
      requirementRelations,
      journeyRelations,
    },
    issues: finalIssues,
  };
}

/**
 * Experience Mapの生本文からREQ–Journey関係を解析する。
 * @responsibility 単純Pipe分割の既存列を使い関係をSetへまとめる。
 * @trace ARCH-000008
 * @input source: 取得済みのExperience Map生本文と相対Path。
 * @returns 原文・出典・Journey行とREQ関係集合を持つ内容モデル。
 * @precondition 呼出し元がExperience Mapの本文を取得している。
 * @postcondition 短い行・既知Header・区切り行を除き、既存列から関係を返す。
 * @effect N/A: 文字列と局所集合だけを扱う純粋な同期解析。
 * @failure 文字列操作の例外は伝播する。
 * @invariant 共通表Parserへの置換や新しい重複拒否を追加しない。
 * @boundary N/A: 既読本文の解析だけを行う。
 * @security 関係の実在・妥当性や品質成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseUxExperienceMap(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<UxExperienceMap> & Readonly<{ result: UxExperienceMap }> {
  const captured = { path: source.path, content: source.content };
  const markdown = captured.content;
  const pairs = new Set<string>();
  const entries: Array<{
    journey: string;
    requirementIds: string[];
    cells: string[];
    source: DocumentText;
  }> = [];
  for (const [index, line] of markdown.split(/\r?\n/u).entries()) {
    const cells = line.split("|").map((cell) => cell.trim());
    if (
      cells.length < 7 ||
      cells[1] === "Journey" ||
      /^-+$/u.test(cells[1] as string)
    )
      continue;
    const requirementIds = [
      ...(cells[5] as string).matchAll(/REQ-[0-9]{6}/gu),
    ].map((match) => match[0]);
    entries.push({
      journey: cells[1] as string,
      requirementIds,
      cells,
      source: {
        text: line,
        location: { path: captured.path, line: index + 1 },
      },
    });
    for (const match of requirementIds) pairs.add(`${match}|${cells[1]}`);
  }
  const result: UxExperienceMap = {
    ...captureUxDocument(captured, {
      kind: "experience_map",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    projection: captureUxProjection(captured, "## 3. UX成果との対応"),
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    tableRows: captureDocumentTableRows(captured),
    entries,
    requirementRelations: pairs,
  };
  const issues = uxChecklistIssues(result);
  return { status: issues.length ? "partial" : "complete", result, issues };
}
/**
 * UXPersonas文書を内容・出典と局所診断へ解析する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export function parseUxPersonas(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<UxPersonas> & Readonly<{ result: UxPersonas }> {
  const captured = { path: source.path, content: source.content };
  const result: UxPersonas = {
    ...captureUxDocument(captured, {
      kind: "personas",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    projection: captureUxProjection(captured, "## 3. UX成果との対応"),
    sections: [
      "想定利用者の関係図",
      "想定利用者一覧",
      "想定利用者ごとの物語",
      "未確認事項",
    ].flatMap((heading) => captureDocumentSections(captured, heading)),
  };
  const issues = uxChecklistIssues(result);
  return { status: issues.length ? "partial" : "complete", result, issues };
}
/**
 * UXServiceBlueprint文書を内容・出典と局所診断へ解析する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export function parseUxServiceBlueprint(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<UxServiceBlueprint> & Readonly<{ result: UxServiceBlueprint }> {
  const captured = { path: source.path, content: source.content };
  const result: UxServiceBlueprint = {
    ...captureUxDocument(captured, {
      kind: "service_blueprint",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    projection: captureUxProjection(captured, "## 3. UX成果への適用"),
    sections: [
      "製品全体のサービス提供の流れ",
      "区間と責任境界",
      "対象外・未確認事項",
    ].flatMap((heading) => captureDocumentSections(captured, heading)),
  };
  const issues = uxChecklistIssues(result);
  return { status: issues.length ? "partial" : "complete", result, issues };
}
/**
 * UXQualityExpectations文書を内容・出典と局所診断へ解析する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export function parseUxQualityExpectations(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<UxQualityExpectations> &
  Readonly<{ result: UxQualityExpectations }> {
  const captured = { path: source.path, content: source.content };
  const result: UxQualityExpectations = {
    ...captureUxDocument(captured, {
      kind: "quality_expectations",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    projection: captureUxProjection(captured, "## 3. UX成果との対応"),
    sections: [
      "品質期待の全体像",
      "品質期待台帳",
      "競合・優先順位・未確認事項",
    ].flatMap((heading) => captureDocumentSections(captured, heading)),
    forbiddenDownstream: ["- Architectureは", "- Verificationは"].some((part) =>
      omitMarkdownCommentsAndFencedCode(captured.content).includes(part),
    ),
  };
  const issues = uxChecklistIssues(result);
  return { status: issues.length ? "partial" : "complete", result, issues };
}
