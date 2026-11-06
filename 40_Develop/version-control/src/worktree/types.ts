/**
 * Git Worktreeの要求・独立した実体観測と部分結果。
 * @responsibility 業務IDや保存状態を持たず技術対象だけを定義する。
 * @trace ARCH-000009
 */
export type WorktreeTarget = Readonly<{ relativePath: string; branch: string }>;
/** Worktree登録・実Directory・BranchとHEAD・Lock・dirtyの個別観測。 */
export type WorktreeObservation = Readonly<{
  registered: boolean;
  directoryPresent: boolean;
  branchHead: string | null;
  head: string | null;
  locked: boolean;
  prunable: boolean;
  dirty: boolean | null;
}>;
/** Worktree操作の発行有無、部分削除、実体観測と停止理由。 */
export type WorktreeResult = Readonly<{
  status: "completed" | "blocked";
  reason: string;
  relativePath: string | null;
  branch: string | null;
  expectedCommit: string | null;
  effectIssued: boolean;
  worktreeRemoved: boolean | null;
  branchRemoved: boolean | null;
  parentDirectoryRetained: boolean | null;
  observation: WorktreeObservation | null;
}>;
/** 生成対象のWorktreeと開始Commitを指定する。 */
export type WorktreeCreateRequest = WorktreeTarget &
  Readonly<{ baseCommit: string }>;
/** 削除対象の期待HEADと変更破棄の明示条件を指定する。 */
export type WorktreeRemoveRequest = WorktreeTarget &
  Readonly<{ expectedHead: string; discardChanges?: boolean }>;

/** 対象WorktreeのGit管理領域と、そのHEAD・Indexへの内部接続。 */
export type WorktreeGitContext = {
  root: string;
  owner: string;
  target: string;
  relativePath: string;
  branch: string;
  run: (
    at: string,
    args: readonly string[],
    options?: { indexFile?: string; input?: string | Buffer },
  ) => { status: number | null; stdout: string; stderr: string };
  inspect: () => WorktreeObservation;
};
