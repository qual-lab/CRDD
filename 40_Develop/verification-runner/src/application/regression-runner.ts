/**
 * regression-runnerに属する責務をまとめる。
 *
 * @responsibility RegressionRunRequestを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000003
 */
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

/**
 * regression-runnerで使用するRegression Run Requestの値契約を定義する。
 *
 * @responsibility Regression Run RequestのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000003
 * @shape RegressionRunRequestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RegressionRunRequestで宣言した値と責務の対応を維持する。
 * @boundary N/A: RegressionRunRequestの宣言は外部境界を開かない。
 * @security N/A: RegressionRunRequestはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RegressionRunRequestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RegressionRunRequest = Readonly<{
  arguments: readonly string[];
  emit: (value: unknown) => void;
}>;

/**
 * regression-runnerで使用するRegression Run 結果の値契約を定義する。
 *
 * @responsibility Regression Run 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000003
 * @shape RegressionRunResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RegressionRunResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: RegressionRunResultの宣言は外部境界を開かない。
 * @security N/A: RegressionRunResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RegressionRunResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RegressionRunResult = Readonly<{
  exitCode: number;
}>;

/**
 * values Afterを決定する。
 *
 * @responsibility values Afterの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000003
 * @input argumentValues: readonly string[]、name: string
 * @returns string[]を返す。
 * @precondition 「argumentValues: readonly string[]、name: string」がvaluesAfterの入力契約を満たす。
 * @postcondition valuesAfterの責務を完了した結果だけを返す。
 * @effect N/A: valuesAfterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: valuesAfterは独自の失敗分岐を所有しない。
 * @invariant valuesAfterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: valuesAfterはProcess内の同一Subsystemで完結する。
 * @security N/A: valuesAfterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: valuesAfterは共有非同期状態を持たない同期処理である。
 */
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

/**
 * value Afterを決定する。
 *
 * @responsibility value Afterの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000003
 * @input argumentValues: readonly string[]、name: string
 * @returns string | nullを返す。
 * @precondition 「argumentValues: readonly string[]、name: string」がvalueAfterの入力契約を満たす。
 * @postcondition valueAfterの責務を完了した結果だけを返す。
 * @effect N/A: valueAfterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: valueAfterは独自の失敗分岐を所有しない。
 * @invariant valueAfterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: valueAfterはProcess内の同一Subsystemで完結する。
 * @security N/A: valueAfterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: valueAfterは共有非同期状態を持たない同期処理である。
 */
function valueAfter(
  argumentValues: readonly string[],
  name: string,
): string | null {
  return valuesAfter(argumentValues, name)[0] ?? null;
}

/**
 * Numberが正数か検証する。
 *
 * @responsibility Numberの数値条件、拒否条件、検証済み結果境界を所有する。
 * @trace ARCH-000003
 * @input argumentValues: readonly string[]、name: string
 * @returns number | nullを返す。
 * @precondition 「argumentValues: readonly string[]、name: string」がpositiveNumberの入力契約を満たす。
 * @postcondition positiveNumberの責務を完了した結果だけを返す。
 * @effect N/A: positiveNumberは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: positiveNumberは独自の失敗分岐を所有しない。
 * @invariant positiveNumberは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: positiveNumberはProcess内の同一Subsystemで完結する。
 * @security N/A: positiveNumberはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: positiveNumberは共有非同期状態を持たない同期処理である。
 */
function positiveNumber(
  argumentValues: readonly string[],
  name: string,
): number | null {
  const raw = valueAfter(argumentValues, name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Numberが0以上か検証する。
 *
 * @responsibility Numberの数値条件、拒否条件、検証済み結果境界を所有する。
 * @trace ARCH-000003
 * @input argumentValues: readonly string[]、name: string
 * @returns number | nullを返す。
 * @precondition 「argumentValues: readonly string[]、name: string」がnonNegativeNumberの入力契約を満たす。
 * @postcondition nonNegativeNumberの責務を完了した結果だけを返す。
 * @effect N/A: nonNegativeNumberは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nonNegativeNumberは独自の失敗分岐を所有しない。
 * @invariant nonNegativeNumberは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nonNegativeNumberはProcess内の同一Subsystemで完結する。
 * @security N/A: nonNegativeNumberはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: nonNegativeNumberは共有非同期状態を持たない同期処理である。
 */
function nonNegativeNumber(
  argumentValues: readonly string[],
  name: string,
): number | null {
  const raw = valueAfter(argumentValues, name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Levelsを構造化値へ解析する。
 *
 * @responsibility Levelsの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000003
 * @input argumentValues: readonly string[]
 * @returns Set<TestLevel>を返す。
 * @precondition 「argumentValues: readonly string[]」がparseLevelsの入力契約を満たす。
 * @postcondition parseLevelsの責務を完了した結果だけを返す。
 * @effect N/A: parseLevelsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseLevelsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseLevelsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseLevelsはProcess内の同一Subsystemで完結する。
 * @security N/A: parseLevelsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseLevelsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Requested Resource Authorityを観測する。
 *
 * @responsibility Requested Resource Authorityの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000003
 * @input argumentValues: readonly string[]、levels: ReadonlySet<TestLevel>
 * @returns inspectRequestedResourceAuthorityの計算結果を返す。
 * @precondition 「argumentValues: readonly string[]、levels: ReadonlySet<TestLevel>」がinspectRequestedResourceAuthorityの入力契約を満たす。
 * @postcondition inspectRequestedResourceAuthorityの責務を完了した結果だけを返す。
 * @effect N/A: inspectRequestedResourceAuthorityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRequestedResourceAuthorityは独自の失敗分岐を所有しない。
 * @invariant inspectRequestedResourceAuthorityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRequestedResourceAuthorityはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectRequestedResourceAuthorityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectRequestedResourceAuthorityは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Commandを実行する。
 *
 * @responsibility Commandの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000003
 * @input command: string、commandArguments: readonly string[]、cwd: string
 * @returns numberを返す。
 * @precondition 「command: string、commandArguments: readonly string[]、cwd: string」がrunCommandの入力契約を満たす。
 * @postcondition runCommandの責務を完了した結果だけを返す。
 * @effect runCommandは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: runCommandは独自の失敗分岐を所有しない。
 * @invariant runCommandは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: runCommandはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runCommandは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Npm Scriptを実行する。
 *
 * @responsibility Npm Scriptの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000003
 * @input script: "check" | "verify:repository"、cwd: string
 * @returns numberを返す。
 * @precondition 「script: "check" | "verify:repository"、cwd: string」がrunNpmScriptの入力契約を満たす。
 * @postcondition runNpmScriptの責務を完了した結果だけを返す。
 * @effect runNpmScriptは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: runNpmScriptは独自の失敗分岐を所有しない。
 * @invariant runNpmScriptは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: runNpmScriptはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runNpmScriptは共有非同期状態を持たない同期処理である。
 */
function runNpmScript(
  script: "check" | "verify:repository",
  cwd: string,
): number {
  return process.platform === "win32"
    ? runCommand("cmd.exe", ["/d", "/s", "/c", `npm.cmd run ${script}`], cwd)
    : runCommand("npm", ["run", script], cwd);
}

/**
 * Node Testsを実行する。
 *
 * @responsibility Node Testsの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000003
 * @input owner: | "artifact-signing" | "checker" | "coordinator" | "crdd-domain-library" | "execution-intelligence" | "mcp" | "project-runtime" | "runtime-data" | "semantic-coverage" | "version-control" | "verification-runner"、entries: readonly TestCatalogEntry[]、options: Readonly<{ testNamePattern?: string; testSkipPattern?: string; }>
 * @returns numberを返す。
 * @precondition 「owner: | "artifact-signing" | "checker" | "coordinator" | "crdd-domain-library" | "execution-intelligence" | "mcp" | "project-runtime" | "runtime-data" | "semantic-coverage" | "version-control" | "verification-runner"、entries: readonly TestCatalogEntry[]、options: Readonly<{ testNamePattern?: string; testSkipPattern?: string; }>」がrunNodeTestsの入力契約を満たす。
 * @postcondition runNodeTestsの責務を完了した結果だけを返す。
 * @effect runNodeTestsは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: runNodeTestsは独自の失敗分岐を所有しない。
 * @invariant runNodeTestsは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: runNodeTestsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runNodeTestsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Platform Testsを実行する。
 *
 * @responsibility Platform Testsの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000003
 * @input level: TestLevel
 * @returns numberを返す。
 * @precondition 「level: TestLevel」がrunPlatformTestsの入力契約を満たす。
 * @postcondition runPlatformTestsの責務を完了した結果だけを返す。
 * @effect N/A: runPlatformTestsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runPlatformTestsは独自の失敗分岐を所有しない。
 * @invariant runPlatformTestsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runPlatformTestsはProcess内の同一Subsystemで完結する。
 * @security N/A: runPlatformTestsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runPlatformTestsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Static Stageを実行する。
 *
 * @responsibility Static Stageの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000003
 * @input staticOwners: readonly TestCatalogEntry["owner"][]、changedPaths: readonly string[]
 * @returns numberを返す。
 * @precondition 「staticOwners: readonly TestCatalogEntry["owner"][]、changedPaths: readonly string[]」がrunStaticStageの入力契約を満たす。
 * @postcondition runStaticStageの責務を完了した結果だけを返す。
 * @effect N/A: runStaticStageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runStaticStageは独自の失敗分岐を所有しない。
 * @invariant runStaticStageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runStaticStageはProcess内の同一Subsystemで完結する。
 * @security N/A: runStaticStageはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runStaticStageは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Level Stageを実行する。
 *
 * @responsibility Level Stageの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000003
 * @input level: TestLevel、entries: readonly TestCatalogEntry[]、shouldSkipWindowsProcessTests: boolean
 * @returns numberを返す。
 * @precondition 「level: TestLevel、entries: readonly TestCatalogEntry[]、shouldSkipWindowsProcessTests: boolean」がrunLevelStageの入力契約を満たす。
 * @postcondition runLevelStageの責務を完了した結果だけを返す。
 * @effect N/A: runLevelStageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runLevelStageは独自の失敗分岐を所有しない。
 * @invariant runLevelStageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runLevelStageはProcess内の同一Subsystemで完結する。
 * @security N/A: runLevelStageはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runLevelStageは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Windows Process Stageを実行する。
 *
 * @responsibility Windows Process Stageの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000003
 * @input entries: readonly TestCatalogEntry[]
 * @returns numberを返す。
 * @precondition 「entries: readonly TestCatalogEntry[]」がrunWindowsProcessStageの入力契約を満たす。
 * @postcondition runWindowsProcessStageの責務を完了した結果だけを返す。
 * @effect N/A: runWindowsProcessStageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runWindowsProcessStageは独自の失敗分岐を所有しない。
 * @invariant runWindowsProcessStageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runWindowsProcessStageはProcess内の同一Subsystemで完結する。
 * @security N/A: runWindowsProcessStageはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runWindowsProcessStageは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Regressionを実行する。
 *
 * @responsibility Regressionの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000003
 * @input request: RegressionRunRequest
 * @returns RegressionRunResultを返す。
 * @precondition 「request: RegressionRunRequest」がrunRegressionの入力契約を満たす。
 * @postcondition runRegressionの責務を完了した結果だけを返す。
 * @effect runRegressionは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure runRegressionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runRegressionは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: runRegressionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runRegressionは共有非同期状態を持たない同期処理である。
 */
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
