/**
 * Discoveryの三文書モデルと局所検査条件を定義する。
 * @responsibility 原文・出典・内容と検査結果を分離して保持する。
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
} from "../artifact/types.ts";

/**
 * Discovery文書の有限なChecklist受付条件を指定する。
 * @responsibility 種別・方式を明示し、Path推定や期待列の外部組立てを避ける。
 * @trace ARCH-000008
 */
export type DiscoveryChecklistRequest = Readonly<{
  kind: "index" | "analysis" | "definition";
  mode: "template" | "evaluated";
}>;

/**
 * Discovery文書の原文・構造とChecklist受付結果を保持する。
 * @responsibility 不完全な本文も保持し、構造検査と要求採用を分離する。
 * @trace ARCH-000008
 * @invariant failure=nullは構造検査だけの成立で、要求採用や認可を意味しない。
 */
export type DiscoveryDocument = Readonly<{
  diagramContract: ReturnType<typeof parseDiagramDisposition> | null;
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  checklist: readonly DocumentSection[];
  checklistContract: DiscoveryChecklistRequest &
    Readonly<{
      expectedItems: readonly string[];
      failure: ChecklistFailure | null;
    }>;
}>;

/**
 * 探索記録の明示内容・出典・部分情報を保持する。
 * @responsibility 問題仮説・選択・学び・引渡しを採用判断へ読み替えず保持する。
 * @trace ARCH-000008
 */
export type DiscoveryAnalysis = DiscoveryDocument &
  Readonly<{
    artifact: ArtifactModel;
    source: ArtifactSource;
    expectedIdentity: string;
    tableRows: readonly DocumentTableRow[];
    understanding: readonly DocumentSection[];
    trigger: readonly DocumentSection[];
    problem: readonly DocumentSection[];
    hypothesis: readonly DocumentSection[];
    choices: readonly DocumentSection[];
    learning: readonly DocumentSection[];
    adoptedRequirements: readonly DocumentSection[];
    handoff: readonly DocumentSection[];
    supplement: readonly DocumentSection[];
    checklist: readonly DocumentSection[];
  }>;
/**
 * 要求定義の明示内容と元の探索参照を保持する。
 * @responsibility 原文・出現・不正な参照を失わず、診断とモデルを分離する。
 * @trace ARCH-000008
 */
export type DiscoveryDefinition = DiscoveryDocument &
  Readonly<{
    artifact: ArtifactModel;
    source: ArtifactSource;
    expectedIdentity: string;
    tableRows: readonly DocumentTableRow[];
    requirement: readonly DocumentSection[];
    context: readonly DocumentSection[];
    change: readonly DocumentSection[];
    rationale: readonly DocumentSection[];
    conditions: readonly DocumentSection[];
    risks: readonly DocumentSection[];
    outOfScope: readonly DocumentSection[];
    unknown: readonly DocumentSection[];
    verification: readonly DocumentSection[];
    handoff: readonly DocumentSection[];
    relations: readonly DocumentSection[];
    supplement: readonly DocumentSection[];
    checklist: readonly DocumentSection[];
    originReferences: readonly Readonly<{
      identity: string;
      pathIdentity: string;
      source: DocumentText;
    }>[];
  }>;

/**
 * Discovery台帳の登録出現と採用の明示記載を保持する。
 * @responsibility raw行の出典・重複・採用記載とID集合を区別する。
 * @trace ARCH-000008
 * @invariant 記載された採用を新しい採否判断・品質成立へ昇格しない。
 */
export type DiscoveryIndex = DiscoveryDocument &
  Readonly<{
    artifact: ArtifactModel;
    source: ArtifactSource;
    tableRows: readonly DocumentTableRow[];
    entries: readonly Readonly<{
      identity: string;
      adopted: boolean;
      source: DocumentText;
    }>[];
    adoptedRequirementIds: ReadonlySet<string>;
  }>;
