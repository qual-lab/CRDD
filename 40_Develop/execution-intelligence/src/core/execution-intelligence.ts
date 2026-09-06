import { createHash } from "node:crypto";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../internal/plain-data-snapshot.ts";

export const EXECUTION_INTELLIGENCE_EVENT_CONTRACT =
  "crdd/execution-intelligence-event/v1" as const;

export type ExecutionObservation<T> =
  | Readonly<{ state: "observed"; value: T; source: string }>
  | Readonly<{ state: "not_observed"; reason: string }>
  | Readonly<{ state: "not_applicable"; reason: string }>;

export type ExecutionUsage = Readonly<{
  inputTokens: ExecutionObservation<number>;
  outputTokens: ExecutionObservation<number>;
  cacheReadTokens: ExecutionObservation<number>;
  cacheWriteTokens: ExecutionObservation<number>;
  costOrCredits: ExecutionObservation<
    Readonly<{ amount: number; unit: string }>
  >;
}>;

export type ExecutionIntelligenceEvent = Readonly<{
  contract: typeof EXECUTION_INTELLIGENCE_EVENT_CONTRACT;
  eventId: string;
  eventType: "task_attempt_settled";
  occurredAt: string;
  identity: Readonly<{
    projectId: string;
    milestoneId: string;
    objectiveId: string;
    taskId: string;
    attemptId: string;
    operationId: string;
  }>;
  execution: Readonly<{
    role: string;
    provider: ExecutionObservation<string>;
    model: ExecutionObservation<string>;
    inputStrategyRef: ExecutionObservation<string>;
    durationMs: ExecutionObservation<number>;
    usage: ExecutionUsage;
    humanActiveMs: ExecutionObservation<number>;
  }>;
  outcome: Readonly<{
    status: "completed" | "blocked" | "cancelled" | "unknown";
    reason: string;
    effectState: "no_effect" | "settled" | "unknown";
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
  }>;
  quality: ExecutionObservation<
    Readonly<{
      result: "accepted" | "rejected";
      evidenceIds: readonly string[];
    }>
  >;
}>;

export type TaskAttemptSettledEventInput = Readonly<{
  occurredAt: string;
  identity: ExecutionIntelligenceEvent["identity"];
  execution: ExecutionIntelligenceEvent["execution"];
  outcome: ExecutionIntelligenceEvent["outcome"];
  quality: ExecutionIntelligenceEvent["quality"];
}>;

export function observed<T>(value: T, source: string): ExecutionObservation<T> {
  return Object.freeze({ state: "observed" as const, value, source });
}

export function notObserved(reason: string): ExecutionObservation<never> {
  return Object.freeze({ state: "not_observed" as const, reason });
}

export function notApplicable(reason: string): ExecutionObservation<never> {
  return Object.freeze({ state: "not_applicable" as const, reason });
}

export function usageNotObserved(reason: string): ExecutionUsage {
  return Object.freeze({
    inputTokens: notObserved(reason),
    outputTokens: notObserved(reason),
    cacheReadTokens: notObserved(reason),
    cacheWriteTokens: notObserved(reason),
    costOrCredits: notObserved(reason),
  });
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
function text(value: unknown, maximum = 512): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !value.includes("\0")
  );
}

function identity(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function nonnegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function observation<T>(
  value: unknown,
  inspectObserved: (observed: unknown) => T | null,
): ExecutionObservation<T> | null {
  const observedSnapshot = snapshotPlainRecord(
    value,
    new Set(["source", "state", "value"] as const),
  );
  if (
    observedSnapshot?.state === "observed" &&
    text(observedSnapshot.source, 128)
  ) {
    const inspected = inspectObserved(observedSnapshot.value);
    return inspected === null
      ? null
      : Object.freeze({
          state: "observed" as const,
          value: inspected,
          source: observedSnapshot.source,
        });
  }
  const absentSnapshot = snapshotPlainRecord(
    value,
    new Set(["reason", "state"] as const),
  );
  return absentSnapshot &&
    (absentSnapshot.state === "not_observed" ||
      absentSnapshot.state === "not_applicable") &&
    text(absentSnapshot.reason, 256)
    ? Object.freeze({
        state: absentSnapshot.state,
        reason: absentSnapshot.reason,
      })
    : null;
}

export function inspectExecutionIntelligenceEvent(
  value: unknown,
): ExecutionIntelligenceEvent | null {
  try {
    const event = snapshotPlainRecord(
      value,
      new Set([
        "contract",
        "eventId",
        "eventType",
        "execution",
        "identity",
        "occurredAt",
        "outcome",
        "quality",
      ] as const),
    );
    if (!event) return null;
    const identitySnapshot = snapshotPlainRecord(
      event.identity,
      new Set([
        "attemptId",
        "milestoneId",
        "objectiveId",
        "operationId",
        "projectId",
        "taskId",
      ] as const),
    );
    const executionSnapshot = snapshotPlainRecord(
      event.execution,
      new Set([
        "durationMs",
        "humanActiveMs",
        "inputStrategyRef",
        "model",
        "provider",
        "role",
        "usage",
      ] as const),
    );
    const outcomeSnapshot = snapshotPlainRecord(
      event.outcome,
      new Set([
        "cleanupConfirmed",
        "effectState",
        "manualRecoveryRequired",
        "processRestartRequired",
        "reason",
        "status",
      ] as const),
    );
    if (!identitySnapshot || !executionSnapshot || !outcomeSnapshot)
      return null;
    const usageSnapshot = snapshotPlainRecord(
      executionSnapshot.usage,
      new Set([
        "cacheReadTokens",
        "cacheWriteTokens",
        "costOrCredits",
        "inputTokens",
        "outputTokens",
      ] as const),
    );
    if (!usageSnapshot) return null;
    const provider = observation(executionSnapshot.provider, (entry) =>
      identity(entry) ? entry : null,
    );
    const model = observation(executionSnapshot.model, (entry) =>
      text(entry, 128) ? entry : null,
    );
    const inputStrategyRef = observation(
      executionSnapshot.inputStrategyRef,
      (entry) => (text(entry, 256) ? entry : null),
    );
    const durationMs = observation(executionSnapshot.durationMs, (entry) =>
      count(entry) ? entry : null,
    );
    const humanActiveMs = observation(
      executionSnapshot.humanActiveMs,
      (entry) => (count(entry) ? entry : null),
    );
    const inputTokens = observation(usageSnapshot.inputTokens, (entry) =>
      count(entry) ? entry : null,
    );
    const outputTokens = observation(usageSnapshot.outputTokens, (entry) =>
      count(entry) ? entry : null,
    );
    const cacheReadTokens = observation(
      usageSnapshot.cacheReadTokens,
      (entry) => (count(entry) ? entry : null),
    );
    const cacheWriteTokens = observation(
      usageSnapshot.cacheWriteTokens,
      (entry) => (count(entry) ? entry : null),
    );
    const costOrCredits = observation(usageSnapshot.costOrCredits, (entry) => {
      const cost = snapshotPlainRecord(
        entry,
        new Set(["amount", "unit"] as const),
      );
      return cost && nonnegativeNumber(cost.amount) && identity(cost.unit)
        ? Object.freeze({ amount: cost.amount, unit: cost.unit })
        : null;
    });
    const quality = observation(event.quality, (entry) => {
      const qualitySnapshot = snapshotPlainRecord(
        entry,
        new Set(["evidenceIds", "result"] as const),
      );
      if (
        !qualitySnapshot ||
        (qualitySnapshot.result !== "accepted" &&
          qualitySnapshot.result !== "rejected")
      )
        return null;
      const evidence = snapshotPlainArray(qualitySnapshot.evidenceIds, 64);
      if (evidence.status !== "ok" || !evidence.value.every(identity))
        return null;
      return Object.freeze({
        result: qualitySnapshot.result,
        evidenceIds: Object.freeze([...evidence.value]),
      });
    });
    if (
      event.contract !== EXECUTION_INTELLIGENCE_EVENT_CONTRACT ||
      event.eventType !== "task_attempt_settled" ||
      !identity(event.eventId) ||
      !text(event.occurredAt, 64) ||
      Number.isNaN(Date.parse(event.occurredAt)) ||
      !Object.values(identitySnapshot).every(identity) ||
      !identity(executionSnapshot.role) ||
      !provider ||
      !model ||
      !inputStrategyRef ||
      !durationMs ||
      !humanActiveMs ||
      !inputTokens ||
      !outputTokens ||
      !cacheReadTokens ||
      !cacheWriteTokens ||
      !costOrCredits ||
      !quality ||
      !["completed", "blocked", "cancelled", "unknown"].includes(
        String(outcomeSnapshot.status),
      ) ||
      !["no_effect", "settled", "unknown"].includes(
        String(outcomeSnapshot.effectState),
      ) ||
      !text(outcomeSnapshot.reason, 512) ||
      typeof outcomeSnapshot.cleanupConfirmed !== "boolean" ||
      typeof outcomeSnapshot.manualRecoveryRequired !== "boolean" ||
      typeof outcomeSnapshot.processRestartRequired !== "boolean"
    )
      return null;
    return Object.freeze({
      contract: EXECUTION_INTELLIGENCE_EVENT_CONTRACT,
      eventId: event.eventId,
      eventType: "task_attempt_settled" as const,
      occurredAt: event.occurredAt,
      identity: Object.freeze({
        ...identitySnapshot,
      }) as ExecutionIntelligenceEvent["identity"],
      execution: Object.freeze({
        role: executionSnapshot.role,
        provider,
        model,
        inputStrategyRef,
        durationMs,
        usage: Object.freeze({
          inputTokens,
          outputTokens,
          cacheReadTokens,
          cacheWriteTokens,
          costOrCredits,
        }),
        humanActiveMs,
      }) as ExecutionIntelligenceEvent["execution"],
      outcome: Object.freeze({
        ...outcomeSnapshot,
      }) as ExecutionIntelligenceEvent["outcome"],
      quality,
    });
  } catch {
    return null;
  }
}

export function createTaskAttemptSettledEvent(
  input: TaskAttemptSettledEventInput,
): ExecutionIntelligenceEvent {
  const eventId = `execution-${createHash("sha256")
    .update(
      [
        input.identity.projectId,
        input.identity.milestoneId,
        input.identity.objectiveId,
        input.identity.taskId,
        input.identity.attemptId,
        input.identity.operationId,
      ].join("\0"),
    )
    .digest("hex")}`;
  const event = {
    contract: EXECUTION_INTELLIGENCE_EVENT_CONTRACT,
    eventId,
    eventType: "task_attempt_settled" as const,
    occurredAt: input.occurredAt,
    identity: input.identity,
    execution: input.execution,
    outcome: input.outcome,
    quality: input.quality,
  };
  const inspected = inspectExecutionIntelligenceEvent(event);
  if (!inspected) throw new Error("execution_intelligence_event_invalid");
  return inspected;
}

export type ExecutionIntelligenceSummary = Readonly<{
  contract: "crdd/execution-intelligence-summary/v1";
  eventCount: number;
  completedCount: number;
  blockedCount: number;
  cancelledCount: number;
  unknownCount: number;
  observedDurationCount: number;
  totalObservedDurationMs: number | null;
  providerObservationCount: number;
  usageObservedEventCount: number;
  usageFullyObservedEventCount: number;
  observedUsageFieldCount: number;
  humanActiveObservationCount: number;
  qualityObservationCount: number;
  missingnessPreserved: true;
}>;

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
    missingnessPreserved: true as const,
  });
}

export function proposeExecutionImprovementCandidates(
  events: readonly unknown[],
) {
  const inspectedEvents = events.map(inspectExecutionIntelligenceEvent);
  if (inspectedEvents.some((event) => event === null)) return null;
  const validEvents = inspectedEvents as ExecutionIntelligenceEvent[];
  const summary = summarizeExecutionIntelligence(validEvents);
  if (!summary) return null;
  const candidates: Array<
    Readonly<{ kind: string; basis: string; basisEventIds: readonly string[] }>
  > = [];
  if (summary.blockedCount + summary.unknownCount > 0)
    candidates.push(
      Object.freeze({
        kind: "investigate_noncompleted_attempts",
        basis: "blocked_or_unknown_attempt_observed",
        basisEventIds: Object.freeze(
          validEvents
            .filter(
              (event) =>
                event.outcome.status === "blocked" ||
                event.outcome.status === "unknown",
            )
            .map((event) => event.eventId),
        ),
      }),
    );
  if (summary.providerObservationCount < summary.eventCount)
    candidates.push(
      Object.freeze({
        kind: "improve_provider_observation",
        basis: "provider_identity_not_observed_for_all_attempts",
        basisEventIds: Object.freeze(
          validEvents
            .filter((event) => event.execution.provider.state !== "observed")
            .map((event) => event.eventId),
        ),
      }),
    );
  return Object.freeze({
    contract: "crdd/execution-improvement-candidates/v1" as const,
    status: "proposal" as const,
    authorityConferred: false as const,
    automaticChangeAllowed: false as const,
    summary,
    candidates: Object.freeze(candidates),
  });
}
