/**
 * Gitの完成した技術操作を提供する公開境界。
 * @packageDocumentation
 * @responsibility Git Repository、Worktree、Working Directory、Commit、Reference、Remoteの技術操作を提供する。
 * @trace ARCH-000002
 * @boundary Git実装とCRDD Domain利用側の境界。
 * @effect 明示操作ではローカル除外・出力先・Worktree／Branch・共有Git情報を更新し、確認済みの通常PushでRemoteへ送信し得る。
 */

export { stagePaths, unstagePaths } from "./repository/working-directory.ts";
export { commitChanges, createCommit } from "./repository/commit.ts";
export { createReference, removeReference } from "./repository/reference.ts";
export {
  readRemoteTarget,
  pushRepositoryRevision,
} from "./repository/remote.ts";
export type {
  PathsRequest,
  ChangesCommitRequest,
  RepositoryPushRequest,
  ReferenceCreateRequest,
  ReferenceRemoveRequest,
  ReferenceResult,
  Repository,
  RepositoryResult,
  CommitFileReadRequest,
  CommitFile,
  CommitFilesCopyRequest,
  CommitFilesCopyResult,
  CommitCreateRequest,
  CommitCreateResult,
  CommitMergeRequest,
  CommitMergeResult,
  FileReadRequest,
  WorkingFile,
  CommitDiffRequest,
  CommitDiff,
  CommitSelection,
  CommitTemporary,
  ChangesResult,
  RemoteTarget,
  WorkingChanges,
  TreePage,
  FileDiff,
} from "./repository/types.ts";

export { readRepositorySnapshot } from "./repository/revision.ts";
export {
  readRepositorySubmodules,
  readRepositoryEntries,
} from "./repository/discovery.ts";
export {
  createWorktree,
  getWorktree,
  removeWorktree,
} from "./worktree/crud.ts";
export type {
  WorktreeTarget,
  WorktreeResult,
  WorktreeCreateRequest,
  WorktreeRemoveRequest,
} from "./worktree/types.ts";
export { readWorkingChanges } from "./repository/working-directory.ts";
export { registerRepositoryLocalIgnore } from "./repository/ignore.ts";
export {
  resolveVerifiedRepositoryRoot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  getRepository,
  getRepositoryFromWorkingDirectory,
} from "./repository/location.ts";
export {
  readRepositoryFormat,
  readRepositoryRevision,
  readRepositoryStorageIdentity,
} from "./repository/revision.ts";
export {
  readFile,
  readTree,
  readCommitFile,
  copyCommitFiles,
} from "./repository/files.ts";
export { readFileDiff, readCommitDiff } from "./repository/changes.ts";

export { mergeCommit } from "./repository/merge.ts";
export type {
  FixedRevisionIdentity,
  RepositoryRevisionObservation,
} from "./repository/revision.ts";
export { readGitUser } from "./repository/user.ts";
export type { GitUserResult } from "./repository/types.ts";
