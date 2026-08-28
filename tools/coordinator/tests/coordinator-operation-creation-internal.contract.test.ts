import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyOwnedCoordinatorOperationCreationFailure,
  createIsolatedCoordinatorOperationCreationCandidate,
} from "../src/security/coordinator-operation-creation-internal.ts";

function fixture(cleanupFails = false) {
  const owned = Object.freeze({});
  let cleanupCount = 0;
  const candidate = createIsolatedCoordinatorOperationCreationCandidate({
    createDirectories: () => owned as never,
    getHostRecoveryId: () => "host.fixture.operation",
    initializeCapabilities: () => {
      throw new Error("capability_creation_failed");
    },
    cleanupDirectories: () => {
      cleanupCount += 1;
      if (cleanupFails) throw new Error("cleanup_unknown");
    },
  });
  return { candidate, getCleanupCount: () => cleanupCount };
}

test("Root生成後のCapability初期化失敗をtransactionとして回収する", () => {
  const h = fixture();
  assert.throws(
    () => h.candidate.create(),
    (error) => {
      assert.deepEqual(
        classifyOwnedCoordinatorOperationCreationFailure(error),
        {
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          hostRecoveryId: null,
        },
      );
      return true;
    },
  );
  assert.equal(h.getCleanupCount(), 1);
});

test("Root生成後の回収不明はexact Host Recoveryを返す", () => {
  const h = fixture(true);
  assert.throws(
    () => h.candidate.create(),
    (error) => {
      assert.deepEqual(
        classifyOwnedCoordinatorOperationCreationFailure(error),
        {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          hostRecoveryId: "host.fixture.operation",
        },
      );
      return true;
    },
  );
  assert.equal(h.getCleanupCount(), 1);
});
