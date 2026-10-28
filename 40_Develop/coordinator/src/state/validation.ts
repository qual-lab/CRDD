/**
 * 共有状態の値・相関・Repository結合を純粋に検査する。
 * @responsibility 共有状態の値・相関・Repository結合を純粋に検査する。
 * @trace ARCH-000004
 * @boundary Coordinatorの状態値と意味Owner。
 * @security 保存・外部実行・Authorityの発行は行わない。
 */
import { COORDINATOR_STATE_CONTRACT } from "../../../domain-model/src/index.ts";
import { normalizeRepositoryRelativePath } from "../../../domain-model/src/index.ts";

import { createHash } from "node:crypto";

export const COORDINATOR_MAXIMUM_CONCURRENCY = 5;

/**
 * Identityが有効か判定する。
 *
 * @responsibility Identityの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns 共有Identityの形式が成立した場合だけ文字列へ型を絞る。
 * @precondition 「value: unknown」がvalidIdentityの入力契約を満たす。
 * @postcondition validIdentityの責務を完了した結果だけを返す。
 * @effect N/A: validIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdentityは独自の失敗分岐を所有しない。
 * @invariant validIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: validIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validIdentityは共有非同期状態を持たない同期処理である。
 */
export function validIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * Revisionが有効か判定する。
 *
 * @responsibility Revisionの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns validRevisionの計算結果を返す。
 * @precondition 「value: unknown」がvalidRevisionの入力契約を満たす。
 * @postcondition validRevisionの責務を完了した結果だけを返す。
 * @effect N/A: validRevisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRevisionは独自の失敗分岐を所有しない。
 * @invariant validRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validRevisionはProcess内の同一Subsystemで完結する。
 * @security N/A: validRevisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validRevisionは共有非同期状態を持たない同期処理である。
 */
export function validRevision(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
}

/**
 * Coordinator 回復 Identityかを判定する。
 *
 * @responsibility Coordinator 回復 Identityの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisCoordinatorRecoveryIdentityの入力契約を満たす。
 * @postcondition isCoordinatorRecoveryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: isCoordinatorRecoveryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isCoordinatorRecoveryIdentityは独自の失敗分岐を所有しない。
 * @invariant isCoordinatorRecoveryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isCoordinatorRecoveryIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: isCoordinatorRecoveryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isCoordinatorRecoveryIdentityは共有非同期状態を持たない同期処理である。
 */
export function isCoordinatorRecoveryIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * Stringsを重複のない順序へ正規化する。
 *
 * @responsibility Stringsの重複判定、順序規則、結果集合境界を所有する。
 * @trace ARCH-000004
 * @input values: readonly string[]、maximum: number、kind: "identity_or_path" | "repository_path" | "human_text"
 * @returns readonly string[] | nullを返す。
 * @precondition 「values: readonly string[]、maximum: number、kind: "identity_or_path" | "repository_path" | "human_text"」がuniqueStringsの入力契約を満たす。
 * @postcondition uniqueStringsの責務を完了した結果だけを返す。
 * @effect N/A: uniqueStringsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: uniqueStringsは独自の失敗分岐を所有しない。
 * @invariant uniqueStringsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: uniqueStringsはProcess内の同一Subsystemで完結する。
 * @security N/A: uniqueStringsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: uniqueStringsは共有非同期状態を持たない同期処理である。
 */
export function uniqueStrings(
  values: readonly string[],
  maximum: number,
  kind: "identity_or_path" | "repository_path" | "human_text",
): readonly string[] | null {
  if (values.length > maximum) return null;
  const resultItems: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0 || value.length > 512)
      return null;
    const normalized =
      kind === "repository_path"
        ? normalizeRepositoryRelativePath(value)
        : kind === "identity_or_path"
          ? value.replaceAll("\\", "/")
          : value;
    if (normalized === null) return null;
    const key = kind === "human_text" ? normalized : normalized.toUpperCase();
    if (seen.has(key)) return null;
    seen.add(key);
    resultItems.push(normalized);
  }
  return Object.freeze(resultItems);
}

/**
 * Coordinator 状態 契約の公開契約を記述する。
 *
 * @responsibility Coordinator 状態 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCoordinatorStateContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCoordinatorStateContractの入力契約を満たす。
 * @postcondition describeCoordinatorStateContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCoordinatorStateContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCoordinatorStateContractは独自の失敗分岐を所有しない。
 * @invariant describeCoordinatorStateContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeCoordinatorStateContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeCoordinatorStateContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeCoordinatorStateContractは共有非同期状態を持たない同期処理である。
 */
export function describeCoordinatorStateContract() {
  return Object.freeze({
    contract: COORDINATOR_STATE_CONTRACT,
    maximumConcurrency: COORDINATOR_MAXIMUM_CONCURRENCY,
    capacityStates: Object.freeze([
      "starting",
      "running",
      "cleanup_pending",
      "recovery_required_without_cleanup",
    ]),
    lockContract:
      "project_operation_then_short_project_state_transaction_never_held_across_single_task_runtime",
    staleResult:
      "generation_attempt_and_operation_identity_mismatch_blocks_without_projection",
    acceptanceContract:
      "task_completion_then_objective_integration_then_milestone_integration",
  });
}

/**
 * 検証済みRepository Rootの保存Bindingを得る。
 * @responsibility 従来のstable(binding, root)と同じbyte列・長さを保つ。
 * @trace ARCH-000004
 * @input 検証済みのexact Root文字列。
 * @returns 既存形式のbinding ID。
 * @precondition 呼出側が今回要求の入力範囲を確定している。
 * @postcondition 確認できた値だけを返し、観測不能を成功へ変換しない。
 * @effect N/A: 純粋計算だけ。
 * @failure N/A: 固定文字列をHash化する。
 * @invariant 現在状態と履歴の観測を独立保持する。
 * @boundary Coordinator活動Ownerと内部Consumer。
 * @security 資格、内部Pathと保存Bindingを公開しない。
 * @concurrency 一回の要求を同期観測し、共有Cacheを持たない。
 */
export function deriveCoordinatorRepositoryBindingId(root: string): string {
  return `binding-${createHash("sha256").update(root).digest("hex").slice(0, 40)}`;
}
