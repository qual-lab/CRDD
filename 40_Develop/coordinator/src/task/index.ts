/**
 * 上位工程の状態を読み込まないCoordinator単一Task操作の公開入口。
 *
 * @packageDocumentation
 * @responsibility 開始・取消・完了結果の共通処理と、その入力・結果型を公開する。
 * @trace ARCH-000004
 * @boundary OrchestratorとCoordinator単一Task処理の直接呼出し境界。
 * @effect 公開関数は検証済み入力で単一Task実行を委譲し得る。
 * @security 不透明なCapabilityを永続化せず、上位Project状態を読み込まない。
 */
export {
  runCoordinatorTaskAttempt,
  COORDINATOR_TASK_PRE_EFFECT_REJECTIONS,
  type CoordinatorTaskDependencies,
} from "./task-attempt-runtime.ts";
export type {
  CoordinatorTaskAttemptInput,
  CoordinatorTaskAttemptResult,
  CoordinatorTaskRecoveryObligation,
} from "./types.ts";
export {
  createRuntimeProcessRecoveryIdentity,
  getRuntimeProcessInstanceIdentity,
  inspectRuntimeProcessRecoveryIdentity,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../host-runtime/runtime-process-safety-state.ts";
