/**
 * release-manifest-promotionに属する責務をまとめる。
 *
 * @responsibility Identityを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  PLATFORM_PROVISIONER_MANIFEST_MAXIMUM_BYTES,
  PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
} from "../src/security/platform-provisioner-manifest-loader.ts";

/**
 * release-manifest-promotionで使用するIdentityの値契約を定義する。
 *
 * @responsibility IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Identityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Identityで宣言した値と責務の対応を維持する。
 * @boundary N/A: Identityの宣言は外部境界を開かない。
 * @security N/A: IdentityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility Identityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Identity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
  size: bigint;
  mode: bigint;
  nlink: bigint;
}>;

/**
 * release-manifest-promotionで使用するSnapshotの値契約を定義する。
 *
 * @responsibility SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Snapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Snapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: Snapshotの宣言は外部境界を開かない。
 * @security N/A: SnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility Snapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Snapshot = Readonly<{ path: string; identity: Identity }>;
/**
 * release-manifest-promotionで使用するSession Modeの値契約を定義する。
 *
 * @responsibility Session ModeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape SessionModeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SessionModeで宣言した値と責務の対応を維持する。
 * @boundary N/A: SessionModeの宣言は外部境界を開かない。
 * @security N/A: SessionModeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SessionModeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SessionMode = "ready" | "linked_pending" | "transferred";
/**
 * release-manifest-promotionで使用するSessionの値契約を定義する。
 *
 * @responsibility SessionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Sessionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Sessionで宣言した値と責務の対応を維持する。
 * @boundary N/A: Sessionの宣言は外部境界を開かない。
 * @security N/A: SessionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility Sessionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Session = Readonly<{
  mode: SessionMode;
  sourceRoot: Snapshot;
  sourceParent: Snapshot;
  sourceManifestPath: string;
  sourceManifest: Snapshot | null;
  destinationRoot: Snapshot;
  destinationParent: Snapshot;
  destinationManifestPath: string;
  destinationManifest: Snapshot | null;
  manifestBytes: Buffer;
  manifestSha256: string;
}>;

const sessions = new WeakMap<object, Session>();
const completedSessions = new WeakMap<object, Session>();

/**
 * identityを決定する。
 *
 * @responsibility identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input metadata: fs.BigIntStats
 * @returns Identityを返す。
 * @precondition 「metadata: fs.BigIntStats」がidentityの入力契約を満たす。
 * @postcondition identityの責務を完了した結果だけを返す。
 * @effect N/A: identityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: identityは独自の失敗分岐を所有しない。
 * @invariant identityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: identityはProcess内の同一Subsystemで完結する。
 * @security N/A: identityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: identityは共有非同期状態を持たない同期処理である。
 */
function identity(metadata: fs.BigIntStats): Identity {
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
    mtimeNs: metadata.mtimeNs,
    ctimeNs: metadata.ctimeNs,
    size: metadata.size,
    mode: metadata.mode,
    nlink: metadata.nlink,
  });
}

/**
 * Identityが同一かを判定する。
 *
 * @responsibility Identityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000004
 * @input left: Identity、right: Identity
 * @returns sameIdentityの計算結果を返す。
 * @precondition 「left: Identity、right: Identity」がsameIdentityの入力契約を満たす。
 * @postcondition sameIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameIdentityは独自の失敗分岐を所有しない。
 * @invariant sameIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: sameIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: sameIdentityは共有非同期状態を持たない同期処理である。
 */
function sameIdentity(left: Identity, right: Identity) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs &&
    left.size === right.size &&
    left.mode === right.mode &&
    left.nlink === right.nlink
  );
}

/**
 * Directory Identityが同一かを判定する。
 *
 * @responsibility Directory Identityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000004
 * @input left: Identity、right: Identity
 * @returns sameDirectoryIdentityの計算結果を返す。
 * @precondition 「left: Identity、right: Identity」がsameDirectoryIdentityの入力契約を満たす。
 * @postcondition sameDirectoryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameDirectoryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameDirectoryIdentityは独自の失敗分岐を所有しない。
 * @invariant sameDirectoryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameDirectoryIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: sameDirectoryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: sameDirectoryIdentityは共有非同期状態を持たない同期処理である。
 */
function sameDirectoryIdentity(left: Identity, right: Identity) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.mode === right.mode
  );
}

/**
 * File Objectが同一かを判定する。
 *
 * @responsibility File Objectの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000004
 * @input left: Identity、right: Identity
 * @returns sameFileObjectの計算結果を返す。
 * @precondition 「left: Identity、right: Identity」がsameFileObjectの入力契約を満たす。
 * @postcondition sameFileObjectの責務を完了した結果だけを返す。
 * @effect N/A: sameFileObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameFileObjectは独自の失敗分岐を所有しない。
 * @invariant sameFileObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameFileObjectはProcess内の同一Subsystemで完結する。
 * @security N/A: sameFileObjectはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: sameFileObjectは共有非同期状態を持たない同期処理である。
 */
function sameFileObject(left: Identity, right: Identity) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs
  );
}

/**
 * directory Snapshotを決定する。
 *
 * @responsibility directory Snapshotの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input target: string
 * @returns Snapshotを返す。
 * @precondition 「target: string」がdirectorySnapshotの入力契約を満たす。
 * @postcondition directorySnapshotの責務を完了した結果だけを返す。
 * @effect directorySnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure directorySnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant directorySnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: directorySnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: directorySnapshotは共有非同期状態を持たない同期処理である。
 */
function directorySnapshot(target: string): Snapshot {
  const resolved = path.resolve(target);
  const metadata = fs.lstatSync(resolved, { bigint: true });
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(resolved) !== resolved
  )
    throw new Error("release_manifest_promotion_directory_invalid");
  return Object.freeze({ path: resolved, identity: identity(metadata) });
}

/**
 * Directoryを検証する。
 *
 * @responsibility Directoryの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input snapshot: Snapshot
 * @returns N/A: verifyDirectoryは戻り値を返さない。
 * @precondition 「snapshot: Snapshot」がverifyDirectoryの入力契約を満たす。
 * @postcondition verifyDirectoryの責務を完了して呼出し元へ制御を戻す。
 * @effect verifyDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure verifyDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: verifyDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifyDirectoryは共有非同期状態を持たない同期処理である。
 */
function verifyDirectory(snapshot: Snapshot) {
  const metadata = fs.lstatSync(snapshot.path, { bigint: true });
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    !sameDirectoryIdentity(snapshot.identity, identity(metadata)) ||
    fs.realpathSync.native(snapshot.path) !== snapshot.path
  )
    throw new Error("release_manifest_promotion_boundary_changed");
}

/**
 * file Snapshotを決定する。
 *
 * @responsibility file Snapshotの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input target: string
 * @returns Snapshotを返す。
 * @precondition 「target: string」がfileSnapshotの入力契約を満たす。
 * @postcondition fileSnapshotの責務を完了した結果だけを返す。
 * @effect fileSnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure fileSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant fileSnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: fileSnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: fileSnapshotは共有非同期状態を持たない同期処理である。
 */
function fileSnapshot(target: string): Snapshot {
  const resolved = path.resolve(target);
  const metadata = fs.lstatSync(resolved, { bigint: true });
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size < 1n ||
    metadata.size > BigInt(PLATFORM_PROVISIONER_MANIFEST_MAXIMUM_BYTES) ||
    fs.realpathSync.native(resolved) !== resolved
  )
    throw new Error("release_manifest_promotion_file_invalid");
  return Object.freeze({ path: resolved, identity: identity(metadata) });
}

/**
 * optional File Snapshotを決定する。
 *
 * @responsibility optional File Snapshotの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input target: string
 * @returns optionalFileSnapshotの計算結果を返す。
 * @precondition 「target: string」がoptionalFileSnapshotの入力契約を満たす。
 * @postcondition optionalFileSnapshotの責務を完了した結果だけを返す。
 * @effect N/A: optionalFileSnapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure optionalFileSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant optionalFileSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: optionalFileSnapshotはProcess内の同一Subsystemで完結する。
 * @security N/A: optionalFileSnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: optionalFileSnapshotは共有非同期状態を持たない同期処理である。
 */
function optionalFileSnapshot(target: string) {
  try {
    return fileSnapshot(target);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return null;
    throw error;
  }
}

/**
 * Stable Fileを読み取る。
 *
 * @responsibility Stable Fileの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input snapshot: Snapshot
 * @returns readStableFileの計算結果を返す。
 * @precondition 「snapshot: Snapshot」がreadStableFileの入力契約を満たす。
 * @postcondition readStableFileの責務を完了した結果だけを返す。
 * @effect readStableFileはFilesystemの読取りまたは書込みを実行する。
 * @failure readStableFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readStableFileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readStableFileはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readStableFileは共有非同期状態を持たない同期処理である。
 */
function readStableFile(snapshot: Snapshot) {
  const noFollow =
    process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
  const descriptor = fs.openSync(
    snapshot.path,
    fs.constants.O_RDONLY | noFollow,
  );
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (!sameIdentity(snapshot.identity, identity(opened)))
      throw new Error("release_manifest_promotion_file_changed");
    const bytes = Buffer.alloc(Number(opened.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (count <= 0)
        throw new Error("release_manifest_promotion_file_changed");
      offset += count;
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    const pathAfter = fs.lstatSync(snapshot.path, { bigint: true });
    if (
      !sameIdentity(snapshot.identity, identity(after)) ||
      !sameIdentity(snapshot.identity, identity(pathAfter)) ||
      fs.realpathSync.native(snapshot.path) !== snapshot.path
    )
      throw new Error("release_manifest_promotion_file_changed");
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

/**
 * manifest Pathを決定する。
 *
 * @responsibility manifest Pathの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input root: string
 * @returns manifestPathの計算結果を返す。
 * @precondition 「root: string」がmanifestPathの入力契約を満たす。
 * @postcondition manifestPathの責務を完了した結果だけを返す。
 * @effect N/A: manifestPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: manifestPathは独自の失敗分岐を所有しない。
 * @invariant manifestPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: manifestPathはProcess内の同一Subsystemで完結する。
 * @security N/A: manifestPathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: manifestPathは共有非同期状態を持たない同期処理である。
 */
function manifestPath(root: string) {
  return path.join(
    root,
    ...PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH.split("/"),
  );
}

/**
 * sha256を決定する。
 *
 * @responsibility sha256の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input bytes: Buffer
 * @returns sha256の計算結果を返す。
 * @precondition 「bytes: Buffer」がsha256の入力契約を満たす。
 * @postcondition sha256の責務を完了した結果だけを返す。
 * @effect N/A: sha256は入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sha256は独自の失敗分岐を所有しない。
 * @invariant sha256は入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sha256はProcess内の同一Subsystemで完結する。
 * @security N/A: sha256はAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: sha256は共有非同期状態を持たない同期処理である。
 */
function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Fileを検証する。
 *
 * @responsibility Fileの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input snapshot: Snapshot、expectedBytes: Buffer、expectedSha256: string
 * @returns N/A: verifyFileは戻り値を返さない。
 * @precondition 「snapshot: Snapshot、expectedBytes: Buffer、expectedSha256: string」がverifyFileの入力契約を満たす。
 * @postcondition verifyFileの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: verifyFileは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyFileは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyFileはProcess内の同一Subsystemで完結する。
 * @security N/A: verifyFileはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifyFileは共有非同期状態を持たない同期処理である。
 */
function verifyFile(
  snapshot: Snapshot,
  expectedBytes: Buffer,
  expectedSha256: string,
) {
  const bytes = readStableFile(snapshot);
  if (!bytes.equals(expectedBytes) || sha256(bytes) !== expectedSha256)
    throw new Error("release_manifest_promotion_byte_mismatch");
}

/**
 * Sessionを観測する。
 *
 * @responsibility Sessionの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input sourceDistributionRoot: string、destinationRepositoryRoot: string、expectedManifestSha256: string
 * @returns Sessionを返す。
 * @precondition 「sourceDistributionRoot: string、destinationRepositoryRoot: string、expectedManifestSha256: string」がinspectSessionの入力契約を満たす。
 * @postcondition inspectSessionの責務を完了した結果だけを返す。
 * @effect N/A: inspectSessionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectSessionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectSessionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectSessionはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectSessionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectSessionは共有非同期状態を持たない同期処理である。
 */
function inspectSession(
  sourceDistributionRoot: string,
  destinationRepositoryRoot: string,
  expectedManifestSha256: string,
): Session {
  const sourceRoot = directorySnapshot(sourceDistributionRoot);
  const destinationRoot = directorySnapshot(destinationRepositoryRoot);
  if (sourceRoot.path === destinationRoot.path)
    throw new Error("release_manifest_promotion_root_conflict");
  const sourceManifestPath = manifestPath(sourceRoot.path);
  const destinationManifestPath = manifestPath(destinationRoot.path);
  const sourceParent = directorySnapshot(path.dirname(sourceManifestPath));
  const destinationParent = directorySnapshot(
    path.dirname(destinationManifestPath),
  );
  const sourceManifest = optionalFileSnapshot(sourceManifestPath);
  const destinationManifest = optionalFileSnapshot(destinationManifestPath);
  if (!sourceManifest && !destinationManifest)
    throw new Error("release_manifest_promotion_manifest_missing");
  const observedManifest = sourceManifest ?? destinationManifest;
  if (!observedManifest)
    throw new Error("release_manifest_promotion_manifest_missing");
  const manifestBytes = readStableFile(observedManifest);
  if (sha256(manifestBytes) !== expectedManifestSha256)
    throw new Error("release_manifest_promotion_hash_mismatch");
  if (sourceManifest)
    verifyFile(sourceManifest, manifestBytes, expectedManifestSha256);
  if (destinationManifest)
    verifyFile(destinationManifest, manifestBytes, expectedManifestSha256);
  if (
    sourceManifest &&
    destinationManifest &&
    !sameFileObject(sourceManifest.identity, destinationManifest.identity)
  )
    throw new Error("release_manifest_promotion_dual_identity");
  return Object.freeze({
    mode: !sourceManifest
      ? "transferred"
      : destinationManifest
        ? "linked_pending"
        : "ready",
    sourceRoot,
    sourceParent,
    sourceManifestPath,
    sourceManifest,
    destinationRoot,
    destinationParent,
    destinationManifestPath,
    destinationManifest,
    manifestBytes,
    manifestSha256: expectedManifestSha256,
  });
}

/**
 * Sessionを検証する。
 *
 * @responsibility Sessionの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input session: Session
 * @returns verifySessionの計算結果を返す。
 * @precondition 「session: Session」がverifySessionの入力契約を満たす。
 * @postcondition verifySessionの責務を完了した結果だけを返す。
 * @effect N/A: verifySessionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifySessionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifySessionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifySessionはProcess内の同一Subsystemで完結する。
 * @security N/A: verifySessionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifySessionは共有非同期状態を持たない同期処理である。
 */
function verifySession(session: Session) {
  verifyDirectory(session.sourceRoot);
  verifyDirectory(session.sourceParent);
  verifyDirectory(session.destinationRoot);
  verifyDirectory(session.destinationParent);
  const source = optionalFileSnapshot(session.sourceManifestPath);
  const destination = optionalFileSnapshot(session.destinationManifestPath);
  if (session.mode === "ready") {
    if (!source || destination || !session.sourceManifest)
      throw new Error("release_manifest_promotion_state_changed");
    if (!sameIdentity(source.identity, session.sourceManifest.identity))
      throw new Error("release_manifest_promotion_source_changed");
  } else if (session.mode === "linked_pending") {
    if (
      !source ||
      !destination ||
      !session.sourceManifest ||
      !session.destinationManifest ||
      !sameIdentity(source.identity, session.sourceManifest.identity) ||
      !sameIdentity(
        destination.identity,
        session.destinationManifest.identity,
      ) ||
      !sameFileObject(source.identity, destination.identity)
    )
      throw new Error("release_manifest_promotion_state_changed");
  } else if (
    source ||
    !destination ||
    !session.destinationManifest ||
    !sameIdentity(destination.identity, session.destinationManifest.identity)
  ) {
    throw new Error("release_manifest_promotion_state_changed");
  }
  if (source) verifyFile(source, session.manifestBytes, session.manifestSha256);
  if (destination)
    verifyFile(destination, session.manifestBytes, session.manifestSha256);
  return Object.freeze({ source, destination });
}

/**
 * ReleaseManifestPromotionErrorが担う状態と操作を提供する。
 *
 * @responsibility ReleaseManifestPromotionErrorに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000004
 * @construction ReleaseManifestPromotionErrorの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle ReleaseManifestPromotionErrorが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: ReleaseManifestPromotionErrorの宣言自体は実行時Effectを発行しない。
 * @failure N/A: ReleaseManifestPromotionErrorの宣言自体は実行時失敗を所有しない。
 * @invariant ReleaseManifestPromotionErrorで宣言した値と責務の対応を維持する。
 * @boundary N/A: ReleaseManifestPromotionErrorの宣言は外部境界を開かない。
 * @security N/A: ReleaseManifestPromotionErrorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ReleaseManifestPromotionErrorは共有非同期状態を持たない同期処理である。
 */
export class ReleaseManifestPromotionError extends Error {
  readonly repositoryFilesystemEffectIssued: boolean;
  readonly cleanupConfirmed: boolean;
  readonly reentryRequired: boolean;

  constructor(
    effectIssued: boolean,
    cleanupConfirmed: boolean,
    reentryRequired: boolean,
    options?: ErrorOptions,
  ) {
    super("release_manifest_promotion_failed", options);
    this.name = "ReleaseManifestPromotionError";
    this.repositoryFilesystemEffectIssued = effectIssued;
    this.cleanupConfirmed = cleanupConfirmed;
    this.reentryRequired = reentryRequired;
  }
}

/**
 * Release Manifest Promotion Sessionを開始する。
 *
 * @responsibility Release Manifest Promotion Sessionの開始条件、初期状態、開始失敗境界を所有する。
 * @trace ARCH-000004
 * @input sourceDistributionRoot: unknown、destinationRepositoryRoot: unknown、expectedManifestSha256: unknown
 * @returns beginReleaseManifestPromotionSessionの計算結果を返す。
 * @precondition 「sourceDistributionRoot: unknown、destinationRepositoryRoot: unknown、expectedManifestSha256: unknown」がbeginReleaseManifestPromotionSessionの入力契約を満たす。
 * @postcondition beginReleaseManifestPromotionSessionの責務を完了した結果だけを返す。
 * @effect N/A: beginReleaseManifestPromotionSessionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure beginReleaseManifestPromotionSessionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant beginReleaseManifestPromotionSessionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: beginReleaseManifestPromotionSessionはProcess内の同一Subsystemで完結する。
 * @security N/A: beginReleaseManifestPromotionSessionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: beginReleaseManifestPromotionSessionは共有非同期状態を持たない同期処理である。
 */
export function beginReleaseManifestPromotionSession(
  sourceDistributionRoot: unknown,
  destinationRepositoryRoot: unknown,
  expectedManifestSha256: unknown,
) {
  try {
    if (
      typeof sourceDistributionRoot !== "string" ||
      typeof destinationRepositoryRoot !== "string" ||
      typeof expectedManifestSha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(expectedManifestSha256) ||
      !path.isAbsolute(sourceDistributionRoot) ||
      !path.isAbsolute(destinationRepositoryRoot)
    )
      return null;
    const session = inspectSession(
      sourceDistributionRoot,
      destinationRepositoryRoot,
      expectedManifestSha256,
    );
    const token = Object.freeze({});
    sessions.set(token, session);
    return Object.freeze({
      token,
      mode: session.mode,
      sourceSha256: session.manifestSha256,
    });
  } catch {
    return null;
  }
}

/**
 * promote Release Manifest Bytesを決定する。
 *
 * @responsibility promote Release Manifest Bytesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input token: unknown
 * @returns promoteReleaseManifestBytesの計算結果を返す。
 * @precondition 「token: unknown」がpromoteReleaseManifestBytesの入力契約を満たす。
 * @postcondition promoteReleaseManifestBytesの責務を完了した結果だけを返す。
 * @effect promoteReleaseManifestBytesはFilesystemの読取りまたは書込みを実行する。
 * @failure promoteReleaseManifestBytesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant promoteReleaseManifestBytesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security promoteReleaseManifestBytesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: promoteReleaseManifestBytesは共有非同期状態を持たない同期処理である。
 */
export function promoteReleaseManifestBytes(token: unknown) {
  const session =
    token && typeof token === "object" ? sessions.get(token) : undefined;
  let effectIssued = false;
  try {
    if (!session) throw new ReleaseManifestPromotionError(false, true, false);
    let state = verifySession(session);
    if (session.mode === "ready") {
      fs.linkSync(session.sourceManifestPath, session.destinationManifestPath);
      effectIssued = true;
      const source = fileSnapshot(session.sourceManifestPath);
      const destination = fileSnapshot(session.destinationManifestPath);
      if (
        !session.sourceManifest ||
        !sameFileObject(source.identity, session.sourceManifest.identity) ||
        !sameFileObject(source.identity, destination.identity)
      )
        throw new Error("release_manifest_promotion_atomic_install_failed");
      verifyFile(destination, session.manifestBytes, session.manifestSha256);
      verifyDirectory(session.sourceRoot);
      verifyDirectory(session.sourceParent);
      verifyDirectory(session.destinationRoot);
      verifyDirectory(session.destinationParent);
      state = Object.freeze({ source, destination });
    }
    if (session.mode !== "transferred") {
      if (!state.source || !state.destination)
        throw new Error("release_manifest_promotion_link_state_invalid");
    }
    const finalSession = inspectSession(
      session.sourceRoot.path,
      session.destinationRoot.path,
      session.manifestSha256,
    );
    if (
      (finalSession.mode !== "linked_pending" &&
        finalSession.mode !== "transferred") ||
      !finalSession.destinationManifest
    )
      throw new Error("release_manifest_promotion_final_state_invalid");
    sessions.delete(token as object);
    completedSessions.set(token as object, finalSession);
    return Object.freeze({
      status: "promoted" as const,
      resumed: session.mode !== "ready",
      manifestRelativePath: PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
      manifestFileSha256: session.manifestSha256,
      byteLength: session.manifestBytes.length,
      repositoryFilesystemEffectIssued: effectIssued,
      cleanupConfirmed: true as const,
      stagingManifestDisposition:
        finalSession.mode === "linked_pending"
          ? ("retained_for_explicit_staging_discard" as const)
          : ("already_absent" as const),
      reentryRequired: false as const,
      runtimeAuthorityConferred: false as const,
      runtimeCapabilityIssued: false as const,
    });
  } catch (error) {
    if (error instanceof ReleaseManifestPromotionError) throw error;
    throw new ReleaseManifestPromotionError(
      effectIssued,
      !effectIssued,
      effectIssued,
      {
        cause: error,
      },
    );
  }
}

/**
 * Promoted Release Manifest Bytesを検証する。
 *
 * @responsibility Promoted Release Manifest Bytesの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input token: unknown
 * @returns verifyPromotedReleaseManifestBytesの計算結果を返す。
 * @precondition 「token: unknown」がverifyPromotedReleaseManifestBytesの入力契約を満たす。
 * @postcondition verifyPromotedReleaseManifestBytesの責務を完了した結果だけを返す。
 * @effect N/A: verifyPromotedReleaseManifestBytesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyPromotedReleaseManifestBytesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyPromotedReleaseManifestBytesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyPromotedReleaseManifestBytesはProcess内の同一Subsystemで完結する。
 * @security verifyPromotedReleaseManifestBytesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyPromotedReleaseManifestBytesは共有非同期状態を持たない同期処理である。
 */
export function verifyPromotedReleaseManifestBytes(token: unknown) {
  try {
    const session =
      token && typeof token === "object"
        ? completedSessions.get(token)
        : undefined;
    if (!session) return false;
    const current = inspectSession(
      session.sourceRoot.path,
      session.destinationRoot.path,
      session.manifestSha256,
    );
    return (
      (current.mode === "linked_pending" || current.mode === "transferred") &&
      current.destinationManifest !== null &&
      session.destinationManifest !== null &&
      sameIdentity(
        current.destinationManifest.identity,
        session.destinationManifest.identity,
      ) &&
      sameDirectoryIdentity(
        current.sourceRoot.identity,
        session.sourceRoot.identity,
      ) &&
      sameDirectoryIdentity(
        current.sourceParent.identity,
        session.sourceParent.identity,
      ) &&
      sameDirectoryIdentity(
        current.destinationRoot.identity,
        session.destinationRoot.identity,
      ) &&
      sameDirectoryIdentity(
        current.destinationParent.identity,
        session.destinationParent.identity,
      )
    );
  } catch {
    return false;
  }
}

/**
 * Release Manifest Promotion 契約の公開契約を記述する。
 *
 * @responsibility Release Manifest Promotion 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeReleaseManifestPromotionContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeReleaseManifestPromotionContractの入力契約を満たす。
 * @postcondition describeReleaseManifestPromotionContractの責務を完了した結果だけを返す。
 * @effect N/A: describeReleaseManifestPromotionContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeReleaseManifestPromotionContractは独自の失敗分岐を所有しない。
 * @invariant describeReleaseManifestPromotionContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeReleaseManifestPromotionContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeReleaseManifestPromotionContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeReleaseManifestPromotionContractは共有非同期状態を持たない同期処理である。
 */
export function describeReleaseManifestPromotionContract() {
  return Object.freeze({
    contract: "crdd-coordinator/release-manifest-promotion",
    contractRevision: 3,
    manifestRelativePath: PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
    sourceTreatment: "opaque_stable_bytes",
    destinationPublish: "exclusive_same_volume_hard_link",
    partialCanonicalFilePossible: false,
    processLossReentry: "source_only_linked_or_destination_only_exact_identity",
    stagingCleanup: "separate_explicit_owned_staging_discard",
    automaticRollbackAfterPublish: false,
    textParsingOrSerializationDuringPromotion: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
