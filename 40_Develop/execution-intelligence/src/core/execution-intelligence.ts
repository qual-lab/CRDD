import { createHash } from "node:crypto";

export const EXECUTION_INTELLIGENCE_EVENT_CONTRACT =
  "crdd/execution-intelligence-event/v1" as const;

export type ExecutionObservation<T> =
  | Readonly<{ state: "observed"; value: T; source: string }>
  | Readonly<{ state: "not_observed"; reason: string }>
  | Readonly<{ state: "not_applicable"; reason: string }>;

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
    usage: ExecutionObservation<
      Readonly<{
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        costOrCredits: number;
      }>
    >;
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

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const OBSERVATION_STATES = new Set([
  "observed",
  "not_observed",
  "not_applicable",
]);

function plain(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actualKeys = Object.keys(value).sort();
  return (
    actualKeys.length === keys.length &&
    [...keys].sort().every((key, index) => key === actualKeys[index])
  );
}

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

function freezeData(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  for (const member of Object.values(value)) freezeData(member);
  if (!Object.isFrozen(value)) Object.freeze(value);
}

function observation(
  value: unknown,
  inspectObserved: (observed: unknown) => boolean,
) {
  if (!plain(value) || !OBSERVATION_STATES.has(String(value.state)))
    return false;
  if (value.state === "observed")
    return (
      exactKeys(value, ["source", "state", "value"]) &&
      text(value.source, 128) &&
      inspectObserved(value.value)
    );
  return exactKeys(value, ["reason", "state"]) && text(value.reason, 256);
}

export function inspectExecutionIntelligenceEvent(
  value: unknown,
): ExecutionIntelligenceEvent | null {
  try {
    if (
      !plain(value) ||
      !exactKeys(value, [
        "contract",
        "eventId",
        "eventType",
        "execution",
        "identity",
        "occurredAt",
        "outcome",
        "quality",
      ]) ||
      value.contract !== EXECUTION_INTELLIGENCE_EVENT_CONTRACT ||
      value.eventType !== "task_attempt_settled" ||
      !identity(value.eventId) ||
      !text(value.occurredAt, 64) ||
      Number.isNaN(Date.parse(value.occurredAt)) ||
      !plain(value.identity) ||
      !exactKeys(value.identity, [
        "attemptId",
        "milestoneId",
        "objectiveId",
        "operationId",
        "projectId",
        "taskId",
      ]) ||
      !Object.values(value.identity).every(identity) ||
      !plain(value.execution) ||
      !exactKeys(value.execution, [
        "durationMs",
        "humanActiveMs",
        "inputStrategyRef",
        "model",
        "provider",
        "role",
        "usage",
      ]) ||
      !identity(value.execution.role) ||
      !observation(value.execution.provider, (entry) => identity(entry)) ||
      !observation(value.execution.model, (entry) => text(entry, 128)) ||
      !observation(value.execution.inputStrategyRef, (entry) =>
        text(entry, 256),
      ) ||
      !observation(value.execution.durationMs, count) ||
      !observation(value.execution.humanActiveMs, count) ||
      !observation(value.execution.usage, (entry) => {
        if (!plain(entry)) return false;
        return (
          exactKeys(entry, [
            "cacheReadTokens",
            "costOrCredits",
            "inputTokens",
            "outputTokens",
          ]) && Object.values(entry).every(count)
        );
      }) ||
      !plain(value.outcome) ||
      !exactKeys(value.outcome, [
        "cleanupConfirmed",
        "effectState",
        "manualRecoveryRequired",
        "processRestartRequired",
        "reason",
        "status",
      ]) ||
      !["completed", "blocked", "cancelled", "unknown"].includes(
        String(value.outcome.status),
      ) ||
      !["no_effect", "settled", "unknown"].includes(
        String(value.outcome.effectState),
      ) ||
      !text(value.outcome.reason, 512) ||
      typeof value.outcome.cleanupConfirmed !== "boolean" ||
      typeof value.outcome.manualRecoveryRequired !== "boolean" ||
      typeof value.outcome.processRestartRequired !== "boolean" ||
      !observation(value.quality, (entry) => {
        if (!plain(entry) || !exactKeys(entry, ["evidenceIds", "result"]))
          return false;
        return (
          (entry.result === "accepted" || entry.result === "rejected") &&
          Array.isArray(entry.evidenceIds) &&
          entry.evidenceIds.length <= 64 &&
          entry.evidenceIds.every(identity)
        );
      })
    )
      return null;
    freezeData(value);
    return value as ExecutionIntelligenceEvent;
  } catch {
    return null;
  }
}

export function createTaskAttemptSettledEvent(
  input: Readonly<{
    occurredAt: string;
    identity: ExecutionIntelligenceEvent["identity"];
    execution: ExecutionIntelligenceEvent["execution"];
    outcome: ExecutionIntelligenceEvent["outcome"];
    quality: ExecutionIntelligenceEvent["quality"];
  }>,
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
    identity: Object.freeze({ ...input.identity }),
    execution: Object.freeze({ ...input.execution }),
    outcome: Object.freeze({ ...input.outcome }),
    quality: Object.freeze({ ...input.quality }),
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
  usageObservationCount: number;
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
  return Object.freeze({
    contract: "crdd/execution-intelligence-summary/v1" as const,
    eventCount: validEvents.length,
    completedCount: statusCount("completed"),
    blockedCount: statusCount("blocked"),
    cancelledCount: statusCount("cancelled"),
    unknownCount: statusCount("unknown"),
    observedDurationCount: durationValues.length,
    totalObservedDurationMs:
      durationValues.length === 0
        ? null
        : durationValues.reduce((sum, value) => sum + value, 0),
    providerObservationCount: validEvents.filter(
      (event) => event.execution.provider.state === "observed",
    ).length,
    usageObservationCount: validEvents.filter(
      (event) => event.execution.usage.state === "observed",
    ).length,
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
