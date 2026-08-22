import { inspectPreActiveProvisioningOneShotCandidate } from "./platform-provisioner-pre-active-one-shot.ts";

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    releaseSequence: null,
    protectedGenerationInstalled: false,
    activePointerPersisted: false,
    processEffectIssued: false,
    helperProcessSpawned: false,
    recoveryRequired: false,
    crddDistributionConfirmed: false,
    qualLabManifestTrustConfirmed: false,
    permissionPolicyConfirmed: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}

export function runPlatformProvisionerEffect() {
  const oneShot = inspectPreActiveProvisioningOneShotCandidate();
  return blocked(oneShot.reason);
}

export function describePlatformProvisionerEffectContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-effect",
    contractRevision: 3,
    effectController: "not_implemented_effective_access_required",
    preActiveProvisioningOneShot:
      "native_direct_entrypoint_implemented_release_binding_blocked",
    command: "explicit_provision_only",
    sourceSelection: "fixed_signed_crdd_distribution_only_target",
    sourceCheckoutBehavior: "blocked_before_any_read_or_filesystem_effect",
    platform: "windows_target_only",
    installRoot: "%ProgramData%/Qual-Lab/CRDD/Coordinator",
    releaseStaging: "not_implemented",
    installedReleaseReverification: "not_implemented_effective_access_required",
    permissionMutation: "not_implemented_effective_access_required",
    protectedGenerationPersistence: "not_implemented_blocked",
    activePointerPersistence: "not_implemented_native_durable_store_required",
    inactiveOrphanCleanup: "separate_explicit_identity_bound_effect_required",
    failureBehavior:
      "blocked_before_distribution_clock_path_or_filesystem_access",
    repositoryRuntimeStateRequired: false,
    compatibilityLayout: "prohibited",
    networkEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
