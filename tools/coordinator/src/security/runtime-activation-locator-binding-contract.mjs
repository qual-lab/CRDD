const PAIR_BINDING_FIELDS = Object.freeze([
  "repositoryIdentityHash",
  "runtimeRootIdentityHash",
  "activationId",
  "activationRevision",
  "activationRecordHash"
]);

export function describeRuntimeActivationLocatorBindingContract() {
  return Object.freeze({
    core: "implemented_candidate_initial_only",
    supportedTransition: "initial_null_to_active",
    pairBindingFields: PAIR_BINDING_FIELDS,
    provisioningRecordVerification: "not_implemented",
    filesystemCurrentRecordRead: "not_implemented",
    activeActivationBinding: "not_implemented",
    atomicUpdatePolicy: "approved_candidate_contract_only",
    atomicPersistence: "not_implemented",
    crashRecovery: "not_implemented",
    disableLocatorHandling: "not_implemented",
    reactivationLocatorHandling: "not_implemented",
    automaticRepair: false,
    mismatchBehavior: "fail_closed_and_reprovision_required",
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  });
}
