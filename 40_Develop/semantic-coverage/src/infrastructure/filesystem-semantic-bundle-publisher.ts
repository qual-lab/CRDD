import fs from "node:fs";
import path from "node:path";

import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/repository-identity/index.ts";
import { createFilesystemRepositoryObservationPort } from "../../../crdd-domain-library/src/repository-observation/index.ts";

export type SemanticBundlePublishRequest = Readonly<{
  outputRelativePath: string;
  content: string;
}>;

export type SemanticBundlePublishReceipt = Readonly<{
  outputRelativePath: string;
  byteLength: number;
}>;

export type SemanticBundlePublisher = Readonly<{
  publish: (
    request: SemanticBundlePublishRequest,
  ) => SemanticBundlePublishReceipt;
}>;

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

export function publishSemanticCoverageBundleWithHooks(
  capability: VerifiedRepositoryRoot,
  request: SemanticBundlePublishRequest,
  hooks: SemanticBundleWriterHooks = {},
): SemanticBundlePublishReceipt {
  const { outputRelativePath, content: serializedBundle } = request;
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  if (repositoryRoot === null)
    throw new Error("Verified repository root capability is unavailable.");
  const repository = createFilesystemRepositoryObservationPort(capability);
  const outputDirectoryRelativePath = path.posix.dirname(outputRelativePath);
  const outputDirectory = repository.observeDirectory(
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
    return {
      outputRelativePath,
      byteLength: Buffer.byteLength(serializedBundle, "utf8"),
    };
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

export function createFilesystemSemanticBundlePublisher(
  capability: VerifiedRepositoryRoot,
): SemanticBundlePublisher {
  return {
    publish: (request) =>
      publishSemanticCoverageBundleWithHooks(capability, request),
  };
}
