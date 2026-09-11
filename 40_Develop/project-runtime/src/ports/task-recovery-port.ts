import type { ProjectDockerRecoveryAcknowledgement } from "../core/project-runtime-state.ts";

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

/** Host capabilities required to resolve and settle Task recovery obligations. */
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
