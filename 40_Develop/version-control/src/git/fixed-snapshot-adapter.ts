/**
 * fixed-snapshot-adapterに属する責務をまとめる。
 *
 * @responsibility inspectを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000002
 */
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
  /**
   * fixed-snapshot-adapterを観測する。
   *
   * @responsibility fixed-snapshot-adapterの観測対象、取得根拠、観測不能結果の境界を所有する。
   * @trace ARCH-000002
   * @input repositoryRoot、revision
   * @returns inspectの計算結果を返す。
   * @precondition 「repositoryRoot、revision」がinspectの入力契約を満たす。
   * @postcondition inspectの責務を完了した結果だけを返す。
   * @effect N/A: inspectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: inspectは独自の失敗分岐を所有しない。
   * @invariant inspectは入力から導いた結果以外の共有状態を変更しない。
   * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
   * @security N/A: inspectはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: inspectは共有非同期状態を持たない同期処理である。
   */
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
  /**
   * Fileを読み取る。
   *
   * @responsibility Fileの読取り元、上限、読取不能時の結果境界を所有する。
   * @trace ARCH-000002
   * @input repositoryRoot、revision、relativePath
   * @returns readFileの計算結果を返す。
   * @precondition 「repositoryRoot、revision、relativePath」がreadFileの入力契約を満たす。
   * @postcondition readFileの責務を完了した結果だけを返す。
   * @effect N/A: readFileは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: readFileは独自の失敗分岐を所有しない。
   * @invariant readFileは入力から導いた結果以外の共有状態を変更しない。
   * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
   * @security N/A: readFileはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: readFileは共有非同期状態を持たない同期処理である。
   */
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
  /**
   * fixed-snapshot-adapterをFilesystem上の候補として具体化する。
   *
   * @responsibility fixed-snapshot-adapterの入力Snapshot、書込み範囲、部分生成の失敗境界を所有する。
   * @trace ARCH-000002
   * @input repositoryRoot、revision、workspace、readPaths、contentPolicy
   * @returns materializeの計算結果を返す。
   * @precondition 「repositoryRoot、revision、workspace、readPaths、contentPolicy」がmaterializeの入力契約を満たす。
   * @postcondition materializeの責務を完了した結果だけを返す。
   * @effect N/A: materializeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: materializeは独自の失敗分岐を所有しない。
   * @invariant materializeは入力から導いた結果以外の共有状態を変更しない。
   * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
   * @security N/A: materializeはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: materializeは共有非同期状態を持たない同期処理である。
   */
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

/**
 * Repository Fixed Snapshotを観測する。
 *
 * @responsibility Repository Fixed Snapshotの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000002
 * @input capability: VerifiedRepositoryRoot、revision: string
 * @returns inspectRepositoryFixedSnapshotの計算結果を返す。
 * @precondition 「capability: VerifiedRepositoryRoot、revision: string」がinspectRepositoryFixedSnapshotの入力契約を満たす。
 * @postcondition inspectRepositoryFixedSnapshotの責務を完了した結果だけを返す。
 * @effect N/A: inspectRepositoryFixedSnapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRepositoryFixedSnapshotは独自の失敗分岐を所有しない。
 * @invariant inspectRepositoryFixedSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security inspectRepositoryFixedSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRepositoryFixedSnapshotは共有非同期状態を持たない同期処理である。
 */
export function inspectRepositoryFixedSnapshot(
  capability: VerifiedRepositoryRoot,
  revision: string,
) {
  return inspectFixedSnapshot(capability, revision, gitFixedSnapshotAdapter);
}
