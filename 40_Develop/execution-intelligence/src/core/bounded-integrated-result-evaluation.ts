import {
  inspectExecutionIntelligenceEvent,
  type ExecutionIntelligenceEvent,
  type ExecutionObservation,
} from "./execution-intelligence.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../internal/plain-data-snapshot.ts";

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
  const observed = snapshotPlainRecord(
    value,
    new Set(["source", "state", "value"] as const),
  );
  if (observed?.state === "observed") {
    if (!text(observed.source)) return null;
    const inspected = inspectValue(observed.value);
    return inspected === null
      ? null
      : Object.freeze({
          state: "observed" as const,
          value: inspected,
          source: observed.source,
        });
  }
  const absent = snapshotPlainRecord(
    value,
    new Set(["reason", "state"] as const),
  );
  if (
    absent &&
    (absent.state === "not_observed" || absent.state === "not_applicable") &&
    text(absent.reason)
  )
    return Object.freeze({ state: absent.state, reason: absent.reason });
  return null;
}

function inspectIntegratedResult(
  value: unknown,
): IntegratedResultObservation | null {
  return inspectObservation(value, (entry) => {
    const result = snapshotPlainRecord(
      entry,
      new Set(["evidenceIds", "result"] as const),
    );
    const evidence = result
      ? snapshotPlainArray(result.evidenceIds, MAXIMUM_EVIDENCE_IDS)
      : { status: "blocked" as const, value: null };
    if (
      !result ||
      (result.result !== "accepted" && result.result !== "rejected") ||
      evidence.status !== "ok" ||
      !evidence.value.every(id) ||
      new Set(evidence.value).size !== evidence.value.length
    )
      return null;
    return Object.freeze({
      result: result.result,
      evidenceIds: Object.freeze([...evidence.value]),
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
  const measurements = snapshotPlainRecord(value, new Set(keys));
  if (!measurements) return null;
  const inspected = Object.fromEntries(
    keys.map((key) => [
      key,
      inspectObservation(measurements[key], (entry) =>
        count(entry) ? entry : null,
      ),
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
  const input = snapshotPlainRecord(
    value,
    new Set([
      "contract",
      "evaluationId",
      "expectedTaskIds",
      "integratedResult",
      "measurements",
      "milestoneId",
      "projectId",
      "taskAttemptEvents",
    ] as const),
  );
  if (!input) return null;
  const expectedTaskIds = snapshotPlainArray<string>(
    input.expectedTaskIds,
    MAXIMUM_TASKS,
  );
  const taskAttemptEvents = snapshotPlainArray(
    input.taskAttemptEvents,
    MAXIMUM_TASKS * 33,
  );
  if (
    input.contract !== BOUNDED_INTEGRATED_RESULT_EVALUATION_INPUT_CONTRACT ||
    !id(input.evaluationId) ||
    !id(input.projectId) ||
    !id(input.milestoneId) ||
    expectedTaskIds.status !== "ok" ||
    expectedTaskIds.value.length === 0 ||
    !expectedTaskIds.value.every(id) ||
    new Set(expectedTaskIds.value).size !== expectedTaskIds.value.length ||
    taskAttemptEvents.status !== "ok"
  )
    return null;
  const events = taskAttemptEvents.value.map(inspectExecutionIntelligenceEvent);
  const integratedResult = inspectIntegratedResult(input.integratedResult);
  const measurements = inspectMeasurements(input.measurements);
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
        event.identity.projectId !== input.projectId ||
        event.identity.milestoneId !== input.milestoneId ||
        !expectedTaskIds.value.includes(event.identity.taskId),
    )
  )
    return null;
  return Object.freeze({
    contract: BOUNDED_INTEGRATED_RESULT_EVALUATION_INPUT_CONTRACT,
    evaluationId: input.evaluationId,
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    expectedTaskIds: Object.freeze([...expectedTaskIds.value]),
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
  const providerAttempts = new Map<string, number>();
  let providerNotObservedCount = 0;
  for (const event of input.taskAttemptEvents) {
    if (event.execution.provider.state !== "observed") {
      providerNotObservedCount += 1;
      continue;
    }
    const provider = event.execution.provider.value;
    providerAttempts.set(provider, (providerAttempts.get(provider) ?? 0) + 1);
  }
  const providerAttemptCounts = Object.fromEntries(
    [...providerAttempts.entries()].sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );
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
