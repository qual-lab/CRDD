/**
 * 単段実行・Attempt資源回収とHost環境の技術窓口を公開する。
 * @packageDocumentation
 * @responsibility 単発実行・診断・回収、環境観測・再起動と必要な型だけを明示公開する。
 * @trace ARCH-000008
 * @boundary 上位判断と下位技術処理の間。Taskの順序・Queue・再試行・保存は所有しない。
 */
// 構成と一試行の生涯。startのcompletionは清掃を含む終了まで待つ。
export { createExecutor } from "./attempt/execute.ts";
export { prepareAdviceCommand } from "./attempt/isolation.ts";
export {
  inspectDockerEnvironment,
  restartDockerEnvironment,
} from "./environment/execute.ts";
export type { DockerEnvironmentStatus } from "./environment/types.ts";
export type {
  DockerRuntimeRestartInput,
  DockerRuntimeRestartResult,
  DockerRuntimeRestartEvent,
} from "../../docker-isolation/src/index.ts";
export {
  inspectAttemptResources,
  cleanupAttemptResources,
} from "./attempt/recovery.ts";
export type {
  PreparedAdviceCommand,
  ExecutorCallbacks,
  ResourceCleanupCallbacks,
  AttemptRecoveryTarget,
  AttemptResourceInspection,
  AttemptCleanupResult,
  Executor,
  StartResult,
  CompletionResult,
  AttemptTerminalObservation,
  AttemptResultReason,
  AttemptFailureReason,
  AttemptRecordProjection,
  AttemptRequest,
  ProcessStartedNotice,
  AttemptDiagnosticNotice,
  PrimaryFailureDiagnostic,
} from "./attempt/types.ts";
