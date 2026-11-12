/**
 * IA文書の意味モデルと関係の不変条件を検査する。
 * @responsibility 読取り済み本文から登録・分析・定義・横断投影を解析し、IA内の関係を照合する。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactSource } from "./types.ts";
import { createPhaseChecklistItems } from "./phase-checklists.ts";
import { inspectEvaluatedChecklist } from "./checklist.ts";
import {
  omitMarkdownCommentsAndFencedCode,
  omitMarkdownCommentsOutsideFencedCode,
  parseMarkdownTableRow,
  isMarkdownTableSeparator,
} from "./markdown.ts";
/**
 * IA入口の登録集合と順序付き関係を表す。
 * @responsibility 重複を失わない関係列と不正行の観測結果を保持する。
 * @trace ARCH-000008
 * @shape ids、pairs、isRowInvalid。
 * @invariant Setと列を混同せず重複を保持する。
 * @boundary N/A: IA本文から得た値だけを表す。
 * @security 認可・実在確認を表さない。
 * @compatibility 現在のIA表の受理条件を維持する。
 */
export type IaIndexModel = Readonly<{
  ids: ReadonlySet<string>;
  pairs: readonly string[];
  isRowInvalid: boolean;
}>;
/**
 * 不正を含むIA分析から抽出できた意味を表す。
 * @responsibility ObjectとIdentity、順序付き関係と対応列を後続検査へ渡す。
 * @trace ARCH-000008
 * @shape objects、objectIdentities、pairs、mappingKeys、issues。
 * @invariant 不正本文でも抽出可能な関係を失わない。
 * @boundary N/A: 取得済み本文のモデルだけを扱う。
 * @security Issueの空列を品質全体のPassとしない。
 * @compatibility 既存の分析から定義への照合情報を保持する。
 */
export type IaAnalysisModel = Readonly<{
  objects: ReadonlySet<string>;
  objectIdentities: ReadonlyMap<string, string>;
  pairs: readonly string[];
  mappingKeys: readonly string[];
  issues: readonly DomainIssue[];
}>;
/**
 * IA定義の情報源とObject対応を表す。
 * @responsibility 後続の閉包照合に必要な順序付き列とIssueを保持する。
 * @trace ARCH-000008
 * @shape pairs、mappingKeys、issues。
 * @invariant 重複した関係や不正な本文を補完しない。
 * @boundary N/A: IAモデルの値だけを扱う。
 * @security 採用や品質成立のAuthorityを持たない。
 * @compatibility 現在の対応列と検査結果を維持する。
 */
export type IaDefinitionModel = Readonly<{
  pairs: readonly string[];
  mappingKeys: readonly string[];
  issues: readonly DomainIssue[];
}>;
/**
 * IAの違反理由と位置を中立Issueへ結合する。
 *
 * @responsibility 呼出し元で確定した理由・位置・詳細を中立Issueへ結合する。
 * @trace ARCH-000008
 * @input reason: 理由。sourcePath: 元Path。identity: 対象ID。details: 補足値。
 * @returns 指定した理由・位置・補足値を持つ中立Issue。
 * @precondition 理由と元位置が現在のIA検査で確定している。
 * @postcondition 呼出し元の位置と詳細をそのまま結合する。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・Identity／Relation・N/Aの判定条件を変えない。
 * @boundary N/A: 同一Process内のIAモデル検査。
 * @security 品質全体の成立・認可・移行完了を発行しない。
 * @concurrency N/A: 検査呼出し間の共有可変状態を持たない。
 */
function iaIssue(
  reason: string,
  sourcePath: string,
  identity: string,
  details: DomainIssue["details"] = {},
): DomainIssue {
  return {
    kind: "artifact.ia." + reason,
    targetIdentity: identity,
    location: { path: sourcePath },
    reason,
    details,
  };
}
/**
 * 期待する列と一致するIA表の連続行を読む。
 *
 * @responsibility IA本文と関係の既存判定を所有し、観測と表示を含めない。
 * @trace ARCH-000008
 * @input content: 本文。headers: 期待列。
 * @returns 列が完全一致する連続した表行。開始条件が合わなければ空配列。
 * @precondition headersが当該IA表の期待列を表す。
 * @postcondition 最初の不一致行で止め、期待列数を満たす行だけを返す。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・Identity／Relation・N/Aの判定条件を変えない。
 * @boundary N/A: 同一Process内のIAモデル検査。
 * @security 品質全体の成立・認可・移行完了を発行しない。
 * @concurrency N/A: 検査呼出し間の共有可変状態を持たない。
 */
const tableRows = <const Headers extends readonly string[]>(
  content: string,
  headers: Headers,
): Array<{ -readonly [K in keyof Headers]: string }> => {
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
  const rows: Array<{ -readonly [K in keyof Headers]: string }> = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const cells = parseMarkdownTableRow(lines[index] as string);
    if (cells === null || cells.length !== headers.length) break;
    rows.push(cells as { -readonly [K in keyof Headers]: string });
  }
  return rows;
};
/**
 * IA Object名から表示用の全角括弧補足を除く。
 *
 * @responsibility IA本文と関係の既存判定を所有し、観測と表示を含めない。
 * @trace ARCH-000008
 * @input value: 表示されたObject名。
 * @returns 全角括弧内の表示補足を除去してtrimした文字列。
 * @precondition 取得済みのObject名を受け取る。
 * @postcondition 同一性比較に用いる既存の括弧除去だけを行う。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・Identity／Relation・N/Aの判定条件を変えない。
 * @boundary N/A: 同一Process内のIAモデル検査。
 * @security 品質全体の成立・認可・移行完了を発行しない。
 * @concurrency N/A: 検査呼出し間の共有可変状態を持たない。
 */
const localCanonicalName = (value: string): string =>
  value.replace(/（[^）]+）/gu, "").trim();
/**
 * 一つだけ存在する完全一致の二段階Sectionを取り出す。
 *
 * @responsibility IA本文と関係の既存判定を所有し、観測と表示を含めない。
 * @trace ARCH-000008
 * @input source: 本文。heading: 見出しの本文。
 * @returns 見出しが一つの場合の本文。欠落・重複ならnull。
 * @precondition sourceは呼出し元が可視化したIA本文である。
 * @postcondition 次の二段階見出しで打ち切り、重複Sectionを選ばない。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・Identity／Relation・N/Aの判定条件を変えない。
 * @boundary N/A: 同一Process内のIAモデル検査。
 * @security 品質全体の成立・認可・移行完了を発行しない。
 * @concurrency N/A: 検査呼出し間の共有可変状態を持たない。
 */
const exactSecondLevelSection = (source: string, heading: string) => {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const headings = [
    ...source.matchAll(new RegExp(`^## ${escaped}\\s*$`, "gmu")),
  ];
  if (headings.length !== 1) return null;
  const firstHeading = headings[0] as RegExpMatchArray;
  const start = (firstHeading.index ?? 0) + firstHeading[0].length;
  const remaining = source.slice(start);
  const nextHeading = remaining.search(/^## /mu);
  return nextHeading < 0 ? remaining : remaining.slice(0, nextHeading);
};
const expectedIaDownstreamLabels = [
  "UI（UX＋IAの正式入力）",
  "SPEC（UX＋IAの正式入力）",
  "Quality Analysis / IA（伴走）",
];
/**
 * IAが保持する三つの正式な後続関係を比較する。
 *
 * @responsibility IA本文と関係の既存判定を所有し、観測と表示を含めない。
 * @trace ARCH-000008
 * @input section: 抽出済みSectionまたはnull。
 * @returns 正式な三つの後続ラベルが同じ順である場合だけtrue。
 * @precondition sectionは抽出済みの後続関係節またはnullである。
 * @postcondition 不足・余剰・順序違いをfalseで返す。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・Identity／Relation・N/Aの判定条件を変えない。
 * @boundary N/A: 同一Process内のIAモデル検査。
 * @security 品質全体の成立・認可・移行完了を発行しない。
 * @concurrency N/A: 検査呼出し間の共有可変状態を持たない。
 */
const hasExactIaDownstream = (section: string | null) => {
  const labels = (section ?? "")
    .split(/\r?\n/u)
    .map(
      (line) => /^\| (?<label>[^|]+) \| [^|]+ \|$/u.exec(line)?.groups?.label,
    )
    .filter((label): label is string => Boolean(label) && label !== "接続先");
  return (
    labels.length === expectedIaDownstreamLabels.length &&
    labels.every((label, index) => label === expectedIaDownstreamLabels[index])
  );
};
/**
 * IA入口から登録IDとUX–IA対を解析する。
 *
 * @responsibility IA本文と関係の既存判定を所有し、観測と表示を含めない。
 * @trace ARCH-000008
 * @input source: 取得済みIA入口本文。
 * @returns 登録ID集合、重複を保持する関係列、不正な入力UX行の有無。
 * @precondition sourceは取得済みのIA入口本文である。
 * @postcondition 可視本文の既存行形式からだけ登録を抽出する。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・Identity／Relation・N/Aの判定条件を変えない。
 * @boundary N/A: 同一Process内のIAモデル検査。
 * @security 品質全体の成立・認可・移行完了を発行しない。
 * @concurrency N/A: 検査呼出し間の共有可変状態を持たない。
 */
export function parseIaIndex(source: ArtifactSource): IaIndexModel {
  const iaIndex = omitMarkdownCommentsAndFencedCode(source.content);
  const registryPairs = new Set<string>();
  const registryPairKeys: string[] = [];
  const indexedIaIds = new Set<string>();
  let isIaRegistryRowInvalid = false;
  for (const line of iaIndex.split(/\r?\n/u)) {
    const row = line.match(
      /^\| \[(IA-[0-9]{6})\]\(Definitions\/\1\/ia_definition\.md\) \| [^|]+ \| (?<uxCell>[^|]+) \|$/u,
    );
    if (!row?.groups?.uxCell) continue;
    const iaId = row[1] as string;
    const inputUxIds = [...row.groups.uxCell.matchAll(/UX-[0-9]{6}/gu)].map(
      (match) => match[0],
    );
    if (
      inputUxIds.length === 0 ||
      new Set(inputUxIds).size !== inputUxIds.length
    )
      isIaRegistryRowInvalid = true;
    indexedIaIds.add(iaId);
    for (const uxId of inputUxIds) {
      const pair = `${uxId}|${iaId}`;
      registryPairKeys.push(pair);
      registryPairs.add(pair);
    }
  }

  return {
    ids: indexedIaIds,
    pairs: registryPairKeys,
    isRowInvalid: isIaRegistryRowInvalid,
  };
}
/**
 * IA分析本文とObjectの処置を検査する。
 *
 * @responsibility IA本文と関係の既存判定を所有し、観測と表示を含めない。
 * @trace ARCH-000008
 * @input artifact: 取得済み本文。expectedUxId: Directoryで確認済みのUX ID。
 * @returns Object・Identity・関係・対応列と本文不正のIssue。
 * @precondition artifactは取得済みIA分析、expectedUxIdはDirectoryで確認済みのIDである。
 * @postcondition 不正本文でも抽出できたObjectと関係を後続へ保持する。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・Identity／Relation・N/Aの判定条件を変えない。
 * @boundary N/A: 同一Process内のIAモデル検査。
 * @security 品質全体の成立・認可・移行完了を発行しない。
 * @concurrency N/A: 検査呼出し間の共有可変状態を持たない。
 */
export function inspectIaAnalysis(
  artifact: ArtifactSource,
  expectedUxId: string,
): IaAnalysisModel {
  const { iaAnalysisChecklistItemTexts } = createPhaseChecklistItems();
  const analysisPairKeys: string[] = [];
  const analysisMappingKeys: string[] = [];
  const issues: DomainIssue[] = [];
  const analysis = omitMarkdownCommentsAndFencedCode(artifact.content);
  const source = analysis.match(
    /分析対象: \[(UX-[0-9]{6})\]\(\.\.\/\.\.\/\.\.\/02_UX\/Definitions\/(UX-[0-9]{6})\/ux_definition\.md\)/u,
  );
  const receivedMeaningSection = exactSecondLevelSection(
    analysis,
    "1. UXから受け取る意味",
  );
  const dispositionSection = exactSecondLevelSection(analysis, "5. IA処置");
  const handoffSection = exactSecondLevelSection(
    analysis,
    "6. 後続工程が保持する意味",
  );
  const checklistError = inspectEvaluatedChecklist(
    analysis,
    iaAnalysisChecklistItemTexts,
  );
  const objectRows = tableRows(analysis, [
    "情報Object",
    "利用者にとっての意味",
    "同一性と関係の基準",
  ]);
  const objectNames = new Set(objectRows.map((cells) => cells[0]));
  const objectIdentities = new Map(
    objectRows.map((cells) => [cells[0], cells[2]]),
  );
  const mappingRows = tableRows(analysis, [
    "接続先",
    "分析Object",
    "Canonical Object",
    "処置",
    "判断理由",
  ]);
  const mappedSources = new Map<string, string[]>();
  let isAnalysisMappingInvalid =
    objectNames.size === 0 || mappingRows.length === 0;
  for (const [
    targetIa,
    sourceObject,
    canonicalObject,
    disposition,
    rationale,
  ] of mappingRows) {
    if (
      !objectNames.has(sourceObject) ||
      !["Same", "Rename", "Merge", "Split", "Not Applicable"].includes(
        disposition,
      ) ||
      rationale.length === 0
    )
      isAnalysisMappingInvalid = true;
    const dispositions = mappedSources.get(sourceObject) ?? [];
    dispositions.push(disposition);
    mappedSources.set(sourceObject, dispositions);
    if (disposition === "Not Applicable") {
      if (targetIa !== "―" || canonicalObject !== "―")
        isAnalysisMappingInvalid = true;
      continue;
    }
    if (!/^IA-[0-9]{6}$/u.test(targetIa) || canonicalObject === "―") {
      isAnalysisMappingInvalid = true;
      continue;
    }
    const key = `${expectedUxId}|${sourceObject}|${targetIa}|${canonicalObject}|${disposition}`;
    analysisMappingKeys.push(key);
  }
  for (const objectName of objectNames) {
    const dispositions = mappedSources.get(objectName) ?? [];
    if (dispositions.length === 0) isAnalysisMappingInvalid = true;
    if (dispositions.length > 1) {
      const transformationFamilies = new Set(
        dispositions.map((value) =>
          value === "Same" || value === "Rename" ? "preserve" : value,
        ),
      );
      if (transformationFamilies.size > 1) isAnalysisMappingInvalid = true;
    }
  }
  for (const match of dispositionSection?.matchAll(
    /\[(IA-[0-9]{6})\]\(\.\.\/\.\.\/Definitions\/\1\/ia_definition\.md\)/gu,
  ) ?? []) {
    const pair = `${expectedUxId}|${match[1]}`;
    analysisPairKeys.push(pair);
  }
  if (
    !analysis.includes("成果物種別: IA分析") ||
    !source ||
    source[1] !== expectedUxId ||
    source[2] !== expectedUxId ||
    !receivedMeaningSection ||
    ![
      "利用者",
      "場面",
      "目的",
      "得たい結果",
      "重要場面",
      "避ける失敗",
      "守る品質",
    ].every((axis) =>
      new RegExp(`^\\| ${axis} \\| [^|]+ \\|$`, "mu").test(
        receivedMeaningSection,
      ),
    ) ||
    !analysis.includes("## 2. 情報候補と関係") ||
    !analysis.includes(
      "| 情報Object | 利用者にとっての意味 | 同一性と関係の基準 |",
    ) ||
    (exactSecondLevelSection(analysis, "2. 情報候補と関係")?.match(
      /^\| [^|]+ \| [^|]+ \| [^|]+ \|$/gmu,
    )?.length ?? 0) < 3 ||
    !analysis.includes("図中の`[O:]`は情報Objectだけを表す。") ||
    !analysis.includes("## 3. 状態・可視性・導線・責任") ||
    !analysis.includes("| 状態 |") ||
    !analysis.includes("| 可視性 |") ||
    !analysis.includes("| 導線 |") ||
    !analysis.includes("| 責任 |") ||
    !analysis.includes("| 時間的な意味 |") ||
    !analysis.includes("| 情報の優先度 |") ||
    !analysis.includes("| 情報のまとまり |") ||
    !analysis.includes("| 判断権限 |") ||
    !analysis.includes(
      "ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。",
    ) ||
    !analysis.includes("| 重要な失敗 |") ||
    !analysis.includes("| 制約・対象外 |") ||
    !analysis.includes("| 人間判断 |") ||
    !analysis.includes("### 未確認事項と判断") ||
    !analysis.includes("| UXから継承する確認事項 |") ||
    !analysis.includes("| 判断者 |") ||
    !analysis.includes("| 未確認時の影響 |") ||
    !analysis.includes("| IAで追加した未確認事項 |") ||
    !analysis.includes("| IA固有の追加人間判断 |") ||
    !analysis.includes("| IAへ戻す条件 |") ||
    !analysis.includes("| 検証意図 |") ||
    !analysis.includes("### Canonical化候補") ||
    !analysis.includes(
      "| 接続先 | 分析Object | Canonical Object | 処置 | 判断理由 |",
    ) ||
    !analysis.includes("## 4. 現実照合の参考情報（正式入力ではない）") ||
    !analysis.includes(
      "この節は後続のReality Auditへ引き継ぐ参考情報であり、IA Candidateを導く正式入力ではない。",
    ) ||
    !dispositionSection ||
    !analysisPairKeys.some((pair) => pair.startsWith(`${expectedUxId}|`)) ||
    !hasExactIaDownstream(handoffSection) ||
    !analysis.includes("## 7. 補足分析") ||
    checklistError ||
    isAnalysisMappingInvalid
  )
    issues.push(
      iaIssue("analysis-contract-invalid", artifact.path, expectedUxId, {
        checklistFailure: checklistError,
      }),
    );
  return {
    objects: objectNames,
    objectIdentities,
    pairs: analysisPairKeys,
    mappingKeys: analysisMappingKeys,
    issues,
  };
}
/**
 * IA定義と分析ObjectのIdentity／Relationを照合する。
 *
 * @responsibility IA本文と関係の既存判定を所有し、観測と表示を含めない。
 * @trace ARCH-000008
 * @input source: 取得済み本文。expectedIaId: DirectoryのIA ID。analyses: 取得済み分析モデル。
 * @returns 情報源・対応列と本文不正のIssue。
 * @precondition sourceは取得済みIA定義で、analysesは先に読んだ分析のモデルである。
 * @postcondition 分析Objectの実在・Identity／Relation・Canonical対応を既存条件で照合する。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・Identity／Relation・N/Aの判定条件を変えない。
 * @boundary N/A: 同一Process内のIAモデル検査。
 * @security 品質全体の成立・認可・移行完了を発行しない。
 * @concurrency N/A: 検査呼出し間の共有可変状態を持たない。
 */
export function inspectIaDefinition(
  source: ArtifactSource,
  expectedIaId: string,
  analyses: ReadonlyMap<string, IaAnalysisModel>,
): IaDefinitionModel {
  const { iaDefinitionChecklistItemTexts } = createPhaseChecklistItems();
  const definitionPairKeys: string[] = [];
  const definitionMappingKeys: string[] = [];
  const issues: DomainIssue[] = [];
  const definitionSource = source.content;
  const definition = omitMarkdownCommentsAndFencedCode(definitionSource);
  const sourceSection = exactSecondLevelSection(definition, "情報源");
  for (const match of sourceSection?.matchAll(
    /\[(UX-[0-9]{6})のIA分析\]\(\.\.\/\.\.\/Analysis\/(UX-[0-9]{6})\/ia_analysis\.md\)/gu,
  ) ?? [])
    if (match[1] === match[2]) {
      const pair = `${match[1]}|${expectedIaId}`;
      definitionPairKeys.push(pair);
    }
  const handoffSection = exactSecondLevelSection(
    definition,
    "後続工程との関係",
  );
  const checklistError = inspectEvaluatedChecklist(
    definition,
    iaDefinitionChecklistItemTexts,
  );
  const definitionMappingRows = tableRows(definition, [
    "Source Analysis Object",
    "Canonical Object",
    "処置",
    "判断理由",
  ]);
  const canonicalObjectRows = tableRows(definition, [
    "対象",
    "利用者にとっての意味",
    "識別・関係",
  ]);
  const canonicalObjects = new Set(
    canonicalObjectRows.map((cells) => localCanonicalName(cells[0])),
  );
  const mappedCanonicalObjects = new Set<string>();
  const definitionObjectPairs = new Set<string>();
  let isDefinitionMappingInvalid =
    definitionMappingRows.length === 0 || canonicalObjects.size === 0;
  for (const [
    sourceObject,
    canonicalObject,
    disposition,
    rationale,
  ] of definitionMappingRows) {
    const match = sourceObject.match(/^(UX-[0-9]{6}): (.+)$/u);
    if (
      !match ||
      !analyses.get(match?.[1] ?? "")?.objects.has(match?.[2] ?? "") ||
      !["Same", "Rename", "Merge", "Split"].includes(disposition) ||
      rationale.length === 0 ||
      !canonicalObjects.has(canonicalObject)
    ) {
      isDefinitionMappingInvalid = true;
      continue;
    }
    mappedCanonicalObjects.add(canonicalObject);
    definitionObjectPairs.add(`${sourceObject}|${canonicalObject}`);
    const key = `${match[1]}|${match[2]}|${expectedIaId}|${canonicalObject}|${disposition}`;
    definitionMappingKeys.push(key);
  }
  const identityRelationRows = tableRows(definition, [
    "Source Analysis Object",
    "AnalysisのIdentity／Relation",
    "Canonical Object",
    "CanonicalのIdentity／Relation",
    "処置と理由",
  ]);
  const identityRelationObjectPairs = new Set<string>();
  const identityRelationObjectPairKeys: string[] = [];
  let isIdentityRelationMappingInvalid = identityRelationRows.length === 0;
  for (const [
    sourceObject,
    analysisIdentityRelation,
    canonicalObject,
    canonicalIdentityRelation,
    rationale,
  ] of identityRelationRows) {
    const pair = `${sourceObject}|${canonicalObject}`;
    if (
      analysisIdentityRelation.length === 0 ||
      canonicalIdentityRelation.length === 0 ||
      rationale.length === 0 ||
      !definitionObjectPairs.has(pair) ||
      analyses
        .get(/^UX-[0-9]{6}/u.exec(sourceObject)?.[0] ?? "")
        ?.objectIdentities.get(sourceObject.replace(/^UX-[0-9]{6}: /u, "")) !==
        analysisIdentityRelation
    )
      isIdentityRelationMappingInvalid = true;
    identityRelationObjectPairs.add(pair);
    identityRelationObjectPairKeys.push(pair);
  }
  if (
    identityRelationObjectPairs.size !==
      identityRelationObjectPairKeys.length ||
    definitionObjectPairs.size !== identityRelationObjectPairs.size ||
    [...definitionObjectPairs].some(
      (pair) => !identityRelationObjectPairs.has(pair),
    )
  )
    isIdentityRelationMappingInvalid = true;
  if (
    canonicalObjects.size !== mappedCanonicalObjects.size ||
    [...canonicalObjects].some((value) => !mappedCanonicalObjects.has(value))
  )
    isDefinitionMappingInvalid = true;
  const diagramObjects = [
    ...omitMarkdownCommentsOutsideFencedCode(definitionSource).matchAll(
      /\[O:\s*([^\]]+?)\s*\]/gu,
    ),
  ].map((match) => match[1]?.trim() ?? "");
  if (
    diagramObjects.length === 0 ||
    diagramObjects.some(
      (objectName) =>
        objectName.length === 0 ||
        !canonicalObjects.has(localCanonicalName(objectName)),
    ) ||
    canonicalObjects.size !==
      new Set(diagramObjects.map((value) => localCanonicalName(value))).size ||
    [...canonicalObjects].some(
      (objectName) =>
        !diagramObjects.some(
          (diagramObject) => localCanonicalName(diagramObject) === objectName,
        ),
    )
  )
    isDefinitionMappingInvalid = true;
  if (
    !definition.includes("成果物種別: IA定義") ||
    !definition.includes(`IA ID: \`${expectedIaId}\``) ||
    !definition.includes("## 意味と利用者成果") ||
    !definition.includes("## 対象・識別・関係") ||
    !definition.includes("### 分析ObjectからCanonical Objectへの対応") ||
    !definition.includes(
      "| Source Analysis Object | Canonical Object | 処置 | 判断理由 |",
    ) ||
    !definition.includes("### Identity／Relationの変換") ||
    !definition.includes(
      "| Source Analysis Object | AnalysisのIdentity／Relation | Canonical Object | CanonicalのIdentity／Relation | 処置と理由 |",
    ) ||
    !definition.includes("## 状態・可視性・時間的な意味") ||
    !definition.includes("## 情報の優先度・まとまり・見つけ方・責任") ||
    !definition.includes("### 責任と判断権限") ||
    !definition.includes(
      "| 入力UX | 情報を作成・更新・提供する責任 | 意味・状態・次の行動を決める権限 |",
    ) ||
    !definition.includes(
      "ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。",
    ) ||
    !definition.includes("## 失敗・制約・未確認事項") ||
    !definition.includes("## 検証意図") ||
    !definition.includes("| 入力UX | 重要場面 | 避ける失敗 | 品質期待 |") ||
    !definition.includes(
      "| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |",
    ) ||
    !hasExactIaDownstream(handoffSection) ||
    !sourceSection ||
    !definitionPairKeys.some((pair) => pair.endsWith(`|${expectedIaId}`)) ||
    !definition.includes("## 補足分析") ||
    checklistError ||
    isDefinitionMappingInvalid ||
    isIdentityRelationMappingInvalid
  )
    issues.push(
      iaIssue("definition-contract-invalid", source.path, expectedIaId, {
        checklistFailure: checklistError,
      }),
    );
  return {
    pairs: definitionPairKeys,
    mappingKeys: definitionMappingKeys,
    issues,
  };
}

/**
 * 実在確認済みUX集合と分析対象の網羅性を照合する。
 * @responsibility 取得済みIAモデルの局所不変条件を既存順で照合する。
 * @trace ARCH-000008
 * @input expectedUxIds、actualUxIds: 観測済み集合。sourcePath: 入口の相対Path。
 * @returns 不一致を表す中立Issue列。
 * @precondition 対象の観測・本文取得は呼出し元が完了している。
 * @postcondition 重複・不足・余剰を成功へ補完しない。
 * @effect N/A: 取得済み入力と局所集合だけを扱う。
 * @failure 例外を伝播し、観測や移行を代行しない。
 * @invariant 現在のIA契約とIssueの順序を維持する。
 * @boundary N/A: 同一Process内のモデル比較。
 * @security 採用・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有状態を持たない。
 */
export function inspectIaAnalysisCoverage(
  expectedUxIds: ReadonlySet<string>,
  actualUxIds: ReadonlySet<string>,
  sourcePath: string,
): readonly DomainIssue[] {
  return expectedUxIds.size !== actualUxIds.size ||
    [...expectedUxIds].some((id) => !actualUxIds.has(id))
    ? [iaIssue("analysis-coverage-mismatch", sourcePath, sourcePath)]
    : [];
}
/**
 * IA入口の登録集合と実在する定義集合を照合する。
 * @responsibility 取得済みIAモデルの局所不変条件を既存順で照合する。
 * @trace ARCH-000008
 * @input index: 解析済み入口。actualIaIds: 実在確認済み集合。sourcePath: 入口の相対Path。
 * @returns 不一致を表す中立Issue列。
 * @precondition 対象の観測・本文取得は呼出し元が完了している。
 * @postcondition 重複・不足・余剰を成功へ補完しない。
 * @effect N/A: 取得済み入力と局所集合だけを扱う。
 * @failure 例外を伝播し、観測や移行を代行しない。
 * @invariant 現在のIA契約とIssueの順序を維持する。
 * @boundary N/A: 同一Process内のモデル比較。
 * @security 採用・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有状態を持たない。
 */
export function inspectIaIndexCoverage(
  index: IaIndexModel,
  actualIaIds: ReadonlySet<string>,
  sourcePath: string,
): readonly DomainIssue[] {
  return index.isRowInvalid ||
    index.ids.size !== actualIaIds.size ||
    [...index.ids].some((id) => !actualIaIds.has(id)) ||
    [...actualIaIds].some((id) => !index.ids.has(id))
    ? [iaIssue("definition-index-coverage-mismatch", sourcePath, sourcePath)]
    : [];
}
/**
 * 横断成果物の専用Sectionが全IAを一回ずつ投影するか検査する。
 * @responsibility 取得済みIAモデルの局所不変条件を既存順で照合する。
 * @trace ARCH-000008
 * @input source: 取得済み本文。actualIaIds: 実在確認済みIA集合。
 * @returns 不一致を表す中立Issue列。
 * @precondition 対象の観測・本文取得は呼出し元が完了している。
 * @postcondition 重複・不足・余剰を成功へ補完しない。
 * @effect N/A: 取得済み入力と局所集合だけを扱う。
 * @failure 例外を伝播し、観測や移行を代行しない。
 * @invariant 現在のIA契約とIssueの順序を維持する。
 * @boundary N/A: 同一Process内のモデル比較。
 * @security 採用・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有状態を持たない。
 */
export function inspectIaCrossProjection(
  source: ArtifactSource,
  actualIaIds: ReadonlySet<string>,
): readonly DomainIssue[] {
  const cross = omitMarkdownCommentsAndFencedCode(source.content);
  const projectionSection =
    exactSecondLevelSection(cross, "4. IA定義への適用") ??
    exactSecondLevelSection(cross, "5. IA定義への適用");
  const projectedKeys = [
    ...(projectionSection?.matchAll(
      /\[(IA-[0-9]{6})\]\(Definitions\/(IA-[0-9]{6})\/ia_definition\.md\)/gu,
    ) ?? []),
  ]
    .filter((match) => match[1] === match[2])
    .map((match) => match[1]);
  const projectedIds = new Set(projectedKeys);
  if (
    projectedKeys.length !== projectedIds.size ||
    projectedIds.size !== actualIaIds.size ||
    [...actualIaIds].some((id) => !projectedIds.has(id))
  )
    return [
      iaIssue("cross-projection-coverage-mismatch", source.path, source.path),
    ];
  return [];
}
/**
 * IA入口・分析・定義の関係とObject対応の閉包を照合する。
 * @responsibility 取得済みIAモデルの局所不変条件を既存順で照合する。
 * @trace ARCH-000008
 * @input index、analyses、definitions: 解析済みIAモデル。sourcePath: 入口の相対Path。
 * @returns 不一致を表す中立Issue列。
 * @precondition 対象の観測・本文取得は呼出し元が完了している。
 * @postcondition 重複・不足・余剰を成功へ補完しない。
 * @effect N/A: 取得済み入力と局所集合だけを扱う。
 * @failure 例外を伝播し、観測や移行を代行しない。
 * @invariant 現在のIA契約とIssueの順序を維持する。
 * @boundary N/A: 同一Process内のモデル比較。
 * @security 採用・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有状態を持たない。
 */
export function inspectIaRelations(
  index: IaIndexModel,
  analyses: readonly IaAnalysisModel[],
  definitions: readonly IaDefinitionModel[],
  sourcePath: string,
): readonly DomainIssue[] {
  const registryPairKeys = index.pairs;
  const registryPairs = new Set(registryPairKeys);
  const analysisPairKeys = analyses.flatMap((item) => [...item.pairs]);
  const analysisPairs = new Set(analysisPairKeys);
  const definitionPairKeys = definitions.flatMap((item) => [...item.pairs]);
  const definitionPairs = new Set(definitionPairKeys);
  const analysisMappingKeys = analyses.flatMap((item) => [...item.mappingKeys]);
  const analysisMappingKeySet = new Set(analysisMappingKeys);
  const definitionMappingKeys = definitions.flatMap((item) => [
    ...item.mappingKeys,
  ]);
  const definitionMappingKeySet = new Set(definitionMappingKeys);
  const issues: DomainIssue[] = [];
  if (
    registryPairKeys.length !== registryPairs.size ||
    analysisPairKeys.length !== analysisPairs.size ||
    definitionPairKeys.length !== definitionPairs.size ||
    [...registryPairs].some((pair) => !analysisPairs.has(pair)) ||
    [...analysisPairs].some((pair) => !registryPairs.has(pair)) ||
    [...analysisPairs].some((pair) => !definitionPairs.has(pair)) ||
    [...definitionPairs].some((pair) => !analysisPairs.has(pair))
  )
    issues.push(
      iaIssue("analysis-definition-closure-mismatch", sourcePath, sourcePath),
    );
  if (
    analysisMappingKeys.length !== analysisMappingKeySet.size ||
    definitionMappingKeys.length !== definitionMappingKeySet.size ||
    analysisMappingKeySet.size !== definitionMappingKeySet.size ||
    [...analysisMappingKeySet].some(
      (key) => !definitionMappingKeySet.has(key),
    ) ||
    [...definitionMappingKeySet].some((key) => !analysisMappingKeySet.has(key))
  )
    issues.push(
      iaIssue("object-mapping-closure-mismatch", sourcePath, sourcePath),
    );
  return issues;
}
