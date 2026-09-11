import assert from "node:assert/strict";
import test from "node:test";

import { reduceHostGenerationLossTransition } from "../../src/core/host-generation-loss-transition.ts";

test("Host generation loss reducerは検出・confirmed・unknownを単調に分離する", () => {
  assert.deepEqual(reduceHostGenerationLossTransition("failure_detected"), {
    retired: true,
    revokeEffectCapabilities: true,
    beginEffectDrain: true,
    poisonProcess: false,
  });
  assert.deepEqual(
    reduceHostGenerationLossTransition("cleanup_confirmed_failure"),
    {
      retired: true,
      revokeEffectCapabilities: true,
      beginEffectDrain: false,
      poisonProcess: false,
    },
  );
  assert.deepEqual(reduceHostGenerationLossTransition("cleanup_unknown"), {
    retired: true,
    revokeEffectCapabilities: true,
    beginEffectDrain: false,
    poisonProcess: true,
  });
});
