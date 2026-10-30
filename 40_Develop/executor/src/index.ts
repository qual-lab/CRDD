/**
 * 一試行を準備・開始・取消し、清掃後の結果を返すExecutor公開入口。
 * @packageDocumentation
 * @responsibility 構成・準備・実行・結果と有限の検証接続を明示公開する。
 * @trace ARCH-000008
 * @boundary 上位Hostと単段実行の間。Taskの順序・Queue・再試行は所有しない。
 */
// 構成と一試行の生涯。startのcompletionは清掃を含む終了まで待つ。
export { createExecutor } from "./attempt/preparation.ts";
export type { ExecutorOptions } from "./attempt/types.ts";
export { describeExecutorContract } from "./attempt/execute.ts";
export type {
  Executor,
  StartResult,
  CompletionResult,
  AttemptResultReason,
  AttemptFailureReason,
} from "./result/types.ts";
export type {
  AttemptInput,
  AttemptPaths,
} from "./attempt/types.ts";
// 実Process開始と非秘密診断。受付・準備開始の通知とは区別する。
export type {
  ProcessStartedNotice,
  AttemptDiagnosticNotice,
} from "./attempt/observation.ts";
// 結果の内容・検査・上位への公開投影。
export {
  isPrimaryFailureDiagnostic,
  inspectRecoveryStartFailureDiagnostic,
  resolveRecoveryStartReason,
  resolveRecoveryReference,
} from "./result/validation.ts";
export type {
  PrimaryFailureDiagnostic,
  RecoveryStartFailureDiagnostic,
} from "./result/types.ts";
