/**
 * UI文書の意味と二観点の関係を検査する。
 * @responsibility 既読本文の入口・Detail・分析・定義・網羅性・閉包を所有する。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactSource } from "./types.ts";
import {
  omitMarkdownCommentsAndFencedCode,
  parseMarkdownTableRow,
} from "./markdown.ts";
import { inspectEvaluatedChecklist } from "./checklist.ts";
import { createPhaseChecklistItems } from "./phase-checklists.ts";
/**
 * UI本文から抽出した二観点の関係を表す。
 * @responsibility 重複を保持する順序付き関係とIssueを後続検査へ渡す。
 * @trace ARCH-000008
 * @shape uxPairs、iaPairs、issues。
 * @invariant 不正本文でも抽出できた関係を消さない。
 * @boundary N/A: 取得済み本文のモデルのみ。
 * @security 品質成立・認可・実在を表さない。
 * @compatibility 現在のUI関係と診断順を維持する。
 */
export type UiRelationsModel = Readonly<{
  uxPairs: readonly string[];
  iaPairs: readonly string[];
  issues: readonly DomainIssue[];
}>;
/**
 * UI本文から抽出した登録IDと二観点の関係を表す。
 * @responsibility 重複を保持する順序付き関係とIssueを後続検査へ渡す。
 * @trace ARCH-000008
 * @shape ids、uxPairs、iaPairs、issues。
 * @invariant 不正本文でも抽出できた関係を消さない。
 * @boundary N/A: 取得済み本文のモデルのみ。
 * @security 品質成立・認可・実在を表さない。
 * @compatibility 現在のUI関係と診断順を維持する。
 */
export type UiIndexModel = UiRelationsModel &
  Readonly<{ ids: ReadonlySet<string> }>;
/**
 * 同名の第二階層Sectionが一つだけの本文を抽出する。
 * @responsibility 同名の第二階層Sectionが一つだけの本文を抽出する。既読本文と意味モデルだけを扱う。
 * @trace ARCH-000008
 * @input sourceText: 可視本文。heading: 第二階層の見出し名。
 * @returns 見出しが一つだけの場合の本文、その他はnull。
 * @precondition 呼出し元が可視本文を選択している。
 * @postcondition 次の第二階層見出しより前の本文だけを返す。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・重複・集合の受理条件を維持する。
 * @boundary N/A: 同一Process内のUIモデル検査。
 * @security 認可・実在確認・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
function exactSecondLevelSection(sourceText: string, heading: string) {
  const escaped = heading.replace(/[.*+?^$()|[\]{}\\]/gu, "\\$&");
  const headings = [
    ...sourceText.matchAll(new RegExp(`^## ${escaped}\\s*$`, "gmu")),
  ];
  if (headings.length !== 1) return null;
  const firstHeading = headings[0] as RegExpMatchArray;
  const sectionStart = (firstHeading.index ?? 0) + firstHeading[0].length;
  const remaining = sourceText.slice(sectionStart);
  const nextHeading = remaining.search(/^## /mu);
  return nextHeading < 0 ? remaining : remaining.slice(0, nextHeading);
}
/**
 * UI入口の登録IDと順序付き関係を解析する。
 * @responsibility UI入口の登録IDと順序付き関係を解析する。既読本文と意味モデルだけを扱う。
 * @trace ARCH-000008
 * @input source: 未加工のUI入口本文とそのPath。
 * @returns 登録ID集合、UX／IA別の順序付き関係、行別Issueを持つUiIndexModel。
 * @precondition 呼出し元がUI入口本文を取得している。
 * @postcondition 不正行のIssue件数と抽出した重複関係を保持する。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・重複・集合の受理条件を維持する。
 * @boundary N/A: 同一Process内のUIモデル検査。
 * @security 認可・実在確認・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
export function parseUiIndex(source: ArtifactSource): UiIndexModel {
  const issues: DomainIssue[] = [];
  const registryUiIds = new Set<string>();
  const registryUxUiKeys: string[] = [];
  const registryIaUiKeys: string[] = [];
  const registryUxUi = new Set<string>();
  const registryIaUi = new Set<string>();
  const uiIndex = omitMarkdownCommentsAndFencedCode(source.content);
  for (const line of uiIndex.split(/\r?\n/u)) {
    const row = line.match(
      /^\| \[(UI-[0-9]{6})\]\(Definitions\/\1\/ui_definition\.md\) \| [^|]+ \| (?<uxCell>[^|]+) \| (?<iaCell>[^|]+) \|$/u,
    );
    if (!row?.groups?.uxCell || !row.groups.iaCell) continue;
    const uiId = row[1] as string;
    registryUiIds.add(uiId);
    const rowUxIds = [...row.groups.uxCell.matchAll(/UX-[0-9]{6}/gu)].map(
      (match) => match[0],
    );
    const rowIaIds = [...row.groups.iaCell.matchAll(/IA-[0-9]{6}/gu)].map(
      (match) => match[0],
    );
    if (rowUxIds.length === 0 || rowIaIds.length === 0)
      issues.push({
        kind: "artifact.ui.registry-row-invalid",
        targetIdentity: source.path,
        location: { path: source.path },
        reason: "registry-row-invalid",
        details: {},
      });
    for (const uxId of rowUxIds) {
      const key = `${uxId}|${uiId}`;
      registryUxUiKeys.push(key);
      registryUxUi.add(key);
    }
    for (const iaId of rowIaIds) {
      const key = `${iaId}|${uiId}`;
      registryIaUiKeys.push(key);
      registryIaUi.add(key);
    }
  }

  return {
    ids: registryUiIds,
    uxPairs: registryUxUiKeys,
    iaPairs: registryIaUiKeys,
    issues,
  };
}
/**
 * UI Detailの現在の行と集合数を照合する。
 * @responsibility UI Detailの現在の行と集合数を照合する。既読本文と意味モデルだけを扱う。
 * @trace ARCH-000008
 * @input source: Detail本文とPath。uiIds: 入口に登録されたUI ID集合。
 * @returns 現在のDetail行条件と集合数に違反する中立Issue列。
 * @precondition 呼出し元がDetail本文と入口の登録集合を選択している。
 * @postcondition 既存の行条件・SCR／PRT集合数だけを照合する。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・重複・集合の受理条件を維持する。
 * @boundary N/A: 同一Process内のUIモデル検査。
 * @security 認可・実在確認・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
export function inspectUiDetail(
  source: ArtifactSource,
  uiIds: ReadonlySet<string>,
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];
  const detailSource = omitMarkdownCommentsAndFencedCode(source.content);
  const detailRows = detailSource
    .split(/\r?\n/u)
    .map((line) => parseMarkdownTableRow(line))
    .filter((cells): cells is string[] =>
      Boolean(cells?.[0]?.match(/^UI-[0-9]{6}$/u)),
    );
  const detailIds = detailRows.map((cells) => cells[0] as string);
  const screenIds = new Set<string>();
  const partIds = new Set<string>();
  for (const cells of detailRows) {
    const screenId = cells[4]?.match(/SCR-[0-9]{6}/u)?.[0];
    const partId = cells[4]?.match(/PRT-[0-9]{6}/u)?.[0];
    if (screenId) screenIds.add(screenId);
    if (partId) partIds.add(partId);
  }
  if (
    detailRows.some(
      (cells) =>
        cells.length !== 6 ||
        cells[2] !== "Applicable／Covered" ||
        (cells[3] as string).trim().length === 0 ||
        !/SCR-[0-9]{6}/u.test(cells[4] as string) ||
        !/PRT-[0-9]{6}/u.test(cells[4] as string) ||
        (cells[5] as string).trim().length === 0,
    ) ||
    detailIds.length !== new Set(detailIds).size ||
    detailIds.length !== uiIds.size ||
    detailIds.some((id) => !uiIds.has(id)) ||
    [...uiIds].some((id) => !detailIds.includes(id)) ||
    screenIds.size !== uiIds.size ||
    partIds.size !== uiIds.size ||
    !detailSource.includes("状態: Canonical")
  )
    issues.push({
      kind: "artifact.ui.detail-current-coverage-invalid",
      targetIdentity: source.path,
      location: { path: source.path },
      reason: "detail-current-coverage-invalid",
      details: {},
    });

  return issues;
}
/**
 * UXまたはIA観点のUI分析本文とChecklistを検査する。
 * @responsibility UXまたはIA観点のUI分析本文とChecklistを検査する。既読本文と意味モデルだけを扱う。
 * @trace ARCH-000008
 * @input source: 分析本文とPath。expectedInputId: 対応するUXまたはIA ID。
 * @returns 二観点別の関係列と本文／ChecklistのIssueを持つUiRelationsModel。
 * @precondition expectedInputIdは列挙元のUX-NNNNNNまたはIA-NNNNNN形式である。
 * @postcondition 不正本文の関係を保持し、本文Issueの後にChecklist Issueを返す。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・重複・集合の受理条件を維持する。
 * @boundary N/A: 同一Process内のUIモデル検査。
 * @security 認可・実在確認・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
export function inspectUiAnalysis(
  source: ArtifactSource,
  expectedInputId: string,
): UiRelationsModel {
  const issues: DomainIssue[] = [];
  const { uiAnalysisUxChecklistItemTexts, uiAnalysisIaChecklistItemTexts } =
    createPhaseChecklistItems();
  const analysisUxUiKeys: string[] = [];
  const analysisIaUiKeys: string[] = [];
  const analysisUxUi = new Set<string>();
  const analysisIaUi = new Set<string>();
  const analysis = omitMarkdownCommentsAndFencedCode(source.content);
  const inputSection = exactSecondLevelSection(analysis, "1. 正式入力");
  const dispositionSection = exactSecondLevelSection(analysis, "5. UI処置");
  const isUxView = expectedInputId.startsWith("UX-");
  const sourcePattern = isUxView
    ? /UX定義: \[(UX-[0-9]{6})[^\]]*\]\(\.\.\/\.\.\/\.\.\/02_UX\/Definitions\/(UX-[0-9]{6})\/ux_definition\.md\)/u
    : /IA定義: \[(IA-[0-9]{6})[^\]]*\]\(\.\.\/\.\.\/\.\.\/03_IA\/Definitions\/(IA-[0-9]{6})\/ia_definition\.md\)/u;
  const sourceInput = inputSection?.match(sourcePattern);
  const oppositeInputPattern = isUxView
    ? /03_IA\/Definitions|IA-[0-9]{6}/u
    : /02_UX\/Definitions|UX-[0-9]{6}/u;
  const viewPairs = isUxView ? analysisUxUi : analysisIaUi;
  const viewPairKeys = isUxView ? analysisUxUiKeys : analysisIaUiKeys;
  for (const match of dispositionSection?.matchAll(
    /\[(UI-[0-9]{6})[^\]]*\]\(\.\.\/\.\.\/Definitions\/\1\/ui_definition\.md\)/gu,
  ) ?? []) {
    const key = `${expectedInputId}|${match[1]}`;
    viewPairKeys.push(key);
    viewPairs.add(key);
  }

  const requiredViewSections = isUxView
    ? [
        "## 2. UIへ引き継ぐ利用者成果",
        "## 3. 必要な認識・操作・Feedback",
        "## 4. 状況による体験差",
        "## 6. IA観点との統合時に確認すること",
      ]
    : [
        "## 2. UIへ引き継ぐ情報構造",
        "## 3. 表示の優先順位とNavigation",
        "## 4. 表示差と開示境界",
        "## 6. UX観点との統合時に確認すること",
      ];
  if (
    !analysis.includes(
      isUxView
        ? "成果物種別: UI分析（UX観点）"
        : "成果物種別: UI分析（IA観点）",
    ) ||
    !analysis.includes(`分析単位: \u0060${expectedInputId}\u0060`) ||
    !inputSection ||
    !sourceInput ||
    sourceInput[1] !== expectedInputId ||
    sourceInput[2] !== expectedInputId ||
    oppositeInputPattern.test(inputSection) ||
    /01_Discovery|REQ-[0-9]{6}/u.test(inputSection) ||
    !requiredViewSections.every((heading) => analysis.includes(heading)) ||
    !dispositionSection ||
    ![...viewPairs].some((key) => key.startsWith(`${expectedInputId}|`))
  )
    issues.push({
      kind:
        "artifact.ui." +
        (isUxView
          ? "ux-analysis-contract-invalid"
          : "ia-analysis-contract-invalid"),
      targetIdentity: source.path,
      location: { path: source.path },
      reason: isUxView
        ? "ux-analysis-contract-invalid"
        : "ia-analysis-contract-invalid",
      details: {},
    });
  const checklistError = inspectEvaluatedChecklist(
    analysis,
    isUxView ? uiAnalysisUxChecklistItemTexts : uiAnalysisIaChecklistItemTexts,
  );
  if (checklistError)
    issues.push({
      kind: "artifact.ui.analysis-checklist-invalid",
      targetIdentity: source.path,
      location: { path: source.path },
      reason: "analysis-checklist-invalid",
      details: { checklistFailure: checklistError },
    });

  return { uxPairs: analysisUxUiKeys, iaPairs: analysisIaUiKeys, issues };
}
/**
 * UI定義の二観点統合と正式入力を検査する。
 * @responsibility UI定義の二観点統合と正式入力を検査する。既読本文と意味モデルだけを扱う。
 * @trace ARCH-000008
 * @input source: 定義本文とPath。expectedUiId: 対応するUI ID。
 * @returns 二観点別の関係列と本文／ChecklistのIssueを持つUiRelationsModel。
 * @precondition expectedUiIdは列挙元のUI-NNNNNN形式である。
 * @postcondition 不正本文の関係と正式入力の既存Set照合を維持する。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・重複・集合の受理条件を維持する。
 * @boundary N/A: 同一Process内のUIモデル検査。
 * @security 認可・実在確認・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
export function inspectUiDefinition(
  source: ArtifactSource,
  expectedUiId: string,
): UiRelationsModel {
  const issues: DomainIssue[] = [];
  const { uiDefinitionChecklistItemTexts } = createPhaseChecklistItems();
  const definitionUxUiKeys: string[] = [];
  const definitionIaUiKeys: string[] = [];
  const definitionUxUi = new Set<string>();
  const definitionIaUi = new Set<string>();
  const definition = omitMarkdownCommentsAndFencedCode(source.content);
  const uxSection = exactSecondLevelSection(definition, "UX観点の分析結果");
  const iaSection = exactSecondLevelSection(definition, "IA観点の分析結果");
  const formalSection = exactSecondLevelSection(
    definition,
    "正式入力と変換根拠",
  );
  for (const match of uxSection?.matchAll(
    /\[(UX-[0-9]{6})\]\(\.\.\/\.\.\/Analysis\/\1\/ui_analysis\.md\)/gu,
  ) ?? []) {
    const key = `${match[1]}|${expectedUiId}`;
    definitionUxUiKeys.push(key);
    definitionUxUi.add(key);
  }
  for (const match of iaSection?.matchAll(
    /\[(IA-[0-9]{6})\]\(\.\.\/\.\.\/Analysis\/\1\/ui_analysis\.md\)/gu,
  ) ?? []) {
    const key = `${match[1]}|${expectedUiId}`;
    definitionIaUiKeys.push(key);
    definitionIaUi.add(key);
  }
  const formalUxIds = new Set(
    [
      ...(formalSection?.matchAll(
        /正式入力: \[(UX-[0-9]{6})\]\(\.\.\/\.\.\/\.\.\/02_UX\/Definitions\/\1\/ux_definition\.md\)/gu,
      ) ?? []),
    ].map((match) => match[1]),
  );
  const formalIaIds = new Set(
    [
      ...(formalSection?.matchAll(
        /正式入力: \[(IA-[0-9]{6})\]\(\.\.\/\.\.\/\.\.\/03_IA\/Definitions\/\1\/ia_definition\.md\)/gu,
      ) ?? []),
    ].map((match) => match[1]),
  );
  const analysisUxIds = new Set(
    [...definitionUxUi]
      .filter((key) => key.endsWith(`|${expectedUiId}`))
      .map((key) => key.split("|")[0] as string),
  );
  const analysisIaIds = new Set(
    [...definitionIaUi]
      .filter((key) => key.endsWith(`|${expectedUiId}`))
      .map((key) => key.split("|")[0] as string),
  );
  const isFormalInputMismatch =
    !formalSection?.includes("正式入力そのものではない") ||
    formalUxIds.size !== analysisUxIds.size ||
    formalIaIds.size !== analysisIaIds.size ||
    [...analysisUxIds].some((id) => !formalUxIds.has(id)) ||
    [...analysisIaIds].some((id) => !formalIaIds.has(id));
  if (
    !definition.includes("成果物種別: UI定義") ||
    !definition.includes(`UI ID: \u0060${expectedUiId}\u0060`) ||
    !definition.includes("## 利用者成果") ||
    !uxSection ||
    !iaSection ||
    !definition.includes("## 両観点の統合判断") ||
    !definition.includes("## 表示面と情報の優先順位") ||
    !definition.includes("## 操作とFeedback") ||
    !definition.includes("## 状態と表示差") ||
    !definition.includes("## 視覚表現とアクセシビリティ") ||
    !definition.includes("## 制約") ||
    !definition.includes("## UI／SPEC対応レビューへ渡す項目") ||
    isFormalInputMismatch ||
    ![...definitionUxUi].some((key) => key.endsWith(`|${expectedUiId}`)) ||
    ![...definitionIaUi].some((key) => key.endsWith(`|${expectedUiId}`))
  )
    issues.push({
      kind: "artifact.ui.definition-contract-invalid",
      targetIdentity: source.path,
      location: { path: source.path },
      reason: "definition-contract-invalid",
      details: {},
    });
  const checklistError = inspectEvaluatedChecklist(
    definition,
    uiDefinitionChecklistItemTexts,
  );
  if (checklistError)
    issues.push({
      kind: "artifact.ui.definition-checklist-invalid",
      targetIdentity: source.path,
      location: { path: source.path },
      reason: "definition-checklist-invalid",
      details: { checklistFailure: checklistError },
    });

  return { uxPairs: definitionUxUiKeys, iaPairs: definitionIaUiKeys, issues };
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
export function inspectUiAnalysisCoverage(
  sourcePath: string,
  uxIds: ReadonlySet<string>,
  iaIds: ReadonlySet<string>,
  analysisUxIds: ReadonlySet<string>,
  analysisIaIds: ReadonlySet<string>,
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];
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
export function inspectUiIndexCoverage(
  sourcePath: string,
  index: UiIndexModel,
  actualUiIds: ReadonlySet<string>,
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];
  const registryUiIds = index.ids;
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
export function inspectUiRelations(
  sourcePath: string,
  index: UiIndexModel,
  analyses: readonly UiRelationsModel[],
  definitions: readonly UiRelationsModel[],
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];
  const registryUxUiKeys = [index].flatMap((model) => [...model.uxPairs]);
  const registryIaUiKeys = [index].flatMap((model) => [...model.iaPairs]);
  const registryUxUi = new Set(registryUxUiKeys);
  const registryIaUi = new Set(registryIaUiKeys);
  const analysisUxUiKeys = analyses.flatMap((model) => [...model.uxPairs]);
  const analysisIaUiKeys = analyses.flatMap((model) => [...model.iaPairs]);
  const analysisUxUi = new Set(analysisUxUiKeys);
  const analysisIaUi = new Set(analysisIaUiKeys);
  const definitionUxUiKeys = definitions.flatMap((model) => [...model.uxPairs]);
  const definitionIaUiKeys = definitions.flatMap((model) => [...model.iaPairs]);
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
