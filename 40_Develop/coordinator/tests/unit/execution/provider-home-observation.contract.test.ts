/**
 * Provider HomeのNode観測契約を、実体の観測と分けて確認する。
 * @packageDocumentation
 * @responsibility OS保護成功・Native起動を宣言しない契約を固定する。
 * @trace AIT-UT-005
 * @level UT
 * @scope 静的記述と入力不正だけ。実体は別の新品Filesystem試験。
 * @boundary 同一Process内の記述・拒否。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  describeProviderHomeWindowsAdapterContract,
  inspectWindowsProviderHomeCandidate,
} from "../../../src/lifecycle/environment.ts";

test("Provider HomeのNode契約はNative・OS主体・ACL検証を成功扱いしない", () => {
  const contract = describeProviderHomeWindowsAdapterContract();
  assert.equal(contract.contractRevision, 10);
  assert.equal(contract.locationSource, "upper_configuration");
  assert.equal(
    contract.observation,
    "node_lstat_realpath_and_physical_identity_twice",
  );
  assert.equal(contract.nativePolicyVerification, false);
  assert.equal(contract.osPrincipalVerification, false);
  assert.equal(contract.processEffectIssued, false);
  assert.equal(contract.credentialContentRead, false);
  const invalid = inspectWindowsProviderHomeCandidate("other");
  assert.equal(invalid.status, "blocked");
  for (const key of [
    "helperSpawnAttempts",
    "helperSpawned",
    "helperExitConfirmed",
    "nativeSourceRevision",
    "artifactVerifiedBeforeAndAfter",
    "processTreeTerminationConfirmed",
  ])
    assert.equal(Object.hasOwn(invalid, key), false);
  assert.equal(invalid.processEffectIssued, false);
  assert.equal(invalid.manualRecoveryRequired, false);
});
