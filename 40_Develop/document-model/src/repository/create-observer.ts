/**
 * 呼出し側が指定したDirectoryから読取り観測操作を構築する。
 * @packageDocumentation
 * @responsibility 物理的なRootを確認し、不正なPathを観測不能の結果へ処置する。
 * @trace ARCH-000008
 * @boundary Repository Rootと読取り利用側の境界。
 */
import path from "node:path";
import fs from "node:fs";
import { createFilesystemRepositoryObservationPortFromRootBinding } from "./filesystem-observer.ts";
import type { RepositoryObservationPort } from "./types.ts";

/** 呼出し側が選択した絶対Directoryの実体を観測する。 @trace ARCH-000009 */
export function observeDocumentRoot(
  root: string | null,
): fs.BigIntStats | null {
  if (
    typeof root !== "string" ||
    !path.isAbsolute(root) ||
    path.resolve(root) !== root ||
    /[\u0000-\u001f\u007f]/u.test(root)
  )
    return null;
  try {
    const observed = fs.lstatSync(root, { bigint: true });
    return observed.isDirectory() &&
      !observed.isSymbolicLink() &&
      fs.realpathSync.native(root) === root
      ? observed
      : null;
  } catch {
    return null;
  }
}

/**
 * Filesystem Repository Observation Portを構築する。
 *
 * @responsibility Filesystem Repository Observation Portの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000009
 * @input root: 呼出し側が確定した絶対Directory。
 * @returns RepositoryObservationPortを返す。
 * @precondition 読取り対象の選択は呼出し側が行う。
 * @postcondition createFilesystemRepositoryObservationPortの責務を完了した結果だけを返す。
 * @effect 検証済みRootを現在解決する。返却操作のFile読取りは呼出し時に行い、保存はしない。
 * @failure 不正・観測不能なRootは観測不能。
 * @invariant createFilesystemRepositoryObservationPortは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createFilesystemRepositoryObservationPortはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createFilesystemRepositoryObservationPortは共有非同期状態を持たない同期処理である。
 */
export function createFilesystemRepositoryObservationPort(
  root: string | null,
): RepositoryObservationPort {
  if (typeof root !== "string" || !observeDocumentRoot(root))
    return {
      observeFile: (repositoryRelativePath) => ({
        status: "unobservable",
        repositoryRelativePath,
        reason: "document root directory is unavailable",
      }),
      observeDirectory: (repositoryRelativePath) => ({
        status: "unobservable",
        repositoryRelativePath,
        reason: "document root directory is unavailable",
      }),
    };
  return createFilesystemRepositoryObservationPortFromRootBinding({
    absolutePath: root,
    canonicalPath: root,
    pathFlavor: path.sep === "\\" ? "win32" : "posix",
  });
}
