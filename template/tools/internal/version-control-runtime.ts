import { spawnSync } from "node:child_process";
import path from "node:path";

const MAX_OUTPUT_BYTES = 16 * 1_024 * 1_024;

function runVersionControlCommand(
  root: string,
  commandArguments: readonly string[],
) {
  return spawnSync("git", ["-C", root, ...commandArguments], {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    timeout: 30_000,
    maxBuffer: MAX_OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function samePath(left: string, right: string): boolean {
  const leftResolved = path.resolve(left);
  const rightResolved = path.resolve(right);
  return process.platform === "win32"
    ? leftResolved.toLocaleLowerCase("en-US") ===
        rightResolved.toLocaleLowerCase("en-US")
    : leftResolved === rightResolved;
}

function failureReason(
  result: ReturnType<typeof runVersionControlCommand>,
): string {
  if (result.error && "code" in result.error && result.error.code === "ENOENT")
    return "version_control_not_installed";
  if (/not a git repository/iu.test(result.stderr || ""))
    return "repository_not_found";
  return "repository_observation_failed";
}

export type RepositoryEntryObservation = Readonly<{
  relativePath: string;
  kind: "file" | "nested_repository";
  contentIdentity: string | null;
  conflicted: boolean;
}>;

export function observeDeclaredNestedRepositoryPaths(
  configPath: string,
):
  | Readonly<{ status: "completed"; paths: readonly string[] }>
  | Readonly<{ status: "unavailable"; paths: readonly string[] }> {
  const result = spawnSync(
    "git",
    [
      "config",
      "-z",
      "--file",
      configPath,
      "--get-regexp",
      "^submodule\\..*\\.path$",
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      shell: false,
      timeout: 30_000,
      maxBuffer: MAX_OUTPUT_BYTES,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (result.status === 1)
    return Object.freeze({ status: "completed", paths: Object.freeze([]) });
  if (result.status !== 0)
    return Object.freeze({ status: "unavailable", paths: Object.freeze([]) });
  const paths: string[] = [];
  for (const entry of result.stdout.split("\0").filter(Boolean)) {
    const separator = entry.indexOf("\n");
    if (separator < 0)
      return Object.freeze({
        status: "unavailable",
        paths: Object.freeze([]),
      });
    paths.push(entry.slice(separator + 1));
  }
  return Object.freeze({
    status: "completed",
    paths: Object.freeze([...new Set(paths)]),
  });
}

export function observeRepositoryEntries(scopeRoot: string):
  | Readonly<{
      status: "completed";
      entries: readonly RepositoryEntryObservation[];
      nestedRepositoryObservationComplete: boolean;
      repositoryPathReported: false;
    }>
  | Readonly<{
      status: "unavailable";
      reason: string;
      entries: readonly RepositoryEntryObservation[];
      repositoryPathReported: false;
    }> {
  const rootResult = runVersionControlCommand(scopeRoot, [
    "rev-parse",
    "--show-toplevel",
  ]);
  if (rootResult.status !== 0)
    return Object.freeze({
      status: "unavailable",
      reason: failureReason(rootResult),
      entries: Object.freeze([]),
      repositoryPathReported: false,
    });
  const repositoryRoot = path.resolve(rootResult.stdout.trim());
  const relativeScope = path.relative(repositoryRoot, path.resolve(scopeRoot));
  if (relativeScope.startsWith("..") || path.isAbsolute(relativeScope))
    return Object.freeze({
      status: "unavailable",
      reason: "repository_boundary_invalid",
      entries: Object.freeze([]),
      repositoryPathReported: false,
    });
  const selector = relativeScope === "" ? "." : relativeScope;
  const files = runVersionControlCommand(repositoryRoot, [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    selector,
  ]);
  const staged = runVersionControlCommand(repositoryRoot, [
    "ls-files",
    "--stage",
    "-z",
    "--",
    selector,
  ]);
  if (files.status !== 0)
    return Object.freeze({
      status: "unavailable",
      reason: "repository_entries_observation_failed",
      entries: Object.freeze([]),
      repositoryPathReported: false,
    });
  const result = new Map<string, RepositoryEntryObservation>();
  for (const repositoryRelative of files.stdout.split("\0").filter(Boolean)) {
    const absolute = path.resolve(repositoryRoot, repositoryRelative);
    const scopeRelative = path
      .relative(path.resolve(scopeRoot), absolute)
      .replaceAll("\\", "/");
    if (scopeRelative.startsWith("../") || path.isAbsolute(scopeRelative))
      continue;
    result.set(scopeRelative, {
      relativePath: scopeRelative,
      kind: "file",
      contentIdentity: null,
      conflicted: false,
    });
  }
  if (staged.status !== 0)
    return Object.freeze({
      status: "completed",
      entries: Object.freeze([...result.values()]),
      nestedRepositoryObservationComplete: false,
      repositoryPathReported: false,
    });
  const nested = new Map<
    string,
    { contentIdentity: string | null; conflicted: boolean }
  >();
  for (const entry of staged.stdout.split("\0").filter(Boolean)) {
    const separator = entry.indexOf("\t");
    const metadata =
      separator < 0
        ? null
        : /^(\d{6}) ([0-9a-f]{40,64}) ([0-3])$/iu.exec(
            entry.slice(0, separator),
          );
    if (!metadata)
      return Object.freeze({
        status: "completed",
        entries: Object.freeze([...result.values()]),
        nestedRepositoryObservationComplete: false,
        repositoryPathReported: false,
      });
    if (metadata[1] !== "160000") continue;
    const absolute = path.resolve(repositoryRoot, entry.slice(separator + 1));
    const scopeRelative = path
      .relative(path.resolve(scopeRoot), absolute)
      .replaceAll("\\", "/");
    if (scopeRelative.startsWith("../") || path.isAbsolute(scopeRelative))
      continue;
    const existing = nested.get(scopeRelative);
    nested.set(scopeRelative, {
      contentIdentity:
        metadata[3] === "0"
          ? (metadata[2]?.toLowerCase() ?? null)
          : (existing?.contentIdentity ?? null),
      conflicted: metadata[3] !== "0" || existing?.conflicted === true,
    });
  }
  for (const [relativePath, value] of nested)
    result.set(relativePath, {
      relativePath,
      kind: "nested_repository",
      ...value,
    });
  return Object.freeze({
    status: "completed",
    entries: Object.freeze(
      [...result.values()].sort((left, right) =>
        left.relativePath.localeCompare(right.relativePath),
      ),
    ),
    nestedRepositoryObservationComplete: true,
    repositoryPathReported: false,
  });
}

export function observeNestedRepository(
  scopeRoot: string,
  relativePath: string,
) {
  const target = path.resolve(scopeRoot, relativePath);
  const top = runVersionControlCommand(target, [
    "rev-parse",
    "--show-toplevel",
  ]);
  const metadata = runVersionControlCommand(target, [
    "rev-parse",
    "--absolute-git-dir",
  ]);
  const revision = runVersionControlCommand(target, [
    "rev-parse",
    "--verify",
    "HEAD",
  ]);
  const revisionIdentity =
    revision.status === 0 && /^[0-9a-f]{40,64}$/iu.test(revision.stdout.trim())
      ? revision.stdout.trim().toLowerCase()
      : null;
  return Object.freeze({
    exactRepository: top.status === 0 && samePath(top.stdout.trim(), target),
    metadataAccessible: metadata.status === 0,
    revisionIdentity,
    repositoryPathReported: false,
  });
}

export function readFixedSnapshotText(
  repositoryRoot: string,
  revisionIdentity: string,
  relativePath: string,
): string | null {
  if (
    !/^[0-9a-f]{40,64}$/iu.test(revisionIdentity) ||
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    relativePath.includes("\\") ||
    relativePath
      .split("/")
      .some((segment) => segment === "" || segment === "." || segment === "..")
  )
    return null;
  const result = runVersionControlCommand(repositoryRoot, [
    "--no-replace-objects",
    "show",
    `${revisionIdentity}:${relativePath}`,
  ]);
  return result.status === 0 ? result.stdout : null;
}

export function resolveRevisionIdentity(
  repositoryRoot: string,
  selector: string,
): string | null {
  if (
    selector.length === 0 ||
    selector.length > 1_024 ||
    /[\u0000-\u001f\u007f]/u.test(selector) ||
    selector.startsWith("-")
  )
    return null;
  const result = runVersionControlCommand(repositoryRoot, [
    "rev-parse",
    "--verify",
    selector,
  ]);
  const value = result.status === 0 ? result.stdout.trim().toLowerCase() : "";
  return /^[0-9a-f]{40,64}$/u.test(value) ? value : null;
}
