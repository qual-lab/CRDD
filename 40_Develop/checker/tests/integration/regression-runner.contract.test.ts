import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createRegressionStageExecutor,
  collectChangedPathsFromGit,
  executeRegressionStages,
  regressionStageOrder,
} from "../../regression-execution.ts";

const checkerRoot = path.resolve(import.meta.dirname, "../..");
const runner = path.join(checkerRoot, "regression-runner.ts");

function invokeRunner(runnerArguments: readonly string[]) {
  return spawnSync(process.execPath, [runner, ...runnerArguments], {
    cwd: checkerRoot,
    encoding: "utf8",
    windowsHide: true,
  });
}

test("PT／LTは全Authority条件が揃う前に試験Processを開始しない", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/checker/test-catalog.ts",
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

test("Credit 0を含む明示AuthorityはPTの計画だけを許可する", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/checker/test-catalog.ts",
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

test("明示AuthorityがあってもPT／LTは上限強制実装まで計画だけとする", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/checker/test-catalog.ts",
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

test("通常回帰はUT／IT／STだけを実行可能集合へ選ぶ", () => {
  const result = invokeRunner([
    "--changed",
    "40_Develop/checker/test-catalog.ts",
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
  assert.ok((plan.selected as unknown[]).length >= 4);
});

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
  };
  assert.deepEqual(plan.requiredExecutionProfiles, [
    "restricted_process",
    "windows_process_control",
  ]);
});

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

test("回帰stageは静的確認からSTへ順序実行する", () => {
  const observedStages: string[] = [];
  const results = executeRegressionStages(regressionStageOrder, (stage) => {
    observedStages.push(stage);
    return 0;
  });
  assert.deepEqual(observedStages, ["static", "unit", "integration", "system"]);
  assert.ok(results.every((entry) => entry.status === "completed"));
});

test("前段失敗は後段を未実行にする", () => {
  for (const failedStage of ["static", "unit", "integration"] as const) {
    const observedStages: string[] = [];
    const results = executeRegressionStages(regressionStageOrder, (stage) => {
      observedStages.push(stage);
      return stage === failedStage ? 1 : 0;
    });
    assert.equal(observedStages.at(-1), failedStage);
    const failureIndex = regressionStageOrder.indexOf(failedStage);
    assert.ok(
      results
        .slice(failureIndex + 1)
        .every((entry) => entry.status === "not_run_due_to_prior_stage"),
    );
  }
});

test("実配線はWindows Gateを結合試験後かつ総合試験前に一度だけ実行する", () => {
  const observedSteps: string[] = [];
  const executeStage = createRegressionStageExecutor({
    windowsProcessControlRequired: true,
    runStatic: () => {
      observedSteps.push("static");
      return 0;
    },
    runLevel: (stage) => {
      observedSteps.push(stage);
      return 0;
    },
    runWindowsProcess: () => {
      observedSteps.push("windows_process_control");
      return 0;
    },
  });
  executeRegressionStages(regressionStageOrder, executeStage);
  assert.deepEqual(observedSteps, [
    "static",
    "unit",
    "integration",
    "windows_process_control",
    "system",
  ]);
});

test("実配線の各失敗は後続levelとWindows Gateを開始しない", () => {
  for (const failedStep of [
    "static",
    "unit",
    "integration",
    "windows_process_control",
  ]) {
    const observedSteps: string[] = [];
    const executeStage = createRegressionStageExecutor({
      windowsProcessControlRequired: true,
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
    executeRegressionStages(regressionStageOrder, executeStage);
    assert.equal(observedSteps.at(-1), failedStep);
  }
});

test("明示変更PathはRepository内の正規化相対Pathだけを受理する", () => {
  for (const changedPath of [
    "../outside.ts",
    "C:/outside.ts",
    "/outside.ts",
    "40_Develop\\checker\\test-catalog.ts",
    "./40_Develop/checker/test-catalog.ts",
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

test("Git変更集合はcommit・index・worktree・未追跡とrename両側を合成する", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-regression-git-"));
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
    const changedPaths = collectChangedPathsFromGit(root, base);
    for (const expected of [
      "committed.txt",
      "renamed-old.txt",
      "renamed-new.txt",
      "worktree.txt",
      "untracked.txt",
    ])
      assert.ok(changedPaths.includes(expected), expected);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Git変更集合は一つの観測失敗を部分成功にしない", () => {
  let call = 0;
  assert.throws(
    () =>
      collectChangedPathsFromGit("C:/unused", "main", () => {
        call += 1;
        return {
          error: undefined,
          status: call === 3 ? 1 : 0,
          stdout: call === 1 ? "first.ts\0" : "",
        };
      }),
    /regression_runner_git_observation_failed:index_to_worktree/u,
  );
});
