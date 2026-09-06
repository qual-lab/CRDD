import {
  inspectExecutionIntelligenceEvent,
  type ExecutionIntelligenceEvent,
  type ExecutionObservation,
} from "./execution-intelligence.ts";

export const BOUNDED_INTEGRATED_RESULT_EVALUATION_INPUT_CONTRACT =
  "crdd/bounded-integrated-result-evaluation-input/v1" as const;
export const BOUNDED_INTEGRATED_RESULT_EVALUATION_CONTRACT =
  "crdd/bounded-integrated-result-evaluation/v1" as const;

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const MAXIMUM_TASKS = 128;
const MAXIMUM_EVIDENCE_IDS = 128;

type IntegratedResultObservation = ExecutionObservation<
  Readonly<{
    result: "accepted" | "rejected";
    evidenceIds: readonly string[];
  }>
>;
type CountObservation = ExecutionObservation<number>;

export type BoundedIntegratedResultEvaluationInput = Readonly<{
  contract: typeof BOUNDED_INTEGRATED_RESULT_EVALUATION_INPUT_CONTRACT;
  evaluationId: string;
  projectId: string;
  milestoneId: string;
  expectedTaskIds: readonly string[];
  taskAttemptEvents: readonly ExecutionIntelligenceEvent[];
  integratedResult: IntegratedResultObservation;
  measurements: Readonly<{
    timeToAcceptedResultMs: CountObservation;
    humanActiveMs: CountObservation;
    reviewLoopCount: CountObservation;
    remediationCount: CountObservation;
    retryCount: CountObservation;
    integrationConflictCount: CountObservation;
    postIntegrationFindingCount: CountObservation;
  }>;
}>;

export type BoundedIntegratedResultEvaluation = Readonly<{
  contract: typeof BOUNDED_INTEGRATED_RESULT_EVALUATION_CONTRACT;
  evaluationId: string;
  projectId: string;
  milestoneId: string;
  status: "completed" | "incomplete";
  reason:
    | "integrated_result_evaluation_completed"
    | "integrated_result_not_observed"
    | "expected_task_attempt_not_observed";
  integratedAcceptedResult: boolean | null;
  integratedEvidenceIds: readonly string[];
  expectedTaskCount: number;
  observedTaskCount: number;
  missingTaskIds: readonly string[];
  attemptCount: number;
  noncompletedAttemptCount: number;
  providerAttemptCounts: Readonly<Record<string, number>>;
  providerNotObservedCount: number;
  measurements: BoundedIntegratedResultEvaluationInput["measurements"];
  taskSuccessIsIntegrationAcceptance: false;
  authorityConferred: false;
  missingnessPreserved: true;
}>;

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
  const expectedKeys = [...keys].sort();
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key, index) => key === actualKeys[index])
  );
}

function id(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function text(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    !value.includes("\0")
  );
}

function inspectObservation<T>(
  value: unknown,
  inspectValue: (entry: unknown) => T | null,
): ExecutionObservation<T> | null {
  if (!plain(value) || typeof value.state !== "string") return null;
  if (value.state === "observed") {
    if (!exactKeys(value, ["source", "state", "value"]) || !text(value.source))
      return null;
    const inspected = inspectValue(value.value);
    return inspected === null
      ? null
      : Object.freeze({
          state: "observed" as const,
          value: inspected,
          source: value.source,
        });
  }
  if (
    (value.state === "not_observed" || value.state === "not_applicable") &&
    exactKeys(value, ["reason", "state"]) &&
    text(value.reason)
  )
    return Object.freeze({ state: value.state, reason: value.reason });
  return null;
}

function inspectIntegratedResult(
  value: unknown,
): IntegratedResultObservation | null {
  return inspectObservation(value, (entry) => {
    if (
      !plain(entry) ||
      !exactKeys(entry, ["evidenceIds", "result"]) ||
      (entry.result !== "accepted" && entry.result !== "rejected") ||
      !Array.isArray(entry.evidenceIds) ||
      entry.evidenceIds.length > MAXIMUM_EVIDENCE_IDS ||
      !entry.evidenceIds.every(id) ||
      new Set(entry.evidenceIds).size !== entry.evidenceIds.length
    )
      return null;
    return Object.freeze({
      result: entry.result,
      evidenceIds: Object.freeze([...entry.evidenceIds]),
    });
  });
}

function inspectMeasurements(
  value: unknown,
): BoundedIntegratedResultEvaluationInput["measurements"] | null {
  const keys = [
    "humanActiveMs",
    "integrationConflictCount",
    "postIntegrationFindingCount",
    "remediationCount",
    "retryCount",
    "reviewLoopCount",
    "timeToAcceptedResultMs",
  ] as const;
  if (!plain(value) || !exactKeys(value, keys)) return null;
  const inspected = Object.fromEntries(
    keys.map((key) => [
      key,
      inspectObservation(value[key], (entry) => (count(entry) ? entry : null)),
    ]),
  ) as Record<(typeof keys)[number], CountObservation | null>;
  if (keys.some((key) => inspected[key] === null)) return null;
  return Object.freeze(
    Object.fromEntries(keys.map((key) => [key, inspected[key]])),
  ) as BoundedIntegratedResultEvaluationInput["measurements"];
}

export function inspectBoundedIntegratedResultEvaluationInput(
  value: unknown,
): BoundedIntegratedResultEvaluationInput | null {
  if (
    !plain(value) ||
    !exactKeys(value, [
      "contract",
      "evaluationId",
      "expectedTaskIds",
      "integratedResult",
      "measurements",
      "milestoneId",
      "projectId",
      "taskAttemptEvents",
    ]) ||
    value.contract !== BOUNDED_INTEGRATED_RESULT_EVALUATION_INPUT_CONTRACT ||
    !id(value.evaluationId) ||
    !id(value.projectId) ||
    !id(value.milestoneId) ||
    !Array.isArray(value.expectedTaskIds) ||
    value.expectedTaskIds.length === 0 ||
    value.expectedTaskIds.length > MAXIMUM_TASKS ||
    !value.expectedTaskIds.every(id) ||
    new Set(value.expectedTaskIds).size !== value.expectedTaskIds.length ||
    !Array.isArray(value.taskAttemptEvents) ||
    value.taskAttemptEvents.length > MAXIMUM_TASKS * 33
  )
    return null;
  const expectedTaskIds = value.expectedTaskIds as string[];
  const events = value.taskAttemptEvents.map(inspectExecutionIntelligenceEvent);
  const integratedResult = inspectIntegratedResult(value.integratedResult);
  const measurements = inspectMeasurements(value.measurements);
  if (
    events.some((entry) => entry === null) ||
    !integratedResult ||
    !measurements ||
    new Set(events.map((entry) => entry?.eventId)).size !== events.length
  )
    return null;
  const exactEvents = events as ExecutionIntelligenceEvent[];
  if (
    exactEvents.some(
      (event) =>
        event.identity.projectId !== value.projectId ||
        event.identity.milestoneId !== value.milestoneId ||
        !expectedTaskIds.includes(event.identity.taskId),
    )
  )
    return null;
  return Object.freeze({
    contract: BOUNDED_INTEGRATED_RESULT_EVALUATION_INPUT_CONTRACT,
    evaluationId: value.evaluationId,
    projectId: value.projectId,
    milestoneId: value.milestoneId,
    expectedTaskIds: Object.freeze([...expectedTaskIds]),
    taskAttemptEvents: Object.freeze(exactEvents),
    integratedResult,
    measurements,
  });
}

export function evaluateBoundedIntegratedResult(
  value: unknown,
): BoundedIntegratedResultEvaluation | null {
  const input = inspectBoundedIntegratedResultEvaluationInput(value);
  if (!input) return null;
  const observedTaskIds = new Set(
    input.taskAttemptEvents.map((event) => event.identity.taskId),
  );
  const missingTaskIds = input.expectedTaskIds.filter(
    (taskId) => !observedTaskIds.has(taskId),
  );
  const providerAttemptCounts: Record<string, number> = {};
  let providerNotObservedCount = 0;
  for (const event of input.taskAttemptEvents) {
    if (event.execution.provider.state !== "observed") {
      providerNotObservedCount += 1;
      continue;
    }
    const provider = event.execution.provider.value;
    providerAttemptCounts[provider] =
      (providerAttemptCounts[provider] ?? 0) + 1;
  }
  const isIntegratedAcceptedResult =
    input.integratedResult.state === "observed"
      ? input.integratedResult.value.result === "accepted"
      : null;
  const status =
    missingTaskIds.length === 0 && isIntegratedAcceptedResult !== null
      ? "completed"
      : "incomplete";
  const reason =
    missingTaskIds.length > 0
      ? "expected_task_attempt_not_observed"
      : isIntegratedAcceptedResult === null
        ? "integrated_result_not_observed"
        : "integrated_result_evaluation_completed";
  return Object.freeze({
    contract: BOUNDED_INTEGRATED_RESULT_EVALUATION_CONTRACT,
    evaluationId: input.evaluationId,
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    status,
    reason,
    integratedAcceptedResult: isIntegratedAcceptedResult,
    integratedEvidenceIds:
      input.integratedResult.state === "observed"
        ? input.integratedResult.value.evidenceIds
        : Object.freeze([]),
    expectedTaskCount: input.expectedTaskIds.length,
    observedTaskCount: observedTaskIds.size,
    missingTaskIds: Object.freeze(missingTaskIds),
    attemptCount: input.taskAttemptEvents.length,
    noncompletedAttemptCount: input.taskAttemptEvents.filter(
      (event) => event.outcome.status !== "completed",
    ).length,
    providerAttemptCounts: Object.freeze(providerAttemptCounts),
    providerNotObservedCount,
    measurements: input.measurements,
    taskSuccessIsIntegrationAcceptance: false,
    authorityConferred: false,
    missingnessPreserved: true,
  });
}
