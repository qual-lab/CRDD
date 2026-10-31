/**
 * 一試行を準備・開始・取消し、清掃後の結果を返すExecutor公開入口。
 * @packageDocumentation
 * @responsibility 構成・単発準備・開始・取消と必要な結果型だけを明示公開する。
 * @trace ARCH-000008
 * @boundary 上位Hostと単段実行の間。Taskの順序・Queue・再試行は所有しない。
 */
// 構成と一試行の生涯。startのcompletionは清掃を含む終了まで待つ。
export { createExecutor } from "./attempt/execute.ts";
export type { ExecutorCallbacks } from "./attempt/types.ts";
export type {
  Executor,
  StartResult,
  CompletionResult,
  AttemptTerminalObservation,
  AttemptResultReason,
  AttemptFailureReason,
} from "./result/types.ts";
export type {
  AttemptRecordProjection,
  AttemptRequest,
} from "./attempt/types.ts";
// 実Process開始と非秘密診断。受付・準備開始の通知とは区別する。
export type {
  ProcessStartedNotice,
  AttemptDiagnosticNotice,
} from "./attempt/types.ts";
export type { PrimaryFailureDiagnostic } from "./result/types.ts";
