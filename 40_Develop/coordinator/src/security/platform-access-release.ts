/**
 * platform-access-releaseに属する責務をまとめる。
 *
 * @responsibility FileIdentityを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000014
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const PLATFORM_ACCESS_TARGET = "x86_64-pc-windows-msvc";
export const PLATFORM_ACCESS_RUST_TOOLCHAIN = "1.94.1";
export const PLATFORM_ACCESS_PROTOCOL_REVISION = 3;
export const PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES = 16 * 1024 * 1024;
export const PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH =
  "template/tools/coordinator/windows-x64/crdd-platform-access.exe";

/**
 * platform-access-releaseで使用するFile Identityの値契約を定義する。
 *
 * @responsibility File IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape FileIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FileIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: FileIdentityの宣言は外部境界を開かない。
 * @security FileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility FileIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type FileIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  ctimeNs: bigint;
  mtimeNs: bigint;
  size: bigint;
  mode: bigint;
}>;

/**
 * platform-access-releaseで使用するDirectory Identityの値契約を定義する。
 *
 * @responsibility Directory IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape DirectoryIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DirectoryIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: DirectoryIdentityの宣言は外部境界を開かない。
 * @security DirectoryIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DirectoryIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DirectoryIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;

const signingSnapshots = new WeakMap<
  object,
  Readonly<{
    root: string;
    rootIdentity: DirectoryIdentity;
    executablePath: string;
    fileIdentity: FileIdentity;
    artifact: Readonly<{
      relativePath: string;
      target: string;
      protocolRevision: number;
      rustToolchain: string;
      byteLength: number;
      sha256: string;
    }>;
  }>
>();

/**
 * file Identityを決定する。
 *
 * @responsibility file Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input metadata: fs.BigIntStats
 * @returns FileIdentityを返す。
 * @precondition 「metadata: fs.BigIntStats」がfileIdentityの入力契約を満たす。
 * @postcondition fileIdentityの責務を完了した結果だけを返す。
 * @effect N/A: fileIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure fileIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant fileIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: fileIdentityはProcess内の同一Subsystemで完結する。
 * @security fileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: fileIdentityは共有非同期状態を持たない同期処理である。
 */
function fileIdentity(metadata: fs.BigIntStats): FileIdentity {
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n ||
    metadata.size <= 0n ||
    metadata.size > BigInt(PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES)
  ) {
    throw new Error("platform_access_release_executable_invalid");
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
 * Identityが同一かを判定する。
 *
 * @responsibility Identityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000014
 * @input left: FileIdentity、right: FileIdentity
 * @returns booleanを返す。
 * @precondition 「left: FileIdentity、right: FileIdentity」がsameIdentityの入力契約を満たす。
 * @postcondition sameIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameIdentityは独自の失敗分岐を所有しない。
 * @invariant sameIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameIdentityはProcess内の同一Subsystemで完結する。
 * @security sameIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameIdentityは共有非同期状態を持たない同期処理である。
 */
function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
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
 * directory Identityを決定する。
 *
 * @responsibility directory Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input metadata: fs.BigIntStats
 * @returns DirectoryIdentityを返す。
 * @precondition 「metadata: fs.BigIntStats」がdirectoryIdentityの入力契約を満たす。
 * @postcondition directoryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: directoryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure directoryIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant directoryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: directoryIdentityはProcess内の同一Subsystemで完結する。
 * @security directoryIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
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
    throw new Error("platform_access_release_distribution_invalid");
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
 * @trace ARCH-000014
 * @input left: DirectoryIdentity、right: DirectoryIdentity
 * @returns booleanを返す。
 * @precondition 「left: DirectoryIdentity、right: DirectoryIdentity」がsameDirectoryIdentityの入力契約を満たす。
 * @postcondition sameDirectoryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameDirectoryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameDirectoryIdentityは独自の失敗分岐を所有しない。
 * @invariant sameDirectoryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameDirectoryIdentityはProcess内の同一Subsystemで完結する。
 * @security sameDirectoryIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
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
 * distribution Root Snapshotを決定する。
 *
 * @responsibility distribution Root Snapshotの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input raw: unknown
 * @returns distributionRootSnapshotの計算結果を返す。
 * @precondition 「raw: unknown」がdistributionRootSnapshotの入力契約を満たす。
 * @postcondition distributionRootSnapshotの責務を完了した結果だけを返す。
 * @effect distributionRootSnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure distributionRootSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant distributionRootSnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security distributionRootSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: distributionRootSnapshotは共有非同期状態を持たない同期処理である。
 */
function distributionRootSnapshot(raw: unknown) {
  if (
    typeof raw !== "string" ||
    raw.length === 0 ||
    raw.includes("\0") ||
    !path.isAbsolute(raw)
  ) {
    throw new Error("platform_access_release_distribution_invalid");
  }
  const root = path.resolve(raw);
  const identity = directoryIdentity(fs.lstatSync(root, { bigint: true }));
  if (fs.realpathSync.native(root) !== root) {
    throw new Error("platform_access_release_distribution_invalid");
  }
  return Object.freeze({ root, identity });
}

/**
 * Distribution Root Snapshotを検証する。
 *
 * @responsibility Distribution Root Snapshotの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000014
 * @input snapshot: { root: string; identity: DirectoryIdentity; }
 * @returns verifyDistributionRootSnapshotの計算結果を返す。
 * @precondition 「snapshot: { root: string; identity: DirectoryIdentity; }」がverifyDistributionRootSnapshotの入力契約を満たす。
 * @postcondition verifyDistributionRootSnapshotの責務を完了した結果だけを返す。
 * @effect verifyDistributionRootSnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: verifyDistributionRootSnapshotは独自の失敗分岐を所有しない。
 * @invariant verifyDistributionRootSnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security verifyDistributionRootSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyDistributionRootSnapshotは共有非同期状態を持たない同期処理である。
 */
function verifyDistributionRootSnapshot(snapshot: {
  root: string;
  identity: DirectoryIdentity;
}) {
  const current = directoryIdentity(
    fs.lstatSync(snapshot.root, { bigint: true }),
  );
  return (
    sameDirectoryIdentity(snapshot.identity, current) &&
    fs.realpathSync.native(snapshot.root) === snapshot.root
  );
}

/**
 * Artifact Snapshotを観測する。
 *
 * @responsibility Artifact Snapshotの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000014
 * @input distributionRoot: unknown
 * @returns observeArtifactSnapshotの計算結果を返す。
 * @precondition 「distributionRoot: unknown」がobserveArtifactSnapshotの入力契約を満たす。
 * @postcondition observeArtifactSnapshotの責務を完了した結果だけを返す。
 * @effect observeArtifactSnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure observeArtifactSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeArtifactSnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security observeArtifactSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeArtifactSnapshotは共有非同期状態を持たない同期処理である。
 */
function observeArtifactSnapshot(distributionRoot: unknown) {
  const rootSnapshot = distributionRootSnapshot(distributionRoot);
  const root = rootSnapshot.root;
  const executablePath = path.join(
    root,
    ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
  );
  const before = fileIdentity(fs.lstatSync(executablePath, { bigint: true }));
  if (fs.realpathSync.native(executablePath) !== executablePath) {
    throw new Error("platform_access_release_executable_invalid");
  }
  const descriptor = fs.openSync(executablePath, fs.constants.O_RDONLY);
  try {
    const opened = fileIdentity(fs.fstatSync(descriptor, { bigint: true }));
    if (!sameIdentity(before, opened)) {
      throw new Error("platform_access_release_executable_changed");
    }
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let byteLength = 0;
    while (true) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      byteLength += count;
      if (byteLength > PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES) {
        throw new Error("platform_access_release_executable_invalid");
      }
      hash.update(buffer.subarray(0, count));
    }
    const after = fileIdentity(fs.fstatSync(descriptor, { bigint: true }));
    const pathAfter = fileIdentity(
      fs.lstatSync(executablePath, { bigint: true }),
    );
    if (
      BigInt(byteLength) !== opened.size ||
      !sameIdentity(opened, after) ||
      !sameIdentity(opened, pathAfter) ||
      fs.realpathSync.native(executablePath) !== executablePath ||
      !verifyDistributionRootSnapshot(rootSnapshot)
    ) {
      throw new Error("platform_access_release_executable_changed");
    }
    return Object.freeze({
      rootSnapshot,
      executablePath,
      fileIdentity: opened,
      artifact: Object.freeze({
        relativePath: PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
        target: PLATFORM_ACCESS_TARGET,
        protocolRevision: PLATFORM_ACCESS_PROTOCOL_REVISION,
        rustToolchain: PLATFORM_ACCESS_RUST_TOOLCHAIN,
        byteLength,
        sha256: hash.digest("hex"),
      }),
    });
  } finally {
    fs.closeSync(descriptor);
  }
}

/**
 * Platform Access Release Artifact 候補を観測する。
 *
 * @responsibility Platform Access Release Artifact 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000014
 * @input distributionRoot: unknown
 * @returns observePlatformAccessReleaseArtifactCandidateの計算結果を返す。
 * @precondition 「distributionRoot: unknown」がobservePlatformAccessReleaseArtifactCandidateの入力契約を満たす。
 * @postcondition observePlatformAccessReleaseArtifactCandidateの責務を完了した結果だけを返す。
 * @effect N/A: observePlatformAccessReleaseArtifactCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observePlatformAccessReleaseArtifactCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observePlatformAccessReleaseArtifactCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observePlatformAccessReleaseArtifactCandidateはProcess内の同一Subsystemで完結する。
 * @security observePlatformAccessReleaseArtifactCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observePlatformAccessReleaseArtifactCandidateは共有非同期状態を持たない同期処理である。
 */
export function observePlatformAccessReleaseArtifactCandidate(
  distributionRoot: unknown,
) {
  try {
    const snapshot = observeArtifactSnapshot(distributionRoot);
    return Object.freeze({
      status: "candidate" as const,
      reason: "platform_access_release_artifact_observed_candidate",
      artifact: snapshot.artifact,
      absolutePathReported: false,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "platform_access_release_artifact_invalid",
      artifact: null,
      absolutePathReported: false,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  }
}

/**
 * Platform Access Artifact Signing Observationを開始する。
 *
 * @responsibility Platform Access Artifact Signing Observationの開始条件、初期状態、開始失敗境界を所有する。
 * @trace ARCH-000014
 * @input distributionRoot: unknown
 * @returns beginPlatformAccessArtifactSigningObservationの計算結果を返す。
 * @precondition 「distributionRoot: unknown」がbeginPlatformAccessArtifactSigningObservationの入力契約を満たす。
 * @postcondition beginPlatformAccessArtifactSigningObservationの責務を完了した結果だけを返す。
 * @effect N/A: beginPlatformAccessArtifactSigningObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure beginPlatformAccessArtifactSigningObservationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant beginPlatformAccessArtifactSigningObservationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: beginPlatformAccessArtifactSigningObservationはProcess内の同一Subsystemで完結する。
 * @security beginPlatformAccessArtifactSigningObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: beginPlatformAccessArtifactSigningObservationは共有非同期状態を持たない同期処理である。
 */
export function beginPlatformAccessArtifactSigningObservation(
  distributionRoot: unknown,
) {
  try {
    const observed = observeArtifactSnapshot(distributionRoot);
    const token = Object.freeze({});
    signingSnapshots.set(
      token,
      Object.freeze({
        root: observed.rootSnapshot.root,
        rootIdentity: observed.rootSnapshot.identity,
        executablePath: observed.executablePath,
        fileIdentity: observed.fileIdentity,
        artifact: observed.artifact,
      }),
    );
    return Object.freeze({ token, artifact: observed.artifact });
  } catch {
    return null;
  }
}

/**
 * Platform Access Artifact Signing Observationを検証する。
 *
 * @responsibility Platform Access Artifact Signing Observationの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000014
 * @input token: object
 * @returns booleanを返す。
 * @precondition 「token: object」がverifyPlatformAccessArtifactSigningObservationの入力契約を満たす。
 * @postcondition verifyPlatformAccessArtifactSigningObservationの責務を完了した結果だけを返す。
 * @effect N/A: verifyPlatformAccessArtifactSigningObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyPlatformAccessArtifactSigningObservationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyPlatformAccessArtifactSigningObservationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyPlatformAccessArtifactSigningObservationはProcess内の同一Subsystemで完結する。
 * @security verifyPlatformAccessArtifactSigningObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyPlatformAccessArtifactSigningObservationは共有非同期状態を持たない同期処理である。
 */
export function verifyPlatformAccessArtifactSigningObservation(
  token: object,
): boolean {
  try {
    const snapshot = signingSnapshots.get(token);
    if (!snapshot) return false;
    const rootSnapshot = Object.freeze({
      root: snapshot.root,
      identity: snapshot.rootIdentity,
    });
    const observed = observeArtifactSnapshot(snapshot.root);
    return (
      observed.executablePath === snapshot.executablePath &&
      sameIdentity(snapshot.fileIdentity, observed.fileIdentity) &&
      observed.artifact.byteLength === snapshot.artifact.byteLength &&
      observed.artifact.sha256 === snapshot.artifact.sha256 &&
      verifyDistributionRootSnapshot(rootSnapshot)
    );
  } catch {
    return false;
  }
}

/**
 * Platform Access Release 契約の公開契約を記述する。
 *
 * @responsibility Platform Access Release 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describePlatformAccessReleaseContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribePlatformAccessReleaseContractの入力契約を満たす。
 * @postcondition describePlatformAccessReleaseContractの責務を完了した結果だけを返す。
 * @effect N/A: describePlatformAccessReleaseContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describePlatformAccessReleaseContractは独自の失敗分岐を所有しない。
 * @invariant describePlatformAccessReleaseContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describePlatformAccessReleaseContractはProcess内の同一Subsystemで完結する。
 * @security describePlatformAccessReleaseContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describePlatformAccessReleaseContractは共有非同期状態を持たない同期処理である。
 */
export function describePlatformAccessReleaseContract() {
  return Object.freeze({
    artifactRelativePath: PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
    target: PLATFORM_ACCESS_TARGET,
    rustToolchain: PLATFORM_ACCESS_RUST_TOOLCHAIN,
    protocolRevision: PLATFORM_ACCESS_PROTOCOL_REVISION,
    maximumExecutableBytes: PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES,
    signedManifestBinding: "implemented_candidate",
    stableSameFileHashObservation: "implemented_candidate",
    pathEnvironmentLookup: false,
    absolutePathReported: false,
    artifactObservationFilesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
