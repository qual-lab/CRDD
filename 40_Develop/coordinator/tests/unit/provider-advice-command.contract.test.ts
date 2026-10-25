/**
 * Workbench助言用ProviderコマンドのRepository非共有境界を検証する。
 *
 * @packageDocumentation
 * @responsibility Codex／ClaudeのCommand改訂2、Modelとalias種別・Catalog Identity、Schemaの安全な固定、標準入力・Toolなし・Sessionなしを検証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Catalog IdentityとProvider CLI計画の局所境界。
 */
import { planProviderExecution } from "../../../ai-adapter/src/index.ts";
import { describeAdviceResultSchema } from "../../src/execution/result.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { codexAdviceProviderInitRequired } from "../../../docker-isolation/src/index.ts";
import { describeDockerProviderExecutionLocations } from "../../../docker-isolation/src/index.ts";
import { describeDockerProviderAssets } from "../../../docker-isolation/src/index.ts";

import buildInputs from "../../../docker-isolation/images/build-inputs.json" with {
  type: "json",
};

/**
 * 新しい選定と結果Schemaを副作用なしで計画へ固定する。
 * @responsibility alias偽装・旧形式・実行可能Schemaを両Providerで拒否する。
 * @trace ERB-UT-023
 * @precondition 採用済みModelと合成Schemaだけを使用する。
 * @stimulus 種別不一致、旧入力、Proxy、Getter、toJSON、循環、非JSON値を渡す。
 * @observation 契約改訂2、Catalog Identity、blockedとhook回数。
 * @oracle 無効入力は代替計画なし、hook実行0。
 * @cleanup N/A: 外部資源なし。
 * @boundary AI Adapterの公開計画受付。
 */
test("選定種別を保持し実行可能な結果Schemaと旧入力を拒否する", () => {
  let hooks = 0;
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        hooks++;
        return [];
      },
      getPrototypeOf() {
        hooks++;
        return Object.prototype;
      },
    },
  );
  const getter = Object.defineProperty({}, "type", {
    enumerable: true,
    get() {
      hooks++;
      return "object";
    },
  });
  const jsonHook = {
    toJSON() {
      hooks++;
      return {};
    },
  };
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  for (const provider of ["codex", "claude"] as const) {
    const modelSelection = {
      provider,
      modelIdentifier: provider === "codex" ? "gpt-5.6-sol" : "opus",
      identifierKind:
        provider === "codex" ? ("exact" as const) : ("alias" as const),
      reasoningEffort: "low" as const,
    };
    const request = {
      provider,
      purpose: "advice" as const,
      modelSelection,
      resultSchema: {
        type: "object",
        properties: { value: { type: "string" } },
      },
    };
    const ready = planProviderExecution(request);
    assert.equal(ready.status, "ready");
    assert.equal(ready.plan?.contractRevision, 2);
    assert.equal(ready.plan?.identifierKind, modelSelection.identifierKind);
    assert.match(ready.plan?.catalogIdentity ?? "", /^[a-f0-9]{64}$/u);
    for (const resultSchema of [
      proxy,
      getter,
      jsonHook,
      cycle,
      { nested: proxy },
      { nested: getter },
      { nested: jsonHook },
      { value: undefined },
      { value: NaN },
      { value: 1n },
      { values: [undefined] },
    ]) {
      const result = planProviderExecution({ ...request, resultSchema });
      assert.equal(result.status, "blocked");
      assert.equal(result.plan, null);
    }
    assert.equal(
      planProviderExecution({
        ...request,
        modelSelection: {
          ...modelSelection,
          identifierKind:
            modelSelection.identifierKind === "alias" ? "exact" : "alias",
        },
      }).status,
      "blocked",
    );
    assert.equal(
      planProviderExecution({
        provider,
        purpose: "advice",
        input: {
          provider,
          exactModelId: modelSelection.modelIdentifier,
          reasoningEffort: "low",
        },
        resultSchema: { type: "object" },
      } as unknown as Parameters<typeof planProviderExecution>[0]).status,
      "blocked",
    );
  }
  assert.equal(hooks, 0);
});

/**
 * Codex助言をToolなし・Repository非共有の標準入力計画へ固定するを検証する。
 *
 * @responsibility Codex助言をToolなし・Repository非共有の標準入力計画へ固定するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Codex助言をToolなし・Repository非共有の標準入力計画へ固定するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Codex助言をToolなし・Repository非共有の標準入力計画へ固定する", () => {
  const plan =
    planProviderExecution(
      {
        provider: "codex",
        purpose: "advice",
        modelSelection: {
          provider: "codex",
          modelIdentifier: "gpt-5.6-sol",
          reasoningEffort: "medium",
          identifierKind: "exact",
        },
        resultSchema: describeAdviceResultSchema(),
      },
      describeDockerProviderExecutionLocations("codex", "advice"),
    ).plan ?? assert.fail("provider_execution_plan_not_ready");

  assert.equal(plan.provider, "codex");
  assert.equal(plan.modelIdentifier, "gpt-5.6-sol");
  const distribution = {
    ...buildInputs.codex.identity,
    ...buildInputs.codex.adviceIdentity,
    ...describeDockerProviderAssets("codex").adviceIdentity,
  };
  assert.equal(distribution.officialCliUnmodified, true);
  assert.equal(
    distribution.binarySha256,
    "b93f6811d3f653f0fb83be4050d857fb9abbb111dfa2ce160563327daff7f306",
  );
  assert.equal("startupPatchSha256" in distribution, false);
  const normal = describeDockerProviderAssets("codex").identity;
  assert.equal(plan.command, distribution.executablePath);
  assert.equal(
    "binarySha256" in describeDockerProviderAssets("codex").adviceIdentity,
    false,
  );
  assert.equal(plan.command, normal.executablePath);
  assert.notEqual(
    distribution.fixedImageDigest,
    describeDockerProviderAssets("codex").fixedImageDigest,
  );
  assert.equal(
    codexAdviceProviderInitRequired(
      "workbench_advice",
      distribution.fixedImageDigest,
    ),
    true,
  );
  for (const mode of ["boolean_probe", "isolated_task", "unknown"]) {
    assert.equal(
      codexAdviceProviderInitRequired(mode, distribution.fixedImageDigest),
      false,
    );
  }
  assert.equal(
    codexAdviceProviderInitRequired(
      "workbench_advice",
      "sha256:843db607376a454cb7c901e76d4da1d168d6e384912366448df3363b42624d36",
    ),
    true,
  );
  for (const image of [
    describeDockerProviderAssets("codex").fixedImageDigest,
    null,
    `sha256:${"0".repeat(64)}`,
  ]) {
    assert.equal(
      codexAdviceProviderInitRequired("workbench_advice", image),
      false,
    );
  }
  assert.equal(plan.argv.includes("features.code_mode=true"), true);
  assert.equal(
    plan.argv.filter(
      (argument) => argument === "suppress_unstable_features_warning=true",
    ).length,
    1,
  );
  assert.equal(
    plan.argv.includes(
      "features.code_mode_host={enabled=true,disable_in_process_fallback=true}",
    ),
    true,
  );
  assert.equal(plan.argv.includes("features.code_mode_interrupt=true"), true);
  assert.equal(plan.argv.includes("features.code_mode_only=true"), true);
  assert.equal(plan.argv.includes("features.multi_agent=false"), true);
  assert.equal(plan.argv.includes("features.multi_agent_v2=false"), true);
  assert.equal(plan.argv.includes("agents.enabled=false"), false);
  assert.equal(plan.argv.includes("features.code_mode=false"), false);
  assert.equal(plan.reasoningEffort, "medium");
  assert.equal(plan.resultTransport, "codex_cli_jsonl");
  assert.equal(plan.argv.at(-1), "-");
  assert.equal(plan.argv.includes("--json"), true);
  assert.equal(plan.argv.includes("features.shell_tool=false"), true);
  assert.equal(plan.argv.includes("features.unified_exec=false"), true);
  assert.equal(plan.argv.includes('web_search="disabled"'), true);
  assert.equal("repositoryMounted" in plan, false);
  assert.equal("workspaceMountRequired" in plan, false);
  assert.equal(plan.toolsAllowed, false);
  assert.equal(plan.sessionPersistenceAllowed, false);
});

/**
 * Claude助言をSchema付き・Toolなしの標準入力計画へ固定するを検証する。
 *
 * @responsibility Claude助言をSchema付き・Toolなしの標準入力計画へ固定するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Claude助言をSchema付き・Toolなしの標準入力計画へ固定するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Claude助言をSchema付き・Toolなしの標準入力計画へ固定する", () => {
  const plan =
    planProviderExecution(
      {
        provider: "claude",
        purpose: "advice",
        modelSelection: {
          provider: "claude",
          modelIdentifier: "opus",
          reasoningEffort: "high",
          identifierKind: "alias",
        },
        resultSchema: describeAdviceResultSchema(),
      },
      describeDockerProviderExecutionLocations("claude", "advice"),
    ).plan ?? assert.fail("provider_execution_plan_not_ready");

  assert.equal(plan.provider, "claude");
  assert.equal(plan.modelIdentifier, "opus");
  assert.equal(plan.reasoningEffort, "high");
  assert.equal(plan.resultTransport, "claude_json_envelope");
  assert.equal(plan.argv.includes("--model"), true);
  assert.equal(plan.argv.includes("opus"), true);
  assert.equal(plan.argv.includes("--effort"), true);
  assert.equal(plan.argv.includes("high"), true);
  assert.equal(plan.argv.includes("--tools="), true);
  assert.equal(
    plan.argv.includes("suppress_unstable_features_warning=true"),
    false,
  );
  assert.equal(plan.argv.includes("--json-schema"), true);
  assert.deepEqual(
    JSON.parse(plan.argv[plan.argv.indexOf("--json-schema") + 1] ?? "null"),
    describeAdviceResultSchema(),
  );
  const callerSchema = Object.freeze({ type: "string", maxLength: 17 });
  const callerPlan =
    planProviderExecution(
      {
        provider: "claude",
        purpose: "advice",
        modelSelection: {
          provider: "claude",
          modelIdentifier: "opus",
          reasoningEffort: "high",
          identifierKind: "alias",
        },
        resultSchema: callerSchema,
      },
      describeDockerProviderExecutionLocations("claude", "advice"),
    ).plan ?? assert.fail("provider_execution_plan_not_ready");
  assert.deepEqual(
    JSON.parse(
      callerPlan.argv[callerPlan.argv.indexOf("--json-schema") + 1] ?? "null",
    ),
    callerSchema,
  );
  assert.deepEqual(callerSchema, { type: "string", maxLength: 17 });
  assert.equal(plan.argv.filter((value) => value === "--max-turns").length, 1);
  assert.equal(plan.argv[plan.argv.indexOf("--max-turns") + 1], "2");
  assert.equal(plan.argv.includes("--no-session-persistence"), true);
  assert.equal("repositoryMounted" in plan, false);
  assert.equal("workspaceMountRequired" in plan, false);
  assert.equal(plan.toolsAllowed, false);
  assert.equal(plan.sessionPersistenceAllowed, false);
});

/**
 * ProviderコマンドにPrompt本文やWorkspace Pathを埋め込まないを検証する。
 *
 * @responsibility ProviderコマンドにPrompt本文やWorkspace Pathを埋め込まないを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus ProviderコマンドにPrompt本文やWorkspace Pathを埋め込まないの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("ProviderコマンドにPrompt本文やWorkspace Pathを埋め込まない", () => {
  for (const plan of [
    planProviderExecution(
      {
        provider: "codex",
        purpose: "advice",
        modelSelection: {
          provider: "codex",
          modelIdentifier: "gpt-5.6-sol",
          reasoningEffort: "low",
          identifierKind: "exact",
        },
        resultSchema: describeAdviceResultSchema(),
      },
      describeDockerProviderExecutionLocations("codex", "advice"),
    ).plan ?? assert.fail("provider_execution_plan_not_ready"),
    planProviderExecution(
      {
        provider: "claude",
        purpose: "advice",
        modelSelection: {
          provider: "claude",
          modelIdentifier: "opus",
          reasoningEffort: "low",
          identifierKind: "alias",
        },
        resultSchema: describeAdviceResultSchema(),
      },
      describeDockerProviderExecutionLocations("claude", "advice"),
    ).plan ?? assert.fail("provider_execution_plan_not_ready"),
  ]) {
    const commandLine = [plan.command, ...plan.argv].join(" ");
    assert.doesNotMatch(commandLine, /providerPrompt|taskHash|projectionHash/u);
    assert.equal(plan.argv.includes("--cd"), false);
    assert.equal(plan.argv.includes("/work"), false);
    assert.equal(plan.argv.includes("--mount"), false);
  }
});
