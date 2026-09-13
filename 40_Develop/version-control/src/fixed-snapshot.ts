import fs from "node:fs";
import path from "node:path";

import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "./repository-location.ts";

export const FIXED_SNAPSHOT_CONTRACT = "crdd-version-control/fixed-snapshot/v1";
export const FIXED_SNAPSHOT_CONTRACT_REVISION = 1;

const candidateOutputs = new WeakMap<
  object,
  Readonly<{
    path: string;
    dev: bigint;
    ino: bigint;
    birthtimeNs: bigint;
    ownerCapability: object;
    ownerDirectory: Readonly<{
      path: string;
      dev: bigint;
      ino: bigint;
      birthtimeNs: bigint;
    }>;
  }>
>();
const CANDIDATE_OUTPUT_BRAND: unique symbol = Symbol("candidate-output");

export type CandidateOutputCapability = Readonly<{
  contract: "crdd-version-control/candidate-output/v1";
  [CANDIDATE_OUTPUT_BRAND]: true;
}>;

export type FixedSnapshotIdentity = Readonly<{
  contract: typeof FIXED_SNAPSHOT_CONTRACT;
  contractRevision: typeof FIXED_SNAPSHOT_CONTRACT_REVISION;
  status: "observed";
  revisionIdentity: string;
  snapshotIdentity: string;
  objectFormat: "sha1";
  observationComplete: true;
  repositoryPathReported: false;
}>;

export type FixedSnapshotFile = Readonly<{
  status: "read";
  revisionIdentity: string;
  relativePath: string;
  mode: "100644" | "100755";
  bytes: Buffer;
  sha256: string;
  repositoryPathReported: false;
}>;

export type CandidateMaterialization = Readonly<{
  status: "materialized";
  baseRevisionIdentity: string;
  baseSnapshotIdentity: string;
  fileCount: number;
  byteLength: number;
  contentManifestHash: string;
  repositoryPathReported: false;
  workspacePathReported: false;
}>;

export type CandidateMaterializationBlocked = Readonly<{
  status: "blocked";
  reason:
    | "fixed_snapshot_content_policy_rejected"
    | "candidate_output_invalid"
    | "candidate_materialization_failed"
    | "candidate_materialization_cleanup_unconfirmed";
  effectIssued: boolean;
  effectStateUnknown: boolean;
  cleanupConfirmed: boolean;
  repositoryPathReported: false;
  workspacePathReported: false;
}>;

export type FixedSnapshotContentPolicy = (
  relativePath: string,
  bytes: Uint8Array,
) => boolean;

export type FixedSnapshotAdapter = Readonly<{
  inspect(
    repositoryRoot: string,
    revision: string,
  ): FixedSnapshotIdentity | null;
  readFile(
    repositoryRoot: string,
    revision: string,
    relativePath: string,
  ): FixedSnapshotFile | null;
  materialize(
    repositoryRoot: string,
    revision: string,
    workspace: string,
    readPaths: readonly string[] | null,
    contentPolicy: FixedSnapshotContentPolicy | null,
  ): CandidateMaterialization | CandidateMaterializationBlocked | null;
}>;

function samePath(left: string, right: string): boolean {
  return process.platform === "win32"
    ? path.normalize(left).toLocaleLowerCase("en-US") ===
        path.normalize(right).toLocaleLowerCase("en-US")
    : path.normalize(left) === path.normalize(right);
}

function observeCandidateOutput(candidate: unknown) {
  if (
    typeof candidate !== "string" ||
    !path.isAbsolute(candidate) ||
    /[\u0000-\u001f\u007f]/u.test(candidate)
  )
    return null;
  try {
    const resolved = path.resolve(candidate);
    const metadata = fs.lstatSync(resolved, { bigint: true });
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      !samePath(fs.realpathSync.native(resolved), resolved)
    )
      return null;
    return Object.freeze({
      path: resolved,
      dev: metadata.dev,
      ino: metadata.ino,
      birthtimeNs: metadata.birthtimeNs,
    });
  } catch {
    return null;
  }
}

export function verifyCandidateOutputDirectory(
  candidate: unknown,
  ownerCapability: unknown,
  ownerDirectory: unknown,
):
  | Readonly<{
      status: "completed";
      capability: CandidateOutputCapability;
      pathReported: false;
    }>
  | Readonly<{
      status: "blocked";
      capability: null;
      pathReported: false;
    }> {
  const observed = observeCandidateOutput(candidate);
  const observedOwner = observeCandidateOutput(ownerDirectory);
  let isEmpty = false;
  try {
    isEmpty = observed !== null && fs.readdirSync(observed.path).length === 0;
  } catch {
    isEmpty = false;
  }
  if (
    observed === null ||
    !isEmpty ||
    observedOwner === null ||
    !ownerCapability ||
    typeof ownerCapability !== "object" ||
    (() => {
      const relative = path.relative(observedOwner.path, observed.path);
      return relative.startsWith("..") || path.isAbsolute(relative);
    })()
  )
    return Object.freeze({
      status: "blocked" as const,
      capability: null,
      pathReported: false as const,
    });
  const capability = Object.freeze({
    contract: "crdd-version-control/candidate-output/v1" as const,
    [CANDIDATE_OUTPUT_BRAND]: true as const,
  });
  candidateOutputs.set(
    capability,
    Object.freeze({
      ...observed,
      ownerCapability,
      ownerDirectory: observedOwner,
    }),
  );
  return Object.freeze({
    status: "completed" as const,
    capability,
    pathReported: false as const,
  });
}

function resolveCandidateOutputDirectory(
  capability: CandidateOutputCapability,
  ownerCapability: object,
): string | null {
  const stored = candidateOutputs.get(capability);
  const observed = stored ? observeCandidateOutput(stored.path) : null;
  const observedOwner = stored
    ? observeCandidateOutput(stored.ownerDirectory.path)
    : null;
  try {
    return observed !== null &&
      stored !== undefined &&
      stored.ownerCapability === ownerCapability &&
      observedOwner !== null &&
      observedOwner.dev === stored.ownerDirectory.dev &&
      observedOwner.ino === stored.ownerDirectory.ino &&
      observedOwner.birthtimeNs === stored.ownerDirectory.birthtimeNs &&
      observed.dev === stored.dev &&
      observed.ino === stored.ino &&
      observed.birthtimeNs === stored.birthtimeNs &&
      fs.readdirSync(observed.path).length === 0
      ? observed.path
      : null;
  } catch {
    return null;
  }
}

function blockedMaterialization(
  reason: CandidateMaterializationBlocked["reason"],
  effectIssued: boolean,
  effectStateUnknown: boolean,
  cleanupConfirmed: boolean,
): CandidateMaterializationBlocked {
  return Object.freeze({
    status: "blocked",
    reason,
    effectIssued,
    effectStateUnknown,
    cleanupConfirmed,
    repositoryPathReported: false,
    workspacePathReported: false,
  });
}

export function inspectFixedSnapshot(
  capability: VerifiedRepositoryRoot,
  revision: string,
  adapter: FixedSnapshotAdapter,
): FixedSnapshotIdentity | null {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null
    ? null
    : adapter.inspect(repositoryRoot, revision);
}

export function readFixedSnapshotFile(
  capability: VerifiedRepositoryRoot,
  revision: string,
  relativePath: string,
  adapter: FixedSnapshotAdapter,
): FixedSnapshotFile | null {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null
    ? null
    : adapter.readFile(repositoryRoot, revision, relativePath);
}

export function materializeFixedSnapshotCandidate(
  capability: VerifiedRepositoryRoot,
  revision: string,
  ownerCapability: object,
  outputCapability: CandidateOutputCapability,
  readPaths: readonly string[] | null,
  contentPolicy: FixedSnapshotContentPolicy | null,
  adapter: FixedSnapshotAdapter,
): CandidateMaterialization | CandidateMaterializationBlocked | null {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  const workspace = resolveCandidateOutputDirectory(
    outputCapability,
    ownerCapability,
  );
  if (repositoryRoot === null) return null;
  if (workspace === null)
    return blockedMaterialization(
      "candidate_output_invalid",
      false,
      false,
      true,
    );
  let result:
    | CandidateMaterialization
    | CandidateMaterializationBlocked
    | null = null;
  try {
    result = adapter.materialize(
      repositoryRoot,
      revision,
      workspace,
      readPaths,
      contentPolicy,
    );
    if (result?.status === "materialized") return result;
  } catch {
    result = null;
  }
  let effectIssued = true;
  try {
    effectIssued = fs.readdirSync(workspace).length > 0;
  } catch {
    effectIssued = true;
  }
  try {
    fs.rmSync(workspace, { recursive: true });
    if (fs.existsSync(workspace))
      throw new Error("candidate_output_cleanup_failed");
  } catch {
    return blockedMaterialization(
      "candidate_materialization_cleanup_unconfirmed",
      effectIssued,
      true,
      false,
    );
  }
  return blockedMaterialization(
    result?.status === "blocked"
      ? result.reason
      : "candidate_materialization_failed",
    effectIssued,
    false,
    true,
  );
}
