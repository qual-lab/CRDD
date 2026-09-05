import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectTestCatalog,
  inspectResourceIntensiveTestAuthority,
  loadTestCatalog,
  selectRegressionTests,
  testLevels,
  type TestCatalogEntry,
  type TestLevel,
} from "./test-catalog.ts";

const checkerRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(checkerRoot, "../..");
const catalogPath = path.join(
  repositoryRoot,
  "07_Quality",
  "04_Test_Catalog.json",
);

function valuesAfter(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1)
    if (process.argv[index] === name && process.argv[index + 1] !== undefined)
      values.push(process.argv[index + 1] as string);
  return values;
}

function valueAfter(name: string): string | null {
  return valuesAfter(name)[0] ?? null;
}

function positiveNumber(name: string): number | null {
  const raw = valueAfter(name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function nonNegativeNumber(name: string): number | null {
  const raw = valueAfter(name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function parseLevels(): Set<TestLevel> {
  const raw = valueAfter("--levels") ?? "unit,integration,system";
  const values = raw.split(",");
  const levels = values.filter((value): value is TestLevel =>
    testLevels.includes(value as TestLevel),
  );
  if (levels.length !== values.length)
    throw new Error("regression_runner_level_invalid");
  return new Set(levels);
}

function changedPathsFromGit(base: string): string[] {
  const result = spawnSync("git", ["diff", "--name-only", `${base}...HEAD`], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("regression_runner_git_diff_failed");
  return result.stdout.split(/\r?\n/u).filter(Boolean);
}

function assertResourceIntensiveAuthority(
  levels: ReadonlySet<TestLevel>,
): void {
  const failures = inspectResourceIntensiveTestAuthority(levels, {
    authorized: process.argv.includes("--resource-intensive-authorized"),
    purpose: valueAfter("--purpose"),
    environment: valueAfter("--environment"),
    maximumDurationMinutes: positiveNumber("--max-duration-minutes"),
    maximumInvocations: positiveNumber("--max-invocations"),
    maximumCredits: nonNegativeNumber("--max-credits"),
    cleanup: valueAfter("--cleanup"),
    stopCondition: valueAfter("--stop-condition"),
  });
  if (failures.length > 0) {
    process.stdout.write(
      `${JSON.stringify({ status: "not_authorized", reason: "resource_intensive_test_authority_required", failures, effectIssued: false })}\n`,
    );
    process.exit(2);
  }
}

function runNodeTests(
  owner: "checker" | "coordinator",
  entries: readonly TestCatalogEntry[],
  options: Readonly<{
    testNamePattern?: string;
    testSkipPattern?: string;
  }> = {},
): number {
  if (entries.length === 0) return 0;
  const root = path.join(repositoryRoot, "40_Develop", owner);
  const testPaths = entries.map(
    (entry) =>
      `./${path
        .relative(root, path.join(repositoryRoot, ...entry.path.split("/")))
        .split(path.sep)
        .join("/")}`,
  );
  const profileArguments = [
    ...(options.testNamePattern
      ? [`--test-name-pattern=${options.testNamePattern}`]
      : []),
    ...(options.testSkipPattern
      ? [`--test-skip-pattern=${options.testSkipPattern}`]
      : []),
  ];
  const result = spawnSync(
    process.execPath,
    ["--test", "--test-concurrency=1", ...profileArguments, ...testPaths],
    { cwd: root, stdio: "inherit", windowsHide: true },
  );
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function runPlatformTests(entries: readonly TestCatalogEntry[]): number {
  if (entries.length === 0) return 0;
  const result = spawnSync(
    "cargo",
    [
      "+1.94.1-x86_64-pc-windows-msvc",
      "test",
      "--frozen",
      "--all-features",
      "--target",
      "x86_64-pc-windows-msvc",
    ],
    {
      cwd: path.join(repositoryRoot, "40_Develop", "platform-access"),
      stdio: "inherit",
      windowsHide: true,
    },
  );
  if (result.error) throw result.error;
  return result.status ?? 1;
}

const catalog = loadTestCatalog(catalogPath);
const catalogFailures = inspectTestCatalog(repositoryRoot, catalog);
if (catalogFailures.length > 0) {
  process.stdout.write(
    `${JSON.stringify({ status: "blocked", reason: "test_catalog_invalid", failures: catalogFailures }, null, 2)}\n`,
  );
  process.exit(2);
}

const levels = parseLevels();
assertResourceIntensiveAuthority(levels);
const explicitChangedPaths = valuesAfter("--changed");
const base = valueAfter("--base");
const changedPaths = process.argv.includes("--all")
  ? [
      "40_Develop/coordinator/package.json",
      "40_Develop/checker/package.json",
      "40_Develop/platform-access/Cargo.toml",
    ]
  : explicitChangedPaths.length > 0
    ? explicitChangedPaths
    : base !== null
      ? changedPathsFromGit(base)
      : [];
if (changedPaths.length === 0) {
  process.stdout.write(
    `${JSON.stringify({ status: "blocked", reason: "regression_change_set_required", effectIssued: false })}\n`,
  );
  process.exit(2);
}

const selectedEntries = selectRegressionTests(catalog, changedPaths, levels);
const windowsProcessEntries = selectedEntries.filter((entry) =>
  entry.executionProfiles?.includes("windows_process_control"),
);
const isWindowsProcessControlRequired =
  process.platform === "win32" && windowsProcessEntries.length > 0;
if (
  !process.argv.includes("--plan") &&
  isWindowsProcessControlRequired &&
  !process.argv.includes("--windows-process-control-authorized")
) {
  process.stdout.write(
    `${JSON.stringify({ status: "blocked", reason: "windows_process_control_authority_required", requiredExecutionProfile: "windows_process_control", effectIssued: false })}\n`,
  );
  process.exit(2);
}
process.stdout.write(
  `${JSON.stringify(
    {
      contract: "crdd/regression-test-plan",
      contractRevision: 1,
      status: "planned",
      changedPaths,
      levels: [...levels],
      selected: selectedEntries.map((entry) => entry.path),
      requiredExecutionProfiles: [
        "restricted_process",
        ...(isWindowsProcessControlRequired ? ["windows_process_control"] : []),
      ],
      unexecutedResourceIntensive: catalog.tests
        .filter(
          (entry) =>
            entry.level === "performance" || entry.level === "longevity",
        )
        .filter((entry) => !levels.has(entry.level))
        .map((entry) => entry.path),
    },
    null,
    2,
  )}\n`,
);
if (process.argv.includes("--plan")) process.exit(0);
if (
  selectedEntries.some(
    (entry) => entry.externalProviderEffect || entry.humanInput,
  )
) {
  process.stdout.write(
    `${JSON.stringify({ status: "blocked", reason: "interactive_or_provider_test_not_automatically_authorized", effectIssued: false })}\n`,
  );
  process.exit(2);
}

for (const owner of ["checker", "coordinator"] as const) {
  const status = runNodeTests(
    owner,
    selectedEntries.filter((entry) => entry.owner === owner),
    owner === "coordinator" && isWindowsProcessControlRequired
      ? { testSkipPattern: "^Windows Process Gate:" }
      : {},
  );
  if (status !== 0) process.exit(status);
}
if (isWindowsProcessControlRequired) {
  const status = runNodeTests("coordinator", windowsProcessEntries, {
    testNamePattern: "^Windows Process Gate:",
  });
  if (status !== 0) process.exit(status);
}
const platformStatus = runPlatformTests(
  selectedEntries.filter((entry) => entry.owner === "platform-access"),
);
if (platformStatus !== 0) process.exit(platformStatus);
process.stdout.write(
  `${JSON.stringify({ status: "completed", selectedCount: selectedEntries.length })}\n`,
);
