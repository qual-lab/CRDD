import { spawnSync } from "node:child_process";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
  createWindowsNativeHelperEnvironment,
  WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
} from "../core/windows-child-environment.ts";
import { isSupportedWindowsAbsolutePathCandidate } from "./authority-root-path-lexical.ts";
import { borrowRuntimeOwnedDevelopmentNativeObservation } from "./development-measurement-session.ts";
import {
  beginPlatformAccessArtifactSigningObservation,
  observePlatformAccessReleaseArtifactCandidate,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  verifyPlatformAccessArtifactSigningObservation,
} from "./platform-access-release.ts";
import { verifyBundledCoordinatorPackageFromFixedManifestCandidate } from "./platform-provisioner-package-filesystem.ts";
import {
  createProviderHomeObservationRequest,
  evaluateProviderHomeObservationResponseCandidate,
  PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES,
  type ProviderHomeObservationProvider,
} from "./provider-home-observation.ts";

export const PROVIDER_HOME_WINDOWS_ADAPTER_CONTRACT =
  "crdd-coordinator/provider-home-windows-adapter";
export const PROVIDER_HOME_WINDOWS_ADAPTER_CONTRACT_REVISION = 5;

const bundledDistributionRoot = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const executablePath = path.join(
  bundledDistributionRoot,
  ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
);
const HELPER_TIMEOUT_MS = 5_000;
const OBSERVATION_CAPABILITY_MAXIMUM_AGE_MS = 10_000;
const observationCapabilities = new WeakMap<
  object,
  Readonly<{
    provider: ProviderHomeObservationProvider;
    providerHomeIdentityHash: string;
    providerHomeProtectionHash: string;
    localUserBindingHash: string;
    stableLogicalHomeBindingHash: string;
    observedWallClockMs: number;
    observedMonotonicMs: number;
    providerHomeMountSourceCapability: object;
  }>
>();
const mountSourceCapabilities = new WeakMap<
  object,
  Readonly<{
    provider: ProviderHomeObservationProvider;
    sourcePath: string;
  }>
>();

function runtimeOwnedProviderHomeMountSourceCandidate(provider: unknown) {
  if (provider !== "codex" && provider !== "claude") return null;
  const localAppData = process.env.LOCALAPPDATA;
  if (
    !isSupportedWindowsAbsolutePathCandidate(localAppData) ||
    path.win32.normalize(localAppData) !== localAppData
  ) {
    return null;
  }
  const sourcePath = path.win32.join(
    localAppData,
    "Qual-Lab",
    "CRDD",
    "ProviderHomes",
    provider,
  );
  return isSupportedWindowsAbsolutePathCandidate(sourcePath) &&
    !sourcePath.includes(",")
    ? sourcePath
    : null;
}

function blocked(
  reason: string,
  processEffectIssued = false,
  helperSpawned = false,
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    provider: null,
    providerHomeIdentityHash: null,
    providerHomeProtectionHash: null,
    localUserBindingHash: null,
    stableLogicalHomeBindingHash: null,
    selectedUserBindingVerified: false,
    protectionVerified: false,
    stableIdentityObserved: false,
    releaseIdentityVerified: false,
    artifactVerifiedBeforeAndAfter: false,
    helperSpawnAttempts: helperSpawned ? 1 : 0,
    helperSpawned,
    helperExitConfirmed: false,
    processTreeTerminationConfirmed: false,
    pathReported: false,
    principalReported: false,
    aclReported: false,
    credentialContentRead: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    observationCapability: null,
    runtimeOwnedObservationCapabilityIssued: false,
    mountGrantIssued: false,
    manualRecoveryRequired: processEffectIssued,
  });
}

type Artifact = Readonly<{
  relativePath: string;
  target: string;
  protocolRevision: number;
  rustToolchain: string;
  byteLength: number;
  sha256: string;
}>;

function sameArtifact(left: unknown, right: unknown): boolean {
  if (
    !left ||
    !right ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }
  const first = left as Partial<Artifact>;
  const second = right as Partial<Artifact>;
  return (
    first.relativePath === second.relativePath &&
    first.target === second.target &&
    first.protocolRevision === second.protocolRevision &&
    first.rustToolchain === second.rustToolchain &&
    first.byteLength === second.byteLength &&
    first.sha256 === second.sha256
  );
}

export function inspectRuntimeOwnedWindowsProviderHomeCandidate(
  provider: unknown,
  evaluationTime: unknown,
  developmentContext?: unknown,
) {
  if (process.platform !== "win32") {
    return blocked("provider_home_windows_adapter_platform_unsupported");
  }
  const mountSourcePath =
    runtimeOwnedProviderHomeMountSourceCandidate(provider);
  const request = createProviderHomeObservationRequest(
    provider,
    mountSourcePath,
  );
  if (!request) {
    return blocked("provider_home_windows_adapter_provider_invalid");
  }
  const development =
    developmentContext === undefined
      ? null
      : borrowRuntimeOwnedDevelopmentNativeObservation(
          developmentContext as object,
          false,
        );
  if (developmentContext !== undefined && !development)
    return blocked("provider_home_windows_adapter_development_context_invalid");
  const distributionRoot =
    development?.distributionRoot ?? bundledDistributionRoot;
  const packageVerification = development
    ? development.verification
    : verifyBundledCoordinatorPackageFromFixedManifestCandidate({
        evaluationTime,
      });
  if (
    packageVerification.status !== "candidate" ||
    (!development &&
      (!("runtimeOwnedReleaseTrustConfirmed" in packageVerification) ||
        packageVerification.runtimeOwnedReleaseTrustConfirmed !== true ||
        !("releaseIdentityRuntimeOwned" in packageVerification) ||
        packageVerification.releaseIdentityRuntimeOwned !== true ||
        !("crddDistributionConfirmed" in packageVerification) ||
        packageVerification.crddDistributionConfirmed !== true))
  ) {
    return blocked("provider_home_windows_adapter_release_not_verified");
  }
  const artifactBefore =
    observePlatformAccessReleaseArtifactCandidate(distributionRoot);
  const signingObservation =
    beginPlatformAccessArtifactSigningObservation(distributionRoot);
  if (
    artifactBefore.status !== "candidate" ||
    !signingObservation ||
    !sameArtifact(
      packageVerification.platformAccessArtifact,
      artifactBefore.artifact,
    ) ||
    !sameArtifact(artifactBefore.artifact, signingObservation.artifact)
  ) {
    return blocked("provider_home_windows_adapter_artifact_not_verified");
  }

  const environment = createWindowsNativeHelperEnvironment();
  if (!environment)
    return blocked("provider_home_windows_adapter_environment_unavailable");
  const selectedExecutable = development
    ? path.join(
        distributionRoot,
        ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
      )
    : executablePath;
  const execution = spawnSync(selectedExecutable, [], {
    input: request.request,
    encoding: "buffer",
    env: environment,
    shell: false,
    windowsHide: true,
    timeout: HELPER_TIMEOUT_MS,
    maxBuffer: PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES + 1,
  });
  const processEffectIssued = execution.pid !== undefined;
  if (
    execution.error ||
    execution.signal !== null ||
    execution.status !== 0 ||
    !Buffer.isBuffer(execution.stdout) ||
    execution.stdout.byteLength !== PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES ||
    !Buffer.isBuffer(execution.stderr) ||
    execution.stderr.byteLength !== 0
  ) {
    return blocked(
      "provider_home_windows_adapter_helper_failed",
      processEffectIssued,
      processEffectIssued,
    );
  }
  if (
    !verifyPlatformAccessArtifactSigningObservation(signingObservation.token)
  ) {
    return blocked(
      "provider_home_windows_adapter_artifact_changed",
      true,
      true,
    );
  }
  const artifactAfter =
    observePlatformAccessReleaseArtifactCandidate(distributionRoot);
  if (
    artifactAfter.status !== "candidate" ||
    !sameArtifact(artifactBefore.artifact, artifactAfter.artifact) ||
    (developmentContext !== undefined &&
      !borrowRuntimeOwnedDevelopmentNativeObservation(
        developmentContext as object,
        false,
      ))
  ) {
    return blocked(
      "provider_home_windows_adapter_artifact_changed",
      true,
      true,
    );
  }
  const observation = evaluateProviderHomeObservationResponseCandidate(
    execution.stdout,
    request.nonce,
    request.provider,
  );
  if (observation.status !== "candidate") {
    return blocked(
      "provider_home_windows_adapter_response_invalid",
      true,
      true,
    );
  }
  const observedWallClockMs = Date.now();
  const observedMonotonicMs = performance.now();
  const observationCapability = Object.freeze({});
  const providerHomeMountSourceCapability = Object.freeze({});
  mountSourceCapabilities.set(
    providerHomeMountSourceCapability,
    Object.freeze({
      provider: request.provider,
      sourcePath: mountSourcePath as string,
    }),
  );
  observationCapabilities.set(
    observationCapability,
    Object.freeze({
      provider: request.provider,
      providerHomeIdentityHash: observation.providerHomeIdentityHash,
      providerHomeProtectionHash: observation.providerHomeProtectionHash,
      localUserBindingHash: observation.localUserBindingHash,
      stableLogicalHomeBindingHash: observation.stableLogicalHomeBindingHash,
      observedWallClockMs,
      observedMonotonicMs,
      providerHomeMountSourceCapability,
    }),
  );
  return Object.freeze({
    ...observation,
    reason: "runtime_owned_windows_provider_home_observed_candidate",
    provider: request.provider as ProviderHomeObservationProvider,
    releaseIdentityVerified: development === null,
    nativeReleaseIdentityVerified: true,
    executionSourceKind: development
      ? "fixed_development_candidate"
      : "signed_release",
    artifactVerifiedBeforeAndAfter: true,
    helperSpawnAttempts: 1,
    helperSpawned: true,
    helperExitConfirmed: true,
    processTreeTerminationConfirmed: false,
    processEffectIssued: true,
    manualRecoveryRequired: false,
    observationCapability: observationCapability as object,
    runtimeOwnedObservationCapabilityIssued: true,
  });
}

export function consumeRuntimeOwnedProviderHomeObservationCapability(
  capability: unknown,
) {
  if (!capability || typeof capability !== "object") return null;
  const observation = observationCapabilities.get(capability);
  observationCapabilities.delete(capability);
  if (!observation) return null;
  const wallAge = Date.now() - observation.observedWallClockMs;
  const monotonicAge = performance.now() - observation.observedMonotonicMs;
  if (
    !Number.isFinite(wallAge) ||
    !Number.isFinite(monotonicAge) ||
    wallAge < 0 ||
    monotonicAge < 0 ||
    wallAge > OBSERVATION_CAPABILITY_MAXIMUM_AGE_MS ||
    monotonicAge > OBSERVATION_CAPABILITY_MAXIMUM_AGE_MS
  ) {
    mountSourceCapabilities.delete(
      observation.providerHomeMountSourceCapability,
    );
    return null;
  }
  return observation;
}

export function consumeRuntimeOwnedProviderHomeMountSourceCapability(
  capability: unknown,
  expectedProvider: unknown,
) {
  if (!capability || typeof capability !== "object") return null;
  const source = mountSourceCapabilities.get(capability);
  mountSourceCapabilities.delete(capability);
  return source && source.provider === expectedProvider
    ? source.sourcePath
    : null;
}

export function revokeRuntimeOwnedProviderHomeMountSourceCapability(
  capability: unknown,
) {
  return (
    !!capability &&
    typeof capability === "object" &&
    mountSourceCapabilities.delete(capability)
  );
}

export function describeProviderHomeWindowsAdapterContract() {
  return Object.freeze({
    contract: PROVIDER_HOME_WINDOWS_ADAPTER_CONTRACT,
    contractRevision: PROVIDER_HOME_WINDOWS_ADAPTER_CONTRACT_REVISION,
    platform: "windows",
    distributionRoot: "module_relative_fixed_distribution_root",
    releaseVerification:
      "fixed_signed_manifest_release_identity_and_artifact_hash_before_and_after",
    executablePath: "fixed_release_relative_absolute_path",
    providers: Object.freeze(["codex", "claude"]),
    shellInvocation: false,
    pathLookup: false,
    callerSuppliedPathAccepted: false,
    inheritedEnvironmentPathTrustedDirectly: false,
    mountSourceBinding:
      "runtime_candidate_hash_exactly_matched_by_native_known_folder_derivation",
    environment: WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
    environmentUnavailable: Object.freeze({
      helperSpawnAttempts: 0,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
      observationCapabilityIssued: false,
      runtimeAuthorityIssued: false,
    }),
    timeoutMs: HELPER_TIMEOUT_MS,
    maximumStdoutBytes: PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES,
    maximumStderrBytes: 0,
    helperSpawnAttempts: 1,
    helperChildProcessImplementation: false,
    helperExitRequired: true,
    processTreeTerminationConfirmation:
      "not_implemented_step_4_runtime_process_controller_required",
    rawPathReported: false,
    rawPathAvailableOnlyToTrustedMountEffectAdapter: true,
    rawPrincipalReported: false,
    rawAclReported: false,
    credentialContentRead: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    observationCapability: "runtime_owned_opaque_single_use_maximum_10_seconds",
    observationCapabilityMaximumAgeMs: OBSERVATION_CAPABILITY_MAXIMUM_AGE_MS,
    mountGrantIssued: false,
  });
}
