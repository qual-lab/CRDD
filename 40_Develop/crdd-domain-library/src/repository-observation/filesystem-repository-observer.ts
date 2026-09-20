import fs from "node:fs";
import path from "node:path";

import type {
  RepositoryDirectoryObservation,
  RepositoryFileObservation,
  RepositoryObservationPort,
} from "./index.ts";

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

function samePath(left: string, right: string): boolean {
  const isWindowsStyle =
    /^[A-Za-z]:[\\/]/u.test(left) || left.startsWith("\\\\");
  return isWindowsStyle
    ? path.win32.normalize(left).toLowerCase() ===
        path.win32.normalize(right).toLowerCase()
    : path.posix.normalize(left) === path.posix.normalize(right);
}

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

function isContained(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

function sameFileIdentity(left: fs.Stats, right: fs.Stats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs
  );
}

function directoryEntryKind(entry: fs.Dirent) {
  if (entry.isSymbolicLink()) return "symbolic-link" as const;
  if (entry.isDirectory()) return "directory" as const;
  if (entry.isFile()) return "file" as const;
  return "other" as const;
}

function invalidFile(
  pathValue: string,
  reason: string,
): RepositoryFileObservation {
  return { status: "invalid", repositoryRelativePath: pathValue, reason };
}

function unobservableFile(
  pathValue: string,
  reason: string,
): RepositoryFileObservation {
  return { status: "unobservable", repositoryRelativePath: pathValue, reason };
}

function invalidDirectory(
  pathValue: string,
  reason: string,
): RepositoryDirectoryObservation {
  return { status: "invalid", repositoryRelativePath: pathValue, reason };
}

function unobservableDirectory(
  pathValue: string,
  reason: string,
): RepositoryDirectoryObservation {
  return { status: "unobservable", repositoryRelativePath: pathValue, reason };
}

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

  function rootFailureForFile(pathValue: string): RepositoryFileObservation {
    const failure = rootFailure ?? {
      status: "unobservable" as const,
      reason: "repository root identity is unavailable",
    };
    return failure.status === "invalid"
      ? invalidFile(pathValue, failure.reason)
      : unobservableFile(pathValue, failure.reason);
  }

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

export function createFilesystemRepositoryObservationPortFromRootBinding(
  rootBinding: RepositoryRootBinding,
): RepositoryObservationPort {
  return createFilesystemRepositoryObservationPortWithOperations(
    rootBinding,
    defaultOperations,
  );
}
