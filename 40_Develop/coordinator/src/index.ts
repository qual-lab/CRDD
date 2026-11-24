/**
 * Coordinatorの正式操作・公開DTOだけを提供するPackage入口。
 * @packageDocumentation
 * @responsibility 正式操作とDomain所有の公開値契約を明示的に公開する。
 * @trace ARCH-000004
 * @boundary Workbench・MCP等の利用側と正式API。
 * @security 内部Storage・Authority・Factoryを公開しない。
 */

export {
  type AuthenticationRequest,
  type AuthenticationResult,
  acceptResult,
  authenticateProvider,
  diagnoseEnvironment,
  type EnvironmentRequest,
  type EnvironmentResult,
  type ExecutionContext,
  type ExecutionSelection,
  getAuthenticationStatus,
  getCapabilities,
  openTaskSession,
  queryActivity,
  queryState,
  type RecoveryObservation,
  type RecoveryRequest,
  type RecoveryResult,
  type DockerRepairResult,
  readRecovery,
  readRepositoryNetworkHosts,
  recoverExecution,
  repairDockerRuntime,
  restartDockerForRecovery,
  retainRepair,
  runObjective,
  runTask,
  type SingleTaskCommand,
  submitDecision,
  type TaskRunResult,
  type TaskSession,
  type TaskSessionContext,
} from "./api.ts";
export {
  type CoordinatorDecisionRequest,
  inspectCoordinatorDecisionRequest,
  inspectCoordinatorDecisionResult,
} from "./lifecycle/decision.ts";
export { parseExecutionActivityObservation } from "./lifecycle/query.ts";
export {
  acquireCoordinatorSnapshotLease,
  resolveRepositoryExecutionDataPaths,
  resolveExecutionStorageDirectory,
} from "./lifecycle/host.ts";
export {
  containsRecognizedSecretText,
  deriveCoordinatorRepositoryBindingId,
  inspectCoordinatorObjectiveRequest,
  inspectCoordinatorObjectiveResult,
  inspectCoordinatorStateQuery,
  inspectCoordinatorStateQueryResult,
  snapshotPlainArray,
  snapshotPlainRecord,
  validIdentity,
} from "./lifecycle/validation.ts";
export type {
  ActivityRepository,
  ActivitySource,
  BorrowedExecutionTarget,
  PreparedWorkspaceTarget,
  CoordinatorLease,
  CoordinatorObjectiveRequest,
  CoordinatorProjection,
  CoordinatorStateQuery,
  CoordinatorStateQueryResult,
  ExecutionActivityEvent,
  ExecutionActivityObservation,
  ExecutionActivityRequest,
  WorkspaceResult,
} from "./lifecycle/types.ts";
