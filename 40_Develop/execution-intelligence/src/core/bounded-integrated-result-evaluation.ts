/**
 * bounded-integrated-result-evaluationに属する責務をまとめる。
 *
 * @responsibility IntegratedResultObservationを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000007
 */
import {
  inspectExecutionIntelligenceEvent,
  type ExecutionIntelligenceEvent,
  type ExecutionObservation,
} from "./execution-intelligence.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../boundary/plain-data-snapshot.ts";

export const BOUNDED_INTEGRATED_RESULT_EVALUATION_INPUT_CONTRACT =
  "crdd/bounded-integrated-result-evaluation-input/v1" as const;
export const BOUNDED_INTEGRATED_RESULT_EVALUATION_CONTRACT =
  "crdd/bounded-integrated-result-evaluation/v1" as const;

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const MAXIMUM_TASKS = 128;
const MAXIMUM_EVIDENCE_IDS = 128;

/**
 * bounded-integrated-result-evaluationで使用するIntegrated 結果 Observationの値契約を定義する。
 *
 * @responsibility Integrated 結果 ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape IntegratedResultObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant IntegratedResultObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: IntegratedResultObservationの宣言は外部境界を開かない。
 * @security N/A: IntegratedResultObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility IntegratedResultObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type IntegratedResultObservation = ExecutionObservation<
  Readonly<{
    result: "accepted" | "rejected";
    evidenceIds: readonly string[];
  }>
>;
/**
 * bounded-integrated-result-evaluationで使用するCount Observationの値契約を定義する。
 *
 * @responsibility Count ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape CountObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CountObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CountObservationの宣言は外部境界を開かない。
 * @security N/A: CountObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CountObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CountObservation = ExecutionObservation<number>;

/**
 * bounded-integrated-result-evaluationで使用するBounded Integrated 結果 Evaluation 入力の値契約を定義する。
 *
 * @responsibility Bounded Integrated 結果 Evaluation 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape BoundedIntegratedResultEvaluationInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant BoundedIntegratedResultEvaluationInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: BoundedIntegratedResultEvaluationInputの宣言は外部境界を開かない。
 * @security N/A: BoundedIntegratedResultEvaluationInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility BoundedIntegratedResultEvaluationInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * bounded-integrated-result-evaluationで使用するBounded Integrated 結果 Evaluationの値契約を定義する。
 *
 * @responsibility Bounded Integrated 結果 EvaluationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape BoundedIntegratedResultEvaluationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant BoundedIntegratedResultEvaluationで宣言した値と責務の対応を維持する。
 * @boundary N/A: BoundedIntegratedResultEvaluationの宣言は外部境界を開かない。
 * @security N/A: BoundedIntegratedResultEvaluationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility BoundedIntegratedResultEvaluationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * idを決定する。
 *
 * @responsibility idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がidの入力契約を満たす。
 * @postcondition idの責務を完了した結果だけを返す。
 * @effect N/A: idは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: idは独自の失敗分岐を所有しない。
 * @invariant idは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: idはProcess内の同一Subsystemで完結する。
 * @security N/A: idはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: idは共有非同期状態を持たない同期処理である。
 */
function id(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

/**
 * bounded-integrated-result-evaluationの件数を算出する。
 *
 * @responsibility bounded-integrated-result-evaluationの計数対象、集計規則、件数結果境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown
 * @returns value is numberを返す。
 * @precondition 「value: unknown」がcountの入力契約を満たす。
 * @postcondition countの責務を完了した結果だけを返す。
 * @effect N/A: countは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: countは独自の失敗分岐を所有しない。
 * @invariant countは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: countはProcess内の同一Subsystemで完結する。
 * @security N/A: countはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: countは共有非同期状態を持たない同期処理である。
 */
function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

/**
 * bounded-integrated-result-evaluationを表示文字列へ変換する。
 *
 * @responsibility bounded-integrated-result-evaluationの入力値、文字列表現、機密を含めない結果境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がtextの入力契約を満たす。
 * @postcondition textの責務を完了した結果だけを返す。
 * @effect N/A: textは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: textは独自の失敗分岐を所有しない。
 * @invariant textは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: textはProcess内の同一Subsystemで完結する。
 * @security N/A: textはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: textは共有非同期状態を持たない同期処理である。
 */
function text(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    !value.includes("\0")
  );
}

/**
 * Observationを観測する。
 *
 * @responsibility Observationの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown、inspectValue: (entry: unknown) => T | null
 * @returns ExecutionObservation<T> | nullを返す。
 * @precondition 「value: unknown、inspectValue: (entry: unknown) => T | null」がinspectObservationの入力契約を満たす。
 * @postcondition inspectObservationの責務を完了した結果だけを返す。
 * @effect N/A: inspectObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectObservationは独自の失敗分岐を所有しない。
 * @invariant inspectObservationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectObservationはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectObservationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectObservationは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Integrated 結果を観測する。
 *
 * @responsibility Integrated 結果の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown
 * @returns IntegratedResultObservation | nullを返す。
 * @precondition 「value: unknown」がinspectIntegratedResultの入力契約を満たす。
 * @postcondition inspectIntegratedResultの責務を完了した結果だけを返す。
 * @effect N/A: inspectIntegratedResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectIntegratedResultは独自の失敗分岐を所有しない。
 * @invariant inspectIntegratedResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectIntegratedResultはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectIntegratedResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectIntegratedResultは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Measurementsを観測する。
 *
 * @responsibility Measurementsの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown
 * @returns BoundedIntegratedResultEvaluationInput["measurements"] | nullを返す。
 * @precondition 「value: unknown」がinspectMeasurementsの入力契約を満たす。
 * @postcondition inspectMeasurementsの責務を完了した結果だけを返す。
 * @effect N/A: inspectMeasurementsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectMeasurementsは独自の失敗分岐を所有しない。
 * @invariant inspectMeasurementsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectMeasurementsはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectMeasurementsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectMeasurementsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Bounded Integrated 結果 Evaluation 入力を観測する。
 *
 * @responsibility Bounded Integrated 結果 Evaluation 入力の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown
 * @returns BoundedIntegratedResultEvaluationInput | nullを返す。
 * @precondition 「value: unknown」がinspectBoundedIntegratedResultEvaluationInputの入力契約を満たす。
 * @postcondition inspectBoundedIntegratedResultEvaluationInputの責務を完了した結果だけを返す。
 * @effect N/A: inspectBoundedIntegratedResultEvaluationInputは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectBoundedIntegratedResultEvaluationInputは独自の失敗分岐を所有しない。
 * @invariant inspectBoundedIntegratedResultEvaluationInputは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectBoundedIntegratedResultEvaluationInputはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectBoundedIntegratedResultEvaluationInputはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectBoundedIntegratedResultEvaluationInputは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Bounded Integrated 結果を評価する。
 *
 * @responsibility Bounded Integrated 結果の評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown
 * @returns BoundedIntegratedResultEvaluation | nullを返す。
 * @precondition 「value: unknown」がevaluateBoundedIntegratedResultの入力契約を満たす。
 * @postcondition evaluateBoundedIntegratedResultの責務を完了した結果だけを返す。
 * @effect N/A: evaluateBoundedIntegratedResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: evaluateBoundedIntegratedResultは独自の失敗分岐を所有しない。
 * @invariant evaluateBoundedIntegratedResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateBoundedIntegratedResultはProcess内の同一Subsystemで完結する。
 * @security N/A: evaluateBoundedIntegratedResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: evaluateBoundedIntegratedResultは共有非同期状態を持たない同期処理である。
 */
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
