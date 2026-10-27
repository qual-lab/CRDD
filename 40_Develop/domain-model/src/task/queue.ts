/**
 * Task受付のQueue値と局所CRUD候補を所有する。
 * @packageDocumentation
 * @responsibility 同内容再入場・受付結合・追加候補・読取り投影を提供する。
 * @trace ARCH-000004、ARCH-000008
 * @boundary 実行対象選択・Scheduling・回復判断・物理保存は所有しない。
 */
import type { CoordinatorSnapshot } from "../state/types.ts";
import type {
  ProjectQueueEntry,
  CoordinatorQueueEnqueueInput,
} from "./types.ts";
import { validId } from "../state/validation.ts";
import { validQueueEntry } from "./validation.ts";
import { coordinatorSnapshotIntakeMatches } from "../state/transition.ts";
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
 * 発行時の受付結合を同じSnapshotへ照合する。
 * @responsibility 新規受付又は同じ要求だけを受理候補にする。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 元Snapshot、intake: 発行時の五項目。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect N/A: 同期の値操作だけ。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・任意Snapshot callback・実行Authorityを公開しない。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */
export function inspectCoordinatorQueueIntake(
  current: CoordinatorSnapshot,
  intake: Parameters<typeof coordinatorSnapshotIntakeMatches>[1],
) {
  return coordinatorSnapshotIntakeMatches(current, intake)
    ? completed("orchestrator_intake_verified", {
        next: null,
        value: true as const,
      })
    : blocked("orchestrator_intake_epoch_retired");
}

/**
 * 計画TaskのQueue追加候補を導出する。
 * @responsibility 同一受付・発行時世代・Workspace結合を保持する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 元Snapshot、intakeEpoch: 発行時世代、input: 計画TaskのQueue属性。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect N/A: 同期の値操作だけ。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・任意Snapshot callback・実行Authorityを公開しない。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */
export function prepareCoordinatorQueueEntryCreation(
  current: CoordinatorSnapshot,
  intakeEpoch: string,
  input: CoordinatorQueueEnqueueInput,
) {
  const existing = current.queueEntries.find(
    (item) => item.queueId === input.queueId,
  );
  if (existing) {
    const epoch = current.intakeBindings.find(
      (item) => item.queueId === input.queueId,
    )?.epoch;
    return epoch === intakeEpoch &&
      existing.requestHash === input.requestHash &&
      existing.projectId === input.projectId &&
      existing.milestoneId === input.milestoneId
      ? completed("orchestrator_queue_request_reused", {
          next: null,
          value: existing,
        })
      : blocked("orchestrator_queue_identity_conflict");
  }
  if (current.intakeEpoch !== intakeEpoch)
    return blocked("orchestrator_intake_epoch_retired");
  const value: ProjectQueueEntry = {
    ...input,
    workspaceId: input.workspaceId ?? null,
    state: "queued",
    generation: 1,
    ownerGeneration: null,
    resumeCondition: null,
    resultReference: null,
  };
  if (
    !validQueueEntry(value) ||
    value.singleTask !== undefined ||
    !current.projects.some((item) => item.projectId === value.projectId)
  )
    return blocked("orchestrator_queue_input_invalid");
  if (
    value.workspaceId != null &&
    (!current.queueEntries.some(
      (entry) =>
        entry.projectId === value.projectId &&
        entry.workspaceId === value.workspaceId,
    ) ||
      !current.workspaces.some(
        (entry) =>
          entry.workspaceId === value.workspaceId &&
          entry.phase === "ready" &&
          entry.holdUntil === null,
      ))
  )
    return blocked("orchestrator_workspace_not_ready");
  return completed("orchestrator_queue_entry_durable", {
    next: {
      ...current,
      queueEntries: [...current.queueEntries, value],
      intakeBindings: [
        ...current.intakeBindings,
        { queueId: value.queueId, epoch: intakeEpoch },
      ],
    },
    value,
  });
}

/**
 * 同じSnapshotからQueue一件を照会する。
 * @responsibility 不正ID・不存在・正常投影を既存理由で分ける。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 元Snapshot、queueId: 対象ID。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect N/A: 同期の値操作だけ。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・任意Snapshot callback・実行Authorityを公開しない。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */
export function projectCoordinatorQueueEntry(
  current: CoordinatorSnapshot,
  queueId: string,
) {
  if (!validId(queueId)) return blocked("orchestrator_queue_input_invalid");
  const value = current.queueEntries.find((item) => item.queueId === queueId);
  return value
    ? completed("orchestrator_queue_observed", { next: null, value })
    : blocked("orchestrator_queue_observation_unknown");
}
