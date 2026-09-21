/**
 * coordinator:unit:coordinator-operation-creation-internalの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:coordinator-operation-creation-internalが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope coordinator、operation、creation、internal
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * Root生成後のCapability初期化失敗をtransactionとして回収するを検証する。
 *
 * @responsibility Root生成後のCapability初期化失敗をtransactionとして回収するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Root生成後のCapability初期化失敗をtransactionとして回収するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * Root生成後の回収不明はexact Host Recoveryを返すを検証する。
 *
 * @responsibility Root生成後の回収不明はexact Host Recoveryを返すの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Root生成後の回収不明はexact Host Recoveryを返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * Recovery ID取得失敗もtransaction内で回収するを検証する。
 *
 * @responsibility Recovery ID取得失敗もtransaction内で回収するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recovery ID取得失敗もtransaction内で回収するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * Recovery ID取得前の回収不明はIDを捏造せずmanualへ閉じるを検証する。
 *
 * @responsibility Recovery ID取得前の回収不明はIDを捏造せずmanualへ閉じるの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recovery ID取得前の回収不明はIDを捏造せずmanualへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * isolated transactionの正常形は取得済みIDとCapabilityを一括公開するを検証する。
 *
 * @responsibility isolated transactionの正常形は取得済みIDとCapabilityを一括公開するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus isolated transactionの正常形は取得済みIDとCapabilityを一括公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("isolated transactionの正常形は取得済みIDとCapabilityを一括公開する", () => {
  const h = fixture({ initializationFails: false });
  const created = h.candidate.create();
  assert.equal(created.hostRecoveryId, "host.fixture.operation");
  assert.equal(created.operationId, "OP-123456");
  assert.equal(h.getCleanupCount(), 0);
});

/**
 * production Operationは実Directory producerのexact Host Recovery IDを公開するを検証する。
 *
 * @responsibility production Operationは実Directory producerのexact Host Recovery IDを公開するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production Operationは実Directory producerのexact Host Recovery IDを公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * 共有classifierは内包Directory producerの全failureを保持するを検証する。
 *
 * @responsibility 共有classifierは内包Directory producerの全failureを保持するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 共有classifierは内包Directory producerの全failureを保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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
