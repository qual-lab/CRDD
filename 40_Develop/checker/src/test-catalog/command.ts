/**
 * 試験台帳の検査と実行手段に依存しない回帰計画を公開する。
 * @responsibility 引数・検証済みRoot・差分観測とDomainの検査結果を接続する。
 * @trace ARCH-000003
 * @boundary CLIからRepository読取りまで。試験実行境界は開かない。
 * @effect GitとFilesystemの読取りだけ。試験の起動・保存は行わない。
 * @security 計画の成功を実行許可・試験合格へ読み替えない。
 */
import path from "node:path";
import {
  buildRegressionStagePlan,
  inspectResourceIntensiveTestAuthority,
  inspectTestCatalog,
  loadTestCatalog,
  normalizeExplicitChangedPaths,
  selectRegressionStaticOwners,
  selectRegressionTests,
  testLevels,
  type TestCatalog,
  type TestLevel,
} from "../../../domain-model/src/index.ts";
import {
  changedPaths,
  gitLocalChangeSetAdapter,
  observeLocalChangeSet,
  resolveVerifiedRepositoryRoot,
  verifyRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
} from "../../../version-control/src/index.ts";
import type { CheckerRunRequest, CheckerResult } from "../profiles/current.ts";

/**
 * 台帳検査または回帰対象・順序・必要条件を表示する。
 * @responsibility 台帳検査と計画だけを一要求へ閉じ、試験を実行しない。
 * @trace ARCH-000003
 * @input request: 引数、cwd、表示先。
 * @returns 検査／計画成功0、不整合1、観測不能2、引数不正64。
 * @precondition Rootを既存Version Controlで検証できる。
 * @postcondition 計画には試験未起動と実行条件を明示する。
 * @effect GitとRepositoryの読取り、指定表示先への結果搬送。
 * @failure Root・台帳・差分観測の不明は成功にしない。
 * @invariant npm・Cargo・試験起動・自動結果収集へ依存しない。
 * @boundary 公開CLIとDomain検査・Version Control読取り。
 * @security 外部AI・高負荷・人間確認・Host制御の許可を発行しない。
 * @concurrency 一要求内の同期処理。新しいLockや保存状態を持たない。
 */
export function runTestCatalog(request: CheckerRunRequest): CheckerResult {
  const values = new Map<string, string[]>();
  const flags = new Set<string>();
  const valueNames = new Set([
    "--root",
    "--base",
    "--changed",
    "--levels",
    "--purpose",
    "--environment",
    "--max-duration-minutes",
    "--max-invocations",
    "--max-credits",
    "--cleanup",
    "--stop-condition",
  ]);
  for (let i = 0; i < request.arguments.length; i += 1) {
    const name = request.arguments[i] as string;
    if (name === "--all" || name === "--resource-intensive-authorized") {
      if (flags.has(name)) return invalidArguments(request);
      flags.add(name);
      continue;
    }
    const value = request.arguments[i + 1];
    if (
      !valueNames.has(name) ||
      !value ||
      value.startsWith("--") ||
      (name !== "--changed" && values.has(name))
    )
      return invalidArguments(request);
    values.set(name, [...(values.get(name) ?? []), value]);
    i += 1;
  }
  const value = (name: string) => values.get(name)?.[0] ?? null;
  if (
    Number(flags.has("--all")) +
      Number(values.has("--base")) +
      Number(values.has("--changed")) >
    1
  )
    return invalidArguments(request);
  const levels = (value("--levels") ?? "unit,integration,system").split(",");
  if (
    levels.some((level) => !testLevels.includes(level as TestLevel)) ||
    new Set(levels).size !== levels.length
  )
    return invalidArguments(request);
  let explicitPaths: readonly string[];
  try {
    explicitPaths = normalizeExplicitChangedPaths(
      values.get("--changed") ?? [],
    );
  } catch {
    return invalidArguments(request);
  }
  const explicitRoot = value("--root");
  const verified =
    explicitRoot === null
      ? verifyRepositoryRootFromWorkingDirectory(request.cwd)
      : verifyRepositoryRoot(path.resolve(request.cwd, explicitRoot));
  if (verified.status !== "completed") {
    request.writeError("test_catalog_repository_root_unverified\n");
    return { exitCode: 2 };
  }
  const root = resolveVerifiedRepositoryRoot(verified.capability);
  if (root === null) {
    request.writeError("test_catalog_repository_root_unverified\n");
    return { exitCode: 2 };
  }
  let stage = "observation";
  try {
    const input = loadTestCatalog(
      path.join(root, "07_Quality", "Registry", "test-catalog.json"),
    );
    const failures = inspectTestCatalog(root, input);
    if (failures.length > 0) {
      stage = "output";
      request.writeOutput(
        `${JSON.stringify({ status: "invalid", failures, effectIssued: false }, null, 2)}\n`,
      );
      return { exitCode: 1 };
    }
    const catalog = input as TestCatalog;
    const hasSelection =
      flags.has("--all") || values.has("--changed") || values.has("--base");
    if (!hasSelection) {
      stage = "output";
      request.writeOutput(
        `${JSON.stringify({ status: "valid", testCount: catalog.tests.length, testExecution: "not_started", effectIssued: false }, null, 2)}\n`,
      );
      return { exitCode: 0 };
    }
    const selectedLevels = new Set(levels as TestLevel[]);
    const authorityFailures = inspectResourceIntensiveTestAuthority(
      selectedLevels,
      {
        authorized: flags.has("--resource-intensive-authorized"),
        purpose: value("--purpose"),
        environment: value("--environment"),
        maximumDurationMinutes: numericValue(value("--max-duration-minutes")),
        maximumInvocations: numericValue(value("--max-invocations")),
        maximumCredits: numericValue(value("--max-credits")),
        cleanup: value("--cleanup"),
        stopCondition: value("--stop-condition"),
      },
    );
    if (authorityFailures.length > 0) {
      stage = "output";
      request.writeOutput(
        `${JSON.stringify({ status: "not_authorized", reason: "resource_intensive_test_authority_required", failures: authorityFailures, effectIssued: false }, null, 2)}\n`,
      );
      return { exitCode: 2 };
    }
    const base = value("--base");
    const paths = flags.has("--all")
      ? catalog.tests.map((entry) => entry.path)
      : base !== null
        ? changedPaths(
            observeLocalChangeSet(
              verified.capability,
              base,
              gitLocalChangeSetAdapter,
            ),
          )
        : explicitPaths;
    if (paths.length === 0) {
      request.writeError("regression_change_set_required\n");
      return { exitCode: 2 };
    }
    stage = "planning";
    const selected = selectRegressionTests(catalog, paths, selectedLevels);
    const staticOwners = selectRegressionStaticOwners(catalog, paths, selected);
    const windowsRequired = selected.some((entry) =>
      entry.executionProfiles?.includes("windows_process_control"),
    );
    const stages = buildRegressionStagePlan(
      selected,
      paths,
      windowsRequired,
      staticOwners,
    );
    stage = "output";
    request.writeOutput(
      `${JSON.stringify(
        {
          contract: "crdd/regression-test-plan",
          contractRevision: 3,
          status: "planned",
          changedPaths: flags.has("--all") ? [] : paths,
          selectionBasis: flags.has("--all")
            ? "all_catalog_tests"
            : "changed_paths",
          levels: [...selectedLevels],
          selected: selected.map((entry) => entry.path),
          testIds: selected.map((entry) => entry.id),
          stages,
          executionConditions: selected.map((entry) => ({
            id: entry.id,
            humanInput: entry.humanInput,
            externalProviderEffect: entry.externalProviderEffect,
            executionProfiles: entry.executionProfiles ?? [],
            postconditions: entry.postconditions,
          })),
          unexecutedResourceIntensive: catalog.tests
            .filter(
              (entry) =>
                (entry.level === "performance" ||
                  entry.level === "longevity") &&
                !selectedLevels.has(entry.level),
            )
            .map((entry) => entry.path),
          resourceIntensiveExecution:
            selectedLevels.has("performance") || selectedLevels.has("longevity")
              ? "plan_only_until_runtime_limits_are_enforced"
              : null,
          testExecution: "not_started",
          effectIssued: false,
        },
        null,
        2,
      )}\n`,
    );
    return { exitCode: 0 };
  } catch {
    request.writeError(`test_catalog_${stage}_failed\n`);
    return { exitCode: 2 };
  }
}

/**
 * 引数の不正を固定理由で表示する。
 * @responsibility 観測や試験起動の前に引数を拒否する。
 * @trace ARCH-000003
 * @input request: エラー表示先。
 * @returns 引数不正64。
 * @precondition 引数検査で不正を確認済み。
 * @postcondition Rootや試験を観測しない。
 * @effect 固定文字列の出力だけ。
 * @failure 表示失敗は呼出し側の例外。
 * @invariant 入力本文を出力しない。
 * @boundary CLI引数と固定診断。
 * @security Authorityを発行しない。
 * @concurrency 同期局所処理。
 */
function invalidArguments(request: CheckerRunRequest): CheckerResult {
  request.writeError("test_catalog_arguments_invalid\n");
  return { exitCode: 64 };
}

/**
 * 明示された数値を既存の高負荷条件検査へ渡す。
 * @responsibility 欠測と不正数値を既定の許可値で補完しない。
 * @trace ARCH-000003
 * @input value: 数値文字列または欠測。
 * @returns 有限数またはnull。
 * @precondition CLIの単一値。
 * @postcondition 0と欠測を区別する。
 * @effect N/A: 局所計算。
 * @failure 不正数値はnull。
 * @invariant 正負・上限の判断はDomainに委譲する。
 * @boundary 数値表記とDomain条件入力。
 * @security 許可を生成しない。
 * @concurrency 同期局所処理。
 */
function numericValue(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
