/**
 * 現在状態と実行Leaseの本番接続を構築する。
 * @responsibility 既存の読取り・保存Portと短期排他・実行Leaseを接続する。
 * @trace ARCH-000004、ARCH-000008
 */

import { readCoordinatorSnapshotIntakeEpoch } from "../../../domain-model/src/index.ts";
import {
  acquireCoordinatorSnapshotLease,
  inspectCoordinatorSnapshotLeaseAcquisitionOwner,
  reconcileCoordinatorSnapshotLeaseOwnerLoss,
} from "../execution/lease.ts";
import { verifyRuntimePersistenceRepository } from "../execution/persistence.ts";
import { createCoordinatorSnapshotStatePort } from "../task/queue.ts";
import type {
  CoordinatorLeasePort,
  CoordinatorPersistencePorts,
} from "./persistence.ts";
import { blocked, completed } from "./result.ts";

/**
 * 受付以外の既存操作を現在の保存世代へ接続する。
 * @responsibility 読取り・採用・判断・回復の本番利用側を新版へ結合する。
 * @trace ARCH-000004
 * @input Repository Rootと保存binding。
 * @returns 新版のPersistence Port。
 * @precondition 明示的な初期化が完了している。
 * @postcondition 新版不存在または不正では旧形式を使用しない。
 * @effect Snapshot読取りと短期排他。
 * @failure 不存在、破損、pending、旧版では例外。
 * @invariant Objective受付は発行時世代を指定する専用入口を使用する。
 * @boundary 本番Compositionと保存Port。
 * @security 認証・採用Authorityを生成しない。
 * @concurrency 構築時の世代を固定し、各変更時に再確認する。
 */
export function createCurrentCoordinatorPersistencePorts(
  workingDirectory: string,
  binding: string,
): CoordinatorPersistencePorts {
  const observed = readCoordinatorSnapshotIntakeEpoch(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
  );
  if (observed.reason === "orchestrator_snapshot_lock_release_unconfirmed")
    throw new Error("orchestrator_snapshot_lock_release_unconfirmed");
  if (observed.status !== "completed")
    throw new Error("orchestrator_snapshot_not_initialized");
  return createCoordinatorSnapshotPersistencePorts(
    workingDirectory,
    binding,
    observed.value,
  );
}

/**
 * 統合保存の状態操作と排他操作を一組として接続する。
 *
 * @responsibility 既存Persistence Portを新版の保存・取得・回復へ結合する。
 * @trace ARCH-000004
 * @input 検証済みRepository Root、binding、Request発行時のintakeEpoch。
 * @returns 既存のState PortとLease Port。
 * @precondition 操作前に新版Snapshotを初期化し、発行時の受付世代を固定する。
 * @postcondition 停止理由とexact回復参照を変更せず既存利用側へ返す。
 * @effect 構築時はなし。操作時の保存・実排他は各接続先が所有する。
 * @failure Operation回復のQueue欠落・結合不一致は停止する。
 * @invariant Adoption回復を通常Queueの更新へ変換しない。
 * @boundary CoreのPersistence PortとRepository内の統合保存。
 * @security 旧形式Fallback、暗黙初期化、受付世代の自動付替えを行わない。
 * @concurrency 各操作が既存の短期保存Ownerと実行Leaseの分離を維持する。
 */
export function createCoordinatorSnapshotPersistencePorts(
  workingDirectory: string,
  repositoryBindingId: string,
  intakeEpoch: string,
  intake?: Readonly<{
    epoch: string;
    queueId: string;
    requestHash: string;
    projectId: string;
    milestoneId: string;
  }>,
): CoordinatorPersistencePorts {
  const state = createCoordinatorSnapshotStatePort(
    workingDirectory,
    repositoryBindingId,
    intakeEpoch,
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
    inspectAcquisitionOwner: () =>
      inspectCoordinatorSnapshotLeaseAcquisitionOwner(
        workingDirectory,
        repositoryBindingId,
      ),
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
