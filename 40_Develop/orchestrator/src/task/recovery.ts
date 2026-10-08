/**
 * task-recovery-portに属する責務をまとめる。
 *
 * @responsibility OrchestratorDockerRecoveryIdentityを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import type { ProjectDockerRecoveryAcknowledgement } from "../state/transitions.ts";

/**
 * task-recovery-portで使用するOrchestrator Docker 回復 Identityの値契約を定義する。
 *
 * @responsibility Orchestrator Docker 回復 IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorDockerRecoveryIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorDockerRecoveryIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorDockerRecoveryIdentityの宣言は外部境界を開かない。
 * @security N/A: OrchestratorDockerRecoveryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorDockerRecoveryIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorDockerRecoveryIdentity = Readonly<{
  projectId: string;
  milestoneId: string;
  stateGeneration: number;
  taskId: string;
  attemptId: string;
  operationId: string;
  kind: "docker";
  recoveryId: string;
}>;

/**
 * task-recovery-portで使用するOrchestrator 回復 Transitionの値契約を定義する。
 *
 * @responsibility Orchestrator 回復 TransitionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorRecoveryTransitionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorRecoveryTransitionで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorRecoveryTransitionの宣言は外部境界を開かない。
 * @security N/A: OrchestratorRecoveryTransitionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorRecoveryTransitionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorRecoveryTransition = Readonly<{
  phase:
    | "required"
    | "recovering"
    | "settled"
    | "acknowledged"
    | "verification_resources_finalized"
    | "queue_settled"
    | "retry_ready";
  projectId: string;
  milestoneId: string;
  queueId: string;
  taskId: string | null;
  operationId: string | null;
  recoveryId: string | null;
  stateGeneration: number;
}>;

/**
 * Host capabilities required to resolve and settle Task recovery obligations.
 *
 * @responsibility Orchestrator Task 回復 PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorTaskRecoveryPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorTaskRecoveryPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorTaskRecoveryPortの宣言は外部境界を開かない。
 * @security N/A: OrchestratorTaskRecoveryPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorTaskRecoveryPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorTaskRecoveryPort = Readonly<{
  resolveCorrelations: (correlationIds: readonly string[]) => unknown;
  recover: (recoveryId: string) => unknown;
  acknowledgeDocker: (identity: OrchestratorDockerRecoveryIdentity) => unknown;
  finalizeDockerAcknowledgement: (
    identity: OrchestratorDockerRecoveryIdentity,
    acknowledgement: ProjectDockerRecoveryAcknowledgement,
  ) => unknown;
  observeTransition: (
    event: OrchestratorRecoveryTransition,
  ) => void | Promise<void>;
}>;
