import {
  createWindowsDockerCliEnvironment,
  createWindowsDockerDesktopRepairHelperEnvironment,
  createWindowsHostOperationSupervisorEnvironment,
  createWindowsNativeHelperEnvironment,
} from "../core/windows-child-environment.ts";
import { inspectRuntimeOwnedDockerTaskRecoveryState } from "./docker-recovery-runtime.ts";
import {
  PROJECT_RUNTIME_PLATFORM_CONTRACT,
  PROJECT_RUNTIME_PLATFORM_CONTRACT_REVISION,
  type ProjectRuntimePlatformAdapter,
  type ProjectRuntimePlatformBoundary,
} from "../../../project-runtime/src/index.ts";
import { inspectRuntimeOwnedWindowsProviderHomeCandidate } from "./provider-home-windows-adapter.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "./repository-root-resolution.ts";
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
  "repository_git_boundary_invalid",
]);

const CHILD_ENVIRONMENT_PROFILES = new Set([
  "native_helper",
  "docker_desktop_repair_helper",
  "host_operation_supervisor",
  "docker_cli",
]);

export type ProjectRuntimeWindowsRepositoryRootResult =
  | Readonly<{ status: "resolved"; repositoryRoot: string }>
  | Readonly<{ status: "blocked"; reason: string }>;

export type ProjectRuntimeWindowsChildEnvironmentResult =
  | Readonly<{
      status: "derived";
      profile: string;
      environment: Readonly<Record<string, string>>;
    }>
  | Readonly<{ status: "blocked"; reason: string }>;

export type ProjectRuntimeWindowsLeaseOwnerObservation = Readonly<{
  status: "alive" | "absent" | "unknown";
  ownerProcessId: number;
  ownerGeneration: string;
}>;

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
 * token into Project Runtime Core. Core receives only the closed family name
 * and must fail closed when the observation is blocked.
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
 * implementation that already exists for the v0.18 Single Task Runtime and
 * keeps that implementation's own contract; the adapter adds no behavior, no
 * authority and no fallback. Observation results are data, not capabilities.
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
