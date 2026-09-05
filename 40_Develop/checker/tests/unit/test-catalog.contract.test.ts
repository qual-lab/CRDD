import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  inspectTestCatalog,
  inspectResourceIntensiveTestAuthority,
  loadTestCatalog,
  selectRegressionStaticOwners,
  selectRegressionTests,
  type TestCatalog,
} from "../../test-catalog.ts";

const checkerRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const repositoryRoot = path.resolve(checkerRoot, "../..");
const loadedCatalog = loadTestCatalog(
  path.join(repositoryRoot, "07_Quality", "04_Test_Catalog.json"),
);
const catalog = loadedCatalog as TestCatalog;

test("実在試験、登録試験、実行可能Ownerをexactに照合する", () => {
  assert.deepEqual(inspectTestCatalog(repositoryRoot, loadedCatalog), []);
});

test("変更した意味に対応する試験を選び、未分類の実装変更はOwner全件へ閉じる", () => {
  const focusedEntries = selectRegressionTests(catalog, [
    "40_Develop/coordinator/src/security/provider-lifecycle.ts",
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

test("直接変更した試験だけはその試験に限定する", () => {
  const target =
    "40_Develop/coordinator/tests/unit/command-report.contract.test.ts";
  assert.deepEqual(
    selectRegressionTests(catalog, [target]).map((entry) => entry.path),
    [target],
  );
});

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
      "40_Develop/execution-intelligence/src/core/execution-intelligence.ts",
      "40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts",
    ],
    [
      "40_Develop/execution-intelligence/src/store/execution-intelligence-store.ts",
      "40_Develop/coordinator/tests/integration/project-runtime-public-runtime.integration.test.ts",
    ],
    [
      "40_Develop/execution-intelligence/src/index.ts",
      "40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts",
    ],
  ]) {
    const selectedPaths = selectRegressionTests(catalog, [changedPath]).map(
      (entry) => entry.path,
    );
    assert.ok(ownerPaths.every((entry) => selectedPaths.includes(entry)));
    assert.ok(selectedPaths.includes(consumerPath));
    assert.ok(
      selectedPaths.some((entry) =>
        entry.includes("project-runtime-public-runtime"),
      ) || changedPath.includes("core"),
    );
  }
});

test("利用側静的検査は試験levelの絞込みと独立して選ぶ", () => {
  const changedPaths = [
    "40_Develop/execution-intelligence/src/core/execution-intelligence.ts",
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

test("利用側契約は欠落・Owner不一致・循環を拒否する", () => {
  const first = catalog.consumerBindings[0];
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

test("利用側契約の未分類Producer変更は登録済み利用側全件へ閉じる", () => {
  const selectedPaths = selectRegressionTests(catalog, [
    "40_Develop/execution-intelligence/src/new-boundary.ts",
  ]).map((entry) => entry.path);
  for (const binding of catalog.consumerBindings)
    for (const testId of binding.testIds) {
      const entry = catalog.tests.find((candidate) => candidate.id === testId);
      assert.ok(entry);
      assert.ok(selectedPaths.includes(entry.path));
    }
});

test("production・support・fixture変更はownerのUT／IT／ST全件へ閉じる", () => {
  const expected = catalog.tests.filter(
    (entry) =>
      entry.owner === "coordinator" &&
      ["unit", "integration", "system"].includes(entry.level),
  ).length;
  for (const changedPath of [
    "40_Develop/coordinator/src/core/command-report.ts",
    "40_Develop/coordinator/tests/support/test-support.ts",
    "40_Develop/coordinator/tests/fixtures/example.ts",
  ])
    assert.equal(
      selectRegressionTests(catalog, [changedPath]).length,
      expected,
    );
});

test("共有設定とowner不明の実行変更は全ownerへ閉じる", () => {
  const expected = catalog.tests.filter((entry) =>
    ["unit", "integration", "system"].includes(entry.level),
  ).length;
  for (const changedPath of [
    "07_Quality/04_Test_Catalog.json",
    "biome.json",
    "custom-runtime-config.json",
  ])
    assert.equal(
      selectRegressionTests(catalog, [changedPath]).length,
      expected,
    );
});

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

test("Windows実Process Gateの3 fileと実行Profileをexactに照合する", () => {
  const gatePaths = [
    "40_Develop/coordinator/tests/integration/coordinator-task-process.integration.test.ts",
    "40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts",
    "40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts",
  ];
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
