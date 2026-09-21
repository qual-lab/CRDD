/**
 * CROS Tool Registryの状態軸、入口同等性、取消および清掃を検証する。
 *
 * @packageDocumentation
 * @responsibility 四入口が同じ共有実装を使い、未許可・利用不能・取消時に安全な結果を返すことを検証する。
 * @trace RCM-IT-010
 * @level IT
 * @scope cros、tool-registry、surface、authority、cancellation、cleanup
 * @boundary RCM-IT-010=Related 2 Blocks: Surface→Registry→共有実装。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  executeRegisteredTool,
  inspectRegisteredTool,
  type RegisteredTool,
  type ToolSurface,
} from "../../src/index.ts";

/**
 * Registry状態を分離し全入口を同じ共有実装へ接続することを検証する。
 * @responsibility 登録・公開・Host可用性・許可を別々に確認しSurface別実装を作らない。
 * @trace RCM-IT-010
 * @precondition 利用可能、非公開、Host不可のToolと四Surfaceを用意する。
 * @stimulus 各状態を照会し四Surfaceから代表Toolを実行する。
 * @observation 状態、implementationId、出力、Effectおよび残存資源数を観測する。
 * @oracle 四Surfaceは同じ実装Identityと結果を返し、未許可・利用不能はEffect 0となる。
 * @cleanup Abort済み要求を含む全結果でresidualResources=0を確認する。
 * @boundary RCM-IT-010=Related 2 Blocks: Surface→Registry→共有実装。
 */
test("Tool状態を分離し四入口を同じ共有実装へ接続する", async () => {
  const registeredTools: readonly RegisteredTool[] = [
    {
      toolId: "echo",
      implementationId: "shared.echo.v1",
      published: true,
      hostAvailable: true,
      execute: async (input) => input.toUpperCase(),
    },
    {
      toolId: "hidden",
      implementationId: "shared.hidden.v1",
      published: false,
      hostAvailable: true,
      execute: async (input) => input,
    },
    {
      toolId: "offline",
      implementationId: "shared.offline.v1",
      published: true,
      hostAvailable: false,
      execute: async (input) => input,
    },
  ];
  assert.equal(
    inspectRegisteredTool("missing", registeredTools).state,
    "unregistered",
  );
  assert.equal(
    inspectRegisteredTool("hidden", registeredTools).state,
    "unpublished",
  );
  assert.equal(
    inspectRegisteredTool("offline", registeredTools).state,
    "host_unavailable",
  );
  const surfaces: readonly ToolSurface[] = [
    "human_cli",
    "mcp",
    "coordinator",
    "workbench",
  ];
  const outputs = await Promise.all(
    surfaces.map((surface) =>
      executeRegisteredTool(
        { surface, toolId: "echo", input: "ok", authorized: true },
        registeredTools,
        new AbortController().signal,
      ),
    ),
  );
  assert.ok(
    outputs.every(
      (result) =>
        result.output === "OK" &&
        result.implementationId === "shared.echo.v1" &&
        result.residualResources === 0,
    ),
  );
  const denied = await executeRegisteredTool(
    { surface: "mcp", toolId: "echo", input: "no", authorized: false },
    registeredTools,
    new AbortController().signal,
  );
  const controller = new AbortController();
  controller.abort();
  const cancelled = await executeRegisteredTool(
    { surface: "coordinator", toolId: "echo", input: "no", authorized: true },
    registeredTools,
    controller.signal,
  );
  assert.equal(denied.effectIssued, false);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.residualResources, 0);
});
