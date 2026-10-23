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
