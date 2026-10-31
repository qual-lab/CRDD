/**
 * 単段実行・AIツール認証・Attempt資源回収とHost環境の技術窓口を公開する。
 * @packageDocumentation
 * @responsibility 単発実行、対象別の資源観測・回収、環境観測・再起動・修復と必要な型だけを明示公開する。
 * @trace ARCH-000008
 * @trace ARCH-000010
 * @boundary 上位判断と下位技術処理の間。Taskの順序・Queue・再試行・保存は所有しない。
 */
// 構成と一試行の生涯。startのcompletionは清掃を含む終了まで待つ。
export { createExecutor } from "./attempt/execute.ts";
export type {
  IsolationProbeRequest,
  IsolationProbeOptions,
  IsolationProbeCallbacks,
  IsolationProbeResult,
  IsolationProbeExecutor,
} from "./probe/types.ts";
export { createAuthentication } from "./authentication/execute.ts";
export type {
  Authentication,
  AuthenticationRequest,
  AuthenticationProjection,
  AuthenticationCallbacks,
  AuthenticationResult,
  AuthenticationCleanupResult,
} from "./authentication/types.ts";
export {
  inspectDockerEnvironment,
  restartDockerEnvironment,
  repairDockerEnvironment,
} from "./environment/execute.ts";
export type { DockerEnvironmentStatus } from "./environment/types.ts";
export type {
  DockerRuntimeRestartInput,
  DockerRuntimeRestartResult,
  DockerRuntimeRestartEvent,
  DockerRuntimeRepairInput,
  DockerRuntimeRepairResult,
} from "../../docker-isolation/src/index.ts";
export {
  inspectResources,
  cleanupResources,
} from "./resources/execute.ts";
export type {
  ResourceCleanupCallbacks,
  AttemptRecoveryTarget,
  AttemptResourceInspection,
  AttemptCleanupResult,
  DirectoryResourceInspectionTarget,
  DirectoryResourceCleanupTarget,
  ContainerResourceTarget,
  ContainerResourceInspection,
} from "./resources/types.ts";
export type {
  ExecutorCallbacks,
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
