/**
 * coordinator:unit:provider-lifecycleの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:provider-lifecycleが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope provider、lifecycle
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { describeProviderLifecycleContract } from "../../../src/execution/diagnostics.ts";

/**
 * Provider認証方針は標準Profileをsubscription OAuthへ限定するを検証する。
 *
 * @responsibility Provider認証方針は標準Profileをsubscription OAuthへ限定するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider認証方針は標準Profileをsubscription OAuthへ限定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider認証方針は標準Profileをsubscription OAuthへ限定する", () => {
  const contract = describeProviderLifecycleContract();
  assert.equal(contract.contractRevision, 7);
  assert.equal(
    contract.implementationState,
    "repository_owned_docker_fake_observation",
  );
  assert.equal(contract.syntheticFakeObservationState, "retired");
  assert.equal(contract.limits, null);
  assert.equal(Object.hasOwn(contract, "limits"), true);
  assert.equal(
    contract.authPolicies.codex.loginPolicy,
    "existing_chatgpt_plan_subscription_oauth",
  );
  assert.equal(
    contract.authPolicies.claude.loginPolicy,
    "existing_subscription_oauth",
  );
  assert.equal(contract.apiKeyAllowed, false);
  assert.equal(contract.additionalCreditPurchaseAllowed, false);
  assert.equal(contract.billingPolicy.defaultProfile, "subscription_only");
  assert.equal(
    contract.billingPolicy.defaultPaidApiDisposition,
    "prohibited_and_unsupported",
  );
  assert.equal(contract.billingPolicy.implicitFallbackAllowed, false);
  assert.equal(contract.billingPolicy.quotaExhaustionFallbackAllowed, false);
  assert.equal(contract.oauthTokenReadByRuntime, false);
  assert.equal(contract.rawAuthOutputRecorded, false);
  assert.equal(contract.authPolicies.codex.accountCardinality, 1);
  assert.equal(contract.authPolicies.codex.billingMode, "subscription_only");
  assert.equal(contract.authPolicies.codex.automaticPlanSwitchAllowed, false);
  assert.equal(contract.authPolicies.codex.paidApiProfileSelected, false);
  assert.equal(contract.authPolicies.codex.exactCliVersionRequired, true);
  assert.equal(contract.authPolicies.codex.exactCliVersionConfigured, false);
  assert.equal(
    contract.authPolicies.codex.usageSource,
    "selected_chatgpt_plan_included_usage",
  );
  assert.equal(
    contract.authPolicies.claude.usageSource,
    "selected_subscription_included_usage",
  );
  assert.equal(
    contract.authPolicies.claude.selectedAccountOfferingObserved,
    false,
  );
  assert.equal(
    contract.authPolicies.claude.authenticatedServiceTermsIdentity,
    "unresolved",
  );
  assert.equal(
    contract.authPolicies.claude.automatedSubscriptionUsePermission,
    "unresolved",
  );
  assert.equal(
    contract.authPolicies.claude.humanAccountAuthorityConfirmed,
    false,
  );
  assert.equal(
    contract.authPolicies.claude.accountAuthorityBinding,
    "not_implemented",
  );
  assert.equal(contract.authPolicies.claude.quotaProbe, "not_implemented");
  assert.equal(contract.authPolicies.claude.paidApiProfileSelected, false);
});

/**
 * 専用Provider HomeはProvider単位で永続しOperation cleanupへ含めないを検証する。
 *
 * @responsibility 専用Provider HomeはProvider単位で永続しOperation cleanupへ含めないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 専用Provider HomeはProvider単位で永続しOperation cleanupへ含めないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
test("専用Provider HomeはProvider単位で永続しOperation cleanupへ含めない", () => {
  const home = describeProviderLifecycleContract().dedicatedProviderHome;
  assert.equal(home.scope, "canonical_provider_home_resource");
  assert.equal(home.persistentAcrossOperations, true);
  assert.equal(home.sharedAcrossRepositoriesForSameHome, true);
  assert.equal(home.hostDefaultHomeImportAllowed, false);
  assert.equal(home.otherProviderHomeSharingAllowed, false);
  assert.equal(home.operationCleanupOwned, false);
  assert.equal(
    home.protectionObservation,
    "node_physical_directory_observation_no_acl_verification",
  );
  assert.equal(home.selectedLocalUserBinder, "not_performed");
});

/**
 * 動的Fake契約はDocker所有観測だけを実装済みとしcancelを未実装に保つを検証する。
 *
 * @responsibility 動的Fake契約はDocker所有観測だけを実装済みとしcancelを未実装に保つの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 動的Fake契約はDocker所有観測だけを実装済みとしcancelを未実装に保つの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
test("動的Fake契約はDocker所有観測だけを実装済みとしcancelを未実装に保つ", () => {
  const dynamic =
    describeProviderLifecycleContract().dynamicFakeProviderObservation;
  assert.equal(dynamic.provenance, "repository_owned_docker_fake_provider");
  assert.equal(dynamic.normalExecution, "implemented_candidate");
  assert.equal(dynamic.exactResultNormalization, "implemented_candidate");
  assert.equal(
    dynamic.containerAndProcessTreeAbsence,
    "implemented_candidate_after_owned_cleanup",
  );
  assert.equal(dynamic.inFlightCancellation, "not_implemented");
  assert.equal(dynamic.runtimeAuthorityIssued, false);
  assert.equal(dynamic.operationCapabilityIssued, false);
  assert.equal(dynamic.realProviderReadiness, false);
});
