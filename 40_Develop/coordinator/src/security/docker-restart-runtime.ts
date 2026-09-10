import { executeDockerRestart } from "../core/docker-restart-execution.ts";
import { acquireRuntimeOwnedDockerDesktopRestartNativeHelper } from "./docker-desktop-repair-native-helper.ts";
import {
  commitRuntimeOwnedDockerRestartHandoff,
  persistRuntimeOwnedDockerRestartPhase,
  prepareRuntimeOwnedDockerRestart,
  releaseRuntimeOwnedDockerRestartPreparation,
  verifyRuntimeOwnedDockerRestartPreparation,
} from "./docker-recovery-runtime-internal.ts";
import { createDockerRestartMachine } from "./docker-restart-machine.ts";

/** Package-internal composition. Task recovery remains a separate operation. */
export async function restartRuntimeOwnedDockerForRecovery(
  recoveryId: unknown,
  signal: AbortSignal,
  originReleaseRoot?: unknown,
  developmentContext?: unknown,
) {
  if (signal.aborted)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_restart_cancelled",
      cleanupConfirmed: true,
      restartCompleted: false,
      taskRecoveryCompleted: false,
    });
  const preparation = prepareRuntimeOwnedDockerRestart(
    recoveryId,
    originReleaseRoot,
    developmentContext,
  );
  if (preparation.status !== "prepared")
    return Object.freeze({
      ...preparation,
      restartCompleted: false,
      taskRecoveryCompleted: false,
    });
  const context = preparation.capability;
  let helperCleanupConfirmed = true;
  let lockCleanupConfirmed = false;
  let releaseHelper: (() => Promise<{ cleanup: string }>) | null = null;
  let result: Readonly<{
    status: "completed" | "blocked";
    reason: string;
    restartCompleted: boolean;
    taskRecoveryCompleted: boolean;
    recoveryRequired?: boolean;
    effectOutcomeUnknown?: boolean;
  }> = Object.freeze({
    status: "blocked",
    reason: "docker_restart_execution_unconfirmed",
    restartCompleted: false,
    taskRecoveryCompleted: false,
  });
  try {
    const acquired = await acquireRuntimeOwnedDockerDesktopRestartNativeHelper(
      preparation.platformAccessArtifact,
    );
    if (acquired.status !== "acquired" || !acquired.session) {
      helperCleanupConfirmed = acquired.status !== "cleanup_unknown";
      result = Object.freeze({
        status: "blocked" as const,
        reason: "docker_restart_helper_unavailable",
        restartCompleted: false,
        taskRecoveryCompleted: false,
      });
    } else {
      const session = acquired.session;
      helperCleanupConfirmed = false;
      releaseHelper = () => session.release();
      if (
        preparation.handoffPending &&
        (!verifyRuntimeOwnedDockerRestartPreparation(context) ||
          (await session.verifyArtifacts()) !== "verified" ||
          (await session.inspectClientProcesses()) !== "absent" ||
          signal.aborted ||
          !commitRuntimeOwnedDockerRestartHandoff(context))
      )
        throw new Error("docker_restart_handoff_unconfirmed");
      if (
        preparation.continuationSeedRequired &&
        !persistRuntimeOwnedDockerRestartPhase(context, "stop_intent")
      )
        throw new Error("docker_restart_record_unconfirmed");
      const machine = createDockerRestartMachine(
        session,
        () => verifyRuntimeOwnedDockerRestartPreparation(context),
        signal,
      );
      releaseHelper = () => machine.release();
      result = await executeDockerRestart(
        context,
        {
          observeStopped: () => machine.observeStopped(),
          observeReady: () => machine.observeReady(),
          verifyBoundary: async () =>
            verifyRuntimeOwnedDockerRestartPreparation(context),
          persist: async (_context, phase) =>
            phase !== "prepared" &&
            persistRuntimeOwnedDockerRestartPhase(context, phase),
          stop: async () => {
            const isStopped = (await machine.stop()) === "stopped";
            return {
              stopCompleted: isStopped,
              managedProcessesAbsent: isStopped,
              engineStopped: isStopped,
              effectOutcomeUnknown: machine.getEffectOutcomeUnknown(),
            };
          },
          start: async () => {
            const isReady = (await machine.start()) === "ready";
            return {
              startCompleted: isReady,
              engineReady: isReady,
              effectOutcomeUnknown: machine.getEffectOutcomeUnknown(),
            };
          },
          cleanup: async () => {
            const released = await machine.release();
            helperCleanupConfirmed = released.cleanup === "confirmed";
            return helperCleanupConfirmed;
          },
        },
        signal,
        preparation.currentPhase ?? undefined,
      );
    }
  } catch {
    result = Object.freeze({
      status: "blocked" as const,
      reason: "docker_restart_execution_unconfirmed",
      restartCompleted: false,
      taskRecoveryCompleted: false,
      recoveryRequired: true,
      effectOutcomeUnknown: true,
    });
  } finally {
    if (releaseHelper && !helperCleanupConfirmed) {
      try {
        helperCleanupConfirmed =
          (await releaseHelper()).cleanup === "confirmed";
      } catch {
        helperCleanupConfirmed = false;
      }
    }
    lockCleanupConfirmed = releaseRuntimeOwnedDockerRestartPreparation(context);
  }
  if (!helperCleanupConfirmed || !lockCleanupConfirmed)
    return Object.freeze({
      ...result,
      status: "blocked" as const,
      reason: "docker_restart_cleanup_unconfirmed",
      cleanupConfirmed: false,
      restartCompleted: false,
      taskRecoveryCompleted: false,
    });
  return Object.freeze({
    ...result,
    recoveryId: preparation.recoveryId,
    cleanupConfirmed: true,
  });
}
