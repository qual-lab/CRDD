/**
 * checker:unit:test-catalog-selectionの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility checker:unit:test-catalog-selectionが所有する検証責務を実行する。
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
import { readTestCatalog } from "../../../../document-model/src/index.ts";
import { buildRegressionStagePlan } from "../../../src/test-catalog/plan.ts";
import {
  inspectResourceIntensiveTestAuthority,
  selectRegressionStaticOwners,
  selectRegressionTests,
} from "../../../src/test-catalog/selection.ts";

const checkerRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const repositoryRoot = path.resolve(checkerRoot, "../..");
const catalogIntake = readTestCatalog(repositoryRoot);
assert.equal(catalogIntake.status, "complete");
const loadedCatalog = catalogIntake.catalog;
const catalog = loadedCatalog;

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
  assert.deepEqual(catalogIntake.failures, []);
  const expected =
    "40_Develop/coordinator/tests/integration/host-recovery-record.contract.test.ts";
  assert.ok(catalogIntake.observedFiles.includes(expected));
  for (const changed of [
    "40_Develop/coordinator/src/lifecycle/environment.ts",
    "40_Develop/coordinator/src/lifecycle/host.ts",
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
    "docker-isolation:integration:restart-machine",
    "docker-isolation:integration:restart-runtime",
  ]) {
    assert.ok(
      expected.some((entry) => entry.id === id),
      id,
    );
  }
  const found = catalogIntake.observedFiles.filter((entry) =>
    entry.startsWith("40_Develop/docker-isolation/"),
  );
  assert.deepEqual(
    [...found].sort(),
    expected.map((entry) => entry.path).sort(),
  );
  const changed = ["40_Develop/docker-isolation/src/execution/execute.ts"];
  const selected = selectRegressionTests(catalog, changed);
  for (const entry of expected)
    assert.ok(
      selected.some((item) => item.id === entry.id),
      entry.id,
    );
  assert.deepEqual(selectRegressionStaticOwners(catalog, changed, selected), [
    "coordinator",
    "docker-isolation",
    "executor",
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
  const discovered = catalogIntake.observedFiles;
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
    catalogIntake.failures.some(
      (issue) =>
        issue.startsWith("unsupported_owner:") &&
        issue.includes("access-management"),
    ),
    false,
  );
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
    "40_Develop/coordinator/src/lifecycle/environment.ts",
  ]);
  const coordinatorEntries = catalog.tests.filter(
    (entry) =>
      entry.owner === "coordinator" &&
      ["unit", "integration", "system"].includes(entry.level),
  );
  const consumerIds = [
    "mcp:unit:orchestrator",
    "mcp:system:stdio",
    "mcp:system:streamable-http",
  ];
  const expectedIds = [
    ...coordinatorEntries.map((entry) => entry.id),
    ...consumerIds,
  ].sort();
  assert.deepEqual(focusedEntries.map((entry) => entry.id).sort(), expectedIds);

  const conservativeEntries = selectRegressionTests(catalog, [
    "40_Develop/coordinator/src/security/novelquux.ts",
  ]);
  assert.deepEqual(
    conservativeEntries.map((entry) => entry.id).sort(),
    expectedIds,
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
    "40_Develop/coordinator/tests/unit/workspace/acceptance-record.contract.test.ts";
  assert.deepEqual(
    selectRegressionTests(catalog, [target]).map((entry) => entry.path),
    [target],
  );
});

/**
 * CLI移管後も登録された下位試験の利用側閉包を維持する。
 * @responsibility Coordinator入力・受付の変更でCoordinator側の接続試験を落とさない。
 * @trace CQS-UT-010
 * @precondition 現行Catalogを使用する。
 * @stimulus 移管先の入力・受付Sourceを変更対象として選択する。
 * @observation 回帰として選択された試験Path。
 * @oracle 実Process・取消・stdin分離の三試験を含む。
 * @cleanup N/A: 純粋な選択のみ。
 * @boundary Catalogと選択処理。試験自体は実行しない。
 */
test("OrchestratorのCLI移管は既存のProcess・取消・入力接続試験へ閉じる", () => {
  for (const file of ["request-input.ts", "request.ts"]) {
    const selected = new Set(
      selectRegressionTests(catalog, [
        `40_Develop/coordinator/src/cli/${file}`,
      ]).map((entry) => entry.path),
    );
    for (const target of [
      "integration/coordinator-task-process.integration.test.ts",
      "integration/task-cli-cancellation.contract.test.ts",
      "system/interaction-boundary-regression.contract.test.ts",
    ])
      assert.ok(selected.has(`40_Develop/coordinator/tests/${target}`), target);
  }
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
      "40_Develop/execution-intelligence/src/record/execution.ts",
      "40_Develop/coordinator/tests/integration/provider-intelligence.contract.test.ts",
    ],
    [
      "40_Develop/execution-intelligence/src/storage/store.ts",
      "40_Develop/coordinator/tests/integration/provider-intelligence.contract.test.ts",
    ],
    [
      "40_Develop/execution-intelligence/src/index.ts",
      "40_Develop/coordinator/tests/integration/provider-intelligence.contract.test.ts",
    ],
  ] as const) {
    const selectedPaths = selectRegressionTests(catalog, [changedPath]).map(
      (entry) => entry.path,
    );
    assert.ok(ownerPaths.every((entry) => selectedPaths.includes(entry)));
    assert.ok(selectedPaths.includes(consumerPath));
    assert.ok(
      selectedPaths.some((entry) =>
        entry.includes("coordinator/tests/integration/provider-intelligence"),
      ),
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
    "40_Develop/execution-intelligence/src/record/execution.ts",
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
    "40_Develop/docker-isolation/src/docker-cli/trust.ts",
    "40_Develop/docker-isolation/src/docker-desktop/command.ts",
    "40_Develop/docker-isolation/src/docker-desktop/restart-state.ts",
    "40_Develop/docker-isolation/src/index.ts",
  ]) {
    const selected = selectRegressionTests(catalog, [changedPath]);
    assert.ok(
      selected.some(
        (entry) =>
          entry.id ===
          (changedPath.endsWith("command.ts")
            ? "docker-isolation:integration:desktop-command"
            : "docker-isolation:integration:restart-runtime"),
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
  const expected = catalog.tests
    .filter(
      (entry) =>
        entry.owner === "coordinator" &&
        ["unit", "integration", "system"].includes(entry.level),
    )
    .map((entry) => entry.id)
    .concat([
      "mcp:unit:orchestrator",
      "mcp:system:stdio",
      "mcp:system:streamable-http",
    ])
    .sort();
  for (const changedPath of [
    "40_Develop/coordinator/src/cli/command.ts",
    "40_Develop/coordinator/tests/support/contract-assertions.ts",
    "40_Develop/coordinator/tests/fixtures/example.ts",
  ])
    assert.deepEqual(
      selectRegressionTests(catalog, [changedPath])
        .map((entry) => entry.id)
        .sort(),
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
    "40_Develop/lock/README.md",
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
    readCatalogInput(invalid).failures.includes(
      `resource_intensive_default:${first.path}`,
    ),
  );
});

/**
 * 不正台帳を完成受付へ渡すため、今回の読取りだけを固定本文へ差し替える。
 * @responsibility 実在集合の検査は本番受付へ委譲し、試験後にreadを必ず復元する。
 * @trace CQS-UT-010
 * @precondition 実Repositoryの台帳を変更しない。
 * @stimulus 該当Pathのreadだけを候補JSONへ差し替える。
 * @observation 完成受付の失敗理由。
 * @oracle 既存の未知実行条件拒否を維持する。
 * @cleanup finallyでread関数を復元する。
 */
function readCatalogInput(candidate: unknown) {
  const original = fs.readFileSync;
  const target = path.join(
    repositoryRoot,
    "07_Quality",
    "Registry",
    "test-catalog.json",
  );
  fs.readFileSync = ((...args: Parameters<typeof fs.readFileSync>) =>
    args[0] === target
      ? JSON.stringify(candidate)
      : Reflect.apply(original, fs, args)) as typeof fs.readFileSync;
  try {
    return readTestCatalog(repositoryRoot);
  } finally {
    fs.readFileSync = original;
  }
}
