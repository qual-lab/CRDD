/**
 * coordinator-task-runtimeに属する責務をまとめる。
 *
 * @responsibility projectRuntimeOwnedDockerProcessStartForTaskを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { types as utilTypes } from "node:util";
import {
  createDevelopmentExecutionTiming,
  writeDevelopmentMeasurementProgress,
} from "../core/development-execution-timing.ts";
import { evaluateManagedDockerCleanupEligibility } from "../core/docker-cleanup-eligibility.ts";
import {
  isRuntimeProcessEffectBlocked,
  isRuntimeProcessPoisoned,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../core/runtime-process-safety-state.ts";
import {
  discardRuntimeOwnedCandidateBundle,
  inspectRuntimeOwnedDevelopmentCandidateStore,
  publishRuntimeOwnedCandidateBundle,
  runRuntimeOwnedCandidateStoreStartupGc,
} from "./candidate-bundle-store.ts";
import { prepareRuntimeOwnedClaudeDockerTaskCandidate } from "./claude-docker-runtime-adapter.ts";
import { CLAUDE_RESULT_ACCEPTANCE_MAXIMUM_TURNS } from "./claude-execution-plan.ts";
import { prepareRuntimeOwnedCodexDockerTaskCandidate } from "./codex-docker-runtime-adapter.ts";
import {
  classifyOwnedCoordinatorOperationCreationFailure,
  createRuntimeOwnedCoordinatorOperation,
} from "./coordinator-operation-creation-internal.ts";
import { snapshotCoordinatorTaskRequest } from "./coordinator-task-request.ts";
import {
  issueRuntimeOwnedDelegationSelectionGrant,
  preflightRuntimeOwnedDelegationExecutionSlate,
  revokeRuntimeOwnedDelegationSelectionGrant,
} from "./delegation-selection-grant-runtime.ts";
import { reserveRuntimeOwnedDevelopmentMeasurementTask } from "./development-measurement-session.ts";
import {
  cancelRuntimeOwnedDockerProcessController,
  projectDockerProcessControllerCompletionResult,
  projectDockerProcessControllerStartResult,
  startRuntimeOwnedDockerProcessController,
} from "./docker-process-controller.ts";
import {
  projectDockerRecoveryAdmission,
  publicVerifiedDockerRecoveryId,
} from "./docker-recovery-public-projection.ts";
import {
  abandonRuntimeOwnedDockerRecovery,
  finalizeRuntimeOwnedDockerRecovery,
  inspectRuntimeOwnedDockerTaskRecoveryState,
  prepareRuntimeOwnedDockerHostCleanup,
  recordRuntimeOwnedDockerHostCleanupReceipt,
} from "./docker-recovery-runtime.ts";
import {
  abandonOwnedHostOperationGenerationLock,
  activateOwnedHostOperationGenerationLock,
  classifyOwnedOperationDirectoryCreationFailure,
  cleanupOwnedOperationDirectoriesAsync,
  confirmOwnedHostOperationGenerationLockReadiness,
  observeOwnedHostOperationGenerationLoss,
  verifyOwnedOperationCleanupOutcome,
} from "./execution-environment.ts";
import { requestRuntimeOwnedExternalSendGrant } from "./external-send-grant-runtime.ts";
import { resolveRuntimeOwnedExternalSendPolicy } from "./external-send-policy-runtime.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import { consumeRuntimeOwnedVerifiedCoordinatorPackageCapability } from "./platform-provisioner-package-filesystem.ts";
import {
  consumeRuntimeOwnedProviderHomeMountGrant,
  issueRuntimeOwnedProviderHomeMountGrant,
  revokeRuntimeOwnedProviderHomeMountGrant,
} from "./provider-home-mount-grant-runtime.ts";
import { inspectRuntimeOwnedWindowsProviderHomeCandidate } from "./provider-home-windows-adapter.ts";
import {
  issueRuntimeOwnedProviderTaskPacket,
  revokeRuntimeOwnedProviderTaskPacket,
} from "./provider-task-packet-runtime.ts";
import {
  bindRuntimeOwnedRepositoryOperation,
  inspectRepositoryObjectFormatCandidate,
} from "./repository-operation-runtime.ts";
import {
  captureRuntimeOwnedCandidateRevision,
  materializeRuntimeOwnedRepositoryWorkspace,
  persistRuntimeOwnedCandidateRevision,
  projectRuntimeOwnedCandidateReadContent,
  verifyRuntimeOwnedCandidateRevision,
} from "./repository-workspace-runtime.ts";

/**
 * Runtime 所有 Docker Process Start For Taskを公開結果へ投影する。
 *
 * @responsibility Runtime 所有 Docker Process Start For Taskの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、recoveryId: unknown、operationId: unknown
 * @returns projectRuntimeOwnedDockerProcessStartForTaskの計算結果を返す。
 * @precondition 「value: unknown、recoveryId: unknown、operationId: unknown」がprojectRuntimeOwnedDockerProcessStartForTaskの入力契約を満たす。
 * @postcondition projectRuntimeOwnedDockerProcessStartForTaskの責務を完了した結果だけを返す。
 * @effect N/A: projectRuntimeOwnedDockerProcessStartForTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectRuntimeOwnedDockerProcessStartForTaskは独自の失敗分岐を所有しない。
 * @invariant projectRuntimeOwnedDockerProcessStartForTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectRuntimeOwnedDockerProcessStartForTaskはProcess内の同一Subsystemで完結する。
 * @security projectRuntimeOwnedDockerProcessStartForTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectRuntimeOwnedDockerProcessStartForTaskは共有非同期状態を持たない同期処理である。
 */
export function projectRuntimeOwnedDockerProcessStartForTask(
  value: unknown,
  recoveryId: unknown,
  operationId: unknown,
) {
  return projectDockerProcessControllerStartResult(
    value,
    recoveryId,
    operationId,
  );
}

/**
 * Runtime 所有 Docker Process Completion For Taskを公開結果へ投影する。
 *
 * @responsibility Runtime 所有 Docker Process Completion For Taskの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、recoveryId: unknown、operationId: unknown
 * @returns projectRuntimeOwnedDockerProcessCompletionForTaskの計算結果を返す。
 * @precondition 「value: unknown、recoveryId: unknown、operationId: unknown」がprojectRuntimeOwnedDockerProcessCompletionForTaskの入力契約を満たす。
 * @postcondition projectRuntimeOwnedDockerProcessCompletionForTaskの責務を完了した結果だけを返す。
 * @effect N/A: projectRuntimeOwnedDockerProcessCompletionForTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectRuntimeOwnedDockerProcessCompletionForTaskは独自の失敗分岐を所有しない。
 * @invariant projectRuntimeOwnedDockerProcessCompletionForTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectRuntimeOwnedDockerProcessCompletionForTaskはProcess内の同一Subsystemで完結する。
 * @security projectRuntimeOwnedDockerProcessCompletionForTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectRuntimeOwnedDockerProcessCompletionForTaskは共有非同期状態を持たない同期処理である。
 */
export function projectRuntimeOwnedDockerProcessCompletionForTask(
  value: unknown,
  recoveryId: unknown,
  operationId: unknown,
) {
  return projectDockerProcessControllerCompletionResult(
    value,
    recoveryId,
    operationId,
  );
}

export const COORDINATOR_TASK_RUNTIME_CONTRACT =
  "crdd-coordinator/task-runtime";
export const COORDINATOR_TASK_RUNTIME_CONTRACT_REVISION = 35;
const PRODUCTION_CANCELLATION_ACK_TIMEOUT_MS = 10_000;

const EXTERNAL_SEND_CONFIRMATION_REASONS = new Set([
  "external_send_confirmation_declined_invalid",
  "external_send_confirmation_cancelled",
  "external_send_confirmation_timeout",
  "external_send_confirmation_unavailable",
  "external_send_confirmation_reader_failed",
  "external_send_confirmation_cleanup_unknown",
  "external_send_confirmation_cleanup_unknown_process_restart_required",
  "external_send_consent_cleanup_unknown_process_restart_required",
  "external_send_consent_manual_recovery_required",
]);
const PROCESS_CANCELLATION_RESULT_KEYS = new Set([
  "status",
  "reason",
  "cancellationRequested",
  "processTerminationObserved",
]);
const PROVIDER_TURN_OBSERVATION_KEYS = new Set([
  "provider",
  "taskRole",
  "requestedMaximumTurns",
  "providerReportedTurns",
  "resultAcceptanceMaximumTurns",
  "requestedTurnTargetExceeded",
]);
const REVIEWER_FINDING_DIAGNOSTIC_KEYS = new Set([
  "severity",
  "path",
  "category",
  "criterionNumber",
  "messageSha256",
]);
const PROVIDER_EXECUTION_OBSERVATION_KEYS = new Set([
  "transport",
  "turnCompleted",
  "commandExecutionStartedCount",
  "commandExecutionCompletedCount",
  "commandExecutionFailedCount",
  "commandExecutionDeclinedCount",
  "commandExecutionExitCode0Count",
  "commandExecutionExitCode1Count",
  "commandExecutionExitCode126Count",
  "commandExecutionExitCode127Count",
  "commandExecutionOtherNonzeroExitCodeCount",
  "commandExecutionMissingExitCodeCount",
  "commandFamilyPythonCount",
  "commandFamilyPosixTextCount",
  "commandFamilyGitCount",
  "commandFamilyApplyPatchCount",
  "commandFailurePermissionCount",
  "commandFailureReadOnlyFilesystemCount",
  "commandFailureMissingPathCount",
  "commandFailureCommandNotFoundCount",
  "commandFailureSyntaxCount",
  "commandFailureSandboxCount",
  "commandFailureUnclassifiedCount",
  "fileChangeStartedCount",
  "fileChangeCompletedCount",
  "fileChangeFailedCount",
  "fileChangeDeclinedCount",
  "rawEventReported",
  "commandReported",
  "pathReported",
  "providerTextReported",
]);
const REVIEWER_PROJECTION_KEYS = new Set([
  "status",
  "candidatePatchHash",
  "candidateContentManifestHash",
  "projectionHash",
  "totalBytes",
  "files",
]);
const REVIEWER_PROJECTION_FILE_KEYS = new Set([
  "path",
  "state",
  "byteLength",
  "sha256",
  "encoding",
  "content",
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
 * coordinator-task-runtimeで使用するRuntime Lifecycle 状態の値契約を定義する。
 *
 * @responsibility Runtime Lifecycle 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape RuntimeLifecycleStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeLifecycleStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeLifecycleStateの宣言は外部境界を開かない。
 * @security RuntimeLifecycleStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeLifecycleStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeLifecycleState =
  | "STATE-ADMISSION"
  | "STATE-OPERATION-ACQUIRING"
  | "STATE-OPERATION-READY"
  | "STATE-TASK-AUTHORIZED"
  | "STATE-EXECUTOR-CLEAN"
  | "STATE-CANDIDATE-CAPTURED"
  | "STATE-REVIEWER-CLEAN"
  | "STATE-REMEDIATION-AUTHORIZED"
  | "STATE-REMEDIATION-EXECUTOR-CLEAN"
  | "STATE-REMEDIATION-CANDIDATE-CAPTURED"
  | "STATE-REMEDIATION-REVIEWER-CLEAN"
  | "STATE-CANDIDATE-STAGED"
  | "STATE-HOST-CLEAN"
  | "STATE-RESULT-PUBLISHED"
  | "STATE-BLOCKED-CLEAN"
  | "STATE-PROCESS-RESTART-REQUIRED"
  | "STATE-RECOVERY-REQUIRED"
  | "STATE-OPERATOR-TRANSFER-REQUIRED";
/**
 * coordinator-task-runtimeで使用するRuntime 記録の値契約を定義する。
 *
 * @responsibility Runtime 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape RuntimeRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeRecordの宣言は外部境界を開かない。
 * @security RuntimeRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeRecord = Readonly<Record<string, unknown>>;
const INTERNAL_TASK_OUTCOME = Symbol("internalTaskOutcome");
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
  [INTERNAL_TASK_OUTCOME]: true;
  publicResult: RuntimeRecord;
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
type TaskCompletionRecord = RuntimeRecord &
  Readonly<{
    status: string;
    reason: string;
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
    canonicalRepositoryChanged: boolean;
  }>;
/**
 * coordinator-task-runtimeで使用するOperationの値契約を定義する。
 *
 * @responsibility OperationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Operationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Operationで宣言した値と責務の対応を維持する。
 * @boundary N/A: Operationの宣言は外部境界を開かない。
 * @security OperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Operationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Operation = Readonly<{
  owned: object;
  mountCapability: object;
  managementCapability: object;
  operationId: string;
  hostRecoveryId: string;
  hostGenerationFailureDetected?: Promise<void>;
  hostGenerationLoss?: Promise<"cleanup_confirmed_failure" | "cleanup_unknown">;
  releaseHostGenerationDrain?: () => boolean;
}>;
/**
 * coordinator-task-runtimeで使用するHost 清掃 Statusの値契約を定義する。
 *
 * @responsibility Host 清掃 StatusのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape HostCleanupStatusが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostCleanupStatusで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostCleanupStatusの宣言は外部境界を開かない。
 * @security HostCleanupStatusはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostCleanupStatusの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HostCleanupStatus = "completed" | "protocol_failure_cleanup_confirmed";
/**
 * coordinator-task-runtimeで使用するProduction Operation 失敗の値契約を定義する。
 *
 * @responsibility Production Operation 失敗のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProductionOperationFailureが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProductionOperationFailureで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProductionOperationFailureの宣言は外部境界を開かない。
 * @security ProductionOperationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProductionOperationFailureの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ProductionOperationFailure = Readonly<{
  reason: string;
  hostRecoveryId: string | null;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
}>;
const productionOperationFailures = new WeakMap<
  object,
  ProductionOperationFailure
>();

/**
 * production Operation 失敗を決定する。
 *
 * @responsibility production Operation 失敗の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns productionOperationFailureの計算結果を返す。
 * @precondition 「error: unknown」がproductionOperationFailureの入力契約を満たす。
 * @postcondition productionOperationFailureの責務を完了した結果だけを返す。
 * @effect N/A: productionOperationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: productionOperationFailureは独自の失敗分岐を所有しない。
 * @invariant productionOperationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: productionOperationFailureはProcess内の同一Subsystemで完結する。
 * @security productionOperationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: productionOperationFailureは共有非同期状態を持たない同期処理である。
 */
function productionOperationFailure(error: unknown) {
  return error && typeof error === "object"
    ? (productionOperationFailures.get(error) ?? null)
    : null;
}

/**
 * throw Production Operation 失敗を決定する。
 *
 * @responsibility throw Production Operation 失敗の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input details: ProductionOperationFailure
 * @returns neverを返す。
 * @precondition 「details: ProductionOperationFailure」がthrowProductionOperationFailureの入力契約を満たす。
 * @postcondition throwProductionOperationFailureの責務を完了した結果だけを返す。
 * @effect N/A: throwProductionOperationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure throwProductionOperationFailureは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant throwProductionOperationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: throwProductionOperationFailureはProcess内の同一Subsystemで完結する。
 * @security throwProductionOperationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: throwProductionOperationFailureは共有非同期状態を持たない同期処理である。
 */
function throwProductionOperationFailure(
  details: ProductionOperationFailure,
): never {
  const error = new Error("coordinator_task_operation_creation_failed");
  productionOperationFailures.set(error, Object.freeze(details));
  throw error;
}

/**
 * Production Operation Rootを構築する。
 *
 * @responsibility Production Operation Rootの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input createOperation: () => Operation、poisonAfterCleanupUnknown: () => void
 * @returns createProductionOperationRootの計算結果を返す。
 * @precondition 「createOperation: () => Operation、poisonAfterCleanupUnknown: () => void」がcreateProductionOperationRootの入力契約を満たす。
 * @postcondition createProductionOperationRootの責務を完了した結果だけを返す。
 * @effect N/A: createProductionOperationRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createProductionOperationRootは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createProductionOperationRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createProductionOperationRootはProcess内の同一Subsystemで完結する。
 * @security createProductionOperationRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createProductionOperationRootは共有非同期状態を持たない同期処理である。
 */
function createProductionOperationRoot(
  createOperation: () => Operation,
  poisonAfterCleanupUnknown: () => void,
) {
  try {
    return createOperation();
  } catch (error) {
    const creation =
      classifyOwnedOperationDirectoryCreationFailure(error) ??
      classifyOwnedCoordinatorOperationCreationFailure(error);
    if (!creation) throw error;
    if (!creation.cleanupConfirmed) poisonAfterCleanupUnknown();
    throwProductionOperationFailure(
      Object.freeze({
        reason: creation.cleanupConfirmed
          ? "coordinator_task_operation_initialization_failed_cleanup_confirmed"
          : "coordinator_task_operation_initialization_cleanup_unknown_process_restart_required",
        hostRecoveryId: creation.hostRecoveryId,
        cleanupConfirmed: creation.cleanupConfirmed,
        manualRecoveryRequired: creation.manualRecoveryRequired,
      }),
    );
  }
}

/**
 * Test-only seam for the exact production operation-root failure wrapper.
 *
 * @responsibility Isolated Coordinator Task Operation Creation 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input createOperation: () => Operation
 * @returns createIsolatedCoordinatorTaskOperationCreationCandidateの計算結果を返す。
 * @precondition 「createOperation: () => Operation」がcreateIsolatedCoordinatorTaskOperationCreationCandidateの入力契約を満たす。
 * @postcondition createIsolatedCoordinatorTaskOperationCreationCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedCoordinatorTaskOperationCreationCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedCoordinatorTaskOperationCreationCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedCoordinatorTaskOperationCreationCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedCoordinatorTaskOperationCreationCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedCoordinatorTaskOperationCreationCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedCoordinatorTaskOperationCreationCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedCoordinatorTaskOperationCreationCandidate(
  createOperation: () => Operation,
) {
  let isPoisoned = false;
  return Object.freeze({
    productionAuthority: false as const,
    create: () =>
      createProductionOperationRoot(createOperation, () => {
        isPoisoned = true;
      }),
    classify: productionOperationFailure,
    isProcessPoisoned: () => isPoisoned,
  });
}
/**
 * coordinator-task-runtimeで使用するRuntime Dependenciesの値契約を定義する。
 *
 * @responsibility Runtime DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape RuntimeDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDependenciesの宣言は外部境界を開かない。
 * @security RuntimeDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeDependencies = Readonly<{
  beginInvocation?: (
    provider: Provider,
    role: TaskRole,
  ) => Readonly<{
    commandRestriction: (purpose: string) => boolean;
    settle: () => unknown;
  }> | null;
  observeLifecycleState?: (state: RuntimeLifecycleState) => void;
  inspectRepository: (repositoryRoot: string) => RuntimeRecord | null;
  createOperation: () => Operation | Promise<Operation>;
  classifyOperationCreationFailure: (
    error: unknown,
  ) => ProductionOperationFailure | null;
  cleanupOperation: (owned: object) => unknown | Promise<unknown>;
  classifyOperationCleanup: (outcome: unknown) => HostCleanupStatus | null;
  abandonOperation: (managementCapability: object) => Promise<unknown>;
  poisonProcessAfterCleanupUnknown?: () => void;
  isProcessPoisoned?: () => boolean;
  bindRepository: (
    managementCapability: object,
    repositoryRoot: string,
  ) => RuntimeRecord | null;
  materializeWorkspace: (
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
    readPaths: readonly string[],
  ) => RuntimeRecord | null;
  projectReviewerReadContent?: (
    workspaceCapability: object,
    candidateCapability: object,
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
    readPaths: readonly string[],
  ) => RuntimeRecord | null;
  issueSelection: (
    managementCapability: object,
    request: RuntimeRecord,
  ) => RuntimeRecord;
  preflightSlate: (
    managementCapability: object,
    request: RuntimeRecord,
  ) => RuntimeRecord;
  revokeSelection: (
    controlCapability: object,
    managementCapability: object,
  ) => RuntimeRecord;
  observeProviderHome: (
    provider: Provider,
    evaluationTime: unknown,
  ) => RuntimeRecord;
  issueMountGrant: (
    managementCapability: object,
    observationCapability: object,
    profileId: string,
  ) => RuntimeRecord;
  consumeMountGrant: (
    useCapability: object,
    managementCapability: object,
    observationCapability: object,
  ) => RuntimeRecord;
  revokeMountGrant: (
    controlCapability: object,
    managementCapability: object,
  ) => RuntimeRecord;
  authorizeExternalSend: (
    managementCapability: object,
    repositoryBindingCapability: object,
    policyCapability: object,
    scope: RuntimeRecord,
    providers: readonly Provider[],
    cancellationSignal: AbortSignal,
  ) => RuntimeRecord | null | Promise<RuntimeRecord | null>;
  resolveExternalSendPolicy: (
    managementCapability: object,
    repositoryBindingCapability: object,
  ) => RuntimeRecord | null;
  prepareCandidateStore: () => RuntimeRecord;
  prepareDockerRecoveryState: () => unknown;
  reportSelectionNotice: (notice: RuntimeRecord) => boolean;
  reportExternalSendNotice: (notice: RuntimeRecord) => boolean;
  issueTaskPacket: (
    managementCapability: object,
    repositoryBindingCapability: object,
    provider: Provider,
    taskRole: TaskRole,
    taskAttempt: 0 | 1,
    externalSendGrantCapability: object,
    remediationCapability: object | null,
    packet: RuntimeRecord,
  ) => RuntimeRecord | null;
  revokeTaskPacket: (
    controlCapability: object,
    managementCapability: object,
  ) => RuntimeRecord;
  prepareProvider: (
    provider: Provider,
    managementCapability: object,
    mountCapability: object,
    mountAuthorizationCapability: object,
    selectionUseCapability: object,
    taskPacketUseCapability: object,
    recoveryCorrelationId: string | null,
  ) => RuntimeRecord;
  startProcess: (
    preparedCapability: object,
    managementCapability: object,
    registerRecoveryHandoff: (
      recoveryCapability: unknown,
      recoveryId: unknown,
    ) => boolean,
    commandRestriction?: unknown,
  ) => RuntimeRecord;
  cancelProcess: (
    controlCapability: object,
    managementCapability: object,
  ) => Promise<unknown>;
  captureCandidate: (
    workspaceCapability: object,
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
    allowedPaths: readonly string[],
  ) => RuntimeRecord | null;
  verifyCandidate: (
    candidateCapability: object,
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
  ) => RuntimeRecord | null;
  persistCandidate: (
    candidateCapability: object,
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
    persistencePolicy: RuntimeRecord,
  ) => RuntimeRecord | null;
  discardCandidate: (candidateId: string) => RuntimeRecord;
  publishCandidate: (candidateRecoveryId: string) => RuntimeRecord | null;
  finalizeDockerRecovery?: (capability: object) => RuntimeRecord;
  prepareDockerHostCleanup?: (capability: object) => string | null;
  recordDockerHostCleanupReceipt?: (capability: object) => boolean;
  abandonDockerRecovery?: (capability: object) => boolean;
  isolatedCancellationAckTimeoutMs?: number;
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
type ControlRecord = {
  lifecycleState: RuntimeLifecycleState;
  managementCapability: object;
  currentProcessControl: object | null;
  cancellationRequested: boolean;
  cancellationReceipt: Promise<RuntimeRecord> | null;
  cancellationSettlement: Promise<"confirmed" | "unknown"> | null;
  cancellationProtocolFailure: boolean;
  cancellationController: AbortController;
  ownedOperation: object | null;
  retainOperationRoot: boolean;
  processPoisoned: boolean;
  hostCleanupCompleted: boolean;
  hostRecoveryId: string | null;
  hostGenerationLossOutcome:
    | "cleanup_confirmed_failure"
    | "cleanup_unknown"
    | null;
  hostGenerationLoss: Promise<
    "cleanup_confirmed_failure" | "cleanup_unknown"
  > | null;
  hostGenerationLossHandling: Promise<void> | null;
  hostGenerationFailureHandling: Promise<void> | null;
  hostGenerationFailureObserved: boolean;
  releaseHostGenerationDrain: (() => boolean) | null;
  dockerFinalizations: Array<
    Readonly<{ capability: object; recoveryId: string }>
  >;
  dockerHandoffs: Array<{
    capability: object;
    recoveryId: string;
    state: "active" | "finalizable" | "finalized" | "abandoned";
  }>;
  recoveryCorrelationId: string | null;
};
/**
 * coordinator-task-runtimeで使用するRuntime 状態の値契約を定義する。
 *
 * @responsibility Runtime 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape RuntimeStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeStateの宣言は外部境界を開かない。
 * @security RuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeState = Readonly<{
  dependencies: RuntimeDependencies;
  controls: WeakMap<object, ControlRecord>;
}>;

/**
 * Lifecycle 状態を次の状態へ進める。
 *
 * @responsibility Lifecycle 状態の遷移条件、次状態、無効遷移の拒否境界を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、control: ControlRecord、next: RuntimeLifecycleState
 * @returns advanceLifecycleStateの計算結果を返す。
 * @precondition 「state: RuntimeState、control: ControlRecord、next: RuntimeLifecycleState」がadvanceLifecycleStateの入力契約を満たす。
 * @postcondition advanceLifecycleStateの責務を完了した結果だけを返す。
 * @effect N/A: advanceLifecycleStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure advanceLifecycleStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant advanceLifecycleStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: advanceLifecycleStateはProcess内の同一Subsystemで完結する。
 * @security advanceLifecycleStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: advanceLifecycleStateは共有非同期状態を持たない同期処理である。
 */
function advanceLifecycleState(
  state: RuntimeState,
  control: ControlRecord,
  next: RuntimeLifecycleState,
) {
  if (control.lifecycleState === next) return;
  control.lifecycleState = next;
  try {
    state.dependencies.observeLifecycleState?.(next);
  } catch {
    // Passive observation must not gain control over Runtime state or Effect.
  }
}

/**
 * Coordinator Task Terminal Lifecycle 状態を分類する。
 *
 * @responsibility Coordinator Task Terminal Lifecycle 状態の分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000004
 * @input result: TaskCompletionRecord
 * @returns RuntimeLifecycleStateを返す。
 * @precondition 「result: TaskCompletionRecord」がclassifyCoordinatorTaskTerminalLifecycleStateの入力契約を満たす。
 * @postcondition classifyCoordinatorTaskTerminalLifecycleStateの責務を完了した結果だけを返す。
 * @effect N/A: classifyCoordinatorTaskTerminalLifecycleStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyCoordinatorTaskTerminalLifecycleStateは独自の失敗分岐を所有しない。
 * @invariant classifyCoordinatorTaskTerminalLifecycleStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyCoordinatorTaskTerminalLifecycleStateはProcess内の同一Subsystemで完結する。
 * @security classifyCoordinatorTaskTerminalLifecycleStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyCoordinatorTaskTerminalLifecycleStateは共有非同期状態を持たない同期処理である。
 */
export function classifyCoordinatorTaskTerminalLifecycleState(
  result: TaskCompletionRecord,
): RuntimeLifecycleState {
  const exactRecoveryAvailable =
    result.hostRecoveryId !== null ||
    result.dockerRecoveryIds.length > 0 ||
    result.candidateRecoveryId !== null ||
    result.candidateStoreRecoveryId !== null;
  if (
    result.manualRecoveryRequired === true ||
    result.cleanupConfirmed !== true ||
    exactRecoveryAvailable
  )
    return exactRecoveryAvailable
      ? ("STATE-RECOVERY-REQUIRED" as const)
      : ("STATE-OPERATOR-TRANSFER-REQUIRED" as const);
  if (result.processRestartRequired === true)
    return "STATE-PROCESS-RESTART-REQUIRED" as const;
  if (result.status === "completed") return "STATE-RESULT-PUBLISHED" as const;
  return "STATE-BLOCKED-CLEAN" as const;
}

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
 * @returns createBlockedの計算結果を返す。
 * @precondition 「reason: string、manualRecoveryRequired、hostRecoveryId: string | null、dockerRecoveryId: string | null、candidateRecoveryId: string | null、isCleanupConfirmedOverride: boolean | null、candidateStoreRecoveryId: string | null、dockerRecoveryIds: readonly string[]」がcreateBlockedの入力契約を満たす。
 * @postcondition createBlockedの責務を完了した結果だけを返す。
 * @effect N/A: createBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createBlockedは独自の失敗分岐を所有しない。
 * @invariant createBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createBlockedはProcess内の同一Subsystemで完結する。
 * @security createBlockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createBlockedは共有非同期状態を持たない同期処理である。
 */
function createBlocked(
  reason: string,
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

const blocked = createBlocked;

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
 * @returns stringValueの計算結果を返す。
 * @precondition 「value: unknown」がstringValueの入力契約を満たす。
 * @postcondition stringValueの責務を完了した結果だけを返す。
 * @effect N/A: stringValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: stringValueは独自の失敗分岐を所有しない。
 * @invariant stringValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: stringValueはProcess内の同一Subsystemで完結する。
 * @security stringValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: stringValueは共有非同期状態を持たない同期処理である。
 */
function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * own Plain Data Valueを決定する。
 *
 * @responsibility own Plain Data Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、key: string
 * @returns ownPlainDataValueの計算結果を返す。
 * @precondition 「value: unknown、key: string」がownPlainDataValueの入力契約を満たす。
 * @postcondition ownPlainDataValueの責務を完了した結果だけを返す。
 * @effect N/A: ownPlainDataValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ownPlainDataValueは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ownPlainDataValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownPlainDataValueはProcess内の同一Subsystemで完結する。
 * @security ownPlainDataValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownPlainDataValueは共有非同期状態を持たない同期処理である。
 */
function ownPlainDataValue(value: unknown, key: string) {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor &&
      Object.hasOwn(descriptor, "value") &&
      descriptor.get === undefined &&
      descriptor.set === undefined &&
      descriptor.enumerable === true
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Provider Turn Observationを公開結果へ投影する。
 *
 * @responsibility Provider Turn Observationの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns projectProviderTurnObservationの計算結果を返す。
 * @precondition 「value: unknown」がprojectProviderTurnObservationの入力契約を満たす。
 * @postcondition projectProviderTurnObservationの責務を完了した結果だけを返す。
 * @effect N/A: projectProviderTurnObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectProviderTurnObservationは独自の失敗分岐を所有しない。
 * @invariant projectProviderTurnObservationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectProviderTurnObservationはProcess内の同一Subsystemで完結する。
 * @security projectProviderTurnObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectProviderTurnObservationは共有非同期状態を持たない同期処理である。
 */
function projectProviderTurnObservation(value: unknown) {
  const record = snapshotPlainRecord(value, PROVIDER_TURN_OBSERVATION_KEYS);
  if (!record) return null;
  const provider = record.provider;
  const taskRole = record.taskRole;
  const requestedMaximumTurns = record.requestedMaximumTurns;
  const providerReportedTurns = record.providerReportedTurns;
  const resultAcceptanceMaximumTurns = record.resultAcceptanceMaximumTurns;
  const requestedTurnTargetExceeded = record.requestedTurnTargetExceeded;
  if (
    provider !== "claude" ||
    (taskRole !== "executor" && taskRole !== "reviewer") ||
    !Number.isSafeInteger(requestedMaximumTurns) ||
    (requestedMaximumTurns as number) < 1 ||
    !Number.isSafeInteger(providerReportedTurns) ||
    (providerReportedTurns as number) < 1 ||
    !Number.isSafeInteger(resultAcceptanceMaximumTurns) ||
    resultAcceptanceMaximumTurns !== CLAUDE_RESULT_ACCEPTANCE_MAXIMUM_TURNS ||
    (taskRole === "executor"
      ? (requestedMaximumTurns as number) < 8
      : (requestedMaximumTurns as number) < 4) ||
    (requestedMaximumTurns as number) >
      CLAUDE_RESULT_ACCEPTANCE_MAXIMUM_TURNS ||
    (providerReportedTurns as number) >
      (resultAcceptanceMaximumTurns as number) ||
    requestedTurnTargetExceeded !==
      (providerReportedTurns as number) > (requestedMaximumTurns as number)
  )
    return null;
  return Object.freeze({
    provider,
    taskRole,
    requestedMaximumTurns: requestedMaximumTurns as number,
    providerReportedTurns: providerReportedTurns as number,
    resultAcceptanceMaximumTurns: resultAcceptanceMaximumTurns as number,
    requestedTurnTargetExceeded,
  });
}

/**
 * sha256 Valueを決定する。
 *
 * @responsibility sha256 Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がsha256Valueの入力契約を満たす。
 * @postcondition sha256Valueの責務を完了した結果だけを返す。
 * @effect N/A: sha256Valueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sha256Valueは独自の失敗分岐を所有しない。
 * @invariant sha256Valueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sha256ValueはProcess内の同一Subsystemで完結する。
 * @security sha256ValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sha256Valueは共有非同期状態を持たない同期処理である。
 */
function sha256Value(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

/**
 * Reviewer 結果 Diagnosticsを公開結果へ投影する。
 *
 * @responsibility Reviewer 結果 Diagnosticsの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns projectReviewerResultDiagnosticsの計算結果を返す。
 * @precondition 「value: unknown」がprojectReviewerResultDiagnosticsの入力契約を満たす。
 * @postcondition projectReviewerResultDiagnosticsの責務を完了した結果だけを返す。
 * @effect N/A: projectReviewerResultDiagnosticsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectReviewerResultDiagnosticsは独自の失敗分岐を所有しない。
 * @invariant projectReviewerResultDiagnosticsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectReviewerResultDiagnosticsはProcess内の同一Subsystemで完結する。
 * @security projectReviewerResultDiagnosticsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectReviewerResultDiagnosticsは共有非同期状態を持たない同期処理である。
 */
function projectReviewerResultDiagnostics(value: unknown) {
  const decision = ownPlainDataValue(value, "decision");
  const findingCount = ownPlainDataValue(value, "findingCount");
  const diagnostics = snapshotPlainArray<unknown>(
    ownPlainDataValue(value, "findingDiagnostics"),
    64,
  );
  if (
    (decision !== "approved" && decision !== "changes_requested") ||
    !Number.isSafeInteger(findingCount) ||
    (findingCount as number) < 0 ||
    diagnostics.status !== "ok" ||
    diagnostics.value.length !== findingCount
  )
    return null;
  const projectedDiagnostics = diagnostics.value.map((item) => {
    const record = snapshotPlainRecord(item, REVIEWER_FINDING_DIAGNOSTIC_KEYS);
    if (
      !record ||
      typeof record.severity !== "string" ||
      typeof record.path !== "string" ||
      typeof record.category !== "string" ||
      !Number.isSafeInteger(record.criterionNumber) ||
      !sha256Value(record.messageSha256)
    )
      return null;
    return Object.freeze({
      severity: record.severity,
      path: record.path,
      category: record.category,
      criterionNumber: record.criterionNumber,
      messageSha256: record.messageSha256,
    });
  });
  if (projectedDiagnostics.some((item) => item === null)) return null;
  return Object.freeze({
    decision,
    findingCount: findingCount as number,
    findingDiagnostics: Object.freeze(projectedDiagnostics),
  });
}

/**
 * Executor 結果 Diagnosticsを公開結果へ投影する。
 *
 * @responsibility Executor 結果 Diagnosticsの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns projectExecutorResultDiagnosticsの計算結果を返す。
 * @precondition 「value: unknown」がprojectExecutorResultDiagnosticsの入力契約を満たす。
 * @postcondition projectExecutorResultDiagnosticsの責務を完了した結果だけを返す。
 * @effect N/A: projectExecutorResultDiagnosticsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectExecutorResultDiagnosticsは独自の失敗分岐を所有しない。
 * @invariant projectExecutorResultDiagnosticsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectExecutorResultDiagnosticsはProcess内の同一Subsystemで完結する。
 * @security projectExecutorResultDiagnosticsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectExecutorResultDiagnosticsは共有非同期状態を持たない同期処理である。
 */
function projectExecutorResultDiagnostics(value: unknown) {
  const status = ownPlainDataValue(value, "status");
  const changedPaths = snapshotPlainArray<unknown>(
    ownPlainDataValue(value, "changedPaths"),
    1_000,
  );
  const verificationCount = ownPlainDataValue(value, "verificationCount");
  const observation = snapshotPlainRecord(
    ownPlainDataValue(value, "providerExecutionObservation"),
    PROVIDER_EXECUTION_OBSERVATION_KEYS,
  );
  if (
    status !== "completed" ||
    changedPaths.status !== "ok" ||
    !changedPaths.value.every((path) => typeof path === "string") ||
    !Number.isSafeInteger(verificationCount) ||
    (verificationCount as number) < 0
  )
    return null;
  let providerExecutionObservation = null;
  if (observation) {
    const countKeys = [
      "commandExecutionStartedCount",
      "commandExecutionCompletedCount",
      "commandExecutionFailedCount",
      "commandExecutionDeclinedCount",
      "commandExecutionExitCode0Count",
      "commandExecutionExitCode1Count",
      "commandExecutionExitCode126Count",
      "commandExecutionExitCode127Count",
      "commandExecutionOtherNonzeroExitCodeCount",
      "commandExecutionMissingExitCodeCount",
      "commandFamilyPythonCount",
      "commandFamilyPosixTextCount",
      "commandFamilyGitCount",
      "commandFamilyApplyPatchCount",
      "commandFailurePermissionCount",
      "commandFailureReadOnlyFilesystemCount",
      "commandFailureMissingPathCount",
      "commandFailureCommandNotFoundCount",
      "commandFailureSyntaxCount",
      "commandFailureSandboxCount",
      "commandFailureUnclassifiedCount",
      "fileChangeStartedCount",
      "fileChangeCompletedCount",
      "fileChangeFailedCount",
      "fileChangeDeclinedCount",
    ] as const;
    if (
      observation.transport !== "fixed_cli_jsonl_v0_149_1" ||
      observation.turnCompleted !== true ||
      !countKeys.every(
        (key) =>
          Number.isSafeInteger(observation[key]) &&
          (observation[key] as number) >= 0,
      ) ||
      observation.rawEventReported !== false ||
      observation.commandReported !== false ||
      observation.pathReported !== false ||
      observation.providerTextReported !== false
    )
      return null;
    providerExecutionObservation = Object.freeze({ ...observation });
  }
  return Object.freeze({
    status,
    changedPaths: Object.freeze([...changedPaths.value] as string[]),
    verificationCount: verificationCount as number,
    ...(providerExecutionObservation ? { providerExecutionObservation } : {}),
  });
}

/**
 * Reviewer Projection Evidenceを公開結果へ投影する。
 *
 * @responsibility Reviewer Projection Evidenceの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns projectReviewerProjectionEvidenceの計算結果を返す。
 * @precondition 「value: unknown」がprojectReviewerProjectionEvidenceの入力契約を満たす。
 * @postcondition projectReviewerProjectionEvidenceの責務を完了した結果だけを返す。
 * @effect N/A: projectReviewerProjectionEvidenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectReviewerProjectionEvidenceは独自の失敗分岐を所有しない。
 * @invariant projectReviewerProjectionEvidenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectReviewerProjectionEvidenceはProcess内の同一Subsystemで完結する。
 * @security projectReviewerProjectionEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectReviewerProjectionEvidenceは共有非同期状態を持たない同期処理である。
 */
function projectReviewerProjectionEvidence(value: unknown) {
  const record = snapshotPlainRecord(value, REVIEWER_PROJECTION_KEYS);
  const files = record
    ? snapshotPlainArray<unknown>(record.files, 1_000)
    : null;
  if (
    record?.status !== "projected" ||
    !sha256Value(record.candidatePatchHash) ||
    !sha256Value(record.candidateContentManifestHash) ||
    !sha256Value(record.projectionHash) ||
    !Number.isSafeInteger(record.totalBytes) ||
    (record.totalBytes as number) < 0 ||
    files?.status !== "ok"
  )
    return null;
  const projectedFiles = files.value.map((item) => {
    const file = snapshotPlainRecord(item, REVIEWER_PROJECTION_FILE_KEYS);
    if (
      !file ||
      typeof file.path !== "string" ||
      file.state !== "present" ||
      !Number.isSafeInteger(file.byteLength) ||
      (file.byteLength as number) < 0 ||
      !sha256Value(file.sha256) ||
      file.encoding !== "utf-8" ||
      typeof file.content !== "string"
    )
      return null;
    return Object.freeze({
      path: file.path,
      state: file.state,
      byteLength: file.byteLength,
      sha256: file.sha256,
      encoding: file.encoding,
    });
  });
  if (projectedFiles.some((item) => item === null)) return null;
  return Object.freeze({
    candidatePatchHash: record.candidatePatchHash,
    candidateContentManifestHash: record.candidateContentManifestHash,
    projectionHash: record.projectionHash,
    totalBytes: record.totalBytes,
    files: Object.freeze(projectedFiles),
    contentReported: false,
  });
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
      utilTypes.isProxy(value)
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
 * @input state: RuntimeState、control: ControlRecord
 * @returns requestControlCancellationの計算結果を返す。
 * @precondition 「state: RuntimeState、control: ControlRecord」がrequestControlCancellationの入力契約を満たす。
 * @postcondition requestControlCancellationの責務を完了した結果だけを返す。
 * @effect N/A: requestControlCancellationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requestControlCancellationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requestControlCancellationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requestControlCancellationはProcess内の同一Subsystemで完結する。
 * @security requestControlCancellationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency requestControlCancellationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function requestControlCancellation(
  state: RuntimeState,
  control: ControlRecord,
) {
  if (control.cancellationReceipt) return control.cancellationReceipt;
  control.cancellationRequested = true;
  control.cancellationController.abort();
  const processControl = control.currentProcessControl;
  const receipt = (async () => {
    if (!processControl)
      return Object.freeze({
        status: "requested" as const,
        reason: "provider_cancellation_requested",
        cancellationRequested: true,
        processTerminationObserved: true,
      });
    const observed = await state.dependencies.cancelProcess(
      processControl,
      control.managementCapability,
    );
    const receipt = exactProcessCancellationReceipt(observed);
    if (!receipt)
      throw new Error("coordinator_task_cancellation_receipt_invalid");
    return receipt;
  })();
  control.cancellationReceipt = receipt;
  const isolatedTimeout = state.dependencies.isolatedCancellationAckTimeoutMs;
  const timeoutMs =
    Number.isSafeInteger(isolatedTimeout) && Number(isolatedTimeout) > 0
      ? Number(isolatedTimeout)
      : PRODUCTION_CANCELLATION_ACK_TIMEOUT_MS;
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
            poisonRuntimeProcess(state, control);
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
 * @input result: RuntimeRecord、control: ControlRecord
 * @returns canRunManagedDockerCleanupの計算結果を返す。
 * @precondition 「result: RuntimeRecord、control: ControlRecord」がcanRunManagedDockerCleanupの入力契約を満たす。
 * @postcondition canRunManagedDockerCleanupの責務を完了した結果だけを返す。
 * @effect N/A: canRunManagedDockerCleanupは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure canRunManagedDockerCleanupは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant canRunManagedDockerCleanupは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canRunManagedDockerCleanupはProcess内の同一Subsystemで完結する。
 * @security canRunManagedDockerCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canRunManagedDockerCleanupは共有非同期状態を持たない同期処理である。
 */
function canRunManagedDockerCleanup(
  result: RuntimeRecord,
  control: ControlRecord,
) {
  try {
    const singularDescriptor = Object.getOwnPropertyDescriptor(
      result,
      "dockerRecoveryId",
    );
    const pluralDescriptor = Object.getOwnPropertyDescriptor(
      result,
      "dockerRecoveryIds",
    );
    if (
      !singularDescriptor ||
      !("value" in singularDescriptor) ||
      !pluralDescriptor ||
      !("value" in pluralDescriptor)
    )
      return false;
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
      control.dockerFinalizations.map((finalization) =>
        Object.freeze({
          recoveryId: finalization.recoveryId,
          capability: finalization.capability,
        }),
      ),
    );
    return evaluateManagedDockerCleanupEligibility({
      raw: Object.freeze({
        singularPresent: singularDescriptor !== undefined,
        singular: singularDescriptor?.value,
        pluralPresent: pluralDescriptor !== undefined,
        plural: pluralDescriptor?.value,
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
 * @input state: RuntimeState、control: ControlRecord
 * @returns N/A: poisonRuntimeProcessは戻り値を返さない。
 * @precondition 「state: RuntimeState、control: ControlRecord」がpoisonRuntimeProcessの入力契約を満たす。
 * @postcondition poisonRuntimeProcessの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: poisonRuntimeProcessは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: poisonRuntimeProcessは独自の失敗分岐を所有しない。
 * @invariant poisonRuntimeProcessは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: poisonRuntimeProcessはProcess内の同一Subsystemで完結する。
 * @security poisonRuntimeProcessはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: poisonRuntimeProcessは共有非同期状態を持たない同期処理である。
 */
function poisonRuntimeProcess(state: RuntimeState, control: ControlRecord) {
  control.processPoisoned = true;
  state.dependencies.poisonProcessAfterCleanupUnknown?.();
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
    stringValue(result.hostRecoveryId) ||
      stringValue(result.candidateRecoveryId) ||
      stringValue(result.candidateStoreRecoveryId),
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
        ...(stringValue(result.dockerRecoveryId)
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
    !stringValue(result.dockerRecoveryId);
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
 * selection Requestを決定する。
 *
 * @responsibility selection Requestの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input request: RuntimeRecord、operationId: string、role: "executor" | "independent_reviewer"、subjectProvider: Provider | null、requestedProvider: Provider | null、isRequiresIndependentProvider: boolean
 * @returns selectionRequestの計算結果を返す。
 * @precondition 「request: RuntimeRecord、operationId: string、role: "executor" | "independent_reviewer"、subjectProvider: Provider | null、requestedProvider: Provider | null、isRequiresIndependentProvider: boolean」がselectionRequestの入力契約を満たす。
 * @postcondition selectionRequestの責務を完了した結果だけを返す。
 * @effect N/A: selectionRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectionRequestは独自の失敗分岐を所有しない。
 * @invariant selectionRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectionRequestはProcess内の同一Subsystemで完結する。
 * @security selectionRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: selectionRequestは共有非同期状態を持たない同期処理である。
 */
function selectionRequest(
  request: RuntimeRecord,
  operationId: string,
  role: "executor" | "independent_reviewer",
  subjectProvider: Provider | null,
  requestedProvider: Provider | null,
  isRequiresIndependentProvider: boolean,
) {
  const isIndependentReview = role === "independent_reviewer";
  return Object.freeze({
    frontProvider: request.frontProvider,
    delegationNeed: isIndependentReview ? "required" : "beneficial",
    delegationReason: isIndependentReview
      ? "independent_review_required"
      : "specialized_executor_benefit",
    requestedExecutorProvider: requestedProvider ?? "auto",
    subjectProvider,
    requiresIndependentProvider:
      isIndependentReview && isRequiresIndependentProvider,
    role,
    workClass: isIndependentReview ? "bounded_verification" : request.workClass,
    planState: isIndependentReview ? "complete" : request.planState,
    risk: request.risk,
    difficulty: request.difficulty,
    decisionImpact: request.decisionImpact,
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: isIndependentReview
      ? false
      : request.hasUnresolvedDirection,
    requiresCrossContextAlignment: isIndependentReview
      ? false
      : request.requiresCrossContextAlignment,
    operationId,
    parentOperationId: null,
    ancestorOperationIds: Object.freeze([]),
    delegationDepth: 0,
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
function externalSendScopeRequest(request: RuntimeRecord) {
  return Object.freeze({
    objective: request.objective,
    acceptanceCriteria: request.acceptanceCriteria,
    allowedPaths: request.allowedPaths,
    readPaths: request.readPaths,
  });
}

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
    return "coordinator_task_provider_prepare_failed";
  if (reason.endsWith("_docker_runtime_model_selection_invalid"))
    return "coordinator_task_provider_model_selection_invalid";
  if (reason.endsWith("_docker_runtime_mount_authorization_invalid"))
    return "coordinator_task_provider_mount_authorization_invalid";
  if (reason.endsWith("_docker_runtime_task_packet_invalid"))
    return "coordinator_task_provider_task_packet_invalid";
  if (reason.endsWith("_docker_runtime_plan_invalid"))
    return "coordinator_task_provider_plan_invalid";
  if (reason.endsWith("_docker_runtime_authority_invalid"))
    return "coordinator_task_provider_authority_invalid";
  if (reason.endsWith("_docker_runtime_recovery_correlation_invalid"))
    return "coordinator_task_provider_recovery_correlation_invalid";
  return "coordinator_task_provider_prepare_failed";
}

/**
 * Provider Selectionが同一かを判定する。
 *
 * @responsibility Provider Selectionの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000004
 * @input left: RuntimeRecord、right: RuntimeRecord
 * @returns sameProviderSelectionの計算結果を返す。
 * @precondition 「left: RuntimeRecord、right: RuntimeRecord」がsameProviderSelectionの入力契約を満たす。
 * @postcondition sameProviderSelectionの責務を完了した結果だけを返す。
 * @effect N/A: sameProviderSelectionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameProviderSelectionは独自の失敗分岐を所有しない。
 * @invariant sameProviderSelectionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameProviderSelectionはProcess内の同一Subsystemで完結する。
 * @security sameProviderSelectionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameProviderSelectionは共有非同期状態を持たない同期処理である。
 */
function sameProviderSelection(left: RuntimeRecord, right: RuntimeRecord) {
  return (
    left.executorProvider === right.executorProvider &&
    left.profileId === right.profileId &&
    left.selectedModel === right.selectedModel &&
    left.selectedEffort === right.selectedEffort &&
    left.speedMode === right.speedMode &&
    left.selectionNotice === right.selectionNotice
  );
}

/**
 * Pathsが同一かを判定する。
 *
 * @responsibility Pathsの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000004
 * @input left: unknown、right: unknown
 * @returns samePathsの計算結果を返す。
 * @precondition 「left: unknown、right: unknown」がsamePathsの入力契約を満たす。
 * @postcondition samePathsの責務を完了した結果だけを返す。
 * @effect N/A: samePathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: samePathsは独自の失敗分岐を所有しない。
 * @invariant samePathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: samePathsはProcess内の同一Subsystemで完結する。
 * @security samePathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: samePathsは共有非同期状態を持たない同期処理である。
 */
function samePaths(left: unknown, right: unknown) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const normalize = (values: unknown[]) =>
    values.every((value) => typeof value === "string")
      ? [...(values as string[])].sort((a, b) =>
          Buffer.from(a).compare(Buffer.from(b)),
        )
      : null;
  const normalizedLeftPaths = normalize(left);
  const normalizedRightPaths = normalize(right);
  return (
    normalizedLeftPaths !== null &&
    normalizedRightPaths !== null &&
    normalizedLeftPaths.length === normalizedRightPaths.length &&
    normalizedLeftPaths.every(
      (value, index) => value === normalizedRightPaths[index],
    )
  );
}

/**
 * Stageを実行する。
 *
 * @responsibility Stageの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input args: Parameters<typeof executeStageBody>
 * @returns executeStageの計算結果を返す。
 * @precondition 「args: Parameters<typeof executeStageBody>」がexecuteStageの入力契約を満たす。
 * @postcondition executeStageの責務を完了した結果だけを返す。
 * @effect N/A: executeStageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: executeStageは独自の失敗分岐を所有しない。
 * @invariant executeStageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executeStageはProcess内の同一Subsystemで完結する。
 * @security executeStageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency executeStageは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function executeStage(...args: Parameters<typeof executeStageBody>) {
  const dependencies = args[0].dependencies;
  const invocation = dependencies.beginInvocation?.(args[9], args[6]);
  if (dependencies.beginInvocation && !invocation)
    return blocked("coordinator_task_development_invocation_not_authorized");
  args[12] = invocation?.commandRestriction;
  let result: Awaited<ReturnType<typeof executeStageBody>>;
  let settlement: unknown;
  try {
    result = await executeStageBody(...args);
  } finally {
    settlement = invocation?.settle();
  }
  return settlement === false
    ? blocked("coordinator_task_development_invocation_settlement_invalid")
    : result;
}

/**
 * Stage Bodyを実行する。
 *
 * @responsibility Stage Bodyの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、operation: Operation、request: RuntimeRecord、repositoryBindingCapability: object、externalSendGrantCapability: object、evaluationTime: unknown、role: TaskRole、taskAttempt: 0 | 1、subjectProvider: Provider | null、expectedProvider: Provider、remediationCapability: object | null、control: ControlRecord、commandRestriction: unknown、reviewerReadProjection: RuntimeRecord | null
 * @returns executeStageBodyの計算結果を返す。
 * @precondition 「state: RuntimeState、operation: Operation、request: RuntimeRecord、repositoryBindingCapability: object、externalSendGrantCapability: object、evaluationTime: unknown、role: TaskRole、taskAttempt: 0 | 1、subjectProvider: Provider | null、expectedProvider: Provider、remediationCapability: object | null、control: ControlRecord、commandRestriction: unknown、reviewerReadProjection: RuntimeRecord | null」がexecuteStageBodyの入力契約を満たす。
 * @postcondition executeStageBodyの責務を完了した結果だけを返す。
 * @effect executeStageBodyは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure executeStageBodyは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executeStageBodyは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security executeStageBodyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency executeStageBodyは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function executeStageBody(
  state: RuntimeState,
  operation: Operation,
  request: RuntimeRecord,
  repositoryBindingCapability: object,
  externalSendGrantCapability: object,
  evaluationTime: unknown,
  role: TaskRole,
  taskAttempt: 0 | 1,
  subjectProvider: Provider | null,
  expectedProvider: Provider,
  remediationCapability: object | null,
  control: ControlRecord,
  commandRestriction?: unknown,
  reviewerReadProjection: RuntimeRecord | null = null,
) {
  if (control.cancellationRequested) {
    return blocked("coordinator_task_cancelled_before_stage_start");
  }
  const selectionInput = selectionRequest(
    request,
    operation.operationId,
    role === "executor" ? "executor" : "independent_reviewer",
    subjectProvider,
    role === "executor" &&
      (request.requestedExecutorProvider === "codex" ||
        request.requestedExecutorProvider === "claude")
      ? request.requestedExecutorProvider
      : role === "reviewer" && expectedProvider === subjectProvider
        ? expectedProvider
        : null,
    role === "reviewer" ? expectedProvider !== subjectProvider : false,
  );
  let selection = state.dependencies.issueSelection(
    operation.managementCapability,
    selectionInput,
  );
  const provider =
    selection.executorProvider === "codex" ||
    selection.executorProvider === "claude"
      ? selection.executorProvider
      : null;
  const profileId = stringValue(selection.profileId);
  let selectionControl = objectCapability(selection.controlCapability);
  let startedProcessControl: object | null = null;
  let startedDockerRecoveryId: string | null = null;
  if (
    selection.status !== "issued" ||
    !provider ||
    !profileId ||
    !selectionControl ||
    !objectCapability(selection.useCapability)
  ) {
    return blocked("coordinator_task_selection_failed");
  }
  let mountControl: object | null = null;
  let taskControl: object | null = null;
  const revokeUnconsumed = () => {
    if (taskControl) {
      state.dependencies.revokeTaskPacket(
        taskControl,
        operation.managementCapability,
      );
    }
    if (mountControl) {
      state.dependencies.revokeMountGrant(
        mountControl,
        operation.managementCapability,
      );
    }
    if (selectionControl) {
      state.dependencies.revokeSelection(
        selectionControl,
        operation.managementCapability,
      );
    }
  };
  try {
    if (provider !== expectedProvider) {
      revokeUnconsumed();
      return blocked("coordinator_task_selection_slate_mismatch");
    }
    const first = state.dependencies.observeProviderHome(
      provider,
      evaluationTime,
    );
    const firstObservation = objectCapability(first.observationCapability);
    if (first.status !== "candidate" || !firstObservation) {
      revokeUnconsumed();
      return blocked("coordinator_task_provider_home_observation_failed");
    }
    const mount = state.dependencies.issueMountGrant(
      operation.managementCapability,
      firstObservation,
      profileId,
    );
    mountControl = objectCapability(mount.controlCapability);
    const mountUse = objectCapability(mount.useCapability);
    if (mount.status !== "issued" || !mountControl || !mountUse) {
      revokeUnconsumed();
      return blocked("coordinator_task_mount_grant_issue_failed");
    }
    const second = state.dependencies.observeProviderHome(
      provider,
      evaluationTime,
    );
    const secondObservation = objectCapability(second.observationCapability);
    if (second.status !== "candidate" || !secondObservation) {
      revokeUnconsumed();
      return blocked("coordinator_task_provider_home_reobservation_failed");
    }
    const consumedMount = state.dependencies.consumeMountGrant(
      mountUse,
      operation.managementCapability,
      secondObservation,
    );
    const mountAuthorization = objectCapability(
      consumedMount.mountAuthorizationCapability,
    );
    if (consumedMount.status !== "consumed" || !mountAuthorization) {
      revokeUnconsumed();
      return blocked("coordinator_task_mount_grant_consume_failed");
    }
    mountControl = null;
    const revokedSelection = state.dependencies.revokeSelection(
      selectionControl,
      operation.managementCapability,
    );
    selectionControl = null;
    if (revokedSelection.status !== "revoked") {
      return blocked(
        "coordinator_task_provider_selection_refresh_revoke_failed",
      );
    }
    const refreshedSelection = state.dependencies.issueSelection(
      operation.managementCapability,
      selectionInput,
    );
    const refreshedSelectionControl = objectCapability(
      refreshedSelection.controlCapability,
    );
    const refreshedSelectionUse = objectCapability(
      refreshedSelection.useCapability,
    );
    if (
      refreshedSelection.status !== "issued" ||
      !refreshedSelectionControl ||
      !refreshedSelectionUse
    ) {
      return blocked("coordinator_task_provider_selection_refresh_failed");
    }
    selectionControl = refreshedSelectionControl;
    if (!sameProviderSelection(selection, refreshedSelection)) {
      revokeUnconsumed();
      return blocked("coordinator_task_provider_selection_refresh_mismatch");
    }
    selection = refreshedSelection;
    if (
      !state.dependencies.reportSelectionNotice(
        Object.freeze({
          event: "coordinator_selection_before_provider_effect",
          taskRole: role,
          provider,
          model: selection.selectedModel,
          effort: selection.selectedEffort,
          speedMode: selection.speedMode,
          selectionReason: selection.selectionNotice,
          inputBasis:
            "caller_declared_task_attributes_plus_runtime_owned_preselection_candidate_with_deferred_provider_preflight",
          callerDeclaredAttributes: Object.freeze([
            "workClass",
            "planState",
            "risk",
            "difficulty",
            "decisionImpact",
          ]),
          highCostSelectionAllowed: false,
        }),
      )
    ) {
      revokeUnconsumed();
      return blocked("coordinator_task_selection_notice_unavailable");
    }
    const packet = state.dependencies.issueTaskPacket(
      operation.managementCapability,
      repositoryBindingCapability,
      provider,
      role,
      taskAttempt,
      externalSendGrantCapability,
      remediationCapability,
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
      revokeUnconsumed();
      return blocked("coordinator_task_remediation_recognized_secret_rejected");
    }
    if (packet?.status !== "issued" || !taskControl || !taskUse) {
      revokeUnconsumed();
      return blocked("coordinator_task_packet_issue_failed");
    }
    const prepared = state.dependencies.prepareProvider(
      provider,
      operation.managementCapability,
      operation.mountCapability,
      mountAuthorization,
      refreshedSelectionUse,
      taskUse,
      control.recoveryCorrelationId,
    );
    selectionControl = null;
    taskControl = null;
    const preparedCapability = objectCapability(prepared.preparedCapability);
    if (prepared.status !== "prepared" || !preparedCapability) {
      return blocked(
        prepared.reason === "claude_task_workload_split_required"
          ? "coordinator_task_workload_split_required"
          : projectProviderPreparationFailure(prepared.reason),
      );
    }
    const rawProcess = state.dependencies.startProcess(
      preparedCapability,
      operation.managementCapability,
      (recoveryCapability, recoveryId) => {
        const capability = objectCapability(recoveryCapability);
        const id = publicVerifiedDockerRecoveryId(recoveryId);
        if (
          !capability ||
          !id ||
          control.dockerHandoffs.some(
            (handoff) =>
              handoff.capability === capability || handoff.recoveryId === id,
          )
        )
          return false;
        control.dockerHandoffs.push({
          capability,
          recoveryId: id,
          state: "active",
        });
        return true;
      },
      commandRestriction,
    );
    const isProductionProcessContract =
      state.dependencies.startProcess ===
      startRuntimeOwnedDockerProcessController;
    const process = (
      isProductionProcessContract
        ? projectRuntimeOwnedDockerProcessStartForTask(
            rawProcess,
            control.dockerHandoffs.at(-1)?.recoveryId ?? null,
            operation.operationId,
          )
        : rawProcess
    ) as RuntimeRecord | null;
    if (!process) {
      return blocked(
        "coordinator_task_process_start_contract_invalid",
        true,
        operation.hostRecoveryId,
        control.dockerHandoffs.at(-1)?.recoveryId ?? null,
      );
    }
    const processControl = objectCapability(process.controlCapability);
    const completion = process.completion;
    if (
      process.status !== "started" ||
      !processControl ||
      !(completion instanceof Promise)
    ) {
      const dockerRecoveryId = publicVerifiedDockerRecoveryId(
        process.recoveryId,
      );
      const manualRecoveryRequired =
        process.cleanupConfirmed !== true ||
        process.manualRecoveryRequired === true ||
        dockerRecoveryId !== null;
      return blocked(
        stringValue(process.reason) ?? "coordinator_task_process_start_failed",
        manualRecoveryRequired,
        manualRecoveryRequired ? operation.hostRecoveryId : null,
        dockerRecoveryId,
        null,
        process.cleanupConfirmed === true,
      );
    }
    control.currentProcessControl = processControl;
    startedProcessControl = processControl;
    startedDockerRecoveryId = publicVerifiedDockerRecoveryId(
      process.recoveryId,
    );
    if (control.cancellationRequested) {
      await state.dependencies.cancelProcess(
        processControl,
        operation.managementCapability,
      );
    }
    const rawResult = await completion;
    const result = isProductionProcessContract
      ? projectRuntimeOwnedDockerProcessCompletionForTask(
          rawResult,
          startedDockerRecoveryId,
          operation.operationId,
        )
      : (rawResult as RuntimeRecord);
    control.currentProcessControl = null;
    startedProcessControl = null;
    if (!result) {
      return blocked(
        "coordinator_task_process_completion_contract_invalid",
        true,
        operation.hostRecoveryId,
        startedDockerRecoveryId,
      );
    }
    const finalizationCapability = objectCapability(
      result.recoveryFinalizationCapability,
    );
    const handoff = control.dockerHandoffs.find(
      (candidate) => candidate.recoveryId === startedDockerRecoveryId,
    );
    if (result.cleanupConfirmed === true) {
      if (
        state.dependencies.finalizeDockerRecovery &&
        (!finalizationCapability ||
          !startedDockerRecoveryId ||
          !handoff ||
          handoff.capability !== finalizationCapability)
      ) {
        return blocked(
          "coordinator_task_docker_finalization_capability_missing",
          true,
          operation.hostRecoveryId,
          startedDockerRecoveryId,
        );
      }
      if (finalizationCapability && startedDockerRecoveryId) {
        if (handoff) handoff.state = "finalizable";
        control.dockerFinalizations.push(
          Object.freeze({
            capability: finalizationCapability,
            recoveryId: startedDockerRecoveryId,
          }),
        );
      } else if (!state.dependencies.finalizeDockerRecovery && handoff) {
        handoff.state = "finalized";
      }
    }
    if (control.cancellationRequested) {
      const dockerRecoveryIds = controlDockerRecoveryIds(control);
      return Object.freeze({
        ...blocked("coordinator_task_cancelled_after_provider_cleanup"),
        dockerRecoveryId:
          dockerRecoveryIds.length === 1
            ? (dockerRecoveryIds[0] ?? null)
            : null,
        dockerRecoveryIds,
      });
    }
    if (result.status !== "completed" || result.cleanupConfirmed !== true) {
      const dockerRecoveryId = publicVerifiedDockerRecoveryId(
        result.recoveryId,
      );
      const manualRecoveryRequired =
        result.cleanupConfirmed !== true ||
        result.manualRecoveryRequired === true ||
        dockerRecoveryId !== null;
      const dockerRecoveryIds = controlDockerRecoveryIds(control);
      return Object.freeze({
        ...blocked(
          stringValue(result.reason) ?? "coordinator_task_provider_failed",
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
    return Object.freeze({
      status: "completed" as const,
      provider,
      selectionNotice:
        stringValue(prepared.selectionNotice) ??
        stringValue(selection.selectionNotice),
      normalizedResult: result.normalizedResult,
      providerTurnObservation: projectProviderTurnObservation(
        ownPlainDataValue(result.normalizedResult, "providerTurnObservation"),
      ),
    });
  } catch {
    if (startedProcessControl) {
      try {
        await state.dependencies.cancelProcess(
          startedProcessControl,
          operation.managementCapability,
        );
      } catch {
        // The process state is already unknowable. The result below retains the
        // operation root and requires explicit recovery regardless.
      }
      control.currentProcessControl = null;
      return blocked(
        "coordinator_task_process_completion_unconfirmed",
        true,
        operation.hostRecoveryId,
        startedDockerRecoveryId,
      );
    }
    revokeUnconsumed();
    return blocked("coordinator_task_stage_failed_closed");
  }
}

/**
 * Coordinator Task Coreを実行する。
 *
 * @responsibility Coordinator Task Coreの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、rawRequest: unknown、repositoryRoot: unknown、evaluationTime: unknown、control: ControlRecord
 * @returns runCoordinatorTaskCoreの計算結果を返す。
 * @precondition 「state: RuntimeState、rawRequest: unknown、repositoryRoot: unknown、evaluationTime: unknown、control: ControlRecord」がrunCoordinatorTaskCoreの入力契約を満たす。
 * @postcondition runCoordinatorTaskCoreの責務を完了した結果だけを返す。
 * @effect N/A: runCoordinatorTaskCoreは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runCoordinatorTaskCoreは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runCoordinatorTaskCoreは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runCoordinatorTaskCoreはProcess内の同一Subsystemで完結する。
 * @security runCoordinatorTaskCoreはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runCoordinatorTaskCoreは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function runCoordinatorTaskCore(
  state: RuntimeState,
  rawRequest: unknown,
  repositoryRoot: unknown,
  evaluationTime: unknown,
  control: ControlRecord,
) {
  const blocked = (...args: Parameters<typeof createBlocked>) => {
    const source = createBlocked(...args);
    const dockerRecoveryIds = [
      ...new Set([
        ...source.dockerRecoveryIds,
        ...controlDockerRecoveryIds(control),
      ]),
    ];
    const manualRecoveryRequired =
      source.manualRecoveryRequired === true || dockerRecoveryIds.length > 0;
    return createBlocked(
      String(source.reason),
      manualRecoveryRequired,
      stringValue(source.hostRecoveryId),
      dockerRecoveryIds.length === 1 ? (dockerRecoveryIds[0] ?? null) : null,
      stringValue(source.candidateRecoveryId),
      dockerRecoveryIds.length > 0 ? false : source.cleanupConfirmed === true,
      stringValue(source.candidateStoreRecoveryId),
      dockerRecoveryIds,
    );
  };
  const requestOutcome = snapshotCoordinatorTaskRequest(rawRequest);
  if (
    !requestOutcome ||
    typeof repositoryRoot !== "string" ||
    !repositoryRoot
  ) {
    return blocked("coordinator_task_request_invalid");
  }
  if (requestOutcome.status === "blocked") {
    return blocked(requestOutcome.reason);
  }
  const request = requestOutcome.request;
  const repositoryPreflight =
    state.dependencies.inspectRepository(repositoryRoot);
  if (repositoryPreflight?.status !== "candidate") {
    return blocked("coordinator_task_repository_preflight_failed");
  }
  if (repositoryPreflight.runtimeSupported !== true) {
    return blocked("coordinator_task_git_object_format_unsupported");
  }
  let dockerRecoveryState: unknown;
  try {
    dockerRecoveryState = state.dependencies.prepareDockerRecoveryState();
  } catch {
    dockerRecoveryState = null;
  }
  const admission = projectDockerRecoveryAdmission(dockerRecoveryState);
  if (admission.status !== "completed") {
    return blocked(
      admission.reason,
      true,
      null,
      admission.dockerRecoveryId,
      null,
      false,
      null,
      admission.dockerRecoveryIds,
    );
  }
  advanceLifecycleState(state, control, "STATE-OPERATION-ACQUIRING");
  let operation: Operation | null = null;
  let shouldRetainOperationRoot = false;
  try {
    operation = await state.dependencies.createOperation();
    control.ownedOperation = operation.owned;
    control.managementCapability = operation.managementCapability;
    control.hostRecoveryId = operation.hostRecoveryId;
    advanceLifecycleState(state, control, "STATE-OPERATION-READY");
    if (
      operation.hostGenerationFailureDetected &&
      operation.hostGenerationLoss
    ) {
      control.hostGenerationLoss = operation.hostGenerationLoss;
      control.hostGenerationFailureHandling =
        operation.hostGenerationFailureDetected.then(async () => {
          control.hostGenerationFailureObserved = true;
          const processControl = control.currentProcessControl;
          try {
            const cancellationResult = await requestControlCancellation(
              state,
              control,
            );
            if (processControl) {
              if (cancellationResult.processTerminationObserved !== true) {
                control.hostGenerationLossOutcome = "cleanup_unknown";
                poisonRuntimeProcess(state, control);
              }
            }
          } catch {
            control.hostGenerationLossOutcome = "cleanup_unknown";
            poisonRuntimeProcess(state, control);
          }
        });
      control.releaseHostGenerationDrain =
        operation.releaseHostGenerationDrain ?? null;
      control.hostGenerationLossHandling = operation.hostGenerationLoss.then(
        async (outcome) => {
          if (control.hostGenerationLossOutcome !== "cleanup_unknown")
            control.hostGenerationLossOutcome = outcome;
          if (control.hostGenerationFailureHandling)
            await control.hostGenerationFailureHandling;
        },
      );
    }
    if (control.cancellationRequested) {
      return blocked("coordinator_task_cancelled_during_operation_creation");
    }
    const repository = state.dependencies.bindRepository(
      operation.managementCapability,
      repositoryRoot,
    );
    const repositoryBinding = objectCapability(
      repository?.repositoryBindingCapability,
    );
    if (repository?.repositoryBound !== true || !repositoryBinding) {
      return blocked("coordinator_task_repository_binding_failed");
    }
    const externalSendPolicy = state.dependencies.resolveExternalSendPolicy(
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
    if (
      externalSendPolicy.candidatePersistenceAllowed !== true ||
      !Number.isSafeInteger(externalSendPolicy.candidateRetentionHours) ||
      externalSendPolicy.candidatePhysicalDeletion !==
        "next_safe_runtime_entry_after_expiry_or_explicit_discard"
    ) {
      return blocked("coordinator_task_candidate_persistence_not_authorized");
    }
    const candidatePersistencePolicy = Object.freeze({
      candidatePersistenceAllowed:
        externalSendPolicy.candidatePersistenceAllowed === true,
      candidateRetentionHours: externalSendPolicy.candidateRetentionHours,
      informationClassification: externalSendPolicy.informationClassification,
      candidatePhysicalDeletion: externalSendPolicy.candidatePhysicalDeletion,
    });
    const slate = state.dependencies.preflightSlate(
      operation.managementCapability,
      selectionRequest(
        request,
        operation.operationId,
        "executor",
        null,
        request.requestedExecutorProvider === "codex" ||
          request.requestedExecutorProvider === "claude"
          ? request.requestedExecutorProvider
          : null,
        false,
      ),
    );
    const slateExecutorProvider =
      slate.executorProvider === "codex" || slate.executorProvider === "claude"
        ? slate.executorProvider
        : null;
    const slateReviewerProvider =
      slate.reviewerProvider === "codex" || slate.reviewerProvider === "claude"
        ? slate.reviewerProvider
        : null;
    const reviewerIndependence =
      slate.reviewerIndependence === "provider_independent" ||
      slate.reviewerIndependence === "execution_context_independent"
        ? slate.reviewerIndependence
        : null;
    if (
      slate.status !== "candidate" ||
      !slateExecutorProvider ||
      !slateReviewerProvider ||
      !reviewerIndependence ||
      ((request.requestedExecutorProvider === "codex" ||
        request.requestedExecutorProvider === "claude") &&
        slateExecutorProvider !== request.requestedExecutorProvider) ||
      slate.providerEffectAllowed !== false
    ) {
      return blocked("coordinator_task_execution_slate_unavailable");
    }
    const slateProviders: readonly Provider[] = Object.freeze(
      slateExecutorProvider === slateReviewerProvider
        ? [slateExecutorProvider]
        : [slateExecutorProvider, slateReviewerProvider],
    );
    const candidateStore = state.dependencies.prepareCandidateStore();
    if (candidateStore.status !== "completed") {
      return blocked(
        "coordinator_task_candidate_store_unavailable",
        candidateStore.manualRecoveryRequired === true,
        null,
        null,
        stringValue(candidateStore.candidateRecoveryId),
        null,
        stringValue(candidateStore.candidateStoreRecoveryId),
      );
    }
    const externalSendGrant = await state.dependencies.authorizeExternalSend(
      operation.managementCapability,
      repositoryBinding,
      externalSendPolicyCapability,
      externalSendScopeRequest(request),
      slateProviders,
      control.cancellationController.signal,
    );
    if (control.cancellationRequested) {
      return blocked(
        "coordinator_task_cancelled_during_external_send_authorization",
      );
    }
    const externalSendGrantCapability = objectCapability(
      externalSendGrant?.capability,
    );
    if (
      externalSendGrant?.status !== "issued" ||
      !externalSendGrantCapability
    ) {
      const grantReason = stringValue(externalSendGrant?.reason);
      const reason =
        grantReason && EXTERNAL_SEND_CONFIRMATION_REASONS.has(grantReason)
          ? `coordinator_task_${grantReason}`
          : "coordinator_task_external_send_not_authorized";
      const manualRecoveryRequired =
        externalSendGrant?.manualRecoveryRequired === true;
      return blocked(reason, manualRecoveryRequired, null);
    }
    const externalSendAuthorizationMode = externalSendGrant.authorizationMode;
    if (
      externalSendAuthorizationMode !== "interactive_initial_consent" &&
      externalSendAuthorizationMode !== "reused_initial_consent"
    ) {
      return blocked(
        "coordinator_task_external_send_authorization_mode_invalid",
      );
    }
    const externalSendNotice = Object.freeze({
      event: "coordinator_external_send_authorized",
      authorizationMode: externalSendAuthorizationMode,
      providers: slateProviders,
      message:
        externalSendAuthorizationMode === "reused_initial_consent"
          ? "既存の送信許可の範囲内で続行します。追加の承認入力は不要です。"
          : "今回確認した送信許可の範囲内で続行します。",
    });
    let isNoticeReported = false;
    try {
      isNoticeReported =
        state.dependencies.reportExternalSendNotice(externalSendNotice) ===
        true;
    } catch {
      isNoticeReported = false;
    }
    if (!isNoticeReported) {
      return blocked("coordinator_task_external_send_notice_unavailable");
    }
    if (control.cancellationRequested) {
      return blocked(
        "coordinator_task_cancelled_during_external_send_authorization",
      );
    }
    const candidateNotIssued = (result: RuntimeRecord) =>
      Object.freeze({
        ...result,
        externalSendAuthorizationMode,
        candidateDisposition: "not_issued" as const,
      });
    const workspace = state.dependencies.materializeWorkspace(
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
      request.readPaths as readonly string[],
    );
    const workspaceCapability = objectCapability(
      workspace?.workspaceCapability,
    );
    if (workspace?.status !== "materialized" || !workspaceCapability) {
      return candidateNotIssued(
        blocked(
          workspace?.reason ===
            "repository_read_projection_recognized_secret_rejected"
            ? "coordinator_task_read_projection_recognized_secret_rejected"
            : "coordinator_task_workspace_materialization_failed",
        ),
      );
    }
    advanceLifecycleState(state, control, "STATE-TASK-AUTHORIZED");
    const executor = await executeStage(
      state,
      operation,
      request,
      repositoryBinding,
      externalSendGrantCapability,
      evaluationTime,
      "executor",
      0,
      null,
      slateExecutorProvider,
      null,
      control,
    );
    if (executor.status !== "completed") {
      shouldRetainOperationRoot = executor.manualRecoveryRequired === true;
      return candidateNotIssued(executor);
    }
    advanceLifecycleState(state, control, "STATE-EXECUTOR-CLEAN");
    if (control.cancellationRequested) {
      return candidateNotIssued(
        blocked("coordinator_task_cancelled_before_candidate_capture"),
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
    let candidate = state.dependencies.captureCandidate(
      workspaceCapability,
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
      request.allowedPaths as readonly string[],
    );
    let candidateCapability = objectCapability(candidate?.candidateCapability);
    if (
      candidate?.status !== "candidate" ||
      !candidateCapability ||
      executorResult?.status !== "completed" ||
      !samePaths(executorResult.changedPaths, candidate.changedPaths)
    ) {
      return candidateNotIssued(
        blocked(
          candidate?.reason === "candidate_recognized_secret_rejected"
            ? "coordinator_task_candidate_recognized_secret_rejected"
            : "coordinator_task_candidate_revision_invalid",
        ),
      );
    }
    advanceLifecycleState(state, control, "STATE-CANDIDATE-CAPTURED");
    if (control.cancellationRequested) {
      return candidateNotIssued(
        blocked("coordinator_task_cancelled_before_independent_review"),
      );
    }
    const reviewerReadProjection = state.dependencies.projectReviewerReadContent
      ? state.dependencies.projectReviewerReadContent(
          workspaceCapability,
          candidateCapability,
          repositoryBinding,
          operation.managementCapability,
          operation.mountCapability,
          request.readPaths as readonly string[],
        )
      : null;
    if (
      state.dependencies.projectReviewerReadContent &&
      reviewerReadProjection?.status !== "projected"
    ) {
      return candidateNotIssued(
        blocked("coordinator_task_reviewer_read_projection_failed"),
      );
    }
    let reviewer = await executeStage(
      state,
      operation,
      request,
      repositoryBinding,
      externalSendGrantCapability,
      evaluationTime,
      "reviewer",
      0,
      executor.provider as Provider,
      slateReviewerProvider,
      null,
      control,
      undefined,
      reviewerReadProjection,
    );
    if (reviewer.status !== "completed") {
      shouldRetainOperationRoot = reviewer.manualRecoveryRequired === true;
      return candidateNotIssued(reviewer);
    }
    advanceLifecycleState(state, control, "STATE-REVIEWER-CLEAN");
    let reviewerResult = reviewer.normalizedResult as RuntimeRecord;
    let finalReviewerReadProjection = reviewerReadProjection;
    retainTurnObservation(reviewer, 0);
    let remediationPerformed = false;
    if (reviewerResult?.decision === "changes_requested") {
      advanceLifecycleState(state, control, "STATE-REMEDIATION-AUTHORIZED");
      const remediationCapability = objectCapability(
        reviewerResult.remediationCapability,
      );
      if (!remediationCapability || reviewerResult.findingCount === 0) {
        return candidateNotIssued(
          blocked("coordinator_task_review_remediation_invalid"),
        );
      }
      const remediation = await executeStage(
        state,
        operation,
        request,
        repositoryBinding,
        externalSendGrantCapability,
        evaluationTime,
        "executor",
        1,
        null,
        executor.provider as Provider,
        remediationCapability,
        control,
      );
      if (remediation.status !== "completed") {
        shouldRetainOperationRoot = remediation.manualRecoveryRequired === true;
        return candidateNotIssued(remediation);
      }
      advanceLifecycleState(state, control, "STATE-REMEDIATION-EXECUTOR-CLEAN");
      remediationPerformed = true;
      finalExecutor = remediation;
      executorResult = remediation.normalizedResult as RuntimeRecord;
      retainTurnObservation(remediation, 1);
      candidate = state.dependencies.captureCandidate(
        workspaceCapability,
        repositoryBinding,
        operation.managementCapability,
        operation.mountCapability,
        request.allowedPaths as readonly string[],
      );
      candidateCapability = objectCapability(candidate?.candidateCapability);
      if (
        candidate?.status !== "candidate" ||
        !candidateCapability ||
        executorResult?.status !== "completed" ||
        !samePaths(executorResult.changedPaths, candidate.changedPaths)
      ) {
        return candidateNotIssued(
          blocked(
            candidate?.reason === "candidate_recognized_secret_rejected"
              ? "coordinator_task_candidate_recognized_secret_rejected"
              : "coordinator_task_remediated_candidate_invalid",
          ),
        );
      }
      advanceLifecycleState(
        state,
        control,
        "STATE-REMEDIATION-CANDIDATE-CAPTURED",
      );
      const remediationReviewerReadProjection = state.dependencies
        .projectReviewerReadContent
        ? state.dependencies.projectReviewerReadContent(
            workspaceCapability,
            candidateCapability,
            repositoryBinding,
            operation.managementCapability,
            operation.mountCapability,
            request.readPaths as readonly string[],
          )
        : null;
      if (
        state.dependencies.projectReviewerReadContent &&
        remediationReviewerReadProjection?.status !== "projected"
      ) {
        return candidateNotIssued(
          blocked("coordinator_task_reviewer_read_projection_failed"),
        );
      }
      reviewer = await executeStage(
        state,
        operation,
        request,
        repositoryBinding,
        externalSendGrantCapability,
        evaluationTime,
        "reviewer",
        1,
        executor.provider as Provider,
        reviewer.provider as Provider,
        null,
        control,
        undefined,
        remediationReviewerReadProjection,
      );
      if (reviewer.status !== "completed") {
        shouldRetainOperationRoot = reviewer.manualRecoveryRequired === true;
        return candidateNotIssued(reviewer);
      }
      advanceLifecycleState(state, control, "STATE-REMEDIATION-REVIEWER-CLEAN");
      reviewerResult = reviewer.normalizedResult as RuntimeRecord;
      finalReviewerReadProjection = remediationReviewerReadProjection;
      retainTurnObservation(reviewer, 1);
    }
    const verified = state.dependencies.verifyCandidate(
      candidateCapability,
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
    );
    if (verified?.status !== "verified") {
      return Object.freeze({
        ...blocked("coordinator_task_candidate_verification_failed"),
        externalSendAuthorizationMode,
        candidateDisposition: "not_issued" as const,
      });
    }
    if (
      reviewerResult?.decision !== "approved" ||
      reviewerResult.findingCount !== 0
    ) {
      const executorDiagnostics =
        projectExecutorResultDiagnostics(executorResult);
      const reviewerDiagnostics =
        projectReviewerResultDiagnostics(reviewerResult);
      const reviewerProjectionEvidence = projectReviewerProjectionEvidence(
        finalReviewerReadProjection,
      );
      return Object.freeze({
        ...blocked("coordinator_task_independent_review_not_approved"),
        externalSendAuthorizationMode,
        candidateDisposition: "not_issued" as const,
        executorProvider: executor.provider,
        reviewerProvider: reviewer.provider,
        remediationPerformed,
        candidateRevision: Object.freeze({
          baseCommit: verified.baseCommit,
          baseTree: verified.baseTree,
          patchHash: verified.patchHash,
          contentManifestHash: verified.contentManifestHash,
          allowedPathsHash: verified.allowedPathsHash,
          changedPaths: verified.changedPaths,
        }),
        executorResult: executorDiagnostics,
        reviewerResult: reviewerDiagnostics,
        reviewerProjectionEvidence,
      });
    }
    const persisted = state.dependencies.persistCandidate(
      candidateCapability,
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
      candidatePersistencePolicy,
    );
    const candidateRecoveryId = stringValue(persisted?.candidateRecoveryId);
    const candidateStoreRecoveryId = stringValue(
      persisted?.candidateStoreRecoveryId,
    );
    if (persisted?.status !== "staged" || !candidateRecoveryId) {
      return blocked(
        "coordinator_task_candidate_persistence_failed",
        persisted?.manualRecoveryRequired === true ||
          candidateRecoveryId !== null ||
          candidateStoreRecoveryId !== null,
        null,
        null,
        candidateRecoveryId,
        null,
        candidateStoreRecoveryId,
      );
    }
    advanceLifecycleState(state, control, "STATE-CANDIDATE-STAGED");
    return Object.freeze({
      status: "completed" as const,
      reason: "coordinator_task_candidate_approved",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      hostRecoveryId: null,
      dockerRecoveryId:
        controlDockerRecoveryIds(control).length === 1
          ? (controlDockerRecoveryIds(control)[0] ?? null)
          : null,
      dockerRecoveryIds: controlDockerRecoveryIds(control),
      executorProvider: executor.provider,
      reviewerProvider: reviewer.provider,
      reviewerIndependence,
      externalSendAuthorizationMode,
      executorSelectionNotice: finalExecutor.selectionNotice,
      reviewerSelectionNotice: reviewer.selectionNotice,
      remediationPerformed,
      providerTurnObservations: Object.freeze([...providerTurnObservations]),
      candidateRevision: Object.freeze({
        baseCommit: verified.baseCommit,
        baseTree: verified.baseTree,
        patchHash: verified.patchHash,
        contentManifestHash: verified.contentManifestHash,
        allowedPathsHash: verified.allowedPathsHash,
        changedPaths: verified.changedPaths,
      }),
      candidateId: null,
      candidateRecoveryId,
      candidateStoreRecoveryId: null,
      executorResult: projectExecutorResultDiagnostics(executorResult),
      reviewerResult: Object.freeze({
        decision: reviewerResult.decision,
        findingCount:
          typeof reviewerResult.findingCount === "number"
            ? reviewerResult.findingCount
            : 0,
        findingDiagnostics: Object.freeze([]),
      }),
      canonicalRepositoryChanged: false,
      rawOutputReported: false,
      hostPathReported: false,
      untrustedProviderTextReported: false,
      credentialAbsenceVerified: false,
    });
  } catch (error) {
    const creationFailure =
      state.dependencies.classifyOperationCreationFailure(error);
    if (creationFailure) {
      shouldRetainOperationRoot = !creationFailure.cleanupConfirmed;
      return blocked(
        creationFailure.reason,
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
 * @input state: RuntimeState、rawRequest: unknown、repositoryRoot: unknown、evaluationTime: unknown、control: ControlRecord
 * @returns Promise<InternalTaskOutcome>を返す。
 * @precondition 「state: RuntimeState、rawRequest: unknown、repositoryRoot: unknown、evaluationTime: unknown、control: ControlRecord」がrunCoordinatorTaskの入力契約を満たす。
 * @postcondition runCoordinatorTaskの責務を完了した結果だけを返す。
 * @effect N/A: runCoordinatorTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runCoordinatorTaskは独自の失敗分岐を所有しない。
 * @invariant runCoordinatorTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runCoordinatorTaskはProcess内の同一Subsystemで完結する。
 * @security runCoordinatorTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runCoordinatorTaskは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function runCoordinatorTask(
  state: RuntimeState,
  rawRequest: unknown,
  repositoryRoot: unknown,
  evaluationTime: unknown,
  control: ControlRecord,
): Promise<InternalTaskOutcome> {
  const rawResult = await runCoordinatorTaskCore(
    state,
    rawRequest,
    repositoryRoot,
    evaluationTime,
    control,
  );
  const snapshot = snapshotRuntimeRecord(rawResult);
  if (!snapshot)
    return Object.freeze({
      [INTERNAL_TASK_OUTCOME]: true as const,
      publicResult: blocked(
        "coordinator_task_result_observation_invalid",
        true,
        control.hostRecoveryId,
        null,
        null,
        false,
        null,
        controlDockerRecoveryIds(control),
      ),
      dockerCleanupEligible: false,
    });
  const dockerCleanupEligible = canRunManagedDockerCleanup(snapshot, control);
  const singularDescriptor = Object.getOwnPropertyDescriptor(
    snapshot,
    "dockerRecoveryId",
  );
  const pluralDescriptor = Object.getOwnPropertyDescriptor(
    snapshot,
    "dockerRecoveryIds",
  );
  const plural = pluralDescriptor
    ? snapshotPlainArray<unknown>(pluralDescriptor.value, 128)
    : null;
  const isProjectionInvalid =
    !singularDescriptor ||
    !("value" in singularDescriptor) ||
    (singularDescriptor.value !== null &&
      !publicVerifiedDockerRecoveryId(singularDescriptor.value)) ||
    !pluralDescriptor ||
    !("value" in pluralDescriptor) ||
    plural?.status !== "ok" ||
    plural.value.some((value) => !publicVerifiedDockerRecoveryId(value)) ||
    new Set(plural.value).size !== plural.value.length;
  const observedIds = Object.freeze([
    ...new Set([
      ...(plural?.status === "ok"
        ? plural.value.filter(
            (value): value is string =>
              publicVerifiedDockerRecoveryId(value) !== null,
          )
        : []),
      ...(singularDescriptor &&
      "value" in singularDescriptor &&
      publicVerifiedDockerRecoveryId(singularDescriptor.value)
        ? [publicVerifiedDockerRecoveryId(singularDescriptor.value) as string]
        : []),
    ]),
  ]);
  const ids = Object.freeze([
    ...new Set([...observedIds, ...controlDockerRecoveryIds(control)]),
  ]);
  const publicResult = isProjectionInvalid
    ? blocked(
        "coordinator_task_docker_recovery_projection_invalid",
        true,
        control.hostRecoveryId,
        null,
        stringValue(snapshot.candidateRecoveryId),
        false,
        stringValue(snapshot.candidateStoreRecoveryId),
        ids,
      )
    : Object.freeze({
        ...snapshot,
        dockerRecoveryId: ids.length === 1 ? (ids[0] ?? null) : null,
        dockerRecoveryIds: ids,
      });
  return Object.freeze({
    [INTERNAL_TASK_OUTCOME]: true as const,
    publicResult,
    dockerCleanupEligible:
      dockerCleanupEligible === true && isProjectionInvalid === false,
  });
}

/**
 * Production Operationを構築する。
 *
 * @responsibility Production Operationの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns createProductionOperationの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateProductionOperationの入力契約を満たす。
 * @postcondition createProductionOperationの責務を完了した結果だけを返す。
 * @effect N/A: createProductionOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createProductionOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createProductionOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createProductionOperationはProcess内の同一Subsystemで完結する。
 * @security createProductionOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency createProductionOperationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function createProductionOperation() {
  const operation = createProductionOperationRoot(
    createRuntimeOwnedCoordinatorOperation,
    poisonRuntimeProcessAfterCleanupUnknown,
  );
  const {
    owned,
    mountCapability,
    managementCapability,
    operationId,
    hostRecoveryId,
  } = operation;
  let failureReason = "coordinator_task_operation_creation_failed";
  try {
    const activation =
      await activateOwnedHostOperationGenerationLock(managementCapability);
    if (activation !== "activated") {
      failureReason =
        activation === "cleanup_unknown"
          ? "coordinator_task_host_generation_lock_cleanup_unknown_process_restart_required"
          : activation === "cleanup_confirmed_failure"
            ? "coordinator_task_host_generation_lock_start_failed_cleanup_confirmed"
            : "coordinator_task_host_generation_lock_unavailable";
      throw new Error(
        "coordinator_task_host_generation_lock_activation_failed",
      );
    }
    const readiness =
      await confirmOwnedHostOperationGenerationLockReadiness(
        managementCapability,
      );
    if (readiness !== "ready") {
      failureReason =
        readiness === "cleanup_unknown"
          ? "coordinator_task_host_generation_lock_cleanup_unknown_process_restart_required"
          : "coordinator_task_host_generation_lock_not_ready_cleanup_confirmed";
      throw new Error("coordinator_task_host_generation_lock_not_ready");
    }
    const hostGenerationLoss =
      observeOwnedHostOperationGenerationLoss(managementCapability);
    return Object.freeze({
      owned,
      mountCapability,
      managementCapability,
      operationId,
      hostRecoveryId,
      hostGenerationFailureDetected: hostGenerationLoss.detected,
      hostGenerationLoss: hostGenerationLoss.outcome,
      releaseHostGenerationDrain: hostGenerationLoss.releaseDrain,
    });
  } catch {
    let cleanupConfirmed = false;
    let manualRecoveryRequired = false;
    try {
      const cleanup = verifyOwnedOperationCleanupOutcome(
        await cleanupOwnedOperationDirectoriesAsync(owned),
      );
      if (!cleanup)
        throw new Error("owned_operation_cleanup_outcome_unverified");
      cleanupConfirmed = true;
      if (cleanup === "protocol_failure_cleanup_confirmed")
        failureReason =
          "coordinator_task_host_generation_lock_protocol_failed_cleanup_confirmed";
    } catch {
      manualRecoveryRequired = true;
      poisonRuntimeProcessAfterCleanupUnknown();
      failureReason =
        "coordinator_task_host_generation_lock_cleanup_unknown_process_restart_required";
    }
    throwProductionOperationFailure(
      Object.freeze({
        reason: failureReason,
        hostRecoveryId,
        cleanupConfirmed,
        manualRecoveryRequired,
      }),
    );
  }
}

const productionDependencies: RuntimeDependencies = Object.freeze({
  inspectRepository: inspectRepositoryObjectFormatCandidate,
  createOperation: createProductionOperation,
  classifyOperationCreationFailure: productionOperationFailure,
  cleanupOperation: cleanupOwnedOperationDirectoriesAsync,
  classifyOperationCleanup: verifyOwnedOperationCleanupOutcome,
  abandonOperation: abandonOwnedHostOperationGenerationLock,
  poisonProcessAfterCleanupUnknown: poisonRuntimeProcessAfterCleanupUnknown,
  isProcessPoisoned: isRuntimeProcessPoisoned,
  bindRepository: bindRuntimeOwnedRepositoryOperation,
  materializeWorkspace: materializeRuntimeOwnedRepositoryWorkspace,
  projectReviewerReadContent: projectRuntimeOwnedCandidateReadContent,
  issueSelection: issueRuntimeOwnedDelegationSelectionGrant,
  preflightSlate: preflightRuntimeOwnedDelegationExecutionSlate,
  revokeSelection: revokeRuntimeOwnedDelegationSelectionGrant,
  observeProviderHome: inspectRuntimeOwnedWindowsProviderHomeCandidate,
  issueMountGrant: issueRuntimeOwnedProviderHomeMountGrant,
  consumeMountGrant: consumeRuntimeOwnedProviderHomeMountGrant,
  revokeMountGrant: revokeRuntimeOwnedProviderHomeMountGrant,
  authorizeExternalSend: requestRuntimeOwnedExternalSendGrant,
  resolveExternalSendPolicy: resolveRuntimeOwnedExternalSendPolicy,
  prepareCandidateStore: runRuntimeOwnedCandidateStoreStartupGc,
  prepareDockerRecoveryState: inspectRuntimeOwnedDockerTaskRecoveryState,
  reportSelectionNotice: (notice) => {
    try {
      process.stderr.write(
        `[Coordinator selection] ${JSON.stringify(notice)}\n`,
      );
      return true;
    } catch {
      return false;
    }
  },
  reportExternalSendNotice: (notice) => {
    try {
      process.stderr.write(
        `[Coordinator authorization] ${JSON.stringify(notice)}\n`,
      );
      return true;
    } catch {
      return false;
    }
  },
  issueTaskPacket: issueRuntimeOwnedProviderTaskPacket,
  revokeTaskPacket: revokeRuntimeOwnedProviderTaskPacket,
  prepareProvider: (
    provider,
    managementCapability,
    mountCapability,
    mountAuthorizationCapability,
    selectionUseCapability,
    taskPacketUseCapability,
    recoveryCorrelationId,
  ) =>
    provider === "codex"
      ? prepareRuntimeOwnedCodexDockerTaskCandidate(
          managementCapability,
          mountCapability,
          mountAuthorizationCapability,
          selectionUseCapability,
          taskPacketUseCapability,
          recoveryCorrelationId,
        )
      : prepareRuntimeOwnedClaudeDockerTaskCandidate(
          managementCapability,
          mountCapability,
          mountAuthorizationCapability,
          selectionUseCapability,
          taskPacketUseCapability,
          recoveryCorrelationId,
        ),
  startProcess: startRuntimeOwnedDockerProcessController,
  cancelProcess: cancelRuntimeOwnedDockerProcessController,
  captureCandidate: captureRuntimeOwnedCandidateRevision,
  verifyCandidate: verifyRuntimeOwnedCandidateRevision,
  persistCandidate: persistRuntimeOwnedCandidateRevision,
  discardCandidate: discardRuntimeOwnedCandidateBundle,
  publishCandidate: publishRuntimeOwnedCandidateBundle,
  finalizeDockerRecovery: finalizeRuntimeOwnedDockerRecovery,
  prepareDockerHostCleanup: prepareRuntimeOwnedDockerHostCleanup,
  recordDockerHostCleanupReceipt: recordRuntimeOwnedDockerHostCleanupReceipt,
  abandonDockerRecovery: abandonRuntimeOwnedDockerRecovery,
});

/**
 * retain Runtime 回復 状態を決定する。
 *
 * @responsibility retain Runtime 回復 状態の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、control: ControlRecord
 * @returns N/A: retainRuntimeRecoveryStateは戻り値を返さない。
 * @precondition 「state: RuntimeState、control: ControlRecord」がretainRuntimeRecoveryStateの入力契約を満たす。
 * @postcondition retainRuntimeRecoveryStateの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: retainRuntimeRecoveryStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: retainRuntimeRecoveryStateは独自の失敗分岐を所有しない。
 * @invariant retainRuntimeRecoveryStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: retainRuntimeRecoveryStateはProcess内の同一Subsystemで完結する。
 * @security retainRuntimeRecoveryStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency retainRuntimeRecoveryStateは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function retainRuntimeRecoveryState(
  state: RuntimeState,
  control: ControlRecord,
) {
  control.retainOperationRoot = !control.hostCleanupCompleted;
  for (const handoff of control.dockerHandoffs) {
    if (handoff.state === "finalized" || handoff.state === "abandoned")
      continue;
    if (state.dependencies.abandonDockerRecovery?.(handoff.capability) === true)
      handoff.state = "abandoned";
  }
  if (!control.hostCleanupCompleted)
    await state.dependencies.abandonOperation(control.managementCapability);
}

/**
 * Runtimeを構築する。
 *
 * @responsibility Runtimeの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: RuntimeDependencies
 * @returns createRuntimeの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateRuntimeの入力契約を満たす。
 * @postcondition createRuntimeの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRuntimeはProcess内の同一Subsystemで完結する。
 * @security createRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency createRuntimeは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function createRuntime(dependencies: RuntimeDependencies) {
  const state: RuntimeState = Object.freeze({
    dependencies: Object.freeze(dependencies),
    controls: new WeakMap(),
  });
  return Object.freeze({
    start: (
      rawRequest: unknown,
      repositoryRoot: unknown,
      evaluationTime: unknown,
      recoveryCorrelationId: unknown = null,
    ) => {
      if (
        recoveryCorrelationId !== null &&
        (typeof recoveryCorrelationId !== "string" ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(recoveryCorrelationId))
      )
        throw new Error("coordinator_task_recovery_correlation_invalid");
      const controlCapability = Object.freeze({});
      const control: ControlRecord = {
        lifecycleState: "STATE-ADMISSION",
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
        hostGenerationLossOutcome: null,
        hostGenerationLoss: null,
        hostGenerationLossHandling: null,
        hostGenerationFailureHandling: null,
        hostGenerationFailureObserved: false,
        releaseHostGenerationDrain: null,
        dockerFinalizations: [],
        dockerHandoffs: [],
        recoveryCorrelationId,
      };
      try {
        state.dependencies.observeLifecycleState?.("STATE-ADMISSION");
      } catch {
        // Passive observation must not gain control over Runtime admission.
      }
      state.controls.set(controlCapability, control);
      const completion: Promise<TaskCompletionRecord> = runCoordinatorTask(
        state,
        rawRequest,
        repositoryRoot,
        evaluationTime,
        control,
      )
        .then(async (outcome) => {
          if (outcome[INTERNAL_TASK_OUTCOME] !== true)
            throw new Error("coordinator_task_internal_outcome_invalid");
          const rawResultRecord = snapshotRuntimeRecord(outcome.publicResult);
          if (!rawResultRecord) {
            await retainRuntimeRecoveryState(state, control);
            return blocked(
              "coordinator_task_result_observation_invalid",
              true,
              control.hostRecoveryId,
              null,
              null,
              false,
              null,
              controlDockerRecoveryIds(control),
            );
          }
          const cleanupProjectionEligible = outcome.dockerCleanupEligible;
          const observedDockerRecoveryIds = snapshotPlainArray<string>(
            rawResultRecord.dockerRecoveryIds,
            128,
          );
          const projectedDockerRecoveryIds = Object.freeze(
            observedDockerRecoveryIds.status === "ok"
              ? [...observedDockerRecoveryIds.value]
              : [...controlDockerRecoveryIds(control)],
          );
          let result: RuntimeRecord = Object.freeze({
            ...rawResultRecord,
            dockerRecoveryId:
              projectedDockerRecoveryIds.length === 1
                ? projectedDockerRecoveryIds[0]
                : null,
            dockerRecoveryIds: projectedDockerRecoveryIds,
          });
          const settleObservedHostLoss = async () => {
            if (
              !control.hostGenerationFailureObserved ||
              !control.hostGenerationLossHandling
            )
              return null;
            await control.hostGenerationLossHandling;
            return control.hostGenerationLossOutcome;
          };
          if ((await settleObservedHostLoss()) !== null) {
            if (control.hostGenerationLossOutcome === "cleanup_unknown") {
              result = blocked(
                "coordinator_task_host_generation_lost_cleanup_unknown_process_restart_required",
                true,
                control.hostRecoveryId,
                stringValue(result.dockerRecoveryId),
                stringValue(result.candidateRecoveryId),
                false,
                stringValue(result.candidateStoreRecoveryId),
                projectedDockerRecoveryIds,
              );
            } else if (
              control.hostGenerationLossOutcome === "cleanup_confirmed_failure"
            ) {
              result = Object.freeze({
                ...blocked(
                  "coordinator_task_host_generation_lost_cleanup_confirmed",
                ),
                cleanupConfirmed: false,
                manualRecoveryRequired:
                  rawResultRecord.manualRecoveryRequired === true,
                hostRecoveryId: stringValue(rawResultRecord.hostRecoveryId),
                dockerRecoveryId:
                  projectedDockerRecoveryIds.length === 1
                    ? projectedDockerRecoveryIds[0]
                    : null,
                dockerRecoveryIds: projectedDockerRecoveryIds,
                candidateRecoveryId: stringValue(
                  rawResultRecord.candidateRecoveryId,
                ),
                candidateStoreRecoveryId: stringValue(
                  rawResultRecord.candidateStoreRecoveryId,
                ),
              });
            }
          }
          try {
            let isHostProtocolFailure =
              control.hostGenerationLossOutcome === "cleanup_confirmed_failure";
            control.retainOperationRoot ||=
              control.hostGenerationLossOutcome === "cleanup_unknown" ||
              !cleanupProjectionEligible;
            if (control.retainOperationRoot)
              await retainRuntimeRecoveryState(state, control);
            for (const finalization of state.dependencies
              .prepareDockerHostCleanup && !control.retainOperationRoot
              ? control.dockerFinalizations
              : []) {
              const hostRecoveryId =
                state.dependencies.prepareDockerHostCleanup?.(
                  finalization.capability,
                );
              if (!hostRecoveryId) {
                await retainRuntimeRecoveryState(state, control);
                return blocked(
                  "coordinator_task_host_cleanup_intent_unconfirmed",
                  true,
                  control.hostRecoveryId,
                  finalization.recoveryId,
                  stringValue(result.candidateRecoveryId),
                  false,
                  stringValue(result.candidateStoreRecoveryId),
                  actionableDockerRecoveryIds(control, [
                    finalization.recoveryId,
                  ]),
                );
              }
              control.hostRecoveryId = hostRecoveryId;
            }
            if (control.ownedOperation && !control.retainOperationRoot) {
              const cleanup = state.dependencies.classifyOperationCleanup(
                await state.dependencies.cleanupOperation(
                  control.ownedOperation,
                ),
              );
              if (!cleanup)
                throw new Error(
                  "coordinator_task_operation_cleanup_outcome_invalid",
                );
              if (cleanup === "protocol_failure_cleanup_confirmed")
                isHostProtocolFailure = true;
              control.hostCleanupCompleted = true;
              control.hostRecoveryId = null;
              control.ownedOperation = null;
              result = Object.freeze({ ...result, hostRecoveryId: null });
              if (control.lifecycleState === "STATE-CANDIDATE-STAGED")
                advanceLifecycleState(state, control, "STATE-HOST-CLEAN");
            }
            const lateHostLoss = await settleObservedHostLoss();
            if (lateHostLoss === "cleanup_unknown") {
              await retainRuntimeRecoveryState(state, control);
              const candidateRecoveryId = stringValue(
                result.candidateRecoveryId,
              );
              const discarded = candidateRecoveryId
                ? state.dependencies.discardCandidate(candidateRecoveryId)
                : null;
              return blocked(
                "coordinator_task_host_generation_lost_cleanup_unknown_process_restart_required",
                true,
                control.hostRecoveryId,
                null,
                discarded?.status === "discarded" ? null : candidateRecoveryId,
                false,
                stringValue(
                  discarded?.candidateStoreRecoveryId ??
                    result.candidateStoreRecoveryId,
                ),
                actionableDockerRecoveryIds(control),
              );
            }
            if (lateHostLoss === "cleanup_confirmed_failure")
              isHostProtocolFailure = true;
            for (const finalization of state.dependencies
              .recordDockerHostCleanupReceipt && !control.retainOperationRoot
              ? control.dockerFinalizations
              : []) {
              if (
                !state.dependencies.recordDockerHostCleanupReceipt?.(
                  finalization.capability,
                )
              ) {
                await retainRuntimeRecoveryState(state, control);
                return blocked(
                  "coordinator_task_host_cleanup_receipt_unconfirmed",
                  true,
                  control.hostRecoveryId,
                  finalization.recoveryId,
                  stringValue(result.candidateRecoveryId),
                  false,
                  stringValue(result.candidateStoreRecoveryId),
                  actionableDockerRecoveryIds(control, [
                    finalization.recoveryId,
                  ]),
                );
              }
            }
            const finalizeDockerRecovery =
              state.dependencies.finalizeDockerRecovery;
            for (const finalization of control.retainOperationRoot
              ? []
              : control.dockerFinalizations) {
              const finalized = finalizeDockerRecovery?.(
                finalization.capability,
              );
              if (finalized?.status !== "completed") {
                await retainRuntimeRecoveryState(state, control);
                return blocked(
                  "coordinator_task_docker_recovery_finalization_unconfirmed",
                  true,
                  null,
                  finalization.recoveryId,
                  stringValue(result.candidateRecoveryId),
                  false,
                  stringValue(result.candidateStoreRecoveryId),
                  actionableDockerRecoveryIds(control, [
                    finalization.recoveryId,
                  ]),
                );
              }
              const handoff = control.dockerHandoffs.find(
                (candidate) =>
                  candidate.capability === finalization.capability &&
                  candidate.recoveryId === finalization.recoveryId,
              );
              if (handoff?.state !== "finalizable") {
                await retainRuntimeRecoveryState(state, control);
                return blocked(
                  "coordinator_task_docker_recovery_handoff_state_invalid",
                  true,
                  null,
                  finalization.recoveryId,
                  stringValue(result.candidateRecoveryId),
                  false,
                  stringValue(result.candidateStoreRecoveryId),
                  actionableDockerRecoveryIds(control, [
                    finalization.recoveryId,
                  ]),
                );
              }
              handoff.state = "finalized";
            }
            const postDockerHostLoss = await settleObservedHostLoss();
            if (postDockerHostLoss === "cleanup_unknown") {
              await retainRuntimeRecoveryState(state, control);
              const candidateRecoveryId = stringValue(
                result.candidateRecoveryId,
              );
              const discarded = candidateRecoveryId
                ? state.dependencies.discardCandidate(candidateRecoveryId)
                : null;
              return blocked(
                "coordinator_task_host_generation_lost_cleanup_unknown_process_restart_required",
                true,
                control.hostRecoveryId,
                null,
                discarded?.status === "discarded" ? null : candidateRecoveryId,
                false,
                stringValue(
                  discarded?.candidateStoreRecoveryId ??
                    result.candidateStoreRecoveryId,
                ),
                actionableDockerRecoveryIds(control),
              );
            }
            if (postDockerHostLoss === "cleanup_confirmed_failure")
              isHostProtocolFailure = true;
            if (isHostProtocolFailure) {
              const candidateRecoveryId = stringValue(
                result.candidateRecoveryId,
              );
              const discarded = candidateRecoveryId
                ? state.dependencies.discardCandidate(candidateRecoveryId)
                : null;
              const isCandidateStillRequiresRecovery = Boolean(
                candidateRecoveryId && discarded?.status !== "discarded",
              );
              const dockerRecoveryIds = controlDockerRecoveryIds(control);
              const hostRecoveryId = control.retainOperationRoot
                ? control.hostRecoveryId
                : null;
              const candidateStoreRecoveryId = stringValue(
                discarded?.candidateStoreRecoveryId ??
                  result.candidateStoreRecoveryId,
              );
              const manualRecoveryRequired = Boolean(
                hostRecoveryId ||
                  dockerRecoveryIds.length > 0 ||
                  isCandidateStillRequiresRecovery ||
                  candidateStoreRecoveryId,
              );
              return blocked(
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
            if (!cleanupProjectionEligible) {
              const candidateRecoveryId = stringValue(
                result.candidateRecoveryId,
              );
              const discarded = candidateRecoveryId
                ? state.dependencies.discardCandidate(candidateRecoveryId)
                : null;
              return blocked(
                stringValue(result.reason) ??
                  "coordinator_task_docker_recovery_projection_invalid",
                true,
                control.hostRecoveryId,
                projectedDockerRecoveryIds.length === 1
                  ? (projectedDockerRecoveryIds[0] ?? null)
                  : null,
                discarded?.status === "discarded" ? null : candidateRecoveryId,
                false,
                stringValue(
                  discarded?.candidateStoreRecoveryId ??
                    result.candidateStoreRecoveryId,
                ),
                projectedDockerRecoveryIds,
              );
            }
            const candidateRecoveryId = stringValue(result.candidateRecoveryId);
            if (!candidateRecoveryId)
              return projectCurrentDockerRecovery(result, control);
            if (result.status !== "completed") {
              const discarded =
                state.dependencies.discardCandidate(candidateRecoveryId);
              if (discarded?.status === "discarded") {
                const currentDockerRecoveryIds =
                  controlDockerRecoveryIds(control);
                const manualRecoveryRequired = Boolean(
                  stringValue(result.hostRecoveryId) ||
                    stringValue(result.candidateStoreRecoveryId) ||
                    currentDockerRecoveryIds.length > 0,
                );
                return Object.freeze({
                  ...result,
                  manualRecoveryRequired,
                  cleanupConfirmed: !manualRecoveryRequired,
                  dockerRecoveryId:
                    currentDockerRecoveryIds.length === 1
                      ? currentDockerRecoveryIds[0]
                      : null,
                  dockerRecoveryIds: currentDockerRecoveryIds,
                  candidateRecoveryId: null,
                  candidateStoreRecoveryId: stringValue(
                    result.candidateStoreRecoveryId,
                  ),
                });
              }
              return blocked(
                String(result.reason),
                true,
                stringValue(result.hostRecoveryId),
                stringValue(result.dockerRecoveryId),
                candidateRecoveryId,
                result.cleanupConfirmed === true,
                stringValue(discarded?.candidateStoreRecoveryId),
              );
            }
            const published =
              state.dependencies.publishCandidate(candidateRecoveryId);
            const candidateId = stringValue(published?.candidateId);
            const candidateStoreRecoveryId = stringValue(
              published?.candidateStoreRecoveryId,
            );
            if (published?.status !== "published" || !candidateId) {
              return blocked(
                "coordinator_task_candidate_publish_unconfirmed",
                true,
                null,
                null,
                candidateRecoveryId,
                true,
                candidateStoreRecoveryId,
              );
            }
            return projectCurrentDockerRecovery(
              Object.freeze({
                ...result,
                candidateId,
                expiresAtMs:
                  Number.isSafeInteger(published.expiresAtMs) &&
                  Number(published.expiresAtMs) >= 0
                    ? Number(published.expiresAtMs)
                    : null,
                candidateRecoveryId: null,
                candidateStoreRecoveryId: null,
              }),
              control,
            );
          } catch {
            await retainRuntimeRecoveryState(state, control);
            const candidateRecoveryId = stringValue(result.candidateRecoveryId);
            const discarded = candidateRecoveryId
              ? state.dependencies.discardCandidate(candidateRecoveryId)
              : null;
            return blocked(
              result.reason ===
                "coordinator_task_external_send_confirmation_cleanup_unknown_process_restart_required"
                ? "coordinator_task_external_send_confirmation_cleanup_unknown_process_restart_and_operation_recovery_required"
                : "coordinator_task_operation_cleanup_unconfirmed",
              true,
              control.hostRecoveryId,
              null,
              discarded?.status === "discarded" ? null : candidateRecoveryId,
              null,
              stringValue(discarded?.candidateStoreRecoveryId),
              actionableDockerRecoveryIds(control),
            );
          }
        })
        .catch(async () => {
          try {
            await retainRuntimeRecoveryState(state, control);
          } catch {
            poisonRuntimeProcess(state, control);
          }
          return blocked(
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
            if (control.hostGenerationFailureObserved) {
              if (result.manualRecoveryRequired === true)
                poisonRuntimeProcess(state, control);
              control.releaseHostGenerationDrain?.();
              control.releaseHostGenerationDrain = null;
            }
            control.processPoisoned ||=
              state.dependencies.isProcessPoisoned?.() === true;
            if (control.cancellationProtocolFailure) {
              const manualRecoveryRequired =
                result.manualRecoveryRequired === true;
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
            state.controls.delete(controlCapability);
          }
          advanceLifecycleState(
            state,
            control,
            classifyCoordinatorTaskTerminalLifecycleState(result),
          );
          return result;
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
    },
    cancel: (controlCapability: unknown) => {
      if (!controlCapability || typeof controlCapability !== "object") {
        return Promise.resolve(INVALID_CONTROL_CANCELLATION_RESULT);
      }
      const control = state.controls.get(controlCapability);
      if (!control) {
        return Promise.resolve(INVALID_CONTROL_CANCELLATION_RESULT);
      }
      return requestControlCancellation(state, control);
    },
  });
}

const productionRuntime = createRuntime(productionDependencies);

/**
 * Runtime 所有 Coordinator Taskを開始する。
 *
 * @responsibility Runtime 所有 Coordinator Taskの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、repositoryRoot: unknown、verifiedPackageCapability: unknown、recoveryCorrelationId: unknown
 * @returns startRuntimeOwnedCoordinatorTaskの計算結果を返す。
 * @precondition 「rawRequest: unknown、repositoryRoot: unknown、verifiedPackageCapability: unknown、recoveryCorrelationId: unknown」がstartRuntimeOwnedCoordinatorTaskの入力契約を満たす。
 * @postcondition startRuntimeOwnedCoordinatorTaskの責務を完了した結果だけを返す。
 * @effect N/A: startRuntimeOwnedCoordinatorTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure startRuntimeOwnedCoordinatorTaskは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant startRuntimeOwnedCoordinatorTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: startRuntimeOwnedCoordinatorTaskはProcess内の同一Subsystemで完結する。
 * @security startRuntimeOwnedCoordinatorTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: startRuntimeOwnedCoordinatorTaskは共有非同期状態を持たない同期処理である。
 */
export function startRuntimeOwnedCoordinatorTask(
  rawRequest: unknown,
  repositoryRoot: unknown,
  verifiedPackageCapability: unknown,
  recoveryCorrelationId: unknown = null,
) {
  if (isRuntimeProcessEffectBlocked()) {
    throw new Error(
      isRuntimeProcessPoisoned()
        ? "coordinator_task_process_restart_required"
        : "coordinator_task_runtime_cleanup_in_progress",
    );
  }
  if (
    !consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(
      verifiedPackageCapability,
    )
  ) {
    throw new Error("coordinator_task_release_verification_required");
  }
  return productionRuntime.start(
    rawRequest,
    repositoryRoot,
    new Date().toISOString(),
    recoveryCorrelationId,
  );
}

/**
 * Runtime 所有 Coordinator Taskを取り消す。
 *
 * @responsibility Runtime 所有 Coordinator Taskの取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000004
 * @input controlCapability: unknown
 * @returns cancelRuntimeOwnedCoordinatorTaskの計算結果を返す。
 * @precondition 「controlCapability: unknown」がcancelRuntimeOwnedCoordinatorTaskの入力契約を満たす。
 * @postcondition cancelRuntimeOwnedCoordinatorTaskの責務を完了した結果だけを返す。
 * @effect N/A: cancelRuntimeOwnedCoordinatorTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelRuntimeOwnedCoordinatorTaskは独自の失敗分岐を所有しない。
 * @invariant cancelRuntimeOwnedCoordinatorTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cancelRuntimeOwnedCoordinatorTaskはProcess内の同一Subsystemで完結する。
 * @security cancelRuntimeOwnedCoordinatorTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cancelRuntimeOwnedCoordinatorTaskは共有非同期状態を持たない同期処理である。
 */
export function cancelRuntimeOwnedCoordinatorTask(controlCapability: unknown) {
  return productionRuntime.cancel(controlCapability);
}

/** Bounded development admission is separate from the signed public Task path. */
const developmentProjectRuntimeCancellations = new WeakMap<
  object,
  () => Promise<unknown>
>();

/**
 * Testable projection used only after the outer development cleanup settles.
 *
 * @responsibility Development Task 結果 After Outer 清掃の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input taskResult: Readonly<Record<string, unknown>>、cleanupConfirmed: boolean
 * @returns projectDevelopmentTaskResultAfterOuterCleanupの計算結果を返す。
 * @precondition 「taskResult: Readonly<Record<string, unknown>>、cleanupConfirmed: boolean」がprojectDevelopmentTaskResultAfterOuterCleanupの入力契約を満たす。
 * @postcondition projectDevelopmentTaskResultAfterOuterCleanupの責務を完了した結果だけを返す。
 * @effect N/A: projectDevelopmentTaskResultAfterOuterCleanupは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure projectDevelopmentTaskResultAfterOuterCleanupは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant projectDevelopmentTaskResultAfterOuterCleanupは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectDevelopmentTaskResultAfterOuterCleanupはProcess内の同一Subsystemで完結する。
 * @security projectDevelopmentTaskResultAfterOuterCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectDevelopmentTaskResultAfterOuterCleanupは共有非同期状態を持たない同期処理である。
 */
export function projectDevelopmentTaskResultAfterOuterCleanup(
  taskResult: Readonly<Record<string, unknown>>,
  cleanupConfirmed: boolean,
) {
  if (cleanupConfirmed) return taskResult;
  const snapshot: Record<string, unknown> = Object.create(null);
  const descriptors = Object.getOwnPropertyDescriptors(taskResult);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string")
      throw new Error("development_task_result_projection_invalid");
    if (key === "providerTurnObservations") continue;
    const descriptor = descriptors[key];
    if (
      !descriptor ||
      !Object.hasOwn(descriptor, "value") ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      descriptor.enumerable !== true
    )
      throw new Error("development_task_result_projection_invalid");
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

/**
 * Runtime 所有 Development Taskを開始する。
 *
 * @responsibility Runtime 所有 Development Taskの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、repositoryRoot: unknown、sessionCapability: object、candidateDisposition: "discard" | "project_runtime_owned"、recoveryCorrelationId: unknown
 * @returns startRuntimeOwnedDevelopmentTaskの計算結果を返す。
 * @precondition 「rawRequest: unknown、repositoryRoot: unknown、sessionCapability: object、candidateDisposition: "discard" | "project_runtime_owned"、recoveryCorrelationId: unknown」がstartRuntimeOwnedDevelopmentTaskの入力契約を満たす。
 * @postcondition startRuntimeOwnedDevelopmentTaskの責務を完了した結果だけを返す。
 * @effect N/A: startRuntimeOwnedDevelopmentTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure startRuntimeOwnedDevelopmentTaskは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant startRuntimeOwnedDevelopmentTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: startRuntimeOwnedDevelopmentTaskはProcess内の同一Subsystemで完結する。
 * @security startRuntimeOwnedDevelopmentTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency startRuntimeOwnedDevelopmentTaskは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function startRuntimeOwnedDevelopmentTask(
  rawRequest: unknown,
  repositoryRoot: unknown,
  sessionCapability: object,
  candidateDisposition: "discard" | "project_runtime_owned",
  recoveryCorrelationId: unknown = null,
) {
  const timing = createDevelopmentExecutionTiming(
    undefined,
    writeDevelopmentMeasurementProgress,
  );
  const boundary = reserveRuntimeOwnedDevelopmentMeasurementTask(
    sessionCapability,
    rawRequest,
    repositoryRoot,
  );
  if (!boundary)
    throw new Error("coordinator_task_development_permission_required");
  let managementCapability: object | undefined;
  /**
   * guardを決定する。
   *
   * @responsibility guardの導出に必要な入力、判定規則、返却結果の境界を所有する。
   * @trace ARCH-000004
   * @input action: (...args: Args) => Result
   * @returns guardの計算結果を返す。
   * @precondition 「action: (...args: Args) => Result」がguardの入力契約を満たす。
   * @postcondition guardの責務を完了した結果だけを返す。
   * @effect N/A: guardは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure guardは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant guardは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: guardはProcess内の同一Subsystemで完結する。
   * @security guardはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: guardは共有非同期状態を持たない同期処理である。
   */
  function guard<Args extends unknown[], Result>(
    action: (...args: Args) => Result,
  ) {
    return (...args: Args): Result => {
      if (!boundary?.checkNewWork())
        throw new Error("coordinator_task_development_permission_expired");
      return action(...args);
    };
  }
  const runtime = createRuntime({
    ...productionDependencies,
    observeLifecycleState: timing.observeLifecycleState,
    beginInvocation: boundary.beginInvocation,
    inspectRepository: guard(productionDependencies.inspectRepository),
    createOperation: guard(productionDependencies.createOperation),
    bindRepository: guard((management, root) => {
      const result = bindRuntimeOwnedRepositoryOperation(management, root);
      if (
        !result ||
        !boundary.bindOperation(management, result.repositoryBindingCapability)
      )
        return null;
      managementCapability = management;
      return result;
    }),
    prepareDockerRecoveryState: guard(() =>
      inspectRuntimeOwnedDockerTaskRecoveryState(boundary.context),
    ),
    prepareCandidateStore: guard(() =>
      inspectRuntimeOwnedDevelopmentCandidateStore(boundary.context),
    ),
    observeProviderHome: (provider, time) =>
      inspectRuntimeOwnedWindowsProviderHomeCandidate(
        provider,
        time,
        boundary.context,
      ),
    materializeWorkspace: guard(productionDependencies.materializeWorkspace),
    preflightSlate: guard(productionDependencies.preflightSlate),
    issueSelection: guard(productionDependencies.issueSelection),
    issueMountGrant: guard(productionDependencies.issueMountGrant),
    consumeMountGrant: guard(productionDependencies.consumeMountGrant),
    issueTaskPacket: guard(productionDependencies.issueTaskPacket),
    prepareProvider: guard(productionDependencies.prepareProvider),
    captureCandidate: guard(productionDependencies.captureCandidate),
    persistCandidate: guard(productionDependencies.persistCandidate),
    publishCandidate: guard((id) =>
      publishRuntimeOwnedCandidateBundle(id, managementCapability),
    ),
    discardCandidate: (id) =>
      discardRuntimeOwnedCandidateBundle(id, managementCapability),
  });
  const started = runtime.start(
    boundary.request,
    boundary.repositoryRoot,
    new Date().toISOString(),
    recoveryCorrelationId,
  );
  const cancel = () => runtime.cancel(started.controlCapability);
  let cancellation: Promise<unknown> | null = null;
  const requestCancellation = () => {
    cancellation ??= cancel();
    void cancellation.catch(() => {});
  };
  const timer = setTimeout(
    requestCancellation,
    Math.max(0, boundary.expiresAtMs - Date.now()),
  );
  boundary.signal.addEventListener("abort", requestCancellation, {
    once: true,
  });
  if (boundary.signal.aborted) requestCancellation();
  const completion = started.completion
    .then(async (taskResult) => {
      if (cancellation) await cancellation.catch(() => {});
      // Comparison candidates are never promoted; dispose only the entry which
      // the Store registered to this exact operation when it created the file.
      const candidateDiscard =
        candidateDisposition === "discard" && taskResult.candidateId
          ? discardRuntimeOwnedCandidateBundle(
              taskResult.candidateId,
              managementCapability,
            )
          : null;
      const cleanupConfirmed =
        taskResult.cleanupConfirmed === true &&
        (!taskResult.candidateId ||
          candidateDisposition === "project_runtime_owned" ||
          candidateDiscard?.status === "discarded");
      const publishedTaskResult = projectDevelopmentTaskResultAfterOuterCleanup(
        taskResult,
        cleanupConfirmed,
      );
      boundary.finish(cleanupConfirmed ? "finished" : "cleanup_unknown");
      timing.finish();
      return Object.freeze({
        status:
          taskResult.status === "completed" && cleanupConfirmed
            ? "completed"
            : "blocked",
        executionSourceKind: "fixed_development_candidate",
        releaseAuthorityConferred: false,
        taskResult: publishedTaskResult,
        candidateDiscard,
        cleanupConfirmed,
        manualRecoveryRequired:
          taskResult.manualRecoveryRequired || !cleanupConfirmed,
        executionTiming: timing.snapshot(),
      });
    })
    .catch((error: unknown) => {
      boundary.finish("cleanup_unknown");
      throw error;
    })
    .finally(() => {
      timing.finish();
      clearTimeout(timer);
      boundary.signal.removeEventListener("abort", requestCancellation);
      developmentProjectRuntimeCancellations.delete(started.controlCapability);
    });
  if (candidateDisposition === "project_runtime_owned")
    developmentProjectRuntimeCancellations.set(
      started.controlCapability,
      cancel,
    );
  return Object.freeze({
    ...started,
    completion,
    cancel,
    readExecutionTiming: timing.snapshot,
  });
}

/**
 * Comparison-only development Tasks discard their candidates on completion.
 *
 * @responsibility Runtime 所有 Development Coordinator Taskの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、repositoryRoot: unknown、sessionCapability: object
 * @returns startRuntimeOwnedDevelopmentCoordinatorTaskの計算結果を返す。
 * @precondition 「rawRequest: unknown、repositoryRoot: unknown、sessionCapability: object」がstartRuntimeOwnedDevelopmentCoordinatorTaskの入力契約を満たす。
 * @postcondition startRuntimeOwnedDevelopmentCoordinatorTaskの責務を完了した結果だけを返す。
 * @effect N/A: startRuntimeOwnedDevelopmentCoordinatorTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: startRuntimeOwnedDevelopmentCoordinatorTaskは独自の失敗分岐を所有しない。
 * @invariant startRuntimeOwnedDevelopmentCoordinatorTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: startRuntimeOwnedDevelopmentCoordinatorTaskはProcess内の同一Subsystemで完結する。
 * @security startRuntimeOwnedDevelopmentCoordinatorTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: startRuntimeOwnedDevelopmentCoordinatorTaskは共有非同期状態を持たない同期処理である。
 */
export function startRuntimeOwnedDevelopmentCoordinatorTask(
  rawRequest: unknown,
  repositoryRoot: unknown,
  sessionCapability: object,
) {
  return startRuntimeOwnedDevelopmentTask(
    rawRequest,
    repositoryRoot,
    sessionCapability,
    "discard",
    null,
  );
}

/**
 * Project Runtime owns candidate integration and cleanup after Task completion.
 *
 * @responsibility Runtime 所有 Development Project Runtime Taskの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、repositoryRoot: unknown、sessionCapability: object、recoveryCorrelationId: unknown
 * @returns startRuntimeOwnedDevelopmentProjectRuntimeTaskの計算結果を返す。
 * @precondition 「rawRequest: unknown、repositoryRoot: unknown、sessionCapability: object、recoveryCorrelationId: unknown」がstartRuntimeOwnedDevelopmentProjectRuntimeTaskの入力契約を満たす。
 * @postcondition startRuntimeOwnedDevelopmentProjectRuntimeTaskの責務を完了した結果だけを返す。
 * @effect N/A: startRuntimeOwnedDevelopmentProjectRuntimeTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: startRuntimeOwnedDevelopmentProjectRuntimeTaskは独自の失敗分岐を所有しない。
 * @invariant startRuntimeOwnedDevelopmentProjectRuntimeTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: startRuntimeOwnedDevelopmentProjectRuntimeTaskはProcess内の同一Subsystemで完結する。
 * @security startRuntimeOwnedDevelopmentProjectRuntimeTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: startRuntimeOwnedDevelopmentProjectRuntimeTaskは共有非同期状態を持たない同期処理である。
 */
export function startRuntimeOwnedDevelopmentProjectRuntimeTask(
  rawRequest: unknown,
  repositoryRoot: unknown,
  sessionCapability: object,
  recoveryCorrelationId: unknown = null,
) {
  const started = startRuntimeOwnedDevelopmentTask(
    rawRequest,
    repositoryRoot,
    sessionCapability,
    "project_runtime_owned",
    recoveryCorrelationId,
  );
  return Object.freeze({
    status: started.status,
    controlCapability: started.controlCapability,
    completion: started.completion.then((outcome) => outcome.taskResult),
  });
}

/**
 * Runtime 所有 Development Project Runtime Taskを取り消す。
 *
 * @responsibility Runtime 所有 Development Project Runtime Taskの取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000004
 * @input controlCapability: object
 * @returns cancelRuntimeOwnedDevelopmentProjectRuntimeTaskの計算結果を返す。
 * @precondition 「controlCapability: object」がcancelRuntimeOwnedDevelopmentProjectRuntimeTaskの入力契約を満たす。
 * @postcondition cancelRuntimeOwnedDevelopmentProjectRuntimeTaskの責務を完了した結果だけを返す。
 * @effect N/A: cancelRuntimeOwnedDevelopmentProjectRuntimeTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelRuntimeOwnedDevelopmentProjectRuntimeTaskは独自の失敗分岐を所有しない。
 * @invariant cancelRuntimeOwnedDevelopmentProjectRuntimeTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cancelRuntimeOwnedDevelopmentProjectRuntimeTaskはProcess内の同一Subsystemで完結する。
 * @security cancelRuntimeOwnedDevelopmentProjectRuntimeTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency cancelRuntimeOwnedDevelopmentProjectRuntimeTaskは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function cancelRuntimeOwnedDevelopmentProjectRuntimeTask(
  controlCapability: object,
) {
  const cancel = developmentProjectRuntimeCancellations.get(controlCapability);
  return cancel ? cancel() : Promise.resolve(false);
}

/**
 * Isolated Coordinator Task Runtime 候補を構築する。
 *
 * @responsibility Isolated Coordinator Task Runtime 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: RuntimeDependencies
 * @returns createIsolatedCoordinatorTaskRuntimeCandidateの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateIsolatedCoordinatorTaskRuntimeCandidateの入力契約を満たす。
 * @postcondition createIsolatedCoordinatorTaskRuntimeCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedCoordinatorTaskRuntimeCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedCoordinatorTaskRuntimeCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedCoordinatorTaskRuntimeCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedCoordinatorTaskRuntimeCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedCoordinatorTaskRuntimeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedCoordinatorTaskRuntimeCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedCoordinatorTaskRuntimeCandidate(
  dependencies: RuntimeDependencies,
) {
  return Object.freeze({
    productionAuthority: false as const,
    ...createRuntime(dependencies),
  });
}

/**
 * Coordinator Task Runtime 契約の公開契約を記述する。
 *
 * @responsibility Coordinator Task Runtime 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCoordinatorTaskRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCoordinatorTaskRuntimeContractの入力契約を満たす。
 * @postcondition describeCoordinatorTaskRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCoordinatorTaskRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCoordinatorTaskRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeCoordinatorTaskRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeCoordinatorTaskRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeCoordinatorTaskRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeCoordinatorTaskRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeCoordinatorTaskRuntimeContract() {
  return Object.freeze({
    contract: COORDINATOR_TASK_RUNTIME_CONTRACT,
    contractRevision: COORDINATOR_TASK_RUNTIME_CONTRACT_REVISION,
    flow: "front_to_coordinator_to_executor_to_candidate_revision_to_independent_reviewer_to_result_integration",
    routes: Object.freeze([
      "front_codex__executor_codex",
      "front_codex__executor_claude",
      "front_claude__executor_codex",
      "front_claude__executor_claude",
    ]),
    providerSelection: "explainable_cross_provider_preferred_cost_bounded",
    executorConstraint:
      "optional_auto_codex_or_claude_normalized_once_and_enforced_by_the_same_slate_and_selection_gate",
    repositoryObjectFormat:
      "sha1_only_preflight_before_operation_external_send_or_candidate_store",
    selectionNotice:
      "safe_preselection_event_before_provider_effect_with_deferred_preflight_explicit",
    executorWorkspace: "runtime_owned_exact_commit_read_write",
    reviewerWorkspace: "same_exact_candidate_read_only",
    taskTransport: "opaque_single_use_provider_stdin_only",
    recognizedSecretBoundary:
      "task_scope_and_read_projection_before_executor_candidate_capture_before_each_reviewer_and_remediation_path_before_next_executor",
    completeSecretAbsenceVerified: false,
    productionPackageGate:
      "single_use_runtime_private_verified_distribution_capability_before_all_effects",
    processPoisonGate:
      "before_package_consume_operation_console_store_workspace_provider_and_network",
    processRestartProjection:
      "runtime_owned_final_irreversible_process_poison_boolean_independent_from_recovery_identifiers_manual_recovery_reason_and_temporary_drain",
    cancellation: Object.freeze({
      liveControlReceipt:
        "exact_status_reason_cancellation_requested_process_termination_observed",
      reasonCorrelation:
        "termination_true_requested_or_termination_false_grace_exceeded",
      duplicateLiveOperation:
        "same_cancellation_effect_same_promise_same_frozen_receipt",
      invalidForeignOrExpiredControl:
        "exact_blocked_control_invalid_with_zero_effect",
      legacyReceiptFallbackAllowed: false,
      acknowledgmentTimeoutMs: PRODUCTION_CANCELLATION_ACK_TIMEOUT_MS,
      protocolFailure:
        "irreversible_process_poison_joined_before_completion_projection_while_resource_cleanup_continues",
      liveControlLifetime:
        "from_started_return_until_outer_completion_final_settlement_including_cleanup",
    }),
    completionOwnership:
      "production_producer_returns_exact_native_promise_and_owns_settlement_non_native_completion_is_not_runner_authority",
    hostOperationGenerationReadiness:
      "dedicated_supervisor_process_round_trip_then_same_generation_and_durable_record_file_hash_state_root_children_reconfirmation_before_any_following_effect",
    hostOperationSupervisorOutcomes:
      "acquired_unavailable_cleanup_confirmed_failure_or_cleanup_unknown_with_exact_recovery_and_process_poison",
    operationCreationCancellation:
      "rechecked_after_async_creation_before_repository_policy_slate_store_console_or_provider_effect",
    interactiveCleanupRecovery:
      "restart_only_without_operation_recovery_id_unless_operation_cleanup_also_fails",
    approvedCandidateTransfer:
      "policy_bounded_staged_bundle_published_only_after_operation_cleanup",
    candidateStorePreflight:
      "runtime_owned_protected_store_and_bounded_gc_before_external_send_authority",
    dockerRecoveryPreflight:
      "runtime_owned_bounded_state_audit_before_task_operation",
    executionSlate:
      "executor_and_reviewer_preflighted_together_before_external_send_or_provider_effect",
    independentReview: Object.freeze({
      providerIndependent: "preferred_subject_provider_excluded",
      executionContextIndependent:
        "low_risk_local_bounded_only_with_separate_grant_packet_process_and_read_only_candidate",
      highRiskSameProviderAllowed: false,
    }),
    candidateReviewClassification:
      "candidate_integrity_verification_failure_is_distinct_from_independent_reviewer_semantic_rejection",
    boundedRemediation:
      "maximum_one_same_executor_then_same_independent_reviewer",
    providerTurnObservations:
      "validated_non_authority_requested_reported_absolute_limit_and_target_exceeded_after_cleanup_for_each_accepted_claude_stage",
    externalSendPolicy:
      "exact_bound_repository_commit_policy_plus_terminal_safe_full_scope_confirmation",
    recoveryIdentifiers: Object.freeze([
      "host",
      "docker_task",
      "candidate",
      "candidate_store",
    ]),
    successfulHostRecoveryProjection: "explicit_null_never_omitted",
    resultPublication: "cleanup_and_candidate_reverification_required",
    candidateExpiryPublication: "validated_published_expires_at_ms",
    canonicalRepositoryEffectAllowed: false,
    directProviderToProviderSpawnAllowed: false,
    apiKeyFallbackAllowed: false,
    paidApiFallbackAllowed: false,
    rawOutputReported: false,
  });
}
