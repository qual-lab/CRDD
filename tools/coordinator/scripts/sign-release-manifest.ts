import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readHiddenLine } from "./generate-release-key.ts";
import { observePlatformAccessReleaseArtifactCandidate } from "../src/security/platform-access-release.ts";
import { inspectPlatformProvisionerPackageFilesystemCandidate } from "../src/security/platform-provisioner-package-filesystem.ts";
import { getPlatformProvisionerPolicyIdentity } from "../src/security/platform-provisioner-policy-identity.ts";
import { inspectPlatformProvisionerReleaseIdentityCandidate } from "../src/security/platform-provisioner-release-identity.ts";
import { getPinnedPlatformProvisionerReleaseSignerSpkiDer } from "../src/security/platform-provisioner-release-trust.ts";
import {
  compilePlatformProvisionerManifestPayloadCandidate,
  PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_REVISION,
} from "../src/security/platform-provisioner-trust-core.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../src/security/provisioning-signature-primitives.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const MANIFEST_RELATIVE_PATH = "90_Release/coordinator-package-manifest.json";
const MAXIMUM_PRIVATE_KEY_BYTES = 16 * 1024;
const MAXIMUM_PASSPHRASE_BYTES = 1_024;

type ManifestOptions = Readonly<{
  distributionRoot: string;
  privateKeyPath: string;
  passphrase: string;
  crddVersion: string;
  releaseSequence: number;
  crddCommit: string;
  crddTree: string;
  issuedAt: string;
  expiresAt: string;
}>;

function isContainedBy(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function stableExternalFile(target: string, maximumBytes: number) {
  if (!path.isAbsolute(target) || target.includes("\0")) {
    throw new Error("release_manifest_private_key_path_invalid");
  }
  const resolved = path.resolve(target);
  const metadata = fs.lstatSync(resolved, { bigint: true });
  const real = fs.realpathSync.native(resolved);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    real !== resolved ||
    metadata.size <= 0n ||
    metadata.size > BigInt(maximumBytes) ||
    isContainedBy(fs.realpathSync.native(repositoryRoot), resolved)
  ) {
    throw new Error("release_manifest_private_key_path_invalid");
  }
  const noFollow =
    process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
  const descriptor = fs.openSync(resolved, fs.constants.O_RDONLY | noFollow);
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (
      opened.dev !== metadata.dev ||
      opened.ino !== metadata.ino ||
      opened.birthtimeNs !== metadata.birthtimeNs ||
      opened.size !== metadata.size
    ) {
      throw new Error("release_manifest_private_key_changed");
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
    const after = fs.fstatSync(descriptor, { bigint: true });
    const pathAfter = fs.lstatSync(resolved, { bigint: true });
    if (
      offset !== bytes.length ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.birthtimeNs !== opened.birthtimeNs ||
      after.size !== opened.size ||
      after.mtimeNs !== opened.mtimeNs ||
      pathAfter.dev !== opened.dev ||
      pathAfter.ino !== opened.ino ||
      pathAfter.birthtimeNs !== opened.birthtimeNs ||
      pathAfter.size !== opened.size ||
      fs.realpathSync.native(resolved) !== resolved
    ) {
      throw new Error("release_manifest_private_key_changed");
    }
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

function externalDistributionRoot(target: string) {
  if (!path.isAbsolute(target) || target.includes("\0")) {
    throw new Error("release_manifest_distribution_root_invalid");
  }
  const resolved = path.resolve(target);
  const metadata = fs.lstatSync(resolved);
  const real = fs.realpathSync.native(resolved);
  const realRepositoryRoot = fs.realpathSync.native(repositoryRoot);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    real !== resolved ||
    isContainedBy(realRepositoryRoot, resolved) ||
    isContainedBy(resolved, realRepositoryRoot)
  ) {
    throw new Error("release_manifest_distribution_root_invalid");
  }
  return resolved;
}

function signingPassphrase(rawPassphrase: unknown) {
  if (
    typeof rawPassphrase !== "string" ||
    rawPassphrase.length === 0 ||
    Buffer.byteLength(rawPassphrase, "utf8") > MAXIMUM_PASSPHRASE_BYTES
  ) {
    throw new Error("release_manifest_passphrase_invalid");
  }
  return Buffer.from(rawPassphrase, "utf8");
}

function verifyCommitTreeBinding(crddCommit: string, crddTree: string) {
  const resolveRevision = (revision: string) =>
    execFileSync("git", ["rev-parse", "--verify", revision], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 4_096,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  const verifiedCommit = resolveRevision(`${crddCommit}^{commit}`);
  const verifiedTree = resolveRevision(`${crddCommit}^{tree}`);
  if (verifiedCommit !== crddCommit || verifiedTree !== crddTree) {
    throw new Error("release_manifest_commit_tree_mismatch");
  }
}

export function signReleaseManifest(options: ManifestOptions) {
  const distributionRoot = externalDistributionRoot(options.distributionRoot);
  const packageRoot = path.join(distributionRoot, "tools", "coordinator");
  const releaseDirectory = path.join(distributionRoot, "90_Release");
  const manifestPath = path.join(
    distributionRoot,
    ...MANIFEST_RELATIVE_PATH.split("/"),
  );
  const releaseDirectoryMetadata = fs.lstatSync(releaseDirectory);
  if (
    !releaseDirectoryMetadata.isDirectory() ||
    releaseDirectoryMetadata.isSymbolicLink() ||
    fs.realpathSync.native(releaseDirectory) !== releaseDirectory ||
    fs.existsSync(manifestPath)
  ) {
    throw new Error("release_manifest_output_path_invalid");
  }
  const packageObservation =
    inspectPlatformProvisionerPackageFilesystemCandidate(packageRoot);
  const platformAccessArtifact =
    observePlatformAccessReleaseArtifactCandidate(distributionRoot);
  if (
    packageObservation.status !== "candidate" ||
    platformAccessArtifact.status !== "candidate" ||
    !platformAccessArtifact.artifact
  ) {
    throw new Error("release_manifest_package_observation_failed");
  }
  const policyIdentity = getPlatformProvisionerPolicyIdentity();
  const compiled = compilePlatformProvisionerManifestPayloadCandidate({
    manifestPayload: {
      contract: PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
      contractRevision: PLATFORM_PROVISIONER_MANIFEST_REVISION,
      packageName: packageObservation.packageName,
      packageVersion: packageObservation.packageVersion,
      crddVersion: options.crddVersion,
      releaseSequence: options.releaseSequence,
      crddCommit: options.crddCommit,
      crddTree: options.crddTree,
      packageContentRootSha256: packageObservation.packageContentRootSha256,
      platformAccessArtifact: platformAccessArtifact.artifact,
      ...policyIdentity,
      issuedAt: options.issuedAt,
      expiresAt: options.expiresAt,
    },
  });
  if (compiled.status !== "candidate") {
    throw new Error("release_manifest_payload_invalid");
  }
  const passphrase = signingPassphrase(options.passphrase);
  let privateKeyBytes: Buffer | null = null;
  try {
    privateKeyBytes = stableExternalFile(
      options.privateKeyPath,
      MAXIMUM_PRIVATE_KEY_BYTES,
    );
    const privateKey = createPrivateKey({
      key: privateKeyBytes,
      format: "pem",
      passphrase,
    });
    const signerSpki = createPublicKey(privateKey).export({
      type: "spki",
      format: "der",
    });
    const pinnedSpki = getPinnedPlatformProvisionerReleaseSignerSpkiDer();
    if (!signerSpki.equals(pinnedSpki)) {
      throw new Error("release_manifest_private_key_not_pinned");
    }
    const releaseIdentity = inspectPlatformProvisionerReleaseIdentityCandidate(
      distributionRoot,
      options.crddTree,
    );
    if (
      releaseIdentity.status !== "candidate" ||
      releaseIdentity.postCheckoutManifestExcludedFromGitTree !== false ||
      releaseIdentity.postCheckoutPlatformAccessExecutableExcludedFromGitTree !==
        true
    ) {
      throw new Error("release_manifest_distribution_tree_mismatch");
    }
    verifyCommitTreeBinding(options.crddCommit, options.crddTree);
    const signature = sign(null, compiled.message, privateKey);
    const envelope = {
      contract: PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
      contractRevision: PLATFORM_PROVISIONER_MANIFEST_REVISION,
      payload: compiled.payload,
      signatures: [
        {
          keyId: createHash("sha256").update(signerSpki).digest("hex"),
          algorithm: "Ed25519",
          signature: signature.toString("base64url"),
        },
      ],
    };
    const canonical = canonicalizeProvisioningJsonValueCandidate(envelope);
    if (canonical.status !== "candidate") {
      throw new Error("release_manifest_envelope_invalid");
    }
    fs.writeFileSync(manifestPath, canonical.canonicalBytes, {
      flag: "wx",
      mode: 0o644,
    });
    return Object.freeze({
      status: "created" as const,
      manifestRelativePath: MANIFEST_RELATIVE_PATH,
      manifestHash: compiled.manifestHash,
      packageContentRootSha256: packageObservation.packageContentRootSha256,
      platformAccessExecutableSha256: platformAccessArtifact.artifact.sha256,
      crddVersion: options.crddVersion,
      releaseSequence: options.releaseSequence,
      crddCommit: options.crddCommit,
      crddTree: options.crddTree,
      distributionTreeVerifiedBeforeSigning: true,
      privateKeyStoredOutsideRepository: true,
      repositoryTreeContainsManifest: false,
    });
  } finally {
    passphrase.fill(0);
    privateKeyBytes?.fill(0);
  }
}

function parseArguments(args: readonly string[]) {
  const names = [
    "--distribution-root",
    "--private-key",
    "--crdd-version",
    "--release-sequence",
    "--crdd-commit",
    "--crdd-tree",
    "--issued-at",
    "--expires-at",
  ] as const;
  if (args.length !== names.length * 2) {
    throw new Error("release_manifest_arguments_invalid");
  }
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name || !value || !names.includes(name as (typeof names)[number])) {
      throw new Error("release_manifest_arguments_invalid");
    }
    if (values.has(name)) throw new Error("release_manifest_arguments_invalid");
    values.set(name, value);
  }
  const read = (name: (typeof names)[number]) => {
    const value = values.get(name);
    if (!value) throw new Error("release_manifest_arguments_invalid");
    return value;
  };
  return Object.freeze({
    distributionRoot: read("--distribution-root"),
    privateKeyPath: read("--private-key"),
    crddVersion: read("--crdd-version"),
    releaseSequence: (() => {
      const value = Number(read("--release-sequence"));
      if (!Number.isSafeInteger(value) || value < 1) {
        throw new Error("release_manifest_arguments_invalid");
      }
      return value;
    })(),
    crddCommit: read("--crdd-commit"),
    crddTree: read("--crdd-tree"),
    issuedAt: read("--issued-at"),
    expiresAt: read("--expires-at"),
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const passphrase = await readHiddenLine("Release key passphrase: ");
  const result = signReleaseManifest({ ...options, passphrase });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : "release_manifest_signing_failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
