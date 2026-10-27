/**
 * Version Control機能を差し替え可能にする公開境界。
 * @packageDocumentation
 * @responsibility Repository観測、固定Snapshot、専用Worktree・Candidate・Mergeと通常変更公開を提供する。
 * @trace ARCH-000002
 * @boundary Git実装とCRDD Domain利用側の境界。
 * @effect 明示操作ではローカル除外・出力先・Worktree／Branch・共有Git情報を更新し、確認済みの通常PushでRemoteへ送信し得る。
 */

export {
  type ChangePublicationAdapter,
  type ChangePublicationRequest,
  type ChangePublicationResult,
  type ChangePublicationTargetObservation,
  type ChangePublicationTargetObservationAdapter,
  executeChangePublication,
  observeChangePublicationTarget,
} from "./publication/change.ts";
export {
  FIXED_REVISION_IDENTITY_CONTRACT,
  FIXED_REVISION_IDENTITY_CONTRACT_REVISION,
  type FixedRevisionIdentity,
  type FixedRevisionIdentityAdapter,
  observeFixedRevisionIdentity,
  inspectRepositoryRevisionCandidate,
  inspectRepositoryIdentityCandidate,
} from "./repository/revision.ts";
export {
  type CandidateMaterialization,
  type CandidateMaterializationBlocked,
  type CandidateOutputCapability,
  FIXED_SNAPSHOT_CONTRACT,
  FIXED_SNAPSHOT_CONTRACT_REVISION,
  type FixedSnapshotAdapter,
  type FixedSnapshotContentPolicy,
  type FixedSnapshotFile,
  type FixedSnapshotIdentity,
  inspectFixedSnapshot,
  materializeFixedSnapshotCandidate,
  readFixedSnapshotFile,
  verifyCandidateOutputDirectory,
} from "./repository/snapshot.ts";
export {
  type ChangePublicationCommandRunner,
  createGitChangePublicationAdapter,
  createGitChangePublicationTargetObservationAdapter,
  gitChangePublicationAdapter,
  gitChangePublicationTargetObservationAdapter,
} from "./publication/git.ts";
export {
  observeDeclaredNestedRepositoryPaths,
  observeNestedRepository,
  observeRepositoryEntries,
  type RepositoryEntryObservation,
  readFixedSnapshotText,
  resolveRevisionIdentity,
} from "./git/observation.ts";
export {
  gitFixedSnapshotAdapter,
  inspectRepositoryFixedSnapshot,
} from "./repository/snapshot.ts";
export {
  describeGitRepositoryLayoutAdapterContract,
  GIT_REPOSITORY_LAYOUT_ADAPTER_CONTRACT,
  GIT_REPOSITORY_LAYOUT_ADAPTER_CONTRACT_REVISION,
  inspectGitRepositoryLayoutCandidate,
} from "./repository/layout.ts";
export { gitLocalChangeSetAdapter } from "./repository/changes.ts";
export { gitRepositoryLocalIgnoreAdapter } from "./repository/ignore.ts";
export {
  gitFixedRevisionIdentityAdapter,
  gitRepositoryFormatAdapter,
  gitRepositoryRevisionAdapter,
} from "./repository/revision.ts";
export {
  freezeWorkspaceCandidate,
  inspectWorkspaceFile,
  inspectWorkspaceCandidatePatch,
  removeWorkspaceCandidate,
} from "./workspace/candidate.ts";
export {
  validWorkspaceDisplayName,
  validWorkspaceCandidateRequest,
  type WorkspaceCandidateRequest,
  type WorkspaceCandidateResult,
  type WorkspaceCandidateSelection,
  type WorkspaceCandidateTemporary,
} from "../../domain-model/src/index.ts";
export {
  createRepositoryWorktree,
  disposeRepositoryWorktree,
  observeRepositoryWorktree,
} from "./workspace/worktree.ts";
export type {
  RepositoryWorktreeObservation,
  RepositoryWorktreeResult,
} from "../../domain-model/src/index.ts";
export { gitRepositoryWorktreeViewAdapter } from "./repository/worktree-view.ts";
export {
  changedPaths,
  LOCAL_CHANGE_SET_CONTRACT,
  LOCAL_CHANGE_SET_CONTRACT_REVISION,
  type LocalChangeSet,
  type LocalChangeSetAdapter,
  type LocalChangeSetObservation,
  observeLocalChangeSet,
} from "./repository/changes.ts";
export {
  REPOSITORY_LOCAL_IGNORE_CONTRACT,
  REPOSITORY_LOCAL_IGNORE_CONTRACT_REVISION,
  type RepositoryLocalIgnoreAdapter,
  type RepositoryLocalIgnoreAdapterResult,
  registerRepositoryLocalIgnore,
} from "./repository/ignore.ts";
export {
  describeRepositoryLocationContract,
  REPOSITORY_LOCATION_CONTRACT,
  REPOSITORY_LOCATION_CONTRACT_REVISION,
  resolveVerifiedRepositoryRoot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  type VerifiedRepositoryRoot,
  verifyRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
} from "./repository/location.ts";
export {
  inspectRepositoryFormat,
  observeRepositoryRevision,
  observeRepositoryStorageIdentity,
  type RepositoryFormatAdapter,
  type RepositoryRevisionAdapter,
  type RepositoryRevisionObservation,
} from "./repository/revision.ts";
export {
  observeRepositoryWorktreeFileDiff,
  observeRepositoryWorktreeTree,
  type RepositoryWorktreeEntry,
  type RepositoryWorktreeFileDiff,
  type RepositoryWorktreeTreePage,
  type RepositoryWorktreeViewAdapter,
  type RepositoryWorktreeViewObservation,
} from "./repository/worktree-view.ts";

export { mergeWorkspaceCandidate } from "./workspace/merge.ts";
export {
  inspectWorkspaceInventory,
  readWorkspaceFileContent,
  isWorkspaceRelativePath,
  type WorkspaceInventoryEntry,
} from "./workspace/observation.ts";
