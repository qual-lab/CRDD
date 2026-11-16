/**
 * Change本文と変更案内の内容モデルを定義する。
 * @responsibility 原文・出典・宣言と外部観測の期待Identityを区別する。
 * @trace ARCH-000008
 */
import type {
  ArtifactModel,
  ArtifactSource,
  DocumentSection,
  DocumentTableRow,
  DocumentText,
} from "../artifact/types.ts";

/** Change本文の取得済み内容。 @responsibility 単体検査に使う構造と未解釈本文を保持する。 @trace ARCH-000008 */
export type ChangeDocument = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  mode: "canonical" | "template";
  expectedIdentity: string | null;
  changeId: string | null;
  hasStandardHeading: boolean;
  lines: readonly DocumentText[];
  tableRows: readonly DocumentTableRow[];
  trigger: readonly DocumentSection[];
  intent: readonly DocumentSection[];
  currentState: readonly DocumentSection[];
  structuralChange: readonly DocumentSection[];
  impacts: readonly DocumentSection[];
  exclusions: readonly DocumentSection[];
  decisions: readonly DocumentSection[];
  verification: readonly DocumentSection[];
  plan: readonly DocumentSection[];
  phases: readonly DocumentSection[];
  convergence: readonly DocumentSection[];
  impactHeadings: readonly DocumentText[];
  impactBlock: DocumentText | null;
  impactLines: readonly DocumentText[];
  legacyImpactHeadings: readonly DocumentText[];
  convergenceRows: readonly DocumentTableRow[];
}>;

/** 変更案内の全区画と最初の採用区画。 @responsibility 重複・区画外・二番目以降を混同しない。 @trace ARCH-000008 */
export type ChangeIndex = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  sections: readonly DocumentText[];
  selectedSection: DocumentText | null;
  entries: readonly Readonly<{ identity: string; source: DocumentText }>[];
}>;
