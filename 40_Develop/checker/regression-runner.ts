import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRegressionStagePlan,
  collectChangedPathsFromGit,
  createRegressionStageExecutor,
  executeRegressionStages,
  normalizeExplicitChangedPaths,
  regressionStageOrder,
} from "./regression-execution.ts";
import {
  inspectResourceIntensiveTestAuthority,
  inspectTestCatalog,
  loadTestCatalog,
  selectRegressionTests,
  testLevels,
  type TestCatalog,
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
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const PLATFORM_TOOLCHAIN = "+1.94.1-x86_64-pc-windows-msvc";
const PLATFORM_TARGET = "x86_64-pc-windows-msvc";

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

function inspectRequestedResourceAuthority(levels: ReadonlySet<TestLevel>) {
  const authority = {
    authorized: process.argv.includes("--resource-intensive-authorized"),
    purpose: valueAfter("--purpose"),
    environment: valueAfter("--environment"),
    maximumDurationMinutes: positiveNumber("--max-duration-minutes"),
    maximumInvocations: positiveNumber("--max-invocations"),
    maximumCredits: nonNegativeNumber("--max-credits"),
    cleanup: valueAfter("--cleanup"),
    stopCondition: valueAfter("--stop-condition"),
  };
  return {
    authority,
    failures: inspectResourceIntensiveTestAuthority(levels, authority),
  };
}

function runCommand(
  command: string,
  commandArguments: readonly string[],
  cwd: string,
): number {
  const result = spawnSync(command, commandArguments, {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error !== undefined) return 1;
  return result.status ?? 1;
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
  return runCommand(
    process.execPath,
    ["--test", "--test-concurrency=1", ...profileArguments, ...testPaths],
    root,
  );
}

function runPlatformTests(level: TestLevel): number {
  if (level !== "unit" && level !== "integration") return 0;
  const selectors =
    level === "unit" ? ["--bin", "crdd-platform-access"] : ["--test", "cli"];
  return runCommand(
    "cargo",
    [
      PLATFORM_TOOLCHAIN,
      "test",
      "--frozen",
      "--all-features",
      "--target",
      PLATFORM_TARGET,
      ...selectors,
    ],
    path.join(repositoryRoot, "40_Develop", "platform-access"),
  );
}

function selectedOwners(entries: readonly TestCatalogEntry[]) {
  return new Set(entries.map((entry) => entry.owner));
}

function runStaticStage(
  entries: readonly TestCatalogEntry[],
  changedPaths: readonly string[],
): number {
  const owners = selectedOwners(entries);
  if (owners.has("checker")) {
    const checkerStatus = runCommand(npmCommand, ["run", "check"], checkerRoot);
    if (checkerStatus !== 0) return checkerStatus;
    if (changedPaths.some((entry) => entry.toLowerCase().endsWith(".md"))) {
      const repositoryStatus = runCommand(
        npmCommand,
        ["run", "verify:repository"],
        checkerRoot,
      );
      if (repositoryStatus !== 0) return repositoryStatus;
    }
  }
  if (owners.has("coordinator")) {
    const status = runCommand(
      npmCommand,
      ["run", "check"],
      path.join(repositoryRoot, "40_Develop", "coordinator"),
    );
    if (status !== 0) return status;
  }
  if (owners.has("platform-access"))
    return runCommand(
      "cargo",
      [
        PLATFORM_TOOLCHAIN,
        "check",
        "--frozen",
        "--all-features",
        "--target",
        PLATFORM_TARGET,
      ],
      path.join(repositoryRoot, "40_Develop", "platform-access"),
    );
  return 0;
}

function runLevelStage(
  level: TestLevel,
  entries: readonly TestCatalogEntry[],
  shouldSkipWindowsProcessTests: boolean,
): number {
  const levelEntries = entries.filter((entry) => entry.level === level);
  for (const owner of ["checker", "coordinator"] as const) {
    const ownerEntries = levelEntries.filter((entry) => entry.owner === owner);
    const status = runNodeTests(
      owner,
      ownerEntries,
      owner === "coordinator" &&
        level === "integration" &&
        shouldSkipWindowsProcessTests
        ? { testSkipPattern: "^Windows Process Gate:" }
        : {},
    );
    if (status !== 0) return status;
  }
  if (levelEntries.some((entry) => entry.owner === "platform-access"))
    return runPlatformTests(level);
  return 0;
}

function runWindowsProcessStage(entries: readonly TestCatalogEntry[]): number {
  const windowsEntries = entries.filter(
    (entry) =>
      entry.level === "integration" &&
      entry.executionProfiles?.includes("windows_process_control"),
  );
  return runNodeTests("coordinator", windowsEntries, {
    testNamePattern: "^Windows Process Gate:",
  });
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

try {
  const loadedCatalog = loadTestCatalog(catalogPath);
  const catalogFailures = inspectTestCatalog(repositoryRoot, loadedCatalog);
  if (catalogFailures.length > 0) {
    writeJson({
      status: "blocked",
      reason: "test_catalog_invalid",
      failures: catalogFailures,
      effectIssued: false,
    });
    process.exit(2);
  }
  const catalog = loadedCatalog as TestCatalog;
  const levels = parseLevels();
  const resourceAuthority = inspectRequestedResourceAuthority(levels);
  if (resourceAuthority.failures.length > 0) {
    writeJson({
      status: "not_authorized",
      reason: "resource_intensive_test_authority_required",
      failures: resourceAuthority.failures,
      effectIssued: false,
    });
    process.exit(2);
  }

  const explicitChangedPaths = normalizeExplicitChangedPaths(
    valuesAfter("--changed"),
  );
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
        ? collectChangedPathsFromGit(repositoryRoot, base)
        : [];
  if (changedPaths.length === 0) {
    writeJson({
      status: "blocked",
      reason: "regression_change_set_required",
      effectIssued: false,
    });
    process.exit(2);
  }

  const selectedEntries = selectRegressionTests(catalog, changedPaths, levels);
  const isWindowsProcessControlRequired =
    process.platform === "win32" &&
    selectedEntries.some((entry) =>
      entry.executionProfiles?.includes("windows_process_control"),
    );
  if (
    !process.argv.includes("--plan") &&
    isWindowsProcessControlRequired &&
    !process.argv.includes("--windows-process-control-authorized")
  ) {
    writeJson({
      status: "blocked",
      reason: "windows_process_control_authority_required",
      requiredExecutionProfile: "windows_process_control",
      effectIssued: false,
    });
    process.exit(2);
  }
  if (
    selectedEntries.some(
      (entry) => entry.externalProviderEffect || entry.humanInput,
    )
  ) {
    writeJson({
      status: "blocked",
      reason: "interactive_or_provider_test_not_automatically_authorized",
      effectIssued: false,
    });
    process.exit(2);
  }

  const isResourceIntensive =
    levels.has("performance") || levels.has("longevity");
  const plan = {
    contract: "crdd/regression-test-plan",
    contractRevision: 2,
    status:
      isResourceIntensive && !process.argv.includes("--plan")
        ? "planned_not_executable"
        : "planned",
    changedPaths,
    levels: [...levels],
    selected: selectedEntries.map((entry) => entry.path),
    stages: buildRegressionStagePlan(selectedEntries, changedPaths),
    requiredExecutionProfiles: [
      "restricted_process",
      ...(isWindowsProcessControlRequired ? ["windows_process_control"] : []),
    ],
    resourceIntensiveAuthorityVerified: isResourceIntensive,
    resourceIntensiveExecution: isResourceIntensive
      ? "plan_only_until_runtime_limits_are_enforced"
      : null,
    unexecutedResourceIntensive: catalog.tests
      .filter(
        (entry) => entry.level === "performance" || entry.level === "longevity",
      )
      .filter((entry) => !levels.has(entry.level))
      .map((entry) => entry.path),
    effectIssued: false,
  };
  writeJson(plan);
  if (process.argv.includes("--plan") || isResourceIntensive) process.exit(0);

  const executeStage = createRegressionStageExecutor({
    windowsProcessControlRequired: isWindowsProcessControlRequired,
    runStatic: () => runStaticStage(selectedEntries, changedPaths),
    runLevel: (stage) =>
      runLevelStage(stage, selectedEntries, isWindowsProcessControlRequired),
    runWindowsProcess: () => runWindowsProcessStage(selectedEntries),
  });
  const stageResults = executeRegressionStages(
    regressionStageOrder,
    executeStage,
  );
  const failedStage = stageResults.find((entry) => entry.status === "failed");
  writeJson({
    status: failedStage === undefined ? "completed" : "blocked",
    reason:
      failedStage === undefined
        ? "regression_stages_completed"
        : "regression_stage_failed",
    selectedCount: selectedEntries.length,
    stages: stageResults,
  });
  process.exit(failedStage?.exitCode ?? 0);
} catch (error) {
  writeJson({
    status: "blocked",
    reason: "regression_runner_observation_failed",
    detail: error instanceof Error ? error.message : "unknown_error",
    effectIssued: false,
  });
  process.exit(2);
}
