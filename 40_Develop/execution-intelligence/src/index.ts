/**
 * CRDD採用RepositoryとRuntime向けに、Provider非依存の実行記録と評価を公開する。
 * 構造化メタデータだけを扱い、Provider SDKの観測、同意、情報分類と対象作業への結合は利用側が所有する。
 * @packageDocumentation
 * @responsibility 実行観測をProvider非依存の記録と評価へ変換する。
 * @trace ARCH-000007
 * @boundary Provider実行境界から受け取った観測とCRDD記録の境界。
 * @effect 検証済みRepository Root内へ実行Eventを追記し得る。
 */
export {
  createTaskAttemptSettledEvent,
  createOperationSettledEvent,
  notApplicable,
  notObserved,
  usageNotObserved,
  observed,
} from "./record/event.ts";
export {
  classifyExecutionUsageCompleteness,
  inspectExecutionIntelligenceEvent,
} from "./record/validation.ts";
export { summarizeExecutionIntelligence } from "./record/summary.ts";
export { EXECUTION_INTELLIGENCE_EVENT_CONTRACT } from "./record/types.ts";
export type {
  ExecutionIntelligenceEvent,
  TaskAttemptExecutionIntelligenceEvent,
  OperationExecutionIntelligenceEvent,
  OperationSettledEventInput,
  ExecutionDiagnostic,
  ExecutionIntelligenceSummary,
  ExecutionObservation,
  ExecutionUsage,
  TaskAttemptSettledEventInput,
} from "./record/types.ts";
export { proposeExecutionImprovementCandidates } from "./evaluation/improvement-candidates.ts";

export {
  createExecutionIntelligenceRecorder,
  type ExecutionIntelligenceRecorder,
} from "./record/recorder.ts";

export {
  projectExecutionRecords,
  type ExecutionRecordProjectionInput,
  type ExecutionRecordProjectionResult,
} from "./projection/execution.ts";

export {
  projectTemporalRecords,
  readAndProjectRecordState,
  type RecordStateProjectionResult,
  type TemporalClockSource,
  type TemporalRecordProjectionInput,
  type TemporalRecordProjectionResult,
} from "./projection/temporal.ts";

export {
  BOUNDED_INTEGRATED_RESULT_EVALUATION_CONTRACT,
  BOUNDED_INTEGRATED_RESULT_EVALUATION_INPUT_CONTRACT,
  evaluateBoundedIntegratedResult,
  inspectBoundedIntegratedResultEvaluationInput,
  type BoundedIntegratedResultEvaluation,
  type BoundedIntegratedResultEvaluationInput,
} from "./evaluation/integrated-result.ts";

export {
  classifyTemporalProvenance,
  type TemporalProvenanceInput,
  type TemporalProvenanceResult,
} from "./projection/temporal.ts";

export {
  readExecutionIntelligence,
  writeExecutionIntelligenceEvent,
} from "./storage/store.ts";
export type { ExecutionIntelligencePublicationResult } from "./storage/result.ts";

export {
  verifyExecutionIntelligenceRepositoryRoot,
  type VerifiedExecutionRepositoryRoot,
} from "./record/recorder.ts";
