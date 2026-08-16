import assert from "node:assert/strict";
import test from "node:test";

import {
  describePlatformProvisionerEffectContract,
  runPlatformProvisionerEffect,
} from "../src/security/platform-provisioner-effect.ts";

test("source checkout blocks before platform provisioning filesystem effects", () => {
  const result = runPlatformProvisionerEffect();
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "platform_provisioner_source_distribution_not_verified",
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
    "blocked_before_program_data_discovery_or_write",
  );
  assert.equal(contract.repositoryRuntimeStateRequired, false);
  assert.equal(contract.compatibilityLayout, "prohibited");
});
