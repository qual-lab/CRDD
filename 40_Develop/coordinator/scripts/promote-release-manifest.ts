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
  promoteReleaseManifestBytes,
  ReleaseManifestPromotionError,
  verifyPromotedReleaseManifestBytes,
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
  const stagingManifest = path.join(
    distributionRoot,
    ...PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH.split("/"),
  );
  const manifestRoot = pathDoesNotExist(stagingManifest)
    ? repositoryRoot
    : distributionRoot;
  const loaded =
    loadPlatformProvisionerManifestEnvelopeForVerification(manifestRoot);
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
  const nativeRoot =
    manifestRoot === repositoryRoot ? repositoryRoot : distributionRoot;
  const native = inspectVerifiedNativeDistributionCandidate({
    distributionRoot: nativeRoot,
    evaluationTime,
    expectedRelease: expected,
  });
  const tree = inspectPlatformProvisionerReleaseIdentityCandidate(
    manifestRoot,
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
  expectedManifestFileSha256: string,
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
  const destinationAbsent = pathDoesNotExist(destination);
  if (
    repository?.status !== "candidate" ||
    repository.commit !== expected.crddCommit ||
    repository.tree !== expected.crddTree ||
    tree.status !== "candidate" ||
    tree.manifestExcludedFromSignedGitTree !== !destinationAbsent ||
    tree.platformAccessExecutableIncludedInSignedGitTree !== true ||
    (!destinationAbsent &&
      loadPlatformProvisionerManifestEnvelopeForVerification(repositoryRoot)
        .manifestFileSha256 !== expectedManifestFileSha256)
  )
    throw new Error("release_manifest_promotion_source_a_invalid");
}

type PromotionRelease = ReturnType<typeof expectedRelease>;
type PromotionComposition = Readonly<{
  inspectRelease: (
    distributionRoot: string,
    evaluationTime: string,
  ) => PromotionRelease;
  verifyRepository: (
    phase: "before" | "after",
    release: PromotionRelease,
    distributionRoot: string,
    evaluationTime: string,
  ) => boolean;
}>;

export function executeReleaseManifestPromotionCompositionForVerification(
  distributionRoot: string,
  destinationRepositoryRoot: string,
  evaluationTime: string,
  composition: PromotionComposition,
) {
  const release = composition.inspectRelease(distributionRoot, evaluationTime);
  if (
    !composition.verifyRepository(
      "before",
      release,
      distributionRoot,
      evaluationTime,
    )
  )
    throw new Error("release_manifest_promotion_source_a_invalid");
  const session = beginReleaseManifestPromotionSession(
    distributionRoot,
    destinationRepositoryRoot,
    release.manifestFileSha256,
  );
  if (!session || session.sourceSha256 !== release.manifestFileSha256)
    throw new Error("release_manifest_promotion_session_invalid");
  const promoted = promoteReleaseManifestBytes(session.token);
  try {
    if (
      promoted.manifestFileSha256 !== release.manifestFileSha256 ||
      !composition.verifyRepository(
        "after",
        release,
        distributionRoot,
        evaluationTime,
      ) ||
      !verifyPromotedReleaseManifestBytes(session.token)
    )
      throw new Error("release_manifest_promotion_postcondition_failed");
    return Object.freeze({
      contract: "crdd-coordinator/release-manifest-promotion-result",
      contractRevision: 2,
      status: "promoted" as const,
      sourceCommit: release.expected.crddCommit,
      sourceTree: release.expected.crddTree,
      manifestRelativePath: promoted.manifestRelativePath,
      manifestFileSha256: promoted.manifestFileSha256,
      byteLength: promoted.byteLength,
      repositoryFilesystemEffectIssued:
        promoted.repositoryFilesystemEffectIssued,
      cleanupConfirmed: true as const,
      stagingManifestDisposition: promoted.stagingManifestDisposition,
      runtimeAuthorityConferred: false as const,
      runtimeCapabilityIssued: false as const,
    });
  } catch (error) {
    throw new ReleaseManifestPromotionError(
      promoted.repositoryFilesystemEffectIssued,
      false,
      true,
      { cause: error },
    );
  }
}

const productionComposition: PromotionComposition = Object.freeze({
  inspectRelease: expectedRelease,
  verifyRepository(phase, release, _distributionRoot, evaluationTime) {
    if (phase === "before") {
      verifySourceA(release.expected, release.manifestFileSha256);
      return true;
    }
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
    return (
      repository?.commit === release.expected.crddCommit &&
      repository.tree === release.expected.crddTree &&
      installed.status === "candidate" &&
      tree.status === "candidate" &&
      tree.manifestExcludedFromSignedGitTree === true &&
      loaded.manifestFileSha256 === release.manifestFileSha256
    );
  },
});

export function promoteVerifiedReleaseManifest(distributionRootInput: unknown) {
  const evaluationTime = new Date().toISOString();
  const distributionRoot = stableStagingRoot(distributionRootInput);
  return executeReleaseManifestPromotionCompositionForVerification(
    distributionRoot,
    repositoryRoot,
    evaluationTime,
    productionComposition,
  );
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
        ? `${error.message}:${String(error.repositoryFilesystemEffectIssued)}:${String(error.cleanupConfirmed)}:${String(error.reentryRequired)}`
        : error instanceof Error
          ? error.message
          : "release_manifest_promotion_failed";
    process.stderr.write(`${reason}\n`);
    process.exitCode = 1;
  }
}
