/**
 * 実行ホストの操作領域・保存・排他・長期リース・再利用停止を所有する。
 * @responsibility Lockの実体は共通Lockへ任せ、元の試行引渡し、Process世代と回収不明後の不可逆停止を同じ箇所で管理する。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @trace ARCH-000015
 * @boundary 長期リースの保存は実行モデルへ接続する。共通Lockに自動回復を追加しない。
 */

import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  readCoordinatorConfig,
  readExecutionIntelligenceConfig,
} from "../../../configuration-model/src/index.ts";
import type { StoreOptions } from "../../../execution-intelligence/src/index.ts";
import {
  acquireLease,
  type ExecutionStorageBlockedError,
  type LeaseKind,
  type ProjectQueueEntry,
  readLease,
  recoverLease,
  releaseLease,
  updateQueue,
  readState,
  saveOperationStart,
  saveOperationCheckpoint,
  type OperationRecord,
  type StateVersion,
} from "../../../execution-model/src/index.ts";
import {
  acquireLock,
  type Lock,
  type LockResult,
} from "../../../lock/src/index.ts";
import {
  getRepository,
  getRepositoryFromWorkingDirectory,
  registerRepositoryLocalIgnore,
  resolveVerifiedRepositoryRoot,
  type Repository,
  readRepositoryFormat,
  readRepositoryRevision,
  readRepositorySnapshot,
  readRepositoryStorageIdentity,
  readRepositoryEntries,
  readWorkingChanges,
  readFile,
  readCommitFile,
  createCommit,
  createReference,
  removeReference,
  readCommitDiff,
  copyCommitFiles,
} from "../../../version-control/src/index.ts";
import type {
  CoordinatorLease,
  CoordinatorLeaseAcquisitionResolution,
  CoordinatorLeaseOwnerObservation,
  CoordinatorLeaseResult,
  CoordinatorQueueUpdate,
  CoordinatorStateContext,
  BorrowedExecutionTarget,
  HostCompletionTarget,
  WorkspaceResult,
} from "./types.ts";
import {
  COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
  validIdentity,
  snapshotPlainRecord,
  resolveRecoveryReference,
  containsRecognizedSecretMaterial,
  snapshotJsonValue,
} from "./validation.ts";
import { isDeepStrictEqual, types } from "node:util";

/**
 * 一回のWriter呼出しに、借用した実Leaseとその現在観測を結び付ける。
 * @trace ARCH-000004、ARCH-000008
 * @input Writer内でのみ評価するLeaseの読取り。
 * @returns 実Leaseの借用と、同じ実体の現在観測。未借用時は観測しない。
 * @security 保存済みOwnerや別の更新で借用したLeaseを使用しない。
 */
function writerLeaseAccess(readLease: () => CoordinatorLease) {
  let active: ReturnType<typeof borrowCoordinatorActiveLease>;
  return {
    borrowActiveLease: () => {
      active = borrowCoordinatorActiveLease(readLease());
      return active
        ? {
            kind: active.kind,
            repositoryRoot: active.repositoryRoot,
            repositoryBindingId: active.repositoryBindingId,
            projectId: active.projectId,
            queueId: active.queueId,
            ownerGeneration: active.ownerGeneration,
          }
        : undefined;
    },
    isActiveLeaseObserved: () =>
      active !== undefined && activeLeaseIsObserved(active),
  };
}

/**
 * Queue更新を同じ保存Writer内の実Lease照合へ接続する。
 * @responsibility 元の次記録を遅延参照し、実Leaseのborrowと現在観測を同じ更新へ結合する。
 * @trace ARCH-000004、ARCH-000008
 * @input 検証済みRepository・binding、Queue ID、期待世代、元の更新要求。
 * @returns 既存Writerの更新結果をそのまま返す。
 * @precondition Repository参照とbindingは既存受付で確定済み。
 * @postcondition Writer外で実Lease確認を先取りせず、未知Ownerの更新を確定しない。
 * @effect 既存EM WriterによるQueue保存。
 * @failure 対象・世代・Lease不一致は既存Writerの拒否を保持する。
 * @invariant 元nextを展開・複製せず、getterの評価時点を維持する。
 * @boundary 検証済み実行ContextとEMの完成保存。
 * @security 保存されたOwner情報から実Leaseを復元しない。
 * @concurrency 一回のWriter内でborrowした同じLeaseを現在観測する。
 */
export function updateCoordinatorQueue(
  context: Pick<CoordinatorStateContext, "repository" | "repositoryBindingId">,
  queueId: string,
  expectedGeneration: number,
  next: CoordinatorQueueUpdate,
) {
  return updateQueue(context.repository, context.repositoryBindingId, {
    kind: "operation",
    input: [
      queueId,
      expectedGeneration,
      {
        get state() {
          return next.state;
        },
        get resumeCondition() {
          return next.resumeCondition;
        },
        get resultReference() {
          return next.resultReference;
        },
        get leasePresent() {
          return Boolean(next.lease);
        },
        get leaseIsNull() {
          return next.lease === null;
        },
      },
      writerLeaseAccess(() => next.lease as CoordinatorLease),
    ],
  });
}

/**
 * 単発Taskの開始・終端を同じ実行Leaseと世代で保存する。
 * @responsibility 元ID、失敗・回復参照を保持して終端だけを更新する。
 * @trace ARCH-000004
 * @input Root、binding、Queue、期待世代、実Lease、次記録。
 * @returns 更新したQueue又は停止。
 * @precondition 呼出し元は同じTaskをjoinするOwner。
 * @postcondition 未解決cleanupを完了Queueへ変えない。
 * @effect 既存Snapshot更新。履歴は既存搬送へ渡す。
 * @failure 世代・Lease・識別子・遷移不一致で停止。
 * @invariant 本文・回答を保存せず採用を行わない。
 * @boundary 単発実行と既存Writer。
 * @security 保存値から実Leaseを復元しない。
 * @concurrency 既存operation LeaseとSnapshot短期排他。
 */
export function updateCoordinatorSingleTask(
  workingDirectory: string,
  binding: string,
  queueId: string,
  expectedGeneration: number,
  lease: CoordinatorLease,
  raw: unknown,
) {
  return updateQueue(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    {
      kind: "single",
      input: [
        queueId,
        expectedGeneration,
        raw,
        {
          ...writerLeaseAccess(() => lease),
          now: () => Date.now(),
        },
      ],
    },
  );
}

/** 解放・回復の成功値を、返却時点で固定する。 @trace ARCH-000004 */
function completed<T>(reason: string, value: T): CoordinatorLeaseResult<T> {
  return Object.freeze({ status: "completed", reason, value });
}

/** 実行Leaseの停止理由と、既知の回復参照を保持する。 @trace ARCH-000004 */
function blocked<T>(
  reason: string,
  manualRecoveryRequired = false,
  recoveryId: string | null = null,
): CoordinatorLeaseResult<T> {
  return Object.freeze({
    status: "blocked",
    reason,
    value: null,
    manualRecoveryRequired,
    recoveryId,
  });
}

/** 同じHomeはRepositoryに関係なく同じProviderHomes親DirectoryとBindingを使用する。 */
export function acquireProviderHomeLock(
  binding: unknown,
  directory: unknown,
): LockResult {
  if (
    typeof directory !== "string" ||
    typeof binding !== "string" ||
    !/^[0-9a-f]{64}$/u.test(binding)
  )
    return Object.freeze({
      status: "blocked",
      reason: "lock_input_invalid",
      reference: null,
      cleanupConfirmed: true,
      descriptorClosed: true,
    });
  return acquireLock({
    directory,
    name: `executor.provider-home.${binding}.lock`,
    identity: `provider-home:${binding}`,
  });
}

/** 同じRuntime状態と回復処理を、Ownerが確定した既存RuntimeState内で排他する。 */
export function acquireExecutionStateLock(directory: unknown): LockResult {
  if (typeof directory !== "string")
    return Object.freeze({
      status: "blocked",
      reason: "lock_input_invalid",
      reference: null,
      cleanupConfirmed: true,
      descriptorClosed: true,
    });
  // RuntimeStateはRepositoryやHomeをまたいで共有される。同じ所在は同じLockで保護する。
  const result = acquireLock({
    directory,
    name: "coordinator.docker-state.lock",
    identity: "docker-state:shared",
  });
  return result;
}

/** 作成・回復は同じRepositoryと元操作IDで排他する。 @trace ARCH-000008 */
export function acquireHostOperationLock(
  repository: Repository,
  operationId: unknown,
): LockResult {
  const paths =
    typeof operationId === "string" && /^OP-[0-9]{6,}$/u.test(operationId)
      ? resolveRepositoryExecutionDataPaths(repository)
      : null;
  if (!paths)
    return Object.freeze({
      status: "blocked",
      reason: "lock_input_invalid",
      reference: null,
      cleanupConfirmed: true,
      descriptorClosed: true,
    });
  return acquireLock({
    directory: paths.locks,
    name: `coordinator.host-operation.${operationId}.lock`,
    identity: `host-operation:${operationId}`,
  });
}

/**
 * ObjectiveのLease所有者を、既存の対応OSに限って観測する。
 * @trace ARCH-000004
 * @input 保存から取得した所有者のPIDと世代。
 * @returns Windowsでは既存観測、その他では元の相関を保持した観測不能。
 * @effect Windowsでのみ既存のPID生存観測を行う。
 * @security 観測不能を不存在へ変換しない。
 */
export function observeObjectiveLeaseOwner(
  owner: Readonly<{ ownerProcessId: number; ownerGeneration: string }>,
): CoordinatorWindowsLeaseOwnerObservation {
  if (process.platform === "win32") return observeLeaseOwner(owner);
  return Object.freeze({
    status: "unknown",
    ownerProcessId: owner.ownerProcessId,
    ownerGeneration: owner.ownerGeneration,
  });
}

/**
 * windows-platform-adapterで使用するCoordinator Windows Lease 所有者 Observationの値契約を定義する。
 *
 * @responsibility Coordinator Windows Lease 所有者 ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorWindowsLeaseOwnerObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorWindowsLeaseOwnerObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorWindowsLeaseOwnerObservationの宣言は外部境界を開かない。
 * @security CoordinatorWindowsLeaseOwnerObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CoordinatorWindowsLeaseOwnerObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorWindowsLeaseOwnerObservation = Readonly<{
  status: "alive" | "absent" | "unknown";
  ownerProcessId: number;
  ownerGeneration: string;
}>;

/**
 * Lease 所有者を観測する。
 *
 * @responsibility Lease 所有者の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawOwner: unknown
 * @returns CoordinatorWindowsLeaseOwnerObservationを返す。
 * @precondition 「rawOwner: unknown」がobserveLeaseOwnerの入力契約を満たす。
 * @postcondition observeLeaseOwnerの責務を完了した結果だけを返す。
 * @effect observeLeaseOwnerは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure observeLeaseOwnerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeLeaseOwnerは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security observeLeaseOwnerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeLeaseOwnerは共有非同期状態を持たない同期処理である。
 */
export function observeLeaseOwner(
  rawOwner: unknown,
): CoordinatorWindowsLeaseOwnerObservation {
  const invalid = Object.freeze({
    status: "unknown" as const,
    ownerProcessId: 0,
    ownerGeneration: "invalid",
  });
  if (
    !rawOwner ||
    typeof rawOwner !== "object" ||
    Array.isArray(rawOwner) ||
    Object.getPrototypeOf(rawOwner) !== Object.prototype
  )
    return invalid;
  const owner = rawOwner as Readonly<Record<string, unknown>>;
  if (
    Object.keys(owner).sort().join("\0") !==
      ["ownerGeneration", "ownerProcessId"].sort().join("\0") ||
    !Number.isSafeInteger(owner.ownerProcessId) ||
    Number(owner.ownerProcessId) < 1 ||
    typeof owner.ownerGeneration !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(owner.ownerGeneration)
  )
    return invalid;
  const ownerProcessId = Number(owner.ownerProcessId);
  const ownerGeneration = owner.ownerGeneration;
  let status: "alive" | "absent" | "unknown" = "unknown";
  try {
    process.kill(ownerProcessId, 0);
    status = "alive";
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ESRCH"
    )
      status = "absent";
  }
  return Object.freeze({
    status,
    ownerProcessId,
    ownerGeneration,
  });
}

const runtimeProcessInstanceIdentity = randomUUID();

/**
 * Runtime Process Instance Identityを取得する。
 *
 * @responsibility Runtime Process Instance Identityの参照条件、返却値、未検出結果の境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns getRuntimeProcessInstanceIdentityの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がgetRuntimeProcessInstanceIdentityの入力契約を満たす。
 * @postcondition getRuntimeProcessInstanceIdentityの責務を完了した結果だけを返す。
 * @effect N/A: getRuntimeProcessInstanceIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: getRuntimeProcessInstanceIdentityは独自の失敗分岐を所有しない。
 * @invariant getRuntimeProcessInstanceIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: getRuntimeProcessInstanceIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: getRuntimeProcessInstanceIdentityは共有非同期状態を持たない同期処理である。
 */
export function getRuntimeProcessInstanceIdentity() {
  return runtimeProcessInstanceIdentity;
}

const RUNTIME_PROCESS_RECOVERY_ID =
  /^runtime-process\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.restart-([0-9a-f]{40})$/u;

/**
 * recovery Digestを決定する。
 *
 * @responsibility recovery Digestの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input processIdentity: string、attemptId: string、operationId: string
 * @returns recoveryDigestの計算結果を返す。
 * @precondition 「processIdentity: string、attemptId: string、operationId: string」がrecoveryDigestの入力契約を満たす。
 * @postcondition recoveryDigestの責務を完了した結果だけを返す。
 * @effect N/A: recoveryDigestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryDigestは独自の失敗分岐を所有しない。
 * @invariant recoveryDigestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: recoveryDigestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recoveryDigestは共有非同期状態を持たない同期処理である。
 */
function recoveryDigest(
  processIdentity: string,
  attemptId: string,
  operationId: string,
) {
  return createHash("sha256")
    .update([processIdentity, attemptId, operationId].join("\0"))
    .digest("hex")
    .slice(0, 40);
}

/**
 * Runtime Process 回復 Identityを構築する。
 *
 * @responsibility Runtime Process 回復 Identityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input attemptId: string、operationId: string
 * @returns createRuntimeProcessRecoveryIdentityの計算結果を返す。
 * @precondition 「attemptId: string、operationId: string」がcreateRuntimeProcessRecoveryIdentityの入力契約を満たす。
 * @postcondition createRuntimeProcessRecoveryIdentityの責務を完了した結果だけを返す。
 * @effect createRuntimeProcessRecoveryIdentityは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: createRuntimeProcessRecoveryIdentityは独自の失敗分岐を所有しない。
 * @invariant createRuntimeProcessRecoveryIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: createRuntimeProcessRecoveryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createRuntimeProcessRecoveryIdentityは共有非同期状態を持たない同期処理である。
 */
export function createRuntimeProcessRecoveryIdentity(
  attemptId: string,
  operationId: string,
) {
  return `runtime-process.${runtimeProcessInstanceIdentity}.restart-${recoveryDigest(
    runtimeProcessInstanceIdentity,
    attemptId,
    operationId,
  )}`;
}

/**
 * Runtime Process 回復 Identityを観測する。
 *
 * @responsibility Runtime Process 回復 Identityの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、attemptId: string、operationId: string
 * @returns inspectRuntimeProcessRecoveryIdentityの計算結果を返す。
 * @precondition 「value: unknown、attemptId: string、operationId: string」がinspectRuntimeProcessRecoveryIdentityの入力契約を満たす。
 * @postcondition inspectRuntimeProcessRecoveryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: inspectRuntimeProcessRecoveryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRuntimeProcessRecoveryIdentityは独自の失敗分岐を所有しない。
 * @invariant inspectRuntimeProcessRecoveryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: inspectRuntimeProcessRecoveryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectRuntimeProcessRecoveryIdentityは共有非同期状態を持たない同期処理である。
 */
export function inspectRuntimeProcessRecoveryIdentity(
  value: unknown,
  attemptId: string,
  operationId: string,
) {
  if (typeof value !== "string") return null;
  const match = RUNTIME_PROCESS_RECOVERY_ID.exec(value);
  if (!match?.[1] || !match[2]) return null;
  if (match[2] !== recoveryDigest(match[1], attemptId, operationId))
    return null;
  return Object.freeze({ processIdentity: match[1], recoveryId: value });
}

/** 回収が不明になった同じProcessで新規Taskを開始させない。 @trace ARCH-000008 */
let processCleanupUnknown = false;

/**
 * poison Runtime Process After 清掃 Unknownを決定する。
 *
 * @responsibility poison Runtime Process After 清掃 Unknownの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: poisonRuntimeProcessAfterCleanupUnknownは戻り値を返さない。
 * @precondition 「N/A: 実行時引数を受け取らない。」がpoisonRuntimeProcessAfterCleanupUnknownの入力契約を満たす。
 * @postcondition poisonRuntimeProcessAfterCleanupUnknownの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: poisonRuntimeProcessAfterCleanupUnknownは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: poisonRuntimeProcessAfterCleanupUnknownは独自の失敗分岐を所有しない。
 * @invariant poisonRuntimeProcessAfterCleanupUnknownは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: poisonRuntimeProcessAfterCleanupUnknownはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: poisonRuntimeProcessAfterCleanupUnknownは共有非同期状態を持たない同期処理である。
 */
export function poisonRuntimeProcessAfterCleanupUnknown() {
  processCleanupUnknown = true;
}

/**
 * Runtime Process Poisonedかを判定する。
 *
 * @responsibility Runtime Process Poisonedの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns isRuntimeProcessPoisonedの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がisRuntimeProcessPoisonedの入力契約を満たす。
 * @postcondition isRuntimeProcessPoisonedの責務を完了した結果だけを返す。
 * @effect N/A: isRuntimeProcessPoisonedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isRuntimeProcessPoisonedは独自の失敗分岐を所有しない。
 * @invariant isRuntimeProcessPoisonedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: isRuntimeProcessPoisonedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isRuntimeProcessPoisonedは共有非同期状態を持たない同期処理である。
 */
export function isRuntimeProcessPoisoned() {
  return processCleanupUnknown;
}

/**
 * durable-foundationで使用するActive Leaseの値契約を定義する。
 *
 * @responsibility Active LeaseのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ActiveLeaseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ActiveLeaseで宣言した値と責務の対応を維持する。
 * @boundary N/A: ActiveLeaseの宣言は外部境界を開かない。
 * @security ActiveLeaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ActiveLeaseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ActiveLease = Readonly<{
  repositoryRoot: string;
  repositoryBindingId: string;
  projectId: string;
  queueId: string;
  kind: LeaseKind;
  ownerGeneration: string;
  lock: string;
  recoveryMarker: string;
  acquisitionMarker: string;
  lockOwnershipMarker: string;
  evidenceDirectory: string;
  identity: string;
  snapshotPhysicalIdentity?: string;
  physicalLock: Lock;
}>;

const activeLeases = new WeakMap<CoordinatorLease, ActiveLease>();

/**
 * 元Queue世代と資源不存在の観測を結合してLease解放を確定する。
 * @responsibility Root・保存領域の前後実体確認と既存EMの解放遷移を同じ保存へ接続する。
 * @trace ARCH-000004
 * @input 構築時に検証済みRepository、binding、Queueと元世代。
 * @returns 元Writerによる保存確定又はblocked。
 * @precondition RootはPort構築時又は回復受付で検証済み。元Queue・Owner世代を渡す。
 * @postcondition 元世代・資源の明示不存在・保存領域の前後実体が一致した変更だけを確定する。
 * @effect 既存の短期排他・CASで解放を保存する。物理Lockを独自に削除しない。
 * @failure 不存在・実体・保存又は読戻しが不明・不成立なら確定成功にしない。
 * @invariant Queue保存成功を、新たな物理Lock削除や自動回復の許可へ変換しない。
 * @boundary Leaseの解放確定と既存EM Writer。
 * @security 他のQueue／Owner世代や未知の残存物を解放しない。
 * @concurrency 既存Writerの短期排他・元版照合へ接続し、独自の排他を追加しない。
 */
export function settleCoordinatorSnapshotQueueLeaseRelease(
  storageRepository: ReturnType<typeof verifyRuntimePersistenceRepository>,
  binding: string,
  queueId: string,
  expectedGeneration: number,
  ownerGeneration: string,
) {
  return updateQueue(storageRepository, binding, {
    kind: "lease_released",
    input: [
      queueId,
      expectedGeneration,
      ownerGeneration,
      {
        resourcesAbsent: (repositoryRoot: string, identity: string) => {
          const paths = resolveNamedPaths(repositoryRoot);
          if (!paths) throw new Error("orchestrator_repository_root_invalid");
          const boundary = assertArea(
            repositoryRoot,
            "domain-model",
            paths.domainModel,
          );
          if (!snapshotLeaseResourcesAbsent(repositoryRoot, identity))
            return false;
          assertAreaUnchanged(repositoryRoot, "domain-model", boundary);
          return true;
        },
      },
    ],
  });
}

/**
 * 同じ実Leaseへ結合した観測値だけを借りる。
 * @responsibility 実行OwnerのMapを公開せず、Queueのfresh観測へ同じ結合を渡す。
 * @trace ARCH-000004
 * @input lease: 実行側で発行済みのLease候補。
 * @returns 同じ実発行記録、又は未登録のundefined。
 * @precondition 現在の生存確認は呼出し側が既存の位置で行う。
 * @postcondition Mapの寿命・登録・削除を変更しない。
 * @effect N/A: 私有Mapの同期読取りだけ。
 * @failure 未発行値ではundefined。
 * @invariant 値の同一性だけで実Leaseを再構成しない。
 * @boundary 実行Lease OwnerとQueueの現在観測。
 * @security Mapや書換え操作は公開しない。
 * @concurrency freshな観測の直前に同じ記録を参照する。
 */
export function borrowCoordinatorActiveLease(lease: CoordinatorLease) {
  return activeLeases.get(lease);
}

/**
 * Lease Is Observedが有効な状態か判定する。
 *
 * @responsibility Lease Is Observedの有効状態条件と判定結果境界を所有する。
 * @trace ARCH-000004
 * @input activeLease: ActiveLease
 * @returns activeLeaseIsObservedの計算結果を返す。
 * @precondition 「activeLease: ActiveLease」がactiveLeaseIsObservedの入力契約を満たす。
 * @postcondition activeLeaseIsObservedの責務を完了した結果だけを返す。
 * @effect activeLeaseIsObservedはFilesystemの読取りまたは書込みを実行する。
 * @failure activeLeaseIsObservedは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant activeLeaseIsObservedは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security activeLeaseIsObservedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: activeLeaseIsObservedは共有非同期状態を持たない同期処理である。
 */
function activeLeaseIsObserved(activeLease: ActiveLease) {
  try {
    if (!activeLease.physicalLock.assertLive()) return false;
    if (activeLease.snapshotPhysicalIdentity !== undefined) {
      const paths = resolveNamedPaths(activeLease.repositoryRoot);
      if (!paths) return false;
      const boundary = assertArea(
        activeLease.repositoryRoot,
        "lock",
        paths.locks,
      );
      for (const directory of [
        activeLease.repositoryRoot,
        boundary.directory,
        path.dirname(activeLease.lock),
      ]) {
        assertDirectory(directory);
        if (fs.realpathSync.native(directory) !== directory) return false;
      }
      const physicalIdentity = observePhysicalLeaseFile(activeLease.lock);
      assertAreaUnchanged(activeLease.repositoryRoot, "lock", boundary);
      return physicalIdentity === activeLease.snapshotPhysicalIdentity;
    }
    return !fs.existsSync(activeLease.recoveryMarker);
  } catch {
    return false;
  }
}

/**
 * 新版の未終了取得意図から、操作LeaseのOwner参照を取得する。
 * @responsibility 記録の取得とOS上のOwner生死判定を分離する。
 * @trace ARCH-000004
 * @input workingDirectory: Repository内起点、binding: 対象Repository結合。
 * @returns 同一Ownerに結合した取得参照、真正な参照不存在、または停止。
 * @precondition 新版v2の現在状態が確定している。
 * @postcondition 記録の読取りだけでOwner死亡や回収成功を表示しない。
 * @effect 短期排他を取得してSnapshotを読む。状態を保存しない。
 * @failure 複数Owner、Queue結合差、未知Schemaと観測不能を拒否する。
 * @invariant 別ProjectのLeaseや採用Leaseを操作Ownerとして返さない。
 * @boundary 現在Snapshotから既存Lease PortのOwner参照へ。
 * @security JSONから実行用opaque LeaseやAuthorityを復元しない。
 * @concurrency 同じ短期Owner内でQueueと取得意図を照合し、解放確認後に返す。
 */
export function inspectCoordinatorSnapshotLeaseAcquisitionOwner(
  workingDirectory: string,
  binding: string,
): CoordinatorLeaseResult<
  Readonly<{ acquisition: CoordinatorLeaseAcquisitionResolution | null }>
> {
  return readLease(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    { kind: "acquisition", input: [binding] },
  );
}

/**
 * 統合保存の取得意図と短命な実排他を結合する。
 * @responsibility 記録の確定と物理取得を分け、同Ownerのopaque Leaseだけを返す。
 * @trace ARCH-000004
 * @input workingDirectory、binding、projectId、queueId、kind。
 * @returns 実排他を取得したLease、またはexact取得回復参照付き停止。
 * @precondition v2保存と対象Project／Queueがある。
 * @postcondition 意図と取得証拠の確定後にだけLeaseを返す。
 * @effect 取得意図を保存し、Repository内tmpの固定名を共通wx Lockで取得する。
 * @failure 部分取得は意図を保全し、未取得や清掃済みへ丸めない。
 * @invariant 短期保存排他を長期実行や外部待機へ持ち越さない。
 * @boundary 現在状態、実Filesystem排他、Process内opaque Lease。
 * @security JSONからLeaseを復元しない。
 * @concurrency Repository単位／Project単位の既存Lease Identityを維持する。
 */
export function acquireCoordinatorSnapshotLease(
  workingDirectory: string,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
): CoordinatorLeaseResult<CoordinatorLease> {
  if (
    ![binding, projectId, queueId].every(validIdentity) ||
    (kind !== "project-operation" && kind !== "canonical-adoption")
  )
    return blocked("orchestrator_lease_identity_invalid");
  const ownerGeneration = randomUUID();
  let recoveryId: string | null = null;
  let intentSaveRequested = false;
  const reserved = acquireLease(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    {
      kind: "intent",
      input: [
        projectId,
        queueId,
        kind,
        { ownerGeneration, ownerProcessId: process.pid },
        {
          resourcesAbsent: (repositoryRoot: string, identity: string) =>
            snapshotLeaseResourcesAbsent(repositoryRoot, identity),
          observeRoot: (repositoryRoot: string) => {
            const metadata = fs.lstatSync(repositoryRoot);
            return {
              repositoryRoot: repositoryRoot,
              rootIdentity: createHash("sha256")
                .update(
                  JSON.stringify([
                    metadata.dev,
                    metadata.ino,
                    metadata.birthtimeMs,
                  ]),
                  "utf8",
                )
                .digest("hex"),
            };
          },
          markIntentSaveRequested: (id: string) => {
            recoveryId = id;
            intentSaveRequested = true;
          },
        },
      ],
    },
  );
  if (reserved.status !== "completed")
    return intentSaveRequested && reserved.manualRecoveryRequired
      ? blocked(reserved.reason, true, recoveryId)
      : reserved;
  const { repositoryRoot, rootIdentity, identity, intent } = reserved.value;
  recoveryId = reserved.value.recoveryId;
  const leasePaths = resolveNamedPaths(repositoryRoot);
  if (!leasePaths || leasePaths.repositoryRoot !== repositoryRoot)
    return blocked(
      "orchestrator_lease_acquisition_recovery_required",
      true,
      recoveryId,
    );
  const lock = path.join(
    leasePaths.locks,
    "coordinator.lease." + identity + ".lock",
  );
  let physicalIdentity: string;
  let physicalLock: Lock | null = null;
  try {
    const resolved = resolveNamedPaths(workingDirectory);
    const rootMetadata = fs.lstatSync(repositoryRoot);
    if (
      !resolved ||
      resolved.repositoryRoot !== repositoryRoot ||
      !rootMetadata.isDirectory() ||
      rootMetadata.isSymbolicLink() ||
      fs.realpathSync.native(repositoryRoot) !== repositoryRoot ||
      createHash("sha256")
        .update(
          JSON.stringify([
            rootMetadata.dev,
            rootMetadata.ino,
            rootMetadata.birthtimeMs,
          ]),
          "utf8",
        )
        .digest("hex") !== rootIdentity
    )
      throw new Error("lease_root_changed");
    const temporary = requireReadyRepositoryExecutionDataArea(
      ensureRepositoryExecutionDataAreaFromWorkingDirectory(
        repositoryRoot,
        "lock",
      ),
      "orchestrator_repository_root_invalid",
    ).directory;
    const boundary = assertArea(repositoryRoot, "lock", temporary);
    const locks = temporary;
    assertDirectory(locks);
    const acquiredLock = acquireLock({
      directory: locks,
      name: path.basename(lock),
      identity,
    });
    if (acquiredLock.status !== "acquired") {
      // 初期化途中・descriptor終了不明も既存Intentと同じ回復IDで保全する。
      return blocked(
        "orchestrator_lease_acquisition_recovery_required",
        true,
        recoveryId,
      );
    }
    physicalLock = acquiredLock.lock;
    assertDirectory(locks);
    physicalIdentity = observePhysicalLeaseFile(lock);
    assertAreaUnchanged(repositoryRoot, "lock", boundary);
  } catch {
    physicalLock?.release(true);
    return blocked(
      "orchestrator_lease_acquisition_recovery_required",
      true,
      recoveryId,
    );
  }
  let acquired: ReturnType<typeof acquireLease>;
  try {
    acquired = acquireLease(
      verifyRuntimePersistenceRepository(workingDirectory),
      binding,
      {
        kind: "observed",
        input: [
          binding,
          projectId,
          queueId,
          kind,
          ownerGeneration,
          intent,
          physicalIdentity,
          recoveryId,
          process.pid,
          {
            physicalIdentityMatches: () => {
              return (
                physicalLock?.assertLive() === true &&
                observePhysicalLeaseFile(lock) === physicalIdentity
              );
            },
          },
        ],
      },
    );
  } catch {
    physicalLock.release(true);
    return blocked(
      "orchestrator_lease_acquisition_recovery_required",
      true,
      recoveryId,
    );
  }
  if (acquired.status !== "completed") {
    physicalLock.release(true);
    return blocked(
      "orchestrator_lease_acquisition_recovery_required",
      true,
      recoveryId,
    );
  }
  let released = false;
  let lease!: CoordinatorLease;
  lease = Object.freeze({
    kind,
    ownerGeneration,
    /**
     * 同じ実排他を解放して終了を保存する。
     * @responsibility 解放意図、実体照合、不存在確認、終了証拠の順を守る。
     * @trace ARCH-000004
     * @input N/A: opaque Leaseの取得時結合を使う。
     * @returns 解放確定またはexact回復参照付き停止。
     * @precondition 同じ実体を保持するLeaseである。
     * @postcondition 成功時は実排他が不在でintentが終了している。
     * @effect 元共通Lockのdescriptor・Fileを解放し保存を更新する。
     * @failure 別実体、観測不能、保存失敗を保全停止する。
     * @invariant 要求発行を解放完了にしない。
     * @boundary opaque Lease、Filesystem、統合保存。
     * @security 別Ownerの実体を処置しない。
     * @concurrency 短期保存Ownerを物理操作の前後で分離する。
     */
    release(): CoordinatorLeaseResult<Readonly<{ released: true }>> {
      if (released) return blocked("orchestrator_lease_already_released");
      try {
        const active = activeLeases.get(lease);
        if (!active || !activeLeaseIsObserved(active))
          throw new Error("lease_identity_changed");
        const pending = releaseLease(
          verifyRuntimePersistenceRepository(workingDirectory),
          binding,
          { kind: "intent", input: [intent, physicalIdentity] },
        );
        if (pending.status !== "completed")
          throw new Error("lease_release_intent_unknown");
        if (!activeLeaseIsObserved(active))
          throw new Error("lease_identity_changed");
        const boundary = assertArea(repositoryRoot, "lock", leasePaths.locks);
        if (!physicalLock.release())
          throw new Error("lease_release_unconfirmed");
        assertAreaUnchanged(repositoryRoot, "lock", boundary);
        if (!snapshotLeaseResourcesAbsent(repositoryRoot, identity))
          throw new Error("lease_release_unconfirmed");
        activeLeases.delete(lease);
        const settled = releaseLease(
          verifyRuntimePersistenceRepository(workingDirectory),
          binding,
          {
            kind: "observed",
            input: [binding, intent, physicalIdentity, process.pid],
          },
        );
        if (settled.status !== "completed")
          throw new Error("lease_release_settlement_unknown");
        released = true;
        return settled;
      } catch {
        // 失敗したLeaseは再利用せず、descriptorを閉じて元Fileと回復参照を保全する。
        activeLeases.delete(lease);
        physicalLock.release(true);
        return blocked("orchestrator_lease_release_unknown", true, recoveryId);
      }
    },
  });
  activeLeases.set(lease, {
    repositoryRoot,
    repositoryBindingId: binding,
    projectId,
    queueId,
    kind,
    ownerGeneration,
    lock,
    recoveryMarker: "",
    acquisitionMarker: "",
    lockOwnershipMarker: "",
    evidenceDirectory: "",
    identity,
    snapshotPhysicalIdentity: physicalIdentity,
    physicalLock,
  });
  return completed("orchestrator_lease_acquired", lease);
}

/**
 * 新版LeaseのOwner喪失を現在観測から終了処置する。
 * @responsibility 過去の取得結果と現在の資源不存在を分けて保存する。
 * @trace ARCH-000004
 * @input Repository起点、binding、Project、Queue、Lease種別、既存Owner観測。
 * @returns 終了後のQueueと回復参照、または同じ参照付き停止。
 * @precondition v2現在状態と対象の取得意図が検証できる。
 * @postcondition 回収確認だけでTask成功や採用成功を表示しない。
 * @effect 回収意図を保存し、fresh照合後の短期保存Lock内で元Fileを処置・不存在確認して終了を保存する。
 * @failure Owner存続、観測不能、対象変更、由来未確定実体では処置しない。
 * @invariant 取得未確定を取得成功へ書き換えない。
 * @boundary Snapshot、Process観測、Repository内の実排他。
 * @security 他Owner、他Root、候補と保護判断へ処置を広げない。
 * @concurrency Owner生存観測は短期排他外、物理処置は全fresh照合後の同じ保存Lock内で同期実行する。
 */
export function reconcileCoordinatorSnapshotLeaseOwnerLoss(
  workingDirectory: string,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  observeOwner: CoordinatorLeaseOwnerObservation,
): CoordinatorLeaseResult<
  Readonly<{ queue: ProjectQueueEntry | null; recoveryId: string | null }>
> {
  if (
    ![binding, projectId, queueId].every(validIdentity) ||
    !["project-operation", "canonical-adoption"].includes(kind) ||
    typeof observeOwner !== "function"
  )
    return blocked("orchestrator_lease_recovery_input_invalid");
  const inspected = readLease(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    {
      kind: "owner_loss",
      input: [
        projectId,
        queueId,
        kind,
        {
          observeRoot: (repositoryRoot: string) => {
            const metadata = fs.lstatSync(repositoryRoot);
            return {
              repositoryRoot: repositoryRoot,
              rootIdentity: createHash("sha256")
                .update(
                  JSON.stringify([
                    metadata.dev,
                    metadata.ino,
                    metadata.birthtimeMs,
                  ]),
                  "utf8",
                )
                .digest("hex"),
            };
          },
        },
      ],
    },
  );
  if (inspected.status !== "completed")
    return blocked(inspected.reason, true, inspected.recoveryId);
  const initial = inspected.value;
  const { recoveryId, identity } = initial;
  const leasePaths = resolveNamedPaths(initial.repositoryRoot);
  if (!leasePaths || leasePaths.repositoryRoot !== initial.repositoryRoot)
    return blocked(
      "orchestrator_lease_recovery_observation_unknown",
      true,
      recoveryId,
    );
  const lock = path.join(
    leasePaths.locks,
    "coordinator.lease." + identity + ".lock",
  );
  const first = initial.intents[0];
  if (!first) {
    if (initial.queue?.ownerGeneration) {
      if (!["leased", "running"].includes(initial.queue.state)) {
        const storageRepository =
          verifyRuntimePersistenceRepository(workingDirectory);
        if (!validIdentity(binding))
          throw new Error("snapshot_port_binding_invalid");
        const settled = settleCoordinatorSnapshotQueueLeaseRelease(
          storageRepository,
          binding,
          queueId,
          initial.queue.generation,
          initial.queue.ownerGeneration,
        );
        return settled.status === "completed"
          ? completed(settled.reason, {
              queue: settled.value,
              recoveryId: null,
            })
          : blocked(settled.reason, true, recoveryId);
      }
      return recoverLease(
        verifyRuntimePersistenceRepository(workingDirectory),
        binding,
        {
          kind: "reconcile",
          input: [
            projectId,
            queueId,
            kind,
            initial.queue,
            recoveryId,
            {
              resourcesAbsent: (repositoryRoot: string) =>
                snapshotLeaseResourcesAbsent(repositoryRoot, identity),
            },
          ],
        },
      );
    }
    try {
      if (
        !snapshotLeaseResourcesAbsent(initial.repositoryRoot, identity) ||
        initial.queue?.ownerGeneration
      )
        return blocked(
          "orchestrator_lease_recovery_state_mismatch",
          true,
          recoveryId,
        );
      return completed("orchestrator_lease_acquisition_resources_absent", {
        queue: initial.queue,
        recoveryId: null,
      });
    } catch {
      return blocked(
        "orchestrator_lease_recovery_observation_unknown",
        true,
        recoveryId,
      );
    }
  }
  const ownIntents = initial.intents;
  if (
    ownIntents.some(
      (item) =>
        item.ownerGeneration !== first.ownerGeneration ||
        item.ownerProcessId !== first.ownerProcessId ||
        item.recoveryId !== first.recoveryId,
    ) ||
    (initial.queue?.ownerGeneration !== null &&
      initial.queue?.ownerGeneration !== undefined &&
      initial.queue.ownerGeneration !== first.ownerGeneration)
  )
    return blocked(
      "orchestrator_lease_acquisition_owner_mismatch",
      true,
      recoveryId,
    );
  let observation: unknown;
  try {
    observation = observeOwner(
      Object.freeze({
        ownerProcessId: first.ownerProcessId,
        ownerGeneration: first.ownerGeneration,
      }),
    );
  } catch {
    return blocked(
      "orchestrator_lease_owner_observation_unknown",
      true,
      recoveryId,
    );
  }
  const observedOwner = snapshotPlainRecord(
    observation,
    new Set(["status", "ownerProcessId", "ownerGeneration"]),
  );
  if (
    !observedOwner ||
    Object.getPrototypeOf(observation) !== Object.prototype ||
    observedOwner.ownerProcessId !== first.ownerProcessId ||
    observedOwner.ownerGeneration !== first.ownerGeneration
  )
    return blocked(
      "orchestrator_lease_owner_observation_unknown",
      true,
      recoveryId,
    );
  if (observedOwner.status === "alive")
    return blocked("orchestrator_lease_owner_still_active");
  if (observedOwner.status !== "absent")
    return blocked(
      "orchestrator_lease_owner_observation_unknown",
      true,
      recoveryId,
    );
  let physicalIdentity =
    ownIntents.find((item) => item.physicalIdentity !== null)
      ?.physicalIdentity ?? null;
  if (physicalIdentity === null) {
    try {
      if (!snapshotLeaseResourcesAbsent(initial.repositoryRoot, identity)) {
        if (first.phase !== "acquisition_reserved" || ownIntents.length !== 1)
          return blocked(
            "orchestrator_lease_physical_identity_unconfirmed",
            true,
            recoveryId,
          );
        const boundary = assertArea(
          initial.repositoryRoot,
          "lock",
          leasePaths.locks,
        );
        assertDirectory(path.dirname(lock));
        physicalIdentity = observePhysicalLeaseFile(lock);
        assertAreaUnchanged(initial.repositoryRoot, "lock", boundary);
      }
    } catch {
      return blocked(
        "orchestrator_lease_recovery_observation_unknown",
        true,
        recoveryId,
      );
    }
  }
  const pending = {
    ...first,
    phase: "recovery_pending" as const,
    physicalIdentity,
  };
  const reserved = recoverLease(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    {
      kind: "intent",
      input: [
        projectId,
        queueId,
        kind,
        initial,
        ownIntents,
        pending,
        recoveryId,
        {
          observeRoot: (repositoryRoot: string) => {
            const metadata = fs.lstatSync(repositoryRoot);
            return {
              repositoryRoot: repositoryRoot,
              rootIdentity: createHash("sha256")
                .update(
                  JSON.stringify([
                    metadata.dev,
                    metadata.ino,
                    metadata.birthtimeMs,
                  ]),
                  "utf8",
                )
                .digest("hex"),
            };
          },
        },
      ],
    },
  );
  if (reserved.status !== "completed")
    return blocked(reserved.reason, true, recoveryId);
  let recoveryFailureReason: string | null = null;
  const settled = recoverLease(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    {
      kind: "observed",
      input: [
        binding,
        projectId,
        queueId,
        kind,
        initial,
        ownIntents,
        pending,
        first,
        recoveryId,
        {
          observeRoot: (repositoryRoot: string) => {
            const metadata = fs.lstatSync(repositoryRoot);
            return {
              repositoryRoot: repositoryRoot,
              rootIdentity: createHash("sha256")
                .update(
                  JSON.stringify([
                    metadata.dev,
                    metadata.ino,
                    metadata.birthtimeMs,
                  ]),
                  "utf8",
                )
                .digest("hex"),
            };
          },
          recoverResources: () => {
            try {
              const resolved = resolveNamedPaths(workingDirectory);
              const rootMetadata = fs.lstatSync(initial.repositoryRoot);
              if (
                !resolved ||
                resolved.repositoryRoot !== initial.repositoryRoot ||
                !rootMetadata.isDirectory() ||
                rootMetadata.isSymbolicLink() ||
                fs.realpathSync.native(initial.repositoryRoot) !==
                  initial.repositoryRoot ||
                createHash("sha256")
                  .update(
                    JSON.stringify([
                      rootMetadata.dev,
                      rootMetadata.ino,
                      rootMetadata.birthtimeMs,
                    ]),
                    "utf8",
                  )
                  .digest("hex") !== initial.rootIdentity
              )
                throw new Error("lease_root_changed");
              // 不存在と観測不能を区別し、親にaliasがある場合も処置しない。
              if (
                !snapshotLeaseResourcesAbsent(initial.repositoryRoot, identity)
              ) {
                const boundary = assertArea(
                  initial.repositoryRoot,
                  "lock",
                  leasePaths.locks,
                );
                assertDirectory(path.dirname(lock));
                const observedIdentity = observePhysicalLeaseFile(lock);
                if (
                  physicalIdentity === null ||
                  observedIdentity !== physicalIdentity
                )
                  throw new Error(
                    "orchestrator_lease_physical_identity_unconfirmed",
                  );
                if (observePhysicalLeaseFile(lock) !== observedIdentity)
                  throw new Error(
                    "orchestrator_lease_physical_identity_unconfirmed",
                  );
                fs.unlinkSync(lock);
                assertAreaUnchanged(initial.repositoryRoot, "lock", boundary);
              }
              if (
                !snapshotLeaseResourcesAbsent(initial.repositoryRoot, identity)
              )
                throw new Error("lease_release_unconfirmed");
              return true;
            } catch (error) {
              recoveryFailureReason =
                error instanceof Error &&
                error.message ===
                  "orchestrator_lease_physical_identity_unconfirmed"
                  ? error.message
                  : "orchestrator_lease_recovery_observation_unknown";
              return false;
            }
          },
          resourcesAbsent: (repositoryRoot: string) =>
            snapshotLeaseResourcesAbsent(repositoryRoot, identity),
        },
      ],
    },
  );
  return settled.status === "completed"
    ? settled
    : blocked(recoveryFailureReason ?? settled.reason, true, recoveryId);
}

/**
 * Directoryを表明どおりか検査する。
 *
 * @responsibility Directoryの必須条件と違反時の停止境界を所有する。
 * @trace ARCH-000004
 * @input directory: string
 * @returns N/A: assertDirectoryは戻り値を返さない。
 * @precondition 「directory: string」がassertDirectoryの入力契約を満たす。
 * @postcondition assertDirectoryの責務を完了して呼出し元へ制御を戻す。
 * @effect assertDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure assertDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant assertDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security assertDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: assertDirectoryは共有非同期状態を持たない同期処理である。
 */
function assertDirectory(directory: string) {
  const metadata = fs.lstatSync(directory);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(directory) !== directory
  ) {
    throw new Error("orchestrator_storage_boundary_invalid");
  }
}

/**
 * 固定Lease Fileの実体と元内容を一つの不透明な照合値へ固定する。
 * 通常File・単一Link・2KiB上限と同じdescriptor／Pathを照合し、共通Lockのwireを再解釈しない。
 * 旧Directory・alias・観測不能は拒否する。descriptorは成功・失敗とも閉じる。
 */
function observePhysicalLeaseFile(file: string): string {
  const before = fs.lstatSync(file, { bigint: true });
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.nlink !== 1n ||
    before.size > 2048n
  )
    throw new Error("lease_file_invalid");
  const descriptor = fs.openSync(file, "r");
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    const same = (s: fs.BigIntStats) =>
      s.isFile() &&
      !s.isSymbolicLink() &&
      s.nlink === 1n &&
      s.dev === before.dev &&
      s.ino === before.ino &&
      s.birthtimeNs === before.birthtimeNs &&
      s.size === before.size;
    if (!same(opened) || opened.size > 2048n)
      throw new Error("lease_file_changed");
    const buffer = Buffer.alloc(2049);
    let length = 0;
    while (length < buffer.length) {
      const read = fs.readSync(
        descriptor,
        buffer,
        length,
        buffer.length - length,
        length,
      );
      if (read === 0) break;
      length += read;
    }
    const content = buffer.subarray(0, length);
    const finished = fs.fstatSync(descriptor, { bigint: true });
    const after = fs.lstatSync(file, { bigint: true });
    if (
      !same(finished) ||
      !same(after) ||
      content.length > 2048 ||
      BigInt(content.length) !== before.size
    )
      throw new Error("lease_file_changed");
    return createHash("sha256")
      .update(
        JSON.stringify([
          before.dev.toString(),
          before.ino.toString(),
          before.birthtimeNs.toString(),
          createHash("sha256")
            .update(content.toString("hex"), "utf8")
            .digest("hex"),
        ]),
        "utf8",
      )
      .digest("hex");
  } finally {
    fs.closeSync(descriptor);
  }
}

/**
 * 検証済みRootから名前付きPathだけを投影する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns 公開投影または無効Rootのnull。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect VCSとFilesystemを読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary Coordinator永続基盤からRuntime Data/Version Control公開入口。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */

export function resolveNamedPaths(workingDirectory: string) {
  const verified = getRepositoryFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? resolveRepositoryExecutionDataPaths(verified.capability)
    : null;
}

/**
 * 既存の名前付き領域をEffect0で観測する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns readyまたは真正不存在のnot_observed。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect VCSとFilesystemを読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary Coordinator永続基盤からRuntime Data/Version Control公開入口。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */
function observeArea(
  repositoryRoot: string,
  area: "domain-model" | "tmp" | "lock",
) {
  const verified = getRepository(repositoryRoot);
  if (verified.status !== "completed")
    throw new Error("orchestrator_repository_root_invalid");
  const observation = observeRepositoryExecutionDataArea(
    verified.capability,
    area,
  );
  if (observation.status === "blocked") throw new Error(observation.reason);
  if (
    observation.status === "ready" &&
    observation.repositoryRoot !== repositoryRoot
  )
    throw new Error("orchestrator_repository_root_invalid");
  return observation;
}

/**
 * I/O対象の名前付き領域が現在も成立することを確認する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns 確認済みready観測。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect VCSとFilesystemを読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary Coordinator永続基盤からRuntime Data/Version Control公開入口。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */
export function assertArea(
  repositoryRoot: string,
  area: "domain-model" | "tmp" | "lock",
  directory: string,
) {
  const observation = observeArea(repositoryRoot, area);
  if (observation.status !== "ready" || observation.directory !== directory)
    throw new Error("orchestrator_storage_boundary_invalid");
  return observation;
}

/**
 * I/O前後の同じ境界観測を照合する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns N/A: 一致確認のみ。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect VCSとFilesystemを読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary Coordinator永続基盤からRuntime Data/Version Control公開入口。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */
export function assertAreaUnchanged(
  repositoryRoot: string,
  area: "domain-model" | "tmp" | "lock",
  initial: Exclude<
    RepositoryExecutionDataAreaObservation,
    { status: "blocked" }
  >,
) {
  const current = observeArea(repositoryRoot, area);
  if (
    initial.status !== current.status ||
    (initial.status === "ready" &&
      (current.status !== "ready" ||
        current.directory !== initial.directory ||
        current.boundaryIdentity !== initial.boundaryIdentity))
  )
    throw new Error("orchestrator_storage_boundary_changed");
}

/**
 * error Codeを決定する。
 *
 * @responsibility error Codeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns errorCodeの計算結果を返す。
 * @precondition 「error: unknown」がerrorCodeの入力契約を満たす。
 * @postcondition errorCodeの責務を完了した結果だけを返す。
 * @effect N/A: errorCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorCodeは独自の失敗分岐を所有しない。
 * @invariant errorCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorCodeはProcess内の同一Subsystemで完結する。
 * @security errorCodeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorCodeは共有非同期状態を持たない同期処理である。
 */
function leaseErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : null;
}

/**
 * lease Acquisition Temporary Prefixを決定する。
 *
 * @responsibility lease Acquisition Temporary Prefixの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input identity: string
 * @returns leaseAcquisitionTemporaryPrefixの計算結果を返す。
 * @precondition 「identity: string」がleaseAcquisitionTemporaryPrefixの入力契約を満たす。
 * @postcondition leaseAcquisitionTemporaryPrefixの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionTemporaryPrefixは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseAcquisitionTemporaryPrefixは独自の失敗分岐を所有しない。
 * @invariant leaseAcquisitionTemporaryPrefixは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionTemporaryPrefixはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionTemporaryPrefixはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionTemporaryPrefixは共有非同期状態を持たない同期処理である。
 */
function leaseAcquisitionTemporaryPrefix(identity: string) {
  return `.pending-${identity}-acquisition-`;
}

/**
 * lease Acquisition Temporary Filesを決定する。
 *
 * @responsibility lease Acquisition Temporary Filesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input directory: string、identity: string
 * @returns leaseAcquisitionTemporaryFilesの計算結果を返す。
 * @precondition 「directory: string、identity: string」がleaseAcquisitionTemporaryFilesの入力契約を満たす。
 * @postcondition leaseAcquisitionTemporaryFilesの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionTemporaryFilesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure leaseAcquisitionTemporaryFilesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant leaseAcquisitionTemporaryFilesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionTemporaryFilesはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionTemporaryFilesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionTemporaryFilesは共有非同期状態を持たない同期処理である。
 */
function leaseAcquisitionTemporaryFiles(directory: string, identity: string) {
  assertDirectory(directory);
  const prefix = leaseAcquisitionTemporaryPrefix(identity);
  const names = fs
    .readdirSync(directory)
    .filter((name) => name.startsWith(prefix));
  if (names.some((name) => !name.endsWith(".tmp")))
    throw new Error("orchestrator_lease_acquisition_inventory_invalid");
  return Object.freeze(names);
}

/**
 * path Confirmed Absentを決定する。
 *
 * @responsibility path Confirmed Absentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input candidate: string
 * @returns pathConfirmedAbsentの計算結果を返す。
 * @precondition 「candidate: string」がpathConfirmedAbsentの入力契約を満たす。
 * @postcondition pathConfirmedAbsentの責務を完了した結果だけを返す。
 * @effect pathConfirmedAbsentはFilesystemの読取りまたは書込みを実行する。
 * @failure pathConfirmedAbsentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant pathConfirmedAbsentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security pathConfirmedAbsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: pathConfirmedAbsentは共有非同期状態を持たない同期処理である。
 */
function pathConfirmedAbsent(candidate: string) {
  try {
    fs.lstatSync(candidate);
    return false;
  } catch (error) {
    if (leaseErrorCode(error) === "ENOENT") return true;
    throw error;
  }
}

/**
 * lease Acquisition Footprint Absentを決定する。
 *
 * @responsibility lease Acquisition Footprint Absentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input directory: string、identity: string、paths: readonly string[]
 * @returns leaseAcquisitionFootprintAbsentの計算結果を返す。
 * @precondition 「directory: string、identity: string、paths: readonly string[]」がleaseAcquisitionFootprintAbsentの入力契約を満たす。
 * @postcondition leaseAcquisitionFootprintAbsentの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionFootprintAbsentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseAcquisitionFootprintAbsentは独自の失敗分岐を所有しない。
 * @invariant leaseAcquisitionFootprintAbsentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionFootprintAbsentはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionFootprintAbsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionFootprintAbsentは共有非同期状態を持たない同期処理である。
 */
function leaseAcquisitionFootprintAbsent(
  directory: string,
  identity: string,
  paths: readonly string[],
) {
  return (
    paths.every(pathConfirmedAbsent) &&
    leaseAcquisitionTemporaryFiles(directory, identity).length === 0
  );
}

/**
 * 新版Leaseの実排他を、親の真正不存在も含めて観測する。
 * @responsibility 不存在と不正親・観測不能を区別する。
 * @trace ARCH-000004
 * @input repositoryRoot: 検証済みRoot、identity: 実排他の固定Identity。
 * @returns 実排他と取得途中Fileが真正に不在か。
 * @precondition 呼出し側がRoot実体と対象intentを照合する。
 * @postcondition FileやDirectoryを作成せず観測結果だけを返す。
 * @effect Repository内の正規親と対象のmetadataを読む。
 * @failure alias、不正形状、読取り拒否は例外として呼出し側へ返す。
 * @invariant 親の不存在と観測不能を同一視しない。
 * @boundary Repository Rootから.crdd/lock内の短命な実排他へ。
 * @security Root外の実体へ辿らない。
 * @concurrency Rootと最後の既知親を不存在判定前に再確認する。
 */
export function snapshotLeaseResourcesAbsent(
  repositoryRoot: string,
  identity: string,
): boolean {
  assertDirectory(repositoryRoot);
  const boundary = observeArea(repositoryRoot, "lock");
  if (boundary.status === "not_observed") {
    assertAreaUnchanged(repositoryRoot, "lock", boundary);
    return true;
  }
  const parent = boundary.directory;
  if (pathConfirmedAbsent(parent)) {
    assertAreaUnchanged(repositoryRoot, "lock", boundary);
    return true;
  }
  assertDirectory(parent);
  const isAbsent = leaseAcquisitionFootprintAbsent(parent, identity, [
    path.join(parent, "coordinator.lease." + identity + ".lock"),
  ]);
  assertDirectory(repositoryRoot);
  assertDirectory(parent);
  assertAreaUnchanged(repositoryRoot, "lock", boundary);
  return isAbsent;
}

/**
 * Hostが選択したRepositoryを既存VCの真正参照へ固定する。
 * @responsibility 生PathをDomain保存APIへ渡さず、保存Portが同じ参照を保持できるようにする。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory: 既存Host入口が選択したRepository内の起点。
 * @returns VCが発行した同一性参照。
 * @precondition 呼出し元が内容認可・実行Authorityを別に検査する。
 * @postcondition 新しい資格・State・登録を発行しない。
 * @effect 既存VCの読取りだけ。
 * @failure 不明RootはEffect前の例外で停止する。
 * @invariant Repository参照を実行許可にしない。
 * @boundary Coordinator HostとDomain保存。
 * @security 外部JSONから参照Objectを構築しない。
 * @concurrency 保存Portは返却参照を保持し、各操作のDomain側で再観測する。
 */
export function verifyRuntimePersistenceRepository(workingDirectory: string) {
  const verified = getRepositoryFromWorkingDirectory(workingDirectory);
  if (verified.status !== "completed")
    throw new Error("orchestrator_repository_root_invalid");
  return verified.capability;
}

export const TESTS_RELATIVE_PATH = ".crdd/tests" as const;

/** 履歴を扱う呼出しだけ、確定日数と既存の同期現在性検査を結合する。 */
export function historyRepositoryInput<T>(root: T) {
  const initial = readCoordinatorConfig(root as Repository);
  return Object.freeze({
    root,
    historyRetentionDays:
      initial.status === "ready" ? initial.config.historyRetentionDays : null,
    revalidate(expectedHistoryRetentionDays?: number) {
      if (expectedHistoryRetentionDays === undefined) return true;
      const fresh = readCoordinatorConfig(root as Repository);
      return (
        fresh.status === "ready" &&
        fresh.config.historyRetentionDays === expectedHistoryRetentionDays
      );
    },
  });
}

/** 既存の実行・終端借用の再検証を、履歴確認時だけ設定現在性へ接続する。 */
export function withHistoryRetention<
  T extends Readonly<{ revalidate: () => boolean }>,
>(context: T | null, root?: unknown) {
  if (!context) return null;
  const history = historyRepositoryInput(
    root ?? (context as { root?: unknown }).root,
  );
  return Object.freeze({
    ...context,
    historyRetentionDays: history.historyRetentionDays,
    revalidate(expectedHistoryRetentionDays?: number) {
      return (
        context.revalidate() && history.revalidate(expectedHistoryRetentionDays)
      );
    },
  });
}

export const REPOSITORY_AREAS = Object.freeze([
  "config",
  "domain-model",
  "execution-intelligence",
  "candidates",
  "workspaces",
  "operations",
  "release",
  "communication",
  "tests",
  "tmp",
  "lock",
] as const);

export const AREA_PATH_KEYS = Object.freeze({
  config: "config",
  "domain-model": "domainModel",
  "execution-intelligence": "executionIntelligence",
  candidates: "candidates",
  workspaces: "workspaces",
  operations: "operations",
  release: "release",
  communication: "communication",
  tests: "tests",
  tmp: "temporary",
  lock: "locks",
} as const);

/**
 * runtime-data-path-resolverで使用するRepository Runtime Areaの値契約を定義する。
 *
 * @responsibility Repository Runtime AreaのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape RepositoryExecutionAreaが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryExecutionAreaで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryExecutionAreaの宣言は外部境界を開かない。
 * @security N/A: RepositoryExecutionAreaはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryExecutionAreaの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryExecutionArea = (typeof REPOSITORY_AREAS)[number];

/**
 * 既存Runtime領域の読取り専用観測結果を定義する。
 * @responsibility 不存在、境界不正、観測不能、検証済み既存領域を区別する。
 * @trace ARCH-000011
 * @shape readyは名前付きareaと不透明な境界Identity、他状態は閉じたreasonを持つ。
 * @invariant private Runtime RootのPathや書込みAuthorityを公開しない。
 * @boundary Runtime Data Ownerと名前付き領域の利用側。
 * @security boundaryIdentityは置換検知用の非Authority参照である。
 * @compatibility areaの作成入口とは独立した読取り専用APIである。
 */
export type RepositoryExecutionDataAreaObservation =
  | Readonly<{
      status: "ready";
      repositoryRoot: string;
      directory: string;
      boundaryIdentity: string;
      effectIssued: false;
    }>
  | Readonly<{
      status: "not_observed";
      reason: "repository_runtime_data_area_absent";
      effectIssued: false;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "repository_runtime_data_root_capability_invalid"
        | "repository_runtime_data_area_boundary_invalid"
        | "repository_runtime_data_area_observation_failed";
      effectIssued: false;
    }>;

/**
 * Resolves only canonical paths. The caller remains responsible for proving
 *
 * @responsibility Repository Runtime Data Paths From Validated Rootの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input repositoryRoot: string
 * @returns resolveRepositoryExecutionDataPathsFromValidatedRootの計算結果を返す。
 * @precondition 「repositoryRoot: string」がresolveRepositoryExecutionDataPathsFromValidatedRootの入力契約を満たす。
 * @postcondition resolveRepositoryExecutionDataPathsFromValidatedRootの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryExecutionDataPathsFromValidatedRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryExecutionDataPathsFromValidatedRootは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryExecutionDataPathsFromValidatedRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryExecutionDataPathsFromValidatedRootはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveRepositoryExecutionDataPathsFromValidatedRootはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveRepositoryExecutionDataPathsFromValidatedRootは共有非同期状態を持たない同期処理である。
 */
function resolveRepositoryExecutionDataPathsFromValidatedRoot(
  repositoryRoot: string,
) {
  if (
    !path.isAbsolute(repositoryRoot) ||
    path.resolve(repositoryRoot) !== repositoryRoot
  )
    return null;
  const root = path.join(repositoryRoot, ".crdd");
  return Object.freeze({
    repositoryRoot,
    root,
    config: path.join(root, "config"),
    repositoryManifest: path.join(root, "config", "repository-manifest.json"),
    externalSendPolicy: path.join(root, "config", "external-send-policy.json"),
    domainModel: path.join(root, "domain-model"),
    executionIntelligence: path.join(root, "execution-intelligence"),
    candidates: path.join(root, "candidates"),
    workspaces: path.join(root, "workspaces"),
    operations: path.join(root, "operations"),
    release: path.join(root, "release"),
    communication: path.join(root, "communication"),
    tests: path.join(root, "tests"),
    temporary: path.join(root, "tmp"),
    locks: path.join(root, "lock"),
    allowedTopLevelAreas: REPOSITORY_AREAS,
  });
}

/**
 * Repository Runtime Data Pathsを一意に解決する。
 *
 * @responsibility Repository Runtime Data Pathsの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input capability: Repository
 * @returns resolveRepositoryExecutionDataPathsの計算結果を返す。
 * @precondition 「capability: Repository」がresolveRepositoryExecutionDataPathsの入力契約を満たす。
 * @postcondition resolveRepositoryExecutionDataPathsの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryExecutionDataPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryExecutionDataPathsは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryExecutionDataPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryExecutionDataPathsはProcess内の同一Subsystemで完結する。
 * @security resolveRepositoryExecutionDataPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRepositoryExecutionDataPathsは共有非同期状態を持たない同期処理である。
 */
export function resolveRepositoryExecutionDataPaths(capability: Repository) {
  const resolved =
    resolveRepositoryExecutionDataPathsForInternalUse(capability);
  if (!resolved) return null;
  const { root: internalRoot, ...publicPaths } = resolved;
  if (path.dirname(internalRoot) !== resolved.repositoryRoot) return null;
  return Object.freeze(publicPaths);
}

/**
 * Runtime Data implementation-only path set; omitted from the public index.
 *
 * @responsibility Repository Runtime Data Paths For Internal Useの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input capability: Repository
 * @returns resolveRepositoryExecutionDataPathsForInternalUseの計算結果を返す。
 * @precondition 「capability: Repository」がresolveRepositoryExecutionDataPathsForInternalUseの入力契約を満たす。
 * @postcondition resolveRepositoryExecutionDataPathsForInternalUseの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryExecutionDataPathsForInternalUseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryExecutionDataPathsForInternalUseは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryExecutionDataPathsForInternalUseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryExecutionDataPathsForInternalUseはProcess内の同一Subsystemで完結する。
 * @security resolveRepositoryExecutionDataPathsForInternalUseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRepositoryExecutionDataPathsForInternalUseは共有非同期状態を持たない同期処理である。
 */
function resolveRepositoryExecutionDataPathsForInternalUse(
  capability: Repository,
) {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null
    ? null
    : resolveRepositoryExecutionDataPathsFromValidatedRoot(repositoryRoot);
}

/**
 * private Rootと名前付き領域の既存境界をOwner内で観測する。
 * @responsibility 利用側によるParent Rootの復元を不要にし、真正不存在と観測障害を分ける。
 * @trace ARCH-000011
 * @input capability: 検証済みRepository Root能力、area: 宣言済み領域名。
 * @returns ready、not_observed、blockedの閉じた観測結果。
 * @precondition Callerは公開されたRepository Root能力を渡す。
 * @postcondition readyではRootとareaのlstat/realpath相関を確認済みである。
 * @effect Filesystem metadataとVCS境界を読む。Ignore登録、mkdir、Lock、書込みは0。
 * @failure 無効能力、link/type不正、観測障害を閉じたreasonで返す。
 * @invariant ENOENTだけをnot_observedとし、時刻やmtimeをIdentityに使わない。
 * @boundary private Runtime Rootと公開された名前付きareaの観測境界。
 * @security raw Root、秘密値、回復Authorityを公開しない。
 * @concurrency 開始・終了の不透明Identity比較で境界置換を検出できる。将来の状態を保証しない。
 */
export function observeRepositoryExecutionDataArea(
  capability: Repository,
  area: RepositoryExecutionArea,
): RepositoryExecutionDataAreaObservation {
  try {
    const paths = resolveRepositoryExecutionDataPathsForInternalUse(capability);
    if (!paths || !REPOSITORY_AREAS.includes(area))
      return Object.freeze({
        status: "blocked",
        reason: "repository_runtime_data_root_capability_invalid",
        effectIssued: false,
      });
    const directory = paths[AREA_PATH_KEYS[area]];
    const identities: string[] = [];
    for (const target of [paths.root, directory]) {
      let metadata: fs.BigIntStats;
      try {
        metadata = fs.lstatSync(target, { bigint: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          return Object.freeze({
            status: "not_observed",
            reason: "repository_runtime_data_area_absent",
            effectIssued: false,
          });
        throw error;
      }
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.realpathSync.native(target) !== target
      )
        return Object.freeze({
          status: "blocked",
          reason: "repository_runtime_data_area_boundary_invalid",
          effectIssued: false,
        });
      const canonical = fs.lstatSync(fs.realpathSync.native(target), {
        bigint: true,
      });
      if (canonical.dev !== metadata.dev || canonical.ino !== metadata.ino)
        return Object.freeze({
          status: "blocked",
          reason: "repository_runtime_data_area_boundary_invalid",
          effectIssued: false,
        });
      identities.push(metadata.dev.toString(), metadata.ino.toString());
    }
    const boundaryIdentity = createHash("sha256")
      .update(identities.join("\0"))
      .digest("hex");
    return Object.freeze({
      status: "ready",
      repositoryRoot: paths.repositoryRoot,
      directory,
      boundaryIdentity,
      effectIssued: false,
    });
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "repository_runtime_data_area_observation_failed",
      effectIssued: false,
    });
  }
}

/**
 * AI書込みから守る内部Directoryだけを観測又は準備する。
 * @responsibility raw Rootを公開せず空の保護Mount先を既存Ownerで扱う。
 * @trace ARCH-000011
 * @input 検証済み実行Treeとobserve／prepareの明示操作。
 * @returns ready／absent／blocked。Pathや書込みAuthorityは返さない。
 * @precondition 呼出し元が借用Treeの利用許可を保持する。
 * @postcondition 観測は作成0、準備も既存内容を変更しない。
 * @effect prepare時の真正不存在に限りRoot直下のDirectory一件を作成する。
 * @failure 型不正・link・観測不能はblocked、旧Pathへfallbackしない。
 * @invariant 状態初期化、子領域、Lockや台帳を追加しない。
 * @boundary 実行Treeと内部状態の保護Mount先。
 * @security raw Rootを一般保存先として利用側へ渡さない。
 * @concurrency 既存の上位利用調停下で呼び、将来の置換不存在は保証しない。
 */
export function checkRepositoryRuntimeDataProtectionDirectory(
  capability: Repository,
  operation: "observe" | "prepare",
): "ready" | "absent" | "blocked" {
  try {
    if (operation !== "observe" && operation !== "prepare") return "blocked";
    const paths = resolveRepositoryExecutionDataPathsForInternalUse(capability);
    if (!paths) return "blocked";
    let metadata: fs.Stats;
    try {
      metadata = fs.lstatSync(paths.root);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return "blocked";
      if (operation === "observe") return "absent";
      fs.mkdirSync(paths.root);
      metadata = fs.lstatSync(paths.root);
    }
    return metadata.isDirectory() &&
      !metadata.isSymbolicLink() &&
      fs.realpathSync.native(paths.root) === paths.root
      ? "ready"
      : "blocked";
  } catch {
    return "blocked";
  }
}

/**
 * Canonical Directoryが成立する状態を確保する。
 *
 * @responsibility Canonical Directoryの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000011
 * @input target: string
 * @returns N/A: ensureCanonicalDirectoryは戻り値を返さない。
 * @precondition 「target: string」がensureCanonicalDirectoryの入力契約を満たす。
 * @postcondition ensureCanonicalDirectoryの責務を完了して呼出し元へ制御を戻す。
 * @effect ensureCanonicalDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure ensureCanonicalDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ensureCanonicalDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: ensureCanonicalDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ensureCanonicalDirectoryは共有非同期状態を持たない同期処理である。
 */
function ensureCanonicalDirectory(target: string): void {
  try {
    fs.mkdirSync(target, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const metadata = fs.lstatSync(target);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(target) !== target
  )
    throw new Error("runtime_data_area_boundary_invalid");
}

/**
 * 宣言済みRuntime領域を、ローカル除外の確定後だけ作成する。
 * @responsibility VCの完成した登録結果を受け、保存領域の判断と失敗情報を保持する。
 * @trace ARCH-000011
 * @effect 除外登録後に既存のRepository内領域を作成する。
 * @failure 除外のEffect不明・回収不明はblockedのまま返し、領域を作らない。
 */
export function ensureRepositoryExecutionDataArea(
  capability: Repository,
  area: RepositoryExecutionArea,
) {
  const paths = resolveRepositoryExecutionDataPathsForInternalUse(capability);
  if (!paths || !REPOSITORY_AREAS.includes(area)) return null;
  const ignore = registerRepositoryLocalIgnore(capability, ".crdd/");
  if (ignore.status !== "registered")
    return Object.freeze({
      status: "blocked" as const,
      reason: "repository_runtime_data_ignore_registration_blocked" as const,
      effectIssued: ignore.effectIssued,
      effectStateUnknown: ignore.effectStateUnknown,
      effectConfirmation: ignore.effectConfirmation,
      cleanupConfirmed: ignore.cleanupConfirmed,
      retryAllowed: ignore.retryAllowed,
      recoveryReference: ignore.recoveryReference,
      repositoryPathReported: false as const,
    });
  ensureCanonicalDirectory(paths.root);
  const directory = paths[AREA_PATH_KEYS[area]];
  ensureCanonicalDirectory(directory);
  return Object.freeze({
    status: "ready" as const,
    repositoryRoot: paths.repositoryRoot,
    directory,
  });
}

/**
 * Repository Runtime Data Area From Working Directoryが成立する状態を確保する。
 *
 * @responsibility Repository Runtime Data Area From Working Directoryの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000011
 * @input workingDirectory: unknown、area: RepositoryExecutionArea
 * @returns ensureRepositoryExecutionDataAreaFromWorkingDirectoryの計算結果を返す。
 * @precondition 「workingDirectory: unknown、area: RepositoryExecutionArea」がensureRepositoryExecutionDataAreaFromWorkingDirectoryの入力契約を満たす。
 * @postcondition ensureRepositoryExecutionDataAreaFromWorkingDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: ensureRepositoryExecutionDataAreaFromWorkingDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ensureRepositoryExecutionDataAreaFromWorkingDirectoryは独自の失敗分岐を所有しない。
 * @invariant ensureRepositoryExecutionDataAreaFromWorkingDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ensureRepositoryExecutionDataAreaFromWorkingDirectoryはProcess内の同一Subsystemで完結する。
 * @security N/A: ensureRepositoryExecutionDataAreaFromWorkingDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ensureRepositoryExecutionDataAreaFromWorkingDirectoryは共有非同期状態を持たない同期処理である。
 */
export function ensureRepositoryExecutionDataAreaFromWorkingDirectory(
  workingDirectory: unknown,
  area: RepositoryExecutionArea,
) {
  const verified = getRepositoryFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? ensureRepositoryExecutionDataArea(verified.capability, area)
    : null;
}

/**
 * require Ready Repository Runtime Data Areaを決定する。
 *
 * @responsibility require Ready Repository Runtime Data Areaの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000011
 * @input result: ReturnType<typeof ensureRepositoryExecutionDataArea>、invalidReason: string
 * @returns requireReadyRepositoryExecutionDataAreaの計算結果を返す。
 * @precondition 「result: ReturnType<typeof ensureRepositoryExecutionDataArea>、invalidReason: string」がrequireReadyRepositoryExecutionDataAreaの入力契約を満たす。
 * @postcondition requireReadyRepositoryExecutionDataAreaの責務を完了した結果だけを返す。
 * @effect N/A: requireReadyRepositoryExecutionDataAreaは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requireReadyRepositoryExecutionDataAreaは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requireReadyRepositoryExecutionDataAreaは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requireReadyRepositoryExecutionDataAreaはProcess内の同一Subsystemで完結する。
 * @security N/A: requireReadyRepositoryExecutionDataAreaはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: requireReadyRepositoryExecutionDataAreaは共有非同期状態を持たない同期処理である。
 */
export function requireReadyRepositoryExecutionDataArea(
  result: ReturnType<typeof ensureRepositoryExecutionDataArea>,
  invalidReason: string,
) {
  if (result?.status === "ready") return result;
  if (result?.status === "blocked")
    throw new RepositoryDataBlockedError(result);
  throw new Error(invalidReason);
}

/**
 * Coordinator所有の領域初期化失敗を情報を失わず搬送する。
 * @responsibility EM保存失敗とは区別して既知Effect・回復参照を保持する。
 * @trace ARCH-000004
 * @boundary Coordinatorの所在初期化と公開結果・診断への接続。
 */
export class RepositoryDataBlockedError extends Error {
  readonly reason: string;
  readonly effectIssued: boolean;
  readonly effectStateUnknown: boolean;
  readonly cleanupConfirmed: boolean;
  readonly retryAllowed: boolean;
  readonly recoveryReference: string | null;
  readonly repositoryPathReported = false as const;

  constructor(
    result: Exclude<
      ReturnType<typeof ensureRepositoryExecutionDataArea>,
      null | { status: "ready" }
    >,
  ) {
    super(result.reason);
    this.name = "RepositoryDataBlockedError";
    this.reason = result.reason;
    this.effectIssued = result.effectIssued;
    this.effectStateUnknown = result.effectStateUnknown;
    this.cleanupConfirmed = result.cleanupConfirmed;
    this.retryAllowed = result.retryAllowed;
    this.recoveryReference = result.recoveryReference;
  }
}

/** 読取りでは保存領域を初期化しない。設定・Root拒否を欠測と区別する。 */
export function getExecutionIntelligenceStore(
  repository: Repository,
  prepare: boolean,
): StoreOptions | null {
  const config = readExecutionIntelligenceConfig(repository);
  if (config.status !== "ready")
    throw Error("execution_intelligence_configuration_unavailable");
  const area = prepare
    ? requireReadyRepositoryExecutionDataArea(
        ensureRepositoryExecutionDataArea(repository, "execution-intelligence"),
        "execution_intelligence_directory_unavailable",
      )
    : observeRepositoryExecutionDataArea(repository, "execution-intelligence");
  if (!area) throw Error("execution_intelligence_directory_unavailable");
  if (area.status === "not_observed") return null;
  if (area.status !== "ready") throw Error(area.reason);
  return {
    directory: area.directory,
    retentionDays: config.config.historyRetentionDays,
  };
}

/**
 * Runtime Data Boundary Blockedを公開結果へ投影する。
 *
 * @responsibility Runtime Data Boundary Blockedの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input error: EM保存失敗またはCoordinator領域初期化失敗。
 * @returns coordinatorDataBoundaryBlockedの計算結果を返す。
 * @precondition 各Ownerが確定した停止情報を、その例外型のまま受け取る。
 * @postcondition coordinatorDataBoundaryBlockedの責務を完了した結果だけを返す。
 * @effect N/A: coordinatorDataBoundaryBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: coordinatorDataBoundaryBlockedは独自の失敗分岐を所有しない。
 * @invariant coordinatorDataBoundaryBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: coordinatorDataBoundaryBlockedはProcess内の同一Subsystemで完結する。
 * @security N/A: coordinatorDataBoundaryBlockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: coordinatorDataBoundaryBlockedは共有非同期状態を持たない同期処理である。
 */
export function coordinatorDataBoundaryBlocked(
  error: ExecutionStorageBlockedError | RepositoryDataBlockedError,
) {
  const ownerReleased =
    error.cause !== "coordinator_snapshot_lock_release_unconfirmed";
  return Object.freeze({
    contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
    status: "blocked" as const,
    reason: error.reason,
    cleanupConfirmed: error.cleanupConfirmed && ownerReleased,
    manualRecoveryRequired:
      error.effectStateUnknown || !error.cleanupConfirmed || !ownerReleased,
    effectState: error.effectStateUnknown
      ? ("unknown" as const)
      : error.effectIssued
        ? ("settled" as const)
        : ("no_effect" as const),
    effectIssued: error.effectIssued,
    effectStateUnknown: error.effectStateUnknown,
    retryAllowed: error.retryAllowed && ownerReleased,
    recoveryIds: Object.freeze(
      error.recoveryReference === null ? [] : [error.recoveryReference],
    ),
  });
}

/**
 * Coordinatorが管理する操作領域の全Pathを定義する。
 * @responsibility 作業・Home・記録と管理領域の所在を上位Ownerに閉じる。
 * @trace ARCH-000008
 * @invariant Executorへは必要な借用Pathだけを別途投影する。
 */
type OperationPaths = Readonly<{
  workspace: string;
  providerHome: string;
  tmp: string;
  events: string;
  projection: string;
  management: string;
}>;

/**
 * 借用Treeの最終観測を内容なしで投影する。
 * @responsibility 全終端の変更情報を同じ意味で返す。
 * @trace ARCH-000004
 * @input 元Workspace capability又は未確定、検証済み対象。
 * @returns 欠測をnullのまま保持した観測値。
 * @precondition 呼出し元が対象の実行許可を確認済み。
 * @postcondition Treeの現存・成果採用・回収成功を主張しない。
 * @effect Git／Filesystem読取りだけ。
 * @failure 観測不能は変更Path null。
 * @invariant 一次失敗や回復状態を変更しない。
 * @boundary 終了処理から認可済み上位結果。
 * @security 内容・Host Pathを含めない。
 * @concurrency 他の編集との帰属は未確定。
 */
export function projectBorrowedExecutionResult(
  capability: object | undefined,
  target: BorrowedExecutionTarget,
): WorkspaceResult {
  const changedPaths = capability
    ? observeBorrowedExecutionChanges(capability)
    : null;
  return Object.freeze({
    workspaceId: target.workspaceId,
    changedPaths,
    canonicalRepositoryChanged:
      target.executionTree === target.ownerRepositoryRoot
        ? changedPaths === null
          ? null
          : changedPaths.length > 0
        : false,
    changeAttribution: "unattributed",
    workspaceDeletionIssued: false,
  });
}

/**
 * 同じ借用Ownerに結合したGit固定内容だけを保持する。
 * @responsibility 基準CommitとGit可視Pathを保持し、独自Inventory・Manifestを持たない。
 * @trace ARCH-000013
 * @boundary 実行中の借用結合。永続するRef/OIDは同じHost記録が所有する。
 */
type WorkspaceRecord = Readonly<{
  managementCapability: object;
  mountCapability: object;
  repositoryBindingCapability: object;
  operationId: string;
  source: Repository;
  sourceTree: string;
  baseHead: string;
  baseCommitId: string;
  basePaths: readonly string[];
}>;

const RESERVED_WINDOWS_SEGMENT =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const INVALID_WINDOWS_CHARACTER = /[<>:"|?*\\\x00-\x1f\x7f]/u;
/**
 * Segmentが有効か判定する。
 *
 * @responsibility Segmentの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000013
 * @input segment: string
 * @returns validSegmentの計算結果を返す。
 * @precondition 「segment: string」がvalidSegmentの入力契約を満たす。
 * @postcondition validSegmentの責務を完了した結果だけを返す。
 * @effect N/A: validSegmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validSegmentは独自の失敗分岐を所有しない。
 * @invariant validSegmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validSegmentはProcess内の同一Subsystemで完結する。
 * @security validSegmentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validSegmentは共有非同期状態を持たない同期処理である。
 */
function validSegment(segment: string) {
  return !(
    segment.length === 0 ||
    segment === "." ||
    segment === ".." ||
    segment.toLowerCase() === ".git" ||
    Buffer.byteLength(segment, "utf8") > 255 ||
    INVALID_WINDOWS_CHARACTER.test(segment) ||
    RESERVED_WINDOWS_SEGMENT.test(segment) ||
    segment.endsWith(".") ||
    segment.endsWith(" ")
  );
}

/**
 * Relative Pathが有効か判定する。
 *
 * @responsibility Relative Pathの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000013
 * @input relativePath: string
 * @returns isExecutionRelativePathの計算結果を返す。
 * @precondition 「relativePath: string」がisExecutionRelativePathの入力契約を満たす。
 * @postcondition isExecutionRelativePathの責務を完了した結果だけを返す。
 * @effect N/A: isExecutionRelativePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isExecutionRelativePathは独自の失敗分岐を所有しない。
 * @invariant isExecutionRelativePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isExecutionRelativePathはProcess内の同一Subsystemで完結する。
 * @security isExecutionRelativePathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isExecutionRelativePathは共有非同期状態を持たない同期処理である。
 */
export function isExecutionRelativePath(relativePath: string) {
  return (
    relativePath.length > 0 &&
    !path.isAbsolute(relativePath) &&
    !relativePath.includes("\\") &&
    relativePath.split("/").every(validSegment)
  );
}

/**
 * File Contentを安定Identityへ変換する。
 *
 * @responsibility File Contentの正規化条件、一意性、変換不能時の拒否境界を所有する。
 * @trace ARCH-000013
 * @input target: string
 * @returns readExecutionFileの計算結果を返す。
 * @precondition 「target: string」がreadExecutionFileの入力契約を満たす。
 * @postcondition readExecutionFileの責務を完了した結果だけを返す。
 * @effect readExecutionFileは内容と実体を読取り、書込みを発行しない。
 * @failure readExecutionFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readExecutionFileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readExecutionFileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readExecutionFileは共有非同期状態を持たない同期処理である。
 */
export function readExecutionFile(target: string) {
  const handle = fs.openSync(target, "r");
  try {
    const before = fs.fstatSync(handle, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size < 0n ||
      !Number.isSafeInteger(Number(before.size))
    ) {
      throw new Error("repository_workspace_file_invalid");
    }
    const content = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < content.byteLength) {
      const readBytes = fs.readSync(
        handle,
        content,
        offset,
        content.byteLength - offset,
        offset,
      );
      if (readBytes <= 0) throw new Error("repository_workspace_file_changed");
      offset += readBytes;
    }
    const after = fs.fstatSync(handle, { bigint: true });
    const current = fs.lstatSync(target, { bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.birthtimeNs !== after.birthtimeNs ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      !current.isFile() ||
      current.isSymbolicLink() ||
      current.dev !== before.dev ||
      current.ino !== before.ino ||
      current.birthtimeNs !== before.birthtimeNs
    ) {
      throw new Error("repository_workspace_file_changed");
    }
    return Object.freeze({
      content,
      byteLength: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  } finally {
    fs.closeSync(handle);
  }
}

/** Git可視の現在内容をVCの選択値として捕捉する。 @trace ARCH-000013 */
function readGitSelection(record: WorkspaceRecord, comparison: string) {
  const observed = readRepositoryEntries(record.sourceTree);
  if (
    observed.status !== "completed" ||
    !observed.nestedRepositoryObservationComplete ||
    observed.entries.some((entry) => entry.kind !== "file" || entry.conflicted)
  )
    throw Error("execution_git_observation_unavailable");
  const changes = readWorkingChanges(record.source, record.baseHead);
  const paths = [
    ...new Set([
      ...record.basePaths,
      ...observed.entries.map((entry) => entry.relativePath),
      ...changes.changedPaths,
    ]),
  ]
    .filter((value) => !/^\.crdd(?:\/|$)/u.test(value))
    .sort();
  const spellings = new Map<string, string>();
  for (const relativePath of paths) {
    const segments = relativePath.split("/");
    for (let count = 1; count <= segments.length; count++) {
      const prefix = segments.slice(0, count).join("/");
      const key = prefix.toLowerCase();
      const prior = spellings.get(key);
      if (prior !== undefined && prior !== prefix)
        throw Error("execution_git_path_case_conflict");
      spellings.set(key, prefix);
    }
  }
  return paths.flatMap((relativePath) => {
    if (!isExecutionRelativePath(relativePath))
      throw Error("execution_git_path_invalid");
    try {
      const file = readFile(record.source, {
        baseCommit: comparison,
        path: relativePath,
      });
      if (file.head !== record.baseHead)
        throw Error("execution_git_head_changed");
      return [Object.freeze(file.selection)];
    } catch (error) {
      // VCが同じ固定Commitにも現在Treeにも存在しないと明示したPathだけを除外する。
      if (
        error instanceof Error &&
        error.message === "repository_file_not_found"
      )
        return [];
      throw error;
    }
  });
}

/** 既存HostのCAS内でRef予定と技術結果を保持する。 @trace ARCH-000013 */
function writeGitSnapshot(
  host: HostState,
  item: NonNullable<HostRecord["git"]>[number],
) {
  const previous = host.record.git ?? [];
  const index = previous.findIndex((value) => value.name === item.name);
  writeHostCheckpoint(host, {
    ...host.record,
    git:
      index < 0
        ? [...previous, item]
        : previous.map((value, at) => (at === index ? item : value)),
  });
}

/** Gitの基準又は候補を、保存済み予定・OID・Refの順に固定する。 @trace ARCH-000013 */
function createExecutionCommit(record: WorkspaceRecord, baseCommit: string) {
  const { identity } = ownedOperationFromManagementCapability(
    record.managementCapability,
  );
  const host = identity.host;
  freshHost(host);
  requireHostExecutionCurrent(host.input);
  const sequence = host.record.git?.length ?? 0;
  const name = `refs/heads/crdd/operation/${record.operationId}/${sequence === 0 ? "baseline" : `candidate-${sequence}`}`;
  const planned: NonNullable<HostRecord["git"]>[number] = {
    name,
    commitId: null,
    temporary: null,
    request: "not_issued",
    cleanup: "pending",
  };
  writeGitSnapshot(host, planned);
  const selection = readGitSelection(record, baseCommit);
  const temporaryDirectory = `.crdd/operations/${record.operationId}/management`;
  const result = createCommit(record.source, {
    baseCommit,
    expectedHead: record.baseHead,
    selection,
    message: `CRDD ${record.operationId} ${sequence === 0 ? "baseline" : "candidate"}`,
    temporaryDirectory,
    allowEmpty: true,
  });
  // blockedでも生成済みOID・未回収Indexを捨てない。保存失敗後にRefを発行しない。
  const received = {
    ...planned,
    commitId: result.commitId,
    temporary: result.temporary,
  };
  writeGitSnapshot(host, received);
  if (
    result.status !== "completed" ||
    !result.cleanupConfirmed ||
    !result.commitId
  )
    throw Error("execution_git_commit_unconfirmed", { cause: result.reason });
  if (!isDeepStrictEqual(selection, readGitSelection(record, baseCommit)))
    throw Error("execution_git_content_changed");
  requireHostExecutionCurrent(host.input);
  writeGitSnapshot(host, { ...received, request: "unknown" });
  const referenced = createReference(host.input.root, {
    name,
    commitId: result.commitId,
  });
  if (
    referenced.status !== "completed" ||
    referenced.present !== true ||
    !referenced.effectConfirmed
  )
    throw Error("execution_git_reference_unconfirmed");
  writeGitSnapshot(host, { ...received, request: "confirmed" });
  return Object.freeze({
    name,
    commitId: result.commitId,
    paths: Object.freeze(
      selection.filter((item) => item.blobId !== null).map((item) => item.path),
    ),
  });
}

/** 同じ管理OwnerのGit資源を期待OID付きで回収する。 @trace ARCH-000013 */
function cleanupHostGit(host: HostState) {
  for (const item of host.record.git ?? []) {
    if (item.cleanup === "confirmed") continue;
    freshHost(host);
    const removed = removeReference(host.input.root, {
      name: item.name,
      expectedCommitId: item.commitId,
      ...(item.temporary
        ? {
            temporaryIndex: {
              directory: `.crdd/operations/${host.record.operationId}/management`,
              value: item.temporary,
            },
          }
        : {}),
    });
    if (
      removed.status !== "completed" ||
      removed.present !== false ||
      !removed.cleanupConfirmed
    )
      throw Error("host_operation_git_cleanup_unconfirmed");
    writeGitSnapshot(host, { ...item, cleanup: "confirmed" });
  }
}

/** 固定基準と現在のGit可視内容を比較する。 @trace ARCH-000013 */
export function observeBorrowedExecutionChanges(capability: object) {
  try {
    const management = ownValue(capability, "managementCapability");
    if (!isObject(management)) return null;
    const observed = readBorrowedExecutionBinding(management);
    const record = observed?.snapshot;
    if (!observed || !record || record !== capability) return null;
    const current = currentWorkspaceRecord(
      capability,
      record.repositoryBindingCapability,
      record.managementCapability,
      record.mountCapability,
      observed,
    );
    if (!current) return null;
    return Object.freeze(
      readGitSelection(record, record.baseCommitId)
        .filter((selection) => {
          const before = readCommitFile(record.source, {
            commit: record.baseCommitId,
            path: selection.path,
          });
          if (selection.blobId === null) return true;
          return (
            before === null ||
            before.blobId !== selection.blobId ||
            before.mode !== selection.mode
          );
        })
        .map((selection) => selection.path),
    );
  } catch {
    return null;
  }
}

/**
 * Pathsが許可範囲内か判定する。
 *
 * @responsibility Pathsの許可条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000013
 * @input rawAllowedPaths: unknown
 * @returns allowedPathsの計算結果を返す。
 * @precondition 「rawAllowedPaths: unknown」がallowedPathsの入力契約を満たす。
 * @postcondition allowedPathsの責務を完了した結果だけを返す。
 * @effect N/A: allowedPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure allowedPathsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant allowedPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: allowedPathsはProcess内の同一Subsystemで完結する。
 * @security allowedPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: allowedPathsは共有非同期状態を持たない同期処理である。
 */
function allowedPaths(rawAllowedPaths: unknown) {
  if (!Array.isArray(rawAllowedPaths)) return null;
  const normalizedAllowedPaths: string[] = [];
  try {
    const descriptors = Object.getOwnPropertyDescriptors(rawAllowedPaths);
    for (let index = 0; index < rawAllowedPaths.length; index += 1) {
      const descriptor = descriptors[index.toString()];
      if (
        !descriptor ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "string"
      )
        return null;
      const isDirectory = descriptor.value.endsWith("/");
      const relativePath = isDirectory
        ? descriptor.value.slice(0, -1)
        : descriptor.value;
      if (!isExecutionRelativePath(relativePath)) return null;
      normalizedAllowedPaths.push(
        isDirectory ? `${relativePath}/` : relativePath,
      );
    }
  } catch {
    return null;
  }
  const uniqueAllowedPaths = [...new Set(normalizedAllowedPaths)].sort(
    (left, right) => Buffer.from(left).compare(Buffer.from(right)),
  );
  return uniqueAllowedPaths.length === normalizedAllowedPaths.length &&
    uniqueAllowedPaths.length > 0
    ? Object.freeze(uniqueAllowedPaths)
    : null;
}

/**
 * Allowedかを判定する。
 *
 * @responsibility Allowedの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000013
 * @input relativePath: string、paths: readonly string[]
 * @returns isAllowedの計算結果を返す。
 * @precondition 「relativePath: string、paths: readonly string[]」がisAllowedの入力契約を満たす。
 * @postcondition isAllowedの責務を完了した結果だけを返す。
 * @effect N/A: isAllowedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isAllowedは独自の失敗分岐を所有しない。
 * @invariant isAllowedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isAllowedはProcess内の同一Subsystemで完結する。
 * @security isAllowedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isAllowedは共有非同期状態を持たない同期処理である。
 */
function isAllowed(relativePath: string, paths: readonly string[]) {
  return paths.some((allowedPath) =>
    allowedPath.endsWith("/")
      ? relativePath.startsWith(allowedPath)
      : relativePath === allowedPath,
  );
}

/**
 * 借用対象の開始dirtyをGit Commitへ固定する。
 * @responsibility 作成予定保存とVC完成操作を接続し、通常Index・HEADを変更しない。
 * @trace ARCH-000013
 * @effect 元Host記録、Git Objectと専用Refだけを更新する。
 * @boundary Main／Linkedの対象と現在Ownerを同じ操作へ結合する。
 */
export function bindRuntimeOwnedExecutionSnapshot(
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
  rawReadPaths?: unknown,
  borrowedTarget?: unknown,
) {
  try {
    if (
      !isObject(repositoryBindingCapability) ||
      !isObject(managementCapability) ||
      !isObject(mountCapability) ||
      !borrowedTarget ||
      (rawReadPaths !== undefined && !allowedPaths(rawReadPaths))
    )
      return null;
    const source = borrowRuntimeOwnedRepositorySource(
      repositoryBindingCapability,
      managementCapability,
    );
    const binding = verifyOwnedOperationManagementMountBinding(
      managementCapability,
      mountCapability,
    );
    if (!source || source.operationId !== binding.operationId) return null;
    const target = bindBorrowedExecutionTarget(
      managementCapability,
      mountCapability,
      source.repositoryRoot,
      borrowedTarget,
    );
    if (!target) return null;
    const location = getRepository(target.executionTree);
    if (location.status !== "completed") return null;
    const observed = readRepositorySnapshot(location.capability);
    if (
      !observed ||
      (target.head !== null && observed.revisionIdentity !== target.head)
    )
      return null;
    const initial: WorkspaceRecord = Object.freeze({
      managementCapability,
      mountCapability,
      repositoryBindingCapability,
      operationId: binding.operationId,
      source: location.capability,
      sourceTree: target.executionTree,
      baseHead: observed.revisionIdentity,
      baseCommitId: observed.revisionIdentity,
      basePaths: Object.freeze([]),
    });
    const baseline = createExecutionCommit(initial, observed.revisionIdentity);
    const record: WorkspaceRecord = Object.freeze({
      ...initial,
      baseCommitId: baseline.commitId,
      basePaths: baseline.paths,
    });
    const borrowed = readBorrowedExecutionBinding(managementCapability);
    if (!borrowed) return null;
    bindExecutionSnapshotToBorrowed(managementCapability, borrowed, record);
    return Object.freeze({
      status: "materialized" as const,
      borrowed: true,
      workspaceCapability: record,
      baseCommitId: baseline.commitId,
      fileCount: baseline.paths.length,
      pathReported: false,
    });
  } catch {
    return null;
  }
}

/**
 * 既存Hostの進捗に、下位が引き渡した回復参照を登録する。
 * @responsibility 回復IDと制御参照の組をそのまま保持し、どちらかの再利用も拒否する。
 * @trace ARCH-000008
 * @precondition 呼出し側が対象Hostと、用途ごとに残せる引渡し件数を決める。
 * @returns 新規の組を登録できた場合だけtrue。
 * @effect 元の進捗への同期登録だけ。保存・回収・権限発行は行わない。
 * @failure 欠測、不正、重複では既存の組を変更しない。
 */
export function registerRuntimeOwnedDockerHandoff(
  target: Pick<HostCompletionTarget, "dockerHandoffs">,
  capability: unknown,
  recoveryReference: unknown,
): boolean {
  const recoveryId = resolveRecoveryReference(recoveryReference);
  if (
    capability === null ||
    typeof capability !== "object" ||
    !recoveryId ||
    target.dockerHandoffs.some(
      (handoff) =>
        handoff.capability === capability || handoff.recoveryId === recoveryId,
    )
  )
    return false;
  target.dockerHandoffs.push({ capability, recoveryId, state: "active" });
  return true;
}

/**
 * 下位完了通知を受け取った元の回復引渡しを照合する。
 * @responsibility 回復参照と確定用の制御参照の一致をTaskとAdviceで同じ規則で判定する。
 * @trace ARCH-000008
 * @input target: 元の引渡しを持つHost。recoveryId: 下位開始と相関する回復参照。completionCapability: 下位完了が返した確定用参照。
 * @returns 一致した引渡し、対象なし、または不一致。
 * @precondition 下位の回収確認は呼出し側が既存契約に従って確認する。
 * @postcondition 照合前後で引渡し状態を変更しない。
 * @effect N/A: 元の引渡し記録を読むだけ。
 * @failure 片側だけの引渡し、または別の制御参照は不一致を返す。
 * @invariant 参照なしを清掃確定に置き換えない。
 * @boundary 元の回復引渡しと下位完了の照合。
 * @security 参照を再生成せず、保存・清掃の権限を発行しない。
 * @concurrency 呼出しと同じ同期区間で照合する。
 */
export function matchRuntimeOwnedDockerHandoff(
  target: HostCompletionTarget,
  recoveryId: string | null,
  completionCapability: unknown,
) {
  const handoff = target.dockerHandoffs.find(
    (candidate) => candidate.recoveryId === recoveryId,
  );
  const capability =
    completionCapability !== null && typeof completionCapability === "object"
      ? completionCapability
      : null;
  if (!handoff && !capability) return "not_tracked";
  if (!handoff || handoff.capability !== capability) return "mismatch";
  return handoff;
}

/**
 * 照合した引渡しに元の完了結果を保持し、確定準備へ進める。
 * @responsibility TaskとAdviceで同じ引渡し状態の更新を所有する。
 * @trace ARCH-000008
 * @precondition 元の引渡しとの照合と、用途固有の完了条件が成立している。
 * @postcondition 元の完了結果を差し替えず、同じ引渡しをfinalizableにする。
 * @effect 同期の状態更新だけ。Host清掃・保存・回復確定は行わない。
 */
export function recordRuntimeOwnedDockerHandoffCompletion(
  handoff: HostCompletionTarget["dockerHandoffs"][number],
  completion: unknown,
): void {
  handoff.dockerCompletion = completion;
  handoff.state = "finalizable";
}

/** 借用結合の既存Mapだけに実行中の固定内容を保持する。 @trace ARCH-000013 */
function bindExecutionSnapshotToBorrowed(
  management: object,
  current: BorrowedBinding,
  snapshot: WorkspaceRecord,
) {
  borrowed.set(management, Object.freeze({ ...current, snapshot }));
}

/** 同じ借用・管理・Mount・基準Refの現在性を照合する。観測済み値は直前の同期観測だけを渡す。 @trace ARCH-000013 */
function currentWorkspaceRecord(
  workspaceCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
  observed?: BorrowedBinding,
) {
  if (!isObject(workspaceCapability) || !isObject(managementCapability))
    return null;
  const borrowed =
    observed ?? readBorrowedExecutionBinding(managementCapability);
  const record = borrowed?.snapshot;
  if (
    !record ||
    workspaceCapability !== record ||
    record.managementCapability !== managementCapability ||
    record.mountCapability !== mountCapability ||
    record.repositoryBindingCapability !== repositoryBindingCapability ||
    borrowed.target.executionTree !== record.sourceTree
  )
    return null;
  const repository = verifyRuntimeOwnedRepositoryBindingCapability(
    repositoryBindingCapability,
    managementCapability,
  );
  const binding = verifyOwnedOperationManagementMountBinding(
    managementCapability,
    mountCapability,
  );
  const host = readOwnedHostOperation(managementCapability).record;
  const baseline = host.git?.[0];
  return repository &&
    binding.operationId === record.operationId &&
    baseline?.commitId === record.baseCommitId &&
    baseline.request === "confirmed" &&
    baseline.cleanup === "pending"
    ? record
    : null;
}

/** 固定基準からのGit差分を候補Commitへ一度固定する。 @trace ARCH-000013 */
export function captureExecutionChangeSnapshot(
  workspaceCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
  rawAllowedPaths: unknown,
) {
  try {
    const current = currentWorkspaceRecord(
      workspaceCapability,
      repositoryBindingCapability,
      managementCapability,
      mountCapability,
    );
    const paths = allowedPaths(rawAllowedPaths);
    if (!current || !paths) return null;
    const candidate = createExecutionCommit(current, current.baseCommitId);
    const diff = readCommitDiff(current.source, {
      baseCommit: current.baseCommitId,
      commitId: candidate.commitId,
    });
    return Object.freeze({
      status: "candidate" as const,
      operationId: current.operationId,
      baseCommitId: current.baseCommitId,
      candidateCommitId: candidate.commitId,
      changedPaths: diff.changedPaths,
      unexpectedPaths: Object.freeze(
        diff.changedPaths.filter((value) => !isAllowed(value, paths)),
      ),
      candidateCapability: Object.freeze({
        name: candidate.name,
        commitId: candidate.commitId,
      }),
      pathReported: false,
      canonicalRepositoryChanged: false,
    });
  } catch {
    return null;
  }
}

/**
 * 許可範囲だけを固定Commitから自己所有領域へコピーしReviewerへ渡す。
 * @responsibility 機密拒否、固定内容と実搬送本文の相関を保持する。
 * @trace ARCH-000013
 * @effect 元Hostのprojection子内への限定コピー。借用元の現在Fileは読まない。
 */
export function projectReviewerReadContent(
  workspaceCapability: unknown,
  candidateCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
  rawReadPaths: unknown,
) {
  try {
    const current = currentWorkspaceRecord(
      workspaceCapability,
      repositoryBindingCapability,
      managementCapability,
      mountCapability,
    );
    const readPaths = allowedPaths(rawReadPaths);
    if (!current || !readPaths || !isObject(managementCapability)) return null;
    const verified = verifyExecutionChangeSnapshot(
      candidateCapability,
      repositoryBindingCapability,
      managementCapability,
      mountCapability,
    );
    if (verified?.status !== "verified") return null;
    const { identity } =
      ownedOperationFromManagementCapability(managementCapability);
    const host = identity.host;
    const position = host.record.git?.findIndex(
      (item) =>
        item.commitId === verified.candidateCommitId &&
        !item.name.endsWith("/baseline"),
    );
    if (position === undefined || position < 1) return null;
    const binding = verifyOwnedOperationManagementMountBinding(
      managementCapability,
      mountCapability,
    );
    const directory = path.join(
      binding.mounts.projection,
      `reviewer-${position}`,
    );
    fs.mkdirSync(directory);
    const root = resolveVerifiedRepositoryRoot(host.input.root);
    if (!root) return null;
    const files: Readonly<Record<string, unknown>>[] = [];
    const copied = copyCommitFiles(current.source, {
      commit: verified.candidateCommitId,
      outputRepository: host.input.root,
      relativeDirectory: path
        .relative(root, directory)
        .split(path.sep)
        .join("/"),
      paths: readPaths,
      inspectContent: (relativePath, bytes) => {
        if (!isAllowed(relativePath, readPaths)) return true;
        try {
          const content = new TextDecoder("utf-8", { fatal: true }).decode(
            bytes,
          );
          if (containsRecognizedSecretMaterial(relativePath, content))
            return true;
          files.push(
            Object.freeze({
              path: relativePath,
              state: "present",
              byteLength: bytes.byteLength,
              sha256: createHash("sha256").update(bytes).digest("hex"),
              encoding: "utf-8",
              content,
            }),
          );
          return false;
        } catch {
          return true;
        }
      },
    });
    if (copied?.status !== "materialized")
      return Object.freeze({
        status: "blocked" as const,
        reason:
          copied?.status === "blocked"
            ? copied.reason
            : "execution_reviewer_copy_unconfirmed",
      });
    const presentPaths = new Set<string>();
    for (const file of files) {
      const relativePath = String(file.path);
      const observed = readExecutionFile(
        path.join(directory, ...relativePath.split("/")),
      );
      if (
        observed.sha256 !== file.sha256 ||
        observed.byteLength !== file.byteLength
      )
        throw Error("execution_reviewer_copy_changed");
      presentPaths.add(relativePath);
    }
    for (const relativePath of readPaths)
      if (!relativePath.endsWith("/") && !presentPaths.has(relativePath))
        files.push(Object.freeze({ path: relativePath, state: "absent" }));
    files.sort((left, right) =>
      Buffer.from(String(left.path)).compare(Buffer.from(String(right.path))),
    );
    const projectionHash = createHash("sha256")
      .update("crdd-candidate-read-projection-v2\0")
      .update(verified.candidateCommitId)
      .update("\0")
      .update(JSON.stringify(files))
      .digest("hex");
    const borrowed = readBorrowedExecutionBinding(managementCapability);
    if (!borrowed) return null;
    const fileHashes = files
      .filter((file) => file.state === "present")
      .map((file) =>
        Object.freeze({ path: String(file.path), sha256: String(file.sha256) }),
      );
    bindReviewerCopy(managementCapability, borrowed, {
      commitId: verified.candidateCommitId,
      directory,
      fileHashes: Object.freeze(fileHashes),
    });
    return Object.freeze({
      status: "projected" as const,
      candidateCommitId: verified.candidateCommitId,
      projectionHash,
      totalBytes: files.reduce(
        (total, file) =>
          total + (typeof file.byteLength === "number" ? file.byteLength : 0),
        0,
      ),
      files: Object.freeze(files),
    });
  } catch {
    return null;
  }
}

/** 既存の借用結合へ今回の固定コピーだけを結合する。 @trace ARCH-000013 */
function bindReviewerCopy(
  management: object,
  current: BorrowedBinding,
  reviewer: NonNullable<BorrowedBinding["reviewer"]>,
) {
  borrowed.set(
    management,
    Object.freeze({ ...current, reviewer: Object.freeze(reviewer) }),
  );
}

/** Reviewerには同じ候補の自己所有コピーだけをMountさせる。 @trace ARCH-000013 */
export function readOwnedReviewerWorkspace(
  management: unknown,
  commitId: unknown,
): string | null {
  try {
    if (!isObject(management) || typeof commitId !== "string") return null;
    const { identity } = ownedOperationFromManagementCapability(management);
    freshHost(identity.host);
    const binding = readBorrowedExecutionBinding(management);
    const copy = binding?.reviewer;
    if (
      !copy ||
      copy.commitId !== commitId ||
      !identity.host.record.git?.some(
        (item) =>
          item.commitId === commitId &&
          item.request === "confirmed" &&
          item.cleanup === "pending",
      )
    )
      return null;
    const remaining = new Map(
      copy.fileHashes.map((file) => [file.path, file.sha256]),
    );
    if (remaining.size !== copy.fileHashes.length) return null;
    const read = (directory: string) => {
      const info = fs.lstatSync(directory);
      if (
        !info.isDirectory() ||
        info.isSymbolicLink() ||
        fs.realpathSync(directory) !== directory
      )
        throw Error("execution_reviewer_copy_changed");
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isSymbolicLink())
          throw Error("execution_reviewer_copy_changed");
        if (entry.isDirectory()) read(target);
        else {
          const relative = path
            .relative(copy.directory, target)
            .split(path.sep)
            .join("/");
          const expected = remaining.get(relative);
          if (
            expected === undefined ||
            readExecutionFile(target).sha256 !== expected
          )
            throw Error("execution_reviewer_copy_changed");
          remaining.delete(relative);
        }
      }
    };
    read(copy.directory);
    return remaining.size === 0 ? copy.directory : null;
  } catch {
    return null;
  }
}

/** 保存済み候補と現在のGit可視内容をVCの既知Commit照合で確認する。 @trace ARCH-000013 */
export function verifyExecutionChangeSnapshot(
  candidateCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
) {
  try {
    if (!isObject(managementCapability)) return null;
    const borrowed = readBorrowedExecutionBinding(managementCapability);
    const record = borrowed?.snapshot;
    if (
      !borrowed ||
      !record ||
      !currentWorkspaceRecord(
        record,
        repositoryBindingCapability,
        managementCapability,
        mountCapability,
        borrowed,
      ) ||
      !isObject(candidateCapability)
    )
      return null;
    const name = ownValue(candidateCapability, "name"),
      commitId = ownValue(candidateCapability, "commitId");
    const { identity } =
      ownedOperationFromManagementCapability(managementCapability);
    const saved = identity.host.record.git?.find(
      (item) =>
        item.name === name &&
        item.commitId === commitId &&
        item.request === "confirmed" &&
        item.cleanup === "pending",
    );
    if (!saved?.commitId || saved.name.endsWith("/baseline")) return null;
    const verified = createCommit(record.source, {
      baseCommit: record.baseCommitId,
      expectedHead: record.baseHead,
      selection: readGitSelection(record, record.baseCommitId),
      message: "CRDD candidate verification",
      temporaryDirectory: `.crdd/operations/${record.operationId}/management`,
      previousCommit: saved.commitId,
      allowEmpty: true,
    });
    if (
      verified.status !== "completed" ||
      !verified.cleanupConfirmed ||
      verified.effectIssued
    )
      return null;
    const diff = readCommitDiff(record.source, {
      baseCommit: record.baseCommitId,
      commitId: saved.commitId,
    });
    return Object.freeze({
      status: "verified" as const,
      operationId: record.operationId,
      baseCommitId: record.baseCommitId,
      candidateCommitId: saved.commitId,
      changedPaths: diff.changedPaths,
      pathReported: false,
      canonicalRepositoryChanged: false,
    });
  } catch {
    return null;
  }
}

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
export type ProductionOperationFailure = Readonly<{
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
export function productionOperationFailure(error: unknown) {
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
export function throwProductionOperationFailure(
  details: ProductionOperationFailure,
): never {
  const error = new Error("coordinator_task_operation_creation_failed");
  productionOperationFailures.set(error, Object.freeze(details));
  throw error;
}

/**
 * 一つの実行中Operationに限る借用対象を保持する。
 * @responsibility 元Treeの同一性と自己所有の保護Mount材料を結合する。
 * @trace ARCH-000004
 * @shape 対象、Filesystem同一性、二つの空placeholder。
 * @invariant 永続状態と清掃所有集合を追加しない。
 * @boundary Operation内だけ。
 * @security Host Pathは公開しない。
 * @compatibility 新Workspace入口の短命データ。
 */
type BorrowedBinding = Readonly<{
  snapshot?: WorkspaceRecord;
  reviewer?: Readonly<{
    commitId: string;
    directory: string;
    fileHashes: readonly Readonly<{ path: string; sha256: string }>[];
  }>;
  target: BorrowedExecutionTarget;
  dev: number;
  ino: number;
  protection: Readonly<{ gitSourcePath: string; internalSourcePath: string }>;
}>;

const borrowed = new WeakMap<object, BorrowedBinding>();

const commit = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

/**
 * 実行前の対象を読取りだけで検証する。
 * @responsibility arbitrary Path・不明なGit所属・HEAD差を拒否する。
 * @trace ARCH-000004
 * @input ownerRootと内部対象。
 * @returns 固定した対象又はnull。
 * @precondition 上位が既存の利用調停を保持する。
 * @postcondition dirtyを消さず、Sourceを書き換えない。
 * @effect GitとFilesystemの読取りのみ。
 * @failure 欠測・link・別HEAD・別Rootはnull。
 * @invariant 新しいRegistry・排他・回復を生成しない。
 * @boundary Owner Rootと実行Tree。
 * @security getter・Proxyを評価しない。
 * @concurrency 呼出しの都度freshに検証する。
 */
export function inspectBorrowedExecutionTarget(
  ownerRoot: unknown,
  raw: unknown,
): BorrowedExecutionTarget | null {
  try {
    if (
      typeof ownerRoot !== "string" ||
      !raw ||
      typeof raw !== "object" ||
      types.isProxy(raw) ||
      Array.isArray(raw)
    )
      return null;
    const keys = [
      "workspaceId",
      "ownerRepositoryRoot",
      "executionTree",
      "baseCommit",
      "head",
    ] as const;
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    if (
      Reflect.ownKeys(raw).length !== keys.length ||
      keys.some(
        (key) => !descriptors[key] || !Object.hasOwn(descriptors[key], "value"),
      )
    )
      return null;
    const target = Object.fromEntries(
      keys.map((key) => [key, descriptors[key]?.value]),
    ) as BorrowedExecutionTarget;
    if (
      target.ownerRepositoryRoot !== ownerRoot ||
      typeof target.executionTree !== "string"
    )
      return null;
    const root = getRepository(ownerRoot);
    const layout =
      root.status === "completed"
        ? readRepositoryStorageIdentity(root.capability)
        : null;
    if (
      root.status !== "completed" ||
      layout === null ||
      layout.repositoryForm === "linked"
    )
      return null;
    // Workspace IDは上位の相関値だけ。配置検索・方式選択には使わない。
    if (
      !(
        target.workspaceId === null || typeof target.workspaceId === "string"
      ) ||
      !(
        target.baseCommit === null ||
        (typeof target.baseCommit === "string" &&
          commit.test(target.baseCommit))
      ) ||
      !(
        target.head === null ||
        (typeof target.head === "string" && commit.test(target.head))
      )
    )
      return null;
    const identity = readRepositorySnapshot(
      getRepository(target.executionTree).capability,
    );
    const ownerIdentity = readRepositorySnapshot(
      getRepository(ownerRoot).capability,
    );
    if (
      !ownerIdentity ||
      identity?.repositoryIdentity !== ownerIdentity.repositoryIdentity ||
      !identity ||
      (target.head !== null && identity.revisionIdentity !== target.head) ||
      (target.executionTree !== ownerRoot && target.head === null) ||
      (target.executionTree !== ownerRoot &&
        !target.executionTree.startsWith(ownerRoot + path.sep))
    )
      return null;
    const tree = fs.lstatSync(target.executionTree);
    const git = fs.lstatSync(path.join(target.executionTree, ".git"));
    if (
      !tree.isDirectory() ||
      tree.isSymbolicLink() ||
      fs.realpathSync.native(target.executionTree) !== target.executionTree ||
      git.isSymbolicLink() ||
      !(git.isDirectory() || git.isFile())
    )
      return null;
    const executionRoot = getRepository(target.executionTree);
    if (
      executionRoot.status !== "completed" ||
      checkRepositoryRuntimeDataProtectionDirectory(
        executionRoot.capability,
        "observe",
      ) === "blocked"
    )
      return null;
    return Object.freeze(target);
  } catch {
    return null;
  }
}

/**
 * 元Operationへ借用対象と自己所有placeholderを短期結合する。
 * @responsibility 清掃先を変更せず、Provider用実行先だけを提供する。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @input 正真正の管理・Mount参照と検証対象。
 * @returns 対象又はnull。
 * @precondition 通常Sourceの走査が別途成立する。
 * @postcondition 借用TreeをOperationの所有集合へ登録しない。
 * @effect Operation所有projection内に空placeholderを作る。
 * @failure 不明な対象・既存placeholder・作成失敗は拒否。
 * @invariant Workspaceの作成・削除・Git変更なし。
 * @boundary Host一時物と借用Tree。
 * @security 認証Homeや共有GitをMountしない。
 * @concurrency 既存Operation一件に一対象。
 */
export function bindBorrowedExecutionTarget(
  management: object,
  mount: object,
  ownerRoot: string,
  raw: unknown,
) {
  const target = inspectBorrowedExecutionTarget(ownerRoot, raw);
  if (!target || borrowed.has(management)) return null;
  const binding = verifyOwnedOperationManagementMountBinding(management, mount);
  // 空のMount先だけを初期化する。状態・履歴をこのTreeへ保存しない。
  const executionRoot = getRepository(target.executionTree);
  if (
    executionRoot.status !== "completed" ||
    checkRepositoryRuntimeDataProtectionDirectory(
      executionRoot.capability,
      "prepare",
    ) !== "ready"
  )
    return null;
  const directory = path.join(binding.mounts.projection, "workspace-masks");
  fs.mkdirSync(directory);
  const gitSourcePath = path.join(directory, "git");
  const internalSourcePath = path.join(directory, "internal");
  if (fs.lstatSync(path.join(target.executionTree, ".git")).isDirectory())
    fs.mkdirSync(gitSourcePath);
  else fs.writeFileSync(gitSourcePath, "", { flag: "wx" });
  fs.mkdirSync(internalSourcePath);
  const metadata = fs.lstatSync(target.executionTree);
  borrowed.set(
    management,
    Object.freeze({
      target,
      dev: metadata.dev,
      ino: metadata.ino,
      protection: Object.freeze({ gitSourcePath, internalSourcePath }),
    }),
  );
  return target;
}

/**
 * Provider使用直前に同じ借用対象を再観測する。
 * @responsibility 旧一時workspaceへ戻らず、元実体とGit相関を確認する。
 * @trace ARCH-000004
 * @input 元管理参照。
 * @returns 未結合はnull、失効は例外、結合済みは内部対象。
 * @precondition 管理参照の生存は呼出し元が別途確認する。
 * @postcondition Pathや新しい実体で古い結合を上書きしない。
 * @effect Filesystem／Git読取り。
 * @failure 失効・観測不能はthrow。
 * @invariant 保存Root・削除集合を変更しない。
 * @boundary CoordinatorからProvider計画。
 * @security 所在は内部だけで使う。
 * @concurrency キャッシュだけで実行へ進まない。
 */
export function readBorrowedExecutionBinding(
  management: object,
  verifyProtection = false,
) {
  const record = borrowed.get(management);
  if (!record) return null;
  const target = inspectBorrowedExecutionTarget(
    record.target.ownerRepositoryRoot,
    record.target,
  );
  const stat = target ? fs.lstatSync(target.executionTree) : null;
  if (!target || stat?.dev !== record.dev || stat.ino !== record.ino)
    throw new Error("coordinator_workspace_target_changed");
  if (verifyProtection) {
    const git = fs.lstatSync(record.protection.gitSourcePath);
    const internal = fs.lstatSync(record.protection.internalSourcePath);
    const targetGit = fs.lstatSync(path.join(target.executionTree, ".git"));
    if (
      git.isSymbolicLink() ||
      internal.isSymbolicLink() ||
      git.isDirectory() !== targetGit.isDirectory() ||
      (git.isDirectory()
        ? fs.readdirSync(record.protection.gitSourcePath).length !== 0
        : !git.isFile() || git.size !== 0) ||
      !internal.isDirectory() ||
      fs.readdirSync(record.protection.internalSourcePath).length !== 0
    )
      throw new Error("coordinator_workspace_protection_changed");
  }
  return record;
}

/**
 * coordinator-operation-creation-internalで使用するCreation 失敗の値契約を定義する。
 *
 * @responsibility Creation 失敗のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CreationFailureが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CreationFailureで宣言した値と責務の対応を維持する。
 * @boundary N/A: CreationFailureの宣言は外部境界を開かない。
 * @security CreationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CreationFailureの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CreationFailure = Readonly<{
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  hostRecoveryId: string | null;
}>;

const failures = new WeakMap<object, CreationFailure>();

/**
 * coordinator-operation-creation-internalを失敗として終了させる。
 *
 * @responsibility coordinator-operation-creation-internalの失敗条件、診断情報、終了結果境界を所有する。
 * @trace ARCH-000004
 * @input cause: unknown、cleanupConfirmed: boolean、hostRecoveryId: string | null
 * @returns neverを返す。
 * @precondition 「cause: unknown、cleanupConfirmed: boolean、hostRecoveryId: string | null」がfailの入力契約を満たす。
 * @postcondition failの責務を完了した結果だけを返す。
 * @effect N/A: failは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure failは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant failは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: failはProcess内の同一Subsystemで完結する。
 * @security failはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: failは共有非同期状態を持たない同期処理である。
 */
function fail(
  cause: unknown,
  cleanupConfirmed: boolean,
  hostRecoveryId: string | null,
): never {
  const error = new Error("coordinator_operation_creation_failed", { cause });
  failures.set(
    error,
    Object.freeze({
      cleanupConfirmed,
      manualRecoveryRequired: !cleanupConfirmed,
      hostRecoveryId,
    }),
  );
  throw error;
}

/**
 * 所有 Coordinator Operation Creation 失敗を分類する。
 *
 * @responsibility 所有 Coordinator Operation Creation 失敗の分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns classifyOwnedCoordinatorOperationCreationFailureの計算結果を返す。
 * @precondition 「error: unknown」がclassifyOwnedCoordinatorOperationCreationFailureの入力契約を満たす。
 * @postcondition classifyOwnedCoordinatorOperationCreationFailureの責務を完了した結果だけを返す。
 * @effect N/A: classifyOwnedCoordinatorOperationCreationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyOwnedCoordinatorOperationCreationFailureは独自の失敗分岐を所有しない。
 * @invariant classifyOwnedCoordinatorOperationCreationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyOwnedCoordinatorOperationCreationFailureはProcess内の同一Subsystemで完結する。
 * @security classifyOwnedCoordinatorOperationCreationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyOwnedCoordinatorOperationCreationFailureは共有非同期状態を持たない同期処理である。
 */
export function classifyOwnedCoordinatorOperationCreationFailure(
  error: unknown,
) {
  if (!error || typeof error !== "object") return null;
  return (
    failures.get(error) ??
    classifyOwnedOperationDirectoryCreationFailure(error) ??
    null
  );
}

/** 元操作の非Authority参照を返す。Hash tokenや保存物を生成しない。 @trace ARCH-000008 */
export function getOwnedHostRecoveryId(owned: unknown): string {
  return requireOwnedIdentity(isObject(owned) ? owned : {}).host.record
    .recoveryId;
}

/** 同じ保存Ownerと実Lockで回収を閉じる。 @trace ARCH-000008 */
export function cleanupOwnedOperationDirectories(owned: unknown) {
  const identity = removeOwnedOperationRootForCleanup(owned);
  if (!revokeOwnedOperationGeneration(identity.root, identity.operationId))
    throw Error("owned_operation_generation_release_unconfirmed");
  return createOwnedOperationCleanupOutcome("completed", owned, identity);
}

/**
 * 作成前の耐久記録・実Lock・実体Receiptを閉じてからCapabilityを発行する。
 * @trace ARCH-000008
 * @boundary 現在認可は入力Ownerが保持し、取消後の回収記録と実行継続を分離する。
 */
export function createRuntimeOwnedCoordinatorOperation(
  input: HostOperationInput,
) {
  const owned = createOwnedOperationDirectories(input);
  const hostRecoveryId = getOwnedHostRecoveryId(owned);
  try {
    const context = createOwnedOperationContextCapability(owned);
    const mountCapability = createOwnedMountCapability(owned);
    const managementCapability = createOwnedOperationManagementCapability(
      context,
      mountCapability,
    );
    return Object.freeze({
      owned,
      mountCapability,
      managementCapability,
      operationId: requireOwnedIdentity(owned).operationId,
      hostRecoveryId,
    });
  } catch (cause) {
    try {
      cleanupOwnedOperationDirectories(owned);
    } catch {
      fail(cause, false, hostRecoveryId);
    }
    fail(cause, true, null);
  }
}

export const CREDENTIAL_ENV_NAMES = Object.freeze([
  "ANTHROPIC_API_KEY",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "CODEX_API_KEY",
  "CODEX_ACCESS_TOKEN",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "GIT_ASKPASS",
  "OPENAI_API_KEY",
  "SSH_AUTH_SOCK",
]);

/**
 * execution-environmentで使用するFilesystem Identityの値契約を定義する。
 *
 * @responsibility Filesystem IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape FilesystemIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FilesystemIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: FilesystemIdentityの宣言は外部境界を開かない。
 * @security FilesystemIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility FilesystemIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type FilesystemIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;

/**
 * execution-environmentで使用するSerializable Identityの値契約を定義する。
 *
 * @responsibility Serializable IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape SerializableIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SerializableIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: SerializableIdentityの宣言は外部境界を開かない。
 * @security SerializableIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SerializableIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SerializableIdentity = Readonly<{
  dev: string;
  ino: string;
  birthtimeNs: string;
}>;

/**
 * execution-environmentで使用するDirectory Snapshotの値契約を定義する。
 *
 * @responsibility Directory SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DirectorySnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DirectorySnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: DirectorySnapshotの宣言は外部境界を開かない。
 * @security DirectorySnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DirectorySnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DirectorySnapshot = Readonly<{
  parent: string;
  root: string;
  name: string;
  filesystem: FilesystemIdentity;
}>;

/**
 * execution-environmentで使用するOperation Directoriesの値契約を定義する。
 *
 * @responsibility Operation DirectoriesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OperationDirectoriesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OperationDirectoriesで宣言した値と責務の対応を維持する。
 * @boundary N/A: OperationDirectoriesの宣言は外部境界を開かない。
 * @security OperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OperationDirectoriesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OperationDirectories = Readonly<{
  root: string;
  providerHome: string;
  workspace: string;
  tmp: string;
  events: string;
  projection: string;
  management: string;
}>;

/**
 * execution-environmentで使用するChild Snapshotsの値契約を定義する。
 *
 * @responsibility Child SnapshotsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ChildSnapshotsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ChildSnapshotsで宣言した値と責務の対応を維持する。
 * @boundary N/A: ChildSnapshotsの宣言は外部境界を開かない。
 * @security ChildSnapshotsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ChildSnapshotsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ChildSnapshots = Readonly<{
  workspace: DirectorySnapshot;
  providerHome: DirectorySnapshot;
  tmp: DirectorySnapshot;
  events: DirectorySnapshot;
  projection: DirectorySnapshot;
  management: DirectorySnapshot;
}>;

/** Host記録を現在のRepositoryと同じ保存可否確認に結び付ける。 @trace ARCH-000008 */
export type HostOperationRecording = Readonly<{
  root: Repository;
  recordingCurrent: () => boolean;
}>;

/** Host作成時の用途と実行境界を、既存の記録先に結び付ける。 @trace ARCH-000008 */
export type HostOperationInput = HostOperationRecording &
  Readonly<{
    purpose: HostRecord["purpose"];
    signal?: AbortSignal;
    executionCurrent?: () => boolean;
  }>;
type HostRecord = Extract<OperationRecord, { kind: "host_operation" }>;
type HostState = {
  input: HostOperationInput;
  record: HostRecord;
  version: StateVersion;
  lock: Lock;
  publication?: HostRecoveryRead;
};

/** 既存EMの途中保存読取りだけを同じDocker回復IDへ固定する。 */
type HostRecoveryRead = Readonly<
  | {
      kind: "resource_publication" | "execution_completion";
      recoveryId: string;
    }
  | {
      kind: "execution_history";
      recoveryId: string;
      history: ReturnType<typeof historyRepositoryInput<Repository>>;
    }
>;

/** 通常読取りを優先し、受理済みの途中保存だけを同じHostへ相関させる。
 * @trace ARCH-000008
 * @effect 既存EM Readerだけ。途中保存の確定・Host変更は行わない。
 * @failure 別操作・読取り不明・排他解放不明は拒否する。
 */
function readHostGenerationSnapshot(
  root: Repository,
  operationId: string,
  publication?: HostRecoveryRead,
) {
  const ordinary = readState(root, { scope: "recovery" });
  if (
    ordinary.status === "completed" &&
    ordinary.lockReleased &&
    ordinary.value
  )
    return { observed: ordinary, publication: undefined };
  if (!ordinary.lockReleased || !publication)
    throw Error("host_operation_state_unknown");
  if (
    publication.kind === "execution_history" &&
    publication.history.root !== root
  )
    throw Error("host_operation_publication_root_changed");
  const observed = readState(
    publication.kind === "execution_history" ? publication.history : root,
    {
      scope: "recovery",
      input: { kind: publication.kind, recoveryId: publication.recoveryId },
    },
  );
  if (
    observed.status !== "completed" ||
    !observed.lockReleased ||
    !observed.value
  )
    throw Error("host_operation_state_unknown");
  const operations = observed.value.snapshot.operations.filter(
    (item) =>
      item.kind === "docker_task" && item.recoveryId === publication.recoveryId,
  );
  const operation = operations[0];
  if (
    operations.length !== 1 ||
    operation?.kind !== "docker_task" ||
    JSON.parse(operation.identityJson).operationId !== operationId
  )
    throw Error("host_operation_publication_binding_changed");
  return { observed, publication };
}

/**
 * 実Lockの保持下で、確認済みHost本文が同じ現在Stateに残ることを確認する。
 * @trace ARCH-000008
 * @boundary Writerの再認可callbackからは呼ばず、State Lockの再入を避ける。
 */
function freshHost(host: HostState) {
  if (!host.lock.assertLive() || host.input.recordingCurrent() !== true)
    throw Error("host_operation_owner_unavailable");
  const reading = readHostGenerationSnapshot(
    host.input.root,
    host.record.operationId,
    host.publication,
  );
  const observed = reading.observed;
  if (reading.publication) host.publication = reading.publication;
  else delete host.publication;
  if (
    observed.status !== "completed" ||
    !observed.lockReleased ||
    !observed.value
  )
    throw Error("host_operation_state_unknown");
  const matches = observed.value.snapshot.operations.filter(
    (record) =>
      record.kind === "host_operation" &&
      record.operationId === host.record.operationId,
  );
  if (matches.length !== 1 || !isDeepStrictEqual(matches[0], host.record))
    throw Error("host_operation_record_changed");
  host.version = {
    revision: observed.value.snapshot.revision,
    payloadSha256: observed.value.payloadSha256,
  };
  return observed.value;
}
function hostRecordingAccess(
  input: HostOperationInput,
  operationId: string,
  lock?: Lock,
) {
  return Object.freeze({
    root: input.root,
    revalidate: (
      operation: string,
      target: Readonly<{ operationId: string }>,
    ) =>
      operation === "operation.record" &&
      target.operationId === operationId &&
      input.recordingCurrent() === true &&
      (!lock || lock.assertLive()),
  });
}
function requireHostExecutionCurrent(input: HostOperationInput): void {
  if (
    input.recordingCurrent() !== true ||
    input.signal?.aborted ||
    (input.executionCurrent && input.executionCurrent() !== true)
  )
    throw Error("owned_operation_creation_cancelled_or_unavailable");
}
function writeHostCheckpoint(host: HostState, candidate: HostRecord): void {
  freshHost(host);
  if (host.publication) throw Error("host_operation_publication_pending");
  const saved = saveOperationCheckpoint(
    hostRecordingAccess(host.input, candidate.operationId, host.lock),
    candidate.recoveryId,
    {
      kind: "host_operation",
      value: { operation: candidate, expectedVersion: host.version },
    },
  );
  if (
    saved.status !== "completed" ||
    !saved.snapshotConfirmed ||
    !saved.lockReleased ||
    saved.revision === null ||
    saved.payloadSha256 === null
  )
    throw Error("host_operation_checkpoint_unconfirmed");
  host.record = snapshotJsonValue(candidate) as HostRecord;
  host.version = {
    revision: saved.revision,
    payloadSha256: saved.payloadSha256,
  };
}
const HOST_CHILD_NAMES = Object.freeze({
  workspace: "workspace",
  providerHome: "provider-home",
  tmp: "tmp",
  events: "events",
  projection: "projection",
  management: "management",
});

/** 専用Rootは検証済みRepositoryと元操作IDだけから導く。 @trace ARCH-000008 */
function ownedHostRoot(host: HostState): string {
  const paths = resolveRepositoryExecutionDataPaths(host.input.root);
  if (!paths) throw Error("host_operation_repository_unavailable");
  return path.join(paths.operations, host.record.operationId);
}
/** DIが観測したProbe資源を同じ元Hostへ保存する。 @trace ARCH-000008 */
export function recordOwnedHostResources(
  management: unknown,
  resources: HostRecord["resources"],
): void {
  const { identity } = ownedOperationFromManagementCapability(management);
  if (identity.host.record.purpose !== "isolation_probe")
    throw Error("host_operation_probe_required");
  writeHostCheckpoint(identity.host, { ...identity.host.record, resources });
}
/** 同じ実Ownerの保存値を後続記録の元版として取得する。 @trace ARCH-000008 */
export function readOwnedHostOperation(management: unknown) {
  const { identity } = ownedOperationFromManagementCapability(management);
  const current = freshHost(identity.host);
  return {
    record: identity.host.record,
    snapshot: current.snapshot,
    payloadSha256: current.payloadSha256,
  };
}

/** 回復Ownerが保持する同じEM記録とRootを取得する。 @trace ARCH-000008 */
export function readHostRecoveryOperation(capability: unknown) {
  const host = isObject(capability)
    ? hostOperationRecoveryGenerations.get(capability)
    : null;
  if (!host) return null;
  const current = freshHost(host);
  return {
    record: host.record,
    snapshot: current.snapshot,
    payloadSha256: current.payloadSha256,
    root: ownedHostRoot(host),
  };
}

/** 同じ回復OwnerのProbe観測を元Hostへ保存する。 @trace ARCH-000008 */
export function recordHostRecoveryResources(
  capability: unknown,
  resources: HostRecord["resources"],
): void {
  const host = isObject(capability)
    ? hostOperationRecoveryGenerations.get(capability)
    : null;
  if (host?.record.purpose !== "isolation_probe")
    throw Error("host_operation_probe_required");
  writeHostCheckpoint(host, { ...host.record, resources });
}

/** Writer再認可内でも読める実体観測。State Lockへ再入しない。 @trace ARCH-000008 */
export function observeHostRecoveryRoot(
  capability: unknown,
): "present" | "absent" | "unknown" {
  const host = isObject(capability)
    ? hostOperationRecoveryGenerations.get(capability)
    : null;
  if (!host?.lock.assertLive() || host.input.recordingCurrent() !== true)
    return "unknown";
  try {
    const root = ownedHostRoot(host),
      observed = observeFilesystemEntry(root);
    if (observed === "unknown") return "unknown";
    if (observed === "confirmed_absent") return "absent";
    const stat = fs.lstatSync(root);
    return host.record.rootIdentity &&
      stat.isDirectory() &&
      !stat.isSymbolicLink() &&
      fs.realpathSync(root) === root &&
      identityMatchesRecord(root, host.record.rootIdentity)
      ? "present"
      : "unknown";
  } catch {
    return "unknown";
  }
}

/** 解放後の保存では、検証済みRepository内の専用Rootの明示不存在だけを肯定する。 @trace ARCH-000008 */
export function isHostOperationRootAbsent(
  repository: Repository,
  operationId: string,
): boolean {
  try {
    if (!/^OP-[0-9]{6,}$/u.test(operationId)) return false;
    const parent = observeRepositoryExecutionDataArea(repository, "operations");
    return (
      parent.status === "ready" &&
      observeFilesystemEntry(path.join(parent.directory, operationId)) ===
        "confirmed_absent"
    );
  } catch {
    return false;
  }
}
/** 子資源終結と同じ実体Receiptを照合してからRootを回収する。 @trace ARCH-000008 */
function cleanupHostRoot(host: HostState): void {
  const current = freshHost(host);
  if (host.publication) throw Error("host_operation_publication_pending");
  for (const state of current.operationStates) {
    if (
      state.kind !== "docker_task" ||
      JSON.parse(state.operation.identityJson).operationId !==
        host.record.operationId
    )
      continue;
    if (
      state.operation.lease !== "released" ||
      state.operation.execution.ownerEffect !== "disabled" ||
      !state.resourcesSettled ||
      !state.restartSettled
    )
      throw Error("host_operation_child_resources_unsettled");
  }
  if (
    host.record.resources?.checkpoints.some(
      (c) => c.submission !== "not_issued" && c.observation !== "absent",
    )
  )
    throw Error("host_operation_probe_resources_unsettled");
  const root = ownedHostRoot(host);
  const observed = observeFilesystemEntry(root);
  if (observed === "unknown")
    throw Error("host_operation_root_observation_unknown");
  if (host.record.phase === "terminal") {
    if (host.record.cleanup !== "confirmed" || observed !== "confirmed_absent")
      throw Error("host_operation_terminal_root_present");
    return;
  }
  if (observed === "present") {
    const metadata = fs.lstatSync(root);
    if (
      !host.record.rootIdentity ||
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      fs.realpathSync(root) !== root ||
      !identityMatchesRecord(root, host.record.rootIdentity)
    )
      throw Error("host_operation_root_identity_unknown");
    const known = new Map<string, HostRecord["rootIdentity"]>(
      Object.entries(host.record.childIdentities).map(([key, identity]) => [
        HOST_CHILD_NAMES[key as keyof typeof HOST_CHILD_NAMES],
        identity,
      ]),
    );
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const identity = known.get(entry.name),
        child = path.join(root, entry.name);
      if (
        !identity ||
        !entry.isDirectory() ||
        entry.isSymbolicLink() ||
        fs.realpathSync(child) !== child ||
        !identityMatchesRecord(child, identity)
      )
        throw Error("host_operation_child_identity_unknown");
    }
  }
  cleanupHostGit(host);
  writeHostCheckpoint(host, { ...host.record, cleanup: "pending" });
  try {
    if (observed === "present")
      fs.rmSync(root, { recursive: true, force: false });
    requireConfirmedAbsent(root, "host_operation_cleanup_unconfirmed");
    writeHostCheckpoint(host, {
      ...host.record,
      phase: "terminal",
      cleanup: "confirmed",
    });
  } catch (cause) {
    try {
      writeHostCheckpoint(host, { ...host.record, cleanup: "unknown" });
    } catch {}
    throw cause;
  }
}

/** 一つの操作Rootと実体Receiptを、同じEM記録・実Lockへ結合する。 @trace ARCH-000008 */
type OwnedIdentity = Readonly<{
  operationId: string;
  parent: string;
  root: string;
  filesystem: FilesystemIdentity;
  createdAt: string;
  host: HostState;
  children?: ChildSnapshots;
  mounts?: Readonly<{
    workspace: DirectorySnapshot;
    providerHome: DirectorySnapshot;
    tmp: DirectorySnapshot;
  }>;
}>;

/**
 * execution-environmentで使用する所有 Operation Directoriesの値契約を定義する。
 *
 * @responsibility 所有 Operation DirectoriesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedOperationDirectoriesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedOperationDirectoriesで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedOperationDirectoriesの宣言は外部境界を開かない。
 * @security OwnedOperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedOperationDirectoriesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OwnedOperationDirectories = {
  parent: string;
  root: string;
  directories: OperationDirectories | null;
  hostRecoveryId: string | null;
};

const ownedIdentities = new WeakMap<object, OwnedIdentity>();

/**
 * execution-environmentで使用する所有 Operation Directory Creation 失敗の値契約を定義する。
 *
 * @responsibility 所有 Operation Directory Creation 失敗のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedOperationDirectoryCreationFailureが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedOperationDirectoryCreationFailureで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedOperationDirectoryCreationFailureの宣言は外部境界を開かない。
 * @security OwnedOperationDirectoryCreationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedOperationDirectoryCreationFailureの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OwnedOperationDirectoryCreationFailure = Readonly<{
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  hostRecoveryId: string | null;
}>;

const ownedOperationDirectoryCreationFailures = new WeakMap<
  object,
  OwnedOperationDirectoryCreationFailure
>();

/**
 * throw 所有 Operation Directory Creation 失敗を決定する。
 *
 * @responsibility throw 所有 Operation Directory Creation 失敗の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input cause: unknown、details: OwnedOperationDirectoryCreationFailure
 * @returns neverを返す。
 * @precondition 「cause: unknown、details: OwnedOperationDirectoryCreationFailure」がthrowOwnedOperationDirectoryCreationFailureの入力契約を満たす。
 * @postcondition throwOwnedOperationDirectoryCreationFailureの責務を完了した結果だけを返す。
 * @effect N/A: throwOwnedOperationDirectoryCreationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure throwOwnedOperationDirectoryCreationFailureは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant throwOwnedOperationDirectoryCreationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: throwOwnedOperationDirectoryCreationFailureはProcess内の同一Subsystemで完結する。
 * @security throwOwnedOperationDirectoryCreationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: throwOwnedOperationDirectoryCreationFailureは共有非同期状態を持たない同期処理である。
 */
function throwOwnedOperationDirectoryCreationFailure(
  cause: unknown,
  details: OwnedOperationDirectoryCreationFailure,
): never {
  const error = new Error("owned_operation_directory_creation_failed", {
    cause,
  });
  ownedOperationDirectoryCreationFailures.set(error, Object.freeze(details));
  throw error;
}

/**
 * 所有 Operation Directory Creation 失敗を分類する。
 *
 * @responsibility 所有 Operation Directory Creation 失敗の分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns classifyOwnedOperationDirectoryCreationFailureの計算結果を返す。
 * @precondition 「error: unknown」がclassifyOwnedOperationDirectoryCreationFailureの入力契約を満たす。
 * @postcondition classifyOwnedOperationDirectoryCreationFailureの責務を完了した結果だけを返す。
 * @effect N/A: classifyOwnedOperationDirectoryCreationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyOwnedOperationDirectoryCreationFailureは独自の失敗分岐を所有しない。
 * @invariant classifyOwnedOperationDirectoryCreationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyOwnedOperationDirectoryCreationFailureはProcess内の同一Subsystemで完結する。
 * @security classifyOwnedOperationDirectoryCreationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyOwnedOperationDirectoryCreationFailureは共有非同期状態を持たない同期処理である。
 */
export function classifyOwnedOperationDirectoryCreationFailure(error: unknown) {
  return error && typeof error === "object"
    ? (ownedOperationDirectoryCreationFailures.get(error) ?? null)
    : null;
}

/**
 * execution-environmentで使用するMount Capability Identityの値契約を定義する。
 *
 * @responsibility Mount Capability IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape MountCapabilityIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant MountCapabilityIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: MountCapabilityIdentityの宣言は外部境界を開かない。
 * @security MountCapabilityIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility MountCapabilityIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type MountCapabilityIdentity = Readonly<{
  owned: object;
  children: ChildSnapshots;
}>;

const mountCapabilities = new WeakMap<object, MountCapabilityIdentity>();

/**
 * execution-environmentで使用するOperation Context Identityの値契約を定義する。
 *
 * @responsibility Operation Context IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OperationContextIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OperationContextIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: OperationContextIdentityの宣言は外部境界を開かない。
 * @security OperationContextIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OperationContextIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OperationContextIdentity = Readonly<{
  owned: object;
  operationId: string;
  createdAt: string;
}>;

const operationContextCapabilities = new WeakMap<
  object,
  OperationContextIdentity
>();

const operationContextAliases = new WeakMap<object, Set<object>>();

/**
 * execution-environmentで使用するOperation Management Identityの値契約を定義する。
 *
 * @responsibility Operation Management IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OperationManagementIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OperationManagementIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: OperationManagementIdentityの宣言は外部境界を開かない。
 * @security OperationManagementIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OperationManagementIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OperationManagementIdentity = Readonly<{
  owned: object;
  operationId: string;
  createdAt: string;
}>;

/**
 * execution-environmentで使用する所有 Operation Management Bindingの値契約を定義する。
 *
 * @responsibility 所有 Operation Management BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedOperationManagementBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedOperationManagementBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedOperationManagementBindingの宣言は外部境界を開かない。
 * @security OwnedOperationManagementBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedOperationManagementBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OwnedOperationManagementBinding = Readonly<{
  operationId: string;
  createdAt: string;
  managementScopeBound: true;
}>;

const operationManagementCapabilities = new WeakMap<
  object,
  OperationManagementIdentity
>();

/** 同じRootの生存中Ownerだけを保持する短命Control。 @trace ARCH-000008 */
type OperationGenerationState = {
  owned: object;
  root: string;
  operationId: string;
  retired: boolean;
  generationLock: Lock | null;
};

const operationGenerationsByKey = new Map<string, OperationGenerationState>();

const operationGenerationByRoot = new Map<string, OperationGenerationState>();

/**
 * Objectかを判定する。
 *
 * @responsibility Objectの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisObjectの入力契約を満たす。
 * @postcondition isObjectの責務を完了した結果だけを返す。
 * @effect N/A: isObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isObjectは独自の失敗分岐を所有しない。
 * @invariant isObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isObjectはProcess内の同一Subsystemで完結する。
 * @security isObjectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isObjectは共有非同期状態を持たない同期処理である。
 */
function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * Operation Idを構築する。
 *
 * @responsibility Operation Idの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns stringを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateOperationIdの入力契約を満たす。
 * @postcondition createOperationIdの責務を完了した結果だけを返す。
 * @effect N/A: createOperationIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createOperationIdは独自の失敗分岐を所有しない。
 * @invariant createOperationIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOperationIdはProcess内の同一Subsystemで完結する。
 * @security createOperationIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOperationIdは共有非同期状態を持たない同期処理である。
 */
function createOperationId(): string {
  const decimal = BigInt(`0x${randomUUID().replaceAll("-", "")}`).toString(10);
  return `OP-${decimal.padStart(6, "0")}`;
}

/**
 * 所有 Operation Context Capabilitiesを失効させる。
 *
 * @responsibility 所有 Operation Context Capabilitiesの失効Authority、対象Identity、再利用防止境界を所有する。
 * @trace ARCH-000008
 * @input owned: object
 * @returns N/A: revokeOwnedOperationContextCapabilitiesは戻り値を返さない。
 * @precondition 「owned: object」がrevokeOwnedOperationContextCapabilitiesの入力契約を満たす。
 * @postcondition revokeOwnedOperationContextCapabilitiesの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: revokeOwnedOperationContextCapabilitiesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeOwnedOperationContextCapabilitiesは独自の失敗分岐を所有しない。
 * @invariant revokeOwnedOperationContextCapabilitiesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeOwnedOperationContextCapabilitiesはProcess内の同一Subsystemで完結する。
 * @security revokeOwnedOperationContextCapabilitiesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeOwnedOperationContextCapabilitiesは共有非同期状態を持たない同期処理である。
 */
function revokeOwnedOperationContextCapabilities(owned: object): void {
  const aliases = operationContextAliases.get(owned);
  if (aliases) {
    for (const alias of aliases) {
      operationContextCapabilities.delete(alias);
      mountCapabilities.delete(alias);
      operationManagementCapabilities.delete(alias);
    }
    operationContextAliases.delete(owned);
  }
}

/**
 * operation Generation Keyを決定する。
 *
 * @responsibility operation Generation Keyの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input root: string、nonce: string
 * @returns stringを返す。
 * @precondition 「root: string、nonce: string」がoperationGenerationKeyの入力契約を満たす。
 * @postcondition operationGenerationKeyの責務を完了した結果だけを返す。
 * @effect N/A: operationGenerationKeyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: operationGenerationKeyは独自の失敗分岐を所有しない。
 * @invariant operationGenerationKeyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: operationGenerationKeyはProcess内の同一Subsystemで完結する。
 * @security operationGenerationKeyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: operationGenerationKeyは共有非同期状態を持たない同期処理である。
 */
function operationGenerationKey(root: string, nonce: string): string {
  return `${root}\0${nonce}`;
}

function registerOwnedOperationGeneration(
  owned: object,
  identity: OwnedIdentity,
): void {
  const key = operationGenerationKey(identity.root, identity.operationId);
  if (
    operationGenerationsByKey.has(key) ||
    operationGenerationByRoot.has(identity.root)
  )
    throw Error("owned_operation_generation_conflict");
  const state: OperationGenerationState = {
    owned,
    root: identity.root,
    operationId: identity.operationId,
    retired: false,
    generationLock: identity.host.lock,
  };
  operationGenerationsByKey.set(key, state);
  operationGenerationByRoot.set(identity.root, state);
}

function revokeOwnedOperationGeneration(
  root: string,
  operationId: string,
): boolean {
  const key = operationGenerationKey(root, operationId);
  const state = operationGenerationsByKey.get(key);
  if (!state) return true;
  revokeOwnedOperationContextCapabilities(state.owned);
  let released = false;
  try {
    released = state.generationLock?.release() ?? true;
  } catch {}
  if (!released) {
    state.retired = true;
    poisonRuntimeProcessAfterCleanupUnknown();
    return false;
  }
  state.generationLock = null;
  ownedIdentities.delete(state.owned);
  operationGenerationsByKey.delete(key);
  if (operationGenerationByRoot.get(root) === state)
    operationGenerationByRoot.delete(root);
  return true;
}

type HostOperationRecoveryGeneration = HostState;

const hostOperationRecoveryGenerations = new WeakMap<
  object,
  HostOperationRecoveryGeneration
>();

/** 現在EM記録を確定し、作成側と同じ実Lockを保持する。 @trace ARCH-000008 */
export function acquireHostOperationRecoveryGeneration(
  root: Repository,
  recoveryId: unknown,
  recordingCurrent: () => boolean,
  publication?: HostRecoveryRead,
) {
  try {
    if (
      typeof recoveryId !== "string" ||
      !/^host-operation\.OP-[0-9]{6,}$/u.test(recoveryId) ||
      recordingCurrent() !== true
    )
      return null;
    const repositoryRoot = resolveVerifiedRepositoryRoot(root);
    if (!repositoryRoot) return null;
    const reading = readHostGenerationSnapshot(
      root,
      recoveryId.slice("host-operation.".length),
      publication,
    );
    const observed = reading.observed;
    if (
      observed.status !== "completed" ||
      !observed.lockReleased ||
      !observed.value
    )
      return null;
    const matches = observed.value.snapshot.operations.filter(
      (r): r is HostRecord =>
        r.kind === "host_operation" && r.recoveryId === recoveryId,
    );
    if (matches.length !== 1) return null;
    const record = matches[0];
    if (!record) return null;
    const acquired = acquireHostOperationLock(root, record.operationId);
    if (acquired.status !== "acquired") return null;
    const host: HostState = {
      input: { root, purpose: record.purpose, recordingCurrent },
      record,
      version: {
        revision: observed.value.snapshot.revision,
        payloadSha256: observed.value.payloadSha256,
      },
      lock: acquired.lock,
      ...(reading.publication ? { publication: reading.publication } : {}),
    };
    try {
      freshHost(host);
      const capability = Object.freeze({});
      hostOperationRecoveryGenerations.set(capability, host);
      return capability;
    } catch {
      if (!host.lock.release()) poisonRuntimeProcessAfterCleanupUnknown();
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Host Operation 回復 Generationを解放する。
 *
 * @responsibility Host Operation 回復 Generationの所有権、解放条件、終了後不存在の確認境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns releaseHostOperationRecoveryGenerationの計算結果を返す。
 * @precondition 「capability: unknown」がreleaseHostOperationRecoveryGenerationの入力契約を満たす。
 * @postcondition releaseHostOperationRecoveryGenerationの責務を完了した結果だけを返す。
 * @effect N/A: releaseHostOperationRecoveryGenerationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure releaseHostOperationRecoveryGenerationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant releaseHostOperationRecoveryGenerationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: releaseHostOperationRecoveryGenerationはProcess内の同一Subsystemで完結する。
 * @security releaseHostOperationRecoveryGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: releaseHostOperationRecoveryGenerationは共有非同期状態を持たない同期処理である。
 */
export function releaseHostOperationRecoveryGeneration(capability: unknown) {
  if (!isObject(capability)) return false;
  const generation = hostOperationRecoveryGenerations.get(capability);
  if (!generation) return false;
  hostOperationRecoveryGenerations.delete(capability);
  try {
    return generation.lock.release();
  } catch {
    return false;
  }
}

/** 元Host記録と同じ操作・実Lockを要求する。 @trace ARCH-000008 */
export function verifyHostOperationRecoveryGeneration(
  capability: unknown,
  root: string,
  operationId: string,
) {
  const host = isObject(capability)
    ? hostOperationRecoveryGenerations.get(capability)
    : null;
  if (
    !host ||
    host.record.operationId !== operationId ||
    ownedHostRoot(host) !== root ||
    !host.lock.assertLive() ||
    host.input.recordingCurrent() !== true
  )
    throw Error("host_recovery_generation_active");
}

/** 元Host Receiptと同じ管理領域だけをDIへ渡す。 @trace ARCH-000008 */
export function borrowHostRecoveryManagementDirectory(
  recoveryId: unknown,
  capability: unknown,
) {
  const host = isObject(capability)
    ? hostOperationRecoveryGenerations.get(capability)
    : null;
  if (!host || host.record.recoveryId !== recoveryId) return null;
  freshHost(host);
  const root = ownedHostRoot(host),
    directory = path.join(root, HOST_CHILD_NAMES.management);
  const assertCurrent = () => {
    try {
      verifyHostOperationRecoveryGeneration(
        capability,
        root,
        host.record.operationId,
      );
      return (
        host.record.rootIdentity !== null &&
        host.record.childIdentities.management !== undefined &&
        fs.realpathSync(root) === root &&
        fs.realpathSync(directory) === directory &&
        identityMatchesRecord(root, host.record.rootIdentity) &&
        identityMatchesRecord(directory, host.record.childIdentities.management)
      );
    } catch {
      return false;
    }
  };
  return assertCurrent() ? Object.freeze({ directory, assertCurrent }) : null;
}

/**
 * retire 所有 Operation Generationを決定する。
 *
 * @responsibility retire 所有 Operation Generationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input root: string、nonce: string
 * @returns voidを返す。
 * @precondition 「root: string、nonce: string」がretireOwnedOperationGenerationの入力契約を満たす。
 * @postcondition retireOwnedOperationGenerationの責務を完了した結果だけを返す。
 * @effect N/A: retireOwnedOperationGenerationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: retireOwnedOperationGenerationは独自の失敗分岐を所有しない。
 * @invariant retireOwnedOperationGenerationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: retireOwnedOperationGenerationはProcess内の同一Subsystemで完結する。
 * @security retireOwnedOperationGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: retireOwnedOperationGenerationは共有非同期状態を持たない同期処理である。
 */
function retireOwnedOperationGeneration(root: string, nonce: string): void {
  const state = operationGenerationsByKey.get(
    operationGenerationKey(root, nonce),
  );
  if (!state) return;
  state.retired = true;
  revokeOwnedOperationContextCapabilities(state.owned);
}

function ownedOperationGeneration(
  owned: object,
  identity: OwnedIdentity,
  shouldAllowRetired = false,
): OperationGenerationState {
  const state = operationGenerationsByKey.get(
    operationGenerationKey(identity.root, identity.operationId),
  );
  if (
    !state ||
    state.owned !== owned ||
    operationGenerationByRoot.get(identity.root) !== state ||
    (!shouldAllowRetired && state.retired)
  )
    throw Error("owned_operation_generation_liveness_lost");
  if (!state.generationLock?.assertLive()) {
    state.retired = true;
    revokeOwnedOperationContextCapabilities(state.owned);
    throw Error("owned_operation_generation_liveness_lost");
  }
  return state;
}

/**
 * operation Identity Replacementを決定する。
 *
 * @responsibility operation Identity Replacementの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns booleanを返す。
 * @precondition 「error: unknown」がoperationIdentityReplacementの入力契約を満たす。
 * @postcondition operationIdentityReplacementの責務を完了した結果だけを返す。
 * @effect N/A: operationIdentityReplacementは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: operationIdentityReplacementは独自の失敗分岐を所有しない。
 * @invariant operationIdentityReplacementは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: operationIdentityReplacementはProcess内の同一Subsystemで完結する。
 * @security operationIdentityReplacementはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: operationIdentityReplacementは共有非同期状態を持たない同期処理である。
 */
function operationIdentityReplacement(error: unknown): boolean {
  const message = errorMessage(error);
  return (
    errorCode(error) === "ENOENT" ||
    message === "owned_operation_identity_replaced" ||
    message === "owned_operation_mount_replaced"
  );
}

/**
 * 所有 Operation Identityの契約を検証する。
 *
 * @responsibility 所有 Operation Identityの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: object、identity: OwnedIdentity、shouldAllowRetired
 * @returns ChildSnapshotsを返す。
 * @precondition 「owned: object、identity: OwnedIdentity、shouldAllowRetired」がvalidateOwnedOperationIdentityの入力契約を満たす。
 * @postcondition validateOwnedOperationIdentityの責務を完了した結果だけを返す。
 * @effect validateOwnedOperationIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure validateOwnedOperationIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateOwnedOperationIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validateOwnedOperationIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateOwnedOperationIdentityは共有非同期状態を持たない同期処理である。
 */
function validateOwnedOperationIdentity(
  owned: object,
  identity: OwnedIdentity,
  shouldAllowRetired = false,
): ChildSnapshots {
  try {
    ownedOperationGeneration(owned, identity, shouldAllowRetired);
    if (
      !identity.children ||
      ownString(owned, "root") !== identity.root ||
      ownString(owned, "parent") !== identity.parent ||
      fs.realpathSync(identity.root) !== identity.root ||
      fs.realpathSync(identity.parent) !== identity.parent ||
      path.dirname(identity.root) !== identity.parent ||
      path.basename(identity.root) !== identity.operationId ||
      !sameFilesystemIdentity(
        readFilesystemIdentity(identity.root),
        identity.filesystem,
      )
    ) {
      throw new Error("owned_operation_identity_replaced");
    }
    for (const snapshot of Object.values(identity.children))
      validateDirectorySnapshot(snapshot);
    return identity.children;
  } catch (error) {
    if (operationIdentityReplacement(error)) {
      retireOwnedOperationGeneration(identity.root, identity.operationId);
      throw new Error("owned_operation_identity_replaced");
    }
    throw new Error("owned_operation_identity_observation_blocked");
  }
}

/**
 * own Valueを決定する。
 *
 * @responsibility own Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: object、key: string
 * @returns unknownを返す。
 * @precondition 「value: object、key: string」がownValueの入力契約を満たす。
 * @postcondition ownValueの責務を完了した結果だけを返す。
 * @effect N/A: ownValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownValueは独自の失敗分岐を所有しない。
 * @invariant ownValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownValueはProcess内の同一Subsystemで完結する。
 * @security ownValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownValueは共有非同期状態を持たない同期処理である。
 */
function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (
    !descriptor ||
    !("value" in descriptor) ||
    descriptor.get ||
    descriptor.set
  )
    return undefined;
  return descriptor.value;
}

/**
 * own Stringを決定する。
 *
 * @responsibility own Stringの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、key: string
 * @returns string | nullを返す。
 * @precondition 「value: unknown、key: string」がownStringの入力契約を満たす。
 * @postcondition ownStringの責務を完了した結果だけを返す。
 * @effect N/A: ownStringは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownStringは独自の失敗分岐を所有しない。
 * @invariant ownStringは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownStringはProcess内の同一Subsystemで完結する。
 * @security ownStringはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownStringは共有非同期状態を持たない同期処理である。
 */
function ownString(value: unknown, key: string): string | null {
  if (!isObject(value)) return null;
  const candidate = ownValue(value, key);
  return typeof candidate === "string" ? candidate : null;
}

/**
 * error Codeを決定する。
 *
 * @responsibility error Codeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns string | nullを返す。
 * @precondition 「error: unknown」がerrorCodeの入力契約を満たす。
 * @postcondition errorCodeの責務を完了した結果だけを返す。
 * @effect N/A: errorCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorCodeは独自の失敗分岐を所有しない。
 * @invariant errorCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorCodeはProcess内の同一Subsystemで完結する。
 * @security errorCodeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorCodeは共有非同期状態を持たない同期処理である。
 */
function errorCode(error: unknown): string | null {
  return ownString(error, "code");
}

/**
 * error Messageを決定する。
 *
 * @responsibility error Messageの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns string | nullを返す。
 * @precondition 「error: unknown」がerrorMessageの入力契約を満たす。
 * @postcondition errorMessageの責務を完了した結果だけを返す。
 * @effect N/A: errorMessageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorMessageは独自の失敗分岐を所有しない。
 * @invariant errorMessageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorMessageはProcess内の同一Subsystemで完結する。
 * @security errorMessageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorMessageは共有非同期状態を持たない同期処理である。
 */
function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : ownString(error, "message");
}

/**
 * Filesystem Entryを観測する。
 *
 * @responsibility Filesystem Entryの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns "present" | "confirmed_absent" | "unknown"を返す。
 * @precondition 「target: string」がobserveFilesystemEntryの入力契約を満たす。
 * @postcondition observeFilesystemEntryの責務を完了した結果だけを返す。
 * @effect observeFilesystemEntryはFilesystemの読取りまたは書込みを実行する。
 * @failure observeFilesystemEntryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeFilesystemEntryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security observeFilesystemEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeFilesystemEntryは共有非同期状態を持たない同期処理である。
 */
function observeFilesystemEntry(
  target: string,
): "present" | "confirmed_absent" | "unknown" {
  try {
    fs.lstatSync(target);
    return "present";
  } catch (error) {
    return errorCode(error) === "ENOENT" ? "confirmed_absent" : "unknown";
  }
}

/**
 * require Confirmed Absentを決定する。
 *
 * @responsibility require Confirmed Absentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string、reason: string
 * @returns N/A: requireConfirmedAbsentは戻り値を返さない。
 * @precondition 「target: string、reason: string」がrequireConfirmedAbsentの入力契約を満たす。
 * @postcondition requireConfirmedAbsentの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: requireConfirmedAbsentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requireConfirmedAbsentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requireConfirmedAbsentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requireConfirmedAbsentはProcess内の同一Subsystemで完結する。
 * @security requireConfirmedAbsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: requireConfirmedAbsentは共有非同期状態を持たない同期処理である。
 */
function requireConfirmedAbsent(target: string, reason: string): void {
  if (observeFilesystemEntry(target) !== "confirmed_absent")
    throw new Error(reason);
}

/**
 * owned Identityを決定する。
 *
 * @responsibility owned Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns OwnedIdentity | nullを返す。
 * @precondition 「value: unknown」がownedIdentityの入力契約を満たす。
 * @postcondition ownedIdentityの責務を完了した結果だけを返す。
 * @effect N/A: ownedIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownedIdentityは独自の失敗分岐を所有しない。
 * @invariant ownedIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownedIdentityはProcess内の同一Subsystemで完結する。
 * @security ownedIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownedIdentityは共有非同期状態を持たない同期処理である。
 */
function ownedIdentity(value: unknown): OwnedIdentity | null {
  return isObject(value) ? (ownedIdentities.get(value) ?? null) : null;
}

/**
 * require 所有 Identityを決定する。
 *
 * @responsibility require 所有 Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: object
 * @returns OwnedIdentityを返す。
 * @precondition 「value: object」がrequireOwnedIdentityの入力契約を満たす。
 * @postcondition requireOwnedIdentityの責務を完了した結果だけを返す。
 * @effect N/A: requireOwnedIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requireOwnedIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requireOwnedIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requireOwnedIdentityはProcess内の同一Subsystemで完結する。
 * @security requireOwnedIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: requireOwnedIdentityは共有非同期状態を持たない同期処理である。
 */
function requireOwnedIdentity(value: object): OwnedIdentity {
  const identity = ownedIdentities.get(value);
  if (!identity) throw new Error("owned_operation_directory_identity_required");
  return identity;
}

/**
 * Filesystem Identityを読み取る。
 *
 * @responsibility Filesystem Identityの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input root: string
 * @returns FilesystemIdentityを返す。
 * @precondition 「root: string」がreadFilesystemIdentityの入力契約を満たす。
 * @postcondition readFilesystemIdentityの責務を完了した結果だけを返す。
 * @effect readFilesystemIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure readFilesystemIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readFilesystemIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readFilesystemIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readFilesystemIdentityは共有非同期状態を持たない同期処理である。
 */
function readFilesystemIdentity(root: string): FilesystemIdentity {
  const metadata = fs.lstatSync(root, { bigint: true });
  // Windowsの64bit File IDはNodeのBigInt64Arrayで負値になり得る。
  const ino =
    process.platform === "win32" &&
    typeof metadata.ino === "bigint" &&
    metadata.ino >= -(1n << 63n) &&
    metadata.ino < 0n
      ? BigInt.asUintN(64, metadata.ino)
      : metadata.ino;
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    typeof ino !== "bigint" ||
    metadata.dev <= 0n ||
    ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    throw new Error("owned_operation_directory_identity_unavailable");
  }
  return Object.freeze({
    dev: metadata.dev,
    ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

/**
 * Filesystem Identityが同一かを判定する。
 *
 * @responsibility Filesystem Identityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000008
 * @input left: FilesystemIdentity、right: FilesystemIdentity
 * @returns booleanを返す。
 * @precondition 「left: FilesystemIdentity、right: FilesystemIdentity」がsameFilesystemIdentityの入力契約を満たす。
 * @postcondition sameFilesystemIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameFilesystemIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameFilesystemIdentityは独自の失敗分岐を所有しない。
 * @invariant sameFilesystemIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameFilesystemIdentityはProcess内の同一Subsystemで完結する。
 * @security sameFilesystemIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameFilesystemIdentityは共有非同期状態を持たない同期処理である。
 */
function sameFilesystemIdentity(
  left: FilesystemIdentity,
  right: FilesystemIdentity,
): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs
  );
}

/**
 * directory Snapshotを決定する。
 *
 * @responsibility directory Snapshotの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input directory: string、parent: string、name: string
 * @returns DirectorySnapshotを返す。
 * @precondition 「directory: string、parent: string、name: string」がdirectorySnapshotの入力契約を満たす。
 * @postcondition directorySnapshotの責務を完了した結果だけを返す。
 * @effect directorySnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure directorySnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant directorySnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security directorySnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: directorySnapshotは共有非同期状態を持たない同期処理である。
 */
function directorySnapshot(
  directory: string,
  parent: string,
  name: string,
): DirectorySnapshot {
  const realParent = fs.realpathSync(parent);
  const realDirectory = fs.realpathSync(directory);
  if (
    path.dirname(realDirectory) !== realParent ||
    path.basename(realDirectory) !== name
  ) {
    throw new Error("owned_operation_mount_boundary_failed");
  }
  return Object.freeze({
    parent: realParent,
    root: realDirectory,
    name,
    filesystem: readFilesystemIdentity(realDirectory),
  });
}

/**
 * Directory Snapshotの契約を検証する。
 *
 * @responsibility Directory Snapshotの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input snapshot: DirectorySnapshot
 * @returns stringを返す。
 * @precondition 「snapshot: DirectorySnapshot」がvalidateDirectorySnapshotの入力契約を満たす。
 * @postcondition validateDirectorySnapshotの責務を完了した結果だけを返す。
 * @effect validateDirectorySnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure validateDirectorySnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateDirectorySnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validateDirectorySnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateDirectorySnapshotは共有非同期状態を持たない同期処理である。
 */
function validateDirectorySnapshot(snapshot: DirectorySnapshot): string {
  const realParent = fs.realpathSync(snapshot.parent);
  const realDirectory = fs.realpathSync(snapshot.root);
  const filesystem = readFilesystemIdentity(snapshot.root);
  if (
    realParent !== snapshot.parent ||
    realDirectory !== snapshot.root ||
    path.dirname(realDirectory) !== realParent ||
    path.basename(realDirectory) !== snapshot.name ||
    !sameFilesystemIdentity(filesystem, snapshot.filesystem)
  ) {
    throw new Error("owned_operation_mount_replaced");
  }
  return snapshot.root;
}

/**
 * serializable Identityを決定する。
 *
 * @responsibility serializable Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns SerializableIdentityを返す。
 * @precondition 「target: string」がserializableIdentityの入力契約を満たす。
 * @postcondition serializableIdentityの責務を完了した結果だけを返す。
 * @effect serializableIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: serializableIdentityは独自の失敗分岐を所有しない。
 * @invariant serializableIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security serializableIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: serializableIdentityは共有非同期状態を持たない同期処理である。
 */
function serializableIdentity(target: string): SerializableIdentity {
  const identity = readFilesystemIdentity(target);
  return {
    dev: identity.dev.toString(),
    ino: identity.ino.toString(),
    birthtimeNs: identity.birthtimeNs.toString(),
  };
}

/**
 * identity Matches 記録を決定する。
 *
 * @responsibility identity Matches 記録の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string、record: SerializableIdentity
 * @returns booleanを返す。
 * @precondition 「target: string、record: SerializableIdentity」がidentityMatchesRecordの入力契約を満たす。
 * @postcondition identityMatchesRecordの責務を完了した結果だけを返す。
 * @effect identityMatchesRecordはFilesystemの読取りまたは書込みを実行する。
 * @failure identityMatchesRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant identityMatchesRecordは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security identityMatchesRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: identityMatchesRecordは共有非同期状態を持たない同期処理である。
 */
function identityMatchesRecord(
  target: string,
  record: SerializableIdentity,
): boolean {
  try {
    const identity = readFilesystemIdentity(target);
    return (
      identity.dev === BigInt(record.dev) &&
      identity.ino === BigInt(record.ino) &&
      identity.birthtimeNs === BigInt(record.birthtimeNs)
    );
  } catch {
    return false;
  }
}

/**
 * 操作IDを耐久化し、回復と同じ排他を取ってから専用Rootを作る。
 * @trace ARCH-000008
 * @failure Receipt欠測・保存不明・取消は同じ参照を保持し、不明物を自動採用しない。
 */
export function createOwnedOperationDirectories(
  input: HostOperationInput,
): OwnedOperationDirectories {
  const repositoryRoot = resolveVerifiedRepositoryRoot(input?.root);
  if (
    !repositoryRoot ||
    typeof input.recordingCurrent !== "function" ||
    !["task", "advice", "isolation_probe"].includes(input.purpose)
  )
    throw Error("owned_operation_repository_required");
  const operationId = createOperationId();
  const record: HostRecord = Object.freeze({
    kind: "host_operation",
    operationId,
    recoveryId: "host-operation." + operationId,
    purpose: input.purpose,
    resources: null,
    createdAt: new Date().toISOString(),
    phase: "preparing",
    rootIdentity: null,
    childIdentities: Object.freeze({}),
    cleanup: "not_requested",
  });
  const access = hostRecordingAccess(input, operationId);
  const started = saveOperationStart(access, {
    kind: "host_operation",
    value: record,
  });
  if (
    !started.startSaved ||
    !started.lockReleased ||
    started.revision === null ||
    started.payloadSha256 === null
  )
    throwOwnedOperationDirectoryCreationFailure(
      Error("host_operation_intent_unconfirmed"),
      {
        cleanupConfirmed:
          !started.filesystemEffectIssued && started.lockReleased,
        manualRecoveryRequired:
          started.filesystemEffectIssued || !started.lockReleased,
        hostRecoveryId: record.recoveryId,
      },
    );
  const acquired = acquireHostOperationLock(input.root, operationId);
  if (acquired.status !== "acquired")
    throwOwnedOperationDirectoryCreationFailure(
      Error("host_operation_lock_unavailable"),
      {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        hostRecoveryId: record.recoveryId,
      },
    );
  const host: HostState = {
    input,
    record,
    version: {
      revision: started.revision,
      payloadSha256: started.payloadSha256,
    },
    lock: acquired.lock,
  };
  let owned: OwnedOperationDirectories | null = null;
  try {
    freshHost(host);
    requireHostExecutionCurrent(input);
    const parent = requireReadyRepositoryExecutionDataArea(
      ensureRepositoryExecutionDataArea(input.root, "operations"),
      "host_operation_parent_unconfirmed",
    );
    if (parent.status !== "ready")
      throw Error("host_operation_parent_unconfirmed");
    const root = path.join(parent.directory, operationId);
    requireConfirmedAbsent(root, "owned_operation_directory_already_present");
    requireHostExecutionCurrent(input);
    fs.mkdirSync(root);
    if (
      fs.realpathSync(root) !== root ||
      fs.realpathSync(parent.directory) !== parent.directory ||
      path.dirname(root) !== parent.directory
    )
      throw Error("owned_operation_directory_replaced");
    const filesystem = readFilesystemIdentity(root);
    owned = {
      parent: parent.directory,
      root,
      directories: null,
      hostRecoveryId: record.recoveryId,
    };
    const identity: OwnedIdentity = {
      operationId,
      parent: parent.directory,
      root,
      filesystem,
      createdAt: record.createdAt,
      host,
    };
    ownedIdentities.set(owned, identity);
    registerOwnedOperationGeneration(owned, identity);
    writeHostCheckpoint(host, {
      ...host.record,
      rootIdentity: serializableIdentity(root),
    });
    const children: Partial<Record<keyof ChildSnapshots, DirectorySnapshot>> =
      {};
    for (const [key, name] of Object.entries(HOST_CHILD_NAMES)) {
      requireHostExecutionCurrent(input);
      const child = path.join(root, name);
      fs.mkdirSync(child);
      const snapshot = directorySnapshot(child, root, name);
      children[key as keyof ChildSnapshots] = snapshot;
      writeHostCheckpoint(host, {
        ...host.record,
        childIdentities: {
          ...host.record.childIdentities,
          [key]: serializableIdentity(child),
        },
      });
    }
    const complete = Object.freeze(children) as ChildSnapshots;
    owned.directories = Object.freeze({
      root,
      ...Object.fromEntries(
        Object.entries(complete).map(([key, value]) => [key, value.root]),
      ),
    }) as OperationDirectories;
    ownedIdentities.set(
      owned,
      Object.freeze({
        ...identity,
        children: complete,
        mounts: Object.freeze({
          workspace: complete.workspace,
          providerHome: complete.providerHome,
          tmp: complete.tmp,
        }),
      }),
    );
    writeHostCheckpoint(host, { ...host.record, phase: "active" });
    return owned;
  } catch (cause) {
    let cleanupConfirmed = false;
    try {
      if (owned) cleanupOwnedOperationDirectories(owned);
      else {
        const paths = resolveRepositoryExecutionDataPaths(input.root);
        if (!paths)
          throw Error("host_recovery_initialization_root_identity_unknown");
        const root = path.join(paths.operations, operationId);
        requireConfirmedAbsent(
          root,
          "host_recovery_initialization_root_identity_unknown",
        );
        writeHostCheckpoint(host, {
          ...host.record,
          phase: "terminal",
          cleanup: "confirmed",
        });
        if (!host.lock.release())
          throw Error("host_operation_lock_release_unconfirmed");
      }
      cleanupConfirmed = true;
    } catch {
      if (!owned) {
        try {
          host.lock.release();
        } catch {}
      }
    }
    throwOwnedOperationDirectoryCreationFailure(cause, {
      cleanupConfirmed,
      manualRecoveryRequired: !cleanupConfirmed,
      hostRecoveryId: cleanupConfirmed ? null : record.recoveryId,
    });
  }
}

/**
 * owned Operation From Management Capabilityを決定する。
 *
 * @responsibility owned Operation From Management Capabilityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns ownedOperationFromManagementCapabilityの計算結果を返す。
 * @precondition 「managementCapability: unknown」がownedOperationFromManagementCapabilityの入力契約を満たす。
 * @postcondition ownedOperationFromManagementCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: ownedOperationFromManagementCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ownedOperationFromManagementCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ownedOperationFromManagementCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownedOperationFromManagementCapabilityはProcess内の同一Subsystemで完結する。
 * @security ownedOperationFromManagementCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownedOperationFromManagementCapabilityは共有非同期状態を持たない同期処理である。
 */
function ownedOperationFromManagementCapability(managementCapability: unknown) {
  const binding = isObject(managementCapability)
    ? (operationManagementCapabilities.get(managementCapability) ?? null)
    : null;
  if (!binding) throw new Error("owned_operation_management_binding_required");
  const identity = ownedIdentities.get(binding.owned);
  if (
    !identity ||
    identity.operationId !== binding.operationId ||
    identity.createdAt !== binding.createdAt
  ) {
    throw new Error("owned_operation_management_binding_required");
  }
  validateOwnedOperationIdentity(binding.owned, identity);
  return Object.freeze({ binding, identity });
}

/**
 * abandon 所有 Host Operation Generation Lockを決定する。
 *
 * @responsibility abandon 所有 Host Operation Generation Lockの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns abandonOwnedHostOperationGenerationLockの計算結果を返す。
 * @precondition 「managementCapability: unknown」がabandonOwnedHostOperationGenerationLockの入力契約を満たす。
 * @postcondition abandonOwnedHostOperationGenerationLockの責務を完了した結果だけを返す。
 * @effect N/A: abandonOwnedHostOperationGenerationLockは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure abandonOwnedHostOperationGenerationLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant abandonOwnedHostOperationGenerationLockは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: abandonOwnedHostOperationGenerationLockはProcess内の同一Subsystemで完結する。
 * @security abandonOwnedHostOperationGenerationLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency abandonOwnedHostOperationGenerationLockは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function abandonOwnedHostOperationGenerationLock(
  managementCapability: unknown,
) {
  try {
    const { binding, identity } =
      ownedOperationFromManagementCapability(managementCapability);
    const state = ownedOperationGeneration(binding.owned, identity, true);
    if (!state.generationLock) return true;
    const released = state.generationLock.release();
    if (released) {
      state.generationLock = null;
      return true;
    }
    state.retired = true;
    revokeOwnedOperationContextCapabilities(state.owned);
    poisonRuntimeProcessAfterCleanupUnknown();
    return false;
  } catch {
    return false;
  }
}

/**
 * 所有 Mount Capabilityを構築する。
 *
 * @responsibility 所有 Mount Capabilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns Readonly<{ kind: "owned_operation_mounts" }>を返す。
 * @precondition 「owned: unknown」がcreateOwnedMountCapabilityの入力契約を満たす。
 * @postcondition createOwnedMountCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: createOwnedMountCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createOwnedMountCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createOwnedMountCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOwnedMountCapabilityはProcess内の同一Subsystemで完結する。
 * @security createOwnedMountCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOwnedMountCapabilityは共有非同期状態を持たない同期処理である。
 */
export function createOwnedMountCapability(
  owned: unknown,
): Readonly<{ kind: "owned_operation_mounts" }> {
  const identity = ownedIdentity(owned);
  if (!identity?.children || !isObject(owned)) {
    throw new Error("owned_operation_mount_identity_required");
  }
  const children = validateOwnedOperationIdentity(owned, identity);
  const capability = Object.freeze({ kind: "owned_operation_mounts" });
  mountCapabilities.set(capability, Object.freeze({ owned, children }));
  const aliases = operationContextAliases.get(owned) ?? new Set<object>();
  aliases.add(capability);
  operationContextAliases.set(owned, aliases);
  return capability;
}

/**
 * 所有 Mount Capabilityを検証する。
 *
 * @responsibility 所有 Mount Capabilityの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns 上位が所有する全操作Pathを返す。
 * @precondition 「capability: unknown」がverifyOwnedMountCapabilityの入力契約を満たす。
 * @postcondition verifyOwnedMountCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: verifyOwnedMountCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyOwnedMountCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyOwnedMountCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyOwnedMountCapabilityはProcess内の同一Subsystemで完結する。
 * @security verifyOwnedMountCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyOwnedMountCapabilityは共有非同期状態を持たない同期処理である。
 */
export function verifyOwnedMountCapability(
  capability: unknown,
): OperationPaths {
  const mount = isObject(capability)
    ? (mountCapabilities.get(capability) ?? null)
    : null;
  if (!mount) throw new Error("owned_operation_mount_capability_required");
  const identity = ownedIdentities.get(mount.owned);
  if (!identity) throw new Error("owned_operation_mount_capability_required");
  const children = validateOwnedOperationIdentity(mount.owned, identity);
  if (children !== mount.children)
    throw new Error("owned_operation_mount_capability_required");
  return Object.freeze({
    workspace: validateDirectorySnapshot(children.workspace),
    providerHome: validateDirectorySnapshot(children.providerHome),
    tmp: validateDirectorySnapshot(children.tmp),
    events: validateDirectorySnapshot(children.events),
    projection: validateDirectorySnapshot(children.projection),
    management: validateDirectorySnapshot(children.management),
  });
}

/**
 * 所有 Operation Context Capabilityを構築する。
 *
 * @responsibility 所有 Operation Context Capabilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns Readonly<{ kind: "owned_operation_context" }>を返す。
 * @precondition 「owned: unknown」がcreateOwnedOperationContextCapabilityの入力契約を満たす。
 * @postcondition createOwnedOperationContextCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: createOwnedOperationContextCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createOwnedOperationContextCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createOwnedOperationContextCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOwnedOperationContextCapabilityはProcess内の同一Subsystemで完結する。
 * @security createOwnedOperationContextCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOwnedOperationContextCapabilityは共有非同期状態を持たない同期処理である。
 */
export function createOwnedOperationContextCapability(
  owned: unknown,
): Readonly<{ kind: "owned_operation_context" }> {
  const identity = ownedIdentity(owned);
  if (!identity?.children || !isObject(owned)) {
    throw new Error("owned_operation_context_identity_required");
  }
  validateOwnedOperationIdentity(owned, identity);
  const capability = Object.freeze({ kind: "owned_operation_context" });
  operationContextCapabilities.set(
    capability,
    Object.freeze({
      owned,
      operationId: identity.operationId,
      createdAt: identity.createdAt,
    }),
  );
  const aliases = operationContextAliases.get(owned) ?? new Set<object>();
  aliases.add(capability);
  operationContextAliases.set(owned, aliases);
  return capability;
}

/**
 * 所有 Operation Management Capabilityを構築する。
 *
 * @responsibility 所有 Operation Management Capabilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input operationContextCapability: unknown、mountCapability: unknown
 * @returns Readonly<{ kind: "owned_operation_management_binding" }>を返す。
 * @precondition 「operationContextCapability: unknown、mountCapability: unknown」がcreateOwnedOperationManagementCapabilityの入力契約を満たす。
 * @postcondition createOwnedOperationManagementCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: createOwnedOperationManagementCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createOwnedOperationManagementCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createOwnedOperationManagementCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOwnedOperationManagementCapabilityはProcess内の同一Subsystemで完結する。
 * @security createOwnedOperationManagementCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOwnedOperationManagementCapabilityは共有非同期状態を持たない同期処理である。
 */
export function createOwnedOperationManagementCapability(
  operationContextCapability: unknown,
  mountCapability: unknown,
): Readonly<{ kind: "owned_operation_management_binding" }> {
  const context = isObject(operationContextCapability)
    ? (operationContextCapabilities.get(operationContextCapability) ?? null)
    : null;
  const mount = isObject(mountCapability)
    ? (mountCapabilities.get(mountCapability) ?? null)
    : null;
  if (!context || !mount || context.owned !== mount.owned)
    throw new Error("owned_operation_management_binding_required");
  const identity = ownedIdentities.get(context.owned);
  if (!identity) throw new Error("owned_operation_management_binding_required");
  const children = validateOwnedOperationIdentity(context.owned, identity);
  if (
    children !== mount.children ||
    identity.operationId !== context.operationId ||
    identity.createdAt !== context.createdAt
  ) {
    throw new Error("owned_operation_management_binding_required");
  }
  validateDirectorySnapshot(children.management);
  const capability = Object.freeze({
    kind: "owned_operation_management_binding" as const,
  });
  operationManagementCapabilities.set(
    capability,
    Object.freeze({
      owned: context.owned,
      operationId: context.operationId,
      createdAt: context.createdAt,
    }),
  );
  const aliases =
    operationContextAliases.get(context.owned) ?? new Set<object>();
  aliases.add(capability);
  operationContextAliases.set(context.owned, aliases);
  return capability;
}

/**
 * 所有 Operation Management Capabilityを検証する。
 *
 * @responsibility 所有 Operation Management Capabilityの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns OwnedOperationManagementBindingを返す。
 * @precondition 「capability: unknown」がverifyOwnedOperationManagementCapabilityの入力契約を満たす。
 * @postcondition verifyOwnedOperationManagementCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: verifyOwnedOperationManagementCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyOwnedOperationManagementCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyOwnedOperationManagementCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyOwnedOperationManagementCapabilityはProcess内の同一Subsystemで完結する。
 * @security verifyOwnedOperationManagementCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyOwnedOperationManagementCapabilityは共有非同期状態を持たない同期処理である。
 */
export function verifyOwnedOperationManagementCapability(
  capability: unknown,
): OwnedOperationManagementBinding {
  const binding = isObject(capability)
    ? (operationManagementCapabilities.get(capability) ?? null)
    : null;
  if (!binding) throw new Error("owned_operation_management_binding_required");
  const identity = ownedIdentities.get(binding.owned);
  if (
    !identity ||
    identity.operationId !== binding.operationId ||
    identity.createdAt !== binding.createdAt
  ) {
    throw new Error("owned_operation_management_binding_required");
  }
  validateOwnedOperationIdentity(binding.owned, identity);
  return Object.freeze({
    operationId: binding.operationId,
    createdAt: binding.createdAt,
    managementScopeBound: true as const,
  });
}

/**
 * 所有 Operation Management Mount Bindingを検証する。
 *
 * @responsibility 所有 Operation Management Mount Bindingの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown、mountCapability: unknown
 * @returns 操作ID、作成時刻と上位の全操作Pathを返す。
 * @precondition 「managementCapability: unknown、mountCapability: unknown」がverifyOwnedOperationManagementMountBindingの入力契約を満たす。
 * @postcondition verifyOwnedOperationManagementMountBindingの責務を完了した結果だけを返す。
 * @effect N/A: verifyOwnedOperationManagementMountBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyOwnedOperationManagementMountBindingは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyOwnedOperationManagementMountBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyOwnedOperationManagementMountBindingはProcess内の同一Subsystemで完結する。
 * @security verifyOwnedOperationManagementMountBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyOwnedOperationManagementMountBindingは共有非同期状態を持たない同期処理である。
 */
export function verifyOwnedOperationManagementMountBinding(
  managementCapability: unknown,
  mountCapability: unknown,
): Readonly<{
  operationId: string;
  createdAt: string;
  mounts: OperationPaths;
}> {
  const management = isObject(managementCapability)
    ? (operationManagementCapabilities.get(managementCapability) ?? null)
    : null;
  const mount = isObject(mountCapability)
    ? (mountCapabilities.get(mountCapability) ?? null)
    : null;
  if (!management || !mount || management.owned !== mount.owned) {
    throw new Error("owned_operation_management_mount_binding_required");
  }
  const identity = ownedIdentities.get(management.owned);
  if (
    !identity ||
    identity.operationId !== management.operationId ||
    identity.createdAt !== management.createdAt
  ) {
    throw new Error("owned_operation_management_mount_binding_required");
  }
  const children = validateOwnedOperationIdentity(management.owned, identity);
  if (children !== mount.children) {
    throw new Error("owned_operation_management_mount_binding_required");
  }
  return Object.freeze({
    operationId: management.operationId,
    createdAt: management.createdAt,
    mounts: Object.freeze({
      workspace: validateDirectorySnapshot(children.workspace),
      providerHome: validateDirectorySnapshot(children.providerHome),
      tmp: validateDirectorySnapshot(children.tmp),
      events: validateDirectorySnapshot(children.events),
      projection: validateDirectorySnapshot(children.projection),
      management: validateDirectorySnapshot(children.management),
    }),
  });
}

/**
 * 所有 Docker Execution Pathsを一時参照として取得する。
 *
 * @responsibility 所有 Docker Execution Pathsの参照条件、lifetime、所有権を移さない境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns Readonly<{ tmp: string; management: string }>を返す。
 * @precondition 「managementCapability: unknown」がborrowOwnedDockerExecutionPathsの入力契約を満たす。
 * @postcondition borrowOwnedDockerExecutionPathsの責務を完了した結果だけを返す。
 * @effect N/A: borrowOwnedDockerExecutionPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure borrowOwnedDockerExecutionPathsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant borrowOwnedDockerExecutionPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: borrowOwnedDockerExecutionPathsはProcess内の同一Subsystemで完結する。
 * @security borrowOwnedDockerExecutionPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: borrowOwnedDockerExecutionPathsは共有非同期状態を持たない同期処理である。
 */
export function borrowOwnedDockerExecutionPaths(
  managementCapability: unknown,
): Readonly<{ tmp: string; management: string }> {
  const { binding } =
    ownedOperationFromManagementCapability(managementCapability);
  const identity = ownedIdentities.get(binding.owned);
  if (!identity?.children)
    throw new Error("owned_operation_management_binding_required");
  const children = validateOwnedOperationIdentity(binding.owned, identity);
  return Object.freeze({
    tmp: validateDirectorySnapshot(children.tmp),
    management: validateDirectorySnapshot(children.management),
  });
}

/** 同じEM記録と実Lockで、全子の終結・実体・不存在・終端保存を閉じる。 @trace ARCH-000008 */
function removeOwnedOperationRootForCleanup(owned: unknown): OwnedIdentity {
  const identity = ownedIdentity(owned);
  if (!identity || !isObject(owned))
    throw Error("owned_operation_directory_identity_required");
  ownedOperationGeneration(owned, identity);
  if (
    ownString(owned, "root") !== identity.root ||
    ownString(owned, "parent") !== identity.parent
  )
    throw Error("owned_operation_directory_replaced");
  cleanupHostRoot(identity.host);
  return identity;
}

/**
 * execution-environmentで使用する所有 Operation 清掃 Statusの値契約を定義する。
 *
 * @responsibility 所有 Operation 清掃 StatusのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedOperationCleanupStatusが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedOperationCleanupStatusで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedOperationCleanupStatusの宣言は外部境界を開かない。
 * @security OwnedOperationCleanupStatusはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedOperationCleanupStatusの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OwnedOperationCleanupStatus =
  | "completed"
  | "protocol_failure_cleanup_confirmed";

const ownedOperationCleanupOutcomes = new WeakMap<
  object,
  Readonly<{
    status: OwnedOperationCleanupStatus;
    owned: unknown;
    operationId: string;
    root: string;
  }>
>();

/**
 * 所有 Operation 清掃 Outcomeを構築する。
 *
 * @responsibility 所有 Operation 清掃 Outcomeの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input status: 清掃結果、owned: 実際の対象、identity: 清掃前に検証した内部Identity。
 * @returns createOwnedOperationCleanupOutcomeの計算結果を返す。
 * @precondition 「status: OwnedOperationCleanupStatus」がcreateOwnedOperationCleanupOutcomeの入力契約を満たす。
 * @postcondition createOwnedOperationCleanupOutcomeの責務を完了した結果だけを返す。
 * @effect N/A: createOwnedOperationCleanupOutcomeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createOwnedOperationCleanupOutcomeは独自の失敗分岐を所有しない。
 * @invariant createOwnedOperationCleanupOutcomeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOwnedOperationCleanupOutcomeはProcess内の同一Subsystemで完結する。
 * @security createOwnedOperationCleanupOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOwnedOperationCleanupOutcomeは共有非同期状態を持たない同期処理である。
 */
function createOwnedOperationCleanupOutcome(
  status: OwnedOperationCleanupStatus,
  owned: unknown,
  identity: OwnedIdentity,
) {
  const outcome = Object.freeze({ kind: "owned_operation_cleanup_outcome" });
  ownedOperationCleanupOutcomes.set(
    outcome,
    Object.freeze({
      status,
      owned,
      operationId: identity.operationId,
      root: identity.root,
    }),
  );
  return outcome;
}

/**
 * 所有 Operation 清掃 Outcomeを検証する。
 *
 * @responsibility 所有 Operation 清掃 Outcomeの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input outcome: 真正な清掃結果、expectedOwned: 指定した場合は同じ清掃対象を要求する。
 * @returns OwnedOperationCleanupStatus | nullを返す。
 * @precondition 「outcome: unknown」がverifyOwnedOperationCleanupOutcomeの入力契約を満たす。
 * @postcondition verifyOwnedOperationCleanupOutcomeの責務を完了した結果だけを返す。
 * @effect N/A: verifyOwnedOperationCleanupOutcomeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifyOwnedOperationCleanupOutcomeは独自の失敗分岐を所有しない。
 * @invariant 結果に保持した操作・Root・nonce結合を失わず、別対象の真正結果を一致へ分類しない。
 * @boundary N/A: verifyOwnedOperationCleanupOutcomeはProcess内の同一Subsystemで完結する。
 * @security verifyOwnedOperationCleanupOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyOwnedOperationCleanupOutcomeは共有非同期状態を持たない同期処理である。
 */
export function verifyOwnedOperationCleanupOutcome(
  outcome: unknown,
  expectedOwned?: unknown,
): OwnedOperationCleanupStatus | null {
  const record = isObject(outcome)
    ? ownedOperationCleanupOutcomes.get(outcome)
    : null;
  return record &&
    (expectedOwned === undefined || record.owned === expectedOwned)
    ? record.status
    : null;
}

/**
 * 清掃前Ownerから同じ操作の清掃結果照合を固定する。
 * @responsibility Owner失効後も元操作・Root・nonceに一致する真正結果だけを受理する。
 * @trace ARCH-000008
 * @input managementCapability: 清掃前に有効な管理Owner。
 * @returns 真正結果の内部照合関数、またはnull。
 * @precondition 同じHost操作Ownerが有効である。
 * @postcondition 返却関数はProvider・Filesystem処置を許可しない。
 * @effect 準備時のHost Identity検証だけ。
 * @failure 不正・失効Ownerはnull。別結果は照合null。
 * @invariant Root・nonce・操作IDを利用側入力から再構成しない。
 * @boundary Host清掃Ownerから終端保存の結果照合。
 * @security Path・内部Identityを公開しない。
 * @concurrency 保存Ownerが清掃前に取得して同じAttemptで使用する。
 */
export function captureOwnedOperationCleanupVerification(
  managementCapability: unknown,
) {
  try {
    verifyOwnedOperationManagementCapability(managementCapability);
    const binding = isObject(managementCapability)
      ? operationManagementCapabilities.get(managementCapability)
      : null;
    const identity = binding ? ownedIdentities.get(binding.owned) : null;
    if (!binding || !identity) return null;
    /**
     * 固定した元操作へ真正清掃結果を照合する。
     * @responsibility 失効後も対象の取り違えを拒否する。
     * @trace ARCH-000008
     * @input outcome: 清掃Ownerのopaque結果。
     * @returns 同じ対象の清掃statusだけ、またはnull。
     * @precondition 清掃前の照合Context内で使用する。
     * @postcondition 別対象や偽造結果は受理しない。
     * @effect N/A: 内部WeakMapの照合だけ。
     * @failure 不一致はnull。
     * @invariant 既知の操作・Root・nonceを変更しない。
     * @boundary Host結果と終端保存。
     * @security 新しい処置Authorityを発行しない。
     * @concurrency N/A: 同期の値照合だけ。
     */
    return (outcome: unknown) => {
      const record = isObject(outcome)
        ? ownedOperationCleanupOutcomes.get(outcome)
        : null;
      return record &&
        record.owned === binding.owned &&
        record.operationId === identity.operationId &&
        record.root === identity.root &&
        record.operationId === identity.operationId
        ? record.status
        : null;
    };
  } catch {
    return null;
  }
}

/** 取得済みの同じHost Lock下で実体回収とEM終端を確定する。 @trace ARCH-000008 */
export function recoverOwnedOperationDirectories(
  recoveryId: unknown,
  capability: unknown,
) {
  const host = isObject(capability)
    ? hostOperationRecoveryGenerations.get(capability)
    : null;
  if (!host || host.record.recoveryId !== recoveryId)
    return Object.freeze({
      status: "blocked" as const,
      reason: "host_recovery_generation_active",
      recoveryId: typeof recoveryId === "string" ? recoveryId : null,
    });
  try {
    cleanupHostRoot(host);
    return Object.freeze({
      status: "recovered" as const,
      reason: "host_cleanup_recovered",
      recoveryId: null,
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "host_recovery_failed",
      recoveryId: host.record.recoveryId,
    });
  }
}

/**
 * Filesystem Policyの公開契約を記述する。
 *
 * @responsibility Filesystem Policyの公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input directories: OperationDirectories
 * @returns describeFilesystemPolicyの計算結果を返す。
 * @precondition 「directories: OperationDirectories」がdescribeFilesystemPolicyの入力契約を満たす。
 * @postcondition describeFilesystemPolicyの責務を完了した結果だけを返す。
 * @effect N/A: describeFilesystemPolicyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeFilesystemPolicyは独自の失敗分岐を所有しない。
 * @invariant describeFilesystemPolicyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeFilesystemPolicyはProcess内の同一Subsystemで完結する。
 * @security describeFilesystemPolicyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeFilesystemPolicyは共有非同期状態を持たない同期処理である。
 */
export function describeFilesystemPolicy(directories: OperationDirectories) {
  return {
    coordinatorRuntime: {
      write: [
        directories.events,
        directories.projection,
        directories.management,
      ],
    },
    repositoryAdapter: { write: [directories.workspace] },
    providerProcess: {
      write: [directories.workspace, directories.providerHome, directories.tmp],
      deny: [
        directories.events,
        directories.projection,
        directories.management,
      ],
    },
    credentialBroker: {
      credentialStoreAccess: "read-minimum",
      exposeCredentialStorePathToProvider: false,
    },
  };
}

/**
 * credential Environment Names Presentを決定する。
 *
 * @responsibility credential Environment Names Presentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input environment: unknown
 * @returns readonly string[]を返す。
 * @precondition 「environment: unknown」がcredentialEnvironmentNamesPresentの入力契約を満たす。
 * @postcondition credentialEnvironmentNamesPresentの責務を完了した結果だけを返す。
 * @effect N/A: credentialEnvironmentNamesPresentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: credentialEnvironmentNamesPresentは独自の失敗分岐を所有しない。
 * @invariant credentialEnvironmentNamesPresentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: credentialEnvironmentNamesPresentはProcess内の同一Subsystemで完結する。
 * @security credentialEnvironmentNamesPresentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: credentialEnvironmentNamesPresentは共有非同期状態を持たない同期処理である。
 */
export function credentialEnvironmentNamesPresent(
  environment: unknown,
): readonly string[] {
  return CREDENTIAL_ENV_NAMES.filter((name) => {
    const value = ownString(environment, name);
    return value !== null && value.length > 0;
  });
}

/**
 * repository-operation-runtimeで使用するBindingの値契約を定義する。
 *
 * @responsibility BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000009
 * @shape Bindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Bindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: Bindingの宣言は外部境界を開かない。
 * @security BindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Bindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Binding = Readonly<{
  managementCapability: object;
  operationId: string;
  repositoryRoot: string;
  verifiedRoot: Repository;
  repositoryKind: string;
  logicalRepositoryIdentity: string;
  repositoryInstanceIdentity: string;
  revision: string;
}>;

const bindings = new WeakMap<object, Binding>();

const capabilities = new WeakMap<object, Binding>();

/**
 * repository-operation-runtimeを観測する。
 *
 * @responsibility repository-operation-runtimeの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000009
 * @input repositoryRoot: string
 * @returns observeの計算結果を返す。
 * @precondition 「repositoryRoot: string」がobserveの入力契約を満たす。
 * @postcondition observeの責務を完了した結果だけを返す。
 * @effect Version Controlで現在のGit管理情報を読取る。書込み・外部Git CLI起動は行わない。
 * @failure observeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 単発Operation結合とVersion ControlのRepository観測。
 * @security observeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeは共有非同期状態を持たない同期処理である。
 */
function observe(repositoryRoot: string) {
  const verified = getRepository(repositoryRoot);
  if (verified.status !== "completed")
    throw new Error("repository_root_invalid");
  const observed = readRepositoryRevision(verified.capability);
  if (!observed) throw new Error("repository_revision_invalid");
  return Object.freeze({
    verifiedRoot: verified.capability,
    repositoryKind: observed.repositoryForm,
    logicalRepositoryIdentity: observed.repositoryIdentity,
    repositoryInstanceIdentity: observed.repositoryInstanceIdentity,
    revision: observed.revisionIdentity,
  });
}

/**
 * Repository Object Format 候補を観測する。
 *
 * @responsibility Repository Object Format 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000009
 * @input repositoryRoot: unknown
 * @returns inspectRepositoryObjectFormatCandidateの計算結果を返す。
 * @precondition 「repositoryRoot: unknown」がinspectRepositoryObjectFormatCandidateの入力契約を満たす。
 * @postcondition inspectRepositoryObjectFormatCandidateの責務を完了した結果だけを返す。
 * @effect Version ControlでGit形式を読取る。RuntimeのSHA-1限定判断は本Moduleが行う。
 * @failure inspectRepositoryObjectFormatCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectRepositoryObjectFormatCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRepositoryObjectFormatCandidateはProcess内の同一Subsystemで完結する。
 * @security inspectRepositoryObjectFormatCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRepositoryObjectFormatCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectRepositoryObjectFormatCandidate(
  repositoryRoot: unknown,
) {
  try {
    if (
      typeof repositoryRoot !== "string" ||
      !path.isAbsolute(repositoryRoot) ||
      repositoryRoot.length > 4_096 ||
      /[\0-\x1f\x7f]/u.test(repositoryRoot)
    ) {
      return null;
    }
    const repository = getRepository(repositoryRoot);
    const format =
      repository.status === "blocked" &&
      repository.reason === "repository_object_format_unsupported"
        ? { objectFormat: repository.objectFormat }
        : readRepositoryFormat(repository.capability);
    if (!format) return null;
    return Object.freeze({
      status: "candidate" as const,
      objectFormat: format.objectFormat,
      runtimeSupported: format.objectFormat === "sha1",
      revisionReported: false,
      repositoryPathReported: false,
    });
  } catch {
    return null;
  }
}

/**
 * Runtime 所有 Repository OperationをIdentityへ結合する。
 *
 * @responsibility Runtime 所有 Repository Operationの結合条件、相関Identity、不一致の拒否境界を所有する。
 * @trace ARCH-000009
 * @input managementCapability: unknown、repositoryRoot: unknown
 * @returns bindRuntimeOwnedRepositoryOperationの計算結果を返す。
 * @precondition 「managementCapability: unknown、repositoryRoot: unknown」がbindRuntimeOwnedRepositoryOperationの入力契約を満たす。
 * @postcondition bindRuntimeOwnedRepositoryOperationの責務を完了した結果だけを返す。
 * @effect Repositoryを読取り、同じOperationの結合を二つの私有WeakMapへ同期登録する。Filesystem書込みは行わない。
 * @failure bindRuntimeOwnedRepositoryOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant bindRuntimeOwnedRepositoryOperationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security bindRuntimeOwnedRepositoryOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: bindRuntimeOwnedRepositoryOperationは共有非同期状態を持たない同期処理である。
 */
export function bindRuntimeOwnedRepositoryOperation(
  managementCapability: unknown,
  repositoryRoot: unknown,
) {
  try {
    if (
      !managementCapability ||
      typeof managementCapability !== "object" ||
      typeof repositoryRoot !== "string" ||
      !path.isAbsolute(repositoryRoot) ||
      repositoryRoot.length > 4_096 ||
      /[\0-\x1f\x7f]/u.test(repositoryRoot)
    ) {
      return null;
    }
    if (bindings.has(managementCapability)) return null;
    const operation =
      verifyOwnedOperationManagementCapability(managementCapability);
    const observation = observe(repositoryRoot);
    if (!/^[0-9a-f]{40}$/u.test(observation.revision)) return null;
    const binding = Object.freeze({
      managementCapability,
      operationId: operation.operationId,
      repositoryRoot: fs.realpathSync.native(repositoryRoot),
      ...observation,
    });
    const capability = Object.freeze({});
    bindings.set(managementCapability, binding);
    capabilities.set(capability, binding);
    return Object.freeze({
      operationId: binding.operationId,
      revision: binding.revision,
      repositoryBindingCapability: capability,
      repositoryBound: true as const,
      pathReported: false,
    });
  } catch {
    return null;
  }
}

/**
 * Repositoryの登録と現在の実体・改訂版を照合する。
 * @responsibility 所有操作とRepositoryの同じ結合が現在も成立するか確認する。
 * @trace ARCH-000009
 * @input 管理参照と、同じ同期呼出しが管理参照から直前に検証した場合だけその操作ID。
 * @returns 同一結合又はnull。観測の例外は呼出し側が分類する。
 * @effect 元のHost検証及びRepositoryの現在読取り。保存なし。
 * @invariant 操作IDを受け取っても登録・実体・改訂版の検査は省略しない。
 * @boundary 私有の結合読取り。遅延処理・後続の再検証へ操作IDを借り回さない。
 */
function currentBinding(
  managementCapability: unknown,
  verifiedOperationId?: string,
) {
  if (!managementCapability || typeof managementCapability !== "object")
    return null;
  const binding = bindings.get(managementCapability);
  if (!binding) return null;
  const operationId =
    verifiedOperationId ??
    verifyOwnedOperationManagementCapability(managementCapability).operationId;
  if (operationId !== binding.operationId) return null;
  const current = observe(binding.repositoryRoot);
  return current.repositoryKind === binding.repositoryKind &&
    current.logicalRepositoryIdentity === binding.logicalRepositoryIdentity &&
    current.repositoryInstanceIdentity === binding.repositoryInstanceIdentity &&
    current.revision === binding.revision
    ? binding
    : null;
}

/**
 * 現在の所有操作とRepositoryの結合を検証する。
 * @responsibility 同一呼出し内でHost実体を一度だけ調べ、Gitを現在観測する。
 * @trace ARCH-000009
 * @input 管理参照、選定事前照合の場合のみ失敗を区別する内部用途。
 * @returns 現在の操作ID・改訂版、又は結合の欠測・差・観測不能を示すnull。
 * @effect Host実体・Repository読取り。実体差替え時の世代退役は管理検証に従う。
 * @failure 選定事前照合では管理参照拒否だけを例外で伝える。通常の観測不能はnull。
 * @invariant 検証済みIDは今回の同期呼出しだけで使い、後続の現在検証を置き換えない。
 * @boundary Host所有操作とRepositoryの現在性。
 * @security 結果を実行AuthorityにせずHost Pathを公開しない。
 */
export function verifyRuntimeOwnedRepositoryOperation(
  managementCapability: unknown,
  purpose?: "selection_preflight",
) {
  const verifiedOperationId =
    purpose === "selection_preflight"
      ? verifyOwnedOperationManagementCapability(managementCapability)
          .operationId
      : undefined;
  try {
    const binding = currentBinding(managementCapability, verifiedOperationId);
    return binding
      ? Object.freeze({
          operationId: binding.operationId,
          revision: binding.revision,
          repositoryBound: true as const,
          revisionCurrent: true as const,
        })
      : null;
  } catch {
    return null;
  }
}

/**
 * EMの確認時点で、元操作Ownerに結合した保存先だけを借りる。
 * @trace ARCH-000008
 * @returns 貸出し前にはRepositoryを読まず、失効・観測不能はnullを保持する。
 */
export function operationStateInput(managementCapability: unknown) {
  return {
    identity: managementCapability as object,
    observeRepository: () => {
      const observed =
        borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
      return observed
        ? {
            purpose: "execution" as const,
            root: observed.root,
            operationId: observed.operationId,
            revalidate: observed.revalidate,
          }
        : null;
    },
  };
}

/**
 * 開始保存と後続の終端照合に、元の操作Ownerからの観測を結び付ける。
 * @trace ARCH-000008
 * @returns EMが必要な時点で借用先と回収証拠を確認するための入力。生成時にI/Oをしない。
 */
export function operationStartInput(
  managementCapability: unknown,
  observeTerminal: (
    result: unknown,
    operationId: unknown,
    recoveryId: unknown,
  ) => unknown,
) {
  return {
    ...operationStateInput(managementCapability),
    observeSettlementRepository: () => {
      const observed =
        borrowRuntimeOwnedCoordinatorSettlementRepository(managementCapability);
      return observed
        ? withHistoryRetention({
            purpose: observed.purpose,
            root: observed.root,
            operationId: observed.operationId,
            revalidate: observed.revalidate,
          })
        : null;
    },
    captureCleanupVerification: () =>
      captureOwnedOperationCleanupVerification(managementCapability),
    observeTerminal,
  };
}

/**
 * Coordinatorの保存先選択へ、現在のRepository結合を内部借用する。
 * @responsibility 操作Ownerへ結合したRoot・論理Identity・実体Identity・発行revisionを再観測して返す。
 * @trace ARCH-000009
 * @input managementCapability: 同じRuntimeが所有する操作管理Capability。
 * @returns 内部保存用のRoot・結合・再検証手段、または借用不能のnull。
 * @precondition 操作がRepositoryへ結合され、現在のOwnerと発行revisionを確認できる。
 * @postcondition caller supplied Path、cwd、過去のJSONから保存先を選択しない。
 * @effect FilesystemとVersion Controlの現在Identityを読取り、書込みは行わない。
 * @failure 不正Capability、Owner失効、Repository実体・revision差、観測不能はnullを返す。
 * @invariant 発行時結合を現在観測で置換せず、元Ownerと同じ結合だけを借用する。
 * @boundary Repository Operation OwnerからCoordinator内部の保存先選択への境界。
 * @security 返却Path・Identityは書込み、削除、RecoveryまたはProvider起動のAuthorityではなく、外部公開しない。
 * @concurrency 保存直前・直後の再検証と実効排他はWriterが所有する。借用だけでLockを取得しない。
 */
export function borrowRuntimeOwnedCoordinatorStateRepository(
  managementCapability: unknown,
) {
  try {
    const binding = currentBinding(managementCapability);
    if (!binding) return null;
    const repository = {
      operationId: binding.operationId,
      repositoryRoot: binding.repositoryRoot,
      logicalRepositoryIdentity: binding.logicalRepositoryIdentity,
      repositoryInstanceIdentity: binding.repositoryInstanceIdentity,
      repositoryBinding: deriveCoordinatorRepositoryStateBinding(
        binding.repositoryRoot,
        binding.logicalRepositoryIdentity,
        binding.repositoryInstanceIdentity,
      ),
      revision: binding.revision,
      /**
       * 同じ操作OwnerとRepository結合が現在も成立するか再観測する。
       * @responsibility 借用後のOwner・実体・revision変化をWriterへ返す。
       * @trace ARCH-000009
       * @input N/A: 発行時の内部結合を閉包から参照する。
       * @returns 同じ結合を再確認できた場合だけtrue。
       * @precondition 借用元のRuntime内で使用する。
       * @postcondition 観測不能を現在一致へ分類しない。
       * @effect Repositoryと操作Ownerの現在状態を読取る。
       * @failure 観測失敗と結合失効はfalse。
       * @invariant 他のOwnerやRepositoryへ再結合しない。
       * @boundary 保存利用側と現在のRepository結合観測。
       * @security trueはFile書込みAuthorityやcleanup許可ではない。
       * @concurrency 保存用Lockの代わりにはせず、WriterがI/O境界で呼ぶ。
       */
      revalidate() {
        try {
          return currentBinding(managementCapability) === binding;
        } catch {
          return false;
        }
      },
    };
    return Object.freeze(
      Object.defineProperties(repository, {
        purpose: { value: "execution" as const },
        root: { value: binding.verifiedRoot },
      }),
    ) as Readonly<
      typeof repository & {
        purpose: "execution";
        root: Repository;
      }
    >;
  } catch {
    return null;
  }
}

/**
 * 既存Coordinator保存結合のHashを同じ符号化で導出する。
 * @responsibility 通常操作と再入場のRepository・Lock結合を共通化する。
 * @trace ARCH-000009
 * @input repositoryRoot: 検証済みRoot、logicalIdentity: 論理Identity、instanceIdentity: 実体Identity。
 * @returns 既存domain prefixと順序を維持したSHA-256。
 * @precondition 入力は既存Repository観測で確定している。
 * @postcondition 保存先とLock名の既存結合を変更しない。
 * @effect N/A: 局所Hash計算だけ。
 * @failure N/A: 観測不能は呼出し元が計算前に拒否する。
 * @invariant Path・論理・実体の順序とUTF-8符号化を維持する。
 * @boundary Repository観測と現在状態の結合。
 * @security Hashは処置Authorityではない。
 * @concurrency N/A: 同期の値計算だけ。
 */
function deriveCoordinatorRepositoryStateBinding(
  repositoryRoot: string,
  logicalIdentity: string,
  instanceIdentity: string,
) {
  return createHash("sha256")
    .update("crdd-coordinator-repository-state-binding-v1\0")
    .update(
      JSON.stringify([repositoryRoot, logicalIdentity, instanceIdentity]),
      "utf8",
    )
    .digest("hex");
}

/**
 * 検証済みRootを再入場の現在状態読取りへ借用する。
 * @responsibility 新ProcessのRoot論理・実体・現在Revisionを内部Readerへ固定する。
 * @trace ARCH-000009
 * @input rootCapability: 既存Version Control Ownerが検証したRoot。
 * @returns 内部読取り結合、またはnull。
 * @precondition 呼出し元のCLIまたは上位組立てが対象Rootを固定している。
 * @postcondition 操作管理Capability、書込み・回収Authorityを生成しない。
 * @effect 現在RootとGit Identityの読取りだけ。
 * @failure 偽Root、失効、観測不能はnull。
 * @invariant 過去の保存値やAppDataからRootを復元しない。
 * @boundary 検証済みRepository Rootと再入場Reader。
 * @security 全Snapshotは内部限定で、公開は既存診断投影が所有する。
 * @concurrency Readerの前後で同じ実体と捕捉した現在Revisionを再確認する。
 */
export function borrowRuntimeOwnedCoordinatorRecoveryRepository(
  rootCapability: unknown,
) {
  try {
    if (!rootCapability || typeof rootCapability !== "object") return null;
    const repositoryRoot = resolveVerifiedRepositoryRoot(
      rootCapability as Repository,
    );
    if (!repositoryRoot) return null;
    const initial = observe(repositoryRoot);
    const repository = {
      repositoryRoot,
      repositoryBinding: deriveCoordinatorRepositoryStateBinding(
        repositoryRoot,
        initial.logicalRepositoryIdentity,
        initial.repositoryInstanceIdentity,
      ),
      /**
       * 再入場Readerが捕捉した現在Rootを再確認する。
       * @responsibility 読取り途中の実体・Revision変更を拒否する。
       * @trace ARCH-000009
       * @input N/A: 検証済みRootと初回観測を閉包から使う。
       * @returns 同じ観測を確認できた場合だけtrue。
       * @precondition 同じ借用の読取り中だけ使用する。
       * @postcondition 過去操作のAuthorityを復元しない。
       * @effect RootとGit Identityを読取る。
       * @failure 観測不能または変化はfalse。
       * @invariant 別Rootへ再結合しない。
       * @boundary 再入場Readerと現在Repository。
       * @security 成功は削除やProvider起動の許可ではない。
       * @concurrency 更新排他は既存Readerが別途所有する。
       */
      revalidate() {
        try {
          if (
            resolveVerifiedRepositoryRoot(rootCapability as Repository) !==
            repositoryRoot
          )
            return false;
          const current = observe(repositoryRoot);
          return (
            current.repositoryKind === initial.repositoryKind &&
            current.logicalRepositoryIdentity ===
              initial.logicalRepositoryIdentity &&
            current.repositoryInstanceIdentity ===
              initial.repositoryInstanceIdentity &&
            current.revision === initial.revision
          );
        } catch {
          return false;
        }
      },
    };
    return Object.freeze(
      Object.defineProperties(repository, {
        purpose: { value: "recovery" as const },
        root: { value: rootCapability },
      }),
    ) as Readonly<
      typeof repository & {
        purpose: "recovery";
        root: Repository;
      }
    >;
  } catch {
    return null;
  }
}

/**
 * 清掃前のRepository結合を終端保存に限って固定する。
 * @responsibility 通常Ownerの失効と独立した現在Repository実体の再検証を所有する。
 * @trace ARCH-000009
 * @input managementCapability: 清掃前の現在Owner。既存の操作結合を内部から取得する。
 * @returns 同じRepositoryの内部保存結合、またはnull。
 * @precondition 操作Ownerが現在のRepository実体と発行revisionへ結合している。
 * @postcondition 通常Ownerの検証・失効条件は変更しない。
 * @effect Repository実体を読取り、作成・削除は行わない。
 * @failure 結合・実体不一致と観測不能はnullまたは再検証false。
 * @invariant revision変化から旧操作Authorityを復元しない。
 * @boundary Repository OperationからCoordinatorの終端保存だけ。
 * @security Pathは内部限定。返却値をProvider起動や一般書込みに用いない。
 * @concurrency Writerは既存短期排他下で実体を再検証する。
 */
export function borrowRuntimeOwnedCoordinatorSettlementRepository(
  managementCapability: unknown,
) {
  const ordinary =
    borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
  const binding =
    ordinary && managementCapability && typeof managementCapability === "object"
      ? bindings.get(managementCapability)
      : null;
  if (
    !binding ||
    !ordinary ||
    binding.managementCapability !== managementCapability
  )
    return null;
  const repository: Omit<typeof ordinary, "purpose" | "root"> = {
    ...ordinary,
    /**
     * 終端保存先の現在実体だけを再確認する。
     * @responsibility 失効済み操作権限を復活させず保存先置換を拒否する。
     * @trace ARCH-000009
     * @input N/A: 発行時の内部結合を使用する。
     * @returns 現在実体一致だけtrue。
     * @precondition 終端限定Writerからだけ使用する。
     * @postcondition 同じ論理・実体Identityを維持する。
     * @effect 現在Repositoryの読取り。
     * @failure 観測不能はfalse。
     * @invariant 旧revision一致を清掃や再実行の根拠にしない。
     * @boundary 終端WriterとRepository実体。
     * @security 新しい操作Authorityを返さない。
     * @concurrency 短期排他はWriterが所有する。
     */
    revalidate() {
      try {
        const current = observe(binding.repositoryRoot);
        return (
          current.repositoryKind === binding.repositoryKind &&
          current.logicalRepositoryIdentity ===
            binding.logicalRepositoryIdentity &&
          current.repositoryInstanceIdentity ===
            binding.repositoryInstanceIdentity
        );
      } catch {
        return false;
      }
    },
  };
  return Object.freeze(
    Object.defineProperties(repository, {
      purpose: { value: "settlement" as const },
      root: { value: ordinary.root },
    }),
  ) as Readonly<
    Omit<typeof repository, "purpose" | "root"> & {
      purpose: "settlement";
      root: Repository;
    }
  >;
}

/**
 * Runtime 所有 Repository Binding Capabilityを検証する。
 *
 * @responsibility Runtime 所有 Repository Binding Capabilityの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000009
 * @input repositoryBindingCapability: unknown、managementCapability: unknown
 * @returns verifyRuntimeOwnedRepositoryBindingCapabilityの計算結果を返す。
 * @precondition 「repositoryBindingCapability: unknown、managementCapability: unknown」がverifyRuntimeOwnedRepositoryBindingCapabilityの入力契約を満たす。
 * @postcondition verifyRuntimeOwnedRepositoryBindingCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: verifyRuntimeOwnedRepositoryBindingCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyRuntimeOwnedRepositoryBindingCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyRuntimeOwnedRepositoryBindingCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyRuntimeOwnedRepositoryBindingCapabilityはProcess内の同一Subsystemで完結する。
 * @security verifyRuntimeOwnedRepositoryBindingCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyRuntimeOwnedRepositoryBindingCapabilityは共有非同期状態を持たない同期処理である。
 */
export function verifyRuntimeOwnedRepositoryBindingCapability(
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
) {
  try {
    if (
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      !managementCapability ||
      typeof managementCapability !== "object"
    ) {
      return null;
    }
    const binding = capabilities.get(repositoryBindingCapability);
    return binding?.managementCapability === managementCapability &&
      currentBinding(managementCapability) === binding
      ? Object.freeze({
          operationId: binding.operationId,
          revision: binding.revision,
          repositoryBound: true as const,
          revisionCurrent: true as const,
        })
      : null;
  } catch {
    return null;
  }
}

/**
 * Runtime 所有 Repository Sourceを一時参照として取得する。
 *
 * @responsibility Runtime 所有 Repository Sourceの参照条件、lifetime、所有権を移さない境界を所有する。
 * @trace ARCH-000009
 * @input repositoryBindingCapability: unknown、managementCapability: unknown
 * @returns borrowRuntimeOwnedRepositorySourceの計算結果を返す。
 * @precondition 「repositoryBindingCapability: unknown、managementCapability: unknown」がborrowRuntimeOwnedRepositorySourceの入力契約を満たす。
 * @postcondition borrowRuntimeOwnedRepositorySourceの責務を完了した結果だけを返す。
 * @effect N/A: borrowRuntimeOwnedRepositorySourceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure borrowRuntimeOwnedRepositorySourceは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant borrowRuntimeOwnedRepositorySourceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: borrowRuntimeOwnedRepositorySourceはProcess内の同一Subsystemで完結する。
 * @security borrowRuntimeOwnedRepositorySourceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: borrowRuntimeOwnedRepositorySourceは共有非同期状態を持たない同期処理である。
 */
export function borrowRuntimeOwnedRepositorySource(
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
) {
  try {
    if (
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      !managementCapability ||
      typeof managementCapability !== "object"
    ) {
      return null;
    }
    const binding = capabilities.get(repositoryBindingCapability);
    if (
      !binding ||
      binding.managementCapability !== managementCapability ||
      currentBinding(managementCapability) !== binding ||
      binding.revision.length !== 40
    ) {
      return null;
    }
    return Object.freeze({
      operationId: binding.operationId,
      repositoryRoot: binding.repositoryRoot,
      revision: binding.revision,
    });
  } catch {
    return null;
  }
}
