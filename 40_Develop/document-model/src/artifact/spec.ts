/**
 * SPEC分析・登録表・定義の意味モデルを検査する。
 * @responsibility 既読本文から関係と順序付き中立Issueを生成する。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactSource } from "./types.ts";
import {
  omitMarkdownCommentsAndFencedCode,
  parseMarkdownTableRow,
  isMarkdownTableSeparator,
} from "./markdown.ts";
import { inspectEvaluatedChecklist } from "./checklist.ts";
import { createPhaseChecklistItems } from "./phase-checklists.ts";
/**
 * SPECの指定Headerに続く表行を抽出する。
 * @responsibility SPECの指定Headerに続く表行を抽出する。
 * @trace ARCH-000008
 * @input content: 可視本文。headers: 期待列名。
 * @returns 既存の列数・連続行境界で取得した表行。
 * @precondition 呼出し元が対象を選択し本文を取得している。
 * @postcondition 最初のHeaderとSeparatorの後で、列数が合う連続行だけを返す。
 * @effect N/A: 既読本文と局所値だけを扱う同期処理。
 * @failure 解析例外を伝播し不足を補完しない。
 * @invariant 同じHeaderの最初の一致と次行Separatorを要求する。
 * @boundary N/A: 同一Process内のSPEC意味モデル検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
const tableRows = (content: string, headers: readonly string[]): string[][] => {
  const lines = content.split(/\r?\n/u);
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
  const rows: string[][] = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const cells = parseMarkdownTableRow(lines[index] as string);
    if (cells === null || cells.length !== headers.length) break;
    rows.push(cells);
  }
  return rows;
};
/**
 * SPECの指定第二階層Section本文を抽出する。
 * @responsibility SPECの指定第二階層Section本文を抽出する。
 * @trace ARCH-000008
 * @input source: 可視本文。heading: 対象見出し。
 * @returns 既存のSection本文、または空文字列。
 * @precondition 呼出し元が対象を選択し本文を取得している。
 * @postcondition 最初に一致したSectionの本文だけを返す。
 * @effect N/A: 既読本文と局所値だけを扱う同期処理。
 * @failure 解析例外を伝播し不足を補完しない。
 * @invariant 最初の一致と次の第二階層見出しで区切る。
 * @boundary N/A: 同一Process内のSPEC意味モデル検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
const sectionBody = (source: string, heading: string): string => {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return (
    source.match(
      new RegExp(`^${escaped}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "mu"),
    )?.[1] ?? ""
  );
};
/**
 * SPECの順序付き値列に重複があるか確認する。
 * @responsibility SPECの順序付き値列に重複があるか確認する。
 * @trace ARCH-000008
 * @input values: 解析済みの値列。
 * @returns 重複があればtrue。
 * @precondition 呼出し元が対象を選択し本文を取得している。
 * @postcondition 入力を変更せず、長さとSetサイズの差を返す。
 * @effect N/A: 既読本文と局所値だけを扱う同期処理。
 * @failure 解析例外を伝播し不足を補完しない。
 * @invariant 比較前に値列の重複を消さない。
 * @boundary N/A: 同一Process内のSPEC意味モデル検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
const hasDuplicate = (values: readonly string[]): boolean =>
  new Set(values).size !== values.length;

/**
 * SPEC分析の結果を表す。
 * @responsibility 不正本文でも取得した関係とIssueを後続照合へ渡す。
 * @trace ARCH-000008
 * @shape relations、issues。
 * @invariant 重複と既存Issue順を保持する。
 * @boundary N/A: 既読本文の値モデル。
 * @security 実在・認可・品質全体の成立を保証しない。
 * @compatibility 現在のSPEC受理条件を維持する。
 */
export type SpecAnalysisModel = Readonly<{
  relations: readonly string[];
  issues: readonly DomainIssue[];
}>;
/**
 * SPEC定義の結果を表す。
 * @responsibility 不正本文でも取得した関係とIssueを後続照合へ渡す。
 * @trace ARCH-000008
 * @shape relations、uiPairs、issues。
 * @invariant 重複と既存Issue順を保持する。
 * @boundary N/A: 既読本文の値モデル。
 * @security 実在・認可・品質全体の成立を保証しない。
 * @compatibility 現在のSPEC受理条件を維持する。
 */
export type SpecDefinitionModel = SpecAnalysisModel &
  Readonly<{ uiPairs: readonly string[] }>;
/**
 * SPEC登録表の結果を表す。
 * @responsibility 不正本文でも取得した関係とIssueを後続照合へ渡す。
 * @trace ARCH-000008
 * @shape ids、relations、uiPairs、countRows、issues。
 * @invariant 重複と既存Issue順を保持する。
 * @boundary N/A: 既読本文の値モデル。
 * @security 実在・認可・品質全体の成立を保証しない。
 * @compatibility 現在のSPEC受理条件を維持する。
 */
export type SpecIndexModel = Readonly<{
  ids: ReadonlySet<string>;
  relations: ReadonlySet<string>;
  uiPairs: ReadonlySet<string>;
  countRows: readonly string[][];
  issues: readonly DomainIssue[];
}>;
/**
 * SPEC分析の本文と二観点の関係を検査する。
 * @responsibility SPEC分析の本文と二観点の関係を検査する。
 * @trace ARCH-000008
 * @input artifact: 生本文と位置。identity: 分析単位のUX／IA ID。
 * @returns 重複を保持する関係と既存順のIssue。
 * @precondition 呼出し元が対象を選択し本文を取得している。
 * @postcondition 不正本文でも解析可能な関係を保持し、既存順のIssueを返す。
 * @effect N/A: 既読本文と局所値だけを扱う同期処理。
 * @failure 解析例外を伝播し不足を補完しない。
 * @invariant 入力観点・可視本文・Checklistと関係の受理条件を変更しない。
 * @boundary N/A: 同一Process内のSPEC意味モデル検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
export function inspectSpecAnalysis(
  artifact: ArtifactSource,
  identity: string,
): SpecAnalysisModel {
  const source = omitMarkdownCommentsAndFencedCode(artifact.content);
  const isUx = identity.startsWith("UX-");
  const issues: DomainIssue[] = [];
  const { specAnalysisUxChecklistItemTexts, specAnalysisIaChecklistItemTexts } =
    createPhaseChecklistItems();
  const expectedInput = isUx
    ? `../../../02_UX/Definitions/${identity}/ux_definition.md`
    : `../../../03_IA/Definitions/${identity}/ia_definition.md`;
  const requiredHeadings = isUx
    ? [
        "## 2. 振る舞いへ引き継ぐ利用者成果",
        "## 3. 観測可能にする契機・結果・失敗",
        "## 4. 受入条件と適用範囲",
        "## 5. SPEC処置",
        "## 6. IA観点との統合時に確認すること",
      ]
    : [
        "## 2. 利用場面ごとに保持する意味",
        "## 3. 対象・識別・関係",
        "## 4. 状態・可視性・時間的意味",
        "## 5. 導線・責任・失敗時の保持",
        "## 6. SPEC処置",
        "## 7. UX観点との統合時に確認すること",
      ];
  const inputSection =
    source.match(/^## 1\. 正式入力\s*$([\s\S]*?)(?=^## )/mu)?.[1] ?? "";
  const dispositionSection = sectionBody(
    source,
    isUx ? "## 5. SPEC処置" : "## 6. SPEC処置",
  );
  const currentRelations: string[] = [];
  for (const match of dispositionSection.matchAll(
    /\[(SPEC-[0-9]{6})[^\]]*\]\(\.\.\/\.\.\/Definitions\/\1\/spec_definition\.md\)/gu,
  ))
    currentRelations.push(`${identity}|${match[1]}`);

  if (
    !source.includes(
      isUx
        ? "成果物種別: SPEC分析（UX観点）"
        : "成果物種別: SPEC分析（IA観点）",
    ) ||
    !source.includes(`分析単位: \u0060${identity}\u0060`) ||
    !inputSection.includes(expectedInput) ||
    (isUx
      ? /03_IA\/Definitions|IA-[0-9]{6}|REQ-[0-9]{6}/u
      : /02_UX\/Definitions|UX-[0-9]{6}|REQ-[0-9]{6}/u
    ).test(inputSection) ||
    !requiredHeadings.every((heading) => source.includes(heading)) ||
    currentRelations.length === 0 ||
    hasDuplicate(currentRelations)
  )
    issues.push({
      kind:
        "artifact.spec." +
        (isUx
          ? "ux-analysis-contract-invalid"
          : "ia-analysis-contract-invalid"),
      targetIdentity: identity,
      location: { path: artifact.path },
      reason: isUx
        ? "ux-analysis-contract-invalid"
        : "ia-analysis-contract-invalid",
      details: {},
    });
  const checklistError = inspectEvaluatedChecklist(
    source,
    isUx ? specAnalysisUxChecklistItemTexts : specAnalysisIaChecklistItemTexts,
  );
  if (checklistError)
    issues.push({
      kind: "artifact.spec." + "analysis-checklist-invalid",
      targetIdentity: identity,
      location: { path: artifact.path },
      reason: "analysis-checklist-invalid",
      details: { checklistFailure: checklistError },
    });
  return { relations: currentRelations, issues };
}
/**
 * SPEC登録表のID・関係・件数表を解析する。
 * @responsibility SPEC登録表のID・関係・件数表を解析する。
 * @trace ARCH-000008
 * @input artifact: 登録表の生本文と位置。
 * @returns 登録集合・件数表と重複Issue。
 * @precondition 呼出し元が対象を選択し本文を取得している。
 * @postcondition 不正本文でも解析可能な関係を保持し、既存順のIssueを返す。
 * @effect N/A: 既読本文と局所値だけを扱う同期処理。
 * @failure 解析例外を伝播し不足を補完しない。
 * @invariant 最初の表・重複検出と既存のSet化を維持する。
 * @boundary N/A: 同一Process内のSPEC意味モデル検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
export function parseSpecIndex(artifact: ArtifactSource): SpecIndexModel {
  const identity = artifact.path;
  const issues: DomainIssue[] = [];
  const registryIds = new Set<string>();
  const registryIdOccurrences: string[] = [];
  const registryRelations = new Set<string>();
  const registryRelationOccurrences: string[] = [];
  const registryUiPairs = new Set<string>();
  const registryUiPairOccurrences: string[] = [];
  const index = omitMarkdownCommentsAndFencedCode(artifact.content);
  const indexCountRows = tableRows(index, ["入力／成果", "件数", "現在の処置"]);
  for (const line of index.split(/\r?\n/u)) {
    const row = line.match(
      /^\| \[(SPEC-[0-9]{6})\]\(Definitions\/\1\/spec_definition\.md\) \| [^|]+ \| (?<ux>[^|]+) \| (?<ia>[^|]+) \| (?<ui>[^|]+) \|$/u,
    );
    if (!row?.groups) continue;
    const specId = row[1] as string;
    registryIdOccurrences.push(specId);
    registryIds.add(specId);
    for (const id of (row.groups.ux as string).match(/UX-[0-9]{6}/gu) ?? []) {
      const relation = `${id}|${specId}`;
      registryRelationOccurrences.push(relation);
      registryRelations.add(relation);
    }
    for (const id of (row.groups.ia as string).match(/IA-[0-9]{6}/gu) ?? []) {
      const relation = `${id}|${specId}`;
      registryRelationOccurrences.push(relation);
      registryRelations.add(relation);
    }
    for (const id of (row.groups.ui as string).match(/UI-[0-9]{6}/gu) ?? []) {
      const relation = `${id}|${specId}`;
      registryUiPairOccurrences.push(relation);
      registryUiPairs.add(relation);
    }
  }

  if (
    hasDuplicate(registryIdOccurrences) ||
    hasDuplicate(registryRelationOccurrences) ||
    hasDuplicate(registryUiPairOccurrences)
  )
    issues.push({
      kind: "artifact.spec." + "registry-relation-duplicate",
      targetIdentity: identity,
      location: { path: artifact.path },
      reason: "registry-relation-duplicate",
      details: {},
    });

  return {
    ids: registryIds,
    relations: registryRelations,
    uiPairs: registryUiPairs,
    countRows: indexCountRows,
    issues,
  };
}
/**
 * SPEC統合定義の本文と関係を検査する。
 * @responsibility SPEC統合定義の本文と関係を検査する。
 * @trace ARCH-000008
 * @input artifact: 生本文と位置。identity: 期待SPEC ID。
 * @returns UX／IA・UI関係の出現列と既存順のIssue。
 * @precondition 呼出し元が対象を選択し本文を取得している。
 * @postcondition 不正本文でも解析可能な関係を保持し、既存順のIssueを返す。
 * @effect N/A: 既読本文と局所値だけを扱う同期処理。
 * @failure 解析例外を伝播し不足を補完しない。
 * @invariant 不正本文でも関係を残し、Not Applicableと正式入力・受入UIの条件を維持する。
 * @boundary N/A: 同一Process内のSPEC意味モデル検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
export function inspectSpecDefinition(
  artifact: ArtifactSource,
  identity: string,
): SpecDefinitionModel {
  const source = omitMarkdownCommentsAndFencedCode(artifact.content);
  const issues: DomainIssue[] = [];
  const definitionRelationOccurrences: string[] = [];
  const definitionUiPairOccurrences: string[] = [];
  const { specDefinitionChecklistItemTexts } = createPhaseChecklistItems();
  const uxInputSection = sectionBody(source, "## UX観点の分析結果");
  const iaInputSection = sectionBody(source, "## IA観点の分析結果");
  const formalSection = sectionBody(source, "## 正式入力と変換根拠");
  for (const match of `${uxInputSection}\n${iaInputSection}`.matchAll(
    /\[(UX|IA)-([0-9]{6})\]\(\.\.\/\.\.\/Analysis\/\1-\2\/spec_analysis\.md\)/gu,
  )) {
    const relation = `${match[1]}-${match[2]}|${identity}`;
    definitionRelationOccurrences.push(relation);
  }
  const uiSection = sectionBody(source, "## 対応するUI");
  const acceptanceSection = sectionBody(source, "## 受入条件と検証義務");
  const uiPairLine =
    uiSection.match(/^- pairs_with:\s*(.+)$/mu)?.[1]?.trim() ?? "";
  for (const match of uiPairLine.matchAll(
    /\[(UI-[0-9]{6})\]\(\.\.\/\.\.\/\.\.\/04_UI\/Definitions\/\1\/ui_definition\.md\)/gu,
  )) {
    const relation = `${match[1]}|${identity}`;
    definitionUiPairOccurrences.push(relation);
  }
  const isNoDirectUi = uiPairLine === "Not Applicable";
  const localUiIds = new Set(
    [...uiPairLine.matchAll(/UI-[0-9]{6}/gu)].map((match) => match[0]),
  );
  const acceptanceUiIds = new Set(
    [
      ...acceptanceSection.matchAll(
        /\[(UI-[0-9]{6})\]\(\.\.\/\.\.\/\.\.\/04_UI\/Definitions\/\1\/ui_definition\.md\)/gu,
      ),
    ].map((match) => match[1]),
  );
  const analysisUxIds = new Set(
    [...uxInputSection.matchAll(/UX-[0-9]{6}/gu)].map((match) => match[0]),
  );
  const analysisIaIds = new Set(
    [...iaInputSection.matchAll(/IA-[0-9]{6}/gu)].map((match) => match[0]),
  );
  const formalUxIds = new Set(
    [
      ...formalSection.matchAll(
        /正式入力: \[(UX-[0-9]{6})\]\(\.\.\/\.\.\/\.\.\/02_UX\/Definitions\/\1\/ux_definition\.md\)/gu,
      ),
    ].map((match) => match[1]),
  );
  const formalIaIds = new Set(
    [
      ...formalSection.matchAll(
        /正式入力: \[(IA-[0-9]{6})\]\(\.\.\/\.\.\/\.\.\/03_IA\/Definitions\/\1\/ia_definition\.md\)/gu,
      ),
    ].map((match) => match[1]),
  );
  const isFormalInputMismatch =
    !formalSection.includes("正式入力そのものではない") ||
    formalUxIds.size !== analysisUxIds.size ||
    formalIaIds.size !== analysisIaIds.size ||
    [...analysisUxIds].some((id) => !formalUxIds.has(id)) ||
    [...analysisIaIds].some((id) => !formalIaIds.has(id));
  const isAcceptancePairMismatch =
    !isNoDirectUi &&
    (localUiIds.size !== acceptanceUiIds.size ||
      [...localUiIds].some((id) => !acceptanceUiIds.has(id)));
  const hasMixedUiDisposition =
    uiPairLine.includes("Not Applicable") && !isNoDirectUi;
  const isNoDirectUiComplete =
    isNoDirectUi &&
    /^- 理由:\s*\S+/mu.test(uiSection) &&
    /^- 運用Feedback:\s*\S+/mu.test(uiSection) &&
    /^- 人間確認:\s*\S+/mu.test(uiSection);
  const requiredTokens = [
    "成果物種別: SPEC定義",
    `SPEC ID: \u0060${identity}\u0060`,
    "## 振る舞いの目的",
    "## UX観点の分析結果",
    "## IA観点の分析結果",
    "## 両観点の統合判断",
    "## 契機・事前条件・Authority",
    "## 振る舞い・状態・結果",
    "## 失敗・回復・副作用",
    "## 受入条件と検証義務",
    "## 対応するUI",
    "## 制約",
  ];
  if (
    !requiredTokens.every((token) => source.includes(token)) ||
    (!isNoDirectUi &&
      definitionUiPairOccurrences.filter((pair) =>
        pair.endsWith(`|${identity}`),
      ).length === 0) ||
    (isNoDirectUi && !isNoDirectUiComplete) ||
    (isNoDirectUi && /\[UI-[0-9]{6}\]/u.test(uiPairLine)) ||
    hasMixedUiDisposition ||
    isFormalInputMismatch ||
    isAcceptancePairMismatch
  )
    issues.push({
      kind: "artifact.spec." + "definition-contract-invalid",
      targetIdentity: identity,
      location: { path: artifact.path },
      reason: "definition-contract-invalid",
      details: {},
    });
  const checklistError = inspectEvaluatedChecklist(
    source,
    specDefinitionChecklistItemTexts,
  );
  if (checklistError)
    issues.push({
      kind: "artifact.spec." + "definition-checklist-invalid",
      targetIdentity: identity,
      location: { path: artifact.path },
      reason: "definition-checklist-invalid",
      details: { checklistFailure: checklistError },
    });
  return {
    relations: definitionRelationOccurrences,
    uiPairs: definitionUiPairOccurrences,
    issues,
  };
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
export function inspectSpecAnalysisCoverage(
  request: Readonly<{
    specIndexPath: string;
    specAnalysisRoot: string;
    uxIds: ReadonlySet<string>;
    iaIds: ReadonlySet<string>;
    analyzedUx: ReadonlySet<string>;
    analyzedIa: ReadonlySet<string>;
    analysisRelationOccurrences: readonly string[];
  }>,
): readonly DomainIssue[] {
  const {
    specIndexPath,
    specAnalysisRoot,
    uxIds,
    iaIds,
    analyzedUx,
    analyzedIa,
    analysisRelationOccurrences,
  } = request;
  const issues: DomainIssue[] = [];
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

  if (hasDuplicate(analysisRelationOccurrences))
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
export function inspectSpecDefinitionCoverage(
  request: Readonly<{
    specDefinitionsRoot: string;
    specIndexPath: string;
    definitionRelationOccurrences: readonly string[];
    definitionUiPairOccurrences: readonly string[];
    registryIds: ReadonlySet<string>;
    actualIds: ReadonlySet<string>;
  }>,
): readonly DomainIssue[] {
  const {
    specDefinitionsRoot,
    specIndexPath,
    definitionRelationOccurrences,
    definitionUiPairOccurrences,
    registryIds,
    actualIds,
  } = request;
  const issues: DomainIssue[] = [];
  if (
    hasDuplicate(definitionRelationOccurrences) ||
    hasDuplicate(definitionUiPairOccurrences)
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
export function inspectSpecCoverage(
  request: Readonly<{
    specIndexPath: string;
    indexCountRows: readonly string[][];
    expectedIndexCounts: ReadonlyMap<string, number>;
    registryRelations: ReadonlySet<string>;
    analysisRelations: ReadonlySet<string>;
    definitionRelations: ReadonlySet<string>;
  }>,
): readonly DomainIssue[] {
  const {
    specIndexPath,
    indexCountRows,
    expectedIndexCounts,
    registryRelations,
    analysisRelations,
    definitionRelations,
  } = request;
  const issues: DomainIssue[] = [];
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
/**
 * UI定義の対応SPEC関係を解析する。
 * @responsibility UI定義の対応SPEC関係を解析する。
 * @trace ARCH-000008
 * @input content: 生本文。identity: UI ID。
 * @returns 重複を保持するUI–SPEC関係出現列。
 * @precondition 呼出し元が現在位置で必要な本文・集合を取得している。
 * @postcondition 既存Section／リンク条件に一致した関係を出現順・重複保持で返し、入力を変更しない。
 * @effect N/A: 観測済み値と局所配列だけを扱う同期処理。
 * @failure 集合・文字列操作の例外を伝播し不足を補完しない。
 * @invariant 観測の先読みと新しい非空条件を追加しない。
 * @boundary N/A: 同一Process内のSPEC関係検査。
 * @security 実在・認可・品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseUiSpecPairs(
  content: string,
  identity: string,
): readonly string[] {
  const source = omitMarkdownCommentsAndFencedCode(content);
  const uiPairOccurrences: string[] = [];
  const pairSection = sectionBody(source, "## 対応するSPEC");
  const pairLine =
    pairSection.match(/^- pairs_with:\s*(.+)$/mu)?.[1]?.trim() ?? "";
  for (const match of pairLine.matchAll(
    /\[(SPEC-[0-9]{6})\]\(\.\.\/\.\.\/\.\.\/05_SPEC\/Definitions\/\1\/spec_definition\.md\)/gu,
  )) {
    const relation = `${identity}|${match[1]}`;
    uiPairOccurrences.push(relation);
  }
  return uiPairOccurrences;
}
/**
 * UIとSPECと登録表の対応関係閉包を検査する。
 * @responsibility UIとSPECと登録表の対応関係閉包を検査する。
 * @trace ARCH-000008
 * @input request: 位置と登録／定義／UI関係集合・UI出現列。
 * @returns UI重複、三者閉包の順のIssue。
 * @precondition 呼出し元が現在位置で必要な本文・集合を取得している。
 * @postcondition 旧条件・重複処置・Issue順を維持し入力を変更しない。
 * @effect N/A: 観測済み値と局所配列だけを扱う同期処理。
 * @failure 集合・文字列操作の例外を伝播し不足を補完しない。
 * @invariant 観測の先読みと新しい非空条件を追加しない。
 * @boundary N/A: 同一Process内のSPEC関係検査。
 * @security 実在・認可・品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectUiSpecRelations(
  request: Readonly<{
    uiDefinitionsRoot: string;
    specIndexPath: string;
    uiPairOccurrences: readonly string[];
    registryUiPairs: ReadonlySet<string>;
    definitionUiPairs: ReadonlySet<string>;
    uiPairs: ReadonlySet<string>;
  }>,
): readonly DomainIssue[] {
  const {
    uiDefinitionsRoot,
    specIndexPath,
    uiPairOccurrences,
    registryUiPairs,
    definitionUiPairs,
    uiPairs,
  } = request;
  const issues: DomainIssue[] = [];
  if (hasDuplicate(uiPairOccurrences))
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
