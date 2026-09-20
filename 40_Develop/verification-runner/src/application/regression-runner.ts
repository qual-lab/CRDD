import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRegressionStagePlan,
  collectChangedPaths,
  createRegressionStageExecutor,
  executeRegressionStages,
  normalizeExplicitChangedPaths,
} from "../execution/regression-execution.ts";
import {
  inspectResourceIntensiveTestAuthority,
  inspectTestCatalog,
  loadTestCatalog,
  selectRegressionStaticOwners,
  selectRegressionTests,
  testLevels,
  type TestCatalog,
  type TestCatalogEntry,
  type TestLevel,
} from "../catalog/test-catalog.ts";

const verificationRunnerRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const repositoryRoot = path.resolve(verificationRunnerRoot, "../..");
const checkerRoot = path.join(repositoryRoot, "40_Develop", "checker");
const catalogPath = path.join(
  repositoryRoot,
  "07_Quality",
  "Registry/test-catalog.json",
);
const PLATFORM_TOOLCHAIN = "+1.94.1-x86_64-pc-windows-msvc";
const PLATFORM_TARGET = "x86_64-pc-windows-msvc";

export type RegressionRunRequest = Readonly<{
  arguments: readonly string[];
  emit: (value: unknown) => void;
}>;

export type RegressionRunResult = Readonly<{
  exitCode: number;
}>;

function valuesAfter(
  argumentValues: readonly string[],
  name: string,
): string[] {
  const values: string[] = [];
  for (let index = 0; index < argumentValues.length; index += 1)
    if (
      argumentValues[index] === name &&
      argumentValues[index + 1] !== undefined
    )
      values.push(argumentValues[index + 1] as string);
  return values;
}

function valueAfter(
  argumentValues: readonly string[],
  name: string,
): string | null {
  return valuesAfter(argumentValues, name)[0] ?? null;
}

function positiveNumber(
  argumentValues: readonly string[],
  name: string,
): number | null {
  const raw = valueAfter(argumentValues, name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function nonNegativeNumber(
  argumentValues: readonly string[],
  name: string,
): number | null {
  const raw = valueAfter(argumentValues, name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function parseLevels(argumentValues: readonly string[]): Set<TestLevel> {
  const raw =
    valueAfter(argumentValues, "--levels") ?? "unit,integration,system";
  const values = raw.split(",");
  const levels = values.filter((value): value is TestLevel =>
    testLevels.includes(value as TestLevel),
  );
  if (levels.length !== values.length)
    throw new Error("regression_runner_level_invalid");
  return new Set(levels);
}

function inspectRequestedResourceAuthority(
  argumentValues: readonly string[],
  levels: ReadonlySet<TestLevel>,
) {
  const authority = {
    authorized: argumentValues.includes("--resource-intensive-authorized"),
    purpose: valueAfter(argumentValues, "--purpose"),
    environment: valueAfter(argumentValues, "--environment"),
    maximumDurationMinutes: positiveNumber(
      argumentValues,
      "--max-duration-minutes",
    ),
    maximumInvocations: positiveNumber(argumentValues, "--max-invocations"),
    maximumCredits: nonNegativeNumber(argumentValues, "--max-credits"),
    cleanup: valueAfter(argumentValues, "--cleanup"),
    stopCondition: valueAfter(argumentValues, "--stop-condition"),
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

function runNpmScript(
  script: "check" | "verify:repository",
  cwd: string,
): number {
  return process.platform === "win32"
    ? runCommand("cmd.exe", ["/d", "/s", "/c", `npm.cmd run ${script}`], cwd)
    : runCommand("npm", ["run", script], cwd);
}

function runNodeTests(
  owner:
    | "artifact-signing"
    | "checker"
    | "coordinator"
    | "crdd-domain-library"
    | "execution-intelligence"
    | "mcp"
    | "project-runtime"
    | "runtime-data"
    | "semantic-coverage"
    | "version-control"
    | "verification-runner",
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

function runStaticStage(
  staticOwners: readonly TestCatalogEntry["owner"][],
  changedPaths: readonly string[],
): number {
  const owners = new Set(staticOwners);
  if (owners.has("verification-runner")) {
    const status = runNpmScript("check", verificationRunnerRoot);
    if (status !== 0) return status;
  }
  if (owners.has("checker")) {
    const checkerStatus = runNpmScript("check", checkerRoot);
    if (checkerStatus !== 0) return checkerStatus;
    if (changedPaths.some((entry) => entry.toLowerCase().endsWith(".md"))) {
      const repositoryStatus = runNpmScript("verify:repository", checkerRoot);
      if (repositoryStatus !== 0) return repositoryStatus;
    }
  }
  if (owners.has("coordinator")) {
    const status = runNpmScript(
      "check",
      path.join(repositoryRoot, "40_Develop", "coordinator"),
    );
    if (status !== 0) return status;
  }
  if (owners.has("execution-intelligence")) {
    const root = path.join(
      repositoryRoot,
      "40_Develop",
      "execution-intelligence",
    );
    const status = runNpmScript("check", root);
    if (status !== 0) return status;
  }
  for (const owner of [
    "artifact-signing",
    "crdd-domain-library",
    "mcp",
    "project-runtime",
    "runtime-data",
    "semantic-coverage",
    "version-control",
  ] as const)
    if (owners.has(owner)) {
      const status = runNpmScript(
        "check",
        path.join(repositoryRoot, "40_Develop", owner),
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
  for (const owner of [
    "artifact-signing",
    "checker",
    "coordinator",
    "crdd-domain-library",
    "execution-intelligence",
    "mcp",
    "project-runtime",
    "runtime-data",
    "semantic-coverage",
    "version-control",
    "verification-runner",
  ] as const) {
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

export function runRegression(
  request: RegressionRunRequest,
): RegressionRunResult {
  try {
    const argumentValues = request.arguments;
    const loadedCatalog = loadTestCatalog(catalogPath);
    const catalogFailures = inspectTestCatalog(repositoryRoot, loadedCatalog);
    if (catalogFailures.length > 0) {
      request.emit({
        status: "blocked",
        reason: "test_catalog_invalid",
        failures: catalogFailures,
        effectIssued: false,
      });
      return { exitCode: 2 };
    }
    const catalog = loadedCatalog as TestCatalog;
    const levels = parseLevels(argumentValues);
    const resourceAuthority = inspectRequestedResourceAuthority(
      argumentValues,
      levels,
    );
    if (resourceAuthority.failures.length > 0) {
      request.emit({
        status: "not_authorized",
        reason: "resource_intensive_test_authority_required",
        failures: resourceAuthority.failures,
        effectIssued: false,
      });
      return { exitCode: 2 };
    }

    const explicitChangedPaths = normalizeExplicitChangedPaths(
      valuesAfter(argumentValues, "--changed"),
    );
    const base = valueAfter(argumentValues, "--base");
    const changedPaths = argumentValues.includes("--all")
      ? [
          "40_Develop/coordinator/package.json",
          "40_Develop/checker/package.json",
          "40_Develop/verification-runner/package.json",
          "40_Develop/execution-intelligence/package.json",
          "40_Develop/mcp/package.json",
          "40_Develop/project-runtime/package.json",
          "40_Develop/runtime-data/package.json",
          "40_Develop/version-control/package.json",
          "40_Develop/platform-access/Cargo.toml",
        ]
      : explicitChangedPaths.length > 0
        ? explicitChangedPaths
        : base !== null
          ? collectChangedPaths(repositoryRoot, base)
          : [];
    if (changedPaths.length === 0) {
      request.emit({
        status: "blocked",
        reason: "regression_change_set_required",
        effectIssued: false,
      });
      return { exitCode: 2 };
    }

    const selectedEntries = selectRegressionTests(
      catalog,
      changedPaths,
      levels,
    );
    const staticOwners = selectRegressionStaticOwners(
      catalog,
      changedPaths,
      selectedEntries,
    );
    const isWindowsProcessControlRequired =
      process.platform === "win32" &&
      selectedEntries.some((entry) =>
        entry.executionProfiles?.includes("windows_process_control"),
      );
    if (
      !argumentValues.includes("--plan") &&
      isWindowsProcessControlRequired &&
      !argumentValues.includes("--windows-process-control-authorized")
    ) {
      request.emit({
        status: "blocked",
        reason: "windows_process_control_authority_required",
        requiredExecutionProfile: "windows_process_control",
        effectIssued: false,
      });
      return { exitCode: 2 };
    }
    if (
      !argumentValues.includes("--plan") &&
      selectedEntries.some(
        (entry) => entry.externalProviderEffect || entry.humanInput,
      )
    ) {
      request.emit({
        status: "blocked",
        reason: "interactive_or_provider_test_not_automatically_authorized",
        effectIssued: false,
      });
      return { exitCode: 2 };
    }

    const isResourceIntensive =
      levels.has("performance") || levels.has("longevity");
    const stagePlans = buildRegressionStagePlan(
      selectedEntries,
      changedPaths,
      isWindowsProcessControlRequired,
      staticOwners,
    );
    const plan = {
      contract: "crdd/regression-test-plan",
      contractRevision: 2,
      status:
        isResourceIntensive && !argumentValues.includes("--plan")
          ? "planned_not_executable"
          : "planned",
      changedPaths,
      levels: [...levels],
      selected: selectedEntries.map((entry) => entry.path),
      stages: stagePlans,
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
          (entry) =>
            entry.level === "performance" || entry.level === "longevity",
        )
        .filter((entry) => !levels.has(entry.level))
        .map((entry) => entry.path),
      effectIssued: false,
    };
    request.emit(plan);
    if (argumentValues.includes("--plan") || isResourceIntensive)
      return { exitCode: 0 };

    const executeStage = createRegressionStageExecutor({
      runStatic: () => runStaticStage(staticOwners, changedPaths),
      runLevel: (stage) =>
        runLevelStage(stage, selectedEntries, isWindowsProcessControlRequired),
      runWindowsProcess: () => runWindowsProcessStage(selectedEntries),
    });
    const stageResults = executeRegressionStages(stagePlans, executeStage);
    const failedStage = stageResults.find((entry) => entry.status === "failed");
    request.emit({
      status: failedStage === undefined ? "completed" : "blocked",
      reason:
        failedStage === undefined
          ? "regression_stages_completed"
          : "regression_stage_failed",
      selectedCount: selectedEntries.length,
      stages: stageResults,
    });
    return { exitCode: failedStage?.exitCode ?? 0 };
  } catch (error) {
    request.emit({
      status: "blocked",
      reason: "regression_runner_observation_failed",
      detail: error instanceof Error ? error.message : "unknown_error",
      effectIssued: false,
    });
    return { exitCode: 2 };
  }
}
