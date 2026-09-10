import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { planClaudeIsolatedTask } from "../../src/security/claude-execution-plan.ts";
import { planCodexIsolatedTask } from "../../src/security/codex-execution-plan.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");

const PLAN_CASES = Object.freeze([
  Object.freeze({ provider: "codex", role: "executor" }),
  Object.freeze({ provider: "codex", role: "reviewer" }),
  Object.freeze({ provider: "claude", role: "executor" }),
  Object.freeze({ provider: "claude", role: "reviewer" }),
] as const);

const LIFECYCLE_CASES = Object.freeze([
  Object.freeze({
    id: "provider_start_sync_failure",
    file: "tests/integration/docker-process-controller.contract.test.ts",
    title: "Provider commandの同期起動失敗を実Process開始として公開しない",
  }),
  Object.freeze({
    id: "provider_start_async_failure",
    file: "tests/integration/docker-process-controller.contract.test.ts",
    title:
      "Provider commandの非同期起動失敗も開始観測とProvider Effectへ昇格しない",
  }),
  Object.freeze({
    id: "provider_nonzero_exit",
    file: "tests/integration/docker-process-controller.contract.test.ts",
    title:
      "Provider非ゼロ終了は生出力を返さず既知の運用原因だけを閉集合へ分類する",
  }),
  Object.freeze({
    id: "provider_timeout",
    file: "tests/integration/docker-process-controller.contract.test.ts",
    title: "provider timeoutは終了要求後もcleanupを必須にする",
  }),
  Object.freeze({
    id: "provider_cancel",
    file: "tests/integration/docker-process-controller.contract.test.ts",
    title: "取消はactive processへ一度だけ伝えcleanup後にcancelledになる",
  }),
  Object.freeze({
    id: "cleanup_unknown",
    file: "tests/integration/docker-process-controller.contract.test.ts",
    title: "cleanup不明なら成功出力を破棄しmanual Recoveryへ閉じる",
  }),
  Object.freeze({
    id: "malformed_result",
    file: "tests/integration/docker-process-controller.contract.test.ts",
    title: "Provider Result不正時もcleanupし正規化Resultを公開しない",
  }),
  Object.freeze({
    id: "role_specific_result",
    file: "tests/integration/docker-process-controller.contract.test.ts",
    title: "隔離TaskのRole別Resultだけをcleanup後に公開する",
  }),
  Object.freeze({
    id: "candidate_changed_paths_mismatch",
    file: "tests/integration/coordinator-task-runtime.contract.test.ts",
    title:
      "Executor自己申告と実Candidate差またはOperation cleanup不明を成功にしない",
  }),
  Object.freeze({
    id: "reviewer_projection_failure",
    file: "tests/integration/coordinator-task-runtime.contract.test.ts",
    title:
      "Candidate結合済みReviewer投影を作れなければReviewer Effect前に停止する",
  }),
  Object.freeze({
    id: "single_remediation",
    file: "tests/integration/coordinator-task-runtime.contract.test.ts",
    title:
      "Reviewer指摘を一回だけ同一Executorへ戻し、同一独立Reviewerの再承認へ接続する",
  }),
  Object.freeze({
    id: "provider_process_and_resource_settlement",
    file: "tests/integration/docker-process-controller.contract.test.ts",
    title: "固定command planを完了後に全resource不存在とlease解放へ閉じる",
  }),
]);

const REAL_ROUTE_CASES = Object.freeze([
  Object.freeze({
    route: "forward",
    executor: "claude",
    reviewer: "codex",
  }),
  Object.freeze({
    route: "reverse",
    executor: "codex",
    reviewer: "claude",
  }),
] as const);

test("Codex／ClaudeのExecutor・Reviewer計画を同じProvider境界Matrixで固定する", () => {
  assert.equal(PLAN_CASES.length, 4);
  for (const item of PLAN_CASES) {
    const plan = (
      item.provider === "codex"
        ? planCodexIsolatedTask({
            provider: "codex",
            mode: "isolated_task",
            effort: "low",
            taskRole: item.role,
          })
        : planClaudeIsolatedTask({
            provider: "claude",
            mode: "isolated_task",
            effort: "low",
            taskRole: item.role,
            taskWorkload: {
              readPathCount: 1,
              allowedPathCount: 1,
              acceptanceCriterionCount: 1,
              remediationFindingCount: 0,
            },
          })
    ) as Readonly<Record<string, unknown>>;
    const argv = plan.argv as readonly string[];
    assert.equal(plan.status, "candidate");
    assert.equal(
      plan.workspaceMountMode,
      item.role === "executor" ? "read_write" : "read_only",
    );
    assert.equal(plan.taskPromptTransport, "stdin_only");
    assert.equal(plan.taskPromptInArgvAllowed, false);
    assert.equal(plan.reviewerFilesystemOrShellToolAllowed, false);
    if (item.provider === "codex") {
      assert.equal(plan.providerHomeCommandReadAllowed, false);
      assert.equal(
        plan.explicitSandboxOption,
        "approve_for_me_executor_workspace_write_reviewer_read_only",
      );
      assert.equal(argv.includes("--approve-for-me"), item.role === "executor");
      assert.equal(argv.includes("--sandbox"), item.role === "reviewer");
      assert.equal(
        argv.includes('approval_policy="never"'),
        item.role === "reviewer",
      );
      assert.equal(
        argv.includes("--approve-for-me") && argv.includes("--sandbox"),
        false,
      );
    } else {
      assert.equal(plan.providerHomeBuiltInToolAccessAllowed, false);
      const permissionMode = argv[argv.indexOf("--permission-mode") + 1];
      assert.equal(
        permissionMode,
        item.role === "executor" ? "acceptEdits" : "dontAsk",
      );
      assert.equal(argv.includes("--tools="), item.role === "reviewer");
    }
  }
});

test("Provider境界の正常・拒否・異常・回収caseを実在試験へ全数対応させる", () => {
  assert.equal(
    new Set(LIFECYCLE_CASES.map((item) => item.id)).size,
    LIFECYCLE_CASES.length,
  );
  for (const item of LIFECYCLE_CASES) {
    const source = fs.readFileSync(path.join(ROOT, item.file), "utf8");
    assert.match(source, new RegExp(`test\\(\\"${item.title}`));
  }
});

test("実Provider結合はCodex／ClaudeをExecutorとReviewerの双方で一回ずつ通す", () => {
  assert.deepEqual(REAL_ROUTE_CASES, [
    { route: "forward", executor: "claude", reviewer: "codex" },
    { route: "reverse", executor: "codex", reviewer: "claude" },
  ]);
  const source = fs.readFileSync(
    path.join(ROOT, "scripts/verify-signed-reviewer-boundary.ts"),
    "utf8",
  );
  assert.match(source, /"forward"/u);
  assert.match(source, /"reverse"/u);
  assert.match(source, /stop: "first_nonconforming_route"/u);
});
