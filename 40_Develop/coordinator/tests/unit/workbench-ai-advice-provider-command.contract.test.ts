/**
 * Workbench助言用ProviderコマンドのRepository非共有境界を検証する。
 *
 * @packageDocumentation
 * @responsibility Codex／Claudeの固定配布物、exact Model、標準入力、ToolなしおよびSessionなしを検証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Catalog IdentityとProvider CLI計画の局所境界。
 */
import { describeWorkbenchAiAdviceResultSchema } from "../../src/workbench-ai/advice-result.ts";
import assert from "node:assert/strict";
import test from "node:test";

import {
  codexAdviceProviderInitRequired,
  describeCodexAdviceDistributionIdentity,
} from "../../../ai-adapter/src/index.ts";
import { describeCodexExecutionPlanContract } from "../../../ai-adapter/src/index.ts";
import { planWorkbenchAiAdviceProviderCommand } from "../../../ai-adapter/src/index.ts";

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
  const plan = planWorkbenchAiAdviceProviderCommand(
    {
      provider: "codex",
      exactModelId: "gpt-6.1-sol",
      reasoningEffort: "medium",
    },
    describeWorkbenchAiAdviceResultSchema(),
  );

  assert.equal(plan.provider, "codex");
  assert.equal(plan.exactModelId, "gpt-6.1-sol");
  const distribution = describeCodexAdviceDistributionIdentity();
  assert.equal(distribution.officialCliUnmodified, true);
  assert.equal(
    distribution.binarySha256,
    "1748767b230ebfc3d4ab7e4e254920d0c0ad9691fd8c11f190e7d44511a4a92e",
  );
  assert.equal("startupPatchSha256" in distribution, false);
  const normal = describeCodexExecutionPlanContract().distributionIdentity;
  assert.equal(plan.command, distribution.executablePath);
  assert.equal(plan.fixedImageDigest, distribution.fixedImageDigest);
  assert.notEqual(plan.command, normal.executablePath);
  assert.notEqual(plan.fixedImageDigest, normal.fixedImageDigest);
  assert.equal(
    codexAdviceProviderInitRequired("workbench_advice", plan.fixedImageDigest),
    true,
  );
  for (const mode of ["boolean_probe", "isolated_task", "unknown"]) {
    assert.equal(
      codexAdviceProviderInitRequired(mode, plan.fixedImageDigest),
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
    normal.fixedImageDigest,
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
  assert.equal(plan.repositoryMounted, false);
  assert.equal(plan.workspaceMountRequired, false);
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
  const plan = planWorkbenchAiAdviceProviderCommand(
    {
      provider: "claude",
      exactModelId: "opus",
      reasoningEffort: "high",
    },
    describeWorkbenchAiAdviceResultSchema(),
  );

  assert.equal(plan.provider, "claude");
  assert.equal(plan.exactModelId, "opus");
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
    describeWorkbenchAiAdviceResultSchema(),
  );
  const callerSchema = Object.freeze({ type: "string", maxLength: 17 });
  const callerPlan = planWorkbenchAiAdviceProviderCommand(
    { provider: "claude", exactModelId: "opus", reasoningEffort: "high" },
    callerSchema,
  );
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
  assert.equal(plan.repositoryMounted, false);
  assert.equal(plan.workspaceMountRequired, false);
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
    planWorkbenchAiAdviceProviderCommand(
      {
        provider: "codex",
        exactModelId: "gpt-5.6-sol",
        reasoningEffort: "low",
      },
      describeWorkbenchAiAdviceResultSchema(),
    ),
    planWorkbenchAiAdviceProviderCommand(
      {
        provider: "claude",
        exactModelId: "opus",
        reasoningEffort: "low",
      },
      describeWorkbenchAiAdviceResultSchema(),
    ),
  ]) {
    const commandLine = [plan.command, ...plan.argv].join(" ");
    assert.doesNotMatch(commandLine, /providerPrompt|taskHash|projectionHash/u);
    assert.equal(plan.argv.includes("--cd"), false);
    assert.equal(plan.argv.includes("/work"), false);
    assert.equal(plan.argv.includes("--mount"), false);
  }
});
