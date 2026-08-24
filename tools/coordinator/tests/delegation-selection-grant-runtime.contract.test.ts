import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeRuntimeOwnedDelegationSelectionGrant,
  createIsolatedDelegationSelectionGrantRuntimeCandidate,
  describeDelegationSelectionGrantRuntimeContract,
  issueRuntimeOwnedDelegationSelectionGrant,
  revokeRuntimeOwnedDelegationSelectionGrant,
  supersedeRuntimeOwnedDelegationSelectionGrant,
} from "../src/security/delegation-selection-grant-runtime.ts";

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
        modelTier: request.modelTier,
        speedMode: "normal",
        billingMode: "subscription_oauth",
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
            modelTier: request.modelTier,
            speedMode: "normal",
            billingMode: "subscription_oauth",
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
        modelTier: request.modelTier,
        speedMode: "normal",
        billingMode: "subscription_oauth",
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

test("公開契約は短命Grant、Subscription、通常速度と再選定境界を固定する", () => {
  const contract = describeDelegationSelectionGrantRuntimeContract();
  assert.equal(contract.selectionLifetimeMs, 30_000);
  assert.deepEqual(contract.aliases, ["control", "use"]);
  assert.equal(contract.maximumUses, 1);
  assert.equal(contract.billingMode, "subscription_oauth_only");
  assert.equal(contract.speedMode, "normal_only");
  assert.equal(contract.providerFallback, "forbidden_after_selection");
  assert.equal(
    contract.providerEligibility,
    "runtime_owned_observer_connected_required_provider_effect_capability_currently_unavailable",
  );
  assert.equal(
    contract.reselection,
    "atomic_process_local_supersede_after_replacement_validation",
  );
  assert.equal(contract.providerAuthorityIssued, false);
  assert.equal(contract.providerEffectAllowed, false);
});
