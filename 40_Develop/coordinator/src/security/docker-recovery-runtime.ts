/**
 * Closed production facade for durable Docker recovery.
 *
 * Runtime-owned native observations are selected inside the implementation.
 * Caller-supplied Root, observer, runner and fault/crash hooks are deliberately
 * absent from this module interface.
 */
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
