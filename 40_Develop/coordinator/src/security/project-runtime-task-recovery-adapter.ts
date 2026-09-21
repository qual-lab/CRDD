import type {
  ProjectDockerRecoveryAcknowledgement,
  ProjectRuntimeDockerRecoveryIdentity,
  ProjectRuntimeRecoveryTransition,
  ProjectRuntimeTaskRecoveryPort,
} from "../../../project-runtime/src/index.ts";

/**
 * ProjectRuntimeTaskRecoveryHostDependenciesが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeTaskRecoveryHostDependenciesに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape ProjectRuntimeTaskRecoveryHostDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeTaskRecoveryHostDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeTaskRecoveryHostDependenciesの宣言は外部境界を開かない。
 * @security ProjectRuntimeTaskRecoveryHostDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProjectRuntimeTaskRecoveryHostDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * Bind Coordinator recovery implementations to one verified Repository.
 *
 * @responsibility createProjectRuntimeTaskRecoveryAdapterに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input workingDirectory: string、repositoryBindingId: string、dependencies: ProjectRuntimeTaskRecoveryHostDependencies
 * @returns ProjectRuntimeTaskRecoveryPortを返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、dependencies: ProjectRuntimeTaskRecoveryHostDependencies」がcreateProjectRuntimeTaskRecoveryAdapterの入力契約を満たす。
 * @postcondition createProjectRuntimeTaskRecoveryAdapterの責務を完了した結果だけを返す。
 * @effect N/A: createProjectRuntimeTaskRecoveryAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createProjectRuntimeTaskRecoveryAdapterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createProjectRuntimeTaskRecoveryAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createProjectRuntimeTaskRecoveryAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency createProjectRuntimeTaskRecoveryAdapterは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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
