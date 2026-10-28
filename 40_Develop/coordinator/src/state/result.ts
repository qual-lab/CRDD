/**
 * CoordinatorのPort結果と公開結果を定義する。
 *
 * @responsibility 内部Portの成功・失敗と公開結果の情報境界を区別する。
 * @trace ARCH-000004
 */

import type { RepositoryRuntimeDataAreaBlockedError } from "../../../domain-model/src/index.ts";

/**
 * port-resultで使用するCoordinator Port 結果の値契約を定義する。
 *
 * @responsibility Coordinator Port 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorPortResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorPortResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorPortResultの宣言は外部境界を開かない。
 * @security N/A: CoordinatorPortResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorPortResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorPortResult<T> = Readonly<
  | { status: "completed"; reason: string; value: T }
  | {
      status: "blocked";
      reason: string;
      value: null;
      manualRecoveryRequired: boolean;
      recoveryId: string | null;
    }
>;

/** Transport-neutral result envelope produced by the Coordinator application. */

/**
 * Runtime Data Boundary Blockedを公開結果へ投影する。
 *
 * @responsibility Runtime Data Boundary Blockedの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input error: RepositoryRuntimeDataAreaBlockedError
 * @returns coordinatorDataBoundaryBlockedの計算結果を返す。
 * @precondition 「error: RepositoryRuntimeDataAreaBlockedError」がcoordinatorDataBoundaryBlockedの入力契約を満たす。
 * @postcondition coordinatorDataBoundaryBlockedの責務を完了した結果だけを返す。
 * @effect N/A: coordinatorDataBoundaryBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: coordinatorDataBoundaryBlockedは独自の失敗分岐を所有しない。
 * @invariant coordinatorDataBoundaryBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: coordinatorDataBoundaryBlockedはProcess内の同一Subsystemで完結する。
 * @security N/A: coordinatorDataBoundaryBlockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: coordinatorDataBoundaryBlockedは共有非同期状態を持たない同期処理である。
 */
export function coordinatorDataBoundaryBlocked(
  error: RepositoryRuntimeDataAreaBlockedError,
) {
  const ownerReleased =
    error.cause !== "coordinator_snapshot_lock_release_unconfirmed";
  return Object.freeze({
    contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
    status: "blocked" as const,
    reason: error.reason,
    cleanupConfirmed: error.cleanupConfirmed && ownerReleased,
    manualRecoveryRequired:
      error.effectStateUnknown || !error.cleanupConfirmed || !ownerReleased,
    effectState: error.effectStateUnknown
      ? ("unknown" as const)
      : error.effectIssued
        ? ("settled" as const)
        : ("no_effect" as const),
    effectIssued: error.effectIssued,
    effectStateUnknown: error.effectStateUnknown,
    retryAllowed: error.retryAllowed && ownerReleased,
    recoveryIds: Object.freeze(
      error.recoveryReference === null ? [] : [error.recoveryReference],
    ),
  });
}

/**
 * durable-foundationで使用するStore 結果の値契約を定義する。
 *
 * @responsibility Store 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape StoreResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StoreResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: StoreResultの宣言は外部境界を開かない。
 * @security StoreResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility StoreResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type StoreResult<T> = CoordinatorPortResult<T>;

/**
 * completedを決定する。
 *
 * @responsibility completedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input reason: string、value: T
 * @returns StoreResult<T>を返す。
 * @precondition 「reason: string、value: T」がcompletedの入力契約を満たす。
 * @postcondition completedの責務を完了した結果だけを返す。
 * @effect N/A: completedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: completedは独自の失敗分岐を所有しない。
 * @invariant completedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: completedはProcess内の同一Subsystemで完結する。
 * @security completedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: completedは共有非同期状態を持たない同期処理である。
 */
export function completed<T>(reason: string, value: T): StoreResult<T> {
  return Object.freeze({ status: "completed", reason, value });
}

/**
 * durable-foundationを停止結果として構築する。
 *
 * @responsibility durable-foundationの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input reason: string、manualRecoveryRequired、recoveryId: string | null
 * @returns StoreResult<T>を返す。
 * @precondition 「reason: string、manualRecoveryRequired、recoveryId: string | null」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
export function blocked<T>(
  reason: string,
  manualRecoveryRequired = false,
  recoveryId: string | null = null,
): StoreResult<T> {
  return Object.freeze({
    status: "blocked",
    reason,
    value: null,
    manualRecoveryRequired,
    recoveryId,
  });
}

import { COORDINATOR_PUBLIC_RUNTIME_CONTRACT } from "../../../domain-model/src/index.ts";
