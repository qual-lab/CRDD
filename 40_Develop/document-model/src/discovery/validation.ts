/**
 * Discovery文書の局所条件を検査する。
 * @responsibility 固定Checklist・raw構造・最初の探索参照と診断順を所有する。
 * @trace ARCH-000008
 */
import {
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
} from "../artifact/checklist.ts";
import { parseArtifact } from "../artifact/parse-markdown.ts";
import type {
  ArtifactModel,
  ArtifactSource,
  DocumentIssue,
  ParseResult,
} from "../artifact/types.ts";
import type {
  DiscoveryAnalysis,
  DiscoveryChecklistRequest,
  DiscoveryDefinition,
  DiscoveryDocument,
  DiscoveryIndex,
} from "./types.ts";

/**
 * Discoveryが所有する三種類の期待項目を選択する。
 * @responsibility 元の項目・順序と受付間の独立性を維持する。
 * @trace ARCH-000008
 * @input kind: 明示された文書種別。
 * @returns 今回の受付が所有する期待項目配列。
 * @precondition Pathから種別を推定しない。
 * @postcondition 固定定義・別受付と配列を共有しない。
 * @effect N/A: 固定値の局所構築のみ。
 * @failure 未知kindを拒否する。
 * @invariant 旧三種類の項目文言・順序を変更しない。
 * @boundary Discoveryの固定条件選択。
 * @security 期待列から採用判断やAuthorityを発行しない。
 * @concurrency N/A: 共有可変値を持たない。
 */
function discoveryChecklistItems(
  kind: DiscoveryChecklistRequest["kind"],
): string[] {
  const discoveryRootChecklistItemTexts = [
    "すべての探索記録と採用要求を台帳から一意に辿れる。",
    "採用済みの判断、探索中の候補、保留、棄却および未確認事項を区別した。",
    "複数探索の関係、競合または合流候補を、個別記録の第二の正本を作らず示した。",
    "Version別の作業予定や未完了TaskをDiscoveryの判断として複製していない。",
    "基本図を現行図、既存参照、理由付き非該当または作成不能として処置した。",
    "UXその他へ渡す現在の判断、保持条件およびDiscoveryへ戻す条件が分かる。",
    "人間理解の確認が必要な探索について、理解確認と要求採用を区別した。",
    "発火した理解確認について、AIの事前理解、人間の修正、有力な代替または反証、および確認後の現在理解を個別探索から辿れる。",
    "補足情報や台帳が個別探索・要求定義の第二の正本になっていない。",
  ];

  const discoveryExplorationChecklistItemTexts = [
    "情報源と、情報源から確認できる範囲を示した。",
    "事前入力からAIが意味を再構成した場合、AIの事前理解、人間の修正および確認後の現在理解を区別した。",
    "現在案を変え得る有力な代替または反証を人間と突き合わせるか、該当する案がない理由を示した。",
    "人間理解の確認と、要求・方針の採用判断を分けた。",
    "人間が抽象的な問題や要求を言語化できることを前提にせず、具体的な出来事、行動、迷い、回避策または比較から問題仮説を引き出した。",
    "発言の少なさ、回答不能または沈黙を、同意、問題不存在または要求採用へ読み替えていない。",
    "確認できた事実と、そこから導いた解釈・仮説を区別した。",
    "解決策ではなく、本質的な問題を説明した。",
    "技術名称を除いても、誰が何に困っているか理解できる。",
    "影響を受ける人または判断する人を特定した。",
    "どのような変化を期待するか説明した。",
    "原因と解決に関する仮説を、事実として扱っていない。",
    "未確認事項と不確実性を明示した。",
    "人間による確認または判断が必要かを評価した。",
    "情報不足をAIの推測だけで補っていない。",
    "失敗、リスク、制約および対象外を評価した。",
    "採用、不採用、保留を区別した。",
    "次工程が保持すべき問題、変化および条件を示した。",
    "情報不足時にDiscoveryへ戻す条件を示した。",
    "因果、比較または時系列を図示する必要性を判定し、作成または理由付きN/Aとして処置した。",
    "補足分析へ必須情報を退避していない。",
  ];

  const discoveryRequirementChecklistItemTexts = [
    "要求だけを読んでも、必要な変化を理解できる。",
    "探索元と採用判断を一意に辿れる。",
    "対象、利用状況、問題および望ましい変化を説明した。",
    "特定の画面、実装または技術方式へ不要に固定していない。",
    "要求として採用した理由と主要な代替を示した。",
    "正常時の成立条件を判定可能な形で示した。",
    "不完全・異常・境界時にも守る条件を示した。",
    "成立主張を破る反証条件を示した。",
    "失敗、リスクおよび制約を評価した。",
    "対象外を明示した。",
    "未確認事項と人間確認の必要性を評価した。",
    "情報不足をAIの推測だけで補っていない。",
    "検証意図を、具体的な試験項目を先取りせず説明した。",
    "UXが探索記録を直接読まず、この定義だけから分析を開始できる。",
    "下流工程の結論をDiscoveryへ逆輸入していない。",
    "補足分析へ必須情報を退避していない。",
  ];
  const items = {
    index: discoveryRootChecklistItemTexts,
    analysis: discoveryExplorationChecklistItemTexts,
    definition: discoveryRequirementChecklistItemTexts,
  };
  if (!Object.hasOwn(items, kind))
    throw new Error("unknown_discovery_checklist_kind");
  return items[kind];
}

/**
 * 固定定義を指定方式の共通構文検査へ接続する。
 * @responsibility 受付ごとに期待列を独立させ、旧失敗理由を保持する。
 * @trace ARCH-000008
 * @input content: 取得済み原文。request: 内部の固定種別と明示方式。
 * @returns 期待列・方式・元の失敗理由。
 * @effect N/A: 同期値処理のみ。
 * @failure 未知種別・方式と解析例外を拒否する。
 */
export function inspectDiscoveryChecklist(
  content: string,
  request: DiscoveryChecklistRequest,
): DiscoveryDocument["checklistContract"] {
  if (request.mode !== "template" && request.mode !== "evaluated")
    throw new Error("unknown_discovery_checklist_mode");
  const expectedItems = discoveryChecklistItems(request.kind);
  const failure =
    request.mode === "template"
      ? inspectTemplateChecklist(content, expectedItems)
      : inspectEvaluatedChecklist(content, expectedItems);
  return { ...request, expectedItems, failure };
}

/**
 * 捕捉済みChecklist不備を文書別の中立診断へ変換する。
 * @responsibility ひな型と正本の診断を区別し、失敗理由を補完しない。
 * @trace ARCH-000008
 * @input document: 捕捉済み文書。targetIdentity: 期待IDまたは文書Path。
 * @returns 不備一件または空列。
 * @effect N/A: 同期値変換。
 * @failure 値操作の例外を伝播する。
 */
function discoveryChecklistIssues(
  document: DiscoveryDocument,
  targetIdentity: string,
): DocumentIssue[] {
  const { failure, kind, mode } = document.checklistContract;
  if (!failure) return [];
  const reason =
    mode === "template"
      ? "template-checklist-invalid"
      : `${kind}-checklist-invalid`;
  return [
    {
      kind: `artifact.discovery.${reason}`,
      reason,
      targetIdentity,
      location: { path: document.source.path },
      details: { checklistFailure: failure },
    },
  ];
}

/**
 * 捕捉済みDiscovery定義の局所不備を返す。
 * @responsibility 通常文書の構造→Checklist順とひな型の限定条件を維持する。
 * @trace ARCH-000008
 * @input result: 文書モデル。
 * @returns 順序付き中立診断。
 * @effect N/A: 同期値検査。
 * @failure 不備を補完せず解析例外を伝播する。
 */
export function validateDiscoveryDefinition(
  result: DiscoveryDefinition,
): readonly DocumentIssue[] {
  const definition = result.source.content;
  const requirementId = result.expectedIdentity;
  const issues: DocumentIssue[] = [];
  const requiredDefinitionSections = [
    "## 対象と利用状況",
    "## 解く問題と望ましい変化",
    "## 採用理由と比較",
    "## 成立条件",
    "## 検証意図",
    "## 関係",
  ];
  const hasPlaceholder =
    /REQ-XXXXXX|EXP-XXXXXX|UX-XXXXXX|TODO|TBD|（要求名）|（探索名）/u.test(
      definition,
    );
  const sourceRelation = result.originReferences[0];
  if (
    result.checklistContract.mode === "evaluated" &&
    (!definition.includes(`要求ID: \`${requirementId}\``) ||
      !definition.includes("成果物種別: Discovery定義") ||
      !definition.includes("## 要求") ||
      requiredDefinitionSections.some(
        (heading) => !definition.includes(heading),
      ) ||
      !/## (?:制約|失敗・リスク・制約)/u.test(definition) ||
      !/## (?:工程引渡し|UXへの引き渡し)/u.test(definition) ||
      hasPlaceholder ||
      !sourceRelation ||
      sourceRelation.identity !== sourceRelation.pathIdentity)
  )
    issues.push({
      kind: "artifact.discovery.definition-contract-invalid",
      targetIdentity: requirementId,
      location: { path: result.source.path },
      reason: "definition-contract-invalid",
      details: {},
    });
  issues.push(...discoveryChecklistIssues(result, requirementId));
  return issues;
}

/**
 * 捕捉済みDiscovery分析の局所不備を返す。
 * @responsibility 通常文書の構造→Checklist順とひな型の限定条件を維持する。
 * @trace ARCH-000008
 * @input result: 文書モデル。
 * @returns 順序付き中立診断。
 * @effect N/A: 同期値検査。
 * @failure 不備を補完せず解析例外を伝播する。
 */
export function validateDiscoveryAnalysis(
  result: DiscoveryAnalysis,
): readonly DocumentIssue[] {
  const analysis = result.source.content;
  const explorationId = result.expectedIdentity;
  const issues: DocumentIssue[] = [];
  if (
    result.checklistContract.mode === "evaluated" &&
    (!analysis.includes("成果物種別: Discovery分析") ||
      !analysis.includes(`探索ID: \`${explorationId}\``))
  )
    issues.push({
      kind: "artifact.discovery.analysis-contract-invalid",
      targetIdentity: explorationId,
      location: { path: result.source.path },
      reason: "analysis-contract-invalid",
      details: {},
    });
  issues.push(...discoveryChecklistIssues(result, explorationId));
  return issues;
}

/**
 * 台帳のChecklist局所不備を返す。
 * @responsibility 採用集合の内容を失わず局所診断を分離する。
 * @trace ARCH-000008
 * @input result: 台帳モデル。
 * @returns 不備一件または空列。
 * @effect N/A: 同期値検査。
 * @failure 不備を成功へ補完しない。
 */
export function validateDiscoveryIndex(
  result: DiscoveryIndex,
): readonly DocumentIssue[] {
  return discoveryChecklistIssues(result, result.source.path);
}

/**
 * 任意Markdownの内容モデルとDiscovery参照の局所診断を構築する。
 * @responsibility 取得済みモデルから既存順の中立Issueを返す。
 * @trace ARCH-000008
 * @input source: 文書種別を絞らず既存の全Markdown観測から取得した本文・出典。
 * @returns ArtifactModelと参照出現ごとのIssue。一般Artifactの局所Issueは混ぜない。
 * @precondition 実体観測は呼出し元が完了している。
 * @postcondition 入力を変更せず、本文やFilesystemを再取得しない。
 * @effect N/A: 同期的な値比較。
 * @failure 比較例外を伝播し、不明を補完しない。
 * @invariant 短絡・診断順と既存の対象範囲を維持する。
 * @boundary 同一Process内の工程意味検査。
 * @security 実在・認可・全品質の成立を保証しない。
 * @concurrency N/A: 共有可変状態なし。
 */
export function parseDiscoveryReferences(
  source: ArtifactSource,
): ParseResult<ArtifactModel> & Readonly<{ result: ArtifactModel }> {
  const result = parseArtifact(source).result;
  const file = result.source.path;
  const issues = result.identity.links
    .filter(
      (link) =>
        link.identity.startsWith("REQ-") &&
        link.target
          .replaceAll("\\", "/")
          .includes("01_Discovery/Analysis/EXP-"),
    )
    .map((link) => ({
      kind: "artifact.document-identity.discovery-identity-link-owner-mismatch",
      targetIdentity: file,
      location: { path: file },
      reason: "discovery-identity-link-owner-mismatch",
      details: { value0: link.identity },
    }));
  return { status: issues.length ? "partial" : "complete", result, issues };
}
