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

/**
 * RegressionStageが扱う値の構造を表す。
 *
 * @responsibility RegressionStageに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000003
 * @shape RegressionStageが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RegressionStageで宣言した値と責務の対応を維持する。
 * @boundary N/A: RegressionStageの宣言は外部境界を開かない。
 * @security N/A: RegressionStageはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RegressionStageの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RegressionStage = (typeof regressionStageOrder)[number];
/**
 * RegressionExecutionStepが扱う値の構造を表す。
 *
 * @responsibility RegressionExecutionStepに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000003
 * @shape RegressionExecutionStepが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RegressionExecutionStepで宣言した値と責務の対応を維持する。
 * @boundary N/A: RegressionExecutionStepの宣言は外部境界を開かない。
 * @security N/A: RegressionExecutionStepはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RegressionExecutionStepの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RegressionExecutionStep =
  | RegressionStage
  | "windows_process_control";
/**
 * RegressionStageResultが扱う値の構造を表す。
 *
 * @responsibility RegressionStageResultに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000003
 * @shape RegressionStageResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RegressionStageResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: RegressionStageResultの宣言は外部境界を開かない。
 * @security N/A: RegressionStageResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RegressionStageResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RegressionStageResult = Readonly<{
  stage: RegressionExecutionStep;
  owners: readonly string[];
  selected: readonly string[];
  selectionReason: string;
  status: "completed" | "failed" | "not_run_due_to_prior_stage";
  exitCode: number | null;
}>;

/**
 * RegressionPlanEntryが扱う値の構造を表す。
 *
 * @responsibility RegressionPlanEntryに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000003
 * @shape RegressionPlanEntryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RegressionPlanEntryで宣言した値と責務の対応を維持する。
 * @boundary N/A: RegressionPlanEntryの宣言は外部境界を開かない。
 * @security N/A: RegressionPlanEntryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RegressionPlanEntryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RegressionPlanEntry = Readonly<{
  owner: string;
  level: string;
  path: string;
  executionProfiles?: readonly string[];
}>;

/**
 * RegressionStagePlanが扱う値の構造を表す。
 *
 * @responsibility RegressionStagePlanに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000003
 * @shape RegressionStagePlanが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RegressionStagePlanで宣言した値と責務の対応を維持する。
 * @boundary N/A: RegressionStagePlanの宣言は外部境界を開かない。
 * @security N/A: RegressionStagePlanはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RegressionStagePlanの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RegressionStagePlan = Readonly<{
  stage: RegressionExecutionStep;
  owners: readonly string[];
  selected: readonly string[];
  selectionReason: string;
}>;

/**
 * buildRegressionStagePlanの処理を実行する。
 *
 * @responsibility buildRegressionStagePlanに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000003
 * @input selectedEntries: readonly RegressionPlanEntry[]、changedPaths: readonly string[]、windowsProcessControlRequired: boolean、staticOwners: readonly string[]
 * @returns readonly RegressionStagePlan[]を返す。
 * @precondition 「selectedEntries: readonly RegressionPlanEntry[]、changedPaths: readonly string[]、windowsProcessControlRequired: boolean、staticOwners: readonly string[]」がbuildRegressionStagePlanの入力契約を満たす。
 * @postcondition buildRegressionStagePlanの責務を完了した結果だけを返す。
 * @effect N/A: buildRegressionStagePlanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: buildRegressionStagePlanは独自の失敗分岐を所有しない。
 * @invariant buildRegressionStagePlanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: buildRegressionStagePlanはProcess内の同一Subsystemで完結する。
 * @security N/A: buildRegressionStagePlanはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: buildRegressionStagePlanは共有非同期状態を持たない同期処理である。
 */
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

/**
 * RegressionStageExecutorDependenciesが扱う値の構造を表す。
 *
 * @responsibility RegressionStageExecutorDependenciesに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000003
 * @shape RegressionStageExecutorDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RegressionStageExecutorDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: RegressionStageExecutorDependenciesの宣言は外部境界を開かない。
 * @security N/A: RegressionStageExecutorDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RegressionStageExecutorDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RegressionStageExecutorDependencies = Readonly<{
  runStatic: () => number;
  runLevel: (stage: Exclude<RegressionStage, "static">) => number;
  runWindowsProcess: () => number;
}>;

/**
 * createRegressionStageExecutorの処理を実行する。
 *
 * @responsibility createRegressionStageExecutorに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000003
 * @input dependencies: RegressionStageExecutorDependencies
 * @returns (plan: RegressionStagePlan) => numberを返す。
 * @precondition 「dependencies: RegressionStageExecutorDependencies」がcreateRegressionStageExecutorの入力契約を満たす。
 * @postcondition createRegressionStageExecutorの責務を完了した結果だけを返す。
 * @effect N/A: createRegressionStageExecutorは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createRegressionStageExecutorは独自の失敗分岐を所有しない。
 * @invariant createRegressionStageExecutorは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRegressionStageExecutorはProcess内の同一Subsystemで完結する。
 * @security N/A: createRegressionStageExecutorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createRegressionStageExecutorは共有非同期状態を持たない同期処理である。
 */
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

/**
 * executeRegressionStagesの処理を実行する。
 *
 * @responsibility executeRegressionStagesに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000003
 * @input plans: readonly RegressionStagePlan[]、executeStage: (plan: RegressionStagePlan) => number
 * @returns readonly RegressionStageResult[]を返す。
 * @precondition 「plans: readonly RegressionStagePlan[]、executeStage: (plan: RegressionStagePlan) => number」がexecuteRegressionStagesの入力契約を満たす。
 * @postcondition executeRegressionStagesの責務を完了した結果だけを返す。
 * @effect N/A: executeRegressionStagesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: executeRegressionStagesは独自の失敗分岐を所有しない。
 * @invariant executeRegressionStagesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executeRegressionStagesはProcess内の同一Subsystemで完結する。
 * @security N/A: executeRegressionStagesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: executeRegressionStagesは共有非同期状態を持たない同期処理である。
 */
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

/**
 * normalizeExplicitChangedPathsの処理を実行する。
 *
 * @responsibility normalizeExplicitChangedPathsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000003
 * @input changedPaths: readonly string[]
 * @returns readonly string[]を返す。
 * @precondition 「changedPaths: readonly string[]」がnormalizeExplicitChangedPathsの入力契約を満たす。
 * @postcondition normalizeExplicitChangedPathsの責務を完了した結果だけを返す。
 * @effect N/A: normalizeExplicitChangedPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure normalizeExplicitChangedPathsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeExplicitChangedPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeExplicitChangedPathsはProcess内の同一Subsystemで完結する。
 * @security N/A: normalizeExplicitChangedPathsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: normalizeExplicitChangedPathsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * pathIsAbsoluteの処理を実行する。
 *
 * @responsibility pathIsAbsoluteに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000003
 * @input value: string
 * @returns booleanを返す。
 * @precondition 「value: string」がpathIsAbsoluteの入力契約を満たす。
 * @postcondition pathIsAbsoluteの責務を完了した結果だけを返す。
 * @effect N/A: pathIsAbsoluteは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: pathIsAbsoluteは独自の失敗分岐を所有しない。
 * @invariant pathIsAbsoluteは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: pathIsAbsoluteはProcess内の同一Subsystemで完結する。
 * @security N/A: pathIsAbsoluteはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: pathIsAbsoluteは共有非同期状態を持たない同期処理である。
 */
function pathIsAbsolute(value: string): boolean {
  return /^(?:[A-Za-z]:|\/)/u.test(value);
}

/**
 * collectChangedPathsの処理を実行する。
 *
 * @responsibility collectChangedPathsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000003
 * @input repositoryRoot: string、base: string
 * @returns readonly string[]を返す。
 * @precondition 「repositoryRoot: string、base: string」がcollectChangedPathsの入力契約を満たす。
 * @postcondition collectChangedPathsの責務を完了した結果だけを返す。
 * @effect N/A: collectChangedPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure collectChangedPathsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant collectChangedPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: collectChangedPathsはProcess内の同一Subsystemで完結する。
 * @security N/A: collectChangedPathsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: collectChangedPathsは共有非同期状態を持たない同期処理である。
 */
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
