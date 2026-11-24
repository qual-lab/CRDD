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
import { readFileSync } from "node:fs";
import test from "node:test";
import { captureArchitectureDocument } from "../../../src/architecture/parse.ts";
import {
  compileSemanticIr,
  createSemanticBundle,
  createSemanticCoverageGraph,
  inspectArchitectureConsistency,
  parseArchitectureDetail,
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
  const model = observeArchitectureFixture(
    parseArchitectureDetail(
      { path: document.path, content: document.source },
      "sample",
      { checklistSource: architectureChecklistFixture("detail", null) },
    ),
    false,
    "detail",
  ).result;
  const first = compileSemanticIr(model, "sample", new Set(["ARCH-000008"]));
  assert.deepEqual(
    first,
    compileSemanticIr(model, "sample", new Set(["ARCH-000008"])),
  );
  assert.equal(first.status, "complete");
  assert.ok(first.result);
  const graph = createSemanticCoverageGraph([first.result], [], [], []);
  assert.equal(graph.status, "complete");
  assert.ok(graph.result);
  const bundle = createSemanticBundle([first.result], graph.result);
  assert.equal(bundle.contract, "crdd/semantic-coverage-pilot-bundle");
  assert.equal(bundle.contractRevision, 0);
  const irSchema = JSON.parse(
    readFileSync(
      new URL(
        "../../../../../template/tools/schemas/semantic-ir-pilot-schema.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const bundleSchema = JSON.parse(
    readFileSync(
      new URL(
        "../../../../../template/tools/schemas/semantic-coverage-pilot-schema.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const embeddedIr = bundleSchema.$defs.semanticIr;
  assert.deepEqual(embeddedIr.properties, irSchema.properties);
  assert.deepEqual(embeddedIr.required, irSchema.required);
  assert.deepEqual(bundleSchema.$defs.meaning, irSchema.$defs.meaning);
  assert.deepEqual(
    Object.keys(first.result).sort(),
    [...irSchema.required].sort(),
  );
  assert.match(
    first.result.subsystem,
    new RegExp(irSchema.properties.subsystem.pattern, "u"),
  );
  assert.equal(
    first.result.sourceDocument.length >=
      irSchema.properties.sourceDocument.minLength,
    true,
  );
  assert.equal(bundleSchema.properties.semanticIrs.minItems, 1);
  assert.equal("maxItems" in bundleSchema.properties.semanticIrs, false);
  const rows = bundleSchema.$defs.coverage.properties.meanings.items;
  const row = bundle.coverage.meanings[0];
  assert.ok(row);
  assert.equal(rows.additionalProperties, false);
  assert.deepEqual(Object.keys(row).sort(), [...rows.required].sort());
  assert.deepEqual(rows.properties.verificationMode.enum, [
    "automated",
    "manual",
  ]);
  assert.deepEqual(rows.properties.testObservation.enum, [
    "observed",
    "unobserved",
    "manual_pending",
  ]);
  assert.equal(row.verificationMode, "manual");
  assert.equal(row.testObservation, "manual_pending");
  assert.deepEqual(row.qualityLocalIds, []);
  assert.equal("minItems" in rows.properties.qualityLocalIds, false);
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
    observeArchitectureFixture(
      parseArchitectureDetail(
        { path: "sample.md", content: "# 欠測" },
        "sample",
        { checklistSource: architectureChecklistFixture("detail", null) },
      ),
      false,
      "detail",
    ).result,
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

/** 本文条件の既存反証へ独立したChecklist断面を与える試験準備。@trace RCM-UT-002 */
function architectureChecklistFixture(
  kind: "analysis_ui" | "analysis_spec" | "definition" | "detail",
  failure: unknown,
) {
  const expected = captureArchitectureDocument(
    { path: "checklist.md", content: "" },
    { kind, mode: "evaluated" },
  ).checklistContract.expectedItems;
  return {
    path: "checklist.md",
    content: failure
      ? ""
      : `## Checklist\n${expected.map((item) => `- [x] ${item}`).join("\n")}`,
  };
}
/** 局所ParseとReady横断比較を一回ずつ行う試験専用の観測。@trace RCM-UT-002 */
function observeArchitectureFixture<
  T extends {
    result: {
      hasUnresolvedResults: boolean;
      source: { path: string };
      checklistContract: { failure: unknown };
    };
    issues: readonly import("../../../src/artifact/types.ts").DocumentIssue[];
  },
>(
  parsed: T,
  isReady: boolean,
  documentType: "analysis" | "definition" | "detail",
) {
  const issues = inspectArchitectureConsistency({
    kind: "architecture_readiness",
    document: parsed as never,
    isReady,
    documentType,
  });
  return { ...parsed, status: issues.length ? "partial" : "complete", issues };
}
