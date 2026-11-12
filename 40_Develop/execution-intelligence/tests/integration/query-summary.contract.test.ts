/**
 * 実記録の検索・ページと集計母集合、欠測・単位の分離を確認する。
 * @packageDocumentation
 * @responsibility 完全一致・半開期間・欠測／非該当／0・異単位を検証し、品質評価を推定しない。
 * @trace ERP-IT-007
 * @level IT
 * @scope EI公開API・実Store・検索と集計。
 * @boundary 自己生成Storeへ固定記録を保存して照会する。fixture終了時にexact Rootを回収する。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  completeExecution,
  createExecution,
  type ExecutionQuery,
  getExecution,
  listExecutions,
  summarizeExecutions,
} from "../../src/index.ts";
import { completion, fixture, startedAt } from "../fixtures/store.ts";

/**
 * 長い本文と大きいMetadataを保存・再読・検索で同じ契約へ接続する。
 * @trace ERP-IT-007
 * @precondition fixtureが所有する新品Storeだけを使う。
 * @stimulus 8193文字のcontext・値、65field、129文字keyと同量の不正形を渡す。
 * @observation 現行記録と検索母集合、Schema・NULの拒否。
 * @oracle 各経路で量だけを再拒否せず不正型は拒否する。
 * @cleanup fixtureの既存hookがexact Rootを回収する。
 */
test("長い記録とMetadataは保存後も全量検索できる", (t) => {
  const s = fixture(t);
  const application = "a".repeat(8193);
  const metadata = Object.fromEntries(
    Array.from({ length: 65 }, (_, index) => [
      `key-${index}-${"k".repeat(129)}`,
      `value-${index}-${"v".repeat(8193)}`,
    ]),
  );
  assert.equal(
    createExecution(s, {
      executionId: "large-record",
      startedAt,
      application,
      metadata,
    }).status,
    "completed",
  );
  const observed = getExecution(s, "large-record");
  assert.equal(observed.status, "completed");
  if (observed.status === "completed") {
    assert.equal(observed.value?.application, application);
    assert.deepEqual({ ...observed.value?.metadata }, metadata);
  }
  const found = listExecutions(s, { application, metadata });
  assert.equal(found.status, "completed");
  if (found.status === "completed") assert.equal(found.value.total, 1);
  assert.equal(
    createExecution(s, {
      executionId: "invalid-nul",
      startedAt,
      metadata: { note: "x\0" },
    }).status,
    "blocked",
  );
  assert.equal(
    listExecutions(s, {
      metadata: { invalid: {} },
    } as unknown as ExecutionQuery).status,
    "blocked",
  );
});
/** 複数記録の絞込み・ページと全母集合の集計値を対照し、入力履歴を変更しない。
 * @trace ERP-IT-007
 */
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
/** 異なる単位・費用種別・出所の値を保存し、別集計になることを確認する。
 * @trace ERP-IT-007
 */
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
  /** 不正な条件を渡し、条件無視による全件取得ではなくblockedになることを確認する。
   * @trace ERP-IT-007
   */
  test("検索の不正入力で対象を全件へ拡張しない", (t) => {
    assert.equal(
      listExecutions(fixture(t), query as unknown as ExecutionQuery).status,
      "blocked",
    );
  });
}
/** 未指定・欠測・非該当・取得済み0を対照し、それぞれの件数と合計を確認する。
 * @trace ERP-IT-007
 */
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
