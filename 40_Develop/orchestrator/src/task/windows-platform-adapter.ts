/**
 * Orchestrator向けのWindows保証選択とHost接続を組み立てる。
 *
 * @responsibility 上位Platform契約の対応範囲を固定し、部分保証を全体完成へ昇格しない。
 * @trace ARCH-000004
 */
import {
  PROJECT_RUNTIME_PLATFORM_CONTRACT,
  PROJECT_RUNTIME_PLATFORM_CONTRACT_REVISION,
  type ProjectRuntimePlatformAdapter,
  type ProjectRuntimePlatformBoundary,
} from "../index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/repository-location.ts";
import {
  deriveChildEnvironment,
  observeLeaseOwner,
  observeProjectRuntimePlatformFamily,
  PROJECT_RUNTIME_WINDOWS_PLATFORM_FAMILY,
} from "../../../coordinator/src/host-runtime/windows-platform-observation.ts";
import { inspectRuntimeOwnedDockerTaskRecoveryState } from "../../../coordinator/src/docker-runtime/docker-recovery-runtime.ts";
import { inspectRuntimeOwnedWindowsProviderHomeCandidate } from "../../../coordinator/src/provider/provider-home-windows-adapter.ts";
import { compileWindowsRootObservationCandidate } from "../../../coordinator/src/repository-operation/root-observation.ts";

export { observeProjectRuntimePlatformFamily };

/**
 * Project lease acquisition remains owned by the durable foundation.  This
 * adapter owns only the OS observation used when a later process reconciles a
 * recorded owner.  A reused PID is conservatively reported as alive, which
 * can delay recovery but can never authorize unsafe takeover.
 */
// Only Principal / Provider Home currently satisfies the complete guarantee
// population fixed by the reference architecture.  The other operation
// groups below are useful extraction candidates, but remain partial and must
// not make their whole boundary resolvable.
const SUPPORTED_BOUNDARIES = Object.freeze([
  "principal_provider_home",
  "lock_lease",
] as const satisfies readonly ProjectRuntimePlatformBoundary[]);

const SATISFIED_GUARANTEES = Object.freeze({
  principal_provider_home: Object.freeze([
    "selected_principal_identity",
    "stable_provider_home_identity",
    "owner_writer_protection",
    "non_link_chain",
  ]),
  lock_lease: Object.freeze([
    "os_exclusivity",
    "owner_generation",
    "owner_liveness",
    "non_time_only_takeover",
  ]),
  filesystem_repository: Object.freeze([
    "repository_root_identity",
    "bounded_path_resolution",
  ]),
  process_cancellation: Object.freeze(["environment"]),
  container_host: Object.freeze(["cleanup"]),
  runtime_root_recovery: Object.freeze([
    "managed_root",
    "protection",
    "resource_identity",
  ]),
} as const);

const REPOSITORY_ROOT_BLOCKED_REASONS = new Set([
  "repository_working_directory_invalid",
  "repository_root_observation_failed",
  "verified_repository_root_required",
  "repository_root_identity_mismatch",
  "repository_boundary_invalid",
]);

/**
 * project-runtime-windows-platform-adapterで使用するProject Runtime Windows Repository Root 結果の値契約を定義する。
 *
 * @responsibility Project Runtime Windows Repository Root 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeWindowsRepositoryRootResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeWindowsRepositoryRootResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeWindowsRepositoryRootResultの宣言は外部境界を開かない。
 * @security ProjectRuntimeWindowsRepositoryRootResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProjectRuntimeWindowsRepositoryRootResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeWindowsRepositoryRootResult =
  | Readonly<{ status: "resolved"; repositoryRoot: string }>
  | Readonly<{ status: "blocked"; reason: string }>;

/**
 * Repository Rootを一意に解決する。
 *
 * @responsibility Repository Rootの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: unknown
 * @returns ProjectRuntimeWindowsRepositoryRootResultを返す。
 * @precondition 「workingDirectory: unknown」がresolveRepositoryRootの入力契約を満たす。
 * @postcondition resolveRepositoryRootの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure resolveRepositoryRootは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveRepositoryRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security resolveRepositoryRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRepositoryRootは共有非同期状態を持たない同期処理である。
 */
function resolveRepositoryRoot(
  workingDirectory: unknown,
): ProjectRuntimeWindowsRepositoryRootResult {
  try {
    return Object.freeze({
      status: "resolved" as const,
      repositoryRoot:
        resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Object.freeze({
      status: "blocked" as const,
      reason: REPOSITORY_ROOT_BLOCKED_REASONS.has(message)
        ? message
        : "repository_root_observation_failed",
    });
  }
}

/**
 * IF-PLATFORM Windows adapter. Every operation routes a closed request to an
 *
 * @responsibility Project Runtime Windows Platform Adapterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns ProjectRuntimePlatformAdapterを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateProjectRuntimeWindowsPlatformAdapterの入力契約を満たす。
 * @postcondition createProjectRuntimeWindowsPlatformAdapterの責務を完了した結果だけを返す。
 * @effect N/A: createProjectRuntimeWindowsPlatformAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createProjectRuntimeWindowsPlatformAdapterは独自の失敗分岐を所有しない。
 * @invariant createProjectRuntimeWindowsPlatformAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createProjectRuntimeWindowsPlatformAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createProjectRuntimeWindowsPlatformAdapterは共有非同期状態を持たない同期処理である。
 */
export function createProjectRuntimeWindowsPlatformAdapter(): ProjectRuntimePlatformAdapter {
  return Object.freeze({
    describe: () =>
      Object.freeze({
        contract: PROJECT_RUNTIME_PLATFORM_CONTRACT,
        contractRevision: PROJECT_RUNTIME_PLATFORM_CONTRACT_REVISION,
        platformFamily: PROJECT_RUNTIME_WINDOWS_PLATFORM_FAMILY,
        supportedBoundaries: SUPPORTED_BOUNDARIES,
        satisfiedGuarantees: SATISFIED_GUARANTEES,
        authorityGeneration: "none" as const,
        unsupportedPlatformFallback: "none" as const,
      }),
    operations: Object.freeze({
      principal_provider_home: Object.freeze({
        observeProviderHomeCandidate: (
          provider: unknown,
          evaluationTime: unknown,
        ) =>
          inspectRuntimeOwnedWindowsProviderHomeCandidate(
            provider,
            evaluationTime,
          ),
      }),
      lock_lease: Object.freeze({
        observeLeaseOwner,
      }),
      filesystem_repository: Object.freeze({
        resolveRepositoryRoot,
      }),
      process_cancellation: Object.freeze({
        deriveChildEnvironment,
      }),
      container_host: Object.freeze({
        observeContainerHostRecoveryState: () =>
          inspectRuntimeOwnedDockerTaskRecoveryState(),
      }),
      runtime_root_recovery: Object.freeze({
        compileRootObservationCandidate: (rawObservation: unknown) =>
          compileWindowsRootObservationCandidate(rawObservation),
      }),
    }),
  });
}
