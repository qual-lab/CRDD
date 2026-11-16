/**
 * SPEC文書の明示された内容をモデル化する。
 * @responsibility 取得済み文書の明示された内容と出典を保持する。
 * @trace ARCH-000008
 */
import type { parseDiagramDisposition } from "../artifact/phase-diagrams.ts";
import type {
  ArtifactModel,
  ArtifactSource,
  ChecklistFailure,
  DocumentReference,
  DocumentSection,
  DocumentTableRow,
  DocumentText,
  ParseResult,
} from "../artifact/types.ts";

/**
 * SPECの目的・条件・振る舞い・回復・受入条件を表す。
 * @responsibility 同名節の全出現、参照、期待IDと宣言本文を分離して保持する。
 * @trace ARCH-000008
 * @invariant 空配列は節欠測、空本文は節の存在を表す。自由記述から状態機械を推定しない。
 * @security 宣言された承認やReadyを検証済みAuthorityへ昇格しない。
 */
export type SpecDefinition = SpecDocument &
  Readonly<{
    correspondenceTitle: DocumentText | null;
    correspondenceSections: ReadonlyMap<string, DocumentText>;
    artifact: ArtifactModel;
    source: ArtifactSource;
    expectedIdentity: string;
    declarations: readonly DocumentText[];
    syntaxTokens: readonly DocumentText[];
    purpose: readonly DocumentSection[];
    uxAnalysis: readonly DocumentSection[];
    iaAnalysis: readonly DocumentSection[];
    formalInputs: readonly DocumentSection[];
    integration: readonly DocumentSection[];
    conditions: readonly DocumentSection[];
    behavior: readonly DocumentSection[];
    recovery: readonly DocumentSection[];
    acceptance: readonly DocumentSection[];
    interfaces: readonly DocumentSection[];
    constraints: readonly DocumentSection[];
    unresolved: readonly DocumentSection[];
    verification: readonly DocumentSection[];
    analysisInputs: readonly DocumentReference[];
    pairedInterfaces: readonly DocumentReference[];
    interfaceDisposition: DocumentText | null;
  }>;

/**
 * SPEC分析が正式入力から受け取る内容と処置を保持する。
 * @responsibility UXとIAの観点を判別し、名前付き内容・参照・欠測・重複・出典を保持する。
 * @trace ARCH-000008
 * @invariant 期待IDと本文宣言は別物。自由記述から他観点の結論を補完しない。
 * @security 原文の図・例は保持するが、参照や品質成立の根拠へ自動昇格しない。
 */
export type SpecAnalysis = SpecDocument &
  Readonly<{
    artifact: ArtifactModel;
    source: ArtifactSource;
    expectedIdentity: string;
    declarations: readonly DocumentText[];
    syntaxTokens: readonly DocumentText[];
    formalInputs: readonly DocumentSection[];
    dispositions: readonly DocumentSection[];
    targets: readonly DocumentReference[];
    integrationQuestions: readonly DocumentSection[];
    unresolved: readonly DocumentSection[];
    verification: readonly DocumentSection[];
  }> &
  (
    | Readonly<{
        view: "ux";
        outcomes: readonly DocumentSection[];
        observations: readonly DocumentSection[];
        acceptance: readonly DocumentSection[];
      }>
    | Readonly<{
        view: "ia";
        usageMeanings: readonly DocumentSection[];
        objectsAndRelations: readonly DocumentSection[];
        statesAndVisibility: readonly DocumentSection[];
        responsibilitiesAndFailure: readonly DocumentSection[];
      }>
  );

/**
 * SPEC登録台帳の入力・UI対応・件数宣言を保持する。
 * @responsibility 各行の重複と出典を保持し、参照の実在や品質成立を推定しない。
 * @trace ARCH-000008
 */
export type SpecIndex = Readonly<{
  diagramContract: ReturnType<typeof parseDiagramDisposition>;
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  entries: readonly Readonly<{
    identity: string;
    name: string;
    definitionTarget: string;
    uxIds: readonly string[];
    iaIds: readonly string[];
    uiIds: readonly string[];
    cells: readonly string[];
    location: DocumentText["location"];
  }>[];
  counts: readonly Readonly<{
    inputOrArtifact: string;
    count: string;
    disposition: string;
    cells: readonly string[];
    location: DocumentText["location"];
  }>[];
}>;
/**
 * SPEC Detail統合台帳の振る舞い対応と適用理由を保持する。
 * @responsibility 不正行も保持し、抽出可能なBHVの後勝ち対応を被覆検査と分離する。
 * @trace ARCH-000008
 */
export type SpecDetailIndex = SpecDocument &
  Readonly<{
    artifact: ArtifactModel;
    source: ArtifactSource;
    tableRows: readonly DocumentTableRow[];
    declarations: readonly DocumentText[];
    entries: readonly Readonly<{
      identity: string;
      definition: string | null;
      applicability: string | null;
      behaviorReference: string | null;
      reason: string | null;
      behaviorId: string | null;
      cells: readonly string[];
      location: DocumentText["location"];
    }>[];
    behaviors: ReadonlyMap<string, string>;
  }>;

/**
 * UI／SPEC Detail対応根拠の対象・両方向被覆・Gap・関係を保持する。
 * @responsibility 原文・表・完全に抽出できた対応行を出現順と出典付きで残す。
 * @trace ARCH-000008
 * @security Pass宣言や引渡し記述から独立した品質確認・公開許可を生成しない。
 */
export type SpecDetailCorrespondence = SpecDocument &
  Readonly<{
    artifact: ArtifactModel;
    source: ArtifactSource;
    scope: readonly DocumentSection[];
    uiCoverage: readonly DocumentSection[];
    behaviorCoverage: readonly DocumentSection[];
    relationSections: readonly DocumentSection[];
    gaps: readonly DocumentSection[];
    handoff: readonly DocumentSection[];
    syntaxTokens: readonly DocumentText[];
    tableRows: readonly DocumentTableRow[];
    relations: readonly Readonly<{
      screenId: string;
      interactionKey: string;
      behaviorId: string;
      uiId: string;
      specId: string;
      cells: readonly string[];
      location: DocumentText["location"];
    }>[];
  }>;

/**
 * UI／SPEC定義対応の明示された根拠と出典を保持する。
 * @responsibility 正規対応行、先頭根拠節・表、改訂記録と原文を分離して保持する。
 * @trace ARCH-000008
 * @invariant 短Cell・未認識行・重複を捨てず、作成者確認を品質成立へ昇格しない。
 */
export type SpecDefinitionCorrespondence = SpecDocument &
  Readonly<{
    artifact: ArtifactModel;
    source: ArtifactSource;
    tableRows: readonly DocumentTableRow[];
    syntaxTokens: readonly DocumentText[];
    revisionRows: readonly DocumentTableRow[];
    recordedFingerprint: string | undefined;
    pairs: readonly Readonly<{
      uiId: string;
      specId: string;
      cells: readonly string[];
      location: DocumentText["location"];
      evidenceSection: DocumentText | null;
      evidenceRows: readonly DocumentTableRow[];
    }>[];
  }>;

/**
 * SPEC文書の有限なChecklist受付条件を指定する。
 * @responsibility 種別と方式を明示し、Path推定や期待列の外部組立てを避ける。
 * @trace ARCH-000008
 */
export type SpecChecklistRequest = Readonly<{
  kind:
    | "analysis_ux"
    | "analysis_ia"
    | "definition"
    | "detail_index"
    | "behavior"
    | "detail_correspondence"
    | "correspondence";
  mode: "template" | "evaluated";
}>;
/**
 * SPEC文書の原文・構造とChecklist受付結果を保持する。
 * @responsibility 部分内容と出典を保持し、局所構造と工程品質を分離する。
 * @trace ARCH-000008
 * @invariant failure=nullは構造検査だけの成立であり、品質Passや認可を意味しない。
 */
export type SpecDocument = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  checklist: readonly DocumentSection[];
  checklistContract: SpecChecklistRequest &
    Readonly<{
      expectedItems: readonly string[];
      failure: ChecklistFailure | null;
    }>;
}>;

/**
 * SpecBehavior文書の取得済み内容と出典を保持する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export type SpecBehavior = SpecDocument &
  Readonly<{
    sections: readonly DocumentSection[];
    declarations: readonly DocumentText[];
  }>;

/**
 * SPEC自身の分析・登録・定義・Detailの比較入力を表す。
 * @responsibility 取得済みモデル・出現列・集合を完成した整合比較へ渡す。
 * @trace ARCH-000008
 * @invariant 取得断面と出現重複を保持し、実在を推測しない。
 * @boundary 同一Processの取得済み値。取得範囲は呼出し元が所有する。
 * @security 認可・全品質成立を保証しない。
 */
export type SpecConsistencyRequest =
  | (Readonly<{
      specIndexPath: string;
      specAnalysisRoot: string;
      uxIds: ReadonlySet<string>;
      iaIds: ReadonlySet<string>;
      analyzedUx: ReadonlySet<string>;
      analyzedIa: ReadonlySet<string>;
      analyses: readonly SpecAnalysis[];
    }> &
      Readonly<{ kind: "spec_analysis_coverage" }>)
  | (Readonly<{
      specDefinitionsRoot: string;
      specIndexPath: string;
      definitions: readonly SpecDefinition[];
      index: SpecIndex;
      actualIds: ReadonlySet<string>;
    }> &
      Readonly<{ kind: "spec_definition_coverage" }>)
  | (Readonly<{
      specIndexPath: string;
      index: SpecIndex;
      analyses: readonly SpecAnalysis[];
      definitions: readonly SpecDefinition[];
      observedCounts: Readonly<{
        uxDefinitions: number;
        iaDefinitions: number;
        analyses: number;
        definitions: number;
        uiDefinitions: number;
      }>;
    }> &
      Readonly<{ kind: "spec_coverage" }>)
  | Readonly<{
      kind: "spec_detail_coverage";
      detail: ParseResult<SpecDetailIndex> &
        Readonly<{ result: SpecDetailIndex }>;
      actualIds: ReadonlySet<string>;
    }>;
