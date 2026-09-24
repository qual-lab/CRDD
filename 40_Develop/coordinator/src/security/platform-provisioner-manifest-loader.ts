/**
 * platform-provisioner-manifest-loaderに属する責務をまとめる。
 *
 * @responsibility stableManifestBytesを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000014
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { canonicalizeProvisioningJsonValueCandidate } from "./provisioning-signature-primitives.ts";

export const PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH =
  "template/tools/coordinator/coordinator-package-manifest.json";
export const HISTORICAL_V2_PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH =
  "90_Release/coordinator-package-manifest.json";

export const PLATFORM_PROVISIONER_MANIFEST_MAXIMUM_BYTES = 128 * 1024;

/**
 * Manifest Bytesを安定Identityへ変換する。
 *
 * @responsibility Manifest Bytesの正規化条件、一意性、変換不能時の拒否境界を所有する。
 * @trace ARCH-000014
 * @input target: string
 * @returns stableManifestBytesの計算結果を返す。
 * @precondition 「target: string」がstableManifestBytesの入力契約を満たす。
 * @postcondition stableManifestBytesの責務を完了した結果だけを返す。
 * @effect stableManifestBytesはFilesystemの読取りまたは書込みを実行する。
 * @failure stableManifestBytesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant stableManifestBytesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security stableManifestBytesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: stableManifestBytesは共有非同期状態を持たない同期処理である。
 */
function stableManifestBytes(target: string) {
  const before = fs.lstatSync(target, { bigint: true });
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.size <= 0n ||
    before.size > BigInt(PLATFORM_PROVISIONER_MANIFEST_MAXIMUM_BYTES)
  ) {
    throw new Error("platform_provisioner_manifest_file_invalid");
  }
  const real = fs.realpathSync.native(target);
  if (real !== target) {
    throw new Error("platform_provisioner_manifest_file_invalid");
  }
  const noFollow =
    process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
  const descriptor = fs.openSync(target, fs.constants.O_RDONLY | noFollow);
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.birthtimeNs !== before.birthtimeNs ||
      opened.size !== before.size
    ) {
      throw new Error("platform_provisioner_manifest_file_changed");
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
    const pathAfter = fs.lstatSync(target, { bigint: true });
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
      fs.realpathSync.native(target) !== target
    ) {
      throw new Error("platform_provisioner_manifest_file_changed");
    }
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

/**
 * manifest Pathを決定する。
 *
 * @responsibility manifest Pathの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input distributionRoot: string、relativePath: string
 * @returns manifestPathの計算結果を返す。
 * @precondition 「distributionRoot: string、relativePath: string」がmanifestPathの入力契約を満たす。
 * @postcondition manifestPathの責務を完了した結果だけを返す。
 * @effect manifestPathはFilesystemの読取りまたは書込みを実行する。
 * @failure manifestPathは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant manifestPathは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security manifestPathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: manifestPathは共有非同期状態を持たない同期処理である。
 */
function manifestPath(distributionRoot: string, relativePath: string) {
  if (
    typeof distributionRoot !== "string" ||
    distributionRoot.length === 0 ||
    !path.isAbsolute(distributionRoot) ||
    distributionRoot.includes("\0")
  ) {
    throw new Error("platform_provisioner_distribution_root_invalid");
  }
  const resolved = path.resolve(distributionRoot);
  const metadata = fs.lstatSync(resolved);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(resolved) !== resolved
  ) {
    throw new Error("platform_provisioner_distribution_root_invalid");
  }
  return path.join(resolved, ...relativePath.split("/"));
}

/**
 * Manifest At Relative Pathを読み込む。
 *
 * @responsibility Manifest At Relative Pathの読取り元、Schema検証、読取不能時の拒否境界を所有する。
 * @trace ARCH-000014
 * @input distributionRoot: string、relativePath: string
 * @returns loadManifestAtRelativePathの計算結果を返す。
 * @precondition 「distributionRoot: string、relativePath: string」がloadManifestAtRelativePathの入力契約を満たす。
 * @postcondition loadManifestAtRelativePathの責務を完了した結果だけを返す。
 * @effect N/A: loadManifestAtRelativePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure loadManifestAtRelativePathは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant loadManifestAtRelativePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: loadManifestAtRelativePathはProcess内の同一Subsystemで完結する。
 * @security loadManifestAtRelativePathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: loadManifestAtRelativePathは共有非同期状態を持たない同期処理である。
 */
function loadManifestAtRelativePath(
  distributionRoot: string,
  relativePath: string,
) {
  const bytes = stableManifestBytes(
    manifestPath(distributionRoot, relativePath),
  );
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    throw new Error("platform_provisioner_manifest_encoding_invalid");
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const parsed: unknown = JSON.parse(text);
  const canonical = canonicalizeProvisioningJsonValueCandidate(parsed);
  if (
    canonical.status !== "candidate" ||
    !Buffer.prototype.equals.call(bytes, canonical.canonicalBytes)
  ) {
    throw new Error("platform_provisioner_manifest_encoding_invalid");
  }
  return Object.freeze({
    envelope: parsed,
    manifestFileSha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

/**
 * Platform Provisioner Manifest Envelope For Verificationを読み込む。
 *
 * @responsibility Platform Provisioner Manifest Envelope For Verificationの読取り元、Schema検証、読取不能時の拒否境界を所有する。
 * @trace ARCH-000014
 * @input distributionRoot: string
 * @returns loadPlatformProvisionerManifestEnvelopeForVerificationの計算結果を返す。
 * @precondition 「distributionRoot: string」がloadPlatformProvisionerManifestEnvelopeForVerificationの入力契約を満たす。
 * @postcondition loadPlatformProvisionerManifestEnvelopeForVerificationの責務を完了した結果だけを返す。
 * @effect N/A: loadPlatformProvisionerManifestEnvelopeForVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: loadPlatformProvisionerManifestEnvelopeForVerificationは独自の失敗分岐を所有しない。
 * @invariant loadPlatformProvisionerManifestEnvelopeForVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: loadPlatformProvisionerManifestEnvelopeForVerificationはProcess内の同一Subsystemで完結する。
 * @security loadPlatformProvisionerManifestEnvelopeForVerificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: loadPlatformProvisionerManifestEnvelopeForVerificationは共有非同期状態を持たない同期処理である。
 */
export function loadPlatformProvisionerManifestEnvelopeForVerification(
  distributionRoot: string,
) {
  return loadManifestAtRelativePath(
    distributionRoot,
    PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
  );
}

/**
 * Historical V2 Platform Provisioner Manifest Envelope For Verificationを読み込む。
 *
 * @responsibility Historical V2 Platform Provisioner Manifest Envelope For Verificationの読取り元、Schema検証、読取不能時の拒否境界を所有する。
 * @trace ARCH-000014
 * @input distributionRoot: string
 * @returns loadHistoricalV2PlatformProvisionerManifestEnvelopeForVerificationの計算結果を返す。
 * @precondition 「distributionRoot: string」がloadHistoricalV2PlatformProvisionerManifestEnvelopeForVerificationの入力契約を満たす。
 * @postcondition loadHistoricalV2PlatformProvisionerManifestEnvelopeForVerificationの責務を完了した結果だけを返す。
 * @effect N/A: loadHistoricalV2PlatformProvisionerManifestEnvelopeForVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: loadHistoricalV2PlatformProvisionerManifestEnvelopeForVerificationは独自の失敗分岐を所有しない。
 * @invariant loadHistoricalV2PlatformProvisionerManifestEnvelopeForVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: loadHistoricalV2PlatformProvisionerManifestEnvelopeForVerificationはProcess内の同一Subsystemで完結する。
 * @security loadHistoricalV2PlatformProvisionerManifestEnvelopeForVerificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: loadHistoricalV2PlatformProvisionerManifestEnvelopeForVerificationは共有非同期状態を持たない同期処理である。
 */
export function loadHistoricalV2PlatformProvisionerManifestEnvelopeForVerification(
  distributionRoot: string,
) {
  return loadManifestAtRelativePath(
    distributionRoot,
    HISTORICAL_V2_PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
  );
}

/**
 * manifest Entry Existsを決定する。
 *
 * @responsibility manifest Entry Existsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input distributionRoot: string、relativePath: string
 * @returns manifestEntryExistsの計算結果を返す。
 * @precondition 「distributionRoot: string、relativePath: string」がmanifestEntryExistsの入力契約を満たす。
 * @postcondition manifestEntryExistsの責務を完了した結果だけを返す。
 * @effect manifestEntryExistsはFilesystemの読取りまたは書込みを実行する。
 * @failure manifestEntryExistsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant manifestEntryExistsは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security manifestEntryExistsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: manifestEntryExistsは共有非同期状態を持たない同期処理である。
 */
function manifestEntryExists(distributionRoot: string, relativePath: string) {
  try {
    fs.lstatSync(manifestPath(distributionRoot, relativePath));
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return false;
    throw error;
  }
}

/**
 * Loads exactly one signed manifest layout for historical recovery. This is
 *
 * @responsibility Historical Release Manifest Envelope For Verificationの読取り元、Schema検証、読取不能時の拒否境界を所有する。
 * @trace ARCH-000014
 * @input distributionRoot: string
 * @returns loadHistoricalReleaseManifestEnvelopeForVerificationの計算結果を返す。
 * @precondition 「distributionRoot: string」がloadHistoricalReleaseManifestEnvelopeForVerificationの入力契約を満たす。
 * @postcondition loadHistoricalReleaseManifestEnvelopeForVerificationの責務を完了した結果だけを返す。
 * @effect N/A: loadHistoricalReleaseManifestEnvelopeForVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure loadHistoricalReleaseManifestEnvelopeForVerificationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant loadHistoricalReleaseManifestEnvelopeForVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: loadHistoricalReleaseManifestEnvelopeForVerificationはProcess内の同一Subsystemで完結する。
 * @security loadHistoricalReleaseManifestEnvelopeForVerificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: loadHistoricalReleaseManifestEnvelopeForVerificationは共有非同期状態を持たない同期処理である。
 */
export function loadHistoricalReleaseManifestEnvelopeForVerification(
  distributionRoot: string,
) {
  const currentExists = manifestEntryExists(
    distributionRoot,
    PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
  );
  const historicalExists = manifestEntryExists(
    distributionRoot,
    HISTORICAL_V2_PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
  );
  if (currentExists === historicalExists)
    throw new Error("platform_provisioner_historical_manifest_ambiguous");
  return currentExists
    ? loadPlatformProvisionerManifestEnvelopeForVerification(distributionRoot)
    : loadHistoricalV2PlatformProvisionerManifestEnvelopeForVerification(
        distributionRoot,
      );
}

/**
 * Platform Provisioner Manifest File 候補を観測する。
 *
 * @responsibility Platform Provisioner Manifest File 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000014
 * @input distributionRoot: unknown
 * @returns inspectPlatformProvisionerManifestFileCandidateの計算結果を返す。
 * @precondition 「distributionRoot: unknown」がinspectPlatformProvisionerManifestFileCandidateの入力契約を満たす。
 * @postcondition inspectPlatformProvisionerManifestFileCandidateの責務を完了した結果だけを返す。
 * @effect N/A: inspectPlatformProvisionerManifestFileCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectPlatformProvisionerManifestFileCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectPlatformProvisionerManifestFileCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectPlatformProvisionerManifestFileCandidateはProcess内の同一Subsystemで完結する。
 * @security inspectPlatformProvisionerManifestFileCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectPlatformProvisionerManifestFileCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectPlatformProvisionerManifestFileCandidate(
  distributionRoot: unknown,
) {
  try {
    if (typeof distributionRoot !== "string") {
      throw new Error("platform_provisioner_distribution_root_invalid");
    }
    const loaded =
      loadPlatformProvisionerManifestEnvelopeForVerification(distributionRoot);
    return Object.freeze({
      status: "candidate" as const,
      reason:
        "canonical_manifest_file_observed_signature_and_release_identity_verification_required",
      manifestFileSha256: loaded.manifestFileSha256,
      canonicalManifestEncodingConfirmed: true,
      runtimeOwnedReleaseTrustConfirmed: false,
      crddDistributionConfirmed: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "platform_provisioner_manifest_file_invalid",
      manifestFileSha256: null,
      canonicalManifestEncodingConfirmed: false,
      runtimeOwnedReleaseTrustConfirmed: false,
      crddDistributionConfirmed: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
    });
  }
}

/**
 * Platform Provisioner Manifest Loader 契約の公開契約を記述する。
 *
 * @responsibility Platform Provisioner Manifest Loader 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describePlatformProvisionerManifestLoaderContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribePlatformProvisionerManifestLoaderContractの入力契約を満たす。
 * @postcondition describePlatformProvisionerManifestLoaderContractの責務を完了した結果だけを返す。
 * @effect N/A: describePlatformProvisionerManifestLoaderContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describePlatformProvisionerManifestLoaderContractは独自の失敗分岐を所有しない。
 * @invariant describePlatformProvisionerManifestLoaderContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describePlatformProvisionerManifestLoaderContractはProcess内の同一Subsystemで完結する。
 * @security describePlatformProvisionerManifestLoaderContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describePlatformProvisionerManifestLoaderContractは共有非同期状態を持たない同期処理である。
 */
export function describePlatformProvisionerManifestLoaderContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-manifest-loader",
    contractRevision: 1,
    manifestRelativePath: PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
    maximumManifestBytes: PLATFORM_PROVISIONER_MANIFEST_MAXIMUM_BYTES,
    canonicalEncoding: "RFC-8785-exact-UTF-8-without-BOM",
    stableSameFileIdentityRead: "implemented_candidate",
    symbolicLinkOrReparseFallbackAllowed: false,
    manifestPlacement:
      "release_commit_adds_only_manifest_to_signed_parent_git_tree",
    manifestSignatureVerification: "owned_by_platform_provisioner_trust_core",
    releaseIdentityVerification:
      "implemented_by_fixed_distribution_git_tree_verifier_candidate",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}
