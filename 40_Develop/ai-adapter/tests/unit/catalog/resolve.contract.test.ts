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

/** 試験用抽出を製品入口から分離し、importでEffectを起こさない。
 * @trace RCM-IT-005
 * @precondition 同PackageのSourceと宣言済み試験入口。
 * @stimulus Root／試験入口をロードし製品Sourceの参照を調べる。
 * @observation 公開名とpackage exports、禁止参照の不存在。
 * @oracle 内部抽出は試験入口だけに存在する。
 * @cleanup N/A: 読取りとModuleロードのみ。
 */
test("試験用抽出入口は通常Rootと製品Sourceから分離する", async () => {
  const fs = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const api = await import("../../../src/index.ts");
  const testing = await import("../../../scripts/ai-adapter-test.ts");
  assert.deepEqual(Object.keys(testing), [
    "extractProviderResult",
    "inspectCodexExecutionObservation",
  ]);
  assert.equal("extractProviderResult" in api, false);
  assert.equal("inspectCodexExecutionObservation" in api, false);
  const pkg = JSON.parse(
    fs.readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(Object.keys(pkg.exports).sort(), [".", "./testing"]);
  for (const p of fs.globSync("src/**/*.ts", { cwd: root }))
    assert.doesNotMatch(
      fs.readFileSync(root + "/" + p, "utf8"),
      /scripts\/ai-adapter-test|\/testing["']/,
    );
});

import {
  getAiModelCatalog,
  resolveAiModelSelection,
} from "../../../src/catalog/resolve.ts";

/**
 * 技術カタログの対応組だけを補正なしで解決する。
 * @responsibility 用途・Effortとaliasの意味、同一カタログの相関を検証する。
 * @trace RCM-UT-001
 * @precondition 同梱の新形式カタログだけを利用する。
 * @stimulus 全対応組と用途・Effort・Provider・Modelの負対照を渡す。
 * @observation 解決値、Identity、不変性と固定拒否理由。
 * @oracle 対応組だけ成功し、未知値や互換理由をfallbackへ変換しない。
 * @cleanup N/A: 値検査だけで外部資源を作らない。
 * @boundary 同梱技術カタログから選択結果への純粋変換。
 */
test("技術選定は確認済みの用途とEffortだけを解決しaliasを維持する", () => {
  const snapshot = getAiModelCatalog();
  assert.match(snapshot.identity, /^[a-f0-9]{64}$/u);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.catalog));
  assert.ok(Object.isFrozen(snapshot.catalog.models));
  assert.equal(snapshot.catalog.models.length, 5);
  assert.deepEqual(snapshot.catalog.models, [
    {
      provider: "codex",
      modelIdentifier: "gpt-6.1-sol",
      identifierKind: "exact",
      supportedEfforts: ["low", "medium", "high"],
      supportedPurposes: ["advice", "task"],
      compatibilityReason: null,
    },
    {
      provider: "claude",
      modelIdentifier: "claude-opus-5-5",
      identifierKind: "exact",
      supportedEfforts: ["low", "medium", "high"],
      supportedPurposes: ["advice", "task"],
      compatibilityReason: null,
    },
    {
      provider: "codex",
      modelIdentifier: "gpt-5.6-sol",
      identifierKind: "exact",
      supportedEfforts: ["low", "medium", "high"],
      supportedPurposes: ["advice"],
      compatibilityReason: "gpt_5_6_task_not_verified_in_current_runtime",
    },
    {
      provider: "codex",
      modelIdentifier: "gpt-5.5",
      identifierKind: "exact",
      supportedEfforts: ["low", "medium", "high"],
      supportedPurposes: ["task"],
      compatibilityReason: null,
    },
    {
      provider: "claude",
      modelIdentifier: "opus",
      identifierKind: "alias",
      supportedEfforts: ["low", "medium", "high"],
      supportedPurposes: ["advice", "task"],
      compatibilityReason: null,
    },
  ]);
  for (const model of snapshot.catalog.models) {
    assert.ok(Object.isFrozen(model));
    assert.ok(Object.isFrozen(model.supportedEfforts));
    assert.ok(Object.isFrozen(model.supportedPurposes));
    assert.equal("selectionRoles" in model, false);
    assert.equal("defaultReasoningEffort" in model, false);
    for (const purpose of model.supportedPurposes) {
      for (const reasoningEffort of model.supportedEfforts) {
        const result = resolveAiModelSelection({
          provider: model.provider,
          modelIdentifier: model.modelIdentifier,
          purpose,
          reasoningEffort,
        });
        assert.equal(result.status, "resolved");
        assert.deepEqual(result.value, {
          provider: model.provider,
          modelIdentifier: model.modelIdentifier,
          identifierKind: model.identifierKind,
          purpose,
          reasoningEffort,
          catalogIdentity: snapshot.identity,
        });
        assert.ok(Object.isFrozen(result.value));
      }
    }
  }
  const base = {
    provider: "codex",
    modelIdentifier: "gpt-5.6-sol",
    purpose: "advice",
    reasoningEffort: "medium",
  };
  for (const [change, error] of [
    [{ purpose: "task" }, "ai_model_purpose_unsupported"],
    [{ modelIdentifier: "gpt-5.5" }, "ai_model_purpose_unsupported"],
    [{ modelIdentifier: "gpt-6-astra" }, "ai_model_not_found"],
    [{ modelIdentifier: "gpt-6.1-sol-unknown" }, "ai_model_not_found"],
    [{ provider: "claude" }, "ai_model_not_found"],
    [{ reasoningEffort: "xhigh" }, "ai_model_effort_unsupported"],
    [{ reasoningEffort: "max" }, "ai_model_effort_unsupported"],
    [{ purpose: "executor" }, "ai_model_selection_invalid"],
    [{ role: "executor" }, "ai_model_selection_invalid"],
  ] as const) {
    assert.deepEqual(resolveAiModelSelection({ ...base, ...change }), {
      status: "blocked",
      value: null,
      error,
    });
  }
  let hooks = 0;
  const getter = { ...base };
  Object.defineProperty(getter, "modelIdentifier", {
    enumerable: true,
    get() {
      hooks++;
      return base.modelIdentifier;
    },
  });
  assert.equal(resolveAiModelSelection(getter).status, "blocked");
  assert.equal(
    resolveAiModelSelection(
      new Proxy(base, {
        ownKeys() {
          hooks++;
          return Reflect.ownKeys(base);
        },
      }),
    ).status,
    "blocked",
  );
  assert.equal(hooks, 0);
});

/**
 * 公開境界を技術CatalogとProvider操作だけへ限定する。
 * @responsibility 旧Profile Store・CRUD・自動選定の公開が復活しないことを確認する。
 * @trace RCM-UT-001
 * @precondition 新形式の公開Rootを読み込む。
 * @stimulus 実行時の公開Symbol名を列挙する。
 * @observation exactな公開集合。
 * @oracle 採用済みの技術APIだけが存在する。
 * @cleanup N/A: 値検査のみ。
 * @boundary AI Adapterの公開Rootと利用側。
 */
test("公開Rootは旧Profile管理を提供しない", () => {
  assert.deepEqual(Object.keys(adapterPublicApi).sort(), [
    "CLAUDE_EXECUTION_PLAN_CONTRACT",
    "CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION",
    "CLAUDE_STRUCTURED_RESULT_CONTRACT",
    "CLAUDE_STRUCTURED_RESULT_CONTRACT_REVISION",
    "CLAUDE_TASK_MAXIMUM_TURNS",
    "CODEX_EXECUTION_PLAN_CONTRACT",
    "CODEX_EXECUTION_PLAN_CONTRACT_REVISION",
    "CODEX_STRUCTURED_RESULT_CONTRACT",
    "CODEX_STRUCTURED_RESULT_CONTRACT_REVISION",
    "PROVIDER_ADVICE_COMMAND_CONTRACT",
    "PROVIDER_ADVICE_COMMAND_CONTRACT_REVISION",
    "PROVIDER_ADVICE_OUTPUT_CONTRACT",
    "PROVIDER_ADVICE_OUTPUT_CONTRACT_REVISION",
    "PROVIDER_ADVICE_OUTPUT_REASONS",
    "PROVIDER_AUTHENTICATION_POLICIES",
    "PROVIDER_BILLING_POLICY_CONTRACT",
    "PROVIDER_BILLING_POLICY_CONTRACT_REVISION",
    "convertProviderError",
    "describeAdviceResultSchema",
    "describeClaudeStructuredResultContract",
    "describeCodexStructuredResultContract",
    "describeProviderAuthentication",
    "describeProviderBillingPolicy",
    "describeProviderExecution",
    "evaluateProviderAuthentication",
    "evaluateProviderAvailability",
    "evaluateProviderTaskScope",
    "getAiModelCatalog",
    "inspectTaskResultContent",
    "normalizeClaudeStructuredResult",
    "normalizeCodexStructuredResult",
    "parseAdviceResult",
    "parseProviderResult",
    "planProviderExecution",
    "prepareProviderEnvironment",
    "projectCodexExecutionBoundary",
    "resolveAiModelSelection",
    "validateProviderModelId",
  ]);
});
