/**
 * UI文書の意味と二観点の関係を検査する。
 * @responsibility 既読本文の入口・Detail・分析・定義・網羅性・閉包を所有する。
 * @trace ARCH-000008
 */

import type { DocumentIssue } from "../artifact/types.ts";
import type {
  UiAnalysis,
  UiChecklistRequest,
  UiConsistencyRequest,
  UiDefinition,
  UiDetailIndex,
  UiDocument,
  UiIndex,
} from "./types.ts";
/**
 * UI台帳で認識した各登録行の局所条件を評価する。
 * @responsibility 元の行別診断を同じ順・件数で返し、未認識行を登録扱いしない。
 * @trace ARCH-000008
 */
export function validateUiIndex(model: UiIndex): readonly DocumentIssue[] {
  return model.entries.flatMap((entry) =>
    entry.uxIds.length === 0 || entry.iaIds.length === 0
      ? [
          {
            kind: "artifact.ui.registry-row-invalid",
            targetIdentity: model.source.path,
            location: { path: model.source.path },
            reason: "registry-row-invalid",
            details: {},
          },
        ]
      : [],
  );
}

/**
 * 捕捉済みUI分析の観点別契約を検査する。
 * @responsibility 正式入力・必須構文・処置をモデルから評価し本文全体を再解析しない。
 * @trace ARCH-000008
 * @input model: 部分情報を含む分析モデル。
 * @returns 従来順の局所契約Issue。Checklistは構築入口が評価する。
 * @effect N/A: モデル値だけを扱う。
 * @failure 欠測や不一致を成功へ補完しない。
 */
export function validateUiAnalysis(
  model: UiAnalysis,
): readonly DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const analysisUxUi = new Set<string>();
  const analysisIaUi = new Set<string>();
  const source = model.source;
  const expectedInputId = model.expectedIdentity;
  const analysis = {
    includes: (token: string) =>
      model.syntaxTokens.some(({ text }) => text.includes(token)),
  };
  const inputSection =
    model.formalInputs.length === 1 ? model.formalInputs[0]?.body.text : null;
  const dispositionSection =
    model.dispositions.length === 1 ? model.dispositions[0]?.body.text : null;
  const isUxView = model.view === "ux";
  const sourcePattern = isUxView
    ? /UX定義: \[(UX-[0-9]{6})[^\]]*\]\(\.\.\/\.\.\/\.\.\/02_UX\/Definitions\/(UX-[0-9]{6})\/ux_definition\.md\)/u
    : /IA定義: \[(IA-[0-9]{6})[^\]]*\]\(\.\.\/\.\.\/\.\.\/03_IA\/Definitions\/(IA-[0-9]{6})\/ia_definition\.md\)/u;
  const sourceInput = inputSection?.match(sourcePattern);
  const oppositeInputPattern = isUxView
    ? /03_IA\/Definitions|IA-[0-9]{6}/u
    : /02_UX\/Definitions|UX-[0-9]{6}/u;
  const viewPairs = isUxView ? analysisUxUi : analysisIaUi;
  for (const ref of model.targets)
    viewPairs.add(`${expectedInputId}|${ref.identity}`);

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
  return issues;
}

/**
 * Ui定義の明示モデルを局所検査する。
 * @responsibility 捕捉済みの節・参照・構文出現を評価し、文書全体を再解析しない。
 * @trace ARCH-000008
 * @input model: 部分情報を保持した定義モデル。
 * @returns 従来順の契約Issue。Checklistは構築入口で一度だけ評価する。
 * @effect N/A: モデルと局所値だけを扱う。
 * @failure 欠測や不一致を成功へ補完しない。
 */
export function validateUiDefinition(
  model: UiDefinition,
): readonly DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const definitionUxUi = new Set<string>();
  const definitionIaUi = new Set<string>();
  const source = { path: model.artifact.sourceLocation.path };
  const expectedUiId = model.expectedIdentity;
  const definition = {
    includes: (token: string) =>
      model.syntaxTokens.some(({ text }) => text.includes(token)),
  };
  const uxSection =
    model.uxAnalysis.length === 1 ? model.uxAnalysis[0]?.body.text : null;
  const iaSection =
    model.iaAnalysis.length === 1 ? model.iaAnalysis[0]?.body.text : null;
  const formalSection =
    model.formalInputs.length === 1 ? model.formalInputs[0]?.body.text : null;
  for (const ref of model.analysisInputs.ux) {
    const key = `${ref.identity}|${expectedUiId}`;
    definitionUxUi.add(key);
  }
  for (const ref of model.analysisInputs.ia) {
    const key = `${ref.identity}|${expectedUiId}`;
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
  return issues;
}

/**
 * UIが所有する期待項目を選択する。
 * @responsibility 旧文言・順序・派生列と受付間の独立性を維持する。
 * @trace ARCH-000008
 * @input kind: 明示された文書種別。
 * @returns 今回の受付だけが所有する期待項目配列。
 * @precondition 種別を方式やPathから推定しない。
 * @postcondition 固定定義・別受付と配列を共有しない。
 * @effect N/A: 固定値の局所構築のみ。
 * @failure 未知kindを拒否する。
 * @invariant 通常用とTemplate専用の期待列を自動統合しない。
 * @boundary UIの固定条件選択。
 * @security 期待列から品質成立やAuthorityを発行しない。
 * @concurrency N/A: 共有可変値を持たない。
 */
export function uiChecklistItems(kind: UiChecklistRequest["kind"]): string[] {
  const uiAnalysisUxChecklistItemTexts = [
    "正式入力となるUX Definitionを一件だけ特定した",
    "UXの利用者、状況、目的、成果、重要場面および失敗を保持した",
    "必要な認識・操作・Feedbackを評価した",
    "状況による体験差を評価した",
    "UI候補への処置と理由を明示した",
    "IA観点と統合するときの確認事項を明示した",
    "Human Inputの必要性を評価した",
    "Open・GapとUIまたはUXへ戻す条件を明示した",
    "Verification Intentを評価した",
    "IA、REQ、ArchitectureまたはSourceから意味を補完していない",
    "Behavior Ruleを先取りしていない",
    "補足分析へ必須情報を退避していない",
  ];

  const uiAnalysisIaChecklistItemTexts = [
    "正式入力となるIA Definitionを一件だけ特定した",
    "IAのObject、Identity、Relation、State、Visibilityおよび導線を保持した",
    "表示の優先順位とNavigationを評価した",
    "表示差と開示境界を評価した",
    "UI候補への処置と理由を明示した",
    "UX観点と統合するときの確認事項を明示した",
    "Human Inputの必要性を評価した",
    "Open・GapとUIまたはIAへ戻す条件を明示した",
    "Verification Intentを評価した",
    "UX、REQ、ArchitectureまたはSourceから意味を補完していない",
    "Behavior Ruleを先取りしていない",
    "補足分析へ必須情報を退避していない",
  ];

  const uiDefinitionChecklistItemTexts = [
    "UX DefinitionとIA Definitionを正式入力とし、各分析記録を変換根拠として処置した",
    "UX OutcomeとIA Information Contractを保持した",
    "Surface ResponsibilityとInformation Priorityを定義した",
    "Presentation、Interaction、Visible StateおよびFeedbackを定義した",
    "Error・Recovery Presentationを評価した",
    "AccessibilityとVariantの必要性を評価した",
    "Failure・Risk、ConstraintおよびNon-goalを評価した",
    "Human Inputの必要性を評価した",
    "Open・GapとOwner工程へ戻す条件を明示した",
    "Verification Intentを明示した",
    "対応するSPECとのRelationを明示した",
    "Behavior Rule、Architecture方式またはSource実装を先取りしていない",
    "Visual ArtifactだけでContractを代替していない",
    "補足定義へ必須情報を退避していない",
  ];

  const uiDetailIndexChecklistItemTexts = [
    "対象UI Definitionを全件処置した",
    "UI Areaごとの目的とArea Design Guideを示した",
    "Logical ScreenをRouteやFigma Frameと混同していない",
    "Screen PartをHTML要素やLayout wrapperへ過剰発行していない",
    "Interaction、StateおよびVariantを評価した",
    "G1: 対象範囲のScreen Inventoryと正常・分岐・失敗・回復Flowを全件処置した",
    "G1: 大量化し得る一覧・Tree・履歴を全件評価し、全件取得・全件描画を暗黙の前提にしていない",
    "G1: 検索・絞り込み・並び順・継続読込・遅延展開・仮想表示・内容分割の適用を処置した",
    "G1: 取得上限、Continuation、整合、権限境界および部分失敗をSPEC Detailへ引き渡した",
    "G2: G1通過後にHero候補を比較し、代表性と偏りを記録した",
    "G3: Heroについて2案以上のRendered View、Intent、Trade-offおよび保持するUX／IAを比較した",
    "G4: AI提案と人間の方向性判断を分け、採用理由と再探索条件を記録した",
    "Visual SourceとRendered Viewを区別した",
    "G5: 採用DirectionをSecondary Screenへ展開してからPatternを評価した",
    "G5: CMPへの昇格または理由付き非昇格を記録した",
    "視覚的UIがある対象でG1〜G5をN/Aにしていない",
    "未通過Gateより後の成果物をCanonical、完了または下流引き渡し可能と表示していない",
    "SCR／PRT／InteractionとBHVの双方向Coverageを評価した",
    "N/Aに理由、OPENにOwner・影響・戻り条件を記録した",
    "Detailで上流の意味やSystem Behaviorを創作していない",
  ];

  const uiAreaChecklistItemTexts = [
    "Areaの目的、利用者成果、対象UI Definitionを説明できる",
    "情報構造と優先順位を示した",
    "Screen InventoryとFlowを示した",
    "Area共通のCompositionを示した",
    "Interaction、State、FailureおよびRecoveryの原則を示した",
    "Product Visual Baselineを複製せず、適用と例外を分けた",
    "Pattern／CMPの利用規則と非適用条件を評価した",
    "Accessibilityを全項目評価した",
    "避ける表現を明示した",
    "N/Aに理由、OPENにOwner・影響・戻り条件を記録した",
  ];

  const uiScreenChecklistItemTexts = [
    "ScreenをRoute、URLまたはFigma Frameだけで定義していない",
    "利用者の目的、入口、終了条件を明示した",
    "対象UI DefinitionとAreaへ接続した",
    "意味あるPRTを全件示した",
    "Interaction、Feedback、StateおよびVariantを評価した",
    "System Behaviorを伴うInteractionをBHVへ接続した",
    "Failure、Unknown、PendingおよびRecoveryの表示を評価した",
    "Visual BaselineとArea Design Guideの適用を示した",
    "Accessibilityを評価した",
    "Pattern／CMP昇格を反復根拠から判断した",
    "N/Aに理由、OPENにOwner・影響・戻り条件を記録した",
  ];

  const uiComponentChecklistItemTexts = [
    "複数Screen／Areaで反復した根拠がある",
    "共通責務と個別差分を分けた",
    "Input、State、Interaction、Feedbackを定義した",
    "Failure／RecoveryとAccessibilityを評価した",
    "利用規則と非適用条件を示した",
    "BHV対応を評価した",
    "実装FrameworkやClassをComponent Identityにしていない",
    "N/Aに理由、OPENにOwner・影響・戻り条件を記録した",
  ];

  const uiVisualBaselineChecklistItemTexts = [
    "Screen Inventory／Flowの後にHeroを選定した",
    "同じHeroと表示条件で2案以上のRendered Viewを比較した",
    "各DirectionのIntent、Trade-offおよび保持するUX／IAを比較した",
    "AI提案とHuman Direction Decisionを区別した",
    "採用理由と再探索条件を示した",
    "Baselineの全観点を評価した",
    "主要Font Family、Fallback順およびFont未導入時の成立を評価した",
    "見出し、本文、ID／Codeで異なる書体を使う場合は理由を示した",
    "Font Binary同梱をApplicable／N/A／OPENへ処置した",
    "Direction比較前に各案のVisual Design Principleを評価した",
    "本文14px、補助情報12pxを原則下限として例外を理由付き処置した",
    "Type ScaleとSpacingをToken化し、偶発的な値の増殖を避けた",
    "Contrastを測定値または測定可能なTokenで評価した",
    "Pointer／Touch Targetの寸法と間隔を評価した",
    "色だけに依存せず状態を識別できるようにした",
    "長文、大量情報、200%拡大、狭幅およびKeyboard Focusを評価した",
    "汎用Webでは全必須Adaptive Profileを評価し、対象を限定した場合は決定権限者と影響を記録した",
    "全Breakpointの直前／一致／直後と各Layout区間の代表点を評価した",
    "実Browser Zoomと狭幅Viewportの結果を同一視していない",
    "Profileの技術結果と人間の例外受容を分け、FAILをPASSへ書き換えていない",
    "Visual SourceとRendered Viewを区別した",
    "Secondary Screenへ展開して成立を確認した",
    "Human Direction Decision前にBaselineをCanonical化していない",
    "Secondary Screen検証前にPattern／CMPを確定していない",
    "Screenshotだけを正本にしていない",
    "N/Aに理由、OPENにOwner・影響・戻り条件を記録した",
  ];

  const uiSpecHandoffChecklistItemTexts = [
    "UIとSPECの共通正式入力を明示した",
    "UIとSPECの責任境界を区別した",
    "UI別に渡す操作・状態・Feedbackを明示した",
    "Definition対応とDetail対応を区別した",
    "SCR／PRT／InteractionとBHVのCoverageを明示した",
    "既存のDefinition引き渡し結果と新Detail移行結果を区別した",
    "対象改訂版で発行済みのSCR／PRT／BHVとDetail Relationを全件確認した",
    "共通Variantを全UIへ一律適用していない",
    "UI側の引き渡し完了条件を明示した",
    "対応レビュー結果の正本をSPEC側の対応文書へ一本化した",
    "Open・GapとOwner工程へ戻す条件を明示した",
    "UI／SPEC独自の第三仕様を作っていない",
    "補足分析へ必須情報を退避していない",
  ];
  const items = {
    analysis_ux: uiAnalysisUxChecklistItemTexts,
    analysis_ia: uiAnalysisIaChecklistItemTexts,
    definition: uiDefinitionChecklistItemTexts,
    detail_index: uiDetailIndexChecklistItemTexts,
    area: uiAreaChecklistItemTexts,
    screen: uiScreenChecklistItemTexts,
    component: uiComponentChecklistItemTexts,
    visual_baseline: uiVisualBaselineChecklistItemTexts,
    handoff: uiSpecHandoffChecklistItemTexts,
  };
  if (!Object.hasOwn(items, kind)) throw new Error("unknown_ui_checklist_kind");
  return items[kind];
}

/**
 * Ui文書の捕捉済みChecklist不備を局所Issueへ変換する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export function uiChecklistIssues(model: UiDocument): DocumentIssue[] {
  const { kind, mode, failure } = model.checklistContract;
  if (!failure) return [];
  const reason =
    mode === "template"
      ? "template-checklist-invalid"
      : `${kind}-checklist-invalid`;
  return [
    {
      kind: `artifact.ui.${reason}`,
      targetIdentity: model.source.path,
      location: { path: model.source.path },
      reason,
      details: { checklistFailure: failure },
    },
  ];
}

/**
 * UI Detail統合台帳の文書内条件を検査する。
 * @responsibility 行条件・ID重複・Canonical宣言を評価し、外部集合の被覆は扱わない。
 * @trace ARCH-000008
 * @input model: 捕捉済み台帳。
 * @returns 文書内の不備を表すIssue列。Canonical宣言は品質証明ではない。
 * @effect N/A: モデルと集合だけを扱う。
 */
export function validateUiDetailIndex(
  model: UiDetailIndex,
): readonly DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const detailIds = model.entries.map((entry) => entry.identity);
  if (
    model.entries.some(
      (entry) =>
        entry.cells.length !== 6 ||
        entry.applicability !== "Applicable／Covered" ||
        (entry.area ?? "").trim().length === 0 ||
        !entry.screenId ||
        !entry.partId ||
        (entry.reason ?? "").trim().length === 0,
    ) ||
    detailIds.length !== new Set(detailIds).size ||
    !model.declarations.some(({ text }) => text.includes("状態: Canonical"))
  )
    issues.push({
      kind: "artifact.ui.detail-current-coverage-invalid",
      targetIdentity: model.source.path,
      location: { path: model.source.path },
      reason: "detail-current-coverage-invalid",
      details: {},
    });
  return issues;
}

/**
 * UI内部の被覆・出現・関係閉包を比較する。
 * @responsibility 解析済みモデルと取得済み集合から既存順の中立Issueを返す。
 * @trace ARCH-000008
 * @input request: 呼出し元が元の読取り位置で確定したモデル・集合・出現列。
 * @returns 既存局所Issueまたは比較条件のIssue列。全品質Passは表さない。
 * @precondition 読取りと取得範囲は呼出し元が所有する。
 * @postcondition 入力を変更せず、本文・Filesystemを再取得しない。
 * @effect N/A: 同期的な値比較。
 * @failure 未対応種別は拒否し、比較例外は伝播する。
 * @invariant 出現重複、短絡・診断順、局所Issueの優先を維持する。
 * @boundary 同一Process内のUI意味検査。
 * @security 認可・実在・工程完成を発行しない。
 * @concurrency N/A: 共有可変状態なし。
 */
export function inspectUiConsistency(
  request: UiConsistencyRequest,
): readonly DocumentIssue[] {
  switch (request.kind) {
    case "ui_analysis_coverage":
      return inspectUiAnalysisCoverage(
        request.sourcePath,
        request.uxIds,
        request.iaIds,
        request.analysisUxIds,
        request.analysisIaIds,
      );
    case "ui_index_coverage":
      return inspectUiIndexCoverage(
        request.sourcePath,
        request.index,
        request.actualUiIds,
      );
    case "ui_relations":
      return inspectUiRelations(
        request.sourcePath,
        request.index,
        request.analyses,
        request.definitions,
      );
    case "ui_detail_coverage": {
      const { detail, actualIds } = request;
      const model = detail.result;
      const ids = model.entries.map((entry) => entry.identity);
      const invalid = detail.issues.find(
        (issue) => issue.kind === "artifact.ui.detail-current-coverage-invalid",
      );
      const mismatch =
        ids.length !== actualIds.size ||
        ids.some((id) => !actualIds.has(id)) ||
        [...actualIds].some((id) => !ids.includes(id)) ||
        new Set(
          model.entries.flatMap((entry) =>
            entry.screenId ? [entry.screenId] : [],
          ),
        ).size !== actualIds.size ||
        new Set(
          model.entries.flatMap((entry) =>
            entry.partId ? [entry.partId] : [],
          ),
        ).size !== actualIds.size;
      return invalid
        ? [invalid]
        : mismatch
          ? [
              {
                kind: "artifact.ui.detail-current-coverage-invalid",
                targetIdentity: model.source.path,
                location: { path: model.source.path },
                reason: "detail-current-coverage-invalid",
                details: {},
              },
            ]
          : [];
    }
    default:
      throw new TypeError("ui_consistency_kind_invalid");
  }
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
function inspectUiAnalysisCoverage(
  sourcePath: string,
  uxIds: ReadonlySet<string>,
  iaIds: ReadonlySet<string>,
  analysisUxIds: ReadonlySet<string>,
  analysisIaIds: ReadonlySet<string>,
): readonly DocumentIssue[] {
  const issues: DocumentIssue[] = [];
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
function inspectUiIndexCoverage(
  sourcePath: string,
  index: UiIndex,
  actualUiIds: ReadonlySet<string>,
): readonly DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const registryUiIds = new Set(index.entries.map((entry) => entry.identity));
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
function inspectUiRelations(
  sourcePath: string,
  index: UiIndex,
  analyses: readonly UiAnalysis[],
  definitions: readonly UiDefinition[],
): readonly DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const registryUxUiKeys = index.entries.flatMap((entry) =>
    entry.uxIds.map((id) => `${id}|${entry.identity}`),
  );
  const registryIaUiKeys = index.entries.flatMap((entry) =>
    entry.iaIds.map((id) => `${id}|${entry.identity}`),
  );
  const registryUxUi = new Set(registryUxUiKeys);
  const registryIaUi = new Set(registryIaUiKeys);
  const analysisUxUiKeys = analyses.flatMap((model) =>
    model.view === "ux"
      ? model.targets.map((ref) => `${model.expectedIdentity}|${ref.identity}`)
      : [],
  );
  const analysisIaUiKeys = analyses.flatMap((model) =>
    model.view === "ia"
      ? model.targets.map((ref) => `${model.expectedIdentity}|${ref.identity}`)
      : [],
  );
  const analysisUxUi = new Set(analysisUxUiKeys);
  const analysisIaUi = new Set(analysisIaUiKeys);
  const definitionUxUiKeys = definitions.flatMap((model) =>
    model.analysisInputs.ux.map(
      (ref) => `${ref.identity}|${model.expectedIdentity}`,
    ),
  );
  const definitionIaUiKeys = definitions.flatMap((model) =>
    model.analysisInputs.ia.map(
      (ref) => `${ref.identity}|${model.expectedIdentity}`,
    ),
  );
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
