/**
 * coordinator:unit:provider-homeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:provider-homeが所有する検証責務を実行する。
 * @trace AIT-UT-005
 * @level UT
 * @scope provider、home
 * @boundary AIT-UT-005=N/A: 既存Ownerの局所的な入力・権限・隔離規則を検証し、総合Trustの評価器は扱わない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  describeProviderHomeContract,
  PROVIDER_HOME_CONTRACT,
  PROVIDER_HOME_CONTRACT_REVISION,
} from "../../../src/execution/authority.ts";

/**
 * 専用Provider Homeはlocal userとProvider単位の固定方針を持つを検証する。
 *
 * @responsibility 専用Provider Homeはlocal userとProvider単位の固定方針を持つの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 専用Provider Homeはlocal userとProvider単位の固定方針を持つの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("専用Provider Homeはlocal userとProvider単位の固定方針を持つ", () => {
  const contract = describeProviderHomeContract();
  assert.equal(contract.contract, PROVIDER_HOME_CONTRACT);
  assert.equal(contract.contractRevision, PROVIDER_HOME_CONTRACT_REVISION);
  assert.equal(contract.scope, "canonical_provider_home_resource");
  assert.deepEqual(contract.providers, ["codex", "claude"]);
  assert.equal(contract.persistentAcrossOperations, true);
  assert.equal(contract.sharedAcrossRepositoriesForSameHome, true);
  assert.equal(contract.hostDefaultHomeImportAllowed, false);
  assert.equal(contract.hostCredentialImportAllowed, false);
  assert.equal(contract.operationTemporaryHomeImportAllowed, false);
  assert.equal(contract.otherProviderHomeSharingAllowed, false);
  assert.equal(contract.operationCleanupOwned, false);
  assert.equal(contract.symbolicLinkOrNoncanonicalPathAllowed, false);
  assert.equal(contract.stableRootIdentityRequired, true);
  assert.equal(contract.selectedLocalUserBindingRequired, false);
  assert.equal(contract.ownerAndDaclVerificationRequired, false);
  assert.equal(contract.osPermissions, "operator_precondition");
});

/**
 * Home契約は保護・認証・mount Grantの実装済み主張へ昇格しないことを検証する。
 *
 * @responsibility Home契約の実観測と未実装の保証を区別する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 現行Home契約を取得する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("Home契約は未実装の保護・認証を成立扱いしない", () => {
  const contract = describeProviderHomeContract();
  assert.equal(Object.hasOwn(contract, "layoutCandidateInputSource"), false);
  assert.equal(
    contract.requiredEffectRootSource,
    "upper_configured_provider_home_parent",
  );
  assert.equal(contract.protectionEffect, "not_implemented");
  assert.equal(
    contract.protectionObservation,
    "node_physical_directory_observation_no_acl_verification",
  );
  assert.equal(contract.selectedLocalUserBinder, "not_performed");
  assert.equal(contract.windowsAdapter.nativePolicyVerification, false);
  assert.equal(contract.windowsAdapter.processEffectIssued, false);
  assert.equal(contract.authSessionProbe, "not_implemented");
  assert.equal(contract.callerPathConfersAuthority, false);
  assert.equal(contract.filesystemEffectIssued, false);
  assert.equal(contract.runtimeAuthorityIssued, false);
  assert.equal(contract.operationCapabilityIssued, false);
});
