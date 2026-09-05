import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  inspectTestCatalog,
  inspectResourceIntensiveTestAuthority,
  loadTestCatalog,
  selectRegressionTests,
} from "../../test-catalog.ts";

const checkerRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const repositoryRoot = path.resolve(checkerRoot, "../..");
const catalog = loadTestCatalog(
  path.join(repositoryRoot, "07_Quality", "04_Test_Catalog.json"),
);

test("実在試験、登録試験、実行可能Ownerをexactに照合する", () => {
  assert.deepEqual(inspectTestCatalog(repositoryRoot, catalog), []);
});

test("変更した意味に対応する試験を選び、未分類の実装変更はOwner全件へ閉じる", () => {
  const focusedEntries = selectRegressionTests(catalog, [
    "40_Develop/coordinator/src/security/provider-lifecycle.ts",
  ]);
  assert.ok(focusedEntries.length > 0);
  assert.ok(focusedEntries.every((entry) => entry.owner === "coordinator"));
  assert.ok(
    focusedEntries.some((entry) => entry.path.includes("provider-lifecycle")),
  );

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

test("文書変更はRepository規則を検査するCheckerへ接続する", () => {
  const selectedEntries = selectRegressionTests(catalog, [
    "16_Quality_Assurance.md",
  ]);
  assert.ok(selectedEntries.length > 0);
  assert.ok(selectedEntries.every((entry) => entry.owner === "checker"));
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
