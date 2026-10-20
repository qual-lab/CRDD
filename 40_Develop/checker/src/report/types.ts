/**
 * Checkerの表示契約を表す診断型。
 *
 * @responsibility 文書・Rule・Semantic・Reality診断の異なる既存shapeを各型として保持する。
 * @trace ARCH-000001
 */
/**
 * Rule検査が返す公開診断型を定義する。
 *
 * @responsibility 重要度・code・Path・Rule・文言と任意Evidenceの既存shapeを保持する。
 * @trace ARCH-000001
 * @shape severityはerror／warning、ruleは必須、evidenceは任意の文字列列。
 * @invariant CheckerFindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: CheckerFindingの宣言は外部境界を開かない。
 * @security N/A: CheckerFindingはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CheckerFindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CheckerFinding = Readonly<{
  severity: "error" | "warning";
  code: string;
  path: string;
  rule: string;
  message: string;
  evidence?: readonly string[];
}>;

/**
 * Rule診断を一件ずつ渡す追加操作の型。
 *
 * @responsibility 診断の追加先を単一の同期callbackとして表す。
 * @trace ARCH-000001
 * @shape FindingSinkが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FindingSinkで宣言した値と責務の対応を維持する。
 * @boundary N/A: FindingSinkの宣言は外部境界を開かない。
 * @security N/A: FindingSinkはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility FindingSinkの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type FindingSink = (finding: CheckerFinding) => void;

/**
 * 通常文書検査の四field診断型を定義する。
 *
 * @responsibility 通常文書レポートの既存shapeを公開Rule診断と区別して保持する。
 * @trace ARCH-000001
 * @shape severity・code・path・message。ruleやevidenceを追加しない。
 * @invariant severityの既存string型を勝手に狭めない。
 * @boundary 通常文書のJSON／人間表示へ渡す値契約。
 * @security 型の集約は診断へのAuthorityや品質成立を追加しない。
 * @compatibility field・文字列値・出力形を変更しない。Package Rootへは公開しない。
 */
export type DocumentFinding = Readonly<{
  severity: string;
  code: string;
  path: string;
  message: string;
}>;

/**
 * 文書検査の参照元・参照先の表示モデル。
 *
 * @responsibility 既存参照表示のPath・件数・Anchorと参照文字列を保持する。
 * @trace ARCH-000001
 * @shape target、inbound、outboundの既存三field。
 * @invariant 観測順・null Anchor・空配列を変更しない。
 * @boundary 観測済み参照集合と表示処理の値境界。
 * @security 参照の安全性・存在・認可を新たに保証しない。
 * @compatibility 既存JSONのfieldと値を維持する。
 */
export type DocumentReferenceMap = Readonly<{
  target: string;
  inbound: readonly Readonly<{
    source: string;
    count: number;
    links: readonly string[];
  }>[];
  outbound: readonly Readonly<{
    target: string;
    anchor: string | null;
    count: number;
  }>[];
}>;

/**
 * 通常文書検査が構築する既存レポート。
 *
 * @responsibility 観測・検査で確定したfieldを表示へ渡す。
 * @trace ARCH-000001
 * @shape 範囲、観測状態、未検査、固定時刻、件数、診断、任意参照map。
 * @invariant Report構築・時刻取得・診断順・終了判断は表示側で変更しない。
 * @boundary 文書検査と表示処理の同期値境界。
 * @security 未観測のnullをfalseや成功へ変換しない。
 * @compatibility 既存field・JSON key順は呼出し元のObjectのまま維持する。
 */
export type DocumentReport = Readonly<{
  check_mode: string;
  repository_mode: string;
  gitlink_detection: string;
  gitlink_boundaries: readonly string[];
  change_trace_layout: string;
  recognized_change_trace_paths: readonly string[];
  discovery_source: string;
  discovery_git_failure: string | null;
  baseline_submodule: boolean;
  baseline_submodule_initialized: boolean | null;
  baseline_submodule_state: Readonly<{
    declared: boolean | null;
    gitlink_indexed: boolean | null;
    gitlink_conflicted: boolean | null;
    gitlink_oid: string | null;
    worktree_present: boolean | null;
    gitdir_accessible: boolean | null;
    head_readable: boolean | null;
    head_oid: string | null;
    head_matches_gitlink: boolean | null;
  }>;
  discovery_exclusions: readonly string[];
  root: string;
  requested_scope: readonly string[];
  expanded_scope: readonly string[];
  expanded_scope_file_count: number;
  expanded_scope_truncated: boolean;
  global_checks: readonly string[];
  unchecked: readonly string[];
  executed_at: string;
  duration_ms: number;
  metrics: Readonly<{
    files_discovered: number;
    markdown_files_discovered: number;
    markdown_files_checked: number;
    local_links_checked: number;
    anchors_checked: number;
    related_blocks_checked: number;
    versioned_documents_checked: number;
    stable_ids_observed: number;
    gitlinks_observed: number;
    explicit_stable_id_definitions: number;
    numeric_rows_checked: number;
    remediation_rows_checked: number;
    errors: number;
    warnings: number;
  }>;
  findings: readonly DocumentFinding[];
  references: DocumentReferenceMap | null;
}>;

/**
 * Domain Issueを利用側へ返す診断形式を表す。
 *
 * @responsibility 安定code、Pathおよび人間向けmessageを保持する。
 * @trace ARCH-000008
 * @shape SemanticCoverageDiagnosticが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SemanticCoverageDiagnosticで宣言した値と責務の対応を維持する。
 * @boundary N/A: SemanticCoverageDiagnosticの宣言は外部境界を開かない。
 * @security N/A: SemanticCoverageDiagnosticはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SemanticCoverageDiagnosticの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SemanticCoverageDiagnostic = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

/**
 * reality-traceabilityで使用するChecker Reality Findingの値契約を定義する。
 *
 * @responsibility Checker Reality FindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000001
 * @shape CheckerRealityFindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CheckerRealityFindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: CheckerRealityFindingの宣言は外部境界を開かない。
 * @security N/A: CheckerRealityFindingはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CheckerRealityFindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CheckerRealityFinding = Readonly<{
  code: string;
  path: string;
  message: string;
}>;
