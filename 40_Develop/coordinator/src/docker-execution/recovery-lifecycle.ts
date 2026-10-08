/**
 * docker-recovery-runtime-internalに属する責務をまとめる。
 *
 * @responsibility ProductionPlanを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { codexAdviceProviderInitRequired } from "../../../ai-adapter/src/index.ts";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
import {
  consumeRuntimeOwnedRuntimeStateRootCapability,
  inspectRuntimeOwnedWindowsRuntimeState,
} from "../platform-access/protected-root-windows-adapter.ts";
import { dockerDesktopCurrentArtifactTrustPolicySha256 } from "../docker-desktop/current-artifact-trust.ts";
import {
  inspectDockerDesktopRepairHistoricalOperation,
  parseDockerDesktopRepairDirectoryName,
} from "../docker-desktop/repair-record-store.ts";
import {
  createDockerRestartContinuationRecord,
  createDockerRestartMigratedPhase,
  createDockerRestartMigrationRecord,
  parseDockerRestartContinuationRecord,
  resolveDockerRestartHistory,
} from "../docker-desktop/restart-continuation-record.ts";
import { parseDockerRestartHandoffRecord } from "../docker-desktop/restart-handoff-record.ts";
import {
  createDockerRestartRecord,
  type DockerRestartBinding,
  type DockerRestartPhase,
  parseDockerRestartRecord,
  validateDockerRestartRecordChain,
} from "../docker-desktop/restart-record.ts";
import { parseExternalSendConsentActiveEntryName } from "../external-send/consent-record.ts";
import {
  acquireRuntimeOwnedDockerRuntimeStateKernelLock,
  acquireRuntimeOwnedHostOperationKernelLock,
  acquireRuntimeOwnedLogicalProviderHomeKernelLock,
} from "../host-execution/kernel-lock.ts";
import {
  acquireHostOperationRecoveryGenerationByIdentity,
  borrowOwnedHostRecoverySnapshot,
  confirmOwnedDockerAbsenceForRecovery,
  consumeOwnedHostRecoveryIdForCleanup,
  issueOwnedHostCleanupCapability,
  recoverOwnedOperationDirectories,
  releaseHostOperationRecoveryGeneration,
  verifyOwnedOperationManagementCapability,
} from "../host-execution/operation-workspace-lifecycle.ts";
import {
  loadHostRecoveryRecordByToken,
  parseHostRecoveryToken,
} from "../host-execution/recovery-record.ts";
import { createWindowsDockerCliEnvironment } from "../host-execution/windows-child-environment.ts";
import { loadHistoricalReleaseManifestEnvelopeForVerification } from "../platform-access/manifest-loader.ts";
import { verifyBundledCoordinatorPackageFromFixedManifestCandidate } from "../platform-access/package-verification.ts";
import { getPinnedPlatformProvisionerReleaseSignerSpkiDer } from "../platform-access/release-trust.ts";
import { verifyHistoricalPlatformProvisionerManifestCandidate } from "../platform-access/manifest-trust.ts";
import {
  consumeRuntimeOwnedProviderHomeObservationCapability,
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
} from "../provider/home-windows-adapter.ts";
import { borrowRuntimeOwnedCoordinatorStateRepository } from "../repository-operation/binding.ts";
import {
  coordinatorConsumerCompletionPolicy,
  decodeCoordinatorStateSnapshot,
  encodeCoordinatorStateValue,
  prepareCoordinatorStateHostSnapshot,
  prepareCoordinatorStateOperationSnapshot,
} from "../state-storage/model.ts";
import {
  acceptRuntimeOwnedCoordinatorProjectResult,
  beginRuntimeOwnedCoordinatorHostSubmission,
  bindRuntimeOwnedCoordinatorProjectAcceptanceReader,
  captureRuntimeOwnedCoordinatorSettlementInputs,
  checkpointRuntimeOwnedCoordinatorCleanup,
  checkpointRuntimeOwnedCoordinatorLifecycle,
  checkpointRuntimeOwnedCoordinatorResource,
  checkpointRuntimeOwnedCoordinatorResourceNotIssued,
  completeRuntimeOwnedCoordinatorHostSubmission,
  completeRuntimeOwnedCoordinatorSettlement,
  prepareRuntimeOwnedCoordinatorSettlement,
  readRuntimeOwnedCoordinatorResourceRequests,
  readRuntimeOwnedCoordinatorSettlementResult,
  readRuntimeOwnedCoordinatorStateSnapshot,
  saveRuntimeOwnedCoordinatorOperationStart,
  settleRuntimeOwnedCoordinatorResult,
  writeRuntimeOwnedCoordinatorStateSnapshot,
} from "../state-storage/settlement-store.ts";
import {
  discoverDockerRecoveryJournalJsonForRecovery,
  dockerRecoveryCommitName,
  hasDockerRecoveryJournalIntentForRecovery,
  inspectDockerRecoveryJournalDirectory,
  inspectDockerRecoveryMoveJournalForRecovery,
  isDockerRecoveryJournalIntentName,
  isDockerRecoveryJournalTemporaryName,
  moveCommittedDockerRecoveryJson,
  readCommittedDockerRecoveryJson,
  removeCommittedDockerRecoveryJson,
  removeDockerRecoveryCleanupDirectory,
  removeExactUncommittedDockerRecoveryJson,
  resumeDockerRecoveryJournalDirectory,
  resumeDockerRecoveryJournalDirectoryForRecovery,
  writeCommittedDockerRecoveryJson,
  writeOrResumeCommittedDockerRecoveryJson,
} from "../state-storage/docker-recovery-journal.ts";
import {
  borrowRuntimeOwnedDevelopmentNativeObservation,
  inspectRuntimeOwnedDevelopmentOperationContext,
} from "../task/development-measurement-session.ts";
import {
  DOCKER_CLI_EXECUTABLE,
  type DockerCliTrustSnapshot,
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
} from "./cli-trust.ts";
import { dockerContainerInitObservationMatches } from "./container-init-observation.ts";
import { validateDockerHostTransitionLineage } from "./host-transition-state.ts";
import { verifyRuntimeOwnedDockerProviderSubmissionNotice } from "./process-controller.ts";
import { parseDockerTaskRecoveryId } from "./recovery-identity.ts";
import { createDockerRecoveryRuntimeStateLockController } from "./recovery-lock-controller.ts";
import {
  canonical,
  exactRecordKeys,
  type RuntimeStateBindingEvidence,
  validateDockerRecoveryBase,
  validateDockerRecoveryBaseCommit,
  validateOperationRecord,
  validRuntimeStateBindingEvidence,
} from "./recovery-record-model.ts";
import { releaseRecoverySynchronizations } from "./recovery-state-machine.ts";
import { isExactDockerRuntimeStateMutationBoundary } from "./state-binding.ts";

export const DOCKER_RECOVERY_RUNTIME_CONTRACT =
  "crdd-coordinator/docker-recovery-runtime";
export const DOCKER_RECOVERY_RUNTIME_CONTRACT_REVISION = 28;

const HEX64 = /^[a-f0-9]{64}$/u;
const COMPLETED_DOCKER_RECOVERY_RECEIPT =
  /^completed-docker-recovery-([a-f0-9]{64})\.json$/u;
const ACKNOWLEDGED_DOCKER_RECOVERY_RECEIPT =
  /^acknowledged-docker-recovery-([a-f0-9]{64})\.json$/u;
const MAX_COMPLETED_DOCKER_RECOVERY_RECEIPTS = 64;
const DOCKER_TASK_SESSION_HANDOFF =
  /^docker-task-session-handoff-([a-f0-9]{64})-([0-9]{2})\.json$/u;
const MAX_DOCKER_TASK_SESSION_HANDOFFS = 8;
const SAFE_RESOURCE =
  /^crdd-(?:auth|internal|egress|proxy|claude|codex)-[a-f0-9]{16}$/u;
const CREATE_PURPOSES = new Set([
  "create_subscription_auth_probe",
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "create_provider",
]);
const DOCKER_ENGINE = "npipe:////./pipe/dockerDesktopLinuxEngine";
let recoveryDockerCliSnapshot: DockerCliTrustSnapshot | null = null;

/**
 * docker-recovery-runtime-internalで使用するProduction Planの値契約を定義する。
 *
 * @responsibility Production PlanのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ProductionPlanが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProductionPlanで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProductionPlanの宣言は外部境界を開かない。
 * @security ProductionPlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProductionPlanの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ProductionPlan = Readonly<{
  provider: "codex" | "claude";
  consumer: "coordinator_cli" | "workbench" | "orchestrator";
  operationId: string;
  recoveryCorrelationId?: string | null;
  grantRef: string;
  profileId: string;
  providerHomeIdentityHash: string;
  providerHomeProtectionHash: string;
  localUserBindingHash: string;
  stableLogicalHomeBindingHash: string;
  authContainerName: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  operationMode: "boolean_probe" | "isolated_task" | "workbench_advice";
  workspaceMountMode: "read_write" | "read_only" | null;
}>;

/**
 * docker-recovery-runtime-internalで使用するDurable 記録の値契約を定義する。
 *
 * @responsibility Durable 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DurableRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DurableRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: DurableRecordの宣言は外部境界を開かない。
 * @security DurableRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DurableRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DurableRecord = {
  capability: object;
  recoveryId: string;
  managementCapability: object;
  operationId: string;
  operationNonce: string;
  stableLogicalHomeBindingHash: string;
  logicalHomeLease: Readonly<{ release: () => boolean }>;
  settlementContext: object | null;
  initializationReady: boolean;
  initializationIdentityJson: string;
  initializationResult?: ReturnType<
    typeof saveRuntimeOwnedCoordinatorOperationStart
  >;
  initializationFailure?: string;
  initializationHostResult?: ReturnType<
    typeof beginRuntimeOwnedCoordinatorHostSubmission
  >;
  initializationLeaseReleaseConfirmed?: boolean;
  consumer: ProductionPlan["consumer"];
  hostCleanupOutcome?: unknown;
  dockerCompletion?: unknown;
  settlementResult?: ReturnType<typeof settleRuntimeOwnedCoordinatorResult>;
  projectAcceptanceCheckpoint?: ReturnType<
    typeof acceptRuntimeOwnedCoordinatorProjectResult
  >;
  mountCompletion?: unknown;
  normalRestoration?: {
    plan: unknown;
    cleanupOutcome: unknown;
    mountCompletion: unknown;
    identityJson: string;
    result: ReturnType<typeof completeRuntimeOwnedCoordinatorHostSubmission>;
  };
  hostCleanupPreparation?: {
    token: string;
    tokenMatches: boolean;
    before: Buffer;
    candidate: Buffer;
  };
};

/**
 * docker-recovery-runtime-internalで使用するVerified Runtime 状態 Rootの値契約を定義する。
 *
 * @responsibility Verified Runtime 状態 RootのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape VerifiedRuntimeStateRootが表すProperty、識別子およびRelationを型として固定する。
 * @invariant VerifiedRuntimeStateRootで宣言した値と責務の対応を維持する。
 * @boundary N/A: VerifiedRuntimeStateRootの宣言は外部境界を開かない。
 * @security VerifiedRuntimeStateRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility VerifiedRuntimeStateRootの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type VerifiedRuntimeStateRoot = Readonly<{
  rootPath: string;
  runtimeStateIdentityHash: string;
  runtimeStateProtectionHash: string;
  localUserBindingHash: string;
  stableLogicalHomeBindingHash: string;
}>;

const durableRecords = new WeakMap<object, DurableRecord>();
const dockerHostCleanupCapabilities = new WeakMap<object, object>();
const releasedLogicalHomeLeases = new WeakSet<object>();
const completedHomeLeaseReleases = new WeakMap<
  object,
  Readonly<{
    managementCapability: object;
    operationId: string;
    recoveryId: string;
  }>
>();
/**
 * docker-recovery-runtime-internalで使用するDocker Restart Preparationの値契約を定義する。
 *
 * @responsibility Docker Restart PreparationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRestartPreparationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRestartPreparationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRestartPreparationの宣言は外部境界を開かない。
 * @security DockerRestartPreparationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerRestartPreparationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerRestartPreparation = Readonly<{
  root: VerifiedRuntimeStateRoot;
  directory: string;
  rootIdentity: string;
  directoryIdentity: string;
  recoveryIds: readonly string[];
  activeStableLogicalHomeBindingHashes: readonly string[];
  binding: DockerRestartBinding;
  submissionName: string;
  locks: readonly Readonly<{
    assertLive: () => boolean;
    release: () => boolean;
  }>[];
}> & {
  closed: boolean;
  persistenceFailed: boolean;
  records: Buffer[];
  originRecords: Buffer[];
  handoffs: Buffer[];
  continuationRecords: Buffer[];
  pendingHandoff: Buffer | null;
  continuation: boolean;
};
const dockerRestartPreparations = new WeakMap<
  object,
  DockerRestartPreparation
>();
/**
 * docker-recovery-runtime-internalで使用するVerified Docker Engine Restart Fenceの値契約を定義する。
 *
 * @responsibility Verified Docker Engine Restart FenceのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape VerifiedDockerEngineRestartFenceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant VerifiedDockerEngineRestartFenceで宣言した値と責務の対応を維持する。
 * @boundary N/A: VerifiedDockerEngineRestartFenceの宣言は外部境界を開かない。
 * @security VerifiedDockerEngineRestartFenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility VerifiedDockerEngineRestartFenceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type VerifiedDockerEngineRestartFence =
  | Readonly<{
      recoveryId: string;
      repairId: string;
      repairRecordSha256: string;
    }>
  | Readonly<{
      recoveryId: string;
      origin: "engine_restart";
      restartRecordSha256: string;
      pendingSubmissionSha256: string;
    }>;

/**
 * runtime 状態 Binding Evidenceを決定する。
 *
 * @responsibility runtime 状態 Binding Evidenceの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input root: VerifiedRuntimeStateRoot
 * @returns RuntimeStateBindingEvidenceを返す。
 * @precondition 「root: VerifiedRuntimeStateRoot」がruntimeStateBindingEvidenceの入力契約を満たす。
 * @postcondition runtimeStateBindingEvidenceの責務を完了した結果だけを返す。
 * @effect N/A: runtimeStateBindingEvidenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runtimeStateBindingEvidenceは独自の失敗分岐を所有しない。
 * @invariant runtimeStateBindingEvidenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runtimeStateBindingEvidenceはProcess内の同一Subsystemで完結する。
 * @security runtimeStateBindingEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runtimeStateBindingEvidenceは共有非同期状態を持たない同期処理である。
 */
function runtimeStateBindingEvidence(
  root: VerifiedRuntimeStateRoot,
): RuntimeStateBindingEvidence {
  return Object.freeze({
    runtimeStateIdentityHash: root.runtimeStateIdentityHash,
    runtimeStateProtectionHash: root.runtimeStateProtectionHash,
    localUserBindingHash: root.localUserBindingHash,
    runtimeStateBindingHash: root.stableLogicalHomeBindingHash,
  });
}

/**
 * Directory Mutation Boundaryを確定する。
 *
 * @responsibility Directory Mutation Boundaryの確定条件、不可逆Effect、失敗時の未確定境界を所有する。
 * @trace ARCH-000008
 * @input directory: string
 * @returns commitDirectoryMutationBoundaryの計算結果を返す。
 * @precondition 「directory: string」がcommitDirectoryMutationBoundaryの入力契約を満たす。
 * @postcondition commitDirectoryMutationBoundaryの責務を完了した結果だけを返す。
 * @effect commitDirectoryMutationBoundaryはFilesystemの読取りまたは書込みを実行する。
 * @failure commitDirectoryMutationBoundaryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant commitDirectoryMutationBoundaryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security commitDirectoryMutationBoundaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: commitDirectoryMutationBoundaryは共有非同期状態を持たない同期処理である。
 */
function commitDirectoryMutationBoundary(directory: string) {
  if (process.platform === "win32") {
    // Node.js 24 opens a Windows directory but fsyncSync returns EPERM. The
    // Local Personal v1 contract therefore guarantees process-crash recovery
    // from file-fsynced commit records and stable rereads; it does not claim
    // power-loss durability for directory metadata.
    const metadata = fs.lstatSync(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
      throw new Error("docker_recovery_directory_invalid");
    return;
  }
  const handle = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
}

/**
 * Durable Jsonを書き込む。
 *
 * @responsibility Durable Jsonの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input directory: string、name: string、value: unknown、logicalKey
 * @returns writeDurableJsonの計算結果を返す。
 * @precondition 「directory: string、name: string、value: unknown、logicalKey」がwriteDurableJsonの入力契約を満たす。
 * @postcondition writeDurableJsonの責務を完了した結果だけを返す。
 * @effect N/A: writeDurableJsonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: writeDurableJsonは独自の失敗分岐を所有しない。
 * @invariant writeDurableJsonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeDurableJsonはProcess内の同一Subsystemで完結する。
 * @security writeDurableJsonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: writeDurableJsonは共有非同期状態を持たない同期処理である。
 */
function writeDurableJson(
  directory: string,
  name: string,
  value: unknown,
  logicalKey = name,
) {
  const record = writeCommittedDockerRecoveryJson(
    directory,
    name,
    logicalKey,
    value,
  );
  commitDirectoryMutationBoundary(directory);
  return record;
}

/**
 * completed Docker 回復 Receipt Nameを決定する。
 *
 * @responsibility completed Docker 回復 Receipt Nameの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input recoveryId: string
 * @returns completedDockerRecoveryReceiptNameの計算結果を返す。
 * @precondition 「recoveryId: string」がcompletedDockerRecoveryReceiptNameの入力契約を満たす。
 * @postcondition completedDockerRecoveryReceiptNameの責務を完了した結果だけを返す。
 * @effect N/A: completedDockerRecoveryReceiptNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: completedDockerRecoveryReceiptNameは独自の失敗分岐を所有しない。
 * @invariant completedDockerRecoveryReceiptNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: completedDockerRecoveryReceiptNameはProcess内の同一Subsystemで完結する。
 * @security completedDockerRecoveryReceiptNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: completedDockerRecoveryReceiptNameは共有非同期状態を持たない同期処理である。
 */
function completedDockerRecoveryReceiptName(recoveryId: string) {
  return `completed-docker-recovery-${createHash("sha256")
    .update(recoveryId)
    .digest("hex")}.json`;
}

/**
 * acknowledged Docker 回復 Receipt Nameを決定する。
 *
 * @responsibility acknowledged Docker 回復 Receipt Nameの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input recoveryId: string
 * @returns acknowledgedDockerRecoveryReceiptNameの計算結果を返す。
 * @precondition 「recoveryId: string」がacknowledgedDockerRecoveryReceiptNameの入力契約を満たす。
 * @postcondition acknowledgedDockerRecoveryReceiptNameの責務を完了した結果だけを返す。
 * @effect N/A: acknowledgedDockerRecoveryReceiptNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: acknowledgedDockerRecoveryReceiptNameは独自の失敗分岐を所有しない。
 * @invariant acknowledgedDockerRecoveryReceiptNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: acknowledgedDockerRecoveryReceiptNameはProcess内の同一Subsystemで完結する。
 * @security acknowledgedDockerRecoveryReceiptNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: acknowledgedDockerRecoveryReceiptNameは共有非同期状態を持たない同期処理である。
 */
function acknowledgedDockerRecoveryReceiptName(recoveryId: string) {
  return `acknowledged-docker-recovery-${createHash("sha256")
    .update(recoveryId)
    .digest("hex")}.json`;
}

/**
 * Acknowledged Docker 回復 Receiptを観測する。
 *
 * @responsibility Acknowledged Docker 回復 Receiptの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input rootPath: string、recoveryId: string
 * @returns inspectAcknowledgedDockerRecoveryReceiptの計算結果を返す。
 * @precondition 「rootPath: string、recoveryId: string」がinspectAcknowledgedDockerRecoveryReceiptの入力契約を満たす。
 * @postcondition inspectAcknowledgedDockerRecoveryReceiptの責務を完了した結果だけを返す。
 * @effect N/A: inspectAcknowledgedDockerRecoveryReceiptは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectAcknowledgedDockerRecoveryReceiptは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectAcknowledgedDockerRecoveryReceiptは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectAcknowledgedDockerRecoveryReceiptはProcess内の同一Subsystemで完結する。
 * @security inspectAcknowledgedDockerRecoveryReceiptはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectAcknowledgedDockerRecoveryReceiptは共有非同期状態を持たない同期処理である。
 */
function inspectAcknowledgedDockerRecoveryReceipt(
  rootPath: string,
  recoveryId: string,
) {
  const name = acknowledgedDockerRecoveryReceiptName(recoveryId);
  const location = path.join(rootPath, name);
  if (!recoveryPathPresent(location)) return null;
  const record = readExactJson(location, name);
  const value = record.value as Record<string, unknown>;
  if (
    !exactRecordKeys(value, [
      "schema",
      "recoveryId",
      "runtimeStateBinding",
      "receiptContentHash",
      "receiptContentIdentity",
    ]) ||
    value.schema !== "crdd-coordinator-docker-recovery-acknowledgement/v1" ||
    value.recoveryId !== recoveryId ||
    !validRuntimeStateBindingEvidence(value.runtimeStateBinding) ||
    typeof value.receiptContentHash !== "string" ||
    !HEX64.test(value.receiptContentHash) ||
    typeof value.receiptContentIdentity !== "string" ||
    value.receiptContentIdentity.length < 1 ||
    value.receiptContentIdentity.length > 256
  )
    throw new Error("docker_task_recovery_acknowledgement_tombstone_invalid");
  return Object.freeze({
    name,
    runtimeStateBinding:
      value.runtimeStateBinding as RuntimeStateBindingEvidence,
    receiptContentHash: value.receiptContentHash as string,
    receiptContentIdentity: value.receiptContentIdentity as string,
  });
}

/**
 * Completed Docker 回復 Receiptを観測する。
 *
 * @responsibility Completed Docker 回復 Receiptの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input rootPath: string、recoveryId: string
 * @returns inspectCompletedDockerRecoveryReceiptの計算結果を返す。
 * @precondition 「rootPath: string、recoveryId: string」がinspectCompletedDockerRecoveryReceiptの入力契約を満たす。
 * @postcondition inspectCompletedDockerRecoveryReceiptの責務を完了した結果だけを返す。
 * @effect N/A: inspectCompletedDockerRecoveryReceiptは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectCompletedDockerRecoveryReceiptは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectCompletedDockerRecoveryReceiptは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectCompletedDockerRecoveryReceiptはProcess内の同一Subsystemで完結する。
 * @security inspectCompletedDockerRecoveryReceiptはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectCompletedDockerRecoveryReceiptは共有非同期状態を持たない同期処理である。
 */
function inspectCompletedDockerRecoveryReceipt(
  rootPath: string,
  recoveryId: string,
) {
  const name = completedDockerRecoveryReceiptName(recoveryId);
  const location = path.join(rootPath, name);
  if (!recoveryPathPresent(location)) return null;
  const record = readExactJson(location, name);
  const value = record.value as Record<string, unknown>;
  if (
    !exactRecordKeys(value, ["schema", "recoveryId", "runtimeStateBinding"]) ||
    value.schema !== "crdd-coordinator-docker-recovery-completion/v1" ||
    value.recoveryId !== recoveryId ||
    !validRuntimeStateBindingEvidence(value.runtimeStateBinding)
  )
    throw new Error("docker_task_recovery_completion_receipt_invalid");
  return Object.freeze({
    name,
    runtimeStateBinding:
      value.runtimeStateBinding as RuntimeStateBindingEvidence,
    receiptContentHash: record.hash,
    receiptContentIdentity: record.identityText,
  });
}

/**
 * Completed Docker 回復 Receiptが成立する状態を確保する。
 *
 * @responsibility Completed Docker 回復 Receiptの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000008
 * @input rootPath: string、recoveryId: string、runtimeStateBinding: RuntimeStateBindingEvidence
 * @returns ensureCompletedDockerRecoveryReceiptの計算結果を返す。
 * @precondition 「rootPath: string、recoveryId: string、runtimeStateBinding: RuntimeStateBindingEvidence」がensureCompletedDockerRecoveryReceiptの入力契約を満たす。
 * @postcondition ensureCompletedDockerRecoveryReceiptの責務を完了した結果だけを返す。
 * @effect N/A: ensureCompletedDockerRecoveryReceiptは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ensureCompletedDockerRecoveryReceiptは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ensureCompletedDockerRecoveryReceiptは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ensureCompletedDockerRecoveryReceiptはProcess内の同一Subsystemで完結する。
 * @security ensureCompletedDockerRecoveryReceiptはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ensureCompletedDockerRecoveryReceiptは共有非同期状態を持たない同期処理である。
 */
function ensureCompletedDockerRecoveryReceipt(
  rootPath: string,
  recoveryId: string,
  runtimeStateBinding: RuntimeStateBindingEvidence,
) {
  const existing = inspectCompletedDockerRecoveryReceipt(rootPath, recoveryId);
  if (existing) {
    if (
      JSON.stringify(existing.runtimeStateBinding) !==
      JSON.stringify(runtimeStateBinding)
    )
      throw new Error("docker_task_recovery_completion_receipt_mismatch");
    return;
  }
  const count = fs
    .readdirSync(rootPath)
    .filter((name) => COMPLETED_DOCKER_RECOVERY_RECEIPT.test(name)).length;
  if (count >= MAX_COMPLETED_DOCKER_RECOVERY_RECEIPTS)
    throw new Error("docker_task_recovery_completion_receipt_limit_exceeded");
  const name = completedDockerRecoveryReceiptName(recoveryId);
  writeDurableJson(rootPath, name, {
    schema: "crdd-coordinator-docker-recovery-completion/v1",
    recoveryId,
    runtimeStateBinding,
  });
  inspectCompletedDockerRecoveryReceipt(rootPath, recoveryId);
}

/**
 * docker-recovery-runtime-internalで使用するDocker Task Session Handoff 状態の値契約を定義する。
 *
 * @responsibility Docker Task Session Handoff 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerTaskSessionHandoffStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerTaskSessionHandoffStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerTaskSessionHandoffStateの宣言は外部境界を開かない。
 * @security DockerTaskSessionHandoffStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerTaskSessionHandoffStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerTaskSessionHandoffState = Readonly<{
  currentLocalUserBindingHash: string;
  tipSha256: string;
  count: number;
}>;

/**
 * docker Task Session Handoff Prefixを決定する。
 *
 * @responsibility docker Task Session Handoff Prefixの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input recoveryId: string
 * @returns dockerTaskSessionHandoffPrefixの計算結果を返す。
 * @precondition 「recoveryId: string」がdockerTaskSessionHandoffPrefixの入力契約を満たす。
 * @postcondition dockerTaskSessionHandoffPrefixの責務を完了した結果だけを返す。
 * @effect N/A: dockerTaskSessionHandoffPrefixは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: dockerTaskSessionHandoffPrefixは独自の失敗分岐を所有しない。
 * @invariant dockerTaskSessionHandoffPrefixは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: dockerTaskSessionHandoffPrefixはProcess内の同一Subsystemで完結する。
 * @security dockerTaskSessionHandoffPrefixはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: dockerTaskSessionHandoffPrefixは共有非同期状態を持たない同期処理である。
 */
function dockerTaskSessionHandoffPrefix(recoveryId: string) {
  return `docker-task-session-handoff-${createHash("sha256")
    .update(recoveryId)
    .digest("hex")}-`;
}

/**
 * Docker Task Session Handoffsを観測する。
 *
 * @responsibility Docker Task Session Handoffsの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input rootPath: string、recoveryId: string、durableBinding: RuntimeStateBindingEvidence
 * @returns DockerTaskSessionHandoffStateを返す。
 * @precondition 「rootPath: string、recoveryId: string、durableBinding: RuntimeStateBindingEvidence」がinspectDockerTaskSessionHandoffsの入力契約を満たす。
 * @postcondition inspectDockerTaskSessionHandoffsの責務を完了した結果だけを返す。
 * @effect N/A: inspectDockerTaskSessionHandoffsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectDockerTaskSessionHandoffsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectDockerTaskSessionHandoffsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectDockerTaskSessionHandoffsはProcess内の同一Subsystemで完結する。
 * @security inspectDockerTaskSessionHandoffsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectDockerTaskSessionHandoffsは共有非同期状態を持たない同期処理である。
 */
function inspectDockerTaskSessionHandoffs(
  rootPath: string,
  recoveryId: string,
  durableBinding: RuntimeStateBindingEvidence,
): DockerTaskSessionHandoffState {
  const parsed = parseDockerTaskRecoveryId(recoveryId);
  if (!parsed) throw new Error("docker_task_recovery_id_invalid");
  const prefix = dockerTaskSessionHandoffPrefix(recoveryId);
  const names = fs
    .readdirSync(rootPath, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.name.startsWith(prefix) &&
        !entry.name.endsWith(".crdd-commit.json"),
    );
  if (
    names.some((entry) => !entry.isFile() || entry.isSymbolicLink()) ||
    names.length > MAX_DOCKER_TASK_SESSION_HANDOFFS
  )
    throw new Error("docker_task_session_handoff_invalid");
  const orderedItems = names.map((entry) => entry.name).sort();
  let currentLocalUserBindingHash = durableBinding.localUserBindingHash;
  let tipSha256 = parsed.baseHash;
  const visited = new Set([currentLocalUserBindingHash]);
  for (let index = 0; index < orderedItems.length; index += 1) {
    const name = orderedItems[index];
    const matched = DOCKER_TASK_SESSION_HANDOFF.exec(name ?? "");
    const record = readExactJson(path.join(rootPath, name ?? ""), name)
      .value as Record<string, unknown>;
    if (
      !matched ||
      Number(matched[2]) !== index ||
      createHash("sha256").update(recoveryId).digest("hex") !== matched[1] ||
      !exactRecordKeys(record, [
        "schema",
        "recoveryId",
        "sequence",
        "previousHandoffSha256",
        "fromLocalUserBindingHash",
        "toLocalUserBindingHash",
        "runtimeStateIdentityHash",
        "runtimeStateProtectionHash",
        "runtimeStateBindingHash",
        "operationNonce",
        "baseHash",
      ]) ||
      record.schema !== "crdd-coordinator/docker-task-session-handoff/v1" ||
      record.recoveryId !== recoveryId ||
      record.sequence !== index ||
      record.previousHandoffSha256 !== tipSha256 ||
      record.fromLocalUserBindingHash !== currentLocalUserBindingHash ||
      typeof record.toLocalUserBindingHash !== "string" ||
      !HEX64.test(record.toLocalUserBindingHash) ||
      record.toLocalUserBindingHash === currentLocalUserBindingHash ||
      visited.has(record.toLocalUserBindingHash) ||
      record.runtimeStateIdentityHash !==
        durableBinding.runtimeStateIdentityHash ||
      record.runtimeStateProtectionHash !==
        durableBinding.runtimeStateProtectionHash ||
      record.runtimeStateBindingHash !==
        durableBinding.runtimeStateBindingHash ||
      record.operationNonce !== parsed.operationNonce ||
      record.baseHash !== parsed.baseHash
    )
      throw new Error("docker_task_session_handoff_invalid");
    currentLocalUserBindingHash = record.toLocalUserBindingHash;
    visited.add(currentLocalUserBindingHash);
    tipSha256 = readExactJson(path.join(rootPath, name ?? ""), name).hash;
  }
  return Object.freeze({
    currentLocalUserBindingHash,
    tipSha256,
    count: orderedItems.length,
  });
}

/**
 * Docker Task Session Handoffが成立する状態を確保する。
 *
 * @responsibility Docker Task Session Handoffの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000008
 * @input root: VerifiedRuntimeStateRoot、recoveryId: string、durableBinding: RuntimeStateBindingEvidence
 * @returns ensureDockerTaskSessionHandoffの計算結果を返す。
 * @precondition 「root: VerifiedRuntimeStateRoot、recoveryId: string、durableBinding: RuntimeStateBindingEvidence」がensureDockerTaskSessionHandoffの入力契約を満たす。
 * @postcondition ensureDockerTaskSessionHandoffの責務を完了した結果だけを返す。
 * @effect N/A: ensureDockerTaskSessionHandoffは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ensureDockerTaskSessionHandoffは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ensureDockerTaskSessionHandoffは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ensureDockerTaskSessionHandoffはProcess内の同一Subsystemで完結する。
 * @security ensureDockerTaskSessionHandoffはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ensureDockerTaskSessionHandoffは共有非同期状態を持たない同期処理である。
 */
function ensureDockerTaskSessionHandoff(
  root: VerifiedRuntimeStateRoot,
  recoveryId: string,
  durableBinding: RuntimeStateBindingEvidence,
) {
  const current = inspectDockerTaskSessionHandoffs(
    root.rootPath,
    recoveryId,
    durableBinding,
  );
  if (current.currentLocalUserBindingHash === root.localUserBindingHash)
    return current;
  if (current.count >= MAX_DOCKER_TASK_SESSION_HANDOFFS)
    throw new Error("docker_task_session_handoff_limit_exceeded");
  const parsed = parseDockerTaskRecoveryId(recoveryId);
  if (!parsed) throw new Error("docker_task_recovery_id_invalid");
  const name = `${dockerTaskSessionHandoffPrefix(recoveryId)}${String(
    current.count,
  ).padStart(2, "0")}.json`;
  writeDurableJson(root.rootPath, name, {
    schema: "crdd-coordinator/docker-task-session-handoff/v1",
    recoveryId,
    sequence: current.count,
    previousHandoffSha256: current.tipSha256,
    fromLocalUserBindingHash: current.currentLocalUserBindingHash,
    toLocalUserBindingHash: root.localUserBindingHash,
    runtimeStateIdentityHash: durableBinding.runtimeStateIdentityHash,
    runtimeStateProtectionHash: durableBinding.runtimeStateProtectionHash,
    runtimeStateBindingHash: durableBinding.runtimeStateBindingHash,
    operationNonce: parsed.operationNonce,
    baseHash: parsed.baseHash,
  });
  const rebound = inspectDockerTaskSessionHandoffs(
    root.rootPath,
    recoveryId,
    durableBinding,
  );
  if (rebound.currentLocalUserBindingHash !== root.localUserBindingHash)
    throw new Error("docker_task_session_handoff_write_unknown");
  return rebound;
}

/**
 * Production Planが有効か判定する。
 *
 * @responsibility Production Planの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input plan: ProductionPlan
 * @returns validProductionPlanの計算結果を返す。
 * @precondition 「plan: ProductionPlan」がvalidProductionPlanの入力契約を満たす。
 * @postcondition validProductionPlanの責務を完了した結果だけを返す。
 * @effect N/A: validProductionPlanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validProductionPlanは独自の失敗分岐を所有しない。
 * @invariant validProductionPlanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validProductionPlanはProcess内の同一Subsystemで完結する。
 * @security validProductionPlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validProductionPlanは共有非同期状態を持たない同期処理である。
 */
function validProductionPlan(plan: ProductionPlan) {
  return (
    plan !== null &&
    typeof plan === "object" &&
    coordinatorConsumerCompletionPolicy(plan.consumer) !== null &&
    (plan.provider === "codex" || plan.provider === "claude") &&
    /^OP-[0-9]{6,}$/u.test(plan.operationId) &&
    /^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(plan.grantRef) &&
    /^PROFILE-[0-9]{6,}$/u.test(plan.profileId) &&
    [
      plan.providerHomeIdentityHash,
      plan.providerHomeProtectionHash,
      plan.localUserBindingHash,
      plan.stableLogicalHomeBindingHash,
    ].every((value) => HEX64.test(value)) &&
    [
      plan.authContainerName,
      plan.providerContainerName,
      plan.proxyContainerName,
      plan.internalNetworkName,
      plan.egressNetworkName,
    ].every((value) => SAFE_RESOURCE.test(value)) &&
    /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(plan.ownershipLabel) &&
    /^sha256:[a-f0-9]{64}$/u.test(plan.providerImageDigest) &&
    /^sha256:[a-f0-9]{64}$/u.test(plan.proxyImageDigest) &&
    (plan.operationMode === "boolean_probe" ||
      plan.operationMode === "isolated_task" ||
      plan.operationMode === "workbench_advice") &&
    (plan.workspaceMountMode === null ||
      plan.workspaceMountMode === "read_write" ||
      plan.workspaceMountMode === "read_only")
  );
}

/**
 * expected Host Successorを決定する。
 *
 * @responsibility expected Host Successorの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input currentToken: string、nextState: string
 * @returns expectedHostSuccessorの計算結果を返す。
 * @precondition 「currentToken: string、nextState: string」がexpectedHostSuccessorの入力契約を満たす。
 * @postcondition expectedHostSuccessorの責務を完了した結果だけを返す。
 * @effect N/A: expectedHostSuccessorは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: expectedHostSuccessorは独自の失敗分岐を所有しない。
 * @invariant expectedHostSuccessorは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: expectedHostSuccessorはProcess内の同一Subsystemで完結する。
 * @security expectedHostSuccessorはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: expectedHostSuccessorは共有非同期状態を持たない同期処理である。
 */
function expectedHostSuccessor(currentToken: string, nextState: string) {
  const loaded = loadHostRecoveryRecordByToken(currentToken);
  const serialized = canonical({ ...loaded.record, state: nextState });
  const hash = createHash("sha256").update(serialized).digest("hex");
  return Object.freeze({
    currentToken,
    expectedToken: `host.${loaded.parsed.rootName}.${loaded.parsed.nonce}.${hash}`,
    rootName: loaded.parsed.rootName,
    nonce: loaded.parsed.nonce,
    currentState: loaded.record.state,
    nextState,
    recordBefore: loaded.record,
  });
}

/**
 * Host Transition Lineageの契約を検証する。
 *
 * @responsibility Host Transition Lineageの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input intent: Record<string, unknown>、requiredNextState: string
 * @returns validateHostTransitionLineageの計算結果を返す。
 * @precondition 「intent: Record<string, unknown>、requiredNextState: string」がvalidateHostTransitionLineageの入力契約を満たす。
 * @postcondition validateHostTransitionLineageの責務を完了した結果だけを返す。
 * @effect N/A: validateHostTransitionLineageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateHostTransitionLineageは独自の失敗分岐を所有しない。
 * @invariant validateHostTransitionLineageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateHostTransitionLineageはProcess内の同一Subsystemで完結する。
 * @security validateHostTransitionLineageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateHostTransitionLineageは共有非同期状態を持たない同期処理である。
 */
function validateHostTransitionLineage(
  intent: Record<string, unknown>,
  requiredNextState?: string,
) {
  return validateDockerHostTransitionLineage(intent, requiredNextState);
}

/**
 * Host Marker Transitionを分類する。
 *
 * @responsibility Host Marker Transitionの分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input intent: Record<string, unknown>、expectedRoot: string、expectedNonce: string
 * @returns classifyHostMarkerTransitionの計算結果を返す。
 * @precondition 「intent: Record<string, unknown>、expectedRoot: string、expectedNonce: string」がclassifyHostMarkerTransitionの入力契約を満たす。
 * @postcondition classifyHostMarkerTransitionの責務を完了した結果だけを返す。
 * @effect N/A: classifyHostMarkerTransitionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure classifyHostMarkerTransitionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant classifyHostMarkerTransitionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyHostMarkerTransitionはProcess内の同一Subsystemで完結する。
 * @security classifyHostMarkerTransitionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyHostMarkerTransitionは共有非同期状態を持たない同期処理である。
 */
function classifyHostMarkerTransition(
  intent: Record<string, unknown>,
  expectedRoot: string,
  expectedNonce: string,
) {
  const { currentToken, expectedToken, current, expected } =
    validateHostTransitionLineage(intent);
  if (
    current.rootName !== path.basename(expectedRoot) ||
    expected.rootName !== current.rootName ||
    current.nonce !== expectedNonce ||
    expected.nonce !== expectedNonce
  )
    throw new Error("docker_task_recovery_host_transition_mismatch");
  try {
    const loaded = loadHostRecoveryRecordByToken(expectedToken);
    if (
      path.join(loaded.parent, loaded.parsed.rootName) !== expectedRoot ||
      loaded.marker !== (intent.markerPath ?? loaded.marker) ||
      loaded.record.state !== intent.nextState
    )
      throw new Error("docker_task_recovery_host_transition_mismatch");
    return Object.freeze({
      state: "expected" as const,
      currentToken,
      expectedToken,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "docker_task_recovery_host_transition_mismatch"
    )
      throw error;
  }
  try {
    const loaded = loadHostRecoveryRecordByToken(currentToken);
    if (
      path.join(loaded.parent, loaded.parsed.rootName) !== expectedRoot ||
      loaded.record.state !== intent.currentState
    )
      throw new Error("docker_task_recovery_host_transition_mismatch");
    return Object.freeze({
      state: "previous" as const,
      currentToken,
      expectedToken,
    });
  } catch {
    throw new Error("docker_task_recovery_host_transition_third_state");
  }
}

/**
 * 実Home排他と単一現在状態を確定してHostのDocker開始へ接続する。
 * @responsibility 実Home排他と単一現在状態を確定してHostのDocker開始へ接続する。
 * @trace ARCH-000008
 * @input plan: 固定計画。managementCapability: 実Host Owner。
 * @returns ready、または同じ回復参照を保持した停止結果。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect Home排他、Repository内state.jsonと所有Hostの開始遷移だけ。
 * @failure 観測・保存・遷移不明では停止し、取得済み参照を保持する。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
function beginProductionRecovery(
  plan: ProductionPlan,
  managementCapability: unknown,
) {
  if (!validProductionPlan(plan)) return null;
  const development =
    inspectRuntimeOwnedDevelopmentOperationContext(managementCapability);
  if (development && !development.checkNewWork()) return null;
  const observation = inspectRuntimeOwnedWindowsProviderHomeCandidate(
    plan.provider,
    new Date().toISOString(),
    development?.newWorkContext,
  );
  const home = consumeRuntimeOwnedProviderHomeObservationCapability(
    observation.observationCapability,
  );
  if (
    observation.status !== "candidate" ||
    !home ||
    home.providerHomeIdentityHash !== plan.providerHomeIdentityHash ||
    home.providerHomeProtectionHash !== plan.providerHomeProtectionHash ||
    home.localUserBindingHash !== plan.localUserBindingHash ||
    home.stableLogicalHomeBindingHash !== plan.stableLogicalHomeBindingHash
  )
    return null;
  const lease = acquireRuntimeOwnedLogicalProviderHomeKernelLock(
    plan.stableLogicalHomeBindingHash,
  );
  if (!lease) throw new Error("docker_recovery_provider_home_lock_unavailable");
  let isTransferred = false;
  let recoveryId: string | null = null;
  let capability: object | null = null;
  try {
    const operation =
      verifyOwnedOperationManagementCapability(managementCapability);
    if (operation.operationId !== plan.operationId)
      throw new Error("docker_recovery_operation_binding_invalid");
    const current =
      readRuntimeOwnedCoordinatorStateSnapshot(managementCapability);
    if (
      current.value?.snapshot.operations.some(
        (item) =>
          JSON.parse(item.identityJson).stableLogicalHomeBindingHash ===
            plan.stableLogicalHomeBindingHash && item.lease !== "released",
      )
    )
      throw new Error("docker_recovery_runtime_state_conflict");
    const nonce = randomBytes(32).toString("hex");
    const identityJson = prepareRuntimeOwnedRepositoryDockerOperationIdentity(
      plan,
      managementCapability,
      nonce,
      plan.consumer,
    );
    if (!identityJson)
      throw new Error("docker_recovery_operation_binding_invalid");
    const repository =
      borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
    const initialBytes = repository
      ? prepareCoordinatorStateOperationSnapshot(
          null,
          identityJson,
          repository.repositoryBinding,
        )
      : null;
    const initial =
      initialBytes && repository
        ? decodeCoordinatorStateSnapshot(
            initialBytes,
            repository.repositoryBinding,
          )
        : null;
    recoveryId = initial?.snapshot.operations[0]?.recoveryId ?? null;
    if (!recoveryId)
      throw new Error("docker_recovery_operation_binding_invalid");
    capability = Object.freeze({});
    const record: DurableRecord = {
      capability,
      managementCapability: managementCapability as object,
      operationId: operation.operationId,
      operationNonce: nonce,
      recoveryId,
      stableLogicalHomeBindingHash: plan.stableLogicalHomeBindingHash,
      logicalHomeLease: lease,
      settlementContext: null,
      initializationReady: false,
      initializationIdentityJson: identityJson,
      consumer: plan.consumer,
    };
    durableRecords.set(capability, record);
    isTransferred = true;
    const saved = saveRuntimeOwnedCoordinatorOperationStart(
      managementCapability,
      identityJson,
    );
    record.initializationResult = saved;
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased ||
      saved.recoveryId !== recoveryId
    )
      throw new Error(saved.reason);
    const context = prepareRuntimeOwnedCoordinatorSettlement(
      managementCapability,
      recoveryId,
      plan.consumer,
    );
    if (!context) throw new Error("docker_recovery_settlement_binding_invalid");
    record.settlementContext = context;
    const started = beginRuntimeOwnedCoordinatorHostSubmission(
      managementCapability,
      recoveryId,
    );
    record.initializationHostResult = started;
    if (started.status !== "completed" || !started.hostTransitionConfirmed) {
      record.initializationFailure = started.reason;
      return Object.freeze({
        status: "blocked" as const,
        recoveryId,
        recoveryCapability: capability,
        reason: started.reason,
        manualRecoveryRequired: true,
      });
    }
    record.initializationReady = true;
    return Object.freeze({
      status: "ready" as const,
      recoveryId,
      recoveryCapability: capability,
    });
  } catch (error) {
    const record = capability ? durableRecords.get(capability) : null;
    const reason = safeRecoveryReason(
      error,
      "docker_recovery_initialization_failed_closed",
    );
    if (record && capability) {
      record.initializationFailure = reason;
      record.initializationLeaseReleaseConfirmed = false;
      try {
        record.initializationLeaseReleaseConfirmed = lease.release();
      } catch {
        // 元の開始失敗とexact Ownerを保持し、解放例外を成功へ丸めない。
      }
      if (record.initializationLeaseReleaseConfirmed)
        releasedLogicalHomeLeases.add(capability);
    }
    return Object.freeze({
      status: "blocked" as const,
      recoveryId,
      ...(capability ? { recoveryCapability: capability } : {}),
      reason,
      manualRecoveryRequired: true,
    });
  } finally {
    if (!isTransferred && !lease.release()) {
      // biome-ignore lint/correctness/noUnsafeFinally: actual lease release failure cannot return ready.
      return Object.freeze({
        status: "blocked" as const,
        recoveryId,
        reason: "docker_task_recovery_home_lock_release_unconfirmed",
        manualRecoveryRequired: true,
      });
    }
  }
}

/**
 * 現在Repositoryと実Hostから最新の開始Identityを組み立てる。
 * @responsibility AppData RuntimeStateを観測せず、検証済み計画・同じ操作Owner・初期Hostを固定本文へ結合する。
 * @trace ARCH-000008
 * @input plan: Runtimeの固定計画、managementCapability: 同じ操作Owner、operationNonce: 新操作世代、consumer: 本番組立てに固定された利用側。
 * @returns 正規Identity本文、または検証不能のnull。
 * @precondition Provider Homeの現在観測・Lease取得は呼出し元の開始Ownerが別途確認する。
 * @postcondition 旧Root結合やCaller supplied Pathを新形式へ持ち込まない。
 * @effect Repositoryと既存Host記録の読取りのみ。保存・Docker要求・Lease取得は行わない。
 * @failure 別操作、不正計画・世代、Root失効、Host観測不能ではnull。
 * @invariant Identityの組立てを保存確定やProvider起動許可と扱わない。
 * @boundary 本番開始OwnerからRepository-local現在状態形式への内部搬送。
 * @security Host Pathは観測値であり、処置許可や公開情報ではない。
 * @concurrency Rootと操作Ownerを組立て後に再確認し、保存直前の検査はWriterが行う。
 */
export function prepareRuntimeOwnedRepositoryDockerOperationIdentity(
  plan: ProductionPlan,
  managementCapability: unknown,
  operationNonce: unknown,
  consumer: unknown,
): string | null {
  try {
    if (
      !validProductionPlan(plan) ||
      coordinatorConsumerCompletionPolicy(consumer) === null ||
      consumer !== plan.consumer ||
      typeof operationNonce !== "string" ||
      !HEX64.test(operationNonce)
    )
      return null;
    const repository =
      borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
    if (!repository || repository.operationId !== plan.operationId) return null;
    const ownedHost = borrowOwnedHostRecoverySnapshot(managementCapability);
    const initialHostRecoveryId = ownedHost.snapshot.token;
    const initialHostRecovery = ownedHost.snapshot;
    const identity = {
      schema: "crdd-coordinator/operation-identity/v1",
      operationNonce,
      provider: plan.provider,
      consumer,
      operationId: plan.operationId,
      grantRef: plan.grantRef,
      profileId: plan.profileId,
      stableLogicalHomeBindingHash: plan.stableLogicalHomeBindingHash,
      providerHomeIdentityHash: plan.providerHomeIdentityHash,
      providerHomeProtectionHash: plan.providerHomeProtectionHash,
      localUserBindingHash: plan.localUserBindingHash,
      repositoryBinding: repository.repositoryBinding,
      ownershipLabel: plan.ownershipLabel,
      resources: {
        auth: plan.authContainerName,
        provider: plan.providerContainerName,
        proxy: plan.proxyContainerName,
        internal: plan.internalNetworkName,
        egress: plan.egressNetworkName,
      },
      images: {
        provider: plan.providerImageDigest,
        proxy: plan.proxyImageDigest,
      },
      operationMode: plan.operationMode,
      workspaceMountMode: plan.workspaceMountMode,
      ...(plan.recoveryCorrelationId
        ? { recoveryCorrelationId: plan.recoveryCorrelationId }
        : {}),
      initialHostRecoveryId,
      initialHostRecovery,
      hostPaths: ownedHost.hostPaths,
    };
    const identityJson = `${JSON.stringify(identity)}\n`;
    return prepareCoordinatorStateOperationSnapshot(
      null,
      identityJson,
      repository.repositoryBinding,
    ) && repository.revalidate()
      ? identityJson
      : null;
  } catch {
    return null;
  }
}

/**
 * durable 記録を決定する。
 *
 * @responsibility durable 記録の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns durableRecordの計算結果を返す。
 * @precondition 「capability: unknown」がdurableRecordの入力契約を満たす。
 * @postcondition durableRecordの責務を完了した結果だけを返す。
 * @effect N/A: durableRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: durableRecordは独自の失敗分岐を所有しない。
 * @invariant durableRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: durableRecordはProcess内の同一Subsystemで完結する。
 * @security durableRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: durableRecordは共有非同期状態を持たない同期処理である。
 */
function durableRecord(capability: unknown, isRequireInitialized = true) {
  const record =
    capability && typeof capability === "object"
      ? (durableRecords.get(capability) ?? null)
      : null;
  return record &&
    record.capability === capability &&
    (!isRequireInitialized || record.initializationReady)
    ? record
    : null;
}

/**
 * 真正な初期化停止を照合し、返却結果の寿命に元Ownerを結合する。
 * @responsibility 元失敗・回復参照を保持し、公開停止結果を処置Capabilityにしない。
 * @trace ARCH-000008
 * @input capability: 元Owner、recoveryId・management・homeHash・reason: 元停止相関、result: 寿命保持結果またはnull。
 * @returns 元の初期化停止と一致する場合だけtrue。
 * @precondition 固定Identityから既存Ownerを作成済みである。
 * @postcondition 停止結果aliasから通常処置やLease解放を許可しない。
 * @effect 既存Process内WeakMapへの同recordの寿命結合だけ。
 * @failure 偽Owner、別参照・管理Owner・Home・理由、開始成功済みはfalse。
 * @invariant unknownや清掃未確認を成功へ変更しない。
 * @boundary 本番開始OwnerからController停止結果への内部搬送。
 * @security 元Capabilityとのobject一致を処置入口で維持する。
 * @concurrency N/A: 同期照合と寿命保持のみ。
 */
export function bindRuntimeOwnedDockerInitializationFailure(
  capability: unknown,
  recoveryId: unknown,
  managementCapability: unknown,
  homeHash: unknown,
  reason: unknown,
  result: object | null,
): boolean {
  const record = durableRecord(capability, false);
  if (
    !record ||
    record.initializationReady ||
    !record.initializationFailure ||
    record.initializationFailure !== reason ||
    record.recoveryId !== recoveryId ||
    record.managementCapability !== managementCapability ||
    record.stableLogicalHomeBindingHash !== homeHash
  )
    return false;
  if (result !== null) durableRecords.set(result, record);
  return true;
}

/**
 * Runtime 所有 Docker 回復 Bindingを検証する。
 *
 * @responsibility Runtime 所有 Docker 回復 Bindingの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input recoveryCapability: unknown、recoveryId: unknown、managementCapability: unknown、stableLogicalHomeBindingHash: unknown
 * @returns verifyRuntimeOwnedDockerRecoveryBindingの計算結果を返す。
 * @precondition 「recoveryCapability: unknown、recoveryId: unknown、managementCapability: unknown、stableLogicalHomeBindingHash: unknown」がverifyRuntimeOwnedDockerRecoveryBindingの入力契約を満たす。
 * @postcondition verifyRuntimeOwnedDockerRecoveryBindingの責務を完了した結果だけを返す。
 * @effect N/A: verifyRuntimeOwnedDockerRecoveryBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifyRuntimeOwnedDockerRecoveryBindingは独自の失敗分岐を所有しない。
 * @invariant verifyRuntimeOwnedDockerRecoveryBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyRuntimeOwnedDockerRecoveryBindingはProcess内の同一Subsystemで完結する。
 * @security verifyRuntimeOwnedDockerRecoveryBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyRuntimeOwnedDockerRecoveryBindingは共有非同期状態を持たない同期処理である。
 */
export function verifyRuntimeOwnedDockerRecoveryBinding(
  recoveryCapability: unknown,
  recoveryId: unknown,
  managementCapability: unknown,
  stableLogicalHomeBindingHash: unknown,
) {
  const record = durableRecord(recoveryCapability);
  return (
    record !== null &&
    typeof recoveryId === "string" &&
    record.recoveryId === recoveryId &&
    record.managementCapability === managementCapability &&
    typeof stableLogicalHomeBindingHash === "string" &&
    record.stableLogicalHomeBindingHash === stableLogicalHomeBindingHash
  );
}

/**
 * Runtime 状態 Root From Windowsを観測する。
 *
 * @responsibility Runtime 状態 Root From Windowsの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input developmentContext: unknown
 * @returns observeRuntimeStateRootFromWindowsの計算結果を返す。
 * @precondition 「developmentContext: unknown」がobserveRuntimeStateRootFromWindowsの入力契約を満たす。
 * @postcondition observeRuntimeStateRootFromWindowsの責務を完了した結果だけを返す。
 * @effect N/A: observeRuntimeStateRootFromWindowsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observeRuntimeStateRootFromWindowsは独自の失敗分岐を所有しない。
 * @invariant observeRuntimeStateRootFromWindowsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeRuntimeStateRootFromWindowsはProcess内の同一Subsystemで完結する。
 * @security observeRuntimeStateRootFromWindowsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeRuntimeStateRootFromWindowsは共有非同期状態を持たない同期処理である。
 */
function observeRuntimeStateRootFromWindows(developmentContext?: unknown) {
  const observation = inspectRuntimeOwnedWindowsRuntimeState(
    false,
    new Date().toISOString(),
    developmentContext,
  );
  const current = consumeRuntimeOwnedRuntimeStateRootCapability(
    observation.rootCapability,
  );
  return observation.status === "candidate" && current ? current : null;
}

/**
 * Observed Runtime 状態 Mutation Boundaryを検証する。
 *
 * @responsibility Observed Runtime 状態 Mutation Boundaryの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input expected: Readonly<{ rootPath: string; runtimeStateIdentityHash: string; runtimeStateProtectionHash: string; localUserBindingHash: string; runtimeStateBindingHash: string; }>、recoveryId: string、current: VerifiedRuntimeStateRoot | null
 * @returns N/A: verifyObservedRuntimeStateMutationBoundaryは戻り値を返さない。
 * @precondition 「expected: Readonly<{ rootPath: string; runtimeStateIdentityHash: string; runtimeStateProtectionHash: string; localUserBindingHash: string; runtimeStateBindingHash: string; }>、recoveryId: string、current: VerifiedRuntimeStateRoot | null」がverifyObservedRuntimeStateMutationBoundaryの入力契約を満たす。
 * @postcondition verifyObservedRuntimeStateMutationBoundaryの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: verifyObservedRuntimeStateMutationBoundaryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyObservedRuntimeStateMutationBoundaryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyObservedRuntimeStateMutationBoundaryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyObservedRuntimeStateMutationBoundaryはProcess内の同一Subsystemで完結する。
 * @security verifyObservedRuntimeStateMutationBoundaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyObservedRuntimeStateMutationBoundaryは共有非同期状態を持たない同期処理である。
 */
function verifyObservedRuntimeStateMutationBoundary(
  expected: Readonly<{
    rootPath: string;
    runtimeStateIdentityHash: string;
    runtimeStateProtectionHash: string;
    localUserBindingHash: string;
    runtimeStateBindingHash: string;
  }>,
  recoveryId: string,
  current: VerifiedRuntimeStateRoot | null,
) {
  if (!current) throw new Error("docker_task_runtime_state_binding_changed");
  const inventory = inspectDockerRecoveryRootSnapshot(current.rootPath);
  if (
    inventory.status !== "completed" ||
    !isExactDockerRuntimeStateMutationBoundary(
      expected,
      Object.freeze({
        rootPath: current.rootPath,
        runtimeStateIdentityHash: current.runtimeStateIdentityHash,
        runtimeStateProtectionHash: current.runtimeStateProtectionHash,
        localUserBindingHash: current.localUserBindingHash,
        runtimeStateBindingHash: current.stableLogicalHomeBindingHash,
      }),
      inventory.dockerRecoveryIds,
      recoveryId,
    )
  )
    throw new Error("docker_task_runtime_state_audit_failed");
}

/**
 * 作成要求前の予定を単一現在状態へ保存する。
 * @responsibility 作成要求前の予定を単一現在状態へ保存する。
 * @trace ARCH-000008
 * @input recoveryCapability: 元Owner。purpose: 固定資源用途。
 * @returns 保存確定時だけtrue。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 同じstate.jsonの資源checkpoint。
 * @failure 不正用途・別操作・既要求・保存不明はfalse。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function markRuntimeOwnedDockerResourceSubmission(
  recoveryCapability: unknown,
  purpose: unknown,
) {
  const record = durableRecord(recoveryCapability);
  if (!record || typeof purpose !== "string" || !CREATE_PURPOSES.has(purpose))
    return false;
  const current = readRuntimeOwnedCoordinatorStateSnapshot(
    record.managementCapability,
  );
  const resource = current.value?.snapshot.operations
    .find((item) => item.recoveryId === record.recoveryId)
    ?.resources.find((item) => item.purpose === purpose);
  if (resource?.request !== "not_requested") return false;
  return (
    checkpointRuntimeOwnedCoordinatorResource(
      record.managementCapability,
      record.recoveryId,
      {
        ...resource,
        request: "intent_saved",
      },
    ).status === "completed"
  );
}

/**
 * Provider要求前の観測限界を同じ現在状態へ保存する。
 * @responsibility 元Controllerの要求前通知だけを実行評価checkpointへ接続する。
 * @trace ARCH-000008
 * @input recoveryCapability: 元Owner、notice: 同期保存中だけ有効な元通知。
 * @returns 保存確定と排他解放を確認した場合だけtrue。
 * @precondition 同じ本番操作は実行中で、終了要約をまだ固定していない。
 * @postcondition 初期評価をunknownへ進め、既知評価と他のlifecycle項目を維持する。
 * @effect 既存state.json Writerの六field checkpointだけ。
 * @failure 偽通知、失効、別操作、終端、保存不明はfalse。
 * @invariant Docker CLI開始や成功出力をProvider実開始・送信成立へ昇格しない。
 * @boundary Controllerの同期要求前境界とRepository内の現在状態。
 * @security 新しい実行・回復Authorityを発行しない。
 * @concurrency 既存Writerの短期排他と元版照合を使用する。
 */
export function recordRuntimeOwnedDockerProviderSubmission(
  recoveryCapability: unknown,
  notice: unknown,
) {
  const record = durableRecord(recoveryCapability);
  if (
    !record ||
    !verifyRuntimeOwnedDockerProviderSubmissionNotice(
      notice,
      recoveryCapability,
      record.managementCapability,
      record.operationId,
      record.recoveryId,
    )
  )
    return false;
  const current = readRuntimeOwnedCoordinatorStateSnapshot(
    record.managementCapability,
  );
  const operation = current.value?.snapshot.operations.find(
    (item) => item.recoveryId === record.recoveryId,
  );
  if (
    current.status !== "completed" ||
    !current.lockReleased ||
    !operation ||
    operation.phase !== "executing" ||
    operation.summarySha256 !== null ||
    operation.outcome !== null ||
    operation.execution.ownerEffect !== "active"
  )
    return false;
  const saved = checkpointRuntimeOwnedCoordinatorLifecycle(
    record.managementCapability,
    record.recoveryId,
    {
      phase: operation.phase,
      lease: operation.lease,
      execution: {
        ...operation.execution,
        providerStart:
          operation.execution.providerStart === "not_started"
            ? "unknown"
            : operation.execution.providerStart,
        externalSend:
          operation.execution.externalSend === "not_issued"
            ? "unknown"
            : operation.execution.externalSend,
        sharedWrite:
          operation.execution.sharedWrite === "not_issued"
            ? "unknown"
            : operation.execution.sharedWrite,
      },
      primaryFailure: operation.primaryFailure,
      outcome: operation.outcome,
      summarySha256: operation.summarySha256,
    },
  );
  return (
    saved.status === "completed" &&
    saved.snapshotConfirmed &&
    saved.lockReleased
  );
}

/**
 * Dockerが返したexact IDを元作成予定へ保存する。
 * @responsibility Dockerが返したexact IDを元作成予定へ保存する。
 * @trace ARCH-000008
 * @input recoveryCapability: 元Owner。purpose: 用途。rawDockerId: 元作成応答。
 * @returns 保存確定時だけtrue。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 同じstate.jsonの資源checkpoint。
 * @failure 予定欠落・ID不正・別ID・保存不明はfalse。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function recordRuntimeOwnedDockerResourceReceipt(
  recoveryCapability: unknown,
  purpose: unknown,
  rawDockerId: unknown,
) {
  const record = durableRecord(recoveryCapability);
  const dockerId = typeof rawDockerId === "string" ? rawDockerId.trim() : "";
  if (
    !record ||
    typeof purpose !== "string" ||
    !CREATE_PURPOSES.has(purpose) ||
    !HEX64.test(dockerId)
  )
    return false;
  const current = readRuntimeOwnedCoordinatorStateSnapshot(
    record.managementCapability,
  );
  const resource = current.value?.snapshot.operations
    .find((item) => item.recoveryId === record.recoveryId)
    ?.resources.find((item) => item.purpose === purpose);
  if (!resource || !["intent_saved", "issued"].includes(resource.request))
    return false;
  return (
    checkpointRuntimeOwnedCoordinatorResource(
      record.managementCapability,
      record.recoveryId,
      {
        ...resource,
        request: "identified",
        dockerId,
        receiptSource: "docker_create_result",
      },
    ).status === "completed"
  );
}

/**
 * 元Controllerの要求前取消だけを未発行として現在状態へ保存する。
 * @responsibility 予定保存後の取消を、応答欠落や過去unknownから区別する。
 * @trace ARCH-000008
 * @input recoveryCapability: 元Owner。purpose: 固定用途。notice: 同期callback中の元通知。
 * @returns 元通知の照合と保存が成立した場合だけtrue。
 * @precondition 本番ControllerがstartCommand前に取消を確認している。
 * @postcondition 元予定を保持し、未発行終端へ進める。
 * @effect 同じRepositoryの資源checkpointのみ。
 * @failure コピー・別用途・失効・既要求・保存不明はfalse。
 * @invariant ID欠落や清掃成功から未発行を推定しない。
 * @boundary 本番Controllerの元通知と現在状態Owner。
 * @security 通知から起動・削除Authorityを発行しない。
 * @concurrency 同期callbackの寿命内だけ既存Writerを呼ぶ。
 */
export function recordRuntimeOwnedDockerResourceNotIssued(
  recoveryCapability: unknown,
  purpose: unknown,
  notice: unknown,
) {
  const record = durableRecord(recoveryCapability);
  return (
    !!record &&
    checkpointRuntimeOwnedCoordinatorResourceNotIssued(
      record.managementCapability,
      record.recoveryId,
      purpose,
      notice,
      recoveryCapability,
    ).status === "completed"
  );
}

/**
 * 最新現在状態から固定五資源の要求とIDを読む。
 * @responsibility 最新現在状態から固定五資源の要求とIDを読む。
 * @trace ARCH-000008
 * @input recoveryCapability: 元Owner。
 * @returns 不変な資源投影、または観測不能のnull。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 同じstate.jsonの短期読取りだけ。
 * @failure Owner・読取り・排他解放不明はnull。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function inspectRuntimeOwnedDockerResourceReceipts(
  recoveryCapability: unknown,
) {
  const record = durableRecord(recoveryCapability);
  return record
    ? readRuntimeOwnedCoordinatorResourceRequests(
        record.managementCapability,
        record.recoveryId,
      )
    : null;
}

/**
 * 元清掃Ownerの五資源観測を現在状態へ保存する。
 * @responsibility 元清掃Ownerの五資源観測を現在状態へ保存する。
 * @trace ARCH-000008
 * @input recoveryCapability: 元Owner。observations: 元のexact観測。
 * @returns 保存確定時だけtrue。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 同じstate.jsonの資源checkpoint。
 * @failure 用途・名前・ID・根拠欠落または保存不明はfalse。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function recordRuntimeOwnedDockerAbsence(
  recoveryCapability: unknown,
  observations: unknown,
) {
  const record = durableRecord(recoveryCapability);
  return (
    !!record &&
    checkpointRuntimeOwnedCoordinatorCleanup(
      record.managementCapability,
      record.recoveryId,
      observations,
    ).status === "completed"
  );
}

/**
 * 元Mount終了結果を同じ操作のHost復帰へ保持する。
 * @responsibility 元Mount終了結果を同じ操作のHost復帰へ保持する。
 * @trace ARCH-000008
 * @input recoveryCapability: 元Owner。mountCompletion: 元Mount結果。
 * @returns 結果保持時true。真正性はHost復帰時に元計画と照合する。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect N/A: 元結果のProcess内保持だけ。
 * @failure 元Owner・結果欠落はfalse。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function recordRuntimeOwnedNormalMountCompletion(
  recoveryCapability: unknown,
  mountCompletion: unknown,
) {
  const record = durableRecord(recoveryCapability);
  if (!record || !mountCompletion || typeof mountCompletion !== "object")
    return false;
  record.mountCompletion = mountCompletion;
  return true;
}

/**
 * 実清掃とMount終了からHost通常復帰と実Lease解放を確定する。
 * @responsibility 実清掃とMount終了からHost通常復帰と実Lease解放を確定する。
 * @trace ARCH-000008
 * @input recoveryCapability、managementCapability: 元Owner。rawCompletion: 元計画・清掃・Mount結果。
 * @returns 元の終了限定Capability、または停止結果。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 現在状態、所有Host遷移と実Lease解放のみ。
 * @failure 元結果不一致・保存・Host・Lease解放不明は停止。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
function completeProductionRecovery(
  recoveryCapability: unknown,
  managementCapability: unknown,
  rawCompletion: unknown,
) {
  const record = durableRecord(recoveryCapability);
  const completion = snapshotPlainRecord(
    rawCompletion,
    new Set(["plan", "cleanupOutcome", "mountCompletion"]),
  );
  if (
    !record ||
    record.managementCapability !== managementCapability ||
    !completion ||
    completion.mountCompletion !== record.mountCompletion
  )
    return Object.freeze({ status: "blocked" as const });
  if (record.normalRestoration) {
    if (
      completion.plan !== record.normalRestoration.plan ||
      completion.cleanupOutcome !== record.normalRestoration.cleanupOutcome ||
      completion.mountCompletion !== record.normalRestoration.mountCompletion
    )
      return Object.freeze({ status: "blocked" as const });
  } else {
    const before =
      readRuntimeOwnedCoordinatorStateSnapshot(managementCapability);
    const previous = before.value?.snapshot.operations.find(
      (item) => item.recoveryId === record.recoveryId,
    );
    if (before.status !== "completed" || !previous)
      return Object.freeze({ status: "blocked" as const });
    const restored = completeRuntimeOwnedCoordinatorHostSubmission(
      managementCapability,
      record.recoveryId,
      completion.plan as Parameters<
        typeof completeRuntimeOwnedCoordinatorHostSubmission
      >[2],
      recoveryCapability,
      completion.cleanupOutcome,
      completion.mountCompletion,
    );
    if (restored.status !== "completed" || !restored.hostTransitionConfirmed)
      return Object.freeze({ ...restored, status: "blocked" as const });
    record.normalRestoration = {
      plan: completion.plan,
      cleanupOutcome: completion.cleanupOutcome,
      mountCompletion: completion.mountCompletion,
      identityJson: previous.identityJson,
      result: restored,
    };
  }
  const current =
    readRuntimeOwnedCoordinatorStateSnapshot(managementCapability);
  const operation = current.value?.snapshot.operations.find(
    (item) => item.recoveryId === record.recoveryId,
  );
  if (
    current.status !== "completed" ||
    !operation ||
    operation.identityJson !== record.normalRestoration.identityJson ||
    operation.phase !== "executing" ||
    operation.host.cleanup !== "not_requested" ||
    operation.host.pendingTransitionJson !== null
  )
    return Object.freeze({ status: "blocked" as const });
  const host = borrowOwnedHostRecoverySnapshot(managementCapability);
  if (
    host.snapshot.record.state !== "host_only" ||
    host.snapshot.token !== operation.host.currentToken
  )
    return Object.freeze({ status: "blocked" as const });
  if (!releasedLogicalHomeLeases.has(recoveryCapability as object)) {
    if (!record.logicalHomeLease.release())
      return Object.freeze({
        status: "blocked" as const,
        recoveryId: record.recoveryId,
      });
    completedHomeLeaseReleases.set(
      recoveryCapability as object,
      Object.freeze({
        managementCapability: record.managementCapability,
        operationId: record.operationId,
        recoveryId: record.recoveryId,
      }),
    );
    releasedLogicalHomeLeases.add(recoveryCapability as object);
  }
  const saved = checkpointRuntimeOwnedCoordinatorLifecycle(
    managementCapability,
    record.recoveryId,
    {
      phase: operation.phase,
      lease: "released",
      execution: operation.execution,
      primaryFailure: operation.primaryFailure,
      outcome: operation.outcome,
      summarySha256: operation.summarySha256,
    },
  );
  if (saved.status !== "completed")
    return Object.freeze({ ...saved, status: "blocked" as const });
  if (!dockerHostCleanupCapabilities.has(recoveryCapability as object))
    dockerHostCleanupCapabilities.set(
      recoveryCapability as object,
      issueOwnedHostCleanupCapability(managementCapability, recoveryCapability),
    );
  return Object.freeze({
    status: "completed" as const,
    recoveryFinalizationCapability: recoveryCapability as object,
  });
}

/**
 * 正常回収Ownerが実際に確認したHomeLease解放を照合する。
 *
 * @responsibility 正常経路の実release成功だけを同じ操作へ非Authorityの事実として保持する。
 * @trace ARCH-000008
 * @input recoveryCapability、managementCapability、operationId、recoveryId: 元の回復参照と操作相関。
 * @returns 同じ実解放を保持する場合だけtrue。
 * @precondition 正常回収Ownerが実releaseを成功確認した元Capabilityを使う。
 * @postcondition abandon、偽Capability、別操作と別参照は根拠にならない。
 * @effect N/A: 私有WeakMapの照合だけを行う。
 * @failure 未登録・相関不一致ではfalse。
 * @invariant 後続処理の失敗で既知の実解放を未解放へ戻さない。
 * @boundary 実HomeLease Ownerから同じ操作の終端保存への事実搬送。
 * @security 解放事実から起動・清掃・回復Authorityを復元しない。
 * @concurrency N/A: 同期照合だけを行いLockや外部待機を追加しない。
 */
export function verifyRuntimeOwnedDockerHomeLeaseRelease(
  recoveryCapability: unknown,
  managementCapability: unknown,
  operationId: unknown,
  recoveryId: unknown,
) {
  if (!recoveryCapability || typeof recoveryCapability !== "object")
    return false;
  const released = completedHomeLeaseReleases.get(recoveryCapability);
  return (
    !!released &&
    released.managementCapability === managementCapability &&
    released.operationId === operationId &&
    released.recoveryId === recoveryId
  );
}

/**
 * 真正終端の用途別配送を確認し、Process内Ownerを必要な間だけ保持する。
 * @responsibility 真正終端の用途別配送を確認し、Process内Ownerを必要な間だけ保持する。
 * @trace ARCH-000008
 * @input recoveryFinalizationCapability: 元終了Owner。
 * @returns 配送準備確認時completed。耐久ACK待ちは別結果で保持。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 既存終了driverの再入場のみ。
 * @failure 元Host・Controller結果欠落または終了保存不明は停止。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function finalizeRuntimeOwnedDockerRecovery(
  recoveryFinalizationCapability: unknown,
) {
  const record = durableRecord(recoveryFinalizationCapability);
  if (!record?.hostCleanupOutcome || !record.dockerCompletion)
    return Object.freeze({ status: "blocked" as const });
  const settled = settleRuntimeOwnedCoordinatorResult(
    record.settlementContext,
    record.hostCleanupOutcome,
    record.dockerCompletion,
  );
  record.settlementResult = settled;
  if (settled.status !== "completed") return settled;
  if (!settled.deliveryPending)
    durableRecords.delete(recoveryFinalizationCapability as object);
  return Object.freeze({ ...settled, status: "completed" as const });
}

/**
 * 元の耐久配送Ownerから保存済みの結果参照を読み戻す。
 * @responsibility 同じProcessの元Contextと固定Consumerを結果Readerへ接続する。
 * @trace ARCH-000008
 * @input recoveryFinalizationCapability: 同じ操作の元終了Owner。
 * @returns 保存・排他解放確認済みの五項目参照、または値を持たないblocked。
 * @precondition 元Host・Controller終端と結果登録を同じOwnerが保持している。
 * @postcondition 過去の返却結果をfresh観測として扱わない。
 * @effect 既存state.jsonの短期読取りのみ。
 * @failure 偽Owner、別Consumer、結果登録未確認、読取り・排他解放不明を拒否する。
 * @invariant 結果参照は起動・回収Authorityではない。
 * @boundary Docker終了OwnerとCoordinatorの固定結果搬送。
 * @security 任意Path、Hash、回復IDからOwnerを生成しない。
 * @concurrency 元OwnerのContextを使い、読取り排他を解放してから返す。
 */
export function readRuntimeOwnedDockerProjectResult(
  recoveryFinalizationCapability: unknown,
) {
  const record = durableRecord(recoveryFinalizationCapability);
  const refused = Object.freeze({
    status: "blocked" as const,
    reason: "coordinator_project_result_not_available",
    value: null,
    lockReleased: false,
  });
  if (
    record?.consumer !== "orchestrator" ||
    !record.settlementContext ||
    !record.hostCleanupOutcome ||
    !record.dockerCompletion ||
    record.settlementResult?.status !== "completed" ||
    record.settlementResult.deliveryPending !== true
  )
    return refused;
  const observed = readRuntimeOwnedCoordinatorSettlementResult(
    record.settlementContext,
    "orchestrator",
  );
  return observed.status === "completed" && observed.lockReleased
    ? observed
    : Object.freeze({ ...observed, status: "blocked" as const, value: null });
}

/**
 * 保存Ownerの耐久ACKで元の一配送を終了する。
 * @responsibility 元Context・真正終端・固定Readerを既存受理保存と整理へ接続する。
 * @trace ARCH-000008
 * @input recoveryFinalizationCapability: 元終了Owner、readProjectAcceptance: 固定組立ての同期Reader。
 * @returns 受理と整理の保存・排他解放・Effect別の元結果。
 * @precondition Orchestratorは同じAttemptのACKを保存し、上位Lockを解放済みである。
 * @postcondition 同じReaderの再入場だけを許可し、整理を毎回fresh照合する。
 * @effect 既存上位読取りとCoordinator現在状態の終了限定更新だけ。
 * @failure 偽Owner、別Consumer、Reader差替え、未受理、保存・排他不明を拒否する。
 * @invariant 受理保存確認と操作除去を分け、キャッシュから完了を生成しない。
 * @boundary Orchestratorの耐久受領と元Docker終了Owner。
 * @security 外部RequestからReader、Path、結果Hashや成功booleanを受け付けない。
 * @concurrency 受理確認後の再入場でも元入力で既存Writerのfresh照合を行う。
 */
export function completeRuntimeOwnedDockerProjectResultDelivery(
  recoveryFinalizationCapability: unknown,
  readProjectAcceptance: unknown,
) {
  const record = durableRecord(recoveryFinalizationCapability);
  if (
    record?.consumer !== "orchestrator" ||
    !record.hostCleanupOutcome ||
    !record.dockerCompletion ||
    record.settlementResult?.status !== "completed" ||
    record.settlementResult.deliveryPending !== true ||
    !bindRuntimeOwnedCoordinatorProjectAcceptanceReader(
      record.settlementContext,
      record.recoveryId,
      readProjectAcceptance,
    )
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "coordinator_project_result_acceptance_not_bound",
      filesystemEffectIssued: false,
      snapshotConfirmed: false,
      lockReleased: false,
    });
  let filesystemEffectIssued = false;
  if (!record.projectAcceptanceCheckpoint) {
    const accepted = acceptRuntimeOwnedCoordinatorProjectResult(
      record.settlementContext,
      record.hostCleanupOutcome,
      record.dockerCompletion,
    );
    filesystemEffectIssued = accepted.filesystemEffectIssued;
    if (
      accepted.status !== "completed" ||
      !accepted.snapshotConfirmed ||
      !accepted.lockReleased
    )
      return Object.freeze({ ...accepted, status: "blocked" as const });
    record.projectAcceptanceCheckpoint = accepted;
  }
  const completed = completeRuntimeOwnedCoordinatorSettlement(
    record.settlementContext,
    record.hostCleanupOutcome,
    record.dockerCompletion,
  );
  return Object.freeze({
    ...completed,
    status:
      completed.status === "completed" &&
      completed.snapshotConfirmed &&
      completed.lockReleased
        ? ("completed" as const)
        : ("blocked" as const),
    filesystemEffectIssued:
      filesystemEffectIssued || completed.filesystemEffectIssued,
  });
}

/**
 * 実通常復帰後の終了限定CapabilityをHost清掃へ渡す。
 * @responsibility 実通常復帰後の終了限定CapabilityをHost清掃へ渡す。
 * @trace ARCH-000008
 * @input recoveryFinalizationCapability: 元終了Owner。
 * @returns 元Host回復token、またはnull。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 同じstate.jsonへHost清掃予定を保存する。
 * @failure Capability欠落・Host不一致・保存不明ではnull。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function prepareRuntimeOwnedDockerHostCleanup(
  recoveryFinalizationCapability: unknown,
) {
  const record = durableRecord(recoveryFinalizationCapability);
  const capability =
    recoveryFinalizationCapability &&
    typeof recoveryFinalizationCapability === "object"
      ? dockerHostCleanupCapabilities.get(recoveryFinalizationCapability)
      : null;
  if (!record) return null;
  if (record.hostCleanupPreparation) {
    if (!record.hostCleanupPreparation.tokenMatches) return null;
    const saved = writeRuntimeOwnedCoordinatorStateSnapshot(
      record.managementCapability,
      record.hostCleanupPreparation.candidate,
    );
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased
    )
      return null;
    dockerHostCleanupCapabilities.delete(
      recoveryFinalizationCapability as object,
    );
    return record.hostCleanupPreparation.token;
  }
  if (!capability) return null;
  const current = readRuntimeOwnedCoordinatorStateSnapshot(
    record.managementCapability,
  );
  const operation = current.value?.snapshot.operations.find(
    (item) => item.recoveryId === record.recoveryId,
  );
  if (
    operation?.host.cleanup !== "not_requested" ||
    operation.lease !== "released"
  )
    return null;
  const repository = borrowRuntimeOwnedCoordinatorStateRepository(
    record.managementCapability,
  );
  if (!repository || current.status !== "completed" || !current.value)
    return null;
  const before = Buffer.from(
    `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
  );
  const candidate = prepareCoordinatorStateHostSnapshot(
    before,
    record.recoveryId,
    { ...operation.host, cleanup: "pending" },
    repository.repositoryBinding,
  );
  if (!candidate) return null;
  const token = consumeOwnedHostRecoveryIdForCleanup(
    capability,
    recoveryFinalizationCapability,
  );
  record.hostCleanupPreparation = {
    token,
    tokenMatches: token === operation.host.currentToken,
    before,
    candidate,
  };
  if (token !== operation.host.currentToken) return null;
  const saved = writeRuntimeOwnedCoordinatorStateSnapshot(
    record.managementCapability,
    candidate,
  );
  if (
    saved.status !== "completed" ||
    !saved.snapshotConfirmed ||
    !saved.lockReleased
  )
    return null;
  dockerHostCleanupCapabilities.delete(
    recoveryFinalizationCapability as object,
  );
  return token;
}

/**
 * 元Host清掃と元Controller結果を終了driverへ接続する。
 * @responsibility 元Host清掃と元Controller結果を終了driverへ接続する。
 * @trace ARCH-000008
 * @input recoveryFinalizationCapability: 元Owner。rawCompletion: 元Host・Controller結果。
 * @returns 終了保存と配送準備を確認した場合だけtrue。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 現在状態と履歴の保存のみ。
 * @failure 偽結果・別操作・実終了または保存未確認はfalse。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function recordRuntimeOwnedDockerHostCleanupReceipt(
  recoveryFinalizationCapability: unknown,
  rawCompletion: unknown,
) {
  const record = durableRecord(recoveryFinalizationCapability);
  const completion = snapshotPlainRecord(
    rawCompletion,
    new Set(["hostCleanupOutcome", "dockerCompletion"]),
  );
  if (!record || !completion) return false;
  if (
    !captureRuntimeOwnedCoordinatorSettlementInputs(
      record.settlementContext,
      completion.hostCleanupOutcome,
      completion.dockerCompletion,
    )
  )
    return false;
  record.hostCleanupOutcome = completion.hostCleanupOutcome;
  record.dockerCompletion = completion.dockerCompletion;
  const settled = settleRuntimeOwnedCoordinatorResult(
    record.settlementContext,
    completion.hostCleanupOutcome,
    completion.dockerCompletion,
  );
  record.settlementResult = settled;
  return settled.status === "completed";
}

/**
 * abandon Runtime 所有 Docker 回復を決定する。
 *
 * @responsibility abandon Runtime 所有 Docker 回復の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input recoveryCapability: unknown
 * @returns abandonRuntimeOwnedDockerRecoveryの計算結果を返す。
 * @precondition 「recoveryCapability: unknown」がabandonRuntimeOwnedDockerRecoveryの入力契約を満たす。
 * @postcondition abandonRuntimeOwnedDockerRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: abandonRuntimeOwnedDockerRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: abandonRuntimeOwnedDockerRecoveryは独自の失敗分岐を所有しない。
 * @invariant abandonRuntimeOwnedDockerRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: abandonRuntimeOwnedDockerRecoveryはProcess内の同一Subsystemで完結する。
 * @security abandonRuntimeOwnedDockerRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: abandonRuntimeOwnedDockerRecoveryは共有非同期状態を持たない同期処理である。
 */
export function abandonRuntimeOwnedDockerRecovery(recoveryCapability: unknown) {
  const record = durableRecord(recoveryCapability, false);
  if (!record) return false;
  dockerHostCleanupCapabilities.delete(recoveryCapability as object);
  if (releasedLogicalHomeLeases.has(recoveryCapability as object)) return true;
  const released = record.logicalHomeLease.release();
  if (released) releasedLogicalHomeLeases.add(recoveryCapability as object);
  return released;
}

/**
 * Exact Jsonを読み取る。
 *
 * @responsibility Exact Jsonの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input file: string、logicalKey
 * @returns readExactJsonの計算結果を返す。
 * @precondition 「file: string、logicalKey」がreadExactJsonの入力契約を満たす。
 * @postcondition readExactJsonの責務を完了した結果だけを返す。
 * @effect N/A: readExactJsonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readExactJsonは独自の失敗分岐を所有しない。
 * @invariant readExactJsonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readExactJsonはProcess内の同一Subsystemで完結する。
 * @security readExactJsonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readExactJsonは共有非同期状態を持たない同期処理である。
 */
function readExactJson(file: string, logicalKey = path.basename(file)) {
  const record = readCommittedDockerRecoveryJson(file, logicalKey);
  return Object.freeze({
    ...record,
    identity: record.identityText,
  });
}

const OPERATION_RECORD_NAME =
  /^(?:base|base-commit|engine-restart-0[0-4]|engine-handoff-0[0-7]|engine-continuation-0[0-4]|host-(?:begin|complete|crash-absence|cleanup)-(?:intent|receipt)|host-precleanup-finalization-intent|submission-(?:create_subscription_auth_probe|create_internal_network|create_egress_network|create_proxy|create_provider)|receipt-(?:create_subscription_auth_probe|create_internal_network|create_egress_network|create_proxy|create_provider)|restart-fence-(?:create_subscription_auth_probe|create_internal_network|create_egress_network|create_proxy|create_provider)|docker-absence(?:-crash)?|mount-(?:completion|crash-absence)|lease-release-receipt|normal-run-complete)\.json$/u;

/**
 * inventory Operation Directoryを決定する。
 *
 * @responsibility inventory Operation Directoryの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input operationDirectory: string、recoveryId: string、nonce: string、baseHash: string、splitMoveRecords: ReadonlyMap< string, Readonly<{ value: unknown }> >
 * @returns inventoryOperationDirectoryの計算結果を返す。
 * @precondition 「operationDirectory: string、recoveryId: string、nonce: string、baseHash: string、splitMoveRecords: ReadonlyMap< string, Readonly<{ value: unknown }> >」がinventoryOperationDirectoryの入力契約を満たす。
 * @postcondition inventoryOperationDirectoryの責務を完了した結果だけを返す。
 * @effect inventoryOperationDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure inventoryOperationDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inventoryOperationDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inventoryOperationDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inventoryOperationDirectoryは共有非同期状態を持たない同期処理である。
 */
function inventoryOperationDirectory(
  operationDirectory: string,
  recoveryId: string,
  nonce: string,
  baseHash: string,
  splitMoveRecords: ReadonlyMap<
    string,
    Readonly<{ value: unknown }>
  > = new Map(),
) {
  const entries = fs.readdirSync(operationDirectory, { withFileTypes: true });
  if (entries.length > 96)
    throw new Error("docker_task_recovery_operation_entry_limit_exceeded");
  const names = new Set(entries.map((entry) => entry.name));
  const dataNames: string[] = [];
  for (const entry of entries) {
    const target = path.join(operationDirectory, entry.name);
    if (entry.name === "recovery-docker-cli-config") {
      if (
        !entry.isDirectory() ||
        entry.isSymbolicLink() ||
        fs.readdirSync(target).length !== 0
      )
        throw new Error("docker_task_recovery_config_untrusted");
      continue;
    }
    if (isDockerRecoveryJournalTemporaryName(entry.name))
      throw new Error("docker_task_recovery_orphan_temporary");
    if (!entry.isFile() || entry.isSymbolicLink())
      throw new Error("docker_task_recovery_unknown_entry");
    if (entry.name.endsWith(".crdd-commit.json")) {
      const dataName = entry.name.slice(0, -".crdd-commit.json".length);
      if (!names.has(dataName) || !OPERATION_RECORD_NAME.test(dataName))
        throw new Error("docker_task_recovery_orphan_commit");
      continue;
    }
    if (
      !OPERATION_RECORD_NAME.test(entry.name) ||
      (!names.has(dockerRecoveryCommitName(entry.name)) &&
        !splitMoveRecords.has(entry.name))
    )
      throw new Error("docker_task_recovery_unknown_entry");
    dataNames.push(entry.name);
  }
  for (const name of dataNames) {
    const record =
      splitMoveRecords.get(name) ??
      readExactJson(path.join(operationDirectory, name));
    if (
      !validateOperationRecord(name, record.value, recoveryId, nonce, baseHash)
    )
      throw new Error("docker_task_recovery_record_invalid");
  }
  const restartNames = dataNames
    .filter((name) => name.startsWith("engine-restart-"))
    .sort();
  const handoffNames = dataNames
    .filter((name) => name.startsWith("engine-handoff-"))
    .sort();
  const continuationNames = dataNames
    .filter((name) => name.startsWith("engine-continuation-"))
    .sort();
  if (handoffNames.length || continuationNames.length) {
    const read = (name: string) =>
      Buffer.from(
        readExactJson(path.join(operationDirectory, name)).serialized,
      );
    const originRecords = restartNames.map(read);
    const first =
      originRecords[0] && parseDockerRestartRecord(originRecords[0]);
    const handoffs = handoffNames.map(read);
    const tip = handoffs.at(-1);
    const handoff = tip && parseDockerRestartHandoffRecord(tip);
    if (
      !first ||
      !handoff ||
      !resolveDockerRestartHistory(
        originRecords,
        {
          ...first,
          runtimeExecutionIdentitySha256: handoff.toRuntimeIdentitySha256,
        },
        handoffs,
        continuationNames.map(read),
      )
    )
      throw new Error("docker_task_recovery_restart_chain_invalid");
  }
  for (const name of dataNames.filter((entry) =>
    entry.startsWith("restart-fence-"),
  )) {
    const fence = readExactJson(path.join(operationDirectory, name))
      .value as Record<string, unknown>;
    if (fence.schema !== "crdd-coordinator-docker-engine-restart-fence/v2")
      continue;
    const finalName = continuationNames.at(-1) ?? restartNames.at(-1);
    if (!finalName)
      throw new Error("docker_task_recovery_restart_chain_invalid");
    const finalRecord = readExactJson(path.join(operationDirectory, finalName));
    const restart =
      parseDockerRestartRecord(Buffer.from(finalRecord.serialized)) ??
      parseDockerRestartContinuationRecord(Buffer.from(finalRecord.serialized))
        ?.record;
    if (
      restart?.phase !== "settled" ||
      finalRecord.hash !== fence.restartRecordSha256 ||
      restart.pendingSubmissionSha256 !== fence.pendingSubmissionSha256 ||
      readExactJson(
        path.join(
          operationDirectory,
          `submission-${String(fence.purpose)}.json`,
        ),
      ).hash !== fence.pendingSubmissionSha256
    )
      throw new Error("docker_task_recovery_restart_chain_invalid");
  }
  if (restartNames.length > 0) {
    const restartBytes = restartNames.map((name) =>
      Buffer.from(
        readExactJson(path.join(operationDirectory, name)).serialized,
      ),
    );
    const firstBytes = restartBytes[0];
    const first = firstBytes ? parseDockerRestartRecord(firstBytes) : null;
    const base = readExactJson(path.join(operationDirectory, "base.json"))
      .value as Record<string, unknown>;
    const state = base.runtimeStateBinding as RuntimeStateBindingEvidence;
    const submissions = dataNames.filter((name) =>
      name.startsWith("submission-"),
    );
    if (
      !first ||
      !validateDockerRestartRecordChain(restartBytes, first) ||
      first.stableLogicalHomeBindingHash !==
        base.stableLogicalHomeBindingHash ||
      first.runtimeStateIdentityHash !== state.runtimeStateIdentityHash ||
      first.runtimeStateProtectionHash !== state.runtimeStateProtectionHash ||
      !submissions.some(
        (name) =>
          readExactJson(path.join(operationDirectory, name)).hash ===
          first.pendingSubmissionSha256,
      )
    )
      throw new Error("docker_task_recovery_restart_chain_invalid");
  }
  for (const phase of ["begin", "complete", "crash-absence"] as const) {
    const intentName = `host-${phase}-intent.json`;
    const receiptName = `host-${phase}-receipt.json`;
    const hasIntent = dataNames.includes(intentName);
    const hasReceipt = dataNames.includes(receiptName);
    if (hasReceipt && !hasIntent)
      throw new Error("docker_task_recovery_host_transition_mismatch");
    if (!hasIntent) continue;
    const intent = readExactJson(path.join(operationDirectory, intentName))
      .value as Record<string, unknown>;
    const requiredNextState =
      phase === "begin"
        ? "docker_submission_started"
        : phase === "complete"
          ? "host_only"
          : "docker_absent_confirmed";
    validateHostTransitionLineage(intent, requiredNextState);
    if (hasReceipt) {
      const receipt = readExactJson(path.join(operationDirectory, receiptName))
        .value as Record<string, unknown>;
      if (
        receipt.previous !== intent.currentToken ||
        receipt.observed !== intent.expectedToken
      )
        throw new Error("docker_task_recovery_host_transition_mismatch");
    }
  }
  if (
    !dataNames.includes("base.json") ||
    !dataNames.includes("base-commit.json")
  )
    throw new Error("docker_task_recovery_base_invalid");
  return Object.freeze([...dataNames].sort());
}

/**
 * Select unresolved submission data records from an already validated inventory.
 *
 * @responsibility Pending Docker Submission Names From Inventoryの候補集合、選択理由、選択不能時の境界を所有する。
 * @trace ARCH-000008
 * @input names: readonly string[]
 * @returns selectPendingDockerSubmissionNamesFromInventoryの計算結果を返す。
 * @precondition 「names: readonly string[]」がselectPendingDockerSubmissionNamesFromInventoryの入力契約を満たす。
 * @postcondition selectPendingDockerSubmissionNamesFromInventoryの責務を完了した結果だけを返す。
 * @effect N/A: selectPendingDockerSubmissionNamesFromInventoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectPendingDockerSubmissionNamesFromInventoryは独自の失敗分岐を所有しない。
 * @invariant selectPendingDockerSubmissionNamesFromInventoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectPendingDockerSubmissionNamesFromInventoryはProcess内の同一Subsystemで完結する。
 * @security selectPendingDockerSubmissionNamesFromInventoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: selectPendingDockerSubmissionNamesFromInventoryは共有非同期状態を持たない同期処理である。
 */
export function selectPendingDockerSubmissionNamesFromInventory(
  names: readonly string[],
) {
  const inventory = new Set(names);
  return Object.freeze(
    names.filter(
      (name) =>
        /^submission-.+\.json$/u.test(name) &&
        !name.endsWith(".crdd-commit.json") &&
        !inventory.has(name.replace(/^submission-/u, "receipt-")),
    ),
  );
}

/**
 * Host 清掃 Receiptが成立する状態を確保する。
 *
 * @responsibility Host 清掃 Receiptの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000008
 * @input operationDirectory: string、recoveryId: string、hostPaths: Readonly<{ root: string; marker: string }>
 * @returns ensureHostCleanupReceiptの計算結果を返す。
 * @precondition 「operationDirectory: string、recoveryId: string、hostPaths: Readonly<{ root: string; marker: string }>」がensureHostCleanupReceiptの入力契約を満たす。
 * @postcondition ensureHostCleanupReceiptの責務を完了した結果だけを返す。
 * @effect N/A: ensureHostCleanupReceiptは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ensureHostCleanupReceiptは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ensureHostCleanupReceiptは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ensureHostCleanupReceiptはProcess内の同一Subsystemで完結する。
 * @security ensureHostCleanupReceiptはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ensureHostCleanupReceiptは共有非同期状態を持たない同期処理である。
 */
function ensureHostCleanupReceipt(
  operationDirectory: string,
  recoveryId: string,
  hostPaths: Readonly<{ root: string; marker: string }>,
) {
  if (
    recoveryPathPresent(hostPaths.root) ||
    recoveryPathPresent(hostPaths.marker)
  )
    throw new Error("docker_task_recovery_host_cleanup_unconfirmed");
  const receiptPath = path.join(
    operationDirectory,
    "host-cleanup-receipt.json",
  );
  if (recoveryPathPresent(receiptPath)) {
    const receipt = readExactJson(receiptPath).value;
    if (
      !exactRecordKeys(receipt, [
        "schema",
        "recoveryId",
        "hostRootAbsent",
        "hostMarkerAbsent",
      ]) ||
      (receipt as Record<string, unknown>).schema !==
        "crdd-coordinator-host-cleanup-receipt/v1" ||
      (receipt as Record<string, unknown>).recoveryId !== recoveryId ||
      (receipt as Record<string, unknown>).hostRootAbsent !== true ||
      (receipt as Record<string, unknown>).hostMarkerAbsent !== true
    )
      throw new Error("docker_task_recovery_host_cleanup_receipt_invalid");
    return;
  }
  writeDurableJson(operationDirectory, "host-cleanup-receipt.json", {
    schema: "crdd-coordinator-host-cleanup-receipt/v1",
    recoveryId,
    hostRootAbsent: true,
    hostMarkerAbsent: true,
  });
}

/**
 * 回復 Reasonを安全条件の下で処理する。
 *
 * @responsibility 回復 Reasonの安全条件、拒否条件、終了結果境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown、fallback: string
 * @returns safeRecoveryReasonの計算結果を返す。
 * @precondition 「error: unknown、fallback: string」がsafeRecoveryReasonの入力契約を満たす。
 * @postcondition safeRecoveryReasonの責務を完了した結果だけを返す。
 * @effect N/A: safeRecoveryReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: safeRecoveryReasonは独自の失敗分岐を所有しない。
 * @invariant safeRecoveryReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: safeRecoveryReasonはProcess内の同一Subsystemで完結する。
 * @security safeRecoveryReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: safeRecoveryReasonは共有非同期状態を持たない同期処理である。
 */
function safeRecoveryReason(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return /^(?:docker_task|host_recovery)_[a-z0-9_]{1,120}$/u.test(message)
    ? message
    : fallback;
}

/**
 * host Paths From Baseを決定する。
 *
 * @responsibility host Paths From Baseの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input base: Record<string, unknown>
 * @returns hostPathsFromBaseの計算結果を返す。
 * @precondition 「base: Record<string, unknown>」がhostPathsFromBaseの入力契約を満たす。
 * @postcondition hostPathsFromBaseの責務を完了した結果だけを返す。
 * @effect N/A: hostPathsFromBaseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure hostPathsFromBaseは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant hostPathsFromBaseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hostPathsFromBaseはProcess内の同一Subsystemで完結する。
 * @security hostPathsFromBaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hostPathsFromBaseは共有非同期状態を持たない同期処理である。
 */
function hostPathsFromBase(base: Record<string, unknown>) {
  const paths = base.hostPaths;
  if (
    !exactRecordKeys(paths, ["root", "marker"]) ||
    typeof (paths as Record<string, unknown>).root !== "string" ||
    typeof (paths as Record<string, unknown>).marker !== "string"
  )
    throw new Error("docker_task_recovery_base_mismatch");
  const root = String((paths as Record<string, unknown>).root);
  const marker = String((paths as Record<string, unknown>).marker);
  if (
    !path.isAbsolute(root) ||
    !path.isAbsolute(marker) ||
    !path.basename(root).startsWith("crdd-coordinator-doctor-") ||
    !/^host-[a-f0-9]{64}\.json$/u.test(path.basename(marker))
  )
    throw new Error("docker_task_recovery_base_mismatch");
  return Object.freeze({ root, marker });
}

/**
 * management Directory Name From Baseを決定する。
 *
 * @responsibility management Directory Name From Baseの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input base: Record<string, unknown>
 * @returns managementDirectoryNameFromBaseの計算結果を返す。
 * @precondition 「base: Record<string, unknown>」がmanagementDirectoryNameFromBaseの入力契約を満たす。
 * @postcondition managementDirectoryNameFromBaseの責務を完了した結果だけを返す。
 * @effect N/A: managementDirectoryNameFromBaseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure managementDirectoryNameFromBaseは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant managementDirectoryNameFromBaseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: managementDirectoryNameFromBaseはProcess内の同一Subsystemで完結する。
 * @security managementDirectoryNameFromBaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: managementDirectoryNameFromBaseは共有非同期状態を持たない同期処理である。
 */
function managementDirectoryNameFromBase(base: Record<string, unknown>) {
  const snapshot = base.initialHostRecovery as Record<string, unknown>;
  const hostRecord = snapshot?.record as Record<string, unknown>;
  const childIdentities = hostRecord?.childIdentities as Record<
    string,
    unknown
  >;
  const management = childIdentities?.management as Record<string, unknown>;
  const name = management?.pathName;
  if (
    typeof name !== "string" ||
    !/^[A-Za-z0-9_-]{1,80}$/u.test(name) ||
    path.basename(name) !== name
  )
    throw new Error("docker_task_recovery_base_mismatch");
  return name;
}

/**
 * expected Host Active Bindingを決定する。
 *
 * @responsibility expected Host Active Bindingの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input recoveryId: string、baseHash: string、operationNonce: string
 * @returns expectedHostActiveBindingの計算結果を返す。
 * @precondition 「recoveryId: string、baseHash: string、operationNonce: string」がexpectedHostActiveBindingの入力契約を満たす。
 * @postcondition expectedHostActiveBindingの責務を完了した結果だけを返す。
 * @effect N/A: expectedHostActiveBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: expectedHostActiveBindingは独自の失敗分岐を所有しない。
 * @invariant expectedHostActiveBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: expectedHostActiveBindingはProcess内の同一Subsystemで完結する。
 * @security expectedHostActiveBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: expectedHostActiveBindingは共有非同期状態を持たない同期処理である。
 */
function expectedHostActiveBinding(
  recoveryId: string,
  baseHash: string,
  operationNonce: string,
) {
  return Object.freeze({
    schema: "crdd-coordinator-host-active-docker-task/v1",
    recoveryId,
    baseHash,
    operationNonce,
  });
}

/**
 * Host Active Bindingの契約を検証する。
 *
 * @responsibility Host Active Bindingの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expected: ReturnType<typeof expectedHostActiveBinding>
 * @returns N/A: validateHostActiveBindingは戻り値を返さない。
 * @precondition 「value: unknown、expected: ReturnType<typeof expectedHostActiveBinding>」がvalidateHostActiveBindingの入力契約を満たす。
 * @postcondition validateHostActiveBindingの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: validateHostActiveBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validateHostActiveBindingは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateHostActiveBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateHostActiveBindingはProcess内の同一Subsystemで完結する。
 * @security validateHostActiveBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateHostActiveBindingは共有非同期状態を持たない同期処理である。
 */
function validateHostActiveBinding(
  value: unknown,
  expected: ReturnType<typeof expectedHostActiveBinding>,
) {
  if (
    !exactRecordKeys(value, [
      "schema",
      "recoveryId",
      "baseHash",
      "operationNonce",
    ]) ||
    (value as Record<string, unknown>).schema !== expected.schema ||
    (value as Record<string, unknown>).recoveryId !== expected.recoveryId ||
    (value as Record<string, unknown>).baseHash !== expected.baseHash ||
    (value as Record<string, unknown>).operationNonce !==
      expected.operationNonce
  )
    throw new Error("docker_task_recovery_active_run_mismatch");
}

/**
 * Active Lease Pointerの契約を検証する。
 *
 * @responsibility Active Lease Pointerの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expected: Readonly<{ stableLogicalHomeBindingHash: string; operationNonce: string; recoveryId: string; baseHash: string; }>
 * @returns N/A: validateActiveLeasePointerは戻り値を返さない。
 * @precondition 「value: unknown、expected: Readonly<{ stableLogicalHomeBindingHash: string; operationNonce: string; recoveryId: string; baseHash: string; }>」がvalidateActiveLeasePointerの入力契約を満たす。
 * @postcondition validateActiveLeasePointerの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: validateActiveLeasePointerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validateActiveLeasePointerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateActiveLeasePointerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateActiveLeasePointerはProcess内の同一Subsystemで完結する。
 * @security validateActiveLeasePointerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateActiveLeasePointerは共有非同期状態を持たない同期処理である。
 */
function validateActiveLeasePointer(
  value: unknown,
  expected: Readonly<{
    stableLogicalHomeBindingHash: string;
    operationNonce: string;
    recoveryId: string;
    baseHash: string;
  }>,
) {
  if (
    !exactRecordKeys(value, [
      "schema",
      "stableLogicalHomeBindingHash",
      "operationName",
      "recoveryId",
      "baseHash",
    ]) ||
    (value as Record<string, unknown>).schema !==
      "crdd-coordinator-provider-home-active-lease/v1" ||
    (value as Record<string, unknown>).stableLogicalHomeBindingHash !==
      expected.stableLogicalHomeBindingHash ||
    (value as Record<string, unknown>).operationName !==
      `docker-task-${expected.operationNonce}` ||
    (value as Record<string, unknown>).recoveryId !== expected.recoveryId ||
    (value as Record<string, unknown>).baseHash !== expected.baseHash
  )
    throw new Error("docker_task_recovery_pointer_mismatch");
}

/**
 * 回復 Pathを観測する。
 *
 * @responsibility 回復 Pathの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns observeRecoveryPathの計算結果を返す。
 * @precondition 「target: string」がobserveRecoveryPathの入力契約を満たす。
 * @postcondition observeRecoveryPathの責務を完了した結果だけを返す。
 * @effect observeRecoveryPathはFilesystemの読取りまたは書込みを実行する。
 * @failure observeRecoveryPathは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeRecoveryPathは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security observeRecoveryPathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeRecoveryPathは共有非同期状態を持たない同期処理である。
 */
function observeRecoveryPath(target: string) {
  try {
    return fs.lstatSync(target, { bigint: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return null;
    throw new Error("docker_task_recovery_record_observation_unknown");
  }
}

/**
 * recovery Path Presentを決定する。
 *
 * @responsibility recovery Path Presentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns recoveryPathPresentの計算結果を返す。
 * @precondition 「target: string」がrecoveryPathPresentの入力契約を満たす。
 * @postcondition recoveryPathPresentの責務を完了した結果だけを返す。
 * @effect N/A: recoveryPathPresentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryPathPresentは独自の失敗分岐を所有しない。
 * @invariant recoveryPathPresentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryPathPresentはProcess内の同一Subsystemで完結する。
 * @security recoveryPathPresentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoveryPathPresentは共有非同期状態を持たない同期処理である。
 */
function recoveryPathPresent(target: string) {
  return observeRecoveryPath(target) !== null;
}

/**
 * 回復 Fileを観測する。
 *
 * @responsibility 回復 Fileの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns observeRecoveryFileの計算結果を返す。
 * @precondition 「target: string」がobserveRecoveryFileの入力契約を満たす。
 * @postcondition observeRecoveryFileの責務を完了した結果だけを返す。
 * @effect N/A: observeRecoveryFileは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observeRecoveryFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeRecoveryFileは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeRecoveryFileはProcess内の同一Subsystemで完結する。
 * @security observeRecoveryFileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeRecoveryFileは共有非同期状態を持たない同期処理である。
 */
function observeRecoveryFile(target: string) {
  const metadata = observeRecoveryPath(target);
  if (metadata === null) return false;
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error("docker_task_recovery_record_observation_unknown");
  return true;
}

/**
 * Active Binding And Pointer Closureを検証する。
 *
 * @responsibility Active Binding And Pointer Closureの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input activeBindingPath: string、pointerPath: string、expectedActive: ReturnType<typeof expectedHostActiveBinding>、expectedPointer: Readonly<{ stableLogicalHomeBindingHash: string; operationNonce: string; recoveryId: string; baseHash: string; }>
 * @returns verifyActiveBindingAndPointerClosureの計算結果を返す。
 * @precondition 「activeBindingPath: string、pointerPath: string、expectedActive: ReturnType<typeof expectedHostActiveBinding>、expectedPointer: Readonly<{ stableLogicalHomeBindingHash: string; operationNonce: string; recoveryId: string; baseHash: string; }>」がverifyActiveBindingAndPointerClosureの入力契約を満たす。
 * @postcondition verifyActiveBindingAndPointerClosureの責務を完了した結果だけを返す。
 * @effect verifyActiveBindingAndPointerClosureはFilesystemの読取りまたは書込みを実行する。
 * @failure verifyActiveBindingAndPointerClosureは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyActiveBindingAndPointerClosureは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security verifyActiveBindingAndPointerClosureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyActiveBindingAndPointerClosureは共有非同期状態を持たない同期処理である。
 */
function verifyActiveBindingAndPointerClosure(
  activeBindingPath: string,
  pointerPath: string,
  expectedActive: ReturnType<typeof expectedHostActiveBinding>,
  expectedPointer: Readonly<{
    stableLogicalHomeBindingHash: string;
    operationNonce: string;
    recoveryId: string;
    baseHash: string;
  }>,
) {
  const activeCommitPath = path.join(
    path.dirname(activeBindingPath),
    dockerRecoveryCommitName(path.basename(activeBindingPath)),
  );
  const pointerCommitPath = path.join(
    path.dirname(pointerPath),
    dockerRecoveryCommitName(path.basename(pointerPath)),
  );
  const activePresent = observeRecoveryFile(activeBindingPath);
  const activeCommitPresent = observeRecoveryFile(activeCommitPath);
  const pointerPresent = observeRecoveryFile(pointerPath);
  const pointerCommitPresent = observeRecoveryFile(pointerCommitPath);
  if (!activePresent) {
    if (activeCommitPresent)
      throw new Error("docker_task_recovery_active_run_mismatch");
    if (pointerPresent !== pointerCommitPresent)
      throw new Error("docker_task_recovery_pointer_mismatch");
    if (!pointerPresent)
      return Object.freeze({
        activeState: "absent" as const,
        pointerState: "absent" as const,
        pointerRecord: null,
      });
    const pointerRecord = readExactJson(pointerPath);
    validateActiveLeasePointer(pointerRecord.value, expectedPointer);
    return Object.freeze({
      activeState: "absent" as const,
      pointerState: "committed" as const,
      pointerRecord,
    });
  }
  if (!pointerPresent || !pointerCommitPresent)
    throw new Error("docker_task_recovery_pointer_mismatch");
  const activeValue = activeCommitPresent
    ? readExactJson(activeBindingPath).value
    : JSON.parse(fs.readFileSync(activeBindingPath, "utf8"));
  validateHostActiveBinding(activeValue, expectedActive);
  const pointerRecord = readExactJson(pointerPath);
  validateActiveLeasePointer(pointerRecord.value, expectedPointer);
  return Object.freeze({
    activeState: activeCommitPresent
      ? ("committed" as const)
      : ("uncommitted" as const),
    pointerState: "committed" as const,
    pointerRecord,
  });
}

/**
 * 回復 Operation Directoryを除去する。
 *
 * @responsibility 回復 Operation Directoryの対象Identity、除去条件、終了後状態の境界を所有する。
 * @trace ARCH-000008
 * @input operationDirectory: string、recoveryId: string、nonce: string、baseHash: string、stableLogicalHomeBindingHash: string、runtimeStateBinding: RuntimeStateBindingEvidence、shouldPersistCompletionReceipt
 * @returns removeRecoveryOperationDirectoryの計算結果を返す。
 * @precondition 「operationDirectory: string、recoveryId: string、nonce: string、baseHash: string、stableLogicalHomeBindingHash: string、runtimeStateBinding: RuntimeStateBindingEvidence、shouldPersistCompletionReceipt」がremoveRecoveryOperationDirectoryの入力契約を満たす。
 * @postcondition removeRecoveryOperationDirectoryの責務を完了した結果だけを返す。
 * @effect removeRecoveryOperationDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure removeRecoveryOperationDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant removeRecoveryOperationDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security removeRecoveryOperationDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: removeRecoveryOperationDirectoryは共有非同期状態を持たない同期処理である。
 */
function removeRecoveryOperationDirectory(
  operationDirectory: string,
  recoveryId: string,
  nonce: string,
  baseHash: string,
  stableLogicalHomeBindingHash: string,
  runtimeStateBinding: RuntimeStateBindingEvidence,
  shouldPersistCompletionReceipt = false,
) {
  inventoryOperationDirectory(operationDirectory, recoveryId, nonce, baseHash);
  const cleanupDirectory = path.join(
    path.dirname(operationDirectory),
    `cleanup-docker-task-${stableLogicalHomeBindingHash}-${nonce}-${baseHash}`,
  );
  if (recoveryPathPresent(cleanupDirectory))
    throw new Error("docker_task_recovery_cleanup_tombstone_conflict");
  const operationMetadata = fs.lstatSync(operationDirectory, { bigint: true });
  const originalEntries = fs
    .readdirSync(operationDirectory, { withFileTypes: true })
    .map((entry) => {
      const target = path.join(operationDirectory, entry.name);
      const metadata = fs.lstatSync(target, { bigint: true });
      const identity = `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}`;
      if (entry.name === "recovery-docker-cli-config") {
        if (
          !entry.isDirectory() ||
          entry.isSymbolicLink() ||
          fs.readdirSync(target).length !== 0
        )
          throw new Error("docker_task_recovery_config_untrusted");
        return Object.freeze({
          name: entry.name,
          type: "empty_directory" as const,
          hash: createHash("sha256").update("").digest("hex"),
          identity,
          bytes: 0,
        });
      }
      if (!entry.isFile() || entry.isSymbolicLink())
        throw new Error("docker_task_recovery_cleanup_unknown_entry");
      const bytes = fs.readFileSync(target);
      const after = fs.lstatSync(target, { bigint: true });
      if (
        metadata.dev !== after.dev ||
        metadata.ino !== after.ino ||
        metadata.birthtimeNs !== after.birthtimeNs ||
        metadata.size !== after.size
      )
        throw new Error("docker_task_recovery_record_changed");
      return Object.freeze({
        name: entry.name,
        type: "file" as const,
        hash: createHash("sha256").update(bytes).digest("hex"),
        identity,
        bytes: bytes.byteLength,
      });
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  writeDurableJson(operationDirectory, "cleanup-manifest.json", {
    schema: "crdd-coordinator-recovery-cleanup-manifest/v1",
    recoveryId,
    sourceDirectoryIdentity: `${operationMetadata.dev}:${operationMetadata.ino}:${operationMetadata.birthtimeNs}`,
    cleanupName: path.basename(cleanupDirectory),
    runtimeStateBinding,
    originalEntries: Object.freeze(originalEntries),
  });
  verifyRecoveryCleanupManifest(operationDirectory, recoveryId);
  if (shouldPersistCompletionReceipt)
    ensureCompletedDockerRecoveryReceipt(
      path.dirname(operationDirectory),
      recoveryId,
      runtimeStateBinding,
    );
  fs.renameSync(operationDirectory, cleanupDirectory);
  commitDirectoryMutationBoundary(path.dirname(operationDirectory));
  verifyRecoveryCleanupManifest(cleanupDirectory, recoveryId);
  removeDockerRecoveryCleanupDirectory(
    path.dirname(cleanupDirectory),
    cleanupDirectory,
    recoveryId,
    runtimeStateBinding,
  );
}

/**
 * 回復 清掃 Manifestを検証する。
 *
 * @responsibility 回復 清掃 Manifestの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input cleanupDirectory: string、recoveryId: string
 * @returns verifyRecoveryCleanupManifestの計算結果を返す。
 * @precondition 「cleanupDirectory: string、recoveryId: string」がverifyRecoveryCleanupManifestの入力契約を満たす。
 * @postcondition verifyRecoveryCleanupManifestの責務を完了した結果だけを返す。
 * @effect verifyRecoveryCleanupManifestはFilesystemの読取りまたは書込みを実行する。
 * @failure verifyRecoveryCleanupManifestは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyRecoveryCleanupManifestは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security verifyRecoveryCleanupManifestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyRecoveryCleanupManifestは共有非同期状態を持たない同期処理である。
 */
function verifyRecoveryCleanupManifest(
  cleanupDirectory: string,
  recoveryId: string,
) {
  const manifestRecord = readExactJson(
    path.join(cleanupDirectory, "cleanup-manifest.json"),
  );
  const manifest = manifestRecord.value as Record<string, unknown>;
  if (
    !exactRecordKeys(manifest, [
      "schema",
      "recoveryId",
      "sourceDirectoryIdentity",
      "cleanupName",
      "runtimeStateBinding",
      "originalEntries",
    ]) ||
    manifest.schema !== "crdd-coordinator-recovery-cleanup-manifest/v1" ||
    manifest.recoveryId !== recoveryId ||
    typeof manifest.sourceDirectoryIdentity !== "string" ||
    typeof manifest.cleanupName !== "string" ||
    !validRuntimeStateBindingEvidence(manifest.runtimeStateBinding) ||
    !Array.isArray(manifest.originalEntries) ||
    manifest.originalEntries.length > 96
  )
    throw new Error("docker_task_recovery_cleanup_manifest_invalid");
  const metadata = fs.lstatSync(cleanupDirectory, { bigint: true });
  if (
    `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}` !==
      manifest.sourceDirectoryIdentity ||
    ![
      `docker-task-${parseDockerTaskRecoveryId(recoveryId)?.operationNonce}`,
      manifest.cleanupName,
    ].includes(path.basename(cleanupDirectory))
  )
    throw new Error("docker_task_recovery_cleanup_manifest_invalid");
  const expected = new Map<string, Record<string, unknown>>();
  for (const raw of manifest.originalEntries) {
    if (!exactRecordKeys(raw, ["name", "type", "hash", "identity", "bytes"]))
      throw new Error("docker_task_recovery_cleanup_manifest_invalid");
    const entry = raw as Record<string, unknown>;
    if (
      typeof entry.name !== "string" ||
      path.basename(entry.name) !== entry.name ||
      (entry.type !== "file" && entry.type !== "empty_directory") ||
      typeof entry.hash !== "string" ||
      !HEX64.test(entry.hash) ||
      typeof entry.identity !== "string" ||
      !Number.isSafeInteger(entry.bytes) ||
      expected.has(entry.name)
    )
      throw new Error("docker_task_recovery_cleanup_manifest_invalid");
    expected.set(entry.name, entry);
  }
  const allowed = new Set([
    ...expected.keys(),
    "cleanup-manifest.json",
    dockerRecoveryCommitName("cleanup-manifest.json"),
  ]);
  const observedNames = fs.readdirSync(cleanupDirectory);
  if (
    observedNames.length !== allowed.size ||
    observedNames.some((name) => !allowed.has(name))
  )
    throw new Error("docker_task_recovery_cleanup_manifest_mismatch");
  for (const entry of expected.values()) {
    const target = path.join(cleanupDirectory, String(entry.name));
    const observed = fs.lstatSync(target, { bigint: true });
    if (
      `${observed.dev}:${observed.ino}:${observed.birthtimeNs}` !==
      entry.identity
    )
      throw new Error("docker_task_recovery_cleanup_manifest_mismatch");
    if (entry.type === "empty_directory") {
      if (
        !observed.isDirectory() ||
        observed.isSymbolicLink() ||
        fs.readdirSync(target).length !== 0 ||
        entry.bytes !== 0
      )
        throw new Error("docker_task_recovery_cleanup_manifest_mismatch");
    } else {
      if (!observed.isFile() || observed.isSymbolicLink())
        throw new Error("docker_task_recovery_cleanup_manifest_mismatch");
      const bytes = fs.readFileSync(target);
      if (
        bytes.byteLength !== entry.bytes ||
        createHash("sha256").update(bytes).digest("hex") !== entry.hash
      )
        throw new Error("docker_task_recovery_cleanup_manifest_mismatch");
    }
  }
  return Object.freeze({
    runtimeStateBinding:
      manifest.runtimeStateBinding as RuntimeStateBindingEvidence,
  });
}

/**
 * inventory 回復 清掃 Tombstoneを決定する。
 *
 * @responsibility inventory 回復 清掃 Tombstoneの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input cleanupDirectory: string、recoveryId: string
 * @returns inventoryRecoveryCleanupTombstoneの計算結果を返す。
 * @precondition 「cleanupDirectory: string、recoveryId: string」がinventoryRecoveryCleanupTombstoneの入力契約を満たす。
 * @postcondition inventoryRecoveryCleanupTombstoneの責務を完了した結果だけを返す。
 * @effect N/A: inventoryRecoveryCleanupTombstoneは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inventoryRecoveryCleanupTombstoneは独自の失敗分岐を所有しない。
 * @invariant inventoryRecoveryCleanupTombstoneは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inventoryRecoveryCleanupTombstoneはProcess内の同一Subsystemで完結する。
 * @security inventoryRecoveryCleanupTombstoneはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inventoryRecoveryCleanupTombstoneは共有非同期状態を持たない同期処理である。
 */
function inventoryRecoveryCleanupTombstone(
  cleanupDirectory: string,
  recoveryId: string,
) {
  return verifyRecoveryCleanupManifest(cleanupDirectory, recoveryId);
}

/**
 * 回復 清掃 Tombstoneを除去する。
 *
 * @responsibility 回復 清掃 Tombstoneの対象Identity、除去条件、終了後状態の境界を所有する。
 * @trace ARCH-000008
 * @input cleanupDirectory: string、recoveryId: string
 * @returns removeRecoveryCleanupTombstoneの計算結果を返す。
 * @precondition 「cleanupDirectory: string、recoveryId: string」がremoveRecoveryCleanupTombstoneの入力契約を満たす。
 * @postcondition removeRecoveryCleanupTombstoneの責務を完了した結果だけを返す。
 * @effect N/A: removeRecoveryCleanupTombstoneは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: removeRecoveryCleanupTombstoneは独自の失敗分岐を所有しない。
 * @invariant removeRecoveryCleanupTombstoneは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: removeRecoveryCleanupTombstoneはProcess内の同一Subsystemで完結する。
 * @security removeRecoveryCleanupTombstoneはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: removeRecoveryCleanupTombstoneは共有非同期状態を持たない同期処理である。
 */
function removeRecoveryCleanupTombstone(
  cleanupDirectory: string,
  recoveryId: string,
) {
  const manifest = verifyRecoveryCleanupManifest(cleanupDirectory, recoveryId);
  return removeDockerRecoveryCleanupDirectory(
    path.dirname(cleanupDirectory),
    cleanupDirectory,
    recoveryId,
    manifest.runtimeStateBinding,
  );
}

/**
 * host 回復 Inventory Readyを決定する。
 *
 * @responsibility host 回復 Inventory Readyの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input runtimeStateRoot: string、hostRoot: string、targetOperationDirectory: string
 * @returns hostRecoveryInventoryReadyの計算結果を返す。
 * @precondition 「runtimeStateRoot: string、hostRoot: string、targetOperationDirectory: string」がhostRecoveryInventoryReadyの入力契約を満たす。
 * @postcondition hostRecoveryInventoryReadyの責務を完了した結果だけを返す。
 * @effect hostRecoveryInventoryReadyはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: hostRecoveryInventoryReadyは独自の失敗分岐を所有しない。
 * @invariant hostRecoveryInventoryReadyは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security hostRecoveryInventoryReadyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hostRecoveryInventoryReadyは共有非同期状態を持たない同期処理である。
 */
function hostRecoveryInventoryReady(
  runtimeStateRoot: string,
  hostRoot: string,
  targetOperationDirectory: string,
) {
  const audited = inspectDockerRecoveryRootSnapshot(runtimeStateRoot);
  if (audited.status !== "completed") return false;
  const entries = fs.readdirSync(runtimeStateRoot, { withFileTypes: true });
  if (entries.length > 128) return false;
  for (const entry of entries) {
    if (/^pending-docker-task-[a-f0-9]{64}\.json$/u.test(entry.name)) {
      if (!entry.isFile() || entry.isSymbolicLink()) return false;
      const pendingBase = readExactJson(path.join(runtimeStateRoot, entry.name))
        .value as Record<string, unknown>;
      if (hostPathsFromBase(pendingBase).root === hostRoot) return false;
      continue;
    }
    if (
      !/^docker-task-[a-f0-9]{64}$/u.test(entry.name) ||
      !entry.isDirectory() ||
      entry.isSymbolicLink()
    )
      continue;
    const directory = path.join(runtimeStateRoot, entry.name);
    const basePath = path.join(directory, "base.json");
    if (!observeRecoveryFile(basePath)) return false;
    const base = readExactJson(basePath).value as Record<string, unknown>;
    if (hostPathsFromBase(base).root !== hostRoot) continue;
    const normalComplete = observeRecoveryFile(
      path.join(directory, "normal-run-complete.json"),
    );
    const crashComplete =
      directory === targetOperationDirectory &&
      observeRecoveryFile(path.join(directory, "docker-absence-crash.json")) &&
      observeRecoveryFile(path.join(directory, "mount-crash-absence.json"));
    if (!normalComplete && !crashComplete) return false;
    const stable = base.stableLogicalHomeBindingHash;
    if (
      typeof stable !== "string" ||
      !HEX64.test(stable) ||
      observeRecoveryFile(
        path.join(runtimeStateRoot, `active-lease-${stable}.json`),
      )
    )
      return false;
  }
  return true;
}

/**
 * current Host 回復 Token For Inventoryを決定する。
 *
 * @responsibility current Host 回復 Token For Inventoryの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input runtimeStateRoot: string、hostRoot: string
 * @returns currentHostRecoveryTokenForInventoryの計算結果を返す。
 * @precondition 「runtimeStateRoot: string、hostRoot: string」がcurrentHostRecoveryTokenForInventoryの入力契約を満たす。
 * @postcondition currentHostRecoveryTokenForInventoryの責務を完了した結果だけを返す。
 * @effect currentHostRecoveryTokenForInventoryはFilesystemの読取りまたは書込みを実行する。
 * @failure currentHostRecoveryTokenForInventoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant currentHostRecoveryTokenForInventoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security currentHostRecoveryTokenForInventoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: currentHostRecoveryTokenForInventoryは共有非同期状態を持たない同期処理である。
 */
function currentHostRecoveryTokenForInventory(
  runtimeStateRoot: string,
  hostRoot: string,
) {
  const candidates = new Set<string>();
  for (const entry of fs.readdirSync(runtimeStateRoot, {
    withFileTypes: true,
  })) {
    if (
      !entry.isDirectory() ||
      entry.isSymbolicLink() ||
      !/^docker-task-[a-f0-9]{64}$/u.test(entry.name)
    )
      continue;
    const directory = path.join(runtimeStateRoot, entry.name);
    const basePath = path.join(directory, "base.json");
    if (!recoveryPathPresent(basePath)) continue;
    const base = readExactJson(basePath).value as Record<string, unknown>;
    if (hostPathsFromBase(base).root !== hostRoot) continue;
    for (const [name, key] of [
      ["normal-run-complete.json", "hostSuccessor"],
      ["host-crash-absence-receipt.json", "observed"],
      ["host-complete-receipt.json", "observed"],
      ["host-begin-receipt.json", "observed"],
    ] as const) {
      const file = path.join(directory, name);
      if (!recoveryPathPresent(file)) continue;
      const value = readExactJson(file).value as Record<string, unknown>;
      if (typeof value[key] === "string") candidates.add(String(value[key]));
    }
  }
  const currentRecoveryIds = [...candidates].filter((candidate) => {
    try {
      loadHostRecoveryRecordByToken(candidate);
      return true;
    } catch {
      return false;
    }
  });
  return currentRecoveryIds.length === 1 ? currentRecoveryIds[0] : null;
}

/**
 * 回復 Docker Cliを検証する。
 *
 * @responsibility 回復 Docker Cliの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: verifyRecoveryDockerCliは戻り値を返さない。
 * @precondition 「N/A: 実行時引数を受け取らない。」がverifyRecoveryDockerCliの入力契約を満たす。
 * @postcondition verifyRecoveryDockerCliの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: verifyRecoveryDockerCliは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyRecoveryDockerCliは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyRecoveryDockerCliは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyRecoveryDockerCliはProcess内の同一Subsystemで完結する。
 * @security verifyRecoveryDockerCliはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyRecoveryDockerCliは共有非同期状態を持たない同期処理である。
 */
function verifyRecoveryDockerCli() {
  try {
    if (recoveryDockerCliSnapshot === null) {
      recoveryDockerCliSnapshot = observeTrustedDockerCli();
    } else {
      verifyTrustedDockerCliSnapshot(recoveryDockerCliSnapshot);
    }
  } catch {
    throw new Error("docker_task_recovery_cli_untrusted");
  }
}

/**
 * recovery Config Identityを決定する。
 *
 * @responsibility recovery Config Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input configDirectory: string
 * @returns recoveryConfigIdentityの計算結果を返す。
 * @precondition 「configDirectory: string」がrecoveryConfigIdentityの入力契約を満たす。
 * @postcondition recoveryConfigIdentityの責務を完了した結果だけを返す。
 * @effect recoveryConfigIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure recoveryConfigIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant recoveryConfigIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security recoveryConfigIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoveryConfigIdentityは共有非同期状態を持たない同期処理である。
 */
function recoveryConfigIdentity(configDirectory: string) {
  const metadata = fs.lstatSync(configDirectory, { bigint: true });
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync(configDirectory) !== configDirectory ||
    fs.readdirSync(configDirectory).length !== 0
  )
    throw new Error("docker_task_recovery_config_untrusted");
  return `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}`;
}

/**
 * 回復 Dockerを実行する。
 *
 * @responsibility 回復 Dockerの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input configDirectory: string、configIdentity: string、argv: readonly string[]
 * @returns runRecoveryDockerの計算結果を返す。
 * @precondition 「configDirectory: string、configIdentity: string、argv: readonly string[]」がrunRecoveryDockerの入力契約を満たす。
 * @postcondition runRecoveryDockerの責務を完了した結果だけを返す。
 * @effect runRecoveryDockerは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure runRecoveryDockerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runRecoveryDockerは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security runRecoveryDockerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runRecoveryDockerは共有非同期状態を持たない同期処理である。
 */
function runRecoveryDocker(
  configDirectory: string,
  configIdentity: string,
  argv: readonly string[],
) {
  verifyRecoveryDockerCli();
  if (recoveryConfigIdentity(configDirectory) !== configIdentity)
    throw new Error("docker_task_recovery_config_untrusted");
  const environment = createWindowsDockerCliEnvironment({
    dockerConfig: null,
    dockerHome: null,
  });
  if (!environment) throw new Error("docker_recovery_environment_unavailable");
  const result = spawnSync(
    DOCKER_CLI_EXECUTABLE,
    ["--host", DOCKER_ENGINE, "--config", configDirectory, ...argv],
    {
      windowsHide: true,
      shell: false,
      env: environment,
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 1_048_576,
    },
  );
  return Object.freeze({
    status: result.status,
    signal: result.signal,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
    error: result.error ?? null,
  });
}

/**
 * docker-recovery-runtime-internalで使用する回復 Docker 結果の値契約を定義する。
 *
 * @responsibility 回復 Docker 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RecoveryDockerResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RecoveryDockerResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: RecoveryDockerResultの宣言は外部境界を開かない。
 * @security RecoveryDockerResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RecoveryDockerResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RecoveryDockerResult = Readonly<{
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error: Error | null;
}>;

/**
 * recover Exact Docker Resource With Runnerを決定する。
 *
 * @responsibility recover Exact Docker Resource With Runnerの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input runDocker: (argv: readonly string[]) => RecoveryDockerResult、kind: "container" | "network"、dockerId: string、expectedName: string、ownershipLabel: string、expectedImage: string | null、shouldBeInternal: boolean | null、purpose: string、expectedNetworks: readonly string[]、operationMode: "boolean_probe" | "isolated_task"、workspaceMountMode: "read_write" | "read_only" | null、options: Readonly<{ allowAlreadyAbsent?: boolean; removeAfterVerification?: boolean; }>
 * @returns recoverExactDockerResourceWithRunnerの計算結果を返す。
 * @precondition 「runDocker: (argv: readonly string[]) => RecoveryDockerResult、kind: "container" | "network"、dockerId: string、expectedName: string、ownershipLabel: string、expectedImage: string | null、shouldBeInternal: boolean | null、purpose: string、expectedNetworks: readonly string[]、operationMode: "boolean_probe" | "isolated_task"、workspaceMountMode: "read_write" | "read_only" | null、options: Readonly<{ allowAlreadyAbsent?: boolean; removeAfterVerification?: boolean; }>」がrecoverExactDockerResourceWithRunnerの入力契約を満たす。
 * @postcondition recoverExactDockerResourceWithRunnerの責務を完了した結果だけを返す。
 * @effect N/A: recoverExactDockerResourceWithRunnerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure recoverExactDockerResourceWithRunnerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant recoverExactDockerResourceWithRunnerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoverExactDockerResourceWithRunnerはProcess内の同一Subsystemで完結する。
 * @security recoverExactDockerResourceWithRunnerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoverExactDockerResourceWithRunnerは共有非同期状態を持たない同期処理である。
 */
export function recoverExactDockerResourceWithRunner(
  runDocker: (argv: readonly string[]) => RecoveryDockerResult,
  kind: "container" | "network",
  dockerId: string,
  expectedName: string,
  ownershipLabel: string,
  expectedImage: string | null,
  shouldBeInternal: boolean | null,
  purpose: string,
  expectedNetworks: readonly string[],
  operationMode: "boolean_probe" | "isolated_task" | "workbench_advice",
  workspaceMountMode: "read_write" | "read_only" | null,
  options: Readonly<{
    allowAlreadyAbsent?: boolean;
    removeAfterVerification?: boolean;
  }> = Object.freeze({}),
) {
  const exactNameAbsent = () => {
    const named = runDocker(
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--no-trunc",
            "--filter",
            `name=^/${expectedName}$`,
            "--format",
            "{{.ID}}",
          ]
        : [
            "network",
            "ls",
            "--no-trunc",
            "--filter",
            `name=^${expectedName}$`,
            "--format",
            "{{.ID}}",
          ],
    );
    return (
      named.status === 0 &&
      !named.signal &&
      !named.error &&
      named.stderr.length === 0 &&
      named.stdout.trim() === ""
    );
  };
  const listArgs =
    kind === "container"
      ? [
          "container",
          "ls",
          "--all",
          "--no-trunc",
          "--filter",
          `id=${dockerId}`,
          "--format",
          "{{.ID}}",
        ]
      : [
          "network",
          "ls",
          "--no-trunc",
          "--filter",
          `id=${dockerId}`,
          "--format",
          "{{.ID}}",
        ];
  const listed = runDocker(listArgs);
  if (
    listed.status !== 0 ||
    listed.signal ||
    listed.error ||
    listed.stderr.length
  )
    return false;
  const ids = listed.stdout.trim() ? listed.stdout.trim().split(/\r?\n/u) : [];
  if (ids.length === 0)
    return options.allowAlreadyAbsent !== false && exactNameAbsent();
  if (ids.length !== 1 || ids[0] !== dockerId) return false;
  const inspected = runDocker(
    kind === "container"
      ? ["container", "inspect", dockerId]
      : ["network", "inspect", dockerId],
  );
  if (
    inspected.status !== 0 ||
    inspected.signal ||
    inspected.error ||
    inspected.stderr.length
  )
    return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(inspected.stdout);
  } catch {
    return false;
  }
  if (!Array.isArray(parsed) || parsed.length !== 1) return false;
  const value = parsed[0] as Record<string, unknown>;
  const config = value.Config as Record<string, unknown> | undefined;
  const labels = (kind === "container" ? config?.Labels : value.Labels) as
    | Record<string, unknown>
    | undefined;
  const rawName = value.Name;
  const name =
    kind === "container" &&
    typeof rawName === "string" &&
    rawName.startsWith("/")
      ? rawName.slice(1)
      : rawName;
  const configurationMatches = (() => {
    if (kind === "network")
      return value.Driver === "bridge" && value.Scope === "local";
    const hostConfig = value.HostConfig as Record<string, unknown> | undefined;
    const networkSettings = value.NetworkSettings as
      | Record<string, unknown>
      | undefined;
    const networks = networkSettings?.Networks;
    const networkNames =
      networks && typeof networks === "object" && !Array.isArray(networks)
        ? Object.keys(networks as Record<string, unknown>).sort()
        : [];
    const droppedCapabilities = Array.isArray(hostConfig?.CapDrop)
      ? hostConfig.CapDrop.map(String)
      : [];
    const capAdd = hostConfig?.CapAdd;
    const securityOptions = Array.isArray(hostConfig?.SecurityOpt)
      ? hostConfig.SecurityOpt.map(String)
      : [];
    const bindMounts = Array.isArray(value.Mounts)
      ? (value.Mounts as Array<Record<string, unknown>>).filter(
          (mount) => mount.Type === "bind",
        )
      : [];
    const expectedMounts =
      purpose === "create_subscription_auth_probe"
        ? [{ destination: "/provider-home", readWrite: false }]
        : purpose === "create_provider"
          ? [
              { destination: "/provider-home", readWrite: true },
              { destination: "/tmp", readWrite: true },
              ...(operationMode === "isolated_task"
                ? [
                    {
                      destination: "/work",
                      readWrite: workspaceMountMode !== "read_only",
                    },
                  ]
                : []),
            ]
          : [];
    const observedMounts = bindMounts
      .map((mount) => ({
        destination: mount.Destination,
        readWrite: mount.RW,
        propagation: mount.Propagation,
      }))
      .sort((left, right) =>
        String(left.destination).localeCompare(String(right.destination)),
      );
    expectedMounts.sort((left, right) =>
      left.destination.localeCompare(right.destination),
    );
    const mountsMatch =
      observedMounts.length === expectedMounts.length &&
      observedMounts.every(
        (mount, index) =>
          mount.destination === expectedMounts[index]?.destination &&
          mount.readWrite === expectedMounts[index]?.readWrite &&
          mount.propagation === "rprivate",
      );
    const tmpfs = hostConfig?.Tmpfs;
    const proxyTmpfsMatches =
      purpose !== "create_proxy" ||
      (tmpfs !== null &&
        typeof tmpfs === "object" &&
        !Array.isArray(tmpfs) &&
        Object.keys(tmpfs as Record<string, unknown>).length === 1 &&
        typeof (tmpfs as Record<string, unknown>)["/tmp"] === "string" &&
        String((tmpfs as Record<string, unknown>)["/tmp"]).includes("noexec") &&
        String((tmpfs as Record<string, unknown>)["/tmp"]).includes("nosuid") &&
        String((tmpfs as Record<string, unknown>)["/tmp"]).includes(
          "size=16777216",
        ));
    return (
      config?.User === "65534:65534" &&
      hostConfig?.ReadonlyRootfs === true &&
      hostConfig?.Privileged === false &&
      droppedCapabilities.length === 1 &&
      droppedCapabilities[0]?.toUpperCase() === "ALL" &&
      (capAdd === null || (Array.isArray(capAdd) && capAdd.length === 0)) &&
      securityOptions.some((option) =>
        option.startsWith("no-new-privileges"),
      ) &&
      hostConfig?.PidsLimit ===
        (purpose === "create_subscription_auth_probe" ? 32 : 64) &&
      dockerContainerInitObservationMatches(
        hostConfig,
        purpose === "create_provider" &&
          codexAdviceProviderInitRequired(operationMode, expectedImage),
      ) &&
      networkNames.length === expectedNetworks.length &&
      networkNames.every(
        (networkName, index) =>
          networkName === [...expectedNetworks].sort()[index],
      ) &&
      mountsMatch &&
      proxyTmpfsMatches
    );
  })();
  if (
    value.Id !== dockerId ||
    name !== expectedName ||
    labels?.["crdd.coordinator.runtime"] !== ownershipLabel.split("=")[1] ||
    (kind === "container" && config?.Image !== expectedImage) ||
    (kind === "network" && value.Internal !== shouldBeInternal) ||
    !configurationMatches
  )
    return false;
  if (options.removeAfterVerification === false) return true;
  const removed = runDocker(
    kind === "container"
      ? ["container", "rm", "--force", dockerId]
      : ["network", "rm", dockerId],
  );
  if (removed.status !== 0 || removed.signal || removed.error) return false;
  const absent = runDocker(listArgs);
  return (
    absent.status === 0 &&
    !absent.signal &&
    !absent.error &&
    absent.stderr.length === 0 &&
    absent.stdout.trim() === "" &&
    exactNameAbsent()
  );
}

/**
 * Resolve the crash window after an exact create submission was durably
 *
 * @responsibility docker-recovery-runtime-internalの入力からrecover Unknown Docker Create Outcome With Runnerを導く規則と結果境界を所有する。
 * @trace ARCH-000008
 * @input runDocker: (argv: readonly string[]) => RecoveryDockerResult、kind: "container" | "network"、expectedName: string、ownershipLabel: string、expectedImage: string | null、shouldBeInternal: boolean | null、purpose: string、expectedNetworks: readonly string[]、operationMode: "boolean_probe" | "isolated_task"、workspaceMountMode: "read_write" | "read_only" | null
 * @returns recoverUnknownDockerCreateOutcomeWithRunnerの計算結果を返す。
 * @precondition 「runDocker: (argv: readonly string[]) => RecoveryDockerResult、kind: "container" | "network"、expectedName: string、ownershipLabel: string、expectedImage: string | null、shouldBeInternal: boolean | null、purpose: string、expectedNetworks: readonly string[]、operationMode: "boolean_probe" | "isolated_task"、workspaceMountMode: "read_write" | "read_only" | null」がrecoverUnknownDockerCreateOutcomeWithRunnerの入力契約を満たす。
 * @postcondition recoverUnknownDockerCreateOutcomeWithRunnerの責務を完了した結果だけを返す。
 * @effect N/A: recoverUnknownDockerCreateOutcomeWithRunnerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoverUnknownDockerCreateOutcomeWithRunnerは独自の失敗分岐を所有しない。
 * @invariant recoverUnknownDockerCreateOutcomeWithRunnerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoverUnknownDockerCreateOutcomeWithRunnerはProcess内の同一Subsystemで完結する。
 * @security recoverUnknownDockerCreateOutcomeWithRunnerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoverUnknownDockerCreateOutcomeWithRunnerは共有非同期状態を持たない同期処理である。
 */
export function recoverUnknownDockerCreateOutcomeWithRunner(
  runDocker: (argv: readonly string[]) => RecoveryDockerResult,
  kind: "container" | "network",
  expectedName: string,
  ownershipLabel: string,
  expectedImage: string | null,
  shouldBeInternal: boolean | null,
  purpose: string,
  expectedNetworks: readonly string[],
  operationMode: "boolean_probe" | "isolated_task" | "workbench_advice",
  workspaceMountMode: "read_write" | "read_only" | null,
) {
  const list = (...filters: readonly string[]) =>
    runDocker(
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--no-trunc",
            ...filters.flatMap((filter) => ["--filter", filter]),
            "--format",
            "{{.ID}}",
          ]
        : [
            "network",
            "ls",
            "--no-trunc",
            ...filters.flatMap((filter) => ["--filter", filter]),
            "--format",
            "{{.ID}}",
          ],
    );
  const ids = (result: RecoveryDockerResult) => {
    if (
      result.status !== 0 ||
      result.signal ||
      result.error ||
      result.stderr.length !== 0
    )
      return null;
    const values = result.stdout.trim()
      ? result.stdout.trim().split(/\r?\n/u)
      : [];
    return values.length <= 1 && values.every((value) => HEX64.test(value))
      ? values
      : null;
  };
  const nameFilter =
    kind === "container" ? `name=^/${expectedName}$` : `name=^${expectedName}$`;
  const labelFilter = `label=${ownershipLabel}`;
  const byNameItems = ids(list(nameFilter));
  const byOwnershipItems = ids(list(nameFilter, labelFilter));
  if (!byNameItems || !byOwnershipItems) return null;
  if (byNameItems.length === 0 && byOwnershipItems.length === 0) return null;
  if (
    byNameItems.length !== 1 ||
    byOwnershipItems.length !== 1 ||
    byNameItems[0] !== byOwnershipItems[0]
  )
    return null;
  return recoverExactDockerResourceWithRunner(
    runDocker,
    kind,
    byNameItems[0] as string,
    expectedName,
    ownershipLabel,
    expectedImage,
    shouldBeInternal,
    purpose,
    expectedNetworks,
    operationMode,
    workspaceMountMode,
    Object.freeze({
      allowAlreadyAbsent: false,
      removeAfterVerification: false,
    }),
  )
    ? (byNameItems[0] as string)
    : null;
}

/**
 * Submitted Docker Resource Absent With Runnerを観測する。
 *
 * @responsibility Submitted Docker Resource Absent With Runnerの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input runDocker: (argv: readonly string[]) => RecoveryDockerResult、kind: "container" | "network"、expectedName: string、ownershipLabel: string
 * @returns observeSubmittedDockerResourceAbsentWithRunnerの計算結果を返す。
 * @precondition 「runDocker: (argv: readonly string[]) => RecoveryDockerResult、kind: "container" | "network"、expectedName: string、ownershipLabel: string」がobserveSubmittedDockerResourceAbsentWithRunnerの入力契約を満たす。
 * @postcondition observeSubmittedDockerResourceAbsentWithRunnerの責務を完了した結果だけを返す。
 * @effect N/A: observeSubmittedDockerResourceAbsentWithRunnerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observeSubmittedDockerResourceAbsentWithRunnerは独自の失敗分岐を所有しない。
 * @invariant observeSubmittedDockerResourceAbsentWithRunnerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeSubmittedDockerResourceAbsentWithRunnerはProcess内の同一Subsystemで完結する。
 * @security observeSubmittedDockerResourceAbsentWithRunnerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeSubmittedDockerResourceAbsentWithRunnerは共有非同期状態を持たない同期処理である。
 */
function observeSubmittedDockerResourceAbsentWithRunner(
  runDocker: (argv: readonly string[]) => RecoveryDockerResult,
  kind: "container" | "network",
  expectedName: string,
  ownershipLabel: string,
) {
  const nameFilter =
    kind === "container" ? `name=^/${expectedName}$` : `name=^${expectedName}$`;
  const executeRecoveryOperation = (...filters: readonly string[]) =>
    runDocker(
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--no-trunc",
            ...filters.flatMap((filter) => ["--filter", filter]),
            "--format",
            "{{.ID}}",
          ]
        : [
            "network",
            "ls",
            "--no-trunc",
            ...filters.flatMap((filter) => ["--filter", filter]),
            "--format",
            "{{.ID}}",
          ],
    );
  return [
    executeRecoveryOperation(nameFilter),
    executeRecoveryOperation(nameFilter, `label=${ownershipLabel}`),
  ].every(
    (result) =>
      result.status === 0 &&
      !result.signal &&
      !result.error &&
      result.stderr.length === 0 &&
      result.stdout.trim() === "",
  );
}

/**
 * recover Exact Docker Resourceを決定する。
 *
 * @responsibility recover Exact Docker Resourceの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input configDirectory: string、configIdentity: string、kind: "container" | "network"、dockerId: string、expectedName: string、ownershipLabel: string、expectedImage: string | null、shouldBeInternal: boolean | null、purpose: string、expectedNetworks: readonly string[]、operationMode: "boolean_probe" | "isolated_task"、workspaceMountMode: "read_write" | "read_only" | null
 * @returns recoverExactDockerResourceの計算結果を返す。
 * @precondition 「configDirectory: string、configIdentity: string、kind: "container" | "network"、dockerId: string、expectedName: string、ownershipLabel: string、expectedImage: string | null、shouldBeInternal: boolean | null、purpose: string、expectedNetworks: readonly string[]、operationMode: "boolean_probe" | "isolated_task"、workspaceMountMode: "read_write" | "read_only" | null」がrecoverExactDockerResourceの入力契約を満たす。
 * @postcondition recoverExactDockerResourceの責務を完了した結果だけを返す。
 * @effect N/A: recoverExactDockerResourceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoverExactDockerResourceは独自の失敗分岐を所有しない。
 * @invariant recoverExactDockerResourceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoverExactDockerResourceはProcess内の同一Subsystemで完結する。
 * @security recoverExactDockerResourceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoverExactDockerResourceは共有非同期状態を持たない同期処理である。
 */
function recoverExactDockerResource(
  configDirectory: string,
  configIdentity: string,
  kind: "container" | "network",
  dockerId: string,
  expectedName: string,
  ownershipLabel: string,
  expectedImage: string | null,
  shouldBeInternal: boolean | null,
  purpose: string,
  expectedNetworks: readonly string[],
  operationMode: "boolean_probe" | "isolated_task" | "workbench_advice",
  workspaceMountMode: "read_write" | "read_only" | null,
) {
  return recoverExactDockerResourceWithRunner(
    (argv) => runRecoveryDocker(configDirectory, configIdentity, argv),
    kind,
    dockerId,
    expectedName,
    ownershipLabel,
    expectedImage,
    shouldBeInternal,
    purpose,
    expectedNetworks,
    operationMode,
    workspaceMountMode,
  );
}

/**
 * 回復 Host Bindingを探索する。
 *
 * @responsibility 回復 Host Bindingの探索Root、対象母集団、未観測境界を所有する。
 * @trace ARCH-000008
 * @input rootPath: string、parsed: NonNullable<ReturnType<typeof parseDockerTaskRecoveryId>>
 * @returns discoverRecoveryHostBindingの計算結果を返す。
 * @precondition 「rootPath: string、parsed: NonNullable<ReturnType<typeof parseDockerTaskRecoveryId>>」がdiscoverRecoveryHostBindingの入力契約を満たす。
 * @postcondition discoverRecoveryHostBindingの責務を完了した結果だけを返す。
 * @effect N/A: discoverRecoveryHostBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure discoverRecoveryHostBindingは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant discoverRecoveryHostBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: discoverRecoveryHostBindingはProcess内の同一Subsystemで完結する。
 * @security discoverRecoveryHostBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: discoverRecoveryHostBindingは共有非同期状態を持たない同期処理である。
 */
function discoverRecoveryHostBinding(
  rootPath: string,
  parsed: NonNullable<ReturnType<typeof parseDockerTaskRecoveryId>>,
) {
  const operationBase = path.join(
    rootPath,
    `docker-task-${parsed.operationNonce}`,
    "base.json",
  );
  const pendingBase = path.join(
    rootPath,
    `pending-docker-task-${parsed.operationNonce}.json`,
  );
  let record:
    | ReturnType<typeof readCommittedDockerRecoveryJson>
    | ReturnType<typeof discoverDockerRecoveryJournalJsonForRecovery>
    | null = null;
  for (const candidate of [operationBase, pendingBase]) {
    if (!recoveryPathPresent(candidate)) continue;
    try {
      record = readCommittedDockerRecoveryJson(candidate, "base.json");
      break;
    } catch {
      // A move intent can temporarily split the exact pair. Its fsynced anchor
      // remains the only discovery authority until locks are acquired.
    }
  }
  record ??= discoverDockerRecoveryJournalJsonForRecovery(
    rootPath,
    "base.json",
    parsed.token,
  );
  if (
    !record ||
    record.hash !== parsed.baseHash ||
    !validateDockerRecoveryBase(record.value, parsed.operationNonce)
  )
    throw new Error("docker_task_recovery_base_mismatch");
  const base = record.value as Record<string, unknown>;
  if (base.stableLogicalHomeBindingHash !== parsed.stableLogicalHomeBindingHash)
    throw new Error("docker_task_recovery_base_mismatch");
  const hostPaths = hostPathsFromBase(base);
  const initialHostRecoveryId = String(base.initialHostRecoveryId ?? "");
  const initialHostIdentity = parseHostRecoveryToken(initialHostRecoveryId);
  return Object.freeze({
    hostRoot: hostPaths.root,
    hostNonce: initialHostIdentity.nonce,
  });
}

/**
 * 回復 Runtime 状態 Bindingを探索する。
 *
 * @responsibility 回復 Runtime 状態 Bindingの探索Root、対象母集団、未観測境界を所有する。
 * @trace ARCH-000008
 * @input rootPath: string、parsed: NonNullable<ReturnType<typeof parseDockerTaskRecoveryId>>
 * @returns discoverRecoveryRuntimeStateBindingの計算結果を返す。
 * @precondition 「rootPath: string、parsed: NonNullable<ReturnType<typeof parseDockerTaskRecoveryId>>」がdiscoverRecoveryRuntimeStateBindingの入力契約を満たす。
 * @postcondition discoverRecoveryRuntimeStateBindingの責務を完了した結果だけを返す。
 * @effect N/A: discoverRecoveryRuntimeStateBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure discoverRecoveryRuntimeStateBindingは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant discoverRecoveryRuntimeStateBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: discoverRecoveryRuntimeStateBindingはProcess内の同一Subsystemで完結する。
 * @security discoverRecoveryRuntimeStateBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: discoverRecoveryRuntimeStateBindingは共有非同期状態を持たない同期処理である。
 */
function discoverRecoveryRuntimeStateBinding(
  rootPath: string,
  parsed: NonNullable<ReturnType<typeof parseDockerTaskRecoveryId>>,
) {
  const completionReceipt = inspectCompletedDockerRecoveryReceipt(
    rootPath,
    parsed.token,
  );
  if (completionReceipt) return completionReceipt.runtimeStateBinding;
  const cleanupIntent = inspectDockerRecoveryJournalDirectory(rootPath).find(
    (intent) =>
      intent.schema === "crdd-coordinator-recovery-cleanup-delete/v1" &&
      intent.recoveryId === parsed.token,
  );
  if (cleanupIntent?.runtimeStateBinding) {
    if (!validRuntimeStateBindingEvidence(cleanupIntent.runtimeStateBinding))
      throw new Error("docker_task_runtime_state_binding_evidence_invalid");
    return cleanupIntent.runtimeStateBinding;
  }
  const cleanupDirectory = path.join(
    rootPath,
    `cleanup-docker-task-${parsed.stableLogicalHomeBindingHash}-${parsed.operationNonce}-${parsed.baseHash}`,
  );
  if (recoveryPathPresent(cleanupDirectory))
    return verifyRecoveryCleanupManifest(cleanupDirectory, parsed.token)
      .runtimeStateBinding;
  const operationDirectory = path.join(
    rootPath,
    `docker-task-${parsed.operationNonce}`,
  );
  if (
    recoveryPathPresent(path.join(operationDirectory, "cleanup-manifest.json"))
  )
    return verifyRecoveryCleanupManifest(operationDirectory, parsed.token)
      .runtimeStateBinding;
  const operationBase = path.join(operationDirectory, "base.json");
  const pendingBase = path.join(
    rootPath,
    `pending-docker-task-${parsed.operationNonce}.json`,
  );
  let record:
    | ReturnType<typeof readCommittedDockerRecoveryJson>
    | ReturnType<typeof discoverDockerRecoveryJournalJsonForRecovery>
    | null = null;
  for (const candidate of [operationBase, pendingBase]) {
    if (!recoveryPathPresent(candidate)) continue;
    try {
      record = readCommittedDockerRecoveryJson(candidate, "base.json");
      break;
    } catch {
      // A durable move intent remains the read-only authority until resume.
    }
  }
  record ??= discoverDockerRecoveryJournalJsonForRecovery(
    rootPath,
    "base.json",
    parsed.token,
  );
  if (
    !record ||
    record.hash !== parsed.baseHash ||
    !validateDockerRecoveryBase(record.value, parsed.operationNonce)
  )
    return null;
  const base = record.value as Record<string, unknown>;
  if (base.stableLogicalHomeBindingHash !== parsed.stableLogicalHomeBindingHash)
    throw new Error("docker_task_recovery_base_mismatch");
  return base.runtimeStateBinding as RuntimeStateBindingEvidence;
}

/**
 * observer; contract tests may supply an exact fixed observation.
 *
 * @responsibility docker-recovery-runtime-internalの入力からrecover Runtime 所有 Docker Task From Verified Root With Observerを導く規則と結果境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown、root: VerifiedRuntimeStateRoot、observeRuntimeStateRoot: () => VerifiedRuntimeStateRoot | null、recoveryDockerRunner: | ((argv: readonly string[]) => RecoveryDockerResult) | null、restartFence: VerifiedDockerEngineRestartFence | null
 * @returns recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserverの計算結果を返す。
 * @precondition 「token: unknown、root: VerifiedRuntimeStateRoot、observeRuntimeStateRoot: () => VerifiedRuntimeStateRoot | null、recoveryDockerRunner: | ((argv: readonly string[]) => RecoveryDockerResult) | null、restartFence: VerifiedDockerEngineRestartFence | null」がrecoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserverの入力契約を満たす。
 * @postcondition recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserverの責務を完了した結果だけを返す。
 * @effect recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserverはFilesystemの読取りまたは書込みを実行する。
 * @failure recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserverは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant Host Rootの最初の観測より前に同世代排他を取得し、Hostを使わない検証済み終端清掃だけ取得を省略する。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserverはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency Host、Provider HomeとRuntime Stateの排他を所有し、一時解放後は同じ世代と実体を再照合する。
 */
export function recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
  token: unknown,
  root: VerifiedRuntimeStateRoot,
  observeRuntimeStateRoot: () => VerifiedRuntimeStateRoot | null,
  recoveryDockerRunner:
    | ((argv: readonly string[]) => RecoveryDockerResult)
    | null = null,
  restartFence: VerifiedDockerEngineRestartFence | null = null,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  if (!parsed)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_id_invalid",
      recoveryId: null,
    });
  if (restartFence && restartFence.recoveryId !== parsed.token)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_restart_fence_mismatch",
      recoveryId: parsed.token,
    });
  let durableRuntimeStateBinding: RuntimeStateBindingEvidence | null;
  try {
    durableRuntimeStateBinding = discoverRecoveryRuntimeStateBinding(
      root.rootPath,
      parsed,
    );
    if (!durableRuntimeStateBinding)
      throw new Error("docker_task_recovery_evidence_missing");
    if (
      durableRuntimeStateBinding.runtimeStateIdentityHash !==
        root.runtimeStateIdentityHash ||
      durableRuntimeStateBinding.runtimeStateProtectionHash !==
        root.runtimeStateProtectionHash ||
      durableRuntimeStateBinding.runtimeStateBindingHash !==
        root.stableLogicalHomeBindingHash
    )
      throw new Error("docker_task_runtime_state_binding_changed");
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_runtime_state_binding_evidence_invalid",
      ),
      recoveryId: parsed.token,
    });
  }
  const preliminaryInventory = inspectDockerRecoveryRootSnapshot(root.rootPath);
  const recoveryStillPresent =
    preliminaryInventory.status === "completed" &&
    preliminaryInventory.dockerRecoveryIds.some(
      (value: unknown) => value === parsed.token,
    );
  if (!recoveryStillPresent) {
    const completionReceipt = inspectCompletedDockerRecoveryReceipt(
      root.rootPath,
      parsed.token,
    );
    if (preliminaryInventory.status === "completed" && completionReceipt) {
      const homeLock = acquireRuntimeOwnedLogicalProviderHomeKernelLock(
        parsed.stableLogicalHomeBindingHash,
      );
      const stateLock = homeLock
        ? createDockerRecoveryRuntimeStateLockController(
            root.stableLogicalHomeBindingHash,
          )
        : null;
      if (homeLock && stateLock) {
        let isReplaySucceeded = false;
        let replayFailureReason = "docker_task_runtime_state_audit_failed";
        try {
          ensureDockerTaskSessionHandoff(
            root,
            parsed.token,
            durableRuntimeStateBinding,
          );
          const observed = observeRuntimeStateRoot();
          if (
            !observed ||
            observed.runtimeStateIdentityHash !==
              root.runtimeStateIdentityHash ||
            observed.runtimeStateProtectionHash !==
              root.runtimeStateProtectionHash ||
            observed.localUserBindingHash !== root.localUserBindingHash ||
            observed.stableLogicalHomeBindingHash !==
              root.stableLogicalHomeBindingHash
          )
            throw new Error("docker_task_runtime_state_binding_changed");
          isReplaySucceeded = true;
        } catch (error) {
          replayFailureReason = safeRecoveryReason(
            error,
            "docker_task_runtime_state_audit_failed",
          );
        }
        const releaseFailure = releaseRecoverySynchronizations([
          {
            release: () => stateLock.close(),
            reason: "docker_task_runtime_state_lock_release_unconfirmed",
          },
          {
            release: () => homeLock.release(),
            reason: "docker_task_recovery_home_lock_release_unconfirmed",
          },
        ]);
        if (releaseFailure)
          return Object.freeze({
            status: "blocked" as const,
            reason: releaseFailure,
            recoveryId: parsed.token,
          });
        if (isReplaySucceeded)
          return Object.freeze({
            status: "recovered" as const,
            reason: "docker_task_recovery_completion_replayed",
            recoveryId: null,
          });
        return Object.freeze({
          status: "blocked" as const,
          reason: replayFailureReason,
          recoveryId: parsed.token,
        });
      } else if (homeLock && !homeLock.release())
        return Object.freeze({
          status: "blocked" as const,
          reason: "docker_task_recovery_home_lock_release_unconfirmed",
          recoveryId: parsed.token,
        });
    }
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_runtime_state_audit_failed",
      recoveryId: parsed.token,
    });
  }
  const cleanupDirectoryCandidate = path.join(
    root.rootPath,
    `cleanup-docker-task-${parsed.stableLogicalHomeBindingHash}-${parsed.operationNonce}-${parsed.baseHash}`,
  );
  const cleanupIntentPresent = inspectDockerRecoveryJournalDirectory(
    root.rootPath,
  ).some(
    (intent) =>
      intent.schema === "crdd-coordinator-recovery-cleanup-delete/v1" &&
      intent.recoveryId === parsed.token,
  );
  let hostOperationGeneration: object | null = null;
  let hostOperationGenerationIdentity: Readonly<{
    hostRoot: string;
    hostNonce: string;
  }> | null = null;
  if (
    !recoveryPathPresent(cleanupDirectoryCandidate) &&
    !cleanupIntentPresent
  ) {
    try {
      const discovered = discoverRecoveryHostBinding(root.rootPath, parsed);
      hostOperationGenerationIdentity = Object.freeze({
        hostRoot: discovered.hostRoot,
        hostNonce: discovered.hostNonce,
      });
      hostOperationGeneration =
        acquireHostOperationRecoveryGenerationByIdentity(
          discovered.hostRoot,
          discovered.hostNonce,
        );
    } catch {
      hostOperationGeneration = null;
    }
    if (!hostOperationGeneration)
      return Object.freeze({
        status: "blocked" as const,
        reason: "docker_task_host_operation_generation_active_or_unknown",
        recoveryId: parsed.token,
      });
  }
  const processAbsenceLock = acquireRuntimeOwnedLogicalProviderHomeKernelLock(
    parsed.stableLogicalHomeBindingHash,
  );
  if (!processAbsenceLock) {
    const releaseFailure = releaseRecoverySynchronizations(
      hostOperationGeneration
        ? [
            {
              release: () =>
                releaseHostOperationRecoveryGeneration(hostOperationGeneration),
              reason: "docker_task_recovery_host_lock_release_unconfirmed",
            },
          ]
        : [],
    );
    return Object.freeze({
      status: "blocked" as const,
      reason:
        releaseFailure ?? "docker_task_process_generation_active_or_unknown",
      recoveryId: parsed.token,
    });
  }
  const runtimeStateLockController =
    createDockerRecoveryRuntimeStateLockController(
      root.stableLogicalHomeBindingHash,
    );
  if (!runtimeStateLockController) {
    const releaseFailure = releaseRecoverySynchronizations([
      {
        release: () => processAbsenceLock.release(),
        reason: "docker_task_recovery_home_lock_release_unconfirmed",
      },
      ...(hostOperationGeneration
        ? [
            {
              release: () =>
                releaseHostOperationRecoveryGeneration(hostOperationGeneration),
              reason: "docker_task_recovery_host_lock_release_unconfirmed",
            },
          ]
        : []),
    ]);
    return Object.freeze({
      status: "blocked" as const,
      reason:
        releaseFailure ??
        "docker_task_runtime_state_generation_active_or_unknown",
      recoveryId: parsed.token,
    });
  }
  const outsideHostOperationGenerationLock = <T>(effect: () => T) => {
    if (!hostOperationGeneration || !hostOperationGenerationIdentity)
      return effect();
    const hostRootBefore = recoveryPathPresent(
      hostOperationGenerationIdentity.hostRoot,
    )
      ? fs.lstatSync(hostOperationGenerationIdentity.hostRoot, {
          bigint: true,
        })
      : null;
    const generationToRelease = hostOperationGeneration;
    hostOperationGeneration = null;
    if (!releaseHostOperationRecoveryGeneration(generationToRelease))
      throw new Error("docker_task_recovery_host_lock_release_unconfirmed");
    let effectResult: T | null = null;
    let effectError: unknown = null;
    try {
      effectResult = effect();
    } catch (error) {
      effectError = error;
    }
    hostOperationGeneration = acquireHostOperationRecoveryGenerationByIdentity(
      hostOperationGenerationIdentity.hostRoot,
      hostOperationGenerationIdentity.hostNonce,
    );
    if (!hostOperationGeneration)
      throw new Error(
        "docker_task_host_operation_generation_active_or_unknown",
      );
    const hostRootAfter = recoveryPathPresent(
      hostOperationGenerationIdentity.hostRoot,
    )
      ? fs.lstatSync(hostOperationGenerationIdentity.hostRoot, {
          bigint: true,
        })
      : null;
    if (
      Boolean(hostRootBefore) !== Boolean(hostRootAfter) ||
      (hostRootBefore &&
        hostRootAfter &&
        (hostRootBefore.dev !== hostRootAfter.dev ||
          hostRootBefore.ino !== hostRootAfter.ino ||
          hostRootBefore.birthtimeNs !== hostRootAfter.birthtimeNs))
    )
      throw new Error("docker_task_recovery_host_binding_changed");
    if (effectError) throw effectError;
    return effectResult as T;
  };
  let sessionHandoff: DockerTaskSessionHandoffState;
  try {
    const currentBeforeHandoff = runtimeStateLockController.outsideLock(() =>
      outsideHostOperationGenerationLock(observeRuntimeStateRoot),
    );
    if (
      !currentBeforeHandoff ||
      currentBeforeHandoff.runtimeStateIdentityHash !==
        root.runtimeStateIdentityHash ||
      currentBeforeHandoff.runtimeStateProtectionHash !==
        root.runtimeStateProtectionHash ||
      currentBeforeHandoff.localUserBindingHash !== root.localUserBindingHash ||
      currentBeforeHandoff.stableLogicalHomeBindingHash !==
        root.stableLogicalHomeBindingHash
    )
      throw new Error("docker_task_runtime_state_binding_changed");
    sessionHandoff = ensureDockerTaskSessionHandoff(
      root,
      parsed.token,
      durableRuntimeStateBinding,
    );
  } catch (error) {
    const releaseFailure = releaseRecoverySynchronizations([
      {
        release: () => runtimeStateLockController.close(),
        reason: "docker_task_runtime_state_lock_release_unconfirmed",
      },
      {
        release: () => processAbsenceLock.release(),
        reason: "docker_task_recovery_home_lock_release_unconfirmed",
      },
      ...(hostOperationGeneration
        ? [
            {
              release: () =>
                releaseHostOperationRecoveryGeneration(hostOperationGeneration),
              reason: "docker_task_recovery_host_lock_release_unconfirmed",
            },
          ]
        : []),
    ]);
    return Object.freeze({
      status: "blocked" as const,
      reason:
        releaseFailure ??
        safeRecoveryReason(error, "docker_task_session_handoff_failed_closed"),
      recoveryId: parsed.token,
    });
  }
  const runtimeStateBinding = Object.freeze({
    rootPath: root.rootPath,
    ...durableRuntimeStateBinding,
    // The durable record keeps the issuing session. Mutations after a verified
    // handoff are authorized only by the fresh current-session observation.
    localUserBindingHash: sessionHandoff.currentLocalUserBindingHash,
  });
  const recoverySessionLocalUserBindingHash: string | null =
    sessionHandoff.currentLocalUserBindingHash;
  const outsideRecoveryGenerationLocks = <T>(effect: () => T) => {
    const reboundDurableBinding = discoverRecoveryRuntimeStateBinding(
      root.rootPath,
      parsed,
    );
    if (
      !reboundDurableBinding ||
      reboundDurableBinding.runtimeStateIdentityHash !==
        durableRuntimeStateBinding.runtimeStateIdentityHash ||
      reboundDurableBinding.runtimeStateProtectionHash !==
        durableRuntimeStateBinding.runtimeStateProtectionHash ||
      reboundDurableBinding.runtimeStateBindingHash !==
        durableRuntimeStateBinding.runtimeStateBindingHash ||
      !recoverySessionLocalUserBindingHash
    )
      throw new Error("docker_task_runtime_state_user_binding_changed");
    const reboundHandoff = inspectDockerTaskSessionHandoffs(
      root.rootPath,
      parsed.token,
      durableRuntimeStateBinding,
    );
    if (
      reboundHandoff.currentLocalUserBindingHash !==
        recoverySessionLocalUserBindingHash ||
      recoverySessionLocalUserBindingHash !== root.localUserBindingHash
    )
      throw new Error("docker_task_runtime_state_user_binding_changed");
    const rootBefore = fs.lstatSync(root.rootPath, { bigint: true });
    let observedRoot: VerifiedRuntimeStateRoot | null = null;
    const effectResult = runtimeStateLockController.outsideLock(() =>
      outsideHostOperationGenerationLock(() => {
        const result = effect();
        observedRoot = observeRuntimeStateRoot();
        return result;
      }),
    );
    const rootAfter = fs.lstatSync(root.rootPath, { bigint: true });
    if (
      rootBefore.dev !== rootAfter.dev ||
      rootBefore.ino !== rootAfter.ino ||
      rootBefore.birthtimeNs !== rootAfter.birthtimeNs
    )
      throw new Error("docker_task_runtime_state_binding_changed");
    verifyObservedRuntimeStateMutationBoundary(
      runtimeStateBinding,
      parsed.token,
      observedRoot,
    );
    return effectResult;
  };
  const verifyRecoveryRuntimeStateBoundary = () =>
    outsideRecoveryGenerationLocks(() => undefined);
  const outsideRuntimeStateAndHostOperationLocks = <T>(effect: () => T) =>
    outsideRecoveryGenerationLocks(effect);
  const outsideRuntimeStateLock = <T>(effect: () => T) => {
    const effectResult = runtimeStateLockController.outsideLock(effect);
    verifyRecoveryRuntimeStateBoundary();
    return effectResult;
  };
  try {
    verifyRecoveryRuntimeStateBoundary();
    const initialInventory = inspectDockerRecoveryRootSnapshot(root.rootPath);
    if (initialInventory.status !== "completed")
      throw new Error(initialInventory.reason);
    if (
      !initialInventory.dockerRecoveryIds.some(
        (value: unknown) => value === parsed.token,
      )
    )
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_cleanup_tombstone_completed",
        recoveryId: null,
      });
    resumeDockerRecoveryJournalDirectoryForRecovery(
      root.rootPath,
      parsed.token,
      durableRuntimeStateBinding,
    );
    const inventory = inspectDockerRecoveryRootSnapshot(root.rootPath);
    if (inventory.status !== "completed") throw new Error(inventory.reason);
    if (
      !inventory.dockerRecoveryIds.some(
        (value: unknown) => value === parsed.token,
      )
    )
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_cleanup_tombstone_completed",
        recoveryId: null,
      });
    const operationDirectory = path.join(
      root.rootPath,
      `docker-task-${parsed.operationNonce}`,
    );
    const cleanupDirectory = path.join(
      root.rootPath,
      `cleanup-docker-task-${parsed.stableLogicalHomeBindingHash}-${parsed.operationNonce}-${parsed.baseHash}`,
    );
    if (recoveryPathPresent(cleanupDirectory)) {
      if (recoveryPathPresent(operationDirectory))
        throw new Error("docker_task_recovery_cleanup_tombstone_conflict");
      removeRecoveryCleanupTombstone(cleanupDirectory, parsed.token);
      commitDirectoryMutationBoundary(root.rootPath);
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_cleanup_tombstone_completed",
        recoveryId: null,
      });
    }
    const operationCleanupManifest = path.join(
      operationDirectory,
      "cleanup-manifest.json",
    );
    if (recoveryPathPresent(operationCleanupManifest)) {
      const cleanupManifest = verifyRecoveryCleanupManifest(
        operationDirectory,
        parsed.token,
      );
      if (recoveryPathPresent(cleanupDirectory))
        throw new Error("docker_task_recovery_cleanup_tombstone_conflict");
      fs.renameSync(operationDirectory, cleanupDirectory);
      commitDirectoryMutationBoundary(root.rootPath);
      verifyRecoveryCleanupManifest(cleanupDirectory, parsed.token);
      removeDockerRecoveryCleanupDirectory(
        root.rootPath,
        cleanupDirectory,
        parsed.token,
        cleanupManifest.runtimeStateBinding,
      );
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_cleanup_tombstone_completed",
        recoveryId: null,
      });
    }
    const pendingBasePath = path.join(
      root.rootPath,
      `pending-docker-task-${parsed.operationNonce}.json`,
    );
    const pendingCommitPath = path.join(
      root.rootPath,
      `pending-docker-task-${parsed.operationNonce}.commit.json`,
    );
    const basePath = path.join(operationDirectory, "base.json");
    const baseCommitPath = path.join(operationDirectory, "base-commit.json");
    if (
      !recoveryPathPresent(basePath) &&
      recoveryPathPresent(pendingBasePath) &&
      !recoveryPathPresent(pendingCommitPath)
    ) {
      const pendingBase = readCommittedDockerRecoveryJson(
        pendingBasePath,
        "base.json",
      );
      const pendingBaseValue = pendingBase.value as Record<string, unknown>;
      if (
        pendingBase.hash !== parsed.baseHash ||
        !validateDockerRecoveryBase(pendingBaseValue, parsed.operationNonce) ||
        pendingBaseValue.stableLogicalHomeBindingHash !==
          parsed.stableLogicalHomeBindingHash
      )
        throw new Error("docker_task_recovery_base_mismatch");
      writeDurableJson(
        root.rootPath,
        path.basename(pendingCommitPath),
        Object.freeze({
          schema: "crdd-coordinator-task-docker-base-commit/v1",
          operationNonce: parsed.operationNonce,
          stableLogicalHomeBindingHash: parsed.stableLogicalHomeBindingHash,
          baseHash: parsed.baseHash,
          recoveryId: parsed.token,
          ...(typeof pendingBaseValue.recoveryCorrelationId === "string"
            ? {
                recoveryCorrelationId: pendingBaseValue.recoveryCorrelationId,
              }
            : {}),
        }),
        "base-commit.json",
      );
      const reconstructedInventory = inspectDockerRecoveryRootSnapshot(
        root.rootPath,
      );
      if (
        reconstructedInventory.status !== "completed" ||
        !reconstructedInventory.dockerRecoveryIds.some(
          (value: unknown) => value === parsed.token,
        )
      )
        throw new Error("docker_task_runtime_state_audit_failed");
    }
    if (!recoveryPathPresent(basePath)) {
      if (
        !recoveryPathPresent(pendingBasePath) ||
        !recoveryPathPresent(pendingCommitPath)
      )
        throw new Error("docker_task_recovery_base_missing");
      if (!recoveryPathPresent(operationDirectory))
        fs.mkdirSync(operationDirectory, { mode: 0o700 });
      const operationMetadata = fs.lstatSync(operationDirectory);
      if (
        !operationMetadata.isDirectory() ||
        operationMetadata.isSymbolicLink() ||
        fs.readdirSync(operationDirectory).length !== 0
      )
        throw new Error("docker_task_recovery_operation_invalid");
      moveCommittedDockerRecoveryJson(
        readCommittedDockerRecoveryJson(pendingBasePath, "base.json"),
        basePath,
      );
      moveCommittedDockerRecoveryJson(
        readCommittedDockerRecoveryJson(pendingCommitPath, "base-commit.json"),
        baseCommitPath,
      );
    } else if (recoveryPathPresent(pendingBasePath)) {
      throw new Error("docker_task_recovery_duplicate_base");
    }
    if (!recoveryPathPresent(baseCommitPath)) {
      if (!recoveryPathPresent(pendingCommitPath))
        throw new Error("docker_task_recovery_base_commit_missing");
      moveCommittedDockerRecoveryJson(
        readCommittedDockerRecoveryJson(pendingCommitPath, "base-commit.json"),
        baseCommitPath,
      );
    } else if (recoveryPathPresent(pendingCommitPath)) {
      throw new Error("docker_task_recovery_duplicate_base_commit");
    }
    const baseFile = readExactJson(basePath);
    if (
      createHash("sha256").update(baseFile.serialized).digest("hex") !==
      parsed.baseHash
    )
      throw new Error("docker_task_recovery_base_mismatch");
    const baseCommit = readExactJson(baseCommitPath).value as Record<
      string,
      unknown
    >;
    if (
      !validateDockerRecoveryBaseCommit(
        baseCommit,
        parsed.operationNonce,
        parsed.baseHash,
        parsed.token,
      ) ||
      baseCommit.stableLogicalHomeBindingHash !==
        parsed.stableLogicalHomeBindingHash ||
      baseCommit.baseHash !== parsed.baseHash
    )
      throw new Error("docker_task_recovery_base_commit_mismatch");
    const base = baseFile.value as Record<string, unknown>;
    if (
      !validateDockerRecoveryBase(base, parsed.operationNonce) ||
      base.stableLogicalHomeBindingHash !== parsed.stableLogicalHomeBindingHash
    )
      throw new Error("docker_task_recovery_base_mismatch");
    if (
      String(base.localUserBindingHash ?? "") !==
      durableRuntimeStateBinding.localUserBindingHash
    )
      throw new Error("docker_task_recovery_base_session_binding_mismatch");
    const recoveryRuntimeStateBinding =
      base.runtimeStateBinding as RuntimeStateBindingEvidence;
    verifyRecoveryRuntimeStateBoundary();
    const resources = base.resources as Record<string, string>;
    const images = base.images as Record<string, string>;
    const operationMode = base.operationMode;
    const workspaceMountMode = base.workspaceMountMode;
    if (
      !resources ||
      !images ||
      !exactRecordKeys(resources, [
        "auth",
        "provider",
        "proxy",
        "internal",
        "egress",
      ]) ||
      !exactRecordKeys(images, ["provider", "proxy"]) ||
      [
        resources.provider,
        resources.auth,
        resources.proxy,
        resources.internal,
        resources.egress,
      ].some(
        (value) => typeof value !== "string" || !SAFE_RESOURCE.test(value),
      ) ||
      !/^sha256:[a-f0-9]{64}$/u.test(images.provider ?? "") ||
      !/^sha256:[a-f0-9]{64}$/u.test(images.proxy ?? "") ||
      (operationMode !== "boolean_probe" &&
        operationMode !== "isolated_task" &&
        operationMode !== "workbench_advice") ||
      (workspaceMountMode !== null &&
        workspaceMountMode !== "read_write" &&
        workspaceMountMode !== "read_only") ||
      !/^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(
        String(base.ownershipLabel),
      )
    )
      throw new Error("docker_task_recovery_base_mismatch");
    if (!hostOperationGeneration)
      throw new Error(
        "docker_task_host_operation_generation_active_or_unknown",
      );
    const hostPaths = hostPathsFromBase(base);
    const hostRootPresent = recoveryPathPresent(hostPaths.root);
    const hostMarkerPresent = recoveryPathPresent(hostPaths.marker);
    if (hostRootPresent !== hostMarkerPresent)
      throw new Error("docker_task_recovery_host_cleanup_unconfirmed");
    const isHostStateAlreadyClean = !hostRootPresent && !hostMarkerPresent;
    const managementDirectoryName = managementDirectoryNameFromBase(base);
    const initialHostRecoveryId = String(base.initialHostRecoveryId ?? "");
    const initialHostIdentity = parseHostRecoveryToken(initialHostRecoveryId);
    resumeDockerRecoveryJournalDirectory(operationDirectory);
    const hostManagementDirectory = path.join(
      hostPaths.root,
      managementDirectoryName,
    );
    if (recoveryPathPresent(hostManagementDirectory))
      resumeDockerRecoveryJournalDirectory(hostManagementDirectory);
    inventoryOperationDirectory(
      operationDirectory,
      parsed.token,
      parsed.operationNonce,
      parsed.baseHash,
    );
    const normalRunCompletePath = path.join(
      operationDirectory,
      "normal-run-complete.json",
    );
    const hostCompleteIntentPath = path.join(
      operationDirectory,
      "host-complete-intent.json",
    );
    const hostCompleteReceiptPath = path.join(
      operationDirectory,
      "host-complete-receipt.json",
    );
    if (
      !observeRecoveryFile(hostCompleteReceiptPath) &&
      observeRecoveryFile(hostCompleteIntentPath)
    ) {
      const intent = readExactJson(hostCompleteIntentPath).value as Record<
        string,
        unknown
      >;
      const transition = classifyHostMarkerTransition(
        intent,
        hostPaths.root,
        initialHostIdentity.nonce,
      );
      if (transition.state === "expected")
        writeDurableJson(operationDirectory, "host-complete-receipt.json", {
          previous: transition.currentToken,
          observed: transition.expectedToken,
        });
    }
    if (
      !observeRecoveryFile(normalRunCompletePath) &&
      observeRecoveryFile(hostCompleteReceiptPath)
    ) {
      if (
        !observeRecoveryFile(
          path.join(operationDirectory, "docker-absence.json"),
        ) ||
        !observeRecoveryFile(
          path.join(operationDirectory, "mount-completion.json"),
        )
      )
        throw new Error("docker_task_recovery_normal_evidence_missing");
      const receipt = readExactJson(hostCompleteReceiptPath).value as Record<
        string,
        unknown
      >;
      const observedHostSuccessor = String(receipt.observed ?? "");
      parseHostRecoveryToken(observedHostSuccessor);
      const activeHostBindingPath = path.join(
        hostPaths.root,
        managementDirectoryName,
        "active-docker-task-v1.json",
      );
      const pointerPath = path.join(
        root.rootPath,
        `active-lease-${parsed.stableLogicalHomeBindingHash}.json`,
      );
      const closure = verifyActiveBindingAndPointerClosure(
        activeHostBindingPath,
        pointerPath,
        expectedHostActiveBinding(
          parsed.token,
          parsed.baseHash,
          parsed.operationNonce,
        ),
        {
          stableLogicalHomeBindingHash: parsed.stableLogicalHomeBindingHash,
          operationNonce: parsed.operationNonce,
          recoveryId: parsed.token,
          baseHash: parsed.baseHash,
        },
      );
      if (closure.activeState === "committed") {
        if (!removeCommittedDockerRecoveryJson(activeHostBindingPath))
          throw new Error("docker_task_recovery_active_run_mismatch");
      } else if (closure.activeState !== "absent") {
        throw new Error("docker_task_recovery_active_run_mismatch");
      }
      if (closure.pointerState === "committed") {
        if (!removeCommittedDockerRecoveryJson(pointerPath))
          throw new Error("docker_task_recovery_pointer_mismatch");
      }
      if (
        !observeRecoveryFile(
          path.join(operationDirectory, "lease-release-receipt.json"),
        )
      )
        writeDurableJson(operationDirectory, "lease-release-receipt.json", {
          schema: "crdd-coordinator-provider-home-lease-release/v1",
          recoveryId: parsed.token,
          pointerAbsent: true,
        });
      writeDurableJson(operationDirectory, "normal-run-complete.json", {
        schema: "crdd-coordinator-docker-run-completion/v1",
        recoveryId: parsed.token,
        hostSuccessor: observedHostSuccessor,
      });
    }
    if (observeRecoveryFile(normalRunCompletePath)) {
      const normalRun = readExactJson(normalRunCompletePath).value as Record<
        string,
        unknown
      >;
      const hostSuccessor = String(normalRun.hostSuccessor ?? "");
      const hostIdentity = parseHostRecoveryToken(hostSuccessor);
      if (hostIdentity.nonce !== initialHostIdentity.nonce)
        throw new Error("docker_task_recovery_host_transition_mismatch");
      if (!hostOperationGeneration)
        throw new Error(
          "docker_task_host_operation_generation_active_or_unknown",
        );
      const pointerPath = path.join(
        root.rootPath,
        `active-lease-${parsed.stableLogicalHomeBindingHash}.json`,
      );
      const activeHostBindingPath = path.join(
        hostPaths.root,
        managementDirectoryName,
        "active-docker-task-v1.json",
      );
      if (
        observeRecoveryFile(pointerPath) ||
        observeRecoveryFile(activeHostBindingPath) ||
        !hostRecoveryInventoryReady(
          root.rootPath,
          hostPaths.root,
          operationDirectory,
        )
      )
        throw new Error("docker_task_recovery_host_inventory_incomplete");
      const cleanupIntentPath = path.join(
        operationDirectory,
        "host-cleanup-intent.json",
      );
      if (!recoveryPathPresent(cleanupIntentPath))
        writeDurableJson(operationDirectory, "host-cleanup-intent.json", {
          schema: "crdd-coordinator-host-cleanup-intent/v1",
          recoveryId: parsed.token,
          currentHostRecoveryId: hostSuccessor,
        });
      if (
        recoveryPathPresent(hostPaths.root) ||
        recoveryPathPresent(hostPaths.marker)
      ) {
        const currentHostToken = currentHostRecoveryTokenForInventory(
          root.rootPath,
          hostPaths.root,
        );
        if (!currentHostToken)
          throw new Error("docker_task_recovery_host_lineage_unknown");
        const hostRecovery = outsideRuntimeStateLock(() =>
          recoverOwnedOperationDirectories(
            currentHostToken,
            hostOperationGeneration,
          ),
        );
        if (hostRecovery.status !== "recovered")
          throw new Error(hostRecovery.reason);
      }
      ensureHostCleanupReceipt(operationDirectory, parsed.token, hostPaths);
      removeRecoveryOperationDirectory(
        operationDirectory,
        parsed.token,
        parsed.operationNonce,
        parsed.baseHash,
        parsed.stableLogicalHomeBindingHash,
        recoveryRuntimeStateBinding,
        true,
      );
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_finalization_completed",
        recoveryId: null,
      });
    }
    const existingCrashReceiptPath = path.join(
      operationDirectory,
      "host-crash-absence-receipt.json",
    );
    if (recoveryPathPresent(existingCrashReceiptPath)) {
      const crashReceipt = readExactJson(existingCrashReceiptPath)
        .value as Record<string, unknown>;
      const dockerAbsentHostToken = String(crashReceipt.observed ?? "");
      const hostIdentity = parseHostRecoveryToken(dockerAbsentHostToken);
      if (hostIdentity.nonce !== initialHostIdentity.nonce)
        throw new Error("docker_task_recovery_host_transition_mismatch");
      if (
        !recoveryPathPresent(
          path.join(operationDirectory, "docker-absence-crash.json"),
        )
      )
        throw new Error("docker_task_recovery_crash_evidence_missing");
      const activeHostBindingPath = path.join(
        hostPaths.root,
        managementDirectoryName,
        "active-docker-task-v1.json",
      );
      const pointerPath = path.join(
        root.rootPath,
        `active-lease-${parsed.stableLogicalHomeBindingHash}.json`,
      );
      const closure = verifyActiveBindingAndPointerClosure(
        activeHostBindingPath,
        pointerPath,
        expectedHostActiveBinding(
          parsed.token,
          parsed.baseHash,
          parsed.operationNonce,
        ),
        {
          stableLogicalHomeBindingHash: parsed.stableLogicalHomeBindingHash,
          operationNonce: parsed.operationNonce,
          recoveryId: parsed.token,
          baseHash: parsed.baseHash,
        },
      );
      if (closure.activeState === "committed") {
        if (!removeCommittedDockerRecoveryJson(activeHostBindingPath))
          throw new Error("docker_task_recovery_active_run_mismatch");
      } else if (closure.activeState !== "absent") {
        throw new Error("docker_task_recovery_active_run_mismatch");
      }
      const mountCrashPath = path.join(
        operationDirectory,
        "mount-crash-absence.json",
      );
      if (!recoveryPathPresent(mountCrashPath))
        writeDurableJson(operationDirectory, "mount-crash-absence.json", {
          schema: "crdd-coordinator-provider-home-mount-completion/v1",
          recoveryId: parsed.token,
          evidence: "process_generation_absent_plus_exact_docker_absent",
        });
      if (closure.pointerState === "committed") {
        if (!removeCommittedDockerRecoveryJson(pointerPath))
          throw new Error("docker_task_recovery_pointer_mismatch");
      }
      if (
        !hostRecoveryInventoryReady(
          root.rootPath,
          hostPaths.root,
          operationDirectory,
        )
      )
        throw new Error("docker_task_recovery_host_inventory_incomplete");
      if (
        !recoveryPathPresent(
          path.join(operationDirectory, "host-cleanup-intent.json"),
        )
      )
        writeDurableJson(operationDirectory, "host-cleanup-intent.json", {
          schema: "crdd-coordinator-host-cleanup-intent/v1",
          recoveryId: parsed.token,
          currentHostRecoveryId: dockerAbsentHostToken,
        });
      if (
        recoveryPathPresent(hostPaths.root) ||
        recoveryPathPresent(hostPaths.marker)
      ) {
        const currentHostToken = currentHostRecoveryTokenForInventory(
          root.rootPath,
          hostPaths.root,
        );
        if (!currentHostToken)
          throw new Error("docker_task_recovery_host_lineage_unknown");
        const recovered = outsideRuntimeStateLock(() =>
          recoverOwnedOperationDirectories(
            currentHostToken,
            hostOperationGeneration,
          ),
        );
        if (recovered.status !== "recovered") throw new Error(recovered.reason);
      }
      ensureHostCleanupReceipt(operationDirectory, parsed.token, hostPaths);
      removeRecoveryOperationDirectory(
        operationDirectory,
        parsed.token,
        parsed.operationNonce,
        parsed.baseHash,
        parsed.stableLogicalHomeBindingHash,
        recoveryRuntimeStateBinding,
        true,
      );
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_crash_finalization_completed",
        recoveryId: null,
      });
    }
    const hostBeginIntentPath = path.join(
      operationDirectory,
      "host-begin-intent.json",
    );
    const hostBeginIntentPresent = recoveryPathPresent(hostBeginIntentPath);
    if (!hostBeginIntentPresent && isHostStateAlreadyClean)
      throw new Error("docker_task_recovery_evidence_missing");
    if (!hostBeginIntentPresent)
      writeDurableJson(
        operationDirectory,
        "host-begin-intent.json",
        expectedHostSuccessor(
          initialHostRecoveryId,
          "docker_submission_started",
        ),
      );
    const hostBeginIntent = readExactJson(hostBeginIntentPath).value as Record<
      string,
      string
    >;
    const hostBeginCurrentToken = hostBeginIntent.currentToken ?? "";
    const hostBeginExpectedToken = hostBeginIntent.expectedToken ?? "";
    parseHostRecoveryToken(hostBeginCurrentToken);
    parseHostRecoveryToken(hostBeginExpectedToken);
    const hostBeginReceiptPath = path.join(
      operationDirectory,
      "host-begin-receipt.json",
    );
    const hasSubmission = [...CREATE_PURPOSES].some((purpose) =>
      recoveryPathPresent(
        path.join(operationDirectory, `submission-${purpose}.json`),
      ),
    );
    let hostSubmissionStarted = true;
    let hostReceipt: Record<string, string>;
    if (recoveryPathPresent(hostBeginReceiptPath)) {
      hostReceipt = readExactJson(hostBeginReceiptPath).value as Record<
        string,
        string
      >;
    } else if (isHostStateAlreadyClean) {
      if (hasSubmission)
        throw new Error("docker_task_recovery_host_begin_mismatch");
      hostSubmissionStarted = false;
      hostReceipt = {
        previous: hostBeginCurrentToken,
        observed: hostBeginCurrentToken,
      };
    } else {
      const transition = classifyHostMarkerTransition(
        hostBeginIntent,
        hostPaths.root,
        initialHostIdentity.nonce,
      );
      if (transition.state === "expected") {
        hostReceipt = {
          previous: hostBeginCurrentToken,
          observed: hostBeginExpectedToken,
        };
        writeDurableJson(
          operationDirectory,
          "host-begin-receipt.json",
          hostReceipt,
        );
      } else {
        if (hasSubmission)
          throw new Error("docker_task_recovery_host_begin_mismatch");
        hostSubmissionStarted = false;
        hostReceipt = {
          previous: hostBeginCurrentToken,
          observed: hostBeginCurrentToken,
        };
      }
    }
    if (
      hostReceipt.previous !== hostBeginCurrentToken ||
      (hostSubmissionStarted && hostReceipt.observed !== hostBeginExpectedToken)
    )
      throw new Error("docker_task_recovery_host_begin_mismatch");
    const submissionHostToken = hostReceipt.observed ?? "";
    parseHostRecoveryToken(submissionHostToken);
    const host = isHostStateAlreadyClean
      ? null
      : loadHostRecoveryRecordByToken(submissionHostToken);
    const managementName = host
      ? (host.record.childIdentities as Record<string, { pathName: string }>)
          .management?.pathName
      : managementDirectoryName;
    if (!managementName) throw new Error("docker_task_recovery_host_mismatch");
    const hostRoot = host
      ? path.join(host.parent, host.parsed.rootName)
      : hostPaths.root;
    const hostActiveBindingPath = path.join(
      hostRoot,
      managementName,
      "active-docker-task-v1.json",
    );
    const pointerPath = path.join(
      root.rootPath,
      `active-lease-${parsed.stableLogicalHomeBindingHash}.json`,
    );
    const expectedPointer = Object.freeze({
      stableLogicalHomeBindingHash: parsed.stableLogicalHomeBindingHash,
      operationNonce: parsed.operationNonce,
      recoveryId: parsed.token,
      baseHash: parsed.baseHash,
    });
    const hostPrecleanupFinalizationIntentPath = path.join(
      operationDirectory,
      "host-precleanup-finalization-intent.json",
    );
    const expectedHostPrecleanupFinalizationIntent = Object.freeze({
      schema: "crdd-coordinator-host-precleanup-finalization-intent/v1",
      recoveryId: parsed.token,
      operationNonce: parsed.operationNonce,
      baseHash: parsed.baseHash,
      stableLogicalHomeBindingHash: parsed.stableLogicalHomeBindingHash,
      initialHostRecoveryId,
      hostRootAbsent: true,
      hostMarkerAbsent: true,
      submissionAbsent: true,
    });
    let hostPrecleanupFinalizationIntentPresent = recoveryPathPresent(
      hostPrecleanupFinalizationIntentPath,
    );
    if (hostPrecleanupFinalizationIntentPresent) {
      const observedIntent = readExactJson(
        hostPrecleanupFinalizationIntentPath,
      ).value;
      if (
        canonical(observedIntent) !==
          canonical(expectedHostPrecleanupFinalizationIntent) ||
        !isHostStateAlreadyClean ||
        hasSubmission
      )
        throw new Error("docker_task_recovery_host_precleanup_intent_mismatch");
    }
    let activePointerClosure = verifyActiveBindingAndPointerClosure(
      hostActiveBindingPath,
      pointerPath,
      expectedHostActiveBinding(
        parsed.token,
        parsed.baseHash,
        parsed.operationNonce,
      ),
      expectedPointer,
    );
    if (
      isHostStateAlreadyClean &&
      activePointerClosure.pointerState !== "committed" &&
      !(
        hostPrecleanupFinalizationIntentPresent &&
        activePointerClosure.pointerState === "absent"
      )
    )
      throw new Error("docker_task_recovery_pointer_mismatch");
    if (activePointerClosure.activeState === "uncommitted") {
      if (hostSubmissionStarted)
        throw new Error("docker_task_recovery_active_run_mismatch");
      removeExactUncommittedDockerRecoveryJson(
        hostActiveBindingPath,
        expectedHostActiveBinding(
          parsed.token,
          parsed.baseHash,
          parsed.operationNonce,
        ),
      );
      commitDirectoryMutationBoundary(path.dirname(hostActiveBindingPath));
      activePointerClosure = verifyActiveBindingAndPointerClosure(
        hostActiveBindingPath,
        pointerPath,
        expectedHostActiveBinding(
          parsed.token,
          parsed.baseHash,
          parsed.operationNonce,
        ),
        expectedPointer,
      );
    }
    if (
      isHostStateAlreadyClean &&
      !hasSubmission &&
      !hostPrecleanupFinalizationIntentPresent
    ) {
      if (
        activePointerClosure.activeState !== "absent" ||
        activePointerClosure.pointerState !== "committed"
      )
        throw new Error("docker_task_recovery_host_precleanup_intent_unsafe");
      writeDurableJson(
        operationDirectory,
        "host-precleanup-finalization-intent.json",
        expectedHostPrecleanupFinalizationIntent,
      );
      hostPrecleanupFinalizationIntentPresent = true;
    }
    if (
      activePointerClosure.activeState === "absent" &&
      hostSubmissionStarted &&
      activePointerClosure.pointerState !== "committed" &&
      !(
        hostPrecleanupFinalizationIntentPresent &&
        activePointerClosure.pointerState === "absent"
      )
    ) {
      throw new Error("docker_task_recovery_active_run_missing");
    }
    const configDirectory = path.join(
      operationDirectory,
      "recovery-docker-cli-config",
    );
    const releasePointer = () => {
      if (!observeRecoveryFile(pointerPath)) {
        const pointerCommitPath = path.join(
          path.dirname(pointerPath),
          dockerRecoveryCommitName(path.basename(pointerPath)),
        );
        if (observeRecoveryFile(pointerCommitPath))
          throw new Error("docker_task_recovery_pointer_mismatch");
        return;
      }
      const pointer = readExactJson(pointerPath).value as Record<
        string,
        unknown
      >;
      validateActiveLeasePointer(pointer, expectedPointer);
      if (!removeCommittedDockerRecoveryJson(pointerPath))
        throw new Error("docker_task_recovery_pointer_mismatch");
      commitDirectoryMutationBoundary(root.rootPath);
    };
    if (!hostSubmissionStarted) {
      if (activePointerClosure.activeState === "committed")
        if (!removeCommittedDockerRecoveryJson(hostActiveBindingPath))
          throw new Error("docker_task_recovery_active_run_mismatch");
      releasePointer();
      if (isHostStateAlreadyClean) {
        writeDurableJson(operationDirectory, "docker-absence-crash.json", {
          schema: "crdd-coordinator-docker-absence/v1",
          recoveryId: parsed.token,
          allExactResourcesAbsent: true,
          evidence: "crash_recovery_exact_id_and_configuration",
        });
        writeDurableJson(operationDirectory, "mount-crash-absence.json", {
          schema: "crdd-coordinator-provider-home-mount-completion/v1",
          recoveryId: parsed.token,
          evidence: "process_generation_absent_plus_exact_docker_absent",
        });
        ensureHostCleanupReceipt(operationDirectory, parsed.token, hostPaths);
        removeRecoveryOperationDirectory(
          operationDirectory,
          parsed.token,
          parsed.operationNonce,
          parsed.baseHash,
          parsed.stableLogicalHomeBindingHash,
          recoveryRuntimeStateBinding,
          true,
        );
        commitDirectoryMutationBoundary(root.rootPath);
        return Object.freeze({
          status: "recovered" as const,
          reason: "docker_task_recovery_completed_after_host_precleanup",
          recoveryId: null,
        });
      }
      writeDurableJson(operationDirectory, "host-cleanup-intent.json", {
        schema: "crdd-coordinator-host-cleanup-intent/v1",
        recoveryId: parsed.token,
        currentHostRecoveryId: submissionHostToken,
      });
      const hostRecovery = outsideRuntimeStateLock(() =>
        recoverOwnedOperationDirectories(
          submissionHostToken,
          hostOperationGeneration,
        ),
      );
      if (hostRecovery.status !== "recovered")
        return Object.freeze({
          status: "blocked" as const,
          reason: hostRecovery.reason,
          recoveryId: parsed.token,
        });
      ensureHostCleanupReceipt(operationDirectory, parsed.token, hostPaths);
      removeRecoveryOperationDirectory(
        operationDirectory,
        parsed.token,
        parsed.operationNonce,
        parsed.baseHash,
        parsed.stableLogicalHomeBindingHash,
        recoveryRuntimeStateBinding,
        true,
      );
      commitDirectoryMutationBoundary(root.rootPath);
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_completed_before_submission",
        recoveryId: null,
      });
    }
    if (!recoveryPathPresent(configDirectory))
      fs.mkdirSync(configDirectory, { mode: 0o700 });
    const configIdentity = recoveryConfigIdentity(configDirectory);
    const specs = [
      [
        "create_provider",
        "container",
        String(resources.provider),
        String(images.provider),
        null,
      ],
      [
        "create_subscription_auth_probe",
        "container",
        String(resources.auth),
        String(images.provider),
        null,
      ],
      [
        "create_proxy",
        "container",
        String(resources.proxy),
        String(images.proxy),
        null,
      ],
      [
        "create_internal_network",
        "network",
        String(resources.internal),
        null,
        true,
      ],
      [
        "create_egress_network",
        "network",
        String(resources.egress),
        null,
        false,
      ],
    ] as const;
    for (const [purpose, kind, name, image, isInternal] of specs) {
      const hasSubmissionMarker = recoveryPathPresent(
        path.join(operationDirectory, `submission-${purpose}.json`),
      );
      const receiptPath = path.join(
        operationDirectory,
        `receipt-${purpose}.json`,
      );
      const restartFencePath = path.join(
        operationDirectory,
        `restart-fence-${purpose}.json`,
      );
      if (!hasSubmissionMarker) {
        if (recoveryPathPresent(receiptPath))
          throw new Error("docker_task_recovery_receipt_without_submission");
        continue;
      }
      if (!recoveryPathPresent(receiptPath)) {
        if (recoveryPathPresent(restartFencePath)) {
          if (
            !validateOperationRecord(
              `restart-fence-${purpose}.json`,
              readExactJson(restartFencePath).value,
              parsed.token,
              parsed.operationNonce,
              parsed.baseHash,
            )
          )
            throw new Error("docker_task_recovery_restart_fence_invalid");
          continue;
        }
        const expectedNetworks =
          purpose === "create_subscription_auth_probe"
            ? ["none"]
            : purpose === "create_proxy"
              ? [String(resources.internal)]
              : kind === "container"
                ? [String(resources.internal)]
                : [];
        const discoveredDockerId = outsideRuntimeStateAndHostOperationLocks(
          () =>
            recoveryDockerRunner
              ? recoverUnknownDockerCreateOutcomeWithRunner(
                  recoveryDockerRunner,
                  kind,
                  name,
                  String(base.ownershipLabel),
                  image,
                  isInternal,
                  purpose,
                  expectedNetworks,
                  operationMode,
                  workspaceMountMode,
                )
              : recoverUnknownDockerCreateOutcomeWithRunner(
                  (argv) =>
                    runRecoveryDocker(configDirectory, configIdentity, argv),
                  kind,
                  name,
                  String(base.ownershipLabel),
                  image,
                  isInternal,
                  purpose,
                  expectedNetworks,
                  operationMode,
                  workspaceMountMode,
                ),
        );
        if (!discoveredDockerId) {
          const exactResourceAbsent =
            restartFence !== null &&
            outsideRuntimeStateAndHostOperationLocks(() =>
              observeSubmittedDockerResourceAbsentWithRunner(
                recoveryDockerRunner
                  ? recoveryDockerRunner
                  : (argv) =>
                      runRecoveryDocker(configDirectory, configIdentity, argv),
                kind,
                name,
                String(base.ownershipLabel),
              ),
            );
          if (!exactResourceAbsent || !restartFence)
            throw new Error("docker_task_recovery_create_outcome_unknown");
          if (
            "origin" in restartFence &&
            readExactJson(
              path.join(operationDirectory, `submission-${purpose}.json`),
            ).hash !== restartFence.pendingSubmissionSha256
          )
            throw new Error(
              "docker_task_recovery_restart_fence_submission_mismatch",
            );
          writeDurableJson(
            operationDirectory,
            `restart-fence-${purpose}.json`,
            Object.freeze(
              "origin" in restartFence
                ? {
                    schema: "crdd-coordinator-docker-engine-restart-fence/v2",
                    purpose,
                    recoveryId: parsed.token,
                    origin: restartFence.origin,
                    restartRecordSha256: restartFence.restartRecordSha256,
                    pendingSubmissionSha256:
                      restartFence.pendingSubmissionSha256,
                    exactResourceAbsent: true,
                  }
                : {
                    schema: "crdd-coordinator-docker-engine-restart-fence/v1",
                    purpose,
                    recoveryId: parsed.token,
                    repairId: restartFence.repairId,
                    repairRecordSha256: restartFence.repairRecordSha256,
                    exactResourceAbsent: true,
                  },
            ),
          );
          continue;
        }
        writeDurableJson(
          operationDirectory,
          `receipt-${purpose}.json`,
          Object.freeze({
            schema: "crdd-coordinator-docker-resource-receipt/v2",
            purpose,
            dockerId: discoveredDockerId,
            recoveryId: parsed.token,
            source: "runtime_reconciliation",
          }),
        );
      }
      const receipt = readExactJson(receiptPath).value as Record<
        string,
        string
      >;
      const dockerId = receipt.dockerId ?? "";
      if (
        receipt.purpose !== purpose ||
        receipt.recoveryId !== parsed.token ||
        !HEX64.test(dockerId) ||
        !outsideRuntimeStateAndHostOperationLocks(() => {
          const expectedNetworks =
            purpose === "create_subscription_auth_probe"
              ? ["none"]
              : purpose === "create_proxy"
                ? [String(resources.internal)]
                : kind === "container"
                  ? [String(resources.internal)]
                  : [];
          const recoverWithNetworks = (networks: readonly string[]) =>
            recoveryDockerRunner
              ? recoverExactDockerResourceWithRunner(
                  recoveryDockerRunner,
                  kind,
                  dockerId,
                  name,
                  String(base.ownershipLabel),
                  image,
                  isInternal,
                  purpose,
                  networks,
                  operationMode,
                  workspaceMountMode,
                )
              : recoverExactDockerResource(
                  configDirectory,
                  configIdentity,
                  kind,
                  dockerId,
                  name,
                  String(base.ownershipLabel),
                  image,
                  isInternal,
                  purpose,
                  networks,
                  operationMode,
                  workspaceMountMode,
                );
          if (recoverWithNetworks(expectedNetworks)) return true;
          return (
            purpose === "create_proxy" &&
            recoverWithNetworks([
              String(resources.internal),
              String(resources.egress),
            ])
          );
        })
      )
        throw new Error("docker_task_recovery_resource_mismatch");
    }
    if (recoveryConfigIdentity(configDirectory) !== configIdentity)
      throw new Error("docker_task_recovery_config_untrusted");
    fs.rmdirSync(configDirectory);
    if (
      !recoveryPathPresent(
        path.join(operationDirectory, "docker-absence-crash.json"),
      )
    ) {
      writeDurableJson(operationDirectory, "docker-absence-crash.json", {
        schema: "crdd-coordinator-docker-absence/v1",
        recoveryId: parsed.token,
        allExactResourcesAbsent: true,
        evidence: "crash_recovery_exact_id_and_configuration",
      });
    }
    if (isHostStateAlreadyClean) {
      const finalClosure = verifyActiveBindingAndPointerClosure(
        hostActiveBindingPath,
        pointerPath,
        expectedHostActiveBinding(
          parsed.token,
          parsed.baseHash,
          parsed.operationNonce,
        ),
        expectedPointer,
      );
      if (finalClosure.activeState !== "absent")
        throw new Error("docker_task_recovery_active_run_mismatch");
      const mountCrashPath = path.join(
        operationDirectory,
        "mount-crash-absence.json",
      );
      if (!recoveryPathPresent(mountCrashPath))
        writeDurableJson(operationDirectory, "mount-crash-absence.json", {
          schema: "crdd-coordinator-provider-home-mount-completion/v1",
          recoveryId: parsed.token,
          evidence: "process_generation_absent_plus_exact_docker_absent",
        });
      releasePointer();
      ensureHostCleanupReceipt(operationDirectory, parsed.token, hostPaths);
      removeRecoveryOperationDirectory(
        operationDirectory,
        parsed.token,
        parsed.operationNonce,
        parsed.baseHash,
        parsed.stableLogicalHomeBindingHash,
        recoveryRuntimeStateBinding,
        true,
      );
      commitDirectoryMutationBoundary(root.rootPath);
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_completed_after_host_precleanup",
        recoveryId: null,
      });
    }
    const crashIntentPath = path.join(
      operationDirectory,
      "host-crash-absence-intent.json",
    );
    const crashIntent = recoveryPathPresent(crashIntentPath)
      ? (readExactJson(crashIntentPath).value as Record<string, string>)
      : expectedHostSuccessor(submissionHostToken, "docker_absent_confirmed");
    if (!recoveryPathPresent(crashIntentPath))
      writeDurableJson(
        operationDirectory,
        "host-crash-absence-intent.json",
        crashIntent,
      );
    let dockerAbsentHostToken: string;
    try {
      loadHostRecoveryRecordByToken(crashIntent.expectedToken);
      dockerAbsentHostToken = crashIntent.expectedToken;
    } catch {
      dockerAbsentHostToken = outsideRuntimeStateLock(() =>
        confirmOwnedDockerAbsenceForRecovery(
          submissionHostToken,
          hostOperationGeneration,
        ),
      );
    }
    if (dockerAbsentHostToken !== crashIntent.expectedToken)
      throw new Error("docker_task_recovery_host_successor_mismatch");
    const crashReceiptPath = path.join(
      operationDirectory,
      "host-crash-absence-receipt.json",
    );
    if (!recoveryPathPresent(crashReceiptPath))
      writeDurableJson(operationDirectory, "host-crash-absence-receipt.json", {
        previous: submissionHostToken,
        observed: dockerAbsentHostToken,
      });
    const finalClosure = verifyActiveBindingAndPointerClosure(
      hostActiveBindingPath,
      pointerPath,
      expectedHostActiveBinding(
        parsed.token,
        parsed.baseHash,
        parsed.operationNonce,
      ),
      expectedPointer,
    );
    if (finalClosure.activeState === "committed") {
      if (!removeCommittedDockerRecoveryJson(hostActiveBindingPath))
        throw new Error("docker_task_recovery_active_run_mismatch");
    } else if (finalClosure.activeState !== "absent") {
      throw new Error("docker_task_recovery_active_run_mismatch");
    }
    const mountCrashPath = path.join(
      operationDirectory,
      "mount-crash-absence.json",
    );
    if (!recoveryPathPresent(mountCrashPath))
      writeDurableJson(operationDirectory, "mount-crash-absence.json", {
        schema: "crdd-coordinator-provider-home-mount-completion/v1",
        recoveryId: parsed.token,
        evidence: "process_generation_absent_plus_exact_docker_absent",
      });
    releasePointer();
    if (
      !hostRecoveryInventoryReady(root.rootPath, hostRoot, operationDirectory)
    )
      throw new Error("docker_task_recovery_host_inventory_incomplete");
    if (
      !recoveryPathPresent(
        path.join(operationDirectory, "host-cleanup-intent.json"),
      )
    )
      writeDurableJson(operationDirectory, "host-cleanup-intent.json", {
        schema: "crdd-coordinator-host-cleanup-intent/v1",
        recoveryId: parsed.token,
        currentHostRecoveryId: dockerAbsentHostToken,
      });
    const hostRecovery = outsideRuntimeStateLock(() =>
      recoverOwnedOperationDirectories(
        dockerAbsentHostToken,
        hostOperationGeneration,
      ),
    );
    if (hostRecovery.status !== "recovered")
      return Object.freeze({
        status: "blocked" as const,
        reason: hostRecovery.reason,
        recoveryId: parsed.token,
      });
    ensureHostCleanupReceipt(operationDirectory, parsed.token, hostPaths);
    removeRecoveryOperationDirectory(
      operationDirectory,
      parsed.token,
      parsed.operationNonce,
      parsed.baseHash,
      parsed.stableLogicalHomeBindingHash,
      recoveryRuntimeStateBinding,
      true,
    );
    commitDirectoryMutationBoundary(root.rootPath);
    return Object.freeze({
      status: "recovered" as const,
      reason: "docker_task_recovery_completed",
      recoveryId: null,
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(error, "docker_task_recovery_failed_closed"),
      recoveryId: parsed.token,
    });
  } finally {
    const releaseFailure = releaseRecoverySynchronizations([
      {
        release: () => runtimeStateLockController.close(),
        reason: "docker_task_runtime_state_lock_release_unconfirmed",
      },
      {
        release: () => processAbsenceLock.release(),
        reason: "docker_task_recovery_home_lock_release_unconfirmed",
      },
      ...(hostOperationGeneration
        ? [
            {
              release: () =>
                releaseHostOperationRecoveryGeneration(hostOperationGeneration),
              reason: "docker_task_recovery_host_lock_release_unconfirmed",
            },
          ]
        : []),
    ]);
    if (releaseFailure)
      // biome-ignore lint/correctness/noUnsafeFinally: release failure must override a provisional success.
      return Object.freeze({
        status: "blocked" as const,
        reason: releaseFailure,
        recoveryId: parsed.token,
      });
  }
}

/**
 * recover Runtime 所有 Docker Task From Verified Rootを決定する。
 *
 * @responsibility recover Runtime 所有 Docker Task From Verified Rootの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown、root: VerifiedRuntimeStateRoot、developmentContext: unknown
 * @returns recoverRuntimeOwnedDockerTaskFromVerifiedRootの計算結果を返す。
 * @precondition 「token: unknown、root: VerifiedRuntimeStateRoot、developmentContext: unknown」がrecoverRuntimeOwnedDockerTaskFromVerifiedRootの入力契約を満たす。
 * @postcondition recoverRuntimeOwnedDockerTaskFromVerifiedRootの責務を完了した結果だけを返す。
 * @effect N/A: recoverRuntimeOwnedDockerTaskFromVerifiedRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoverRuntimeOwnedDockerTaskFromVerifiedRootは独自の失敗分岐を所有しない。
 * @invariant recoverRuntimeOwnedDockerTaskFromVerifiedRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoverRuntimeOwnedDockerTaskFromVerifiedRootはProcess内の同一Subsystemで完結する。
 * @security recoverRuntimeOwnedDockerTaskFromVerifiedRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoverRuntimeOwnedDockerTaskFromVerifiedRootは共有非同期状態を持たない同期処理である。
 */
function recoverRuntimeOwnedDockerTaskFromVerifiedRoot(
  token: unknown,
  root: VerifiedRuntimeStateRoot,
  developmentContext?: unknown,
) {
  return recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
    token,
    root,
    () => observeRuntimeStateRootFromWindows(developmentContext),
  );
}

/**
 * recover Runtime 所有 Docker Task Internalを決定する。
 *
 * @responsibility recover Runtime 所有 Docker Task Internalの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown、developmentContext: unknown
 * @returns recoverRuntimeOwnedDockerTaskInternalの計算結果を返す。
 * @precondition 「token: unknown、developmentContext: unknown」がrecoverRuntimeOwnedDockerTaskInternalの入力契約を満たす。
 * @postcondition recoverRuntimeOwnedDockerTaskInternalの責務を完了した結果だけを返す。
 * @effect N/A: recoverRuntimeOwnedDockerTaskInternalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoverRuntimeOwnedDockerTaskInternalは独自の失敗分岐を所有しない。
 * @invariant recoverRuntimeOwnedDockerTaskInternalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoverRuntimeOwnedDockerTaskInternalはProcess内の同一Subsystemで完結する。
 * @security recoverRuntimeOwnedDockerTaskInternalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoverRuntimeOwnedDockerTaskInternalは共有非同期状態を持たない同期処理である。
 */
function recoverRuntimeOwnedDockerTaskInternal(
  token: unknown,
  developmentContext?: unknown,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  if (!parsed)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_id_invalid",
      recoveryId: null,
    });
  const observation = inspectRuntimeOwnedWindowsRuntimeState(
    false,
    new Date().toISOString(),
    developmentContext,
  );
  const root = consumeRuntimeOwnedRuntimeStateRootCapability(
    observation.rootCapability,
  );
  if (observation.status !== "candidate" || !root)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_runtime_state_unavailable",
      recoveryId: parsed.token,
    });
  return recoverRuntimeOwnedDockerTaskFromVerifiedRoot(
    parsed.token,
    root,
    developmentContext,
  );
}

/**
 * recover Runtime 所有 Docker Task After Verified Docker Desktop Restartを決定する。
 *
 * @responsibility recover Runtime 所有 Docker Task After Verified Docker Desktop Restartの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown、repairId: unknown、repairReleaseRoot: unknown、developmentContext: unknown
 * @returns recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestartの計算結果を返す。
 * @precondition 「token: unknown、repairId: unknown、repairReleaseRoot: unknown、developmentContext: unknown」がrecoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestartの入力契約を満たす。
 * @postcondition recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestartの責務を完了した結果だけを返す。
 * @effect recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestartはFilesystemの読取りまたは書込みを実行する。
 * @failure recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestartは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestartは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestartはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestartは共有非同期状態を持たない同期処理である。
 */
export function recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestart(
  token: unknown,
  repairId: unknown,
  repairReleaseRoot: unknown,
  developmentContext?: unknown,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  let phase = "input";
  try {
    if (
      !parsed ||
      typeof repairId !== "string" ||
      !/^docker-desktop-repair\.[a-f0-9]{32}$/u.test(repairId) ||
      typeof repairReleaseRoot !== "string" ||
      !path.isAbsolute(repairReleaseRoot)
    )
      throw new Error("docker_task_recovery_restart_fence_input_invalid");
    phase = "authority";
    const development =
      developmentContext !== undefined &&
      developmentContext !== null &&
      typeof developmentContext === "object"
        ? borrowRuntimeOwnedDevelopmentNativeObservation(
            developmentContext,
            false,
          )
        : null;
    if (developmentContext !== undefined && !development)
      throw new Error("docker_task_recovery_restart_fence_authority_invalid");
    const verification =
      development?.verification ??
      verifyBundledCoordinatorPackageFromFixedManifestCandidate({
        evaluationTime: new Date().toISOString(),
      });
    const releaseSequence =
      "releaseSequence" in verification
        ? verification.releaseSequence
        : development?.expectedRelease.releaseSequence;
    if (
      verification.status !== "candidate" ||
      typeof verification.manifestHash !== "string" ||
      !Number.isSafeInteger(releaseSequence) ||
      typeof verification.runtimeExecutionIdentitySha256 !== "string"
    )
      throw new Error("docker_task_recovery_restart_fence_authority_invalid");
    phase = "runtime_state";
    const observation = inspectRuntimeOwnedWindowsRuntimeState(
      false,
      new Date().toISOString(),
      developmentContext,
    );
    const root = consumeRuntimeOwnedRuntimeStateRootCapability(
      observation.rootCapability,
    );
    phase = "repair_trust";
    if (observation.status !== "candidate" || !root)
      throw new Error("docker_task_recovery_restart_fence_boundary_invalid");
    let localAppData = root.rootPath;
    for (const expected of ["RuntimeState", "CRDD", "Qual-Lab"]) {
      if (
        path.win32.basename(localAppData).toLocaleLowerCase("en-US") !==
        expected.toLocaleLowerCase("en-US")
      )
        throw new Error("docker_task_recovery_restart_fence_boundary_invalid");
      localAppData = path.win32.dirname(localAppData);
    }
    phase = "historical_manifest";
    const originManifest =
      loadHistoricalReleaseManifestEnvelopeForVerification(
        repairReleaseRoot,
      ).envelope;
    phase = "historical_repair";
    const repair = inspectDockerDesktopRepairHistoricalOperation(
      {
        runtimeStateRoot: root.rootPath,
        runtimeStateIdentityHash: root.runtimeStateIdentityHash,
        runtimeStateProtectionHash: root.runtimeStateProtectionHash,
        localUserBindingHash: root.localUserBindingHash,
        runtimeStateBindingHash: root.stableLogicalHomeBindingHash,
        dockerPolicySha256: dockerDesktopCurrentArtifactTrustPolicySha256,
        crddManifestHash: verification.manifestHash,
        crddReleaseSequence: releaseSequence as number,
        runtimeExecutionIdentitySha256:
          verification.runtimeExecutionIdentitySha256,
        localAppData,
      },
      repairId,
      originManifest,
    );
    if (
      !repair ||
      ![
        "closed_retained",
        "closed_no_stale_known_effect_retained",
        "closed_historical_effect_unknown_retained",
      ].includes(repair.stage) ||
      repair.ledger.engineReady !== true ||
      repair.ledger.hostSafety !== "safe" ||
      repair.ledger.evidenceState !== "preserved" ||
      !repair.ledger.liveRunIdentity ||
      !repair.ledger.processEffects.some(
        (entry) =>
          [
            "official_shutdown",
            "native_termination",
            "wsl_termination",
          ].includes(entry.action) &&
          entry.phase === "settled" &&
          entry.issued === true &&
          entry.confirmation === "confirmed",
      )
    )
      throw new Error("docker_task_recovery_restart_fence_unverified");
    phase = "pending_submission";
    const operationDirectory = path.join(
      root.rootPath,
      `docker-task-${parsed.operationNonce}`,
    );
    const operationInventory = inventoryOperationDirectory(
      operationDirectory,
      parsed.token,
      parsed.operationNonce,
      parsed.baseHash,
    );
    const pendingSubmissionNames =
      selectPendingDockerSubmissionNamesFromInventory(operationInventory);
    if (pendingSubmissionNames.length === 0)
      throw new Error("docker_task_recovery_restart_fence_not_needed");
    phase = "ordering";
    const firstRepairRecord = path.join(
      repair.operationDirectory,
      "repair-00-prepared.json",
    );
    const repairStartedAt = fs.lstatSync(firstRepairRecord, { bigint: true });
    if (
      BigInt(repair.ledger.liveRunIdentity.birthtimeNs) <=
        repairStartedAt.birthtimeNs ||
      pendingSubmissionNames.some(
        (name) =>
          fs.lstatSync(path.join(operationDirectory, name), { bigint: true })
            .birthtimeNs >= repairStartedAt.birthtimeNs,
      )
    )
      throw new Error("docker_task_recovery_restart_fence_order_invalid");
    const restartFence = Object.freeze({
      recoveryId: parsed.token,
      repairId,
      repairRecordSha256: repair.previousRecordSha256,
    });
    phase = "task_recovery";
    const result = recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
      parsed.token,
      root,
      () => observeRuntimeStateRootFromWindows(developmentContext),
      null,
      restartFence,
    );
    return Object.freeze({
      ...result,
      manualRecoveryRequired: result.status === "blocked",
      restartFenceVerified: true,
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        `docker_task_recovery_restart_fence_${phase}_failed`,
      ),
      recoveryId: parsed?.token ?? null,
      manualRecoveryRequired: Boolean(parsed),
      restartFenceVerified: false,
    });
  }
}

/**
 * restart Path Identityを決定する。
 *
 * @responsibility restart Path Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns restartPathIdentityの計算結果を返す。
 * @precondition 「target: string」がrestartPathIdentityの入力契約を満たす。
 * @postcondition restartPathIdentityの責務を完了した結果だけを返す。
 * @effect restartPathIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure restartPathIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant restartPathIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security restartPathIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: restartPathIdentityは共有非同期状態を持たない同期処理である。
 */
function restartPathIdentity(target: string) {
  const value = fs.lstatSync(target, { bigint: true });
  if (
    !value.isDirectory() ||
    value.isSymbolicLink() ||
    fs.realpathSync(target) !== target
  )
    throw new Error("docker_restart_directory_unverified");
  return `${value.dev}:${value.ino}:${value.birthtimeNs}`;
}

/**
 * Docker再起動境界で使用する文字列集合を決定順へ正規化する。
 *
 * @responsibility Recovery一覧と論理Home一覧を重複のない決定順へ正規化する。
 * @trace ARCH-000008
 * @input values: readonly string[]
 * @returns 重複を除き昇順に整列した文字列配列を返す。
 * @precondition valuesは観測済みの文字列配列である。
 * @postcondition 入力順に依存せず、同じ集合から同じ配列を返す。
 * @effect N/A: 入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: 文字列配列以外の入力は型境界で拒否される。
 * @invariant 入力配列を変更せず、値の追加または推測を行わない。
 * @boundary N/A: Process内の同一Subsystemで完結する。
 * @security Recovery Identityを新設、短縮または外部公開しない。
 * @concurrency N/A: 共有非同期状態を持たない同期処理である。
 */
function normalizeDockerRestartScope(values: readonly string[]) {
  return Object.freeze([...new Set(values)].sort());
}

/**
 * Docker再起動前後の観測済み文字列集合が同一か判定する。
 *
 * @responsibility Recovery一覧または論理Home一覧の追加・欠落・置換を検出する。
 * @trace ARCH-000008
 * @input left: readonly string[]、right: readonly string[]
 * @returns 両集合が同一ならtrue、それ以外はfalseを返す。
 * @precondition leftとrightは観測済みの文字列配列である。
 * @postcondition 順序差だけは許容し、要素差と重複による意味差を正規化後に判定する。
 * @effect N/A: 入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: 文字列配列以外の入力は型境界で拒否される。
 * @invariant 比較中に入力配列または共有状態を変更しない。
 * @boundary N/A: Process内の同一Subsystemで完結する。
 * @security Recovery Identityの内容を結果へ含めず一致可否だけを返す。
 * @concurrency N/A: 共有非同期状態を持たない同期処理である。
 */
function sameDockerRestartScope(
  leftValues: readonly string[],
  rightValues: readonly string[],
) {
  const normalizedLeftValues = normalizeDockerRestartScope(leftValues);
  const normalizedRightValues = normalizeDockerRestartScope(rightValues);
  return (
    normalizedLeftValues.length === normalizedRightValues.length &&
    normalizedLeftValues.every(
      (value, index) => value === normalizedRightValues[index],
    )
  );
}

/**
 * Owns the three existing kernel domains until explicit release; no Docker effect.
 *
 * @responsibility Runtime 所有 Docker Restartの準備条件、候補Identity、Effect前の拒否境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown、originReleaseRoot: unknown、developmentContext: unknown
 * @returns prepareRuntimeOwnedDockerRestartの計算結果を返す。
 * @precondition 「token: unknown、originReleaseRoot: unknown、developmentContext: unknown」がprepareRuntimeOwnedDockerRestartの入力契約を満たす。
 * @postcondition prepareRuntimeOwnedDockerRestartの責務を完了した結果だけを返す。
 * @effect N/A: prepareRuntimeOwnedDockerRestartは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure prepareRuntimeOwnedDockerRestartは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant prepareRuntimeOwnedDockerRestartは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: prepareRuntimeOwnedDockerRestartはProcess内の同一Subsystemで完結する。
 * @security prepareRuntimeOwnedDockerRestartはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: prepareRuntimeOwnedDockerRestartは共有非同期状態を持たない同期処理である。
 */
export function prepareRuntimeOwnedDockerRestart(
  token: unknown,
  originReleaseRoot?: unknown,
  developmentContext?: unknown,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  const locks: Array<
    Readonly<{ assertLive: () => boolean; release: () => boolean }>
  > = [];
  try {
    if (!parsed) throw new Error("docker_restart_id_invalid");
    const development =
      developmentContext !== undefined &&
      developmentContext !== null &&
      typeof developmentContext === "object"
        ? borrowRuntimeOwnedDevelopmentNativeObservation(
            developmentContext,
            false,
          )
        : null;
    if (developmentContext !== undefined && !development)
      throw new Error("docker_restart_development_authority_invalid");
    const verification =
      development?.verification ??
      verifyBundledCoordinatorPackageFromFixedManifestCandidate({
        evaluationTime: new Date().toISOString(),
      });
    if (
      verification.status !== "candidate" ||
      (!development &&
        (!("runtimeOwnedReleaseTrustConfirmed" in verification) ||
          verification.runtimeOwnedReleaseTrustConfirmed !== true ||
          verification.runtimeExecutionIdentityRuntimeOwned !== true ||
          verification.crddDistributionConfirmed !== true)) ||
      typeof verification.runtimeExecutionIdentitySha256 !== "string"
    )
      throw new Error("docker_restart_release_unverified");
    const root = observeRuntimeStateRootFromWindows(developmentContext);
    if (!root) throw new Error("docker_restart_root_unverified");
    const rootIdentity = restartPathIdentity(root.rootPath);
    const initialInventory = inspectDockerRecoveryRootSnapshot(root.rootPath);
    const initialRecoveryIds =
      initialInventory.dockerRecoveryIds as readonly string[];
    if (
      initialInventory.status !== "completed" ||
      !initialRecoveryIds.some((value) => value === parsed.token)
    )
      throw new Error("docker_restart_scope_conflict");
    const recoveryIds = normalizeDockerRestartScope(initialRecoveryIds);
    const recoveryScopes: Array<
      Readonly<{
        recoveryId: string;
        stableLogicalHomeBindingHash: string;
        hostRoot: string;
        hostRootName: string;
        hostNonce: string;
      }>
    > = [];
    for (const recoveryId of recoveryIds) {
      const recovery = parseDockerTaskRecoveryId(recoveryId);
      if (!recovery) throw new Error("docker_restart_scope_conflict");
      const host = discoverRecoveryHostBinding(root.rootPath, recovery);
      recoveryScopes.push(
        Object.freeze({
          recoveryId,
          stableLogicalHomeBindingHash: recovery.stableLogicalHomeBindingHash,
          hostRoot: host.hostRoot,
          hostRootName: path.basename(host.hostRoot),
          hostNonce: host.hostNonce,
        }),
      );
    }
    const activeStableLogicalHomeBindingHashes = normalizeDockerRestartScope(
      initialInventory.activeStableLogicalHomeBindingHashes as readonly string[],
    );
    const scopedHomeHashes = normalizeDockerRestartScope(
      recoveryScopes.map((scope) => scope.stableLogicalHomeBindingHash),
    );
    if (
      !sameDockerRestartScope(
        activeStableLogicalHomeBindingHashes,
        scopedHomeHashes,
      )
    )
      throw new Error("docker_restart_scope_conflict");
    const hostScopesByKey = new Map<string, (typeof recoveryScopes)[number]>();
    for (const scope of recoveryScopes) {
      const key = `${scope.hostRootName}\u0000${scope.hostNonce}`;
      const existing = hostScopesByKey.get(key);
      if (existing && existing.hostRoot !== scope.hostRoot)
        throw new Error("docker_restart_scope_conflict");
      hostScopesByKey.set(key, scope);
    }
    for (const scope of [...hostScopesByKey.values()].sort((left, right) =>
      `${left.hostRootName}\u0000${left.hostNonce}`.localeCompare(
        `${right.hostRootName}\u0000${right.hostNonce}`,
      ),
    )) {
      const hostLock = acquireRuntimeOwnedHostOperationKernelLock(
        scope.hostRootName,
        scope.hostNonce,
      );
      if (!hostLock) throw new Error("docker_restart_host_active_or_unknown");
      locks.push(hostLock);
    }
    for (const homeHash of scopedHomeHashes) {
      const homeLock =
        acquireRuntimeOwnedLogicalProviderHomeKernelLock(homeHash);
      if (!homeLock) throw new Error("docker_restart_home_active_or_unknown");
      locks.push(homeLock);
    }
    const stateLock = acquireRuntimeOwnedDockerRuntimeStateKernelLock(
      root.stableLogicalHomeBindingHash,
    );
    if (!stateLock) throw new Error("docker_restart_state_active_or_unknown");
    locks.push(stateLock);
    if (
      restartPathIdentity(root.rootPath) !== rootIdentity ||
      !locks.every((lock) => lock.assertLive())
    )
      throw new Error("docker_restart_boundary_changed");
    const inventory = inspectDockerRecoveryRootSnapshot(root.rootPath);
    if (
      inventory.status !== "completed" ||
      !sameDockerRestartScope(inventory.dockerRecoveryIds, recoveryIds) ||
      !sameDockerRestartScope(
        inventory.activeStableLogicalHomeBindingHashes,
        activeStableLogicalHomeBindingHashes,
      ) ||
      recoveryScopes.some((scope) => {
        const recovery = parseDockerTaskRecoveryId(scope.recoveryId);
        if (!recovery) return true;
        const currentHost = discoverRecoveryHostBinding(
          root.rootPath,
          recovery,
        );
        return (
          currentHost.hostRoot !== scope.hostRoot ||
          currentHost.hostNonce !== scope.hostNonce
        );
      })
    )
      throw new Error("docker_restart_scope_conflict");
    const durableBinding = discoverRecoveryRuntimeStateBinding(
      root.rootPath,
      parsed,
    );
    if (
      !durableBinding ||
      durableBinding.runtimeStateIdentityHash !==
        root.runtimeStateIdentityHash ||
      durableBinding.runtimeStateProtectionHash !==
        root.runtimeStateProtectionHash ||
      durableBinding.runtimeStateBindingHash !==
        root.stableLogicalHomeBindingHash
    )
      throw new Error("docker_restart_root_binding_changed");
    const directory = path.join(
      root.rootPath,
      `docker-task-${parsed.operationNonce}`,
    );
    const names = inventoryOperationDirectory(
      directory,
      parsed.token,
      parsed.operationNonce,
      parsed.baseHash,
    );
    if (names.some((name) => name.startsWith("restart-fence-")))
      throw new Error("docker_restart_existing_attempt_requires_recovery");
    const pendingNames = names.filter(
      (name) =>
        name.startsWith("submission-") &&
        !names.includes(name.replace(/^submission-/u, "receipt-")),
    );
    const submissionName = pendingNames[0];
    if (pendingNames.length !== 1 || !submissionName)
      throw new Error("docker_restart_pending_scope_invalid");
    const binding: DockerRestartBinding = Object.freeze({
      recoveryId: parsed.token,
      operationNonce: parsed.operationNonce,
      runtimeExecutionIdentitySha256:
        verification.runtimeExecutionIdentitySha256,
      // The restart journal belongs to the durable operation principal. A
      // same-user re-logon is proven separately by the append-only session
      // handoff and must not rewrite the historical restart binding.
      localUserBindingHash: durableBinding.localUserBindingHash,
      runtimeStateIdentityHash: root.runtimeStateIdentityHash,
      runtimeStateProtectionHash: root.runtimeStateProtectionHash,
      stableLogicalHomeBindingHash: parsed.stableLogicalHomeBindingHash,
      pendingSubmissionSha256: readExactJson(
        path.join(directory, submissionName),
      ).hash,
    });
    const readRecords = (prefix: string) =>
      names
        .filter((name) => name.startsWith(prefix))
        .sort()
        .map((name) =>
          Buffer.from(readExactJson(path.join(directory, name)).serialized),
        );
    const originRecords = readRecords("engine-restart-");
    const handoffs = readRecords("engine-handoff-");
    const continuationRecords = readRecords("engine-continuation-");
    let pendingHandoff: Buffer | null = null;
    let records: Buffer[] = [];
    const originFirst = originRecords[0]
      ? parseDockerRestartRecord(originRecords[0])
      : null;
    const hasContinuation =
      handoffs.length > 0 ||
      (originFirst !== null &&
        originFirst.runtimeExecutionIdentitySha256 !==
          binding.runtimeExecutionIdentitySha256);
    if (hasContinuation) {
      const origin = parseDockerRestartRecord(originRecords[0] as Buffer);
      if (
        origin?.phase !== "stop_intent" ||
        originRecords.length !== 1 ||
        typeof originReleaseRoot !== "string" ||
        !path.isAbsolute(originReleaseRoot)
      )
        throw new Error("docker_restart_origin_required");
      const historical = verifyHistoricalPlatformProvisionerManifestCandidate(
        loadHistoricalReleaseManifestEnvelopeForVerification(originReleaseRoot)
          .envelope,
        getPinnedPlatformProvisionerReleaseSignerSpkiDer(),
      );
      if (
        historical?.historicalSignatureVerified !== true ||
        !("runtimeExecutionIdentitySha256" in historical.payload) ||
        historical.payload.runtimeExecutionIdentitySha256 !==
          origin.runtimeExecutionIdentitySha256 ||
        !validateDockerRestartRecordChain(originRecords, {
          ...binding,
          runtimeExecutionIdentitySha256: origin.runtimeExecutionIdentitySha256,
        })
      )
        throw new Error("docker_restart_origin_unverified");
      const lastRuntime = handoffs.length
        ? parseDockerRestartHandoffRecord(handoffs.at(-1) as Buffer)
            ?.toRuntimeIdentitySha256
        : origin.runtimeExecutionIdentitySha256;
      if (lastRuntime !== binding.runtimeExecutionIdentitySha256) {
        pendingHandoff = createDockerRestartMigrationRecord(
          originRecords,
          binding,
          handoffs,
          continuationRecords,
        );
      }
      const resolved = resolveDockerRestartHistory(
        originRecords,
        binding,
        pendingHandoff ? [...handoffs, pendingHandoff] : handoffs,
        continuationRecords,
      );
      if (!resolved) throw new Error("docker_restart_continuation_invalid");
      records = [...resolved.rawRecords];
    } else {
      if (
        handoffs.length ||
        continuationRecords.length ||
        originReleaseRoot !== undefined
      )
        throw new Error("docker_restart_handoff_invalid");
      if (
        originRecords.length &&
        !validateDockerRestartRecordChain(originRecords, binding)
      )
        throw new Error("docker_restart_continuation_invalid");
      records = originRecords;
    }
    // Historical provenance must be accepted before any protected-root write.
    if (
      restartPathIdentity(root.rootPath) !== rootIdentity ||
      !locks.every((lock) => lock.assertLive())
    )
      throw new Error("docker_restart_boundary_changed");
    ensureDockerTaskSessionHandoff(root, parsed.token, durableBinding);
    const capability = Object.freeze({});
    dockerRestartPreparations.set(capability, {
      root,
      rootIdentity,
      directory,
      directoryIdentity: restartPathIdentity(directory),
      recoveryIds,
      activeStableLogicalHomeBindingHashes,
      binding,
      submissionName,
      locks: Object.freeze(locks),
      records,
      originRecords,
      handoffs,
      continuationRecords,
      pendingHandoff,
      continuation: hasContinuation,
      closed: false,
      persistenceFailed: false,
    });
    return Object.freeze({
      status: "prepared" as const,
      capability,
      platformAccessArtifact: verification.platformAccessArtifact,
      recoveryId: parsed.token,
      cleanupConfirmed: false,
      currentPhase: records.length
        ? (parseDockerRestartRecord(records.at(-1) as Buffer)?.phase ?? null)
        : hasContinuation
          ? ("stop_intent" as const)
          : null,
      continuationSeedRequired: hasContinuation && records.length === 0,
      handoffPending: pendingHandoff !== null,
      historicalStopIntent: hasContinuation,
    });
  } catch (error) {
    let cleanupConfirmed = true;
    for (const lock of [...locks].reverse()) {
      try {
        if (!lock.release()) cleanupConfirmed = false;
      } catch {
        cleanupConfirmed = false;
      }
    }
    return Object.freeze({
      status: "blocked" as const,
      capability: null,
      platformAccessArtifact: null,
      recoveryId: parsed?.token ?? null,
      cleanupConfirmed,
      reason: cleanupConfirmed
        ? error instanceof Error &&
          /^docker_restart_[a-z_]+$/u.test(error.message)
          ? error.message
          : "docker_restart_preparation_failed"
        : "docker_restart_lock_cleanup_unknown",
    });
  }
}

/**
 * Runtime 所有 Docker Restart Preparationを検証する。
 *
 * @responsibility Runtime 所有 Docker Restart Preparationの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns booleanを返す。
 * @precondition 「capability: unknown」がverifyRuntimeOwnedDockerRestartPreparationの入力契約を満たす。
 * @postcondition verifyRuntimeOwnedDockerRestartPreparationの責務を完了した結果だけを返す。
 * @effect N/A: verifyRuntimeOwnedDockerRestartPreparationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyRuntimeOwnedDockerRestartPreparationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyRuntimeOwnedDockerRestartPreparationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyRuntimeOwnedDockerRestartPreparationはProcess内の同一Subsystemで完結する。
 * @security verifyRuntimeOwnedDockerRestartPreparationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyRuntimeOwnedDockerRestartPreparationは共有非同期状態を持たない同期処理である。
 */
export function verifyRuntimeOwnedDockerRestartPreparation(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRestartPreparations.get(capability);
  if (!record || record.closed || record.persistenceFailed) return false;
  try {
    if (
      !record.locks.every((lock) => lock.assertLive()) ||
      restartPathIdentity(record.root.rootPath) !== record.rootIdentity ||
      restartPathIdentity(record.directory) !== record.directoryIdentity ||
      readExactJson(path.join(record.directory, record.submissionName)).hash !==
        record.binding.pendingSubmissionSha256
    )
      return false;
    const inventory = inspectDockerRecoveryRootSnapshot(record.root.rootPath);
    const parsed = parseDockerTaskRecoveryId(record.binding.recoveryId);
    if (!parsed) return false;
    const names = inventoryOperationDirectory(
      record.directory,
      parsed.token,
      parsed.operationNonce,
      parsed.baseHash,
    );
    const publishedNames = names
      .filter((name) =>
        record.continuation
          ? /^engine-continuation-0[0-4]\.json$/u.test(name)
          : /^engine-restart-0[0-4]\.json$/u.test(name),
      )
      .sort();
    if (record.continuation) {
      for (const [prefix, expectedRecords] of [
        ["engine-restart-", record.originRecords],
        ["engine-handoff-", record.handoffs],
      ] as const) {
        const foundNames = names
          .filter((name) => name.startsWith(prefix))
          .sort();
        if (
          foundNames.length !== expectedRecords.length ||
          foundNames.some(
            (name, index) =>
              readExactJson(path.join(record.directory, name)).serialized !==
              expectedRecords[index]?.toString("utf8"),
          )
        )
          return false;
      }
    }
    if (
      publishedNames.length !== record.records.length ||
      publishedNames.some(
        (name, index) =>
          readExactJson(path.join(record.directory, name)).serialized !==
          (record.continuation
            ? record.continuationRecords[index]?.toString("utf8")
            : record.records[index]?.toString("utf8")),
      )
    )
      return false;
    return (
      inventory.status === "completed" &&
      sameDockerRestartScope(inventory.dockerRecoveryIds, record.recoveryIds) &&
      sameDockerRestartScope(
        inventory.activeStableLogicalHomeBindingHashes,
        record.activeStableLogicalHomeBindingHashes,
      )
    );
  } catch {
    return false;
  }
}

/**
 * Runtime 所有 Docker Restart Phaseを耐久保存する。
 *
 * @responsibility Runtime 所有 Docker Restart Phaseの保存Identity、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown、phase: DockerRestartPhase
 * @returns booleanを返す。
 * @precondition 「capability: unknown、phase: DockerRestartPhase」がpersistRuntimeOwnedDockerRestartPhaseの入力契約を満たす。
 * @postcondition persistRuntimeOwnedDockerRestartPhaseの責務を完了した結果だけを返す。
 * @effect N/A: persistRuntimeOwnedDockerRestartPhaseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure persistRuntimeOwnedDockerRestartPhaseは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant persistRuntimeOwnedDockerRestartPhaseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: persistRuntimeOwnedDockerRestartPhaseはProcess内の同一Subsystemで完結する。
 * @security persistRuntimeOwnedDockerRestartPhaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: persistRuntimeOwnedDockerRestartPhaseは共有非同期状態を持たない同期処理である。
 */
export function persistRuntimeOwnedDockerRestartPhase(
  capability: unknown,
  phase: DockerRestartPhase,
): boolean {
  if (!verifyRuntimeOwnedDockerRestartPreparation(capability)) return false;
  const record = dockerRestartPreparations.get(capability as object);
  if (!record || record.pendingHandoff) return false;
  // A failed publication is consumed even if bytes were not observed afterward.
  record.persistenceFailed = true;
  try {
    const bytes = (
      record.continuation
        ? createDockerRestartMigratedPhase
        : createDockerRestartRecord
    )(record.binding, phase, record.records.at(-1));
    const parsed = parseDockerRestartRecord(bytes);
    if (!parsed || parsed.sequence !== record.records.length) return false;
    const name = `${record.continuation ? "engine-continuation" : "engine-restart"}-${String(parsed.sequence).padStart(2, "0")}.json`;
    const persistedBytes = record.continuation
      ? createDockerRestartContinuationRecord(
          bytes,
          createHash("sha256")
            .update(record.handoffs.at(-1) as Buffer)
            .digest("hex"),
        )
      : bytes;
    const published = writeDurableJson(
      record.directory,
      name,
      JSON.parse(persistedBytes.toString("utf8")),
    );
    if (published.serialized !== persistedBytes.toString("utf8")) return false;
    record.records.push(bytes);
    if (record.continuation) record.continuationRecords.push(persistedBytes);
    record.persistenceFailed = false;
    if (!verifyRuntimeOwnedDockerRestartPreparation(capability)) {
      record.persistenceFailed = true;
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Composition-only historical adoption. Does not authorize any host effect.
 *
 * @responsibility Runtime 所有 Docker Restart Handoffの確定条件、不可逆Effect、失敗時の未確定境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns booleanを返す。
 * @precondition 「capability: unknown」がcommitRuntimeOwnedDockerRestartHandoffの入力契約を満たす。
 * @postcondition commitRuntimeOwnedDockerRestartHandoffの責務を完了した結果だけを返す。
 * @effect N/A: commitRuntimeOwnedDockerRestartHandoffは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure commitRuntimeOwnedDockerRestartHandoffは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant commitRuntimeOwnedDockerRestartHandoffは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: commitRuntimeOwnedDockerRestartHandoffはProcess内の同一Subsystemで完結する。
 * @security commitRuntimeOwnedDockerRestartHandoffはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: commitRuntimeOwnedDockerRestartHandoffは共有非同期状態を持たない同期処理である。
 */
export function commitRuntimeOwnedDockerRestartHandoff(
  capability: unknown,
): boolean {
  if (!verifyRuntimeOwnedDockerRestartPreparation(capability)) return false;
  const record = dockerRestartPreparations.get(capability as object);
  if (!record?.pendingHandoff) return false;
  record.persistenceFailed = true;
  try {
    const bytes = record.pendingHandoff;
    const parsed = parseDockerRestartHandoffRecord(bytes);
    if (!parsed || parsed.sequence !== record.handoffs.length) return false;
    const published = writeDurableJson(
      record.directory,
      `engine-handoff-${String(parsed.sequence).padStart(2, "0")}.json`,
      JSON.parse(bytes.toString("utf8")),
    );
    if (published.serialized !== bytes.toString("utf8")) return false;
    record.handoffs.push(bytes);
    record.pendingHandoff = null;
    record.persistenceFailed = false;
    if (!verifyRuntimeOwnedDockerRestartPreparation(capability)) {
      record.persistenceFailed = true;
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Runtime 所有 Docker Restart Preparationを解放する。
 *
 * @responsibility Runtime 所有 Docker Restart Preparationの所有権、解放条件、終了後不存在の確認境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns booleanを返す。
 * @precondition 「capability: unknown」がreleaseRuntimeOwnedDockerRestartPreparationの入力契約を満たす。
 * @postcondition releaseRuntimeOwnedDockerRestartPreparationの責務を完了した結果だけを返す。
 * @effect N/A: releaseRuntimeOwnedDockerRestartPreparationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure releaseRuntimeOwnedDockerRestartPreparationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant releaseRuntimeOwnedDockerRestartPreparationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: releaseRuntimeOwnedDockerRestartPreparationはProcess内の同一Subsystemで完結する。
 * @security releaseRuntimeOwnedDockerRestartPreparationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: releaseRuntimeOwnedDockerRestartPreparationは共有非同期状態を持たない同期処理である。
 */
export function releaseRuntimeOwnedDockerRestartPreparation(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRestartPreparations.get(capability);
  if (!record || record.closed) return false;
  record.closed = true;
  let confirmed = true;
  for (const lock of [...record.locks].reverse()) {
    try {
      if (!lock.release()) confirmed = false;
    } catch {
      confirmed = false;
    }
  }
  return confirmed;
}

/**
 * A settled protected chain is evidence, never a caller-supplied authority.
 *
 * @responsibility docker-recovery-runtime-internalの入力からrecover Runtime 所有 Docker Task After Recorded Engine Restartを導く規則と結果境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown、developmentContext: unknown
 * @returns recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestartの計算結果を返す。
 * @precondition 「token: unknown、developmentContext: unknown」がrecoverRuntimeOwnedDockerTaskAfterRecordedEngineRestartの入力契約を満たす。
 * @postcondition recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestartの責務を完了した結果だけを返す。
 * @effect N/A: recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestartは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestartは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestartは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestartはProcess内の同一Subsystemで完結する。
 * @security recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestartはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestartは共有非同期状態を持たない同期処理である。
 */
export function recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestart(
  token: unknown,
  developmentContext?: unknown,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  try {
    if (!parsed) throw new Error("docker_task_recovery_id_invalid");
    const development =
      developmentContext !== undefined &&
      developmentContext !== null &&
      typeof developmentContext === "object"
        ? borrowRuntimeOwnedDevelopmentNativeObservation(
            developmentContext,
            false,
          )
        : null;
    if (developmentContext !== undefined && !development)
      throw new Error("docker_task_recovery_restart_authority_invalid");
    const verification =
      development?.verification ??
      verifyBundledCoordinatorPackageFromFixedManifestCandidate({
        evaluationTime: new Date().toISOString(),
      });
    if (
      verification.status !== "candidate" ||
      typeof verification.runtimeExecutionIdentitySha256 !== "string" ||
      (!development &&
        (!("runtimeOwnedReleaseTrustConfirmed" in verification) ||
          verification.runtimeOwnedReleaseTrustConfirmed !== true ||
          verification.runtimeExecutionIdentityRuntimeOwned !== true ||
          verification.crddDistributionConfirmed !== true))
    )
      throw new Error("docker_task_recovery_restart_authority_invalid");
    const root = observeRuntimeStateRootFromWindows(developmentContext);
    if (!root) throw new Error("docker_task_recovery_restart_root_unverified");
    const inventory = inspectDockerRecoveryRootSnapshot(root.rootPath);
    if (
      inventory.status !== "completed" ||
      !inventory.dockerRecoveryIds.some(
        (value: unknown) => value === parsed.token,
      ) ||
      !inventory.activeStableLogicalHomeBindingHashes.some(
        (value: unknown) => value === parsed.stableLogicalHomeBindingHash,
      )
    )
      throw new Error("docker_task_recovery_restart_scope_conflict");
    const directory = path.join(
      root.rootPath,
      `docker-task-${parsed.operationNonce}`,
    );
    const restartInventory = inventoryOperationDirectory(
      directory,
      parsed.token,
      parsed.operationNonce,
      parsed.baseHash,
    );
    const hasContinuation = restartInventory.some((name) =>
      name.startsWith("engine-continuation-"),
    );
    const records = Array.from({ length: 5 }, (unusedValue, sequence) => {
      void unusedValue;
      return readExactJson(
        path.join(
          directory,
          `${hasContinuation ? "engine-continuation" : "engine-restart"}-${String(sequence).padStart(2, "0")}.json`,
        ),
      );
    });
    const rawRecords = records.map((record) =>
      hasContinuation
        ? canonical(
            parseDockerRestartContinuationRecord(Buffer.from(record.serialized))
              ?.record,
          )
        : record.serialized,
    );
    const firstBytes = rawRecords[0];
    const first = firstBytes
      ? parseDockerRestartRecord(Buffer.from(firstBytes))
      : null;
    if (!first) throw new Error("docker_task_recovery_restart_chain_invalid");
    const expectedBinding = {
      ...first,
      recoveryId: parsed.token,
      operationNonce: parsed.operationNonce,
      stableLogicalHomeBindingHash: parsed.stableLogicalHomeBindingHash,
      runtimeExecutionIdentitySha256:
        verification.runtimeExecutionIdentitySha256,
      // Keep the immutable operation principal used by the restart history.
      // The recovery path validates the current session through the protected
      // Runtime root and its append-only session handoff.
      localUserBindingHash: first.localUserBindingHash,
      runtimeStateIdentityHash: root.runtimeStateIdentityHash,
      runtimeStateProtectionHash: root.runtimeStateProtectionHash,
    };
    const readPrefix = (prefix: string) =>
      restartInventory
        .filter((name) => name.startsWith(prefix))
        .sort()
        .map((name) =>
          Buffer.from(readExactJson(path.join(directory, name)).serialized),
        );
    if (
      !(hasContinuation
        ? resolveDockerRestartHistory(
            readPrefix("engine-restart-"),
            expectedBinding,
            readPrefix("engine-handoff-"),
            records.map((record) => Buffer.from(record.serialized)),
          )
        : validateDockerRestartRecordChain(
            rawRecords.map((record) => Buffer.from(record)),
            expectedBinding,
          ))
    )
      throw new Error("docker_task_recovery_restart_chain_invalid");
    const pendingNames =
      selectPendingDockerSubmissionNamesFromInventory(restartInventory);
    const pendingName = pendingNames[0];
    const settled = records.at(-1);
    if (
      pendingNames.length !== 1 ||
      !pendingName ||
      !settled ||
      readExactJson(path.join(directory, pendingName)).hash !==
        first.pendingSubmissionSha256
    )
      throw new Error("docker_task_recovery_restart_submission_mismatch");
    return recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
      parsed.token,
      root,
      () => observeRuntimeStateRootFromWindows(developmentContext),
      null,
      Object.freeze({
        recoveryId: parsed.token,
        origin: "engine_restart" as const,
        restartRecordSha256: settled.hash,
        pendingSubmissionSha256: first.pendingSubmissionSha256,
      }),
    );
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_recovery_restart_unverified",
      ),
      recoveryId: parsed?.token ?? null,
    });
  }
}

/**
 * Runtime 所有 Docker 回復 Evidenceを分類する。
 *
 * @responsibility Runtime 所有 Docker 回復 Evidenceの分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input inventory: unknown、recoveryId: string
 * @returns classifyRuntimeOwnedDockerRecoveryEvidenceの計算結果を返す。
 * @precondition 「inventory: unknown、recoveryId: string」がclassifyRuntimeOwnedDockerRecoveryEvidenceの入力契約を満たす。
 * @postcondition classifyRuntimeOwnedDockerRecoveryEvidenceの責務を完了した結果だけを返す。
 * @effect N/A: classifyRuntimeOwnedDockerRecoveryEvidenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyRuntimeOwnedDockerRecoveryEvidenceは独自の失敗分岐を所有しない。
 * @invariant classifyRuntimeOwnedDockerRecoveryEvidenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyRuntimeOwnedDockerRecoveryEvidenceはProcess内の同一Subsystemで完結する。
 * @security classifyRuntimeOwnedDockerRecoveryEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyRuntimeOwnedDockerRecoveryEvidenceは共有非同期状態を持たない同期処理である。
 */
export function classifyRuntimeOwnedDockerRecoveryEvidence(
  inventory: unknown,
  recoveryId: string,
) {
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory))
    return "unknown" as const;
  const record = inventory as Readonly<Record<string, unknown>>;
  if (record.status !== "completed" || !Array.isArray(record.dockerRecoveryIds))
    return "unknown" as const;
  return (record.dockerRecoveryIds as readonly unknown[]).includes(recoveryId)
    ? ("preserved" as const)
    : ("not_preserved" as const);
}

/**
 * recover Runtime 所有 Docker Taskを決定する。
 *
 * @responsibility recover Runtime 所有 Docker Taskの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown、developmentContext: unknown
 * @returns recoverRuntimeOwnedDockerTaskの計算結果を返す。
 * @precondition 「token: unknown、developmentContext: unknown」がrecoverRuntimeOwnedDockerTaskの入力契約を満たす。
 * @postcondition recoverRuntimeOwnedDockerTaskの責務を完了した結果だけを返す。
 * @effect N/A: recoverRuntimeOwnedDockerTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure recoverRuntimeOwnedDockerTaskは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant recoverRuntimeOwnedDockerTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoverRuntimeOwnedDockerTaskはProcess内の同一Subsystemで完結する。
 * @security recoverRuntimeOwnedDockerTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoverRuntimeOwnedDockerTaskは共有非同期状態を持たない同期処理である。
 */
export function recoverRuntimeOwnedDockerTask(
  token: unknown,
  developmentContext?: unknown,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  try {
    const result = recoverRuntimeOwnedDockerTaskInternal(
      token,
      developmentContext,
    );
    const inventory =
      result.status === "blocked" && parsed
        ? inspectRuntimeOwnedDockerTaskRecoveryState(developmentContext)
        : null;
    const evidenceState = classifyRuntimeOwnedDockerRecoveryEvidence(
      inventory,
      parsed?.token ?? "",
    );
    return Object.freeze({
      ...result,
      recoveryId: evidenceState === "not_preserved" ? null : result.recoveryId,
      manualRecoveryRequired: result.status === "blocked" && Boolean(parsed),
      evidenceState,
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(error, "docker_task_recovery_failed_closed"),
      recoveryId: parsed?.token ?? null,
      manualRecoveryRequired: Boolean(parsed),
      evidenceState: "unknown" as const,
    });
  }
}

/**
 * Acknowledge a Docker recovery completion only after the Orchestrator has
 * durably recorded the matching obligation as settled.  The receipt is a
 * replay fence, not a permanent history record; removing its committed pair
 * closes that resource lifecycle and prevents the bounded Runtime root from
 * filling with already-consumed fences.
 */
/**
 * Runtime 所有 Docker 回復 Completion From Verified Rootを確認済みとして記録する。
 *
 * @responsibility Runtime 所有 Docker 回復 Completion From Verified Rootの確認入力、状態遷移、重複処理境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown、root: VerifiedRuntimeStateRoot
 * @returns acknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRootの計算結果を返す。
 * @precondition 「token: unknown、root: VerifiedRuntimeStateRoot」がacknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRootの入力契約を満たす。
 * @postcondition acknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRootの責務を完了した結果だけを返す。
 * @effect N/A: acknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure acknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRootは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant acknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: acknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRootはProcess内の同一Subsystemで完結する。
 * @security acknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: acknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRootは共有非同期状態を持たない同期処理である。
 */
export function acknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRoot(
  token: unknown,
  root: VerifiedRuntimeStateRoot,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  if (!parsed)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_id_invalid",
    });
  try {
    const expectedBinding = runtimeStateBindingEvidence(root);
    const beforeResumeReceipt = inspectCompletedDockerRecoveryReceipt(
      root.rootPath,
      parsed.token,
    );
    if (
      beforeResumeReceipt &&
      JSON.stringify(beforeResumeReceipt.runtimeStateBinding) !==
        JSON.stringify(expectedBinding)
    )
      throw new Error("docker_task_recovery_completion_binding_mismatch");
    if (hasDockerRecoveryJournalIntentForRecovery(root.rootPath, parsed.token))
      resumeDockerRecoveryJournalDirectoryForRecovery(
        root.rootPath,
        parsed.token,
        expectedBinding,
      );
    const receipt = inspectCompletedDockerRecoveryReceipt(
      root.rootPath,
      parsed.token,
    );
    if (!receipt) {
      const acknowledged = inspectAcknowledgedDockerRecoveryReceipt(
        root.rootPath,
        parsed.token,
      );
      if (
        !acknowledged ||
        JSON.stringify(acknowledged.runtimeStateBinding) !==
          JSON.stringify(expectedBinding)
      )
        throw new Error("docker_task_recovery_completion_receipt_missing");
      return Object.freeze({
        status: "completed" as const,
        reason: "docker_task_recovery_completion_already_acknowledged",
        acknowledgement: Object.freeze({
          runtimeStateBinding: acknowledged.runtimeStateBinding,
          receiptContentHash: acknowledged.receiptContentHash,
          receiptContentIdentity: acknowledged.receiptContentIdentity,
        }),
      });
    }
    if (
      JSON.stringify(receipt.runtimeStateBinding) !==
      JSON.stringify(expectedBinding)
    )
      throw new Error("docker_task_recovery_completion_binding_mismatch");
    const acknowledgedName = acknowledgedDockerRecoveryReceiptName(
      parsed.token,
    );
    const acknowledgementValue = Object.freeze({
      schema: "crdd-coordinator-docker-recovery-acknowledgement/v1",
      recoveryId: parsed.token,
      runtimeStateBinding: expectedBinding,
      receiptContentHash: receipt.receiptContentHash,
      receiptContentIdentity: receipt.receiptContentIdentity,
    });
    const isExistingAcknowledged = recoveryPathPresent(
      path.join(root.rootPath, acknowledgedName),
    );
    if (!isExistingAcknowledged) {
      const acknowledgementCount = fs
        .readdirSync(root.rootPath)
        .filter((name) =>
          ACKNOWLEDGED_DOCKER_RECOVERY_RECEIPT.test(name),
        ).length;
      if (acknowledgementCount >= MAX_COMPLETED_DOCKER_RECOVERY_RECEIPTS)
        throw new Error(
          "docker_task_recovery_acknowledgement_tombstone_limit_exceeded",
        );
    }
    writeOrResumeCommittedDockerRecoveryJson(
      root.rootPath,
      acknowledgedName,
      acknowledgedName,
      acknowledgementValue,
    );
    commitDirectoryMutationBoundary(root.rootPath);
    const acknowledged = inspectAcknowledgedDockerRecoveryReceipt(
      root.rootPath,
      parsed.token,
    );
    if (
      !acknowledged ||
      JSON.stringify(acknowledged.runtimeStateBinding) !==
        JSON.stringify(expectedBinding) ||
      acknowledged.receiptContentHash !== receipt.receiptContentHash ||
      acknowledged.receiptContentIdentity !== receipt.receiptContentIdentity
    )
      throw new Error("docker_task_recovery_acknowledgement_unknown");
    const location = path.join(root.rootPath, receipt.name);
    if (!removeCommittedDockerRecoveryJson(location, receipt.name))
      throw new Error("docker_task_recovery_completion_acknowledgement_failed");
    commitDirectoryMutationBoundary(root.rootPath);
    if (
      recoveryPathPresent(location) ||
      recoveryPathPresent(dockerRecoveryCommitName(location))
    )
      throw new Error(
        "docker_task_recovery_completion_acknowledgement_unknown",
      );
    return Object.freeze({
      status: "completed" as const,
      reason: "docker_task_recovery_completion_acknowledged",
      acknowledgement: Object.freeze({
        runtimeStateBinding: acknowledged.runtimeStateBinding,
        receiptContentHash: acknowledged.receiptContentHash,
        receiptContentIdentity: acknowledged.receiptContentIdentity,
      }),
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_recovery_completion_acknowledgement_failed",
      ),
    });
  }
}

/**
 * finalize Runtime 所有 Docker 回復 Acknowledgement From Verified Rootを決定する。
 *
 * @responsibility finalize Runtime 所有 Docker 回復 Acknowledgement From Verified Rootの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown、acknowledgement: unknown、root: VerifiedRuntimeStateRoot
 * @returns finalizeRuntimeOwnedDockerRecoveryAcknowledgementFromVerifiedRootの計算結果を返す。
 * @precondition 「token: unknown、acknowledgement: unknown、root: VerifiedRuntimeStateRoot」がfinalizeRuntimeOwnedDockerRecoveryAcknowledgementFromVerifiedRootの入力契約を満たす。
 * @postcondition finalizeRuntimeOwnedDockerRecoveryAcknowledgementFromVerifiedRootの責務を完了した結果だけを返す。
 * @effect N/A: finalizeRuntimeOwnedDockerRecoveryAcknowledgementFromVerifiedRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure finalizeRuntimeOwnedDockerRecoveryAcknowledgementFromVerifiedRootは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant finalizeRuntimeOwnedDockerRecoveryAcknowledgementFromVerifiedRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: finalizeRuntimeOwnedDockerRecoveryAcknowledgementFromVerifiedRootはProcess内の同一Subsystemで完結する。
 * @security finalizeRuntimeOwnedDockerRecoveryAcknowledgementFromVerifiedRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: finalizeRuntimeOwnedDockerRecoveryAcknowledgementFromVerifiedRootは共有非同期状態を持たない同期処理である。
 */
export function finalizeRuntimeOwnedDockerRecoveryAcknowledgementFromVerifiedRoot(
  token: unknown,
  acknowledgement: unknown,
  root: VerifiedRuntimeStateRoot,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  if (!parsed || !acknowledgement || typeof acknowledgement !== "object")
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_acknowledgement_gc_authority_invalid",
    });
  try {
    const expectedBinding = runtimeStateBindingEvidence(root);
    const expected = acknowledgement as Readonly<Record<string, unknown>>;
    if (
      !exactRecordKeys(expected, [
        "runtimeStateBinding",
        "receiptContentHash",
        "receiptContentIdentity",
      ]) ||
      !validRuntimeStateBindingEvidence(expected.runtimeStateBinding) ||
      JSON.stringify(expected.runtimeStateBinding) !==
        JSON.stringify(expectedBinding) ||
      typeof expected.receiptContentHash !== "string" ||
      !HEX64.test(expected.receiptContentHash) ||
      typeof expected.receiptContentIdentity !== "string"
    )
      throw new Error(
        "docker_task_recovery_acknowledgement_gc_authority_invalid",
      );
    if (hasDockerRecoveryJournalIntentForRecovery(root.rootPath, parsed.token))
      resumeDockerRecoveryJournalDirectoryForRecovery(
        root.rootPath,
        parsed.token,
        expectedBinding,
      );
    const tombstone = inspectAcknowledgedDockerRecoveryReceipt(
      root.rootPath,
      parsed.token,
    );
    if (!tombstone) {
      const staleReceipt = inspectCompletedDockerRecoveryReceipt(
        root.rootPath,
        parsed.token,
      );
      if (staleReceipt)
        throw new Error("docker_task_recovery_acknowledgement_gc_mismatch");
      return Object.freeze({
        status: "completed" as const,
        reason: "docker_task_recovery_acknowledgement_already_collected",
      });
    }
    if (
      JSON.stringify(tombstone.runtimeStateBinding) !==
        JSON.stringify(expectedBinding) ||
      tombstone.receiptContentHash !== expected.receiptContentHash ||
      tombstone.receiptContentIdentity !== expected.receiptContentIdentity
    )
      throw new Error("docker_task_recovery_acknowledgement_gc_mismatch");
    const location = path.join(root.rootPath, tombstone.name);
    if (!removeCommittedDockerRecoveryJson(location, tombstone.name))
      throw new Error("docker_task_recovery_acknowledgement_gc_failed");
    commitDirectoryMutationBoundary(root.rootPath);
    if (
      recoveryPathPresent(location) ||
      recoveryPathPresent(dockerRecoveryCommitName(location))
    )
      throw new Error("docker_task_recovery_acknowledgement_gc_unknown");
    return Object.freeze({
      status: "completed" as const,
      reason: "docker_task_recovery_acknowledgement_collected",
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_recovery_acknowledgement_gc_failed",
      ),
    });
  }
}

/**
 * Runtime 所有 Docker 回復 Completionを確認済みとして記録する。
 *
 * @responsibility Runtime 所有 Docker 回復 Completionの確認入力、状態遷移、重複処理境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns acknowledgeRuntimeOwnedDockerRecoveryCompletionの計算結果を返す。
 * @precondition 「token: unknown」がacknowledgeRuntimeOwnedDockerRecoveryCompletionの入力契約を満たす。
 * @postcondition acknowledgeRuntimeOwnedDockerRecoveryCompletionの責務を完了した結果だけを返す。
 * @effect N/A: acknowledgeRuntimeOwnedDockerRecoveryCompletionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure acknowledgeRuntimeOwnedDockerRecoveryCompletionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant acknowledgeRuntimeOwnedDockerRecoveryCompletionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: acknowledgeRuntimeOwnedDockerRecoveryCompletionはProcess内の同一Subsystemで完結する。
 * @security acknowledgeRuntimeOwnedDockerRecoveryCompletionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: acknowledgeRuntimeOwnedDockerRecoveryCompletionは共有非同期状態を持たない同期処理である。
 */
export function acknowledgeRuntimeOwnedDockerRecoveryCompletion(
  token: unknown,
) {
  try {
    const observation = inspectRuntimeOwnedWindowsRuntimeState(
      false,
      new Date().toISOString(),
    );
    const root = consumeRuntimeOwnedRuntimeStateRootCapability(
      observation.rootCapability,
    );
    if (observation.status !== "candidate" || !root)
      throw new Error("docker_task_runtime_state_unavailable");
    const lock = acquireRuntimeOwnedDockerRuntimeStateKernelLock(
      root.stableLogicalHomeBindingHash,
    );
    if (!lock) throw new Error("docker_task_runtime_state_lock_unavailable");
    let result: ReturnType<
      typeof acknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRoot
    >;
    try {
      result = acknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRoot(
        token,
        root,
      );
    } catch (error) {
      const released = lock.release();
      if (!released)
        throw new Error("docker_task_runtime_state_lock_release_unconfirmed");
      throw error;
    }
    if (!lock.release())
      throw new Error("docker_task_runtime_state_lock_release_unconfirmed");
    return result;
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_recovery_completion_acknowledgement_failed",
      ),
    });
  }
}

/**
 * finalize Runtime 所有 Docker 回復 Acknowledgementを決定する。
 *
 * @responsibility finalize Runtime 所有 Docker 回復 Acknowledgementの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown、acknowledgement: unknown
 * @returns finalizeRuntimeOwnedDockerRecoveryAcknowledgementの計算結果を返す。
 * @precondition 「token: unknown、acknowledgement: unknown」がfinalizeRuntimeOwnedDockerRecoveryAcknowledgementの入力契約を満たす。
 * @postcondition finalizeRuntimeOwnedDockerRecoveryAcknowledgementの責務を完了した結果だけを返す。
 * @effect N/A: finalizeRuntimeOwnedDockerRecoveryAcknowledgementは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure finalizeRuntimeOwnedDockerRecoveryAcknowledgementは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant finalizeRuntimeOwnedDockerRecoveryAcknowledgementは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: finalizeRuntimeOwnedDockerRecoveryAcknowledgementはProcess内の同一Subsystemで完結する。
 * @security finalizeRuntimeOwnedDockerRecoveryAcknowledgementはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: finalizeRuntimeOwnedDockerRecoveryAcknowledgementは共有非同期状態を持たない同期処理である。
 */
export function finalizeRuntimeOwnedDockerRecoveryAcknowledgement(
  token: unknown,
  acknowledgement: unknown,
) {
  try {
    const observation = inspectRuntimeOwnedWindowsRuntimeState(
      false,
      new Date().toISOString(),
    );
    const root = consumeRuntimeOwnedRuntimeStateRootCapability(
      observation.rootCapability,
    );
    if (observation.status !== "candidate" || !root)
      throw new Error("docker_task_runtime_state_unavailable");
    const lock = acquireRuntimeOwnedDockerRuntimeStateKernelLock(
      root.stableLogicalHomeBindingHash,
    );
    if (!lock) throw new Error("docker_task_runtime_state_lock_unavailable");
    let result: ReturnType<
      typeof finalizeRuntimeOwnedDockerRecoveryAcknowledgementFromVerifiedRoot
    >;
    try {
      result =
        finalizeRuntimeOwnedDockerRecoveryAcknowledgementFromVerifiedRoot(
          token,
          acknowledgement,
          root,
        );
    } catch (error) {
      const released = lock.release();
      if (!released)
        throw new Error("docker_task_runtime_state_lock_release_unconfirmed");
      throw error;
    }
    if (!lock.release())
      throw new Error("docker_task_runtime_state_lock_release_unconfirmed");
    return result;
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_recovery_acknowledgement_gc_failed",
      ),
    });
  }
}

/**
 * Docker 回復 Root Snapshotを観測する。
 *
 * @responsibility Docker 回復 Root Snapshotの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input rootPath: unknown
 * @returns inspectDockerRecoveryRootSnapshotの計算結果を返す。
 * @precondition 「rootPath: unknown」がinspectDockerRecoveryRootSnapshotの入力契約を満たす。
 * @postcondition inspectDockerRecoveryRootSnapshotの責務を完了した結果だけを返す。
 * @effect inspectDockerRecoveryRootSnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure inspectDockerRecoveryRootSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectDockerRecoveryRootSnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inspectDockerRecoveryRootSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectDockerRecoveryRootSnapshotは共有非同期状態を持たない同期処理である。
 */
function inspectDockerRecoveryRootSnapshot(rootPath: unknown) {
  try {
    if (typeof rootPath !== "string" || !path.isAbsolute(rootPath))
      return Object.freeze({
        status: "blocked" as const,
        reason: "docker_task_runtime_state_unavailable",
        manualRecoveryRequired: true,
        dockerRecoveryId: null,
        dockerRecoveryIds: Object.freeze([]),
        activeStableLogicalHomeBindingHashes: Object.freeze([]),
      });
    const rootMetadata = fs.lstatSync(rootPath);
    if (
      !rootMetadata.isDirectory() ||
      rootMetadata.isSymbolicLink() ||
      fs.realpathSync(rootPath) !== rootPath
    )
      throw new Error("docker_task_runtime_state_root_replaced");
    const entries = fs.readdirSync(rootPath, { withFileTypes: true });
    if (entries.length > 256)
      throw new Error("docker_task_runtime_state_entry_limit_exceeded");
    const sortedEntries = [...entries].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    if (entries.length === 0)
      return Object.freeze({
        status: "completed" as const,
        reason: "docker_task_runtime_state_clean",
        manualRecoveryRequired: false,
        dockerRecoveryId: null,
        dockerRecoveryIds: Object.freeze([]),
        activeStableLogicalHomeBindingHashes: Object.freeze([]),
      });
    const records = new Map<
      string,
      Readonly<{
        token: string;
        stable: string;
        nonce: string;
        cleanup: boolean;
        pendingBaseSource?: "required" | "absent" | "journal";
        pendingCommitSource?: "required" | "absent" | "journal";
        pointerEligible?: boolean;
      }>
    >();
    const pendingBaseNames = new Set<string>();
    const pendingCommitNames = new Set<string>();
    const entryNames = new Set(entries.map((entry) => entry.name));
    const pointers: Array<
      Readonly<{ name: string; value: Record<string, unknown> }>
    > = [];
    const externalSendConsentRecordNames = new Set<string>();
    const completedDockerRecoveryReceiptNames = new Set<string>();
    const acknowledgedDockerRecoveryReceiptNames = new Set<string>();
    const sessionHandoffRecoveryIds = new Set<string>();
    const journalIntents = inspectDockerRecoveryJournalDirectory(rootPath);
    const journalIntentRecoveryIds = new Set(
      journalIntents
        .map((intent) => intent.recoveryId)
        .filter((value): value is string => value !== null),
    );
    const journalPairNames = new Set(
      journalIntents.flatMap((intent) =>
        [intent.pairContentName, intent.pairCommitName].filter(
          (value): value is string => value !== null,
        ),
      ),
    );
    const recoveryIdForNonce = (nonce: string) => {
      const matches = [...journalIntentRecoveryIds].filter(
        (recoveryId) =>
          parseDockerTaskRecoveryId(recoveryId)?.operationNonce === nonce,
      );
      if (matches.length > 1)
        throw new Error("docker_task_runtime_state_base_invalid");
      return matches[0] ?? null;
    };
    const readRootRecord = (
      file: string,
      logicalKey: string,
      recoveryId: string | null,
    ):
      | ReturnType<typeof readExactJson>
      | (ReturnType<typeof discoverDockerRecoveryJournalJsonForRecovery> &
          object)
      | ReturnType<typeof inspectDockerRecoveryMoveJournalForRecovery> => {
      try {
        return readExactJson(file, logicalKey);
      } catch (error) {
        if (!recoveryId) throw error;
        if (recoveryPathPresent(file))
          return inspectDockerRecoveryMoveJournalForRecovery(
            rootPath,
            recoveryId,
            logicalKey,
            path.dirname(file),
            path.basename(file),
          );
        const discovered = discoverDockerRecoveryJournalJsonForRecovery(
          rootPath,
          logicalKey,
          recoveryId,
        );
        if (discovered) return discovered;
        throw error;
      }
    };
    /**
     * docker-recovery-runtime-internalで使用するBootstrap 記録の値契約を定義する。
     *
     * @responsibility Bootstrap 記録のProperty、Identity、状態制約を型境界として所有する。
     * @trace ARCH-000008
     * @shape BootstrapRecordが表すProperty、識別子およびRelationを型として固定する。
     * @invariant BootstrapRecordで宣言した値と責務の対応を維持する。
     * @boundary N/A: BootstrapRecordの宣言は外部境界を開かない。
     * @security BootstrapRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @compatibility BootstrapRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
     */
    type BootstrapRecord = ReturnType<typeof readRootRecord>;
    /**
     * docker-recovery-runtime-internalで使用するBootstrap Pair 状態の値契約を定義する。
     *
     * @responsibility Bootstrap Pair 状態のProperty、Identity、状態制約を型境界として所有する。
     * @trace ARCH-000008
     * @shape BootstrapPairStateが表すProperty、識別子およびRelationを型として固定する。
     * @invariant BootstrapPairStateで宣言した値と責務の対応を維持する。
     * @boundary N/A: BootstrapPairStateの宣言は外部境界を開かない。
     * @security BootstrapPairStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @compatibility BootstrapPairStateの利用側は宣言済みPropertyと型制約だけへ依存する。
     */
    type BootstrapPairState =
      | "absent"
      | "move_content"
      | "move_commit"
      | "complete";
    /**
     * docker-recovery-runtime-internalで使用するBootstrap Pair Inspectionの値契約を定義する。
     *
     * @responsibility Bootstrap Pair InspectionのProperty、Identity、状態制約を型境界として所有する。
     * @trace ARCH-000008
     * @shape BootstrapPairInspectionが表すProperty、識別子およびRelationを型として固定する。
     * @invariant BootstrapPairInspectionで宣言した値と責務の対応を維持する。
     * @boundary N/A: BootstrapPairInspectionの宣言は外部境界を開かない。
     * @security BootstrapPairInspectionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @compatibility BootstrapPairInspectionの利用側は宣言済みPropertyと型制約だけへ依存する。
     */
    type BootstrapPairInspection = Readonly<{
      state: BootstrapPairState;
      hasIntent: boolean;
    }>;
    const pendingSourceExpectation = (
      inspection: BootstrapPairInspection,
    ): "required" | "absent" | "journal" =>
      inspection.hasIntent
        ? "journal"
        : inspection.state === "absent"
          ? "required"
          : "absent";
    const sameBootstrapRecord = (
      left: BootstrapRecord,
      right: BootstrapRecord,
    ) =>
      left.logicalKey === right.logicalKey &&
      left.serialized === right.serialized &&
      left.hash === right.hash &&
      left.identityText === right.identityText;
    const inspectBootstrapPairState = (
      directory: string,
      recoveryId: string,
      logicalKey: "base.json" | "base-commit.json",
      record: BootstrapRecord,
    ): BootstrapPairInspection => {
      const target = path.join(directory, logicalKey);
      const targetCommit = path.join(
        directory,
        dockerRecoveryCommitName(logicalKey),
      );
      const matchingIntents = journalIntents.filter(
        (intent) =>
          intent.schema === "crdd-coordinator-durable-json-move/v1" &&
          intent.recoveryId === recoveryId &&
          intent.pairLogicalKey === logicalKey &&
          intent.targetContentName === logicalKey &&
          intent.targetCommitName === dockerRecoveryCommitName(logicalKey),
      );
      if (matchingIntents.length > 1)
        throw new Error("docker_task_runtime_state_base_invalid");
      if (matchingIntents.length === 1) {
        const inspected = inspectDockerRecoveryMoveJournalForRecovery(
          rootPath,
          recoveryId,
          logicalKey,
          directory,
          logicalKey,
        );
        if (!sameBootstrapRecord(record, inspected))
          throw new Error("docker_task_runtime_state_base_invalid");
        return Object.freeze({ state: inspected.moveState, hasIntent: true });
      }
      const targetPresent = recoveryPathPresent(target);
      const targetCommitPresent = recoveryPathPresent(targetCommit);
      if (!targetPresent && !targetCommitPresent)
        return Object.freeze({ state: "absent" as const, hasIntent: false });
      if (!targetPresent || !targetCommitPresent)
        throw new Error("docker_task_runtime_state_base_invalid");
      const inspected = readExactJson(target, logicalKey);
      if (!sameBootstrapRecord(record, inspected))
        throw new Error("docker_task_runtime_state_base_invalid");
      return Object.freeze({ state: "complete" as const, hasIntent: false });
    };
    const inventoryBootstrapOperationDirectory = (
      directory: string,
      recoveryId: string,
      base: BootstrapRecord,
      commit: BootstrapRecord,
    ) => {
      const before = fs.lstatSync(directory, { bigint: true });
      if (!before.isDirectory() || before.isSymbolicLink())
        throw new Error("docker_task_runtime_state_entry_replaced");
      const baseState = inspectBootstrapPairState(
        directory,
        recoveryId,
        "base.json",
        base,
      );
      const commitState = inspectBootstrapPairState(
        directory,
        recoveryId,
        "base-commit.json",
        commit,
      );
      if (
        (baseState.state !== "complete" && commitState.state !== "absent") ||
        (baseState.hasIntent && commitState.state !== "absent")
      )
        throw new Error("docker_task_runtime_state_base_invalid");
      if (baseState.state === "complete" && commitState.state === "complete") {
        const after = fs.lstatSync(directory, { bigint: true });
        if (
          before.dev !== after.dev ||
          before.ino !== after.ino ||
          before.birthtimeNs !== after.birthtimeNs
        )
          throw new Error("docker_task_runtime_state_entry_replaced");
        return Object.freeze({
          baseState: baseState.state,
          commitState: commitState.state,
          pendingBaseSource: pendingSourceExpectation(baseState),
          pendingCommitSource: pendingSourceExpectation(commitState),
        });
      }
      const allowed = new Set<string>();
      for (const [name, state] of [
        ["base.json", baseState.state],
        ["base-commit.json", commitState.state],
      ] as const) {
        if (state === "move_commit" || state === "complete") allowed.add(name);
        if (state === "complete") allowed.add(dockerRecoveryCommitName(name));
      }
      const entries = fs.readdirSync(directory, { withFileTypes: true });
      if (entries.length > 8)
        throw new Error("docker_task_recovery_operation_entry_limit_exceeded");
      if (
        entries.length !== allowed.size ||
        entries.some(
          (entry) =>
            !allowed.has(entry.name) ||
            !entry.isFile() ||
            entry.isSymbolicLink(),
        )
      )
        throw new Error("docker_task_runtime_state_unknown_entry");
      const after = fs.lstatSync(directory, { bigint: true });
      if (
        before.dev !== after.dev ||
        before.ino !== after.ino ||
        before.birthtimeNs !== after.birthtimeNs
      )
        throw new Error("docker_task_runtime_state_entry_replaced");
      return Object.freeze({
        baseState: baseState.state,
        commitState: commitState.state,
        pendingBaseSource: pendingSourceExpectation(baseState),
        pendingCommitSource: pendingSourceExpectation(commitState),
      });
    };
    const addRecord = (
      basePath: string,
      commitPath: string,
      nonce: string,
      expectedRecoveryId: string | null = recoveryIdForNonce(nonce),
    ) => {
      const base = readRootRecord(basePath, "base.json", expectedRecoveryId);
      const commitRecord = readRootRecord(
        commitPath,
        "base-commit.json",
        expectedRecoveryId,
      );
      const commit = commitRecord.value as Record<string, unknown>;
      const value = base.value as Record<string, unknown>;
      const stable = value.stableLogicalHomeBindingHash;
      if (
        !validateDockerRecoveryBase(value, nonce) ||
        !validateDockerRecoveryBaseCommit(
          commit,
          nonce,
          base.hash,
          String(commit.recoveryId ?? ""),
        ) ||
        value.operationNonce !== nonce ||
        commit.operationNonce !== nonce ||
        typeof stable !== "string" ||
        !HEX64.test(stable) ||
        commit.stableLogicalHomeBindingHash !== stable ||
        commit.baseHash !== base.hash
      )
        throw new Error("docker_task_runtime_state_base_invalid");
      const token = `docker-task.${stable}.${nonce}.${base.hash}`;
      if (
        (expectedRecoveryId !== null && token !== expectedRecoveryId) ||
        commit.recoveryId !== token ||
        records.has(nonce)
      )
        throw new Error("docker_task_runtime_state_base_invalid");
      const directory = path.join(rootPath, `docker-task-${nonce}`);
      let pendingBaseSource: "required" | "absent" | "journal" = "required";
      let pendingCommitSource: "required" | "absent" | "journal" = "required";
      let pointerEligible = false;
      if (recoveryPathPresent(directory)) {
        const bootstrap = inventoryBootstrapOperationDirectory(
          directory,
          token,
          base,
          commitRecord,
        );
        pendingBaseSource = bootstrap.pendingBaseSource;
        pendingCommitSource = bootstrap.pendingCommitSource;
        if (
          bootstrap.baseState === "complete" &&
          bootstrap.commitState === "complete" &&
          bootstrap.pendingBaseSource === "absent" &&
          bootstrap.pendingCommitSource === "absent"
        ) {
          if (
            recoveryPathPresent(path.join(directory, "cleanup-manifest.json"))
          )
            verifyRecoveryCleanupManifest(directory, token);
          else {
            const names = inventoryOperationDirectory(
              directory,
              token,
              nonce,
              base.hash,
            );
            const pointerReleaseStarted = [
              "lease-release-receipt.json",
              "normal-run-complete.json",
              "host-cleanup-intent.json",
              "host-cleanup-receipt.json",
            ].some((name) => names.includes(name));
            if (
              names.includes("host-begin-intent.json") &&
              !pointerReleaseStarted
            ) {
              const intent = readExactJson(
                path.join(directory, "host-begin-intent.json"),
              ).value as Record<string, unknown>;
              const lineage = validateHostTransitionLineage(
                intent,
                "docker_submission_started",
              );
              if (lineage.currentToken !== value.initialHostRecoveryId)
                throw new Error(
                  "docker_task_recovery_host_transition_mismatch",
                );
              pointerEligible = true;
            }
          }
        }
      }
      records.set(
        nonce,
        Object.freeze({
          token,
          stable,
          nonce,
          cleanup: false,
          pendingBaseSource,
          pendingCommitSource,
          pointerEligible,
        }),
      );
    };
    const addPendingBaseOnlyRecord = (basePath: string, nonce: string) => {
      const base = readExactJson(basePath, "base.json");
      const value = base.value as Record<string, unknown>;
      const stable = value.stableLogicalHomeBindingHash;
      if (
        !validateDockerRecoveryBase(value, nonce) ||
        value.operationNonce !== nonce ||
        typeof stable !== "string" ||
        !HEX64.test(stable) ||
        records.has(nonce) ||
        recoveryIdForNonce(nonce) !== null
      )
        throw new Error("docker_task_runtime_state_base_invalid");
      records.set(
        nonce,
        Object.freeze({
          token: `docker-task.${stable}.${nonce}.${base.hash}`,
          stable,
          nonce,
          cleanup: false,
          pendingBaseSource: "required" as const,
          pendingCommitSource: "absent" as const,
        }),
      );
    };
    for (const entry of sortedEntries) {
      if (parseDockerDesktopRepairDirectoryName(entry.name)) {
        // Desktop repair owns this subtree. Recognizing its namespace does not
        // validate its records or authorize repair, close, or deletion here.
        const directory = path.join(rootPath, entry.name);
        const metadata = fs.lstatSync(directory);
        if (
          !entry.isDirectory() ||
          entry.isSymbolicLink() ||
          !metadata.isDirectory() ||
          metadata.isSymbolicLink() ||
          fs.realpathSync(directory) !== directory
        )
          throw new Error("docker_task_runtime_state_entry_replaced");
        continue;
      }
      const externalSendConsentEntry = parseExternalSendConsentActiveEntryName(
        entry.name,
      );
      if (externalSendConsentEntry) {
        if (!entry.isFile() || entry.isSymbolicLink())
          throw new Error("docker_task_runtime_state_entry_replaced");
        externalSendConsentRecordNames.add(externalSendConsentEntry.recordName);
        if (externalSendConsentRecordNames.size > 1)
          throw new Error("docker_task_runtime_state_unknown_entry");
        continue;
      }
      if (isDockerRecoveryJournalIntentName(entry.name)) continue;
      if (isDockerRecoveryJournalTemporaryName(entry.name))
        throw new Error("docker_task_runtime_state_orphan_temporary");
      const sessionHandoffMatch = DOCKER_TASK_SESSION_HANDOFF.exec(entry.name);
      if (sessionHandoffMatch?.[1]) {
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          !entryNames.has(dockerRecoveryCommitName(entry.name))
        )
          throw new Error("docker_task_session_handoff_invalid");
        const handoff = readExactJson(
          path.join(rootPath, entry.name),
          entry.name,
        ).value as Record<string, unknown>;
        if (
          typeof handoff.recoveryId !== "string" ||
          createHash("sha256").update(handoff.recoveryId).digest("hex") !==
            sessionHandoffMatch[1]
        )
          throw new Error("docker_task_session_handoff_invalid");
        sessionHandoffRecoveryIds.add(handoff.recoveryId);
        continue;
      }
      const completedReceiptMatch = COMPLETED_DOCKER_RECOVERY_RECEIPT.exec(
        entry.name,
      );
      if (completedReceiptMatch?.[1]) {
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          !entryNames.has(dockerRecoveryCommitName(entry.name))
        )
          throw new Error("docker_task_recovery_completion_receipt_invalid");
        const receipt = readExactJson(
          path.join(rootPath, entry.name),
          entry.name,
        ).value as Record<string, unknown>;
        if (
          !exactRecordKeys(receipt, [
            "schema",
            "recoveryId",
            "runtimeStateBinding",
          ]) ||
          receipt.schema !== "crdd-coordinator-docker-recovery-completion/v1" ||
          typeof receipt.recoveryId !== "string" ||
          createHash("sha256").update(receipt.recoveryId).digest("hex") !==
            completedReceiptMatch[1] ||
          !validRuntimeStateBindingEvidence(receipt.runtimeStateBinding)
        )
          throw new Error("docker_task_recovery_completion_receipt_invalid");
        completedDockerRecoveryReceiptNames.add(entry.name);
        if (
          completedDockerRecoveryReceiptNames.size >
          MAX_COMPLETED_DOCKER_RECOVERY_RECEIPTS
        )
          throw new Error(
            "docker_task_recovery_completion_receipt_limit_exceeded",
          );
        continue;
      }
      const acknowledgedReceiptMatch =
        ACKNOWLEDGED_DOCKER_RECOVERY_RECEIPT.exec(entry.name);
      if (acknowledgedReceiptMatch?.[1]) {
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          !entryNames.has(dockerRecoveryCommitName(entry.name))
        )
          throw new Error(
            "docker_task_recovery_acknowledgement_tombstone_invalid",
          );
        const acknowledged = readExactJson(
          path.join(rootPath, entry.name),
          entry.name,
        ).value as Record<string, unknown>;
        if (
          !exactRecordKeys(acknowledged, [
            "schema",
            "recoveryId",
            "runtimeStateBinding",
            "receiptContentHash",
            "receiptContentIdentity",
          ]) ||
          acknowledged.schema !==
            "crdd-coordinator-docker-recovery-acknowledgement/v1" ||
          typeof acknowledged.recoveryId !== "string" ||
          createHash("sha256").update(acknowledged.recoveryId).digest("hex") !==
            acknowledgedReceiptMatch[1] ||
          !validRuntimeStateBindingEvidence(acknowledged.runtimeStateBinding) ||
          typeof acknowledged.receiptContentHash !== "string" ||
          !HEX64.test(acknowledged.receiptContentHash) ||
          typeof acknowledged.receiptContentIdentity !== "string" ||
          acknowledged.receiptContentIdentity.length < 1 ||
          acknowledged.receiptContentIdentity.length > 256
        )
          throw new Error(
            "docker_task_recovery_acknowledgement_tombstone_invalid",
          );
        acknowledgedDockerRecoveryReceiptNames.add(entry.name);
        if (
          acknowledgedDockerRecoveryReceiptNames.size >
          MAX_COMPLETED_DOCKER_RECOVERY_RECEIPTS
        )
          throw new Error(
            "docker_task_recovery_acknowledgement_tombstone_limit_exceeded",
          );
        continue;
      }
      if (entry.name.endsWith(".crdd-commit.json")) {
        const dataName = entry.name.slice(0, -".crdd-commit.json".length);
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          (!entryNames.has(dataName) && !journalPairNames.has(entry.name))
        )
          throw new Error("docker_task_runtime_state_orphan_commit");
        continue;
      }
      let match =
        /^cleanup-docker-task-([a-f0-9]{64})-([a-f0-9]{64})-([a-f0-9]{64})$/u.exec(
          entry.name,
        );
      if (match?.[1] && match[2] && match[3]) {
        if (
          !entry.isDirectory() ||
          entry.isSymbolicLink() ||
          records.has(match[2])
        )
          throw new Error("docker_task_runtime_state_cleanup_replaced");
        const cleanupRecoveryId = `docker-task.${match[1]}.${match[2]}.${match[3]}`;
        try {
          inventoryRecoveryCleanupTombstone(
            path.join(rootPath, entry.name),
            cleanupRecoveryId,
          );
        } catch {
          if (!journalIntentRecoveryIds.has(cleanupRecoveryId))
            throw new Error("docker_task_runtime_state_cleanup_replaced");
        }
        records.set(
          match[2],
          Object.freeze({
            token: `docker-task.${match[1]}.${match[2]}.${match[3]}`,
            stable: match[1],
            nonce: match[2],
            cleanup: true,
          }),
        );
        continue;
      }
      match = /^docker-task-([a-f0-9]{64})$/u.exec(entry.name);
      if (match?.[1]) {
        if (!entry.isDirectory() || entry.isSymbolicLink())
          throw new Error("docker_task_runtime_state_entry_replaced");
        const directoryBase = path.join(rootPath, entry.name, "base.json");
        const directoryCommit = path.join(
          rootPath,
          entry.name,
          "base-commit.json",
        );
        addRecord(
          recoveryPathPresent(directoryBase)
            ? directoryBase
            : path.join(rootPath, `pending-docker-task-${match[1]}.json`),
          recoveryPathPresent(directoryCommit)
            ? directoryCommit
            : path.join(
                rootPath,
                `pending-docker-task-${match[1]}.commit.json`,
              ),
          match[1],
        );
        continue;
      }
      match = /^pending-docker-task-([a-f0-9]{64})\.json$/u.exec(entry.name);
      if (match?.[1]) {
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          !entryNames.has(dockerRecoveryCommitName(entry.name))
        )
          throw new Error("docker_task_runtime_state_entry_replaced");
        pendingBaseNames.add(match[1]);
        continue;
      }
      match = /^pending-docker-task-([a-f0-9]{64})\.commit\.json$/u.exec(
        entry.name,
      );
      if (match?.[1]) {
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          !entryNames.has(dockerRecoveryCommitName(entry.name))
        )
          throw new Error("docker_task_runtime_state_entry_replaced");
        pendingCommitNames.add(match[1]);
        continue;
      }
      if (/^active-lease-[a-f0-9]{64}\.json$/u.test(entry.name)) {
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          !entryNames.has(dockerRecoveryCommitName(entry.name))
        )
          throw new Error("docker_task_runtime_state_entry_replaced");
        pointers.push(
          Object.freeze({
            name: entry.name,
            value: readExactJson(path.join(rootPath, entry.name))
              .value as Record<string, unknown>,
          }),
        );
        continue;
      }
      throw new Error("docker_task_runtime_state_unknown_entry");
    }
    for (const journalRecoveryId of journalIntentRecoveryIds) {
      const parsedJournal = parseDockerTaskRecoveryId(journalRecoveryId);
      if (!parsedJournal || records.has(parsedJournal.operationNonce)) continue;
      const hasCleanupIntent = journalIntents.some(
        (intent) =>
          intent.recoveryId === journalRecoveryId &&
          intent.schema === "crdd-coordinator-recovery-cleanup-delete/v1",
      );
      if (hasCleanupIntent) {
        records.set(
          parsedJournal.operationNonce,
          Object.freeze({
            token: journalRecoveryId,
            stable: parsedJournal.stableLogicalHomeBindingHash,
            nonce: parsedJournal.operationNonce,
            cleanup: true,
          }),
        );
        continue;
      }
      addRecord(
        path.join(
          rootPath,
          `docker-task-${parsedJournal.operationNonce}`,
          "base.json",
        ),
        path.join(
          rootPath,
          `docker-task-${parsedJournal.operationNonce}`,
          "base-commit.json",
        ),
        parsedJournal.operationNonce,
        journalRecoveryId,
      );
    }
    const pendingNonces = new Set([...pendingBaseNames, ...pendingCommitNames]);
    for (const nonce of pendingNonces) {
      if (records.has(nonce)) continue;
      if (pendingBaseNames.has(nonce) && !pendingCommitNames.has(nonce)) {
        addPendingBaseOnlyRecord(
          path.join(rootPath, `pending-docker-task-${nonce}.json`),
          nonce,
        );
        continue;
      }
      if (!pendingBaseNames.has(nonce) || !pendingCommitNames.has(nonce))
        throw new Error("docker_task_runtime_state_pending_incomplete");
      addRecord(
        path.join(rootPath, `pending-docker-task-${nonce}.json`),
        path.join(rootPath, `pending-docker-task-${nonce}.commit.json`),
        nonce,
        recoveryIdForNonce(nonce),
      );
    }
    for (const record of records.values()) {
      if (record.cleanup) continue;
      for (const [expectation, present] of [
        [record.pendingBaseSource, pendingBaseNames.has(record.nonce)],
        [record.pendingCommitSource, pendingCommitNames.has(record.nonce)],
      ] as const) {
        if (
          (expectation === "required" && !present) ||
          (expectation === "absent" && present)
        )
          throw new Error("docker_task_runtime_state_base_invalid");
      }
    }
    for (const recoveryId of sessionHandoffRecoveryIds) {
      const parsed = parseDockerTaskRecoveryId(recoveryId);
      const record = parsed ? records.get(parsed.operationNonce) : null;
      const completion = inspectCompletedDockerRecoveryReceipt(
        rootPath,
        recoveryId,
      );
      if ((!record || record.token !== recoveryId) && !completion)
        throw new Error("docker_task_session_handoff_orphaned");
      const durableBinding = discoverRecoveryRuntimeStateBinding(
        rootPath,
        parsed as NonNullable<ReturnType<typeof parseDockerTaskRecoveryId>>,
      );
      if (!durableBinding)
        throw new Error("docker_task_session_handoff_invalid");
      inspectDockerTaskSessionHandoffs(rootPath, recoveryId, durableBinding);
    }
    const pointerTokens = new Set<string>();
    const activeStableLogicalHomeBindingHashes = new Set<string>();
    for (const pointerRecord of pointers) {
      const pointer = pointerRecord.value;
      const filenameHash = /^active-lease-([a-f0-9]{64})\.json$/u.exec(
        pointerRecord.name,
      )?.[1];
      if (
        !exactRecordKeys(pointer, [
          "schema",
          "stableLogicalHomeBindingHash",
          "operationName",
          "recoveryId",
          "baseHash",
        ]) ||
        pointer.schema !== "crdd-coordinator-provider-home-active-lease/v1" ||
        filenameHash !== pointer.stableLogicalHomeBindingHash ||
        typeof pointer.baseHash !== "string" ||
        typeof pointer.recoveryId !== "string" ||
        ![...records.values()].some(
          (record) =>
            record.token === pointer.recoveryId &&
            record.cleanup === false &&
            record.pointerEligible === true &&
            record.stable === pointer.stableLogicalHomeBindingHash &&
            `docker-task-${record.nonce}` === pointer.operationName &&
            record.token.endsWith(`.${pointer.baseHash}`),
        ) ||
        pointerTokens.has(pointer.recoveryId)
      )
        throw new Error("docker_task_runtime_state_orphan_pointer");
      pointerTokens.add(pointer.recoveryId);
      activeStableLogicalHomeBindingHashes.add(
        String(pointer.stableLogicalHomeBindingHash),
      );
    }
    for (const record of records.values()) {
      if (pointerTokens.has(record.token) || record.cleanup) continue;
      const pointer = discoverDockerRecoveryJournalJsonForRecovery(
        rootPath,
        `active-lease-${record.stable}.json`,
        record.token,
      );
      if (!pointer) continue;
      if (record.pointerEligible !== true)
        throw new Error("docker_task_runtime_state_orphan_pointer");
      const value = pointer.value as Record<string, unknown>;
      if (
        !exactRecordKeys(value, [
          "schema",
          "stableLogicalHomeBindingHash",
          "operationName",
          "recoveryId",
          "baseHash",
        ]) ||
        value.schema !== "crdd-coordinator-provider-home-active-lease/v1" ||
        value.recoveryId !== record.token ||
        value.stableLogicalHomeBindingHash !== record.stable ||
        value.operationName !== `docker-task-${record.nonce}` ||
        value.baseHash !== record.token.split(".")[3]
      )
        throw new Error("docker_task_runtime_state_orphan_pointer");
      pointerTokens.add(record.token);
      activeStableLogicalHomeBindingHashes.add(record.stable);
    }
    const recoveryIds = [...records.values()]
      .sort((left, right) => {
        const activeOrder =
          Number(pointerTokens.has(right.token)) -
          Number(pointerTokens.has(left.token));
        return activeOrder || left.token.localeCompare(right.token);
      })
      .map((record) => record.token);
    if (recoveryIds.length === 0) {
      return Object.freeze({
        status: "completed" as const,
        reason: "docker_task_runtime_state_clean",
        manualRecoveryRequired: false,
        dockerRecoveryId: null,
        dockerRecoveryIds: Object.freeze([]),
        activeStableLogicalHomeBindingHashes: Object.freeze([]),
      });
    }
    return Object.freeze({
      status: "completed" as const,
      reason:
        recoveryIds.length === 1
          ? "docker_task_recovery_inventory_available"
          : "docker_task_multiple_recovery_inventory_available",
      manualRecoveryRequired: true,
      dockerRecoveryId: recoveryIds.length === 1 ? recoveryIds[0] : null,
      dockerRecoveryIds: Object.freeze(recoveryIds),
      activeStableLogicalHomeBindingHashes: Object.freeze(
        [...activeStableLogicalHomeBindingHashes].sort(),
      ),
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_runtime_state_audit_failed",
      ),
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([]),
      activeStableLogicalHomeBindingHashes: Object.freeze([]),
    });
  }
}

/**
 * Docker 回復 Root Snapshot With Lockを観測する。
 *
 * @responsibility Docker 回復 Root Snapshot With Lockの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input root: VerifiedRuntimeStateRoot、acquireRuntimeStateLock: (runtimeStateBindingHash: string) => Readonly<{ release: () => boolean; }> | null
 * @returns inspectDockerRecoveryRootSnapshotWithLockの計算結果を返す。
 * @precondition 「root: VerifiedRuntimeStateRoot、acquireRuntimeStateLock: (runtimeStateBindingHash: string) => Readonly<{ release: () => boolean; }> | null」がinspectDockerRecoveryRootSnapshotWithLockの入力契約を満たす。
 * @postcondition inspectDockerRecoveryRootSnapshotWithLockの責務を完了した結果だけを返す。
 * @effect N/A: inspectDockerRecoveryRootSnapshotWithLockは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectDockerRecoveryRootSnapshotWithLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectDockerRecoveryRootSnapshotWithLockは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectDockerRecoveryRootSnapshotWithLockはProcess内の同一Subsystemで完結する。
 * @security inspectDockerRecoveryRootSnapshotWithLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectDockerRecoveryRootSnapshotWithLockは共有非同期状態を持たない同期処理である。
 */
export function inspectDockerRecoveryRootSnapshotWithLock(
  root: VerifiedRuntimeStateRoot,
  acquireRuntimeStateLock: (runtimeStateBindingHash: string) => Readonly<{
    release: () => boolean;
  }> | null = acquireRuntimeOwnedDockerRuntimeStateKernelLock,
) {
  try {
    const runtimeStateLock = acquireRuntimeStateLock(
      root.stableLogicalHomeBindingHash,
    );
    if (!runtimeStateLock)
      throw new Error("docker_task_runtime_state_generation_active_or_unknown");
    let result: ReturnType<typeof inspectDockerRecoveryRootSnapshot>;
    let released = false;
    try {
      result = inspectDockerRecoveryRootSnapshot(root.rootPath);
    } finally {
      try {
        released = runtimeStateLock.release();
      } catch {
        released = false;
      }
    }
    if (!released) {
      const verifiedRecoveryIds =
        result.status === "completed" ? result.dockerRecoveryIds : [];
      return Object.freeze({
        status: "blocked" as const,
        reason: "docker_task_runtime_state_lock_release_unconfirmed",
        manualRecoveryRequired: true,
        dockerRecoveryId:
          verifiedRecoveryIds.length === 1 ? verifiedRecoveryIds[0] : null,
        dockerRecoveryIds: Object.freeze([...verifiedRecoveryIds]),
        activeStableLogicalHomeBindingHashes:
          result.status === "completed"
            ? result.activeStableLogicalHomeBindingHashes
            : Object.freeze([]),
      });
    }
    return result;
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_runtime_state_audit_failed",
      ),
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([]),
      activeStableLogicalHomeBindingHashes: Object.freeze([]),
    });
  }
}

/**
 * Runtime 所有 Docker Task 回復 状態を観測する。
 *
 * @responsibility Runtime 所有 Docker Task 回復 状態の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input developmentContext: unknown
 * @returns inspectRuntimeOwnedDockerTaskRecoveryStateの計算結果を返す。
 * @precondition 「developmentContext: unknown」がinspectRuntimeOwnedDockerTaskRecoveryStateの入力契約を満たす。
 * @postcondition inspectRuntimeOwnedDockerTaskRecoveryStateの責務を完了した結果だけを返す。
 * @effect N/A: inspectRuntimeOwnedDockerTaskRecoveryStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectRuntimeOwnedDockerTaskRecoveryStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectRuntimeOwnedDockerTaskRecoveryStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRuntimeOwnedDockerTaskRecoveryStateはProcess内の同一Subsystemで完結する。
 * @security inspectRuntimeOwnedDockerTaskRecoveryStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRuntimeOwnedDockerTaskRecoveryStateは共有非同期状態を持たない同期処理である。
 */
export function inspectRuntimeOwnedDockerTaskRecoveryState(
  developmentContext?: unknown,
) {
  try {
    const observation = inspectRuntimeOwnedWindowsRuntimeState(
      true,
      new Date().toISOString(),
      developmentContext,
    );
    const root = consumeRuntimeOwnedRuntimeStateRootCapability(
      observation.rootCapability,
    );
    if (observation.status !== "candidate" || !root)
      return Object.freeze({
        status: "blocked" as const,
        reason: "docker_task_runtime_state_unavailable",
        manualRecoveryRequired: true,
        dockerRecoveryId: null,
        dockerRecoveryIds: Object.freeze([]),
        activeStableLogicalHomeBindingHashes: Object.freeze([]),
      });
    return inspectDockerRecoveryRootSnapshotWithLock(root);
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_runtime_state_audit_failed",
      ),
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([]),
      activeStableLogicalHomeBindingHashes: Object.freeze([]),
    });
  }
}

/**
 * Resolve Project-owned correlation identities to exact Runtime-owned Docker
 *
 * @responsibility Runtime 所有 Docker Task 回復 Correlations From Verified Root With Observerの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input correlationIds: readonly string[]、root: VerifiedRuntimeStateRoot、observeRuntimeStateRoot: () => VerifiedRuntimeStateRoot | null
 * @returns resolveRuntimeOwnedDockerTaskRecoveryCorrelationsFromVerifiedRootWithObserverの計算結果を返す。
 * @precondition 「correlationIds: readonly string[]、root: VerifiedRuntimeStateRoot、observeRuntimeStateRoot: () => VerifiedRuntimeStateRoot | null」がresolveRuntimeOwnedDockerTaskRecoveryCorrelationsFromVerifiedRootWithObserverの入力契約を満たす。
 * @postcondition resolveRuntimeOwnedDockerTaskRecoveryCorrelationsFromVerifiedRootWithObserverの責務を完了した結果だけを返す。
 * @effect N/A: resolveRuntimeOwnedDockerTaskRecoveryCorrelationsFromVerifiedRootWithObserverは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure resolveRuntimeOwnedDockerTaskRecoveryCorrelationsFromVerifiedRootWithObserverは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveRuntimeOwnedDockerTaskRecoveryCorrelationsFromVerifiedRootWithObserverは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRuntimeOwnedDockerTaskRecoveryCorrelationsFromVerifiedRootWithObserverはProcess内の同一Subsystemで完結する。
 * @security resolveRuntimeOwnedDockerTaskRecoveryCorrelationsFromVerifiedRootWithObserverはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRuntimeOwnedDockerTaskRecoveryCorrelationsFromVerifiedRootWithObserverは共有非同期状態を持たない同期処理である。
 */
export function resolveRuntimeOwnedDockerTaskRecoveryCorrelationsFromVerifiedRootWithObserver(
  correlationIds: readonly string[],
  root: VerifiedRuntimeStateRoot,
  observeRuntimeStateRoot: () => VerifiedRuntimeStateRoot | null = () => root,
) {
  let release: (() => boolean) | null = null;
  try {
    if (
      !Array.isArray(correlationIds) ||
      correlationIds.length === 0 ||
      correlationIds.length > 5 ||
      new Set(correlationIds).size !== correlationIds.length ||
      correlationIds.some(
        (id) =>
          typeof id !== "string" ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(id),
      )
    )
      throw new Error("docker_task_recovery_correlation_input_invalid");
    const lock = acquireRuntimeOwnedDockerRuntimeStateKernelLock(
      root.stableLogicalHomeBindingHash,
    );
    if (!lock)
      throw new Error("docker_task_runtime_state_generation_active_or_unknown");
    release = lock.release;
    const observedRoot = observeRuntimeStateRoot();
    if (
      !observedRoot ||
      observedRoot.rootPath !== root.rootPath ||
      observedRoot.runtimeStateIdentityHash !== root.runtimeStateIdentityHash ||
      observedRoot.runtimeStateProtectionHash !==
        root.runtimeStateProtectionHash ||
      observedRoot.localUserBindingHash !== root.localUserBindingHash ||
      observedRoot.stableLogicalHomeBindingHash !==
        root.stableLogicalHomeBindingHash
    )
      throw new Error("docker_task_runtime_state_binding_changed");
    const inventory = inspectDockerRecoveryRootSnapshot(root.rootPath);
    if (inventory.status !== "completed")
      throw new Error("docker_task_runtime_state_audit_failed");
    const matches = new Map<string, string>();
    for (const recoveryId of inventory.dockerRecoveryIds) {
      const parsed = parseDockerTaskRecoveryId(recoveryId);
      if (!parsed) throw new Error("docker_task_recovery_identity_invalid");
      const operationBase = path.join(
        root.rootPath,
        `docker-task-${parsed.operationNonce}`,
        "base.json",
      );
      const operationCommit = path.join(
        root.rootPath,
        `docker-task-${parsed.operationNonce}`,
        "base-commit.json",
      );
      const pendingBase = path.join(
        root.rootPath,
        `pending-docker-task-${parsed.operationNonce}.json`,
      );
      const pendingCommit = path.join(
        root.rootPath,
        `pending-docker-task-${parsed.operationNonce}.commit.json`,
      );
      let baseRecord:
        | ReturnType<typeof readCommittedDockerRecoveryJson>
        | ReturnType<typeof discoverDockerRecoveryJournalJsonForRecovery>
        | null = null;
      for (const candidate of [operationBase, pendingBase]) {
        if (!recoveryPathPresent(candidate)) continue;
        try {
          baseRecord = readCommittedDockerRecoveryJson(candidate, "base.json");
          break;
        } catch {}
      }
      baseRecord ??= discoverDockerRecoveryJournalJsonForRecovery(
        root.rootPath,
        "base.json",
        parsed.token,
      );
      if (
        !baseRecord ||
        baseRecord.hash !== parsed.baseHash ||
        !validateDockerRecoveryBase(baseRecord.value, parsed.operationNonce)
      )
        throw new Error("docker_task_recovery_base_mismatch");
      let commitRecord:
        | ReturnType<typeof readCommittedDockerRecoveryJson>
        | ReturnType<typeof discoverDockerRecoveryJournalJsonForRecovery>
        | null = null;
      for (const candidate of [operationCommit, pendingCommit]) {
        if (!recoveryPathPresent(candidate)) continue;
        try {
          commitRecord = readCommittedDockerRecoveryJson(
            candidate,
            "base-commit.json",
          );
          break;
        } catch {}
      }
      commitRecord ??= discoverDockerRecoveryJournalJsonForRecovery(
        root.rootPath,
        "base-commit.json",
        parsed.token,
      );
      if (
        commitRecord &&
        !validateDockerRecoveryBaseCommit(
          commitRecord.value,
          parsed.operationNonce,
          parsed.baseHash,
          parsed.token,
        )
      )
        throw new Error("docker_task_recovery_base_commit_mismatch");
      const correlationId =
        (baseRecord.value as Record<string, unknown>).recoveryCorrelationId ??
        (commitRecord?.value as Record<string, unknown> | undefined)
          ?.recoveryCorrelationId;
      if (typeof correlationId !== "string") continue;
      if (!correlationIds.includes(correlationId)) continue;
      if (matches.has(correlationId))
        throw new Error("docker_task_recovery_correlation_ambiguous");
      matches.set(correlationId, recoveryId);
    }
    const bindings = correlationIds
      .filter((correlationId) => matches.has(correlationId))
      .map((correlationId) =>
        Object.freeze({
          correlationId,
          recoveryId: matches.get(correlationId) as string,
        }),
      );
    const absentCorrelationIds = correlationIds.filter(
      (correlationId) => !matches.has(correlationId),
    );
    if (!release())
      throw new Error("docker_task_runtime_state_lock_release_unknown");
    release = null;
    return Object.freeze({
      status: "completed" as const,
      bindings: Object.freeze(bindings),
      absentCorrelationIds: Object.freeze(absentCorrelationIds),
    });
  } catch (error) {
    let released = true;
    if (release) {
      try {
        released = release();
      } catch {
        released = false;
      }
    }
    return Object.freeze({
      status: "blocked" as const,
      reason: released
        ? safeRecoveryReason(error, "docker_task_recovery_correlation_failed")
        : "docker_task_runtime_state_lock_release_unknown",
      manualRecoveryRequired: true,
      bindings: Object.freeze([]),
      absentCorrelationIds: Object.freeze([]),
    });
  }
}

/**
 * Runtime 所有 Docker Task 回復 Correlationsを一意に解決する。
 *
 * @responsibility Runtime 所有 Docker Task 回復 Correlationsの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input correlationIds: readonly string[]、developmentContext: unknown
 * @returns resolveRuntimeOwnedDockerTaskRecoveryCorrelationsの計算結果を返す。
 * @precondition 「correlationIds: readonly string[]、developmentContext: unknown」がresolveRuntimeOwnedDockerTaskRecoveryCorrelationsの入力契約を満たす。
 * @postcondition resolveRuntimeOwnedDockerTaskRecoveryCorrelationsの責務を完了した結果だけを返す。
 * @effect N/A: resolveRuntimeOwnedDockerTaskRecoveryCorrelationsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure resolveRuntimeOwnedDockerTaskRecoveryCorrelationsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveRuntimeOwnedDockerTaskRecoveryCorrelationsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRuntimeOwnedDockerTaskRecoveryCorrelationsはProcess内の同一Subsystemで完結する。
 * @security resolveRuntimeOwnedDockerTaskRecoveryCorrelationsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRuntimeOwnedDockerTaskRecoveryCorrelationsは共有非同期状態を持たない同期処理である。
 */
export function resolveRuntimeOwnedDockerTaskRecoveryCorrelations(
  correlationIds: readonly string[],
  developmentContext?: unknown,
) {
  try {
    const observation = inspectRuntimeOwnedWindowsRuntimeState(
      true,
      new Date().toISOString(),
      developmentContext,
    );
    const root = consumeRuntimeOwnedRuntimeStateRootCapability(
      observation.rootCapability,
    );
    if (observation.status !== "candidate" || !root)
      throw new Error("docker_task_runtime_state_unavailable");
    return resolveRuntimeOwnedDockerTaskRecoveryCorrelationsFromVerifiedRootWithObserver(
      correlationIds,
      root,
      () => observeRuntimeStateRootFromWindows(developmentContext),
    );
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_recovery_correlation_failed",
      ),
      manualRecoveryRequired: true,
      bindings: Object.freeze([]),
      absentCorrelationIds: Object.freeze([]),
    });
  }
}

/**
 * docker-recovery-runtime-internalで使用する回復 記録の値契約を定義する。
 *
 * @responsibility 回復 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RecoveryRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RecoveryRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: RecoveryRecordの宣言は外部境界を開かない。
 * @security RecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RecoveryRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RecoveryRecord = Readonly<{
  managementCapability: object;
  operationId: string;
  recoveryId: string;
}>;
/**
 * docker-recovery-runtime-internalで使用するRuntime Dependenciesの値契約を定義する。
 *
 * @responsibility Runtime DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDependenciesの宣言は外部境界を開かない。
 * @security RuntimeDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeDependencies = Readonly<{
  verifyOperation: (
    managementCapability: unknown,
  ) => Readonly<{ operationId: string }>;
  beginDurableRecovery: (
    managementCapability: unknown,
    operationId: unknown,
  ) => string;
  completeDurableRecovery: (
    managementCapability: unknown,
    recoveryId: unknown,
  ) => string;
}>;
/**
 * docker-recovery-runtime-internalで使用するRuntime 状態の値契約を定義する。
 *
 * @responsibility Runtime 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeStateの宣言は外部境界を開かない。
 * @security RuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeState = Readonly<{
  dependencies: RuntimeDependencies;
  records: WeakMap<object, RecoveryRecord>;
}>;

/**
 * Runtime 状態を構築する。
 *
 * @responsibility Runtime 状態の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RuntimeDependencies
 * @returns RuntimeStateを返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateRuntimeStateの入力契約を満たす。
 * @postcondition createRuntimeStateの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createRuntimeStateは独自の失敗分岐を所有しない。
 * @invariant createRuntimeStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRuntimeStateはProcess内の同一Subsystemで完結する。
 * @security createRuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createRuntimeStateは共有非同期状態を持たない同期処理である。
 */
function createRuntimeState(dependencies: RuntimeDependencies): RuntimeState {
  return Object.freeze({
    dependencies: Object.freeze(dependencies),
    records: new WeakMap(),
  });
}

/**
 * 回復を開始する。
 *
 * @responsibility 回復の開始条件、初期状態、開始失敗境界を所有する。
 * @trace ARCH-000008
 * @input state: RuntimeState、plan: Readonly<{ operationId: string }>、managementCapability: unknown
 * @returns beginRecoveryの計算結果を返す。
 * @precondition 「state: RuntimeState、plan: Readonly<{ operationId: string }>、managementCapability: unknown」がbeginRecoveryの入力契約を満たす。
 * @postcondition beginRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: beginRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: beginRecoveryは独自の失敗分岐を所有しない。
 * @invariant beginRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: beginRecoveryはProcess内の同一Subsystemで完結する。
 * @security beginRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: beginRecoveryは共有非同期状態を持たない同期処理である。
 */
function beginRecovery(
  state: RuntimeState,
  plan: Readonly<{ operationId: string }>,
  managementCapability: unknown,
) {
  if (
    !managementCapability ||
    typeof managementCapability !== "object" ||
    !/^OP-[0-9]{6,}$/u.test(plan.operationId)
  ) {
    return null;
  }
  const operation = state.dependencies.verifyOperation(managementCapability);
  if (operation.operationId !== plan.operationId) return null;
  const recoveryId = state.dependencies.beginDurableRecovery(
    managementCapability,
    operation.operationId,
  );
  parseHostRecoveryToken(recoveryId);
  const recoveryCapability = Object.freeze({});
  state.records.set(
    recoveryCapability,
    Object.freeze({
      managementCapability,
      operationId: operation.operationId,
      recoveryId,
    }),
  );
  return Object.freeze({ recoveryId, recoveryCapability });
}

/**
 * 回復を完了状態へ遷移させる。
 *
 * @responsibility 回復の完了条件、終了後状態、未完了境界を所有する。
 * @trace ARCH-000008
 * @input state: RuntimeState、recoveryCapability: unknown、managementCapability: unknown
 * @returns completeRecoveryの計算結果を返す。
 * @precondition 「state: RuntimeState、recoveryCapability: unknown、managementCapability: unknown」がcompleteRecoveryの入力契約を満たす。
 * @postcondition completeRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: completeRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: completeRecoveryは独自の失敗分岐を所有しない。
 * @invariant completeRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: completeRecoveryはProcess内の同一Subsystemで完結する。
 * @security completeRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: completeRecoveryは共有非同期状態を持たない同期処理である。
 */
function completeRecovery(
  state: RuntimeState,
  recoveryCapability: unknown,
  managementCapability: unknown,
) {
  if (!recoveryCapability || typeof recoveryCapability !== "object") {
    return Object.freeze({ status: "blocked" as const });
  }
  const record = state.records.get(recoveryCapability);
  if (!record || record.managementCapability !== managementCapability) {
    return Object.freeze({ status: "blocked" as const });
  }
  const operation = state.dependencies.verifyOperation(managementCapability);
  if (operation.operationId !== record.operationId) {
    return Object.freeze({ status: "blocked" as const });
  }
  const completedRecoveryId = state.dependencies.completeDurableRecovery(
    managementCapability,
    record.recoveryId,
  );
  parseHostRecoveryToken(completedRecoveryId);
  if (completedRecoveryId === record.recoveryId) {
    return Object.freeze({ status: "blocked" as const });
  }
  state.records.delete(recoveryCapability);
  return Object.freeze({ status: "completed" as const });
}

/**
 * Runtime 所有 Docker 回復を開始する。
 *
 * @responsibility Runtime 所有 Docker 回復の開始条件、初期状態、開始失敗境界を所有する。
 * @trace ARCH-000008
 * @input plan: ProductionPlan、managementCapability: unknown
 * @returns beginRuntimeOwnedDockerRecoveryの計算結果を返す。
 * @precondition 「plan: ProductionPlan、managementCapability: unknown」がbeginRuntimeOwnedDockerRecoveryの入力契約を満たす。
 * @postcondition beginRuntimeOwnedDockerRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: beginRuntimeOwnedDockerRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure beginRuntimeOwnedDockerRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant beginRuntimeOwnedDockerRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: beginRuntimeOwnedDockerRecoveryはProcess内の同一Subsystemで完結する。
 * @security beginRuntimeOwnedDockerRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: beginRuntimeOwnedDockerRecoveryは共有非同期状態を持たない同期処理である。
 */
export function beginRuntimeOwnedDockerRecovery(
  plan: ProductionPlan,
  managementCapability: unknown,
) {
  try {
    return beginProductionRecovery(plan, managementCapability);
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_recovery_begin_failed_closed",
      ),
      recoveryId: null,
      manualRecoveryRequired: true,
    });
  }
}

/**
 * 本番Controllerの元清掃結果を実Host復帰へ委譲する。
 * @responsibility 本番Controllerの元清掃結果を実Host復帰へ委譲する。
 * @trace ARCH-000008
 * @input recoveryCapability、managementCapability: 元Owner。completion: 元計画と清掃結果。
 * @returns 実Host復帰・Lease解放の結果。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 通常復帰Ownerへ限定委譲する。
 * @failure 元結果欠落・例外は停止。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function completeRuntimeOwnedDockerRecovery(
  recoveryCapability: unknown,
  managementCapability: unknown,
  completion: unknown,
) {
  try {
    return completeProductionRecovery(
      recoveryCapability,
      managementCapability,
      completion,
    );
  } catch {
    return Object.freeze({ status: "blocked" as const });
  }
}

/**
 * Isolated Docker 回復 Runtime 候補を構築する。
 *
 * @responsibility Isolated Docker 回復 Runtime 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RuntimeDependencies
 * @returns createIsolatedDockerRecoveryRuntimeCandidateの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateIsolatedDockerRecoveryRuntimeCandidateの入力契約を満たす。
 * @postcondition createIsolatedDockerRecoveryRuntimeCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedDockerRecoveryRuntimeCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createIsolatedDockerRecoveryRuntimeCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createIsolatedDockerRecoveryRuntimeCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedDockerRecoveryRuntimeCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedDockerRecoveryRuntimeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedDockerRecoveryRuntimeCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedDockerRecoveryRuntimeCandidate(
  dependencies: RuntimeDependencies,
) {
  const state = createRuntimeState(dependencies);
  return Object.freeze({
    productionAuthority: false as const,
    begin: (
      plan: Readonly<{ operationId: string }>,
      managementCapability: unknown,
    ) => {
      try {
        return beginRecovery(state, plan, managementCapability);
      } catch {
        return null;
      }
    },
    complete: (recoveryCapability: unknown, managementCapability: unknown) => {
      try {
        return completeRecovery(
          state,
          recoveryCapability,
          managementCapability,
        );
      } catch {
        return Object.freeze({ status: "blocked" as const });
      }
    },
  });
}

/**
 * Docker 回復 Runtime 契約の公開契約を記述する。
 *
 * @responsibility Docker 回復 Runtime 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeDockerRecoveryRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeDockerRecoveryRuntimeContractの入力契約を満たす。
 * @postcondition describeDockerRecoveryRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeDockerRecoveryRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeDockerRecoveryRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeDockerRecoveryRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeDockerRecoveryRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeDockerRecoveryRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeDockerRecoveryRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeDockerRecoveryRuntimeContract() {
  return Object.freeze({
    contract: DOCKER_RECOVERY_RUNTIME_CONTRACT,
    contractRevision: DOCKER_RECOVERY_RUNTIME_CONTRACT_REVISION,
    durableStateBeforeDockerEffect: "docker_submission_started",
    durableStateAfterCleanup: "host_only",
    capability: "opaque_process_local_single_completion",
    crashRecovery: "durable_recovery_id_returned_for_manual_recovery",
    runtimeStateRoot:
      "selected_user_runtime_owned_fixed_known_folder_protected_root",
    runtimeStateRevalidation:
      "native_root_identity_protection_and_selected_user_observed_outside_the_runtime_state_lock_then_same_root_filesystem_identity_and_full_inventory_verified_after_reacquisition_before_each_mutation_and_after_effect",
    runtimeStateCreationBinding:
      "base_cleanup_manifest_and_root_cleanup_anchor_bind_creation_identity_protection_selected_user_and_runtime_state_hash",
    logicalHomeLease:
      "stable_sid_provider_namespace_kernel_lock_and_durable_active_pointer",
    resourceJournal:
      "file_fsync_base_commit_pointer_identity_host_active_binding_then_exact_docker_id_receipt",
    rootJournalResume:
      "exact_recovery_id_and_creation_binding_with_non_target_byte_identity_preservation",
    completionEvidence:
      "exact_durable_evidence_required_and_empty_root_is_not_a_receipt",
    offlineRecovery:
      "receipt_missing_empty_observation_remains_manual_discovered_exact_id_requires_full_configuration_and_durable_reconciled_receipt_before_removal",
    hostFinalization:
      "host_generation_owner_and_inventory_then_cleanup_intent_receipt_and_exact_removal",
    synchronizationRelease:
      "runtime_state_home_and_host_generation_release_confirmed_before_success",
    productionFacade:
      "native_observation_only_with_internal_contract_engine_excluded_by_package_exports",
    cleanupRequiredBeforeCompletion: true,
    callerRecoveryIdAccepted: false,
    providerEffectAllowed: false,
  });
}
