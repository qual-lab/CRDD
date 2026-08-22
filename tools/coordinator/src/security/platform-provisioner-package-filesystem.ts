import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { loadPlatformProvisionerManifestEnvelopeForVerification } from "./platform-provisioner-manifest-loader.ts";
import { getPlatformProvisionerPolicyIdentity } from "./platform-provisioner-policy-identity.ts";
import { inspectPlatformProvisionerReleaseIdentityCandidate } from "./platform-provisioner-release-identity.ts";
import { getPinnedPlatformProvisionerReleaseSignerSpkiDer } from "./platform-provisioner-release-trust.ts";
import {
  calculatePlatformProvisionerPackageContentRootCandidate,
  verifyPlatformProvisionerManifestCandidate,
} from "./platform-provisioner-trust-core.ts";

const bundledPackageRoot = fileURLToPath(new URL("../../", import.meta.url));
const bundledDistributionRoot = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const MAXIMUM_FILES = 2_048;
const MAXIMUM_PACKAGE_BYTES = 64 * 1024 * 1024;
const MAXIMUM_PACKAGE_JSON_BYTES = 64 * 1024;
const VERIFY_KEYS = new Set([
  "manifestEnvelope",
  "evaluationTime",
  "expectedCrddVersion",
  "expectedCrddCommit",
  "expectedCrddTree",
]);
const VERIFY_FIXED_MANIFEST_KEYS = new Set(["evaluationTime"]);
const VERIFY_INSTALLED_KEYS = new Set([
  "distributionRoot",
  "evaluationTime",
  "expectedRelease",
]);
const EXPECTED_RELEASE_KEYS = new Set([
  "manifestHash",
  "releaseSequence",
  "crddVersion",
  "crddCommit",
  "crddTree",
  "packageContentRootSha256",
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
    releaseSequence: null,
    stableFilesystemIdentityObserved: false,
    runtimeOwnedPackageRoot: false,
    permissionPolicyConfirmed: false,
    windowsWritePolicyConfirmed: false,
    runtimeOwnedReleaseTrustConfirmed: false,
    releaseIdentityRuntimeOwned: false,
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

type DirectoryEntrySnapshot = Readonly<{
  name: string;
  type: "directory" | "file";
}>;

function readDirectoryEntrySnapshot(target: string) {
  const dirents = fs
    .readdirSync(target, { withFileTypes: true })
    .sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
  const entries = dirents.map((entry): DirectoryEntrySnapshot => {
    if (entry.isSymbolicLink()) {
      throw new Error("platform_provisioner_package_link_rejected");
    }
    if (entry.isDirectory()) {
      return Object.freeze({ name: entry.name, type: "directory" });
    }
    if (entry.isFile()) {
      return Object.freeze({ name: entry.name, type: "file" });
    }
    throw new Error("platform_provisioner_package_entity_invalid");
  });
  return Object.freeze({
    dirents: Object.freeze(dirents),
    entries: Object.freeze(entries),
  });
}

function sameDirectoryEntries(
  leftEntries: readonly DirectoryEntrySnapshot[],
  rightEntries: readonly DirectoryEntrySnapshot[],
) {
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(
      (entry, index) =>
        entry.name === rightEntries[index]?.name &&
        entry.type === rightEntries[index]?.type,
    )
  );
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
  const directoryInventories: Array<
    Readonly<{
      directory: Readonly<{ realPath: string; identity: EntityIdentity }>;
      entries: readonly DirectoryEntrySnapshot[];
    }>
  > = [];
  const visit = (
    directory: Readonly<{ realPath: string; identity: EntityIdentity }>,
    relativeDirectory: string,
  ) => {
    const snapshot = readDirectoryEntrySnapshot(directory.realPath);
    directoryInventories.push(
      Object.freeze({ directory, entries: snapshot.entries }),
    );
    for (const entry of snapshot.dirents) {
      if (
        relativeDirectory === "" &&
        (entry.name === "node_modules" || entry.name === ".gitignore")
      ) {
        continue;
      }
      const relative = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const target = path.join(directory.realPath, entry.name);
      if (entry.isDirectory()) {
        const child = directoryIdentity(target);
        visit(child, relative);
      } else if (entry.isFile()) files.push(relative);
      if (files.length > MAXIMUM_FILES) {
        throw new Error("platform_provisioner_package_file_count_exceeded");
      }
    }
    verifyDirectory(directory);
  };
  visit(root, "");
  return Object.freeze({
    files: Object.freeze(files),
    directories: Object.freeze(
      directoryInventories.map((inventory) => inventory.directory),
    ),
    directoryInventories: Object.freeze(directoryInventories),
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
  for (const inventoryEntry of inventory.directoryInventories) {
    verifyDirectory(inventoryEntry.directory);
    const current = readDirectoryEntrySnapshot(
      inventoryEntry.directory.realPath,
    );
    if (!sameDirectoryEntries(inventoryEntry.entries, current.entries)) {
      throw new Error("platform_provisioner_package_root_changed");
    }
  }
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
    windowsWritePolicyConfirmed: false,
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
    windowsWritePolicyConfirmed: observed.windowsWritePolicyConfirmed,
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
    const { observed, verification } = verifyOwnedBundledManifest(
      input.manifestEnvelope,
      input.evaluationTime,
    );
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
      releaseSequence: verification.releaseSequence,
      crddCommit: verification.crddCommit,
      crddTree: verification.crddTree,
      qualLabManifestCryptographicMatch: true,
      runtimeOwnedReleaseTrustConfirmed: true,
      platformAccessArtifact: verification.platformAccessArtifact,
      nativeProvisionSupervisorArtifact:
        verification.nativeProvisionSupervisorArtifact,
    });
  } catch {
    return blocked("platform_provisioner_bundled_package_input_invalid");
  }
}

function verifyOwnedBundledManifest(
  manifestEnvelope: unknown,
  evaluationTime: unknown,
) {
  const observed = observePackage(bundledPackageRoot);
  const policyIdentity = getPlatformProvisionerPolicyIdentity();
  const verification = verifyPlatformProvisionerManifestCandidate({
    manifestEnvelope,
    releaseSignerSpkiDer: getPinnedPlatformProvisionerReleaseSignerSpkiDer(),
    observedPackageContent: observed.observation,
    evaluationTime,
  });
  if (
    verification.status !== "candidate" ||
    verification.rootProtectionPolicySha256 !==
      policyIdentity.rootProtectionPolicySha256 ||
    verification.keyStoragePolicySha256 !==
      policyIdentity.keyStoragePolicySha256
  ) {
    throw new Error("platform_provisioner_owned_manifest_verification_failed");
  }
  return Object.freeze({ observed, verification });
}

export function verifyBundledCoordinatorPackageFromFixedManifestCandidate(
  rawInput: unknown,
) {
  try {
    const input = snapshotPlainRecord(rawInput, VERIFY_FIXED_MANIFEST_KEYS);
    if (!input) {
      return blocked("platform_provisioner_bundled_package_input_invalid");
    }
    const loaded = loadPlatformProvisionerManifestEnvelopeForVerification(
      bundledDistributionRoot,
    );
    const { observed, verification } = verifyOwnedBundledManifest(
      loaded.envelope,
      input.evaluationTime,
    );
    const releaseIdentity = inspectPlatformProvisionerReleaseIdentityCandidate(
      bundledDistributionRoot,
      verification.crddTree,
    );
    if (
      releaseIdentity.status !== "candidate" ||
      releaseIdentity.postCheckoutManifestExcludedFromGitTree !== true ||
      releaseIdentity.postCheckoutPlatformAccessExecutableExcludedFromGitTree !==
        true ||
      releaseIdentity.postCheckoutNativeProvisionSupervisorExecutableExcludedFromGitTree !==
        true
    ) {
      return blocked(
        "platform_provisioner_release_identity_verification_failed",
      );
    }
    const reloaded = loadPlatformProvisionerManifestEnvelopeForVerification(
      bundledDistributionRoot,
    );
    if (reloaded.manifestFileSha256 !== loaded.manifestFileSha256) {
      return blocked(
        "platform_provisioner_manifest_changed_during_verification",
      );
    }
    return Object.freeze({
      ...publicObservation(observed, true),
      reason: observed.permissionPolicyConfirmed
        ? "verified_crdd_distribution_and_package_permission_effect_controller_required"
        : "verified_crdd_distribution_and_package_permission_and_effect_controller_required",
      manifestHash: verification.manifestHash,
      crddVersion: verification.crddVersion,
      releaseSequence: verification.releaseSequence,
      crddCommit: verification.crddCommit,
      crddTree: verification.crddTree,
      qualLabManifestCryptographicMatch: true,
      runtimeOwnedReleaseTrustConfirmed: true,
      releaseIdentityRuntimeOwned: true,
      crddDistributionConfirmed: true,
      platformAccessArtifact: verification.platformAccessArtifact,
      nativeProvisionSupervisorArtifact:
        verification.nativeProvisionSupervisorArtifact,
    });
  } catch {
    return blocked("platform_provisioner_fixed_manifest_verification_failed");
  }
}

export function verifyInstalledCoordinatorPackageCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, VERIFY_INSTALLED_KEYS);
    const expected =
      input &&
      snapshotPlainRecord(input.expectedRelease, EXPECTED_RELEASE_KEYS);
    if (
      !input ||
      !expected ||
      typeof input.distributionRoot !== "string" ||
      typeof expected.manifestHash !== "string" ||
      !/^[0-9a-f]{64}$/u.test(expected.manifestHash) ||
      typeof expected.releaseSequence !== "number" ||
      !Number.isSafeInteger(expected.releaseSequence) ||
      expected.releaseSequence < 1 ||
      typeof expected.crddVersion !== "string" ||
      !CRDD_VERSION.test(expected.crddVersion) ||
      typeof expected.crddCommit !== "string" ||
      !CRDD_GIT_OBJECT_ID.test(expected.crddCommit) ||
      typeof expected.crddTree !== "string" ||
      !CRDD_GIT_OBJECT_ID.test(expected.crddTree) ||
      typeof expected.packageContentRootSha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(expected.packageContentRootSha256)
    ) {
      return blocked("platform_provisioner_installed_package_input_invalid");
    }
    const distributionRoot = directoryIdentity(input.distributionRoot);
    const packageRoot = path.join(
      distributionRoot.realPath,
      "tools",
      "coordinator",
    );
    const observed = observePackage(packageRoot);
    const loaded = loadPlatformProvisionerManifestEnvelopeForVerification(
      distributionRoot.realPath,
    );
    const policyIdentity = getPlatformProvisionerPolicyIdentity();
    const verification = verifyPlatformProvisionerManifestCandidate({
      manifestEnvelope: loaded.envelope,
      releaseSignerSpkiDer: getPinnedPlatformProvisionerReleaseSignerSpkiDer(),
      observedPackageContent: observed.observation,
      evaluationTime: input.evaluationTime,
    });
    verifyDirectory(distributionRoot);
    if (
      verification.status !== "candidate" ||
      verification.rootProtectionPolicySha256 !==
        policyIdentity.rootProtectionPolicySha256 ||
      verification.keyStoragePolicySha256 !==
        policyIdentity.keyStoragePolicySha256 ||
      verification.manifestHash !== expected.manifestHash ||
      verification.releaseSequence !== expected.releaseSequence ||
      verification.crddVersion !== expected.crddVersion ||
      verification.crddCommit !== expected.crddCommit ||
      verification.crddTree !== expected.crddTree ||
      verification.packageContentRootSha256 !==
        expected.packageContentRootSha256
    ) {
      return blocked(
        "platform_provisioner_installed_package_verification_failed",
      );
    }
    return Object.freeze({
      ...publicObservation(observed, false),
      reason:
        "installed_package_matches_verified_crdd_release_effect_controller_required",
      manifestHash: verification.manifestHash,
      crddVersion: verification.crddVersion,
      releaseSequence: verification.releaseSequence,
      crddCommit: verification.crddCommit,
      crddTree: verification.crddTree,
      qualLabManifestCryptographicMatch: true,
      runtimeOwnedReleaseTrustConfirmed: true,
      releaseIdentityRuntimeOwned: false,
      crddDistributionConfirmed: true,
      platformAccessArtifact: verification.platformAccessArtifact,
      nativeProvisionSupervisorArtifact:
        verification.nativeProvisionSupervisorArtifact,
    });
  } catch {
    return blocked(
      "platform_provisioner_installed_package_verification_failed",
    );
  }
}

export function describePlatformProvisionerPackageFilesystemContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-package-filesystem",
    contractRevision: 2,
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
      "implemented_fixed_manifest_signature_and_distribution_git_tree_candidate",
    runtimeOwnedReleaseTrustSelection:
      "implemented_single_ed25519_anchor_pinned",
    ownerAndPermissionPolicyVerification:
      "posix_implemented_candidate_windows_effective_access_not_implemented",
    posixRootOwnedDirectory0755AndFile0644Verification: "implemented_candidate",
    windowsSystemAndAdministratorsWriteRuntimeReadAclVerification:
      "not_implemented_effective_access_required",
    sourceCheckoutCanAuthorizeProvisioningEffect: false,
    releaseTrustModel:
      "qual_lab_ed25519_single_active_key_pinned_in_verified_crdd_release",
    releaseIdentityBinding:
      "crdd_version_commit_tree_and_coordinator_package_content_root",
    policyIdentityBinding:
      "owned_root_protection_and_key_storage_policy_hashes_required",
    signedManifestPath: "90_Release/coordinator-package-manifest.json",
    releaseTrustAnchorConfiguration: "configured_immutable_source_literal",
    signedManifestDistribution:
      "implemented_fixed_path_canonical_file_loader_candidate",
    signedManifestPlacement:
      "post_checkout_distribution_artifact_outside_identified_git_tree",
    releaseIdentityRollbackFloorPersistence: "implemented_candidate",
    releaseIdentityRollbackFloorTransition: "implemented_candidate",
    effectController: "not_implemented_effective_access_required",
    installedReleaseReverification: "not_implemented_effective_access_required",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}
