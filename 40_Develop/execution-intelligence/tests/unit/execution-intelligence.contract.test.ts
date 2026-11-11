/** 公開面と副作用前の入力拒否。AI・Git・Dockerを実行しない。 */
import assert from "node:assert/strict";
import { test } from "node:test";
import * as api from "../../src/index.ts";
test("Rootは9つの完成操作だけを公開する", () => {
  assert.deepEqual(
    Object.keys(api).sort(),
    [
      "createExecution",
      "completeExecution",
      "createGroup",
      "completeGroup",
      "getExecution",
      "listExecutions",
      "getGroup",
      "listGroups",
      "summarizeExecutions",
    ].sort(),
  );
});
test("AccessorとProxyを実行せず拒否する", () => {
  let called = false;
  const input = {
    get executionId() {
      called = true;
      return "e";
    },
    startedAt: "2026-01-01T00:00:00Z",
  };
  assert.equal(
    api.createExecution({ directory: "invalid", retentionDays: 30 }, input)
      .status,
    "blocked",
  );
  assert.equal(called, false);
  const proxy = new Proxy(input, {
    ownKeys() {
      called = true;
      return [];
    },
  });
  assert.equal(
    api.createExecution({ directory: "invalid", retentionDays: 30 }, proxy)
      .status,
    "blocked",
  );
  assert.equal(called, false);
});
