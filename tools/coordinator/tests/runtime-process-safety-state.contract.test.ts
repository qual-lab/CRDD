import assert from "node:assert/strict";
import test from "node:test";

import { createIsolatedRuntimeProcessSafetyStateCandidate } from "../src/core/runtime-process-safety-state.ts";

test("対話cleanup不明は同一Process stateを不可逆にpoisonする", () => {
  const firstProcess = createIsolatedRuntimeProcessSafetyStateCandidate();
  const restartedProcess = createIsolatedRuntimeProcessSafetyStateCandidate();
  assert.equal(firstProcess.isPoisoned(), false);
  firstProcess.poisonInteractiveCleanup();
  assert.equal(firstProcess.isPoisoned(), true);
  firstProcess.poisonInteractiveCleanup();
  assert.equal(firstProcess.isPoisoned(), true);
  assert.equal(restartedProcess.isPoisoned(), false);
});
