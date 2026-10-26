/**
 * Objective計画の閉検査を所有する。
 *
 * @responsibility 要求範囲に収まる受入条件・Objective・Task依存集合を検証し、実行結果や保存を扱わない。
 * @trace ARCH-000004
 */
import type { ProjectObjectiveDefinition } from "./types.ts";
import type { ProjectTaskDefinition } from "../task/types.ts";
import {
  inspectCoordinatorObjectiveRequest,
  type CoordinatorObjectiveRequest,
} from "./request.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../state/validation.ts";
import { repositoryPathWithin } from "../state/validation.ts";
import type { CoordinatorObjectivePlan } from "./types.ts";

export const COORDINATOR_OBJECTIVE_INTAKE_CONTRACT =
  "crdd-coordinator/orchestrator-objective-intake/v1" as const;

/**
 * Idが有効か判定する。
 *
 * @responsibility Idの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidIdの入力契約を満たす。
 * @postcondition validIdの責務を完了した結果だけを返す。
 * @effect N/A: validIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdは独自の失敗分岐を所有しない。
 * @invariant validIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdはProcess内の同一Subsystemで完結する。
 * @security N/A: validIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validIdは共有非同期状態を持たない同期処理である。
 */
function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * Textが有効か判定する。
 *
 * @responsibility Textの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、maximum: number
 * @returns value is stringを返す。
 * @precondition 「value: unknown、maximum: number」がvalidTextの入力契約を満たす。
 * @postcondition validTextの責務を完了した結果だけを返す。
 * @effect N/A: validTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTextは独自の失敗分岐を所有しない。
 * @invariant validTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validTextはProcess内の同一Subsystemで完結する。
 * @security N/A: validTextはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validTextは共有非同期状態を持たない同期処理である。
 */
function validText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

/**
 * Stringsを観測する。
 *
 * @responsibility Stringsの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、maximumItems: number、maximumText: number、shouldAllowEmpty
 * @returns readonly string[] | nullを返す。
 * @precondition 「value: unknown、maximumItems: number、maximumText: number、shouldAllowEmpty」がinspectStringsの入力契約を満たす。
 * @postcondition inspectStringsの責務を完了した結果だけを返す。
 * @effect N/A: inspectStringsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectStringsは独自の失敗分岐を所有しない。
 * @invariant inspectStringsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectStringsはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectStringsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectStringsは共有非同期状態を持たない同期処理である。
 */
function inspectStrings(
  value: unknown,
  maximumItems: number,
  maximumText: number,
  shouldAllowEmpty = false,
): readonly string[] | null {
  const snapshot = snapshotPlainArray(value, maximumItems);
  if (
    snapshot.status !== "ok" ||
    (!shouldAllowEmpty && snapshot.value.length === 0) ||
    !snapshot.value.every((entry) => validText(entry, maximumText)) ||
    new Set(
      snapshot.value.map((entry) =>
        (entry as string).replaceAll("\\", "/").toUpperCase(),
      ),
    ).size !== snapshot.value.length
  )
    return null;
  return Object.freeze([...(snapshot.value as readonly string[])]);
}

/**
 * path Withinを決定する。
 *
 * @responsibility path Withinの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input candidate: string、roots: readonly string[]
 * @returns pathWithinの計算結果を返す。
 * @precondition 「candidate: string、roots: readonly string[]」がpathWithinの入力契約を満たす。
 * @postcondition pathWithinの責務を完了した結果だけを返す。
 * @effect N/A: pathWithinは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: pathWithinは独自の失敗分岐を所有しない。
 * @invariant pathWithinは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: pathWithinはProcess内の同一Subsystemで完結する。
 * @security N/A: pathWithinはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: pathWithinは共有非同期状態を持たない同期処理である。
 */
function pathWithin(candidate: string, roots: readonly string[]) {
  return repositoryPathWithin(candidate, roots);
}

/**
 * Validate an untrusted Planner result as a bounded Coordinator plan.
 *
 * @responsibility Coordinator Objective Planの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown、request: CoordinatorObjectiveRequest
 * @returns CoordinatorObjectivePlan | nullを返す。
 * @precondition 「raw: unknown、request: CoordinatorObjectiveRequest」がinspectCoordinatorObjectivePlanの入力契約を満たす。
 * @postcondition inspectCoordinatorObjectivePlanの責務を完了した結果だけを返す。
 * @effect N/A: inspectCoordinatorObjectivePlanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectCoordinatorObjectivePlanは独自の失敗分岐を所有しない。
 * @invariant inspectCoordinatorObjectivePlanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectCoordinatorObjectivePlanはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectCoordinatorObjectivePlanはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectCoordinatorObjectivePlanは共有非同期状態を持たない同期処理である。
 */
export function inspectCoordinatorObjectivePlan(
  raw: unknown,
  request: CoordinatorObjectiveRequest,
): CoordinatorObjectivePlan | null {
  if (!inspectCoordinatorObjectiveRequest(request)) return null;
  const plan = snapshotPlainRecord(
    raw,
    new Set(["milestoneAcceptanceCriteria", "objectives", "tasks"] as const),
  );
  if (!plan) return null;
  const milestoneAcceptanceCriteria = inspectStrings(
    plan.milestoneAcceptanceCriteria,
    128,
    2_048,
  );
  const rawObjectives = snapshotPlainArray(plan.objectives, 128);
  const rawTasks = snapshotPlainArray(plan.tasks, 1024);
  if (
    !milestoneAcceptanceCriteria ||
    rawObjectives.status !== "ok" ||
    rawTasks.status !== "ok" ||
    rawObjectives.value.length === 0 ||
    rawTasks.value.length === 0
  )
    return null;
  const objectives: ProjectObjectiveDefinition[] = [];
  for (const rawObjective of rawObjectives.value) {
    const objective = snapshotPlainRecord(
      rawObjective,
      new Set(["id", "acceptanceCriteria"] as const),
    );
    if (!objective || !validId(objective.id)) return null;
    const acceptanceCriteria = inspectStrings(
      objective.acceptanceCriteria,
      128,
      2_048,
    );
    if (!acceptanceCriteria) return null;
    objectives.push(Object.freeze({ id: objective.id, acceptanceCriteria }));
  }
  const tasks: ProjectTaskDefinition[] = [];
  for (const rawTask of rawTasks.value) {
    const task = snapshotPlainRecord(
      rawTask,
      new Set([
        "id",
        "objectiveId",
        "dependencies",
        "allowedPaths",
        "conflictKeys",
      ] as const),
    );
    if (!task || !validId(task.id) || !validId(task.objectiveId)) return null;
    const dependencies = inspectStrings(task.dependencies, 128, 512, true);
    const allowedPaths = inspectStrings(task.allowedPaths, 128, 512);
    const conflictKeys = inspectStrings(task.conflictKeys, 128, 512, true);
    if (
      !dependencies ||
      !allowedPaths ||
      !conflictKeys ||
      !allowedPaths.every((candidate) =>
        pathWithin(candidate, request.allowedPaths),
      )
    )
      return null;
    tasks.push(
      Object.freeze({
        id: task.id,
        objectiveId: task.objectiveId,
        dependencies,
        allowedPaths,
        conflictKeys,
      }),
    );
  }
  return Object.freeze({
    milestoneAcceptanceCriteria,
    objectives: Object.freeze(objectives),
    tasks: Object.freeze(tasks),
  });
}
