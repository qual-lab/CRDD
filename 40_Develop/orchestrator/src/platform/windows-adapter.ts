/**
 * Orchestrator向けのWindows保証選択とHost接続を組み立てる。
 *
 * @responsibility 上位Platform契約の対応範囲を固定し、部分保証を全体完成へ昇格しない。
 * @trace ARCH-000004
 */
import {
  ORCHESTRATOR_PLATFORM_CONTRACT,
  ORCHESTRATOR_PLATFORM_CONTRACT_REVISION,
  type OrchestratorPlatformAdapter,
  type OrchestratorPlatformBoundary,
} from "./contract.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import {
  createWindowsHostOperationSupervisorEnvironment,
  createWindowsNativeHelperEnvironment,
  observeProcessLiveness,
} from "../../../platform-access/src/index.ts";
import { inspectRuntimeOwnedWindowsProviderHomeCandidate } from "../../../coordinator/src/execution/provider-home-windows-adapter.ts";
import { compileWindowsRootObservationCandidate } from "../../../coordinator/src/execution/root-observation.ts";

const ORCHESTRATOR_WINDOWS_PLATFORM_FAMILY = "windows" as const;

const CHILD_ENVIRONMENT_PROFILES = new Set([
  "native_helper",
  "host_operation_supervisor",
]);

/**
 * orchestrator-windows-platform-adapterで使用するOrchestrator Windows Child Environment 結果の値契約を定義する。
 *
 * @responsibility Orchestrator Windows Child Environment 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorWindowsChildEnvironmentResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorWindowsChildEnvironmentResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorWindowsChildEnvironmentResultの宣言は外部境界を開かない。
 * @security OrchestratorWindowsChildEnvironmentResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OrchestratorWindowsChildEnvironmentResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorWindowsChildEnvironmentResult =
  | Readonly<{
      status: "derived";
      profile: string;
      environment: Readonly<Record<string, string>>;
    }>
  | Readonly<{ status: "blocked"; reason: string }>;

/**
 * orchestrator-windows-platform-adapterで使用するOrchestrator Windows Lease 所有者 Observationの値契約を定義する。
 *
 * @responsibility Orchestrator Windows Lease 所有者 ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorWindowsLeaseOwnerObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorWindowsLeaseOwnerObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorWindowsLeaseOwnerObservationの宣言は外部境界を開かない。
 * @security OrchestratorWindowsLeaseOwnerObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OrchestratorWindowsLeaseOwnerObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorWindowsLeaseOwnerObservation = Readonly<{
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
 * @returns OrchestratorWindowsLeaseOwnerObservationを返す。
 * @precondition 「rawOwner: unknown」がobserveLeaseOwnerの入力契約を満たす。
 * @postcondition observeLeaseOwnerの責務を完了した結果だけを返す。
 * @effect observeLeaseOwnerは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure observeLeaseOwnerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeLeaseOwnerは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security observeLeaseOwnerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeLeaseOwnerは共有非同期状態を持たない同期処理である。
 */
export function observeLeaseOwner(
  rawOwner: unknown,
): OrchestratorWindowsLeaseOwnerObservation {
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
  return Object.freeze({
    status: observeProcessLiveness(ownerProcessId),
    ownerProcessId,
    ownerGeneration,
  });
}

/**
 * derive Child Environmentを決定する。
 *
 * @responsibility derive Child Environmentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown
 * @returns OrchestratorWindowsChildEnvironmentResultを返す。
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
): OrchestratorWindowsChildEnvironmentResult {
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
  } else if (profile === "host_operation_supervisor") {
    if (Object.keys(request).length !== 1)
      return blocked("windows_child_environment_request_invalid");
    environment = createWindowsHostOperationSupervisorEnvironment();
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
] as const satisfies readonly OrchestratorPlatformBoundary[]);

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
 * orchestrator-windows-platform-adapterで使用するOrchestrator Windows Repository Root 結果の値契約を定義する。
 *
 * @responsibility Orchestrator Windows Repository Root 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorWindowsRepositoryRootResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorWindowsRepositoryRootResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorWindowsRepositoryRootResultの宣言は外部境界を開かない。
 * @security OrchestratorWindowsRepositoryRootResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OrchestratorWindowsRepositoryRootResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorWindowsRepositoryRootResult =
  | Readonly<{ status: "resolved"; repositoryRoot: string }>
  | Readonly<{ status: "blocked"; reason: string }>;

/**
 * Repository Rootを一意に解決する。
 *
 * @responsibility Repository Rootの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: unknown
 * @returns OrchestratorWindowsRepositoryRootResultを返す。
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
): OrchestratorWindowsRepositoryRootResult {
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
 * @responsibility Orchestrator Windows Platform Adapterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns OrchestratorPlatformAdapterを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateOrchestratorWindowsPlatformAdapterの入力契約を満たす。
 * @postcondition createOrchestratorWindowsPlatformAdapterの責務を完了した結果だけを返す。
 * @effect N/A: createOrchestratorWindowsPlatformAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createOrchestratorWindowsPlatformAdapterは独自の失敗分岐を所有しない。
 * @invariant createOrchestratorWindowsPlatformAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createOrchestratorWindowsPlatformAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOrchestratorWindowsPlatformAdapterは共有非同期状態を持たない同期処理である。
 */
export function createOrchestratorWindowsPlatformAdapter(): OrchestratorPlatformAdapter {
  return Object.freeze({
    describe: () =>
      Object.freeze({
        contract: ORCHESTRATOR_PLATFORM_CONTRACT,
        contractRevision: ORCHESTRATOR_PLATFORM_CONTRACT_REVISION,
        platformFamily: ORCHESTRATOR_WINDOWS_PLATFORM_FAMILY,
        supportedBoundaries: SUPPORTED_BOUNDARIES,
        satisfiedGuarantees: SATISFIED_GUARANTEES,
        authorityGeneration: "none" as const,
        unsupportedPlatformFallback: "none" as const,
      }),
    operations: Object.freeze({
      principal_provider_home: Object.freeze({
        observeProviderHomeCandidate: (provider: unknown) =>
          inspectRuntimeOwnedWindowsProviderHomeCandidate(provider),
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
      runtime_root_recovery: Object.freeze({
        compileRootObservationCandidate: (rawObservation: unknown) =>
          compileWindowsRootObservationCandidate(rawObservation),
      }),
    }),
  });
}
