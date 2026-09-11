import assert from "node:assert/strict";
import test from "node:test";

import {
  describeDelegationRouteSelectionContract,
  selectDelegationExecutionSlateCandidate,
  selectDelegationRouteCandidate,
} from "../../src/security/delegation-route-selection.ts";

function createRequest(
  frontProvider: "codex" | "claude",
  overrides: Record<string, unknown> = {},
) {
  return {
    frontProvider,
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

const BOTH_ELIGIBLE = Object.freeze({
  providerEligibility: Object.freeze([
    Object.freeze({ provider: "codex", status: "eligible", reason: "ready" }),
    Object.freeze({ provider: "claude", status: "eligible", reason: "ready" }),
  ]),
});

test("Front Codexから具体実装をClaude Executorへ選ぶ②経路", () => {
  const selected = selectDelegationRouteCandidate(
    createRequest("codex"),
    BOTH_ELIGIBLE,
  );
  assert.equal(selected.status, "candidate");
  assert.equal(selected.route, "front_codex__executor_claude");
  assert.equal(selected.executorProvider, "claude");
  assert.equal(selected.modelSelection?.effort, "low");
  assert.match(selected.selectionNotice ?? "", /front=codex executor=claude/);
  assert.equal(selected.providerEffectAllowed, false);
});

test("移譲不要ならProvider eligibilityなしでFront Agentだけに保持する", () => {
  const selected = selectDelegationRouteCandidate(
    createRequest("codex", {
      delegationNeed: "none",
      delegationReason:
        "front_can_complete_without_specialized_or_independent_child",
    }),
    { providerEligibility: null },
  );
  assert.equal(selected.status, "retained");
  assert.equal(selected.route, "front_codex_only");
  assert.equal(selected.executorProvider, null);
  assert.equal(selected.delegationDepth, 0);
  assert.equal(selected.selectionCapabilityIssued, false);
  assert.equal(selected.providerEffectAllowed, false);
  assert.match(selected.selectionNotice ?? "", /子Agent費用=no/);
});

test("Front Claudeから独立レビューをCodexへ選ぶ③経路", () => {
  const selected = selectDelegationRouteCandidate(
    createRequest("claude", {
      subjectProvider: "claude",
      requiresIndependentProvider: true,
      role: "independent_reviewer",
      workClass: "security_review",
      risk: "material",
      difficulty: "medium",
      decisionImpact: "material",
      isLocalCandidateOnly: false,
      requiresCrossContextAlignment: true,
    }),
    BOTH_ELIGIBLE,
  );
  assert.equal(selected.status, "candidate");
  assert.equal(selected.route, "front_claude__executor_codex");
  assert.equal(selected.executorProvider, "codex");
  assert.equal(selected.modelSelection?.effort, "medium");
  assert.equal(
    selected.selectionReasonCodes.includes("independent_provider_required"),
    true,
  );
});

test("Codex向きの検証特性ならFront CodexからCodexへ委譲する①経路", () => {
  const selected = selectDelegationRouteCandidate(
    createRequest("codex", {
      workClass: "bounded_verification",
      role: "executor",
    }),
    BOTH_ELIGIBLE,
  );
  assert.equal(selected.status, "candidate");
  assert.equal(selected.route, "front_codex__executor_codex");
  assert.equal(selected.executorProvider, "codex");
  assert.equal(
    selected.selectionReasonCodes.includes(
      "same_provider_due_task_characteristic",
    ),
    true,
  );
});

test("Front Claudeから具体実装をCodexへ分散する③経路", () => {
  const selected = selectDelegationRouteCandidate(
    createRequest("claude"),
    BOTH_ELIGIBLE,
  );
  assert.equal(selected.status, "candidate");
  assert.equal(selected.route, "front_claude__executor_codex");
  assert.equal(selected.executorProvider, "codex");
  assert.equal(
    selected.selectionReasonCodes.includes("cross_provider_route_selected"),
    true,
  );
});

test("明示Executor制約を優先し利用不能時に無言で変更しない", () => {
  const explicit = selectDelegationRouteCandidate(
    createRequest("codex", { requestedExecutorProvider: "codex" }),
    BOTH_ELIGIBLE,
  );
  assert.equal(explicit.executorProvider, "codex");
  assert.equal(
    explicit.selectionReasonCodes[0],
    "user_executor_constraint_satisfied",
  );
  const unavailable = selectDelegationRouteCandidate(
    createRequest("codex", { requestedExecutorProvider: "codex" }),
    {
      providerEligibility: [
        {
          provider: "codex",
          status: "ineligible",
          reason: "subscription_quota_unavailable",
        },
        { provider: "claude", status: "eligible", reason: "ready" },
      ],
    },
  );
  assert.equal(unavailable.status, "blocked");
  assert.equal(unavailable.reason, "delegation_route_executor_unavailable");
});

test("反対ProviderのSubscription quota不足時だけ同一Providerへ戻す", () => {
  const selected = selectDelegationRouteCandidate(createRequest("codex"), {
    providerEligibility: [
      { provider: "codex", status: "eligible", reason: "ready" },
      {
        provider: "claude",
        status: "ineligible",
        reason: "subscription_quota_unavailable",
      },
    ],
  });
  assert.equal(selected.status, "candidate");
  assert.equal(selected.executorProvider, "codex");
  assert.equal(
    selected.selectionReasonCodes[0],
    "cross_provider_subscription_quota_unavailable_before_selection",
  );
  assert.match(
    selected.selectionNotice ?? "",
    /cross_provider_subscription_quota_unavailable_before_selection/,
  );
  assert.equal(
    selected.selectionReasonCodes.includes(
      "same_provider_due_cross_provider_ineligibility",
    ),
    true,
  );
});

test("反対Providerのeligibilityが不明なら同一Providerへ推測fallbackしない", () => {
  const selected = selectDelegationRouteCandidate(createRequest("codex"), {
    providerEligibility: [
      { provider: "codex", status: "eligible", reason: "ready" },
      {
        provider: "claude",
        status: "ineligible",
        reason: "observation_unavailable",
      },
    ],
  });
  assert.equal(selected.status, "blocked");
  assert.equal(selected.reason, "delegation_route_executor_unavailable");
});

test("反対Providerに必要CapabilityがなければFront ClaudeからClaudeへ戻す④経路", () => {
  const selected = selectDelegationRouteCandidate(createRequest("claude"), {
    providerEligibility: [
      {
        provider: "codex",
        status: "ineligible",
        reason: "required_capability_unavailable",
      },
      { provider: "claude", status: "eligible", reason: "ready" },
    ],
  });
  assert.equal(selected.status, "candidate");
  assert.equal(selected.route, "front_claude__executor_claude");
  assert.equal(selected.executorProvider, "claude");
  assert.equal(
    selected.selectionReasonCodes[0],
    "cross_provider_required_capability_unavailable_before_selection",
  );
});

test("独立Provider欠落、循環、深度超過と不正eligibilityをfail closedにする", () => {
  const noIndependent = selectDelegationRouteCandidate(
    createRequest("claude", {
      subjectProvider: "claude",
      requiresIndependentProvider: true,
      role: "independent_reviewer",
      workClass: "security_review",
    }),
    {
      providerEligibility: [
        {
          provider: "codex",
          status: "ineligible",
          reason: "subscription_quota_unavailable",
        },
        { provider: "claude", status: "eligible", reason: "ready" },
      ],
    },
  );
  assert.equal(noIndependent.reason, "delegation_route_executor_unavailable");
  const cycle = selectDelegationRouteCandidate(
    createRequest("codex", {
      operationId: "OP-123456",
      parentOperationId: "OP-123456",
      ancestorOperationIds: ["OP-123456"],
      delegationDepth: 1,
    }),
    BOTH_ELIGIBLE,
  );
  assert.equal(cycle.reason, "delegation_route_operation_chain_invalid");
  const depth = selectDelegationRouteCandidate(
    createRequest("codex", {
      operationId: "OP-333333",
      parentOperationId: "OP-222222",
      ancestorOperationIds: ["OP-111111", "OP-222222"],
      delegationDepth: 2,
    }),
    BOTH_ELIGIBLE,
  );
  assert.equal(depth.reason, "delegation_route_operation_chain_invalid");
  assert.equal(
    selectDelegationRouteCandidate(createRequest("codex"), {
      providerEligibility: [
        { provider: "codex", status: "eligible", reason: "ready" },
        { provider: "codex", status: "eligible", reason: "ready" },
      ],
    }).reason,
    "delegation_route_provider_eligibility_invalid",
  );
});

test("独立Reviewerはsubject Providerと独立性要求を必須にする", () => {
  assert.equal(
    selectDelegationRouteCandidate(
      createRequest("codex", {
        role: "independent_reviewer",
        workClass: "security_review",
      }),
      BOTH_ELIGIBLE,
    ).reason,
    "delegation_route_independence_invalid",
  );
  assert.equal(
    selectDelegationRouteCandidate(
      createRequest("codex", {
        delegationNeed: "none",
        delegationReason:
          "front_can_complete_without_specialized_or_independent_child",
        role: "independent_reviewer",
        workClass: "security_review",
        subjectProvider: "claude",
        requiresIndependentProvider: true,
      }),
      { providerEligibility: null },
    ).reason,
    "delegation_route_request_invalid",
  );
  assert.equal(
    selectDelegationRouteCandidate(
      createRequest("codex", {
        role: "independent_reviewer",
        workClass: "security_review",
        subjectProvider: "claude",
        requiresIndependentProvider: false,
      }),
      BOTH_ELIGIBLE,
    ).reason,
    "delegation_route_independence_invalid",
  );
  const sameProviderContext = selectDelegationRouteCandidate(
    createRequest("claude", {
      role: "independent_reviewer",
      workClass: "bounded_verification",
      subjectProvider: "claude",
      requestedExecutorProvider: "claude",
      requiresIndependentProvider: false,
    }),
    BOTH_ELIGIBLE,
  );
  assert.equal(sameProviderContext.status, "candidate");
  assert.equal(sameProviderContext.executorProvider, "claude");
  assert.equal(
    sameProviderContext.selectionReasonCodes[0],
    "independent_execution_context_same_provider_required",
  );
  assert.doesNotMatch(
    sameProviderContext.selectionNotice ?? "",
    /user_executor_constraint_satisfied/,
  );
  assert.equal(
    sameProviderContext.selectionReasonCodes.includes(
      "independent_execution_context_required",
    ),
    true,
  );
  assert.equal(
    selectDelegationRouteCandidate(
      createRequest("claude", {
        role: "independent_reviewer",
        workClass: "bounded_verification",
        subjectProvider: "claude",
        requestedExecutorProvider: "auto",
        requiresIndependentProvider: false,
      }),
      BOTH_ELIGIBLE,
    ).reason,
    "delegation_route_independence_invalid",
  );
});

test("公開契約は4経路とCoordinator Gateを固定する", () => {
  const contract = describeDelegationRouteSelectionContract();
  assert.deepEqual(contract.supportedRoutes, [
    "front_codex__executor_codex",
    "front_codex__executor_claude",
    "front_claude__executor_codex",
    "front_claude__executor_claude",
  ]);
  assert.equal(contract.frontAndExecutorIndependentAxes, true);
  assert.equal(
    contract.defaultRoutePreference,
    "cross_provider_to_distribute_front_subscription_capacity",
  );
  assert.equal(
    contract.taskRoleAffectsExecutorProvider,
    "only_explainable_provider_specific_characteristics",
  );
  assert.equal(
    contract.sameProviderRoute,
    "only_explainable_provider_specific_characteristic_explicit_user_constraint_or_runtime_observed_cross_provider_ineligibility",
  );
  assert.equal(
    contract.frontOnlyDisposition,
    "implemented_as_retained_result_without_selection_grant_or_provider_effect",
  );
  assert.equal(
    contract.unknownCrossProviderEligibilityAllowsSameProvider,
    false,
  );
  assert.equal(contract.maximumDelegationDepth, 2);
  assert.equal(contract.cyclicOperationChainAllowed, false);
  assert.equal(contract.directProviderSpawnAllowed, false);
  assert.equal(contract.callerAvailabilityClaimTrusted, false);
  assert.equal(contract.selectionCapabilityIssued, false);
  assert.equal(contract.providerEffectAllowed, false);
});

test("Execution SlateはExecutor Effect前に別Provider Reviewerまで固定する", () => {
  const slate = selectDelegationExecutionSlateCandidate(
    createRequest("codex"),
    BOTH_ELIGIBLE,
  );
  assert.equal(slate.status, "candidate");
  assert.equal(slate.executorProvider, "claude");
  assert.equal(slate.reviewerProvider, "codex");
  assert.equal(slate.reviewerIndependence, "provider_independent");
  assert.equal(slate.providerEffectAllowed, false);
});

test("低リスクLocal Taskだけ反対Provider不能時に別実行Contextの同一Provider Reviewerへ閉じる", () => {
  const observation = {
    providerEligibility: [
      {
        provider: "codex",
        status: "ineligible",
        reason: "subscription_quota_unavailable",
      },
      { provider: "claude", status: "eligible", reason: "ready" },
    ],
  };
  const allowed = selectDelegationExecutionSlateCandidate(
    createRequest("codex"),
    observation,
  );
  assert.equal(allowed.status, "candidate");
  assert.equal(allowed.executorProvider, "claude");
  assert.equal(allowed.reviewerProvider, "claude");
  assert.equal(allowed.reviewerIndependence, "execution_context_independent");

  for (const overrides of [
    { risk: "material" },
    { decisionImpact: "material" },
    { isLocalCandidateOnly: false },
    { hasUnresolvedDirection: true },
    { requiresCrossContextAlignment: true },
    { workClass: "security_review" },
  ]) {
    const blocked = selectDelegationExecutionSlateCandidate(
      createRequest("codex", overrides),
      observation,
    );
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.reason, "delegation_slate_reviewer_unavailable");
    assert.equal(blocked.providerEffectAllowed, false);
  }
});
