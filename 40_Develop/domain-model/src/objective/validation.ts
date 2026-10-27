/**
 * 呼出し元が定義した実行計画の値検査。
 * @packageDocumentation
 * @responsibility 有限の定義集合・依存関係・対象範囲を不変データへ固定する。
 * @trace ARCH-000004
 * @boundary 文書計画の作成、認可、実行、保存は所有しない。
 */
import type {
  CoordinatorObjectivePlan,
  ProjectObjectiveDefinition,
  ProjectObjectiveRecord,
  ProjectMilestoneRecord,
} from "./types.ts";
import type { RuntimeProjectDefinition } from "../state/types.ts";
import type { ProjectTaskDefinition, CallerTaskInput } from "../task/types.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../plain-data/snapshot.ts";
import { repositoryPathWithin } from "../repository/path.ts";

/** 計画検査の外側の実行範囲。認可済みであることは表さない。 */
export type ExecutionPlanScope = Readonly<{ allowedPaths: readonly string[] }>;

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
 * @input raw: unknown、request: ExecutionPlanScope
 * @returns CoordinatorObjectivePlan | nullを返す。
 * @precondition 「raw: unknown、request: ExecutionPlanScope」がinspectExecutionPlanの入力契約を満たす。
 * @postcondition inspectExecutionPlanの責務を完了した結果だけを返す。
 * @effect N/A: inspectExecutionPlanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectExecutionPlanは独自の失敗分岐を所有しない。
 * @invariant inspectExecutionPlanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectExecutionPlanはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectExecutionPlanはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectExecutionPlanは共有非同期状態を持たない同期処理である。
 */
export function inspectExecutionPlan(
  raw: unknown,
  request: ExecutionPlanScope,
): CoordinatorObjectivePlan | null {
  const scope = snapshotPlainRecord(request, new Set(["allowedPaths"]));
  if (!scope) return null;
  const allowedRoots = snapshotPlainArray(scope.allowedPaths, 128);
  if (
    allowedRoots.status !== "ok" ||
    allowedRoots.value.length === 0 ||
    !allowedRoots.value.every(
      (root) => typeof root === "string" && repositoryPathWithin(root, [root]),
    )
  )
    return null;
  const plan = inspectExecutionPlanDefinition(raw);
  return plan?.tasks.every((task) =>
    task.allowedPaths.every((candidate) =>
      pathWithin(candidate, allowedRoots.value as readonly string[]),
    ),
  )
    ? plan
    : null;
}

/**
 * 実行設定や認可範囲を要求せず、計画定義そのものを検査する。
 * @responsibility 既存の閉形式・件数・ID・Path文法・DAG条件を共有する。
 * @trace ARCH-000004
 * @input raw: 未信頼の計画定義。
 * @returns 不変の完全定義、またはnull。
 * @precondition N/A: 任意値を拒否可能。
 * @postcondition AI選定・Owner・実行状態を補完しない。
 * @effect N/A: メモリ内の検査だけ。
 * @failure 欠測・不正形状・循環・不正文法はnull。
 * @invariant 定義の有効性は実行範囲への認可ではない。
 * @boundary Core定義と管理実行の範囲検査を分離する。
 * @security 実行利用側はinspectExecutionPlanで外側範囲も検査する。
 * @concurrency N/A: 共有状態なし。
 */
export function inspectExecutionPlanDefinition(
  raw: unknown,
): CoordinatorObjectivePlan | null {
  const plan = inspectRuntimePlanDefinition(raw);
  return plan &&
    plan.objectives.length > 0 &&
    plan.tasks.length > 0 &&
    plan.objectives.every((objective) =>
      plan.tasks.some((task) => task.objectiveId === objective.id),
    )
    ? plan
    : null;
}

/**
 * 一般CRUDの合法な中間保存を含む定義集合を検査する。
 * @responsibility 空集合・未割当Objectiveを実行開始と区別し、参照・DAG・文法を固定する。
 * @trace ARCH-000004
 * @input raw: 未信頼の定義集合。
 * @returns 不変定義、またはnull。
 * @precondition N/A: 任意値を拒否可能。
 * @postcondition 偽Task・Selection・Ownerを生成しない。
 * @effect N/A: メモリ内の値検査。
 * @failure 重複・不正参照・循環・不正文法はnull。
 * @invariant Coreの合法性を管理実行の完全性や認可へ読み替えない。
 * @boundary Core定義と実行受付を明示的に区別する。
 * @security 実行利用側は必ずinspectExecutionPlanを使用する。
 * @concurrency N/A: 共有状態なし。
 */
export function inspectRuntimePlanDefinition(
  raw: unknown,
): CoordinatorObjectivePlan | null {
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
    rawTasks.status !== "ok"
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
        repositoryPathWithin(candidate, [candidate]),
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
  const taskIds = new Set(tasks.map((task) => task.id));
  const objectiveIds = new Set(objectives.map((objective) => objective.id));
  if (
    taskIds.size !== tasks.length ||
    objectiveIds.size !== objectives.length ||
    tasks.some(
      (task) =>
        !objectiveIds.has(task.objectiveId) ||
        task.dependencies.some((id) => !taskIds.has(id)),
    )
  )
    return null;
  const dependencies = new Map(
    tasks.map((task) => [task.id, task.dependencies]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    for (const dependency of dependencies.get(id) ?? []) {
      if (!visit(dependency)) return false;
    }
    visiting.delete(id);
    visited.add(id);
    return true;
  };
  if (!tasks.every((task) => visit(task.id))) return null;
  return Object.freeze({
    milestoneAcceptanceCriteria,
    objectives: Object.freeze(objectives),
    tasks: Object.freeze(tasks),
  });
}

/**
 * 実行資格を含まないProject定義の閉じた保存値を検査する。
 * @responsibility 対象ID・改訂・判断値とCore計画を一つの不変値へ固定する。
 * @trace ARCH-000004
 * @input raw: 新形式のProject定義候補。
 * @returns 完全に検査したCore値、又はnull。
 * @precondition N/A: 未信頼値を拒否できる。
 * @postcondition Task定義を一度だけ保持し、SelectionやOwnerを補完しない。
 * @effect N/A: 局所値の検査のみ。
 * @failure 不正Schema・ID・改訂・記録値・依存参照はnull。
 * @invariant 記録の状態値は実行許可や新たな完了報告ではない。
 * @boundary Core定義と管理実行記録。
 * @security Getter・Proxyを評価しない。保存・認可を発行しない。
 * @concurrency N/A: 共有状態なし。
 */
export function inspectRuntimeProjectDefinition(
  raw: unknown,
): RuntimeProjectDefinition | null {
  const project = snapshotPlainRecord(
    raw,
    new Set([
      "contract",
      "projectId",
      "milestoneId",
      "repositoryRevision",
      "generation",
      "decisionApplicationId",
      "milestone",
      "objectives",
      "tasks",
    ]),
  );
  if (
    project?.contract !== "crdd-domain/project-state/v1" ||
    !validId(project.projectId) ||
    !validId(project.milestoneId) ||
    typeof project.repositoryRevision !== "string" ||
    !/^[a-f0-9]{40,64}$/u.test(project.repositoryRevision) ||
    !Number.isSafeInteger(project.generation) ||
    Number(project.generation) < 1 ||
    (project.decisionApplicationId !== null &&
      !validId(project.decisionApplicationId))
  )
    return null;
  const milestone = snapshotPlainRecord(
    project.milestone,
    new Set(["id", "acceptanceCriteria", "state", "criterionEvidenceIds"]),
  );
  const objectives = snapshotPlainArray(project.objectives, 128);
  if (
    !milestone ||
    milestone.id !== project.milestoneId ||
    typeof milestone.state !== "string" ||
    ![
      "planned",
      "executing",
      "integrating",
      "human_decision_required",
      "recovery_required",
      "accepted",
      "returned",
      "cancelled",
    ].includes(milestone.state) ||
    objectives.status !== "ok"
  )
    return null;
  const milestoneEvidence = inspectStrings(
    milestone.criterionEvidenceIds,
    128,
    512,
    true,
  );
  if (!milestoneEvidence) return null;
  const records: ProjectObjectiveRecord[] = [];
  for (const rawObjective of objectives.value) {
    const objective = snapshotPlainRecord(
      rawObjective,
      new Set(["definition", "state", "criterionEvidenceIds"]),
    );
    if (
      !objective ||
      typeof objective.state !== "string" ||
      ![
        "planned",
        "executing",
        "integration_pending",
        "accepted",
        "returned",
        "blocked",
        "cancelled",
      ].includes(objective.state)
    )
      return null;
    const evidence = inspectStrings(
      objective.criterionEvidenceIds,
      128,
      512,
      true,
    );
    if (!evidence) return null;
    records.push({
      definition: objective.definition as ProjectObjectiveDefinition,
      state: objective.state as ProjectObjectiveRecord["state"],
      criterionEvidenceIds: evidence,
    });
  }
  const definition = inspectRuntimePlanDefinition({
    milestoneAcceptanceCriteria: milestone.acceptanceCriteria,
    objectives: records.map((record) => record.definition),
    tasks: project.tasks,
  });
  if (!definition) return null;
  return Object.freeze({
    contract: "crdd-domain/project-state/v1",
    projectId: project.projectId,
    milestoneId: project.milestoneId,
    repositoryRevision: project.repositoryRevision,
    generation: Number(project.generation),
    decisionApplicationId: project.decisionApplicationId as string | null,
    milestone: Object.freeze({
      id: project.milestoneId,
      acceptanceCriteria: definition.milestoneAcceptanceCriteria,
      state: milestone.state as ProjectMilestoneRecord["state"],
      criterionEvidenceIds: milestoneEvidence,
    }),
    objectives: Object.freeze(
      records.map((record, index) =>
        Object.freeze({
          ...record,
          definition: definition.objectives[
            index
          ] as ProjectObjectiveDefinition,
        }),
      ),
    ),
    tasks: definition.tasks,
  });
}

/**
 * Task定義と実行入力を一対一で固定する。
 * @responsibility 不足・余剰・重複・範囲外を拒否し、指示を自動生成しない。
 * @trace ARCH-000004
 * @input 検査済み計画、未信頼入力、全体の読取り範囲。
 * @returns 同じ宣言順の不変入力、又はnull。
 * @effect 外部Effectなし。
 * @security Getter／Proxyを実行せず、認可や再開権限を発行しない。
 */
export function inspectCallerTaskInputs(
  plan: CoordinatorObjectivePlan,
  candidate: unknown,
  readPaths: readonly string[],
): readonly CallerTaskInput[] | null {
  const entries = snapshotPlainArray(candidate, 1024);
  const roots = snapshotPlainArray(readPaths, 128);
  if (
    entries.status !== "ok" ||
    roots.status !== "ok" ||
    entries.value.length !== plan.tasks.length ||
    roots.value.length === 0 ||
    !roots.value.every(
      (root) => typeof root === "string" && repositoryPathWithin(root, [root]),
    )
  )
    return null;
  const ids = new Set(plan.tasks.map((task) => task.id));
  const seen = new Set<string>();
  const inputs: CallerTaskInput[] = [];
  for (const entry of entries.value) {
    const input = snapshotPlainRecord(
      entry,
      new Set(["taskId", "objective", "acceptanceCriteria", "readPaths"]),
    );
    if (
      !input ||
      !validId(input.taskId) ||
      !ids.has(input.taskId) ||
      seen.has(input.taskId) ||
      !validText(input.objective, 16_384)
    )
      return null;
    const acceptanceCriteria = inspectStrings(
      input.acceptanceCriteria,
      128,
      2_048,
    );
    const paths = inspectStrings(input.readPaths, 128, 512);
    if (
      !acceptanceCriteria ||
      !paths?.every((value) =>
        repositoryPathWithin(value, roots.value as readonly string[]),
      )
    )
      return null;
    seen.add(input.taskId);
    inputs.push(
      Object.freeze({
        taskId: input.taskId,
        objective: input.objective,
        acceptanceCriteria,
        readPaths: paths,
      }),
    );
  }
  return Object.freeze(inputs);
}
