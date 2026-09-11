import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const verifiedRoots = new WeakMap<object, string>();

export type VerifiedExecutionRepositoryRoot = Readonly<{
  contract: "crdd/verified-execution-repository-root/v1";
}>;

function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.normalize(left);
  const normalizedRight = path.normalize(right);
  return process.platform === "win32"
    ? normalizedLeft.toLocaleLowerCase("en-US") ===
        normalizedRight.toLocaleLowerCase("en-US")
    : normalizedLeft === normalizedRight;
}

function inspectPathChain(root: string): boolean {
  const parsed = path.parse(root);
  const relativeSegments = path.relative(parsed.root, root).split(path.sep);
  let cursor = parsed.root;
  for (const segment of relativeSegments) {
    if (!segment) continue;
    cursor = path.join(cursor, segment);
    const metadata = fs.lstatSync(cursor);
    if (metadata.isSymbolicLink()) return false;
  }
  const metadata = fs.lstatSync(root);
  return (
    metadata.isDirectory() &&
    !metadata.isSymbolicLink() &&
    samePath(fs.realpathSync.native(root), root)
  );
}

function observeExactRepositoryRoot(candidate: string): string | null {
  try {
    const resolved = path.resolve(candidate);
    if (!inspectPathChain(resolved)) return null;
    const observed = execFileSync(
      "git",
      ["-C", resolved, "rev-parse", "--show-toplevel"],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 5_000,
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
    if (!observed) return null;
    const observedRoot = path.resolve(observed);
    if (!samePath(observedRoot, resolved) || !inspectPathChain(observedRoot))
      return null;
    const gitBoundary = path.join(observedRoot, ".git");
    const gitMetadata = fs.lstatSync(gitBoundary);
    if (
      gitMetadata.isSymbolicLink() ||
      (!gitMetadata.isDirectory() && !gitMetadata.isFile())
    )
      return null;
    return observedRoot;
  } catch {
    return null;
  }
}

export function verifyExecutionIntelligenceRepositoryRoot(candidate: string):
  | Readonly<{
      status: "completed";
      reason: "execution_repository_root_verified";
      root: VerifiedExecutionRepositoryRoot;
    }>
  | Readonly<{
      status: "blocked";
      reason: "execution_repository_root_invalid";
    }> {
  const observedRoot = observeExactRepositoryRoot(candidate);
  if (observedRoot === null)
    return Object.freeze({
      status: "blocked" as const,
      reason: "execution_repository_root_invalid" as const,
    });
  const capability = Object.freeze({
    contract: "crdd/verified-execution-repository-root/v1" as const,
  });
  verifiedRoots.set(capability, observedRoot);
  return Object.freeze({
    status: "completed" as const,
    reason: "execution_repository_root_verified" as const,
    root: capability,
  });
}

export function resolveVerifiedExecutionRepositoryRoot(
  capability: VerifiedExecutionRepositoryRoot,
): string | null {
  const stored = verifiedRoots.get(capability);
  if (stored === undefined) return null;
  const observed = observeExactRepositoryRoot(stored);
  return observed !== null && samePath(observed, stored) ? stored : null;
}
