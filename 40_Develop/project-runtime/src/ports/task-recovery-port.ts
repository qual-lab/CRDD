import type { ProjectDockerRecoveryAcknowledgement } from "../core/project-runtime-state.ts";

/**
 * ProjectRuntimeDockerRecoveryIdentityが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeDockerRecoveryIdentityに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeDockerRecoveryIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeDockerRecoveryIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeDockerRecoveryIdentityの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeDockerRecoveryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeDockerRecoveryIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeDockerRecoveryIdentity = Readonly<{
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
 * ProjectRuntimeRecoveryTransitionが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeRecoveryTransitionに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeRecoveryTransitionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeRecoveryTransitionで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeRecoveryTransitionの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeRecoveryTransitionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeRecoveryTransitionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeRecoveryTransition = Readonly<{
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
 * @responsibility ProjectRuntimeTaskRecoveryPortに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeTaskRecoveryPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeTaskRecoveryPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeTaskRecoveryPortの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeTaskRecoveryPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeTaskRecoveryPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeTaskRecoveryPort = Readonly<{
  resolveCorrelations: (correlationIds: readonly string[]) => unknown;
  recover: (recoveryId: string) => unknown;
  acknowledgeDocker: (
    identity: ProjectRuntimeDockerRecoveryIdentity,
  ) => unknown;
  finalizeDockerAcknowledgement: (
    identity: ProjectRuntimeDockerRecoveryIdentity,
    acknowledgement: ProjectDockerRecoveryAcknowledgement,
  ) => unknown;
  observeTransition: (
    event: ProjectRuntimeRecoveryTransition,
  ) => void | Promise<void>;
}>;
