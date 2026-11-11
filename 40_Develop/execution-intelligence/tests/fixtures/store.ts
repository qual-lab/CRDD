/** 新品Repository-local fixtureだけを所有・回収する。既存履歴は読まない。 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TestContext } from "node:test";
import type { ExecutionCompleteInput, StoreOptions } from "../../src/index.ts";
export function fixture(t: TestContext): StoreOptions {
  const parent = fileURLToPath(
    new URL("../../../../.crdd/tests/", import.meta.url),
  );
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, "ei-record-"));
  t.after(() => {
    if (path.dirname(directory) !== path.resolve(parent))
      throw Error("fixture_boundary_invalid");
    fs.rmSync(directory, { recursive: true });
  });
  return { directory, retentionDays: 36500 };
}
export const startedAt = "2026-01-01T00:00:00.000Z";
export function completion(
  overrides: Partial<ExecutionCompleteInput> = {},
): ExecutionCompleteInput {
  return {
    endedAt: "2026-01-01T00:00:01.000Z",
    elapsedMs: { state: "observed", value: 1000, source: "fixture" },
    outcome: { status: "completed" },
    retention: "standard",
    ...overrides,
  };
}
