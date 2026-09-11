import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const roots = new WeakMap<object, string>();

export type VerifiedRepositoryRoot = Readonly<{
  contract: "crdd/verified-repository-root/v1";
}>;

function samePath(
  left: string,
  right: string,
  platform = process.platform,
): boolean {
  const normalizedLeft = path.normalize(left);
  const normalizedRight = path.normalize(right);
  return platform === "win32"
    ? normalizedLeft.toLocaleLowerCase("en-US") ===
        normalizedRight.toLocaleLowerCase("en-US")
    : normalizedLeft === normalizedRight;
}

function inspectPathChain(root: string): boolean {
  const parsed = path.parse(root);
  let cursor = parsed.root;
  for (const segment of path.relative(parsed.root, root).split(path.sep)) {
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
    const marker = fs.lstatSync(path.join(observedRoot, ".git"));
    return marker.isSymbolicLink() ||
      (!marker.isDirectory() && !marker.isFile())
      ? null
      : observedRoot;
  } catch {
    return null;
  }
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
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
  if (typeof candidate !== "string")
    return Object.freeze({
      status: "blocked",
      reason: "repository_root_invalid",
      capability: null,
    });
  const observed = observeExactRepositoryRoot(candidate);
  if (observed === null)
    return Object.freeze({
      status: "blocked",
      reason: "repository_root_invalid",
      capability: null,
    });
  const capability = Object.freeze({
    contract: "crdd/verified-repository-root/v1" as const,
  });
  roots.set(capability, observed);
  return Object.freeze({
    status: "completed",
    reason: "repository_root_verified",
    capability,
  });
}

export function verifyRepositoryRootFromWorkingDirectory(
  workingDirectory: unknown,
): ReturnType<typeof verifyRepositoryRoot> {
  if (typeof workingDirectory !== "string") return verifyRepositoryRoot(null);
  try {
    let current = fs.realpathSync.native(path.resolve(workingDirectory));
    const initial = fs.lstatSync(current);
    if (!initial.isDirectory() || initial.isSymbolicLink())
      return verifyRepositoryRoot(null);
    for (;;) {
      const marker = path.join(current, ".git");
      try {
        fs.lstatSync(marker);
        return verifyRepositoryRoot(current);
      } catch (error) {
        if (!isMissing(error)) return verifyRepositoryRoot(null);
      }
      const parent = path.dirname(current);
      if (parent === current) return verifyRepositoryRoot(null);
      current = parent;
    }
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
