/**
 * coordinator:system:dynamic-fake-provider-failure-verificationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:system:dynamic-fake-provider-failure-verificationが所有する検証責務を実行する。
 * @trace EST-ST-005
 * @level ST
 * @scope dynamic、fake、provider、failure、verification
 * @boundary EST-ST-005=System/E2E: 公開入口→Provider→候補・回復→利用側結果
 */
import assert from "node:assert/strict";
import test from "node:test";

import { DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS } from "../../src/security/docker-isolation.ts";
import { verifyDynamicFakeProviderFailures } from "../../scripts/verify-dynamic-fake-provider-failures.ts";

/**
 * 動的Fake失敗verificationは固定scenarioだけを所有し任意入力を受けないを検証する。
 *
 * @responsibility 動的Fake失敗verificationは固定scenarioだけを所有し任意入力を受けないの合否判定を所有する。
 * @trace EST-ST-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 動的Fake失敗verificationは固定scenarioだけを所有し任意入力を受けないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-005=System/E2E: 公開入口→Provider→候補・回復→利用側結果
 */
test("動的Fake失敗verificationは固定scenarioだけを所有し任意入力を受けない", () => {
  assert.deepEqual(DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS, [
    "timeout",
    "output_limit",
    "invalid_output",
    "nonzero_exit",
  ]);
  assert.equal(verifyDynamicFakeProviderFailures.length, 0);
});
