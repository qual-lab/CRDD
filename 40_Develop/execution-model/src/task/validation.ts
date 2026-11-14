/**
 * Task・Queue・単独実行状態の値検査と純粋な遷移・投影を所有する。
 * @responsibility I/Oや新しい権限を発行せず、モデル固有の受入条件を判定する。
 * @trace ARCH-000008
 */
import { types } from "node:util";
import type {
  ExecutionStateSnapshot,
  ProjectExecutionState,
} from "../state/types.ts";
import {
  HASH,
  hasStateKeys,
  isStateObject,
  nullableCandidateId,
  nullableId,
  nullableRecoveryId,
  nullableResultReference,
  REVISION,
  snapshotStateArray,
  stringArray,
  validId,
  isPrincipalId,
  snapshotStateRecord,
} from "../state/operations.ts";
import type {
  ExecutionSelection,
  ProjectQueueEntry,
  ProjectQueueState,
  ProjectTaskRecoveryObligation,
  SingleTaskRecord,
  TaskExecutionSelections,
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
      !nullableRecoveryId(entry.recoveryId) ||
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
