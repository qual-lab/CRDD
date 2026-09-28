/**
 * Workbench助言用ProviderコマンドのRepository非共有境界を検証する。
 *
 * @responsibility Codex／Claudeの固定配布物、exact Model、標準入力、ToolなしおよびSessionなしを検証する。
 * @trace ERB-UT-023 ERB-IT-004
 * @boundary Catalog IdentityとProvider CLI計画の局所境界。
 * @effect 外部Provider、Process、Docker、FilesystemおよびNetworkを使用しない。
 * @security Prompt、Credential、Repository PathおよびWorkspaceを外部へ送信しない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { planWorkbenchAiAdviceProviderCommand } from "../../src/security/workbench-ai-advice-provider-command.ts";

test("Codex助言をToolなし・Repository非共有の標準入力計画へ固定する", () => {
  const plan = planWorkbenchAiAdviceProviderCommand({
    provider: "codex",
    exactModelId: "gpt-5.6-sol",
    reasoningEffort: "medium",
  });

  assert.equal(plan.provider, "codex");
  assert.equal(plan.exactModelId, "gpt-5.6-sol");
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

test("Claude助言をSchema付き・Toolなしの標準入力計画へ固定する", () => {
  const plan = planWorkbenchAiAdviceProviderCommand({
    provider: "claude",
    exactModelId: "opus",
    reasoningEffort: "high",
  });

  assert.equal(plan.provider, "claude");
  assert.equal(plan.exactModelId, "opus");
  assert.equal(plan.reasoningEffort, "high");
  assert.equal(plan.resultTransport, "claude_json_envelope");
  assert.equal(plan.argv.includes("--model"), true);
  assert.equal(plan.argv.includes("opus"), true);
  assert.equal(plan.argv.includes("--effort"), true);
  assert.equal(plan.argv.includes("high"), true);
  assert.equal(plan.argv.includes("--tools="), true);
  assert.equal(plan.argv.includes("--json-schema"), true);
  assert.equal(plan.argv.includes("--no-session-persistence"), true);
  assert.equal(plan.repositoryMounted, false);
  assert.equal(plan.workspaceMountRequired, false);
  assert.equal(plan.toolsAllowed, false);
  assert.equal(plan.sessionPersistenceAllowed, false);
});

test("ProviderコマンドにPrompt本文やWorkspace Pathを埋め込まない", () => {
  for (const plan of [
    planWorkbenchAiAdviceProviderCommand({
      provider: "codex",
      exactModelId: "gpt-5.6-sol",
      reasoningEffort: "low",
    }),
    planWorkbenchAiAdviceProviderCommand({
      provider: "claude",
      exactModelId: "opus",
      reasoningEffort: "low",
    }),
  ]) {
    const commandLine = [plan.command, ...plan.argv].join(" ");
    assert.doesNotMatch(commandLine, /providerPrompt|taskHash|projectionHash/u);
    assert.equal(plan.argv.includes("--cd"), false);
    assert.equal(plan.argv.includes("/work"), false);
    assert.equal(plan.argv.includes("--mount"), false);
  }
});
