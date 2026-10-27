/**
 * Workspaceの論理記録と統合結果の固定用途候補を所有する。
 * @packageDocumentation
 * @responsibility 世代・Queue結合・不変な結果本文の局所判断を提供する。
 * @trace ARCH-000004、ARCH-000008
 * @boundary 保存・Git・実Owner・Authorityは所有しない。
 */
import type { CoordinatorSnapshot } from "../state/types.ts";
import type { CoordinatorResultRecord, CoordinatorWorkspace } from "./types.ts";
import {
  validCoordinatorResultRecord,
  validCoordinatorWorkspace,
  COORDINATOR_INTEGRATION_CONTRACT,
} from "./validation.ts";
import { digest, historyRow } from "../state/validation.ts";
import { encodeRuntimeStateValue } from "../state/codec.ts";
/**
 * Workspaceの現在記録を元世代と非使用条件へ限定して更新する。
 * @responsibility Queue・Lease値・世代・未解決参照・破棄確認を元の順序で検査する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh Snapshot、対象ID・期待世代・次値、observations: 同じOwnerが取得するProcess IDと有限時刻観測。
 * @returns 既存結果封筒の変更候補又は投影、拒否時は元の固定理由。
 * @precondition 同じ短期保存Ownerがfresh SnapshotとRepository結合を検証している。
 * @postcondition 入力と対象外区画を変更せず、拒否・非削除では時計を呼ばない。
 * @effect 成功する削除候補の末尾でだけ同期時計を二回観測する。保存・Git操作なし。
 * @failure 元の判定順と拒否理由を維持する。
 * @invariant 候補のcompletedを耐久保存・認可・実資源終了の証明へ読み替えない。
 * @boundary Coordinator専用メモリ投影と、別Ownerが持つ単一Writer。
 * @security 値はAuthorityではなく、保存Ownerや任意Snapshot callbackを公開せず、用途固定の同期clock以外を受けない。
 * @concurrency 保存CASと現在Owner再確認・解放は既存Writerが行う。
 */

export function prepareCoordinatorWorkspaceRecordUpdate(
  current: CoordinatorSnapshot,
  projectId: string,
  queueId: string,
  ownerGeneration: string,
  workspaceId: string,
  expectedGeneration: number,
  nextRecord: CoordinatorWorkspace | null,
  observations: Readonly<{ processId: number; now: () => number }>,
) {
  const queue = current.queueEntries.find(
    (entry) => entry.queueId === queueId && entry.projectId === projectId,
  );
  const owned = current.leaseIntents.some(
    (intent) =>
      intent.projectId === projectId &&
      intent.queueId === queueId &&
      intent.kind === "project-operation" &&
      intent.phase === "lock_owned" &&
      intent.ownerGeneration === ownerGeneration &&
      intent.ownerProcessId === observations.processId,
  );
  if (!queue || !owned) return blocked("orchestrator_workspace_lease_mismatch");
  const previous = current.workspaces.find(
    (entry) => entry.workspaceId === workspaceId,
  );
  if ((previous?.generation ?? 0) !== expectedGeneration)
    return blocked("orchestrator_workspace_generation_conflict");
  if (queue.workspaceId != null && queue.workspaceId !== workspaceId)
    return blocked("orchestrator_workspace_target_mismatch");
  if (
    nextRecord &&
    (!validCoordinatorWorkspace(nextRecord) ||
      nextRecord.workspaceId !== workspaceId ||
      nextRecord.generation !== expectedGeneration + 1)
  )
    return blocked("orchestrator_workspace_record_invalid");
  // binding-wide操作Leaseを維持し、既存Task／回復参照から非使用を導く。
  const affectedProjects = new Set(
    current.queueEntries
      .filter((entry) => entry.workspaceId === workspaceId)
      .map((entry) => entry.projectId),
  );
  affectedProjects.add(projectId);
  const singleTaskBusy = current.queueEntries.some(
    (entry) =>
      affectedProjects.has(entry.projectId) &&
      entry.singleTask &&
      (entry.singleTask.phase !== "settled" ||
        !entry.singleTask.cleanupConfirmed ||
        entry.singleTask.recoveryIds.length > 0),
  );
  const busy =
    singleTaskBusy ||
    current.projects
      .filter((entry) => affectedProjects.has(entry.projectId))
      .some((entry) =>
        entry.tasks.some(
          (task) =>
            [
              "starting",
              "running",
              "cleanup_pending",
              "recovery_required",
            ].includes(task.state) ||
            task.recoveryUnresolved ||
            task.recoveryObligations.some(
              (obligation) =>
                !["settled", "acknowledged"].includes(obligation.phase),
            ),
        ),
      );
  if (busy) return blocked("orchestrator_workspace_in_use_or_unresolved");
  if (
    (nextRecord?.phase === "discarding" || nextRecord === null) &&
    current.queueEntries.some(
      (entry) =>
        entry.workspaceId === workspaceId &&
        entry.queueId !== queueId &&
        !["completed", "cancelled"].includes(entry.state),
    )
  )
    return blocked("orchestrator_workspace_other_queue_pending");
  if (
    nextRecord?.phase === "discarding" &&
    previous?.holdUntil !== null &&
    previous?.holdUntil !== undefined
  )
    return blocked("orchestrator_workspace_held");
  if (
    nextRecord === null &&
    (previous?.lastResult?.worktreeRemoved !== true ||
      previous.lastResult.branchRemoved !== true ||
      previous.lastResult.workspaceDirectoryRetained !== false)
  )
    return blocked("orchestrator_workspace_disposal_unconfirmed");
  const workspaces = current.workspaces.filter(
    (entry) => entry.workspaceId !== workspaceId,
  );
  if (nextRecord) workspaces.push(nextRecord);
  return completed("orchestrator_workspace_record_saved", {
    next: {
      ...current,
      workspaces,
      queueEntries: current.queueEntries.map((entry) =>
        entry.queueId === queueId ||
        (nextRecord === null && entry.workspaceId === workspaceId)
          ? {
              ...entry,
              workspaceId: nextRecord === null ? null : workspaceId,
              ...(nextRecord === null &&
              !["completed", "cancelled"].includes(entry.state)
                ? { state: "cancelled" as const, resumeCondition: null }
                : {}),
              generation: entry.generation + 1,
            }
          : entry,
      ),
      historyPending:
        nextRecord === null
          ? [
              ...current.historyPending,
              historyRow(
                {
                  id: `workspace-${workspaceId}`,
                  occurredAt: new Date(observations.now()).toISOString(),
                  outcome: "cancelled",
                  primaryFailure: previous?.primaryFailure ? "cleanup" : null,
                  cleanup: "confirmed",
                },
                observations.now(),
              ),
            ]
          : current.historyPending,
    },
    value: nextRecord,
  });
}

/**
 * 候補生成の完了形を元の外側freezeだけで構築する。
 * @responsibility 保存完了でない既存三fieldを保持する。
 * @trace ARCH-000004
 * @input reason: 固定理由、value: 局所値。
 * @returns 既存完了封筒。
 * @precondition 局所検査済み。
 * @postcondition nested値はfreeze・cloneしない。
 * @effect N/A: 値構築のみ。
 * @failure N/A: 判定は用途別関数。
 * @invariant 保存・認可成立を表さない。
 * @boundary 非公開constructor。
 * @security Authorityなし。
 * @concurrency N/A: 状態なし。
 */
function completed<T>(reason: string, value: T) {
  return Object.freeze({ status: "completed" as const, reason, value });
}
/**
 * 拒否形を元の五fieldと外側freezeで構築する。
 * @responsibility 候補生成の拒否を保存失敗と混同しない。
 * @trace ARCH-000004
 * @input reason: 元の固定理由。
 * @returns 回復参照なしの拒否。
 * @precondition I/O未発行。
 * @postcondition 回復義務を生成しない。
 * @effect N/A: 値構築のみ。
 * @failure N/A: 判定は用途別関数。
 * @invariant 保存Ownerの失敗を覆わない。
 * @boundary 非公開constructor。
 * @security 秘密・Authorityなし。
 * @concurrency N/A: 状態なし。
 */
function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    value: null,
    manualRecoveryRequired: false,
    recoveryId: null,
  });
}

/**
 * 候補公開・採用結果の保存候補を同じIdentityへ限定する。
 * @responsibility 結果本文の不変・Queue所属と同内容再入場を判定する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 元Snapshot、binding: 保存結合の値、record: 統合又は採用結果。
 * @returns 既存結果封筒の変更候補又は投影、拒否時は元の固定理由。
 * @precondition 同じ短期保存Ownerがfresh SnapshotとRepository結合を検証している。
 * @postcondition 入力と対象外区画を変更しない。
 * @effect N/A: メモリ内の値操作だけ。
 * @failure 元の判定順と拒否理由を維持する。
 * @invariant 候補のcompletedを耐久保存・認可・実資源終了の証明へ読み替えない。
 * @boundary Coordinator専用メモリ投影と、別Ownerが持つ単一Writer。
 * @security 値はAuthorityではなく、保存Ownerや任意callbackを公開しない。
 * @concurrency 保存CASと現在Owner再確認・解放は既存Writerが行う。
 */

export function prepareCoordinatorIntegrationRecordCreation(
  current: CoordinatorSnapshot,
  binding: Pick<
    CoordinatorResultRecord,
    "repositoryBindingId" | "projectId" | "milestoneId" | "queueId"
  >,
  record: Pick<CoordinatorResultRecord, "kind" | "identity" | "value">,
) {
  const value: CoordinatorResultRecord = {
    contract: COORDINATOR_INTEGRATION_CONTRACT,
    kind: record.kind,
    repositoryBindingId: binding.repositoryBindingId,
    projectId: binding.projectId,
    milestoneId: binding.milestoneId,
    queueId: binding.queueId,
    identity: record.identity,
    contentHash: digest(encodeRuntimeStateValue(record.value)),
    value: record.value,
  };
  if (!validCoordinatorResultRecord(value))
    return blocked("orchestrator_result_invalid");
  const queue = current.queueEntries.find(
    (item) => item.queueId === binding.queueId,
  );
  if (
    (value.kind === "integration" && (!queue || queue.singleTask)) ||
    (value.milestoneId === null && !queue?.singleTask) ||
    (queue &&
      (queue.projectId !== binding.projectId ||
        queue.milestoneId !== binding.milestoneId))
  )
    return blocked("orchestrator_result_binding_invalid");
  const old = current.results.find(
    (item) =>
      item.kind === value.kind &&
      item.projectId === value.projectId &&
      item.identity === value.identity,
  );
  if (old && encodeRuntimeStateValue(old) !== encodeRuntimeStateValue(value))
    return blocked("orchestrator_result_identity_conflict");
  return completed("orchestrator_result_durable", {
    next: old ? null : { ...current, results: [...current.results, value] },
    value: { written: true as const },
  });
}
