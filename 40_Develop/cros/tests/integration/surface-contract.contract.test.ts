/**
 * 四公開SurfaceのApplication Contract同等性を検証する。
 *
 * @packageDocumentation
 * @responsibility TS API、CLI、MCP、Workbenchが同じ結果意味、Authority、正本Effectおよび取消後条件を持つことを検証する。
 * @trace EST-IT-010
 * @level IT
 * @scope cros、surface、application-contract、canonical-owner
 * @boundary EST-IT-010=Related 2 Blocks: Surface Adapter→Application Contract→Canonical Owner。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  bindOperationSurface,
  createSurfaceApplicationContract,
} from "../../src/index.ts";

/**
 * TS API、CLI、MCP、Workbenchが同じApplication Contractへ接続することを検証する。
 * @responsibility 四入口の正常、拒否、部分結果、取消と正本Effectを同じOracleで比較する。
 * @trace EST-IT-010
 * @precondition 各入口へ独立した同一RevisionのCanonical Owner fixtureを与える。
 * @stimulus 各入口から同じapply、Authority拒否、missing inspect、cancelを実行する。
 * @observation 構造結果、Revision、Owner Effect件数および残存資源数を観測する。
 * @oracle 全入口の結果が一致し、正常時だけ正本Effect 1、その他はEffect 0となる。
 * @cleanup 入口固有Storeと取消後残存資源が0であることを確認する。
 * @boundary EST-IT-010=Related 2 Blocks: Surface Adapter→Application Contract→Canonical Owner。
 */
test("四入口が同じApplication ContractとCanonical Ownerを使用する", () => {
  const surfaces = ["ts-api", "cli", "mcp", "workbench"] as const;
  const stores = surfaces.map(() => ({
    revision: "r1",
    value: null as string | null,
    writes: 0,
  }));
  const adapters = surfaces.map((surface, index) => {
    const store = stores[index] as (typeof stores)[number];
    const contract = createSurfaceApplicationContract(
      {
        inspect: () => ({ revision: store.revision, value: store.value }),
        apply: (input) => {
          if (input.revision !== store.revision) return false;
          store.value = input.value;
          store.revision = "r2";
          store.writes += 1;
          return true;
        },
      },
      "write",
    );
    return bindOperationSurface(surface, contract);
  });
  const observedResults = adapters.map((adapter, index) => {
    const partial = adapter.performSurfaceOperation({
      operationId: `${adapter.surface}-inspect`,
      revision: "r1",
      authority: "read",
      action: "inspect",
      value: null,
    });
    const rejected = adapter.performSurfaceOperation({
      operationId: `${adapter.surface}-reject`,
      revision: "r1",
      authority: "read",
      action: "apply",
      value: "candidate",
    });
    const cancelled = adapter.performSurfaceOperation({
      operationId: `${adapter.surface}-cancel`,
      revision: "r1",
      authority: "write",
      action: "cancel",
      value: "candidate",
    });
    const completed = adapter.performSurfaceOperation({
      operationId: `${adapter.surface}-apply`,
      revision: "r1",
      authority: "write",
      action: "apply",
      value: "accepted",
    });
    return {
      partial: { ...partial, revision: "normalized" },
      rejected: { ...rejected, revision: "normalized" },
      cancelled: { ...cancelled, revision: "normalized" },
      completed: { ...completed, revision: "normalized" },
      writes: stores[index]?.writes,
      value: stores[index]?.value,
    };
  });
  for (const value of observedResults.slice(1))
    assert.deepEqual(value, observedResults[0]);
  assert.equal(observedResults[0]?.writes, 1);
  assert.equal(observedResults[0]?.value, "accepted");
  assert.equal(observedResults[0]?.partial.status, "partial");
  assert.equal(observedResults[0]?.rejected.ownerEffectCount, 0);
  assert.equal(observedResults[0]?.cancelled.residualResourceCount, 0);
});
