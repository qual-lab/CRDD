/**
 * Workspaceと統合結果の完成した保存・読取り操作を提供する。
 * @responsibility 共通保存処理へ接続し、既存の排他・改訂検査・通知順序を維持する。
 * @trace ARCH-000008
 */

import { acquireLock, type Lock } from "@qual-lab/crdd-lock";
import {
  blocked,
  completed,
  type StorageRootInput,
  type StoreResult,
} from "../storage/lock.ts";
import {
  observeSnapshotLeaseResources,
  withSnapshotOperation,
} from "../composition/crud.ts";
import {
  encodeStateValue,
  leaseIdentity,
  leaseScopeOccupied,
  snapshotStateRecord,
  validId,
} from "../composition/validation.ts";
import type { Snapshot } from "../composition/types.ts";
import type {
  RepositoryWorktreeResult,
  WorkspaceCandidateResult,
  WorkspaceRecord,
} from "./types.ts";

import {
  prepareIntegrationRecordCreation,
  prepareWorkspaceCandidateUpdate,
  readWorkspaceCandidateClosure,
  prepareWorkspaceCreationUpdate,
  prepareWorkspaceDiscardUpdate,
  prepareWorkspaceObservationUpdate,
  prepareWorkspaceMetadataUpdate,
} from "./validation.ts";

/** 正本採用を含むWorkspaceのGit処置と観測をRepository単位の物理排他で保護する。 @trace ARCH-000004 */
export function beginWorkspaceOperation(
  repository: StorageRootInput,
  binding: string,
  projectId: string,
  queueId: string,
  workspaceId: string,
  operation:
    | "create"
    | "discard"
    | "observe"
    | "select"
    | "freeze"
    | "adopt"
    | "close-candidate",
) {
  type WorktreeChange = Readonly<{
    generation: number | null;
    linkedToProject: boolean;
    record: WorkspaceRecord | null;
    milestoneId: string | null;
    otherQueuePending: boolean;
    closure: Snapshot["results"][number] | null;
    isHeld(): boolean;
    save(
      expectedGeneration: number,
      next: WorkspaceRecord | null,
      unissuedAdoption?: WorkspaceCandidateResult,
    ): StoreResult<WorkspaceRecord | null>;
    saveObservation(
      expectedGeneration: number,
      result: RepositoryWorktreeResult,
    ): StoreResult<WorkspaceRecord | null>;
    release(): StoreResult<Readonly<{ released: true }>>;
  }>;
  if (
    ![binding, projectId, queueId, workspaceId].every(validId) ||
    (operation !== "create" &&
      operation !== "discard" &&
      operation !== "observe" &&
      operation !== "select" &&
      operation !== "freeze" &&
      operation !== "adopt" &&
      operation !== "close-candidate")
  )
    return blocked<WorktreeChange>("coordinator_lease_identity_invalid");
  const identity = leaseIdentity(
    binding,
    projectId,
    queueId,
    "project-operation",
  );
  let acquired: Lock | null = null;
  const result = withSnapshotOperation<WorktreeChange>(
    repository,
    binding,
    (current, owner) => {
      const queue = current.queueEntries.find(
        (entry) => entry.projectId === projectId && entry.queueId === queueId,
      );
      if (!queue) return blocked("coordinator_lease_binding_invalid");
      if (
        ((operation === "observe" ||
          operation === "freeze" ||
          operation === "adopt" ||
          operation === "close-candidate") &&
          queue.workspaceId !== workspaceId) ||
        (operation === "select" &&
          queue.workspaceId != null &&
          queue.workspaceId !== workspaceId)
      )
        return blocked("coordinator_workspace_target_mismatch");
      if (leaseScopeOccupied(current, workspaceId))
        return blocked("coordinator_lease_unavailable");
      const { absent, area } = observeSnapshotLeaseResources(
        owner.repositoryRoot,
        identity,
      );
      if (!absent) return blocked("workspace_operation_lock_present", true);
      if (
        !observeSnapshotLeaseResources(
          owner.repositoryRoot,
          leaseIdentity(
            binding,
            projectId,
            queueId,
            "project-operation",
            workspaceId,
          ),
        ).absent
      )
        return blocked("workspace_operation_lock_present", true);
      if (area.status !== "ready")
        return blocked("coordinator_workspace_operation_unconfirmed");
      const locked = acquireLock({
        directory: area.directory,
        name: `coordinator.lease.${identity}.lock`,
        identity,
      });
      if (locked.status !== "acquired")
        return blocked(
          "workspace_operation_lock_requires_manual_review",
          !locked.cleanupConfirmed || locked.reason === "lock_exists",
        );
      const lock = locked.lock;
      acquired = lock;
      const rootHash = owner.repositoryRootHash;
      const storage = { directory: owner.repositoryRoot };
      const record =
        current.workspaces.find((item) => item.workspaceId === workspaceId) ??
        null;
      const linkedToProject = current.queueEntries.some(
        (entry) =>
          entry.projectId === projectId && entry.workspaceId === workspaceId,
      );
      const closure =
        operation === "close-candidate" && linkedToProject && record?.candidate
          ? readWorkspaceCandidateClosure(current, queue, record.candidate)
          : null;
      if (closure?.status === "blocked") return closure;
      const save = (
        update: (
          fresh: Snapshot,
        ) => ReturnType<typeof prepareWorkspaceObservationUpdate>,
      ) =>
        withSnapshotOperation(storage, binding, (fresh, storageOwner) => {
          if (
            storageOwner.repositoryRootHash !== rootHash ||
            !lock.assertLive()
          )
            return blocked(
              "workspace_operation_lock_requires_manual_review",
              true,
            );
          return update(fresh);
        });
      return completed("coordinator_workspace_operation_locked", {
        next: null,
        value: Object.freeze({
          generation: record?.generation ?? null,
          record: operation !== "create" && linkedToProject ? record : null,
          linkedToProject,
          milestoneId: queue.milestoneId,
          otherQueuePending:
            operation === "close-candidate" &&
            current.queueEntries.some(
              (entry) =>
                entry.workspaceId === workspaceId &&
                entry.queueId !== queueId &&
                entry.state !== "completed" &&
                entry.state !== "cancelled",
            ),
          closure: closure?.value ?? null,
          isHeld: () => lock.assertLive(),
          save(expectedGeneration, next, unissuedAdoption) {
            if (unissuedAdoption !== undefined && operation !== "adopt")
              return blocked("coordinator_workspace_record_invalid");
            if (
              operation === "freeze" ||
              operation === "adopt" ||
              operation === "close-candidate"
            ) {
              if (!next) return blocked("coordinator_workspace_record_invalid");
              let captured: WorkspaceRecord;
              let observation: WorkspaceCandidateResult | undefined;
              try {
                captured = JSON.parse(
                  encodeStateValue(next),
                ) as WorkspaceRecord;
                if (unissuedAdoption !== undefined)
                  observation = JSON.parse(
                    encodeStateValue(unissuedAdoption),
                  ) as WorkspaceCandidateResult;
              } catch {
                return blocked("coordinator_workspace_record_invalid");
              }
              return save((fresh) =>
                prepareWorkspaceCandidateUpdate(
                  fresh,
                  projectId,
                  queueId,
                  workspaceId,
                  expectedGeneration,
                  captured,
                  operation,
                  observation === undefined
                    ? undefined
                    : { initial: record, observation },
                ),
              );
            }
            if (operation === "discard")
              return save((fresh) =>
                prepareWorkspaceDiscardUpdate(
                  fresh,
                  projectId,
                  queueId,
                  workspaceId,
                  expectedGeneration,
                  next,
                ),
              );
            if (operation !== "create" || !next)
              return blocked("coordinator_workspace_record_invalid");
            return save((fresh) =>
              prepareWorkspaceCreationUpdate(
                fresh,
                projectId,
                queueId,
                workspaceId,
                expectedGeneration,
                next,
              ),
            );
          },
          saveObservation(expectedGeneration, result) {
            if (
              operation === "freeze" ||
              operation === "adopt" ||
              operation === "close-candidate"
            )
              return blocked("coordinator_workspace_record_invalid");
            let captured: RepositoryWorktreeResult;
            try {
              const fixed: unknown = JSON.parse(encodeStateValue(result));
              if (!fixed || typeof fixed !== "object" || Array.isArray(fixed))
                return blocked("coordinator_workspace_record_invalid");
              captured = fixed as RepositoryWorktreeResult;
            } catch {
              return blocked("coordinator_workspace_record_invalid");
            }
            return save((fresh) =>
              prepareWorkspaceObservationUpdate(
                fresh,
                projectId,
                queueId,
                workspaceId,
                expectedGeneration,
                captured,
                operation,
              ),
            );
          },
          release() {
            return lock.release()
              ? completed("coordinator_workspace_operation_unlocked", {
                  released: true as const,
                })
              : blocked(
                  "workspace_operation_lock_requires_manual_review",
                  true,
                );
          },
        } satisfies WorktreeChange),
      });
    },
  );
  if (result.status === "blocked" && acquired) {
    const lock: Lock = acquired;
    if (!lock.release()) return blocked<WorktreeChange>(result.reason, true);
  }
  return result;
}

/** 表示名又は保留期限だけを短期保存排他内で更新する。 @trace ARCH-000004
 * @precondition 呼出し側が現在の操作認可を確認している。
 * @effect 既存Stateの比較更新だけ。Worktree・Ref・操作Leaseを作成しない。
 * @failure 既存操作Lease、残存排他、使用中、世代差、保存不明は停止する。
 */
export function updateWorkspaceMetadata(
  repository: StorageRootInput,
  binding: string,
  projectId: string,
  queueId: string,
  workspaceId: string,
  expectedGeneration: number | undefined,
  update: Parameters<typeof prepareWorkspaceMetadataUpdate>[5],
) {
  const captured = snapshotStateRecord(update, new Set(["kind", "value"]));
  if (
    !captured ||
    (captured.kind !== "rename" && captured.kind !== "hold") ||
    (captured.value !== null && typeof captured.value !== "string")
  )
    return blocked("coordinator_snapshot_input_invalid");
  const fixed = { kind: captured.kind, value: captured.value } as const;
  const identity = leaseIdentity(
    binding,
    projectId,
    queueId,
    "project-operation",
  );
  return withSnapshotOperation(
    repository,
    binding,
    (current, owner) =>
      prepareWorkspaceMetadataUpdate(
        current,
        projectId,
        queueId,
        workspaceId,
        expectedGeneration,
        fixed,
        () =>
          observeSnapshotLeaseResources(owner.repositoryRoot, identity)
            .absent &&
          observeSnapshotLeaseResources(
            owner.repositoryRoot,
            leaseIdentity(
              binding,
              projectId,
              queueId,
              "project-operation",
              workspaceId,
            ),
          ).absent,
      ),
    "workspace-metadata",
  );
}

/**
 * 同じ成果Identityの統合記録を作成する。
 * @responsibility 同内容の再送は無書込みとし、異内容の同IDとQueue結合差を拒否する。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。対象結合と統合記録。
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
export function saveIntegrationRecord(
  workingDirectory: StorageRootInput,
  binding: string,
  ...input: Parameters<typeof prepareIntegrationRecordCreation> extends [
    unknown,
    ...infer Rest,
  ]
    ? Rest
    : never
) {
  return withSnapshotOperation<
    Extract<
      ReturnType<typeof prepareIntegrationRecordCreation>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    prepareIntegrationRecordCreation(current, ...input),
  );
}
