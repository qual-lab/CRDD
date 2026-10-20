/**
 * 検査済みEvent群の実績と欠測を集計する。
 * @responsibility 検査済みEvent群の実績と欠測を集計する。
 * @trace ARCH-000007
 */

import type {
  ExecutionIntelligenceSummary,
  ExecutionIntelligenceEvent,
} from "./types.ts";
import {
  inspectExecutionIntelligenceEvent,
  classifyExecutionUsageCompleteness,
} from "./validation.ts";

/**
 * Execution Intelligenceを要約する。
 *
 * @responsibility Execution Intelligenceの集計対象、要約規則、公開結果境界を所有する。
 * @trace ARCH-000007
 * @input values: readonly unknown[]
 * @returns ExecutionIntelligenceSummary | nullを返す。
 * @precondition 「values: readonly unknown[]」がsummarizeExecutionIntelligenceの入力契約を満たす。
 * @postcondition summarizeExecutionIntelligenceの責務を完了した結果だけを返す。
 * @effect N/A: summarizeExecutionIntelligenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: summarizeExecutionIntelligenceは独自の失敗分岐を所有しない。
 * @invariant summarizeExecutionIntelligenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: summarizeExecutionIntelligenceはProcess内の同一Subsystemで完結する。
 * @security N/A: summarizeExecutionIntelligenceはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: summarizeExecutionIntelligenceは共有非同期状態を持たない同期処理である。
 */
export function summarizeExecutionIntelligence(
  values: readonly unknown[],
): ExecutionIntelligenceSummary | null {
  const events = values.map(inspectExecutionIntelligenceEvent);
  if (events.some((entry) => entry === null)) return null;
  const validEvents = events as ExecutionIntelligenceEvent[];
  if (
    new Set(validEvents.map((event) => event.eventId)).size !==
    validEvents.length
  )
    return null;
  const durationValues = validEvents.flatMap((event) =>
    event.execution.durationMs.state === "observed"
      ? [event.execution.durationMs.value]
      : [],
  );
  const statusCount = (
    status: ExecutionIntelligenceEvent["outcome"]["status"],
  ) => validEvents.filter((event) => event.outcome.status === status).length;
  let totalObservedDurationMs: number | null = null;
  if (durationValues.length > 0) {
    let total = 0;
    for (const value of durationValues) {
      const next: number = total + value;
      if (!Number.isSafeInteger(next)) return null;
      total = next;
    }
    totalObservedDurationMs = total;
  }
  return Object.freeze({
    contract: "crdd/execution-intelligence-summary/v1" as const,
    eventCount: validEvents.length,
    completedCount: statusCount("completed"),
    blockedCount: statusCount("blocked"),
    cancelledCount: statusCount("cancelled"),
    unknownCount: statusCount("unknown"),
    observedDurationCount: durationValues.length,
    totalObservedDurationMs,
    providerObservationCount: validEvents.filter(
      (event) => event.execution.provider.state === "observed",
    ).length,
    usageObservedEventCount: validEvents.filter((event) =>
      Object.values(event.execution.usage).some(
        (entry) => entry.state === "observed",
      ),
    ).length,
    usageFullyObservedEventCount: validEvents.filter((event) =>
      Object.values(event.execution.usage).every(
        (entry) => entry.state === "observed",
      ),
    ).length,
    observedUsageFieldCount: validEvents.reduce(
      (count, event) =>
        count +
        Object.values(event.execution.usage).filter(
          (entry) => entry.state === "observed",
        ).length,
      0,
    ),
    humanActiveObservationCount: validEvents.filter(
      (event) => event.execution.humanActiveMs.state === "observed",
    ).length,
    qualityObservationCount: validEvents.filter(
      (event) => event.quality.state === "observed",
    ).length,
    diagnosticObservationCount: validEvents.filter(
      (event) => event.execution.diagnostic.state === "observed",
    ).length,
    assignmentFullyObservedEventCount: validEvents.filter((event) =>
      [
        event.execution.provider,
        event.execution.model,
        event.execution.profileId,
        event.execution.profileRevision,
        event.execution.reasoningEffort,
        event.execution.overrideApplied,
      ].every((entry) => entry.state === "observed"),
    ).length,
    usageCompleteEventCount: validEvents.filter(
      (event) =>
        classifyExecutionUsageCompleteness(event.execution.usage) ===
        "complete",
    ).length,
    usagePartialEventCount: validEvents.filter(
      (event) =>
        classifyExecutionUsageCompleteness(event.execution.usage) === "partial",
    ).length,
    usageNotApplicableEventCount: validEvents.filter(
      (event) =>
        classifyExecutionUsageCompleteness(event.execution.usage) ===
        "not_applicable",
    ).length,
    costObservationCount: validEvents.filter(
      (event) => event.execution.usage.costOrCredits.state === "observed",
    ).length,
    missingnessPreserved: true as const,
  });
}
