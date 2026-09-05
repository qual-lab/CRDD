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
