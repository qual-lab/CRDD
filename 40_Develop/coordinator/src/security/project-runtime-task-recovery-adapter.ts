import type {
  ProjectDockerRecoveryAcknowledgement,
  ProjectRuntimeDockerRecoveryIdentity,
  ProjectRuntimeRecoveryTransition,
  ProjectRuntimeTaskRecoveryPort,
} from "../../../project-runtime/src/index.ts";

export type ProjectRuntimeTaskRecoveryHostDependencies = Readonly<{
  recoverTaskRecovery?: (recoveryId: string) => unknown;
  acknowledgeTaskRecovery?: (
    settlement: Readonly<
      ProjectRuntimeDockerRecoveryIdentity & {
        workingDirectory: string;
        repositoryBindingId: string;
      }
    >,
  ) => unknown;
  finalizeTaskRecoveryAcknowledgement?: (
    settlement: Readonly<
      ProjectRuntimeDockerRecoveryIdentity & {
        workingDirectory: string;
        repositoryBindingId: string;
        acknowledgement: ProjectDockerRecoveryAcknowledgement;
      }
    >,
  ) => unknown;
  resolveTaskRecoveryCorrelations?: (
    correlationIds: readonly string[],
  ) => unknown;
  observeRecoveryTransition?: (
    event: ProjectRuntimeRecoveryTransition,
  ) => void | Promise<void>;
}>;

/** Bind Coordinator recovery implementations to one verified Repository. */
export function createProjectRuntimeTaskRecoveryAdapter(
  workingDirectory: string,
  repositoryBindingId: string,
  dependencies: ProjectRuntimeTaskRecoveryHostDependencies,
): ProjectRuntimeTaskRecoveryPort {
  return Object.freeze({
    resolveCorrelations: (correlationIds: readonly string[]) =>
      dependencies.resolveTaskRecoveryCorrelations?.(correlationIds) ?? null,
    recover: (recoveryId: string) =>
      dependencies.recoverTaskRecovery?.(recoveryId) ?? null,
    acknowledgeDocker: (identity: ProjectRuntimeDockerRecoveryIdentity) =>
      dependencies.acknowledgeTaskRecovery?.(
        Object.freeze({
          workingDirectory,
          repositoryBindingId,
          ...identity,
        }),
      ) ?? null,
    finalizeDockerAcknowledgement: (
      identity: ProjectRuntimeDockerRecoveryIdentity,
      acknowledgement: ProjectDockerRecoveryAcknowledgement,
    ) =>
      dependencies.finalizeTaskRecoveryAcknowledgement?.(
        Object.freeze({
          workingDirectory,
          repositoryBindingId,
          ...identity,
          acknowledgement,
        }),
      ) ?? null,
    observeTransition: async (event: ProjectRuntimeRecoveryTransition) => {
      try {
        await dependencies.observeRecoveryTransition?.(
          Object.freeze({ ...event }),
        );
      } catch {
        // Recovery correctness never depends on a diagnostic observer.
      }
    },
  });
}
