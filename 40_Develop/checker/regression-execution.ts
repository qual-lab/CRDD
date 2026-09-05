import { spawnSync, type SpawnSyncReturns } from "node:child_process";

export const regressionStageOrder = [
  "static",
  "unit",
  "integration",
  "system",
] as const;

export type RegressionStage = (typeof regressionStageOrder)[number];
export type RegressionStageResult = Readonly<{
  stage: RegressionStage;
  status: "completed" | "failed" | "not_run_due_to_prior_stage";
  exitCode: number | null;
}>;

export type RegressionPlanEntry = Readonly<{
  owner: string;
  level: string;
  path: string;
}>;

export type RegressionStagePlan = Readonly<{
  stage: RegressionStage;
  owners: readonly string[];
  selected: readonly string[];
  selectionReason: string;
}>;

export function buildRegressionStagePlan(
  selectedEntries: readonly RegressionPlanEntry[],
  changedPaths: readonly string[],
): readonly RegressionStagePlan[] {
  const selectedOwners = [
    ...new Set(selectedEntries.map((entry) => entry.owner)),
  ].sort();
  return regressionStageOrder.map((stage) => ({
    stage,
    owners:
      stage === "static"
        ? selectedOwners
        : [
            ...new Set(
              selectedEntries
                .filter((entry) => entry.level === stage)
                .map((entry) => entry.owner),
            ),
          ].sort(),
    selected:
      stage === "static"
        ? []
        : selectedEntries
            .filter((entry) => entry.level === stage)
            .map((entry) => entry.path),
    selectionReason:
      stage === "static"
        ? changedPaths.some((entry) => entry.toLowerCase().endsWith(".md"))
          ? "owner_static_checks_and_repository_check"
          : "owner_static_checks"
        : "conservative_owner_closure_or_direct_test_change",
  }));
}

export type RegressionStageExecutorDependencies = Readonly<{
  windowsProcessControlRequired: boolean;
  runStatic: () => number;
  runLevel: (stage: Exclude<RegressionStage, "static">) => number;
  runWindowsProcess: () => number;
}>;

export function createRegressionStageExecutor(
  dependencies: RegressionStageExecutorDependencies,
): (stage: RegressionStage) => number {
  return (stage) => {
    if (stage === "static") return dependencies.runStatic();
    const levelStatus = dependencies.runLevel(stage);
    if (levelStatus !== 0) return levelStatus;
    if (stage === "integration" && dependencies.windowsProcessControlRequired)
      return dependencies.runWindowsProcess();
    return 0;
  };
}

export function executeRegressionStages(
  stages: readonly RegressionStage[],
  executeStage: (stage: RegressionStage) => number,
): readonly RegressionStageResult[] {
  const results: RegressionStageResult[] = [];
  let priorStageFailed = false;
  for (const stage of stages) {
    if (priorStageFailed) {
      results.push({
        stage,
        status: "not_run_due_to_prior_stage",
        exitCode: null,
      });
      continue;
    }
    const exitCode = executeStage(stage);
    const status = exitCode === 0 ? "completed" : "failed";
    results.push({ stage, status, exitCode });
    if (exitCode !== 0) priorStageFailed = true;
  }
  return results;
}

type GitResult = Pick<SpawnSyncReturns<string>, "error" | "status" | "stdout">;

export type GitRunner = (gitArguments: readonly string[]) => GitResult;

export function normalizeExplicitChangedPaths(
  changedPaths: readonly string[],
): readonly string[] {
  const normalizedPaths = new Set<string>();
  for (const changedPath of changedPaths) {
    if (
      changedPath.length === 0 ||
      changedPath.includes("\\") ||
      changedPath.startsWith("./") ||
      changedPath.includes("//") ||
      /[\u0000-\u001f\u007f]/u.test(changedPath) ||
      pathIsAbsolute(changedPath) ||
      changedPath
        .split("/")
        .some(
          (segment) => segment === "" || segment === "." || segment === "..",
        )
    )
      throw new Error("regression_runner_changed_path_invalid");
    normalizedPaths.add(changedPath);
  }
  return [...normalizedPaths];
}

function pathIsAbsolute(value: string): boolean {
  return /^(?:[A-Za-z]:|\/)/u.test(value);
}

function parseNullSeparatedPaths(
  result: GitResult,
  observation: string,
): string[] {
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0)
    throw new Error(`regression_runner_git_observation_failed:${observation}`);
  return result.stdout.split("\0").filter(Boolean);
}

export function collectChangedPathsFromGit(
  repositoryRoot: string,
  base: string,
  runGit: GitRunner = (gitArguments) =>
    spawnSync("git", gitArguments, {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
    }),
): readonly string[] {
  const observations = [
    [
      "base_to_head",
      ["diff", "--name-only", "--no-renames", "-z", `${base}...HEAD`],
    ],
    [
      "head_to_index",
      ["diff", "--cached", "--name-only", "--no-renames", "-z", "HEAD"],
    ],
    ["index_to_worktree", ["diff", "--name-only", "--no-renames", "-z"]],
    ["untracked", ["ls-files", "--others", "--exclude-standard", "-z"]],
  ] as const;
  const changedPaths = new Set<string>();
  for (const [name, gitArguments] of observations)
    for (const entry of parseNullSeparatedPaths(runGit(gitArguments), name))
      changedPaths.add(entry.replaceAll("\\", "/"));
  return [...changedPaths].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}
