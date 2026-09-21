/**
 * coordinator:unit:host-generation-loss-transitionの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:host-generation-loss-transitionが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope host、generation、loss、transition
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { reduceHostGenerationLossTransition } from "../../src/core/host-generation-loss-transition.ts";

/**
 * Host generation loss reducerは検出・confirmed・unknownを単調に分離するを検証する。
 *
 * @responsibility Host generation loss reducerは検出・confirmed・unknownを単調に分離するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host generation loss reducerは検出・confirmed・unknownを単調に分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Host generation loss reducerは検出・confirmed・unknownを単調に分離する", () => {
  assert.deepEqual(reduceHostGenerationLossTransition("failure_detected"), {
    retired: true,
    revokeEffectCapabilities: true,
    beginEffectDrain: true,
    poisonProcess: false,
  });
  assert.deepEqual(
    reduceHostGenerationLossTransition("cleanup_confirmed_failure"),
    {
      retired: true,
      revokeEffectCapabilities: true,
      beginEffectDrain: false,
      poisonProcess: false,
    },
  );
  assert.deepEqual(reduceHostGenerationLossTransition("cleanup_unknown"), {
    retired: true,
    revokeEffectCapabilities: true,
    beginEffectDrain: false,
    poisonProcess: true,
  });
});
