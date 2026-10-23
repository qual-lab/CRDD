/**
 * task-recovery-portに属する責務をまとめる。
 *
 * @responsibility CoordinatorDockerRecoveryIdentityを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */

/**
 * task-recovery-portで使用するCoordinator Docker 回復 Identityの値契約を定義する。
 *
 * @responsibility Coordinator Docker 回復 IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDockerRecoveryIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDockerRecoveryIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDockerRecoveryIdentityの宣言は外部境界を開かない。
 * @security N/A: CoordinatorDockerRecoveryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorDockerRecoveryIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDockerRecoveryIdentity = Readonly<{
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
 * task-recovery-portで使用するCoordinator 回復 Transitionの値契約を定義する。
 *
 * @responsibility Coordinator 回復 TransitionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorRecoveryTransitionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorRecoveryTransitionで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorRecoveryTransitionの宣言は外部境界を開かない。
 * @security N/A: CoordinatorRecoveryTransitionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorRecoveryTransitionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorRecoveryTransition = Readonly<{
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
 * @responsibility Coordinator Task 回復 PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorTaskRecoveryPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskRecoveryPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorTaskRecoveryPortの宣言は外部境界を開かない。
 * @security N/A: CoordinatorTaskRecoveryPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorTaskRecoveryPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorTaskRecoveryPort = Readonly<{
  resolveCorrelations: (correlationIds: readonly string[]) => unknown;
  recover: (recoveryId: string, signal: AbortSignal) => unknown;
  acknowledgeDocker: (identity: CoordinatorDockerRecoveryIdentity) => unknown;
  observeTransition: (
    event: CoordinatorRecoveryTransition,
  ) => void | Promise<void>;
}>;
