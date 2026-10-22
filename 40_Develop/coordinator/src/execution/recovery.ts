/**
 * Taskの回復状態・元版・排他・受領と終了を管理する。
 *
 * @responsibility 現在状態の保存とHost／Home相関を所有し、技術観測と回収はDIへ委譲する。
 * @trace ARCH-000008
 */
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { setImmediate as yieldRecoveryEvents } from "node:timers/promises";
import { types as utilTypes } from "node:util";
import { codexAdviceProviderInitRequired } from "../../../docker-isolation/src/index.ts";
import {
  type createDockerResourceRecoveryExecutor,
  planDockerRecoveryResourceExpectations,
  dockerIsolationResourceIdentityIsValid,
  createDockerTaskRecoveryExecutor,
  isDockerResourcePurpose,
  type restartDockerRuntime,
} from "../../../docker-isolation/src/index.ts";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
import {
  acquireRuntimeOwnedDockerRuntimeStateKernelLock,
  acquireRuntimeOwnedHostOperationKernelLock,
  acquireRuntimeOwnedLogicalProviderHomeKernelLock,
} from "./kernel-lock.ts";
import {
  acquireHostOperationRecoveryGenerationByIdentity,
  borrowOwnedHostRecoverySnapshot,
  confirmOwnedDockerAbsenceForRecovery,
  consumeOwnedHostRecoveryIdForCleanup,
  issueOwnedHostCleanupCapability,
  recoverOwnedOperationDirectories,
  releaseHostOperationRecoveryGeneration,
  verifyOwnedOperationManagementCapability,
  verifyHostOperationRecoveryGeneration,
  acquireHostOperationRecoveryGeneration,
  borrowHostRecoveryManagementDirectory,
} from "./operation.ts";
import {
  loadHostRecoveryRecordByToken,
  observeHostRecoveryCleanup,
  parseHostRecoveryToken,
  validateHostRecoveryTransitionLineage,
} from "./host-recovery-record.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import {
  consumeRuntimeOwnedProviderHomeObservationCapability,
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
} from "./provider-home-windows-adapter.ts";
import {
  borrowRuntimeOwnedCoordinatorStateRepository,
  borrowRuntimeOwnedCoordinatorRecoveryRepository,
} from "./repository-binding.ts";
import {
  coordinatorConsumerCompletionPolicy,
  decodeCoordinatorStateSnapshot,
  type CoordinatorStateOperation,
  type CoordinatorStateTaskOperation,
  type CoordinatorStateSnapshot,
  encodeCoordinatorStateValue,
  prepareCoordinatorStateHostSnapshot,
  prepareCoordinatorStateOperationSnapshot,
  coordinatorTaskResourcesAreSettled,
  coordinatorReleasedTaskCanObserveHostAbsence,
  coordinatorAuthenticationUnknownCanClose,
} from "../storage/model.ts";
import {
  acceptRuntimeOwnedCoordinatorProjectResult,
  bindRuntimeOwnedCoordinatorProjectAcceptanceReader,
  captureRuntimeOwnedCoordinatorSettlementInputs,
  checkpointRuntimeOwnedCoordinatorCleanup,
  checkpointRuntimeOwnedCoordinatorLifecycle,
  checkpointRuntimeOwnedCoordinatorResource,
  checkpointRuntimeOwnedCoordinatorResourceNotIssued,
  completeRuntimeOwnedCoordinatorSettlement,
  completeRuntimeOwnedCoordinatorCurrentRecovery,
  readRuntimeOwnedCoordinatorCurrentCompletionSnapshot,
  prepareRuntimeOwnedCoordinatorSettlement,
  readRuntimeOwnedCoordinatorResourceRequests,
  readRuntimeOwnedCoordinatorSettlementResult,
  readRuntimeOwnedCoordinatorStateSnapshot,
  readRuntimeOwnedCoordinatorRecoverySnapshot,
  readRuntimeOwnedCoordinatorResourcePublicationSnapshot,
  resumeRuntimeOwnedCoordinatorResourcePublication,
  readRuntimeOwnedCoordinatorAdmissionSnapshot,
  readRuntimeOwnedCoordinatorCurrentHistorySnapshot,
  readRuntimeOwnedCoordinatorCurrentDeliverySnapshot,
  registerRuntimeOwnedCoordinatorRecoveryResultDelivery,
  advanceRuntimeOwnedCoordinatorRecoveryHistory,
  readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot,
  writeRuntimeOwnedCoordinatorRestartCheckpoint,
  writeRuntimeOwnedCoordinatorRecoveryTerminal,
  writeRuntimeOwnedCoordinatorRecoveryCheckpoint,
  writeRuntimeOwnedCoordinatorRecoveredHostCleanup,
  writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure,
  saveRuntimeOwnedCoordinatorOperationStart,
  settleRuntimeOwnedCoordinatorResult,
  writeRuntimeOwnedCoordinatorStateSnapshot,
} from "../storage/settlement-store.ts";
import {
  createDockerRestartRequestId,
  type DockerRestartCheckpoint,
  isDockerRestartCheckpointSettled,
} from "./restart-checkpoint.ts";
import { inspectRuntimeOwnedDevelopmentOperationContext } from "./development-measurement-session.ts";
import {
  beginRuntimeOwnedCoordinatorHostSubmission,
  completeRuntimeOwnedCoordinatorHostSubmission,
} from "./host-submission.ts";
import { verifyRuntimeOwnedDockerProviderSubmissionNotice } from "./provider-observation.ts";
import { parseDockerTaskRecoveryId } from "../../../docker-isolation/src/index.ts";

/**
 * 検証済みRepositoryの現在記録からHost／Probe回復先を解決する。
 * @responsibility exact参照、単一一致、Readerの排他解放を照合する。
 * @trace ARCH-000008
 * @input recoveryId: 明示回復参照、repositoryRoot: 呼出し元が検証したRoot Capability。
 * @returns 対応する操作Root、またはnull。
 * @precondition 現在Repositoryの検証済みCapabilityを渡す。
 * @postcondition 欠測・複数一致・読取り不明ではRootを返さない。
 * @effect 既存の現在状態Readerと短期排他だけを使用する。
 * @failure 不正参照・Reader拒否・例外・解放不明ではnull。
 * @invariant Pathは処置Authorityではなく、下位が元世代と実体を再照合する。
 * @boundary 現在状態とHost／Probe回復対象の解決。
 * @security cwd再解決・広域探索・新しい回復Authorityを行わない。
 * @concurrency fresh Readerの排他解放後に所在を返す。
 */
export function resolveRuntimeOwnedCurrentRecoveryOperationRoot(
  recoveryId: string,
  repositoryRoot: unknown,
): string | null {
  try {
    const match =
      /^(host|docker)\.(crdd-coordinator-doctor-[A-Za-z0-9_-]+)\./u.exec(
        recoveryId,
      );
    if (!match?.[2]) return null;
    const current = readRuntimeOwnedCoordinatorRecoverySnapshot(repositoryRoot);
    if (
      current.status !== "completed" ||
      !current.lockReleased ||
      !current.value
    )
      return null;
    const matches = current.value.snapshot.operations.filter((operation) => {
      if (operation.kind !== "docker_task") return false;
      const identity = JSON.parse(operation.identityJson);
      return (
        typeof identity.hostPaths.root === "string" &&
        path.isAbsolute(identity.hostPaths.root) &&
        path.basename(identity.hostPaths.root) === match[2] &&
        (match[1] === "host"
          ? operation.host.currentToken === recoveryId
          : identity.operationMode === "boolean_probe")
      );
    });
    if (matches.length !== 1 || !matches[0]) return null;
    return JSON.parse(matches[0].identityJson).hostPaths.root;
  } catch {
    return null;
  }
}

/**
 * 現在Repositoryの状態をTask入場前に観測する。
 * @responsibility 安定した読取りと初回不存在だけを入場可へ投影する。
 * @trace ARCH-000008
 * @input repositoryRoot: 同じTaskまたは診断が検査するRoot。
 * @returns 入場可否、固定理由、排他解放の観測だけ。
 * @precondition 操作間の衝突は後続beginが実Homeに対して判定する。
 * @postcondition 未解決や配送を含む安定Snapshotを全域拒否しない。
 * @effect Root検証と現在状態Readerによる読取りだけ。
 * @failure Root不正、部分保存、観測不能、解放不明はblocked。
 * @invariant 入場可能から初期化資格・処置許可・資源不存在を推定しない。
 * @boundary Task／診断入口とRepository-local現在状態。
 * @security Snapshot、内部ID、Home Hash、生Pathを返さない。
 * @concurrency Kernel解放確認後にだけavailableを返す。
 */
export function inspectRuntimeOwnedDockerTaskAdmission(
  repositoryRoot: unknown,
) {
  let lockReleased = false;
  try {
    const root = verifyRepositoryRoot(repositoryRoot);
    if (root.status !== "completed")
      return Object.freeze({
        status: "blocked" as const,
        reason: "coordinator_current_admission_unconfirmed" as const,
        lockReleased: true,
      });
    const observed = readRuntimeOwnedCoordinatorAdmissionSnapshot(
      root.capability,
    );
    lockReleased = observed.lockReleased;
    if (
      lockReleased &&
      ((observed.status === "completed" && observed.value !== null) ||
        (observed.status === "blocked" &&
          observed.reason === "coordinator_state_uninitialized"))
    )
      return Object.freeze({
        status: "available" as const,
        reason: "coordinator_current_admission_available" as const,
        lockReleased: true as const,
      });
  } catch {
    // 未観測は入場可へ変換しない。
  }
  return Object.freeze({
    status: "blocked" as const,
    reason: "coordinator_current_admission_unconfirmed" as const,
    lockReleased,
  });
}

/**
 * canonicalを決定する。
 *
 * @responsibility canonicalの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns canonicalの計算結果を返す。
 * @precondition 「value: unknown」がcanonicalの入力契約を満たす。
 * @postcondition canonicalの責務を完了した結果だけを返す。
 * @effect N/A: canonicalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: canonicalは独自の失敗分岐を所有しない。
 * @invariant canonicalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalはProcess内の同一Subsystemで完結する。
 * @security canonicalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalは共有非同期状態を持たない同期処理である。
 */
function canonical(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

const HEX64 = /^[a-f0-9]{64}$/u;
const CREATE_PURPOSES = new Set([
  "create_subscription_auth_probe",
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "create_provider",
]);

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
  workspaceProtection?: Readonly<{
    gitSourcePath: string;
    internalSourcePath: string;
  }>;
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
  kind: "restart";
  repository: NonNullable<
    ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
  > & { operationId: string };
  rootCapability: unknown;
  recoveryId: string;
  requestId: string;
  scopeSha256: string;
  recoveryIds: readonly string[];
  locks: readonly Readonly<{
    assertLive: () => boolean;
    release: () => boolean;
  }>[];
}> & {
  closed: boolean;
  persistenceFailed: boolean;
  cleanupUnknown: boolean;
  releaseAttempted: boolean;
  releaseConfirmed: boolean;
  finalizationAttempted: boolean;
  before: Buffer;
  checkpoint: DockerRestartCheckpoint | null;
};
/**
 * 現在操作の回収だけに限定した短命Owner。
 * @responsibility 元Repository・操作・Host世代・保持排他と元本文を共同保持する。
 * @trace ARCH-000008
 * @shape 回復種別、固定結合、Host marker、取得済み排他と保存失効状態。
 * @invariant 元management、署名Root、旧Journalを復元しない。
 * @boundary 現在状態Readerと既存Host／Home／Runtime排他。
 * @security 保存値だけでOwnerを生成せず、公開Rootへ内部値を出さない。
 * @compatibility 最新Schemaだけを扱う。
 */
type DockerTaskRecoveryPreparation = {
  kind: "recovery";
  repository: DockerRestartPreparation["repository"];
  rootCapability: unknown;
  recoveryId: string;
  hostGeneration: object;
  hostRoot: string;
  hostToken: string;
  hostNonce: string;
  locks: DockerRestartPreparation["locks"];
  before: Buffer;
  closed: boolean;
  persistenceFailed: boolean;
  cleanupUnknown: boolean;
  releaseAttempted: boolean;
  releaseConfirmed: boolean;
  finalizationAttempted: boolean;
  completionAttempted: boolean;
  completionPending: boolean;
  hostCleanup: "present" | "absent" | "unknown";
  hostCleanupPublication: ReturnType<
    typeof readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot
  >["hostCleanupPublication"];
};
const dockerRecoveryPreparations = new WeakMap<
  object,
  DockerRestartPreparation | DockerTaskRecoveryPreparation
>();

/**
 * 回収Ownerの保持状態と同じHost markerを再確認する。
 * @responsibility 私有Mapの真正性、既存排他、RepositoryとHost世代を共同確認する。
 * @trace ARCH-000008
 * @input capability: 私有準備キー、record: 同キーの回復結合。
 * @returns 同じ生存Ownerの場合だけtrue。
 * @precondition 元版照合は呼出し側のReaderとWriterが別に行う。
 * @postcondition markerや排他欠測から書込み可能と推定しない。
 * @effect Repository・Host marker・既存排他の読取りのみ。
 * @failure 不一致、失効、例外はfalse。
 * @invariant 元managementや旧Journalを復元しない。
 * @boundary 同一Processの回収OwnerとHost／Repository観測。
 * @security 私有Mapへの結合なしに任意callbackを受理しない。
 * @concurrency 各Writer直前とWriter内部で再確認する。
 */
function assertCurrentRecoveryOwner(
  capability: object,
  record: DockerTaskRecoveryPreparation,
): boolean {
  try {
    if (
      dockerRecoveryPreparations.get(capability) !== record ||
      record.closed ||
      !record.repository.revalidate()
    )
      return false;
    try {
      for (const lock of record.locks) {
        if (lock.assertLive() !== true) {
          record.cleanupUnknown = true;
          return false;
        }
      }
      verifyHostOperationRecoveryGeneration(
        record.hostGeneration,
        record.hostRoot,
        record.hostNonce,
      );
    } catch {
      record.cleanupUnknown = true;
      return false;
    }
    if (record.hostCleanup === "unknown") return false;
    if (record.hostCleanup === "absent") {
      const observed = observeHostRecoveryCleanup(
        record.hostToken,
        record.hostRoot,
      );
      return observed.root === "absent" && observed.marker === "absent";
    }
    const loaded = loadHostRecoveryRecordByToken(
      record.hostToken,
      record.hostRoot,
    );
    return loaded.parsed.nonce === record.hostNonce;
  } catch {
    return false;
  }
}

/**
 * 保存済みHost遷移の旧tokenまたは予定tokenだけを実markerへ照合する。
 * @responsibility Host処置後の保存不明でも別markerや任意の後続状態を採用しない。
 * @trace ARCH-000008
 * @input operation: 復号済み現在操作、hostRoot: Identityが固定したRoot。
 * @returns 現在実markerと一致する同じ旧tokenまたは保存済み予定token。
 * @precondition Rootと操作Identityの結合は呼出し側が検査する。
 * @postcondition 予定tokenの採用は既存世代排他の取得許可や清掃完了を意味しない。
 * @effect 同じRootのHost marker読取りのみ。遷移・削除は行わない。
 * @failure 不正lineage、未知資源、未失効Owner、別本文、観測不能は例外で停止する。
 * @invariant 作成結果不明を不存在へ変換せず、旧形式や別Rootへfallbackしない。
 * @boundary 現在stateの保存済み意図と実Host記録。
 * @security 保存JSONだけではOwnerを作らず、取得後にも同じ実markerを確認する。
 * @concurrency 操作全元版の取得前後一致と既存三種排他は外側準備が保持する。
 */
function resolveCurrentRecoveryHostToken(
  operation: CoordinatorStateTaskOperation,
  hostRoot: string,
): string {
  const currentToken = operation.host.currentToken;
  if (operation.host.pendingTransitionJson === null) return currentToken;
  const intent = JSON.parse(operation.host.pendingTransitionJson);
  if (intent.nextState !== "docker_absent_confirmed")
    throw new Error("docker_task_recovery_host_transition_mismatch");
  const lineage = validateHostRecoveryTransitionLineage(
    intent,
    "docker_absent_confirmed",
  );
  if (
    intent.currentState !== "docker_submission_started" ||
    lineage.currentToken !== currentToken ||
    operation.execution.ownerEffect !== "disabled" ||
    !coordinatorTaskResourcesAreSettled(operation)
  )
    throw new Error("docker_task_recovery_host_transition_mismatch");
  let loaded: ReturnType<typeof loadHostRecoveryRecordByToken>;
  try {
    loaded = loadHostRecoveryRecordByToken(currentToken, hostRoot);
  } catch {
    loaded = loadHostRecoveryRecordByToken(lineage.expectedToken, hostRoot);
    if (
      loaded.serialized !==
      canonical({ ...intent.recordBefore, state: "docker_absent_confirmed" })
    )
      throw new Error("docker_task_recovery_host_transition_mismatch");
    return lineage.expectedToken;
  }
  if (loaded.serialized !== canonical(intent.recordBefore))
    throw new Error("docker_task_recovery_host_transition_mismatch");
  return currentToken;
}

/**
 * 現在Repositoryのexact操作に限定したfresh回収Ownerを取得する。
 * @responsibility 現在本文と既存Host世代・Home・Runtime排他を共同保持する。
 * @trace ARCH-000008
 * @input token: 現在Taskのexact回復参照、rootCapability: 検証済みRepository。
 * @returns 短命な回収準備、または元参照・一次拒否と回収確認を持つblocked。
 * @precondition 現在Schemaを使い、旧Ownerの排他が終了している。
 * @postcondition 取得成功をDocker不存在・Host清掃・Lease解放へ昇格しない。
 * @effect 現在state／marker読取りと既存三種排他の取得だけ。
 * @failure 対象欠落、現在値不明、競合、marker差、排他欠測を固定拒否する。
 * @invariant raw Host Lockを二重取得せず、旧AppData・署名・Journalへfallbackしない。
 * @boundary 現在Readerと既存Host／Home／Runtimeの保持境界。
 * @security Root Readerや保存JSONだけから書込みOwnerを生成しない。
 * @concurrency 決定順取得、全元版再照合、部分失敗時の全逆順解放を行う。
 */
export function prepareRuntimeOwnedDockerTaskRecovery(
  token: unknown,
  rootCapability: unknown,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  const locks: Array<{ assertLive: () => boolean; release: () => boolean }> =
    [];
  let cleanupConfirmed = true;
  let acquisitionPending = false;
  let reason = "docker_task_recovery_preparation_unconfirmed";
  try {
    if (!parsed) {
      reason = "docker_task_recovery_id_invalid";
      throw new Error(reason);
    }
    const repository =
      borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability);
    let initial = readRuntimeOwnedCoordinatorRecoverySnapshot(rootCapability);
    if (initial.status !== "completed" && initial.lockReleased)
      initial = readRuntimeOwnedCoordinatorResourcePublicationSnapshot(
        rootCapability,
        parsed.token,
      );
    const savedTerminal =
      initial.value?.snapshot.operations.some(
        (item) =>
          item.kind === "docker_task" &&
          item.recoveryId === parsed.token &&
          item.lease === "released" &&
          item.outcome?.cleanupConfirmed === true,
      ) === true;
    if (savedTerminal)
      initial = readRuntimeOwnedCoordinatorCurrentHistorySnapshot(
        rootCapability,
        parsed.token,
      );
    if (initial.status === "blocked" && initial.lockReleased)
      initial = readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot(
        rootCapability,
        parsed.token,
      );
    if (initial.status !== "completed" && initial.lockReleased)
      initial = readRuntimeOwnedCoordinatorCurrentHistorySnapshot(
        rootCapability,
        parsed.token,
      );
    if (initial.status !== "completed" && initial.lockReleased)
      initial = readRuntimeOwnedCoordinatorCurrentDeliverySnapshot(
        rootCapability,
        parsed.token,
      );
    if (initial.status !== "completed" && initial.lockReleased)
      initial = readRuntimeOwnedCoordinatorCurrentCompletionSnapshot(
        rootCapability,
        parsed.token,
      );
    cleanupConfirmed = initial.lockReleased;
    if (
      !repository ||
      initial.status !== "completed" ||
      !initial.value ||
      !initial.lockReleased
    )
      throw new Error(reason);
    const targets = initial.value.snapshot.operations.filter(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === parsed.token,
    );
    const target = targets[0];
    if (targets.length !== 1 || !target) {
      reason = "docker_task_recovery_current_operation_unconfirmed";
      throw new Error(reason);
    }
    const identity = JSON.parse(target.identityJson);
    const host = parseHostRecoveryToken(target.host.currentToken);
    const initialHost = parseHostRecoveryToken(identity.initialHostRecoveryId);
    if (
      host.rootName !== initialHost.rootName ||
      host.nonce !== initialHost.nonce ||
      typeof identity.hostPaths.root !== "string" ||
      path.basename(identity.hostPaths.root) !== host.rootName
    )
      throw new Error(reason);
    let hostCleanup: DockerTaskRecoveryPreparation["hostCleanup"] = "present";
    if (
      target.host.cleanup !== "not_requested" ||
      coordinatorReleasedTaskCanObserveHostAbsence(target)
    ) {
      const observed = observeHostRecoveryCleanup(
        target.host.currentToken,
        identity.hostPaths.root,
      );
      if (
        observed.root === "unknown" ||
        observed.marker === "unknown" ||
        (identity.hostPaths.marker !== undefined &&
          identity.hostPaths.marker !== observed.markerPath)
      )
        throw new Error(reason);
      if (observed.root === "absent" && observed.marker === "absent") {
        if (
          target.host.pendingTransitionJson !== null ||
          target.execution.ownerEffect !== "disabled" ||
          !coordinatorTaskResourcesAreSettled(target)
        )
          throw new Error(reason);
        hostCleanup = "absent";
      } else if (
        target.host.cleanup === "confirmed" ||
        observed.marker !== "present"
      )
        throw new Error(reason);
    }
    if (initial.hostCleanupPublication && hostCleanup !== "absent")
      throw new Error(reason);
    const observedHostToken =
      hostCleanup === "absent"
        ? target.host.currentToken
        : resolveCurrentRecoveryHostToken(target, identity.hostPaths.root);
    acquisitionPending = true;
    const generation =
      hostCleanup === "absent"
        ? acquireHostOperationRecoveryGenerationByIdentity(
            identity.hostPaths.root,
            host.nonce,
          )
        : acquireHostOperationRecoveryGeneration(
            observedHostToken,
            identity.hostPaths.root,
          );
    if (!generation) {
      reason = "docker_task_recovery_host_active_or_unknown";
      throw new Error(reason);
    }
    locks.push({
      assertLive: () => {
        verifyHostOperationRecoveryGeneration(
          generation,
          identity.hostPaths.root,
          host.nonce,
        );
        return true;
      },
      release: () => releaseHostOperationRecoveryGeneration(generation),
    });
    acquisitionPending = false;
    verifyHostOperationRecoveryGeneration(
      generation,
      identity.hostPaths.root,
      host.nonce,
    );
    if (hostCleanup === "present")
      loadHostRecoveryRecordByToken(observedHostToken, identity.hostPaths.root);
    else {
      const observed = observeHostRecoveryCleanup(
        observedHostToken,
        identity.hostPaths.root,
      );
      if (observed.root !== "absent" || observed.marker !== "absent")
        throw new Error(reason);
    }
    acquisitionPending = true;
    const home = acquireRuntimeOwnedLogicalProviderHomeKernelLock(
      parsed.stableLogicalHomeBindingHash,
    );
    if (!home) {
      reason = "docker_task_recovery_home_active_or_unknown";
      throw new Error(reason);
    }
    locks.push(home);
    const runtime = acquireRuntimeOwnedDockerRuntimeStateKernelLock(
      repository.repositoryBinding,
    );
    if (!runtime) {
      reason = "docker_task_recovery_runtime_active_or_unknown";
      throw new Error(reason);
    }
    locks.push(runtime);
    acquisitionPending = false;
    const publication = initial.hostCleanupPublication ?? null;
    let current = initial.resourcePublication
      ? readRuntimeOwnedCoordinatorResourcePublicationSnapshot(
          rootCapability,
          parsed.token,
        )
      : publication
        ? readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot(
            rootCapability,
            parsed.token,
          )
        : initial.currentHistoryPublication
          ? readRuntimeOwnedCoordinatorCurrentHistorySnapshot(
              rootCapability,
              parsed.token,
            )
          : initial.currentCompletionPublication
            ? readRuntimeOwnedCoordinatorCurrentCompletionSnapshot(
                rootCapability,
                parsed.token,
              )
            : initial.currentDeliveryPublication
              ? readRuntimeOwnedCoordinatorCurrentDeliverySnapshot(
                  rootCapability,
                  parsed.token,
                )
              : readRuntimeOwnedCoordinatorRecoverySnapshot(rootCapability);
    cleanupConfirmed &&= current.lockReleased;
    let before = Buffer.from(
      `${encodeCoordinatorStateValue(initial.value.snapshot)}\n`,
    );
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      !Buffer.from(
        `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
      ).equals(before) ||
      (publication &&
        (!current.hostCleanupPublication ||
          current.hostCleanupPublication.mode !== publication.mode ||
          !current.hostCleanupPublication.before.equals(publication.before) ||
          !current.hostCleanupPublication.candidate.equals(
            publication.candidate,
          ))) ||
      (initial.resourcePublication &&
        (!current.resourcePublication?.before.equals(
          initial.resourcePublication.before,
        ) ||
          !current.resourcePublication.candidate.equals(
            initial.resourcePublication.candidate,
          )))
    ) {
      reason = "docker_task_recovery_boundary_changed";
      throw new Error(reason);
    }
    if (initial.resourcePublication) {
      const resumed = resumeRuntimeOwnedCoordinatorResourcePublication(
        { ...repository, operationId: identity.operationId },
        parsed.token,
        initial.resourcePublication.before,
        initial.resourcePublication.candidate,
        () => {
          if (
            !repository.revalidate() ||
            locks.some((lock) => lock.assertLive() !== true)
          )
            return false;
          verifyHostOperationRecoveryGeneration(
            generation,
            identity.hostPaths.root,
            host.nonce,
          );
          loadHostRecoveryRecordByToken(
            observedHostToken,
            identity.hostPaths.root,
          );
          return true;
        },
      );
      cleanupConfirmed &&= resumed.lockReleased;
      if (
        resumed.status !== "completed" ||
        !resumed.snapshotConfirmed ||
        !resumed.lockReleased
      ) {
        reason = "docker_task_recovery_resource_publication_unconfirmed";
        throw new Error(reason);
      }
      current = readRuntimeOwnedCoordinatorRecoverySnapshot(rootCapability);
      cleanupConfirmed &&= current.lockReleased;
      if (
        current.status !== "completed" ||
        !current.value ||
        !current.lockReleased ||
        !Buffer.from(
          `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
        ).equals(initial.resourcePublication.candidate)
      ) {
        reason = "docker_task_recovery_resource_publication_unconfirmed";
        throw new Error(reason);
      }
      before = Buffer.from(initial.resourcePublication.candidate);
    }
    const capability = Object.freeze({});
    const record: DockerTaskRecoveryPreparation = {
      kind: "recovery",
      repository: Object.freeze({
        ...repository,
        operationId: identity.operationId,
      }),
      rootCapability,
      recoveryId: target.recoveryId,
      hostGeneration: generation,
      hostRoot: identity.hostPaths.root,
      hostToken: observedHostToken,
      hostNonce: host.nonce,
      locks: Object.freeze(locks),
      before,
      closed: false,
      persistenceFailed: false,
      cleanupUnknown: false,
      hostCleanup,
      releaseAttempted: false,
      releaseConfirmed: false,
      finalizationAttempted: false,
      completionAttempted: false,
      completionPending: Boolean(initial.currentCompletionPublication),
      hostCleanupPublication: publication
        ? Object.freeze({
            ...publication,
            before: Buffer.from(publication.before),
            candidate: Buffer.from(publication.candidate),
          })
        : null,
    };
    dockerRecoveryPreparations.set(capability, record);
    if (!assertCurrentRecoveryOwner(capability, record)) {
      record.closed = true;
      throw new Error(reason);
    }
    return Object.freeze({
      status: "prepared" as const,
      capability,
      recoveryId: target.recoveryId,
      cleanupConfirmed: true,
    });
  } catch {
    if (acquisitionPending) cleanupConfirmed = false;
    for (const lock of [...locks].reverse()) {
      try {
        if (!lock.release()) cleanupConfirmed = false;
      } catch {
        cleanupConfirmed = false;
      }
    }
    return Object.freeze({
      status: "blocked" as const,
      recoveryId: parsed?.token ?? null,
      reason,
      cleanupConfirmed,
    });
  }
}

/**
 * 保持中の回収Ownerの固定途中評価を現在状態へ確定する。
 * @responsibility 元本文の競合、保存不明と失効後の追加Writerを拒否する。
 * @trace ARCH-000008
 * @input capability: 私有回収準備、kind・value: 固定途中checkpoint。
 * @returns 保存・全読戻し・短命Writer排他の解放・保持中Ownerの再確認が成立した場合だけtrue。
 * @precondition 同じHost markerと三種排他が生存している。
 * @postcondition 確認済み次版本文だけをOwnerの元版へ更新する。
 * @effect 同じ操作の固定state更新と読戻しだけ。
 * @failure 偽造、コピー、種別差、失効・元版差・保存不明は停止する。
 * @invariant 不明後の追加Writerを停止し、旧要求成功やDocker回収成功を推定しない。
 * @boundary 私有回収Ownerと既存Writer／Reader。
 * @security 任意candidate、外部callback、旧実行Capabilityを受け取らない。
 * @concurrency 保存内の再確認と保存後の全版相関を行う。
 */
export function persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
  capability: unknown,
  kind: "resource" | "cleanup" | "host" | "lifecycle",
  value: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  const absentHostCheckpoint =
    record?.kind === "recovery" &&
    record.hostCleanup === "absent" &&
    kind === "host";
  if (
    record?.kind !== "recovery" ||
    record.closed ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    (record.hostCleanup !== "present" && !absentHostCheckpoint) ||
    record.hostCleanupPublication !== null
  )
    return false;
  record.persistenceFailed = true;
  try {
    if (!assertCurrentRecoveryOwner(capability, record)) return false;
    const checkpointValue =
      kind === "host" ? JSON.parse(encodeCoordinatorStateValue(value)) : value;
    if (absentHostCheckpoint) {
      const current = decodeCoordinatorStateSnapshot(
        record.before,
        record.repository.repositoryBinding,
      );
      const operation = current?.snapshot.operations.find(
        (item): item is CoordinatorStateTaskOperation =>
          item.kind === "docker_task" && item.recoveryId === record.recoveryId,
      );
      if (
        !operation ||
        !coordinatorReleasedTaskCanObserveHostAbsence(operation) ||
        operation.host.cleanup !== "not_requested" ||
        encodeCoordinatorStateValue(checkpointValue) !==
          encodeCoordinatorStateValue({ ...operation.host, cleanup: "pending" })
      )
        return false;
    }
    if (kind === "host" && checkpointValue.currentToken !== record.hostToken)
      return false;
    const saved = writeRuntimeOwnedCoordinatorRecoveryCheckpoint(
      record.repository,
      record.recoveryId,
      record.before,
      kind,
      checkpointValue,
      () => assertCurrentRecoveryOwner(capability, record),
    );
    if (!saved.lockReleased) record.cleanupUnknown = true;
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased
    )
      return false;
    const current = readRuntimeOwnedCoordinatorRecoverySnapshot(
      record.rootCapability,
    );
    if (!current.lockReleased) record.cleanupUnknown = true;
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      current.value.snapshot.revision !== saved.revision ||
      current.value.payloadSha256 !== saved.payloadSha256
    )
      return false;
    record.before = Buffer.from(
      `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
    );
    const confirmed = assertCurrentRecoveryOwner(capability, record);
    record.persistenceFailed = !confirmed;
    return confirmed;
  } catch {
    return false;
  }
}

/**
 * 現在の三排他を保持する回収Ownerから旧実行Ownerの退役だけを保存する。
 * @responsibility 既存の実行評価を保持し、新規要求不能の確定を資源清掃から分離する。
 * @trace ARCH-000008
 * @input capability: 同じProcessの私有回収準備。
 * @returns 元版照合と必要な保存・読戻しが成立した場合だけtrue。
 * @precondition 同Root・Host世代とHost／Home／Runtime排他を保持する。
 * @postcondition 既にdisabledなら書込み0。新規退役では他の評価と結果を変更しない。
 * @effect 既存stateのphaseとownerEffectだけを更新する。Docker／Host操作なし。
 * @failure 偽造・元版差・排他不明・後期状態・保存不明では後段を拒否する。
 * @invariant disabledは孤立CLI終了・遅延create無害化・資源不存在を意味しない。
 * @boundary 現在回収Ownerと既存lifecycle Writer。
 * @security 任意の候補値や外部の成功申告を受け取らない。
 * @concurrency fresh全文と実効排他を保存前後で照合する。
 */
function retireRuntimeOwnedDockerTaskExecutionOwner(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    record.closed ||
    record.persistenceFailed ||
    record.cleanupUnknown
  )
    return false;
  try {
    if (!assertCurrentRecoveryOwner(capability, record)) {
      record.persistenceFailed = true;
      return false;
    }
    let current =
      record.completionPending === true
        ? readRuntimeOwnedCoordinatorCurrentCompletionSnapshot(
            record.rootCapability,
            record.recoveryId,
          )
        : readRuntimeOwnedCoordinatorRecoverySnapshot(record.rootCapability);
    if (
      current.status === "blocked" &&
      current.lockReleased === true &&
      record.completionPending === false &&
      record.hostCleanup === "absent" &&
      record.hostCleanupPublication === null
    )
      current = readRuntimeOwnedCoordinatorCurrentHistorySnapshot(
        record.rootCapability,
        record.recoveryId,
      );
    if (!current.lockReleased) record.cleanupUnknown = true;
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      !Buffer.from(
        `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
      ).equals(record.before)
    ) {
      record.persistenceFailed = true;
      return false;
    }
    const operation = current.value.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    if (!operation || !assertCurrentRecoveryOwner(capability, record)) {
      record.persistenceFailed = true;
      return false;
    }
    if (operation.execution.ownerEffect === "disabled") return true;
    if (
      record.completionPending === true ||
      operation.phase === "awaiting_delivery" ||
      record.hostCleanup !== "present"
    ) {
      record.persistenceFailed = true;
      return false;
    }
    return persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
      capability,
      "lifecycle",
      {
        phase: "settling",
        lease: operation.lease,
        execution: { ...operation.execution, ownerEffect: "disabled" },
        primaryFailure: operation.primaryFailure,
        outcome: operation.outcome,
        summarySha256: operation.summarySha256,
      },
    );
  } catch {
    record.persistenceFailed = true;
    return false;
  }
}

/**
 * 現在回収準備を閉じ、取得済み排他を全逆順で一度解放する。
 * @responsibility false／例外でも残りの解放を省略しない。
 * @trace ARCH-000008
 * @input capability: 私有回収準備。
 * @returns 過去不明なし・全解放確認の場合だけtrue。
 * @precondition 取得済み排他はこのOwnerが所有する。
 * @postcondition 解放後・二度目使用・コピーからWriterを発行しない。
 * @effect 既存排他の解放だけ。Docker・Provider・保存処置なし。
 * @failure 偽造・別種別・再使用・解放不明はfalse。
 * @invariant 過去回収不明を後着の成功で消さない。
 * @boundary 回収Ownerと取得済み実効排他。
 * @security 新しい実行許可や回復先を生成しない。
 * @concurrency 閉鎖を先に固定して全解放を試行する。
 */
export function releaseRuntimeOwnedDockerTaskRecoveryPreparation(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (record?.kind !== "recovery" || record.closed) return false;
  record.closed = true;
  record.releaseAttempted = true;
  let confirmed = !record.cleanupUnknown;
  for (const lock of [...record.locks].reverse()) {
    try {
      if (!lock.release()) confirmed = false;
    } catch {
      confirmed = false;
    }
  }
  record.cleanupUnknown ||= !confirmed;
  record.releaseConfirmed = confirmed;
  return confirmed;
}
/**
 * 全排他解放後に、同じ回収操作の終了保存を一度だけ試行する。
 * @responsibility 解放済みOwnerを新しい処置へ復活させず、固定終端Writerだけへ結合する。
 * @trace ARCH-000008
 * @input capability: 元回収準備Mapのキー。
 * @returns 保存・読戻し・短期Lock解放を区別した固定結果。
 * @precondition Host両不存在と外側排他の全解放が確認済み。
 * @postcondition 成否にかかわらず同Ownerで二度目の終端保存を発行しない。
 * @effect 同じRepository・exact操作の終了保存だけ。Docker／Host処置なし。
 * @failure コピー、別種別、未解放・解放不明、元版競合と保存不明は拒否する。
 * @invariant 一次失敗を保持し、清掃からTask成功を推定しない。
 * @boundary 解放済み私有Ownerと既存現在状態Writer。
 * @security Rootと保存JSONだけで終了保存Ownerを作らない。
 * @concurrency 試行前に一回性を固定し、保存中は元OwnerとRootを同期再確認する。
 */
export function finalizeRuntimeOwnedDockerTaskRecoveryPreparation(
  capability: unknown,
) {
  const refused = Object.freeze({
    status: "blocked" as const,
    snapshotConfirmed: false,
    lockReleased: true,
  });
  if (!capability || typeof capability !== "object") return refused;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    !record.closed ||
    !record.releaseAttempted ||
    !record.releaseConfirmed ||
    record.finalizationAttempted ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanup !== "absent" ||
    record.hostCleanupPublication !== null
  )
    return refused;
  record.finalizationAttempted = true;
  let writing = true;
  try {
    const saved = writeRuntimeOwnedCoordinatorRecoveryTerminal(
      record.repository,
      record.recoveryId,
      record.before,
      () => {
        if (
          !writing ||
          dockerRecoveryPreparations.get(capability) !== record ||
          !record.closed ||
          !record.releaseAttempted ||
          !record.releaseConfirmed ||
          !record.finalizationAttempted ||
          record.persistenceFailed ||
          record.cleanupUnknown ||
          !record.repository.revalidate()
        )
          return false;
        const observed = observeHostRecoveryCleanup(
          record.hostToken,
          record.hostRoot,
        );
        return observed.root === "absent" && observed.marker === "absent";
      },
    );
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased
    ) {
      record.persistenceFailed = true;
      record.cleanupUnknown ||= !saved.lockReleased;
    }
    return saved;
  } catch {
    record.persistenceFailed = true;
    return refused;
  } finally {
    writing = false;
  }
}

/**
 * 終了保存後の同じ回収Ownerで、履歴確認までを有界に進める。
 * @responsibility 各保存段階でfresh Readerを使い、途中失敗後の同Owner再発行を止める。
 * @trace ARCH-000008
 * @input capability: 全排他解放と終了保存試行を終えた私有準備キー。
 * @returns 保存・排他終了と履歴確認を区別した結果。
 * @precondition 現在資源とHostが終了済みで、旧OwnerのEffectが無効。
 * @postcondition 履歴confirmedまでに限定し、配送・ACK・操作除去は行わない。
 * @effect 固定現在状態と履歴の保存だけ。Docker／Host処置なし。
 * @failure 失効、不明、元版差、保存失敗は同IDを保持して停止する。
 * @invariant 旧Controller結果・実行Authorityを合成しない。
 * @boundary 解放済みOwnerと既存履歴Writer。
 * @security 各Writer境界で同じRootとHost両不存在を再確認する。
 * @concurrency 一段ずつContextを破棄し、最大二段の保存で終了する。
 */
export function completeRuntimeOwnedDockerTaskRecoveryHistory(
  capability: unknown,
) {
  const refused = Object.freeze({
    status: "blocked" as const,
    reason: "coordinator_state_owner_invalid",
    snapshotConfirmed: false,
    lockReleased: true,
    historyConfirmed: false,
    filesystemEffectIssued: false,
  });
  if (!capability || typeof capability !== "object") return refused;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    !record.closed ||
    !record.releaseAttempted ||
    !record.releaseConfirmed ||
    !record.finalizationAttempted ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanup !== "absent" ||
    record.hostCleanupPublication !== null
  )
    return refused;
  let active = true,
    filesystemEffectIssued = false;
  try {
    for (let stage = 0; stage < 2; stage++) {
      const saved = advanceRuntimeOwnedCoordinatorRecoveryHistory(
        record.repository,
        record.recoveryId,
        () => {
          if (
            !active ||
            dockerRecoveryPreparations.get(capability) !== record ||
            record.persistenceFailed ||
            record.cleanupUnknown ||
            !record.repository.revalidate()
          )
            return false;
          const observed = observeHostRecoveryCleanup(
            record.hostToken,
            record.hostRoot,
          );
          return observed.root === "absent" && observed.marker === "absent";
        },
      );
      filesystemEffectIssued ||= saved.filesystemEffectIssued;
      if (
        saved.status !== "completed" ||
        !saved.snapshotConfirmed ||
        !saved.lockReleased
      ) {
        record.persistenceFailed = true;
        record.cleanupUnknown ||= !saved.lockReleased;
        return Object.freeze({ ...saved, filesystemEffectIssued });
      }
      if (saved.historyConfirmed)
        return Object.freeze({ ...saved, filesystemEffectIssued });
    }
    record.persistenceFailed = true;
    return Object.freeze({ ...refused, filesystemEffectIssued });
  } catch {
    record.persistenceFailed = true;
    return Object.freeze({ ...refused, filesystemEffectIssued });
  } finally {
    active = false;
  }
}

/**
 * 現在操作の五用途を、下位の閉じた資源照合条件へ投影する。
 * @responsibility AI由来の判断と現在資源のpurpose相関を所有し、Docker構成は下位へ委譲する。
 * @trace ARCH-000008
 * @input operation: 現在Schemaで検査済みの単一操作。
 * @returns 下位の固定五用途計画へ、同じpurposeの現在資源を結合した不変配列。
 * @precondition 呼出し側が現在Root・元版・保持Ownerを別に確認する。
 * @postcondition この投影だけでDocker要求・書込み・処置許可を発行しない。
 * @effect N/A: 検査済み値の同期投影だけ。
 * @failure 不正Identityまたは五用途欠測は例外。
 * @invariant 任意Network・Image・Mountを期待値へ追加しない。
 * @boundary 現在状態の意味とDocker Isolationの技術照合契約。
 * @security Host所在・認証値を返却せず、保存JSONをAuthorityとして扱わない。
 * @concurrency 元版に結合した呼出し側だけが使用する。
 */
export function currentDockerRecoveryResourceExpectations(
  operation: CoordinatorStateTaskOperation,
) {
  if (
    operation.resources.length !== 5 ||
    new Set(operation.resources.map((resource) => resource.purpose)).size !==
      5 ||
    operation.resources.some(
      (resource) => !isDockerResourcePurpose(resource.purpose),
    )
  )
    throw new Error("docker_task_recovery_resource_missing");
  const identity = JSON.parse(operation.identityJson);
  const plan = planDockerRecoveryResourceExpectations({
    authenticationContainerName: identity.resources.auth,
    executionContainerName: identity.resources.provider,
    proxyContainerName: identity.resources.proxy,
    internalNetworkName: identity.resources.internal,
    egressNetworkName: identity.resources.egress,
    ownershipLabel: identity.ownershipLabel,
    executionImageDigest: identity.images.provider,
    proxyImageDigest: identity.images.proxy,
    workspaceMounted: identity.operationMode === "isolated_task",
    workspaceReadOnly: identity.workspaceMountMode === "read_only",
    ...(identity.workspaceProtected === true
      ? {
          workspaceProtected: true,
          workspaceProtection: identity.workspaceProtection,
        }
      : {}),
    initRequired: codexAdviceProviderInitRequired(
      identity.operationMode,
      identity.images.provider,
    ),
  });
  if (!plan) throw new Error("docker_task_recovery_resource_missing");
  return Object.freeze(
    plan.map((entry) => {
      const resource = operation.resources.find(
        (candidate) => candidate.purpose === entry.purpose,
      );
      if (!resource) throw new Error("docker_task_recovery_resource_missing");
      return Object.freeze({ ...entry, resource });
    }),
  );
}

/**
 * 終端回収の保存済み利用形態に必要な配送だけを登録する。
 * @responsibility 解放済みの同じ回収Ownerを既存配送Writerへ一回借用する。
 * @trace ARCH-000008
 * @input capability: 終了保存・履歴確認を行う現在回収準備キー。
 * @returns 保存確認・排他終了・Effectと耐久配送待ちを区別した結果。
 * @precondition 外側排他は全解放済みでHost両不存在を確認できる。
 * @postcondition 操作を除去せず、Provider再実行や上位ACKを発行しない。
 * @effect Orchestrator配送の現在状態保存だけ。CLI／Workbenchは書込み0。
 * @failure Owner失効、Host再出現、履歴未確認、保存不明は同IDを保持する。
 * @invariant 一次失敗と実資源回収を利用側の保存方針で書き換えない。
 * @boundary 現在回収Ownerと用途別結果搬送。
 * @security 利用側・結果ID・保存先はCaller入力から指定しない。
 * @concurrency 借用を同期処理内へ限定し、失敗後は同Ownerから再発行しない。
 */
export function registerRuntimeOwnedDockerTaskRecoveryDelivery(
  capability: unknown,
) {
  const refused = Object.freeze({
    status: "blocked" as const,
    reason: "coordinator_state_owner_invalid",
    snapshotConfirmed: false,
    lockReleased: true,
    filesystemEffectIssued: false,
    deliveryPending: false,
  });
  if (!capability || typeof capability !== "object") return refused;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    !record.closed ||
    !record.releaseAttempted ||
    !record.releaseConfirmed ||
    !record.finalizationAttempted ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanup !== "absent" ||
    record.hostCleanupPublication !== null
  )
    return refused;
  let active = true;
  try {
    const saved = registerRuntimeOwnedCoordinatorRecoveryResultDelivery(
      record.repository,
      record.recoveryId,
      () => {
        if (
          !active ||
          dockerRecoveryPreparations.get(capability) !== record ||
          record.persistenceFailed ||
          record.cleanupUnknown ||
          !record.repository.revalidate()
        )
          return false;
        const host = observeHostRecoveryCleanup(
          record.hostToken,
          record.hostRoot,
        );
        return host.root === "absent" && host.marker === "absent";
      },
    );
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased
    ) {
      record.persistenceFailed = true;
      record.cleanupUnknown ||= !saved.lockReleased;
    }
    return saved;
  } catch {
    record.persistenceFailed = true;
    return refused;
  } finally {
    active = false;
  }
}

/**
 * 現在Repositoryの上位相関を現在操作の回復参照へ解決する。
 * @responsibility 完全な現在観測だけを要求集合へ重複なく対応付ける。
 * @trace ARCH-000008
 * @input correlationIds: 上位相関の固定集合、rootCapability: 検証済みRepository。
 * @returns exact一致と明示不存在、または全体停止。
 * @precondition 呼出し元が認証済み上位要求と固定Repositoryを所有する。
 * @postcondition 不存在から元Task成功やProvider未発行を主張しない。
 * @effect 現在stateの読取りと既存短期排他だけ。
 * @failure 不正入力・重複・別consumer・読取／解放不明はabsence0で停止する。
 * @invariant 内部Operation IDへのfallbackと旧AppData探索を行わない。
 * @boundary 上位相関集合と現在Repositoryの固定Snapshot。
 * @security Resolver結果は処置Authorityではなく、保存済み上位義務の照合入力である。
 * @concurrency Readerの全数観測・Root再確認・排他解放を共同条件とする。
 */
export function resolveRuntimeOwnedDockerTaskCurrentCorrelations(
  correlationIds: readonly string[],
  rootCapability: unknown,
  consumer: "orchestrator" | "workbench" | "coordinator_cli" = "orchestrator",
) {
  let lockReleased = true;
  /**
   * 相関観測失敗を既知解放事実と空の対応集合へ限定する。
   * @responsibility 未観測の不存在・一致を失敗結果へ混ぜない。
   * @trace ARCH-000008
   * @input reason: 固定停止理由。
   * @returns 値だけの停止診断。
   * @precondition lockReleasedは下位Readerの返却からだけ更新する。
   * @postcondition 停止時のmatched／absenceは共に空集合。
   * @effect N/A: 値構築だけ。
   * @failure N/A: 外部処置を発行しない。
   * @invariant この診断から回復完了や処置Authorityを発行しない。
   * @boundary N/A: 同期の局所値変換。
   * @security 固定理由とboolean以外の内部情報を返さない。
   * @concurrency N/A: 外部共有状態を変更しない。
   */
  const refused = (reason: string) =>
    Object.freeze({
      status: "blocked" as const,
      reason,
      lockReleased,
      bindings: Object.freeze([]),
      absentCorrelationIds: Object.freeze([]),
    });
  try {
    if (
      utilTypes.isProxy(correlationIds) ||
      !Array.isArray(correlationIds) ||
      Object.getPrototypeOf(correlationIds) !== Array.prototype ||
      correlationIds.length === 0 ||
      correlationIds.length > 5
    )
      return refused("docker_task_recovery_correlation_input_invalid");
    const requested: string[] = [];
    for (let index = 0; index < correlationIds.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(
        correlationIds,
        String(index),
      );
      if (
        !descriptor ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(descriptor.value) ||
        requested.includes(descriptor.value)
      )
        return refused("docker_task_recovery_correlation_input_invalid");
      requested.push(descriptor.value);
    }
    const observed =
      readRuntimeOwnedCoordinatorRecoverySnapshot(rootCapability);
    lockReleased = observed.lockReleased;
    if (observed.status !== "completed" || !observed.value || !lockReleased)
      return refused("docker_task_recovery_correlation_current_unconfirmed");
    const matches = new Map<string, string>();
    const recoveries = new Set<string>();
    for (const operation of observed.value.snapshot.operations) {
      const identity = JSON.parse(operation.identityJson);
      const correlation = identity.recoveryCorrelationId;
      if (correlation === undefined && identity.consumer !== consumer) continue;
      if (
        typeof correlation !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(correlation) ||
        matches.has(correlation) ||
        recoveries.has(operation.recoveryId) ||
        (requested.includes(correlation) && identity.consumer !== consumer)
      )
        return refused("docker_task_recovery_correlation_ambiguous");
      matches.set(correlation, operation.recoveryId);
      recoveries.add(operation.recoveryId);
    }
    return Object.freeze({
      status: "completed" as const,
      reason: "docker_task_recovery_correlations_observed",
      lockReleased,
      bindings: Object.freeze(
        requested.flatMap((correlationId) => {
          const recoveryId = matches.get(correlationId);
          return recoveryId === undefined
            ? []
            : [Object.freeze({ correlationId, recoveryId })];
        }),
      ),
      absentCorrelationIds: Object.freeze(
        requested.filter((id) => !matches.has(id)),
      ),
    });
  } catch {
    return refused("docker_task_recovery_correlation_current_unconfirmed");
  }
}

/**
 * 現在回復を保存済み利用形態の終了条件まで接続し、公開診断だけを返す。
 * @responsibility 技術回収の共同成立と固定consumerを確認して用途別終了を選ぶ。
 * @trace ARCH-000008
 * @input token: exact回復参照、rootCapability: 現在Repository、signal: 入口の取消。
 * @returns 内部準備キー・Path・本文を含まない固定診断。
 * @precondition 入口がRepositoryと取消の所有者を検証している。
 * @postcondition transientは表示前整理、durableは受領待ちを保持する。
 * @effect 既存技術回収とtransient終了Writerだけ。
 * @failure 技術欠測・consumer差・保存不明は元参照と既知事実を保持して停止する。
 * @invariant Provider再実行・旧形式fallback・表示Receiptを追加しない。
 * @boundary 現在回復OwnerとCLI向け診断。
 * @security 私有MapのIdentity由来consumerだけを採用し、準備キーを外へ返さない。
 * @concurrency 同期技術回収完了後の取消で確認済み終了を巻き戻さない。
 */
export async function recoverRuntimeOwnedDockerTaskForCurrentConsumer(
  token: unknown,
  rootCapability: unknown,
  signal?: AbortSignal,
) {
  const technical = await recoverRuntimeOwnedDockerTaskFromCurrentRepository(
    token,
    rootCapability,
    signal,
  );
  const report = {
    contract: "crdd-coordinator/current-task-recovery" as const,
    status: "blocked" as "blocked" | "recovered" | "awaiting_delivery",
    reason: technical.reason,
    recoveryId: technical.recoveryId,
    dockerCleanupConfirmed: technical.dockerCleanupConfirmed,
    hostCleanupConfirmed: technical.hostCleanupConfirmed,
    locksReleased: technical.locksReleased,
    historyConfirmed: technical.historyConfirmed,
    deliveryPending: technical.deliveryPending,
    operationRetained:
      technical.status === "completed" ? true : (null as boolean | null),
    operationRemovalConfirmed: false,
    taskRecoveryCompleted: false,
    cleanupReason: technical.cleanupReason,
  };
  if (
    technical.status !== "completed" ||
    !technical.dockerCleanupConfirmed ||
    !technical.hostCleanupConfirmed ||
    !technical.locksReleased ||
    !technical.historyConfirmed ||
    technical.cleanupReason !== null ||
    !technical.preparation
  )
    return Object.freeze(report);
  try {
    const owner = dockerRecoveryPreparations.get(technical.preparation);
    const snapshot =
      owner?.kind === "recovery"
        ? decodeCoordinatorStateSnapshot(
            owner.before,
            owner.repository.repositoryBinding,
          )
        : null;
    const operation = snapshot?.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === technical.recoveryId,
    );
    const policy = operation
      ? coordinatorConsumerCompletionPolicy(
          JSON.parse(operation.identityJson).consumer,
        )
      : null;
    if (!policy || technical.deliveryPending !== (policy === "durable"))
      return Object.freeze({
        ...report,
        reason: "docker_task_recovery_consumer_unconfirmed",
      });
    if (policy === "durable")
      return Object.freeze({
        ...report,
        status: "awaiting_delivery" as const,
        reason: "docker_task_recovery_durable_acceptance_pending",
      });
    const completion = completeRuntimeOwnedDockerTaskTransientRecovery(
      technical.preparation,
    );
    const completed =
      completion.status === "completed" &&
      completion.snapshotConfirmed &&
      completion.lockReleased &&
      completion.operationRemovalConfirmed &&
      completion.taskRecoveryCompleted;
    return Object.freeze({
      ...report,
      status: completed ? ("recovered" as const) : ("blocked" as const),
      reason: completed ? "docker_task_recovery_completed" : completion.reason,
      locksReleased: report.locksReleased && completion.lockReleased,
      cleanupReason: completion.lockReleased
        ? null
        : "docker_task_recovery_release_unconfirmed",
      operationRetained: completed ? false : null,
      operationRemovalConfirmed: completed,
      taskRecoveryCompleted: completed,
    });
  } catch {
    return Object.freeze({
      ...report,
      reason: "docker_task_recovery_completion_unconfirmed",
      operationRetained: null,
    });
  }
}

/**
 * 現在Repositoryのexact回復を、既存Ownerの順序で結果登録まで接続する。
 * @responsibility 技術回収・全解放・終了保存・履歴・必要配送を直列化する。
 * @trace ARCH-000008
 * @input token: exact回復参照、rootCapability: 明示検証済みRoot、signal: 呼出しOwnerの取消。
 * @returns 技術回収の各確認と内部準備キー。操作は保持し、利用者への返却完了は主張しない。
 * @precondition 呼出し元が現在Repositoryと取消の所有者を固定する。
 * @postcondition 成否にかかわらず取得済み排他を一度解放し、失敗後の後続処置を止める。
 * @effect 既存DI資源回収・Host回収と現在状態／履歴の保存だけ。
 * @failure 各段の不明は同じ参照を保持し、元の失敗を解放結果で上書きしない。
 * @invariant Task再実行、Provider要求、Docker再起動、旧AppData探索を行わない。
 * @boundary 現在Rootの回収OwnerからDI／Host／保存Ownerへの固定組立て。
 * @security 内部準備キーを公開reportへ展開せず、署名資格やCallerの成功値を使わない。
 * @concurrency 同期下位要求の終了後に取消を処理し、次段の新Effectを開始しない。
 */
export async function recoverRuntimeOwnedDockerTaskFromCurrentRepository(
  token: unknown,
  rootCapability: unknown,
  signal?: AbortSignal,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  const base = Object.freeze({
    status: "blocked" as const,
    reason: "docker_task_recovery_preparation_unconfirmed",
    recoveryId: parsed?.token ?? null,
    dockerCleanupConfirmed: false,
    hostCleanupConfirmed: false,
    locksReleased: true,
    historyConfirmed: false,
    deliveryPending: false,
    operationRetained: true,
    taskRecoveryCompleted: false,
    cleanupReason: null as string | null,
    preparation: null as object | null,
  });
  if (!parsed)
    return Object.freeze({
      ...base,
      reason: "docker_task_recovery_id_invalid",
    });
  if (
    signal !== undefined &&
    (utilTypes.isProxy(signal) || !(signal instanceof AbortSignal))
  )
    return Object.freeze({
      ...base,
      reason: "docker_task_recovery_cancellation_invalid",
    });
  if (signal?.aborted)
    return Object.freeze({ ...base, reason: "docker_task_recovery_cancelled" });
  const prepared = prepareRuntimeOwnedDockerTaskRecovery(
    parsed.token,
    rootCapability,
  );
  if (prepared.status !== "prepared")
    return Object.freeze({
      ...base,
      reason: prepared.reason,
      locksReleased: prepared.cleanupConfirmed,
      cleanupReason: prepared.cleanupConfirmed
        ? null
        : "docker_task_recovery_release_unconfirmed",
    });
  const capability = prepared.capability;
  const record = dockerRecoveryPreparations.get(capability);
  let reason = "docker_task_recovery_owner_unconfirmed";
  let dockerCleanupConfirmed = false,
    hostCleanupConfirmed = false,
    released = false,
    settled = false;
  try {
    if (record?.kind !== "recovery") throw new Error(reason);
    await yieldRecoveryEvents();
    if (signal?.aborted) throw new Error("docker_task_recovery_cancelled");
    reason = "docker_task_recovery_owner_retirement_unconfirmed";
    if (!retireRuntimeOwnedDockerTaskExecutionOwner(capability))
      throw new Error(reason);
    await yieldRecoveryEvents();
    if (signal?.aborted) throw new Error("docker_task_recovery_cancelled");
    if (record.hostCleanup === "present") {
      const resources =
        executeRuntimeOwnedDockerTaskResourceRecovery(capability);
      reason = resources.reason;
      if (
        resources.status !== "completed" ||
        !resources.dockerCleanupConfirmed ||
        !resources.configCleanupConfirmed
      )
        throw new Error(reason);
      dockerCleanupConfirmed = true;
      await yieldRecoveryEvents();
      if (signal?.aborted) throw new Error("docker_task_recovery_cancelled");
      reason = "docker_task_recovery_host_absence_unconfirmed";
      if (!confirmRuntimeOwnedDockerTaskHostAbsence(capability))
        throw new Error(reason);
    } else if (record.hostCleanup === "absent") {
      // prepareが既知終端の五資源と現在Host両不存在を照合済み。
      dockerCleanupConfirmed = true;
    } else throw new Error(reason);
    await yieldRecoveryEvents();
    if (signal?.aborted) throw new Error("docker_task_recovery_cancelled");
    const snapshot = decodeCoordinatorStateSnapshot(
      record.before,
      record.repository.repositoryBinding,
    );
    const operation = snapshot?.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    if (
      !(
        record.hostCleanup === "absent" &&
        record.hostCleanupPublication === null &&
        operation?.host.cleanup === "confirmed"
      )
    ) {
      reason = "docker_task_recovery_host_cleanup_unconfirmed";
      if (!cleanupRuntimeOwnedDockerTaskHost(capability))
        throw new Error(reason);
    }
    hostCleanupConfirmed = true;
    settled = true;
  } catch (error) {
    reason = safeRecoveryReason(error, "docker_task_recovery_failed_closed");
  } finally {
    try {
      released = releaseRuntimeOwnedDockerTaskRecoveryPreparation(capability);
    } catch {
      released = false;
    }
  }
  const state = {
    ...base,
    reason,
    dockerCleanupConfirmed,
    hostCleanupConfirmed,
    locksReleased: released,
  };
  if (!settled || !released)
    return Object.freeze({
      ...state,
      reason: settled ? "docker_task_recovery_release_unconfirmed" : reason,
      cleanupReason: released
        ? null
        : "docker_task_recovery_release_unconfirmed",
    });
  if (record?.kind === "recovery" && record.completionPending)
    return Object.freeze({
      ...state,
      status: "completed" as const,
      reason: "docker_task_recovery_runtime_state_settled",
      historyConfirmed: true,
      preparation: capability,
    });
  let historyConfirmed = false;
  let finalizationReason = "docker_task_recovery_terminal_unconfirmed";
  try {
    await yieldRecoveryEvents();
    if (signal?.aborted)
      return Object.freeze({
        ...state,
        reason: "docker_task_recovery_cancelled",
      });
    const terminal =
      finalizeRuntimeOwnedDockerTaskRecoveryPreparation(capability);
    if (
      terminal.status !== "completed" ||
      !terminal.snapshotConfirmed ||
      !terminal.lockReleased
    )
      return Object.freeze({
        ...state,
        reason: "docker_task_recovery_terminal_unconfirmed",
        locksReleased: terminal.lockReleased,
        cleanupReason: terminal.lockReleased
          ? null
          : "docker_task_recovery_release_unconfirmed",
      });
    await yieldRecoveryEvents();
    if (signal?.aborted)
      return Object.freeze({
        ...state,
        reason: "docker_task_recovery_cancelled",
      });
    finalizationReason = "docker_task_recovery_history_unconfirmed";
    const history = completeRuntimeOwnedDockerTaskRecoveryHistory(capability);
    historyConfirmed = history.historyConfirmed;
    if (
      history.status !== "completed" ||
      !history.historyConfirmed ||
      !history.lockReleased
    )
      return Object.freeze({
        ...state,
        reason: history.reason,
        locksReleased: history.lockReleased,
        historyConfirmed,
        cleanupReason: history.lockReleased
          ? null
          : "docker_task_recovery_release_unconfirmed",
      });
    await yieldRecoveryEvents();
    if (signal?.aborted)
      return Object.freeze({
        ...state,
        historyConfirmed: true,
        reason: "docker_task_recovery_cancelled",
      });
    finalizationReason = "docker_task_recovery_delivery_unconfirmed";
    const delivery = registerRuntimeOwnedDockerTaskRecoveryDelivery(capability);
    if (
      delivery.status !== "completed" ||
      !delivery.snapshotConfirmed ||
      !delivery.lockReleased
    )
      return Object.freeze({
        ...state,
        historyConfirmed: true,
        reason: delivery.reason,
        locksReleased: delivery.lockReleased,
        deliveryPending: delivery.snapshotConfirmed && delivery.deliveryPending,
        cleanupReason: delivery.lockReleased
          ? null
          : "docker_task_recovery_release_unconfirmed",
      });
    return Object.freeze({
      ...state,
      status: "completed" as const,
      reason: "docker_task_recovery_runtime_state_settled",
      historyConfirmed: true,
      deliveryPending: delivery.deliveryPending,
      preparation: capability,
    });
  } catch {
    if (record?.kind === "recovery") record.persistenceFailed = true;
    return Object.freeze({
      ...state,
      reason: finalizationReason,
      historyConfirmed,
    });
  }
}

/**
 * 真正な技術回収済みOwnerからtransient操作だけを終了整理する。
 * @responsibility 表示受付を回復条件へ加えず、現在の終了Writerへ一回接続する。
 * @trace ARCH-000008
 * @input capability: 現在回収組立てが保持する内部準備キー。
 * @returns 対象操作の整理保存、排他解放と保持状態。
 * @precondition 同Ownerの技術回収・全解放・終端保存が完了している。
 * @postcondition durable受領、元Task成功、回答の再配送を生成しない。
 * @effect 既存State Writerによる対象transient操作の除去だけ。
 * @failure 偽Owner、再試行、不明、保存失敗では同じ参照を保持して停止する。
 * @invariant Provider要求・Docker再起動・新しい表示Receiptを発行しない。
 * @boundary 現在回収Ownerと保存Ownerの終了処理。
 * @security Root＋IDやCaller成功値だけから終了を許可しない。
 * @concurrency 試行前に一回性を固定し、各Writer確認でRoot・Host両不存在を再観測する。
 */
export function completeRuntimeOwnedDockerTaskTransientRecovery(
  capability: unknown,
) {
  const refused = Object.freeze({
    status: "blocked" as const,
    reason: "docker_task_recovery_completion_unconfirmed",
    snapshotConfirmed: false,
    lockReleased: true,
    filesystemEffectIssued: false,
    operationRemovalConfirmed: false,
    taskRecoveryCompleted: false,
  });
  if (!capability || typeof capability !== "object") return refused;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    !record.closed ||
    !record.releaseAttempted ||
    !record.releaseConfirmed ||
    (!record.finalizationAttempted && !record.completionPending) ||
    record.completionAttempted ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanup !== "absent" ||
    record.hostCleanupPublication !== null
  )
    return refused;
  record.completionAttempted = true;
  let active = true;
  try {
    const saved = completeRuntimeOwnedCoordinatorCurrentRecovery(
      record.rootCapability,
      record.recoveryId,
      () => {
        if (
          !active ||
          dockerRecoveryPreparations.get(capability) !== record ||
          record.persistenceFailed ||
          record.cleanupUnknown ||
          !record.repository.revalidate()
        )
          return false;
        const host = observeHostRecoveryCleanup(
          record.hostToken,
          record.hostRoot,
        );
        return host.root === "absent" && host.marker === "absent";
      },
    );
    const completed =
      saved.status === "completed" &&
      saved.snapshotConfirmed &&
      saved.lockReleased;
    if (!completed) {
      record.persistenceFailed = true;
      record.cleanupUnknown ||= !saved.lockReleased;
    }
    return Object.freeze({
      ...saved,
      status: completed ? "completed" : "blocked",
      reason:
        completed || saved.status !== "completed"
          ? saved.reason
          : "docker_task_recovery_completion_unconfirmed",
      cleanupReason: saved.lockReleased
        ? null
        : "docker_task_recovery_release_unconfirmed",
      operationRemovalConfirmed: completed,
      taskRecoveryCompleted: completed,
    });
  } catch {
    record.persistenceFailed = true;
    return refused;
  } finally {
    active = false;
  }
}

/**
 * 現在Ownerと固定DI操作を結合して五資源だけを回収する。
 * @responsibility 発見IDの保存・読戻しを削除前に完了し、Host清掃とTask完了を所有しない。
 * @trace ARCH-000008
 * @input capability: genuine現在回収Owner。operations: 同Ownerの処置前確認を結合した既存DI Executor。
 * @returns 同じ回復参照、Docker回収確認と固定理由。Task完了ではない。
 * @precondition 呼出し元がDI各要求直前の確認へ同じOwnerを結合する。本番config接続は別途必要。
 * @postcondition Host、Lease、一次失敗、最終結果と他操作は変更しない。
 * @effect DIの固定観測・exact ID削除と、既存resource／cleanup Writerだけ。
 * @failure Owner・保存・読戻し・例外不明は後続処置停止。未発見・構成差はunknown。
 * @invariant unknownを未発行へ戻さず、既存absenceを失敗で消さない。
 * @boundary Coordinator現在状態とDocker Isolationの三つの固定操作。
 * @security 名前だけで削除せず、raw argv・新Registry・新Lockを導入しない。
 * @concurrency 各DI操作前後と各Writerで元版・保持Ownerを再確認する。
 */
export function recoverRuntimeOwnedDockerTaskResources(
  capability: unknown,
  operations: RecoveryDockerOperations | null,
) {
  const record =
    capability && typeof capability === "object"
      ? dockerRecoveryPreparations.get(capability)
      : null;
  const result = (confirmed: boolean, reason: string) =>
    Object.freeze({
      status: confirmed ? "completed" : "blocked",
      recoveryId: record?.kind === "recovery" ? record.recoveryId : null,
      dockerCleanupConfirmed: confirmed,
      reason,
    });
  if (
    !capability ||
    typeof capability !== "object" ||
    record?.kind !== "recovery" ||
    record.closed ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanupPublication !== null
  )
    return result(false, "docker_task_recovery_owner_unconfirmed");
  const current = () => {
    if (record.persistenceFailed || record.cleanupUnknown)
      throw new Error("docker_task_recovery_owner_unconfirmed");
    if (!assertCurrentRecoveryOwner(capability, record)) {
      record.persistenceFailed = true;
      throw new Error("docker_task_recovery_owner_unconfirmed");
    }
    const read = readRuntimeOwnedCoordinatorRecoverySnapshot(
      record.rootCapability,
    );
    if (!read.lockReleased) record.cleanupUnknown = true;
    if (
      read.status !== "completed" ||
      !read.value ||
      !read.lockReleased ||
      !Buffer.from(
        `${encodeCoordinatorStateValue(read.value.snapshot)}\n`,
      ).equals(record.before)
    ) {
      record.persistenceFailed = true;
      throw new Error("docker_task_recovery_boundary_changed");
    }
    const operation = read.value.snapshot.operations.find(
      (value): value is CoordinatorStateTaskOperation =>
        value.kind === "docker_task" && value.recoveryId === record.recoveryId,
    );
    if (!operation) throw new Error("docker_task_recovery_resource_missing");
    return operation;
  };
  try {
    const initial = current();
    const observations = new Map<
      CoordinatorStateTaskOperation["resources"][number]["purpose"],
      "not_requested" | "absent" | "unknown"
    >();
    for (const entry of currentDockerRecoveryResourceExpectations(initial)) {
      let resource = current().resources.find(
        (value) => value.purpose === entry.purpose,
      );
      if (!resource) throw new Error("docker_task_recovery_resource_missing");
      if (
        resource.request === "not_requested" ||
        resource.request === "not_issued"
      ) {
        observations.set(entry.purpose, "not_requested");
        continue;
      }
      if (!operations)
        throw new Error("docker_task_recovery_executor_unavailable");
      if (resource.request === "intent_saved") {
        if (
          !persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
            capability,
            "resource",
            { ...resource, request: "unknown" },
          )
        )
          return result(false, "docker_task_recovery_checkpoint_unconfirmed");
        resource = current().resources.find(
          (value) => value.purpose === entry.purpose,
        );
        if (!resource) throw new Error("docker_task_recovery_resource_missing");
      }
      let dockerId = resource.dockerId;
      if (resource.request !== "identified") {
        for (const expectation of entry.expectations) {
          current();
          dockerId = operations.discoverSubmitted(expectation);
          current();
          if (dockerId !== null) break;
        }
        if (dockerId === null) {
          observations.set(entry.purpose, "unknown");
          continue;
        }
        if (
          !persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
            capability,
            "resource",
            {
              ...resource,
              request: "identified",
              dockerId,
              receiptSource: "runtime_reconciliation",
              observation: "present",
              absence: null,
            },
          )
        )
          return result(false, "docker_task_recovery_checkpoint_unconfirmed");
        current();
      }
      if (!dockerId) throw new Error("docker_task_recovery_resource_missing");
      let absent = false;
      for (const expectation of entry.expectations) {
        current();
        absent = operations.recoverObserved(
          { ...expectation, dockerId },
          {
            assertBeforeRemoval: () => {
              current();
              return true;
            },
          },
        );
        current();
        if (absent) break;
      }
      if (!absent && resource.observation === "absent")
        return result(false, "docker_task_recovery_resource_unconfirmed");
      observations.set(entry.purpose, absent ? "absent" : "unknown");
    }
    const operation = current();
    const entries = currentDockerRecoveryResourceExpectations(operation);
    const cleanup = operation.resources.map((resource) => {
      const expectation = entries.find(
        (entry) => entry.purpose === resource.purpose,
      )?.expectations[0];
      if (!expectation)
        throw new Error("docker_task_recovery_resource_missing");
      return {
        purpose: resource.purpose,
        plannedResourceName: expectation.expectedName,
        dockerId: resource.dockerId,
        observation: observations.get(resource.purpose),
      };
    });
    const preservesAuthenticationClosure =
      coordinatorTaskResourcesAreSettled(operation) &&
      operation.resources.some(
        (resource) =>
          resource.purpose === "create_subscription_auth_probe" &&
          resource.request === "unknown",
      );
    if (
      !preservesAuthenticationClosure &&
      !persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
        capability,
        "cleanup",
        cleanup,
      )
    )
      return result(false, "docker_task_recovery_checkpoint_unconfirmed");
    const closureOperation = current();
    if (coordinatorAuthenticationUnknownCanClose(closureOperation)) {
      if (!operations)
        return result(false, "docker_task_recovery_executor_unavailable");
      const identity = JSON.parse(closureOperation.identityJson);
      const rounds: Array<{ round: number; name: string; name_label: string }> =
        [];
      for (const round of [1, 2]) {
        current();
        if (
          operations.observeAbsent(
            "container",
            identity.resources.auth,
            identity.ownershipLabel,
          ) !== true
        )
          return result(
            false,
            "docker_task_recovery_authentication_absence_unconfirmed",
          );
        current();
        rounds.push({ round, name: "absent", name_label: "absent" });
      }
      current();
      record.persistenceFailed = true;
      const saved = writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure(
        record.repository,
        record.recoveryId,
        record.before,
        rounds,
        () =>
          !record.cleanupUnknown &&
          assertCurrentRecoveryOwner(capability, record),
      );
      if (!saved.lockReleased) record.cleanupUnknown = true;
      if (
        saved.status !== "completed" ||
        !saved.snapshotConfirmed ||
        !saved.lockReleased
      )
        return result(false, "docker_task_recovery_checkpoint_unconfirmed");
      const read = readRuntimeOwnedCoordinatorRecoverySnapshot(
        record.rootCapability,
      );
      if (!read.lockReleased) record.cleanupUnknown = true;
      if (
        read.status !== "completed" ||
        !read.value ||
        !read.lockReleased ||
        read.value.snapshot.revision !== saved.revision ||
        read.value.payloadSha256 !== saved.payloadSha256
      )
        return result(false, "docker_task_recovery_checkpoint_unconfirmed");
      record.before = Buffer.from(
        `${encodeCoordinatorStateValue(read.value.snapshot)}\n`,
      );
      record.persistenceFailed = !assertCurrentRecoveryOwner(
        capability,
        record,
      );
      if (record.persistenceFailed)
        return result(false, "docker_task_recovery_owner_unconfirmed");
      return result(true, "docker_task_recovery_resources_clean");
    }
    const confirmed = cleanup.every((value) => value.observation !== "unknown");
    return result(
      confirmed,
      confirmed
        ? "docker_task_recovery_resources_clean"
        : "docker_task_recovery_resource_unconfirmed",
    );
  } catch {
    record.persistenceFailed = true;
    return result(false, "docker_task_recovery_execution_unconfirmed");
  }
}

/**
 * 現在Hostの借用管理領域と下位所有の短命configを実回収へ接続する。
 * @responsibility Docker設定のFilesystem処置を下位へ閉じ、全返却経路でcloseする。
 * @trace ARCH-000008
 * @input capability: genuine現在回収Owner。
 * @returns 同じ参照の資源回収結果と、configだけの回収確認。
 * @precondition 現在Root・Host／Home／Runtime排他と既存CLI出所観測が使用可能である。
 * @postcondition Host清掃、Lease解放、Task再実行とConsumer受領を確定しない。
 * @effect 下位の短命設定作成・固定Docker回収・設定close、固定state保存。
 * @failure 借用・作成・実行・close不明は同じ参照でblockedを返す。
 * @invariant 旧management復元、上位のDocker OS判定と設定Filesystem操作を行わない。
 * @boundary 現在Owner→既存Host借用→Docker Isolationの実操作。
 * @security 任意所在や署名資格を処置許可として受けない。
 * @concurrency 各spawn前と削除直前に同Ownerを再確認し、close不明を保持する。
 */
export function executeRuntimeOwnedDockerTaskResourceRecovery(
  capability: unknown,
) {
  const record =
    capability && typeof capability === "object"
      ? dockerRecoveryPreparations.get(capability)
      : null;
  const blocked = (
    reason: string,
    configCleanupConfirmed = record?.kind === "recovery"
      ? !record.cleanupUnknown
      : true,
  ) =>
    Object.freeze({
      status: "blocked",
      recoveryId: record?.kind === "recovery" ? record.recoveryId : null,
      dockerCleanupConfirmed: false,
      configCleanupConfirmed,
      reason,
    });
  if (
    !capability ||
    typeof capability !== "object" ||
    record?.kind !== "recovery" ||
    record.closed ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanupPublication !== null ||
    !assertCurrentRecoveryOwner(capability, record)
  )
    return blocked("docker_task_recovery_owner_unconfirmed");
  const snapshot = decodeCoordinatorStateSnapshot(
    record.before,
    record.repository.repositoryBinding,
  );
  const operation = snapshot?.snapshot.operations.find(
    (value): value is CoordinatorStateTaskOperation =>
      value.kind === "docker_task" && value.recoveryId === record.recoveryId,
  );
  if (!operation) return blocked("docker_task_recovery_resource_missing");
  if (
    operation.resources.every((value) =>
      ["not_requested", "not_issued"].includes(value.request),
    )
  )
    return Object.freeze({
      ...recoverRuntimeOwnedDockerTaskResources(capability, null),
      configCleanupConfirmed: true,
    });
  const borrowed = borrowHostRecoveryManagementDirectory(
    record.hostToken,
    record.hostGeneration,
  );
  if (!borrowed) {
    record.persistenceFailed = true;
    return blocked("docker_task_recovery_host_borrow_unconfirmed");
  }
  const created = createDockerTaskRecoveryExecutor({
    managementDirectory: borrowed.directory,
    assertOwner: () =>
      !record.persistenceFailed &&
      !record.cleanupUnknown &&
      assertCurrentRecoveryOwner(capability, record) &&
      borrowed.assertCurrent(),
  });
  if (created.status !== "ready" || !created.executor) {
    record.cleanupUnknown ||= !created.cleanupConfirmed;
    record.persistenceFailed = true;
    return blocked(created.reason, created.cleanupConfirmed);
  }
  let recovery: ReturnType<typeof recoverRuntimeOwnedDockerTaskResources> & {
    configCleanupConfirmed: boolean;
  } = blocked("docker_task_recovery_execution_unconfirmed");
  let configCleanupConfirmed = false;
  try {
    recovery = Object.freeze({
      ...recoverRuntimeOwnedDockerTaskResources(capability, created.executor),
      configCleanupConfirmed: false,
    });
  } catch {
    record.persistenceFailed = true;
  } finally {
    try {
      configCleanupConfirmed = created.executor.close() === true;
    } catch {
      configCleanupConfirmed = false;
    }
    record.cleanupUnknown ||= !configCleanupConfirmed;
  }
  return Object.freeze({
    ...recovery,
    status: configCleanupConfirmed ? recovery.status : "blocked",
    configCleanupConfirmed,
    reason: configCleanupConfirmed
      ? recovery.reason
      : "docker_task_recovery_config_cleanup_unconfirmed",
  });
}

/**
 * Task資源の要求前で、再起動義務も終了条件を満たす初期切断を識別する。
 * @responsibility 未要求の初期操作を再導出し、退役と清掃進捗以外の変化を拒否する。
 * @trace ARCH-000008
 * @input operation: 検証済み対象操作、snapshot: 同じ現在本文、hostToken: 私有Ownerのtoken、hostState: 実marker状態。
 * @returns 初期操作との差がOwner退役・清掃進捗・終了確認済み再起動記録だけの場合にtrue。
 * @precondition 呼出し元が真正Owner・元版・世代排他・実markerを検証済みである。
 * @postcondition Docker不存在、Host清掃、Task完了を確定しない。
 * @effect N/A: 既存純粋modelによる再導出と比較だけを行う。
 * @failure 不正導出・初期形との差・対象参照や配送ありはfalse。
 * @invariant 発行後unknownやnot_issuedを未要求の初期切断へ変換しない。
 * @boundary 現在状態modelと実markerの読取り結果。
 * @security JSONだけから処置Authorityを生成しない。
 * @concurrency N/A: 同期判定だけ。排他・元版の再確認は呼出し元が所有する。
 */
function isUnsubmittedInitialTaskHost(
  operation: CoordinatorStateTaskOperation,
  snapshot: CoordinatorStateSnapshot,
  hostToken: string,
  hostState: unknown,
): boolean {
  if (
    hostState !== "host_only" ||
    hostToken !== operation.host.currentToken ||
    !isDockerRestartCheckpointSettled(operation.dockerRestart) ||
    !["not_requested", "pending"].includes(operation.host.cleanup)
  )
    return false;
  const bytes = prepareCoordinatorStateOperationSnapshot(
    null,
    operation.identityJson,
    snapshot.repositoryBinding,
  );
  const initial = bytes
    ? decodeCoordinatorStateSnapshot(bytes, snapshot.repositoryBinding)
        ?.snapshot.operations[0]
    : null;
  if (initial?.kind !== "docker_task") return false;
  const nonce = JSON.parse(operation.identityJson).operationNonce;
  if (
    [...snapshot.unresolvedRecoveries, ...snapshot.pendingDeliveries].some(
      (entry) =>
        entry.recoveryId === operation.recoveryId ||
        entry.operationNonce === nonce,
    )
  )
    return false;
  return (
    encodeCoordinatorStateValue(operation) ===
    encodeCoordinatorStateValue({
      ...initial,
      phase: "settling",
      dockerRestart: operation.dockerRestart,
      host: { ...initial.host, cleanup: operation.host.cleanup },
      execution: { ...initial.execution, ownerEffect: "disabled" },
    })
  );
}

/**
 * 回収済み資源に対応するHost不存在遷移を現在stateと共同確定する。
 * @responsibility 遷移前意図の保存と実marker確認を、同じ回収Ownerへ結合する。
 * @trace ARCH-000008
 * @input capability: 既存準備Mapの真正な回収Owner。
 * @returns 遷移後tokenの保存・読戻しまで確認できた場合だけtrue。
 * @precondition 元OwnerはEffect不能で、五資源は既知の終了条件を満たす。
 * @postcondition Host領域やmarkerの削除、Lease解放、Task成功は確定しない。未submissionの初期切断だけは遷移不要とする。
 * @effect 同RootのHost状態遷移と同じ操作の固定host欄だけを保存する。
 * @failure 失効、元版差、保存・処置返却不明は停止し、同Ownerで再処置しない。
 * @invariant 過去Create unknownを消さず、予定token以外を採用しない。
 * @boundary 現在回収Owner・固定Writerと既存Host遷移。
 * @security 旧managementを復元せず、保存意図だけから処置Ownerを生成しない。
 * @concurrency Host／Home／Runtime排他を保持し、処置・保存直前に再確認する。
 */
export function confirmRuntimeOwnedDockerTaskHostAbsence(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    record.closed ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanupPublication !== null
  )
    return false;
  try {
    if (!assertCurrentRecoveryOwner(capability, record)) return false;
    const current = readRuntimeOwnedCoordinatorRecoverySnapshot(
      record.rootCapability,
    );
    if (!current.lockReleased) record.cleanupUnknown = true;
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      !Buffer.from(
        `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
      ).equals(record.before)
    )
      throw new Error("docker_task_recovery_boundary_changed");
    const operation = current.value.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    if (
      operation?.execution.ownerEffect !== "disabled" ||
      !coordinatorTaskResourcesAreSettled(operation)
    )
      return false;
    const loaded = loadHostRecoveryRecordByToken(
      record.hostToken,
      record.hostRoot,
    );
    if (
      isUnsubmittedInitialTaskHost(
        operation,
        current.value.snapshot,
        record.hostToken,
        loaded.record.state,
      )
    )
      return true;
    if (
      operation.host.pendingTransitionJson === null &&
      loaded.record.state === "docker_absent_confirmed"
    )
      return record.hostToken === operation.host.currentToken;
    const intent =
      operation.host.pendingTransitionJson === null
        ? expectedHostSuccessor(
            operation.host.currentToken,
            "docker_absent_confirmed",
            record.hostRoot,
          )
        : JSON.parse(operation.host.pendingTransitionJson);
    const lineage = validateHostRecoveryTransitionLineage(
      intent,
      "docker_absent_confirmed",
    );
    if (
      intent.currentState !== "docker_submission_started" ||
      lineage.currentToken !== operation.host.currentToken
    )
      throw new Error("docker_task_recovery_host_transition_mismatch");
    if (operation.host.pendingTransitionJson === null) {
      if (
        !persistRuntimeOwnedDockerTaskRecoveryCheckpoint(capability, "host", {
          ...operation.host,
          pendingTransitionJson: canonical(intent),
        })
      )
        return false;
    }
    // 同じ意図の耐久化後だけ、旧markerから一度遷移する。
    if (!assertCurrentRecoveryOwner(capability, record))
      throw new Error("docker_task_recovery_owner_unconfirmed");
    if (record.hostToken === lineage.currentToken) {
      const beforeEffect = readRuntimeOwnedCoordinatorRecoverySnapshot(
        record.rootCapability,
      );
      if (!beforeEffect.lockReleased) record.cleanupUnknown = true;
      if (
        beforeEffect.status !== "completed" ||
        !beforeEffect.value ||
        !beforeEffect.lockReleased ||
        !Buffer.from(
          `${encodeCoordinatorStateValue(beforeEffect.value.snapshot)}\n`,
        ).equals(record.before) ||
        !assertCurrentRecoveryOwner(capability, record)
      )
        throw new Error("docker_task_recovery_boundary_changed");
      const updated = confirmOwnedDockerAbsenceForRecovery(
        record.hostToken,
        record.hostGeneration,
      );
      if (updated !== lineage.expectedToken)
        throw new Error("docker_task_recovery_host_transition_mismatch");
      const observed = loadHostRecoveryRecordByToken(updated, record.hostRoot);
      if (
        observed.serialized !==
        canonical({ ...intent.recordBefore, state: "docker_absent_confirmed" })
      )
        throw new Error("docker_task_recovery_host_transition_mismatch");
      record.hostToken = updated;
    } else if (record.hostToken !== lineage.expectedToken) {
      throw new Error("docker_task_recovery_host_transition_mismatch");
    }
    if (!assertCurrentRecoveryOwner(capability, record))
      throw new Error("docker_task_recovery_owner_unconfirmed");
    return persistRuntimeOwnedDockerTaskRecoveryCheckpoint(capability, "host", {
      ...operation.host,
      currentToken: lineage.expectedToken,
      pendingTransitionJson: null,
    });
  } catch {
    record.persistenceFailed = true;
    return false;
  }
}

/**
 * 同じ現在OwnerでHost清掃の意図・処置・確定を閉じる。
 * @responsibility 物理清掃後も世代排他と両不存在を保持し、保存だけの再入場を許可する。
 * @trace ARCH-000008
 * @input capability: genuineな現在回収準備。
 * @returns Host清掃確定、または既確定かつ現在不存在の場合だけtrue。
 * @precondition Owner Effect無効・五資源既知終端・Host遷移確定済みである。
 * @postcondition 清掃予定を保存してから削除し、実不存在後だけHost一欄を確定する。
 * @effect 同じHost Root／markerの回収と固定現在状態保存。
 * @failure 保存・元版・排他・処置・観測不明では同じ参照とpendingを保持する。
 * @invariant Host清掃だけからTask成功・Lease解放・全体回復を推定しない。
 * @boundary 現在回収Owner、Host回収と既存状態Writer。
 * @security 任意Path・対象・callbackを受け取らず、一般checkpointのconfirmed拒否を維持する。
 * @concurrency 処置直前と保存排他下で同じ世代・現在版・不存在を再確認する。
 */
export function cleanupRuntimeOwnedDockerTaskHost(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    record.closed ||
    record.persistenceFailed ||
    record.cleanupUnknown
  )
    return false;
  try {
    if (!assertCurrentRecoveryOwner(capability, record)) return false;
    const current = record.hostCleanupPublication
      ? readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot(
          record.rootCapability,
          record.recoveryId,
        )
      : readRuntimeOwnedCoordinatorRecoverySnapshot(record.rootCapability);
    if (!current.lockReleased) record.cleanupUnknown = true;
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      !Buffer.from(
        `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
      ).equals(record.before)
    )
      throw new Error("docker_task_recovery_boundary_changed");
    const operation = current.value.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    if (
      !operation ||
      operation.host.currentToken !== record.hostToken ||
      operation.host.pendingTransitionJson !== null ||
      operation.execution.ownerEffect !== "disabled" ||
      !coordinatorTaskResourcesAreSettled(operation)
    )
      return false;
    if (
      operation.host.cleanup === "confirmed" &&
      !record.hostCleanupPublication
    )
      return (
        record.hostCleanup === "absent" &&
        assertCurrentRecoveryOwner(capability, record)
      );
    if (
      record.hostCleanup === "absent" &&
      operation.host.cleanup === "not_requested" &&
      !persistRuntimeOwnedDockerTaskRecoveryCheckpoint(capability, "host", {
        ...operation.host,
        cleanup: "pending",
      })
    )
      return false;
    if (record.hostCleanup === "present") {
      const loaded = loadHostRecoveryRecordByToken(
        record.hostToken,
        record.hostRoot,
      );
      if (
        loaded.record.state !== "docker_absent_confirmed" &&
        !isUnsubmittedInitialTaskHost(
          operation,
          current.value.snapshot,
          record.hostToken,
          loaded.record.state,
        )
      )
        return false;
      if (
        operation.host.cleanup === "not_requested" &&
        !persistRuntimeOwnedDockerTaskRecoveryCheckpoint(capability, "host", {
          ...operation.host,
          cleanup: "pending",
        })
      )
        return false;
      const beforeEffect = readRuntimeOwnedCoordinatorRecoverySnapshot(
        record.rootCapability,
      );
      if (!beforeEffect.lockReleased) record.cleanupUnknown = true;
      if (
        beforeEffect.status !== "completed" ||
        !beforeEffect.value ||
        !beforeEffect.lockReleased ||
        !Buffer.from(
          `${encodeCoordinatorStateValue(beforeEffect.value.snapshot)}\n`,
        ).equals(record.before) ||
        !assertCurrentRecoveryOwner(capability, record)
      )
        throw new Error("docker_task_recovery_boundary_changed");
      const result = recoverOwnedOperationDirectories(
        record.hostToken,
        record.hostGeneration,
        record.hostRoot,
      );
      const observed = observeHostRecoveryCleanup(
        record.hostToken,
        record.hostRoot,
      );
      if (
        result.status !== "recovered" ||
        observed.root !== "absent" ||
        observed.marker !== "absent"
      ) {
        record.hostCleanup = "unknown";
        throw new Error("docker_task_recovery_host_cleanup_unconfirmed");
      }
      record.hostCleanup = "absent";
    }
    if (
      record.hostCleanup !== "absent" ||
      !assertCurrentRecoveryOwner(capability, record)
    )
      return false;
    const prior = JSON.parse(record.before.toString("utf8")) as {
      operations: CoordinatorStateOperation[];
    };
    const priorOperation = prior.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    if (!priorOperation) return false;
    const expected =
      record.hostCleanupPublication?.candidate ??
      prepareCoordinatorStateHostSnapshot(
        record.before,
        record.recoveryId,
        { ...priorOperation.host, cleanup: "confirmed" },
        record.repository.repositoryBinding,
      );
    if (!expected) return false;
    record.persistenceFailed = true;
    const saved = writeRuntimeOwnedCoordinatorRecoveredHostCleanup(
      record.repository,
      record.recoveryId,
      record.before,
      () =>
        record.hostCleanup === "absent" &&
        assertCurrentRecoveryOwner(capability, record),
      record.hostCleanupPublication,
    );
    if (!saved.lockReleased) record.cleanupUnknown = true;
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased
    )
      return false;
    const after = readRuntimeOwnedCoordinatorRecoverySnapshot(
      record.rootCapability,
    );
    if (!after.lockReleased) record.cleanupUnknown = true;
    if (
      after.status !== "completed" ||
      !after.value ||
      !after.lockReleased ||
      after.value.snapshot.revision !== saved.revision ||
      after.value.payloadSha256 !== saved.payloadSha256 ||
      !Buffer.from(
        `${encodeCoordinatorStateValue(after.value.snapshot)}\n`,
      ).equals(expected) ||
      !assertCurrentRecoveryOwner(capability, record)
    )
      return false;
    record.before = expected;
    record.hostCleanupPublication = null;
    record.persistenceFailed = false;
    return true;
  } catch {
    record.cleanupUnknown = true;
    return false;
  }
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
    dockerIsolationResourceIdentityIsValid({
      authenticationContainerName: plan.authContainerName,
      executionContainerName: plan.providerContainerName,
      proxyContainerName: plan.proxyContainerName,
      internalNetworkName: plan.internalNetworkName,
      egressNetworkName: plan.egressNetworkName,
      ownershipLabel: plan.ownershipLabel,
      executionImageDigest: plan.providerImageDigest,
      proxyImageDigest: plan.proxyImageDigest,
    }) &&
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
function expectedHostSuccessor(
  currentToken: string,
  nextState: string,
  expectedRoot: string,
) {
  const loaded = loadHostRecoveryRecordByToken(currentToken, expectedRoot);
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
      current.value?.snapshot.operations.some((item) =>
        item.kind === "runtime_repair"
          ? item.phase !== "awaiting_delivery"
          : JSON.parse(item.identityJson).stableLogicalHomeBindingHash ===
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
      ...(plan.workspaceProtection
        ? {
            workspaceProtected: true,
            workspaceProtection: plan.workspaceProtection,
          }
        : {}),
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
    .find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    )
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
    (item): item is CoordinatorStateTaskOperation =>
      item.kind === "docker_task" && item.recoveryId === record.recoveryId,
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
    .find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    )
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
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
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
    (item): item is CoordinatorStateTaskOperation =>
      item.kind === "docker_task" && item.recoveryId === record.recoveryId,
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
      execution: { ...operation.execution, ownerEffect: "disabled" },
      primaryFailure: operation.primaryFailure,
      outcome: operation.outcome,
      summarySha256: operation.summarySha256,
    },
  );
  if (
    saved.status !== "completed" ||
    !saved.snapshotConfirmed ||
    !saved.lockReleased
  )
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
    (item): item is CoordinatorStateTaskOperation =>
      item.kind === "docker_task" && item.recoveryId === record.recoveryId,
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
 * 現在資源回収が利用するDIの固定操作型を結合する。
 * @responsibility 下位の三固定操作だけを現在Ownerへ搬送する。
 * @trace ARCH-000008
 * @shape DI公開Executorの戻り値型。
 * @invariant 旧回復記録や上位状態を下位へ持ち込まない。
 * @boundary 現在OwnerとDI公開契約。
 * @security N/A: 型定義でありAuthorityを発行しない。
 * @compatibility DI公開契約に追従する。
 */
type RecoveryDockerOperations = ReturnType<
  typeof createDockerResourceRecoveryExecutor
>;

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
 * 実行資源の義務が残る操作だけを再起動Scopeへ含める。
 * @responsibility 配送待ちだけの清掃済み操作と実行義務を区別する。
 * @trace ARCH-000008
 * @input operation: 検証済み現在操作。
 * @returns 実行義務が残る場合だけtrue。
 * @precondition 現在Repositoryと既存準備Ownerだけを使用する。
 * @postcondition 不明を成功・未発行・新しい処置許可へ変換しない。
 * @effect N/A: 純粋な現在値評価だけ。
 * @failure 不一致・観測不能・失効では固定拒否する。
 * @invariant 旧AppData・署名・phase記録へfallbackしない。
 * @boundary Repository現在状態と取得済みHost／Home排他。
 * @security 保存値だけから処置Authorityを生成しない。
 * @concurrency 短期状態排他と保持中の実行排他を分ける。
 */
function restartScopeIncludes(
  operation: CoordinatorStateOperation,
): operation is CoordinatorStateTaskOperation {
  if (operation.kind !== "docker_task") return false;
  return (
    operation.phase === "executing" ||
    operation.outcome?.cleanupConfirmed !== true ||
    operation.host.cleanup !== "confirmed" ||
    operation.host.pendingTransitionJson !== null ||
    operation.lease !== "released" ||
    operation.execution.ownerEffect !== "disabled" ||
    operation.execution.providerStart === "unknown" ||
    operation.execution.externalSend === "unknown" ||
    operation.execution.sharedWrite === "unknown" ||
    operation.resources.some(
      (resource) =>
        !["not_requested", "not_issued"].includes(resource.request) &&
        (resource.observation !== "absent" || resource.absence === null),
    )
  );
}
/**
 * 現在のRepository・exact操作・全Scopeを既存排他へ結合する。
 * @responsibility 不透明な準備Mapだけへ現在書込みOwnerを保持する。
 * @trace ARCH-000008
 * @input token: exact回復参照、rootCapability: 検証済みRepository Root。
 * @returns 固定要求IDと不透明な準備、または一次／解放失敗の分離結果。
 * @precondition 現在Repositoryと既存準備Ownerだけを使用する。
 * @postcondition 不明を成功・未発行・新しい処置許可へ変換しない。
 * @effect 既存Host／Home／Runtime排他の取得と現在状態の読取り。Docker要求なし。
 * @failure 不一致・観測不能・失効では固定拒否する。
 * @invariant 旧AppData・署名・phase記録へfallbackしない。
 * @boundary Repository現在状態と取得済みHost／Home排他。
 * @security 保存値だけから処置Authorityを生成しない。
 * @concurrency 短期状態排他と保持中の実行排他を分ける。
 */
export function prepareRuntimeOwnedDockerRestart(
  token: unknown,
  rootCapability: unknown,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  const locks: Array<
    Readonly<{ assertLive: () => boolean; release: () => boolean }>
  > = [];
  let observationCleanupConfirmed = true;
  try {
    if (!parsed) throw new Error("docker_restart_id_invalid");
    const repository =
      borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability);
    const initial = readRuntimeOwnedCoordinatorRecoverySnapshot(rootCapability);
    observationCleanupConfirmed = initial.lockReleased;
    if (
      !repository ||
      initial.status !== "completed" ||
      !initial.value ||
      !initial.lockReleased
    )
      throw new Error("docker_restart_root_unverified");
    const scoped =
      initial.value.snapshot.operations.filter(restartScopeIncludes);
    const target = scoped.find(
      (operation) => operation.recoveryId === parsed.token,
    );
    if (!target) throw new Error("docker_restart_scope_conflict");
    const recoveryIds = normalizeDockerRestartScope(
      scoped.map((operation) => operation.recoveryId),
    );
    const identities = scoped
      .map((operation) => {
        const recovery = parseDockerTaskRecoveryId(operation.recoveryId);
        if (!recovery) throw new Error("docker_restart_scope_conflict");
        return {
          recoveryId: operation.recoveryId,
          identitySha256: operation.identitySha256,
          home: recovery.stableLogicalHomeBindingHash,
          host: parseHostRecoveryToken(operation.host.currentToken),
        };
      })
      .sort((left, right) => left.recoveryId.localeCompare(right.recoveryId));
    const scopeSha256 = createHash("sha256")
      .update(
        JSON.stringify({
          schema: "crdd-coordinator/docker-restart-scope/v1",
          repositoryBinding: repository.repositoryBinding,
          identities,
        }),
      )
      .digest("hex");
    const requestId = createDockerRestartRequestId(
      repository.repositoryBinding,
      target.identitySha256,
      target.recoveryId,
      scopeSha256,
    );
    if (!requestId) throw new Error("docker_restart_scope_conflict");
    const hosts = new Map<string, (typeof identities)[number]["host"]>();
    for (const identity of identities)
      hosts.set(
        `${identity.host.rootName}\0${identity.host.nonce}`,
        identity.host,
      );
    for (const [, host] of [...hosts].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      const lock = acquireRuntimeOwnedHostOperationKernelLock(
        host.rootName,
        host.nonce,
      );
      if (!lock) throw new Error("docker_restart_host_active_or_unknown");
      locks.push(lock);
    }
    for (const home of normalizeDockerRestartScope(
      identities.map((identity) => identity.home),
    )) {
      const lock = acquireRuntimeOwnedLogicalProviderHomeKernelLock(home);
      if (!lock) throw new Error("docker_restart_home_active_or_unknown");
      locks.push(lock);
    }
    const state = acquireRuntimeOwnedDockerRuntimeStateKernelLock(
      repository.repositoryBinding,
    );
    if (!state) throw new Error("docker_restart_state_active_or_unknown");
    locks.push(state);
    const current = readRuntimeOwnedCoordinatorRecoverySnapshot(rootCapability);
    observationCleanupConfirmed &&= current.lockReleased;
    const before = Buffer.from(
      `${encodeCoordinatorStateValue(initial.value.snapshot)}\n`,
    );
    if (
      !locks.every((lock) => lock.assertLive()) ||
      !repository.revalidate() ||
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      !Buffer.from(
        `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
      ).equals(before)
    )
      throw new Error("docker_restart_boundary_changed");
    if (
      target.dockerRestart &&
      (target.dockerRestart.requestId !== requestId ||
        target.dockerRestart.scopeSha256 !== scopeSha256)
    )
      throw new Error("docker_restart_scope_conflict");
    const capability = Object.freeze({});
    dockerRecoveryPreparations.set(capability, {
      kind: "restart",
      repository: Object.freeze({
        ...repository,
        operationId: JSON.parse(target.identityJson).operationId,
      }),
      rootCapability,
      recoveryId: target.recoveryId,
      requestId,
      scopeSha256,
      recoveryIds,
      locks: Object.freeze(locks),
      before,
      checkpoint: target.dockerRestart,
      closed: false,
      persistenceFailed: false,
      cleanupUnknown: false,
      releaseAttempted: false,
      releaseConfirmed: false,
      finalizationAttempted: false,
    });
    return Object.freeze({
      status: "prepared" as const,
      capability,
      recoveryId: target.recoveryId,
      requestId,
      scopeSha256,
      alreadyRequested:
        target.dockerRestart !== null &&
        (target.dockerRestart.request !== "not_issued" ||
          target.dockerRestart.result !== null),
      checkpointInitialized: target.dockerRestart !== null,
      primaryFailure: null,
      cleanupFailure: null,
      cleanupConfirmed: false,
    });
  } catch (error) {
    const fixed = new Set([
      "docker_restart_id_invalid",
      "docker_restart_root_unverified",
      "docker_restart_scope_conflict",
      "docker_restart_host_active_or_unknown",
      "docker_restart_home_active_or_unknown",
      "docker_restart_state_active_or_unknown",
      "docker_restart_boundary_changed",
    ]);
    const primaryFailure =
      error instanceof Error && fixed.has(error.message)
        ? error.message
        : "docker_restart_preparation_unconfirmed";
    let cleanupConfirmed = observationCleanupConfirmed;
    for (const lock of [...locks].reverse()) {
      try {
        if (!lock.release()) cleanupConfirmed = false;
      } catch {
        cleanupConfirmed = false;
      }
    }
    return Object.freeze({
      status: "blocked" as const,
      reason: cleanupConfirmed
        ? primaryFailure
        : "docker_restart_cleanup_unconfirmed",
      primaryFailure,
      cleanupFailure: cleanupConfirmed
        ? null
        : ("docker_restart_cleanup_unconfirmed" as const),
      cleanupConfirmed,
      recoveryId: parsed?.token ?? null,
    });
  }
}
/**
 * 取得済み準備Ownerの排他と現在本文を再確認する。
 * @responsibility 保存値の相関だけで実行許可を推定しない。
 * @trace ARCH-000008
 * @input capability: 既存準備Mapの不透明キー。
 * @returns 同じOwner・Scope・元版の場合だけtrue。
 * @precondition 現在Repositoryと既存準備Ownerだけを使用する。
 * @postcondition 不明を成功・未発行・新しい処置許可へ変換しない。
 * @effect 現在状態Readerと既存排他の観測。
 * @failure 不一致・観測不能・失効では固定拒否する。
 * @invariant 旧AppData・署名・phase記録へfallbackしない。
 * @boundary Repository現在状態と取得済みHost／Home排他。
 * @security 保存値だけから処置Authorityを生成しない。
 * @concurrency 短期状態排他と保持中の実行排他を分ける。
 */
export function verifyRuntimeOwnedDockerRestartPreparation(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (record?.kind !== "restart" || record.closed || record.persistenceFailed)
    return false;
  try {
    if (
      !record.locks.every((lock) => lock.assertLive()) ||
      !record.repository.revalidate()
    )
      return false;
    const current = readRuntimeOwnedCoordinatorRecoverySnapshot(
      record.rootCapability,
    );
    if (!current.lockReleased) record.cleanupUnknown = true;
    return (
      current.status === "completed" &&
      !!current.value &&
      current.lockReleased &&
      Buffer.from(
        `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
      ).equals(record.before)
    );
  } catch {
    return false;
  }
}
/**
 * 同じ準備Ownerの一要求checkpointを現在状態へ保存する。
 * @responsibility 元版競合と保存不明後の追加要求を止める。
 * @trace ARCH-000008
 * @input capability: 準備Mapキー、checkpoint: 同要求の次値。
 * @returns 保存・読戻し・更新排他解放を確認した場合だけtrue。
 * @precondition 現在Repositoryと既存準備Ownerだけを使用する。
 * @postcondition 不明を成功・未発行・新しい処置許可へ変換しない。
 * @effect 対象再起動欄だけの既存Writer更新。
 * @failure 不一致・観測不能・失効では固定拒否する。
 * @invariant 旧AppData・署名・phase記録へfallbackしない。
 * @boundary Repository現在状態と取得済みHost／Home排他。
 * @security 保存値だけから処置Authorityを生成しない。
 * @concurrency 短期状態排他と保持中の実行排他を分ける。
 */
export function persistRuntimeOwnedDockerRestartCheckpoint(
  capability: unknown,
  checkpoint: DockerRestartCheckpoint,
): boolean {
  if (!verifyRuntimeOwnedDockerRestartPreparation(capability)) return false;
  const record = dockerRecoveryPreparations.get(capability as object);
  if (
    record?.kind !== "restart" ||
    checkpoint.requestId !== record.requestId ||
    checkpoint.scopeSha256 !== record.scopeSha256
  )
    return false;
  record.persistenceFailed = true;
  try {
    const saved = writeRuntimeOwnedCoordinatorRestartCheckpoint(
      record.repository,
      record.recoveryId,
      record.before,
      checkpoint,
      () =>
        !record.closed &&
        record.locks.every((lock) => lock.assertLive()) &&
        record.repository.revalidate(),
    );
    if (!saved.lockReleased) record.cleanupUnknown = true;
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased
    )
      return false;
    const observed = readRuntimeOwnedCoordinatorRecoverySnapshot(
      record.rootCapability,
    );
    if (!observed.lockReleased) record.cleanupUnknown = true;
    if (
      observed.status !== "completed" ||
      !observed.value ||
      !observed.lockReleased ||
      observed.value.snapshot.revision !== saved.revision ||
      observed.value.payloadSha256 !== saved.payloadSha256
    )
      return false;
    const operation = observed.value.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    if (
      !operation ||
      encodeCoordinatorStateValue(operation.dockerRestart) !==
        encodeCoordinatorStateValue(checkpoint)
    )
      return false;
    record.before = Buffer.from(
      `${encodeCoordinatorStateValue(observed.value.snapshot)}\n`,
    );
    record.checkpoint = operation.dockerRestart;
    record.persistenceFailed = false;
    return verifyRuntimeOwnedDockerRestartPreparation(capability);
  } catch {
    return false;
  }
}
/**
 * 既存準備Ownerを閉じて全排他を逆順に解放する。
 * @responsibility 一つの解放失敗でも後続解放を省略しない。
 * @trace ARCH-000008
 * @input capability: 準備Mapキー。
 * @returns 全解放が確認できた場合だけtrue。
 * @precondition 現在Repositoryと既存準備Ownerだけを使用する。
 * @postcondition 不明を成功・未発行・新しい処置許可へ変換しない。
 * @effect 取得済み排他の解放だけ。Docker要求なし。
 * @failure 不一致・観測不能・失効では固定拒否する。
 * @invariant 旧AppData・署名・phase記録へfallbackしない。
 * @boundary Repository現在状態と取得済みHost／Home排他。
 * @security 保存値だけから処置Authorityを生成しない。
 * @concurrency 短期状態排他と保持中の実行排他を分ける。
 */
export function releaseRuntimeOwnedDockerRestartPreparation(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (record?.kind !== "restart" || record.closed) return false;
  record.closed = true;
  record.releaseAttempted = true;
  let confirmed = !record.cleanupUnknown;
  for (const lock of [...record.locks].reverse()) {
    try {
      if (!lock.release()) confirmed = false;
    } catch {
      confirmed = false;
    }
  }
  record.releaseConfirmed = confirmed;
  return confirmed;
}

/**
 * 外側排他の解放結果を同じ要求の終端値へ一度だけ確定する。
 * @responsibility 下位技術結果と全Scope解放を、元Ownerのexact要求へ耐久反映する。
 * @trace ARCH-000008
 * @input capability: 元準備Mapキー、result: 同要求のDI返却結果。
 * @returns 終端保存確認と再起動資源Scopeのcleanup確認を別に返す。
 * @precondition 全Scopeの逆順解放を試行済み。同じMap以外からWriterを発行しない。
 * @postcondition 保存拒否・不明でもNative要求・終端保存を再発行しない。
 * @effect 固定現在状態の対象要求だけの既存Writer更新。Docker処置なし。
 * @failure 別要求、元版競合、再使用、解放不明と保存不明を完成へ畳まない。
 * @invariant 一次結果と過去unknownを消さず、短期Writer排他を再起動cleanupへ循環参入させない。
 * @boundary 解放済み元準備Ownerと同じRepositoryの終端保存。
 * @security closed Ownerは新処置・別対象更新のAuthorityを復活させない。
 * @concurrency 試行前に一回性を固定し、Writer内ではRoot実体だけを再確認する。
 */
export function finalizeRuntimeOwnedDockerRestartPreparation(
  capability: unknown,
  result: Awaited<ReturnType<typeof restartDockerRuntime>>,
) {
  const refused = Object.freeze({
    status: "blocked" as const,
    snapshotConfirmed: false,
    lockReleased: true,
    cleanupConfirmed: false,
  });
  if (!capability || typeof capability !== "object") return refused;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "restart" ||
    !record.closed ||
    !record.releaseAttempted ||
    record.finalizationAttempted ||
    result.requestId !== record.requestId
  )
    return refused;
  record.finalizationAttempted = true;
  const cleanupConfirmed = result.cleanupConfirmed && record.releaseConfirmed;
  if (record.checkpoint === null)
    return Object.freeze({ ...refused, cleanupConfirmed });
  if (record.persistenceFailed)
    return Object.freeze({ ...refused, cleanupConfirmed });
  const completed =
    result.status === "completed" &&
    result.restartCompleted &&
    result.delivery !== "unknown" &&
    result.primaryFailure === null &&
    cleanupConfirmed;
  const checkpoint: DockerRestartCheckpoint = Object.freeze({
    ...record.checkpoint,
    cleanup:
      record.checkpoint.request === "not_issued"
        ? "not_required"
        : cleanupConfirmed
          ? "confirmed"
          : "unknown",
    result: Object.freeze({
      status: completed ? ("completed" as const) : ("blocked" as const),
      request: result.request,
      effectOutcomeUnknown: result.effectOutcomeUnknown,
      reason: !cleanupConfirmed
        ? "docker_restart_cleanup_unconfirmed"
        : result.delivery === "unknown"
          ? "docker_restart_record_unconfirmed"
          : result.reason,
    }),
  });
  let writing = true;
  try {
    const saved = writeRuntimeOwnedCoordinatorRestartCheckpoint(
      record.repository,
      record.recoveryId,
      record.before,
      checkpoint,
      () =>
        writing &&
        dockerRecoveryPreparations.get(capability) === record &&
        record.closed &&
        record.releaseAttempted &&
        record.finalizationAttempted &&
        record.repository.revalidate(),
    );
    return Object.freeze({ ...saved, cleanupConfirmed });
  } catch {
    return Object.freeze({ ...refused, cleanupConfirmed });
  } finally {
    writing = false;
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
