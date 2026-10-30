/**
 * Provider共通のTask応答内容Ownerが閉形式を検査する。
 * @packageDocumentation
 * @responsibility 編集Pathとレビュー判断・所見の相関を反証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 合成値のみ。AI・Docker・保存なし。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { inspectTaskResultContent } from "../../../src/index.ts";

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
  const { parseProviderResult } = await import("../../../src/index.ts");
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
