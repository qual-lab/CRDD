/**
 * Host回復の取得・記録・処置・解放の順序を検証する。
 * @packageDocumentation
 * @responsibility EM正本と同じ取得世代を保持し、不明を清掃成功へ補完しない。
 * @trace PRL-UT-006
 * @level UT
 * @scope 現行Probe回復とHost清掃の有限依存。
 * @boundary 実Filesystem・Docker・AI・Lockを取得しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import { createResourceBookFixture } from "../../../execution-model/tests/support/resource-operation.ts";
import { recoverDockerIsolationProbe } from "../../src/lifecycle/environment.ts";

const createProbeRecovery = new Function(
  "dependencies",
  `
  const { acquireHostOperationRecoveryGeneration, readHostRecoveryOperation,
    observeHostRecoveryRoot, borrowHostRecoveryManagementDirectory,
    cleanupResources, getIsolationSettings, applyResourceCleanup,
    recordHostRecoveryResources, recoverOwnedOperationDirectories,
    releaseHostOperationRecoveryGeneration, normalizeFailure } = dependencies;
  return (${recoverDockerIsolationProbe.toString()});
`,
);

/**
 * 不変の実宣言へ観点ごとの記録・Owner・故障を接続する。
 * @responsibility 元Snapshotとexact参照、現在性、同じ取得世代の順序だけを模擬する。
 * @trace PRL-UT-006
 * @precondition 記録は現行の資源fixture。共有状態や旧Tokenを使わない。
 * @stimulus 読取り・DI回収・記録・解放の有限故障を選ぶ。
 * @observation 呼出し順、cancel数、清掃数と同一参照。
 * @oracle 取得失敗で処置0、記録不明でHost清掃0、取得後は解放一回。
 * @cleanup 値とPromiseだけ。実資源なし。
 * @boundary 本番Probe回復宣言と局所代役。
 */
function fixture(fault: string) {
  const events: string[] = [];
  const repository = {} as Parameters<typeof recoverDockerIsolationProbe>[1];
  const generation = {};
  const recoveryId = "host-operation.OP-123456";
  const controller = new AbortController();
  const current = () => true;
  const settled = createResourceBookFixture("crdd.probe=fixture", "absent", [
    "probe",
  ]);
  let resources =
    fault === "root_absent"
      ? settled
      : {
          ...settled,
          checkpoints: settled.checkpoints.map((item) => ({
            ...item,
            observation: "unknown" as const,
            absenceEvidenceSha256: null,
            ...(fault === "receipt" ? { receiptSource: null } : {}),
          })),
        };
  if (fault === "cancel_before") controller.abort();
  const recover = createProbeRecovery({
    acquireHostOperationRecoveryGeneration(
      root: unknown,
      id: unknown,
      owner: unknown,
    ) {
      assert.strictEqual(root, repository);
      assert.equal(id, recoveryId);
      assert.strictEqual(owner, current);
      events.push("acquire");
      if (fault === "acquire_throw") throw Error("fixture");
      return fault === "acquire" ? null : generation;
    },
    readHostRecoveryOperation(owner: unknown) {
      assert.strictEqual(owner, generation);
      events.push("read");
      if (fault === "record") return null;
      return {
        record: {
          purpose: fault === "purpose" ? "task" : "isolation_probe",
          resources,
        },
        payloadSha256: "a".repeat(64),
      };
    },
    observeHostRecoveryRoot(owner: unknown) {
      assert.strictEqual(owner, generation);
      events.push("root");
      return fault === "root_absent" ? "absent" : "present";
    },
    borrowHostRecoveryManagementDirectory(id: unknown, owner: unknown) {
      assert.equal(id, recoveryId);
      assert.strictEqual(owner, generation);
      events.push("borrow");
      return fault === "borrow"
        ? null
        : {
            directory: "owned-management",
            assertCurrent: () => fault !== "owner_lost",
          };
    },
    getIsolationSettings: () => ({}),
    cleanupResources(
      target: { resources: unknown; managementDirectory: string },
      _settings: unknown,
      callbacks: {
        onCleanupSubmitting: () => void;
        onResourcesClosed: (snapshot: unknown, observations: unknown[]) => void;
      },
    ) {
      assert.strictEqual(target.resources, resources.snapshot);
      assert.equal(target.managementDirectory, "owned-management");
      events.push("docker");
      return {
        cancel: async () => {
          events.push("cancel");
        },
        completion: Promise.resolve().then(() => {
          callbacks.onCleanupSubmitting();
          if (fault === "cancel_running") {
            controller.abort();
            throw Error("fixture_cancelled");
          }
          if (fault === "docker_throw") throw Error("fixture");
          if (fault !== "missing_closed")
            callbacks.onResourcesClosed(settled.snapshot, [
              { key: "probe", observation: "absent" },
            ]);
          return {
            processTerminationConfirmed: fault !== "process_unknown",
            cleanup: { confirmed: fault !== "cleanup_unknown" },
          };
        }),
      };
    },
    applyResourceCleanup(
      before: unknown,
      snapshot: unknown,
      observations: unknown,
      provenance: { recoveryId: string; previousPayloadSha256: string },
    ) {
      assert.strictEqual(before, resources);
      assert.strictEqual(snapshot, settled.snapshot);
      assert.deepEqual(observations, [{ key: "probe", observation: "absent" }]);
      assert.equal(provenance.recoveryId, recoveryId);
      assert.equal(provenance.previousPayloadSha256, "a".repeat(64));
      events.push("closed");
      return fault === "invalid_closed" ? null : settled;
    },
    recordHostRecoveryResources(owner: unknown, book: typeof settled) {
      assert.strictEqual(owner, generation);
      assert.strictEqual(book, settled);
      events.push("checkpoint");
      if (fault === "checkpoint") throw Error("fixture");
      resources = book;
    },
    recoverOwnedOperationDirectories(id: unknown, owner: unknown) {
      assert.equal(id, recoveryId);
      assert.strictEqual(owner, generation);
      events.push("cleanup");
      return { status: "recovered", reason: "fixture_cleanup_confirmed" };
    },
    releaseHostOperationRecoveryGeneration(owner: unknown) {
      assert.strictEqual(owner, generation);
      events.push("release");
      return fault !== "release";
    },
    normalizeFailure: (error: Error) => error.message,
  }) as typeof recoverDockerIsolationProbe;
  return {
    events,
    recoveryId,
    run: () => recover(recoveryId, repository, current, controller.signal),
  };
}

/**
 * Probe回復は同じOwnerの記録・処置・終端と解放を結ぶ。
 * @responsibility DI完了と記録確定の両方がなければHostを清掃しない。
 * @trace PRL-UT-006
 * @precondition 実関数本文と独立fixtureを使う。
 * @stimulus 正常、明示不存在と各単軸の故障・取消。
 * @observation 結果、元参照、処置順と解放回数。
 * @oracle 取得前失敗は後続0、取得後は解放1、失敗結果は同じexact参照を保持。
 * @cleanup 各Promise完了と取消Listener解除。実資源なし。
 * @boundary Probe回復調停。実DI不存在の成立は主張しない。
 */
test("診断回復は対象排他を先に取得し同じOwnerを清掃・解放へ渡す", async () => {
  const normal = fixture("normal");
  const completed = await normal.run();
  assert.equal(completed.status, "recovered");
  assert.equal(completed.recoveryId, null);
  assert.equal(completed.hostCleanupCompleted, true);
  assert.deepEqual(normal.events, [
    "acquire",
    "read",
    "borrow",
    "docker",
    "read",
    "closed",
    "checkpoint",
    "cleanup",
    "release",
  ]);
  const absent = fixture("root_absent");
  assert.equal((await absent.run()).status, "recovered");
  assert.deepEqual(absent.events, [
    "acquire",
    "read",
    "root",
    "cleanup",
    "release",
  ]);
  for (const fault of [
    "cancel_before",
    "acquire",
    "acquire_throw",
    "record",
    "purpose",
    "receipt",
    "borrow",
    "owner_lost",
    "docker_throw",
    "missing_closed",
    "invalid_closed",
    "checkpoint",
    "process_unknown",
    "cleanup_unknown",
    "cancel_running",
    "release",
  ]) {
    const current = fixture(fault),
      result = await current.run();
    assert.equal(result.status, "blocked", fault);
    assert.equal(result.recoveryId, current.recoveryId, fault);
    assert.equal(result.hostCleanupCompleted, false, fault);
    const notAcquired = ["cancel_before", "acquire", "acquire_throw"].includes(
      fault,
    );
    assert.equal(
      current.events.filter((event) => event === "release").length,
      notAcquired ? 0 : 1,
      fault,
    );
    assert.equal(
      current.events.includes("cleanup"),
      fault === "release",
      fault,
    );
    if (notAcquired)
      assert.equal(current.events.includes("read"), false, fault);
    if (["record", "purpose", "receipt", "borrow"].includes(fault))
      assert.equal(current.events.includes("docker"), false, fault);
    if (fault === "cancel_running")
      assert.equal(
        current.events.filter((event) => event === "cancel").length,
        1,
      );
  }
});

/**
 * Host清掃は元Lockの失効を破壊Effect前に拒否する。
 * @responsibility 現行Root清掃宣言の世代確認を反証する。
 * @trace PRL-UT-006
 * @precondition 元ownedと有限Identityだけを使う。
 * @stimulus 待機後の世代確認が失敗する。
 * @observation 確認回数とHost処置回数。
 * @oracle 同じ例外を保持し、Host回収へ到達しない。
 * @cleanup 値だけ。実Filesystemなし。
 * @boundary 実宣言と局所依存。
 */
test("Host清掃は待機後のLock不一致を読取り・削除より前に拒否する", () => {
  const source = fs.readFileSync(
    new URL("../../src/lifecycle/host.ts", import.meta.url),
    "utf8",
  );
  const owned = {},
    identity = { root: "owned-root", operationId: "OP-123456", host: {} };
  let checks = 0,
    effects = 0;
  const cleanup = runInNewContext(
    `${sourceDeclaration(source, "removeOwnedOperationRootForCleanup")}\nremoveOwnedOperationRootForCleanup`,
    {
      ownedIdentity: () => identity,
      isObject: () => true,
      ownedOperationGeneration(value: unknown, observed: unknown) {
        assert.strictEqual(value, owned);
        assert.strictEqual(observed, identity);
        checks++;
        throw Error("owned_operation_generation_liveness_lost");
      },
      cleanupHostRoot: () => {
        effects++;
      },
    },
  ) as (owned: object) => void;
  assert.throws(
    () => cleanup(owned),
    /owned_operation_generation_liveness_lost/,
  );
  assert.equal(checks, 1);
  assert.equal(effects, 0);
});
