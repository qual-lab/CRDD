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
      execute: async (input) => ({
        output: input.toUpperCase(),
        effectState: "issued",
        residualResources: 0,
        recoveryRequired: false,
      }),
    },
    {
      toolId: "hidden",
      implementationId: "shared.hidden.v1",
      published: false,
      hostAvailable: true,
      execute: async (input) => ({
        output: input,
        effectState: "not_issued",
        residualResources: 0,
        recoveryRequired: false,
      }),
    },
    {
      toolId: "offline",
      implementationId: "shared.offline.v1",
      published: true,
      hostAvailable: false,
      execute: async (input) => ({
        output: input,
        effectState: "not_issued",
        residualResources: 0,
        recoveryRequired: false,
      }),
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
  assert.equal(denied.effectState, "not_issued");
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.residualResources, 0);
});

/**
 * Effect発行後の取消と清掃観測不能をfalseへ畳まないことを検証する。
 * @responsibility Tool実装が返したEffect・清掃・回復状態を取消結果へ保持する。
 * @trace RCM-IT-010
 * @precondition 実装がEffect発行後にSignalを取消し、残存資源を観測不能として返す。
 * @stimulus 許可済みToolを実行する。
 * @observation 取消結果のEffect状態、残存資源および回復要否を観測する。
 * @oracle issued、unknown、recoveryRequired=trueが保持される。
 * @cleanup 回復義務を結果へ返し、清掃完了を推定しない。
 * @boundary RCM-IT-010=Related 2 Blocks: 共有実装→取消競合→Registry結果。
 */
test("Effect発行後の取消と清掃観測不能を保持する", async () => {
  const controller = new AbortController();
  const tools: readonly RegisteredTool[] = [
    {
      toolId: "effectful",
      implementationId: "shared.effectful.v1",
      published: true,
      hostAvailable: true,
      execute: async () => {
        controller.abort();
        return {
          output: null,
          effectState: "issued",
          residualResources: "unknown",
          recoveryRequired: true,
        };
      },
    },
  ];
  const result = await executeRegisteredTool(
    {
      surface: "coordinator",
      toolId: "effectful",
      input: "run",
      authorized: true,
    },
    tools,
    controller.signal,
  );
  assert.equal(result.status, "cancelled");
  assert.equal(result.effectState, "issued");
  assert.equal(result.residualResources, "unknown");
  assert.equal(result.recoveryRequired, true);
});
