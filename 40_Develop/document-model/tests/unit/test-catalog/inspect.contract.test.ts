/**
 * document-model:unit:test-catalogの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility document-model:unit:test-catalogが所有する検証責務を実行する。
 * @trace CQS-UT-010
 * @level UT
 * @scope test、catalog
 * @boundary CQS-UT-010=N/A: Test CatalogとOwner／Path／Levelは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  inspectTestCatalog,
  loadTestCatalog,
  type TestCatalog,
} from "../../../src/test-catalog/inspect.ts";

const domainRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const repositoryRoot = path.resolve(domainRoot, "../..");
const loadedCatalog = loadTestCatalog(
  path.join(repositoryRoot, "07_Quality", "Registry/test-catalog.json"),
);
const catalog = loadedCatalog as TestCatalog;

/**
 * 改名後のServer配下でも試験段階の不一致を拒否する。
 *
 * @responsibility 物理Parent名の変更による段階検査の脱落を検出する。
 * @trace CQS-UT-010
 * @precondition 現行台帳に両Serverのintegration試験が存在する。
 * @stimulus 同じ実在Pathの申告段階だけをunitへ変更する。
 * @observation directory_level_mismatchを観測する。
 * @oracle 正しい台帳は受理し、両Serverの誤申告は拒否する。
 * @cleanup N/A: 入力値だけを変更しFilesystemへ書き込まない。
 * @boundary CQS-UT-010=Direct Boundary: Test Catalog→Path段階検査
 */
test("改名後のServer配下でも試験段階の不一致を拒否する", () => {
  assert.deepEqual(inspectTestCatalog(repositoryRoot, catalog), []);
  for (const parent of ["mcp-server", "workbench-server"]) {
    const target = catalog.tests.find((entry) =>
      entry.path.startsWith(`40_Develop/${parent}/tests/integration/`),
    );
    assert.ok(target, parent);
    const invalid = {
      ...catalog,
      tests: catalog.tests.map((entry) =>
        entry.path === target.path ? { ...entry, level: "unit" } : entry,
      ),
    };
    assert.ok(
      inspectTestCatalog(repositoryRoot, invalid).includes(
        `directory_level_mismatch:${target.path}`,
      ),
      parent,
    );
  }
});

/**
 * 全Toolの結合ブロックはArchitecture、Lifecycle、実在ITへ閉じるを検証する。
 *
 * @responsibility 全Toolの結合ブロックはArchitecture、Lifecycle、実在ITへ閉じるの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 全Toolの結合ブロックはArchitecture、Lifecycle、実在ITへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("全Toolの結合ブロックはArchitecture、Lifecycle、実在ITへ閉じる", () => {
  assert.deepEqual(
    [...new Set(catalog.integrationBlocks.map((entry) => entry.owner))].sort(),
    [
      "access-management",
      "ai-adapter",
      "checker",
      "configuration-model",
      "coordinator",
      "docker-isolation",
      "document-model",
      "execution-intelligence",
      "execution-model",
      "executor",
      "lock",
      "mcp-server",
      "version-control",
      "visual-preview",
      "workbench-server",
    ],
  );
  for (const block of catalog.integrationBlocks) {
    assert.ok(block.architectureAnchor.includes("#"), block.id);
    assert.ok(block.responsibilities.length > 0, block.id);
    assert.ok(block.externalBoundaries.length > 0, block.id);
    assert.ok(block.postconditions.length > 0, block.id);
    assert.ok(
      block.testIds.some(
        (testId) =>
          catalog.tests.find((entry) => entry.id === testId)?.level ===
          "integration",
      ),
      block.id,
    );
  }
});

/**
 * 結合ブロックの未登録Tool、試験欠落、Lifecycle欠落を拒否するを検証する。
 *
 * @responsibility 結合ブロックの未登録Tool、試験欠落、Lifecycle欠落を拒否するの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 結合ブロックの未登録Tool、試験欠落、Lifecycle欠落を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("結合ブロックの未登録Tool、試験欠落、Lifecycle欠落を拒否する", () => {
  const first = catalog.integrationBlocks[0];
  assert.ok(first);
  const withoutPlatform = {
    ...catalog,
    integrationBlocks: catalog.integrationBlocks.filter(
      (entry) => entry.owner !== first.owner,
    ),
  };
  assert.ok(
    inspectTestCatalog(repositoryRoot, withoutPlatform).includes(
      `integration_block_owner_missing:${first.owner}`,
    ),
  );
  const missingTest = {
    ...catalog,
    integrationBlocks: [
      { ...first, testIds: ["missing:integration:test"] },
      ...catalog.integrationBlocks.slice(1),
    ],
  };
  assert.ok(
    inspectTestCatalog(repositoryRoot, missingTest).includes(
      `integration_block_test_missing:${first.id}:missing:integration:test`,
    ),
  );
  const missingLifecycle = {
    ...catalog,
    integrationBlocks: [
      { ...first, lifecycleProfile: "unknown" },
      ...catalog.integrationBlocks.slice(1),
    ],
  };
  assert.ok(
    inspectTestCatalog(repositoryRoot, missingLifecycle).includes(
      `invalid_integration_block_lifecycle:${first.id}`,
    ),
  );
});

/**
 * ブロック間結合は実在Sequence、二段以内の経路、IT、全block被覆へ閉じるを検証する。
 *
 * @responsibility ブロック間結合は実在Sequence、二段以内の経路、IT、全block被覆へ閉じるの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus ブロック間結合は実在Sequence、二段以内の経路、IT、全block被覆へ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("ブロック間結合は実在Sequence、二段以内の経路、IT、全block被覆へ閉じる", () => {
  const first = catalog.integrationCorridors[0];
  assert.ok(first);
  const invalidArchitecture = {
    ...catalog,
    integrationCorridors: [
      {
        ...first,
        architectureAnchor:
          "06_Architecture/02_Activity_Context.md#存在しないシーケンス",
      },
      ...catalog.integrationCorridors.slice(1),
    ],
  };
  assert.ok(
    inspectTestCatalog(repositoryRoot, invalidArchitecture).includes(
      `invalid_integration_corridor_architecture:${first.id}`,
    ),
  );

  const overlongPath = {
    ...catalog,
    integrationCorridors: [
      {
        ...first,
        blockPath: [
          ...first.blockPath,
          "orchestrator:objective-task-lifecycle",
          "mcp:transport-session",
        ],
      },
      ...catalog.integrationCorridors.slice(1),
    ],
  };
  assert.ok(
    inspectTestCatalog(repositoryRoot, overlongPath).includes(
      `invalid_integration_corridor_path:${first.id}`,
    ),
  );

  const systemOnly = catalog.tests.find((entry) => entry.level === "system");
  assert.ok(systemOnly);
  const missingIntegration = {
    ...catalog,
    integrationCorridors: [
      { ...first, testIds: [systemOnly.id] },
      ...catalog.integrationCorridors.slice(1),
    ],
  };
  assert.ok(
    inspectTestCatalog(repositoryRoot, missingIntegration).includes(
      `integration_corridor_integration_test_missing:${first.id}`,
    ),
  );

  assert.deepEqual(inspectTestCatalog(repositoryRoot, catalog), []);
});

/**
 * 利用側契約は欠落・Owner不一致・循環を拒否するを検証する。
 *
 * @responsibility 利用側契約は欠落・Owner不一致・循環を拒否するの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 利用側契約は欠落・Owner不一致・循環を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("利用側契約は欠落・Owner不一致・循環を拒否する", () => {
  const first = catalog.consumerBindings.find(
    (binding) => binding.producerOwner === "execution-intelligence",
  );
  assert.ok(first);
  const missing = {
    ...catalog,
    consumerBindings: [{ ...first, testIds: ["missing:test"] }],
  };
  assert.ok(
    inspectTestCatalog(repositoryRoot, missing).includes(
      "consumer_test_missing:missing:test",
    ),
  );

  const ownerMismatch = {
    ...catalog,
    consumerBindings: [
      {
        ...first,
        testIds: ["execution-intelligence:integration:store"],
      },
    ],
  };
  assert.ok(
    inspectTestCatalog(repositoryRoot, ownerMismatch).includes(
      "consumer_test_owner_mismatch:execution-intelligence:integration:store",
    ),
  );

  const cycle = {
    ...catalog,
    consumerBindings: [
      first,
      {
        producerOwner: "coordinator" as const,
        producerPaths: ["40_Develop/coordinator/src/security"],
        consumerOwner: "execution-intelligence" as const,
        consumerStatic: true as const,
        testIds: ["execution-intelligence:integration:store"],
      },
    ],
  };
  assert.ok(
    inspectTestCatalog(repositoryRoot, cycle).includes(
      "consumer_cycle:coordinator->execution-intelligence",
    ),
  );
});

/**
 * 実行Profileは閉集合かつ重複なしでなければならないを検証する。
 *
 * @responsibility 実行Profileは閉集合かつ重複なしでなければならないの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行Profileは閉集合かつ重複なしでなければならないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("実行Profileは閉集合かつ重複なしでなければならない", () => {
  const first = catalog.tests[0];
  assert.ok(first);
  const invalid = {
    ...catalog,
    tests: [
      {
        ...first,
        executionProfiles: ["restricted_process", "unknown_profile"],
      },
      ...catalog.tests.slice(1),
    ],
  };
  assert.ok(
    inspectTestCatalog(repositoryRoot, invalid as typeof catalog).includes(
      `invalid_execution_profiles:${first.path}`,
    ),
  );
});

/**
 * Windows実Process Gateと実行Profileをexactに照合するを検証する。
 *
 * @responsibility Windows実Process Gateの3 fileと実行Profileをexactに照合するの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows実Process Gateの3 fileと実行Profileをexactに照合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("Windows実Process Gateと実行Profileをexactに照合する", () => {
  const gatePaths = catalog.tests
    .filter((entry) =>
      entry.executionProfiles?.includes("windows_process_control"),
    )
    .map((entry) => entry.path);
  assert.ok(gatePaths.length > 0);
  for (const gatePath of gatePaths) {
    const invalid = {
      ...catalog,
      tests: catalog.tests.map((entry) =>
        entry.path === gatePath
          ? { ...entry, executionProfiles: ["restricted_process"] }
          : entry,
      ),
    };
    assert.ok(
      inspectTestCatalog(repositoryRoot, invalid).includes(
        `windows_process_profile_missing:${gatePath}`,
      ),
      gatePath,
    );
  }

  const ordinaryEntry = catalog.tests.find(
    (entry) =>
      entry.owner === "coordinator" &&
      !gatePaths.includes(entry.path) &&
      entry.level === "integration",
  );
  assert.ok(ordinaryEntry);
  const invalid = {
    ...catalog,
    tests: catalog.tests.map((entry) =>
      entry.path === ordinaryEntry.path
        ? {
            ...entry,
            executionProfiles: [
              "restricted_process",
              "windows_process_control",
            ],
          }
        : entry,
    ),
  };
  assert.ok(
    inspectTestCatalog(repositoryRoot, invalid).includes(
      `windows_process_profile_unexpected:${ordinaryEntry.path}`,
    ),
  );
});

/**
 * Host Windows接頭辞を持つ条件付き実Process試験もWindows実Process Gateとして検出することを検証する。
 *
 * @responsibility 現行のHost Windows命名を旧Windows Process Gate命名と同じ実行Profile契約へ接続する。
 * @trace CQS-UT-010
 * @precondition 一時RepositoryへHost Windows接頭辞を持つ試験と対応する台帳項目を配置する。
 * @stimulus 試験台帳の決定論的検査を実行する。
 * @observation windows_process_profile_missingが返るかを観測する。
 * @oracle windows_process_controlを外した場合だけ不足として拒否する。
 * @cleanup 一時Repositoryを試験終了時に削除する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("Host Windows接頭辞をWindows実Process Gateとして検出する", () => {
  const gateEntry = catalog.tests.find((entry) =>
    entry.path.endsWith("owned-process.integration.test.ts"),
  );
  assert.ok(gateEntry);
  const invalid = {
    ...catalog,
    tests: catalog.tests.map((entry) =>
      entry.path === gateEntry.path
        ? { ...entry, executionProfiles: ["restricted_process"] }
        : entry,
    ),
  };
  assert.ok(
    inspectTestCatalog(repositoryRoot, invalid).includes(
      `windows_process_profile_missing:${gateEntry.path}`,
    ),
  );
});

/**
 * 試験台帳は実行判断fieldの欠落・誤型・未知keyを拒否するを検証する。
 *
 * @responsibility 試験台帳は実行判断fieldの欠落・誤型・未知keyを拒否するの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 試験台帳は実行判断fieldの欠落・誤型・未知keyを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("試験台帳は実行判断fieldの欠落・誤型・未知keyを拒否する", () => {
  const first = catalog.tests[0];
  assert.ok(first);
  for (const field of [
    "kind",
    "environment",
    "externalProviderEffect",
    "humanInput",
    "mandatoryByDefault",
  ] as const) {
    const changed = { ...first } as Record<string, unknown>;
    delete changed[field];
    const invalid = { ...catalog, tests: [changed, ...catalog.tests.slice(1)] };
    assert.ok(
      inspectTestCatalog(repositoryRoot, invalid).some((failure) =>
        failure.includes(`missing_key:${field}`),
      ),
    );
  }
  const wrongTypes = {
    ...catalog,
    tests: [
      {
        ...first,
        externalProviderEffect: "false",
        humanInput: null,
        mandatoryByDefault: 1,
        kind: "unknown",
        environment: "unknown",
        unexpected: true,
      },
      ...catalog.tests.slice(1),
    ],
    unexpectedRoot: true,
  };
  const failures = inspectTestCatalog(repositoryRoot, wrongTypes);
  for (const expected of [
    "root_unknown_key:unexpectedRoot",
    "entry_0_unknown_key:unexpected",
    `invalid_kind:${first.path}`,
    `invalid_environment:${first.path}`,
    `invalid_external_provider_effect:${first.path}`,
    `invalid_human_input:${first.path}`,
    `invalid_mandatory_by_default:${first.path}`,
  ])
    assert.ok(failures.includes(expected), expected);
});

/**
 * 試験台帳は危険なPathと空・重複配列を拒否するを検証する。
 *
 * @responsibility 試験台帳は危険なPathと空・重複配列を拒否するの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 試験台帳は危険なPathと空・重複配列を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("試験台帳は危険なPathと空・重複配列を拒否する", () => {
  const first = catalog.tests[0];
  assert.ok(first);
  for (const invalidPath of [
    "../outside.test.ts",
    "C:\\outside.test.ts",
    "tests\\unit\\x.test.ts",
    "tests//x.test.ts",
  ]) {
    const invalid = {
      ...catalog,
      tests: [{ ...first, path: invalidPath }, ...catalog.tests.slice(1)],
    };
    assert.ok(
      inspectTestCatalog(repositoryRoot, invalid).includes(
        `invalid_path:${first.id}`,
      ),
    );
  }
  const invalidArrays = {
    ...catalog,
    tests: [
      {
        ...first,
        semanticTags: ["duplicate", "duplicate"],
        postconditions: [""],
      },
      ...catalog.tests.slice(1),
    ],
  };
  const failures = inspectTestCatalog(repositoryRoot, invalidArrays);
  assert.ok(failures.includes(`invalid_semantic_tags:${first.path}`));
  assert.ok(failures.includes(`invalid_postconditions:${first.path}`));
});
