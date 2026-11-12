/**
 * AI設定の固定Store Root・Fileと共通wx Lockへの同期保存接続を所有する。
 * @responsibility 保存OwnerのPath境界を検証し、取得失敗時は処理しない。
 * @trace ARCH-000009
 * @boundary 自動回復は行わず、残存時は全利用Process停止下の明示処置へ返す。
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { acquireLock } from "../../../lock/src/index.ts";

const STORE_ROOT_BRAND: unique symbol = Symbol("filesystem-store-root");
const issuedStoreRoots = new WeakSet<object>();

type ConfigurationStoreRoot = Readonly<{
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

type ConfigurationLockResult<T> =
  | Readonly<{
      acquired: false;
      reason:
        | "filesystem_store_lock_exists"
        | "filesystem_store_lock_observation_unknown";
    }>
  | Readonly<{
      acquired: false;
      reason: "filesystem_store_lock_recovery_required";
      recoveryId: string;
    }>
  | Readonly<{ acquired: true; cleanupConfirmed: true; value: T }>
  | Readonly<{
      acquired: true;
      cleanupConfirmed: false;
      operationCompleted: true;
      reason: "filesystem_store_lock_operation_completed_cleanup_unknown";
      recoveryId: string;
      value: T;
    }>
  | Readonly<{
      acquired: true;
      cleanupConfirmed: false;
      operationCompleted: false;
      reason: "filesystem_store_lock_operation_failed_cleanup_unknown";
      recoveryId: string;
      error: unknown;
    }>;

/**
 * 同じRoot内の取得・同期操作・同世代解放を共通wx実装へ接続する。
 * @effect Lock File作成・通常解放とoperationのEffect。残存削除・PID照会はしない。
 * @failure 未取得ではoperationを呼ばず、解放不明は元の操作結果と別に返す。
 * @concurrency Reader・Writer・清掃は同じLockへ参加し、Recoveryは全利用Process停止下だけ。
 */
export function withConfigurationLock<T>(
  capability: ConfigurationStoreRoot,
  operation: () => T,
): ConfigurationLockResult<T> {
  const lockRelativePath = "ai-selection.lock";
  const lockFile = resolveConfigurationFile(capability, lockRelativePath);
  // 旧清掃義務は読取り拒否だけに使い、自動変換・自動回収しない。
  try {
    fs.lstatSync(`${lockFile}.recovery-obligation`);
    return Object.freeze({
      acquired: false,
      reason: "filesystem_store_lock_observation_unknown",
    });
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "ENOENT"
    )
      return Object.freeze({
        acquired: false,
        reason: "filesystem_store_lock_observation_unknown",
      });
  }
  const identity = createHash("sha256")
    .update("crdd-filesystem-store-lock-v2\0")
    .update(capability.root)
    .update("\0")
    .update(lockRelativePath)
    .digest("hex");
  const acquired = acquireLock({
    directory: path.dirname(lockFile),
    name: path.basename(lockFile),
    identity: `filesystem-store:${identity}`,
  });
  if (acquired.status !== "acquired") {
    if (acquired.reference)
      return Object.freeze({
        acquired: false,
        reason: "filesystem_store_lock_recovery_required",
        recoveryId: `filesystem-store-lock.${acquired.reference.generation}`,
      });
    return Object.freeze({
      acquired: false,
      reason:
        acquired.reason === "lock_exists"
          ? "filesystem_store_lock_exists"
          : "filesystem_store_lock_observation_unknown",
    });
  }
  let outcome:
    | Readonly<{ status: "completed"; value: T }>
    | Readonly<{ status: "failed"; error: unknown }>;
  try {
    outcome = { status: "completed", value: operation() };
  } catch (error) {
    outcome = { status: "failed", error };
  }
  const cleanupConfirmed = acquired.lock.release();
  if (!cleanupConfirmed) {
    const recoveryId = `filesystem-store-lock.${acquired.lock.reference.generation}`;
    return outcome.status === "completed"
      ? Object.freeze({
          acquired: true,
          cleanupConfirmed: false as const,
          operationCompleted: true as const,
          reason: "filesystem_store_lock_operation_completed_cleanup_unknown",
          recoveryId,
          value: outcome.value,
        })
      : Object.freeze({
          acquired: true,
          cleanupConfirmed: false as const,
          operationCompleted: false as const,
          reason: "filesystem_store_lock_operation_failed_cleanup_unknown",
          recoveryId,
          error: outcome.error,
        });
  }
  if (outcome.status === "failed") throw outcome.error;
  return Object.freeze({
    acquired: true,
    cleanupConfirmed: true as const,
    value: outcome.value,
  });
}
