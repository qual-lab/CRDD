/**
 * 回復応答の閉形式検査と元Home相関を反証する。
 * @responsibility 検査移管で欠測・余分・accessor・Proxyを許可へ変えない。
 * @trace ERB-IT-004
 * @level UT
 * @scope 合成値だけ。保存・回復処置は行わない。
 * @boundary Host応答とExecutorの受入。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  snapshotReadyRecovery,
  snapshotBlockedRecoveryWithExactId,
} from "../../../src/result/validation.ts";

/**
 * 正常応答と不正な回復値を照合する。
 * @responsibility 原Capabilityとexact参照の結合を維持する。
 * @trace ERB-IT-004
 * @precondition 合成のHome hash・回復参照・不透明Capability。
 * @stimulus Owner有無、別Home、Proxy、accessor、余分・欠測を渡す。
 * @observation 所有Snapshot又はnull、getter未実行。
 * @oracle 同じ条件だけを受理し、観測不能を正常にしない。
 * @cleanup N/A: 外部資源なし。
 * @boundary ERB-IT-004=Direct Boundary: 回復応答検査。
 */
test("回復Snapshotは閉形式と元Homeを維持し不正な値を受理しない", () => {
  const home = "d".repeat(64);
  const id = `docker-task.${home}.${"e".repeat(64)}.${"f".repeat(64)}`;
  const capability = {};
  const ready = {
    status: "ready",
    recoveryId: id,
    recoveryCapability: capability,
  };
  assert.equal(snapshotReadyRecovery(ready)?.recoveryCapability, capability);
  let getterCalls = 0;
  const accessor = {
    ...ready,
    get recoveryId() {
      getterCalls++;
      return id;
    },
  };
  for (const value of [
    null,
    [],
    { ...ready, extra: true },
    { ...ready, recoveryCapability: null },
    accessor,
  ])
    assert.equal(snapshotReadyRecovery(value), null);
  assert.equal(getterCalls, 0);
  const blocked = { status: "blocked", reason: "synthetic", recoveryId: id };
  assert.equal(
    snapshotBlockedRecoveryWithExactId(blocked, home)?.recoveryCapability,
    null,
  );
  const owned = {
    ...blocked,
    recoveryCapability: capability,
    manualRecoveryRequired: true,
  };
  assert.equal(
    snapshotBlockedRecoveryWithExactId(owned, home)?.recoveryCapability,
    capability,
  );
  assert.equal(snapshotBlockedRecoveryWithExactId(owned, "a".repeat(64)), null);
  for (const value of [
    new Proxy(blocked, {}),
    { ...blocked, extra: true },
    { ...blocked, recoveryId: "bad" },
    { ...owned, manualRecoveryRequired: false },
    { ...owned, recoveryCapability: new Proxy({}, {}) },
    { status: "blocked", recoveryId: id },
    {
      ...blocked,
      get reason() {
        getterCalls++;
        return "synthetic";
      },
    },
  ])
    assert.equal(snapshotBlockedRecoveryWithExactId(value, home), null);
  assert.equal(getterCalls, 0);
});
