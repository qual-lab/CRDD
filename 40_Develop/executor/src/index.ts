/**
 * Provider単段実行の結果・取消・終了証拠を扱う公開入口。
 * @packageDocumentation
 * @responsibility Taskの計画・Queue・再試行を所有せず、一試行の操作と型だけを公開する。
 * @trace ARCH-000008
 * @boundary Coordinator等のHostと単段実行の間。
 */
export {
  createProviderExecutor,
  createIsolatedDockerProcessControllerCandidate,
  type ProviderExecutorHost,
} from "./attempt/execute.ts";
export { describeDockerProcessControllerContract } from "./attempt/controller.ts";
export {
  bindDockerIsolationRuntime,
  describeDockerEffectRuntimeContract,
} from "./attempt/isolation.ts";
export type {
  ProviderProcessStartedNotice,
  ProviderAttemptDiagnosticNotice,
} from "./attempt/observation.ts";
export {
  PURPOSES,
  SETUP_COMMAND_FAILURE_REASONS,
  isDockerSetupCommandPurpose,
  isDockerProcessControllerPublicCompletionReason,
  isPrimaryFailureDiagnostic,
  PROVIDER_EXECUTION_OBSERVATION_KEYS,
  inspectProviderExecutionObservation,
  RECOVERY_START_FAILURE_STAGES,
  inspectRecoveryStartFailureDiagnostic,
  ownDataValue,
  projectDockerProcessControllerStartResult,
  projectDockerProcessControllerCompletionResult,
  publicDockerRecoveryStartReason,
  publicVerifiedDockerRecoveryId,
} from "./result/validation.ts";
export {
  PROVIDER_TASK_STRUCTURED_RESULT_CONTRACT,
  PROVIDER_TASK_STRUCTURED_RESULT_CONTRACT_REVISION,
  consumeProviderTaskRemediation,
  normalizeProviderTaskStructuredResult,
  describeProviderTaskStructuredResultContract,
} from "./result/task.ts";
export {
  PROVIDER_ADVICE_RESULT_CONTRACT,
  PROVIDER_ADVICE_RESULT_CONTRACT_REVISION,
  normalizeAdviceResult,
  describeAdviceResultContract,
  describeAdviceResultSchema,
} from "./result/advice.ts";
export type {
  AdviceResult,
  ProviderAdviceResultItem,
  DockerProcessControllerFinalReason,
  DockerProcessControllerPublicCompletionReason,
  PrimaryFailureDiagnostic,
  RecoveryStartFailureDiagnostic,
} from "./result/types.ts";
export {
  validatePlan,
  planIdentity,
  resolveIsolationCommandInput,
  hashProviderAdviceCommand,
  bindProviderAdviceCommand,
  buildProviderDockerExecutionPlan,
  PROVIDER_ADVICE_RUNTIME_PACKET_CONTRACT,
  PROVIDER_ADVICE_RUNTIME_PACKET_CONTRACT_REVISION,
} from "./attempt/plan.ts";
export {
  createProviderDockerRuntimeAdapterCandidate,
  createProviderDockerBlockedResult,
  PROVIDER_PREPARATION_LIFETIME_MS,
} from "./attempt/preparation.ts";
export type {
  Command,
  PreparedPlan,
  ExecutionPaths,
  ProviderAdviceCommand,
  ProviderAdvicePacket,
  ProviderDockerRuntimeDependencies,
  ProviderDockerPreparedPlan,
  ProviderDockerPreparedResult,
  ProviderDockerConsumedModelSelection,
  ProviderDockerConsumedTaskPacket,
  ProviderDockerModelSelection,
  ProviderDockerTaskPacket,
  ProviderDockerOperationBinding,
  ProviderDockerMountGrant,
  ProviderDockerPreparedAuthority,
  ProviderDockerRandomSource,
} from "./attempt/types.ts";
