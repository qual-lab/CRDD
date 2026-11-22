/**
 * Quality文書の共通値・専用モデル・検査の入力契約を定義する。
 * @packageDocumentation
 * @trace ARCH-000008
 */
import type { DiagramDisposition } from "../artifact/phase-diagrams.ts";
import type {
  ArtifactModel,
  ArtifactSource,
  ChecklistFailure,
  DocumentIssue,
  DocumentTableRow,
  DocumentText,
  ParseResult,
} from "../artifact/types.ts";

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
export type QualityChecklistContract = QualityChecklistRequest &
  Readonly<{
    expectedItems: readonly string[];
    failure: ChecklistFailure | null;
  }>;

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
  diagramContract:
    | (ParseResult<DiagramDisposition> & { result: DiagramDisposition })
    | null;
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
    currentProjection: QualityCenterProjection;
  }>;

/** 表示表の成立と欠測を、文書全体の品質診断から独立して保持する。 @trace ARCH-000005 */
export type QualityCenterProjection =
  | Readonly<{ status: "complete"; result: RepositoryQualityProjection }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "quality_projection_section_missing"
        | "quality_projection_table_invalid"
        | "quality_projection_row_invalid"
        | "quality_projection_value_missing";
    }>;

/** Reality自身の内容と宣言を保持し、Centerとの組合せは所有しない。@trace ARCH-000008 */
export type QualityRealityAudit = QualityParsedDocument;

/** Strategy文書の原文・節・出典を保持する。@trace ARCH-000008 */
export type QualityStrategy = QualityParsedDocument &
  Readonly<{
    sections: readonly import("../artifact/types.ts").DocumentSection[];
  }>;

/** VerificationDesign文書の原文・節・出典を保持する。@trace ARCH-000008 */
export type QualityVerificationDesign = QualityParsedDocument &
  Readonly<{
    sections: readonly import("../artifact/types.ts").DocumentSection[];
  }>;

/** VerificationResult文書の原文・節・出典を保持する。@trace ARCH-000008 */
export type QualityVerificationResult = QualityParsedDocument &
  Readonly<{
    templateContract: QualityTemplate | null;
    sections: readonly import("../artifact/types.ts").DocumentSection[];
  }>;

/** 工程別の品質分析が保持する出現列・集合・条件。 @trace ARCH-000008 */
export type QualityAnalysisRelations = {
  summarySourceLevels: Map<string, Set<string>>;
  goalLabelToSlug: Map<string, string>;
  analysisSourceRelations: Set<string>;
  analysisSourceConditions: Map<string, string>;
  analysisSourceGoalLevels: Map<string, Set<string>>;
  analysisObligationKeys: Map<string, string>;
  mappingRows: string[];
  mappedIds: Set<string>;
  summarySourceGoalRelationEntries: string[];
  summarySourceGoalRelations: Set<string>;
  analysisSourceGoalRelationEntries: string[];
  analysisSourceGoalRelations: Set<string>;
  analysisSourceRelationEntries: string[];
  analysisObligationKeyEntries: string[];
  hasSourceRelations: boolean;
  incompleteRelations: string[];
};

/** 詳細分析の検証単位と目標・項目の関係。 @trace ARCH-000008 */
export type QualityDetailUnits = {
  analysisDetailGoalRelations: Set<string>;
  analysisDetailUnitLocalRelations: Set<string>;
  analysisDetailUnits: Set<string>;
};

/** 品質統合が宣言した項目と関係の出現列。 @trace ARCH-000008 */
export type QualityIntegrationItems = {
  listedLocalIds: Set<string>;
  listedGoalLocalRelations: Set<string>;
  listedGoalLocalRelationEntries: string[];
};

/** 工程別分析と統合を照合した結果。 @trace ARCH-000008 */
export type QualityAnalysisInspection = Pick<
  QualityAnalysisRelations,
  | "summarySourceLevels"
  | "goalLabelToSlug"
  | "analysisSourceRelations"
  | "analysisSourceConditions"
  | "analysisSourceGoalLevels"
  | "analysisObligationKeys"
> &
  Pick<QualityIntegration, "crossModelRows" | "crossModelReferences"> & {
    hasCoverageSections: boolean;
    issues: DocumentIssue[];
  };

/**
 * 工程別品質分析の本文・全出現と既存の先頭選択を保持する。
 * @responsibility 工程入力の欠測・重複・出典を横断照合へ渡す。
 * @trace ARCH-000008
 */
export type QualityAnalysis = QualityParsedDocument &
  Readonly<{
    templateContract: QualityTemplate | null;
    relationData: QualityAnalysisRelations;
    artifact: ArtifactModel;
    source: ArtifactSource;
    tableRows: readonly DocumentTableRow[];
    coverage: readonly DocumentText[];
    /** 先頭Coverage節に出現する定義ID。重複と順序を保持する。 */
    definitionReferences: readonly string[];
    sourceRelations: readonly DocumentText[];
  }>;

/**
 * 品質統合の横断・詳細処置を本文モデルとして保持する。
 * @responsibility rawの節境界と部分内容を後続の関係評価へ渡す。
 * @trace ARCH-000008
 */
export type QualityIntegration = QualityParsedDocument &
  Readonly<{
    templateContract: QualityTemplate | null;
    crossModelRows: readonly (readonly string[])[];
    localItemData: QualityIntegrationItems;
    detailUnitData: QualityDetailUnits;
    artifact: ArtifactModel;
    source: ArtifactSource;
    tableRows: readonly DocumentTableRow[];
    crossModel: readonly DocumentText[];
    crossModelReferences: readonly string[];
    details: readonly DocumentText[];
    /** 先頭詳細処置節の明示リンク。Path解決と実在確認はCallerが所有する。 */
    detailReferences: readonly string[];
  }>;

/**
 * Quality中央対応表の担当・発行済みIDを保持する。
 * @responsibility 可視本文全体のID、採用行数、行・Owner重複と後勝ちを保持する。
 * @trace ARCH-000008
 * @shape artifact、source、tableRows、relations、relationRows、ID集合、重複。
 * @invariant 原文・出典・出現を保持し、担当宣言を実在・認可・品質成立にしない。
 */
export type QualityDetailTrace = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  screens: ReadonlySet<string>;
  parts: ReadonlySet<string>;
  behaviors: ReadonlySet<string>;
  relationRows: number;
  hasDuplicateRelations: boolean;
  relations: ReadonlyMap<
    string,
    Readonly<{ bhv: string; owners: ReadonlySet<string>; mode: string }>
  >;
}>;

/** DetailAnalysis文書の原文・節・出典を保持する。@trace ARCH-000008 */
export type QualityDetailAnalysis = QualityParsedDocument &
  Readonly<{
    trace: QualityDetailTrace;
    sections: readonly import("../artifact/types.ts").DocumentSection[];
  }>;

/**
 * Quality文書同士の状態・目標・定義閉包を比較する入力。
 * 集合と出現列を区別し、取得済み範囲を全実在・全品質の保証へ拡大しない。
 */
export type QualityConsistencyRequest =
  | Readonly<{
      kind: "quality_coverage_sections";
      analyses: readonly QualityAnalysis[];
      analysisRoot: string;
    }>
  | Readonly<{
      kind: "quality_definition_closure";
      analysis: QualityAnalysisInspection;
      linkedDefinitionPaths: ReadonlySet<string>;
      analysisPath: string;
    }>
  | Readonly<{
      kind: "quality_definition_coverage";
      analysis: QualityAnalysisInspection;
      linkedDefinitionPaths: ReadonlySet<string>;
      physicalDefinitionPaths: ReadonlySet<string>;
      definitionsRoot: string;
    }>
  | Readonly<{
      kind: "quality_local_item_count";
      document: QualityCenter | QualityRealityAudit;
      localItemOwners: ReadonlyMap<string, string>;
    }>
  | Readonly<{
      kind: "quality_design_states";
      artifacts: readonly ArtifactModel[];
    }>
  | Readonly<{
      kind: "quality_definition_relations";
      definitions: readonly QualityDefinitionModel[];
      analysis: QualityAnalysisInspection;
      integration: QualityIntegration;
      definitionsRoot: string;
      analysisPath: string;
    }>
  | Readonly<{
      kind: "quality_goal_local_relations";
      definitions: readonly QualityDefinitionModel[];
      integration: QualityIntegration;
      analysisPath: string;
    }>
  | Readonly<{
      kind: "quality_reality_state";
      center: QualityCenter;
      reality: ParseResult<QualityRealityAudit> &
        Readonly<{ result: QualityRealityAudit }>;
    }>
  | Readonly<{
      kind: "quality_goals";
      analysis: QualityAnalysisInspection;
      analysisPath: string;
    }>;

/**
 * Quality Definitionから抽出した関係・条件・検査結果を表す。
 * @responsibility Quality Definitionから抽出した関係・条件・検査結果を表す。
 * @trace ARCH-000008
 * @shape sourceRelations、sourceRelationEntries、sourceConditions、sourceGoalLevels、obligationKeys、obligationKeyEntries、detailGoalRelations、detailGoalRelationEntries、goalLocalRelations、goalLocalRelationEntries、localItemLevels、localItemBoundaryStages、localIdsと原文・出典・名前付き本文節。
 * @invariant 不正な行からも取得できる関係・後勝ち値・重複出現を保持する。
 * @boundary N/A: 取得済み本文の値モデル。
 * @security 認可・品質成立や実行許可を発行しない。
 * @compatibility 既存の本文条件・後勝ちMap・出現順を維持する。
 */
export type QualityDefinitionModel = QualityParsedDocument &
  Readonly<{
    assignment: QualityDetailAssignment;
    artifact: ArtifactModel;
    source: ArtifactSource;
    expectedIdentity: string;
    tableRows: readonly DocumentTableRow[];
    visibleLines: readonly DocumentText[];
    sections: Readonly<{
      coverage: readonly DocumentText[];
      architectureInput: readonly DocumentText[];
      conditionApplicability: readonly DocumentText[];
      items: readonly DocumentText[];
      stageApplicability: readonly DocumentText[];
      additionalTypes: readonly DocumentText[];
    }>;
    semantic: Readonly<{
      heading: DocumentText | null;
      header: DocumentTableRow | null;
      separator: DocumentTableRow | null;
      rows: readonly DocumentTableRow[];
      localItems: ReadonlyMap<
        string,
        Readonly<{
          occurrences: number;
          executionMode: "automated" | "manual" | null;
        }>
      >;
    }>;
    sourceRelations: ReadonlySet<string>;
    sourceRelationEntries: readonly string[];
    sourceConditions: ReadonlyMap<string, string>;
    sourceGoalLevels: ReadonlyMap<string, ReadonlySet<string>>;
    obligationKeys: ReadonlyMap<string, string>;
    obligationKeyEntries: readonly string[];
    detailGoalRelations: ReadonlySet<string>;
    detailGoalRelationEntries: readonly string[];
    goalLocalRelations: ReadonlySet<string>;
    goalLocalRelationEntries: readonly string[];
    localItemLevels: ReadonlyMap<string, string>;
    localItemBoundaryStages: ReadonlyMap<string, string>;
    localIds: readonly string[];
  }>;

/**
 * Quality定義の明示担当を原文・出典とともに保持する。
 * @responsibility UI／SPECの担当とRelation出現を独立したQuality値契約で所有する。
 * @trace ARCH-000008
 * @shape artifact、source、tableRows、expectedIdentity、declarations、各担当集合。
 * @invariant 原文・出典・出現を保持し、担当宣言を実在・認可・品質成立にしない。
 */
export type QualityDetailAssignment = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  expectedIdentity: string;
  declarations: readonly DocumentText[];
  uiIds: ReadonlySet<string>;
  specIds: ReadonlySet<string>;
  relations: readonly string[];
  hasDuplicateRelations: boolean;
}>;

/**
 * Local ID所有確認後の局所Mapと重複Issueを表す。
 * @responsibility Local ID所有確認後の局所Mapと重複Issueを表す。
 * @trace ARCH-000008
 * @shape owners、issues。
 * @invariant 入力Ownerは変更せず、先勝ちの所有と出現ごとの重複を維持する。
 * @boundary N/A: 取得済み本文の値モデル。
 * @security 認可・品質成立や実行許可を発行しない。
 * @compatibility 先勝ちの所有と、同じIDの後続出現ごとの重複診断を維持する。
 */
export type QualityLocalItemOwnershipModel = Readonly<{
  owners: ReadonlyMap<string, string>;
  issues: readonly DocumentIssue[];
}>;

/**
 * 任意Markdown中の品質表を表す内容・件数・区分別診断のモデル。
 * @responsibility 捕捉済みArtifactと既存の表別結果を保持する。
 * @trace ARCH-000008
 * @invariant 件数と診断の区分を保ち、全品質Passを表さない。
 */
export type QualityTables = Readonly<{
  artifact: ArtifactModel;
  numericRowsChecked: number;
  remediationRowsChecked: number;
  branchIssues: readonly DocumentIssue[];
  remediationIssues: readonly DocumentIssue[];
}>;

/**
 * RepositoryのCurrent Quality Projectionを定義する。
 *
 * @responsibility 品質状態、対象、Coverage、Gap、Gate、人間判断および根拠を一Snapshotへ閉じる。
 * @trace ARCH-000005
 * @shape overallState、target、observed、unobserved、knownGap、nextGate、humanDecisionおよびrationaleを表す。
 * @invariant 未観測を観測済みへ、進行中GapをPassへ変換しない。
 * @boundary Quality Center ProjectionとConsumerの型境界。
 * @security Evidence本文、内部Pathまたは非開示結果を追加しない。
 * @compatibility 固定項目変更時はParserと全Consumerを再評価する。
 */
export type RepositoryQualityProjection = Readonly<{
  overallState: string;
  target: string;
  observed: string;
  unobserved: string;
  knownGap: string;
  nextGate: string;
  humanDecision: string;
  rationale: Readonly<Record<string, string>>;
}>;

/**
 * Qualityひな型の内容と局所的な必須表現の充足を保持する。
 * @responsibility 原文と検査用本文を区別し、不足と重複出現を失わない。
 * @trace ARCH-000008
 * @invariant validは固定表現の充足のみで、品質Gate・認可・実在を証明しない。
 */
export type QualityTemplate = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  kind: "verification_result" | "analysis" | "integration";
  tableRows: readonly DocumentTableRow[];
  evaluatedContent: string;
  requirements: readonly Readonly<{
    text: string;
    occurrences: readonly DocumentText[];
  }>[];
  valid: boolean;
}>;
