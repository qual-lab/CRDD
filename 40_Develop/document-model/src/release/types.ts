/**
 * READMEとCHANGELOGの内容と観測断面を定義する。
 * @responsibility 原文、Headerの採用値、本文と出典を分離する。
 * @trace ARCH-000008
 */
import type {
  ArtifactModel,
  ArtifactSource,
  DocumentSection,
  DocumentTableRow,
  DocumentText,
} from "../artifact/types.ts";

/**
 * README全体と旧Header観測のモデル。
 * @responsibility 全文のStable表示と先頭可視Headerの版を混同しない。
 * @trace ARCH-000008
 * @invariant 版欠測は採用済み規則なしに局所違反へ昇格しない。
 */
export type Readme = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  rawLines: readonly DocumentText[];
  outsideFenceLines: readonly DocumentText[];
  selectedHeader: DocumentText | null;
  version: string | null;
  releaseHeader: DocumentText;
  candidateDeclarations: readonly DocumentText[];
  english: readonly DocumentSection[];
  japanese: readonly DocumentSection[];
}>;

/**
 * CHANGELOGの宣言解析と出典を保持する。
 * @responsibility 有効値と不正理由を区別し、元の宣言行を残す。
 * @trace ARCH-000008
 */
export type ChangelogDeclaration =
  | Readonly<{ valid: true; value: string; attempts: readonly DocumentText[] }>
  | Readonly<{
      valid: false;
      reason: string;
      attempts: readonly DocumentText[];
    }>;

/**
 * 一つの版節の内容と移行宣言。
 * @responsibility 全版を保持し、検査対象版の選択とは分離する。
 * @trace ARCH-000008
 */
export type ChangelogRelease = Readonly<{
  heading: DocumentText;
  body: DocumentText;
  outsideLines: readonly DocumentText[];
  migrationRequired: ChangelogDeclaration;
  changeClassification: ChangelogDeclaration;
  migrationNotes: readonly Readonly<{
    label: string;
    evidence: readonly DocumentText[];
  }>[];
}>;

/**
 * 多版CHANGELOGと診断対象の明示選択。
 * @responsibility 言語節の全出現・版節・宣言・原文を保持する。
 * @trace ARCH-000008
 * @invariant 過去版の内容捕捉を、現行規則での合否判定へ変換しない。
 */
export type Changelog = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  rawLines: readonly DocumentText[];
  selectedVersion: string;
  languages: readonly Readonly<{
    name: string;
    sections: readonly Readonly<{
      heading: DocumentText;
      body: DocumentText;
      releases: readonly ChangelogRelease[];
    }>[];
    selectedReleases: readonly ChangelogRelease[];
  }>[];
}>;

/**
 * CRDD正本文書群の共通Headerと文書全体を保持する。
 * @responsibility 版・状態・Baselineと取得断面を分け、工程固有本文の解析を代替しない。
 * @trace ARCH-000008
 * @invariant 宣言を採用・公開・実行のAuthorityへ変換しない。
 */
export type CanonicalDocument = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  rawLines: readonly DocumentText[];
  /** 正規化済みHeader。出典は最初の採用field、欠測はnull。 */
  header: DocumentText | null;
  version: string | null;
  status: string | null;
  releasedBaseline: string | null;
  candidateVersion: string | null;
  releaseStates: readonly DocumentText[];
}>;

/**
 * Releaseモデルと観測済み版・Tagの整合を判定する閉じた入力。
 * 取得済み断面を全本文へ補完しない。
 * stableTagCommitのnullは未確認であり、不存在や公開許可を意味しない。
 */
export type ReleaseConsistencyRequest =
  | Readonly<{
      kind: "roadmap_title";
      document: CanonicalDocument;
    }>
  | Readonly<{
      kind: "readme_version";
      readme: Readme;
      expectedVersion: string;
    }>
  | Readonly<{
      kind: "release_evidence_navigation";
      index: CanonicalDocument;
      evidencePaths: readonly string[];
    }>
  | Readonly<{
      kind: "stable_tag_identity";
      stableVersion: string;
      hasDifferentCandidateVersion: boolean;
      stableTagCommit: string | null;
      currentHeadCommit: string | null;
      path: string;
    }>
  | Readonly<{
      kind: "stable_canonical_documents";
      documents: readonly CanonicalDocument[];
      stableVersion: string;
    }>
  | Readonly<{
      kind: "stable_release_document";
      document: CanonicalDocument;
      stableVersion: string;
      stableTagCommit: string | null;
    }>
  | Readonly<{
      kind: "stable_changelog";
      changelog: Changelog;
      stableVersion: string;
    }>
  | Readonly<{ kind: "stable_readme"; readme: Readme; stableVersion: string }>;

/**
 * Release Projectionの一つのScope行を定義する。
 *
 * @responsibility 段階、範囲、現在状態および正本表示を同じ行へ閉じる。
 * @trace ARCH-000005
 * @shape stage、scope、state、ownerを表す。
 * @invariant 空Cellを既知の計画へ補完しない。
 * @boundary Release Projection表とConsumerの型境界。
 * @security Link URLを含めず表示文字だけを保持する。
 * @compatibility 列追加時はParserと全Consumerを再評価する。
 */
export type RepositoryReleaseScope = Readonly<{
  stage: string;
  scope: string;
  state: string;
  owner: string;
}>;

/**
 * Release Projectionの一つの依存・判断行を定義する。
 *
 * @responsibility 項目、現在状態および次の処置を同じ行へ閉じる。
 * @trace ARCH-000005
 * @shape item、state、nextを表す。
 * @invariant 判断なしと未記載を同一視しない。
 * @boundary Release Projection表とConsumerの型境界。
 * @security N/A: 表示文字だけを保持する。
 * @compatibility 列追加時はParserと全Consumerを再評価する。
 */
export type RepositoryReleaseDependency = Readonly<{
  item: string;
  state: string;
  next: string;
}>;

/**
 * RepositoryのCurrent Release Projectionを定義する。
 *
 * @responsibility 公開Baseline、次Version、期限、状態、Risk、Scope、依存および判断を一Snapshotへ閉じる。
 * @trace ARCH-000005
 * @shape current state、scope、dependenciesを表す。
 * @invariant 目標日未設定を日付へ補完せずnullで保持する。
 * @boundary Release Projection ReaderとWorkbench／MCP等のConsumer境界。
 * @security 正本参照のURLやRepository外情報を公開しない。
 * @compatibility 固定項目名または表構造変更時は全Consumerを再評価する。
 */
export type RepositoryReleaseProjection = Readonly<{
  publishedBaseline: string;
  targetVersion: string;
  targetReleaseDate: string | null;
  workState: string;
  releaseDecision: string;
  scheduleRisk: string;
  scope: readonly RepositoryReleaseScope[];
  dependencies: readonly RepositoryReleaseDependency[];
}>;
