/**
 * 判断操作の閉形式搬送を検証する。
 * @packageDocumentation
 * @responsibility 旧Bearerや主体自己指定を入力として認めない。
 * @trace PRL-UT-007
 * @level UT
 * @scope decision、protocol
 * @boundary PRL-UT-007=Pure Value: 操作JSON→閉形式検査
 */
import assert from "node:assert/strict";
import test from "node:test";
import { inspectCoordinatorDecisionRequest } from "../../../../domain-model/src/index.ts";

/**
 * 四操作の入力と旧field拒否を確認する。
 * @trace PRL-UT-007
 * @precondition 外部Effectなし。
 * @stimulus 四操作、未知field、getterを検査する。
 * @observation 値又はnull。
 * @oracle 不正入力のgetterを呼ばず拒否する。
 * @cleanup N/A: 値のみ。
 */
test("四操作は閉形式であり旧Bearer・再発行・主体fieldを受け付けない", () => {
  const common = {
    decisionId: "decision-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    generation: 1,
    repositoryRevision: "a".repeat(40),
  };
  for (const op of [
    {
      operation: "request",
      blockerId: "blocker-a",
      queueId: "queue-a",
      question: "継続しますか",
      allowedOptions: ["resume"],
    },
    { operation: "answer", selectedOption: "resume" },
    { operation: "apply" },
    { operation: "close", status: "invalidated", reason: "中止" },
  ]) {
    const value = { ...common, ...op };
    assert.ok(inspectCoordinatorDecisionRequest(value));
    if (op.operation === "request") {
      const { blockerId: _blockerId, ...missing } = value as Record<
        string,
        unknown
      >;
      assert.equal(inspectCoordinatorDecisionRequest(missing), null);
    }
    assert.ok(Object.isFrozen(inspectCoordinatorDecisionRequest(value)));
    for (const key of [
      "continuationCapability",
      "principalId",
      "decisionCapabilityReplacement",
      "lifetimeMs",
      "expiresAt",
    ])
      assert.equal(
        inspectCoordinatorDecisionRequest({ ...value, [key]: "old" }),
        null,
      );
    let reads = 0;
    assert.equal(
      inspectCoordinatorDecisionRequest({
        ...value,
        get unexpected() {
          reads++;
          return "bad";
        },
      }),
      null,
    );
    assert.equal(reads, 0);
  }
  assert.equal(
    inspectCoordinatorDecisionRequest({
      ...common,
      operation: "close",
      status: "expired",
      reason: "旧期限",
    }),
    null,
  );
});
