/**
 * 技術CatalogとCoordinatorの明示選定からProvider計画への搬送を検証する。
 * @packageDocumentation
 * @responsibility Provider・識別方式・Model・Effortを役割既定値から無変換で搬送する。
 * @trace RCM-IT-005
 * @level IT
 * @scope 技術Catalog、Repository選定、Provider計画とEM保存型の適合。実AI・認証・Dockerなし。
 * @boundary RCM-IT-005=Related 2 Blocks: Coordinator選定とAD／DI技術値→EM保存型。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  getModelCatalog,
  type ModelSelection,
  planExecution,
  type TurnCountDiagnostic,
} from "../../../ai-adapter/src/index.ts";
import {
  describeIsolationConfiguration,
  type ResourceSnapshot,
} from "../../../docker-isolation/src/index.ts";
import type {
  ExecutionOperationRecord,
  ExecutionSelection,
  OperationResources,
} from "../../../execution-model/src/index.ts";
import { resolveExecutionSelection } from "../../src/selection/resolve.ts";

/**
 * 両Providerの助言計画とDI公開配置を接続する。
 * @responsibility AD単独の本文検査と技術配置の結合を分離する。
 * @trace RCM-IT-005
 * @precondition 公開CatalogとDI固定構成。
 * @stimulus Codex alternateとClaude primaryで助言計画を構築する。
 * @observation Model・識別方式・Effort・Tool禁止・Session禁止・stdin限定。
 * @oracle ADから移管した全Provider計画assertを維持する。
 * @cleanup 実行・保存・AI・Docker操作なし。
 * @boundary Coが結合するAD計画とDI配置。
 */
test("Provider助言計画はDI公開配置と元の保護条件を維持する", () => {
  for (const provider of ["codex", "claude"] as const) {
    const request = {
      provider,
      purpose: "advice" as const,
      modelSelection: {
        provider,
        modelIdentifier: provider === "codex" ? "gpt-6.1-sol" : "opus",
        reasoningEffort: "medium" as const,
        identifierKind:
          provider === "codex" ? ("exact" as const) : ("alias" as const),
      },
    };
    const capabilities = describeIsolationConfiguration(provider);
    const locations =
      capabilities.provider === "codex"
        ? capabilities.locations.alternate
        : capabilities.locations.primary;
    const plan = planExecution(
      { ...request, allowedReferences: ["synthetic-reference"] },
      locations,
    ).plan;
    assert.ok(plan && "toolsAllowed" in plan);
    assert.equal(plan.provider, provider);
    assert.equal(plan.modelIdentifier, request.modelSelection.modelIdentifier);
    assert.equal(plan.identifierKind, request.modelSelection.identifierKind);
    assert.equal(plan.reasoningEffort, "medium");
    assert.equal(plan.toolsAllowed, false);
    assert.equal(plan.sessionPersistenceAllowed, false);
    assert.equal(plan.promptTransport, "stdin_only");
  }
});

/** 保存契約と技術契約の片側だけの拡大・欠落も型検査で拒否する。実行時検査の代用ではない。 */
type SameContract<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false;

/**
 * 上位が接続する技術値と保存値の構造適合を確認する。
 * @responsibility 選定・Snapshot・Turn診断の情報量とreadonly性を双方向で照合する。
 * @trace RCM-IT-005
 * @precondition 各Ownerが公開する現在の型契約。
 * @stimulus 同形状の技術値とEM保存型を型演算で比較する。
 * @observation 三比較がtrueとして型検査できること。
 * @oracle 項目・値域・optional性・readonly性の不一致はコンパイル失敗。
 * @cleanup 値の複製・保存・外部実行なし。
 * @boundary Coが結合するAD／DI技術値とEM保存値。
 */
test("技術選定・Snapshot・診断はEM保存契約と双方向で適合する", () => {
  const compatible: readonly [
    SameContract<
      Pick<
        ExecutionSelection,
        | "provider"
        | "modelIdentifier"
        | "identifierKind"
        | "reasoningEffort"
        | "purpose"
      >,
      ModelSelection
    >,
    SameContract<OperationResources["snapshot"], ResourceSnapshot>,
    SameContract<
      NonNullable<
        NonNullable<
          ExecutionOperationRecord["primaryFailure"]
        >["turnCountDiagnostic"]
      >,
      TurnCountDiagnostic
    >,
  ] = [true, true, true];
  assert.deepEqual(compatible, [true, true, true]);
  const incompatible: readonly [
    SameContract<ModelSelection, Omit<ModelSelection, "reasoningEffort">>,
    SameContract<ResourceSnapshot, Readonly<{ resources: readonly unknown[] }>>,
    SameContract<
      TurnCountDiagnostic,
      Readonly<{ valueType: string; numberText?: string | null }>
    >,
    SameContract<{ value: string }, Readonly<{ value: string }>>,
  ] = [false, false, false, false];
  assert.deepEqual(incompatible, [false, false, false, false]);
});

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
    assert.equal(selection.catalogIdentity, getModelCatalog().identity);
    const plan = planExecution({
      provider,
      purpose: "advice",
      modelSelection: {
        provider,
        modelIdentifier: selection.modelIdentifier,
        identifierKind: selection.identifierKind,
        reasoningEffort: selection.reasoningEffort,
      },
      allowedReferences: ["synthetic-reference"],
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
 * @responsibility exact Modelとmedium、両役割のCode Mode条件を検証する。
 * @trace RCM-IT-005
 * @precondition 新Model二件が同梱Catalogにあり、配置は固定構成Ownerから取得する。
 * @stimulus 五役割を選定し、Task計画と不正選定を生成する。
 * @observation Model・Effort・argv・拒否理由と不変の権限制限。
 * @oracle Modelを旧版へ補完せず、reviewerのread-only／never／network／Code Mode Host条件と不正選定の起動前拒否を維持する。
 * @cleanup N/A: 値検査だけで外部実行・保存なし。
 * @boundary RCM-IT-005=Direct Boundary: Repository選定→Provider計画→固定配置。
 */
test("新Model設定はmediumを維持しCodexの両役割と保護条件へ接続する", () => {
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
  const plan = planExecution(
    request,
    describeIsolationConfiguration("codex").locations.primary,
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
  const reviewer = planExecution(
    {
      ...request,
      input: { ...request.input, taskRole: "reviewer" },
    },
    describeIsolationConfiguration("codex").locations.primary,
  );
  assert.equal(reviewer.status, "ready");
  if (reviewer.status !== "ready") throw Error("reviewer_plan_blocked");
  assert.equal(reviewer.plan.exactModel, codex.model);
  for (const expected of [
    "features.code_mode=true",
    "features.shell_tool=false",
    "features.unified_exec=false",
    'approval_policy="never"',
    "permissions.crdd-reviewer.network.enabled=false",
  ])
    assert.ok(reviewer.plan.argv.includes(expected));
  assert.equal(
    reviewer.plan.argv[reviewer.plan.argv.indexOf("--sandbox") + 1],
    "read-only",
  );
  assert.equal(reviewer.plan.argv.includes("--approve-for-me"), false);
  const commandPath =
    describeIsolationConfiguration("codex").locations.primary.commandPath ??
    "codex";
  for (const expected of [
    "features.code_mode_only=true",
    "features.code_mode_host={enabled=true,disable_in_process_fallback=true}",
    `permissions.crdd-reviewer.filesystem={":root"="deny",":minimal"="read",":workspace_roots"={"."="read"},"${commandPath}"="read"}`,
  ])
    assert.ok(reviewer.plan.argv.includes(expected));
  assert.equal(
    planExecution({
      ...request,
      input: { ...request.input, effort: "high" },
    }).status,
    "blocked",
  );
  assert.equal(
    planExecution({
      ...request,
      modelSelection: { ...request.modelSelection, identifierKind: "alias" },
    }).status,
    "blocked",
  );
  assert.equal(
    planExecution({
      ...request,
      modelSelection: {
        ...request.modelSelection,
        modelIdentifier: "gpt-6.1-sol-unknown",
      },
    }).status,
    "blocked",
  );
});
