import path from "node:path";

export type CrddRepositoryManifest = Readonly<{
  schema: string;
  projectId: string;
  repositoryRole: string;
}>;

export type CrddReleaseBinding = Readonly<{
  verified: boolean;
  distributionRoot: string;
  crddVersion: string;
  packageContentRootSha256: string;
  runtimeExecutionIdentitySha256: string;
}>;

export type CrddPathObservation =
  | "regular-file"
  | "regular-directory"
  | "symbolic-or-junction"
  | "unobservable"
  | "absent";

export type CrddLauncherBindingRequest = Readonly<{
  launcherRealPath: string;
  versionControlRoot: string | null;
  repositoryManifest: CrddRepositoryManifest | null;
  releaseBinding: CrddReleaseBinding | null;
  implementationEntryRealPath: string;
  pathFlavor: "win32" | "posix";
  launcherObservation: CrddPathObservation;
  baselineRootObservation: CrddPathObservation;
  manifestObservation: CrddPathObservation;
  implementationObservation: CrddPathObservation;
}>;

export type CrddLauncherBindingResult =
  | Readonly<{
      status: "completed";
      mode: "development" | "released-baseline";
      baselineRoot: string;
      implementationEntry: string;
      crddVersion: string | null;
      packageContentRootSha256: string | null;
      runtimeExecutionIdentitySha256: string | null;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "launcher_path_unrecognized"
        | "launcher_boundary_invalid"
        | "baseline_root_boundary_invalid"
        | "manifest_boundary_invalid"
        | "implementation_path_invalid"
        | "implementation_boundary_invalid"
        | "development_identity_invalid"
        | "release_identity_invalid";
    }>;

const checkerImplementationEntrySegments = [
  "40_Develop",
  "checker",
  "src",
  "checker-cli.ts",
] as const;
const developmentLauncherSegments = [
  "40_Develop",
  "checker",
  "crdd-check.ts",
] as const;
const distributedLauncherSegments = [
  "template",
  "tools",
  "crdd-check.ts",
] as const;
const SHA256 = /^[a-f0-9]{64}$/u;
const CRDD_VERSION =
  /^v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;

function pathApi(flavor: CrddLauncherBindingRequest["pathFlavor"]) {
  return flavor === "win32" ? path.win32 : path.posix;
}

function normalized(
  value: string,
  flavor: CrddLauncherBindingRequest["pathFlavor"],
) {
  return pathApi(flavor).normalize(value);
}

function absolutePath(
  value: string,
  flavor: CrddLauncherBindingRequest["pathFlavor"],
) {
  if (value.length === 0) return false;
  if (flavor === "posix") return path.posix.isAbsolute(value);
  if (!path.win32.isAbsolute(value)) return false;
  const root = path.win32.parse(value).root.replaceAll("/", "\\");
  if (/^[A-Za-z]:\\$/u.test(root)) return true;
  if (root.startsWith("\\\\?\\") || root.startsWith("\\\\.\\")) return false;
  return /^\\\\[^\\]+\\[^\\]+\\$/u.test(root);
}

function samePath(
  left: string,
  right: string,
  flavor: CrddLauncherBindingRequest["pathFlavor"],
) {
  const normalizedLeft = normalized(left, flavor);
  const normalizedRight = normalized(right, flavor);
  return flavor === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function rootFromKnownLauncher(
  launcherRealPath: string,
  flavor: CrddLauncherBindingRequest["pathFlavor"],
) {
  const api = pathApi(flavor);
  if (!absolutePath(launcherRealPath, flavor)) return null;
  const launcher = normalized(launcherRealPath, flavor);
  const candidateRoot = api.dirname(api.dirname(api.dirname(launcher)));
  const suffixes = [developmentLauncherSegments, distributedLauncherSegments];
  for (const suffix of suffixes) {
    const expectedLauncher = api.join(candidateRoot, ...suffix);
    if (samePath(launcher, expectedLauncher, flavor)) return candidateRoot;
  }
  return null;
}

/**
 * Resolves one exact CRDD baseline root without searching parents, siblings, PATH,
 * or alternate versions. Filesystem and signature observations are supplied by
 * the caller so this contract cannot silently reinterpret an unobservable value.
 */
export function resolveCrddCheckerLauncherBinding(
  request: CrddLauncherBindingRequest,
): CrddLauncherBindingResult {
  const api = pathApi(request.pathFlavor);
  const baselineRoot = rootFromKnownLauncher(
    request.launcherRealPath,
    request.pathFlavor,
  );
  if (!baselineRoot)
    return { status: "blocked", reason: "launcher_path_unrecognized" };
  if (request.launcherObservation !== "regular-file")
    return { status: "blocked", reason: "launcher_boundary_invalid" };
  if (request.baselineRootObservation !== "regular-directory")
    return { status: "blocked", reason: "baseline_root_boundary_invalid" };
  if (request.manifestObservation !== "regular-file")
    return { status: "blocked", reason: "manifest_boundary_invalid" };

  const expectedImplementation = api.join(
    baselineRoot,
    ...checkerImplementationEntrySegments,
  );
  if (
    !absolutePath(request.implementationEntryRealPath, request.pathFlavor) ||
    !samePath(
      request.implementationEntryRealPath,
      expectedImplementation,
      request.pathFlavor,
    )
  )
    return { status: "blocked", reason: "implementation_path_invalid" };
  if (request.implementationObservation !== "regular-file")
    return { status: "blocked", reason: "implementation_boundary_invalid" };

  if (request.versionControlRoot !== null) {
    if (!absolutePath(request.versionControlRoot, request.pathFlavor))
      return { status: "blocked", reason: "development_identity_invalid" };
    const manifest = request.repositoryManifest;
    if (
      samePath(request.versionControlRoot, baselineRoot, request.pathFlavor) &&
      manifest?.schema === "crdd/repository-manifest/v1" &&
      manifest.projectId === "qual-lab.crdd" &&
      manifest.repositoryRole === "crdd-standard"
    )
      return {
        status: "completed",
        mode: "development",
        baselineRoot,
        implementationEntry: expectedImplementation,
        crddVersion: null,
        packageContentRootSha256: null,
        runtimeExecutionIdentitySha256: null,
      };
  }

  const release = request.releaseBinding;
  if (
    release !== null &&
    !absolutePath(release.distributionRoot, request.pathFlavor)
  )
    return { status: "blocked", reason: "release_identity_invalid" };
  if (
    release?.verified === true &&
    samePath(release.distributionRoot, baselineRoot, request.pathFlavor) &&
    CRDD_VERSION.test(release.crddVersion) &&
    SHA256.test(release.packageContentRootSha256) &&
    SHA256.test(release.runtimeExecutionIdentitySha256)
  )
    return {
      status: "completed",
      mode: "released-baseline",
      baselineRoot,
      implementationEntry: expectedImplementation,
      crddVersion: release.crddVersion,
      packageContentRootSha256: release.packageContentRootSha256,
      runtimeExecutionIdentitySha256: release.runtimeExecutionIdentitySha256,
    };

  return {
    status: "blocked",
    reason:
      request.releaseBinding === null
        ? "development_identity_invalid"
        : "release_identity_invalid",
  };
}
