/**
 * execution-modelの完成操作と値契約を公開する。
 * @packageDocumentation
 * @responsibility モデル固有の責務だけを公開し、他モデルを再exportしない。
 * @trace ARCH-000008
 * @boundary 他モデルへの直接依存を持たないPackage境界。
 */
export {
  applyResourceCleanup,
  applyResourceEvent,
  completeOperation,
  readOperationCompletion,
  resumeResourcePublication,
  saveOperationStart,
  saveRecoveryCheckpoint,
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
export { dockerProcessControllerPublicCompletionReasons } from "./attempt/types.ts";
export {
  parseDockerTaskRecoveryId,
  parseHostRecoveryToken,
  validateResourceBook,
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
  advanceOwnedRecoveryHistory,
  completeRecovery,
  completeStatePublication,
  createLocalPrincipalId,
  initializeExecutionState,
  initializeExecutionStore,
  queryExecutionState,
  readLease,
  readProjectExecutionState,
  readState,
  recoverLease,
  releaseLease,
  resumeRepairPublication,
  saveOperationCheckpoint,
  saveProjectExecutionState,
  saveRepairState,
} from "./state/crud.ts";
export type {
  ExecutionModelAccess,
  ExecutionStateSnapshot,
  LeaseKind,
  ProjectExecutionState,
  StateVersion,
} from "./state/types.ts";
export { PROJECT_STATE_CONTRACT } from "./state/types.ts";
export { isPrincipalId } from "./state/validation.ts";
export { ExecutionStorageBlockedError } from "./storage/store.ts";
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
  queryWorkspaces,
  saveIntegrationRecord,
  saveWorkspaceRecord,
} from "./workspace/crud.ts";
export type {
  RepositoryWorktreeResult,
  WorkspaceCandidateRequest,
  WorkspaceCandidateResult,
  WorkspaceRecord,
} from "./workspace/types.ts";
