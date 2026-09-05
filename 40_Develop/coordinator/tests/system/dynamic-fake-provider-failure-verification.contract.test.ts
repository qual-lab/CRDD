import assert from "node:assert/strict";
import test from "node:test";

import { DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS } from "../../src/security/docker-isolation.ts";
import { verifyDynamicFakeProviderFailures } from "../../scripts/verify-dynamic-fake-provider-failures.ts";

test("動的Fake失敗verificationは固定scenarioだけを所有し任意入力を受けない", () => {
  assert.deepEqual(DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS, [
    "timeout",
    "output_limit",
    "invalid_output",
    "nonzero_exit",
  ]);
  assert.equal(verifyDynamicFakeProviderFailures.length, 0);
});
