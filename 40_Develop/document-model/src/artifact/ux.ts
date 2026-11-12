/**
 * UX入口・投影・Journey・分析・定義の既読本文を解析・検査する。
 * @responsibility 現行の本文条件・ID・関係集合と順序付き中立Issueを所有する。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactSource } from "./types.ts";
import { inspectEvaluatedChecklist } from "./checklist.ts";
import { createPhaseChecklistItems } from "./phase-checklists.ts";
import { isUxHandoffTargetSetExact } from "./ux-handoff.ts";
import { omitMarkdownCommentsAndFencedCode } from "./markdown.ts";
import { omitMarkdownFencedCode } from "./anchors.ts";

/**
 * 生のUX入口から得たIDとREQ–UX関係を表す。
 * @responsibility 既存のSet化を保つ二つの集合を同じ解析結果へまとめる。
 * @trace ARCH-000008
 * @shape ids、requirementRelations。
 * @invariant 生本文由来の重複は現行どおりSetへ畳む。
 * @boundary N/A: 取得済み本文の値モデルだけを表す。
 * @security 認可・実在・品質全体の成立を表さない。
 * @compatibility 現行のID抽出と関係セルの受理条件を維持する。
 */
export type UxIndexModel = Readonly<{
  ids: ReadonlySet<string>;
  requirementRelations: ReadonlySet<string>;
}>;

/**
 * UX入口の生本文からIDと正式要求の関係を解析する。
 * @responsibility UX行と二列目のREQを既存の規則で集合化する。
 * @trace ARCH-000008
 * @input markdown: 取得済みの生UX入口本文。
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
export function parseUxIndex(markdown: string): UxIndexModel {
  const ids = new Set(
    markdown
      .split(/\r?\n/u)
      .map((line) => line.match(/^\| (?:`|\[)(?<id>UX-[0-9]{6})/u)?.groups?.id)
      .filter((value): value is string => Boolean(value)),
  );
  const requirementRelations = new Set(
    markdown.split(/\r?\n/u).flatMap((line) => {
      const uxId = line.match(/^\| (?:`|\[)(?<id>UX-[0-9]{6})/u)?.groups?.id;
      if (!uxId) return [];
      const requirementCell = line.split("|")[2] ?? "";
      return [...requirementCell.matchAll(/REQ-[0-9]{6}/gu)].map(
        (match) => `${match[0]}|${uxId}`,
      );
    }),
  );
  return { ids, requirementRelations };
}

/**
 * 横断投影の可視SectionでUX IDが不足・重複するか判定する。
 * @responsibility 指定SectionのID列とCanonical集合を照合する。
 * @trace ARCH-000008
 * @input markdown: 投影本文。heading: 対応Sectionの見出し。canonicalUxIds: 入口のID集合。
 * @returns 見出し不足またはID集合の重複・過不足があればtrue。
 * @precondition 呼出し元が本文と対象見出しを選択している。
 * @postcondition 次の第二階層見出しより前の可視本文だけを照合する。
 * @effect N/A: 文字列と局所集合だけを扱う純粋な同期検査。
 * @failure 文字列操作の例外は伝播する。
 * @invariant indexOfで最初の見出しを選び、重複IDを拒否する既存条件を維持する。
 * @boundary N/A: 既読本文の限定Section検査。
 * @security 空集合一致を品質全体のPassへ昇格しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function isUxProjectionIncomplete(
  markdown: string,
  heading: string,
  canonicalUxIds: ReadonlySet<string>,
): boolean {
  const source = omitMarkdownCommentsAndFencedCode(markdown);
  const start = source.indexOf(heading);
  const tail = start < 0 ? "" : source.slice(start + heading.length);
  const next = tail.search(/^## /mu);
  const projection = next < 0 ? tail : tail.slice(0, next);
  const projectedIds = [
    ...projection.matchAll(/^\| \[(UX-[0-9]{6})\]\(/gmu),
  ].map((match) => match[1]);
  const projectedSet = new Set(projectedIds);
  return (
    start < 0 ||
    projectedIds.length !== projectedSet.size ||
    projectedSet.size !== canonicalUxIds.size ||
    [...canonicalUxIds].some((id) => !projectedSet.has(id))
  );
}

/**
 * Experience Mapの生本文からREQ–Journey関係を解析する。
 * @responsibility 単純Pipe分割の既存列を使い関係をSetへまとめる。
 * @trace ARCH-000008
 * @input markdown: 取得済みのExperience Map生本文。
 * @returns REQとJourney名を結んだ文字列集合。
 * @precondition 呼出し元がExperience Mapの本文を取得している。
 * @postcondition 短い行・既知Header・区切り行を除き、既存列から関係を返す。
 * @effect N/A: 文字列と局所集合だけを扱う純粋な同期解析。
 * @failure 文字列操作の例外は伝播する。
 * @invariant 共通表Parserへの置換や新しい重複拒否を追加しない。
 * @boundary N/A: 既読本文の解析だけを行う。
 * @security 関係の実在・妥当性や品質成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseUxJourneyRelations(markdown: string): ReadonlySet<string> {
  const pairs = new Set<string>();
  for (const line of markdown.split(/\r?\n/u)) {
    const cells = line.split("|").map((cell) => cell.trim());
    if (
      cells.length < 7 ||
      cells[1] === "Journey" ||
      /^-+$/u.test(cells[1] as string)
    )
      continue;
    for (const match of (cells[5] as string).matchAll(/REQ-[0-9]{6}/gu))
      pairs.add(`${match[0]}|${cells[1]}`);
  }
  return pairs;
}

/**
 * 既読UX定義の構造・引渡し・Checklistを検査する。
 * @responsibility UX定義本文の三種類の違反を既存順の中立Issueへ変換する。
 * @trace ARCH-000008
 * @input source: 取得済み生本文と位置。uxId: 列挙元の期待UX ID。
 * @returns 本文構造、直接Handoff、Checklistの順序付きIssue列。
 * @precondition 呼出し元が対象を選択し本文を取得している。
 * @postcondition 本文不正でも後続検査を続行し、Checklist理由を保持する。
 * @effect N/A: 取得済み本文と局所値だけを扱う同期検査。
 * @failure 解析例外を伝播し、不正を成功へ補完しない。
 * @invariant 生本文の状態行と可視Checklistの従来の受理条件を維持する。
 * @boundary N/A: 同一Process内の本文意味検査。
 * @security 実在確認・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectUxDefinition(
  source: ArtifactSource,
  uxId: string,
): readonly DomainIssue[] {
  const definition = source.content;
  const issues: DomainIssue[] = [];
  const { uxDefinitionChecklistItemTexts } = createPhaseChecklistItems();
  const stateHeaders = definition.match(/^状態:.*$/gmu) ?? [];
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
  const definitionChecklistError = inspectEvaluatedChecklist(
    definition,
    uxDefinitionChecklistItemTexts,
  );
  if (
    definition.includes("### 要求固有の後続義務") ||
    definition.includes("UXからArchitectureまたは検証への直接Handoff") ||
    !isUxHandoffTargetSetExact(definition, "## 下流への引き渡し")
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
  return issues;
}

/**
 * UX分析から得た関係集合と本文の違反を表す。
 * @responsibility 本文が不正でも解析できたREQ–UX／Journey関係を保持する。
 * @trace ARCH-000008
 * @shape requirementRelations、journeyRelations、issues。
 * @invariant 関係のSet化とIssueの順序を維持する。
 * @boundary N/A: 既読本文由来の値モデル。
 * @security 正式入力の安全性・実在や品質全体の成立を保証しない。
 * @compatibility 現行の関係抽出と診断順を維持する。
 */
export type UxAnalysisModel = Readonly<{
  requirementRelations: ReadonlySet<string>;
  journeyRelations: ReadonlySet<string>;
  issues: readonly DomainIssue[];
}>;

/**
 * UX分析の既読本文を検査し関係を解析する。
 * @responsibility 構造・引渡し・Checklist・統合関係・責任表・Blueprint処置を所有する。
 * @trace ARCH-000008
 * @input source: 生本文と位置。requirementId: 期待REQ ID。registryLinkCount: 入口の対応Path出現数。
 * @returns 解析できた関係と既存順のIssueを持つUxAnalysisModel。
 * @precondition 呼出し元が正式入力観測を済ませ、本文と出現数を取得している。
 * @postcondition 本文不正でも関係抽出と後続検査を継続する。
 * @effect N/A: 既読本文と局所集合だけを扱う同期処理。
 * @failure 解析例外を伝播し不足情報を補完しない。
 * @invariant 生本文・可視Checklist・表列・重複処置・Issue順を変更しない。
 * @boundary N/A: 同一Process内のUX本文検査。
 * @security Path安全性・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectUxAnalysis(
  source: ArtifactSource,
  requirementId: string,
  registryLinkCount: number,
): UxAnalysisModel {
  const analysis = source.content;
  const issues: DomainIssue[] = [];
  const requirementRelations = new Set<string>();
  const journeyRelations = new Set<string>();
  const { uxAnalysisChecklistItemTexts } = createPhaseChecklistItems();
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
    !hasExperienceChange ||
    registryLinkCount !== 1
  )
    issues.push({
      kind: "artifact.ux.analysis-contract-invalid",
      targetIdentity: requirementId,
      location: { path: source.path },
      reason: "analysis-contract-invalid",
      details: {},
    });
  const analysisChecklistError = inspectEvaluatedChecklist(
    analysis,
    uxAnalysisChecklistItemTexts,
  );
  if (
    analysis.includes("### 後続工程が保持する義務") ||
    analysis.includes("UXからArchitectureまたは検証への直接Handoff") ||
    !isUxHandoffTargetSetExact(analysis, "## 6. 下流への引き渡し")
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
  return { requirementRelations, journeyRelations, issues };
}

/**
 * 正式入力判定に必要な観測済み事実を表す。
 * @responsibility Path・Readerを渡さず、既存の内容有無・一致・拒否事実を搬送する。
 * @trace ARCH-000008
 * @shape definitionHasContent、matchingDefinitionOnly、hasSourceAnalysis、hasInvalidDiscoveryTarget、hasInvalidEntity、hasUnsafeTarget。
 * @invariant 観測不能をfalseへ補完せず、既存観測の結果だけを使う。
 * @boundary Checkerの参照観測とDomain本文検査の値境界。
 * @security DomainがFilesystemの安全性を再観測・認可する契約ではない。
 * @compatibility 現在の正式入力の受理条件を維持する。
 */
export type UxFormalInputObservation = Readonly<{
  definitionHasContent: boolean;
  matchingDefinitionOnly: boolean;
  hasSourceAnalysis: boolean;
  hasInvalidDiscoveryTarget: boolean;
  hasInvalidEntity: boolean;
  hasUnsafeTarget: boolean;
}>;

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
export function inspectUxFormalInput(
  source: ArtifactSource,
  requirementId: string,
  observation: UxFormalInputObservation,
): readonly DomainIssue[] {
  const analysis = source.content;
  const expectedDefinitionLink = new RegExp(
    `^分析対象: \\[${requirementId} [^\\]]+\\]\\(\\.\\.\\/\\.\\.\\/\\.\\.\\/01_Discovery/Definitions/${requirementId}/requirement\\.md\\)$`,
    "mu",
  );

  const structuralAnalysis = omitMarkdownFencedCode(analysis).replace(
    /<!--[\s\S]*?-->/gu,
    "",
  );
  const formalInputHeaders = structuralAnalysis.match(/^分析対象:.*$/gmu) ?? [];

  if (
    !observation.definitionHasContent ||
    formalInputHeaders.length !== 1 ||
    !expectedDefinitionLink.test(structuralAnalysis) ||
    !observation.matchingDefinitionOnly ||
    observation.hasSourceAnalysis ||
    observation.hasInvalidDiscoveryTarget ||
    observation.hasInvalidEntity ||
    observation.hasUnsafeTarget ||
    /^判断根拠:|^探索元:/mu.test(analysis)
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
export function inspectUxRelations(
  request: Readonly<{
    uxIndexPath: string;
    experienceMapPath: string;
    index: UxIndexModel;
    analysisRequirementRelations: ReadonlySet<string>;
    canonicalJourneyRelations: ReadonlySet<string>;
    analysisJourneyRelations: ReadonlySet<string>;
  }>,
): readonly DomainIssue[] {
  const { uxIndexPath, experienceMapPath } = request;
  const canonicalUxIds = request.index.ids;
  const canonicalRelationPairs = request.index.requirementRelations;
  const analysisRelationPairs = request.analysisRequirementRelations;
  const canonicalJourneyPairs = request.canonicalJourneyRelations;
  const analysisJourneyPairs = request.analysisJourneyRelations;
  const issues: DomainIssue[] = [];
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
