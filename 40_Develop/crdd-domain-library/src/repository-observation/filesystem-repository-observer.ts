/**
 * filesystem-repository-observerに属する責務をまとめる。
 *
 * @responsibility FilesystemObservationOperationsを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import fs from "node:fs";
import path from "node:path";

import type {
  RepositoryDirectoryObservation,
  RepositoryFileObservation,
  RepositoryObservationPort,
} from "./index.ts";

/**
 * filesystem-repository-observerで使用するFilesystem Observation Operationsの値契約を定義する。
 *
 * @responsibility Filesystem Observation OperationsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape FilesystemObservationOperationsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FilesystemObservationOperationsで宣言した値と責務の対応を維持する。
 * @boundary N/A: FilesystemObservationOperationsの宣言は外部境界を開かない。
 * @security N/A: FilesystemObservationOperationsはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility FilesystemObservationOperationsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type FilesystemObservationOperations = Readonly<{
  lstat: (targetPath: string) => fs.Stats;
  stat: (targetPath: string) => fs.Stats;
  realpath: (targetPath: string) => string;
  readdir: (targetPath: string) => readonly fs.Dirent[];
  open: (targetPath: string) => number;
  openedPath: (descriptor: number, requestedPath: string) => string | null;
  fstat: (descriptor: number) => fs.Stats;
  read: (descriptor: number) => string;
  close: (descriptor: number) => void;
}>;

/**
 * filesystem-repository-observerで使用するRepository Root Bindingの値契約を定義する。
 *
 * @responsibility Repository Root BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RepositoryRootBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryRootBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryRootBindingの宣言は外部境界を開かない。
 * @security N/A: RepositoryRootBindingはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryRootBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryRootBinding = Readonly<{
  absolutePath: string;
  canonicalPath: string;
  pathFlavor: "win32" | "posix";
}>;

const noFollow = "O_NOFOLLOW" in fs.constants ? fs.constants.O_NOFOLLOW : 0;
const defaultOperations: FilesystemObservationOperations = {
  lstat: (targetPath) => fs.lstatSync(targetPath),
  stat: (targetPath) => fs.statSync(targetPath),
  realpath: (targetPath) => fs.realpathSync.native(targetPath),
  readdir: (targetPath) => fs.readdirSync(targetPath, { withFileTypes: true }),
  open: (targetPath) =>
    fs.openSync(targetPath, fs.constants.O_RDONLY | noFollow),
  openedPath: (descriptor, requestedPath) => {
    try {
      if (process.platform === "win32") {
        const canonicalRequestedPath = fs.realpathSync.native(requestedPath);
        const openedIdentity = fs.fstatSync(descriptor);
        const requestedIdentity = fs.statSync(canonicalRequestedPath);
        return sameFileIdentity(openedIdentity, requestedIdentity)
          ? canonicalRequestedPath
          : null;
      }
      if (process.platform !== "linux") return null;
      return fs.realpathSync.native(`/proc/self/fd/${descriptor}`);
    } catch {
      return null;
    }
  },
  fstat: (descriptor) => fs.fstatSync(descriptor),
  read: (descriptor) => fs.readFileSync(descriptor, "utf8"),
  close: (descriptor) => fs.closeSync(descriptor),
};

/**
 * Fully Qualified Pathかを判定する。
 *
 * @responsibility Fully Qualified Pathの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input candidate: string、flavor: RepositoryRootBinding["pathFlavor"]
 * @returns booleanを返す。
 * @precondition 「candidate: string、flavor: RepositoryRootBinding["pathFlavor"]」がisFullyQualifiedPathの入力契約を満たす。
 * @postcondition isFullyQualifiedPathの責務を完了した結果だけを返す。
 * @effect N/A: isFullyQualifiedPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isFullyQualifiedPathは独自の失敗分岐を所有しない。
 * @invariant isFullyQualifiedPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: isFullyQualifiedPathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isFullyQualifiedPathは共有非同期状態を持たない同期処理である。
 */
function isFullyQualifiedPath(
  candidate: string,
  flavor: RepositoryRootBinding["pathFlavor"],
): boolean {
  if (flavor === "posix")
    return candidate.startsWith("/") && !candidate.startsWith("//");
  if (candidate.startsWith("\\\\?\\") || candidate.startsWith("\\\\.\\"))
    return false;
  const root = path.win32.parse(candidate).root.replaceAll("/", "\\");
  return /^[A-Za-z]:\\$/u.test(root) || /^\\\\[^\\]+\\[^\\]+\\$/u.test(root);
}

/**
 * Pathが同一かを判定する。
 *
 * @responsibility Pathの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000008
 * @input left: string、right: string
 * @returns booleanを返す。
 * @precondition 「left: string、right: string」がsamePathの入力契約を満たす。
 * @postcondition samePathの責務を完了した結果だけを返す。
 * @effect N/A: samePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: samePathは独自の失敗分岐を所有しない。
 * @invariant samePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: samePathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: samePathは共有非同期状態を持たない同期処理である。
 */
function samePath(left: string, right: string): boolean {
  const isWindowsStyle =
    /^[A-Za-z]:[\\/]/u.test(left) || left.startsWith("\\\\");
  return isWindowsStyle
    ? path.win32.normalize(left).toLowerCase() ===
        path.win32.normalize(right).toLowerCase()
    : path.posix.normalize(left) === path.posix.normalize(right);
}

/**
 * Relative Pathの契約を検証する。
 *
 * @responsibility Relative Pathの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input relativePath: string
 * @returns readonly string[] | nullを返す。
 * @precondition 「relativePath: string」がvalidateRelativePathの入力契約を満たす。
 * @postcondition validateRelativePathの責務を完了した結果だけを返す。
 * @effect N/A: validateRelativePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateRelativePathは独自の失敗分岐を所有しない。
 * @invariant validateRelativePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: validateRelativePathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validateRelativePathは共有非同期状態を持たない同期処理である。
 */
function validateRelativePath(relativePath: string): readonly string[] | null {
  if (
    relativePath.length === 0 ||
    relativePath.includes("\\") ||
    path.posix.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath) ||
    /^[A-Za-z]:/u.test(relativePath)
  )
    return null;
  const segments = relativePath.split("/");
  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== "..",
  )
    ? segments
    : null;
}

/**
 * Containedかを判定する。
 *
 * @responsibility Containedの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input root: string、target: string
 * @returns booleanを返す。
 * @precondition 「root: string、target: string」がisContainedの入力契約を満たす。
 * @postcondition isContainedの責務を完了した結果だけを返す。
 * @effect N/A: isContainedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isContainedは独自の失敗分岐を所有しない。
 * @invariant isContainedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: isContainedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isContainedは共有非同期状態を持たない同期処理である。
 */
function isContained(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

/**
 * File Identityが同一かを判定する。
 *
 * @responsibility File Identityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000008
 * @input left: fs.Stats、right: fs.Stats
 * @returns booleanを返す。
 * @precondition 「left: fs.Stats、right: fs.Stats」がsameFileIdentityの入力契約を満たす。
 * @postcondition sameFileIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameFileIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameFileIdentityは独自の失敗分岐を所有しない。
 * @invariant sameFileIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: sameFileIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: sameFileIdentityは共有非同期状態を持たない同期処理である。
 */
function sameFileIdentity(left: fs.Stats, right: fs.Stats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs
  );
}

/**
 * directory Entry Kindを決定する。
 *
 * @responsibility directory Entry Kindの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input entry: fs.Dirent
 * @returns directoryEntryKindの計算結果を返す。
 * @precondition 「entry: fs.Dirent」がdirectoryEntryKindの入力契約を満たす。
 * @postcondition directoryEntryKindの責務を完了した結果だけを返す。
 * @effect N/A: directoryEntryKindは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: directoryEntryKindは独自の失敗分岐を所有しない。
 * @invariant directoryEntryKindは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: directoryEntryKindはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: directoryEntryKindは共有非同期状態を持たない同期処理である。
 */
function directoryEntryKind(entry: fs.Dirent) {
  if (entry.isSymbolicLink()) return "symbolic-link" as const;
  if (entry.isDirectory()) return "directory" as const;
  if (entry.isFile()) return "file" as const;
  return "other" as const;
}

/**
 * Fileを不正結果として構築する。
 *
 * @responsibility Fileの不正理由、公開Property、結果境界を所有する。
 * @trace ARCH-000008
 * @input pathValue: string、reason: string
 * @returns RepositoryFileObservationを返す。
 * @precondition 「pathValue: string、reason: string」がinvalidFileの入力契約を満たす。
 * @postcondition invalidFileの責務を完了した結果だけを返す。
 * @effect N/A: invalidFileは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: invalidFileは独自の失敗分岐を所有しない。
 * @invariant invalidFileは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: invalidFileはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: invalidFileは共有非同期状態を持たない同期処理である。
 */
function invalidFile(
  pathValue: string,
  reason: string,
): RepositoryFileObservation {
  return { status: "invalid", repositoryRelativePath: pathValue, reason };
}

/**
 * unobservable Fileを決定する。
 *
 * @responsibility unobservable Fileの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input pathValue: string、reason: string
 * @returns RepositoryFileObservationを返す。
 * @precondition 「pathValue: string、reason: string」がunobservableFileの入力契約を満たす。
 * @postcondition unobservableFileの責務を完了した結果だけを返す。
 * @effect N/A: unobservableFileは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: unobservableFileは独自の失敗分岐を所有しない。
 * @invariant unobservableFileは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: unobservableFileはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: unobservableFileは共有非同期状態を持たない同期処理である。
 */
function unobservableFile(
  pathValue: string,
  reason: string,
): RepositoryFileObservation {
  return { status: "unobservable", repositoryRelativePath: pathValue, reason };
}

/**
 * Directoryを不正結果として構築する。
 *
 * @responsibility Directoryの不正理由、公開Property、結果境界を所有する。
 * @trace ARCH-000008
 * @input pathValue: string、reason: string
 * @returns RepositoryDirectoryObservationを返す。
 * @precondition 「pathValue: string、reason: string」がinvalidDirectoryの入力契約を満たす。
 * @postcondition invalidDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: invalidDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: invalidDirectoryは独自の失敗分岐を所有しない。
 * @invariant invalidDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: invalidDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: invalidDirectoryは共有非同期状態を持たない同期処理である。
 */
function invalidDirectory(
  pathValue: string,
  reason: string,
): RepositoryDirectoryObservation {
  return { status: "invalid", repositoryRelativePath: pathValue, reason };
}

/**
 * unobservable Directoryを決定する。
 *
 * @responsibility unobservable Directoryの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input pathValue: string、reason: string
 * @returns RepositoryDirectoryObservationを返す。
 * @precondition 「pathValue: string、reason: string」がunobservableDirectoryの入力契約を満たす。
 * @postcondition unobservableDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: unobservableDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: unobservableDirectoryは独自の失敗分岐を所有しない。
 * @invariant unobservableDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: unobservableDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: unobservableDirectoryは共有非同期状態を持たない同期処理である。
 */
function unobservableDirectory(
  pathValue: string,
  reason: string,
): RepositoryDirectoryObservation {
  return { status: "unobservable", repositoryRelativePath: pathValue, reason };
}

/**
 * Filesystem Repository Observation Port With Operationsを構築する。
 *
 * @responsibility Filesystem Repository Observation Port With Operationsの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input rootBinding: RepositoryRootBinding、operations: FilesystemObservationOperations
 * @returns RepositoryObservationPortを返す。
 * @precondition 「rootBinding: RepositoryRootBinding、operations: FilesystemObservationOperations」がcreateFilesystemRepositoryObservationPortWithOperationsの入力契約を満たす。
 * @postcondition createFilesystemRepositoryObservationPortWithOperationsの責務を完了した結果だけを返す。
 * @effect N/A: createFilesystemRepositoryObservationPortWithOperationsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createFilesystemRepositoryObservationPortWithOperationsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createFilesystemRepositoryObservationPortWithOperationsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: createFilesystemRepositoryObservationPortWithOperationsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createFilesystemRepositoryObservationPortWithOperationsは共有非同期状態を持たない同期処理である。
 */
export function createFilesystemRepositoryObservationPortWithOperations(
  rootBinding: RepositoryRootBinding,
  operations: FilesystemObservationOperations,
): RepositoryObservationPort {
  let canonicalRoot: string | null = null;
  let rootFailure: Readonly<{
    status: "invalid" | "unobservable";
    reason: string;
  }> | null = null;
  if (
    !isFullyQualifiedPath(rootBinding.absolutePath, rootBinding.pathFlavor) ||
    !isFullyQualifiedPath(rootBinding.canonicalPath, rootBinding.pathFlavor)
  )
    rootFailure = {
      status: "invalid",
      reason: "repository root binding must use fully qualified paths",
    };
  else
    try {
      const rootMetadata = operations.lstat(rootBinding.absolutePath);
      if (rootMetadata.isSymbolicLink())
        rootFailure = {
          status: "invalid",
          reason: "repository root is a symbolic link or junction",
        };
      else if (!rootMetadata.isDirectory())
        rootFailure = {
          status: "invalid",
          reason: "repository root is not a directory",
        };
      else {
        const observedCanonicalRoot = operations.realpath(
          rootBinding.absolutePath,
        );
        if (!samePath(observedCanonicalRoot, rootBinding.canonicalPath))
          rootFailure = {
            status: "invalid",
            reason: "repository root binding does not match the observed root",
          };
        else canonicalRoot = observedCanonicalRoot;
      }
    } catch {
      rootFailure = {
        status: "unobservable",
        reason: "repository root could not be observed as one stable directory",
      };
    }

  /**
   * root 失敗 For Fileを決定する。
   *
   * @responsibility root 失敗 For Fileの導出に必要な入力、判定規則、返却結果の境界を所有する。
   * @trace ARCH-000008
   * @input pathValue: string
   * @returns RepositoryFileObservationを返す。
   * @precondition 「pathValue: string」がrootFailureForFileの入力契約を満たす。
   * @postcondition rootFailureForFileの責務を完了した結果だけを返す。
   * @effect N/A: rootFailureForFileは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: rootFailureForFileは独自の失敗分岐を所有しない。
   * @invariant rootFailureForFileは入力から導いた結果以外の共有状態を変更しない。
   * @boundary FilesystemとProcess内Domain処理の境界。
   * @security N/A: rootFailureForFileはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: rootFailureForFileは共有非同期状態を持たない同期処理である。
   */
  function rootFailureForFile(pathValue: string): RepositoryFileObservation {
    const failure = rootFailure ?? {
      status: "unobservable" as const,
      reason: "repository root identity is unavailable",
    };
    return failure.status === "invalid"
      ? invalidFile(pathValue, failure.reason)
      : unobservableFile(pathValue, failure.reason);
  }

  /**
   * root 失敗 For Directoryを決定する。
   *
   * @responsibility root 失敗 For Directoryの導出に必要な入力、判定規則、返却結果の境界を所有する。
   * @trace ARCH-000008
   * @input pathValue: string
   * @returns RepositoryDirectoryObservationを返す。
   * @precondition 「pathValue: string」がrootFailureForDirectoryの入力契約を満たす。
   * @postcondition rootFailureForDirectoryの責務を完了した結果だけを返す。
   * @effect N/A: rootFailureForDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: rootFailureForDirectoryは独自の失敗分岐を所有しない。
   * @invariant rootFailureForDirectoryは入力から導いた結果以外の共有状態を変更しない。
   * @boundary FilesystemとProcess内Domain処理の境界。
   * @security N/A: rootFailureForDirectoryはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: rootFailureForDirectoryは共有非同期状態を持たない同期処理である。
   */
  function rootFailureForDirectory(
    pathValue: string,
  ): RepositoryDirectoryObservation {
    const failure = rootFailure ?? {
      status: "unobservable" as const,
      reason: "repository root identity is unavailable",
    };
    return failure.status === "invalid"
      ? invalidDirectory(pathValue, failure.reason)
      : unobservableDirectory(pathValue, failure.reason);
  }

  /**
   * Pathを観測する。
   *
   * @responsibility Pathの観測対象、取得根拠、観測不能結果の境界を所有する。
   * @trace ARCH-000008
   * @input repositoryRelativePath: string、expectedKind: "file" | "directory"
   * @returns RepositoryFileObservation | RepositoryDirectoryObservationを返す。
   * @precondition 「repositoryRelativePath: string、expectedKind: "file" | "directory"」がobservePathの入力契約を満たす。
   * @postcondition observePathの責務を完了した結果だけを返す。
   * @effect N/A: observePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure observePathは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant observePathは入力から導いた結果以外の共有状態を変更しない。
   * @boundary FilesystemとProcess内Domain処理の境界。
   * @security N/A: observePathはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: observePathは共有非同期状態を持たない同期処理である。
   */
  function observePath(
    repositoryRelativePath: string,
    expectedKind: "file" | "directory",
  ): RepositoryFileObservation | RepositoryDirectoryObservation {
    const segments = validateRelativePath(repositoryRelativePath);
    if (!segments)
      return expectedKind === "file"
        ? invalidFile(
            repositoryRelativePath,
            "repository path must be one normalized relative path",
          )
        : invalidDirectory(
            repositoryRelativePath,
            "repository path must be one normalized relative path",
          );
    if (rootFailure || !canonicalRoot)
      return expectedKind === "file"
        ? rootFailureForFile(repositoryRelativePath)
        : rootFailureForDirectory(repositoryRelativePath);

    let currentPath = canonicalRoot;
    try {
      for (const [index, segment] of segments.entries()) {
        currentPath = path.join(currentPath, segment);
        const metadata = operations.lstat(currentPath);
        if (metadata.isSymbolicLink())
          return expectedKind === "file"
            ? invalidFile(
                repositoryRelativePath,
                "a symbolic link or junction is present in the path",
              )
            : invalidDirectory(
                repositoryRelativePath,
                "a symbolic link or junction is present in the path",
              );
        const isLast = index === segments.length - 1;
        if (!isLast && !metadata.isDirectory())
          return expectedKind === "file"
            ? invalidFile(
                repositoryRelativePath,
                "an intermediate segment is not a directory",
              )
            : invalidDirectory(
                repositoryRelativePath,
                "an intermediate segment is not a directory",
              );
        if (isLast && expectedKind === "file" && !metadata.isFile())
          return invalidFile(
            repositoryRelativePath,
            "the target is not a regular file",
          );
        if (isLast && expectedKind === "directory" && !metadata.isDirectory())
          return invalidDirectory(
            repositoryRelativePath,
            "the target is not a regular directory",
          );
      }

      const canonicalTargetPath = operations.realpath(currentPath);
      if (!isContained(canonicalRoot, canonicalTargetPath))
        return expectedKind === "file"
          ? invalidFile(
              repositoryRelativePath,
              "the canonical target is outside the repository",
            )
          : invalidDirectory(
              repositoryRelativePath,
              "the canonical target is outside the repository",
            );
      if (expectedKind === "directory") {
        const entries = operations
          .readdir(canonicalTargetPath)
          .map((entry) => ({
            name: entry.name,
            kind: directoryEntryKind(entry),
          }))
          .sort((left, right) => left.name.localeCompare(right.name, "en"));
        return {
          status: "resolved",
          repositoryRelativePath,
          targetPath: canonicalTargetPath,
          entries,
        };
      }

      let descriptor: number | null = null;
      try {
        descriptor = operations.open(canonicalTargetPath);
        const openedIdentity = operations.fstat(descriptor);
        if (!openedIdentity.isFile())
          return invalidFile(
            repositoryRelativePath,
            "the opened target is not a regular file",
          );
        const openedPath = operations.openedPath(
          descriptor,
          canonicalTargetPath,
        );
        if (openedPath === null)
          return unobservableFile(
            repositoryRelativePath,
            "the platform cannot prove the opened handle location",
          );
        if (!isContained(canonicalRoot, openedPath))
          return invalidFile(
            repositoryRelativePath,
            "the opened handle is outside the repository",
          );
        const source = operations.read(descriptor);
        const finalIdentity = operations.fstat(descriptor);
        if (!sameFileIdentity(openedIdentity, finalIdentity))
          return unobservableFile(
            repositoryRelativePath,
            "the opened file changed while it was read",
          );
        return {
          status: "resolved",
          repositoryRelativePath,
          targetPath: openedPath,
          source,
        };
      } finally {
        if (descriptor !== null) operations.close(descriptor);
      }
    } catch {
      return expectedKind === "file"
        ? unobservableFile(
            repositoryRelativePath,
            "the path could not be observed as one stable regular file",
          )
        : unobservableDirectory(
            repositoryRelativePath,
            "the path could not be observed as one stable directory",
          );
    }
  }

  return {
    observeFile: (repositoryRelativePath) =>
      observePath(repositoryRelativePath, "file") as RepositoryFileObservation,
    observeDirectory: (repositoryRelativePath) =>
      observePath(
        repositoryRelativePath,
        "directory",
      ) as RepositoryDirectoryObservation,
  };
}

/**
 * Filesystem Repository Observation Port From Root Bindingを構築する。
 *
 * @responsibility Filesystem Repository Observation Port From Root Bindingの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input rootBinding: RepositoryRootBinding
 * @returns RepositoryObservationPortを返す。
 * @precondition 「rootBinding: RepositoryRootBinding」がcreateFilesystemRepositoryObservationPortFromRootBindingの入力契約を満たす。
 * @postcondition createFilesystemRepositoryObservationPortFromRootBindingの責務を完了した結果だけを返す。
 * @effect N/A: createFilesystemRepositoryObservationPortFromRootBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createFilesystemRepositoryObservationPortFromRootBindingは独自の失敗分岐を所有しない。
 * @invariant createFilesystemRepositoryObservationPortFromRootBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: createFilesystemRepositoryObservationPortFromRootBindingはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createFilesystemRepositoryObservationPortFromRootBindingは共有非同期状態を持たない同期処理である。
 */
export function createFilesystemRepositoryObservationPortFromRootBinding(
  rootBinding: RepositoryRootBinding,
): RepositoryObservationPort {
  return createFilesystemRepositoryObservationPortWithOperations(
    rootBinding,
    defaultOperations,
  );
}
