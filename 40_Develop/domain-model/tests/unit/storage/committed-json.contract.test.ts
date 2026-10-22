/**
 * 共通保存が私有する削除四状態を検証する。
 * @packageDocumentation
 * @responsibility 既存分類の全組合せを確認し、試験のためにRoot APIを増やさない。
 * @trace PRL-UT-006
 * @level UT
 * @scope Domain Modelの削除状態分類。
 * @boundary 純粋分類だけ。実保存・実回復成立はITで確認する。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

/**
 * 私有分類の本体をそのまま全四入力へ適用する。
 * @responsibility 既知三状態と第三状態拒否を維持する。
 * @trace PRL-UT-006
 * @precondition 現行Sourceに同じ純粋分類が存在する。
 * @stimulus content／commitの存在四組合せを渡す。
 * @observation 返却される閉じた状態文字列。
 * @oracle 実装の推測値でなく固定期待値と一致する。
 * @cleanup VMの局所値のみ。Filesystem書込みなし。
 * @boundary Source読取りと純粋関数評価。実I/Oの完了証明ではない。
 */
test("削除分類は到達可能三状態だけを処理し不整合組を拒否する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/storage/committed-json.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("function classifyCommittedPairDeleteState(");
  assert.ok(start >= 0);
  const classify = vm.runInNewContext(
    `(${stripTypeScriptTypes(source.slice(start))})`,
  ) as (content: boolean, commit: boolean) => string;
  assert.equal(classify(true, true), "remove_content");
  assert.equal(classify(false, true), "remove_commit");
  assert.equal(classify(false, false), "complete");
  assert.equal(classify(true, false), "third_state");
});
