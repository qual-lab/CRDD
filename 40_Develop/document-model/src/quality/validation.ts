/**
 * Quality文書の局所検査とQuality内の照合規則を所有する。
 * @packageDocumentation
 * @trace ARCH-000008
 */
import type { ArtifactModel, DocumentIssue } from "../artifact/types.ts";
import type {
  QualityChecklistRequest,
  QualityDocument,
  QualityAnalysis,
  QualityAnalysisInspection,
  QualityIntegration,
  QualityConsistencyRequest,
  QualityDefinitionModel,
  QualityLocalItemOwnershipModel,
} from "./types.ts";

/**
 * Qualityが所有する九種類の期待項目を選ぶ。
 * @responsibility 元の項目順・派生挿入位置・呼出し独立性を維持する。
 * @trace ARCH-000008
 * @input kind: 明示されたQuality文書の種類。
 * @returns 今回の受付だけが所有する期待項目列。
 * @precondition 種類は呼出し元が明示し、Pathから推定しない。
 * @postcondition 共通Artifactや別呼出しと配列を共有しない。
 * @effect N/A: 固定文字列の局所構築のみ。
 * @failure 未知kindを拒否する。
 * @invariant 既存九種類の文言・順序を変更しない。
 * @boundary Qualityの固定条件選択。
 * @security 期待項目は品質成立やAuthorityを意味しない。
 * @concurrency N/A: 共有可変値を持たない。
 */
export function qualityChecklistItems(
  kind: QualityChecklistRequest["kind"],
): string[] {
  const qualityCenterChecklistItemTexts = [
    "現在の品質状態と結論を履歴より先に示した",
    "Canonical入力、検証目標およびLocal Itemの現在数を説明できる",
    "既存Canonical入力CoverageとUI／SPEC Detail由来の具体的観測条件を区別して全数接続した",
    "Designed、Implemented、Executed、PassedおよびEvidenceの状態を区別した",
    "未成立、停止、要再確認および観測不能を正常へ畳んでいない",
    "Quality ReadyとReality Audit開始条件を過大表示していない",
    "重大な問題、残存Riskおよび人間判断の必要性を評価した",
    "現在状態から分析、定義、実行結果およびEvidenceへ辿れる",
    "過去版の詳細を第二の現在正本として複製していない",
  ];

  const qualityStrategyChecklistItemTexts = [
    "Productと利用者にとって守る品質を説明した",
    "主要な品質Riskと成立主張を破る失敗を示した",
    "各工程が所有するQuality Analysis責任を区別した",
    "UT／IT／ST／UATをSource種別へ固定せず検証義務から選ぶ方針を示した",
    "外部境界をlifecycle全体と段階的な結合で検証する方針を示した",
    "RT／PT／LTの適用を評価し、PT／LTは人間の明示指定なしに実行しない",
    "根拠、停止条件、再評価条件および完了境界を示した",
    "例外またはRisk受容を人間の決定権限から分離していない",
  ];

  const qualityVerificationDesignChecklistItemTexts = [
    "検証対象、正式入力および実行入口を区別した",
    "UT／IT／ST／UATの適用判断を検証義務ごとに行える",
    "外部境界の直接、隣接1 block、関連2 blocks、System／E2Eおよび利用者受入の段階を扱える",
    "正常、境界、準正常、異常および回復を検証設計へ含めた",
    "観測、Oracle、Evidenceおよび終了後条件を区別した",
    "実行、停止、取消および再入場条件を示した",
    "RT／PT／LTの適用を評価し、PT／LTは人間の明示指定なしに実行しない",
    "網羅、未評価範囲、完了条件およびReality Auditへの接続を示した",
  ];

  const qualityIntegrationChecklistItemTexts = [
    "全Canonical IDを一件以上のQuality Analysis行で処置した",
    "Source固有の成功、失敗、Riskおよび未確認事項を保持した",
    "UI／SPEC Definition由来とDetail由来の検証義務を区別して統合した",
    "Source ID、検証目標、試験段階およびLocal Itemを一意に接続した",
    "5横断モデルと全Architecture詳細設計領域を処置した",
    "Quality Integrationだけで第三の要求・設計・検証契約を作っていない",
    "上流の未確認事項をUAT、OPEN義務または上流再開のいずれかへ処置した",
    "検証目標とLocal Itemの重複、孤立および未接続を残していない",
    "現行Source、TestまたはEvidenceからCanonical検証義務を逆算していない",
  ];

  const qualityRealityAuditChecklistItemTexts = [
    "Canonical Quality設計の固定後にだけReality Auditを開始した",
    "基準版Capabilityと過去Evidenceを比較入力として特定した",
    "現行Source、TestおよびRegistryをCanonical設計の正解として扱っていない",
    "必要な検証をCovered、Partial、Missing、LegacyまたはGapへ分類した",
    "未Commit状態とVersion Control Adapterの交換可能性を検証対象へ含めた",
    "照合対象のRevision、実行条件および観測限界を固定した",
    "不足Test、未実行項目およびEvidence Gapを追跡した",
    "PT／LTの適用と実行Authorityを評価し、明示指定がない場合は実行していない",
  ];

  const qualityVerificationResultChecklistItemTexts = [
    "対象改訂版と実行条件を固定した",
    "実際の結果と期待結果を区別した",
    "検証項目結果と検証義務評価を接続した",
    "未確認範囲と残存Riskを示した",
    "適用関係、無効化条件および再検証条件を示した",
    "Quality Centerへの反映要否を評価した",
    "保存するEvidenceと保存しない機密情報・生データを区別した",
    "11項目の必須適用判断を全数処置した",
    "N/Aに理由を、OPENに理由・影響・確認先・再評価契機を記録した",
    "PT／LTを人間の指定なく実行していない",
  ];

  const qualityAnalysisTemplateChecklistItemTexts = [
    "対象工程の全Canonical IDを一件以上処置した",
    "各Source固有の成功、境界、失敗、Riskおよび観測不能を分析した",
    "表題や共通定型句ではなくSource固有の検証義務を記録した",
    "意味の近い義務を統合してもSource固有条件を失っていない",
    "各Sourceと検証目標、試験段階およびLocal Itemを接続した",
    "必要検証義務を既存Local ItemやTestから逆算していない",
    "Required／Definedの集合差、Level不一致およびRelation不明を評価した",
    "上流の未確認事項をUAT、OPEN義務または上流再開へ処置した",
    "現行Source、TestまたはEvidenceから検証義務を逆算していない",
    "未解決事項、判断者および再評価契機を明示した",
  ];

  const qualityAnalysisDetailTemplateChecklistItemTexts = [
    qualityAnalysisTemplateChecklistItemTexts[0] as string,
    qualityAnalysisTemplateChecklistItemTexts[1] as string,
    "Definition由来の成立条件とDetail由来の具体的観測条件を区別した",
    ...qualityAnalysisTemplateChecklistItemTexts.slice(2),
  ];

  const qualityDefinitionTemplateChecklistItemTexts = [
    "Quality ID、検証目標およびSource固有条件を自己完結して示した",
    "各Local ItemをRequired Verification Obligationの局所参照と導出元へ接続した",
    "UT／IT／ST／UATの適用または理由付きN/Aを記録した",
    "外部境界の直接、隣接1 block、関連2 blocks、System／E2Eおよび利用者受入を適用判定した",
    "正常、境界、準正常、異常および回復をLocal Itemで処置した",
    "各Local Itemで観測とOracleを分けた",
    "各Local ItemのEvidence要件を示した",
    "事前条件、刺激、終了後条件、cleanupおよびRecoveryを必要な範囲で示した",
    "RT／PT／LTの適用または理由付きN/Aを記録し、PT／LTは人間の明示指定なしに実行しない",
    "自動化、手動確認および人間判断の境界を示した",
    "現行Source、TestおよびEvidenceとの照合をReality Auditへ分離した",
  ];
  const items = {
    center: qualityCenterChecklistItemTexts,
    strategy: qualityStrategyChecklistItemTexts,
    verification_design: qualityVerificationDesignChecklistItemTexts,
    integration: qualityIntegrationChecklistItemTexts,
    reality_audit: qualityRealityAuditChecklistItemTexts,
    verification_result: qualityVerificationResultChecklistItemTexts,
    analysis: qualityAnalysisTemplateChecklistItemTexts,
    analysis_detail: qualityAnalysisDetailTemplateChecklistItemTexts,
    definition: qualityDefinitionTemplateChecklistItemTexts,
  };
  if (!Object.hasOwn(items, kind))
    throw new Error("unknown_quality_checklist_kind");
  return items[kind];
}

/**
 * 完成した品質文書のChecklist不備を局所Issueへ分離する。
 * @responsibility 同じ捕捉で得た失敗理由を保持し、品質成立へ読み替えない。
 * @trace ARCH-000008
 */
export function qualityChecklistIssues(
  document: QualityDocument,
): DocumentIssue[] {
  const contract = document.checklistContract;
  return contract?.failure
    ? [
        {
          kind: "artifact.quality.checklist-invalid",
          targetIdentity: document.source.path,
          location: { path: document.source.path },
          reason: "checklist-invalid",
          details: { checklistFailure: contract.failure },
        },
      ]
    : [];
}

/**
 * 工程別Quality分析の情報源・目標・条件・Local Item関係を解析・照合する。
 * @responsibility 工程別Quality分析の情報源・目標・条件・Local Item関係を解析・照合する。
 * @trace ARCH-000008
 * @input phaseAnalyses: 解析済み工程文書。canonicalIds: 同じ取得範囲の観測済み期待集合（全実在の保証ではない）。integration: 解析済み統合文書。analysisRoot: 診断位置。
 * @returns 各モデルの関係を出現順・後勝ち規則で合成し、節取得可否hasCoverageSectionsと外部被覆・重複・閉包の診断を返す。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不正な行と集合条件をIssueで返し、取得できた部分関係を保持する。
 * @invariant 正常時の本文条件と診断順を維持し、欠測時も取得済み関係の不正を隠さない。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectQualityAnalysis(
  phaseAnalyses: readonly QualityAnalysis[],
  canonicalIds: ReadonlySet<string>,
  integration: QualityIntegration,
  analysisRoot: string,
): QualityAnalysisInspection {
  const analysisPath = integration.source.path;
  const hasCoverageSections = phaseAnalyses.every((model) =>
    Boolean(model.coverage[0]?.text),
  );
  const data = phaseAnalyses.map((model) => model.relationData);
  const issues: DocumentIssue[] = [];
  const mappingRows = data.flatMap((d) => d.mappingRows);
  const mappedIds = new Set(data.flatMap((d) => [...d.mappedIds]));
  const summarySourceGoalRelationEntries = data.flatMap(
    (d) => d.summarySourceGoalRelationEntries,
  );
  const summarySourceGoalRelations = new Set(summarySourceGoalRelationEntries);
  const summarySourceLevels = new Map<string, Set<string>>();
  const goalLabelToSlug = new Map<string, string>();
  for (const d of data) {
    for (const [source, levels] of d.summarySourceLevels) {
      const merged = summarySourceLevels.get(source) ?? new Set<string>();
      for (const level of levels) merged.add(level);
      summarySourceLevels.set(source, merged);
    }
    for (const [label, slug] of d.goalLabelToSlug)
      goalLabelToSlug.set(label, slug);
  }
  const analysisSourceRelationEntries = data.flatMap(
    (d) => d.analysisSourceRelationEntries,
  );
  const analysisSourceRelations = new Set(analysisSourceRelationEntries);
  const analysisSourceGoalRelationEntries = data.flatMap(
    (d) => d.analysisSourceGoalRelationEntries,
  );
  const analysisSourceGoalRelations = new Set(
    analysisSourceGoalRelationEntries,
  );
  const analysisObligationKeyEntries = data.flatMap(
    (d) => d.analysisObligationKeyEntries,
  );
  const analysisSourceConditions = new Map(
    data.flatMap((d) => [...d.analysisSourceConditions]),
  );
  const analysisSourceGoalLevels = new Map(
    data.flatMap((d) => [...d.analysisSourceGoalLevels]),
  );
  const analysisObligationKeys = new Map(
    data.flatMap((d) => [...d.analysisObligationKeys]),
  );
  if (
    (hasCoverageSections &&
      (canonicalIds.size !== mappedIds.size ||
        [...canonicalIds].some((id) => !mappedIds.has(id)))) ||
    [...mappedIds].some((id) => !canonicalIds.has(id))
  )
    issues.push({
      kind: "artifact.quality-analysis.canonical-mapping-coverage-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "canonical-mapping-coverage-mismatch",
      details: {},
    });

  if (new Set(mappingRows).size !== mappingRows.length)
    issues.push({
      kind: "artifact.quality-analysis.canonical-mapping-duplicate-row",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "canonical-mapping-duplicate-row",
      details: {},
    });
  if (
    summarySourceGoalRelationEntries.length !== summarySourceGoalRelations.size
  )
    issues.push({
      kind: "artifact.quality-analysis.canonical-source-goal-duplicate",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "canonical-source-goal-duplicate",
      details: {},
    });

  if (data.some((d) => !d.hasSourceRelations))
    issues.push({
      kind: "artifact.quality-analysis.source-local-relation-section-missing",
      targetIdentity: analysisRoot,
      location: { path: analysisRoot },
      reason: "source-local-relation-section-missing",
      details: {},
    });
  for (const d of data)
    for (const _line of d.incompleteRelations)
      issues.push({
        kind: "artifact.quality-analysis.source-local-relation-incomplete",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "source-local-relation-incomplete",
        details: {},
      });
  if (analysisSourceGoalRelations.size === 0)
    issues.push({
      kind: "artifact.quality-analysis.source-local-relation-section-missing-empty-relations",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "source-local-relation-section-missing-empty-relations",
      details: {},
    });
  if (
    analysisSourceGoalRelationEntries.length !==
      analysisSourceGoalRelations.size ||
    analysisSourceRelationEntries.length !== analysisSourceRelations.size ||
    analysisObligationKeyEntries.length !==
      new Set(analysisObligationKeyEntries).size
  )
    issues.push({
      kind: "artifact.quality-analysis.source-relation-duplicate",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "source-relation-duplicate",
      details: {},
    });
  if (
    (hasCoverageSections &&
      summarySourceGoalRelations.size !== analysisSourceGoalRelations.size) ||
    [...summarySourceGoalRelations].some(
      (relation) => !analysisSourceGoalRelations.has(relation),
    ) ||
    (hasCoverageSections &&
      [...analysisSourceGoalRelations].some(
        (relation) => !summarySourceGoalRelations.has(relation),
      ))
  )
    issues.push({
      kind: "artifact.quality-analysis.source-goal-relation-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "source-goal-relation-closure-mismatch",
      details: {},
    });

  const { crossModelRows, crossModelReferences } = integration;
  return {
    hasCoverageSections,
    summarySourceLevels,
    goalLabelToSlug,
    analysisSourceRelations,
    analysisSourceConditions,
    analysisSourceGoalLevels,
    analysisObligationKeys,
    crossModelRows,
    crossModelReferences,
    issues,
  };
}

/**
 * 指定された各成果物にCanonical状態を要求する。
 *
 * @responsibility 欠落・非Canonicalを一成果物一Issueで返し、入力順を維持する。
 * @trace ARCH-000008
 * @input artifacts: 呼出し元が検査対象として選んだ解析済み成果物集合。
 * @returns 不一致のDocumentIssue列。元statusとnormalizedStatusを分離して返す。
 * @precondition 対象集合の選択とreadinessの適用判断は呼出し元が所有する。
 * @postcondition 正規化後がCanonical以外の成果物だけを入力順に返す。
 * @effect N/A: 入力の読取りと局所的な配列構築だけを行う。
 * @failure 欠落または非CanonicalをIssueで返し、例外や正常値へ丸めない。
 * @invariant 入力Artifact・集合・共有状態を変更しない。
 * @boundary N/A: 解析済みモデル間の純粋計算である。
 * @security 空のIssue列は与えられた集合の状態条件だけを表し、品質全体の完成を表さない。
 * @concurrency N/A: 共有可変状態を持たない同期処理である。
 */
function inspectQualityDesignStates(
  artifacts: readonly ArtifactModel[],
): readonly DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  for (const artifact of artifacts) {
    const normalizedStatus = normalizeQualityDesignState(artifact.status ?? "");
    if (normalizedStatus !== "Canonical")
      issues.push({
        kind: "artifact.quality-design.state-invalid",
        targetIdentity: artifact.canonicalId ?? artifact.sourceLocation.path,
        location: artifact.sourceLocation,
        reason: "canonical_state_required",
        details: { status: artifact.status, normalizedStatus },
      });
  }
  return issues;
}

/**
 * Quality分析と定義の情報源・条件・段階・Detail関係の双方向閉包を照合する。
 * @responsibility Quality分析と定義の情報源・条件・段階・Detail関係の双方向閉包を照合する。
 * @trace ARCH-000008
 * @input request: 定義モデル列・完成分析結果・統合モデルと診断位置。関係・条件・段階は内部導出する。
 * @returns 重複、情報源・目標・条件・段階・Detail関係の閉包不一致Issue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 関係条件不一致をIssueで返し、入力を変更しない。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function inspectQualityDefinitionRelations(
  request: Extract<
    QualityConsistencyRequest,
    { kind: "quality_definition_relations" }
  >,
) {
  const { definitionsRoot, analysisPath } = request;
  const {
    definitionSourceRelations,
    definitionSourceRelationEntries,
    definitionSourceConditions,
    definitionSourceGoalLevels,
    definitionObligationKeys,
    definitionObligationKeyEntries,
    definitionDetailGoalRelations,
    definitionDetailGoalRelationEntries,
    definitionGoalLocalRelations,
    definitionGoalLocalRelationEntries,
    localItemLevels,
  } = collectQualityDefinitionRelations(request.definitions);
  const {
    analysisSourceRelations,
    analysisSourceConditions,
    analysisSourceGoalLevels,
    analysisObligationKeys,
    summarySourceLevels,
  } = request.analysis;
  const { analysisDetailGoalRelations } = request.integration.detailUnitData;
  const issues: DocumentIssue[] = [];
  if (definitionSourceRelationEntries.length !== definitionSourceRelations.size)
    issues.push({
      kind: "artifact.quality-relations.definition-source-relation-duplicate",
      targetIdentity: definitionsRoot,
      location: { path: definitionsRoot },
      reason: "definition-source-relation-duplicate",
      details: {},
    });
  if (
    definitionGoalLocalRelationEntries.length !==
    definitionGoalLocalRelations.size
  )
    issues.push({
      kind: "artifact.quality-relations.definition-goal-local-relation-duplicate",
      targetIdentity: definitionsRoot,
      location: { path: definitionsRoot },
      reason: "definition-goal-local-relation-duplicate",
      details: {},
    });
  if (
    definitionDetailGoalRelationEntries.length !==
    definitionDetailGoalRelations.size
  )
    issues.push({
      kind: "artifact.quality-relations.definition-detail-goal-relation-duplicate",
      targetIdentity: definitionsRoot,
      location: { path: definitionsRoot },
      reason: "definition-detail-goal-relation-duplicate",
      details: {},
    });
  if (
    analysisDetailGoalRelations.size !== definitionDetailGoalRelations.size ||
    [...analysisDetailGoalRelations].some(
      (relation) => !definitionDetailGoalRelations.has(relation),
    ) ||
    [...definitionDetailGoalRelations].some(
      (relation) => !analysisDetailGoalRelations.has(relation),
    )
  )
    issues.push({
      kind: "artifact.quality-relations.detail-goal-relation-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "detail-goal-relation-closure-mismatch",
      details: {},
    });

  if (
    analysisSourceRelations.size !== definitionSourceRelations.size ||
    [...analysisSourceRelations].some(
      (relation) => !definitionSourceRelations.has(relation),
    ) ||
    [...definitionSourceRelations].some(
      (relation) => !analysisSourceRelations.has(relation),
    )
  )
    issues.push({
      kind: "artifact.quality-relations.source-local-relation-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "source-local-relation-closure-mismatch",
      details: {},
    });
  if (
    definitionObligationKeyEntries.length !==
      new Set(definitionObligationKeyEntries).size ||
    analysisObligationKeys.size !== definitionObligationKeys.size ||
    [...analysisObligationKeys].some(
      ([relation, obligationKey]) =>
        definitionObligationKeys.get(relation) !== obligationKey,
    ) ||
    [...definitionObligationKeys].some(
      ([relation, obligationKey]) =>
        analysisObligationKeys.get(relation) !== obligationKey,
    )
  )
    issues.push({
      kind: "artifact.quality-relations.obligation-key-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "obligation-key-closure-mismatch",
      details: {},
    });
  for (const [
    sourceGoalRelation,
    requestedLevels,
  ] of analysisSourceGoalLevels) {
    const relatedLocalIds = Array.from(analysisSourceRelations)
      .filter((relation) => relation.startsWith(`${sourceGoalRelation}|`))
      .map((relation) => relation.slice(sourceGoalRelation.length + 1));
    const relatedLevels = new Set(
      relatedLocalIds.flatMap((localId) => {
        const level = localItemLevels.get(localId);
        return level ? [level] : [];
      }),
    );
    for (const requestedLevel of requestedLevels)
      if (!relatedLevels.has(requestedLevel))
        issues.push({
          kind: "artifact.quality-relations.source-test-level-coverage-mismatch",
          targetIdentity: analysisPath,
          location: { path: analysisPath },
          reason: "source-test-level-coverage-mismatch",
          details: {},
        });
  }
  for (const [sourceId, requestedLevels] of summarySourceLevels) {
    const decomposedLevels = new Set<string>();
    for (const [sourceGoalRelation, levels] of analysisSourceGoalLevels)
      if (sourceGoalRelation.startsWith(`${sourceId}|`))
        for (const level of levels) decomposedLevels.add(level);
    if (
      (request.analysis.hasCoverageSections &&
        requestedLevels.size !== decomposedLevels.size) ||
      [...requestedLevels].some((level) => !decomposedLevels.has(level))
    )
      issues.push({
        kind: "artifact.quality-relations.source-test-level-decomposition-mismatch",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "source-test-level-decomposition-mismatch",
        details: { value0: String(sourceId) },
      });
  }
  if (
    analysisSourceGoalLevels.size !== definitionSourceGoalLevels.size ||
    [...analysisSourceGoalLevels].some(([relation, levels]) => {
      const definitionLevels = definitionSourceGoalLevels.get(relation);
      return (
        !definitionLevels ||
        levels.size !== definitionLevels.size ||
        [...levels].some((level) => !definitionLevels.has(level))
      );
    })
  )
    issues.push({
      kind: "artifact.quality-relations.definition-source-test-level-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "definition-source-test-level-closure-mismatch",
      details: {
        value0: String(
          JSON.stringify(
            [...analysisSourceGoalLevels].map(([relation, levels]) => [
              relation,
              [...levels],
            ]),
          ),
        ),
        value1: String(
          JSON.stringify(
            [...definitionSourceGoalLevels].map(([relation, levels]) => [
              relation,
              [...levels],
            ]),
          ),
        ),
      },
    });
  if (
    analysisSourceConditions.size !== definitionSourceConditions.size ||
    [...analysisSourceConditions].some(
      ([relation, condition]) =>
        definitionSourceConditions.get(relation) !== condition,
    ) ||
    [...definitionSourceConditions].some(
      ([relation, condition]) =>
        analysisSourceConditions.get(relation) !== condition,
    )
  )
    issues.push({
      kind: "artifact.quality-relations.source-condition-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "source-condition-closure-mismatch",
      details: {},
    });

  return issues;
}

/**
 * Quality統合と定義の目標別Local Item関係を照合する。
 * @responsibility Quality統合と定義の目標別Local Item関係を照合する。
 * @trace ARCH-000008
 * @input request: 定義モデル列・統合モデルと診断位置。目標とLocal Itemの関係は内部導出する。
 * @returns 目標とLocal Itemの重複・閉包不一致Issue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不一致をIssueで返す。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function inspectQualityGoalLocalRelations(
  request: Extract<
    QualityConsistencyRequest,
    { kind: "quality_goal_local_relations" }
  >,
) {
  const { analysisPath } = request;
  const { listedGoalLocalRelationEntries, listedGoalLocalRelations } =
    request.integration.localItemData;
  const { definitionGoalLocalRelations } = collectQualityDefinitionRelations(
    request.definitions,
  );
  const issues: DocumentIssue[] = [];
  if (listedGoalLocalRelationEntries.length !== listedGoalLocalRelations.size)
    issues.push({
      kind: "artifact.quality-relations.goal-local-relation-duplicate",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "goal-local-relation-duplicate",
      details: {},
    });
  if (
    listedGoalLocalRelations.size !== definitionGoalLocalRelations.size ||
    [...listedGoalLocalRelations].some(
      (relation) => !definitionGoalLocalRelations.has(relation),
    ) ||
    [...definitionGoalLocalRelations].some(
      (relation) => !listedGoalLocalRelations.has(relation),
    )
  )
    issues.push({
      kind: "artifact.quality-relations.goal-local-relation-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "goal-local-relation-closure-mismatch",
      details: {},
    });

  return issues;
}

/**
 * 品質設計の状態文字列から版表記とReleased Baseline句を除く。
 *
 * @responsibility 先頭の版、末尾の全角括弧句、trimの既存適用順を維持する。
 * @trace ARCH-000008
 * @input state: 判定する状態文字列。
 * @returns Canonical判定用の状態文字列。
 * @precondition stateは文字列である。
 * @postcondition 正規化後の文字列だけを返す。
 * @effect N/A: 文字列の局所計算だけを行う。
 * @failure N/A: 独自の失敗分岐を持たない。
 * @invariant 入力や共有状態を変更しない。
 * @boundary N/A: 同一Process内の純粋計算である。
 * @security 正規化は品質の成立や認可を意味しない。
 * @concurrency N/A: 共有可変状態を持たない同期処理である。
 */
function normalizeQualityDesignState(state: string): string {
  return state
    .replace(/^v\d+\.\d+\.\d+\s+/u, "")
    .replace(/（Released Baseline:[^）]+）$/u, "")
    .trim();
}

/**
 * Quality内部の状態・閉包・件数を取得済みモデルと完成分析結果から比較する。
 * @responsibility 状態・内部閉包の診断を返し、他工程の意味判断や実体取得をしない。
 * @input request: 同じ呼出し位置で取得したQualityモデル・完成分析結果と診断位置。
 * @returns 既存の順序・理由の診断列。空結果は全品質Passではない。
 * @effect N/A: 入力の純粋比較だけを行う。
 * @failure 未知kindは拒否し、空成功や別条件へ切り替えない。
 */
export function inspectQualityConsistency(
  request: QualityConsistencyRequest,
): readonly DocumentIssue[] {
  switch (request.kind) {
    case "quality_coverage_sections":
      return request.analyses.every((model) => Boolean(model.coverage[0]?.text))
        ? []
        : [
            {
              kind: "artifact.quality-analysis.canonical-mapping-section-missing",
              targetIdentity: request.analysisRoot,
              location: { path: request.analysisRoot },
              reason: "canonical-mapping-section-missing",
              details: {},
            },
          ];
    case "quality_definition_closure":
      return request.analysis.hasCoverageSections &&
        request.linkedDefinitionPaths.size === 0
        ? [
            {
              kind: "artifact.quality-analysis.definition-closure-missing",
              targetIdentity: request.analysisPath,
              location: { path: request.analysisPath },
              reason: "definition-closure-missing",
              details: {},
            },
          ]
        : [];
    case "quality_definition_coverage": {
      const {
        analysis,
        linkedDefinitionPaths,
        physicalDefinitionPaths,
        definitionsRoot,
      } = request;
      return (analysis.hasCoverageSections &&
        (physicalDefinitionPaths.size !== linkedDefinitionPaths.size ||
          [...physicalDefinitionPaths].some(
            (p) => !linkedDefinitionPaths.has(p),
          ))) ||
        [...linkedDefinitionPaths].some((p) => !physicalDefinitionPaths.has(p))
        ? [
            {
              kind: "artifact.quality-analysis.definition-set-mismatch",
              targetIdentity: definitionsRoot,
              location: { path: definitionsRoot },
              reason: "definition-set-mismatch",
              details: {},
            },
          ]
        : [];
    }
    case "quality_local_item_count":
      return request.document.localItemCount !== request.localItemOwners.size
        ? [
            {
              kind: "artifact.quality-analysis.local-verification-item-count-mismatch",
              targetIdentity: request.document.source.path,
              location: { path: request.document.source.path },
              reason: "local-verification-item-count-mismatch",
              details: {},
            },
          ]
        : [];
    case "quality_design_states":
      return inspectQualityDesignStates(request.artifacts);
    case "quality_definition_relations":
      return inspectQualityDefinitionRelations(request);
    case "quality_goal_local_relations":
      return inspectQualityGoalLocalRelations(request);
    case "quality_reality_state": {
      const { center, reality } = request;
      const issues = reality.issues.filter(
        (issue) =>
          issue.kind ===
          "artifact.quality-analysis.reality-audit-state-invalid",
      );
      const state = reality.result.stateDeclarations[0]?.text ?? "";
      const allowed =
        (center.normalizedQualityState ===
          "Quality Design Under Review — Reality Audit Blocked" &&
          state === "Blocked — Quality Design Review Pending") ||
        (center.isQualityDesignReady &&
          ["Pending — Not Started", "In Progress"].includes(state)) ||
        (center.isQualityReady && state === "Complete");
      if (center.isQualityStateKnown && !allowed)
        issues.push({
          kind: "artifact.quality-analysis.state-reality-audit-state-mismatch",
          targetIdentity: center.source.path,
          location: { path: center.source.path },
          reason: "state-reality-audit-state-mismatch",
          details: {},
        });
      return issues;
    }

    case "quality_goals": {
      const { analysisPath } = request;
      const { crossModelRows, goalLabelToSlug, hasCoverageSections } =
        request.analysis;
      const issues: DocumentIssue[] = [];

      const crossModelGoals = new Set<string>();
      for (const cells of crossModelRows) {
        const goalSlug = goalLabelToSlug.get(cells[0] as string);
        if ((!goalSlug && hasCoverageSections) || cells.length !== 6) {
          issues.push({
            kind: "artifact.quality-analysis.cross-model-row-invalid",
            targetIdentity: analysisPath,
            location: { path: analysisPath },
            reason: "cross-model-row-invalid",
            details: {},
          });
          continue;
        }
        if (goalSlug && crossModelGoals.has(goalSlug))
          issues.push({
            kind: "artifact.quality-analysis.cross-model-goal-duplicate",
            targetIdentity: analysisPath,
            location: { path: analysisPath },
            reason: "cross-model-goal-duplicate",
            details: { value0: String(goalSlug) },
          });
        if (goalSlug) crossModelGoals.add(goalSlug);
        for (const disposition of cells.slice(1))
          if (disposition !== "Required" && !/^N\/A:\s*\S.+/u.test(disposition))
            issues.push({
              kind: "artifact.quality-analysis.cross-model-disposition-invalid",
              targetIdentity: analysisPath,
              location: { path: analysisPath },
              reason: "cross-model-disposition-invalid",
              details: {},
            });
      }
      const goalSlugs = new Set(goalLabelToSlug.values());
      if (
        hasCoverageSections &&
        (crossModelGoals.size !== goalSlugs.size ||
          [...goalSlugs].some((goalSlug) => !crossModelGoals.has(goalSlug)) ||
          [...crossModelGoals].some((goalSlug) => !goalSlugs.has(goalSlug)))
      )
        issues.push({
          kind: "artifact.quality-analysis.cross-model-goal-coverage-mismatch",
          targetIdentity: analysisPath,
          location: { path: analysisPath },
          reason: "cross-model-goal-coverage-mismatch",
          details: {},
        });

      return issues;
    }

    default:
      throw new TypeError("quality_consistency_kind_invalid");
  }
}

/**
 * Local ID出現列の所有重複を検査する。
 * @responsibility Local ID出現列の所有重複を検査する。
 * @trace ARCH-000008
 * @input definition: 完成Parseが捕捉した定義モデル。existingOwners: 以前の定義までのOwner Map。
 * @returns 先勝ちのOwner Map複製と出現ごとの重複Issue。
 * @precondition 本文検査後の元位置で呼び、集合化していない出現列を渡す。
 * @postcondition 入力Mapを変更せず、重複時にOwnerを上書きしない。
 * @effect N/A: 同期的な値処理。
 * @failure 解析例外を伝播し、不明を正常値に補完しない。
 * @invariant 同一File内重複も検出し、既存のpreviousOwnerの真偽判定を維持する。
 * @boundary N/A: Process内のQuality文書意味検査。
 * @security 認可・実在・実行許可・品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectQualityLocalItemOwnership(
  definition: QualityDefinitionModel,
  existingOwners: ReadonlyMap<string, string>,
): QualityLocalItemOwnershipModel {
  const {
    source: { path: sourcePath },
    localIds,
  } = definition;
  const owners = new Map(existingOwners),
    issues: DocumentIssue[] = [];
  for (const localId of localIds) {
    const previousOwner = owners.get(localId);
    if (previousOwner)
      issues.push({
        kind: "artifact.quality.local-verification-id-duplicate",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "local-verification-id-duplicate",
        details: { localId, previousOwner },
      });
    else owners.set(localId, sourcePath);
  }
  return { owners, issues };
}

/**
 * 取得済み品質定義の関係・段階情報を出現順で集約する。
 * @responsibility 文書順、Set初出順、Map後勝ちと段階Setの独立複製を所有する。
 * @trace ARCH-000008
 * @input definitions: partialを含む解析済み定義モデル列。
 * @returns 比較ごとに独立した関係列・Set・Map。
 * @precondition 入力のParseと実体観測は完了している。
 * @postcondition 入力とそのSet・Mapを変更しない。
 * @effect N/A: 同期的な値集約だけを行う。
 * @failure 値の操作例外を伝播し、欠測を補完しない。
 * @invariant 局所Issue・Owner・実在を再判定せず、入力を除外しない。
 * @boundary Quality内部と下流Semanticの共有投影。Rootへ公開しない。
 * @security 集約成立を実在・品質Pass・認可へ昇格しない。
 * @concurrency 共有可変状態を保持しない。
 */
export function collectQualityDefinitionRelations(
  definitions: readonly QualityDefinitionModel[],
) {
  const definitionSourceRelations = new Set<string>();
  const definitionSourceRelationEntries: string[] = [];
  const definitionSourceConditions = new Map<string, string>();
  const definitionSourceGoalLevels = new Map<string, Set<string>>();
  const definitionObligationKeys = new Map<string, string>();
  const definitionObligationKeyEntries: string[] = [];
  const definitionDetailGoalRelations = new Set<string>();
  const definitionDetailGoalRelationEntries: string[] = [];
  const definitionGoalLocalRelations = new Set<string>();
  const definitionGoalLocalRelationEntries: string[] = [];
  const localItemLevels = new Map<string, string>();
  const localItemBoundaryStages = new Map<string, string>();
  for (const model of definitions) {
    for (const value of model.sourceRelations)
      definitionSourceRelations.add(value);
    for (const relation of model.sourceRelationEntries)
      definitionSourceRelationEntries.push(relation);
    for (const [key, value] of model.sourceConditions)
      definitionSourceConditions.set(key, value);
    for (const [key, value] of model.sourceGoalLevels)
      definitionSourceGoalLevels.set(key, new Set(value));
    for (const [key, value] of model.obligationKeys)
      definitionObligationKeys.set(key, value);
    for (const key of model.obligationKeyEntries)
      definitionObligationKeyEntries.push(key);
    for (const value of model.detailGoalRelations)
      definitionDetailGoalRelations.add(value);
    for (const relation of model.detailGoalRelationEntries)
      definitionDetailGoalRelationEntries.push(relation);
    for (const value of model.goalLocalRelations)
      definitionGoalLocalRelations.add(value);
    for (const relation of model.goalLocalRelationEntries)
      definitionGoalLocalRelationEntries.push(relation);
    for (const [key, value] of model.localItemLevels)
      localItemLevels.set(key, value);
    for (const [key, value] of model.localItemBoundaryStages)
      localItemBoundaryStages.set(key, value);
  }
  return {
    definitionSourceRelations,
    definitionSourceRelationEntries,
    definitionSourceConditions,
    definitionSourceGoalLevels,
    definitionObligationKeys,
    definitionObligationKeyEntries,
    definitionDetailGoalRelations,
    definitionDetailGoalRelationEntries,
    definitionGoalLocalRelations,
    definitionGoalLocalRelationEntries,
    localItemLevels,
    localItemBoundaryStages,
  };
}

/**
 * 分岐網羅表の件数・範囲・実測率の算術を検査する。
 * @responsibility 分岐網羅表の件数・範囲・実測率の算術を検査する。
 * @trace ARCH-000008
 * @input artifact: 生本文と診断位置。
 * @returns numericRowsCheckedと、非数値・範囲・件数・率の不一致Issue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不正値と算術条件をIssueで返し、解析例外を伝播する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectBranchCoverageTable(artifact: ArtifactModel) {
  const issues: DocumentIssue[] = [];
  const sourcePath = artifact.sourceLocation.path;
  let numericRowsChecked = 0;
  const lines = artifact.verificationLines;
  for (let index = 0; index < lines.length - 2; index += 1) {
    const headers = lines[index]?.cells;
    if (!headers) continue;
    const numeratorIndex = headers.findIndex((header) =>
      ["到達分岐数（分子）", "Covered Branches (Numerator)"].includes(header),
    );
    const denominatorIndex = headers.findIndex((header) =>
      ["対象分岐数（分母）", "Total Branches (Denominator)"].includes(header),
    );
    const percentageIndex = headers.findIndex((header) =>
      ["実測率", "Measured Rate"].includes(header),
    );
    if (
      numeratorIndex < 0 ||
      denominatorIndex < 0 ||
      percentageIndex < 0 ||
      lines[index + 1]?.separatorCellCount !== headers.length
    ) {
      continue;
    }
    for (let row = index + 2; row < lines.length; row += 1) {
      const cells = lines[row]?.cells;
      if (!cells) break;
      const values = [
        cells[numeratorIndex] ?? "",
        cells[denominatorIndex] ?? "",
        cells[percentageIndex] ?? "",
      ].map((value) => value.trim()) as [string, string, string];
      if (values.every((value) => value === "")) continue;
      const marker =
        /^(?:N\/A|TBD|Not Applicable|Not Measured|対象外|未測定)$/iu;
      if (values.filter(Boolean).every((value) => marker.test(value))) {
        continue;
      }
      const countPattern = /^-?\d+(?:,\d{3})*$/u;
      const percentagePattern = /^-?\d+(?:\.\d+)?%?$/u;
      if (
        !countPattern.test(values[0]) ||
        !countPattern.test(values[1]) ||
        !percentagePattern.test(values[2])
      ) {
        issues.push({
          kind: "artifact.document-rule.branch-coverage-value",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "branch-coverage-value",
          details: { value0: String(row + 1) },
        });
        continue;
      }
      const numerator = Number(values[0].replaceAll(",", ""));
      const denominator = Number(values[1].replaceAll(",", ""));
      const percentage = Number(
        values[2].replaceAll(",", "").replace(/%$/u, ""),
      );
      numericRowsChecked += 1;
      if (
        !Number.isInteger(numerator) ||
        !Number.isInteger(denominator) ||
        numerator < 0 ||
        denominator <= 0 ||
        percentage < 0 ||
        percentage > 100
      ) {
        issues.push({
          kind: "artifact.document-rule.branch-coverage-range",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "branch-coverage-range",
          details: { value0: String(row + 1) },
        });
        continue;
      }
      if (numerator > denominator) {
        issues.push({
          kind: "artifact.document-rule.branch-coverage-count",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "branch-coverage-count",
          details: {
            value0: String(row + 1),
            value1: String(numerator),
            value2: String(denominator),
          },
        });
      }
      const expected = (numerator / denominator) * 100;
      if (Math.abs(expected - percentage) > 0.11) {
        issues.push({
          kind: "artifact.document-rule.branch-coverage-percentage",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "branch-coverage-percentage",
          details: {
            value0: String(row + 1),
            value1: String(numerator),
            value2: String(denominator),
            value3: String(expected.toFixed(2)),
            value4: String(percentage),
          },
        });
      }
    }
  }

  return { numericRowsChecked, issues };
}

/**
 * 是正表の状態・解決条件・阻害条件と必要値を検査する。
 * @responsibility 是正表の状態・解決条件・阻害条件と必要値を検査する。
 * @trace ARCH-000008
 * @input artifact: 生本文と診断位置。
 * @returns remediationRowsCheckedと、状態・解決・阻害条件のIssue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不正条件をIssueで返し、解析例外を伝播する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectRemediationTable(artifact: ArtifactModel) {
  const issues: DocumentIssue[] = [];
  const sourcePath = artifact.sourceLocation.path;
  let remediationRowsChecked = 0;
  const remediationHeaderAliases = {
    progress: ["処置進捗", "Remediation Progress"],
    blocker: ["阻害状態", "Remediation Blocker State", "Blocker State"],
    resolution: ["解消判定", "Remediation Resolution Verdict", "Resolution"],
    acceptance: ["受入条件", "Acceptance"],
    oracle: ["判定方法", "Oracle"],
    evidence: ["根拠", "Evidence"],
    review: ["独立再レビュー", "Independent Review"],
    current: ["現在状態への反映", "Current Projection"],
    blockerReason: ["阻害理由", "Blocker Reason"],
    requiredInput: ["必要事項", "Required Input"],
    owner: ["担当責任者", "Owner"],
    restart: ["再開条件", "Restart Condition"],
  };
  /**
   * current-profileで使用するRemediation Columnの値契約を定義する。
   *
   * @responsibility Remediation ColumnのProperty、Identity、状態制約を型境界として所有する。
   * @trace ARCH-000008
   * @shape RemediationColumnが表すProperty、識別子およびRelationを型として固定する。
   * @invariant RemediationColumnで宣言した値と責務の対応を維持する。
   * @boundary N/A: RemediationColumnの宣言は外部境界を開かない。
   * @security N/A: RemediationColumnはAuthority、秘密値または信頼判断を扱わない。
   * @compatibility RemediationColumnの利用側は宣言済みPropertyと型制約だけへ依存する。
   */
  type RemediationColumn = keyof typeof remediationHeaderAliases;
  const remediationPlaceholder =
    /^(?:|[-—–]|N\/A|TBD|TODO|None|なし|未定|未取得|未確認|対象外)$/iu;

  const lines = artifact.verificationLines;
  for (let index = 0; index < lines.length - 2; index += 1) {
    const headers = lines[index]?.cells;
    if (!headers) continue;
    const column = (name: RemediationColumn): number =>
      headers.findIndex((header) =>
        remediationHeaderAliases[name].includes(header),
      );
    const progressIndex = column("progress");
    const blockerIndex = column("blocker");
    const resolutionIndex = column("resolution");
    const stateColumnIndexes = [progressIndex, blockerIndex, resolutionIndex];
    const stateColumnCount = stateColumnIndexes.filter(
      (target) => target >= 0,
    ).length;
    let precedingHeading = "";
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      if (/^\s*#{1,6}\s+/u.test(lines[previous]?.text ?? "")) {
        precedingHeading = lines[previous]?.text ?? "";
        break;
      }
    }
    const hasExplicitRemediationContext =
      /(?:是正|remediation)/iu.test(precedingHeading) ||
      headers.some((header) =>
        ["是正対象", "Remediation Target"].includes(header),
      );
    if (
      (stateColumnCount !== 3 &&
        !(stateColumnCount >= 1 && hasExplicitRemediationContext)) ||
      lines[index + 1]?.separatorCellCount !== headers.length
    ) {
      continue;
    }
    const stateColumns: Array<readonly [RemediationColumn, number]> = [
      ["progress", progressIndex],
      ["blocker", blockerIndex],
      ["resolution", resolutionIndex],
    ];
    const missingStateColumns = stateColumns.filter(([, target]) => target < 0);
    if (missingStateColumns.length > 0) {
      issues.push({
        kind: "artifact.document-rule.remediation-state-columns-missing",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "remediation-state-columns-missing",
        details: {
          value0: String(index + 1),
          value1: String(
            missingStateColumns
              .map(([name]) => remediationHeaderAliases[name][0])
              .join(", "),
          ),
        },
      });
    }
    const optionalColumns = new Map<RemediationColumn, number>();
    for (const name of Object.keys(remediationHeaderAliases)) {
      if (name in remediationHeaderAliases) {
        const knownName =
          name === "progress" ||
          name === "blocker" ||
          name === "resolution" ||
          name === "acceptance" ||
          name === "oracle" ||
          name === "evidence" ||
          name === "review" ||
          name === "current" ||
          name === "blockerReason" ||
          name === "requiredInput" ||
          name === "owner" ||
          name === "restart"
            ? name
            : null;
        if (knownName !== null)
          optionalColumns.set(knownName, column(knownName));
      }
    }
    for (let row = index + 2; row < lines.length; row += 1) {
      const cells = lines[row]?.cells;
      if (!cells) break;
      if (cells.every((cell) => cell === "")) continue;
      remediationRowsChecked += 1;
      const progress = progressIndex >= 0 ? (cells[progressIndex] ?? "") : "";
      const blocker = blockerIndex >= 0 ? (cells[blockerIndex] ?? "") : "";
      const resolution =
        resolutionIndex >= 0 ? (cells[resolutionIndex] ?? "") : "";
      const location = `line ${row + 1}`;
      if (/^fixed$/iu.test(progress) || /^fixed$/iu.test(resolution)) {
        issues.push({
          kind: "artifact.document-rule.ambiguous-remediation-state",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "ambiguous-remediation-state",
          details: { value0: String(location) },
        });
      }
      if (
        progressIndex >= 0 &&
        !["Identified", "Planned", "Applied", "Self-checked"].includes(progress)
      ) {
        issues.push({
          kind: "artifact.document-rule.remediation-progress-value",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "remediation-progress-value",
          details: { value0: String(location) },
        });
      }
      if (blockerIndex >= 0 && !["None", "Blocked"].includes(blocker)) {
        issues.push({
          kind: "artifact.document-rule.remediation-blocker-value",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "remediation-blocker-value",
          details: { value0: String(location) },
        });
      }
      if (resolutionIndex >= 0 && !["Open", "Resolved"].includes(resolution)) {
        issues.push({
          kind: "artifact.document-rule.remediation-resolution-value",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "remediation-resolution-value",
          details: { value0: String(location) },
        });
      }
      const requireValues = (
        names: readonly RemediationColumn[],
        code: string,
        shouldRequireValues: boolean,
      ): void => {
        if (!shouldRequireValues) return;
        const missingNames = names.filter((name) => {
          const targetIndex = optionalColumns.get(name) ?? -1;
          return (
            targetIndex < 0 ||
            remediationPlaceholder.test(cells[targetIndex] ?? "")
          );
        });
        if (missingNames.length > 0) {
          issues.push({
            kind: `artifact.document-rule.${code}`,
            targetIdentity: sourcePath,
            location: { path: sourcePath },
            reason: code,
            details: {
              value0: String(location),
              value1: String(
                missingNames
                  .map((name) => remediationHeaderAliases[name][0])
                  .join(", "),
              ),
            },
          });
        }
      };
      requireValues(
        ["acceptance", "oracle", "evidence", "review", "current"],
        "premature-remediation-resolution",
        resolution === "Resolved",
      );
      if (
        resolution === "Resolved" &&
        (progress !== "Self-checked" || blocker !== "None")
      ) {
        issues.push({
          kind: "artifact.document-rule.inconsistent-remediation-state",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "inconsistent-remediation-state",
          details: { value0: String(location) },
        });
      }
      requireValues(
        ["blockerReason", "requiredInput", "owner", "restart"],
        "incomplete-remediation-blocker",
        blocker === "Blocked",
      );
    }
  }

  return { remediationRowsChecked, issues };
}
