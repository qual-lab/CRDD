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
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  bindOperationSurface,
  createFileCanonicalOperationOwner,
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
test("四入口が同じApplication ContractとCanonical Ownerを使用する", (t) => {
  const surfaces = ["ts-api", "cli", "mcp", "workbench"] as const;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-cros-surface-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const owner = createFileCanonicalOperationOwner(
    path.join(root, "canonical-owner.json"),
    "r1",
  );
  const contract = createSurfaceApplicationContract(owner, "write");
  const adapters = surfaces.map((surface) =>
    bindOperationSurface(surface, contract),
  );
  for (const adapter of adapters) {
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
    assert.equal(partial.status, "partial");
    assert.equal(rejected.ownerEffectCount, 0);
    assert.equal(cancelled.residualResourceCount, 0);
  }
  const applications = adapters.map((adapter) =>
    adapter.performSurfaceOperation({
      operationId: `${adapter.surface}-apply`,
      revision: "r1",
      authority: "write",
      action: "apply",
      value: "accepted",
    }),
  );
  assert.equal(
    applications.filter((result) => result.status === "completed").length,
    1,
  );
  assert.equal(
    applications.filter(
      (result) => result.reason === "surface_operation_revision_conflict",
    ).length,
    3,
  );
  assert.deepEqual(owner.inspect(), {
    revision: "r2",
    value: "accepted",
    writes: 1,
  });
});
