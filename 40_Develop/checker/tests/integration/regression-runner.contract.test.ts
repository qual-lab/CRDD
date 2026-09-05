import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
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
