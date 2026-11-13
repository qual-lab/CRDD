/**
 * 判断操作の閉形式搬送を検証する。
 * @packageDocumentation
 * @responsibility 旧Bearerや主体自己指定を入力として認めない。
 * @trace PRL-UT-007
 * @trace PRL-UT-015
 * @level UT
 * @scope decision、protocol
 * @boundary PRL-UT-007=Pure Value: 操作JSON→閉形式検査
 */
import assert from "node:assert/strict";
import test from "node:test";
import { inspectCoordinatorDecisionRequest } from "../../../src/decision/request.ts";

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

/**
 * @trace PRL-UT-015
 * @responsibility 回答コメントを容量で拒否せず選択肢は検査する。
 * @precondition 有効な判断対象を使う。
 * @stimulus 長いコメントと正常／未知の選択肢を渡す。
 * @observation 受理値又はnull。
 * @oracle 正常コメントは全量保持し未知選択肢は拒否する。
 * @cleanup 外部資源なし。
 * @boundary Coordinator入力検査だけ。
 */
test("回答コメントは旧上限を超えても選択肢を検査する", () => {
  const base = {
    decisionId: "decision-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    generation: 2,
    repositoryRevision: "b".repeat(40),
  };
  const accepted = inspectCoordinatorDecisionRequest({
    ...base,
    operation: "answer",
    selectedOption: "resume",
    comment: "c".repeat(1025),
  });
  assert.ok(accepted);
  assert.equal(
    accepted.operation === "answer" ? accepted.comment : null,
    "c".repeat(1025),
  );
  assert.equal(
    inspectCoordinatorDecisionRequest({
      ...base,
      operation: "answer",
      selectedOption: "unknown",
      comment: "c".repeat(1025),
    }),
    null,
  );
});
