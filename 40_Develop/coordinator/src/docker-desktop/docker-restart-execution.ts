/**
 * docker-restart-executionに属する責務をまとめる。
 *
 * @responsibility DockerRestartContextを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import {
  classifyDockerRestartProgress,
  type DockerRestartObservation,
  type DockerRestartPhase,
} from "./docker-restart-state.ts";

/**
 * Host-owned opaque context. The driver cannot authenticate or mint it.
 *
 * @responsibility Docker Restart ContextのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRestartContextが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRestartContextで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRestartContextの宣言は外部境界を開かない。
 * @security N/A: DockerRestartContextはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DockerRestartContextの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerRestartContext = object;
/**
 * docker-restart-executionで使用するDocker Restart Portsの値契約を定義する。
 *
 * @responsibility Docker Restart PortsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRestartPortsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRestartPortsで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRestartPortsの宣言は外部境界を開かない。
 * @security N/A: DockerRestartPortsはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DockerRestartPortsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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
  observeStopped?: () => Promise<boolean>;
  observeReady?: () => Promise<boolean>;
}>;
/**
 * docker-restart-executionで使用するDocker Restart Execution 結果の値契約を定義する。
 *
 * @responsibility Docker Restart Execution 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRestartExecutionResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRestartExecutionResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRestartExecutionResultの宣言は外部境界を開かない。
 * @security N/A: DockerRestartExecutionResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DockerRestartExecutionResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * Injected driver only; no production Native or filesystem adapter is connected.
 *
 * @responsibility Docker Restartの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input context: DockerRestartContext、ports: DockerRestartPorts、signal: AbortSignal、resumePhase: DockerRestartPhase
 * @returns Promise<DockerRestartExecutionResult>を返す。
 * @precondition 「context: DockerRestartContext、ports: DockerRestartPorts、signal: AbortSignal、resumePhase: DockerRestartPhase」がexecuteDockerRestartの入力契約を満たす。
 * @postcondition executeDockerRestartの責務を完了した結果だけを返す。
 * @effect N/A: executeDockerRestartは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure executeDockerRestartは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executeDockerRestartは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executeDockerRestartはProcess内の同一Subsystemで完結する。
 * @security N/A: executeDockerRestartはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency executeDockerRestartは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function executeDockerRestart(
  context: DockerRestartContext,
  ports: DockerRestartPorts,
  signal: AbortSignal,
  resumePhase?: DockerRestartPhase,
): Promise<DockerRestartExecutionResult> {
  const isValidResumePhase =
    resumePhase === undefined ||
    ["stop_intent", "stopped", "start_intent", "ready", "settled"].includes(
      resumePhase,
    );
  let phase: DockerRestartPhase = isValidResumePhase
    ? (resumePhase ?? "prepared")
    : "prepared";
  let reason = "docker_restart_execution_failed";
  let cleanupConfirmed = false;
  let hasAttemptedIntent = resumePhase !== undefined;
  // A stored phase does not prove the previous effect's current outcome.
  let isEffectOutcomeUnknown = resumePhase !== undefined;
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
    const isBoundaryMatching = await ports.verifyBoundary(context);
    if (signal.aborted) fail("docker_restart_cancelled");
    if (isBoundaryMatching !== true)
      fail("docker_restart_boundary_unconfirmed");
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
    hasAttemptedIntent = true;
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
    if (!isValidResumePhase) fail("docker_restart_resume_phase_invalid");
    if (resumePhase !== undefined) await checkBoundary();
    if (resumePhase === "settled")
      fail("docker_restart_resume_requires_observation");
    if (
      resumePhase === "ready" ||
      resumePhase === "stopped" ||
      resumePhase === "start_intent"
    ) {
      const confirmed =
        resumePhase === "ready" || resumePhase === "start_intent"
          ? await ports.observeReady?.()
          : await ports.observeStopped?.();
      await checkBoundary();
      if (confirmed !== true)
        fail(
          resumePhase === "ready" || resumePhase === "start_intent"
            ? "docker_restart_start_unconfirmed"
            : "docker_restart_stop_unconfirmed",
        );
      isEffectOutcomeUnknown = false;
      if (resumePhase === "start_intent") {
        advance({
          startCompleted: true,
          engineReady: true,
          effectOutcomeUnknown: false,
        });
        await persist("ready");
      }
    }
    if (phase === "prepared") {
      await persist("stop_intent");
      advance();
    }
    if (phase === "stop_intent") {
      await checkBoundary();
      isEffectOutcomeUnknown = true;
      const isStoppedObserved =
        resumePhase === "stop_intent" &&
        (await ports.observeStopped?.()) === true;
      const stopped =
        resumePhase === "stop_intent"
          ? {
              stopCompleted: isStoppedObserved,
              managedProcessesAbsent: isStoppedObserved,
              engineStopped: isStoppedObserved,
              effectOutcomeUnknown: !isStoppedObserved,
            }
          : await ports.stop(context);
      await checkBoundary();
      isEffectOutcomeUnknown = stopped.effectOutcomeUnknown !== false;
      advance(stopped);
      await persist("stopped");
    }
    if (phase === "stopped") {
      await persist("start_intent");
      advance();
      await checkBoundary();
      isEffectOutcomeUnknown = true;
      const started = await ports.start(context);
      isEffectOutcomeUnknown = started.effectOutcomeUnknown !== false;
      await checkBoundary();
      advance(started);
      await persist("ready");
    }
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
  const isCompleted = reason === "docker_restart_settled";
  return Object.freeze({
    status: isCompleted ? "completed" : "blocked",
    reason,
    phase,
    cleanupConfirmed,
    restartCompleted: isCompleted,
    taskRecoveryCompleted: false,
    recoveryRequired: !isCompleted && hasAttemptedIntent,
    effectOutcomeUnknown: isEffectOutcomeUnknown,
  });
}
