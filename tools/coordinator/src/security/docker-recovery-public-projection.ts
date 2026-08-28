import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import {
  isSha256Hex,
  parseDockerTaskRecoveryId,
} from "./docker-recovery-identity.ts";

const RECOVERY_OBSERVATION_KEYS = new Set([
  "status",
  "reason",
  "manualRecoveryRequired",
  "dockerRecoveryId",
  "dockerRecoveryIds",
  "activeStableLogicalHomeBindingHashes",
] as const);

const RECOVERY_START_REASON_CLASS = new Map<string, string>([
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

export function publicDockerRecoveryStartReason(reason: unknown) {
  if (typeof reason === "string") {
    const classified = RECOVERY_START_REASON_CLASS.get(reason);
    if (classified) return classified;
  }
  return "docker_process_controller_recovery_unavailable";
}

export function publicVerifiedDockerRecoveryId(value: unknown) {
  return parseDockerTaskRecoveryId(value)?.token ?? null;
}

export function projectDockerRecoveryAdmission(rawObservation: unknown) {
  const observation = snapshotPlainRecord(
    rawObservation,
    RECOVERY_OBSERVATION_KEYS,
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
  const idsUnique = ids !== null && new Set(ids).size === ids.length;
  const hashesUnique =
    hashValues !== null && new Set(hashValues).size === hashValues.length;
  const stableHashes = new Set(
    parsedIds.flatMap((value) =>
      value ? [value.stableLogicalHomeBindingHash] : [],
    ),
  );
  const shapeValid =
    ids !== null &&
    hashValues !== null &&
    idsUnique &&
    hashesUnique &&
    hashValues.every((value) => stableHashes.has(value)) &&
    (observation.status === "completed" || observation.status === "blocked") &&
    typeof observation.reason === "string" &&
    typeof observation.manualRecoveryRequired === "boolean" &&
    singleId !== undefined &&
    (ids.length === 1 ? singleId === ids[0] : singleId === null);
  if (!shapeValid)
    return Object.freeze({
      status: "blocked" as const,
      reason: publicDockerRecoveryStartReason(null),
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([] as string[]),
    });
  const clean =
    observation.status === "completed" &&
    observation.reason === "docker_task_runtime_state_clean" &&
    observation.manualRecoveryRequired === false &&
    singleId === null &&
    ids.length === 0 &&
    hashValues.length === 0;
  if (clean)
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
  const blockedShape =
    observation.status === "blocked" &&
    observation.manualRecoveryRequired === true &&
    RECOVERY_START_REASON_CLASS.has(observation.reason) &&
    (ids.length === 0
      ? !INVENTORY_REASONS.has(observation.reason)
      : BLOCKED_REASONS_WITH_INVENTORY.has(observation.reason));
  const inventoryShape =
    observation.status === "completed" &&
    observation.manualRecoveryRequired === true &&
    ids.length > 0 &&
    observation.reason === inventoryReason;
  if (!blockedShape && !inventoryShape)
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
