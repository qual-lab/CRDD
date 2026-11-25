/**
 * Task・Queue・単独実行状態の完成した保存・読取り操作を提供する。
 * @responsibility 共通保存処理へ接続し、既存の排他・改訂検査・通知順序を維持する。
 * @trace ARCH-000008
 */

import type { StorageRootInput } from "../storage/lock.ts";
import { historyRow } from "../history/validation.ts";
import { blockerAppliesToQueue } from "../decision/validation.ts";
import type { ProjectObjectiveDefinition } from "../objective/types.ts";
import { hasTaskDependencyCycle } from "../objective/validation.ts";
import {
  readExecutionContent,
  saveExecutionDefinition,
  withSnapshotOperation,
} from "../composition/crud.ts";
import {
  encodeStateValue,
  leaseIdentity,
  leaseScopesConflict,
  queuesWithOutstandingRecovery,
  normalizeRepositoryRelativePath,
  REVISION,
  snapshotStateArray,
  snapshotStateRecord,
  validId,
} from "../composition/validation.ts";
import type {
  ExecutionModelAccess,
  ProjectExecutionInitialization,
  ProjectExecutionState,
  Snapshot,
  StateVersion,
} from "../composition/types.ts";
import {
  PROJECT_SNAPSHOT_SCHEMA,
  PROJECT_STATE_CONTRACT,
} from "../composition/types.ts";
import type { StoreResult } from "../storage/lock.ts";
import { blocked } from "../storage/lock.ts";
import type {
  ProjectQueueEntry,
  ProjectQueueState,
  ProjectTaskDefinition,
  QueueCreateRequest,
  QueueEnqueueInput,
  QueueUpdateRequest,
  SingleTaskRecord,
} from "./types.ts";
import {
  inspectSingleTaskRecord,
  inspectTaskExecutionSelections,
  validQueueEntry,
  validResultReference,
  validState,
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
  workingDirectory: StorageRootInput,
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
 * @responsibility 元の短期排他内でEMの固定優先順を適用し、必要な待機・復帰だけを保存する。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding、queueId: 保存先、既存結合、選択範囲を決める対象Queue。
 * @returns 元の候補結果を保存・解放確認後に返す。
 * @precondition 操作認可は呼出し側が現在確認している。
 * @postcondition 未知・元参照・候補外区画を保つ。
 * @effect 既存の読取りと必要な候補保存だけ。
 * @failure 競合・観測不能・例外・解放不明は元の停止へ返す。
 * @invariant 生Owner・任意Snapshot callbackを公開しない。
 * @boundary 固定操作と唯一の短期保存Owner。
 * @security 外部の選択関数を受け取らず、選択を実行許可として扱わない。
 * @concurrency 実行側の物理処置へ短期Lockを持ち越さない。
 */
export function selectNextQueueEntry(
  workingDirectory: StorageRootInput,
  binding: string,
  queueId: string,
) {
  if (!validId(queueId))
    return blocked<ProjectQueueEntry | null>(
      "coordinator_snapshot_input_invalid",
    );
  return withSnapshotOperation<
    Extract<
      ReturnType<typeof prepareQueueSelection>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    prepareQueueSelection(current, queueId),
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
  request: Readonly<{
    projectId: string;
    milestoneId: string;
    queueId?: string;
  }>,
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
 * @input 検証済みRepository、結合、Queue入力と任意の有限初期化入力。
 * @returns 元の保存・拒否・不明結果。
 * @precondition 物理処置と認可は上位Ownerが所有する。
 * @postcondition 他区画とexact Identityを保持する。
 * @effect 有効な初期化入力がある場合だけ既存Storeを初期化し、ProjectとQueueを同じ候補で保存する。
 * @failure 不正種別・競合・観測不能は拒否する。
 * @invariant Callbackの短絡順とLock内のRoot結合を変更しない。
 * @boundary モデル保存と上位の物理処置。
 * @security 任意Snapshot更新を受けない。
 * @concurrency 元のwithSnapshotOperation保持区間を維持する。
 */
export function updateQueue(
  workingDirectory: StorageRootInput,
  binding: string,
  request: Extract<QueueUpdateRequest, { kind: "operation" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareQueueOperationUpdate>,
    { status: "completed" }
  >["value"]["value"]
>;
export function updateQueue(
  workingDirectory: StorageRootInput,
  binding: string,
  request: Extract<QueueUpdateRequest, { kind: "single" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareSingleTaskQueueUpdate>,
    { status: "completed" }
  >["value"]["value"]
>;
export function updateQueue(
  workingDirectory: StorageRootInput,
  binding: string,
  request: Extract<QueueUpdateRequest, { kind: "close_unstarted" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareUnstartedTaskQueueClosure>,
    { status: "completed" }
  >["value"]["value"]
>;
export function updateQueue(
  workingDirectory: StorageRootInput,
  binding: string,
  request: Extract<QueueUpdateRequest, { kind: "recovery" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareQueueRecoverySettlement>,
    { status: "completed" }
  >["value"]["value"]
>;
export function updateQueue(
  workingDirectory: StorageRootInput,
  binding: string,
  request: Extract<QueueUpdateRequest, { kind: "lease_released" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareQueueLeaseReleaseSettlement>,
    { status: "completed" }
  >["value"]["value"]
>;
export function updateQueue(
  workingDirectory: StorageRootInput,
  binding: string,
  request: QueueUpdateRequest,
) {
  const captured = snapshotStateRecord(
    request,
    new Set(["kind", "input"]),
  ) as QueueUpdateRequest | null;
  if (!captured) return blocked("coordinator_snapshot_input_invalid");
  switch (captured.kind) {
    case "operation": {
      const tuple = snapshotStateArray(captured.input, 4);
      if (tuple.status !== "ok" || tuple.value.length < 4)
        return blocked("coordinator_snapshot_input_invalid");
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
        return blocked("coordinator_snapshot_input_invalid");
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
        return blocked("coordinator_snapshot_input_invalid");
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
        return blocked("coordinator_snapshot_input_invalid");
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
        return blocked("coordinator_snapshot_input_invalid");
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
                  current.queueEntries.find(
                    (queue) => queue.queueId === input[0],
                  )?.workspaceId,
                ),
              ),
          },
        ),
      );
    }
  }
  return blocked("coordinator_snapshot_input_invalid");
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
  workingDirectory: StorageRootInput,
  binding: string,
  request: Extract<QueueCreateRequest, { kind: "scheduled" }>,
  prepareDirectory?: () => boolean,
): StoreResult<
  Extract<
    ReturnType<typeof prepareQueueEntryCreation>,
    { status: "completed" }
  >["value"]["value"]
>;
export function createQueue(
  workingDirectory: StorageRootInput,
  binding: string,
  request: Extract<QueueCreateRequest, { kind: "single" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareSingleTaskQueueCreation>,
    { status: "completed" }
  >["value"]["value"]
>;
export function createQueue(
  workingDirectory: StorageRootInput,
  binding: string,
  request: QueueCreateRequest,
  prepareDirectory?: () => boolean,
) {
  const captured = snapshotStateRecord(
    request,
    new Set(["kind", "input"]),
  ) as QueueCreateRequest | null;
  if (!captured) return blocked("coordinator_snapshot_input_invalid");
  switch (captured.kind) {
    case "scheduled": {
      const tuple = snapshotStateArray(captured.input, 2);
      if (tuple.status !== "ok" || tuple.value.length < 1)
        return blocked("coordinator_snapshot_input_invalid");
      let input = tuple.value as unknown as typeof captured.input;
      let initialState: ProjectExecutionState | undefined;
      if (tuple.value.length === 2 && input[1] !== undefined) {
        try {
          const initialization = snapshotStateRecord(
            input[1],
            new Set([
              "taskExecutionSelections",
              "projectId",
              "milestoneId",
              "repositoryRevision",
              "maximumConcurrency",
              "milestoneAcceptanceCriteria",
              "objectives",
              "tasks",
              "ownerGeneration",
            ]),
          );
          if (!initialization)
            return blocked("coordinator_snapshot_input_invalid");
          const created = createProjectExecutionState(
            JSON.parse(encodeStateValue(initialization)),
          );
          if (created.status !== "completed") return blocked(created.reason);
          const queueInput = JSON.parse(encodeStateValue(input[0]));
          const queueKeys = [
            "queueId",
            "projectId",
            "milestoneId",
            "requestHash",
            "originLane",
            "repositoryRevision",
            "scopeHash",
          ];
          if (queueInput && Object.hasOwn(queueInput, "workspaceId"))
            queueKeys.push("workspaceId");
          const queue = snapshotStateRecord(queueInput, new Set(queueKeys));
          if (!queue) return blocked("coordinator_snapshot_input_invalid");
          if (
            created.state.projectId !== queue.projectId ||
            created.state.milestoneId !== queue.milestoneId ||
            created.state.repositoryRevision !== queue.repositoryRevision
          )
            return blocked("coordinator_state_generation_conflict");
          if (!validQueueEntry(createQueuedEntry(queueInput)))
            return blocked("coordinator_queue_input_invalid");
          input = [queueInput, input[1]];
          initialState = created.state;
        } catch {
          return blocked("coordinator_snapshot_input_invalid");
        }
      }

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareQueueEntryCreation>,
          { status: "completed" }
        >["value"]["value"]
      >(
        workingDirectory,
        binding,
        (current) => prepareQueueEntryCreation(current, input[0], initialState),
        initialState === undefined ? false : { prepareDirectory },
      );
    }
    case "single": {
      const tuple = snapshotStateArray(captured.input, 1);
      if (tuple.status !== "ok" || tuple.value.length < 1)
        return blocked("coordinator_snapshot_input_invalid");
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
  return blocked("coordinator_snapshot_input_invalid");
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
    return blockedQueueCandidate("coordinator_snapshot_schema_invalid");
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
      "coordinator_queue_release_settlement_state_mismatch",
      true,
    );
  if (observations.resourcesAbsent(previous.projectId) !== true)
    return blockedQueueCandidate(
      "coordinator_queue_release_settlement_resource_present",
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
      (item) =>
        item.queueId === queueId && item.ownerGeneration === ownerGeneration,
    )
  )
    return blockedQueueCandidate(
      "coordinator_queue_release_intent_unsettled",
      true,
    );
  if (!evidence.released || evidence.recovered)
    return blockedQueueCandidate(
      "coordinator_queue_release_evidence_mismatch",
      true,
    );
  const value = {
    ...previous,
    generation: previous.generation + 1,
    ownerGeneration: null,
  };
  return completedQueueCandidate("coordinator_queue_release_settled", {
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
 * freshな全Queueから次の一件と待機差分を導出する。
 * @responsibility 現在Owner、対話、待機中の予約実行、未開始の予約実行の順を所有する。
 * @trace ARCH-000004、ARCH-000008
 * @precondition 既存の短期Ownerが全Queueの構造・ID一意性と元版を確認済み。
 * @invariant 選択はLease取得・実行許可・保存確定ではない。
 * @effect N/A: 値操作のみ。CAS・短期排他は呼出し側の共通保存が所有する。
 */
export function prepareQueueSelection(current: Snapshot, queueId: string) {
  const entries = current.queueEntries;
  const target = entries.find((entry) => entry.queueId === queueId);
  if (!target)
    return completedQueueCandidate("coordinator_queue_empty", {
      next: null,
      value: null,
    });
  const inLane = (entry: ProjectQueueEntry) =>
    (entry.workspaceId ?? null) === (target.workspaceId ?? null);
  const ordered = entries
    .filter(inLane)
    .sort((a, b) =>
      a.queueId < b.queueId ? -1 : a.queueId > b.queueId ? 1 : 0,
    );
  const reserved = new Set(
    current.leaseIntents.map((intent) => intent.queueId),
  );
  const recovering = queuesWithOutstandingRecovery(current);
  const isActive = entries.some(
    (item) =>
      (item.ownerGeneration !== null ||
        recovering.has(item.queueId) ||
        (item.queueId !== queueId && reserved.has(item.queueId))) &&
      leaseScopesConflict(target.workspaceId, item.workspaceId),
  );
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
    let changed = false;
    const queueEntries = entries.map((item) => {
      if (
        !inLane(item) ||
        item.originLane !== "scheduled" ||
        item.state !== "queued" ||
        item.ownerGeneration !== null ||
        reserved.has(item.queueId)
      )
        return item;
      changed = true;
      return {
        ...item,
        state: "waiting_foreground" as const,
        generation: item.generation + 1,
        resumeCondition,
        resultReference: null,
      };
    });
    return completedQueueCandidate(
      isActive
        ? "coordinator_active_operation_retained"
        : "coordinator_interactive_queue_selected",
      {
        next: changed ? { ...current, queueEntries } : null,
        value: isActive ? null : (interactive ?? null),
      },
    );
  }
  const waiting = ordered.find(
    (item) =>
      item.originLane === "scheduled" &&
      item.state === "waiting_foreground" &&
      item.ownerGeneration === null,
  );
  if (waiting) {
    const value = {
      ...waiting,
      state: "queued" as const,
      generation: waiting.generation + 1,
      resumeCondition: null,
      resultReference: null,
    };
    return completedQueueCandidate("coordinator_scheduled_queue_selected", {
      next: {
        ...current,
        queueEntries: entries.map((item) => (item === waiting ? value : item)),
      },
      value,
    });
  }
  const value =
    ordered.find(
      (item) =>
        item.originLane === "scheduled" &&
        item.state === "queued" &&
        item.ownerGeneration === null,
    ) ?? null;
  return completedQueueCandidate(
    value ? "coordinator_scheduled_queue_selected" : "coordinator_queue_empty",
    { next: null, value },
  );
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
    return blockedQueueCandidate("coordinator_single_task_owner_required");
  if (previous?.historySettled)
    return blockedQueueCandidate("coordinator_execution_already_settled");
  if (
    !validId(queueId) ||
    !Number.isSafeInteger(expectedGeneration) ||
    expectedGeneration < 1 ||
    !previous ||
    previous.generation !== expectedGeneration
  )
    return blockedQueueCandidate("coordinator_queue_generation_conflict");
  if (next.resumeCondition !== null && !validId(next.resumeCondition))
    return blockedQueueCandidate("coordinator_queue_resume_condition_invalid");
  if (
    next.resultReference !== null &&
    !validResultReference(next.resultReference)
  )
    return blockedQueueCandidate("coordinator_queue_result_reference_invalid");
  if (
    !(
      QUEUE_TRANSITIONS[previous.state] as readonly ProjectQueueState[]
    ).includes(next.state)
  )
    return blockedQueueCandidate("coordinator_queue_transition_invalid");
  if (
    next.state !== previous.state &&
    ["queued", "leased", "running"].includes(next.state) &&
    current.blockers.some(
      (blocker) =>
        blocker.status === "active" &&
        blockerAppliesToQueue(current.decisions, blocker, previous),
    )
  )
    return blockedQueueCandidate("coordinator_queue_blocker_active");
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
    return blockedQueueCandidate("coordinator_queue_recovery_binding_invalid");
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
    return blockedQueueCandidate("coordinator_queue_owner_loss_reset_invalid");
  const activeLease = next.leasePresent
    ? observations.borrowActiveLease()
    : undefined;
  const isRequired =
    previous.ownerGeneration !== null ||
    next.state === "leased" ||
    next.state === "running";
  if (!isRequired && !next.leaseIsNull)
    return blockedQueueCandidate("coordinator_queue_lease_invalid");
  if (
    isRequired &&
    (activeLease?.kind !== "project-operation" ||
      activeLease.repositoryRoot !== repositoryRoot ||
      activeLease.repositoryBindingId !== binding ||
      activeLease.projectId !== previous.projectId ||
      activeLease.queueId !== queueId ||
      observations.isActiveLeaseObserved() !== true)
  )
    return blockedQueueCandidate("coordinator_queue_lease_invalid");
  if (
    isRequired &&
    previous.ownerGeneration !== null &&
    previous.ownerGeneration !== activeLease?.ownerGeneration
  )
    return blockedQueueCandidate("coordinator_queue_owner_mismatch");
  const value: ProjectQueueEntry = {
    ...previous,
    state: next.state,
    generation: previous.generation + 1,
    ownerGeneration: isRequired ? (activeLease?.ownerGeneration ?? null) : null,
    resumeCondition: next.resumeCondition,
    resultReference: next.resultReference,
  };
  if (!validQueueEntry(value))
    return blockedQueueCandidate("coordinator_queue_record_mismatch");
  return completedQueueCandidate("coordinator_queue_state_durable", {
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
      "coordinator_queue_recovery_generation_conflict",
    );
  if (
    previous.state !== "recovery_required" ||
    previous.ownerGeneration !== null ||
    previous.resumeCondition !== "exact_recovery" ||
    previous.resultReference !== recoveryId
  )
    return blockedQueueCandidate(
      "coordinator_queue_recovery_identity_mismatch",
    );
  const value: ProjectQueueEntry = {
    ...previous,
    state: "queued",
    generation: previous.generation + 1,
    ownerGeneration: null,
    resumeCondition: "exact_recovery_settled",
    resultReference: recoveryId,
  };
  return completedQueueCandidate("coordinator_queue_recovery_settled", {
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
  input: ProjectQueueEntry,
) {
  if (
    !validQueueEntry(input) ||
    !input.singleTask ||
    input.milestoneId !== null ||
    input.singleTask.phase !== "accepted" ||
    input.state !== "queued" ||
    input.generation !== 1 ||
    input.historySettled !== false ||
    input.ownerGeneration !== null ||
    input.resultReference !== null ||
    input.resumeCondition !== null
  )
    return blockedQueueCandidate("coordinator_single_task_input_invalid");
  const existing = current.queueEntries.find(
    (entry) => entry.queueId === input.queueId,
  );
  if (existing) {
    const keys = [
      "projectId",
      "milestoneId",
      "requestHash",
      "scopeHash",
      "workspaceId",
    ] as const;
    const identityKeys = ["principalId", "mode"] as const;
    return existing.singleTask &&
      keys.every((key) => existing[key] === input[key]) &&
      identityKeys.every(
        (key) =>
          encodeStateValue(existing.singleTask?.[key]) ===
          encodeStateValue(input.singleTask?.[key]),
      )
      ? completedQueueCandidate("coordinator_single_task_reused", {
          next: null,
          value: existing,
        })
      : blockedQueueCandidate("coordinator_queue_identity_conflict");
  }
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
    return blockedQueueCandidate("coordinator_workspace_not_ready");
  return completedQueueCandidate("coordinator_single_task_durable", {
    next: {
      ...current,
      queueEntries: [...current.queueEntries, input],
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
    return blockedQueueCandidate("coordinator_single_task_record_invalid");
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
    return blockedQueueCandidate("coordinator_single_task_owner_mismatch");
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
    return blockedQueueCandidate("coordinator_single_task_identity_conflict");
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
        "coordinator_single_task_terminal_identity_conflict",
      );
    if (encodeStateValue(previous.singleTask) === encodeStateValue(record))
      return completedQueueCandidate("coordinator_single_task_already_saved", {
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
    return blockedQueueCandidate("coordinator_single_task_transition_invalid");
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
  return completedQueueCandidate("coordinator_single_task_saved", {
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
      "coordinator_single_task_unstarted_unconfirmed",
    );
  const record = inspectSingleTaskRecord({
    ...previous.singleTask,
    phase: "settled",
    status: "blocked",
    reason,
    cleanupConfirmed: true,
  });
  if (!record)
    return blockedQueueCandidate("coordinator_single_task_record_invalid");
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
  return completedQueueCandidate("coordinator_single_task_not_started", {
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
 * @input current: 元Snapshot、input: 計画TaskのQueue属性。
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
  input: QueueEnqueueInput,
  initialState?: ProjectExecutionState,
) {
  const existing = current.queueEntries.find(
    (item) => item.queueId === input.queueId,
  );
  if (existing) {
    return existing.singleTask === undefined &&
      existing.requestHash === input.requestHash &&
      existing.projectId === input.projectId &&
      existing.milestoneId === input.milestoneId
      ? completedQueueCandidate("coordinator_queue_request_reused", {
          next: null,
          value: existing,
        })
      : blockedQueueCandidate("coordinator_queue_identity_conflict");
  }
  if (initialState !== undefined) {
    if (
      !validState(initialState) ||
      initialState.generation !== 1 ||
      initialState.queueId !== undefined ||
      initialState.projectId !== input.projectId ||
      initialState.milestoneId !== input.milestoneId ||
      initialState.repositoryRevision !== input.repositoryRevision ||
      current.projects.some(
        (project) =>
          project.projectId === initialState.projectId &&
          (project.queueId === undefined ||
            project.milestoneId !== initialState.milestoneId),
      )
    )
      return blockedQueueCandidate("coordinator_state_generation_conflict");
    current = {
      ...current,
      projects: [
        ...current.projects,
        { ...initialState, queueId: input.queueId },
      ],
    };
  }
  const value = createQueuedEntry(input);
  if (
    !validQueueEntry(value) ||
    value.singleTask !== undefined ||
    !current.projects.some((item) => item.projectId === value.projectId)
  )
    return blockedQueueCandidate("coordinator_queue_input_invalid");
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
    return blockedQueueCandidate("coordinator_workspace_not_ready");
  return completedQueueCandidate("coordinator_queue_entry_durable", {
    next: {
      ...current,
      queueEntries: [...current.queueEntries, value],
    },
    value,
  });
}

/**
 * 計画Queueの初期値を一つの正本で構築する。
 * @responsibility 受付前の構造確認と保存候補で同じ初期属性を使用する。
 * @trace ARCH-000008
 */
function createQueuedEntry(input: QueueEnqueueInput): ProjectQueueEntry {
  return {
    ...input,
    historySettled: false,
    workspaceId: input.workspaceId ?? null,
    state: "queued",
    generation: 1,
    ownerGeneration: null,
    resumeCondition: null,
    resultReference: null,
  };
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
    return blockedQueueCandidate("coordinator_queue_input_invalid");
  const value = current.queueEntries.find((item) => item.queueId === queueId);
  return value
    ? completedQueueCandidate("coordinator_queue_observed", {
        next: null,
        value,
      })
    : blockedQueueCandidate("coordinator_queue_observation_unknown");
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

/** 初回生成の内部結果。保存成功や実行許可ではない。 */
type ProjectInitializationResult =
  | Readonly<{
      status: "completed";
      reason: string;
      state: ProjectExecutionState;
      taskIds: readonly string[];
    }>
  | Readonly<{
      status: "blocked";
      reason: string;
      state: null;
      taskIds: readonly string[];
    }>;

/** 初期値の用途別正規化と重複拒否を保持する。@trace ARCH-000008 */
function captureInitialStrings(
  values: readonly string[],
  kind: "identity_or_path" | "repository_path" | "human_text",
): readonly string[] | null {
  const resultItems: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) return null;
    const normalized =
      kind === "repository_path"
        ? normalizeRepositoryRelativePath(value)
        : kind === "identity_or_path"
          ? value.replaceAll("\\", "/")
          : value;
    if (normalized === null) return null;
    const key = kind === "human_text" ? normalized : normalized.toUpperCase();
    if (seen.has(key)) return null;
    seen.add(key);
    resultItems.push(normalized);
  }
  return Object.freeze(resultItems);
}

/** 初回Task定義を入力から独立した値へ捕捉する。@trace ARCH-000008 */
function captureInitialTaskDefinition(
  definition: ProjectTaskDefinition,
): ProjectTaskDefinition | null {
  if (!validId(definition.id) || !validId(definition.objectiveId)) return null;
  const dependencies = captureInitialStrings(
    definition.dependencies,
    "identity_or_path",
  );
  const allowedPaths = captureInitialStrings(
    definition.allowedPaths,
    "repository_path",
  );
  const conflictKeys = captureInitialStrings(
    definition.conflictKeys,
    "identity_or_path",
  );
  if (
    !dependencies ||
    !allowedPaths ||
    !conflictKeys ||
    allowedPaths.length === 0
  )
    return null;
  return Object.freeze({
    id: definition.id,
    objectiveId: definition.objectiveId,
    dependencies,
    allowedPaths,
    conflictKeys,
  });
}

/** 初回Objectiveの受入説明文をPath変換せず捕捉する。@trace ARCH-000008 */
function captureInitialObjectiveDefinition(
  definition: ProjectObjectiveDefinition,
): ProjectObjectiveDefinition | null {
  if (!validId(definition.id)) return null;
  const acceptanceCriteria = captureInitialStrings(
    definition.acceptanceCriteria,
    "human_text",
  );
  if (!acceptanceCriteria || acceptanceCriteria.length === 0) return null;
  return Object.freeze({ id: definition.id, acceptanceCriteria });
}

/**
 * 初期化入力からgeneration 1のProject状態を組み立てる。
 * @responsibility 選定・ID・定義・参照・DAG・依存待ち初期値と既存拒否理由を所有する。
 * @trace ARCH-000008
 * @input input: 計画・固定選定・Owner世代。I/O前に独立捕捉した値。
 * @returns 初期状態又は既存の拒否理由。保存完了ではない。
 * @precondition 保存利用側は閉形式捕捉を先行する。
 * @postcondition generation 1を固定し、Authority・取消・外部実行を開始しない。
 * @effect N/A: メモリ内の値処理だけ。
 * @failure 不正選定・Identity・定義・依存をblockedとして返す。
 * @invariant 既存の検査順と拒否理由を保持する。
 * @boundary EM内部。製品Rootには公開しない。
 * @security 秘密値や実行許可を生成しない。
 * @concurrency N/A: 保存・競合確認は呼出し元の既存Writerが所有する。
 */
export function createProjectExecutionState(
  input: ProjectExecutionInitialization,
): ProjectInitializationResult {
  const selections = inspectTaskExecutionSelections(
    input.taskExecutionSelections,
  );
  if (
    !selections ||
    !validId(input.projectId) ||
    !validId(input.milestoneId) ||
    !validId(input.ownerGeneration) ||
    !(
      typeof input.repositoryRevision === "string" &&
      REVISION.test(input.repositoryRevision)
    ) ||
    !Number.isSafeInteger(input.maximumConcurrency) ||
    input.maximumConcurrency < 1 ||
    input.maximumConcurrency > 5 ||
    input.tasks.length === 0 ||
    input.objectives.length === 0
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "coordinator_input_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  const definitions = input.tasks.map(captureInitialTaskDefinition);
  const objectiveDefinitions = input.objectives.map(
    captureInitialObjectiveDefinition,
  );
  const milestoneAcceptanceCriteria = captureInitialStrings(
    input.milestoneAcceptanceCriteria,
    "human_text",
  );
  if (definitions.some((definition) => !definition)) {
    return Object.freeze({
      status: "blocked",
      reason: "coordinator_task_definition_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  if (
    objectiveDefinitions.some((definition) => !definition) ||
    !milestoneAcceptanceCriteria ||
    milestoneAcceptanceCriteria.length === 0
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "coordinator_acceptance_definition_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  const completeDefinitions = definitions as readonly ProjectTaskDefinition[];
  const completeObjectiveDefinitions =
    objectiveDefinitions as readonly ProjectObjectiveDefinition[];
  const ids = new Set(completeDefinitions.map((definition) => definition.id));
  const objectiveIds = new Set(
    completeObjectiveDefinitions.map((definition) => definition.id),
  );
  if (
    ids.size !== completeDefinitions.length ||
    objectiveIds.size !== completeObjectiveDefinitions.length ||
    completeDefinitions.some(
      (definition) => !objectiveIds.has(definition.objectiveId),
    ) ||
    completeObjectiveDefinitions.some(
      (objective) =>
        !completeDefinitions.some(
          (definition) => definition.objectiveId === objective.id,
        ),
    ) ||
    completeDefinitions.some(
      (definition) =>
        definition.dependencies.includes(definition.id) ||
        definition.dependencies.some((dependency) => !ids.has(dependency)),
    ) ||
    hasTaskDependencyCycle(completeDefinitions)
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "coordinator_task_graph_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = completeDefinitions.map((definition) =>
    Object.freeze({
      definition,
      state:
        definition.dependencies.length === 0
          ? ("ready" as const)
          : ("waiting_dependency" as const),
      attemptId: null,
      operationId: null,
      authorityBindingId: null,
      startPhase: "none" as const,
      cleanupConfirmed: false,
      recoveryObligations: Object.freeze([]),
      recoveryUnresolved: false,
      candidateId: null,
      retryCount: 0,
      supersededBy: null,
    }),
  );
  const state = Object.freeze({
    contract: PROJECT_STATE_CONTRACT,
    taskExecutionSelections: selections,
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    repositoryRevision: input.repositoryRevision,
    generation: 1,
    ownerGeneration: input.ownerGeneration,
    decisionApplicationId: null,
    maximumConcurrency: input.maximumConcurrency,
    milestone: Object.freeze({
      id: input.milestoneId,
      acceptanceCriteria: milestoneAcceptanceCriteria,
      state: "planned" as const,
      criterionEvidenceIds: Object.freeze([]),
    }),
    objectives: Object.freeze(
      completeObjectiveDefinitions.map((definition) =>
        Object.freeze({
          definition,
          state: "planned" as const,
          criterionEvidenceIds: Object.freeze([]),
        }),
      ),
    ),
    tasks: Object.freeze(tasks),
  });
  return Object.freeze({
    status: "completed",
    reason: "coordinator_state_created",
    state,
    taskIds: Object.freeze(tasks.map((task) => task.definition.id)),
  });
}
