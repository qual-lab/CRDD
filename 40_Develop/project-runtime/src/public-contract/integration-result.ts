import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../boundary/plain-data-snapshot.ts";
import { isProjectRuntimeRecoveryIdentity } from "../core/project-runtime-state.ts";

export const PROJECT_RUNTIME_INTEGRATION_CONTRACT =
  "crdd-coordinator/project-runtime-integration/v1" as const;

export const PROJECT_RUNTIME_INTEGRATION_BASE_RESULT_FIELDS = Object.freeze([
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
export const projectRuntimeIntegrationResultFields = Object.freeze([
  ...PROJECT_RUNTIME_INTEGRATION_BASE_RESULT_FIELDS,
  "effectIssued",
  "effectStateUnknown",
  "retryAllowed",
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
export function inspectProjectRuntimeIntegrationResult(raw: unknown): Readonly<
  Record<string, unknown> & {
    status: "completed" | "blocked";
    recoveryIds: readonly string[];
    effectIssued?: boolean;
    effectStateUnknown?: boolean;
    retryAllowed?: boolean;
  }
> | null {
  const record: Readonly<Record<string, unknown>> | null =
    snapshotPlainRecord(
      raw,
      new Set(PROJECT_RUNTIME_INTEGRATION_BASE_RESULT_FIELDS),
    ) ??
    snapshotPlainRecord(raw, new Set(projectRuntimeIntegrationResultFields));
  if (!record) return null;
  const recoveryIdsSnapshot = snapshotPlainArray(record.recoveryIds, 128);
  if (recoveryIdsSnapshot.status !== "ok") return null;
  const recoveryIds = recoveryIdsSnapshot.value;
  const hasBoundaryEffect = record.effectIssued !== undefined;
  const boundaryManualRecoveryRequired =
    record.effectStateUnknown === true ||
    record.cleanupConfirmed === false ||
    recoveryIds.length > 0;
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
    (hasBoundaryEffect &&
      (record.status !== "blocked" ||
        typeof record.effectIssued !== "boolean" ||
        typeof record.effectStateUnknown !== "boolean" ||
        typeof record.retryAllowed !== "boolean" ||
        (record.effectStateUnknown === true && record.effectIssued !== true) ||
        (record.effectStateUnknown === true && record.retryAllowed !== false) ||
        record.manualRecoveryRequired !== boundaryManualRecoveryRequired)) ||
    (!hasBoundaryEffect &&
      (record.effectStateUnknown !== undefined ||
        record.retryAllowed !== undefined)) ||
    (record.status === "completed" &&
      (record.cleanupConfirmed !== true ||
        record.manualRecoveryRequired !== false ||
        recoveryIds.length !== 0)) ||
    (!hasBoundaryEffect &&
      record.status === "blocked" &&
      record.cleanupConfirmed === record.manualRecoveryRequired) ||
    (recoveryIds.length > 0 &&
      (record.status !== "blocked" ||
        record.manualRecoveryRequired !== true ||
        (hasBoundaryEffect &&
          record.effectStateUnknown !== true &&
          record.cleanupConfirmed !== false)))
  )
    return null;
  return Object.freeze({
    ...record,
    status: record.status as "completed" | "blocked",
    recoveryIds: Object.freeze([...(recoveryIds as readonly string[])]),
  });
}
