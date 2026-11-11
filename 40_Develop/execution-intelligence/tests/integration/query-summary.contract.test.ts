/** 検索・ページと集計母集合、欠測・単位の分離。業務評価は行わない。 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createExecution,
  completeExecution,
  listExecutions,
  summarizeExecutions,
  type ExecutionQuery,
} from "../../src/index.ts";
import { fixture, startedAt, completion } from "../fixtures/store.ts";
test("外部Context・Providerで絞り込み、Summaryはページに限定しない", (t) => {
  const s = fixture(t);
  for (const id of ["a", "b", "c"]) {
    createExecution(s, {
      executionId: id,
      startedAt,
      application: "app",
      role: "writer",
      metadata: { taskId: id === "c" ? "other" : "shared" },
      configuration: {
        provider: { state: "observed", value: "provider", source: "fixture" },
      },
    });
    if (id !== "b")
      completeExecution(
        s,
        id,
        completion({
          usage: {
            inputTokens: {
              state: "observed",
              value: id === "a" ? 0 : 8,
              source: "fixture",
            },
          },
        }),
      );
  }
  const query = {
    application: "app",
    provider: "provider",
    metadata: { taskId: "shared" },
    limit: 1,
  };
  const found = listExecutions(s, query);
  assert.equal(found.status, "completed");
  if (found.status === "completed") {
    assert.equal(found.value.total, 2);
    assert.equal(found.value.executions.length, 1);
  }
  const summary = summarizeExecutions(s, query);
  assert.equal(summary.status, "completed");
  if (summary.status === "completed") {
    assert.equal(summary.value.executionCount, 2);
    assert.equal(summary.value.openCount, 1);
    assert.deepEqual(summary.value.measurements.inputTokens, {
      observedCount: 1,
      missingCount: 1,
      notApplicableCount: 0,
      total: 0,
    });
    assert.equal(summary.value.successDenominator, 1);
    assert.equal(summary.value.measurements.providerDurationMs?.total, null);
  }
});
test("通貨・Credit・報告額・推定額を混ぜない", (t) => {
  const s = fixture(t);
  const values = [
    { unit: "USD", kind: "currency", source: "reported" },
    { unit: "USD", kind: "currency", source: "estimated" },
    { unit: "JPY", kind: "currency", source: "reported" },
    { unit: "credits", kind: "credit", source: "reported" },
  ] as const;
  values.forEach((value, i) => {
    createExecution(s, { executionId: `e${i}`, startedAt });
    completeExecution(
      s,
      `e${i}`,
      completion({
        usage: {
          cost: {
            state: "observed",
            value: { ...value, amount: 1 },
            source: "fixture",
          },
        },
      }),
    );
  });
  const summary = summarizeExecutions(s);
  assert.equal(summary.status, "completed");
  if (summary.status === "completed")
    assert.equal(summary.value.costs.length, 4);
});
for (const query of [
  { limit: 0 },
  { offset: -1 },
  { period: { fromInclusive: "invalid", toExclusive: "invalid" } },
  { period: null },
  { period: { fromInclusive: 2020, toExclusive: 2021 } },
  { period: [] },
  { period: { fromInclusive: startedAt } },
  { period: { fromInclusive: startedAt, toExclusive: startedAt } },
  { unknown: true },
  [],
]) {
  test("検索の不正入力で対象を全件へ拡張しない", (t) => {
    assert.equal(
      listExecutions(fixture(t), query as unknown as ExecutionQuery).status,
      "blocked",
    );
  });
}
test("費用の未指定・未観測・非該当・実測0を別々に集計する", (t) => {
  const s = fixture(t);
  const costs = [
    undefined,
    { state: "not_observed", reason: "missing" },
    { state: "not_applicable", reason: "subscription" },
    {
      state: "observed",
      value: { amount: 0, unit: "USD", kind: "currency", source: "reported" },
      source: "fixture",
    },
  ] as const;
  costs.forEach((cost, i) => {
    createExecution(s, { executionId: `e${i}`, startedAt });
    completeExecution(
      s,
      `e${i}`,
      completion({ ...(cost ? { usage: { cost } } : {}) }),
    );
  });
  const r = summarizeExecutions(s);
  assert.equal(r.status, "completed");
  if (r.status === "completed") {
    assert.equal(r.value.costMissingCount, 2);
    assert.equal(r.value.costNotApplicableCount, 1);
    assert.equal(r.value.costs[0]?.total, 0);
    assert.equal(r.value.costs[0]?.observedCount, 1);
  }
});
