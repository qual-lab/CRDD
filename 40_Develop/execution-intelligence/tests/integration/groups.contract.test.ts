/**
 * Group終了と子の未完了・期限保護を実Filesystemで確認する。
 * @packageDocumentation
 * @responsibility 終了Groupと保持対象の子の参照を保全し、状態を自動伝播しないことを反証する。
 * @trace ERP-IT-006
 * @level IT
 * @scope EI公開記録・検索、今回作成するStore。
 * @boundary 公開APIから実Storeまで。AI・Dockerは使わずfixture終了時に自己生成Rootを回収する。
 */
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

/** Groupなし・未知Group・終了Groupを対照し、許可された参照だけ保存されることを確認する。
 * @trace ERP-IT-006
 */
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
  /** 期限をまたぐ子の状態を変え、保持対象の子とGroupの参照が残ることを確認する。
   * @trace ERP-IT-006
   */
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
/** 同内容再送と異内容競合、一覧拒否を対照し、既存内容の不変性を確認する。
 * @trace ERP-IT-006
 */
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
