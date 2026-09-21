/**
 * coordinator:unit:docker-runtime-state-bindingの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:docker-runtime-state-bindingが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope docker、runtime、state、binding
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { isExactDockerRuntimeStateMutationBoundary } from "../../src/security/docker-runtime-state-binding.ts";

const recoveryId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
const binding = Object.freeze({
  rootPath: "C:\\RuntimeState",
  runtimeStateIdentityHash: "d".repeat(64),
  runtimeStateProtectionHash: "e".repeat(64),
  localUserBindingHash: "f".repeat(64),
  runtimeStateBindingHash: "1".repeat(64),
});

/**
 * RuntimeState mutationはRoot、保護、選択userとRecovery IDの完全一致だけを受理するを検証する。
 *
 * @responsibility RuntimeState mutationはRoot、保護、選択userとRecovery IDの完全一致だけを受理するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus RuntimeState mutationはRoot、保護、選択userとRecovery IDの完全一致だけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("RuntimeState mutationはRoot、保護、選択userとRecovery IDの完全一致だけを受理する", () => {
  assert.equal(
    isExactDockerRuntimeStateMutationBoundary(
      binding,
      binding,
      Object.freeze([recoveryId]),
      recoveryId,
    ),
    true,
  );
});

/**
 * Root差替え、別selected-user、別bindingと欠落Recovery IDを拒否するを検証する。
 *
 * @responsibility Root差替え、別selected-user、別bindingと欠落Recovery IDを拒否するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Root差替え、別selected-user、別bindingと欠落Recovery IDを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Root差替え、別selected-user、別bindingと欠落Recovery IDを拒否する", () => {
  for (const [key, value] of [
    ["rootPath", "D:\\RuntimeState"],
    ["runtimeStateIdentityHash", "2".repeat(64)],
    ["runtimeStateProtectionHash", "3".repeat(64)],
    ["localUserBindingHash", "4".repeat(64)],
    ["runtimeStateBindingHash", "5".repeat(64)],
  ] as const) {
    assert.equal(
      isExactDockerRuntimeStateMutationBoundary(
        binding,
        Object.freeze({ ...binding, [key]: value }),
        Object.freeze([recoveryId]),
        recoveryId,
      ),
      false,
      key,
    );
  }
  assert.equal(
    isExactDockerRuntimeStateMutationBoundary(
      binding,
      binding,
      Object.freeze([]),
      recoveryId,
    ),
    false,
  );
});
