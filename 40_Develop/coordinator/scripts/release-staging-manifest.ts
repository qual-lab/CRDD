/**
 * release-staging-manifestに属する責務をまとめる。
 *
 * @responsibility DirectoryIdentityを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import fs from "node:fs";
import path from "node:path";

import {
  beginPlatformAccessArtifactSigningObservation,
  verifyPlatformAccessArtifactSigningObservation,
} from "../src/security/platform-access-release.ts";
import {
  PLATFORM_PROVISIONER_MANIFEST_MAXIMUM_BYTES,
  PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
} from "../src/security/platform-provisioner-manifest-loader.ts";

const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get;

/**
 * release-staging-manifestで使用するDirectory Identityの値契約を定義する。
 *
 * @responsibility Directory IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape DirectoryIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DirectoryIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: DirectoryIdentityの宣言は外部境界を開かない。
 * @security N/A: DirectoryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DirectoryIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DirectoryIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;

/**
 * release-staging-manifestで使用するManifest File Identityの値契約を定義する。
 *
 * @responsibility Manifest File IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ManifestFileIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ManifestFileIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: ManifestFileIdentityの宣言は外部境界を開かない。
 * @security N/A: ManifestFileIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ManifestFileIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ManifestFileIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  ctimeNs: bigint;
  mtimeNs: bigint;
  size: bigint;
  mode: bigint;
}>;

/**
 * release-staging-manifestで使用するStaging Snapshotの値契約を定義する。
 *
 * @responsibility Staging SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape StagingSnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StagingSnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: StagingSnapshotの宣言は外部境界を開かない。
 * @security N/A: StagingSnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility StagingSnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type StagingSnapshot = Readonly<{
  root: string;
  rootIdentity: DirectoryIdentity;
  toolDistributionDirectory: string;
  toolDistributionDirectoryIdentity: DirectoryIdentity;
  platformAccessArtifactToken: object;
}>;

const stagingSnapshots = new WeakMap<object, StagingSnapshot>();

/**
 * directory Identityを決定する。
 *
 * @responsibility directory Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input metadata: fs.BigIntStats
 * @returns DirectoryIdentityを返す。
 * @precondition 「metadata: fs.BigIntStats」がdirectoryIdentityの入力契約を満たす。
 * @postcondition directoryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: directoryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure directoryIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant directoryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: directoryIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: directoryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: directoryIdentityは共有非同期状態を持たない同期処理である。
 */
function directoryIdentity(metadata: fs.BigIntStats): DirectoryIdentity {
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    throw new Error("release_manifest_staging_session_invalid");
  }
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

/**
 * Directory Identityが同一かを判定する。
 *
 * @responsibility Directory Identityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000004
 * @input left: DirectoryIdentity、right: DirectoryIdentity
 * @returns booleanを返す。
 * @precondition 「left: DirectoryIdentity、right: DirectoryIdentity」がsameDirectoryIdentityの入力契約を満たす。
 * @postcondition sameDirectoryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameDirectoryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameDirectoryIdentityは独自の失敗分岐を所有しない。
 * @invariant sameDirectoryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameDirectoryIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: sameDirectoryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: sameDirectoryIdentityは共有非同期状態を持たない同期処理である。
 */
function sameDirectoryIdentity(
  left: DirectoryIdentity,
  right: DirectoryIdentity,
): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs
  );
}

/**
 * manifest File Identityを決定する。
 *
 * @responsibility manifest File Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input metadata: fs.BigIntStats、expectedSize: number
 * @returns ManifestFileIdentityを返す。
 * @precondition 「metadata: fs.BigIntStats、expectedSize: number」がmanifestFileIdentityの入力契約を満たす。
 * @postcondition manifestFileIdentityの責務を完了した結果だけを返す。
 * @effect N/A: manifestFileIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure manifestFileIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant manifestFileIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: manifestFileIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: manifestFileIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: manifestFileIdentityは共有非同期状態を持たない同期処理である。
 */
function manifestFileIdentity(
  metadata: fs.BigIntStats,
  expectedSize: number,
): ManifestFileIdentity {
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n ||
    metadata.size !== BigInt(expectedSize)
  ) {
    throw new Error("release_manifest_staging_changed_after_placement");
  }
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
    ctimeNs: metadata.ctimeNs,
    mtimeNs: metadata.mtimeNs,
    size: metadata.size,
    mode: metadata.mode,
  });
}

/**
 * Manifest File Identityが同一かを判定する。
 *
 * @responsibility Manifest File Identityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000004
 * @input left: ManifestFileIdentity、right: ManifestFileIdentity
 * @returns booleanを返す。
 * @precondition 「left: ManifestFileIdentity、right: ManifestFileIdentity」がsameManifestFileIdentityの入力契約を満たす。
 * @postcondition sameManifestFileIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameManifestFileIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameManifestFileIdentityは独自の失敗分岐を所有しない。
 * @invariant sameManifestFileIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameManifestFileIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: sameManifestFileIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: sameManifestFileIdentityは共有非同期状態を持たない同期処理である。
 */
function sameManifestFileIdentity(
  left: ManifestFileIdentity,
  right: ManifestFileIdentity,
): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.ctimeNs === right.ctimeNs &&
    left.mtimeNs === right.mtimeNs &&
    left.size === right.size &&
    left.mode === right.mode
  );
}

/**
 * Snapshotを検証する。
 *
 * @responsibility Snapshotの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input snapshot: StagingSnapshot
 * @returns booleanを返す。
 * @precondition 「snapshot: StagingSnapshot」がverifySnapshotの入力契約を満たす。
 * @postcondition verifySnapshotの責務を完了した結果だけを返す。
 * @effect verifySnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure verifySnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifySnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: verifySnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifySnapshotは共有非同期状態を持たない同期処理である。
 */
function verifySnapshot(snapshot: StagingSnapshot): boolean {
  try {
    const rootIdentity = directoryIdentity(
      fs.lstatSync(snapshot.root, { bigint: true }),
    );
    const toolDistributionDirectoryIdentity = directoryIdentity(
      fs.lstatSync(snapshot.toolDistributionDirectory, { bigint: true }),
    );
    return (
      sameDirectoryIdentity(snapshot.rootIdentity, rootIdentity) &&
      sameDirectoryIdentity(
        snapshot.toolDistributionDirectoryIdentity,
        toolDistributionDirectoryIdentity,
      ) &&
      fs.realpathSync.native(snapshot.root) === snapshot.root &&
      fs.realpathSync.native(snapshot.toolDistributionDirectory) ===
        snapshot.toolDistributionDirectory &&
      verifyPlatformAccessArtifactSigningObservation(
        snapshot.platformAccessArtifactToken,
      )
    );
  } catch {
    return false;
  }
}

/**
 * ReleaseStagingManifestErrorが担う状態と操作を提供する。
 *
 * @responsibility ReleaseStagingManifestErrorに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000004
 * @construction ReleaseStagingManifestErrorの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle ReleaseStagingManifestErrorが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: ReleaseStagingManifestErrorの宣言自体は実行時Effectを発行しない。
 * @failure N/A: ReleaseStagingManifestErrorの宣言自体は実行時失敗を所有しない。
 * @invariant ReleaseStagingManifestErrorで宣言した値と責務の対応を維持する。
 * @boundary N/A: ReleaseStagingManifestErrorの宣言は外部境界を開かない。
 * @security N/A: ReleaseStagingManifestErrorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ReleaseStagingManifestErrorは共有非同期状態を持たない同期処理である。
 */
export class ReleaseStagingManifestError extends Error {
  readonly reason = "release_manifest_staging_changed_after_placement";
  readonly releaseStagingFilesystemEffectIssued: boolean;
  readonly stagingRootMustBeDiscarded: boolean;

  constructor(
    isReleaseStagingFilesystemEffectIssued: boolean,
    shouldDiscardStagingRoot = isReleaseStagingFilesystemEffectIssued,
  ) {
    super("release_manifest_staging_changed_after_placement");
    this.name = "ReleaseStagingManifestError";
    this.releaseStagingFilesystemEffectIssued =
      isReleaseStagingFilesystemEffectIssued;
    this.stagingRootMustBeDiscarded = shouldDiscardStagingRoot;
  }
}

/**
 * Release Staging Manifest Sessionを開始する。
 *
 * @responsibility Release Staging Manifest Sessionの開始条件、初期状態、開始失敗境界を所有する。
 * @trace ARCH-000004
 * @input distributionRoot: unknown
 * @returns beginReleaseStagingManifestSessionの計算結果を返す。
 * @precondition 「distributionRoot: unknown」がbeginReleaseStagingManifestSessionの入力契約を満たす。
 * @postcondition beginReleaseStagingManifestSessionの責務を完了した結果だけを返す。
 * @effect beginReleaseStagingManifestSessionはFilesystemの読取りまたは書込みを実行する。
 * @failure beginReleaseStagingManifestSessionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant beginReleaseStagingManifestSessionは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: beginReleaseStagingManifestSessionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: beginReleaseStagingManifestSessionは共有非同期状態を持たない同期処理である。
 */
export function beginReleaseStagingManifestSession(distributionRoot: unknown) {
  try {
    if (
      typeof distributionRoot !== "string" ||
      distributionRoot.length === 0 ||
      distributionRoot.includes("\0") ||
      !path.isAbsolute(distributionRoot)
    ) {
      return null;
    }
    const root = path.resolve(distributionRoot);
    const rootIdentity = directoryIdentity(
      fs.lstatSync(root, { bigint: true }),
    );
    const toolDistributionDirectory = path.join(
      root,
      "template",
      "tools",
      "coordinator",
    );
    const toolDistributionDirectoryIdentity = directoryIdentity(
      fs.lstatSync(toolDistributionDirectory, { bigint: true }),
    );
    if (
      fs.realpathSync.native(root) !== root ||
      fs.realpathSync.native(toolDistributionDirectory) !==
        toolDistributionDirectory
    ) {
      return null;
    }
    const artifactObservation =
      beginPlatformAccessArtifactSigningObservation(root);
    if (!artifactObservation) return null;
    const token = Object.freeze({});
    stagingSnapshots.set(
      token,
      Object.freeze({
        root,
        rootIdentity,
        toolDistributionDirectory,
        toolDistributionDirectoryIdentity,
        platformAccessArtifactToken: artifactObservation.token,
      }),
    );
    return Object.freeze({
      token,
      platformAccessArtifact: artifactObservation.artifact,
    });
  } catch {
    return null;
  }
}

/**
 * Release Staging Manifest Sessionを検証する。
 *
 * @responsibility Release Staging Manifest Sessionの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input token: object
 * @returns booleanを返す。
 * @precondition 「token: object」がverifyReleaseStagingManifestSessionの入力契約を満たす。
 * @postcondition verifyReleaseStagingManifestSessionの責務を完了した結果だけを返す。
 * @effect N/A: verifyReleaseStagingManifestSessionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifyReleaseStagingManifestSessionは独自の失敗分岐を所有しない。
 * @invariant verifyReleaseStagingManifestSessionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyReleaseStagingManifestSessionはProcess内の同一Subsystemで完結する。
 * @security verifyReleaseStagingManifestSessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyReleaseStagingManifestSessionは共有非同期状態を持たない同期処理である。
 */
export function verifyReleaseStagingManifestSession(token: object): boolean {
  const snapshot = stagingSnapshots.get(token);
  return snapshot ? verifySnapshot(snapshot) : false;
}

/**
 * place Release Staging Manifest 候補を決定する。
 *
 * @responsibility place Release Staging Manifest 候補の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input token: object、canonicalBytes: unknown
 * @returns placeReleaseStagingManifestCandidateの計算結果を返す。
 * @precondition 「token: object、canonicalBytes: unknown」がplaceReleaseStagingManifestCandidateの入力契約を満たす。
 * @postcondition placeReleaseStagingManifestCandidateの責務を完了した結果だけを返す。
 * @effect placeReleaseStagingManifestCandidateはFilesystemの読取りまたは書込みを実行する。
 * @failure placeReleaseStagingManifestCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant placeReleaseStagingManifestCandidateは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security placeReleaseStagingManifestCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: placeReleaseStagingManifestCandidateは共有非同期状態を持たない同期処理である。
 */
export function placeReleaseStagingManifestCandidate(
  token: object,
  canonicalBytes: unknown,
) {
  let isReleaseStagingFilesystemEffectIssued = false;
  let descriptor: number | null = null;
  try {
    const snapshot = stagingSnapshots.get(token);
    if (
      !snapshot ||
      !Buffer.isBuffer(canonicalBytes) ||
      typeof TYPED_ARRAY_BYTE_LENGTH !== "function"
    ) {
      throw new ReleaseStagingManifestError(false);
    }
    const byteLength = Reflect.apply(
      TYPED_ARRAY_BYTE_LENGTH,
      canonicalBytes,
      [],
    );
    if (
      typeof byteLength !== "number" ||
      !Number.isSafeInteger(byteLength) ||
      byteLength < 1 ||
      byteLength > PLATFORM_PROVISIONER_MANIFEST_MAXIMUM_BYTES
    ) {
      throw new ReleaseStagingManifestError(false);
    }
    const ownedCanonicalBytes = Buffer.allocUnsafe(byteLength);
    Uint8Array.prototype.set.call(ownedCanonicalBytes, canonicalBytes);
    if (!verifySnapshot(snapshot)) {
      throw new ReleaseStagingManifestError(false);
    }
    const manifestPath = path.join(
      snapshot.root,
      ...PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH.split("/"),
    );
    const noFollow =
      process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
    try {
      descriptor = fs.openSync(
        manifestPath,
        fs.constants.O_CREAT |
          fs.constants.O_EXCL |
          fs.constants.O_RDWR |
          noFollow,
        0o644,
      );
    } catch {
      throw new ReleaseStagingManifestError(false, true);
    }
    isReleaseStagingFilesystemEffectIssued = true;
    manifestFileIdentity(fs.fstatSync(descriptor, { bigint: true }), 0);
    let written = 0;
    while (written < ownedCanonicalBytes.length) {
      const count = fs.writeSync(
        descriptor,
        ownedCanonicalBytes,
        written,
        ownedCanonicalBytes.length - written,
        written,
      );
      if (count <= 0) throw new ReleaseStagingManifestError(true);
      written += count;
    }
    fs.fsyncSync(descriptor);
    const postWrite = manifestFileIdentity(
      fs.fstatSync(descriptor, { bigint: true }),
      ownedCanonicalBytes.length,
    );
    const observedBytes = Buffer.allocUnsafe(ownedCanonicalBytes.length + 1);
    let observedLength = 0;
    while (observedLength < observedBytes.length) {
      const count = fs.readSync(
        descriptor,
        observedBytes,
        observedLength,
        observedBytes.length - observedLength,
        observedLength,
      );
      if (count === 0) break;
      observedLength += count;
    }
    const afterRead = manifestFileIdentity(
      fs.fstatSync(descriptor, { bigint: true }),
      ownedCanonicalBytes.length,
    );
    const pathAfter = manifestFileIdentity(
      fs.lstatSync(manifestPath, { bigint: true }),
      ownedCanonicalBytes.length,
    );
    if (
      observedLength !== ownedCanonicalBytes.length ||
      !observedBytes.subarray(0, observedLength).equals(ownedCanonicalBytes) ||
      !sameManifestFileIdentity(postWrite, afterRead) ||
      !sameManifestFileIdentity(postWrite, pathAfter) ||
      fs.realpathSync.native(manifestPath) !== manifestPath ||
      !verifySnapshot(snapshot)
    ) {
      throw new ReleaseStagingManifestError(true);
    }
    fs.closeSync(descriptor);
    descriptor = null;
    return Object.freeze({
      status: "placed" as const,
      manifestRelativePath: PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
      releaseStagingFilesystemEffectIssued: true as const,
      stagingRootMustBeDiscarded: false as const,
      runtimeFilesystemEffectIssued: false as const,
      provisioningFilesystemEffectIssued: false as const,
      runtimeAuthorityConferred: false as const,
      runtimeCapabilityIssued: false as const,
    });
  } catch (error) {
    if (descriptor !== null) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Preserve the first fail-closed placement failure and its Effect metadata.
      }
      descriptor = null;
    }
    if (error instanceof ReleaseStagingManifestError) throw error;
    throw new ReleaseStagingManifestError(
      isReleaseStagingFilesystemEffectIssued,
    );
  }
}

/**
 * Release Staging Manifest 契約の公開契約を記述する。
 *
 * @responsibility Release Staging Manifest 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeReleaseStagingManifestContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeReleaseStagingManifestContractの入力契約を満たす。
 * @postcondition describeReleaseStagingManifestContractの責務を完了した結果だけを返す。
 * @effect N/A: describeReleaseStagingManifestContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeReleaseStagingManifestContractは独自の失敗分岐を所有しない。
 * @invariant describeReleaseStagingManifestContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeReleaseStagingManifestContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeReleaseStagingManifestContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeReleaseStagingManifestContractは共有非同期状態を持たない同期処理である。
 */
export function describeReleaseStagingManifestContract() {
  return Object.freeze({
    contract: "crdd-coordinator/release-staging-manifest",
    contractRevision: 2,
    manifestRelativePath: PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
    releaseStagingManifestWrite: "implemented_explicit_signing_effect",
    releaseStagingFilesystemEffectIssuedOnSuccess: true,
    failedAfterCreateRequiresStagingRootDiscard: true,
    runtimeFilesystemEffectIssued: false,
    provisioningFilesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    productionRuntimeImportAllowed: false,
  });
}
