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
  saveOperationCheckpoint,
  saveOperationStart,
  saveRecoveryCheckpoint,
  saveRepairRecord,
} from "./attempt/crud.ts";
export {
  applyResourceCleanup,
  applyResourceEvent,
} from "./attempt/transition.ts";
export { validateResourceBook } from "./attempt/validation.ts";
export type {
  ExecutionOperationRecord,
  OperationRecord,
  OperationResources,
  RepairCheckpoint,
  RepairOperationRecord,
  RepairSaveRequest,
  RestartCheckpoint,
} from "./attempt/types.ts";
export { dockerProcessControllerPublicCompletionReasons } from "./attempt/types.ts";
export { parseDockerTaskRecoveryId } from "./attempt/validation.ts";
export {
  answerDecision,
  applyDecision,
  closeDecision,
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
export {
  retireStateRecords,
  saveRecoveryHistory,
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
export { OBJECTIVE_STATES } from "./objective/types.ts";
export { inspectExecutionPlan } from "./objective/validation.ts";
export {
  initializeExecutionState,
  initializeExecutionStore,
  readExecutionState,
  readProjectExecutionState,
  readQueueState,
  readState,
  readWorkspaceState,
  saveProjectExecutionState,
} from "./composition/crud.ts";
export {
  acquireLease,
  readLease,
  readObjectiveAdmission,
  recoverLease,
  releaseLease,
} from "./lease/crud.ts";
export {
  createLocalPrincipalId,
  isPrincipalId,
  leaseAcquisitionRecoveryId,
} from "./composition/validation.ts";
export type {
  ExecutionModelAccess,
  ProjectExecutionInitialization,
  ProjectExecutionState,
  StateVersion,
} from "./composition/types.ts";
export type { LeaseKind } from "./lease/types.ts";
export { PROJECT_STATE_CONTRACT } from "./composition/types.ts";
export { readExecutionStorageBinding } from "./storage/lock.ts";
export {
  ExecutionStorageBlockedError,
  resumeRepairRecordSave,
} from "./storage/store.ts";
export {
  createQueue,
  createTask,
  prepareFirstTask,
  prepareNextTask,
  deleteTask,
  queryQueue,
  queryTasks,
  readQueueEntry,
  selectNextQueueEntry,
  selectAndClaimQueue,
  updateQueue,
  updateTask,
} from "./task/crud.ts";
export type {
  ExecutionSelection,
  ProjectQueueEntry,
  ProjectQueueState,
  ProjectTaskDefinition,
  ProjectTaskRecord,
  ProjectTaskRecoveryKind,
  ProjectTaskRecoveryObligation,
  ProjectTaskState,
  QueueEnqueueInput,
  SingleTaskRecord,
  TaskExecutionSelections,
  TaskStartCandidates,
} from "./task/types.ts";
export { TASK_STATES } from "./task/types.ts";
export {
  beginWorkspaceOperation,
  updateWorkspaceMetadata,
  saveIntegrationRecord,
} from "./workspace/crud.ts";
export type {
  RepositoryWorktreeResult,
  WorkspaceCandidateRequest,
  WorkspaceCandidateResult,
  WorkspaceRecord,
} from "./workspace/types.ts";
