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
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readTestCatalog } from "../../../src/index.ts";
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

test("台帳の所有者、範囲、環境を宣言に照らして検査する", () => {
  assert.deepEqual(inspectTestCatalog(repositoryRoot, catalog).failures, []);
  const owner = catalog.owners[0];
  const target = catalog.tests[0];
  assert.ok(owner && target);
  const check = (change: object) =>
    inspectTestCatalog(repositoryRoot, { ...catalog, ...change });
  assert.ok(
    check({ contractRevision: 10 }).failures.includes("contract_revision"),
  );
  assert.ok(
    check({ owners: [...catalog.owners, owner] }).failures.includes(
      `duplicate_owner_id:${owner.id}`,
    ),
  );
  assert.ok(
    check({
      owners: [
        ...catalog.owners,
        { ...owner, id: "nested", root: `${owner.root}/tests` },
      ],
    }).failures.includes("overlapping_owner_root:nested"),
  );
  assert.ok(
    check({
      owners: [
        ...catalog.owners,
        { ...owner, id: "outside", root: "../outside" },
      ],
    }).failures.includes("invalid_owner_root:outside"),
  );
  const changeTest = (change: object) =>
    check({ tests: [{ ...target, ...change }, ...catalog.tests.slice(1)] });
  assert.ok(
    changeTest({ owner: "undeclared" }).failures.includes(
      `unsupported_owner:${target.path}`,
    ),
  );
  assert.ok(
    changeTest({ path: "out/of/scope.py" }).failures.includes(
      "test_outside_owner_root:out/of/scope.py",
    ),
  );
  assert.ok(
    changeTest({ environment: "undeclared" }).failures.includes(
      `invalid_environment:${target.path}`,
    ),
  );
  const unused = check({ environments: [...catalog.environments, "unused"] });
  assert.deepEqual(unused.failures, []);
  assert.deepEqual(unused.warnings, ["unused_environment:unused"]);
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
      "crdd-server",
      "docker-isolation",
      "document-model",
      "execution-intelligence",
      "execution-model",
      "executor",
      "lock",
      "version-control",
      "visual-preview",
      "workbench-ui",
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
    inspectTestCatalog(repositoryRoot, withoutPlatform).failures.includes(
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
    inspectTestCatalog(repositoryRoot, missingTest).failures.includes(
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
    inspectTestCatalog(repositoryRoot, missingLifecycle).failures.includes(
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
    inspectTestCatalog(repositoryRoot, invalidArchitecture).failures.includes(
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
    inspectTestCatalog(repositoryRoot, overlongPath).failures.includes(
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
    inspectTestCatalog(repositoryRoot, missingIntegration).failures.includes(
      `integration_corridor_integration_test_missing:${first.id}`,
    ),
  );

  assert.deepEqual(inspectTestCatalog(repositoryRoot, catalog).failures, []);
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
    inspectTestCatalog(repositoryRoot, missing).failures.includes(
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
    inspectTestCatalog(repositoryRoot, ownerMismatch).failures.includes(
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
    inspectTestCatalog(repositoryRoot, cycle).failures.includes(
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
    inspectTestCatalog(
      repositoryRoot,
      invalid as typeof catalog,
    ).failures.includes(`invalid_execution_profiles:${first.path}`),
  );
});

test("実行プロファイルの意味を試験ソースから推定しない", () => {
  const candidate = {
    ...catalog,
    executionProfiles: ["external_runner_mode"],
    tests: catalog.tests.map(({ executionProfiles, ...entry }) =>
      executionProfiles
        ? { ...entry, executionProfiles: ["external_runner_mode"] }
        : entry,
    ),
  };
  assert.deepEqual(inspectTestCatalog(repositoryRoot, candidate).failures, []);
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
      inspectTestCatalog(repositoryRoot, invalid).failures.some((failure) =>
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
  const failures = inspectTestCatalog(repositoryRoot, wrongTypes).failures;
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
      inspectTestCatalog(repositoryRoot, invalid).failures.includes(
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
  const failures = inspectTestCatalog(repositoryRoot, invalidArrays).failures;
  assert.ok(failures.includes(`invalid_semantic_tags:${first.path}`));
  assert.ok(failures.includes(`invalid_postconditions:${first.path}`));
});

/**
 * 完成Catalog受付の早期拒否と一回観測を検証する。
 * @responsibility 不正台帳で不要な走査をせず、同じ観測集合を返すことを固定する。
 * @trace CQS-UT-010
 * @precondition 本番台帳は変更せず、該当readだけを不正JSON内容へ差し替える。
 * @stimulus 構造不正・JSON不正・正常を完成受付へ渡す。
 * @observation status・catalog・観測回数と例外。
 * @oracle 構造不正は走査0、正常はDirectoryごと一回。JSON不正は空台帳にしない。
 * @cleanup readとDirectory観測をfinallyで復元する。
 */
test("完成Catalog受付は早期拒否と同じ観測集合を保持する", () => {
  const originalRead = fs.readFileSync,
    originalList = fs.readdirSync;
  const target = path.join(
    repositoryRoot,
    "07_Quality",
    "Registry",
    "test-catalog.json",
  );
  let content: string | null = "{}";
  const observed = new Map<string, number>();
  fs.readFileSync = ((...args: Parameters<typeof fs.readFileSync>) =>
    args[0] === target && content !== null
      ? content
      : Reflect.apply(originalRead, fs, args)) as typeof fs.readFileSync;
  fs.readdirSync = ((...args: Parameters<typeof fs.readdirSync>) => {
    const key = String(args[0]);
    observed.set(key, (observed.get(key) ?? 0) + 1);
    return Reflect.apply(originalList, fs, args);
  }) as typeof fs.readdirSync;
  try {
    const invalid = readTestCatalog(repositoryRoot);
    assert.equal(invalid.status, "invalid");
    assert.equal(invalid.catalog, null);
    assert.deepEqual(invalid.observedFiles, []);
    assert.equal(observed.size, 0);
    content = "{";
    assert.throws(() => readTestCatalog(repositoryRoot), SyntaxError);
    assert.equal(observed.size, 0);
    content = null;
    const ready = readTestCatalog(repositoryRoot);
    assert.equal(ready.status, "complete");
    assert.ok(ready.observedFiles.length > 0);
    assert.ok([...observed.values()].every((count) => count === 1));
  } finally {
    fs.readFileSync = originalRead;
    fs.readdirSync = originalList;
  }
});
