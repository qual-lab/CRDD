/**
 * docker-recovery-public-projectionに属する責務をまとめる。
 *
 * @responsibility publicDockerRecoveryStartReasonを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import {
  isSha256Hex,
  parseDockerTaskRecoveryId,
} from "./docker-recovery-identity.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";

const recoveryObservationKeys = new Set([
  "status",
  "reason",
  "manualRecoveryRequired",
  "dockerRecoveryId",
  "dockerRecoveryIds",
  "activeStableLogicalHomeBindingHashes",
] as const);

const recoveryStartReasonClass = new Map<string, string>([
  [
    "docker_task_multiple_recovery_inventory_available",
    "docker_process_controller_recovery_conflict",
  ],
  [
    "docker_task_recovery_inventory_available",
    "docker_process_controller_recovery_conflict",
  ],
  [
    "docker_task_recovery_cleanup_tombstone_conflict",
    "docker_process_controller_recovery_conflict",
  ],
  ...(
    [
      "docker_task_runtime_state_pending_incomplete",
      "docker_task_runtime_state_orphan_commit",
      "docker_task_runtime_state_orphan_pointer",
      "docker_task_runtime_state_orphan_temporary",
      "docker_task_recovery_orphan_commit",
      "docker_task_recovery_orphan_temporary",
      "docker_task_recovery_duplicate_base",
      "docker_task_recovery_duplicate_base_commit",
      "docker_task_recovery_base_commit_missing",
    ] as const
  ).map(
    (reason) =>
      [reason, "docker_process_controller_recovery_partial_state"] as const,
  ),
  ...(
    [
      "docker_task_runtime_state_binding_changed",
      "docker_task_runtime_state_user_binding_changed",
      "docker_task_runtime_state_root_replaced",
      "docker_task_runtime_state_entry_replaced",
      "docker_task_runtime_state_cleanup_replaced",
      "docker_task_recovery_active_run_mismatch",
      "docker_task_recovery_base_commit_mismatch",
      "docker_task_recovery_base_mismatch",
      "docker_task_recovery_host_binding_changed",
      "docker_task_recovery_host_mismatch",
      "docker_task_recovery_pointer_mismatch",
    ] as const
  ).map(
    (reason) =>
      [reason, "docker_process_controller_recovery_identity_mismatch"] as const,
  ),
  ...(
    [
      "docker_task_host_operation_generation_active_or_unknown",
      "docker_task_process_generation_active_or_unknown",
      "docker_task_recovery_home_generation_active_or_unknown",
      "docker_task_recovery_home_lock_release_unconfirmed",
      "docker_task_recovery_host_lock_release_unconfirmed",
      "docker_task_runtime_state_generation_active_or_unknown",
      "docker_task_runtime_state_lock_release_unconfirmed",
      "docker_task_runtime_state_audit_failed",
      "docker_task_recovery_record_observation_unknown",
      "docker_task_runtime_state_unavailable",
      "docker_task_recovery_begin_failed_closed",
      "docker_task_recovery_failed_closed",
    ] as const
  ).map(
    (reason) =>
      [
        reason,
        "docker_process_controller_recovery_observation_unknown",
      ] as const,
  ),
]);
const INVENTORY_REASONS = new Set([
  "docker_task_recovery_inventory_available",
  "docker_task_multiple_recovery_inventory_available",
]);
const BLOCKED_REASONS_WITH_INVENTORY = new Set([
  "docker_task_recovery_home_lock_release_unconfirmed",
  "docker_task_recovery_host_lock_release_unconfirmed",
  "docker_task_runtime_state_lock_release_unconfirmed",
]);

/**
 * public Docker 回復 Start Reasonを決定する。
 *
 * @responsibility public Docker 回復 Start Reasonの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input reason: unknown
 * @returns publicDockerRecoveryStartReasonの計算結果を返す。
 * @precondition 「reason: unknown」がpublicDockerRecoveryStartReasonの入力契約を満たす。
 * @postcondition publicDockerRecoveryStartReasonの責務を完了した結果だけを返す。
 * @effect N/A: publicDockerRecoveryStartReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: publicDockerRecoveryStartReasonは独自の失敗分岐を所有しない。
 * @invariant publicDockerRecoveryStartReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: publicDockerRecoveryStartReasonはProcess内の同一Subsystemで完結する。
 * @security publicDockerRecoveryStartReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: publicDockerRecoveryStartReasonは共有非同期状態を持たない同期処理である。
 */
export function publicDockerRecoveryStartReason(reason: unknown) {
  if (typeof reason === "string") {
    const classified = recoveryStartReasonClass.get(reason);
    if (classified) return classified;
  }
  return "docker_process_controller_recovery_unavailable";
}

/**
 * public Verified Docker 回復 Idを決定する。
 *
 * @responsibility public Verified Docker 回復 Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns publicVerifiedDockerRecoveryIdの計算結果を返す。
 * @precondition 「value: unknown」がpublicVerifiedDockerRecoveryIdの入力契約を満たす。
 * @postcondition publicVerifiedDockerRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: publicVerifiedDockerRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: publicVerifiedDockerRecoveryIdは独自の失敗分岐を所有しない。
 * @invariant publicVerifiedDockerRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: publicVerifiedDockerRecoveryIdはProcess内の同一Subsystemで完結する。
 * @security publicVerifiedDockerRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: publicVerifiedDockerRecoveryIdは共有非同期状態を持たない同期処理である。
 */
export function publicVerifiedDockerRecoveryId(value: unknown) {
  return parseDockerTaskRecoveryId(value)?.token ?? null;
}

/**
 * Docker 回復 Admissionを公開結果へ投影する。
 *
 * @responsibility Docker 回復 Admissionの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input rawObservation: unknown
 * @returns projectDockerRecoveryAdmissionの計算結果を返す。
 * @precondition 「rawObservation: unknown」がprojectDockerRecoveryAdmissionの入力契約を満たす。
 * @postcondition projectDockerRecoveryAdmissionの責務を完了した結果だけを返す。
 * @effect N/A: projectDockerRecoveryAdmissionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectDockerRecoveryAdmissionは独自の失敗分岐を所有しない。
 * @invariant projectDockerRecoveryAdmissionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectDockerRecoveryAdmissionはProcess内の同一Subsystemで完結する。
 * @security projectDockerRecoveryAdmissionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectDockerRecoveryAdmissionは共有非同期状態を持たない同期処理である。
 */
export function projectDockerRecoveryAdmission(rawObservation: unknown) {
  const observation = snapshotPlainRecord(
    rawObservation,
    recoveryObservationKeys,
  );
  if (!observation)
    return Object.freeze({
      status: "blocked" as const,
      reason: publicDockerRecoveryStartReason(null),
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([] as string[]),
    });
  const idsSnapshot = snapshotPlainArray(observation.dockerRecoveryIds, 256);
  const parsedIds =
    idsSnapshot.status === "ok"
      ? idsSnapshot.value.map(parseDockerTaskRecoveryId)
      : [];
  const ids =
    idsSnapshot.status === "ok" && parsedIds.every((value) => value !== null)
      ? parsedIds.map((value) => value?.token as string)
      : null;
  const singleId =
    observation.dockerRecoveryId === null ||
    publicVerifiedDockerRecoveryId(observation.dockerRecoveryId) !== null
      ? publicVerifiedDockerRecoveryId(observation.dockerRecoveryId)
      : undefined;
  const hashes = snapshotPlainArray(
    observation.activeStableLogicalHomeBindingHashes,
    256,
  );
  const hashValues =
    hashes.status === "ok" && hashes.value.every(isSha256Hex)
      ? (hashes.value as readonly string[])
      : null;
  const isIdsUnique = ids !== null && new Set(ids).size === ids.length;
  const isHashesUnique =
    hashValues !== null && new Set(hashValues).size === hashValues.length;
  const stableHashes = new Set(
    parsedIds.flatMap((value) =>
      value ? [value.stableLogicalHomeBindingHash] : [],
    ),
  );
  const isShapeValid =
    ids !== null &&
    hashValues !== null &&
    isIdsUnique &&
    isHashesUnique &&
    hashValues.every((value) => stableHashes.has(value)) &&
    (observation.status === "completed" || observation.status === "blocked") &&
    typeof observation.reason === "string" &&
    typeof observation.manualRecoveryRequired === "boolean" &&
    singleId !== undefined &&
    (ids.length === 1 ? singleId === ids[0] : singleId === null);
  if (!isShapeValid)
    return Object.freeze({
      status: "blocked" as const,
      reason: publicDockerRecoveryStartReason(null),
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([] as string[]),
    });
  const isClean =
    observation.status === "completed" &&
    observation.reason === "docker_task_runtime_state_clean" &&
    observation.manualRecoveryRequired === false &&
    singleId === null &&
    ids.length === 0 &&
    hashValues.length === 0;
  if (isClean)
    return Object.freeze({
      status: "completed" as const,
      reason: "docker_task_runtime_state_clean",
      manualRecoveryRequired: false,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([] as string[]),
    });
  const inventoryReason =
    ids.length === 1
      ? "docker_task_recovery_inventory_available"
      : "docker_task_multiple_recovery_inventory_available";
  const isBlockedShape =
    observation.status === "blocked" &&
    observation.manualRecoveryRequired === true &&
    recoveryStartReasonClass.has(observation.reason) &&
    (ids.length === 0
      ? !INVENTORY_REASONS.has(observation.reason)
      : BLOCKED_REASONS_WITH_INVENTORY.has(observation.reason));
  const isInventoryShape =
    observation.status === "completed" &&
    observation.manualRecoveryRequired === true &&
    ids.length > 0 &&
    observation.reason === inventoryReason;
  if (!isBlockedShape && !isInventoryShape)
    return Object.freeze({
      status: "blocked" as const,
      reason: publicDockerRecoveryStartReason(null),
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([] as string[]),
    });
  return Object.freeze({
    status: "blocked" as const,
    reason: publicDockerRecoveryStartReason(observation.reason),
    manualRecoveryRequired: true,
    dockerRecoveryId: ids.length === 1 ? (ids[0] ?? null) : null,
    dockerRecoveryIds: Object.freeze(ids),
  });
}
