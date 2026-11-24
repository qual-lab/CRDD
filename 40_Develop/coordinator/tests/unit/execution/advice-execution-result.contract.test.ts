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
import test from "node:test";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../../docker-isolation/tests/support/source-declaration.ts";
import { finishProviderExecutionRecordings } from "../../../src/lifecycle/environment.ts";
import { executionSelection } from "../../fixtures/ai-selection.ts";
import {
  executionHostCreationFixture,
  loadAdviceDispatchFixture,
} from "../../support/task-requests.ts";

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
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const declarations = [
    "AdviceRuntimeError",
    "executeProviderAdvice",
    "blockAdviceRuntime",
    "classifyProviderAdviceHostFailure",
  ]
    .map((name) => sourceDeclaration(source, name))
    .join("\n");
  const runtime = runInNewContext(
    `${declarations};
    async function openAdviceOperation(_context, _signal, verify) {
      if (!verify()) throw Error("boundary");
      throw new AdviceRuntimeError("docker_environment_start_timeout", {
        cleanupConfirmed: true,
        manualRecoveryRequired: true,
        hostRecoveryId: null,
      });
    }
    ({
    run:(plan,signal)=>executeProviderAdvice({},plan,signal),classify:classifyProviderAdviceHostFailure
  })`,
    {
      initializationFailures: new WeakMap(),
      hostFailures: new WeakMap(),
      isExecutionProcessPoisoned: () => false,
      finishProviderExecutionRecordings,
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
  const result = await runtime.run(
    { executionSelection: executionSelection("advice") },
    new AbortController().signal,
  );
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
  for (const file of ["task", "advice"] as const) {
    for (const mode of [
      "ready",
      "blocked",
      "cleanup_unknown",
      "issued",
      "revoked",
      "throwing_boundary",
      "cancelled",
      "same_turn",
      "creation_confirmed",
      "creation_unknown",
      "creation_unclassified",
      ...(file === "advice" ? ["repository_unavailable"] : []),
    ]) {
      const calls: string[] = [];
      let live = true;
      let startupObserved = false;
      const cancellation = new AbortController();
      const repository = {} as never;
      const recordingCurrent = () => true;
      const current = () => {
        if (mode === "throwing_boundary" && startupObserved)
          throw Error("boundary");
        if (mode === "same_turn" && startupObserved)
          queueMicrotask(() => calls.push("later"));
        return live;
      };
      const startup = {
        status:
          mode === "blocked" || mode === "cleanup_unknown" || mode === "issued"
            ? "blocked"
            : "ready",
        reason: "original_start_failure",
        requestState:
          mode === "cleanup_unknown"
            ? "unknown"
            : mode === "issued"
              ? "issued"
              : "not_issued",
        engineReady: mode !== "blocked",
        cleanupConfirmed: mode !== "cleanup_unknown",
      };
      const creationError = Error("fixture_creation");
      const create = executionHostCreationFixture(file, {
        repositoryRoot: "synthetic-root",
        repository,
        recordingCurrent,
        getRepository: () => ({
          status:
            mode === "repository_unavailable" && startupObserved
              ? "unavailable"
              : "completed",
        }),
        getIsolationSettings: () => ({}),
        startDockerEnvironment: async (request: {
          verifyBoundary: () => boolean;
        }) => {
          calls.push("start");
          assert.equal(request.verifyBoundary(), true);
          if (mode === "revoked") live = false;
          if (mode === "cancelled") cancellation.abort();
          startupObserved = true;
          return startup;
        },
        poisonExecutionProcessAfterCleanupUnknown: () => {
          calls.push("poison");
        },
        classifyOwnedCoordinatorOperationCreationFailure: (error: unknown) => {
          assert.equal(error, creationError);
          if (mode === "creation_unclassified") return null;
          return {
            hostRecoveryId:
              mode === "creation_unknown" ? "host.fixture.exact" : null,
            cleanupConfirmed: mode === "creation_confirmed",
            manualRecoveryRequired: mode === "creation_unknown",
          };
        },
        createCoordinatorOperation: (host: {
          purpose: string;
          root: unknown;
          recordingCurrent: unknown;
          signal: AbortSignal;
          executionCurrent: unknown;
        }) => {
          assert.equal(host.purpose, file === "task" ? "task" : "advice");
          assert.strictEqual(host.root, repository);
          assert.strictEqual(host.recordingCurrent, recordingCurrent);
          assert.equal(host.signal, cancellation.signal);
          assert.strictEqual(host.executionCurrent, current);
          calls.push("host");
          if (mode.startsWith("creation_")) {
            queueMicrotask(() => calls.push("later"));
            throw creationError;
          }
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
      });
      const pending = Promise.resolve(
        create(cancellation.signal, current, {
          root: repository,
          recordingCurrent,
        }),
      );
      if (mode === "ready" || mode === "same_turn") {
        await pending;
        assert.deepEqual(
          calls,
          mode === "same_turn" ? ["start", "host", "later"] : ["start", "host"],
        );
      } else if (mode.startsWith("creation_")) {
        await assert.rejects(pending, (error: unknown) => {
          if (file === "task" && mode === "creation_unclassified") {
            assert.equal(error, creationError);
            return true;
          }
          const outcome = error as {
            message?: string;
            reason?: string;
            failure?: {
              hostRecoveryId: string | null;
              cleanupConfirmed: boolean;
              manualRecoveryRequired: boolean;
            } | null;
            hostRecoveryId?: string | null;
            cleanupConfirmed?: boolean;
            manualRecoveryRequired?: boolean;
          };
          const reasonPrefix =
            file === "task" ? "coordinator_task" : "workbench_ai_advice";
          assert.equal(
            outcome.reason ?? outcome.message,
            mode === "creation_confirmed"
              ? `${reasonPrefix}_operation_initialization_failed_cleanup_confirmed`
              : `${reasonPrefix}_operation_initialization_cleanup_unknown_process_restart_required`,
          );
          const details = file === "task" ? outcome : outcome.failure;
          if (mode === "creation_unclassified") assert.equal(details, null);
          else {
            assert.equal(
              details?.hostRecoveryId,
              mode === "creation_unknown" ? "host.fixture.exact" : null,
            );
            assert.equal(
              details?.cleanupConfirmed,
              mode === "creation_confirmed",
            );
            assert.equal(
              details?.manualRecoveryRequired,
              mode === "creation_unknown",
            );
          }
          return true;
        });
        assert.deepEqual(
          calls,
          mode === "creation_unknown" ||
            (file === "advice" && mode === "creation_unclassified")
            ? ["start", "host", "poison", "later"]
            : ["start", "host", "later"],
        );
      } else {
        await assert.rejects(pending, (error: unknown) => {
          const data = error as {
            failure?: {
              reason?: string;
              hostRecoveryId: unknown;
              cleanupConfirmed: boolean;
              manualRecoveryRequired?: boolean;
            };
            reason?: string;
            hostRecoveryId?: unknown;
            cleanupConfirmed?: boolean;
            manualRecoveryRequired?: boolean;
          };
          const failure = data.failure ?? data;
          assert.equal(failure.hostRecoveryId, null);
          assert.equal(failure.cleanupConfirmed, startup.cleanupConfirmed);
          assert.equal(
            failure.reason,
            startup.status === "ready"
              ? "docker_environment_start_boundary_unconfirmed"
              : "original_start_failure",
          );
          assert.equal(
            failure.manualRecoveryRequired,
            mode === "cleanup_unknown" || mode === "issued",
          );
          return true;
        });
        assert.deepEqual(calls, ["start"]);
      }
    }
  }
});

const { executeAcceptedAdviceInput } = await loadAdviceDispatchFixture();
import {
  prepareAdviceTask,
  prepareProviderAdviceInput,
} from "../../../src/lifecycle/selection.ts";
const selection = executionSelection("advice");
const task = prepareAdviceTask({
  executionSelection: selection,
  prompt: "固定投影だけを根拠に説明する",
  projection: [
    {
      reference: "PROJECT_CONTEXT.md",
      content: "# Project Context\n",
    },
  ],
});
if (!task.taskPacket) throw new Error("test_task_required");
const dispatchInput = {
  additionalHosts: Object.freeze([]),
  taskPacket: task.taskPacket,
  executionSelection: selection,
};
const executionPlan = prepareProviderAdviceInput(
  Object.freeze({
    additionalHosts: Object.freeze([]),
    providerPrompt: task.taskPacket.providerPrompt,
    allowedReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
    taskHash: task.taskPacket.taskHash,
    projectionHash: task.taskPacket.projectionHash,
    executionSelection: selection,
  }),
);
if (!executionPlan) throw new Error("test_execution_plan_required");
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
  const executorDependencies: [
    Parameters<typeof executeAcceptedAdviceInput>[0],
  ] = [
    async (plan) => {
      calls += 1;
      assert.deepEqual(plan, executionPlan);
      assert.ok(Object.isFrozen(plan));
      assert.ok(Object.isFrozen(plan.executionSelection));
      assert.ok(Object.isFrozen(plan.additionalHosts));
      return Object.freeze({
        status: "completed" as const,
        reason: null,
        advice: Object.freeze({ ...JSON.parse(ADVICE), reason: null }),
        providerEffectIssued: true as const,
        cleanupConfirmed: true as const,
      });
    },
  ];
  const result = await executeAcceptedAdviceInput(
    ...executorDependencies,
    dispatchInput,
    new AbortController().signal,
  );
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
  const executorDependencies: [
    Parameters<typeof executeAcceptedAdviceInput>[0],
  ] = [
    async () => {
      calls += 1;
      throw new Error("unreachable");
    },
  ];
  const controller = new AbortController();
  controller.abort();
  const result = await executeAcceptedAdviceInput(
    ...executorDependencies,
    dispatchInput,
    controller.signal,
  );
  assert.ok(result);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "workbench_ai_advice_cancelled_before_provider_effect",
  );
  assert.equal(result.providerEffectIssued, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(calls, 0);
  const invalid = await executeAcceptedAdviceInput(
    ...executorDependencies,
    { ...dispatchInput, additionalHosts: ["x".repeat(254)] },
    controller.signal,
  );
  assert.equal(invalid?.reason, "workbench_ai_advice_execution_plan_invalid");
  assert.equal(invalid?.providerEffectIssued, false);
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
  const executorDependencies: [
    Parameters<typeof executeAcceptedAdviceInput>[0],
  ] = [
    async () =>
      Object.freeze({
        status: "blocked" as const,
        reason: "runtime_cleanup_unknown",
        advice: null,
        providerEffectIssued: true,
        cleanupConfirmed: false,
      }),
  ];
  const result = await executeAcceptedAdviceInput(
    ...executorDependencies,
    dispatchInput,
    new AbortController().signal,
  );
  assert.ok(result);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "runtime_cleanup_unknown");
  assert.equal(result.providerEffectIssued, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.advice, null);
});

/**
 * Runtime例外で観測していない終了応答を補完しない。
 *
 * @responsibility 元応答の欠測を公開側のEffect・回収不明へ搬送する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 固定計画の実行で例外を発生させる。
 * @observation 実行境界からの終了応答。
 * @oracle Effect・回収・回復参照を観測したかのような結果を構築しない。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Runtime例外で観測していない終了応答を補完しない", async () => {
  const executorDependencies: [
    Parameters<typeof executeAcceptedAdviceInput>[0],
  ] = [
    async () => {
      throw new Error("provider failed");
    },
  ];
  const result = await executeAcceptedAdviceInput(
    ...executorDependencies,
    dispatchInput,
    new AbortController().signal,
  );
  assert.equal(result, null);
});
