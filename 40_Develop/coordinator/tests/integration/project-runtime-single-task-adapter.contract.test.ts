/**
 * coordinator:integration:project-runtime-single-task-adapterの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:project-runtime-single-task-adapterが所有する検証責務を実行する。
 * @trace PRL-IT-005
 * @level IT
 * @scope project、runtime、single、task、adapter
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { startRuntimeOwnedCoordinatorTask } from "../../src/security/coordinator-task-runtime.ts";
import {
  describeProjectRuntimeSingleTaskAdapterContract,
  PROJECT_RUNTIME_SINGLE_TASK_PRE_EFFECT_REJECTIONS,
  type ProjectRuntimeSingleTaskDependencies,
  runProjectRuntimeSingleTaskAttempt,
} from "../../src/security/project-runtime-single-task-adapter.ts";

const CONTRACT = "crdd-coordinator/project-runtime-single-task-adapter";
const ATTEMPT_ID = "attempt-0001";
const OPERATION_ID = "operation-0001";
const AUTHORITY_BINDING_ID = "authority-0001";
const repositoryRevisionValue = "a".repeat(40);
const dockerRecoveryId = `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`;

/**
 * completionRecordのTest準備責務を実行する。
 *
 * @responsibility completionRecordがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus completionRecordを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
function completionRecord(
  overrides: Readonly<Record<string, unknown>> = Object.freeze({}),
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    status: "completed",
    reason: "coordinator_task_completed",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
    candidateId: `candidate.${"6".repeat(64)}.${"7".repeat(64)}`,
    hostRecoveryId: null,
    dockerRecoveryId: null,
    dockerRecoveryIds: Object.freeze([]),
    candidateRecoveryId: null,
    candidateStoreRecoveryId: null,
    ...overrides,
  });
}

/**
 * harnessのTest準備責務を実行する。
 *
 * @responsibility harnessがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus harnessを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
function harness(
  overrides: Readonly<{
    startTask?: ProjectRuntimeSingleTaskDependencies["startTask"];
    cancelTask?: ProjectRuntimeSingleTaskDependencies["cancelTask"];
    completion?: Promise<unknown>;
  }> = Object.freeze({}),
) {
  const startCalls: unknown[][] = [];
  const cancelCalls: unknown[] = [];
  const controlCapability = Object.freeze({});
  const dependencies: ProjectRuntimeSingleTaskDependencies = Object.freeze({
    startTask:
      overrides.startTask ??
      ((...startArguments: unknown[]) => {
        startCalls.push(startArguments);
        return Object.freeze({
          status: "started",
          reason: "coordinator_task_started",
          controlCapability,
          completion:
            overrides.completion ?? Promise.resolve(completionRecord()),
        });
      }),
    cancelTask:
      overrides.cancelTask ??
      ((capability: object) => {
        cancelCalls.push(capability);
        return Promise.resolve(Object.freeze({ status: "cancelled" }));
      }),
  });
  return Object.freeze({
    dependencies,
    startCalls,
    cancelCalls,
    controlCapability,
  });
}

/**
 * validInputのTest準備責務を実行する。
 *
 * @responsibility validInputがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus validInputを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
function validInput(
  overrides: Readonly<Record<string, unknown>> = Object.freeze({}),
) {
  return Object.freeze({
    attemptId: ATTEMPT_ID,
    operationId: OPERATION_ID,
    authorityBindingId: AUTHORITY_BINDING_ID,
    repositoryRevision: repositoryRevisionValue,
    runtimeExecutionCapability: Object.freeze({}),
    taskRequest: Object.freeze({ objective: "bounded" }),
    repositoryRoot: "C:\\repository",
    cancellationSignal: new AbortController().signal,
    ...overrides,
  }) as Parameters<typeof runProjectRuntimeSingleTaskAttempt>[1];
}

/**
 * 正常完了はattemptと固定Revisionへ結合した閉結果で返るを検証する。
 *
 * @responsibility 正常完了はattemptと固定Revisionへ結合した閉結果で返るの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 正常完了はattemptと固定Revisionへ結合した閉結果で返るの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("正常完了はattemptと固定Revisionへ結合した閉結果で返る", async () => {
  const { dependencies, startCalls } = harness();
  const attempt = await runProjectRuntimeSingleTaskAttempt(
    dependencies,
    validInput(),
  );
  assert.deepEqual(attempt, {
    contract: CONTRACT,
    attemptId: ATTEMPT_ID,
    operationId: OPERATION_ID,
    authorityBindingId: AUTHORITY_BINDING_ID,
    repositoryRevision: repositoryRevisionValue,
    status: "completed",
    reason: "coordinator_task_completed",
    effectState: "settled",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
    candidateId: `candidate.${"6".repeat(64)}.${"7".repeat(64)}`,
    recoveryIds: [],
    recoveryObligations: [],
  });
  assert.equal(startCalls.length, 1);
  const startArguments = startCalls[0];
  assert.ok(startArguments);
  assert.deepEqual(startArguments[0], { objective: "bounded" });
  assert.equal(startArguments[1], "C:\\repository");
});

/**
 * 実行元が返した実効Executor Providerだけを閉結果へ保持するを検証する。
 *
 * @responsibility 実行元が返した実効Executor Providerだけを閉結果へ保持するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行元が返した実効Executor Providerだけを閉結果へ保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("実行元が返した実効Executor Providerだけを閉結果へ保持する", async () => {
  const { dependencies } = harness({
    completion: Promise.resolve(
      completionRecord({ executorProvider: "claude" }),
    ),
  });
  const attempt = await runProjectRuntimeSingleTaskAttempt(
    dependencies,
    validInput(),
  );
  assert.equal(attempt.status, "completed");
  assert.equal(attempt.executorProvider, "claude");
});

/**
 * 入力不正はTask Effect 0の入力拒否として閉じるを検証する。
 *
 * @responsibility 入力不正はTask Effect 0の入力拒否として閉じるの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 入力不正はTask Effect 0の入力拒否として閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("入力不正はTask Effect 0の入力拒否として閉じる", async () => {
  const { dependencies, startCalls } = harness();
  const invalidInputs = [
    validInput({ attemptId: "" }),
    validInput({ attemptId: ".leading-dot" }),
    validInput({ operationId: ".leading-dot" }),
    validInput({ authorityBindingId: ".leading-dot" }),
    validInput({ repositoryRevision: "not-hex" }),
    validInput({ runtimeExecutionCapability: null }),
    validInput({ cancellationSignal: {} }),
  ];
  for (const input of invalidInputs) {
    const attempt = await runProjectRuntimeSingleTaskAttempt(
      dependencies,
      input,
    );
    assert.deepEqual(attempt, {
      contract: CONTRACT,
      attemptId: null,
      operationId: null,
      authorityBindingId: null,
      repositoryRevision: null,
      status: "blocked",
      reason: "single_task_input_invalid",
      effectState: "no_effect",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      candidateId: null,
      recoveryIds: [],
      recoveryObligations: [],
    });
  }
  assert.equal(startCalls.length, 0);
});

/**
 * 開始前の取消はTask Effect 0のcancelledとして閉じるを検証する。
 *
 * @responsibility 開始前の取消はTask Effect 0のcancelledとして閉じるの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 開始前の取消はTask Effect 0のcancelledとして閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("開始前の取消はTask Effect 0のcancelledとして閉じる", async () => {
  const { dependencies, startCalls } = harness();
  const controller = new AbortController();
  controller.abort();
  const attempt = await runProjectRuntimeSingleTaskAttempt(
    dependencies,
    validInput({ cancellationSignal: controller.signal }),
  );
  assert.equal(attempt.status, "cancelled");
  assert.equal(attempt.reason, "single_task_cancelled_before_effect");
  assert.equal(attempt.effectState, "no_effect");
  assert.equal(startCalls.length, 0);
});

/**
 * 既知のEffect前拒否はEffect 0のblockedへ写像するを検証する。
 *
 * @responsibility 既知のEffect前拒否はEffect 0のblockedへ写像するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 既知のEffect前拒否はEffect 0のblockedへ写像するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("既知のEffect前拒否はEffect 0のblockedへ写像する", async () => {
  for (const [message, processRestartRequired] of [
    ["coordinator_task_process_restart_required", true],
    ["coordinator_task_runtime_cleanup_in_progress", false],
    ["coordinator_task_release_verification_required", false],
  ] as const) {
    const { dependencies } = harness({
      startTask: () => {
        throw new Error(message);
      },
    });
    const attempt = await runProjectRuntimeSingleTaskAttempt(
      dependencies,
      validInput(),
    );
    assert.deepEqual(attempt, {
      contract: CONTRACT,
      attemptId: ATTEMPT_ID,
      operationId: OPERATION_ID,
      authorityBindingId: AUTHORITY_BINDING_ID,
      repositoryRevision: repositoryRevisionValue,
      status: "blocked",
      reason: message,
      effectState: "no_effect",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired,
      candidateId: null,
      recoveryIds: [],
      recoveryObligations: [],
    });
  }
});

/**
 * 未知の開始例外はEffect不明としてfail closedするを検証する。
 *
 * @responsibility 未知の開始例外はEffect不明としてfail closedするの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 未知の開始例外はEffect不明としてfail closedするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("未知の開始例外はEffect不明としてfail closedする", async () => {
  const { dependencies } = harness({
    startTask: () => {
      throw new Error("unexpected_infrastructure_error");
    },
  });
  const attempt = await runProjectRuntimeSingleTaskAttempt(
    dependencies,
    validInput(),
  );
  assert.equal(attempt.status, "blocked");
  assert.equal(attempt.reason, "single_task_start_observation_invalid");
  assert.equal(attempt.effectState, "unknown");
  assert.equal(attempt.cleanupConfirmed, false);
  assert.equal(attempt.manualRecoveryRequired, true);
});

/**
 * 開始結果の形不一致はEffect不明としてfail closedするを検証する。
 *
 * @responsibility 開始結果の形不一致はEffect不明としてfail closedするの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 開始結果の形不一致はEffect不明としてfail closedするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("開始結果の形不一致はEffect不明としてfail closedする", async () => {
  for (const started of [
    null,
    Object.freeze({ status: "started" }),
    Object.freeze({
      status: "started",
      controlCapability: Object.freeze({}),
      completion: "not-a-promise",
    }),
  ]) {
    const { dependencies } = harness({ startTask: () => started });
    const attempt = await runProjectRuntimeSingleTaskAttempt(
      dependencies,
      validInput(),
    );
    assert.equal(attempt.status, "blocked");
    assert.equal(attempt.reason, "single_task_start_observation_invalid");
    assert.equal(attempt.effectState, "unknown");
    assert.equal(attempt.manualRecoveryRequired, true);
  }
});

/**
 * 完了結果の観測不能・形不一致は成功へ補正せずfail closedするを検証する。
 *
 * @responsibility 完了結果の観測不能・形不一致は成功へ補正せずfail closedするの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 完了結果の観測不能・形不一致は成功へ補正せずfail closedするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("完了結果の観測不能・形不一致は成功へ補正せずfail closedする", async () => {
  const getterSwappedReason = Object.defineProperty(
    { ...completionRecord() },
    "reason",
    {
      enumerable: true,
      get: () => "coordinator_task_completed",
    },
  );
  const prototypeCarried = Object.assign(
    Object.create({ status: "completed" }),
    completionRecord({ status: undefined }),
  );
  const accessorRecoveryId = completionRecord({
    dockerRecoveryIds: Object.defineProperty(["recovery-a"], "0", {
      enumerable: true,
      get: () => "recovery-b",
    }),
  });
  const malformedCompletions: readonly Promise<unknown>[] = [
    Promise.reject(new Error("completion_lost")),
    Promise.resolve(null),
    Promise.resolve(completionRecord({ status: "unknown_status" })),
    // The v0.18 producer never emits status "cancelled" in a completion
    // record; accepting it would widen the observation surface.
    Promise.resolve(
      completionRecord({
        status: "cancelled",
        reason: "coordinator_task_cancelled_before_stage_start",
      }),
    ),
    Promise.resolve(
      completionRecord({ status: "completed", cleanupConfirmed: false }),
    ),
    Promise.resolve(completionRecord({ dockerRecoveryIds: "not-an-array" })),
    Promise.resolve(completionRecord({ executorProvider: "unknown" })),
    // Accessor properties may return a validated value first and a different
    // value later; observation must reject them outright.
    Promise.resolve(getterSwappedReason),
    Promise.resolve(prototypeCarried),
    Promise.resolve(accessorRecoveryId),
  ];
  for (const completion of malformedCompletions) {
    const { dependencies } = harness({ completion });
    const attempt = await runProjectRuntimeSingleTaskAttempt(
      dependencies,
      validInput(),
    );
    assert.equal(attempt.status, "blocked");
    assert.equal(attempt.reason, "single_task_completion_observation_invalid");
    assert.equal(attempt.effectState, "unknown");
    assert.equal(attempt.cleanupConfirmed, false);
    assert.equal(attempt.manualRecoveryRequired, true);
  }
});

/**
 * Recovery Identityは種類横断で重複なく保持されるを検証する。
 *
 * @responsibility Recovery Identityは種類横断で重複なく保持されるの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recovery Identityは種類横断で重複なく保持されるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("Recovery Identityは種類横断で重複なく保持される", async () => {
  const { dependencies } = harness({
    completion: Promise.resolve(
      completionRecord({
        status: "blocked",
        reason: "coordinator_task_cleanup_unknown",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        candidateId: null,
        hostRecoveryId: "recovery-host",
        dockerRecoveryIds: Object.freeze(["recovery-docker", "recovery-host"]),
        candidateRecoveryId: "recovery-candidate",
        candidateStoreRecoveryId: "recovery-store",
      }),
    ),
  });
  const attempt = await runProjectRuntimeSingleTaskAttempt(
    dependencies,
    validInput(),
  );
  assert.equal(attempt.status, "blocked");
  assert.equal(attempt.effectState, "unknown");
  assert.equal(attempt.cleanupConfirmed, false);
  assert.equal(attempt.manualRecoveryRequired, true);
  assert.deepEqual(attempt.recoveryIds, [
    "recovery-host",
    "recovery-docker",
    "recovery-candidate",
    "recovery-store",
  ]);
});

/**
 * Project Stateへ保存できないRecovery Identityは閉結果へ取り込まないを検証する。
 *
 * @responsibility Project Stateへ保存できないRecovery Identityは閉結果へ取り込まないの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Project Stateへ保存できないRecovery Identityは閉結果へ取り込まないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("Project Stateへ保存できないRecovery Identityは閉結果へ取り込まない", async () => {
  for (const recoveryId of ["recovery/a", "recovery id", "recovery\u0001id"]) {
    const { dependencies } = harness({
      completion: Promise.resolve(
        completionRecord({
          status: "blocked",
          reason: "coordinator_task_cleanup_unknown",
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          hostRecoveryId: recoveryId,
        }),
      ),
    });
    const attempt = await runProjectRuntimeSingleTaskAttempt(
      dependencies,
      validInput(),
    );
    assert.equal(attempt.status, "blocked");
    assert.equal(attempt.reason, "single_task_completion_observation_invalid");
    assert.equal(attempt.effectState, "unknown");
    assert.deepEqual(attempt.recoveryIds, []);
  }
});

/**
 * cleanup未確認またはRecovery義務をsettledへ補正しないを検証する。
 *
 * @responsibility cleanup未確認またはRecovery義務をsettledへ補正しないの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus cleanup未確認またはRecovery義務をsettledへ補正しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("cleanup未確認またはRecovery義務をsettledへ補正しない", async () => {
  for (const completion of [
    completionRecord({
      status: "blocked",
      reason: "coordinator_task_cleanup_unknown",
      cleanupConfirmed: false,
      manualRecoveryRequired: false,
      candidateId: null,
    }),
    completionRecord({
      status: "blocked",
      reason: "coordinator_task_manual_recovery_required",
      cleanupConfirmed: true,
      manualRecoveryRequired: true,
      candidateId: null,
      hostRecoveryId: "recovery-host",
    }),
  ]) {
    const { dependencies } = harness({
      completion: Promise.resolve(completion),
    });
    const attempt = await runProjectRuntimeSingleTaskAttempt(
      dependencies,
      validInput(),
    );
    assert.equal(attempt.status, "blocked");
    assert.equal(attempt.effectState, "unknown");
  }
});

/**
 * 成功表示とRecovery義務が競合する完了Recordをblockedへ単調化するを検証する。
 *
 * @responsibility 成功表示とRecovery義務が競合する完了Recordをblockedへ単調化するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 成功表示とRecovery義務が競合する完了Recordをblockedへ単調化するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("成功表示とRecovery義務が競合する完了Recordをblockedへ単調化する", async () => {
  for (const [completion, expectedReason, expectedRecoveryIds] of [
    [
      completionRecord({
        manualRecoveryRequired: true,
        hostRecoveryId: "recovery-host",
      }),
      "single_task_completion_cleanup_unknown",
      ["recovery-host"],
    ],
    [
      completionRecord({ hostRecoveryId: "recovery-host" }),
      "single_task_completion_cleanup_unknown",
      ["recovery-host"],
    ],
    [
      completionRecord({ cleanupConfirmed: false }),
      "single_task_completion_observation_invalid",
      [],
    ],
  ] as const) {
    const { dependencies } = harness({
      completion: Promise.resolve(completion),
    });
    const attempt = await runProjectRuntimeSingleTaskAttempt(
      dependencies,
      validInput(),
    );
    assert.equal(attempt.status, "blocked");
    assert.equal(attempt.reason, expectedReason);
    assert.equal(attempt.effectState, "unknown");
    assert.equal(attempt.manualRecoveryRequired, true);
    assert.deepEqual(attempt.recoveryIds, expectedRecoveryIds);
  }
});

/**
 * 実行中の取消はexactなcontrolへ一度だけ転送し完了観測を保持するを検証する。
 *
 * @responsibility 実行中の取消はexactなcontrolへ一度だけ転送し完了観測を保持するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行中の取消はexactなcontrolへ一度だけ転送し完了観測を保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("実行中の取消はexactなcontrolへ一度だけ転送し完了観測を保持する", async () => {
  const controller = new AbortController();
  let settleCompletion: ((value: unknown) => void) | null = null;
  const completion = new Promise((resolve) => {
    settleCompletion = resolve;
  });
  const { dependencies, cancelCalls, controlCapability } = harness({
    completion,
  });
  const pendingAttempt = runProjectRuntimeSingleTaskAttempt(
    dependencies,
    validInput({ cancellationSignal: controller.signal }),
  );
  controller.abort();
  controller.abort();
  assert.ok(settleCompletion);
  (settleCompletion as (value: unknown) => void)(
    completionRecord({
      status: "blocked",
      reason: "coordinator_task_cancelled_before_stage_start",
    }),
  );
  const attempt = await pendingAttempt;
  assert.equal(attempt.status, "cancelled");
  assert.equal(attempt.reason, "single_task_cancelled_after_effect_cleanup");
  assert.equal(attempt.effectState, "settled");
  assert.deepEqual(cancelCalls, [controlCapability]);
});

/**
 * 取消入口の例外は完了観測を切り離さないを検証する。
 *
 * @responsibility 取消入口の例外は完了観測を切り離さないの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 取消入口の例外は完了観測を切り離さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("取消入口の例外は完了観測を切り離さない", async () => {
  const controller = new AbortController();
  let settleCompletion: ((value: unknown) => void) | null = null;
  const completion = new Promise((resolve) => {
    settleCompletion = resolve;
  });
  const { dependencies } = harness({
    completion,
    cancelTask: () => {
      throw new Error("cancel_entry_failed");
    },
  });
  const pendingAttempt = runProjectRuntimeSingleTaskAttempt(
    dependencies,
    validInput({ cancellationSignal: controller.signal }),
  );
  controller.abort();
  assert.ok(settleCompletion);
  (settleCompletion as (value: unknown) => void)(
    completionRecord({
      status: "blocked",
      reason: "coordinator_task_cancelled_before_stage_start",
    }),
  );
  const attempt = await pendingAttempt;
  assert.equal(attempt.status, "cancelled");
  assert.equal(attempt.reason, "single_task_cancelled_after_effect_cleanup");
  assert.equal(attempt.effectState, "settled");
});

/**
 * 取消入口の非同期失敗は未処理rejectionにせず完了観測を保持するを検証する。
 *
 * @responsibility 取消入口の非同期失敗は未処理rejectionにせず完了観測を保持するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 取消入口の非同期失敗は未処理rejectionにせず完了観測を保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("取消入口の非同期失敗は未処理rejectionにせず完了観測を保持する", async () => {
  const controller = new AbortController();
  let settleCompletion: ((value: unknown) => void) | null = null;
  const completion = new Promise((resolve) => {
    settleCompletion = resolve;
  });
  const unhandledRejections: unknown[] = [];
  /**
   * captureRejectionのTest準備責務を実行する。
   *
   * @responsibility captureRejectionがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace PRL-IT-005
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus captureRejectionを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
   */
  const captureRejection = (reason: unknown) => {
    unhandledRejections.push(reason);
  };
  process.on("unhandledRejection", captureRejection);
  try {
    const { dependencies } = harness({
      completion,
      cancelTask: () => Promise.reject(new Error("cancel_settlement_lost")),
    });
    const pendingAttempt = runProjectRuntimeSingleTaskAttempt(
      dependencies,
      validInput({ cancellationSignal: controller.signal }),
    );
    controller.abort();
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(settleCompletion);
    (settleCompletion as (value: unknown) => void)(
      completionRecord({
        status: "blocked",
        reason: "coordinator_task_cancelled_before_stage_start",
      }),
    );
    const attempt = await pendingAttempt;
    assert.equal(attempt.status, "cancelled");
    assert.equal(attempt.reason, "single_task_cancelled_after_effect_cleanup");
    assert.equal(attempt.effectState, "settled");
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandledRejections, []);
  } finally {
    process.removeListener("unhandledRejection", captureRejection);
  }
});

/**
 * startTask実行中の同期abortも一度だけ転送されるを検証する。
 *
 * @responsibility startTask実行中の同期abortも一度だけ転送されるの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus startTask実行中の同期abortも一度だけ転送されるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("startTask実行中の同期abortも一度だけ転送される", async () => {
  const controller = new AbortController();
  const cancelCalls: unknown[] = [];
  const controlCapability = Object.freeze({});
  const dependencies: ProjectRuntimeSingleTaskDependencies = Object.freeze({
    startTask: () => {
      controller.abort();
      return Object.freeze({
        status: "started",
        reason: "coordinator_task_started",
        controlCapability,
        completion: Promise.resolve(
          completionRecord({
            status: "blocked",
            reason: "coordinator_task_cancelled_before_stage_start",
          }),
        ),
      });
    },
    cancelTask: (capability: object) => {
      cancelCalls.push(capability);
      return Promise.resolve(Object.freeze({ status: "cancelled" }));
    },
  });
  const attempt = await runProjectRuntimeSingleTaskAttempt(
    dependencies,
    validInput({ cancellationSignal: controller.signal }),
  );
  assert.equal(attempt.status, "cancelled");
  assert.equal(attempt.reason, "single_task_cancelled_after_effect_cleanup");
  assert.equal(attempt.effectState, "settled");
  assert.deepEqual(cancelCalls, [controlCapability]);
});

/**
 * 取消と同時に観測した通常失敗はcancelledへ丸めないを検証する。
 *
 * @responsibility 取消と同時に観測した通常失敗はcancelledへ丸めないの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 取消と同時に観測した通常失敗はcancelledへ丸めないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("取消と同時に観測した通常失敗はcancelledへ丸めない", async () => {
  const controller = new AbortController();
  let settleCompletion: ((value: unknown) => void) | null = null;
  const completion = new Promise((resolve) => {
    settleCompletion = resolve;
  });
  const { dependencies } = harness({ completion });
  const pendingAttempt = runProjectRuntimeSingleTaskAttempt(
    dependencies,
    validInput({ cancellationSignal: controller.signal }),
  );
  controller.abort();
  assert.ok(settleCompletion);
  (settleCompletion as (value: unknown) => void)(
    completionRecord({
      status: "blocked",
      reason: "provider_process_exit_nonzero",
    }),
  );
  const attempt = await pendingAttempt;
  assert.equal(attempt.status, "blocked");
  assert.equal(attempt.reason, "provider_process_exit_nonzero");
});

/**
 * 回復義務を伴う取消結果はcancelledへ丸めないを検証する。
 *
 * @responsibility 回復義務を伴う取消結果はcancelledへ丸めないの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 回復義務を伴う取消結果はcancelledへ丸めないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("回復義務を伴う取消結果はcancelledへ丸めない", async () => {
  const controller = new AbortController();
  let settleCompletion: ((value: unknown) => void) | null = null;
  const completion = new Promise((resolve) => {
    settleCompletion = resolve;
  });
  const { dependencies } = harness({ completion });
  const pendingAttempt = runProjectRuntimeSingleTaskAttempt(
    dependencies,
    validInput({ cancellationSignal: controller.signal }),
  );
  controller.abort();
  assert.ok(settleCompletion);
  (settleCompletion as (value: unknown) => void)(
    completionRecord({
      status: "blocked",
      reason: "coordinator_task_cancelled_after_provider_cleanup",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      dockerRecoveryIds: [dockerRecoveryId],
    }),
  );
  const attempt = await pendingAttempt;
  assert.equal(attempt.status, "blocked");
  assert.equal(attempt.manualRecoveryRequired, true);
  assert.deepEqual(attempt.recoveryIds, [dockerRecoveryId]);
});

/**
 * 開始観測はaccessorやProxyの開始Recordをfail closedで拒否するを検証する。
 *
 * @responsibility 開始観測はaccessorやProxyの開始Recordをfail closedで拒否するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 開始観測はaccessorやProxyの開始Recordをfail closedで拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("開始観測はaccessorやProxyの開始Recordをfail closedで拒否する", async () => {
  const accessorControl = Object.defineProperty(
    {
      status: "started",
      completion: Promise.resolve(completionRecord()),
    },
    "controlCapability",
    { enumerable: true, get: () => Object.freeze({}) },
  );
  const proxied = new Proxy(
    {
      status: "started",
      controlCapability: Object.freeze({}),
      completion: Promise.resolve(completionRecord()),
    },
    {},
  );
  for (const started of [accessorControl, proxied]) {
    const { dependencies } = harness({ startTask: () => started });
    const attempt = await runProjectRuntimeSingleTaskAttempt(
      dependencies,
      validInput(),
    );
    assert.equal(attempt.status, "blocked");
    assert.equal(attempt.reason, "single_task_start_observation_invalid");
    assert.equal(attempt.effectState, "unknown");
  }
});

/**
 * 契約表示はProject状態・後続Task・受入の非所有を宣言するを検証する。
 *
 * @responsibility 契約表示はProject状態・後続Task・受入の非所有を宣言するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 契約表示はProject状態・後続Task・受入の非所有を宣言するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("契約表示はProject状態・後続Task・受入の非所有を宣言する", () => {
  assert.deepEqual(describeProjectRuntimeSingleTaskAdapterContract(), {
    contract: CONTRACT,
    contractRevision: 2,
    taskRequestSchemaOwnership: "single_task_runtime",
    projectStateOwnership: "none",
    followUpTaskCreation: "none",
    acceptanceOwnership: "none",
    unknownSettlement: "fail_closed_manual_recovery",
    effectCancellationRepresentation:
      "pre_effect_and_confirmed_post_effect_cleanup_normalized_to_project_cancelled_other_effect_era_results_preserved",
  });
});

/**
 * Effect前拒否母集団はv0.18 Runtimeの実throw経路と一致するを検証する。
 *
 * @responsibility Effect前拒否母集団はv0.18 Runtimeの実throw経路と一致するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Effect前拒否母集団はv0.18 Runtimeの実throw経路と一致するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("Effect前拒否母集団はv0.18 Runtimeの実throw経路と一致する", () => {
  assert.deepEqual(PROJECT_RUNTIME_SINGLE_TASK_PRE_EFFECT_REJECTIONS, [
    "coordinator_task_process_restart_required",
    "coordinator_task_runtime_cleanup_in_progress",
    "coordinator_task_release_verification_required",
  ]);
  const runtimeSource = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../../src/security/coordinator-task-runtime.ts",
    ),
    "utf8",
  );
  for (const rejection of PROJECT_RUNTIME_SINGLE_TASK_PRE_EFFECT_REJECTIONS)
    assert.equal(runtimeSource.includes(`"${rejection}"`), true, rejection);
  // Real pre-effect trigger: an unverified package capability is rejected
  // before any task, provider or repository effect (verified side-effect-free
  // read path). The process-state rejections are not induced here because
  // poisoning the shared runtime state would leak into other assertions; that
  // induction is deferred to the single-task wiring stage.
  assert.throws(
    () => startRuntimeOwnedCoordinatorTask({}, "C:\\repository", {}),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "coordinator_task_release_verification_required",
  );
});
