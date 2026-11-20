/**
 * coordinator:unit:coordinator-operation-creation-internalの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:coordinator-operation-creation-internalが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope coordinator、operation、creation、internal、cleanup、lock
 * @boundary PRL-UT-014=N/A: Coordinator Application Portは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { sourceDeclaration } from "../../../../execution-model/tests/support/source-declaration.ts";

import { classifyOwnedCoordinatorOperationCreationFailure } from "../../../src/execution/operation.ts";
import { createIsolatedOwnedOperationDirectoryCreationFailureCandidate } from "../../../src/execution/operation.ts";

/**
 * 同期wx解放とHost回収を一つの実宣言で検証する。
 * @responsibility 削除・解放・記録整理の順と、解放不明時の保全を固定する。
 * @trace PRL-UT-014
 * @precondition 実宣言を一回だけ抽出し、各条件のMap・Owner・故障を独立に用意する。
 * @stimulus Lock未取得、解放成功、false、例外、実体削除拒否を与える。
 * @observation 呼出し順、保持Map、退役、停止と清掃結果を観測する。
 * @oracle 削除後に一回解放し、解放不明では記録整理と完了結果へ進まない。
 * @cleanup メモリのみ。Filesystem・外部Processは操作しない。
 * @boundary Host清掃と共通Lockの局所接続。
 */
test("Host清掃は同期wx解放まで同じ経路で閉じ、不明なら記録を保全する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/execution/operation.ts", import.meta.url),
    "utf8",
  );
  assert.equal(source.includes("cleanupOwnedOperationDirectoriesAsync"), false);
  assert.equal(source.includes("revokeOwnedOperationGenerationAsync"), false);
  const declarations = [
    "operationGenerationKey",
    "revokeOwnedOperationGeneration",
    "cleanupOwnedOperationDirectories",
  ]
    .map((name) => sourceDeclaration(source, name))
    .join("\n");
  const create = new Function(
    "operationGenerationsByKey",
    "operationGenerationByRoot",
    "ownedIdentities",
    "revokeOwnedOperationContextCapabilities",
    "poisonRuntimeProcessAfterCleanupUnknown",
    "removeOwnedOperationRootForCleanup",
    "createOwnedOperationCleanupOutcome",
    declarations + "\nreturn cleanupOwnedOperationDirectories;",
  );
  for (const mode of [
    "no_lock",
    "released",
    "false",
    "throw",
    "delete_rejected",
  ]) {
    const owned = Object.freeze({});
    const identity = {
      root: "fixture-root",
      operationId: "OP-123456",
    };
    const events: string[] = [];
    const state = {
      owned,
      retired: false,
      generationLock:
        mode === "no_lock"
          ? null
          : {
              release() {
                events.push("release");
                if (mode === "throw") throw Error("release_failed");
                return mode !== "false";
              },
            },
    };
    const generations = new Map([["fixture-root\0OP-123456", state]]);
    const roots = new Map([["fixture-root", state]]);
    const identities = new WeakMap([[owned, identity]]);
    const outcome = Object.freeze({ kind: "owned_operation_cleanup_outcome" });
    const cleanup = create(
      generations,
      roots,
      identities,
      (value: unknown) => {
        assert.equal(value, owned);
        events.push("revoke");
      },
      () => {
        events.push("poison");
      },
      (value: unknown) => {
        assert.equal(value, owned);
        events.push("remove");
        if (mode === "delete_rejected") throw Error("root_changed");
        return identity;
      },
      (status: unknown, value: unknown, observed: unknown) => {
        assert.equal(status, "completed");
        assert.equal(value, owned);
        assert.equal(observed, identity);
        events.push("outcome");
        return outcome;
      },
    );
    if (mode === "delete_rejected") {
      assert.throws(() => cleanup(owned), /root_changed/u);
      assert.deepEqual(events, ["remove"]);
    } else if (mode === "false" || mode === "throw") {
      assert.throws(
        () => cleanup(owned),
        /owned_operation_generation_release_unconfirmed/u,
      );
      assert.deepEqual(events, ["remove", "revoke", "release", "poison"]);
      assert.equal(state.retired, true);
      assert.equal(state.generationLock === null, false);
    } else {
      assert.equal(cleanup(owned), outcome);
      assert.deepEqual(
        events,
        mode === "no_lock"
          ? ["remove", "revoke", "outcome"]
          : ["remove", "revoke", "release", "outcome"],
      );
      assert.equal(generations.size, 0);
      assert.equal(roots.size, 0);
      assert.equal(identities.has(owned), false);
      assert.equal(state.generationLock, null);
      continue;
    }
    assert.equal(generations.get("fixture-root\0OP-123456"), state);
    assert.equal(roots.get("fixture-root"), state);
    assert.equal(identities.has(owned), true);
    assert.equal(events.includes("outcome"), false);
  }
});

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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
const creationSource = fs.readFileSync(
  new URL("../../../src/execution/operation.ts", import.meta.url),
  "utf8",
);
const createFixtureOwner = new Function(
  "dependencies",
  `
  const failures = new WeakMap();
  const { createOwnedOperationDirectories, getOwnedHostRecoveryId,
    createOwnedOperationContextCapability, createOwnedMountCapability,
    createOwnedOperationManagementCapability, requireOwnedIdentity,
    cleanupOwnedOperationDirectories, classifyOwnedOperationDirectoryCreationFailure } = dependencies;
  ${["fail", "classifyOwnedCoordinatorOperationCreationFailure", "createRuntimeOwnedCoordinatorOperation"].map((name) => sourceDeclaration(creationSource, name)).join("\n")}
  return { create: () => createRuntimeOwnedCoordinatorOperation({}), classify: classifyOwnedCoordinatorOperationCreationFailure };
`,
);
function fixture(
  options: Readonly<{
    cleanupFails?: boolean;
    initializationFails?: boolean;
  }> = {},
) {
  const owned = Object.freeze({});
  let cleanupCount = 0;
  const candidate = createFixtureOwner({
    createOwnedOperationDirectories: () => owned,
    getOwnedHostRecoveryId: () => "host-operation.OP-123456",
    createOwnedOperationContextCapability: () => {
      if (options.initializationFails !== false)
        throw Error("capability_creation_failed");
      return Object.freeze({});
    },
    createOwnedMountCapability: () => Object.freeze({}),
    createOwnedOperationManagementCapability: () => Object.freeze({}),
    requireOwnedIdentity: () => ({ operationId: "OP-123456" }),
    cleanupOwnedOperationDirectories: (value: unknown) => {
      assert.equal(value, owned);
      cleanupCount++;
      if (options.cleanupFails) throw Error("cleanup_unknown");
    },
    classifyOwnedOperationDirectoryCreationFailure: () => null,
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Root生成後のCapability初期化失敗をtransactionとして回収する", () => {
  const h = fixture();
  assert.throws(
    () => h.candidate.create(),
    (error) => {
      assert.deepEqual(h.candidate.classify(error), {
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        hostRecoveryId: null,
      });
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Root生成後の回収不明はexact Host Recoveryを返す", () => {
  const h = fixture({ cleanupFails: true });
  assert.throws(
    () => h.candidate.create(),
    (error) => {
      assert.deepEqual(h.candidate.classify(error), {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        hostRecoveryId: "host-operation.OP-123456",
      });
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("isolated transactionの正常形は取得済みIDとCapabilityを一括公開する", () => {
  const h = fixture({ initializationFails: false });
  const created = h.candidate.create();
  assert.equal(created.hostRecoveryId, "host-operation.OP-123456");
  assert.equal(created.operationId, "OP-123456");
  assert.equal(h.getCleanupCount(), 0);
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
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
