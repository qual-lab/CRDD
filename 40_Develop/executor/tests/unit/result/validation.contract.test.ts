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
  ATTEMPT_COMPLETION_REASONS,
  isAttemptFailureReason,
} from "../../../src/result/validation.ts";
import { dockerProcessControllerPublicCompletionReasons } from "../../../../domain-model/src/index.ts";

/**
 * 発行する技術理由と保存受理する理由の集合をexact照合する。
 * @responsibility 片側追加・欠落・未知値を黙って受理しない。
 * @trace ERB-IT-004
 * @precondition 固定の二集合だけを使用する。
 * @stimulus 全要素と未知・大文字・欠測相当を検査する。
 * @observation 配列の一致と拒否結果。
 * @oracle 同じ順序・一意集合で、未知理由を正規化しない。
 * @cleanup N/A: 局所値だけ。
 * @boundary Executor発行とDomain保存受理。保存処理は呼ばない。
 */
test("技術理由は保存受理集合と一致し未知・欠測・余剰を拒否する", () => {
  assert.deepEqual(
    ATTEMPT_COMPLETION_REASONS,
    dockerProcessControllerPublicCompletionReasons,
  );
  assert.equal(
    new Set(ATTEMPT_COMPLETION_REASONS).size,
    ATTEMPT_COMPLETION_REASONS.length,
  );
  for (const reason of ATTEMPT_COMPLETION_REASONS)
    assert.equal(isAttemptFailureReason(reason), true);
  for (const reason of [
    null,
    undefined,
    "",
    "unknown",
    ...ATTEMPT_COMPLETION_REASONS.map((r) => r.toUpperCase()),
  ])
    assert.equal(isAttemptFailureReason(reason), false);
});
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
