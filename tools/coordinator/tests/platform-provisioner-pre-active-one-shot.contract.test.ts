import assert from "node:assert/strict";
import test from "node:test";

import {
  describePreActiveProvisioningOneShotContract,
  inspectPreActiveProvisioningOneShotCandidate,
} from "../src/security/platform-provisioner-pre-active-one-shot.ts";

test("caller inputを初期Trustまたはone-shot許可へ昇格しない", () => {
  let trapCalls = 0;
  const trap = new Proxy(
    {},
    {
      get() {
        trapCalls += 1;
        throw new Error("untrusted input must not be inspected");
      },
      ownKeys() {
        trapCalls += 1;
        throw new Error("untrusted input must not be inspected");
      },
    },
  );
  const result = inspectPreActiveProvisioningOneShotCandidate(trap);
  assert.deepEqual(result, {
    status: "blocked",
    reason:
      "native_provision_supervisor_requires_formal_signed_runtime_evidence",
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
  assert.equal(Object.isFrozen(result), true);
  assert.equal(trapCalls, 0);
});

test("有効化前準備一回実行を通常Runtimeと分離して未実装へ閉じる", () => {
  const contract = describePreActiveProvisioningOneShotContract();
  assert.deepEqual(contract, {
    contract: "crdd-coordinator/pre-active-provisioning-one-shot",
    contractRevision: 4,
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
    runtimeEnvironment:
      "os_known_folder_local_app_data_only_without_parent_environment_inheritance",
    lowBoxConsolePrerequisite:
      "current_user_temporary_one_shot_registry_effect_only_when_not_already_enabled",
    registrySerialization: "fixed_current_user_named_mutex",
    registryRecoveryRecord:
      "durable_before_effect_and_removed_only_after_verified_restore",
    registryRestoration:
      "exact_pre_state_last_write_comparison_and_read_back_before_candidate_forwarding",
    staleOrAmbiguousRegistryRecovery:
      "manual_recovery_required_fail_closed_without_overwrite",
    normalOperationRegistryMutation: false,
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
});
