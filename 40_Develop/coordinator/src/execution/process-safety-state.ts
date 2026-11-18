/**
 * 回収不明を観測したProcessの新規Effect停止と再起動識別を所有する。
 *
 * @responsibility 不可逆の停止状態とProcessごとの回復Identityを保持し、解除経路や一時drainを作らない。
 * @trace ARCH-000008
 */

import { randomUUID, createHash } from "node:crypto";

export const RUNTIME_PROCESS_SAFETY_STATE_CONTRACT =
  "crdd-coordinator/runtime-process-safety-state";

const runtimeProcessInstanceIdentity = randomUUID();

/**
 * Runtime Process Instance Identityを取得する。
 *
 * @responsibility Runtime Process Instance Identityの参照条件、返却値、未検出結果の境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns getRuntimeProcessInstanceIdentityの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がgetRuntimeProcessInstanceIdentityの入力契約を満たす。
 * @postcondition getRuntimeProcessInstanceIdentityの責務を完了した結果だけを返す。
 * @effect N/A: getRuntimeProcessInstanceIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: getRuntimeProcessInstanceIdentityは独自の失敗分岐を所有しない。
 * @invariant getRuntimeProcessInstanceIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: getRuntimeProcessInstanceIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: getRuntimeProcessInstanceIdentityは共有非同期状態を持たない同期処理である。
 */
export function getRuntimeProcessInstanceIdentity() {
  return runtimeProcessInstanceIdentity;
}

const RUNTIME_PROCESS_RECOVERY_ID =
  /^runtime-process\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.restart-([0-9a-f]{40})$/u;

/**
 * recovery Digestを決定する。
 *
 * @responsibility recovery Digestの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input processIdentity: string、attemptId: string、operationId: string
 * @returns recoveryDigestの計算結果を返す。
 * @precondition 「processIdentity: string、attemptId: string、operationId: string」がrecoveryDigestの入力契約を満たす。
 * @postcondition recoveryDigestの責務を完了した結果だけを返す。
 * @effect N/A: recoveryDigestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryDigestは独自の失敗分岐を所有しない。
 * @invariant recoveryDigestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: recoveryDigestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recoveryDigestは共有非同期状態を持たない同期処理である。
 */
function recoveryDigest(
  processIdentity: string,
  attemptId: string,
  operationId: string,
) {
  return createHash("sha256")
    .update([processIdentity, attemptId, operationId].join("\0"))
    .digest("hex")
    .slice(0, 40);
}

/**
 * Runtime Process 回復 Identityを構築する。
 *
 * @responsibility Runtime Process 回復 Identityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input attemptId: string、operationId: string
 * @returns createRuntimeProcessRecoveryIdentityの計算結果を返す。
 * @precondition 「attemptId: string、operationId: string」がcreateRuntimeProcessRecoveryIdentityの入力契約を満たす。
 * @postcondition createRuntimeProcessRecoveryIdentityの責務を完了した結果だけを返す。
 * @effect createRuntimeProcessRecoveryIdentityは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: createRuntimeProcessRecoveryIdentityは独自の失敗分岐を所有しない。
 * @invariant createRuntimeProcessRecoveryIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: createRuntimeProcessRecoveryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createRuntimeProcessRecoveryIdentityは共有非同期状態を持たない同期処理である。
 */
export function createRuntimeProcessRecoveryIdentity(
  attemptId: string,
  operationId: string,
) {
  return `runtime-process.${runtimeProcessInstanceIdentity}.restart-${recoveryDigest(
    runtimeProcessInstanceIdentity,
    attemptId,
    operationId,
  )}`;
}

/**
 * Runtime Process 回復 Identityを観測する。
 *
 * @responsibility Runtime Process 回復 Identityの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、attemptId: string、operationId: string
 * @returns inspectRuntimeProcessRecoveryIdentityの計算結果を返す。
 * @precondition 「value: unknown、attemptId: string、operationId: string」がinspectRuntimeProcessRecoveryIdentityの入力契約を満たす。
 * @postcondition inspectRuntimeProcessRecoveryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: inspectRuntimeProcessRecoveryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRuntimeProcessRecoveryIdentityは独自の失敗分岐を所有しない。
 * @invariant inspectRuntimeProcessRecoveryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: inspectRuntimeProcessRecoveryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectRuntimeProcessRecoveryIdentityは共有非同期状態を持たない同期処理である。
 */
export function inspectRuntimeProcessRecoveryIdentity(
  value: unknown,
  attemptId: string,
  operationId: string,
) {
  if (typeof value !== "string") return null;
  const match = RUNTIME_PROCESS_RECOVERY_ID.exec(value);
  if (!match?.[1] || !match[2]) return null;
  if (match[2] !== recoveryDigest(match[1], attemptId, operationId))
    return null;
  return Object.freeze({ processIdentity: match[1], recoveryId: value });
}

/**
 * Isolated Runtime Process Safety 状態 候補を構築する。
 *
 * @responsibility Isolated Runtime Process Safety 状態 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns createIsolatedRuntimeProcessSafetyStateCandidateの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateIsolatedRuntimeProcessSafetyStateCandidateの入力契約を満たす。
 * @postcondition createIsolatedRuntimeProcessSafetyStateCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedRuntimeProcessSafetyStateCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedRuntimeProcessSafetyStateCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedRuntimeProcessSafetyStateCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: createIsolatedRuntimeProcessSafetyStateCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createIsolatedRuntimeProcessSafetyStateCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedRuntimeProcessSafetyStateCandidate() {
  let isPoisoned = false;
  const poisonCleanupUnknown = () => {
    isPoisoned = true;
  };
  return Object.freeze({
    poisonCleanupUnknown,
    isPoisoned: () => isPoisoned,
  });
}

const productionState = createIsolatedRuntimeProcessSafetyStateCandidate();

/**
 * poison Runtime Process After 清掃 Unknownを決定する。
 *
 * @responsibility poison Runtime Process After 清掃 Unknownの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: poisonRuntimeProcessAfterCleanupUnknownは戻り値を返さない。
 * @precondition 「N/A: 実行時引数を受け取らない。」がpoisonRuntimeProcessAfterCleanupUnknownの入力契約を満たす。
 * @postcondition poisonRuntimeProcessAfterCleanupUnknownの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: poisonRuntimeProcessAfterCleanupUnknownは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: poisonRuntimeProcessAfterCleanupUnknownは独自の失敗分岐を所有しない。
 * @invariant poisonRuntimeProcessAfterCleanupUnknownは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: poisonRuntimeProcessAfterCleanupUnknownはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: poisonRuntimeProcessAfterCleanupUnknownは共有非同期状態を持たない同期処理である。
 */
export function poisonRuntimeProcessAfterCleanupUnknown() {
  productionState.poisonCleanupUnknown();
}

/**
 * Runtime Process Poisonedかを判定する。
 *
 * @responsibility Runtime Process Poisonedの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns isRuntimeProcessPoisonedの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がisRuntimeProcessPoisonedの入力契約を満たす。
 * @postcondition isRuntimeProcessPoisonedの責務を完了した結果だけを返す。
 * @effect N/A: isRuntimeProcessPoisonedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isRuntimeProcessPoisonedは独自の失敗分岐を所有しない。
 * @invariant isRuntimeProcessPoisonedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: isRuntimeProcessPoisonedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isRuntimeProcessPoisonedは共有非同期状態を持たない同期処理である。
 */
export function isRuntimeProcessPoisoned() {
  return productionState.isPoisoned();
}

/**
 * Runtime Process Safety 状態 契約の公開契約を記述する。
 *
 * @responsibility Runtime Process Safety 状態 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeRuntimeProcessSafetyStateContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeRuntimeProcessSafetyStateContractの入力契約を満たす。
 * @postcondition describeRuntimeProcessSafetyStateContractの責務を完了した結果だけを返す。
 * @effect N/A: describeRuntimeProcessSafetyStateContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeRuntimeProcessSafetyStateContractは独自の失敗分岐を所有しない。
 * @invariant describeRuntimeProcessSafetyStateContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: describeRuntimeProcessSafetyStateContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeRuntimeProcessSafetyStateContractは共有非同期状態を持たない同期処理である。
 */
export function describeRuntimeProcessSafetyStateContract() {
  return Object.freeze({
    contract: RUNTIME_PROCESS_SAFETY_STATE_CONTRACT,
    stateScope: "single_runtime_process_nonserialized",
    poisonTransition:
      "synchronous_irreversible_on_cleanup_unknown_observation_before_return_or_next_non_cleanup_await",
    poisonOrigins: Object.freeze([
      "interactive_console_cleanup_unknown",
      "host_operation_supervisor_cleanup_unknown",
      "signed_general_task_started_result_or_completion_unknown",
      "signed_route_matrix_started_or_outer_execution_unknown",
    ]),
    guardedEntrypoints: Object.freeze(["coordinator_task_before_all_effects"]),
    sameProcessResetAllowed: false,
    alreadyActiveOperationRetroactiveCancellationGuaranteed: false,
    recoveryBoundary: "fresh_process_only",
  });
}
