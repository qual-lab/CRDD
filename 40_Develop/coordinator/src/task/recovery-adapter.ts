/**
 * task-recovery-adapterに属する責務をまとめる。
 *
 * @responsibility CoordinatorTaskRecoveryHostDependenciesを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import type {
  CoordinatorDockerRecoveryIdentity,
  CoordinatorRecoveryTransition,
  CoordinatorTaskRecoveryPort,
} from "./types.ts";

/**
 * task-recovery-adapterで使用するCoordinator Task 回復 Host Dependenciesの値契約を定義する。
 *
 * @responsibility Coordinator Task 回復 Host DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape CoordinatorTaskRecoveryHostDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskRecoveryHostDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorTaskRecoveryHostDependenciesの宣言は外部境界を開かない。
 * @security CoordinatorTaskRecoveryHostDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CoordinatorTaskRecoveryHostDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorTaskRecoveryHostDependencies = Readonly<{
  recoverTaskRecovery?: (recoveryId: string, signal: AbortSignal) => unknown;
  acknowledgeTaskRecovery?: (
    settlement: Readonly<
      CoordinatorDockerRecoveryIdentity & {
        workingDirectory: string;
        repositoryBindingId: string;
      }
    >,
  ) => unknown;
  resolveTaskRecoveryCorrelations?: (
    correlationIds: readonly string[],
  ) => unknown;
  observeRecoveryTransition?: (
    event: CoordinatorRecoveryTransition,
  ) => void | Promise<void>;
}>;

/**
 * Bind Coordinator recovery implementations to one verified Repository.
 *
 * @responsibility Coordinator Task 回復 Adapterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input workingDirectory: string、repositoryBindingId: string、dependencies: CoordinatorTaskRecoveryHostDependencies
 * @returns CoordinatorTaskRecoveryPortを返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、dependencies: CoordinatorTaskRecoveryHostDependencies」がcreateCoordinatorTaskRecoveryAdapterの入力契約を満たす。
 * @postcondition createCoordinatorTaskRecoveryAdapterの責務を完了した結果だけを返す。
 * @effect N/A: createCoordinatorTaskRecoveryAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createCoordinatorTaskRecoveryAdapterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createCoordinatorTaskRecoveryAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createCoordinatorTaskRecoveryAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency createCoordinatorTaskRecoveryAdapterは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function createCoordinatorTaskRecoveryAdapter(
  workingDirectory: string,
  repositoryBindingId: string,
  dependencies: CoordinatorTaskRecoveryHostDependencies,
): CoordinatorTaskRecoveryPort {
  return Object.freeze({
    resolveCorrelations: (correlationIds: readonly string[]) =>
      dependencies.resolveTaskRecoveryCorrelations?.(correlationIds) ?? null,
    recover: (recoveryId: string, signal: AbortSignal) =>
      dependencies.recoverTaskRecovery?.(recoveryId, signal) ?? null,
    acknowledgeDocker: (identity: CoordinatorDockerRecoveryIdentity) =>
      dependencies.acknowledgeTaskRecovery?.(
        Object.freeze({
          workingDirectory,
          repositoryBindingId,
          ...identity,
        }),
      ) ?? null,
    observeTransition: async (event: CoordinatorRecoveryTransition) => {
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
