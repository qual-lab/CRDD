/**
 * 固定config所在の準備・File読取り・保存Rootを所有する。
 * @responsibility 構成モデル内部の固定設定保存だけを扱う。
 * @trace ARCH-000011
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  type Repository,
  registerRepositoryLocalIgnore,
  resolveVerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";

/** 設定Owner内部だけで固定Pathを作る。任意領域の要求を受け付けない。 */
export function configurationPaths(repository: Repository) {
  const repositoryRoot = resolveVerifiedRepositoryRoot(repository);
  if (
    !repositoryRoot ||
    !path.isAbsolute(repositoryRoot) ||
    path.resolve(repositoryRoot) !== repositoryRoot
  )
    return null;
  const root = path.join(repositoryRoot, ".crdd");
  return Object.freeze({
    repositoryRoot,
    root,
    config: path.join(root, "config"),
  });
}

/** 読取りだけで真正不存在・境界不正・観測不能を区別する。 */
export function observeConfigurationDirectory(repository: Repository) {
  try {
    const paths = configurationPaths(repository);
    if (!paths)
      return Object.freeze({
        status: "blocked" as const,
        reason: "repository_runtime_data_root_capability_invalid",
        effectIssued: false as const,
      });
    const identities: string[] = [];
    for (const target of [paths.root, paths.config]) {
      let metadata: fs.BigIntStats;
      try {
        metadata = fs.lstatSync(target, { bigint: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          return Object.freeze({
            status: "not_observed" as const,
            reason: "repository_runtime_data_area_absent",
            effectIssued: false as const,
          });
        throw error;
      }
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.realpathSync.native(target) !== target
      )
        return Object.freeze({
          status: "blocked" as const,
          reason: "repository_runtime_data_area_boundary_invalid",
          effectIssued: false as const,
        });
      const canonical = fs.lstatSync(fs.realpathSync.native(target), {
        bigint: true,
      });
      if (canonical.dev !== metadata.dev || canonical.ino !== metadata.ino)
        return Object.freeze({
          status: "blocked" as const,
          reason: "repository_runtime_data_area_boundary_invalid",
          effectIssued: false as const,
        });
      identities.push(metadata.dev.toString(), metadata.ino.toString());
    }
    return Object.freeze({
      status: "ready" as const,
      repositoryRoot: paths.repositoryRoot,
      directory: paths.config,
      boundaryIdentity: createHash("sha256")
        .update(identities.join("\0"))
        .digest("hex"),
      effectIssued: false as const,
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "repository_runtime_data_area_observation_failed",
      effectIssued: false as const,
    });
  }
}

/** 設定保存の明示要求だけが既存Ignore登録後に固定Directoryを準備する。 */
export function ensureConfigurationDirectory(repository: Repository) {
  const paths = configurationPaths(repository);
  if (!paths) return null;
  const ignore = registerRepositoryLocalIgnore(repository, ".crdd/");
  if (ignore.status !== "registered")
    return Object.freeze({
      status: "blocked" as const,
      reason: "repository_runtime_data_ignore_registration_blocked" as const,
      effectIssued: ignore.effectIssued,
      effectStateUnknown: ignore.effectStateUnknown,
      effectConfirmation: ignore.effectConfirmation,
      cleanupConfirmed: ignore.cleanupConfirmed,
      retryAllowed: ignore.retryAllowed,
      recoveryReference: ignore.recoveryReference,
      repositoryPathReported: false as const,
    });
  for (const target of [paths.root, paths.config]) {
    try {
      fs.mkdirSync(target, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const metadata = fs.lstatSync(target);
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      fs.realpathSync.native(target) !== target
    )
      throw new Error("runtime_data_area_boundary_invalid");
  }
  return Object.freeze({
    status: "ready" as const,
    repositoryRoot: paths.repositoryRoot,
    directory: paths.config,
  });
}

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

const STORE_ROOT_BRAND: unique symbol = Symbol("filesystem-store-root");
const issuedStoreRoots = new WeakSet<object>();

export type ConfigurationStoreRoot = Readonly<{
  [STORE_ROOT_BRAND]: true;
  root: string;
}>;

/**
 * 既存の.crdd/config Directoryだけを設定保存Rootとして検証する。
 *
 * @responsibility Root自身と既存親chainがLinkでなく、実Pathと一致することを確認する。
 * @trace ARCH-000009
 * @input root: 設定Directoryの絶対Path。
 * @returns 検証済みCapability。条件不成立時はnull。
 * @precondition rootは呼出し側が所有する用途限定Root候補である。
 * @postcondition 成功時は不変の絶対RootだけをCapabilityへ保持する。
 * @effect Filesystem metadataとrealpathを読取るだけである。
 * @failure 相対Path、不在、非Directory、Linkまたは実Path不一致をnullで拒否する。
 * @invariant Capabilityは本関数以外から構築できない。
 * @boundary Caller Authority→Filesystem Root Capability。
 * @security Link経由で別RootへAuthorityを拡張しない。
 * @concurrency 検証後の置換は防げないため、利用時にも既存chainを再検証する。
 */
export function createConfigurationStoreRoot(
  root: string,
): ConfigurationStoreRoot | null {
  if (
    !path.isAbsolute(root) ||
    path.basename(root) !== "config" ||
    path.basename(path.dirname(root)) !== ".crdd"
  )
    return null;
  const resolved = path.resolve(root);
  try {
    const metadata = fs.lstatSync(resolved);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
    if (fs.realpathSync.native(resolved) !== resolved) return null;
    const capability = Object.freeze({
      [STORE_ROOT_BRAND]: true as const,
      root: resolved,
    });
    issuedStoreRoots.add(capability);
    return capability;
  } catch {
    return null;
  }
}

/**
 * 既存Path chainがRootへ直接到達することを確認する。
 *
 * @responsibility TargetからRootまでの既存要素でLinkまたは実Path差替えを拒否する。
 * @trace ARCH-000009
 * @input 検証済みRoot Pathと確認対象Target Path。
 * @returns N/A: 条件成立時に復帰する。
 * @precondition TargetはRoot配下へ字句正規化済みである。
 * @postcondition 既存chainの全要素がRootへ直接接続することを確認済みとなる。
 * @effect Filesystem metadataとrealpathを読取るだけである。
 * @failure Link、Root外またはRootへ到達しないchainを例外で拒否する。
 * @invariant 不在suffixは最初の既存親から評価する。
 * @boundary 正規化PathとFilesystem実体の境界。
 * @security Link経由のRoot逸脱を許可しない。
 * @concurrency 観測後の置換は利用側Effect直前の再解決で再確認する。
 */
function assertExistingChainIsDirect(root: string, target: string): void {
  let cursor = target;
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) throw new Error("filesystem_store_path_invalid");
    cursor = parent;
  }
  while (true) {
    const metadata = fs.lstatSync(cursor);
    if (metadata.isSymbolicLink())
      throw new Error("filesystem_store_path_link_forbidden");
    if (fs.realpathSync.native(cursor) !== path.resolve(cursor))
      throw new Error("filesystem_store_path_link_forbidden");
    if (cursor === root) return;
    const parent = path.dirname(cursor);
    if (parent === cursor)
      throw new Error("filesystem_store_path_outside_root");
    cursor = parent;
  }
}

/**
 * Capability内の相対Pathを安全な絶対Pathへ解決する。
 *
 * @responsibility 書込み先をCapability Root配下へ閉じ、既存Link chainを拒否する。
 * @trace ARCH-000009
 * @input capability: 検証済みRoot、relativePath: Root相対Path。
 * @returns Root配下の正規化済み絶対Path。
 * @precondition relativePathは設定保存Ownerが生成したFile名である。
 * @postcondition 戻り値はRoot自身ではなくRoot配下にある。
 * @effect Filesystem metadataとrealpathを読取るだけである。
 * @failure 空、絶対Path、親移動、Root外またはLink chainを例外で拒否する。
 * @invariant 文字列prefixでなくpath.relativeで包含を判定する。
 * @boundary Filesystem Store Capability→具体File Path。
 * @security Capabilityが許可しないRootへPathを拡張しない。
 * @concurrency 利用側はEffect直前に本関数を呼び、同じPathを使用する。
 */
export function resolveConfigurationFile(
  capability: ConfigurationStoreRoot,
  relativePath: string,
): string {
  if (
    typeof capability !== "object" ||
    capability === null ||
    !issuedStoreRoots.has(capability)
  )
    throw new Error("filesystem_store_root_capability_invalid");
  if (!relativePath || path.isAbsolute(relativePath))
    throw new Error("filesystem_store_relative_path_required");
  const target = path.resolve(capability.root, relativePath);
  const relative = path.relative(capability.root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("filesystem_store_path_outside_root");
  assertExistingChainIsDirect(capability.root, target);
  return target;
}
