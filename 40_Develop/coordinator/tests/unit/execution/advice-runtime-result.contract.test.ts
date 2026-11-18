/**
 * Workbench助言Adapterの一回実行・取消・結果受理を検証する。
 *
 * @packageDocumentation
 * @responsibility Effect前拒否、exact計画伝播、取消、cleanup、出力抽出および例外Fail-closedを検証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Provider AdapterとFake Runtime Portの局所境界。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../../docker-isolation/tests/support/source-declaration.ts";

/**
 * @trace ERB-UT-023
 * @precondition 実Advice Runtimeと失敗分類本文をメモリで実行する。
 * @stimulus 起動発行後の失敗をcleanup確認済みの初期化失敗として返す。
 * @observation 公開Runtime結果と上位へ渡る元失敗分類。
 * @oracle Provider未発行・Host ID欠測と手動確認必要性を同時に保持する。
 * @cleanup メモリのみ。実AI・Docker・保存なし。
 */
test("通常起動の発行後不明はAdvice結果でも手動確認必要性を保持する", async () => {
  const source = readFileSync(
    new URL("../../../src/execution/advice.ts", import.meta.url),
    "utf8",
  );
  const declarations = [
    "AdviceRuntimeError",
    "createProviderAdviceRuntime",
    "blocked",
    "classifyProviderAdviceHostFailure",
  ]
    .map((name) => sourceDeclaration(source, name))
    .join("\n");
  const runtime = runInNewContext(
    `${declarations};({
    run:createProviderAdviceRuntime({createOperation:async(_signal,verify)=>{
      if(!verify())throw Error('boundary');
      throw new AdviceRuntimeError('docker_environment_start_timeout', {
        cleanupConfirmed:true,manualRecoveryRequired:true,hostRecoveryId:null
      });
    }}),classify:classifyProviderAdviceHostFailure
  })`,
    {
      initializationFailures: new WeakMap(),
      hostFailures: new WeakMap(),
      isRuntimeProcessPoisoned: () => false,
      safePlan: () => true,
    },
  ) as {
    run: (
      plan: unknown,
      signal: AbortSignal,
    ) => Promise<{
      status: string;
      cleanupConfirmed: boolean;
      providerEffectIssued: boolean;
    }>;
    classify: (value: unknown) => {
      manualRecoveryRequired: boolean;
      hostRecoveryId: string | null;
    };
  };
  const result = await runtime.run({}, new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.providerEffectIssued, false);
  assert.equal(runtime.classify(result).manualRecoveryRequired, true);
  assert.equal(runtime.classify(result).hostRecoveryId, null);
});

/**
 * @trace ERB-UT-023
 * @precondition Task／Adviceの本番依存の起動接続だけを実本文から取得する。
 * @stimulus 起動拒否・終了不明・待機中の失効・正常起動。
 * @observation 起動とHost生成の順序、元の失敗相関。
 * @oracle readyかつ現在境界成立後だけHostを作り、未作成HostのIDを捏造しない。
 * @cleanup メモリのみ。実AI・Docker・Filesystem書込みなし。
 */
test("通常起動の結果と現在境界が成立する前にHostを作成しない", async () => {
  for (const file of ["controller", "advice"]) {
    const source = readFileSync(
      new URL(`../../../src/execution/${file}.ts`, import.meta.url),
      "utf8",
    );
    const anchor = source.indexOf(
      file === "controller"
        ? "const productionDependencies ="
        : "function createProductionDependencies(",
    );
    const begin = source.indexOf("createOperation: async", anchor);
    const end = source.indexOf(
      file === "controller"
        ? "  classifyOperationCreationFailure:"
        : "    bindRepository:",
      begin,
    );
    assert.ok(anchor > 0 && begin > anchor && end > begin);
    const property = stripTypeScriptTypes(
      `const dependencies = {${source.slice(begin, end)}};`,
    );
    for (const mode of [
      "ready",
      "blocked",
      "cleanup_unknown",
      "revoked",
      "throwing_boundary",
    ]) {
      const calls: string[] = [];
      let live = true;
      let startupObserved = false;
      const startup = {
        status:
          mode === "blocked" || mode === "cleanup_unknown"
            ? "blocked"
            : "ready",
        reason: "original_start_failure",
        requestState: mode === "cleanup_unknown" ? "unknown" : "not_issued",
        engineReady: mode !== "blocked",
        cleanupConfirmed: mode !== "cleanup_unknown",
      };
      const create = runInNewContext(
        `${property};dependencies.createOperation`,
        {
          repositoryRoot: "synthetic-root",
          getRepository: () => ({ status: "completed" }),
          getIsolationSettings: () => ({}),
          startDockerEnvironment: async (request: {
            verifyBoundary: () => boolean;
          }) => {
            calls.push("start");
            assert.equal(request.verifyBoundary(), true);
            if (mode === "revoked") live = false;
            startupObserved = true;
            return startup;
          },
          createProductionOperation: () => {
            calls.push("host");
            return { host: true };
          },
          throwProductionOperationFailure: (failure: unknown) => {
            throw failure;
          },
          AdviceRuntimeError: class extends Error {
            readonly failure: unknown;
            constructor(reason: string, failure: unknown) {
              super(reason);
              this.failure = failure;
            }
          },
        },
      ) as (signal: AbortSignal, current: () => boolean) => Promise<unknown>;
      const pending = create(new AbortController().signal, () => {
        if (mode === "throwing_boundary" && startupObserved)
          throw Error("boundary");
        return live;
      });
      if (mode === "ready") {
        await pending;
        assert.deepEqual(calls, ["start", "host"]);
      } else {
        await assert.rejects(pending, (error: unknown) => {
          const data = error as {
            failure?: { hostRecoveryId: unknown; cleanupConfirmed: boolean };
            hostRecoveryId?: unknown;
            cleanupConfirmed?: boolean;
          };
          const failure = data.failure ?? data;
          assert.equal(failure.hostRecoveryId, null);
          assert.equal(failure.cleanupConfirmed, startup.cleanupConfirmed);
          return true;
        });
        assert.deepEqual(calls, ["start"]);
      }
    }
  }
});

import { createProviderAdviceAdapter } from "../../../src/execution/advice.ts";
import {
  prepareAdviceTask,
  prepareProviderAdvicePlan,
} from "../../../src/execution/preparation.ts";
import { executionSelection } from "../../fixtures/ai-selection.ts";

const selection = executionSelection("advice");
const task = prepareAdviceTask({
  executionSelection: selection,
  prompt: "固定投影だけを根拠に説明する",
  projection: [
    {
      reference: "PROJECT_CONTEXT.md",
      content: "# Project Context\n",
      sha256:
        "f2e9caaf190981cfb75bb7e6ff59e7609b79b8e79280a721701dc88cfcef607d",
    },
  ],
});
if (!task.taskPacket) throw new Error("test_task_required");
const dispatchInput = {
  additionalHosts: Object.freeze([]),
  taskPacket: task.taskPacket,
  executionSelection: selection,
};
const prepared = prepareProviderAdvicePlan(
  Object.freeze({
    additionalHosts: Object.freeze([]),
    provider: selection.provider,
    providerPrompt: task.taskPacket.providerPrompt,
    allowedReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
    taskHash: task.taskPacket.taskHash,
    projectionHash: task.taskPacket.projectionHash,
    executionSelection: selection,
    exactModelId: selection.modelIdentifier,
    reasoningEffort: selection.reasoningEffort,
    offering:
      selection.provider === "codex"
        ? ("chatgpt_subscription_oauth" as const)
        : ("claude_max" as const),
  }),
);
if (prepared.status !== "prepared" || prepared.executionPlan === null)
  throw new Error("test_execution_plan_required");
const executionPlan = prepared.executionPlan;
const ADVICE = JSON.stringify({
  status: "completed",
  facts: [{ text: "現在値", references: ["PROJECT_CONTEXT.md"] }],
  sharedAnalysis: [],
  additionalInferences: [],
  nextOptions: [],
});

/**
 * exact計画とPromptを一回だけRuntimeへ渡して抽出済み助言JSONを受け取るを検証する。
 *
 * @responsibility exact計画とPromptを一回だけRuntimeへ渡して抽出済み助言JSONを受け取るを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus exact計画とPromptを一回だけRuntimeへ渡して抽出済み助言JSONを受け取るの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("exact計画とPromptを一回だけRuntimeへ渡して抽出済み助言JSONを受け取る", async () => {
  let calls = 0;
  const executor = createProviderAdviceAdapter(async (plan) => {
    calls += 1;
    assert.deepEqual(plan, executionPlan);
    return Object.freeze({
      status: "completed" as const,
      reason: null,
      advice: Object.freeze({ ...JSON.parse(ADVICE), reason: null }),
      providerEffectIssued: true as const,
      cleanupConfirmed: true as const,
    });
  });
  const result = await executor(dispatchInput, new AbortController().signal);
  assert.equal(calls, 1);
  assert.deepEqual(result, {
    status: "completed",
    reason: null,
    advice: Object.freeze({ ...JSON.parse(ADVICE), reason: null }),
    providerEffectIssued: true,
    cleanupConfirmed: true,
  });
});

/**
 * 事前取消はRuntime Effect 0で拒否するを検証する。
 *
 * @responsibility 事前取消はRuntime Effect 0で拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 事前取消はRuntime Effect 0で拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("事前取消はRuntime Effect 0で拒否する", async () => {
  let calls = 0;
  const executor = createProviderAdviceAdapter(async () => {
    calls += 1;
    throw new Error("unreachable");
  });
  const controller = new AbortController();
  controller.abort();
  const result = await executor(dispatchInput, controller.signal);
  assert.equal(result.status, "blocked");
  assert.equal(result.providerEffectIssued, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(calls, 0);
});

/**
 * Runtime拒否とcleanup未確認をcompletedへ昇格しないを検証する。
 *
 * @responsibility Runtime拒否とcleanup未確認をcompletedへ昇格しないを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Runtime拒否とcleanup未確認をcompletedへ昇格しないの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Runtime拒否とcleanup未確認をcompletedへ昇格しない", async () => {
  const executor = createProviderAdviceAdapter(async () =>
    Object.freeze({
      status: "blocked" as const,
      reason: "runtime_cleanup_unknown",
      advice: null,
      providerEffectIssued: true,
      cleanupConfirmed: false,
    }),
  );
  const result = await executor(dispatchInput, new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "runtime_cleanup_unknown");
  assert.equal(result.providerEffectIssued, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.advice, null);
});

/**
 * Runtime例外はEffect発行可能性とcleanup不明を保持するを検証する。
 *
 * @responsibility Runtime例外はEffect発行可能性とcleanup不明を保持するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Runtime例外はEffect発行可能性とcleanup不明を保持するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Runtime例外はEffect発行可能性とcleanup不明を保持する", async () => {
  const executor = createProviderAdviceAdapter(async () => {
    throw new Error("provider failed");
  });
  const result = await executor(dispatchInput, new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "workbench_ai_advice_runtime_failed_closed");
  assert.equal(result.providerEffectIssued, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.advice, null);
});
