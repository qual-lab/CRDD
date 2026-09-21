/**
 * coordinator:unit:provider-model-selection-runtimeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:provider-model-selection-runtimeが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope provider、model、selection、runtime
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  describeProviderModelSelectionRuntimeContract,
  selectProviderModelCandidate,
} from "../../src/security/provider-model-selection-runtime.ts";

/**
 * createBoundedImplementationのTest準備責務を実行する。
 *
 * @responsibility createBoundedImplementationがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createBoundedImplementationを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * 具体化済みの局所実装は通常速度の低推論候補になるを検証する。
 *
 * @responsibility 具体化済みの局所実装は通常速度の低推論候補になるの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 具体化済みの局所実装は通常速度の低推論候補になるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * 高難度レビュー自己申告だけでは高推論を発行せず中推論へ抑制するを検証する。
 *
 * @responsibility 高難度レビュー自己申告だけでは高推論を発行せず中推論へ抑制するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 高難度レビュー自己申告だけでは高推論を発行せず中推論へ抑制するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("高難度レビュー自己申告だけでは高推論を発行せず中推論へ抑制する", () => {
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
  assert.equal(selected.effort, "medium");
  assert.equal(selected.modelTier, "preferred");
  assert.deepEqual(selected.rationaleCodes, [
    "independent_review_requires_critique",
    "architecture_or_security_review_required",
    "cross_context_alignment_required",
    "high_risk_change",
    "high_difficulty",
    "critical_decision_impact",
    "high_cost_requires_explicit_user_policy",
  ]);
  assert.match(selected.selectionNotice ?? "", /role=independent_reviewer/);
});

/**
 * 通常のCoordinator方針整合は役割だけで高コスト化しないを検証する。
 *
 * @responsibility 通常のCoordinator方針整合は役割だけで高コスト化しないの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 通常のCoordinator方針整合は役割だけで高コスト化しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * 限定診断は中推論になりProvider fallbackを発行しないを検証する。
 *
 * @responsibility 限定診断は中推論になりProvider fallbackを発行しないの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 限定診断は中推論になりProvider fallbackを発行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * 未解決方針を含む実装を低推論へ分類しないを検証する。
 *
 * @responsibility 未解決方針を含む実装を低推論へ分類しないの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 未解決方針を含む実装を低推論へ分類しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * 不足・余分・不正な分類情報は固定理由でfail closedになるを検証する。
 *
 * @responsibility 不足・余分・不正な分類情報は固定理由でfail closedになるの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 不足・余分・不正な分類情報は固定理由でfail closedになるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * 公開契約は通常速度・説明可能選定・再選定境界を固定するを検証する。
 *
 * @responsibility 公開契約は通常速度・説明可能選定・再選定境界を固定するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約は通常速度・説明可能選定・再選定境界を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("公開契約は通常速度・説明可能選定・再選定境界を固定する", () => {
  const contract = describeProviderModelSelectionRuntimeContract();
  assert.equal(contract.contractRevision, 2);
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
  assert.equal(contract.highCostSelectionRequiresExplicitUserPolicy, true);
  assert.equal(contract.productionHighCostSelectionActivated, false);
  assert.equal(contract.selectionNoticeContainsPrivateReasoning, false);
  assert.equal(
    contract.selectedModelAndEffortBoundToAuthority,
    "selection_grant_and_process_plan_connected",
  );
  assert.equal(contract.providerEffectAllowed, false);
});
