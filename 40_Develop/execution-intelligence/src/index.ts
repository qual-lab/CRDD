/**
 * Public, provider-neutral Execution Intelligence boundary for CRDD-adopted
 * repositories and runtimes. It exposes structured metadata only; callers own
 * provider SDK interception, consent, classification and Work binding.
 */
export {
  createTaskAttemptSettledEvent,
  EXECUTION_INTELLIGENCE_EVENT_CONTRACT,
  inspectExecutionIntelligenceEvent,
  proposeExecutionImprovementCandidates,
  summarizeExecutionIntelligence,
  type ExecutionIntelligenceEvent,
  type ExecutionIntelligenceSummary,
  type ExecutionObservation,
} from "./core/execution-intelligence.ts";

export {
  applyExecutionIntelligenceRetention,
  readExecutionIntelligence,
  writeExecutionIntelligenceEvent,
  type ExecutionIntelligencePublicationResult,
} from "./store/execution-intelligence-store.ts";

export {
  verifyExecutionIntelligenceRepositoryRoot,
  type VerifiedExecutionRepositoryRoot,
} from "./store/verified-repository-root.ts";
