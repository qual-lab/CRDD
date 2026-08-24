import assert from "node:assert/strict";
import test from "node:test";

import { selectDelegationRouteCandidate } from "../src/security/delegation-route-selection.ts";
import {
  createIsolatedProviderEligibilityRuntimeCandidate,
  describeProviderEligibilityRuntimeContract,
  observeRuntimeOwnedProviderEligibility,
} from "../src/security/provider-eligibility-runtime.ts";

type Axis =
  | "requiredCapability"
  | "subscriptionAuth"
  | "subscriptionQuota"
  | "officialDistribution"
  | "policy";

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

test("全軸をRuntimeが確認した場合だけCodexとClaudeをeligibleにする", () => {
  const runtime = createIsolatedProviderEligibilityRuntimeCandidate({
    observeProvider: () => createObservation(),
  });
  assert.deepEqual(runtime.observe(), [
    { provider: "codex", status: "eligible", reason: "ready" },
    { provider: "claude", status: "eligible", reason: "ready" },
  ]);
});

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

test("unknownを同一Providerへの推測fallback根拠にしない", () => {
  const runtime = createIsolatedProviderEligibilityRuntimeCandidate({
    observeProvider: (provider) =>
      provider === "claude"
        ? createObservation({ subscriptionQuota: "unknown" })
        : createObservation(),
  });
  const providerEligibility = runtime.observe();
  assert.equal(providerEligibility[1]?.reason, "observation_unavailable");
  const selected = selectDelegationRouteCandidate(createRequest(), {
    providerEligibility,
  });
  assert.equal(selected.status, "blocked");
  assert.equal(selected.reason, "delegation_route_executor_unavailable");
});

test("別probeで課金せず認証とquotaを同じbounded requestで確認する", () => {
  const runtime = createIsolatedProviderEligibilityRuntimeCandidate({
    observeProvider: () =>
      createObservation({
        subscriptionAuth: "bounded_request_check",
        subscriptionQuota: "bounded_request_check",
      }),
  });
  assert.deepEqual(runtime.observe()[0], {
    provider: "codex",
    status: "eligible",
    reason: "bounded_request_check",
  });
  const selected = selectDelegationRouteCandidate(createRequest(), {
    providerEligibility: runtime.observe(),
  });
  assert.equal(selected.status, "candidate");
  assert.equal(selected.executorProvider, "claude");
});

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

test("productionはClaudeだけをbounded request候補として公開する", () => {
  assert.deepEqual(observeRuntimeOwnedProviderEligibility(), [
    {
      provider: "codex",
      status: "ineligible",
      reason: "required_capability_unavailable",
    },
    {
      provider: "claude",
      status: "eligible",
      reason: "bounded_request_check",
    },
  ]);
});

test("公開契約はcaller claimと有料API fallbackを認めない", () => {
  const contract = describeProviderEligibilityRuntimeContract();
  assert.deepEqual(contract.providers, ["codex", "claude"]);
  assert.equal(contract.authority, "runtime_owned_observation_only");
  assert.equal(contract.callerClaimsAccepted, false);
  assert.equal(contract.unknownHandling, "ineligible_observation_unavailable");
  assert.equal(
    contract.nonPreobservableSubscriptionState,
    "bounded_authorized_request_checks_auth_and_quota_without_separate_probe",
  );
  assert.equal(contract.paidApiFallback, "prohibited_unsupported_by_default");
});
