/**
 * Task・Queue・単独実行状態の完成した保存・読取り操作を提供する。
 * @responsibility 共通保存処理へ接続し、既存の排他・改訂検査・通知順序を維持する。
 * @trace ARCH-000008
 */
import {
  leaseIdentity,
  snapshotStateRecord,
  snapshotStateArray,
  validId,
  encodeStateValue,
} from "../state/operations.ts";
import type { Repository } from "../../../version-control/src/index.ts";
import {
  readExecutionContent,
  saveExecutionDefinition,
  withSnapshotOperation,
} from "../state/crud.ts";
import type {
  ExecutionModelAccess,
  StateVersion,
  Snapshot,
} from "../state/types.ts";
import type { StoreResult } from "../storage/lock.ts";
import { blocked } from "../storage/lock.ts";
import type {
  ProjectQueueEntry,
  ProjectTaskDefinition,
  QueueCreateRequest,
  QueueUpdateRequest,
  ProjectQueueState,
  QueueEnqueueInput,
  SingleTaskRecord,
} from "./types.ts";
import { snapshotIntakeMatches } from "../state/validation.ts";
import { historyRow } from "../history/validation.ts";
import { PROJECT_SNAPSHOT_SCHEMA } from "../state/types.ts";
import {
  validResultReference,
  validQueueEntry,
  inspectSingleTaskRecord,
} from "./validation.ts";
/**
 * 同じSnapshotのQueue一件を照会する。
 * @responsibility 不正IDと観測不能を拒否し、Queue不存在を成功へ補完しない。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Queue ID。
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
export function readQueueEntry(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<typeof projectQueueEntry> extends [
    unknown,
    ...infer Rest,
  ]
    ? Rest
    : never
) {
  return withSnapshotOperation<
    Extract<
      ReturnType<typeof projectQueueEntry>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    projectQueueEntry(current, ...input),
  );
}

/**
 * fresh Queue集合から実行順の選択差分を保存する。
 * @responsibility Coordinatorの同期選択を元の短期排他内で呼び、対象ID・世代・限定差分を再検査する。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Queue集合から閉じた選択差分を返す同期選択。
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
export function selectQueueEntry(
  workingDirectory: Repository,
  binding: string,
  select: (
    entries: readonly ProjectQueueEntry[],
  ) => Parameters<typeof prepareQueueSelection>[1],
) {
  return withSnapshotOperation<
    Extract<
      ReturnType<typeof prepareQueueSelection>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    prepareQueueSelection(current, select(current.queueEntries)),
  );
}

/**
 * Task定義の固定CRUDを保存する。
 * @responsibility task.createだけを同じWriterへ接続する。
 * @trace ARCH-000008
 * @input access: Host認可、request: 対象・元版・定義。
 * @returns 保存、競合、拒否又は未確定。
 * @precondition 明示初期化済みで対象が管理実行から参照されていない。
 * @postcondition Task完了・受入・文書更新を捏造しない。
 * @effect 既存共通保存だけ。
 * @failure 不正値・CAS差・定義差・参照中・観測不能を拒否する。
 * @invariant 自動再適用・Cascade・新取引機構を追加しない。
 * @boundary 一般定義APIと共通Writer。
 * @security 現在の内容認可を再検査する。
 * @concurrency 同じ短期排他を一回使用する。
 */
export function createTask(
  access: ExecutionModelAccess,
  request: Readonly<
    { projectId: string; milestoneId: string; expected: StateVersion } & {
      definition: ProjectTaskDefinition;
    }
  >,
) {
  return saveExecutionDefinition(access, "task.create", request);
}

/**
 * Task定義の固定CRUDを保存する。
 * @responsibility task.updateだけを同じWriterへ接続する。
 * @trace ARCH-000008
 * @input access: Host認可、request: 対象・元版・定義。
 * @returns 保存、競合、拒否又は未確定。
 * @precondition 明示初期化済みで対象が管理実行から参照されていない。
 * @postcondition Task完了・受入・文書更新を捏造しない。
 * @effect 既存共通保存だけ。
 * @failure 不正値・CAS差・定義差・参照中・観測不能を拒否する。
 * @invariant 自動再適用・Cascade・新取引機構を追加しない。
 * @boundary 一般定義APIと共通Writer。
 * @security 現在の内容認可を再検査する。
 * @concurrency 同じ短期排他を一回使用する。
 */
export function updateTask(
  access: ExecutionModelAccess,
  request: Readonly<
    { projectId: string; milestoneId: string; expected: StateVersion } & {
      taskId: string;
      definition: ProjectTaskDefinition;
      expectedDefinitionHash: string;
    }
  >,
) {
  return saveExecutionDefinition(access, "task.update", request);
}

/**
 * Task定義の固定CRUDを保存する。
 * @responsibility task.deleteだけを同じWriterへ接続する。
 * @trace ARCH-000008
 * @input access: Host認可、request: 対象・元版・定義。
 * @returns 保存、競合、拒否又は未確定。
 * @precondition 明示初期化済みで対象が管理実行から参照されていない。
 * @postcondition Task完了・受入・文書更新を捏造しない。
 * @effect 既存共通保存だけ。
 * @failure 不正値・CAS差・定義差・参照中・観測不能を拒否する。
 * @invariant 自動再適用・Cascade・新取引機構を追加しない。
 * @boundary 一般定義APIと共通Writer。
 * @security 現在の内容認可を再検査する。
 * @concurrency 同じ短期排他を一回使用する。
 */
export function deleteTask(
  access: ExecutionModelAccess,
  request: Readonly<
    { projectId: string; milestoneId: string; expected: StateVersion } & {
      taskId: string;
      expectedDefinitionHash: string;
    }
  >,
) {
  return saveExecutionDefinition(access, "task.delete", request);
}

/**
 * Task定義と現在の管理実行を照会する。
 * @responsibility tasksの有限投影だけを返す。
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
export function queryTasks(
  access: ExecutionModelAccess,
  request: Readonly<{ projectId: string; milestoneId: string }>,
) {
  return readExecutionContent(access, "tasks", request);
}

/**
 * 対象の受付Queueを照会する。
 * @responsibility queueの有限投影だけを返す。
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
export function queryQueue(
  access: ExecutionModelAccess,
  request: Readonly<{ projectId: string; milestoneId: string }>,
) {
  return readExecutionContent(access, "queue", request);
}

/**
 * Queueの固定処置を同じ保存Ownerで確定する。
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
export function updateQueue(
  workingDirectory: Repository,
  binding: string,
  request: Extract<QueueUpdateRequest, { kind: "operation" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareQueueOperationUpdate>,
    { status: "completed" }
  >["value"]["value"]
>;
export function updateQueue(
  workingDirectory: Repository,
  binding: string,
  request: Extract<QueueUpdateRequest, { kind: "single" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareSingleTaskQueueUpdate>,
    { status: "completed" }
  >["value"]["value"]
>;
export function updateQueue(
  workingDirectory: Repository,
  binding: string,
  request: Extract<QueueUpdateRequest, { kind: "close_unstarted" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareUnstartedTaskQueueClosure>,
    { status: "completed" }
  >["value"]["value"]
>;
export function updateQueue(
  workingDirectory: Repository,
  binding: string,
  request: Extract<QueueUpdateRequest, { kind: "recovery" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareQueueRecoverySettlement>,
    { status: "completed" }
  >["value"]["value"]
>;
export function updateQueue(
  workingDirectory: Repository,
  binding: string,
  request: Extract<QueueUpdateRequest, { kind: "lease_released" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareQueueLeaseReleaseSettlement>,
    { status: "completed" }
  >["value"]["value"]
>;
export function updateQueue(
  workingDirectory: Repository,
  binding: string,
  request: QueueUpdateRequest,
) {
  const captured = snapshotStateRecord(
    request,
    new Set(["kind", "input"]),
  ) as QueueUpdateRequest | null;
  if (!captured) return blocked("orchestrator_snapshot_input_invalid");
  switch (captured.kind) {
    case "operation": {
      const tuple = snapshotStateArray(captured.input, 4);
      if (tuple.status !== "ok" || tuple.value.length < 4)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareQueueOperationUpdate>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current, owner) =>
        prepareQueueOperationUpdate(
          current,
          owner.repositoryRoot,
          binding,
          ...input,
        ),
      );
    }
    case "single": {
      const tuple = snapshotStateArray(captured.input, 4);
      if (tuple.status !== "ok" || tuple.value.length < 4)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareSingleTaskQueueUpdate>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current, owner) =>
        prepareSingleTaskQueueUpdate(
          current,
          owner.repositoryRoot,
          binding,
          ...input,
        ),
      );
    }
    case "close_unstarted": {
      const tuple = snapshotStateArray(captured.input, 4);
      if (tuple.status !== "ok" || tuple.value.length < 4)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareUnstartedTaskQueueClosure>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current) =>
        prepareUnstartedTaskQueueClosure(current, ...input),
      );
    }
    case "recovery": {
      const tuple = snapshotStateArray(captured.input, 3);
      if (tuple.status !== "ok" || tuple.value.length < 3)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareQueueRecoverySettlement>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current) =>
        prepareQueueRecoverySettlement(current, ...input),
      );
    }
    case "lease_released": {
      const tuple = snapshotStateArray(captured.input, 4);
      if (tuple.status !== "ok" || tuple.value.length < 4)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareQueueLeaseReleaseSettlement>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current, owner) =>
        prepareQueueLeaseReleaseSettlement(
          current,
          input[0],
          input[1],
          input[2],
          {
            resourcesAbsent: (projectId) =>
              input[3].resourcesAbsent(
                owner.repositoryRoot,
                leaseIdentity(
                  binding,
                  projectId,
                  input[0],
                  "project-operation",
                ),
              ),
          },
        ),
      );
    }
  }
  return blocked("orchestrator_snapshot_input_invalid");
}

/**
 * Queueの固定処置を同じ保存Ownerで確定する。
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
export function createQueue(
  workingDirectory: Repository,
  binding: string,
  request: Extract<QueueCreateRequest, { kind: "scheduled" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareQueueEntryCreation>,
    { status: "completed" }
  >["value"]["value"]
>;
export function createQueue(
  workingDirectory: Repository,
  binding: string,
  request: Extract<QueueCreateRequest, { kind: "single" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareSingleTaskQueueCreation>,
    { status: "completed" }
  >["value"]["value"]
>;
export function createQueue(
  workingDirectory: Repository,
  binding: string,
  request: QueueCreateRequest,
) {
  const captured = snapshotStateRecord(
    request,
    new Set(["kind", "input"]),
  ) as QueueCreateRequest | null;
  if (!captured) return blocked("orchestrator_snapshot_input_invalid");
  switch (captured.kind) {
    case "scheduled": {
      const tuple = snapshotStateArray(captured.input, 2);
      if (tuple.status !== "ok" || tuple.value.length < 2)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareQueueEntryCreation>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current) =>
        prepareQueueEntryCreation(current, ...input),
      );
    }
    case "single": {
      const tuple = snapshotStateArray(captured.input, 2);
      if (tuple.status !== "ok" || tuple.value.length < 2)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareSingleTaskQueueCreation>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current) =>
        prepareSingleTaskQueueCreation(current, ...input),
      );
    }
  }
  return blocked("orchestrator_snapshot_input_invalid");
}

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

export function prepareQueueLeaseReleaseSettlement(
  current: Snapshot,
  queueId: string,
  expectedGeneration: number,
  ownerGeneration: string,
  observations: Readonly<{
    resourcesAbsent: (projectId: string) => boolean;
  }>,
) {
  if (current.schema !== PROJECT_SNAPSHOT_SCHEMA)
    return blockedQueueCandidate("orchestrator_snapshot_schema_invalid");
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
    return blockedQueueCandidate(
      "orchestrator_queue_release_settlement_state_mismatch",
      true,
    );
  if (observations.resourcesAbsent(previous.projectId) !== true)
    return blockedQueueCandidate(
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
    return blockedQueueCandidate(
      "orchestrator_queue_release_intent_unsettled",
      true,
    );
  if (!evidence.released || evidence.recovered)
    return blockedQueueCandidate(
      "orchestrator_queue_release_evidence_mismatch",
      true,
    );
  const value = {
    ...previous,
    generation: previous.generation + 1,
    ownerGeneration: null,
  };
  return completedQueueCandidate("orchestrator_queue_release_settled", {
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

export function prepareQueueSelection(
  current: Snapshot,
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
  const invalid = blockedQueueCandidate("orchestrator_queue_selection_invalid");
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
  return completedQueueCandidate(decision.reason, {
    next: decision.updates.length ? { ...current, queueEntries } : null,
    value,
  });
}

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
export function prepareQueueOperationUpdate(
  current: Snapshot,
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
    return blockedQueueCandidate("orchestrator_single_task_owner_required");
  if (
    !validId(queueId) ||
    !Number.isSafeInteger(expectedGeneration) ||
    expectedGeneration < 1 ||
    !previous ||
    previous.generation !== expectedGeneration
  )
    return blockedQueueCandidate("orchestrator_queue_generation_conflict");
  if (next.resumeCondition !== null && !validId(next.resumeCondition))
    return blockedQueueCandidate("orchestrator_queue_resume_condition_invalid");
  if (
    next.resultReference !== null &&
    !validResultReference(next.resultReference)
  )
    return blockedQueueCandidate("orchestrator_queue_result_reference_invalid");
  if (
    !(
      QUEUE_TRANSITIONS[previous.state] as readonly ProjectQueueState[]
    ).includes(next.state)
  )
    return blockedQueueCandidate("orchestrator_queue_transition_invalid");
  if (
    next.state !== previous.state &&
    ["queued", "leased", "running"].includes(next.state) &&
    current.blockers.some(
      (blocker) =>
        blocker.status === "active" &&
        blocker.target.projectId === previous.projectId &&
        blocker.target.milestoneId === previous.milestoneId,
    )
  )
    return blockedQueueCandidate("orchestrator_queue_blocker_active");
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
    return blockedQueueCandidate("orchestrator_queue_recovery_binding_invalid");
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
    return blockedQueueCandidate("orchestrator_queue_owner_loss_reset_invalid");
  const activeLease = next.leasePresent
    ? observations.borrowActiveLease()
    : undefined;
  const isRequired =
    previous.ownerGeneration !== null ||
    next.state === "leased" ||
    next.state === "running";
  if (!isRequired && !next.leaseIsNull)
    return blockedQueueCandidate("orchestrator_queue_lease_invalid");
  if (
    isRequired &&
    (activeLease?.kind !== "project-operation" ||
      activeLease.repositoryRoot !== repositoryRoot ||
      activeLease.repositoryBindingId !== binding ||
      activeLease.projectId !== previous.projectId ||
      activeLease.queueId !== queueId ||
      observations.isActiveLeaseObserved() !== true)
  )
    return blockedQueueCandidate("orchestrator_queue_lease_invalid");
  if (
    isRequired &&
    previous.ownerGeneration !== null &&
    previous.ownerGeneration !== activeLease?.ownerGeneration
  )
    return blockedQueueCandidate("orchestrator_queue_owner_mismatch");
  const value: ProjectQueueEntry = {
    ...previous,
    state: next.state,
    generation: previous.generation + 1,
    ownerGeneration: isRequired ? (activeLease?.ownerGeneration ?? null) : null,
    resumeCondition: next.resumeCondition,
    resultReference: next.resultReference,
  };
  if (!validQueueEntry(value))
    return blockedQueueCandidate("orchestrator_queue_record_mismatch");
  return completedQueueCandidate("orchestrator_queue_state_durable", {
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
export function prepareQueueRecoverySettlement(
  current: Snapshot,
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
    return blockedQueueCandidate(
      "orchestrator_queue_recovery_generation_conflict",
    );
  if (
    previous.state !== "recovery_required" ||
    previous.ownerGeneration !== null ||
    previous.resumeCondition !== "exact_recovery" ||
    previous.resultReference !== recoveryId
  )
    return blockedQueueCandidate(
      "orchestrator_queue_recovery_identity_mismatch",
    );
  const value: ProjectQueueEntry = {
    ...previous,
    state: "queued",
    generation: previous.generation + 1,
    ownerGeneration: null,
    resumeCondition: "exact_recovery_settled",
    resultReference: recoveryId,
  };
  return completedQueueCandidate("orchestrator_queue_recovery_settled", {
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
export function prepareSingleTaskQueueCreation(
  current: Snapshot,
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
    return blockedQueueCandidate("orchestrator_single_task_input_invalid");
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
          encodeStateValue(existing.singleTask?.[key]) ===
          encodeStateValue(input.singleTask?.[key]),
      )
      ? completedQueueCandidate("orchestrator_single_task_reused", {
          next: null,
          value: existing,
        })
      : blockedQueueCandidate("orchestrator_queue_identity_conflict");
  }
  if (current.intakeEpoch !== intakeEpoch)
    return blockedQueueCandidate("orchestrator_intake_epoch_retired");
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
    return blockedQueueCandidate("orchestrator_workspace_not_ready");
  return completedQueueCandidate("orchestrator_single_task_durable", {
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
export function prepareSingleTaskQueueUpdate(
  current: Snapshot,
  repositoryRoot: string,
  binding: string,
  queueId: string,
  expectedGeneration: number,
  rawRecord: unknown,
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
  const record = inspectSingleTaskRecord(rawRecord);
  if (!record)
    return blockedQueueCandidate("orchestrator_single_task_record_invalid");
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
    return blockedQueueCandidate("orchestrator_single_task_owner_mismatch");
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
        encodeStateValue(previous.singleTask?.[key]) !==
        encodeStateValue(record[key]),
    )
  )
    return blockedQueueCandidate("orchestrator_single_task_identity_conflict");
  if (previous.singleTask.phase === "settled") {
    if (
      previous.singleTask.status !== record.status ||
      previous.singleTask.reason !== record.reason ||
      (previous.singleTask.cleanupConfirmed && !record.cleanupConfirmed) ||
      record.recoveryIds.some(
        (id) => !previous.singleTask?.recoveryIds.includes(id),
      )
    )
      return blockedQueueCandidate(
        "orchestrator_single_task_terminal_identity_conflict",
      );
    if (encodeStateValue(previous.singleTask) === encodeStateValue(record))
      return completedQueueCandidate("orchestrator_single_task_already_saved", {
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
    return blockedQueueCandidate("orchestrator_single_task_transition_invalid");
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
  return completedQueueCandidate("orchestrator_single_task_saved", {
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
export function prepareUnstartedTaskQueueClosure(
  current: Snapshot,
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
    return blockedQueueCandidate(
      "orchestrator_single_task_unstarted_unconfirmed",
    );
  const record = inspectSingleTaskRecord({
    ...previous.singleTask,
    phase: "settled",
    status: "blocked",
    reason,
    cleanupConfirmed: true,
  });
  if (!record)
    return blockedQueueCandidate("orchestrator_single_task_record_invalid");
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
  return completedQueueCandidate("orchestrator_single_task_not_started", {
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
export function prepareQueueEntryCreation(
  current: Snapshot,
  intakeEpoch: string,
  input: QueueEnqueueInput,
) {
  const existing = current.queueEntries.find(
    (item) => item.queueId === input.queueId,
  );
  if (existing) {
    return snapshotIntakeMatches(current, {
      epoch: intakeEpoch,
      queueId: input.queueId,
      requestHash: input.requestHash,
      projectId: input.projectId,
      milestoneId: input.milestoneId,
    })
      ? completedQueueCandidate("orchestrator_queue_request_reused", {
          next: null,
          value: existing,
        })
      : blockedQueueCandidate("orchestrator_queue_identity_conflict");
  }
  if (current.intakeEpoch !== intakeEpoch)
    return blockedQueueCandidate("orchestrator_intake_epoch_retired");
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
    return blockedQueueCandidate("orchestrator_queue_input_invalid");
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
    return blockedQueueCandidate("orchestrator_workspace_not_ready");
  return completedQueueCandidate("orchestrator_queue_entry_durable", {
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
export function projectQueueEntry(current: Snapshot, queueId: string) {
  if (!validId(queueId))
    return blockedQueueCandidate("orchestrator_queue_input_invalid");
  const value = current.queueEntries.find((item) => item.queueId === queueId);
  return value
    ? completedQueueCandidate("orchestrator_queue_observed", {
        next: null,
        value,
      })
    : blockedQueueCandidate("orchestrator_queue_observation_unknown");
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
function completedQueueCandidate<T>(reason: string, value: T) {
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
function blockedQueueCandidate(
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
