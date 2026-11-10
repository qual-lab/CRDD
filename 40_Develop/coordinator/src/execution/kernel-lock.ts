/**
 * 上位が確定した所在とScopeを共通wx排他へ接続する。
 * @responsibility Home・Runtime状態・Host世代の技術Identityを所有する。
 * @trace ARCH-000015
 * @boundary 残存は自動回復しない。全利用者停止下の処置は別手順。
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { acquireLock, type LockResult } from "../../../lock/src/index.ts";

/** Scopeと固定名を検査して取得し、不明・残存は保持handleを返さない。 */
function acquireScope(
  directory: unknown,
  scope: string,
  binding: unknown,
): LockResult {
  if (
    typeof directory !== "string" ||
    typeof binding !== "string" ||
    !/^[0-9a-f]{64}$/u.test(binding)
  )
    return Object.freeze({
      status: "blocked",
      reason: "lock_input_invalid",
      reference: null,
      cleanupConfirmed: true,
      descriptorClosed: true,
    });
  const result = acquireLock({
    directory,
    name: `${scope}.${binding}.lock`,
    identity: `${scope}:${binding}`,
  });
  return result;
}

/** 同じHomeはRepositoryに関係なく同じProviderHomes親DirectoryとBindingを使用する。 */
export function acquireProviderHomeLock(
  binding: unknown,
  directory: unknown,
): LockResult {
  return acquireScope(directory, "provider-home", binding);
}

/** 同じRuntime状態と回復処理を、Ownerが確定した既存RuntimeState内で排他する。 */
export function acquireRuntimeStateLock(directory: unknown): LockResult {
  if (typeof directory !== "string")
    return Object.freeze({
      status: "blocked",
      reason: "lock_input_invalid",
      reference: null,
      cleanupConfirmed: true,
      descriptorClosed: true,
    });
  // RuntimeStateはRepositoryやHomeをまたいで共有される。同じ所在は同じLockで保護する。
  const result = acquireLock({
    directory,
    name: "docker-state.lock",
    identity: "docker-state:shared",
  });
  return result;
}

/** 元Host世代のIdentityを導出する。Hash自体は生存・削除許可ではない。 */
export function hostOperationGenerationBindingHash(
  rootName: unknown,
  nonce: unknown,
): string | null {
  if (
    typeof rootName !== "string" ||
    !/^crdd-coordinator-doctor-[A-Za-z0-9_-]{6,64}$/u.test(rootName) ||
    typeof nonce !== "string" ||
    !/^[a-f0-9-]{32,48}$/u.test(nonce)
  )
    return null;
  return createHash("sha256")
    .update("crdd-host-operation-generation-v1\0")
    .update(rootName)
    .update("\0")
    .update(nonce)
    .digest("hex");
}

/** 回収対象Rootの外で元世代を保持し、通常清掃がLockを消さないようにする。 */
export function acquireHostOperationLock(
  root: unknown,
  nonce: unknown,
): LockResult {
  const refused: LockResult = Object.freeze({
    status: "blocked",
    reason: "lock_input_invalid",
    reference: null,
    cleanupConfirmed: true,
    descriptorClosed: true,
  });
  if (
    typeof root !== "string" ||
    !path.isAbsolute(root) ||
    path.resolve(root) !== root
  )
    return refused;
  const binding = hostOperationGenerationBindingHash(
    path.basename(root),
    nonce,
  );
  return binding
    ? acquireLock({
        directory: path.dirname(root),
        name: `host-operation.${binding}.lock`,
        identity: `host-operation:${binding}`,
      })
    : refused;
}

/**
 * windows-platform-adapterで使用するCoordinator Windows Lease 所有者 Observationの値契約を定義する。
 *
 * @responsibility Coordinator Windows Lease 所有者 ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorWindowsLeaseOwnerObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorWindowsLeaseOwnerObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorWindowsLeaseOwnerObservationの宣言は外部境界を開かない。
 * @security CoordinatorWindowsLeaseOwnerObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CoordinatorWindowsLeaseOwnerObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorWindowsLeaseOwnerObservation = Readonly<{
  status: "alive" | "absent" | "unknown";
  ownerProcessId: number;
  ownerGeneration: string;
}>;

/**
 * Lease 所有者を観測する。
 *
 * @responsibility Lease 所有者の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawOwner: unknown
 * @returns CoordinatorWindowsLeaseOwnerObservationを返す。
 * @precondition 「rawOwner: unknown」がobserveLeaseOwnerの入力契約を満たす。
 * @postcondition observeLeaseOwnerの責務を完了した結果だけを返す。
 * @effect observeLeaseOwnerは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure observeLeaseOwnerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeLeaseOwnerは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security observeLeaseOwnerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeLeaseOwnerは共有非同期状態を持たない同期処理である。
 */
export function observeLeaseOwner(
  rawOwner: unknown,
): CoordinatorWindowsLeaseOwnerObservation {
  const invalid = Object.freeze({
    status: "unknown" as const,
    ownerProcessId: 0,
    ownerGeneration: "invalid",
  });
  if (
    !rawOwner ||
    typeof rawOwner !== "object" ||
    Array.isArray(rawOwner) ||
    Object.getPrototypeOf(rawOwner) !== Object.prototype
  )
    return invalid;
  const owner = rawOwner as Readonly<Record<string, unknown>>;
  if (
    Object.keys(owner).sort().join("\0") !==
      ["ownerGeneration", "ownerProcessId"].sort().join("\0") ||
    !Number.isSafeInteger(owner.ownerProcessId) ||
    Number(owner.ownerProcessId) < 1 ||
    typeof owner.ownerGeneration !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(owner.ownerGeneration)
  )
    return invalid;
  const ownerProcessId = Number(owner.ownerProcessId);
  const ownerGeneration = owner.ownerGeneration;
  let status: "alive" | "absent" | "unknown" = "unknown";
  try {
    process.kill(ownerProcessId, 0);
    status = "alive";
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ESRCH"
    )
      status = "absent";
  }
  return Object.freeze({
    status,
    ownerProcessId,
    ownerGeneration,
  });
}
