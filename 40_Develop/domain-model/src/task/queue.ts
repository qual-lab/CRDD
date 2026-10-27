/**
 * Task受付のQueue値と局所CRUD候補を所有する。
 * @packageDocumentation
 * @responsibility 同内容再入場・受付結合・Queue更新と終了の固定候補・読取り投影を提供する。
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
import { COORDINATOR_PROJECT_SNAPSHOT_SCHEMA } from "../state/validation.ts";
/**
 * 実行Ownerが要求したQueueのLease解放確定候補を導出する。
 * @responsibility 世代・元Owner・解放証拠・intentを照合し、実資源不存在は元位置の観測だけを使う。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh元版、Queue ID・期待世代・Owner世代、用途固定の同期資源観測。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect 値操作と元位置の有限同期観測。物理解放・回復・保存は発行しない。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・生Lockを渡さず、用途限定の同期観測以外を受けない。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */

export function prepareCoordinatorQueueLeaseReleaseSettlement(
  current: CoordinatorSnapshot,
  queueId: string,
  expectedGeneration: number,
  ownerGeneration: string,
  observations: Readonly<{
    resourcesAbsent: (projectId: string) => boolean;
  }>,
) {
  if (current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA)
    return blocked("orchestrator_snapshot_schema_invalid");
  const previous = current.queueEntries.find(
    (item) => item.queueId === queueId,
  );
  if (
    !validId(queueId) ||
    !validId(ownerGeneration) ||
    !Number.isSafeInteger(expectedGeneration) ||
    expectedGeneration < 1 ||
    !previous ||
    previous.generation !== expectedGeneration ||
    previous.ownerGeneration !== ownerGeneration ||
    previous.state === "leased" ||
    previous.state === "running"
  )
    return blocked(
      "orchestrator_queue_release_settlement_state_mismatch",
      true,
    );
  if (observations.resourcesAbsent(previous.projectId) !== true)
    return blocked(
      "orchestrator_queue_release_settlement_resource_present",
      true,
    );
  const evidence = {
    released: current.leaseEvidence.find(
      (item) =>
        item.projectId === previous.projectId &&
        item.content.queueId === queueId &&
        item.content.kind === "project-operation" &&
        item.content.ownerGeneration === ownerGeneration &&
        item.content.disposition === "released",
    ),
    recovered: current.leaseEvidence.find(
      (item) =>
        item.projectId === previous.projectId &&
        item.content.queueId === queueId &&
        item.content.kind === "project-operation" &&
        item.content.ownerGeneration === ownerGeneration &&
        item.content.disposition === "recovered_after_owner_loss",
    ),
  };
  if (
    current.leaseIntents.some(
      (item) => item.ownerGeneration === ownerGeneration,
    )
  )
    return blocked("orchestrator_queue_release_intent_unsettled", true);
  if (!evidence.released || evidence.recovered)
    return blocked("orchestrator_queue_release_evidence_mismatch", true);
  const value = {
    ...previous,
    generation: previous.generation + 1,
    ownerGeneration: null,
  };
  return completed("orchestrator_queue_release_settled", {
    next: {
      ...current,
      queueEntries: current.queueEntries.map((item) =>
        item.queueId === queueId ? value : item,
      ),
    },
    value,
  });
}

/**
 * Coordinatorの閉じた選択判断をfresh Queueへ適用する。
 * @responsibility 対象ID・元世代・重複更新・限定遷移を検査し、優先順位を判断しない。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh元版、decision: 同Owner内のCoordinator選択判断。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect N/A: 同期の値操作だけ。
 * @failure stale世代・重複・対象外更新・不正な選択差分をorchestrator_queue_selection_invalidで拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・任意Snapshot callback・実行Authorityを公開しない。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */

export function prepareCoordinatorQueueSelection(
  current: CoordinatorSnapshot,
  decision: Readonly<{
    reason:
      | "orchestrator_active_operation_retained"
      | "orchestrator_interactive_queue_selected"
      | "orchestrator_scheduled_queue_selected"
      | "orchestrator_queue_empty";
    selectedQueueId: string | null;
    selectedQueueGeneration: number | null;
    updates: readonly Readonly<{
      queueId: string;
      expectedGeneration: number;
      state: "queued" | "waiting_foreground";
      resumeCondition: string | null;
    }>[];
  }>,
) {
  const invalid = blocked("orchestrator_queue_selection_invalid");
  if (
    ![
      "orchestrator_active_operation_retained",
      "orchestrator_interactive_queue_selected",
      "orchestrator_scheduled_queue_selected",
      "orchestrator_queue_empty",
    ].includes(decision.reason)
  )
    return invalid;
  const selected =
    decision.selectedQueueId === null
      ? null
      : current.queueEntries.find(
          (item) => item.queueId === decision.selectedQueueId,
        );
  if (
    (decision.selectedQueueId === null &&
      decision.selectedQueueGeneration !== null) ||
    (decision.selectedQueueId !== null &&
      (!selected ||
        selected.generation !== decision.selectedQueueGeneration ||
        selected.ownerGeneration !== null))
  )
    return invalid;
  if (
    decision.reason === "orchestrator_active_operation_retained" ||
    decision.reason === "orchestrator_queue_empty"
      ? selected !== null
      : !selected
  )
    return invalid;
  if (
    new Set(decision.updates.map((item) => item.queueId)).size !==
    decision.updates.length
  )
    return invalid;
  const waitingReason =
    decision.reason === "orchestrator_active_operation_retained"
      ? "active_operation_pending"
      : decision.reason === "orchestrator_interactive_queue_selected"
        ? "interactive_queue_pending"
        : null;
  if (
    (waitingReason !== null &&
      decision.updates.some(
        (update) =>
          update.state !== "waiting_foreground" ||
          update.resumeCondition !== waitingReason,
      )) ||
    (decision.reason === "orchestrator_queue_empty" &&
      decision.updates.length !== 0) ||
    (decision.reason === "orchestrator_scheduled_queue_selected" &&
      (decision.updates.length > 1 ||
        decision.updates.some(
          (update) =>
            update.queueId !== decision.selectedQueueId ||
            update.state !== "queued" ||
            update.resumeCondition !== null,
        )))
  )
    return invalid;
  for (const update of decision.updates) {
    const prior = current.queueEntries.find(
      (item) => item.queueId === update.queueId,
    );
    if (
      !prior ||
      prior.generation !== update.expectedGeneration ||
      prior.ownerGeneration !== null ||
      prior.originLane !== "scheduled" ||
      !(
        (prior.state === "queued" &&
          update.state === "waiting_foreground" &&
          ["active_operation_pending", "interactive_queue_pending"].includes(
            update.resumeCondition ?? "",
          )) ||
        (prior.state === "waiting_foreground" &&
          update.state === "queued" &&
          update.resumeCondition === null)
      )
    )
      return invalid;
  }
  const queueEntries = current.queueEntries.map((item) => {
    const update = decision.updates.find(
      (value) => value.queueId === item.queueId,
    );
    return update
      ? {
          ...item,
          state: update.state,
          generation: item.generation + 1,
          resumeCondition: update.resumeCondition,
          resultReference: null,
        }
      : item;
  });
  const value =
    decision.selectedQueueId === null
      ? null
      : (queueEntries.find(
          (item) => item.queueId === decision.selectedQueueId,
        ) ?? null);
  if (
    value &&
    ((decision.reason === "orchestrator_interactive_queue_selected" &&
      value.originLane !== "interactive") ||
      (decision.reason === "orchestrator_scheduled_queue_selected" &&
        value.originLane !== "scheduled") ||
      value.state !== "queued")
  )
    return invalid;
  return completed(decision.reason, {
    next: decision.updates.length ? { ...current, queueEntries } : null,
    value,
  });
}

import { validResultReference } from "../state/validation.ts";
import type { ProjectQueueState } from "./types.ts";
const QUEUE_TRANSITIONS = Object.freeze({
  queued: Object.freeze(["leased", "waiting_foreground", "cancelled"]),
  leased: Object.freeze([
    "running",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  running: Object.freeze([
    "integration_pending",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  waiting_foreground: Object.freeze(["queued", "cancelled"]),
  integration_pending: Object.freeze([
    "completed",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  replan_required: Object.freeze([
    "queued",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  human_decision_required: Object.freeze([
    "replan_required",
    "recovery_required",
    "cancelled",
  ]),
  recovery_required: Object.freeze([
    "queued",
    "recovery_required",
    "cancelled",
  ]),
  completed: Object.freeze([]),
  cancelled: Object.freeze([]),
} satisfies Record<ProjectQueueState, readonly ProjectQueueState[]>);

/**
 * 実行Ownerが要求したQueue更新の固定候補を導出する。
 * @responsibility 既存の局所遷移・元Owner相関と対象外保持を確認し、回復の成立・外部Effect・再実行許可は判断しない。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh元版、対象ID・期待世代・固定次値、必要な用途固定観測。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lease・保存・回復を発行しない。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・実Lease・任意Snapshot callbackを受けず、必要な有限観測だけを消費する。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */
export function prepareCoordinatorQueueOperationUpdate(
  current: CoordinatorSnapshot,
  repositoryRoot: string,
  binding: string,
  queueId: string,
  expectedGeneration: number,
  next: Readonly<{
    state: ProjectQueueState;
    resumeCondition: string | null;
    resultReference: string | null;
    leasePresent: boolean;
    leaseIsNull: boolean;
  }>,
  observations: Readonly<{
    borrowActiveLease: () =>
      | Readonly<{
          kind: string;
          repositoryRoot: string;
          repositoryBindingId: string;
          projectId: string;
          queueId: string;
          ownerGeneration: string;
        }>
      | undefined;
    isActiveLeaseObserved: () => boolean;
  }>,
) {
  const previous = current.queueEntries.find(
    (item) => item.queueId === queueId,
  );
  if (previous?.singleTask)
    return blocked("orchestrator_single_task_owner_required");
  if (
    !validId(queueId) ||
    !Number.isSafeInteger(expectedGeneration) ||
    expectedGeneration < 1 ||
    !previous ||
    previous.generation !== expectedGeneration
  )
    return blocked("orchestrator_queue_generation_conflict");
  if (next.resumeCondition !== null && !validId(next.resumeCondition))
    return blocked("orchestrator_queue_resume_condition_invalid");
  if (
    next.resultReference !== null &&
    !validResultReference(next.resultReference)
  )
    return blocked("orchestrator_queue_result_reference_invalid");
  if (
    !(
      QUEUE_TRANSITIONS[previous.state] as readonly ProjectQueueState[]
    ).includes(next.state)
  )
    return blocked("orchestrator_queue_transition_invalid");
  if (
    previous.state === "recovery_required" &&
    next.state === "recovery_required" &&
    !(
      previous.ownerGeneration === null &&
      previous.resumeCondition === "owner_loss" &&
      next.leaseIsNull &&
      next.resumeCondition === "exact_recovery" &&
      next.resultReference !== null
    )
  )
    return blocked("orchestrator_queue_recovery_binding_invalid");
  if (
    previous.state === "recovery_required" &&
    next.state === "queued" &&
    !(
      previous.ownerGeneration === null &&
      previous.resumeCondition === "owner_loss" &&
      previous.resultReference !== null &&
      next.leaseIsNull &&
      next.resumeCondition === null &&
      next.resultReference === null
    )
  )
    return blocked("orchestrator_queue_owner_loss_reset_invalid");
  const activeLease = next.leasePresent
    ? observations.borrowActiveLease()
    : undefined;
  const isRequired =
    previous.ownerGeneration !== null ||
    next.state === "leased" ||
    next.state === "running";
  if (!isRequired && !next.leaseIsNull)
    return blocked("orchestrator_queue_lease_invalid");
  if (
    isRequired &&
    (activeLease?.kind !== "project-operation" ||
      activeLease.repositoryRoot !== repositoryRoot ||
      activeLease.repositoryBindingId !== binding ||
      activeLease.projectId !== previous.projectId ||
      activeLease.queueId !== queueId ||
      observations.isActiveLeaseObserved() !== true)
  )
    return blocked("orchestrator_queue_lease_invalid");
  if (
    isRequired &&
    previous.ownerGeneration !== null &&
    previous.ownerGeneration !== activeLease?.ownerGeneration
  )
    return blocked("orchestrator_queue_owner_mismatch");
  const value: ProjectQueueEntry = {
    ...previous,
    state: next.state,
    generation: previous.generation + 1,
    ownerGeneration: isRequired ? (activeLease?.ownerGeneration ?? null) : null,
    resumeCondition: next.resumeCondition,
    resultReference: next.resultReference,
  };
  if (!validQueueEntry(value))
    return blocked("orchestrator_queue_record_mismatch");
  return completed("orchestrator_queue_state_durable", {
    next: {
      ...current,
      queueEntries: current.queueEntries.map((item) =>
        item.queueId === queueId ? value : item,
      ),
    },
    value,
  });
}
/**
 * 上位が発火したexact回復後Queueの適用候補を導出する。
 * @responsibility 既存の局所遷移・元Owner相関と対象外保持を確認し、回復の成立・外部Effect・再実行許可は判断しない。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh元版、対象ID・期待世代・固定次値、必要な用途固定観測。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lease・保存・回復を発行しない。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・実Lease・任意Snapshot callbackを受けず、必要な有限観測だけを消費する。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */
export function prepareCoordinatorQueueRecoverySettlement(
  current: CoordinatorSnapshot,
  queueId: string,
  expectedGeneration: number,
  recoveryId: string,
) {
  const previous = current.queueEntries.find(
    (item) => item.queueId === queueId,
  );
  if (
    !validId(queueId) ||
    !validResultReference(recoveryId) ||
    !Number.isSafeInteger(expectedGeneration) ||
    expectedGeneration < 1 ||
    !previous ||
    previous.generation !== expectedGeneration
  )
    return blocked("orchestrator_queue_recovery_generation_conflict");
  if (
    previous.state !== "recovery_required" ||
    previous.ownerGeneration !== null ||
    previous.resumeCondition !== "exact_recovery" ||
    previous.resultReference !== recoveryId
  )
    return blocked("orchestrator_queue_recovery_identity_mismatch");
  const value: ProjectQueueEntry = {
    ...previous,
    state: "queued",
    generation: previous.generation + 1,
    ownerGeneration: null,
    resumeCondition: "exact_recovery_settled",
    resultReference: recoveryId,
  };
  return completed("orchestrator_queue_recovery_settled", {
    next: {
      ...current,
      queueEntries: current.queueEntries.map((item) =>
        item.queueId === queueId ? value : item,
      ),
    },
    value,
  });
}

import { encodeRuntimeStateValue } from "../state/codec.ts";
import { inspectSingleTaskRecord } from "./validation.ts";
import type { SingleTaskRecord } from "./types.ts";
import { historyRow } from "../state/validation.ts";
/**
 * 単発Taskの受付候補を既存Queueへ限定する。
 * @responsibility 元ID・世代・失敗・回復参照と対象外区画を保全する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh元版、対象・期待世代・固定次値、必要な有限同期観測。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect 値操作と用途固定の同期観測だけ。保存・実Lease・Provider操作なし。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・実Lease・任意Snapshot callbackを受けず、用途固定の同期観測だけを消費する。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */
export function prepareCoordinatorSingleTaskQueueCreation(
  current: CoordinatorSnapshot,
  intakeEpoch: string,
  input: ProjectQueueEntry,
) {
  if (
    !validQueueEntry(input) ||
    !input.singleTask ||
    input.milestoneId !== null ||
    input.singleTask.phase !== "accepted" ||
    input.state !== "queued" ||
    input.generation !== 1 ||
    input.ownerGeneration !== null ||
    input.resultReference !== null ||
    input.resumeCondition !== null
  )
    return blocked("orchestrator_single_task_input_invalid");
  const existing = current.queueEntries.find(
    (entry) => entry.queueId === input.queueId,
  );
  if (existing) {
    const epoch = current.intakeBindings.find(
      (entry) => entry.queueId === input.queueId,
    )?.epoch;
    const keys = [
      "projectId",
      "milestoneId",
      "requestHash",
      "repositoryRevision",
      "scopeHash",
      "workspaceId",
    ] as const;
    const identityKeys = [
      "principalId",
      "mode",
      "executionSelection",
      "taskId",
      "attemptId",
      "operationId",
    ] as const;
    return epoch === intakeEpoch &&
      existing.singleTask &&
      keys.every((key) => existing[key] === input[key]) &&
      identityKeys.every(
        (key) =>
          encodeRuntimeStateValue(existing.singleTask?.[key]) ===
          encodeRuntimeStateValue(input.singleTask?.[key]),
      )
      ? completed("orchestrator_single_task_reused", {
          next: null,
          value: existing,
        })
      : blocked("orchestrator_queue_identity_conflict");
  }
  if (current.intakeEpoch !== intakeEpoch)
    return blocked("orchestrator_intake_epoch_retired");
  if (
    input.workspaceId != null &&
    (!current.queueEntries.some(
      (entry) =>
        entry.projectId === input.projectId &&
        entry.workspaceId === input.workspaceId,
    ) ||
      !current.workspaces.some(
        (entry) =>
          entry.workspaceId === input.workspaceId &&
          entry.phase === "ready" &&
          entry.holdUntil === null,
      ))
  )
    return blocked("orchestrator_workspace_not_ready");
  return completed("orchestrator_single_task_durable", {
    next: {
      ...current,
      queueEntries: [...current.queueEntries, input],
      intakeBindings: [
        ...current.intakeBindings,
        { queueId: input.queueId, epoch: intakeEpoch },
      ],
    },
    value: input,
  });
}

/**
 * 単発Taskの開始・終端の固定候補を導出する。
 * @responsibility 元ID・世代・失敗・回復参照と対象外区画を保全する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh元版、対象・期待世代・固定次値、必要な有限同期観測。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect 値操作と用途固定の同期観測だけ。保存・実Lease・Provider操作なし。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・実Lease・任意Snapshot callbackを受けず、用途固定の同期観測だけを消費する。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */
export function prepareCoordinatorSingleTaskQueueUpdate(
  current: CoordinatorSnapshot,
  repositoryRoot: string,
  binding: string,
  queueId: string,
  expectedGeneration: number,
  record: SingleTaskRecord,
  observations: Readonly<{
    borrowActiveLease: () =>
      | Readonly<{
          kind: string;
          repositoryRoot: string;
          repositoryBindingId: string;
          projectId: string;
          queueId: string;
          ownerGeneration: string;
        }>
      | undefined;
    isActiveLeaseObserved: () => boolean;
    now: () => number;
  }>,
) {
  const previous = current.queueEntries.find(
    (entry) => entry.queueId === queueId,
  );
  const active = observations.borrowActiveLease();
  if (
    !previous?.singleTask ||
    previous.generation !== expectedGeneration ||
    active?.kind !== "project-operation" ||
    active.repositoryRoot !== repositoryRoot ||
    active.repositoryBindingId !== binding ||
    active.projectId !== previous.projectId ||
    active.queueId !== queueId ||
    observations.isActiveLeaseObserved() !== true ||
    (previous.ownerGeneration !== null &&
      previous.ownerGeneration !== active.ownerGeneration)
  )
    return blocked("orchestrator_single_task_owner_mismatch");
  const identityKeys = [
    "principalId",
    "mode",
    "executionSelection",
    "taskId",
    "attemptId",
    "operationId",
  ] as const;
  if (
    identityKeys.some(
      (key) =>
        encodeRuntimeStateValue(previous.singleTask?.[key]) !==
        encodeRuntimeStateValue(record[key]),
    )
  )
    return blocked("orchestrator_single_task_identity_conflict");
  if (previous.singleTask.phase === "settled") {
    if (
      previous.singleTask.status !== record.status ||
      previous.singleTask.reason !== record.reason ||
      (previous.singleTask.cleanupConfirmed && !record.cleanupConfirmed) ||
      record.recoveryIds.some(
        (id) => !previous.singleTask?.recoveryIds.includes(id),
      )
    )
      return blocked("orchestrator_single_task_terminal_identity_conflict");
    if (
      encodeRuntimeStateValue(previous.singleTask) ===
      encodeRuntimeStateValue(record)
    )
      return completed("orchestrator_single_task_already_saved", {
        next: null,
        value: previous,
      });
  }
  const phases: Record<SingleTaskRecord["phase"], readonly string[]> = {
    accepted: ["starting"],
    starting: ["starting", "running", "settled"],
    running: ["settled"],
    settled: ["settled"],
  };
  if (!phases[previous.singleTask.phase].includes(record.phase))
    return blocked("orchestrator_single_task_transition_invalid");
  const terminal = record.phase === "settled";
  const clean =
    terminal && record.cleanupConfirmed && record.recoveryIds.length === 0;
  const value: ProjectQueueEntry = {
    ...previous,
    singleTask: record,
    generation: previous.generation + 1,
    ownerGeneration: active.ownerGeneration,
    state: !terminal
      ? "running"
      : !clean
        ? "recovery_required"
        : record.status === "cancelled"
          ? "cancelled"
          : "completed",
    resumeCondition: !terminal || clean ? null : "exact_recovery",
    resultReference: clean ? null : previous.resultReference,
  };
  const row = clean
    ? historyRow(
        {
          id: queueId,
          occurredAt: new Date(observations.now()).toISOString(),
          outcome:
            record.status === "completed"
              ? "completed"
              : record.status === "cancelled"
                ? "cancelled"
                : "failed",
          primaryFailure:
            record.status === "completed"
              ? null
              : record.status === "cancelled"
                ? "cancel"
                : "execution",
          cleanup: "confirmed",
        },
        observations.now(),
      )
    : null;
  return completed("orchestrator_single_task_saved", {
    next: {
      ...current,
      queueEntries: current.queueEntries.map((entry) =>
        entry.queueId === queueId ? value : entry,
      ),
      historyPending: row
        ? [...current.historyPending.filter((item) => item.id !== queueId), row]
        : current.historyPending,
    },
    value,
  });
}

/**
 * 未開始単発Taskの終了候補を既存の条件へ限定する。
 * @responsibility 元ID・世代・失敗・回復参照と対象外区画を保全する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh元版、対象・期待世代・固定次値、必要な有限同期観測。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect 値操作と用途固定の同期観測だけ。保存・実Lease・Provider操作なし。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・実Lease・任意Snapshot callbackを受けず、用途固定の同期観測だけを消費する。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */
export function prepareCoordinatorUnstartedTaskQueueClosure(
  current: CoordinatorSnapshot,
  queueId: string,
  expectedGeneration: number,
  reason: string,
  observations: Readonly<{ now: () => number }>,
) {
  const previous = current.queueEntries.find(
    (entry) => entry.queueId === queueId,
  );
  if (
    !previous?.singleTask ||
    previous.generation !== expectedGeneration ||
    previous.singleTask.phase !== "accepted" ||
    previous.ownerGeneration !== null ||
    current.leaseIntents.some((intent) => intent.queueId === queueId)
  )
    return blocked("orchestrator_single_task_unstarted_unconfirmed");
  const record = inspectSingleTaskRecord({
    ...previous.singleTask,
    phase: "settled",
    status: "blocked",
    reason,
    cleanupConfirmed: true,
  });
  if (!record) return blocked("orchestrator_single_task_record_invalid");
  const value: ProjectQueueEntry = {
    ...previous,
    singleTask: record,
    generation: previous.generation + 1,
    state: "completed",
    resumeCondition: null,
  };
  const row = historyRow(
    {
      id: queueId,
      occurredAt: new Date(observations.now()).toISOString(),
      outcome: "failed",
      primaryFailure: "execution",
      cleanup: "confirmed",
    },
    observations.now(),
  );
  return completed("orchestrator_single_task_not_started", {
    next: {
      ...current,
      queueEntries: current.queueEntries.map((entry) =>
        entry.queueId === queueId ? value : entry,
      ),
      historyPending: row
        ? [...current.historyPending, row]
        : current.historyPending,
    },
    value,
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
function blocked(
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
