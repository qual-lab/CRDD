/**
 * Docker隔離の技術構成と実行資源操作の公開入口。
 *
 * @packageDocumentation
 * @responsibility 必要な技術APIを明示公開し、上位のTask・Provider判断を公開契約に含めない。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary 上位の検証済み技術投影とDocker・所有Processの実処置。
 * @effect 固定操作で使い捨て資源を開始・観測・終端し、元結果を返す。
 * @security Task・送信許可・Credential・永続Stateを所有せず、実ID／固定構成の照合前に削除しない。
 */

export { dockerContainerInitObservationMatches } from "./cleanup/container-init-observation.ts";
export {
  observeDockerProbeEngine,
  createDockerProbeRuntimeBinding,
  createDockerProbeContainer,
  runDockerProbeToCompletion,
  runDockerProbeCancellation,
  startDockerProbeResidue,
  planDockerProbeCreation,
  describeDockerProbeConfiguration,
  type DockerProbeProfile,
} from "./execution/probe-runtime.ts";
export {
  inspectDockerProbeContainer,
  observeDockerProbeContainerAbsence,
  cleanupDockerProbeContainer,
} from "./execution/probe-container.ts";
export {
  runDockerRuntimeRepairSession,
  type DockerRuntimeRepairInput,
  disposeDockerRuntimeRepairDirectory,
  type DockerRuntimeRepairDisposalInput,
  observeDockerRuntimeRepairRetention,
} from "./desktop/repair-runtime.ts";
export {
  type DockerRuntimeRepairCheckpoint,
  type DockerRuntimeRepairRetentionTargets,
  decodeDockerRuntimeRepairRetentionTargets,
  type DockerRuntimeRepairDisposalCheckpoint,
  createDockerRuntimeRepairDisposalCheckpoint,
  decodeDockerRuntimeRepairDisposalCheckpoint,
  validateDockerRuntimeRepairDisposalTransition,
  dockerRuntimeRepairDisposalIsSettled,
  decodeDockerRuntimeRepairCheckpoint,
  dockerRuntimeRepairCheckpointIsSettled,
  prepareDockerRuntimeRepairSessionCheckpoint,
  validateDockerRuntimeRepairCheckpointTransition,
  validateDockerRuntimeRepairSessionCheckpoint,
} from "./desktop/repair-checkpoint.ts";
export {
  type DockerRuntimeBackendState,
  observeDockerRuntimeBackendState,
} from "./desktop/backend-state.ts";
export {
  restartDockerRuntime,
  type DockerRuntimeRestartInput,
  type DockerRuntimeRestartObservation,
  type DockerRuntimeRestartEvent,
} from "./desktop/restart-runtime.ts";
export {
  createDockerResourceRecoveryExecutor,
  createDockerOperationRecoveryExecutor,
  createDockerTaskRecoveryExecutor,
  type DockerOperationRecoveryInput,
  type DockerRecoveryExecutionBinding,
  observeDockerRecoveryConfigIdentity,
} from "./cleanup/recovery-executor.ts";
export {
  type DockerResourceExpectation,
  dockerResourceConfigurationMatches,
  planDockerRecoveryResourceExpectations,
  isDockerResourcePurpose,
} from "./cleanup/resource-configuration.ts";
export {
  type DockerAttachedProcess,
  startDockerProbeAttachedProcess,
  startOwnedAttachTerminationFixture,
} from "./execution/attached-process.ts";
export {
  type DockerAuthenticationCommand,
  type DockerAuthenticationInput,
  type DockerAuthenticationPlan,
  planDockerAuthenticationCommands,
  planDockerAuthenticationResourceRecovery,
} from "./execution/authentication-command-plan.ts";
export {
  createDockerAuthenticationRuntimeFactory,
  type DockerAuthenticationExecution,
} from "./execution/authentication-command-runtime.ts";
export {
  type DockerIsolationCommand,
  type DockerIsolationCommandInput,
  type DockerIsolationResourceNames,
  createDockerIsolationRandomHex,
  createDockerIsolationResourceNames,
  dockerIsolationResourceIdentityIsValid,
  planDockerIsolationCommands,
  projectDockerProxyConfiguration,
  createDockerAuthenticationEnvironment,
  projectDockerExecutionBoundary,
} from "./execution/command-plan.ts";
export {
  createDockerIsolationRuntime,
  describeDockerIsolationExecutionEnvironment,
  type DockerIsolationRuntimePlan,
  type DockerResourceCleanupObservation,
  type DockerResourceReceipts,
} from "./execution/command-runtime.ts";
export type {
  CommandHandle,
  OwnedCommandHandle,
} from "./execution/owned-windows-process.ts";
export {
  type CommandExecution,
  type CommandObservation,
  classifyDockerCommandExecution,
  classifyDockerCommandException,
  classifyDockerProcessExit,
  STDERR_LIMIT_BYTES,
  STDOUT_LIMIT_BYTES,
} from "./execution/command-result.ts";
export {
  startDockerCommandSessionCandidate,
  describeDockerCommandSessionContract,
  type DockerExecutionHooks,
  type DockerSessionCleanup,
} from "./execution/command-session.ts";
export {
  type DockerProbeCommand,
  describeDockerProbeResource,
  executeDockerProbeCommand,
  planDockerProbeCommand,
} from "./execution/probe-command.ts";
export {
  createDockerProcessEnvironment,
  createDockerCliEnvironment,
  createDockerDesktopRepairHelperEnvironment,
} from "./execution/cli-environment.ts";
export {
  type DockerCliTrustSnapshot,
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
  describeDockerCliTrustContract,
  describeDockerRuntimeArtifactTrustContract,
} from "./execution/cli-trust.ts";
export {
  type DockerRuntimeEngineObservation,
  type DockerRuntimeEngineState,
  type DockerRepairEngineObservation,
  type DockerRepairEngineState,
  DOCKER_ENGINE_STARTUP_WAIT_MS,
  awaitDockerRepairEngine,
  observeDockerRuntimeEngine,
  observeDockerRepairEngine,
} from "./desktop/engine-state.ts";
export { observeDockerRuntimeDirectoryLock } from "./desktop/runtime-directory.ts";
export type {
  DockerRestartStopFailure,
  DockerRestartStartFailure,
} from "./desktop/restart-machine.ts";
export {
  dockerProbeConfigurationMatches,
  type DockerProbeConfigurationExpectation,
} from "./execution/probe-configuration.ts";
export {
  classifyDockerProbeExecution,
  classifyDockerProbeCancellation,
  normalizeContainerCreation,
  normalizeContainerAbsence,
} from "./execution/probe-result.ts";
