import fs from "node:fs";
import path from "node:path";

import { resolveRepositoryGitLayout } from "./repository-git-layout-internal.ts";

export const REPOSITORY_ROOT_RESOLUTION_CONTRACT =
  "crdd-coordinator/repository-root-resolution";
export const REPOSITORY_ROOT_RESOLUTION_CONTRACT_REVISION = 1;

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function realDirectory(raw: unknown): string {
  if (
    typeof raw !== "string" ||
    raw.length === 0 ||
    !path.isAbsolute(raw) ||
    /[\u0000-\u001f\u007f]/u.test(raw)
  ) {
    throw new Error("repository_working_directory_invalid");
  }
  const resolved = path.resolve(raw);
  const metadata = fs.lstatSync(resolved);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error("repository_working_directory_invalid");
  }
  return fs.realpathSync.native(resolved);
}

/**
 * Resolve the nearest enclosing, structurally verified Git worktree root.
 * A present but invalid `.git` boundary is terminal: walking past it could bind
 * an operation to a different outer repository.
 */
export function resolveVerifiedRepositoryRootFromWorkingDirectory(
  workingDirectory: unknown,
): string {
  let current = realDirectory(workingDirectory);
  for (;;) {
    const marker = path.join(current, ".git");
    try {
      fs.lstatSync(marker);
    } catch (error) {
      if (!isEnoent(error)) {
        throw new Error("repository_root_observation_failed");
      }
      const parent = path.dirname(current);
      if (parent === current) {
        throw new Error("verified_repository_root_required");
      }
      current = parent;
      continue;
    }

    try {
      const layout = resolveRepositoryGitLayout(current);
      if (layout.root.realPath !== current) {
        throw new Error("repository_root_identity_mismatch");
      }
      return current;
    } catch {
      throw new Error("repository_git_boundary_invalid");
    }
  }
}

export function describeRepositoryRootResolutionContract() {
  return Object.freeze({
    contract: REPOSITORY_ROOT_RESOLUTION_CONTRACT,
    contractRevision: REPOSITORY_ROOT_RESOLUTION_CONTRACT_REVISION,
    selection: "nearest_enclosing_verified_git_worktree_root",
    processWorkingDirectoryIsRepositoryAuthority: false,
    invalidNestedGitBoundaryTraversalAllowed: false,
    repositoryLocalCrddLocation: "<verified-repository-root>/.crdd",
    repositoryPathReported: false,
    filesystemEffectIssued: false,
  });
}
