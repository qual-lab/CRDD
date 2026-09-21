import { createHash, randomUUID } from "node:crypto";

export const RUNTIME_PROCESS_SAFETY_STATE_CONTRACT =
  "crdd-coordinator/runtime-process-safety-state";

const runtimeProcessInstanceIdentity = randomUUID();

/**
 * getRuntimeProcessInstanceIdentityの処理を実行する。
 *
 * @responsibility getRuntimeProcessInstanceIdentityに対応する入力処理と結果生成を所有する。
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
 * recoveryDigestの処理を実行する。
 *
 * @responsibility recoveryDigestに対応する入力処理と結果生成を所有する。
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
 * createRuntimeProcessRecoveryIdentityの処理を実行する。
 *
 * @responsibility createRuntimeProcessRecoveryIdentityに対応する入力処理と結果生成を所有する。
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
 * inspectRuntimeProcessRecoveryIdentityの処理を実行する。
 *
 * @responsibility inspectRuntimeProcessRecoveryIdentityに対応する入力処理と結果生成を所有する。
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
 * createIsolatedRuntimeProcessSafetyStateCandidateの処理を実行する。
 *
 * @responsibility createIsolatedRuntimeProcessSafetyStateCandidateに対応する入力処理と結果生成を所有する。
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
  const drains = new WeakSet<object>();
  let drainCount = 0;
  const poisonCleanupUnknown = () => {
    isPoisoned = true;
  };
  const beginDrain = () => {
    const token = Object.freeze({});
    drains.add(token);
    drainCount += 1;
    return token;
  };
  const endDrain = (token: unknown) => {
    if (!token || typeof token !== "object" || !drains.delete(token))
      return false;
    drainCount -= 1;
    return true;
  };
  return Object.freeze({
    poisonCleanupUnknown,
    poisonInteractiveCleanup: poisonCleanupUnknown,
    beginDrain,
    endDrain,
    isPoisoned: () => isPoisoned,
    isEffectBlocked: () => isPoisoned || drainCount > 0,
    isDraining: () => drainCount > 0,
  });
}

const productionState = createIsolatedRuntimeProcessSafetyStateCandidate();

/**
 * poisonRuntimeProcessAfterCleanupUnknownの処理を実行する。
 *
 * @responsibility poisonRuntimeProcessAfterCleanupUnknownに対応する入力処理と結果生成を所有する。
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
 * poisonRuntimeProcessAfterInteractiveCleanupUnknownの処理を実行する。
 *
 * @responsibility poisonRuntimeProcessAfterInteractiveCleanupUnknownに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: poisonRuntimeProcessAfterInteractiveCleanupUnknownは戻り値を返さない。
 * @precondition 「N/A: 実行時引数を受け取らない。」がpoisonRuntimeProcessAfterInteractiveCleanupUnknownの入力契約を満たす。
 * @postcondition poisonRuntimeProcessAfterInteractiveCleanupUnknownの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: poisonRuntimeProcessAfterInteractiveCleanupUnknownは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: poisonRuntimeProcessAfterInteractiveCleanupUnknownは独自の失敗分岐を所有しない。
 * @invariant poisonRuntimeProcessAfterInteractiveCleanupUnknownは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: poisonRuntimeProcessAfterInteractiveCleanupUnknownはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: poisonRuntimeProcessAfterInteractiveCleanupUnknownは共有非同期状態を持たない同期処理である。
 */
export function poisonRuntimeProcessAfterInteractiveCleanupUnknown() {
  poisonRuntimeProcessAfterCleanupUnknown();
}

/**
 * isRuntimeProcessPoisonedの処理を実行する。
 *
 * @responsibility isRuntimeProcessPoisonedに対応する入力処理と結果生成を所有する。
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
 * beginRuntimeProcessEffectDrainの処理を実行する。
 *
 * @responsibility beginRuntimeProcessEffectDrainに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns beginRuntimeProcessEffectDrainの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がbeginRuntimeProcessEffectDrainの入力契約を満たす。
 * @postcondition beginRuntimeProcessEffectDrainの責務を完了した結果だけを返す。
 * @effect N/A: beginRuntimeProcessEffectDrainは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: beginRuntimeProcessEffectDrainは独自の失敗分岐を所有しない。
 * @invariant beginRuntimeProcessEffectDrainは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: beginRuntimeProcessEffectDrainはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: beginRuntimeProcessEffectDrainは共有非同期状態を持たない同期処理である。
 */
export function beginRuntimeProcessEffectDrain() {
  return productionState.beginDrain();
}

/**
 * endRuntimeProcessEffectDrainの処理を実行する。
 *
 * @responsibility endRuntimeProcessEffectDrainに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns endRuntimeProcessEffectDrainの計算結果を返す。
 * @precondition 「token: unknown」がendRuntimeProcessEffectDrainの入力契約を満たす。
 * @postcondition endRuntimeProcessEffectDrainの責務を完了した結果だけを返す。
 * @effect N/A: endRuntimeProcessEffectDrainは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: endRuntimeProcessEffectDrainは独自の失敗分岐を所有しない。
 * @invariant endRuntimeProcessEffectDrainは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security endRuntimeProcessEffectDrainはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: endRuntimeProcessEffectDrainは共有非同期状態を持たない同期処理である。
 */
export function endRuntimeProcessEffectDrain(token: unknown) {
  return productionState.endDrain(token);
}

/**
 * isRuntimeProcessEffectBlockedの処理を実行する。
 *
 * @responsibility isRuntimeProcessEffectBlockedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns isRuntimeProcessEffectBlockedの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がisRuntimeProcessEffectBlockedの入力契約を満たす。
 * @postcondition isRuntimeProcessEffectBlockedの責務を完了した結果だけを返す。
 * @effect N/A: isRuntimeProcessEffectBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isRuntimeProcessEffectBlockedは独自の失敗分岐を所有しない。
 * @invariant isRuntimeProcessEffectBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: isRuntimeProcessEffectBlockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isRuntimeProcessEffectBlockedは共有非同期状態を持たない同期処理である。
 */
export function isRuntimeProcessEffectBlocked() {
  return productionState.isEffectBlocked();
}

/**
 * isRuntimeProcessEffectDrainingの処理を実行する。
 *
 * @responsibility isRuntimeProcessEffectDrainingに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns isRuntimeProcessEffectDrainingの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がisRuntimeProcessEffectDrainingの入力契約を満たす。
 * @postcondition isRuntimeProcessEffectDrainingの責務を完了した結果だけを返す。
 * @effect N/A: isRuntimeProcessEffectDrainingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isRuntimeProcessEffectDrainingは独自の失敗分岐を所有しない。
 * @invariant isRuntimeProcessEffectDrainingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: isRuntimeProcessEffectDrainingはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isRuntimeProcessEffectDrainingは共有非同期状態を持たない同期処理である。
 */
export function isRuntimeProcessEffectDraining() {
  return productionState.isDraining();
}

/**
 * describeRuntimeProcessSafetyStateContractの処理を実行する。
 *
 * @responsibility describeRuntimeProcessSafetyStateContractに対応する入力処理と結果生成を所有する。
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
    guardedEntrypoints: Object.freeze([
      "verified_package_issue_before_manifest_or_filesystem_observation",
      "coordinator_task_before_capability_consume_and_all_effects",
      "external_send_grant_before_authority_verification_or_console_effect",
    ]),
    transientDrainTransition:
      "synchronous_on_host_supervisor_failure_detection_until_all_cleanup_outcomes_are_confirmed_or_unknown_is_promoted_to_irreversible_poison",
    sameProcessResetAllowed: false,
    alreadyActiveOperationRetroactiveCancellationGuaranteed: false,
    recoveryBoundary: "fresh_process_only",
  });
}
