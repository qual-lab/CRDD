/**
 * UI文書の明示された内容をモデル化する。
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
} from "../artifact/types.ts";

/**
 * UIの成果・表示・操作・状態・対応SPECを表す。
 * @responsibility 同名節の全出現、参照、期待IDと宣言本文を分離して保持する。
 * @trace ARCH-000008
 * @invariant 空配列は節欠測、空本文は節の存在を表す。自由記述から状態機械を推定しない。
 * @security 宣言された承認やReadyを検証済みAuthorityへ昇格しない。
 */
export type UiDefinition = UiDocument &
  Readonly<{
    correspondenceTitle: DocumentText | null;
    correspondenceSections: ReadonlyMap<string, DocumentText>;
    artifact: ArtifactModel;
    source: ArtifactSource;
    expectedIdentity: string;
    declarations: readonly DocumentText[];
    syntaxTokens: readonly DocumentText[];
    outcome: readonly DocumentSection[];
    uxAnalysis: readonly DocumentSection[];
    iaAnalysis: readonly DocumentSection[];
    formalInputs: readonly DocumentSection[];
    integration: readonly DocumentSection[];
    presentation: readonly DocumentSection[];
    interaction: readonly DocumentSection[];
    states: readonly DocumentSection[];
    accessibility: readonly DocumentSection[];
    constraints: readonly DocumentSection[];
    specificationReview: readonly DocumentSection[];
    specifications: readonly DocumentSection[];
    unresolved: readonly DocumentSection[];
    verification: readonly DocumentSection[];
    analysisInputs: Readonly<{
      ux: readonly DocumentReference[];
      ia: readonly DocumentReference[];
    }>;
    pairedSpecifications: readonly DocumentReference[];
  }>;

/**
 * UI分析が正式入力から受け取る内容と処置を保持する。
 * @responsibility UXとIAの観点を判別し、名前付き内容・参照・欠測・重複・出典を保持する。
 * @trace ARCH-000008
 * @invariant 期待IDと本文宣言は別物。自由記述から他観点の結論を補完しない。
 * @security 原文の図・例は保持するが、参照や品質成立の根拠へ自動昇格しない。
 */
export type UiAnalysis = UiDocument &
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
        recognition: readonly DocumentSection[];
        experience: readonly DocumentSection[];
      }>
    | Readonly<{
        view: "ia";
        informationStructure: readonly DocumentSection[];
        priorities: readonly DocumentSection[];
        visibility: readonly DocumentSection[];
      }>
  );

/**
 * UI登録台帳の出現行と正式入力を保持する。
 * @responsibility 重複と不正な表行を消さず、登録宣言と実在確認を区別する。
 * @trace ARCH-000008
 */
export type UiIndex = Readonly<{
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
    cells: readonly string[];
    location: DocumentText["location"];
  }>[];
}>;
/**
 * UI Detail統合台帳の明示された設計対応を保持する。
 * @responsibility 適用処置・領域・画面・部品・理由・出典と全出現を保持する。
 * @trace ARCH-000008
 * @invariant bindingsは最後のSCR/PRT両方が得られる行を使い、被覆成立を意味しない。
 */
export type UiDetailIndex = UiDocument &
  Readonly<{
    artifact: ArtifactModel;
    source: ArtifactSource;
    tableRows: readonly DocumentTableRow[];
    declarations: readonly DocumentText[];
    entries: readonly Readonly<{
      identity: string;
      definition: string | null;
      applicability: string | null;
      area: string | null;
      detailReference: string | null;
      reason: string | null;
      screenId: string | null;
      partId: string | null;
      cells: readonly string[];
      location: DocumentText["location"];
    }>[];
    bindings: ReadonlyMap<string, Readonly<{ scr: string; prt: string }>>;
  }>;

/**
 * Screenと、その中に定義されたPart・Interactionを保持する。
 * @responsibility 期待Screen IDと本文宣言を分離し、図・欠測・重複・出典を残す。
 * @trace ARCH-000008
 * @security 記載された状態や対応を検証済みの成立へ昇格しない。
 */
export type UiScreen = UiDocument &
  Readonly<{
    artifact: ArtifactModel;
    source: ArtifactSource;
    expectedIdentity: string;
    declarations: readonly DocumentText[];
    targetUi: Readonly<{
      identity: string;
      location: DocumentText["location"];
    }> | null;
    purpose: readonly DocumentSection[];
    composition: readonly DocumentSection[];
    interactions: readonly DocumentSection[];
    states: readonly DocumentSection[];
    accessibility: readonly DocumentSection[];
    promotion: readonly DocumentSection[];
    unresolved: readonly DocumentSection[];
    tableRows: readonly DocumentTableRow[];
    parts: readonly Readonly<{
      identity: string;
      responsibility: string | null;
      information: string | null;
      operation: string | null;
      stateOrVariant: string | null;
      cells: readonly string[];
      location: DocumentText["location"];
    }>[];
    relationRows: readonly Readonly<{
      interactionKey: string;
      behaviorId: string;
      cells: readonly string[];
      location: DocumentText["location"];
    }>[];
  }>;

/**
 * UI文書の有限なChecklist受付条件を指定する。
 * @responsibility 種別と方式を明示し、Path推定や期待列の外部組立てを避ける。
 * @trace ARCH-000008
 */
export type UiChecklistRequest = Readonly<{
  kind:
    | "analysis_ux"
    | "analysis_ia"
    | "definition"
    | "detail_index"
    | "area"
    | "screen"
    | "component"
    | "visual_baseline"
    | "handoff";
  mode: "template" | "evaluated";
}>;
/**
 * UI文書の原文・構造とChecklist受付結果を保持する。
 * @responsibility 部分内容と出典を保持し、局所構造と工程品質を分離する。
 * @trace ARCH-000008
 * @invariant failure=nullは構造検査だけの成立であり、品質Passや認可を意味しない。
 */
export type UiDocument = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  checklist: readonly DocumentSection[];
  checklistContract: UiChecklistRequest &
    Readonly<{
      expectedItems: readonly string[];
      failure: ChecklistFailure | null;
    }>;
}>;

/**
 * UiArea文書の取得済み内容と出典を保持する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export type UiArea = UiDocument &
  Readonly<{
    sections: readonly DocumentSection[];
    declarations: readonly DocumentText[];
  }>;

/**
 * UiComponent文書の取得済み内容と出典を保持する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export type UiComponent = UiDocument &
  Readonly<{
    sections: readonly DocumentSection[];
    declarations: readonly DocumentText[];
  }>;

/**
 * UiVisualBaseline文書の取得済み内容と出典を保持する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export type UiVisualBaseline = UiDocument &
  Readonly<{
    sections: readonly DocumentSection[];
    declarations: readonly DocumentText[];
  }>;

/**
 * UiHandoff文書の取得済み内容と出典を保持する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export type UiHandoff = UiDocument &
  Readonly<{
    sections: readonly DocumentSection[];
    declarations: readonly DocumentText[];
  }>;
