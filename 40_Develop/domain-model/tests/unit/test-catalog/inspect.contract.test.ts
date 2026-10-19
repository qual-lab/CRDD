/**
 * domain-model:unit:test-catalogの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility domain-model:unit:test-catalogが所有する検証責務を実行する。
 * @trace CQS-UT-010
 * @level UT
 * @scope test、catalog
 * @boundary CQS-UT-010=N/A: Test CatalogとOwner／Path／Levelは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { buildRegressionStagePlan } from "../../../src/test-catalog/plan.ts";
import { fileURLToPath } from "node:url";
import {
  inspectTestCatalog,
  inspectResourceIntensiveTestAuthority,
  discoverRepositoryTestFiles,
  loadTestCatalog,
  selectRegressionStaticOwners,
  selectRegressionTests,
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
 * 実在試験、登録試験、実行可能Ownerをexactに照合するを検証する。
 *
 * @responsibility 実在試験、登録試験、実行可能Ownerをexactに照合するの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実在試験、登録試験、実行可能Ownerをexactに照合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("実在試験、登録試験、実行可能Ownerをexactに照合する", () => {
  assert.deepEqual(inspectTestCatalog(repositoryRoot, loadedCatalog), []);
  const expected =
    "40_Develop/coordinator/tests/integration/host-recovery-record.contract.test.ts";
  assert.ok(discoverRepositoryTestFiles(repositoryRoot).includes(expected));
  for (const changed of [
    "40_Develop/coordinator/src/host-execution/recovery-record.ts",
    "40_Develop/coordinator/src/host-execution/operation-workspace-lifecycle.ts",
  ] as const) {
    const selected = selectRegressionTests(catalog, [changed]);
    assert.ok(
      selected.some(
        (entry) =>
          entry.path === expected &&
          entry.id === "coordinator:integration:host-recovery-record",
      ),
    );
    const owners = selectRegressionStaticOwners(catalog, [changed], selected);
    assert.ok(owners.includes("coordinator"));
    const stages = buildRegressionStagePlan(selected, [changed], true, owners);
    assert.ok(
      stages
        .find((stage) => stage.stage === "windows_process_control")
        ?.selected.includes(expected),
    );
  }
});

/**
 * 同じPlatform Access OwnerのNode／Rust収集と片系欠落を確認する。
 * @responsibility 既存Rustだけまたは新Nodeだけの登録を全体成立へ丸めない。
 * @trace CQS-UT-010
 * @precondition 実Repositoryに両言語の試験が存在する。
 * @stimulus Source変更から選択し、各言語の登録を欠落させる。
 * @observation 選択Path、Owner、Catalogの拒否理由。
 * @oracle 両言語が選択され、片系欠落は検査失敗、上位Consumerの静的検査も選択する。
 * @cleanup N/A: 読取りとProcess内の値変換のみ。
 * @boundary 実試験台帳・収集・選択の結合。
 */
test("Platform AccessはNodeとRust双方を収集し片系欠落を拒否する", () => {
  const changed = [
    "40_Develop/platform-access/src/artifact/identity-observation.ts",
  ];
  const selected = selectRegressionTests(catalog, changed);
  for (const suffix of [".test.ts", ".rs"]) {
    assert.ok(
      selected.some(
        (entry) =>
          entry.owner === "platform-access" && entry.path.endsWith(suffix),
      ),
    );
    const incomplete = {
      ...catalog,
      tests: catalog.tests.filter(
        (entry) =>
          entry.owner !== "platform-access" || !entry.path.endsWith(suffix),
      ),
    };
    assert.ok(
      inspectTestCatalog(repositoryRoot, incomplete).some((failure) =>
        failure.startsWith("unregistered_test:"),
      ),
    );
  }
  assert.deepEqual(selectRegressionStaticOwners(catalog, changed, selected), [
    "coordinator",
    "docker-isolation",
    "platform-access",
  ]);
});

/**
 * 新隔離Ownerの全試験と上位利用側を識別する。
 *
 * @responsibility Package境界による収集・Owner・静的Consumer選択を確認する。
 * @trace CQS-UT-010
 * @precondition 現行台帳に下位の実在全Fileと上位利用側Fileが登録済みである。
 * @stimulus 下位Source変更と上位の同名試験変更から回帰対象を選ぶ。
 * @observation 収集集合とOwnerを取得する。
 * @oracle File名のdocker-isolationから上位試験を下位Ownerへ誤分類しない。
 * @cleanup N/A: 現在Repositoryの読取りだけ。
 * @boundary Package Rootと試験収集・利用側選択。
 */
test("Docker Isolation全試験を収集し上位の同名試験を混同しない", () => {
  const expected = catalog.tests.filter(
    (entry) => entry.owner === "docker-isolation",
  );
  assert.ok(expected.length > 0);
  for (const id of [
    "docker-isolation:integration:native-process",
    "docker-isolation:integration:restart-machine",
    "docker-isolation:integration:restart-runtime",
  ]) {
    assert.ok(
      expected.some((entry) => entry.id === id),
      id,
    );
  }
  const found = discoverRepositoryTestFiles(repositoryRoot).filter((entry) =>
    entry.startsWith("40_Develop/docker-isolation/"),
  );
  assert.deepEqual(
    [...found].sort(),
    expected.map((entry) => entry.path).sort(),
  );
  const changed = [
    "40_Develop/docker-isolation/src/execution/command-runtime.ts",
  ];
  const selected = selectRegressionTests(catalog, changed);
  for (const entry of expected)
    assert.ok(
      selected.some((item) => item.id === entry.id),
      entry.id,
    );
  assert.deepEqual(selectRegressionStaticOwners(catalog, changed, selected), [
    "coordinator",
    "docker-isolation",
  ]);
  for (const file of [
    "docker-isolation-host.integration.test.ts",
    "runtime-assets.contract.test.ts",
  ]) {
    const target = `40_Develop/coordinator/tests/integration/${file}`;
    const direct = selectRegressionTests(catalog, [target]);
    assert.deepEqual(
      direct.map((entry) => entry.path),
      [target],
    );
    assert.equal(direct[0]?.owner, "coordinator");
    assert.deepEqual(selectRegressionStaticOwners(catalog, [target], direct), [
      "coordinator",
    ]);
  }
});

/**
 * Access Managementの試験収集とPackage境界によるOwner判定を確認する。
 *
 * @responsibility AM試験の収集漏れと、MCP内の名前からの誤ったOwner判定を検出する。
 * @trace CQS-UT-010
 * @precondition 現行台帳にAM試験とMCPのAM結果試験が登録されている。
 * @stimulus 実在試験を収集し、両Packageの変更から回帰対象を選択する。
 * @observation 収集Path、対象試験、静的検査Ownerを取得する。
 * @oracle AMの全登録試験を収集し、MCP内のAM名を持つ試験はMCPのままとする。
 * @cleanup N/A: Repositoryの読取りと局所値の評価だけを行う。
 * @boundary CQS-UT-010=Direct Boundary: Package Root→試験収集・Owner判定
 */
test("AM試験を収集しMCP内のAM名を持つ試験のOwnerを混同しない", () => {
  const expected = catalog.tests.filter(
    (entry) => entry.owner === "access-management",
  );
  assert.ok(expected.length > 0);
  const discovered = discoverRepositoryTestFiles(repositoryRoot);
  for (const entry of expected)
    assert.ok(discovered.includes(entry.path), entry.path);
  const selected = selectRegressionTests(catalog, [
    "40_Develop/access-management/src/index.ts",
  ]);
  for (const entry of expected)
    assert.ok(
      selected.some((test) => test.id === entry.id),
      entry.id,
    );
  assert.deepEqual(
    selectRegressionStaticOwners(
      catalog,
      ["40_Develop/access-management/src/index.ts"],
      selected,
    ),
    ["access-management"],
  );
  const mcpPath =
    "40_Develop/mcp-server/tests/integration/access-management-results.integration.test.ts";
  const mcp = catalog.tests.find((entry) => entry.path === mcpPath);
  assert.equal(mcp?.owner, "mcp-server");
  assert.deepEqual(
    selectRegressionTests(catalog, [mcpPath]).map((entry) => entry.path),
    [mcpPath],
  );
  assert.deepEqual(
    selectRegressionStaticOwners(
      catalog,
      [mcpPath],
      selectRegressionTests(catalog, [mcpPath]),
    ),
    ["mcp-server"],
  );
  assert.equal(
    inspectTestCatalog(repositoryRoot, catalog).some(
      (issue) =>
        issue.startsWith("unsupported_owner:") &&
        issue.includes("access-management"),
    ),
    false,
  );
});

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
      "coordinator",
      "docker-isolation",
      "domain-model",
      "execution-intelligence",
      "mcp-server",
      "orchestrator",
      "platform-access",
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
      (entry) => entry.owner !== "platform-access",
    ),
  };
  assert.ok(
    inspectTestCatalog(repositoryRoot, withoutPlatform).includes(
      "integration_block_owner_missing:platform-access",
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
 * 変更した意味に対応する試験を選び、未分類の実装変更はOwner全件へ閉じるを検証する。
 *
 * @responsibility 変更した意味に対応する試験を選び、未分類の実装変更はOwner全件へ閉じるの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 変更した意味に対応する試験を選び、未分類の実装変更はOwner全件へ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("変更した意味に対応する試験を選び、未分類の実装変更はOwner全件へ閉じる", () => {
  const focusedEntries = selectRegressionTests(catalog, [
    "40_Develop/coordinator/src/provider/lifecycle.ts",
  ]);
  const coordinatorEntries = catalog.tests.filter(
    (entry) =>
      entry.owner === "coordinator" &&
      ["unit", "integration", "system"].includes(entry.level),
  );
  assert.equal(focusedEntries.length, coordinatorEntries.length);
  assert.ok(focusedEntries.every((entry) => entry.owner === "coordinator"));

  const conservativeEntries = selectRegressionTests(catalog, [
    "40_Develop/coordinator/src/security/novelquux.ts",
  ]);
  assert.equal(
    conservativeEntries.length,
    catalog.tests.filter(
      (entry) =>
        entry.owner === "coordinator" &&
        ["unit", "integration", "system"].includes(entry.level),
    ).length,
  );
});

/**
 * 直接変更した試験だけはその試験に限定するを検証する。
 *
 * @responsibility 直接変更した試験だけはその試験に限定するの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 直接変更した試験だけはその試験に限定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("直接変更した試験だけはその試験に限定する", () => {
  const target =
    "40_Develop/coordinator/tests/unit/command-report.contract.test.ts";
  assert.deepEqual(
    selectRegressionTests(catalog, [target]).map((entry) => entry.path),
    [target],
  );
});

/**
 * 実行知の実装変更は共通試験と登録済み利用側契約を選ぶを検証する。
 *
 * @responsibility 実行知の実装変更は共通試験と登録済み利用側契約を選ぶの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行知の実装変更は共通試験と登録済み利用側契約を選ぶの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("実行知の実装変更は共通試験と登録済み利用側契約を選ぶ", () => {
  const ownerPaths = catalog.tests
    .filter(
      (entry) =>
        entry.owner === "execution-intelligence" &&
        ["unit", "integration", "system"].includes(entry.level),
    )
    .map((entry) => entry.path)
    .sort();
  for (const [changedPath, consumerPath] of [
    [
      "40_Develop/execution-intelligence/src/record/event-and-summary.ts",
      "40_Develop/coordinator/tests/integration/orchestrator-execution.contract.test.ts",
    ],
    [
      "40_Develop/execution-intelligence/src/store/events.ts",
      "40_Develop/coordinator/tests/integration/orchestrator-composition-root.integration.test.ts",
    ],
    [
      "40_Develop/execution-intelligence/src/index.ts",
      "40_Develop/coordinator/tests/integration/orchestrator-execution.contract.test.ts",
    ],
  ] as const) {
    const selectedPaths = selectRegressionTests(catalog, [changedPath]).map(
      (entry) => entry.path,
    );
    assert.ok(ownerPaths.every((entry) => selectedPaths.includes(entry)));
    assert.ok(selectedPaths.includes(consumerPath));
    assert.ok(
      selectedPaths.some((entry) =>
        entry.includes("orchestrator-composition-root"),
      ) || changedPath.includes("core"),
    );
  }
});

/**
 * 利用側静的検査は試験levelの絞込みと独立して選ぶを検証する。
 *
 * @responsibility 利用側静的検査は試験levelの絞込みと独立して選ぶの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 利用側静的検査は試験levelの絞込みと独立して選ぶの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("利用側静的検査は試験levelの絞込みと独立して選ぶ", () => {
  const changedPaths = [
    "40_Develop/execution-intelligence/src/record/event-and-summary.ts",
  ];
  const selectedEntries = selectRegressionTests(
    catalog,
    changedPaths,
    new Set(["unit"]),
  );
  assert.ok(selectedEntries.every((entry) => entry.level === "unit"));
  assert.deepEqual(
    selectRegressionStaticOwners(catalog, changedPaths, selectedEntries),
    ["coordinator", "execution-intelligence"],
  );
});

/**
 * Docker実行物Trustの変更から下位技術と上位利用側の回帰を選ぶ。
 * @responsibility 下位単独変更による上位契約試験と静的検査の選択漏れを検出する。
 * @trace CQS-UT-010
 * @precondition 実Test Catalogと公開選択関数を使用する。
 * @stimulus cli-trust、Native、Machine実装とPackage Rootをそれぞれ変更Pathに指定する。
 * @observation 選択したTest IDと静的検査Ownerを取得する。
 * @oracle 全Pathとも下位Native試験、上位本番組立て・実観測試験と両Ownerの静的検査を含む。選択は実起動の許可ではない。
 * @cleanup N/A: 試験を実行せず、固定Catalogから集合を導く。
 * @boundary CQS-UT-010=N/A: 選択はProcess内の純粋な集合導出である。
 */
test("Docker TrustとRoot変更は下位技術と上位利用側を選ぶ", () => {
  for (const changedPath of [
    "40_Develop/docker-isolation/src/execution/cli-trust.ts",
    "40_Develop/docker-isolation/src/desktop/native-process.ts",
    "40_Develop/docker-isolation/src/desktop/restart-machine.ts",
    "40_Develop/docker-isolation/src/index.ts",
  ]) {
    const selected = selectRegressionTests(catalog, [changedPath]);
    assert.ok(
      selected.some(
        (entry) => entry.id === "docker-isolation:integration:native-process",
      ),
    );
    assert.ok(
      selected.some(
        (entry) =>
          entry.id === "coordinator:integration:docker-restart-runtime",
      ),
    );
    assert.ok(
      selected.some(
        (entry) =>
          entry.id ===
          "coordinator:integration:docker-restart-real-observation",
      ),
    );
    assert.ok(
      selectRegressionStaticOwners(catalog, [changedPath], selected).includes(
        "docker-isolation",
      ),
    );
    assert.ok(
      selectRegressionStaticOwners(catalog, [changedPath], selected).includes(
        "coordinator",
      ),
    );
  }
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
 * 利用側契約の未分類Producer変更は登録済み利用側全件へ閉じるを検証する。
 *
 * @responsibility 利用側契約の未分類Producer変更は登録済み利用側全件へ閉じるの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 利用側契約の未分類Producer変更は登録済み利用側全件へ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("利用側契約の未分類Producer変更は登録済み利用側全件へ閉じる", () => {
  for (const producerOwner of [
    ...new Set(catalog.consumerBindings.map((entry) => entry.producerOwner)),
  ]) {
    const selectedPaths = selectRegressionTests(catalog, [
      `40_Develop/${producerOwner}/src/new-boundary.ts`,
    ]).map((entry) => entry.path);
    for (const binding of catalog.consumerBindings.filter(
      (entry) => entry.producerOwner === producerOwner,
    ))
      for (const testId of binding.testIds) {
        const entry = catalog.tests.find(
          (candidate) => candidate.id === testId,
        );
        assert.ok(entry);
        assert.ok(selectedPaths.includes(entry.path));
      }
  }
});

/**
 * production・support・fixture変更はownerのUT／IT／ST全件へ閉じるを検証する。
 *
 * @responsibility production・support・fixture変更はownerのUT／IT／ST全件へ閉じるの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production・support・fixture変更はownerのUT／IT／ST全件へ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("production・support・fixture変更はownerのUT／IT／ST全件へ閉じる", () => {
  const expected = catalog.tests.filter(
    (entry) =>
      entry.owner === "coordinator" &&
      ["unit", "integration", "system"].includes(entry.level),
  ).length;
  for (const changedPath of [
    "40_Develop/coordinator/src/cli/command-report.ts",
    "40_Develop/coordinator/tests/support/contract-assertions.ts",
    "40_Develop/coordinator/tests/fixtures/example.ts",
  ])
    assert.equal(
      selectRegressionTests(catalog, [changedPath]).length,
      expected,
    );
});

/**
 * 共有設定とowner不明の実行変更は全ownerへ閉じるを検証する。
 *
 * @responsibility 共有設定とowner不明の実行変更は全ownerへ閉じるの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 共有設定とowner不明の実行変更は全ownerへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("共有設定とowner不明の実行変更は全ownerへ閉じる", () => {
  const expected = catalog.tests.filter((entry) =>
    ["unit", "integration", "system"].includes(entry.level),
  ).length;
  for (const changedPath of [
    "07_Quality/Registry/test-catalog.json",
    "biome.json",
    "custom-runtime-config.json",
  ])
    assert.equal(
      selectRegressionTests(catalog, [changedPath]).length,
      expected,
    );
});

/**
 * 文書変更はRepository規則を検査するCheckerへ接続するを検証する。
 *
 * @responsibility 文書変更はRepository規則を検査するCheckerへ接続するの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 文書変更はRepository規則を検査するCheckerへ接続するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("文書変更はRepository規則を検査するCheckerへ接続する", () => {
  for (const changedPath of [
    "16_Quality_Assurance.md",
    "40_Develop/coordinator/README.md",
    "40_Develop/platform-access/README.md",
  ]) {
    const selectedEntries = selectRegressionTests(catalog, [changedPath]);
    assert.ok(selectedEntries.length > 0);
    assert.ok(
      selectedEntries.every((entry) => entry.owner === "checker"),
      changedPath,
    );
  }
});

/**
 * PT／LTは明示Authorityと全上限がなければEffect前に拒否するを検証する。
 *
 * @responsibility PT／LTは明示Authorityと全上限がなければEffect前に拒否するの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PT／LTは明示Authorityと全上限がなければEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("PT／LTは明示Authorityと全上限がなければEffect前に拒否する", () => {
  const levels = new Set(["performance"] as const);
  assert.deepEqual(
    inspectResourceIntensiveTestAuthority(levels, {
      authorized: false,
      purpose: null,
      environment: null,
      maximumDurationMinutes: null,
      maximumInvocations: null,
      maximumCredits: null,
      cleanup: null,
      stopCondition: null,
    }),
    [
      "authorization_missing",
      "purpose_missing",
      "environment_missing",
      "duration_cap_missing",
      "invocation_cap_missing",
      "credit_cap_missing",
      "cleanup_missing",
      "stop_condition_missing",
    ],
  );
  assert.deepEqual(
    inspectResourceIntensiveTestAuthority(levels, {
      authorized: true,
      purpose: "bounded performance observation",
      environment: "fixed local fixture",
      maximumDurationMinutes: 5,
      maximumInvocations: 10,
      maximumCredits: 0,
      cleanup: "remove generated fixture data",
      stopCondition: "stop on first failure",
    }),
    [],
  );
});

/**
 * 通常回帰は任意PT／LTを選ばず、PT／LTの既定必須化を拒否するを検証する。
 *
 * @responsibility 通常回帰は任意PT／LTを選ばず、PT／LTの既定必須化を拒否するの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 通常回帰は任意PT／LTを選ばず、PT／LTの既定必須化を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=Direct Boundary: Domain Test Source→対象契約
 */
test("通常回帰は任意PT／LTを選ばず、PT／LTの既定必須化を拒否する", () => {
  const normalEntries = selectRegressionTests(catalog, [
    "40_Develop/coordinator/package.json",
  ]);
  assert.ok(
    normalEntries.every(
      (entry) => entry.level !== "performance" && entry.level !== "longevity",
    ),
  );

  const first = catalog.tests[0];
  assert.ok(first);
  const invalid = {
    ...catalog,
    tests: [
      ...catalog.tests.slice(1),
      {
        ...first,
        level: "performance" as const,
        mandatoryByDefault: true,
      },
    ],
  };
  assert.ok(
    inspectTestCatalog(repositoryRoot, invalid).includes(
      `resource_intensive_default:${first.path}`,
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
