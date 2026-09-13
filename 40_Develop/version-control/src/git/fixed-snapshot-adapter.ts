import {
  type FixedSnapshotAdapter,
  inspectFixedSnapshot,
} from "../fixed-snapshot.ts";
import type { VerifiedRepositoryRoot } from "../repository-location.ts";
import {
  inspectGitCommitTreeCandidate,
  materializeGitCommitTreeCandidate,
  materializeGitReleaseCandidateTree,
  readGitCommitFileCandidate,
} from "./object-reader.ts";
import { resolveRepositoryGitLayout } from "./repository-layout.ts";

export const gitFixedSnapshotAdapter: FixedSnapshotAdapter = Object.freeze({
  inspect(repositoryRoot, revision) {
    const layout = resolveRepositoryGitLayout(repositoryRoot);
    const result = inspectGitCommitTreeCandidate({
      commonDirectory: layout.commonDirectory.realPath,
      revision,
    });
    return result?.status === "candidate"
      ? Object.freeze({
          contract: "crdd-version-control/fixed-snapshot/v1" as const,
          contractRevision: 1 as const,
          status: "observed" as const,
          revisionIdentity: result.commit,
          snapshotIdentity: result.tree,
          objectFormat: "sha1" as const,
          observationComplete: true as const,
          repositoryPathReported: false as const,
        })
      : null;
  },
  readFile(repositoryRoot, revision, relativePath) {
    const layout = resolveRepositoryGitLayout(repositoryRoot);
    const result = readGitCommitFileCandidate({
      commonDirectory: layout.commonDirectory.realPath,
      revision,
      relativePath,
    });
    return result?.status === "read"
      ? Object.freeze({
          status: "read" as const,
          revisionIdentity: result.revision,
          relativePath: result.relativePath,
          mode: result.mode,
          bytes: result.bytes,
          sha256: result.sha256,
          repositoryPathReported: false as const,
        })
      : null;
  },
  materialize(repositoryRoot, revision, workspace, readPaths, contentPolicy) {
    const layout = resolveRepositoryGitLayout(repositoryRoot);
    const input = {
      commonDirectory: layout.commonDirectory.realPath,
      revision,
      workspace,
      ...(readPaths === null ? {} : { readPaths }),
    };
    const result =
      contentPolicy === null
        ? materializeGitReleaseCandidateTree(input)
        : materializeGitCommitTreeCandidate(input, contentPolicy);
    if (result?.status === "blocked")
      return Object.freeze({
        status: "blocked" as const,
        reason: "fixed_snapshot_content_policy_rejected" as const,
        effectIssued: false,
        effectStateUnknown: false,
        cleanupConfirmed: true,
        repositoryPathReported: false as const,
        workspacePathReported: false as const,
      });
    return result?.status === "materialized"
      ? Object.freeze({
          status: "materialized" as const,
          baseRevisionIdentity: result.baseCommit,
          baseSnapshotIdentity: result.baseTree,
          fileCount: result.fileCount,
          byteLength: result.byteLength,
          contentManifestHash: result.contentManifestHash,
          repositoryPathReported: false as const,
          workspacePathReported: false as const,
        })
      : null;
  },
});

export function inspectRepositoryFixedSnapshot(
  capability: VerifiedRepositoryRoot,
  revision: string,
) {
  return inspectFixedSnapshot(capability, revision, gitFixedSnapshotAdapter);
}
