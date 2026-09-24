/**
 * Version Control機能を差し替え可能にする公開境界。
 * @packageDocumentation
 * @responsibility Revision Identity、Snapshot、Repository観測をAdapter経由で提供する。
 * @trace ARCH-000002
 * @boundary Git実装とCRDD Domain利用側の境界。
 * @effect 明示された操作ではRepository-local ignore設定を更新し得る。
 */
export {
  FIXED_REVISION_IDENTITY_CONTRACT,
  FIXED_REVISION_IDENTITY_CONTRACT_REVISION,
  type FixedRevisionIdentity,
  type FixedRevisionIdentityAdapter,
  observeFixedRevisionIdentity,
} from "./fixed-revision.ts";
export {
  type CandidateOutputCapability,
  type CandidateMaterialization,
  type CandidateMaterializationBlocked,
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
} from "./fixed-snapshot.ts";
export {
  gitFixedRevisionIdentityAdapter,
  gitRepositoryFormatAdapter,
  gitRepositoryRevisionAdapter,
} from "./git/fixed-revision-adapter.ts";
export {
  gitFixedSnapshotAdapter,
  inspectRepositoryFixedSnapshot,
} from "./git/fixed-snapshot-adapter.ts";
export { gitLocalChangeSetAdapter } from "./git/local-change-set-adapter.ts";
export {
  inspectMigrationSystemClosure,
  type MigrationConsumerObservation,
} from "./migration-closure.ts";
export {
  observeDeclaredNestedRepositoryPaths,
  observeNestedRepository,
  observeRepositoryEntries,
  readFixedSnapshotText,
  type RepositoryEntryObservation,
  resolveRevisionIdentity,
} from "./git/checker-repository-observation-adapter.ts";
export {
  describeGitRepositoryLayoutAdapterContract,
  GIT_REPOSITORY_LAYOUT_ADAPTER_CONTRACT,
  GIT_REPOSITORY_LAYOUT_ADAPTER_CONTRACT_REVISION,
  inspectGitRepositoryLayoutCandidate,
} from "./git/repository-layout-adapter.ts";
export { gitRepositoryLocalIgnoreAdapter } from "./git/repository-local-ignore-adapter.ts";
export {
  changedPaths,
  LOCAL_CHANGE_SET_CONTRACT,
  LOCAL_CHANGE_SET_CONTRACT_REVISION,
  type LocalChangeSet,
  type LocalChangeSetAdapter,
  type LocalChangeSetObservation,
  observeLocalChangeSet,
} from "./local-change-set.ts";
export {
  REPOSITORY_LOCAL_IGNORE_CONTRACT,
  REPOSITORY_LOCAL_IGNORE_CONTRACT_REVISION,
  type RepositoryLocalIgnoreAdapter,
  type RepositoryLocalIgnoreAdapterResult,
  registerRepositoryLocalIgnore,
} from "./repository-local-ignore.ts";
export {
  describeRepositoryLocationContract,
  REPOSITORY_LOCATION_CONTRACT,
  REPOSITORY_LOCATION_CONTRACT_REVISION,
  resolveVerifiedRepositoryRoot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  type VerifiedRepositoryRoot,
  verifyRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
} from "./repository-location.ts";
export {
  inspectRepositoryFormat,
  observeRepositoryRevision,
  type RepositoryFormatAdapter,
  type RepositoryRevisionAdapter,
  type RepositoryRevisionObservation,
} from "./repository-revision.ts";
