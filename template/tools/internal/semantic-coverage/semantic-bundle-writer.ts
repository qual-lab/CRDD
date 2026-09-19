import fs from "node:fs";
import path from "node:path";

import { observeRepositoryDirectory } from "../reality-traceability/repository-regular-file-observer.ts";

export type SemanticBundleWriterHooks = Readonly<{
  beforePublish?: (temporaryPath: string, targetPath: string) => void;
}>;

function isContained(root: string, target: string): boolean {
  const relativePath = path.relative(root, target);
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

export function publishSemanticCoverageBundle(
  repositoryRoot: string,
  outputRelativePath: string,
  serializedBundle: string,
  hooks: SemanticBundleWriterHooks = {},
): void {
  const outputDirectoryRelativePath = path.posix.dirname(outputRelativePath);
  const outputDirectory = observeRepositoryDirectory(
    repositoryRoot,
    outputDirectoryRelativePath,
  );
  if (outputDirectory.status !== "resolved")
    throw new Error(
      `Semantic coverage output directory is invalid: ${outputDirectory.reason}`,
    );

  const targetPath = path.join(
    outputDirectory.targetPath,
    path.posix.basename(outputRelativePath),
  );
  const canonicalRepositoryRoot = fs.realpathSync.native(repositoryRoot);
  if (!isContained(canonicalRepositoryRoot, targetPath))
    throw new Error("Semantic coverage output is outside the repository.");
  if (fs.existsSync(targetPath)) {
    const targetMetadata = fs.lstatSync(targetPath);
    if (targetMetadata.isSymbolicLink() || !targetMetadata.isFile())
      throw new Error("Semantic coverage output is not a regular file.");
  }

  const temporaryPath = path.join(
    outputDirectory.targetPath,
    `.semantic-coverage-pilot.${process.pid}.${Date.now()}.tmp`,
  );
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(descriptor, serializedBundle, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    if (fs.readFileSync(temporaryPath, "utf8") !== serializedBundle)
      throw new Error("Semantic coverage staging verification failed.");
    hooks.beforePublish?.(temporaryPath, targetPath);
    fs.renameSync(temporaryPath, targetPath);
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}
