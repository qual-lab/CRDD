/**
 * 実行状態の共有値・純粋検査を所有する。
 * @packageDocumentation
 * @responsibility 既存の保存形状・相関・三値を保持し、実行・資源観測・Authorityを発行しない。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary 保存値の意味だけ。OS・Provider・Dockerの操作は所有しない。
 */

import type { ProjectResultAcceptance } from "./types.ts";
import { snapshotPlainRecord } from "../state/validation.ts";
import type { CoordinatorState } from "../state/types.ts";
import { plainObject } from "../state/validation.ts";
import { exactKeys } from "../state/validation.ts";
import { inspectTaskExecutionSelections } from "../ai-selection/validation.ts";
import { validId } from "../state/validation.ts";
import { REVISION } from "../state/validation.ts";
import { nullableId } from "../state/validation.ts";
import { stringArray } from "../state/validation.ts";
import { nullableCandidateId } from "../state/validation.ts";
import type { ProjectQueueEntry } from "./types.ts";
import { singleTaskQueueIsConsistent } from "../state/validation.ts";
import type { SingleTaskRecord } from "./types.ts";
import { HASH } from "../state/validation.ts";
import type { ProjectQueueState } from "./types.ts";
import { nullableResultReference } from "../state/validation.ts";
import type { ProjectTaskRecoveryObligation } from "./types.ts";
import { nullableRecoveryId } from "../state/validation.ts";
import { inspectExecutionSelection } from "../ai-selection/validation.ts";
import { snapshotPlainArray } from "../state/validation.ts";

/**
 * 新しい結果受理本文の閉じた形式を検査する。
 * @responsibility 欠落・追加項目・旧形式と不正な識別子、Hash、世代を拒否する。
 * @trace ARCH-000004
 * @input value: 未検証の受理本文。
 * @returns 検査済み固定本文、またはnull。
 * @precondition N/A: 任意の入力を拒否可能な境界として扱う。
 * @postcondition 初回受理世代や入力の値を補完・更新しない。
 * @effect N/A: 局所値の検査だけ。
 * @failure 不正本文、getter、Proxy、欠落、旧項目、空値はnull。
 * @invariant 形式成立を保存・受理・cleanup成立へ昇格しない。
 * @boundary 上位の保存本文とその利用側。
 * @security 外部Authorityを発行せず入力の関数を呼ばない。
 * @concurrency N/A: 共有状態を持たない同期処理。
 */
export function decodeProjectResultAcceptance(
  value: unknown,
): ProjectResultAcceptance | null {
  const acceptance = snapshotPlainRecord(
    value,
    new Set([
      "repositoryBindingId",
      "projectId",
      "milestoneId",
      "taskId",
      "attemptId",
      "operationId",
      "recoveryId",
      "settlementGeneration",
      "repositoryBinding",
      "resultId",
      "consumer",
    ]),
  );
  if (
    !acceptance ||
    [
      "repositoryBindingId",
      "projectId",
      "milestoneId",
      "taskId",
      "attemptId",
      "operationId",
      "recoveryId",
    ].some(
      (key) =>
        typeof acceptance[key] !== "string" ||
        acceptance[key].length === 0 ||
        acceptance[key].length > 1024,
    ) ||
    !Number.isSafeInteger(acceptance.settlementGeneration) ||
    Number(acceptance.settlementGeneration) < 1 ||
    acceptance.consumer !== "orchestrator" ||
    [acceptance.repositoryBinding, acceptance.resultId].some(
      (item) => typeof item !== "string" || !/^[a-f0-9]{64}$/u.test(item),
    )
  )
    return null;
  return Object.freeze(acceptance) as ProjectResultAcceptance;
}

/**
 * Coordinator 状態が有効か判定する。
 *
 * @responsibility Coordinator 状態の有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is CoordinatorStateを返す。
 * @precondition 「value: unknown」がvalidCoordinatorStateの入力契約を満たす。
 * @postcondition validCoordinatorStateの責務を完了した結果だけを返す。
 * @effect N/A: validCoordinatorStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validCoordinatorStateは独自の失敗分岐を所有しない。
 * @invariant validCoordinatorStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validCoordinatorStateはProcess内の同一Subsystemで完結する。
 * @security validCoordinatorStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validCoordinatorStateは共有非同期状態を持たない同期処理である。
 */
export function validCoordinatorState(
  value: unknown,
): value is CoordinatorState {
  if (
    !plainObject(value) ||
    !exactKeys(value, [
      "contract",
      "taskExecutionSelections",
      "projectId",
      "milestoneId",
      "repositoryRevision",
      "generation",
      "ownerGeneration",
      "decisionApplicationId",
      "maximumConcurrency",
      "milestone",
      "objectives",
      "tasks",
    ]) ||
    value.contract !== "crdd-coordinator/project-state/v2" ||
    !inspectTaskExecutionSelections(value.taskExecutionSelections) ||
    !validId(value.projectId) ||
    !validId(value.milestoneId) ||
    typeof value.repositoryRevision !== "string" ||
    !REVISION.test(value.repositoryRevision) ||
    !Number.isSafeInteger(value.generation) ||
    Number(value.generation) < 1 ||
    !validId(value.ownerGeneration) ||
    !nullableId(value.decisionApplicationId) ||
    !Number.isSafeInteger(value.maximumConcurrency) ||
    Number(value.maximumConcurrency) < 1 ||
    Number(value.maximumConcurrency) > 5 ||
    !plainObject(value.milestone) ||
    !exactKeys(value.milestone, [
      "id",
      "acceptanceCriteria",
      "state",
      "criterionEvidenceIds",
    ]) ||
    value.milestone.id !== value.milestoneId ||
    !stringArray(value.milestone.acceptanceCriteria) ||
    !stringArray(value.milestone.criterionEvidenceIds) ||
    !new Set([
      "planned",
      "executing",
      "integrating",
      "human_decision_required",
      "recovery_required",
      "accepted",
      "returned",
      "cancelled",
    ]).has(String(value.milestone.state)) ||
    !Array.isArray(value.objectives) ||
    value.objectives.length < 1 ||
    value.objectives.length > 128 ||
    !Array.isArray(value.tasks) ||
    value.tasks.length < 1 ||
    value.tasks.length > 1024
  )
    return false;

  const objectiveIds = new Set<string>();
  for (const objective of value.objectives) {
    if (
      !plainObject(objective) ||
      !exactKeys(objective, ["definition", "state", "criterionEvidenceIds"]) ||
      !plainObject(objective.definition) ||
      !exactKeys(objective.definition, ["id", "acceptanceCriteria"]) ||
      !validId(objective.definition.id) ||
      objectiveIds.has(objective.definition.id) ||
      !stringArray(objective.definition.acceptanceCriteria) ||
      !stringArray(objective.criterionEvidenceIds) ||
      !new Set([
        "planned",
        "executing",
        "integration_pending",
        "accepted",
        "returned",
        "blocked",
        "cancelled",
      ]).has(String(objective.state))
    )
      return false;
    objectiveIds.add(objective.definition.id);
  }

  const taskIds = new Set<string>();
  const dependencies: Array<readonly string[]> = [];
  for (const task of value.tasks) {
    const definition = plainObject(task) ? task.definition : null;
    const taskDependencies = plainObject(definition)
      ? definition.dependencies
      : null;
    const allowedPaths = plainObject(definition)
      ? definition.allowedPaths
      : null;
    const conflictKeys = plainObject(definition)
      ? definition.conflictKeys
      : null;
    if (
      !plainObject(task) ||
      !exactKeys(task, [
        "definition",
        "state",
        "attemptId",
        "operationId",
        "authorityBindingId",
        "startPhase",
        "cleanupConfirmed",
        "recoveryObligations",
        "resultAcceptances",
        "recoveryUnresolved",
        "candidateId",
        "retryCount",
        "supersededBy",
      ]) ||
      !plainObject(task.definition) ||
      !exactKeys(task.definition, [
        "id",
        "objectiveId",
        "dependencies",
        "allowedPaths",
        "conflictKeys",
      ]) ||
      !validId(task.definition.id) ||
      taskIds.has(task.definition.id) ||
      !validId(task.definition.objectiveId) ||
      !objectiveIds.has(task.definition.objectiveId) ||
      !stringArray(taskDependencies) ||
      !stringArray(allowedPaths) ||
      allowedPaths.length < 1 ||
      !stringArray(conflictKeys) ||
      !new Set([
        "planned",
        "waiting_dependency",
        "ready",
        "starting",
        "running",
        "cleanup_pending",
        "completed",
        "failed",
        "cancelled",
        "recovery_required",
        "superseded",
      ]).has(String(task.state)) ||
      !nullableId(task.attemptId) ||
      !nullableId(task.operationId) ||
      !nullableId(task.authorityBindingId) ||
      !["none", "reserved", "handoff_prepared", "running", "settled"].includes(
        String(task.startPhase),
      ) ||
      typeof task.cleanupConfirmed !== "boolean" ||
      !recoveryObligations(task.recoveryObligations, {
        projectId: String(value.projectId),
        milestoneId: String(value.milestoneId),
        taskId: String(task.definition.id),
        generation: Number(value.generation),
      }) ||
      typeof task.recoveryUnresolved !== "boolean" ||
      (task.state === "recovery_required" &&
        task.recoveryObligations.length === 0 &&
        task.recoveryUnresolved !== true) ||
      (task.state !== "recovery_required" &&
        task.recoveryUnresolved === true) ||
      (task.state === "ready" &&
        task.recoveryObligations.some(
          (entry) =>
            entry.phase !==
            (entry.kind === "docker" ? "acknowledged" : "settled"),
        )) ||
      (!["ready", "recovery_required"].includes(String(task.state)) &&
        task.recoveryObligations.length > 0) ||
      !resultAcceptances(task.resultAcceptances, {
        projectId: String(value.projectId),
        milestoneId: String(value.milestoneId),
        generation: Number(value.generation),
        task: task as unknown as CoordinatorState["tasks"][number],
      }) ||
      !validTaskLifecycleTuple(
        task as unknown as CoordinatorState["tasks"][number],
      ) ||
      !nullableCandidateId(task.candidateId) ||
      !Number.isSafeInteger(task.retryCount) ||
      Number(task.retryCount) < 0 ||
      !nullableId(task.supersededBy)
    )
      return false;
    taskIds.add(task.definition.id);
    dependencies.push(taskDependencies as readonly string[]);
  }
  return dependencies.every((items) => items.every((id) => taskIds.has(id)));
}

/**
 * Queue Entryが有効か判定する。
 *
 * @responsibility Queue Entryの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is ProjectQueueEntryを返す。
 * @precondition 「value: unknown」がvalidQueueEntryの入力契約を満たす。
 * @postcondition validQueueEntryの責務を完了した結果だけを返す。
 * @effect N/A: validQueueEntryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validQueueEntryは独自の失敗分岐を所有しない。
 * @invariant validQueueEntryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validQueueEntryはProcess内の同一Subsystemで完結する。
 * @security validQueueEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validQueueEntryは共有非同期状態を持たない同期処理である。
 */
export function validQueueEntry(value: unknown): value is ProjectQueueEntry {
  return (
    plainObject(value) &&
    exactKeys(value, [
      "queueId",
      "projectId",
      "milestoneId",
      "requestHash",
      "originLane",
      "repositoryRevision",
      "scopeHash",
      "state",
      "generation",
      "ownerGeneration",
      "resumeCondition",
      "resultReference",
      "workspaceId",
      ...(Object.hasOwn(value, "singleTask") ? ["singleTask"] : []),
    ]) &&
    validId(value.queueId) &&
    validId(value.projectId) &&
    (Object.hasOwn(value, "singleTask")
      ? value.milestoneId === null &&
        inspectSingleTaskRecord(value.singleTask) !== null &&
        singleTaskQueueIsConsistent(
          value as unknown as ProjectQueueEntry,
          value.singleTask as SingleTaskRecord,
        )
      : validId(value.milestoneId)) &&
    typeof value.requestHash === "string" &&
    HASH.test(value.requestHash) &&
    (value.originLane === "interactive" || value.originLane === "scheduled") &&
    typeof value.repositoryRevision === "string" &&
    REVISION.test(value.repositoryRevision) &&
    typeof value.scopeHash === "string" &&
    HASH.test(value.scopeHash) &&
    PROJECT_QUEUE_STATES.has(value.state as ProjectQueueState) &&
    Number.isSafeInteger(value.generation) &&
    Number(value.generation) >= 1 &&
    nullableId(value.ownerGeneration) &&
    nullableId(value.resumeCondition) &&
    nullableResultReference(value.resultReference) &&
    (value.workspaceId === null ||
      (typeof value.workspaceId === "string" &&
        /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(
          value.workspaceId,
        )))
  );
}

/**
 * 本番利用側に固定された結果受領方式を返す。
 * @responsibility 一時的な返却と後続再開用の耐久ACKを区別する。
 * @trace ARCH-000008
 * @input consumer: 固定組立てが選択した利用側識別子。
 * @returns transient、durable、または未知利用側のnull。
 * @precondition N/A: 未知値も受け取り拒否する。
 * @postcondition Coordinatorの耐久受領を入力指定で降格しない。
 * @effect N/A: 値の同期判定だけで保存や配送を行わない。
 * @failure 未知識別子・非文字列ではnull。
 * @invariant 受領方式は資源回収やCandidate保全の証明ではない。
 * @boundary 本番組立ての利用側と保存モデルの固定契約。
 * @security Objectの変換・getter・Proxyを評価しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function coordinatorConsumerCompletionPolicy(
  consumer: unknown,
): "transient" | "durable" | null {
  if (consumer === "orchestrator") return "durable";
  if (consumer === "coordinator_cli" || consumer === "workbench")
    return "transient";
  return null;
}

/**
 * recovery Obligationsを決定する。
 *
 * @responsibility recovery Obligationsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: 未検証の回復義務、scope: 保存状態のProject・節目・Task・世代。
 * @returns value is readonly ProjectTaskRecoveryObligation[]を返す。
 * @precondition 「value: unknown」がrecoveryObligationsの入力契約を満たす。
 * @postcondition recoveryObligationsの責務を完了した結果だけを返す。
 * @effect N/A: recoveryObligationsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryObligationsは独自の失敗分岐を所有しない。
 * @invariant recoveryObligationsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryObligationsはProcess内の同一Subsystemで完結する。
 * @security recoveryObligationsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoveryObligationsは共有非同期状態を持たない同期処理である。
 */
export function recoveryObligations(
  value: unknown,
  scope: Readonly<{
    projectId: string;
    milestoneId: string;
    taskId: string;
    generation: number;
  }>,
): value is readonly ProjectTaskRecoveryObligation[] {
  if (!Array.isArray(value) || value.length > 128) return false;
  const identities = new Set<string>();
  for (const entry of value) {
    const acknowledgement = decodeProjectResultAcceptance(
      entry?.acknowledgement,
    );
    const isValidAcknowledgement =
      acknowledgement !== null &&
      [
        acknowledgement.repositoryBindingId,
        acknowledgement.projectId,
        acknowledgement.milestoneId,
        acknowledgement.taskId,
        acknowledgement.attemptId,
        acknowledgement.operationId,
      ].every(validId) &&
      nullableRecoveryId(acknowledgement.recoveryId) &&
      acknowledgement.recoveryId !== null &&
      acknowledgement.projectId === scope.projectId &&
      acknowledgement.milestoneId === scope.milestoneId &&
      acknowledgement.taskId === scope.taskId &&
      acknowledgement.settlementGeneration <= scope.generation;
    if (
      !plainObject(entry) ||
      !exactKeys(
        entry,
        entry.phase === "acknowledged"
          ? ["kind", "recoveryId", "phase", "acknowledgement"]
          : ["kind", "recoveryId", "phase"],
      ) ||
      ![
        "host",
        "docker",
        "candidate",
        "candidate_store",
        "runtime_process",
      ].includes(String(entry.kind)) ||
      !nullableRecoveryId(entry.recoveryId) ||
      entry.recoveryId === null ||
      !["required", "recovering", "settled", "acknowledged"].includes(
        String(entry.phase),
      ) ||
      (entry.phase === "acknowledged" &&
        (entry.kind !== "docker" ||
          !isValidAcknowledgement ||
          acknowledgement?.recoveryId !== entry.recoveryId))
    )
      return false;
    const identity = `${entry.kind}\0${entry.recoveryId}`;
    if (identities.has(identity)) return false;
    identities.add(identity);
  }
  return true;
}

/**
 * 通常Taskの受領集合と保存世代の相関を検査する。
 * @responsibility 回復義務とは別の固定受領本文をSnapshotの閉集合へ接続する。
 * @trace ARCH-000004
 * @input value: 保存本文、scope: Project・節目・世代と検査済みTask。
 * @returns 全要素の形式・相関・終端条件が成立するか。
 * @precondition Taskの基本項目と回復義務は先行して検査済みである。
 * @postcondition 未記載を空配列へ補完せず、旧Attemptや未来世代を拒否する。
 * @effect N/A: 保存値の検査だけ。
 * @failure 不正本文、重複、非終端受領、未解決義務はfalse。
 * @invariant ACKの有無を資源不存在の証明にしない。
 * @boundary 単一現在Snapshotの保存・読戻し。
 * @security 任意関数を受領本文として実行しない。
 * @concurrency N/A: 同期値検査であり排他は既存保存Ownerが所有する。
 */
export function resultAcceptances(
  value: unknown,
  scope: Readonly<{
    projectId: string;
    milestoneId: string;
    generation: number;
    task: CoordinatorState["tasks"][number];
  }>,
): boolean {
  if (!Array.isArray(value) || value.length > 128) return false;
  const task = scope.task;
  if (
    value.length > 0 &&
    (!["completed", "failed", "cancelled"].includes(task.state) ||
      task.startPhase !== "settled" ||
      !task.cleanupConfirmed ||
      task.recoveryUnresolved ||
      task.recoveryObligations.some(
        (entry) =>
          entry.phase !==
          (entry.kind === "docker" ? "acknowledged" : "settled"),
      ))
  )
    return false;
  const identities = new Set<string>();
  let repositoryBindingId: string | null = null;
  let repositoryBinding: string | null = null;
  let settlementGeneration: number | null = null;
  for (const valueEntry of value) {
    const entry = decodeProjectResultAcceptance(valueEntry);
    if (
      !entry ||
      ![
        entry.repositoryBindingId,
        entry.projectId,
        entry.milestoneId,
        entry.taskId,
        entry.attemptId,
        entry.operationId,
      ].every(validId) ||
      entry.projectId !== scope.projectId ||
      entry.milestoneId !== scope.milestoneId ||
      entry.taskId !== task.definition.id ||
      entry.attemptId !== task.attemptId ||
      entry.operationId !== task.operationId ||
      entry.settlementGeneration > scope.generation ||
      !nullableRecoveryId(entry.recoveryId) ||
      identities.has(entry.recoveryId) ||
      task.recoveryObligations.some(
        (obligation) => obligation.recoveryId === entry.recoveryId,
      ) ||
      (repositoryBindingId !== null &&
        repositoryBindingId !== entry.repositoryBindingId) ||
      (repositoryBinding !== null &&
        repositoryBinding !== entry.repositoryBinding) ||
      (settlementGeneration !== null &&
        settlementGeneration !== entry.settlementGeneration)
    )
      return false;
    identities.add(entry.recoveryId);
    repositoryBindingId = entry.repositoryBindingId;
    repositoryBinding = entry.repositoryBinding;
    settlementGeneration = entry.settlementGeneration;
  }
  return true;
}

/**
 * Task Lifecycle Tupleが有効か判定する。
 *
 * @responsibility Task Lifecycle Tupleの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input task: CoordinatorState["tasks"][number]
 * @returns validTaskLifecycleTupleの計算結果を返す。
 * @precondition 「task: CoordinatorState["tasks"][number]」がvalidTaskLifecycleTupleの入力契約を満たす。
 * @postcondition validTaskLifecycleTupleの責務を完了した結果だけを返す。
 * @effect N/A: validTaskLifecycleTupleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTaskLifecycleTupleは独自の失敗分岐を所有しない。
 * @invariant validTaskLifecycleTupleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validTaskLifecycleTupleはProcess内の同一Subsystemで完結する。
 * @security validTaskLifecycleTupleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validTaskLifecycleTupleは共有非同期状態を持たない同期処理である。
 */
export function validTaskLifecycleTuple(
  task: CoordinatorState["tasks"][number],
) {
  const isAttempt = task.attemptId !== null;
  const isOperation = task.operationId !== null;
  const isAuthority = task.authorityBindingId !== null;
  if (["planned", "waiting_dependency", "ready"].includes(task.state))
    return (
      task.startPhase === "none" && !isAttempt && !isOperation && !isAuthority
    );
  if (task.state === "starting" && task.startPhase === "reserved")
    return isAttempt && !isOperation && isAuthority;
  if (task.state === "starting" && task.startPhase === "handoff_prepared")
    return isAttempt && isOperation && isAuthority;
  if (task.state === "running")
    return (
      task.startPhase === "running" && isAttempt && isOperation && isAuthority
    );
  if (
    [
      "cleanup_pending",
      "completed",
      "failed",
      "cancelled",
      "recovery_required",
      "superseded",
    ].includes(task.state)
  )
    return (
      task.startPhase === "settled" && isAttempt && isOperation && isAuthority
    );
  return false;
}

/**
 * 保存する単発記録を閉検査し独立Snapshotにする。
 * @responsibility getter／Proxyと本文混入、終端の相関違反を拒否する。
 * @trace ARCH-000004
 * @input 未検証の記録。
 * @returns 検証済み凍結値、又はnull。
 * @precondition Authorityは呼出し元で検証する。
 * @postcondition 元入力の後続変更から分離する。
 * @effect なし。
 * @failure 不足・過剰・相関不一致はnull。
 * @invariant 不明を成功・回復なしへ丸めない。
 * @boundary Snapshot codec。
 * @security 保存fieldを固定し秘密・本文を許可しない。
 * @concurrency 同期の値検査のみ。
 */
export function inspectSingleTaskRecord(raw: unknown): SingleTaskRecord | null {
  const value =
    snapshotPlainRecord(raw, KEYS) ??
    snapshotPlainRecord(raw, new Set([...KEYS, "adviceOperation"]));
  if (
    !value ||
    Object.keys(value).length !==
      KEYS.size + (Object.hasOwn(value, "adviceOperation") ? 1 : 0)
  )
    return null;
  const adviceOperation = Object.hasOwn(value, "adviceOperation")
    ? snapshotPlainRecord(
        value.adviceOperation,
        new Set(["operationId", "hostRecoveryId"]),
      )
    : null;
  if (
    Object.hasOwn(value, "adviceOperation") &&
    (!adviceOperation ||
      Object.keys(adviceOperation).length !== 2 ||
      typeof adviceOperation.operationId !== "string" ||
      !ID.test(adviceOperation.operationId) ||
      typeof adviceOperation.hostRecoveryId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,1023}$/u.test(
        adviceOperation.hostRecoveryId,
      ) ||
      value.mode !== "read_only_advice" ||
      value.phase === "accepted")
  )
    return null;
  for (const key of ["principalId", "taskId", "attemptId", "operationId"])
    if (typeof value[key] !== "string" || !ID.test(value[key])) return null;
  if (
    typeof value.mode !== "string" ||
    !["read_only_advice", "workspace_edit"].includes(value.mode) ||
    !inspectExecutionSelection(value.executionSelection) ||
    inspectExecutionSelection(value.executionSelection)?.role !==
      (value.mode === "read_only_advice" ? "advice" : "executor") ||
    typeof value.phase !== "string" ||
    !["accepted", "starting", "running", "settled"].includes(value.phase) ||
    typeof value.status !== "string" ||
    !["pending", "completed", "blocked", "cancelled", "unknown"].includes(
      value.status,
    ) ||
    typeof value.cleanupConfirmed !== "boolean" ||
    !(
      value.reason === null ||
      (typeof value.reason === "string" &&
        /^[a-z][a-z0-9_]{0,255}$/u.test(value.reason))
    )
  )
    return null;
  const recoveries = snapshotPlainArray(value.recoveryIds, 64);
  if (recoveries.status !== "ok") return null;
  const recoveryIds: string[] = [];
  for (const recoveryId of recoveries.value) {
    if (
      typeof recoveryId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,1023}$/u.test(recoveryId)
    )
      return null;
    recoveryIds.push(recoveryId);
  }
  if (new Set(recoveryIds).size !== recoveryIds.length) return null;
  if (value.phase !== "settled") {
    if (
      value.status !== "pending" ||
      value.reason !== null ||
      value.cleanupConfirmed ||
      recoveryIds.length
    )
      return null;
  } else if (
    value.status === "pending" ||
    (["completed", "cancelled"].includes(value.status) &&
      (!value.cleanupConfirmed || recoveryIds.length))
  )
    return null;
  return Object.freeze({
    ...value,
    executionSelection: inspectExecutionSelection(value.executionSelection),
    ...(adviceOperation
      ? { adviceOperation: Object.freeze(adviceOperation) }
      : {}),
    recoveryIds: Object.freeze(recoveryIds),
  }) as SingleTaskRecord;
}

export const PROJECT_QUEUE_STATES = new Set<ProjectQueueState>([
  "queued",
  "leased",
  "running",
  "waiting_foreground",
  "integration_pending",
  "replan_required",
  "human_decision_required",
  "recovery_required",
  "completed",
  "cancelled",
]);

export const KEYS = new Set([
  "principalId",
  "mode",
  "executionSelection",
  "taskId",
  "attemptId",
  "operationId",
  "phase",
  "status",
  "reason",
  "cleanupConfirmed",
  "recoveryIds",
]);

export const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
