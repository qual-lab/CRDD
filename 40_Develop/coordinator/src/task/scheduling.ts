/**
 * 容量・依存・変更対象の競合から実行可能なTaskを選択する。
 * @responsibility 容量・依存・変更対象の競合から実行可能なTaskを選択する。
 * @trace ARCH-000004
 */

import type { ProjectTaskRecord, CoordinatorState } from "../state/model.ts";

/**
 * For Capacityが有効な状態か判定する。
 *
 * @responsibility For Capacityの有効状態条件と判定結果境界を所有する。
 * @trace ARCH-000004
 * @input task: ProjectTaskRecord
 * @returns activeForCapacityの計算結果を返す。
 * @precondition 「task: ProjectTaskRecord」がactiveForCapacityの入力契約を満たす。
 * @postcondition activeForCapacityの責務を完了した結果だけを返す。
 * @effect N/A: activeForCapacityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: activeForCapacityは独自の失敗分岐を所有しない。
 * @invariant activeForCapacityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: activeForCapacityはProcess内の同一Subsystemで完結する。
 * @security N/A: activeForCapacityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: activeForCapacityは共有非同期状態を持たない同期処理である。
 */
function activeForCapacity(task: ProjectTaskRecord) {
  return (
    task.state === "starting" ||
    task.state === "running" ||
    task.state === "cleanup_pending" ||
    (task.state === "recovery_required" && !task.cleanupConfirmed)
  );
}

/**
 * reserves Conflictを決定する。
 *
 * @responsibility reserves Conflictの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input task: ProjectTaskRecord
 * @returns reservesConflictの計算結果を返す。
 * @precondition 「task: ProjectTaskRecord」がreservesConflictの入力契約を満たす。
 * @postcondition reservesConflictの責務を完了した結果だけを返す。
 * @effect N/A: reservesConflictは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: reservesConflictは独自の失敗分岐を所有しない。
 * @invariant reservesConflictは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reservesConflictはProcess内の同一Subsystemで完結する。
 * @security N/A: reservesConflictはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: reservesConflictは共有非同期状態を持たない同期処理である。
 */
function reservesConflict(task: ProjectTaskRecord) {
  return (
    activeForCapacity(task) ||
    (task.state === "recovery_required" &&
      (task.recoveryUnresolved || task.recoveryObligations.length > 0))
  );
}

/**
 * Conflict Pathsを固定Schemaへ正規化する。
 *
 * @responsibility Conflict Pathsの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000004
 * @input task: ProjectTaskRecord
 * @returns normalizedConflictPathsの計算結果を返す。
 * @precondition 「task: ProjectTaskRecord」がnormalizedConflictPathsの入力契約を満たす。
 * @postcondition normalizedConflictPathsの責務を完了した結果だけを返す。
 * @effect N/A: normalizedConflictPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizedConflictPathsは独自の失敗分岐を所有しない。
 * @invariant normalizedConflictPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizedConflictPathsはProcess内の同一Subsystemで完結する。
 * @security N/A: normalizedConflictPathsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: normalizedConflictPathsは共有非同期状態を持たない同期処理である。
 */
function normalizedConflictPaths(task: ProjectTaskRecord) {
  return task.definition.allowedPaths.map((value) =>
    value.replace(/\/+$/u, "").toUpperCase(),
  );
}

/**
 * conflictsを決定する。
 *
 * @responsibility conflictsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input left: ProjectTaskRecord、right: ProjectTaskRecord
 * @returns conflictsの計算結果を返す。
 * @precondition 「left: ProjectTaskRecord、right: ProjectTaskRecord」がconflictsの入力契約を満たす。
 * @postcondition conflictsの責務を完了した結果だけを返す。
 * @effect N/A: conflictsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: conflictsは独自の失敗分岐を所有しない。
 * @invariant conflictsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: conflictsはProcess内の同一Subsystemで完結する。
 * @security N/A: conflictsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: conflictsは共有非同期状態を持たない同期処理である。
 */
function conflicts(left: ProjectTaskRecord, right: ProjectTaskRecord) {
  const leftKeys = new Set(
    left.definition.conflictKeys.map((value) => value.toUpperCase()),
  );
  if (
    right.definition.conflictKeys.some((value) =>
      leftKeys.has(value.toUpperCase()),
    )
  )
    return true;
  return normalizedConflictPaths(left).some((leftPath) =>
    normalizedConflictPaths(right).some(
      (rightPath) =>
        leftPath === rightPath ||
        leftPath.startsWith(`${rightPath}/`) ||
        rightPath.startsWith(`${leftPath}/`),
    ),
  );
}

/**
 * Schedulable Project Tasksを選択する。
 *
 * @responsibility Schedulable Project Tasksの候補集合、選択理由、選択不能時の境界を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState
 * @returns readonly string[]を返す。
 * @precondition 「state: CoordinatorState」がselectSchedulableProjectTasksの入力契約を満たす。
 * @postcondition selectSchedulableProjectTasksの責務を完了した結果だけを返す。
 * @effect N/A: selectSchedulableProjectTasksは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectSchedulableProjectTasksは独自の失敗分岐を所有しない。
 * @invariant selectSchedulableProjectTasksは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectSchedulableProjectTasksはProcess内の同一Subsystemで完結する。
 * @security N/A: selectSchedulableProjectTasksはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: selectSchedulableProjectTasksは共有非同期状態を持たない同期処理である。
 */
export function selectSchedulableProjectTasks(
  state: CoordinatorState,
): readonly string[] {
  const available = Math.max(
    0,
    state.maximumConcurrency - state.tasks.filter(activeForCapacity).length,
  );
  if (available === 0) return Object.freeze([]);
  const selectedItems: ProjectTaskRecord[] = [];
  const reservedItems = state.tasks.filter(reservesConflict);
  for (const task of state.tasks) {
    if (selectedItems.length >= available) break;
    if (task.state !== "ready") continue;
    if (
      reservedItems.some((active) => conflicts(task, active)) ||
      selectedItems.some((candidate) => conflicts(task, candidate))
    )
      continue;
    selectedItems.push(task);
  }
  return Object.freeze(selectedItems.map((task) => task.definition.id));
}
