import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const MAX_CONTROL_FILE_BYTES = 4096;
const MAX_CONFIG_FILE_BYTES = 1024 * 1024;
const MAX_EXCLUDE_FILE_BYTES = 128 * 1024;
const MAX_PACKED_REFS_BYTES = 4 * 1024 * 1024;
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const SAFE_REF = /^refs\/(?:heads|tags)\/[A-Za-z0-9._/-]{1,1024}$/u;

/**
 * EntityTypeが扱う値の構造を表す。
 *
 * @responsibility EntityTypeに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape EntityTypeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant EntityTypeで宣言した値と責務の対応を維持する。
 * @boundary N/A: EntityTypeの宣言は外部境界を開かない。
 * @security N/A: EntityTypeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility EntityTypeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type EntityType = "file" | "directory";
/**
 * LayoutKindが扱う値の構造を表す。
 *
 * @responsibility LayoutKindに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape LayoutKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LayoutKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: LayoutKindの宣言は外部境界を開かない。
 * @security N/A: LayoutKindはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LayoutKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LayoutKind = "normal_worktree" | "gitfile_worktree" | "linked_worktree";

/**
 * EntityIdentityが扱う値の構造を表す。
 *
 * @responsibility EntityIdentityに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape EntityIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant EntityIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: EntityIdentityの宣言は外部境界を開かない。
 * @security N/A: EntityIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility EntityIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type EntityIdentity = Readonly<{
  type: EntityType;
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  size: bigint;
  mode: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
}>;

/**
 * EntitySnapshotが扱う値の構造を表す。
 *
 * @responsibility EntitySnapshotに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape EntitySnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant EntitySnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: EntitySnapshotの宣言は外部境界を開かない。
 * @security N/A: EntitySnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility EntitySnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type EntitySnapshot = Readonly<{
  realPath: string;
  identity: EntityIdentity;
}>;

/**
 * RepositoryGitLayoutが扱う値の構造を表す。
 *
 * @responsibility RepositoryGitLayoutに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape RepositoryGitLayoutが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryGitLayoutで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryGitLayoutの宣言は外部境界を開かない。
 * @security N/A: RepositoryGitLayoutはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryGitLayoutの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryGitLayout = Readonly<{
  kind: LayoutKind;
  root: EntitySnapshot;
  gitDirectory: EntitySnapshot;
  commonDirectory: EntitySnapshot;
  infoDirectory: EntitySnapshot | null;
  excludeSnapshot: EntitySnapshot | null;
  structuralGraph: readonly EntitySnapshot[];
}>;

/**
 * StableFileBytesが扱う値の構造を表す。
 *
 * @responsibility StableFileBytesに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape StableFileBytesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StableFileBytesで宣言した値と責務の対応を維持する。
 * @boundary N/A: StableFileBytesの宣言は外部境界を開かない。
 * @security N/A: StableFileBytesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility StableFileBytesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type StableFileBytes = Readonly<{ value: Buffer; snapshot: EntitySnapshot }>;

/**
 * isEnoentの処理を実行する。
 *
 * @responsibility isEnoentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input error: unknown
 * @returns booleanを返す。
 * @precondition 「error: unknown」がisEnoentの入力契約を満たす。
 * @postcondition isEnoentの責務を完了した結果だけを返す。
 * @effect N/A: isEnoentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isEnoentは独自の失敗分岐を所有しない。
 * @invariant isEnoentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isEnoentはProcess内の同一Subsystemで完結する。
 * @security N/A: isEnoentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isEnoentは共有非同期状態を持たない同期処理である。
 */
function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

/**
 * identityの処理を実行する。
 *
 * @responsibility identityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input metadata: fs.BigIntStats、expectedType: EntityType
 * @returns EntityIdentityを返す。
 * @precondition 「metadata: fs.BigIntStats、expectedType: EntityType」がidentityの入力契約を満たす。
 * @postcondition identityの責務を完了した結果だけを返す。
 * @effect N/A: identityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure identityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant identityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: identityはProcess内の同一Subsystemで完結する。
 * @security N/A: identityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: identityは共有非同期状態を持たない同期処理である。
 */
function identity(
  metadata: fs.BigIntStats,
  expectedType: EntityType,
): EntityIdentity {
  const isTypeValid =
    expectedType === "file" ? metadata.isFile() : metadata.isDirectory();
  if (
    !isTypeValid ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  )
    throw new Error("repository_git_layout_invalid");
  return Object.freeze({
    type: expectedType,
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
    size: metadata.size,
    mode: metadata.mode,
    mtimeNs: metadata.mtimeNs,
    ctimeNs: metadata.ctimeNs,
  });
}

/**
 * sameIdentityの処理を実行する。
 *
 * @responsibility sameIdentityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input left: EntityIdentity、right: EntityIdentity
 * @returns booleanを返す。
 * @precondition 「left: EntityIdentity、right: EntityIdentity」がsameIdentityの入力契約を満たす。
 * @postcondition sameIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameIdentityは独自の失敗分岐を所有しない。
 * @invariant sameIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: sameIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: sameIdentityは共有非同期状態を持たない同期処理である。
 */
function sameIdentity(left: EntityIdentity, right: EntityIdentity): boolean {
  return (
    left.type === right.type &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.size === right.size &&
    left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

/**
 * verifySnapshotの処理を実行する。
 *
 * @responsibility verifySnapshotに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input snapshot: EntitySnapshot
 * @returns N/A: verifySnapshotは戻り値を返さない。
 * @precondition 「snapshot: EntitySnapshot」がverifySnapshotの入力契約を満たす。
 * @postcondition verifySnapshotの責務を完了して呼出し元へ制御を戻す。
 * @effect verifySnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure verifySnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifySnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: verifySnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifySnapshotは共有非同期状態を持たない同期処理である。
 */
function verifySnapshot(snapshot: EntitySnapshot): void {
  const current = identity(
    fs.lstatSync(snapshot.realPath, { bigint: true }),
    snapshot.identity.type,
  );
  if (
    !sameIdentity(snapshot.identity, current) ||
    fs.realpathSync.native(snapshot.realPath) !== snapshot.realPath
  ) {
    throw new Error("repository_git_layout_changed");
  }
}

/**
 * verifyEntitySnapshotの処理を実行する。
 *
 * @responsibility verifyEntitySnapshotに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input snapshot: EntitySnapshot
 * @returns N/A: verifyEntitySnapshotは戻り値を返さない。
 * @precondition 「snapshot: EntitySnapshot」がverifyEntitySnapshotの入力契約を満たす。
 * @postcondition verifyEntitySnapshotの責務を完了して呼出し元へ制御を戻す。
 * @effect verifyEntitySnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure verifyEntitySnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyEntitySnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: verifyEntitySnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifyEntitySnapshotは共有非同期状態を持たない同期処理である。
 */
function verifyEntitySnapshot(snapshot: EntitySnapshot): void {
  const current = identity(
    fs.lstatSync(snapshot.realPath, { bigint: true }),
    snapshot.identity.type,
  );
  if (
    snapshot.identity.type !== current.type ||
    snapshot.identity.dev !== current.dev ||
    snapshot.identity.ino !== current.ino ||
    snapshot.identity.birthtimeNs !== current.birthtimeNs ||
    fs.realpathSync.native(snapshot.realPath) !== snapshot.realPath
  ) {
    throw new Error("repository_git_layout_changed");
  }
}

/**
 * verifySnapshotsの処理を実行する。
 *
 * @responsibility verifySnapshotsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input snapshots: readonly EntitySnapshot[]
 * @returns N/A: verifySnapshotsは戻り値を返さない。
 * @precondition 「snapshots: readonly EntitySnapshot[]」がverifySnapshotsの入力契約を満たす。
 * @postcondition verifySnapshotsの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: verifySnapshotsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifySnapshotsは独自の失敗分岐を所有しない。
 * @invariant verifySnapshotsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifySnapshotsはProcess内の同一Subsystemで完結する。
 * @security N/A: verifySnapshotsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifySnapshotsは共有非同期状態を持たない同期処理である。
 */
function verifySnapshots(snapshots: readonly EntitySnapshot[]): void {
  for (const snapshot of snapshots) {
    if (snapshot.identity.type === "directory") verifyEntitySnapshot(snapshot);
    else verifySnapshot(snapshot);
  }
}

/**
 * verifyLayoutForWriteの処理を実行する。
 *
 * @responsibility verifyLayoutForWriteに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input layout: RepositoryGitLayout
 * @returns N/A: verifyLayoutForWriteは戻り値を返さない。
 * @precondition 「layout: RepositoryGitLayout」がverifyLayoutForWriteの入力契約を満たす。
 * @postcondition verifyLayoutForWriteの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: verifyLayoutForWriteは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifyLayoutForWriteは独自の失敗分岐を所有しない。
 * @invariant verifyLayoutForWriteは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyLayoutForWriteはProcess内の同一Subsystemで完結する。
 * @security N/A: verifyLayoutForWriteはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifyLayoutForWriteは共有非同期状態を持たない同期処理である。
 */
function verifyLayoutForWrite(layout: RepositoryGitLayout): void {
  for (const snapshot of layout.structuralGraph) {
    if (snapshot === layout.infoDirectory) verifyEntitySnapshot(snapshot);
    else verifySnapshot(snapshot);
  }
}

/**
 * directoryRealpathの処理を実行する。
 *
 * @responsibility directoryRealpathに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input target: string
 * @returns EntitySnapshotを返す。
 * @precondition 「target: string」がdirectoryRealpathの入力契約を満たす。
 * @postcondition directoryRealpathの責務を完了した結果だけを返す。
 * @effect directoryRealpathはFilesystemの読取りまたは書込みを実行する。
 * @failure directoryRealpathは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant directoryRealpathは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: directoryRealpathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: directoryRealpathは共有非同期状態を持たない同期処理である。
 */
function directoryRealpath(target: string): EntitySnapshot {
  const before = identity(fs.lstatSync(target, { bigint: true }), "directory");
  const realPath = fs.realpathSync.native(target);
  const resolved = identity(
    fs.lstatSync(realPath, { bigint: true }),
    "directory",
  );
  const after = identity(fs.lstatSync(target, { bigint: true }), "directory");
  if (!sameIdentity(before, resolved) || !sameIdentity(before, after)) {
    throw new Error("repository_git_layout_changed");
  }
  return Object.freeze({ realPath, identity: before });
}

/**
 * readStableFileBytesの処理を実行する。
 *
 * @responsibility readStableFileBytesに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input target: string、maximumBytes: number、parentSnapshots: readonly EntitySnapshot[]、shouldAllowEmpty
 * @returns StableFileBytesを返す。
 * @precondition 「target: string、maximumBytes: number、parentSnapshots: readonly EntitySnapshot[]、shouldAllowEmpty」がreadStableFileBytesの入力契約を満たす。
 * @postcondition readStableFileBytesの責務を完了した結果だけを返す。
 * @effect readStableFileBytesはFilesystemの読取りまたは書込みを実行する。
 * @failure readStableFileBytesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readStableFileBytesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readStableFileBytesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readStableFileBytesは共有非同期状態を持たない同期処理である。
 */
function readStableFileBytes(
  target: string,
  maximumBytes: number,
  parentSnapshots: readonly EntitySnapshot[] = [],
  shouldAllowEmpty = false,
): StableFileBytes {
  verifySnapshots(parentSnapshots);
  if (fs.realpathSync.native(target) !== target) {
    throw new Error("repository_git_file_boundary_invalid");
  }
  const pathBefore = identity(fs.lstatSync(target, { bigint: true }), "file");
  if (
    (!shouldAllowEmpty && pathBefore.size <= 0n) ||
    pathBefore.size > BigInt(maximumBytes)
  ) {
    throw new Error("repository_git_file_budget_invalid");
  }
  const noFollow =
    process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
  let descriptor: number | null = null;
  let failure: unknown = null;
  let result: StableFileBytes | null = null;
  try {
    descriptor = fs.openSync(target, fs.constants.O_RDONLY | noFollow);
    const before = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    if (
      !sameIdentity(pathBefore, before) ||
      before.size > BigInt(maximumBytes)
    ) {
      throw new Error("repository_git_file_changed");
    }
    const buffer = Buffer.alloc(maximumBytes + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const count = fs.readSync(
        descriptor,
        buffer,
        offset,
        buffer.length - offset,
        null,
      );
      if (count === 0) break;
      offset += count;
    }
    if (offset > maximumBytes || BigInt(offset) !== before.size)
      throw new Error("repository_git_file_changed");
    const after = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    const pathAfter = identity(fs.lstatSync(target, { bigint: true }), "file");
    if (
      !sameIdentity(before, after) ||
      !sameIdentity(before, pathAfter) ||
      fs.realpathSync.native(target) !== target
    ) {
      throw new Error("repository_git_file_changed");
    }
    result = Object.freeze({
      value: Buffer.from(buffer.subarray(0, offset)),
      snapshot: Object.freeze({
        realPath: fs.realpathSync.native(target),
        identity: after,
      }),
    });
  } catch (error) {
    failure = error;
  } finally {
    if (descriptor !== null) {
      try {
        fs.closeSync(descriptor);
      } catch (error) {
        failure ??= error;
      }
    }
  }
  if (failure || !result)
    throw failure ?? new Error("repository_git_file_invalid");
  verifySnapshots(parentSnapshots);
  verifySnapshot(result.snapshot);
  return result;
}

/**
 * decodeUtf8の処理を実行する。
 *
 * @responsibility decodeUtf8に対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input bytes: Uint8Array、reason: string
 * @returns stringを返す。
 * @precondition 「bytes: Uint8Array、reason: string」がdecodeUtf8の入力契約を満たす。
 * @postcondition decodeUtf8の責務を完了した結果だけを返す。
 * @effect N/A: decodeUtf8は入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure decodeUtf8は入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant decodeUtf8は入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: decodeUtf8はProcess内の同一Subsystemで完結する。
 * @security N/A: decodeUtf8はAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: decodeUtf8は共有非同期状態を持たない同期処理である。
 */
function decodeUtf8(bytes: Uint8Array, reason: string): string {
  const text = utf8Decoder.decode(bytes);
  if (text.charCodeAt(0) === 0xfeff || text.includes("\u0000"))
    throw new Error(reason);
  return text;
}

/**
 * readControlFileの処理を実行する。
 *
 * @responsibility readControlFileに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input target: string、parentSnapshots: readonly EntitySnapshot[]
 * @returns Readonly<{ line: string; snapshot: EntitySnapshot }>を返す。
 * @precondition 「target: string、parentSnapshots: readonly EntitySnapshot[]」がreadControlFileの入力契約を満たす。
 * @postcondition readControlFileの責務を完了した結果だけを返す。
 * @effect N/A: readControlFileは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readControlFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readControlFileは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readControlFileはProcess内の同一Subsystemで完結する。
 * @security N/A: readControlFileはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readControlFileは共有非同期状態を持たない同期処理である。
 */
function readControlFile(
  target: string,
  parentSnapshots: readonly EntitySnapshot[] = [],
): Readonly<{ line: string; snapshot: EntitySnapshot }> {
  const bytes = readStableFileBytes(
    target,
    MAX_CONTROL_FILE_BYTES,
    parentSnapshots,
  );
  const decoded = decodeUtf8(
    bytes.value,
    "repository_git_control_file_invalid",
  );
  const line = decoded.endsWith("\r\n")
    ? decoded.slice(0, -2)
    : decoded.endsWith("\n")
      ? decoded.slice(0, -1)
      : decoded;
  if (line.length === 0 || /[\u0000-\u001f\u007f]/u.test(line)) {
    throw new Error("repository_git_control_file_invalid");
  }
  return Object.freeze({ line, snapshot: bytes.snapshot });
}

/**
 * parseNarrowRepositoryConfigの処理を実行する。
 *
 * @responsibility parseNarrowRepositoryConfigに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input target: string、commonDirectory: EntitySnapshot
 * @returns Readonly<{ snapshot: EntitySnapshot; objectFormat: "sha1" | "sha256"; worktree: string | null; }>を返す。
 * @precondition 「target: string、commonDirectory: EntitySnapshot」がparseNarrowRepositoryConfigの入力契約を満たす。
 * @postcondition parseNarrowRepositoryConfigの責務を完了した結果だけを返す。
 * @effect N/A: parseNarrowRepositoryConfigは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseNarrowRepositoryConfigは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseNarrowRepositoryConfigは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseNarrowRepositoryConfigはProcess内の同一Subsystemで完結する。
 * @security N/A: parseNarrowRepositoryConfigはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseNarrowRepositoryConfigは共有非同期状態を持たない同期処理である。
 */
function parseNarrowRepositoryConfig(
  target: string,
  commonDirectory: EntitySnapshot,
): Readonly<{
  snapshot: EntitySnapshot;
  objectFormat: "sha1" | "sha256";
  worktree: string | null;
}> {
  const bytes = readStableFileBytes(target, MAX_CONFIG_FILE_BYTES, [
    commonDirectory,
  ]);
  const text = decodeUtf8(bytes.value, "repository_git_config_unsupported");
  if (/\r(?!\n)/u.test(text))
    throw new Error("repository_git_config_unsupported");
  let section = null;
  let isSubsection = false;
  let formatVersion = null;
  let bare = null;
  let worktree: string | null = null;
  let objectFormat = null;
  let compatibilityObjectFormat = null;
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#") || line.startsWith(";")) continue;
    const sectionMatch = /^\[([A-Za-z0-9.-]+)(\s+"[^"\r\n]*")?\]$/u.exec(line);
    if (sectionMatch) {
      const sectionName = sectionMatch[1];
      if (sectionName === undefined)
        throw new Error("repository_git_config_unsupported");
      section = sectionName.toLocaleLowerCase("en-US");
      isSubsection = sectionMatch[2] !== undefined;
      if (section === "include" || section === "includeif") {
        throw new Error("repository_git_config_unsupported");
      }
      continue;
    }
    if (section === null || /\\\s*$/u.test(line))
      throw new Error("repository_git_config_unsupported");
    const assignment = /^([A-Za-z][A-Za-z0-9.-]*)\s*(?:=\s*)?(.*?)$/u.exec(
      line,
    );
    if (!assignment) throw new Error("repository_git_config_unsupported");
    const assignmentKey = assignment[1];
    const assignmentValue = assignment[2];
    if (assignmentKey === undefined || assignmentValue === undefined) {
      throw new Error("repository_git_config_unsupported");
    }
    const key = assignmentKey.toLocaleLowerCase("en-US");
    const rawValue = assignmentValue.trim();
    const value = rawValue.toLocaleLowerCase("en-US");
    if (
      section === "core" &&
      !isSubsection &&
      key === "repositoryformatversion"
    ) {
      if (formatVersion !== null)
        throw new Error("repository_git_config_unsupported");
      formatVersion = value;
    }
    if (section === "core" && !isSubsection && key === "bare") {
      if (bare !== null) throw new Error("repository_git_config_unsupported");
      bare = value;
    }
    if (section === "core" && !isSubsection && key === "worktree") {
      if (worktree !== null || rawValue.length === 0)
        throw new Error("repository_git_config_unsupported");
      worktree = rawValue;
    }
    if (section === "extensions" && !isSubsection && key === "objectformat") {
      if (objectFormat !== null)
        throw new Error("repository_git_config_unsupported");
      objectFormat = value;
    }
    if (
      section === "extensions" &&
      !isSubsection &&
      key === "compatobjectformat"
    ) {
      if (compatibilityObjectFormat !== null)
        throw new Error("repository_git_config_unsupported");
      compatibilityObjectFormat = value;
    }
    if (
      section === "extensions" &&
      (isSubsection || (key !== "objectformat" && key !== "compatobjectformat"))
    ) {
      throw new Error("repository_git_config_unsupported");
    }
  }
  const detectedObjectFormat =
    formatVersion === "0" &&
    bare === "false" &&
    objectFormat === null &&
    compatibilityObjectFormat === null
      ? "sha1"
      : formatVersion === "1" &&
          bare === "false" &&
          objectFormat === "sha256" &&
          (compatibilityObjectFormat === null ||
            compatibilityObjectFormat === "sha1")
        ? "sha256"
        : null;
  if (!detectedObjectFormat) {
    throw new Error("repository_git_config_unsupported");
  }
  return Object.freeze({
    snapshot: bytes.snapshot,
    objectFormat: detectedObjectFormat,
    worktree,
  });
}

/**
 * isValidRefの処理を実行する。
 *
 * @responsibility isValidRefに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input value: string
 * @returns booleanを返す。
 * @precondition 「value: string」がisValidRefの入力契約を満たす。
 * @postcondition isValidRefの責務を完了した結果だけを返す。
 * @effect N/A: isValidRefは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isValidRefは独自の失敗分岐を所有しない。
 * @invariant isValidRefは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isValidRefはProcess内の同一Subsystemで完結する。
 * @security N/A: isValidRefはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isValidRefは共有非同期状態を持たない同期処理である。
 */
function isValidRef(value: string): boolean {
  return (
    SAFE_REF.test(value) &&
    !value.includes("..") &&
    !value.includes("//") &&
    !value.endsWith("/")
  );
}

/**
 * inspectRevisionHexLengthの処理を実行する。
 *
 * @responsibility inspectRevisionHexLengthに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input gitDirectory: EntitySnapshot、commonDirectory: EntitySnapshot、snapshots: EntitySnapshot[]
 * @returns 40 | 64を返す。
 * @precondition 「gitDirectory: EntitySnapshot、commonDirectory: EntitySnapshot、snapshots: EntitySnapshot[]」がinspectRevisionHexLengthの入力契約を満たす。
 * @postcondition inspectRevisionHexLengthの責務を完了した結果だけを返す。
 * @effect N/A: inspectRevisionHexLengthは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectRevisionHexLengthは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectRevisionHexLengthは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRevisionHexLengthはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectRevisionHexLengthはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectRevisionHexLengthは共有非同期状態を持たない同期処理である。
 */
function inspectRevisionHexLength(
  gitDirectory: EntitySnapshot,
  commonDirectory: EntitySnapshot,
  snapshots: EntitySnapshot[],
): 40 | 64 {
  const head = readControlFile(path.join(gitDirectory.realPath, "HEAD"), [
    gitDirectory,
  ]);
  snapshots.push(head.snapshot);
  let revision = head.line;
  if (revision.startsWith("ref: ")) {
    const ref = revision.slice("ref: ".length);
    if (!isValidRef(ref)) throw new Error("repository_git_revision_invalid");
    try {
      const loose = readControlFile(
        path.join(commonDirectory.realPath, ...ref.split("/")),
        [commonDirectory],
      );
      snapshots.push(loose.snapshot);
      revision = loose.line;
    } catch (error) {
      if (!isEnoent(error)) throw error;
      const packed = readStableFileBytes(
        path.join(commonDirectory.realPath, "packed-refs"),
        MAX_PACKED_REFS_BYTES,
        [commonDirectory],
      );
      snapshots.push(packed.snapshot);
      const text = decodeUtf8(packed.value, "repository_git_revision_invalid");
      if (/\r(?!\n)/u.test(text))
        throw new Error("repository_git_revision_invalid");
      const matches = text
        .split(/\r?\n/u)
        .filter((line) => !line.startsWith("#") && !line.startsWith("^"))
        .map((line) => line.split(" "))
        .filter((parts) => parts.length === 2 && parts[1] === ref);
      if (matches.length !== 1)
        throw new Error("repository_git_revision_invalid");
      revision = matches[0]?.[0] ?? "";
    }
  }
  if (!OBJECT_ID.test(revision))
    throw new Error("repository_git_revision_invalid");
  return revision.length as 40 | 64;
}

/**
 * assertObjectFormatMatchesRevisionの処理を実行する。
 *
 * @responsibility assertObjectFormatMatchesRevisionに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input objectFormat: "sha1" | "sha256"、revisionHexLength: 40 | 64
 * @returns N/A: assertObjectFormatMatchesRevisionは戻り値を返さない。
 * @precondition 「objectFormat: "sha1" | "sha256"、revisionHexLength: 40 | 64」がassertObjectFormatMatchesRevisionの入力契約を満たす。
 * @postcondition assertObjectFormatMatchesRevisionの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: assertObjectFormatMatchesRevisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure assertObjectFormatMatchesRevisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant assertObjectFormatMatchesRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: assertObjectFormatMatchesRevisionはProcess内の同一Subsystemで完結する。
 * @security N/A: assertObjectFormatMatchesRevisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: assertObjectFormatMatchesRevisionは共有非同期状態を持たない同期処理である。
 */
function assertObjectFormatMatchesRevision(
  objectFormat: "sha1" | "sha256",
  revisionHexLength: 40 | 64,
): void {
  if (
    (objectFormat === "sha1" && revisionHexLength !== 40) ||
    (objectFormat === "sha256" && revisionHexLength !== 64)
  ) {
    throw new Error("repository_git_object_format_inconsistent");
  }
}

/**
 * assertConfiguredWorktreeMatchesRootの処理を実行する。
 *
 * @responsibility assertConfiguredWorktreeMatchesRootに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input configuredWorktree: string | null、commonDirectory: EntitySnapshot、root: EntitySnapshot
 * @returns voidを返す。
 * @precondition 「configuredWorktree: string | null、commonDirectory: EntitySnapshot、root: EntitySnapshot」がassertConfiguredWorktreeMatchesRootの入力契約を満たす。
 * @postcondition assertConfiguredWorktreeMatchesRootの責務を完了した結果だけを返す。
 * @effect assertConfiguredWorktreeMatchesRootはFilesystemの読取りまたは書込みを実行する。
 * @failure assertConfiguredWorktreeMatchesRootは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant assertConfiguredWorktreeMatchesRootは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: assertConfiguredWorktreeMatchesRootはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: assertConfiguredWorktreeMatchesRootは共有非同期状態を持たない同期処理である。
 */
function assertConfiguredWorktreeMatchesRoot(
  configuredWorktree: string | null,
  commonDirectory: EntitySnapshot,
  root: EntitySnapshot,
): void {
  if (configuredWorktree === null) return;
  const configuredPath = path.isAbsolute(configuredWorktree)
    ? configuredWorktree
    : path.resolve(commonDirectory.realPath, configuredWorktree);
  const actualWorktree = fs.realpathSync.native(configuredPath);
  const doesWorktreeMatch =
    process.platform === "win32"
      ? actualWorktree.toLocaleLowerCase("en-US") ===
        root.realPath.toLocaleLowerCase("en-US")
      : actualWorktree === root.realPath;
  if (!doesWorktreeMatch) throw new Error("repository_git_worktree_mismatch");
}

/**
 * inspectRepositoryGitObjectFormatCandidateの処理を実行する。
 *
 * @responsibility inspectRepositoryGitObjectFormatCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input repositoryRoot: unknown
 * @returns inspectRepositoryGitObjectFormatCandidateの計算結果を返す。
 * @precondition 「repositoryRoot: unknown」がinspectRepositoryGitObjectFormatCandidateの入力契約を満たす。
 * @postcondition inspectRepositoryGitObjectFormatCandidateの責務を完了した結果だけを返す。
 * @effect inspectRepositoryGitObjectFormatCandidateはFilesystemの読取りまたは書込みを実行する。
 * @failure inspectRepositoryGitObjectFormatCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectRepositoryGitObjectFormatCandidateは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: inspectRepositoryGitObjectFormatCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectRepositoryGitObjectFormatCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectRepositoryGitObjectFormatCandidate(
  repositoryRoot: unknown,
) {
  try {
    if (typeof repositoryRoot !== "string" || repositoryRoot.length === 0)
      return null;
    const snapshots: EntitySnapshot[] = [];
    const root = directoryRealpath(repositoryRoot);
    snapshots.push(root);
    const marker = path.join(root.realPath, ".git");
    const markerMetadata = fs.lstatSync(marker, { bigint: true });
    if (markerMetadata.isSymbolicLink()) return null;
    let gitDirectory: EntitySnapshot;
    if (markerMetadata.isDirectory()) {
      gitDirectory = directoryRealpath(marker);
    } else if (markerMetadata.isFile()) {
      const control = readControlFile(marker, [root]);
      snapshots.push(control.snapshot);
      if (!control.line.startsWith("gitdir: ")) return null;
      const value = control.line.slice("gitdir: ".length);
      if (!value || /[\u0000-\u001f\u007f]/u.test(value)) return null;
      gitDirectory = directoryRealpath(
        path.isAbsolute(value) ? value : path.resolve(root.realPath, value),
      );
    } else return null;
    snapshots.push(gitDirectory);
    const commonDirectory =
      optionalCommonDirectory(gitDirectory, snapshots) ?? gitDirectory;
    if (commonDirectory !== gitDirectory) snapshots.push(commonDirectory);
    const config = parseNarrowRepositoryConfig(
      path.join(commonDirectory.realPath, "config"),
      commonDirectory,
    );
    snapshots.push(config.snapshot);
    assertConfiguredWorktreeMatchesRoot(config.worktree, commonDirectory, root);
    const revisionHexLength = inspectRevisionHexLength(
      gitDirectory,
      commonDirectory,
      snapshots,
    );
    assertObjectFormatMatchesRevision(config.objectFormat, revisionHexLength);
    verifySnapshots(snapshots);
    return Object.freeze({
      status: "candidate" as const,
      objectFormat: config.objectFormat,
      revisionHexLength,
      repositoryPathReported: false,
    });
  } catch {
    return null;
  }
}

/**
 * optionalCommonDirectoryの処理を実行する。
 *
 * @responsibility optionalCommonDirectoryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input gitDirectory: EntitySnapshot、entitySnapshots: EntitySnapshot[]
 * @returns EntitySnapshot | nullを返す。
 * @precondition 「gitDirectory: EntitySnapshot、entitySnapshots: EntitySnapshot[]」がoptionalCommonDirectoryの入力契約を満たす。
 * @postcondition optionalCommonDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: optionalCommonDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure optionalCommonDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant optionalCommonDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: optionalCommonDirectoryはProcess内の同一Subsystemで完結する。
 * @security N/A: optionalCommonDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: optionalCommonDirectoryは共有非同期状態を持たない同期処理である。
 */
function optionalCommonDirectory(
  gitDirectory: EntitySnapshot,
  entitySnapshots: EntitySnapshot[],
): EntitySnapshot | null {
  try {
    const control = readControlFile(
      path.join(gitDirectory.realPath, "commondir"),
      [gitDirectory],
    );
    entitySnapshots.push(control.snapshot);
    return directoryRealpath(
      path.isAbsolute(control.line)
        ? control.line
        : path.resolve(gitDirectory.realPath, control.line),
    );
  } catch (error) {
    if (isEnoent(error)) return null;
    throw error;
  }
}

/**
 * resolveExcludeBoundaryの処理を実行する。
 *
 * @responsibility resolveExcludeBoundaryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input commonDirectory: EntitySnapshot、entitySnapshots: EntitySnapshot[]
 * @returns Readonly<{ infoDirectory: EntitySnapshot | null; excludeSnapshot: EntitySnapshot | null; }>を返す。
 * @precondition 「commonDirectory: EntitySnapshot、entitySnapshots: EntitySnapshot[]」がresolveExcludeBoundaryの入力契約を満たす。
 * @postcondition resolveExcludeBoundaryの責務を完了した結果だけを返す。
 * @effect N/A: resolveExcludeBoundaryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure resolveExcludeBoundaryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveExcludeBoundaryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveExcludeBoundaryはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveExcludeBoundaryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveExcludeBoundaryは共有非同期状態を持たない同期処理である。
 */
function resolveExcludeBoundary(
  commonDirectory: EntitySnapshot,
  entitySnapshots: EntitySnapshot[],
): Readonly<{
  infoDirectory: EntitySnapshot | null;
  excludeSnapshot: EntitySnapshot | null;
}> {
  let infoDirectory: EntitySnapshot;
  try {
    infoDirectory = directoryRealpath(
      path.join(commonDirectory.realPath, "info"),
    );
    entitySnapshots.push(infoDirectory);
  } catch (error) {
    if (isEnoent(error))
      return Object.freeze({ infoDirectory: null, excludeSnapshot: null });
    throw error;
  }
  try {
    const bytes = readStableFileBytes(
      path.join(infoDirectory.realPath, "exclude"),
      MAX_EXCLUDE_FILE_BYTES,
      [commonDirectory, infoDirectory],
      true,
    );
    return Object.freeze({ infoDirectory, excludeSnapshot: bytes.snapshot });
  } catch (error) {
    if (isEnoent(error))
      return Object.freeze({ infoDirectory, excludeSnapshot: null });
    throw error;
  }
}

/**
 * resolveRepositoryGitLayoutの処理を実行する。
 *
 * @responsibility resolveRepositoryGitLayoutに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input repositoryRoot: unknown
 * @returns RepositoryGitLayoutを返す。
 * @precondition 「repositoryRoot: unknown」がresolveRepositoryGitLayoutの入力契約を満たす。
 * @postcondition resolveRepositoryGitLayoutの責務を完了した結果だけを返す。
 * @effect resolveRepositoryGitLayoutはFilesystemの読取りまたは書込みを実行する。
 * @failure resolveRepositoryGitLayoutは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveRepositoryGitLayoutは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: resolveRepositoryGitLayoutはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveRepositoryGitLayoutは共有非同期状態を持たない同期処理である。
 */
export function resolveRepositoryGitLayout(
  repositoryRoot: unknown,
): RepositoryGitLayout {
  if (typeof repositoryRoot !== "string" || repositoryRoot.length === 0) {
    throw new Error("repository_git_root_required");
  }
  const entitySnapshots: EntitySnapshot[] = [];
  const root = directoryRealpath(repositoryRoot);
  entitySnapshots.push(root);
  const marker = path.join(root.realPath, ".git");
  const markerMetadata = fs.lstatSync(marker, { bigint: true });
  if (markerMetadata.isSymbolicLink())
    throw new Error("repository_git_marker_link_rejected");
  let gitDirectory: EntitySnapshot;
  let kind: LayoutKind;
  if (markerMetadata.isDirectory()) {
    gitDirectory = directoryRealpath(marker);
    kind = "normal_worktree";
  } else if (markerMetadata.isFile()) {
    const control = readControlFile(marker, [root]);
    entitySnapshots.push(control.snapshot);
    if (!control.line.startsWith("gitdir: "))
      throw new Error("repository_git_file_invalid");
    const value = control.line.slice("gitdir: ".length);
    if (!value || /[\u0000-\u001f\u007f]/u.test(value))
      throw new Error("repository_git_file_invalid");
    gitDirectory = directoryRealpath(
      path.isAbsolute(value) ? value : path.resolve(root.realPath, value),
    );
    kind = "gitfile_worktree";
  } else throw new Error("repository_git_marker_invalid");
  entitySnapshots.push(gitDirectory);
  const commonDirectory =
    optionalCommonDirectory(gitDirectory, entitySnapshots) ?? gitDirectory;
  if (commonDirectory !== gitDirectory) entitySnapshots.push(commonDirectory);
  entitySnapshots.push(
    readControlFile(path.join(gitDirectory.realPath, "HEAD"), [gitDirectory])
      .snapshot,
  );
  const config = parseNarrowRepositoryConfig(
    path.join(commonDirectory.realPath, "config"),
    commonDirectory,
  );
  if (config.objectFormat !== "sha1")
    throw new Error("repository_git_object_format_unsupported");
  assertConfiguredWorktreeMatchesRoot(config.worktree, commonDirectory, root);
  entitySnapshots.push(config.snapshot);
  const boundary = resolveExcludeBoundary(commonDirectory, entitySnapshots);
  verifySnapshots(entitySnapshots);
  if (boundary.excludeSnapshot) verifySnapshot(boundary.excludeSnapshot);
  if (kind === "gitfile_worktree" && commonDirectory !== gitDirectory)
    kind = "linked_worktree";
  return Object.freeze({
    kind,
    root,
    gitDirectory,
    commonDirectory,
    infoDirectory: boundary.infoDirectory,
    excludeSnapshot: boundary.excludeSnapshot,
    structuralGraph: Object.freeze([...entitySnapshots]),
  });
}

/**
 * summarizeRepositoryGitLayoutの処理を実行する。
 *
 * @responsibility summarizeRepositoryGitLayoutに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input layout: RepositoryGitLayout
 * @returns Readonly<{ kind: LayoutKind; commonMetadataResolved: true; supportedRepositoryFormat: "version_0_without_extensions_or_includes"; excludeBackend: "common_git_directory_info_exclude"; referencedRepositoriesModified: false; }>を返す。
 * @precondition 「layout: RepositoryGitLayout」がsummarizeRepositoryGitLayoutの入力契約を満たす。
 * @postcondition summarizeRepositoryGitLayoutの責務を完了した結果だけを返す。
 * @effect N/A: summarizeRepositoryGitLayoutは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: summarizeRepositoryGitLayoutは独自の失敗分岐を所有しない。
 * @invariant summarizeRepositoryGitLayoutは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: summarizeRepositoryGitLayoutはProcess内の同一Subsystemで完結する。
 * @security N/A: summarizeRepositoryGitLayoutはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: summarizeRepositoryGitLayoutは共有非同期状態を持たない同期処理である。
 */
export function summarizeRepositoryGitLayout(
  layout: RepositoryGitLayout,
): Readonly<{
  kind: LayoutKind;
  commonMetadataResolved: true;
  supportedRepositoryFormat: "version_0_without_extensions_or_includes";
  excludeBackend: "common_git_directory_info_exclude";
  referencedRepositoriesModified: false;
}> {
  return Object.freeze({
    kind: layout.kind,
    commonMetadataResolved: true,
    supportedRepositoryFormat: "version_0_without_extensions_or_includes",
    excludeBackend: "common_git_directory_info_exclude",
    referencedRepositoriesModified: false,
  });
}

/**
 * decodeExcludeの処理を実行する。
 *
 * @responsibility decodeExcludeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input bytes: Uint8Array
 * @returns stringを返す。
 * @precondition 「bytes: Uint8Array」がdecodeExcludeの入力契約を満たす。
 * @postcondition decodeExcludeの責務を完了した結果だけを返す。
 * @effect N/A: decodeExcludeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure decodeExcludeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant decodeExcludeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: decodeExcludeはProcess内の同一Subsystemで完結する。
 * @security N/A: decodeExcludeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: decodeExcludeは共有非同期状態を持たない同期処理である。
 */
function decodeExclude(bytes: Uint8Array): string {
  const text = decodeUtf8(bytes, "repository_git_exclude_invalid");
  if (/\r(?!\n)/u.test(text)) throw new Error("repository_git_exclude_invalid");
  return text;
}

/**
 * exactEntryPresentの処理を実行する。
 *
 * @responsibility exactEntryPresentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input text: string、entry: string
 * @returns booleanを返す。
 * @precondition 「text: string、entry: string」がexactEntryPresentの入力契約を満たす。
 * @postcondition exactEntryPresentの責務を完了した結果だけを返す。
 * @effect N/A: exactEntryPresentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactEntryPresentは独自の失敗分岐を所有しない。
 * @invariant exactEntryPresentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactEntryPresentはProcess内の同一Subsystemで完結する。
 * @security N/A: exactEntryPresentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: exactEntryPresentは共有非同期状態を持たない同期処理である。
 */
function exactEntryPresent(text: string, entry: string): boolean {
  return text.split(/\r?\n/u).some((line) => line === entry);
}

/**
 * desiredExcludeBytesの処理を実行する。
 *
 * @responsibility desiredExcludeBytesに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input existing: Buffer、entry: string
 * @returns Readonly<{ changed: boolean; bytes: Buffer }>を返す。
 * @precondition 「existing: Buffer、entry: string」がdesiredExcludeBytesの入力契約を満たす。
 * @postcondition desiredExcludeBytesの責務を完了した結果だけを返す。
 * @effect N/A: desiredExcludeBytesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure desiredExcludeBytesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant desiredExcludeBytesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: desiredExcludeBytesはProcess内の同一Subsystemで完結する。
 * @security N/A: desiredExcludeBytesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: desiredExcludeBytesは共有非同期状態を持たない同期処理である。
 */
function desiredExcludeBytes(
  existing: Buffer,
  entry: string,
): Readonly<{ changed: boolean; bytes: Buffer }> {
  const text = decodeExclude(existing);
  if (exactEntryPresent(text, entry))
    return Object.freeze({ changed: false, bytes: Buffer.from(existing) });
  const separator =
    existing.length === 0 || existing.at(-1) === 0x0a ? "" : "\n";
  const bytes = Buffer.concat([
    existing,
    Buffer.from(`${separator}${entry}\n`, "utf8"),
  ]);
  if (bytes.length > MAX_EXCLUDE_FILE_BYTES)
    throw new Error("repository_git_exclude_too_large");
  return Object.freeze({ changed: true, bytes });
}

/**
 * safeUnlinkOwnedの処理を実行する。
 *
 * @responsibility safeUnlinkOwnedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input target: string、snapshot: EntitySnapshot
 * @returns booleanを返す。
 * @precondition 「target: string、snapshot: EntitySnapshot」がsafeUnlinkOwnedの入力契約を満たす。
 * @postcondition safeUnlinkOwnedの責務を完了した結果だけを返す。
 * @effect safeUnlinkOwnedはFilesystemの読取りまたは書込みを実行する。
 * @failure safeUnlinkOwnedは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant safeUnlinkOwnedは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: safeUnlinkOwnedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: safeUnlinkOwnedは共有非同期状態を持たない同期処理である。
 */
function safeUnlinkOwned(target: string, snapshot: EntitySnapshot): boolean {
  try {
    verifyEntitySnapshot(snapshot);
    fs.unlinkSync(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * RepositoryGitExcludeUpdateErrorが担う状態と操作を提供する。
 *
 * @responsibility RepositoryGitExcludeUpdateErrorに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000002
 * @construction RepositoryGitExcludeUpdateErrorの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle RepositoryGitExcludeUpdateErrorが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: RepositoryGitExcludeUpdateErrorの宣言自体は実行時Effectを発行しない。
 * @failure N/A: RepositoryGitExcludeUpdateErrorの宣言自体は実行時失敗を所有しない。
 * @invariant RepositoryGitExcludeUpdateErrorで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryGitExcludeUpdateErrorの宣言は外部境界を開かない。
 * @security N/A: RepositoryGitExcludeUpdateErrorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: RepositoryGitExcludeUpdateErrorは共有非同期状態を持たない同期処理である。
 */
class RepositoryGitExcludeUpdateError extends Error {
  readonly writeIssued: boolean;
  readonly cleanupConfirmed: boolean;

  constructor(hasWriteIssued: boolean, cleanupConfirmed: boolean) {
    super("repository_git_exclude_update_blocked");
    this.writeIssued = hasWriteIssued;
    this.cleanupConfirmed = cleanupConfirmed;
  }
}

/**
 * RepositoryLocalExcludeWriteResultが扱う値の構造を表す。
 *
 * @responsibility RepositoryLocalExcludeWriteResultに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape RepositoryLocalExcludeWriteResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryLocalExcludeWriteResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryLocalExcludeWriteResultの宣言は外部境界を開かない。
 * @security N/A: RepositoryLocalExcludeWriteResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryLocalExcludeWriteResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryLocalExcludeWriteResult =
  | Readonly<{
      status: "completed";
      changed: boolean;
      beforeContentIdentity: string;
      afterContentIdentity: string;
      effectIssued: boolean;
      effectConfirmation: "confirmed";
      cleanupConfirmed: true;
    }>
  | Readonly<{
      status: "blocked";
      reason: "repository_local_ignore_update_blocked";
      effectIssued: boolean;
      effectConfirmation: "not_issued" | "unknown";
      cleanupConfirmed: boolean;
    }>;

/**
 * RepositoryLocalExcludePhaseが扱う値の構造を表す。
 *
 * @responsibility RepositoryLocalExcludePhaseに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape RepositoryLocalExcludePhaseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryLocalExcludePhaseで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryLocalExcludePhaseの宣言は外部境界を開かない。
 * @security N/A: RepositoryLocalExcludePhaseはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryLocalExcludePhaseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RepositoryLocalExcludePhase =
  | "lock_open"
  | "write"
  | "fsync"
  | "close"
  | "rename"
  | "post_rename_readback"
  | "post_readback";

/**
 * contentIdentityの処理を実行する。
 *
 * @responsibility contentIdentityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input bytes: Uint8Array
 * @returns stringを返す。
 * @precondition 「bytes: Uint8Array」がcontentIdentityの入力契約を満たす。
 * @postcondition contentIdentityの責務を完了した結果だけを返す。
 * @effect N/A: contentIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: contentIdentityは独自の失敗分岐を所有しない。
 * @invariant contentIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: contentIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: contentIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: contentIdentityは共有非同期状態を持たない同期処理である。
 */
function contentIdentity(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * writeRepositoryLocalExcludeInternalの処理を実行する。
 *
 * @responsibility writeRepositoryLocalExcludeInternalに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input layout: RepositoryGitLayout、entry: unknown、phaseHook: ((phase: RepositoryLocalExcludePhase) => void) | null
 * @returns Exclude<RepositoryLocalExcludeWriteResult, { status: "blocked" }>を返す。
 * @precondition 「layout: RepositoryGitLayout、entry: unknown、phaseHook: ((phase: RepositoryLocalExcludePhase) => void) | null」がwriteRepositoryLocalExcludeInternalの入力契約を満たす。
 * @postcondition writeRepositoryLocalExcludeInternalの責務を完了した結果だけを返す。
 * @effect writeRepositoryLocalExcludeInternalはFilesystemの読取りまたは書込みを実行する。
 * @failure writeRepositoryLocalExcludeInternalは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeRepositoryLocalExcludeInternalは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: writeRepositoryLocalExcludeInternalはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: writeRepositoryLocalExcludeInternalは共有非同期状態を持たない同期処理である。
 */
function writeRepositoryLocalExcludeInternal(
  layout: RepositoryGitLayout,
  entry: unknown,
  phaseHook: ((phase: RepositoryLocalExcludePhase) => void) | null,
): Exclude<RepositoryLocalExcludeWriteResult, { status: "blocked" }> {
  if (typeof entry !== "string" || entry.length === 0) {
    throw new Error("repository_git_exclude_entry_required");
  }
  if (!layout.infoDirectory)
    throw new Error("repository_git_info_directory_required");
  verifyLayoutForWrite(layout);
  const excludePath = path.join(layout.infoDirectory.realPath, "exclude");
  let existing: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let originalSnapshot: EntitySnapshot | null = null;
  try {
    const read = readStableFileBytes(
      excludePath,
      MAX_EXCLUDE_FILE_BYTES,
      [layout.commonDirectory, layout.infoDirectory],
      true,
    );
    existing = read.value;
    originalSnapshot = read.snapshot;
    if (
      layout.excludeSnapshot &&
      !sameIdentity(layout.excludeSnapshot.identity, originalSnapshot.identity)
    ) {
      throw new Error("repository_git_exclude_changed");
    }
  } catch (error) {
    if (!isEnoent(error) || layout.excludeSnapshot) throw error;
  }
  const desired = desiredExcludeBytes(existing, entry);
  if (!desired.changed) {
    verifyLayoutForWrite(layout);
    if (originalSnapshot) verifySnapshot(originalSnapshot);
    const identity = contentIdentity(existing);
    return Object.freeze({
      status: "completed" as const,
      changed: false,
      beforeContentIdentity: identity,
      afterContentIdentity: identity,
      effectIssued: false,
      effectConfirmation: "confirmed" as const,
      cleanupConfirmed: true as const,
    });
  }
  const lockPath = path.join(
    layout.infoDirectory.realPath,
    ".crdd-runtime-exclude.lock",
  );
  let descriptor: number | null = null;
  let lockCreated = false;
  let lockSnapshot: EntitySnapshot | null = null;
  let hasRenamed = false;
  let failure: unknown = null;
  try {
    const mode = originalSnapshot
      ? Number(originalSnapshot.identity.mode & 0o777n)
      : 0o600;
    phaseHook?.("lock_open");
    descriptor = fs.openSync(
      lockPath,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
      mode,
    );
    lockCreated = true;
    const opened = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    const openedPath = identity(
      fs.lstatSync(lockPath, { bigint: true }),
      "file",
    );
    if (!sameIdentity(opened, openedPath))
      throw new Error("repository_git_exclude_lock_changed");
    lockSnapshot = Object.freeze({
      realPath: fs.realpathSync.native(lockPath),
      identity: opened,
    });
    let offset = 0;
    phaseHook?.("write");
    while (offset < desired.bytes.length) {
      const count = fs.writeSync(
        descriptor,
        desired.bytes,
        offset,
        desired.bytes.length - offset,
        null,
      );
      if (count <= 0) throw new Error("repository_git_exclude_write_failed");
      offset += count;
    }
    phaseHook?.("fsync");
    fs.fsyncSync(descriptor);
    const after = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    const pathAfter = identity(
      fs.lstatSync(lockPath, { bigint: true }),
      "file",
    );
    // This handle has written the file, so timestamps are not final yet.
    // Both observations must still describe the original object/permissions
    // and exact size; content and final timestamps are checked after close.
    for (const observed of [after, pathAfter]) {
      if (
        observed.type !== opened.type ||
        observed.dev !== opened.dev ||
        observed.ino !== opened.ino ||
        observed.birthtimeNs !== opened.birthtimeNs ||
        observed.mode !== opened.mode ||
        observed.size !== BigInt(desired.bytes.length)
      ) {
        throw new Error("repository_git_exclude_write_changed");
      }
    }
    const writtenPath = fs.realpathSync.native(lockPath);
    if (writtenPath !== lockSnapshot.realPath) {
      throw new Error("repository_git_exclude_write_changed");
    }
    lockSnapshot = Object.freeze({
      realPath: writtenPath,
      identity: after,
    });
  } catch (error) {
    failure = error;
  } finally {
    if (descriptor !== null) {
      try {
        phaseHook?.("close");
      } catch (error) {
        failure ??= error;
      }
      try {
        fs.closeSync(descriptor);
      } catch (error) {
        failure ??= error;
      }
    }
  }
  if (!failure && lockSnapshot) {
    try {
      verifyLayoutForWrite(layout);
      // A write handle's final timestamps may become visible only at close.
      // Bind the closed snapshot to this exact owned file and exact bytes;
      // never refresh Repository or original-exclude identities here.
      verifyEntitySnapshot(lockSnapshot);
      const closed = readStableFileBytes(
        lockPath,
        MAX_EXCLUDE_FILE_BYTES,
        [layout.commonDirectory],
        true,
      );
      if (
        closed.snapshot.identity.type !== lockSnapshot.identity.type ||
        closed.snapshot.identity.dev !== lockSnapshot.identity.dev ||
        closed.snapshot.identity.ino !== lockSnapshot.identity.ino ||
        closed.snapshot.identity.birthtimeNs !==
          lockSnapshot.identity.birthtimeNs ||
        closed.snapshot.identity.mode !== lockSnapshot.identity.mode ||
        closed.snapshot.identity.size !== lockSnapshot.identity.size ||
        closed.snapshot.realPath !== lockSnapshot.realPath ||
        !closed.value.equals(desired.bytes)
      ) {
        throw new Error("repository_git_exclude_write_changed");
      }
      verifyEntitySnapshot(lockSnapshot);
      lockSnapshot = closed.snapshot;
      if (originalSnapshot) verifySnapshot(originalSnapshot);
      else {
        try {
          fs.lstatSync(excludePath);
          throw new Error("repository_git_exclude_changed");
        } catch (error) {
          if (!isEnoent(error)) throw error;
        }
      }
      verifySnapshot(lockSnapshot);
      phaseHook?.("rename");
      fs.renameSync(lockPath, excludePath);
      hasRenamed = true;
      phaseHook?.("post_rename_readback");
      verifyEntitySnapshot(layout.infoDirectory);
      const verified = readStableFileBytes(
        excludePath,
        MAX_EXCLUDE_FILE_BYTES,
        [layout.commonDirectory],
        true,
      );
      if (
        !verified.value.equals(desired.bytes) ||
        !exactEntryPresent(decodeExclude(verified.value), entry)
      ) {
        throw new Error(
          "repository_git_exclude_post_write_verification_failed",
        );
      }
      verifyEntitySnapshot(layout.infoDirectory);
      verifyLayoutForWrite(layout);
      phaseHook?.("post_readback");
      return Object.freeze({
        status: "completed" as const,
        changed: true,
        beforeContentIdentity: contentIdentity(existing),
        afterContentIdentity: contentIdentity(verified.value),
        effectIssued: true,
        effectConfirmation: "confirmed" as const,
        cleanupConfirmed: true as const,
      });
    } catch (error) {
      failure = error;
    }
  }
  const cleanupConfirmed =
    hasRenamed ||
    !lockCreated ||
    (lockSnapshot !== null && safeUnlinkOwned(lockPath, lockSnapshot));
  throw new RepositoryGitExcludeUpdateError(hasRenamed, cleanupConfirmed);
}

/**
 * writeRepositoryLocalExcludeの処理を実行する。
 *
 * @responsibility writeRepositoryLocalExcludeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input layout: RepositoryGitLayout、entry: unknown、phaseHook: ((phase: RepositoryLocalExcludePhase) => void) | null
 * @returns RepositoryLocalExcludeWriteResultを返す。
 * @precondition 「layout: RepositoryGitLayout、entry: unknown、phaseHook: ((phase: RepositoryLocalExcludePhase) => void) | null」がwriteRepositoryLocalExcludeの入力契約を満たす。
 * @postcondition writeRepositoryLocalExcludeの責務を完了した結果だけを返す。
 * @effect N/A: writeRepositoryLocalExcludeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure writeRepositoryLocalExcludeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeRepositoryLocalExcludeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeRepositoryLocalExcludeはProcess内の同一Subsystemで完結する。
 * @security N/A: writeRepositoryLocalExcludeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: writeRepositoryLocalExcludeは共有非同期状態を持たない同期処理である。
 */
export function writeRepositoryLocalExclude(
  layout: RepositoryGitLayout,
  entry: unknown,
  phaseHook: ((phase: RepositoryLocalExcludePhase) => void) | null = null,
): RepositoryLocalExcludeWriteResult {
  try {
    return writeRepositoryLocalExcludeInternal(layout, entry, phaseHook);
  } catch (error) {
    const effectIssued =
      error instanceof RepositoryGitExcludeUpdateError && error.writeIssued;
    return Object.freeze({
      status: "blocked" as const,
      reason: "repository_local_ignore_update_blocked" as const,
      effectIssued,
      effectConfirmation: effectIssued
        ? ("unknown" as const)
        : ("not_issued" as const),
      cleanupConfirmed:
        error instanceof RepositoryGitExcludeUpdateError
          ? error.cleanupConfirmed
          : true,
    });
  }
}

export const REPOSITORY_GIT_EXCLUDE_MAX_BYTES = MAX_EXCLUDE_FILE_BYTES;
