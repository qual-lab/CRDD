/**
 * 状態照会の入力を検査する。
 *
 * @responsibility 照会対象・ID・改訂の閉じた入力契約を所有する。
 * @trace ARCH-000004
 */

import { snapshotPlainRecord } from "./validation.ts";
import type { CoordinatorStateQuery } from "./projection-types.ts";

export const COORDINATOR_STATE_QUERY_CONTRACT =
  "crdd-coordinator/orchestrator-state-query/v1" as const;

const queryKeys = new Set([
  "requestId",
  "projectId",
  "repositoryRevision",
] as const);

/**
 * Idが有効か判定する。
 *
 * @responsibility Idの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidIdの入力契約を満たす。
 * @postcondition validIdの責務を完了した結果だけを返す。
 * @effect N/A: validIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdは独自の失敗分岐を所有しない。
 * @invariant validIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdはProcess内の同一Subsystemで完結する。
 * @security N/A: validIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validIdは共有非同期状態を持たない同期処理である。
 */
function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)
  );
}

/**
 * Revisionが有効か判定する。
 *
 * @responsibility Revisionの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidRevisionの入力契約を満たす。
 * @postcondition validRevisionの責務を完了した結果だけを返す。
 * @effect N/A: validRevisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRevisionは独自の失敗分岐を所有しない。
 * @invariant validRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validRevisionはProcess内の同一Subsystemで完結する。
 * @security N/A: validRevisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validRevisionは共有非同期状態を持たない同期処理である。
 */
function validRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
}

/**
 * Coordinator 状態 Queryを観測する。
 *
 * @responsibility Coordinator 状態 Queryの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns CoordinatorStateQuery | nullを返す。
 * @precondition 「value: unknown」がinspectCoordinatorStateQueryの入力契約を満たす。
 * @postcondition inspectCoordinatorStateQueryの責務を完了した結果だけを返す。
 * @effect N/A: inspectCoordinatorStateQueryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectCoordinatorStateQueryは独自の失敗分岐を所有しない。
 * @invariant inspectCoordinatorStateQueryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectCoordinatorStateQueryはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectCoordinatorStateQueryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectCoordinatorStateQueryは共有非同期状態を持たない同期処理である。
 */
export function inspectCoordinatorStateQuery(
  value: unknown,
): CoordinatorStateQuery | null {
  const request = snapshotPlainRecord(value, queryKeys);
  if (
    !request ||
    !validId(request.requestId) ||
    !validId(request.projectId) ||
    !validRevision(request.repositoryRevision)
  )
    return null;
  return Object.freeze({ ...request }) as CoordinatorStateQuery;
}
