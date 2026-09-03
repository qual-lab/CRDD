import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadPlatformProvisionerManifestEnvelopeForVerification,
  PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
} from "../src/security/platform-provisioner-manifest-loader.ts";
import { inspectVerifiedNativeDistributionCandidate } from "../src/security/platform-provisioner-package-filesystem.ts";
import { inspectPlatformProvisionerReleaseIdentityCandidate } from "../src/security/platform-provisioner-release-identity.ts";
import { getPinnedPlatformProvisionerReleaseSignerSpkiDer } from "../src/security/platform-provisioner-release-trust.ts";
import {
  compilePlatformProvisionerManifestPayloadCandidate,
  verifyHistoricalPlatformProvisionerManifestCandidate,
} from "../src/security/platform-provisioner-trust-core.ts";
import { inspectRepositoryIdentityCandidate } from "../src/security/repository-operation-runtime.ts";
import {
  beginReleaseManifestPromotionSession,
  discardPromotedReleaseManifestBytes,
  promoteReleaseManifestBytes,
  ReleaseManifestPromotionError,
} from "./release-manifest-promotion.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const releaseStagingRoot = path.join(
  repositoryRoot,
  ".crdd",
  "release-staging",
);
const candidateName = /^[a-z0-9][a-z0-9-]{0,127}$/u;

function stableStagingRoot(value: unknown) {
  if (typeof value !== "string" || !path.isAbsolute(value))
    throw new Error("release_manifest_promotion_staging_root_invalid");
  const resolved = path.resolve(value);
  const parent = fs.realpathSync.native(path.dirname(resolved));
  const metadata = fs.lstatSync(resolved);
  if (
    parent !== fs.realpathSync.native(releaseStagingRoot) ||
    !candidateName.test(path.basename(resolved)) ||
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(resolved) !== resolved
  )
    throw new Error("release_manifest_promotion_staging_root_invalid");
  return resolved;
}

function pathDoesNotExist(target: string) {
  try {
    fs.lstatSync(target);
    return false;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return true;
    throw new Error("release_manifest_promotion_destination_unobservable");
  }
}

function expectedRelease(distributionRoot: string, evaluationTime: string) {
  const loaded =
    loadPlatformProvisionerManifestEnvelopeForVerification(distributionRoot);
  const historical = verifyHistoricalPlatformProvisionerManifestCandidate(
    loaded.envelope,
    getPinnedPlatformProvisionerReleaseSignerSpkiDer(),
  );
  if (!historical?.historicalSignatureVerified)
    throw new Error("release_manifest_promotion_signature_invalid");
  const compiled = compilePlatformProvisionerManifestPayloadCandidate({
    manifestPayload: historical.payload,
  });
  if (compiled.status !== "candidate")
    throw new Error("release_manifest_promotion_payload_invalid");
  const payload = compiled.payload;
  const expected = Object.freeze({
    manifestHash: compiled.manifestHash,
    releaseSequence: payload.releaseSequence,
    crddVersion: payload.crddVersion,
    crddCommit: payload.crddCommit,
    crddTree: payload.crddTree,
    packageContentRootSha256: payload.packageContentRootSha256,
    runtimeExecutionIdentitySha256: payload.runtimeExecutionIdentitySha256,
  });
  const native = inspectVerifiedNativeDistributionCandidate({
    distributionRoot,
    evaluationTime,
    expectedRelease: expected,
  });
  const tree = inspectPlatformProvisionerReleaseIdentityCandidate(
    distributionRoot,
    payload.crddTree,
  );
  if (
    native.status !== "candidate" ||
    tree.status !== "candidate" ||
    tree.manifestExcludedFromSignedGitTree !== true ||
    tree.platformAccessExecutableIncludedInSignedGitTree !== true
  )
    throw new Error("release_manifest_promotion_distribution_invalid");
  return Object.freeze({
    expected,
    manifestFileSha256: loaded.manifestFileSha256,
  });
}

function verifySourceA(
  expected: ReturnType<typeof expectedRelease>["expected"],
) {
  const repository = inspectRepositoryIdentityCandidate(repositoryRoot);
  const tree = inspectPlatformProvisionerReleaseIdentityCandidate(
    repositoryRoot,
    expected.crddTree,
  );
  const destination = path.join(
    repositoryRoot,
    ...PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH.split("/"),
  );
  if (
    repository?.status !== "candidate" ||
    repository.commit !== expected.crddCommit ||
    repository.tree !== expected.crddTree ||
    tree.status !== "candidate" ||
    tree.manifestExcludedFromSignedGitTree !== false ||
    tree.platformAccessExecutableIncludedInSignedGitTree !== true ||
    !pathDoesNotExist(destination)
  )
    throw new Error("release_manifest_promotion_source_a_invalid");
}

export function promoteVerifiedReleaseManifest(distributionRootInput: unknown) {
  const evaluationTime = new Date().toISOString();
  const distributionRoot = stableStagingRoot(distributionRootInput);
  const release = expectedRelease(distributionRoot, evaluationTime);
  verifySourceA(release.expected);
  const session = beginReleaseManifestPromotionSession(
    distributionRoot,
    repositoryRoot,
  );
  if (!session || session.sourceSha256 !== release.manifestFileSha256)
    throw new Error("release_manifest_promotion_session_invalid");
  const promoted = promoteReleaseManifestBytes(session.token);
  try {
    const repository = inspectRepositoryIdentityCandidate(repositoryRoot);
    const installed = inspectVerifiedNativeDistributionCandidate({
      distributionRoot: repositoryRoot,
      evaluationTime,
      expectedRelease: release.expected,
    });
    const tree = inspectPlatformProvisionerReleaseIdentityCandidate(
      repositoryRoot,
      release.expected.crddTree,
    );
    const loaded =
      loadPlatformProvisionerManifestEnvelopeForVerification(repositoryRoot);
    if (
      repository?.commit !== release.expected.crddCommit ||
      repository.tree !== release.expected.crddTree ||
      installed.status !== "candidate" ||
      tree.status !== "candidate" ||
      tree.manifestExcludedFromSignedGitTree !== true ||
      loaded.manifestFileSha256 !== release.manifestFileSha256 ||
      loaded.manifestFileSha256 !== promoted.manifestFileSha256
    )
      throw new Error("release_manifest_promotion_postcondition_failed");
    return Object.freeze({
      contract: "crdd-coordinator/release-manifest-promotion-result",
      contractRevision: 1,
      status: "promoted" as const,
      sourceCommit: release.expected.crddCommit,
      sourceTree: release.expected.crddTree,
      manifestRelativePath: promoted.manifestRelativePath,
      manifestFileSha256: promoted.manifestFileSha256,
      byteLength: promoted.byteLength,
      repositoryFilesystemEffectIssued: true as const,
      cleanupConfirmed: true as const,
      runtimeAuthorityConferred: false as const,
      runtimeCapabilityIssued: false as const,
    });
  } catch {
    const cleanupConfirmed = discardPromotedReleaseManifestBytes(session.token);
    throw new ReleaseManifestPromotionError(true, cleanupConfirmed);
  }
}

function parseArguments(args: readonly string[]) {
  if (args.length !== 2 || args[0] !== "--distribution-root" || !args[1])
    throw new Error("release_manifest_promotion_arguments_invalid");
  return args[1];
}

async function main() {
  const result = promoteVerifiedReleaseManifest(
    parseArguments(process.argv.slice(2)),
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    const reason =
      error instanceof ReleaseManifestPromotionError
        ? `${error.message}:${String(error.repositoryFilesystemEffectIssued)}:${String(error.cleanupConfirmed)}`
        : error instanceof Error
          ? error.message
          : "release_manifest_promotion_failed";
    process.stderr.write(`${reason}\n`);
    process.exitCode = 1;
  }
}
