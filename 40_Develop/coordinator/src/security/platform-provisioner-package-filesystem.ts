import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isRuntimeProcessEffectBlocked,
  isRuntimeProcessPoisoned,
} from "../core/runtime-process-safety-state.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import {
  beginPlatformAccessArtifactSigningObservation,
  verifyPlatformAccessArtifactSigningObservation,
} from "./platform-access-release.ts";
import { loadPlatformProvisionerManifestEnvelopeForVerification } from "./platform-provisioner-manifest-loader.ts";
import { getPlatformProvisionerPolicyIdentity } from "./platform-provisioner-policy-identity.ts";
import { inspectPlatformProvisionerReleaseIdentityCandidate } from "./platform-provisioner-release-identity.ts";
import { getPinnedPlatformProvisionerReleaseSignerSpkiDer } from "./platform-provisioner-release-trust.ts";
import {
  calculatePlatformProvisionerPackageContentRootCandidate,
  verifyPlatformProvisionerManifestCandidate,
} from "./platform-provisioner-trust-core.ts";
import {
  isCanonicalCrddGitObjectId,
  isCanonicalCrddVersion,
} from "./release-identity-grammar.ts";

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
const DEVELOPMENT_SOURCE_KEYS = new Set([
  "distributionRoot",
  "expectedCrddTree",
  "expectedPackageContentRootSha256",
]);
const DEVELOPMENT_ENTRYPOINTS = Object.freeze([
  "bin/coordinator.ts",
  "src/core/interactive-console-reader.ts",
  "src/security/candidate-store-lock-worker.ts",
  "src/security/host-operation-lock-supervisor.ts",
]);
const CANONICAL_TEXT_FILE_SUFFIXES = Object.freeze([
  ".Dockerfile",
  ".json",
  ".policy",
  ".py",
  ".ts",
  ".txt",
]);
const VERIFIED_PACKAGE_CAPABILITY_LIFETIME_MS = 5_000;
type VerifiedPackageIdentity = Readonly<{
  manifestHash: string;
  releaseSequence: number;
  crddCommit: string;
  crddTree: string;
  packageContentRootSha256: string;
  interactiveConsoleReaderArtifactSha256: string;
}>;

function sameVerifiedPackageIdentity(
  left: VerifiedPackageIdentity,
  right: VerifiedPackageIdentity,
) {
  return (
    left.manifestHash === right.manifestHash &&
    left.releaseSequence === right.releaseSequence &&
    left.crddCommit === right.crddCommit &&
    left.crddTree === right.crddTree &&
    left.packageContentRootSha256 === right.packageContentRootSha256 &&
    left.interactiveConsoleReaderArtifactSha256 ===
      right.interactiveConsoleReaderArtifactSha256
  );
}

function createVerifiedPackageCapabilityState() {
  const capabilities = new WeakMap<
    object,
    Readonly<{ issuedAtMs: number; identity: VerifiedPackageIdentity }>
  >();
  return Object.freeze({
    issue: (identity: VerifiedPackageIdentity, issuedAtMs: number) => {
      const capability = Object.freeze({});
      capabilities.set(capability, Object.freeze({ identity, issuedAtMs }));
      return capability;
    },
    consume: (
      capability: unknown,
      current: VerifiedPackageIdentity | null,
      currentMs: number,
    ) => {
      if (!capability || typeof capability !== "object") return false;
      const record = capabilities.get(capability);
      capabilities.delete(capability);
      return Boolean(
        record &&
          current &&
          Number.isFinite(currentMs) &&
          currentMs - record.issuedAtMs >= 0 &&
          currentMs - record.issuedAtMs <
            VERIFIED_PACKAGE_CAPABILITY_LIFETIME_MS &&
          sameVerifiedPackageIdentity(record.identity, current),
      );
    },
  });
}

const verifiedPackageCapabilityState = createVerifiedPackageCapabilityState();

export function createIsolatedVerifiedPackageCapabilityStateCandidate() {
  const state = createVerifiedPackageCapabilityState();
  return Object.freeze({
    issue: state.issue,
    consume: state.consume,
    runtimeAuthorityIssued: false,
    productionConsumerCompatible: false,
  });
}

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
      chunks.push(Buffer.from(bytes));
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
    const rawBytes = Buffer.concat(chunks);
    return Object.freeze({
      byteLength,
      sha256: createHash("sha256").update(rawBytes).digest("hex"),
      identity: opened,
      bytes: rawBytes,
    });
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}

function isCanonicalTextPackagePath(relativePath: string) {
  return CANONICAL_TEXT_FILE_SUFFIXES.some((suffix) =>
    relativePath.endsWith(suffix),
  );
}

function canonicalPackageFileContent(relativePath: string, bytes: Buffer) {
  if (!isCanonicalTextPackagePath(relativePath)) return bytes;
  let crlfCount = 0;
  for (let index = 0; index + 1 < bytes.length; index += 1) {
    if (bytes[index] === 0x0d && bytes[index + 1] === 0x0a) crlfCount += 1;
  }
  if (crlfCount === 0) return bytes;
  const canonical = Buffer.allocUnsafe(bytes.length - crlfCount);
  let output = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 0x0d && bytes[index + 1] === 0x0a) continue;
    canonical[output] = bytes[index] as number;
    output += 1;
  }
  return canonical;
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
  const baseKeys = [
    "name",
    "version",
    "private",
    "type",
    "scripts",
    "engines",
    "devDependencies",
  ];
  const metadata = snapshotPlainRecord(
    parsed,
    new Set([...baseKeys, "exports"]),
  );
  const exportsValue = snapshotPlainRecord(
    metadata?.exports,
    new Set(["./cli"]),
  );
  if (
    metadata?.name !== "@qual-lab/crdd-coordinator" ||
    typeof metadata.version !== "string" ||
    metadata.private !== true ||
    metadata.type !== "module" ||
    exportsValue?.["./cli"] !== "./bin/coordinator.ts"
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
    const canonicalBytes = canonicalPackageFileContent(
      relative,
      observed.bytes,
    );
    if (relative === "package.json") packageJsonBytes = canonicalBytes;
    files.push(
      Object.freeze({
        path: relative,
        byteLength: canonicalBytes.byteLength,
        sha256: createHash("sha256").update(canonicalBytes).digest("hex"),
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

/** Read-only identity evidence; caller-supplied expectations are not authority. */
export function inspectFixedDevelopmentCoordinatorPackageCandidate(
  rawInput: unknown,
) {
  try {
    const input = snapshotPlainRecord(rawInput, DEVELOPMENT_SOURCE_KEYS);
    if (
      !input ||
      typeof input.distributionRoot !== "string" ||
      !path.isAbsolute(input.distributionRoot) ||
      path.normalize(input.distributionRoot) !== input.distributionRoot ||
      typeof input.expectedCrddTree !== "string" ||
      !isCanonicalCrddGitObjectId(input.expectedCrddTree) ||
      typeof input.expectedPackageContentRootSha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(input.expectedPackageContentRootSha256)
    )
      return blocked("development_package_input_invalid");

    const root = directoryIdentity(input.distributionRoot);
    const packageRoot = path.join(root.realPath, "40_Develop", "coordinator");
    const observed = observePackage(packageRoot);
    const distribution = inspectPlatformProvisionerReleaseIdentityCandidate(
      root.realPath,
      input.expectedCrddTree,
    );
    if (
      distribution.status !== "candidate" ||
      observed.contentRoot.packageContentRootSha256 !==
        input.expectedPackageContentRootSha256
    )
      return blocked("development_package_identity_mismatch");
    // A signed manifest changes a repository-contained runtime from a
    // development source into a release distribution. Native artifacts are
    // ordinary signed-tree entries and may be present in either source kind.
    if (distribution.manifestExcludedFromSignedGitTree)
      return blocked("development_package_release_artifact_present");

    const entrypoints = DEVELOPMENT_ENTRYPOINTS.map((entrypoint) =>
      observed.observation.files.find((file) => file.path === entrypoint),
    );
    if (entrypoints.some((entrypoint) => !entrypoint))
      return blocked("development_package_entrypoint_missing");
    const reobserved = observePackage(packageRoot);
    if (
      reobserved.contentRoot.packageContentRootSha256 !==
      observed.contentRoot.packageContentRootSha256
    )
      return blocked("development_package_changed_during_observation");
    verifyDirectory(root);
    const sourceIdentitySha256 = createHash("sha256")
      .update(
        JSON.stringify([
          "crdd-development-source-identity/v1",
          root.realPath,
          root.identity.dev.toString(),
          root.identity.ino.toString(),
          root.identity.birthtimeNs.toString(),
          distribution.crddTree,
          observed.contentRoot.packageContentRootSha256,
        ]),
        "utf8",
      )
      .digest("hex");
    return Object.freeze({
      ...publicObservation(observed, false),
      reason: "fixed_development_package_observed_authorization_required",
      executionSourceKind: "fixed_development_candidate" as const,
      crddTree: distribution.crddTree,
      sourceIdentitySha256,
      entrypoints: Object.freeze(
        entrypoints.map((entrypoint) => {
          if (!entrypoint)
            throw new Error("development_package_entrypoint_missing");
          return Object.freeze({
            relativePath: entrypoint.path,
            sha256: entrypoint.sha256,
          });
        }),
      ),
      releaseIdentityRuntimeOwned: false,
      pathReported: false,
    });
  } catch {
    return blocked("development_package_observation_failed");
  }
}

export function verifyBundledCoordinatorPackageCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, VERIFY_KEYS);
    if (
      !input ||
      typeof input.expectedCrddVersion !== "string" ||
      !isCanonicalCrddVersion(input.expectedCrddVersion) ||
      typeof input.expectedCrddCommit !== "string" ||
      !isCanonicalCrddGitObjectId(input.expectedCrddCommit) ||
      typeof input.expectedCrddTree !== "string" ||
      !isCanonicalCrddGitObjectId(input.expectedCrddTree)
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
      releaseIdentity.manifestExcludedFromSignedGitTree !== true ||
      releaseIdentity.platformAccessExecutableIncludedInSignedGitTree !==
        true ||
      releaseIdentity.gitMetadataExcludedFromSignedGitTree !== true
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
    const interactiveConsoleReaderArtifact = observed.observation.files.find(
      (file) => file.path === "src/core/interactive-console-reader.ts",
    );
    if (!interactiveConsoleReaderArtifact) {
      return blocked("platform_provisioner_interactive_console_reader_missing");
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
      interactiveConsoleReaderArtifactSha256:
        interactiveConsoleReaderArtifact.sha256,
      platformAccessArtifact: verification.platformAccessArtifact,
    });
  } catch {
    return blocked("platform_provisioner_fixed_manifest_verification_failed");
  }
}

function verifiedFixedPackageRecord(
  result: ReturnType<
    typeof verifyBundledCoordinatorPackageFromFixedManifestCandidate
  >,
) {
  if (
    result.status !== "candidate" ||
    typeof result.manifestHash !== "string" ||
    !Number.isSafeInteger(result.releaseSequence) ||
    typeof result.crddCommit !== "string" ||
    typeof result.crddTree !== "string" ||
    typeof result.packageContentRootSha256 !== "string" ||
    typeof result.interactiveConsoleReaderArtifactSha256 !== "string" ||
    result.crddDistributionConfirmed !== true ||
    result.runtimeOwnedReleaseTrustConfirmed !== true
  ) {
    return null;
  }
  return Object.freeze({
    manifestHash: result.manifestHash,
    releaseSequence: result.releaseSequence as number,
    crddCommit: result.crddCommit,
    crddTree: result.crddTree,
    packageContentRootSha256: result.packageContentRootSha256,
    interactiveConsoleReaderArtifactSha256:
      result.interactiveConsoleReaderArtifactSha256,
  });
}

export function issueRuntimeOwnedVerifiedCoordinatorPackageCapability(
  rawInput: unknown,
) {
  if (isRuntimeProcessEffectBlocked()) {
    return Object.freeze({
      verification: blocked(
        isRuntimeProcessPoisoned()
          ? "platform_provisioner_process_restart_required"
          : "platform_provisioner_runtime_cleanup_in_progress",
      ),
      capability: null,
    });
  }
  const input = snapshotPlainRecord(rawInput, VERIFY_FIXED_MANIFEST_KEYS);
  if (!input) {
    return Object.freeze({
      verification: blocked(
        "platform_provisioner_bundled_package_input_invalid",
      ),
      capability: null,
    });
  }
  const verification =
    verifyBundledCoordinatorPackageFromFixedManifestCandidate(input);
  const record = verifiedFixedPackageRecord(verification);
  if (!record) return Object.freeze({ verification, capability: null });
  const capability = verifiedPackageCapabilityState.issue(
    record,
    performance.now(),
  );
  return Object.freeze({ verification, capability });
}

export function consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(
  capability: unknown,
) {
  const current = verifiedFixedPackageRecord(
    verifyBundledCoordinatorPackageFromFixedManifestCandidate({
      evaluationTime: new Date().toISOString(),
    }),
  );
  return verifiedPackageCapabilityState.consume(
    capability,
    current,
    performance.now(),
  );
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
      !isCanonicalCrddVersion(expected.crddVersion) ||
      typeof expected.crddCommit !== "string" ||
      !isCanonicalCrddGitObjectId(expected.crddCommit) ||
      typeof expected.crddTree !== "string" ||
      !isCanonicalCrddGitObjectId(expected.crddTree) ||
      typeof expected.packageContentRootSha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(expected.packageContentRootSha256)
    ) {
      return blocked("platform_provisioner_installed_package_input_invalid");
    }
    const distributionRoot = directoryIdentity(input.distributionRoot);
    const packageRoot = path.join(
      distributionRoot.realPath,
      "40_Develop",
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
    });
  } catch {
    return blocked(
      "platform_provisioner_installed_package_verification_failed",
    );
  }
}

function sameNativeArtifact(
  expected: unknown,
  observed: unknown,
  revisionKey: "protocolRevision" | "entrypointContractRevision",
) {
  const keys = new Set([
    "relativePath",
    "target",
    "rustToolchain",
    "byteLength",
    "sha256",
    revisionKey,
  ]);
  const expectedRecord = snapshotPlainRecord(expected, keys);
  const observedRecord = snapshotPlainRecord(observed, keys);
  return Boolean(
    expectedRecord &&
      observedRecord &&
      [...keys].every((key) => expectedRecord[key] === observedRecord[key]),
  );
}

/** Verifies a separate signed native distribution without executing it. */
export function inspectVerifiedNativeDistributionCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, VERIFY_INSTALLED_KEYS);
    const expected =
      input &&
      snapshotPlainRecord(input.expectedRelease, EXPECTED_RELEASE_KEYS);
    if (
      !input ||
      !expected ||
      typeof input.distributionRoot !== "string" ||
      !path.isAbsolute(input.distributionRoot) ||
      path.normalize(input.distributionRoot) !== input.distributionRoot
    )
      return blocked("native_distribution_input_invalid");
    const root = directoryIdentity(input.distributionRoot);
    const request = { ...input, expectedRelease: expected };
    const release = verifyInstalledCoordinatorPackageCandidate(request);
    if (release.status !== "candidate")
      return blocked("native_distribution_release_not_verified");
    const distribution = inspectPlatformProvisionerReleaseIdentityCandidate(
      root.realPath,
      release.crddTree,
    );
    if (
      distribution.status !== "candidate" ||
      !distribution.manifestExcludedFromSignedGitTree ||
      !distribution.platformAccessExecutableIncludedInSignedGitTree
    )
      return blocked("native_distribution_tree_not_verified");
    const worker = beginPlatformAccessArtifactSigningObservation(root.realPath);
    if (
      !worker ||
      !sameNativeArtifact(
        release.platformAccessArtifact,
        worker.artifact,
        "protocolRevision",
      ) ||
      !verifyPlatformAccessArtifactSigningObservation(worker.token)
    )
      return blocked("native_distribution_artifact_not_verified");
    const reverified = verifyInstalledCoordinatorPackageCandidate(request);
    if (reverified.status !== "candidate")
      return blocked("native_distribution_changed_during_observation");
    verifyDirectory(root);
    const nativeIdentitySha256 = createHash("sha256")
      .update(
        JSON.stringify([
          "crdd-native-distribution-identity/v1",
          root.realPath,
          root.identity.dev.toString(),
          root.identity.ino.toString(),
          root.identity.birthtimeNs.toString(),
          release.manifestHash,
          release.crddTree,
          worker.artifact.sha256,
        ]),
        "utf8",
      )
      .digest("hex");
    return Object.freeze({
      status: "candidate" as const,
      reason:
        "signed_native_distribution_observed_execution_authorization_required",
      nativeIdentitySha256,
      manifestHash: release.manifestHash,
      crddTree: release.crddTree,
      nativeReleaseSignatureVerified: true,
      platformAccessArtifact: worker.artifact,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
      processEffectIssued: false,
      pathReported: false,
    });
  } catch {
    return blocked("native_distribution_observation_failed");
  }
}

export function describePlatformProvisionerPackageFilesystemContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-package-filesystem",
    contractRevision: 6,
    packageRootSelection: "implemented_fixed_module_relative_candidate",
    recursiveFileInventory: "implemented_candidate",
    stableSameHandleFileIdentityAndHash: "implemented_candidate",
    packageContentRootCalculation:
      "implemented_canonical_lf_for_declared_repository_text_and_raw_bytes_for_other_files",
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
    unsignedOrModifiedCheckoutCanAuthorizeProvisioningEffect: false,
    repositoryContainedOfficialReleaseCanAuthorizeProvisioningEffect: true,
    releaseTrustModel:
      "qual_lab_ed25519_single_active_key_pinned_in_verified_crdd_release",
    releaseIdentityBinding:
      "crdd_version_commit_tree_and_coordinator_package_content_root",
    taskRuntimeCapability:
      "single_use_process_private_exact_release_package_and_reader_identity",
    taskGateAuthority:
      "held_alone_grants_no_operation_console_filesystem_provider_or_network_authority",
    processPoisonGate: "before_manifest_package_filesystem_observation",
    policyIdentityBinding:
      "owned_root_protection_and_key_storage_policy_hashes_required",
    signedManifestPath:
      "template/tools/coordinator/coordinator-package-manifest.json",
    releaseTrustAnchorConfiguration: "configured_immutable_source_literal",
    signedManifestDistribution:
      "implemented_fixed_path_canonical_file_loader_candidate",
    signedManifestPlacement:
      "release_commit_adds_only_manifest_to_signed_parent_git_tree",
    nativeArtifactsInSignedGitTree: true,
    exactRootGitMetadataExcludedFromSignedGitTree: true,
    releaseIdentityRollbackFloorPersistence: "implemented_candidate",
    releaseIdentityRollbackFloorTransition: "implemented_candidate",
    effectController: "not_implemented_effective_access_required",
    installedReleaseReverification: "not_implemented_effective_access_required",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}
