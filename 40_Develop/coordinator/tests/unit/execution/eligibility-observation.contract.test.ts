/**
 * coordinator:unit:provider-eligibility-runtimeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility ERB-UT-023の利用可能性確認をUTで補助し、unknownを成功化しない。
 * @trace ERB-UT-023
 * @level UT
 * @scope provider、eligibility、runtime
 * @boundary ERB-UT-023=N/A: Provider五軸の純粋前提Oracle。構成選択のIT成立は証明しない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { compileFunction } from "node:vm";
import { inspectExecutionSelection } from "../../../../execution-model/src/index.ts";
import { resolveModelSelection } from "../../../../ai-adapter/src/index.ts";
import {
  snapshotPlainRecord,
  snapshotPlainArray,
} from "../../../src/input/snapshot.ts";
import { sourceDeclaration } from "../../../../execution-model/tests/support/source-declaration.ts";
import { executionSelection } from "../../fixtures/ai-selection.ts";
import { evaluateProviderAvailability } from "../../../src/execution/observation.ts";

import {
  createIsolatedProviderEligibilityRuntimeCandidate,
  describeProviderEligibilityRuntimeContract,
  observeRuntimeOwnedProviderEligibility,
} from "../../../src/execution/observation.ts";

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
 * @trace ERB-UT-023
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createObservationを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-023=N/A: 五軸の純粋値分類。外部Provider・保存・資源なし。
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
 * 全軸をRuntimeが確認した場合だけCodexとClaudeをeligibleにするを検証する。
 *
 * @responsibility 全軸をRuntimeが確認した場合だけCodexとClaudeをeligibleにするの合否判定を所有する。
 * @trace ERB-UT-023
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 全軸をRuntimeが確認した場合だけCodexとClaudeをeligibleにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-023=N/A: 五軸の純粋値分類。外部Provider・保存・資源なし。
 */
test("全軸をRuntimeが確認した場合だけCodexとClaudeをeligibleにする", () => {
  for (const provider of ["codex", "claude"] as const) {
    assert.deepEqual(
      evaluateProviderAvailability(provider, createObservation()),
      {
        provider,
        status: "available",
        reason: "ready",
      },
    );
    assert.deepEqual(evaluateProviderAvailability(provider, null), {
      provider,
      status: "unknown",
      reason: "observation_unavailable",
    });
    for (const axis of [
      "subscriptionAuth",
      "officialDistribution",
      "policy",
    ] as const) {
      assert.equal(
        evaluateProviderAvailability(
          provider,
          createObservation({ [axis]: "runtime_preflight_required" }),
        ).status,
        "preflight_required",
      );
    }
    assert.equal(
      evaluateProviderAvailability(
        provider,
        createObservation({ subscriptionQuota: "bounded_request_check" }),
      ).status,
      "preflight_required",
    );
    assert.deepEqual(
      evaluateProviderAvailability(
        provider,
        createObservation({
          subscriptionAuth: "unknown",
          subscriptionQuota: "unavailable",
        }),
      ),
      {
        provider,
        status: "unavailable",
        reason: "subscription_quota_unavailable",
      },
    );
  }
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
 * @trace ERB-UT-023
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 明示的な不成立軸を経路選定用の正確な理由へ写像するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-023=N/A: 五軸の純粋値分類。外部Provider・保存・資源なし。
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
 * @trace ERB-UT-023
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus unknownを同一Providerへの推測fallback根拠にしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-023=N/A: 五軸の純粋値分類。外部Provider・保存・資源なし。
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
  assert.equal(providerEligibilityResults[1]?.status, "ineligible");
  assert.equal(
    evaluateProviderAvailability(
      "claude",
      createObservation({ subscriptionQuota: "unknown" }),
    ).status,
    "unknown",
  );
});

/**
 * 認証preflightとquotaのbounded request確認を区別するを検証する。
 *
 * @responsibility 認証preflightとquotaのbounded request確認を区別するの合否判定を所有する。
 * @trace ERB-UT-023
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 認証preflightとquotaのbounded request確認を区別するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-023=N/A: 五軸の純粋値分類。外部Provider・保存・資源なし。
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
  assert.equal(
    evaluateProviderAvailability(
      "codex",
      createObservation({
        subscriptionAuth: "runtime_preflight_required",
        subscriptionQuota: "bounded_request_check",
      }),
    ).status,
    "preflight_required",
  );
});

/**
 * accessor、Proxy、余分なkeyとobserver例外を実行せずfail closedにするを検証する。
 *
 * @responsibility accessor、Proxy、余分なkeyとobserver例外を実行せずfail closedにするの合否判定を所有する。
 * @trace ERB-UT-023
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus accessor、Proxy、余分なkeyとobserver例外を実行せずfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-023=N/A: 五軸の純粋値分類。外部Provider・保存・資源なし。
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
 * @trace ERB-UT-023
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus productionはCodexとClaudeを認証preflight必須候補として公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-023=N/A: 五軸の純粋値分類。外部Provider・保存・資源なし。
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
 * @trace ERB-UT-023
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約はcaller claimと有料API fallbackを認めないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-023=N/A: 五軸の純粋値分類。外部Provider・保存・資源なし。
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

/**
 * 単一・二選定の完全捕捉と非発行preflightを同じ現在観測へ接続する。
 * @responsibility 退役Grantを再発行せず適合・不正値・未知利用可能性を拒否する。
 * @trace PRL-UT-006
 * @precondition 実宣言と実選定検査に有限の現在Operation・利用可能性観測だけを渡す。
 * @stimulus 正常二用途、別操作、不正選定、欠測・重複Providerを渡す。
 * @observation 独立凍結された完全選定と観測回数・固定拒否。
 * @oracle 一断面観測で適合し、人工ID・Capabilityを返さない。
 * @cleanup N/A: 局所値のみ。
 * @boundary 現役非発行preflightとProvider適合。
 */
test("非発行preflightは単一と二選定を同一観測断面で照合する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/execution/authority.ts", import.meta.url),
    "utf8",
  );
  const body = stripTypeScriptTypes(
    [
      sourceDeclaration(source, "selectionEligibilityFailure"),
      sourceDeclaration(source, "preflightRuntimeOwnedDelegationSelections"),
    ].join("\n"),
  );
  let observations = 0;
  let providers: unknown = [
    { provider: "codex", status: "eligible", reason: "ready" },
    { provider: "claude", status: "eligible", reason: "ready" },
  ];
  const preflight = compileFunction(
    `${body}\nreturn preflightRuntimeOwnedDelegationSelections;`,
    [
      "verifyOwnedOperationManagementCapability",
      "verifyRuntimeOwnedRepositoryOperation",
      "observeRuntimeOwnedProviderEligibility",
      "snapshotPlainRecord",
      "snapshotPlainArray",
      "inspectExecutionSelection",
      "resolveModelSelection",
    ],
  )(
    () => ({ operationId: "OP-123456" }),
    () => ({ operationId: "OP-123456" }),
    () => {
      observations++;
      return providers;
    },
    snapshotPlainRecord,
    snapshotPlainArray,
    inspectExecutionSelection,
    resolveModelSelection,
  );
  const first = executionSelection();
  const second = executionSelection("independent_reviewer", {
    provider: "claude",
    model: "opus",
    effort: "high",
  });
  for (const selections of [[first], [first, second]]) {
    observations = 0;
    const result = preflight(
      {},
      { operationId: "OP-123456", executionSelections: selections },
    );
    assert.equal(result.status, "candidate");
    assert.equal(result.operationId, "OP-123456");
    assert.deepEqual(Array.from(result.executionSelections), selections);
    assert.ok(Object.isFrozen(result.executionSelections));
    for (let index = 0; index < selections.length; index++) {
      assert.notEqual(result.executionSelections[index], selections[index]);
      assert.ok(Object.isFrozen(result.executionSelections[index]));
    }
    assert.deepEqual(
      Object.keys(result).sort(),
      ["status", "operationId", "executionSelections"].sort(),
    );
    assert.equal(observations, 1);
  }
  for (const input of [
    { operationId: "OP-654321", executionSelections: [first] },
    { operationId: "OP-123456", executionSelections: [] },
    { operationId: "OP-123456", executionSelections: [first, first, first] },
    {
      operationId: "OP-123456",
      executionSelections: [{ ...first, modelIdentifier: "retired-model" }],
    },
    {
      operationId: "OP-123456",
      executionSelections: [
        {
          ...first,
          identifierKind: first.identifierKind === "exact" ? "alias" : "exact",
        },
      ],
    },
  ])
    assert.equal(preflight({}, input).status, "blocked");
  for (const missing of [
    [],
    [{ provider: first.provider, status: "ineligible", reason: "unknown" }],
    [
      { provider: first.provider, status: "eligible", reason: "ready" },
      { provider: first.provider, status: "eligible", reason: "duplicate" },
    ],
  ]) {
    providers = missing;
    assert.equal(
      preflight({}, { operationId: "OP-123456", executionSelections: [first] })
        .status,
      "blocked",
    );
  }
});
