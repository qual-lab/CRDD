/**
 * sign-release-manifestに属する責務をまとめる。
 *
 * @responsibility ManifestOptionsを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
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

/**
 * sign-release-manifestで使用するManifest Optionsの値契約を定義する。
 *
 * @responsibility Manifest OptionsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ManifestOptionsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ManifestOptionsで宣言した値と責務の対応を維持する。
 * @boundary N/A: ManifestOptionsの宣言は外部境界を開かない。
 * @security N/A: ManifestOptionsはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ManifestOptionsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * sign-release-manifestで使用するManifest Preflight Optionsの値契約を定義する。
 *
 * @responsibility Manifest Preflight OptionsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ManifestPreflightOptionsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ManifestPreflightOptionsで宣言した値と責務の対応を維持する。
 * @boundary N/A: ManifestPreflightOptionsの宣言は外部境界を開かない。
 * @security N/A: ManifestPreflightOptionsはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ManifestPreflightOptionsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ManifestPreflightOptions = Omit<ManifestOptions, "passphrase">;

/**
 * sign-release-manifestで使用するRelease Manifest Preflight Authorizationの値契約を定義する。
 *
 * @responsibility Release Manifest Preflight AuthorizationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ReleaseManifestPreflightAuthorizationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ReleaseManifestPreflightAuthorizationで宣言した値と責務の対応を維持する。
 * @boundary N/A: ReleaseManifestPreflightAuthorizationの宣言は外部境界を開かない。
 * @security N/A: ReleaseManifestPreflightAuthorizationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ReleaseManifestPreflightAuthorizationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ReleaseManifestPreflightAuthorization = Readonly<{
  contract: "crdd-coordinator/release-manifest-preflight-authorization";
  contractRevision: 1;
}>;

/**
 * sign-release-manifestで使用するAuthorized Release Manifest Preflightの値契約を定義する。
 *
 * @responsibility Authorized Release Manifest PreflightのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape AuthorizedReleaseManifestPreflightが表すProperty、識別子およびRelationを型として固定する。
 * @invariant AuthorizedReleaseManifestPreflightで宣言した値と責務の対応を維持する。
 * @boundary N/A: AuthorizedReleaseManifestPreflightの宣言は外部境界を開かない。
 * @security N/A: AuthorizedReleaseManifestPreflightはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility AuthorizedReleaseManifestPreflightの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type AuthorizedReleaseManifestPreflight = Readonly<{
  options: ManifestPreflightOptions;
  privateKeyAuthorization: PrivateKeyReferenceAuthorization;
  consumed: boolean;
}>;

const authorizedReleaseManifestPreflights = new WeakMap<
  ReleaseManifestPreflightAuthorization,
  AuthorizedReleaseManifestPreflight
>();

/**
 * Manifest Preflight Optionsを所有Snapshotへ変換する。
 *
 * @responsibility Manifest Preflight Optionsの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns ManifestPreflightOptionsを返す。
 * @precondition 「value: unknown」がsnapshotManifestPreflightOptionsの入力契約を満たす。
 * @postcondition snapshotManifestPreflightOptionsの責務を完了した結果だけを返す。
 * @effect N/A: snapshotManifestPreflightOptionsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotManifestPreflightOptionsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotManifestPreflightOptionsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotManifestPreflightOptionsはProcess内の同一Subsystemで完結する。
 * @security N/A: snapshotManifestPreflightOptionsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: snapshotManifestPreflightOptionsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * repository Local Distribution Rootを決定する。
 *
 * @responsibility repository Local Distribution Rootの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input target: string
 * @returns repositoryLocalDistributionRootの計算結果を返す。
 * @precondition 「target: string」がrepositoryLocalDistributionRootの入力契約を満たす。
 * @postcondition repositoryLocalDistributionRootの責務を完了した結果だけを返す。
 * @effect repositoryLocalDistributionRootはFilesystemの読取りまたは書込みを実行する。
 * @failure repositoryLocalDistributionRootは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant repositoryLocalDistributionRootは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: repositoryLocalDistributionRootはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: repositoryLocalDistributionRootは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Commit Tree Bindingを検証する。
 *
 * @responsibility Commit Tree Bindingの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input crddCommit: string、crddTree: string
 * @returns N/A: verifyCommitTreeBindingは戻り値を返さない。
 * @precondition 「crddCommit: string、crddTree: string」がverifyCommitTreeBindingの入力契約を満たす。
 * @postcondition verifyCommitTreeBindingの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: verifyCommitTreeBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyCommitTreeBindingは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyCommitTreeBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyCommitTreeBindingはProcess内の同一Subsystemで完結する。
 * @security N/A: verifyCommitTreeBindingはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifyCommitTreeBindingは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Supported Release Git Object Formatを表明どおりか検査する。
 *
 * @responsibility Supported Release Git Object Formatの必須条件と違反時の停止境界を所有する。
 * @trace ARCH-000004
 * @input crddCommit: string、crddTree: string
 * @returns N/A: assertSupportedReleaseGitObjectFormatは戻り値を返さない。
 * @precondition 「crddCommit: string、crddTree: string」がassertSupportedReleaseGitObjectFormatの入力契約を満たす。
 * @postcondition assertSupportedReleaseGitObjectFormatの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: assertSupportedReleaseGitObjectFormatは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure assertSupportedReleaseGitObjectFormatは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant assertSupportedReleaseGitObjectFormatは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: assertSupportedReleaseGitObjectFormatはProcess内の同一Subsystemで完結する。
 * @security N/A: assertSupportedReleaseGitObjectFormatはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: assertSupportedReleaseGitObjectFormatは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Release Manifest Static Optionsを表明どおりか検査する。
 *
 * @responsibility Release Manifest Static Optionsの必須条件と違反時の停止境界を所有する。
 * @trace ARCH-000004
 * @input options: ManifestPreflightOptions
 * @returns N/A: assertReleaseManifestStaticOptionsは戻り値を返さない。
 * @precondition 「options: ManifestPreflightOptions」がassertReleaseManifestStaticOptionsの入力契約を満たす。
 * @postcondition assertReleaseManifestStaticOptionsの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: assertReleaseManifestStaticOptionsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure assertReleaseManifestStaticOptionsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant assertReleaseManifestStaticOptionsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: assertReleaseManifestStaticOptionsはProcess内の同一Subsystemで完結する。
 * @security N/A: assertReleaseManifestStaticOptionsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: assertReleaseManifestStaticOptionsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Release Manifest 候補を実行前候補として準備する。
 *
 * @responsibility Release Manifest 候補の準備条件、候補Identity、Effect前の拒否境界を所有する。
 * @trace ARCH-000004
 * @input options: ManifestPreflightOptions
 * @returns prepareReleaseManifestCandidateの計算結果を返す。
 * @precondition 「options: ManifestPreflightOptions」がprepareReleaseManifestCandidateの入力契約を満たす。
 * @postcondition prepareReleaseManifestCandidateの責務を完了した結果だけを返す。
 * @effect N/A: prepareReleaseManifestCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure prepareReleaseManifestCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant prepareReleaseManifestCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: prepareReleaseManifestCandidateはProcess内の同一Subsystemで完結する。
 * @security N/A: prepareReleaseManifestCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: prepareReleaseManifestCandidateは共有非同期状態を持たない同期処理である。
 */
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

/**
 * preflight Release Manifestを決定する。
 *
 * @responsibility preflight Release Manifestの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input options: ManifestPreflightOptions
 * @returns preflightReleaseManifestの計算結果を返す。
 * @precondition 「options: ManifestPreflightOptions」がpreflightReleaseManifestの入力契約を満たす。
 * @postcondition preflightReleaseManifestの責務を完了した結果だけを返す。
 * @effect N/A: preflightReleaseManifestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure preflightReleaseManifestは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant preflightReleaseManifestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: preflightReleaseManifestはProcess内の同一Subsystemで完結する。
 * @security N/A: preflightReleaseManifestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: preflightReleaseManifestは共有非同期状態を持たない同期処理である。
 */
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

/**
 * sign Release Manifestを決定する。
 *
 * @responsibility sign Release Manifestの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input authorization: ReleaseManifestPreflightAuthorization、rawPassphrase: unknown
 * @returns signReleaseManifestの計算結果を返す。
 * @precondition 「authorization: ReleaseManifestPreflightAuthorization、rawPassphrase: unknown」がsignReleaseManifestの入力契約を満たす。
 * @postcondition signReleaseManifestの責務を完了した結果だけを返す。
 * @effect N/A: signReleaseManifestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure signReleaseManifestは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant signReleaseManifestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: signReleaseManifestはProcess内の同一Subsystemで完結する。
 * @security signReleaseManifestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: signReleaseManifestは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Argumentsを構造化値へ解析する。
 *
 * @responsibility Argumentsの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000004
 * @input args: readonly string[]
 * @returns parseArgumentsの計算結果を返す。
 * @precondition 「args: readonly string[]」がparseArgumentsの入力契約を満たす。
 * @postcondition parseArgumentsの責務を完了した結果だけを返す。
 * @effect N/A: parseArgumentsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseArgumentsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseArgumentsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseArgumentsはProcess内の同一Subsystemで完結する。
 * @security N/A: parseArgumentsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseArgumentsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Release Private Key Pathを一意に解決する。
 *
 * @responsibility Release Private Key Pathの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input explicitPrivateKeyPath: string | undefined、environmentFile: string
 * @returns resolveReleasePrivateKeyPathの計算結果を返す。
 * @precondition 「explicitPrivateKeyPath: string | undefined、environmentFile: string」がresolveReleasePrivateKeyPathの入力契約を満たす。
 * @postcondition resolveReleasePrivateKeyPathの責務を完了した結果だけを返す。
 * @effect N/A: resolveReleasePrivateKeyPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveReleasePrivateKeyPathは独自の失敗分岐を所有しない。
 * @invariant resolveReleasePrivateKeyPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveReleasePrivateKeyPathはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveReleasePrivateKeyPathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveReleasePrivateKeyPathは共有非同期状態を持たない同期処理である。
 */
export function resolveReleasePrivateKeyPath(
  explicitPrivateKeyPath: string | undefined,
  environmentFile: string,
) {
  return (
    explicitPrivateKeyPath ??
    readReleasePrivateKeyPathFromEnvironmentFile(environmentFile)
  );
}

/**
 * Release Private Key Path From Environment Fileを読み取る。
 *
 * @responsibility Release Private Key Path From Environment Fileの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input environmentFile: string
 * @returns readReleasePrivateKeyPathFromEnvironmentFileの計算結果を返す。
 * @precondition 「environmentFile: string」がreadReleasePrivateKeyPathFromEnvironmentFileの入力契約を満たす。
 * @postcondition readReleasePrivateKeyPathFromEnvironmentFileの責務を完了した結果だけを返す。
 * @effect N/A: readReleasePrivateKeyPathFromEnvironmentFileは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readReleasePrivateKeyPathFromEnvironmentFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readReleasePrivateKeyPathFromEnvironmentFileは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readReleasePrivateKeyPathFromEnvironmentFileはProcess内の同一Subsystemで完結する。
 * @security N/A: readReleasePrivateKeyPathFromEnvironmentFileはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readReleasePrivateKeyPathFromEnvironmentFileは共有非同期状態を持たない同期処理である。
 */
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

/**
 * sign-release-manifestのCommand処理を開始する。
 *
 * @responsibility sign-release-manifestの引数受付、終了Code、診断出力境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: mainは戻り値を返さない。
 * @precondition 「N/A: 実行時引数を受け取らない。」がmainの入力契約を満たす。
 * @postcondition mainの責務を完了して呼出し元へ制御を戻す。
 * @effect mainは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: mainは独自の失敗分岐を所有しない。
 * @invariant mainは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: mainはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency mainは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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
