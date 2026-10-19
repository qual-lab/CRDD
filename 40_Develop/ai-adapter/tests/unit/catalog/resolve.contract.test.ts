/**
 * Catalog登録内容と候補解決を検証する。
 *
 * @packageDocumentation
 * @responsibility 既存Caseを実責務のSourceへ接続し、受理・拒否条件を維持する。
 * @trace RCM-UT-001
 * @level UT
 * @scope catalog/resolveの純粋契約。
 * @boundary N/A: Process内の値だけを扱い外部資源を作らない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as adapterPublicApi from "../../../src/index.ts";
import defaultCatalogData from "../../../src/catalog/default-catalog.json" with {
  type: "json",
};

import {
  defaultAiProfileCatalog,
  resolveAiProfile,
  resolveAiProfileById,
} from "../../../src/catalog/resolve.ts";
import { validateAiProfileCatalog } from "../../../src/catalog/validation.ts";

/**
 * 同梱JSONを検証済みの不変Catalogとして公開する。
 *
 * @responsibility 設定本文の全値保持、生JSONからの分離と、Rootの明示公開集合を検証する。
 * @trace RCM-UT-001
 * @precondition 同梱JSONと公開Catalogを読み込んでいる。
 * @stimulus 全値、参照Identityおよび各階層のfreezeを照合する。
 * @observation Catalog、Adapter、Profileとその配列を観測する。
 * @oracle 全値は一致し、生JSONを公開せず、全階層が不変である。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary N/A: 同一Process内の同梱設定検証である。
 */
test("同梱JSONの全値を保持して深い不変Catalogを公開する", () => {
  assert.deepEqual(Object.keys(adapterPublicApi).sort(), [
    "CLAUDE_EXECUTION_PLAN_CONTRACT",
    "CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION",
    "CLAUDE_RESULT_ACCEPTANCE_MAXIMUM_TURNS",
    "CLAUDE_STRUCTURED_RESULT_CONTRACT",
    "CLAUDE_STRUCTURED_RESULT_CONTRACT_REVISION",
    "CODEX_EXECUTION_PLAN_CONTRACT",
    "CODEX_EXECUTION_PLAN_CONTRACT_REVISION",
    "CODEX_STRUCTURED_RESULT_CONTRACT",
    "CODEX_STRUCTURED_RESULT_CONTRACT_REVISION",
    "PROVIDER_AUTHENTICATION_POLICIES",
    "PROVIDER_BILLING_POLICY_CONTRACT",
    "PROVIDER_BILLING_POLICY_CONTRACT_REVISION",
    "PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT",
    "PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT_REVISION",
    "WORKBENCH_AI_ADVICE_PROVIDER_COMMAND_CONTRACT",
    "WORKBENCH_AI_ADVICE_PROVIDER_COMMAND_CONTRACT_REVISION",
    "WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_CONTRACT",
    "WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_CONTRACT_REVISION",
    "WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_REASONS",
    "convertProviderError",
    "createAiProfileCatalogAdministration",
    "createHostAiProfileCatalogStore",
    "createRepositoryAiProfileCatalogStore",
    "defaultAiProfileCatalog",
    "describeClaudeStructuredResultContract",
    "describeCodexStructuredResultContract",
    "describeProviderAuthentication",
    "describeProviderBillingPolicy",
    "describeProviderExecution",
    "describeProviderModelProfileRuntimeContract",
    "evaluateAiProfileAvailability",
    "evaluateProviderAuthentication",
    "evaluateProviderAvailability",
    "evaluateProviderTaskScope",
    "normalizeClaudeStructuredResult",
    "normalizeCodexStructuredResult",
    "parseAiProfileCatalogMutation",
    "parseProviderResult",
    "parseUnambiguousJsonDocument",
    "planProviderExecution",
    "prepareProviderEnvironment",
    "projectCodexExecutionBoundary",
    "providerProfileMatchesExecutionIdentity",
    "providerProfileSupportsExecution",
    "resolveAiProfile",
    "resolveAiProfileById",
    "resolveRuntimeOwnedProviderModelProfile",
    "resolveRuntimeOwnedProviderModelProfileFromCatalog",
    "selectProviderFamilyPreference",
    "validateAiProfileCatalog",
    "validateAiProfileDefinition",
    "validateAiProfileMutationResult",
    "validateProviderModelId",
  ]);
  assert.deepEqual(defaultAiProfileCatalog, defaultCatalogData);
  assert.notEqual(defaultAiProfileCatalog, defaultCatalogData);
  assert.notEqual(
    defaultAiProfileCatalog.adapters,
    defaultCatalogData.adapters,
  );
  assert.notEqual(
    defaultAiProfileCatalog.profiles,
    defaultCatalogData.profiles,
  );
  assert.ok(Object.isFrozen(defaultAiProfileCatalog));
  for (const collection of [
    defaultAiProfileCatalog.adapters,
    defaultAiProfileCatalog.profiles,
  ]) {
    assert.ok(Object.isFrozen(collection));
    for (const item of collection) {
      assert.ok(Object.isFrozen(item));
      for (const value of Object.values(item)) {
        if (Array.isArray(value)) assert.ok(Object.isFrozen(value));
      }
    }
  }
  assert.throws(() => {
    (
      defaultAiProfileCatalog.profiles[0] as unknown as Record<string, unknown>
    ).exactModelId = "unregistered-model";
  }, TypeError);
  assert.throws(() => {
    const adapter = defaultAiProfileCatalog.adapters[0];
    assert.ok(adapter);
    (adapter.allowedModelIds as string[]).push("unregistered-model");
  }, TypeError);
  assert.deepEqual(defaultAiProfileCatalog, defaultCatalogData);
});

/**
 * 既定Profileを決定論的に解決する。
 *
 * @responsibility Coordinator互換ProfileとAdapter関係の正常経路を検証する。
 * @trace RCM-UT-001
 * @precondition 既定Catalogを使用する。
 * @stimulus Codex executorとClaude reviewerの要求を解決する。
 * @observation 解決したProfile IDを観測する。
 * @oracle 同じ要求は既存の安定Profile IDへ一意に解決される。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary RCM-UT-001=Direct Boundary: AI Adapter Test Source→対象契約
 */
test("既定Catalogは既存CodexとClaude Profileを同じ結果へ解決する", () => {
  assert.ok(validateAiProfileCatalog(defaultAiProfileCatalog).value);
  assert.equal(
    resolveAiProfile(defaultAiProfileCatalog, {
      provider: "codex",
      family: "sol",
      role: "executor",
      modelTier: "preferred",
      speedMode: "normal",
      billingMode: "subscription_oauth",
    }).value?.profileId,
    "PROFILE-100003",
  );
  assert.equal(
    resolveAiProfile(defaultAiProfileCatalog, {
      provider: "claude",
      family: "opus",
      role: "independent_reviewer",
      modelTier: "upper_allowed",
      speedMode: "normal",
      billingMode: "subscription_oauth",
    }).value?.profileId,
    "PROFILE-200002",
  );
});

/**
 * 選択済みProfile IDを同一Catalog内のexact実行設定へ解決する。
 *
 * @responsibility Workbench等が選択したProfileを別の既定値へ読み替えず、Adapter設定と結合できることを検証する。
 * @trace RCM-UT-001
 * @precondition 既定Catalogを使用する。
 * @stimulus 登録済みProfile IDと未登録Profile IDを解決する。
 * @observation Model、Providerおよび未登録時の結果を観測する。
 * @oracle 登録済みIDだけexact設定へ解決し、未登録・曖昧・参照不整合は値欠測と固定理由で区別する。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary RCM-UT-001=Direct Boundary: AI Adapter Test Source→対象契約
 */
test("選択済みProfile IDをexact実行設定へ解決する", () => {
  const resolved = resolveAiProfileById(
    defaultAiProfileCatalog,
    "PROFILE-100001",
  ).value;
  assert.equal(resolved?.provider, "codex");
  assert.equal(resolved?.adapterId, "codex-cli");
  assert.equal(resolved?.exactModelId, "gpt-5.6-sol");
  assert.equal(resolved?.defaultReasoningEffort, "medium");
  assert.deepEqual(
    resolveAiProfileById(defaultAiProfileCatalog, "PROFILE-999999"),
    { status: "blocked", value: null, error: "ai_profile_not_found" },
  );
  const profile = defaultAiProfileCatalog.profiles[0];
  assert.ok(profile);
  assert.equal(
    resolveAiProfileById(
      { ...defaultAiProfileCatalog, profiles: [profile, profile] },
      profile.profileId,
    ).error,
    "ai_profile_ambiguous",
  );
  assert.equal(
    resolveAiProfileById(
      { ...defaultAiProfileCatalog, adapters: [] },
      profile.profileId,
    ).error,
    "ai_profile_reference_invalid",
  );
});
