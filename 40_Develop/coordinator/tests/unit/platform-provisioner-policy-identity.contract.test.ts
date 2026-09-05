import assert from "node:assert/strict";
import test from "node:test";

import {
  describePlatformProvisionerPolicyIdentityContract,
  getPlatformProvisionerPolicyIdentity,
} from "../../src/security/platform-provisioner-policy-identity.ts";

test("Root保護と鍵保存の正本contractをcanonical SHA-256へ固定する", () => {
  const first = getPlatformProvisionerPolicyIdentity();
  const second = getPlatformProvisionerPolicyIdentity();
  assert.match(first.rootProtectionPolicySha256, /^[0-9a-f]{64}$/u);
  assert.match(first.keyStoragePolicySha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(
    describePlatformProvisionerPolicyIdentityContract()
      .callerPolicyHashAccepted,
    false,
  );
});
