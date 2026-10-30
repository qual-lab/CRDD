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

export { dockerContainerInitObservationMatches } from "./cleanup/init.ts";
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
} from "./probe/execute.ts";
export {
  inspectDockerProbeContainer,
  observeDockerProbeContainerAbsence,
  cleanupDockerProbeContainer,
} from "./probe/container.ts";
export {
  runDockerRuntimeRepairSession,
  type DockerRuntimeRepairInput,
  disposeDockerRuntimeRepairDirectory,
  type DockerRuntimeRepairDisposalInput,
  observeDockerRuntimeRepairRetention,
} from "./docker-desktop/repair-session.ts";
export type {
  DockerRuntimeRepairCheckpoint,
  DockerRuntimeRepairRetentionTargets,
  DockerRuntimeRepairDisposalCheckpoint,
} from "./docker-desktop/types.ts";
export {
  decodeDockerRuntimeRepairRetentionTargets,
  decodeDockerRuntimeRepairDisposalCheckpoint,
  dockerRuntimeRepairDisposalIsSettled,
  decodeDockerRuntimeRepairCheckpoint,
  dockerRuntimeRepairCheckpointIsSettled,
} from "./docker-desktop/validation.ts";
export {
  type DockerRuntimeBackendState,
  observeDockerRuntimeBackendState,
} from "./docker-desktop/backend.ts";
export {
  restartDockerRuntime,
  type DockerRuntimeRestartInput,
  type DockerRuntimeRestartObservation,
  type DockerRuntimeRestartEvent,
} from "./docker-desktop/restart.ts";
export {
  createDockerResourceRecoveryExecutor,
  createDockerOperationRecoveryExecutor,
  createDockerTaskRecoveryExecutor,
  type DockerOperationRecoveryInput,
  type DockerRecoveryExecutionBinding,
  observeDockerRecoveryConfigIdentity,
} from "./cleanup/execute.ts";
export {
  type DockerResourceExpectation,
  dockerResourceConfigurationMatches,
  planDockerRecoveryResourceExpectations,
  isDockerResourcePurpose,
} from "./cleanup/plan.ts";
export {
  type DockerAttachedProcess,
  startDockerProbeAttachedProcess,
  startOwnedAttachTerminationFixture,
} from "./probe/process.ts";
export {
  type DockerAuthenticationCommand,
  type DockerAuthenticationInput,
  type DockerAuthenticationPlan,
  planDockerAuthenticationCommands,
  planDockerAuthenticationResourceRecovery,
} from "./authentication/plan.ts";
export {
  createDockerAuthenticationRuntimeFactory,
  type DockerAuthenticationExecution,
} from "./authentication/execute.ts";
export {
  type DockerIsolationCommand,
  type DockerIsolationCommandInput,
  type DockerIsolationResourceNames,
  createDockerIsolationRandomHex,
  createDockerIsolationResourceNames,
  dockerIsolationResourceIdentityIsValid,
  planDockerIsolationCommands,
  dockerIsolationCommandsMatch,
  codexAdviceProviderInitRequired,
  projectDockerProxyConfiguration,
  createDockerAuthenticationEnvironment,
  projectDockerExecutionBoundary,
} from "./execution/plan.ts";
export {
  createDockerIsolationRuntime,
  describeDockerIsolationExecutionEnvironment,
  type DockerIsolationRuntimePlan,
  type DockerResourceCleanupObservation,
  type DockerResourceReceipts,
} from "./execution/execute.ts";
export type {
  CommandHandle,
  OwnedCommandHandle,
} from "./process/start.ts";
export {
  type CommandExecution,
  type CommandObservation,
  classifyDockerCommandExecution,
  classifyDockerCommandException,
  classifyDockerProcessExit,
  STDERR_LIMIT_BYTES,
  STDOUT_LIMIT_BYTES,
} from "./execution/result.ts";
export {
  startDockerCommandSessionCandidate,
  describeDockerCommandSessionContract,
  type DockerExecutionHooks,
  type DockerSessionCleanup,
} from "./execution/session.ts";
export {
  type DockerProbeCommand,
  describeDockerProbeResource,
  executeDockerProbeCommand,
  planDockerProbeCommand,
} from "./probe/plan.ts";
export {
  createDockerProcessEnvironment,
  createDockerCliEnvironment,
  createDockerDesktopRepairHelperEnvironment,
} from "./docker-cli/environment.ts";
export {
  type DockerCliTrustSnapshot,
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
  describeDockerCliTrustContract,
  describeDockerRuntimeArtifactTrustContract,
} from "./docker-cli/trust.ts";
export {
  type DockerRuntimeEngineObservation,
  type DockerRuntimeEngineState,
  type DockerRepairEngineObservation,
  type DockerRepairEngineState,
  DOCKER_ENGINE_STARTUP_WAIT_MS,
  awaitDockerRepairEngine,
  observeDockerRuntimeEngine,
  observeDockerRepairEngine,
} from "./docker-desktop/engine.ts";
export { observeDockerRuntimeDirectoryLock } from "./docker-desktop/directory.ts";
export type {
  DockerRestartStopFailure,
  DockerRestartStartFailure,
} from "./docker-desktop/restart-state.ts";
export {
  dockerProbeConfigurationMatches,
  type DockerProbeConfigurationExpectation,
} from "./probe/configuration.ts";
export {
  classifyDockerProbeExecution,
  classifyDockerProbeCancellation,
  normalizeContainerCreation,
  normalizeContainerAbsence,
} from "./probe/result.ts";

export {
  describeDockerProviderAssets,
  describeDockerProviderExecutionLocations,
} from "./image/assets.ts";

export {
  prepareDockerNetworkPolicy,
  describeDockerProxyTopology,
  parseDockerNetworkPolicy,
  type DockerNetworkPolicy,
  type DockerNetworkPolicyResult,
} from "./network/policy.ts";

export { parseDockerTaskRecoveryId } from "./cleanup/resource.ts";
export {
  bindAdviceCommand,
  hashAdviceCommand,
  bindProviderCommand,
  type ProviderCommandBinding,
  type AdviceCommand,
} from "./execution/binding.ts";
