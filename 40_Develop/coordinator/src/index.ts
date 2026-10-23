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
} from "./execution/attempt.ts";
export type {
  CoordinatorTaskAttemptInput,
  CoordinatorTaskAttemptResult,
  CoordinatorWorkspaceResult,
  CoordinatorTaskRecoveryObligation,
} from "./execution/types.ts";
export { isSupportedCoordinatorNodeRuntime } from "./execution/runtime-version.ts";
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
export { recoverProviderAdviceHostOperation } from "./execution/provider-execution.ts";
export {
  readRepositoryNetworkPolicies,
  type RepositoryNetworkPolicies,
} from "./decision/external-send-policy.ts";

export { createCoordinatorAcceptanceAuthorityAdapter } from "./decision/authority-adapter.ts";
export {
  manageCoordinatorWorkspace,
  resolveCoordinatorWorkspaceTaskTarget,
  type CoordinatorWorkspaceRequest,
} from "./workspace/operations.ts";
export type { CoordinatorWorkspace } from "./workspace/record.ts";
export { createCoordinatorDecisionCapabilityAdapter } from "./decision/capability-adapter.ts";
export {
  COORDINATOR_ACCEPTANCE_DECISION_CONTRACT,
  recordCoordinatorAcceptanceDecision,
  type CoordinatorAcceptanceDecisionDependencies,
  type CoordinatorAcceptanceDecisionRequest,
  type CoordinatorAcceptanceDecisionResult,
} from "./decision/record-acceptance.ts";
export {
  COORDINATOR_OBJECTIVE_INTAKE_CONTRACT,
  createCoordinatorObjectiveResult,
  createCoordinatorTaskExecutionSet,
  inspectCoordinatorObjectivePlan,
  inspectCoordinatorWorkspaceResults,
  type CoordinatorObjectivePlan,
} from "./objective/plan.ts";
export {
  describeCoordinatorObjectiveIntakeContract,
  executeCoordinatorObjective,
  type CoordinatorObjectiveExecutionDependencies,
} from "./objective/execute.ts";
export {
  COORDINATOR_REPLANNING_CONTRACT,
  resolveCoordinatorReplan,
  type CoordinatorReplanClassifier,
  type CoordinatorReplanDecision,
  type CoordinatorReplanInput,
} from "./objective/replan.ts";
export {
  COORDINATOR_EXECUTION_CONTRACT,
  type CoordinatorExecutionDependencies,
  type CoordinatorExecutionPublicationObservation,
  type CoordinatorExecutionResult,
  type CoordinatorTaskExecution,
} from "./task/execution-contract.ts";
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
  acknowledgeProjectDockerRecoveryObligation,
  markProjectTaskRecoveryObligationRecovering,
  recordProjectTaskOwnerLossRecoveries,
  retrySettledProjectTaskRecoveries,
  settleProjectTaskRecoveryObligation,
} from "./task/recovery-transitions.ts";
export {
  applyCoordinatorAcceptanceDecision,
  applyCoordinatorHumanDecision,
  requestCoordinatorHumanDecision,
} from "./decision/transitions.ts";
export {
  applyCoordinatorPartialReplan,
  retryCoordinatorTask,
} from "./objective/replan-transitions.ts";
export {
  isCoordinatorObjectiveProjectionCorrelationValid,
  isCoordinatorProjectionSemanticallyValid,
  projectCoordinatorState,
  type CoordinatorProjection,
} from "./state/projection.ts";
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
} from "./queue/types.ts";
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
} from "./platform/contract.ts";
export {
  COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT,
  COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT_REVISION,
  type CoordinatorExecutionPort,
  type CoordinatorSingleTaskAttemptInput,
  type CoordinatorSingleTaskRecoveryObligation,
  type CoordinatorSingleTaskResult,
} from "./task/executor.ts";
export type {
  CoordinatorAcceptanceDecisionAuthorityBinding,
  CoordinatorAcceptanceDecisionAuthorityPort,
  CoordinatorAcceptanceDecisionRecord,
  CoordinatorAcceptanceDecisionStore,
} from "./decision/acceptance-authority.ts";
export type {
  CoordinatorExecutionObservationPort,
  CoordinatorExecutionObservationPublication,
  CoordinatorTaskAttemptObservation,
} from "./task/observer.ts";
export {
  createCoordinatorTaskAttemptEvent,
  recordCoordinatorExecutionEvent,
} from "./task/intelligence-adapter.ts";
export type {
  CoordinatorIntegrationRecord,
  CoordinatorIntegrationRecordPort,
} from "./storage/result-record.ts";
export type {
  CoordinatorClockIdentityPort,
  CoordinatorClockReading,
} from "./identity/clock-and-hash.ts";
export {
  isCoordinatorDecisionRecord,
  type CoordinatorDecisionPort,
  type CoordinatorDecisionRecord,
  type CoordinatorDecisionRecoveryIntent,
  type CoordinatorDecisionRecoveryStore,
  type CoordinatorDecisionStore,
} from "./decision/records.ts";
export type {
  CoordinatorDecisionCapability,
  CoordinatorDecisionCapabilityPort,
} from "./decision/capability.ts";
export type {
  CoordinatorLease,
  CoordinatorLeaseAcquisitionResolution,
  CoordinatorLeaseKind,
  CoordinatorLeaseOwnerObservation,
  CoordinatorLeasePort,
} from "./lease/controller.ts";
export type { CoordinatorPortResult } from "./operation-result.ts";
export type { CoordinatorProcessSafetyPort } from "./process/safety-contract.ts";
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
} from "./task/recovery.ts";
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
export { COORDINATOR_PUBLIC_RUNTIME_CONTRACT } from "./operation-result-contract.ts";
export {
  runCoordinatorSingleTaskAttempt,
  describeCoordinatorSingleTaskAdapterContract,
  COORDINATOR_SINGLE_TASK_PRE_EFFECT_REJECTIONS,
  type CoordinatorSingleTaskDependencies,
} from "./task/execute-attempt.ts";
export {
  createCoordinatorExecutionHostPorts,
  type CoordinatorExecutionHostAdapterOptions,
} from "./task/host-adapter.ts";
export {
  createCoordinatorTaskRecoveryAdapter,
  type CoordinatorTaskRecoveryHostDependencies,
} from "./task/recovery-adapter.ts";
export {
  COORDINATOR_STATE_QUERY_CONTRACT,
  inspectCoordinatorProjection,
  inspectCoordinatorStateQuery,
  inspectCoordinatorStateQueryResult,
  type CoordinatorStateQuery,
  type CoordinatorStateQueryResult,
} from "./state/query-contract.ts";
export {
  COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT,
  validCoordinatorAcceptanceDecisionRecord,
  validCoordinatorAcceptanceDecisionEnvelope,
  type CoordinatorAcceptanceDecisionEnvelope,
} from "./decision/acceptance-record.ts";
export { validCoordinatorDecisionRecoveryIntent } from "./decision/recovery-record.ts";
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
} from "./decision/public-acceptance.ts";
export {
  executeCoordinatorPublicStateQuery,
  runCoordinatorPublicStateQuery,
} from "./state/public-query.ts";
export { runCoordinatorPublicDecision } from "./decision/public-operation.ts";
export { runCoordinatorPublicObjective } from "./objective/public-operation.ts";
export { observeRuntimeOwnedProjectClientPrincipal } from "./decision/public-operation.ts";
export { readAuthorizedRuntimeActivity } from "./state/activity.ts";
export {
  inspectWorkspaceCommand,
  executeWorkspaceCommand,
  type WorkspaceCommand,
  type WorkspaceView,
} from "./workspace/commands.ts";
export {
  parseRuntimeActivityObservation,
  inspectRuntimeActivityObservation,
} from "./state/activity-validation.ts";
export { createRepositoryTaskRequests } from "./task/request-composition.ts";
export type {
  ActivityRepository,
  ActivitySource,
  RuntimeActivityEvent,
  RuntimeActivityObservation,
  RuntimeActivityRequest,
} from "./state/activity-types.ts";
