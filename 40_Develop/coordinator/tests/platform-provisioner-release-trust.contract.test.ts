import assert from "node:assert/strict";
import { createHash, createPublicKey } from "node:crypto";
import test from "node:test";

import {
  describePlatformProvisionerReleaseTrustContract,
  getPinnedPlatformProvisionerReleaseSignerSpkiDer,
} from "../src/security/platform-provisioner-release-trust.ts";

test("Qual-Lab Release公開鍵exact 1本をcanonical Ed25519 SPKIとして固定する", () => {
  const first = getPinnedPlatformProvisionerReleaseSignerSpkiDer();
  const second = getPinnedPlatformProvisionerReleaseSignerSpkiDer();
  const key = createPublicKey({ key: first, format: "der", type: "spki" });
  const canonical = key.export({ format: "der", type: "spki" });
  assert.equal(key.asymmetricKeyType, "ed25519");
  assert.equal(first.length, 44);
  assert.deepEqual(first, canonical);
  assert.equal(
    createHash("sha256").update(first).digest("hex"),
    "6b250a21be0f8fd582907731a2cba6aae44b991cbff82234c4ee838548c5e95f",
  );
  first.fill(0);
  assert.notDeepEqual(first, second);
  assert.deepEqual(second, getPinnedPlatformProvisionerReleaseSignerSpkiDer());
});

test("固定Release Trustはcaller鍵fallbackと秘密鍵同梱を禁止する", () => {
  const contract = describePlatformProvisionerReleaseTrustContract();
  assert.equal(contract.owner, "Qual-Lab");
  assert.equal(contract.algorithm, "Ed25519");
  assert.equal(contract.activeKeyCount, 1);
  assert.equal(contract.unknownKeyFallbackAllowed, false);
  assert.equal(contract.callerKeyMayReplaceTrustAnchor, false);
  assert.equal(contract.privateKeyStoredInRepository, false);
  assert.equal(contract.rotationRequiresHumanApprovedCrddChange, true);
  assert.equal(contract.runtimeAuthorityConferred, false);
  assert.equal(contract.runtimeCapabilityIssued, false);
});
