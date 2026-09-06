import {
  createTaskAttemptSettledEvent,
  type ExecutionIntelligenceEvent,
  type TaskAttemptSettledEventInput,
} from "../core/execution-intelligence.ts";
import {
  readExecutionIntelligence,
  writeExecutionIntelligenceEvent,
  type ExecutionIntelligencePublicationResult,
} from "../store/execution-intelligence-store.ts";
import { verifyExecutionIntelligenceRepositoryRoot } from "../store/verified-repository-root.ts";

export type ExecutionIntelligenceRecorder = Readonly<{
  recordTaskAttempt: (
    input: TaskAttemptSettledEventInput,
  ) => ReturnType<typeof writeExecutionIntelligenceEvent>;
  recordEvent: (
    event: ExecutionIntelligenceEvent,
  ) => ReturnType<typeof writeExecutionIntelligenceEvent>;
  read: () => ReturnType<typeof readExecutionIntelligence>;
}>;

function invalidEventPublication(): ExecutionIntelligencePublicationResult {
  return Object.freeze({
    status: "blocked" as const,
    reason: "execution_event_invalid",
    effectState: "no_effect" as const,
    cleanupConfirmed: true,
    retryAllowed: false,
    manualRecoveryRequired: false,
    residualArtifactIds: Object.freeze([]),
  });
}

export function createExecutionIntelligenceRecorder(repositoryRoot: string):
  | Readonly<{
      status: "completed";
      reason: "execution_intelligence_recorder_ready";
      recorder: ExecutionIntelligenceRecorder;
    }>
  | Readonly<{
      status: "blocked";
      reason: "execution_repository_root_invalid";
    }> {
  const verified = verifyExecutionIntelligenceRepositoryRoot(repositoryRoot);
  if (verified.status !== "completed") return verified;
  const capability = verified.root;
  const recorder = Object.freeze({
    recordTaskAttempt: (input: TaskAttemptSettledEventInput) => {
      try {
        return writeExecutionIntelligenceEvent(
          capability,
          createTaskAttemptSettledEvent(input),
        );
      } catch {
        return invalidEventPublication();
      }
    },
    recordEvent: (event: ExecutionIntelligenceEvent) =>
      writeExecutionIntelligenceEvent(capability, event),
    read: () => readExecutionIntelligence(capability),
  });
  return Object.freeze({
    status: "completed" as const,
    reason: "execution_intelligence_recorder_ready" as const,
    recorder,
  });
}
