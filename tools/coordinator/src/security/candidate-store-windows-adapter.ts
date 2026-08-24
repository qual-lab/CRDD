import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isSupportedWindowsAbsolutePathCandidate } from "./authority-root-path-lexical.ts";
import {
  createCandidateStoreObservationRequest,
  evaluateCandidateStoreObservationResponseCandidate,
  PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES,
} from "./provider-home-observation.ts";
import {
  beginPlatformAccessArtifactSigningObservation,
  observePlatformAccessReleaseArtifactCandidate,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  verifyPlatformAccessArtifactSigningObservation,
} from "./platform-access-release.ts";
import { verifyBundledCoordinatorPackageFromFixedManifestCandidate } from "./platform-provisioner-package-filesystem.ts";

const HELPER_TIMEOUT_MS = 5_000;
const bundledDistributionRoot = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const executablePath = path.join(
  bundledDistributionRoot,
  ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
);
const rootCapabilities = new WeakMap<
  object,
  Readonly<{
    rootPath: string;
    candidateStoreIdentityHash: string;
    candidateStoreProtectionHash: string;
    localUserBindingHash: string;
  }>
>();

type Artifact = Readonly<{
  relativePath: string;
  target: string;
  protocolRevision: number;
  rustToolchain: string;
  byteLength: number;
  sha256: string;
}>;

function sameArtifact(left: unknown, right: unknown) {
  if (!left || !right || typeof left !== "object" || typeof right !== "object")
    return false;
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

function blocked(
  reason: string,
  effects: Readonly<{
    processEffectIssued?: boolean;
    helperExitConfirmed?: boolean;
    filesystemEffectIssued?: boolean;
  }> = Object.freeze({}),
) {
  const processEffectIssued = effects.processEffectIssued === true;
  const filesystemEffectIssued = effects.filesystemEffectIssued === true;
  return Object.freeze({
    status: "blocked" as const,
    reason,
    rootCapability: null,
    candidateStoreIdentityHash: null,
    candidateStoreProtectionHash: null,
    localUserBindingHash: null,
    selectedUserBindingVerified: false,
    protectionVerified: false,
    stableIdentityObserved: false,
    releaseIdentityVerified: false,
    artifactVerifiedBeforeAndAfter: false,
    helperSpawnAttempts: processEffectIssued ? 1 : 0,
    helperExitConfirmed: effects.helperExitConfirmed === true,
    pathReported: false,
    principalReported: false,
    aclReported: false,
    filesystemEffectIssued,
    networkEffectIssued: false,
    processEffectIssued,
    runtimeAuthorityIssued: false,
    manualRecoveryRequired: processEffectIssued || filesystemEffectIssued,
  });
}

function rootPathCandidate() {
  const localAppData = process.env.LOCALAPPDATA;
  if (
    !isSupportedWindowsAbsolutePathCandidate(localAppData) ||
    path.win32.normalize(localAppData) !== localAppData
  ) {
    return null;
  }
  const rootPath = path.win32.join(
    localAppData,
    "Qual-Lab",
    "CRDD",
    "CandidateStore",
  );
  return isSupportedWindowsAbsolutePathCandidate(rootPath) ? rootPath : null;
}

export function inspectRuntimeOwnedWindowsCandidateStore(
  initializeIfMissing: unknown,
  evaluationTime: unknown,
) {
  if (process.platform !== "win32")
    return blocked("candidate_store_windows_adapter_platform_unsupported");
  const rootPath = rootPathCandidate();
  const request = createCandidateStoreObservationRequest(
    rootPath,
    initializeIfMissing,
  );
  if (!rootPath || !request)
    return blocked("candidate_store_windows_adapter_root_invalid");
  const packageVerification =
    verifyBundledCoordinatorPackageFromFixedManifestCandidate({
      evaluationTime,
    });
  if (
    packageVerification.status !== "candidate" ||
    packageVerification.runtimeOwnedReleaseTrustConfirmed !== true ||
    packageVerification.releaseIdentityRuntimeOwned !== true ||
    packageVerification.crddDistributionConfirmed !== true
  ) {
    return blocked("candidate_store_windows_adapter_release_not_verified");
  }
  const artifactBefore = observePlatformAccessReleaseArtifactCandidate(
    bundledDistributionRoot,
  );
  const signingObservation = beginPlatformAccessArtifactSigningObservation(
    bundledDistributionRoot,
  );
  if (
    artifactBefore.status !== "candidate" ||
    !signingObservation ||
    !sameArtifact(
      packageVerification.platformAccessArtifact,
      artifactBefore.artifact,
    ) ||
    !sameArtifact(artifactBefore.artifact, signingObservation.artifact)
  ) {
    return blocked("candidate_store_windows_adapter_artifact_not_verified");
  }
  const execution = spawnSync(executablePath, [], {
    input: request.request,
    encoding: "buffer",
    env: Object.freeze({}),
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
      "candidate_store_windows_adapter_helper_failed",
      Object.freeze({
        processEffectIssued,
        filesystemEffectIssued:
          initializeIfMissing === true && processEffectIssued,
      }),
    );
  }
  if (!verifyPlatformAccessArtifactSigningObservation(signingObservation.token))
    return blocked(
      "candidate_store_windows_adapter_artifact_changed",
      Object.freeze({
        processEffectIssued: true,
        helperExitConfirmed: true,
        filesystemEffectIssued: initializeIfMissing === true,
      }),
    );
  const artifactAfter = observePlatformAccessReleaseArtifactCandidate(
    bundledDistributionRoot,
  );
  if (
    artifactAfter.status !== "candidate" ||
    !sameArtifact(artifactBefore.artifact, artifactAfter.artifact)
  ) {
    return blocked(
      "candidate_store_windows_adapter_artifact_changed",
      Object.freeze({
        processEffectIssued: true,
        helperExitConfirmed: true,
        filesystemEffectIssued: initializeIfMissing === true,
      }),
    );
  }
  const observation = evaluateCandidateStoreObservationResponseCandidate(
    execution.stdout,
    request.nonce,
  );
  if (observation.status !== "candidate")
    return blocked(
      "candidate_store_windows_adapter_response_invalid",
      Object.freeze({
        processEffectIssued: true,
        helperExitConfirmed: true,
        filesystemEffectIssued: initializeIfMissing === true,
      }),
    );
  const rootCapability = Object.freeze({});
  rootCapabilities.set(
    rootCapability,
    Object.freeze({
      rootPath,
      candidateStoreIdentityHash: observation.candidateStoreIdentityHash,
      candidateStoreProtectionHash: observation.candidateStoreProtectionHash,
      localUserBindingHash: observation.localUserBindingHash,
    }),
  );
  return Object.freeze({
    ...observation,
    reason: "runtime_owned_windows_candidate_store_observed",
    rootCapability,
    releaseIdentityVerified: true,
    artifactVerifiedBeforeAndAfter: true,
    helperSpawnAttempts: 1,
    helperExitConfirmed: true,
    filesystemEffectIssued: initializeIfMissing === true,
    processEffectIssued: true,
    manualRecoveryRequired: false,
  });
}

export function consumeRuntimeOwnedCandidateStoreRootCapability(
  capability: unknown,
) {
  if (!capability || typeof capability !== "object") return null;
  const value = rootCapabilities.get(capability);
  rootCapabilities.delete(capability);
  return value ?? null;
}

export function describeCandidateStoreWindowsAdapterContract() {
  return Object.freeze({
    platform: "windows",
    fixedSegments: Object.freeze(["Qual-Lab", "CRDD", "CandidateStore"]),
    nativeRootSource: "windows_known_folder_local_app_data",
    initialization:
      "create_missing_exact_selected_user_and_system_protected_dacl_without_repair",
    observation:
      "stable_fixed_volume_non_reparse_owner_selected_user_exact_protected_dacl",
    releaseVerification:
      "fixed_signed_manifest_release_identity_and_artifact_hash_before_and_after",
    callerSuppliedPathAccepted: false,
    inheritedEnvironmentTrustedDirectly: false,
    rawPathReported: false,
    rawPrincipalReported: false,
    rawAclReported: false,
    networkEffectIssued: false,
  });
}
