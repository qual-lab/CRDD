/**
 * Quality文書の内容・有限状態・Checklist受付を所有する。
 * @responsibility Quality固有の期待項目と取得済み値の意味を扱い、Filesystem観測と診断表示は所有しない。
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
} from "../artifact/markdown.ts";
import { parseMarkdownArtifact } from "../artifact/parse-markdown.ts";
import { parseDiagramDisposition } from "../artifact/phase-diagrams.ts";
import type {
  ArtifactModel,
  ArtifactSource,
  ChecklistFailure,
  DocumentIssue,
  DocumentTableRow,
  DocumentText,
  ParseResult,
} from "../artifact/types.ts";
import { captureQualityTemplate, type QualityTemplate } from "./templates.ts";

/**
 * Qualityの有限な文書種別とChecklistの受付方式を指定する。
 * @responsibility Path推定や期待配列の外部組立てを不要にする。
 * @trace ARCH-000008
 */
export type QualityChecklistRequest = Readonly<{
  kind:
    | "center"
    | "strategy"
    | "verification_design"
    | "integration"
    | "reality_audit"
    | "verification_result"
    | "analysis"
    | "analysis_detail"
    | "definition";
  mode: "template" | "evaluated";
}>;

/**
 * 内容モデルに結合したChecklistの比較条件と結果を保持する。
 * @responsibility 未指定と検査済みを区別し、失敗理由を失わない。
 * @trace ARCH-000008
 * @invariant failure=nullは構造条件の成立だけで、品質Passを意味しない。
 */
type QualityChecklistContract = QualityChecklistRequest &
  Readonly<{
    expectedItems: readonly string[];
    failure: ChecklistFailure | null;
  }>;

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
function qualityChecklistItems(
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
 * Quality文書の状態・宣言件数・Checklistの内容断面を保持する。
 * @responsibility raw宣言と可視Checklistを分け、出現と先頭選択を保持する。
 * @trace ARCH-000008
 * @invariant Ready宣言・件数・未完了検出から品質Gateを発行しない。
 */
export type QualityDocument = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  stateDeclarations: readonly DocumentText[];
  localItemDeclarations: readonly DocumentText[];
  localItemCount: number | null;
  checklist: DocumentText | null;
  hasOpenChecklist: boolean;
  diagramContract: ReturnType<typeof parseDiagramDisposition> | null;
  checklistContract: QualityChecklistContract | null;
}>;

/** 完成Parseで必ず実施したChecklistの受付条件を保持する。@trace ARCH-000008 */
export type QualityParsedDocument = QualityDocument &
  Readonly<{ checklistContract: QualityChecklistContract }>;

/**
 * Quality Centerの宣言状態と分岐条件を保持する。
 * @responsibility 元文書と局所の正規化結果を対応させる。
 * @trace ARCH-000008
 */
export type QualityCenter = QualityParsedDocument &
  Readonly<{
    normalizedQualityState: string;
    isQualityStateKnown: boolean;
    isQualityDesignReady: boolean;
    isQualityReady: boolean;
  }>;

/**
 * 取得済みQuality文書の共通の内容断面を捕捉する。
 * @responsibility 状態・件数のraw先頭条件と、可視ChecklistのEOF境界を所有する。
 * @trace ARCH-000008
 * @input source: 原文と相対Path。checklistRequest: 必要な場合だけ明示する種別と方式。
 * @returns 原文・Artifact・出典・重複宣言を保持する内容モデル。
 * @effect N/A: 取得済み値だけを扱う。
 * @failure 解析例外は伝播し、不明を正常値で補完しない。
 */
export function captureQualityDocument(
  source: ArtifactSource,
  checklistRequest: QualityChecklistRequest,
): QualityDocument & { checklistContract: QualityChecklistContract };
export function captureQualityDocument(source: ArtifactSource): QualityDocument;
export function captureQualityDocument(
  source: ArtifactSource,
  checklistRequest?: QualityChecklistRequest,
): QualityDocument {
  const captured = { path: source.path, content: source.content };
  let checklistContract: QualityChecklistContract | null = null;
  if (checklistRequest !== undefined) {
    if (
      checklistRequest.mode !== "template" &&
      checklistRequest.mode !== "evaluated"
    )
      throw new Error("unknown_quality_checklist_mode");
    const expectedItems = qualityChecklistItems(checklistRequest.kind);
    checklistContract = {
      kind: checklistRequest.kind,
      mode: checklistRequest.mode,
      expectedItems,
      failure:
        checklistRequest.mode === "template"
          ? inspectTemplateChecklist(captured.content, expectedItems)
          : inspectEvaluatedChecklist(captured.content, expectedItems),
    };
  }
  const stateDeclarations = [
    ...captured.content.matchAll(/^状態:\s*(.+?)\s*$/gmu),
  ].map((match) => ({
    text: match[1] as string,
    location: {
      path: captured.path,
      line: captured.content
        .slice(0, match.index + match[0].indexOf(match[1] as string, 3))
        .split("\n").length,
    },
  }));
  const counts = [
    ...captured.content.matchAll(
      /^\|\s*Local Item数\s*\|\s*([0-9]+)\s*\|\s*$/gmu,
    ),
  ];
  const localItemDeclarations = counts.map((match) => ({
    text: match[1] as string,
    location: {
      path: captured.path,
      line: captured.content.slice(0, match.index).split("\n").length,
    },
  }));
  const visible = omitMarkdownCommentsAndFencedCode(captured.content);
  const match = visible.match(/^## Checklist\s*$([\s\S]*)$/mu);
  const checklist = match
    ? {
        text: match[1] ?? "",
        location: {
          path: captured.path,
          line: visible
            .slice(
              0,
              (match.index ?? 0) + match[0].length - (match[1]?.length ?? 0),
            )
            .split("\n").length,
        },
      }
    : null;
  return {
    diagramContract:
      checklistRequest?.mode === "template" &&
      checklistRequest.kind === "verification_design"
        ? parseDiagramDisposition(captured, [
            "検証義務・試験Level／Boundary対応図",
            "状態・分岐・Block別Coverage図",
            "検証結果・判断接続図",
          ])
        : null,
    checklistContract,
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    tableRows: captureDocumentTableRows(captured),
    stateDeclarations,
    localItemDeclarations,
    localItemCount: localItemDeclarations[0]
      ? Number.parseInt(localItemDeclarations[0].text, 10)
      : null,
    checklist,
    hasOpenChecklist:
      /^- (?:OPEN|FAIL):/mu.test(checklist?.text ?? "") ||
      /^- \[ \]/mu.test(checklist?.text ?? ""),
  };
}
/**
 * Quality Centerの有限状態を解析し、Ready分岐の条件を返す。
 * @responsibility Quality Centerの有限状態を解析し、Ready分岐の条件を返す。
 * @trace ARCH-000008
 * @input source: Quality Centerの原文と相対Path。
 * @returns 文書内容・正規化状態・分岐条件をresult、局所診断をissuesへ分離したOutcome。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 本文から解析できない状態をIssueで返す。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseQualityCenter(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<QualityCenter> & Readonly<{ result: QualityCenter }> {
  const document = captureQualityDocument(source, {
    kind: "center",
    mode: options.mode === undefined ? "evaluated" : options.mode,
  });
  const qualityCenterPath = document.source.path;
  const issues: DocumentIssue[] = [];

  const qualityCenterState = document.stateDeclarations[0]?.text ?? "";
  const normalizedQualityState = qualityCenterState
    .replace(/^v\d+\.\d+\.\d+\s+/u, "")
    .replace(/（Released Baseline:[^）]+）$/u, "")
    .trim();
  const qualityStateKinds = [
    "Quality Design Under Review — Reality Audit Blocked",
    "Quality Design Ready — Reality Audit Pending",
    "Quality Ready",
  ] as const;
  const isQualityStateKnown = qualityStateKinds.some(
    (state) => state === normalizedQualityState,
  );
  if (!isQualityStateKnown && options.mode !== "template")
    issues.push({
      kind: "artifact.quality-analysis.state-invalid",
      targetIdentity: qualityCenterPath,
      location: { path: qualityCenterPath },
      reason: "state-invalid",
      details: {},
    });
  const isQualityDesignReady =
    normalizedQualityState === "Quality Design Ready — Reality Audit Pending";
  const isQualityReady = normalizedQualityState === "Quality Ready";

  issues.push(...qualityChecklistIssues(document));
  return {
    status: issues.length ? "partial" : "complete",
    result: {
      ...document,
      normalizedQualityState,
      isQualityStateKnown,
      isQualityDesignReady,
      isQualityReady,
    },
    issues,
  };
}

/**
 * Reality Audit自身の内容と宣言状態を解析する。
 * @responsibility 文書内の状態・件数・Checklistを保持し、Centerとの比較を行わない。
 * @trace ARCH-000008
 * @input source: Reality文書の原文と位置。options: ひな型または評価済みの方式。
 * @returns Reality自身の宣言状態・件数・内容と局所診断。Centerとの状態対はSemanticで比較する。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 未知Reality状態・不一致をIssueで返す。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseQualityRealityAudit(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<QualityRealityAudit> &
  Readonly<{ result: QualityRealityAudit }> {
  const document = captureQualityDocument(source, {
    kind: "reality_audit",
    mode: options.mode === undefined ? "evaluated" : options.mode,
  });
  const realityAuditState = document.stateDeclarations[0]?.text ?? "";
  const realityAuditPath = document.source.path;
  const issues: DocumentIssue[] = [];

  const allowedRealityAuditStates = [
    "Blocked — Quality Design Review Pending",
    "Pending — Not Started",
    "In Progress",
    "Complete",
  ] as const;
  if (
    options.mode !== "template" &&
    !allowedRealityAuditStates.some((state) => state === realityAuditState)
  )
    issues.push({
      kind: "artifact.quality-analysis.reality-audit-state-invalid",
      targetIdentity: realityAuditPath,
      location: { path: realityAuditPath },
      reason: "reality-audit-state-invalid",
      details: {},
    });
  issues.push(...qualityChecklistIssues(document));
  return {
    status: issues.length ? "partial" : "complete",
    result: document,
    issues,
  };
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
/** Reality自身の内容と宣言を保持し、Centerとの組合せは所有しない。@trace ARCH-000008 */
export type QualityRealityAudit = QualityParsedDocument;

/** Strategy文書の原文・節・出典を保持する。@trace ARCH-000008 */
export type QualityStrategy = QualityParsedDocument &
  Readonly<{
    sections: readonly import("../artifact/types.ts").DocumentSection[];
  }>;
/**
 * Strategy文書の内容と局所Checklist診断を返す。
 * @responsibility 捕捉した本文の不備だけを評価し、外部集合の比較を行わない。
 * @trace ARCH-000008
 */
export function parseQualityStrategy(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<QualityStrategy> & Readonly<{ result: QualityStrategy }> {
  const document = captureQualityDocument(source, {
    kind: "strategy",
    mode: options.mode === undefined ? "evaluated" : options.mode,
  });
  const result = {
    ...document,
    sections: [
      ...new Set(document.artifact.sections.map((section) => section.title)),
    ].flatMap((title) => captureDocumentSections(document.source, title)),
  };
  const issues = qualityChecklistIssues(document);
  return { status: issues.length ? "partial" : "complete", result, issues };
}

/** VerificationDesign文書の原文・節・出典を保持する。@trace ARCH-000008 */
export type QualityVerificationDesign = QualityParsedDocument &
  Readonly<{
    sections: readonly import("../artifact/types.ts").DocumentSection[];
  }>;
/**
 * VerificationDesign文書の内容と局所Checklist診断を返す。
 * @responsibility 捕捉した本文の不備だけを評価し、外部集合の比較を行わない。
 * @trace ARCH-000008
 */
export function parseQualityVerificationDesign(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<QualityVerificationDesign> &
  Readonly<{ result: QualityVerificationDesign }> {
  const document = captureQualityDocument(source, {
    kind: "verification_design",
    mode: options.mode === undefined ? "evaluated" : options.mode,
  });
  const result = {
    ...document,
    sections: [
      ...new Set(document.artifact.sections.map((section) => section.title)),
    ].flatMap((title) => captureDocumentSections(document.source, title)),
  };
  const issues = qualityChecklistIssues(document);
  return { status: issues.length ? "partial" : "complete", result, issues };
}

/** VerificationResult文書の原文・節・出典を保持する。@trace ARCH-000008 */
export type QualityVerificationResult = QualityParsedDocument &
  Readonly<{
    templateContract: QualityTemplate | null;
    sections: readonly import("../artifact/types.ts").DocumentSection[];
  }>;
/**
 * VerificationResult文書の内容と局所Checklist診断を返す。
 * @responsibility 捕捉した本文の不備だけを評価し、外部集合の比較を行わない。
 * @trace ARCH-000008
 */
export function parseQualityVerificationResult(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<QualityVerificationResult> &
  Readonly<{ result: QualityVerificationResult }> {
  const document = captureQualityDocument(source, {
    kind: "verification_result",
    mode: options.mode === undefined ? "evaluated" : options.mode,
  });
  const templateContract =
    options.mode === "template"
      ? captureQualityTemplate(document.source, "verification_result")
      : null;
  const result = {
    templateContract,
    ...document,
    sections: [
      ...new Set(document.artifact.sections.map((section) => section.title)),
    ].flatMap((title) => captureDocumentSections(document.source, title)),
  };
  const issues = [
    ...qualityChecklistIssues(document),
    ...(templateContract && !templateContract.valid
      ? [
          {
            kind: "artifact.quality.template-content-invalid",
            targetIdentity: source.path,
            location: { path: source.path },
            reason: "template-content-invalid",
            details: {},
          },
        ]
      : []),
  ];
  return { status: issues.length ? "partial" : "complete", result, issues };
}
