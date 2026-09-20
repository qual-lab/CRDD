export type RepositoryEntryKind =
  | "file"
  | "directory"
  | "symbolic-link"
  | "other";

export type RepositoryDirectoryEntry = Readonly<{
  name: string;
  kind: RepositoryEntryKind;
}>;

export type RepositoryFileObservation = Readonly<
  | {
      status: "resolved";
      repositoryRelativePath: string;
      targetPath: string;
      source: string;
    }
  | {
      status: "invalid" | "unobservable";
      repositoryRelativePath: string;
      reason: string;
    }
>;

export type RepositoryDirectoryObservation = Readonly<
  | {
      status: "resolved";
      repositoryRelativePath: string;
      targetPath: string;
      entries: readonly RepositoryDirectoryEntry[];
    }
  | {
      status: "invalid" | "unobservable";
      repositoryRelativePath: string;
      reason: string;
    }
>;

export type RepositoryObservationPort = Readonly<{
  observeFile: (repositoryRelativePath: string) => RepositoryFileObservation;
  observeDirectory: (
    repositoryRelativePath: string,
  ) => RepositoryDirectoryObservation;
}>;

export type RepositoryRootCapability = VerifiedRepositoryRoot;

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
import path from "node:path";

import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";
import { createFilesystemRepositoryObservationPortFromRootBinding } from "./internal/filesystem-repository-observer.ts";
export {
  type SemanticBundlePublishReceipt,
  type SemanticBundlePublishRequest,
  type SemanticBundlePublisher,
  createFilesystemSemanticBundlePublisher,
} from "./internal/filesystem-semantic-bundle-publisher.ts";
