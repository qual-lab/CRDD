import assert from "node:assert/strict";
import test from "node:test";

import {
  describeProviderModelSelectionRuntimeContract,
  selectProviderModelCandidate,
} from "../src/security/provider-model-selection-runtime.ts";

function createBoundedImplementation(provider: "codex" | "claude") {
  return {
    provider,
    role: "executor",
    workClass: "bounded_implementation",
    planState: "complete",
    risk: "low",
    difficulty: "low",
    decisionImpact: "limited",
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  };
}

test("具体化済みの局所実装は通常速度の低推論候補になる", () => {
  const selected = selectProviderModelCandidate(
    createBoundedImplementation("claude"),
  );
  assert.equal(selected.status, "candidate");
  assert.equal(selected.familyPreference, "opus");
  assert.equal(selected.effort, "low");
  assert.equal(selected.modelTier, "preferred");
  assert.equal(selected.speedMode, "normal");
  assert.deepEqual(selected.rationaleCodes, ["complete_bounded_local_plan"]);
  assert.match(selected.selectionNotice ?? "", /provider=claude/);
  assert.match(selected.selectionNotice ?? "", /effort=low/);
  assert.equal(selected.exactModelId, null);
  assert.equal(selected.selectionCapabilityIssued, false);
  assert.equal(selected.providerEffectAllowed, false);
});

test("独立Securityレビューは上位familyの高推論候補になる", () => {
  const selected = selectProviderModelCandidate({
    ...createBoundedImplementation("codex"),
    role: "independent_reviewer",
    workClass: "security_review",
    risk: "high",
    difficulty: "high",
    decisionImpact: "critical",
    isLocalCandidateOnly: false,
    requiresCrossContextAlignment: true,
  });
  assert.equal(selected.status, "candidate");
  assert.equal(selected.familyPreference, "sol");
  assert.equal(selected.effort, "high");
  assert.equal(selected.modelTier, "upper_allowed");
  assert.deepEqual(selected.rationaleCodes, [
    "independent_review_requires_critique",
    "architecture_or_security_review_required",
    "cross_context_alignment_required",
    "high_risk_change",
    "high_difficulty",
    "critical_decision_impact",
  ]);
  assert.match(selected.selectionNotice ?? "", /role=independent_reviewer/);
});

test("通常のCoordinator方針整合は役割だけで高コスト化しない", () => {
  const selected = selectProviderModelCandidate({
    ...createBoundedImplementation("codex"),
    role: "coordinator",
    workClass: "design_alignment",
  });
  assert.equal(selected.status, "candidate");
  assert.equal(selected.effort, "medium");
  assert.equal(selected.highCostSelection, false);
  assert.deepEqual(selected.rationaleCodes, [
    "coordinator_direction_ownership",
    "design_or_policy_alignment_required",
    "bounded_work_requires_limited_reasoning",
  ]);
});

test("限定診断は中推論になりProvider fallbackを発行しない", () => {
  const selected = selectProviderModelCandidate({
    ...createBoundedImplementation("claude"),
    workClass: "diagnosis",
    planState: "partial",
    risk: "material",
  });
  assert.equal(selected.status, "candidate");
  assert.equal(selected.effort, "medium");
  assert.deepEqual(selected.rationaleCodes, [
    "bounded_work_requires_limited_reasoning",
  ]);
  assert.equal(selected.automaticProviderFallbackAllowed, false);
});

test("未解決方針を含む実装を低推論へ分類しない", () => {
  const selected = selectProviderModelCandidate({
    ...createBoundedImplementation("claude"),
    hasUnresolvedDirection: true,
  });
  assert.equal(selected.status, "candidate");
  assert.equal(selected.effort, "medium");
  assert.deepEqual(selected.rationaleCodes, [
    "unresolved_direction_requires_reasoning",
    "bounded_work_requires_limited_reasoning",
  ]);
});

test("不足・余分・不正な分類情報は固定理由でfail closedになる", () => {
  const missing = { ...createBoundedImplementation("claude") } as Record<
    string,
    unknown
  >;
  delete missing.risk;
  assert.equal(
    selectProviderModelCandidate(missing).reason,
    "provider_model_selection_shape_invalid",
  );
  assert.equal(
    selectProviderModelCandidate({
      ...createBoundedImplementation("claude"),
      unexpected: true,
    }).reason,
    "provider_model_selection_shape_invalid",
  );
  assert.equal(
    selectProviderModelCandidate({
      ...createBoundedImplementation("claude"),
      risk: "unknown",
    }).reason,
    "provider_model_selection_risk_invalid",
  );
  assert.equal(
    selectProviderModelCandidate({
      ...createBoundedImplementation("claude"),
      isLocalCandidateOnly: "yes",
    }).reason,
    "provider_model_selection_fact_invalid",
  );
});

test("公開契約は通常速度・説明可能選定・再選定境界を固定する", () => {
  const contract = describeProviderModelSelectionRuntimeContract();
  assert.equal(contract.selectionOwner, "coordinator_runtime");
  assert.equal(contract.selectionUnit, "operation_role");
  assert.deepEqual(contract.defaultFamilies, {
    codex: "sol",
    claude: "opus",
  });
  assert.equal(contract.speedMode, "normal_only");
  assert.equal(contract.providerFallback, "forbidden");
  assert.equal(contract.midExecutionSwitching, "forbidden");
  assert.equal(contract.rationaleRequired, true);
  assert.equal(contract.roleAloneAllowsHighCostSelection, false);
  assert.equal(contract.highCostSelectionRequiresDecisiveReason, true);
  assert.equal(contract.selectionNoticeContainsPrivateReasoning, false);
  assert.equal(
    contract.selectedModelAndEffortBoundToAuthority,
    "not_implemented",
  );
  assert.equal(contract.providerEffectAllowed, false);
});
