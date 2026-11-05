/**
 * Worktreeと固定候補の技術的な要求・観測・結果を定義する。
 * @responsibility Git操作境界の値契約。保存・採用判断は所有しない。
 * @trace ARCH-000009
 */

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
