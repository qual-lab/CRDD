/**
 * Docker実資源の回復操作だけを公開する。
 *
 * @responsibility Coordinator所有の固定回復操作を公開し、上位Task状態を読み込まない。
 * @trace ARCH-000008
 */
export {
  abandonRuntimeOwnedDockerRecovery,
  beginRuntimeOwnedDockerRecovery,
  bindRuntimeOwnedDockerInitializationFailure,
  completeRuntimeOwnedDockerProjectResultDelivery,
  completeRuntimeOwnedDockerRecovery,
  createIsolatedDockerRecoveryRuntimeCandidate,
  DOCKER_RECOVERY_RUNTIME_CONTRACT,
  DOCKER_RECOVERY_RUNTIME_CONTRACT_REVISION,
  describeDockerRecoveryRuntimeContract,
  finalizeRuntimeOwnedDockerRecovery,
  inspectRuntimeOwnedDockerResourceReceipts,
  inspectRuntimeOwnedDockerTaskRecoveryState,
  markRuntimeOwnedDockerResourceSubmission,
  prepareRuntimeOwnedDockerHostCleanup,
  readRuntimeOwnedDockerProjectResult,
  recordRuntimeOwnedDockerAbsence,
  recordRuntimeOwnedDockerHostCleanupReceipt,
  recordRuntimeOwnedDockerProviderSubmission,
  recordRuntimeOwnedDockerResourceNotIssued,
  recordRuntimeOwnedDockerResourceReceipt,
  recordRuntimeOwnedNormalMountCompletion,
  recoverRuntimeOwnedDockerTask,
  recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestart,
  recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestart,
  resolveRuntimeOwnedDockerTaskRecoveryCorrelations,
  verifyRuntimeOwnedDockerHomeLeaseRelease,
  verifyRuntimeOwnedDockerRecoveryBinding,
} from "./docker-recovery-runtime-internal.ts";
