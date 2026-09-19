import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createLegacyRuntimeInventories } from "../../../../template/tools/internal/semantic-coverage/legacy-runtime-inventory.ts";
import { publishSemanticCoverageBundle } from "../../../../template/tools/internal/semantic-coverage/semantic-bundle-writer.ts";
import { createSemanticCoveragePilotGraph } from "../../../../template/tools/internal/semantic-coverage/semantic-coverage-graph.ts";
import { compileSemanticIrPilot } from "../../../../template/tools/internal/semantic-coverage/semantic-ir-compiler.ts";
import { compileQualitySemanticRelations } from "../../../../template/tools/internal/semantic-coverage/quality-semantic-relation.ts";
import { discoverRealitySymbolManifests } from "../../../../template/tools/internal/reality-traceability/symbol-discovery.ts";
import { validateRealitySymbolManifest } from "../../../../template/tools/internal/reality-traceability/symbol-manifest-validator.ts";

const checkerRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const repositoryRoot = path.resolve(checkerRoot, "../..");
const qualitySources = [
  "07_Quality/Definitions/QA-000003/quality_definition.md",
  "07_Quality/Definitions/QA-000004/quality_definition.md",
  "07_Quality/Definitions/QA-000005/quality_definition.md",
  "07_Quality/Definitions/QA-000006/quality_definition.md",
  "07_Quality/Definitions/QA-000010/quality_definition.md",
] as const;

test("旧Runtime JSONをRelation Owner別に分解してPilot Gapを観測する", () => {
  const result = createLegacyRuntimeInventories(repositoryRoot);
  assert.deepEqual(result.findings, []);
  assert.equal(result.inventories.length, 2);

  const coordinator = result.inventories.find(
    ({ subsystem }) => subsystem === "coordinator",
  );
  const projectRuntime = result.inventories.find(
    ({ subsystem }) => subsystem === "project-runtime",
  );
  assert.ok(coordinator);
  assert.ok(projectRuntime);

  assert.ok(
    coordinator.fields
      .filter(({ owner }) => owner === "architecture-details")
      .every(({ identityCoverage }) => identityCoverage === "complete"),
  );
  assert.ok(
    coordinator.fields
      .filter(({ owner }) => owner === "architecture-details")
      .every(({ semanticShape }) => semanticShape === "partial"),
  );
  assert.ok(
    projectRuntime.fields
      .filter(({ owner }) => owner === "architecture-details")
      .every(
        ({ identityCoverage, semanticShape }) =>
          identityCoverage === "complete" && semanticShape === "structured",
      ),
  );
  assert.deepEqual(
    projectRuntime.fields
      .filter(({ owner }) => owner !== "architecture-details")
      .map(({ field, owner }) => ({ field, owner })),
    [
      { field: "implementationBindings", owner: "implementation-symbol" },
      {
        field: "verificationBindings",
        owner: "quality-and-test-symbol",
      },
    ],
  );
  assert.deepEqual(
    coordinator.fields
      .filter(({ owner }) => owner !== "architecture-details")
      .map(({ field, owner }) => ({ field, owner })),
    [
      {
        field: "verificationBindings",
        owner: "quality-and-test-symbol",
      },
      {
        field: "verificationBoundaryByBinding",
        owner: "generated-projection",
      },
    ],
  );
});

test("Pilot Inventoryは同じRepository入力から同じ結果を生成する", () => {
  const first = createLegacyRuntimeInventories(repositoryRoot);
  const second = createLegacyRuntimeInventories(repositoryRoot);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("CoordinatorとProject Runtimeの可視表からPilot IRを決定論的に生成する", () => {
  const pilots = [
    {
      subsystem: "coordinator",
      sourceDocument: "06_Architecture/Details/coordinator/01_Architecture.md",
      expectedMeaningCount: 8,
    },
    {
      subsystem: "project-runtime",
      sourceDocument:
        "06_Architecture/Details/project-runtime/02_Detailed_Design.md",
      expectedMeaningCount: 9,
    },
  ] as const;
  for (const pilot of pilots) {
    const first = compileSemanticIrPilot(
      repositoryRoot,
      pilot.sourceDocument,
      pilot.subsystem,
    );
    const second = compileSemanticIrPilot(
      repositoryRoot,
      pilot.sourceDocument,
      pilot.subsystem,
    );
    assert.deepEqual(first.findings, []);
    assert.ok(first.ir);
    assert.equal(first.ir.stability, "pilot");
    assert.equal(first.ir.meanings.length, pilot.expectedMeaningCount);
    assert.equal(JSON.stringify(first), JSON.stringify(second));
  }
});

test("Pilot IRは自由文推測をせず構造欠落を拒否する", () => {
  const missingTable = compileSemanticIrPilot(
    repositoryRoot,
    "06_Architecture/Details/project-runtime/01_Architecture.md",
    "project-runtime",
  );
  assert.equal(missingTable.ir, null);
  assert.deepEqual(
    missingTable.findings.map(({ code }) => code),
    ["semantic-ir-source-table-missing"],
  );
});

test("Pilot Semantic Keyを実装Symbol側のimplementsから解決する", () => {
  const semanticIrs = [
    compileSemanticIrPilot(
      repositoryRoot,
      "06_Architecture/Details/coordinator/01_Architecture.md",
      "coordinator",
    ).ir,
    compileSemanticIrPilot(
      repositoryRoot,
      "06_Architecture/Details/project-runtime/02_Detailed_Design.md",
      "project-runtime",
    ).ir,
  ];
  assert.ok(semanticIrs.every((ir) => ir !== null));
  const qualityRelations = compileQualitySemanticRelations(
    repositoryRoot,
    qualitySources,
    semanticIrs.filter((ir) => ir !== null),
  );
  assert.deepEqual(qualityRelations.findings, []);
  assert.ok(qualityRelations.relations);
  const discovery = discoverRealitySymbolManifests(repositoryRoot);
  assert.deepEqual(discovery.findings, []);
  const built = createSemanticCoveragePilotGraph(
    semanticIrs.filter((ir) => ir !== null),
    discovery.manifests,
    qualityRelations.relations,
    discovery.findings,
  );
  assert.deepEqual(built.findings, []);
  assert.ok(built.graph);
  assert.equal(built.graph.meaningsByKey.size, 17);
  assert.equal(built.graph.implementationIdsByMeaningKey.size, 16);
  assert.equal(built.graph.qualityLocalIdsByMeaningKey.size, 17);
  assert.deepEqual(
    built.graph.implementationIdsByMeaningKey.get(
      "coordinator.provider-effect-authority",
    ),
    ["coordinator.provider-authority-runtime"],
  );
  assert.equal(
    built.graph.implementationIdsByMeaningKey.has(
      "coordinator.runtime-trust-consumption",
    ),
    false,
  );
  assert.deepEqual(
    built.graph.qualityLocalIdsByMeaningKey.get(
      "project-runtime.queue-lease-lifecycle",
    ),
    ["QA-000003/PRL-11"],
  );
  assert.deepEqual(
    built.graph.testSymbolIdsByMeaningKey.get(
      "project-runtime.objective-task-lifecycle",
    ),
    ["project-runtime.objective-intake-unit"],
  );
  assert.equal(
    built.graph.testSymbolIdsByMeaningKey.has(
      "project-runtime.queue-lease-lifecycle",
    ),
    false,
  );
});

test("Test SymbolはQA-IDとLocal IDの完全一致だけを意味へ接続する", () => {
  const coordinatorIr = compileSemanticIrPilot(
    repositoryRoot,
    "06_Architecture/Details/coordinator/01_Architecture.md",
    "coordinator",
  ).ir;
  assert.ok(coordinatorIr);
  const semanticIrs = [
    {
      ...coordinatorIr,
      meanings: coordinatorIr.meanings.filter(
        ({ semanticKey }) => semanticKey === "coordinator.objective-lifecycle",
      ),
    },
  ];
  const relations = [
    {
      qaId: "QA-000003",
      localId: "PRL-03",
      semanticKey: "coordinator.objective-lifecycle",
      sourceDocument: "qa-3.md",
    },
  ];
  const manifest = {
    manifestPath: "40_Develop/sample/symbol.json",
    subsystemRoot: "40_Develop/sample",
    manifest: {
      contract: "crdd/reality-symbol-manifest" as const,
      contractRevision: 1 as const,
      subsystem: "sample",
      symbols: [
        {
          symbolId: "sample.owner",
          kind: "file" as const,
          path: "src/owner.ts",
          archIds: [],
          qaIds: [],
          localTestIds: [],
          verifies: [],
          implements: ["coordinator.objective-lifecycle"],
        },
        {
          symbolId: "sample.exact-test",
          kind: "test-case" as const,
          path: "tests/exact.test.ts",
          archIds: [],
          qaIds: ["QA-000003"],
          localTestIds: ["PRL-03"],
          verifies: ["sample.owner"],
        },
        {
          symbolId: "sample.wrong-qa-test",
          kind: "test-case" as const,
          path: "tests/wrong.test.ts",
          archIds: [],
          qaIds: ["QA-000004"],
          localTestIds: ["PRL-03"],
          verifies: ["sample.owner"],
        },
      ],
    },
  };
  const result = createSemanticCoveragePilotGraph(
    semanticIrs,
    [manifest],
    relations,
    [],
  );
  assert.deepEqual(result.findings, []);
  assert.deepEqual(
    result.graph?.testSymbolIdsByMeaningKey.get(
      "coordinator.objective-lifecycle",
    ),
    ["sample.exact-test"],
  );
});

test("同じLocal IDが複数QAに存在するTest Symbolは曖昧として拒否する", () => {
  const coordinatorIr = compileSemanticIrPilot(
    repositoryRoot,
    "06_Architecture/Details/coordinator/01_Architecture.md",
    "coordinator",
  ).ir;
  assert.ok(coordinatorIr);
  const semanticIrs = [
    {
      ...coordinatorIr,
      meanings: coordinatorIr.meanings.filter(
        ({ semanticKey }) => semanticKey === "coordinator.objective-lifecycle",
      ),
    },
  ];
  const result = createSemanticCoveragePilotGraph(
    semanticIrs,
    [
      {
        manifestPath: "40_Develop/sample/symbol.json",
        subsystemRoot: "40_Develop/sample",
        manifest: {
          contract: "crdd/reality-symbol-manifest",
          contractRevision: 1,
          subsystem: "sample",
          symbols: [
            {
              symbolId: "sample.owner",
              kind: "file",
              path: "src/owner.ts",
              archIds: [],
              qaIds: [],
              localTestIds: [],
              verifies: [],
              implements: ["coordinator.objective-lifecycle"],
            },
            {
              symbolId: "sample.ambiguous-test",
              kind: "test-case",
              path: "tests/ambiguous.test.ts",
              archIds: [],
              qaIds: ["QA-000003", "QA-000004"],
              localTestIds: ["PRL-03"],
              verifies: ["sample.owner"],
            },
          ],
        },
      },
    ],
    [
      {
        qaId: "QA-000003",
        localId: "PRL-03",
        semanticKey: "coordinator.objective-lifecycle",
        sourceDocument: "qa-3.md",
      },
      {
        qaId: "QA-000004",
        localId: "PRL-03",
        semanticKey: "coordinator.objective-lifecycle",
        sourceDocument: "qa-4.md",
      },
    ],
    [],
  );
  assert.equal(result.graph, null);
  assert.ok(
    result.findings.some(
      ({ code }) => code === "semantic-coverage-test-quality-pair-ambiguous",
    ),
  );
});

test("Bundle公開前の失敗は既存Snapshotを置換しない", () => {
  const checkerTestRoot = path.join(
    repositoryRoot,
    ".crdd",
    "tests",
    "checker",
  );
  fs.mkdirSync(checkerTestRoot, { recursive: true });
  const temporaryRoot = fs.mkdtempSync(
    path.join(checkerTestRoot, "semantic-bundle-"),
  );
  try {
    const registryRoot = path.join(temporaryRoot, "07_Quality", "Registry");
    fs.mkdirSync(registryRoot, { recursive: true });
    const targetPath = path.join(registryRoot, "semantic-coverage-pilot.json");
    fs.writeFileSync(targetPath, "old\n", "utf8");
    assert.throws(() =>
      publishSemanticCoverageBundle(
        temporaryRoot,
        "07_Quality/Registry/semantic-coverage-pilot.json",
        "new\n",
        {
          beforePublish: () => {
            throw new Error("injected-before-publish");
          },
        },
      ),
    );
    assert.equal(fs.readFileSync(targetPath, "utf8"), "old\n");
    assert.deepEqual(
      fs
        .readdirSync(registryRoot)
        .filter((name) => name.startsWith(".semantic-coverage-pilot.")),
      [],
    );
    publishSemanticCoverageBundle(
      temporaryRoot,
      "07_Quality/Registry/semantic-coverage-pilot.json",
      "new\n",
    );
    assert.equal(fs.readFileSync(targetPath, "utf8"), "new\n");
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("Quality Local Itemが全Pilot Semantic Keyの正方向Relationを所有する", () => {
  const semanticIrs = [
    compileSemanticIrPilot(
      repositoryRoot,
      "06_Architecture/Details/coordinator/01_Architecture.md",
      "coordinator",
    ).ir,
    compileSemanticIrPilot(
      repositoryRoot,
      "06_Architecture/Details/project-runtime/02_Detailed_Design.md",
      "project-runtime",
    ).ir,
  ].filter((ir) => ir !== null);
  const compiled = compileQualitySemanticRelations(
    repositoryRoot,
    qualitySources,
    semanticIrs,
  );
  assert.deepEqual(compiled.findings, []);
  assert.ok(compiled.relations);
  assert.equal(
    new Set(compiled.relations.map(({ semanticKey }) => semanticKey)).size,
    17,
  );
});

test("Test Symbolはimplementsを所有できない", () => {
  const validation = validateRealitySymbolManifest(
    {
      contract: "crdd/reality-symbol-manifest",
      contractRevision: 1,
      subsystem: "sample",
      symbols: [
        {
          symbolId: "sample.test",
          kind: "test-case",
          path: "tests/sample.test.ts",
          qaIds: ["QA-000001"],
          verifies: ["sample.module"],
          implements: ["sample.meaning"],
        },
      ],
    },
    "40_Develop/sample/symbol.json",
  );
  assert.ok(
    validation.findings.some(
      ({ code }) => code === "symbol-manifest-test-meaning-relation-invalid",
    ),
  );
  assert.equal(validation.manifest, null);
});
