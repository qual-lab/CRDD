import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../internal/plain-data-snapshot.ts";
import { isProjectRuntimeRecoveryIdentity } from "../core/project-runtime-state.ts";

export const PROJECT_RUNTIME_INTEGRATION_CONTRACT =
  "crdd-coordinator/project-runtime-integration/v1" as const;

export const PROJECT_RUNTIME_INTEGRATION_RESULT_FIELDS = Object.freeze([
  "contract",
  "status",
  "reason",
  "projectId",
  "milestoneId",
  "queueId",
  "stateGeneration",
  "candidateId",
  "receiptId",
  "cleanupConfirmed",
  "manualRecoveryRequired",
  "recoveryIds",
] as const);

function validId(value: unknown, maximum = 512): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/** Canonical closed result contract shared by the producer and transports. */
export function inspectProjectRuntimeIntegrationResult(raw: unknown) {
  const record = snapshotPlainRecord(
    raw,
    new Set(PROJECT_RUNTIME_INTEGRATION_RESULT_FIELDS),
  );
  if (!record) return null;
  const recoveryIdsSnapshot = snapshotPlainArray(record.recoveryIds, 128);
  if (recoveryIdsSnapshot.status !== "ok") return null;
  const recoveryIds = recoveryIdsSnapshot.value;
  if (
    recoveryIds.some((value) => !isProjectRuntimeRecoveryIdentity(value)) ||
    new Set(recoveryIds).size !== recoveryIds.length ||
    record.contract !== PROJECT_RUNTIME_INTEGRATION_CONTRACT ||
    !["completed", "blocked"].includes(String(record.status)) ||
    !validId(record.reason, 256) ||
    !validId(record.projectId) ||
    !validId(record.milestoneId) ||
    !validId(record.queueId) ||
    (record.stateGeneration !== null &&
      (!Number.isSafeInteger(record.stateGeneration) ||
        Number(record.stateGeneration) < 1)) ||
    (record.candidateId !== null && !validId(record.candidateId)) ||
    (record.receiptId !== null && !validId(record.receiptId)) ||
    typeof record.cleanupConfirmed !== "boolean" ||
    typeof record.manualRecoveryRequired !== "boolean" ||
    (record.status === "completed" &&
      (record.cleanupConfirmed !== true ||
        record.manualRecoveryRequired !== false ||
        recoveryIds.length !== 0)) ||
    (record.status === "blocked" &&
      record.cleanupConfirmed === record.manualRecoveryRequired) ||
    (recoveryIds.length > 0 &&
      (record.status !== "blocked" ||
        record.cleanupConfirmed !== false ||
        record.manualRecoveryRequired !== true))
  )
    return null;
  return Object.freeze({
    ...record,
    recoveryIds: Object.freeze([...(recoveryIds as readonly string[])]),
  });
}
