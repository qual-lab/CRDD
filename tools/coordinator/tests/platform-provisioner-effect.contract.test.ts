import assert from "node:assert/strict";
import test from "node:test";

import {
  describePlatformProvisionerEffectContract,
  runPlatformProvisionerEffect,
} from "../src/security/platform-provisioner-effect.ts";

test("platform provisioning blocks before distribution or filesystem access", () => {
  const result = runPlatformProvisionerEffect();
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "pre_active_native_provision_supervisor_not_implemented",
  );
  assert.equal(result.processEffectIssued, false);
  assert.equal(result.helperProcessSpawned, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.protectedGenerationInstalled, false);
  assert.equal(result.activePointerPersisted, false);
  assert.equal(result.crddDistributionConfirmed, false);
  assert.equal(result.runtimeAuthorityConferred, false);
});

test("platform provisioner effect is repository-owned and has no compatibility layout", () => {
  const contract = describePlatformProvisionerEffectContract();
  assert.equal(contract.command, "explicit_provision_only");
  assert.equal(
    contract.sourceCheckoutBehavior,
    "blocked_before_any_read_or_filesystem_effect",
  );
  assert.equal(
    contract.effectController,
    "not_implemented_effective_access_required",
  );
  assert.equal(
    contract.preActiveProvisioningOneShot,
    "contract_implemented_native_supervisor_not_implemented_blocked",
  );
  assert.equal(contract.repositoryRuntimeStateRequired, false);
  assert.equal(contract.compatibilityLayout, "prohibited");
  assert.equal(
    contract.activePointerPersistence,
    "not_implemented_native_durable_store_required",
  );
  assert.equal(
    contract.inactiveOrphanCleanup,
    "separate_explicit_identity_bound_effect_required",
  );
});
