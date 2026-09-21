/**
 * Pure progress classification only. This module neither authenticates evidence
 *
 * @responsibility DockerRestartPhaseに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape DockerRestartPhaseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRestartPhaseで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRestartPhaseの宣言は外部境界を開かない。
 * @security N/A: DockerRestartPhaseはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DockerRestartPhaseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerRestartPhase =
  | "prepared"
  | "stop_intent"
  | "stopped"
  | "start_intent"
  | "ready"
  | "settled";

/**
 * DockerRestartObservationが扱う値の構造を表す。
 *
 * @responsibility DockerRestartObservationに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape DockerRestartObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRestartObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRestartObservationの宣言は外部境界を開かない。
 * @security N/A: DockerRestartObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DockerRestartObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * DockerRestartTransitionが扱う値の構造を表す。
 *
 * @responsibility DockerRestartTransitionに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape DockerRestartTransitionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRestartTransitionで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRestartTransitionの宣言は外部境界を開かない。
 * @security N/A: DockerRestartTransitionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DockerRestartTransitionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * Unknown or cancelled progress never grants permission to replay an effect.
 *
 * @responsibility classifyDockerRestartProgressに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input phase: DockerRestartPhase、observation: DockerRestartObservation
 * @returns DockerRestartTransitionを返す。
 * @precondition 「phase: DockerRestartPhase、observation: DockerRestartObservation」がclassifyDockerRestartProgressの入力契約を満たす。
 * @postcondition classifyDockerRestartProgressの責務を完了した結果だけを返す。
 * @effect N/A: classifyDockerRestartProgressは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyDockerRestartProgressは独自の失敗分岐を所有しない。
 * @invariant classifyDockerRestartProgressは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyDockerRestartProgressはProcess内の同一Subsystemで完結する。
 * @security N/A: classifyDockerRestartProgressはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: classifyDockerRestartProgressは共有非同期状態を持たない同期処理である。
 */
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
