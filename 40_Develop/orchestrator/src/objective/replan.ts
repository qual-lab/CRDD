/**
 * orchestrator-replanningに属する責務をまとめる。
 *
 * @responsibility OrchestratorReplanDecisionを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import {
  applyOrchestratorPartialReplan,
  requestOrchestratorHumanDecision,
  retryOrchestratorTask,
  type ProjectTaskDefinition,
} from "../state/transitions.ts";
import type { OrchestratorStatePort } from "../state/persistence.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../input/plain-data-snapshot.ts";

export const ORCHESTRATOR_REPLANNING_CONTRACT =
  "crdd-coordinator/orchestrator-replanning/v1" as const;

/**
 * orchestrator-replanningで使用するOrchestrator Replan Decisionの値契約を定義する。
 *
 * @responsibility Orchestrator Replan DecisionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorReplanDecisionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorReplanDecisionで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorReplanDecisionの宣言は外部境界を開かない。
 * @security N/A: OrchestratorReplanDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorReplanDecisionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorReplanDecision =
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
 * orchestrator-replanningで使用するOrchestrator Replan 入力の値契約を定義する。
 *
 * @responsibility Orchestrator Replan 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorReplanInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorReplanInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorReplanInputの宣言は外部境界を開かない。
 * @security N/A: OrchestratorReplanInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorReplanInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorReplanInput = Readonly<{
  projectId: string;
  milestoneId: string;
  queueId: string;
  maximumReplans: number;
}>;

/**
 * orchestrator-replanningで使用するOrchestrator Replan Classifierの値契約を定義する。
 *
 * @responsibility Orchestrator Replan ClassifierのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorReplanClassifierが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorReplanClassifierで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorReplanClassifierの宣言は外部境界を開かない。
 * @security N/A: OrchestratorReplanClassifierはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorReplanClassifierの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorReplanClassifier = (
  context: Readonly<{
    failedTaskIds: readonly string[];
    generation: number;
    repositoryRevision: string;
  }>,
) => unknown;

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
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)
  );
}

/**
 * Textが有効か判定する。
 *
 * @responsibility Textの有効条件、拒否条件、判定結果境界を所有する。
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
 * Stringsを観測する。
 *
 * @responsibility Stringsの観測対象、取得根拠、観測不能結果の境界を所有する。
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
 * Task Definitionを観測する。
 *
 * @responsibility Task Definitionの観測対象、取得根拠、観測不能結果の境界を所有する。
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
 * Decisionを観測する。
 *
 * @responsibility Decisionの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns OrchestratorReplanDecision | nullを返す。
 * @precondition 「raw: unknown」がinspectDecisionの入力契約を満たす。
 * @postcondition inspectDecisionの責務を完了した結果だけを返す。
 * @effect N/A: inspectDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectDecisionは独自の失敗分岐を所有しない。
 * @invariant inspectDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectDecisionは共有非同期状態を持たない同期処理である。
 */
function inspectDecision(raw: unknown): OrchestratorReplanDecision | null {
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
 * orchestrator-replanningを停止結果として構築する。
 *
 * @responsibility orchestrator-replanningの停止理由、未発行Effect、公開結果境界を所有する。
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
    contract: ORCHESTRATOR_REPLANNING_CONTRACT,
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
 * @responsibility Orchestrator Replanの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input statePort: OrchestratorStatePort、input: OrchestratorReplanInput、classify: OrchestratorReplanClassifier
 * @returns resolveOrchestratorReplanの計算結果を返す。
 * @precondition 「statePort: OrchestratorStatePort、input: OrchestratorReplanInput、classify: OrchestratorReplanClassifier」がresolveOrchestratorReplanの入力契約を満たす。
 * @postcondition resolveOrchestratorReplanの責務を完了した結果だけを返す。
 * @effect N/A: resolveOrchestratorReplanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure resolveOrchestratorReplanは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveOrchestratorReplanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveOrchestratorReplanはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveOrchestratorReplanはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveOrchestratorReplanは共有非同期状態を持たない同期処理である。
 */
export function resolveOrchestratorReplan(
  statePort: OrchestratorStatePort,
  input: OrchestratorReplanInput,
  classify: OrchestratorReplanClassifier,
) {
  const stateRead = statePort.readState(input.projectId);
  const queueRead = statePort.readQueue(input.queueId);
  if (
    stateRead.status !== "completed" ||
    !stateRead.value ||
    queueRead.status !== "completed"
  )
    return blocked("orchestrator_replan_observation_unknown", true);
  let state = stateRead.value;
  const queue = queueRead.value;
  if (
    state.milestoneId !== input.milestoneId ||
    queue.projectId !== input.projectId ||
    queue.milestoneId !== input.milestoneId ||
    queue.state !== "replan_required" ||
    queue.ownerGeneration !== null
  )
    return blocked("orchestrator_replan_not_available");
  const failedTaskIds = state.tasks
    .filter((task) => task.state === "failed")
    .map((task) => task.definition.id);
  if (failedTaskIds.length === 0)
    return blocked("orchestrator_replan_failed_task_missing", true);
  let decision: OrchestratorReplanDecision | null;
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
  if (!decision) return blocked("orchestrator_replan_decision_invalid");
  const transition =
    decision.disposition === "maintain_plan"
      ? retryOrchestratorTask(
          state,
          state.generation,
          failedTaskIds[0] ?? "",
          input.maximumReplans,
        )
      : decision.disposition === "partial_replan"
        ? applyOrchestratorPartialReplan(state, state.generation, {
            failedTaskId: decision.failedTaskId,
            replacements: decision.replacements,
            maximumReplans: input.maximumReplans,
          })
        : requestOrchestratorHumanDecision(
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
    contract: ORCHESTRATOR_REPLANNING_CONTRACT,
    status:
      decision.disposition === "human_decision"
        ? ("blocked" as const)
        : ("completed" as const),
    reason:
      decision.disposition === "maintain_plan"
        ? "orchestrator_same_plan_retry_ready"
        : decision.disposition === "partial_replan"
          ? "orchestrator_partial_replan_ready"
          : "orchestrator_human_decision_required",
    disposition: decision.disposition,
    generation: state.generation,
    taskIds: transition.taskIds,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}
