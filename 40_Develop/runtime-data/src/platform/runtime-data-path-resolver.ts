import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveVerifiedRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
  type VerifiedRepositoryRoot,
} from "./repository-root-capability.ts";
import { CROS_DIRECTORY_ID } from "../core/runtime-data-contract.ts";

export const REPOSITORY_MANIFEST_RELATIVE_PATH =
  ".crdd/config/repository-manifest.json" as const;
export const EXTERNAL_SEND_POLICY_RELATIVE_PATH =
  ".crdd/config/external-send-policy.json" as const;
export const VERIFICATION_RELATIVE_PATH = ".crdd/verification" as const;

const REPOSITORY_AREAS = Object.freeze([
  "config",
  "project-runtime",
  "execution",
  "verification",
  "candidates",
  "release",
  "communication",
  "tests",
  "tmp",
] as const);

export type RepositoryRuntimeArea = (typeof REPOSITORY_AREAS)[number];
const AREA_PATH_KEYS = Object.freeze({
  config: "config",
  "project-runtime": "projectRuntime",
  execution: "execution",
  verification: "verification",
  candidates: "candidates",
  release: "release",
  communication: "communication",
  tests: "tests",
  tmp: "temporary",
} as const);

/**
 * Resolves only canonical paths. The caller remains responsible for proving
 * that `repositoryRoot` is the exact repository root before any effect.
 * This separate entry point lets protected signing code retain its own
 * no-external-Git root proof without reconstructing `.crdd` paths.
 */
function resolveRepositoryRuntimeDataPathsFromValidatedRoot(
  repositoryRoot: string,
) {
  if (
    !path.isAbsolute(repositoryRoot) ||
    path.resolve(repositoryRoot) !== repositoryRoot
  )
    return null;
  const root = path.join(repositoryRoot, ".crdd");
  return Object.freeze({
    repositoryRoot,
    root,
    config: path.join(root, "config"),
    repositoryManifest: path.join(root, "config", "repository-manifest.json"),
    externalSendPolicy: path.join(root, "config", "external-send-policy.json"),
    projectRuntime: path.join(root, "project-runtime"),
    execution: path.join(root, "execution"),
    verification: path.join(root, "verification"),
    candidates: path.join(root, "candidates"),
    release: path.join(root, "release"),
    communication: path.join(root, "communication"),
    tests: path.join(root, "tests"),
    temporary: path.join(root, "tmp"),
    allowedTopLevelAreas: REPOSITORY_AREAS,
  });
}

/**
 * Protected signing-only resolver. It derives the root from this package's
 * own immutable module location and never accepts caller-controlled paths.
 * It is intentionally omitted from the package's public index.
 */
export function resolveBundledRepositoryRuntimeDataPathsForProtectedSigning() {
  try {
    const repositoryRoot = path.resolve(
      fileURLToPath(new URL("../../../../", import.meta.url)),
    );
    const relativeSegments = path
      .relative(path.parse(repositoryRoot).root, repositoryRoot)
      .split(path.sep)
      .filter(Boolean);
    let current = path.parse(repositoryRoot).root;
    for (const segment of relativeSegments) {
      current = path.join(current, segment);
      if (fs.lstatSync(current).isSymbolicLink()) return null;
    }
    const metadata = fs.lstatSync(repositoryRoot);
    const marker = fs.lstatSync(path.join(repositoryRoot, ".git"));
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      fs.realpathSync.native(repositoryRoot) !== repositoryRoot ||
      marker.isSymbolicLink() ||
      (!marker.isDirectory() && !marker.isFile())
    )
      return null;
    return resolveRepositoryRuntimeDataPathsFromValidatedRoot(repositoryRoot);
  } catch {
    return null;
  }
}

export function resolveRepositoryRuntimeDataPaths(
  capability: VerifiedRepositoryRoot,
) {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  if (repositoryRoot === null) return null;
  const resolved =
    resolveRepositoryRuntimeDataPathsFromValidatedRoot(repositoryRoot);
  if (!resolved) return null;
  const { root: internalRoot, ...publicPaths } = resolved;
  if (path.dirname(internalRoot) !== resolved.repositoryRoot) return null;
  return Object.freeze(publicPaths);
}

/** Runtime Data implementation-only path set; omitted from the public index. */
export function resolveRepositoryRuntimeDataPathsForInternalUse(
  capability: VerifiedRepositoryRoot,
) {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null
    ? null
    : resolveRepositoryRuntimeDataPathsFromValidatedRoot(repositoryRoot);
}

function ensureCanonicalDirectory(target: string): void {
  try {
    fs.mkdirSync(target, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const metadata = fs.lstatSync(target);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(target) !== target
  )
    throw new Error("runtime_data_area_boundary_invalid");
}

/**
 * Creates or verifies one declared repository-local area. Consumers receive
 * the named area, never an untyped `.crdd` root from which new areas can be
 * reconstructed.
 */
export function ensureRepositoryRuntimeDataArea(
  capability: VerifiedRepositoryRoot,
  area: RepositoryRuntimeArea,
) {
  const paths = resolveRepositoryRuntimeDataPathsForInternalUse(capability);
  if (!paths || !REPOSITORY_AREAS.includes(area)) return null;
  ensureCanonicalDirectory(paths.root);
  const directory = paths[AREA_PATH_KEYS[area]];
  ensureCanonicalDirectory(directory);
  return Object.freeze({ repositoryRoot: paths.repositoryRoot, directory });
}

export function ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
  workingDirectory: unknown,
  area: RepositoryRuntimeArea,
) {
  const verified = verifyRepositoryRootFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? ensureRepositoryRuntimeDataArea(verified.capability, area)
    : null;
}

export function resolveRepositoryRuntimeDataPathsFromWorkingDirectory(
  workingDirectory: unknown,
) {
  const verified = verifyRepositoryRootFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? resolveRepositoryRuntimeDataPaths(verified.capability)
    : null;
}

type CrosRootInput = Readonly<{
  platform: "win32" | "linux";
  trustDomainId: string;
  publisher: string;
  application: "cros";
  localAppData?: string;
  xdgConfigHome?: string;
  xdgStateHome?: string;
  xdgRuntimeDirectory?: string;
  homeDirectory?: string;
}>;

export function resolveCrosRuntimeRoots(input: CrosRootInput) {
  if (
    !CROS_DIRECTORY_ID.test(input.trustDomainId) ||
    !CROS_DIRECTORY_ID.test(input.publisher) ||
    input.application !== "cros"
  )
    return null;
  const pathSegments = [
    input.publisher,
    input.application,
    input.trustDomainId,
  ];
  if (input.platform === "win32") {
    if (!input.localAppData || !path.win32.isAbsolute(input.localAppData))
      return null;
    const root = path.win32.join(input.localAppData, ...pathSegments);
    return Object.freeze({
      platform: "win32" as const,
      config: root,
      state: root,
      temporary: path.win32.join(root, "tmp"),
    });
  }
  if (!input.homeDirectory || !path.posix.isAbsolute(input.homeDirectory))
    return null;
  const configBase =
    input.xdgConfigHome ?? path.posix.join(input.homeDirectory, ".config");
  const stateBase =
    input.xdgStateHome ??
    path.posix.join(input.homeDirectory, ".local", "state");
  if (!path.posix.isAbsolute(configBase) || !path.posix.isAbsolute(stateBase))
    return null;
  const config = path.posix.join(configBase, ...pathSegments);
  const state = path.posix.join(stateBase, ...pathSegments);
  const temporary = input.xdgRuntimeDirectory
    ? path.posix.join(input.xdgRuntimeDirectory, ...pathSegments)
    : null;
  if (
    input.xdgRuntimeDirectory &&
    !path.posix.isAbsolute(input.xdgRuntimeDirectory)
  )
    return null;
  return Object.freeze({
    platform: "linux" as const,
    config,
    state,
    temporary,
  });
}
