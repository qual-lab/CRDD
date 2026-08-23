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
  return blocked(
    "native_provision_supervisor_requires_formal_signed_runtime_evidence",
  );
}

export function describePreActiveProvisioningOneShotContract() {
  return Object.freeze({
    contract: "crdd-coordinator/pre-active-provisioning-one-shot",
    contractRevision: 3,
    command: "explicit_coordinator_provision_only",
    executionStrategy: "native_top_level_appcontainer_worker_observation",
    maximumObservationAttemptsPerInvocation: 1,
    maximumWorkerSpawnAttemptsPerInvocation: 1,
    initialTrustCeremony:
      "human_authenticated_officially_signed_release_native_top_level_required",
    nodePathLaunchMayEstablishVerifiedImage: false,
    normalRuntimeAdapterInvocation: false,
    doctorInvocation: false,
    activateOrDisableInvocation: false,
    sourceCheckoutInvocation: false,
    pathCargoShellOrInstallerFallback: false,
    automaticRetryOrRestart: false,
    nativeSupervisor:
      "entrypoint_implemented_minimum_trust_boundary_formal_evidence_pending",
    releaseOwnedOpaqueExecutionBinding:
      "trusted_os_authenticated_local_user_and_human_verified_release_prerequisite",
    verifiedImageHandleBinding:
      "not_required_by_coordinator_runtime_1_0_minimum_trust_boundary",
    workerBoundedProcess:
      "atomic_single_process_job_assignment_implemented_candidate",
    workerProcessTreeTermination: "required_before_candidate_forwarding",
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
