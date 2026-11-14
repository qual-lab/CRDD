/**
 * 実行State・複数モデルの同版取得・Lease保存の完成操作を提供する。
 * @responsibility 共通保存処理へ接続し、既存の排他・改訂検査・通知順序を維持する。
 * @trace ARCH-000008
 */
import path from "node:path";
import { hashExecutionProjectDefinition } from "../objective/validation.ts";
import {
  leaseAcquisitionRecoveryId,
  leaseIdentity,
  snapshotStateArray,
  validId,
  encodeStateValue,
  isSha256Hex,
  snapshotStateRecord,
  createLeaseEvidence,
  normalizeRepositoryRelativePath,
  isStateObject,
  hasStateKeys,
} from "./operations.ts";
import { createHash, randomUUID } from "node:crypto";
import { types } from "node:util";
import type { Repository } from "../../../version-control/src/index.ts";
import {
  getRepository,
  readRepositoryRevision,
} from "../../../version-control/src/index.ts";
import type {
  ExecutionOperationRecord,
  RecoveryReadRequest,
} from "../attempt/types.ts";
import {
  createDockerRestartRequestId,
  parseDockerTaskRecoveryId,
} from "../attempt/validation.ts";
import {
  hashExecutionEntityDefinition,
  prepareExecutionDefinitionChange,
} from "../objective/operations.ts";
import type {
  HistoryRepositoryInput,
  SnapshotOwner,
  StorageOwner,
  StoreResult,
} from "../storage/lock.ts";
import {
  acquireSnapshotPilotLock,
  acquireStorageOwnerForRepository,
  blocked,
  completed,
  isLiveSnapshotOwner,
  isLiveStorageOwner,
  observeExecutionContentRepository,
  observeExecutionRecoveryRepository,
  observeOperationRepository,
  readStorageOwnerBinding,
} from "../storage/lock.ts";
import {
  publishRecoveryState,
  publishStateOwned,
  writeStateSnapshot,
} from "../storage/publication.ts";
import type { StorageRepository } from "../storage/store.ts";
import {
  assertAreaUnchanged,
  assertDirectory,
  assertExecutionStateInitializationBoundary,
  createExecutionDataArea,
  ExecutionStorageBlockedError,
  ensureRepositoryExecutionDataArea,
  inspectDecisionHistorySettlement,
  inspectHistorySettlement,
  leaseAcquisitionFootprintAbsent,
  observeArea,
  pathConfirmedAbsent,
  readSnapshot,
  readSnapshotOwned,
  readStateSnapshot,
  readStorageSnapshotOwned,
  requireReadyRepositoryExecutionDataArea,
} from "../storage/store.ts";
import type {
  ProjectTaskResultFact,
  ProjectQueueEntry,
  SingleTaskRecord,
} from "../task/types.ts";
import {
  prepareUnifiedTaskSections,
  projectTaskSnapshot,
  decodeStateSnapshot,
  EXECUTION_STATE_SCHEMA,
  prepareAuthenticationUnknownClosureSnapshot,
  prepareStateHostSnapshot,
  prepareStateOperationSnapshot,
  projectCurrentState,
  snapshotIntakeMatches,
  validSnapshot,
} from "./validation.ts";
import { validState } from "../task/validation.ts";
import type {
  ExecutionContentViews,
  ExecutionDefinitionValues,
  ExecutionModelAccess,
  ExecutionModelReadResult,
  ExecutionModelSaveResult,
  LeaseAcquisitionRequest,
  LeaseReadRequest,
  LeaseRecoveryRequest,
  LeaseReleaseRequest,
  ProjectExecutionState,
  Snapshot,
  SnapshotObservations,
  LeaseEvidenceEnvelope,
  LeaseKind,
} from "./types.ts";
import { PROJECT_SNAPSHOT_SCHEMA } from "./types.ts";
import {
  validateDecisionRetirement,
  validateDecisionSnapshotTransition,
} from "../decision/validation.ts";
import type { ResultRecord } from "../workspace/types.ts";
import { adoptionWasRejected } from "../workspace/validation.ts";
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
export function observeSnapshotObligations(
  owner: SnapshotOwner,
): SnapshotObservations {
  return {
    schema: PROJECT_SNAPSHOT_SCHEMA,
    processId: process.pid,
    leaseResourcesAbsent: (identity) =>
      snapshotLeaseResourcesAbsent(owner.repositoryRoot, identity),
    historySettlement: (row) => inspectHistorySettlement(owner, row),
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
export function initializeExecutionStore(
  workingDirectory: Repository,
  binding: string,
): StoreResult<string> {
  if (typeof workingDirectory !== "object" || workingDirectory === null)
    return blocked("orchestrator_repository_root_invalid");
  if (!validId(binding)) return blocked("orchestrator_snapshot_input_invalid");
  const acquired = acquireSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const owner = acquired.value;
  let result: StoreResult<string>;
  let boundaryError: ExecutionStorageBlockedError | null = null;
  try {
    result = initializeExecutionSnapshotOwned(owner, binding);
  } catch (error) {
    if (error instanceof ExecutionStorageBlockedError) boundaryError = error;
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
export function writeSnapshotState(
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
): StoreResult<ProjectExecutionState> {
  let state: ProjectExecutionState;
  try {
    if (
      !validId(binding) ||
      typeof stateJson !== "string" ||
      !Number.isSafeInteger(expectedGeneration) ||
      expectedGeneration < 0
    )
      throw new Error("snapshot_state_input_invalid");
    const parsed: unknown = JSON.parse(stateJson);
    if (!validState(parsed) || parsed.generation !== expectedGeneration + 1)
      throw new Error("snapshot_state_input_invalid");
    Object.freeze(parsed.taskExecutionSelections.executor);
    Object.freeze(parsed.taskExecutionSelections.reviewer);
    Object.freeze(parsed.taskExecutionSelections);
    state = parsed;
  } catch {
    return blocked("orchestrator_state_generation_mismatch");
  }
  const acquired = acquireSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const lock = acquired.value;
  let outcome: StoreResult<ProjectExecutionState>;
  let boundaryError: ExecutionStorageBlockedError | null = null;
  try {
    const observed = readSnapshotOwned(lock, binding, true);
    if (observed.status !== "completed") outcome = blocked(observed.reason);
    else if (observed.value === null)
      outcome = blocked("orchestrator_snapshot_absent");
    else {
      const current = observed.value;
      if (intake && !snapshotIntakeMatches(current, intake))
        outcome = blocked("orchestrator_intake_epoch_retired");
      else {
        const previous = current.projects.find(
          (item) => item.projectId === state.projectId,
        );
        if (
          previous?.generation === expectedGeneration + 1 &&
          encodeStateValue(previous) === encodeStateValue(state)
        ) {
          const saved = writeSnapshotOwned(
            lock,
            binding,
            encodeStateValue(current),
            current.snapshotRevision - 1,
            resultFacts.map((fact) => ({
              ...fact,
              projectId: state.projectId,
            })),
          );
          outcome =
            saved.status === "completed"
              ? completed("orchestrator_state_durable", previous)
              : saved;
        } else if ((previous?.generation ?? 0) !== expectedGeneration)
          outcome = blocked("orchestrator_state_generation_conflict");
        else {
          const projects = previous
            ? current.projects.map((item) =>
                item.projectId === state.projectId ? state : item,
              )
            : [...current.projects, state];
          const saved = writeSnapshotOwned(
            lock,
            binding,
            encodeStateValue({
              ...current,
              snapshotRevision: current.snapshotRevision + 1,
              projects,
            }),
            current.snapshotRevision,
            resultFacts.map((fact) => ({
              ...fact,
              projectId: state.projectId,
            })),
          );
          outcome =
            saved.status === "completed"
              ? completed("orchestrator_state_durable", state)
              : saved;
        }
      }
    }
  } catch (error) {
    if (error instanceof ExecutionStorageBlockedError) boundaryError = error;
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
 * @effect Repository-localのstate.pending.json、state.jsonを更新する。
 * @failure 排他、Root、世代、Hash、保存または回収不明で停止する。
 * @invariant 実データの旧Writerを自動切替せず、旧記録を削除しない。
 * @boundary 現在状態のFilesystem保存。
 * @security 保護Decisionと任意Pathを受け取らない。
 * @concurrency 同Rootの短期OS排他だけを保持し外部待機しない。
 */
export function writeSnapshot(
  workingDirectory: string | Repository | HistoryRepositoryInput,
  binding: string,
  payloadJson: string,
  expectedRevision: number,
): StoreResult<Snapshot> {
  const acquired = acquireSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const lock = acquired.value;
  let boundaryError: ExecutionStorageBlockedError | null = null;
  let outcome: StoreResult<Snapshot>;
  try {
    outcome = writeSnapshotOwned(lock, binding, payloadJson, expectedRevision);
  } catch (error) {
    if (error instanceof ExecutionStorageBlockedError) boundaryError = error;
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
 * @effect pending・現在Fileの保存を行う。
 * @failure Root・世代・記録・保存・観測の不明時は保全停止する。
 * @invariant 自己再取得せず、既存の遷移検査を維持する。
 * @boundary 排他Owner内の保存更新。
 * @security 旧Writerの自動切替や記録削除を発行しない。
 * @concurrency 外部待機を行わず短期排他の保持範囲で保存する。
 */
export function writeSnapshotOwned(
  lock: SnapshotOwner,
  binding: string,
  payloadJson: string,
  expectedRevision: number,
  resultFacts: unknown = [],
): StoreResult<Snapshot> {
  try {
    if (
      !isLiveSnapshotOwner(lock) ||
      !validId(binding) ||
      typeof payloadJson !== "string" ||
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0
    )
      return blocked("orchestrator_snapshot_input_invalid");
    const payload: unknown = JSON.parse(payloadJson);
    if (
      !validSnapshot(payload, binding, lock.repositoryRootHash) ||
      payload.snapshotRevision !== expectedRevision + 1
    )
      return blocked("orchestrator_snapshot_input_invalid");
    const observed = readStorageSnapshotOwned(lock, true);
    let current: Snapshot | null = null;
    if (observed.status === "completed" && observed.value) {
      const decoded = decodeStateSnapshot(
        Buffer.from(`${encodeStateValue(observed.value.snapshot)}\n`),
        lock.repositoryBinding,
      );
      if (!decoded)
        return blocked("orchestrator_snapshot_invalid_or_unconfirmed", true);
      current = projectTaskSnapshot(decoded, lock.repositoryRootHash);
      if (current && current.repositoryBindingId !== binding)
        return blocked("orchestrator_snapshot_binding_invalid", true);
      if (
        observed.value.snapshot.revision !== expectedRevision &&
        !(
          current &&
          current.snapshotRevision === payload.snapshotRevision &&
          encodeStateValue(current) === encodeStateValue(payload)
        )
      )
        return blocked("orchestrator_snapshot_revision_conflict");
    } else if (observed.reason !== "coordinator_state_uninitialized")
      return blocked(observed.reason, true);
    if (current && encodeStateValue(current) !== encodeStateValue(payload))
      assertSnapshotTransition(
        current,
        payload,
        observeSnapshotObligations(lock),
      );
    if (
      !current &&
      !Object.values(payload)
        .filter(Array.isArray)
        .every((values) => values.length === 0)
    )
      return blocked("orchestrator_snapshot_initialization_required");
    const saved = writeStorageTaskSnapshotOwned(
      lock,
      payload,
      expectedRevision,
      resultFacts,
    );
    return saved.status === "completed" && saved.value
      ? completed("orchestrator_snapshot_durable", saved.value)
      : blocked(saved.reason, saved.filesystemEffectIssued);
  } catch (error) {
    if (error instanceof ExecutionStorageBlockedError) throw error;
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
export function withSnapshotOperation<T>(
  workingDirectory: Repository | HistoryRepositoryInput,
  binding: string,
  operation: (
    current: Snapshot,
    owner: SnapshotOwner,
  ) => StoreResult<Readonly<{ next: Snapshot | null; value: T }>>,
  readMode: false | "history" = false,
): StoreResult<T> {
  if (typeof workingDirectory !== "object" || workingDirectory === null)
    return blocked("orchestrator_repository_root_invalid");
  if (!validId(binding)) return blocked("orchestrator_snapshot_input_invalid");
  const acquired = acquireSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const owner = acquired.value;
  let result: StoreResult<T>;
  try {
    const observed = readSnapshotOwned(owner, binding, readMode);
    if (observed.status !== "completed") result = observed;
    else if (observed.value === null)
      result = blocked("orchestrator_snapshot_absent");
    else {
      const applied = operation(observed.value, owner);
      if (applied.status !== "completed") result = applied;
      else if (applied.value.next === null)
        result = completed(applied.reason, applied.value.value);
      else {
        const saved = writeSnapshotOwned(
          owner,
          binding,
          encodeStateValue({
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
    path.join(parent, `coordinator.lease.${identity}.lock`),
  ]);
  assertDirectory(repositoryRoot);
  assertDirectory(parent);
  assertAreaUnchanged(repositoryRoot, "lock", boundary);
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
export function saveAuthenticationClosure(
  repository: StorageRepository & { operationId: string },
  recoveryId: string,
  before: Buffer,
  observations: unknown,
  assertOwner: () => boolean,
) {
  const blocked = () => writeStateSnapshot(null, null, null, null);
  if (
    !Buffer.isBuffer(before) ||
    typeof assertOwner !== "function" ||
    types.isAsyncFunction(assertOwner)
  )
    return blocked();
  try {
    if (assertOwner() !== true || !repository.revalidate()) return blocked();
    const fixedBefore = Buffer.from(before);
    const fixedObservations: unknown = JSON.parse(
      encodeStateValue(observations),
    );
    const candidate = prepareAuthenticationUnknownClosureSnapshot(
      fixedBefore,
      recoveryId,
      fixedObservations,
      repository.repositoryBinding,
    );
    if (!candidate) return blocked();
    const beforeTasks = decodeStateSnapshot(
      fixedBefore,
      repository.repositoryBinding,
    )?.snapshot.operations.filter(
      (item) => item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    const candidateTasks = decodeStateSnapshot(
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
    return publishRecoveryState({
      kind: "authentication_unknown_closure",
      repository,
      recoveryId,
      before: fixedBefore,
      candidate,
      observations: fixedObservations,
      assertOwner,
    });
  } catch {
    return blocked();
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
export function writeStorageTaskSnapshotOwned(
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
      value: null as Snapshot | null,
    });
  const binding =
    owner && typeof owner === "object" ? readStorageOwnerBinding(owner) : null;
  if (!binding || !isLiveStorageOwner(owner))
    return rejected("coordinator_state_owner_invalid");
  const issued = owner as StorageOwner;
  try {
    const view: unknown = JSON.parse(encodeStateValue(viewValue));
    const facts: unknown = JSON.parse(encodeStateValue(factsValue));
    if (
      !view ||
      typeof view !== "object" ||
      !validSnapshot(
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
    const observed = readStorageSnapshotOwned(owner, true);
    let before: Buffer | null = null,
      initialBoundary: string | null = null;
    let bytes: Buffer | null = null;
    if (observed.status === "completed" && observed.value) {
      before = Buffer.from(`${encodeStateValue(observed.value.snapshot)}\n`);
      const currentTask = decodeStateSnapshot(before, issued.repositoryBinding);
      if (!currentTask)
        return rejected("coordinator_task_publication_input_invalid");
      if (
        observed.value.snapshot.revision === view.snapshotRevision &&
        encodeStateValue(
          projectTaskSnapshot(currentTask, issued.repositoryRootHash),
        ) === encodeStateValue(view)
      )
        bytes = before;
      else if (observed.value.snapshot.revision === expectedRevision)
        bytes = prepareUnifiedTaskSections(
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
      if (verified.status !== "completed" || !isLiveStorageOwner(owner))
        return rejected("coordinator_state_owner_invalid");
      const {
        schema: _schema,
        schemaRevision: _schemaRevision,
        snapshotRevision: _revision,
        repositoryRootHash: _hash,
        ...sections
      } = view;
      bytes = Buffer.from(
        `${encodeStateValue({
          ...sections,
          schema: EXECUTION_STATE_SCHEMA,
          revision: 1,
          previous: null,
          repositoryBinding: issued.repositoryBinding,
          operations: [],
          unresolvedRecoveries: [],
          managedExecutions: [],
        })}\n`,
      );
      if (!decodeStateSnapshot(bytes, issued.repositoryBinding))
        return rejected("coordinator_task_publication_input_invalid");
      assertExecutionStateInitializationBoundary(verified.capability);
      filesystemEffectIssued = true;
      const temporary = requireReadyRepositoryExecutionDataArea(
        ensureRepositoryExecutionDataArea(verified.capability, "tmp"),
        "coordinator_state_initialization_unconfirmed",
      );
      if (temporary?.status !== "ready" || !isLiveStorageOwner(owner))
        return rejected("coordinator_state_initialization_unconfirmed");
      const created = createExecutionDataArea(verified.capability);
      filesystemEffectIssued ||= created.effectIssued;
      if (created.status !== "created")
        return rejected("coordinator_state_initialization_unconfirmed");
      initialBoundary = created.observation.boundaryIdentity;
    }
    const candidate = bytes
      ? decodeStateSnapshot(bytes, issued.repositoryBinding)
      : null;
    if (!bytes || !candidate)
      return rejected("coordinator_task_publication_revision_conflict");
    const result = publishStateOwned(owner, bytes, {
      kind: "task",
      before,
      view,
      facts,
      rootHash: issued.repositoryRootHash,
      initialBoundary,
    });
    filesystemEffectIssued ||= result.filesystemEffectIssued;
    if (!result.snapshotConfirmed || !isLiveStorageOwner(owner))
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
    if (error instanceof ExecutionStorageBlockedError) throw error;
    return rejected("coordinator_task_publication_unconfirmed");
  }
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
export function readProjectExecutionState(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<typeof projectCurrentState> extends [
    unknown,
    ...infer Rest,
  ]
    ? Rest
    : never
) {
  return withSnapshotOperation<
    Extract<
      ReturnType<typeof projectCurrentState>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    projectCurrentState(current, ...input),
  );
}
/** 複合取得で許可する保存区画。技術記録・Owner・生Snapshotは含めない。 */
type StateReadViews = {
  queue: Pick<Snapshot, "queueEntries" | "leaseIntents" | "intakeEpoch">;
  intake: Pick<Snapshot, "intakeEpoch">;
  execution: Pick<
    Snapshot,
    "projects" | "queueEntries" | "intakeEpoch" | "schemaRevision"
  >;
  workspace: Pick<
    Snapshot,
    "projects" | "queueEntries" | "results" | "workspaces" | "snapshotRevision"
  >;
};

/**
 * 同じ保存版から指定したモデル間の関連情報を取得する。
 * @responsibility 固定viewのfieldだけを構築し、モデル単体CRUDと複合取得を分離する。
 * @trace ARCH-000008
 * @input 三引数はRepository・binding・intake/queue/execution/workspace。二引数は元Authorityとoperation/recovery及び用途別input。
 * @returns 元の保存結果と範囲限定の値、又は明示不存在。
 * @precondition 呼出し側が同じRepositoryの操作認可を確認する。
 * @postcondition 通常三scopeは限定投影だけを返す。技術二scopeは元Authorityに従う検査済み記録を返し、新Ownerや任意field選択を公開しない。
 * @effect 既存Readerと一つの短期排他だけ。
 * @failure Root・scope・結合・読取り・解放が不明なら値を返さない。
 * @invariant 不明を不存在へ補完せず、実行・保存・回復を開始しない。
 * @boundary Stateの複合取得と上位の表示・操作判断。
 * @security scopeごとに元の取得範囲を維持し、全技術情報へ広げない。
 * @concurrency 一つの読取り結果から全fieldを構築する。
 */
export function readState<K extends keyof StateReadViews>(
  workingDirectory: Repository,
  binding: string,
  scope: K,
): StoreResult<StateReadViews[K] | null>;
export function readState(
  authority: unknown,
  request: Readonly<{
    scope: "operation";
    input?: Parameters<typeof readOperationStateStage>[1];
  }>,
): ReturnType<typeof readOperationStateStage>;
export function readState(
  authority: unknown,
  request: Readonly<{
    scope: "recovery";
    input?: RecoveryReadRequest | undefined;
  }>,
): ReturnType<typeof readRecoveryState>;
export function readState<K extends keyof StateReadViews>(
  workingDirectory: unknown,
  binding: unknown,
  scope?: K,
):
  | StoreResult<StateReadViews[K] | null>
  | ReturnType<typeof readOperationStateStage>
  | ReturnType<typeof readRecoveryState> {
  if (scope === undefined) {
    const request =
      snapshotStateRecord(binding, new Set(["scope", "input"])) ??
      snapshotStateRecord(binding, new Set(["scope"]));
    if (!request || !Object.hasOwn(request, "scope"))
      return blocked<never>("orchestrator_state_read_scope_invalid");
    if (request.scope === "operation")
      return readOperationStateStage(
        workingDirectory,
        request.input as Parameters<typeof readOperationStateStage>[1],
      );
    if (request.scope === "recovery")
      return request.input === undefined
        ? readRecoveryState(workingDirectory)
        : readRecoveryState(
            workingDirectory,
            request.input as RecoveryReadRequest,
          );
    return blocked<never>("orchestrator_state_read_scope_invalid");
  }
  if (typeof workingDirectory !== "object" || workingDirectory === null)
    return blocked<never>("orchestrator_repository_root_invalid");
  if (
    scope !== "intake" &&
    scope !== "execution" &&
    scope !== "workspace" &&
    scope !== "queue"
  )
    return blocked<never>("orchestrator_state_read_scope_invalid");
  const result =
    scope === "intake"
      ? readSnapshot(workingDirectory as Repository, binding as string, true)
      : readSnapshot(workingDirectory as Repository, binding as string);
  if (result.status !== "completed") return result;
  if (result.value === null) return completed<null>(result.reason, null);
  const current = result.value;
  const value =
    scope === "queue"
      ? {
          queueEntries: current.queueEntries,
          leaseIntents: current.leaseIntents,
          intakeEpoch: current.intakeEpoch,
        }
      : scope === "intake"
        ? { intakeEpoch: current.intakeEpoch }
        : scope === "execution"
          ? {
              projects: current.projects,
              queueEntries: current.queueEntries,
              intakeEpoch: current.intakeEpoch,
              schemaRevision: current.schemaRevision,
            }
          : {
              projects: current.projects,
              queueEntries: current.queueEntries,
              results: current.results,
              workspaces: current.workspaces,
              snapshotRevision: current.snapshotRevision,
            };
  return completed<StateReadViews[K]>(
    result.reason,
    value as StateReadViews[K],
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
function executionContentTarget(request: unknown) {
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
export function saveExecutionDefinition<
  K extends keyof ExecutionDefinitionValues,
>(
  access: ExecutionModelAccess,
  kind: K,
  request: unknown,
): ExecutionModelSaveResult<ExecutionDefinitionValues[K]> {
  const target = executionContentTarget(request);
  if (!target)
    return { status: "blocked", value: null, reason: "input_invalid" };
  const repository = observeExecutionContentRepository(
    access,
    "definition.write",
    target,
  );
  if (!repository)
    return { status: "blocked", value: null, reason: "not_authorized" };
  const acquisition = acquireStorageOwnerForRepository(repository);
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
  let result: ExecutionModelSaveResult<ExecutionDefinitionValues[K]> = {
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
    const current = readStorageSnapshotOwned(owner, true);
    const revision = readRepositoryRevision(access.root);
    if (
      current.status === "completed" &&
      current.value &&
      revision &&
      repository.revalidate()
    ) {
      const before = Buffer.from(
        `${encodeStateValue(current.value.snapshot)}\n`,
      );
      references = Object.freeze(
        current.value.snapshot.operations.map((o) => o.recoveryId),
      );
      const candidate = prepareExecutionDefinitionChange(
        before,
        kind,
        request,
        repository.repositoryBinding,
        revision.revisionIdentity,
      );
      if (candidate.status !== "prepared")
        result = { ...candidate, value: null };
      else {
        const decoded = decodeStateSnapshot(
          candidate.bytes,
          repository.repositoryBinding,
        );
        const binding = readStorageOwnerBinding(owner);
        if (decoded && binding && repository.revalidate()) {
          const saved = publishStateOwned(owner, candidate.bytes, {
            kind: "definition",
            before,
            operation: kind,
            request,
            revision: revision.revisionIdentity,
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
                  value: candidate.value as ExecutionDefinitionValues[K],
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
    if (error instanceof ExecutionStorageBlockedError) {
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
function initializeExecutionSnapshotOwned(
  owner: StorageOwner,
  binding: string,
): StoreResult<string> {
  const observed = readStorageSnapshotOwned(owner);
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
    const payload: Snapshot = {
      schema: PROJECT_SNAPSHOT_SCHEMA,
      schemaRevision: 7,
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
    const saved = writeSnapshotOwned(
      owner,
      binding,
      encodeStateValue(payload),
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
export function initializeExecutionState(
  access: ExecutionModelAccess,
  request: Readonly<{
    projectId: string;
    milestoneId: string;
    expectedAbsence: true;
  }>,
): ExecutionModelSaveResult<Readonly<{ intakeEpoch: string }>> {
  const input = snapshotStateRecord(
    request,
    new Set(["projectId", "milestoneId", "expectedAbsence"]),
  );
  const target = executionContentTarget(input);
  if (input?.expectedAbsence !== true || !target)
    return { status: "blocked", value: null, reason: "input_invalid" };
  const repository = observeExecutionContentRepository(
    access,
    "definition.write",
    target,
  );
  if (!repository)
    return { status: "blocked", value: null, reason: "not_authorized" };
  const acquisition = acquireStorageOwnerForRepository(repository);
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
  let result: ExecutionModelSaveResult<Readonly<{ intakeEpoch: string }>> = {
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
    const before = readStorageSnapshotOwned(owner);
    if (before.status === "completed" && before.value)
      result = { status: "blocked", value: null, reason: "target_exists" };
    else if (
      before.reason === "coordinator_state_uninitialized" &&
      repository.revalidate()
    ) {
      assertExecutionStateInitializationBoundary(access.root);
      effects = true;
      const binding =
        "binding-" +
        createHash("sha256")
          .update(repository.repositoryRoot)
          .digest("hex")
          .slice(0, 40);
      const saved = initializeExecutionSnapshotOwned(owner, binding);
      const current = readStorageSnapshotOwned(owner, true);
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
      error instanceof ExecutionStorageBlockedError &&
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
export function readExecutionContent<K extends keyof ExecutionContentViews>(
  access: ExecutionModelAccess,
  kind: K,
  request: Readonly<{ projectId: string; milestoneId: string }>,
): ExecutionModelReadResult<ExecutionContentViews[K]> {
  if (!["plan", "objectives", "tasks", "queue"].includes(kind))
    return { status: "blocked", value: null, reason: "input_invalid" };
  const input = snapshotStateRecord(
    request,
    new Set(["projectId", "milestoneId"]),
  );
  const target = executionContentTarget(input);
  if (!target)
    return { status: "blocked", value: null, reason: "input_invalid" };
  const operation = kind === "queue" ? "queue.read" : "definition.read";
  const repository = observeExecutionContentRepository(
    access,
    operation,
    target,
  );
  if (!repository)
    return { status: "blocked", value: null, reason: "not_authorized" };
  const acquisition = acquireStorageOwnerForRepository(repository);
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
  let result: ExecutionModelReadResult<ExecutionContentViews[K]> = {
    status: "unknown",
    value: null,
    reason: "state_unavailable",
  };
  let released = false;
  try {
    const current = readStorageSnapshotOwned(owner, true);
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
        let value: ExecutionContentViews[keyof ExecutionContentViews];
        if (kind === "plan")
          value = {
            definition: {
              milestoneAcceptanceCriteria: project.milestone.acceptanceCriteria,
              objectives: project.objectives.map((o) => o.definition),
              tasks: project.tasks,
            },
            definitionHash: hashExecutionProjectDefinition(project),
          };
        else if (kind === "objectives")
          value = project.objectives.map((o) => ({
            definition: o.definition,
            definitionHash: hashExecutionEntityDefinition(
              project,
              "objective",
              o.definition,
            ),
          }));
        else if (kind === "tasks")
          value = project.tasks.map((definition) => ({
            definition,
            definitionHash: hashExecutionEntityDefinition(
              project,
              "task",
              definition,
            ),
            execution:
              execution?.tasks.find((t) => t.taskId === definition.id) ?? null,
          }));
        else value = queues;
        result = repository.revalidate()
          ? {
              status: "available",
              value: value as ExecutionContentViews[K],
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
export function saveProjectExecutionState(
  workingDirectory: Repository,
  binding: string,
  state: ProjectExecutionState,
  expectedGeneration: number,
  intake?: Parameters<typeof writeSnapshotState>[4],
  resultFacts: readonly ProjectTaskResultFact[] = [],
): StoreResult<ProjectExecutionState> {
  if (typeof workingDirectory !== "object" || workingDirectory === null)
    return blocked("orchestrator_repository_root_invalid");
  try {
    return writeSnapshotState(
      workingDirectory,
      binding,
      encodeStateValue(state),
      expectedGeneration,
      intake,
      resultFacts,
    );
  } catch {
    return blocked("orchestrator_snapshot_input_invalid");
  }
}

/**
 * Leaseの固定処置を同じ保存Ownerで確定する。
 * @responsibility Intent・観測・元版の各必須条件を種別ごとに保持する。
 * @trace ARCH-000008
 * @input 検証済みRepository、結合と種別固定の必須入力。
 * @returns 元の保存・拒否・不明結果。
 * @precondition 物理処置と認可は上位Ownerが所有する。
 * @postcondition 他区画とexact Identityを保持する。
 * @effect 元の短期排他・読取り・保存だけ。
 * @failure 不正種別・競合・観測不能は拒否する。
 * @invariant Callbackの短絡順とLock内のRoot結合を変更しない。
 * @boundary モデル保存と上位の物理処置。
 * @security 任意Snapshot更新を受けない。
 * @concurrency 元のwithSnapshotOperation保持区間を維持する。
 */
export function readLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseReadRequest, { kind: "acquisition" }>,
): StoreResult<
  Extract<
    ReturnType<typeof projectLeaseAcquisitionOwner>,
    { status: "completed" }
  >["value"]["value"]
>;
export function readLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseReadRequest, { kind: "owner_loss" }>,
): StoreResult<
  Extract<
    ReturnType<typeof projectLeaseOwnerLossState>,
    { status: "completed" }
  >["value"]["value"]
>;
export function readLease(
  workingDirectory: Repository,
  binding: string,
  request: LeaseReadRequest,
) {
  const captured = snapshotStateRecord(
    request,
    new Set(["kind", "input"]),
  ) as LeaseReadRequest | null;
  if (!captured) return blocked("orchestrator_snapshot_input_invalid");
  switch (captured.kind) {
    case "acquisition": {
      const tuple = snapshotStateArray(captured.input, 1);
      if (tuple.status !== "ok" || tuple.value.length < 1)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof projectLeaseAcquisitionOwner>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current) =>
        projectLeaseAcquisitionOwner(current, ...input),
      );
    }
    case "owner_loss": {
      const tuple = snapshotStateArray(captured.input, 4);
      if (tuple.status !== "ok" || tuple.value.length < 4)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;
      if (
        !validId(binding) ||
        !validId(input[0]) ||
        !validId(input[1]) ||
        (input[2] !== "project-operation" && input[2] !== "canonical-adoption")
      )
        return blocked("orchestrator_snapshot_input_invalid");
      const recoveryId = leaseAcquisitionRecoveryId(
        binding,
        input[0],
        input[1],
        input[2],
      );

      const result = withSnapshotOperation<
        Extract<
          ReturnType<typeof projectLeaseOwnerLossState>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current, owner) =>
        projectLeaseOwnerLossState(current, input[0], input[1], input[2], {
          observeRoot: () => input[3].observeRoot(owner.repositoryRoot),
        }),
      );
      return result.status === "completed"
        ? result
        : Object.freeze({
            ...result,
            recoveryId: result.recoveryId ?? recoveryId,
          });
    }
  }
  return blocked("orchestrator_snapshot_input_invalid");
}

/**
 * Leaseの固定処置を同じ保存Ownerで確定する。
 * @responsibility Intent・観測・元版の各必須条件を種別ごとに保持する。
 * @trace ARCH-000008
 * @input 検証済みRepository、結合と種別固定の必須入力。
 * @returns 元の保存・拒否・不明結果。
 * @precondition 物理処置と認可は上位Ownerが所有する。
 * @postcondition 他区画とexact Identityを保持する。
 * @effect 元の短期排他・読取り・保存だけ。
 * @failure 不正種別・競合・観測不能は拒否する。
 * @invariant Callbackの短絡順とLock内のRoot結合を変更しない。
 * @boundary モデル保存と上位の物理処置。
 * @security 任意Snapshot更新を受けない。
 * @concurrency 元のwithSnapshotOperation保持区間を維持する。
 */
export function recoverLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseRecoveryRequest, { kind: "reconcile" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareReleasedLeaseReconciliation>,
    { status: "completed" }
  >["value"]["value"]
>;
export function recoverLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseRecoveryRequest, { kind: "intent" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareLeaseRecoveryReservation>,
    { status: "completed" }
  >["value"]["value"]
>;
export function recoverLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseRecoveryRequest, { kind: "observed" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareLeaseRecoverySettlement>,
    { status: "completed" }
  >["value"]["value"]
>;
export function recoverLease(
  workingDirectory: Repository,
  binding: string,
  request: LeaseRecoveryRequest,
) {
  const captured = snapshotStateRecord(
    request,
    new Set(["kind", "input"]),
  ) as LeaseRecoveryRequest | null;
  if (!captured) return blocked("orchestrator_snapshot_input_invalid");
  switch (captured.kind) {
    case "reconcile": {
      const tuple = snapshotStateArray(captured.input, 6);
      if (tuple.status !== "ok" || tuple.value.length < 6)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareReleasedLeaseReconciliation>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current, owner) =>
        prepareReleasedLeaseReconciliation(
          current,
          input[0],
          input[1],
          input[2],
          input[3],
          input[4],
          {
            resourcesAbsent: () =>
              input[5].resourcesAbsent(owner.repositoryRoot),
          },
        ),
      );
    }
    case "intent": {
      const tuple = snapshotStateArray(captured.input, 8);
      if (tuple.status !== "ok" || tuple.value.length < 8)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareLeaseRecoveryReservation>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current, owner) =>
        prepareLeaseRecoveryReservation(
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
    case "observed": {
      const tuple = snapshotStateArray(captured.input, 10);
      if (tuple.status !== "ok" || tuple.value.length < 10)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareLeaseRecoverySettlement>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current, owner) => {
        const prepared = prepareLeaseRecoverySettlement(
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
  }
  return blocked("orchestrator_snapshot_input_invalid");
}

/**
 * Leaseの固定処置を同じ保存Ownerで確定する。
 * @responsibility Intent・観測・元版の各必須条件を種別ごとに保持する。
 * @trace ARCH-000008
 * @input 検証済みRepository、結合と種別固定の必須入力。
 * @returns 元の保存・拒否・不明結果。
 * @precondition 物理処置と認可は上位Ownerが所有する。
 * @postcondition 他区画とexact Identityを保持する。
 * @effect 元の短期排他・読取り・保存だけ。
 * @failure 不正種別・競合・観測不能は拒否する。
 * @invariant Callbackの短絡順とLock内のRoot結合を変更しない。
 * @boundary モデル保存と上位の物理処置。
 * @security 任意Snapshot更新を受けない。
 * @concurrency 元のwithSnapshotOperation保持区間を維持する。
 */
export function releaseLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseReleaseRequest, { kind: "intent" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareLeaseReleaseIntent>,
    { status: "completed" }
  >["value"]["value"]
>;
export function releaseLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseReleaseRequest, { kind: "observed" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareLeaseReleaseSettlement>,
    { status: "completed" }
  >["value"]["value"]
>;
export function releaseLease(
  workingDirectory: Repository,
  binding: string,
  request: LeaseReleaseRequest,
) {
  const captured = snapshotStateRecord(
    request,
    new Set(["kind", "input"]),
  ) as LeaseReleaseRequest | null;
  if (!captured) return blocked("orchestrator_snapshot_input_invalid");
  switch (captured.kind) {
    case "intent": {
      const tuple = snapshotStateArray(captured.input, 2);
      if (tuple.status !== "ok" || tuple.value.length < 2)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareLeaseReleaseIntent>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current) =>
        prepareLeaseReleaseIntent(current, ...input),
      );
    }
    case "observed": {
      const tuple = snapshotStateArray(captured.input, 4);
      if (tuple.status !== "ok" || tuple.value.length < 4)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareLeaseReleaseSettlement>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current) =>
        prepareLeaseReleaseSettlement(current, ...input),
      );
    }
  }
  return blocked("orchestrator_snapshot_input_invalid");
}

/**
 * Leaseの固定処置を同じ保存Ownerで確定する。
 * @responsibility Intent・観測・元版の各必須条件を種別ごとに保持する。
 * @trace ARCH-000008
 * @input 検証済みRepository、結合と種別固定の必須入力。
 * @returns 元の保存・拒否・不明結果。
 * @precondition 物理処置と認可は上位Ownerが所有する。
 * @postcondition 他区画とexact Identityを保持する。
 * @effect 元の短期排他・読取り・保存だけ。
 * @failure 不正種別・競合・観測不能は拒否する。
 * @invariant Callbackの短絡順とLock内のRoot結合を変更しない。
 * @boundary モデル保存と上位の物理処置。
 * @security 任意Snapshot更新を受けない。
 * @concurrency 元のwithSnapshotOperation保持区間を維持する。
 */
export function acquireLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseAcquisitionRequest, { kind: "intent" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareLeaseAcquisitionReservation>,
    { status: "completed" }
  >["value"]["value"]
>;
export function acquireLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseAcquisitionRequest, { kind: "observed" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareLeaseAcquisitionConfirmation>,
    { status: "completed" }
  >["value"]["value"]
>;
export function acquireLease(
  workingDirectory: Repository,
  binding: string,
  request: LeaseAcquisitionRequest,
) {
  const captured = snapshotStateRecord(
    request,
    new Set(["kind", "input"]),
  ) as LeaseAcquisitionRequest | null;
  if (!captured) return blocked("orchestrator_snapshot_input_invalid");
  switch (captured.kind) {
    case "intent": {
      const tuple = snapshotStateArray(captured.input, 5);
      if (tuple.status !== "ok" || tuple.value.length !== 5)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;
      const owner = snapshotStateRecord(
        input[3],
        new Set(["ownerGeneration", "ownerProcessId"]),
      );
      if (
        !validId(binding) ||
        !validId(input[0]) ||
        !validId(input[1]) ||
        (input[2] !== "project-operation" &&
          input[2] !== "canonical-adoption") ||
        !owner ||
        !validId(owner.ownerGeneration) ||
        !Number.isSafeInteger(owner.ownerProcessId) ||
        (owner.ownerProcessId as number) <= 0
      )
        return blocked("orchestrator_snapshot_input_invalid");
      const identity = leaseIdentity(binding, input[0], input[1], input[2]);
      const recoveryId = leaseAcquisitionRecoveryId(
        binding,
        input[0],
        input[1],
        input[2],
      );
      const intent: Snapshot["leaseIntents"][number] = {
        projectId: input[0],
        queueId: input[1],
        kind: input[2],
        ownerGeneration: owner.ownerGeneration,
        ownerProcessId: owner.ownerProcessId as number,
        recoveryId,
        phase: "acquisition_reserved",
        physicalIdentity: null,
      };

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareLeaseAcquisitionReservation>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current, owner) =>
        prepareLeaseAcquisitionReservation(
          current,
          binding,
          input[0],
          input[1],
          input[2],
          identity,
          intent,
          {
            resourcesAbsent: () =>
              input[4].resourcesAbsent(owner.repositoryRoot, identity),
            observeRoot: () => input[4].observeRoot(owner.repositoryRoot),
            markIntentSaveRequested: () =>
              input[4].markIntentSaveRequested(recoveryId),
          },
        ),
      );
    }
    case "observed": {
      const tuple = snapshotStateArray(captured.input, 10);
      if (tuple.status !== "ok" || tuple.value.length < 10)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareLeaseAcquisitionConfirmation>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current) =>
        prepareLeaseAcquisitionConfirmation(current, ...input),
      );
    }
  }
  return blocked("orchestrator_snapshot_input_invalid");
}

/**
 * 保存確定済みの最新Snapshotを現在の操作Ownerへ返す。
 * @responsibility 保存途中・不存在・観測不能を成功へ畳まず、版と本文Hashを取得する。
 * @trace ARCH-000008
 * @input managementCapability: 現在操作Owner。request: 初回Identity又は同じ操作のHost清掃前検査。
 * @returns operation_startは検査済みIdentityの非Authority相関だけ。stateは確認済みSnapshotと必要なHost清掃準備。
 * @precondition Repository操作Ownerが有効である。
 * @postcondition 排他解放と読取り確認の両方が成立した場合だけ値を返す。
 * @effect operation_startはState読取り・Lock取得・保存0。stateだけ固定File読取りと短期排他を行う。
 * @failure Root不一致、保存途中、本文不正、解放不明は停止する。
 * @invariant 初回検査のcompletedを保存・開始許可へ昇格しない。初回検査のlockReleased:trueはLock未取得を表す。
 * @boundary Repository-local現在状態と操作Owner。
 * @security 呼出し元Pathや旧形式から保存先を選ばない。
 * @concurrency Writerと同じ短期排他下で取得し、上位待機へLockを搬送しない。
 */
export function readOperationStateStage(
  managementCapability: unknown,
  request?:
    | Readonly<{ kind: "host_cleanup"; recoveryId: unknown }>
    | Readonly<{ kind: "operation_start"; identityJson: unknown }>,
) {
  const captured =
    request === undefined
      ? null
      : (snapshotStateRecord(request, new Set(["kind", "recoveryId"])) ??
        snapshotStateRecord(request, new Set(["kind", "identityJson"])));
  if (captured?.kind === "operation_start") {
    let operationIdentity: Readonly<{
      recoveryId: string;
      identitySha256: string;
      operationId: string;
    }> | null = null;
    if (Object.hasOwn(captured, "identityJson")) {
      try {
        const repository = observeOperationRepository(managementCapability);
        const bytes = repository
          ? prepareStateOperationSnapshot(
              null,
              captured.identityJson,
              repository.repositoryBinding,
            )
          : null;
        const operation =
          bytes && repository
            ? decodeStateSnapshot(bytes, repository.repositoryBinding)?.snapshot
                .operations[0]
            : null;
        if (
          operation?.kind === "docker_task" &&
          repository &&
          JSON.parse(operation.identityJson).operationId ===
            repository.operationId &&
          repository.revalidate() === true
        )
          operationIdentity = Object.freeze({
            recoveryId: operation.recoveryId,
            identitySha256: operation.identitySha256,
            operationId: repository.operationId,
          });
      } catch {
        operationIdentity = null;
      }
    }
    return Object.freeze({
      kind: "operation_start" as const,
      status: operationIdentity ? ("completed" as const) : ("blocked" as const),
      reason: operationIdentity
        ? "coordinator_state_read_confirmed"
        : "coordinator_state_input_invalid",
      value: null,
      lockReleased: true,
      hostCleanupPreparation: null,
      operationIdentity,
    });
  }
  if (
    request !== undefined &&
    (captured?.kind !== "host_cleanup" ||
      !Object.hasOwn(captured, "recoveryId"))
  )
    return Object.freeze({
      kind: "state" as const,
      status: "blocked" as const,
      reason: "coordinator_state_owner_invalid",
      lockReleased: true,
      value: null,
      operationIdentity: null,
      hostCleanupPreparation: null,
    });
  const repository = observeOperationRepository(managementCapability);
  const current = readStateSnapshot(repository, null);
  let hostCleanupPreparation: Readonly<{
    recoveryId: string;
    hostToken: string;
    before: Buffer;
  }> | null = null;
  if (
    captured &&
    repository &&
    current.status === "completed" &&
    current.lockReleased &&
    current.value
  ) {
    const operation = current.value.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === captured.recoveryId,
    );
    const before = Buffer.from(`${encodeStateValue(current.value.snapshot)}\n`);
    if (
      operation &&
      operation.host.cleanup === "not_requested" &&
      operation.lease === "released" &&
      JSON.parse(operation.identityJson).operationId ===
        repository.operationId &&
      prepareStateHostSnapshot(
        before,
        operation.recoveryId,
        { ...operation.host, cleanup: "pending" },
        repository.repositoryBinding,
      )
    )
      hostCleanupPreparation = Object.freeze({
        recoveryId: operation.recoveryId,
        hostToken: operation.host.currentToken,
        before,
      });
  }
  return Object.freeze({
    ...current,
    kind: "state" as const,
    operationIdentity: null,
    hostCleanupPreparation,
  });
}

/**
 * 新Processの検証済みRootから現在状態を読み取る。
 * @responsibility 管理Ownerを復元せず通常と同じ読取り・排他契約を使用する。
 * @trace ARCH-000008
 * @input rootCapability: 呼出し組立てが固定した検証済みRepository Root。
 * @returns 内部Snapshot、または値なしblocked。
 * @precondition 公開投影と実資源処置は別の既存Ownerが所有する。
 * @postcondition pending・欠落・不正・解放不明を空状態へ変更しない。
 * @effect 固定現在状態の読取りと既存短期排他だけ。
 * @failure Rootまたは保存結合の不一致と観測不能はblocked。
 * @invariant 旧AppDataへfallbackせず、読取りから回復完了を推定しない。
 * @boundary 新ProcessのRepository Rootと現在状態Reader。
 * @security Snapshotをそのまま外部公開せず、書込みAuthorityを生成しない。
 * @concurrency 通常Writerと同じLockを取得・解放する。
 */
export function readRecoveryState(
  rootCapability: unknown,
  request: RecoveryReadRequest = { kind: "current" },
): ReturnType<typeof readStateSnapshot> &
  Readonly<{
    restartPreparation?: Readonly<{
      operation: ExecutionOperationRecord;
      requestId: string;
      scopeSha256: string;
    }> | null;
  }> {
  const captured =
    snapshotStateRecord(request, new Set(["kind"])) ??
    snapshotStateRecord(request, new Set(["kind", "recoveryId"])) ??
    snapshotStateRecord(
      request,
      new Set(["kind", "recoveryId", "scopeSha256"]),
    ) ??
    snapshotStateRecord(
      request,
      new Set(["kind", "recoveryId", "correlationId"]),
    );
  if (
    !captured ||
    (Object.hasOwn(captured, "correlationId") &&
      captured.kind !== "completion") ||
    (captured.kind === "completion" &&
      !Object.hasOwn(captured, "correlationId")) ||
    (Object.hasOwn(captured, "scopeSha256") &&
      captured.kind !== "restart_preparation") ||
    (captured.kind === "restart_preparation" &&
      !Object.hasOwn(captured, "scopeSha256")) ||
    (captured.kind !== "current" &&
      captured.kind !== "admission" &&
      captured.kind !== "history" &&
      !Object.hasOwn(captured, "recoveryId")) ||
    ((captured.kind === "current" ||
      captured.kind === "admission" ||
      captured.kind === "history") &&
      Object.hasOwn(captured, "recoveryId"))
  )
    return readStateSnapshot(null, null);
  const recoveryId = "recoveryId" in captured ? captured.recoveryId : null;
  switch (captured.kind) {
    case "completion": {
      if (
        typeof recoveryId !== "string" ||
        !parseDockerTaskRecoveryId(recoveryId) ||
        typeof captured.correlationId !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(captured.correlationId)
      ) {
        const refused = readStateSnapshot(null, null);
        return refused.status === "blocked"
          ? Object.freeze({
              ...refused,
              reason: "coordinator_completion_input_invalid",
            })
          : refused;
      }
      const observed = readStateSnapshot(
        observeExecutionRecoveryRepository(rootCapability),
        null,
        null,
        null,
        null,
        "docker_task",
        "docker_task",
        false,
        null,
        { recoveryId, correlationId: captured.correlationId },
      );
      if (observed.status !== "completed")
        return Object.freeze({
          ...observed,
          operationCompletionConfirmed: false as const,
        });
      return Object.freeze({
        ...observed,
        operationCompletionConfirmed:
          observed.lockReleased && observed.operationCompletionConfirmed,
      });
    }
    case "restart_preparation": {
      if (
        typeof recoveryId !== "string" ||
        !parseDockerTaskRecoveryId(recoveryId) ||
        !isSha256Hex(captured.scopeSha256)
      )
        return { ...readStateSnapshot(null, null), restartPreparation: null };
      const repository = observeExecutionRecoveryRepository(rootCapability);
      const current = readStateSnapshot(repository, null);
      const operation = current.value?.snapshot.operations.find(
        (item): item is ExecutionOperationRecord =>
          item.kind === "docker_task" && item.recoveryId === recoveryId,
      );
      const requestId =
        repository && operation
          ? createDockerRestartRequestId(
              repository.repositoryBinding,
              operation.identitySha256,
              operation.recoveryId,
              captured.scopeSha256,
            )
          : null;
      if (current.status !== "completed")
        return Object.freeze({ ...current, restartPreparation: null });
      if (
        !current.value ||
        !current.lockReleased ||
        !operation ||
        !requestId ||
        (operation.dockerRestart !== null &&
          (operation.dockerRestart.requestId !== requestId ||
            operation.dockerRestart.scopeSha256 !== captured.scopeSha256))
      )
        return Object.freeze({ ...current, restartPreparation: null });
      return Object.freeze({
        ...current,
        restartPreparation: Object.freeze({
          operation,
          requestId,
          scopeSha256: captured.scopeSha256,
        }),
      });
    }
    case "current":
      return readStateSnapshot(
        observeExecutionRecoveryRepository(rootCapability),
        null,
      );
    case "history":
      return readStateSnapshot(
        observeExecutionRecoveryRepository(rootCapability),
        null,
        null,
        null,
        null,
        "docker_task",
        "docker_task",
        false,
        null,
        null,
        null,
        false,
        null,
        true,
      );
    case "resource_publication": {
      if (typeof recoveryId !== "string") return readStateSnapshot(null, null);

      return readStateSnapshot(
        observeExecutionRecoveryRepository(rootCapability),
        null,
        null,
        null,
        null,
        "docker_task",
        "docker_task",
        false,
        recoveryId,
      );
    }
    case "host_cleanup": {
      return readStateSnapshot(
        typeof recoveryId === "string" && parseDockerTaskRecoveryId(recoveryId)
          ? observeExecutionRecoveryRepository(rootCapability)
          : null,
        null,
        typeof recoveryId === "string" ? recoveryId : null,
        null,
        null,
        "docker_task",
        "docker_task",
        false,
        null,
        null,
        null,
        false,
        typeof recoveryId === "string" ? recoveryId : null,
      );
    }
    case "initial_host": {
      return readStateSnapshot(
        typeof recoveryId === "string" && parseDockerTaskRecoveryId(recoveryId)
          ? observeExecutionRecoveryRepository(rootCapability)
          : null,
        null,
        null,
        null,
        null,
        "docker_task",
        "docker_task",
        false,
        null,
        null,
        null,
        false,
        typeof recoveryId === "string" ? recoveryId : null,
      );
    }
    case "execution_history": {
      return readStateSnapshot(
        typeof recoveryId === "string" && parseDockerTaskRecoveryId(recoveryId)
          ? observeExecutionRecoveryRepository(rootCapability)
          : null,
        null,
        null,
        typeof recoveryId === "string" ? recoveryId : null,
      );
    }
    case "repair_history": {
      const validId =
        typeof recoveryId === "string" &&
        /^docker-runtime-repair\.[a-f0-9]{64}\.[a-f0-9]{64}$/.test(recoveryId);
      return readStateSnapshot(
        validId ? observeExecutionRecoveryRepository(rootCapability) : null,
        null,
        null,
        validId ? recoveryId : null,
        null,
        "runtime_repair",
      );
    }
    case "execution_completion": {
      return readStateSnapshot(
        typeof recoveryId === "string" && parseDockerTaskRecoveryId(recoveryId)
          ? observeExecutionRecoveryRepository(rootCapability)
          : null,
        null,
        null,
        null,
        typeof recoveryId === "string" ? recoveryId : null,
      );
    }
    case "repair_completion": {
      return readStateSnapshot(
        typeof recoveryId === "string" &&
          /^docker-runtime-repair\.[0-9a-f]{64}\.[0-9a-f]{64}$/u.test(
            recoveryId,
          )
          ? observeExecutionRecoveryRepository(rootCapability)
          : null,
        null,
        null,
        null,
        typeof recoveryId === "string" ? recoveryId : null,
        "docker_task",
        "runtime_repair",
      );
    }
    case "admission": {
      return readStateSnapshot(
        observeExecutionRecoveryRepository(rootCapability),
        null,
        null,
        null,
        null,
        "docker_task",
        "docker_task",
        true,
      );
    }
    default:
      return readStateSnapshot(null, null);
  }
}

/**
 * Lease取得Ownerの記録参照を投影する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function projectLeaseAcquisitionOwner(
  current: Snapshot,
  binding: string,
) {
  if (current.schema !== PROJECT_SNAPSHOT_SCHEMA)
    return blockedLeaseCandidate("orchestrator_snapshot_schema_invalid");
  const intents = current.leaseIntents.filter(
    (item) => item.kind === "project-operation",
  );
  const first = intents[0];
  if (!first)
    return completedLeaseCandidate("orchestrator_lease_acquisition_absent", {
      next: null,
      value: { acquisition: null },
    });
  const queue = current.queueEntries.find(
    (item) => item.queueId === first.queueId,
  );
  if (
    !queue ||
    queue.projectId !== first.projectId ||
    (queue.ownerGeneration !== null &&
      queue.ownerGeneration !== first.ownerGeneration) ||
    intents.some(
      (item) =>
        item.projectId !== first.projectId ||
        item.queueId !== first.queueId ||
        item.ownerGeneration !== first.ownerGeneration ||
        item.ownerProcessId !== first.ownerProcessId ||
        item.recoveryId !== first.recoveryId,
    )
  )
    return blockedLeaseCandidate(
      "orchestrator_lease_acquisition_owner_mismatch",
      true,
      first.recoveryId,
    );
  return completedLeaseCandidate(
    "orchestrator_lease_acquisition_owner_observed",
    {
      next: null,
      value: {
        acquisition: Object.freeze({
          repositoryBindingId: binding,
          projectId: first.projectId,
          queueId: first.queueId,
          ownerGeneration: first.ownerGeneration,
          ownerProcessId: first.ownerProcessId,
          recoveryId: first.recoveryId,
        }),
      },
    },
  );
}

/**
 * Lease取得予約の保存候補を生成する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function prepareLeaseAcquisitionReservation(
  current: Snapshot,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  identity: string,
  intent: Snapshot["leaseIntents"][number],
  observations: Readonly<{
    resourcesAbsent: () => boolean;
    observeRoot: () => Readonly<{
      repositoryRoot: string;
      rootIdentity: string;
    }>;
    markIntentSaveRequested: () => void;
  }>,
) {
  if (
    current.schema !== PROJECT_SNAPSHOT_SCHEMA ||
    !validId(projectId) ||
    (kind === "project-operation"
      ? !current.queueEntries.some(
          (item) => item.queueId === queueId && item.projectId === projectId,
        )
      : queueId !== "canonical")
  )
    return blockedLeaseCandidate("orchestrator_lease_binding_invalid");
  if (
    current.leaseIntents.some(
      (item) =>
        leaseIdentity(binding, item.projectId, item.queueId, item.kind) ===
        identity,
    )
  )
    return blockedLeaseCandidate("orchestrator_lease_unavailable");
  if (observations.resourcesAbsent() !== true)
    return blockedLeaseCandidate("orchestrator_lease_preexisting_resource");
  const root = observeLeaseRoot(observations.observeRoot);
  observations.markIntentSaveRequested();
  return completedLeaseCandidate("orchestrator_lease_intent_durable", {
    next: { ...current, leaseIntents: [...current.leaseIntents, intent] },
    value: {
      repositoryRoot: root.repositoryRoot,
      rootIdentity: root.rootIdentity,
      identity,
      recoveryId: intent.recoveryId,
      intent,
    },
  });
}

/**
 * 観測済み実Lockに対する取得確定候補を生成する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function prepareLeaseAcquisitionConfirmation(
  current: Snapshot,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  ownerGeneration: string,
  intent: Snapshot["leaseIntents"][number],
  physicalIdentity: string,
  recoveryId: string,
  ownerProcessId: number,
  observations: Readonly<{ physicalIdentityMatches: () => boolean }>,
) {
  if (
    current.schema !== PROJECT_SNAPSHOT_SCHEMA ||
    !current.leaseIntents.some(
      (item) => encodeStateValue(item) === encodeStateValue(intent),
    )
  )
    return blockedLeaseCandidate(
      "orchestrator_lease_intent_mismatch",
      true,
      recoveryId,
    );
  if (observations.physicalIdentityMatches() !== true)
    return blockedLeaseCandidate(
      "orchestrator_lease_physical_identity_changed",
      true,
      recoveryId,
    );
  const evidence = createLeaseEvidence(binding, projectId, 1, {
    kind,
    queueId,
    ownerGeneration,
    ownerProcessId,
    disposition: "acquired",
  });
  return completedLeaseCandidate("orchestrator_lease_acquired", {
    next: {
      ...current,
      leaseIntents: [
        ...current.leaseIntents,
        { ...intent, phase: "lock_owned" as const, physicalIdentity },
      ],
      leaseEvidence: [...current.leaseEvidence, evidence],
    },
    value: true,
  });
}

/**
 * 同じ取得意図に対する解放意図候補を生成する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function prepareLeaseReleaseIntent(
  current: Snapshot,
  intent: Snapshot["leaseIntents"][number],
  physicalIdentity: string,
) {
  const { ownerGeneration, recoveryId } = intent;
  if (
    current.schema !== PROJECT_SNAPSHOT_SCHEMA ||
    !current.leaseIntents.some(
      (item) =>
        item.ownerGeneration === ownerGeneration &&
        item.phase === "lock_owned" &&
        item.physicalIdentity === physicalIdentity,
    )
  )
    return blockedLeaseCandidate(
      "orchestrator_lease_intent_mismatch",
      true,
      recoveryId,
    );
  return completedLeaseCandidate("orchestrator_lease_release_intent_durable", {
    next: {
      ...current,
      leaseIntents: [
        ...current.leaseIntents,
        {
          ...intent,
          phase: "release_pending" as const,
          physicalIdentity,
        },
      ],
    },
    value: true,
  });
}

/**
 * 実解放後の終了記録候補を生成する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function prepareLeaseReleaseSettlement(
  current: Snapshot,
  binding: string,
  intent: Snapshot["leaseIntents"][number],
  physicalIdentity: string,
  ownerProcessId: number,
) {
  const { ownerGeneration, recoveryId, projectId, queueId, kind } = intent;
  if (
    current.schema !== PROJECT_SNAPSHOT_SCHEMA ||
    !current.leaseIntents.some(
      (item) =>
        item.ownerGeneration === ownerGeneration &&
        item.phase === "release_pending" &&
        item.physicalIdentity === physicalIdentity,
    )
  )
    return blockedLeaseCandidate(
      "orchestrator_lease_intent_mismatch",
      true,
      recoveryId,
    );
  const evidence = createLeaseEvidence(binding, projectId, 2, {
    kind,
    queueId,
    ownerGeneration,
    ownerProcessId,
    disposition: "released",
  });
  return completedLeaseCandidate("orchestrator_lease_released", {
    next: {
      ...current,
      leaseIntents: current.leaseIntents.filter(
        (item) =>
          !(
            item.ownerGeneration === ownerGeneration &&
            item.kind === kind &&
            item.projectId === projectId &&
            item.queueId === queueId
          ),
      ),
      leaseEvidence: [...current.leaseEvidence, evidence],
    },
    value: { released: true as const },
  });
}

/**
 * Owner喪失回復の初回記録を投影する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function projectLeaseOwnerLossState(
  current: Snapshot,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  observations: Readonly<{
    observeRoot: () => Readonly<{
      repositoryRoot: string;
      rootIdentity: string;
    }>;
  }>,
) {
  if (current.schema !== PROJECT_SNAPSHOT_SCHEMA)
    return blockedLeaseCandidate("orchestrator_snapshot_schema_invalid");
  const queue =
    kind === "project-operation"
      ? (current.queueEntries.find((item) => item.queueId === queueId) ?? null)
      : null;
  if (
    !validId(projectId) ||
    (kind === "project-operation"
      ? queue?.projectId !== projectId
      : queueId !== "canonical")
  )
    return blockedLeaseCandidate("orchestrator_lease_binding_invalid");
  const intents = current.leaseIntents.filter(
    (item) =>
      item.projectId === projectId &&
      item.queueId === queueId &&
      item.kind === kind,
  );
  const root = observeLeaseRoot(observations.observeRoot);
  return completedLeaseCandidate("orchestrator_lease_recovery_inspected", {
    next: null,
    value: {
      intents,
      queue,
      intakeEpoch: current.intakeEpoch,
      identity: leaseIdentity(
        current.repositoryBindingId,
        projectId,
        queueId,
        kind,
      ),
      recoveryId: leaseAcquisitionRecoveryId(
        current.repositoryBindingId,
        projectId,
        queueId,
        kind,
      ),
      repositoryRoot: root.repositoryRoot,
      rootIdentity: root.rootIdentity,
    },
  });
}

/**
 * intent不在の旧Leaseを回復待ち記録へ照合する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function prepareReleasedLeaseReconciliation(
  current: Snapshot,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  initialQueue: ProjectQueueEntry | null,
  recoveryId: string,
  observations: Readonly<{ resourcesAbsent: () => boolean }>,
) {
  const queue = current.queueEntries.find((item) => item.queueId === queueId);
  const released = current.leaseEvidence.find(
    (item) =>
      item.projectId === projectId &&
      item.content.queueId === queueId &&
      item.content.kind === kind &&
      item.content.ownerGeneration === queue?.ownerGeneration &&
      item.content.disposition === "released",
  );
  if (
    !queue ||
    queue.generation !== initialQueue?.generation ||
    queue.ownerGeneration !== initialQueue?.ownerGeneration ||
    !["leased", "running"].includes(queue.state) ||
    !released ||
    current.leaseIntents.some(
      (item) =>
        item.projectId === projectId &&
        item.queueId === queueId &&
        item.kind === kind,
    ) ||
    observations.resourcesAbsent() !== true
  )
    return blockedLeaseCandidate(
      "orchestrator_lease_recovery_state_mismatch",
      true,
      recoveryId,
    );
  const next: ProjectQueueEntry = {
    ...queue,
    generation: queue.generation + 1,
    state: "recovery_required",
    ownerGeneration: null,
    resumeCondition: "owner_loss",
    resultReference: recoveryId,
  };
  return completedLeaseCandidate("orchestrator_released_lease_reconciled", {
    next: {
      ...current,
      queueEntries: current.queueEntries.map((item) =>
        item.queueId === queueId ? next : item,
      ),
    },
    value: { queue: next, recoveryId: null },
  });
}

/**
 * 元Queueとintent集合に結合した回復意図候補を生成する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function prepareLeaseRecoveryReservation(
  current: Snapshot,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  initial: Readonly<{
    repositoryRoot: string;
    rootIdentity: string;
    queue: ProjectQueueEntry | null;
  }>,
  ownIntents: Snapshot["leaseIntents"],
  pending: Snapshot["leaseIntents"][number],
  recoveryId: string,
  observations: Readonly<{
    observeRoot: () => Readonly<{
      repositoryRoot: string;
      rootIdentity: string;
    }>;
  }>,
) {
  const root = observeLeaseRoot(observations.observeRoot);
  if (
    current.schema !== PROJECT_SNAPSHOT_SCHEMA ||
    root.repositoryRoot !== initial.repositoryRoot ||
    root.rootIdentity !== initial.rootIdentity ||
    encodeStateValue(
      current.leaseIntents.filter(
        (item) =>
          item.projectId === projectId &&
          item.queueId === queueId &&
          item.kind === kind,
      ),
    ) !== encodeStateValue(ownIntents) ||
    encodeStateValue(
      kind === "project-operation"
        ? (current.queueEntries.find((item) => item.queueId === queueId) ??
            null)
        : null,
    ) !== encodeStateValue(initial.queue)
  )
    return blockedLeaseCandidate(
      "orchestrator_lease_recovery_state_mismatch",
      true,
      recoveryId,
    );
  const existing = ownIntents.find((item) => item.phase === "recovery_pending");
  if (existing && encodeStateValue(existing) !== encodeStateValue(pending))
    return blockedLeaseCandidate(
      "orchestrator_lease_intent_mismatch",
      true,
      recoveryId,
    );
  return completedLeaseCandidate("orchestrator_lease_recovery_intent_durable", {
    next: existing
      ? null
      : { ...current, leaseIntents: [...current.leaseIntents, pending] },
    value: true,
  });
}

/**
 * 観測済み回復処置の終了記録候補を生成する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function prepareLeaseRecoverySettlement(
  current: Snapshot,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  initial: Readonly<{
    repositoryRoot: string;
    rootIdentity: string;
    queue: ProjectQueueEntry | null;
  }>,
  ownIntents: Snapshot["leaseIntents"],
  pending: Snapshot["leaseIntents"][number],
  first: Snapshot["leaseIntents"][number],
  recoveryId: string,
  observations: Readonly<{
    observeRoot: () => Readonly<{
      repositoryRoot: string;
      rootIdentity: string;
    }>;
  }>,
) {
  const root = observeLeaseRoot(observations.observeRoot);
  if (
    current.schema !== PROJECT_SNAPSHOT_SCHEMA ||
    root.repositoryRoot !== initial.repositoryRoot ||
    root.rootIdentity !== initial.rootIdentity ||
    encodeStateValue(
      kind === "project-operation"
        ? (current.queueEntries.find((item) => item.queueId === queueId) ??
            null)
        : null,
    ) !== encodeStateValue(initial.queue) ||
    encodeStateValue(
      current.leaseIntents.filter(
        (item) =>
          item.projectId === projectId &&
          item.queueId === queueId &&
          item.kind === kind,
      ),
    ) !==
      encodeStateValue(
        ownIntents.some((item) => item.phase === "recovery_pending")
          ? ownIntents
          : [...ownIntents, pending],
      )
  )
    return blockedLeaseCandidate(
      "orchestrator_lease_recovery_state_mismatch",
      true,
      recoveryId,
    );
  const acquired = current.leaseEvidence.find(
    (item) =>
      item.projectId === projectId &&
      item.content.queueId === queueId &&
      item.content.kind === kind &&
      item.content.ownerGeneration === first.ownerGeneration &&
      item.content.disposition === "acquired",
  );
  const ended = current.leaseEvidence.find(
    (item) =>
      item.projectId === projectId &&
      item.content.queueId === queueId &&
      item.content.kind === kind &&
      item.content.ownerGeneration === first.ownerGeneration &&
      item.content.disposition !== "acquired",
  );
  if (ended)
    return blockedLeaseCandidate(
      "orchestrator_lease_recovery_state_mismatch",
      true,
      recoveryId,
    );
  const evidence = createLeaseEvidence(binding, projectId, 2, {
    kind,
    queueId,
    ownerGeneration: first.ownerGeneration,
    ownerProcessId: first.ownerProcessId,
    disposition: acquired
      ? "recovered_after_owner_loss"
      : "acquisition_unknown_closed",
  });
  const queue: ProjectQueueEntry | null =
    initial.queue === null
      ? null
      : Object.freeze({
          ...initial.queue,
          generation: initial.queue.generation + 1,
          ...(initial.queue.ownerGeneration === null
            ? {}
            : {
                state: "recovery_required" as const,
                ownerGeneration: null,
                resumeCondition: "owner_loss" as const,
              }),
          resultReference: recoveryId,
        });
  return completedLeaseCandidate("orchestrator_lease_owner_loss_reconciled", {
    next: {
      ...current,
      leaseIntents: current.leaseIntents.filter(
        (item) =>
          !(
            item.projectId === projectId &&
            item.queueId === queueId &&
            item.kind === kind &&
            item.ownerGeneration === first.ownerGeneration
          ),
      ),
      leaseEvidence: [...current.leaseEvidence, evidence],
      queueEntries:
        queue === null
          ? current.queueEntries
          : current.queueEntries.map((item) =>
              item.queueId === queueId ? queue : item,
            ),
    },
    value: { queue, recoveryId },
  });
}

/**
 * 用途固定Root観測の同期・閉形式を検査する。
 * @responsibility Promise・thenable・accessor・Proxyを物理不存在や正規Rootへ畳まない。
 * @trace ARCH-000008
 * @input observe: Coordinatorの同期Root投影。
 * @returns 同じ二fieldの観測値。
 * @precondition 元のlstat位置でのみ呼ぶ。
 * @postcondition 無効観測では後続mark・保存候補を発行しない。
 * @effect 同期観測一回。FilesystemはCoordinatorに残す。
 * @failure 無効観測は既存の観測不能例外へ接続する。
 * @invariant 値の形式をRootの現在真正性としない。
 * @boundary このFileの四つのRoot観測箇所だけ。
 * @security getter・then・Proxyを評価しない。
 * @concurrency N/A: 同期処理。
 */
function observeLeaseRoot(
  observe: () => Readonly<{ repositoryRoot: string; rootIdentity: string }>,
) {
  const value = observe();
  if (!value || typeof value !== "object" || types.isProxy(value))
    throw Error("orchestrator_lease_recovery_observation_unknown");
  const prototype = Object.getPrototypeOf(value);
  if ((prototype !== Object.prototype && prototype !== null) || "then" in value)
    throw Error("orchestrator_lease_recovery_observation_unknown");
  const properties = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(properties).length !== 2 ||
    !properties.repositoryRoot ||
    !("value" in properties.repositoryRoot) ||
    !properties.rootIdentity ||
    !("value" in properties.rootIdentity) ||
    typeof properties.repositoryRoot.value !== "string" ||
    properties.repositoryRoot.value.length === 0 ||
    typeof properties.rootIdentity.value !== "string" ||
    !/^[a-f0-9]{64}$/.test(properties.rootIdentity.value)
  )
    throw Error("orchestrator_lease_recovery_observation_unknown");
  return value;
}

/**
 * 保存候補への遷移で未解決記録と受付結合を保全する。
 * @responsibility 通常保存と中断再入場に同じ遷移制約を適用する。
 * @trace ARCH-000004
 * @input current: 現在値または初期不存在、payload: 検証済み候補。
 * @returns N/A: 違反時に例外を返す。
 * @precondition 双方の構造と結合は検証済み。
 * @postcondition 改訂番号、記録世代と未解決区画の維持を確認済み。
 * @effect 同じ短期Ownerで必要なLease・履歴を同期観測する。保存は行わない。
 * @failure 記録の除去、結合変更または世代飛越を拒否する。
 * @invariant pendingで通常保存の保全制約を迂回しない。
 * @boundary 現在値から候補への保存遷移。
 * @security Hash一致を遷移許可と同一視しない。
 * @concurrency N/A: 排他を所有する呼出し側で実行する。
 */
export function assertSnapshotTransition(
  current: Snapshot | null,
  payload: Snapshot,
  owner: SnapshotObservations,
): void {
  if (
    !current &&
    (payload.decisions.length !== 0 || payload.blockers.length !== 0)
  )
    throw new Error("decision_initial_state_not_empty");
  if (current && !validateDecisionSnapshotTransition(current, payload)) {
    if (!validateDecisionRetirement(current, payload))
      throw new Error("decision_snapshot_transition_invalid");
    for (const record of current.decisions) {
      if (
        !payload.decisions.some(
          (item) => item.decisionId === record.decisionId,
        ) &&
        owner.decisionHistorySettlement(record) !== "recorded"
      )
        throw new Error("decision_history_retirement_unconfirmed");
    }
  }
  if (payload.snapshotRevision !== (current?.snapshotRevision ?? 0) + 1)
    throw new Error("snapshot_revision_conflict");
  for (const intent of payload.leaseIntents) {
    if (intent.phase !== "acquisition_reserved") continue;
    if (
      current?.leaseIntents.some(
        (item) => encodeStateValue(item) === encodeStateValue(intent),
      )
    )
      continue;
    const identity = leaseIdentity(
      payload.repositoryBindingId,
      intent.projectId,
      intent.queueId,
      intent.kind,
    );
    if (
      intent.physicalIdentity !== null ||
      intent.ownerProcessId !== owner.processId ||
      payload.leaseIntents.filter(
        (item) =>
          leaseIdentity(
            payload.repositoryBindingId,
            item.projectId,
            item.queueId,
            item.kind,
          ) === identity,
      ).length !== 1 ||
      current?.leaseIntents.some(
        (item) =>
          leaseIdentity(
            payload.repositoryBindingId,
            item.projectId,
            item.queueId,
            item.kind,
          ) === identity,
      ) ||
      !owner.leaseResourcesAbsent(identity)
    )
      throw new Error("snapshot_acquisition_reservation_invalid");
  }
  if (current) {
    if (payload.schema !== current.schema)
      throw new Error("snapshot_schema_transition_invalid");
    const retired = new Set(
      current.queueEntries
        .filter(
          (queue) =>
            !payload.queueEntries.some(
              (item) => item.queueId === queue.queueId,
            ),
        )
        .map((item) => item.queueId),
    );
    const currentEvidenceIds = new Set(
      [...current.projects, ...payload.projects].flatMap((project) => [
        ...project.milestone.criterionEvidenceIds,
        ...project.objectives.flatMap(
          (objective) => objective.criterionEvidenceIds,
        ),
      ]),
    );
    for (const queueId of retired) {
      const row = current.historyPending.find((item) => item.id === queueId);
      if (
        !queueIsClosed(current, queueId, owner) ||
        !row ||
        owner.historySettlement(row) === null
      )
        throw new Error("snapshot_retirement_unconfirmed");
    }
    if (retired.size > 0 !== (payload.intakeEpoch !== current.intakeEpoch))
      throw new Error("snapshot_intake_epoch_transition_invalid");
    for (const collection of ["results", "leaseEvidence"] as const) {
      for (const old of current[collection])
        if (
          !payload[collection].some(
            (item) => encodeStateValue(item) === encodeStateValue(old),
          )
        )
          if (
            collection === "results"
              ? (!current.queueEntries.some(
                  (queue) =>
                    retired.has(queue.queueId) &&
                    queue.queueId === (old as ResultRecord).queueId &&
                    queue.projectId === old.projectId &&
                    queue.milestoneId === (old as ResultRecord).milestoneId,
                ) &&
                  !current.historyPending.some(
                    (row) =>
                      row.id === (old as ResultRecord).identity &&
                      standaloneAdoptionIsClosed(current, row.id, owner) &&
                      owner.historySettlement(row) !== null,
                  )) ||
                currentEvidenceIds.has((old as ResultRecord).identity) ||
                payload.queueEntries.some(
                  (item) =>
                    item.resultReference === (old as ResultRecord).identity,
                )
              : !current.queueEntries.some(
                  (queue) =>
                    (old as LeaseEvidenceEnvelope).content.kind ===
                      "project-operation" &&
                    retired.has(queue.queueId) &&
                    queue.queueId ===
                      (old as LeaseEvidenceEnvelope).content.queueId &&
                    queue.projectId === old.projectId,
                ) &&
                !rejectedAdoptionEvidenceCanRetire(
                  current,
                  payload,
                  old as LeaseEvidenceEnvelope,
                  owner,
                ) &&
                !(
                  (old as LeaseEvidenceEnvelope).content.kind ===
                    "canonical-adoption" &&
                  !payload.queueEntries.some(
                    (queue) => queue.projectId === old.projectId,
                  ) &&
                  !payload.leaseIntents.some(
                    (intent) => intent.projectId === old.projectId,
                  ) &&
                  !payload.results.some(
                    (record) =>
                      record.kind === "adoption" &&
                      record.projectId === old.projectId,
                  ) &&
                  current.historyPending.some(
                    (row) =>
                      (current.queueEntries.some(
                        (queue) =>
                          retired.has(queue.queueId) &&
                          queue.projectId === old.projectId,
                      ) ||
                        current.results.some(
                          (record) =>
                            record.identity === row.id &&
                            record.projectId === old.projectId &&
                            !adoptionWasRejected(record) &&
                            standaloneAdoptionIsClosed(current, row.id, owner),
                        )) &&
                      owner.historySettlement(row) !== null,
                  )
                )
          )
            throw new Error("snapshot_retained_obligation_removed");
    }
    for (const old of current.historyPending) {
      if (
        !payload.historyPending.some(
          (item) => encodeStateValue(item) === encodeStateValue(old),
        ) &&
        owner.historySettlement(old) === null
      )
        throw new Error("snapshot_history_transfer_unconfirmed");
    }
    for (const old of current.leaseIntents) {
      if (
        payload.leaseIntents.some(
          (item) => encodeStateValue(item) === encodeStateValue(old),
        )
      )
        continue;
      const end = payload.leaseEvidence.find(
        (item) =>
          item.projectId === old.projectId &&
          item.content.queueId === old.queueId &&
          item.content.kind === old.kind &&
          item.content.ownerGeneration === old.ownerGeneration &&
          item.content.ownerProcessId === old.ownerProcessId &&
          item.content.disposition !== "acquired",
      );
      const identity = leaseIdentity(
        payload.repositoryBindingId,
        old.projectId,
        old.queueId,
        old.kind,
      );
      if (end && end.content.disposition !== "released") {
        const recovery = current.leaseIntents.find(
          (item) =>
            item.projectId === old.projectId &&
            item.queueId === old.queueId &&
            item.kind === old.kind &&
            item.ownerGeneration === old.ownerGeneration &&
            item.ownerProcessId === old.ownerProcessId &&
            item.phase === "recovery_pending",
        );
        const owned = current.leaseIntents.find(
          (item) =>
            item.projectId === old.projectId &&
            item.queueId === old.queueId &&
            item.kind === old.kind &&
            item.ownerGeneration === old.ownerGeneration &&
            item.phase === "lock_owned",
        );
        if (
          !recovery ||
          recovery.recoveryId !== old.recoveryId ||
          (end.content.disposition === "acquisition_unknown_closed"
            ? owned !== undefined ||
              (recovery.physicalIdentity !== null &&
                !current.leaseIntents.some(
                  (item) =>
                    item.projectId === old.projectId &&
                    item.queueId === old.queueId &&
                    item.kind === old.kind &&
                    item.ownerGeneration === old.ownerGeneration &&
                    item.phase === "acquisition_reserved",
                ))
            : !owned || recovery.physicalIdentity !== owned.physicalIdentity)
        )
          throw new Error("snapshot_recovery_intent_unconfirmed");
      }
      if (
        current.schema !== owner.schema ||
        !end ||
        !owner.leaseResourcesAbsent(identity)
      )
        throw new Error("snapshot_unsettled_lease_intent_removed");
    }
    for (const old of current.queueEntries) {
      if (retired.has(old.queueId)) continue;
      const next = payload.queueEntries.find(
        (item) => item.queueId === old.queueId,
      );
      if (
        old.singleTask &&
        (!next?.singleTask ||
          [
            "principalId",
            "mode",
            "executionSelection",
            "taskId",
            "attemptId",
            "operationId",
          ].some(
            (key) =>
              encodeStateValue(
                old.singleTask?.[key as keyof SingleTaskRecord],
              ) !==
              encodeStateValue(
                next.singleTask?.[key as keyof SingleTaskRecord],
              ),
          ) ||
          (old.singleTask.adviceOperation !== undefined &&
            encodeStateValue(old.singleTask.adviceOperation) !==
              encodeStateValue(next.singleTask.adviceOperation)) ||
          (old.singleTask.phase === "settled" &&
            (old.singleTask.status !== next.singleTask.status ||
              old.singleTask.reason !== next.singleTask.reason ||
              next.singleTask.phase !== "settled" ||
              (old.singleTask.cleanupConfirmed &&
                !next.singleTask.cleanupConfirmed) ||
              next.singleTask.recoveryIds.some(
                (id) => !old.singleTask?.recoveryIds.includes(id),
              ))))
      )
        throw new Error("snapshot_single_task_identity_invalid");
      if (
        old.singleTask &&
        next?.singleTask &&
        encodeStateValue(old.singleTask) !== encodeStateValue(next.singleTask)
      ) {
        const unstartedRejection =
          old.singleTask.phase === "accepted" &&
          next.singleTask.phase === "settled" &&
          next.singleTask.status === "blocked" &&
          next.singleTask.cleanupConfirmed &&
          next.singleTask.recoveryIds.length === 0 &&
          old.ownerGeneration === null &&
          next.ownerGeneration === null &&
          !current.leaseIntents.some(
            (intent) => intent.queueId === old.queueId,
          );
        const phases: Record<SingleTaskRecord["phase"], readonly string[]> = {
          accepted: ["starting"],
          starting: ["starting", "running", "settled"],
          running: ["settled"],
          settled: ["settled"],
        };
        if (
          !unstartedRejection &&
          (!phases[old.singleTask.phase].includes(next.singleTask.phase) ||
            !current.leaseIntents.some(
              (intent) =>
                intent.queueId === old.queueId &&
                intent.projectId === old.projectId &&
                intent.kind === "project-operation" &&
                intent.phase === "lock_owned" &&
                intent.ownerProcessId === owner.processId &&
                intent.ownerGeneration === next.ownerGeneration,
            ))
        )
          throw new Error("snapshot_single_task_transition_invalid");
      }
      if (
        !next ||
        [
          "projectId",
          "milestoneId",
          "requestHash",
          "originLane",
          "repositoryRevision",
          "scopeHash",
        ].some(
          (key) =>
            next[key as keyof ProjectQueueEntry] !==
            old[key as keyof ProjectQueueEntry],
        ) ||
        (encodeStateValue(next) !== encodeStateValue(old) &&
          next.generation !== old.generation + 1) ||
        current.intakeBindings.find((item) => item.queueId === old.queueId)
          ?.epoch !==
          payload.intakeBindings.find((item) => item.queueId === old.queueId)
            ?.epoch
      )
        throw new Error("snapshot_queue_generation_invalid");
    }
    for (const old of current.projects) {
      const next = payload.projects.find(
        (item) => item.projectId === old.projectId,
      );
      if (
        next &&
        next.milestoneId === old.milestoneId &&
        encodeStateValue(next.taskExecutionSelections) !==
          encodeStateValue(old.taskExecutionSelections)
      )
        throw new Error("snapshot_project_selection_changed");
      if (
        next &&
        next.milestoneId !== old.milestoneId &&
        current.queueEntries.some(
          (queue) =>
            !queue.singleTask &&
            queue.projectId === old.projectId &&
            !retired.has(queue.queueId),
        )
      )
        throw new Error("snapshot_project_milestone_still_referenced");
      if (
        !next ||
        (encodeStateValue(next) !== encodeStateValue(old) &&
          next.generation !== old.generation + 1)
      )
        throw new Error("snapshot_project_generation_invalid");
    }
  }
}

/**
 * 一件の仕事について終了後の参照と実資源を照合する。
 * @responsibility 状態名だけで終了記録を削除しない。
 * @trace ARCH-000004
 * @input current、Queue ID、取得済み保存Owner。
 * @returns 現在の仕事が閉じている場合だけtrue。
 * @precondition Snapshotは全体検証済み。
 * @postcondition 判断待ち・未解決回復・Lease残存を拒否済み。
 * @effect 所有するLeaseの不存在を読み取る。
 * @failure 観測不能はfalse。
 * @invariant Candidate本体と保護Authorityを削除しない。
 * @boundary 現在状態と実行排他。
 * @security 終了済みを認証・採用許可にしない。
 * @concurrency 同じ短期Ownerで評価する。
 */
export function queueIsClosed(
  current: Snapshot,
  queueId: string,
  owner: SnapshotObservations,
): boolean {
  try {
    if (current.schema !== owner.schema) return false;
    const queue = current.queueEntries.find((item) => item.queueId === queueId);
    if (
      !queue ||
      !["completed", "cancelled"].includes(queue.state) ||
      queue.ownerGeneration !== null
    )
      return false;
    if (queue.singleTask) {
      return (
        queue.singleTask.phase === "settled" &&
        queue.workspaceId == null &&
        queue.singleTask.cleanupConfirmed &&
        queue.singleTask.recoveryIds.length === 0 &&
        !current.leaseIntents.some((item) => item.queueId === queueId) &&
        owner.leaseResourcesAbsent(
          leaseIdentity(
            current.repositoryBindingId,
            queue.projectId,
            queueId,
            "project-operation",
          ),
        )
      );
    }
    const project = current.projects.find(
      (item) => item.projectId === queue.projectId,
    );
    if (
      !project ||
      project.milestoneId !== queue.milestoneId ||
      !["accepted", "cancelled"].includes(project.milestone.state) ||
      project.tasks.some(
        (task) =>
          !["completed", "failed", "cancelled", "superseded"].includes(
            task.state,
          ) ||
          !task.cleanupConfirmed ||
          task.recoveryUnresolved ||
          task.recoveryObligations.some((item) => item.phase !== "settled"),
      )
    )
      return false;
    if (
      current.leaseIntents.some((item) => item.projectId === queue.projectId) ||
      current.blockers.some(
        (item) =>
          item.target.projectId === queue.projectId &&
          item.target.milestoneId === queue.milestoneId &&
          item.status === "active",
      )
    )
      return false;
    if (project.tasks.some((task) => task.candidateId !== null)) {
      const receipt = current.results.find(
        (item) =>
          item.queueId === queueId &&
          item.kind === "adoption" &&
          item.identity === queue.resultReference,
      );
      const candidate = current.results.find(
        (item) => item.queueId === queueId && item.kind === "integration",
      );
      if (
        !receipt ||
        !candidate ||
        !isStateObject(receipt.value) ||
        !isStateObject(candidate.value) ||
        receipt.value.status !== "completed" ||
        receipt.value.cleanupConfirmed !== true ||
        receipt.value.beforeRevision !== candidate.value.baseRevision ||
        !Array.isArray(receipt.value.changedPaths) ||
        !Array.isArray(candidate.value.changedPaths) ||
        encodeStateValue([...receipt.value.changedPaths].sort()) !==
          encodeStateValue([...candidate.value.changedPaths].sort())
      )
        return false;
    }
    for (const kind of ["project-operation", "canonical-adoption"] as const)
      if (
        !owner.leaseResourcesAbsent(
          leaseIdentity(
            current.repositoryBindingId,
            queue.projectId,
            kind === "project-operation" ? queueId : "canonical",
            kind,
          ),
        )
      )
        return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * 既知拒否の終了証拠をexact Owner単位で整理できるか確認する。
 * @responsibility 拒否結果、終了証拠、履歴確定と除去候補を結合する。
 * @trace ARCH-000004
 * @input 現在値、保存候補、終了証拠と取得済みOwner。
 * @returns 全終了条件が成立した場合だけtrue。
 * @precondition 同Rootの短期排他を保持する。
 * @postcondition 別Owner世代の証拠を除去しない。
 * @effect 実Leaseと履歴確定を読む。
 * @failure 観測不能はfalse。
 * @invariant 未知Effectと解放未確認を整理しない。
 * @boundary 採用終了から履歴と現在保存。
 * @security 履歴は再実行Authorityを持たない。
 * @concurrency 同じ保存Owner内で評価する。
 */
export function rejectedAdoptionEvidenceCanRetire(
  current: Snapshot,
  payload: Snapshot,
  evidence: LeaseEvidenceEnvelope,
  owner: SnapshotObservations,
): boolean {
  if (evidence.content.kind !== "canonical-adoption") return false;
  const record = current.results.find(
    (item) =>
      item.projectId === evidence.projectId &&
      item.identity === evidence.content.ownerGeneration &&
      adoptionWasRejected(item),
  );
  const row =
    record &&
    current.historyPending.find((item) => item.id === record.identity);
  return Boolean(
    record &&
      row &&
      row.outcome === "failed" &&
      row.primaryFailure === "execution" &&
      !payload.results.some((item) => item.identity === record.identity) &&
      standaloneAdoptionIsClosed(current, record.identity, owner) &&
      owner.historySettlement(row) !== null,
  );
}

/**
 * 通常Queueを持たない採用結果の終了条件を確認する。
 * @responsibility 実適用Receipt、参照と実Leaseの現在観測から整理可能性を決める。
 * @trace ARCH-000004
 * @input 検証済み保存値、Receipt Identity、取得済みOwner。
 * @returns 全条件が成立した場合だけtrue。
 * @precondition Ownerは同じRepositoryへ結合している。
 * @postcondition 使用中・参照中・未確定結果を退役対象にしない。
 * @effect 所有する実Leaseの不存在を読む。
 * @failure 不正Receiptと観測不能はfalse。
 * @invariant Receiptを再適用Authorityへ変換しない。
 * @boundary 独立候補採用と現在保存の境界。
 * @security Candidate本文や秘密値を履歴へ複製しない。
 * @concurrency 同じ短期Owner内で評価する。
 */
export function standaloneAdoptionIsClosed(
  current: Snapshot,
  identity: string,
  owner: SnapshotObservations,
): boolean {
  try {
    if (current.schema !== owner.schema) return false;
    const record = current.results.find(
      (item) => item.identity === identity && item.kind === "adoption",
    );
    const isRejected = record !== undefined && adoptionWasRejected(record);
    if (
      !record ||
      !isStateObject(record.value) ||
      (!isRejected &&
        (!hasStateKeys(record.value, [
          "status",
          "receiptId",
          "beforeRevision",
          "afterRevision",
          "changedPaths",
          "cleanupConfirmed",
        ]) ||
          record.value.status !== "completed" ||
          record.value.receiptId !== identity ||
          record.value.cleanupConfirmed !== true ||
          typeof record.value.beforeRevision !== "string" ||
          !/^[0-9a-f]{40,64}$/u.test(record.value.beforeRevision) ||
          typeof record.value.afterRevision !== "string" ||
          !/^[0-9a-f]{40,64}$/u.test(record.value.afterRevision) ||
          !Array.isArray(record.value.changedPaths) ||
          record.value.changedPaths.length === 0 ||
          record.value.changedPaths.some(
            (item) =>
              typeof item !== "string" ||
              normalizeRepositoryRelativePath(item) === null,
          ))) ||
      current.queueEntries.some(
        (queue) => queue.projectId === record.projectId,
      ) ||
      current.leaseIntents.some(
        (intent) => intent.projectId === record.projectId,
      ) ||
      (isRejected &&
        current.results.some(
          (other) =>
            other.projectId === record.projectId &&
            other.kind === "adoption" &&
            !adoptionWasRejected(other),
        )) ||
      current.blockers.some(
        (item) =>
          item.target.projectId === record.projectId &&
          (record.milestoneId === null ||
            item.target.milestoneId === record.milestoneId) &&
          item.status === "active",
      ) ||
      current.projects.some(
        (project) =>
          project.milestone.criterionEvidenceIds.includes(identity) ||
          project.objectives.some((objective) =>
            objective.criterionEvidenceIds.includes(identity),
          ),
      )
    )
      return false;
    const evidence = current.leaseEvidence.filter(
      (item) =>
        item.projectId === record.projectId &&
        item.content.kind === "canonical-adoption" &&
        (!isRejected || item.content.ownerGeneration === identity),
    );
    if (
      !evidence.length ||
      evidence.some(
        (item) =>
          !evidence.some(
            (end) =>
              end.content.ownerGeneration === item.content.ownerGeneration &&
              end.content.ownerProcessId === item.content.ownerProcessId &&
              end.content.disposition !== "acquired",
          ),
      )
    )
      return false;
    return owner.leaseResourcesAbsent(
      leaseIdentity(
        current.repositoryBindingId,
        record.projectId,
        "canonical",
        "canonical-adoption",
      ),
    );
  } catch {
    return false;
  }
}

/** 旧Storeの成功封筒だけを局所値として再現する。 */
function completedLeaseCandidate<T>(reason: string, value: T) {
  return Object.freeze({ status: "completed" as const, reason, value });
}

/** 旧Storeの拒否理由とexact回復参照を保持する。 */
function blockedLeaseCandidate(
  reason: string,
  manualRecoveryRequired = false,
  recoveryId: string | null = null,
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    value: null,
    manualRecoveryRequired,
    recoveryId,
  });
}
