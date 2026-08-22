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
    reason: "pre_active_native_provision_supervisor_not_implemented",
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
