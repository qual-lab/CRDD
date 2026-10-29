/**
 * 編集試験のPackage直結・実Git・Domain保存を外部実行なしで確認する。
 * @packageDocumentation
 * @responsibility Docker観測だけを合成化し、AI開始を禁止して既存事前確認を駆動する。
 * @trace ERB-IT-021
 * @boundary 試験専用子Process→Coordinator／Domain／Version Control。HTTPなし。
 * @security Provider資格・外部AI・実Dockerへ接続しない。
 */
import assert from "node:assert/strict";
import { mock } from "node:test";

const coordinatorUrl = new URL(
  "../../../coordinator/src/index.ts",
  import.meta.url,
);
const coordinator = await import(coordinatorUrl.href);
let workspaceCalls = 0;
await mock.module(coordinatorUrl.href, {
  namedExports: {
    ...coordinator,
    openTaskSession: (
      ...args: Parameters<typeof coordinator.openTaskSession>
    ) => {
      const session = coordinator.openTaskSession(...args);
      return {
        ...session,
        start: async () => {
          throw Error("external_ai_forbidden");
        },
      };
    },
    executeWorkspace: (
      ...args: Parameters<typeof coordinator.executeWorkspace>
    ) => {
      workspaceCalls++;
      return coordinator.executeWorkspace(...args);
    },
  },
});
const inventoryUrl = new URL(
  "../../scripts/ai-verification-http.ts",
  import.meta.url,
);
const inventory = await import(inventoryUrl.href);
let inventoryCalls = 0;
await mock.module(inventoryUrl.href, {
  namedExports: {
    ...inventory,
    observeVerificationDockerInventory: () => {
      inventoryCalls++;
      return {
        containers: [],
        networks: ["bridge", "host", "none"].map((name, index) => ({
          id: String(index + 1).repeat(64),
          name,
          driver: name === "none" ? "null" : name,
          scope: "local",
          defaultBridge: name === "bridge",
          configurationHash: "a".repeat(64),
        })),
      };
    },
  },
});
process.argv.splice(2, process.argv.length - 2, "--preflight");
await import("../../scripts/verify-workspace-ai.ts");
assert.equal(process.exitCode, 0);
assert.equal(inventoryCalls, 2);
assert.equal(workspaceCalls, 8);
