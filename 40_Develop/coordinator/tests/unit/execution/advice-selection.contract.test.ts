/**
 * Workbench AI Provider Adapterの固定選択契約を検証する。
 *
 * @packageDocumentation
 * @responsibility exact 選定伝播、Provider分岐、Effect前拒否およびfallback禁止を検証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Provider非依存Adapterと固定Fake Executorの局所境界。
 */
import type { AdviceProviderOutcome } from "../../../src/execution/advice.ts";
import type { ProviderAdviceExecutionPlan } from "../../../src/execution/preparation.ts";
import assert from "node:assert/strict";
import { executionSelection } from "../../fixtures/ai-selection.ts";
import { fixtureNetworkPolicy } from "../../fixtures/network-policy.ts";
import test from "node:test";
import {
  validateProviderModelId,
  prepareProviderEnvironment,
} from "../../../../ai-adapter/src/index.ts";

import { prepareAdviceTask } from "../../../src/execution/preparation.ts";
import { createProviderAdviceAdapter } from "../../../src/execution/advice.ts";

const selection = executionSelection("advice");
const prepared = prepareAdviceTask({
  executionSelection: selection,
  prompt: "現在状態を説明する",
  projection: [
    {
      reference: "PROJECT_CONTEXT.md",
      content: "# Project Context\n",
      sha256:
        "f2e9caaf190981cfb75bb7e6ff59e7609b79b8e79280a721701dc88cfcef607d",
    },
  ],
});
if (prepared.status !== "prepared" || prepared.taskPacket === null)
  throw new Error("test_task_packet_required");

/**
 * exact Codex 選定を変更せず一つのExecutorへ渡すを検証する。
 *
 * @responsibility exact Codex 選定を変更せず一つのExecutorへ渡すを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus exact Codex 選定を変更せず一つのExecutorへ渡すの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("exact Codex 選定を変更せず一つのExecutorへ渡す", async () => {
  let codexInput: unknown = null;
  let claudeCalls = 0;
  const adapter = createProviderAdviceAdapter(async (plan) => {
    const executors: Record<
      "codex" | "claude",
      (plan: ProviderAdviceExecutionPlan) => Promise<AdviceProviderOutcome>
    > = {
      codex: async (input) => {
        codexInput = input;
        return Object.freeze({
          status: "blocked" as const,
          reason: "fixture_completed",
          rawOutput: null,
          providerEffectIssued: false,
          cleanupConfirmed: true,
        });
      },
      claude: async () => {
        claudeCalls += 1;
        throw new Error("unreachable");
      },
    };
    const outcome = await executors[plan.provider](plan);
    if (outcome.status === "completed" && typeof outcome.rawOutput === "string")
      return {
        status: "completed" as const,
        reason: null,
        adviceJson: outcome.rawOutput,
        providerEffectIssued: true as const,
        cleanupConfirmed: true as const,
      };
    return {
      status: "blocked" as const,
      reason: outcome.reason ?? "fixture_blocked",
      adviceJson: null,
      providerEffectIssued: outcome.providerEffectIssued,
      cleanupConfirmed: outcome.cleanupConfirmed,
    };
  });
  const result = await adapter(
    Object.freeze({
      networkPolicy: fixtureNetworkPolicy(selection.provider),
      taskPacket: prepared.taskPacket,
      executionSelection: selection,
    }),
    new AbortController().signal,
  );
  assert.equal(result.reason, "fixture_completed");
  assert.equal(typeof codexInput, "object");
  const { providerCommand, ...flatInput } = codexInput as Record<
    string,
    unknown
  >;
  assert.deepEqual(flatInput, {
    contract: "crdd-coordinator/workbench-ai-advice-execution-plan",
    contractRevision: 2,
    mode: "workbench_advice",
    provider: selection.provider,
    providerPrompt: prepared.taskPacket.providerPrompt,
    taskHash: prepared.taskPacket.taskHash,
    projectionHash: prepared.taskPacket.projectionHash,
    executionSelection: selection,
    exactModelId: selection.modelIdentifier,
    reasoningEffort: selection.reasoningEffort,
    offering: "chatgpt_subscription_oauth",
    promptTransport: "stdin",
    repositoryMounted: false,
    workspaceMounted: false,
    toolsAllowed: false,
    sessionPersistenceAllowed: false,
    apiKeyFallbackAllowed: false,
    paidApiFallbackAllowed: false,
  });
  assert.deepEqual(
    {
      provider: (providerCommand as { provider: unknown }).provider,
      modelIdentifier: (providerCommand as { modelIdentifier: unknown })
        .modelIdentifier,
      reasoningEffort: (providerCommand as { reasoningEffort: unknown })
        .reasoningEffort,
      repositoryMounted: (providerCommand as { repositoryMounted: unknown })
        .repositoryMounted,
      workspaceMountRequired: (
        providerCommand as { workspaceMountRequired: unknown }
      ).workspaceMountRequired,
      toolsAllowed: (providerCommand as { toolsAllowed: unknown }).toolsAllowed,
    },
    {
      provider: "codex",
      modelIdentifier: selection.modelIdentifier,
      reasoningEffort: selection.reasoningEffort,
      repositoryMounted: false,
      workspaceMountRequired: false,
      toolsAllowed: false,
    },
  );
  assert.equal(claudeCalls, 0);
});

/**
 * 選定契約不整合を全Executor Effect前に拒否するを検証する。
 *
 * @responsibility 選定契約不整合を全Executor Effect前に拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 選定契約不整合を全Executor Effect前に拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("選定契約不整合を全Executor Effect前に拒否する", async () => {
  let calls = 0;
  const adapter = createProviderAdviceAdapter(async (plan) => {
    const executors: Record<
      "codex" | "claude",
      (plan: ProviderAdviceExecutionPlan) => Promise<AdviceProviderOutcome>
    > = {
      codex: async () => {
        calls += 1;
        throw new Error("unreachable");
      },
      claude: async () => {
        calls += 1;
        throw new Error("unreachable");
      },
    };
    const outcome = await executors[plan.provider](plan);
    if (outcome.status === "completed" && typeof outcome.rawOutput === "string")
      return {
        status: "completed" as const,
        reason: null,
        adviceJson: outcome.rawOutput,
        providerEffectIssued: true as const,
        cleanupConfirmed: true as const,
      };
    return {
      status: "blocked" as const,
      reason: outcome.reason ?? "fixture_blocked",
      adviceJson: null,
      providerEffectIssued: outcome.providerEffectIssued,
      cleanupConfirmed: outcome.cleanupConfirmed,
    };
  });
  const result = await adapter(
    Object.freeze({
      networkPolicy: fixtureNetworkPolicy(selection.provider),
      taskPacket: prepared.taskPacket,
      executionSelection: Object.freeze({
        ...selection,
        provider: "claude" as const,
      }),
    }),
    new AbortController().signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "workbench_ai_provider_profile_invalid");
  assert.equal(result.providerEffectIssued, false);
  assert.equal(calls, 0);
});

/**
 * Taskの選定不一致はCoordinatorで停止する。
 *
 * @responsibility 選定検査の移管後もTask対応をCoordinatorが所有することを確認する。
 * @trace ERB-UT-023
 * @precondition 正常選定と異なる選定 IDのTaskを用意する。
 * @stimulus Provider Adapterへ不一致Taskを渡す。
 * @observation 公開拒否結果と両Executorの呼出し数を取得する。
 * @oracle 選定検査が正常でもTask不一致を拒否し、Executorを呼ばない。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary ERB-UT-023=Direct Boundary: Task Identity→Coordinator Provider Adapter
 */
test("Task 選定不一致はAI Adapter移管後もExecutor Effect前に拒否する", async () => {
  let calls = 0;
  const adapter = createProviderAdviceAdapter(async (plan) => {
    const executors: Record<
      "codex" | "claude",
      (plan: ProviderAdviceExecutionPlan) => Promise<AdviceProviderOutcome>
    > = {
      codex: async () => {
        calls += 1;
        throw new Error("unreachable");
      },
      claude: async () => {
        calls += 1;
        throw new Error("unreachable");
      },
    };
    const outcome = await executors[plan.provider](plan);
    if (outcome.status === "completed" && typeof outcome.rawOutput === "string")
      return {
        status: "completed" as const,
        reason: null,
        adviceJson: outcome.rawOutput,
        providerEffectIssued: true as const,
        cleanupConfirmed: true as const,
      };
    return {
      status: "blocked" as const,
      reason: outcome.reason ?? "fixture_blocked",
      adviceJson: null,
      providerEffectIssued: outcome.providerEffectIssued,
      cleanupConfirmed: outcome.cleanupConfirmed,
    };
  });
  const result = await adapter(
    {
      networkPolicy: fixtureNetworkPolicy(selection.provider),
      taskPacket: {
        ...prepared.taskPacket,
        executionSelection: { ...selection, configIdentity: "f".repeat(64) },
      },
      executionSelection: selection,
    },
    new AbortController().signal,
  );
  assert.equal(result.reason, "workbench_ai_provider_profile_invalid");
  assert.equal(result.providerEffectIssued, false);
  assert.equal(calls, 0);
});

/**
 * Model構文と固定環境の移管が既存の受理・拒否集合を保持する。
 *
 * @responsibility 文字数境界、禁止名全数、値の不正、順序と一回取得を反証する。
 * @trace ERB-UT-023
 * @precondition 両Providerの固定禁止集合と局所環境候補を使用する。
 * @stimulus 正常値、境界値、禁止名、非文字列とNULを純粋検査へ渡す。
 * @observation Model結果、環境組の順序、取得回数と入力不変性を確認する。
 * @oracle 既存構文と禁止集合に一致し、同じSnapshotを一回だけ取得して返す。
 * @cleanup N/A: 環境変数やProcessを実際には変更しない。
 * @boundary ERB-UT-023=Direct Boundary: Coordinator計画→AI Adapter固定値検査
 */
test("Modelと固定環境の単一移管は構文境界・禁止集合・一回取得を保持する", () => {
  for (const model of ["gpt-5.5", "claude-opus-4.8", "a".repeat(128)]) {
    assert.equal(validateProviderModelId(model).value, model);
  }
  for (const model of [
    "",
    "a".repeat(129),
    "GPT-5.5",
    " gpt-5.5",
    "gpt 5.5",
    "gpt\0",
    "-gpt",
    "gpt/5.5",
  ]) {
    assert.equal(validateProviderModelId(model).value, null);
  }
  for (const [provider, forbiddenNames] of [
    [
      "codex",
      [
        "OPENAI_API_KEY",
        "CODEX_API_KEY",
        "OPENAI_BASE_URL",
        "OPENAI_ORG_ID",
        "OPENAI_PROJECT_ID",
        "HTTPS_PROXY",
        "HTTP_PROXY",
        "ALL_PROXY",
        "NO_PROXY",
      ],
    ],
    [
      "claude",
      [
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_AUTH_TOKEN",
        "ANTHROPIC_BASE_URL",
        "CLAUDE_CODE_OAUTH_TOKEN",
        "HTTP_PROXY",
        "NO_PROXY",
      ],
    ],
  ] as const) {
    const environment = Object.freeze({
      PROVIDER_HOME: "/provider-home",
      FIXED_EMPTY: "",
      FIXED_VALUE: "value",
    });
    assert.deepEqual(prepareProviderEnvironment(provider, environment), {
      status: "ready",
      entries: Object.entries(environment),
    });
    assert.deepEqual(prepareProviderEnvironment(provider, {}), {
      status: "ready",
      entries: [],
    });
    for (const name of forbiddenNames) {
      assert.deepEqual(
        prepareProviderEnvironment(provider, { [name]: "forbidden" }),
        { status: "blocked", reason: "provider_environment_invalid" },
      );
    }
    assert.deepEqual(
      prepareProviderEnvironment(provider, { FIXED: "nul\0value" }),
      { status: "blocked", reason: "provider_environment_invalid" },
    );
    assert.deepEqual(
      prepareProviderEnvironment(provider, {
        FIXED: 1,
      } as unknown as Record<string, string>),
      { status: "blocked", reason: "provider_environment_invalid" },
    );
    let reads = 0;
    const accessor = Object.defineProperty({}, "FIXED", {
      enumerable: true,
      get: () => {
        reads += 1;
        return "snapshot";
      },
    });
    assert.deepEqual(prepareProviderEnvironment(provider, accessor), {
      status: "ready",
      entries: [["FIXED", "snapshot"]],
    });
    assert.equal(reads, 1);
    const failedEnvironment = Object.defineProperty({}, "FIXED", {
      enumerable: true,
      get: () => {
        throw new Error("synthetic_environment_read_failed");
      },
    });
    assert.throws(
      () => prepareProviderEnvironment(provider, failedEnvironment),
      { message: "synthetic_environment_read_failed" },
    );
    assert.deepEqual(environment, {
      PROVIDER_HOME: "/provider-home",
      FIXED_EMPTY: "",
      FIXED_VALUE: "value",
    });
  }
});
