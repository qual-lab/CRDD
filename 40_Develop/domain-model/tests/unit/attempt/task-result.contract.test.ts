/**
 * Task内容のOwnerがProviderに依存せず閉形式を検査する。
 * @packageDocumentation
 * @responsibility 編集Pathとレビュー判断・所見の相関を反証する。
 * @trace RCM-UT-016
 * @level UT
 * @scope 合成値のみ。AI・Docker・保存なし。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { inspectTaskResultContent } from "../../../src/index.ts";

/**
 * 編集・レビューの内容と未知値を検査する。
 * @responsibility 正規値と拒否理由をProvider Envelopeから独立に固定する。
 * @trace RCM-UT-016
 * @precondition 合成内容とgetter反例を使用する。
 * @stimulus 不正Path・field・decision・件数と動的値を渡す。
 * @observation 内容有無、固定理由とgetter呼出し数。
 * @oracle 成功時だけ正規値を返し、未信頼動的値を評価しない。
 * @cleanup N/A: 外部資源なし。
 * @boundary 解析済み値とDomain内容モデル。
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
