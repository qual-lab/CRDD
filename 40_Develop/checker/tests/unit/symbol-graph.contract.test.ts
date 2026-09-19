import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { discoverRealitySymbolManifests } from "../../../../template/tools/internal/reality-traceability/symbol-discovery.ts";
import { inspectRegularSymbolTarget } from "../../../../template/tools/internal/reality-traceability/symbol-discovery.ts";
import { createRealitySymbolGraph } from "../../../../template/tools/internal/reality-traceability/symbol-graph.ts";
import { observeRepositoryRegularFile } from "../../../../template/tools/internal/reality-traceability/repository-regular-file-observer.ts";
import { readRegisteredRealityTests } from "../../../../template/tools/internal/checker/rules/reality-test-catalog-adapter.ts";
import {
  extractRealitySymbolAnnotations,
  validateRealitySymbolAnnotations,
} from "../../../../template/tools/internal/reality-traceability/symbol-annotation.ts";
import type { LoadedRealitySymbolManifest } from "../../../../template/tools/internal/reality-traceability/symbol-manifest-model.ts";
import { validateRealitySymbolManifest } from "../../../../template/tools/internal/reality-traceability/symbol-manifest-validator.ts";

const checkerRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const repositoryRoot = path.resolve(checkerRoot, "../..");

test("Subsystem-local symbol.jsonからGlobal Symbol Graphを構築する", () => {
  const discovery = discoverRealitySymbolManifests(repositoryRoot);
  assert.deepEqual(discovery.findings, []);
  const subsystemNames = fs
    .readdirSync(path.join(repositoryRoot, "40_Develop"), {
      withFileTypes: true,
    })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(
    discovery.manifests.map(({ manifest }) => manifest.subsystem).sort(),
    subsystemNames,
  );
  const built = createRealitySymbolGraph(
    discovery.manifests,
    discovery.knownArchIds,
    discovery.knownQaIds,
    discovery.knownLocalTestIdsByQaId,
    readRegisteredRealityTests(repositoryRoot).testsByPath,
    [],
  );
  assert.deepEqual(built.findings, []);
  assert.ok(built.graph);
  assert.ok(
    built.graph.symbolsByArchId
      .get("ARCH-000001")
      ?.some(({ symbol }) => symbol.symbolId === "checker.public-entry"),
  );
  assert.ok(
    built.graph.symbolsByQaId
      .get("QA-000001")
      ?.some(({ symbol }) => symbol.symbolId === "checker.contract-regression"),
  );
  assert.deepEqual(
    built.graph.testsByImplementationId
      .get("checker.public-entry")
      ?.map(({ symbol }) => symbol.symbolId),
    ["checker.contract-regression"],
  );
});

test("Symbol Manifestは未知Property・危険Path・Test relation欠落を拒否する", () => {
  const validation = validateRealitySymbolManifest(
    {
      contract: "crdd/reality-symbol-manifest",
      contractRevision: 1,
      subsystem: "sample",
      unexpected: true,
      symbols: [
        {
          symbolId: "sample.test",
          kind: "test-case",
          path: "../outside.ts",
          qaIds: ["QA-000001"],
        },
      ],
    },
    "40_Develop/sample/symbol.json",
  );
  assert.deepEqual(validation.findings.map(({ code }) => code).sort(), [
    "symbol-manifest-path-invalid",
    "symbol-manifest-property-unknown",
    "symbol-manifest-test-relation-missing",
  ]);
  assert.equal(validation.manifest, null);
});

test("Implementation SymbolへQualityとverifiesの責務を混在させない", () => {
  const validation = validateRealitySymbolManifest(
    {
      contract: "crdd/reality-symbol-manifest",
      contractRevision: 1,
      subsystem: "sample",
      symbols: [
        {
          symbolId: "sample.module",
          kind: "module",
          path: "src/index.ts",
          archIds: ["ARCH-000001"],
          qaIds: ["QA-000001"],
          localTestIds: ["UT-000001"],
          verifies: ["sample.other"],
        },
      ],
    },
    "40_Develop/sample/symbol.json",
  );
  assert.ok(
    validation.findings.some(
      ({ code }) => code === "symbol-manifest-implementation-relation-invalid",
    ),
  );
});

test("Global Symbol Graphは重複・未知Canonical ID・未解決verifiesを拒否する", () => {
  const manifest: LoadedRealitySymbolManifest = {
    manifestPath: "40_Develop/sample/symbol.json",
    subsystemRoot: path.join(repositoryRoot, "40_Develop", "sample"),
    manifest: {
      contract: "crdd/reality-symbol-manifest",
      contractRevision: 1,
      subsystem: "sample",
      symbols: [
        {
          symbolId: "sample.module",
          kind: "module",
          path: "src/index.ts",
          archIds: ["ARCH-999999"],
          qaIds: [],
          localTestIds: [],
          verifies: [],
        },
        {
          symbolId: "sample.test",
          kind: "test-case",
          path: "tests/sample.test.ts",
          archIds: [],
          qaIds: ["QA-999999"],
          localTestIds: ["UT-000001"],
          verifies: ["sample.missing"],
        },
      ],
    },
  };
  const firstSymbol = manifest.manifest.symbols[0];
  assert.ok(firstSymbol);
  const duplicateManifest: LoadedRealitySymbolManifest = {
    ...manifest,
    manifestPath: "40_Develop/duplicate/symbol.json",
    manifest: {
      ...manifest.manifest,
      subsystem: "duplicate",
      symbols: [firstSymbol],
    },
  };
  const built = createRealitySymbolGraph(
    [manifest, duplicateManifest],
    new Set(["ARCH-000001"]),
    new Set(["QA-000001"]),
    new Map([["QA-000001", new Set(["UT-000001"])]]),
    new Map([
      [
        "40_Develop/sample/tests/sample.test.ts",
        { owner: "sample", testId: "sample:test" },
      ],
    ]),
    [],
  );
  assert.deepEqual(
    [...new Set(built.findings.map(({ code }) => code))].sort(),
    [
      "reality-symbol-architecture-id-unknown",
      "reality-symbol-id-duplicate",
      "reality-symbol-quality-id-unknown",
      "reality-symbol-verifies-target-missing",
    ],
  );
  assert.equal(built.graph, null);
});

test("Global Symbol GraphはQA定義に存在しないLocal Test IDを拒否する", () => {
  const manifest: LoadedRealitySymbolManifest = {
    manifestPath: "40_Develop/sample/symbol.json",
    subsystemRoot: path.join(repositoryRoot, "40_Develop", "sample"),
    manifest: {
      contract: "crdd/reality-symbol-manifest",
      contractRevision: 1,
      subsystem: "sample",
      symbols: [
        {
          symbolId: "sample.module",
          kind: "module",
          path: "src/index.ts",
          archIds: ["ARCH-000001"],
          qaIds: [],
          localTestIds: [],
          verifies: [],
        },
        {
          symbolId: "sample.test",
          kind: "test-case",
          path: "tests/sample.test.ts",
          archIds: [],
          qaIds: ["QA-000001"],
          localTestIds: ["UT-999999"],
          verifies: ["sample.module"],
        },
      ],
    },
  };
  const built = createRealitySymbolGraph(
    [manifest],
    new Set(["ARCH-000001"]),
    new Set(["QA-000001"]),
    new Map([["QA-000001", new Set(["UT-000001"])]]),
    new Map([
      [
        "40_Develop/sample/tests/sample.test.ts",
        { owner: "sample", testId: "sample:test" },
      ],
    ]),
    [],
  );
  assert.deepEqual(
    built.findings.map(({ code }) => code),
    ["reality-symbol-local-test-id-unknown"],
  );
  assert.equal(built.graph, null);
});

test("共通JSON SchemaはManifestとSymbolの閉じたContractを公開する", () => {
  const schema = JSON.parse(
    fs.readFileSync(
      path.join(
        repositoryRoot,
        "template",
        "tools",
        "schemas",
        "reality-symbol-schema.json",
      ),
      "utf8",
    ),
  ) as {
    additionalProperties: boolean;
    required: string[];
    $defs: {
      symbol: {
        additionalProperties: boolean;
        required: string[];
        properties: { path: { pattern: string } };
      };
    };
  };
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, [
    "contract",
    "contractRevision",
    "subsystem",
    "symbols",
  ]);
  assert.equal(schema.$defs.symbol.additionalProperties, false);
  assert.deepEqual(schema.$defs.symbol.required, ["symbolId", "kind", "path"]);
  const pathPattern = new RegExp(
    schema.$defs.symbol.properties.path.pattern,
    "u",
  );
  assert.equal(pathPattern.test("src/index.ts"), true);
  for (const unsafePath of [
    "../outside.ts",
    "./same.ts",
    "dir/../outside.ts",
    "dir\\file.ts",
    "/absolute.ts",
    "C:/absolute.ts",
  ])
    assert.equal(pathPattern.test(unsafePath), false, unsafePath);
});

test("Source Annotationは任意Hintとして読み、存在時のManifest不一致だけを拒否する", () => {
  const implementationSymbol = {
    symbolId: "sample.module",
    kind: "module" as const,
    path: "src/index.ts",
    archIds: ["ARCH-000001"],
    qaIds: [],
    localTestIds: [],
    verifies: [],
  };
  assert.deepEqual(
    extractRealitySymbolAnnotations("// @crdd ARCH-000001\n// @crdd QA-000002"),
    {
      archIds: new Set(["ARCH-000001"]),
      qaIds: new Set(["QA-000002"]),
    },
  );
  assert.deepEqual(
    validateRealitySymbolAnnotations(
      implementationSymbol,
      "export const value = 1;",
      "40_Develop/sample/symbol.json",
    ),
    [],
  );
  assert.deepEqual(
    validateRealitySymbolAnnotations(
      implementationSymbol,
      "// @crdd ARCH-000002",
      "40_Develop/sample/symbol.json",
    ).map(({ code }) => code),
    ["reality-symbol-annotation-architecture-mismatch"],
  );
  assert.deepEqual(
    extractRealitySymbolAnnotations(
      'const example = "// @crdd ARCH-000002";\n// example: @crdd QA-000002',
    ),
    { archIds: new Set(), qaIds: new Set() },
  );
  assert.deepEqual(
    validateRealitySymbolAnnotations(
      implementationSymbol,
      "// @crdd QA-000001",
      "40_Develop/sample/symbol.json",
    ).map(({ code }) => code),
    ["reality-symbol-annotation-domain-invalid"],
  );
  assert.deepEqual(
    validateRealitySymbolAnnotations(
      {
        ...implementationSymbol,
        symbolId: "sample.test",
        kind: "test-case",
        archIds: [],
        qaIds: ["QA-000001"],
        localTestIds: ["UT-000001"],
        verifies: ["sample.module"],
      },
      "// @crdd ARCH-000001",
      "40_Develop/sample/symbol.json",
    ).map(({ code }) => code),
    ["reality-symbol-annotation-domain-invalid"],
  );
});

test("Test SymbolはTest Catalogのexact pathとownerへ閉じる", () => {
  const manifest: LoadedRealitySymbolManifest = {
    manifestPath: "40_Develop/sample/symbol.json",
    subsystemRoot: path.join(repositoryRoot, "40_Develop", "sample"),
    manifest: {
      contract: "crdd/reality-symbol-manifest",
      contractRevision: 1,
      subsystem: "sample",
      symbols: [
        {
          symbolId: "sample.module",
          kind: "module",
          path: "src/index.ts",
          archIds: ["ARCH-000001"],
          qaIds: [],
          localTestIds: [],
          verifies: [],
        },
        {
          symbolId: "sample.test",
          kind: "test-case",
          path: "src/index.ts",
          archIds: [],
          qaIds: ["QA-000001"],
          localTestIds: ["UT-000001"],
          verifies: ["sample.module"],
        },
      ],
    },
  };
  const commonArguments = [
    [manifest],
    new Set(["ARCH-000001"]),
    new Set(["QA-000001"]),
    new Map([["QA-000001", new Set(["UT-000001"])]]),
  ] as const;
  assert.ok(
    createRealitySymbolGraph(...commonArguments, new Map(), []).findings.some(
      ({ code }) => code === "reality-symbol-test-catalog-registration-missing",
    ),
  );
  assert.ok(
    createRealitySymbolGraph(
      ...commonArguments,
      new Map([
        [
          "40_Develop/sample/src/index.ts",
          { owner: "other", testId: "other:test" },
        ],
      ]),
      [],
    ).findings.some(
      ({ code }) => code === "reality-symbol-test-catalog-owner-mismatch",
    ),
  );
});

test("Global Symbol GraphはDiscoveryまたはCatalog Findingがあれば部分発行しない", () => {
  const manifest: LoadedRealitySymbolManifest = {
    manifestPath: "40_Develop/sample/symbol.json",
    subsystemRoot: path.join(repositoryRoot, "40_Develop", "sample"),
    manifest: {
      contract: "crdd/reality-symbol-manifest",
      contractRevision: 1,
      subsystem: "sample",
      symbols: [
        {
          symbolId: "sample.module",
          kind: "module",
          path: "src/index.ts",
          archIds: ["ARCH-000001"],
          qaIds: [],
          localTestIds: [],
          verifies: [],
        },
      ],
    },
  };
  const discoveryFailure = {
    code: "reality-symbol-manifest-json-invalid",
    path: "40_Develop/invalid/symbol.json",
    message: "invalid manifest",
  };
  assert.equal(
    createRealitySymbolGraph(
      [manifest],
      new Set(["ARCH-000001"]),
      new Set(),
      new Map(),
      new Map(),
      [discoveryFailure],
    ).graph,
    null,
  );
  assert.equal(
    createRealitySymbolGraph(
      [manifest],
      new Set(["ARCH-000001"]),
      new Set(),
      new Map(),
      null,
      [
        {
          code: "reality-symbol-test-catalog-unobservable",
          path: "07_Quality/Registry/test-catalog.json",
          message: "catalog unavailable",
        },
      ],
    ).graph,
    null,
  );
});

test("Test Catalog Adapterは同一Pathの重複登録を拒否する", () => {
  const checkerTestRoot = path.join(
    repositoryRoot,
    ".crdd",
    "tests",
    "checker",
  );
  fs.mkdirSync(checkerTestRoot, { recursive: true });
  const temporaryRoot = fs.mkdtempSync(
    path.join(checkerTestRoot, "test-catalog-"),
  );
  try {
    const registryRoot = path.join(temporaryRoot, "07_Quality", "Registry");
    fs.mkdirSync(registryRoot, { recursive: true });
    fs.writeFileSync(
      path.join(registryRoot, "test-catalog.json"),
      JSON.stringify({
        tests: [
          { id: "sample:first", owner: "sample", path: "same.test.ts" },
          { id: "sample:second", owner: "sample", path: "same.test.ts" },
        ],
      }),
    );
    const result = readRegisteredRealityTests(temporaryRoot);
    assert.deepEqual(
      result.findings.map(({ code }) => code),
      ["reality-symbol-test-catalog-path-duplicate"],
    );
    assert.equal(result.testsByPath, null);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("Test CatalogとQuality Definitionはlink境界を越えて読まない", () => {
  const checkerTestRoot = path.join(
    repositoryRoot,
    ".crdd",
    "tests",
    "checker",
  );
  fs.mkdirSync(checkerTestRoot, { recursive: true });
  const temporaryRoot = fs.mkdtempSync(
    path.join(checkerTestRoot, "traceability-input-boundary-"),
  );
  try {
    const catalogRepository = path.join(temporaryRoot, "catalog-repository");
    const catalogOutside = path.join(temporaryRoot, "catalog-outside");
    fs.mkdirSync(path.join(catalogOutside, "Registry"), { recursive: true });
    fs.mkdirSync(catalogRepository, { recursive: true });
    fs.writeFileSync(
      path.join(catalogOutside, "Registry", "test-catalog.json"),
      JSON.stringify({ tests: [] }),
    );
    fs.symlinkSync(
      catalogOutside,
      path.join(catalogRepository, "07_Quality"),
      "junction",
    );
    assert.deepEqual(
      readRegisteredRealityTests(catalogRepository).findings.map(
        ({ code }) => code,
      ),
      ["reality-symbol-test-catalog-boundary-invalid"],
    );

    const qualityRepository = path.join(temporaryRoot, "quality-repository");
    const qualityDefinitionRoot = path.join(
      qualityRepository,
      "07_Quality",
      "Definitions",
      "QA-000001",
    );
    const outsideDefinition = path.join(temporaryRoot, "outside-quality.md");
    fs.mkdirSync(qualityDefinitionRoot, { recursive: true });
    fs.writeFileSync(outsideDefinition, "# outside\n");
    fs.symlinkSync(
      outsideDefinition,
      path.join(qualityDefinitionRoot, "quality_definition.md"),
      "file",
    );
    assert.deepEqual(
      discoverRealitySymbolManifests(qualityRepository).findings.map(
        ({ code }) => code,
      ),
      ["reality-symbol-quality-definition-boundary-invalid"],
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("Symbol Pathは途中junctionと最終symlinkを通常Fileとして扱わない", () => {
  const checkerTestRoot = path.join(
    repositoryRoot,
    ".crdd",
    "tests",
    "checker",
  );
  fs.mkdirSync(checkerTestRoot, { recursive: true });
  const temporaryRoot = fs.mkdtempSync(
    path.join(checkerTestRoot, "symbol-boundary-"),
  );
  try {
    const subsystemRoot = path.join(temporaryRoot, "subsystem");
    const outsideRoot = path.join(temporaryRoot, "outside");
    fs.mkdirSync(path.join(subsystemRoot, "src"), { recursive: true });
    fs.mkdirSync(outsideRoot, { recursive: true });
    fs.writeFileSync(path.join(outsideRoot, "outside.ts"), "export {};\n");
    fs.symlinkSync(outsideRoot, path.join(subsystemRoot, "linked"), "junction");
    assert.equal(
      inspectRegularSymbolTarget(subsystemRoot, "linked/outside.ts").status,
      "invalid",
    );
    fs.symlinkSync(
      path.join(outsideRoot, "outside.ts"),
      path.join(subsystemRoot, "src", "linked.ts"),
      "file",
    );
    assert.equal(
      inspectRegularSymbolTarget(subsystemRoot, "src/linked.ts").status,
      "invalid",
    );
    assert.equal(
      inspectRegularSymbolTarget(subsystemRoot, "src/disappeared.ts").status,
      "unobservable",
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("40_Develop・Subsystem・Manifestの上位境界をFail Closedにする", () => {
  const checkerTestRoot = path.join(
    repositoryRoot,
    ".crdd",
    "tests",
    "checker",
  );
  fs.mkdirSync(checkerTestRoot, { recursive: true });
  const temporaryRoot = fs.mkdtempSync(
    path.join(checkerTestRoot, "develop-boundary-"),
  );
  try {
    const developRepository = path.join(temporaryRoot, "develop-repository");
    const outsideDevelop = path.join(temporaryRoot, "outside-develop");
    fs.mkdirSync(developRepository, { recursive: true });
    fs.mkdirSync(outsideDevelop, { recursive: true });
    fs.symlinkSync(
      outsideDevelop,
      path.join(developRepository, "40_Develop"),
      "junction",
    );
    assert.ok(
      discoverRealitySymbolManifests(developRepository).findings.some(
        ({ code }) => code === "reality-symbol-develop-boundary-invalid",
      ),
    );

    const subsystemRepository = path.join(
      temporaryRoot,
      "subsystem-repository",
    );
    const outsideSubsystem = path.join(temporaryRoot, "outside-subsystem");
    fs.mkdirSync(path.join(subsystemRepository, "40_Develop"), {
      recursive: true,
    });
    fs.mkdirSync(outsideSubsystem, { recursive: true });
    fs.symlinkSync(
      outsideSubsystem,
      path.join(subsystemRepository, "40_Develop", "linked-subsystem"),
      "junction",
    );
    assert.ok(
      discoverRealitySymbolManifests(subsystemRepository).findings.some(
        ({ code }) => code === "reality-symbol-subsystem-boundary-invalid",
      ),
    );
    assert.equal(
      observeRepositoryRegularFile(
        subsystemRepository,
        "40_Develop/linked-subsystem/symbol.json",
      ).status,
      "invalid",
    );
    assert.equal(
      observeRepositoryRegularFile(
        subsystemRepository,
        "40_Develop/missing/symbol.json",
      ).status,
      "unobservable",
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
