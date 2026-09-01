import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH } from "./platform-provisioner-manifest-loader.ts";
import { PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH } from "./platform-access-release.ts";
import { isCanonicalCrddGitObjectId } from "./release-identity-grammar.ts";

const MAXIMUM_DISTRIBUTION_FILES = 2_048;
const MAXIMUM_DISTRIBUTION_BYTES = 64 * 1024 * 1024;

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
  if (!isCanonicalCrddGitObjectId(expectedTree)) return null;
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

function canonicalDistributionFileBytes(relativePath: string, bytes: Buffer) {
  if (relativePath.endsWith(".exe")) return bytes;
  // The repository declares `* text=auto eol=lf`. Match Git's text=auto
  // binary heuristic: a NUL in the first 8 KiB keeps the blob byte-exact.
  if (bytes.subarray(0, 8_000).includes(0x00)) return bytes;
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

function isExcludedPostCheckoutArtifact(relativePath: string) {
  return relativePath === PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH;
}

function verifyRepositoryMetadataEntry(target: string) {
  const metadata = fs.lstatSync(target);
  if (
    metadata.isSymbolicLink() ||
    (!metadata.isFile() && !metadata.isDirectory()) ||
    fs.realpathSync.native(target) !== target
  ) {
    throw new Error("platform_provisioner_distribution_git_metadata_invalid");
  }
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
  const excludedPostCheckoutArtifacts = new Set<string>();
  const excludedRepositoryMetadata = new Set<string>();
  const includedSignedArtifacts = new Set<string>();
  const walk = (directory: string, relativeDirectory: string) => {
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
      if (!validEntryName(name)) {
        throw new Error("platform_provisioner_distribution_entry_invalid");
      }
      const relative = relativeDirectory
        ? `${relativeDirectory}/${name}`
        : name;
      if (relative === ".git") {
        if (excludedRepositoryMetadata.has(relative)) {
          throw new Error(
            "platform_provisioner_distribution_git_metadata_invalid",
          );
        }
        verifyRepositoryMetadataEntry(path.join(directory, name));
        excludedRepositoryMetadata.add(relative);
        continue;
      }
      if (isExcludedPostCheckoutArtifact(relative)) {
        if (excludedPostCheckoutArtifacts.has(relative)) {
          throw new Error("platform_provisioner_distribution_manifest_invalid");
        }
        excludedPostCheckoutArtifacts.add(relative);
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
        const child = walk(target, relative);
        if (child.hasEntries) {
          entries.push(
            Object.freeze({
              name,
              isDirectory: true,
              mode: "40000" as const,
              objectId: child.objectId,
            }),
          );
        }
        continue;
      }
      if (!metadata.isFile()) {
        throw new Error("platform_provisioner_distribution_entry_invalid");
      }
      if (relative === PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH) {
        includedSignedArtifacts.add(relative);
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
      const canonicalBytes = canonicalDistributionFileBytes(
        relative,
        observed.bytes,
      );
      entries.push(
        Object.freeze({
          name,
          isDirectory: false,
          mode: isExecutable ? ("100755" as const) : ("100644" as const),
          objectId: gitObjectId(algorithm, "blob", canonicalBytes),
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
    return Object.freeze({
      hasEntries: entries.length > 0,
      objectId: gitObjectId(algorithm, "tree", encodeTree(entries)),
    });
  };
  const tree = walk(root, "").objectId.toString("hex");
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
    manifestExcludedFromTree: excludedPostCheckoutArtifacts.has(
      PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
    ),
    platformAccessExecutableIncludedInTree: includedSignedArtifacts.has(
      PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
    ),
    gitMetadataExcludedFromTree: excludedRepositoryMetadata.has(".git"),
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
        manifestExcludedFromSignedGitTree: observed.manifestExcludedFromTree,
        platformAccessExecutableIncludedInSignedGitTree:
          observed.platformAccessExecutableIncludedInTree,
        gitMetadataExcludedFromSignedGitTree:
          observed.gitMetadataExcludedFromTree,
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
      manifestExcludedFromSignedGitTree: observed.manifestExcludedFromTree,
      platformAccessExecutableIncludedInSignedGitTree:
        observed.platformAccessExecutableIncludedInTree,
      gitMetadataExcludedFromSignedGitTree:
        observed.gitMetadataExcludedFromTree,
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
      manifestExcludedFromSignedGitTree: false,
      platformAccessExecutableIncludedInSignedGitTree: false,
      gitMetadataExcludedFromSignedGitTree: false,
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
    contractRevision: 3,
    hashAlgorithms: Object.freeze(["SHA-1", "SHA-256"]),
    gitObjectEncoding: "blob_and_recursive_tree_object_identity",
    regularFileModes: Object.freeze(["100644", "100755"]),
    directoryMode: "40000",
    maximumDistributionFiles: MAXIMUM_DISTRIBUTION_FILES,
    maximumDistributionBytes: MAXIMUM_DISTRIBUTION_BYTES,
    manifestExcludedFromSignedGitTree:
      PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
    platformAccessExecutableIncludedInSignedGitTree:
      PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
    gitMetadataInDistribution:
      "exact_root_git_entry_validated_and_excluded_from_signed_tree",
    symbolicLinkOrReparseFallbackAllowed: false,
    stableSameHandleFileRead: "implemented_candidate",
    checkoutLineEndingIdentity:
      "git_text_auto_canonical_lf_and_raw_bytes_for_binary_artifacts",
    stableDirectoryIdentityRevalidation: "implemented_candidate",
    signedCrddTreeComparison: "implemented_candidate_non_authoritative",
    signedCommitAttestationVerification:
      "requires_fixed_manifest_path_and_pinned_release_signature",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}
