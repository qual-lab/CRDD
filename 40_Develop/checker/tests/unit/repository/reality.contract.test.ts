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

import type { LoadedRealitySymbolManifest } from "../../../../domain-model/src/index.ts";
import { discoverRealitySymbols } from "../../../../domain-model/src/index.ts";
import {
  readRegisteredRealityTests,
  readRegisteredRealityTestsFromRepository,
} from "../../../src/repository/reality.ts";
import {
  createRealitySymbolGraph,
  discoverRealitySymbolManifests,
} from "../../../src/repository/reality.ts";
import { verifyRepositoryRoot } from "../../../../version-control/src/index.ts";

import { validateRealitySymbolManifest as validateDomainRealitySymbolManifest } from "../../../../domain-model/src/index.ts";
import { mapRealityDomainIssueToCheckerFinding } from "../../../src/report/reality.ts";
/**
 * Reality Symbol Manifestの契約を検証する。
 *
 * @responsibility Reality Symbol Manifestの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace PPR-UT-017
 * @input value: unknown、manifestPath: string
 * @returns Domainの結果を既存試験用shapeへ変換した値。
 * @stimulus DomainのManifest検査と既存診断変換だけを呼ぶ。
 * @observation manifestとfindingsを取得する。
 * @oracle Domainの検査結果を変更せずに返す。
 * @cleanup N/A: 局所値だけを使う。
 * @precondition 「value: unknown、manifestPath: string」がvalidateRealitySymbolManifestの入力契約を満たす。
 * @postcondition validateRealitySymbolManifestの責務を完了した結果だけを返す。
 * @effect N/A: validateRealitySymbolManifestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateRealitySymbolManifestは独自の失敗分岐を所有しない。
 * @invariant validateRealitySymbolManifestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary PPR-UT-017=N/A: 試験用の同期結果変換。
 * @security N/A: validateRealitySymbolManifestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validateRealitySymbolManifestは共有非同期状態を持たない同期処理である。
 */
function validateRealitySymbolManifest(value: unknown, manifestPath: string) {
  const outcome = validateDomainRealitySymbolManifest(value, manifestPath);
  return {
    manifest: outcome.result,
    findings: outcome.issues.map(mapRealityDomainIssueToCheckerFinding),
  };
}

const checkerRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const repositoryRoot = path.resolve(checkerRoot, "../..");

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
 * @boundary PPR-UT-017=Direct Boundary: checker Test Source→対象契約
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
    [
      "checker.test.integration.tools-naming",
      "checker.test.integration.domain-results",
    ],
  );
  assert.ok(
    built.graph.testsByImplementationId
      .get("domain-model.artifact-inspection")
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
 * @boundary PPR-UT-017=Direct Boundary: checker Test Source→対象契約
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
 * 検証Toolの閉じた分類と通常実装の分類を分離する。
 * @responsibility 検証手段へ架空ARCHを与えず、本番Sourceの分類迂回を拒否する。
 * @trace PPR-UT-017
 * @precondition QAとLocal Itemを持つ合成Tool記述。
 * @stimulus Path・関係・欠測・型を一つずつ変更する。
 * @observation Manifest受理と固定診断。
 * @oracle 所有検証領域・QA・Local・明示空verifiesだけを許す。
 * @cleanup N/A: 値検証だけで資源を取得しない。
 * @boundary SchemaとDomain Validator。実Toolや本番実装を実行しない。
 */
test("検証Toolは所有PathとQuality関係を要求し実装へ誤分類しない", () => {
  const tool = {
    symbolId: "sample.tool",
    kind: "verification-tool",
    path: "scripts/verify.ts",
    qaIds: ["QA-000001"],
    localTestIds: ["PPR-UT-017"],
    verifies: [],
  };
  for (const [change, isAccepted] of [
    [{}, true],
    [{ path: "tests/fixtures/oracle.ts" }, true],
    [{ path: "scripts/check.rs" }, true],
    [{ path: "src/owner.ts" }, false],
    [{ path: "tests/case.test.ts" }, false],
    [{ path: "scripts/../src/owner.ts" }, false],
    [{ path: "/scripts/verify.ts" }, false],
    [{ path: "scripts/verify.json" }, false],
    [{ archIds: ["ARCH-000001"] }, false],
    [{ implements: ["sample.meaning"] }, false],
    [{ verificationTarget: "environment" }, false],
    [{ verificationTarget: undefined }, false],
    [{ verifies: ["sample.source"] }, false],
    [{ verifies: undefined }, false],
    [{ verifies: null }, false],
    [{ verifies: {} }, false],
    [{ qaIds: [] }, false],
    [{ localTestIds: [] }, false],
    [{ kind: "file", path: "src/source.ts" }, false],
    [{ kind: "test-suite", path: "tests/case.test.ts" }, false],
  ] as const) {
    assert.equal(
      validateRealitySymbolManifest(
        {
          contract: "crdd/reality-symbol-manifest",
          contractRevision: 1,
          subsystem: "sample",
          symbols: [{ ...tool, ...change }],
        },
        "40_Develop/sample/symbol.json",
      ).manifest !== null,
      isAccepted,
      JSON.stringify(change),
    );
  }
  for (const key of ["qaIds", "localTestIds", "verifies"]) {
    const missing = { ...tool };
    Reflect.deleteProperty(missing, key);
    assert.equal(
      validateRealitySymbolManifest(
        {
          contract: "crdd/reality-symbol-manifest",
          contractRevision: 1,
          subsystem: "sample",
          symbols: [missing],
        },
        "40_Develop/sample/symbol.json",
      ).manifest,
      null,
      key,
    );
  }
  const schema = JSON.parse(
    fs.readFileSync(
      path.join(
        repositoryRoot,
        "template/tools/schemas/reality-symbol-schema.json",
      ),
      "utf8",
    ),
  );
  assert.ok(
    schema.$defs.symbol.properties.kind.enum.includes("verification-tool"),
  );
  const branch = schema.$defs.symbol.allOf[0].else;
  assert.equal(branch.if.properties.kind.const, "verification-tool");
  assert.deepEqual(branch.then.required, ["qaIds", "localTestIds", "verifies"]);
  assert.deepEqual(branch.then.not, { required: ["verificationTarget"] });
  assert.equal(branch.then.properties.archIds.maxItems, 0);
  assert.equal(branch.then.properties.implements.maxItems, 0);
  assert.equal(branch.then.properties.verifies.maxItems, 0);
  assert.equal(
    schema.$defs.symbol.allOf[0].then.else.properties.verifies.minItems,
    1,
  );
});

/**
 * 検証Toolへの参照を検査しても本番実装の検証辺に加算しない。
 * @responsibility 参照欠落とTestへの循環的代替を拒否しCoverageを分離する。
 * @trace PPR-UT-017
 * @precondition 同じQA・Localと実在するToolを表す合成Manifest。
 * @stimulus 正常Tool・未知対象・別Testをverifiesへ指定する。
 * @observation Graph受理、Quality Indexと実装検証Index。
 * @oracle Tool参照だけを受理しtestsByImplementationIdは空のまま。
 * @cleanup N/A: 同期Graph構築だけ。
 * @boundary Relation解決とCoverage Index。実Tool動作は評価しない。
 */
test("検証Toolへの検証辺は実装Coverageを生成しない", () => {
  for (const target of ["sample.tool", "sample.missing", "sample.test"]) {
    const validated = validateRealitySymbolManifest(
      {
        contract: "crdd/reality-symbol-manifest",
        contractRevision: 1,
        subsystem: "sample",
        symbols: [
          {
            symbolId: "sample.tool",
            kind: "verification-tool",
            path: "scripts/verify.ts",
            qaIds: ["QA-000001"],
            localTestIds: ["PPR-UT-017"],
            verifies: [],
          },
          {
            symbolId: "sample.test",
            kind: "test-suite",
            path: "tests/tool.test.ts",
            qaIds: ["QA-000001"],
            localTestIds: ["PPR-UT-017"],
            verifies: [target],
          },
        ],
      },
      "40_Develop/sample/symbol.json",
    );
    assert.ok(validated.manifest);
    const built = createRealitySymbolGraph(
      [
        {
          manifestPath: "40_Develop/sample/symbol.json",
          subsystemRoot: "40_Develop/sample",
          manifest: validated.manifest,
        },
      ],
      new Set(),
      new Set(["QA-000001"]),
      new Map([["QA-000001", new Set(["PPR-UT-017"])]]),
      new Map([
        [
          "40_Develop/sample/tests/tool.test.ts",
          { owner: "sample", testId: "sample:test" },
        ],
      ]),
      [],
    );
    if (target === "sample.tool") {
      assert.deepEqual(built.findings, []);
      assert.ok(built.graph);
      assert.equal(built.graph.testsByImplementationId.size, 0);
      assert.equal(built.graph.symbolsByArchId.size, 0);
      assert.equal(built.graph.symbolsByQaId.get("QA-000001")?.length, 2);
    } else assert.equal(built.graph, null);
  }
});

/**
 * 検証ToolのSource注釈を実装注釈とは独立に照合する。
 * @responsibility Qualityの実体接続を保持しARCH混入を拒否する。
 * @trace PPR-UT-017
 * @precondition 合成Sourceを渡す既存Discovery入口。
 * @stimulus 正しいQA、別QA、ARCH注釈とSource欠測を与える。
 * @observation DiscoveryのstatusとIssue。
 * @oracle 一致したQuality注釈だけを受理し観測不能を成功化しない。
 * @cleanup N/A: メモリSourceだけでFilesystemを作らない。
 * @boundary Discovery→Annotationの実接続。
 */
test("検証Toolの注釈もQualityへ拘束し欠測を拒否する", () => {
  for (const source of [
    "// @crdd QA-000001",
    "// @crdd QA-000002",
    "// @crdd ARCH-000001",
    null,
  ]) {
    const result = discoverRealitySymbols({
      prerequisiteIssues: [],
      sources: [
        {
          subsystem: "sample",
          subsystemPath: "40_Develop/sample",
          manifestPath: "40_Develop/sample/symbol.json",
          manifestSource: JSON.stringify({
            contract: "crdd/reality-symbol-manifest",
            contractRevision: 1,
            subsystem: "sample",
            symbols: [
              {
                symbolId: "sample.tool",
                kind: "verification-tool",
                path: "scripts/verify.ts",
                qaIds: ["QA-000001"],
                localTestIds: ["PPR-UT-017"],
                verifies: [],
              },
            ],
          }),
          symbolSources: new Map(
            source === null ? [] : [["scripts/verify.ts", source]],
          ),
        },
      ],
    });
    assert.equal(result.status === "complete", source === "// @crdd QA-000001");
  }
});

/**
 * 環境実証の明示は実装への検証関係を生成しない。
 * @responsibility 通常試験の関係必須と環境試験の閉条件を区別する。
 * @trace PPR-UT-017
 * @precondition 合成Manifestだけを使用する。
 * @stimulus 対象種別・関係・Local IDを個別に変異する。
 * @observation Manifestの受理と投影を確認する。
 * @oracle 環境明示・QA・Local ID・空verifiesだけを受理する。
 * @cleanup 外部資源を作成しない。
 * @boundary Manifest値検証だけであり実装Coverage成立ではない。
 */
test("環境試験は明示と空実装関係を要求し通常試験を免除しない", () => {
  const symbol = {
    symbolId: "sample.environment",
    kind: "test-suite",
    path: "tests/environment.test.ts",
    qaIds: ["QA-000001"],
    localTestIds: ["PPR-UT-017"],
    verifies: [],
    verificationTarget: "environment",
  };
  for (const [change, isAccepted] of [
    [{}, true],
    [{ verificationTarget: undefined }, false],
    [{ verificationTarget: "implementation" }, false],
    [{ verifies: ["sample.source"] }, false],
    [{ verifies: undefined }, false],
    [{ verifies: null }, false],
    [{ verifies: {} }, false],
    [{ qaIds: [] }, false],
    [{ localTestIds: [] }, false],
    [{ kind: "module", archIds: ["ARCH-000001"] }, false],
    [{ path: "../outside.ts" }, false],
  ] as const) {
    const result = validateRealitySymbolManifest(
      {
        contract: "crdd/reality-symbol-manifest",
        contractRevision: 1,
        subsystem: "sample",
        symbols: [{ ...symbol, ...change }],
      },
      "40_Develop/sample/symbol.json",
    );
    assert.equal(result.manifest !== null, isAccepted);
    if (isAccepted) assert.deepEqual(result.manifest?.symbols[0]?.verifies, []);
  }
  const missingRelation = { ...symbol };
  Reflect.deleteProperty(missingRelation, "verifies");
  assert.equal(
    validateRealitySymbolManifest(
      {
        contract: "crdd/reality-symbol-manifest",
        contractRevision: 1,
        subsystem: "sample",
        symbols: [missingRelation],
      },
      "40_Develop/sample/symbol.json",
    ).manifest,
    null,
  );
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
 * @boundary PPR-UT-017=Direct Boundary: checker Test Source→対象契約
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
 * @boundary PPR-UT-017=Direct Boundary: checker Test Source→対象契約
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
 * @boundary PPR-UT-017=Direct Boundary: checker Test Source→対象契約
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
 * @boundary PPR-UT-017=Direct Boundary: checker Test Source→対象契約
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
 * @boundary PPR-UT-017=Direct Boundary: checker Test Source→対象契約
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
 * @boundary PPR-UT-017=Direct Boundary: checker Test Source→対象契約
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
 * @boundary PPR-UT-017=Direct Boundary: checker Test Source→対象契約
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
 * @boundary PPR-UT-017=Direct Boundary: checker Test Source→対象契約
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
