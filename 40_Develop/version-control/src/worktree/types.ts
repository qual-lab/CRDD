/**
 * Git Worktreeの要求・独立した実体観測と部分結果。
 * @responsibility 業務IDや保存状態を持たず技術対象だけを定義する。
 * @trace ARCH-000009
 */
export type WorktreeTarget = Readonly<{ relativePath: string; branch: string }>;
export type WorktreeObservation = Readonly<{
  registered: boolean;
  directoryPresent: boolean;
  branchHead: string | null;
  head: string | null;
  locked: boolean;
  prunable: boolean;
  dirty: boolean | null;
}>;
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
export type WorktreeCreateRequest = WorktreeTarget &
  Readonly<{ baseCommit: string }>;
export type WorktreeRemoveRequest = WorktreeTarget &
  Readonly<{ expectedHead: string; discardChanges?: boolean }>;

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
