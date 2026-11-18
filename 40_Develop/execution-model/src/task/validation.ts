/**
 * Task・Queue・単独実行状態の値検査と純粋な遷移・投影を所有する。
 * @responsibility I/Oや新しい権限を発行せず、モデル固有の受入条件を判定する。
 * @trace ARCH-000008
 */
import { types } from "node:util";
import type { ProjectMilestoneState } from "../objective/types.ts";
import { hasTaskDependencyCycle } from "../objective/validation.ts";
import {
  encodeStateValue,
  HASH,
  hasStateKeys,
  isPrincipalId,
  isStateObject,
  normalizeRepositoryRelativePath,
  nullableId,
  REVISION,
  snapshotStateArray,
  snapshotStateRecord,
  stringArray,
  validId,
} from "../state/operations.ts";
import type {
  ExecutionStateSnapshot,
  ProjectExecutionState,
} from "../state/types.ts";
import type {
  ExecutionSelection,
  ProjectQueueEntry,
  ProjectQueueState,
  ProjectTaskDefinition,
  ProjectTaskRecord,
  ProjectTaskRecoveryKind,
  ProjectTaskRecoveryObligation,
  ProjectTaskState,
  SingleTaskRecord,
  TaskExecutionSelections,
  TaskExecutionUpdate,
  TaskStartCandidates,
} from "./types.ts";

/**
 * Taskの公開値から保存する元事実・参照だけを組み立てる。
 * @responsibility 全Projectの受領を一度保持し、Operationと配送待ちを同じ候補から除く。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 検証済み元版、states: 業務候補、facts: 発生元が明示した同Attemptの結果不明。
 * @returns 保存区画、又は不正入力のnull。
 * @precondition 呼出し側が業務遷移・現在Ownerを照合する。
 * @postcondition 投影値をTask固有の元事実へ書き戻さない。
 * @effect N/A: 同期の値変換のみ。
 * @failure 孤立・重複・別Scopeの事実と受領差替えは拒否する。
 * @invariant 受領Hash・Docker義務phaseを複製しない。
 * @boundary Task公開値と単一保存値。
 * @security 値の成立は実資源・受領Authorityを証明しない。
 * @concurrency N/A: 保存排他は呼出し側が所有する。
 */
export function associateTaskOperations(
  snapshot: ExecutionStateSnapshot,
  operations: ExecutionStateSnapshot["operations"],
): ExecutionStateSnapshot["managedExecutions"] {
  return snapshot.managedExecutions.map((project) => ({
    ...project,
    tasks: project.tasks.map((task) => {
      const recoveryIds = operations
        .filter((operation) => {
          if (operation.kind !== "docker_task" || task.operationId === null)
            return false;
          const identity = JSON.parse(operation.identityJson);
          return (
            (identity.recoveryCorrelationId ?? identity.operationId) ===
            task.operationId
          );
        })
        .map((operation) => operation.recoveryId);
      if (recoveryIds.length === 0) return task;
      return {
        ...task,
        settlement: {
          kind: "operations" as const,
          recoveryIds,
          resultUnresolved:
            task.settlement.kind === "operations"
              ? task.settlement.resultUnresolved
              : task.settlement.kind === "executor_result" &&
                task.settlement.recoveryUnresolved,
        },
      };
    }),
  }));
}
/**
 * Coordinator 状態が有効か判定する。
 *
 * @responsibility Coordinator 状態の有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is ProjectExecutionStateを返す。
 * @precondition 「value: unknown」がvalidStateの入力契約を満たす。
 * @postcondition validStateの責務を完了した結果だけを返す。
 * @effect N/A: validStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validStateは独自の失敗分岐を所有しない。
 * @invariant validStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validStateはProcess内の同一Subsystemで完結する。
 * @security validStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validStateは共有非同期状態を持たない同期処理である。
 */
export function validState(value: unknown): value is ProjectExecutionState {
  if (
    !isStateObject(value) ||
    !hasStateKeys(value, [
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
    value.contract !== "crdd-execution-model/project-state/v3" ||
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
    !isStateObject(value.milestone) ||
    !hasStateKeys(value.milestone, [
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
    !Array.isArray(value.tasks) ||
    value.tasks.length < 1
  )
    return false;

  const objectiveIds = new Set<string>();
  for (const objective of value.objectives) {
    if (
      !isStateObject(objective) ||
      !hasStateKeys(objective, [
        "definition",
        "state",
        "criterionEvidenceIds",
      ]) ||
      !isStateObject(objective.definition) ||
      !hasStateKeys(objective.definition, ["id", "acceptanceCriteria"]) ||
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
    const definition = isStateObject(task) ? task.definition : null;
    const taskDependencies = isStateObject(definition)
      ? definition.dependencies
      : null;
    const allowedPaths = isStateObject(definition)
      ? definition.allowedPaths
      : null;
    const conflictKeys = isStateObject(definition)
      ? definition.conflictKeys
      : null;
    if (
      !isStateObject(task) ||
      !hasStateKeys(task, [
        "definition",
        "state",
        "attemptId",
        "operationId",
        "authorityBindingId",
        "startPhase",
        "cleanupConfirmed",
        "recoveryObligations",
        "recoveryUnresolved",
        "candidateId",
        "retryCount",
        "supersededBy",
      ]) ||
      !isStateObject(task.definition) ||
      !hasStateKeys(task.definition, [
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
      !recoveryObligations(task.recoveryObligations) ||
      typeof task.recoveryUnresolved !== "boolean" ||
      (task.state === "recovery_required" &&
        task.recoveryObligations.length === 0 &&
        task.recoveryUnresolved !== true) ||
      (task.state !== "recovery_required" &&
        task.recoveryUnresolved === true) ||
      (task.state === "ready" &&
        task.recoveryObligations.some((entry) => entry.phase !== "settled")) ||
      (!["ready", "recovery_required"].includes(String(task.state)) &&
        task.recoveryObligations.length > 0) ||
      !validTaskLifecycleTuple(
        task as unknown as ProjectExecutionState["tasks"][number],
      ) ||
      !nullableTaskReference(task.candidateId) ||
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
/** 回復義務の型・対象識別子・単調段階を検査する。受領や利用側は扱わない。 */
export function recoveryObligations(
  value: unknown,
): value is readonly ProjectTaskRecoveryObligation[] {
  if (!Array.isArray(value)) return false;
  const identities = new Set<string>();
  for (const entry of value) {
    if (
      !isStateObject(entry) ||
      !hasStateKeys(entry, ["kind", "recoveryId", "phase"]) ||
      ![
        "host",
        "docker",
        "candidate",
        "candidate_store",
        "runtime_process",
      ].includes(String(entry.kind)) ||
      !["required", "recovering", "settled"].includes(String(entry.phase)) ||
      typeof entry.recoveryId !== "string" ||
      !nullableTaskReference(entry.recoveryId) ||
      identities.has(entry.recoveryId)
    )
      return false;
    identities.add(entry.recoveryId);
  }
  return true;
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
    isStateObject(value) &&
    hasStateKeys(value, [
      "queueId",
      "historySettled",
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
    typeof value.historySettled === "boolean" &&
    (!value.historySettled ||
      (["completed", "cancelled"].includes(String(value.state)) &&
        value.ownerGeneration === null)) &&
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
    nullableTaskReference(value.resultReference) &&
    (value.workspaceId === null ||
      (typeof value.workspaceId === "string" &&
        /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(
          value.workspaceId,
        )))
  );
}

/**
 * Task Lifecycle Tupleが有効か判定する。
 *
 * @responsibility Task Lifecycle Tupleの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input task: ProjectExecutionState["tasks"][number]
 * @returns validTaskLifecycleTupleの計算結果を返す。
 * @precondition 「task: ProjectExecutionState["tasks"][number]」がvalidTaskLifecycleTupleの入力契約を満たす。
 * @postcondition validTaskLifecycleTupleの責務を完了した結果だけを返す。
 * @effect N/A: validTaskLifecycleTupleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTaskLifecycleTupleは独自の失敗分岐を所有しない。
 * @invariant validTaskLifecycleTupleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validTaskLifecycleTupleはProcess内の同一Subsystemで完結する。
 * @security validTaskLifecycleTupleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validTaskLifecycleTupleは共有非同期状態を持たない同期処理である。
 */
export function validTaskLifecycleTuple(
  task: ProjectExecutionState["tasks"][number],
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
    snapshotStateRecord(raw, KEYS) ??
    snapshotStateRecord(raw, new Set([...KEYS, "adviceOperation"]));
  if (
    !value ||
    Object.keys(value).length !==
      KEYS.size + (Object.hasOwn(value, "adviceOperation") ? 1 : 0)
  )
    return null;
  const adviceOperation = Object.hasOwn(value, "adviceOperation")
    ? snapshotStateRecord(
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
  if (!isPrincipalId(value.principalId)) return null;
  for (const key of ["taskId", "attemptId", "operationId"])
    if (typeof value[key] !== "string" || !ID.test(value[key])) return null;
  const executionSelection = inspectExecutionSelection(
    value.executionSelection,
  );
  if (
    typeof value.mode !== "string" ||
    !["read_only_advice", "workspace_edit"].includes(value.mode) ||
    !executionSelection ||
    executionSelection.role !==
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
  const recoveries = snapshotStateArray(
    value.recoveryIds,
    Number.MAX_SAFE_INTEGER,
  );
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
    executionSelection,
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

/**
 * 保存された選定を現在Catalogで解き直さず独立値へ取り出す。
 * @responsibility 選定の十項目と相関だけを閉じて検査する。
 * @trace ARCH-000004
 * @input candidate: 保存済み又は搬送された未信頼選定。
 * @returns 不変な選定値、又はnull。
 * @precondition 新規実行の技術可否は別の技術Catalog検査を通す。
 * @postcondition alias・選定元・当時の内容Identityをそのまま保持する。
 * @effect N/A: 同期的な値検査と独立Objectの構築だけ。
 * @failure 不足・過剰・実行Property・相関不正はnull。
 * @invariant 復元成功は現在の実行許可や利用可能性を意味しない。
 * @boundary 保存選定とTask／Packetの値搬送。
 * @security Proxy・Getterを実行せず、Authorityを生成しない。
 * @concurrency 一度捕捉したdata descriptorの値だけを使用する。
 */
export function inspectExecutionSelection(
  candidate: unknown,
): ExecutionSelection | null {
  try {
    if (
      candidate === null ||
      typeof candidate !== "object" ||
      types.isProxy(candidate)
    )
      return null;
    const prototype = Object.getPrototypeOf(candidate);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(candidate);
    const keys = [
      "provider",
      "modelIdentifier",
      "identifierKind",
      "reasoningEffort",
      "purpose",
      "catalogIdentity",
      "configIdentity",
      "role",
      "workType",
      "source",
    ] as const;
    const actual = Reflect.ownKeys(descriptors);
    if (
      actual.length !== keys.length ||
      actual.some(
        (key) =>
          typeof key !== "string" || !keys.some((expected) => expected === key),
      )
    )
      return null;
    const value: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        descriptor.enumerable !== true ||
        Object.hasOwn(descriptor, "get") ||
        Object.hasOwn(descriptor, "set")
      )
        return null;
      value[key] = descriptor.value;
    }
    if (
      (value.provider !== "codex" && value.provider !== "claude") ||
      typeof value.modelIdentifier !== "string" ||
      !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value.modelIdentifier) ||
      (value.identifierKind !== "exact" && value.identifierKind !== "alias") ||
      typeof value.reasoningEffort !== "string" ||
      !["low", "medium", "high", "xhigh", "max"].includes(
        value.reasoningEffort,
      ) ||
      (value.purpose !== "advice" && value.purpose !== "task") ||
      typeof value.catalogIdentity !== "string" ||
      !/^[a-f0-9]{64}$/u.test(value.catalogIdentity) ||
      typeof value.configIdentity !== "string" ||
      !/^[a-f0-9]{64}$/u.test(value.configIdentity) ||
      typeof value.role !== "string" ||
      ![
        "coordinator",
        "executor",
        "independent_reviewer",
        "result_integration",
        "advice",
      ].includes(value.role) ||
      !(
        value.workType === null ||
        (typeof value.workType === "string" &&
          /^[a-z0-9][a-z0-9._-]*$/u.test(value.workType))
      ) ||
      typeof value.source !== "string" ||
      !["explicit", "work_type_override", "role_default"].includes(
        value.source,
      ) ||
      (value.source === "work_type_override" && value.workType === null) ||
      value.purpose !==
        (["executor", "independent_reviewer"].includes(value.role)
          ? "task"
          : "advice")
    )
      return null;
    return Object.freeze({ ...value }) as ExecutionSelection;
  } catch {
    return null;
  }
}

/**
 * 保存済みの役割別選定を現在設定で解き直さず検査する。
 * @responsibility stage間で選定組を混ぜない閉形式codecを所有する。
 * @trace ARCH-000004
 * @input candidate: 未信頼の二役割選定。
 * @returns 独立した不変値、不正時null。
 * @precondition 実行可否と認可は別のOwnerが確認する。
 * @postcondition 元のModel・alias・分類・選定元を維持する。
 * @effect N/A: 局所値検査だけ。
 * @failure 不足・過剰・Proxy・accessor・相関不正はnull。
 * @invariant 現在Catalog・設定Store・I/Oを参照しない。
 * @boundary 保存codecと実行Owner。
 * @security 選定の復元を実行許可にしない。
 * @concurrency 同期処理で元入力へ書き込まない。
 */
export function inspectTaskExecutionSelections(
  candidate: unknown,
): TaskExecutionSelections | null {
  if (!candidate || typeof candidate !== "object" || types.isProxy(candidate))
    return null;
  const prototype = Object.getPrototypeOf(candidate);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(candidate);
  if (Reflect.ownKeys(descriptors).length !== 2) return null;
  const values = ["executor", "reviewer"].map((key) => {
    const descriptor = descriptors[key];
    return descriptor && "value" in descriptor && descriptor.enumerable
      ? inspectExecutionSelection(descriptor.value)
      : null;
  });
  const [executor, reviewer] = values;
  if (
    !executor ||
    !reviewer ||
    executor.role !== "executor" ||
    reviewer.role !== "independent_reviewer" ||
    reviewer.source === "explicit" ||
    executor.configIdentity !== reviewer.configIdentity ||
    executor.catalogIdentity !== reviewer.catalogIdentity ||
    executor.workType !== reviewer.workType
  )
    return null;
  return Object.freeze({ executor, reviewer });
}

/**
 * 単発記録とQueueの共同状態を確認する。
 * @responsibility 未回収の完了表示と段階混同をcodecで拒否する。
 * @trace ARCH-000004
 * @input JSONから確認したQueueと単発記録。
 * @returns 共同状態が成立する場合のみtrue。
 * @precondition 単発記録の閉検査が成功している。
 * @postcondition Owner喪失を成功へ変換しない。
 * @effect なし。
 * @failure 不整合はfalse。
 * @invariant Project計画用Queueへ適用しない。
 * @boundary 既存Snapshot codec。
 * @security 状態名から実資源の不存在を推定しない。
 * @concurrency 同期値検査。
 */
export function singleTaskQueueIsConsistent(
  queue: Pick<
    ProjectQueueEntry,
    "state" | "ownerGeneration" | "resumeCondition" | "resultReference"
  >,
  record: SingleTaskRecord,
): boolean {
  if (
    queue.state === "recovery_required" &&
    queue.ownerGeneration === null &&
    ["owner_loss", "exact_recovery"].includes(queue.resumeCondition ?? "") &&
    record.phase !== "settled"
  )
    return true;
  if (record.phase === "accepted")
    return (
      queue.state === "queued" &&
      queue.ownerGeneration === null &&
      queue.resumeCondition === null &&
      queue.resultReference === null
    );
  if (record.phase !== "settled")
    return (
      queue.state === "running" &&
      queue.ownerGeneration !== null &&
      queue.resumeCondition === null
    );
  if (!record.cleanupConfirmed || record.recoveryIds.length > 0)
    return queue.state === "recovery_required";
  return (
    queue.state ===
      (record.status === "cancelled" ? "cancelled" : "completed") &&
    queue.resumeCondition === null
  );
}

/**
 * Taskの候補・回復・結果参照に共通するnullable文法を検査する。
 *
 * @responsibility 同じ512文字以内の参照文法を一意に保ち、参照先の実在や意味を判断しない。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns nullableTaskReferenceの計算結果を返す。
 * @precondition 「value: unknown」がnullableTaskReferenceの入力契約を満たす。
 * @postcondition nullableTaskReferenceの責務を完了した結果だけを返す。
 * @effect N/A: nullableTaskReferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nullableTaskReferenceは独自の失敗分岐を所有しない。
 * @invariant nullableTaskReferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nullableTaskReferenceはProcess内の同一Subsystemで完結する。
 * @security nullableTaskReferenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: nullableTaskReferenceは共有非同期状態を持たない同期処理である。
 */
function nullableTaskReference(value: unknown) {
  return value === null || validResultReference(value);
}

/**
 * 結果 Referenceが有効か判定する。
 *
 * @responsibility 結果 Referenceの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidResultReferenceの入力契約を満たす。
 * @postcondition validResultReferenceの責務を完了した結果だけを返す。
 * @effect N/A: validResultReferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validResultReferenceは独自の失敗分岐を所有しない。
 * @invariant validResultReferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validResultReferenceはProcess内の同一Subsystemで完結する。
 * @security validResultReferenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validResultReferenceは共有非同期状態を持たない同期処理である。
 */
export function validResultReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * 同じProject状態から並列枠と競合予約を含む開始候補を観測する。
 * @responsibility 定義順・未回収資源・PathとConflict Keyの規則を一正本にする。
 * @trace ARCH-000004、ARCH-000008
 * @invariant 返却値は非永続の観測であり実行Authorityではない。
 */
export function observeTaskStartCandidates(
  state: ProjectExecutionState,
): TaskStartCandidates {
  return Object.freeze({
    projectId: state.projectId,
    generation: state.generation,
    taskIds: selectSchedulableProjectTasks(state),
  });
}

/** 再計画定義の既存Path・重複条件を独立した値へ捕捉する。 @trace ARCH-000004、ARCH-000008 */
function captureReplanTaskDefinition(
  definition: ProjectTaskDefinition,
): ProjectTaskDefinition | null {
  if (!validId(definition.id) || !validId(definition.objectiveId)) return null;
  const capture = (values: readonly string[], isPath = false) => {
    const items: string[] = [];
    const seen = new Set<string>();
    for (const value of values) {
      if (typeof value !== "string" || value.length === 0) return null;
      const normalized = isPath
        ? normalizeRepositoryRelativePath(value)
        : value.replaceAll("\\", "/");
      if (normalized === null || seen.has(normalized.toUpperCase()))
        return null;
      seen.add(normalized.toUpperCase());
      items.push(normalized);
    }
    return Object.freeze(items);
  };
  const dependencies = capture(definition.dependencies);
  const allowedPaths = capture(definition.allowedPaths, true);
  const conflictKeys = capture(definition.conflictKeys);
  return !dependencies ||
    !allowedPaths ||
    !conflictKeys ||
    allowedPaths.length === 0
    ? null
    : Object.freeze({
        id: definition.id,
        objectiveId: definition.objectiveId,
        dependencies,
        allowedPaths,
        conflictKeys,
      });
}

/** 部分再計画の範囲・回数・依存を検査し一世代の候補を作る。 @trace ARCH-000004、ARCH-000008 */
export function prepareTaskReplan(
  state: ProjectExecutionState,
  expectedGeneration: number,
  input: Readonly<{
    failedTaskId: string;
    replacements: readonly ProjectTaskDefinition[];
    maximumReplans: number;
  }>,
) {
  const failed = state.tasks.find(
    (task) => task.definition.id === input.failedTaskId,
  );
  const completedIds = new Set(
    state.tasks
      .filter((task) => task.state === "completed")
      .map((task) => task.definition.id),
  );
  const replacementDefinitions = input.replacements.map(
    captureReplanTaskDefinition,
  );
  const existingIds = new Set(state.tasks.map((task) => task.definition.id));
  const replacementIds = new Set(
    replacementDefinitions
      .filter((value): value is ProjectTaskDefinition => value !== null)
      .map((definition) => definition.id),
  );
  const availableDependencies = new Set([...completedIds, ...replacementIds]);
  const hasLiveDependent = state.tasks.some(
    (task) =>
      task.definition.id !== input.failedTaskId &&
      !["completed", "cancelled", "failed", "superseded"].includes(
        task.state,
      ) &&
      task.definition.dependencies.includes(input.failedTaskId),
  );
  if (
    state.generation !== expectedGeneration ||
    !failed ||
    failed.state !== "failed" ||
    failed.supersededBy !== null ||
    !Number.isSafeInteger(input.maximumReplans) ||
    input.maximumReplans < 0 ||
    state.tasks.filter((task) => task.supersededBy !== null).length >=
      input.maximumReplans ||
    hasLiveDependent ||
    replacementDefinitions.length === 0 ||
    replacementDefinitions.some((definition) => definition === null) ||
    replacementIds.size !== replacementDefinitions.length ||
    [...replacementIds].some((id) => existingIds.has(id)) ||
    (replacementDefinitions as readonly ProjectTaskDefinition[]).some(
      (definition) =>
        definition.objectiveId !== failed.definition.objectiveId ||
        definition.dependencies.some(
          (dependency) => !availableDependencies.has(dependency),
        ),
    ) ||
    hasTaskDependencyCycle([
      ...state.tasks
        .filter(
          (task) => task.state !== "failed" && task.state !== "superseded",
        )
        .map((task) => task.definition),
      ...(replacementDefinitions as readonly ProjectTaskDefinition[]),
    ])
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_replan_invalid_or_out_of_scope",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const replacements = (
    replacementDefinitions as readonly ProjectTaskDefinition[]
  ).map((definition) =>
    Object.freeze({
      definition,
      state: definition.dependencies.every((dependency) =>
        completedIds.has(dependency),
      )
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
  const replacementHead = replacements[0]?.definition.id ?? null;
  const tasks = [
    ...state.tasks.map((task) =>
      task.definition.id === failed.definition.id
        ? Object.freeze({
            ...task,
            state: "superseded" as const,
            supersededBy: replacementHead,
          })
        : task,
    ),
    ...replacements,
  ];
  const objectives = state.objectives.map((objective) =>
    objective.definition.id === failed.definition.objectiveId
      ? Object.freeze({
          ...objective,
          state: "executing" as const,
          criterionEvidenceIds: Object.freeze([]),
        })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_partial_replan_applied",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: "executing" as const,
      }),
      objectives: Object.freeze(objectives),
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze(replacements.map((task) => task.definition.id)),
  });
}

/** 同一計画の再試行で元の実行相関を退役し、回数を一つ進める。 @trace ARCH-000004、ARCH-000008 */
export function prepareTaskRetry(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskId: string,
  maximumReplans: number,
  previousRetryCount: number,
) {
  const failed = state.tasks.find((task) => task.definition.id === taskId);
  if (
    state.generation !== expectedGeneration ||
    !failed ||
    failed.state !== "failed" ||
    failed.retryCount !== previousRetryCount ||
    !Number.isSafeInteger(maximumReplans) ||
    maximumReplans < 0 ||
    failed.retryCount >= maximumReplans
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_retry_invalid_or_limit_exceeded",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = state.tasks.map((task) =>
    task.definition.id !== taskId
      ? task
      : Object.freeze({
          ...task,
          state: "ready" as const,
          attemptId: null,
          operationId: null,
          authorityBindingId: null,
          startPhase: "none" as const,
          cleanupConfirmed: false,
          recoveryObligations: Object.freeze([]),
          recoveryUnresolved: false,
          candidateId: null,
          retryCount: task.retryCount + 1,
        }),
  );
  const objectives = state.objectives.map((objective) =>
    objective.definition.id === failed.definition.objectiveId
      ? Object.freeze({ ...objective, state: "executing" as const })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_plan_maintained_for_retry",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: "executing" as const,
      }),
      objectives: Object.freeze(objectives),
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([taskId]),
  });
}
/** 実行中Taskの相関・清掃・回復義務と完了依存を一世代の終端候補に結合する。 @trace ARCH-000004、ARCH-000008 */
export function prepareTaskSettlement(
  state: ProjectExecutionState,
  expectedGeneration: number,
  input: Readonly<{
    taskId: string;
    attemptId: string;
    operationId: string;
    authorityBindingId: string;
    outcome: "completed" | "failed" | "cancelled" | "recovery_required";
    cleanupConfirmed: boolean;
    recoveryObligations: readonly ProjectTaskRecoveryObligation[];
    recoveryUnresolved: boolean;
    candidateId?: string | null;
  }>,
) {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === input.taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "running" ||
    task.startPhase !== "running" ||
    task.attemptId !== input.attemptId ||
    task.operationId !== input.operationId ||
    task.authorityBindingId !== input.authorityBindingId ||
    (input.outcome === "completed" && !input.cleanupConfirmed) ||
    (input.outcome === "cancelled" && !input.cleanupConfirmed) ||
    !Array.isArray(input.recoveryObligations) ||
    new Set(
      input.recoveryObligations.map(
        (entry) => `${entry.kind}\0${entry.recoveryId}`,
      ),
    ).size !== input.recoveryObligations.length ||
    input.recoveryObligations.some(
      (entry) =>
        ![
          "host",
          "docker",
          "candidate",
          "candidate_store",
          "runtime_process",
        ].includes(entry.kind) ||
        !validResultReference(entry.recoveryId) ||
        entry.phase !== "required",
    ) ||
    typeof input.recoveryUnresolved !== "boolean" ||
    (input.outcome === "recovery_required" &&
      input.recoveryObligations.length === 0 &&
      !input.recoveryUnresolved) ||
    (input.outcome !== "recovery_required" &&
      (input.recoveryObligations.length !== 0 || input.recoveryUnresolved)) ||
    (input.candidateId !== undefined &&
      input.candidateId !== null &&
      !validResultReference(input.candidateId)) ||
    (input.outcome !== "completed" &&
      input.candidateId !== undefined &&
      input.candidateId !== null)
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_settlement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const nextState: ProjectTaskState =
    input.outcome === "failed" && !input.cleanupConfirmed
      ? "cleanup_pending"
      : input.outcome;
  let tasks = state.tasks.map((current) =>
    current.definition.id !== input.taskId
      ? current
      : Object.freeze({
          ...current,
          state: nextState,
          startPhase: "settled" as const,
          cleanupConfirmed: input.cleanupConfirmed,
          recoveryObligations: Object.freeze(
            input.recoveryObligations.map((entry) =>
              Object.freeze({ ...entry }),
            ),
          ),
          recoveryUnresolved: input.recoveryUnresolved,
          candidateId:
            input.outcome === "completed" ? (input.candidateId ?? null) : null,
        }),
  );
  const completed = new Set(
    tasks
      .filter((candidate) => candidate.state === "completed")
      .map((candidate) => candidate.definition.id),
  );
  tasks = tasks.map((candidate) =>
    candidate.state === "waiting_dependency" &&
    candidate.definition.dependencies.every((dependency) =>
      completed.has(dependency),
    )
      ? Object.freeze({ ...candidate, state: "ready" as const })
      : candidate,
  );
  const objectives = state.objectives.map((objective) => {
    if (objective.state === "accepted" || objective.state === "cancelled")
      return objective;
    const objectiveTasks = tasks.filter(
      (task) =>
        task.definition.objectiveId === objective.definition.id &&
        task.state !== "superseded",
    );
    if (objectiveTasks.every((task) => task.state === "completed")) {
      return Object.freeze({
        ...objective,
        state: "integration_pending" as const,
      });
    }
    if (objectiveTasks.some((task) => task.state === "cancelled")) {
      return Object.freeze({ ...objective, state: "cancelled" as const });
    }
    if (
      objectiveTasks.some((task) =>
        ["failed", "recovery_required"].includes(task.state),
      )
    ) {
      return Object.freeze({ ...objective, state: "blocked" as const });
    }
    return objective;
  });
  const milestoneState: ProjectMilestoneState = tasks.some(
    (task) => task.state === "recovery_required",
  )
    ? "recovery_required"
    : tasks.some((task) => task.state === "cancelled")
      ? "cancelled"
      : state.milestone.state;
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_task_settled",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({ ...state.milestone, state: milestoneState }),
      objectives: Object.freeze(objectives),
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([input.taskId]),
  });
}

/** 開始未受理の引渡しを、元の相関と回復義務を保って一世代で終端化する。 @trace ARCH-000004、ARCH-000008 */
export function prepareTaskPreEffectSettlement(
  state: ProjectExecutionState,
  expectedGeneration: number,
  input: Readonly<{
    taskId: string;
    attemptId: string;
    operationId: string;
    authorityBindingId: string;
    outcome: "failed" | "cancelled" | "recovery_required";
    cleanupConfirmed: boolean;
    recoveryObligations: readonly ProjectTaskRecoveryObligation[];
    recoveryUnresolved: boolean;
  }>,
) {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === input.taskId,
  );
  const obligationKinds = new Set<ProjectTaskRecoveryKind>([
    "host",
    "docker",
    "candidate",
    "candidate_store",
    "runtime_process",
  ]);
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "starting" ||
    task.startPhase !== "handoff_prepared" ||
    task.attemptId !== input.attemptId ||
    task.operationId !== input.operationId ||
    task.authorityBindingId !== input.authorityBindingId ||
    (!input.cleanupConfirmed && input.outcome !== "recovery_required") ||
    input.recoveryObligations.some(
      (entry) =>
        !obligationKinds.has(entry.kind) ||
        !validResultReference(entry.recoveryId) ||
        entry.phase !== "required",
    ) ||
    (input.outcome === "recovery_required" &&
      input.recoveryObligations.length === 0 &&
      !input.recoveryUnresolved) ||
    (input.outcome !== "recovery_required" &&
      (input.recoveryObligations.length > 0 || input.recoveryUnresolved))
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_pre_effect_settlement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = state.tasks.map((current) =>
    current.definition.id !== input.taskId
      ? current
      : Object.freeze({
          ...current,
          state: input.outcome,
          startPhase: "settled" as const,
          cleanupConfirmed: input.cleanupConfirmed,
          recoveryObligations: Object.freeze(
            input.recoveryObligations.map((entry) =>
              Object.freeze({ ...entry }),
            ),
          ),
          recoveryUnresolved: input.recoveryUnresolved,
          candidateId: null,
        }),
  );
  const objectives = state.objectives.map((objective) =>
    objective.definition.id === task.definition.objectiveId
      ? Object.freeze({
          ...objective,
          state:
            input.outcome === "cancelled"
              ? ("cancelled" as const)
              : ("blocked" as const),
        })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_pre_effect_task_settled",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state:
          input.outcome === "recovery_required"
            ? ("recovery_required" as const)
            : input.outcome === "cancelled"
              ? ("cancelled" as const)
              : state.milestone.state,
      }),
      objectives: Object.freeze(objectives),
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([input.taskId]),
  });
}

/**
 * 対象Taskの回復義務を、同じ回復参照で回復中へ進める。
 *
 * @responsibility 対象Task・世代・kind・回復参照を照合し、requiredからrecoveringへの純粋遷移を所有する。
 * @trace ARCH-000004
 * @input state: ProjectExecutionState、expectedGeneration: number、taskId: string、kind: ProjectTaskRecoveryKind、recoveryId: string
 * @returns 元状態又は更新候補と、処置したTask集合を返す。
 * @precondition 「state: ProjectExecutionState、expectedGeneration: number、taskId: string、kind: ProjectTaskRecoveryKind、recoveryId: string」がprepareTaskRecoveryStartの入力契約を満たす。
 * @postcondition prepareTaskRecoveryStartの責務を完了した結果だけを返す。
 * @effect N/A: prepareTaskRecoveryStartは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 世代、Task状態、未解決状態、対象kind／recoveryId又はrequired phaseが一致しない場合は、元状態を保持してblockedを返す。
 * @invariant prepareTaskRecoveryStartは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: prepareTaskRecoveryStartはProcess内の同一Subsystemで完結する。
 * @security N/A: prepareTaskRecoveryStartはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: prepareTaskRecoveryStartは共有非同期状態を持たない同期処理である。
 */
export function prepareTaskRecoveryStart(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskId: string,
  kind: ProjectTaskRecoveryKind,
  recoveryId: string,
) {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "recovery_required" ||
    task.recoveryUnresolved ||
    !task.recoveryObligations.some(
      (entry) =>
        entry.kind === kind &&
        entry.recoveryId === recoveryId &&
        entry.phase === "required",
    ) ||
    !validResultReference(recoveryId)
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_recovery_start_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = state.tasks.map((current) =>
    current.definition.id !== taskId
      ? current
      : Object.freeze({
          ...current,
          recoveryObligations: Object.freeze(
            current.recoveryObligations.map((entry) =>
              entry.kind === kind && entry.recoveryId === recoveryId
                ? Object.freeze({ ...entry, phase: "recovering" as const })
                : entry,
            ),
          ),
        }),
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_task_recovery_started",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([taskId]),
  });
}

/**
 * 対象Taskの回復義務を、同じ回復参照で処置済みへ進める。
 *
 * @responsibility Project Task 回復 Obligationの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000004
 * @input state: ProjectExecutionState、expectedGeneration: number、taskId: string、kind: ProjectTaskRecoveryKind、recoveryId: string
 * @returns 元状態又は更新候補と、処置したTask集合を返す。
 * @precondition 「state: ProjectExecutionState、expectedGeneration: number、taskId: string、kind: ProjectTaskRecoveryKind、recoveryId: string」がprepareTaskRecoverySettlementの入力契約を満たす。
 * @postcondition prepareTaskRecoverySettlementの責務を完了した結果だけを返す。
 * @effect N/A: prepareTaskRecoverySettlementは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 世代、Task状態、未解決状態、対象kind／recoveryId又はrecovering phaseが一致しない場合は、元状態を保持してblockedを返す。
 * @invariant prepareTaskRecoverySettlementは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: prepareTaskRecoverySettlementはProcess内の同一Subsystemで完結する。
 * @security N/A: prepareTaskRecoverySettlementはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: prepareTaskRecoverySettlementは共有非同期状態を持たない同期処理である。
 */
export function prepareTaskRecoverySettlement(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskId: string,
  kind: ProjectTaskRecoveryKind,
  recoveryId: string,
) {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "recovery_required" ||
    task.recoveryUnresolved ||
    !task.recoveryObligations.some(
      (entry) =>
        entry.kind === kind &&
        entry.recoveryId === recoveryId &&
        entry.phase === "recovering",
    ) ||
    !validResultReference(recoveryId)
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_recovery_settlement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = state.tasks.map((current) =>
    current.definition.id !== taskId
      ? current
      : Object.freeze({
          ...current,
          recoveryObligations: Object.freeze(
            current.recoveryObligations.map((entry) =>
              entry.kind === kind && entry.recoveryId === recoveryId
                ? Object.freeze({ ...entry, phase: "settled" as const })
                : entry,
            ),
          ),
        }),
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_task_recovery_item_settled",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([taskId]),
  });
}

/**
 * 全回復義務の終端を確認したTaskだけを再試行可能にする。
 *
 * @responsibility Task集合と各義務の終端を照合し、履歴を保持したままreadyへ戻す純粋遷移を所有する。
 * @trace ARCH-000004
 * @input state: ProjectExecutionState、expectedGeneration: number、taskIds: readonly string[]
 * @returns 元状態又は更新候補と、処置したTask集合を返す。
 * @precondition 「state: ProjectExecutionState、expectedGeneration: number、taskIds: readonly string[]」がprepareTaskRecoveryRetryの入力契約を満たす。
 * @postcondition prepareTaskRecoveryRetryの責務を完了した結果だけを返す。
 * @effect N/A: prepareTaskRecoveryRetryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 世代、Task集合、Identity、義務の終端phase又は再試行可能状態が一致しない場合は、元状態を保持してblockedを返す。
 * @invariant prepareTaskRecoveryRetryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: prepareTaskRecoveryRetryはProcess内の同一Subsystemで完結する。
 * @security N/A: prepareTaskRecoveryRetryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: prepareTaskRecoveryRetryは共有非同期状態を持たない同期処理である。
 */
export function prepareTaskRecoveryRetry(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskIds: readonly string[],
) {
  if (
    state.generation !== expectedGeneration ||
    taskIds.length === 0 ||
    new Set(taskIds).size !== taskIds.length ||
    taskIds.some((taskId) => !validId(taskId))
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_recovery_batch_invalid",
      state,
      taskIds: Object.freeze([]),
    });
  if (
    taskIds.some((taskId) => {
      const task = state.tasks.find(
        (candidate) => candidate.definition.id === taskId,
      );
      return (
        !task?.cleanupConfirmed ||
        task.recoveryUnresolved ||
        task.recoveryObligations.length === 0 ||
        task.recoveryObligations.some((entry) => entry.phase !== "settled") ||
        (task.state !== "recovery_required" && task.state !== "ready")
      );
    })
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_recovery_batch_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = state.tasks.map((task) => {
    if (!taskIds.includes(task.definition.id) || task.state === "ready")
      return task;
    return Object.freeze({
      ...task,
      state: "ready" as const,
      attemptId: null,
      operationId: null,
      authorityBindingId: null,
      startPhase: "none" as const,
      cleanupConfirmed: true,
      candidateId: null,
      retryCount: task.retryCount + 1,
    });
  });
  const recoveredObjectiveIds = new Set(
    tasks
      .filter((task) => taskIds.includes(task.definition.id))
      .map((task) => task.definition.objectiveId),
  );
  const objectives = state.objectives.map((objective) =>
    recoveredObjectiveIds.has(objective.definition.id)
      ? Object.freeze({ ...objective, state: "executing" as const })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_task_recoveries_settled_for_retry",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: "executing" as const,
      }),
      objectives: Object.freeze(objectives),
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([...taskIds]),
  });
}

/**
 * Owner喪失時の観測を元Operationの回復参照又は不存在へ結合する。
 *
 * @responsibility 開始前の不存在と開始済みの回復義務を区別し、元Taskの相関を保持する純粋遷移を所有する。
 * @trace ARCH-000004
 * @input state: ProjectExecutionState、expectedGeneration: number、bindings: readonly Readonly<{ operationId: string; status: "matched" | "verified_absent"; recoveryId: string | null; }>[]
 * @returns 元状態又は更新候補と処置したTask集合を返す。
 * @precondition 「state: ProjectExecutionState、expectedGeneration: number、bindings: readonly Readonly<{ operationId: string; status: "matched" | "verified_absent"; recoveryId: string | null; }>[]」がprepareTaskOwnerLossの入力契約を満たす。
 * @postcondition prepareTaskOwnerLossの責務を完了した結果だけを返す。
 * @effect N/A: prepareTaskOwnerLossは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 世代、活動中Task集合、Operationとの件数・Identity・status・recoveryId相関が一致しない場合は、元状態を保持してblockedを返す。
 * @invariant prepareTaskOwnerLossは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: prepareTaskOwnerLossはProcess内の同一Subsystemで完結する。
 * @security N/A: prepareTaskOwnerLossはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: prepareTaskOwnerLossは共有非同期状態を持たない同期処理である。
 */
export function prepareTaskOwnerLoss(
  state: ProjectExecutionState,
  expectedGeneration: number,
  bindings: readonly Readonly<{
    operationId: string;
    status: "matched" | "verified_absent";
    recoveryId: string | null;
  }>[],
) {
  const activeItems = state.tasks.filter((task) =>
    ["starting", "running"].includes(task.state),
  );
  const preparedItems = activeItems.filter((task) => task.operationId !== null);
  const reservedItems = activeItems.filter((task) => task.operationId === null);
  if (
    state.generation !== expectedGeneration ||
    activeItems.length === 0 ||
    preparedItems.length + reservedItems.length !== activeItems.length ||
    bindings.length !== preparedItems.length ||
    new Set(bindings.map((entry) => entry.operationId)).size !==
      bindings.length ||
    bindings.some(
      (entry) =>
        !validId(entry.operationId) ||
        !["matched", "verified_absent"].includes(entry.status) ||
        (entry.status === "matched" &&
          !validResultReference(entry.recoveryId)) ||
        (entry.status === "verified_absent" && entry.recoveryId !== null),
    )
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_owner_loss_recovery_binding_invalid",
      state,
      taskIds: Object.freeze([]),
    });
  const byOperation = new Map(
    bindings.map((entry) => [entry.operationId, entry]),
  );
  if (
    preparedItems.some(
      (task) => task.operationId === null || !byOperation.has(task.operationId),
    ) ||
    preparedItems.some((task) => {
      const binding = task.operationId
        ? byOperation.get(task.operationId)
        : null;
      return task.state === "running" && binding?.status !== "matched";
    })
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_owner_loss_recovery_binding_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = state.tasks.map((task) => {
    if (!activeItems.includes(task)) return task;
    const binding =
      task.operationId === null ? undefined : byOperation.get(task.operationId);
    if (reservedItems.includes(task) || binding?.status === "verified_absent")
      return Object.freeze({
        ...task,
        state: "ready" as const,
        attemptId: null,
        operationId: null,
        authorityBindingId: null,
        startPhase: "none" as const,
        cleanupConfirmed: true,
        recoveryObligations: Object.freeze([]),
        recoveryUnresolved: false,
        candidateId: null,
      });
    return binding?.status === "matched" && binding.recoveryId
      ? Object.freeze({
          ...task,
          state: "recovery_required" as const,
          startPhase: "settled" as const,
          cleanupConfirmed: false,
          recoveryObligations: Object.freeze([
            Object.freeze({
              kind: "docker" as const,
              recoveryId: binding.recoveryId,
              phase: "required" as const,
            }),
          ]),
          recoveryUnresolved: false,
          candidateId: null,
        })
      : task;
  });
  const objectives = state.objectives.map((objective) =>
    tasks.some(
      (task) =>
        task.definition.objectiveId === objective.definition.id &&
        task.state === "recovery_required",
    )
      ? Object.freeze({ ...objective, state: "blocked" as const })
      : reservedItems.some(
            (task) => task.definition.objectiveId === objective.definition.id,
          )
        ? Object.freeze({ ...objective, state: "executing" as const })
        : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_owner_loss_recoveries_bound",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: bindings.some((entry) => entry.status === "matched")
          ? ("recovery_required" as const)
          : ("executing" as const),
      }),
      objectives: Object.freeze(objectives),
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze(activeItems.map((task) => task.definition.id)),
  });
}

/** 元世代の有限更新と、直後状態の同要求再確認を同じ規則で扱う。 @trace ARCH-000004、ARCH-000008 */
export function prepareTaskExecutionUpdate(
  state: ProjectExecutionState,
  expectedGeneration: number,
  request: TaskExecutionUpdate,
) {
  if (request.kind === "task_owner_loss")
    return prepareTaskOwnerLoss(state, expectedGeneration, request.bindings);
  if (request.kind === "task_recovery_retry") {
    if (
      state.generation === expectedGeneration + 1 &&
      request.taskIds.length > 0 &&
      request.taskIds.every((id) => {
        const task = state.tasks.find((item) => item.definition.id === id);
        return (
          task?.state === "ready" &&
          task.startPhase === "none" &&
          task.attemptId === null &&
          task.operationId === null &&
          task.authorityBindingId === null &&
          task.candidateId === null
        );
      })
    ) {
      const replay = prepareTaskRecoveryRetry(
        { ...state, generation: expectedGeneration },
        expectedGeneration,
        request.taskIds,
      );
      if (
        replay.status === "completed" &&
        encodeStateValue(replay.state) === encodeStateValue(state)
      )
        return Object.freeze({
          status: "completed" as const,
          reason: "orchestrator_state_durable",
          state,
          taskIds: Object.freeze([...request.taskIds]),
        });
    }
    return prepareTaskRecoveryRetry(state, expectedGeneration, request.taskIds);
  }
  if ("recoveryKind" in request) {
    const prepare =
      request.kind === "task_recovery_start"
        ? prepareTaskRecoveryStart
        : prepareTaskRecoverySettlement;
    const from =
      request.kind === "task_recovery_start" ? "required" : "recovering";
    const to =
      request.kind === "task_recovery_start" ? "recovering" : "settled";
    const task = state.tasks.find(
      (item) => item.definition.id === request.taskId,
    );
    if (
      state.generation === expectedGeneration + 1 &&
      task?.recoveryObligations.some(
        (item) =>
          item.kind === request.recoveryKind &&
          item.recoveryId === request.recoveryId &&
          item.phase === to,
      )
    ) {
      const replay = prepare(
        {
          ...state,
          generation: expectedGeneration,
          tasks: state.tasks.map((item) =>
            item !== task
              ? item
              : {
                  ...item,
                  recoveryObligations: item.recoveryObligations.map((entry) =>
                    entry.kind === request.recoveryKind &&
                    entry.recoveryId === request.recoveryId
                      ? { ...entry, phase: from }
                      : entry,
                  ),
                },
          ),
        },
        expectedGeneration,
        request.taskId,
        request.recoveryKind,
        request.recoveryId,
      );
      if (
        replay.status === "completed" &&
        encodeStateValue(replay.state) === encodeStateValue(state)
      )
        return Object.freeze({
          status: "completed" as const,
          reason: "orchestrator_state_durable",
          state,
          taskIds: Object.freeze([request.taskId]),
        });
    }
    return prepare(
      state,
      expectedGeneration,
      request.taskId,
      request.recoveryKind,
      request.recoveryId,
    );
  }
  if (request.kind === "task_settle") {
    const task = state.tasks.find(
      (item) => item.definition.id === request.taskId,
    );
    if (
      state.generation === expectedGeneration + 1 &&
      task?.startPhase === "settled"
    ) {
      const replay = prepareTaskSettlement(
        {
          ...state,
          generation: expectedGeneration,
          tasks: state.tasks.map((item) =>
            item === task
              ? { ...item, state: "running", startPhase: "running" }
              : item,
          ),
        },
        expectedGeneration,
        request,
      );
      if (
        replay.status === "completed" &&
        encodeStateValue(replay.state) === encodeStateValue(state)
      )
        return Object.freeze({
          status: "completed" as const,
          reason: "orchestrator_state_durable",
          state,
          taskIds: Object.freeze([request.taskId]),
        });
    }
    return prepareTaskSettlement(state, expectedGeneration, request);
  }
  if (request.kind === "task_settle_before_effect") {
    const task = state.tasks.find(
      (item) => item.definition.id === request.taskId,
    );
    if (
      state.generation === expectedGeneration + 1 &&
      task?.startPhase === "settled"
    ) {
      // 同じ局所規則で終端候補を再構築し、全文一致時だけ既存Writerの耐久再確認へ渡す。
      const replay = prepareTaskPreEffectSettlement(
        {
          ...state,
          generation: expectedGeneration,
          tasks: state.tasks.map((item) =>
            item === task
              ? { ...item, state: "starting", startPhase: "handoff_prepared" }
              : item,
          ),
        },
        expectedGeneration,
        request,
      );
      if (
        replay.status === "completed" &&
        encodeStateValue(replay.state) === encodeStateValue(state)
      )
        return Object.freeze({
          status: "completed" as const,
          reason: "orchestrator_state_durable",
          state,
          taskIds: Object.freeze([request.taskId]),
        });
    }
    return prepareTaskPreEffectSettlement(state, expectedGeneration, request);
  }
  if (request.kind === "task_retry" || request.kind === "task_replan") {
    const taskId =
      request.kind === "task_retry" ? request.taskId : request.failedTaskId;
    const task = state.tasks.find((item) => item.definition.id === taskId);
    const objective = state.objectives.find(
      (item) => item.definition.id === task?.definition.objectiveId,
    );
    let replay =
      Number.isSafeInteger(request.maximumReplans) &&
      request.maximumReplans >= 0 &&
      state.generation === expectedGeneration + 1 &&
      state.milestone.state === "executing" &&
      objective?.state === "executing";
    let taskIds: readonly string[] = [];
    if (request.kind === "task_retry") {
      replay &&=
        Number.isSafeInteger(request.previousRetryCount) &&
        request.previousRetryCount >= 0 &&
        !!task &&
        task.state === "ready" &&
        task.retryCount === request.previousRetryCount + 1 &&
        request.previousRetryCount < request.maximumReplans &&
        task.attemptId === null &&
        task.operationId === null &&
        task.authorityBindingId === null &&
        task.startPhase === "none" &&
        !task.cleanupConfirmed &&
        task.recoveryObligations.length === 0 &&
        !task.recoveryUnresolved &&
        task.candidateId === null;
      taskIds = [request.taskId];
    } else {
      const definitions = request.replacements.map(captureReplanTaskDefinition);
      const replacements = state.tasks.slice(-definitions.length);
      taskIds = definitions.flatMap((item) => (item ? [item.id] : []));
      replay &&=
        !!task &&
        task.state === "superseded" &&
        definitions.length > 0 &&
        definitions.every((item) => item !== null) &&
        task.supersededBy === definitions[0]?.id &&
        objective?.criterionEvidenceIds.length === 0 &&
        state.tasks.filter((item) => item.supersededBy !== null).length <=
          request.maximumReplans &&
        replacements.length === definitions.length &&
        replacements.every(
          (item, index) =>
            encodeStateValue(item.definition) ===
              encodeStateValue(definitions[index]) &&
            item.definition.objectiveId === task.definition.objectiveId &&
            item.state ===
              (item.definition.dependencies.every((id) =>
                state.tasks.some(
                  (other) =>
                    other.definition.id === id && other.state === "completed",
                ),
              )
                ? "ready"
                : "waiting_dependency") &&
            item.attemptId === null &&
            item.operationId === null &&
            item.authorityBindingId === null &&
            item.startPhase === "none" &&
            !item.cleanupConfirmed &&
            item.recoveryObligations.length === 0 &&
            !item.recoveryUnresolved &&
            item.candidateId === null &&
            item.retryCount === 0 &&
            item.supersededBy === null,
        );
    }
    if (replay)
      return Object.freeze({
        status: "completed" as const,
        reason: "orchestrator_state_durable",
        state,
        taskIds: Object.freeze(taskIds),
      });
    return request.kind === "task_retry"
      ? prepareTaskRetry(
          state,
          expectedGeneration,
          request.taskId,
          request.maximumReplans,
          request.previousRetryCount,
        )
      : prepareTaskReplan(state, expectedGeneration, request);
  }
  const task = state.tasks.find(
    (item) => item.definition.id === request.taskId,
  );
  if (
    state.generation === expectedGeneration + 1 &&
    validId(request.taskId) &&
    validId(request.attemptId) &&
    task?.attemptId === request.attemptId &&
    (request.kind === "task_start"
      ? validId(request.authorityBindingId) &&
        task.state === "starting" &&
        task.startPhase === "reserved" &&
        task.authorityBindingId === request.authorityBindingId &&
        task.operationId === null
      : task.operationId === request.operationId &&
        (request.kind === "task_handoff"
          ? task.state === "starting" && task.startPhase === "handoff_prepared"
          : task.state === "running" && task.startPhase === "running"))
  )
    return Object.freeze({
      status: "completed" as const,
      reason: "orchestrator_state_durable",
      state,
      taskIds: Object.freeze([request.taskId]),
    });
  return request.kind === "task_start"
    ? prepareTaskStart(
        state,
        expectedGeneration,
        request.taskId,
        request.attemptId,
        request.authorityBindingId,
      )
    : (request.kind === "task_handoff"
        ? prepareTaskHandoff
        : prepareTaskStarted)(
        state,
        expectedGeneration,
        request.taskId,
        request.attemptId,
        request.operationId,
      );
}
/**
 * 管理Taskの有限更新要求を独立捕捉する。
 * @responsibility 用途別の正確なfield集合を確認し、Getter・Proxy・未知fieldを実行せず拒否する。
 * @trace ARCH-000004、ARCH-000008
 * @invariant 値の捕捉を現在状態との相関・保存・実Task開始と扱わない。
 */
export function captureTaskExecutionUpdate(
  input: unknown,
): TaskExecutionUpdate | null {
  const start = snapshotStateRecord(
    input,
    new Set(["kind", "projectId", "taskId", "attemptId", "authorityBindingId"]),
  );
  const phase =
    start ??
    snapshotStateRecord(
      input,
      new Set(["kind", "projectId", "taskId", "attemptId", "operationId"]),
    );
  const retry = snapshotStateRecord(
    input,
    new Set([
      "kind",
      "projectId",
      "taskId",
      "maximumReplans",
      "previousRetryCount",
    ]),
  );
  const replan = snapshotStateRecord(
    input,
    new Set([
      "kind",
      "projectId",
      "failedTaskId",
      "replacements",
      "maximumReplans",
    ]),
  );
  const settlement = snapshotStateRecord(
    input,
    new Set([
      "kind",
      "projectId",
      "taskId",
      "attemptId",
      "operationId",
      "authorityBindingId",
      "outcome",
      "cleanupConfirmed",
      "recoveryObligations",
      "recoveryUnresolved",
    ]),
  );
  const runningSettlementWithCandidate = snapshotStateRecord(
    input,
    new Set([
      "kind",
      "projectId",
      "taskId",
      "attemptId",
      "operationId",
      "authorityBindingId",
      "outcome",
      "cleanupConfirmed",
      "recoveryObligations",
      "recoveryUnresolved",
      "candidateId",
      "resultUnresolved",
    ]),
  );
  const runningSettlement =
    runningSettlementWithCandidate ??
    snapshotStateRecord(
      input,
      new Set([
        "kind",
        "projectId",
        "taskId",
        "attemptId",
        "operationId",
        "authorityBindingId",
        "outcome",
        "cleanupConfirmed",
        "recoveryObligations",
        "recoveryUnresolved",
        "resultUnresolved",
      ]),
    );
  const recovery = snapshotStateRecord(
    input,
    new Set(["kind", "projectId", "taskId", "recoveryKind", "recoveryId"]),
  );
  const recoveryRetry = snapshotStateRecord(
    input,
    new Set(["kind", "projectId", "taskIds"]),
  );
  const ownerLoss = snapshotStateRecord(
    input,
    new Set(["kind", "projectId", "bindings"]),
  );
  const ownerBindings = snapshotStateArray(
    ownerLoss?.bindings,
    Number.MAX_SAFE_INTEGER,
  );
  const command =
    phase ??
    retry ??
    replan ??
    settlement ??
    runningSettlement ??
    recovery ??
    recoveryRetry ??
    ownerLoss;
  if (
    !command ||
    !validId(command.projectId) ||
    !(
      (ownerLoss?.kind === "task_owner_loss" &&
        ownerBindings.status === "ok" &&
        ownerBindings.value.every(
          (entry) =>
            snapshotStateRecord(
              entry,
              new Set(["operationId", "status", "recoveryId"]),
            ) !== null,
        )) ||
      ((recovery?.kind === "task_recovery_start" ||
        recovery?.kind === "task_recovery_settle") &&
        validId(recovery.taskId) &&
        validResultReference(recovery.recoveryId) &&
        [
          "docker",
          "host",
          "candidate",
          "candidate_store",
          "runtime_process",
        ].includes(recovery.recoveryKind as string)) ||
      (recoveryRetry?.kind === "task_recovery_retry" &&
        Array.isArray(recoveryRetry.taskIds)) ||
      start?.kind === "task_start" ||
      (start === null &&
        (phase?.kind === "task_handoff" || phase?.kind === "task_started")) ||
      (retry?.kind === "task_retry" &&
        Number.isSafeInteger(retry.previousRetryCount) &&
        (retry.previousRetryCount as number) >= 0) ||
      replan?.kind === "task_replan" ||
      (settlement?.kind === "task_settle_before_effect" &&
        ["failed", "cancelled", "recovery_required"].includes(
          settlement.outcome as string,
        ) &&
        typeof settlement.cleanupConfirmed === "boolean" &&
        typeof settlement.recoveryUnresolved === "boolean" &&
        Array.isArray(settlement.recoveryObligations)) ||
      (runningSettlement?.kind === "task_settle" &&
        typeof runningSettlement.resultUnresolved === "boolean" &&
        typeof runningSettlement.cleanupConfirmed === "boolean" &&
        typeof runningSettlement.recoveryUnresolved === "boolean" &&
        Array.isArray(runningSettlement.recoveryObligations) &&
        ["completed", "failed", "cancelled", "recovery_required"].includes(
          runningSettlement.outcome as string,
        ))
    )
  )
    return null;
  try {
    const normalized =
      runningSettlement?.kind === "task_settle"
        ? {
            ...command,
            candidateId:
              Object.getOwnPropertyDescriptor(runningSettlement, "candidateId")
                ?.value ?? null,
          }
        : command;
    return Object.freeze(
      JSON.parse(encodeStateValue(normalized)),
    ) as TaskExecutionUpdate;
  } catch {
    return null;
  }
}

/** 同じTaskの開始予約規則を元の拒否順で適用する。 @trace ARCH-000004、ARCH-000008 */
export function prepareTaskStart(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskId: string,
  attemptId: string,
  authorityBindingId: string,
) {
  if (
    state.generation !== expectedGeneration ||
    !validId(taskId) ||
    !validId(attemptId) ||
    !validId(authorityBindingId)
  ) {
    return Object.freeze({
      status: "blocked" as const,
      reason: "orchestrator_generation_or_identity_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  if (!observeTaskStartCandidates(state).taskIds.includes(taskId)) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_not_schedulable",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = state.tasks.map((task) =>
    task.definition.id === taskId
      ? Object.freeze({
          ...task,
          state: "starting" as const,
          attemptId,
          authorityBindingId,
          operationId: null,
          startPhase: "reserved" as const,
          recoveryObligations: Object.freeze([]),
          recoveryUnresolved: false,
        })
      : task,
  );
  const objectiveId = tasks.find((task) => task.definition.id === taskId)
    ?.definition.objectiveId;
  const objectives = state.objectives.map((objective) =>
    objective.definition.id === objectiveId && objective.state === "planned"
      ? Object.freeze({ ...objective, state: "executing" as const })
      : objective,
  );
  return Object.freeze({
    status: "completed" as const,
    reason: "orchestrator_task_start_reserved",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state:
          state.milestone.state === "planned"
            ? ("executing" as const)
            : state.milestone.state,
      }),
      objectives: Object.freeze(objectives),
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([taskId]),
  });
}

/**
 * 開始予約を引渡し準備済みへ進める。
 * @responsibility 元の世代・phase・Identityを照合し一世代の候補だけを作る。
 * @trace ARCH-000004、ARCH-000008
 * @invariant 候補を保存又は実Process開始の証明にしない。
 */
export function prepareTaskHandoff(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskId: string,
  attemptId: string,
  operationId: string,
) {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "starting" ||
    task.startPhase !== "reserved" ||
    task.attemptId !== attemptId ||
    !validId(operationId)
  ) {
    return Object.freeze({
      status: "blocked" as const,
      reason: "orchestrator_task_handoff_preparation_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = state.tasks.map((current) =>
    current.definition.id === taskId
      ? Object.freeze({
          ...current,
          operationId,
          startPhase: "handoff_prepared" as const,
        })
      : current,
  );
  return Object.freeze({
    status: "completed" as const,
    reason: "orchestrator_task_handoff_prepared",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([taskId]),
  });
}

/**
 * 同じTask・Attempt・Operationの開始観測を状態へ結合する。
 * @responsibility 元の世代・phase・Identityを照合し一世代の候補だけを作る。
 * @trace ARCH-000004、ARCH-000008
 * @invariant 候補を保存又は実Process開始の証明にしない。
 */
export function prepareTaskStarted(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskId: string,
  attemptId: string,
  operationId: string,
) {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "starting" ||
    task.startPhase !== "handoff_prepared" ||
    task.attemptId !== attemptId ||
    task.operationId !== operationId
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "orchestrator_task_start_observation_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = state.tasks.map((current) =>
    current.definition.id === taskId
      ? Object.freeze({
          ...current,
          state: "running" as const,
          startPhase: "running" as const,
        })
      : current,
  );
  return Object.freeze({
    status: "completed" as const,
    reason: "orchestrator_task_started",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([taskId]),
  });
}

function activeForCapacity(task: ProjectTaskRecord) {
  return (
    task.state === "starting" ||
    task.state === "running" ||
    task.state === "cleanup_pending" ||
    (task.state === "recovery_required" && !task.cleanupConfirmed)
  );
}

function reservesConflict(task: ProjectTaskRecord) {
  return (
    activeForCapacity(task) ||
    (task.state === "recovery_required" &&
      (task.recoveryUnresolved || task.recoveryObligations.length > 0))
  );
}

function normalizedConflictPaths(task: ProjectTaskRecord) {
  return task.definition.allowedPaths.map((value) =>
    value.replace(/\/+$/u, "").toUpperCase(),
  );
}

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

function selectSchedulableProjectTasks(
  state: ProjectExecutionState,
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
