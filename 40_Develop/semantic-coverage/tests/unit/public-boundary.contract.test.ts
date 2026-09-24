/**
 * semantic-coverage:unit:public-boundaryの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility semantic-coverage:unit:public-boundaryが所有する検証責務を実行する。
 * @trace RCM-UT-014
 * @level UT
 * @scope public-boundary、semantic-coverage、consumer-closure
 * @boundary RCM-UT-014=N/A: Packageの公開`index.ts`と利用側importは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as semanticCoverage from "../../src/index.ts";

/**
 * Semantic Coverageは宣言した公開Capabilityだけを公開するを検証する。
 *
 * @responsibility Semantic Coverageは宣言した公開Capabilityだけを公開するの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Semantic Coverageは宣言した公開Capabilityだけを公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=N/A: Packageの公開`index.ts`と利用側importは外部実行境界を持たない。
 */
test("Semantic Coverageは宣言した公開Capabilityだけを公開する", () => {
  assert.deepEqual(Object.keys(semanticCoverage).sort(), [
    "compileQualitySemanticRelations",
    "compileQualitySemanticRelationsFromRepository",
    "compileSemanticIr",
    "compileSemanticIrFromRepository",
    "createFilesystemSemanticBundlePublisher",
    "createSemanticBundle",
    "createSemanticCoverageGraph",
    "mapSemanticDomainIssueToDiagnostic",
    "publishSemanticCoverage",
    "publishSemanticCoverageBundleWithHooks",
  ]);
});

/**
 * Semantic Coverage CLIはSubsystem公開入口だけを利用するを検証する。
 *
 * @responsibility Semantic Coverage CLIはSubsystem公開入口だけを利用するの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Semantic Coverage CLIはSubsystem公開入口だけを利用するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=N/A: Packageの公開`index.ts`と利用側importは外部実行境界を持たない。
 */
test("Semantic Coverage CLIはSubsystem公開入口だけを利用する", () => {
  const source = fs.readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../bin/compile-semantic-coverage-pilot.ts",
    ),
    "utf8",
  );
  const subsystemImports = [
    ...source.matchAll(/from\s+["'](\.\.\/src\/[^"']+)["']/gu),
  ].map((match) => match[1]);
  assert.deepEqual(subsystemImports, ["../src/index.ts"]);
});

/**
 * Semantic Coverageの中立IssueはSurface固有語彙を含まないを検証する。
 *
 * @responsibility Semantic Coverageの中立IssueはSurface固有語彙を含まないの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Semantic Coverageの中立IssueはSurface固有語彙を含まないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=N/A: Packageの公開`index.ts`と利用側importは外部実行境界を持たない。
 */
test("Semantic Coverageの中立IssueはSurface固有語彙を含まない", () => {
  const outcome = semanticCoverage.compileSemanticIr(
    { path: "06_Architecture/Details/sample.md", source: "# Sample\n" },
    "sample",
    new Set(["ARCH-000001"]),
  );
  assert.equal(outcome.status, "invalid");
  assert.equal(outcome.result, null);
  assert.ok(outcome.issues.length > 0);
  assert.deepEqual(outcome.issues[0], {
    kind: "ir.source.table-missing",
    targetIdentity: "06_Architecture/Details/sample.md",
    location: { path: "06_Architecture/Details/sample.md" },
    reason: "source_heading_missing",
    details: { missingPart: "heading" },
  });
  assert.equal(
    outcome.issues.some((issue) => "code" in issue || "message" in issue),
    false,
  );
});
