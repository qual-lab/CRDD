/**
 * coordinator:unit:provider-home-observationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:provider-home-observationが所有する検証責務を実行する。
 * @trace AIT-UT-005
 * @level UT
 * @scope protected-root、protocol
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  describeProviderHomeObservationContract,
  WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
} from "../../../../platform-access/src/index.ts";
import {
  consumeRuntimeOwnedProviderHomeObservationCapability,
  describeProviderHomeWindowsAdapterContract,
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
} from "../../../src/provider/home-windows-adapter.ts";

/**
 * Provider Home observation contractはcaller PathとCredential readを持たないを検証する。
 *
 * @responsibility Provider Home observation contractはcaller PathとCredential readを持たないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider Home observation contractはcaller PathとCredential readを持たないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider Home observation contractはcaller PathとCredential readを持たない", () => {
  const contract = describeProviderHomeObservationContract();
  assert.equal(contract.callerSuppliedPathAccepted, false);
  assert.equal(contract.requestPathField, false);
  assert.equal(contract.requestMountSourceHashField, true);
  assert.equal(contract.requestMountSourceHashAuthority, false);
  assert.equal(Object.hasOwn(contract, "candidateStoreFixedSegments"), false);
  assert.equal(contract.credentialContentRead, false);
  assert.equal(contract.rawPathReported, false);
  assert.equal(contract.runtimeAuthorityIssued, false);
  assert.equal(contract.mountGrantIssued, false);
  const adapter = describeProviderHomeWindowsAdapterContract();
  assert.equal(adapter.contractRevision, 7);
  assert.deepEqual(adapter.artifactVerification, {
    normal: "fixed_bootstrap_hash_and_artifact_identity_before_and_after",
    development:
      "fixed_development_borrowed_native_observation_and_artifact_identity_before_and_after",
  });
  assert.equal(Object.isFrozen(adapter.artifactVerification), true);
  assert.equal(
    adapter.executablePath,
    "fixed_distribution_relative_absolute_path",
  );
  assert.equal(adapter.shellInvocation, false);
  assert.equal(adapter.pathLookup, false);
  assert.equal(adapter.callerSuppliedPathAccepted, false);
  assert.equal(
    adapter.environment,
    WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
  );
  assert.deepEqual(adapter.environmentUnavailable, {
    helperSpawnAttempts: 0,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    observationCapabilityIssued: false,
    runtimeAuthorityIssued: false,
  });
  assert.equal(
    adapter.processTreeTerminationConfirmation.includes("step_4"),
    true,
  );
  const invalid = inspectRuntimeOwnedWindowsProviderHomeCandidate("other");
  assert.equal(invalid.status, "blocked");
  assert.equal(invalid.helperSpawnAttempts, 0);
  assert.equal(invalid.runtimeOwnedObservationCapabilityIssued, false);
  assert.equal(consumeRuntimeOwnedProviderHomeObservationCapability({}), null);
});
