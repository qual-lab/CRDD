import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as semanticCoverage from "../../src/index.ts";

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
