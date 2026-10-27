/**
 * 実行状態の共有値・純粋検査を所有する。
 * @packageDocumentation
 * @responsibility 既存の保存形状・相関・三値を保持し、実行・資源観測・Authorityを発行しない。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary 保存値の意味だけ。OS・Provider・Dockerの操作は所有しない。
 */

import type { COORDINATOR_INTEGRATION_CONTRACT } from "./validation.ts";

/**
 * Isolated Workspaceの現在値を表す。
 * @responsibility 同UUIDの作成・利用・破棄途中と現在世代を保持する。
 * @trace ARCH-000004
 * @shape ID、世代、Base、HEAD、状態、保留、処置、技術結果。
 * @invariant Task終端で自動除去しない。Task一覧を重複保持しない。
 * @boundary 同じRepositoryのstate.json。
 * @security この記録だけで実行・削除を許可しない。
 * @compatibility 新Snapshot専用。旧形式の補完なし。
 */
export type CoordinatorWorkspace = Readonly<{
  workspaceId: string;
  name: string | null;
  candidate: CoordinatorWorkspaceCandidate | null;
  generation: number;
  baseCommit: string;
  head: string;
  phase: "creating" | "ready" | "discarding";
  holdUntil: string | null;
  pending: Readonly<{
    operationId: string;
    kind: "create" | "discard";
    expectedHead: string;
    discardChanges: boolean;
  }> | null;
  lastResult: RepositoryWorktreeResult | null;
  primaryFailure: string | null;
}>;

/**
 * 候補公開・採用結果の完全な保存値を定義する。
 *
 * @responsibility 候補公開と採用Receiptの結合・内容を現在状態の結果区画として保持する。
 * @trace ARCH-000005
 * @shape contract、kind、四つの結合ID、identity、contentHash、value。
 * @invariant 保存成功を受領・既読へ読み替えない。
 * @boundary 候補結果Portと現在状態保存。
 * @security 保護DecisionやAuthorityを追加しない。
 * @compatibility valueは既存PortのJSON値をそのまま保持する。
 */
export type CoordinatorResultRecord = Readonly<{
  contract: typeof COORDINATOR_INTEGRATION_CONTRACT;
  kind: "integration" | "adoption";
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string | null;
  queueId: string;
  identity: string;
  contentHash: string;
  value: unknown;
}>;

/**
 * 一つの固定候補の意図と結果を既存Workspace記録へ結合する。
 * @responsibility 固定・採用・Ref回収の同操作再入場。
 * @trace ARCH-000004
 * @shape 固定要求、段階、候補OID、取込先、結果と採否。
 * @invariant 候補固定と採用を別操作とし名前は固定時の値を保持。
 * @boundary 既存state.jsonのみ。
 * @security 現在認可への再結合なしでEffectを許可しない。
 * @compatibility 新形式のみ、旧記録を補完しない。
 */
export type CoordinatorWorkspaceCandidate = Readonly<{
  request: WorkspaceCandidateRequest;
  phase: "freezing" | "fixed" | "merging" | "merged" | "removing";
  candidateCommit: string | null;
  target: Readonly<{ targetBranch: string; expectedTargetHead: string }> | null;
  mergeCommit: string | null;
  disposition: "adopted" | "rejected" | null;
  lastResult: WorkspaceCandidateResult | null;
  primaryFailure: string | null;
  cleanupFailure: string | null;
}>;

/**
 * 要求と終了段階を結合した結果。
 * @responsibility 発行前拒否と発行後不明、部分削除を区別する。
 * @trace ARCH-000009
 * @shape 固定対象、一次理由、Effect発行と段階別不存在。
 * @invariant 完了は実観測後だけ。失敗時も同対象を保持する。
 * @boundary Package公開API。
 * @security この値自体は削除Authorityではない。
 * @compatibility 呼出し元が採否・非使用を所有する。
 */
export type RepositoryWorktreeResult = Readonly<{
  status: "completed" | "blocked";
  reason: string;
  workspaceId: string;
  relativePath: string | null;
  branch: string | null;
  expectedCommit: string | null;
  effectIssued: boolean;
  worktreeRemoved: boolean | null;
  branchRemoved: boolean | null;
  workspaceDirectoryRetained: boolean | null;
  observation: RepositoryWorktreeObservation | null;
}>;

/**
 * 固定候補と同操作再入場の閉じた要求を表す。
 * @responsibility 名前の説明用途と機械Identityを分ける。
 * @trace ARCH-000009
 * @shape Workspace、操作UUID、Base、選択、固定時表示名とCHG。
 * @invariant Candidate Refは操作UUIDへ結合しWorkspace HEADを動かさない。
 * @boundary VC公開API。
 * @security 呼出し元が現在認可と内容確認を所有する。
 * @compatibility 名前は省略可能・非一意。
 */
export type WorkspaceCandidateRequest = Readonly<{
  workspaceId: string;
  operationId: string;
  baseCommit: string;
  expectedWorkspaceHead: string;
  selection: readonly WorkspaceCandidateSelection[];
  workspaceName: string | null;
  candidateName: string | null;
  relatedChangeIds: readonly string[];
}>;

/**
 * Git Effectと結果・一時物清掃を分離する。
 * @responsibility 成功、拒否、発行後不明を失わず上位へ返す。
 * @trace ARCH-000009
 * @shape 対象Ref、候補Commit、統合Commit、変更Pathと清掃状態。
 * @invariant nullを不存在／成功へ補完しない。
 * @boundary VCから既存上位記録への搬送。
 * @security この結果は採用許可ではない。
 * @compatibility Git Object即時消去は保証しない。
 */
export type WorkspaceCandidateResult = Readonly<{
  status: "completed" | "blocked";
  reason: string;
  candidateRef: string | null;
  candidateCommit: string | null;
  mergeCommit: string | null;
  effectIssued: boolean;
  cleanupConfirmed: boolean;
  temporary: WorkspaceCandidateTemporary | null;
  changedPaths: readonly string[];
}>;

/**
 * 登録・実体・Refを独立観測した値。
 * @responsibility 不存在と観測不能を混同せず、部分状態を表す。
 * @trace ARCH-000009
 * @shape 登録、実体、専用Branch、変更とlock。
 * @invariant branchHeadのnullは専用Ref不存在、headのnullは登録HEADなし、dirtyのnullは状態未取得。観測不能時は結果全体のobservationがnull。
 * @boundary Git／Filesystemの観測結果。
 * @security PathとBranchは固定相対値のみ。
 * @compatibility 上位Task保存Schemaではない。
 */
export type RepositoryWorktreeObservation = Readonly<{
  registered: boolean;
  directoryPresent: boolean;
  branchHead: string | null;
  head: string | null;
  locked: boolean;
  prunable: boolean;
  dirty: boolean | null;
}>;

/**
 * 人間が確認したファイル全体又は明示削除を表す。
 * @responsibility 欠測と削除、内容とmodeを区別する。
 * @trace ARCH-000009
 * @shape Repository相対Path、変換前bytesのGit Blob ID、mode。
 * @invariant 部分行・Directory・glob選択は扱わない。
 * @boundary 明示固定入力。blobIdとmodeが共にnullの場合だけ削除。
 * @security 内容確認値は採用Authorityではない。
 * @compatibility Git標準Object Formatに従う。
 */
export type WorkspaceCandidateSelection = Readonly<{
  path: string;
  blobId: string | null;
  mode: "100644" | "100755" | null;
}>;

/**
 * 自己生成した短命indexの未回収参照を表す。
 * @responsibility 再入場で別の一時物を清掃済みと誤認しない。
 * @trace ARCH-000009
 * @shape 限定相対PathとDirectory実体の照合Hash。
 * @invariant 参照だけを削除許可にしない。
 * @boundary 既存候補結果のみ。
 * @security 親・実体・内容を処置直前に再確認する。
 * @compatibility 新形式のみ。
 */
export type WorkspaceCandidateTemporary = Readonly<{
  relativePath: string;
  identity: string | null;
}>;
