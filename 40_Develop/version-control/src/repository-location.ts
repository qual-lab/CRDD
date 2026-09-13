import fs from "node:fs";
import path from "node:path";

import { resolveRepositoryGitLayout } from "./git/repository-layout.ts";

export const REPOSITORY_LOCATION_CONTRACT =
  "crdd-version-control/repository-location/v1" as const;
export const REPOSITORY_LOCATION_CONTRACT_REVISION = 1 as const;

const roots = new WeakMap<object, string>();

export type VerifiedRepositoryRoot = Readonly<{
  contract: typeof REPOSITORY_LOCATION_CONTRACT;
}>;

function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.normalize(left);
  const normalizedRight = path.normalize(right);
  return process.platform === "win32"
    ? normalizedLeft.toLocaleLowerCase("en-US") ===
        normalizedRight.toLocaleLowerCase("en-US")
    : normalizedLeft === normalizedRight;
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function validAbsoluteDirectory(candidate: unknown): candidate is string {
  if (
    typeof candidate !== "string" ||
    candidate.length === 0 ||
    !path.isAbsolute(candidate) ||
    /[\u0000-\u001f\u007f]/u.test(candidate)
  )
    return false;
  try {
    const resolved = path.resolve(candidate);
    const metadata = fs.lstatSync(resolved);
    return (
      metadata.isDirectory() &&
      !metadata.isSymbolicLink() &&
      samePath(fs.realpathSync.native(resolved), resolved)
    );
  } catch {
    return false;
  }
}

function observeExactRepositoryRoot(candidate: unknown): string | null {
  if (!validAbsoluteDirectory(candidate)) return null;
  try {
    const root = path.resolve(candidate);
    const layout = resolveRepositoryGitLayout(root);
    return samePath(layout.root.realPath, root) ? layout.root.realPath : null;
  } catch {
    return null;
  }
}

function issueCapability(root: string): VerifiedRepositoryRoot {
  const capability = Object.freeze({
    contract: REPOSITORY_LOCATION_CONTRACT,
  });
  roots.set(capability, root);
  return capability;
}

export function verifyRepositoryRoot(candidate: unknown):
  | Readonly<{
      status: "completed";
      reason: "repository_root_verified";
      capability: VerifiedRepositoryRoot;
    }>
  | Readonly<{
      status: "blocked";
      reason: "repository_root_invalid";
      capability: null;
    }> {
  const root = observeExactRepositoryRoot(candidate);
  return root === null
    ? Object.freeze({
        status: "blocked" as const,
        reason: "repository_root_invalid" as const,
        capability: null,
      })
    : Object.freeze({
        status: "completed" as const,
        reason: "repository_root_verified" as const,
        capability: issueCapability(root),
      });
}

/**
 * Selects the nearest enclosing repository. A present but invalid repository
 * boundary is terminal so an operation cannot silently bind to an outer root.
 */
export function verifyRepositoryRootFromWorkingDirectory(
  workingDirectory: unknown,
): ReturnType<typeof verifyRepositoryRoot> {
  try {
    return verifyRepositoryRoot(
      resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory),
    );
  } catch {
    return verifyRepositoryRoot(null);
  }
}

export function resolveVerifiedRepositoryRoot(
  capability: VerifiedRepositoryRoot,
): string | null {
  const stored = roots.get(capability);
  if (stored === undefined) return null;
  const observed = observeExactRepositoryRoot(stored);
  return observed !== null && samePath(observed, stored) ? stored : null;
}

export function resolveVerifiedRepositoryRootFromWorkingDirectory(
  workingDirectory: unknown,
): string {
  if (!validAbsoluteDirectory(workingDirectory))
    throw new Error("repository_working_directory_invalid");
  let current = path.resolve(workingDirectory);
  for (;;) {
    const marker = path.join(current, ".git");
    try {
      fs.lstatSync(marker);
    } catch (error) {
      if (!isMissing(error))
        throw new Error("repository_root_observation_failed");
      const parent = path.dirname(current);
      if (parent === current)
        throw new Error("verified_repository_root_required");
      current = parent;
      continue;
    }
    if (observeExactRepositoryRoot(current) === null)
      throw new Error("repository_boundary_invalid");
    return current;
  }
}

export function describeRepositoryLocationContract() {
  return Object.freeze({
    contract: REPOSITORY_LOCATION_CONTRACT,
    contractRevision: REPOSITORY_LOCATION_CONTRACT_REVISION,
    selection: "nearest_enclosing_verified_repository_root",
    workingDirectoryIsRepositoryAuthority: false,
    invalidNestedBoundaryTraversalAllowed: false,
    pathReported: false,
    filesystemEffectIssued: false,
  });
}
