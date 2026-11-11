/**
 * 新品Repository-local Storeと固定記録を試験へ供給する。
 * @packageDocumentation
 * @responsibility 今回作成したexact Rootだけを終了hookで回収し、既存履歴を読まない。
 * @trace ERP-IT-001
 * @trace ERP-IT-002
 * @trace ERP-IT-003
 * @trace ERP-IT-005
 * @trace ERP-IT-006
 * @trace ERP-IT-007
 * @level IT
 * @scope 公開保存・Group・検索試験の新品Store。
 * @boundary Repository内.crdd/testsの自己生成Root。清掃失敗はhookの失敗として保持する。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TestContext } from "node:test";
import type { ExecutionCompleteInput, StoreOptions } from "../../src/index.ts";
/**
 * 固定親配下に今回Storeを作り、終了hookで親境界を確認して自己生成Rootを削除する。削除失敗は試験へ伝播する。
 * @trace ERP-IT-001
 * @trace ERP-IT-002
 * @trace ERP-IT-003
 * @trace ERP-IT-005
 * @trace ERP-IT-006
 * @trace ERP-IT-007
 */
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
/**
 * 終了時刻とstatus以外を固定し、通常保持の合成終了値を作る。実AIの観測値ではない。
 * @trace ERP-IT-001
 * @trace ERP-IT-006
 * @trace ERP-IT-007
 */
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
