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
  assert.equal(contract.command, "explicit_coordinator_provision_only");
  assert.equal(contract.maximumSpawnAttemptsPerInvocation, 1);
  assert.equal(
    contract.initialTrustCeremony,
    "human_authenticated_officially_signed_release_native_top_level_required",
  );
  assert.equal(contract.nodePathLaunchMayEstablishVerifiedImage, false);
  assert.equal(contract.normalRuntimeAdapterInvocation, false);
  assert.equal(contract.doctorInvocation, false);
  assert.equal(contract.activateOrDisableInvocation, false);
  assert.equal(contract.sourceCheckoutInvocation, false);
  assert.equal(contract.pathCargoShellOrInstallerFallback, false);
  assert.equal(contract.automaticRetryOrRestart, false);
  assert.equal(contract.nativeSupervisor, "not_implemented_blocked");
  assert.equal(contract.boundedProcess, "not_implemented_blocked");
  assert.equal(contract.selectedUserBindingVerified, false);
  assert.equal(contract.filesystemEffectIssued, false);
  assert.equal(contract.networkEffectIssued, false);
  assert.equal(contract.runtimeAuthorityConferred, false);
  assert.equal(contract.runtimeCapabilityIssued, false);
});
