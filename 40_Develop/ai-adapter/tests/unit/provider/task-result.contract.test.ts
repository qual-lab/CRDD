/**
 * Provider共通のTask応答内容Ownerが閉形式を検査する。
 * @packageDocumentation
 * @responsibility 編集Pathとレビュー判断・所見の相関を反証する。
 * @trace ERB-UT-023
 * @trace ERB-UT-016
 * @trace ERB-UT-032
 * @level UT
 * @scope 合成値のみ。AI・Docker・保存なし。
 */
import assert from "node:assert/strict";
import {
  planExecution,
  parseProviderResult,
  getAuthenticationDefinition,
  type ExecutionPlan,
} from "../../../src/index.ts";
import test from "node:test";
import { inspectTaskResultContent } from "../../../src/provider/task-result.ts";

/**
 * 作業量の解析条件は元計画から取得し、contextへ二重保持しない。
 * @trace ERB-UT-023
 * @precondition 合成のClaude計画と結果だけ。
 * @stimulus 元計画、JSONコピー、context差替え、作業量欠測・不正を渡す。
 * @observation 内容受理と固定拒否、計画由来のTurn診断。
 * @oracle 原本管理なしで相関を保ち、報告Turn数を実行上限で拒否しない。
 * @cleanup N/A: 外部Effectなし。
 */
test("公開解析はTaskの役割・Effortと元計画の作業量を使用する", () => {
  const plan = planExecution({
    provider: "claude",
    purpose: "task",
    modelSelection: {
      provider: "claude",
      modelIdentifier: "opus",
      identifierKind: "alias",
      reasoningEffort: "medium",
    },
    input: {
      provider: "claude",
      mode: "isolated_task",
      taskRole: "executor",
      effort: "medium",
      taskWorkload: {
        readPathCount: 1,
        allowedPathCount: 1,
        acceptanceCriterionCount: 1,
        remediationFindingCount: 0,
      },
    },
  });
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") throw Error("fixture_plan_blocked");
  assert.equal(Object.hasOwn(plan.plan.resultContext, "taskWorkload"), false);
  const observation = {
    exitCode: 0,
    stderr: "",
    stdout: JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      num_turns: 99,
      total_cost_usd: 0,
      structured_output: {
        status: "completed",
        summary: "Synthetic.",
        changedPaths: [],
        verification: [],
      },
    }),
  };
  const result = parseProviderResult(plan, observation);
  assert.equal(result.status, "confirmed");
  assert.equal(
    result.providerTurnObservation?.requestedMaximumTurns,
    plan.plan.maximumTurns,
  );
  assert.equal(result.providerTurnObservation?.providerReportedTurns, 99);
  assert.deepEqual(
    parseProviderResult(
      JSON.parse(JSON.stringify(plan)) as ExecutionPlan<"claude", "task">,
      observation,
    ),
    result,
  );
  for (const change of [
    { taskRole: "reviewer" },
    { selectedEffort: "high" },
    { taskWorkload: plan.plan.taskWorkload },
  ]) {
    const modified = {
      ...plan,
      plan: {
        ...plan.plan,
        resultContext: { ...plan.plan.resultContext, ...change },
      },
    } as ExecutionPlan<"claude", "task">;
    assert.equal(parseProviderResult(modified, observation).status, "blocked");
  }
  for (const taskWorkload of [undefined, null, { readPathCount: 0 }]) {
    const modified = {
      ...plan,
      plan: { ...plan.plan, taskWorkload },
    } as ExecutionPlan<"claude", "task">;
    assert.equal(parseProviderResult(modified, observation).status, "blocked");
  }
});

/**
 * 公開解析は内容検査までを完了し、Provider搬送値を返さない。
 * @trace ERB-UT-023
 * @precondition 合成のCodex JSONLとClaude JSON Envelope。
 * @stimulus 編集・助言と誤った用途fieldを渡す。
 * @observation 型付き内容と拒否、外側の観測を確認する。
 * @oracle 内容に観測やAuthorityが混入しない。
 * @cleanup N/A: メモリ内の解析のみ。
 */
test("公開Provider解析は用途別内容まで検査し搬送だけの部分成功を返さない", async () => {
  const { parseExecutionContent: parseProviderResult } = await import(
    "../../../src/provider/result.ts"
  );
  const raw = JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    num_turns: 1,
    total_cost_usd: 0,
    structured_output: {
      status: "completed",
      summary: "Synthetic.",
      changedPaths: [],
      verification: [],
    },
  });
  const task = parseProviderResult({
    provider: "claude",
    purpose: "task",
    taskRole: "executor",
    selectedEffort: "medium",
    taskWorkload: {
      readPathCount: 1,
      allowedPathCount: 1,
      acceptanceCriterionCount: 1,
      remediationFindingCount: 0,
    },
    raw,
  });
  assert.equal(task.status, "confirmed");
  assert.deepEqual(task.normalizedResult, {
    status: "completed",
    changedPaths: [],
    verificationCount: 0,
  });
  assert.equal(
    "providerTurnObservation" in (task.normalizedResult ?? {}),
    false,
  );
  assert.equal("remediationCapability" in (task.normalizedResult ?? {}), false);
  const advice = parseProviderResult({
    provider: "claude",
    purpose: "advice",
    allowedReferences: ["synthetic"],
    raw: JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      num_turns: 1,
      total_cost_usd: 0,
      structured_output: {
        status: "completed",
        facts: [{ text: "Synthetic.", references: ["synthetic"] }],
        sharedAnalysis: [],
        additionalInferences: [],
        nextOptions: [],
      },
    }),
  });
  assert.equal(advice.status, "confirmed");
  for (const candidate of [
    { provider: "claude", purpose: "probe", raw: "{}", allowedReferences: [] },
    { provider: "codex", purpose: "advice", raw: "{}" },
    {
      provider: "claude",
      purpose: "task",
      raw,
      taskRole: "executor",
      selectedEffort: "medium",
      allowedReferences: [],
    },
  ]) {
    const rejected = parseProviderResult(
      candidate as Parameters<typeof parseProviderResult>[0],
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.normalizedResult, null);
  }
});

/**
 * 編集・レビューの内容と未知値を検査する。
 * @responsibility 正規値と拒否理由をProvider Envelopeから独立に固定する。
 * @trace ERB-UT-023
 * @precondition 合成内容とgetter反例を使用する。
 * @stimulus 不正Path・field・decision・件数と動的値を渡す。
 * @observation 内容有無、固定理由とgetter呼出し数。
 * @oracle 成功時だけ正規値を返し、未信頼動的値を評価しない。
 * @cleanup N/A: 外部資源なし。
 * @boundary 解析済み値とAI Adapterの応答内容。
 */
test("Task内容は役割別の閉形式・Path・所見相関を維持し、動的値を拒否する", () => {
  const editing = {
    status: "completed",
    summary: "Synthetic",
    changedPaths: ["source.ts"],
    verification: ["checked"],
  };
  assert.ok(inspectTaskResultContent(editing, "executor").normalizedResult);
  for (const changedPaths of [
    ["../outside"],
    ["source.ts", "SOURCE.ts"],
    new Array(1001).fill("x"),
  ])
    assert.equal(
      inspectTaskResultContent({ ...editing, changedPaths }, "executor")
        .normalizedResult,
      null,
    );
  assert.equal(
    inspectTaskResultContent({ ...editing, extra: true }, "executor")
      .normalizedResult,
    null,
  );
  const finding = {
    severity: "medium",
    path: "source.ts",
    category: "implementation_defect",
    criterionNumber: 1,
    message: "Synthetic",
  };
  const review = {
    decision: "changes_requested",
    summary: "Synthetic",
    findings: [finding],
  };
  const result = inspectTaskResultContent(review, "reviewer");
  assert.ok(result.normalizedResult);
  assert.equal("findings" in result.normalizedResult, false);
  assert.equal("remediationCapability" in result.normalizedResult, false);
  for (const candidate of [
    { ...review, decision: "approved" },
    { ...review, findings: [] },
    { ...review, findings: [{ ...finding, criterionNumber: 0 }] },
    { ...review, findings: new Array(65).fill(finding) },
  ])
    assert.equal(
      inspectTaskResultContent(candidate, "reviewer").normalizedResult,
      null,
    );
  let calls = 0;
  const dynamic = Object.defineProperty({ ...finding }, "message", {
    get() {
      calls++;
      return "injected";
    },
  });
  assert.equal(
    inspectTaskResultContent({ ...review, findings: [dynamic] }, "reviewer")
      .normalizedResult,
    null,
  );
  assert.equal(
    inspectTaskResultContent(
      new Proxy(review, {
        ownKeys() {
          calls++;
          throw Error();
        },
      }),
      "reviewer",
    ).normalizedResult,
    null,
  );
  assert.equal(calls, 0);
});

/**
 * 公開計画で参照と固定Schemaを送信前に解決する。
 * @trace ERB-UT-023
 * @precondition 合成Model選定だけを使用する。
 * @stimulus 正規参照、空・動的参照、旧Schema入力を渡す。
 * @observation 状態・凍結配列とhook件数。
 * @oracle 不正入力は計画拒否、元配列変更は計画へ伝播しない。
 * @cleanup N/A: 値だけ。
 */
test("公開Planは許可参照を事前解決し旧Schemaと動的入力を拒否する", () => {
  const references = ["synthetic"];
  const request = {
    provider: "claude" as const,
    purpose: "advice" as const,
    modelSelection: {
      provider: "claude" as const,
      modelIdentifier: "opus",
      identifierKind: "alias" as const,
      reasoningEffort: "medium" as const,
    },
    allowedReferences: references,
  };
  const plan = planExecution(request);
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") throw Error("fixture_plan_blocked");
  references[0] = "changed";
  assert.deepEqual(plan.plan.allowedReferences, ["synthetic"]);
  assert.ok(Object.isFrozen(plan.plan.allowedReferences));
  assert.equal(
    planExecution({ ...request, allowedReferences: [] }).status,
    "blocked",
  );
  let hooks = 0;
  const dynamic = Object.defineProperty([], "0", {
    get() {
      hooks++;
      return "synthetic";
    },
    enumerable: true,
  });
  assert.equal(
    planExecution({ ...request, allowedReferences: dynamic }).status,
    "blocked",
  );
  assert.equal(
    planExecution({
      ...request,
      resultSchema: { type: "string" },
    } as unknown as import("../../../src/index.ts").ExecutionRequest).status,
    "blocked",
  );
  assert.equal(hooks, 0);
});

/**
 * 公開解析は元計画へ相関した内容だけを返す。
 * @trace ERB-UT-023
 * @trace ERB-UT-032
 * @precondition 同一Planと合成Claude出力を使用する。
 * @stimulus 正常・非0・別context・コピーPlanを渡す。
 * @observation 型付き内容と拒否理由。
 * @oracle 別用途や参照の差替えを拒否し、原本管理は追加しない。
 * @cleanup N/A: 値だけ。
 */
test("公開解析は元Planの内容と失敗を解決しcontext差替えを拒否する", () => {
  const plan = planExecution({
    provider: "claude",
    purpose: "advice",
    modelSelection: {
      provider: "claude",
      modelIdentifier: "opus",
      identifierKind: "alias",
      reasoningEffort: "medium",
    },
    allowedReferences: ["synthetic"],
  });
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") throw Error("fixture_plan_blocked");
  const observation = {
    exitCode: 0,
    stderr: "",
    stdout: JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      num_turns: 1,
      total_cost_usd: 0,
      structured_output: {
        status: "completed",
        facts: [{ text: "Synthetic.", references: ["synthetic"] }],
        sharedAnalysis: [],
        additionalInferences: [],
        nextOptions: [],
      },
    }),
  };
  assert.equal(parseProviderResult(plan, observation).status, "confirmed");
  assert.equal(
    parseProviderResult(
      JSON.parse(JSON.stringify(plan)) as ExecutionPlan,
      observation,
    ).status,
    "confirmed",
  );
  for (const change of [
    { provider: "codex" },
    { purpose: "probe" },
    { allowedReferences: ["other"] },
  ]) {
    const candidate = {
      ...plan,
      plan: {
        ...plan.plan,
        resultContext: { ...plan.plan.resultContext, ...change },
      },
    } as unknown as ExecutionPlan;
    assert.equal(parseProviderResult(candidate, observation).status, "blocked");
  }
  const failed = parseProviderResult(plan, {
    exitCode: 1,
    stderr: "",
    stdout: JSON.stringify({
      type: "result",
      subtype: "error_max_budget_usd",
      is_error: true,
    }),
  });
  assert.equal(failed.status, "blocked");
  if (failed.status === "blocked")
    assert.equal(failed.reason, "provider_operation_budget_exceeded");
});

/**
 * 認証も同じ公開入口で終了観測を含めて解釈する。
 * @trace ERB-UT-016
 * @precondition 合成の認証JSONだけ。
 * @stimulus exit 0、null、非0、正規未ログインを渡す。
 * @observation confirmed／unknown／unconfirmed。
 * @oracle 成功文面だけでは成功としない。
 * @cleanup N/A: 値だけ。
 */
test("共通解析は認証の終了不明と正規未ログインを区別する", () => {
  const plan = getAuthenticationDefinition("claude");
  const output = {
    stdout: JSON.stringify({
      loggedIn: true,
      authMethod: "claude.ai",
      apiProvider: "firstParty",
      forcedLoginMethod: "claudeai",
      subscriptionType: "max",
    }),
    stderr: "",
    exitCode: 0,
  };
  assert.equal(parseProviderResult(plan, output).status, "confirmed");
  for (const exitCode of [null, 1, 2])
    assert.equal(
      parseProviderResult(plan, { ...output, exitCode }).status,
      "unknown",
    );
  assert.equal(
    parseProviderResult(plan, {
      stdout: JSON.stringify({ loggedIn: false }),
      stderr: "",
      exitCode: 1,
    }).status,
    "unconfirmed",
  );
});
