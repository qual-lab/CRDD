/**
 * project-runtime-objective-intakeに属する責務をまとめる。
 *
 * @responsibility ProjectRuntimeObjectivePlanを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import type {
  ProjectObjectiveDefinition,
  ProjectTaskDefinition,
  ProjectTaskRecoveryObligation,
  ProjectRuntimeState,
  projectProjectRuntimeState,
} from "../core/project-runtime-state.ts";
import type { ProjectRuntimeClockIdentityPort } from "../ports/clock-identity-port.ts";
import type { ProjectRuntimeTaskExecution } from "./project-runtime-execution.ts";
import {
  inspectProjectRuntimeObjectiveRequest,
  type ProjectRuntimeObjectiveRequest,
} from "../public-contract/objective-request.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../boundary/plain-data-snapshot.ts";
import { repositoryPathWithin } from "../boundary/repository-relative-path.ts";

export const PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT =
  "crdd-coordinator/project-runtime-objective-intake/v1" as const;

/**
 * project-runtime-objective-intakeで使用するProject Runtime Objective Planの値契約を定義する。
 *
 * @responsibility Project Runtime Objective PlanのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeObjectivePlanが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeObjectivePlanで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeObjectivePlanの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeObjectivePlanはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeObjectivePlanの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeObjectivePlan = Readonly<{
  milestoneAcceptanceCriteria: readonly string[];
  objectives: readonly ProjectObjectiveDefinition[];
  tasks: readonly ProjectTaskDefinition[];
}>;

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
 * Validate an untrusted Planner result as a bounded Project Runtime plan.
 *
 * @responsibility Project Runtime Objective Planの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown、request: ProjectRuntimeObjectiveRequest
 * @returns ProjectRuntimeObjectivePlan | nullを返す。
 * @precondition 「raw: unknown、request: ProjectRuntimeObjectiveRequest」がinspectProjectRuntimeObjectivePlanの入力契約を満たす。
 * @postcondition inspectProjectRuntimeObjectivePlanの責務を完了した結果だけを返す。
 * @effect N/A: inspectProjectRuntimeObjectivePlanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectProjectRuntimeObjectivePlanは独自の失敗分岐を所有しない。
 * @invariant inspectProjectRuntimeObjectivePlanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectProjectRuntimeObjectivePlanはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectProjectRuntimeObjectivePlanはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectProjectRuntimeObjectivePlanは共有非同期状態を持たない同期処理である。
 */
export function inspectProjectRuntimeObjectivePlan(
  raw: unknown,
  request: ProjectRuntimeObjectiveRequest,
): ProjectRuntimeObjectivePlan | null {
  if (!inspectProjectRuntimeObjectiveRequest(request)) return null;
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

/**
 * Bind Host-prepared Task payloads to the exact current Task scope. The Host
 *
 * @responsibility Project Runtime Task Execution Setの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown、state: ProjectRuntimeState、clockIdentity: ProjectRuntimeClockIdentityPort
 * @returns readonly ProjectRuntimeTaskExecution[] | nullを返す。
 * @precondition 「raw: unknown、state: ProjectRuntimeState、clockIdentity: ProjectRuntimeClockIdentityPort」がcreateProjectRuntimeTaskExecutionSetの入力契約を満たす。
 * @postcondition createProjectRuntimeTaskExecutionSetの責務を完了した結果だけを返す。
 * @effect N/A: createProjectRuntimeTaskExecutionSetは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createProjectRuntimeTaskExecutionSetは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createProjectRuntimeTaskExecutionSetは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createProjectRuntimeTaskExecutionSetはProcess内の同一Subsystemで完結する。
 * @security N/A: createProjectRuntimeTaskExecutionSetはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createProjectRuntimeTaskExecutionSetは共有非同期状態を持たない同期処理である。
 */
export function createProjectRuntimeTaskExecutionSet(
  raw: unknown,
  state: ProjectRuntimeState,
  clockIdentity: ProjectRuntimeClockIdentityPort,
): readonly ProjectRuntimeTaskExecution[] | null {
  const activeTasks = state.tasks.filter((task) => task.state !== "superseded");
  const rawExecutions = snapshotPlainArray(raw, activeTasks.length);
  if (
    rawExecutions.status !== "ok" ||
    rawExecutions.value.length !== activeTasks.length
  )
    return null;
  const executions: ProjectRuntimeTaskExecution[] = [];
  for (const rawExecution of rawExecutions.value) {
    const execution = snapshotPlainRecord(
      rawExecution,
      new Set(["taskId", "taskRequest", "repositoryRoot"] as const),
    );
    const task = activeTasks.find(
      (candidate) => candidate.definition.id === execution?.taskId,
    );
    if (!execution || !task) return null;
    let authorityBindingId: string;
    try {
      authorityBindingId = clockIdentity.createStableId("authority", [
        state.projectId,
        state.milestoneId,
        state.repositoryRevision,
        task.definition.objectiveId,
        task.definition.id,
        String(task.retryCount),
      ]);
    } catch {
      return null;
    }
    if (!validId(authorityBindingId)) return null;
    executions.push(
      Object.freeze({
        taskId: task.definition.id,
        authorityBindingId,
        taskRequest: execution.taskRequest,
        repositoryRoot: execution.repositoryRoot,
      }),
    );
  }
  return new Set(executions.map((entry) => entry.taskId)).size ===
    activeTasks.length
    ? Object.freeze(executions)
    : null;
}

/**
 * Canonical public result envelope for one Project Runtime objective request.
 *
 * @responsibility Project Runtime Objective 結果の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input request: ProjectRuntimeObjectiveRequest、options: Readonly<{ status: "completed" | "blocked" | "cancelled"; reason: string; queueId?: string | null; projection?: ReturnType<typeof projectProjectRuntimeState> | null; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; processRestartRequired?: boolean; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryObligation["kind"]; recoveryId: string; }>[]; effectState?: "no_effect" | "settled" | "unknown"; }>
 * @returns createProjectRuntimeObjectiveResultの計算結果を返す。
 * @precondition 「request: ProjectRuntimeObjectiveRequest、options: Readonly<{ status: "completed" | "blocked" | "cancelled"; reason: string; queueId?: string | null; projection?: ReturnType<typeof projectProjectRuntimeState> | null; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; processRestartRequired?: boolean; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryObligation["kind"]; recoveryId: string; }>[]; effectState?: "no_effect" | "settled" | "unknown"; }>」がcreateProjectRuntimeObjectiveResultの入力契約を満たす。
 * @postcondition createProjectRuntimeObjectiveResultの責務を完了した結果だけを返す。
 * @effect N/A: createProjectRuntimeObjectiveResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createProjectRuntimeObjectiveResultは独自の失敗分岐を所有しない。
 * @invariant createProjectRuntimeObjectiveResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createProjectRuntimeObjectiveResultはProcess内の同一Subsystemで完結する。
 * @security N/A: createProjectRuntimeObjectiveResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createProjectRuntimeObjectiveResultは共有非同期状態を持たない同期処理である。
 */
export function createProjectRuntimeObjectiveResult(
  request: ProjectRuntimeObjectiveRequest,
  options: Readonly<{
    status: "completed" | "blocked" | "cancelled";
    reason: string;
    queueId?: string | null;
    projection?: ReturnType<typeof projectProjectRuntimeState> | null;
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    processRestartRequired?: boolean;
    recoveryIds?: readonly string[];
    recoveryObligations?: readonly Readonly<{
      kind: ProjectTaskRecoveryObligation["kind"];
      recoveryId: string;
    }>[];
    effectState?: "no_effect" | "settled" | "unknown";
  }>,
) {
  return Object.freeze({
    contract: PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT,
    status: options.status,
    reason: options.reason,
    requestId: request.requestId,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    queueId: options.queueId ?? null,
    projection: options.projection ?? null,
    cleanupConfirmed: options.cleanupConfirmed ?? true,
    manualRecoveryRequired: options.manualRecoveryRequired ?? false,
    processRestartRequired: options.processRestartRequired ?? false,
    recoveryIds: Object.freeze([...(options.recoveryIds ?? [])]),
    recoveryObligations: Object.freeze([
      ...(options.recoveryObligations ?? []),
    ]),
    effectState: options.effectState ?? ("no_effect" as const),
  });
}
