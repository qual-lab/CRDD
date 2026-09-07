import {
  classifyDockerRestartProgress,
  type DockerRestartObservation,
  type DockerRestartPhase,
} from "./docker-restart-state.ts";

/** Host-owned opaque context. The driver cannot authenticate or mint it. */
export type DockerRestartContext = object;
export type DockerRestartPorts = Readonly<{
  verifyBoundary: (context: DockerRestartContext) => Promise<boolean>;
  persist: (
    context: DockerRestartContext,
    phase: DockerRestartPhase,
  ) => Promise<boolean>;
  stop: (context: DockerRestartContext) => Promise<
    Readonly<{
      stopCompleted: boolean;
      managedProcessesAbsent: boolean;
      engineStopped: boolean;
      effectOutcomeUnknown: boolean;
    }>
  >;
  start: (context: DockerRestartContext) => Promise<
    Readonly<{
      startCompleted: boolean;
      engineReady: boolean;
      effectOutcomeUnknown: boolean;
    }>
  >;
  cleanup: (context: DockerRestartContext) => Promise<boolean>;
}>;
export type DockerRestartExecutionResult = Readonly<{
  status: "completed" | "blocked";
  reason: string;
  phase: DockerRestartPhase;
  cleanupConfirmed: boolean;
  restartCompleted: boolean;
  taskRecoveryCompleted: false;
  recoveryRequired: boolean;
  effectOutcomeUnknown: boolean;
}>;

const consumedContexts = new WeakSet<DockerRestartContext>();

/** Injected driver only; no production Native or filesystem adapter is connected. */
export async function executeDockerRestart(
  context: DockerRestartContext,
  ports: DockerRestartPorts,
  signal: AbortSignal,
): Promise<DockerRestartExecutionResult> {
  let phase: DockerRestartPhase = "prepared";
  let reason = "docker_restart_execution_failed";
  let cleanupConfirmed = false;
  let intentAttempted = false;
  let effectOutcomeUnknown = false;
  const observation: DockerRestartObservation = {
    boundaryMatches: true,
    cancellationRequested: false,
    intentRecorded: true,
    stopCompleted: false,
    managedProcessesAbsent: false,
    engineStopped: false,
    startCompleted: false,
    engineReady: false,
    helperCleanupConfirmed: false,
    recordConfirmed: true,
    effectOutcomeUnknown: false,
  };
  const fail = (failure: string): never => {
    throw new Error(failure);
  };
  const checkBoundary = async (): Promise<void> => {
    if (signal.aborted) fail("docker_restart_cancelled");
    const matches = await ports.verifyBoundary(context);
    if (signal.aborted) fail("docker_restart_cancelled");
    if (matches !== true) fail("docker_restart_boundary_unconfirmed");
  };
  const advance = (values: Partial<DockerRestartObservation> = {}): void => {
    const transition = classifyDockerRestartProgress(phase, {
      ...observation,
      ...values,
    });
    if (transition.status === "blocked") fail(transition.reason);
    phase = transition.phase;
  };
  const persist = async (next: DockerRestartPhase): Promise<void> => {
    await checkBoundary();
    intentAttempted = true;
    const confirmed = await ports.persist(context, next);
    await checkBoundary();
    if (confirmed !== true) fail("docker_restart_record_unconfirmed");
  };
  // Re-entry requires a separate host recovery protocol, never replay this driver.
  if (consumedContexts.has(context))
    return Object.freeze({
      status: "blocked",
      reason: "docker_restart_context_consumed",
      phase,
      cleanupConfirmed: false,
      restartCompleted: false,
      taskRecoveryCompleted: false,
      recoveryRequired: true,
      effectOutcomeUnknown: true,
    });
  consumedContexts.add(context);
  try {
    await persist("stop_intent");
    advance();
    await checkBoundary();
    effectOutcomeUnknown = true;
    const stopped = await ports.stop(context);
    effectOutcomeUnknown = stopped.effectOutcomeUnknown !== false;
    await checkBoundary();
    advance(stopped);
    await persist("stopped");
    await persist("start_intent");
    advance();
    await checkBoundary();
    effectOutcomeUnknown = true;
    const started = await ports.start(context);
    effectOutcomeUnknown = started.effectOutcomeUnknown !== false;
    await checkBoundary();
    advance(started);
    await persist("ready");
    reason = "docker_restart_ready";
  } catch (error) {
    reason =
      error instanceof Error && error.message.startsWith("docker_restart_")
        ? error.message
        : "docker_restart_execution_failed";
  } finally {
    try {
      cleanupConfirmed = (await ports.cleanup(context)) === true;
    } catch {
      cleanupConfirmed = false;
    }
  }
  if (!cleanupConfirmed) reason = "docker_restart_cleanup_unconfirmed";
  else if (reason === "docker_restart_ready") {
    try {
      await checkBoundary();
      await persist("settled");
      advance({ helperCleanupConfirmed: true });
      reason = "docker_restart_settled";
    } catch (error) {
      reason =
        error instanceof Error && error.message.startsWith("docker_restart_")
          ? error.message
          : "docker_restart_execution_failed";
    }
  }
  const completed = reason === "docker_restart_settled";
  return Object.freeze({
    status: completed ? "completed" : "blocked",
    reason,
    phase,
    cleanupConfirmed,
    restartCompleted: completed,
    taskRecoveryCompleted: false,
    recoveryRequired: !completed && intentAttempted,
    effectOutcomeUnknown,
  });
}
