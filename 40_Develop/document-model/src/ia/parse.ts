/**
 * Iaの文書別完成Parseを提供する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
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
  omitMarkdownCommentsOutsideFencedCode,
} from "../artifact/markdown.ts";
import { parseMarkdownArtifact } from "../artifact/parse-markdown.ts";
import { parseDiagramDisposition } from "../artifact/phase-diagrams.ts";
import type {
  ArtifactSource,
  DocumentIssue,
  ParseResult,
} from "../artifact/types.ts";

import type {
  IaAnalysisModel,
  IaChecklistRequest,
  IaCrossProjectionModel,
  IaDefinitionModel,
  IaDocument,
  IaIndexModel,
  IaObjectRelation,
  IaStateVisibility,
  IaStructureNavigation,
} from "./types.ts";
import {
  exactSecondLevelSection,
  hasExactIaDownstream,
  iaChecklistIssues,
  iaChecklistItems,
  iaIssue,
  localCanonicalName,
  tableRows,
} from "./validation.ts";

/**
 * IA文書の内容とChecklist検査を一つの受付で完了する。
 * @responsibility 原文・出典・可視Checklistを捕捉し、IA固有条件を共通構文へ接続する。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。request: 明示する種別と方式。
 * @returns 部分内容も保持した文書モデルと局所のChecklist失敗理由。
 * @precondition File観測・適用判断は呼出し元が所有する。
 * @postcondition 同じ捕捉本文を評価し、追加read・診断・保存を行わない。
 * @effect N/A: 同期的な局所値処理のみ。
 * @failure 未知kind／modeを拒否し、解析例外を伝播する。
 * @invariant 共通構文エンジンを旧期待列で一回だけ呼び、元の失敗理由を保持する。
 * @boundary 取得済み原文とIA内容モデルの境界。
 * @security 構造成立から工程品質・認可を発行しない。
 * @concurrency N/A: 入力・別受付の値を変更しない。
 */
function captureIaDocument(
  source: ArtifactSource,
  request: IaChecklistRequest,
  checklistContent = source.content,
): IaDocument {
  const captured = { path: source.path, content: source.content };
  if (request.mode !== "template" && request.mode !== "evaluated")
    throw new Error("unknown_ia_checklist_mode");
  const expectedItems = iaChecklistItems(request.kind);
  const failure =
    request.mode === "template"
      ? inspectTemplateChecklist(checklistContent, expectedItems)
      : inspectEvaluatedChecklist(checklistContent, expectedItems);
  return {
    diagramContract:
      request.mode === "template" && request.kind === "index"
        ? parseDiagramDisposition(captured, [
            "オブジェクト／関係図",
            "情報階層図",
            "Navigation図",
            "可視性／状態概念図",
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
 * 横断文書の適用節・ID全出現・集合・出典を捕捉する。
 * @responsibility 文書内の内容捕捉を外部集合との比較から分離する。
 * @trace ARCH-000008
 * @input source: 取得済み本文と相対Path。
 * @returns 適用節の出現・選択結果・ID全出現・集合と出典を持つ内容モデル。
 * @precondition 対象の観測・本文取得は呼出し元が完了している。
 * @postcondition 重複出現を保持し、4節がnullの場合だけ5節を選ぶ。
 * @effect N/A: 取得済み入力と局所集合だけを扱う。
 * @failure 例外を伝播し、観測や移行を代行しない。
 * @invariant exact一意節・空節と欠測・表示IDとPath IDの一致条件を維持する。
 * @boundary 既読本文の内容捕捉。外部集合比較とIssue生成はSemanticが所有する。
 * @security 採用・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有状態を持たない。
 */
function captureIaProjection(source: ArtifactSource): IaCrossProjectionModel {
  const captured = { path: source.path, content: source.content };
  const cross = omitMarkdownCommentsAndFencedCode(captured.content);
  const visible = { path: captured.path, content: cross };
  const projectionSection =
    exactSecondLevelSection(cross, "4. IA定義への適用") ??
    exactSecondLevelSection(cross, "5. IA定義への適用");
  const projectedKeys = [
    ...(projectionSection?.matchAll(
      /\[(IA-[0-9]{6})\]\(Definitions\/(IA-[0-9]{6})\/ia_definition\.md\)/gu,
    ) ?? []),
  ]
    .filter((match) => match[1] === match[2])
    .map((match) => match[1] as string);
  const projectedIds = new Set(projectedKeys);
  return {
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    tableRows: captureDocumentTableRows(visible),
    sectionsFour: captureDocumentSections(visible, "4. IA定義への適用"),
    sectionsFive: captureDocumentSections(visible, "5. IA定義への適用"),
    selectedSection: projectionSection,
    projectedKeys,
    projectedIds,
  };
}

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
export function parseIaIndex(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<IaIndexModel> & Readonly<{ result: IaIndexModel }> {
  const captured = { path: source.path, content: source.content };
  const iaIndex = omitMarkdownCommentsAndFencedCode(captured.content);
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

  const result: IaIndexModel = {
    ...captureIaDocument(captured, {
      kind: "index",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    tableRows: captureDocumentTableRows({
      path: captured.path,
      content: iaIndex,
    }),
    ids: indexedIaIds,
    pairs: registryPairKeys,
    isRowInvalid: isIaRegistryRowInvalid,
  };
  const issues = iaChecklistIssues(result);
  return { status: issues.length ? "partial" : "complete", result, issues };
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
export function parseIaAnalysis(
  artifact: ArtifactSource,
  expectedUxId: string,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<IaAnalysisModel> & Readonly<{ result: IaAnalysisModel }> {
  const captured = { path: artifact.path, content: artifact.content };
  const analysisPairKeys: string[] = [];
  const analysisMappingKeys: string[] = [];
  const issues: DocumentIssue[] = [];
  const analysis = omitMarkdownCommentsAndFencedCode(captured.content);
  const base = captureIaDocument(
    captured,
    {
      kind: "analysis",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    },
    analysis,
  );
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
  const checklistError = base.checklistContract.failure;
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
  const finalIssues =
    options.mode === "template"
      ? iaChecklistIssues(base, expectedUxId)
      : issues;
  return {
    status: finalIssues.length ? "partial" : "complete",
    result: {
      ...base,
      expectedIdentity: expectedUxId,
      tableRows: captureDocumentTableRows({
        path: captured.path,
        content: analysis,
      }),
      receivedMeaning: captureDocumentSections(
        { path: captured.path, content: analysis },
        "1. UXから受け取る意味",
      ),
      information: captureDocumentSections(
        { path: captured.path, content: analysis },
        "2. 情報候補と関係",
      ),
      state: captureDocumentSections(
        { path: captured.path, content: analysis },
        "3. 状態・可視性・導線・責任",
      ),
      implementationReference: captureDocumentSections(
        { path: captured.path, content: analysis },
        "4. 現実照合の参考情報（正式入力ではない）",
      ),
      disposition: captureDocumentSections(
        { path: captured.path, content: analysis },
        "5. IA処置",
      ),
      handoff: captureDocumentSections(
        { path: captured.path, content: analysis },
        "6. 後続工程が保持する意味",
      ),
      supplement: captureDocumentSections(
        { path: captured.path, content: analysis },
        "7. 補足分析",
      ),
      checklist: captureDocumentSections(
        { path: captured.path, content: analysis },
        "Checklist",
      ),
      objects: objectNames,
      objectIdentities,
      pairs: analysisPairKeys,
      mappingKeys: analysisMappingKeys,
    },
    issues: finalIssues,
  };
}

/**
 * IA定義の内容・対応宣言と文書内の不備を捕捉する。
 *
 * @responsibility IA本文と関係の既存判定を所有し、観測と表示を含めない。
 * @trace ARCH-000008
 * @input source: 取得済み本文。expectedIaId: 期待IA ID。options.mode: 通常／ひな型。
 * @returns 情報源・対応列と本文不正のIssue。
 * @precondition sourceは取得済みIA定義である。外部の分析Mapは受け取らない。
 * @postcondition 局所的な対応宣言を保持し、分析Objectの実在・Identity照合はSemanticへ渡す。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・Identity／Relation・N/Aの判定条件を変えない。
 * @boundary N/A: 同一Process内のIAモデル検査。
 * @security 品質全体の成立・認可・移行完了を発行しない。
 * @concurrency N/A: 検査呼出し間の共有可変状態を持たない。
 */
export function parseIaDefinition(
  source: ArtifactSource,
  expectedIaId: string,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<IaDefinitionModel> & Readonly<{ result: IaDefinitionModel }> {
  const captured = { path: source.path, content: source.content };
  const definitionPairKeys: string[] = [];
  const definitionMappingKeys: string[] = [];
  const mappingEvidence: Array<{
    key: string;
    analysisId: string;
    sourceObject: string;
  }> = [];
  const issues: DocumentIssue[] = [];
  const definitionSource = captured.content;
  const definition = omitMarkdownCommentsAndFencedCode(definitionSource);
  const base = captureIaDocument(
    captured,
    {
      kind: "definition",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    },
    definition,
  );
  const structureContent =
    omitMarkdownCommentsOutsideFencedCode(definitionSource);
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
  const checklistError = base.checklistContract.failure;
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
    mappingEvidence.push({
      key,
      analysisId: match[1] as string,
      sourceObject: match[2] as string,
    });
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
      !definitionObjectPairs.has(pair)
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
    ...structureContent.matchAll(/\[O:\s*([^\]]+?)\s*\]/gu),
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
  const finalIssues =
    options.mode === "template"
      ? iaChecklistIssues(base, expectedIaId)
      : issues;
  return {
    status: finalIssues.length ? "partial" : "complete",
    result: {
      mappingEvidence,
      identityEvidence: identityRelationRows.map(
        ([sourceObject, identity]) => ({ sourceObject, identity }),
      ),
      ...base,
      expectedIdentity: expectedIaId,
      tableRows: captureDocumentTableRows({
        path: captured.path,
        content: definition,
      }),
      structureLines: structureContent.split("\n").map((text, index) => ({
        text,
        location: { path: captured.path, line: index + 1 },
      })),
      meaning: captureDocumentSections(
        { path: captured.path, content: definition },
        "意味と利用者成果",
      ),
      identity: captureDocumentSections(
        { path: captured.path, content: definition },
        "対象・識別・関係",
      ),
      state: captureDocumentSections(
        { path: captured.path, content: definition },
        "状態・可視性・時間的な意味",
      ),
      organization: captureDocumentSections(
        { path: captured.path, content: definition },
        "情報の優先度・まとまり・見つけ方・責任",
      ),
      failure: captureDocumentSections(
        { path: captured.path, content: definition },
        "失敗・制約・未確認事項",
      ),
      verification: captureDocumentSections(
        { path: captured.path, content: definition },
        "検証意図",
      ),
      handoff: captureDocumentSections(
        { path: captured.path, content: definition },
        "後続工程との関係",
      ),
      inputs: captureDocumentSections(
        { path: captured.path, content: definition },
        "情報源",
      ),
      supplement: captureDocumentSections(
        { path: captured.path, content: definition },
        "補足分析",
      ),
      checklist: captureDocumentSections(
        { path: captured.path, content: definition },
        "Checklist",
      ),
      pairs: definitionPairKeys,
      mappingKeys: definitionMappingKeys,
    },
    issues: finalIssues,
  };
}
/**
 * IAObjectRelation文書の内容・適用節・局所診断を解析する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export function parseIaObjectRelation(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<IaObjectRelation> & Readonly<{ result: IaObjectRelation }> {
  const captured = { path: source.path, content: source.content };
  const result: IaObjectRelation = {
    ...captureIaDocument(captured, {
      kind: "object_relation",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    projection: captureIaProjection(captured),
    sections: ["1. この投影で分かること", "2. 中心となる関係"].flatMap(
      (heading) => captureDocumentSections(captured, heading),
    ),
  };
  const issues = iaChecklistIssues(result);
  return { status: issues.length ? "partial" : "complete", result, issues };
}
/**
 * IAStructureNavigation文書の内容・適用節・局所診断を解析する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export function parseIaStructureNavigation(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<IaStructureNavigation> &
  Readonly<{ result: IaStructureNavigation }> {
  const captured = { path: source.path, content: source.content };
  const result: IaStructureNavigation = {
    ...captureIaDocument(captured, {
      kind: "structure_navigation",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    projection: captureIaProjection(captured),
    sections: [
      "1. この投影で分かること",
      "2. 情報のまとまり",
      "3. 入口から根拠・次の行動まで",
    ].flatMap((heading) => captureDocumentSections(captured, heading)),
  };
  const issues = iaChecklistIssues(result);
  return { status: issues.length ? "partial" : "complete", result, issues };
}
/**
 * IAStateVisibility文書の内容・適用節・局所診断を解析する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export function parseIaStateVisibility(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<IaStateVisibility> & Readonly<{ result: IaStateVisibility }> {
  const captured = { path: source.path, content: source.content };
  const result: IaStateVisibility = {
    ...captureIaDocument(captured, {
      kind: "state_visibility",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    projection: captureIaProjection(captured),
    sections: [
      "1. この投影で分かること",
      "2. 状態・可視性・時間的な意味",
      "3. 責任と判断権限",
    ].flatMap((heading) => captureDocumentSections(captured, heading)),
  };
  const issues = iaChecklistIssues(result);
  return { status: issues.length ? "partial" : "complete", result, issues };
}
