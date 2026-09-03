/**
 * Closed production facade for durable Docker recovery.
 *
 * Runtime-owned native observations are selected inside the implementation.
 * Caller-supplied Root, observer, runner and fault/crash hooks are deliberately
 * absent from this module interface.
 */
import { readProjectRuntimeState } from "./project-runtime-durable-foundation.ts";
import { acknowledgeRuntimeOwnedDockerRecoveryCompletion } from "./docker-recovery-runtime-internal.ts";
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
