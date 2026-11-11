/**
 * 公開9操作と入力捕捉時のAccessor／Proxy拒否を確認する。
 * @packageDocumentation
 * @responsibility 公開面の余剰と、入力の読取りによる実行を局所的に反証する。
 * @trace ERP-UT-006
 * @level UT
 * @scope Root exportと不正入力の捕捉。AI・Git・Dockerは実行しない。
 * @boundary 同一Process内。未検証Pathへ保存処理が進まないことを結果とGetter呼出数で確認する。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import * as api from "../../src/index.ts";
/** 公開実体を列挙して完成9操作の集合と照合する。型専用exportを実行時の余剰と数えない。
 * @trace ERP-UT-006
 */
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
/** 不正入力とGetter呼出数で副作用前拒否を確認する。未知Pathへ書込みを進めない。
 * @trace ERP-UT-006
 */
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
