/**
 * Task・Queue・単独実行状態の完成した保存・読取り操作を提供する。
 * @responsibility 共通保存処理へ接続し、既存の排他・改訂検査・通知順序を維持する。
 * @trace ARCH-000008
 */

import type { Repository } from "../../../version-control/src/index.ts";
import {
  readRuntimeContent,
  saveRuntimeDefinition,
  withCoordinatorSnapshotOperation,
} from "../state/crud.ts";
import type {
  CoordinatorRootObservedInput,
  CoordinatorSnapshot,
  RuntimeAccess,
  StateVersion,
} from "../state/types.ts";
import { projectCoordinatorQueueProjectState } from "../state/validation.ts";
import type { StoreResult } from "../storage/lock.ts";
import { blocked, completed } from "../storage/lock.ts";
import { readCoordinatorSnapshot } from "../storage/store.ts";
import type { ProjectQueueEntry, ProjectTaskDefinition } from "./types.ts";
import {
  inspectCoordinatorQueueIntake,
  prepareCoordinatorQueueEntryCreation,
  prepareCoordinatorQueueLeaseReleaseSettlement,
  prepareCoordinatorQueueOperationUpdate,
  prepareCoordinatorQueueRecoverySettlement,
  prepareCoordinatorQueueSelection,
  prepareCoordinatorSingleTaskQueueCreation,
  prepareCoordinatorSingleTaskQueueUpdate,
  prepareCoordinatorUnstartedTaskQueueClosure,
  projectCoordinatorQueueEntry,
} from "./validation.ts";

/**
 * 発行時の受付世代と同ID相関を照合する。
 * @responsibility 退役した受付世代を拒否し、照合だけでは保存を変更しない。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。発行時の受付結合。
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
export function verifyCoordinatorQueueIntake(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<typeof inspectCoordinatorQueueIntake> extends [
    unknown,
    ...infer Rest,
  ]
    ? Rest
    : never
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof inspectCoordinatorQueueIntake>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    inspectCoordinatorQueueIntake(current, ...input),
  );
}

/**
 * 同じSnapshotのProject状態を照会する。
 * @responsibility 対象Projectの投影を返し、他Projectと技術区画を変更しない。
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
export function readCoordinatorQueueProject(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<typeof projectCoordinatorQueueProjectState> extends [
    unknown,
    ...infer Rest,
  ]
    ? Rest
    : never
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof projectCoordinatorQueueProjectState>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    projectCoordinatorQueueProjectState(current, ...input),
  );
}

/**
 * 発行時の受付世代にQueueを追加する。
 * @responsibility 同ID再入場は内容Hashと元世代を照合し、異内容を新規受付にしない。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。受付世代とQueue受付。
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
export function createCoordinatorQueueEntry(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<typeof prepareCoordinatorQueueEntryCreation> extends [
    unknown,
    ...infer Rest,
  ]
    ? Rest
    : never
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorQueueEntryCreation>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    prepareCoordinatorQueueEntryCreation(current, ...input),
  );
}

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
export function readCoordinatorQueueEntry(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<typeof projectCoordinatorQueueEntry> extends [
    unknown,
    ...infer Rest,
  ]
    ? Rest
    : never
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof projectCoordinatorQueueEntry>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    projectCoordinatorQueueEntry(current, ...input),
  );
}

/**
 * 同じ回復参照の終了をQueueへ反映する。
 * @responsibility 元Queue世代とexact回復参照が一致する場合だけ回復待ちを整理する。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Queue ID、期待世代と回復ID。
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
export function settleCoordinatorQueueRecovery(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<
    typeof prepareCoordinatorQueueRecoverySettlement
  > extends [unknown, ...infer Rest]
    ? Rest
    : never
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorQueueRecoverySettlement>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    prepareCoordinatorQueueRecoverySettlement(current, ...input),
  );
}

/**
 * 単発Taskの未開始受付をQueueへ保存する。
 * @responsibility 受付世代・単発Taskの初期段階・同ID再入場を照合する。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。受付世代と単発Queue。
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
export function createCoordinatorSingleTaskQueue(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<
    typeof prepareCoordinatorSingleTaskQueueCreation
  > extends [unknown, ...infer Rest]
    ? Rest
    : never
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorSingleTaskQueueCreation>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    prepareCoordinatorSingleTaskQueueCreation(current, ...input),
  );
}

/**
 * 取得を始めていない単発Task受付を終了する。
 * @responsibility 取得意図・Owner・期待世代を照合し、実行や回収成功を合成しない。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Queue ID、期待世代、固定理由と用途固定時計。
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
export function closeCoordinatorUnstartedTaskQueue(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<
    typeof prepareCoordinatorUnstartedTaskQueueClosure
  > extends [unknown, ...infer Rest]
    ? Rest
    : never
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorUnstartedTaskQueueClosure>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    prepareCoordinatorUnstartedTaskQueueClosure(current, ...input),
  );
}

/**
 * Lease解放済みのQueueを確定する。
 * @responsibility fresh QueueのOwner世代を照合した位置でだけ同じRootの資源不存在を確認する。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Queue ID、期待世代、Owner世代と資源不存在観測。
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
export function settleCoordinatorQueueLeaseRelease(
  workingDirectory: Repository,
  binding: string,
  ...input: CoordinatorRootObservedInput<
    Parameters<typeof prepareCoordinatorQueueLeaseReleaseSettlement>
  >
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorQueueLeaseReleaseSettlement>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current, owner) =>
    prepareCoordinatorQueueLeaseReleaseSettlement(
      current,
      input[0],
      input[1],
      input[2],
      {
        resourcesAbsent: (projectId) =>
          input[3].resourcesAbsent(owner.repositoryRoot, projectId),
      },
    ),
  );
}

/**
 * 実Leaseを観測してQueueの開始・進行・終了を保存する。
 * @responsibility 元のgetter短絡順と同じLeaseの六field・生存観測を保つ。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Queue ID、期待世代、次値の固定accessorと実Leaseの有限観測。
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
export function updateCoordinatorQueueEntry(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<typeof prepareCoordinatorQueueOperationUpdate> extends [
    unknown,
    string,
    string,
    ...infer Rest,
  ]
    ? Rest
    : never
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorQueueOperationUpdate>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current, owner) =>
    prepareCoordinatorQueueOperationUpdate(
      current,
      owner.repositoryRoot,
      binding,
      ...input,
    ),
  );
}

/**
 * 同じ実Leaseで単発Taskの進行と結果を保存する。
 * @responsibility 元ID・期待世代と同じLeaseを照合し、成功末尾の時計二回だけを使う。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Queue ID、期待世代、単発Task記録と実Leaseの有限観測。
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
export function updateCoordinatorSingleTaskQueue(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<typeof prepareCoordinatorSingleTaskQueueUpdate> extends [
    unknown,
    string,
    string,
    ...infer Rest,
  ]
    ? Rest
    : never
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorSingleTaskQueueUpdate>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current, owner) =>
    prepareCoordinatorSingleTaskQueueUpdate(
      current,
      owner.repositoryRoot,
      binding,
      ...input,
    ),
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
export function selectCoordinatorQueueEntry(
  workingDirectory: Repository,
  binding: string,
  select: (
    entries: readonly ProjectQueueEntry[],
  ) => Parameters<typeof prepareCoordinatorQueueSelection>[1],
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorQueueSelection>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    prepareCoordinatorQueueSelection(current, select(current.queueEntries)),
  );
}

/**
 * 単発Task受付に必要な保存区画だけを読む。
 * @responsibility 全Snapshotや保存Ownerを外へ渡さず用途固定の観測を返す。
 * @trace ARCH-000008
 * @input workingDirectory、binding: 現在Repositoryと期待結合。
 * @returns 選択区画、明示不存在又は元の停止結果。
 * @precondition Hostが同じRepositoryの操作認可を確認する。
 * @postcondition I/O・改訂・解放確認の既存条件を保つ。
 * @effect 単一Readerと短期排他の読取りだけ。
 * @failure 不正Root・不一致・観測不能・解放不明を元の理由で拒否する。
 * @invariant 状態変更・実行・回復Authorityを生成しない。
 * @boundary Domain保存と用途別Consumer。
 * @security 任意投影callbackを受けず、技術区画を一括返却しない。
 * @concurrency 元の短期排他を一回取得・解放する。
 */
export function readCoordinatorTaskIntakeState(
  workingDirectory: Repository,
  binding: string,
): StoreResult<Pick<
  CoordinatorSnapshot,
  "queueEntries" | "leaseIntents" | "intakeEpoch"
> | null> {
  if (typeof workingDirectory !== "object" || workingDirectory === null)
    return blocked("orchestrator_repository_root_invalid");
  const result = readCoordinatorSnapshot(workingDirectory, binding);
  if (result.status !== "completed") return result;
  return completed(
    result.reason,
    result.value === null
      ? null
      : {
          queueEntries: result.value.queueEntries,
          leaseIntents: result.value.leaseIntents,
          intakeEpoch: result.value.intakeEpoch,
        },
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
  access: RuntimeAccess,
  request: Readonly<
    { projectId: string; milestoneId: string; expected: StateVersion } & {
      definition: ProjectTaskDefinition;
    }
  >,
) {
  return saveRuntimeDefinition(access, "task.create", request);
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
  access: RuntimeAccess,
  request: Readonly<
    { projectId: string; milestoneId: string; expected: StateVersion } & {
      taskId: string;
      definition: ProjectTaskDefinition;
      expectedDefinitionHash: string;
    }
  >,
) {
  return saveRuntimeDefinition(access, "task.update", request);
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
  access: RuntimeAccess,
  request: Readonly<
    { projectId: string; milestoneId: string; expected: StateVersion } & {
      taskId: string;
      expectedDefinitionHash: string;
    }
  >,
) {
  return saveRuntimeDefinition(access, "task.delete", request);
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
  access: RuntimeAccess,
  request: Readonly<{ projectId: string; milestoneId: string }>,
) {
  return readRuntimeContent(access, "tasks", request);
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
  access: RuntimeAccess,
  request: Readonly<{ projectId: string; milestoneId: string }>,
) {
  return readRuntimeContent(access, "queue", request);
}
