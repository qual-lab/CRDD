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
  return blocked("native_provision_supervisor_release_binding_not_implemented");
}

export function describePreActiveProvisioningOneShotContract() {
  return Object.freeze({
    contract: "crdd-coordinator/pre-active-provisioning-one-shot",
    contractRevision: 2,
    command: "explicit_coordinator_provision_only",
    executionStrategy: "native_top_level_direct_self_observation",
    maximumObservationAttemptsPerInvocation: 1,
    maximumWorkerSpawnAttemptsPerInvocation: 0,
    initialTrustCeremony:
      "human_authenticated_officially_signed_release_native_top_level_required",
    nodePathLaunchMayEstablishVerifiedImage: false,
    normalRuntimeAdapterInvocation: false,
    doctorInvocation: false,
    activateOrDisableInvocation: false,
    sourceCheckoutInvocation: false,
    pathCargoShellOrInstallerFallback: false,
    automaticRetryOrRestart: false,
    nativeSupervisor: "entrypoint_implemented_release_binding_blocked",
    releaseOwnedOpaqueExecutionBinding: "not_implemented_blocked",
    verifiedImageHandleBinding: "not_implemented_blocked",
    workerBoundedProcess: "not_applicable_no_worker",
    workerProcessTreeTermination: "not_applicable_no_worker",
    networkEnforcement: "not_implemented_blocked",
    currentProcessEffectIssued: false,
    currentHelperProcessSpawned: false,
    currentProcessTreeTerminationConfirmed: false,
    currentManualRecoveryRequired: false,
    resultAuthority:
      "current_process_principal_observation_candidate_only_after_native_implementation",
    selectedUserBindingVerified: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
