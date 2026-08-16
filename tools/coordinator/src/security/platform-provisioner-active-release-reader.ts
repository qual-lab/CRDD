function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    releaseSequence: null,
    manifestHash: null,
    activeHash: null,
    packageContentRootSha256: null,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}

export function readPlatformProvisionerActiveReleaseCandidate() {
  return blocked(
    "active_release_reader_effective_access_adapter_not_implemented",
  );
}

export function describePlatformProvisionerActiveReleaseReaderContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-active-release-reader",
    contractRevision: 1,
    platform: "windows_target_only",
    rootSelection: "not_executed_before_effective_access_adapter",
    stateTransactionRequirement: "component_candidate_not_runtime_connected",
    floorAndActiveBinding: "component_candidate_not_runtime_connected",
    installedReleaseReverification: "not_implemented_effective_access_required",
    runtimeRead: "not_implemented_effective_access_required",
    automaticRecovery: "prohibited",
    pathDisclosure: "prohibited",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}
