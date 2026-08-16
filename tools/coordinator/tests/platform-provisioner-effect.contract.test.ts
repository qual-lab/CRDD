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
    "platform_provisioner_effective_access_adapter_not_implemented",
  );
  assert.equal(result.filesystemEffectIssued, false);
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
  assert.equal(contract.repositoryRuntimeStateRequired, false);
  assert.equal(contract.compatibilityLayout, "prohibited");
});
