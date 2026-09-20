/**
 * Public, provider-neutral Execution Intelligence boundary for CRDD-adopted
 * repositories and runtimes. It exposes structured metadata only; callers own
 * provider SDK interception, consent, classification and Work binding.
 * @packageDocumentation
 * @responsibility 実行観測をProvider非依存の記録と評価へ変換する。
 * @trace ARCH-000007
 * @boundary Provider実行境界から受け取った観測とCRDD記録の境界。
 * @effect 検証済みRepository Root内へ実行Eventを追記し得る。
 */
export {
  createTaskAttemptSettledEvent,
  EXECUTION_INTELLIGENCE_EVENT_CONTRACT,
  inspectExecutionIntelligenceEvent,
  notApplicable,
  notObserved,
  observed,
  proposeExecutionImprovementCandidates,
  summarizeExecutionIntelligence,
  type ExecutionIntelligenceEvent,
  type ExecutionIntelligenceSummary,
  type ExecutionObservation,
  type ExecutionUsage,
  type TaskAttemptSettledEventInput,
  usageNotObserved,
} from "./core/execution-intelligence.ts";

export {
  createExecutionIntelligenceRecorder,
  type ExecutionIntelligenceRecorder,
} from "./application/execution-intelligence-recorder.ts";

export {
  BOUNDED_INTEGRATED_RESULT_EVALUATION_CONTRACT,
  BOUNDED_INTEGRATED_RESULT_EVALUATION_INPUT_CONTRACT,
  evaluateBoundedIntegratedResult,
  inspectBoundedIntegratedResultEvaluationInput,
  type BoundedIntegratedResultEvaluation,
  type BoundedIntegratedResultEvaluationInput,
} from "./core/bounded-integrated-result-evaluation.ts";

export {
  readExecutionIntelligence,
  writeExecutionIntelligenceEvent,
  type ExecutionIntelligencePublicationResult,
} from "./store/execution-intelligence-store.ts";

export {
  verifyExecutionIntelligenceRepositoryRoot,
  type VerifiedExecutionRepositoryRoot,
} from "./store/verified-repository-root.ts";
