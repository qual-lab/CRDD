import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as reality from "../../src/domain/reality-traceability/index.ts";
import * as semantic from "../../src/domain/semantic-coverage/index.ts";
import * as semanticApplication from "../../src/application/semantic-coverage/index.ts";
import * as repository from "../../src/repository/index.ts";

function exportedNames(relativePath: string): readonly string[] {
  const source = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), relativePath),
    "utf8",
  );
  const names = [
    ...[...source.matchAll(/export\s*\{([\s\S]*?)\}\s*from/gu)].flatMap(
      (match) =>
        (match[1] ?? "")
          .split(",")
          .map((entry) => entry.trim().replace(/^type\s+/u, ""))
          .filter((entry) => entry.length > 0),
    ),
    ...[
      ...source.matchAll(
        /export\s+(?:type|interface|const|function|class)\s+([A-Za-z][A-Za-z0-9]*)/gu,
      ),
    ].map((match) => match[1] ?? ""),
  ];
  return names.filter((name) => name.length > 0).sort();
}

function typescriptFiles(root: string): readonly string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...typescriptFiles(target));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(target);
  }
  return files;
}

test("Reality Traceabilityは宣言済み公開入口だけを公開する", () => {
  assert.deepEqual(Object.keys(reality).sort(), [
    "createRealitySymbolGraph",
    "discoverRealitySymbols",
    "realitySymbolKinds",
    "validateRealitySymbolManifest",
  ]);
  assert.deepEqual(
    exportedNames("../../src/domain/reality-traceability/index.ts"),
    [
      "LoadedRealitySymbolManifest",
      "RealitySymbol",
      "RealitySymbolDiscoveryRequest",
      "RealitySymbolDiscoveryResult",
      "RealitySymbolDiscoverySource",
      "RealitySymbolGraph",
      "RealitySymbolKind",
      "RealitySymbolManifest",
      "RealitySymbolNode",
      "createRealitySymbolGraph",
      "discoverRealitySymbols",
      "realitySymbolKinds",
      "validateRealitySymbolManifest",
    ],
  );
});

test("Reality DiscoveryはRepository観測済みSnapshotだけからManifestを構成する", () => {
  const manifest = {
    contract: "crdd/reality-symbol-manifest",
    contractRevision: 1,
    subsystem: "sample",
    symbols: [
      {
        symbolId: "sample.entry",
        kind: "module",
        path: "src/index.ts",
        archIds: ["ARCH-000008"],
      },
    ],
  };
  const result = reality.discoverRealitySymbols({
    sources: [
      {
        subsystem: "sample",
        subsystemPath: "40_Develop/sample",
        manifestPath: "40_Develop/sample/symbol.json",
        manifestSource: JSON.stringify(manifest),
        symbolSources: new Map([["src/index.ts", "export {};\n"]]),
      },
    ],
    prerequisiteIssues: [],
  });
  assert.equal(result.status, "complete");
  assert.equal(result.result?.manifests[0]?.subsystemRoot, "40_Develop/sample");
});

test("Reality Annotationは公開Discovery経由で検証しinternalを公開しない", () => {
  const manifest = {
    contract: "crdd/reality-symbol-manifest",
    contractRevision: 1,
    subsystem: "sample",
    symbols: [
      {
        symbolId: "sample.entry",
        kind: "module",
        path: "src/index.ts",
        archIds: ["ARCH-000008"],
      },
    ],
  };
  const result = reality.discoverRealitySymbols({
    sources: [
      {
        subsystem: "sample",
        subsystemPath: "40_Develop/sample",
        manifestPath: "40_Develop/sample/symbol.json",
        manifestSource: JSON.stringify(manifest),
        symbolSources: new Map([
          ["src/index.ts", "// @crdd QA-000001\n// @crdd ARCH-000009"],
        ]),
      },
    ],
    prerequisiteIssues: [],
  });
  assert.equal(result.status, "invalid");
  assert.deepEqual(result.issues.map(({ kind }) => kind).sort(), [
    "annotation.architecture.relation-mismatch",
    "annotation.relation.domain-invalid",
  ]);
});

test("Common Resultは中立なOutcomeとIssueだけを公開する", () => {
  assert.deepEqual(exportedNames("../../src/domain/result/index.ts"), [
    "DomainIssue",
    "DomainLocation",
    "DomainOutcome",
    "DomainStatus",
  ]);
});

test("Semantic Coverageは純粋計算の公開契約だけを公開する", () => {
  assert.deepEqual(Object.keys(semantic).sort(), [
    "compileQualitySemanticRelations",
    "compileSemanticIr",
    "createSemanticBundle",
    "createSemanticCoverageGraph",
  ]);
  assert.deepEqual(
    exportedNames("../../src/domain/semantic-coverage/index.ts"),
    [
      "QualitySemanticRelation",
      "SemanticBundleContent",
      "SemanticCoverageBundle",
      "SemanticCoverageGraph",
      "SemanticCoverageProjection",
      "SemanticIr",
      "SemanticIrMeaning",
      "compileQualitySemanticRelations",
      "compileSemanticIr",
      "createSemanticBundle",
      "createSemanticCoverageGraph",
    ],
  );
});

test("Semantic Coverage Domain IssueはChecker語彙を公開しない", () => {
  const outcome = semantic.compileSemanticIr(
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
  assert.equal(JSON.stringify(outcome).includes("summary"), false);
  assert.equal(
    JSON.stringify(outcome).includes("semantic-ir-source-table-missing"),
    false,
  );
});

test("CheckerとTemplate ToolはDomain Libraryの公開indexだけを利用する", () => {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  );
  const consumers = [
    path.join(repositoryRoot, "40_Develop", "checker"),
    path.join(repositoryRoot, "template", "tools"),
  ];
  const violations: string[] = [];
  for (const consumerRoot of consumers)
    for (const file of typescriptFiles(consumerRoot)) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(
        /from\s+["']([^"']*crdd-domain-library\/src\/[^"']+)["']/gu,
      )) {
        const imported = match[1] ?? "";
        if (!imported.endsWith("/index.ts"))
          violations.push(
            `${path.relative(repositoryRoot, file).replaceAll("\\", "/")}: ${imported}`,
          );
      }
    }
  assert.deepEqual(violations, []);
});

test("Semantic Coverage Applicationは公開編成だけを所有する", () => {
  assert.deepEqual(Object.keys(semanticApplication).sort(), [
    "publishSemanticCoverage",
  ]);
  assert.deepEqual(
    exportedNames("../../src/application/semantic-coverage/index.ts"),
    [
      "PublishSemanticCoverageRequest",
      "PublishSemanticCoverageResult",
      "publishSemanticCoverage",
    ],
  );
});

test("Reality Domain IssueはChecker語彙と絶対Pathを公開しない", () => {
  const invalidContract = reality.validateRealitySymbolManifest(
    {
      contract: "wrong",
      contractRevision: 1,
      subsystem: "fixture",
      symbols: [],
    },
    "40_Develop/fixture/symbol.json",
  );
  assert.equal(invalidContract.status, "invalid");
  assert.equal(
    invalidContract.issues.some(
      (issue) => issue.kind === "symbol-manifest-contract-invalid",
    ),
    false,
  );
  assert.equal(
    invalidContract.issues.some(
      (issue) =>
        issue.reason === "contract must be crdd/reality-symbol-manifest.",
    ),
    false,
  );
  assert.equal(
    invalidContract.issues.some(
      (issue) => "code" in issue || "message" in issue,
    ),
    false,
  );

  const absolutePath = "C:\\secret\\symbol.json";
  const invalidLocation = reality.validateRealitySymbolManifest(
    {},
    absolutePath,
  );
  assert.equal(invalidLocation.status, "invalid");
  assert.equal(JSON.stringify(invalidLocation).includes(absolutePath), false);
});

test("Repository観測はPort生成だけを実行入口として公開する", () => {
  assert.deepEqual(Object.keys(repository).sort(), [
    "createFilesystemRepositoryObservationPort",
    "createFilesystemSemanticBundlePublisher",
  ]);
  assert.deepEqual(exportedNames("../../src/repository/index.ts"), [
    "RepositoryDirectoryEntry",
    "RepositoryDirectoryObservation",
    "RepositoryEntryKind",
    "RepositoryFileObservation",
    "RepositoryObservationPort",
    "RepositoryRootCapability",
    "SemanticBundlePublishReceipt",
    "SemanticBundlePublishRequest",
    "SemanticBundlePublisher",
    "createFilesystemRepositoryObservationPort",
    "createFilesystemSemanticBundlePublisher",
  ]);
  const forgedCapability = {
    contract: "crdd-version-control/repository-location/v1",
  } as never;
  assert.equal(
    repository
      .createFilesystemRepositoryObservationPort(forgedCapability)
      .observeDirectory("40_Develop").status,
    "unobservable",
  );
  const repositoryEntrySource = fs.readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../src/repository/index.ts",
    ),
    "utf8",
  );
  assert.match(
    repositoryEntrySource,
    /from "\.\.\/\.\.\/\.\.\/version-control\/src\/index\.ts"/u,
  );
  assert.doesNotMatch(
    repositoryEntrySource,
    /version-control\/src\/(?!index\.ts)/u,
  );
});
