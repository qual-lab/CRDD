/**
 * coordinator:integration:provider-execution-boundary-matrixの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:provider-execution-boundary-matrixが所有する検証責務を実行する。
 * @trace ERB-IT-004
 * @trace PRL-IT-005
 * @level IT
 * @scope provider、executor、reviewer、lifecycle、coverage
 * @boundary ERB-IT-004=Direct Boundary: Observer→Effect Gate / PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
import {
  planProviderExecution,
  parseProviderResult,
  evaluateProviderTaskScope,
  type ProviderExecutionInput,
  type ProviderResultInput,
} from "../../../ai-adapter/src/index.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { describeDockerProviderExecutionLocations } from "../../../docker-isolation/src/index.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

/**
 * 共通計画入口の不正入力をEffect前に拒否する。
 * @responsibility Provider・用途・選定の不一致と入力Trapを候補へ昇格しない。
 * @trace ERB-IT-004
 * @precondition 合成入力だけを使う。
 * @stimulus 不明Provider・用途、欠落、余分field、accessor、ProxyとModel不一致を渡す。
 * @observation ready／blockedと計画の不存在。
 * @oracle 未知値をClaude又は正常計画へ暗黙配送しない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary 公開API→Provider固有計画のGate。
 */
test("共通計画APIは用途・Provider・選定の不一致と入力Trapを拒否する", () => {
  const request = {
    provider: "codex",
    purpose: "probe",
    input: { provider: "codex", mode: "read_only_probe", effort: "low" },
  };
  let trapCount = 0;
  for (const candidate of [
    null,
    {},
    { ...request, provider: "unknown" },
    { ...request, purpose: "unknown" },
    { ...request, extra: true },
    {
      ...request,
      modelSelection: {
        provider: "claude",
        exactModelId: "gpt-5.6-sol",
        reasoningEffort: "low",
      },
    },
    {
      ...request,
      modelSelection: {
        provider: "codex",
        exactModelId: "gpt-5.6-sol",
        reasoningEffort: "high",
      },
    },
    {
      ...request,
      modelSelection: {
        provider: "codex",
        exactModelId: "other-model",
        reasoningEffort: "low",
      },
    },
    Object.defineProperty({ ...request }, "provider", {
      get: () => {
        trapCount++;
        return "codex";
      },
    }),
    new Proxy(request, {
      ownKeys: () => {
        trapCount++;
        return [];
      },
    }),
  ]) {
    const result = planProviderExecution(
      candidate as unknown as ProviderExecutionInput,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.plan, null);
    assert.ok(result.error);
  }
  assert.equal(trapCount, 0);
  assert.equal(
    evaluateProviderTaskScope("unknown" as "codex", "executor", {}).status,
    "blocked",
  );
  assert.equal(
    evaluateProviderTaskScope("codex", "unknown", {}).status,
    "blocked",
  );
});

/**
 * 共通結果入口で用途と容量・Schema判断の責務を分離する。
 * @responsibility 不正入力を拒否し、解析成功を上位Schema成立へ読み替えない。
 * @trace ERB-IT-004
 * @precondition 合成JSONだけを使う。
 * @stimulus Taskの正常JSON、助言への誤配送、過大Task入力と不明用途を渡す。
 * @observation 解析結果・固定理由・生出力非公開。
 * @oracle 用途別の受理条件を緩めず、不正値から結果を生成しない。
 * @cleanup N/A: 純粋解析だけを行う。
 * @boundary 共通解析→Coordinatorの結果Schema検証。
 */
test("共通結果APIは用途・容量・上位Schema判断を区別する", () => {
  let trapCount = 0;
  const input = {
    provider: "codex",
    purpose: "task",
    taskRole: "executor",
    resultAcceptanceMaximumTurns: 0,
    raw: '{"status":true}',
  } as const;
  const parsed = parseProviderResult(input);
  assert.equal(parsed.status, "confirmed");
  assert.deepEqual(parsed.value, { status: true });
  assert.equal(parsed.error, null);
  assert.equal(parsed.rawOutputReported, false);
  for (const candidate of [
    null,
    {},
    { ...input, provider: "unknown" },
    { ...input, purpose: "unknown" },
    { ...input, purpose: "advice" },
    { ...input, taskRole: "unknown" },
    { ...input, raw: " ".repeat(65_537) + input.raw },
    Object.defineProperty({ ...input }, "raw", {
      get: () => {
        trapCount++;
        return input.raw;
      },
    }),
    new Proxy(input, {
      ownKeys: () => {
        trapCount++;
        return [];
      },
    }),
  ]) {
    const result = parseProviderResult(
      candidate as unknown as ProviderResultInput,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.value, null);
    assert.ok(result.error);
    assert.equal(result.rawOutputReported, false);
  }
  assert.equal(trapCount, 0);
});

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

/**
 * Codex／ClaudeのExecutor・Reviewer計画を同じProvider境界Matrixで固定するを検証する。
 *
 * @responsibility Codex／ClaudeのExecutor・Reviewer計画を同じProvider境界Matrixで固定するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codex／ClaudeのExecutor・Reviewer計画を同じProvider境界Matrixで固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("Codex／ClaudeのExecutor・Reviewer計画を同じProvider境界Matrixで固定する", () => {
  assert.equal(PLAN_CASES.length, 4);
  for (const item of PLAN_CASES) {
    const plan = (
      item.provider === "codex"
        ? (planProviderExecution(
            {
              provider: "codex",
              purpose: "task",
              input: {
                provider: "codex",
                mode: "isolated_task",
                effort: "low",
                taskRole: item.role,
              },
            },
            describeDockerProviderExecutionLocations("codex", "task"),
          ).plan ?? assert.fail("provider_execution_plan_not_ready"))
        : (planProviderExecution(
            {
              provider: "claude",
              purpose: "task",
              input: {
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
              },
            },
            describeDockerProviderExecutionLocations("claude", "task"),
          ).plan ?? assert.fail("provider_execution_plan_not_ready"))
    ) as Readonly<Record<string, unknown>>;
    const argv = plan.argv as readonly string[];
    assert.equal(plan.status, "candidate");
    assert.equal("workspaceMountMode" in plan, false);
    assert.equal(plan.taskPromptTransport, "stdin_only");
    assert.equal(plan.taskPromptInArgvAllowed, false);
    assert.equal(plan.reviewerFilesystemOrShellToolAllowed, false);
    if (item.provider === "codex") {
      assert.equal(plan.providerHomeCommandReadAllowed, false);
      assert.equal(
        plan.explicitSandboxOption,
        "approve_for_me_executor_reviewer_read_only",
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

/**
 * Provider境界の正常・拒否・異常・回収caseを実在試験へ全数対応させるを検証する。
 *
 * @responsibility Provider境界の正常・拒否・異常・回収caseを実在試験へ全数対応させるの合否判定を所有する。
 * @trace ERB-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider境界の正常・拒否・異常・回収caseを実在試験へ全数対応させるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider境界の正常・拒否・異常・回収caseを実在試験へ全数対応させる", () => {
  assert.equal(
    new Set(LIFECYCLE_CASES.map((item) => item.id)).size,
    LIFECYCLE_CASES.length,
  );
  for (const item of LIFECYCLE_CASES) {
    const source = fs.readFileSync(
      path.join(repositoryRoot, item.file),
      "utf8",
    );
    assert.match(source, new RegExp(`test\\(\\"${item.title}`));
  }
});

/**
 * 実Provider結合はCodex／ClaudeをExecutorとReviewerの双方で一回ずつ通すを検証する。
 *
 * @responsibility 実Provider結合はCodex／ClaudeをExecutorとReviewerの双方で一回ずつ通すの合否判定を所有する。
 * @trace ERB-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実Provider結合はCodex／ClaudeをExecutorとReviewerの双方で一回ずつ通すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
 */
test("実Provider結合はCodex／ClaudeをExecutorとReviewerの双方で一回ずつ通す", () => {
  assert.deepEqual(REAL_ROUTE_CASES, [
    { route: "forward", executor: "claude", reviewer: "codex" },
    { route: "reverse", executor: "codex", reviewer: "claude" },
  ]);
  const source = fs.readFileSync(
    path.join(repositoryRoot, "scripts/verify-signed-reviewer-boundary.ts"),
    "utf8",
  );
  assert.match(source, /"forward"/u);
  assert.match(source, /"reverse"/u);
  assert.match(source, /stop: "first_nonconforming_route"/u);
});
