/**
 * 技術CatalogとCoordinatorの明示選定からProvider計画への搬送を検証する。
 * @packageDocumentation
 * @responsibility Provider・識別方式・Model・Effortを役割既定値から無変換で搬送する。
 * @trace RCM-IT-005
 * @level IT
 * @scope 技術Catalog、Repository選定とProvider助言計画。実AI・認証・Dockerなし。
 * @boundary RCM-IT-005=Direct Boundary: AI Adapter→Coordinator選定→Provider計画。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { getAiModelCatalog, planProviderExecution } from "../../src/index.ts";
import { resolveExecutionSelection } from "../../../coordinator/src/selection/resolve.ts";
import { describeDockerProviderExecutionLocations } from "../../../docker-isolation/src/index.ts";

/**
 * 両Providerの助言選定を同じ技術Identityの計画へ渡す。
 * @responsibility 役割設定を技術Catalogへ逆流させずaliasを維持する。
 * @trace RCM-IT-005
 * @precondition 同梱Catalogの助言対応Modelと合成Repository設定だけを使う。
 * @stimulus 明示したProviderごとに設定を解決しProvider計画を作る。
 * @observation 完全選定、Catalog Identity、計画のModel・Effort。
 * @oracle 選定と計画が一致し、未設定を既定Profileで補完しない。
 * @cleanup N/A: 値検査のみ。外部資源を作らない。
 * @boundary RCM-IT-005=Direct Boundary: Coordinator選定とAI Adapter計画。
 */
test("技術Catalogの明示選定をProvider計画へ無変換で搬送する", () => {
  for (const provider of ["codex", "claude"] as const) {
    const choice = {
      provider,
      model: provider === "codex" ? "gpt-5.6-sol" : "opus",
      effort: "high",
    };
    const task = { provider: "codex", model: "gpt-5.5", effort: "medium" };
    const config = {
      contract: "crdd/ai-selection",
      revision: 1,
      roleDefaults: {
        coordinator: choice,
        executor: task,
        independent_reviewer: task,
        result_integration: choice,
        advice: choice,
      },
      workTypes: {},
      overrides: {},
    };
    const resolved = resolveExecutionSelection(config, {
      role: "advice",
      workType: null,
    });
    assert.equal(resolved.status, "resolved");
    assert.ok(resolved.value);
    const selection = resolved.value;
    assert.equal(selection.catalogIdentity, getAiModelCatalog().identity);
    const plan = planProviderExecution({
      provider,
      purpose: "advice",
      modelSelection: {
        provider,
        modelIdentifier: selection.modelIdentifier,
        identifierKind: selection.identifierKind,
        reasoningEffort: selection.reasoningEffort,
      },
      resultSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    });
    assert.equal(plan.status, "ready");
    if (plan.status !== "ready") throw new Error("fixture_plan_blocked");
    assert.equal(plan.plan.modelIdentifier, choice.model);
    assert.equal(plan.plan.reasoningEffort, choice.effort);
    assert.equal(
      selection.identifierKind,
      provider === "claude" ? "alias" : "exact",
    );
    assert.equal(
      resolveExecutionSelection(null, { role: "advice", workType: null })
        .status,
      "blocked",
    );
  }
});

/**
 * 新ModelのRepository設定を同じ選定のまま実行計画へ搬送する。
 * @responsibility exact Modelとmedium、Code Mode条件、未検証reviewer拒否を検証する。
 * @trace RCM-IT-005
 * @precondition 新Model二件が同梱Catalogにあり、配置は固定構成Ownerから取得する。
 * @stimulus 五役割を選定し、Task計画と不正選定を生成する。
 * @observation Model・Effort・argv・拒否理由と不変の権限制限。
 * @oracle Modelを旧版へ補完せず、未検証のCodex reviewerと不一致を起動前に拒否する。
 * @cleanup N/A: 値検査だけで外部実行・保存なし。
 * @boundary RCM-IT-005=Direct Boundary: Repository選定→Provider計画→固定配置。
 */
test("新Model設定はmediumを維持しCodex Code Modeの未検証役割を拒否する", () => {
  const codex = { provider: "codex", model: "gpt-6.1-sol", effort: "medium" };
  const claude = {
    provider: "claude",
    model: "claude-opus-5-5",
    effort: "medium",
  };
  const config = {
    contract: "crdd/ai-selection",
    revision: 1,
    roleDefaults: {
      coordinator: codex,
      executor: codex,
      independent_reviewer: claude,
      result_integration: codex,
      advice: codex,
    },
    workTypes: {},
    overrides: {},
  };
  for (const role of [
    "coordinator",
    "executor",
    "independent_reviewer",
    "result_integration",
    "advice",
  ] as const) {
    const result = resolveExecutionSelection(config, { role, workType: null });
    assert.equal(result.status, "resolved");
    if (result.status !== "resolved") throw new Error("selection_blocked");
    assert.equal(result.value.reasoningEffort, "medium");
    assert.equal(result.value.identifierKind, "exact");
    assert.equal(
      result.value.modelIdentifier,
      role === "independent_reviewer" ? claude.model : codex.model,
    );
  }
  const request = {
    provider: "codex" as const,
    purpose: "task" as const,
    modelSelection: {
      provider: "codex" as const,
      modelIdentifier: codex.model,
      identifierKind: "exact" as const,
      reasoningEffort: "medium" as const,
    },
    input: {
      provider: "codex",
      mode: "isolated_task",
      effort: "medium",
      taskRole: "executor",
    },
  };
  const plan = planProviderExecution(
    request,
    describeDockerProviderExecutionLocations("codex", "task"),
  );
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") throw new Error("plan_blocked");
  assert.equal(plan.plan.exactModel, codex.model);
  assert.equal(
    plan.plan.argv[plan.plan.argv.indexOf("--model") + 1],
    codex.model,
  );
  for (const expected of [
    "features.code_mode=true",
    "features.code_mode_only=true",
    "features.code_mode_host={enabled=true,disable_in_process_fallback=true}",
    "features.multi_agent=false",
    "features.multi_agent_v2=false",
    "permissions.crdd-executor.network.enabled=false",
  ])
    assert.ok(plan.plan.argv.includes(expected));
  assert.equal(plan.plan.commandNetworkAccessAllowed, false);
  assert.equal(
    planProviderExecution({
      ...request,
      input: { ...request.input, taskRole: "reviewer" },
    }).status,
    "blocked",
  );
  assert.equal(
    planProviderExecution({
      ...request,
      input: { ...request.input, effort: "high" },
    }).status,
    "blocked",
  );
  assert.equal(
    planProviderExecution({
      ...request,
      modelSelection: { ...request.modelSelection, identifierKind: "alias" },
    }).status,
    "blocked",
  );
  assert.equal(
    planProviderExecution({
      ...request,
      modelSelection: {
        ...request.modelSelection,
        modelIdentifier: "gpt-6.1-sol-unknown",
      },
    }).status,
    "blocked",
  );
});
