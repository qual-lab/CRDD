/**
 * coordinator:unit:provider-eligibility-runtimeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:provider-eligibility-runtimeが所有する検証責務を実行する。
 * @trace AIT-UT-005
 * @level UT
 * @scope provider、eligibility、runtime
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { selectDelegationRouteCandidate } from "../../src/security/delegation-route-selection.ts";
import {
  createIsolatedProviderEligibilityRuntimeCandidate,
  describeProviderEligibilityRuntimeContract,
  observeRuntimeOwnedProviderEligibility,
} from "../../src/security/provider-eligibility-runtime.ts";

type Axis =
  | "requiredCapability"
  | "subscriptionAuth"
  | "subscriptionQuota"
  | "officialDistribution"
  | "policy";

/**
 * createObservationのTest準備責務を実行する。
 *
 * @responsibility createObservationがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-UT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createObservationを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
function createObservation(overrides: Record<string, unknown> = {}) {
  return {
    requiredCapability: "confirmed",
    subscriptionAuth: "confirmed",
    subscriptionQuota: "confirmed",
    officialDistribution: "confirmed",
    policy: "confirmed",
    ...overrides,
  };
}

/**
 * createRequestのTest準備責務を実行する。
 *
 * @responsibility createRequestがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-UT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createRequestを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
function createRequest() {
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
  };
}

/**
 * 全軸をRuntimeが確認した場合だけCodexとClaudeをeligibleにするを検証する。
 *
 * @responsibility 全軸をRuntimeが確認した場合だけCodexとClaudeをeligibleにするの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 全軸をRuntimeが確認した場合だけCodexとClaudeをeligibleにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("全軸をRuntimeが確認した場合だけCodexとClaudeをeligibleにする", () => {
  const runtime = createIsolatedProviderEligibilityRuntimeCandidate({
    observeProvider: () => createObservation(),
  });
  assert.deepEqual(runtime.observe(), [
    { provider: "codex", status: "eligible", reason: "ready" },
    { provider: "claude", status: "eligible", reason: "ready" },
  ]);
});

/**
 * 明示的な不成立軸を経路選定用の正確な理由へ写像するを検証する。
 *
 * @responsibility 明示的な不成立軸を経路選定用の正確な理由へ写像するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 明示的な不成立軸を経路選定用の正確な理由へ写像するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("明示的な不成立軸を経路選定用の正確な理由へ写像する", () => {
  const cases: readonly [Axis, string][] = [
    ["requiredCapability", "required_capability_unavailable"],
    ["subscriptionAuth", "subscription_auth_unavailable"],
    ["subscriptionQuota", "subscription_quota_unavailable"],
    ["officialDistribution", "provider_distribution_unavailable"],
    ["policy", "policy_blocked"],
  ];
  for (const [axis, reason] of cases) {
    const runtime = createIsolatedProviderEligibilityRuntimeCandidate({
      observeProvider: () => createObservation({ [axis]: "unavailable" }),
    });
    assert.equal(runtime.observe()[0]?.reason, reason);
  }
});

/**
 * unknownを同一Providerへの推測fallback根拠にしないを検証する。
 *
 * @responsibility unknownを同一Providerへの推測fallback根拠にしないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus unknownを同一Providerへの推測fallback根拠にしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("unknownを同一Providerへの推測fallback根拠にしない", () => {
  const runtime = createIsolatedProviderEligibilityRuntimeCandidate({
    observeProvider: (provider) =>
      provider === "claude"
        ? createObservation({ subscriptionQuota: "unknown" })
        : createObservation(),
  });
  const providerEligibilityResults = runtime.observe();
  assert.equal(
    providerEligibilityResults[1]?.reason,
    "observation_unavailable",
  );
  const selected = selectDelegationRouteCandidate(createRequest(), {
    providerEligibility: providerEligibilityResults,
  });
  assert.equal(selected.status, "blocked");
  assert.equal(selected.reason, "delegation_route_executor_unavailable");
});

/**
 * 認証preflightとquotaのbounded request確認を区別するを検証する。
 *
 * @responsibility 認証preflightとquotaのbounded request確認を区別するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 認証preflightとquotaのbounded request確認を区別するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("認証preflightとquotaのbounded request確認を区別する", () => {
  const runtime = createIsolatedProviderEligibilityRuntimeCandidate({
    observeProvider: () =>
      createObservation({
        subscriptionAuth: "runtime_preflight_required",
        subscriptionQuota: "bounded_request_check",
      }),
  });
  assert.deepEqual(runtime.observe()[0], {
    provider: "codex",
    status: "eligible",
    reason: "runtime_preflight_required",
  });
  const selected = selectDelegationRouteCandidate(createRequest(), {
    providerEligibility: runtime.observe(),
  });
  assert.equal(selected.status, "candidate");
  assert.equal(selected.executorProvider, "claude");
});

/**
 * accessor、Proxy、余分なkeyとobserver例外を実行せずfail closedにするを検証する。
 *
 * @responsibility accessor、Proxy、余分なkeyとobserver例外を実行せずfail closedにするの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus accessor、Proxy、余分なkeyとobserver例外を実行せずfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("accessor、Proxy、余分なkeyとobserver例外を実行せずfail closedにする", () => {
  let getterExecuted = false;
  const accessor = createObservation();
  Object.defineProperty(accessor, "subscriptionAuth", {
    enumerable: true,
    get: () => {
      getterExecuted = true;
      return "confirmed";
    },
  });
  const values: unknown[] = [accessor, new Proxy(createObservation(), {})];
  let index = 0;
  const runtime = createIsolatedProviderEligibilityRuntimeCandidate({
    observeProvider: () => values[index++],
  });
  assert.deepEqual(runtime.observe(), [
    {
      provider: "codex",
      status: "ineligible",
      reason: "observation_unavailable",
    },
    {
      provider: "claude",
      status: "ineligible",
      reason: "observation_unavailable",
    },
  ]);
  assert.equal(getterExecuted, false);

  const throwing = createIsolatedProviderEligibilityRuntimeCandidate({
    observeProvider: () => {
      throw new Error("observer unavailable");
    },
  });
  assert.equal(throwing.observe()[0]?.reason, "observation_unavailable");

  const extraKey = createIsolatedProviderEligibilityRuntimeCandidate({
    observeProvider: () => createObservation({ extra: "confirmed" }),
  });
  assert.equal(extraKey.observe()[0]?.reason, "observation_unavailable");
});

/**
 * productionはCodexとClaudeを認証preflight必須候補として公開するを検証する。
 *
 * @responsibility productionはCodexとClaudeを認証preflight必須候補として公開するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus productionはCodexとClaudeを認証preflight必須候補として公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("productionはCodexとClaudeを認証preflight必須候補として公開する", () => {
  assert.deepEqual(observeRuntimeOwnedProviderEligibility(), [
    {
      provider: "codex",
      status: "eligible",
      reason: "runtime_preflight_required",
    },
    {
      provider: "claude",
      status: "eligible",
      reason: "runtime_preflight_required",
    },
  ]);
});

/**
 * 公開契約はcaller claimと有料API fallbackを認めないを検証する。
 *
 * @responsibility 公開契約はcaller claimと有料API fallbackを認めないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約はcaller claimと有料API fallbackを認めないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("公開契約はcaller claimと有料API fallbackを認めない", () => {
  const contract = describeProviderEligibilityRuntimeContract();
  assert.deepEqual(contract.providers, ["codex", "claude"]);
  assert.equal(contract.contractRevision, 4);
  assert.equal(contract.authority, "runtime_owned_preselection_candidate_only");
  assert.equal(contract.callerClaimsAccepted, false);
  assert.equal(contract.unknownHandling, "ineligible_observation_unavailable");
  assert.equal(
    contract.nonPreobservableSubscriptionState,
    "network_none_auth_preflight_then_bounded_request_checks_quota",
  );
  assert.equal(contract.paidApiFallback, "prohibited_unsupported_by_default");
  assert.equal(contract.verifiedEligibilityClaimAllowed, false);
  assert.equal(contract.automaticFallbackAfterProviderRequestAllowed, false);
});
