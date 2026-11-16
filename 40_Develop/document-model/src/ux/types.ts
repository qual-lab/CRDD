/**
 * Ux文書の内容モデルと受付条件を定義する。
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
import type { UxHandoffModel } from "./handoff.ts";

/**
 * UX文書の原文・構造とChecklist受付結果を保持する。
 * @responsibility 不完全な本文も保持し、固定構文と体験品質の成立を分離する。
 * @trace ARCH-000008
 * @invariant failure=nullは構造検査だけの成立であり、品質Passや認可を意味しない。
 */
export type UxDocument = Readonly<{
  diagramContract: ReturnType<typeof parseDiagramDisposition> | null;
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  checklist: readonly DocumentSection[];
  checklistContract: UxChecklistRequest &
    Readonly<{
      expectedItems: readonly string[];
      failure: ChecklistFailure | null;
    }>;
}>;

/**
 * 生のUX入口から得たIDとREQ–UX関係を表す。
 * @responsibility 既存のSet化を保つ二つの集合を同じ解析結果へまとめる。
 * @trace ARCH-000008
 * @shape 原文・Artifact・登録行出現とids、requirementRelations。
 * @invariant 生本文由来の重複は現行どおりSetへ畳む。
 * @boundary N/A: 取得済み本文の値モデルだけを表す。
 * @security 認可・実在・品質全体の成立を表さない。
 * @compatibility 現行のID抽出と関係セルの受理条件を維持する。
 */
export type UxIndexModel = UxDocument &
  Readonly<{
    handoffContract: UxHandoffModel;
    forbiddenDownstream: boolean;
    artifact: ArtifactModel;
    source: ArtifactSource;
    tableRows: readonly DocumentTableRow[];
    entries: readonly Readonly<{
      identity: string;
      requirementIds: readonly string[];
      source: DocumentText;
    }>[];
    ids: ReadonlySet<string>;
    requirementRelations: ReadonlySet<string>;
    identityDefinitions: ReadonlyMap<string, readonly string[]>;
  }>;

/**
 * 横断UX成果物の選択区画・出現IDと出典を保持する。
 * @responsibility 旧substring見出し境界で得た内容を、照合結果と分けて保持する。
 * @trace ARCH-000008
 */
export type UxProjectionModel = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  heading: string;
  selectedSection: DocumentText | null;
  tableRows: readonly DocumentTableRow[];
  projectedKeys: readonly string[];
  projectedIds: ReadonlySet<string>;
}>;

/**
 * Experience MapのJourney行とREQ参照を保持する。
 * @responsibility raw列位置・不正を含む行・出典と集合化後の関係を区別する。
 * @trace ARCH-000008
 */
export type UxExperienceMap = UxDocument &
  Readonly<{
    projection: UxProjectionModel;
    artifact: ArtifactModel;
    source: ArtifactSource;
    tableRows: readonly DocumentTableRow[];
    entries: readonly Readonly<{
      journey: string;
      requirementIds: readonly string[];
      cells: readonly string[];
      source: DocumentText;
    }>[];
    requirementRelations: ReadonlySet<string>;
  }>;

/**
 * UX成果の明示本文・状態宣言・出典を保持する。
 * @responsibility 原文の宣言と可視Artifactを区別し、採用・品質判断を生成しない。
 * @trace ARCH-000008
 */
export type UxDefinitionModel = UxDocument &
  Readonly<{
    handoffContract: UxHandoffModel;
    artifact: ArtifactModel;
    source: ArtifactSource;
    expectedIdentity: string;
    tableRows: readonly DocumentTableRow[];
    stateDeclarations: readonly DocumentText[];
    outcome: readonly DocumentSection[];
    change: readonly DocumentSection[];
    conditions: readonly DocumentSection[];
    experience: readonly DocumentSection[];
    boundary: readonly DocumentSection[];
    unknown: readonly DocumentSection[];
    verification: readonly DocumentSection[];
    handoff: readonly DocumentSection[];
    relations: readonly DocumentSection[];
    checklist: readonly DocumentSection[];
  }>;

/**
 * UX分析から得た関係集合と本文の違反を表す。
 * @responsibility 本文が不正でも解析できたREQ–UX／Journey関係を保持する。
 * @trace ARCH-000008
 * @shape 原文・出典・名前付き本文とrequirementRelations、journeyRelations。
 * @invariant 関係のSet化とIssueの順序を維持する。
 * @boundary N/A: 既読本文由来の値モデル。
 * @security 正式入力の安全性・実在や品質全体の成立を保証しない。
 * @compatibility 現行の関係抽出と診断順を維持する。
 */
export type UxAnalysisModel = UxDocument &
  Readonly<{
    formalInputTargets: readonly UxFormalInputTarget[];
    formalInput: Readonly<{
      headers: readonly string[];
      expectedLinkMatches: boolean;
      forbiddenDeclaration: boolean;
    }>;
    handoffContract: UxHandoffModel;
    artifact: ArtifactModel;
    source: ArtifactSource;
    expectedIdentity: string;
    tableRows: readonly DocumentTableRow[];
    primary: readonly DocumentSection[];
    actors: readonly DocumentSection[];
    change: readonly DocumentSection[];
    integration: readonly DocumentSection[];
    experience: readonly DocumentSection[];
    handoff: readonly DocumentSection[];
    checklist: readonly DocumentSection[];
    requirementRelations: ReadonlySet<string>;
    journeyRelations: ReadonlySet<string>;
  }>;

/**
 * 正式入力判定に必要な観測済み事実を表す。
 * @responsibility Path・Readerを渡さず、既存の内容有無・一致・拒否事実を搬送する。
 * @trace ARCH-000008
 * @shape definitionHasContent、matchingDefinitionOnly、hasSourceAnalysis、hasInvalidDiscoveryTarget、hasInvalidEntity、hasUnsafeTarget。
 * @invariant 観測不能をfalseへ補完せず、既存観測の結果だけを使う。
 * @boundary Checkerの参照観測とDomain本文検査の値境界。
 * @security DomainがFilesystemの安全性を再観測・認可する契約ではない。
 * @compatibility 現在の正式入力の受理条件を維持する。
 */
export type UxFormalInputObservation = Readonly<{
  definitionHasContent: boolean;
  matchingDefinitionOnly: boolean;
  hasSourceAnalysis: boolean;
  hasInvalidDiscoveryTarget: boolean;
  hasInvalidEntity: boolean;
  hasUnsafeTarget: boolean;
}>;

/**
 * UX文書の有限なChecklist受付条件を指定する。
 * @responsibility 種別・方式を明示し、Path推定や期待配列の外部組立てを避ける。
 * @trace ARCH-000008
 */
export type UxChecklistRequest = Readonly<{
  kind:
    | "index"
    | "personas"
    | "experience_map"
    | "service_blueprint"
    | "quality_expectations"
    | "analysis"
    | "definition";
  mode: "template" | "evaluated";
}>;

/**
 * UX分析本文から得た正式入力の参照候補。
 *
 * @responsibility 参照文字列とDiscovery形状に関するEntity異常flagを、存在・認可の判断と分離する。
 * @trace ARCH-000008
 * @shape targetは候補参照文字列、invalidEntityは既存のDiscovery形状条件に基づくEntity異常を表す。
 * @invariant targetは観測済みFilesystem Pathではなく、invalidEntity=falseは妥当性全体を保証しない。
 * @boundary N/A: 本文解析の値契約だけを定義する。
 * @security 参照の存在・安全性・Root内外・認可を意味しない。
 * @compatibility 同じDecode後targetの候補は挿入順を保ち、異常flagを論理和で引き継ぐ。
 */
export type UxFormalInputTarget = Readonly<{
  target: string;
  invalidEntity: boolean;
}>;

/**
 * UxPersonasの原文・局所内容・投影候補を保持する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export type UxPersonas = UxDocument &
  Readonly<{
    projection: UxProjectionModel;
    sections: readonly DocumentSection[];
  }>;
/**
 * UxServiceBlueprintの原文・局所内容・投影候補を保持する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export type UxServiceBlueprint = UxDocument &
  Readonly<{
    projection: UxProjectionModel;
    sections: readonly DocumentSection[];
  }>;
/**
 * UxQualityExpectationsの原文・局所内容・投影候補を保持する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export type UxQualityExpectations = UxDocument &
  Readonly<{
    projection: UxProjectionModel;
    sections: readonly DocumentSection[];
    forbiddenDownstream: boolean;
  }>;

/**
 * UX自身の取得済みモデルと観測事実を比較する入力。
 * @responsibility 投影・登録・被覆・閉包を完成した整合比較へ渡す。
 * @trace ARCH-000008
 * @invariant 出現・取得断面と局所Issueを維持する。
 * @boundary 呼出し元が取得した値。実体の再観測は行わない。
 * @security 認可・実在・全品質の成立を保証しない。
 */
export type UxConsistencyRequest =
  | Readonly<{
      kind: "ux_analysis_coverage";
      index: UxIndexModel;
      expectedRequirementIds: ReadonlySet<string>;
      actualRequirementIds: ReadonlySet<string>;
    }>
  | Readonly<{
      kind: "ux_definition_coverage";
      index: UxIndexModel;
      actualIds: ReadonlySet<string>;
    }>
  | Readonly<{
      kind: "ux_projection";
      projection: UxProjectionModel;
      canonicalIds: ReadonlySet<string>;
    }>
  | Readonly<{
      kind: "ux_formal_input";
      analysis: UxAnalysisModel;
      observation: UxFormalInputObservation;
    }>
  | Readonly<{
      kind: "ux_analysis_registration";
      analysis: ParseResult<UxAnalysisModel> &
        Readonly<{ result: UxAnalysisModel }>;
      index: UxIndexModel;
    }>
  | Readonly<{
      kind: "ux_relations";
      uxIndexPath: string;
      experienceMapPath: string;
      index: UxIndexModel;
      analyses: readonly UxAnalysisModel[];
      experienceMap: UxExperienceMap | null;
    }>;
