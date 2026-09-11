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

type ExecutionIntelligenceEventWriter = (
  root: Parameters<typeof writeExecutionIntelligenceEvent>[0],
  event: ExecutionIntelligenceEvent,
) => ExecutionIntelligencePublicationResult;

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

/**
 * Package-internal composition boundary. The writer argument is intentionally
 * not exported from the package index: production callers always receive the
 * repository-bound store, while contract tests can prove that canonical input
 * rejection and persistent publication failures remain distinct boundaries.
 */
export function createBoundExecutionIntelligenceRecorder(
  capability: Parameters<typeof writeExecutionIntelligenceEvent>[0],
  writeEvent: ExecutionIntelligenceEventWriter,
): ExecutionIntelligenceRecorder {
  return Object.freeze({
    recordTaskAttempt: (input: TaskAttemptSettledEventInput) => {
      let event: ExecutionIntelligenceEvent;
      try {
        event = createTaskAttemptSettledEvent(input);
      } catch {
        return invalidEventPublication();
      }
      return writeEvent(capability, event);
    },
    recordEvent: (event: ExecutionIntelligenceEvent) =>
      writeEvent(capability, event),
    read: () => readExecutionIntelligence(capability),
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
  const recorder = createBoundExecutionIntelligenceRecorder(
    verified.root,
    writeExecutionIntelligenceEvent,
  );
  return Object.freeze({
    status: "completed" as const,
    reason: "execution_intelligence_recorder_ready" as const,
    recorder,
  });
}
