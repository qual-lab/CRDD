/**
 * Architecture文書の共通値と各成果物固有の解析モデルを定義する。
 * @packageDocumentation
 * @trace ARCH-000008
 */
import type { DiagramDisposition } from "../artifact/phase-diagrams.ts";
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
 * Architecture文書の有限なChecklist受付条件を指定する。
 * @responsibility 種別と方式を明示し、Path推定や期待列の外部組立てを避ける。
 * @trace ARCH-000008
 */
export type ArchitectureChecklistRequest = Readonly<{
  kind:
    | "analysis_ui"
    | "analysis_spec"
    | "definition"
    | "definition_template"
    | "detail"
    | "detail_template";
  mode: "template" | "evaluated";
}>;

/**
 * Architecture文書の原文・構造とChecklist受付結果を保持する。
 * @responsibility 部分内容と出典を保持し、局所構造と工程品質を分離する。
 * @trace ARCH-000008
 * @invariant failure=nullは構造検査だけの成立であり、品質Passや認可を意味しない。
 */
export type ArchitectureDocument = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  checklist: readonly DocumentSection[];
  checklistContract: ArchitectureChecklistRequest &
    Readonly<{
      expectedItems: readonly string[];
      failure: ChecklistFailure | null;
    }>;
}>;

/**
 * UI／SPEC観点のArchitecture分析を保持する。
 * @responsibility 名前付きの明示内容・出現・原文出典と、局所診断を分けて保持する。
 * @trace ARCH-000008
 * @invariant 自由文から状態機械・認可・実装や品質成立を生成しない。
 */
export type ArchitectureAnalysis = Readonly<{
  checklistSource: ArtifactSource;
  checklistContract: ArchitectureDocument["checklistContract"];
  hasUnresolvedResults: boolean;

  artifact: ArtifactModel;
  source: ArtifactSource;
  expectedIdentity: string;
  declarations: readonly DocumentText[];
  syntaxTokens: readonly DocumentText[];
  tableRows: readonly DocumentTableRow[];
  relations: readonly string[];
  view: "UI" | "SPEC";
  formalInput: readonly DocumentText[];
  inheritedContract: readonly DocumentText[];
  design: readonly DocumentText[];
  evaluation: readonly DocumentText[];
  disposition: readonly DocumentText[];
  integrationQuestions: readonly DocumentText[];
  checklist: readonly DocumentText[];
  evaluationRows: readonly DocumentTableRow[] | null;
}>;

/**
 * Architecture定義の統合責務と入力別の境界を保持する。
 * @responsibility 名前付きの明示内容・出現・原文出典と、局所診断を分けて保持する。
 * @trace ARCH-000008
 * @invariant 自由文から状態機械・認可・実装や品質成立を生成しない。
 */
export type ArchitectureDefinition = Readonly<{
  assignment: ArchitectureDetailAssignment<"definition">;
  checklistSource: ArtifactSource;
  checklistContract: ArchitectureDocument["checklistContract"];
  hasUnresolvedResults: boolean;
  templateContract: ArchitectureDetailTemplate | null;

  artifact: ArtifactModel;
  source: ArtifactSource;
  expectedIdentity: string;
  declarations: readonly DocumentText[];
  syntaxTokens: readonly DocumentText[];
  tableRows: readonly DocumentTableRow[];
  relations: readonly string[];
  responsibility: readonly DocumentText[];
  uiInput: readonly DocumentText[];
  specInput: readonly DocumentText[];
  integration: readonly DocumentText[];
  structure: readonly DocumentText[];
  data: readonly DocumentText[];
  failure: readonly DocumentText[];
  quality: readonly DocumentText[];
  unresolved: readonly DocumentText[];
  compatibility: readonly DocumentText[];
  handoff: readonly DocumentText[];
  observation: readonly DocumentText[];
  checklist: readonly DocumentText[];
  unknownRows: readonly DocumentTableRow[] | null;
}>;

/**
 * Architecture Detailひな型の内容と必須表現の出現を保持する。
 * @responsibility 原文と可視評価を区別し、部分内容・重複・出典を残す。
 * @trace ARCH-000008
 * @invariant validは二種類のひな型の固定表現だけを評価し、品質全体を保証しない。
 */
export type ArchitectureDetailTemplate = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  kind: "definition" | "area";
  tableRows: readonly DocumentTableRow[];
  visibleContent: string;
  requirements: readonly Readonly<{
    text: string;
    occurrences: readonly DocumentText[];
  }>[];
  valid: boolean;
}>;

/**
 * 横断モデル登録の検査結果と、取得対象の順序を表す。
 * @responsibility 登録節の不在と固定五文書の取得対象を区別する。
 * @trace ARCH-000008
 * @shape 原文・出典・登録節と固定取得対象files。
 * @invariant 登録節が空なら取得対象は空、存在すれば固定五文書順。
 * @boundary N/A: 可視本文から導く値モデル。
 * @security Fileの実在・認可・Ready成立を保証しない。
 * @compatibility 既存の空Section時の観測停止を維持する。
 */
export type ArchitectureIndex = Readonly<{
  registry: ArchitectureRegistryModel;
  diagramContract: ParseResult<DiagramDisposition> & {
    result: DiagramDisposition;
  };
  artifact: ArtifactModel;
  source: ArtifactSource;
  sections: readonly DocumentText[];
  tableRows: readonly DocumentTableRow[];
  files: readonly string[];
}>;

/**
 * 横断文書の明示内容と、可視／構造表現の出典を保持する。
 * @responsibility 五種類の技術文書を固定識別し、本文と診断を分離する。
 * @trace ARCH-000008
 */
export type ArchitectureCrossModel = Readonly<{
  componentDefinitionEntries: readonly string[];
  artifact: ArtifactModel;
  source: ArtifactSource;
  file: string;
  visibleLines: readonly DocumentText[];
  structureSections: ReadonlyMap<string, readonly DocumentText[]>;
  tableRows: readonly DocumentTableRow[];
}>;

/**
 * Architectureの定義・領域が明示する担当を保持する。
 * @responsibility 定義と領域の種別・期待Identity、本文宣言、担当出現と所属を区別する。
 * @trace ARCH-000008
 * @shape artifact、source、kind、expectedIdentity、tableRows、declarations、architectureDeclaration、各担当集合。
 * @invariant 原文・出典・出現を保持し、担当宣言を実在・認可・品質成立にしない。
 */
export type ArchitectureDetailAssignment<
  K extends "definition" | "area" = "definition" | "area",
> = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  expectedIdentity: string;
  declarations: readonly DocumentText[];
  uiIds: ReadonlySet<string>;
  specIds: ReadonlySet<string>;
  relations: readonly string[];
  hasDuplicateRelations: boolean;
  kind: K;
  architectureIds: ReadonlySet<string>;
  architectureDeclaration: DocumentText | null;
}>;

/**
 * 詳細設計Mapの領域と二種類の関係を表す。
 * @responsibility 詳細設計Mapの領域と二種類の関係を表す。
 * @trace ARCH-000008
 * @shape 原文・出典・台帳節、現行areas、明示登録したretiredAreas、現行の二種類の関係。
 * @invariant 不正・重複・現行との衝突・Map不成立を退役の除外根拠にしない。
 * @boundary N/A: 取得済み値の結果モデル。
 * @security Fileの実在・認可・品質成立を保証しない。
 * @compatibility 現行関係を保持し、退役の除外根拠は一意に成立したMapへ限定する。
 */
export type ArchitectureDetailMapModel = Readonly<{
  trace: ArchitectureDetailTrace;
  closureIds: ReadonlySet<string>;
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  areaSections: readonly DocumentSection[];
  closureSections: readonly DocumentSection[];
  areas: ReadonlySet<string>;
  retiredAreas: ReadonlySet<string>;
  relations: ReadonlySet<string>;
  closureRelations: ReadonlySet<string>;
}>;

/**
 * 詳細設計本文から得た関係とCovered定義を表す。
 * @responsibility 詳細設計本文から得た関係とCovered定義を表す。
 * @trace ARCH-000008
 * @shape 原文・出典・適用判断・Concern・構造・引渡しとrelations、coveredDefinitions。
 * @invariant 重複に対する既存の集合化と部分関係を保持する。
 * @boundary N/A: 取得済み値の結果モデル。
 * @security Fileの実在・認可・品質成立を保証しない。
 * @compatibility 現行の本文受理条件を維持する。
 */
export type ArchitectureDetailModel = Readonly<{
  assignment: ArchitectureDetailAssignment<"area">;
  checklistSource: ArtifactSource;
  checklistContract: ArchitectureDocument["checklistContract"];
  hasUnresolvedResults: boolean;
  templateContract: ArchitectureDetailTemplate | null;

  artifact: ArtifactModel;
  source: ArtifactSource;
  area: string;
  tableRows: readonly DocumentTableRow[];
  relationSections: readonly DocumentSection[];
  applicabilitySections: readonly DocumentSection[];
  concernSections: readonly DocumentSection[];
  qualityHandoffSections: readonly DocumentSection[];
  qualityHandoff: Readonly<{
    sections: readonly DocumentText[];
    rows: readonly DocumentTableRow[];
    units: ReadonlySet<string>;
    levels: ReadonlyMap<string, ReadonlySet<string>>;
    boundaryStages: ReadonlyMap<string, string>;
  }>;
  checklistSections: readonly DocumentSection[];
  implementationStructure: DocumentText | null;
  semantic: Readonly<{
    heading: DocumentText | null;
    header: DocumentTableRow | null;
    separator: DocumentTableRow | null;
    rows: readonly DocumentTableRow[];
    sourceLines: readonly DocumentText[];
  }>;
  relations: ReadonlySet<string>;
  coveredDefinitions: ReadonlySet<string>;
}>;

/**
 * Architecture中央対応表の担当・発行済みIDを保持する。
 * @responsibility 全可視本文のIDと、採用行数・重複・後勝ちの対応を分ける。
 * @trace ARCH-000008
 * @shape artifact、source、tableRows、relations、relationRows、ID集合、重複。
 * @invariant 原文・出典・出現を保持し、担当宣言を実在・認可・品質成立にしない。
 */
export type ArchitectureDetailTrace = Readonly<{
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
    Readonly<{
      bhv: string;
      owners: ReadonlySet<string>;
      mode: string;
      areas: ReadonlySet<string>;
    }>
  >;
}>;

/**
 * Architecture登録表の定義・関係と出現列を表す。
 * @responsibility Architecture登録表の定義・関係と出現列を表す。
 * @trace ARCH-000008
 * @shape 原文、Artifact、全表行、台帳節・登録行と既存関係投影。
 * @invariant 集合と出現配列を区別し、重複を失わない。
 * @boundary N/A: 取得済み値モデル。
 * @security 認可・実在・完成を保証しない。
 * @compatibility 現行の関係照合条件を維持する。
 */
export type ArchitectureRegistryModel = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  sections: readonly DocumentSection[];
  entries: readonly Readonly<{
    definition: string;
    inputs: readonly string[];
    source: DocumentText;
  }>[];
  definitions: ReadonlySet<string>;
  definitionEntries: readonly string[];
  relations: ReadonlySet<string>;
  relationEntries: readonly string[];
}>;
