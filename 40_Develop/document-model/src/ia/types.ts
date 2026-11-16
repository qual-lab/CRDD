/**
 * Ia文書の内容モデルと受付条件を定義する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
import type { parseDiagramDisposition } from "../artifact/phase-diagrams.ts";
import type {
  ArtifactModel,
  ArtifactSource,
  ChecklistFailure,
  DocumentSection,
  DocumentTableRow,
  DocumentText,
  ParseResult,
} from "../artifact/types.ts";

/**
 * IA文書の原文・構造とChecklist受付結果を保持する。
 * @responsibility 未保存・部分本文も捕捉し、固定条件の評価と工程品質を分離する。
 * @trace ARCH-000008
 * @invariant failure=nullは構造検査の成立であり、全項目Passや認可を意味しない。
 */
export type IaDocument = Readonly<{
  diagramContract: ReturnType<typeof parseDiagramDisposition> | null;
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  checklist: readonly DocumentSection[];
  checklistContract: IaChecklistRequest &
    Readonly<{
      expectedItems: readonly string[];
      failure: ChecklistFailure | null;
    }>;
}>;

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
export type IaIndexModel = IaDocument &
  Readonly<{
    artifact: ArtifactModel;
    source: ArtifactSource;
    tableRows: readonly DocumentTableRow[];
    ids: ReadonlySet<string>;
    pairs: readonly string[];
    isRowInvalid: boolean;
  }>;

/**
 * 不正を含むIA分析から抽出できた意味を表す。
 * @responsibility ObjectとIdentity、順序付き関係と対応列を後続検査へ渡す。
 * @trace ARCH-000008
 * @shape 原文・出典・名前付き本文、objects、objectIdentities、pairs、mappingKeys。
 * @invariant 不正本文でも抽出可能な関係を失わない。
 * @boundary N/A: 取得済み本文のモデルだけを扱う。
 * @security Issueの空列を品質全体のPassとしない。
 * @compatibility 既存の分析から定義への照合情報を保持する。
 */
export type IaAnalysisModel = IaDocument &
  Readonly<{
    artifact: ArtifactModel;
    source: ArtifactSource;
    expectedIdentity: string;
    tableRows: readonly DocumentTableRow[];
    receivedMeaning: readonly DocumentSection[];
    information: readonly DocumentSection[];
    state: readonly DocumentSection[];
    implementationReference: readonly DocumentSection[];
    disposition: readonly DocumentSection[];
    handoff: readonly DocumentSection[];
    supplement: readonly DocumentSection[];
    checklist: readonly DocumentSection[];
    objects: ReadonlySet<string>;
    objectIdentities: ReadonlyMap<string, string>;
    pairs: readonly string[];
    mappingKeys: readonly string[];
  }>;

/**
 * IA定義の情報源とObject対応を表す。
 * @responsibility 後続の閉包照合に必要な順序付き列とIssueを保持する。
 * @trace ARCH-000008
 * @shape 原文・可視内容・Fence保持構造・出典、pairs、mappingKeys。
 * @invariant 重複した関係や不正な本文を補完しない。
 * @boundary N/A: IAモデルの値だけを扱う。
 * @security 採用や品質成立のAuthorityを持たない。
 * @compatibility mappingKeysは文書内で有効な宣言であり、外部分析との成立はSemanticが判断する。
 */
export type IaDefinitionModel = IaDocument &
  Readonly<{
    mappingEvidence: readonly Readonly<{
      key: string;
      analysisId: string;
      sourceObject: string;
    }>[];
    identityEvidence: readonly Readonly<{
      sourceObject: string;
      identity: string;
    }>[];
    artifact: ArtifactModel;
    source: ArtifactSource;
    expectedIdentity: string;
    tableRows: readonly DocumentTableRow[];
    structureLines: readonly DocumentText[];
    meaning: readonly DocumentSection[];
    identity: readonly DocumentSection[];
    state: readonly DocumentSection[];
    organization: readonly DocumentSection[];
    failure: readonly DocumentSection[];
    verification: readonly DocumentSection[];
    handoff: readonly DocumentSection[];
    inputs: readonly DocumentSection[];
    supplement: readonly DocumentSection[];
    checklist: readonly DocumentSection[];
    pairs: readonly string[];
    mappingKeys: readonly string[];
  }>;

/**
 * 横断IA文書の適用節・出典・投影IDを保持する。
 * @responsibility 二つの候補節の全出現と一意節選択の結果を区別する。
 * @trace ARCH-000008
 */
export type IaCrossProjectionModel = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  sectionsFour: readonly DocumentSection[];
  sectionsFive: readonly DocumentSection[];
  selectedSection: string | null;
  projectedKeys: readonly string[];
  projectedIds: ReadonlySet<string>;
}>;

/**
 * IA文書の有限なChecklist受付条件を指定する。
 * @responsibility 種別・方式を明示し、Path推定や外部での期待列組立てを避ける。
 * @trace ARCH-000008
 */
export type IaChecklistRequest = Readonly<{
  kind:
    | "index"
    | "object_relation"
    | "structure_navigation"
    | "state_visibility"
    | "analysis"
    | "definition";
  mode: "template" | "evaluated";
}>;
/**
 * IaObjectRelationの原文・局所内容・適用節を保持する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export type IaObjectRelation = IaDocument &
  Readonly<{
    projection: IaCrossProjectionModel;
    sections: readonly DocumentSection[];
  }>;
/**
 * IaStructureNavigationの原文・局所内容・適用節を保持する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export type IaStructureNavigation = IaDocument &
  Readonly<{
    projection: IaCrossProjectionModel;
    sections: readonly DocumentSection[];
  }>;
/**
 * IaStateVisibilityの原文・局所内容・適用節を保持する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export type IaStateVisibility = IaDocument &
  Readonly<{
    projection: IaCrossProjectionModel;
    sections: readonly DocumentSection[];
  }>;

/**
 * IA自身の取得済みモデルと観測事実を比較する入力。
 * @responsibility 投影・登録・被覆・閉包を完成した整合比較へ渡す。
 * @trace ARCH-000008
 * @invariant 出現・取得断面と局所Issueを維持する。
 * @boundary 呼出し元が取得した値。実体の再観測は行わない。
 * @security 認可・実在・全品質の成立を保証しない。
 */
export type IaConsistencyRequest =
  | Readonly<{
      kind: "ia_analysis_coverage";
      expectedIds: ReadonlySet<string>;
      actualIds: ReadonlySet<string>;
      sourcePath: string;
    }>
  | Readonly<{
      kind: "ia_index_coverage";
      index: IaIndexModel;
      actualIds: ReadonlySet<string>;
      sourcePath: string;
    }>
  | Readonly<{
      kind: "ia_projection";
      projection: IaCrossProjectionModel;
      actualIds: ReadonlySet<string>;
    }>
  | Readonly<{
      kind: "ia_definition";
      definition: ParseResult<IaDefinitionModel> &
        Readonly<{ result: IaDefinitionModel }>;
      analyses: ReadonlyMap<string, IaAnalysisModel>;
    }>
  | Readonly<{
      kind: "ia_relations";
      index: IaIndexModel;
      analyses: readonly IaAnalysisModel[];
      definitions: readonly IaDefinitionModel[];
      sourcePath: string;
    }>;
