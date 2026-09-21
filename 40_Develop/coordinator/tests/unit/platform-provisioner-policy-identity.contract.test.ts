/**
 * coordinator:unit:platform-provisioner-policy-identityの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:platform-provisioner-policy-identityが所有する検証責務を実行する。
 * @trace AIT-UT-005
 * @level UT
 * @scope platform、provisioner、policy、identity
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  describePlatformProvisionerPolicyIdentityContract,
  getPlatformProvisionerPolicyIdentity,
} from "../../src/security/platform-provisioner-policy-identity.ts";

/**
 * Root保護と鍵保存の正本contractをcanonical SHA-256へ固定するを検証する。
 *
 * @responsibility Root保護と鍵保存の正本contractをcanonical SHA-256へ固定するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Root保護と鍵保存の正本contractをcanonical SHA-256へ固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Root保護と鍵保存の正本contractをcanonical SHA-256へ固定する", () => {
  const first = getPlatformProvisionerPolicyIdentity();
  const second = getPlatformProvisionerPolicyIdentity();
  assert.match(first.rootProtectionPolicySha256, /^[0-9a-f]{64}$/u);
  assert.match(first.keyStoragePolicySha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(
    describePlatformProvisionerPolicyIdentityContract()
      .callerPolicyHashAccepted,
    false,
  );
});
