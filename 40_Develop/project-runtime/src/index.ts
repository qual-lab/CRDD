/**
 * Project Runtimeの公開Application・Contract・Port境界。
 * @packageDocumentation
 * @responsibility Objective、Task、Decision、Recoveryを公開Contractとして提供する。
 * @trace ARCH-000004
 * @boundary TransportとProject Runtime Application・Portの境界。
 * @effect 許可されたPortを介して状態更新または外部実行を発行し得る。
 * @concurrency Task、Queue、Decision、Leaseの世代と競合を調停する。
 * @security 明示されたAuthorityを縮小してTaskとOperationへ結合し、生成や拡張をしない。
 */
export {
  PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT,
  createProjectRuntimeObjectiveResult,
  createProjectRuntimeTaskExecutionSet,
  inspectProjectRuntimeObjectivePlan,
  type ProjectRuntimeObjectivePlan,
} from "./application/project-runtime-objective-intake.ts";
export {
  describeProjectRuntimeObjectiveIntakeContract,
  runProjectRuntimeObjectiveApplication,
  type ProjectRuntimeObjectiveApplicationDependencies,
} from "./application/project-runtime-objective-application.ts";
export {
  PROJECT_RUNTIME_REPLANNING_CONTRACT,
  resolveProjectRuntimeReplan,
  type ProjectRuntimeReplanClassifier,
  type ProjectRuntimeReplanDecision,
  type ProjectRuntimeReplanInput,
} from "./application/project-runtime-replanning.ts";
export {
  PROJECT_RUNTIME_EXECUTION_CONTRACT,
  describeProjectRuntimeExecutionContract,
  runProjectRuntimeOperation,
  type ProjectRuntimeExecutionDependencies,
  type ProjectRuntimeExecutionPublicationObservation,
  type ProjectRuntimeExecutionResult,
  type ProjectRuntimeTaskExecution,
} from "./application/project-runtime-execution.ts";
export {
  describeProjectRuntimeIntegrationContract,
  integrateProjectRuntimeOperation,
} from "./application/project-runtime-integration.ts";
export {
  invalidateProjectRuntimeHumanDecision,
  issueProjectRuntimeHumanDecision,
  projectRuntimeDecisionRecordId,
  recoverProjectRuntimeHumanDecision,
  replaceProjectRuntimeHumanDecision,
  submitProjectRuntimeHumanDecision,
} from "./application/project-runtime-human-decision.ts";
export { queryProjectRuntimeState } from "./application/project-runtime-state-query.ts";
export {
  PROJECT_RUNTIME_MAXIMUM_CONCURRENCY,
  PROJECT_RUNTIME_MAXIMUM_OBJECTIVES,
  PROJECT_RUNTIME_MAXIMUM_TASKS,
  PROJECT_RUNTIME_STATE_CONTRACT,
  acknowledgeProjectDockerRecoveryObligation,
  applyProjectRuntimeHumanDecision,
  applyProjectRuntimePartialReplan,
  createProjectRuntimeState,
  describeProjectRuntimeStateContract,
  isProjectRuntimeObjectiveProjectionCorrelationValid,
  isProjectRuntimeProjectionSemanticallyValid,
  isProjectRuntimeRecoveryIdentity,
  markProjectTaskRecoveryObligationRecovering,
  observeProjectTaskStarted,
  prepareProjectTaskHandoff,
  projectProjectRuntimeState,
  recordMilestoneIntegration,
  recordObjectiveIntegration,
  recordProjectTaskOwnerLossRecoveries,
  requestProjectRuntimeHumanDecision,
  reserveProjectTaskStart,
  retryProjectRuntimeTask,
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
  type ProjectRuntimeProjection,
  type ProjectRuntimeState,
  type ProjectTaskDefinition,
  type ProjectTaskRecord,
  type ProjectTaskRecoveryKind,
  type ProjectTaskRecoveryObligation,
  type ProjectTaskStartPhase,
  type ProjectTaskState,
} from "./core/project-runtime-state.ts";
export type {
  ProjectQueueEntry,
  ProjectQueueState,
} from "./core/project-runtime-queue.ts";
export {
  PROJECT_RUNTIME_PLATFORM_BOUNDARIES,
  PROJECT_RUNTIME_PLATFORM_BOUNDARY_GUARANTEES,
  PROJECT_RUNTIME_PLATFORM_BOUNDARY_OPERATIONS,
  PROJECT_RUNTIME_PLATFORM_CONTRACT,
  PROJECT_RUNTIME_PLATFORM_CONTRACT_REVISION,
  describeProjectRuntimePlatformContract,
  resolveProjectRuntimePlatformAdapter,
  type ProjectRuntimePlatformAdapter,
  type ProjectRuntimePlatformAdapterDescription,
  type ProjectRuntimePlatformBoundary,
  type ProjectRuntimePlatformGuarantee,
  type ProjectRuntimePlatformResolution,
} from "./ports/platform-contract.ts";
export {
  PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT,
  PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT_REVISION,
  type ProjectRuntimeExecutionPort,
  type ProjectRuntimeSingleTaskAttemptInput,
  type ProjectRuntimeSingleTaskRecoveryObligation,
  type ProjectRuntimeSingleTaskResult,
} from "./ports/execution-port.ts";
export type {
  ProjectRuntimeExecutionAuthorizationPort,
  ProjectRuntimeExecutionAuthorizationRequest,
} from "./ports/execution-authorization-port.ts";
export type {
  ProjectRuntimeExecutionObservationPort,
  ProjectRuntimeExecutionObservationPublication,
  ProjectRuntimeTaskAttemptObservation,
} from "./ports/execution-observation-port.ts";
export type {
  ProjectRuntimeIntegrationRecord,
  ProjectRuntimeIntegrationRecordPort,
} from "./ports/integration-record-port.ts";
export type {
  ProjectRuntimeCandidateAdoptionReceipt,
  ProjectRuntimeCandidatePort,
  ProjectRuntimeIntegrationCandidate,
} from "./ports/candidate-port.ts";
export type {
  ProjectRuntimeClockIdentityPort,
  ProjectRuntimeClockReading,
} from "./ports/clock-identity-port.ts";
export {
  isProjectRuntimeDecisionRecord,
  type ProjectRuntimeDecisionPort,
  type ProjectRuntimeDecisionRecord,
  type ProjectRuntimeDecisionRecoveryIntent,
  type ProjectRuntimeDecisionRecoveryStore,
  type ProjectRuntimeDecisionStore,
} from "./ports/decision-port.ts";
export type {
  ProjectRuntimeDecisionCapability,
  ProjectRuntimeDecisionCapabilityPort,
} from "./ports/decision-capability-port.ts";
export type {
  ProjectRuntimeLease,
  ProjectRuntimeLeaseAcquisitionResolution,
  ProjectRuntimeLeaseKind,
  ProjectRuntimeLeaseOwnerObservation,
  ProjectRuntimeLeasePort,
} from "./ports/lease-port.ts";
export type { ProjectRuntimePortResult } from "./ports/port-result.ts";
export type { ProjectRuntimeProcessSafetyPort } from "./ports/process-safety-port.ts";
export type {
  ProjectRuntimePersistencePorts,
  ProjectRuntimeQueueEnqueueInput,
  ProjectRuntimeQueueUpdate,
  ProjectRuntimeStatePort,
} from "./ports/state-port.ts";
export type {
  ProjectRuntimeDockerRecoveryIdentity,
  ProjectRuntimeRecoveryTransition,
  ProjectRuntimeTaskRecoveryPort,
} from "./ports/task-recovery-port.ts";
export {
  PROJECT_RUNTIME_INTEGRATION_BASE_RESULT_FIELDS,
  PROJECT_RUNTIME_INTEGRATION_CONTRACT,
  inspectProjectRuntimeIntegrationResult,
  projectRuntimeIntegrationResultFields,
} from "./public-contract/integration-result.ts";
export {
  inspectProjectRuntimeObjectiveRequest,
  type ProjectRuntimeObjectiveRequest,
} from "./public-contract/objective-request.ts";
export {
  PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
  inspectProjectRuntimeDecisionRequest,
  type ProjectRuntimeDecisionRequest,
} from "./public-contract/decision-request.ts";
export { PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT } from "./public-contract/runtime-result.ts";
export {
  PROJECT_RUNTIME_STATE_QUERY_CONTRACT,
  inspectProjectRuntimeProjection,
  inspectProjectRuntimeStateQuery,
  inspectProjectRuntimeStateQueryResult,
  type ProjectRuntimeStateQuery,
  type ProjectRuntimeStateQueryResult,
} from "./public-contract/project-state-query.ts";
