/**
 * 元Snapshotによる単独回収を実Executor・共通DI Lifecycleで確認する。
 * @responsibility 旧用途別Adapterを介さず通知・取消・回収未確認を反証する。
 * @trace ERB-IT-014
 * @level UT
 * @scope 既存の有限CLI／Process／Directory代役。実Docker・外部AI・保持物は操作しない。
 */
import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createIsolationFixture } from "../../../../docker-isolation/tests/support/isolation.ts";
import type {
  ResourceTarget,
  IsolationCallbacks,
} from "../../../../docker-isolation/src/index.ts";

const ID = "a".repeat(64);

/** 共通DIの端だけを有限化し、公開回収関数へ元Sessionを接続する。 */
async function fixture(t: TestContext) {
  const f = await createIsolationFixture(t);
  const original = await import("../../../../docker-isolation/src/index.ts");
  t.mock.module("../../../../docker-isolation/src/index.ts", {
    namedExports: { ...original, cleanupIsolation: f.api.cleanupIsolation },
  });
  const api: typeof import("../../../src/lifecycle/cleanup.ts") = await import(
    new URL(
      "../../../src/lifecycle/cleanup.ts?recovery=" + Math.random(),
      import.meta.url,
    ).href
  );
  const prepared = f.api.prepareIsolation(f.request);
  assert.ok(prepared);
  const initial = await f.api.executeIsolation(prepared).completion;
  assert.equal(initial.cleanup.confirmed, true);
  const target: ResourceTarget<"snapshot"> = {
    resources: initial.resources,
    managementDirectory: f.request.managementDirectory,
    cleanupOrder: f.request.cleanupOrder,
    setupTimeoutMs: f.request.setupTimeoutMs,
    unreceiptedAbsence: "observe",
    verifyLabelAbsence: false,
    previouslyAbsent: [],
  };
  return { f, api, target };
}

/** 通常完了で得た元Snapshotをそのまま単独回収へ渡す。 */
test("単独回収は元Snapshot・実IDで共通DIへ接続し技術結果を返す", async (t) => {
  const { f, api, target } = await fixture(t);
  f.ids.add(ID);
  const result = await api.cleanupResources(target).completion;
  assert.equal(result.cleanup.confirmed, true);
  assert.equal(result.processTerminationConfirmed, true);
  assert.equal(result.resources.resources[0]?.identity.dockerId, ID);
  assert.equal(f.ids.size, 0);
});

/** ID欠測の再発見は必須通知の完了前に削除しない。 */
test("発見実IDは保存通知完了後だけ削除し通知拒否では保持する", async (t) => {
  for (const mode of ["saved", "throw", "reject", "missing"] as const)
    await t.test(mode, async (t) => {
      const { f, api, target } = await fixture(t);
      f.ids.add(ID);
      const unknown: ResourceTarget<"snapshot"> = {
        ...target,
        resources: {
          resources: target.resources.resources.map((r) => ({
            ...r,
            request: "unknown" as const,
            identity: { ...r.identity, dockerId: null },
          })),
        },
      };
      let saved = false;
      const callbacks: IsolationCallbacks =
        mode === "missing"
          ? {}
          : {
              onResourceIdentified: (_key, snapshot) => {
                assert.equal(f.ids.has(ID), true);
                assert.equal(snapshot.resources[0]?.identity.dockerId, ID);
                if (mode === "throw") throw Error("save_failed");
                if (mode === "reject")
                  return Promise.reject(Error("save_failed"));
                saved = true;
              },
              onCleanupCompleted: () => {
                assert.equal(saved, true);
              },
            };
      const result = await api.cleanupResources(unknown, callbacks).completion;
      assert.equal(result.cleanup.confirmed, mode === "saved");
      assert.equal(f.ids.has(ID), mode !== "saved");
      assert.equal(
        result.resources.resources[0]?.identity.dockerId,
        ID,
        "通知失敗でも発見済みIDを失わない",
      );
    });
});

/** 回収前通知の失敗を削除許可へ変換しない。 */
test("回収前通知のthrow・Rejectでは元資源を処置しない", async (t) => {
  for (const asyncFailure of [false, true])
    await t.test(String(asyncFailure), async (t) => {
      const { f, api, target } = await fixture(t);
      f.ids.add(ID);
      const result = await api.cleanupResources(target, {
        onCleanupSubmitting: () => {
          if (asyncFailure) return Promise.reject(Error("intent_failed"));
          throw Error("intent_failed");
        },
      }).completion;
      assert.equal(result.cleanup.confirmed, false);
      assert.equal(f.ids.has(ID), true);
      assert.equal(result.resources.resources[0]?.identity.dockerId, ID);
    });
});

/** 取消受付と最終回収の成立は別の事実として保持する。 */
test("単独回収の取消は次の資源削除を止め元Sessionに完了を残す", async (t) => {
  const { f, api, target } = await fixture(t);
  f.ids.add(ID);
  const session = api.cleanupResources(target);
  const cancellation = await session.cancel();
  const result = await session.completion;
  assert.equal(cancellation.cancellationRequested, true);
  assert.equal(result.cancellationRequested, true);
  assert.equal(result.cleanup.confirmed, false);
  assert.equal(f.ids.has(ID), true);
});

/** 資源不存在だけでconfig終了の不明を成功へ変換しない。 */
test("config終了不明と通知不成立を物理回収成立から分離する", async (t) => {
  for (const mode of ["config", "notice"] as const)
    await t.test(mode, async (t) => {
      const { f, api, target } = await fixture(t);
      if (mode === "config") f.configObservation = "EACCES";
      const result = await api.cleanupResources(
        target,
        mode === "notice"
          ? {
              onResourcesClosed: () => Promise.reject(Error("terminal_failed")),
            }
          : {},
      ).completion;
      assert.equal(result.cleanup.confirmed, mode !== "config");
      assert.equal(result.cleanup.configCleanupConfirmed, mode !== "config");
      if (mode === "notice")
        assert.equal(result.notificationDeliveryConfirmed, false);
    });
});
