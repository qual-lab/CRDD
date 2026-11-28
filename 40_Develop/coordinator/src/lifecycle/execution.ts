/**
 * 単発依頼とObjectiveの受付、進行、待機、取消、終了を所有する。
 * @responsibility 単発受付、試行の開始・通知・終結、再入場を順序づけ、永続保存と技術処置は専門Ownerへ委譲する。
 * @trace ARCH-000004
 * @trace ARCH-000015
 */

import { createHash, randomUUID } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import {
  getRepository,
  readRepositoryRevision,
  type Repository,
  resolveVerifiedRepositoryRoot,
  readRepositorySnapshot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
} from "@qual-lab/crdd-version-control";
import {
  createGroup,
  completeGroup,
} from "@qual-lab/crdd-execution-intelligence";
import {
  type SingleTaskRecord,
  type TaskExecutionSelections,
  createQueue,
  prepareFirstTask,
  prepareNextTask,
  initializeExecutionStore,
  isPrincipalId,
  leaseAcquisitionRecoveryId,
  readState,
  readExecutionState,
  readQueueState,
  readWorkspaceState,
  saveProjectExecutionState,
  selectNextQueueEntry,
  selectAndClaimQueue,
  readObjectiveAdmission,
  updateQueue,
  type ProjectQueueEntry,
  type ProjectExecutionState,
  type ProjectTaskRecoveryKind,
  ExecutionStorageBlockedError,
  readProjectExecutionState,
  readQueueEntry,
  type ProjectExecutionInitialization,
  type ProjectTaskRecoveryObligation,
  retireStateRecords,
  parseDockerTaskRecoveryId,
  type TaskStartCandidates,
  type ExecutionSelection,
} from "@qual-lab/crdd-execution-model";
import {
  snapshotPlainRecord,
  snapshotSingleTaskOutcome,
  createCoordinatorStableId,
  createProjectRecoveryApplicationId,
  isCoordinatorRecoveryIdentity,
  validIdentity,
  validRevision,
  inspectStartedTask,
  inspectCompletionRecord,
  evaluateManagedDockerCleanupEligibility,
  inspectWorkspaceResult,
  inspectTaskStartCandidates,
  captureTaskStartCandidates,
  inspectSingleTaskCommand,
  readExecutionCancellation,
  deriveCoordinatorRepositoryBindingId,
  objectiveQueueId,
  buildObjectiveTaskExecutions,
  COORDINATOR_OBJECTIVE_INTAKE_CONTRACT,
  COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
  hashCoordinatorContent,
  inspectCoordinatorWorkspaceResults,
  inspectCoordinatorObjectiveRequest,
  projectCoordinatorState,
  snapshotPlainArray,
  COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS,
  createTaskStageDiagnostic,
  projectExecutorResultDiagnostics,
  projectProviderTurnObservation,
  projectReviewerProjectionEvidence,
  projectReviewerResultDiagnostics,
  type ProviderBoundaryDiagnosticNotice,
  projectCoordinatorTaskPublicReason,
  projectCurrentDockerAdmission,
  type CoordinatorTaskPublicReason,
  resolveRecoveryReference,
  inspectRecoveryStartFailureDiagnostic,
  ownDataValue,
  resolveRecoveryStartReason,
  snapshotBlockedRecoveryWithExactId,
  snapshotReadyRecovery,
  snapshotCoordinatorTaskRequest,
} from "./validation.ts";
import {
  COORDINATOR_EXECUTION_CONTRACT,
  COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT,
  type CoordinatorSingleTaskAttemptInput,
  type CoordinatorLease,
  type CoordinatorExecutionDependencies,
  type CoordinatorExecutionResult,
  type CoordinatorSingleTaskResult,
  type CoordinatorStateContext,
  type CoordinatorTaskExecution,
  type ExecutionInput,
  type ObjectiveExecutionRecording,
  type SingleTaskCommand,
  type SingleTaskExecution,
  type SingleTaskOutcome,
  type WorkspaceResult,
  type CoordinatorObjectiveExecutionDependencies,
  type CoordinatorObjectiveRequest,
  type HostCompletionTarget,
  type ProviderAdviceRuntimeResult,
  type ProviderAdviceExecutionInput,
  type ProviderExecutionRecording,
  type CoordinatorAiRequestInput,
  type CoordinatorAiRequestResult,
  type BorrowedExecutionTarget,
  type PreparedWorkspaceTarget,
  type PreparationInput,
  type PreparedAttemptPlan,
  type RecoveryStartFailureNotice,
  type RecoveryStartFailureDiagnostic,
  type RecordedStartResult,
  type RecordedAttemptResult,
  type ResourceCleanupResult,
  type Recovery,
} from "./types.ts";
import type {
  ProcessStartedNotice,
  CompletionResult,
  ExecutorCallbacks,
  StartResult,
  AttemptTerminalObservation,
} from "@qual-lab/crdd-executor";
import {
  getExecutionIntelligenceStore,
  type HostOperationRecording,
  inspectBorrowedExecutionTarget,
  acquireHostOperationRecoveryGeneration,
  borrowCoordinatorRecoveryRepository,
  recoveryStorageInput,
  borrowCoordinatorStateRepository,
  verifyRepositoryOperation,
  recoverOwnedOperationDirectories,
  releaseHostOperationRecoveryGeneration,
  resolveExecutionStorageDirectory,
  acquireCoordinatorSnapshotLease,
  createExecutionProcessRecoveryIdentity,
  poisonExecutionProcessAfterCleanupUnknown,
  settleCoordinatorSnapshotQueueLeaseRelease,
  updateCoordinatorQueue,
  writerLeaseAccess,
  updateCoordinatorSingleTask,
  observeLeaseOwner,
  reconcileCoordinatorSnapshotLeaseOwnerLoss,
  coordinatorDataBoundaryBlocked,
  RepositoryDataBlockedError,
  historyRepositoryInput,
  getExecutionProcessInstanceIdentity,
  inspectCoordinatorSnapshotLeaseAcquisitionOwner,
  waitForStateContention,
  type StateContentionResult,
  isCleanStateContention,
  confirmStorageContinuation,
  inspectExecutionProcessRecoveryIdentity,
  observeObjectiveLeaseOwner,
  prepareExecutionStorageIgnore,
  isExecutionProcessPoisoned,
  bindRepositoryOperation,
  classifyOwnedCoordinatorOperationCreationFailure,
  bindExecutionWorkspace,
  inspectRepositoryObjectFormatCandidate,
  productionOperationFailure,
  projectBorrowedExecutionResult,
  prepareReviewerWorkspace,
  throwProductionOperationFailure,
  matchDockerHandoff,
  recordDockerHandoffCompletion,
  registerDockerHandoff,
} from "./host.ts";
import {
  resolveSingleTaskSelection,
  resolveObjectiveTaskSelections,
  preflightDelegationSelections,
  type AdviceTaskPacket,
  capturePreparationInput,
  createPreparationFailure,
  issueProviderAdvicePacket,
  issueProviderTaskPacket,
  prepareAdviceTask,
  prepareProviderAdviceInput,
  prepareProviderAttempt,
  revokeProviderAdvicePacket,
  revokeProviderTaskPacket,
} from "./selection.ts";
import {
  finishProviderExecutionRecordings,
  beginProviderExecutionRecording,
  captureProviderExecutionCompletion,
  reportExecutionRecording,
  reportExecutionRecordingUnavailable,
  writeCoordinatorRecoveryDiagnostic,
  inspectWindowsProviderHomeCandidate,
  observeExecutionCompletion,
  openExecutionHost,
  projectDockerRepairObservation,
  recoverDockerIsolationProbe,
  executeDockerRepair,
  createLifecycleNoticeReporter,
  recoverDockerTaskForCurrentConsumer,
  resolveDockerTaskCurrentCorrelations,
  cancelExecutorAttempt,
  completeHostOperation,
  retainHostOperation,
  abandonDockerRecovery,
  beginDockerRecovery,
  bindDockerInitializationFailure,
  bindExecutorAttempt,
  recordAttemptCleanup,
  recordDockerProviderSubmission,
  recordDockerResourceNotIssued,
  recordDockerResourceEvent,
  recordDockerTerminalObservation,
  recordUnstartedAttempt,
  verifyDockerRecoveryBinding,
  inspectDockerTaskAdmission,
  registerReviewFindings,
} from "./environment.ts";
import { types, isDeepStrictEqual } from "node:util";
import {
  capturePreparedWorkspaceTarget,
  confirmPreparedWorkspaceTarget,
  workspacePlanReadyForAcceptance,
} from "./workspace.ts";
import { createFilesystemRepositoryObservationPort } from "@qual-lab/crdd-document-model";
import {
  readRepositoryNetworkHosts,
  resolveExternalSendPolicy,
} from "./decision.ts";

/** 受付時の試行相関。操作IDは実行に使うコピーから返す。 @trace ARCH-000004 */
type TaskAttemptIdentity = Pick<
  CoordinatorSingleTaskResult,
  "attemptId" | "authorityBindingId" | "repositoryRevision"
>;

/**
 * 下位Task開始で外部・保存処置を行う前に確定する拒否を定義する。
 * @responsibility 実際の開始前拒否だけを未実行に分類し、それ以外の同期例外を実行不明として扱う。
 * @trace ARCH-000004
 */
export const COORDINATOR_SINGLE_TASK_PRE_EFFECT_REJECTIONS = Object.freeze([
  "coordinator_task_process_restart_required",
  "coordinator_task_workspace_target_invalid",
] as const);

const preEffectRejectionSet: ReadonlySet<string> = new Set(
  COORDINATOR_SINGLE_TASK_PRE_EFFECT_REJECTIONS,
);

/**
 * singleTaskAttemptResultを決定する。
 *
 * @responsibility singleTaskAttemptResultの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input 受付した試行相関と、実行結果の各項目。
 * @returns CoordinatorSingleTaskResultを返す。
 * @precondition 受付前の拒否に限り試行相関はnullとする。
 * @postcondition singleTaskAttemptResultの責務を完了した結果だけを返す。
 * @effect N/A: singleTaskAttemptResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: singleTaskAttemptResultは独自の失敗分岐を所有しない。
 * @invariant singleTaskAttemptResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security singleTaskAttemptResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: singleTaskAttemptResultは共有非同期状態を持たない同期処理である。
 */
function singleTaskAttemptResult(
  identity: TaskAttemptIdentity | null,
  input: Omit<
    CoordinatorSingleTaskResult,
    "contract" | keyof TaskAttemptIdentity
  >,
): CoordinatorSingleTaskResult {
  return Object.freeze({
    contract: COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT,
    ...input,
    recoveryIds: Object.freeze([...input.recoveryIds]),
    recoveryObligations: Object.freeze([...(input.recoveryObligations ?? [])]),
    attemptId: identity === null ? null : identity.attemptId,
    authorityBindingId: identity === null ? null : identity.authorityBindingId,
    repositoryRevision: identity === null ? null : identity.repositoryRevision,
  });
}

/**
 * rejected Without Effectを決定する。
 *
 * @responsibility rejected Without Effectの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input 試行相関、操作ID、理由、Process再起動要否。
 * @returns CoordinatorSingleTaskResultを返す。
 * @precondition 「operationId: string | null、reason: string、processRestartRequired」がrejectedWithoutEffectの入力契約を満たす。
 * @postcondition rejectedWithoutEffectの責務を完了した結果だけを返す。
 * @effect N/A: rejectedWithoutEffectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: rejectedWithoutEffectは独自の失敗分岐を所有しない。
 * @invariant rejectedWithoutEffectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security rejectedWithoutEffectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: rejectedWithoutEffectは共有非同期状態を持たない同期処理である。
 */
function rejectedWithoutEffect(
  identity: TaskAttemptIdentity | null,
  operationId: string | null,
  reason: string,
  processRestartRequired = false,
): CoordinatorSingleTaskResult {
  return singleTaskAttemptResult(identity, {
    operationId,
    status: "blocked",
    reason,
    effectState: "no_effect",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired,
    candidateId: null,
    recoveryIds: [],
  });
}

/**
 * failed Closed Unknownを決定する。
 *
 * @responsibility failed Closed Unknownの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input 受付した試行相関、操作ID、理由。
 * @returns CoordinatorSingleTaskResultを返す。
 * @precondition 「operationId: string | null、reason: string」がfailedClosedUnknownの入力契約を満たす。
 * @postcondition failedClosedUnknownの責務を完了した結果だけを返す。
 * @effect N/A: failedClosedUnknownは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: failedClosedUnknownは独自の失敗分岐を所有しない。
 * @invariant failedClosedUnknownは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security failedClosedUnknownはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: failedClosedUnknownは共有非同期状態を持たない同期処理である。
 */
function failedClosedUnknown(
  identity: TaskAttemptIdentity,
  operationId: string | null,
  reason: string,
): CoordinatorSingleTaskResult {
  return singleTaskAttemptResult(identity, {
    operationId,
    status: "blocked",
    reason,
    effectState: "unknown",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: false,
    candidateId: null,
    recoveryIds: [],
  });
}

const SETTLED_RUNTIME_CANCELLATION_REASONS = new Set([
  "coordinator_task_cancelled_before_stage_start",
  "coordinator_task_cancelled_after_provider_cleanup",
  "coordinator_task_cancelled_during_operation_creation",
  "coordinator_task_cancelled_during_external_send_authorization",
  "coordinator_task_cancelled_before_candidate_capture",
  "coordinator_task_cancelled_before_independent_review",
]);

/** 共通Task開始へ渡す用途とHost情報。 @trace ARCH-000004 */
type TaskStartContext = Readonly<{
  consumer: NonNullable<Parameters<typeof startCoordinatorTask>[4]>;
  hostInput?: HostOperationRecording;
}>;

/**
 * 一つのTask試行を開始し、完了と取消を同じ制御参照へ接続する。
 *
 * @responsibility Coordinator Single Task Attemptの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawInput: CoordinatorSingleTaskAttemptInputと開始時の用途情報。
 * @returns Promise<CoordinatorSingleTaskResult>を返す。
 * @precondition 共有Attempt入力を受け取り、実行対象をこの境界で照合する。
 * @postcondition 受付した試行相関と実行・回収の結果を一度だけ組み立てる。
 * @effect 既存Task入口で単一Taskを開始し、同じ制御参照へ取消要求を渡し得る。
 * @failure 受付、実行用コピー、下位開始・完了・回収の拒否や不明を区別する。
 * @invariant 元開始通知の保存を待ち、別の実行に切り替えない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security Authority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency 同じ制御参照の完了・取消と最初の開始保存を待つ。
 */
export async function runCoordinatorSingleTaskAttempt(
  rawInput: CoordinatorSingleTaskAttemptInput,
  startContext?: TaskStartContext,
): Promise<CoordinatorSingleTaskResult> {
  const ids =
    rawInput && typeof rawInput === "object"
      ? [rawInput.attemptId, rawInput.operationId, rawInput.authorityBindingId]
      : [];
  const isValidInput =
    ids.length === 3 &&
    ids.every(validIdentity) &&
    validRevision(rawInput.repositoryRevision) &&
    rawInput.cancellationSignal instanceof AbortSignal &&
    (rawInput.observeStarted === undefined ||
      typeof rawInput.observeStarted === "function");
  if (!isValidInput)
    return rejectedWithoutEffect(null, null, "single_task_input_invalid");
  const identity = {
    attemptId: rawInput.attemptId,
    authorityBindingId: rawInput.authorityBindingId,
    repositoryRevision: rawInput.repositoryRevision,
  };
  const input = { ...rawInput };
  // コピーが受付時と異なる場合も、実際に使う操作ID・Signal・通知型を検査する。
  if (
    !validIdentity(input.operationId) ||
    !(input.cancellationSignal instanceof AbortSignal) ||
    (input.observeStarted !== undefined &&
      typeof input.observeStarted !== "function")
  )
    return rejectedWithoutEffect(identity, null, "single_task_input_invalid");
  const operationId = input.operationId;
  const workspaceTarget =
    input.workspaceTarget === undefined
      ? undefined
      : inspectBorrowedExecutionTarget(
          input.repositoryRoot,
          input.workspaceTarget,
        );
  if (workspaceTarget === null)
    return rejectedWithoutEffect(
      identity,
      operationId,
      "single_task_workspace_target_invalid",
    );
  if (input.cancellationSignal.aborted)
    return singleTaskAttemptResult(identity, {
      operationId,
      status: "cancelled",
      reason: "single_task_cancelled_before_effect",
      effectState: "no_effect",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      candidateId: null,
      recoveryIds: [],
    });
  let rawStarted: unknown;
  let isNotificationClosed = false;
  let firstStartObservation: Promise<void> | null = null;
  let notificationFailed = false;
  const observeStarted = input.observeStarted;
  /**
   * 同じTaskの初回Executor開始だけを上位保存へ搬送する。
   *
   * @responsibility 呼出し登録による相関、初回通知の直列化と終端後拒否を所有する。
   * @trace ARCH-000004
   * @input Controllerが観測したProvider接続用Host Processの開始通知。
   * @returns 必要な上位処置の完了を待つ。保存結果は返さない。
   * @precondition 通知は同じTask開始時に登録したController経路から届く。
   * @postcondition Reviewerや是正Executorで上位状態を二重更新しない。
   * @effect 登録済みの上位開始確認を一回呼び出す。
   * @failure 不正通知、終端後通知、上位処置失敗は例外。最終結果には既存の失敗状態を保持する。
   * @invariant 下位OP識別子を上位Operation IDと同一視しない。
   * @boundary CoordinatorのProcess開始通知と利用側の状態保存。
   * @security 通知はAuthorityやAI要求受理の証明ではない。
   * @concurrency 同時・重複通知は同じ保存Promiseへ結合する。
   */
  const forwardStarted = (notice: ProcessStartedNotice): Promise<void> => {
    if (isNotificationClosed || input.cancellationSignal.aborted)
      return Promise.reject(Error("single_task_start_notification_closed"));
    if (
      notice?.event !== "coordinator_provider_process_started" ||
      !validIdentity(notice.operationId) ||
      (notice.provider !== "codex" && notice.provider !== "claude") ||
      (notice.taskRole !== "executor" && notice.taskRole !== "reviewer")
    ) {
      notificationFailed = true;
      return Promise.reject(Error("single_task_start_notification_failed"));
    }
    if (notice.taskRole === "reviewer")
      return (
        firstStartObservation ??
        Promise.reject(Error("single_task_start_notification_missing"))
      );
    if (firstStartObservation === null) {
      firstStartObservation = Promise.resolve().then(async () => {
        try {
          await observeStarted?.();
        } catch {
          notificationFailed = true;
          throw Error("single_task_start_notification_failed");
        }
      });
      // 元の拒否を呼出し側と最終joinへ保持し、Owner自身も直ちに捕捉する。
      void firstStartObservation.catch(() => {});
    }
    return firstStartObservation;
  };
  try {
    rawStarted = startCoordinatorTask(
      input.taskRequest,
      input.repositoryRoot,
      input.operationId,
      observeStarted === undefined ? undefined : forwardStarted,
      startContext?.consumer ?? "coordinator",
      workspaceTarget,
      input.executionMetadata,
      startContext?.hostInput,
      input.selections ?? undefined,
    );
  } catch (error) {
    isNotificationClosed = true;
    const message = error instanceof Error ? error.message : "";
    if (preEffectRejectionSet.has(message))
      return rejectedWithoutEffect(
        identity,
        operationId,
        message,
        message === "coordinator_task_process_restart_required",
      );
    return failedClosedUnknown(
      identity,
      operationId,
      "single_task_start_observation_invalid",
    );
  }
  const started = inspectStartedTask(rawStarted);
  if (!started) {
    isNotificationClosed = true;
    return failedClosedUnknown(
      identity,
      operationId,
      "single_task_start_observation_invalid",
    );
  }
  const observation = await observeExecutionCompletion(
    started,
    cancelCoordinatorTask,
    input.cancellationSignal,
  );
  isNotificationClosed = true;
  await Promise.resolve(firstStartObservation).catch(() => {});
  if (observation.status === "unknown")
    return failedClosedUnknown(
      identity,
      operationId,
      "single_task_completion_observation_invalid",
    );
  const { rawCompletion, cancellationTransferred } = observation;
  const completion = inspectCompletionRecord(rawCompletion);
  if (!completion)
    return failedClosedUnknown(
      identity,
      operationId,
      "single_task_completion_observation_invalid",
    );
  if (
    workspaceTarget !== undefined &&
    (!completion.workspaceResult ||
      completion.workspaceResult.workspaceId !== workspaceTarget.workspaceId)
  )
    return failedClosedUnknown(
      identity,
      operationId,
      "single_task_workspace_result_invalid",
    );
  const isRecoveryOrCleanupUnknown =
    completion.cleanupConfirmed !== true ||
    completion.manualRecoveryRequired === true ||
    completion.recoveryIds.length > 0;
  const isSettledRuntimeCancellation =
    cancellationTransferred &&
    input.cancellationSignal.aborted &&
    completion.status === "blocked" &&
    completion.cleanupConfirmed === true &&
    completion.manualRecoveryRequired === false &&
    completion.processRestartRequired === false &&
    completion.recoveryIds.length === 0 &&
    SETTLED_RUNTIME_CANCELLATION_REASONS.has(completion.reason);
  const completionStatus = isSettledRuntimeCancellation
    ? "cancelled"
    : isRecoveryOrCleanupUnknown && completion.status === "completed"
      ? "blocked"
      : completion.status;
  const completionReason = isSettledRuntimeCancellation
    ? "single_task_cancelled_after_effect_cleanup"
    : isRecoveryOrCleanupUnknown && completion.status === "completed"
      ? "single_task_completion_cleanup_unknown"
      : completion.reason;
  const isMissingRequiredStart =
    observeStarted !== undefined && firstStartObservation === null;
  const isInvalidCompletedNotification =
    completionStatus === "completed" &&
    (notificationFailed || isMissingRequiredStart);
  return singleTaskAttemptResult(identity, {
    operationId,
    status: isInvalidCompletedNotification ? "blocked" : completionStatus,
    reason: isInvalidCompletedNotification
      ? notificationFailed
        ? "single_task_start_notification_failed"
        : "single_task_start_notification_missing"
      : completionReason,
    effectState: isRecoveryOrCleanupUnknown ? "unknown" : "settled",
    cleanupConfirmed: completion.cleanupConfirmed,
    manualRecoveryRequired: isRecoveryOrCleanupUnknown
      ? true
      : completion.manualRecoveryRequired,
    processRestartRequired: completion.processRestartRequired,
    candidateId: isInvalidCompletedNotification ? null : completion.candidateId,
    recoveryIds: completion.recoveryIds,
    recoveryObligations: completion.recoveryObligations,
    ...(completion.executorProvider === undefined
      ? {}
      : { executorProvider: completion.executorProvider }),
    ...(completion.workspaceResult
      ? { workspaceResult: completion.workspaceResult }
      : {}),
  });
}

/**
 * 単発受付の元記録を既存Docker回復とHost回収へ順序付きで接続する。
 * @responsibility 元Operationと回復ID集合を保ち、未観測の回収を成功にしない。
 * @trace ARCH-000004
 * @effect 既存回復・保存Reader・Host回収だけ。新しい回復経路を作らない。
 * @failure 相関不明・未完了・Host回収拒否では元参照と理由を保持する。
 * @boundary 実Lease取得済みの単発受付と既存回復Owner。
 */
export async function recoverSingleTaskOperation(
  context: Readonly<{
    rootCapability: Repository;
    root?: string;
    consumer: "workbench" | "coordinator_cli";
    authorize: () => boolean;
  }>,
  record: SingleTaskRecord,
) {
  const { rootCapability, consumer, authorize } = context;
  const repository = borrowCoordinatorRecoveryRepository(
    rootCapability,
    context.root,
  );
  if (!repository)
    return {
      cleanupConfirmed: false,
      recoveryIds: record.recoveryIds,
      reason: "docker_task_recovery_correlation_current_unconfirmed",
    };
  const observed = resolveDockerTaskCurrentCorrelations(
    [record.operationId],
    rootCapability,
    consumer,
    repository,
  );
  if (observed.status !== "completed")
    return {
      cleanupConfirmed: false,
      recoveryIds: record.recoveryIds,
      reason: observed.reason,
    };
  const unresolved = new Set(record.recoveryIds);
  for (const entry of observed.bindings) {
    const result = await recoverDockerTaskForCurrentConsumer(
      entry.recoveryId,
      rootCapability,
      undefined,
      repository,
    );
    if (result.status !== "recovered" || !result.taskRecoveryCompleted) {
      unresolved.add(entry.recoveryId);
      return {
        cleanupConfirmed: false,
        recoveryIds: [...unresolved],
        reason: result.reason,
      };
    }
    unresolved.delete(entry.recoveryId);
  }
  for (const recoveryId of unresolved) {
    if (
      recoveryId.startsWith("docker-task.") &&
      readState(recoveryStorageInput(repository), {
        scope: "recovery",
        input: {
          kind: "completion",
          recoveryId: recoveryId,
          correlationId: record.operationId,
        },
      }).operationCompletionConfirmed
    )
      unresolved.delete(recoveryId);
  }
  const hostId =
    record.adviceOperation?.hostRecoveryId ??
    record.recoveryIds.find((id) => id.startsWith("host-operation."));
  if (hostId) {
    const host = recoverSingleTaskHostOperation(
      rootCapability,
      hostId,
      authorize,
      repository,
    );
    if (!host.cleanupConfirmed) {
      unresolved.add(hostId);
      return {
        cleanupConfirmed: false,
        recoveryIds: [...unresolved],
        reason: host.reason,
      };
    }
    unresolved.delete(hostId);
  } else if (observed.bindings.length === 0 && record.phase !== "settled") {
    return {
      cleanupConfirmed: false,
      recoveryIds: [...unresolved],
      reason: "coordinator_task_operation_creation_unconfirmed",
    };
  }
  return {
    cleanupConfirmed: unresolved.size === 0,
    recoveryIds: [...unresolved],
    reason: "coordinator_task_recovery_observed",
  };
}

/** 元Repositoryと現在認可の下で同じHostを回収する。 @trace ARCH-000008 */
function recoverSingleTaskHostOperation(
  root: Repository,
  hostId: string,
  recordingCurrent: () => boolean,
  repository?: NonNullable<
    ReturnType<typeof borrowCoordinatorRecoveryRepository>
  >,
) {
  const capability = acquireHostOperationRecoveryGeneration(
    root,
    hostId,
    recordingCurrent,
    undefined,
    repository,
  );
  if (!capability)
    return {
      cleanupConfirmed: false,
      reason: "workbench_ai_advice_host_cleanup_unconfirmed",
    };
  try {
    const recovered = recoverOwnedOperationDirectories(hostId, capability);
    const released = releaseHostOperationRecoveryGeneration(capability);
    return {
      cleanupConfirmed: recovered.status === "recovered" && released,
      reason:
        recovered.status === "recovered" && released
          ? "workbench_ai_advice_host_cleanup_observed"
          : recovered.reason,
    };
  } catch {
    releaseHostOperationRecoveryGeneration(capability);
    return {
      cleanupConfirmed: false,
      reason: "workbench_ai_advice_host_cleanup_unconfirmed",
    };
  }
}

/**
 * exactな回復参照を既存の種類別Ownerで再入場する。
 * @responsibility CLIにあった対象相関と種類別接続を実行Ownerへ戻す。
 * @trace ARCH-000008
 * @input recoveryId: 元参照、rootCapability: 現在Repository、signal: 取消。
 * @returns 元参照に結合した既存回復結果又は固定拒否。
 * @precondition 呼出し元が今回の回復を明示要求する。
 * @postcondition 相関が確認できない対象へ処置せず、内部Rootを返さない。
 * @effect 既存の現在状態観測と、確認済みexact対象の正式回復だけ。
 * @failure 不正Signal・取消・対象不明では処置を開始しない。
 * @invariant 新しい回復ID・Registry・再試行・汎用強制清掃を追加しない。
 * @boundary 正式回復操作と既存Task／Host／診断／修復Owner。
 * @security 種類名だけで所有権を認定せず、元のRoot相関を必要とする。
 * @concurrency Taskの既存非同期取消を伝播する。同期Host処理に存在しない中断保証を作らない。
 */
export async function resumeExecution(
  recoveryId: string,
  rootCapability: unknown,
  signal: AbortSignal,
  confirmedDirectory?: string,
) {
  const cancellation = readExecutionCancellation(signal);
  if (cancellation !== false) {
    if (recoveryId.startsWith("docker-repair."))
      return Object.freeze({
        status: "blocked" as const,
        reason:
          cancellation === null
            ? ("docker_repair_boundary_unavailable" as const)
            : ("docker_repair_cancelled" as const),
        recoveryId,
        finalCheckpointConfirmed: false,
        outcomeConfirmed: false,
        retentionConfirmed: false,
        retentionReviewAfter: null,
        historyConfirmed: false,
        completionConfirmed: false,
        operationCleanupConfirmed: false,
      });
    return Object.freeze({
      status: "blocked" as const,
      reason:
        cancellation === null
          ? "coordinator_recovery_signal_invalid"
          : "coordinator_recovery_cancelled",
      recoveryId,
      hostCleanupCompleted: false,
    });
  }
  if (recoveryId.startsWith("docker-task."))
    return recoverDockerTaskForCurrentConsumer(
      recoveryId,
      rootCapability,
      signal,
      confirmedDirectory,
    );
  if (recoveryId.startsWith("docker-repair."))
    return projectDockerRepairObservation(
      await executeDockerRepair(
        rootCapability,
        signal,
        recoveryId,
        "repair",
        confirmedDirectory,
      ),
      recoveryId,
    );
  const repository = borrowCoordinatorRecoveryRepository(
    rootCapability,
    confirmedDirectory,
  );
  if (!repository || !/^host-operation\.OP-[0-9]{6,}$/u.test(recoveryId))
    return Object.freeze({
      status: "blocked" as const,
      reason: "coordinator_recovery_current_operation_unconfirmed",
      recoveryId,
      hostCleanupCompleted: false,
    });
  const current = readState(recoveryStorageInput(repository), {
    scope: "recovery",
  });
  const host =
    current.status === "completed" && current.value && current.lockReleased
      ? current.value.snapshot.operations.find(
          (item) =>
            item.kind === "host_operation" && item.recoveryId === recoveryId,
        )
      : null;
  if (host?.kind !== "host_operation")
    return {
      status: "blocked",
      reason: "coordinator_recovery_current_operation_unconfirmed",
      recoveryId,
      hostCleanupCompleted: false,
    };
  if (host.purpose === "isolation_probe")
    return recoverDockerIsolationProbe(
      recoveryId,
      repository.root,
      repository.revalidate,
      signal,
      repository,
    );
  const generation = acquireHostOperationRecoveryGeneration(
    repository.root,
    recoveryId,
    repository.revalidate,
    undefined,
    repository,
  );
  if (!generation)
    return {
      status: "blocked",
      reason: "host_recovery_generation_active",
      recoveryId,
      hostCleanupCompleted: false,
    };
  const result = recoverOwnedOperationDirectories(recoveryId, generation);
  return releaseHostOperationRecoveryGeneration(generation)
    ? { ...result, hostCleanupCompleted: result.status === "recovered" }
    : {
        status: "blocked",
        reason: "host_recovery_generation_release_unconfirmed",
        recoveryId,
        hostCleanupCompleted: false,
      };
}

/**
 * 下位試行の結果と変更観測を一つの独立した値として受け取る。
 * @responsibility 試行結果の局所条件を確認し、可変入力を後段へ持ち込まない。
 * @trace ARCH-000004
 * @input 下位の試行結果。
 * @returns 捕捉した試行結果、または不正入力を示すnull。
 * @precondition Coordinator自身が回復義務を付加する前に使う。
 * @postcondition 呼出し元との試行・操作・Workspace相関には同じ捕捉結果を使う。
 * @effect 外部・共有Effectなし。
 * @failure 不明、矛盾、Accessor、Proxyはnull。
 * @invariant 保存状態・回復義務を直接変更しない。
 * @boundary 下位試行の結果からGraphの終了保存への受付。
 * @security 下位結果からProcess再起動の回復義務を受理しない。
 * @concurrency 同期の捕捉だけを行う。
 */
export function snapshotSingleTaskResult(
  value: unknown,
): CoordinatorSingleTaskResult | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      types.isProxy(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    )
      return null;
    const required = [
      "attemptId",
      "authorityBindingId",
      "candidateId",
      "cleanupConfirmed",
      "contract",
      "effectState",
      "manualRecoveryRequired",
      "operationId",
      "processRestartRequired",
      "reason",
      "recoveryIds",
      "repositoryRevision",
      "status",
    ];
    const optional = [
      "recoveryObligations",
      "executorProvider",
      "workspaceResult",
    ];
    const expected = new Set([
      ...required,
      ...optional.filter((key) => Object.hasOwn(value, key)),
    ]);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length !== expected.size ||
      keys.some((key) => typeof key !== "string" || !expected.has(key))
    )
      return null;
    const record: Record<string, unknown> = Object.create(null);
    for (const key of expected) {
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor)) return null;
      record[key] = descriptor.value;
    }
    const {
      attemptId,
      authorityBindingId,
      candidateId,
      cleanupConfirmed,
      contract,
      effectState,
      executorProvider,
      manualRecoveryRequired,
      operationId,
      processRestartRequired,
      reason,
      recoveryIds: rawIds,
      recoveryObligations: rawObligations,
      repositoryRevision,
      status,
    } = record;
    const workspaceResult = expected.has("workspaceResult")
      ? inspectWorkspaceResult(record.workspaceResult)
      : undefined;
    if (
      workspaceResult === null ||
      contract !== "crdd-coordinator/single-task-adapter" ||
      !validIdentity(attemptId) ||
      !validIdentity(operationId) ||
      !validIdentity(authorityBindingId) ||
      typeof repositoryRevision !== "string" ||
      !/^[0-9a-f]{40,64}$/u.test(repositoryRevision) ||
      (status !== "completed" &&
        status !== "blocked" &&
        status !== "cancelled") ||
      typeof reason !== "string" ||
      reason.length === 0 ||
      reason.length > 256 ||
      (effectState !== "no_effect" &&
        effectState !== "settled" &&
        effectState !== "unknown") ||
      typeof cleanupConfirmed !== "boolean" ||
      typeof manualRecoveryRequired !== "boolean" ||
      typeof processRestartRequired !== "boolean" ||
      (candidateId !== null &&
        (typeof candidateId !== "string" || candidateId.length > 512)) ||
      (executorProvider !== undefined &&
        executorProvider !== "codex" &&
        executorProvider !== "claude") ||
      !Array.isArray(rawIds) ||
      types.isProxy(rawIds) ||
      Reflect.ownKeys(rawIds).some(
        (key) =>
          key !== "length" &&
          (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key)),
      )
    )
      return null;
    const recoveryIds: string[] = [];
    for (let index = 0; index < rawIds.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(rawIds, String(index));
      if (
        !descriptor ||
        !("value" in descriptor) ||
        !isCoordinatorRecoveryIdentity(descriptor.value)
      )
        return null;
      recoveryIds.push(descriptor.value);
    }
    const recoveryCount = recoveryIds.length;
    let recoveryObligations:
      | NonNullable<CoordinatorSingleTaskResult["recoveryObligations"]>
      | undefined;
    if (rawObligations !== undefined) {
      if (!Array.isArray(rawObligations) || types.isProxy(rawObligations))
        return null;
      const captured: Array<
        NonNullable<CoordinatorSingleTaskResult["recoveryObligations"]>[number]
      > = [];
      const identities = new Set<string>();
      const ids = new Set<string>();
      for (let index = 0; index < rawObligations.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(
          rawObligations,
          String(index),
        );
        if (!descriptor || !("value" in descriptor)) return null;
        const entry = descriptor.value;
        if (
          !entry ||
          typeof entry !== "object" ||
          Array.isArray(entry) ||
          types.isProxy(entry) ||
          ![Object.prototype, null].includes(Object.getPrototypeOf(entry)) ||
          Reflect.ownKeys(entry).length !== 2
        )
          return null;
        const kindField = Object.getOwnPropertyDescriptor(entry, "kind");
        const idField = Object.getOwnPropertyDescriptor(entry, "recoveryId");
        if (
          !kindField ||
          !("value" in kindField) ||
          !idField ||
          !("value" in idField)
        )
          return null;
        const kind = kindField.value;
        const recoveryId = idField.value;
        if (
          (kind !== "host" &&
            kind !== "docker" &&
            kind !== "candidate" &&
            kind !== "candidate_store") ||
          !isCoordinatorRecoveryIdentity(recoveryId) ||
          identities.has(`${kind}\0${recoveryId}`)
        )
          return null;
        identities.add(`${kind}\0${recoveryId}`);
        ids.add(recoveryId);
        captured.push(Object.freeze({ kind, recoveryId }));
      }
      const declaredIds = new Set(recoveryIds);
      if (
        ids.size !== declaredIds.size ||
        [...ids].some((id) => !declaredIds.has(id))
      )
        return null;
      recoveryObligations = Object.freeze(captured);
    } else if (recoveryCount > 0) return null;
    if (
      (status === "completed" &&
        (effectState !== "settled" ||
          !cleanupConfirmed ||
          manualRecoveryRequired ||
          processRestartRequired ||
          recoveryCount !== 0)) ||
      (status === "cancelled" &&
        (!cleanupConfirmed ||
          manualRecoveryRequired ||
          processRestartRequired ||
          recoveryCount !== 0 ||
          (effectState !== "no_effect" && effectState !== "settled"))) ||
      (effectState === "unknown" &&
        (cleanupConfirmed || !manualRecoveryRequired)) ||
      (!cleanupConfirmed &&
        (effectState !== "unknown" || !manualRecoveryRequired)) ||
      (recoveryCount > 0 && !manualRecoveryRequired) ||
      (processRestartRequired && status !== "blocked")
    )
      return null;
    return Object.freeze({
      attemptId,
      authorityBindingId,
      candidateId,
      cleanupConfirmed,
      contract,
      effectState,
      manualRecoveryRequired,
      operationId,
      processRestartRequired,
      reason,
      repositoryRevision,
      status,
      recoveryIds: Object.freeze(recoveryIds),
      ...(recoveryObligations === undefined ? {} : { recoveryObligations }),
      ...(executorProvider === undefined ? {} : { executorProvider }),
      ...(workspaceResult === undefined ? {} : { workspaceResult }),
    });
  } catch {
    return null;
  }
}

/**
 * resultを決定する。
 *
 * @responsibility resultの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input input: ExecutionInput、fields: Omit< CoordinatorExecutionResult, | "contract" | "projectId" | "queueId" | "processRestartRequired" | "recoveryIds" | "recoveryObligations" > & Readonly<{ processRestartRequired?: boolean; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryKind; recoveryId: string; }>[]; }>
 * @returns CoordinatorExecutionResultを返す。
 * @precondition 「input: ExecutionInput、fields: Omit< CoordinatorExecutionResult, | "contract" | "projectId" | "queueId" | "processRestartRequired" | "recoveryIds" | "recoveryObligations" > & Readonly<{ processRestartRequired?: boolean; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryKind; recoveryId: string; }>[]; }>」がresultの入力契約を満たす。
 * @postcondition resultの責務を完了した結果だけを返す。
 * @effect N/A: resultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resultは独自の失敗分岐を所有しない。
 * @invariant resultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resultはProcess内の同一Subsystemで完結する。
 * @security N/A: resultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resultは共有非同期状態を持たない同期処理である。
 */
function result(
  input: ExecutionInput,
  fields: Omit<
    CoordinatorExecutionResult,
    | "contract"
    | "projectId"
    | "queueId"
    | "processRestartRequired"
    | "recoveryIds"
    | "recoveryObligations"
  > &
    Readonly<{
      processRestartRequired?: boolean;
      recoveryIds?: readonly string[];
      recoveryObligations?: readonly Readonly<{
        kind: ProjectTaskRecoveryKind;
        recoveryId: string;
      }>[];
    }>,
): CoordinatorExecutionResult {
  return Object.freeze({
    contract: COORDINATOR_EXECUTION_CONTRACT,
    projectId: input.projectId,
    queueId: input.queueId,
    ...fields,
    processRestartRequired: fields.processRestartRequired ?? false,
    recoveryIds: Object.freeze([...(fields.recoveryIds ?? [])]),
    recoveryObligations: Object.freeze([...(fields.recoveryObligations ?? [])]),
    completedTaskIds: Object.freeze([...fields.completedTaskIds]),
  });
}

/**
 * executionを停止結果として構築する。
 *
 * @responsibility executionの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input input: ExecutionInput、reason: string、options: Readonly<{ state?: ProjectExecutionState | null; completedTaskIds?: readonly string[]; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; processRestartRequired?: boolean; effectState?: "no_effect" | "settled" | "unknown"; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryKind; recoveryId: string; }>[]; }>
 * @returns blockedの計算結果を返す。
 * @precondition 「input: ExecutionInput、reason: string、options: Readonly<{ state?: ProjectExecutionState | null; completedTaskIds?: readonly string[]; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; processRestartRequired?: boolean; effectState?: "no_effect" | "settled" | "unknown"; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryKind; recoveryId: string; }>[]; }>」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security N/A: blockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blockExecution(
  input: ExecutionInput,
  reason: string,
  options: Readonly<{
    state?: ProjectExecutionState | null;
    completedTaskIds?: readonly string[];
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    processRestartRequired?: boolean;
    effectState?: "no_effect" | "settled" | "unknown";
    recoveryIds?: readonly string[];
    recoveryObligations?: readonly Readonly<{
      kind: ProjectTaskRecoveryKind;
      recoveryId: string;
    }>[];
  }> = {},
) {
  return result(input, {
    status: "blocked",
    reason,
    stateGeneration: options.state?.generation ?? null,
    completedTaskIds: options.completedTaskIds ?? [],
    cleanupConfirmed: options.cleanupConfirmed ?? true,
    manualRecoveryRequired: options.manualRecoveryRequired ?? false,
    processRestartRequired: options.processRestartRequired ?? false,
    effectState: options.effectState ?? "no_effect",
    recoveryIds: options.recoveryIds ?? [],
    recoveryObligations: options.recoveryObligations ?? [],
  });
}

/**
 * task Execution Mapを決定する。
 *
 * @responsibility task Execution Mapの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input state: ProjectExecutionState、executions: readonly CoordinatorTaskExecution[]
 * @returns taskExecutionMapの計算結果を返す。
 * @precondition 「state: ProjectExecutionState、executions: readonly CoordinatorTaskExecution[]」がtaskExecutionMapの入力契約を満たす。
 * @postcondition taskExecutionMapの責務を完了した結果だけを返す。
 * @effect N/A: taskExecutionMapは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: taskExecutionMapは独自の失敗分岐を所有しない。
 * @invariant taskExecutionMapは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: taskExecutionMapはProcess内の同一Subsystemで完結する。
 * @security N/A: taskExecutionMapはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: taskExecutionMapは共有非同期状態を持たない同期処理である。
 */
function taskExecutionMap(
  state: ProjectExecutionState,
  executions: readonly CoordinatorTaskExecution[],
) {
  if (!Array.isArray(executions)) return null;
  const active = state.tasks.filter((task) => task.state !== "superseded");
  if (executions.length !== active.length) return null;
  const unmatched = new Set(active.map((task) => task.definition.id));
  const result = new Map<string, CoordinatorTaskExecution>();
  for (const entry of executions) {
    if (!entry || typeof entry !== "object") return null;
    const taskId = entry.taskId;
    if (!unmatched.delete(taskId) || !validIdentity(entry.authorityBindingId))
      return null;
    result.set(taskId, entry);
  }
  return result;
}

/**
 * 受付済み単発依頼とGraphの実Lease取得から用途別終結までを所有する。
 *
 * @responsibility Coordinator Operationの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input 用途を明示した受付済み操作。Graphは保存・記録・入力、単発は元pendingとの結合を持つ。
 * @returns Graphは既存実行結果、単発は元itemへの投影完了を返す。
 * @precondition 上位が受付と主体を確認し、用途別の元Repository・Queueへ結合している。
 * @postcondition runCoordinatorOperationの責務を完了した結果だけを返す。
 * @effect 検証済みRepositoryのState／Queueを保存し、許可されたTaskと結果受理・整理を既存Ownerへ委譲する。
 * @failure runCoordinatorOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runCoordinatorOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 受付済み要求、既存EM Writer、実Leaseと用途別実行の接続。
 * @security 元認可と取消を従来の時点で確認し、本文を保存へ複製しない。
 * @concurrency runCoordinatorOperationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function runCoordinatorOperation(
  operation: SingleTaskOperation,
): Promise<undefined>;
export function runCoordinatorOperation(
  operation: ScheduledOperation,
): Promise<CoordinatorExecutionResult>;
export async function runCoordinatorOperation(
  operation: SingleTaskOperation | ScheduledOperation,
): Promise<CoordinatorExecutionResult | undefined> {
  // 耐久受付の返却と実行準備を分離し、取消も同じpendingをjoinする。
  if (operation.kind === "single") {
    await setImmediate();
    if (operation.admissionCurrent?.() === false) {
      await executeSingleOperation(operation, {
        status: "blocked",
        reason: "coordinator_task_not_started",
        value: null,
        recoveryId: null,
        manualRecoveryRequired: false,
      });
      return;
    }
  }
  const waitForPreparation = <T extends StateContentionResult>(
    attempt: () => T,
  ) =>
    operation.kind === "scheduled" && operation.leaseWait
      ? waitForStateContention(
          operation.input.cancellationSignal,
          attempt,
          operation.leaseWait.revalidate,
        )
      : attempt();
  const preparationRefusal = (signal: AbortSignal) =>
    signal.aborted
      ? "coordinator_cancelled_before_task_effect"
      : "coordinator_authenticated_principal_not_verified";
  const observed =
    operation.kind === "scheduled" &&
    operation.leaseWait &&
    !operation.admission
      ? await waitForPreparation(() =>
          readExecutionState(
            operation.persistence.repository,
            operation.persistence.repositoryBindingId,
          ),
        )
      : undefined;
  if (operation.kind === "scheduled" && observed === null)
    return blockExecution(
      operation.input,
      preparationRefusal(operation.input.cancellationSignal),
    );
  const prepared =
    operation.kind === "scheduled"
      ? prepareScheduledOperation(
          operation.persistence,
          operation.input,
          observed ?? undefined,
          operation.admission,
        )
      : null;
  if (prepared && !("kind" in prepared)) return prepared;
  const leaseInput = [
    operation.kind === "single"
      ? operation.deps.root
      : operation.persistence.repository.directory,
    operation.kind === "single"
      ? operation.deps.binding
      : operation.persistence.repositoryBindingId,
    operation.kind === "single"
      ? operation.deps.projectId
      : operation.input.projectId,
    operation.kind === "single" ? operation.requestId : operation.input.queueId,
    "project-operation",
  ] as const;
  const leaseResult =
    operation.kind === "scheduled" && operation.leaseWait
      ? await acquireCoordinatorSnapshotLease(
          ...leaseInput,
          undefined,
          {
            signal: operation.input.cancellationSignal,
            ...operation.leaseWait,
          },
          operation.admission && prepared && "kind" in prepared
            ? {
                queueGeneration: prepared.queue.generation,
                stateGeneration: prepared.state.generation,
              }
            : undefined,
        )
      : acquireCoordinatorSnapshotLease(...leaseInput);
  if (operation.kind === "single") {
    await executeSingleOperation(operation, leaseResult);
    return;
  }
  if (prepared === null || !("kind" in prepared))
    throw Error("scheduled_operation_not_prepared");
  const { persistence, recording, input } = operation;
  let { state, queue } = prepared;
  let startCandidates = prepared.startCandidates;
  const { executions } = prepared;
  if (leaseResult.status !== "completed")
    return blockExecution(input, leaseResult.reason, {
      state,
      cleanupConfirmed: !leaseResult.manualRecoveryRequired,
      manualRecoveryRequired: leaseResult.manualRecoveryRequired,
      effectState: leaseResult.manualRecoveryRequired ? "unknown" : "no_effect",
      ...(leaseResult.recoveryId === null
        ? {}
        : { recoveryIds: Object.freeze([leaseResult.recoveryId]) }),
    });
  const lease = leaseResult.value;
  const workspaceResults: NonNullable<
    CoordinatorExecutionResult["workspaceResults"]
  >[number][] = [];
  const withWorkspaceResults = (value: CoordinatorExecutionResult) =>
    workspaceResults.length === 0
      ? value
      : Object.freeze({
          ...value,
          workspaceResults: Object.freeze([...workspaceResults]),
        });
  // Queue所有前後で同じLeaseを一回だけ解放し、所有済みの元世代だけを確定する。
  const completeQueue = (
    terminal: CoordinatorExecutionResult,
    terminalQueue: typeof queue | null,
  ) => {
    const finished = finishOperationLease(lease, {
      kind: "scheduled",
      repository: persistence.repository,
      binding: persistence.repositoryBindingId,
      queueId: input.queueId,
      queue: terminalQueue,
    });
    const project = (outcome: LeaseFinishResult) =>
      withWorkspaceResults(
        outcome.status === "completed"
          ? terminal
          : result(input, {
              status: "blocked",
              reason: outcome.reason,
              stateGeneration: terminal.stateGeneration,
              completedTaskIds: terminal.completedTaskIds,
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              processRestartRequired: terminal.processRestartRequired,
              recoveryIds:
                "recoveryId" in outcome &&
                typeof outcome.recoveryId === "string"
                  ? [...new Set([...terminal.recoveryIds, outcome.recoveryId])]
                  : terminal.recoveryIds,
              recoveryObligations: terminal.recoveryObligations,
              effectState: "unknown",
            }),
      );
    return finished instanceof Promise
      ? finished.then(project)
      : project(finished);
  };
  // 新しい実行ではなく、取得済みQueueの終端だけを同じ世代で保存する。
  const writeTerminalQueue = (
    next: Omit<Parameters<typeof updateCoordinatorQueue>[3], "lease">,
  ) => {
    const expectedGeneration = queue.generation;
    const write = () =>
      updateCoordinatorQueue(persistence, input.queueId, expectedGeneration, {
        ...next,
        lease,
      });
    return lease.releaseWithWait
      ? waitForStateContention(new AbortController().signal, write)
      : write();
  };
  const finalizeOwnedFailure = (
    reason: string,
    options: Readonly<{
      state: ProjectExecutionState;
      completedTaskIds?: readonly string[];
      processRestartRequired?: boolean;
      recoveryIds?: readonly string[];
      recoveryObligations?: CoordinatorExecutionResult["recoveryObligations"];
    }>,
  ): ReturnType<typeof completeQueue> => {
    const recoveryObligations = [
      ...options.state.tasks.flatMap((task) =>
        task.recoveryObligations
          .filter((item) => item.phase !== "settled")
          .map(({ kind, recoveryId }) => ({ kind, recoveryId })),
      ),
      ...(options.recoveryObligations ?? []),
    ].filter(
      (item, index, all) =>
        all.findIndex(
          (other) =>
            other.kind === item.kind && other.recoveryId === item.recoveryId,
        ) === index,
    );
    const recoveryIds = [
      ...new Set([
        ...recoveryObligations.map((item) => item.recoveryId),
        ...(options.recoveryIds ?? []),
      ]),
    ];
    const terminalOptions = {
      state: options.state,
      completedTaskIds: options.completedTaskIds ?? [],
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      processRestartRequired: options.processRestartRequired ?? false,
      recoveryIds,
      recoveryObligations,
      effectState: "unknown" as const,
    };
    const recoveryQueue = writeTerminalQueue({
      state: "recovery_required",
      resumeCondition: "owned_operation_failure",
      resultReference: createCoordinatorStableId("project-operation-recovery", [
        input.projectId,
        input.queueId,
        lease.ownerGeneration,
      ]),
    });
    const finish = (
      written: ReturnType<typeof updateCoordinatorQueue> | null,
    ) => {
      const confirmedQueue =
        written?.status === "completed" ? written.value : null;
      if (confirmedQueue !== null) queue = confirmedQueue;
      // 物理解放だけ成功しても、元Queueの所有世代は未確定のまま残り得る。
      const pendingRecoveryIds =
        confirmedQueue !== null
          ? recoveryIds
          : [
              ...new Set([
                ...recoveryIds,
                leaseAcquisitionRecoveryId(
                  persistence.repositoryBindingId,
                  input.projectId,
                  input.queueId,
                  lease.kind,
                ),
              ]),
            ];
      return completeQueue(
        blockExecution(
          input,
          written?.status === "completed"
            ? reason
            : (written?.reason ?? "coordinator_queue_recovery_unconfirmed"),
          { ...terminalOptions, recoveryIds: pendingRecoveryIds },
        ),
        confirmedQueue,
      );
    };
    return recoveryQueue instanceof Promise
      ? recoveryQueue.then(finish)
      : finish(recoveryQueue);
  };

  // 所有済みQueueの終端は、更新成功後だけ同じ世代の解放確定へ渡す。
  const settleOwnedQueue = (
    next: Omit<Parameters<typeof updateCoordinatorQueue>[3], "lease">,
    project: () => CoordinatorExecutionResult,
    progress: Pick<
      Parameters<typeof finalizeOwnedFailure>[1],
      "completedTaskIds" | "processRestartRequired"
    > = {},
  ): ReturnType<typeof completeQueue> => {
    const pending = writeTerminalQueue(next);
    const finish = (
      written: ReturnType<typeof updateCoordinatorQueue> | null,
    ) =>
      written?.status === "completed"
        ? completeQueue(project(), written.value)
        : finalizeOwnedFailure(
            written?.reason ?? "coordinator_queue_settlement_unconfirmed",
            { state, ...progress },
          );
    return pending instanceof Promise ? pending.then(finish) : finish(pending);
  };

  // 開始側では保存済みの版を回復に使う。終端側では候補も照合できた場合だけ次へ進める。
  let waitedAfterDelegation = false;
  const saveTaskProgress = async (
    request: Extract<
      Parameters<typeof saveProjectExecutionState>[2],
      {
        kind:
          | "task_start"
          | "task_handoff"
          | "task_started"
          | "task_defer_before_effect"
          | "task_settle"
          | "task_settle_before_effect";
      }
    >,
  ) => {
    const expectedGeneration = state.generation;
    const preparing =
      request.kind === "task_start" || request.kind === "task_handoff";
    const save = () => {
      const saved = saveProjectExecutionState(
        persistence.repository,
        persistence.repositoryBindingId,
        request,
        expectedGeneration,
        request.kind === "task_defer_before_effect" && persistence.intake
          ? {
              ...persistence.intake,
              leaseAccess: writerLeaseAccess(() => lease),
            }
          : persistence.intake,
      );
      if (!preparing && isCleanStateContention(saved))
        waitedAfterDelegation = true;
      return saved;
    };
    const written = preparing
      ? await waitForPreparation(save)
      : operation.leaseWait
        ? await waitForStateContention(new AbortController().signal, save)
        : save();
    if (written === null)
      return {
        status: "interrupted" as const,
        reason: preparationRefusal(input.cancellationSignal),
      };
    if (written.status !== "completed")
      return { status: "blocked" as const, reason: written.reason };
    if (request.kind === "task_defer_before_effect") {
      state = written.value;
      if (!written.deferredQueue)
        return {
          status: "blocked" as const,
          reason: "coordinator_queue_settlement_unconfirmed",
        };
      queue = written.deferredQueue;
    }
    const settling =
      request.kind === "task_settle" ||
      request.kind === "task_settle_before_effect";
    if (!settling) state = written.value;
    const candidates = inspectTaskStartCandidates(
      written.value,
      written.taskStartCandidates,
    );
    if (!candidates)
      return {
        status: "blocked" as const,
        reason: "coordinator_state_observation_unknown",
      };
    if (settling) state = written.value;
    return {
      status: "completed" as const,
      candidates,
      deferredQueue: written.deferredQueue,
    };
  };

  if (
    lease.evidenceWaited &&
    (input.cancellationSignal.aborted ||
      (operation.leaseWait?.revalidate &&
        (await confirmStorageContinuation(
          input.cancellationSignal,
          operation.leaseWait.revalidate,
        )) !== true))
  )
    return completeQueue(
      blockExecution(
        input,
        input.cancellationSignal.aborted
          ? "coordinator_lease_acquisition_cancelled"
          : "coordinator_authenticated_principal_not_verified",
        { state },
      ),
      null,
    );

  // 先行選択は仮判定。同じ実行ScopeのLease取得後に対象Queueを再選択する。
  if (!operation.admission) {
    const selectedAfterLease = await waitForPreparation(() =>
      selectNextQueueEntry(
        persistence.repository,
        persistence.repositoryBindingId,
        input.queueId,
      ),
    );
    if (!selectedAfterLease)
      return completeQueue(
        blockExecution(input, preparationRefusal(input.cancellationSignal), {
          state,
        }),
        null,
      );
    if (selectedAfterLease.status !== "completed")
      return completeQueue(
        blockExecution(input, selectedAfterLease.reason, {
          state,
          cleanupConfirmed: !selectedAfterLease.manualRecoveryRequired,
          manualRecoveryRequired: selectedAfterLease.manualRecoveryRequired,
          effectState: selectedAfterLease.manualRecoveryRequired
            ? "unknown"
            : "no_effect",
        }),
        null,
      );
    if (
      !selectedAfterLease.value ||
      selectedAfterLease.value.queueId !== input.queueId
    )
      return completeQueue(
        blockExecution(input, "coordinator_queue_claim_priority_changed", {
          state,
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          effectState: "no_effect",
        }),
        null,
      );
  }

  const selectedGeneration = queue.generation;
  const leaseQueue = await waitForPreparation(() =>
    operation.admission
      ? selectAndClaimQueue(
          persistence.repository,
          persistence.repositoryBindingId,
          input.queueId,
          selectedGeneration,
          writerLeaseAccess(() => lease),
        )
      : updateCoordinatorQueue(persistence, input.queueId, selectedGeneration, {
          state: "leased",
          lease,
          resumeCondition: null,
          resultReference: null,
        }),
  );
  if (!leaseQueue)
    return completeQueue(
      blockExecution(input, preparationRefusal(input.cancellationSignal), {
        state,
      }),
      null,
    );
  if (leaseQueue.status !== "completed")
    return completeQueue(
      blockExecution(input, leaseQueue.reason, {
        state,
        cleanupConfirmed: !leaseQueue.manualRecoveryRequired,
        manualRecoveryRequired: leaseQueue.manualRecoveryRequired,
        effectState: leaseQueue.manualRecoveryRequired
          ? "unknown"
          : "no_effect",
        ...(leaseQueue.manualRecoveryRequired
          ? {
              recoveryIds: [
                leaseAcquisitionRecoveryId(
                  persistence.repositoryBindingId,
                  input.projectId,
                  input.queueId,
                  lease.kind,
                ),
              ],
            }
          : {}),
      }),
      null,
    );
  if (!leaseQueue.value)
    return completeQueue(
      blockExecution(input, "coordinator_queue_claim_priority_changed", {
        state,
      }),
      null,
    );
  queue = leaseQueue.value;
  const cancelBeforeTask = (
    completedTaskIds: readonly string[],
    reason = "coordinator_cancelled_before_task_effect",
  ) =>
    settleOwnedQueue(
      {
        state: "cancelled",
        resumeCondition: null,
        resultReference: null,
      },
      () =>
        result(input, {
          status: "cancelled",
          reason,
          stateGeneration: state.generation,
          completedTaskIds,
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          effectState: completedTaskIds.length ? "settled" : "no_effect",
        }),
      { completedTaskIds },
    );
  if (input.cancellationSignal.aborted) return cancelBeforeTask([]);
  if (!operation.admission || startCandidates.taskIds.length === 0) {
    const leasedGeneration = queue.generation;
    const runningQueue = await waitForPreparation(() =>
      updateCoordinatorQueue(persistence, input.queueId, leasedGeneration, {
        state: "running",
        lease,
        resumeCondition: null,
        resultReference: null,
      }),
    );
    if (!runningQueue)
      return cancelBeforeTask([], preparationRefusal(input.cancellationSignal));
    if (runningQueue.status !== "completed")
      return finalizeOwnedFailure(runningQueue.reason, { state });
    queue = runningQueue.value;
  }

  const completedTaskIds: string[] = [];
  let processRestartRequired = false;
  while (true) {
    // 初回読取りか直前の終端保存で照合済みの候補から、一件ずつ進める。
    const taskId = startCandidates.taskIds[0];
    if (taskId === undefined) break;
    if (input.cancellationSignal.aborted)
      return cancelBeforeTask(completedTaskIds);
    const revalidate =
      operation.beforeTask ??
      (waitedAfterDelegation ? operation.leaseWait?.revalidate : undefined);
    waitedAfterDelegation = false;
    if (
      revalidate &&
      (await confirmStorageContinuation(
        input.cancellationSignal,
        revalidate,
      )) !== true
    ) {
      return cancelBeforeTask(
        completedTaskIds,
        preparationRefusal(input.cancellationSignal),
      );
    }
    const execution = executions.get(taskId);
    if (!execution)
      return finalizeOwnedFailure("coordinator_task_execution_missing", {
        state,
        completedTaskIds,
      });
    const attemptId = createCoordinatorStableId("attempt", [
      input.queueId,
      taskId,
      String(state.generation),
    ]);
    const operationId = createCoordinatorStableId("operation", [
      input.queueId,
      taskId,
      attemptId,
      execution.authorityBindingId,
    ]);
    let handoffObservation: Parameters<
      typeof confirmPreparedWorkspaceTarget
    >[4];
    const laterTaskIntake =
      queue.state === "running" && completedTaskIds.length > 0
        ? persistence.intake
        : undefined;
    if (queue.state === "leased" || laterTaskIntake) {
      const preparation = {
        queueId: input.queueId,
        queueGeneration: queue.generation,
        stateGeneration: state.generation,
        taskId,
        attemptId,
        operationId,
        authorityBindingId: execution.authorityBindingId,
      };
      const preparedTask = await waitForPreparation(() => {
        const args = [
          persistence.repository,
          persistence.repositoryBindingId,
          preparation,
          writerLeaseAccess(() => lease),
        ] as const;
        return laterTaskIntake
          ? prepareNextTask(...args, {
              operation: laterTaskIntake.operation,
              queueId: laterTaskIntake.queueId,
              requestHash: laterTaskIntake.requestHash,
              projectId: laterTaskIntake.projectId,
              milestoneId: laterTaskIntake.milestoneId,
            })
          : prepareFirstTask(...args);
      });
      if (preparedTask === null)
        return cancelBeforeTask(
          completedTaskIds,
          preparationRefusal(input.cancellationSignal),
        );
      if (preparedTask.status !== "completed")
        return finalizeOwnedFailure(preparedTask.reason, {
          state,
          completedTaskIds,
        });
      queue = preparedTask.value.queue;
      state = preparedTask.value.state;
      handoffObservation = preparedTask.value;
    } else
      for (const phase of [
        {
          kind: "task_start",
          authorityBindingId: execution.authorityBindingId,
        },
        {
          kind: "task_handoff",
          operationId,
        },
      ] as const) {
        const progress = await saveTaskProgress({
          ...phase,
          projectId: state.projectId,
          taskId,
          attemptId,
        });
        if (progress.status === "interrupted" && phase.kind === "task_start")
          return cancelBeforeTask(completedTaskIds, progress.reason);
        if (progress.status !== "completed")
          return finalizeOwnedFailure(progress.reason, {
            state,
            completedTaskIds,
          });
      }
    let effectStarted = false;
    let delegated = false;
    // 共通の試行本体が初回通知だけを搬送し、この保存と元completionを待つ。
    const observeStarted = async () => {
      const progress = await saveTaskProgress({
        kind: "task_started",
        projectId: state.projectId,
        taskId,
        attemptId,
        operationId,
      });
      if (progress.status !== "completed")
        throw Error("task_start_save_unconfirmed");
      effectStarted = true;
    };
    let stoppedBeforeDelegation: "cancelled" | "blocked" | null = null;
    let preparationStopReason: string | undefined;
    let deferReason:
      | Extract<
          Parameters<typeof saveProjectExecutionState>[2],
          { kind: "task_defer_before_effect" }
        >["reason"]
      | undefined;
    let targetObservationFailure: string | undefined;
    let outcome: unknown = null;
    try {
      if (input.cancellationSignal.aborted) {
        stoppedBeforeDelegation = "cancelled";
      } else {
        const target = await waitForPreparation(() =>
          confirmPreparedWorkspaceTarget(
            persistence.workingDirectory,
            persistence.repositoryBindingId,
            input.queueId,
            operation.workspaceTarget,
            ...(handoffObservation ? ([handoffObservation] as const) : []),
          ),
        );
        if (
          target?.status === "blocked" &&
          (target.manualRecoveryRequired || target.recoveryId !== null)
        ) {
          // 取消が重なっても保存観測不明を成功へ変換せず、元の予約と保留物を保全する。
          targetObservationFailure = target.reason;
        } else if (target === null || input.cancellationSignal.aborted) {
          stoppedBeforeDelegation = "cancelled";
          preparationStopReason = preparationRefusal(input.cancellationSignal);
        } else if (isCleanStateContention(target)) {
          deferReason = "coordinator_snapshot_lock_contended";
        } else if (target.status !== "completed") {
          switch (target.reason) {
            case "coordinator_workspace_target_changed":
            case "coordinator_workspace_queue_closed":
              stoppedBeforeDelegation = "blocked";
              break;
            case "coordinator_workspace_not_ready":
            case "coordinator_workspace_git_unavailable":
              deferReason = target.reason;
              break;
            default:
              deferReason = "coordinator_workspace_state_unavailable";
          }
        } else if (target.value.workspaceId !== (queue.workspaceId ?? null)) {
          stoppedBeforeDelegation = "blocked";
        } else {
          delegated = true;
          if (recording && !recording.attempted) {
            const continuing = state.tasks.some(
              (task) => task.state === "completed",
            );
            beginObjectiveExecutionRecording(
              recording,
              continuing ? attemptId : undefined,
            );
          }
          outcome = await runCoordinatorSingleTaskAttempt({
            attemptId,
            operationId,
            authorityBindingId: execution.authorityBindingId,
            executionMetadata: {
              operation: "task_attempt",
              projectId: input.projectId,
              milestoneId: input.milestoneId,
              objectiveId:
                state.tasks.find((t) => t.definition.id === taskId)?.definition
                  .objectiveId ?? "",
              taskId,
              attemptId,
              ...(recording?.workType ? { workType: recording.workType } : {}),
              ...(recording?.group ? { groupId: recording.group.groupId } : {}),
            },
            repositoryRevision: state.repositoryRevision,
            taskRequest: execution.taskRequest,
            selections: execution.selections,
            repositoryRoot: execution.repositoryRoot,
            workspaceTarget: target.value,
            cancellationSignal: input.cancellationSignal,
            observeStarted,
          });
        }
      }
    } catch {
      // 委譲済みなら元の回復経路。委譲前の例外から対象変更は推定しない。
      if (!delegated) {
        if (input.cancellationSignal.aborted)
          stoppedBeforeDelegation = "cancelled";
        else deferReason = "coordinator_workspace_preparation_failed";
      }
    }
    if (targetObservationFailure)
      // Queueの元世代を残す。解放証拠または元Intentから既存owner-loss再入場が確定する。
      return completeQueue(
        blockExecution(input, targetObservationFailure, {
          state,
          completedTaskIds,
          processRestartRequired,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
          recoveryIds: [
            leaseAcquisitionRecoveryId(
              persistence.repositoryBindingId,
              input.projectId,
              input.queueId,
              lease.kind,
            ),
          ],
        }),
        null,
      );
    const capturedOutcome = delegated
      ? snapshotSingleTaskResult(outcome)
      : null;
    if (deferReason !== undefined) {
      const deferred = await saveTaskProgress({
        kind: "task_defer_before_effect",
        projectId: state.projectId,
        taskId,
        attemptId,
        operationId,
        authorityBindingId: execution.authorityBindingId,
        queueGeneration: queue.generation,
        ownerGeneration: lease.ownerGeneration,
        reason: deferReason,
      });
      if (deferred.status !== "completed" || !deferred.deferredQueue)
        return finalizeOwnedFailure(
          deferred.status === "completed"
            ? "coordinator_queue_settlement_unconfirmed"
            : deferred.reason,
          { state, completedTaskIds, processRestartRequired },
        );
      return completeQueue(
        blockExecution(input, deferReason, {
          state,
          completedTaskIds,
          processRestartRequired,
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          effectState: completedTaskIds.length ? "settled" : "no_effect",
        }),
        deferred.deferredQueue,
      );
    }
    const acceptedOutcome =
      capturedOutcome !== null &&
      capturedOutcome.attemptId === attemptId &&
      capturedOutcome.operationId === operationId &&
      capturedOutcome.authorityBindingId === execution.authorityBindingId &&
      capturedOutcome.repositoryRevision === state.repositoryRevision &&
      (capturedOutcome.workspaceResult === undefined ||
        capturedOutcome.workspaceResult.workspaceId ===
          (queue.workspaceId ?? null))
        ? capturedOutcome
        : null;
    const attemptStatus = acceptedOutcome?.status ?? stoppedBeforeDelegation;
    const successWithoutStart =
      !effectStarted && acceptedOutcome?.status === "completed";
    if (!successWithoutStart && acceptedOutcome?.workspaceResult)
      workspaceResults.push(
        Object.freeze({
          taskId,
          attemptId,
          operationId,
          result: acceptedOutcome.workspaceResult,
        }),
      );
    const normalizedRecoveryObligations: Array<
      Readonly<{ kind: ProjectTaskRecoveryKind; recoveryId: string }>
    > = [...(acceptedOutcome?.recoveryObligations ?? [])];
    const isExactExternalRecoveryClosure = normalizedRecoveryObligations.some(
      (entry) => entry.kind === "host" || entry.kind === "docker",
    );
    const isResultContradictsStartedEffect =
      effectStarted && acceptedOutcome?.effectState !== "settled";
    const isDelegatedResultIsUnknown =
      successWithoutStart ||
      (delegated &&
        !effectStarted &&
        (acceptedOutcome === null ||
          acceptedOutcome.effectState === "unknown"));
    const isExternalEffectUnresolved =
      (isResultContradictsStartedEffect || isDelegatedResultIsUnknown) &&
      !isExactExternalRecoveryClosure;
    const isProcessDiscardRequired =
      isResultContradictsStartedEffect ||
      isDelegatedResultIsUnknown ||
      acceptedOutcome?.processRestartRequired === true;
    if (isProcessDiscardRequired) {
      const executionProcessRecoveryId = createExecutionProcessRecoveryIdentity(
        attemptId,
        operationId,
      );
      poisonExecutionProcessAfterCleanupUnknown();
      normalizedRecoveryObligations.push(
        Object.freeze({
          kind: "execution_process" as const,
          recoveryId: executionProcessRecoveryId,
        }),
      );
    }
    const recoveryRequired =
      isResultContradictsStartedEffect ||
      isDelegatedResultIsUnknown ||
      (acceptedOutcome !== null &&
        (acceptedOutcome.effectState === "unknown" ||
          !acceptedOutcome.cleanupConfirmed ||
          acceptedOutcome.manualRecoveryRequired ||
          acceptedOutcome.processRestartRequired ||
          acceptedOutcome.recoveryIds.length > 0));
    processRestartRequired ||= isProcessDiscardRequired;
    const recoveryObligations = recoveryRequired
      ? normalizedRecoveryObligations.map((entry) =>
          Object.freeze({ ...entry, phase: "required" as const }),
        )
      : [];
    const isRecoveryUnresolved =
      recoveryRequired &&
      (isExternalEffectUnresolved || recoveryObligations.length === 0);
    const settlementOutcome = recoveryRequired
      ? "recovery_required"
      : attemptStatus === "completed"
        ? "completed"
        : attemptStatus === "cancelled"
          ? "cancelled"
          : "failed";
    const settlementInput = {
      taskId: taskId,
      attemptId: attemptId,
      operationId: operationId,
      authorityBindingId: execution.authorityBindingId,
      outcome: settlementOutcome,
      cleanupConfirmed:
        acceptedOutcome === null
          ? !effectStarted && !delegated
          : !isResultContradictsStartedEffect &&
            !isDelegatedResultIsUnknown &&
            !acceptedOutcome.processRestartRequired &&
            acceptedOutcome.cleanupConfirmed,
      recoveryObligations,
      recoveryUnresolved: isRecoveryUnresolved,
      candidateId:
        settlementOutcome === "completed"
          ? (acceptedOutcome?.candidateId ?? null)
          : null,
    } as const;
    const savedTask = state.tasks.find((task) => task.definition.id === taskId);
    const savedStartMatches =
      savedTask?.state === "running" &&
      savedTask.startPhase === "running" &&
      savedTask.attemptId === attemptId &&
      savedTask.operationId === operationId &&
      savedTask.authorityBindingId === execution.authorityBindingId;
    const settlementRequest =
      settlementInput.outcome === "completed" ||
      effectStarted ||
      savedStartMatches
        ? {
            kind: "task_settle" as const,
            projectId: state.projectId,
            ...settlementInput,
            resultUnresolved: settlementInput.recoveryUnresolved,
          }
        : {
            kind: "task_settle_before_effect" as const,
            projectId: state.projectId,
            taskId: settlementInput.taskId,
            attemptId: settlementInput.attemptId,
            operationId: settlementInput.operationId,
            authorityBindingId: settlementInput.authorityBindingId,
            outcome: settlementInput.outcome,
            cleanupConfirmed: settlementInput.cleanupConfirmed,
            recoveryObligations: settlementInput.recoveryObligations,
            recoveryUnresolved: settlementInput.recoveryUnresolved,
          };
    const settlement = await saveTaskProgress(settlementRequest);
    if (settlement.status !== "completed")
      return finalizeOwnedFailure(settlement.reason, {
        state,
        completedTaskIds,
        processRestartRequired,
        recoveryIds: normalizedRecoveryObligations.map(
          (item) => item.recoveryId,
        ),
        recoveryObligations: normalizedRecoveryObligations,
      });
    startCandidates = settlement.candidates;
    if (preparationStopReason !== undefined)
      return cancelBeforeTask(completedTaskIds, preparationStopReason);
    if (settlementOutcome === "completed") completedTaskIds.push(taskId);
    const terminalState = recoveryRequired
      ? "recovery_required"
      : attemptStatus === "cancelled"
        ? "cancelled"
        : attemptStatus === "completed"
          ? null
          : "replan_required";
    if (terminalState) {
      let terminalReference: string | null = null;
      if (terminalState === "replan_required") {
        terminalReference = createCoordinatorStableId(
          attemptStatus === null ? "task-result-invalid" : "task-result",
          [taskId, attemptId],
        );
      }
      if (terminalState === "recovery_required") {
        terminalReference =
          createProjectRecoveryApplicationId(
            input.projectId,
            input.queueId,
            state.tasks.filter((task) => task.state === "recovery_required"),
          ) ??
          createCoordinatorStableId("project-unresolved-recovery", [
            input.projectId,
            input.queueId,
            ...state.tasks
              .filter((task) => task.recoveryUnresolved)
              .map((task) => task.definition.id)
              .sort(),
          ]);
      }
      return settleOwnedQueue(
        {
          state: terminalState,
          resumeCondition:
            terminalState === "recovery_required" ? "exact_recovery" : null,
          resultReference: terminalReference,
        },
        () => {
          const recoveryObligations = state.tasks.flatMap((task) =>
            task.recoveryObligations.map(({ kind, recoveryId }) =>
              Object.freeze({ kind, recoveryId }),
            ),
          );
          return result(input, {
            status: terminalState === "cancelled" ? "cancelled" : "blocked",
            reason:
              terminalState === "recovery_required"
                ? "coordinator_task_recovery_required"
                : terminalState === "cancelled"
                  ? "coordinator_operation_cancelled"
                  : "coordinator_replan_required",
            stateGeneration: state.generation,
            completedTaskIds,
            cleanupConfirmed: terminalState !== "recovery_required",
            manualRecoveryRequired: terminalState === "recovery_required",
            processRestartRequired,
            recoveryIds: recoveryObligations.map((entry) => entry.recoveryId),
            recoveryObligations,
            effectState:
              terminalState === "recovery_required"
                ? "unknown"
                : completedTaskIds.length === 0 && !effectStarted
                  ? "no_effect"
                  : "settled",
          });
        },
        { completedTaskIds, processRestartRequired },
      );
    }
  }

  if (!state.tasks.every((task) => task.state === "completed"))
    return finalizeOwnedFailure("coordinator_no_schedulable_task", {
      state,
      completedTaskIds,
    });
  return settleOwnedQueue(
    {
      state: "integration_pending",
      resumeCondition: "objective_integration",
      resultReference: createCoordinatorStableId("project-result", [
        input.projectId,
        input.queueId,
      ]),
    },
    () =>
      result(input, {
        status: "completed",
        reason: "coordinator_tasks_completed_integration_pending",
        stateGeneration: state.generation,
        completedTaskIds,
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "settled",
      }),
    { completedTaskIds },
  );
}

/**
 * 受付済み単発依頼と同じProcess内の実行制御値。
 * @responsibility 本文を保存せず、元pendingの表示・取消と同じ実行へ結合する。
 * @trace ARCH-000004
 * @invariant 単発をProject又はGraphへ変換しない。
 * @boundary 非公開の実行Lifecycle。新しいStore又は公開Portではない。
 */
type SingleTaskOperation = Readonly<{
  kind: "single";
  deps: Pick<
    Parameters<typeof createCoordinatorTaskRequests>[0],
    | "root"
    | "rootCapability"
    | "consumer"
    | "binding"
    | "projectId"
    | "authorize"
  >;
  requestId: string;
  record: SingleTaskRecord;
  queue: ProjectQueueEntry;
  command: SingleTaskCommand;
  workspaceTarget?: PreparedWorkspaceTarget | null;
  pair: TaskExecutionSelections | null;
  revision: string;
  controller: AbortController;
  item: { snapshot: ReturnType<typeof projectSingleTask> };
  authorized: () => boolean;
  admissionCurrent?: (() => boolean) | undefined;
}>;

/** Graphの受付済み要求と既存保存・記録の結合。 @trace ARCH-000004 */
type ScheduledOperation = CoordinatorExecutionDependencies &
  Readonly<{
    kind: "scheduled";
    input: ExecutionInput;
    admission?: Readonly<{
      state: ProjectExecutionState;
      queue: ProjectQueueEntry;
      candidates: TaskStartCandidates;
    }>;
  }>;

/**
 * Graphの受付時観測を、実Lease取得前の同じ順序で確定する。
 * @responsibility 初期状態・候補・Queue所属だけを確認し、実行と取得を行わない。
 * @trace ARCH-000004
 * @effect 既存EMの読取りだけ。
 * @failure 従来と同じ拒否結果を返す。
 * @boundary 元のProject／Queue観測と共通実行制御。
 */
function prepareScheduledOperation(
  persistence: CoordinatorStateContext,
  input: ExecutionInput,
  alreadyObserved?: ReturnType<typeof readExecutionState>,
  admission?: ScheduledOperation["admission"],
) {
  if (!(input.cancellationSignal instanceof AbortSignal))
    return blockExecution(input, "coordinator_execution_input_invalid");
  const observed = admission
    ? null
    : (alreadyObserved ??
      readExecutionState(
        persistence.repository,
        persistence.repositoryBindingId,
      ));
  if (observed && isCleanStateContention(observed))
    return blockExecution(input, observed.reason);
  const view = observed?.status === "completed" ? observed.value : null;
  const state =
    admission?.state ??
    view?.projects.find((entry) => entry.queueId === input.queueId);
  const queue =
    admission?.queue ??
    view?.queueEntries.find((entry) => entry.queueId === input.queueId);
  if ((!view && !admission) || !state || !queue)
    return blockExecution(input, "coordinator_execution_observation_unknown", {
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  const startCandidates = captureTaskStartCandidates(
    state,
    admission ? [admission.candidates] : view?.taskStartCandidates,
  );
  if (!startCandidates)
    return blockExecution(input, "coordinator_state_observation_unknown", {
      state,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  if (
    state.projectId !== input.projectId ||
    state.milestoneId !== input.milestoneId ||
    queue.projectId !== input.projectId ||
    queue.milestoneId !== input.milestoneId ||
    queue.repositoryRevision !== state.repositoryRevision
  )
    return blockExecution(input, "coordinator_execution_identity_mismatch");
  if (queue.state === "integration_pending")
    return queue.ownerGeneration === null
      ? result(input, {
          status: "completed",
          reason: "coordinator_tasks_already_integration_pending",
          stateGeneration: state.generation,
          completedTaskIds: state.tasks
            .filter((task) => task.state === "completed")
            .map((task) => task.definition.id),
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          effectState: "no_effect",
        })
      : blockExecution(input, "coordinator_queue_release_not_settled", {
          state,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
  if (queue.state !== "queued")
    return blockExecution(input, "coordinator_queue_not_startable", {
      state,
      manualRecoveryRequired: [
        "leased",
        "running",
        "recovery_required",
      ].includes(queue.state),
    });
  const executions = taskExecutionMap(state, input.taskExecutions);
  if (!executions)
    return blockExecution(input, "coordinator_task_execution_set_invalid", {
      state,
    });

  return {
    kind: "scheduled" as const,
    state,
    startCandidates,
    queue,
    executions,
  };
}

/**
 * 取得した同じLeaseを解放し、所有済みQueueの元世代だけを確定する。
 * @responsibility 物理解放一回と用途別の保存接続条件を一箇所で所有する。
 * @trace ARCH-000004
 * @effect Lease解放後だけ既存EMの解放確定へ進む。
 * @failure 拒否・例外を成功へ畳まず、投影は呼出し用途へ返す。
 * @invariant Graphは元Repository参照、単発は解放後にRoot再検証。running短絡は通常単発に限る。
 * @boundary 共通実行制御と既存Lease／保存Owner。
 */
type LeaseFinishTarget =
  | Readonly<{
      kind: "single" | "single-recovery";
      root: string;
      binding: string;
      queueId: string;
      queue: ProjectQueueEntry;
    }>
  | Readonly<{
      kind: "scheduled";
      repository: CoordinatorStateContext["repository"];
      binding: string;
      queueId: string;
      queue: ProjectQueueEntry | null;
    }>;
type LeaseFinishResult =
  | ReturnType<CoordinatorLease["release"]>
  | ReturnType<typeof settleCoordinatorSnapshotQueueLeaseRelease>
  | Readonly<{ status: "blocked"; reason: string }>;

export function finishOperationLease(
  lease: CoordinatorLease,
  target: Exclude<LeaseFinishTarget, { kind: "scheduled" }>,
): LeaseFinishResult;
export function finishOperationLease(
  lease: CoordinatorLease,
  target: Extract<LeaseFinishTarget, { kind: "scheduled" }>,
): LeaseFinishResult | Promise<LeaseFinishResult>;
export function finishOperationLease(
  lease: CoordinatorLease,
  target: LeaseFinishTarget,
): LeaseFinishResult | Promise<LeaseFinishResult> {
  const finish = (released: ReturnType<CoordinatorLease["release"]>) => {
    if (released.status !== "completed" || target.queue === null)
      return released;
    if (target.kind === "single" && target.queue.state === "running")
      return {
        status: "blocked" as const,
        reason: "coordinator_task_lease_release_unconfirmed",
      };
    const queue = target.queue;
    const settle = () =>
      settleCoordinatorSnapshotQueueLeaseRelease(
        target.kind === "scheduled"
          ? target.repository
          : { directory: target.root },
        target.binding,
        target.queueId,
        queue.generation,
        lease.ownerGeneration,
      );
    if (target.kind === "scheduled" && lease.releaseWithWait)
      return waitForStateContention(new AbortController().signal, settle).then(
        (result) => {
          if (result?.status === "completed") return result;
          return {
            status: "blocked" as const,
            reason:
              result?.reason ?? "coordinator_task_lease_release_unconfirmed",
            value: null,
            manualRecoveryRequired: true,
            recoveryId:
              result?.recoveryId ??
              leaseAcquisitionRecoveryId(
                target.binding,
                queue.projectId,
                target.queueId,
                lease.kind,
              ),
          };
        },
      );
    return settle();
  };
  return target.kind === "scheduled" && lease.releaseWithWait
    ? lease.releaseWithWait().then(finish)
    : finish(lease.release());
}

/**
 * 保存済み単発依頼を助言又はWorkspace編集の実処理へ接続する。
 * @responsibility 同じ選定・Root・認可・用途を保ち実行開始と資源記録を通知する。
 * @trace ARCH-000004
 * @effect 既存Advice又はTask実行だけ。
 * @failure 認可・Root・取消を実行前に確認し未知の回収状態を保持する。
 * @boundary 受付済み単発依頼と既存の技術実行。
 */
async function executeSingleTask(
  context: Readonly<{
    rootCapability: Repository;
    root: string;
    authorize: () => boolean;
    consumer: "workbench" | "coordinator_cli";
  }>,
  command: SingleTaskCommand,
  execution: SingleTaskExecution,
  signal: AbortSignal,
  started: () => Promise<void>,
  operationCreated: (
    operation: NonNullable<SingleTaskRecord["adviceOperation"]>,
  ) => Promise<void>,
): Promise<SingleTaskOutcome> {
  const { rootCapability, root, authorize, consumer } = context;
  // この実処理には同じ受付で捕捉・保存したrecordだけを渡す。
  // 依存Resolverの返却値はcreateCoordinatorTaskRequestsの受付で検査済み。
  const selection = execution.record.executionSelection;
  const empty = (reason: string): SingleTaskOutcome => ({
    mode: command.mode,
    status: "blocked",
    reason,
    cleanupConfirmed: true,
    recoveryIds: [],
    advice: null,
    workspaceResult: null,
  });
  if (!authorize() || resolveVerifiedRepositoryRoot(rootCapability) !== root)
    return empty("coordinator_task_selection_or_access_invalid");
  if (signal.aborted)
    return {
      ...empty("coordinator_task_cancelled_before_execution"),
      status: "cancelled",
    };
  if (command.mode === "read_only_advice") {
    const executed = await runRepositoryAdvice(
      rootCapability,
      {
        mode: command.mode,
        executionSelection: selection,
        prompt: command.prompt,
        contextReferences: command.contextReferences,
        allowedPaths: command.allowedPaths,
      },
      signal,
      {
        recoveryCorrelationId: execution.record.operationId,
        observeOperation: operationCreated,
        observeStarted: started,
      },
      authorize,
    );
    const { result, cleanupConfirmed } = executed;
    return {
      mode: command.mode,
      status: !cleanupConfirmed
        ? "unknown"
        : result.status === "completed"
          ? "completed"
          : signal.aborted
            ? "cancelled"
            : result.status,
      reason: result.reason,
      cleanupConfirmed,
      recoveryIds: [
        ...new Set(
          [executed.hostRecoveryId, executed.dockerRecoveryId].filter(
            (id): id is string => id !== null,
          ),
        ),
      ],
      advice:
        result.status === "completed"
          ? {
              facts: result.facts,
              sharedAnalysis: result.sharedAnalysis,
              additionalInferences: result.additionalInferences,
              nextOptions: result.nextOptions,
            }
          : null,
      workspaceResult: null,
    };
  }
  const result = await runCoordinatorSingleTaskAttempt(
    {
      attemptId: execution.record.attemptId,
      operationId: execution.record.operationId,
      authorityBindingId: execution.record.taskId,
      repositoryRevision: execution.repositoryRevision,
      repositoryRoot: root,
      cancellationSignal: signal,
      observeStarted: started,
      workspaceTarget: execution.target,
      selections: execution.taskExecutionSelections,
      taskRequest: {
        objective: command.prompt,
        acceptanceCriteria: [
          "Edit the selected working tree only. Do not commit, merge, push, stash, reset, clean, or promote changes.",
          "Preserve existing staged and unselected changes. Report unexpected changed paths.",
        ],
        allowedPaths: command.allowedPaths,
        readPaths: ["PROJECT_CONTEXT.md", ...command.allowedPaths],
        workClass: "bounded_implementation",
        planState: "complete",
        risk: "low",
        difficulty: "low",
        decisionImpact: "limited",
        isLocalCandidateOnly: true,
        hasUnresolvedDirection: false,
        requiresCrossContextAlignment: false,
      },
    },
    {
      consumer,
      hostInput: {
        root: rootCapability,
        recordingCurrent: authorize,
      },
    },
  );
  if (result.candidateId !== null)
    return {
      ...empty("coordinator_legacy_candidate_result_rejected"),
      status: "unknown",
      cleanupConfirmed: false,
      recoveryIds: result.recoveryIds,
    };
  return {
    mode: command.mode,
    status: result.effectState === "unknown" ? "unknown" : result.status,
    reason: result.reason,
    cleanupConfirmed: result.cleanupConfirmed,
    recoveryIds: result.recoveryIds,
    advice: null,
    workspaceResult: result.workspaceResult ?? null,
  };
}

/**
 * 単発固有の保存と用途実行を、共通取得・終結の間へ接続する。
 * @responsibility 開始・通知・結果保存と元pendingの表示を同じ順序で処理する。
 * @trace ARCH-000004
 * @effect 既存単発記録と明示された用途実行だけ。
 * @failure 元結果・回復参照・副次失敗を保全し、不明を成功へ補完しない。
 * @boundary 単発受付と共通実行Owner。
 */
async function executeSingleOperation(
  operation: SingleTaskOperation,
  acquired: ReturnType<typeof acquireCoordinatorSnapshotLease>,
) {
  const {
    deps,
    requestId,
    record,
    command,
    pair,
    revision,
    controller,
    item,
    authorized,
    admissionCurrent,
  } = operation;
  let effectStarted = false;
  const authorizeEffect = () =>
    authorized() && (effectStarted || admissionCurrent?.() !== false);
  let { queue } = operation;
  if (acquired.status !== "completed") {
    const closed = updateQueue(
      resolveExecutionStorageDirectory(deps.root),
      deps.binding,
      {
        kind: "close_unstarted",
        input: [
          requestId,
          queue.generation,
          acquired.reason,
          { now: () => Date.now() },
        ],
      },
    );
    const savedRecord =
      closed.status === "completed"
        ? (closed.value.singleTask ?? record)
        : record;
    item.snapshot = {
      ...projectSingleTask(
        requestId,
        savedRecord,
        closed.status === "completed" ? "blocked" : "unknown",
        acquired.reason,
      ),
      recoveryIds: [
        ...new Set([
          ...savedRecord.recoveryIds,
          ...(acquired.recoveryId ? [acquired.recoveryId] : []),
          ...(closed.status !== "completed" && closed.recoveryId
            ? [closed.recoveryId]
            : []),
        ]),
      ],
      secondaryFailures: closed.status === "completed" ? [] : [closed.reason],
    };
    return;
  }
  const lease = acquired.value;
  let phase = record;
  let createdOperation: SingleTaskRecord["adviceOperation"];
  let outcomeForFailure: SingleTaskOutcome | null = null;
  const secondaryFailures: string[] = [];
  const storeRecoveryIds = new Set<string>();
  const save = (next: SingleTaskRecord) => {
    const result = updateCoordinatorSingleTask(
      deps.root,
      deps.binding,
      requestId,
      queue.generation,
      lease,
      next,
    );
    if (result.status !== "completed") {
      secondaryFailures.push(result.reason);
      if (result.recoveryId) storeRecoveryIds.add(result.recoveryId);
      return false;
    }
    queue = result.value;
    if (!result.value.singleTask) return false;
    phase = result.value.singleTask;
    return true;
  };
  try {
    if (!save({ ...record, phase: "starting" })) {
      item.snapshot = projectSingleTask(
        requestId,
        record,
        "unknown",
        "coordinator_task_start_save_unconfirmed",
      );
      return;
    }
    const target = confirmPreparedWorkspaceTarget(
      deps.root,
      deps.binding,
      requestId,
      operation.workspaceTarget,
    );
    if (
      target.status !== "completed" ||
      !authorizeEffect() ||
      controller.signal.aborted
    ) {
      const next = {
        ...phase,
        phase: "settled" as const,
        status: controller.signal.aborted
          ? ("cancelled" as const)
          : ("blocked" as const),
        reason:
          target.status !== "completed"
            ? target.reason
            : "coordinator_task_not_started",
        cleanupConfirmed: true,
      };
      const confirmed = save(next);
      item.snapshot = projectSingleTask(
        requestId,
        next,
        confirmed ? next.status : "unknown",
        target.status !== "completed"
          ? target.reason
          : "coordinator_task_not_started",
      );
      return;
    }
    item.snapshot = projectSingleTask(requestId, phase, "running", null);
    const rawOutcome = await executeSingleTask(
      admissionCurrent ? { ...deps, authorize: authorizeEffect } : deps,
      command,
      {
        record,
        taskExecutionSelections: pair,
        repositoryRevision: revision,
        target: target.value,
      },
      controller.signal,
      async () => {
        if (
          !authorized() ||
          controller.signal.aborted ||
          !save({ ...phase, phase: "running" })
        )
          throw Error("task_start_save_unconfirmed");
        effectStarted = true;
      },
      async (operation) => {
        if (
          !authorizeEffect() ||
          controller.signal.aborted ||
          phase.adviceOperation ||
          phase.mode !== "read_only_advice" ||
          phase.phase !== "starting"
        )
          throw Error("task_operation_save_unconfirmed");
        const captured = snapshotPlainRecord(
          operation,
          new Set(["operationId", "hostRecoveryId"]),
        );
        if (
          !captured ||
          typeof captured.operationId !== "string" ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(captured.operationId) ||
          typeof captured.hostRecoveryId !== "string" ||
          !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,1023}$/u.test(captured.hostRecoveryId)
        )
          throw Error("task_operation_save_unconfirmed");
        createdOperation = Object.freeze({
          operationId: captured.operationId,
          hostRecoveryId: captured.hostRecoveryId,
        });
        if (!save({ ...phase, adviceOperation: createdOperation }))
          throw Error("task_operation_save_unconfirmed");
      },
    );
    const outcome = snapshotSingleTaskOutcome(rawOutcome);
    if (!outcome) throw new Error("coordinator_task_result_invalid");
    outcomeForFailure = outcome;
    const next: SingleTaskRecord = {
      ...phase,
      ...(createdOperation ? { adviceOperation: createdOperation } : {}),
      phase: "settled",
      status: outcome.status,
      reason: outcome.reason,
      cleanupConfirmed: outcome.cleanupConfirmed,
      recoveryIds: outcome.recoveryIds,
    };
    const workspaceResult = outcome.workspaceResult;
    if (
      outcome.mode !== command.mode ||
      (command.mode === "read_only_advice" &&
        (outcome.workspaceResult !== null ||
          (outcome.advice === null && outcome.status === "completed"))) ||
      (command.mode === "workspace_edit" &&
        (outcome.advice !== null ||
          (outcome.status === "completed" &&
            (!workspaceResult ||
              workspaceResult.workspaceId !== command.workspaceId))))
    )
      throw new Error("coordinator_task_result_invalid");
    const confirmed = save(next);
    item.snapshot = {
      ...projectSingleTask(
        requestId,
        next,
        confirmed && next.status !== "pending" ? next.status : "unknown",
        confirmed ? outcome.reason : "coordinator_task_result_save_unconfirmed",
      ),
      ...(confirmed && outcome.advice ? outcome.advice : {}),
      resultAvailable:
        confirmed && (outcome.advice !== null || workspaceResult !== null),
      workspaceResult: confirmed ? workspaceResult : null,
    };
  } catch {
    const unknown = {
      ...phase,
      ...(createdOperation ? { adviceOperation: createdOperation } : {}),
      phase: "settled" as const,
      status: "unknown" as const,
      reason:
        outcomeForFailure?.reason ?? "coordinator_task_execution_unconfirmed",
      cleanupConfirmed: outcomeForFailure?.cleanupConfirmed ?? false,
      recoveryIds: outcomeForFailure?.recoveryIds ?? phase.recoveryIds,
    };
    save(unknown);
    item.snapshot = projectSingleTask(
      requestId,
      unknown,
      "unknown",
      unknown.reason,
    );
  } finally {
    const settled =
      finishOperationLease(lease, {
        kind: "single",
        root: deps.root,
        binding: deps.binding,
        queueId: requestId,
        queue,
      }).status === "completed";
    item.snapshot = {
      ...item.snapshot,
      status: settled ? item.snapshot.status : "unknown",
      recoveryIds: [
        ...new Set([...item.snapshot.recoveryIds, ...storeRecoveryIds]),
      ],
      secondaryFailures: [
        ...item.snapshot.secondaryFailures,
        ...(settled ? [] : ["coordinator_task_lease_release_unconfirmed"]),
        ...secondaryFailures,
      ],
    };
  }
}

/** 最初の委譲直前にだけGroup記録を試し、任意記録の失敗で実行を止めない。 */
function beginObjectiveExecutionRecording(
  recording: ObjectiveExecutionRecording,
  continuedAt?: string,
): void {
  if (recording.attempted) return;
  recording.attempted = true;
  const groupId = continuedAt
    ? createCoordinatorStableId("group", [recording.groupId, continuedAt])
    : recording.groupId;
  try {
    const repository = getRepository(recording.repositoryRoot);
    const store =
      repository.status === "completed"
        ? getExecutionIntelligenceStore(repository.capability, true)
        : null;
    if (store) {
      const recorded = createGroup(store, {
        groupId,
        application: "CRDD",
        operation: "objective_execution",
        startedAt: new Date().toISOString(),
        metadata: {
          projectId: recording.projectId,
          requestId: recording.requestId,
        },
      });
      reportExecutionRecording(recorded);
      if (recorded.status === "completed") recording.group = { store, groupId };
    } else reportExecutionRecordingUnavailable(groupId);
  } catch (error) {
    reportExecutionRecordingUnavailable(groupId, error);
  }
}

/**
 * 本文欠測を空の正常回答と区別する公開初期値。
 * @responsibility 内部Pathや保存Bindingを公開しない。
 * @trace ARCH-000004
 * @input 依頼ID、記録、状態と固定理由。
 * @returns 非Authorityの表示値。
 * @precondition 上位で閲覧認可する。
 * @postcondition 候補採用・変更帰属を主張しない。公開・実行の両状態がcompletedなら成功理由はreasonだけへ残す。
 * @effect なし。
 * @failure 欠測はunknown。
 * @invariant 本文を永続化しない。
 * @boundary 表示投影。
 * @security 生Provider出力を返さない。
 * @concurrency 要求単位の値。
 */
export function projectSingleTask(
  requestId: string,
  record: SingleTaskRecord | null,
  status:
    | "accepted"
    | "running"
    | "completed"
    | "blocked"
    | "cancelled"
    | "unknown",
  reason: string | null,
) {
  return {
    requestId,
    resultAvailable: false,
    mode: record?.mode ?? null,
    executionSelection: record?.executionSelection ?? null,
    status,
    reason,
    taskId: record?.taskId ?? null,
    attemptId: record?.attemptId ?? null,
    operationId: record?.operationId ?? null,
    executionStatus: record?.status ?? null,
    primaryFailure:
      status === "completed" && record?.status === "completed"
        ? null
        : record
          ? record.reason
          : reason,
    cleanupConfirmed: record?.cleanupConfirmed ?? false,
    recoveryIds: record?.recoveryIds ?? [],
    secondaryFailures: [] as readonly string[],
    facts: [] as readonly Readonly<{
      text: string;
      references: readonly string[];
    }>[],
    sharedAnalysis: [] as readonly Readonly<{
      text: string;
      references: readonly string[];
    }>[],
    additionalInferences: [] as readonly Readonly<{
      text: string;
      references: readonly string[];
    }>[],
    nextOptions: [] as readonly Readonly<{
      text: string;
      references: readonly string[];
    }>[],
    candidate: null,
    workspaceResult: null as WorkspaceResult | null,
  };
}

/**
 * 単発依頼の開始・観測・取消を同じTaskへ結合する。
 * @responsibility 受付保存前のEffect 0、取消join、非永続本文を所有する。
 * @trace ARCH-000004
 * @input 検証済みRootと現在認可、受付時の選定解決、二つの既存実行Adapter。
 * @returns 開始・観測・取消・終了のProcess内Owner。
 * @precondition Snapshot初期化は別の明示操作で完了している。
 * @postcondition 本文喪失時は再実行せず元IDの欠測を返す。
 * @effect 既存Writer、Lease、用途別の実実行だけ。
 * @failure 保存・固定選定・認可・観測不能は停止し元IDを維持する。
 * @invariant 新Registry・Lock・保存先・Merge・採用を追加しない。
 * @boundary 公開Surfaceと単発実行。
 * @security 主体を固定し観測・取消時も現在認可する。
 * @concurrency 同時実行は既存Lease、取消・closeは元Promiseをjoinする。
 */
export function createCoordinatorTaskRequests(
  deps: Readonly<{
    root: string;
    rootCapability: Repository;
    consumer: "workbench" | "coordinator_cli";
    binding: string;
    projectId: string;
    principalId: string;
    authorize: () => boolean;
  }>,
) {
  const requests = new Map<
    string,
    {
      controller: AbortController;
      pending: Promise<void>;
      snapshot: ReturnType<typeof projectSingleTask>;
    }
  >();
  let closing = false;
  const authorized = () => {
    try {
      return deps.authorize() === true;
    } catch {
      return false;
    }
  };
  const observeSaved = (requestId: string) => {
    if (!authorized())
      return projectSingleTask(
        requestId,
        null,
        "unknown",
        "coordinator_task_not_available",
      );
    const current = readQueueState(
      resolveExecutionStorageDirectory(deps.root),
      deps.binding,
    );
    const record =
      current.status === "completed"
        ? current.value?.queueEntries.find(
            (entry) =>
              entry.queueId === requestId &&
              entry.projectId === deps.projectId &&
              entry.singleTask?.principalId === deps.principalId,
          )?.singleTask
        : null;
    if (!authorized())
      return projectSingleTask(
        requestId,
        null,
        "unknown",
        "coordinator_task_not_available",
      );
    return projectSingleTask(
      requestId,
      record ?? null,
      !record
        ? "unknown"
        : record.phase === "settled"
          ? record.status === "pending"
            ? "unknown"
            : record.status
          : record.phase === "accepted"
            ? "accepted"
            : "running",
      record?.reason ??
        (record
          ? "coordinator_task_saved_state"
          : "coordinator_task_not_available"),
    );
  };
  const recoverRecord = async (requestId: string) => {
    const current = readQueueState(
      resolveExecutionStorageDirectory(deps.root),
      deps.binding,
    );
    const queue =
      current.status === "completed"
        ? current.value?.queueEntries.find(
            (entry) =>
              entry.queueId === requestId &&
              entry.projectId === deps.projectId &&
              entry.singleTask?.principalId === deps.principalId,
          )
        : null;
    if (
      queue?.singleTask?.phase === "settled" &&
      queue.singleTask.cleanupConfirmed &&
      queue.singleTask.recoveryIds.length === 0 &&
      queue.ownerGeneration === null &&
      !current.value?.leaseIntents.some((entry) => entry.queueId === requestId)
    )
      return observeSaved(requestId);
    if (!queue?.singleTask || !current.value)
      return projectSingleTask(
        requestId,
        queue?.singleTask ?? null,
        "unknown",
        "coordinator_task_body_unavailable",
      );
    const reconciled = reconcileCoordinatorSnapshotLeaseOwnerLoss(
      deps.root,
      deps.binding,
      deps.projectId,
      requestId,
      "project-operation",
      observeLeaseOwner,
    );
    if (
      reconciled.status !== "completed" ||
      !reconciled.value.queue?.singleTask
    )
      return {
        ...projectSingleTask(
          requestId,
          queue.singleTask,
          "unknown",
          "coordinator_task_body_unavailable",
        ),
        recoveryIds: [
          ...new Set([
            ...queue.singleTask.recoveryIds,
            ...(reconciled.status !== "completed" && reconciled.recoveryId
              ? [reconciled.recoveryId]
              : []),
          ]),
        ],
        secondaryFailures: [reconciled.reason],
      };
    const observed = reconciled.value.queue;
    if (
      observed.singleTask?.phase === "settled" &&
      observed.singleTask.cleanupConfirmed &&
      observed.singleTask.recoveryIds.length === 0
    )
      return projectSingleTask(
        requestId,
        observed.singleTask,
        "unknown",
        "coordinator_task_body_unavailable",
      );
    if (observed.singleTask?.phase === "accepted") {
      const closed = updateQueue(
        resolveExecutionStorageDirectory(deps.root),
        deps.binding,
        {
          kind: "close_unstarted",
          input: [
            requestId,
            observed.generation,
            "coordinator_task_not_started",
            { now: () => Date.now() },
          ],
        },
      );
      const result = projectSingleTask(
        requestId,
        closed.status === "completed"
          ? (closed.value.singleTask ?? null)
          : observed.singleTask,
        "unknown",
        "coordinator_task_body_unavailable",
      );
      return closed.status === "completed"
        ? result
        : {
            ...result,
            recoveryIds: [
              ...new Set([
                ...result.recoveryIds,
                ...(closed.recoveryId ? [closed.recoveryId] : []),
              ]),
            ],
            secondaryFailures: [closed.reason],
          };
    }
    const acquired = acquireCoordinatorSnapshotLease(
      deps.root,
      deps.binding,
      deps.projectId,
      requestId,
      "project-operation",
      observed.state === "recovery_required" ? observed.generation : undefined,
    );
    if (acquired.status !== "completed")
      return {
        ...projectSingleTask(
          requestId,
          observed.singleTask ?? null,
          "unknown",
          "coordinator_task_body_unavailable",
        ),
        recoveryIds: [
          ...new Set([
            ...(observed.singleTask?.recoveryIds ?? []),
            ...(acquired.recoveryId ? [acquired.recoveryId] : []),
          ]),
        ],
        secondaryFailures: [acquired.reason],
      };
    const lease = acquired.value;
    let savedQueue = observed;
    let result = projectSingleTask(
      requestId,
      observed.singleTask ?? null,
      "unknown",
      "coordinator_task_body_unavailable",
    );
    try {
      const record = observed.singleTask;
      if (!record) return result;
      const recovery = await recoverSingleTaskOperation(deps, record);
      const next: SingleTaskRecord = {
        ...record,
        phase: "settled",
        status: record.status === "pending" ? "unknown" : record.status,
        reason:
          record.status === "pending"
            ? "coordinator_task_owner_lost"
            : record.reason,
        cleanupConfirmed: recovery.cleanupConfirmed,
        recoveryIds: recovery.recoveryIds,
      };
      const saved = updateCoordinatorSingleTask(
        deps.root,
        deps.binding,
        requestId,
        observed.generation,
        lease,
        next,
      );
      if (saved.status === "completed") savedQueue = saved.value;
      result = {
        ...projectSingleTask(
          requestId,
          next,
          "unknown",
          "coordinator_task_body_unavailable",
        ),
        recoveryIds:
          saved.status === "completed"
            ? next.recoveryIds
            : [
                ...new Set([
                  ...record.recoveryIds,
                  ...next.recoveryIds,
                  ...(saved.recoveryId ? [saved.recoveryId] : []),
                ]),
              ],
        secondaryFailures: saved.status === "completed" ? [] : [saved.reason],
      };
    } catch {
      result = {
        ...result,
        secondaryFailures: [
          ...result.secondaryFailures,
          "coordinator_task_recovery_unconfirmed",
        ],
      };
    } finally {
      const settled = finishOperationLease(lease, {
        kind: "single-recovery",
        root: deps.root,
        binding: deps.binding,
        queueId: requestId,
        queue: savedQueue,
      });
      if (settled.status !== "completed")
        result = {
          ...result,
          recoveryIds: [
            ...new Set([
              ...result.recoveryIds,
              ...("recoveryId" in settled && settled.recoveryId
                ? [settled.recoveryId]
                : []),
            ]),
          ],
          secondaryFailures: [
            ...result.secondaryFailures,
            settled.reason,
            "coordinator_task_lease_release_unconfirmed",
          ],
        };
    }
    return authorized()
      ? result
      : projectSingleTask(
          requestId,
          null,
          "unknown",
          "coordinator_task_not_available",
        );
  };
  const recoverSaved = async (requestId: string) => {
    const result = await recoverRecord(requestId);
    const item = requests.get(requestId);
    if (item && authorized()) item.snapshot = result;
    return result;
  };
  return Object.freeze({
    async start(
      raw: unknown,
      signal?: AbortSignal,
      workspaceTarget?: PreparedWorkspaceTarget | null,
      admissionCurrent?: () => boolean,
    ) {
      const command = inspectSingleTaskCommand(raw);
      const admissionAllowed = () => {
        try {
          return admissionCurrent?.() !== false;
        } catch {
          return false;
        }
      };
      const mayAdmit = () => authorized() && admissionAllowed();
      if (!command || closing || signal?.aborted || !mayAdmit())
        return {
          status: "blocked" as const,
          requestId: null,
          reason: "coordinator_task_request_rejected",
        };
      const hash = (value: unknown) =>
        createHash("sha256").update(JSON.stringify(value)).digest("hex");
      const requestHash = hash(command);
      let current = readQueueState(
        resolveExecutionStorageDirectory(deps.root),
        deps.binding,
      );
      const existing =
        current.status === "completed"
          ? current.value?.queueEntries.find(
              (entry) => entry.queueId === command.requestId,
            )
          : null;
      if (existing) {
        if (
          !mayAdmit() ||
          existing.projectId !== deps.projectId ||
          existing.singleTask?.principalId !== deps.principalId
        )
          return {
            status: "blocked" as const,
            requestId: null,
            reason: "coordinator_task_request_rejected",
          };
        if (existing.requestHash !== requestHash)
          return {
            status: "blocked" as const,
            requestId: command.requestId,
            reason: "coordinator_task_request_identity_conflict",
          };
        return {
          status: "accepted" as const,
          requestId: command.requestId,
          reason: "coordinator_task_request_reused",
        };
      }
      const preparedWorkspace = capturePreparedWorkspaceTarget(workspaceTarget);
      if (command.workspaceId && !preparedWorkspace)
        return {
          status: "blocked" as const,
          requestId: null,
          reason: "coordinator_workspace_target_changed",
        };
      if (
        [...requests.values()].some((item) =>
          ["accepted", "running"].includes(item.snapshot.status),
        )
      )
        return {
          status: "blocked" as const,
          requestId: null,
          reason: "coordinator_task_request_active",
        };
      // 現在Sessionの本文は最大100件。実行中の依頼を追出さない。
      for (const [id, item] of requests)
        if (
          requests.size >= 100 &&
          !["accepted", "running"].includes(item.snapshot.status)
        )
          requests.delete(id);
      if (requests.size >= 100)
        return {
          status: "blocked" as const,
          requestId: null,
          reason: "coordinator_task_session_capacity",
        };
      if (current.status === "completed" && current.value) {
        for (const queue of current.value.queueEntries) {
          const record = queue.singleTask;
          if (
            queue.projectId !== deps.projectId ||
            record?.principalId !== deps.principalId ||
            (record.phase === "settled" &&
              record.cleanupConfirmed &&
              record.recoveryIds.length === 0 &&
              queue.ownerGeneration === null &&
              !current.value.leaseIntents.some(
                (entry) => entry.queueId === queue.queueId,
              ))
          )
            continue;
          const item = requests.get(queue.queueId);
          if (item) await item.pending;
          if (!mayAdmit())
            return {
              status: "blocked" as const,
              requestId: null,
              reason: "coordinator_task_request_rejected",
            };
          const recovered = await recoverSaved(queue.queueId);
          if (!mayAdmit())
            return {
              status: "blocked" as const,
              requestId: null,
              reason: "coordinator_task_request_rejected",
            };
          if (
            !recovered.cleanupConfirmed ||
            recovered.recoveryIds.length ||
            recovered.secondaryFailures.length
          )
            return {
              status: "blocked" as const,
              requestId: queue.queueId,
              reason: "coordinator_task_previous_cleanup_unconfirmed",
            };
        }
        current = readQueueState(
          resolveExecutionStorageDirectory(deps.root),
          deps.binding,
        );
      }
      const concurrent =
        current.status === "completed"
          ? current.value?.queueEntries.find(
              (entry) => entry.queueId === command.requestId,
            )
          : null;
      if (concurrent) {
        if (
          !mayAdmit() ||
          concurrent.projectId !== deps.projectId ||
          concurrent.singleTask?.principalId !== deps.principalId
        )
          return {
            status: "blocked" as const,
            requestId: null,
            reason: "coordinator_task_request_rejected",
          };
        return concurrent.requestHash === requestHash
          ? {
              status: "accepted" as const,
              requestId: command.requestId,
              reason: "coordinator_task_request_reused",
            }
          : {
              status: "blocked" as const,
              requestId: command.requestId,
              reason: "coordinator_task_request_identity_conflict",
            };
      }
      const selection = resolveSingleTaskSelection(
        deps.rootCapability,
        command,
      );
      const pair = selection?.kind === "task" ? selection.selections : null;
      const primary =
        selection?.kind === "advice" ? selection.selection : pair?.executor;
      const revision =
        readRepositoryRevision(deps.rootCapability)?.revisionIdentity ?? null;
      if (
        closing ||
        !mayAdmit() ||
        [...requests.values()].some((item) =>
          ["accepted", "running"].includes(item.snapshot.status),
        )
      )
        return {
          status: "blocked" as const,
          requestId: null,
          reason: "coordinator_task_request_active",
        };
      if (
        current.status !== "completed" ||
        !current.value ||
        !primary ||
        primary.role !==
          (command.mode === "read_only_advice" ? "advice" : "executor") ||
        (command.mode === "workspace_edit" && !pair) ||
        !revision
      )
        return {
          status: "blocked" as const,
          requestId: null,
          reason: "coordinator_task_configuration_unavailable",
        };
      const requestId = command.requestId;
      const record: SingleTaskRecord = {
        principalId: deps.principalId,
        mode: command.mode,
        executionSelection: primary,
        taskId: `task-${randomUUID()}`,
        attemptId: `attempt-${randomUUID()}`,
        operationId: `operation-${randomUUID()}`,
        phase: "accepted",
        status: "pending",
        reason: null,
        cleanupConfirmed: false,
        recoveryIds: [],
      };
      const queue: ProjectQueueEntry = {
        historySettled: false,
        queueId: requestId,
        projectId: deps.projectId,
        milestoneId: null,
        requestHash,
        originLane: "interactive",
        repositoryRevision: revision,
        scopeHash: hash([
          command.mode,
          command.workspaceId,
          command.allowedPaths,
        ]),
        state: "queued",
        generation: 1,
        ownerGeneration: null,
        resumeCondition: null,
        resultReference: null,
        workspaceId: command.workspaceId,
        singleTask: record,
      };
      const saved = createQueue(
        resolveExecutionStorageDirectory(deps.root),
        deps.binding,
        { kind: "single", input: [queue] },
      );
      if (saved.status !== "completed")
        return {
          status: "blocked" as const,
          requestId: null,
          reason:
            saved.reason === "coordinator_queue_identity_conflict"
              ? "coordinator_task_request_rejected"
              : saved.reason,
        };
      if (saved.reason === "coordinator_single_task_reused")
        return {
          status: "accepted" as const,
          requestId,
          reason: "coordinator_task_request_reused",
        };
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) controller.abort();
      const item = {
        controller,
        pending: Promise.resolve(),
        snapshot: projectSingleTask(requestId, record, "accepted", null),
      };
      requests.set(requestId, item);
      item.pending = runCoordinatorOperation({
        kind: "single",
        deps,
        requestId,
        record,
        queue,
        command,
        workspaceTarget: preparedWorkspace,
        pair,
        revision,
        controller,
        item,
        authorized,
        admissionCurrent: admissionCurrent ? admissionAllowed : undefined,
      }).finally(() => signal?.removeEventListener("abort", abort));
      return { status: "accepted" as const, requestId, reason: null };
    },
    async observe(requestId: string) {
      if (!authorized())
        return projectSingleTask(
          requestId,
          null,
          "unknown",
          "coordinator_task_not_available",
        );
      const item = requests.get(requestId);
      if (item) return item.snapshot;
      return observeSaved(requestId);
    },
    async cancel(requestId: string) {
      if (!authorized())
        return projectSingleTask(
          requestId,
          null,
          "unknown",
          "coordinator_task_not_available",
        );
      const item = requests.get(requestId);
      if (!item) return recoverSaved(requestId);
      if (["accepted", "running"].includes(item.snapshot.status))
        item.controller.abort();
      await item.pending;
      if (
        authorized() &&
        (item.snapshot.status === "unknown" ||
          !item.snapshot.cleanupConfirmed ||
          item.snapshot.recoveryIds.length ||
          item.snapshot.secondaryFailures.length)
      )
        return recoverSaved(requestId);
      return authorized()
        ? item.snapshot
        : projectSingleTask(
            requestId,
            null,
            "unknown",
            "coordinator_task_not_available",
          );
    },
    async wait(requestId: string) {
      const item = requests.get(requestId);
      if (!item) return observeSaved(requestId);
      if (!authorized())
        return projectSingleTask(
          requestId,
          null,
          "unknown",
          "coordinator_task_not_available",
        );
      await item.pending;
      return authorized()
        ? item.snapshot
        : projectSingleTask(
            requestId,
            null,
            "unknown",
            "coordinator_task_not_available",
          );
    },
    async join(requestId: string) {
      await requests.get(requestId)?.pending;
    },
    async close() {
      closing = true;
      for (const item of requests.values()) item.controller.abort();
      await Promise.all([...requests.values()].map((item) => item.pending));
      requests.clear();
    },
  });
}

/**
 * Repositoryと認可済み主体に固定した単発受付を構成する。
 * @responsibility 固定選定の搬送、用途別実行、cleanupの結果搬送。
 * @trace ARCH-000004
 * @input 検証済みRoot、実Project／主体、現在認可と任意の利用側種別。
 * @returns 既存Writerへ接続する開始・観測・取消Owner。
 * @precondition 検証済みRepository内で既存Snapshotを準備できる。
 * @postcondition 編集は借用Workspace、助言は固定Contextだけを使用する。
 * @effect 構築時に既存Snapshotを初期化・確認する。明示開始時だけ外部Providerを利用する。
 * @failure 固定選定相関・Root・認可が変われば外部Effect前に停止。
 * @invariant 自動Commit・Candidate固定・Merge・Promotionを行わない。
 * @boundary 公開Task OwnerとCoordinator技術Runtime。
 * @security Prompt・Context・助言本文は永続化しない。
 * @concurrency 各要求が独立した実行閉包と取消Signalを持つ。
 */
export function openTaskSession(context: TaskSessionContext) {
  const { rootCapability, projectId, principalId, authorize } = context;
  if (!isPrincipalId(principalId))
    throw new Error("coordinator_task_principal_invalid");
  const consumer = context.consumer ?? "workbench";
  const root = resolveVerifiedRepositoryRoot(rootCapability);
  if (root === null) throw new Error("coordinator_task_root_invalid");
  const binding = deriveCoordinatorRepositoryBindingId(root);
  const initialized = initializeExecutionStore(
    { directory: root },
    binding,
    () => authorize() && prepareExecutionStorageIgnore(rootCapability),
  );
  if (initialized.status !== "completed")
    throw new Error("coordinator_task_state_initialization_blocked");
  return createCoordinatorTaskRequests({
    root,
    rootCapability,
    consumer,
    binding,
    projectId,
    principalId,
    authorize,
  });
}

/**
 * 信頼した公開Surfaceが現在認可を結合するSession入力。
 * @responsibility Root権限・主体・認可再確認を同じ既存Ownerへ渡す。
 * @trace ARCH-000004
 * @shape 検証済みRoot、Project／Principal、現在認可callbackと利用用途。
 * @invariant JSON要求からRoot権限や認可callbackを生成しない。
 * @boundary 正式Package利用側とTask Session。
 * @security authorizeは操作と待機後に既存Ownerが再評価する。
 * @compatibility 新形式専用。旧Profile Storeを受け付けない。
 */
export type TaskSessionContext = Readonly<{
  rootCapability: Repository;
  projectId: string;
  principalId: string;
  authorize: () => boolean;
  consumer?: "workbench" | "coordinator_cli";
}>;

/**
 * 一つの受付Ownerが提供する開始・観測・取消・終了契約。
 * @responsibility 実装と同じ非永続Session寿命を公開する。
 * @trace ARCH-000004
 * @shape 既存start／observe／cancel／wait／closeの読取り専用操作。
 * @invariant 別Sessionへ要求本文や取消Ownerを複製しない。
 * @boundary Workbenchの複数HTTP要求と同一Task Owner。
 * @security 内部Map・保存Writer・Authorityを公開しない。
 * @compatibility 新しい管理状態を追加せず既存実装から導出する。
 */
export type TaskSession = ReturnType<typeof openTaskSession>;

/**
 * 単発Taskの表示・回収結果。
 * @responsibility 待機結果、一次失敗とSession終了失敗を同じ元参照へ保持する。
 * @trace ARCH-000004
 * @shape 既存の公開Snapshotと、受付前拒否に共通の状態・理由・回収情報。
 * @invariant 終了失敗で元の一次理由やTask参照を消さない。
 * @boundary 正式一回実行とCLI等の結果表示。
 * @security 生出力・内部Root・認証値を含めない。
 * @compatibility 保存Schemaとは別の非永続結果。
 */
export type TaskRunResult = Readonly<
  Omit<
    Partial<Awaited<ReturnType<TaskSession["wait"]>>>,
    "requestId" | "status" | "reason" | "cleanupConfirmed" | "secondaryFailures"
  > & {
    requestId: string | null;
    status:
      | "accepted"
      | "running"
      | "completed"
      | "blocked"
      | "cancelled"
      | "unknown";
    reason: string | null;
    cleanupConfirmed: boolean;
    secondaryFailures: readonly string[];
  }
>;

/**
 * 既存SessionでTaskを一回だけ実行し終了を待つ。
 * @responsibility 開始・待機・finally closeを一つのOwnerで完結させる。
 * @trace ARCH-000004
 * @input context: 信頼したSurfaceの現在認可、command: 未信頼要求、signal: 取消。
 * @returns 元要求参照と一次結果、独立した回収・終了失敗。
 * @precondition 呼出し元は自身のSignal登録・解除を所有する。
 * @postcondition 開いたSessionは拒否・例外・取消でも一回closeして待機する。
 * @effect 既存Task Ownerの受付・保存・実行だけ。
 * @failure 開始前はblocked、開始後不明はunknown。close失敗を副次失敗として保持する。
 * @invariant 自動再送・新しいMap・Lock・回復記録を追加しない。
 * @boundary CLI／Package利用側と既存Task Session。
 * @security 例外本文・秘密値を結果へ転記しない。
 * @concurrency 既存の取消joinとSession closeをawaitする。
 */
export async function runTask(
  context: TaskSessionContext,
  command: unknown,
  signal?: AbortSignal,
  workspaceTarget?: PreparedWorkspaceTarget | null,
): Promise<TaskRunResult> {
  const cancellation = readExecutionCancellation(signal);
  if (cancellation !== false)
    return Object.freeze({
      status: "blocked",
      requestId: null,
      reason:
        cancellation === null
          ? "task_cancellation_invalid"
          : "task_cancelled_before_start",
      cleanupConfirmed: true,
      secondaryFailures: [],
    });
  let session: TaskSession | null = null;
  let startIssued = false;
  let result: TaskRunResult = {
    status: "blocked",
    requestId: null,
    reason: "task_entry_unconfirmed",
    cleanupConfirmed: false,
    secondaryFailures: [],
  };
  try {
    session = openTaskSession(context);
    startIssued = true;
    const started = await session.start(command, signal, workspaceTarget);
    result = { ...result, ...started };
    if (started.status === "accepted" && started.requestId)
      result = await session.wait(started.requestId);
  } catch {
    result = {
      ...result,
      status: startIssued ? "unknown" : "blocked",
      reason: result.reason ?? "task_entry_unconfirmed",
      cleanupConfirmed: false,
      primaryFailure: result.primaryFailure ?? "task_entry_unconfirmed",
    };
  } finally {
    try {
      await session?.close();
    } catch {
      result = {
        ...result,
        status: "unknown",
        cleanupConfirmed: false,
        secondaryFailures: [
          ...result.secondaryFailures,
          "task_owner_join_unconfirmed",
        ],
      };
    }
  }
  return Object.freeze(result);
}

/**
 * ScopeをIDへ混ぜず、同じ主体の要求内容を一意に照合する。
 * @responsibility 新規と再開の区分だけをHashから除外する。
 * @trace ARCH-000004
 * @input 捕捉済み要求、Repository結合、認証主体、既存のIdentity演算。
 * @returns 保存受付へ渡す元IDと内容Hash。
 * @effect なし。
 * @security Hashは実行許可ではない。
 */
function createObjectiveIntake(
  request: CoordinatorObjectiveRequest,
  repositoryBindingId: string,
  principalId: string,
) {
  const { operation, ...content } = request;
  void operation;
  return {
    operation: request.operation,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    queueId: objectiveQueueId(
      repositoryBindingId,
      principalId,
      request.requestId,
    ),
    requestHash: hashCoordinatorContent(
      JSON.stringify({ ...content, authenticatedPrincipalId: principalId }),
    ),
  };
}

/**
 * 同じ保存断面から再送・終了済み再開を観測だけで返す。
 * @responsibility Scope差と内容差を拒否し、未完了の明示再開だけ従来実行へ渡す。
 * @trace ARCH-000004
 * @input 捕捉済み要求、認可済みRootと結合、同じ要求から導出した受付識別値、保存で再送と確認済みか。
 * @returns 観測結果又は実行受付を続けるnull。
 * @effect 保存読取りだけ。回復・初期化・EI・履歴保守はしない。
 * @failure 読取り不明を不存在へ補完しない。
 * @security 別Scopeの投影を返さず、保存値を実行Authorityにしない。
 */
function readObjectiveReplay(
  request: CoordinatorObjectiveRequest,
  workingDirectory: string,
  repositoryBindingId: string,
  intake: ReturnType<typeof createObjectiveIntake>,
  reuseObserved = false,
  alreadyObserved?: ReturnType<typeof readExecutionState>,
) {
  const observed =
    alreadyObserved ??
    readExecutionState(
      resolveExecutionStorageDirectory(workingDirectory),
      repositoryBindingId,
    );
  if (
    observed.status === "blocked" &&
    observed.reason === "coordinator_snapshot_lock_contended" &&
    !observed.manualRecoveryRequired &&
    observed.recoveryId === null
  )
    return blocked(request, observed.reason);
  if (observed.status !== "completed")
    return Object.freeze({
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: observed.reason,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown" as const,
      recoveryIds: Object.freeze(
        observed.recoveryId ? [observed.recoveryId] : [],
      ),
    });
  const queue = observed.value?.queueEntries.find(
    (entry) => entry.queueId === intake.queueId,
  );
  if (!queue)
    return !reuseObserved && request.operation === "resume"
      ? blocked(request, "coordinator_objective_request_not_found")
      : null;
  if (
    queue.singleTask ||
    queue.projectId !== request.projectId ||
    queue.milestoneId !== request.milestoneId ||
    queue.requestHash !== intake.requestHash
  )
    return blocked(request, "coordinator_objective_request_identity_conflict");
  const terminal = queue.state === "completed" || queue.state === "cancelled";
  const releasePending =
    queue.ownerGeneration != null &&
    (terminal ||
      queue.state === "integration_pending" ||
      queue.state === "preparation_blocked");
  if (
    !reuseObserved &&
    request.operation === "resume" &&
    (!terminal || releasePending)
  )
    return null;
  const state = observed.value?.projects.find(
    (entry) =>
      entry.queueId === queue.queueId &&
      entry.projectId === queue.projectId &&
      entry.milestoneId === queue.milestoneId &&
      entry.repositoryRevision === queue.repositoryRevision,
  );
  if (releasePending)
    return blocked(
      request,
      "coordinator_queue_release_settlement_unconfirmed",
      {
        queueId: queue.queueId,
        knownState: state ?? null,
        recoveryIds: [
          leaseAcquisitionRecoveryId(
            repositoryBindingId,
            queue.projectId,
            queue.queueId,
            "project-operation",
          ),
        ],
      },
    );
  return projectObjectiveReplay(
    request,
    queue,
    state ?? null,
    state
      ? captureTaskStartCandidates(state, observed.value?.taskStartCandidates)
      : null,
  );
}

/**
 * 保存済みQueueと対応するProjectから、回復情報を落とさず観測結果を作る。
 * @responsibility 先行読取りと保存競合の返却を同じ相関規則へ接続する。
 * @trace ARCH-000004
 * @input 元要求、保存Queue、同断面のProject又は欠測。
 * @returns Authorityを持たない状態投影。
 * @effect なし。
 * @security 別版・別Milestoneの投影を元実行へ付け替えない。
 */
function projectObjectiveReplay(
  request: CoordinatorObjectiveRequest,
  queue: ProjectQueueEntry,
  observedState: ProjectExecutionState | null,
  candidates: TaskStartCandidates | null,
) {
  const state =
    observedState?.queueId === queue.queueId &&
    observedState.projectId === queue.projectId &&
    observedState.milestoneId === queue.milestoneId &&
    observedState.repositoryRevision === queue.repositoryRevision
      ? observedState
      : null;
  const obligations =
    state?.tasks.flatMap((task) =>
      task.recoveryObligations.filter((item) => item.phase !== "settled"),
    ) ?? [];
  if (state && !candidates)
    return blocked(request, "coordinator_state_observation_unknown", {
      knownState: state,
      queueId: queue.queueId,
    });
  const recoveryRequired =
    obligations.length > 0 ||
    queue.state === "recovery_required" ||
    state?.tasks.some((task) => task.recoveryUnresolved) === true;
  return createCoordinatorObjectiveResult(request, {
    status: recoveryRequired
      ? "blocked"
      : queue.state === "cancelled"
        ? "cancelled"
        : queue.state === "completed" || state?.milestone.state === "accepted"
          ? "completed"
          : "blocked",
    reason:
      queue.state === "preparation_blocked"
        ? (queue.resumeCondition ?? "coordinator_workspace_preparation_failed")
        : "coordinator_objective_request_reused",
    queueId: queue.queueId,
    projection:
      recoveryRequired && obligations.length === 0
        ? null
        : state &&
            (queue.state !== "completed" ||
              state.milestone.state === "accepted") &&
            (queue.state !== "cancelled" ||
              state.milestone.state === "cancelled")
          ? projectCoordinatorState(state, candidates)
          : null,
    // 観測要求は資源を作らない。元実行の終了確認はProjectionの進行と区別する。
    cleanupConfirmed: !recoveryRequired,
    manualRecoveryRequired: recoveryRequired,
    processRestartRequired: obligations.some(
      (entry) => entry.kind === "execution_process",
    ),
    recoveryIds: obligations.map((entry) => entry.recoveryId),
    recoveryObligations: obligations.map(({ kind, recoveryId }) => ({
      kind,
      recoveryId,
    })),
    effectState: recoveryRequired ? "unknown" : "no_effect",
  });
}

/**
 * 初回の選定要求又は保存値の継承と明示要求を照合する。
 * @responsibility 新しい選択希望を保存済みの別選定へ黙って畳まない。
 * @trace ARCH-000004
 * @input request: 検査済み要求、selections: 検査済み選定組、initial: 初回保存前。
 * @returns 今回明示された条件を満たす場合だけtrue。
 * @precondition 初回はcodec通過後、再受付は保存Reader通過後の組を使う。
 * @postcondition 省略は初回なら既定選定、再受付なら保存値の継承とする。
 * @effect N/A: 同期比較だけ。
 * @failure 明示値・選定元・分類不一致をfalseで拒否する。
 * @invariant 現在設定・Catalogを再読せず、保存値を再構成しない。
 * @boundary Objective受付とenqueue前の固定選定。
 * @security 真偽を実行Authorityにしない。
 * @concurrency 既存CASと実行Leaseは別に維持する。
 */
function objectiveSelectionsMatch(
  request: CoordinatorObjectiveRequest,
  selections: TaskExecutionSelections,
  initial: boolean,
): boolean {
  if (
    (initial || request.workType !== undefined) &&
    (selections.executor.workType !== (request.workType ?? null) ||
      selections.reviewer.workType !== (request.workType ?? null))
  )
    return false;
  if (!request.choice)
    return !initial || selections.executor.source !== "explicit";
  return (
    selections.executor.source === "explicit" &&
    selections.executor.provider === request.choice.provider &&
    selections.executor.modelIdentifier === request.choice.model &&
    selections.executor.reasoningEffort === request.choice.effort
  );
}

/**
 * 回復の技術終端を種類別の固定条件へ照合する。
 *
 * @responsibility Dockerの技術終端とProcess回復の既存終端を区別する。
 * @trace ARCH-000008
 * @input value: 下位結果、kind: 保存済み義務種別、recoveryId: exact回復参照。
 * @returns 同じ義務の技術終端条件を満たす場合だけtrue。
 * @precondition 義務種別と回復参照は上位の検証済み状態から取得する。
 * @postcondition DockerのtrueをTask成功・操作除去へ強めない。
 * @effect N/A: exactRecoveryCompletedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure Docker結果の欠落・別ID・旧形式・不明・getter／Proxyはfalse。
 * @invariant 過去失敗や回復参照を成功・空値へ変更しない。
 * @boundary 下位の固定診断と上位settled遷移。
 * @security Dockerの全共同fieldを閉じた値として検証し、受領Authorityを発行しない。
 * @concurrency N/A: exactRecoveryCompletedは共有非同期状態を持たない同期処理である。
 */
function exactRecoveryCompleted(
  value: unknown,
  kind: string,
  recoveryId: string,
) {
  if (kind === "docker") {
    const record = snapshotPlainRecord(
      value,
      new Set([
        "contract",
        "status",
        "reason",
        "recoveryId",
        "dockerCleanupConfirmed",
        "hostCleanupConfirmed",
        "locksReleased",
        "historyConfirmed",
        "operationRetained",
        "operationRemovalConfirmed",
        "taskRecoveryCompleted",
        "cleanupReason",
      ]),
    );
    return (
      record?.contract === "crdd-coordinator/current-task-recovery" &&
      record.status === "completed" &&
      record.reason === "docker_task_recovery_terminal_confirmed" &&
      record.recoveryId === recoveryId &&
      record.dockerCleanupConfirmed === true &&
      record.hostCleanupConfirmed === true &&
      record.locksReleased === true &&
      record.historyConfirmed === true &&
      record.operationRetained === true &&
      record.operationRemovalConfirmed === false &&
      record.taskRecoveryCompleted === false &&
      record.cleanupReason === null
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Readonly<Record<string, unknown>>;
  return (
    record.status === "recovered" &&
    record.recoveryId === null &&
    record.manualRecoveryRequired !== true
  );
}

/**
 * 回復 Correlation Bindingsを観測する。
 *
 * @responsibility 回復 Correlation Bindingsの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、correlationIds: readonly string[]
 * @returns inspectRecoveryCorrelationBindingsの計算結果を返す。
 * @precondition 「value: unknown、correlationIds: readonly string[]」がinspectRecoveryCorrelationBindingsの入力契約を満たす。
 * @postcondition inspectRecoveryCorrelationBindingsの責務を完了した結果だけを返す。
 * @effect N/A: inspectRecoveryCorrelationBindingsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRecoveryCorrelationBindingsは独自の失敗分岐を所有しない。
 * @invariant inspectRecoveryCorrelationBindingsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRecoveryCorrelationBindingsはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectRecoveryCorrelationBindingsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectRecoveryCorrelationBindingsは共有非同期状態を持たない同期処理である。
 */
function inspectRecoveryCorrelationBindings(
  value: unknown,
  correlationIds: readonly string[],
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Readonly<Record<string, unknown>>;
  if (
    record.status !== "completed" ||
    !Array.isArray(record.bindings) ||
    !Array.isArray(record.absentCorrelationIds)
  )
    return null;
  const bindings: Array<{
    operationId: string;
    status: "matched" | "verified_absent";
    recoveryId: string | null;
  }> = [];
  for (const item of record.bindings) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const binding = item as Readonly<Record<string, unknown>>;
    if (
      typeof binding.correlationId !== "string" ||
      !correlationIds.includes(binding.correlationId) ||
      typeof binding.recoveryId !== "string" ||
      !validIdentity(binding.correlationId)
    )
      return null;
    bindings.push({
      operationId: binding.correlationId,
      status: "matched",
      recoveryId: binding.recoveryId,
    });
  }
  for (const correlationId of record.absentCorrelationIds) {
    if (!validIdentity(correlationId)) return null;
    bindings.push({
      operationId: correlationId,
      status: "verified_absent",
      recoveryId: null,
    });
  }
  return bindings.length === correlationIds.length &&
    bindings.every((entry) => correlationIds.includes(entry.operationId)) &&
    new Set(bindings.map((entry) => entry.operationId)).size === bindings.length
    ? Object.freeze(bindings.map((entry) => Object.freeze(entry)))
    : null;
}

/**
 * objective-applicationを停止結果として構築する。
 *
 * @responsibility objective-applicationの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input request: CoordinatorObjectiveRequest、reason: string、options: Readonly<{ queueId?: string | null; projection?: ReturnType<typeof projectCoordinatorState> | null; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; processRestartRequired?: boolean; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryObligation["kind"]; recoveryId: string; }>[]; effectState?: "no_effect" | "settled" | "unknown"; }>
 * @returns blockedの計算結果を返す。
 * @precondition 「request: CoordinatorObjectiveRequest、reason: string、options: Readonly<{ queueId?: string | null; projection?: ReturnType<typeof projectCoordinatorState> | null; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; processRestartRequired?: boolean; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryObligation["kind"]; recoveryId: string; }>[]; effectState?: "no_effect" | "settled" | "unknown"; }>」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security N/A: blockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(
  request: CoordinatorObjectiveRequest,
  reason: string,
  options: Readonly<{
    queueId?: string | null;
    projection?: ReturnType<typeof projectCoordinatorState> | null;
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    processRestartRequired?: boolean;
    recoveryIds?: readonly string[];
    recoveryObligations?: readonly Readonly<{
      kind: ProjectTaskRecoveryObligation["kind"];
      recoveryId: string;
    }>[];
    effectState?: "no_effect" | "settled" | "unknown";
    knownState?: ProjectExecutionState | null;
    currentRecovery?: Readonly<{
      kind: ProjectTaskRecoveryObligation["kind"];
      recoveryId: string;
    }>;
    workspaceResults?: Parameters<
      typeof createCoordinatorObjectiveResult
    >[1]["workspaceResults"];
  }> = {},
) {
  const { knownState, currentRecovery, ...result } = options;
  if (knownState !== undefined || currentRecovery !== undefined) {
    const obligations = [
      ...(result.recoveryObligations ?? []),
      ...(currentRecovery ? [currentRecovery] : []),
      ...(knownState?.tasks.flatMap((task) =>
        task.recoveryObligations.filter((item) => item.phase !== "settled"),
      ) ?? []),
    ];
    const seen = new Set<string>();
    const retained = obligations
      .filter((item) => {
        const identity = `${item.kind}:${item.recoveryId}`;
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      })
      .map(({ kind, recoveryId }) => Object.freeze({ kind, recoveryId }));
    return createCoordinatorObjectiveResult(request, {
      ...result,
      status: "blocked",
      reason,
      projection: null,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
      processRestartRequired:
        result.processRestartRequired === true ||
        retained.some((item) => item.kind === "execution_process"),
      recoveryIds: [
        ...new Set([
          ...(result.recoveryIds ?? []),
          ...retained.map((item) => item.recoveryId),
        ]),
      ],
      recoveryObligations: retained,
    });
  }
  return createCoordinatorObjectiveResult(request, {
    status: "blocked",
    reason,
    ...result,
  });
}

/**
 * 回復の保存結果と同じProject版の開始候補を捕捉する。
 * @responsibility 回復状態と次の実行候補を別版で組み合わせない。
 * @trace ARCH-000008
 * @precondition 保存処理がcompletedを返している。
 * @returns 保存したProjectと検証済み候補。不正な候補はnullで示し、元状態を失わない。
 * @effect なし。
 */
function captureObjectiveRecoveryWrite(
  written: Extract<
    ReturnType<typeof saveProjectExecutionState>,
    { status: "completed" }
  >,
) {
  return Object.freeze({
    value: written.value,
    taskStartCandidates: inspectTaskStartCandidates(
      written.value,
      written.taskStartCandidates,
    ),
  });
}

/** 新規受付だけ、復旧義務のない明示的なSnapshot不存在を初回として扱う。 @trace ARCH-000004 */
function wasObjectiveStateUninitialized(
  intake: ReturnType<typeof createObjectiveIntake> | undefined,
  observation: Readonly<{
    status: string;
    reason: string;
    manualRecoveryRequired?: boolean;
    recoveryId?: string | null;
  }>,
) {
  return (
    intake?.operation === "start" &&
    observation.status === "blocked" &&
    observation.reason === "coordinator_snapshot_absent" &&
    !observation.manualRecoveryRequired &&
    observation.recoveryId === null
  );
}

/** 元の一件の回復参照を、技術終端不明又は保存拒否と共に返す。 @trace ARCH-000008 */
function blockObjectiveRecoveryItem(
  request: CoordinatorObjectiveRequest,
  queueId: string,
  reason: string,
  {
    kind,
    recoveryId,
  }: Pick<ProjectTaskRecoveryObligation, "kind" | "recoveryId">,
) {
  return blocked(request, reason, {
    queueId,
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    effectState: "unknown",
    recoveryIds: [recoveryId],
    recoveryObligations: [Object.freeze({ kind, recoveryId })],
  });
}

/** 解放だけを確定し、実行・採用へ進まない保存状態。 @trace ARCH-000004 */
type ObjectiveReleaseState =
  | "completed"
  | "cancelled"
  | "integration_pending"
  | "preparation_blocked";

/**
 * 捕捉済みObjectiveを既存の保存・実行Lifecycleへ接続する。
 *
 * @responsibility Coordinator Objective Applicationの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input 既存の実行依存・要求・取消と、回復callbackを所有する元依存値の参照。
 * @returns executeCoordinatorObjectiveの計算結果を返す。
 * @precondition 同じ検査済み要求・主体・Repository結合から受付識別値を確定し、保存Contextへ渡す。
 * @postcondition executeCoordinatorObjectiveの責務を完了した結果だけを返す。
 * @effect 既存のState保存・Lease・Task実行・回復Portへ委譲する。未知IDの再開はこれらの発行前に拒否する。
 * @failure executeCoordinatorObjectiveは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant startの再送を明示再開へ変換せず、元のIdentityと保存・資源の安全条件を維持する。
 * @boundary Objectiveの意味判断と保存・実行Portの境界。
 * @security 認証済み主体・既存の実行Authorityを暗黙に拡張しない。
 * @concurrency executeCoordinatorObjectiveは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function executeCoordinatorObjective(
  dependencies: CoordinatorObjectiveExecutionDependencies,
  request: CoordinatorObjectiveRequest,
  cancellationSignal: AbortSignal,
  expectedTerminalState?: ObjectiveReleaseState,
  alreadyAdmitted?: ObjectiveAdmissionRead,
) {
  if (request.adoptResult)
    return blocked(request, "coordinator_explicit_workspace_adoption_required");
  if (
    !(cancellationSignal instanceof AbortSignal) ||
    !isPrincipalId(dependencies.authenticatedPrincipalId)
  )
    return blocked(request, "coordinator_objective_request_invalid");
  const plan = request.plan;
  const persistence = dependencies.persistence;
  if (!persistence.intake)
    return blocked(request, "coordinator_objective_request_invalid");
  const { queueId, requestHash } = persistence.intake;
  const wait = dependencies.execution?.leaseWait;
  const prepare = <T extends StateContentionResult>(attempt: () => T) =>
    wait
      ? waitForStateContention(cancellationSignal, attempt, wait.revalidate)
      : attempt();
  const interrupted = () =>
    blocked(
      request,
      cancellationSignal.aborted
        ? "coordinator_objective_cancelled_before_start"
        : "coordinator_authenticated_principal_not_verified",
    );
  const scopeHash = hashCoordinatorContent(
    JSON.stringify({
      allowedPaths: request.allowedPaths,
      readPaths: request.readPaths,
    }),
  );

  // この停止結果には、まだ確認できていないProjectやQueueの情報を含めない。
  const blockWithoutProject = (
    reason: string,
    recoveryId: string | null,
    manualRecoveryRequired = false,
    recoverySettled = false,
  ) => {
    const needsRecovery = manualRecoveryRequired || recoveryId !== null;
    return Object.freeze({
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason,
      cleanupConfirmed: !needsRecovery,
      manualRecoveryRequired: needsRecovery,
      effectState: needsRecovery
        ? ("unknown" as const)
        : recoverySettled
          ? ("settled" as const)
          : ("no_effect" as const),
      recoveryIds: Object.freeze(recoveryId ? [recoveryId] : []),
    });
  };

  if (request.operation === "resume") {
    const existing = await prepare(() =>
      readQueueEntry(
        persistence.repository,
        persistence.repositoryBindingId,
        queueId,
      ),
    );
    if (existing === null) return interrupted();
    if (existing.status !== "completed") {
      if (existing.manualRecoveryRequired || existing.recoveryId)
        return blockWithoutProject(existing.reason, existing.recoveryId, true);
      return blocked(request, existing.reason);
    }
  }
  const combinedAdmission =
    alreadyAdmitted ??
    (request.operation === "start" && wait !== undefined
      ? await prepare(() =>
          readObjectiveAdmission(
            persistence.repository,
            persistence.repositoryBindingId,
            request.projectId,
            queueId,
          ),
        )
      : undefined);
  const admissionAbsent = {
    status: "blocked" as const,
    reason: "coordinator_snapshot_absent",
    value: null,
    manualRecoveryRequired: false,
    recoveryId: null,
  };
  const observedAcquisitionOwner =
    combinedAdmission !== undefined
      ? combinedAdmission?.status === "completed"
        ? combinedAdmission.value?.acquisition.status === "completed"
          ? {
              ...combinedAdmission.value.acquisition,
              value: combinedAdmission.value.acquisition.value.value,
            }
          : (combinedAdmission.value?.acquisition ?? admissionAbsent)
        : combinedAdmission
      : await prepare(() =>
          inspectCoordinatorSnapshotLeaseAcquisitionOwner(
            persistence.repository.directory,
            persistence.repositoryBindingId,
            queueId,
          ),
        );
  if (observedAcquisitionOwner === null) return interrupted();
  if (
    observedAcquisitionOwner.status !== "completed" &&
    !wasObjectiveStateUninitialized(
      persistence.intake,
      observedAcquisitionOwner,
    )
  )
    return blockWithoutProject(
      observedAcquisitionOwner.reason,
      observedAcquisitionOwner.recoveryId,
      observedAcquisitionOwner.manualRecoveryRequired,
    );
  const resolvedAcquisition =
    observedAcquisitionOwner.status === "completed"
      ? observedAcquisitionOwner.value.acquisition
      : null;
  if (
    resolvedAcquisition !== null &&
    (resolvedAcquisition.projectId !== request.projectId ||
      resolvedAcquisition.queueId !== queueId)
  )
    return Object.freeze({
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "coordinator_lease_acquisition_project_identity_mismatch",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      recoveryIds: Object.freeze([]),
      effectState: "unknown" as const,
    });
  const observedProject =
    combinedAdmission?.status === "completed"
      ? combinedAdmission.value?.project.status === "completed"
        ? {
            ...combinedAdmission.value.project,
            value: combinedAdmission.value.project.value.value,
            taskStartCandidates: combinedAdmission.value.taskStartCandidates,
          }
        : (combinedAdmission.value?.project ?? admissionAbsent)
      : combinedAdmission !== undefined
        ? combinedAdmission
        : await prepare(() =>
            readProjectExecutionState(
              persistence.repository,
              persistence.repositoryBindingId,
              request.projectId,
              queueId,
            ),
          );
  if (observedProject === null) return interrupted();
  if (
    observedProject.status !== "completed" &&
    !wasObjectiveStateUninitialized(persistence.intake, observedProject)
  )
    return blockWithoutProject(
      observedProject.reason,
      observedProject.recoveryId,
      !isCleanStateContention(observedProject),
    );
  let state: Readonly<{
    value: ProjectExecutionState | null;
    taskStartCandidates: TaskStartCandidates | null;
  }> =
    observedProject.status === "completed"
      ? {
          value: observedProject.value,
          taskStartCandidates: observedProject.taskStartCandidates,
        }
      : { value: null, taskStartCandidates: null };
  let initialization: ProjectExecutionInitialization | undefined;
  if (state.value === null) {
    if (request.operation === "resume")
      return blocked(request, "coordinator_objective_request_not_found");
    let selected: ReturnType<typeof resolveObjectiveTaskSelections>;
    try {
      selected = resolveObjectiveTaskSelections(
        dependencies.repositoryRoot,
        request,
      );
    } catch {
      return blocked(request, "ai_selection_observation_failed");
    }
    if (selected.status !== "resolved")
      return blocked(request, selected.reason);
    const selections = selected.value;
    initialization = Object.freeze({
      taskExecutionSelections: selections,
      projectId: request.projectId,
      milestoneId: request.milestoneId,
      repositoryRevision: request.repositoryRevision,
      maximumConcurrency: request.maximumConcurrency,
      milestoneAcceptanceCriteria: plan.milestoneAcceptanceCriteria,
      objectives: plan.objectives,
      tasks: plan.tasks,
      ownerGeneration: getExecutionProcessInstanceIdentity(),
    });
    if (!objectiveSelectionsMatch(request, selections, true))
      return blocked(request, "coordinator_objective_selection_mismatch");
  } else if (
    state.value.queueId !== queueId ||
    state.value.milestoneId !== request.milestoneId ||
    state.value.repositoryRevision !== request.repositoryRevision
  ) {
    return blocked(request, "coordinator_existing_state_identity_mismatch");
  }
  if (state.value) {
    const candidates = inspectTaskStartCandidates(
      state.value,
      state.taskStartCandidates,
    );
    if (!candidates)
      return blocked(request, "coordinator_state_observation_unknown", {
        knownState: state.value,
        queueId,
      });
    state = Object.freeze({
      value: state.value,
      taskStartCandidates: candidates,
    });
  }
  if (
    state.value &&
    !objectiveSelectionsMatch(
      request,
      state.value.taskExecutionSelections,
      false,
    )
  )
    return blocked(request, "coordinator_objective_selection_mismatch");
  const queueInput = {
    queueId,
    ...(request.workspaceId === undefined
      ? {}
      : { workspaceId: request.workspaceId }),
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    requestHash,
    originLane: request.originLane,
    repositoryRevision: request.repositoryRevision,
    scopeHash,
  };
  const admitted =
    request.operation === "start" && wait !== undefined && initialization
      ? await prepare(() =>
          createQueue(
            persistence.repository,
            persistence.repositoryBindingId,
            { kind: "scheduled", input: [queueInput, initialization] },
            persistence.prepareStorage,
            "select",
          ),
        )
      : undefined;
  const queued =
    admitted !== undefined
      ? admitted?.status === "completed"
        ? { ...admitted, value: admitted.value.queue }
        : admitted
      : await prepare(() =>
          request.operation === "resume"
            ? readQueueEntry(
                persistence.repository,
                persistence.repositoryBindingId,
                queueId,
              )
            : createQueue(
                persistence.repository,
                persistence.repositoryBindingId,
                {
                  kind: "scheduled",
                  input: initialization
                    ? [queueInput, initialization]
                    : [queueInput],
                },
                persistence.prepareStorage,
              ),
        );
  if (queued === null) return interrupted();
  if (queued.status !== "completed")
    return blockWithoutProject(
      queued.reason,
      queued.recoveryId,
      queued.manualRecoveryRequired,
    );
  if (
    request.operation === "resume" &&
    (queued.value.singleTask !== undefined ||
      queued.value.projectId !== request.projectId ||
      queued.value.milestoneId !== request.milestoneId ||
      queued.value.requestHash !== requestHash ||
      (expectedTerminalState !== undefined &&
        queued.value.state !== expectedTerminalState))
  )
    return blocked(request, "coordinator_queue_identity_conflict");
  if (
    request.operation === "resume"
      ? queued.value.ownerGeneration == null &&
        (queued.value.state === "completed" ||
          queued.value.state === "cancelled")
      : queued.reason === "coordinator_queue_request_reused"
  ) {
    // 保存時に競合を観測した場合も、QueueとProjectを同じ保存版から返す。
    const observed = await prepare(() =>
      readExecutionState(
        persistence.repository,
        persistence.repositoryBindingId,
      ),
    );
    if (observed === null) return interrupted();
    return (
      readObjectiveReplay(
        request,
        persistence.workingDirectory,
        persistence.repositoryBindingId,
        persistence.intake,
        true,
        observed,
      ) ??
      blocked(request, "coordinator_state_observation_unknown", {
        knownState: null,
        queueId,
      })
    );
  }
  if (initialization) {
    const observed =
      admitted?.status === "completed"
        ? {
            ...admitted,
            value: admitted.value.project,
            taskStartCandidates: admitted.value.taskStartCandidates,
          }
        : await prepare(() =>
            readProjectExecutionState(
              persistence.repository,
              persistence.repositoryBindingId,
              request.projectId,
              queueId,
            ),
          );
    if (observed === null) return interrupted();
    if (observed.status !== "completed" || observed.value === null)
      return blockWithoutProject(
        observed.reason,
        observed.status === "blocked" ? observed.recoveryId : null,
        !isCleanStateContention(observed),
      );
    const candidates = inspectTaskStartCandidates(
      observed.value,
      observed.taskStartCandidates,
    );
    if (!candidates)
      return blocked(request, "coordinator_state_observation_unknown", {
        knownState: observed.value,
        queueId,
      });
    state = Object.freeze({
      value: observed.value,
      taskStartCandidates: candidates,
    });
  }
  let queue = queued.value;
  const recoveryQueueId =
    resolvedAcquisition !== null || queue.ownerGeneration !== null
      ? queueId
      : null;
  if (recoveryQueueId !== null) {
    const reconciled = await reconcileCoordinatorSnapshotLeaseOwnerLoss(
      persistence.repository.directory,
      persistence.repositoryBindingId,
      request.projectId,
      recoveryQueueId,
      "project-operation",
      observeObjectiveLeaseOwner,
      wait ? { signal: cancellationSignal, ...wait } : undefined,
    );
    if (reconciled === null) return interrupted();
    if (
      reconciled.status === "completed" &&
      (!reconciled.value.queue ||
        reconciled.value.queue.projectId !== request.projectId ||
        reconciled.value.queue.queueId !== recoveryQueueId)
    ) {
      return blockWithoutProject(
        "coordinator_lease_recovery_queue_mismatch",
        null,
        true,
      );
    }
    if (
      reconciled.status !== "completed" &&
      reconciled.reason === "coordinator_lease_owner_still_active" &&
      recoveryQueueId === queueId &&
      expectedTerminalState === undefined &&
      state.value
    )
      return createCoordinatorObjectiveResult(request, {
        status: "blocked",
        reason: "coordinator_objective_already_running",
        queueId,
        projection: projectCoordinatorState(
          state.value,
          state.taskStartCandidates,
        ),
      });
    if (
      reconciled.status !== "completed" &&
      reconciled.reason !== "coordinator_lease_owner_still_active"
    )
      return blockWithoutProject(
        reconciled.reason,
        reconciled.recoveryId ??
          (isCleanStateContention(reconciled)
            ? (resolvedAcquisition?.recoveryId ?? null)
            : null),
        reconciled.manualRecoveryRequired,
      );
    const recoveringQueue =
      reconciled.status === "completed" &&
      reconciled.value.queue?.state === "recovery_required"
        ? reconciled.value.queue
        : null;
    const recoverySettled =
      reconciled.status === "completed" &&
      reconciled.reason !== "coordinator_lease_acquisition_resources_absent";
    const read = () =>
      readQueueEntry(
        persistence.repository,
        persistence.repositoryBindingId,
        queueId,
      );
    let authorizationUnconfirmed = false;
    const revalidate = wait?.revalidate;
    const reread = wait
      ? await waitForStateContention(
          cancellationSignal,
          read,
          revalidate &&
            (async () => {
              authorizationUnconfirmed = true;
              const allowed = await revalidate();
              if (allowed) authorizationUnconfirmed = false;
              return allowed;
            }),
        )
      : read();
    if (authorizationUnconfirmed)
      return blocked(
        request,
        "coordinator_authenticated_principal_not_verified",
      );
    if (reread?.status !== "completed") {
      const reason =
        reread?.reason ?? "coordinator_objective_cancelled_before_start";
      const leaseRecoveryId = leaseAcquisitionRecoveryId(
        persistence.repositoryBindingId,
        request.projectId,
        queueId,
        "project-operation",
      );
      const hasLeaseRecoveryId =
        reread?.recoveryId === leaseRecoveryId ||
        recoveringQueue?.resultReference === leaseRecoveryId;
      // Queueの内部参照を公開回復IDにしない。元Queueと、そのTaskの型付き義務を返す。
      if (recoveringQueue)
        return blocked(request, reason, {
          queueId,
          knownState: state.value?.queueId === queueId ? state.value : null,
          ...(hasLeaseRecoveryId ? { recoveryIds: [leaseRecoveryId] } : {}),
        });
      return blockWithoutProject(
        reason,
        hasLeaseRecoveryId ? leaseRecoveryId : null,
        reread !== null && !isCleanStateContention(reread),
        recoverySettled,
      );
    }
    queue = reread.value;
  }
  if (
    expectedTerminalState !== undefined &&
    (queue.state !== expectedTerminalState || queue.ownerGeneration !== null)
  )
    return blocked(
      request,
      "coordinator_queue_release_settlement_unconfirmed",
      {
        knownState: state.value,
        queueId,
        recoveryIds: [
          leaseAcquisitionRecoveryId(
            persistence.repositoryBindingId,
            request.projectId,
            queueId,
            "project-operation",
          ),
        ],
      },
    );
  if (
    queue.state === "recovery_required" &&
    queue.resumeCondition === "owner_loss" &&
    state.value
  ) {
    const activeTasks = state.value.tasks.filter((task) =>
      ["starting", "running"].includes(task.state),
    );
    const operationIds = activeTasks
      .map((task) => task.operationId)
      .filter((value): value is string => value !== null);
    let applicationId = createProjectRecoveryApplicationId(
      request.projectId,
      queueId,
      state.value.tasks,
    );
    if (applicationId === null && activeTasks.length > 0) {
      let bindings: ReturnType<typeof inspectRecoveryCorrelationBindings> =
        Object.freeze([]);
      if (operationIds.length > 0) {
        let rawBindings: unknown;
        try {
          const root = getRepository(dependencies.repositoryRoot);
          rawBindings = resolveDockerTaskCurrentCorrelations(
            operationIds,
            root.status === "completed" ? root.capability : null,
            "coordinator",
            typeof dependencies.repositoryRoot === "string"
              ? dependencies.repositoryRoot
              : undefined,
          );
        } catch {
          rawBindings = null;
        }
        bindings = inspectRecoveryCorrelationBindings(
          rawBindings,
          operationIds,
        );
      }
      if (!bindings)
        return blocked(request, "coordinator_owner_loss_recovery_unresolved", {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      const boundRecoveryObligations = Object.freeze(
        bindings.flatMap((entry) =>
          entry.status === "matched" && entry.recoveryId
            ? [
                Object.freeze({
                  kind: "docker" as const,
                  recoveryId: entry.recoveryId,
                }),
              ]
            : [],
        ),
      );
      const boundRecoveryIds = Object.freeze(
        boundRecoveryObligations.map((entry) => entry.recoveryId),
      );
      const boundWrite = saveProjectExecutionState(
        persistence.repository,
        persistence.repositoryBindingId,
        { kind: "task_owner_loss", projectId: request.projectId, bindings },
        state.value.generation,
        persistence.intake,
      );
      if (boundWrite.status !== "completed")
        return blocked(request, boundWrite.reason, {
          queueId,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
          recoveryIds: boundRecoveryIds,
          recoveryObligations: boundRecoveryObligations,
        });
      state = captureObjectiveRecoveryWrite(boundWrite);
      if (!state.taskStartCandidates)
        return blocked(request, "coordinator_state_observation_unknown", {
          knownState: state.value,
          queueId,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
          recoveryIds: boundRecoveryIds,
          recoveryObligations: boundRecoveryObligations,
        });
      for (const task of boundWrite.value.tasks) {
        for (const obligation of task.recoveryObligations) {
          await writeCoordinatorRecoveryDiagnostic({
            phase: "required",
            projectId: request.projectId,
            milestoneId: request.milestoneId,
            queueId,
            taskId: task.definition.id,
            operationId: task.operationId,
            recoveryId: obligation.recoveryId,
            stateGeneration: boundWrite.value.generation,
          });
        }
      }
      applicationId = createProjectRecoveryApplicationId(
        request.projectId,
        queueId,
        boundWrite.value.tasks,
      );
    }
    if (!applicationId) {
      const remainingActiveTasks = (state.value?.tasks ?? []).filter((task) =>
        ["starting", "running"].includes(task.state),
      );
      if (remainingActiveTasks.length > 0)
        return blocked(request, "coordinator_owner_loss_recovery_unresolved", {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      const reopenedQueue = updateCoordinatorQueue(
        persistence,
        queueId,
        queue.generation,
        {
          state: "queued",
          lease: null,
          resumeCondition: null,
          resultReference: null,
        },
      );
      if (reopenedQueue.status !== "completed")
        return blocked(request, reopenedQueue.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      queue = reopenedQueue.value;
    } else {
      const reboundQueue = updateCoordinatorQueue(
        persistence,
        queueId,
        queue.generation,
        {
          state: "recovery_required",
          lease: null,
          resumeCondition: "exact_recovery",
          resultReference: applicationId,
        },
      );
      if (reboundQueue.status !== "completed")
        return blocked(request, reboundQueue.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      queue = reboundQueue.value;
    }
  }
  if (
    (queue.state === "recovery_required" ||
      (queue.state === "queued" &&
        queue.resumeCondition === "exact_recovery_settled")) &&
    state.value
  ) {
    let recoveryState = state.value;
    const recoveryApplication = createProjectRecoveryApplicationId(
      request.projectId,
      queueId,
      recoveryState.tasks,
    );
    const unresolvedTasks = recoveryState.tasks.filter(
      (task) => task.state === "recovery_required" && task.recoveryUnresolved,
    );
    const recoveries = recoveryState.tasks.flatMap((task) =>
      task.recoveryObligations.map((entry) =>
        Object.freeze({ taskId: task.definition.id, ...entry }),
      ),
    );
    const publicRecoveryObligations = recoveries.map(({ kind, recoveryId }) =>
      Object.freeze({ kind, recoveryId }),
    );
    const recoveryProcess = getExecutionProcessInstanceIdentity();
    const recoveryQueue = queue;
    /**
     * 待機・診断後の同じ上位状態と取消を読戻す。
     * @responsibility 旧値から回復確定へ無条件に進めない。
     * @trace ARCH-000008
     * @input N/A: 同じQueue・現在状態・取消とProcess相関を閉包で使う。
     * @returns 同じ業務内容のfresh状態、又は取消・不一致時null。
     * @precondition Queueは回復対象であり新しいLease Ownerを発行しない。
     * @postcondition 同一Process相関を生存・非poison保証へ強めない。
     * @effect 既存の同版読取り一回だけ。
     * @failure 取消・差・観測不能はnull。
     * @invariant 新しいLock・Owner・回復状態を生成しない。
     * @boundary 回復の非同期待機と上位保存。
     * @security 書込み競合の最終判定は既存期待世代付き保存が所有する。
     * @concurrency 各後段処置前にfresh読取りし、耐久済み段階を巻き戻さない。
     */
    const readCurrentRecoveryState = (
      technicalProgress?: Readonly<{ taskId: string; recoveryId: string }>,
    ) => {
      try {
        if (
          cancellationSignal.aborted ||
          getExecutionProcessInstanceIdentity() !== recoveryProcess
        )
          return null;
        const current = readExecutionState(
          persistence.repository,
          persistence.repositoryBindingId,
        );
        if (current.status !== "completed" || current.value === null)
          return null;
        const currentState = current.value.projects.find(
          (entry) =>
            entry.projectId === request.projectId && entry.queueId === queueId,
        );
        const currentQueue = current.value.queueEntries.find(
          (entry) => entry.queueId === queueId,
        );
        if (!currentState || !isDeepStrictEqual(currentQueue, recoveryQueue))
          return null;
        let comparable = currentState;
        if (technicalProgress) {
          const before = recoveryState.tasks.find(
            (task) => task.definition.id === technicalProgress.taskId,
          );
          const after = comparable.tasks.find(
            (task) => task.definition.id === technicalProgress.taskId,
          );
          const prior = before?.recoveryObligations.find(
            (item) =>
              item.kind === "docker" &&
              item.recoveryId === technicalProgress.recoveryId,
          );
          const next = after?.recoveryObligations.find(
            (item) =>
              item.kind === "docker" &&
              item.recoveryId === technicalProgress.recoveryId,
          );
          if (
            !before ||
            !after ||
            !prior ||
            !next ||
            !["required", "settled"].includes(prior.phase) ||
            !(
              next.phase === prior.phase ||
              (prior.phase === "required" && next.phase === "settled")
            ) ||
            (before.cleanupConfirmed && !after.cleanupConfirmed)
          )
            return null;
          comparable = {
            ...comparable,
            tasks: comparable.tasks.map((task) =>
              task === after
                ? {
                    ...task,
                    cleanupConfirmed: before.cleanupConfirmed,
                    recoveryObligations: task.recoveryObligations.map((item) =>
                      item === next ? { ...item, phase: prior.phase } : item,
                    ),
                  }
                : task,
            ),
          };
        }
        if (!isDeepStrictEqual(comparable, recoveryState)) return null;
        const taskStartCandidates = captureTaskStartCandidates(
          currentState,
          current.value.taskStartCandidates,
        );
        if (!taskStartCandidates) return null;
        state = Object.freeze({
          value: currentState,
          taskStartCandidates,
        });
        return currentState;
      } catch {
        return null;
      }
    };
    if (unresolvedTasks.length > 0)
      return blocked(request, "coordinator_recovery_result_unresolved", {
        queueId,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
        recoveryIds: publicRecoveryObligations.map((entry) => entry.recoveryId),
        recoveryObligations: publicRecoveryObligations,
      });
    if (!recoveryApplication || queue.resultReference !== recoveryApplication)
      return blocked(request, "coordinator_recovery_identity_mismatch", {
        queueId,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
        recoveryIds: publicRecoveryObligations.map((entry) => entry.recoveryId),
        recoveryObligations: publicRecoveryObligations,
      });
    // Process回復では開始と確定を同じWriterへ渡し、同版の候補確認後だけ進める。
    const saveProcessRecoveryPhase = (
      kind: "task_recovery_start" | "task_recovery_settle",
      item: (typeof recoveries)[number],
    ) => {
      const written = saveProjectExecutionState(
        persistence.repository,
        persistence.repositoryBindingId,
        {
          kind,
          projectId: request.projectId,
          taskId: item.taskId,
          recoveryKind: item.kind,
          recoveryId: item.recoveryId,
        },
        recoveryState.generation,
        persistence.intake,
      );
      if (written.status !== "completed")
        return blockObjectiveRecoveryItem(
          request,
          queueId,
          written.reason,
          item,
        );
      state = captureObjectiveRecoveryWrite(written);
      if (!state.taskStartCandidates)
        return blocked(request, "coordinator_state_observation_unknown", {
          knownState: state.value,
          queueId,
          currentRecovery: item,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      recoveryState = written.value;
      return null;
    };
    const writeRecoveryPhaseDiagnostic = (
      phase: "recovering" | "settled",
      item: (typeof recoveries)[number],
      operationId = recoveryState.tasks.find(
        (task) => task.definition.id === item.taskId,
      )?.operationId ?? null,
    ) =>
      writeCoordinatorRecoveryDiagnostic({
        phase,
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        queueId,
        taskId: item.taskId,
        operationId,
        recoveryId: item.recoveryId,
        stateGeneration: recoveryState.generation,
      });

    if (queue.state === "recovery_required") {
      for (const item of recoveries.filter(
        (entry) =>
          ["docker", "execution_process"].includes(entry.kind) &&
          entry.phase !== "settled",
      )) {
        if (item.phase === "required" && item.kind !== "docker") {
          const failure = saveProcessRecoveryPhase("task_recovery_start", item);
          if (failure) return failure;
          await writeRecoveryPhaseDiagnostic("recovering", item);
        }
        let recovery: unknown;
        if (item.kind === "execution_process") {
          const task = recoveryState.tasks.find(
            (entry) => entry.definition.id === item.taskId,
          );
          const match =
            task?.attemptId && task.operationId
              ? inspectExecutionProcessRecoveryIdentity(
                  item.recoveryId,
                  task.attemptId,
                  task.operationId,
                )
              : null;
          recovery =
            match &&
            match.processIdentity !== getExecutionProcessInstanceIdentity()
              ? Object.freeze({
                  status: "recovered" as const,
                  recoveryId: null,
                  manualRecoveryRequired: false,
                })
              : null;
        } else {
          try {
            await writeRecoveryPhaseDiagnostic("recovering", item);
            recovery = null;
            if (readCurrentRecoveryState()) {
              const root = getRepository(dependencies.repositoryRoot);
              recovery =
                (await recoverDockerTaskForCurrentConsumer(
                  item.recoveryId,
                  root.status === "completed" ? root.capability : null,
                  cancellationSignal,
                  typeof dependencies.repositoryRoot === "string"
                    ? dependencies.repositoryRoot
                    : undefined,
                )) ?? null;
            }
            const fresh = readCurrentRecoveryState(item);
            if (!fresh) recovery = null;
            else recoveryState = fresh;
          } catch {
            recovery = null;
          }
        }
        if (!exactRecoveryCompleted(recovery, item.kind, item.recoveryId))
          return blockObjectiveRecoveryItem(
            request,
            queueId,
            "coordinator_task_recovery_not_settled",
            item,
          );
        if (item.kind === "docker") {
          const settled = recoveryState.tasks.find(
            (task) => task.definition.id === item.taskId,
          );
          if (
            !settled?.recoveryObligations.some(
              (entry) =>
                entry.kind === "docker" &&
                entry.recoveryId === item.recoveryId &&
                entry.phase === "settled",
            )
          )
            return blockObjectiveRecoveryItem(
              request,
              queueId,
              "coordinator_task_recovery_not_settled",
              item,
            );
          await writeRecoveryPhaseDiagnostic(
            "settled",
            item,
            settled.operationId,
          );
          continue;
        }
        const failure = saveProcessRecoveryPhase("task_recovery_settle", item);
        if (failure) return failure;
        await writeRecoveryPhaseDiagnostic("settled", item);
      }
    }
    const recoveredDocker = recoveries.filter((entry) => {
      if (entry.kind !== "docker") return false;
      if (
        queue.state !== "queued" ||
        queue.resumeCondition !== "exact_recovery_settled"
      )
        return true;
      // 回復確定後の再実行待ち保存が済んだTaskには、元の試行IDがない。
      // Queueの相関と同じ完了済み義務は保持するが、旧試行の確定を再発行しない。
      const task = recoveryState.tasks.find(
        (candidate) => candidate.definition.id === entry.taskId,
      );
      return !(
        task?.state === "ready" &&
        task.startPhase === "none" &&
        task.attemptId === null &&
        task.operationId === null &&
        task.authorityBindingId === null &&
        task.cleanupConfirmed &&
        !task.recoveryUnresolved &&
        task.retryCount > 0 &&
        entry.phase === "settled" &&
        task.recoveryObligations.every(
          (obligation) => obligation.phase === "settled",
        )
      );
    });
    if (recoveredDocker.length > 0) {
      const recoveryIds = recoveredDocker.map((entry) => entry.recoveryId);
      const recoveryObligations = recoveryIds.map((recoveryId) => ({
        kind: "docker" as const,
        recoveryId,
      }));
      // 終結可否は同じ世代のTaskを排他下で検査するEMの確定操作が所有する。
      if (!readCurrentRecoveryState())
        return blocked(request, "coordinator_task_recovery_not_settled", {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
          recoveryIds,
          recoveryObligations,
        });
      const saved = saveProjectExecutionState(
        persistence.repository,
        persistence.repositoryBindingId,
        {
          kind: "task_recovery_finalize",
          projectId: request.projectId,
          recoveries: recoveredDocker.map(({ taskId, recoveryId }) => ({
            taskId,
            recoveryId,
          })),
        },
        recoveryState.generation,
        persistence.intake,
      );
      if (saved.status !== "completed")
        return blocked(request, saved.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
          recoveryIds,
          recoveryObligations,
        });
      recoveryState = saved.value;
      state = captureObjectiveRecoveryWrite(saved);
      if (!state.taskStartCandidates)
        return blocked(request, "coordinator_state_observation_unknown", {
          knownState: state.value,
          queueId,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
          recoveryIds,
          recoveryObligations,
        });
      for (const item of recoveredDocker)
        await writeCoordinatorRecoveryDiagnostic({
          phase: "verification_resources_finalized",
          projectId: request.projectId,
          milestoneId: request.milestoneId,
          queueId,
          taskId: item.taskId,
          operationId:
            recoveryState.tasks.find((t) => t.definition.id === item.taskId)
              ?.operationId ?? null,
          recoveryId: item.recoveryId,
          stateGeneration: recoveryState.generation,
        });
    }
    const outstanding = recoveryState.tasks.flatMap((task) =>
      task.recoveryObligations.filter((entry) => entry.phase !== "settled"),
    );
    if (
      outstanding.some(
        ({ kind }) => kind !== "docker" && kind !== "execution_process",
      )
    )
      return blocked(request, "coordinator_external_recovery_required", {
        queueId,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
        recoveryIds: outstanding.map((entry) => entry.recoveryId),
        recoveryObligations: outstanding.map(({ kind, recoveryId }) =>
          Object.freeze({ kind, recoveryId }),
        ),
      });
    if (queue.state === "recovery_required") {
      const queueSettlement = updateQueue(
        persistence.repository,
        persistence.repositoryBindingId,
        {
          kind: "recovery",
          input: [queueId, queue.generation, recoveryApplication],
        },
      );
      if (queueSettlement.status !== "completed")
        return blocked(request, queueSettlement.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      queue = queueSettlement.value;
      await writeCoordinatorRecoveryDiagnostic({
        phase: "queue_settled",
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        queueId,
        taskId: null,
        operationId: null,
        recoveryId: null,
        stateGeneration: recoveryState.generation,
      });
    }
    const retryTaskIds = recoveryState.tasks
      .filter(
        (task) =>
          task.state === "recovery_required" &&
          !task.recoveryUnresolved &&
          task.recoveryObligations.length > 0 &&
          task.recoveryObligations.every((entry) => entry.phase === "settled"),
      )
      .map((task) => task.definition.id);
    if (retryTaskIds.length > 0) {
      const retryWrite = saveProjectExecutionState(
        persistence.repository,
        persistence.repositoryBindingId,
        {
          kind: "task_recovery_retry",
          projectId: request.projectId,
          taskIds: retryTaskIds,
        },
        recoveryState.generation,
        persistence.intake,
      );
      if (
        retryWrite.status !== "completed" &&
        [
          "coordinator_task_recovery_batch_invalid",
          "coordinator_task_recovery_batch_mismatch",
        ].includes(retryWrite.reason)
      )
        return blocked(request, retryWrite.reason, {
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          effectState: "no_effect",
        });
      if (retryWrite.status !== "completed")
        return blocked(request, retryWrite.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      state = captureObjectiveRecoveryWrite(retryWrite);
      if (!state.taskStartCandidates)
        return blocked(request, "coordinator_state_observation_unknown", {
          knownState: state.value,
          queueId,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      recoveryState = retryWrite.value;
      await writeCoordinatorRecoveryDiagnostic({
        phase: "retry_ready",
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        queueId,
        taskId: null,
        operationId: null,
        recoveryId: null,
        stateGeneration: recoveryState.generation,
      });
    }
  }
  if (expectedTerminalState === "preparation_blocked")
    return projectObjectiveReplay(
      request,
      queue,
      state.value,
      state.taskStartCandidates,
    );
  if (queue.state === "preparation_blocked" && request.operation === "resume") {
    const generation = queue.generation;
    const reopened = await prepare(() =>
      updateCoordinatorQueue(persistence, queueId, generation, {
        state: "queued",
        lease: null,
        resumeCondition: null,
        resultReference: null,
      }),
    );
    if (reopened === null) return interrupted();
    if (reopened.status !== "completed")
      return blocked(request, reopened.reason, {
        knownState: state.value,
        queueId,
        cleanupConfirmed: !reopened.manualRecoveryRequired,
        manualRecoveryRequired: reopened.manualRecoveryRequired,
        effectState: reopened.manualRecoveryRequired ? "unknown" : "no_effect",
        recoveryIds: reopened.recoveryId ? [reopened.recoveryId] : [],
      });
    queue = reopened.value;
  }
  if (queue.state === "queued" || queue.state === "waiting_foreground") {
    const currentState = state.value;
    if (!currentState)
      return blocked(request, "coordinator_state_observation_unknown", {
        knownState: state.value,
        queueId,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
      });
    const selected =
      admitted?.status === "completed"
        ? {
            status: "completed" as const,
            reason: admitted.reason,
            value: admitted.value.selected ? queue : null,
          }
        : await prepare(() =>
            selectNextQueueEntry(
              persistence.repository,
              persistence.repositoryBindingId,
              queueId,
            ),
          );
    if (selected === null) return interrupted();
    if (isCleanStateContention(selected))
      return blocked(request, selected.reason);
    if (selected.status !== "completed")
      return blocked(request, selected.reason, {
        cleanupConfirmed: false,
        manualRecoveryRequired: selected.manualRecoveryRequired,
        effectState: "unknown",
      });
    if (!selected.value || selected.value.queueId !== queueId)
      return createCoordinatorObjectiveResult(request, {
        status: "blocked",
        reason: "coordinator_objective_queued_waiting_foreground",
        queueId,
        projection: projectCoordinatorState(
          currentState,
          state.taskStartCandidates,
        ),
      });
  }
  if (
    state.value &&
    (queue.state === "integration_pending" ||
      queue.state === "completed" ||
      queue.state === "cancelled")
  ) {
    const projection = projectCoordinatorState(
      state.value,
      state.taskStartCandidates,
    );
    if (queue.state === "completed" && projection.milestoneState !== "accepted")
      return blocked(request, "coordinator_terminal_replay_mismatch", {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
      });
    return createCoordinatorObjectiveResult(request, {
      status: queue.state === "cancelled" ? "cancelled" : "completed",
      reason:
        queue.state === "integration_pending"
          ? "coordinator_tasks_already_integration_pending"
          : queue.state === "completed"
            ? "coordinator_objective_already_accepted"
            : "coordinator_objective_already_cancelled",
      queueId,
      projection:
        queue.state !== "cancelled" || projection.milestoneState === "cancelled"
          ? projection
          : null,
    });
  }
  if (queue.state !== "queued" && state.value) {
    const manualRecoveryRequired = queue.state === "recovery_required";
    const outstandingRecoveries = state.value.tasks.flatMap((task) =>
      task.recoveryObligations.filter((entry) => entry.phase !== "settled"),
    );
    return createCoordinatorObjectiveResult(request, {
      status: "blocked",
      reason: `coordinator_objective_${queue.state}`,
      queueId,
      projection: projectCoordinatorState(
        state.value,
        state.taskStartCandidates,
      ),
      cleanupConfirmed: !manualRecoveryRequired,
      manualRecoveryRequired,
      processRestartRequired: outstandingRecoveries.some(
        (entry) => entry.kind === "execution_process",
      ),
      recoveryIds: Object.freeze(
        outstandingRecoveries.map((entry) => entry.recoveryId),
      ),
      recoveryObligations: Object.freeze(
        outstandingRecoveries.map(({ kind, recoveryId }) =>
          Object.freeze({ kind, recoveryId }),
        ),
      ),
      effectState: manualRecoveryRequired
        ? ("unknown" as const)
        : ("no_effect" as const),
    });
  }
  const executableState = state.value;
  if (!executableState)
    return blocked(request, "coordinator_state_observation_unknown", {
      knownState: state.value,
      queueId,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  let taskExecutions: ReturnType<typeof buildObjectiveTaskExecutions> | null;
  try {
    taskExecutions = buildObjectiveTaskExecutions(
      request,
      executableState,
      dependencies.repositoryRoot,
    );
  } catch {
    taskExecutions = null;
  }
  if (!taskExecutions)
    return blocked(request, "coordinator_task_execution_set_invalid");
  const execution = await runCoordinatorOperation({
    ...dependencies.execution,
    kind: "scheduled",
    persistence,
    ...(admitted?.status === "completed" && state.taskStartCandidates
      ? {
          admission: {
            state: executableState,
            queue,
            candidates: state.taskStartCandidates,
          },
        }
      : {}),
    input: {
      projectId: request.projectId,
      milestoneId: request.milestoneId,
      queueId,
      taskExecutions,
      cancellationSignal,
    },
  });
  const readLatest = () =>
    readProjectExecutionState(
      persistence.repository,
      persistence.repositoryBindingId,
      request.projectId,
      queueId,
    );
  // 委譲済みの結果観測は取消後も放棄しない。読取り不明を結果保存の再発行へはつなげない。
  const latest = wait
    ? await waitForStateContention(new AbortController().signal, readLatest)
    : readLatest();
  if (
    latest?.status === "blocked" &&
    (latest.manualRecoveryRequired || latest.recoveryId !== null)
  )
    return blocked(request, latest.reason, {
      queueId,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
      processRestartRequired: execution.processRestartRequired,
      recoveryIds: execution.recoveryIds,
      recoveryObligations: execution.recoveryObligations,
      ...(execution.workspaceResults === undefined
        ? {}
        : { workspaceResults: execution.workspaceResults }),
    });
  const latestCandidates =
    latest?.status === "completed" && latest.value
      ? inspectTaskStartCandidates(latest.value, latest.taskStartCandidates)
      : null;
  if (latest?.status === "completed" && latest.value && !latestCandidates)
    return blocked(request, "coordinator_state_observation_unknown", {
      knownState: latest.value,
      queueId,
      recoveryIds: execution.recoveryIds,
      recoveryObligations: execution.recoveryObligations,
      processRestartRequired: execution.processRestartRequired,
      ...(execution.workspaceResults === undefined
        ? {}
        : { workspaceResults: execution.workspaceResults }),
    });
  const projected =
    latest?.status === "completed" && latest.value
      ? projectCoordinatorState(latest.value, latestCandidates)
      : null;
  return createCoordinatorObjectiveResult(request, {
    status: execution.status,
    reason: execution.reason,
    queueId,
    projection:
      execution.status !== "cancelled" ||
      projected?.milestoneState === "cancelled"
        ? projected
        : null,
    cleanupConfirmed: execution.cleanupConfirmed,
    manualRecoveryRequired: execution.manualRecoveryRequired,
    processRestartRequired: execution.processRestartRequired,
    recoveryIds: execution.recoveryIds,
    recoveryObligations: execution.recoveryObligations,
    effectState: execution.effectState,
    ...(execution.workspaceResults === undefined
      ? {}
      : { workspaceResults: execution.workspaceResults }),
  });
}

/**
 * Canonical public result envelope for one Coordinator objective request.
 *
 * @responsibility Coordinator Objective 結果の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input request: CoordinatorObjectiveRequest、options: Readonly<{ status: "completed" | "blocked" | "cancelled"; reason: string; queueId?: string | null; projection?: ReturnType<typeof projectCoordinatorState> | null; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; processRestartRequired?: boolean; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryObligation["kind"]; recoveryId: string; }>[]; effectState?: "no_effect" | "settled" | "unknown"; }>
 * @returns createCoordinatorObjectiveResultの計算結果を返す。
 * @precondition 「request: CoordinatorObjectiveRequest、options: Readonly<{ status: "completed" | "blocked" | "cancelled"; reason: string; queueId?: string | null; projection?: ReturnType<typeof projectCoordinatorState> | null; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; processRestartRequired?: boolean; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryObligation["kind"]; recoveryId: string; }>[]; effectState?: "no_effect" | "settled" | "unknown"; }>」がcreateCoordinatorObjectiveResultの入力契約を満たす。
 * @postcondition createCoordinatorObjectiveResultの責務を完了した結果だけを返す。
 * @effect N/A: createCoordinatorObjectiveResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createCoordinatorObjectiveResultは独自の失敗分岐を所有しない。
 * @invariant createCoordinatorObjectiveResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createCoordinatorObjectiveResultはProcess内の同一Subsystemで完結する。
 * @security N/A: createCoordinatorObjectiveResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createCoordinatorObjectiveResultは共有非同期状態を持たない同期処理である。
 */
export function createCoordinatorObjectiveResult(
  request: CoordinatorObjectiveRequest,
  options: Readonly<{
    status: "completed" | "blocked" | "cancelled";
    reason: string;
    queueId?: string | null;
    projection?: ReturnType<typeof projectCoordinatorState> | null;
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    processRestartRequired?: boolean;
    recoveryIds?: readonly string[];
    recoveryObligations?: readonly Readonly<{
      kind: ProjectTaskRecoveryObligation["kind"];
      recoveryId: string;
    }>[];
    effectState?: "no_effect" | "settled" | "unknown";
    workspaceResults?: CoordinatorExecutionResult["workspaceResults"] | null;
  }>,
) {
  const workspaceResults =
    options.workspaceResults === undefined
      ? undefined
      : inspectCoordinatorWorkspaceResults(
          options.workspaceResults,
          request.workspaceId ?? null,
        );
  return Object.freeze({
    contract: COORDINATOR_OBJECTIVE_INTAKE_CONTRACT,
    status: options.status,
    reason: options.reason,
    requestId: request.requestId,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    queueId: options.queueId ?? null,
    projection: options.projection ?? null,
    cleanupConfirmed: options.cleanupConfirmed ?? true,
    manualRecoveryRequired: options.manualRecoveryRequired ?? false,
    processRestartRequired: options.processRestartRequired ?? false,
    recoveryIds: Object.freeze([...(options.recoveryIds ?? [])]),
    recoveryObligations: Object.freeze([
      ...(options.recoveryObligations ?? []),
    ]),
    effectState: options.effectState ?? ("no_effect" as const),
    ...(workspaceResults === undefined ? {} : { workspaceResults }),
  });
}

type ObjectiveAdmissionRead = ReturnType<typeof readObjectiveAdmission>;
type ObjectiveWorkspaceAdmission = Readonly<{
  workspace: NonNullable<
    Extract<ObjectiveAdmissionRead, { status: "completed" }>["value"]
  >["workspace"];
}>;

type ObjectiveAccess = Readonly<{
  directory: string;
  principalId: string;
  workspaceTarget?: PreparedWorkspaceTarget | null;
  prepareWorkspaceTarget?: () => StateContentionResult &
    Readonly<{
      value: PreparedWorkspaceTarget | null;
    }>;
  projectWorkspaceTarget?: (
    admission: ObjectiveWorkspaceAdmission,
  ) => ReturnType<NonNullable<ObjectiveAccess["prepareWorkspaceTarget"]>>;
  revalidate?: () => Promise<boolean>;
  beforeTask?: () => Promise<boolean>;
}>;

type ObjectiveAccessSource =
  | string
  | ((
      target: Readonly<{ projectId: string; workspaceId?: string }>,
    ) => ObjectiveAccess | null | Promise<() => ObjectiveAccess | null>);

type ObserveObjectiveWorkspace = (
  directory: string,
  projectId: string,
  workspaceId: string,
  admission?: ObjectiveWorkspaceAdmission,
) => ReturnType<NonNullable<ObjectiveAccess["prepareWorkspaceTarget"]>>;

let objectiveChildServing = false;

/**
 * 固定のServer子が、起動元から確定済みObjectiveを一件だけ受け取る接続。
 * @trace ARCH-000004 ARCH-000012
 * @boundary ユーザー入力は親が先に検査する。IPCの封筒は実行許可ではない。
 * @security 外から渡すChannelや検査済み印を受けず、親の現在認可を実行前に確認する。
 */
export function serveObjectiveChild(
  loadWorkspaceObserver: () => Promise<ObserveObjectiveWorkspace>,
): void {
  if (!process.send || !process.connected || objectiveChildServing)
    throw Error("objective_child_requires_ipc");
  objectiveChildServing = true;
  const send = process.send.bind(process);
  const cancellation = new AbortController();
  let received = false;
  let pending:
    | {
        kind: "grant" | "confirmed";
        resolve: (message: Record<string, unknown> | null) => void;
      }
    | undefined;
  const isFrame = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const disconnect = () => {
    if (process.connected) process.disconnect();
  };
  const stop = () => {
    cancellation.abort();
    pending?.resolve(null);
    pending = undefined;
  };
  const ask = (kind: "grant" | "confirmed", message: object) =>
    new Promise<Record<string, unknown> | null>((resolve) => {
      if (cancellation.signal.aborted || !process.connected)
        return resolve(null);
      pending = { kind, resolve };
      send(message, (error: Error | null) => {
        if (error) stop();
      });
    });
  const run = async (request: CoordinatorObjectiveRequest) => {
    const result = await runObjectiveAfterCapture(
      () => request,
      cancellation.signal,
      async (target) => {
        const message = await ask("grant", { kind: "authorize", ...target });
        const grant = message?.grant;
        if (
          !isFrame(grant) ||
          typeof grant.directory !== "string" ||
          typeof grant.principalId !== "string" ||
          cancellation.signal.aborted
        )
          return () => null;
        const { directory, principalId } = grant;
        const workspaceId = target.workspaceId;
        const observer = workspaceId ? await loadWorkspaceObserver() : null;
        const confirmed = await ask("confirmed", { kind: "confirm" });
        return () =>
          confirmed?.allowed === true && !cancellation.signal.aborted
            ? {
                directory,
                principalId,
                ...(observer &&
                  workspaceId && {
                    prepareWorkspaceTarget: () =>
                      observer(directory, target.projectId, workspaceId),
                    projectWorkspaceTarget: (
                      admission: ObjectiveWorkspaceAdmission,
                    ) =>
                      observer(
                        directory,
                        target.projectId,
                        workspaceId,
                        admission,
                      ),
                  }),
                revalidate: async () =>
                  (await ask("confirmed", { kind: "confirm" }))?.allowed ===
                  true,
                ...(grant.confirmBeforeTask === true && {
                  beforeTask: async () =>
                    (
                      await ask("confirmed", {
                        kind: "confirm",
                        purpose: "task",
                      })
                    )?.allowed === true,
                }),
              }
            : null;
      },
      undefined,
      undefined,
    );
    if (process.connected)
      await new Promise<void>((resolve) =>
        send({ kind: "result", value: result }, () => resolve()),
      );
  };
  const onDisconnect = () => {
    process.removeListener("message", onMessage);
    stop();
  };
  const onMessage = (message: unknown) => {
    if (isFrame(message)) {
      if (!received && message.kind === "execute") {
        const request = message.request;
        // ここでは起動元の通信形式だけを確認し、計画の意味は再検査しない。
        if (
          Reflect.ownKeys(message).length === 2 &&
          isFrame(request) &&
          (request.operation === "start" || request.operation === "resume") &&
          validIdentity(request.requestId) &&
          validIdentity(request.projectId) &&
          validIdentity(request.milestoneId) &&
          isFrame(request.plan) &&
          Array.isArray(request.taskInputs)
        ) {
          received = true;
          void run(request as CoordinatorObjectiveRequest)
            .catch(() => {
              process.exitCode = 1;
            })
            .finally(disconnect);
          return;
        }
      } else if (pending && message.kind === pending.kind) {
        const waiting = pending;
        pending = undefined;
        waiting.resolve(message);
        return;
      }
    }
    stop();
    if (!received) disconnect();
  };
  process.once("disconnect", onDisconnect);
  process.on("message", onMessage);
}

/**
 * CLI・MCP共通の公開Objectiveを受け付ける。
 *
 * @responsibility Coordinator Public Objectiveの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input 未信頼の要求と取消Signal、又は直接指定の実行先と認証済み主体、又は受付後に実行先を選ぶ接続。
 * @returns 受付・進行・既知の保存境界失敗を公開結果として返す。
 * @precondition 既存Objective要求・取消・Repository・主体の入力契約を満たす。
 * @postcondition 認証済みの同じ要求と回復参照を保持する。
 * @effect Repository・判断記録を観測し、受付状態の保存と認可済みTask実行を既存Ownerへ委譲する。
 * @failure 保存・所在の既知失敗だけを公開結果へ投影し、未知の失敗は例外のまま返す。
 * @invariant 予約・開始・結果保存・配送の順序と同じ要求Identityを維持する。
 * @boundary 公開Objective入力→認証・保存・実行依存の境界を接続する。
 * @security 認証済み主体・Repository・要求範囲を既存境界で検証し、現在の許可外へ実行を拡張しない。
 * @concurrency 取消Signalと実行・保存・結果搬送の非同期完了を既存Lifecycleへ接続する。
 */
export function runObjective(
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
  directoryOrAccess: ObjectiveAccessSource = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
  workspaceTarget?: PreparedWorkspaceTarget | null,
) {
  // 既定のcwd評価が失敗した時は従来どおり同期で通知する。
  return runObjectiveAfterCapture(
    () => inspectCoordinatorObjectiveRequest(rawRequest),
    cancellationSignal,
    directoryOrAccess,
    authenticationContext,
    workspaceTarget,
  );
}

// 検査済みの入力だけを扱う。外部へ公開せず、現在認可や対象実体はこの先で照合する。
function runObjectiveAfterCapture(
  capture: () => CoordinatorObjectiveRequest | null,
  cancellationSignal: AbortSignal,
  directoryOrAccess: ObjectiveAccessSource,
  authenticationContext: Readonly<{ principalId: string }> | undefined,
  workspaceTarget: PreparedWorkspaceTarget | null | undefined,
) {
  return (async () => {
    const request = capture();
    if (!request)
      return Object.freeze({
        contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
        status: "blocked" as const,
        reason: "coordinator_objective_request_invalid",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    let principalId: string | undefined;
    let directory: string;
    let suppliedWorkspace = workspaceTarget;
    let prepareWorkspaceTarget: ObjectiveAccess["prepareWorkspaceTarget"];
    let projectWorkspaceTarget: ObjectiveAccess["projectWorkspaceTarget"];
    let revalidate: ObjectiveAccess["revalidate"];
    let beforeTask: ObjectiveAccess["beforeTask"];
    if (typeof directoryOrAccess === "function") {
      const pending = directoryOrAccess(
        Object.freeze({
          projectId: request.projectId,
          ...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
        }),
      );
      // 遅延読込み後の認可と観測を、実行直前の同じ同期区間に置く。
      const access = types.isPromise(pending) ? (await pending)() : pending;
      directory = access?.directory ?? "";
      principalId = access?.principalId;
      suppliedWorkspace = access?.workspaceTarget;
      prepareWorkspaceTarget = access?.prepareWorkspaceTarget;
      projectWorkspaceTarget = access?.projectWorkspaceTarget;
      revalidate = access?.revalidate;
      beforeTask = access?.beforeTask;
    } else {
      directory = directoryOrAccess;
      principalId = authenticationContext?.principalId;
    }
    if (
      request.adoptResult &&
      (typeof directoryOrAccess !== "function" || isPrincipalId(principalId))
    )
      return createCoordinatorObjectiveResult(request, {
        status: "blocked",
        reason: "coordinator_explicit_workspace_adoption_required",
      });
    if (!isPrincipalId(principalId))
      return Object.freeze({
        contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
        status: "blocked" as const,
        reason: "coordinator_authenticated_principal_not_verified",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    if (
      !(cancellationSignal instanceof AbortSignal) ||
      cancellationSignal.aborted
    )
      return blocked(request, "coordinator_objective_cancelled_before_start");
    let repositoryRoot: string;
    try {
      repositoryRoot =
        resolveVerifiedRepositoryRootFromWorkingDirectory(directory);
    } catch {
      return Object.freeze({
        contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
        status: "blocked" as const,
        reason: "coordinator_repository_root_not_verified",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    }
    const repositoryBindingId =
      deriveCoordinatorRepositoryBindingId(repositoryRoot);
    const intake = createObjectiveIntake(
      request,
      repositoryBindingId,
      principalId,
    );
    const storage = resolveExecutionStorageDirectory(repositoryRoot);
    const admission =
      request.operation === "start" &&
      request.workspaceId &&
      revalidate &&
      projectWorkspaceTarget
        ? await waitForStateContention(
            cancellationSignal,
            () =>
              readObjectiveAdmission(
                storage,
                repositoryBindingId,
                request.projectId,
                intake.queueId,
                request.workspaceId,
              ),
            revalidate,
          )
        : undefined;
    const read = () => readExecutionState(storage, repositoryBindingId);
    const observed =
      admission !== undefined
        ? admission?.status === "completed"
          ? { ...admission, value: admission.value?.replay ?? null }
          : admission
        : typeof directoryOrAccess === "string" || revalidate
          ? await waitForStateContention(cancellationSignal, read, revalidate)
          : read();
    if (observed === null) {
      if (cancellationSignal.aborted)
        return blocked(request, "coordinator_objective_cancelled_before_start");
      return Object.freeze({
        contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
        status: "blocked" as const,
        reason: "coordinator_authenticated_principal_not_verified",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    }
    const replay = readObjectiveReplay(
      request,
      repositoryRoot,
      repositoryBindingId,
      intake,
      false,
      observed,
    );
    if (replay) return replay;
    const queueForRelease =
      request.operation === "resume" && observed.status === "completed"
        ? observed.value?.queueEntries.find(
            (queue) =>
              queue.queueId === intake.queueId &&
              queue.projectId === request.projectId &&
              queue.milestoneId === request.milestoneId &&
              queue.requestHash === intake.requestHash &&
              queue.singleTask === undefined &&
              queue.ownerGeneration !== null,
          )
        : undefined;
    const expectedTerminalState =
      queueForRelease?.state === "completed" ||
      queueForRelease?.state === "cancelled" ||
      queueForRelease?.state === "integration_pending" ||
      queueForRelease?.state === "preparation_blocked"
        ? queueForRelease.state
        : undefined;
    if (
      !expectedTerminalState &&
      request.workspaceId &&
      prepareWorkspaceTarget
    ) {
      const target =
        admission?.status === "completed" && projectWorkspaceTarget
          ? projectWorkspaceTarget({
              workspace: admission.value?.workspace ?? null,
            })
          : await waitForStateContention(
              cancellationSignal,
              prepareWorkspaceTarget,
              revalidate,
            );
      if (target === null)
        return blocked(
          request,
          cancellationSignal.aborted
            ? "coordinator_objective_cancelled_before_start"
            : "coordinator_authenticated_principal_not_verified",
        );
      if (target.status !== "completed")
        return blocked(request, target.reason, {
          // 受付がまだQueueへ相関していないため、保存領域の回復参照は公開しない。
          cleanupConfirmed:
            !target.manualRecoveryRequired && target.recoveryId === null,
          manualRecoveryRequired:
            target.manualRecoveryRequired || target.recoveryId !== null,
          effectState:
            target.manualRecoveryRequired || target.recoveryId !== null
              ? "unknown"
              : "no_effect",
        });
      suppliedWorkspace = target.value;
    }
    const preparedWorkspace = capturePreparedWorkspaceTarget(suppliedWorkspace);
    if (
      request.operation === "start" &&
      request.workspaceId &&
      !preparedWorkspace
    )
      return blocked(request, "coordinator_workspace_target_changed");
    const identity = expectedTerminalState
      ? null
      : readRepositorySnapshot(getRepository(repositoryRoot).capability);
    if (cancellationSignal.aborted)
      return blocked(
        Object.freeze({
          requestId: "invalid",
          projectId: "invalid",
          milestoneId: "invalid",
        }) as CoordinatorObjectiveRequest,
        "coordinator_objective_request_invalid",
      );
    let revisionConfirmed = expectedTerminalState !== undefined;
    try {
      revisionConfirmed ||=
        identity?.status === "observed" &&
        (identity.revisionIdentity === request.repositoryRevision ||
          workspacePlanReadyForAcceptance(
            repositoryRoot,
            repositoryBindingId,
            request.projectId,
            request.milestoneId,
            request.repositoryRevision,
            identity.revisionIdentity,
            intake.queueId,
          ));
    } catch {
      // 改訂または採用済みWorkspaceの観測不能は従来のBinding拒否へ閉じる。
    }
    if (
      !revisionConfirmed ||
      !validIdentity(repositoryBindingId) ||
      repositoryRoot.length === 0
    )
      return blocked(request, "coordinator_binding_not_verified");
    const groupId = `group-${createHash("sha256").update(`${request.projectId}\0${request.requestId}`).digest("hex").slice(0, 40)}`;
    const groupState: ObjectiveExecutionRecording = {
      repositoryRoot,
      projectId: request.projectId,
      requestId: request.requestId,
      groupId,
      workType: request.workType ?? null,
      attempted: false,
      group: null,
    };
    const execution = await executeAcceptedCoordinatorObjective(
      {
        authenticatedPrincipalId: principalId,
        binding: Object.freeze({
          repositoryBindingId,
          workingDirectory: repositoryRoot,
          repositoryRoot,
        }),
        intake,
        execution: {
          recording: groupState,
          workspaceTarget: preparedWorkspace,
          ...(beforeTask && { beforeTask }),
          ...(typeof directoryOrAccess === "string" || revalidate
            ? { leaseWait: revalidate ? { revalidate } : {} }
            : {}),
        },
      },
      request,
      cancellationSignal,
      observed,
      expectedTerminalState,
      admission ?? undefined,
    );
    if (
      execution.contract === COORDINATOR_PUBLIC_RUNTIME_CONTRACT ||
      execution.reason === "coordinator_objective_request_reused"
    )
      return execution;
    if (
      expectedTerminalState === "integration_pending" &&
      execution.status === "completed"
    )
      // この再開は解放確定だけ。採用可否を観測済みとして扱わない。
      return Object.freeze({
        ...execution,
        status: "blocked" as const,
        projection: null,
      });
    const eiGroup = groupState.group;
    if (eiGroup) {
      try {
        reportExecutionRecording(
          completeGroup(eiGroup.store, eiGroup.groupId, {
            endedAt: new Date().toISOString(),
            status: cancellationSignal.aborted
              ? "cancelled"
              : execution.status === "completed"
                ? "completed"
                : "failed",
          }),
        );
      } catch {
        reportExecutionRecordingUnavailable(eiGroup.groupId);
      }
    }
    const wasIntegrationPending =
      execution.reason === "coordinator_tasks_already_integration_pending";
    if (execution.projection?.milestoneState === "accepted")
      return wasIntegrationPending
        ? Object.freeze({
            ...execution,
            status: "completed" as const,
            reason: "coordinator_objective_already_accepted",
          })
        : execution;
    if (
      !execution.queueId ||
      (!wasIntegrationPending &&
        execution.reason !== "coordinator_tasks_completed_integration_pending")
    )
      return execution;
    const readWorkspace = () =>
      readWorkspaceState(
        resolveExecutionStorageDirectory(repositoryRoot),
        repositoryBindingId,
      );
    const snapshot =
      typeof directoryOrAccess === "string" || revalidate
        ? await waitForStateContention(
            new AbortController().signal,
            readWorkspace,
          )
        : readWorkspace();
    if (
      snapshot?.status === "blocked" &&
      (snapshot.manualRecoveryRequired || snapshot.recoveryId !== null)
    )
      return Object.freeze({
        ...execution,
        status: "blocked" as const,
        reason: "coordinator_workspace_target_unconfirmed",
        projection: null,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown" as const,
      });
    const current = snapshot?.status === "completed" ? snapshot.value : null;
    const queue = current?.queueEntries.find(
      (q) =>
        q.queueId === execution.queueId &&
        q.projectId === request.projectId &&
        q.milestoneId === request.milestoneId,
    );
    if (
      !current ||
      !queue ||
      (queue.workspaceId ?? undefined) !== request.workspaceId
    )
      return Object.freeze({
        ...execution,
        status: "blocked" as const,
        reason: "coordinator_workspace_target_unconfirmed",
      });
    const ready = workspacePlanReadyForAcceptance(
      repositoryRoot,
      repositoryBindingId,
      request.projectId,
      request.milestoneId,
      request.repositoryRevision,
      identity?.revisionIdentity ?? "",
      queue.queueId,
      current,
    );
    return Object.freeze({
      ...execution,
      status: "blocked" as const,
      reason:
        queue.workspaceId != null && !ready
          ? "coordinator_workspace_adoption_required"
          : "coordinator_quality_acceptance_required",
    });
  })().catch((error: unknown) => {
    if (
      error instanceof ExecutionStorageBlockedError ||
      error instanceof RepositoryDataBlockedError
    )
      return coordinatorDataBoundaryBlocked(error);
    throw error;
  });
}

/**
 * 受付済み要求を元のBinding・保存・実行へ接続する。
 * @responsibility 同じ要求を再捕捉せず、認証主体・取消Signal・依存結果の検査を維持する。
 * @trace ARCH-000004
 * @input dependencies: 既存依存、request: 要求受付が捕捉した値、cancellationSignal: 取消入力。
 * @returns 元の公開実行結果。
 * @precondition requestは同Moduleの公開入口で検査済み。
 * @effect 元のRepository観測・保存・実行・終了後整理だけ。
 * @failure 主体・Signal・Binding・依存結果の不正を元理由で停止する。
 * @boundary 外部要求受付と内部実行。
 * @security 検査済み入力を実行許可と同一視しない。
 */
async function executeAcceptedCoordinatorObjective(
  dependencies: Readonly<{
    authenticatedPrincipalId: string;
    binding: Readonly<{
      repositoryBindingId: string;
      workingDirectory: string;
      repositoryRoot: string | object;
    }>;
    intake: ReturnType<typeof createObjectiveIntake>;
    execution: CoordinatorObjectiveExecutionDependencies["execution"];
  }>,
  request: CoordinatorObjectiveRequest,
  cancellationSignal: AbortSignal,
  alreadyObserved?: ReturnType<typeof readExecutionState>,
  expectedTerminalState?: ObjectiveReleaseState,
  admission?: ObjectiveAdmissionRead,
) {
  if (
    !(cancellationSignal instanceof AbortSignal) ||
    cancellationSignal.aborted ||
    !isPrincipalId(dependencies.authenticatedPrincipalId)
  )
    return blocked(
      Object.freeze({
        requestId: "invalid",
        projectId: "invalid",
        milestoneId: "invalid",
      }) as CoordinatorObjectiveRequest,
      "coordinator_objective_request_invalid",
    );

  const { binding, intake } = dependencies;
  const repository = resolveExecutionStorageDirectory(binding.workingDirectory);
  const read = () =>
    readExecutionState(repository, binding.repositoryBindingId);
  const wait = dependencies.execution?.leaseWait;
  // 公開受付は同じ要求に対する保存断面を検査済み。競合中に発生した新規受付はcreateQueueがLock内で照合する。
  const observed =
    alreadyObserved ??
    (wait
      ? await waitForStateContention(cancellationSignal, read, wait.revalidate)
      : read());
  if (observed === null)
    return blocked(
      request,
      cancellationSignal.aborted
        ? "coordinator_objective_cancelled_before_start"
        : "coordinator_authenticated_principal_not_verified",
    );
  const replay = readObjectiveReplay(
    request,
    binding.workingDirectory,
    binding.repositoryBindingId,
    intake,
    false,
    observed,
  );
  if (replay) return replay;

  const result = await executeCoordinatorObjective(
    {
      authenticatedPrincipalId: dependencies.authenticatedPrincipalId,
      repositoryRoot: binding.repositoryRoot,
      persistence: Object.freeze({
        workingDirectory: binding.workingDirectory,
        repository,
        repositoryBindingId: binding.repositoryBindingId,
        intake,
        prepareStorage: () => {
          const verified = getRepository(repository.directory);
          if (verified.status !== "completed")
            throw new Error("coordinator_repository_root_invalid");
          return prepareExecutionStorageIgnore(verified.capability);
        },
      }),

      execution: dependencies.execution,
    },
    request,
    cancellationSignal,
    expectedTerminalState,
    admission,
  );
  if (
    expectedTerminalState !== undefined ||
    result.status === "blocked" ||
    result.reason === "coordinator_objective_request_reused"
  )
    return result;
  const maintenanceNow = Date.now();
  const maintenance = retireStateRecords(
    historyRepositoryInput(
      resolveExecutionStorageDirectory(binding.workingDirectory),
    ),
    binding.repositoryBindingId,
    maintenanceNow,
  );
  if (maintenance.status !== "completed")
    return Object.freeze({
      ...result,
      status: "blocked" as const,
      projection:
        result.projection?.milestoneState === "accepted"
          ? null
          : result.projection,
      reason: `${result.status === "cancelled" ? "coordinator_cancelled_" : ""}${maintenance.reason}`,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown" as const,
    });
  return result;
}

const PROJECT_CONTEXT_REFERENCE = "PROJECT_CONTEXT.md";

/**
 * 認可済みRepositoryの助言依頼を共通Provider実行へ一度だけ渡す。
 * @responsibility 投影・固定選定・送信同意・計画・結果と元Host／Docker参照を一つの利用側入口へ結合する。
 * @trace ARCH-000015
 * @input 検証済みRoot、完全ExecutionSelectionを含む今回の要求、取消と既存の実行観測。
 * @returns 非公開Provider本文を除いた結果、cleanup状態、元Host／Docker回復参照。
 * @precondition 上位が主体・Repository・今回操作の認可を済ませている。
 * @postcondition 助言用途で一回だけ実行し、編集・Reviewer・自動再送を追加しない。
 * @effect 既存のContext読取りと、同意成立後のProvider実行・取消・回収。
 * @failure 不明な実行・回収を成功やEffect 0へ補完しない。
 * @invariant 入力の固定選定、通信Hash、一回送信と非共有条件を保持する。
 * @boundary 公開Task利用側とProvider実行・Context投影の組立て。
 * @security 生出力・秘密値・Host Pathを公開しない。
 * @concurrency 一要求ごとの閉包で結果を捕捉し、既存の排他と一回消費に従う。
 */
export async function runRepositoryAdvice(
  root: Repository,
  request: CoordinatorAiRequestInput,
  signal: AbortSignal,
  observation?: AdviceObservation,
  recordingCurrent?: () => boolean,
) {
  let context: AdviceOperationContext | null = null;
  const repositoryRoot = resolveVerifiedRepositoryRoot(root);
  if (repositoryRoot !== null) {
    context = {
      ...observation,
      repository: root,
      repositoryRoot,
      recordingCurrent,
    };
  }
  return executeAdviceRequest(root, context, request, signal);
}

/** 終了観測と同じ元回復参照を、助言の公開結果と分けて返す。 @trace ARCH-000015 */
function finishAdvice(
  response: CoordinatorAiRequestResult,
  observed: ProviderAdviceRuntimeResult | null = null,
) {
  const failure = classifyProviderAdviceHostFailure(observed);
  const cleanup = observed?.cleanupConfirmed;
  return Object.freeze({
    result: response,
    cleanupConfirmed:
      typeof cleanup === "boolean" ? cleanup : response.status !== "unknown",
    hostRecoveryId: failure?.hostRecoveryId ?? null,
    dockerRecoveryId: failure?.dockerRecoveryId ?? null,
  });
}

/**
 * 固定Context・固定選定・同意を照合して一回の助言要求を処理する。
 * @responsibility 既存の投影・固定選定・送信契約を再利用しRequest台帳を作らない。
 * @trace ARCH-000015
 * @input 検証済みRoot、Repositoryの結合情報、完全ExecutionSelectionを含む要求と取消Signal。
 * @returns 助言結果と、同じ実行の清掃確認・回復参照。
 * @precondition 単発Taskの受付が保存済み又は新規確定の不変な選定を渡す。
 * @postcondition 固定Contextと完全選定以外へ送信しない。
 * @effect 固定Context読取りと既存の配送処理。
 * @failure 観測・取消・固定選定不成立は停止。
 * @invariant 変更実行・Candidate生成を行わない。
 * @boundary 単発Ownerと助言Runtime。
 * @security 本文を保存しない。
 * @concurrency 呼出しごとのSignalだけを利用する。
 */
async function executeAdviceRequest(
  repositoryRootCapability: Repository,
  context: AdviceOperationContext | null,
  request: CoordinatorAiRequestInput,
  cancellationSignal: AbortSignal,
) {
  const selected =
    request && !types.isProxy(request)
      ? Object.getOwnPropertyDescriptor(request, "executionSelection")
      : undefined;
  if (selected && !Object.hasOwn(selected, "value"))
    return finishAdvice(
      createAdviceRejectedResult("workbench_ai_advice_dispatch_input_invalid"),
    );
  const selection = selected?.value as ExecutionSelection | undefined;
  if (
    !selection ||
    types.isProxy(selection) ||
    !Object.isFrozen(selection) ||
    selection.role !== "advice" ||
    selection.purpose !== "advice"
  )
    return finishAdvice(
      createAdviceRejectedResult(
        "coordinator_ai_selection_not_available_for_advice",
      ),
    );
  // 準備が同期になっても、送信条件を調べる前に既に待機中の取消を反映する。
  const packet = await prepareRepositoryAdvicePacket(
    repositoryRootCapability,
    request,
    selection,
    cancellationSignal,
  );
  if (packet === null)
    return finishAdvice(
      createAdviceRejectedResult(
        "coordinator_ai_advice_projection_unavailable",
      ),
    );
  if (cancellationSignal.aborted)
    return finishAdvice(
      createAdviceRejectedResult("coordinator_ai_request_cancelled"),
    );
  const network = readRepositoryNetworkHosts(repositoryRootCapability);
  if (network.status !== "ready")
    return finishAdvice(
      createAdviceRejectedResult("coordinator_ai_network_policy_unavailable"),
    );
  if (cancellationSignal.aborted)
    return finishAdvice(
      createAdviceRejectedResult("coordinator_ai_request_cancelled"),
    );
  return dispatchAdviceRequest(
    context,
    Object.freeze({
      additionalHosts: network.additionalHosts,
      taskPacket: packet,
    }),
    cancellationSignal,
  );
}

/**
 * 検証済みRepositoryから固定Project Context Task Packetを生成する。
 *
 * @responsibility Root再検証、固定参照、通常FileおよびTask Packet検査を一つの読取り境界へ閉じる。
 * @trace ARCH-000015
 * @trace ARCH-000009
 * @input repositoryRootCapability、request、cancellationSignal。
 * @returns 検証済みTask Packet。不正、取消または観測不能時はnull。
 * @precondition requestはCoordinator Mode Routerの入力検査を通過している。
 * @postcondition Task Packetの投影は現在読取ったPROJECT_CONTEXT.md一件だけである。
 * @effect PROJECT_CONTEXT.mdのMetadata、real pathおよび本文を読取る。
 * @failure File欠落、Link、Root越境、参照不一致またはTask検証失敗はnullへ畳む。
 * @invariant File内容をlog、例外または公開失敗結果へ含めない。
 * @boundary 検証済みRepository Filesystemと外部送信前Task Packetの境界。
 * @security Project Context以外のPathを解決せず、Linkを辿らない。
 * @concurrency 読取り前後の取消を確認し、取消後にDispatchへ進まない。
 */
function prepareRepositoryAdvicePacket(
  repositoryRootCapability: Repository,
  request: CoordinatorAiRequestInput,
  selection: ExecutionSelection,
  cancellationSignal: AbortSignal,
): AdviceTaskPacket | null {
  if (
    cancellationSignal.aborted ||
    request.mode !== "read_only_advice" ||
    request.contextReferences.length !== 1 ||
    request.contextReferences[0] !== PROJECT_CONTEXT_REFERENCE
  )
    return null;
  const repositoryRoot = resolveVerifiedRepositoryRoot(
    repositoryRootCapability,
  );
  if (repositoryRoot === null) return null;
  try {
    if (cancellationSignal.aborted) return null;
    const observed = createFilesystemRepositoryObservationPort(
      repositoryRoot,
    ).observeFile(PROJECT_CONTEXT_REFERENCE);
    if (observed.status !== "resolved") return null;
    const content = observed.source;
    if (cancellationSignal.aborted) return null;
    const prepared = prepareAdviceTask(
      {
        prompt: request.prompt,
        projection: [
          {
            reference: PROJECT_CONTEXT_REFERENCE,
            content,
          },
        ],
      },
      selection,
    );
    return prepared.status === "prepared" ? prepared.taskPacket : null;
  } catch {
    return null;
  }
}

/**
 * Request／Dispatchの拒否結果を共通形式で生成する。
 *
 * @responsibility Request／Dispatchの拒否理由と空結果区分を同じCoordinator結果へ変換する。
 * @trace ARCH-000015
 * @input reason: 固定された公開理由。
 * @returns blocked状態で内容区分が空のCoordinator AI結果。
 * @precondition reasonはPromptまたはFilesystem情報を含まない。
 * @postcondition 全結果区分を空にし、事実や推論を捏造しない。
 * @effect N/A: 固定Objectを生成するだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant raw内容、Host Pathおよび秘密値を公開しない。
 * @boundary Coordinator内部の失敗結果境界。
 * @security 入力内容を結果へ複製しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function createAdviceRejectedResult(
  reason: string,
): CoordinatorAiRequestResult {
  return createAdviceResult("blocked", reason);
}

/**
 * 読取り助言のProvider配送・取消境界で使用するAdviceProviderInputの構造を固定する。
 *
 * @responsibility 読取り助言のProvider配送・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type AdviceProviderInput = Readonly<{
  additionalHosts: readonly string[];
  taskPacket: AdviceTaskPacket;
}>;

/**
 * 固定した助言入力をProviderへ一回渡し、公開結果へ整形する。
 *
 * @responsibility 入力の固定選定と通信先を確認し、送信・回収と助言結果を区別する。
 * @trace ARCH-000015
 * @input Repositoryの結合情報、配送入力と元の取消Signal。
 * @returns Promiseで検査済み助言結果を返す。
 * @precondition 受付が固定Contextと選定を捕捉しており、任意Path・任意引数は渡さない。
 * @postcondition completedは、Provider Effect、cleanupおよび根拠参照付き結果の全条件が確認できた場合だけ返る。
 * @effect 入力検査と開始前の取消確認を通過した場合だけProvider接続を最大一回呼ぶ。
 * @failure 入力不整合、取消、接続例外、回収不明または結果不正を成功へ畳まない。
 * @invariant この処理は新しい実行許可を発行せず、失敗後に自動再送しない。
 * @boundary 受付済みの助言と用途固定実行の境界。
 * @security 生出力、Prompt、投影本文、CredentialおよびHost Pathを公開結果へ含めない。
 * @concurrency 同じSignalを搬送し、Providerから戻った後も取消と既知Effectの組合せを確認する。
 */
async function dispatchAdviceRequest(
  context: AdviceOperationContext | null,
  input: AdviceProviderInput,
  cancellationSignal: AbortSignal,
) {
  const network = snapshotPlainArray<string>(input.additionalHosts, 32);
  if (
    network.status !== "ok" ||
    !network.value.every(
      (host) => typeof host === "string" && host.length <= 253,
    )
  )
    return finishAdvice(
      createAdviceRejectedResult("workbench_ai_advice_dispatch_input_invalid"),
    );
  if (cancellationSignal.aborted)
    return finishAdvice(
      createAdviceRejectedResult("coordinator_ai_request_cancelled"),
    );

  let observed: ProviderAdviceRuntimeResult | null = null;
  let response: CoordinatorAiRequestResult;
  try {
    observed = await executeAcceptedAdviceInput(
      context,
      Object.freeze({
        additionalHosts: network.value,
        taskPacket: input.taskPacket,
      }),
      cancellationSignal,
    );
    response = projectAdviceOutcome(observed, cancellationSignal);
  } catch {
    response = unknown("workbench_ai_provider_effect_state_unknown");
  }
  return finishAdvice(response, observed);
}

/** Effectと回収を分け、取消後の結果や観測不能を成功へ昇格させない。 @trace ARCH-000015 */
function projectAdviceOutcome(
  observed: ProviderAdviceRuntimeResult | null,
  cancellationSignal: AbortSignal,
): CoordinatorAiRequestResult {
  if (observed === null)
    return unknown(
      cancellationSignal.aborted
        ? "workbench_ai_provider_effect_after_cancellation_unknown"
        : "workbench_ai_provider_cleanup_unknown",
    );
  const { advice, status, providerEffectIssued, cleanupConfirmed } = observed;
  const completed =
    status === "completed" &&
    advice !== null &&
    providerEffectIssued === true &&
    cleanupConfirmed === true;
  const refusal = completed
    ? null
    : (observed.reason ?? "workbench_ai_advice_runtime_incomplete");
  if (
    (status !== "completed" && status !== "blocked") ||
    typeof providerEffectIssued !== "boolean" ||
    typeof cleanupConfirmed !== "boolean" ||
    (!completed && (typeof refusal !== "string" || refusal.length === 0)) ||
    (completed && (typeof advice !== "object" || advice.status !== "completed"))
  )
    return unknown("workbench_ai_provider_outcome_invalid");
  if (cancellationSignal.aborted && providerEffectIssued)
    return unknown("workbench_ai_provider_effect_after_cancellation_unknown");
  if (!cleanupConfirmed)
    return unknown("workbench_ai_provider_cleanup_unknown");
  if (!completed)
    return createAdviceRejectedResult(
      refusal ?? "workbench_ai_advice_runtime_incomplete",
    );

  return Object.freeze({
    status: "completed" as const,
    reason: null,
    facts: advice.facts,
    sharedAnalysis: advice.sharedAnalysis,
    additionalInferences: advice.additionalInferences,
    nextOptions: advice.nextOptions,
    candidate: null,
  });
}

/**
 * Effectまたはcleanupを確定できない結果を生成する。
 *
 * @responsibility 観測不能を拒否や成功へ畳まずunknownとして返す。
 * @trace ARCH-000015
 * @input reason: 機械可読な観測不能理由。
 * @returns unknown状態のAI依頼結果。
 * @precondition reasonは空でない固定理由である。
 * @postcondition 結果は根拠なしの助言内容を含まない。
 * @effect N/A: 固定結果を生成するだけである。
 * @failure N/A: resultへ委譲するだけである。
 * @invariant unknownをblockedまたはcompletedへ変換しない。
 * @boundary Dispatch観測とApplication結果の境界。
 * @security 生入力、生出力およびCredentialを含めない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function unknown(reason: string): CoordinatorAiRequestResult {
  return createAdviceResult("unknown", reason);
}

/**
 * 非完了のAI依頼結果を共通形式で生成する。
 *
 * @responsibility blocked／unknownのPayloadを空の読取り専用配列へ固定する。
 * @trace ARCH-000015
 * @input status: 非完了状態、reason: 機械可読理由。
 * @returns 指定状態のCoordinator AI依頼結果。
 * @precondition statusはblockedまたはunknownで、reasonは空でない。
 * @postcondition すべての内容区分は空で固定される。
 * @effect N/A: 固定結果を生成するだけである。
 * @failure N/A: 分岐や外部処理を持たない。
 * @invariant 未確認情報を事実、分析、推論または次候補として作らない。
 * @boundary 内部判定と公開Application結果の境界。
 * @security 生入力、生出力およびCredentialを含めない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function createAdviceResult(
  status: "blocked" | "unknown",
  reason: string,
): CoordinatorAiRequestResult {
  return Object.freeze({
    status,
    reason,
    facts: Object.freeze([]),
    sharedAnalysis: Object.freeze([]),
    additionalInferences: Object.freeze([]),
    nextOptions: Object.freeze([]),
    candidate: null,
  });
}

/**
 * 助言入力からProvider計画を作りRuntimeを一度実行する。
 *
 * @responsibility 完全選定から計画を作り、単一Runtimeへの搬送前に非共有条件とProvider・Model・推論強度を確認する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input Repositoryの結合情報、固定選定とTaskを含む入力、取消Signal。
 * @returns PromiseでProvider結果・Effect・cleanup観測を返す。
 * @precondition runtimeは固定配布物、Subscription認証、取消およびcleanup契約を所有する。
 * @postcondition 同じTask Identityと選択固定選定の計画でruntimeを最大一回呼び出す。
 * @effect 一依頼につき選択Provider Executorを最大一回呼び出す。
 * @failure 技術計画の不整合はExecutor Effect前に拒否する。
 * @invariant Provider、Model、推論強度およびOfferingをfallbackで変更しない。
 * @boundary Provider非依存DispatchとProvider固有実行境界の間。
 * @security API Key、任意Command、任意PathおよびProvider生設定を入力へ含めない。
 * @concurrency 共有選択状態を持たず、呼出し入力だけでExecutorを決定する。
 */
async function executeAcceptedAdviceInput(
  context: AdviceOperationContext | null,
  input: AdviceProviderInput,
  cancellationSignal: AbortSignal,
): Promise<ProviderAdviceRuntimeResult | null> {
  const executionInput = Object.freeze({
    additionalHosts: input.additionalHosts,
    providerPrompt: input.taskPacket.providerPrompt,
    allowedReferences: input.taskPacket.allowedReferences,
    taskHash: input.taskPacket.taskHash,
    projectionHash: input.taskPacket.projectionHash,
  });
  const prepared = prepareProviderAdviceInput(
    executionInput,
    input.taskPacket.executionSelection,
  );
  if (!prepared)
    return blockAdviceRuntime(
      "workbench_ai_advice_execution_plan_invalid",
      false,
      true,
    );
  if (cancellationSignal.aborted)
    return blockAdviceRuntime(
      "workbench_ai_advice_cancelled_before_provider_effect",
      false,
      true,
    );
  try {
    return context
      ? await executeProviderAdvice(context, prepared, cancellationSignal)
      : blockAdviceRuntime(
          cancellationSignal.aborted
            ? "workbench_ai_advice_cancelled_before_runtime_effect"
            : "workbench_ai_advice_repository_binding_unavailable",
          false,
          true,
        );
  } catch {
    return null;
  }
}

/**
 * 助言Runtimeの初回失敗に結合する非公開の回復情報を表す。
 *
 * @responsibility 清掃分類と取得済みexact参照を同じ初回結果に保持する。
 * @trace ARCH-000008
 * @shape 清掃確認、手動回復要否、Host参照および引渡し後だけ取得するDocker参照。
 * @invariant 清掃確認済みの場合は参照を回復対象として保持しない。
 * @boundary Coordinator内部の失敗分類境界。
 * @security 元参照を公開JSON、理由、Provider入力またはlogへ複製しない。
 * @compatibility 公開結果SchemaおよびRecovery Authorityを変更しない。
 */
type HostFailure = Readonly<{
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  hostRecoveryId: string | null;
  dockerRecoveryId?: string | null;
}>;

const hostFailures = new WeakMap<object, HostFailure>();

const initializationFailures = new WeakMap<Error, HostFailure>();

/**
 * 同じ初回Runtime結果に保持されたHost／Docker失敗分類を内部で照会する。
 *
 * @responsibility 元の結果Objectに結合した分類だけを返す。
 * @trace ARCH-000008
 * @input result: 初回Runtime結果または未知の値。
 * @returns 保持済み分類、または結合がなければnull。
 * @precondition 呼出し元はCoordinator内部で結果Objectを保持している。
 * @postcondition copy、公開投影または別Processに元参照を復元しない。
 * @effect N/A: Process内WeakMapを読み取るだけである。
 * @failure 未登録の値をnullとし、Host資源不存在とは解釈しない。
 * @invariant 参照の照会から削除権限、非使用または回復成功を発行しない。
 * @boundary 非公開Runtime結果と内部失敗分類の境界。
 * @security 公開indexへexportせず、JSON列挙対象へ値を追加しない。
 * @concurrency 同じ結果への分類を返却後に変更しない。
 */
export function classifyProviderAdviceHostFailure(result: unknown) {
  return result !== null && typeof result === "object"
    ? (hostFailures.get(result) ?? null)
    : null;
}

/**
 * 読取り助言Runtime境界で使用するRuntimeRecordの構造を固定する。
 *
 * @responsibility 読取り助言Runtime境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

type RuntimeRecord = Readonly<Record<string, unknown>>;

/**
 * 読取り助言Runtime境界で使用するOperationの構造を固定する。
 *
 * @responsibility 読取り助言Runtime境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */
export type Operation = Readonly<{
  owned: object;
  mountCapability: object;
  managementCapability: object;
  operationId: string;
  hostRecoveryId: string;
}>;

/**
 * 助言のOperation生成と実開始を上位へ通知する。
 *
 * @responsibility 必要な保存処置を待ち、保存結果を通知の返却値へ載せない。
 * @trace ARCH-000008
 * @shape 任意のOperation参照・開始通知とvoid又はPromise<void>。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

interface ProviderAdviceCallbacks {
  observeOperation?(
    operation: Readonly<{ operationId: string; hostRecoveryId: string }>,
  ): void | Promise<void>;
  observeStarted?(): void | Promise<void>;
}

/**
 * 助言の元相関と利用側通知を保持する。
 * @responsibility 受付済み要求の開始・記録通知だけを実行へ渡す。
 * @trace ARCH-000008
 * @shape 元相関とProviderAdviceCallbacks。
 * @invariant 通知の完了をTask成功や実清掃へ読み替えない。
 * @boundary 呼出し元の観測と助言実行。
 * @security 任意CLI・保存先・Authorityを追加しない。
 * @compatibility 既存の拒否理由・回収・回復参照を維持する。
 */
type AdviceObservation = Readonly<{
  recoveryCorrelationId?: string;
}> &
  ProviderAdviceCallbacks;

/** 助言の保存と実行を同じ検証済みRepositoryへ結び付ける。 @trace ARCH-000008 */
type AdviceOperationContext = AdviceObservation &
  Readonly<{
    repository: Repository;
    repositoryRoot: string | null;
    recordingCurrent: (() => boolean) | undefined;
  }>;

/**
 * 固定した計画の助言を一回実行し、元の完了と回収結果を観測する。
 *
 * @responsibility 読取り助言Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 固定のHost・Packet・実行・回収操作だけを発行する。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

async function executeProviderAdvice(
  context: AdviceOperationContext,
  plan: ProviderAdviceExecutionInput,
  cancellationSignal: AbortSignal,
): Promise<ProviderAdviceRuntimeResult> {
  if (cancellationSignal.aborted)
    return blockAdviceRuntime(
      "workbench_ai_advice_cancelled_before_runtime_effect",
      false,
      true,
    );
  if (isExecutionProcessPoisoned())
    return blockAdviceRuntime(
      "workbench_ai_advice_process_restart_required",
      false,
      true,
    );

  const { provider } = plan.executionSelection;
  let operation: Operation | null = null;
  let packetOwner: object | null = null;
  let processControl: object | null = null;
  let hostCompletion: HostCompletionTarget | null = null;
  let recoveryHandoffRejected = false;
  let authorityCleanupConfirmed = true;
  let providerEffectIssued = false;
  let cancellationTransferred = false;
  const executionRecordings: ProviderExecutionRecording[] = [];
  const recordResult = (
    result: ProviderAdviceRuntimeResult,
  ): ProviderAdviceRuntimeResult => {
    const failure = hostFailures.get(result);
    finishProviderExecutionRecordings(executionRecordings, {
      status: result.status,
      reason: result.reason ?? "advice_completed",
      cleanupConfirmed: result.cleanupConfirmed,
      manualRecoveryRequired:
        failure?.manualRecoveryRequired ?? !result.cleanupConfirmed,
      processRestartRequired: isExecutionProcessPoisoned(),
    });
    return result;
  };

  try {
    operation = await openAdviceOperation(
      context,
      cancellationSignal,
      () => !cancellationSignal.aborted && !isExecutionProcessPoisoned(),
    );
    hostCompletion = {
      ownedOperation: operation.owned,
      managementCapability: operation.managementCapability,
      hostRecoveryId: operation.hostRecoveryId,
      hostCleanupCompleted: false,
      dockerHandoffs: [],
    };
    if (cancellationSignal.aborted)
      throw new AdviceRuntimeError(
        "workbench_ai_advice_cancelled_during_operation_creation",
      );

    const repositoryBinding = bindRepositoryOperation(
      operation.managementCapability,
      context.repositoryRoot,
    );
    if (
      !repositoryBinding ||
      repositoryBinding.operationId !== operation.operationId
    )
      throw new AdviceRuntimeError(
        "workbench_ai_advice_repository_binding_unavailable",
      );

    try {
      await context.observeOperation?.({
        operationId: operation.operationId,
        hostRecoveryId: operation.hostRecoveryId,
      });
    } catch {
      throw new AdviceRuntimeError(
        "workbench_ai_advice_operation_save_unconfirmed",
      );
    }
    const preflight = preflightDelegationSelections(
      operation.managementCapability,
      Object.freeze({
        operationId: operation.operationId,
        executionSelections: Object.freeze([plan.executionSelection]),
      }),
    );
    if (preflight.status !== "matched")
      throw new AdviceRuntimeError("workbench_ai_advice_selection_unavailable");

    const observation = inspectWindowsProviderHomeCandidate(provider);
    const providerHome = observation.providerHome;
    if (
      observation.status !== "candidate" ||
      !providerHome ||
      providerHome.provider !== provider
    )
      throw new AdviceRuntimeError(
        "workbench_ai_advice_provider_home_unavailable",
      );
    const packet = issueProviderAdvicePacket(
      {
        operationId: operation.operationId,
        provider,
        taskHash: plan.taskHash,
        projectionHash: plan.projectionHash,
        providerPrompt: plan.providerPrompt,
        allowedReferences: plan.allowedReferences,
        additionalHosts: plan.additionalHosts,
      },
      plan.executionSelection,
    ) as RuntimeRecord;
    packetOwner = objectValue(packet.ownerCapability);
    const packetUse = objectValue(packet.useCapability);
    if (
      packet.status !== "issued" ||
      !packetOwner ||
      !packetUse ||
      typeof packet.packetRef !== "string"
    )
      throw new AdviceRuntimeError(
        "workbench_ai_advice_runtime_packet_unavailable",
      );

    const process = startDockerProcessController(
      provider,
      {
        purpose: "advice",
        managementCapability: operation.managementCapability,
        mountCapability: operation.mountCapability,
        providerHome,
        taskAttempt: 0,
        packetCapability: packetUse,
        packetOwnerCapability: packetOwner,
        packetRef: packet.packetRef,
        recoveryCorrelationId: context.recoveryCorrelationId,
        consumer: "workbench",
      },
      (capability: unknown, recoveryId: unknown) => {
        if (
          recoveryHandoffRejected ||
          !hostCompletion ||
          hostCompletion.dockerHandoffs.length > 0 ||
          !registerDockerHandoff(hostCompletion, capability, recoveryId)
        ) {
          recoveryHandoffRejected = true;
          return false;
        }
        return true;
      },
      context.observeStarted,
      { operation: "advice" },
      executionRecordings,
    );
    if (process.preparationFailed === true)
      throw new AdviceRuntimeError(
        "workbench_ai_advice_provider_preparation_failed",
      );
    packetOwner = null;
    processControl = objectValue(process.controlCapability);
    const completion = process.completion;
    providerEffectIssued = process.dockerEffectStarted === true;
    if (
      process.status !== "started" ||
      recoveryHandoffRejected ||
      !hostCompletion.dockerHandoffs[0] ||
      !processControl ||
      !(completion instanceof Promise)
    )
      throw new AdviceRuntimeError(
        stringValue(process.reason) ??
          "workbench_ai_advice_process_start_failed",
      );

    const startedControl = processControl;
    const startedManagement = operation.managementCapability;
    const observed = await observeExecutionCompletion(
      { controlCapability: startedControl, completion },
      (control) => {
        cancellationTransferred = true;
        return cancelExecutorAttempt(control, startedManagement);
      },
      cancellationSignal,
    );
    if (observed.status !== "observed") throw observed.error;
    const result = observed.rawCompletion;
    processControl = null;
    if (result.cleanupConfirmed !== true)
      throw new AdviceRuntimeError(
        stringValue(result.reason) ??
          "workbench_ai_advice_provider_cleanup_unconfirmed",
      );
    const providerCompletionReason = cancellationSignal.aborted
      ? "workbench_ai_advice_cancelled_after_provider_effect"
      : result.status === "completed"
        ? null
        : (stringValue(result.reason) ?? "workbench_ai_advice_provider_failed");
    const handoff = matchDockerHandoff(
      hostCompletion,
      hostCompletion.dockerHandoffs[0]?.recoveryId ?? null,
      result.recoveryFinalizationCapability,
    );
    if (handoff === "not_tracked" || handoff === "mismatch")
      throw new AdviceRuntimeError(
        "workbench_ai_advice_recovery_finalization_unavailable",
      );
    const advice =
      providerCompletionReason === null &&
      result.normalizedResult &&
      "facts" in result.normalizedResult
        ? result.normalizedResult
        : null;
    if (providerCompletionReason === null && !advice)
      throw new AdviceRuntimeError(
        "workbench_ai_advice_normalized_result_invalid",
      );

    recordDockerHandoffCompletion(handoff, result);
    const settled = await completeHostOperation(hostCompletion);
    if (settled.error !== undefined) throw settled.error;
    if (settled.status !== "completed")
      throw new AdviceRuntimeError(
        settled.stage === "intent" || settled.stage === "handoff"
          ? "workbench_ai_advice_host_cleanup_intent_unconfirmed"
          : settled.stage === "cleanup"
            ? "workbench_ai_advice_operation_cleanup_unconfirmed"
            : "workbench_ai_advice_docker_recovery_finalization_unconfirmed",
      );
    const hostCleanup = settled.hostCleanup;
    if (hostCleanup === "protocol_failure_cleanup_confirmed")
      return recordResult(
        blockAdviceRuntime(
          "workbench_ai_advice_host_generation_lost",
          true,
          true,
        ),
      );
    if (providerCompletionReason !== null)
      return recordResult(
        blockAdviceRuntime(providerCompletionReason, true, true),
      );
    if (advice === null)
      return recordResult(
        blockAdviceRuntime(
          "workbench_ai_advice_normalized_result_invalid",
          true,
          true,
        ),
      );
    return recordResult(
      Object.freeze({
        status: "completed" as const,
        reason: null,
        advice,
        providerEffectIssued: true as const,
        cleanupConfirmed: true as const,
      }),
    );
  } catch (error) {
    const unresolved = hostCompletion?.dockerHandoffs.find(
      (handoff) => handoff.state !== "finalized",
    );
    const dockerRecoveryId = unresolved?.recoveryId ?? null;
    if (processControl && operation && !cancellationTransferred) {
      cancellationTransferred = true;
      try {
        await cancelExecutorAttempt(
          processControl,
          operation.managementCapability,
        );
      } catch {}
    }
    const packet = packetOwner;
    packetOwner = null;
    if (packet) {
      try {
        if (revokeProviderAdvicePacket(packet) !== true)
          authorityCleanupConfirmed = false;
      } catch {
        authorityCleanupConfirmed = false;
      }
    }
    const initializationFailure =
      error instanceof AdviceRuntimeError
        ? (initializationFailures.get(error) ?? null)
        : classifyOwnedCoordinatorOperationCreationFailure(error);
    let cleanupConfirmed =
      hostCompletion?.hostCleanupCompleted === true ||
      (operation === null && initializationFailure?.cleanupConfirmed === true);
    if (
      hostCompletion &&
      hostCompletion?.hostCleanupCompleted !== true &&
      !providerEffectIssued &&
      !unresolved
    ) {
      try {
        const cleanup = await completeHostOperation(hostCompletion);
        cleanupConfirmed =
          cleanup.status === "completed" && hostCompletion.hostCleanupCompleted;
      } catch {
        cleanupConfirmed = false;
      }
    }
    cleanupConfirmed =
      cleanupConfirmed &&
      authorityCleanupConfirmed &&
      dockerRecoveryId === null;
    if (hostCompletion && (unresolved || !cleanupConfirmed)) {
      try {
        await retainHostOperation(hostCompletion);
      } catch {}
    }
    if (!cleanupConfirmed) {
      try {
        poisonExecutionProcessAfterCleanupUnknown();
      } catch {
        // 終了通知の例外でも一次結果と同じ回復参照を登録する。
      }
    }
    const result = blockAdviceRuntime(
      error instanceof AdviceRuntimeError
        ? error.reason
        : "workbench_ai_advice_runtime_failed_closed",
      providerEffectIssued,
      cleanupConfirmed,
    );
    hostFailures.set(
      result,
      Object.freeze({
        cleanupConfirmed,
        manualRecoveryRequired:
          !cleanupConfirmed ||
          initializationFailure?.manualRecoveryRequired === true,
        hostRecoveryId: cleanupConfirmed
          ? null
          : hostCompletion
            ? hostCompletion.hostRecoveryId
            : (operation?.hostRecoveryId ??
              initializationFailure?.hostRecoveryId ??
              null),
        dockerRecoveryId,
      }),
    );
    return recordResult(result);
  }
}

/**
 * 読取り助言Runtime境界で使用するAdviceRuntimeErrorのlifecycleを固定する。
 *
 * @responsibility 読取り助言Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
 * @construction 明示された入力からだけ生成する。
 * @lifecycle 生成元の処理範囲を越えてAuthorityまたは資源を保持しない。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

class AdviceRuntimeError extends Error {
  readonly reason: string;

  /**
   * 公開理由と私有Host分類を同じ初期化失敗へ結合する。
   *
   * @responsibility 下位で取得済みの分類を外側catchまで保持する。
   * @trace ARCH-000008
   * @input reason: 固定理由、hostFailure: 私有分類またはnull。
   * @returns 現在Process内の失敗Object。
   * @precondition 分類は所有Operation境界の観測結果である。
   * @postcondition 理由へ元参照を埋め込まない。
   * @effect N/A: Errorの局所値を初期化するだけである。
   * @failure N/A: 自身で追加の資源処置をしない。
   * @invariant 分類の保持から回復成功やAuthorityを発行しない。
   * @boundary 下位初期化と外側の失敗処理の境界。
   * @security Errorを公開結果として返さず、私有参照はJSON投影しない。
   * @concurrency 生成後に分類を置換しない。
   */
  constructor(reason: string, hostFailure: HostFailure | null = null) {
    super(reason);
    this.reason = reason;
    if (hostFailure !== null) initializationFailures.set(this, hostFailure);
  }
}

/**
 * 検証済みRepositoryに結び付く助言用Hostを開く。
 *
 * @responsibility 助言の記録可否・現在性を照合し、Host開始失敗の元分類を保持する。
 * @trace ARCH-000008
 * @trace ARCH-000010
 * @input Repositoryの結合情報、取消、実行の現在性。
 * @returns 助言用Hostの所有Operation。
 * @precondition 呼出し側は元Repository参照を確定する。
 * @postcondition 検証したRootだけをOperationのRepository結合へ使用する。
 * @effect 既存のHost開始・Operation作成処理を呼ぶ。
 * @failure Repository結合不能は実行時に`workbench_ai_advice_repository_binding_unavailable`へ閉じる。
 * @invariant Repository／WorkspaceのProvider Mountを有効化しない。
 * @boundary 呼出し元が渡した検証済みRepository CapabilityとCoordinator Runtimeの境界。
 * @security Repository Pathを公開結果、Task PacketまたはProvider入力へ追加しない。
 * @concurrency 現在性をHost開始処理へ渡し、既存の排他を使用する。
 */
async function openAdviceOperation(
  { repository, repositoryRoot, recordingCurrent }: AdviceOperationContext,
  signal: AbortSignal,
  current: () => boolean,
): Promise<Operation> {
  if (!repositoryRoot || !recordingCurrent?.())
    throw new AdviceRuntimeError(
      "workbench_ai_advice_repository_binding_unavailable",
    );
  const host = await openExecutionHost(
    signal,
    () =>
      current() === true &&
      getRepository(repositoryRoot).status === "completed",
    {
      root: repository,
      purpose: "advice",
      recordingCurrent,
      executionCurrent: current,
    },
  );
  if (host.status === "startup_failed")
    throw new AdviceRuntimeError(host.failure.reason, host.failure);
  if (host.status === "creation_failed")
    throw new AdviceRuntimeError(
      host.failure?.cleanupConfirmed
        ? "workbench_ai_advice_operation_initialization_failed_cleanup_confirmed"
        : "workbench_ai_advice_operation_initialization_cleanup_unknown_process_restart_required",
      host.failure,
    );
  return host.operation;
}

/**
 * 読取り助言Runtime境界におけるobjectValueの処理境界を固定する。
 *
 * @responsibility 読取り助言Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function objectValue(value: unknown): object | null {
  return value !== null && typeof value === "object" ? value : null;
}

/**
 * 読取り助言Runtime境界におけるstringValueの処理境界を固定する。
 *
 * @responsibility 読取り助言Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * 読取り助言Runtime境界におけるblockAdviceRuntimeの処理境界を固定する。
 *
 * @responsibility 読取り助言Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function blockAdviceRuntime(
  reason: string,
  providerEffectIssued: boolean,
  cleanupConfirmed: boolean,
): ProviderAdviceRuntimeResult {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    advice: null,
    providerEffectIssued,
    cleanupConfirmed,
  });
}

/** Task固有の候補・Review診断は上位に残す。通知失敗を実行結果へ反映しない。
 * @responsibility 単段の技術観測とは別に、Taskの受動診断だけを搬送する。
 * @trace ARCH-000004
 */
function reportTaskDiagnostic(notice: ProviderBoundaryDiagnosticNotice) {
  try {
    const pending = reportProviderBoundaryDiagnostic(notice);
    if (pending) void pending.catch(() => {});
  } catch {
    // Task診断は実行許可・取消・保存結果を変更しない。
  }
}

const PRODUCTION_CANCELLATION_ACK_TIMEOUT_MS = 10_000;

const PROCESS_CANCELLATION_RESULT_KEYS = new Set([
  "status",
  "reason",
  "cancellationRequested",
  "processTerminationObserved",
]);

const INVALID_CONTROL_CANCELLATION_RESULT = Object.freeze({
  status: "blocked" as const,
  reason: "coordinator_task_control_invalid" as const,
});

/**
 * coordinator-task-runtimeで使用するProviderの値契約を定義する。
 *
 * @responsibility ProviderのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Providerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Providerで宣言した値と責務の対応を維持する。
 * @boundary N/A: Providerの宣言は外部境界を開かない。
 * @security ProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Providerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Provider = "codex" | "claude";

/**
 * coordinator-task-runtimeで使用するTask Roleの値契約を定義する。
 *
 * @responsibility Task RoleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape TaskRoleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskRoleで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskRoleの宣言は外部境界を開かない。
 * @security TaskRoleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility TaskRoleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskRole = "executor" | "reviewer";

/**
 * Task受付で独立捕捉した要求だけを内部Stageへ渡す。
 * @responsibility 受付の成功型を再利用し、選定組をunknownへ戻さない。
 * @trace ARCH-000004
 * @shape 既存受付のaccepted返却値から推論する。
 * @boundary Task受付と内部Stage。
 * @security 型指定で外部入力の検査を代替しない。
 */
type AcceptedTaskRequest = Extract<
  NonNullable<ReturnType<typeof snapshotCoordinatorTaskRequest>>,
  { status: "accepted" }
>["request"] &
  Readonly<{ taskExecutionSelections: TaskExecutionSelections }>;

/**
 * coordinator-task-runtimeで使用するInternal Task Outcomeの値契約を定義する。
 *
 * @responsibility Internal Task OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape InternalTaskOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InternalTaskOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: InternalTaskOutcomeの宣言は外部境界を開かない。
 * @security InternalTaskOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility InternalTaskOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type InternalTaskOutcome = Readonly<{
  publicResult: RuntimeRecord &
    Readonly<{
      dockerRecoveryId: string | null;
      dockerRecoveryIds: readonly string[];
    }>;
  dockerCleanupEligible: boolean;
}>;

/**
 * coordinator-task-runtimeで使用するTask Completion 記録の値契約を定義する。
 *
 * @responsibility Task Completion 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape TaskCompletionRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskCompletionRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskCompletionRecordの宣言は外部境界を開かない。
 * @security TaskCompletionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility TaskCompletionRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TaskCompletionRecord = RuntimeRecord &
  Readonly<{
    status: string;
    reason: CoordinatorTaskPublicReason;
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
    hostRecoveryId: string | null;
    dockerRecoveryId: string | null;
    dockerRecoveryIds: readonly string[];
    candidateRecoveryId: string | null;
    candidateStoreRecoveryId: string | null;
    candidateRevision:
      | (RuntimeRecord & Readonly<{ changedPaths?: readonly string[] }>)
      | null;
    candidateId: string | null;
    expiresAtMs?: number | null;
    executorProvider: unknown;
    reviewerProvider: unknown;
    canonicalRepositoryChanged: boolean | null;
  }>;

/**
 * coordinator-task-runtimeで使用するControl 記録の値契約を定義する。
 *
 * @responsibility Control 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ControlRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ControlRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: ControlRecordの宣言は外部境界を開かない。
 * @security ControlRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ControlRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ControlRecord = HostCompletionTarget & {
  hostInput?: HostOperationRecording;
  workspaceTarget?: BorrowedExecutionTarget;
  currentProcessControl: object | null;
  cancellationRequested: boolean;
  cancellationReceipt: Promise<RuntimeRecord> | null;
  cancellationSettlement: Promise<"confirmed" | "unknown"> | null;
  cancellationProtocolFailure: boolean;
  cancellationController: AbortController;
  retainOperationRoot: boolean;
  processPoisoned: boolean;
  recoveryCorrelationId: string | null;
  consumer: "coordinator_cli" | "workbench" | "coordinator";
  observeProviderStarted:
    | ((notice: ProcessStartedNotice) => void | Promise<void>)
    | undefined;
  executionMetadata: Readonly<Record<string, string>>;
  executionRecordings: ProviderExecutionRecording[];
};

/**
 * final Projection 失敗を決定する。
 *
 * @responsibility final Projection 失敗の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input result: TaskCompletionRecord、control: ControlRecord
 * @returns finalProjectionFailureの計算結果を返す。
 * @precondition 「result: TaskCompletionRecord、control: ControlRecord」がfinalProjectionFailureの入力契約を満たす。
 * @postcondition finalProjectionFailureの責務を完了した結果だけを返す。
 * @effect N/A: finalProjectionFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: finalProjectionFailureは独自の失敗分岐を所有しない。
 * @invariant finalProjectionFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: finalProjectionFailureはProcess内の同一Subsystemで完結する。
 * @security finalProjectionFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: finalProjectionFailureは共有非同期状態を持たない同期処理である。
 */
function finalProjectionFailure(
  result: TaskCompletionRecord,
  control: ControlRecord,
) {
  const dockerRecoveryIds = Object.freeze([
    ...new Set([
      ...result.dockerRecoveryIds,
      ...controlDockerRecoveryIds(control),
    ]),
  ]);
  return Object.freeze({
    ...result,
    status: "blocked" as const,
    reason: "coordinator_task_final_projection_failed_closed",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: true,
    hostRecoveryId: result.hostRecoveryId ?? control.hostRecoveryId,
    dockerRecoveryId:
      dockerRecoveryIds.length === 1 ? (dockerRecoveryIds[0] ?? null) : null,
    dockerRecoveryIds,
  }) as TaskCompletionRecord;
}

/**
 * Blockedを構築する。
 *
 * @responsibility Blockedの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input reason: string、manualRecoveryRequired、hostRecoveryId: string | null、dockerRecoveryId: string | null、candidateRecoveryId: string | null、isCleanupConfirmedOverride: boolean | null、candidateStoreRecoveryId: string | null、dockerRecoveryIds: readonly string[]
 * @returns blockTaskCompletionの計算結果を返す。
 * @precondition 「reason: string、manualRecoveryRequired、hostRecoveryId: string | null、dockerRecoveryId: string | null、candidateRecoveryId: string | null、isCleanupConfirmedOverride: boolean | null、candidateStoreRecoveryId: string | null、dockerRecoveryIds: readonly string[]」がblockTaskCompletionの入力契約を満たす。
 * @postcondition blockTaskCompletionの責務を完了した結果だけを返す。
 * @effect N/A: blockTaskCompletionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockTaskCompletionは独自の失敗分岐を所有しない。
 * @invariant blockTaskCompletionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockTaskCompletionはProcess内の同一Subsystemで完結する。
 * @security blockTaskCompletionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockTaskCompletionは共有非同期状態を持たない同期処理である。
 */
function blockTaskCompletion(
  reason: CoordinatorTaskPublicReason,
  manualRecoveryRequired = false,
  hostRecoveryId: string | null = null,
  dockerRecoveryId: string | null = null,
  candidateRecoveryId: string | null = null,
  isCleanupConfirmedOverride: boolean | null = null,
  candidateStoreRecoveryId: string | null = null,
  dockerRecoveryIds: readonly string[] = dockerRecoveryId
    ? [dockerRecoveryId]
    : [],
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    cleanupConfirmed:
      isCleanupConfirmedOverride === null
        ? !manualRecoveryRequired
        : isCleanupConfirmedOverride,
    manualRecoveryRequired,
    hostRecoveryId: manualRecoveryRequired ? hostRecoveryId : null,
    dockerRecoveryId: manualRecoveryRequired ? dockerRecoveryId : null,
    dockerRecoveryIds: manualRecoveryRequired
      ? Object.freeze([...new Set(dockerRecoveryIds)])
      : Object.freeze([]),
    candidateRecoveryId: manualRecoveryRequired ? candidateRecoveryId : null,
    candidateStoreRecoveryId: manualRecoveryRequired
      ? candidateStoreRecoveryId
      : null,
    executorProvider: null,
    reviewerProvider: null,
    executorSelectionNotice: null,
    reviewerSelectionNotice: null,
    candidateRevision: null,
    candidateId: null,
    executorResult: null,
    reviewerResult: null,
    canonicalRepositoryChanged: false,
    rawOutputReported: false,
    hostPathReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
  });
}

/**
 * object Capabilityを決定する。
 *
 * @responsibility object Capabilityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns objectCapabilityの計算結果を返す。
 * @precondition 「value: unknown」がobjectCapabilityの入力契約を満たす。
 * @postcondition objectCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: objectCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: objectCapabilityは独自の失敗分岐を所有しない。
 * @invariant objectCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: objectCapabilityはProcess内の同一Subsystemで完結する。
 * @security objectCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: objectCapabilityは共有非同期状態を持たない同期処理である。
 */
function objectCapability(value: unknown) {
  return value && typeof value === "object" ? (value as object) : null;
}

/**
 * string Valueを決定する。
 *
 * @responsibility string Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns nonEmptyStringValueの計算結果を返す。
 * @precondition 「value: unknown」がnonEmptyStringValueの入力契約を満たす。
 * @postcondition nonEmptyStringValueの責務を完了した結果だけを返す。
 * @effect N/A: nonEmptyStringValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nonEmptyStringValueは独自の失敗分岐を所有しない。
 * @invariant nonEmptyStringValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nonEmptyStringValueはProcess内の同一Subsystemで完結する。
 * @security nonEmptyStringValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: nonEmptyStringValueは共有非同期状態を持たない同期処理である。
 */
function nonEmptyStringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Runtime 記録を所有Snapshotへ変換する。
 *
 * @responsibility Runtime 記録の取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns RuntimeRecord | nullを返す。
 * @precondition 「value: unknown」がsnapshotRuntimeRecordの入力契約を満たす。
 * @postcondition snapshotRuntimeRecordの責務を完了した結果だけを返す。
 * @effect N/A: snapshotRuntimeRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotRuntimeRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotRuntimeRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotRuntimeRecordはProcess内の同一Subsystemで完結する。
 * @security snapshotRuntimeRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotRuntimeRecordは共有非同期状態を持たない同期処理である。
 */
function snapshotRuntimeRecord(value: unknown): RuntimeRecord | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      types.isProxy(value)
    )
      return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") return null;
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      )
        return null;
      snapshot[key] = descriptor.value;
    }
    if (
      typeof snapshot.status !== "string" ||
      typeof snapshot.reason !== "string"
    )
      return null;
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

/**
 * Process Cancellation Receiptが完全一致するか判定する。
 *
 * @responsibility Process Cancellation Receiptの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns exactProcessCancellationReceiptの計算結果を返す。
 * @precondition 「value: unknown」がexactProcessCancellationReceiptの入力契約を満たす。
 * @postcondition exactProcessCancellationReceiptの責務を完了した結果だけを返す。
 * @effect N/A: exactProcessCancellationReceiptは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactProcessCancellationReceiptは独自の失敗分岐を所有しない。
 * @invariant exactProcessCancellationReceiptは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactProcessCancellationReceiptはProcess内の同一Subsystemで完結する。
 * @security exactProcessCancellationReceiptはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactProcessCancellationReceiptは共有非同期状態を持たない同期処理である。
 */
function exactProcessCancellationReceipt(value: unknown) {
  const receipt = snapshotPlainRecord(value, PROCESS_CANCELLATION_RESULT_KEYS);
  if (
    receipt?.status !== "requested" ||
    receipt.cancellationRequested !== true ||
    typeof receipt.processTerminationObserved !== "boolean" ||
    (receipt.processTerminationObserved === true &&
      receipt.reason !== "provider_cancellation_requested") ||
    (receipt.processTerminationObserved === false &&
      receipt.reason !== "provider_cancellation_grace_exceeded")
  )
    return null;
  return Object.freeze({ ...receipt });
}

/**
 * Control Cancellationを要求する。
 *
 * @responsibility Control Cancellationの要求条件、受理結果、Effect未成立との分離境界を所有する。
 * @trace ARCH-000004
 * @input control: ControlRecord
 * @returns requestControlCancellationの計算結果を返す。
 * @precondition 「control: ControlRecord」がrequestControlCancellationの入力契約を満たす。
 * @postcondition requestControlCancellationの責務を完了した結果だけを返す。
 * @effect 取消通知を発行し、実行ハンドルがあれば下位への取消を一度だけ要求する。
 * @failure requestControlCancellationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 同じ操作の取消要求は同じ応答を共有し、実行本体の完了観測とは区別する。
 * @boundary N/A: requestControlCancellationはProcess内の同一Subsystemで完結する。
 * @security requestControlCancellationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency requestControlCancellationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function requestControlCancellation(control: ControlRecord) {
  if (control.cancellationReceipt) return control.cancellationReceipt;
  control.cancellationRequested = true;
  const boundProcessControl = control.currentProcessControl;
  // 起動中の同期通知から取り消されても、起動が返したハンドルを観測する。
  const receipt = Promise.resolve().then(async () => {
    const processControl = boundProcessControl ?? control.currentProcessControl;
    if (!processControl)
      return Object.freeze({
        status: "requested" as const,
        reason: "provider_cancellation_requested",
        cancellationRequested: true,
        processTerminationObserved: true,
      });
    const observed = await cancelExecutorAttempt(
      processControl,
      control.managementCapability,
    );
    const receipt = exactProcessCancellationReceipt(observed);
    if (!receipt)
      throw new Error("coordinator_task_cancellation_receipt_invalid");
    return receipt;
  });
  control.cancellationReceipt = receipt;
  const timeoutMs = PRODUCTION_CANCELLATION_ACK_TIMEOUT_MS;
  control.cancellationSettlement = new Promise<"confirmed" | "unknown">(
    (resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const settle = (outcome: "confirmed" | "unknown") => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        if (outcome === "unknown") {
          control.cancellationProtocolFailure = true;
          try {
            poisonExecutionProcess(control);
          } catch {
            control.processPoisoned = true;
          }
        }
        resolve(outcome);
      };
      timeout = setTimeout(() => settle("unknown"), timeoutMs);
      try {
        Promise.prototype.then.call(
          receipt,
          () => settle("confirmed"),
          () => settle("unknown"),
        );
      } catch {
        settle("unknown");
      }
    },
  );
  control.cancellationController.abort();
  return receipt;
}

/**
 * control Docker 回復 Idsを決定する。
 *
 * @responsibility control Docker 回復 Idsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input control: ControlRecord
 * @returns controlDockerRecoveryIdsの計算結果を返す。
 * @precondition 「control: ControlRecord」がcontrolDockerRecoveryIdsの入力契約を満たす。
 * @postcondition controlDockerRecoveryIdsの責務を完了した結果だけを返す。
 * @effect N/A: controlDockerRecoveryIdsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: controlDockerRecoveryIdsは独自の失敗分岐を所有しない。
 * @invariant controlDockerRecoveryIdsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: controlDockerRecoveryIdsはProcess内の同一Subsystemで完結する。
 * @security controlDockerRecoveryIdsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: controlDockerRecoveryIdsは共有非同期状態を持たない同期処理である。
 */
function controlDockerRecoveryIds(control: ControlRecord) {
  return Object.freeze([
    ...new Set(
      control.dockerHandoffs
        .filter((handoff) => handoff.state !== "finalized")
        .map((handoff) => handoff.recoveryId),
    ),
  ]);
}

/**
 * actionable Docker 回復 Idsを決定する。
 *
 * @responsibility actionable Docker 回復 Idsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input control: ControlRecord、preferredRecoveryIds: readonly string[]
 * @returns actionableDockerRecoveryIdsの計算結果を返す。
 * @precondition 「control: ControlRecord、preferredRecoveryIds: readonly string[]」がactionableDockerRecoveryIdsの入力契約を満たす。
 * @postcondition actionableDockerRecoveryIdsの責務を完了した結果だけを返す。
 * @effect N/A: actionableDockerRecoveryIdsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: actionableDockerRecoveryIdsは独自の失敗分岐を所有しない。
 * @invariant actionableDockerRecoveryIdsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: actionableDockerRecoveryIdsはProcess内の同一Subsystemで完結する。
 * @security actionableDockerRecoveryIdsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: actionableDockerRecoveryIdsは共有非同期状態を持たない同期処理である。
 */
function actionableDockerRecoveryIds(
  control: ControlRecord,
  preferredRecoveryIds: readonly string[] = [],
) {
  return Object.freeze([
    ...new Set([...preferredRecoveryIds, ...controlDockerRecoveryIds(control)]),
  ]);
}

/**
 * can Run Managed Docker 清掃を決定する。
 *
 * @responsibility can Run Managed Docker 清掃の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input singular: 取得した単一回復参照またはnull。plural: 捕捉済み回復参照列。control: 同じTaskの制御。
 * @returns canRunManagedDockerCleanupの計算結果を返す。
 * @precondition 参照の形式と重複を検査済みであり、単一参照と参照列の一致はここで検査する。
 * @postcondition canRunManagedDockerCleanupの責務を完了した結果だけを返す。
 * @effect N/A: canRunManagedDockerCleanupは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure canRunManagedDockerCleanupは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant canRunManagedDockerCleanupは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canRunManagedDockerCleanupはProcess内の同一Subsystemで完結する。
 * @security canRunManagedDockerCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canRunManagedDockerCleanupは共有非同期状態を持たない同期処理である。
 */
function canRunManagedDockerCleanup(
  singular: string | null,
  plural: readonly unknown[],
  control: ControlRecord,
) {
  try {
    const handoffs = Object.freeze(
      control.dockerHandoffs.map((handoff) =>
        Object.freeze({
          state: handoff.state,
          recoveryId: handoff.recoveryId,
          capability: handoff.capability,
        }),
      ),
    );
    const finalizations = Object.freeze(
      control.dockerHandoffs
        .filter((handoff) => handoff.dockerCompletion !== undefined)
        .map((finalization) =>
          Object.freeze({
            recoveryId: finalization.recoveryId,
            capability: finalization.capability,
          }),
        ),
    );
    // 次Stage開始前の内部停止は空DTOを返す。元handoffの保存待ちを消さず、
    // 公開用の参照結合と同じ集合を内部照合にも使う。不正値・foreignは補完しない。
    const completeManagedSet =
      singular === null &&
      plural.length === 0 &&
      handoffs.length > 0 &&
      control.dockerHandoffs.every(
        (handoff) =>
          handoff.state === "finalizable" &&
          handoff.dockerCompletion !== undefined,
      );
    return evaluateManagedDockerCleanupEligibility({
      raw: Object.freeze({
        singularPresent: true,
        singular: completeManagedSet
          ? handoffs.length === 1
            ? (handoffs[0]?.recoveryId ?? null)
            : null
          : singular,
        pluralPresent: true,
        plural: completeManagedSet
          ? handoffs.map((handoff) => handoff.recoveryId)
          : plural,
      }),
      handoffs,
      finalizations,
    }).eligible;
  } catch {
    return false;
  }
}

/**
 * poison Runtime Processを決定する。
 *
 * @responsibility poison Runtime Processの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input control: ControlRecord
 * @returns N/A: poisonExecutionProcessは戻り値を返さない。
 * @precondition 「control: ControlRecord」がpoisonExecutionProcessの入力契約を満たす。
 * @postcondition poisonExecutionProcessの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: poisonExecutionProcessは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: poisonExecutionProcessは独自の失敗分岐を所有しない。
 * @invariant poisonExecutionProcessは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: poisonExecutionProcessはProcess内の同一Subsystemで完結する。
 * @security poisonExecutionProcessはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: poisonExecutionProcessは共有非同期状態を持たない同期処理である。
 */
function poisonExecutionProcess(control: ControlRecord) {
  control.processPoisoned = true;
  poisonExecutionProcessAfterCleanupUnknown();
}

/**
 * Current Docker 回復を公開結果へ投影する。
 *
 * @responsibility Current Docker 回復の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input result: T、control: ControlRecord
 * @returns projectCurrentDockerRecoveryの計算結果を返す。
 * @precondition 「result: T、control: ControlRecord」がprojectCurrentDockerRecoveryの入力契約を満たす。
 * @postcondition projectCurrentDockerRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: projectCurrentDockerRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectCurrentDockerRecoveryは独自の失敗分岐を所有しない。
 * @invariant projectCurrentDockerRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectCurrentDockerRecoveryはProcess内の同一Subsystemで完結する。
 * @security projectCurrentDockerRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectCurrentDockerRecoveryは共有非同期状態を持たない同期処理である。
 */
function projectCurrentDockerRecovery<T extends RuntimeRecord>(
  result: T,
  control: ControlRecord,
) {
  const finalizedDockerRecoveryIds = new Set(
    control.dockerHandoffs
      .filter((handoff) => handoff.state === "finalized")
      .map((handoff) => handoff.recoveryId),
  );
  const hasExplicitNonDockerRecovery = Boolean(
    nonEmptyStringValue(result.hostRecoveryId) ||
      nonEmptyStringValue(result.candidateRecoveryId) ||
      nonEmptyStringValue(result.candidateStoreRecoveryId),
  );
  const rawDockerRecoveryIds = Array.isArray(result.dockerRecoveryIds)
    ? result.dockerRecoveryIds.filter(
        (value: unknown): value is string => typeof value === "string",
      )
    : [];
  const dockerRecoveryIds = Object.freeze([
    ...new Set(
      [
        ...rawDockerRecoveryIds,
        ...(nonEmptyStringValue(result.dockerRecoveryId)
          ? [String(result.dockerRecoveryId)]
          : []),
        ...controlDockerRecoveryIds(control),
      ].filter((value) => !finalizedDockerRecoveryIds.has(value)),
    ),
  ]);
  const hasRecoveryWithoutIdentifier =
    result.manualRecoveryRequired === true &&
    !hasExplicitNonDockerRecovery &&
    rawDockerRecoveryIds.length === 0 &&
    !nonEmptyStringValue(result.dockerRecoveryId);
  const manualRecoveryRequired =
    hasExplicitNonDockerRecovery ||
    dockerRecoveryIds.length > 0 ||
    hasRecoveryWithoutIdentifier;
  return Object.freeze({
    ...result,
    manualRecoveryRequired,
    cleanupConfirmed:
      manualRecoveryRequired === false
        ? true
        : result.cleanupConfirmed === true,
    dockerRecoveryId:
      dockerRecoveryIds.length === 1 ? dockerRecoveryIds[0] : null,
    dockerRecoveryIds,
  });
}

/**
 * packet Requestを決定する。
 *
 * @responsibility packet Requestの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input request: RuntimeRecord、reviewerReadProjection: RuntimeRecord | null
 * @returns packetRequestの計算結果を返す。
 * @precondition 「request: RuntimeRecord、reviewerReadProjection: RuntimeRecord | null」がpacketRequestの入力契約を満たす。
 * @postcondition packetRequestの責務を完了した結果だけを返す。
 * @effect N/A: packetRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: packetRequestは独自の失敗分岐を所有しない。
 * @invariant packetRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: packetRequestはProcess内の同一Subsystemで完結する。
 * @security packetRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: packetRequestは共有非同期状態を持たない同期処理である。
 */
function packetRequest(
  request: RuntimeRecord,
  reviewerReadProjection: RuntimeRecord | null,
) {
  return Object.freeze({
    objective: request.objective,
    acceptanceCriteria: request.acceptanceCriteria,
    allowedPaths: request.allowedPaths,
    readPaths: request.readPaths,
    reviewerReadProjection,
  });
}

/**
 * external Send Scope Requestを決定する。
 *
 * @responsibility external Send Scope Requestの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input request: RuntimeRecord
 * @returns externalSendScopeRequestの計算結果を返す。
 * @precondition 「request: RuntimeRecord」がexternalSendScopeRequestの入力契約を満たす。
 * @postcondition externalSendScopeRequestの責務を完了した結果だけを返す。
 * @effect N/A: externalSendScopeRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: externalSendScopeRequestは独自の失敗分岐を所有しない。
 * @invariant externalSendScopeRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: externalSendScopeRequestはProcess内の同一Subsystemで完結する。
 * @security externalSendScopeRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: externalSendScopeRequestは共有非同期状態を持たない同期処理である。
 */

/**
 * Provider Preparation 失敗を公開結果へ投影する。
 *
 * @responsibility Provider Preparation 失敗の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input reason: unknown
 * @returns projectProviderPreparationFailureの計算結果を返す。
 * @precondition 「reason: unknown」がprojectProviderPreparationFailureの入力契約を満たす。
 * @postcondition projectProviderPreparationFailureの責務を完了した結果だけを返す。
 * @effect N/A: projectProviderPreparationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectProviderPreparationFailureは独自の失敗分岐を所有しない。
 * @invariant projectProviderPreparationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectProviderPreparationFailureはProcess内の同一Subsystemで完結する。
 * @security projectProviderPreparationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectProviderPreparationFailureは共有非同期状態を持たない同期処理である。
 */
function projectProviderPreparationFailure(reason: unknown) {
  if (typeof reason !== "string")
    return COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS.prepareFailed;
  if (reason.endsWith("_docker_runtime_model_selection_invalid"))
    return COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS.modelSelectionInvalid;
  if (reason.endsWith("_docker_runtime_task_packet_invalid"))
    return COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS.taskPacketInvalid;
  if (reason.endsWith("_docker_runtime_plan_invalid"))
    return COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS.planInvalid;
  if (reason.endsWith("_docker_runtime_recovery_correlation_invalid"))
    return COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS.recoveryCorrelationInvalid;
  return COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS.prepareFailed;
}

/** 正規化済みの各段階を件数・分類だけで通知する。
 * @responsibility 通知失敗を実行結果・Authority・cleanupへ伝播させない。
 * @trace ERB-IT-021
 */
function reportTaskStage(
  operation: Operation,
  correlationId: string | null,
  provider: unknown,
  attempt: 0 | 1,
  result: RuntimeRecord,
  taskRole: TaskRole = "reviewer",
  executionObservation: CompletionResult<"attempt">["providerExecutionObservation"] = null,
) {
  try {
    if (provider !== "codex" && provider !== "claude") return;
    const categories = [
      "acceptance_criterion_not_met",
      "implementation_defect",
      "verification_defect",
      "security_or_authority_defect",
    ];
    const review =
      taskRole === "reviewer" ? projectReviewerResultDiagnostics(result) : null;
    const diagnostic = createTaskStageDiagnostic(
      taskRole === "reviewer"
        ? {
            taskRole: "reviewer",
            decision: review?.decision,
            findingCount: review?.findingCount,
            categoryCounts: categories.map(
              (category) =>
                review?.findingDiagnostics.filter(
                  (finding) => finding?.category === category,
                ).length ?? 0,
            ),
          }
        : {
            taskRole: "executor",
            result: {
              captureStatus: "unavailable",
              pathsMatch: null,
              candidatePathCount: null,
              reportedPathCount: Array.isArray(result.changedPaths)
                ? result.changedPaths.length
                : null,
              providerExecutionObservation: executionObservation,
            },
          },
    );
    if (!diagnostic) return;
    reportTaskDiagnostic(
      Object.freeze({
        event: "coordinator_task_stage_observed",
        provider,
        taskRole: diagnostic.taskRole,
        operationId: operation.operationId,
        taskAttempt: attempt,
        recoveryCorrelationId: correlationId,
        diagnostic,
      }),
    );
  } catch {
    // 受動診断は元の結果・取消・回収へ影響しない。
  }
}

/**
 * Taskの一段を実行する。
 *
 * @responsibility Task一段の実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input operation: Operation、request: AcceptedTaskRequest、repositoryBindingCapability: object、externalSendPolicyCapability: object、role: TaskRole、taskAttempt: 0 | 1、expectedProvider: Provider、remediationCapability: object | null、control: ControlRecord、reviewerReadProjection: RuntimeRecord | null
 * @returns executeStageの計算結果を返す。
 * @precondition 「operation: Operation、request: AcceptedTaskRequest、repositoryBindingCapability: object、externalSendPolicyCapability: object、role: TaskRole、taskAttempt: 0 | 1、expectedProvider: Provider、remediationCapability: object | null、control: ControlRecord、reviewerReadProjection: RuntimeRecord | null」がexecuteStageの入力契約を満たす。
 * @postcondition executeStageの責務を完了した結果だけを返す。
 * @effect executeStageは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure executeStageは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executeStageは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security executeStageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency executeStageは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function executeStage(
  operation: Operation,
  request: AcceptedTaskRequest,
  repositoryBindingCapability: object,
  externalSendPolicyCapability: object,
  role: TaskRole,
  taskAttempt: 0 | 1,
  expectedProvider: Provider,
  remediationCapability: object | null,
  control: ControlRecord,
  reviewerReadProjection: RuntimeRecord | null = null,
) {
  if (control.cancellationRequested) {
    return blockTaskCompletion("coordinator_task_cancelled_before_stage_start");
  }
  // 受付で独立捕捉・凍結した選定を使う。外部preflight／準備結果との照合は各境界に残す。
  const { executor, reviewer } = request.taskExecutionSelections;
  const executionSelection = role === "executor" ? executor : reviewer;
  const provider = executionSelection.provider;
  let startedProcessControl: object | null = null;
  let startedDockerRecoveryId: string | null = null;
  let taskControl: object | null = null;
  const revokeUnconsumed = (reason: CoordinatorTaskPublicReason) => {
    let revocationConfirmed = true;
    const task = taskControl;
    taskControl = null;
    if (task) {
      try {
        if (
          revokeProviderTaskPacket(task, operation.managementCapability)
            .status !== "revoked"
        )
          revocationConfirmed = false;
      } catch {
        revocationConfirmed = false;
      }
    }
    if (!revocationConfirmed) {
      try {
        poisonExecutionProcess(control);
      } catch {
        // controlは通知前にpoison済み。通知例外で一次理由・元回復参照を失わせない。
      }
    }
    return blockTaskCompletion(
      reason,
      !revocationConfirmed,
      revocationConfirmed ? null : operation.hostRecoveryId,
      null,
      null,
      revocationConfirmed,
    );
  };
  try {
    if (provider !== expectedProvider) {
      return revokeUnconsumed("coordinator_task_selection_slate_mismatch");
    }
    const preflight = preflightDelegationSelections(
      operation.managementCapability,
      Object.freeze({
        operationId: operation.operationId,
        executionSelections: Object.freeze([executionSelection]),
      }),
    );
    if (preflight.status !== "matched")
      return blockTaskCompletion("coordinator_task_selection_failed");
    const observation = inspectWindowsProviderHomeCandidate(provider);
    const providerHome = observation.providerHome;
    if (
      observation.status !== "candidate" ||
      !providerHome ||
      typeof providerHome !== "object"
    )
      return revokeUnconsumed(
        "coordinator_task_provider_home_observation_failed",
      );
    const selectionNotice = [
      executionSelection.provider,
      executionSelection.modelIdentifier,
      executionSelection.reasoningEffort,
      executionSelection.role,
      executionSelection.source,
    ].join(" / ");
    try {
      const pending = reportSelectionNotice(
        Object.freeze({
          event: "coordinator_selection_before_provider_effect",
          taskRole: role,
          provider,
          model: executionSelection.modelIdentifier,
          effort: executionSelection.reasoningEffort,
          speedMode: "normal",
          selectionReason: selectionNotice,
          inputBasis:
            "caller_declared_task_attributes_plus_provider_preselection_candidate_with_deferred_provider_preflight",
          callerDeclaredAttributes: Object.freeze([
            "workClass",
            "planState",
            "risk",
            "difficulty",
            "decisionImpact",
          ]),
          highCostSelectionAllowed: false,
        }),
      );
      if (pending) void pending.catch(() => {});
    } catch {
      // 任意の選定表示は実行許可ではない。
    }
    const packet: RuntimeRecord | null = issueProviderTaskPacket(
      operation.managementCapability,
      repositoryBindingCapability,
      provider,
      role,
      taskAttempt,
      externalSendPolicyCapability,
      remediationCapability,
      executionSelection,
      packetRequest(
        request,
        role === "reviewer" ? reviewerReadProjection : null,
      ),
    );
    taskControl = objectCapability(packet?.controlCapability);
    const taskUse = objectCapability(packet?.useCapability);
    if (
      packet?.status === "blocked" &&
      packet.reason === "provider_task_packet_recognized_secret_rejected"
    ) {
      return revokeUnconsumed(
        "coordinator_task_remediation_recognized_secret_rejected",
      );
    }
    if (
      packet?.status !== "issued" ||
      !taskControl ||
      !taskUse ||
      typeof packet.taskPacketRef !== "string"
    ) {
      return revokeUnconsumed("coordinator_task_packet_issue_failed");
    }
    if (control.cancellationRequested) {
      return revokeUnconsumed("coordinator_task_cancelled_before_stage_start");
    }
    const process = startDockerProcessController(
      provider,
      {
        purpose: "task",
        managementCapability: operation.managementCapability,
        mountCapability: operation.mountCapability,
        providerHome: providerHome as PreparationInput["providerHome"],
        taskAttempt,
        packetCapability: taskUse,
        packetRef: packet.taskPacketRef,
        recoveryCorrelationId: control.recoveryCorrelationId,
        consumer: control.consumer,
      },
      (capability, recoveryId) =>
        registerDockerHandoff(control, capability, recoveryId),
      control.observeProviderStarted,
      control.executionMetadata,
      control.executionRecordings,
    );
    taskControl = null;
    if (process.preparationFailed === true)
      return blockTaskCompletion(
        process.reason === "claude_task_workload_split_required"
          ? "coordinator_task_workload_split_required"
          : projectProviderPreparationFailure(process.reason),
      );
    const processControl = objectCapability(process.controlCapability);
    const completion = process.completion;
    if (
      process.status !== "started" ||
      !processControl ||
      !(completion instanceof Promise)
    ) {
      const dockerRecoveryId = resolveRecoveryReference(process.recoveryId);
      const cleanupConfirmed =
        "cleanupConfirmed" in process && process.cleanupConfirmed === true;
      const manualRecoveryRequired =
        !cleanupConfirmed ||
        ("manualRecoveryRequired" in process &&
          process.manualRecoveryRequired === true) ||
        dockerRecoveryId !== null;
      return blockTaskCompletion(
        projectCoordinatorTaskPublicReason(
          process.reason,
          "coordinator_task_process_start_failed",
        ),
        manualRecoveryRequired,
        manualRecoveryRequired ? operation.hostRecoveryId : null,
        dockerRecoveryId,
        null,
        cleanupConfirmed,
      );
    }
    control.currentProcessControl = processControl;
    startedProcessControl = processControl;
    startedDockerRecoveryId = resolveRecoveryReference(process.recoveryId);
    const result = await completion;
    control.currentProcessControl = null;
    startedProcessControl = null;
    if (!result) {
      return blockTaskCompletion(
        "coordinator_task_process_completion_contract_invalid",
        true,
        operation.hostRecoveryId,
        startedDockerRecoveryId,
      );
    }
    const handoff =
      result.cleanupConfirmed === true
        ? matchDockerHandoff(
            control,
            startedDockerRecoveryId,
            result.recoveryFinalizationCapability,
          )
        : "not_tracked";
    if (handoff === "mismatch") {
      return blockTaskCompletion(
        "coordinator_task_docker_finalization_capability_missing",
        true,
        operation.hostRecoveryId,
        startedDockerRecoveryId,
      );
    }
    if (handoff !== "not_tracked")
      recordDockerHandoffCompletion(handoff, result);
    if (control.cancellationRequested) {
      const dockerRecoveryIds = controlDockerRecoveryIds(control);
      return Object.freeze({
        ...blockTaskCompletion(
          "coordinator_task_cancelled_after_provider_cleanup",
        ),
        dockerRecoveryId:
          dockerRecoveryIds.length === 1
            ? (dockerRecoveryIds[0] ?? null)
            : null,
        dockerRecoveryIds,
      });
    }
    if (result.status !== "completed" || result.cleanupConfirmed !== true) {
      const dockerRecoveryId = resolveRecoveryReference(result.recoveryId);
      const manualRecoveryRequired =
        result.cleanupConfirmed !== true ||
        result.manualRecoveryRequired === true ||
        dockerRecoveryId !== null;
      const dockerRecoveryIds = controlDockerRecoveryIds(control);
      return Object.freeze({
        ...blockTaskCompletion(
          projectCoordinatorTaskPublicReason(
            result.reason,
            "coordinator_task_provider_failed",
          ),
          manualRecoveryRequired,
          manualRecoveryRequired ? operation.hostRecoveryId : null,
          dockerRecoveryId,
          null,
          result.cleanupConfirmed === true,
        ),
        dockerRecoveryId:
          manualRecoveryRequired && dockerRecoveryId
            ? dockerRecoveryId
            : dockerRecoveryIds.length === 1
              ? (dockerRecoveryIds[0] ?? null)
              : null,
        dockerRecoveryIds: manualRecoveryRequired
          ? Object.freeze([
              ...new Set([
                ...(dockerRecoveryId ? [dockerRecoveryId] : []),
                ...dockerRecoveryIds,
              ]),
            ])
          : dockerRecoveryIds,
      });
    }
    let reviewRemediation: object | null = null;
    if (
      role === "reviewer" &&
      taskAttempt === 0 &&
      handoff !== "not_tracked" &&
      !result.cancellationRequested
    ) {
      try {
        reviewRemediation =
          registerReviewFindings(handoff.capability, result) ?? null;
      } catch {}
    }
    return Object.freeze({
      status: "completed" as const,
      provider,
      selectionNotice,
      normalizedResult: result.normalizedResult,
      providerExecutionObservation: result.providerExecutionObservation ?? null,
      remediationCapability: reviewRemediation,
      providerTurnObservation: projectProviderTurnObservation(
        result.providerTurnObservation,
      ),
    });
  } catch {
    if (startedProcessControl) {
      if (!control.cancellationRequested) {
        try {
          await cancelExecutorAttempt(
            startedProcessControl,
            operation.managementCapability,
          );
        } catch {
          // The process state is already unknowable. The result below retains the
          // operation root and requires explicit recovery regardless.
        }
      }
      control.currentProcessControl = null;
      return blockTaskCompletion(
        "coordinator_task_process_completion_unconfirmed",
        true,
        operation.hostRecoveryId,
        startedDockerRecoveryId,
      );
    }
    return revokeUnconsumed("coordinator_task_stage_failed_closed");
  }
}

/**
 * Coordinator Task Coreを実行する。
 *
 * @responsibility Coordinator Task Coreの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、repositoryRoot: unknown、control: ControlRecord
 * @returns runCoordinatorTaskCoreの計算結果を返す。
 * @precondition 「rawRequest: unknown、repositoryRoot: unknown、control: ControlRecord」がrunCoordinatorTaskCoreの入力契約を満たす。
 * @postcondition runCoordinatorTaskCoreの責務を完了した結果だけを返す。
 * @effect N/A: runCoordinatorTaskCoreは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runCoordinatorTaskCoreは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runCoordinatorTaskCoreは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runCoordinatorTaskCoreはProcess内の同一Subsystemで完結する。
 * @security runCoordinatorTaskCoreはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runCoordinatorTaskCoreは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function runCoordinatorTaskCore(
  rawRequest: unknown,
  repositoryRoot: unknown,
  control: ControlRecord,
  selections: TaskExecutionSelections | undefined,
) {
  const blocked = (...args: Parameters<typeof blockTaskCompletion>) => {
    const source = blockTaskCompletion(...args);
    const dockerRecoveryIds = [
      ...new Set([
        ...source.dockerRecoveryIds,
        ...controlDockerRecoveryIds(control),
      ]),
    ];
    const manualRecoveryRequired =
      source.manualRecoveryRequired === true || dockerRecoveryIds.length > 0;
    return blockTaskCompletion(
      projectCoordinatorTaskPublicReason(
        source.reason,
        "coordinator_task_failed_closed",
      ),
      manualRecoveryRequired,
      nonEmptyStringValue(source.hostRecoveryId),
      dockerRecoveryIds.length === 1 ? (dockerRecoveryIds[0] ?? null) : null,
      nonEmptyStringValue(source.candidateRecoveryId),
      dockerRecoveryIds.length > 0 ? false : source.cleanupConfirmed === true,
      nonEmptyStringValue(source.candidateStoreRecoveryId),
      dockerRecoveryIds,
    );
  };
  const requestOutcome = snapshotCoordinatorTaskRequest(rawRequest);
  if (
    !requestOutcome ||
    !selections ||
    typeof repositoryRoot !== "string" ||
    !repositoryRoot
  ) {
    return blocked("coordinator_task_request_invalid");
  }
  if (requestOutcome.status === "blocked") {
    return blocked(requestOutcome.reason);
  }
  const request = Object.freeze({
    ...requestOutcome.request,
    taskExecutionSelections: selections,
  });
  const repositoryPreflight =
    inspectRepositoryObjectFormatCandidate(repositoryRoot);
  if (repositoryPreflight?.status !== "candidate") {
    return blocked("coordinator_task_repository_preflight_failed");
  }
  if (repositoryPreflight.runtimeSupported !== true) {
    return blocked("coordinator_task_git_object_format_unsupported");
  }
  let dockerRecoveryState: unknown;
  try {
    dockerRecoveryState = inspectDockerTaskAdmission(repositoryRoot);
  } catch {
    dockerRecoveryState = null;
  }
  const admission = projectCurrentDockerAdmission(dockerRecoveryState);
  if (admission.status !== "completed") {
    return blocked(
      projectCoordinatorTaskPublicReason(
        admission.reason,
        "docker_process_controller_recovery_unavailable",
      ),
      true,
      null,
      null,
      null,
      false,
      null,
      Object.freeze([]),
    );
  }
  let operation: Operation | null = null;
  let shouldRetainOperationRoot = false;
  try {
    operation = await openTaskOperation(
      control.cancellationController.signal,
      () => {
        if (control.cancellationRequested || isExecutionProcessPoisoned())
          return false;
        const current = inspectRepositoryObjectFormatCandidate(repositoryRoot);
        return (
          current?.status === "candidate" && current.runtimeSupported === true
        );
      },
      control.hostInput,
    );
    control.ownedOperation = operation.owned;
    control.managementCapability = operation.managementCapability;
    control.hostRecoveryId = operation.hostRecoveryId;
    if (control.cancellationRequested) {
      return blocked("coordinator_task_cancelled_during_operation_creation");
    }
    const repository = bindRepositoryOperation(
      operation.managementCapability,
      repositoryRoot,
    );
    const repositoryBinding = objectCapability(
      repository?.repositoryBindingCapability,
    );
    if (repository?.repositoryBound !== true || !repositoryBinding) {
      return blocked("coordinator_task_repository_binding_failed");
    }
    const externalSendPolicy = resolveExternalSendPolicy(
      operation.managementCapability,
      repositoryBinding,
    );
    const externalSendPolicyCapability = objectCapability(
      externalSendPolicy?.capability,
    );
    if (
      externalSendPolicy?.status !== "resolved" ||
      !externalSendPolicyCapability
    ) {
      return blocked("coordinator_task_external_send_policy_unresolved");
    }
    const fixedSelections = request.taskExecutionSelections;
    if (!fixedSelections)
      return blocked("coordinator_task_execution_slate_unavailable");
    const slate = preflightDelegationSelections(
      operation.managementCapability,
      Object.freeze({
        operationId: operation.operationId,
        executionSelections: Object.freeze([
          fixedSelections.executor,
          fixedSelections.reviewer,
        ]),
      }),
    );
    const slateExecutorProvider = fixedSelections.executor.provider;
    const slateReviewerProvider = fixedSelections.reviewer.provider;
    const reviewerIndependence =
      slateExecutorProvider === slateReviewerProvider
        ? "execution_context_independent"
        : "provider_independent";
    if (slate.status !== "matched") {
      return blocked("coordinator_task_execution_slate_unavailable");
    }
    if (control.cancellationRequested)
      return blocked("coordinator_task_cancelled_before_stage_start");
    const candidateNotIssued = (result: RuntimeRecord) =>
      Object.freeze({
        ...result,
        candidateDisposition: "not_issued" as const,
      });
    const workspace: RuntimeRecord | null = bindExecutionWorkspace(
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
      request.readPaths as readonly string[],
      control.workspaceTarget,
    );
    if (workspace?.status !== "materialized")
      return candidateNotIssued(
        blocked("coordinator_task_workspace_materialization_failed"),
      );
    if (workspace.borrowed !== true)
      return candidateNotIssued(
        blocked("coordinator_task_workspace_borrowing_unavailable"),
      );
    const executor = await executeStage(
      operation,
      request,
      repositoryBinding,
      externalSendPolicyCapability,
      "executor",
      0,
      slateExecutorProvider,
      null,
      control,
    );
    if (executor.status !== "completed") {
      shouldRetainOperationRoot = executor.manualRecoveryRequired === true;
      return candidateNotIssued(executor);
    }
    if (control.cancellationRequested) {
      return candidateNotIssued(
        blocked("coordinator_task_cancelled_before_independent_review"),
      );
    }
    let finalExecutor = executor;
    let executorResult = executor.normalizedResult as RuntimeRecord;
    const providerTurnObservations: Readonly<Record<string, unknown>>[] = [];
    const retainTurnObservation = (
      stage: Readonly<Record<string, unknown>>,
      attempt: number,
    ) => {
      const observation = projectProviderTurnObservation(
        stage.providerTurnObservation,
      );
      if (observation)
        providerTurnObservations.push(
          Object.freeze({ ...observation, attempt }),
        );
    };
    retainTurnObservation(executor, 0);
    reportTaskStage(
      operation,
      control.recoveryCorrelationId,
      executor.provider,
      0,
      executorResult,
      "executor",
      executor.providerExecutionObservation,
    );
    if (control.cancellationRequested)
      return candidateNotIssued(
        blocked("coordinator_task_cancelled_before_independent_review"),
      );
    const reviewerReadProjection = prepareReviewerWorkspace(
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
    );
    if (reviewerReadProjection?.status !== "projected") {
      return candidateNotIssued(
        blocked("coordinator_task_reviewer_read_projection_failed"),
      );
    }
    let reviewer = await executeStage(
      operation,
      request,
      repositoryBinding,
      externalSendPolicyCapability,
      "reviewer",
      0,
      slateReviewerProvider,
      null,
      control,
      reviewerReadProjection,
    );
    if (reviewer.status !== "completed") {
      shouldRetainOperationRoot = reviewer.manualRecoveryRequired === true;
      return candidateNotIssued(reviewer);
    }
    let reviewerResult = reviewer.normalizedResult as RuntimeRecord;
    reportTaskStage(
      operation,
      control.recoveryCorrelationId,
      reviewer.provider,
      0,
      reviewerResult,
    );
    let finalReviewerReadProjection = reviewerReadProjection;
    retainTurnObservation(reviewer, 0);
    let remediationPerformed = false;
    if (
      reviewerResult?.decision === "changes_requested" &&
      reviewerReadProjection.withheldFileCount === 0
    ) {
      const remediationCapability = objectCapability(
        reviewer.remediationCapability,
      );
      if (!remediationCapability || reviewerResult.findingCount === 0) {
        return candidateNotIssued(
          blocked("coordinator_task_review_remediation_invalid"),
        );
      }
      const remediation = await executeStage(
        operation,
        request,
        repositoryBinding,
        externalSendPolicyCapability,
        "executor",
        1,
        executor.provider as Provider,
        remediationCapability,
        control,
      );
      if (remediation.status !== "completed") {
        shouldRetainOperationRoot = remediation.manualRecoveryRequired === true;
        return candidateNotIssued(remediation);
      }
      remediationPerformed = true;
      finalExecutor = remediation;
      executorResult = remediation.normalizedResult as RuntimeRecord;
      retainTurnObservation(remediation, 1);
      reportTaskStage(
        operation,
        control.recoveryCorrelationId,
        remediation.provider,
        1,
        executorResult,
        "executor",
        remediation.providerExecutionObservation,
      );
      if (control.cancellationRequested)
        return candidateNotIssued(
          blocked("coordinator_task_cancelled_before_independent_review"),
        );
      const remediationReviewerReadProjection = prepareReviewerWorkspace(
        repositoryBinding,
        operation.managementCapability,
        operation.mountCapability,
      );
      if (remediationReviewerReadProjection?.status !== "projected") {
        return candidateNotIssued(
          blocked("coordinator_task_reviewer_read_projection_failed"),
        );
      }
      reviewer = await executeStage(
        operation,
        request,
        repositoryBinding,
        externalSendPolicyCapability,
        "reviewer",
        1,
        reviewer.provider as Provider,
        null,
        control,
        remediationReviewerReadProjection,
      );
      if (reviewer.status !== "completed") {
        shouldRetainOperationRoot = reviewer.manualRecoveryRequired === true;
        return candidateNotIssued(reviewer);
      }
      reviewerResult = reviewer.normalizedResult as RuntimeRecord;
      reportTaskStage(
        operation,
        control.recoveryCorrelationId,
        reviewer.provider,
        1,
        reviewerResult,
      );
      finalReviewerReadProjection = remediationReviewerReadProjection;
      retainTurnObservation(reviewer, 1);
    }
    const reviewIncomplete = finalReviewerReadProjection.withheldFileCount > 0;
    if (
      reviewIncomplete ||
      reviewerResult?.decision !== "approved" ||
      reviewerResult.findingCount !== 0
    ) {
      const executorDiagnostics = projectExecutorResultDiagnostics(
        executorResult,
        finalExecutor.providerExecutionObservation,
      );
      const reviewerDiagnostics =
        projectReviewerResultDiagnostics(reviewerResult);
      const reviewerProjectionEvidence = projectReviewerProjectionEvidence(
        finalReviewerReadProjection,
      );
      return Object.freeze({
        ...blocked(
          reviewIncomplete
            ? "coordinator_task_reviewer_coverage_incomplete"
            : "coordinator_task_independent_review_not_approved",
        ),
        candidateDisposition: "not_issued" as const,
        executorProvider: executor.provider,
        reviewerProvider: reviewer.provider,
        reviewerIndependence,
        remediationPerformed,
        executorResult: executorDiagnostics,
        reviewerResult: reviewerDiagnostics,
        reviewerProjectionEvidence,
      });
    }
    return Object.freeze({
      ...blocked("coordinator_task_workspace_review_completed"),
      status: "completed" as const,
      candidateDisposition: "not_issued" as const,
      executorProvider: executor.provider,
      reviewerProvider: reviewer.provider,
      reviewerIndependence,
      remediationPerformed,
      executorSelectionNotice: finalExecutor.selectionNotice,
      reviewerSelectionNotice: reviewer.selectionNotice,
      providerTurnObservations: Object.freeze([...providerTurnObservations]),
      executorResult: projectExecutorResultDiagnostics(
        executorResult,
        finalExecutor.providerExecutionObservation,
      ),
      reviewerResult: projectReviewerResultDiagnostics(reviewerResult),
    });
  } catch (error) {
    const creationFailure = productionOperationFailure(error);
    if (creationFailure) {
      shouldRetainOperationRoot = !creationFailure.cleanupConfirmed;
      return blocked(
        projectCoordinatorTaskPublicReason(
          creationFailure.reason,
          "coordinator_task_operation_creation_failed",
        ),
        creationFailure.manualRecoveryRequired,
        creationFailure.hostRecoveryId,
        null,
        null,
        creationFailure.cleanupConfirmed,
      );
    }
    shouldRetainOperationRoot = true;
    return blocked(
      "coordinator_task_failed_closed",
      true,
      operation?.hostRecoveryId ?? null,
    );
  } finally {
    control.retainOperationRoot = shouldRetainOperationRoot;
  }
}

/**
 * Coordinator Taskを実行する。
 *
 * @responsibility Coordinator Taskの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、repositoryRoot: unknown、control: ControlRecord
 * @returns Promise<InternalTaskOutcome>を返す。
 * @precondition 「rawRequest: unknown、repositoryRoot: unknown、control: ControlRecord」がrunCoordinatorTaskの入力契約を満たす。
 * @postcondition runCoordinatorTaskの責務を完了した結果だけを返す。
 * @effect N/A: runCoordinatorTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runCoordinatorTaskは独自の失敗分岐を所有しない。
 * @invariant runCoordinatorTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runCoordinatorTaskはProcess内の同一Subsystemで完結する。
 * @security runCoordinatorTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runCoordinatorTaskは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function runCoordinatorTask(
  rawRequest: unknown,
  repositoryRoot: unknown,
  control: ControlRecord,
  selections: TaskExecutionSelections | undefined,
): Promise<InternalTaskOutcome> {
  const rawResult = await runCoordinatorTaskCore(
    rawRequest,
    repositoryRoot,
    control,
    selections,
  );
  const snapshot = snapshotRuntimeRecord(rawResult);
  if (!snapshot) {
    const recoveryIds = controlDockerRecoveryIds(control);
    return Object.freeze({
      publicResult: blockTaskCompletion(
        "coordinator_task_result_observation_invalid",
        true,
        control.hostRecoveryId,
        recoveryIds.length === 1 ? (recoveryIds[0] ?? null) : null,
        null,
        false,
        null,
        recoveryIds,
      ),
      dockerCleanupEligible: false,
    });
  }
  const rawSingular = snapshot.dockerRecoveryId;
  const singular = resolveRecoveryReference(rawSingular);
  const plural = snapshotPlainArray(
    snapshot.dockerRecoveryIds,
    Number.MAX_SAFE_INTEGER,
  );
  let isProjectionInvalid = rawSingular !== null && singular === null;
  const observedIds = new Set<string>();
  if (plural.status === "ok") {
    for (const value of plural.value) {
      const id = resolveRecoveryReference(value);
      if (id === null || observedIds.has(id)) isProjectionInvalid = true;
      if (id !== null) observedIds.add(id);
    }
  } else {
    isProjectionInvalid = true;
  }
  if (singular !== null) observedIds.add(singular);
  for (const id of controlDockerRecoveryIds(control)) observedIds.add(id);
  const ids = Object.freeze([...observedIds]);
  const publicResult = isProjectionInvalid
    ? blockTaskCompletion(
        "coordinator_task_docker_recovery_projection_invalid",
        true,
        control.hostRecoveryId,
        ids.length === 1 ? (ids[0] ?? null) : null,
        nonEmptyStringValue(snapshot.candidateRecoveryId),
        false,
        nonEmptyStringValue(snapshot.candidateStoreRecoveryId),
        ids,
      )
    : Object.freeze({
        ...snapshot,
        dockerRecoveryId: ids.length === 1 ? (ids[0] ?? null) : null,
        dockerRecoveryIds: ids,
      });
  return Object.freeze({
    publicResult,
    dockerCleanupEligible:
      !isProjectionInvalid &&
      plural.status === "ok" &&
      canRunManagedDockerCleanup(singular, plural.value, control),
  });
}

const reportProviderBoundaryDiagnostic = createLifecycleNoticeReporter(
  process.stderr,
);
const reportSelectionNotice = createLifecycleNoticeReporter(
  process.stderr,
  "[Coordinator selection]",
);

/** Taskの記録許可を確認してHostを開き、元失敗分類を保持する。 @trace ARCH-000004 */
async function openTaskOperation(
  signal: AbortSignal,
  current: () => boolean,
  hostInput?: HostOperationRecording,
): Promise<Operation> {
  if (!hostInput?.recordingCurrent())
    throw new Error("coordinator_task_operation_owner_required");
  const host = await openExecutionHost(signal, current, {
    root: hostInput.root,
    recordingCurrent: hostInput.recordingCurrent,
    purpose: "task",
  });
  if (host.status === "startup_failed")
    throwProductionOperationFailure(host.failure);
  if (host.status === "creation_failed") {
    const failure = host.failure;
    if (failure === null)
      throw Error("coordinator_task_operation_creation_failed");
    throwProductionOperationFailure({
      ...failure,
      reason: failure.cleanupConfirmed
        ? "coordinator_task_operation_initialization_failed_cleanup_confirmed"
        : "coordinator_task_operation_initialization_cleanup_unknown_process_restart_required",
    });
  }
  return host.operation;
}

/** Taskの結果投影に必要なHost保持状態を更新し、共通の失敗終結へ渡す。 @trace ARCH-000004 */
function retainRuntimeRecoveryState(control: ControlRecord) {
  control.retainOperationRoot = !control.hostCleanupCompleted;
  return retainHostOperation(control);
}

/** 受け付けたTaskを同じ状態へ登録し、元の完了まで調停する。
 * @responsibility 開始・終了・回復保持の操作順を所有する。
 * @trace ARCH-000004
 * @boundary 検証済みの本番または試験内の状態と、単発の技術実行。
 */
function startTask(
  controls: WeakMap<object, ControlRecord>,
  rawRequest: unknown,
  repositoryRoot: unknown,
  recoveryCorrelationId: unknown = null,
  observeProviderStarted?: (
    notice: ProcessStartedNotice,
  ) => void | Promise<void>,
  consumer: "coordinator_cli" | "workbench" | "coordinator" = "coordinator_cli",
  workspaceTarget?: BorrowedExecutionTarget,
  executionMetadata: Readonly<Record<string, string>> = {},
  hostInput?: HostOperationRecording,
  selections?: TaskExecutionSelections,
) {
  if (
    consumer !== "coordinator_cli" &&
    consumer !== "workbench" &&
    consumer !== "coordinator"
  )
    throw new Error("coordinator_task_consumer_invalid");
  if (
    observeProviderStarted !== undefined &&
    typeof observeProviderStarted !== "function"
  )
    throw new Error("coordinator_task_start_observer_invalid");
  if (
    recoveryCorrelationId !== null &&
    (typeof recoveryCorrelationId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(recoveryCorrelationId))
  )
    throw new Error("coordinator_task_recovery_correlation_invalid");
  const controlCapability = Object.freeze({});
  const control: ControlRecord = {
    managementCapability: Object.freeze({}),
    currentProcessControl: null,
    cancellationRequested: false,
    cancellationReceipt: null,
    cancellationSettlement: null,
    cancellationProtocolFailure: false,
    cancellationController: new AbortController(),
    ownedOperation: null,
    retainOperationRoot: false,
    processPoisoned: false,
    hostCleanupCompleted: false,
    hostRecoveryId: null,
    dockerHandoffs: [],
    recoveryCorrelationId,
    consumer,
    observeProviderStarted,
    executionMetadata,
    ...(hostInput ? { hostInput } : {}),
    executionRecordings: [],
    ...(workspaceTarget ? { workspaceTarget } : {}),
  };
  controls.set(controlCapability, control);
  const completion: Promise<TaskCompletionRecord> = runCoordinatorTask(
    rawRequest,
    repositoryRoot,
    control,
    selections,
  )
    .then(async ({ publicResult, dockerCleanupEligible }) => {
      // runCoordinatorTaskが捕捉した値と整形済みの回復参照だけを受け取る。
      let result = publicResult;
      try {
        let isHostProtocolFailure = false;
        control.retainOperationRoot ||= !dockerCleanupEligible;
        if (control.retainOperationRoot)
          await retainRuntimeRecoveryState(control);
        else if (control.ownedOperation || control.dockerHandoffs.length > 0) {
          const settled = await completeHostOperation(control);
          if (control.hostCleanupCompleted)
            result = Object.freeze({ ...result, hostRecoveryId: null });
          if (settled.error !== undefined) throw settled.error;
          if (settled.status !== "completed") {
            await retainRuntimeRecoveryState(control);
            const reason =
              settled.stage === "intent"
                ? "coordinator_task_host_cleanup_intent_unconfirmed"
                : settled.stage === "handoff"
                  ? "coordinator_task_docker_recovery_handoff_state_invalid"
                  : settled.stage === "receipt"
                    ? "coordinator_task_host_cleanup_receipt_unconfirmed"
                    : settled.stage === "finalization"
                      ? "coordinator_task_docker_recovery_finalization_unconfirmed"
                      : "coordinator_task_operation_cleanup_unconfirmed";
            return blockTaskCompletion(
              reason,
              true,
              control.hostRecoveryId,
              settled.recoveryId,
              nonEmptyStringValue(result.candidateRecoveryId),
              false,
              nonEmptyStringValue(result.candidateStoreRecoveryId),
              actionableDockerRecoveryIds(
                control,
                settled.recoveryId ? [settled.recoveryId] : [],
              ),
            );
          }
          isHostProtocolFailure =
            settled.hostCleanup === "protocol_failure_cleanup_confirmed";
        }
        if (isHostProtocolFailure) {
          const candidateRecoveryId = nonEmptyStringValue(
            result.candidateRecoveryId,
          );
          const isCandidateStillRequiresRecovery = Boolean(
            candidateRecoveryId && true,
          );
          const dockerRecoveryIds = controlDockerRecoveryIds(control);
          const hostRecoveryId = control.retainOperationRoot
            ? control.hostRecoveryId
            : null;
          const candidateStoreRecoveryId = nonEmptyStringValue(
            result.candidateStoreRecoveryId,
          );
          const manualRecoveryRequired = Boolean(
            hostRecoveryId ||
              dockerRecoveryIds.length > 0 ||
              isCandidateStillRequiresRecovery ||
              candidateStoreRecoveryId,
          );
          return blockTaskCompletion(
            "coordinator_task_host_generation_protocol_failed_cleanup_confirmed",
            manualRecoveryRequired,
            hostRecoveryId,
            dockerRecoveryIds.length === 1 ? dockerRecoveryIds[0] : null,
            isCandidateStillRequiresRecovery ? candidateRecoveryId : null,
            !manualRecoveryRequired,
            candidateStoreRecoveryId,
            dockerRecoveryIds,
          );
        }
        if (!dockerCleanupEligible) {
          const candidateRecoveryId = nonEmptyStringValue(
            result.candidateRecoveryId,
          );
          return blockTaskCompletion(
            projectCoordinatorTaskPublicReason(
              result.reason,
              "coordinator_task_docker_recovery_projection_invalid",
            ),
            true,
            control.hostRecoveryId,
            publicResult.dockerRecoveryId,
            candidateRecoveryId,
            false,
            nonEmptyStringValue(result.candidateStoreRecoveryId),
            publicResult.dockerRecoveryIds,
          );
        }
        return projectCurrentDockerRecovery(result, control);
      } catch {
        await retainRuntimeRecoveryState(control);
        const candidateRecoveryId = nonEmptyStringValue(
          result.candidateRecoveryId,
        );
        return blockTaskCompletion(
          "coordinator_task_operation_cleanup_unconfirmed",
          true,
          control.hostRecoveryId,
          null,
          candidateRecoveryId,
          null,
          null,
          actionableDockerRecoveryIds(control),
        );
      }
    })
    .catch(async () => {
      try {
        await retainRuntimeRecoveryState(control);
      } catch {
        poisonExecutionProcess(control);
      }
      return blockTaskCompletion(
        "coordinator_task_operation_cleanup_unconfirmed",
        true,
        control.hostRecoveryId,
        null,
        null,
        null,
        null,
        controlDockerRecoveryIds(control),
      );
    })
    .then(async (settledResult): Promise<TaskCompletionRecord> => {
      let result = settledResult as TaskCompletionRecord;
      try {
        if (control.cancellationRequested && control.cancellationSettlement)
          await control.cancellationSettlement;
        control.processPoisoned ||= isExecutionProcessPoisoned();
        if (control.cancellationProtocolFailure) {
          const manualRecoveryRequired = result.manualRecoveryRequired === true;
          result = Object.freeze({
            ...result,
            status: "blocked" as const,
            reason: manualRecoveryRequired
              ? "coordinator_task_cancellation_protocol_failed_cleanup_unknown"
              : "coordinator_task_cancellation_protocol_failed_cleanup_confirmed",
            cleanupConfirmed:
              !manualRecoveryRequired && result.cleanupConfirmed === true,
            manualRecoveryRequired,
            processRestartRequired: true,
          }) as TaskCompletionRecord;
        } else {
          result = Object.freeze({
            ...result,
            processRestartRequired: control.processPoisoned,
          }) as TaskCompletionRecord;
        }
      } catch {
        result = finalProjectionFailure(result, control);
      } finally {
        control.observeProviderStarted = undefined;
        controls.delete(controlCapability);
      }
      return result;
    })
    .then((result): TaskCompletionRecord => {
      if (control.workspaceTarget) {
        const workspaceResult = projectBorrowedExecutionResult(
          control.workspaceTarget,
        );
        result = Object.freeze({
          ...result,
          canonicalRepositoryChanged:
            workspaceResult.canonicalRepositoryChanged,
          workspaceResult,
        });
      }
      finishProviderExecutionRecordings(control.executionRecordings, result);
      return result;
    })
    .catch((error) => {
      for (const recording of control.executionRecordings.splice(0))
        reportExecutionRecordingUnavailable(recording.executionId);
      throw error;
    });
  return Object.freeze({
    status: "started" as const,
    reason: "coordinator_task_started",
    controlCapability,
    completion,
    rawOutputReported: false,
    hostPathReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
  });
}

/** 同じ状態に登録された元Controlだけへ取消を配送する。 @trace ARCH-000004 */
function cancelTask(
  controls: WeakMap<object, ControlRecord>,
  controlCapability: unknown,
) {
  if (!controlCapability || typeof controlCapability !== "object") {
    return Promise.resolve(INVALID_CONTROL_CANCELLATION_RESULT);
  }
  const control = controls.get(controlCapability);
  if (!control) {
    return Promise.resolve(INVALID_CONTROL_CANCELLATION_RESULT);
  }
  return requestControlCancellation(control);
}

const taskControls = new WeakMap<object, ControlRecord>();

/**
 * Runtime 所有 Coordinator Taskを開始する。
 *
 * @responsibility Runtime 所有 Coordinator Taskの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000004
 * @input Task要求、Repository Root、回復相関ID、任意のProvider接続用Host Process開始確認と本番組立ての固定利用側。JSON要求から利用側を取得しない。
 * @returns startCoordinatorTaskの計算結果を返す。
 * @precondition 実行Processの片付けが確定しており、要求・Root・回復相関IDが下位Runtimeの入力契約を満たす。
 * @postcondition startCoordinatorTaskの責務を完了した結果だけを返す。
 * @effect Taskを開始し、下位Runtimeの検査と外部送信許可が成立した場合だけ隔離実行を委譲する。
 * @failure startCoordinatorTaskは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant startCoordinatorTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 通常Task入口からRepository検査、外部送信許可、隔離実行への境界。
 * @security startCoordinatorTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency Process停止条件を開始前に確認し、返したControlと完了Promiseで同じTaskを追跡する。
 */
export function startCoordinatorTask(
  rawRequest: unknown,
  repositoryRoot: unknown,
  recoveryCorrelationId: unknown = null,
  observeProviderStarted?: (
    notice: ProcessStartedNotice,
  ) => void | Promise<void>,
  consumer: "coordinator_cli" | "workbench" | "coordinator" = "coordinator_cli",
  rawWorkspaceTarget?: BorrowedExecutionTarget,
  executionMetadata: Readonly<Record<string, string>> = {},
  hostInput?: HostOperationRecording,
  selections?: TaskExecutionSelections,
) {
  if (isExecutionProcessPoisoned()) {
    throw new Error("coordinator_task_process_restart_required");
  }
  if (
    observeProviderStarted !== undefined &&
    typeof observeProviderStarted !== "function"
  )
    throw new Error("coordinator_task_start_observer_invalid");
  const workspaceTarget =
    rawWorkspaceTarget === undefined
      ? null
      : inspectBorrowedExecutionTarget(repositoryRoot, rawWorkspaceTarget);
  if (workspaceTarget === null)
    throw new Error("coordinator_task_workspace_target_invalid");
  if (
    consumer !== "coordinator_cli" &&
    consumer !== "workbench" &&
    consumer !== "coordinator"
  )
    throw new Error("coordinator_task_consumer_invalid");
  return startTask(
    taskControls,
    rawRequest,
    repositoryRoot,
    recoveryCorrelationId,
    observeProviderStarted,
    consumer,
    workspaceTarget,
    executionMetadata,
    hostInput,
    selections,
  );
}

/**
 * Runtime 所有 Coordinator Taskを取り消す。
 *
 * @responsibility Runtime 所有 Coordinator Taskの取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000004
 * @input controlCapability: unknown
 * @returns cancelCoordinatorTaskの計算結果を返す。
 * @precondition 「controlCapability: unknown」がcancelCoordinatorTaskの入力契約を満たす。
 * @postcondition cancelCoordinatorTaskの責務を完了した結果だけを返す。
 * @effect N/A: cancelCoordinatorTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelCoordinatorTaskは独自の失敗分岐を所有しない。
 * @invariant cancelCoordinatorTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cancelCoordinatorTaskはProcess内の同一Subsystemで完結する。
 * @security cancelCoordinatorTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cancelCoordinatorTaskは共有非同期状態を持たない同期処理である。
 */
export function cancelCoordinatorTask(controlCapability: unknown) {
  return cancelTask(taskControls, controlCapability);
}

/** 同じ試行の診断に相関値を補い、受動出力へ渡す。 @trace ARCH-000008 */
function reportAttemptDiagnostic(
  report: ReturnType<typeof createLifecycleNoticeReporter>,
  plan: PreparedAttemptPlan<Provider>,
  notice:
    | Parameters<NonNullable<ExecutorCallbacks<"attempt">["onDiagnostic"]>>[0]
    | RecoveryStartFailureNotice,
) {
  return report(
    Object.freeze({
      ...notice,
      taskAttempt: plan.taskAttempt,
      recoveryCorrelationId: plan.recoveryCorrelationId,
    }),
  );
}

/** 必須送信記録が成立した試行の任意EI記録を開始する。 @trace ARCH-000008 */
function beginAttemptRecording(
  plan: PreparedAttemptPlan<Provider>,
  management: unknown,
  executionMetadata: Readonly<Record<string, string>>,
): ProviderExecutionRecording | null {
  const source = borrowCoordinatorStateRepository(management);
  const repository = source ? getRepository(source.repositoryRoot) : null;
  if (repository?.status === "completed")
    return beginProviderExecutionRecording(
      repository.capability,
      plan.operationId,
      plan.provider,
      {
        ...executionMetadata,
        ...(plan.taskRole ? { role: plan.taskRole } : {}),
      },
      plan.executionSelection,
    );
  reportExecutionRecordingUnavailable(`execution-${plan.operationId}`);
  return null;
}

/**
 * 準備又は開始を拒否した一試行の結果を構成する。
 * @responsibility 失敗段階と、既知の清掃・回復参照を保持する。
 * @trace ARCH-000008
 * @effect N/A: 不変の結果値を作る。
 * @failure 清掃不明または回復参照ありを回復不要へ変換しない。
 */
function blockedAttemptStart(
  reason: string,
  details: Readonly<{
    preparationFailed?: true;
    cleanupConfirmed?: boolean;
    recoveryId?: string | null;
    manualRecoveryRequired?: boolean;
  }> = {},
): StartResult<"attempt"> & Readonly<{ status: "blocked" }> {
  const cleanupConfirmed = details.cleanupConfirmed ?? false;
  const recoveryId = details.recoveryId ?? null;
  return Object.freeze({
    kind: "attempt",
    status: "blocked",
    reason,
    controlCapability: null,
    completion: null,
    operationId: null,
    recoveryId,
    cleanupConfirmed,
    manualRecoveryRequired:
      details.manualRecoveryRequired === true ||
      !cleanupConfirmed ||
      recoveryId !== null,
    dockerEffectStarted: false,
    providerRequestStarted: false,
    normalizedResult: null,
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
    hostPathReported: false,
    proxyCredentialReported: false,
    preparationFailed: details.preparationFailed ?? false,
  });
}

// Host開始保存と実行調停の相互参照では、初期化中にRuntimeを呼ばない。
// 関数宣言だけを束縛し、実呼出しは同じ一つのExecutorへ委譲する。
/**
 * 単段の開始を同じ固定Executorへ渡す。
 * @responsibility Host準備値を新Taskや新Runtimeへ読み替えず配送する。
 * @trace ARCH-000008
 * @input 元準備・管理参照・同期回復引渡し、開始通知と計測情報。
 * @returns 同じExecutorの開始結果とcompletion。
 * @precondition 元Ownerの準備と同意が成立している。
 * @postcondition Task全体の順序を変更しない。
 * @effect Executorの開始・元回復保存と下位実行へ委譲する。
 * @failure 元のblocked／unknownをそのまま返す。
 * @invariant 本番Runtimeを呼出しごとに作らない。
 * @boundary Coordinatorの段階調停と単段実行。
 * @security 任意CLI／Processを追加注入しない。
 * @concurrency 返されたcompletionは上位が終了まで管理する。
 */
export function startDockerProcessController(
  provider: Provider,
  input: PreparationInput,
  handoff: (capability: object, recoveryId: string) => boolean,
  observeStarted:
    | ((notice: ProcessStartedNotice) => void | Promise<void>)
    | undefined,
  executionMetadata: Readonly<Record<string, string>>,
  recordings: ProviderExecutionRecording[],
): RecordedStartResult {
  if (provider !== "codex" && provider !== "claude")
    return blockedAttemptStart("docker_process_controller_plan_invalid", {
      preparationFailed: true,
    });
  const captured = capturePreparationInput(input);
  const prepared = captured
    ? prepareProviderAttempt(provider, captured)
    : createPreparationFailure(
        `${provider}_docker_runtime_input_mode_ambiguous`,
      );
  if (!captured || prepared.status !== "prepared")
    return blockedAttemptStart(prepared.reason, { preparationFailed: true });
  const plan = prepared.plan;
  const management = captured.managementCapability;
  let recording: ProviderExecutionRecording | null = null;
  let recordingAttempted = false;
  let started: RecordedStartResult;
  try {
    started = startHostAttempt(
      plan,
      management,
      handoff,
      createLifecycleNoticeReporter(process.stderr),
      () => {
        if (recordingAttempted) return;
        recordingAttempted = true;
        try {
          recording = beginAttemptRecording(
            plan,
            management,
            executionMetadata,
          );
          if (recording) recordings.push(recording);
        } catch {
          reportExecutionRecordingUnavailable(`execution-${plan.operationId}`);
        }
      },
      observeStarted,
    );
  } catch {
    return blockedAttemptStart("docker_process_controller_start_failed_closed");
  }
  if (started.status === "blocked")
    return Object.freeze({
      ...started,
      preparationFailed: false,
    });
  return Object.freeze({
    ...started,
    preparationFailed: false,
    completion: started.completion.then((result) => {
      captureProviderExecutionCompletion(recording, result);
      return result;
    }),
  });
}
/** 不正な回復開始のOwner終了を試み、元回復参照と清掃未確認を保持する。 */
function settleInvalidRecoveryStart(
  recoveryCapability: unknown,
  recoveryId: string | null,
  reason: string,
) {
  if (recoveryCapability && typeof recoveryCapability === "object") {
    try {
      abandonDockerRecovery(recoveryCapability);
    } catch {}
  }
  return blockedAttemptStart(reason, {
    cleanupConfirmed: false,
    recoveryId: recoveryId,
    manualRecoveryRequired: true,
  });
}

/**
 * 上位が確定した一試行を実行し、技術通知を自身の保存へ接続する。
 * @responsibility 通知へ保存結果を返さず、上位の完了投影だけで耐久受理を表す。
 * @trace ARCH-000008
 * @effect 同じ記録への更新と、下位Executorの明示開始。
 */
function startRecordedAttempt(
  plan: PreparedAttemptPlan<Provider>,
  management: object,
  recovery: Recovery,
  report: ReturnType<typeof createLifecycleNoticeReporter>,
  observeProviderSubmission: () => void,
  observeStarted?: (notice: ProcessStartedNotice) => void | Promise<void>,
): RecordedStartResult {
  const executor = plan.executor;
  let cleanup: ResourceCleanupResult = {
    homeLeaseReleased: false,
    recoveryCompleted: false,
    recoveryFinalizationCapability: null,
  };
  let terminalObservation: AttemptTerminalObservation | null = null;
  function requireRecorded(value: unknown): void {
    if (types.isPromise(value)) void value.catch(() => {});
    if (value !== true) throw Error("record_unconfirmed");
  }
  const callbacks: ExecutorCallbacks<"attempt"> = {
    onCommandSubmitting: (purpose, resources) => {
      if (purpose.startsWith("create_"))
        requireRecorded(
          recordDockerResourceEvent(
            recovery.recoveryCapability,
            purpose,
            resources,
            "submission",
          ),
        );
    },
    onCommandNotIssued: (purpose) => {
      requireRecorded(
        recordDockerResourceNotIssued(recovery.recoveryCapability, purpose),
      );
    },
    onProviderSubmitting: () => {
      requireRecorded(
        recordDockerProviderSubmission(recovery.recoveryCapability),
      );
      observeProviderSubmission();
    },
    onResourceIdentified: (key, resources) => {
      requireRecorded(
        recordDockerResourceEvent(
          recovery.recoveryCapability,
          key,
          resources,
          "identified",
        ),
      );
    },
    onResourceCreated: (purpose, _id, resources) => {
      requireRecorded(
        recordDockerResourceEvent(
          recovery.recoveryCapability,
          purpose,
          resources,
          "receipt",
        ),
      );
    },
    onStarted: async (notice) => {
      // 表示の失敗は保存の成否や後続実行を変更しない。
      try {
        const pending = report(notice);
        if (pending) void pending.catch(() => {});
      } catch {
        // 任意表示だけの失敗。
      }
      if (observeStarted) {
        try {
          await observeStarted(notice);
        } catch {
          throw Error("provider_start_record_failed");
        }
      }
    },
    onDiagnostic: (notice) => {
      try {
        const pending = reportAttemptDiagnostic(report, plan, notice);
        if (pending) void pending.catch(() => {});
      } catch {
        // 任意診断は実行結果・元回復参照を変更しない。
      }
    },
    onCleanupCompleted: (observation) => {
      terminalObservation = observation;
      cleanup = {
        ...cleanup,
        homeLeaseReleased: observation.homeLeaseReleased,
      };
      if (
        !observation.processTreeTerminationConfirmed ||
        !observation.containersAbsent ||
        !observation.networksAbsent ||
        observation.resources === null
      )
        return;
      const saved = recordAttemptCleanup({
        plan,
        managementCapability: management,
        recoveryCapability: recovery.recoveryCapability,
        recoveryId: recovery.recoveryId,
        observations: observation.resources,
        resourceSnapshot: observation.resourceSnapshot,
        homeLeaseReleased: observation.homeLeaseReleased,
      });
      if (saved.homeLeaseReleased !== cleanup.homeLeaseReleased)
        throw Error("cleanup_record_inconsistent");
      cleanup = saved;
    },
  };
  const bound = bindExecutorAttempt(
    recovery.recoveryCapability,
    management,
    executor,
  );
  const started = bound
    ? executor.start({
        managementCapability: management,
        reference: recovery,
        callbacks,
      })
    : blockedAttemptStart("docker_process_controller_recovery_unavailable", {
        recoveryId: recovery.recoveryId,
      });
  let controlBindingConfirmed = true;
  if (
    started.status === "started" &&
    !bindExecutorAttempt(
      recovery.recoveryCapability,
      management,
      executor,
      started,
    )
  ) {
    controlBindingConfirmed = false;
    void executor
      .cancel({
        controlCapability: started.controlCapability,
        managementCapability: management,
      })
      .catch(() => {});
    // 元completionを上位の終了保存へjoinし、開始済みの試行を未開始へ戻さない。
  }
  if (started.status !== "started") {
    if (
      started.reason ===
      "docker_process_controller_home_lock_descriptor_close_unconfirmed"
    )
      poisonExecutionProcessAfterCleanupUnknown();
    try {
      recordUnstartedAttempt(recovery.recoveryCapability, management, started);
    } catch {
      /* 同じ未開始参照と回復義務を保持する。 */
    }
    return started;
  }
  const withheldResult = {
    status: "blocked",
    normalizedResult: null,
    resultSha256: null,
    resultBytes: 0,
    reviewFindings: null,
  } as const;
  return Object.freeze({
    ...started,
    completion: started.completion.then(async (result) => {
      try {
        if (!controlBindingConfirmed)
          throw Error("executor_control_binding_failed");
        const observation = terminalObservation;
        if (!observation) throw Error("terminal_observation_missing");
        const revisionValid = !!verifyRepositoryOperation(management);
        const taskCleanupConfirmed = result.cleanupConfirmed;
        const blockedReason = !revisionValid
          ? "repository_revision_changed"
          : taskCleanupConfirmed
            ? null
            : "docker_process_controller_cleanup_unconfirmed";
        const final: RecordedAttemptResult = Object.freeze({
          ...result,
          ...cleanup,
          cleanupConfirmed: taskCleanupConfirmed,
          ...(blockedReason === null
            ? {}
            : { ...withheldResult, reason: blockedReason }),
          ...(!taskCleanupConfirmed
            ? {
                providerExecutionObservation: null,
                providerTurnObservation: null,
              }
            : {}),
          recoveryId:
            taskCleanupConfirmed && cleanup.recoveryCompleted
              ? null
              : recovery.recoveryId,
          manualRecoveryRequired:
            result.manualRecoveryRequired || !cleanup.recoveryCompleted,
        });
        if (observation.resources !== null)
          await recordDockerTerminalObservation(
            recovery.recoveryCapability,
            final,
            Object.freeze({
              ...observation,
              recoveryCompleted: cleanup.recoveryCompleted,
            }),
          );
        return final;
      } catch {
        return Object.freeze({
          ...result,
          ...cleanup,
          ...withheldResult,
          reason: "docker_process_controller_execution_failed_closed" as const,
          recoveryCompleted: false,
          recoveryFinalizationCapability: null,
          recoveryId: recovery.recoveryId,
          manualRecoveryRequired: true,
        });
      }
    }),
  });
}

/** 確定した計画をExecutorへ渡し、元回復参照と開始・完了を上位記録へ接続する。 */
function startHostAttempt(
  plan: PreparedAttemptPlan<Provider>,
  managementCapability: unknown,
  registerRecoveryHandoff: unknown,
  report: ReturnType<typeof createLifecycleNoticeReporter>,
  observeProviderSubmission: () => void,
  observeProviderStarted?: (
    notice: ProcessStartedNotice,
  ) => void | Promise<void>,
) {
  if (
    (observeProviderStarted !== undefined &&
      typeof observeProviderStarted !== "function") ||
    !managementCapability ||
    typeof managementCapability !== "object"
  ) {
    return blockedAttemptStart("docker_process_controller_effect_unavailable");
  }
  if (!plan)
    return blockedAttemptStart("docker_process_controller_plan_invalid");
  if (!verifyRepositoryOperation(managementCapability)) {
    return blockedAttemptStart("docker_process_controller_revision_invalid", {
      cleanupConfirmed: true,
    });
  }
  let recoveryStartFailure: RecoveryStartFailureDiagnostic | null = null;
  let failureObserved = false;
  const recovery = beginDockerRecovery(plan, managementCapability, (raw) => {
    if (failureObserved) return;
    failureObserved = true;
    const value = inspectRecoveryStartFailureDiagnostic(raw);
    recoveryStartFailure =
      value &&
      (value.recoveryId === null ||
        parseDockerTaskRecoveryId(value.recoveryId)
          ?.stableLogicalHomeBindingHash === plan.stableLogicalHomeBindingHash)
        ? value
        : Object.freeze({ stage: "unknown", recoveryId: null });
  });
  const readyRecovery = snapshotReadyRecovery(recovery);
  if (!readyRecovery) {
    if (failureObserved && recoveryStartFailure) {
      const diagnostic = recoveryStartFailure as RecoveryStartFailureDiagnostic;
      const returnedId = resolveRecoveryReference(
        ownDataValue(recovery, "recoveryId"),
      );
      try {
        const pending = reportAttemptDiagnostic(
          report,
          plan,
          Object.freeze({
            event: "coordinator_provider_recovery_start_failed",
            taskRole: plan.taskRole,
            provider: plan.provider,
            operationId: plan.operationId,
            diagnostic:
              diagnostic.recoveryId === null ||
              diagnostic.recoveryId === returnedId
                ? diagnostic
                : Object.freeze({ stage: "unknown", recoveryId: null }),
          }),
        );
        if (pending) void pending.catch(() => {});
      } catch {
        // 診断出力の失敗で、元の回復開始結果や参照を変更しない。
      }
    }
    const malformedCapability = ownDataValue(recovery, "recoveryCapability");
    const malformedRecoveryId = resolveRecoveryReference(
      ownDataValue(recovery, "recoveryId"),
    );
    const exactBlocked = snapshotBlockedRecoveryWithExactId(
      recovery,
      plan.stableLogicalHomeBindingHash,
    );
    if (exactBlocked?.recoveryCapability) {
      const stopped = blockedAttemptStart(
        resolveRecoveryStartReason(exactBlocked.reason),
        {
          cleanupConfirmed: false,
          recoveryId: exactBlocked.recoveryId,
          manualRecoveryRequired: true,
        },
      );
      let isVerified = false;
      try {
        isVerified =
          bindDockerInitializationFailure(
            exactBlocked.recoveryCapability,
            exactBlocked.recoveryId,
            managementCapability,
            plan.stableLogicalHomeBindingHash,
            exactBlocked.reason,
            stopped,
          ) === true;
      } catch {}
      if (isVerified) {
        try {
          abandonDockerRecovery(exactBlocked.recoveryCapability);
        } catch {}
        return stopped;
      }
    }
    if (!malformedCapability && exactBlocked) {
      return blockedAttemptStart(
        resolveRecoveryStartReason(exactBlocked.reason),
        {
          cleanupConfirmed: true,
          recoveryId: exactBlocked.recoveryId,
          manualRecoveryRequired: true,
        },
      );
    }
    if (malformedCapability || malformedRecoveryId)
      return settleInvalidRecoveryStart(
        malformedCapability,
        malformedRecoveryId,
        "docker_process_controller_recovery_identity_invalid",
      );
    return blockedAttemptStart(
      resolveRecoveryStartReason(ownDataValue(recovery, "reason")),
      {
        cleanupConfirmed: true,
        recoveryId: malformedRecoveryId,
        manualRecoveryRequired:
          ownDataValue(recovery, "manualRecoveryRequired") === true,
      },
    );
  }
  const parsedRecoveryId = parseDockerTaskRecoveryId(readyRecovery.recoveryId);
  if (
    !parsedRecoveryId ||
    parsedRecoveryId.stableLogicalHomeBindingHash !==
      plan.stableLogicalHomeBindingHash ||
    verifyDockerRecoveryBinding(
      readyRecovery.recoveryCapability,
      parsedRecoveryId?.token ?? readyRecovery.recoveryId,
      managementCapability,
      plan.stableLogicalHomeBindingHash,
    ) !== true
  ) {
    return settleInvalidRecoveryStart(
      readyRecovery.recoveryCapability,
      parsedRecoveryId?.token ?? null,
      "docker_process_controller_recovery_identity_invalid",
    );
  }
  if (
    typeof registerRecoveryHandoff !== "function" ||
    registerRecoveryHandoff(
      readyRecovery.recoveryCapability,
      parsedRecoveryId.token,
    ) !== true
  ) {
    return settleInvalidRecoveryStart(
      readyRecovery.recoveryCapability,
      parsedRecoveryId.token,
      "docker_process_controller_recovery_handoff_unavailable",
    );
  }
  return startRecordedAttempt(
    plan,
    managementCapability,
    readyRecovery,
    report,
    observeProviderSubmission,
    observeProviderStarted,
  );
}
