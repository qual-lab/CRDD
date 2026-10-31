/**
 * 一試行を準備・開始・取消し、清掃後の結果を返すExecutor公開入口。
 * @packageDocumentation
 * @responsibility 構成・単発準備・開始・取消と必要な結果型だけを明示公開する。
 * @trace ARCH-000008
 * @boundary 上位Hostと単段実行の間。Taskの順序・Queue・再試行は所有しない。
 */
// 構成と一試行の生涯。startのcompletionは清掃を含む終了まで待つ。
export { createExecutor } from "./attempt/execute.ts";
export { prepareAdviceCommand } from "./attempt/isolation.ts";
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
