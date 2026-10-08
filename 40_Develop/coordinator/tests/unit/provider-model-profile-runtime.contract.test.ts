/**
 * coordinator:unit:provider-model-profile-runtimeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:provider-model-profile-runtimeが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope provider、model、profile、runtime
 * @boundary PRL-UT-014=N/A: Orchestrator Application Portは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createIsolatedDelegationSelectionGrantRuntimeCandidate } from "../../src/provider/delegation-selection-grant.ts";

import {
  describeProviderModelProfileRuntimeContract,
  resolveRuntimeOwnedProviderModelProfile,
  resolveRuntimeOwnedProviderModelProfileFromCatalog,
} from "../../../ai-adapter/src/index.ts";
import { DEFAULT_AI_PROFILE_CATALOG } from "../../../ai-adapter/src/index.ts";

/**
 * createRequestのTest準備責務を実行する。
 *
 * @responsibility createRequestがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createRequestを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    provider: "codex",
    family: "sol",
    role: "executor",
    modelTier: "preferred",
    speedMode: "normal",
    billingMode: "subscription_oauth",
    ...overrides,
  };
}

/**
 * Codex SolとClaude Opusのpreferred／upper profileを固定解決するを検証する。
 *
 * @responsibility Codex SolとClaude Opusのpreferred／upper profileを固定解決するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codex SolとClaude Opusのpreferred／upper profileを固定解決するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Codex SolとClaude Opusのpreferred／upper profileを固定解決する", () => {
  assert.deepEqual(resolveRuntimeOwnedProviderModelProfile(createRequest()), {
    provider: "codex",
    profileId: "PROFILE-100003",
    exactModelId: "gpt-5.5",
    family: "sol",
    selectionRole: "executor",
    modelTier: "preferred",
    speedMode: "normal",
    billingMode: "subscription_oauth",
    compatibilityReason:
      "gpt_5_6_code_mode_only_host_unavailable_in_fixed_linux_runtime",
  });
  assert.equal(
    resolveRuntimeOwnedProviderModelProfile(
      createRequest({ modelTier: "upper_allowed" }),
    )?.profileId,
    "PROFILE-100004",
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
      selectionRole: "executor",
      modelTier: "preferred",
      speedMode: "normal",
      billingMode: "subscription_oauth",
      compatibilityReason: null,
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

/**
 * 外部Catalogの追加Familyを固定列挙なしで解決する。
 *
 * @responsibility 登録済みAdapterの許可Model追加がCoordinator中核改修を要求しないことを検証する。
 * @trace PRL-UT-014
 * @precondition 既定Catalogを複製し、Codex Adapterが許可済みのgpt-6-astra Profileを追加する。
 * @stimulus 追加Familyを指定してCatalog駆動Resolverを呼び出す。
 * @observation Profile ID、ModelおよびProviderを観測する。
 * @oracle 追加Profileを一意に解決し、既定Resolverの固定Catalogは変更されない。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("外部Catalogの追加Familyを固定列挙なしで解決する", () => {
  const candidate = structuredClone(DEFAULT_AI_PROFILE_CATALOG) as unknown as {
    profiles: Record<string, unknown>[];
  } & Record<string, unknown>;
  candidate.profiles.push({
    profileId: "PROFILE-300001",
    adapterId: "codex-cli",
    family: "astra",
    exactModelId: "gpt-6-astra",
    selectionRoles: ["executor"],
    modelTiers: ["preferred"],
    speedMode: "normal",
    billingMode: "subscription_oauth",
    defaultReasoningEffort: "high",
    compatibilityReason: null,
  });
  assert.deepEqual(
    resolveRuntimeOwnedProviderModelProfileFromCatalog(
      candidate,
      createRequest({ family: "astra" }),
    ),
    {
      provider: "codex",
      profileId: "PROFILE-300001",
      exactModelId: "gpt-6-astra",
      family: "astra",
      selectionRole: "executor",
      modelTier: "preferred",
      speedMode: "normal",
      billingMode: "subscription_oauth",
      compatibilityReason: null,
    },
  );
  assert.equal(
    resolveRuntimeOwnedProviderModelProfileFromCatalog(
      candidate,
      createRequest({ profileId: "PROFILE-300001" }),
    )?.profileId,
    "PROFILE-300001",
  );
  assert.equal(
    resolveRuntimeOwnedProviderModelProfileFromCatalog(
      candidate,
      createRequest({
        profileId: "PROFILE-300001",
        provider: "claude",
      }),
    ),
    null,
  );
  assert.equal(
    resolveRuntimeOwnedProviderModelProfileFromCatalog(
      candidate,
      createRequest({
        profileId: "PROFILE-300001",
        role: "independent_reviewer",
      }),
    ),
    null,
  );
  assert.equal(
    resolveRuntimeOwnedProviderModelProfileFromCatalog(
      candidate,
      createRequest({
        profileId: "PROFILE-300001",
        role: "reviewer",
      }),
    ),
    null,
  );
  assert.equal(
    resolveRuntimeOwnedProviderModelProfileFromCatalog(
      candidate,
      createRequest({ profileId: "PROFILE-999999" }),
    ),
    null,
  );
  assert.equal(
    resolveRuntimeOwnedProviderModelProfile(createRequest({ family: "astra" })),
    null,
  );
});

/**
 * family差、fast、API課金、未知tierと余分keyを解決しないを検証する。
 *
 * @responsibility family差、fast、API課金、未知tierと余分keyを解決しないの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus family差、fast、API課金、未知tierと余分keyを解決しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * accessorとProxyを実行せずProfile解決をfail closedにするを検証する。
 *
 * @responsibility accessorとProxyを実行せずProfile解決をfail closedにするの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus accessorとProxyを実行せずProfile解決をfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * 公開契約は通常速度、Subscription、同family内effort切替だけを許すを検証する。
 *
 * @responsibility 公開契約は通常速度、Subscription、同family内effort切替だけを許すの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約は通常速度、Subscription、同family内effort切替だけを許すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("公開契約は通常速度、Subscription、同family内effort切替だけを許す", () => {
  const contract = describeProviderModelProfileRuntimeContract();
  assert.equal(contract.codex.preferredFamily, "sol");
  assert.equal(contract.codex.toolFreeExactModelId, "gpt-5.6-sol");
  assert.equal(contract.codex.isolatedTaskExactModelId, "gpt-5.5");
  assert.equal(contract.compatibilityProfileIsFixed, true);
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

/**
 * 実CatalogのProfile適合性を選択許可の発行・一回消費へ接続する。
 *
 * @responsibility 差替えResolverでは見えないID・Provider・役割・tierの不一致を拒否することを確認する。
 * @trace PRL-UT-014
 * @precondition 実Catalogと実Resolverを使い、Operation確認・利用可否・時計・乱数だけをメモリ内fixtureとする。
 * @stimulus 二Front Providerから二Executor Providerへ、自動・適合・未知・Provider違い・tier違いを渡し、Codexの役割違いも確認する。
 * @observation 発行結果、Profile・Model、非発行fieldおよび消費後の再利用拒否を観測する。
 * @oracle 自動・適合はCatalogの同じProfileへ結合し、不適合はCapabilityなしで拒否する。全経路でProvider Authorityを発行しない。
 * @cleanup N/A: 各fixtureはProcess-localで、File、Process、ProviderまたはDocker資源を作らない。
 * @boundary N/A: 実Taskを開始せず、公開Transportと本番Operation Authorityは確認対象外である。
 */
test("実Catalogから選択許可までProfile適合性を保持する", () => {
  const catalogBefore = JSON.stringify(DEFAULT_AI_PROFILE_CATALOG);
  for (const frontProvider of ["codex", "claude"] as const) {
    for (const provider of ["codex", "claude"] as const) {
      const profileId =
        provider === "codex" ? "PROFILE-100003" : "PROFILE-200001";
      const profile = DEFAULT_AI_PROFILE_CATALOG.profiles.find(
        (candidate) => candidate.profileId === profileId,
      );
      assert.ok(profile);
      const scenarios = [
        { requestedProfileId: null, accepted: true },
        { requestedProfileId: profileId, accepted: true },
        { requestedProfileId: "PROFILE-999999", accepted: false },
        {
          requestedProfileId:
            provider === "codex" ? "PROFILE-200001" : "PROFILE-100003",
          accepted: false,
        },
        ...(provider === "codex"
          ? [{ requestedProfileId: "PROFILE-100001", accepted: false }]
          : []),
        {
          requestedProfileId:
            provider === "codex" ? "PROFILE-100004" : "PROFILE-200002",
          accepted: false,
        },
      ];
      for (const scenario of scenarios) {
        const managementCapability = Object.freeze({});
        const runtime = createIsolatedDelegationSelectionGrantRuntimeCandidate({
          verifyOperation: (candidate) => {
            assert.equal(candidate, managementCapability);
            return {
              operationId: "OP-123456",
              createdAt: "2026-10-02T00:00:00.000Z",
            };
          },
          observeProviderEligibility: () => [
            { provider: "codex", status: "eligible", reason: "ready" },
            { provider: "claude", status: "eligible", reason: "ready" },
          ],
          resolveModelProfile: resolveRuntimeOwnedProviderModelProfile,
          wallNow: () => 1_000,
          monotonicNow: () => 2_000,
          randomBytes: (size) => Buffer.alloc(size, 1),
        });
        const issued = runtime.issue(managementCapability, {
          frontProvider,
          delegationNeed: "beneficial",
          delegationReason: "explicit_user_delegation",
          requestedExecutorProvider: provider,
          requestedProfileId: scenario.requestedProfileId,
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
        });
        assert.equal(issued.providerAuthorityIssued, false);
        assert.equal(issued.providerEffectAllowed, false);
        if (scenario.accepted) {
          assert.equal(
            issued.status,
            "issued",
            JSON.stringify({
              frontProvider,
              provider,
              scenario,
              reason: issued.reason,
            }),
          );
          assert.equal(issued.profileId, profileId);
          assert.equal(issued.selectedModel, profile.exactModelId);
          assert.equal(issued.executorProvider, provider);
          assert.equal(issued.frontProvider, frontProvider);
          assert.equal(issued.selectionCapabilityIssued, true);
          const consumed = runtime.consume(
            issued.useCapability,
            managementCapability,
          );
          assert.equal(consumed?.profileId, profileId);
          assert.equal(consumed?.model, profile.exactModelId);
          assert.equal(
            runtime.consume(issued.useCapability, managementCapability),
            null,
          );
        } else {
          assert.equal(issued.status, "blocked");
          assert.equal(issued.reason, "delegation_selection_profile_invalid");
          assert.equal(issued.profileId, null);
          assert.equal(issued.controlCapability, null);
          assert.equal(issued.useCapability, null);
          assert.equal(issued.selectionCapabilityIssued, false);
          assert.equal(
            runtime.consume(issued.useCapability, managementCapability),
            null,
          );
        }
      }
    }
  }
  assert.equal(JSON.stringify(DEFAULT_AI_PROFILE_CATALOG), catalogBefore);
});
