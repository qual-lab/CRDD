/**
 * Coordinatorが上位利用側へ公開する単一Taskの実行・現在回復境界。
 * @packageDocumentation
 * @responsibility 共通Taskの開始・取消・完了、検証済みRepository内の現在回復と相関診断を公開する。
 * @trace ARCH-000004
 * @boundary Orchestrator等の上位利用側とCoordinator単一Taskの境界。
 * @effect Task実行と現在回復のDocker／Host処置、状態・履歴・配送／終了保存を既存Ownerへ委譲する。現在相関解決は読取り専用。
 * @security 現在回復は検証済みRepository Root・私有Owner・保存済みconsumerの境界を維持し、相関診断からAuthorityを発行しない。
 */
export {
  runCoordinatorTaskAttempt,
  snapshotCoordinatorWorkspaceResult,
  COORDINATOR_TASK_PRE_EFFECT_REJECTIONS,
  type CoordinatorTaskDependencies,
} from "./task/attempt.ts";
export type {
  CoordinatorTaskAttemptInput,
  CoordinatorTaskAttemptResult,
  CoordinatorWorkspaceResult,
  CoordinatorTaskRecoveryObligation,
} from "./task/types.ts";
export { isSupportedCoordinatorNodeRuntime } from "./host-execution/node-runtime-version.ts";
export {
  createRuntimeProcessRecoveryIdentity,
  getRuntimeProcessInstanceIdentity,
  inspectRuntimeProcessRecoveryIdentity,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "./host-execution/process-safety-state.ts";
export { acquireRuntimeOwnedOrchestratorStateKernelLock } from "./host-execution/kernel-lock.ts";
export {
  recoverRuntimeOwnedDockerTaskForCurrentConsumer,
  resolveRuntimeOwnedDockerTaskCurrentCorrelations,
} from "./task/recovery.ts";
export { observeRuntimeOwnedTransientTaskCompletion } from "./state-storage/settlement-store.ts";
export {
  readRepositoryNetworkPolicies,
  type RepositoryNetworkPolicies,
} from "./external-send/policy.ts";
