/**
 * Coordinatorの業務進行・単発実行・現在回復を公開する。
 * @packageDocumentation
 * @responsibility Objective・Task・判断・状態照会と単発実行を各実Ownerから明示公開する。
 * @trace ARCH-000004
 * @boundary Workbench・MCP・CLI等の利用側とCoordinatorの公開操作境界。
 * @concurrency Task・Execution・保存の既存世代と取消・受領を各Ownerが調停する。
 * @effect Task実行と現在回復のDocker／Host処置、状態・履歴・配送／終了保存を既存Ownerへ委譲する。現在相関解決は読取り専用。
 * @security 現在回復は検証済みRepository Root・私有Owner・保存済みconsumerの境界を維持し、相関診断からAuthorityを発行しない。
 */
export {
  runCoordinatorTaskAttempt,
  snapshotCoordinatorWorkspaceResult,
  COORDINATOR_TASK_PRE_EFFECT_REJECTIONS,
  type CoordinatorTaskDependencies,
} from "./execution/controller.ts";
export type { CoordinatorTaskAttemptInput } from "./execution/request.ts";
export type {
  CoordinatorTaskAttemptResult,
  CoordinatorWorkspaceResult,
} from "./execution/result.ts";
export type { CoordinatorTaskRecoveryObligation } from "./execution/recovery.ts";
export { isSupportedCoordinatorNodeRuntime } from "./execution/diagnostics.ts";
export {
  createRuntimeProcessRecoveryIdentity,
  getRuntimeProcessInstanceIdentity,
  inspectRuntimeProcessRecoveryIdentity,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "./execution/process-safety-state.ts";
export { acquireRuntimeOwnedProjectStateKernelLock } from "./execution/kernel-lock.ts";
export {
  recoverRuntimeOwnedDockerTaskForCurrentConsumer,
  resolveRuntimeOwnedDockerTaskCurrentCorrelations,
} from "./execution/recovery.ts";
export { observeRuntimeOwnedTransientTaskCompletion } from "./storage/settlement-store.ts";
export { runRepositoryAdvice } from "./execution/advice.ts";
export { recoverProviderAdviceHostOperation } from "./execution/advice.ts";
export {
  readRepositoryNetworkPolicies,
  type RepositoryNetworkPolicies,
} from "./decision/external-send-policy.ts";

export { createCoordinatorAcceptanceAuthorityAdapter } from "./decision/request.ts";
export {
  manageCoordinatorWorkspace,
  resolveCoordinatorWorkspaceTaskTarget,
  type CoordinatorWorkspaceRequest,
} from "./workspace/operations.ts";
export type { CoordinatorWorkspace } from "./workspace/record.ts";
export { createCoordinatorDecisionCapabilityAdapter } from "./decision/lifecycle.ts";
export {
  COORDINATOR_ACCEPTANCE_DECISION_CONTRACT,
  type CoordinatorAcceptanceDecisionRequest,
} from "./decision/request.ts";
export { recordCoordinatorAcceptanceDecision } from "./decision/acceptance.ts";
export type {
  CoordinatorAcceptanceDecisionDependencies,
  CoordinatorAcceptanceDecisionResult,
} from "./decision/types.ts";
export {
  COORDINATOR_OBJECTIVE_INTAKE_CONTRACT,
  inspectCoordinatorObjectivePlan,
} from "./objective/plan.ts";
export {
  createCoordinatorObjectiveResult,
  createCoordinatorTaskExecutionSet,
  inspectCoordinatorWorkspaceResults,
  describeCoordinatorObjectiveIntakeContract,
  executeCoordinatorObjective,
} from "./objective/execute.ts";
export type {
  CoordinatorObjectivePlan,
  CoordinatorObjectiveExecutionDependencies,
} from "./objective/types.ts";
export {
  COORDINATOR_REPLANNING_CONTRACT,
  resolveCoordinatorReplan,
} from "./objective/replan.ts";
export type {
  CoordinatorReplanClassifier,
  CoordinatorReplanDecision,
  CoordinatorReplanInput,
} from "./objective/types.ts";
export { COORDINATOR_EXECUTION_CONTRACT } from "./task/dispatch.ts";
export type {
  CoordinatorExecutionDependencies,
  CoordinatorExecutionPublicationObservation,
  CoordinatorExecutionResult,
  CoordinatorTaskExecution,
} from "./task/types.ts";
export {
  describeCoordinatorExecutionContract,
  runCoordinatorOperation,
} from "./task/dispatch.ts";
export {
  invalidateCoordinatorHumanDecision,
  issueCoordinatorHumanDecision,
  coordinatorDecisionRecordId,
  recoverCoordinatorHumanDecision,
  replaceCoordinatorHumanDecision,
  submitCoordinatorHumanDecision,
} from "./decision/lifecycle.ts";
export { queryCoordinatorState } from "./state/query.ts";
export {
  COORDINATOR_MAXIMUM_CONCURRENCY,
  COORDINATOR_MAXIMUM_OBJECTIVES,
  COORDINATOR_MAXIMUM_TASKS,
  COORDINATOR_STATE_CONTRACT,
  createCoordinatorState,
  describeCoordinatorStateContract,
  isCoordinatorRecoveryIdentity,
  type ProjectDockerRecoveryAcknowledgement,
  type ProjectMilestoneRecord,
  type ProjectMilestoneState,
  type ProjectObjectiveDefinition,
  type ProjectObjectiveRecord,
  type ProjectObjectiveState,
  type CoordinatorAcceptanceDecision,
  type CoordinatorAcceptanceDecisionInput,
  type CoordinatorAcceptanceTarget,
  type CoordinatorState,
  type ProjectTaskDefinition,
  type ProjectTaskRecord,
  type ProjectTaskRecoveryKind,
  type ProjectTaskRecoveryObligation,
  type ProjectTaskStartPhase,
  type ProjectTaskState,
} from "./state/model.ts";
export {
  markProjectTaskRecoveryObligationRecovering,
  recordProjectTaskOwnerLossRecoveries,
  retrySettledProjectTaskRecoveries,
  settleProjectTaskRecoveryObligation,
} from "./task/recovery.ts";
export { acknowledgeProjectDockerRecoveryObligation } from "./task/acceptance.ts";
export {
  applyCoordinatorAcceptanceDecision,
  applyCoordinatorHumanDecision,
  requestCoordinatorHumanDecision,
} from "./state/model.ts";
export {
  applyCoordinatorPartialReplan,
  retryCoordinatorTask,
} from "./task/lifecycle.ts";
export {
  isCoordinatorObjectiveProjectionCorrelationValid,
  isCoordinatorProjectionSemanticallyValid,
  projectCoordinatorState,
} from "./state/projection.ts";
export type { CoordinatorProjection } from "./state/types.ts";
export {
  observeProjectTaskStarted,
  prepareProjectTaskHandoff,
  reserveProjectTaskStart,
  settleProjectTask,
  settleProjectTaskBeforeEffect,
} from "./task/lifecycle.ts";
export { selectSchedulableProjectTasks } from "./task/scheduling.ts";
export type {
  ProjectQueueEntry,
  ProjectQueueState,
} from "./state/model.ts";
export {
  COORDINATOR_PLATFORM_BOUNDARIES,
  COORDINATOR_PLATFORM_BOUNDARY_GUARANTEES,
  COORDINATOR_PLATFORM_BOUNDARY_OPERATIONS,
  COORDINATOR_PLATFORM_CONTRACT,
  COORDINATOR_PLATFORM_CONTRACT_REVISION,
  describeCoordinatorPlatformContract,
  resolveCoordinatorPlatformAdapter,
  type CoordinatorPlatformAdapter,
  type CoordinatorPlatformAdapterDescription,
  type CoordinatorPlatformBoundary,
  type CoordinatorPlatformGuarantee,
  type CoordinatorPlatformResolution,
} from "./execution/diagnostics.ts";
export {
  COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT,
  COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT_REVISION,
} from "./task/dispatch.ts";
export type {
  CoordinatorExecutionPort,
  CoordinatorSingleTaskAttemptInput,
  CoordinatorSingleTaskRecoveryObligation,
  CoordinatorSingleTaskResult,
} from "./task/types.ts";
export type {
  CoordinatorAcceptanceDecisionAuthorityBinding,
  CoordinatorAcceptanceDecisionAuthorityPort,
  CoordinatorAcceptanceDecisionStore,
} from "./decision/types.ts";
export type { CoordinatorAcceptanceDecisionRecord } from "./decision/records.ts";
export type {
  CoordinatorExecutionObservationPort,
  CoordinatorExecutionObservationPublication,
  CoordinatorTaskAttemptObservation,
} from "./task/types.ts";
export {
  createCoordinatorTaskAttemptEvent,
  recordCoordinatorExecutionEvent,
} from "./task/dispatch.ts";
export type {
  CoordinatorIntegrationRecord,
  CoordinatorIntegrationRecordPort,
} from "./storage/result-record.ts";
export type {
  CoordinatorClockIdentityPort,
  CoordinatorClockReading,
} from "./state/persistence.ts";
export {
  isCoordinatorDecisionRecord,
  type CoordinatorDecisionRecord,
  type CoordinatorDecisionRecoveryIntent,
} from "./decision/records.ts";
export type {
  CoordinatorDecisionPort,
  CoordinatorDecisionRecoveryStore,
  CoordinatorDecisionStore,
} from "./decision/types.ts";
export type {
  CoordinatorDecisionCapability,
  CoordinatorDecisionCapabilityPort,
} from "./decision/types.ts";
export type {
  CoordinatorLease,
  CoordinatorLeaseAcquisitionResolution,
  CoordinatorLeaseKind,
  CoordinatorLeaseOwnerObservation,
  CoordinatorLeasePort,
} from "./state/persistence.ts";
export type { CoordinatorPortResult } from "./state/result.ts";
export type { CoordinatorProcessSafetyPort } from "./task/types.ts";
export type {
  CoordinatorPersistencePorts,
  CoordinatorQueueEnqueueInput,
  CoordinatorQueueUpdate,
  CoordinatorStatePort,
} from "./state/persistence.ts";
export type {
  CoordinatorDockerRecoveryIdentity,
  CoordinatorRecoveryTransition,
  CoordinatorTaskRecoveryPort,
} from "./task/types.ts";
export { COORDINATOR_INTEGRATION_CONTRACT } from "./storage/result-record.ts";
export {
  inspectCoordinatorObjectiveRequest,
  type CoordinatorObjectiveRequest,
} from "./objective/request.ts";
export {
  COORDINATOR_HUMAN_DECISION_CONTRACT,
  inspectCoordinatorDecisionRequest,
  type CoordinatorDecisionRequest,
} from "./decision/request.ts";
export { COORDINATOR_PUBLIC_RUNTIME_CONTRACT } from "./state/result.ts";
export {
  runCoordinatorSingleTaskAttempt,
  describeCoordinatorSingleTaskAdapterContract,
  COORDINATOR_SINGLE_TASK_PRE_EFFECT_REJECTIONS,
  type CoordinatorSingleTaskDependencies,
} from "./execution/controller.ts";
export { createCoordinatorExecutionHostPorts } from "./task/dispatch.ts";
export type { CoordinatorExecutionHostAdapterOptions } from "./task/types.ts";
export { createCoordinatorTaskRecoveryAdapter } from "./task/dispatch.ts";
export type { CoordinatorTaskRecoveryHostDependencies } from "./task/types.ts";
export {
  COORDINATOR_STATE_QUERY_CONTRACT,
  inspectCoordinatorStateQuery,
} from "./state/request.ts";
export {
  inspectCoordinatorProjection,
  inspectCoordinatorStateQueryResult,
} from "./state/projection.ts";
export type {
  CoordinatorStateQuery,
  CoordinatorStateQueryResult,
} from "./state/types.ts";
export {
  COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT,
  validCoordinatorAcceptanceDecisionRecord,
  validCoordinatorAcceptanceDecisionEnvelope,
  type CoordinatorAcceptanceDecisionEnvelope,
} from "./decision/records.ts";
export { validCoordinatorDecisionRecoveryIntent } from "./decision/records.ts";
export { validCoordinatorResultRecord } from "./storage/model.ts";
export type {
  IntegrationRecordBinding,
  CoordinatorResultRecord,
} from "./storage/result-record.ts";
export {
  createCurrentCoordinatorPersistencePorts,
  createCoordinatorSnapshotPersistencePorts,
  inspectCoordinatorSnapshotIntake,
  readCurrentCoordinatorState,
  readCoordinatorSnapshot,
  initializeCoordinatorSnapshot,
  maintainCoordinatorSnapshot,
  createCoordinatorSnapshotAcceptanceDecisionStore,
  createCoordinatorSnapshotDecisionRecoveryStore,
  createCoordinatorSnapshotIntegrationRecordPort,
} from "./storage/current-state.ts";
export {
  executeCoordinatorPublicAcceptanceDecision,
  runCoordinatorPublicAcceptanceDecision,
} from "./decision/acceptance.ts";
export {
  executeCoordinatorPublicStateQuery,
  runCoordinatorPublicStateQuery,
} from "./state/query.ts";
export { runCoordinatorPublicDecision } from "./decision/lifecycle.ts";
export { runCoordinatorPublicObjective } from "./objective/composition.ts";
export { observeRuntimeOwnedProjectClientPrincipal } from "./decision/lifecycle.ts";
export { readAuthorizedRuntimeActivity } from "./state/observation.ts";
export {
  inspectWorkspaceCommand,
  executeWorkspaceCommand,
  type WorkspaceCommand,
  type WorkspaceView,
} from "./workspace/commands.ts";
export {
  parseRuntimeActivityObservation,
  inspectRuntimeActivityObservation,
} from "./state/projection.ts";
export { createRepositoryTaskRequests } from "./task/requests.ts";
export {
  getAuthenticationStatus,
  authenticateProvider,
  inspectAiSelectionChoice,
  readRepositoryAiSelection,
  saveRepositoryAiSelection,
} from "./api.ts";
export type {
  AiSelectionReadResult,
  AiSelectionSaveResult,
  AiSelectionChoice,
  AiSelectionConfig,
  AiSelectionRole,
  AiSelectionSnapshot,
  ExecutionSelection,
  SingleTaskCommand,
} from "./api.ts";
export type {
  ActivityRepository,
  ActivitySource,
  RuntimeActivityEvent,
  RuntimeActivityObservation,
  RuntimeActivityRequest,
} from "./state/types.ts";
