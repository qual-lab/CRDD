import {
  changedPaths,
  gitLocalChangeSetAdapter,
  observeLocalChangeSet,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";

export const regressionStageOrder = [
  "static",
  "unit",
  "integration",
  "system",
] as const;

export type RegressionStage = (typeof regressionStageOrder)[number];
export type RegressionExecutionStep =
  | RegressionStage
  | "windows_process_control";
export type RegressionStageResult = Readonly<{
  stage: RegressionExecutionStep;
  owners: readonly string[];
  selected: readonly string[];
  selectionReason: string;
  status: "completed" | "failed" | "not_run_due_to_prior_stage";
  exitCode: number | null;
}>;

export type RegressionPlanEntry = Readonly<{
  owner: string;
  level: string;
  path: string;
  executionProfiles?: readonly string[];
}>;

export type RegressionStagePlan = Readonly<{
  stage: RegressionExecutionStep;
  owners: readonly string[];
  selected: readonly string[];
  selectionReason: string;
}>;

export function buildRegressionStagePlan(
  selectedEntries: readonly RegressionPlanEntry[],
  changedPaths: readonly string[],
  windowsProcessControlRequired: boolean,
  staticOwners?: readonly string[],
): readonly RegressionStagePlan[] {
  const selectedOwners = [
    ...new Set(selectedEntries.map((entry) => entry.owner)),
  ].sort();
  const plannedStaticOwners = [
    ...new Set(staticOwners ?? selectedOwners),
  ].sort();
  const levelPlans = regressionStageOrder.map((stage) => ({
    stage,
    owners:
      stage === "static"
        ? plannedStaticOwners
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
  const windowsEntries = selectedEntries.filter(
    (entry) =>
      entry.level === "integration" &&
      entry.executionProfiles?.includes("windows_process_control"),
  );
  if (!windowsProcessControlRequired || windowsEntries.length === 0)
    return levelPlans;
  const integrationIndex = levelPlans.findIndex(
    (entry) => entry.stage === "integration",
  );
  return [
    ...levelPlans.slice(0, integrationIndex + 1),
    {
      stage: "windows_process_control",
      owners: [...new Set(windowsEntries.map((entry) => entry.owner))].sort(),
      selected: windowsEntries.map((entry) => entry.path),
      selectionReason: "required_execution_profile",
    },
    ...levelPlans.slice(integrationIndex + 1),
  ];
}

export type RegressionStageExecutorDependencies = Readonly<{
  runStatic: () => number;
  runLevel: (stage: Exclude<RegressionStage, "static">) => number;
  runWindowsProcess: () => number;
}>;

export function createRegressionStageExecutor(
  dependencies: RegressionStageExecutorDependencies,
): (plan: RegressionStagePlan) => number {
  return (plan) => {
    if (plan.stage === "static") return dependencies.runStatic();
    if (plan.stage === "windows_process_control")
      return dependencies.runWindowsProcess();
    return dependencies.runLevel(plan.stage);
  };
}

export function executeRegressionStages(
  plans: readonly RegressionStagePlan[],
  executeStage: (plan: RegressionStagePlan) => number,
): readonly RegressionStageResult[] {
  const results: RegressionStageResult[] = [];
  let priorStageFailed = false;
  for (const plan of plans) {
    if (priorStageFailed) {
      results.push({
        ...plan,
        status: "not_run_due_to_prior_stage",
        exitCode: null,
      });
      continue;
    }
    const exitCode = executeStage(plan);
    const status = exitCode === 0 ? "completed" : "failed";
    results.push({ ...plan, status, exitCode });
    if (exitCode !== 0) priorStageFailed = true;
  }
  return results;
}

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

export function collectChangedPaths(
  repositoryRoot: string,
  base: string,
): readonly string[] {
  const verified = verifyRepositoryRoot(repositoryRoot);
  if (verified.status !== "completed")
    throw new Error("regression_runner_repository_invalid");
  return changedPaths(
    observeLocalChangeSet(verified.capability, base, gitLocalChangeSetAdapter),
  );
}
