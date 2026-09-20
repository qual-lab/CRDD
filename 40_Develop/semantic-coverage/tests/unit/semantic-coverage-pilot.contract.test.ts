import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { SemanticIr } from "../../src/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/repository-identity/index.ts";
import {
  compileQualitySemanticRelationsFromRepository,
  compileSemanticIrFromRepository,
  createSemanticCoverageGraph as createSemanticCoveragePilotGraph,
  mapSemanticDomainIssueToDiagnostic,
} from "../../src/application/semantic-coverage.ts";
import {
  createLegacyRuntimeInventories as createInventories,
  createLegacyRuntimeInventoriesFromObservation,
} from "../../src/migrations/legacy-runtime-inventory.ts";
import { validateRealitySymbolManifest as validateDomainRealitySymbolManifest } from "../../../crdd-domain-library/src/reality-traceability/index.ts";
import {
  createFilesystemRepositoryObservationPort,
  observeRealitySymbolRepository,
} from "../../../crdd-domain-library/src/repository-observation/index.ts";

const checkerRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const repositoryRoot = path.resolve(checkerRoot, "../..");
const verifiedRepository = verifyRepositoryRoot(repositoryRoot);
assert.equal(verifiedRepository.status, "completed");
if (verifiedRepository.status !== "completed")
  throw new Error("repository root verification failed");
const capability = verifiedRepository.capability;
const discoveryObservation = observeRealitySymbolRepository(capability);
const discovery = {
  manifests: discoveryObservation.manifests,
  knownArchIds: discoveryObservation.knownArchIds,
  knownQaIds: discoveryObservation.knownQaIds,
  knownLocalTestIdsByQaId: discoveryObservation.knownLocalTestIdsByQaId,
  findings: [
    ...discoveryObservation.repositoryIssues.map(({ code, path, reason }) => ({
      code,
      path,
      message: reason,
    })),
    ...discoveryObservation.domainIssues.map((issue) => ({
      code: issue.kind,
      path: issue.location.path,
      message: issue.reason,
    })),
  ],
};

function validateRealitySymbolManifest(value: unknown, manifestPath: string) {
  const outcome = validateDomainRealitySymbolManifest(value, manifestPath);
  return {
    manifest: outcome.result,
    findings: outcome.issues.map((issue) => ({
      code: issue.kind,
      path: issue.location.path,
      message: issue.reason,
    })),
  };
}

function createLegacyRuntimeInventories(_repositoryRoot: string) {
  return createInventories(capability);
}

function compileSemanticIrPilot(
  _repositoryRoot: string,
  sourceDocument: string,
  subsystem: string,
) {
  return compileSemanticIrFromRepository(
    capability,
    sourceDocument,
    subsystem,
    discovery.knownArchIds,
  );
}

function compileQualitySemanticRelations(
  _repositoryRoot: string,
  sourceDocuments: readonly string[],
  semanticIrs: readonly SemanticIr[],
) {
  return compileQualitySemanticRelationsFromRepository(
    capability,
    sourceDocuments,
    semanticIrs,
  );
}

function discoverRealitySymbolManifests(_repositoryRoot: string) {
  return discovery;
}

const qualitySources = [
  "07_Quality/Definitions/QA-000003/quality_definition.md",
  "07_Quality/Definitions/QA-000004/quality_definition.md",
  "07_Quality/Definitions/QA-000005/quality_definition.md",
  "07_Quality/Definitions/QA-000006/quality_definition.md",
  "07_Quality/Definitions/QA-000010/quality_definition.md",
] as const;

test("Semantic Domain IssueはChecker境界で明示変換し未知種別を拒否する", () => {
  assert.deepEqual(
    mapSemanticDomainIssueToDiagnostic({
      kind: "ir.meaning.key-invalid",
      targetIdentity: "sample.invalid",
      location: { path: "06_Architecture/Details/sample.md" },
      reason: "meaning_key_not_in_subsystem_namespace",
      details: { row: 4, subsystem: "sample" },
    }),
    {
      code: "semantic-ir-key-invalid",
      path: "06_Architecture/Details/sample.md",
      message: "row 4 has an invalid pilot Semantic Key",
    },
  );
  assert.throws(
    () =>
      mapSemanticDomainIssueToDiagnostic({
        kind: "future.semantic.issue",
        targetIdentity: "sample",
        location: { path: "sample.md" },
        reason: "future_reason",
        details: {},
      }),
    /unknown_semantic_domain_issue:future\.semantic\.issue/u,
  );
  assert.throws(
    () =>
      mapSemanticDomainIssueToDiagnostic({
        kind: "ir.meaning.key-invalid",
        targetIdentity: "sample.invalid",
        location: { path: "sample.md" },
        reason: "meaning_key_not_in_subsystem_namespace",
        details: {},
      }),
    /invalid_semantic_domain_issue_detail:ir\.meaning\.key-invalid:row/u,
  );
});

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
      .filter(
        ({ field, owner }) =>
          owner === "architecture-details" &&
          field !== "effectObservationScope",
      )
      .every(({ identityCoverage }) => identityCoverage === "complete"),
  );
  assert.deepEqual(
    coordinator.fields
      .filter(
        ({ field, owner }) =>
          owner === "architecture-details" &&
          field === "effectObservationScope",
      )
      .map(({ field, identityCoverage, semanticShape }) => ({
        field,
        identityCoverage,
        semanticShape,
      })),
    [
      {
        field: "effectObservationScope",
        identityCoverage: "not-applicable",
        semanticShape: "partial",
      },
    ],
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
      { field: "schema", owner: "generated-projection" },
      { field: "schemaRevision", owner: "generated-projection" },
      { field: "architectureDocument", owner: "generated-projection" },
      { field: "designDocument", owner: "generated-projection" },
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
      { field: "schema", owner: "generated-projection" },
      { field: "schemaRevision", owner: "generated-projection" },
      { field: "architectureDocument", owner: "generated-projection" },
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
  assert.equal(coordinator.fields.length, 11);
  assert.equal(projectRuntime.fields.length, 16);
});

test("旧Runtime JSONの未知root propertyはInventoryを発行せず拒否する", () => {
  const filesystemRepository =
    createFilesystemRepositoryObservationPort(capability);
  const coordinatorPath =
    "07_Quality/Registry/coordinator-runtime-traceability.json";
  const repositoryWithUnknownProperty = {
    ...filesystemRepository,
    observeFile: (repositoryRelativePath: string) => {
      const observation = filesystemRepository.observeFile(
        repositoryRelativePath,
      );
      if (
        repositoryRelativePath !== coordinatorPath ||
        observation.status !== "resolved"
      )
        return observation;
      const value = JSON.parse(observation.source) as Record<string, unknown>;
      value.unclassifiedPilotProperty = true;
      return { ...observation, source: JSON.stringify(value) };
    },
  };

  const result = createLegacyRuntimeInventoriesFromObservation(
    repositoryWithUnknownProperty,
  );
  assert.deepEqual(result.inventories, []);
  assert.deepEqual(result.findings, [
    {
      code: "semantic-coverage-pilot-field-unclassified",
      path: coordinatorPath,
      message: "unclassifiedPilotProperty has no migration owner",
    },
  ]);
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
    [
      "project-runtime.integration-application-unit",
      "project-runtime.objective-intake-unit",
      "project-runtime.state-unit",
    ],
  );
  assert.deepEqual(
    built.graph.testSymbolIdsByMeaningKey.get(
      "project-runtime.queue-lease-lifecycle",
    ),
    ["project-runtime.state-unit"],
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
      ({ code }) => code === "manifest.test.meaning-relation-domain-invalid",
    ),
  );
  assert.equal(validation.manifest, null);
});
