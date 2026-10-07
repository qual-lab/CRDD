/**
 * 検証済みRepository Capabilityから読取り観測操作を構築する。
 * @packageDocumentation
 * @responsibility 検証済みRootを解決し、無効Capabilityを観測不能の結果へ処置する。
 * @trace ARCH-000008
 * @boundary Repository Rootと読取り利用側の境界。
 */
import path from "node:path";
import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/repository-identity/index.ts";
import type { RepositoryObservationPort } from "./types.ts";
import { createFilesystemRepositoryObservationPortFromRootBinding } from "./filesystem-repository-observer.ts";

/**
 * Filesystem Repository Observation Portを構築する。
 *
 * @responsibility Filesystem Repository Observation Portの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000009
 * @input capability: VerifiedRepositoryRoot
 * @returns RepositoryObservationPortを返す。
 * @precondition 「capability: VerifiedRepositoryRoot」がcreateFilesystemRepositoryObservationPortの入力契約を満たす。
 * @postcondition createFilesystemRepositoryObservationPortの責務を完了した結果だけを返す。
 * @effect N/A: createFilesystemRepositoryObservationPortは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createFilesystemRepositoryObservationPortは独自の失敗分岐を所有しない。
 * @invariant createFilesystemRepositoryObservationPortは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createFilesystemRepositoryObservationPortはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createFilesystemRepositoryObservationPortは共有非同期状態を持たない同期処理である。
 */
export function createFilesystemRepositoryObservationPort(
  capability: VerifiedRepositoryRoot,
): RepositoryObservationPort {
  const root = resolveVerifiedRepositoryRoot(capability);
  if (root === null)
    return {
      observeFile: (repositoryRelativePath) => ({
        status: "unobservable",
        repositoryRelativePath,
        reason: "verified repository root capability is unavailable",
      }),
      observeDirectory: (repositoryRelativePath) => ({
        status: "unobservable",
        repositoryRelativePath,
        reason: "verified repository root capability is unavailable",
      }),
    };
  return createFilesystemRepositoryObservationPortFromRootBinding({
    absolutePath: root,
    canonicalPath: root,
    pathFlavor: path.sep === "\\" ? "win32" : "posix",
  });
}
