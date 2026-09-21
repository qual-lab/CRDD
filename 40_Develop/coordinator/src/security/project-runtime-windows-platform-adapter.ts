/**
 * project-runtime-windows-platform-adapterに属する責務をまとめる。
 *
 * @responsibility ProjectRuntimeWindowsRepositoryRootResultを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import {
  PROJECT_RUNTIME_PLATFORM_CONTRACT,
  PROJECT_RUNTIME_PLATFORM_CONTRACT_REVISION,
  type ProjectRuntimePlatformAdapter,
  type ProjectRuntimePlatformBoundary,
} from "../../../project-runtime/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/repository-location.ts";
import {
  createWindowsDockerCliEnvironment,
  createWindowsDockerDesktopRepairHelperEnvironment,
  createWindowsHostOperationSupervisorEnvironment,
  createWindowsNativeHelperEnvironment,
} from "../core/windows-child-environment.ts";
import { inspectRuntimeOwnedDockerTaskRecoveryState } from "./docker-recovery-runtime.ts";
import { inspectRuntimeOwnedWindowsProviderHomeCandidate } from "./provider-home-windows-adapter.ts";
import { compileWindowsRootObservationCandidate } from "./root-observation.ts";

export const PROJECT_RUNTIME_WINDOWS_PLATFORM_FAMILY = "windows" as const;

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

const CHILD_ENVIRONMENT_PROFILES = new Set([
  "native_helper",
  "docker_desktop_repair_helper",
  "host_operation_supervisor",
  "docker_cli",
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
 * project-runtime-windows-platform-adapterで使用するProject Runtime Windows Child Environment 結果の値契約を定義する。
 *
 * @responsibility Project Runtime Windows Child Environment 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeWindowsChildEnvironmentResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeWindowsChildEnvironmentResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeWindowsChildEnvironmentResultの宣言は外部境界を開かない。
 * @security ProjectRuntimeWindowsChildEnvironmentResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProjectRuntimeWindowsChildEnvironmentResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeWindowsChildEnvironmentResult =
  | Readonly<{
      status: "derived";
      profile: string;
      environment: Readonly<Record<string, string>>;
    }>
  | Readonly<{ status: "blocked"; reason: string }>;

/**
 * project-runtime-windows-platform-adapterで使用するProject Runtime Windows Lease 所有者 Observationの値契約を定義する。
 *
 * @responsibility Project Runtime Windows Lease 所有者 ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeWindowsLeaseOwnerObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeWindowsLeaseOwnerObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeWindowsLeaseOwnerObservationの宣言は外部境界を開かない。
 * @security ProjectRuntimeWindowsLeaseOwnerObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProjectRuntimeWindowsLeaseOwnerObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeWindowsLeaseOwnerObservation = Readonly<{
  status: "alive" | "absent" | "unknown";
  ownerProcessId: number;
  ownerGeneration: string;
}>;

/**
 * Lease 所有者を観測する。
 *
 * @responsibility Lease 所有者の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawOwner: unknown
 * @returns ProjectRuntimeWindowsLeaseOwnerObservationを返す。
 * @precondition 「rawOwner: unknown」がobserveLeaseOwnerの入力契約を満たす。
 * @postcondition observeLeaseOwnerの責務を完了した結果だけを返す。
 * @effect observeLeaseOwnerは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure observeLeaseOwnerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeLeaseOwnerは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security observeLeaseOwnerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeLeaseOwnerは共有非同期状態を持たない同期処理である。
 */
function observeLeaseOwner(
  rawOwner: unknown,
): ProjectRuntimeWindowsLeaseOwnerObservation {
  const invalid = Object.freeze({
    status: "unknown" as const,
    ownerProcessId: 0,
    ownerGeneration: "invalid",
  });
  if (
    !rawOwner ||
    typeof rawOwner !== "object" ||
    Array.isArray(rawOwner) ||
    Object.getPrototypeOf(rawOwner) !== Object.prototype
  )
    return invalid;
  const owner = rawOwner as Readonly<Record<string, unknown>>;
  if (
    Object.keys(owner).sort().join("\0") !==
      ["ownerGeneration", "ownerProcessId"].sort().join("\0") ||
    !Number.isSafeInteger(owner.ownerProcessId) ||
    Number(owner.ownerProcessId) < 1 ||
    typeof owner.ownerGeneration !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(owner.ownerGeneration)
  )
    return invalid;
  const ownerProcessId = Number(owner.ownerProcessId);
  const ownerGeneration = owner.ownerGeneration;
  try {
    // Signal 0 performs existence/permission observation only.  EPERM is not
    // absence; it is deliberately kept unknown.  A PID reused by another
    // process is reported alive, preserving the non-time-only takeover rule.
    process.kill(ownerProcessId, 0);
    return Object.freeze({
      status: "alive" as const,
      ownerProcessId,
      ownerGeneration,
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : null;
    return Object.freeze({
      status: code === "ESRCH" ? ("absent" as const) : ("unknown" as const),
      ownerProcessId,
      ownerGeneration,
    });
  }
}

/**
 * Observe the current process platform family without exporting the raw OS
 *
 * @responsibility Project Runtime Platform Familyの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns | Readonly<{ status: "observed"; platformFamily: string }> | Readonly<{ status: "blocked"; reason: "platform_identity_unknown" }>を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がobserveProjectRuntimePlatformFamilyの入力契約を満たす。
 * @postcondition observeProjectRuntimePlatformFamilyの責務を完了した結果だけを返す。
 * @effect observeProjectRuntimePlatformFamilyは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: observeProjectRuntimePlatformFamilyは独自の失敗分岐を所有しない。
 * @invariant observeProjectRuntimePlatformFamilyは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security observeProjectRuntimePlatformFamilyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeProjectRuntimePlatformFamilyは共有非同期状態を持たない同期処理である。
 */
export function observeProjectRuntimePlatformFamily():
  | Readonly<{ status: "observed"; platformFamily: string }>
  | Readonly<{ status: "blocked"; reason: "platform_identity_unknown" }> {
  if (process.platform === "win32")
    return Object.freeze({
      status: "observed" as const,
      platformFamily: PROJECT_RUNTIME_WINDOWS_PLATFORM_FAMILY,
    });
  return Object.freeze({
    status: "blocked" as const,
    reason: "platform_identity_unknown" as const,
  });
}

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
 * derive Child Environmentを決定する。
 *
 * @responsibility derive Child Environmentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown
 * @returns ProjectRuntimeWindowsChildEnvironmentResultを返す。
 * @precondition 「rawRequest: unknown」がderiveChildEnvironmentの入力契約を満たす。
 * @postcondition deriveChildEnvironmentの責務を完了した結果だけを返す。
 * @effect N/A: deriveChildEnvironmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: deriveChildEnvironmentは独自の失敗分岐を所有しない。
 * @invariant deriveChildEnvironmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security deriveChildEnvironmentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: deriveChildEnvironmentは共有非同期状態を持たない同期処理である。
 */
function deriveChildEnvironment(
  rawRequest: unknown,
): ProjectRuntimeWindowsChildEnvironmentResult {
  const blocked = (reason: string) =>
    Object.freeze({ status: "blocked" as const, reason });
  if (
    !rawRequest ||
    typeof rawRequest !== "object" ||
    Array.isArray(rawRequest)
  )
    return blocked("windows_child_environment_request_invalid");
  const request = rawRequest as Readonly<Record<string, unknown>>;
  const profile = request.profile;
  if (typeof profile !== "string" || !CHILD_ENVIRONMENT_PROFILES.has(profile))
    return blocked("windows_child_environment_request_invalid");
  let environment: Readonly<Record<string, string>> | null = null;
  if (profile === "native_helper") {
    if (Object.keys(request).length !== 1)
      return blocked("windows_child_environment_request_invalid");
    environment = createWindowsNativeHelperEnvironment();
  } else if (profile === "docker_desktop_repair_helper") {
    if (Object.keys(request).length !== 1)
      return blocked("windows_child_environment_request_invalid");
    environment = createWindowsDockerDesktopRepairHelperEnvironment();
  } else if (profile === "host_operation_supervisor") {
    if (Object.keys(request).length !== 1)
      return blocked("windows_child_environment_request_invalid");
    environment = createWindowsHostOperationSupervisorEnvironment();
  } else {
    const dockerConfig = request.dockerConfig;
    const dockerHome = request.dockerHome;
    if (
      Object.keys(request).length !== 3 ||
      (dockerConfig !== null && typeof dockerConfig !== "string") ||
      (dockerHome !== null && typeof dockerHome !== "string") ||
      (dockerConfig === null) !== (dockerHome === null)
    )
      return blocked("windows_child_environment_request_invalid");
    environment = createWindowsDockerCliEnvironment({
      dockerConfig,
      dockerHome,
    });
  }
  if (environment === null)
    return blocked("windows_child_environment_unavailable");
  return Object.freeze({
    status: "derived" as const,
    profile,
    environment,
  });
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
