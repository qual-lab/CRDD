/**
 * promote-release-manifestに属する責務をまとめる。
 *
 * @responsibility resolveReleaseManifestPromotionTopologyForVerificationを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRepositoryRuntimeDataPaths } from "../../runtime-data/src/index.ts";
import { verifyRepositoryRoot } from "../../version-control/src/repository-location.ts";

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

const executionDistributionRoot = fileURLToPath(
  new URL("../../../", import.meta.url),
);
const CANDIDATE_NAME = /^[a-z0-9][a-z0-9-]{0,127}$/u;

/**
 * Release Manifest Promotion Topology For Verificationを一意に解決する。
 *
 * @responsibility Release Manifest Promotion Topology For Verificationの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input distributionRootInput: unknown、destinationRepositoryRootInput: unknown
 * @returns resolveReleaseManifestPromotionTopologyForVerificationの計算結果を返す。
 * @precondition 「distributionRootInput: unknown、destinationRepositoryRootInput: unknown」がresolveReleaseManifestPromotionTopologyForVerificationの入力契約を満たす。
 * @postcondition resolveReleaseManifestPromotionTopologyForVerificationの責務を完了した結果だけを返す。
 * @effect resolveReleaseManifestPromotionTopologyForVerificationはFilesystemの読取りまたは書込みを実行する。
 * @failure resolveReleaseManifestPromotionTopologyForVerificationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveReleaseManifestPromotionTopologyForVerificationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: resolveReleaseManifestPromotionTopologyForVerificationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveReleaseManifestPromotionTopologyForVerificationは共有非同期状態を持たない同期処理である。
 */
export function resolveReleaseManifestPromotionTopologyForVerification(
  distributionRootInput: unknown,
  destinationRepositoryRootInput: unknown,
) {
  if (
    typeof distributionRootInput !== "string" ||
    !path.isAbsolute(distributionRootInput) ||
    typeof destinationRepositoryRootInput !== "string" ||
    !path.isAbsolute(destinationRepositoryRootInput)
  )
    throw new Error("release_manifest_promotion_topology_invalid");
  const distributionRoot = path.resolve(distributionRootInput);
  const destinationRepositoryRoot = path.resolve(
    destinationRepositoryRootInput,
  );
  const destinationMetadata = fs.lstatSync(destinationRepositoryRoot);
  if (
    !destinationMetadata.isDirectory() ||
    destinationMetadata.isSymbolicLink() ||
    fs.realpathSync.native(destinationRepositoryRoot) !==
      destinationRepositoryRoot
  )
    throw new Error("release_manifest_promotion_destination_root_invalid");
  const verifiedRuntimeRoot = verifyRepositoryRoot(destinationRepositoryRoot);
  const runtimePaths =
    verifiedRuntimeRoot.status === "completed"
      ? resolveRepositoryRuntimeDataPaths(verifiedRuntimeRoot.capability)
      : null;
  if (!runtimePaths)
    throw new Error("release_manifest_promotion_topology_invalid");
  const releaseStagingRoot = runtimePaths.release;
  try {
    const parent = fs.realpathSync.native(path.dirname(distributionRoot));
    const metadata = fs.lstatSync(distributionRoot);
    if (
      parent !== fs.realpathSync.native(releaseStagingRoot) ||
      !CANDIDATE_NAME.test(path.basename(distributionRoot)) ||
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      fs.realpathSync.native(distributionRoot) !== distributionRoot
    )
      throw new Error("release_manifest_promotion_execution_source_invalid");
  } catch {
    throw new Error("release_manifest_promotion_execution_source_invalid");
  }
  return Object.freeze({ distributionRoot, destinationRepositoryRoot });
}

/**
 * path Does Not Existを決定する。
 *
 * @responsibility path Does Not Existの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input target: string
 * @returns pathDoesNotExistの計算結果を返す。
 * @precondition 「target: string」がpathDoesNotExistの入力契約を満たす。
 * @postcondition pathDoesNotExistの責務を完了した結果だけを返す。
 * @effect pathDoesNotExistはFilesystemの読取りまたは書込みを実行する。
 * @failure pathDoesNotExistは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant pathDoesNotExistは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: pathDoesNotExistはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: pathDoesNotExistは共有非同期状態を持たない同期処理である。
 */
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

/**
 * expected Releaseを決定する。
 *
 * @responsibility expected Releaseの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input distributionRoot: string、evaluationTime: string
 * @returns expectedReleaseの計算結果を返す。
 * @precondition 「distributionRoot: string、evaluationTime: string」がexpectedReleaseの入力契約を満たす。
 * @postcondition expectedReleaseの責務を完了した結果だけを返す。
 * @effect N/A: expectedReleaseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure expectedReleaseは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant expectedReleaseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: expectedReleaseはProcess内の同一Subsystemで完結する。
 * @security N/A: expectedReleaseはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: expectedReleaseは共有非同期状態を持たない同期処理である。
 */
function expectedRelease(distributionRoot: string, evaluationTime: string) {
  const stagingManifest = path.join(
    distributionRoot,
    ...PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH.split("/"),
  );
  if (pathDoesNotExist(stagingManifest))
    throw new Error("release_manifest_promotion_manifest_absent");
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

/**
 * Source Aを検証する。
 *
 * @responsibility Source Aの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input expected: ReturnType<typeof expectedRelease>["expected"]、expectedManifestFileSha256: string、distributionRoot: string、destinationRepositoryRoot: string
 * @returns N/A: verifySourceAは戻り値を返さない。
 * @precondition 「expected: ReturnType<typeof expectedRelease>["expected"]、expectedManifestFileSha256: string、distributionRoot: string、destinationRepositoryRoot: string」がverifySourceAの入力契約を満たす。
 * @postcondition verifySourceAの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: verifySourceAは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifySourceAは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifySourceAは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifySourceAはProcess内の同一Subsystemで完結する。
 * @security N/A: verifySourceAはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifySourceAは共有非同期状態を持たない同期処理である。
 */
function verifySourceA(
  expected: ReturnType<typeof expectedRelease>["expected"],
  expectedManifestFileSha256: string,
  distributionRoot: string,
  destinationRepositoryRoot: string,
) {
  const repository = inspectRepositoryIdentityCandidate(
    destinationRepositoryRoot,
  );
  const tree = inspectPlatformProvisionerReleaseIdentityCandidate(
    distributionRoot,
    expected.crddTree,
  );
  const destination = path.join(
    destinationRepositoryRoot,
    ...PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH.split("/"),
  );
  const destinationAbsent = pathDoesNotExist(destination);
  if (
    repository?.status !== "candidate" ||
    repository.commit !== expected.crddCommit ||
    repository.tree !== expected.crddTree ||
    tree.status !== "candidate" ||
    tree.manifestExcludedFromSignedGitTree !== true ||
    tree.platformAccessExecutableIncludedInSignedGitTree !== true ||
    (!destinationAbsent &&
      loadPlatformProvisionerManifestEnvelopeForVerification(
        destinationRepositoryRoot,
      ).manifestFileSha256 !== expectedManifestFileSha256)
  )
    throw new Error("release_manifest_promotion_source_a_invalid");
}

/**
 * promote-release-manifestで使用するPromotion Releaseの値契約を定義する。
 *
 * @responsibility Promotion ReleaseのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape PromotionReleaseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PromotionReleaseで宣言した値と責務の対応を維持する。
 * @boundary N/A: PromotionReleaseの宣言は外部境界を開かない。
 * @security N/A: PromotionReleaseはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility PromotionReleaseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PromotionRelease = ReturnType<typeof expectedRelease>;
/**
 * promote-release-manifestで使用するPromotion Compositionの値契約を定義する。
 *
 * @responsibility Promotion CompositionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape PromotionCompositionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PromotionCompositionで宣言した値と責務の対応を維持する。
 * @boundary N/A: PromotionCompositionの宣言は外部境界を開かない。
 * @security N/A: PromotionCompositionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility PromotionCompositionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * Release Manifest Promotion Composition For Verificationを実行する。
 *
 * @responsibility Release Manifest Promotion Composition For Verificationの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input distributionRoot: string、destinationRepositoryRoot: string、evaluationTime: string、composition: PromotionComposition
 * @returns executeReleaseManifestPromotionCompositionForVerificationの計算結果を返す。
 * @precondition 「distributionRoot: string、destinationRepositoryRoot: string、evaluationTime: string、composition: PromotionComposition」がexecuteReleaseManifestPromotionCompositionForVerificationの入力契約を満たす。
 * @postcondition executeReleaseManifestPromotionCompositionForVerificationの責務を完了した結果だけを返す。
 * @effect N/A: executeReleaseManifestPromotionCompositionForVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure executeReleaseManifestPromotionCompositionForVerificationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executeReleaseManifestPromotionCompositionForVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executeReleaseManifestPromotionCompositionForVerificationはProcess内の同一Subsystemで完結する。
 * @security N/A: executeReleaseManifestPromotionCompositionForVerificationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: executeReleaseManifestPromotionCompositionForVerificationは共有非同期状態を持たない同期処理である。
 */
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

/**
 * production Compositionを決定する。
 *
 * @responsibility production Compositionの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input destinationRepositoryRoot: string
 * @returns PromotionCompositionを返す。
 * @precondition 「destinationRepositoryRoot: string」がproductionCompositionの入力契約を満たす。
 * @postcondition productionCompositionの責務を完了した結果だけを返す。
 * @effect N/A: productionCompositionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: productionCompositionは独自の失敗分岐を所有しない。
 * @invariant productionCompositionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: productionCompositionはProcess内の同一Subsystemで完結する。
 * @security N/A: productionCompositionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: productionCompositionは共有非同期状態を持たない同期処理である。
 */
function productionComposition(
  destinationRepositoryRoot: string,
): PromotionComposition {
  return Object.freeze({
    inspectRelease: expectedRelease,
    /**
     * Repositoryを検証する。
     *
     * @responsibility Repositoryの検証根拠、成立条件、観測不能時の拒否境界を所有する。
     * @trace ARCH-000004
     * @input phase、release、distributionRoot、evaluationTime
     * @returns verifyRepositoryの計算結果を返す。
     * @precondition 「phase、release、distributionRoot、evaluationTime」がverifyRepositoryの入力契約を満たす。
     * @postcondition verifyRepositoryの責務を完了した結果だけを返す。
     * @effect N/A: verifyRepositoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: verifyRepositoryは独自の失敗分岐を所有しない。
     * @invariant verifyRepositoryは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: verifyRepositoryはProcess内の同一Subsystemで完結する。
     * @security N/A: verifyRepositoryはAuthority、秘密値または信頼判断を扱わない。
     * @concurrency N/A: verifyRepositoryは共有非同期状態を持たない同期処理である。
     */
    verifyRepository(phase, release, distributionRoot, evaluationTime) {
      if (phase === "before") {
        verifySourceA(
          release.expected,
          release.manifestFileSha256,
          distributionRoot,
          destinationRepositoryRoot,
        );
        return true;
      }
      const repository = inspectRepositoryIdentityCandidate(
        destinationRepositoryRoot,
      );
      const installed = inspectVerifiedNativeDistributionCandidate({
        distributionRoot,
        evaluationTime,
        expectedRelease: release.expected,
      });
      const tree = inspectPlatformProvisionerReleaseIdentityCandidate(
        distributionRoot,
        release.expected.crddTree,
      );
      const loaded = loadPlatformProvisionerManifestEnvelopeForVerification(
        destinationRepositoryRoot,
      );
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
}

/**
 * promote Verified Release Manifestを決定する。
 *
 * @responsibility promote Verified Release Manifestの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns promoteVerifiedReleaseManifestの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がpromoteVerifiedReleaseManifestの入力契約を満たす。
 * @postcondition promoteVerifiedReleaseManifestの責務を完了した結果だけを返す。
 * @effect promoteVerifiedReleaseManifestは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: promoteVerifiedReleaseManifestは独自の失敗分岐を所有しない。
 * @invariant promoteVerifiedReleaseManifestは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: promoteVerifiedReleaseManifestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: promoteVerifiedReleaseManifestは共有非同期状態を持たない同期処理である。
 */
export function promoteVerifiedReleaseManifest() {
  const evaluationTime = new Date().toISOString();
  const { distributionRoot, destinationRepositoryRoot } =
    resolveReleaseManifestPromotionTopologyForVerification(
      executionDistributionRoot,
      process.cwd(),
    );
  return executeReleaseManifestPromotionCompositionForVerification(
    distributionRoot,
    destinationRepositoryRoot,
    evaluationTime,
    productionComposition(destinationRepositoryRoot),
  );
}

/**
 * Argumentsを構造化値へ解析する。
 *
 * @responsibility Argumentsの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000004
 * @input args: readonly string[]
 * @returns N/A: parseArgumentsは戻り値を返さない。
 * @precondition 「args: readonly string[]」がparseArgumentsの入力契約を満たす。
 * @postcondition parseArgumentsの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: parseArgumentsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseArgumentsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseArgumentsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseArgumentsはProcess内の同一Subsystemで完結する。
 * @security N/A: parseArgumentsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseArgumentsは共有非同期状態を持たない同期処理である。
 */
function parseArguments(args: readonly string[]) {
  if (args.length !== 0)
    throw new Error("release_manifest_promotion_arguments_invalid");
}

/**
 * promote-release-manifestのCommand処理を開始する。
 *
 * @responsibility promote-release-manifestの引数受付、終了Code、診断出力境界を所有する。
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
  parseArguments(process.argv.slice(2));
  const result = promoteVerifiedReleaseManifest();
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
