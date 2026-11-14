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
  validateResourceBook,
} from "./attempt/operations.ts";
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
export {
  parseDockerTaskRecoveryId,
  parseHostRecoveryToken,
} from "./attempt/validation.ts";
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
export { inspectDecision } from "./decision/validation.ts";
export {
  saveRecoveryHistory,
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
export { OBJECTIVE_STATES } from "./objective/types.ts";
export { inspectExecutionPlan } from "./objective/validation.ts";
export {
  acquireLease,
  initializeExecutionState,
  initializeExecutionStore,
  readLease,
  readProjectExecutionState,
  readState,
  recoverLease,
  releaseLease,
  saveProjectExecutionState,
} from "./state/crud.ts";
export type {
  ExecutionModelAccess,
  ExecutionStateSnapshot,
  LeaseKind,
  ProjectExecutionState,
  StateVersion,
} from "./state/types.ts";
export { PROJECT_STATE_CONTRACT } from "./state/types.ts";
export {
  createLocalPrincipalId,
  isPrincipalId,
} from "./state/validation.ts";
export { resumeRepairRecordSave } from "./storage/publication.ts";
export { ExecutionStorageBlockedError } from "./storage/store.ts";
export {
  createQueue,
  createTask,
  deleteTask,
  queryQueue,
  queryTasks,
  readQueueEntry,
  selectQueueEntry,
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
  ProjectTaskResultFact,
  ProjectTaskState,
  QueueEnqueueInput,
  SingleTaskRecord,
  TaskExecutionSelections,
} from "./task/types.ts";
export { TASK_STATES } from "./task/types.ts";
export {
  inspectExecutionSelection,
  inspectTaskExecutionSelections,
} from "./task/validation.ts";
export {
  saveIntegrationRecord,
  saveWorkspaceRecord,
} from "./workspace/crud.ts";
export type {
  RepositoryWorktreeResult,
  WorkspaceCandidateRequest,
  WorkspaceCandidateResult,
  WorkspaceRecord,
} from "./workspace/types.ts";
