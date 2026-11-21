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
  executeWorkspace,
  getAuthenticationStatus,
  getCapabilities,
  openTaskSession,
  queryActivity,
  queryState,
  type RecoveryObservation,
  type RecoveryRequest,
  type RecoveryResult,
  type RuntimeRepairResult,
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
  type WorkspaceView,
} from "./api.ts";
export {
  type CoordinatorDecisionRequest,
  inspectCoordinatorDecisionRequest,
  inspectCoordinatorDecisionResult,
} from "./lifecycle/decision.ts";
export { parseRuntimeActivityObservation } from "./lifecycle/query.ts";
export {
  inspectWorkspaceCommand,
  type WorkspaceCommand,
} from "./lifecycle/workspace.ts";
export {
  inspectCoordinatorObjectiveRequest,
  inspectCoordinatorObjectiveResult,
  inspectCoordinatorStateQuery,
  inspectCoordinatorStateQueryResult,
} from "./lifecycle/validation.ts";
export type {
  ActivityRepository,
  ActivitySource,
  CoordinatorObjectiveRequest,
  CoordinatorProjection,
  CoordinatorStateQuery,
  CoordinatorStateQueryResult,
  RuntimeActivityEvent,
  RuntimeActivityObservation,
  RuntimeActivityRequest,
  WorkspaceResult,
} from "./lifecycle/types.ts";
