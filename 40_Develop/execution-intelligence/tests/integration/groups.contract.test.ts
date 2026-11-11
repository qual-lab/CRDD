/** Group終了と子の未完了・保持を独立に扱う実Filesystem試験。 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGroup,
  completeGroup,
  createExecution,
  completeExecution,
  getGroup,
  getExecution,
  summarizeExecutions,
  listGroups,
} from "../../src/index.ts";
import { fixture, startedAt, completion } from "../fixtures/store.ts";

test("Groupなし実行を許可し、未知Groupと終了済みGroupへの追加を拒否", (t) => {
  const s = fixture(t);
  assert.equal(
    createExecution(s, { executionId: "single", startedAt }).status,
    "completed",
  );
  assert.equal(
    createExecution(s, { executionId: "bad", groupId: "g", startedAt }).reason,
    "group_not_open",
  );
  assert.equal(createGroup(s, { groupId: "g", startedAt }).status, "completed");
  assert.equal(
    completeGroup(s, "g", {
      endedAt: completion().endedAt,
      status: "completed",
    }).status,
    "completed",
  );
  assert.equal(
    createExecution(s, { executionId: "late", groupId: "g", startedAt }).reason,
    "group_not_open",
  );
});
for (const mode of ["open", "unresolved", "unknown", "standard"] as const) {
  test(`終了Groupの期限超過時も${mode}子との参照条件を守る`, (t) => {
    const s = { ...fixture(t), retentionDays: 1 };
    createGroup(s, { groupId: "g", startedAt });
    createExecution(s, { executionId: "child", groupId: "g", startedAt });
    if (mode !== "open")
      completeExecution(
        s,
        "child",
        completion({
          retention: mode === "unresolved" ? "unresolved" : "standard",
          outcome: { status: mode === "unknown" ? "unknown" : "completed" },
        }),
      );
    assert.equal(
      completeGroup(s, "g", {
        endedAt: completion().endedAt,
        status: "completed",
      }).status,
      "completed",
    );
    assert.equal(
      createExecution(s, {
        executionId: "fresh",
        startedAt: new Date().toISOString(),
      }).status,
      "completed",
    );
    const group = getGroup(s, "g"),
      child = getExecution(s, "child");
    assert.equal(group.status, "completed");
    assert.equal(child.status, "completed");
    if (group.status === "completed" && child.status === "completed") {
      assert.equal(group.value !== null, mode !== "standard");
      assert.equal(child.value !== null, mode !== "standard");
      if (mode === "open") assert.equal(child.value?.state, "open");
    }
    const summary = summarizeExecutions(s, { groupId: "g" });
    assert.equal(summary.status, "completed");
    if (summary.status === "completed" && mode === "open") {
      assert.equal(summary.value.openCount, 1);
      assert.equal(summary.value.successRate, null);
    }
  });
}
test("Groupの再送は同一内容だけを許可し、一覧の失敗条件を維持", (t) => {
  const s = fixture(t),
    g = { groupId: "g", startedAt };
  createGroup(s, g);
  assert.equal(createGroup(s, g).reason, "record_already_created");
  assert.equal(
    createGroup(s, { ...g, application: "different" }).reason,
    "record_identity_conflict",
  );
  const end = { endedAt: completion().endedAt, status: "completed" as const };
  completeGroup(s, "g", end);
  assert.equal(completeGroup(s, "g", end).reason, "record_already_completed");
  assert.equal(
    completeGroup(s, "g", { ...end, status: "failed" }).reason,
    "record_completion_conflict",
  );
  const list = listGroups(s);
  assert.equal(list.status, "completed");
  if (list.status === "completed") assert.equal(list.value.total, 1);
});
