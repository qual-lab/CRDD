function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    releaseSequence: null,
    packageInstalled: false,
    rollbackFloorPersisted: false,
    activeReleasePersisted: false,
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
  return blocked(
    "platform_provisioner_effective_access_adapter_not_implemented",
  );
}

export function describePlatformProvisionerEffectContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-effect",
    contractRevision: 1,
    effectController: "not_implemented_effective_access_required",
    command: "explicit_provision_only",
    sourceSelection: "fixed_signed_crdd_distribution_only_target",
    sourceCheckoutBehavior: "blocked_before_any_read_or_filesystem_effect",
    platform: "windows_target_only",
    installRoot: "%ProgramData%/Qual-Lab/CRDD/Coordinator",
    releaseStaging: "not_implemented",
    installedReleaseReverification: "not_implemented_effective_access_required",
    permissionMutation: "not_implemented_effective_access_required",
    rollbackFloorPersistence: "component_candidate_not_reachable_from_effect",
    activeReleasePersistence: "component_candidate_not_reachable_from_effect",
    stateTransaction: "component_candidate_not_reachable_from_effect",
    failureBehavior:
      "blocked_before_distribution_clock_path_or_filesystem_access",
    repositoryRuntimeStateRequired: false,
    compatibilityLayout: "prohibited",
    networkEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
