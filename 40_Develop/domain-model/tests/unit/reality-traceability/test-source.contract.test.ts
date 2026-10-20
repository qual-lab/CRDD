/**
 * skip宣言の既存字句判定を検証する。
 *
 * @packageDocumentation
 * @responsibility 実行されない宣言と引用内の例示の区別を固定する。
 * @trace PPR-UT-017
 * @level UT
 * @scope reality、test-source
 * @boundary PPR-UT-017=N/A: Source文字列の純粋判定。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { hasSkippedTestDeclaration } from "../../../src/index.ts";
/**
 * skipされたTest Placeholderを観測済みEvidenceとして扱わない判定を検証する。
 *
 * @responsibility 実行されないTest宣言と通常Test宣言を決定論的に区別する。
 * @trace PPR-UT-017
 * @precondition test／it／describeのskip例と通常例を固定する。
 * @stimulus skip検出関数へ各Sourceを渡す。
 * @observation 返された真偽値を観測する。
 * @oracle skip例だけtrueとなる。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary PPR-UT-017=Direct Boundary: Domain Test Source→対象契約
 */
test("skipされたTest Placeholderを観測済みEvidenceとして扱わない", () => {
  assert.equal(
    hasSkippedTestDeclaration('test.skip("pending", () => {});'),
    true,
  );
  assert.equal(
    hasSkippedTestDeclaration('it.skip ("pending", () => {});'),
    true,
  );
  assert.equal(
    hasSkippedTestDeclaration('describe.skip("pending", () => {});'),
    true,
  );
  assert.equal(hasSkippedTestDeclaration('test("active", () => {});'), false);
  assert.equal(
    hasSkippedTestDeclaration(
      "const fixture = 'test.skip(\"pending\", () => {})';",
    ),
    false,
  );
});
