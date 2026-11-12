/**
 * 統合実行State・Lease・一回保存相関の完成した保存・読取り操作を提供する。
 * @responsibility 共通保存処理へ接続し、既存の排他・改訂検査・通知順序を維持する。
 * @trace ARCH-000008
 */

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { types } from "node:util";
import type { Repository } from "../../../version-control/src/index.ts";
import {
  getRepository,
  readRepositoryRevision,
} from "../../../version-control/src/index.ts";
import type { readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot } from "../attempt/crud.ts";
import type {
  CoordinatorStateTaskOperation,
  RepairWritePurpose,
} from "../attempt/types.ts";
import {
  coordinatorTaskResourcesAreSettled,
  parseDockerTaskRecoveryId,
} from "../attempt/validation.ts";
import {
  decodeCoordinatorHistoryRows,
  prepareCoordinatorHistoryRetention,
} from "../history/validation.ts";
import {
  hashRuntimeEntityDefinition,
  prepareRuntimeDefinitionChange,
} from "../objective/validation.ts";
import type {
  CoordinatorSnapshotOwner,
  CoordinatorStorageOwner,
  HistoryRepositoryInput,
  RuntimeTerminalStorageObservation,
  StoreResult,
} from "../storage/lock.ts";
import {
  acquireCoordinatorSnapshotPilotLock,
  acquireCoordinatorStorageOwnerForRepository,
  acquireRuntimeStateLock,
  blocked,
  completed,
  isLiveCoordinatorSnapshotOwner,
  isLiveCoordinatorStorageOwner,
  observeRuntimeContentRepository,
  observeRuntimeExecutionRepository,
  observeRuntimeRecoveryRepository,
  readCoordinatorStorageOwnerBinding,
  readHistoryRetentionDays,
  runtimeStorageOperationIdentity,
  storageLockFailure,
} from "../storage/lock.ts";
import type {
  CoordinatorStorageRepository,
  StableFileIdentity,
} from "../storage/store.ts";
import {
  assertCoordinatorAreaUnchanged,
  assertDirectory,
  assertRuntimeStateInitializationBoundary,
  classifyRuntimeSnapshotReentry,
  createCoordinatorRuntimeDataArea,
  createRuntimeStatePendingFile,
  ensureRepositoryRuntimeDataArea,
  flushRuntimeStateFile,
  inspectCoordinatorHistorySettlement,
  inspectDecisionHistorySettlement,
  leaseAcquisitionFootprintAbsent,
  observeCoordinatorArea,
  observeRepositoryRuntimeDataArea,
  pathConfirmedAbsent,
  RepositoryRuntimeDataAreaBlockedError,
  readCoordinatorSnapshot,
  readCoordinatorSnapshotOwned,
  readCoordinatorStateSnapshot,
  readCoordinatorStorageSnapshotOwned,
  readRuntimeOwnedCoordinatorStateSnapshot,
  readRuntimeStateFile,
  readStableFileSnapshot,
  requireReadyRepositoryRuntimeDataArea,
  sameStableFileIdentity,
} from "../storage/store.ts";
import type { ProjectTaskResultFact } from "../task/types.ts";
import {
  coordinatorConsumerCompletionPolicy,
  hasProjectTaskResultAcceptanceConflict,
  prepareCoordinatorUnifiedTaskSections,
  projectCoordinatorTaskSnapshot,
  validCoordinatorState,
} from "../task/validation.ts";
import type {
  CoordinatorLeaseRecoveryInput,
  CoordinatorRootObservedInput,
  CoordinatorSnapshot,
  CoordinatorSnapshotObservations,
  CoordinatorState,
  CoordinatorStateSnapshot,
  RuntimeAccess,
  RuntimeContentViews,
  RuntimeDefinitionValues,
  RuntimeReadResult,
  RuntimeWriteResult,
} from "./types.ts";
import {
  assertCoordinatorSnapshotTransition,
  authenticationUnknownAbsenceChanged,
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  COORDINATOR_STATE_SCHEMA,
  classifyCoordinatorRepairPublication,
  coordinatorSnapshotIntakeMatches,
  decodeRuntimeDomainSnapshot,
  encodeRuntimeStateValue,
  hashRuntimeProjectDefinition,
  prepareCoordinatorAuthenticationUnknownClosureSnapshot,
  prepareCoordinatorLeaseAcquisitionConfirmation,
  prepareCoordinatorLeaseAcquisitionReservation,
  prepareCoordinatorLeaseRecoveryReservation,
  prepareCoordinatorLeaseRecoverySettlement,
  prepareCoordinatorLeaseReleaseIntent,
  prepareCoordinatorLeaseReleaseSettlement,
  prepareCoordinatorRecoveredHistoryPublication,
  prepareCoordinatorReleasedLeaseReconciliation,
  prepareCoordinatorRepairHistoryLine,
  prepareCoordinatorRepairHistoryPublication,
  prepareCoordinatorRepairHistorySnapshot,
  prepareCoordinatorStateCleanupSnapshot,
  prepareCoordinatorStateCompletionSnapshot,
  prepareCoordinatorStateHistoryLine,
  prepareCoordinatorStateHistorySnapshot,
  prepareCoordinatorStateHostSnapshot,
  prepareCoordinatorStateLifecycleSnapshot,
  prepareCoordinatorStateReferencesSnapshot,
  prepareCoordinatorStateRepairCompletionSnapshot,
  prepareCoordinatorStateResourceSnapshot,
  prepareCoordinatorStateRestartSnapshot,
  prepareCoordinatorStateResultDeliverySnapshot,
  projectCoordinatorCurrentState,
  projectCoordinatorLeaseAcquisitionOwner,
  projectCoordinatorLeaseOwnerLossState,
  snapshotPlainRecord,
  validateCoordinatorStateTransition,
  validateCoordinatorUnifiedTransition,
  validateRepairWriteCandidate,
  validCoordinatorSnapshot,
  validId,
} from "./validation.ts";

/**
 * Coordinatorの現在状態・Queue・Leaseを単一Snapshotへ保存する。
 *
 * @responsibility 受付世代、保存比較交換、排他意図・根拠、終了整理と再入場を同じ保存Ownerへ結合する。
 * @trace ARCH-000004
 */

/**
 * 同じ短期保存Ownerへ現在観測を束縛する。
 * @responsibility Lease不存在と履歴確定を元の判定位置で同期観測できる形にする。
 * @trace ARCH-000004
 * @input owner: 取得済みの短期保存Owner。
 * @returns 固定Schema・Process IDと同じRoot／Ownerを使う二つの同期観測。
 * @precondition 呼出し側は同じ短期Lockを保持する。
 * @postcondition 観測結果を先取り又はキャッシュしない。
 * @effect 構築自体はI/Oなし。返す操作は呼出し時に実Lease又は履歴を読み取る。
 * @failure 観測失敗・例外は元の観測関数のまま搬送する。
 * @invariant 未知を不存在へ変換せず、保存条件を変更しない。
 * @boundary 単一Writerと区画間の状態判断。
 * @security 外部入力のSchema・Process IDを期待値に採用しない。
 * @concurrency 同じ短期Owner内だけで使用し、Root公開APIへ追加しない。
 */
export function observeCoordinatorSnapshotObligations(
  owner: CoordinatorSnapshotOwner,
): CoordinatorSnapshotObservations {
  return {
    schema: COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
    processId: process.pid,
    leaseResourcesAbsent: (identity) =>
      coordinatorSnapshotLeaseResourcesAbsent(owner.repositoryRoot, identity),
    historySettlement: (row) => inspectCoordinatorHistorySettlement(owner, row),
    decisionHistorySettlement: (decision) =>
      inspectDecisionHistorySettlement(owner, decision),
  };
}

/**
 * 清掃済みの保存領域を新版の現在状態として初期化する。
 * @responsibility 明示的な切替でだけ受付世代を発行する。
 * @trace ARCH-000004
 * @input workingDirectory: 検証対象Root、binding: Repository結合。
 * @returns 確定保存した受付世代、または保全停止。
 * @precondition 旧記録の清掃はフロントAIが完了している。
 * @postcondition 同時初期化でも保存済みの一世代だけを返す。
 * @effect 新品領域にstate.jsonを作成する。
 * @failure 旧記録、履歴、pending、破損、観測不能は初期化しない。
 * @invariant QueryやRequest受付による暗黙初期化を行わない。
 * @boundary Repository-localの切替と現在状態。
 * @security 候補、認証、保護Decision、Evidenceを削除しない。
 * @concurrency 同Rootの短期Ownerで検査と保存を直列化する。
 */
export function initializeCoordinatorSnapshot(
  workingDirectory: Repository,
  binding: string,
): StoreResult<string> {
  if (typeof workingDirectory !== "object" || workingDirectory === null)
    return blocked("orchestrator_repository_root_invalid");
  if (!validId(binding)) return blocked("orchestrator_snapshot_input_invalid");
  const acquired = acquireCoordinatorSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const owner = acquired.value;
  let result: StoreResult<string>;
  let boundaryError: RepositoryRuntimeDataAreaBlockedError | null = null;
  try {
    result = initializeRuntimeSnapshotOwned(owner, binding);
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      boundaryError = error;
    result = blocked("orchestrator_snapshot_initialization_unconfirmed", true);
  }
  const released = owner.release();
  if (boundaryError) {
    if (!released)
      boundaryError.cause = "coordinator_snapshot_lock_release_unconfirmed";
    throw boundaryError;
  }
  if (!released)
    return blocked("orchestrator_snapshot_lock_release_unconfirmed", true);
  return result;
}

/**
 * 統合保存上のProject状態だけを同じ排他内で更新する。
 * @responsibility 既存State世代の比較と他区画の保全を接続する。
 * @trace ARCH-000004
 * @input workingDirectory、binding、stateJson、expectedGeneration。
 * @returns 保存済みProject状態、または記録を保全した停止。
 * @precondition 全入力を照合したSnapshotが既に存在する。
 * @postcondition Snapshot改訂とState世代を別々に検証し、解放確認後に成功する。
 * @effect 統合state.jsonと固定pendingだけを更新する。
 * @failure 入力不正、不存在、世代競合、pendingまたは保存不明で停止する。
 * @invariant Queue、受付結合、Lease、結果と未搬送履歴を変更しない。
 * @boundary 明示的な接続試行から統合保存への境界。本番Factoryは切り替えない。
 * @security 旧形式Fallback、初期化、Authority発行と旧記録削除を行わない。
 * @concurrency 読取り・比較・保存まで一つの短期Ownerを保持し外部待機しない。
 */
export function writeCoordinatorSnapshotState(
  workingDirectory: string | Repository,
  binding: string,
  stateJson: string,
  expectedGeneration: number,
  intake?: Readonly<{
    epoch: string;
    queueId: string;
    requestHash: string;
    projectId: string;
    milestoneId: string;
  }>,
  resultFacts: readonly ProjectTaskResultFact[] = [],
): StoreResult<CoordinatorState> {
  let state: CoordinatorState;
  try {
    if (
      !validId(binding) ||
      typeof stateJson !== "string" ||
      !Number.isSafeInteger(expectedGeneration) ||
      expectedGeneration < 0
    )
      throw new Error("snapshot_state_input_invalid");
    const parsed: unknown = JSON.parse(stateJson);
    if (
      !validCoordinatorState(parsed) ||
      parsed.generation !== expectedGeneration + 1
    )
      throw new Error("snapshot_state_input_invalid");
    state = parsed;
  } catch {
    return blocked("orchestrator_state_generation_mismatch");
  }
  const acquired = acquireCoordinatorSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const lock = acquired.value;
  let outcome: StoreResult<CoordinatorState>;
  let boundaryError: RepositoryRuntimeDataAreaBlockedError | null = null;
  try {
    const observed = readCoordinatorSnapshotOwned(lock, binding, true);
    if (observed.status !== "completed") outcome = blocked(observed.reason);
    else if (observed.value === null)
      outcome = blocked("orchestrator_snapshot_absent");
    else {
      const current = observed.value;
      if (intake && !coordinatorSnapshotIntakeMatches(current, intake))
        throw new Error("orchestrator_intake_epoch_retired");
      const previous = current.projects.find(
        (item) => item.projectId === state.projectId,
      );
      if (
        previous?.generation === expectedGeneration + 1 &&
        encodeRuntimeStateValue(previous) === encodeRuntimeStateValue(state)
      ) {
        const saved = writeCoordinatorSnapshotOwned(
          lock,
          binding,
          encodeRuntimeStateValue(current),
          current.snapshotRevision - 1,
          resultFacts.map((fact) => ({ ...fact, projectId: state.projectId })),
        );
        outcome =
          saved.status === "completed"
            ? completed("orchestrator_state_durable", previous)
            : saved;
      } else if ((previous?.generation ?? 0) !== expectedGeneration)
        outcome = blocked("orchestrator_state_generation_conflict");
      else if (hasProjectTaskResultAcceptanceConflict(previous, state))
        outcome = blocked("orchestrator_result_acceptance_conflict");
      else {
        const projects = previous
          ? current.projects.map((item) =>
              item.projectId === state.projectId ? state : item,
            )
          : [...current.projects, state];
        const saved = writeCoordinatorSnapshotOwned(
          lock,
          binding,
          encodeRuntimeStateValue({
            ...current,
            snapshotRevision: current.snapshotRevision + 1,
            projects,
          }),
          current.snapshotRevision,
          resultFacts.map((fact) => ({ ...fact, projectId: state.projectId })),
        );
        outcome =
          saved.status === "completed"
            ? completed("orchestrator_state_durable", state)
            : saved;
      }
    }
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      boundaryError = error;
    outcome = blocked("orchestrator_state_observation_unknown");
  }
  const released = lock.release();
  if (boundaryError) {
    if (!released)
      boundaryError.cause = "coordinator_snapshot_lock_release_unconfirmed";
    throw boundaryError;
  }
  if (!released)
    return blocked("orchestrator_snapshot_lock_release_unconfirmed", true);
  return outcome;
}

/**
 * 一体保存の変更と中断再入場を実行する。
 * @responsibility 固定pendingを先に処置し期待改訂番号で保存を確定する。
 * @trace ARCH-000004
 * @input workingDirectory、binding、payloadJson、expectedRevision。
 * @returns 保存したSnapshotまたは保全停止。
 * @precondition 明示接続した呼出し側が旧Writer停止と全入力照合を担当する。
 * @postcondition read-backとpending不存在を確認した時だけ成功を返す。
 * @effect Repository-localのstate.lock、state.pending.json、state.jsonを更新する。
 * @failure 排他、Root、世代、Hash、保存または回収不明で停止する。
 * @invariant 実データの旧Writerを自動切替せず、旧記録を削除しない。
 * @boundary 現在状態のFilesystem保存。
 * @security 保護Decisionと任意Pathを受け取らない。
 * @concurrency 同Rootの短期OS排他だけを保持し外部待機しない。
 */
export function writeCoordinatorSnapshot(
  workingDirectory: string | Repository | HistoryRepositoryInput,
  binding: string,
  payloadJson: string,
  expectedRevision: number,
): StoreResult<CoordinatorSnapshot> {
  const acquired = acquireCoordinatorSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const lock = acquired.value;
  let boundaryError: RepositoryRuntimeDataAreaBlockedError | null = null;
  let outcome: StoreResult<CoordinatorSnapshot>;
  try {
    outcome = writeCoordinatorSnapshotOwned(
      lock,
      binding,
      payloadJson,
      expectedRevision,
    );
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      boundaryError = error;
    outcome = blocked("orchestrator_snapshot_invalid_or_unconfirmed", true);
  }
  const released = lock.release();
  if (boundaryError) {
    if (!released)
      boundaryError.cause = "coordinator_snapshot_lock_release_unconfirmed";
    throw boundaryError;
  }
  if (!released)
    return blocked("orchestrator_snapshot_lock_release_unconfirmed", true);
  return outcome;
}

/**
 * 同じ排他Owner内で保存と中断再入場を処置する。
 * @responsibility 操作固有の更新から同じOwnerの保存確定へ接続する。
 * @trace ARCH-000004
 * @input lock: 取得済みOwner、binding、payloadJson、expectedRevision。
 * @returns 保存結果または記録を保全した停止。
 * @precondition 呼出し側が短期排他を取得し解放を担当する。
 * @postcondition 現在File読戻しとpending不存在を確認した時だけ保存成功。
 * @effect 固定marker・pending・現在Fileの保存を行う。
 * @failure Root・世代・記録・保存・観測の不明時は保全停止する。
 * @invariant 自己再取得せず、既存の遷移検査を維持する。
 * @boundary 排他Owner内の保存更新。
 * @security 旧Writerの自動切替や記録削除を発行しない。
 * @concurrency 外部待機を行わず短期排他の保持範囲で保存する。
 */
export function writeCoordinatorSnapshotOwned(
  lock: CoordinatorSnapshotOwner,
  binding: string,
  payloadJson: string,
  expectedRevision: number,
  resultFacts: unknown = [],
): StoreResult<CoordinatorSnapshot> {
  try {
    if (
      !isLiveCoordinatorSnapshotOwner(lock) ||
      !validId(binding) ||
      typeof payloadJson !== "string" ||
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0
    )
      return blocked("orchestrator_snapshot_input_invalid");
    const payload: unknown = JSON.parse(payloadJson);
    if (
      !validCoordinatorSnapshot(payload, binding, lock.repositoryRootHash) ||
      payload.snapshotRevision !== expectedRevision + 1
    )
      return blocked("orchestrator_snapshot_input_invalid");
    const observed = readCoordinatorStorageSnapshotOwned(lock, true);
    let current: CoordinatorSnapshot | null = null;
    if (observed.status === "completed" && observed.value) {
      const decoded = decodeRuntimeDomainSnapshot(
        Buffer.from(`${encodeRuntimeStateValue(observed.value.snapshot)}\n`),
        lock.repositoryBinding,
      );
      if (!decoded)
        return blocked("orchestrator_snapshot_invalid_or_unconfirmed", true);
      current = projectCoordinatorTaskSnapshot(
        decoded,
        lock.repositoryRootHash,
      );
      if (current && current.repositoryBindingId !== binding)
        return blocked("orchestrator_snapshot_binding_invalid", true);
      if (
        observed.value.snapshot.revision !== expectedRevision &&
        !(
          current &&
          current.snapshotRevision === payload.snapshotRevision &&
          encodeRuntimeStateValue(current) === encodeRuntimeStateValue(payload)
        )
      )
        return blocked("orchestrator_snapshot_revision_conflict");
    } else if (observed.reason !== "coordinator_state_uninitialized")
      return blocked(observed.reason, true);
    if (
      current &&
      encodeRuntimeStateValue(current) !== encodeRuntimeStateValue(payload)
    )
      assertCoordinatorSnapshotTransition(
        current,
        payload,
        observeCoordinatorSnapshotObligations(lock),
      );
    if (
      !current &&
      !Object.values(payload)
        .filter(Array.isArray)
        .every((values) => values.length === 0)
    )
      return blocked("orchestrator_snapshot_initialization_required");
    const saved = writeCoordinatorStorageTaskSnapshotOwned(
      lock,
      payload,
      expectedRevision,
      resultFacts,
    );
    return saved.status === "completed" && saved.value
      ? completed("orchestrator_snapshot_durable", saved.value)
      : blocked(saved.reason, saved.filesystemEffectIssued);
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError) throw error;
    return blocked("orchestrator_snapshot_invalid_or_unconfirmed", true);
  }
}

/**
 * 保存操作の読取り・値更新・確定を一つのOwnerへ閉じる。
 * @responsibility 内部の同期処置だけを同じ短期排他へ接続する。
 * @trace ARCH-000004
 * @input workingDirectory、binding、Module内部の同期操作。
 * @returns 操作値、または元の停止結果。
 * @precondition 初期Snapshotは全入力照合によって別途確定している。
 * @postcondition 保存・解放確認後だけ成功し、変更しない読取りは保存しない。
 * @effect 操作が変更を返した場合に限り固定Snapshotを保存する。
 * @failure 操作例外、保存停止、解放未確認を停止へ戻す。
 * @invariant 外部公開callback、非同期待機と旧形式Fallbackを持たない。
 * @boundary 保存Module内部の操作とFilesystem。
 * @security Ownerを呼出し側へ公開せず、Authorityを新規発行しない。
 * @concurrency 一回取得し、全処置結果から一回の解放確認へ戻す。
 */
export function withCoordinatorSnapshotOperation<T>(
  workingDirectory: Repository | HistoryRepositoryInput,
  binding: string,
  operation: (
    current: CoordinatorSnapshot,
    owner: CoordinatorSnapshotOwner,
  ) => StoreResult<Readonly<{ next: CoordinatorSnapshot | null; value: T }>>,
  readMode: false | "history" = false,
): StoreResult<T> {
  if (typeof workingDirectory !== "object" || workingDirectory === null)
    return blocked("orchestrator_repository_root_invalid");
  if (!validId(binding)) return blocked("orchestrator_snapshot_input_invalid");
  const acquired = acquireCoordinatorSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const owner = acquired.value;
  let result: StoreResult<T>;
  try {
    const observed = readCoordinatorSnapshotOwned(owner, binding, readMode);
    if (observed.status !== "completed") result = observed;
    else if (observed.value === null)
      result = blocked("orchestrator_snapshot_absent");
    else {
      const applied = operation(observed.value, owner);
      if (applied.status !== "completed") result = applied;
      else if (applied.value.next === null)
        result = completed(applied.reason, applied.value.value);
      else {
        const saved = writeCoordinatorSnapshotOwned(
          owner,
          binding,
          encodeRuntimeStateValue({
            ...applied.value.next,
            snapshotRevision: observed.value.snapshotRevision + 1,
          }),
          observed.value.snapshotRevision,
        );
        result =
          saved.status === "completed"
            ? completed(applied.reason, applied.value.value)
            : saved;
      }
    }
  } catch {
    result = blocked("orchestrator_snapshot_operation_invalid_or_unconfirmed");
  }
  try {
    if (!owner.release())
      return blocked("orchestrator_snapshot_lock_release_unconfirmed", true);
  } catch {
    return blocked("orchestrator_snapshot_lock_release_unconfirmed", true);
  }
  return result;
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
 * @boundary Repository Rootからtmp内の短命な実排他へ。
 * @security Root外の実体へ辿らない。
 * @concurrency Rootと最後の既知親を不存在判定前に再確認する。
 */
export function coordinatorSnapshotLeaseResourcesAbsent(
  repositoryRoot: string,
  identity: string,
): boolean {
  assertDirectory(repositoryRoot);
  const boundary = observeCoordinatorArea(repositoryRoot, "tmp");
  if (boundary.status === "not_observed") {
    assertCoordinatorAreaUnchanged(repositoryRoot, "tmp", boundary);
    return true;
  }
  const parent = path.join(boundary.directory, "orchestrator-leases");
  if (pathConfirmedAbsent(parent)) {
    assertCoordinatorAreaUnchanged(repositoryRoot, "tmp", boundary);
    return true;
  }
  assertDirectory(parent);
  const isAbsent = leaseAcquisitionFootprintAbsent(parent, identity, [
    path.join(parent, `${identity}.lock`),
  ]);
  assertDirectory(repositoryRoot);
  assertDirectory(parent);
  assertCoordinatorAreaUnchanged(repositoryRoot, "tmp", boundary);
  return isAbsent;
}

/**
 * 専用観測済みauth不存在候補を同じ現在Writerで一回保存する。
 * @responsibility 元版・候補・保持Ownerを私有Contextへ固定し一般保存の迂回を拒否する。
 * @trace ARCH-000008
 * @input repository、recoveryId、before、observations: 私有回収Ownerの固定値。assertOwner: 同期生存確認。
 * @returns 保存・読戻し・排他解放を個別に示す既存Writer結果。
 * @precondition 外部観測は全長期排他を保持したまま保存排他の外で完了している。
 * @postcondition 未発行・Provider成功・Task全体完了へ変換しない。
 * @effect 同じstate.jsonの専用一版だけ。Docker要求なし。
 * @failure 元版差・別候補・失効・観測欠測・Context再使用は停止する。
 * @invariant 一次失敗・元結果・他操作を保全し新Mapを追加しない。
 * @boundary 私有回収Ownerと既存の短期Writer。
 * @security Package公開入口から任意観測やContextを受け付けない。
 * @concurrency 同期保存中もRootと全長期排他を再照合し、終端でContextを破棄する。
 */
export function writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure(
  repository: CoordinatorStorageRepository & { operationId: string },
  recoveryId: string,
  before: Buffer,
  observations: unknown,
  assertOwner: () => boolean,
) {
  const blocked = () => writeCoordinatorStateSnapshot(null, null, null, null);
  if (
    !Buffer.isBuffer(before) ||
    typeof assertOwner !== "function" ||
    types.isAsyncFunction(assertOwner)
  )
    return blocked();
  let active = true;
  const context = Object.freeze({});
  try {
    if (assertOwner() !== true || !repository.revalidate()) return blocked();
    const fixedBefore = Buffer.from(before);
    const fixedObservations: unknown = JSON.parse(
      encodeRuntimeStateValue(observations),
    );
    const candidate = prepareCoordinatorAuthenticationUnknownClosureSnapshot(
      fixedBefore,
      recoveryId,
      fixedObservations,
      repository.repositoryBinding,
    );
    if (!candidate) return blocked();
    const beforeTasks = decodeRuntimeDomainSnapshot(
      fixedBefore,
      repository.repositoryBinding,
    )?.snapshot.operations.filter(
      (item) => item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    const candidateTasks = decodeRuntimeDomainSnapshot(
      candidate,
      repository.repositoryBinding,
    )?.snapshot.operations.filter(
      (item) => item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (
      beforeTasks?.length !== 1 ||
      candidateTasks?.length !== 1 ||
      beforeTasks[0]?.identityJson !== candidateTasks[0]?.identityJson ||
      JSON.parse(beforeTasks[0]?.identityJson ?? "null")?.operationId !==
        repository.operationId ||
      JSON.parse(candidateTasks[0]?.identityJson ?? "null")?.operationId !==
        repository.operationId
    )
      return blocked();
    const binding = {
      kind: "authentication_unknown_closure" as const,
      repository,
      recoveryId,
      before: fixedBefore,
      candidate,
      observations: fixedObservations,
      assertOwner: () =>
        active && assertOwner() === true && repository.revalidate(),
      used: false,
    };
    settlements.set(context, binding);
    return writeCoordinatorStateSnapshot(
      null,
      {
        ...repository,
        revalidate: (expectedHistoryRetentionDays?: number) =>
          active &&
          settlements.get(context) === binding &&
          binding.used &&
          binding.assertOwner() &&
          repository.revalidate(expectedHistoryRetentionDays),
      },
      candidate,
      null,
      undefined,
      undefined,
      context,
    );
  } catch {
    return blocked();
  } finally {
    active = false;
    settlements.delete(context);
  }
}

const settlements = new WeakMap<
  object,
  | {
      kind: "authentication_unknown_closure";
      repository: CoordinatorStorageRepository & { operationId: string };
      recoveryId: string;
      before: Buffer;
      candidate: Buffer;
      observations: unknown;
      assertOwner: () => boolean;
      used: boolean;
    }
  | {
      kind: "runtime_repair";
      purpose: RepairWritePurpose;
      repository: CoordinatorStorageRepository & { operationId: string };
      recoveryId: string;
      before: Buffer | null;
      candidate: Buffer;
      assertOwner: () => boolean;
      used: boolean;
      publication?: Readonly<{
        boundaryIdentity: string;
        files: ReadonlyMap<
          string,
          Readonly<{ bytes: Buffer; identity: StableFileIdentity }>
        >;
      }>;
    }
  | {
      kind: "current_completion";
      operationKind: "docker_task" | "runtime_repair";
      repository: CoordinatorStorageRepository & { operationId: string };
      recoveryId: string;
      before: Buffer;
      candidate: Buffer;
      historyFile: Readonly<{
        bytes: Buffer;
        identity: StableFileIdentity;
      }> | null;
      assertOwner: () => boolean;
      used: boolean;
    }
  | {
      kind: "current_delivery";
      repository: CoordinatorStorageRepository & { operationId: string };
      recoveryId: string;
      before: Buffer;
      candidate: Buffer;
      historyFile: Readonly<{
        bytes: Buffer;
        identity: StableFileIdentity;
      }> | null;
      assertOwner: (expectedHistoryRetentionDays?: number) => boolean;
      used: boolean;
    }
  | {
      kind: "current_history";
      operationKind: "docker_task" | "runtime_repair";
      repository: CoordinatorStorageRepository & { operationId: string };
      recoveryId: string;
      before: Buffer;
      candidate: Buffer;
      stage: "checkpoint" | "publish" | "confirmed";
      historyFile: Readonly<{
        bytes: Buffer;
        identity: StableFileIdentity;
      }> | null;
      pendingHistoryFile: Readonly<{
        bytes: Buffer;
        identity: StableFileIdentity;
      }> | null;
      retentionDays: number | null;
      assertOwner: (expectedHistoryRetentionDays?: number) => boolean;
      used: boolean;
    }
>();

const initializations = new WeakMap<
  object,
  {
    repositoryBinding: string;
    boundaryIdentity: string;
    payloadSha256: string;
    publicationIssued: boolean;
  }
>();

/**
 * 固定された種別の履歴保存を既存の短命Contextへ結合する。
 * @responsibility 種別・exact操作・現在OwnerをReaderとWriterの間で保持する。
 * @trace ARCH-000008
 * @input repository、recoveryId、assertOwner、operationKind: Package内部の固定入口。
 * @returns 一段の保存結果。
 * @precondition 公開Wrapperが種別を固定する。
 * @postcondition Contextは呼出し終了時に失効する。
 * @effect 既存のRepository-local保存だけ。
 * @failure Reader・保存・排他解放不明は停止する。
 * @invariant RepairはTask配送へ移行しない。
 * @boundary Package内部の履歴保存。
 * @security 任意の保存Path・候補・時刻を受け取らない。
 * @concurrency 既存Kernel排他と単一Writerを用いる。
 */
export function advanceCoordinatorCurrentHistory(
  repository: CoordinatorStorageRepository & { operationId: string },
  recoveryId: string,
  assertOwner: () => boolean,
  operationKind: "docker_task" | "runtime_repair",
) {
  const refused = () =>
    Object.freeze({
      ...writeCoordinatorStateSnapshot(null, null, null, null),
      historyConfirmed: false,
    });
  try {
    if (typeof assertOwner !== "function" || assertOwner() !== true)
      return refused();
    const observed = readCoordinatorStateSnapshot(
      repository,
      recoveryId,
      null,
      recoveryId,
      null,
      null,
      operationKind,
    );
    if (
      operationKind === "docker_task" &&
      observed.status !== "completed" &&
      observed.lockReleased
    ) {
      const delivery = readCoordinatorStateSnapshot(
        repository,
        recoveryId,
        null,
        null,
        recoveryId,
      );
      if (
        delivery.status === "completed" &&
        delivery.value &&
        delivery.lockReleased &&
        delivery.currentDeliveryPublication &&
        assertOwner() === true
      )
        return Object.freeze({
          status: "completed" as const,
          reason: "coordinator_state_snapshot_confirmed",
          revision: delivery.value.snapshot.revision,
          payloadSha256: delivery.value.payloadSha256,
          snapshotConfirmed: true,
          lockReleased: true,
          filesystemEffectIssued: false,
          historyConfirmed: true,
        });
      return Object.freeze({
        ...refused(),
        reason: delivery.reason,
        lockReleased: delivery.lockReleased,
      });
    }
    const publication = observed.currentHistoryPublication;
    if (
      observed.status !== "completed" ||
      !observed.value ||
      !observed.lockReleased ||
      !publication ||
      assertOwner() !== true
    )
      return Object.freeze({
        ...refused(),
        reason: observed.reason,
        lockReleased: observed.lockReleased,
      });
    if (!publication.needsWrite)
      return Object.freeze({
        status: "completed" as const,
        reason: "coordinator_state_snapshot_confirmed",
        revision: observed.value.snapshot.revision,
        payloadSha256: observed.value.payloadSha256,
        snapshotConfirmed: true,
        lockReleased: true,
        filesystemEffectIssued: false,
        historyConfirmed: true,
      });
    const context = Object.freeze({});
    let active = true;
    const binding = {
      kind: "current_history" as const,
      operationKind: publication.operationKind,
      repository,
      recoveryId,
      before: Buffer.from(publication.before),
      candidate: Buffer.from(publication.candidate),
      stage: publication.stage,
      historyFile:
        publication.historyFile === null
          ? null
          : {
              bytes: Buffer.from(publication.historyFile.bytes),
              identity: publication.historyFile.identity,
            },
      pendingHistoryFile:
        publication.pendingHistoryFile === null
          ? null
          : {
              bytes: Buffer.from(publication.pendingHistoryFile.bytes),
              identity: publication.pendingHistoryFile.identity,
            },
      retentionDays: publication.retentionDays,
      used: false,
      assertOwner: (expectedHistoryRetentionDays?: number) =>
        active &&
        settlements.get(context) === binding &&
        binding.used &&
        assertOwner() === true &&
        repository.revalidate(expectedHistoryRetentionDays),
    };
    settlements.set(context, binding);
    try {
      const saved = writeCoordinatorStateSnapshot(
        null,
        { ...repository, revalidate: binding.assertOwner },
        binding.candidate,
        {
          recoveryId,
          cleanupStatus: null,
          dockerTerminal: null,
          currentHistory: context,
        },
      );
      return Object.freeze({
        ...saved,
        historyConfirmed:
          saved.status === "completed" && binding.stage !== "checkpoint",
      });
    } finally {
      active = false;
      settlements.delete(context);
    }
  } catch {
    return refused();
  }
}

/**
 * 保存済み利用形態から必要な耐久配送だけを登録する。
 * @responsibility 現在回収Ownerとexact登録候補を既存Writerへ短命に結合する。
 * @trace ARCH-000008
 * @input repository、recoveryId: 固定回収対象。assertOwner: 同じ解放済みOwnerの同期確認。
 * @returns 保存確認、排他解放、EffectとCoordinator配送待ちを分けた結果。
 * @precondition 資源・Host終端と履歴確認済みで旧OwnerのEffectは無効。
 * @postcondition CLI／Workbenchの操作は除去せず、耐久ACKを合成しない。
 * @effect 同じstate.jsonと既存短命保存物だけ。履歴の更新は行わない。
 * @failure 元版・候補・履歴実体・Owner不一致は後続保存を停止する。
 * @invariant 必要な利用側は保存Identityだけから導出する。
 * @boundary 現在回収と結果配送のRepository-local保存。
 * @security Callerから利用側、結果本文、Path、受領Hashを受け取らない。
 * @concurrency 同じ短期Kernel排他と各I/O前のOwner確認を使う。
 */
export function registerRuntimeOwnedCoordinatorRecoveryResultDelivery(
  repository: CoordinatorStorageRepository & { operationId: string },
  recoveryId: string,
  assertOwner: () => boolean,
) {
  const refused = Object.freeze({
    ...writeCoordinatorStateSnapshot(null, null, null, null),
    deliveryPending: false,
  });
  let context: object | null = null;
  let active = true;
  try {
    if (typeof assertOwner !== "function" || assertOwner() !== true)
      return refused;
    const observed = readCoordinatorStateSnapshot(
      repository,
      recoveryId,
      null,
      null,
      recoveryId,
    );
    const publication = observed.currentDeliveryPublication;
    if (
      observed.status !== "completed" ||
      !observed.value ||
      !observed.lockReleased ||
      !publication ||
      assertOwner() !== true
    )
      return Object.freeze({
        ...refused,
        reason: observed.reason,
        lockReleased: observed.lockReleased,
      });
    if (!publication.needsWrite)
      return Object.freeze({
        status: "completed" as const,
        reason: "coordinator_state_snapshot_confirmed",
        revision: observed.value.snapshot.revision,
        payloadSha256: observed.value.payloadSha256,
        snapshotConfirmed: true,
        lockReleased: true,
        filesystemEffectIssued: false,
        deliveryPending: publication.deliveryPending,
      });
    context = Object.freeze({});
    const key = context;
    const binding = {
      kind: "current_delivery" as const,
      repository,
      recoveryId,
      before: Buffer.from(publication.before),
      candidate: Buffer.from(publication.candidate),
      historyFile:
        publication.historyFile === null
          ? null
          : {
              bytes: Buffer.from(publication.historyFile.bytes),
              identity: publication.historyFile.identity,
            },
      assertOwner: (expectedHistoryRetentionDays?: number) =>
        active &&
        settlements.get(key) === binding &&
        binding.used &&
        assertOwner() === true &&
        repository.revalidate(expectedHistoryRetentionDays),
      used: false,
    };
    settlements.set(key, binding);
    const saved = writeCoordinatorStateSnapshot(
      null,
      { ...repository, revalidate: binding.assertOwner },
      binding.candidate,
      {
        recoveryId,
        cleanupStatus: null,
        dockerTerminal: null,
        currentDelivery: key,
      },
    );
    return Object.freeze({
      ...saved,
      deliveryPending:
        saved.status === "completed" &&
        saved.snapshotConfirmed &&
        saved.lockReleased &&
        publication.deliveryPending,
    });
  } catch {
    return refused;
  } finally {
    active = false;
    if (context) settlements.delete(context);
  }
}

const historyAttempts = new WeakMap<
  object,
  Map<
    string,
    {
      lineSha256: string;
      issued: boolean;
      pending: null | {
        before: Buffer;
        after: Buffer;
        beforeIdentity: StableFileIdentity | null;
        stateCandidate: Buffer;
        retentionDays: number;
        now: string;
      };
    }
  >
>();

/**
 * 種別固定wrapperの終了候補を同じ物理Writerへ渡す。
 * @responsibility 私有Contextの寿命と保存対象を一回へ限定する。
 * @trace ARCH-000008
 * @input rootCapability、recoveryId、assertOwner、operationKind: 固定wrapperの結合。
 * @returns 保存・読戻し・排他終了の観測。
 * @precondition 種別は内部wrapperが固定する。
 * @postcondition Contextを返却後に破棄する。
 * @effect 既存completion Writerだけ。
 * @failure Reader・Owner・対象・候補不一致は拒否する。
 * @invariant Taskと修復の候補や履歴関数を混同しない。
 * @boundary 種別別呼出しと共通保存骨格。
 * @security 新Store・Lock・永続資格なし。
 * @concurrency 元版とFile実体は排他内でも再照合する。
 */
export function completeCoordinatorCurrentRecovery(
  rootCapability: unknown,
  recoveryId: unknown,
  assertOwner: unknown,
  operationKind: "docker_task" | "runtime_repair",
) {
  const refused = writeCoordinatorStateSnapshot(null, null, null, null);
  let context: object | null = null;
  try {
    if (typeof assertOwner !== "function" || assertOwner() !== true)
      return refused;
    const repository = observeRuntimeRecoveryRepository(rootCapability);
    const observed = (
      operationKind === "runtime_repair"
        ? readRuntimeOwnedCoordinatorRepairCompletionSnapshot
        : readRuntimeOwnedCoordinatorCurrentCompletionSnapshot
    )(rootCapability, recoveryId);
    const publication = observed.currentCompletionPublication;
    const target = observed.value?.snapshot.operations.find(
      (item) => item.kind === operationKind && item.recoveryId === recoveryId,
    );
    if (observed.status !== "completed" || !observed.lockReleased)
      return Object.freeze({
        ...refused,
        reason: observed.reason,
        lockReleased: observed.lockReleased,
      });
    if (
      !repository ||
      !publication ||
      !target ||
      typeof recoveryId !== "string" ||
      assertOwner() !== true
    )
      return refused;
    const identity = JSON.parse(target.identityJson);
    if (
      operationKind === "docker_task" &&
      coordinatorConsumerCompletionPolicy(identity.consumer) !== "transient"
    )
      return refused;
    context = Object.freeze({});
    const bound = Object.freeze({
      ...repository,
      operationId: identity.operationId,
    });
    settlements.set(context, {
      kind: "current_completion",
      operationKind,
      repository: bound,
      recoveryId,
      before: Buffer.from(publication.before),
      candidate: Buffer.from(publication.candidate),
      historyFile: publication.historyFile,
      assertOwner: assertOwner as () => boolean,
      used: false,
    });
    return writeCoordinatorStateSnapshot(null, bound, publication.candidate, {
      recoveryId,
      cleanupStatus: null,
      dockerTerminal: null,
      currentCompletion: context,
    });
  } catch {
    return refused;
  } finally {
    if (context) settlements.delete(context);
  }
}

/**
 * 取得済みOwnerでTask区画を既存の物理Writerへ渡す。
 * @responsibility 業務候補の固定・初期作成・同版再入場と単一CASを接続する。
 * @trace ARCH-000004、ARCH-000008
 * @input owner: 真正保存Owner、viewValue: 業務View、expectedRevision: 元保存改訂、factsValue: 明示結果事実。
 * @returns 保存確認と保持中Ownerを区別した結果。
 * @precondition 呼出し側が同Owner内で業務遷移・Lease・履歴を照合している。
 * @postcondition 既存の固定I/Oだけを利用し、内部で排他を解放しない。
 * @effect 新品の明示初期化又は既存stateのpending・rename・読戻し。
 * @failure 不正候補・元版差・保存不明は同じ記録を保持する。
 * @invariant 第三Writer・旧形式変換・自動再実行を追加しない。
 * @boundary 業務処理から単一物理Writer。
 * @security 任意Path・偽Owner・外部callbackを受け付けない。
 * @concurrency 呼出し元が外側の一回解放を所有する。
 */
export function writeCoordinatorStorageTaskSnapshotOwned(
  owner: unknown,
  viewValue: unknown,
  expectedRevision: number,
  factsValue: unknown = [],
) {
  let filesystemEffectIssued = false;
  const rejected = (reason: string) =>
    Object.freeze({
      status: "blocked" as const,
      reason,
      filesystemEffectIssued,
      snapshotConfirmed: false,
      lockReleased: false,
      ownerHeld: true as const,
      value: null as CoordinatorSnapshot | null,
    });
  const binding =
    owner && typeof owner === "object"
      ? readCoordinatorStorageOwnerBinding(owner)
      : null;
  if (!binding || !isLiveCoordinatorStorageOwner(owner))
    return rejected("coordinator_state_owner_invalid");
  const issued = owner as CoordinatorStorageOwner;
  try {
    const view: unknown = JSON.parse(encodeRuntimeStateValue(viewValue));
    const facts: unknown = JSON.parse(encodeRuntimeStateValue(factsValue));
    if (
      !view ||
      typeof view !== "object" ||
      !validCoordinatorSnapshot(
        view,
        String((view as Record<string, unknown>).repositoryBindingId),
        issued.repositoryRootHash,
      ) ||
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      view.snapshotRevision !== expectedRevision + 1 ||
      !Array.isArray(facts) ||
      !facts.every(
        (fact, index) =>
          fact &&
          typeof fact === "object" &&
          JSON.stringify(Object.keys(fact).sort()) ===
            JSON.stringify(
              [
                "projectId",
                "taskId",
                "attemptId",
                "operationId",
                "recoveryUnresolved",
              ].sort(),
            ) &&
          typeof fact.recoveryUnresolved === "boolean" &&
          !facts
            .slice(0, index)
            .some(
              (prior) =>
                prior.projectId === fact.projectId &&
                prior.taskId === fact.taskId,
            ) &&
          view.projects.some(
            (project) =>
              project.projectId === fact.projectId &&
              project.tasks.some(
                (task) =>
                  task.definition.id === fact.taskId &&
                  task.attemptId !== null &&
                  task.attemptId === fact.attemptId &&
                  task.operationId !== null &&
                  task.operationId === fact.operationId,
              ),
          ),
      )
    )
      return rejected("coordinator_task_publication_input_invalid");
    const observed = readCoordinatorStorageSnapshotOwned(owner, true);
    let before: Buffer | null = null,
      initialBoundary: string | null = null;
    let bytes: Buffer | null = null;
    if (observed.status === "completed" && observed.value) {
      before = Buffer.from(
        `${encodeRuntimeStateValue(observed.value.snapshot)}\n`,
      );
      const currentTask = decodeRuntimeDomainSnapshot(
        before,
        issued.repositoryBinding,
      );
      if (!currentTask)
        return rejected("coordinator_task_publication_input_invalid");
      if (
        observed.value.snapshot.revision === view.snapshotRevision &&
        encodeRuntimeStateValue(
          projectCoordinatorTaskSnapshot(
            currentTask,
            issued.repositoryRootHash,
          ),
        ) === encodeRuntimeStateValue(view)
      )
        bytes = before;
      else if (observed.value.snapshot.revision === expectedRevision)
        bytes = prepareCoordinatorUnifiedTaskSections(
          before,
          view,
          issued.repositoryBinding,
          issued.repositoryRootHash,
          facts,
        );
    } else if (
      observed.reason === "coordinator_state_uninitialized" &&
      expectedRevision === 0 &&
      Object.values(view)
        .filter(Array.isArray)
        .every((values) => values.length === 0) &&
      facts.length === 0
    ) {
      const verified = getRepository(issued.repositoryRoot);
      if (
        verified.status !== "completed" ||
        !isLiveCoordinatorStorageOwner(owner)
      )
        return rejected("coordinator_state_owner_invalid");
      const {
        schema: _schema,
        schemaRevision: _schemaRevision,
        snapshotRevision: _revision,
        repositoryRootHash: _hash,
        ...sections
      } = view;
      bytes = Buffer.from(
        `${encodeRuntimeStateValue({
          ...sections,
          schema: COORDINATOR_STATE_SCHEMA,
          revision: 1,
          previous: null,
          repositoryBinding: issued.repositoryBinding,
          operations: [],
          unresolvedRecoveries: [],
          pendingDeliveries: [],
          resultReceipts: [],
          managedExecutions: [],
        })}\n`,
      );
      if (!decodeRuntimeDomainSnapshot(bytes, issued.repositoryBinding))
        return rejected("coordinator_task_publication_input_invalid");
      assertRuntimeStateInitializationBoundary(verified.capability);
      filesystemEffectIssued = true;
      const temporary = requireReadyRepositoryRuntimeDataArea(
        ensureRepositoryRuntimeDataArea(verified.capability, "tmp"),
        "coordinator_state_initialization_unconfirmed",
      );
      if (
        temporary?.status !== "ready" ||
        !isLiveCoordinatorStorageOwner(owner)
      )
        return rejected("coordinator_state_initialization_unconfirmed");
      const created = createCoordinatorRuntimeDataArea(verified.capability);
      filesystemEffectIssued ||= created.effectIssued;
      if (created.status !== "created")
        return rejected("coordinator_state_initialization_unconfirmed");
      initialBoundary = created.observation.boundaryIdentity;
    }
    const candidate = bytes
      ? decodeRuntimeDomainSnapshot(bytes, issued.repositoryBinding)
      : null;
    if (!bytes || !candidate)
      return rejected("coordinator_task_publication_revision_conflict");
    const result = commitCoordinatorStateSnapshotOwned({
      repository: binding.repository,
      candidate,
      bytes: Buffer.from(bytes),
      settlement: null,
      unissued: undefined,
      hostCleanupPublication: undefined,
      managementCapability: null,
      currentRepair: null,
      currentAuthenticationClosure: null,
      initializationOwner: owner,
      currentHistory: null,
      currentDelivery: null,
      currentCompletion: null,
      attempt: {
        revision: candidate.snapshot.revision,
        payloadSha256: candidate.payloadSha256,
        recoveryIds: Object.freeze(
          candidate.snapshot.operations.map((o) => o.recoveryId),
        ),
      },
      storageOwner: issued,
      lock: binding.lock,
      taskPublication: {
        before,
        view,
        facts,
        rootHash: issued.repositoryRootHash,
        initialBoundary,
      },
    });
    filesystemEffectIssued ||= result.filesystemEffectIssued;
    if (!result.snapshotConfirmed || !isLiveCoordinatorStorageOwner(owner))
      return rejected(result.reason);
    return Object.freeze({
      status: "completed" as const,
      reason: result.reason,
      filesystemEffectIssued,
      snapshotConfirmed: true,
      ownerHeld: true as const,
      lockReleased: false,
      value: view,
    });
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError) throw error;
    return rejected("coordinator_task_publication_unconfirmed");
  }
}

/**
 * 新規Coordinator領域の初回保存を一つの本文へ結合する。
 * @responsibility 領域の排他的作成と同じOwner・本文の初期化証拠を所有する。
 * @trace ARCH-000008
 * @input managementCapability: 現在Owner、candidateBytes: 初回Snapshot本文。
 * @returns 準備結果、Effect情報と排他終了結果。
 * @precondition .crdd親は既存Ownerが正常作成済み。
 * @postcondition 既存の空領域を再利用しない。
 * @effect Runtime Data Ownerを通して新品coordinator領域だけを作成する。
 * @failure 既存領域、不一致、観測不能、解放失敗では停止する。
 * @invariant 失敗後の証拠を別本文へ転用せず、公開後は初回作成に使わない。
 * @boundary 操作Owner、Runtime Dataの領域作成と現在状態Writer。
 * @security 証拠は内部WeakMapだけに保持し、AuthorityやPathを公開しない。
 * @concurrency 同じCoordinator保存用の短期排他を用いる。
 */
export function prepareRuntimeOwnedCoordinatorStateInitialization(
  managementCapability: unknown,
  candidateBytes: unknown,
) {
  const repository = observeRuntimeExecutionRepository(managementCapability);
  return prepareCoordinatorStateInitialization(
    managementCapability,
    repository,
    candidateBytes,
  );
}

/**
 * 現在呼出しの種別へ結合した初期本文を準備する。
 * @responsibility Taskと修復の資格を混同せず同じ領域作成・排他を再利用する。
 * @trace ARCH-000008
 * @input managementCapability: 私有の初期化Owner、repository: 検証済み結合、candidateBytes: 固定本文。
 * @returns 新規領域作成・準備・解放の観測。
 * @precondition 公開内部wrapperが種別別の真正Ownerを結合済み。
 * @postcondition 既存の空領域を初期化資格にしない。
 * @effect 既存Domain Ownerを通した固定領域作成だけ。
 * @failure Root・本文・Owner・解放不明は停止。
 * @invariant Task管理Capabilityを修復用に偽造しない。
 * @boundary 種別別保存Ownerと共通初期化I/O。
 * @security Repository借用だけで呼べる公開APIにしない。
 * @concurrency 既存の短期Kernel排他下で領域を作成する。
 */
function prepareCoordinatorStateInitialization(
  managementCapability: unknown,
  repository:
    | (Pick<
        NonNullable<ReturnType<typeof observeRuntimeExecutionRepository>>,
        "repositoryRoot" | "repositoryBinding" | "revalidate"
      > & { operationId?: string })
    | null,
  candidateBytes: unknown,
) {
  const initializationOwner =
    managementCapability &&
    typeof managementCapability === "object" &&
    settlements.get(managementCapability)?.kind === "runtime_repair"
      ? managementCapability
      : runtimeStorageOperationIdentity(managementCapability);
  const candidate = repository
    ? decodeRuntimeDomainSnapshot(candidateBytes, repository.repositoryBinding)
    : null;
  if (
    !repository ||
    !candidate ||
    !managementCapability ||
    typeof managementCapability !== "object" ||
    !initializationOwner ||
    !validateCoordinatorStateTransition(
      null,
      candidateBytes,
      repository.repositoryBinding,
    ) ||
    initializations.has(initializationOwner) ||
    candidate.snapshot.operations.some(
      (operation) =>
        JSON.parse(operation.identityJson).operationId !==
        repository.operationId,
    ) ||
    [
      ...candidate.snapshot.unresolvedRecoveries,
      ...candidate.snapshot.pendingDeliveries,
    ].some((item) => {
      const operation = candidate.snapshot.operations.find(
        (value): value is CoordinatorStateTaskOperation =>
          value.kind === "docker_task" && value.recoveryId === item.recoveryId,
      );
      return (
        !operation ||
        JSON.parse(operation.identityJson).operationId !==
          repository.operationId
      );
    })
  )
    return Object.freeze({
      status: "blocked",
      effectIssued: false,
      lockReleased: true,
    });
  const acquisition = acquireCoordinatorStorageOwnerForRepository(repository);
  const storageOwner =
    acquisition.status === "completed" ? acquisition.value : null;
  const lock = storageOwner
    ? readCoordinatorStorageOwnerBinding(storageOwner)?.lock
    : null;
  if (!storageOwner || !lock)
    return Object.freeze({
      status: "blocked",
      effectIssued: false,
      lockReleased: false,
    });
  let effectIssued = false;
  let isPrepared = false;
  try {
    const verified = getRepository(repository.repositoryRoot);
    if (
      verified.status !== "completed" ||
      !repository.revalidate() ||
      !lock.assertLive()
    )
      throw new Error("owner");
    const created = createCoordinatorRuntimeDataArea(verified.capability);
    effectIssued = created.effectIssued;
    if (
      created.status !== "created" ||
      !repository.revalidate() ||
      !lock.assertLive()
    )
      throw new Error("created");
    initializations.set(initializationOwner, {
      repositoryBinding: repository.repositoryBinding,
      boundaryIdentity: created.observation.boundaryIdentity,
      payloadSha256: candidate.payloadSha256,
      publicationIssued: false,
    });
    isPrepared = true;
  } catch {
    isPrepared = false;
  }
  let lockReleased = false;
  try {
    lockReleased = storageOwner.release();
  } catch {
    lockReleased = false;
  }
  if (!lockReleased) initializations.delete(initializationOwner);
  return Object.freeze({
    status: isPrepared && lockReleased ? "prepared" : "blocked",
    effectIssued,
    lockReleased,
  });
}

/**
 * 最新現在状態の保存と同じpendingへの再入場を処置する。
 * @responsibility 保存確定と排他終了を別結果で返し、部分成功を隠さない。
 * @trace ARCH-000008
 * @input managementCapability: 現在操作Owner、candidateBytes: 次Snapshotの正規本文。
 * @returns status、保存確認、排他終了、Effect発行、試行版とHash、exact回復参照。
 * @precondition 操作OwnerとRepository結合を確認済み。
 * @postcondition 失敗・観測不能を成功や不存在にしない。
 * @effect 固定state.lock/pending/stateの作成・置換・短命物回収だけ。
 * @failure 不一致やI/O失敗は例外で上位へ返す。
 * @invariant 本番Producerの全面切替やHost回収成立をこの保存だけから主張しない。
 * @boundary Coordinator現在状態とFilesystem。
 * @security 任意Pathや過去JSONから保存先を選択しない。
 * @concurrency 同じRepositoryの短期排他下で処置する。
 */
export function writeRuntimeOwnedCoordinatorStateSnapshot(
  managementCapability: unknown,
  candidateBytes: unknown,
) {
  return writeCoordinatorStateSnapshot(
    managementCapability,
    observeRuntimeExecutionRepository(managementCapability),
    candidateBytes,
    null,
  );
}

/**
 * 現在Ownerがexact修復の短命出版だけを既存Writerへ結合する。
 * @responsibility 旧初期化Ownerを復元せず、保存途中の同じ本文だけを確定する。
 * @trace ARCH-000008
 * @input rootCapability: 検証Root、recoveryId: exact参照、assertInvocation: 現在呼出し確認。
 * @returns no_pending、または保存・Effect・排他確認を分離したWriter結果。
 * @precondition 明示修復入口内だけから呼び、技術再開は別に確認する。
 * @postcondition 観測不明をpending不存在へ変更しない。
 * @effect 固定保存物の読取り、既存Kernel排他、同じpendingの出版／回収だけ。
 * @failure 不正・実体差・Owner失効・解放不明は停止し再試行しない。
 * @invariant 通常初期化の新品証明・WeakMapを変更しない。
 * @boundary 修復compositionと現在Repositoryの保存途中材料。
 * @security 任意Path・候補本文・初期化許可boolを受け取らない。
 * @concurrency 読取りとWriterの両排他下で実体・全文を再照合する。
 */
export function resumeRuntimeOwnedCoordinatorRepairPublication(
  rootCapability: unknown,
  recoveryId: string,
  assertInvocation: () => unknown,
) {
  const refused = () => writeCoordinatorStateSnapshot(null, null, null, null);
  const repository = observeRuntimeRecoveryRepository(rootCapability);
  /**
   * metadata出版の現在Ownerだけを再確認する。
   * @responsibility 取消と保存Ownerを分離する。
   * @trace ARCH-000008
   * @input N/A: 現在Rootと同期確認を捕捉済み。
   * @returns 両方が同期trueの場合だけtrue。
   * @precondition 内部明示修復呼出し。
   * @postcondition JSONから旧Ownerを復元しない。
   * @effect Root／Revision観測と同期確認。
   * @failure 非同期・Proxy・例外・失効はfalse。
   * @invariant 出版許可は技術処置許可ではない。
   * @boundary 呼出しと保存Owner。
   * @security 未信頼thenableを実行しない。
   * @concurrency 同期確認。
   */
  const assertOwner = () => {
    try {
      if (
        !repository ||
        typeof assertInvocation !== "function" ||
        types.isProxy(assertInvocation) ||
        types.isAsyncFunction(assertInvocation)
      )
        return false;
      const value = assertInvocation();
      if (types.isPromise(value))
        void Promise.prototype.then.call(
          value,
          () => undefined,
          () => undefined,
        );
      return value === true && repository.revalidate();
    } catch {
      return false;
    }
  };
  if (!assertOwner() || !repository) return refused();
  const acquisition = acquireRuntimeStateLock(
    repository.repositoryBinding,
    repository.repositoryRoot,
  );
  if (acquisition.status !== "acquired")
    return {
      ...refused(),
      reason: storageLockFailure(acquisition).reason,
      lockReleased: false,
    };
  const lock = acquisition.lock;
  let files: Map<string, ReturnType<typeof readStableFileSnapshot>> | null =
    null;
  let boundaryIdentity: string | null = null;
  let publication: ReturnType<typeof classifyCoordinatorRepairPublication> =
    null;
  let noPending = false;
  let lockReleased = false;
  try {
    const verified = getRepository(repository.repositoryRoot);
    if (verified.status !== "completed" || !assertOwner() || !lock.assertLive())
      throw new Error("owner");
    const area = observeRepositoryRuntimeDataArea(
      verified.capability,
      "domain-model",
    );
    if (
      area.status !== "ready" ||
      area.repositoryRoot !== repository.repositoryRoot
    )
      throw new Error("area");
    boundaryIdentity = area.boundaryIdentity;
    const names = fs.readdirSync(area.directory).sort();
    if (
      names.some(
        (name) =>
          ![
            "state.json",
            "state.pending.json",
            "state.lock",
            "history.jsonl",
          ].includes(name),
      )
    )
      throw new Error("names");
    files = new Map();
    for (const name of names) {
      const file = path.join(area.directory, name);
      const stat = fs.lstatSync(file, { bigint: true });
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n)
        throw new Error("file");
      const value = readStableFileSnapshot(file);
      if (!sameStableFileIdentity(value.identity, stat))
        throw new Error("changed");
      files.set(name, value);
    }
    const current = files.get("state.json")?.bytes ?? null;
    const pending = files.get("state.pending.json")?.bytes ?? null;
    if (
      current &&
      !decodeRuntimeDomainSnapshot(current, repository.repositoryBinding)
    )
      throw new Error("current");
    const history = files.get("history.jsonl");
    if (history && !decodeCoordinatorHistoryRows(history.bytes))
      throw new Error("history");
    const marker = files.get("state.lock")?.bytes ?? null;
    const expectedMarker = Buffer.from(
      `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: repository.repositoryBinding })}\n`,
    );
    if (marker && !marker.equals(expectedMarker)) throw new Error("marker");
    if (pending) {
      if (!marker) throw new Error("marker_absent");
      publication = classifyCoordinatorRepairPublication(
        current,
        pending,
        recoveryId,
        repository.repositoryBinding,
      );
      if (
        !publication ||
        (publication.mode === "initial_publication" &&
          names.join("|") !== "state.lock|state.pending.json")
      )
        throw new Error("publication");
    } else {
      if (!current) throw new Error("current_absent");
      noPending = true;
    }
    for (const [name, previous] of files) {
      const file = path.join(area.directory, name);
      const value = readStableFileSnapshot(file);
      if (
        !sameStableFileIdentity(previous.identity, value.identity) ||
        !previous.bytes.equals(value.bytes) ||
        fs.lstatSync(file, { bigint: true }).nlink !== 1n
      )
        throw new Error("changed");
    }
    const final = observeRepositoryRuntimeDataArea(
      verified.capability,
      "domain-model",
    );
    if (
      !assertOwner() ||
      !lock.assertLive() ||
      final.status !== "ready" ||
      final.boundaryIdentity !== boundaryIdentity ||
      JSON.stringify(fs.readdirSync(area.directory).sort()) !==
        JSON.stringify(names)
    )
      throw new Error("changed");
  } catch {
    files = null;
    publication = null;
    noPending = false;
  } finally {
    try {
      lockReleased = lock.release();
    } catch {
      lockReleased = false;
    }
  }
  if (!files || !boundaryIdentity || !lockReleased || !assertOwner())
    return { ...refused(), lockReleased };
  if (noPending)
    return {
      status: "no_pending" as const,
      snapshotConfirmed: false,
      filesystemEffectIssued: false,
      lockReleased: true,
    };
  if (!publication) return refused();
  const target = decodeRuntimeDomainSnapshot(
    publication.candidate,
    repository.repositoryBinding,
  )?.snapshot.operations.find((item) => item.recoveryId === recoveryId);
  if (target?.kind !== "runtime_repair") return refused();
  const context = Object.freeze({});
  const bound = Object.freeze({
    ...repository,
    operationId: JSON.parse(target.identityJson).operationId as string,
    revalidate: assertOwner,
  });
  settlements.set(context, {
    kind: "runtime_repair",
    purpose:
      publication.mode === "initial_publication" ||
      publication.mode === "identity" ||
      publication.mode === "remove_pending"
        ? "checkpoint"
        : publication.mode,
    repository: bound,
    recoveryId,
    before: publication.before,
    candidate: publication.candidate,
    assertOwner,
    used: false,
    publication: { boundaryIdentity, files },
  });
  try {
    return writeCoordinatorStateSnapshot(
      null,
      bound,
      publication.candidate,
      null,
      undefined,
      undefined,
      context,
    );
  } finally {
    settlements.delete(context);
  }
}

/**
 * 明示修復呼出しの一保存を同じ物理Writerへ結合する。
 * @responsibility Root借用に加えて呼出しOwner・exact対象・元版を私有Contextへ固定する。
 * @trace ARCH-000008
 * @input rootCapability: 検証Root、recoveryId: exact修復、before: 元版、candidateBytes: 次版、assertInvocation: 同じ呼出しの現在確認、purpose: 通常更新または新Session準備。
 * @returns 既存Writerの保存確認・解放・Effectを分けた結果。
 * @precondition 内部の明示介入compositionがDIの準備・通知と呼出し生存を結合済み。
 * @postcondition Task管理Capabilityを要求せず、対象以外を変更しない。
 * @effect 初回の固定領域作成と既存状態Writerだけ。
 * @failure 偽Root、失効、別対象、元版差、不正遷移、保存不明は停止。
 * @invariant 保存JSON・主体Hashだけを実修復許可へ昇格しない。
 * @boundary 明示修復compositionと私有保存Context。
 * @security Package Rootから公開せず、任意Path／Task資格を受けない。
 * @concurrency 同期の一保存へ限定し、物理I/Oは既存Kernel排他を使う。
 */
export function writeRuntimeOwnedCoordinatorRepairSnapshot(
  rootCapability: unknown,
  recoveryId: string,
  before: Buffer | null,
  candidateBytes: Buffer,
  assertInvocation: () => unknown,
  purpose: RepairWritePurpose,
) {
  const blocked = () => writeCoordinatorStateSnapshot(null, null, null, null);
  let initializationEffectIssued = false;
  try {
    if (
      typeof assertInvocation !== "function" ||
      types.isAsyncFunction(assertInvocation) ||
      ![
        "checkpoint",
        "session_begin",
        "retention_handoff",
        "disposal_decision",
        "disposal_primary",
        "disposal_failed",
        "disposal_auxiliary",
      ].includes(purpose)
    )
      return blocked();
    const repository = observeRuntimeRecoveryRepository(rootCapability);
    if (!repository) return blocked();
    /**
     * 同じ修復呼出しとRootだけを再確認する。
     * @responsibility 非同期値と例外を保存資格にしない。
     * @trace ARCH-000008
     * @input N/A: 捕捉した呼出し確認と検証Root。
     * @returns 同期trueかつRoot再確認成功だけtrue。
     * @precondition 明示介入composition内でだけ有効。
     * @postcondition Native生存や修復成功を代わりに判定しない。
     * @effect Root・Revision読取りと用途固定の呼出し確認。
     * @failure false・例外・Promiseはfalse。
     * @invariant 取消後の事実記録と新技術Effectの許可を区別する。
     * @boundary 修復呼出しと状態保存。
     * @security 任意のthenableを実行しない。
     * @concurrency 同期確認のみ。
     */
    const assertOwner = () => {
      try {
        const result = assertInvocation();
        if (types.isPromise(result))
          void Promise.prototype.then.call(
            result,
            () => undefined,
            () => undefined,
          );
        return result === true && repository.revalidate();
      } catch {
        return false;
      }
    };
    if (!assertOwner() || (before !== null && !Buffer.isBuffer(before)))
      return blocked();
    const candidate = decodeRuntimeDomainSnapshot(
      candidateBytes,
      repository.repositoryBinding,
    );
    const previous =
      before === null
        ? null
        : decodeRuntimeDomainSnapshot(before, repository.repositoryBinding);
    const target = candidate?.snapshot.operations.find(
      (operation) =>
        operation.kind === "runtime_repair" &&
        operation.recoveryId === recoveryId,
    );
    const previousTarget = previous?.snapshot.operations.find(
      (operation) => operation.recoveryId === recoveryId,
    );
    if (
      !candidate ||
      !target ||
      target.summarySha256 !== (previousTarget?.summarySha256 ?? null) ||
      encodeRuntimeStateValue(target.history) !==
        encodeRuntimeStateValue(previousTarget?.history ?? null) ||
      (before !== null && !previous) ||
      encodeRuntimeStateValue(
        previous?.snapshot.operations.filter(
          (operation) => operation.recoveryId !== recoveryId,
        ) ?? [],
      ) !==
        encodeRuntimeStateValue(
          candidate.snapshot.operations.filter(
            (operation) => operation.recoveryId !== recoveryId,
          ),
        ) ||
      encodeRuntimeStateValue(previous?.snapshot.unresolvedRecoveries ?? []) !==
        encodeRuntimeStateValue(candidate.snapshot.unresolvedRecoveries) ||
      encodeRuntimeStateValue(previous?.snapshot.pendingDeliveries ?? []) !==
        encodeRuntimeStateValue(candidate.snapshot.pendingDeliveries) ||
      !validateRepairWriteCandidate(
        before,
        candidateBytes,
        recoveryId,
        purpose,
        repository.repositoryBinding,
      )
    )
      return blocked();
    const operationId = JSON.parse(target.identityJson).operationId as string;
    const bound = Object.freeze({
      ...repository,
      operationId,
      revalidate: assertOwner,
    });
    if (
      ["disposal_primary", "disposal_failed", "disposal_auxiliary"].includes(
        purpose,
      ) &&
      before !== null &&
      candidateBytes.equals(before)
    ) {
      // Reader自身のKernel内で同値を再観測する。物理Writer／marker生成へ入らない。
      const observed = readCoordinatorStateSnapshot(bound, null);
      const confirmed =
        observed.status === "completed" &&
        observed.value !== null &&
        observed.lockReleased &&
        observed.value.payloadSha256 === previous?.payloadSha256 &&
        Buffer.from(
          `${encodeRuntimeStateValue(observed.value.snapshot)}\n`,
        ).equals(before) &&
        observed.value.snapshot.operations.filter(
          (item) =>
            item.kind === "runtime_repair" && item.recoveryId === recoveryId,
        ).length === 1 &&
        assertOwner();
      return Object.freeze({
        revision: candidate.snapshot.revision,
        payloadSha256: candidate.payloadSha256,
        recoveryIds: Object.freeze(
          candidate.snapshot.operations.map((item) => item.recoveryId),
        ),
        status: confirmed ? "completed" : "blocked",
        reason: confirmed
          ? "coordinator_state_snapshot_confirmed"
          : "coordinator_state_read_unconfirmed",
        snapshotConfirmed: confirmed,
        filesystemEffectIssued: false,
        lockReleased: observed.lockReleased,
      });
    }
    const context = Object.freeze({});
    settlements.set(context, {
      kind: "runtime_repair",
      purpose,
      repository: bound,
      recoveryId,
      before: before === null ? null : Buffer.from(before),
      candidate: Buffer.from(candidateBytes),
      assertOwner,
      used: false,
    });
    try {
      if (before === null) {
        const initialized = prepareCoordinatorStateInitialization(
          context,
          bound,
          candidateBytes,
        );
        initializationEffectIssued ||= initialized.effectIssued;
        if (initialized.status !== "prepared" || !initialized.lockReleased) {
          return Object.freeze({
            ...blocked(),
            reason: "coordinator_state_initialization_unconfirmed",
            filesystemEffectIssued: initializationEffectIssued,
            lockReleased: initialized.lockReleased,
          });
        }
      }
      const saved = writeCoordinatorStateSnapshot(
        null,
        bound,
        candidateBytes,
        null,
        undefined,
        undefined,
        context,
      );
      return Object.freeze({
        ...saved,
        filesystemEffectIssued:
          initializationEffectIssued || saved.filesystemEffectIssued,
      });
    } finally {
      settlements.delete(context);
      initializations.delete(context);
    }
  } catch {
    return Object.freeze({
      ...blocked(),
      filesystemEffectIssued: initializationEffectIssued,
    });
  }
}

/**
 * 通常保存と終端限定保存の候補・用途・短期排他を準備する。
 * @responsibility 検証済み結合、限定差分と元版を固定し、取得済み排他をOwned確定へ渡す。
 * @trace ARCH-000008
 * @input managementCapability: 通常初期化Ownerまたはnull、repository: 検証済み借用、candidateBytes: 次本文、settlement: 終端制約またはnull。
 * @returns 取得前の停止結果、又は検証済み入力と取得済み排他の私有組。
 * @precondition 公開内部wrapperが借用を検証している。
 * @postcondition 終端経路から初期化・新要求・他操作変更を発行しない。
 * @effect 固定現在状態の読取りと既存短期排他の取得。候補の出版は行わない。
 * @failure 結合、差分、元版、保存または排他不明はblocked。
 * @invariant 旧形式fallbackと二重Writerを作らない。
 * @boundary Coordinator現在状態とFilesystem。
 * @security 任意PathやCaller supplied借用を受けない。
 * @concurrency 既存Repository単位排他を短期保持する。
 */
function prepareCoordinatorStateWrite(
  managementCapability: unknown,
  repository:
    | (Pick<
        NonNullable<ReturnType<typeof observeRuntimeExecutionRepository>>,
        "repositoryRoot" | "repositoryBinding" | "revalidate"
      > & { operationId?: string })
    | null,
  candidateBytes: unknown,
  settlement: {
    recoveryId: string;
    cleanupStatus: string | null;
    dockerTerminal: RuntimeTerminalStorageObservation | null;
    historyInitial?: true;
    historyPublish?: true;
    currentHistory?: object;
    currentDelivery?: object;
    currentCompletion?: object;
    deliveryRegistration?: unknown;
    consumer?: "coordinator_cli" | "orchestrator" | "workbench";
    completion?: { before: Buffer; candidate: Buffer };
    managementCapability?: unknown;
  } | null,
  unissued?: Readonly<{
    recoveryId: string;
    purpose: string;
  }>,
  hostCleanupPublication?: NonNullable<
    ReturnType<
      typeof readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot
    >["hostCleanupPublication"]
  >,
  repairContext?: object,
) {
  const repairBinding = repairContext ? settlements.get(repairContext) : null;
  const currentRepair =
    repairBinding?.kind === "runtime_repair" ? repairBinding : null;
  const currentAuthenticationClosure =
    repairBinding?.kind === "authentication_unknown_closure"
      ? repairBinding
      : null;
  const initializationOwner =
    repairContext ?? runtimeStorageOperationIdentity(managementCapability);
  const historyBinding = settlement?.currentHistory
    ? settlements.get(settlement.currentHistory)
    : null;
  const currentHistory =
    historyBinding?.kind === "current_history" ? historyBinding : null;
  const deliveryBinding = settlement?.currentDelivery
    ? settlements.get(settlement.currentDelivery)
    : null;
  const currentDelivery =
    deliveryBinding?.kind === "current_delivery" ? deliveryBinding : null;
  const completionBinding = settlement?.currentCompletion
    ? settlements.get(settlement.currentCompletion)
    : null;
  const currentCompletion =
    completionBinding?.kind === "current_completion" ? completionBinding : null;
  const candidate = repository
    ? decodeRuntimeDomainSnapshot(candidateBytes, repository.repositoryBinding)
    : null;
  const bytes = candidate
    ? Buffer.from(`${encodeRuntimeStateValue(candidate.snapshot)}\n`)
    : null;
  const attempt = {
    revision: candidate?.snapshot.revision ?? null,
    payloadSha256: candidate?.payloadSha256 ?? null,
    recoveryIds: Object.freeze(
      candidate?.snapshot.operations.map((operation) => operation.recoveryId) ??
        [],
    ),
  };
  if (
    !repository ||
    !candidate ||
    !bytes ||
    (repairContext &&
      ((!currentRepair && !currentAuthenticationClosure) ||
        currentRepair?.used ||
        currentAuthenticationClosure?.used ||
        settlement !== null)) ||
    (settlement?.currentHistory && (!currentHistory || currentHistory.used)) ||
    (settlement?.currentDelivery &&
      (!currentDelivery || currentDelivery.used)) ||
    (settlement?.currentCompletion &&
      (!currentCompletion || currentCompletion.used)) ||
    [currentHistory, currentDelivery, currentCompletion].filter(
      (value) => value !== null,
    ).length > 1
  )
    return Object.freeze({
      ...attempt,
      status: "blocked",
      reason: "coordinator_state_input_invalid",
      filesystemEffectIssued: false,
      snapshotConfirmed: false,
      lockReleased: true,
    });
  if (
    !currentAuthenticationClosure &&
    candidate.snapshot.operations.some(
      (operation) =>
        operation.kind === "docker_task" &&
        (operation.resources?.checkpoints ?? []).some(
          (resource) =>
            resource.submission === "intent_saved" &&
            resource.receiptSource === null &&
            resource.observation === "absent",
        ),
    )
  ) {
    // 私有pairは差分の基準であり保存資格ではない。元版・実体・Ownerは
    // 主Kernel内で必ず再検査する。一般入口だけは通常Readerを用いる。
    const fixedPairs = [
      currentHistory,
      currentDelivery,
      currentCompletion,
      currentRepair,
      settlement?.completion,
      hostCleanupPublication,
    ].filter((pair) => pair !== null && pair !== undefined);
    let previousSnapshot: CoordinatorStateSnapshot | null = null;
    let previousLockReleased = true;
    if (fixedPairs.length === 1) {
      const fixed = fixedPairs[0];
      if (fixed?.candidate.equals(bytes))
        previousSnapshot =
          decodeRuntimeDomainSnapshot(
            fixed.before,
            repository.repositoryBinding,
          )?.snapshot ?? null;
    } else if (fixedPairs.length === 0) {
      const previous = readCoordinatorStateSnapshot(repository, null);
      previousLockReleased = previous.lockReleased;
      if (previous.status === "completed" && previous.value)
        previousSnapshot = previous.value.snapshot;
    }
    if (
      !previousSnapshot ||
      !previousLockReleased ||
      authenticationUnknownAbsenceChanged(previousSnapshot, candidate.snapshot)
    )
      return Object.freeze({
        ...attempt,
        status: "blocked",
        reason: "coordinator_state_authentication_closure_owner_required",
        filesystemEffectIssued: false,
        snapshotConfirmed: false,
        lockReleased: previousLockReleased,
      });
  }
  const acquisition = acquireCoordinatorStorageOwnerForRepository(repository);
  const storageOwner =
    acquisition.status === "completed" ? acquisition.value : null;
  const lock = storageOwner
    ? readCoordinatorStorageOwnerBinding(storageOwner)?.lock
    : null;
  if (!storageOwner || !lock)
    return Object.freeze({
      ...attempt,
      status: "blocked",
      reason:
        acquisition.status === "blocked"
          ? acquisition.reason
          : "coordinator_state_lock_unavailable",
      filesystemEffectIssued: false,
      snapshotConfirmed: false,
      lockReleased: false,
    });
  return {
    repository,
    candidate,
    bytes,
    settlement,
    unissued,
    hostCleanupPublication,
    currentRepair,
    currentAuthenticationClosure,
    initializationOwner,
    currentHistory,
    currentDelivery,
    currentCompletion,
    attempt,
    storageOwner,
    lock,
    managementCapability,
  };
}

/**
 * 取得済み保存排他の中で候補を一箇所から物理確定する。
 * @responsibility 固定I/O、境界照合、pending、rename、読戻しを既存順で所有する。
 * @trace ARCH-000008
 * @input prepared: このModuleが検査・取得した私有準備結果。
 * @returns 保存Effect・本文確認・理由と履歴の確定値。排他解放は含めない。
 * @precondition 既存短期排他を保持し、呼出し側が解放を所有する。
 * @postcondition File確認と排他解放を別の事実として返す。
 * @effect 固定State・履歴Fileと短命Fileの既存I/O。
 * @failure 途中失敗は候補と元参照を保全し保存未確認を返す。
 * @invariant Contextの消費順と生存照合を変更しない。
 * @boundary 同じOwner内の保存確定。新Writerや同期層は作らない。
 * @security 私有準備結果・任意Path・外部callbackを公開しない。
 * @concurrency Lockを再取得・解放せず、保持中の固定I/Oだけを行う。
 */
function commitCoordinatorStateSnapshotOwned(
  prepared: Extract<
    ReturnType<typeof prepareCoordinatorStateWrite>,
    { lock: unknown }
  > & {
    corePublication?: Readonly<{
      before: Buffer;
      kind: Parameters<typeof prepareRuntimeDefinitionChange>[1];
      request: unknown;
      revision: string;
    }>;
    taskPublication?: Readonly<{
      before: Buffer | null;
      view: unknown;
      facts: readonly Record<string, unknown>[];
      rootHash: string;
      initialBoundary: string | null;
    }>;
  },
) {
  const {
    repository,
    candidate,
    bytes,
    settlement,
    unissued,
    hostCleanupPublication,
    currentRepair,
    currentAuthenticationClosure,
    initializationOwner,
    currentHistory,
    currentDelivery,
    currentCompletion,
    taskPublication,
    corePublication,
    lock,
  } = prepared;
  if (currentHistory) currentHistory.used = true;
  if (currentDelivery) currentDelivery.used = true;
  if (currentCompletion) currentCompletion.used = true;
  if (currentRepair) currentRepair.used = true;
  if (currentAuthenticationClosure) currentAuthenticationClosure.used = true;
  let filesystemEffectIssued = false;
  let snapshotConfirmed = false;
  let reason = "coordinator_state_storage_unconfirmed";
  let initialHistoryLine: string | null = null;
  let historyAlreadyConfirmed = false;
  try {
    const verified = getRepository(repository.repositoryRoot);
    if (verified.status !== "completed") throw new Error("root");
    const initial = observeRepositoryRuntimeDataArea(
      verified.capability,
      "domain-model",
    );
    if (
      initial.status !== "ready" ||
      initial.repositoryRoot !== repository.repositoryRoot
    )
      throw new Error("area");
    const directory = initial.directory;
    const fileIdentities = new Map<string, StableFileIdentity>();
    let initializationBoundaryRequired = false;
    /**
     * 保存I/Oの前後で同じ操作Ownerと領域を再確認する。
     * @responsibility Rootと.crddとcoordinator領域の置換を拒否する。
     * @trace ARCH-000008
     * @input N/A: 閉包のOwnerと固定境界。
     * @returns N/A: 一致しなければ例外。
     * @precondition 操作OwnerとRepository結合を確認済み。
     * @postcondition 失敗・観測不能を成功や不存在にしない。
     * @effect 現在Rootと領域metadataの読取り。
     * @failure 不一致やI/O失敗は例外で上位へ返す。
     * @invariant LockだけをRoot実体の証明にしない。
     * @boundary Coordinator現在状態とFilesystem。
     * @security 任意Pathや過去JSONから保存先を選択しない。
     * @concurrency 同じRepositoryの短期排他下で処置する。
     */
    const assertBoundary = () => {
      if (!repository.revalidate() || !lock.assertLive())
        throw new Error("owner");
      if (currentRepair && currentRepair.assertOwner() !== true)
        throw new Error("repair_owner");
      if (currentCompletion && currentCompletion.assertOwner() !== true)
        throw new Error("current_completion_owner");
      if (currentHistory && currentHistory.retentionDays !== null) {
        const configuration = readHistoryRetentionDays(repository);
        if (
          configuration === null ||
          configuration !== currentHistory.retentionDays
        )
          throw new Error("current_history_config_changed");
      }
      const fresh = getRepository(repository.repositoryRoot);
      if (fresh.status !== "completed") throw new Error("root");
      if (initializationBoundaryRequired)
        assertRuntimeStateInitializationBoundary(fresh.capability);
      const observed = observeRepositoryRuntimeDataArea(
        fresh.capability,
        "domain-model",
      );
      if (
        observed.status !== "ready" ||
        observed.directory !== directory ||
        observed.boundaryIdentity !== initial.boundaryIdentity
      )
        throw new Error("boundary");
    };
    /**
     * 固定Fileの明示不存在と安定本文を区別する。
     * @responsibility 通常File・nlink1・bounded本文と前後境界を照合する。
     * @trace ARCH-000008
     * @input name: 固定された保存File名。
     * @returns 安定byte列、または明示不存在のnull。
     * @precondition 操作OwnerとRepository結合を確認済み。
     * @postcondition 失敗・観測不能を成功や不存在にしない。
     * @effect 固定Fileの読取りだけ。
     * @failure 不一致やI/O失敗は例外で上位へ返す。
     * @invariant 観測不能や途中消失を不存在にしない。
     * @boundary Coordinator現在状態とFilesystem。
     * @security 任意Pathや過去JSONから保存先を選択しない。
     * @concurrency 同じRepositoryの短期排他下で処置する。
     */
    const read = (
      name:
        | "state.json"
        | "state.pending.json"
        | "state.lock"
        | "history.jsonl"
        | "history.pending.jsonl",
    ) => {
      return readRuntimeStateFile(
        directory,
        name,
        fileIdentities,
        assertBoundary,
      );
    };
    /**
     * 固定の短命Fileを排他的に作成してflushする。
     * @responsibility 既存File非上書きと保存途中の残存保持を所有する。
     * @trace ARCH-000008
     * @input name: pendingまたはlock、content: 確定本文。
     * @returns N/A: 作成とflushを実行する。
     * @precondition 操作OwnerとRepository結合を確認済み。
     * @postcondition 失敗・観測不能を成功や不存在にしない。
     * @effect 固定Fileのwx作成、書込み、fsync、close。
     * @failure 不一致やI/O失敗は例外で上位へ返す。
     * @invariant 失敗後にpendingを自動削除しない。
     * @boundary Coordinator現在状態とFilesystem。
     * @security 任意Pathや過去JSONから保存先を選択しない。
     * @concurrency 同じRepositoryの短期排他下で処置する。
     */
    const create = (
      name: "state.pending.json" | "state.lock" | "history.pending.jsonl",
      content: Buffer,
    ) => {
      createRuntimeStatePendingFile(
        directory,
        name,
        content,
        fileIdentities,
        assertBoundary,
        () => {
          filesystemEffectIssued = true;
        },
      );
    };
    assertBoundary();
    const names = fs.readdirSync(directory);
    if (
      names.some(
        (name) =>
          ![
            "state.json",
            "state.pending.json",
            "state.lock",
            "history.jsonl",
            "history.pending.jsonl",
          ].includes(name),
      )
    )
      throw new Error("unknown_content");
    const marker = Buffer.from(
      `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: repository.repositoryBinding })}\n`,
    );
    const oldMarker = read("state.lock");
    if (oldMarker !== null && !oldMarker.equals(marker))
      throw new Error("marker");
    let currentBytes = read("state.json");
    initializationBoundaryRequired = currentBytes === null;
    if (initializationBoundaryRequired) assertBoundary();
    let current =
      currentBytes === null
        ? null
        : decodeRuntimeDomainSnapshot(
            currentBytes,
            repository.repositoryBinding,
          );
    if (currentBytes !== null && !current) throw new Error("current");
    if (currentAuthenticationClosure) {
      const bound = currentAuthenticationClosure;
      const beforeTasks = current?.snapshot.operations.filter(
        (item) =>
          item.kind === "docker_task" && item.recoveryId === bound.recoveryId,
      );
      const candidateTasks = candidate.snapshot.operations.filter(
        (item) =>
          item.kind === "docker_task" && item.recoveryId === bound.recoveryId,
      );
      const expected = prepareCoordinatorAuthenticationUnknownClosureSnapshot(
        bound.before,
        bound.recoveryId,
        bound.observations,
        repository.repositoryBinding,
      );
      if (
        bound.repository.repositoryRoot !== repository.repositoryRoot ||
        bound.repository.repositoryBinding !== repository.repositoryBinding ||
        bound.repository.operationId !== repository.operationId ||
        beforeTasks?.length !== 1 ||
        candidateTasks.length !== 1 ||
        beforeTasks[0]?.identityJson !== candidateTasks[0]?.identityJson ||
        JSON.parse(beforeTasks[0]?.identityJson ?? "null")?.operationId !==
          repository.operationId ||
        JSON.parse(candidateTasks[0]?.identityJson ?? "null")?.operationId !==
          repository.operationId ||
        !currentBytes?.equals(bound.before) ||
        !bytes.equals(bound.candidate) ||
        !expected?.equals(bytes) ||
        bound.assertOwner() !== true
      )
        throw new Error("authentication_closure_context");
    } else if (
      authenticationUnknownAbsenceChanged(
        current?.snapshot ?? null,
        candidate.snapshot,
      )
    ) {
      throw new Error("authentication_closure_owner_required");
    }
    let repairPublication: ReturnType<
      typeof classifyCoordinatorRepairPublication
    > = null;
    if (currentRepair?.publication) {
      const observed = currentRepair.publication;
      if (
        initial.boundaryIdentity !== observed.boundaryIdentity ||
        JSON.stringify([...observed.files.keys()].sort()) !==
          JSON.stringify([...names].sort())
      )
        throw new Error("publication_boundary");
      for (const [name, previous] of observed.files) {
        const value = read(
          name as
            | "state.json"
            | "state.pending.json"
            | "state.lock"
            | "history.jsonl",
        );
        const identity = fileIdentities.get(name);
        if (
          !value?.equals(previous.bytes) ||
          !identity ||
          !sameStableFileIdentity(previous.identity, identity)
        )
          throw new Error("publication_file_changed");
      }
      const pending = read("state.pending.json");
      if (!pending || !oldMarker?.equals(marker))
        throw new Error("publication_missing");
      repairPublication = classifyCoordinatorRepairPublication(
        currentBytes,
        pending,
        currentRepair.recoveryId,
        repository.repositoryBinding,
      );
      if (
        !repairPublication?.candidate.equals(bytes) ||
        (!["initial_publication", "identity", "remove_pending"].includes(
          repairPublication.mode,
        ) &&
          repairPublication.mode !== currentRepair.purpose) ||
        (repairPublication.mode === "initial_publication" &&
          names.sort().join("|") !== "state.lock|state.pending.json")
      )
        throw new Error("publication_invalid");
    }
    if (currentRepair) {
      const target = candidate.snapshot.operations.find(
        (operation) => operation.recoveryId === currentRepair.recoveryId,
      );
      const beforeTarget = current?.snapshot.operations.find(
        (operation) => operation.recoveryId === currentRepair.recoveryId,
      );
      if (
        currentRepair.repository.repositoryRoot !== repository.repositoryRoot ||
        currentRepair.repository.repositoryBinding !==
          repository.repositoryBinding ||
        currentRepair.repository.operationId !== repository.operationId ||
        !bytes.equals(currentRepair.candidate) ||
        (currentRepair.before === null
          ? currentBytes !== null
          : !currentBytes?.equals(currentRepair.before)) ||
        target?.kind !== "runtime_repair" ||
        (beforeTarget && beforeTarget.kind !== "runtime_repair") ||
        target.summarySha256 !== (beforeTarget?.summarySha256 ?? null) ||
        encodeRuntimeStateValue(target.history) !==
          encodeRuntimeStateValue(beforeTarget?.history ?? null) ||
        JSON.parse(target.identityJson).operationId !==
          repository.operationId ||
        (beforeTarget && beforeTarget.identityJson !== target.identityJson) ||
        encodeRuntimeStateValue(
          current?.snapshot.operations.filter(
            (operation) => operation.recoveryId !== currentRepair.recoveryId,
          ) ?? [],
        ) !==
          encodeRuntimeStateValue(
            candidate.snapshot.operations.filter(
              (operation) => operation.recoveryId !== currentRepair.recoveryId,
            ),
          ) ||
        encodeRuntimeStateValue(
          current?.snapshot.unresolvedRecoveries ?? [],
        ) !==
          encodeRuntimeStateValue(candidate.snapshot.unresolvedRecoveries) ||
        encodeRuntimeStateValue(current?.snapshot.pendingDeliveries ?? []) !==
          encodeRuntimeStateValue(candidate.snapshot.pendingDeliveries) ||
        currentRepair.assertOwner() !== true
      )
        throw new Error("repair_writer_scope_invalid");
    }
    if (corePublication) {
      const expected = prepareRuntimeDefinitionChange(
        corePublication.before,
        corePublication.kind,
        corePublication.request,
        repository.repositoryBinding,
        corePublication.revision,
      );
      if (
        taskPublication ||
        settlement ||
        currentRepair ||
        currentHistory ||
        currentDelivery ||
        currentCompletion ||
        !currentBytes?.equals(corePublication.before) ||
        expected.status !== "prepared" ||
        !expected.bytes.equals(bytes) ||
        !validateCoordinatorUnifiedTransition(
          currentBytes,
          bytes,
          repository.repositoryBinding,
        )
      )
        throw new Error("core_publication_scope_invalid");
    }
    let completionConfirmed = false;
    let savedTerminalConfirmed = false;
    let repairHistoryScopeConfirmed = false;
    if (taskPublication) {
      const same = currentBytes?.equals(bytes) === true;
      const expected =
        same || taskPublication.before === null
          ? bytes
          : prepareCoordinatorUnifiedTaskSections(
              taskPublication.before,
              taskPublication.view,
              repository.repositoryBinding,
              taskPublication.rootHash,
              taskPublication.facts,
            );
      if (
        !expected?.equals(bytes) ||
        (!same &&
          (taskPublication.before === null
            ? currentBytes !== null ||
              taskPublication.initialBoundary !== initial.boundaryIdentity ||
              candidate.snapshot.operations.length !== 0 ||
              candidate.snapshot.projects.length !== 0 ||
              candidate.snapshot.queueEntries.length !== 0 ||
              candidate.snapshot.resultReceipts.length !== 0
            : !currentBytes?.equals(taskPublication.before))) ||
        (!same &&
          !validateCoordinatorUnifiedTransition(
            currentBytes,
            bytes,
            repository.repositoryBinding,
          ))
      )
        throw new Error("task_publication_scope_invalid");
      const taskDecoded = decodeRuntimeDomainSnapshot(
        bytes,
        repository.repositoryBinding,
      );
      if (!taskDecoded) throw new Error("task_publication_scope_invalid");
      const projected = projectCoordinatorTaskSnapshot(
        taskDecoded,
        taskPublication.rootHash,
      );
      if (
        encodeRuntimeStateValue(projected) !==
        encodeRuntimeStateValue(taskPublication.view)
      )
        throw new Error("task_publication_view_invalid");
      for (const fact of taskPublication.facts) {
        const task = candidate.snapshot.managedExecutions
          .find((p) => p.projectId === fact.projectId)
          ?.tasks.find(
            (t) =>
              t.taskId === fact.taskId &&
              t.attemptId === fact.attemptId &&
              t.operationId === fact.operationId,
          );
        if (
          !task ||
          (task.settlement.kind === "operations"
            ? task.settlement.resultUnresolved
            : task.settlement.kind === "executor_result"
              ? task.settlement.recoveryUnresolved
              : false) !== fact.recoveryUnresolved
        )
          throw new Error("task_result_fact_invalid");
      }
      for (const receipt of candidate.snapshot.resultReceipts) {
        if (
          current?.snapshot.resultReceipts.some(
            (r) => r.recoveryId === receipt.recoveryId,
          )
        )
          continue;
        const line = currentBytes
          ? prepareCoordinatorStateHistoryLine(
              currentBytes,
              receipt.recoveryId,
              repository.repositoryBinding,
            )
          : null;
        const rows = decodeCoordinatorHistoryRows(
          read("history.jsonl") ?? Buffer.alloc(0),
        );
        if (
          !line ||
          !rows?.some(
            (row) =>
              row.recoveryId === receipt.recoveryId &&
              Buffer.from(row.line).equals(line),
          )
        )
          throw new Error("task_receipt_history_unconfirmed");
      }
      completionConfirmed = true;
      savedTerminalConfirmed = true;
    }
    if (currentCompletion) {
      const history = read("history.jsonl"),
        expectedHistory = currentCompletion.historyFile;
      const historyIdentity = fileIdentities.get("history.jsonl") ?? null;
      if (
        !settlement ||
        currentCompletion.repository.repositoryRoot !==
          repository.repositoryRoot ||
        currentCompletion.repository.repositoryBinding !==
          repository.repositoryBinding ||
        currentCompletion.repository.operationId !== repository.operationId ||
        currentCompletion.recoveryId !== settlement.recoveryId ||
        !current ||
        !currentBytes?.equals(currentCompletion.before) ||
        !bytes.equals(currentCompletion.candidate) ||
        currentCompletion.assertOwner() !== true ||
        settlement.currentHistory ||
        settlement.currentDelivery ||
        settlement.completion ||
        settlement.historyInitial ||
        settlement.historyPublish ||
        settlement.deliveryRegistration !== undefined ||
        settlement.managementCapability ||
        settlement.cleanupStatus !== null ||
        settlement.dockerTerminal !== null ||
        read("history.pending.jsonl") !== null ||
        (expectedHistory === null
          ? history !== null
          : !history ||
            !historyIdentity ||
            !history.equals(expectedHistory.bytes) ||
            !sameStableFileIdentity(expectedHistory.identity, historyIdentity))
      )
        throw new Error("current_completion_scope_invalid");
      const operation = current.snapshot.operations.find(
        (item) =>
          item.kind === currentCompletion.operationKind &&
          item.recoveryId === settlement.recoveryId,
      );
      const identity = operation ? JSON.parse(operation.identityJson) : null;
      const expected = (
        currentCompletion.operationKind === "runtime_repair"
          ? prepareCoordinatorStateRepairCompletionSnapshot
          : prepareCoordinatorStateCompletionSnapshot
      )(currentBytes, settlement.recoveryId, repository.repositoryBinding);
      const line = (
        currentCompletion.operationKind === "runtime_repair"
          ? prepareCoordinatorRepairHistoryLine
          : prepareCoordinatorStateHistoryLine
      )(currentBytes, settlement.recoveryId, repository.repositoryBinding);
      const rows = decodeCoordinatorHistoryRows(history ?? Buffer.alloc(0));
      const row = rows?.find(
        (item) => item.recoveryId === settlement.recoveryId,
      );
      if (
        !operation?.history?.confirmed ||
        identity?.operationId !== repository.operationId ||
        (currentCompletion.operationKind === "docker_task" &&
          coordinatorConsumerCompletionPolicy(identity.consumer) !==
            "transient") ||
        !expected?.equals(bytes) ||
        !line ||
        !rows ||
        (currentCompletion.operationKind === "runtime_repair" && !row) ||
        createHash("sha256").update(line).digest("hex") !==
          operation.history.lineSha256 ||
        (row && !Buffer.from(row.line).equals(line)) ||
        (read("state.pending.json") !== null && oldMarker === null) ||
        currentCompletion.assertOwner() !== true
      )
        throw new Error("current_completion_candidate_invalid");
      completionConfirmed = true;
      savedTerminalConfirmed = true;
    } else if (currentDelivery) {
      const history = read("history.jsonl"),
        identity = fileIdentities.get("history.jsonl") ?? null;
      const expectedHistory = currentDelivery.historyFile;
      if (
        (expectedHistory === null
          ? history !== null
          : !history ||
            !identity ||
            !history.equals(expectedHistory.bytes) ||
            !sameStableFileIdentity(expectedHistory.identity, identity)) ||
        currentDelivery.repository.repositoryRoot !==
          repository.repositoryRoot ||
        currentDelivery.repository.repositoryBinding !==
          repository.repositoryBinding ||
        currentDelivery.repository.operationId !== repository.operationId ||
        currentDelivery.recoveryId !== settlement?.recoveryId ||
        !currentBytes?.equals(currentDelivery.before) ||
        !bytes.equals(currentDelivery.candidate) ||
        !current ||
        currentDelivery.assertOwner() !== true ||
        settlement.currentHistory ||
        settlement.completion ||
        settlement.historyInitial ||
        settlement.historyPublish ||
        settlement.deliveryRegistration !== undefined ||
        settlement.managementCapability ||
        settlement.cleanupStatus !== null ||
        settlement.dockerTerminal !== null ||
        read("history.pending.jsonl") !== null
      )
        throw new Error("current_delivery_scope_invalid");
      const operation = current.snapshot.operations.find(
        (item): item is CoordinatorStateTaskOperation =>
          item.kind === "docker_task" &&
          item.recoveryId === settlement.recoveryId,
      );
      const sourceIdentity = operation
        ? JSON.parse(operation.identityJson)
        : null;
      const line = prepareCoordinatorStateHistoryLine(
        currentBytes,
        settlement.recoveryId,
        repository.repositoryBinding,
      );
      const rows = decodeCoordinatorHistoryRows(history ?? Buffer.alloc(0));
      const row = rows?.find(
        (item) => item.recoveryId === settlement.recoveryId,
      );
      const expected = prepareCoordinatorStateResultDeliverySnapshot(
        currentBytes,
        settlement.recoveryId,
        ["orchestrator"],
        repository.repositoryBinding,
      );
      if (
        !operation?.history?.confirmed ||
        sourceIdentity?.consumer !== "orchestrator" ||
        sourceIdentity.operationId !== repository.operationId ||
        !line ||
        !rows ||
        createHash("sha256").update(line).digest("hex") !==
          operation.history.lineSha256 ||
        (row && !Buffer.from(row.line).equals(line)) ||
        current.snapshot.resultReceipts.some(
          (item) => item.recoveryId === settlement.recoveryId,
        ) ||
        !expected?.equals(bytes) ||
        (read("state.pending.json") !== null && oldMarker === null) ||
        currentDelivery.assertOwner() !== true
      )
        throw new Error("current_delivery_candidate_invalid");
      if (
        read("state.pending.json") !== null &&
        expected?.equals(currentBytes ?? Buffer.alloc(0))
      )
        throw new Error("current_delivery_already_published_pending");
      savedTerminalConfirmed = true;
    } else if (currentHistory) {
      for (const [name, expected] of [
        ["history.jsonl", currentHistory.historyFile],
        ["history.pending.jsonl", currentHistory.pendingHistoryFile],
      ] as const) {
        const actual = read(name),
          identity = fileIdentities.get(name) ?? null;
        if (
          expected === null
            ? actual !== null
            : actual === null ||
              identity === null ||
              !actual.equals(expected.bytes) ||
              !sameStableFileIdentity(expected.identity, identity)
        )
          throw new Error("current_history_file_changed");
      }
      if (
        !settlement ||
        settlement.recoveryId !== currentHistory.recoveryId ||
        repository.repositoryRoot !==
          currentHistory.repository.repositoryRoot ||
        repository.repositoryBinding !==
          currentHistory.repository.repositoryBinding ||
        repository.operationId !== currentHistory.repository.operationId ||
        settlement.cleanupStatus !== null ||
        settlement.dockerTerminal !== null ||
        settlement.completion ||
        settlement.historyInitial ||
        settlement.historyPublish ||
        settlement.deliveryRegistration !== undefined ||
        settlement.managementCapability ||
        currentHistory.assertOwner() !== true ||
        !currentBytes?.equals(currentHistory.before) ||
        !bytes.equals(currentHistory.candidate) ||
        !current
      )
        throw new Error("current_history_scope_invalid");
      const operation = current.snapshot.operations.find(
        (item) =>
          item.kind === currentHistory.operationKind &&
          item.recoveryId === settlement.recoveryId,
      );
      const target = candidate.snapshot.operations.find(
        (item) =>
          item.kind === currentHistory.operationKind &&
          item.recoveryId === settlement.recoveryId,
      );
      if (
        !operation ||
        !target ||
        JSON.parse(operation.identityJson).operationId !==
          repository.operationId ||
        JSON.parse(target.identityJson).operationId !== repository.operationId
      )
        throw new Error("current_history_operation_invalid");
      let expected: Buffer | null = null;
      if (currentHistory.stage === "checkpoint") {
        if (
          operation?.history !== null ||
          !target?.history ||
          target.history.confirmed
        )
          throw new Error("current_history_checkpoint_invalid");
        expected = (
          currentHistory.operationKind === "runtime_repair"
            ? prepareCoordinatorRepairHistorySnapshot
            : prepareCoordinatorStateHistorySnapshot
        )(
          currentBytes,
          settlement.recoveryId,
          target.history.occurredAt,
          false,
          repository.repositoryBinding,
        );
        if (read("history.pending.jsonl") !== null)
          throw new Error("current_history_checkpoint_order_invalid");
      } else if (currentHistory.stage === "publish") {
        const config = readHistoryRetentionDays(repository);
        if (config === null) throw new Error("current_history_config_invalid");
        const publication = (
          currentHistory.operationKind === "runtime_repair"
            ? prepareCoordinatorRepairHistoryPublication
            : prepareCoordinatorRecoveredHistoryPublication
        )(
          currentBytes,
          settlement.recoveryId,
          read("history.jsonl") ?? Buffer.alloc(0),
          read("history.pending.jsonl"),
          config,
          repository.repositoryBinding,
        );
        if (
          read("state.pending.json") !== null &&
          publication?.historyChanged !== false
        )
          throw new Error("current_history_state_pending_order_invalid");
        expected = publication?.snapshotBytes ?? null;
      } else {
        if (
          !operation?.history?.confirmed ||
          read("history.pending.jsonl") !== null ||
          read("state.pending.json") !== null
        )
          throw new Error("current_history_confirmed_invalid");
        const line = (
          currentHistory.operationKind === "runtime_repair"
            ? prepareCoordinatorRepairHistoryLine
            : prepareCoordinatorStateHistoryLine
        )(currentBytes, settlement.recoveryId, repository.repositoryBinding);
        const rows = decodeCoordinatorHistoryRows(
          read("history.jsonl") ?? Buffer.alloc(0),
        );
        const row = rows?.find(
          (item) => item.recoveryId === settlement.recoveryId,
        );
        if (!line || !rows || (row && !Buffer.from(row.line).equals(line)))
          throw new Error("current_history_line_invalid");
        expected = currentBytes;
      }
      if (!expected?.equals(bytes) || currentHistory.assertOwner() !== true)
        throw new Error("current_history_candidate_invalid");
      repairHistoryScopeConfirmed =
        currentHistory.operationKind === "runtime_repair";
      savedTerminalConfirmed = true;
    } else if (settlement?.completion) {
      const before = decodeRuntimeDomainSnapshot(
        settlement.completion.before,
        repository.repositoryBinding,
      );
      const previous = before?.snapshot.operations.find(
        (operation): operation is CoordinatorStateTaskOperation =>
          operation.kind === "docker_task" &&
          operation.recoveryId === settlement.recoveryId,
      );
      const expected = prepareCoordinatorStateCompletionSnapshot(
        settlement.completion.before,
        settlement.recoveryId,
        repository.repositoryBinding,
      );
      const savedConsumer = previous
        ? JSON.parse(previous.identityJson).consumer
        : null;
      const completionPolicy =
        coordinatorConsumerCompletionPolicy(savedConsumer);
      if (
        !before ||
        !previous ||
        !completionPolicy ||
        savedConsumer !== settlement.consumer ||
        JSON.parse(previous.identityJson).operationId !==
          repository.operationId ||
        !expected?.equals(bytes) ||
        !settlement.completion.candidate.equals(bytes) ||
        !(
          currentBytes?.equals(settlement.completion.before) ||
          currentBytes?.equals(bytes)
        ) ||
        !settlement.cleanupStatus ||
        !settlement.dockerTerminal?.homeLeaseReleased ||
        !settlement.dockerTerminal.mountLeaseReleased ||
        !settlement.dockerTerminal.recoveryCompleted ||
        completionPolicy !== "transient" ||
        settlement.deliveryRegistration !== undefined ||
        settlement.historyInitial ||
        settlement.historyPublish ||
        before.snapshot.pendingDeliveries.some(
          (delivery) =>
            delivery.recoveryId === settlement.recoveryId &&
            delivery.consumer !== "orchestrator",
        )
      )
        throw new Error("completion_scope_unconfirmed");
      const observed = prepareCoordinatorStateCleanupSnapshot(
        settlement.completion.before,
        settlement.recoveryId,
        {
          snapshot: settlement.dockerTerminal.resourceSnapshot,
          observations: settlement.dockerTerminal.resources,
        },
        repository.repositoryBinding,
      );
      const observedOperation = observed
        ? decodeRuntimeDomainSnapshot(
            observed,
            repository.repositoryBinding,
          )?.snapshot.operations.find(
            (operation): operation is CoordinatorStateTaskOperation =>
              operation.kind === "docker_task" &&
              operation.recoveryId === settlement.recoveryId,
          )
        : null;
      if (
        !observedOperation ||
        encodeRuntimeStateValue(observedOperation.resources) !==
          encodeRuntimeStateValue(previous.resources)
      )
        throw new Error("completion_terminal_or_acceptance_unconfirmed");
      const fixedLine = prepareCoordinatorStateHistoryLine(
        settlement.completion.before,
        settlement.recoveryId,
        repository.repositoryBinding,
      );
      const rows = decodeCoordinatorHistoryRows(
        read("history.jsonl") ?? Buffer.alloc(0),
      );
      const row = rows?.find(
        (entry) => entry.recoveryId === settlement.recoveryId,
      );
      if (
        !fixedLine ||
        !previous.history?.confirmed ||
        !rows ||
        createHash("sha256").update(fixedLine).digest("hex") !==
          previous.history.lineSha256 ||
        (row !== undefined && !Buffer.from(row.line).equals(fixedLine)) ||
        read("history.pending.jsonl") !== null
      )
        throw new Error("completion_history_unconfirmed");
      completionConfirmed = true;
    }
    historyAlreadyConfirmed =
      settlement?.historyPublish === true &&
      currentBytes?.equals(bytes) === true &&
      ![
        ...(current?.snapshot.pendingDeliveries ?? []),
        ...(current?.snapshot.unresolvedRecoveries ?? []),
      ].some((item) => item.recoveryId === settlement.recoveryId) &&
      current?.snapshot.operations.some(
        (operation) =>
          operation.recoveryId === settlement.recoveryId &&
          operation.history?.confirmed === true,
      ) === true;
    const pendingBytes = read("state.pending.json");
    if (
      hostCleanupPublication &&
      (!currentBytes?.equals(hostCleanupPublication.before) ||
        !bytes.equals(hostCleanupPublication.candidate) ||
        !oldMarker?.equals(marker) ||
        (hostCleanupPublication.mode === "B"
          ? !pendingBytes?.equals(bytes)
          : pendingBytes !== null))
    )
      throw new Error("host_cleanup_publication_changed");
    if (pendingBytes !== null && !pendingBytes.equals(bytes))
      throw new Error("other_pending");
    const isInitialRoot =
      currentBytes === null &&
      (taskPublication?.initialBoundary === initial.boundaryIdentity ||
        (initializationOwner !== null &&
          typeof initializationOwner === "object" &&
          initializations.get(initializationOwner)?.repositoryBinding ===
            repository.repositoryBinding &&
          initializations.get(initializationOwner)?.boundaryIdentity ===
            initial.boundaryIdentity &&
          initializations.get(initializationOwner)?.payloadSha256 ===
            candidate.payloadSha256 &&
          initializations.get(initializationOwner)?.publicationIssued ===
            false)) &&
      names.every((name) =>
        ["state.pending.json", "state.lock"].includes(name),
      );
    const isInitialRepairPublication =
      repairPublication?.mode === "initial_publication";
    if (pendingBytes !== null) {
      const pending = decodeRuntimeDomainSnapshot(
        pendingBytes,
        repository.repositoryBinding,
      );
      if (!pending) throw new Error("pending");
      const treatment = classifyRuntimeSnapshotReentry(
        current
          ? {
              status: "present",
              revision: current.snapshot.revision,
              repositoryBinding: repository.repositoryBinding,
              payloadSha256: current.payloadSha256,
            }
          : { status: "absent" },
        { ...pending.snapshot, payloadSha256: pending.payloadSha256 },
        repository.repositoryBinding,
        isInitialRoot || isInitialRepairPublication ? "new" : "existing",
      );
      if (treatment === "blocked") throw new Error("pending_conflict");
      if (
        treatment === "publish_pending" &&
        !completionConfirmed &&
        !corePublication &&
        !(currentRepair
          ? validateRepairWriteCandidate(
              currentBytes,
              pendingBytes,
              currentRepair.recoveryId,
              currentRepair.purpose,
              repository.repositoryBinding,
            )
          : validateCoordinatorStateTransition(
              currentBytes,
              pendingBytes,
              repository.repositoryBinding,
            ))
      )
        throw new Error("transition");
    } else if (
      !currentBytes?.equals(bytes) &&
      !completionConfirmed &&
      !corePublication &&
      (!(currentRepair
        ? validateRepairWriteCandidate(
            currentBytes,
            bytes,
            currentRepair.recoveryId,
            currentRepair.purpose,
            repository.repositoryBinding,
          )
        : validateCoordinatorStateTransition(
            currentBytes,
            bytes,
            repository.repositoryBinding,
          )) ||
        (currentBytes === null && !isInitialRoot))
    )
      throw new Error("transition");
    if (
      !taskPublication &&
      settlement?.deliveryRegistration === undefined &&
      !currentDelivery &&
      encodeRuntimeStateValue(current?.snapshot.pendingDeliveries ?? []) !==
        encodeRuntimeStateValue(candidate.snapshot.pendingDeliveries)
    )
      throw new Error("delivery_owner_required");
    if (settlement && !savedTerminalConfirmed) {
      if (!current) throw new Error("settlement_current_missing");
      if (
        !completionConfirmed &&
        (!current ||
          current.snapshot.operations.length !==
            candidate.snapshot.operations.length ||
          encodeRuntimeStateValue(current.snapshot.unresolvedRecoveries) !==
            encodeRuntimeStateValue(candidate.snapshot.unresolvedRecoveries) ||
          (settlement.deliveryRegistration === undefined &&
            current.snapshot.pendingDeliveries.length !==
              candidate.snapshot.pendingDeliveries.length))
      )
        throw new Error("settlement_scope");
      if (settlement.deliveryRegistration !== undefined) {
        const expected = prepareCoordinatorStateResultDeliverySnapshot(
          currentBytes,
          settlement.recoveryId,
          settlement.deliveryRegistration,
          repository.repositoryBinding,
        );
        if (!expected?.equals(bytes))
          throw new Error("settlement_result_registration_invalid");
      }
      for (const previous of current.snapshot.operations) {
        if (previous.kind !== "docker_task") {
          const retained = candidate.snapshot.operations.find(
            (value) => value.recoveryId === previous.recoveryId,
          );
          if (
            encodeRuntimeStateValue(retained) !==
            encodeRuntimeStateValue(previous)
          )
            throw new Error("repair_state_changed_by_task_settlement");
          continue;
        }
        const next = candidate.snapshot.operations.find(
          (value): value is CoordinatorStateTaskOperation =>
            value.kind === "docker_task" &&
            value.recoveryId === previous.recoveryId,
        );
        if (!next) {
          if (
            completionConfirmed &&
            previous.recoveryId === settlement.recoveryId
          )
            continue;
          throw new Error("settlement_removal");
        }
        if (previous.recoveryId !== settlement.recoveryId) {
          if (
            encodeRuntimeStateValue(previous) !== encodeRuntimeStateValue(next)
          )
            throw new Error("settlement_other_operation");
          continue;
        }
        if (
          encodeRuntimeStateValue(previous.resources) !==
          encodeRuntimeStateValue(next.resources)
        ) {
          const observedBytes = settlement.dockerTerminal
            ? prepareCoordinatorStateCleanupSnapshot(
                currentBytes,
                settlement.recoveryId,
                {
                  snapshot: settlement.dockerTerminal.resourceSnapshot,
                  observations: settlement.dockerTerminal.resources,
                },
                repository.repositoryBinding,
              )
            : null;
          const observedOperation = observedBytes
            ? decodeRuntimeDomainSnapshot(
                observedBytes,
                repository.repositoryBinding,
              )?.snapshot.operations.find(
                (value): value is CoordinatorStateTaskOperation =>
                  value.kind === "docker_task" &&
                  value.recoveryId === settlement.recoveryId,
              )
            : null;
          if (
            !observedOperation ||
            encodeRuntimeStateValue(observedOperation.resources) !==
              encodeRuntimeStateValue(next.resources)
          )
            throw new Error("settlement_resource_observation_invalid");
        }
        const nextPrimaryFailure = encodeRuntimeStateValue(next.primaryFailure);
        if (
          settlement.dockerTerminal
            ? nextPrimaryFailure !==
              encodeRuntimeStateValue(settlement.dockerTerminal.primaryFailure)
            : nextPrimaryFailure !==
              encodeRuntimeStateValue(previous.primaryFailure)
        )
          throw new Error("settlement_primary_failure_unconfirmed");
        if (
          next.phase === "executing" ||
          next.execution.ownerEffect === "active" ||
          previous.host.currentToken !== next.host.currentToken ||
          previous.host.pendingTransitionJson !==
            next.host.pendingTransitionJson ||
          (next.host.cleanup === "confirmed" && !settlement.cleanupStatus)
        )
          throw new Error("settlement_effect");
        if (
          next.lease !== previous.lease &&
          next.lease === "released" &&
          settlement.dockerTerminal?.homeLeaseReleased !== true
        )
          throw new Error("settlement_lease_observation_invalid");
        if (
          next.outcome?.cleanupConfirmed &&
          (next.host.cleanup !== "confirmed" ||
            next.lease !== "released" ||
            settlement.dockerTerminal?.homeLeaseReleased !== true ||
            settlement.dockerTerminal?.mountLeaseReleased !== true ||
            settlement.dockerTerminal?.recoveryCompleted !== true ||
            !coordinatorTaskResourcesAreSettled(next))
        )
          throw new Error("settlement_cleanup_unconfirmed");
      }
      for (const previous of current.snapshot.pendingDeliveries) {
        if (
          completionConfirmed &&
          previous.recoveryId === settlement.recoveryId
        )
          continue;
        const next = candidate.snapshot.pendingDeliveries.find(
          (value) =>
            value.recoveryId === previous.recoveryId &&
            value.consumer === previous.consumer,
        );
        if (
          !next ||
          (previous.recoveryId !== settlement.recoveryId &&
            encodeRuntimeStateValue(previous) !== encodeRuntimeStateValue(next))
        )
          throw new Error("settlement_delivery");
      }
    }
    // 保存対象を変更する操作だけを現在のOwnerへ結合する。
    const previousOperations = new Map(
      current?.snapshot.operations.map((operation) => [
        operation.recoveryId,
        operation,
      ]) ?? [],
    );
    for (const operation of candidate.snapshot.operations) {
      const previous = previousOperations.get(operation.recoveryId);
      if (operation.kind !== "docker_task") {
        if (
          (!previous ||
            encodeRuntimeStateValue(previous) !==
              encodeRuntimeStateValue(operation)) &&
          currentRepair?.recoveryId !== operation.recoveryId &&
          !(
            repairHistoryScopeConfirmed &&
            currentHistory?.recoveryId === operation.recoveryId
          )
        )
          throw new Error("repair_writer_unconnected");
        continue;
      }
      if (previous && previous.kind !== "docker_task")
        throw new Error("operation_kind_changed");
      for (const resource of operation.resources?.checkpoints ?? []) {
        const before = previous?.resources?.checkpoints.find(
          (value) => value.key === resource.key,
        );
        if (
          resource.submission === "not_issued" &&
          before?.submission !== "not_issued" &&
          (!unissued ||
            before?.submission !== "intent_saved" ||
            unissued.recoveryId !== operation.recoveryId ||
            unissued.purpose !== resource.key)
        )
          throw new Error("resource_not_issued_proof_missing");
      }
      if (
        !currentHistory &&
        (((settlement?.historyInitial || settlement?.historyPublish) &&
          operation.recoveryId === settlement.recoveryId) ||
          encodeRuntimeStateValue(operation.history) !==
            encodeRuntimeStateValue(previous?.history ?? null))
      ) {
        if (
          (!settlement?.historyInitial && !settlement?.historyPublish) ||
          settlement.recoveryId !== operation.recoveryId ||
          !currentBytes ||
          !previous ||
          !operation.history ||
          (settlement.historyPublish
            ? !operation.history.confirmed || !previous.history
            : operation.history.confirmed || previous.history?.confirmed) ||
          !settlement.cleanupStatus ||
          settlement.dockerTerminal?.homeLeaseReleased !== true ||
          settlement.dockerTerminal.mountLeaseReleased !== true ||
          settlement.dockerTerminal.recoveryCompleted !== true
        )
          throw new Error("history_checkpoint_unconnected");
        const observedBytes = prepareCoordinatorStateCleanupSnapshot(
          currentBytes,
          operation.recoveryId,
          {
            snapshot: settlement.dockerTerminal.resourceSnapshot,
            observations: settlement.dockerTerminal.resources,
          },
          repository.repositoryBinding,
        );
        const observedOperation = observedBytes
          ? decodeRuntimeDomainSnapshot(
              observedBytes,
              repository.repositoryBinding,
            )?.snapshot.operations.find(
              (value): value is CoordinatorStateTaskOperation =>
                value.kind === "docker_task" &&
                value.recoveryId === operation.recoveryId,
            )
          : null;
        if (
          !observedOperation ||
          encodeRuntimeStateValue(observedOperation.resources) !==
            encodeRuntimeStateValue(previous.resources)
        )
          throw new Error("history_resource_observation_invalid");
        const expected = prepareCoordinatorStateHistorySnapshot(
          currentBytes,
          operation.recoveryId,
          operation.history.occurredAt,
          settlement.historyPublish === true,
          repository.repositoryBinding,
        );
        if (
          !expected?.equals(bytes) &&
          !(
            settlement.historyPublish &&
            previous.history?.confirmed &&
            currentBytes.equals(bytes)
          )
        )
          throw new Error("history_checkpoint_difference_invalid");
        if (settlement.historyInitial && previous.history === null)
          initialHistoryLine = operation.history.lineSha256;
      }
      if (
        (!previous ||
          encodeRuntimeStateValue(previous) !==
            encodeRuntimeStateValue(operation)) &&
        JSON.parse(operation.identityJson).operationId !==
          repository.operationId
      )
        throw new Error("operation_owner");
    }
    for (const collection of [
      "unresolvedRecoveries",
      "pendingDeliveries",
    ] as const) {
      for (const item of candidate.snapshot[collection]) {
        const previous = current?.snapshot[collection].find(
          (value) =>
            value.operationNonce === item.operationNonce &&
            (collection !== "pendingDeliveries" ||
              ("consumer" in value &&
                "consumer" in item &&
                value.consumer === item.consumer)),
        );
        if (
          !previous ||
          encodeRuntimeStateValue(previous) !== encodeRuntimeStateValue(item)
        ) {
          const operation = candidate.snapshot.operations.find(
            (value): value is CoordinatorStateTaskOperation =>
              value.kind === "docker_task" &&
              value.recoveryId === item.recoveryId,
          );
          if (
            !operation ||
            JSON.parse(operation.identityJson).operationId !==
              repository.operationId
          )
            throw new Error("reference_owner");
        }
      }
    }
    if (
      settlement &&
      ((settlement.historyPublish && !historyAlreadyConfirmed) ||
        currentHistory?.stage === "publish")
    ) {
      if (!currentBytes || !current) throw new Error("history_current_missing");
      const line = (
        currentHistory?.operationKind === "runtime_repair"
          ? prepareCoordinatorRepairHistoryLine
          : prepareCoordinatorStateHistoryLine
      )(currentBytes, settlement.recoveryId, repository.repositoryBinding);
      const target = current.snapshot.operations.find(
        (value) =>
          value.kind === (currentHistory?.operationKind ?? "docker_task") &&
          value.recoveryId === settlement.recoveryId,
      );
      if (!line || !target?.history) throw new Error("history_unfixed");
      const priorHistory = read("history.jsonl");
      const before = priorHistory ?? Buffer.alloc(0);
      const rows = decodeCoordinatorHistoryRows(before);
      if (!rows) throw new Error("history_invalid");
      const sameRow = rows.find(
        (row) => row.recoveryId === settlement.recoveryId,
      );
      if (sameRow && !Buffer.from(sameRow.line).equals(line))
        throw new Error("history_row_conflict");
      const owner = runtimeStorageOperationIdentity(
        settlement.managementCapability,
      );
      const admission =
        owner && typeof owner === "object"
          ? historyAttempts.get(owner)?.get(settlement.recoveryId)
          : null;
      const pendingHistory = read("history.pending.jsonl");
      if (!sameRow && target.history.confirmed)
        throw new Error("history_confirmed_row_absent");
      if (!sameRow && !admission && !currentHistory)
        throw new Error("history_initial_proof_missing");
      if (admission && admission.lineSha256 !== target.history.lineSha256)
        throw new Error("history_proof_conflict");
      const configuration = readHistoryRetentionDays(repository);
      if (configuration === null) throw new Error("history_config_invalid");
      const days = configuration;
      const now = currentHistory
        ? target.history.occurredAt
        : (admission?.pending?.now ?? new Date().toISOString());
      let after: Buffer;
      if (currentHistory) {
        const publication = (
          currentHistory.operationKind === "runtime_repair"
            ? prepareCoordinatorRepairHistoryPublication
            : prepareCoordinatorRecoveredHistoryPublication
        )(
          currentBytes,
          settlement.recoveryId,
          before,
          pendingHistory,
          days,
          repository.repositoryBinding,
        );
        if (
          !publication?.snapshotBytes.equals(bytes) ||
          currentHistory.assertOwner() !== true
        )
          throw new Error("current_history_publication_invalid");
        after = publication.historyBytes;
        if (pendingHistory === null && !before.equals(after))
          create("history.pending.jsonl", after);
      } else if (pendingHistory !== null) {
        const binding = admission?.pending;
        const originalIdentity = fileIdentities.get("history.jsonl") ?? null;
        if (
          !binding?.before.equals(before) ||
          !binding.after.equals(pendingHistory) ||
          binding.retentionDays !== days ||
          (binding.beforeIdentity === null
            ? originalIdentity !== null
            : !originalIdentity ||
              !sameStableFileIdentity(binding.beforeIdentity, originalIdentity))
        )
          throw new Error("history_pending_unbound");
        after = binding.after;
      } else {
        if (!sameRow && admission?.issued)
          throw new Error("history_prior_attempt_unknown");
        const joined = sameRow ? before : Buffer.concat([before, line]);
        const retained = prepareCoordinatorHistoryRetention(
          currentBytes,
          joined,
          now,
          days,
          repository.repositoryBinding,
        );
        if (!retained) throw new Error("history_retention_invalid");
        after = retained;
        if (admission) {
          admission.pending = {
            before,
            after,
            beforeIdentity: fileIdentities.get("history.jsonl") ?? null,
            stateCandidate: bytes,
            retentionDays: days,
            now,
          };
          admission.issued = true;
        }
        if (!before.equals(after)) create("history.pending.jsonl", after);
      }
      if (!before.equals(after)) {
        if (
          !read("history.pending.jsonl")?.equals(after) ||
          !(read("history.jsonl") ?? Buffer.alloc(0)).equals(before) ||
          !read("state.json")?.equals(currentBytes)
        )
          throw new Error("history_changed");
        const freshConfig = readHistoryRetentionDays(repository);
        if (freshConfig === null || freshConfig !== days)
          throw new Error("history_config_changed");
        flushRuntimeStateFile(
          directory,
          "history.pending.jsonl",
          fileIdentities,
          assertBoundary,
          () => {
            filesystemEffectIssued = true;
          },
        );
        if (!read("history.pending.jsonl")?.equals(after))
          throw new Error("history_pending_changed");
        assertBoundary();
        filesystemEffectIssued = true;
        const pendingIdentity = fileIdentities.get("history.pending.jsonl");
        fs.renameSync(
          path.join(directory, "history.pending.jsonl"),
          path.join(directory, "history.jsonl"),
        );
        fileIdentities.delete("history.pending.jsonl");
        fileIdentities.delete("history.jsonl");
        const saved = read("history.jsonl");
        const savedIdentity = fileIdentities.get("history.jsonl");
        if (
          !saved?.equals(after) ||
          !pendingIdentity ||
          !savedIdentity ||
          pendingIdentity.dev !== savedIdentity.dev ||
          pendingIdentity.ino !== savedIdentity.ino
        )
          throw new Error("history_publication_unconfirmed");
      } else if (currentHistory && pendingHistory !== null) {
        if (
          !read("history.pending.jsonl")?.equals(after) ||
          !read("history.jsonl")?.equals(before) ||
          !read("state.json")?.equals(currentBytes)
        )
          throw new Error("current_history_pending_changed");
        assertBoundary();
        filesystemEffectIssued = true;
        fs.unlinkSync(path.join(directory, "history.pending.jsonl"));
        fileIdentities.delete("history.pending.jsonl");
      }
      flushRuntimeStateFile(
        directory,
        "history.jsonl",
        fileIdentities,
        assertBoundary,
        () => {
          filesystemEffectIssued = true;
        },
      );
      const savedRows = decodeCoordinatorHistoryRows(read("history.jsonl"));
      if (
        !savedRows?.some(
          (row) =>
            row.recoveryId === settlement.recoveryId &&
            Buffer.from(row.line).equals(line),
        ) ||
        read("history.pending.jsonl") !== null
      )
        throw new Error("history_readback_unconfirmed");
    }
    if (oldMarker === null) create("state.lock", marker);
    if (!currentBytes?.equals(bytes)) {
      if (pendingBytes === null) {
        try {
          create("state.pending.json", bytes);
        } catch (error) {
          // Task保存でpendingを作れなかった場合だけ、自分のmarkerを戻す。
          // 部分作成・既存marker・元本文差・観測不能では残存を保持する。
          if (
            taskPublication &&
            oldMarker === null &&
            read("state.pending.json") === null &&
            read("history.pending.jsonl") === null &&
            read("state.lock")?.equals(marker) &&
            (currentBytes === null
              ? read("state.json") === null
              : read("state.json")?.equals(currentBytes))
          ) {
            assertBoundary();
            if (
              read("state.pending.json") !== null ||
              read("history.pending.jsonl") !== null ||
              !read("state.lock")?.equals(marker) ||
              (currentBytes === null
                ? read("state.json") !== null
                : !read("state.json")?.equals(currentBytes))
            )
              throw error;
            fs.unlinkSync(path.join(directory, "state.lock"));
            fileIdentities.delete("state.lock");
            if (
              read("state.lock") !== null ||
              read("state.pending.json") !== null ||
              read("history.pending.jsonl") !== null ||
              (currentBytes === null
                ? read("state.json") !== null
                : !read("state.json")?.equals(currentBytes))
            )
              throw new Error("failed_task_marker_cleanup_unconfirmed");
            assertBoundary();
          }
          throw error;
        }
      }
      const samePending = read("state.pending.json");
      const sameCurrent = read("state.json");
      if (
        !samePending?.equals(bytes) ||
        (currentBytes === null
          ? sameCurrent !== null
          : !sameCurrent?.equals(currentBytes))
      )
        throw new Error("changed");
      flushRuntimeStateFile(
        directory,
        "state.pending.json",
        fileIdentities,
        assertBoundary,
        () => {
          filesystemEffectIssued = true;
        },
      );
      if (!read("state.pending.json")?.equals(bytes))
        throw new Error("pending_changed");
      const target = read("state.json");
      if (
        currentBytes === null ? target !== null : !target?.equals(currentBytes)
      )
        throw new Error("target_changed");
      filesystemEffectIssued = true;
      const publishedIdentity = fileIdentities.get("state.pending.json");
      if (
        initializationOwner !== null &&
        typeof initializationOwner === "object"
      ) {
        const proof = initializations.get(initializationOwner);
        if (proof) proof.publicationIssued = true;
      }
      fs.renameSync(
        path.join(directory, "state.pending.json"),
        path.join(directory, "state.json"),
      );
      fileIdentities.delete("state.json");
      fileIdentities.delete("state.pending.json");
      currentBytes = read("state.json");
      const published = fileIdentities.get("state.json");
      if (
        !publishedIdentity ||
        !published ||
        published.dev !== publishedIdentity.dev ||
        published.ino !== publishedIdentity.ino
      )
        throw new Error("published_replaced");
      current =
        currentBytes === null
          ? null
          : decodeRuntimeDomainSnapshot(
              currentBytes,
              repository.repositoryBinding,
            );
    } else if (pendingBytes !== null) {
      if (
        !read("state.pending.json")?.equals(bytes) ||
        !read("state.json")?.equals(bytes)
      )
        throw new Error("changed");
      assertBoundary();
      filesystemEffectIssued = true;
      fs.unlinkSync(path.join(directory, "state.pending.json"));
      fileIdentities.delete("state.pending.json");
    }
    if (
      !currentBytes?.equals(bytes) ||
      !current ||
      read("state.pending.json") !== null
    )
      throw new Error("final");
    if (
      settlement &&
      ((settlement.historyPublish && !historyAlreadyConfirmed) ||
        currentHistory?.stage === "publish")
    ) {
      const finalLine = (
        currentHistory?.operationKind === "runtime_repair"
          ? prepareCoordinatorRepairHistoryLine
          : prepareCoordinatorStateHistoryLine
      )(bytes, settlement.recoveryId, repository.repositoryBinding);
      const finalRows = decodeCoordinatorHistoryRows(read("history.jsonl"));
      if (
        !finalLine ||
        !finalRows?.some(
          (row) =>
            row.recoveryId === settlement.recoveryId &&
            Buffer.from(row.line).equals(finalLine),
        ) ||
        read("history.pending.jsonl") !== null
      )
        throw new Error("history_final_readback_unconfirmed");
    }
    if (currentDelivery) {
      const history = read("history.jsonl");
      if (
        currentDelivery.historyFile === null
          ? history !== null
          : !history?.equals(currentDelivery.historyFile.bytes)
      )
        throw new Error("current_delivery_history_changed");
    }
    if (currentCompletion) {
      const history = read("history.jsonl");
      if (
        currentCompletion.historyFile === null
          ? history !== null
          : !history?.equals(currentCompletion.historyFile.bytes)
      )
        throw new Error("current_completion_history_changed");
    }
    // 排他markerは完了時に回収する。履歴やoperation記録を削除しない。
    if (!read("state.lock")?.equals(marker)) throw new Error("marker");
    assertBoundary();
    filesystemEffectIssued = true;
    fs.unlinkSync(path.join(directory, "state.lock"));
    fileIdentities.delete("state.lock");
    if (read("state.lock") !== null || !read("state.json")?.equals(bytes))
      throw new Error("final");
    snapshotConfirmed = true;
    if (initializationOwner !== null && typeof initializationOwner === "object")
      initializations.delete(initializationOwner);
    reason = "coordinator_state_snapshot_confirmed";
  } catch {
    reason = "coordinator_state_storage_unconfirmed";
  }
  return {
    filesystemEffectIssued,
    snapshotConfirmed,
    reason,
    initialHistoryLine,
  };
}

/**
 * 保存準備・Owned確定・排他解放を既存Writer入口で結合する。
 * @responsibility 保存確認と解放確認の両方が揃った場合だけ完了を返す。
 * @trace ARCH-000008
 * @input input: 既存の操作Owner、固定候補と用途別保存入力。
 * @returns 保存Effect・Snapshot確認・解放確認を分離した結果。
 * @precondition 外側の用途別入口が既存の借用を検証する。
 * @postcondition 取得済みContextを一度だけ確定し、解放失敗を成功へ畳まない。
 * @effect 既存短期排他と固定保存FileのI/O。
 * @failure 取得前・保存途中・解放失敗は既存のblocked結果。
 * @invariant 新しい保存方式・Authority・第三Writerを追加しない。
 * @boundary 保存公開Wrapperと私有確定処理。
 * @security 任意Pathや外部callbackを受け付けない。
 * @concurrency 短期排他の取得と解放をこの入口が所有する。
 */
export function writeCoordinatorStateSnapshot(
  ...input: Parameters<typeof prepareCoordinatorStateWrite>
) {
  const prepared = prepareCoordinatorStateWrite(...input);
  if (!("lock" in prepared)) return prepared;
  const { storageOwner, initializationOwner, settlement, attempt } = prepared;
  let {
    filesystemEffectIssued,
    snapshotConfirmed,
    reason,
    initialHistoryLine,
  } = commitCoordinatorStateSnapshotOwned(prepared);
  let lockReleased = false;
  try {
    lockReleased = storageOwner.release();
  } catch {
    lockReleased = false;
  }
  if (!lockReleased) {
    if (initializationOwner !== null && typeof initializationOwner === "object")
      initializations.delete(initializationOwner);
    reason = "coordinator_state_lock_release_unconfirmed";
  }
  if (
    snapshotConfirmed &&
    lockReleased &&
    initialHistoryLine &&
    settlement?.managementCapability &&
    typeof settlement.managementCapability === "object"
  ) {
    let attempts = historyAttempts.get(
      runtimeStorageOperationIdentity(
        settlement.managementCapability,
      ) as object,
    );
    if (!attempts) {
      attempts = new Map();
      historyAttempts.set(
        runtimeStorageOperationIdentity(
          settlement.managementCapability,
        ) as object,
        attempts,
      );
    }
    if (!attempts.has(settlement.recoveryId))
      attempts.set(settlement.recoveryId, {
        lineSha256: initialHistoryLine,
        issued: false,
        pending: null,
      });
  }
  return Object.freeze({
    ...attempt,
    status: snapshotConfirmed && lockReleased ? "completed" : "blocked",
    reason,
    filesystemEffectIssued,
    snapshotConfirmed,
    lockReleased,
  });
}

/**
 * 同じ操作の指定checkpointを既存Writerで確定する。
 *
 * @responsibility 短期読取り、exact操作照合、次版構築と元版照合保存を一つの呼出しへ接続する。
 * @trace ARCH-000008
 * @input managementCapability: 現在操作Owner。recoveryId: exact回復参照。resourceValue: 現在評価。kind: 資源・全回収・Host・実行終端・参照集合の固定種別。
 * @returns 保存結果。snapshotConfirmedとlockReleasedを独立して保持する。
 * @precondition 呼出し側が観測と要求発行事実を取得し、初回Snapshotを確定済みである。
 * @postcondition 同じ操作の資源更新だけを保存し、失敗時は既発行Effectを未発行に戻さない。
 * @effect 固定Snapshotの読取りと既存Writerの短命保存だけ。Docker要求は発行しない。
 * @failure Owner、本文、遷移、改訂競合または排他終了不明はblockedを返す。
 * @invariant 古い候補の盲目的な再試行、二重書込み、旧Directory記録へのfallbackを行わない。
 * @boundary 操作OwnerとRepository-local現在状態。
 * @security 他操作の回復参照やPathを新しい操作Authorityにしない。
 * @concurrency 読取りLockを解放してからWriterを呼び、保存Lock内で元版を再照合する。
 */
export function checkpointRuntimeOwnedCoordinatorValue(
  managementCapability: unknown,
  recoveryId: unknown,
  resourceValue: unknown,
  kind:
    | "resource"
    | "cleanup"
    | "host"
    | "lifecycle"
    | "references"
    | "restart",
) {
  const repository = observeRuntimeExecutionRepository(managementCapability);
  const current =
    readRuntimeOwnedCoordinatorStateSnapshot(managementCapability);
  const blocked = Object.freeze({
    status: "blocked" as const,
    reason:
      current.status === "blocked"
        ? current.reason
        : "coordinator_state_input_invalid",
    revision: null,
    payloadSha256: null,
    recoveryIds: Object.freeze([] as string[]),
    filesystemEffectIssued: false,
    snapshotConfirmed: false,
    lockReleased: current.lockReleased,
  });
  if (
    !repository ||
    current.status !== "completed" ||
    !current.value ||
    !repository.revalidate()
  )
    return blocked;
  const operation = current.value.snapshot.operations.find(
    (item): item is CoordinatorStateTaskOperation =>
      item.kind === "docker_task" && item.recoveryId === recoveryId,
  );
  if (
    !operation ||
    JSON.parse(operation.identityJson).operationId !== repository.operationId
  )
    return blocked;
  const currentBytes = Buffer.from(
    `${encodeRuntimeStateValue(current.value.snapshot)}\n`,
  );
  const prepare = {
    resource: prepareCoordinatorStateResourceSnapshot,
    cleanup: prepareCoordinatorStateCleanupSnapshot,
    host: prepareCoordinatorStateHostSnapshot,
    lifecycle: prepareCoordinatorStateLifecycleSnapshot,
    references: prepareCoordinatorStateReferencesSnapshot,
    restart: prepareCoordinatorStateRestartSnapshot,
  }[kind];
  const next = prepare(
    currentBytes,
    recoveryId,
    resourceValue,
    repository.repositoryBinding,
  );
  if (!next) return blocked;
  if (kind === "references") {
    const candidate = decodeRuntimeDomainSnapshot(
      next,
      repository.repositoryBinding,
    );
    if (
      !candidate ||
      encodeRuntimeStateValue(candidate.snapshot.pendingDeliveries) !==
        encodeRuntimeStateValue(current.value.snapshot.pendingDeliveries)
    )
      return blocked;
  }
  return writeRuntimeOwnedCoordinatorStateSnapshot(managementCapability, next);
}

/**
 * 同じ操作の履歴出版で既に固定した再入場候補を参照する。
 * @responsibility 初回出版の証拠を複製せず、正常終了の再入場へ同じ候補を渡す。
 * @trace ARCH-000008
 * @input owner: 元実行Owner、recoveryId: exact回復参照。
 * @returns 固定済み候補、又はnull。
 * @precondition 呼出し側が正常終了Contextの真正性を確認する。
 * @postcondition 新しい証拠・Authorityを生成しない。
 * @effect N/A: 私有Map読取りだけ。
 * @failure 未登録又は不正Ownerではnull。
 * @invariant 候補参照は保存許可や履歴完了を表さない。
 * @boundary 正常終了Ownerと履歴出版証拠。
 * @security 可変Mapや証拠recordを返さない。
 * @concurrency 元の一回出版証拠を同じ寿命で参照する。
 */
export function readCoordinatorHistoryResumeCandidate(
  owner: unknown,
  recoveryId: string,
) {
  return owner && typeof owner === "object"
    ? historyAttempts.get(owner)?.get(recoveryId)?.pending?.stateCandidate
    : null;
}

/**
 * Lease取得意図から同じ操作Owner参照を照会する。
 * @responsibility 複数OwnerとQueue結合差を拒否し、読取りだけでOwner死亡を確定しない。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Repository結合。
 * @returns 既存の保存結果又は解放確認付き停止。
 * @precondition 呼出し側が現在の操作認可を確認している。
 * @postcondition 対象外区画と元のCAS・Hash・unknownを保つ。
 * @effect 読取りと必要な場合だけ既存Writerで保存する。
 * @failure 候補不正・競合・保存又は解放不明は停止する。
 * @invariant 任意Snapshot callback・生Ownerを受付又は返却しない。
 * @boundary 固定用途と唯一の保存Owner。
 * @security 保存成功を実行Authorityや資源回収と扱わない。
 * @concurrency fresh読取りから確定まで一つの短期Ownerを使用する。
 */
export function readCoordinatorLeaseAcquisitionOwner(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<typeof projectCoordinatorLeaseAcquisitionOwner> extends [
    unknown,
    ...infer Rest,
  ]
    ? Rest
    : never
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof projectCoordinatorLeaseAcquisitionOwner>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    projectCoordinatorLeaseAcquisitionOwner(current, ...input),
  );
}

/**
 * 保存済み取得意図と実排他を照合して取得を確定する。
 * @responsibility 同じintent、Owner世代と物理実体を確認して取得証拠を保存する。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Project、Queue、Lease種別、Owner世代、intent、物理実体と同期観測。
 * @returns 既存の保存結果又は解放確認付き停止。
 * @precondition 呼出し側が現在の操作認可を確認している。
 * @postcondition 対象外区画と元のCAS・Hash・unknownを保つ。
 * @effect 読取りと必要な場合だけ既存Writerで保存する。
 * @failure 候補不正・競合・保存又は解放不明は停止する。
 * @invariant 任意Snapshot callback・生Ownerを受付又は返却しない。
 * @boundary 固定用途と唯一の保存Owner。
 * @security 保存成功を実行Authorityや資源回収と扱わない。
 * @concurrency fresh読取りから確定まで一つの短期Ownerを使用する。
 */
export function confirmCoordinatorLeaseAcquisition(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<
    typeof prepareCoordinatorLeaseAcquisitionConfirmation
  > extends [unknown, ...infer Rest]
    ? Rest
    : never
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorLeaseAcquisitionConfirmation>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    prepareCoordinatorLeaseAcquisitionConfirmation(current, ...input),
  );
}

/**
 * 同じLeaseの解放意図を保存する。
 * @responsibility 元intentと物理実体を照合し、物理解放前に解放意図を確定する。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。元intentと物理実体。
 * @returns 既存の保存結果又は解放確認付き停止。
 * @precondition 呼出し側が現在の操作認可を確認している。
 * @postcondition 対象外区画と元のCAS・Hash・unknownを保つ。
 * @effect 読取りと必要な場合だけ既存Writerで保存する。
 * @failure 候補不正・競合・保存又は解放不明は停止する。
 * @invariant 任意Snapshot callback・生Ownerを受付又は返却しない。
 * @boundary 固定用途と唯一の保存Owner。
 * @security 保存成功を実行Authorityや資源回収と扱わない。
 * @concurrency fresh読取りから確定まで一つの短期Ownerを使用する。
 */
export function saveCoordinatorLeaseReleaseIntent(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<typeof prepareCoordinatorLeaseReleaseIntent> extends [
    unknown,
    ...infer Rest,
  ]
    ? Rest
    : never
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorLeaseReleaseIntent>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    prepareCoordinatorLeaseReleaseIntent(current, ...input),
  );
}

/**
 * 物理解放後のLease終了証拠を保存する。
 * @responsibility 同じ元intentを除去し、解放済み証拠とProcess相関を一体で保存する。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Repository結合、元intent、物理実体とProcess ID。
 * @returns 既存の保存結果又は解放確認付き停止。
 * @precondition 呼出し側が現在の操作認可を確認している。
 * @postcondition 対象外区画と元のCAS・Hash・unknownを保つ。
 * @effect 読取りと必要な場合だけ既存Writerで保存する。
 * @failure 候補不正・競合・保存又は解放不明は停止する。
 * @invariant 任意Snapshot callback・生Ownerを受付又は返却しない。
 * @boundary 固定用途と唯一の保存Owner。
 * @security 保存成功を実行Authorityや資源回収と扱わない。
 * @concurrency fresh読取りから確定まで一つの短期Ownerを使用する。
 */
export function settleCoordinatorLeaseRelease(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<
    typeof prepareCoordinatorLeaseReleaseSettlement
  > extends [unknown, ...infer Rest]
    ? Rest
    : never
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorLeaseReleaseSettlement>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    prepareCoordinatorLeaseReleaseSettlement(current, ...input),
  );
}

/**
 * 同じSnapshotからProject現在状態を照会する。
 * @responsibility 新Schemaと保存結合を検査してProject値だけを返す。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Project ID。
 * @returns 既存の保存結果又は解放確認付き停止。
 * @precondition 呼出し側が現在の操作認可を確認している。
 * @postcondition 対象外区画と元のCAS・Hash・unknownを保つ。
 * @effect 読取りと必要な場合だけ既存Writerで保存する。
 * @failure 候補不正・競合・保存又は解放不明は停止する。
 * @invariant 任意Snapshot callback・生Ownerを受付又は返却しない。
 * @boundary 固定用途と唯一の保存Owner。
 * @security 保存成功を実行Authorityや資源回収と扱わない。
 * @concurrency fresh読取りから確定まで一つの短期Ownerを使用する。
 */
export function readCoordinatorCurrentState(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<typeof projectCoordinatorCurrentState> extends [
    unknown,
    ...infer Rest,
  ]
    ? Rest
    : never
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof projectCoordinatorCurrentState>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    projectCoordinatorCurrentState(current, ...input),
  );
}

/**
 * Lease取得意図を実排他の取得前に予約する。
 * @responsibility 対象Queueと真正資源不存在を照合し、元位置でRoot観測と保存要求印を行う。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Project、Queue、種別、実排他Identity、intentとRoot限定観測。
 * @returns 元の候補結果を保存・解放確認後に返す。
 * @precondition 操作認可は呼出し側が現在確認している。
 * @postcondition 未知・元参照・候補外区画を保つ。
 * @effect 既存の読取りと必要な候補保存だけ。
 * @failure 競合・観測不能・例外・解放不明は元の停止へ返す。
 * @invariant 生Owner・任意Snapshot callbackを公開しない。
 * @boundary 固定操作と唯一の短期保存Owner。
 * @security 観測関数を保存又は登録しない。
 * @concurrency 実行側の物理処置へ短期Lockを持ち越さない。
 */
export function reserveCoordinatorLeaseAcquisition(
  workingDirectory: Repository,
  binding: string,
  ...input: CoordinatorRootObservedInput<
    Parameters<typeof prepareCoordinatorLeaseAcquisitionReservation>
  >
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorLeaseAcquisitionReservation>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current, owner) =>
    prepareCoordinatorLeaseAcquisitionReservation(
      current,
      input[0],
      input[1],
      input[2],
      input[3],
      input[4],
      input[5],
      {
        resourcesAbsent: () => input[6].resourcesAbsent(owner.repositoryRoot),
        observeRoot: () => input[6].observeRoot(owner.repositoryRoot),
        markIntentSaveRequested: input[6].markIntentSaveRequested,
      },
    ),
  );
}

/**
 * Owner喪失確認の初期Lease状態を照会する。
 * @responsibility fresh Queueとintentを照合した後だけ同じRootを観測する。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Project、Queue、種別とRoot限定観測。
 * @returns 元の候補結果を保存・解放確認後に返す。
 * @precondition 操作認可は呼出し側が現在確認している。
 * @postcondition 未知・元参照・候補外区画を保つ。
 * @effect 既存の読取りと必要な候補保存だけ。
 * @failure 競合・観測不能・例外・解放不明は元の停止へ返す。
 * @invariant 生Owner・任意Snapshot callbackを公開しない。
 * @boundary 固定操作と唯一の短期保存Owner。
 * @security 観測関数を保存又は登録しない。
 * @concurrency 実行側の物理処置へ短期Lockを持ち越さない。
 */
export function readCoordinatorLeaseOwnerLoss(
  workingDirectory: Repository,
  binding: string,
  ...input: CoordinatorRootObservedInput<
    Parameters<typeof projectCoordinatorLeaseOwnerLossState>
  >
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof projectCoordinatorLeaseOwnerLossState>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current, owner) =>
    projectCoordinatorLeaseOwnerLossState(
      current,
      input[0],
      input[1],
      input[2],
      { observeRoot: () => input[3].observeRoot(owner.repositoryRoot) },
    ),
  );
}

/**
 * 解放証拠とQueueの整合を回復する。
 * @responsibility 元Queue・解放証拠を照合後に資源不存在を確認し、未解決回復は保持する。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。対象Queue、種別、元Queue、回復IDと資源不存在観測。
 * @returns 元の候補結果を保存・解放確認後に返す。
 * @precondition 操作認可は呼出し側が現在確認している。
 * @postcondition 未知・元参照・候補外区画を保つ。
 * @effect 既存の読取りと必要な候補保存だけ。
 * @failure 競合・観測不能・例外・解放不明は元の停止へ返す。
 * @invariant 生Owner・任意Snapshot callbackを公開しない。
 * @boundary 固定操作と唯一の短期保存Owner。
 * @security 観測関数を保存又は登録しない。
 * @concurrency 実行側の物理処置へ短期Lockを持ち越さない。
 */
export function reconcileCoordinatorReleasedLease(
  workingDirectory: Repository,
  binding: string,
  ...input: CoordinatorRootObservedInput<
    Parameters<typeof prepareCoordinatorReleasedLeaseReconciliation>
  >
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorReleasedLeaseReconciliation>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current, owner) =>
    prepareCoordinatorReleasedLeaseReconciliation(
      current,
      input[0],
      input[1],
      input[2],
      input[3],
      input[4],
      { resourcesAbsent: () => input[5].resourcesAbsent(owner.repositoryRoot) },
    ),
  );
}

/**
 * 同じLease取得意図の回復を予約する。
 * @responsibility 元集合とRootを照合し、同じpendingだけ再入場を認める。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Project、Queue、種別、元状態、intent集合、pendingとRoot観測。
 * @returns 元の候補結果を保存・解放確認後に返す。
 * @precondition 操作認可は呼出し側が現在確認している。
 * @postcondition 未知・元参照・候補外区画を保つ。
 * @effect 既存の読取りと必要な候補保存だけ。
 * @failure 競合・観測不能・例外・解放不明は元の停止へ返す。
 * @invariant 生Owner・任意Snapshot callbackを公開しない。
 * @boundary 固定操作と唯一の短期保存Owner。
 * @security 観測関数を保存又は登録しない。
 * @concurrency 実行側の物理処置へ短期Lockを持ち越さない。
 */
export function reserveCoordinatorLeaseRecovery(
  workingDirectory: Repository,
  binding: string,
  ...input: CoordinatorRootObservedInput<
    Parameters<typeof prepareCoordinatorLeaseRecoveryReservation>
  >
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorLeaseRecoveryReservation>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current, owner) =>
    prepareCoordinatorLeaseRecoveryReservation(
      current,
      input[0],
      input[1],
      input[2],
      input[3],
      input[4],
      input[5],
      input[6],
      { observeRoot: () => input[7].observeRoot(owner.repositoryRoot) },
    ),
  );
}

/**
 * 全fresh照合・候補構築後にCoordinatorの同期回収と不存在を確認し、同じ排他内で保存する。
 * @responsibility 元集合・Root・資源不存在を照合して同じQueueと終了証拠だけを更新する。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。元状態、intent集合、元取得、pending、回復IDとRoot限定観測。
 * @returns 元の候補結果を保存・解放確認後に返す。
 * @precondition 操作認可は呼出し側が現在確認している。
 * @postcondition 未知・元参照・候補外区画を保つ。
 * @effect 既存保存Lock内で用途固定の同期物理処置を一度呼び、明示不存在後に候補を保存する。
 * @failure 競合・観測不能・例外・解放不明は元の停止へ返す。
 * @invariant 生Owner・任意Snapshot callbackを公開しない。
 * @boundary 固定操作と唯一の短期保存Owner。
 * @security 観測関数を保存又は登録しない。
 * @concurrency Root・Queue・Intent・終了証拠の検査から同期処置・保存まで同じ短期Lock。外部待機は持ち込まない。
 */

export function settleCoordinatorLeaseRecovery(
  workingDirectory: Repository,
  binding: string,
  ...input: CoordinatorLeaseRecoveryInput
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorLeaseRecoverySettlement>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current, owner) => {
    const prepared = prepareCoordinatorLeaseRecoverySettlement(
      current,
      input[0],
      input[1],
      input[2],
      input[3],
      input[4],
      input[5],
      input[6],
      input[7],
      input[8],
      {
        observeRoot: () => input[9].observeRoot(owner.repositoryRoot),
      },
    );
    if (prepared.status !== "completed") return prepared;
    // Root・Queue・Intent・終了証拠を全照合した後だけ物理処置する。
    // Promise/thenableを成功へ畳まず、同期完了と明示不存在を両方要求する。
    if (
      input[9].recoverResources(owner.repositoryRoot) !== true ||
      input[9].resourcesAbsent(owner.repositoryRoot) !== true
    )
      return blocked(
        "orchestrator_lease_recovery_state_mismatch",
        true,
        input[8],
      );
    return prepared;
  });
}

/**
 * 実行状況照会に必要な保存区画だけを読む。
 * @responsibility 全Snapshotや保存Ownerを外へ渡さず用途固定の観測を返す。
 * @trace ARCH-000008
 * @input workingDirectory、binding: 現在Repositoryと期待結合。
 * @returns 選択区画、明示不存在又は元の停止結果。
 * @precondition Hostが同じRepositoryの操作認可を確認する。
 * @postcondition I/O・改訂・解放確認の既存条件を保つ。
 * @effect 単一Readerと短期排他の読取りだけ。
 * @failure 不正Root・不一致・観測不能・解放不明を元の理由で拒否する。
 * @invariant 状態変更・実行・回復Authorityを生成しない。
 * @boundary Domain保存と用途別Consumer。
 * @security 任意投影callbackを受けず、技術区画を一括返却しない。
 * @concurrency 元の短期排他を一回取得・解放する。
 */
export function readCoordinatorExecutionState(
  workingDirectory: Repository,
  binding: string,
): StoreResult<Pick<
  CoordinatorSnapshot,
  "projects" | "queueEntries" | "intakeEpoch" | "schemaRevision"
> | null> {
  if (typeof workingDirectory !== "object" || workingDirectory === null)
    return blocked("orchestrator_repository_root_invalid");
  const result = readCoordinatorSnapshot(workingDirectory, binding);
  if (result.status !== "completed") return result;
  return completed(
    result.reason,
    result.value === null
      ? null
      : {
          projects: result.value.projects,
          queueEntries: result.value.queueEntries,
          intakeEpoch: result.value.intakeEpoch,
          schemaRevision: result.value.schemaRevision,
        },
  );
}

/**
 * 一般CRUDの対象IDを副作用なく取り出す。
 * @responsibility 認可前にgetterやProxyを評価せず対象を限定する。
 * @trace ARCH-000008
 * @input request: 一般保存要求。
 * @returns 対象又はnull。
 * @precondition N/A: 未信頼要求を拒否する。
 * @postcondition 対象の意味と本体の妥当性は用途ごとの検査へ残す。
 * @effect N/A: 同期構造検査。
 * @failure 不正ID・Proxy・accessorはnull。
 * @invariant inputのPropertyを直接評価しない。
 * @boundary 一般要求と認可照合。
 * @security 任意Pathを受けない。
 * @concurrency N/A: 状態共有なし。
 */
function runtimeContentTarget(request: unknown) {
  if (!request || typeof request !== "object" || types.isProxy(request))
    return null;
  const values = ["projectId", "milestoneId"].map((key) =>
    Object.getOwnPropertyDescriptor(request, key),
  );
  const projectId =
    values[0] && "value" in values[0] ? values[0].value : undefined;
  const milestoneId =
    values[1] && "value" in values[1] ? values[1].value : undefined;
  return validId(projectId) && validId(milestoneId)
    ? Object.freeze({ projectId, milestoneId })
    : null;
}

/**
 * 一般定義変更を既存の単一Writerと短期排他で確定する。
 * @responsibility 認可・全体CAS・定義Hash・参照検査と同一本文再導出を一つの保存へ接続する。
 * @trace ARCH-000008
 * @input access、kind、request: Host接続と固定CRUD用途・要求。
 * @returns 出版・読戻し・解放を区別した型付き結果。
 * @precondition 一般CRUDは管理実行参照のない定義だけを変更する。
 * @postcondition 対象外区画、元unknown・回復参照と受付世代を保つ。
 * @effect 共通stateの既存pending・atomic replaceだけ。
 * @failure 拒否・競合は無出版、途中失敗はunknownと元参照。
 * @invariant 新Writer・Map・Registry・取引callbackを公開しない。
 * @boundary Core定義と共通保存。
 * @security 認可を入口・短期排他下・各I/O・返却前で確認する。
 * @concurrency 一つの既存保存Ownerをfinallyで解放する。
 */
export function saveRuntimeDefinition<K extends keyof RuntimeDefinitionValues>(
  access: RuntimeAccess,
  kind: K,
  request: unknown,
): RuntimeWriteResult<RuntimeDefinitionValues[K]> {
  const target = runtimeContentTarget(request);
  if (!target)
    return { status: "blocked", value: null, reason: "input_invalid" };
  const repository = observeRuntimeContentRepository(
    access,
    "definition.write",
    target,
  );
  if (!repository)
    return { status: "blocked", value: null, reason: "not_authorized" };
  const acquisition = acquireCoordinatorStorageOwnerForRepository(repository);
  if (acquisition.status !== "completed") {
    if (!acquisition.manualRecoveryRequired)
      return { status: "blocked", value: null, reason: "lock_unavailable" };
    return {
      status: "unknown",
      value: null,
      reason:
        acquisition.reason ===
        "coordinator_state_lock_descriptor_close_unconfirmed"
          ? "lock_descriptor_close_unconfirmed"
          : "lock_initialization_failed",
      publication: "not_published",
      recoveryReferences: acquisition.recoveryId
        ? [acquisition.recoveryId]
        : [],
    };
  }
  const owner = acquisition.value;
  let result: RuntimeWriteResult<RuntimeDefinitionValues[K]> = {
    status: "blocked",
    value: null,
    reason: "state_unavailable",
  };
  let publication: "not_published" | "unconfirmed" | "confirmed" =
    "not_published";
  let effect = false;
  let references: readonly string[] = [];
  let released = false;
  try {
    const current = readCoordinatorStorageSnapshotOwned(owner, true);
    const revision = readRepositoryRevision(access.root);
    if (
      current.status === "completed" &&
      current.value &&
      revision &&
      repository.revalidate()
    ) {
      const before = Buffer.from(
        encodeRuntimeStateValue(current.value.snapshot) + "\n",
      );
      references = Object.freeze(
        current.value.snapshot.operations.map((o) => o.recoveryId),
      );
      const candidate = prepareRuntimeDefinitionChange(
        before,
        kind,
        request,
        repository.repositoryBinding,
        revision.revisionIdentity,
      );
      if (candidate.status !== "prepared")
        result = { ...candidate, value: null };
      else {
        const decoded = decodeRuntimeDomainSnapshot(
          candidate.bytes,
          repository.repositoryBinding,
        );
        const binding = readCoordinatorStorageOwnerBinding(owner);
        if (decoded && binding && repository.revalidate()) {
          const saved = commitCoordinatorStateSnapshotOwned({
            repository: binding.repository,
            candidate: decoded,
            bytes: candidate.bytes,
            settlement: null,
            unissued: undefined,
            hostCleanupPublication: undefined,
            managementCapability: null,
            currentRepair: null,
            currentAuthenticationClosure: null,
            initializationOwner: owner,
            currentHistory: null,
            currentDelivery: null,
            currentCompletion: null,
            attempt: {
              revision: decoded.snapshot.revision,
              payloadSha256: decoded.payloadSha256,
              recoveryIds: references,
            },
            storageOwner: owner,
            lock: binding.lock,
            corePublication: {
              before,
              kind,
              request,
              revision: revision.revisionIdentity,
            },
          });
          effect = saved.filesystemEffectIssued;
          publication = saved.snapshotConfirmed
            ? "confirmed"
            : effect
              ? "unconfirmed"
              : "not_published";
          result =
            saved.snapshotConfirmed && repository.revalidate()
              ? {
                  status: "saved",
                  value: candidate.value as RuntimeDefinitionValues[K],
                  version: {
                    revision: decoded.snapshot.revision,
                    payloadSha256: decoded.payloadSha256,
                  },
                }
              : effect
                ? {
                    status: "unknown",
                    value: null,
                    reason: "publication_unconfirmed",
                    publication,
                    recoveryReferences: references,
                  }
                : {
                    status: "blocked",
                    value: null,
                    reason: "state_unavailable",
                  };
        }
      }
    }
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError) {
      effect ||= error.effectIssued;
      if (error.recoveryReference)
        references = Object.freeze([
          ...new Set([...references, error.recoveryReference]),
        ]);
    }
    result = effect
      ? {
          status: "unknown",
          value: null,
          reason: "publication_unconfirmed",
          publication:
            publication === "confirmed" ? "confirmed" : "unconfirmed",
          recoveryReferences: references,
        }
      : { status: "blocked", value: null, reason: "state_unavailable" };
  } finally {
    try {
      released = owner.release();
    } catch {
      released = false;
    }
  }
  if (!released)
    return {
      status: "unknown",
      value: null,
      reason: "lock_release_unconfirmed",
      publication,
      recoveryReferences: references,
    };
  return result;
}

/**
 * 取得済みOwnerの空の初期状態を既存一回出版で確定する。
 * @responsibility 空の初期化形式と初回I/O条件を一箇所で所有する。
 * @trace ARCH-000008
 * @input owner、binding: 現在保持する保存Ownerと内容結合。
 * @returns 元の初期化結果。
 * @precondition 外側が同じOwnerの解放を所有する。
 * @postcondition Provider選定・実行・偽Taskを生成しない。
 * @effect 既存の初回保存だけ。
 * @failure 不在不明・既存異内容・保存不明を拒否する。
 * @invariant 初期化と通常保存を別Writerにしない。
 * @boundary 明示初期化と共通保存。
 * @security Root公開APIへOwnerを出さない。
 * @concurrency 取得済みの短期Ownerだけを使用する。
 */
function initializeRuntimeSnapshotOwned(
  owner: CoordinatorStorageOwner,
  binding: string,
): StoreResult<string> {
  const observed = readCoordinatorStorageSnapshotOwned(owner);
  if (
    observed.status !== "completed" &&
    observed.reason !== "coordinator_state_uninitialized"
  )
    return blocked(observed.reason, true);
  else if (
    observed.value?.snapshot.repositoryBindingId !== null &&
    observed.value
  )
    return observed.value.snapshot.repositoryBindingId === binding &&
      observed.value.snapshot.intakeEpoch
      ? completed(
          "orchestrator_snapshot_initialized",
          observed.value.snapshot.intakeEpoch,
        )
      : blocked("orchestrator_snapshot_binding_invalid");
  else {
    const revision = observed.value?.snapshot.revision ?? 0;
    const payload: CoordinatorSnapshot = {
      schema: COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
      schemaRevision: 6,
      repositoryRootHash: owner.repositoryRootHash,
      repositoryBindingId: binding,
      snapshotRevision: revision + 1,
      intakeEpoch: `epoch-${randomUUID()}`,
      intakeBindings: [],
      projects: [],
      workspaces: [],
      queueEntries: [],
      leaseEvidence: [],
      leaseIntents: [],
      results: [],
      historyPending: [],
      decisions: [],
      blockers: [],
    };
    const saved = writeCoordinatorSnapshotOwned(
      owner,
      binding,
      encodeRuntimeStateValue(payload),
      revision,
    );
    return saved.status === "completed"
      ? completed("orchestrator_snapshot_initialized", saved.value.intakeEpoch)
      : saved;
  }
}

/**
 * AI設定や管理実行なしで共通状態を明示初期化する。
 * @responsibility 真正不存在を同じ短期排他下で確認し既存初回Writerへ接続する。
 * @trace ARCH-000008
 * @input access、request: 内容認可とexpectedAbsence:trueを伴う対象。
 * @returns 初回版と受付世代、又は固定拒否・未確定。
 * @precondition 旧領域の移行・過去保持物の処置はこのAPIへ委譲しない。
 * @postcondition 既存状態を上書きせずProvider資格を要求しない。
 * @effect Repository内の既存共通状態だけ。
 * @failure 存在・pending・移行不明・認可失効では保存しない。
 * @invariant 新しい初期化状態・Writer・台帳を追加しない。
 * @boundary 一般HostとDomain共通保存。
 * @security Host ContextをJSON入力にしない。
 * @concurrency 同じ短期Ownerの解放確認後だけ成功を返す。
 */
export function initializeRuntimeState(
  access: RuntimeAccess,
  request: Readonly<{
    projectId: string;
    milestoneId: string;
    expectedAbsence: true;
  }>,
): RuntimeWriteResult<Readonly<{ intakeEpoch: string }>> {
  const input = snapshotPlainRecord(
    request,
    new Set(["projectId", "milestoneId", "expectedAbsence"]),
  );
  const target = runtimeContentTarget(input);
  if (input?.expectedAbsence !== true || !target)
    return { status: "blocked", value: null, reason: "input_invalid" };
  const repository = observeRuntimeContentRepository(
    access,
    "definition.write",
    target,
  );
  if (!repository)
    return { status: "blocked", value: null, reason: "not_authorized" };
  const acquisition = acquireCoordinatorStorageOwnerForRepository(repository);
  if (acquisition.status !== "completed") {
    if (!acquisition.manualRecoveryRequired)
      return { status: "blocked", value: null, reason: "lock_unavailable" };
    return {
      status: "unknown",
      value: null,
      reason:
        acquisition.reason ===
        "coordinator_state_lock_descriptor_close_unconfirmed"
          ? "lock_descriptor_close_unconfirmed"
          : "lock_initialization_failed",
      publication: "not_published",
      recoveryReferences: acquisition.recoveryId
        ? [acquisition.recoveryId]
        : [],
    };
  }
  const owner = acquisition.value;
  let result: RuntimeWriteResult<Readonly<{ intakeEpoch: string }>> = {
    status: "blocked",
    value: null,
    reason: "state_unavailable",
  };
  let publication: "not_published" | "unconfirmed" | "confirmed" =
    "not_published";
  let released = false;
  let effects = false;
  const references: string[] = [];
  try {
    const before = readCoordinatorStorageSnapshotOwned(owner);
    if (before.status === "completed" && before.value)
      result = { status: "blocked", value: null, reason: "target_exists" };
    else if (
      before.reason === "coordinator_state_uninitialized" &&
      repository.revalidate()
    ) {
      assertRuntimeStateInitializationBoundary(access.root);
      effects = true;
      const binding =
        "binding-" +
        createHash("sha256")
          .update(repository.repositoryRoot)
          .digest("hex")
          .slice(0, 40);
      const saved = initializeRuntimeSnapshotOwned(owner, binding);
      const current = readCoordinatorStorageSnapshotOwned(owner, true);
      if (
        saved.status === "completed" &&
        current.status === "completed" &&
        current.value &&
        repository.revalidate()
      ) {
        publication = "confirmed";
        result = {
          status: "saved",
          value: { intakeEpoch: saved.value },
          version: {
            revision: current.value.snapshot.revision,
            payloadSha256: current.value.payloadSha256,
          },
        };
      } else {
        if (saved.status === "blocked" && saved.recoveryId)
          references.push(saved.recoveryId);
        publication = "unconfirmed";
        result = {
          status: "unknown",
          value: null,
          reason: "publication_unconfirmed",
          publication,
          recoveryReferences: references,
        };
      }
    }
  } catch (error) {
    if (
      error instanceof RepositoryRuntimeDataAreaBlockedError &&
      error.recoveryReference
    )
      references.push(error.recoveryReference);
    result = effects
      ? {
          status: "unknown",
          value: null,
          reason: "publication_unconfirmed",
          publication: "unconfirmed",
          recoveryReferences: references,
        }
      : { status: "blocked", value: null, reason: "state_unavailable" };
  } finally {
    try {
      released = owner.release();
    } catch {
      released = false;
    }
  }
  if (!released)
    return {
      status: "unknown",
      value: null,
      reason: "lock_release_unconfirmed",
      publication,
      recoveryReferences: references,
    };
  return result;
}

/**
 * 一般Queryの対象別投影を同じReaderへ接続する。
 * @responsibility 入口・短期排他内・返却前の認可と明示不存在を維持する。
 * @trace ARCH-000008
 * @input access、kind、request: Host接続と固定Query用途・対象。
 * @returns 値、明示不存在、拒否又は観測不能。
 * @precondition Hostの既存内容権限を同期照合する。
 * @postcondition Snapshot全体・Owner・秘密値を返さない。
 * @effect 共通状態の読取りと既存短期排他だけ。
 * @failure 失効・Root差・不正・解放不明を値なしで返す。
 * @invariant 実行・Claim・回復を開始しない。
 * @boundary Core Queryと共通保存。
 * @security callback投影・任意field選択を公開しない。
 * @concurrency 同じOwnerをfinallyで解放する。
 */
export function readRuntimeContent<K extends keyof RuntimeContentViews>(
  access: RuntimeAccess,
  kind: K,
  request: Readonly<{ projectId: string; milestoneId: string }>,
): RuntimeReadResult<RuntimeContentViews[K]> {
  const input = snapshotPlainRecord(
    request,
    new Set(["projectId", "milestoneId"]),
  );
  const target = runtimeContentTarget(input);
  if (!target)
    return { status: "blocked", value: null, reason: "input_invalid" };
  const operation =
    kind === "decisions"
      ? "decision.read"
      : kind === "queue"
        ? "queue.read"
        : kind === "runtime" || kind === "workspaces"
          ? "runtime.read"
          : "definition.read";
  const repository = observeRuntimeContentRepository(access, operation, target);
  if (!repository)
    return { status: "blocked", value: null, reason: "not_authorized" };
  const acquisition = acquireCoordinatorStorageOwnerForRepository(repository);
  if (acquisition.status !== "completed") {
    if (!acquisition.manualRecoveryRequired)
      return { status: "blocked", value: null, reason: "lock_unavailable" };
    return {
      status: "unknown",
      value: null,
      reason:
        acquisition.reason ===
        "coordinator_state_lock_descriptor_close_unconfirmed"
          ? "lock_descriptor_close_unconfirmed"
          : "lock_initialization_failed",
      recoveryReferences: acquisition.recoveryId
        ? [acquisition.recoveryId]
        : [],
    };
  }
  const owner = acquisition.value;
  let result: RuntimeReadResult<RuntimeContentViews[K]> = {
    status: "unknown",
    value: null,
    reason: "state_unavailable",
  };
  let released = false;
  try {
    const current = readCoordinatorStorageSnapshotOwned(owner, true);
    if (current.reason === "coordinator_state_uninitialized")
      result = { status: "absent", value: null, version: null };
    else if (
      current.status === "completed" &&
      current.value &&
      repository.revalidate()
    ) {
      const snapshot = current.value.snapshot;
      const version = {
        revision: snapshot.revision,
        payloadSha256: current.value.payloadSha256,
      };
      const project = snapshot.projects.find(
        (p) =>
          p.projectId === target.projectId &&
          p.milestoneId === target.milestoneId,
      );
      if (!project) result = { status: "absent", value: null, version };
      else {
        const execution =
          snapshot.managedExecutions.find(
            (p) =>
              p.projectId === project.projectId &&
              p.milestoneId === project.milestoneId,
          ) ?? null;
        const queues = snapshot.queueEntries.filter(
          (q) =>
            q.projectId === project.projectId &&
            q.milestoneId === project.milestoneId,
        );
        let value: RuntimeContentViews[keyof RuntimeContentViews];
        if (kind === "plan")
          value = {
            definition: {
              milestoneAcceptanceCriteria: project.milestone.acceptanceCriteria,
              objectives: project.objectives.map((o) => o.definition),
              tasks: project.tasks,
            },
            definitionHash: hashRuntimeProjectDefinition(project),
          };
        else if (kind === "objectives")
          value = project.objectives.map((o) => ({
            definition: o.definition,
            definitionHash: hashRuntimeEntityDefinition(
              project,
              "objective",
              o.definition,
            ),
          }));
        else if (kind === "tasks")
          value = project.tasks.map((definition) => ({
            definition,
            definitionHash: hashRuntimeEntityDefinition(
              project,
              "task",
              definition,
            ),
            execution:
              execution?.tasks.find((t) => t.taskId === definition.id) ?? null,
          }));
        else if (kind === "decisions")
          value = {
            decisions: snapshot.decisions.filter(
              (d) =>
                d.target.projectId === project.projectId &&
                d.target.milestoneId === project.milestoneId,
            ),
            blockers: snapshot.blockers.filter(
              (b) =>
                b.target.projectId === project.projectId &&
                b.target.milestoneId === project.milestoneId,
            ),
          };
        else if (kind === "queue") value = queues;
        else if (kind === "workspaces")
          value = snapshot.workspaces.filter((w) =>
            queues.some((q) => q.workspaceId === w.workspaceId),
          );
        else value = { project, execution };
        result = repository.revalidate()
          ? {
              status: "available",
              value: value as RuntimeContentViews[K],
              version,
            }
          : { status: "blocked", value: null, reason: "not_authorized" };
      }
    }
  } catch {
    result = { status: "unknown", value: null, reason: "state_unavailable" };
  } finally {
    try {
      released = owner.release();
    } catch {
      released = false;
    }
  }
  if (!released)
    return {
      status: "unknown",
      value: null,
      reason: "lock_release_unconfirmed",
    };
  if (!repository.revalidate())
    return { status: "blocked", value: null, reason: "not_authorized" };
  return result;
}

/**
 * 対象のCore状態と管理実行を照会する。
 * @responsibility runtimeの有限投影だけを返す。
 * @trace ARCH-000008
 * @input access、request: Host認可と対象ID。
 * @returns 値・不存在・拒否・観測不能。
 * @precondition 既存内容権限を使用する。
 * @postcondition 値を実行又は回復Authorityにしない。
 * @effect 共通Readerの有限照会だけ。
 * @failure 現在認可・保存・排他の不明を隠さない。
 * @invariant AI・Git・Docker・自動受付を起動しない。
 * @boundary 一般QueryとDomain保存。
 * @security Snapshot全体・Host Pathを返さない。
 * @concurrency 返却前に再認可する。
 */
export function queryRuntimeState(
  access: RuntimeAccess,
  request: Readonly<{ projectId: string; milestoneId: string }>,
) {
  return readRuntimeContent(access, "runtime", request);
}

/**
 * 管理実行Ownerが検査した一Project状態を保存する。
 * @responsibility 完了・受領の既存相関を保持し一般定義CRUDと区別する。
 * @trace ARCH-000008
 * @input workingDirectory、binding、state、expectedGeneration、intake、resultFacts: 既存管理実行の固定入力。
 * @returns 管理Projectの保存結果。
 * @precondition 実行Ownerが状態遷移・受領・実Leaseを検査している。
 * @postcondition 任意Snapshotや他区画の変更を受け付けない。
 * @effect 同じ短期Ownerと単一Writerだけ。
 * @failure 不正値・元版差・受領相関差・保存不明を拒否する。
 * @invariant 一般CRUDから完了・受入を捏造しない。
 * @boundary 管理実行の状態OwnerとDomain保存。
 * @security 生Snapshot Writerを公開しない。
 * @concurrency CASと解放確認を同じ保存呼出しへ閉じる。
 */
export function saveCoordinatorManagedProject(
  workingDirectory: Repository,
  binding: string,
  state: CoordinatorState,
  expectedGeneration: number,
  intake?: Parameters<typeof writeCoordinatorSnapshotState>[4],
  resultFacts: readonly ProjectTaskResultFact[] = [],
): StoreResult<CoordinatorState> {
  if (typeof workingDirectory !== "object" || workingDirectory === null)
    return blocked("orchestrator_repository_root_invalid");
  try {
    return writeCoordinatorSnapshotState(
      workingDirectory,
      binding,
      encodeRuntimeStateValue(state),
      expectedGeneration,
      intake,
      resultFacts,
    );
  } catch {
    return blocked("orchestrator_snapshot_input_invalid");
  }
}

/**
 * 中断後のtransient操作だけの終了出版候補を読む。
 * @responsibility 表示受領を要求せず、真正回収Ownerへ同じ終了候補を渡す。
 * @trace ARCH-000008
 * @input rootCapability: 現在Root、recoveryId: exact対象参照。
 * @returns 現在操作と終了候補、または値なし停止。
 * @precondition 実資源・Host・Ownerの終了観測は回収Ownerが別に所有する。
 * @postcondition 読取りだけで操作除去・Task成功・受領を主張しない。
 * @effect 固定state／history／保存途中材料と短期排他の読取りだけ。
 * @failure durable、未終端、未確認履歴、別候補と不明は拒否する。
 * @invariant 通常Reader、durable ACK、通常live経路を変更しない。
 * @boundary 現在Repositoryとtransient終了出版の有限形。
 * @security 任意consumer、候補本文、受領値を受け取らない。
 * @concurrency 元本文・候補・File実体をReaderとWriterで再照合する。
 */
export function readRuntimeOwnedCoordinatorCurrentCompletionSnapshot(
  rootCapability: unknown,
  recoveryId: unknown,
) {
  return readCoordinatorStateSnapshot(
    typeof recoveryId === "string" && parseDockerTaskRecoveryId(recoveryId)
      ? observeRuntimeRecoveryRepository(rootCapability)
      : null,
    null,
    null,
    null,
    null,
    typeof recoveryId === "string" ? recoveryId : null,
  );
}

/**
 * exact修復の終了候補または履歴に相関した除去済み状態を読む。
 * @responsibility TaskのACK条件を修復へ流用せず既存Readerを種別固定する。
 * @trace ARCH-000008
 * @input rootCapability: 現在Root、recoveryId: exact修復参照。
 * @returns 本文・候補・除去観測と排他解放、またはblocked。
 * @precondition 現在Repositoryの保存Ownerから呼ぶ。
 * @postcondition 読取りだけでは除去や技術処置を許可しない。
 * @effect 固定state／historyと短期排他の読取りだけ。
 * @failure 別種・未終端・不明・別pendingは拒否する。
 * @invariant 履歴欠測から過去の完了を推定しない。
 * @boundary 修復終了と既存保存Reader。
 * @security 任意Path・候補・Consumerを受け取らない。
 * @concurrency Kernel排他下でFile実体と元本文を確認する。
 */
export function readRuntimeOwnedCoordinatorRepairCompletionSnapshot(
  rootCapability: unknown,
  recoveryId: unknown,
) {
  return readCoordinatorStateSnapshot(
    typeof recoveryId === "string" &&
      /^docker-runtime-repair\.[0-9a-f]{64}\.[0-9a-f]{64}$/u.test(recoveryId)
      ? observeRuntimeRecoveryRepository(rootCapability)
      : null,
    null,
    null,
    null,
    null,
    typeof recoveryId === "string" ? recoveryId : null,
    "docker_task",
    "runtime_repair",
  );
}
