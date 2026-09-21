/**
 * coordinator:unit:platform-provisioner-release-trustの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:platform-provisioner-release-trustが所有する検証責務を実行する。
 * @trace AIT-UT-005
 * @level UT
 * @scope platform、provisioner、release、trust
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import { createHash, createPublicKey } from "node:crypto";
import test from "node:test";

import {
  describePlatformProvisionerReleaseTrustContract,
  getPinnedPlatformProvisionerReleaseSignerSpkiDer,
} from "../../src/security/platform-provisioner-release-trust.ts";

/**
 * Qual-Lab Release公開鍵exact 1本をcanonical Ed25519 SPKIとして固定するを検証する。
 *
 * @responsibility Qual-Lab Release公開鍵exact 1本をcanonical Ed25519 SPKIとして固定するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Qual-Lab Release公開鍵exact 1本をcanonical Ed25519 SPKIとして固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Qual-Lab Release公開鍵exact 1本をcanonical Ed25519 SPKIとして固定する", () => {
  const first = getPinnedPlatformProvisionerReleaseSignerSpkiDer();
  const second = getPinnedPlatformProvisionerReleaseSignerSpkiDer();
  const key = createPublicKey({ key: first, format: "der", type: "spki" });
  const canonical = key.export({ format: "der", type: "spki" });
  assert.equal(key.asymmetricKeyType, "ed25519");
  assert.equal(first.length, 44);
  assert.deepEqual(first, canonical);
  assert.equal(
    createHash("sha256").update(first).digest("hex"),
    "6b250a21be0f8fd582907731a2cba6aae44b991cbff82234c4ee838548c5e95f",
  );
  first.fill(0);
  assert.notDeepEqual(first, second);
  assert.deepEqual(second, getPinnedPlatformProvisionerReleaseSignerSpkiDer());
});

/**
 * 固定Release Trustはcaller鍵fallbackと秘密鍵同梱を禁止するを検証する。
 *
 * @responsibility 固定Release Trustはcaller鍵fallbackと秘密鍵同梱を禁止するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定Release Trustはcaller鍵fallbackと秘密鍵同梱を禁止するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("固定Release Trustはcaller鍵fallbackと秘密鍵同梱を禁止する", () => {
  const contract = describePlatformProvisionerReleaseTrustContract();
  assert.equal(contract.owner, "Qual-Lab");
  assert.equal(contract.algorithm, "Ed25519");
  assert.equal(contract.activeKeyCount, 1);
  assert.equal(contract.unknownKeyFallbackAllowed, false);
  assert.equal(contract.callerKeyMayReplaceTrustAnchor, false);
  assert.equal(contract.privateKeyStoredInRepository, false);
  assert.equal(contract.rotationRequiresHumanApprovedCrddChange, true);
  assert.equal(contract.runtimeAuthorityConferred, false);
  assert.equal(contract.runtimeCapabilityIssued, false);
});
