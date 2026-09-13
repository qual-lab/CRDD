import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";
import {
  preflightPrivateKeyReference,
  readHiddenLine,
  readPrivateKeyReferenceFromEnvironmentFile,
  signEd25519Payload,
  type PrivateKeyReferenceAuthorization,
} from "../../artifact-signing/src/index.ts";
import { resolveBundledRepositoryRuntimeDataPathsForProtectedSigning } from "../../runtime-data/src/platform/runtime-data-path-resolver.ts";
import { inspectRepositoryFixedSnapshot } from "../../version-control/src/git/fixed-snapshot-adapter.ts";
import { verifyRepositoryRoot } from "../../version-control/src/repository-location.ts";
import { assertSupportedCoordinatorNodeRuntime } from "../src/core/node-runtime-version.ts";
import { inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate } from "../src/security/platform-provisioner-package-filesystem.ts";
import { getPlatformProvisionerPolicyIdentity } from "../src/security/platform-provisioner-policy-identity.ts";
import { inspectPlatformProvisionerReleaseIdentityCandidate } from "../src/security/platform-provisioner-release-identity.ts";
import { getPinnedPlatformProvisionerReleaseSignerSpkiDer } from "../src/security/platform-provisioner-release-trust.ts";
import {
  calculateRuntimeExecutionIdentityCandidate,
  compilePlatformProvisionerManifestPayloadCandidate,
  PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_REVISION,
} from "../src/security/platform-provisioner-trust-core.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../src/security/provisioning-signature-primitives.ts";
import {
  isCanonicalCrddUtcTimestamp,
  isCanonicalCrddVersion,
  isSupportedCrddRuntimeGitObjectId,
} from "../src/security/release-identity-grammar.ts";
import {
  beginReleaseStagingManifestSession,
  placeReleaseStagingManifestCandidate,
  verifyReleaseStagingManifestSession,
} from "./release-staging-manifest.ts";

const repositoryRoot = path.resolve(
  fileURLToPath(new URL("../../../", import.meta.url)),
);
const runtimeDataPaths =
  resolveBundledRepositoryRuntimeDataPathsForProtectedSigning() ??
  (() => {
    throw new Error("release_manifest_repository_root_invalid");
  })();
if (runtimeDataPaths.repositoryRoot !== repositoryRoot)
  throw new Error("release_manifest_repository_root_invalid");
const releaseStagingRoot = runtimeDataPaths.release;
const MAXIMUM_PRIVATE_KEY_BYTES = 16 * 1024;
const RELEASE_PRIVATE_KEY_PATH_NAME = "CRDD_RELEASE_PRIVATE_KEY_PATH";
const RELEASE_CANDIDATE_DIRECTORY = /^[a-z0-9][a-z0-9-]{0,127}$/u;
const MANIFEST_PREFLIGHT_OPTION_KEYS = Object.freeze([
  "distributionRoot",
  "privateKeyPath",
  "crddVersion",
  "releaseSequence",
  "crddCommit",
  "crddTree",
  "issuedAt",
  "expiresAt",
] as const);

type ManifestOptions = Readonly<{
  distributionRoot: string;
  privateKeyPath: string;
  passphrase: string;
  crddVersion: string;
  releaseSequence: number;
  crddCommit: string;
  crddTree: string;
  issuedAt: string;
  expiresAt: string | null;
}>;

type ManifestPreflightOptions = Omit<ManifestOptions, "passphrase">;

export type ReleaseManifestPreflightAuthorization = Readonly<{
  contract: "crdd-coordinator/release-manifest-preflight-authorization";
  contractRevision: 1;
}>;

type AuthorizedReleaseManifestPreflight = Readonly<{
  options: ManifestPreflightOptions;
  privateKeyAuthorization: PrivateKeyReferenceAuthorization;
  consumed: boolean;
}>;

const authorizedReleaseManifestPreflights = new WeakMap<
  ReleaseManifestPreflightAuthorization,
  AuthorizedReleaseManifestPreflight
>();

function snapshotManifestPreflightOptions(
  value: unknown,
): ManifestPreflightOptions {
  if (
    typeof value !== "object" ||
    value === null ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new Error("release_manifest_options_invalid");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.length !== MANIFEST_PREFLIGHT_OPTION_KEYS.length ||
    keys.some(
      (key) =>
        typeof key !== "string" ||
        !MANIFEST_PREFLIGHT_OPTION_KEYS.includes(
          key as (typeof MANIFEST_PREFLIGHT_OPTION_KEYS)[number],
        ),
    ) ||
    MANIFEST_PREFLIGHT_OPTION_KEYS.some((key) => {
      const descriptor = descriptors[key];
      return !descriptor || !("value" in descriptor);
    })
  )
    throw new Error("release_manifest_options_invalid");
  return Object.freeze(
    Object.fromEntries(
      MANIFEST_PREFLIGHT_OPTION_KEYS.map((key) => [
        key,
        descriptors[key]?.value,
      ]),
    ) as ManifestPreflightOptions,
  );
}

function repositoryLocalDistributionRoot(target: string) {
  if (!path.isAbsolute(target) || target.includes("\0")) {
    throw new Error("release_manifest_distribution_root_invalid");
  }
  try {
    const resolved = path.resolve(target);
    const metadata = fs.lstatSync(resolved);
    const real = fs.realpathSync.native(resolved);
    const localRoot = runtimeDataPaths.root;
    const localRootMetadata = fs.lstatSync(localRoot);
    const stagingRootMetadata = fs.lstatSync(releaseStagingRoot);
    const realLocalRoot = fs.realpathSync.native(localRoot);
    const realStagingRoot = fs.realpathSync.native(releaseStagingRoot);
    const relativeCandidate = path.relative(realStagingRoot, real);
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      real !== resolved ||
      !localRootMetadata.isDirectory() ||
      localRootMetadata.isSymbolicLink() ||
      realLocalRoot !== runtimeDataPaths.root ||
      !stagingRootMetadata.isDirectory() ||
      stagingRootMetadata.isSymbolicLink() ||
      realStagingRoot !== path.join(realLocalRoot, "release") ||
      path.dirname(relativeCandidate) !== "." ||
      !RELEASE_CANDIDATE_DIRECTORY.test(relativeCandidate) ||
      fs.existsSync(path.join(real, ".git"))
    ) {
      throw new Error("release_manifest_distribution_root_invalid");
    }
    return resolved;
  } catch {
    throw new Error("release_manifest_distribution_root_invalid");
  }
}

function verifyCommitTreeBinding(crddCommit: string, crddTree: string) {
  const verified = verifyRepositoryRoot(repositoryRoot);
  if (verified.status !== "completed")
    throw new Error("release_manifest_repository_root_invalid");
  const identity = inspectRepositoryFixedSnapshot(
    verified.capability,
    crddCommit,
  );
  if (
    identity?.status !== "observed" ||
    identity.revisionIdentity !== crddCommit ||
    identity.snapshotIdentity !== crddTree
  ) {
    throw new Error("release_manifest_commit_tree_mismatch");
  }
}

function assertSupportedReleaseGitObjectFormat(
  crddCommit: string,
  crddTree: string,
) {
  if (
    !isSupportedCrddRuntimeGitObjectId(crddCommit) ||
    !isSupportedCrddRuntimeGitObjectId(crddTree)
  ) {
    throw new Error("release_manifest_git_object_format_unsupported");
  }
}

function assertReleaseManifestStaticOptions(options: ManifestPreflightOptions) {
  if (
    !path.isAbsolute(options.distributionRoot) ||
    options.distributionRoot.includes("\0")
  ) {
    throw new Error("release_manifest_distribution_root_invalid");
  }
  if (
    !path.isAbsolute(options.privateKeyPath) ||
    options.privateKeyPath.includes("\0")
  ) {
    throw new Error("release_manifest_private_key_path_invalid");
  }
  if (
    !Number.isSafeInteger(options.releaseSequence) ||
    options.releaseSequence < 1
  ) {
    throw new Error("release_manifest_release_sequence_invalid");
  }
  if (!isCanonicalCrddVersion(options.crddVersion)) {
    throw new Error("release_manifest_crdd_version_invalid");
  }
  if (
    !isCanonicalCrddUtcTimestamp(options.issuedAt) ||
    (options.expiresAt !== null &&
      !isCanonicalCrddUtcTimestamp(options.expiresAt))
  ) {
    throw new Error("release_manifest_time_invalid");
  }
  if (
    options.expiresAt !== null &&
    Date.parse(options.expiresAt) <= Date.parse(options.issuedAt)
  ) {
    throw new Error("release_manifest_validity_window_invalid");
  }
}

function prepareReleaseManifestCandidate(options: ManifestPreflightOptions) {
  assertSupportedReleaseGitObjectFormat(options.crddCommit, options.crddTree);
  assertReleaseManifestStaticOptions(options);
  const distributionRoot = repositoryLocalDistributionRoot(
    options.distributionRoot,
  );
  const packageObservation =
    inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(
      distributionRoot,
    );
  const platformAccessObservation =
    beginReleaseStagingManifestSession(distributionRoot);
  if (packageObservation.status !== "candidate" || !platformAccessObservation) {
    throw new Error("release_manifest_package_observation_failed");
  }
  const policyIdentity = getPlatformProvisionerPolicyIdentity();
  const runtimeExecutionIdentity = calculateRuntimeExecutionIdentityCandidate({
    packageName: packageObservation.packageName,
    packageVersion: packageObservation.packageVersion,
    packageContentRootSha256: packageObservation.packageContentRootSha256,
    platformAccessArtifact: platformAccessObservation.platformAccessArtifact,
    ...policyIdentity,
  });
  if (runtimeExecutionIdentity.status !== "candidate") {
    throw new Error("release_manifest_runtime_execution_identity_invalid");
  }
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
      runtimeExecutionIdentitySha256:
        runtimeExecutionIdentity.runtimeExecutionIdentitySha256,
      platformAccessArtifact: platformAccessObservation.platformAccessArtifact,
      ...policyIdentity,
      issuedAt: options.issuedAt,
      expiresAt: options.expiresAt,
    },
  });
  if (compiled.status !== "candidate") {
    throw new Error("release_manifest_payload_invalid");
  }
  const releaseIdentity = inspectPlatformProvisionerReleaseIdentityCandidate(
    distributionRoot,
    options.crddTree,
  );
  if (
    releaseIdentity.status !== "candidate" ||
    releaseIdentity.manifestExcludedFromSignedGitTree !== false ||
    releaseIdentity.platformAccessExecutableIncludedInSignedGitTree !== true ||
    releaseIdentity.gitMetadataExcludedFromSignedGitTree !== false
  ) {
    throw new Error("release_manifest_distribution_tree_mismatch");
  }
  verifyCommitTreeBinding(options.crddCommit, options.crddTree);
  if (!verifyReleaseStagingManifestSession(platformAccessObservation.token)) {
    throw new Error("release_manifest_artifact_changed_before_signing");
  }
  return Object.freeze({
    distributionRoot,
    packageObservation,
    platformAccessObservation,
    compiled,
  });
}

export function preflightReleaseManifest(options: ManifestPreflightOptions) {
  const snapshot = snapshotManifestPreflightOptions(options);
  prepareReleaseManifestCandidate(snapshot);
  let privateKeyAuthorization: PrivateKeyReferenceAuthorization;
  try {
    privateKeyAuthorization = preflightPrivateKeyReference({
      privateKeyPath: snapshot.privateKeyPath,
      prohibitedRoot: repositoryRoot,
      maximumBytes: MAXIMUM_PRIVATE_KEY_BYTES,
    });
  } catch {
    throw new Error("release_manifest_private_key_path_invalid");
  }
  const authorization = Object.freeze({
    contract:
      "crdd-coordinator/release-manifest-preflight-authorization" as const,
    contractRevision: 1 as const,
  });
  authorizedReleaseManifestPreflights.set(
    authorization,
    Object.freeze({
      options: snapshot,
      privateKeyAuthorization,
      consumed: false,
    }),
  );
  return Object.freeze({
    contract: "crdd-coordinator/release-manifest-preflight-result",
    contractRevision: 1,
    status: "candidate" as const,
    passphraseRead: false,
    privateKeyRead: false,
    releaseStagingFilesystemEffectIssued: false,
    authorization,
  });
}

export function signReleaseManifest(
  authorization: ReleaseManifestPreflightAuthorization,
  rawPassphrase: unknown,
) {
  const authorized = authorizedReleaseManifestPreflights.get(authorization);
  if (!authorized || authorized.consumed) {
    throw new Error("release_manifest_preflight_authorization_invalid");
  }
  authorizedReleaseManifestPreflights.set(
    authorization,
    Object.freeze({
      options: authorized.options,
      privateKeyAuthorization: authorized.privateKeyAuthorization,
      consumed: true,
    }),
  );
  const options = authorized.options;
  const { packageObservation, platformAccessObservation, compiled } =
    prepareReleaseManifestCandidate(options);

  // The passphrase and private key are acquired only after the independent
  // signing-time observation has completed in full.
  try {
    const pinnedSpki = getPinnedPlatformProvisionerReleaseSignerSpkiDer();
    const signature = signEd25519Payload({
      authorization: authorized.privateKeyAuthorization,
      payload: compiled.message,
      passphrase: rawPassphrase,
      expectedPublicKeySpki: pinnedSpki,
      prohibitedRoot: repositoryRoot,
      maximumPrivateKeyBytes: MAXIMUM_PRIVATE_KEY_BYTES,
    });
    const envelope = {
      contract: PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
      contractRevision: PLATFORM_PROVISIONER_MANIFEST_REVISION,
      payload: compiled.payload,
      signatures: [
        {
          keyId: signature.keyId,
          algorithm: signature.algorithm,
          signature: signature.signature,
        },
      ],
    };
    const canonical = canonicalizeProvisioningJsonValueCandidate(envelope);
    if (canonical.status !== "candidate") {
      throw new Error("release_manifest_envelope_invalid");
    }
    const placement = placeReleaseStagingManifestCandidate(
      platformAccessObservation.token,
      canonical.canonicalBytes,
    );
    return Object.freeze({
      contract: "crdd-coordinator/release-manifest-signing-result",
      contractRevision: 3,
      status: "created" as const,
      manifestRelativePath: placement.manifestRelativePath,
      manifestHash: compiled.manifestHash,
      packageContentRootSha256: packageObservation.packageContentRootSha256,
      runtimeExecutionIdentitySha256:
        compiled.payload.runtimeExecutionIdentitySha256,
      platformAccessExecutableSha256:
        platformAccessObservation.platformAccessArtifact.sha256,
      crddVersion: options.crddVersion,
      releaseSequence: options.releaseSequence,
      crddCommit: options.crddCommit,
      crddTree: options.crddTree,
      distributionTreeVerifiedBeforeSigning: true,
      releaseStagingFilesystemEffectIssued:
        placement.releaseStagingFilesystemEffectIssued,
      stagingRootMustBeDiscarded: placement.stagingRootMustBeDiscarded,
      runtimeFilesystemEffectIssued: placement.runtimeFilesystemEffectIssued,
      provisioningFilesystemEffectIssued:
        placement.provisioningFilesystemEffectIssued,
      runtimeAuthorityConferred: placement.runtimeAuthorityConferred,
      runtimeCapabilityIssued: placement.runtimeCapabilityIssued,
      privateKeyStoredOutsideRepository: true,
      signedGitTreeContainsNativeArtifacts: true,
      repositoryReleaseCommitMustAddManifestOnly: true,
      repositoryReleaseCommitVerifiedBySigner: false,
    });
  } catch (error) {
    if (error instanceof Error) {
      const mapping: Readonly<Record<string, string>> = {
        artifact_signing_private_key_authorization_invalid:
          "release_manifest_preflight_authorization_invalid",
        artifact_signing_private_key_reference_invalid:
          "release_manifest_private_key_path_invalid",
        artifact_signing_private_key_changed:
          "release_manifest_private_key_changed",
        artifact_signing_private_key_not_expected:
          "release_manifest_private_key_not_pinned",
        artifact_signing_passphrase_invalid:
          "release_manifest_passphrase_invalid",
      };
      const mapped = mapping[error.message];
      if (mapped) throw new Error(mapped);
    }
    throw error;
  }
}

function parseArguments(args: readonly string[]) {
  const names = [
    "--distribution-root",
    "--crdd-version",
    "--release-sequence",
    "--crdd-commit",
    "--crdd-tree",
    "--issued-at",
    "--expires-at",
  ] as const;
  const optionalNames = ["--private-key"] as const;
  const values = new Map<string, string>();
  let hasNoExpiry = false;
  for (let index = 0; index < args.length; ) {
    const name = args[index];
    if (name === "--no-expiry") {
      if (hasNoExpiry) throw new Error("release_manifest_arguments_invalid");
      hasNoExpiry = true;
      index += 1;
      continue;
    }
    const value = args[index + 1];
    if (
      !name ||
      !value ||
      (!names.includes(name as (typeof names)[number]) &&
        !optionalNames.includes(name as (typeof optionalNames)[number]))
    ) {
      throw new Error("release_manifest_arguments_invalid");
    }
    if (values.has(name)) throw new Error("release_manifest_arguments_invalid");
    values.set(name, value);
    index += 2;
  }
  if (
    hasNoExpiry === values.has("--expires-at") ||
    values.size !==
      names.length -
        (hasNoExpiry ? 1 : 0) +
        (values.has("--private-key") ? 1 : 0)
  ) {
    throw new Error("release_manifest_arguments_invalid");
  }
  const read = (name: (typeof names)[number]) => {
    const value = values.get(name);
    if (!value) throw new Error("release_manifest_arguments_invalid");
    return value;
  };
  return Object.freeze({
    distributionRoot: read("--distribution-root"),
    privateKeyPath: resolveReleasePrivateKeyPath(
      values.get("--private-key"),
      path.join(repositoryRoot, ".env-crdd"),
    ),
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
    expiresAt: hasNoExpiry ? null : read("--expires-at"),
  });
}

export function resolveReleasePrivateKeyPath(
  explicitPrivateKeyPath: string | undefined,
  environmentFile: string,
) {
  return (
    explicitPrivateKeyPath ??
    readReleasePrivateKeyPathFromEnvironmentFile(environmentFile)
  );
}

export function readReleasePrivateKeyPathFromEnvironmentFile(
  environmentFile: string,
) {
  try {
    return readPrivateKeyReferenceFromEnvironmentFile(
      environmentFile,
      RELEASE_PRIVATE_KEY_PATH_NAME,
    );
  } catch {
    throw new Error("release_manifest_private_key_environment_invalid");
  }
}

async function main() {
  assertSupportedCoordinatorNodeRuntime(process.versions.node);
  const options = parseArguments(process.argv.slice(2));
  assertSupportedReleaseGitObjectFormat(options.crddCommit, options.crddTree);
  assertReleaseManifestStaticOptions(options);
  const preflight = preflightReleaseManifest(options);
  const passphrase = await readHiddenLine("Release key passphrase: ");
  const result = signReleaseManifest(preflight.authorization, passphrase);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "release_manifest_signing_failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
