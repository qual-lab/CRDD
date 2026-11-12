/**
 * 設定保存内のFile読取りで実体の安定性を確認する。
 *
 * @responsibility 読取り前後の実体同一性、descriptor終了を確認する。利用側の状態や回復方針は所有しない。
 * @trace ARCH-000014
 */
import fs from "node:fs";
import path from "node:path";

/**
 * file-snapshotで使用するStable File Identityの値契約を定義する。
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
 * @input metadata: fs.BigIntStats
 * @returns identityの計算結果を返す。
 * @precondition 「metadata: fs.BigIntStats」がidentityの入力契約を満たす。
 * @postcondition identityの責務を完了した結果だけを返す。
 * @effect N/A: identityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure identityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant identityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: identityはProcess内の同一Subsystemで完結する。
 * @security identityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: identityは共有非同期状態を持たない同期処理である。
 */
function identity(metadata: fs.BigIntStats) {
  const ino = normalizeFileId(metadata.ino);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    typeof ino !== "bigint" ||
    metadata.dev <= 0n ||
    ino <= 0n ||
    metadata.birthtimeNs <= 0n ||
    metadata.size <= 0n
  )
    throw new Error("file_snapshot_invalid");
  return Object.freeze({
    dev: metadata.dev,
    ino,
    birthtimeNs: metadata.birthtimeNs,
    ctimeNs: metadata.ctimeNs,
    mtimeNs: metadata.mtimeNs,
    size: metadata.size,
    mode: metadata.mode,
  });
}

/**
 * Windowsの符号付き64bit File IDを同じ実体の符号なし表現に揃える。
 * @responsibility Readerと保存Writerの同一性比較で同じ表現規則を使う。
 * @trace ARCH-000014
 * @input ino: OSから観測したFile ID。
 * @returns Windowsの有効な負の64bit表現だけを正規化する。
 * @precondition 呼出し側がFile Identity全体の妥当性を検査する。
 * @postcondition 同じ64bit IDの意味を変えず、範囲外の値を補正しない。
 * @effect N/A: 入力値だけを変換する。
 * @failure N/A: 不正値の拒否は呼出し側が所有する。
 * @invariant Windows以外と他のIdentity項目を変更しない。
 * @boundary Process内の保存部品。
 * @security 異なるFile IDを同一と扱わない。
 * @concurrency N/A: 共有状態を持たない。
 */
function normalizeFileId(ino: bigint): bigint {
  return process.platform === "win32" &&
    typeof ino === "bigint" &&
    ino >= -(1n << 63n) &&
    ino < 0n
    ? BigInt.asUintN(64, ino)
    : ino;
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
    normalizeFileId(left.ino) === normalizeFileId(right.ino) &&
    left.birthtimeNs === right.birthtimeNs &&
    left.ctimeNs === right.ctimeNs &&
    left.mtimeNs === right.mtimeNs &&
    left.size === right.size &&
    left.mode === right.mode
  );
}

/**
 * Stable File Snapshotを読み取る。
 *
 * @responsibility Stable File Snapshotの読取り元と読取不能時の結果境界を所有する。
 * @trace ARCH-000014
 * @input file: string
 * @returns readStableFileSnapshotの計算結果を返す。
 * @precondition 「file: string」がreadStableFileSnapshotの入力契約を満たす。
 * @postcondition readStableFileSnapshotの責務を完了した結果だけを返す。
 * @effect Filesystemを読み取り、読取り用descriptorを開閉する。書込みは行わない。
 * @failure readStableFileSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readStableFileSnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readStableFileSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readStableFileSnapshotは共有非同期状態を持たない同期処理である。
 */
export function readStableFileSnapshot(file: string) {
  if (!path.isAbsolute(file)) throw new Error("file_snapshot_invalid");
  const resolved = path.resolve(file);
  const before = identity(fs.lstatSync(resolved, { bigint: true }));
  if (fs.realpathSync.native(resolved) !== resolved)
    throw new Error("file_snapshot_invalid");
  const descriptor = fs.openSync(resolved, fs.constants.O_RDONLY);
  try {
    const opened = identity(fs.fstatSync(descriptor, { bigint: true }));
    if (!sameStableFileIdentity(before, opened))
      throw new Error("file_snapshot_changed");
    const chunks: Buffer[] = [];
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let byteLength = 0;
    while (true) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      byteLength += count;
      chunks.push(Buffer.from(buffer.subarray(0, count)));
    }
    const after = identity(fs.fstatSync(descriptor, { bigint: true }));
    const pathAfter = identity(fs.lstatSync(resolved, { bigint: true }));
    if (
      byteLength !== Number(opened.size) ||
      !sameStableFileIdentity(opened, after) ||
      !sameStableFileIdentity(opened, pathAfter) ||
      fs.realpathSync.native(resolved) !== resolved
    )
      throw new Error("file_snapshot_changed");
    return Object.freeze({
      path: resolved,
      identity: opened,
      bytes: Buffer.concat(chunks, byteLength),
    });
  } finally {
    fs.closeSync(descriptor);
  }
}
