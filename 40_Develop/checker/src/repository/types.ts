/**
 * Repository探索の観測結果と入力を定義する。
 *
 * @responsibility nullを観測不能と区別した既存の探索結果を保持する。
 * @trace ARCH-000001
 */
/**
 * current-profileで使用するBaseline Submodule 状態の値契約を定義する。
 *
 * @responsibility Baseline Submodule 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000001
 * @shape BaselineSubmoduleStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant BaselineSubmoduleStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: BaselineSubmoduleStateの宣言は外部境界を開かない。
 * @security N/A: BaselineSubmoduleStateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility BaselineSubmoduleStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type BaselineSubmoduleState = Readonly<{
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

/**
 * current-profileで使用するDiscoveryの値契約を定義する。
 *
 * @responsibility DiscoveryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000001
 * @shape Discoveryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Discoveryで宣言した値と責務の対応を維持する。
 * @boundary N/A: Discoveryの宣言は外部境界を開かない。
 * @security N/A: DiscoveryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility Discoveryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type Discovery = Readonly<{
  files: string[];
  source: string;
  git_failure: string | null;
  gitlink_detection: string;
  gitlinks: string[];
  baseline_submodule: boolean;
  baseline_submodule_initialized: boolean | null;
  baseline_submodule_state: BaselineSubmoduleState;
  exclusions: string[];
  unchecked: string[];
}>;

/**
 * current-profileで使用するGitlink Entryの値契約を定義する。
 *
 * @responsibility Gitlink EntryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000001
 * @shape GitlinkEntryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant GitlinkEntryで宣言した値と責務の対応を維持する。
 * @boundary N/A: GitlinkEntryの宣言は外部境界を開かない。
 * @security N/A: GitlinkEntryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility GitlinkEntryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type GitlinkEntry = Readonly<{ path: string; oid: string }>;
/**
 * 既に確認したRootと基準版の探索入力。
 *
 * @responsibility 初期観測を再実行せず探索へ渡す。
 * @trace ARCH-000001
 * @shape Root、宣言済み入れ子Path、基準版候補と三値の観測結果。
 * @invariant 不明な宣言はnullのまま渡す。
 * @boundary N/A: Process内の型。
 * @security 入力型はRoot検証・認可を発行しない。
 * @compatibility 既存探索時点の値を保持する。
 */
export type RepositoryDiscoveryInput = Readonly<{
  root: string;
  declaredSubmodules: readonly string[];
  baselineCandidateRoot: string;
  isBaselineDeclared: boolean | null;
  isBaselineDeclarationCandidate: boolean;
  isBaselineEntryDirectory: boolean;
}>;

/**
 * current-profileで使用するLocal Link Resolutionの値契約を定義する。
 *
 * @responsibility Local Link ResolutionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000001
 * @shape LocalLinkResolutionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LocalLinkResolutionで宣言した値と責務の対応を維持する。
 * @boundary N/A: LocalLinkResolutionの宣言は外部境界を開かない。
 * @security N/A: LocalLinkResolutionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LocalLinkResolutionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LocalLinkResolution = Readonly<{
  external: false;
  target: string;
  anchor: string;
  targetText: string;
  decodeError: boolean;
  outsideRoot: boolean;
  symbolicBoundary: boolean;
}>;

/**
 * current-profileで使用するLink Resolutionの値契約を定義する。
 *
 * @responsibility Link ResolutionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000001
 * @shape LinkResolutionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LinkResolutionで宣言した値と責務の対応を維持する。
 * @boundary N/A: LinkResolutionの宣言は外部境界を開かない。
 * @security N/A: LinkResolutionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LinkResolutionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LinkResolution =
  | LocalLinkResolution
  | Readonly<{
      external: true;
      target: null;
      anchor: string;
      targetText: string;
      decodeError: boolean;
      outsideRoot: false;
    }>;

/**
 * current-profileで使用するLink 記録の値契約を定義する。
 *
 * @responsibility Link 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000001
 * @shape LinkRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LinkRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: LinkRecordの宣言は外部境界を開かない。
 * @security N/A: LinkRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LinkRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LinkRecord = LinkResolution &
  Readonly<{
    source: string;
    raw: string;
    fixedHistoricalReference: boolean;
    historicalTargetExists: boolean;
    historicalAnchorExists: boolean | null;
  }>;
