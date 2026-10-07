/**
 * Project Contextの投影・読取り・候補判断の値契約を定義する。
 *
 * @packageDocumentation
 * @responsibility 同じ投影責務に属する不変値と閉じた状態語彙だけを保持する。
 * @trace ARCH-000005
 * @trace ARCH-000016
 * @boundary Project Context解析・投影と利用側の型境界。
 * @security 非開示Sourceや採用Authorityを型から生成しない。
 */
/**
 * Project Context投影へ渡すSource状態を定義する。
 *
 * @responsibility completeと五つの不完全状態を空値へ畳まず型境界で固定する。
 * @trace ARCH-000005
 * @shape complete、missing、restricted、stale、conflicting、unknownの閉集合を表す。
 * @invariant 不完全状態をcompleteへ暗黙変換しない。
 * @boundary Project Source ReaderとProjectorの型境界。
 * @security restrictedをmissingへ変換して存在推測の手掛かりを追加しない。
 * @compatibility 利用側は宣言済み六状態だけへ依存する。
 */
export type ProjectOperationSourceState =
  | "complete"
  | "missing"
  | "restricted"
  | "stale"
  | "conflicting"
  | "unknown";

/**
 * Projectorへ渡す一つのSource観測を定義する。
 *
 * @responsibility 項目Identity、状態、出所、改訂版、観測時点および観測値を同じ入力へ閉じる。
 * @trace ARCH-000005
 * @shape fieldIdとstateを必須とし、観測可能なSource情報だけを任意Propertyで保持する。
 * @invariant restricted状態の公開結果へSource Identityとvalueを引き継がない。
 * @boundary 複数Source ReaderとProjectorの入力境界。
 * @security valueは呼出し側で許可済みの構造化値に限り、本型はAuthorityを表さない。
 * @compatibility 新しい状態追加はProjectorと全Consumerの再評価を必要とする。
 */
export type ProjectOperationSource = Readonly<{
  fieldId: string;
  state: ProjectOperationSourceState;
  sourceId?: string;
  sourceRevision?: string;
  observedAt?: string;
  value?: unknown;
}>;

/**
 * Project Viewへ投影した一つの項目を定義する。
 *
 * @responsibility 入力状態を保ったまま、開示可能な出所と値だけを公開する。
 * @trace ARCH-000005
 * @shape fieldId、state、source、revision、observedAtおよびvalueを表す。
 * @invariant restrictedではsourceId、sourceRevision、observedAt、valueをnullへ固定する。
 * @boundary ProjectorとWorkbench／MCP等の利用側の結果境界。
 * @security restricted Sourceの存在以上の情報を公開しない。
 * @compatibility nullは未観測または非開示であり、空文字や正常値を意味しない。
 */
export type ProjectOperationProjectionItem = Readonly<{
  fieldId: string;
  state: ProjectOperationSourceState;
  sourceId: string | null;
  sourceRevision: string | null;
  observedAt: string | null;
  value: unknown | null;
}>;

/**
 * Project Viewの読取り専用結果を定義する。
 *
 * @responsibility 全項目の状態と全体のcomplete／partial判定を同じProjectionへ閉じる。
 * @trace ARCH-000005
 * @shape projectId、projectionId、statusおよび項目列を表す。
 * @invariant 一つでも不完全状態があればstatusをpartialとする。
 * @boundary Projectorと利用側の公開Read Model境界。
 * @security Projectionは書込みAuthorityまたは非開示Source一覧を持たない。
 * @compatibility 利用側はstatusだけで個別項目の状態を推定しない。
 */
export type ProjectOperationProjection = Readonly<{
  projectId: string;
  projectionId: string;
  status: "complete" | "partial";
  items: readonly ProjectOperationProjectionItem[];
}>;

/**
 * Project Operation候補のCanonical最小記録を定義する。
 *
 * @responsibility Candidate Identity、出所、対象Owner、基準Revision、媒体表示および状態を一つの記録へ閉じる。
 * @trace ARCH-000006
 * @shape created／under_review／adopted／rejected／heldの状態と採否Relationを表す。
 * @invariant adopted以外の状態は所有正本Revisionを変更しない。
 * @boundary Candidate Storeと所有正本Writerの型境界。
 * @security 媒体表示名から候補種別、Ownerまたは採用Authorityを推定しない。
 * @compatibility Candidate IdentityとsourceRevisionの意味を変更しない。
 */
export type ProjectOperationCandidate = Readonly<{
  candidateId: string;
  sourceId: string;
  sourceRevision: string;
  targetOwner: string;
  expectedOwnerRevision: number;
  mediumLabel: string;
  state: "created" | "under_review" | "adopted" | "rejected" | "held";
}>;

/**
 * 候補へ適用する人間判断を定義する。
 *
 * @responsibility adopt、reject、holdと判断主体・対象Revisionを明示入力として保持する。
 * @trace ARCH-000006
 * @shape decision、principalId、authorityVerifiedおよびobservedOwnerRevisionを表す。
 * @invariant authorityVerifiedは外部Authority境界の観測結果であり、本Subsystemが発行しない。
 * @boundary Human Decision AdapterとCandidate Adoptionの入力境界。
 * @security principalIdだけからAuthorityを推定しない。
 * @compatibility 判断値の追加時は正本Effectと全利用側を再評価する。
 */
export type ProjectOperationCandidateDecision = Readonly<{
  decision: "adopt" | "reject" | "hold";
  principalId: string;
  authorityVerified: boolean;
  observedOwnerRevision: number;
}>;

/**
 * 候補採否の公開結果を定義する。
 *
 * @responsibility 採否状態、正本Effect有無、次Revisionおよび拒否理由を一つの結果へ閉じる。
 * @trace ARCH-000006
 * @shape completedまたはblockedと、Candidate状態・Effect情報を表す。
 * @invariant blocked、reject、holdではownerEffectIssuedをfalseとする。
 * @boundary Candidate Adoptionと所有正本Writerの結果境界。
 * @security 結果は採用Authorityまたは正本Writer Capabilityを含まない。
 * @compatibility reason値は利用側が安全な停止を識別する安定契約である。
 */
export type ProjectOperationCandidateDecisionResult = Readonly<{
  status: "completed" | "blocked";
  reason:
    | "project_operation_candidate_adopted"
    | "project_operation_candidate_rejected"
    | "project_operation_candidate_held"
    | "project_operation_candidate_invalid"
    | "project_operation_candidate_authority_invalid"
    | "project_operation_candidate_revision_conflict"
    | "project_operation_candidate_already_decided";
  candidateState: ProjectOperationCandidate["state"];
  ownerEffectIssued: boolean;
  nextOwnerRevision: number | null;
}>;

/**
 * Repository Project Contextの場面Keyを定義する。
 *
 * @responsibility 五つの固定場面を安定したConsumer Keyへ対応付ける。
 * @trace ARCH-000005
 * @shape current、risk、decision、reason、nextの閉集合を表す。
 * @invariant Markdown上の場面順序とKeyの対応を変更しない。
 * @boundary Project Context ReaderとConsumer View Modelの型境界。
 * @security N/A: 公開済みの構造Keyだけを表す。
 * @compatibility Key追加・変更時は全Consumerの再評価を必要とする。
 */
export type RepositoryProjectContextSceneKey =
  | "current"
  | "risk"
  | "decision"
  | "reason"
  | "next";

/**
 * Project Context内の一つのMarkdown表を定義する。
 *
 * @responsibility Headerと各行のCellを列順を変えず保持する。
 * @trace ARCH-000005
 * @shape columnsとrowsから成る読取り専用表を表す。
 * @invariant 行の列数はHeaderの列数と一致する。
 * @boundary Markdown TableとWorkbench／MCP等のConsumerの型境界。
 * @security Cell内のMarkdownを実行可能なHTMLへ変換しない。
 * @compatibility Consumerは列名を勝手に補完しない。
 */
export type RepositoryProjectContextTable = Readonly<{
  columns: readonly string[];
  rows: readonly (readonly string[])[];
}>;

/**
 * Project Contextの一つの固定場面を定義する。
 *
 * @responsibility 場面名、先行要約および構造化表を一つの読取り結果へ閉じる。
 * @trace ARCH-000005
 * @shape key、title、summaryおよびtableを表す。
 * @invariant keyとtitleは固定された同じ場面を指す。
 * @boundary Project Context ReaderとConsumerの場面単位境界。
 * @security 要約や表にない判断を生成しない。
 * @compatibility summaryが存在しない場面はnullで保持する。
 */
export type RepositoryProjectContextScene = Readonly<{
  key: RepositoryProjectContextSceneKey;
  title: string;
  summary: string | null;
  table: RepositoryProjectContextTable;
}>;

/**
 * Repository Project Contextの構造化読取り結果を定義する。
 *
 * @responsibility Repository Identityと五場面を同じSnapshotとして公開する。
 * @trace ARCH-000005
 * @shape projectId、repositoryId、repositoryRoleおよびscenesを表す。
 * @invariant scenesは五場面を固定順で一度ずつ含む。
 * @boundary Repository Markdownと人間・AI・MCP・Workbenchの共通結果境界。
 * @security Repository Role外の情報を推測して追加しない。
 * @compatibility Identityまたは五場面が欠ける旧形式を暗黙変換しない。
 */
export type RepositoryProjectContext = Readonly<{
  projectId: string;
  repositoryId: string;
  repositoryRole: string;
  scenes: readonly RepositoryProjectContextScene[];
}>;

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

/**
 * RepositoryのCurrent Quality Projectionを定義する。
 *
 * @responsibility 品質状態、対象、Coverage、Gap、Gate、人間判断および根拠を一Snapshotへ閉じる。
 * @trace ARCH-000005
 * @shape overallState、target、observed、unobserved、knownGap、nextGate、humanDecisionおよびrationaleを表す。
 * @invariant 未観測を観測済みへ、進行中GapをPassへ変換しない。
 * @boundary Quality Center ProjectionとConsumerの型境界。
 * @security Evidence本文、内部Pathまたは非開示結果を追加しない。
 * @compatibility 固定項目変更時はParserと全Consumerを再評価する。
 */
export type RepositoryQualityProjection = Readonly<{
  overallState: string;
  target: string;
  observed: string;
  unobserved: string;
  knownGap: string;
  nextGate: string;
  humanDecision: string;
  rationale: Readonly<Record<string, string>>;
}>;
