/**
 * Taskの回復参照・進行通知・技術回復Portの型を定義する。
 * @responsibility Taskの回復参照・進行通知・技術回復Portの型を定義する。
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
 * Task回復の調停へ、既存Host回復実装を注入するPortを定義する。
 *
 * @responsibility Coordinator Task 回復 PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorTaskRecoveryPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskRecoveryPortで宣言した値と責務の対応を維持する。
 * @boundary Task回復調停とHost回復実装の注入境界。
 * @security Portは回復処置と確認を呼び出せる実行Capabilityであり、公開結果・保存値へ含めない。回復ID自体はAuthorityとして扱わない。
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
