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
} from "../../../version-control/src/index.ts";
import type { RepositoryObservationPort } from "./types.ts";
import { createFilesystemRepositoryObservationPortFromRootBinding } from "./filesystem-observer.ts";

/**
 * Filesystem Repository Observation Portを構築する。
 *
 * @responsibility Filesystem Repository Observation Portの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000009
 * @input capability: VerifiedRepositoryRoot、任意の正のsafe integer maximumFileBytes。
 * @returns RepositoryObservationPortを返す。
 * @precondition 「capability: VerifiedRepositoryRoot」がcreateFilesystemRepositoryObservationPortの入力契約を満たす。
 * @postcondition createFilesystemRepositoryObservationPortの責務を完了した結果だけを返す。
 * @effect 検証済みRootを現在解決する。返却操作のFile読取りは呼出し時に行い、保存はしない。
 * @failure 不正な容量上限はRoot観測前に例外で拒否する。無効Capabilityは観測不能。
 * @invariant createFilesystemRepositoryObservationPortは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createFilesystemRepositoryObservationPortはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createFilesystemRepositoryObservationPortは共有非同期状態を持たない同期処理である。
 */
export function createFilesystemRepositoryObservationPort(
  capability: VerifiedRepositoryRoot,
  maximumFileBytes?: number,
): RepositoryObservationPort {
  if (
    maximumFileBytes !== undefined &&
    (!Number.isSafeInteger(maximumFileBytes) || maximumFileBytes <= 0)
  )
    throw new Error("repository_file_limit_invalid");
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
  return createFilesystemRepositoryObservationPortFromRootBinding(
    {
      absolutePath: root,
      canonicalPath: root,
      pathFlavor: path.sep === "\\" ? "win32" : "posix",
    },
    maximumFileBytes,
  );
}
