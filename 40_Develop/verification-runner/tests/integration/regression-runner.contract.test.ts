/**
 * verification-runner:integration:regression-runnerの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility verification-runner:integration:regression-runnerが所有する検証責務を実行する。
 * @trace CQS-IT-011
 * @level IT
 * @scope regression、runner、performance、longevity、authority
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildRegressionStagePlan,
  createRegressionStageExecutor,
  collectChangedPaths,
  executeRegressionStages,
} from "../../src/execution/regression-execution.ts";

const verificationRunnerRoot = path.resolve(import.meta.dirname, "../..");
const runner = path.join(verificationRunnerRoot, "bin", "regression-runner.ts");

/**
 * invokeRunnerのTest準備責務を実行する。
 *
 * @responsibility invokeRunnerがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace CQS-IT-011
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus invokeRunnerを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
function invokeRunner(runnerArguments: readonly string[]) {
  return spawnSync(process.execPath, [runner, ...runnerArguments], {
    cwd: verificationRunnerRoot,
    encoding: "utf8",
    windowsHide: true,
  });
}

/**
 * PT／LTは全Authority条件が揃う前に試験Processを開始しないを検証する。
 *
 * @responsibility PT／LTは全Authority条件が揃う前に試験Processを開始しないの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PT／LTは全Authority条件が揃う前に試験Processを開始しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("PT／LTは全Authority条件が揃う前に試験Processを開始しない", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/verification-runner/src/catalog/test-catalog.ts",
    "--levels",
    "performance",
    "--plan",
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, "");
  const outcome = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.equal(outcome.status, "not_authorized");
  assert.equal(outcome.reason, "resource_intensive_test_authority_required");
  assert.equal(outcome.effectIssued, false);
});

/**
 * Credit 0を含む明示AuthorityはPTの計画だけを許可するを検証する。
 *
 * @responsibility Credit 0を含む明示AuthorityはPTの計画だけを許可するの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Credit 0を含む明示AuthorityはPTの計画だけを許可するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("Credit 0を含む明示AuthorityはPTの計画だけを許可する", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/verification-runner/src/catalog/test-catalog.ts",
    "--levels",
    "performance",
    "--resource-intensive-authorized",
    "--purpose",
    "bounded local measurement",
    "--environment",
    "fixed local fixture",
    "--max-duration-minutes",
    "5",
    "--max-invocations",
    "10",
    "--max-credits",
    "0",
    "--cleanup",
    "remove generated fixture data",
    "--stop-condition",
    "stop on first failure",
    "--plan",
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const plan = JSON.parse(result.stdout) as {
    status?: unknown;
    levels?: unknown;
    selected?: unknown;
  };
  assert.equal(plan.status, "planned");
  assert.deepEqual(plan.levels, ["performance"]);
  assert.deepEqual(plan.selected, []);
});

/**
 * 明示AuthorityがあってもPT／LTは上限強制実装まで計画だけとするを検証する。
 *
 * @responsibility 明示AuthorityがあってもPT／LTは上限強制実装まで計画だけとするの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 明示AuthorityがあってもPT／LTは上限強制実装まで計画だけとするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("明示AuthorityがあってもPT／LTは上限強制実装まで計画だけとする", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/verification-runner/src/catalog/test-catalog.ts",
    "--levels",
    "performance,unit",
    "--resource-intensive-authorized",
    "--purpose",
    "bounded local measurement",
    "--environment",
    "fixed local fixture",
    "--max-duration-minutes",
    "5",
    "--max-invocations",
    "10",
    "--max-credits",
    "0",
    "--cleanup",
    "remove generated fixture data",
    "--stop-condition",
    "stop on first failure",
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  const outcome = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.equal(outcome.status, "planned_not_executable");
  assert.equal(
    outcome.resourceIntensiveExecution,
    "plan_only_until_runtime_limits_are_enforced",
  );
  assert.equal(outcome.effectIssued, false);
});

/**
 * 通常回帰はUT／IT／STだけを実行可能集合へ選ぶを検証する。
 *
 * @responsibility 通常回帰はUT／IT／STだけを実行可能集合へ選ぶの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 通常回帰はUT／IT／STだけを実行可能集合へ選ぶの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("通常回帰はUT／IT／STだけを実行可能集合へ選ぶ", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/verification-runner/src/catalog/test-catalog.ts",
    "--plan",
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const plan = JSON.parse(result.stdout) as {
    levels?: unknown;
    selected?: unknown;
  };
  assert.deepEqual(plan.levels, ["unit", "integration", "system"]);
  assert.ok(Array.isArray(plan.selected));
  assert.deepEqual(plan.selected, [
    "40_Develop/verification-runner/tests/integration/regression-runner.contract.test.ts",
    "40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts",
  ]);
});

/**
 * 外部Provider試験を含む変更でもEffect 0の計画表示は停止しないを検証する。
 *
 * @responsibility 外部Provider試験を含む変更でもEffect 0の計画表示は停止しないの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 外部Provider試験を含む変更でもEffect 0の計画表示は停止しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("外部Provider試験を含む変更でもEffect 0の計画表示は停止しない", () => {
  const changedPath =
    "40_Develop/coordinator/src/security/external-send-policy-runtime.ts";
  const planned = invokeRunner(["--changed", changedPath, "--plan"]);
  assert.equal(planned.error, undefined);
  assert.equal(planned.status, 0);
  assert.equal(planned.stderr, "");
  const plan = JSON.parse(planned.stdout) as {
    selected?: string[];
    effectIssued?: unknown;
  };
  assert.ok(
    plan.selected?.includes(
      "40_Develop/coordinator/tests/integration/signed-reviewer-real-boundary.integration.test.ts",
    ),
  );
  assert.equal(plan.effectIssued, false);

  const execution = invokeRunner([
    "--changed",
    changedPath,
    "--windows-process-control-authorized",
  ]);
  assert.equal(execution.error, undefined);
  assert.equal(execution.status, 2);
  assert.deepEqual(JSON.parse(execution.stdout), {
    status: "blocked",
    reason: "interactive_or_provider_test_not_automatically_authorized",
    effectIssued: false,
  });
});

/**
 * Windows実Process試験は専用実行Profileを計画へ明示するを検証する。
 *
 * @responsibility Windows実Process試験は専用実行Profileを計画へ明示するの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows実Process試験は専用実行Profileを計画へ明示するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("Windows実Process試験は専用実行Profileを計画へ明示する", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts",
    "--plan",
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const plan = JSON.parse(result.stdout) as {
    requiredExecutionProfiles?: unknown;
    stages?: Array<{ stage?: string; selected?: string[] }>;
  };
  assert.deepEqual(plan.requiredExecutionProfiles, [
    "restricted_process",
    "windows_process_control",
  ]);
  const windowsStage = plan.stages?.find(
    (entry) => entry.stage === "windows_process_control",
  );
  assert.deepEqual(windowsStage?.selected, [
    "40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts",
  ]);
});

/**
 * Windows実Process試験は専用実行Authorityなしに試験Processを開始しないを検証する。
 *
 * @responsibility Windows実Process試験は専用実行Authorityなしに試験Processを開始しないの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows実Process試験は専用実行Authorityなしに試験Processを開始しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("Windows実Process試験は専用実行Authorityなしに試験Processを開始しない", {
  skip: process.platform !== "win32",
}, () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts",
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "blocked",
    reason: "windows_process_control_authority_required",
    requiredExecutionProfile: "windows_process_control",
    effectIssued: false,
  });
});

/**
 * Tool配下MarkdownもCheckerとRepository静的検査へ接続するを検証する。
 *
 * @responsibility Tool配下MarkdownもCheckerとRepository静的検査へ接続するの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Tool配下MarkdownもCheckerとRepository静的検査へ接続するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("Tool配下MarkdownもCheckerとRepository静的検査へ接続する", () => {
  for (const changedPath of [
    "16_Quality_Assurance.md",
    "40_Develop/coordinator/README.md",
    "40_Develop/platform-access/README.md",
  ]) {
    const result = invokeRunner(["--changed", changedPath, "--plan"]);
    assert.equal(result.status, 0, changedPath);
    const plan = JSON.parse(result.stdout) as {
      selected?: string[];
      stages?: Array<{
        stage?: string;
        owners?: string[];
        selectionReason?: string;
      }>;
    };
    assert.ok(
      plan.selected?.every((entry) => entry.startsWith("40_Develop/checker/")),
      changedPath,
    );
    const staticStage = plan.stages?.find((entry) => entry.stage === "static");
    assert.deepEqual(staticStage?.owners, ["checker"]);
    assert.equal(
      staticStage?.selectionReason,
      "owner_static_checks_and_repository_check",
    );
  }
});

/**
 * 共通component変更は利用側契約と利用側静的検査を同じ計画へ含めるを検証する。
 *
 * @responsibility 共通component変更は利用側契約と利用側静的検査を同じ計画へ含めるの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 共通component変更は利用側契約と利用側静的検査を同じ計画へ含めるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("共通component変更は利用側契約と利用側静的検査を同じ計画へ含める", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/execution-intelligence/src/store/execution-intelligence-store.ts",
    "--plan",
  ]);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const plan = JSON.parse(result.stdout) as {
    selected?: string[];
    stages?: Array<{ stage?: string; owners?: string[] }>;
  };
  assert.ok(
    plan.selected?.includes(
      "40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts",
    ),
  );
  const staticStage = plan.stages?.find((entry) => entry.stage === "static");
  assert.deepEqual(staticStage?.owners, [
    "coordinator",
    "execution-intelligence",
  ]);
});

/**
 * 利用側静的検査はunit限定でも残し、利用側ITは実行しないを検証する。
 *
 * @responsibility 利用側静的検査はunit限定でも残し、利用側ITは実行しないの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 利用側静的検査はunit限定でも残し、利用側ITは実行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("利用側静的検査はunit限定でも残し、利用側ITは実行しない", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/execution-intelligence/src/store/execution-intelligence-store.ts",
    "--levels",
    "unit",
    "--plan",
  ]);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const plan = JSON.parse(result.stdout) as {
    selected?: string[];
    stages?: Array<{ stage?: string; owners?: string[] }>;
  };
  assert.ok((plan.selected?.length ?? 0) > 0);
  assert.ok(
    plan.selected?.every((entry) =>
      entry.includes("execution-intelligence/tests/unit/"),
    ),
  );
  assert.deepEqual(
    plan.stages?.find((entry) => entry.stage === "static")?.owners,
    ["coordinator", "execution-intelligence"],
  );
  assert.deepEqual(
    plan.stages?.find((entry) => entry.stage === "integration")?.owners,
    [],
  );
});

/**
 * 実行知の静的検査はCoordinatorのtoolchainを参照しないを検証する。
 *
 * @responsibility 実行知の静的検査はCoordinatorのtoolchainを参照しないの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行知の静的検査はCoordinatorのtoolchainを参照しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("実行知の静的検査はCoordinatorのtoolchainを参照しない", () => {
  const source = fs.readFileSync(
    path.join(
      verificationRunnerRoot,
      "src",
      "application",
      "regression-runner.ts",
    ),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /toolRoot|coordinator[\\/]+node_modules|node_modules[\\/]+typescript/u,
  );
  assert.match(source, /runNpmScript\("check", root\)/u);
});

const selectedRegressionEntries = [
  { owner: "checker", level: "unit", path: "checker.unit.test.ts" },
  {
    owner: "coordinator",
    level: "integration",
    path: "coordinator.integration.test.ts",
    executionProfiles: ["restricted_process", "windows_process_control"],
  },
  { owner: "checker", level: "system", path: "checker.system.test.ts" },
] as const;

/**
 * executeInjectedPlanのTest準備責務を実行する。
 *
 * @responsibility executeInjectedPlanがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace CQS-IT-011
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus executeInjectedPlanを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
function executeInjectedPlan(
  failedStep: string | null = null,
  windowsProcessControlRequired = true,
) {
  const observedSteps: string[] = [];
  const plans = buildRegressionStagePlan(
    selectedRegressionEntries,
    ["40_Develop/coordinator/src/coordinator.ts"],
    windowsProcessControlRequired,
  );
  const executeStage = createRegressionStageExecutor({
    runStatic: () => {
      observedSteps.push("static");
      return failedStep === "static" ? 1 : 0;
    },
    runLevel: (stage) => {
      observedSteps.push(stage);
      return failedStep === stage ? 1 : 0;
    },
    runWindowsProcess: () => {
      observedSteps.push("windows_process_control");
      return failedStep === "windows_process_control" ? 1 : 0;
    },
  });
  const results = executeRegressionStages(plans, executeStage);
  return { observedSteps, plans, results };
}

/**
 * 実配線は表示した同じ計画を静的確認からWindows GateとSTまで順序実行するを検証する。
 *
 * @responsibility 実配線は表示した同じ計画を静的確認からWindows GateとSTまで順序実行するの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実配線は表示した同じ計画を静的確認からWindows GateとSTまで順序実行するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("実配線は表示した同じ計画を静的確認からWindows GateとSTまで順序実行する", () => {
  const { observedSteps, plans, results } = executeInjectedPlan();
  assert.deepEqual(
    plans.map((entry) => entry.stage),
    observedSteps,
  );
  assert.deepEqual(observedSteps, [
    "static",
    "unit",
    "integration",
    "windows_process_control",
    "system",
  ]);
  assert.ok(results.every((entry) => entry.status === "completed"));
  assert.deepEqual(
    results.map((result) => ({
      stage: result.stage,
      owners: result.owners,
      selected: result.selected,
      selectionReason: result.selectionReason,
    })),
    plans,
  );
});

/**
 * 同じ計画の各工程失敗は後続levelとWindows Gateを開始しないを検証する。
 *
 * @responsibility 同じ計画の各工程失敗は後続levelとWindows Gateを開始しないの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 同じ計画の各工程失敗は後続levelとWindows Gateを開始しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("同じ計画の各工程失敗は後続levelとWindows Gateを開始しない", () => {
  for (const failedStep of [
    "static",
    "unit",
    "integration",
    "windows_process_control",
    "system",
  ]) {
    const { observedSteps, plans, results } = executeInjectedPlan(failedStep);
    assert.equal(observedSteps.at(-1), failedStep);
    const failureIndex = plans.findIndex((entry) => entry.stage === failedStep);
    assert.ok(
      results
        .slice(failureIndex + 1)
        .every((entry) => entry.status === "not_run_due_to_prior_stage"),
    );
  }
});

/**
 * Windows Gate不要時は表示計画にも実行記録にも現れないを検証する。
 *
 * @responsibility Windows Gate不要時は表示計画にも実行記録にも現れないの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows Gate不要時は表示計画にも実行記録にも現れないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("Windows Gate不要時は表示計画にも実行記録にも現れない", () => {
  const { plans, observedSteps, results } = executeInjectedPlan(null, false);
  assert.deepEqual(
    plans.map((entry) => entry.stage),
    ["static", "unit", "integration", "system"],
  );
  assert.deepEqual(
    observedSteps,
    plans.map((entry) => entry.stage),
  );
  assert.ok(results.every((entry) => entry.status === "completed"));
});

/**
 * 明示変更PathはRepository内の正規化相対Pathだけを受理するを検証する。
 *
 * @responsibility 明示変更PathはRepository内の正規化相対Pathだけを受理するの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 明示変更PathはRepository内の正規化相対Pathだけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("明示変更PathはRepository内の正規化相対Pathだけを受理する", () => {
  for (const changedPath of [
    "../outside.ts",
    "C:/outside.ts",
    "/outside.ts",
    "40_Develop\\verification-runner\\src\\catalog\\test-catalog.ts",
    "./40_Develop/verification-runner/src/catalog/test-catalog.ts",
  ]) {
    const result = invokeRunner(["--changed", changedPath, "--plan"]);
    assert.equal(result.status, 2, changedPath);
    const outcome = JSON.parse(result.stdout) as Record<string, unknown>;
    assert.equal(outcome.status, "blocked");
    assert.equal(outcome.reason, "regression_runner_observation_failed");
    assert.equal(outcome.detail, "regression_runner_changed_path_invalid");
    assert.equal(outcome.effectIssued, false);
  }
});

/**
 * Git変更集合はcommit・index・worktree・未追跡とrename両側を合成するを検証する。
 *
 * @responsibility Git変更集合はcommit・index・worktree・未追跡とrename両側を合成するの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Git変更集合はcommit・index・worktree・未追跡とrename両側を合成するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("Git変更集合はcommit・index・worktree・未追跡とrename両側を合成する", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-regression-git-"));
  /**
   * gitのTest準備責務を実行する。
   *
   * @responsibility gitがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace CQS-IT-011
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus gitを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
   */
  const git = (...gitArguments: string[]) =>
    execFileSync("git", gitArguments, { cwd: root, stdio: "pipe" });
  try {
    git("init", "--quiet");
    git("config", "user.email", "test@example.invalid");
    git("config", "user.name", "CRDD Test");
    fs.writeFileSync(path.join(root, "committed.txt"), "base\n");
    fs.writeFileSync(path.join(root, "renamed-old.txt"), "rename\n");
    fs.writeFileSync(path.join(root, "worktree.txt"), "base\n");
    git("add", ".");
    git("commit", "--quiet", "-m", "base");
    const base = git("rev-parse", "HEAD").toString().trim();
    fs.writeFileSync(path.join(root, "committed.txt"), "commit\n");
    git("add", "committed.txt");
    git("commit", "--quiet", "-m", "change");
    git("mv", "renamed-old.txt", "renamed-new.txt");
    fs.writeFileSync(path.join(root, "worktree.txt"), "worktree\n");
    fs.writeFileSync(path.join(root, "untracked.txt"), "untracked\n");
    const observedPaths = collectChangedPaths(root, base);
    for (const expected of [
      "committed.txt",
      "renamed-old.txt",
      "renamed-new.txt",
      "worktree.txt",
      "untracked.txt",
    ])
      assert.ok(observedPaths.includes(expected), expected);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
