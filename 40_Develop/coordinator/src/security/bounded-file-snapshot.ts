/**
 * bounded-file-snapshotに属する責務をまとめる。
 *
 * @responsibility StableFileIdentityを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000014
 */
import fs from "node:fs";
import path from "node:path";

/**
 * bounded-file-snapshotで使用するStable File Identityの値契約を定義する。
 *
 * @responsibility Stable File IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape StableFileIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StableFileIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: StableFileIdentityの宣言は外部境界を開かない。
 * @security StableFileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility StableFileIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type StableFileIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  ctimeNs: bigint;
  mtimeNs: bigint;
  size: bigint;
  mode: bigint;
}>;

/**
 * identityを決定する。
 *
 * @responsibility identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input metadata: fs.BigIntStats、maximumBytes: number
 * @returns identityの計算結果を返す。
 * @precondition 「metadata: fs.BigIntStats、maximumBytes: number」がidentityの入力契約を満たす。
 * @postcondition identityの責務を完了した結果だけを返す。
 * @effect N/A: identityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure identityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant identityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: identityはProcess内の同一Subsystemで完結する。
 * @security identityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: identityは共有非同期状態を持たない同期処理である。
 */
function identity(metadata: fs.BigIntStats, maximumBytes: number) {
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n ||
    metadata.size <= 0n ||
    metadata.size > BigInt(maximumBytes)
  )
    throw new Error("bounded_file_snapshot_invalid");
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
 * Stable File Identityが同一かを判定する。
 *
 * @responsibility Stable File Identityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000014
 * @input left: StableFileIdentity、right: StableFileIdentity
 * @returns sameStableFileIdentityの計算結果を返す。
 * @precondition 「left: StableFileIdentity、right: StableFileIdentity」がsameStableFileIdentityの入力契約を満たす。
 * @postcondition sameStableFileIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameStableFileIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameStableFileIdentityは独自の失敗分岐を所有しない。
 * @invariant sameStableFileIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameStableFileIdentityはProcess内の同一Subsystemで完結する。
 * @security sameStableFileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameStableFileIdentityは共有非同期状態を持たない同期処理である。
 */
export function sameStableFileIdentity(
  left: StableFileIdentity,
  right: StableFileIdentity,
) {
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
 * Stable Bounded File Snapshotを読み取る。
 *
 * @responsibility Stable Bounded File Snapshotの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000014
 * @input file: string、maximumBytes: number
 * @returns readStableBoundedFileSnapshotの計算結果を返す。
 * @precondition 「file: string、maximumBytes: number」がreadStableBoundedFileSnapshotの入力契約を満たす。
 * @postcondition readStableBoundedFileSnapshotの責務を完了した結果だけを返す。
 * @effect readStableBoundedFileSnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure readStableBoundedFileSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readStableBoundedFileSnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readStableBoundedFileSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readStableBoundedFileSnapshotは共有非同期状態を持たない同期処理である。
 */
export function readStableBoundedFileSnapshot(
  file: string,
  maximumBytes: number,
) {
  if (
    !Number.isSafeInteger(maximumBytes) ||
    maximumBytes <= 0 ||
    !path.isAbsolute(file)
  )
    throw new Error("bounded_file_snapshot_invalid");
  const resolved = path.resolve(file);
  const before = identity(
    fs.lstatSync(resolved, { bigint: true }),
    maximumBytes,
  );
  if (fs.realpathSync.native(resolved) !== resolved)
    throw new Error("bounded_file_snapshot_invalid");
  const descriptor = fs.openSync(resolved, fs.constants.O_RDONLY);
  try {
    const opened = identity(
      fs.fstatSync(descriptor, { bigint: true }),
      maximumBytes,
    );
    if (!sameStableFileIdentity(before, opened))
      throw new Error("bounded_file_snapshot_changed");
    const chunks: Buffer[] = [];
    const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, maximumBytes + 1));
    let byteLength = 0;
    while (true) {
      const remaining = maximumBytes + 1 - byteLength;
      if (remaining <= 0) throw new Error("bounded_file_snapshot_invalid");
      const count = fs.readSync(
        descriptor,
        buffer,
        0,
        Math.min(buffer.length, remaining),
        null,
      );
      if (count === 0) break;
      byteLength += count;
      if (byteLength > maximumBytes)
        throw new Error("bounded_file_snapshot_invalid");
      chunks.push(Buffer.from(buffer.subarray(0, count)));
    }
    const after = identity(
      fs.fstatSync(descriptor, { bigint: true }),
      maximumBytes,
    );
    const pathAfter = identity(
      fs.lstatSync(resolved, { bigint: true }),
      maximumBytes,
    );
    if (
      byteLength !== Number(opened.size) ||
      !sameStableFileIdentity(opened, after) ||
      !sameStableFileIdentity(opened, pathAfter) ||
      fs.realpathSync.native(resolved) !== resolved
    )
      throw new Error("bounded_file_snapshot_changed");
    return Object.freeze({
      path: resolved,
      identity: opened,
      bytes: Buffer.concat(chunks, byteLength),
    });
  } finally {
    fs.closeSync(descriptor);
  }
}
