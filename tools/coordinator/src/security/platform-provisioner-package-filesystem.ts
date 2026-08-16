import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import {
  calculatePlatformProvisionerPackageContentRootCandidate,
  verifyPlatformProvisionerManifestCandidate,
} from "./platform-provisioner-trust-core.ts";

const bundledPackageRoot = fileURLToPath(new URL("../../", import.meta.url));
const MAXIMUM_FILES = 2_048;
const MAXIMUM_PACKAGE_BYTES = 64 * 1024 * 1024;
const MAXIMUM_PACKAGE_JSON_BYTES = 64 * 1024;
const VERIFY_KEYS = new Set([
  "manifestEnvelope",
  "releaseSignerSpkiDer",
  "evaluationTime",
  "expectedCrddVersion",
  "expectedCrddCommit",
  "expectedCrddTree",
]);
const CRDD_GIT_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const CRDD_VERSION = /^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]{1,64})?$/u;

type EntityIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  size: bigint;
  mode: bigint;
  uid: bigint;
  gid: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
}>;

type ObservedFile = Readonly<{
  path: string;
  byteLength: number;
  sha256: string;
}>;

type PackageObservation = Readonly<{
  packageName: string;
  packageVersion: string;
  files: readonly ObservedFile[];
}>;

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    packageContentRootSha256: null,
    packageFileCount: null,
    packageByteLength: null,
    stableFilesystemIdentityObserved: false,
    runtimeOwnedPackageRoot: false,
    permissionPolicyConfirmed: false,
    runtimeOwnedReleaseTrustConfirmed: false,
    crddDistributionConfirmed: false,
    effectAuthorizationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}

function identity(
  metadata: fs.BigIntStats,
  expectedType: "file" | "directory",
) {
  const isExpected =
    expectedType === "file" ? metadata.isFile() : metadata.isDirectory();
  if (
    !isExpected ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    throw new Error("platform_provisioner_package_entity_invalid");
  }
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
    size: metadata.size,
    mode: metadata.mode,
    uid: metadata.uid,
    gid: metadata.gid,
    mtimeNs: metadata.mtimeNs,
    ctimeNs: metadata.ctimeNs,
  });
}

function sameIdentity(left: EntityIdentity, right: EntityIdentity) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.size === right.size &&
    left.mode === right.mode &&
    left.uid === right.uid &&
    left.gid === right.gid &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function directoryIdentity(target: string) {
  const resolved = path.resolve(target);
  const before = identity(
    fs.lstatSync(resolved, { bigint: true }),
    "directory",
  );
  const real = fs.realpathSync.native(resolved);
  const after = identity(fs.lstatSync(resolved, { bigint: true }), "directory");
  if (real !== resolved || !sameIdentity(before, after)) {
    throw new Error("platform_provisioner_package_root_invalid");
  }
  return Object.freeze({ realPath: real, identity: before });
}

function verifyDirectory(
  snapshot: Readonly<{ realPath: string; identity: EntityIdentity }>,
) {
  const current = identity(
    fs.lstatSync(snapshot.realPath, { bigint: true }),
    "directory",
  );
  if (
    !sameIdentity(snapshot.identity, current) ||
    fs.realpathSync.native(snapshot.realPath) !== snapshot.realPath
  ) {
    throw new Error("platform_provisioner_package_root_changed");
  }
}

function readStableFile(target: string, maximumBytes: number) {
  const pathBefore = identity(fs.lstatSync(target, { bigint: true }), "file");
  if (pathBefore.size < 0n || pathBefore.size > BigInt(maximumBytes)) {
    throw new Error("platform_provisioner_package_file_budget_exceeded");
  }
  const noFollow =
    process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(target, fs.constants.O_RDONLY | noFollow);
    const opened = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    if (!sameIdentity(pathBefore, opened)) {
      throw new Error("platform_provisioner_package_file_changed");
    }
    const hash = createHash("sha256");
    const chunks: Buffer[] = [];
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let byteLength = 0;
    while (true) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      byteLength += count;
      if (byteLength > maximumBytes || BigInt(byteLength) > opened.size) {
        throw new Error("platform_provisioner_package_file_changed");
      }
      const bytes = buffer.subarray(0, count);
      hash.update(bytes);
      if (maximumBytes <= MAXIMUM_PACKAGE_JSON_BYTES) {
        chunks.push(Buffer.from(bytes));
      }
    }
    const after = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    const pathAfter = identity(fs.lstatSync(target, { bigint: true }), "file");
    if (
      BigInt(byteLength) !== opened.size ||
      !sameIdentity(opened, after) ||
      !sameIdentity(opened, pathAfter) ||
      fs.realpathSync.native(target) !== target
    ) {
      throw new Error("platform_provisioner_package_file_changed");
    }
    return Object.freeze({
      byteLength,
      sha256: hash.digest("hex"),
      identity: opened,
      bytes:
        maximumBytes <= MAXIMUM_PACKAGE_JSON_BYTES
          ? Buffer.concat(chunks)
          : null,
    });
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}

function packageEntries(
  root: Readonly<{ realPath: string; identity: EntityIdentity }>,
) {
  const files: string[] = [];
  const directories: Array<
    Readonly<{ realPath: string; identity: EntityIdentity }>
  > = [root];
  const visit = (
    directory: Readonly<{ realPath: string; identity: EntityIdentity }>,
    relativeDirectory: string,
  ) => {
    const entries = fs
      .readdirSync(directory.realPath, { withFileTypes: true })
      .sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
      );
    for (const entry of entries) {
      if (
        relativeDirectory === "" &&
        (entry.name === "node_modules" || entry.name === ".gitignore")
      ) {
        continue;
      }
      if (entry.isSymbolicLink()) {
        throw new Error("platform_provisioner_package_link_rejected");
      }
      const relative = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const target = path.join(directory.realPath, entry.name);
      if (entry.isDirectory()) {
        const child = directoryIdentity(target);
        directories.push(child);
        visit(child, relative);
      } else if (entry.isFile()) files.push(relative);
      else throw new Error("platform_provisioner_package_entity_invalid");
      if (files.length > MAXIMUM_FILES) {
        throw new Error("platform_provisioner_package_file_count_exceeded");
      }
    }
    verifyDirectory(directory);
  };
  visit(root, "");
  return Object.freeze({
    files: Object.freeze(files),
    directories: Object.freeze(directories),
  });
}

function packageMetadata(bytes: Buffer | null) {
  if (!bytes) throw new Error("platform_provisioner_package_metadata_invalid");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) {
    throw new Error("platform_provisioner_package_metadata_invalid");
  }
  const parsed: unknown = JSON.parse(text);
  const metadata = snapshotPlainRecord(
    parsed,
    new Set([
      "name",
      "version",
      "private",
      "type",
      "scripts",
      "engines",
      "devDependencies",
    ]),
  );
  if (
    metadata?.name !== "@qual-lab/crdd-coordinator" ||
    typeof metadata.version !== "string" ||
    metadata.private !== true ||
    metadata.type !== "module"
  ) {
    throw new Error("platform_provisioner_package_metadata_invalid");
  }
  return Object.freeze({
    packageName: metadata.name,
    packageVersion: metadata.version,
  });
}

function observePackage(packageRoot: string) {
  const root = directoryIdentity(packageRoot);
  const inventory = packageEntries(root);
  const paths = inventory.files;
  if (!paths.includes("package.json")) {
    throw new Error("platform_provisioner_package_metadata_missing");
  }
  let packageJsonBytes: Buffer | null = null;
  let packageByteLength = 0;
  const files: ObservedFile[] = [];
  const fileIdentities: EntityIdentity[] = [];
  for (const relative of paths) {
    verifyDirectory(root);
    const maximum =
      relative === "package.json"
        ? MAXIMUM_PACKAGE_JSON_BYTES
        : MAXIMUM_PACKAGE_BYTES - packageByteLength;
    if (maximum < 0) {
      throw new Error("platform_provisioner_package_budget_exceeded");
    }
    const observed = readStableFile(
      path.join(root.realPath, ...relative.split("/")),
      maximum,
    );
    packageByteLength += observed.byteLength;
    fileIdentities.push(observed.identity);
    if (packageByteLength > MAXIMUM_PACKAGE_BYTES) {
      throw new Error("platform_provisioner_package_budget_exceeded");
    }
    if (relative === "package.json") packageJsonBytes = observed.bytes;
    files.push(
      Object.freeze({
        path: relative,
        byteLength: observed.byteLength,
        sha256: observed.sha256,
      }),
    );
  }
  for (const directory of inventory.directories) verifyDirectory(directory);
  const metadata = packageMetadata(packageJsonBytes);
  const observation: PackageObservation = Object.freeze({
    ...metadata,
    files: Object.freeze(files),
  });
  const contentRoot =
    calculatePlatformProvisionerPackageContentRootCandidate(observation);
  if (contentRoot.status !== "candidate") {
    throw new Error("platform_provisioner_package_content_invalid");
  }
  const isPermissionPolicyConfirmed =
    process.platform !== "win32" &&
    inventory.directories.every(
      (directory) =>
        directory.identity.uid === 0n &&
        (directory.identity.mode & 0o7777n) === 0o755n,
    ) &&
    fileIdentities.every(
      (fileIdentity) =>
        fileIdentity.uid === 0n && (fileIdentity.mode & 0o7777n) === 0o644n,
    );
  return Object.freeze({
    observation,
    packageByteLength,
    contentRoot,
    permissionPolicyConfirmed: isPermissionPolicyConfirmed,
  });
}

function publicObservation(
  observed: ReturnType<typeof observePackage>,
  isRuntimeOwnedPackageRoot: boolean,
) {
  return Object.freeze({
    status: "candidate" as const,
    reason: isRuntimeOwnedPackageRoot
      ? observed.permissionPolicyConfirmed
        ? "runtime_owned_package_filesystem_observed_release_trust_and_effect_required"
        : "runtime_owned_package_filesystem_observed_release_trust_permission_and_effect_required"
      : "caller_selected_package_filesystem_observed_non_authoritative",
    packageName: observed.observation.packageName,
    packageVersion: observed.observation.packageVersion,
    packageContentRootSha256: observed.contentRoot.packageContentRootSha256,
    packageFileCount: observed.observation.files.length,
    packageByteLength: observed.packageByteLength,
    stableFilesystemIdentityObserved: true,
    runtimeOwnedPackageRoot: isRuntimeOwnedPackageRoot,
    permissionPolicyConfirmed: observed.permissionPolicyConfirmed,
    runtimeOwnedReleaseTrustConfirmed: false,
    crddDistributionConfirmed: false,
    effectAuthorizationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}

export function inspectPlatformProvisionerPackageFilesystemCandidate(
  packageRoot: unknown,
) {
  try {
    if (typeof packageRoot !== "string" || packageRoot.length === 0) {
      return blocked("platform_provisioner_package_root_invalid");
    }
    return publicObservation(observePackage(packageRoot), false);
  } catch {
    return blocked("platform_provisioner_package_filesystem_invalid");
  }
}

export function inspectBundledCoordinatorPackageFilesystemCandidate() {
  try {
    return publicObservation(observePackage(bundledPackageRoot), true);
  } catch {
    return blocked("platform_provisioner_bundled_package_filesystem_invalid");
  }
}

export function verifyBundledCoordinatorPackageCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, VERIFY_KEYS);
    if (
      !input ||
      typeof input.expectedCrddVersion !== "string" ||
      !CRDD_VERSION.test(input.expectedCrddVersion) ||
      typeof input.expectedCrddCommit !== "string" ||
      !CRDD_GIT_OBJECT_ID.test(input.expectedCrddCommit) ||
      typeof input.expectedCrddTree !== "string" ||
      !CRDD_GIT_OBJECT_ID.test(input.expectedCrddTree)
    ) {
      return blocked("platform_provisioner_bundled_package_input_invalid");
    }
    const observed = observePackage(bundledPackageRoot);
    const verification = verifyPlatformProvisionerManifestCandidate({
      manifestEnvelope: input.manifestEnvelope,
      releaseSignerSpkiDer: input.releaseSignerSpkiDer,
      observedPackageContent: observed.observation,
      evaluationTime: input.evaluationTime,
    });
    if (
      verification.status !== "candidate" ||
      verification.crddVersion !== input.expectedCrddVersion ||
      verification.crddCommit !== input.expectedCrddCommit ||
      verification.crddTree !== input.expectedCrddTree
    ) {
      return blocked(
        "platform_provisioner_bundled_package_verification_failed",
      );
    }
    return Object.freeze({
      ...publicObservation(observed, true),
      reason:
        "runtime_owned_package_filesystem_and_manifest_match_release_identity_permission_and_effect_required",
      manifestHash: verification.manifestHash,
      crddVersion: verification.crddVersion,
      crddCommit: verification.crddCommit,
      crddTree: verification.crddTree,
      qualLabManifestCryptographicMatch: true,
    });
  } catch {
    return blocked("platform_provisioner_bundled_package_input_invalid");
  }
}

export function describePlatformProvisionerPackageFilesystemContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-package-filesystem",
    contractRevision: 1,
    packageRootSelection: "implemented_fixed_module_relative_candidate",
    recursiveFileInventory: "implemented_candidate",
    stableSameHandleFileIdentityAndHash: "implemented_candidate",
    packageContentRootCalculation: "implemented_candidate",
    nodeModulesIncluded: false,
    developmentGitIgnoreIncluded: false,
    maximumFiles: MAXIMUM_FILES,
    maximumPackageBytes: MAXIMUM_PACKAGE_BYTES,
    runtimeOwnedPackageFilesystemRead:
      "implemented_candidate_without_permission_authority",
    runtimeOwnedCrddReleaseIdentitySelection:
      "approved_version_commit_tree_binding_loader_not_implemented",
    runtimeOwnedReleaseTrustSelection:
      "approved_single_ed25519_anchor_not_configured",
    ownerAndPermissionPolicyVerification:
      "posix_implemented_candidate_windows_not_implemented",
    posixRootOwnedDirectory0755AndFile0644Verification: "implemented_candidate",
    windowsSystemAndAdministratorsWriteRuntimeReadAclVerification:
      "not_implemented",
    sourceCheckoutCanAuthorizeProvisioningEffect: false,
    releaseTrustModel:
      "qual_lab_ed25519_single_active_key_pinned_in_verified_crdd_release",
    releaseIdentityBinding:
      "crdd_version_commit_tree_and_coordinator_package_content_root",
    signedManifestPath: "90_Release/coordinator-package-manifest.json",
    releaseTrustAnchorConfiguration: "required_not_configured",
    signedManifestDistribution: "approved_fixed_path_loader_not_implemented",
    effectController: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}
