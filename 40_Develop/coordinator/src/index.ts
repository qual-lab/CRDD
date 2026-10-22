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
export { acquireRuntimeOwnedOrchestratorStateKernelLock } from "./execution/kernel-lock.ts";
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

export { createOrchestratorAcceptanceAuthorityAdapter } from "./decision/authority-adapter.ts";
export {
  manageOrchestratorWorkspace,
  resolveOrchestratorWorkspaceTaskTarget,
  type OrchestratorWorkspaceRequest,
} from "./workspace/operations.ts";
export type { OrchestratorWorkspace } from "./workspace/record.ts";
export { createOrchestratorDecisionCapabilityAdapter } from "./decision/capability-adapter.ts";
export {
  ORCHESTRATOR_ACCEPTANCE_DECISION_CONTRACT,
  recordOrchestratorAcceptanceDecision,
  type OrchestratorAcceptanceDecisionDependencies,
  type OrchestratorAcceptanceDecisionRequest,
  type OrchestratorAcceptanceDecisionResult,
} from "./decision/record-acceptance.ts";
export {
  ORCHESTRATOR_OBJECTIVE_INTAKE_CONTRACT,
  createOrchestratorObjectiveResult,
  createOrchestratorTaskExecutionSet,
  inspectOrchestratorObjectivePlan,
  inspectOrchestratorWorkspaceResults,
  type OrchestratorObjectivePlan,
} from "./objective/plan.ts";
export {
  describeOrchestratorObjectiveIntakeContract,
  executeOrchestratorObjective,
  type OrchestratorObjectiveExecutionDependencies,
} from "./objective/execute.ts";
export {
  ORCHESTRATOR_REPLANNING_CONTRACT,
  resolveOrchestratorReplan,
  type OrchestratorReplanClassifier,
  type OrchestratorReplanDecision,
  type OrchestratorReplanInput,
} from "./objective/replan.ts";
export {
  ORCHESTRATOR_EXECUTION_CONTRACT,
  type OrchestratorExecutionDependencies,
  type OrchestratorExecutionPublicationObservation,
  type OrchestratorExecutionResult,
  type OrchestratorTaskExecution,
} from "./task/execution-contract.ts";
export {
  describeOrchestratorExecutionContract,
  runOrchestratorOperation,
} from "./task/dispatch.ts";
export {
  invalidateOrchestratorHumanDecision,
  issueOrchestratorHumanDecision,
  orchestratorDecisionRecordId,
  recoverOrchestratorHumanDecision,
  replaceOrchestratorHumanDecision,
  submitOrchestratorHumanDecision,
} from "./decision/lifecycle.ts";
export { queryOrchestratorState } from "./state/query.ts";
export {
  ORCHESTRATOR_MAXIMUM_CONCURRENCY,
  ORCHESTRATOR_MAXIMUM_OBJECTIVES,
  ORCHESTRATOR_MAXIMUM_TASKS,
  ORCHESTRATOR_STATE_CONTRACT,
  createOrchestratorState,
  describeOrchestratorStateContract,
  isOrchestratorRecoveryIdentity,
  type ProjectDockerRecoveryAcknowledgement,
  type ProjectMilestoneRecord,
  type ProjectMilestoneState,
  type ProjectObjectiveDefinition,
  type ProjectObjectiveRecord,
  type ProjectObjectiveState,
  type OrchestratorAcceptanceDecision,
  type OrchestratorAcceptanceDecisionInput,
  type OrchestratorAcceptanceTarget,
  type OrchestratorState,
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
  applyOrchestratorAcceptanceDecision,
  applyOrchestratorHumanDecision,
  requestOrchestratorHumanDecision,
} from "./decision/transitions.ts";
export {
  applyOrchestratorPartialReplan,
  retryOrchestratorTask,
} from "./objective/replan-transitions.ts";
export {
  isOrchestratorObjectiveProjectionCorrelationValid,
  isOrchestratorProjectionSemanticallyValid,
  projectOrchestratorState,
  type OrchestratorProjection,
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
  ORCHESTRATOR_PLATFORM_BOUNDARIES,
  ORCHESTRATOR_PLATFORM_BOUNDARY_GUARANTEES,
  ORCHESTRATOR_PLATFORM_BOUNDARY_OPERATIONS,
  ORCHESTRATOR_PLATFORM_CONTRACT,
  ORCHESTRATOR_PLATFORM_CONTRACT_REVISION,
  describeOrchestratorPlatformContract,
  resolveOrchestratorPlatformAdapter,
  type OrchestratorPlatformAdapter,
  type OrchestratorPlatformAdapterDescription,
  type OrchestratorPlatformBoundary,
  type OrchestratorPlatformGuarantee,
  type OrchestratorPlatformResolution,
} from "./platform/contract.ts";
export {
  ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT,
  ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT_REVISION,
  type OrchestratorExecutionPort,
  type OrchestratorSingleTaskAttemptInput,
  type OrchestratorSingleTaskRecoveryObligation,
  type OrchestratorSingleTaskResult,
} from "./task/executor.ts";
export type {
  OrchestratorAcceptanceDecisionAuthorityBinding,
  OrchestratorAcceptanceDecisionAuthorityPort,
  OrchestratorAcceptanceDecisionRecord,
  OrchestratorAcceptanceDecisionStore,
} from "./decision/acceptance-authority.ts";
export type {
  OrchestratorExecutionObservationPort,
  OrchestratorExecutionObservationPublication,
  OrchestratorTaskAttemptObservation,
} from "./task/observer.ts";
export {
  createOrchestratorTaskAttemptEvent,
  recordOrchestratorExecutionEvent,
} from "./task/intelligence-adapter.ts";
export type {
  OrchestratorIntegrationRecord,
  OrchestratorIntegrationRecordPort,
} from "./storage/result-record.ts";
export type {
  OrchestratorClockIdentityPort,
  OrchestratorClockReading,
} from "./identity/clock-and-hash.ts";
export {
  isOrchestratorDecisionRecord,
  type OrchestratorDecisionPort,
  type OrchestratorDecisionRecord,
  type OrchestratorDecisionRecoveryIntent,
  type OrchestratorDecisionRecoveryStore,
  type OrchestratorDecisionStore,
} from "./decision/records.ts";
export type {
  OrchestratorDecisionCapability,
  OrchestratorDecisionCapabilityPort,
} from "./decision/capability.ts";
export type {
  OrchestratorLease,
  OrchestratorLeaseAcquisitionResolution,
  OrchestratorLeaseKind,
  OrchestratorLeaseOwnerObservation,
  OrchestratorLeasePort,
} from "./lease/controller.ts";
export type { OrchestratorPortResult } from "./operation-result.ts";
export type { OrchestratorProcessSafetyPort } from "./process/safety-contract.ts";
export type {
  OrchestratorPersistencePorts,
  OrchestratorQueueEnqueueInput,
  OrchestratorQueueUpdate,
  OrchestratorStatePort,
} from "./state/persistence.ts";
export type {
  OrchestratorDockerRecoveryIdentity,
  OrchestratorRecoveryTransition,
  OrchestratorTaskRecoveryPort,
} from "./task/recovery.ts";
export { ORCHESTRATOR_INTEGRATION_CONTRACT } from "./storage/result-record.ts";
export {
  inspectOrchestratorObjectiveRequest,
  type OrchestratorObjectiveRequest,
} from "./objective/request.ts";
export {
  ORCHESTRATOR_HUMAN_DECISION_CONTRACT,
  inspectOrchestratorDecisionRequest,
  type OrchestratorDecisionRequest,
} from "./decision/request.ts";
export { ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT } from "./operation-result-contract.ts";
export {
  runOrchestratorSingleTaskAttempt,
  describeOrchestratorSingleTaskAdapterContract,
  ORCHESTRATOR_SINGLE_TASK_PRE_EFFECT_REJECTIONS,
  type OrchestratorSingleTaskDependencies,
} from "./task/execute-attempt.ts";
export {
  createOrchestratorExecutionHostPorts,
  type OrchestratorExecutionHostAdapterOptions,
} from "./task/host-adapter.ts";
export {
  createOrchestratorTaskRecoveryAdapter,
  type OrchestratorTaskRecoveryHostDependencies,
} from "./task/recovery-adapter.ts";
export {
  ORCHESTRATOR_STATE_QUERY_CONTRACT,
  inspectOrchestratorProjection,
  inspectOrchestratorStateQuery,
  inspectOrchestratorStateQueryResult,
  type OrchestratorStateQuery,
  type OrchestratorStateQueryResult,
} from "./state/query-contract.ts";
export {
  ORCHESTRATOR_ACCEPTANCE_DECISION_STORE_CONTRACT,
  validOrchestratorAcceptanceDecisionRecord,
  validOrchestratorAcceptanceDecisionEnvelope,
  type OrchestratorAcceptanceDecisionEnvelope,
} from "./decision/acceptance-record.ts";
export { validOrchestratorDecisionRecoveryIntent } from "./decision/recovery-record.ts";
export { validOrchestratorResultRecord } from "./storage/validate-result-record.ts";
export type {
  IntegrationRecordBinding,
  OrchestratorResultRecord,
} from "./storage/result-record.ts";
export {
  createCurrentOrchestratorPersistencePorts,
  createOrchestratorSnapshotPersistencePorts,
  inspectOrchestratorSnapshotIntake,
  readCurrentOrchestratorState,
  readOrchestratorSnapshot,
  initializeOrchestratorSnapshot,
  maintainOrchestratorSnapshot,
  createOrchestratorSnapshotAcceptanceDecisionStore,
  createOrchestratorSnapshotDecisionRecoveryStore,
  createOrchestratorSnapshotIntegrationRecordPort,
} from "./storage/current-state.ts";
export {
  executeOrchestratorPublicAcceptanceDecision,
  runOrchestratorPublicAcceptanceDecision,
} from "./decision/public-acceptance.ts";
export {
  executeOrchestratorPublicStateQuery,
  runOrchestratorPublicStateQuery,
} from "./state/public-query.ts";
export { runOrchestratorPublicDecision } from "./decision/public-operation.ts";
export { runOrchestratorPublicObjective } from "./objective/public-operation.ts";
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
