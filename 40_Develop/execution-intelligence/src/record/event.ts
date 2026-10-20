/**
 * 観測値と単発実行・Task試行のEventを構築する。
 * @responsibility 観測値と単発実行・Task試行のEventを構築する。
 * @trace ARCH-000007
 */

import type {
  ExecutionObservation,
  ExecutionUsage,
  TaskAttemptSettledEventInput,
  TaskAttemptExecutionIntelligenceEvent,
  OperationSettledEventInput,
  OperationExecutionIntelligenceEvent,
} from "./types.ts";
import {
  EXECUTION_INTELLIGENCE_EVENT_CONTRACT,
  snapshotPlainRecord,
  identity,
  taskAttemptIdentityKeys,
  taskAttemptEventId,
  inspectExecutionIntelligenceEvent,
  operationEventId,
} from "./validation.ts";

/**
 * not Observedを決定する。
 *
 * @responsibility not Observedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000007
 * @input reason: string
 * @returns ExecutionObservation<never>を返す。
 * @precondition 「reason: string」がnotObservedの入力契約を満たす。
 * @postcondition notObservedの責務を完了した結果だけを返す。
 * @effect N/A: notObservedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: notObservedは独自の失敗分岐を所有しない。
 * @invariant notObservedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: notObservedはProcess内の同一Subsystemで完結する。
 * @security N/A: notObservedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: notObservedは共有非同期状態を持たない同期処理である。
 */
export function notObserved(reason: string): ExecutionObservation<never> {
  return Object.freeze({ state: "not_observed" as const, reason });
}

/**
 * not Applicableを決定する。
 *
 * @responsibility not Applicableの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000007
 * @input reason: string
 * @returns ExecutionObservation<never>を返す。
 * @precondition 「reason: string」がnotApplicableの入力契約を満たす。
 * @postcondition notApplicableの責務を完了した結果だけを返す。
 * @effect N/A: notApplicableは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: notApplicableは独自の失敗分岐を所有しない。
 * @invariant notApplicableは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: notApplicableはProcess内の同一Subsystemで完結する。
 * @security N/A: notApplicableはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: notApplicableは共有非同期状態を持たない同期処理である。
 */
export function notApplicable(reason: string): ExecutionObservation<never> {
  return Object.freeze({ state: "not_applicable" as const, reason });
}

/**
 * usage Not Observedを決定する。
 *
 * @responsibility usage Not Observedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000007
 * @input reason: string
 * @returns ExecutionUsageを返す。
 * @precondition 「reason: string」がusageNotObservedの入力契約を満たす。
 * @postcondition usageNotObservedの責務を完了した結果だけを返す。
 * @effect N/A: usageNotObservedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: usageNotObservedは独自の失敗分岐を所有しない。
 * @invariant usageNotObservedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: usageNotObservedはProcess内の同一Subsystemで完結する。
 * @security N/A: usageNotObservedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: usageNotObservedは共有非同期状態を持たない同期処理である。
 */
export function usageNotObserved(reason: string): ExecutionUsage {
  return Object.freeze({
    inputTokens: notObserved(reason),
    outputTokens: notObserved(reason),
    cacheReadTokens: notObserved(reason),
    cacheWriteTokens: notObserved(reason),
    costOrCredits: notObserved(reason),
  });
}

/**
 * Task Attempt Settled Eventを構築する。
 *
 * @responsibility Task Attempt Settled Eventの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000007
 * @input input: TaskAttemptSettledEventInput
 * @returns ExecutionIntelligenceEventを返す。
 * @precondition 「input: TaskAttemptSettledEventInput」がcreateTaskAttemptSettledEventの入力契約を満たす。
 * @postcondition createTaskAttemptSettledEventの責務を完了した結果だけを返す。
 * @effect N/A: createTaskAttemptSettledEventは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createTaskAttemptSettledEventは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createTaskAttemptSettledEventは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createTaskAttemptSettledEventはProcess内の同一Subsystemで完結する。
 * @security N/A: createTaskAttemptSettledEventはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createTaskAttemptSettledEventは共有非同期状態を持たない同期処理である。
 */
export function createTaskAttemptSettledEvent(
  input: TaskAttemptSettledEventInput,
): TaskAttemptExecutionIntelligenceEvent {
  const inputSnapshot = snapshotPlainRecord(
    input,
    new Set(["execution", "identity", "occurredAt", "outcome", "quality"]),
  );
  if (!inputSnapshot) throw new Error("execution_intelligence_event_invalid");
  const identitySnapshot = snapshotPlainRecord(
    inputSnapshot.identity,
    taskAttemptIdentityKeys,
  );
  if (!identitySnapshot || !Object.values(identitySnapshot).every(identity))
    throw new Error("execution_intelligence_event_invalid");
  const canonicalIdentity = Object.freeze({
    ...identitySnapshot,
  }) as TaskAttemptExecutionIntelligenceEvent["identity"];
  const event = {
    contract: EXECUTION_INTELLIGENCE_EVENT_CONTRACT,
    eventId: taskAttemptEventId(canonicalIdentity),
    eventType: "task_attempt_settled" as const,
    occurredAt: inputSnapshot.occurredAt,
    identity: canonicalIdentity,
    execution: completeExecutionObservations(inputSnapshot.execution),
    outcome: inputSnapshot.outcome,
    quality: inputSnapshot.quality,
  };
  const inspected = inspectExecutionIntelligenceEvent(event);
  if (inspected?.eventType !== "task_attempt_settled")
    throw new Error("execution_intelligence_event_invalid");
  return inspected;
}

/**
 * 構築入力の省略された追加観測を明示的な未観測へ変換する。
 * @responsibility 現行の構築入力で省略可能な追加観測を明示的な未観測へ接続する。
 * @trace ARCH-000007
 * @input 未信頼execution入力。
 * @returns 検査前の完全shapeまたはnull。
 * @precondition N/A: 任意値を受け取る。
 * @postcondition 値を推定せず未観測理由を保持する。
 * @effect N/A: 局所コピーのみ。
 * @failure accessorや追加fieldは拒否する。
 * @invariant 保存済みv1記録の互換Readerではない。
 * @boundary 公開constructorの値境界。
 * @security getterを実行しない。
 * @concurrency N/A: 同期処理。
 */
function completeExecutionObservations(value: unknown): unknown {
  const entry = snapshotPlainRecord(
    value,
    new Set([
      "role",
      "provider",
      "model",
      "inputStrategyRef",
      "durationMs",
      "usage",
      "humanActiveMs",
    ]),
    new Set([
      "profileId",
      "profileRevision",
      "reasoningEffort",
      "overrideApplied",
      "parentExecutionId",
      "diagnostic",
    ]),
  );
  if (!entry) return null;
  return {
    ...entry,
    profileId: Object.hasOwn(entry, "profileId")
      ? entry.profileId
      : notObserved("profile_not_reported"),
    profileRevision: Object.hasOwn(entry, "profileRevision")
      ? entry.profileRevision
      : notObserved("profile_revision_not_reported"),
    reasoningEffort: Object.hasOwn(entry, "reasoningEffort")
      ? entry.reasoningEffort
      : notObserved("reasoning_effort_not_reported"),
    overrideApplied: Object.hasOwn(entry, "overrideApplied")
      ? entry.overrideApplied
      : notObserved("override_not_reported"),
    parentExecutionId: Object.hasOwn(entry, "parentExecutionId")
      ? entry.parentExecutionId
      : notObserved("parent_execution_not_reported"),
    diagnostic: Object.hasOwn(entry, "diagnostic")
      ? entry.diagnostic
      : notObserved("diagnostic_not_reported"),
  };
}

/**
 * Taskを捏造せず任意Operationの終端観測を構築する。
 * @responsibility 任意Operation入力をv2の検査へ接続する。
 * @trace ARCH-000007
 * @input OperationSettledEventInput。
 * @returns 検査済みOperationイベント。
 * @precondition 3つのIdentityと共通観測が有効である。
 * @postcondition 新Identityだけを持つ不変イベントを返す。
 * @effect N/A: 値構築のみ。
 * @failure 不正入力はexecution_intelligence_event_invalid。
 * @invariant Task Identityを追加しない。
 * @boundary 公開constructorの値境界。
 * @security 生出力やAuthorityを保持しない。
 * @concurrency N/A: 共有状態なし。
 */
export function createOperationSettledEvent(
  input: OperationSettledEventInput,
): OperationExecutionIntelligenceEvent {
  const entry = snapshotPlainRecord(
    input,
    new Set(["execution", "identity", "occurredAt", "outcome", "quality"]),
  );
  const ids = entry
    ? snapshotPlainRecord(
        entry.identity,
        new Set(["projectId", "operationId", "executionId"]),
      )
    : null;
  if (!entry || !ids || !Object.values(ids).every(identity))
    throw new Error("execution_intelligence_event_invalid");
  const canonicalIdentity = Object.freeze({
    ...ids,
  }) as OperationExecutionIntelligenceEvent["identity"];
  const inspected = inspectExecutionIntelligenceEvent({
    contract: EXECUTION_INTELLIGENCE_EVENT_CONTRACT,
    eventType: "operation_settled",
    eventId: operationEventId(canonicalIdentity),
    occurredAt: entry.occurredAt,
    identity: canonicalIdentity,
    execution: completeExecutionObservations(entry.execution),
    outcome: entry.outcome,
    quality: entry.quality,
  });
  if (inspected?.eventType !== "operation_settled")
    throw new Error("execution_intelligence_event_invalid");
  return inspected;
}

/**
 * observedを決定する。
 *
 * @responsibility observedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000007
 * @input value: T、source: string
 * @returns ExecutionObservation<T>を返す。
 * @precondition 「value: T、source: string」がobservedの入力契約を満たす。
 * @postcondition observedの責務を完了した結果だけを返す。
 * @effect N/A: observedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observedは独自の失敗分岐を所有しない。
 * @invariant observedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observedはProcess内の同一Subsystemで完結する。
 * @security N/A: observedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: observedは共有非同期状態を持たない同期処理である。
 */
export function observed<T>(value: T, source: string): ExecutionObservation<T> {
  return Object.freeze({ state: "observed" as const, value, source });
}
