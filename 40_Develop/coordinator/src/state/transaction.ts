/**
 * 状態・Queueの完成保存と実行Leaseの本番接続を構築する。
 * @responsibility 既存の読取り・保存Port、Queue適用順と短期排他・実行Leaseを同じ場所で接続する。
 * @trace ARCH-000004、ARCH-000008
 */

import {
  createQueue,
  type ProjectQueueEntry,
  readProjectExecutionState,
  readQueueEntry,
  saveProjectExecutionState,
  selectQueueEntry,
  updateQueue,
} from "../../../execution-model/src/index.ts";
import {
  acquireCoordinatorSnapshotLease,
  activeLeaseIsObserved,
  borrowCoordinatorActiveLease,
  inspectCoordinatorSnapshotLeaseAcquisitionOwner,
  reconcileCoordinatorSnapshotLeaseOwnerLoss,
  settleCoordinatorSnapshotQueueLeaseRelease,
} from "../execution/lease.ts";
import { verifyRuntimePersistenceRepository } from "../execution/persistence.ts";
import { resolveCoordinatorWorkspaceTaskTarget } from "../workspace/operations.ts";
import type {
  CoordinatorLease,
  CoordinatorLeasePort,
  CoordinatorPersistencePorts,
  CoordinatorStatePort,
} from "./persistence.ts";
import { blocked, completed, type StoreResult } from "./result.ts";
import { validIdentity } from "./validation.ts";

/**
 * 統合保存の状態操作と排他操作を一組として接続する。
 *
 * @responsibility 既存Persistence Portを新版の保存・取得・回復へ結合する。
 * @trace ARCH-000004
 * @input 検証済みRepository Root、binding、任意の実行ID・要求内容の結合。
 * @returns 既存のState PortとLease Port。
 * @precondition 新規開始の初回保存だけを既存の初期化へ接続し、再開は保存済み記録を要求する。
 * @postcondition 停止理由とexact回復参照を変更せず既存利用側へ返す。
 * @effect 構築時はなし。操作時の保存・実排他は各接続先が所有する。
 * @failure Operation回復のQueue欠落・結合不一致は停止する。
 * @invariant Adoption回復を通常Queueの更新へ変換しない。
 * @boundary CoreのPersistence PortとRepository内の統合保存。
 * @security 旧形式Fallback、未知IDの再開からの初期化、要求内容の自動付替えを行わない。
 * @concurrency 各操作が既存の短期保存Ownerと実行Leaseの分離を維持する。
 */
export function createCoordinatorSnapshotPersistencePorts(
  workingDirectory: string,
  repositoryBindingId: string,
  intake?: Readonly<{
    operation: "start" | "resume";
    queueId: string;
    requestHash: string;
    projectId: string;
    milestoneId: string;
  }>,
): CoordinatorPersistencePorts {
  const state = createCoordinatorSnapshotStatePort(
    workingDirectory,
    repositoryBindingId,
    intake,
  );
  const lease: CoordinatorLeasePort = Object.freeze({
    acquire: (projectId, queueId, kind) =>
      acquireCoordinatorSnapshotLease(
        workingDirectory,
        repositoryBindingId,
        projectId,
        queueId,
        kind,
      ),
    inspectAcquisitionOwner: () => {
      const observed = inspectCoordinatorSnapshotLeaseAcquisitionOwner(
        workingDirectory,
        repositoryBindingId,
      );
      return intake?.operation === "start" &&
        observed.status === "blocked" &&
        observed.reason === "orchestrator_snapshot_absent" &&
        !observed.manualRecoveryRequired &&
        observed.recoveryId === null
        ? completed("orchestrator_snapshot_absent", { acquisition: null })
        : observed;
    },
    reconcileOperationOwnerLoss: (projectId, queueId, observeOwner) => {
      const result = reconcileCoordinatorSnapshotLeaseOwnerLoss(
        workingDirectory,
        repositoryBindingId,
        projectId,
        queueId,
        "project-operation",
        observeOwner,
      );
      if (result.status !== "completed") return result;
      const queue = result.value.queue;
      if (!queue || queue.projectId !== projectId || queue.queueId !== queueId)
        return blocked(
          "orchestrator_lease_recovery_queue_mismatch",
          result.value.recoveryId !== null,
          result.value.recoveryId,
        );
      return completed(result.reason, queue);
    },
    reconcileAdoptionOwnerLoss: (projectId, observeOwner) => {
      const result = reconcileCoordinatorSnapshotLeaseOwnerLoss(
        workingDirectory,
        repositoryBindingId,
        projectId,
        "canonical",
        "canonical-adoption",
        observeOwner,
      );
      if (result.status !== "completed") return result;
      return completed(result.reason, { recoveryId: result.value.recoveryId });
    },
  });
  return Object.freeze({ state, lease });
}

/**
 * 既存優先順位から保存側へ渡す閉じた選択判断を作る。
 * @responsibility interactive優先・実Owner待機・scheduled再開をCoordinatorで決める。
 * @trace ARCH-000004
 * @input entries: 同じ短期Owner内のfresh Queue配列。
 * @returns 選択IDと元世代、固定理由、限定されたQueue更新の値。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect N/A: 同期の値操作だけ。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 選択判断だけで実行許可・排他・保存完了を成立させない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・任意Snapshot callback・実行Authorityを公開しない。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */

function chooseCoordinatorQueueOperation(
  entries: readonly ProjectQueueEntry[],
) {
  const ordered = [...entries].sort((a, b) =>
    a.queueId < b.queueId ? -1 : a.queueId > b.queueId ? 1 : 0,
  );
  const isActive = ordered.some((item) => item.ownerGeneration !== null);
  const interactive = ordered.find(
    (item) =>
      item.originLane === "interactive" &&
      item.state === "queued" &&
      item.ownerGeneration === null,
  );
  if (isActive || interactive) {
    const resumeCondition = isActive
      ? "active_operation_pending"
      : "interactive_queue_pending";
    return {
      reason: isActive
        ? ("orchestrator_active_operation_retained" as const)
        : ("orchestrator_interactive_queue_selected" as const),
      selectedQueueId: isActive ? null : (interactive?.queueId ?? null),
      selectedQueueGeneration: isActive
        ? null
        : (interactive?.generation ?? null),
      updates: entries
        .filter(
          (item) =>
            item.originLane === "scheduled" &&
            item.state === "queued" &&
            item.ownerGeneration === null,
        )
        .map((item) => ({
          queueId: item.queueId,
          expectedGeneration: item.generation,
          state: "waiting_foreground" as const,
          resumeCondition,
        })),
    };
  }
  const waiting = ordered.find(
    (item) =>
      item.originLane === "scheduled" &&
      item.state === "waiting_foreground" &&
      item.ownerGeneration === null,
  );
  if (waiting)
    return {
      reason: "orchestrator_scheduled_queue_selected" as const,
      selectedQueueId: waiting.queueId,
      selectedQueueGeneration: waiting.generation,
      updates: [
        {
          queueId: waiting.queueId,
          expectedGeneration: waiting.generation,
          state: "queued" as const,
          resumeCondition: null,
        },
      ],
    };
  const value =
    ordered.find(
      (item) =>
        item.originLane === "scheduled" &&
        item.state === "queued" &&
        item.ownerGeneration === null,
    ) ?? null;
  return {
    reason: value
      ? ("orchestrator_scheduled_queue_selected" as const)
      : ("orchestrator_queue_empty" as const),
    selectedQueueId: value?.queueId ?? null,
    selectedQueueGeneration: value?.generation ?? null,
    updates: [],
  };
}

/**
 * 統合保存用State／Queueの全操作を構成する。
 * @responsibility 既存Portの世代・選択・実行Owner・回復契約を同じ保存Ownerへ接続する。
 * @trace ARCH-000004
 * @input workingDirectory、binding、任意の実行ID・要求内容の結合。
 * @returns State／Queue Port。既存本番Factoryは変更しない。
 * @precondition 要求・計画・主体が検証済みで、再開時は同IDの記録がある。
 * @postcondition 各操作が同じ排他内の比較と保存確認を使用する。
 * @effect 操作時にだけ統合Snapshotを読取り・保存する。
 * @failure 世代・受付・Owner・回復不一致は保全停止する。
 * @invariant 保存改訂をState／Queue世代や実資源の証明にしない。
 * @boundary Coreの既存State Portと統合保存。
 * @security 過去Requestを現在世代へ自動付替えしない。
 * @concurrency 選択から待機Queue更新まで自己再取得せず一つの短期Ownerに閉じる。
 */
export function createCoordinatorSnapshotStatePort(
  workingDirectory: string,
  binding: string,
  intake?: Readonly<{
    operation: "start" | "resume";
    queueId: string;
    requestHash: string;
    projectId: string;
    milestoneId: string;
  }>,
): CoordinatorStatePort {
  const storageRepository =
    verifyRuntimePersistenceRepository(workingDirectory);
  if (!validIdentity(binding)) throw new Error("snapshot_port_binding_invalid");
  return Object.freeze({
    readWorkspaceTaskTarget: (queueId: string) =>
      resolveCoordinatorWorkspaceTaskTarget(workingDirectory, binding, queueId),
    updateTask: (request, expectedGeneration) =>
      saveProjectExecutionState(
        storageRepository,
        binding,
        request,
        expectedGeneration,
        intake,
      ),
    readState: (projectId) => {
      const observed = readProjectExecutionState(
        storageRepository,
        binding,
        projectId,
      );
      return intake?.operation === "start" &&
        observed.status === "blocked" &&
        observed.reason === "orchestrator_snapshot_absent" &&
        !observed.manualRecoveryRequired &&
        observed.recoveryId === null
        ? {
            status: "completed" as const,
            reason: observed.reason,
            value: null,
            taskStartCandidates: null,
          }
        : observed;
    },
    enqueueOperation: (input, initialization) => {
      const result = createQueue(storageRepository, binding, {
        kind: "scheduled",
        input: initialization ? [input, initialization] : [input],
      });
      return result;
    },
    readQueue: (queueId) => readQueueEntry(storageRepository, binding, queueId),
    selectNextOperation: () =>
      selectQueueEntry(
        storageRepository,
        binding,
        chooseCoordinatorQueueOperation,
      ),
    updateQueue: (queueId, expectedGeneration, next) => {
      let active: ReturnType<typeof borrowCoordinatorActiveLease>;
      return updateQueue(storageRepository, binding, {
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
          {
            borrowActiveLease: () => {
              active = borrowCoordinatorActiveLease(
                next.lease as CoordinatorLease,
              );
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
          },
        ],
      });
    },
    settleQueueRecovery: (queueId, expectedGeneration, recoveryId) =>
      updateQueue(storageRepository, binding, {
        kind: "recovery",
        input: [queueId, expectedGeneration, recoveryId],
      }),
    settleQueueLeaseRelease: (queueId, expectedGeneration, ownerGeneration) =>
      settleCoordinatorSnapshotQueueLeaseRelease(
        storageRepository,
        binding,
        queueId,
        expectedGeneration,
        ownerGeneration,
      ),
  });
}

/**
 * 計画を生成せず単発Taskを同じRepositoryへ保存する。
 * @responsibility 入力同一性と実Workspace所属を既存Snapshotで確定する。
 * @trace ARCH-000004
 * @input 現在Root、binding、単発Queue。
 * @returns 同一受付又は確定した新品Queue。
 * @precondition 上位で実Projectと主体を認可する。
 * @postcondition 保存確認より前に下位実行を開始しない。
 * @effect 既存state.jsonの更新のみ。
 * @failure 旧世代、別入力、無効Workspaceは停止。
 * @invariant Project計画・架空Milestoneを作らない。
 * @boundary 単発受付と既存Writer。
 * @security 本文・資格を保存しない。
 * @concurrency 既存Snapshot排他だけを使用する。
 */
export function enqueueCoordinatorSingleTask(
  workingDirectory: string,
  binding: string,
  input: ProjectQueueEntry,
): StoreResult<ProjectQueueEntry> {
  return createQueue(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    { kind: "single", input: [input] },
  );
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
): StoreResult<ProjectQueueEntry> {
  let active: ReturnType<typeof borrowCoordinatorActiveLease>;
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
          borrowActiveLease: () => {
            active = borrowCoordinatorActiveLease(lease);
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
          now: () => Date.now(),
        },
      ],
    },
  );
}

/**
 * 取得意図すらない単発受付だけを未開始の拒否として閉じる。
 * @responsibility Lease競合拒否と取得結果不明を区別する。
 * @trace ARCH-000004
 * @input Repository、binding、受付ID、期待世代と固定理由。
 * @returns 同じ受付の終端、又は処置しない停止。
 * @precondition Providerと実Leaseの取得を開始していない。
 * @postcondition 取得意図があればcleanupを確定しない。
 * @effect 既存Writerと履歴搬送待ちだけ。
 * @failure 取得意図・段階・世代が異なれば停止する。
 * @invariant 新しいLeaseや回復参照を捏造しない。
 * @boundary 受付Ownerと既存保存。
 * @security 本文を保存しない。
 * @concurrency 既存Snapshotの短期排他で照合する。
 */
export function closeUnstartedCoordinatorSingleTask(
  workingDirectory: string,
  binding: string,
  queueId: string,
  expectedGeneration: number,
  reason: string,
): StoreResult<ProjectQueueEntry> {
  return updateQueue(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    {
      kind: "close_unstarted",
      input: [queueId, expectedGeneration, reason, { now: () => Date.now() }],
    },
  );
}
