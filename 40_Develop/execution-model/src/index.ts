/**
 * execution-modelの完成操作と値契約を公開する。
 * @packageDocumentation
 * @responsibility モデル固有の責務だけを公開し、他モデルを再exportしない。
 * @trace ARCH-000008
 * @boundary 他モデルへの直接依存を持たないPackage境界。
 */
export {
  completeOperation,
  completeRecovery,
  completeRepair,
  observeTransientTaskCompletion,
  readOperationResourcesStage,
  readOperationResult,
  readOwnedRecoveryResult,
  readRecoveryState,
  resumeResourcePublication,
  saveHostCleanupPreparation,
  saveOperationStart,
  saveRecoveryCheckpoint,
  saveResourceNotIssuedStage,
} from "./attempt/crud.ts";
export type {
  ExecutionOperationRecord,
  OperationRecord,
  OperationResources,
  RepairCheckpoint,
  RepairOperationRecord,
  RepairSaveRequest,
  RestartCheckpoint,
} from "./attempt/types.ts";
export {
  applyResourceCleanup,
  applyResourceEvent,
  areTaskResourcesSettled,
  canCloseUnknownAuthentication,
  createDockerRestartRequestId,
  dockerProcessControllerPublicCompletionReasons,
  isDockerRestartCheckpointSettled,
  isRepairCheckpointSettled,
  isRepairDisposalSettled,
  parseDockerTaskRecoveryId,
  parseHostRecoveryToken,
  validateHostRecoveryTransitionLineage,
  validateResourceBook,
  validateResourceBookTransition,
} from "./attempt/validation.ts";
export {
  answerDecision,
  applyDecision,
  closeDecision,
  queryDecisions,
  readDecision,
  recordDecision,
  requestDecision,
} from "./decision/crud.ts";
export type {
  AcceptanceDecision,
  AcceptanceTarget,
  Decision,
  DecisionRequest,
} from "./decision/types.ts";
export { inspectDecision } from "./decision/validation.ts";
export {
  advanceOwnedRecoveryHistory,
  advanceOwnedRepairHistory,
  retireStateRecords,
  transferHistory,
} from "./history/crud.ts";
export {
  createObjective,
  deleteObjective,
  queryObjectives,
  queryPlan,
  savePlan,
  updateObjective,
} from "./objective/crud.ts";
export type {
  ObjectivePlan,
  ProjectMilestoneState,
  ProjectObjectiveDefinition,
} from "./objective/types.ts";
export { inspectExecutionPlan } from "./objective/validation.ts";
export {
  acquireLease,
  initializeExecutionState,
  initializeExecutionStore,
  queryExecutionState,
  readLease,
  readProjectExecutionState,
  recoverLease,
  registerOwnedRecoveryResultDelivery,
  releaseLease,
  resumeRepairPublication,
  saveOperationCheckpoint,
  saveProjectExecutionState,
  saveRepairState,
  saveUnknownAuthenticationClosureStage,
  readState,
} from "./state/crud.ts";
export type {
  ExecutionModelAccess,
  ExecutionStateSnapshot,
  LeaseKind,
  ProjectExecutionState,
  StateVersion,
} from "./state/types.ts";
export {
  createLocalPrincipalId,
  isPrincipalId,
  leaseAcquisitionRecoveryId,
  leaseIdentity,
  OBJECTIVE_STATES,
  PROJECT_STATE_CONTRACT,
  TASK_STATES,
  validId,
} from "./state/validation.ts";
export {
  ExecutionStorageBlockedError,
  readOperationStateStage,
  readSnapshotIntakeEpoch,
  removeStatePublicationMarker,
} from "./storage/store.ts";
export {
  createQueue,
  createTask,
  deleteTask,
  queryQueue,
  queryTasks,
  readQueueEntry,
  readTaskIntakeState,
  selectQueueEntry,
  updateQueue,
  updateTask,
  verifyQueueIntake,
} from "./task/crud.ts";
export type {
  ExecutionSelection,
  ProjectDockerRecoveryAcknowledgement,
  ProjectQueueEntry,
  ProjectQueueState,
  ProjectResultAcceptance,
  ProjectTaskDefinition,
  ProjectTaskRecord,
  ProjectTaskRecoveryKind,
  ProjectTaskRecoveryObligation,
  ProjectTaskResultFact,
  ProjectTaskState,
  QueueEnqueueInput,
  SingleTaskRecord,
  TaskExecutionSelections,
} from "./task/types.ts";
export {
  decodeProjectResultAcceptance,
  getConsumerCompletionPolicy,
  hashExecutionSelection,
  inspectExecutionSelection,
  inspectSingleTaskRecord,
  inspectTaskExecutionSelections,
} from "./task/validation.ts";
export {
  queryWorkspaces,
  saveIntegrationRecord,
  saveWorkspaceRecord,
} from "./workspace/crud.ts";
export type {
  RepositoryWorktreeResult,
  WorkspaceCandidateRequest,
  WorkspaceCandidateResult,
  WorkspaceRecord,
  WorkspaceResult,
} from "./workspace/types.ts";
export {
  inspectWorkspaceResult,
  validWorkspaceCandidateRequest,
  validWorkspaceDisplayName,
} from "./workspace/validation.ts";
