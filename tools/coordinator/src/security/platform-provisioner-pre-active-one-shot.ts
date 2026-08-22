function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    explicitProvisionInvocationRequired: true,
    nativeTopLevelTrustCeremonyRequired: true,
    nativeSupervisorTrusted: false,
    releaseIdentityConfirmed: false,
    verifiedImageBound: false,
    oneShotAttemptConsumed: false,
    processEffectIssued: false,
    helperProcessSpawned: false,
    processTreeTerminationConfirmed: false,
    manualRecoveryRequired: false,
    principalObservation: null,
    selectedUserBindingVerified: false,
    runtimePrincipalBound: false,
    permissionMutationIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

export function inspectPreActiveProvisioningOneShotCandidate(
  untrustedInput?: unknown,
) {
  void untrustedInput;
  return blocked("pre_active_native_provision_supervisor_not_implemented");
}

export function describePreActiveProvisioningOneShotContract() {
  return Object.freeze({
    contract: "crdd-coordinator/pre-active-provisioning-one-shot",
    contractRevision: 1,
    command: "explicit_coordinator_provision_only",
    maximumSpawnAttemptsPerInvocation: 1,
    initialTrustCeremony:
      "human_authenticated_officially_signed_release_native_top_level_required",
    nodePathLaunchMayEstablishVerifiedImage: false,
    normalRuntimeAdapterInvocation: false,
    doctorInvocation: false,
    activateOrDisableInvocation: false,
    sourceCheckoutInvocation: false,
    pathCargoShellOrInstallerFallback: false,
    automaticRetryOrRestart: false,
    nativeSupervisor: "not_implemented_blocked",
    releaseOwnedOpaqueExecutionBinding: "not_implemented_blocked",
    verifiedImageHandleBinding: "not_implemented_blocked",
    boundedProcess: "not_implemented_blocked",
    networkEnforcement: "not_implemented_blocked",
    resultAuthority:
      "current_process_principal_observation_candidate_only_after_native_implementation",
    selectedUserBindingVerified: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
