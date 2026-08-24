import assert from "node:assert/strict";
import test from "node:test";

import {
  describeProviderModelProfileRuntimeContract,
  resolveRuntimeOwnedProviderModelProfile,
} from "../src/security/provider-model-profile-runtime.ts";

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    provider: "codex",
    family: "sol",
    modelTier: "preferred",
    speedMode: "normal",
    billingMode: "subscription_oauth",
    ...overrides,
  };
}

test("Codex SolとClaude Opusのpreferred／upper profileを固定解決する", () => {
  assert.deepEqual(resolveRuntimeOwnedProviderModelProfile(createRequest()), {
    provider: "codex",
    profileId: "PROFILE-100001",
    exactModelId: "gpt-5.6-sol",
    family: "sol",
    modelTier: "preferred",
    speedMode: "normal",
    billingMode: "subscription_oauth",
  });
  assert.equal(
    resolveRuntimeOwnedProviderModelProfile(
      createRequest({ modelTier: "upper_allowed" }),
    )?.profileId,
    "PROFILE-100002",
  );
  assert.deepEqual(
    resolveRuntimeOwnedProviderModelProfile(
      createRequest({ provider: "claude", family: "opus" }),
    ),
    {
      provider: "claude",
      profileId: "PROFILE-200001",
      exactModelId: "opus",
      family: "opus",
      modelTier: "preferred",
      speedMode: "normal",
      billingMode: "subscription_oauth",
    },
  );
  assert.equal(
    resolveRuntimeOwnedProviderModelProfile(
      createRequest({
        provider: "claude",
        family: "opus",
        modelTier: "upper_allowed",
      }),
    )?.profileId,
    "PROFILE-200002",
  );
});

test("family差、fast、API課金、未知tierと余分keyを解決しない", () => {
  for (const request of [
    createRequest({ family: "opus" }),
    createRequest({ speedMode: "fast" }),
    createRequest({ billingMode: "api_key" }),
    createRequest({ modelTier: "maximum" }),
    createRequest({ fallbackModel: "gpt-5.6-terra" }),
  ]) {
    assert.equal(resolveRuntimeOwnedProviderModelProfile(request), null);
  }
});

test("accessorとProxyを実行せずProfile解決をfail closedにする", () => {
  let getterExecuted = false;
  const accessor = createRequest();
  Object.defineProperty(accessor, "family", {
    enumerable: true,
    get: () => {
      getterExecuted = true;
      return "sol";
    },
  });
  assert.equal(resolveRuntimeOwnedProviderModelProfile(accessor), null);
  assert.equal(getterExecuted, false);
  assert.equal(
    resolveRuntimeOwnedProviderModelProfile(new Proxy(createRequest(), {})),
    null,
  );
});

test("公開契約は通常速度、Subscription、同family内effort切替だけを許す", () => {
  const contract = describeProviderModelProfileRuntimeContract();
  assert.equal(contract.codex.exactModelId, "gpt-5.6-sol");
  assert.equal(contract.claude.exactModelId, "opus");
  assert.deepEqual(contract.codex.verifiedEfforts, ["low", "medium", "high"]);
  assert.equal(contract.upperTierChangesFamily, false);
  assert.equal(contract.upperTierChangesExactModel, false);
  assert.equal(contract.speedMode, "normal_only");
  assert.equal(contract.billingMode, "subscription_oauth_only");
  assert.equal(contract.automaticFallback, false);
  assert.equal(contract.fableActivated, false);
  assert.equal(contract.xhighOrMaxActivated, false);
  assert.equal(contract.providerEffectAllowed, false);
});
