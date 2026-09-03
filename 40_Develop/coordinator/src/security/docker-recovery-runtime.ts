/**
 * Closed production facade for durable Docker recovery.
 *
 * Runtime-owned native observations are selected inside the implementation.
 * Caller-supplied Root, observer, runner and fault/crash hooks are deliberately
 * absent from this module interface.
 */
import { readProjectRuntimeState } from "./project-runtime-durable-foundation.ts";
import type { ProjectDockerRecoveryAcknowledgement } from "./project-runtime-state.ts";
import {
  acknowledgeRuntimeOwnedDockerRecoveryCompletion,
  finalizeRuntimeOwnedDockerRecoveryAcknowledgement,
} from "./docker-recovery-runtime-internal.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

export type ProjectSettledDockerRecovery = Readonly<{
  workingDirectory: string;
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string;
  stateGeneration: number;
  taskId: string;
  attemptId: string;
  operationId: string;
  kind: "docker";
  recoveryId: string;
}>;

/**
 * Consume a Docker completion receipt only when the exact durable Project
 * State already records the same Task obligation as settled. This is the only
 * production acknowledgement boundary; a Recovery ID alone conveys no
 * deletion authority.
 */
export function consumeDockerRecoveryReceiptAfterProjectSettlement(
  rawSettlement: ProjectSettledDockerRecovery,
) {
  const settlement = snapshotPlainRecord(
    rawSettlement,
    new Set([
      "workingDirectory",
      "repositoryBindingId",
      "projectId",
      "milestoneId",
      "stateGeneration",
      "taskId",
      "attemptId",
      "operationId",
      "kind",
      "recoveryId",
    ]),
  );
  if (
    settlement?.kind !== "docker" ||
    !Number.isSafeInteger(settlement.stateGeneration) ||
    Number(settlement.stateGeneration) < 1 ||
    [
      settlement.workingDirectory,
      settlement.repositoryBindingId,
      settlement.projectId,
      settlement.milestoneId,
      settlement.taskId,
      settlement.attemptId,
      settlement.operationId,
      settlement.recoveryId,
    ].some((value) => typeof value !== "string" || value.length === 0)
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_settlement_authority_invalid",
    });
  const observed = readProjectRuntimeState(
    String(settlement.workingDirectory),
    String(settlement.repositoryBindingId),
    String(settlement.projectId),
  );
  const state = observed.status === "completed" ? observed.value : null;
  const task = state?.tasks.find(
    (entry) => entry.definition.id === settlement.taskId,
  );
  if (
    !state ||
    state.generation !== Number(settlement.stateGeneration) ||
    state.milestoneId !== settlement.milestoneId ||
    task?.attemptId !== settlement.attemptId ||
    task?.operationId !== settlement.operationId ||
    !task?.recoveryObligations.some(
      (entry) =>
        entry.kind === "docker" &&
        entry.recoveryId === settlement.recoveryId &&
        entry.phase === "settled",
    )
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_settlement_not_verified",
    });
  return acknowledgeRuntimeOwnedDockerRecoveryCompletion(
    String(settlement.recoveryId),
  );
}

export function collectDockerRecoveryAcknowledgementAfterProjectRecord(
  rawSettlement: ProjectSettledDockerRecovery &
    Readonly<{ acknowledgement: unknown }>,
) {
  const settlement = snapshotPlainRecord(
    rawSettlement,
    new Set([
      "workingDirectory",
      "repositoryBindingId",
      "projectId",
      "milestoneId",
      "stateGeneration",
      "taskId",
      "attemptId",
      "operationId",
      "kind",
      "recoveryId",
      "acknowledgement",
    ]),
  );
  const acknowledgement = snapshotPlainRecord(
    settlement?.acknowledgement,
    new Set([
      "repositoryBindingId",
      "projectId",
      "milestoneId",
      "taskId",
      "attemptId",
      "operationId",
      "recoveryId",
      "settlementGeneration",
      "runtimeStateBinding",
      "receiptContentHash",
      "receiptContentIdentity",
    ]),
  );
  const runtimeStateBinding = snapshotPlainRecord(
    acknowledgement?.runtimeStateBinding,
    new Set([
      "runtimeStateIdentityHash",
      "runtimeStateProtectionHash",
      "localUserBindingHash",
      "runtimeStateBindingHash",
    ]),
  );
  const stringValues = acknowledgement
    ? [
        acknowledgement.repositoryBindingId,
        acknowledgement.projectId,
        acknowledgement.milestoneId,
        acknowledgement.taskId,
        acknowledgement.attemptId,
        acknowledgement.operationId,
        acknowledgement.recoveryId,
        acknowledgement.receiptContentHash,
        acknowledgement.receiptContentIdentity,
      ]
    : [];
  const hashValues = runtimeStateBinding
    ? [
        runtimeStateBinding.runtimeStateIdentityHash,
        runtimeStateBinding.runtimeStateProtectionHash,
        runtimeStateBinding.localUserBindingHash,
        runtimeStateBinding.runtimeStateBindingHash,
        acknowledgement?.receiptContentHash,
        acknowledgement?.receiptContentIdentity,
      ]
    : [];
  if (
    settlement?.kind !== "docker" ||
    !acknowledgement ||
    !runtimeStateBinding ||
    !Number.isSafeInteger(acknowledgement.settlementGeneration) ||
    Number(acknowledgement.settlementGeneration) < 1 ||
    stringValues.some(
      (value) => typeof value !== "string" || value.length === 0,
    ) ||
    hashValues.some(
      (value) => typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value),
    )
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_acknowledgement_gc_authority_invalid",
    });
  const safeAcknowledgement = Object.freeze({
    repositoryBindingId: String(acknowledgement.repositoryBindingId),
    projectId: String(acknowledgement.projectId),
    milestoneId: String(acknowledgement.milestoneId),
    taskId: String(acknowledgement.taskId),
    attemptId: String(acknowledgement.attemptId),
    operationId: String(acknowledgement.operationId),
    recoveryId: String(acknowledgement.recoveryId),
    settlementGeneration: Number(acknowledgement.settlementGeneration),
    runtimeStateBinding: Object.freeze({
      runtimeStateIdentityHash: String(
        runtimeStateBinding.runtimeStateIdentityHash,
      ),
      runtimeStateProtectionHash: String(
        runtimeStateBinding.runtimeStateProtectionHash,
      ),
      localUserBindingHash: String(runtimeStateBinding.localUserBindingHash),
      runtimeStateBindingHash: String(
        runtimeStateBinding.runtimeStateBindingHash,
      ),
    }),
    receiptContentHash: String(acknowledgement.receiptContentHash),
    receiptContentIdentity: String(acknowledgement.receiptContentIdentity),
  }) satisfies ProjectDockerRecoveryAcknowledgement;
  const observed = readProjectRuntimeState(
    String(settlement.workingDirectory),
    String(settlement.repositoryBindingId),
    String(settlement.projectId),
  );
  const state = observed.status === "completed" ? observed.value : null;
  const task = state?.tasks.find(
    (entry) => entry.definition.id === settlement.taskId,
  );
  const obligation = task?.recoveryObligations.find(
    (entry) =>
      entry.kind === "docker" && entry.recoveryId === settlement.recoveryId,
  );
  if (
    !state ||
    state.generation !== Number(settlement.stateGeneration) ||
    state.milestoneId !== settlement.milestoneId ||
    task?.attemptId !== settlement.attemptId ||
    task?.operationId !== settlement.operationId ||
    obligation?.phase !== "acknowledged" ||
    !obligation.acknowledgement ||
    JSON.stringify(obligation.acknowledgement) !==
      JSON.stringify(safeAcknowledgement)
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_acknowledgement_gc_not_verified",
    });
  return finalizeRuntimeOwnedDockerRecoveryAcknowledgement(
    String(settlement.recoveryId),
    obligation.acknowledgement,
  );
}

export {
  DOCKER_RECOVERY_RUNTIME_CONTRACT,
  DOCKER_RECOVERY_RUNTIME_CONTRACT_REVISION,
  abandonRuntimeOwnedDockerRecovery,
  beginRuntimeOwnedDockerRecovery,
  completeRuntimeOwnedDockerRecovery,
  createIsolatedDockerRecoveryRuntimeCandidate,
  describeDockerRecoveryRuntimeContract,
  finalizeRuntimeOwnedDockerRecovery,
  inspectRuntimeOwnedDockerResourceReceipts,
  inspectRuntimeOwnedDockerTaskRecoveryState,
  resolveRuntimeOwnedDockerTaskRecoveryCorrelations,
  markRuntimeOwnedDockerResourceSubmission,
  prepareRuntimeOwnedDockerHostCleanup,
  recordRuntimeOwnedDockerAbsence,
  recordRuntimeOwnedDockerHostCleanupReceipt,
  recordRuntimeOwnedDockerResourceReceipt,
  recordRuntimeOwnedNormalMountCompletion,
  recoverRuntimeOwnedDockerTask,
  recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestart,
  verifyRuntimeOwnedDockerRecoveryBinding,
} from "./docker-recovery-runtime-internal.ts";
