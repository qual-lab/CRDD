import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH } from "./platform-provisioner-manifest-loader.ts";

const MAXIMUM_DISTRIBUTION_FILES = 2_048;
const MAXIMUM_DISTRIBUTION_BYTES = 64 * 1024 * 1024;
const GIT_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;

type HashAlgorithm = "sha1" | "sha256";

type StableIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  mtimeNs: bigint;
  size: bigint;
  mode: bigint;
}>;

type TreeEntry = Readonly<{
  name: string;
  isDirectory: boolean;
  mode: "40000" | "100644" | "100755";
  objectId: Buffer;
}>;

function identity(metadata: fs.BigIntStats): StableIdentity {
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
    mtimeNs: metadata.mtimeNs,
    size: metadata.size,
    mode: metadata.mode,
  });
}

function sameIdentity(left: StableIdentity, right: StableIdentity) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.mtimeNs === right.mtimeNs &&
    left.size === right.size &&
    left.mode === right.mode
  );
}

function hashAlgorithm(expectedTree: string): HashAlgorithm | null {
  if (!GIT_OBJECT_ID.test(expectedTree)) return null;
  return expectedTree.length === 40 ? "sha1" : "sha256";
}

function gitObjectId(
  algorithm: HashAlgorithm,
  type: "blob" | "tree",
  bytes: Buffer,
) {
  const header = Buffer.from(`${type} ${bytes.length}\0`, "ascii");
  return createHash(algorithm).update(header).update(bytes).digest();
}

function validEntryName(name: string) {
  return (
    name.length > 0 &&
    name !== "." &&
    name !== ".." &&
    !name.includes("\0") &&
    !name.includes("/") &&
    !name.includes("\\")
  );
}

function stableFileBytes(target: string, remainingBytes: number) {
  const beforeMetadata = fs.lstatSync(target, { bigint: true });
  const before = identity(beforeMetadata);
  if (
    !beforeMetadata.isFile() ||
    beforeMetadata.isSymbolicLink() ||
    before.size < 0n ||
    before.size > BigInt(remainingBytes) ||
    fs.realpathSync.native(target) !== target
  ) {
    throw new Error("platform_provisioner_distribution_file_invalid");
  }
  const noFollow =
    process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
  const descriptor = fs.openSync(target, fs.constants.O_RDONLY | noFollow);
  try {
    const opened = identity(fs.fstatSync(descriptor, { bigint: true }));
    if (!sameIdentity(before, opened)) {
      throw new Error("platform_provisioner_distribution_file_changed");
    }
    const bytes = Buffer.alloc(Number(opened.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        null,
      );
      if (count === 0) break;
      offset += count;
    }
    const after = identity(fs.fstatSync(descriptor, { bigint: true }));
    const pathAfter = identity(fs.lstatSync(target, { bigint: true }));
    if (
      offset !== bytes.length ||
      !sameIdentity(opened, after) ||
      !sameIdentity(opened, pathAfter) ||
      fs.realpathSync.native(target) !== target
    ) {
      throw new Error("platform_provisioner_distribution_file_changed");
    }
    return Object.freeze({ bytes, mode: opened.mode });
  } finally {
    fs.closeSync(descriptor);
  }
}

function gitSortName(entry: TreeEntry) {
  return Buffer.from(`${entry.name}${entry.isDirectory ? "/" : ""}`, "utf8");
}

function encodeTree(entries: readonly TreeEntry[]) {
  const orderedEntries = [...entries].sort((left, right) =>
    Buffer.compare(gitSortName(left), gitSortName(right)),
  );
  return Buffer.concat(
    orderedEntries.flatMap((entry) => [
      Buffer.from(`${entry.mode} ${entry.name}\0`, "utf8"),
      entry.objectId,
    ]),
  );
}

function isExcludedPostCheckoutManifest(relativePath: string) {
  return relativePath === PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH;
}

function observeDistributionTree(
  distributionRoot: string,
  expectedTree: string,
) {
  if (
    typeof distributionRoot !== "string" ||
    distributionRoot.length === 0 ||
    !path.isAbsolute(distributionRoot) ||
    distributionRoot.includes("\0")
  ) {
    throw new Error("platform_provisioner_distribution_root_invalid");
  }
  const algorithm = hashAlgorithm(expectedTree);
  if (!algorithm) {
    throw new Error("platform_provisioner_distribution_tree_invalid");
  }
  const root = path.resolve(distributionRoot);
  const rootMetadata = fs.lstatSync(root, { bigint: true });
  const rootIdentity = identity(rootMetadata);
  if (
    !rootMetadata.isDirectory() ||
    rootMetadata.isSymbolicLink() ||
    fs.realpathSync.native(root) !== root
  ) {
    throw new Error("platform_provisioner_distribution_root_invalid");
  }
  let fileCount = 0;
  let byteLength = 0;
  let excludedManifestCount = 0;
  const walk = (directory: string, relativeDirectory: string): Buffer => {
    const beforeMetadata = fs.lstatSync(directory, { bigint: true });
    const before = identity(beforeMetadata);
    if (
      !beforeMetadata.isDirectory() ||
      beforeMetadata.isSymbolicLink() ||
      fs.realpathSync.native(directory) !== directory
    ) {
      throw new Error("platform_provisioner_distribution_directory_invalid");
    }
    const names = fs.readdirSync(directory);
    const entries: TreeEntry[] = [];
    for (const name of names) {
      if (!validEntryName(name) || name === ".git") {
        throw new Error("platform_provisioner_distribution_entry_invalid");
      }
      const relative = relativeDirectory
        ? `${relativeDirectory}/${name}`
        : name;
      if (isExcludedPostCheckoutManifest(relative)) {
        excludedManifestCount += 1;
        if (excludedManifestCount > 1) {
          throw new Error("platform_provisioner_distribution_manifest_invalid");
        }
        const manifestPath = path.join(directory, name);
        const manifestMetadata = fs.lstatSync(manifestPath);
        if (
          !manifestMetadata.isFile() ||
          manifestMetadata.isSymbolicLink() ||
          fs.realpathSync.native(manifestPath) !== manifestPath
        ) {
          throw new Error("platform_provisioner_distribution_manifest_invalid");
        }
        continue;
      }
      const target = path.join(directory, name);
      const metadata = fs.lstatSync(target, { bigint: true });
      if (metadata.isSymbolicLink()) {
        throw new Error("platform_provisioner_distribution_link_rejected");
      }
      if (metadata.isDirectory()) {
        entries.push(
          Object.freeze({
            name,
            isDirectory: true,
            mode: "40000" as const,
            objectId: walk(target, relative),
          }),
        );
        continue;
      }
      if (!metadata.isFile()) {
        throw new Error("platform_provisioner_distribution_entry_invalid");
      }
      fileCount += 1;
      if (fileCount > MAXIMUM_DISTRIBUTION_FILES) {
        throw new Error("platform_provisioner_distribution_budget_exceeded");
      }
      const observed = stableFileBytes(
        target,
        MAXIMUM_DISTRIBUTION_BYTES - byteLength,
      );
      byteLength += observed.bytes.length;
      if (byteLength > MAXIMUM_DISTRIBUTION_BYTES) {
        throw new Error("platform_provisioner_distribution_budget_exceeded");
      }
      const isExecutable =
        process.platform !== "win32" && (observed.mode & 0o111n) !== 0n;
      entries.push(
        Object.freeze({
          name,
          isDirectory: false,
          mode: isExecutable ? ("100755" as const) : ("100644" as const),
          objectId: gitObjectId(algorithm, "blob", observed.bytes),
        }),
      );
    }
    const after = identity(fs.lstatSync(directory, { bigint: true }));
    if (
      !sameIdentity(before, after) ||
      fs.realpathSync.native(directory) !== directory
    ) {
      throw new Error("platform_provisioner_distribution_directory_changed");
    }
    return gitObjectId(algorithm, "tree", encodeTree(entries));
  };
  const tree = walk(root, "").toString("hex");
  const rootAfter = identity(fs.lstatSync(root, { bigint: true }));
  if (
    !sameIdentity(rootIdentity, rootAfter) ||
    fs.realpathSync.native(root) !== root
  ) {
    throw new Error("platform_provisioner_distribution_root_changed");
  }
  return Object.freeze({
    tree,
    fileCount,
    byteLength,
    manifestExcludedFromTree: excludedManifestCount === 1,
  });
}

export function inspectPlatformProvisionerReleaseIdentityCandidate(
  distributionRoot: unknown,
  expectedCrddTree: unknown,
) {
  try {
    if (
      typeof distributionRoot !== "string" ||
      typeof expectedCrddTree !== "string"
    ) {
      throw new Error("platform_provisioner_release_identity_input_invalid");
    }
    const observed = observeDistributionTree(
      distributionRoot,
      expectedCrddTree,
    );
    if (observed.tree !== expectedCrddTree) {
      return Object.freeze({
        status: "blocked" as const,
        reason: "platform_provisioner_release_tree_mismatch",
        crddTree: observed.tree,
        distributionFileCount: observed.fileCount,
        distributionByteLength: observed.byteLength,
        postCheckoutManifestExcludedFromGitTree:
          observed.manifestExcludedFromTree,
        releaseIdentityRuntimeOwned: false,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
        filesystemEffectIssued: false,
        networkEffectIssued: false,
      });
    }
    return Object.freeze({
      status: "candidate" as const,
      reason:
        "crdd_distribution_tree_matches_signed_release_identity_candidate",
      crddTree: observed.tree,
      distributionFileCount: observed.fileCount,
      distributionByteLength: observed.byteLength,
      postCheckoutManifestExcludedFromGitTree:
        observed.manifestExcludedFromTree,
      releaseIdentityRuntimeOwned: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "platform_provisioner_release_identity_invalid",
      crddTree: null,
      distributionFileCount: null,
      distributionByteLength: null,
      postCheckoutManifestExcludedFromGitTree: false,
      releaseIdentityRuntimeOwned: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
    });
  }
}

export function describePlatformProvisionerReleaseIdentityContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-release-identity",
    contractRevision: 1,
    hashAlgorithms: Object.freeze(["SHA-1", "SHA-256"]),
    gitObjectEncoding: "blob_and_recursive_tree_object_identity",
    regularFileModes: Object.freeze(["100644", "100755"]),
    directoryMode: "40000",
    maximumDistributionFiles: MAXIMUM_DISTRIBUTION_FILES,
    maximumDistributionBytes: MAXIMUM_DISTRIBUTION_BYTES,
    postCheckoutManifestExcludedFromGitTree:
      PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
    gitMetadataAllowedInDistribution: false,
    symbolicLinkOrReparseFallbackAllowed: false,
    stableSameHandleFileRead: "implemented_candidate",
    stableDirectoryIdentityRevalidation: "implemented_candidate",
    signedCrddTreeComparison: "implemented_candidate_non_authoritative",
    signedCommitAttestationVerification:
      "requires_fixed_manifest_path_and_pinned_release_signature",
    rollbackFloorPersistence: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}
