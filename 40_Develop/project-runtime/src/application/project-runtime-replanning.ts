import {
  applyProjectRuntimePartialReplan,
  requestProjectRuntimeHumanDecision,
  retryProjectRuntimeTask,
  type ProjectTaskDefinition,
} from "../core/project-runtime-state.ts";
import type { ProjectRuntimeStatePort } from "../ports/state-port.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../boundary/plain-data-snapshot.ts";

export const PROJECT_RUNTIME_REPLANNING_CONTRACT =
  "crdd-coordinator/project-runtime-replanning/v1" as const;

/**
 * ProjectRuntimeReplanDecisionが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeReplanDecisionに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeReplanDecisionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeReplanDecisionで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeReplanDecisionの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeReplanDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeReplanDecisionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeReplanDecision =
  | Readonly<{
      disposition: "partial_replan";
      failedTaskId: string;
      replacements: readonly ProjectTaskDefinition[];
    }>
  | Readonly<{
      disposition: "human_decision";
      objectiveId: string;
      reason: string;
    }>
  | Readonly<{ disposition: "maintain_plan"; reason: string }>;

/**
 * ProjectRuntimeReplanInputが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeReplanInputに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeReplanInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeReplanInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeReplanInputの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeReplanInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeReplanInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeReplanInput = Readonly<{
  projectId: string;
  milestoneId: string;
  queueId: string;
  maximumReplans: number;
}>;

/**
 * ProjectRuntimeReplanClassifierが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeReplanClassifierに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeReplanClassifierが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeReplanClassifierで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeReplanClassifierの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeReplanClassifierはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeReplanClassifierの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeReplanClassifier = (
  context: Readonly<{
    failedTaskIds: readonly string[];
    generation: number;
    repositoryRevision: string;
  }>,
) => unknown;

/**
 * validIdの処理を実行する。
 *
 * @responsibility validIdに対応する入力処理と結果生成を所有する。
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
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)
  );
}

/**
 * validTextの処理を実行する。
 *
 * @responsibility validTextに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidTextの入力契約を満たす。
 * @postcondition validTextの責務を完了した結果だけを返す。
 * @effect N/A: validTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTextは独自の失敗分岐を所有しない。
 * @invariant validTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validTextはProcess内の同一Subsystemで完結する。
 * @security N/A: validTextはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validTextは共有非同期状態を持たない同期処理である。
 */
function validText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    !value.includes("\0")
  );
}

/**
 * inspectStringsの処理を実行する。
 *
 * @responsibility inspectStringsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown、maximum: number、isEmptyAllowed: boolean
 * @returns inspectStringsの計算結果を返す。
 * @precondition 「value: unknown、maximum: number、isEmptyAllowed: boolean」がinspectStringsの入力契約を満たす。
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
  maximum: number,
  isEmptyAllowed: boolean,
) {
  const snapshot = snapshotPlainArray<string>(value, maximum);
  if (
    snapshot.status !== "ok" ||
    (!isEmptyAllowed && snapshot.value.length === 0) ||
    !snapshot.value.every((entry) => validText(entry)) ||
    new Set(snapshot.value).size !== snapshot.value.length
  )
    return null;
  return Object.freeze([...snapshot.value]);
}

/**
 * inspectTaskDefinitionの処理を実行する。
 *
 * @responsibility inspectTaskDefinitionに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns ProjectTaskDefinition | nullを返す。
 * @precondition 「value: unknown」がinspectTaskDefinitionの入力契約を満たす。
 * @postcondition inspectTaskDefinitionの責務を完了した結果だけを返す。
 * @effect N/A: inspectTaskDefinitionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectTaskDefinitionは独自の失敗分岐を所有しない。
 * @invariant inspectTaskDefinitionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectTaskDefinitionはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectTaskDefinitionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectTaskDefinitionは共有非同期状態を持たない同期処理である。
 */
function inspectTaskDefinition(value: unknown): ProjectTaskDefinition | null {
  const task = snapshotPlainRecord(
    value,
    new Set([
      "allowedPaths",
      "conflictKeys",
      "dependencies",
      "id",
      "objectiveId",
    ] as const),
  );
  if (!task || !validId(task.id) || !validId(task.objectiveId)) return null;
  const dependencies = inspectStrings(task.dependencies, 128, true);
  const allowedPaths = inspectStrings(task.allowedPaths, 128, false);
  const conflictKeys = inspectStrings(task.conflictKeys, 128, true);
  return dependencies && allowedPaths && conflictKeys
    ? Object.freeze({
        id: task.id,
        objectiveId: task.objectiveId,
        dependencies,
        allowedPaths,
        conflictKeys,
      })
    : null;
}

/**
 * inspectDecisionの処理を実行する。
 *
 * @responsibility inspectDecisionに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns ProjectRuntimeReplanDecision | nullを返す。
 * @precondition 「raw: unknown」がinspectDecisionの入力契約を満たす。
 * @postcondition inspectDecisionの責務を完了した結果だけを返す。
 * @effect N/A: inspectDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectDecisionは独自の失敗分岐を所有しない。
 * @invariant inspectDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectDecisionは共有非同期状態を持たない同期処理である。
 */
function inspectDecision(raw: unknown): ProjectRuntimeReplanDecision | null {
  const maintain = snapshotPlainRecord(
    raw,
    new Set(["disposition", "reason"] as const),
  );
  if (maintain?.disposition === "maintain_plan" && validText(maintain.reason))
    return Object.freeze({
      disposition: "maintain_plan",
      reason: maintain.reason,
    });
  const human = snapshotPlainRecord(
    raw,
    new Set(["disposition", "objectiveId", "reason"] as const),
  );
  if (
    human?.disposition === "human_decision" &&
    validId(human.objectiveId) &&
    validText(human.reason)
  )
    return Object.freeze({
      disposition: "human_decision",
      objectiveId: human.objectiveId,
      reason: human.reason,
    });
  const partial = snapshotPlainRecord(
    raw,
    new Set(["disposition", "failedTaskId", "replacements"] as const),
  );
  if (
    partial?.disposition !== "partial_replan" ||
    !validId(partial.failedTaskId)
  )
    return null;
  const replacements = snapshotPlainArray(partial.replacements, 128);
  if (replacements.status !== "ok" || replacements.value.length === 0)
    return null;
  const inspectedTasks = replacements.value.map(inspectTaskDefinition);
  return inspectedTasks.some((entry) => entry === null)
    ? null
    : Object.freeze({
        disposition: "partial_replan",
        failedTaskId: partial.failedTaskId,
        replacements: Object.freeze(inspectedTasks as ProjectTaskDefinition[]),
      });
}

/**
 * blockedの処理を実行する。
 *
 * @responsibility blockedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input reason: string、isRecovery
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string、isRecovery」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security N/A: blockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(reason: string, isRecovery = false) {
  return Object.freeze({
    contract: PROJECT_RUNTIME_REPLANNING_CONTRACT,
    status: "blocked" as const,
    reason,
    cleanupConfirmed: !isRecovery,
    manualRecoveryRequired: isRecovery,
    effectState: isRecovery ? ("unknown" as const) : ("no_effect" as const),
  });
}

/**
 * Resolve one durable replan boundary without widening Milestone scope or authority.
 *
 * @responsibility resolveProjectRuntimeReplanに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input statePort: ProjectRuntimeStatePort、input: ProjectRuntimeReplanInput、classify: ProjectRuntimeReplanClassifier
 * @returns resolveProjectRuntimeReplanの計算結果を返す。
 * @precondition 「statePort: ProjectRuntimeStatePort、input: ProjectRuntimeReplanInput、classify: ProjectRuntimeReplanClassifier」がresolveProjectRuntimeReplanの入力契約を満たす。
 * @postcondition resolveProjectRuntimeReplanの責務を完了した結果だけを返す。
 * @effect N/A: resolveProjectRuntimeReplanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure resolveProjectRuntimeReplanは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveProjectRuntimeReplanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveProjectRuntimeReplanはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveProjectRuntimeReplanはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveProjectRuntimeReplanは共有非同期状態を持たない同期処理である。
 */
export function resolveProjectRuntimeReplan(
  statePort: ProjectRuntimeStatePort,
  input: ProjectRuntimeReplanInput,
  classify: ProjectRuntimeReplanClassifier,
) {
  const stateRead = statePort.readState(input.projectId);
  const queueRead = statePort.readQueue(input.queueId);
  if (
    stateRead.status !== "completed" ||
    !stateRead.value ||
    queueRead.status !== "completed"
  )
    return blocked("project_runtime_replan_observation_unknown", true);
  let state = stateRead.value;
  const queue = queueRead.value;
  if (
    state.milestoneId !== input.milestoneId ||
    queue.projectId !== input.projectId ||
    queue.milestoneId !== input.milestoneId ||
    queue.state !== "replan_required" ||
    queue.ownerGeneration !== null
  )
    return blocked("project_runtime_replan_not_available");
  const failedTaskIds = state.tasks
    .filter((task) => task.state === "failed")
    .map((task) => task.definition.id);
  if (failedTaskIds.length === 0)
    return blocked("project_runtime_replan_failed_task_missing", true);
  let decision: ProjectRuntimeReplanDecision | null;
  try {
    decision = inspectDecision(
      classify(
        Object.freeze({
          failedTaskIds: Object.freeze(failedTaskIds),
          generation: state.generation,
          repositoryRevision: state.repositoryRevision,
        }),
      ),
    );
  } catch {
    decision = null;
  }
  if (!decision) return blocked("project_runtime_replan_decision_invalid");
  const transition =
    decision.disposition === "maintain_plan"
      ? retryProjectRuntimeTask(
          state,
          state.generation,
          failedTaskIds[0] ?? "",
          input.maximumReplans,
        )
      : decision.disposition === "partial_replan"
        ? applyProjectRuntimePartialReplan(state, state.generation, {
            failedTaskId: decision.failedTaskId,
            replacements: decision.replacements,
            maximumReplans: input.maximumReplans,
          })
        : requestProjectRuntimeHumanDecision(
            state,
            state.generation,
            decision.objectiveId,
          );
  if (transition.status !== "completed" || !transition.state)
    return blocked(transition.reason);
  const written = statePort.writeState(transition.state, state.generation);
  if (written.status !== "completed") return blocked(written.reason, true);
  state = written.value;
  const queueUpdate = statePort.updateQueue(input.queueId, queue.generation, {
    state:
      decision.disposition === "human_decision"
        ? "human_decision_required"
        : "queued",
    lease: null,
    resumeCondition:
      decision.disposition === "maintain_plan"
        ? "same_plan_retry"
        : decision.disposition === "partial_replan"
          ? "partial_replan_applied"
          : "human_decision",
    resultReference:
      decision.disposition === "maintain_plan"
        ? (failedTaskIds[0] ?? null)
        : decision.disposition === "partial_replan"
          ? decision.failedTaskId
          : decision.objectiveId,
  });
  if (queueUpdate.status !== "completed")
    return blocked(queueUpdate.reason, true);
  return Object.freeze({
    contract: PROJECT_RUNTIME_REPLANNING_CONTRACT,
    status:
      decision.disposition === "human_decision"
        ? ("blocked" as const)
        : ("completed" as const),
    reason:
      decision.disposition === "maintain_plan"
        ? "project_runtime_same_plan_retry_ready"
        : decision.disposition === "partial_replan"
          ? "project_runtime_partial_replan_ready"
          : "project_runtime_human_decision_required",
    disposition: decision.disposition,
    generation: state.generation,
    taskIds: transition.taskIds,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}
