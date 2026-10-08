/**
 * Orchestratorの公開Application・Contract・Port境界。
 * @packageDocumentation
 * @responsibility Objective、Task、Decision、Recoveryを公開Contractとして提供する。
 * @trace ARCH-000004
 * @boundary TransportとOrchestrator Application・Portの境界。
 * @effect 許可されたPortを介して状態更新または外部実行を発行し得る。
 * @concurrency Task、Queue、Decision、Leaseの世代と競合を調停する。
 * @security 明示されたAuthorityを縮小してTaskとOperationへ結合し、生成や拡張をしない。
 */
export { createOrchestratorAcceptanceAuthorityAdapter } from "./decision/authority-adapter.ts";
export { createOrchestratorDecisionCapabilityAdapter } from "./decision/capability-adapter.ts";
export {
  createOrchestratorExecutionAuthorizationAdapter,
  type OrchestratorExecutionAuthorizationAdapterDependencies,
} from "./task/authorization-adapter.ts";
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
  describeOrchestratorExecutionContract,
  runOrchestratorOperation,
  type OrchestratorExecutionDependencies,
  type OrchestratorExecutionPublicationObservation,
  type OrchestratorExecutionResult,
  type OrchestratorTaskExecution,
} from "./task/dispatch.ts";
export {
  describeOrchestratorIntegrationContract,
  integrateOrchestratorOperation,
} from "./candidate/integrate.ts";
export {
  ORCHESTRATOR_CANDIDATE_ADOPTION_CONTRACT,
  adoptOrchestratorExistingCandidate,
  inspectOrchestratorExistingCandidate,
  type OrchestratorCandidateAdoptionDependencies,
  type OrchestratorCandidateAdoptionInput,
  type OrchestratorCandidateAdoptionResult,
  type OrchestratorExistingCandidate,
} from "./candidate/adopt.ts";
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
  acknowledgeProjectDockerRecoveryObligation,
  applyOrchestratorAcceptanceDecision,
  applyOrchestratorHumanDecision,
  applyOrchestratorPartialReplan,
  createOrchestratorState,
  describeOrchestratorStateContract,
  isOrchestratorObjectiveProjectionCorrelationValid,
  isOrchestratorProjectionSemanticallyValid,
  isOrchestratorRecoveryIdentity,
  markProjectTaskRecoveryObligationRecovering,
  observeProjectTaskStarted,
  prepareProjectTaskHandoff,
  projectOrchestratorState,
  recordProjectTaskOwnerLossRecoveries,
  requestOrchestratorHumanDecision,
  reserveProjectTaskStart,
  retryOrchestratorTask,
  retrySettledProjectTaskRecoveries,
  selectSchedulableProjectTasks,
  settleProjectTask,
  settleProjectTaskBeforeEffect,
  settleProjectTaskRecoveryObligation,
  type ProjectDockerRecoveryAcknowledgement,
  type ProjectMilestoneRecord,
  type ProjectMilestoneState,
  type ProjectObjectiveDefinition,
  type ProjectObjectiveRecord,
  type ProjectObjectiveState,
  type OrchestratorProjection,
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
} from "./state/transitions.ts";
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
  OrchestratorExecutionAuthorizationPort,
  OrchestratorExecutionAuthorizationRequest,
} from "./task/authorization.ts";
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
} from "./candidate/record-writer.ts";
export type {
  OrchestratorCandidateAdoptionReceipt,
  OrchestratorCandidatePort,
  OrchestratorIntegrationCandidate,
} from "./candidate/operations.ts";
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
export {
  ORCHESTRATOR_INTEGRATION_BASE_RESULT_FIELDS,
  ORCHESTRATOR_INTEGRATION_CONTRACT,
  inspectOrchestratorIntegrationResult,
  orchestratorIntegrationResultFields,
} from "./candidate/integration-result.ts";
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
} from "./storage/types.ts";
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
  executeOrchestratorPublicStateQuery,
  runOrchestratorPublicAcceptanceDecision,
  runOrchestratorPublicDecision,
  runOrchestratorPublicObjective,
  runOrchestratorPublicStateQuery,
} from "./operation-composition.ts";
export { observeRuntimeOwnedProjectClientPrincipal } from "./identity/observe-principal.ts";
