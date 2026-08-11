import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";

const OBSERVATION_KEYS = new Set(["ownerUid", "effectiveUid", "mode"]);

export function evaluatePosixRuntimeRootModeObservationForInternalUse(rawObservation) {
  const observation = snapshotPlainRecord(rawObservation, OBSERVATION_KEYS);
  if (!observation || [observation.ownerUid, observation.effectiveUid, observation.mode]
    .some((value) => typeof value !== "bigint" || value < 0n)) {
    return Object.freeze({ passed: false, reason: "posix_mode_observation_invalid" });
  }
  if (observation.ownerUid !== observation.effectiveUid) {
    return Object.freeze({ passed: false, reason: "posix_runtime_root_current_owner_mismatch" });
  }
  const permissionBits = observation.mode & 0o777n;
  if ((permissionBits & 0o700n) !== 0o700n) {
    return Object.freeze({ passed: false, reason: "posix_runtime_root_owner_rwx_required" });
  }
  if ((permissionBits & 0o022n) !== 0n) {
    return Object.freeze({ passed: false, reason: "posix_runtime_root_additional_write_bits_rejected" });
  }
  return Object.freeze({ passed: true, reason: null });
}
