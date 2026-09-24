/**
 * coordinator:unit:delegation-selection-grant-runtimeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:delegation-selection-grant-runtimeが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope delegation、selection、grant、runtime
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeRuntimeOwnedDelegationSelectionGrant,
  createIsolatedDelegationSelectionGrantRuntimeCandidate,
  describeDelegationSelectionGrantRuntimeContract,
  issueRuntimeOwnedDelegationSelectionGrant,
  revokeRuntimeOwnedDelegationSelectionGrant,
  supersedeRuntimeOwnedDelegationSelectionGrant,
} from "../../src/security/delegation-selection-grant-runtime.ts";

/**
 * createRequestのTest準備責務を実行する。
 *
 * @responsibility createRequestがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createRequestを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    frontProvider: "codex",
    delegationNeed: "beneficial",
    delegationReason: "specialized_executor_benefit",
    requestedExecutorProvider: "auto",
    subjectProvider: null,
    requiresIndependentProvider: false,
    role: "executor",
    workClass: "bounded_implementation",
    planState: "complete",
    risk: "low",
    difficulty: "low",
    decisionImpact: "limited",
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
    operationId: "OP-123456",
    parentOperationId: null,
    ancestorOperationIds: [],
    delegationDepth: 0,
    ...overrides,
  };
}

/**
 * createFixtureのTest準備責務を実行する。
 *
 * @responsibility createFixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createFixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
function createFixture(
  overrides: Partial<
    Parameters<typeof createIsolatedDelegationSelectionGrantRuntimeCandidate>[0]
  > = {},
) {
  const managementCapability = Object.freeze({});
  let wallClockMs = 1_000;
  let monotonicMs = 2_000;
  let randomValue = 0;
  const runtime = createIsolatedDelegationSelectionGrantRuntimeCandidate({
    verifyOperation: (candidate: unknown) => {
      assert.equal(candidate, managementCapability);
      return Object.freeze({
        operationId: "OP-123456",
        createdAt: "2026-08-24T00:00:00.000Z",
      });
    },
    observeProviderEligibility: () =>
      Object.freeze([
        Object.freeze({
          provider: "codex",
          status: "eligible",
          reason: "ready",
        }),
        Object.freeze({
          provider: "claude",
          status: "eligible",
          reason: "ready",
        }),
      ]),
    resolveModelProfile: (request) =>
      Object.freeze({
        provider: request.provider,
        profileId:
          request.provider === "claude" ? "PROFILE-123456" : "PROFILE-654321",
        exactModelId:
          request.provider === "claude"
            ? "claude-opus-test-profile"
            : "codex-sol-test-profile",
        family: request.family,
        selectionRole: request.role,
        modelTier: request.modelTier,
        speedMode: "normal",
        billingMode: "subscription_oauth",
        compatibilityReason: null,
      }),
    wallNow: () => wallClockMs,
    monotonicNow: () => monotonicMs,
    randomBytes: (size: number) => {
      randomValue += 1;
      return Buffer.alloc(size, randomValue);
    },
    ...overrides,
  });
  return Object.freeze({
    runtime,
    managementCapability,
    advanceBeyondLifetime: () => {
      wallClockMs += 30_000;
      monotonicMs += 30_000;
    },
    rollbackWallClock: () => {
      wallClockMs -= 1;
    },
  });
}

/**
 * 4経路候補をOperationとProfileへ結合した一回限りSelection Grantにするを検証する。
 *
 * @responsibility 4経路候補をOperationとProfileへ結合した一回限りSelection Grantにするの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 4経路候補をOperationとProfileへ結合した一回限りSelection Grantにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("4経路候補をOperationとProfileへ結合した一回限りSelection Grantにする", () => {
  const fixture = createFixture();
  const issued = fixture.runtime.issue(
    fixture.managementCapability,
    createRequest(),
  );
  assert.equal(issued.status, "issued");
  assert.match(issued.selectionRecordId ?? "", /^MODELSEL-[A-F0-9]{24}$/);
  assert.equal(issued.route, "front_codex__executor_claude");
  assert.equal(issued.profileId, "PROFILE-123456");
  assert.equal(issued.selectedModel, "claude-opus-test-profile");
  assert.equal(issued.selectedEffort, "low");
  assert.equal(issued.speedMode, "normal");
  assert.match(issued.selectionNotice ?? "", /経路選定理由/);
  assert.equal(issued.providerAuthorityIssued, false);
  assert.equal(issued.providerEffectAllowed, false);

  const consumed = fixture.runtime.consume(
    issued.useCapability,
    fixture.managementCapability,
  );
  assert.ok(consumed);
  assert.equal(consumed.selectionRecordId, issued.selectionRecordId);
  assert.equal(consumed.executorProvider, "claude");
  assert.equal(consumed.profileId, "PROFILE-123456");
  assert.equal(consumed.model, "claude-opus-test-profile");
  assert.equal(consumed.effort, "low");
  assert.equal(consumed.delegationDepth, 1);
  assert.equal(
    fixture.runtime.consume(issued.useCapability, fixture.managementCapability),
    null,
  );
});

/**
 * control aliasは未使用Selection Grantを全aliasごと失効するを検証する。
 *
 * @responsibility control aliasは未使用Selection Grantを全aliasごと失効するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus control aliasは未使用Selection Grantを全aliasごと失効するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("control aliasは未使用Selection Grantを全aliasごと失効する", () => {
  const fixture = createFixture();
  const issued = fixture.runtime.issue(
    fixture.managementCapability,
    createRequest(),
  );
  const revoked = fixture.runtime.revoke(
    issued.controlCapability,
    fixture.managementCapability,
  );
  assert.equal(revoked.status, "revoked");
  assert.equal(
    fixture.runtime.consume(issued.useCapability, fixture.managementCapability),
    null,
  );
  assert.equal(
    fixture.runtime.revoke(
      issued.controlCapability,
      fixture.managementCapability,
    ).status,
    "blocked",
  );
});

/**
 * Front Agent retained結果へSelection Grantを発行しないを検証する。
 *
 * @responsibility Front Agent retained結果へSelection Grantを発行しないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Front Agent retained結果へSelection Grantを発行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Front Agent retained結果へSelection Grantを発行しない", () => {
  const fixture = createFixture();
  const retained = fixture.runtime.issue(
    fixture.managementCapability,
    createRequest({
      delegationNeed: "none",
      delegationReason:
        "front_can_complete_without_specialized_or_independent_child",
    }),
  );
  assert.equal(retained.status, "blocked");
  assert.equal(retained.reason, "delegation_selection_route_invalid");
  assert.equal(retained.selectionCapabilityIssued, false);
  assert.equal(retained.providerEffectAllowed, false);
});

/**
 * 再選定はreplacement検証後にだけ旧Grantを失効するを検証する。
 *
 * @responsibility 再選定はreplacement検証後にだけ旧Grantを失効するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 再選定はreplacement検証後にだけ旧Grantを失効するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("再選定はreplacement検証後にだけ旧Grantを失効する", () => {
  const fixture = createFixture();
  const issued = fixture.runtime.issue(
    fixture.managementCapability,
    createRequest(),
  );
  const replacement = fixture.runtime.supersede(
    issued.controlCapability,
    fixture.managementCapability,
    createRequest({ requestedExecutorProvider: "codex" }),
  );
  assert.equal(replacement.status, "issued");
  assert.equal(replacement.reason, "delegation_selection_grant_superseded");
  assert.equal(
    replacement.supersededSelectionRecordId,
    issued.selectionRecordId,
  );
  assert.equal(replacement.executorProvider, "codex");
  assert.equal(
    fixture.runtime.consume(issued.useCapability, fixture.managementCapability),
    null,
  );
  assert.equal(
    fixture.runtime.consume(
      replacement.useCapability,
      fixture.managementCapability,
    )?.executorProvider,
    "codex",
  );
});

/**
 * replacement検証失敗時は旧Grantを保持するを検証する。
 *
 * @responsibility replacement検証失敗時は旧Grantを保持するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus replacement検証失敗時は旧Grantを保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("replacement検証失敗時は旧Grantを保持する", () => {
  let profileResolutionAllowed = true;
  const fixture = createFixture({
    resolveModelProfile: (request) =>
      profileResolutionAllowed
        ? Object.freeze({
            provider: request.provider,
            profileId: "PROFILE-123456",
            exactModelId: "claude-opus-test-profile",
            family: request.family,
            selectionRole: request.role,
            modelTier: request.modelTier,
            speedMode: "normal",
            billingMode: "subscription_oauth",
            compatibilityReason: null,
          })
        : null,
  });
  const issued = fixture.runtime.issue(
    fixture.managementCapability,
    createRequest(),
  );
  profileResolutionAllowed = false;
  const replacement = fixture.runtime.supersede(
    issued.controlCapability,
    fixture.managementCapability,
    createRequest({ requestedExecutorProvider: "codex" }),
  );
  assert.equal(replacement.status, "blocked");
  assert.equal(replacement.reason, "delegation_selection_profile_invalid");
  assert.equal(
    fixture.runtime.consume(issued.useCapability, fixture.managementCapability)
      ?.selectionRecordId,
    issued.selectionRecordId,
  );
});

/**
 * 別Operation、利用不能ProviderとProfile差をGrant発行前に拒否するを検証する。
 *
 * @responsibility 別Operation、利用不能ProviderとProfile差をGrant発行前に拒否するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 別Operation、利用不能ProviderとProfile差をGrant発行前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("別Operation、利用不能ProviderとProfile差をGrant発行前に拒否する", () => {
  const fixture = createFixture();
  assert.equal(
    fixture.runtime.issue(
      fixture.managementCapability,
      createRequest({ operationId: "OP-999999" }),
    ).reason,
    "delegation_selection_route_invalid",
  );
  const unavailable = createFixture({
    observeProviderEligibility: () =>
      Object.freeze([
        Object.freeze({
          provider: "codex",
          status: "ineligible",
          reason: "policy_blocked",
        }),
        Object.freeze({
          provider: "claude",
          status: "ineligible",
          reason: "subscription_quota_unavailable",
        }),
      ]),
  });
  assert.equal(
    unavailable.runtime.issue(unavailable.managementCapability, createRequest())
      .reason,
    "delegation_selection_route_invalid",
  );
  const wrongProfile = createFixture({
    resolveModelProfile: (request) =>
      Object.freeze({
        provider: request.provider,
        profileId: "PROFILE-123456",
        exactModelId: "claude-opus-test-profile",
        family: "wrong-family",
        selectionRole: request.role,
        modelTier: request.modelTier,
        speedMode: "normal",
        billingMode: "subscription_oauth",
        compatibilityReason: null,
      }),
  });
  assert.equal(
    wrongProfile.runtime.issue(
      wrongProfile.managementCapability,
      createRequest(),
    ).reason,
    "delegation_selection_profile_invalid",
  );
});

/**
 * 30秒期限、clock rollbackと乱数衝突をfail closedにするを検証する。
 *
 * @responsibility 30秒期限、clock rollbackと乱数衝突をfail closedにするの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 30秒期限、clock rollbackと乱数衝突をfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("30秒期限、clock rollbackと乱数衝突をfail closedにする", () => {
  const fixture = createFixture();
  const issued = fixture.runtime.issue(
    fixture.managementCapability,
    createRequest(),
  );
  fixture.advanceBeyondLifetime();
  assert.equal(
    fixture.runtime.consume(issued.useCapability, fixture.managementCapability),
    null,
  );

  const rollback = createFixture();
  const rollbackIssued = rollback.runtime.issue(
    rollback.managementCapability,
    createRequest(),
  );
  rollback.rollbackWallClock();
  assert.equal(
    rollback.runtime.consume(
      rollbackIssued.useCapability,
      rollback.managementCapability,
    ),
    null,
  );

  const collision = createFixture({
    randomBytes: (size: number) => Buffer.alloc(size, 7),
  });
  assert.equal(
    collision.runtime.issue(collision.managementCapability, createRequest())
      .status,
    "issued",
  );
  assert.equal(
    collision.runtime.issue(collision.managementCapability, createRequest())
      .reason,
    "delegation_selection_runtime_state_invalid",
  );
});

/**
 * production入口はRuntime-owned Eligibilityでも偽造Capabilityを拒否するを検証する。
 *
 * @responsibility production入口はRuntime-owned Eligibilityでも偽造Capabilityを拒否するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production入口はRuntime-owned Eligibilityでも偽造Capabilityを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("production入口はRuntime-owned Eligibilityでも偽造Capabilityを拒否する", () => {
  const issued = issueRuntimeOwnedDelegationSelectionGrant({}, createRequest());
  assert.equal(issued.status, "blocked");
  assert.equal(issued.providerEffectAllowed, false);
  assert.equal(consumeRuntimeOwnedDelegationSelectionGrant({}, {}), null);
  assert.equal(
    revokeRuntimeOwnedDelegationSelectionGrant({}, {}).status,
    "blocked",
  );
  assert.equal(
    supersedeRuntimeOwnedDelegationSelectionGrant({}, {}, createRequest())
      .status,
    "blocked",
  );
});

/**
 * 公開契約は短命Grant、Subscription、通常速度と再選定境界を固定するを検証する。
 *
 * @responsibility 公開契約は短命Grant、Subscription、通常速度と再選定境界を固定するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約は短命Grant、Subscription、通常速度と再選定境界を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("公開契約は短命Grant、Subscription、通常速度と再選定境界を固定する", () => {
  const contract = describeDelegationSelectionGrantRuntimeContract();
  assert.equal(contract.contractRevision, 4);
  assert.equal(contract.selectionLifetimeMs, 30_000);
  assert.deepEqual(contract.aliases, ["control", "use"]);
  assert.equal(contract.maximumUses, 1);
  assert.equal(contract.billingMode, "subscription_oauth_only");
  assert.equal(contract.speedMode, "normal_only");
  assert.equal(
    contract.providerFallback,
    "forbidden_after_provider_request_or_when_effect_state_is_uncertain",
  );
  assert.equal(
    contract.providerEligibility,
    "runtime_owned_preselection_candidate_with_home_distribution_policy_auth_preflight_deferred",
  );
  assert.equal(
    contract.reselection,
    "process_local_supersede_api_exists_but_general_task_uses_new_operation_after_cleanup",
  );
  assert.equal(contract.providerAuthorityIssued, false);
  assert.equal(contract.providerEffectAllowed, false);
});
