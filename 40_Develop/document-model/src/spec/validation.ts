/**
 * SPEC分析・登録表・定義の意味モデルを検査する。
 * @responsibility 既読本文から関係と順序付き中立Issueを生成する。
 * @trace ARCH-000008
 */

import type { DocumentIssue } from "../artifact/types.ts";
import type {
  SpecAnalysis,
  SpecChecklistRequest,
  SpecDefinition,
  SpecDetailIndex,
  SpecDocument,
  SpecIndex,
} from "./types.ts";

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
 * 捕捉済みSPEC分析の観点別契約を検査する。
 * @responsibility 正式入力・必須構文・処置をモデルから評価し本文全体を再解析しない。
 * @trace ARCH-000008
 * @input model: 部分情報を含む分析モデル。
 * @returns 従来順の局所契約Issue。Checklistは構築入口が評価する。
 * @effect N/A: モデル値だけを扱う。
 * @failure 欠測や不一致を成功へ補完しない。
 */
export function validateSpecAnalysis(
  model: SpecAnalysis,
): readonly DocumentIssue[] {
  const artifact = model.source;
  const identity = model.expectedIdentity;
  const source = {
    includes: (token: string) =>
      model.syntaxTokens.some(({ text }) => text.includes(token)),
  };
  const isUx = model.view === "ux";
  const issues: DocumentIssue[] = [];
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
    model.formalInputs[0]?.boundary === "heading"
      ? model.formalInputs[0].body.text
      : "";
  const currentRelations = model.targets.map(
    (ref) => `${identity}|${ref.identity}`,
  );

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
  return issues;
}

/**
 * SPEC登録台帳の重複を出現順を失わず検査する。
 * @responsibility 登録ID・入力関係・UI関係のいずれかの重複を既存の一診断へ返す。
 * @trace ARCH-000008
 */
export function validateSpecIndex(model: SpecIndex): readonly DocumentIssue[] {
  const ids = model.entries.map((entry) => entry.identity);
  const relations = model.entries.flatMap((entry) =>
    [...entry.uxIds, ...entry.iaIds].map((id) => `${id}|${entry.identity}`),
  );
  const pairs = model.entries.flatMap((entry) =>
    entry.uiIds.map((id) => `${id}|${entry.identity}`),
  );
  return hasDuplicate(ids) || hasDuplicate(relations) || hasDuplicate(pairs)
    ? [
        {
          kind: "artifact.spec.registry-relation-duplicate",
          targetIdentity: model.source.path,
          location: { path: model.source.path },
          reason: "registry-relation-duplicate",
          details: {},
        },
      ]
    : [];
}

/**
 * Spec定義の明示モデルを局所検査する。
 * @responsibility 捕捉済みの節・参照・構文出現を評価し、文書全体を再解析しない。
 * @trace ARCH-000008
 * @input model: 部分情報を保持した定義モデル。
 * @returns 従来順の契約Issue。Checklistは構築入口で一度だけ評価する。
 * @effect N/A: モデルと局所値だけを扱う。
 * @failure 欠測や不一致を成功へ補完しない。
 */
export function validateSpecDefinition(
  model: SpecDefinition,
): readonly DocumentIssue[] {
  const artifact = { path: model.artifact.sourceLocation.path };
  const identity = model.expectedIdentity;
  const source = {
    includes: (token: string) =>
      model.syntaxTokens.some(({ text }) => text.includes(token)),
  };
  const issues: DocumentIssue[] = [];
  const definitionUiPairOccurrences: string[] = [];
  const uxInputSection = model.uxAnalysis[0]?.body.text ?? "";
  const iaInputSection = model.iaAnalysis[0]?.body.text ?? "";
  const formalSection = model.formalInputs[0]?.body.text ?? "";
  const uiSection = model.interfaces[0]?.body.text ?? "";
  const acceptanceSection = model.acceptance[0]?.body.text ?? "";
  const uiPairLine = model.interfaceDisposition?.text ?? "";
  for (const ref of model.pairedInterfaces)
    definitionUiPairOccurrences.push(`${ref.identity}|${identity}`);
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
  return issues;
}

/**
 * SPECが所有する期待項目を選択する。
 * @responsibility 旧文言・順序・派生列と受付間の独立性を維持する。
 * @trace ARCH-000008
 * @input kind: 明示された文書種別。
 * @returns 今回の受付だけが所有する期待項目配列。
 * @precondition 種別を方式やPathから推定しない。
 * @postcondition 固定定義・別受付と配列を共有しない。
 * @effect N/A: 固定値の局所構築のみ。
 * @failure 未知kindを拒否する。
 * @invariant 通常用とTemplate専用の期待列を自動統合しない。
 * @boundary SPECの固定条件選択。
 * @security 期待列から品質成立やAuthorityを発行しない。
 * @concurrency N/A: 共有可変値を持たない。
 */
export function specChecklistItems(
  kind: SpecChecklistRequest["kind"],
): string[] {
  const specAnalysisUxChecklistItemTexts = [
    "正式入力となるUX Definitionを一件だけ特定した",
    "UXの利用者、状況、成果、重要場面、失敗および品質を保持した",
    "契機、結果、失敗および判断不能を観測可能な意味で評価した",
    "受入条件と適用範囲を評価した",
    "SPEC候補への処置と理由を明示した",
    "IA観点と統合するときの確認事項を明示した",
    "Human Inputの必要性を評価した",
    "Open・GapとSPECまたはUXへ戻す条件を明示した",
    "Verification Intentを評価した",
    "IA、UI、REQ、ArchitectureまたはSourceから意味を補完していない",
    "UI Presentationを先取りしていない",
    "補足分析へ必須情報を退避していない",
  ];

  const specAnalysisIaChecklistItemTexts = [
    "正式入力となるIA Definitionを一件だけ特定した",
    "利用場面、Object、Identity、Relation、State、Visibilityおよび時間的意味を保持した",
    "入力、条件、状態、結果および開示境界を区別した",
    "導線、責任、Authorityおよび失敗時に保持する意味を評価した",
    "SPEC候補への処置と理由を明示した",
    "UX観点と統合するときの確認事項を明示した",
    "Human Inputの必要性を評価した",
    "Open・GapとSPECまたはIAへ戻す条件を明示した",
    "Verification Intentを評価した",
    "UX、UI、REQ、ArchitectureまたはSourceから意味を補完していない",
    "実装StateまたはUI Presentationを先取りしていない",
    "補足分析へ必須情報を退避していない",
  ];

  const specDefinitionChecklistItemTexts = [
    "UX DefinitionとIA Definitionを正式入力とし、各分析記録を変換根拠として処置した",
    "UX OutcomeとIA Information Contractを保持した",
    "Actor・Authority、Trigger、PreconditionおよびInput Validationを評価した",
    "Current State、Behavior、ResultおよびState Transitionを定義した",
    "Failure・Error、Retry・Recovery、Cancel・UndoおよびSide Effectを評価した",
    "ConstraintとNon-goalを評価した",
    "Human Inputの必要性を評価した",
    "Open・GapとOwner工程へ戻す条件を明示した",
    "Verification Intentを明示した",
    "対応するUIとのRelationを明示した",
    "UI Presentation、Architecture方式またはSource実装を先取りしていない",
    "結果を観測可能な契約として定義した",
    "補足定義へ必須情報を退避していない",
  ];

  const specDetailIndexChecklistItemTexts = [
    "対象SPEC Definitionを全件処置した",
    "BHVの発行基準を満たすDetailed Behaviorだけを採番した",
    "各BHVからSource SPECへ逆引きできる",
    "Trigger、Result、FailureおよびRecoveryのCoverageを確認した",
    "UI Detailとの双方向Coverageを評価した",
    "Architecture方式やSource実装を先取りしていない",
    "N/Aに理由、OPENにOwner・影響・戻り条件を記録した",
  ];

  const specBehaviorChecklistItemTexts = [
    "独立したTriggerまたはResultを持つ",
    "Source SPECへ接続した",
    "TriggerからRecoveryまで全観点を評価した",
    "N/Aに理由、OPENにOwner・影響・戻り条件を記録した",
    "Normal、Boundary、Failure、UnknownおよびRecoveryを評価した",
    "UI認識が必要な結果をUI Detailへ接続した",
    "Architecture方式やSource実装を先取りしていない",
    "新しいUX Outcome、IA Object、UI PresentationまたはAuthorityを創作していない",
  ];

  const uiSpecDetailCorrespondenceChecklistItemTexts = [
    "Definition対応とDetail対応を分けた",
    "UIからBHVへのCoverageを全件評価した",
    "BHVからUIへのCoverageを全件評価した",
    "直接UIを持たないBHVを理由付きN/Aへ処置した",
    "Detail Gapを対応表だけで補完せずOwner工程へ戻した",
    "N/Aに理由、OPENにOwner・影響・戻り条件を記録した",
    "Architecture／Qualityへ未解決事項を含めて引き渡した",
  ];

  const uiSpecCorrespondenceChecklistItemTexts = [
    "UIとSPECが同じUX・IA Contextを保持している",
    "Shared Stateの意味が一致する",
    "InteractionとTriggerが矛盾しない",
    "ResultとFeedbackが矛盾しない",
    "FailureとError Presentationが矛盾しない",
    "Recoveryが両側で成立する",
    "Authorityが矛盾しない",
    "Visibilityが矛盾しない",
    "Constraintが片側で欠落していない",
    "UI-only Responsibilityを識別した",
    "SPEC-only Responsibilityを識別した",
    "Shared Responsibilityを識別した",
    "GapのOwner工程を特定した",
    "UI／SPEC独自の第三仕様を作っていない",
    "対象Definition集合のSHA-256を固定し、再レビュー入力を再構成できる",
    "組別Evidenceの理由を対象UI／SPECの具体的契約事実で説明した",
    "Definition対応とDetail対応を区別した",
    "対象Detail RelationをDefinition対応のPassで代替せず独立確認した",
    "未決事項をAI推測で補完していない",
  ];
  const items = {
    analysis_ux: specAnalysisUxChecklistItemTexts,
    analysis_ia: specAnalysisIaChecklistItemTexts,
    definition: specDefinitionChecklistItemTexts,
    detail_index: specDetailIndexChecklistItemTexts,
    behavior: specBehaviorChecklistItemTexts,
    detail_correspondence: uiSpecDetailCorrespondenceChecklistItemTexts,
    correspondence: uiSpecCorrespondenceChecklistItemTexts,
  };
  if (!Object.hasOwn(items, kind))
    throw new Error("unknown_spec_checklist_kind");
  return items[kind];
}

/**
 * Spec文書の捕捉済みChecklist不備を局所Issueへ変換する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export function specChecklistIssues(model: SpecDocument): DocumentIssue[] {
  const { kind, mode, failure } = model.checklistContract;
  if (!failure) return [];
  const reason =
    mode === "template"
      ? "template-checklist-invalid"
      : `${kind}-checklist-invalid`;
  return [
    {
      kind: `artifact.spec.${reason}`,
      targetIdentity: model.source.path,
      location: { path: model.source.path },
      reason,
      details: { checklistFailure: failure },
    },
  ];
}

/**
 * SPEC Detail統合台帳の文書内条件を検査する。
 * @responsibility 行条件・ID重複・Canonical宣言を評価し、外部集合の被覆は扱わない。
 * @trace ARCH-000008
 * @input model: 構築済み台帳。
 * @returns 文書内の不備を表すIssue列。取得済みbehaviorsは変更しない。
 * @effect N/A: モデルと集合だけを扱う。
 */
export function validateSpecDetailIndex(
  model: SpecDetailIndex,
): readonly DocumentIssue[] {
  const ids = model.entries.map((entry) => entry.identity);
  const issues: DocumentIssue[] = [];
  if (
    model.entries.some(
      (entry) =>
        entry.cells.length !== 5 ||
        entry.applicability !== "Applicable／Covered" ||
        !entry.behaviorId ||
        (entry.reason ?? "").trim().length === 0,
    ) ||
    ids.length !== new Set(ids).size ||
    !model.declarations.some(({ text }) => text.includes("状態: Canonical"))
  )
    issues.push({
      kind: "artifact.spec.detail-current-coverage-invalid",
      targetIdentity: model.source.path,
      location: { path: model.source.path },
      reason: "detail-current-coverage-invalid",
      details: {},
    });
  return issues;
}
