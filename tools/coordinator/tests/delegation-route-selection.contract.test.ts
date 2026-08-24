import assert from "node:assert/strict";
import test from "node:test";

import {
  describeDelegationRouteSelectionContract,
  selectDelegationRouteCandidate,
} from "../src/security/delegation-route-selection.ts";

function createRequest(
  frontProvider: "codex" | "claude",
  overrides: Record<string, unknown> = {},
) {
  return {
    frontProvider,
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

const bothAvailable = Object.freeze({
  availableProviders: Object.freeze(["codex", "claude"]),
});

test("Front Codexから具体実装をClaude Executorへ選ぶ②経路", () => {
  const selected = selectDelegationRouteCandidate(
    createRequest("codex"),
    bothAvailable,
  );
  assert.equal(selected.status, "candidate");
  assert.equal(selected.route, "front_codex__executor_claude");
  assert.equal(selected.executorProvider, "claude");
  assert.equal(selected.modelSelection?.effort, "low");
  assert.match(selected.selectionNotice ?? "", /front=codex executor=claude/);
  assert.equal(selected.providerEffectAllowed, false);
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
    bothAvailable,
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

test("Front Codexから検証をCodexへ選ぶ①経路", () => {
  const selected = selectDelegationRouteCandidate(
    createRequest("codex", {
      workClass: "bounded_verification",
      role: "executor",
    }),
    bothAvailable,
  );
  assert.equal(selected.status, "candidate");
  assert.equal(selected.route, "front_codex__executor_codex");
  assert.equal(selected.executorProvider, "codex");
});

test("Front Claudeから具体実装をClaudeへ選ぶ④経路", () => {
  const selected = selectDelegationRouteCandidate(
    createRequest("claude"),
    bothAvailable,
  );
  assert.equal(selected.status, "candidate");
  assert.equal(selected.route, "front_claude__executor_claude");
  assert.equal(selected.executorProvider, "claude");
  assert.equal(
    selected.selectionReasonCodes.includes("same_provider_route_allowed"),
    true,
  );
});

test("明示Executor制約を優先し利用不能時に無言で変更しない", () => {
  const explicit = selectDelegationRouteCandidate(
    createRequest("codex", { requestedExecutorProvider: "codex" }),
    bothAvailable,
  );
  assert.equal(explicit.executorProvider, "codex");
  assert.equal(
    explicit.selectionReasonCodes[0],
    "user_executor_constraint_satisfied",
  );
  const unavailable = selectDelegationRouteCandidate(
    createRequest("codex", { requestedExecutorProvider: "codex" }),
    { availableProviders: ["claude"] },
  );
  assert.equal(unavailable.status, "blocked");
  assert.equal(unavailable.reason, "delegation_route_executor_unavailable");
});

test("選定前に優先Providerが利用不能なら理由を表示して代替候補を選ぶ", () => {
  const selected = selectDelegationRouteCandidate(createRequest("codex"), {
    availableProviders: ["codex"],
  });
  assert.equal(selected.status, "candidate");
  assert.equal(selected.executorProvider, "codex");
  assert.equal(
    selected.selectionReasonCodes[0],
    "preferred_provider_unavailable_before_selection",
  );
  assert.match(
    selected.selectionNotice ?? "",
    /preferred_provider_unavailable_before_selection/,
  );
});

test("独立Provider欠落、循環、深度超過と不正availabilityをfail closedにする", () => {
  const noIndependent = selectDelegationRouteCandidate(
    createRequest("claude", {
      subjectProvider: "claude",
      requiresIndependentProvider: true,
      role: "independent_reviewer",
      workClass: "security_review",
    }),
    { availableProviders: ["claude"] },
  );
  assert.equal(noIndependent.reason, "delegation_route_executor_unavailable");
  const cycle = selectDelegationRouteCandidate(
    createRequest("codex", {
      operationId: "OP-123456",
      parentOperationId: "OP-123456",
      ancestorOperationIds: ["OP-123456"],
      delegationDepth: 1,
    }),
    bothAvailable,
  );
  assert.equal(cycle.reason, "delegation_route_operation_chain_invalid");
  const depth = selectDelegationRouteCandidate(
    createRequest("codex", {
      operationId: "OP-333333",
      parentOperationId: "OP-222222",
      ancestorOperationIds: ["OP-111111", "OP-222222"],
      delegationDepth: 2,
    }),
    bothAvailable,
  );
  assert.equal(depth.reason, "delegation_route_operation_chain_invalid");
  assert.equal(
    selectDelegationRouteCandidate(createRequest("codex"), {
      availableProviders: ["codex", "codex"],
    }).reason,
    "delegation_route_availability_invalid",
  );
});

test("独立Reviewerはsubject Providerと独立性要求を必須にする", () => {
  assert.equal(
    selectDelegationRouteCandidate(
      createRequest("codex", {
        role: "independent_reviewer",
        workClass: "security_review",
      }),
      bothAvailable,
    ).reason,
    "delegation_route_independence_invalid",
  );
  assert.equal(
    selectDelegationRouteCandidate(
      createRequest("codex", {
        role: "independent_reviewer",
        workClass: "security_review",
        subjectProvider: "claude",
        requiresIndependentProvider: false,
      }),
      bothAvailable,
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
  assert.equal(contract.maximumDelegationDepth, 2);
  assert.equal(contract.cyclicOperationChainAllowed, false);
  assert.equal(contract.directProviderSpawnAllowed, false);
  assert.equal(contract.callerAvailabilityClaimTrusted, false);
  assert.equal(contract.selectionCapabilityIssued, false);
  assert.equal(contract.providerEffectAllowed, false);
});
