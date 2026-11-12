/**
 * Semanticモデルの公開計算を検証する。
 * @packageDocumentation
 * @responsibility IRの決定性と観測不能の非成功化をDomain境界で確認する。
 * @trace PPR-UT-016
 * @trace PPR-UT-017
 * @level UT
 * @scope semantic、ir、coverage
 * @boundary PPR-UT-016=N/A: Process内の値変換。 / PPR-UT-017=N/A: Process内の関係計算。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  compileSemanticIr,
  createSemanticCoverageGraph,
  createSemanticBundle,
} from "../../../src/index.ts";

/**
 * 可視表の意味を決定論的に変換する。
 * @responsibility Domain公開APIだけからIRとBundleの同一性を検証する。
 * @trace PPR-UT-016
 * @precondition 有効な合成意味表を使用する。
 * @stimulus 同じ入力を二回変換する。
 * @observation IR、Graph、Bundle。
 * @oracle 結果が一致し既存Schemaを維持する。
 * @cleanup N/A: 局所値のみ。
 * @boundary N/A: Process内の純粋計算。
 */
test("DomainのSemantic APIは同じ可視表から同じIRとBundleを返す", () => {
  const document = {
    path: "06_Architecture/Details/sample/01_Architecture.md",
    source: [
      "# Sample",
      "## 機械生成する意味要素",
      "| Semantic Key | 種別 | 要求する意味 | Architecture定義 | 検証要否 | 根拠節 | N/A理由 |",
      "|---|---|---|---|---|---|---|",
      "| `sample.value` | `component` | 合成値 | `ARCH-000008` | `N/A` | `## 根拠` | 合成入力 |",
      "",
      "## 根拠",
      "合成入力。",
    ].join("\n"),
  };
  const first = compileSemanticIr(document, "sample", new Set(["ARCH-000008"]));
  assert.deepEqual(
    first,
    compileSemanticIr(document, "sample", new Set(["ARCH-000008"])),
  );
  assert.equal(first.status, "complete");
  assert.ok(first.result);
  const graph = createSemanticCoverageGraph([first.result], [], [], []);
  assert.equal(graph.status, "complete");
  assert.ok(graph.result);
  const bundle = createSemanticBundle([first.result], graph.result);
  assert.equal(bundle.contract, "crdd/semantic-coverage-pilot-bundle");
  assert.equal(bundle.contractRevision, 0);
});

/**
 * 不正入力と前提失敗を中立Issueとして保持する。
 * @responsibility 欠測を空の成功Graphへ畳まないことを検証する。
 * @trace PPR-UT-017
 * @precondition 意味表を持たない文書。
 * @stimulus IR失敗をGraphの前提失敗へ渡す。
 * @observation status、result、issues。
 * @oracle resultはnullで診断code／messageをDomainへ混入させない。
 * @cleanup N/A: 局所値のみ。
 * @boundary N/A: Process内の純粋計算。
 */
test("DomainのSemantic APIは前提失敗を中立Issueのまま保持する", () => {
  const ir = compileSemanticIr(
    { path: "sample.md", source: "# 欠測" },
    "sample",
    new Set(),
  );
  assert.equal(ir.status, "invalid");
  assert.equal(ir.result, null);
  assert.ok(ir.issues.length);
  assert.equal("code" in (ir.issues[0] ?? {}), false);
  assert.equal("message" in (ir.issues[0] ?? {}), false);
  const graph = createSemanticCoverageGraph([], [], [], ir.issues);
  assert.equal(graph.status, "invalid");
  assert.equal(graph.result, null);
  assert.deepEqual(graph.issues, ir.issues);
});
