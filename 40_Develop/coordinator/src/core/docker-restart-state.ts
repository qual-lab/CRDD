/**
 * Pure progress classification only. This module neither authenticates evidence
 * nor issues restart authority. The host must validate and persist observations
 * before using a transition, and must retain the exact operation identity.
 */
export type DockerRestartPhase =
  | "prepared"
  | "stop_intent"
  | "stopped"
  | "start_intent"
  | "ready"
  | "settled";

export type DockerRestartObservation = Readonly<{
  boundaryMatches: boolean;
  cancellationRequested: boolean;
  intentRecorded: boolean;
  stopCompleted: boolean;
  managedProcessesAbsent: boolean;
  engineStopped: boolean;
  startCompleted: boolean;
  engineReady: boolean;
  helperCleanupConfirmed: boolean;
  recordConfirmed: boolean;
  effectOutcomeUnknown: boolean;
}>;

export type DockerRestartTransition = Readonly<{
  phase: DockerRestartPhase;
  status: "advance" | "blocked" | "complete";
  reason: string;
  recoveryRequired: boolean;
}>;

const RESTART_PHASES: readonly DockerRestartPhase[] = Object.freeze([
  "prepared",
  "stop_intent",
  "stopped",
  "start_intent",
  "ready",
  "settled",
]);

/** Unknown or cancelled progress never grants permission to replay an effect. */
export function classifyDockerRestartProgress(
  phase: DockerRestartPhase,
  observation: DockerRestartObservation,
): DockerRestartTransition {
  const blocked = (reason: string): DockerRestartTransition =>
    Object.freeze({
      phase,
      status: "blocked",
      reason,
      recoveryRequired: phase !== "prepared",
    });
  if (!RESTART_PHASES.includes(phase))
    return Object.freeze({
      phase,
      status: "blocked",
      reason: "docker_restart_phase_invalid",
      recoveryRequired: true,
    });
  if (observation.boundaryMatches !== true)
    return blocked("docker_restart_boundary_unconfirmed");
  if (observation.effectOutcomeUnknown !== false)
    return Object.freeze({
      ...blocked("docker_restart_effect_outcome_unknown"),
      recoveryRequired: true,
    });
  if (observation.cancellationRequested !== false)
    return blocked("docker_restart_cancelled");
  if (observation.recordConfirmed !== true)
    return blocked("docker_restart_record_unconfirmed");

  let nextPhase: DockerRestartPhase;
  switch (phase) {
    case "prepared":
      if (observation.intentRecorded !== true)
        return blocked("docker_restart_stop_intent_unconfirmed");
      nextPhase = "stop_intent";
      break;
    case "stop_intent":
      if (
        observation.stopCompleted !== true ||
        observation.managedProcessesAbsent !== true ||
        observation.engineStopped !== true
      )
        return blocked("docker_restart_stop_unconfirmed");
      nextPhase = "stopped";
      break;
    case "stopped":
      if (observation.intentRecorded !== true)
        return blocked("docker_restart_start_intent_unconfirmed");
      nextPhase = "start_intent";
      break;
    case "start_intent":
      if (
        observation.startCompleted !== true ||
        observation.engineReady !== true
      )
        return blocked("docker_restart_start_unconfirmed");
      nextPhase = "ready";
      break;
    case "ready":
      if (observation.helperCleanupConfirmed !== true)
        return blocked("docker_restart_cleanup_unconfirmed");
      nextPhase = "settled";
      break;
    case "settled":
      return Object.freeze({
        phase,
        status: "complete",
        reason: "docker_restart_settled",
        recoveryRequired: false,
      });
  }
  return Object.freeze({
    phase: nextPhase,
    status: "advance",
    reason: "docker_restart_progress_confirmed",
    recoveryRequired: true,
  });
}
