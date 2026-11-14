/**
 * Task・Queue・単独実行状態の完成した保存・読取り操作を提供する。
 * @responsibility 共通保存処理へ接続し、既存の排他・改訂検査・通知順序を維持する。
 * @trace ARCH-000008
 */
import { leaseIdentity } from "../state/operations.ts";
import type { Repository } from "../../../version-control/src/index.ts";
import {
  readExecutionContent,
  saveExecutionDefinition,
  withSnapshotOperation,
} from "../state/crud.ts";
import type { ExecutionModelAccess, StateVersion } from "../state/types.ts";

import {
  snapshotStateRecord,
  snapshotStateArray,
} from "../state/operations.ts";
import type { StoreResult } from "../storage/lock.ts";
import { blocked } from "../storage/lock.ts";
import type {
  ProjectQueueEntry,
  ProjectTaskDefinition,
  QueueCreateRequest,
  QueueUpdateRequest,
} from "./types.ts";
import {
  prepareQueueEntryCreation,
  prepareQueueLeaseReleaseSettlement,
  prepareQueueOperationUpdate,
  prepareQueueRecoverySettlement,
  prepareQueueSelection,
  prepareSingleTaskQueueCreation,
  prepareSingleTaskQueueUpdate,
  prepareUnstartedTaskQueueClosure,
  projectQueueEntry,
} from "./operations.ts";

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
