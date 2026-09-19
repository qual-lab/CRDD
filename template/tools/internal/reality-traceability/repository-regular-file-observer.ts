import fs from "node:fs";
import path from "node:path";

function isContained(root: string, target: string): boolean {
  const relativePath = path.relative(root, target);
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

export function observeRepositoryRegularFile(
  repositoryRoot: string,
  repositoryRelativePath: string,
): Readonly<
  | { status: "resolved"; targetPath: string; source: string }
  | { status: "invalid"; reason: string }
  | { status: "unobservable"; reason: string }
> {
  try {
    const canonicalRepositoryRoot = fs.realpathSync.native(repositoryRoot);
    let currentPath = repositoryRoot;
    const segments = repositoryRelativePath.split("/");
    for (const [index, segment] of segments.entries()) {
      currentPath = path.join(currentPath, segment);
      const metadata = fs.lstatSync(currentPath);
      if (metadata.isSymbolicLink())
        return {
          status: "invalid",
          reason: "a symbolic link or junction is present in the path",
        };
      const isLastSegment = index === segments.length - 1;
      if (!isLastSegment && !metadata.isDirectory())
        return {
          status: "invalid",
          reason: "an intermediate segment is not a directory",
        };
      if (isLastSegment && !metadata.isFile())
        return {
          status: "invalid",
          reason: "the target is not a regular file",
        };
    }
    const canonicalTargetPath = fs.realpathSync.native(currentPath);
    if (!isContained(canonicalRepositoryRoot, canonicalTargetPath))
      return {
        status: "invalid",
        reason: "the canonical target is outside the repository",
      };
    return {
      status: "resolved",
      targetPath: canonicalTargetPath,
      source: fs.readFileSync(canonicalTargetPath, "utf8"),
    };
  } catch {
    return {
      status: "unobservable",
      reason: "the path could not be observed as one stable regular file",
    };
  }
}

export function observeRepositoryDirectory(
  repositoryRoot: string,
  repositoryRelativePath: string,
): Readonly<
  | { status: "resolved"; targetPath: string }
  | { status: "invalid"; reason: string }
  | { status: "unobservable"; reason: string }
> {
  try {
    const canonicalRepositoryRoot = fs.realpathSync.native(repositoryRoot);
    let currentPath = repositoryRoot;
    for (const segment of repositoryRelativePath.split("/")) {
      currentPath = path.join(currentPath, segment);
      const metadata = fs.lstatSync(currentPath);
      if (metadata.isSymbolicLink())
        return {
          status: "invalid",
          reason: "a symbolic link or junction is present in the path",
        };
      if (!metadata.isDirectory())
        return {
          status: "invalid",
          reason: "the target path contains a non-directory entry",
        };
    }
    const canonicalTargetPath = fs.realpathSync.native(currentPath);
    if (!isContained(canonicalRepositoryRoot, canonicalTargetPath))
      return {
        status: "invalid",
        reason: "the canonical target is outside the repository",
      };
    return { status: "resolved", targetPath: canonicalTargetPath };
  } catch {
    return {
      status: "unobservable",
      reason: "the path could not be observed as one stable directory",
    };
  }
}
