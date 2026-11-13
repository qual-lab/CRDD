/**
 * Coordinatorの正式操作・公開DTOだけを提供するPackage入口。
 * @packageDocumentation
 * @responsibility 正式操作とDomain所有の公開値契約を明示的に公開する。
 * @trace ARCH-000004
 * @boundary Workbench・MCP等の利用側と正式API。
 * @security 内部Storage・Authority・Factoryを公開しない。
 */

export type { WorkspaceResult } from "./workspace/record.ts";
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
  initializeProject,
  inspectSingleTaskCommand,
  isSupportedNodeRuntime,
  openTaskSession,
  type ProjectInitializationRequest,
  queryActivity,
  queryState,
  type RecoveryRequest,
  type RecoveryResult,
  type RuntimeRepairResult,
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
  COORDINATOR_HUMAN_DECISION_CONTRACT,
  type CoordinatorDecisionRequest,
  inspectCoordinatorDecisionRequest,
  inspectCoordinatorDecisionResult,
} from "./decision/request.ts";
export {
  COORDINATOR_OBJECTIVE_INTAKE_CONTRACT,
  inspectCoordinatorObjectiveRequest,
} from "./objective/plan.ts";
export type { CoordinatorObjectiveRequest } from "./objective/types.ts";
export {
  inspectRuntimeActivityObservation,
  parseRuntimeActivityObservation,
} from "./state/observation.ts";
export {
  COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
  inspectCoordinatorStateQuery,
  inspectCoordinatorStateQueryResult,
  isCoordinatorObjectiveProjectionCorrelationValid,
  isCoordinatorProjectionSemanticallyValid,
} from "./state/projection.ts";
export type {
  ActivityRepository,
  ActivitySource,
  CoordinatorProjection,
  CoordinatorStateQuery,
  CoordinatorStateQueryResult,
  RuntimeActivityEvent,
  RuntimeActivityObservation,
  RuntimeActivityRequest,
} from "./state/types.ts";
export {
  inspectWorkspaceCommand,
  type WorkspaceCommand,
} from "./workspace/commands.ts";
export { inspectCoordinatorWorkspaceResults } from "./workspace/record.ts";
