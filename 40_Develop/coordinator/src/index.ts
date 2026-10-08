/**
 * Coordinatorが上位利用側へ公開する単一Taskの実行境界。
 * @packageDocumentation
 * @responsibility 共通Taskの開始・取消・完了とNode実行条件を公開する。
 * @trace ARCH-000004
 * @boundary Orchestrator等の上位利用側とCoordinator単一Taskの境界。
 * @effect 検証済み入力の単一Task実行を既存Runtimeへ委譲する。
 * @security 上位業務状態を読み込まず、不透明な実行Capabilityの検証を維持する。
 */
export {
  runCoordinatorTaskAttempt,
  COORDINATOR_TASK_PRE_EFFECT_REJECTIONS,
  type CoordinatorTaskDependencies,
} from "./task/attempt.ts";
export type {
  CoordinatorTaskAttemptInput,
  CoordinatorTaskAttemptResult,
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
