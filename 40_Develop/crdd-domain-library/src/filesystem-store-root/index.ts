/**
 * Filesystem Storeへ書き込める検証済みRoot Capabilityを提供する。
 *
 * @packageDocumentation
 * @responsibility 任意Path文字列を、検証済みRootと安全な相対Pathの組合せへ置き換える。
 * @trace ARCH-000009
 * @boundary Application StoreとFilesystemの書込み境界。
 * @effect Capability作成時は読取りだけを行い、Path解決は外部Effectを発行しない。
 * @security Root外、絶対Path、親移動、Symbolic LinkおよびJunctionを拒否する。
 */
import fs from "node:fs";
import path from "node:path";

const STORE_ROOT_BRAND: unique symbol = Symbol("filesystem-store-root");

/**
 * 検証済みFilesystem Store Root Capabilityを定義する。
 *
 * @responsibility 許可済みRootの絶対Pathを偽造不能な型へ閉じる。
 * @trace ARCH-000009
 * @shape Brandと正規化済みRootを持つ読取り専用値である。
 * @invariant Brandは本Moduleだけが発行し、Rootは絶対Pathである。
 * @boundary Application StoreとFilesystem Path解決の境界。
 * @security 任意文字列をRoot Capabilityとして受理しない。
 * @compatibility 利用側は公開生成関数を介して取得する。
 */
export type FilesystemStoreRoot = Readonly<{
  [STORE_ROOT_BRAND]: true;
  root: string;
}>;

/**
 * 既存の通常DirectoryをFilesystem Store Rootとして検証する。
 *
 * @responsibility Root自身と既存親chainがLinkでなく、実Pathと一致することを確認する。
 * @trace ARCH-000009
 * @input root: Store専用として呼出し側が許可した絶対Directory。
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
export function createFilesystemStoreRoot(
  root: string,
): FilesystemStoreRoot | null {
  if (!path.isAbsolute(root)) return null;
  const resolved = path.resolve(root);
  try {
    const metadata = fs.lstatSync(resolved);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
    if (fs.realpathSync.native(resolved) !== resolved) return null;
    return Object.freeze({ [STORE_ROOT_BRAND]: true as const, root: resolved });
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
 * @precondition relativePathは用途側が定義したFile名または下位Pathである。
 * @postcondition 戻り値はRoot自身ではなくRoot配下にある。
 * @effect Filesystem metadataとrealpathを読取るだけである。
 * @failure 空、絶対Path、親移動、Root外またはLink chainを例外で拒否する。
 * @invariant 文字列prefixでなくpath.relativeで包含を判定する。
 * @boundary Filesystem Store Capability→具体File Path。
 * @security Capabilityが許可しないRootへPathを拡張しない。
 * @concurrency 利用側はEffect直前に本関数を呼び、同じPathを使用する。
 */
export function resolveFilesystemStorePath(
  capability: FilesystemStoreRoot,
  relativePath: string,
): string {
  if (!relativePath || path.isAbsolute(relativePath))
    throw new Error("filesystem_store_relative_path_required");
  const target = path.resolve(capability.root, relativePath);
  const relative = path.relative(capability.root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("filesystem_store_path_outside_root");
  assertExistingChainIsDirect(capability.root, target);
  return target;
}

/**
 * Capability内の一回性Lock Fileを使って同期操作を排他的に実行する。
 *
 * @responsibility 複数Processのread-check-writeを同じKernel排他へ閉じる。
 * @trace ARCH-000009
 * @input capability: Store Root、lockRelativePath: Lock File、operation: 排他対象の同期操作。
 * @returns Lock取得可否と、取得時の操作結果。
 * @precondition operationは同期的で、同じStoreのWriterは同じLockを利用する。
 * @postcondition 正常・例外を問わず取得したLock Fileを閉じて削除する。
 * @effect Lock Fileを排他的に作成・削除し、operationが宣言するEffectを実行する。
 * @failure 既存Lockはacquired=false、その他のFilesystem失敗は例外で返す。
 * @invariant Lock未取得時はoperationを呼ばない。
 * @boundary Store Writer→Filesystem Kernel Create-exclusive境界。
 * @security Lock Pathも同じRoot Capabilityからだけ解決する。
 * @concurrency flag=wxにより同じLockの同時取得を一つに限定する。
 */
export function withFilesystemStoreLock<T>(
  capability: FilesystemStoreRoot,
  lockRelativePath: string,
  operation: () => T,
): Readonly<{ acquired: false }> | Readonly<{ acquired: true; value: T }> {
  const lockFile = resolveFilesystemStorePath(capability, lockRelativePath);
  fs.mkdirSync(path.dirname(lockFile), { recursive: true, mode: 0o700 });
  let descriptor: number;
  try {
    descriptor = fs.openSync(lockFile, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      return Object.freeze({ acquired: false as const });
    throw error;
  }
  try {
    return Object.freeze({ acquired: true as const, value: operation() });
  } finally {
    fs.closeSync(descriptor);
    fs.rmSync(lockFile, { force: true });
  }
}
