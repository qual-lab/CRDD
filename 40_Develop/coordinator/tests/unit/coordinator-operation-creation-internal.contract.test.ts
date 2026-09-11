import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyOwnedCoordinatorOperationCreationFailure,
  createIsolatedCoordinatorOperationCreationCandidate,
  createRuntimeOwnedCoordinatorOperation,
} from "../../src/security/coordinator-operation-creation-internal.ts";
import {
  cleanupOwnedOperationDirectories,
  createIsolatedOwnedOperationDirectoryCreationFailureCandidate,
  getOwnedHostRecoveryId,
} from "../../src/security/execution-environment.ts";

function fixture(
  options: Readonly<{
    cleanupFails?: boolean;
    recoveryIdFails?: boolean;
    initializationFails?: boolean;
  }> = {},
) {
  const owned = Object.freeze({});
  let cleanupCount = 0;
  const candidate = createIsolatedCoordinatorOperationCreationCandidate({
    createDirectories: () => owned as never,
    getHostRecoveryId: () => {
      if (options.recoveryIdFails) throw new Error("recovery_id_unavailable");
      return "host.fixture.operation";
    },
    initializeCapabilities: () => {
      if (options.initializationFails !== false)
        throw new Error("capability_creation_failed");
      return Object.freeze({
        mountCapability: Object.freeze({}),
        managementCapability: Object.freeze({}),
        operationId: "OP-123456",
      });
    },
    cleanupDirectories: () => {
      cleanupCount += 1;
      if (options.cleanupFails) throw new Error("cleanup_unknown");
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
  const h = fixture({ cleanupFails: true });
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

test("Recovery ID取得失敗もtransaction内で回収する", () => {
  const h = fixture({ recoveryIdFails: true });
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

test("Recovery ID取得前の回収不明はIDを捏造せずmanualへ閉じる", () => {
  const h = fixture({ recoveryIdFails: true, cleanupFails: true });
  assert.throws(
    () => h.candidate.create(),
    (error) => {
      assert.deepEqual(
        classifyOwnedCoordinatorOperationCreationFailure(error),
        {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          hostRecoveryId: null,
        },
      );
      return true;
    },
  );
  assert.equal(h.getCleanupCount(), 1);
});

test("isolated transactionの正常形は取得済みIDとCapabilityを一括公開する", () => {
  const h = fixture({ initializationFails: false });
  const created = h.candidate.create();
  assert.equal(created.hostRecoveryId, "host.fixture.operation");
  assert.equal(created.operationId, "OP-123456");
  assert.equal(h.getCleanupCount(), 0);
});

test("production Operationは実Directory producerのexact Host Recovery IDを公開する", () => {
  const created = createRuntimeOwnedCoordinatorOperation();
  try {
    assert.equal(getOwnedHostRecoveryId(created.owned), created.hostRecoveryId);
    assert.match(
      created.hostRecoveryId,
      /^host\.[a-z0-9-]+\.[0-9a-f-]{36}\.[a-f0-9]{64}$/u,
    );
  } finally {
    cleanupOwnedOperationDirectories(created.owned);
  }
});

test("共有classifierは内包Directory producerの全failureを保持する", () => {
  const lower = createIsolatedOwnedOperationDirectoryCreationFailureCandidate();
  for (const expected of [
    Object.freeze({
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      hostRecoveryId: null,
    }),
    Object.freeze({
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      hostRecoveryId: null,
    }),
    Object.freeze({
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      hostRecoveryId: "host.fixture.directory.recovery",
    }),
  ]) {
    assert.throws(
      () => lower.fail(expected),
      (error) => {
        assert.deepEqual(
          classifyOwnedCoordinatorOperationCreationFailure(error),
          expected,
        );
        return true;
      },
    );
  }
});
