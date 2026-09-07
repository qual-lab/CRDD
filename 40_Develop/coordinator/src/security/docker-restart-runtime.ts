import { executeDockerRestart } from "../core/docker-restart-execution.ts";
import { acquireRuntimeOwnedDockerDesktopRestartNativeHelper } from "./docker-desktop-repair-native-helper.ts";
import {
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
) {
  if (signal.aborted)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_restart_cancelled",
      cleanupConfirmed: true,
      restartCompleted: false,
      taskRecoveryCompleted: false,
    });
  const preparation = prepareRuntimeOwnedDockerRestart(recoveryId);
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
      const machine = createDockerRestartMachine(
        session,
        () => verifyRuntimeOwnedDockerRestartPreparation(context),
        signal,
      );
      result = await executeDockerRestart(
        context,
        {
          verifyBoundary: async () =>
            verifyRuntimeOwnedDockerRestartPreparation(context),
          persist: async (_context, phase) =>
            phase !== "prepared" &&
            persistRuntimeOwnedDockerRestartPhase(context, phase),
          stop: async () => {
            const stopped = (await machine.stop()) === "stopped";
            return {
              stopCompleted: stopped,
              managedProcessesAbsent: stopped,
              engineStopped: stopped,
              effectOutcomeUnknown: !stopped,
            };
          },
          start: async () => {
            const ready = (await machine.start()) === "ready";
            return {
              startCompleted: ready,
              engineReady: ready,
              effectOutcomeUnknown: !ready,
            };
          },
          cleanup: async () => {
            const released = await machine.release();
            helperCleanupConfirmed = released.cleanup === "confirmed";
            return helperCleanupConfirmed;
          },
        },
        signal,
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
