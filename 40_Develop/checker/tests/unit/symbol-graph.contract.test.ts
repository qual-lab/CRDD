/**
 * checker:unit:symbol-graphの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility checker:unit:symbol-graphが所有する検証責務を実行する。
 * @trace PPR-UT-017
 * @level UT
 * @scope reality、traceability、symbol-graph
 * @boundary PPR-UT-017=N/A: Semantic Relation集合は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { LoadedRealitySymbolManifest } from "../../../crdd-domain-library/src/reality-traceability/index.ts";
import {
  readRegisteredRealityTests,
  readRegisteredRealityTestsFromRepository,
} from "../../src/adapters/reality-test-catalog.ts";
import {
  createRealitySymbolGraph,
  discoverRealitySymbolManifests,
  mapRealityDomainIssueToCheckerFinding,
  validateRealitySymbolManifest,
} from "../../src/adapters/reality-traceability.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/repository-identity/index.ts";

const checkerRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const repositoryRoot = path.resolve(checkerRoot, "../..");

/**
 * Reality Domain IssueはChecker境界で明示変換し未知種別を拒否するを検証する。
 *
 * @responsibility Reality Domain IssueはChecker境界で明示変換し未知種別を拒否するの合否判定を所有する。
 * @trace PPR-UT-017
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reality Domain IssueはChecker境界で明示変換し未知種別を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-017=N/A: Semantic Relation集合は外部実行境界を持たない。
 */
test("Reality Domain IssueはChecker境界で明示変換し未知種別を拒否する", () => {
  assert.deepEqual(
    mapRealityDomainIssueToCheckerFinding({
      kind: "graph.symbol.identity-duplicate",
      targetIdentity: "sample.duplicate",
      location: { path: "40_Develop/sample/symbol.json" },
      reason: "declared_identity_is_not_unique",
      details: { symbolId: "sample.duplicate" },
    }),
    {
      code: "reality-symbol-id-duplicate",
      path: "40_Develop/sample/symbol.json",
      message: "Duplicate symbolId: sample.duplicate.",
    },
  );

  assert.throws(
    () =>
      mapRealityDomainIssueToCheckerFinding({
        kind: "future.domain.issue",
        targetIdentity: "sample",
        location: { path: "40_Develop/sample/symbol.json" },
        reason: "future_reason",
        details: {},
      }),
    /unknown_reality_domain_issue:future\.domain\.issue/,
  );
  assert.throws(
    () =>
      mapRealityDomainIssueToCheckerFinding({
        kind: "graph.symbol.identity-duplicate",
        targetIdentity: "sample",
        location: { path: "40_Develop/sample/symbol.json" },
        reason: "symbol_identity_not_unique",
        details: {},
      }),
    /invalid_reality_domain_issue_details:graph\.symbol\.identity-duplicate:symbolId/,
  );
});

/**
 * Subsystem-local symbol.jsonからGlobal Symbol Graphを構築するを検証する。
 *
 * @responsibility Subsystem-local symbol.jsonからGlobal Symbol Graphを構築するの合否判定を所有する。
 * @trace PPR-UT-017
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Subsystem-local symbol.jsonからGlobal Symbol Graphを構築するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-017=N/A: Semantic Relation集合は外部実行境界を持たない。
 */
test("Subsystem-local symbol.jsonからGlobal Symbol Graphを構築する", () => {
  const verified = verifyRepositoryRoot(repositoryRoot);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const discovery = discoverRealitySymbolManifests(verified.capability);
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
    readRegisteredRealityTests(verified.capability).testsByPath,
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
      ?.some(
        ({ symbol }) =>
          symbol.symbolId === "checker.test.integration.crdd-check",
      ),
  );
  assert.deepEqual(
    built.graph.testsByImplementationId
      .get("checker.public-entry")
      ?.map(({ symbol }) => symbol.symbolId),
    ["checker.test.integration.tools-naming"],
  );
  assert.ok(
    built.graph.testsByImplementationId
      .get("checker.pipeline")
      ?.some(
        ({ symbol }) =>
          symbol.symbolId === "checker.test.integration.crdd-check",
      ),
  );
});

/**
 * Symbol Manifestは未知Property・危険Path・Test relation欠落を拒否するを検証する。
 *
 * @responsibility Symbol Manifestは未知Property・危険Path・Test relation欠落を拒否するの合否判定を所有する。
 * @trace PPR-UT-017
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Symbol Manifestは未知Property・危険Path・Test relation欠落を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-017=N/A: Semantic Relation集合は外部実行境界を持たない。
 */
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

/**
 * Implementation SymbolへQualityとverifiesの責務を混在させないを検証する。
 *
 * @responsibility Implementation SymbolへQualityとverifiesの責務を混在させないの合否判定を所有する。
 * @trace PPR-UT-017
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Implementation SymbolへQualityとverifiesの責務を混在させないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-017=N/A: Semantic Relation集合は外部実行境界を持たない。
 */
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
          localTestIds: ["SAMPLE-UT-001"],
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

/**
 * Global Symbol Graphは重複・未知Canonical ID・未解決verifiesを拒否するを検証する。
 *
 * @responsibility Global Symbol Graphは重複・未知Canonical ID・未解決verifiesを拒否するの合否判定を所有する。
 * @trace PPR-UT-017
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Global Symbol Graphは重複・未知Canonical ID・未解決verifiesを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-017=N/A: Semantic Relation集合は外部実行境界を持たない。
 */
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
          localTestIds: ["SAMPLE-UT-001"],
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
    new Map([["QA-000001", new Set(["SAMPLE-UT-001"])]]),
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

/**
 * Global Symbol GraphはQA定義に存在しないLocal Test IDを拒否するを検証する。
 *
 * @responsibility Global Symbol GraphはQA定義に存在しないLocal Test IDを拒否するの合否判定を所有する。
 * @trace PPR-UT-017
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Global Symbol GraphはQA定義に存在しないLocal Test IDを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-017=N/A: Semantic Relation集合は外部実行境界を持たない。
 */
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
          localTestIds: ["SAMPLE-UT-999"],
          verifies: ["sample.module"],
        },
      ],
    },
  };
  const built = createRealitySymbolGraph(
    [manifest],
    new Set(["ARCH-000001"]),
    new Set(["QA-000001"]),
    new Map([["QA-000001", new Set(["SAMPLE-UT-001"])]]),
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

/**
 * 共通JSON SchemaはManifestとSymbolの閉じたContractを公開するを検証する。
 *
 * @responsibility 共通JSON SchemaはManifestとSymbolの閉じたContractを公開するの合否判定を所有する。
 * @trace PPR-UT-017
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 共通JSON SchemaはManifestとSymbolの閉じたContractを公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-017=N/A: Semantic Relation集合は外部実行境界を持たない。
 */
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

/**
 * Test SymbolはTest Catalogのexact pathとownerへ閉じるを検証する。
 *
 * @responsibility Test SymbolはTest Catalogのexact pathとownerへ閉じるの合否判定を所有する。
 * @trace PPR-UT-017
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Test SymbolはTest Catalogのexact pathとownerへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-017=N/A: Semantic Relation集合は外部実行境界を持たない。
 */
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
          localTestIds: ["SAMPLE-UT-001"],
          verifies: ["sample.module"],
        },
      ],
    },
  };
  const commonArguments = [
    [manifest],
    new Set(["ARCH-000001"]),
    new Set(["QA-000001"]),
    new Map([["QA-000001", new Set(["SAMPLE-UT-001"])]]),
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

/**
 * Global Symbol GraphはDiscoveryまたはCatalog Findingがあれば部分発行しないを検証する。
 *
 * @responsibility Global Symbol GraphはDiscoveryまたはCatalog Findingがあれば部分発行しないの合否判定を所有する。
 * @trace PPR-UT-017
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Global Symbol GraphはDiscoveryまたはCatalog Findingがあれば部分発行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-017=N/A: Semantic Relation集合は外部実行境界を持たない。
 */
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

/**
 * Test Catalog Adapterは同一Pathの重複登録を拒否するを検証する。
 *
 * @responsibility Test Catalog Adapterは同一Pathの重複登録を拒否するの合否判定を所有する。
 * @trace PPR-UT-017
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Test Catalog Adapterは同一Pathの重複登録を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-017=N/A: Semantic Relation集合は外部実行境界を持たない。
 */
test("Test Catalog Adapterは同一Pathの重複登録を拒否する", () => {
  const result = readRegisteredRealityTestsFromRepository({
    observeDirectory: () => ({
      status: "unobservable",
      repositoryRelativePath: "07_Quality/Registry",
      reason: "not used",
    }),
    observeFile: (repositoryRelativePath) => ({
      status: "resolved",
      repositoryRelativePath,
      targetPath: repositoryRelativePath,
      source: JSON.stringify({
        tests: [
          { id: "sample:first", owner: "sample", path: "same.test.ts" },
          { id: "sample:second", owner: "sample", path: "same.test.ts" },
        ],
      }),
    }),
  });
  assert.deepEqual(
    result.findings.map(({ code }) => code),
    ["reality-symbol-test-catalog-path-duplicate"],
  );
  assert.equal(result.testsByPath, null);
});

/**
 * Test Catalogはlink境界を越えて読まないを検証する。
 *
 * @responsibility Test Catalogはlink境界を越えて読まないの合否判定を所有する。
 * @trace PPR-UT-017
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Test Catalogはlink境界を越えて読まないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-017=N/A: Semantic Relation集合は外部実行境界を持たない。
 */
test("Test Catalogはlink境界を越えて読まない", () => {
  const result = readRegisteredRealityTestsFromRepository({
    observeDirectory: () => ({
      status: "unobservable",
      repositoryRelativePath: "07_Quality/Registry",
      reason: "not used",
    }),
    observeFile: (repositoryRelativePath) => ({
      status: "invalid",
      repositoryRelativePath,
      reason: "symbolic link boundary",
    }),
  });
  assert.deepEqual(
    result.findings.map(({ code }) => code),
    ["reality-symbol-test-catalog-boundary-invalid"],
  );
});
