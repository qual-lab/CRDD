import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { startRuntimeOwnedCoordinatorTask } from "../src/security/coordinator-task-runtime.ts";
import {
  describeProjectRuntimeSingleTaskAdapterContract,
  PROJECT_RUNTIME_SINGLE_TASK_PRE_EFFECT_REJECTIONS,
  type ProjectRuntimeSingleTaskDependencies,
  runProjectRuntimeSingleTaskAttempt,
} from "../src/security/project-runtime-single-task-adapter.ts";

const CONTRACT = "crdd-coordinator/project-runtime-single-task-adapter";
const ATTEMPT_ID = "attempt-0001";
const OPERATION_ID = "operation-0001";
const AUTHORITY_BINDING_ID = "authority-0001";
const repositoryRevisionValue = "a".repeat(40);

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

function validInput(
  overrides: Readonly<Record<string, unknown>> = Object.freeze({}),
) {
  return Object.freeze({
    attemptId: ATTEMPT_ID,
    operationId: OPERATION_ID,
    authorityBindingId: AUTHORITY_BINDING_ID,
    repositoryRevision: repositoryRevisionValue,
    taskAuthorityCapability: Object.freeze({}),
    taskRequest: Object.freeze({ objective: "bounded" }),
    repositoryRoot: "C:\\repository",
    cancellationSignal: new AbortController().signal,
    ...overrides,
  }) as Parameters<typeof runProjectRuntimeSingleTaskAttempt>[1];
}

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
  });
  assert.equal(startCalls.length, 1);
  const startArguments = startCalls[0];
  assert.ok(startArguments);
  assert.deepEqual(startArguments[0], { objective: "bounded" });
  assert.equal(startArguments[1], "C:\\repository");
});

test("入力不正はTask Effect 0の入力拒否として閉じる", async () => {
  const { dependencies, startCalls } = harness();
  const invalidInputs = [
    validInput({ attemptId: "" }),
    validInput({ attemptId: ".leading-dot" }),
    validInput({ operationId: ".leading-dot" }),
    validInput({ authorityBindingId: ".leading-dot" }),
    validInput({ repositoryRevision: "not-hex" }),
    validInput({ taskAuthorityCapability: null }),
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
    });
  }
  assert.equal(startCalls.length, 0);
});

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
    });
  }
});

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
  assert.equal(attempt.status, "blocked");
  assert.equal(attempt.reason, "coordinator_task_cancelled_before_stage_start");
  assert.equal(attempt.effectState, "settled");
  assert.deepEqual(cancelCalls, [controlCapability]);
});

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
  assert.equal(attempt.status, "blocked");
  assert.equal(attempt.effectState, "settled");
});

test("取消入口の非同期失敗は未処理rejectionにせず完了観測を保持する", async () => {
  const controller = new AbortController();
  let settleCompletion: ((value: unknown) => void) | null = null;
  const completion = new Promise((resolve) => {
    settleCompletion = resolve;
  });
  const unhandledRejections: unknown[] = [];
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
    assert.equal(attempt.status, "blocked");
    assert.equal(attempt.effectState, "settled");
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandledRejections, []);
  } finally {
    process.removeListener("unhandledRejection", captureRejection);
  }
});

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
  assert.equal(attempt.status, "blocked");
  assert.equal(attempt.effectState, "settled");
  assert.deepEqual(cancelCalls, [controlCapability]);
});

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

test("契約表示はProject状態・後続Task・受入の非所有を宣言する", () => {
  assert.deepEqual(describeProjectRuntimeSingleTaskAdapterContract(), {
    contract: CONTRACT,
    contractRevision: 1,
    taskRequestSchemaOwnership: "single_task_runtime",
    projectStateOwnership: "none",
    followUpTaskCreation: "none",
    acceptanceOwnership: "none",
    unknownSettlement: "fail_closed_manual_recovery",
    effectCancellationRepresentation:
      "pre_effect_adapter_owned_cancelled_and_effect_era_runtime_owned_blocked_reason",
  });
});

test("Effect前拒否母集団はv0.18 Runtimeの実throw経路と一致する", () => {
  assert.deepEqual(PROJECT_RUNTIME_SINGLE_TASK_PRE_EFFECT_REJECTIONS, [
    "coordinator_task_process_restart_required",
    "coordinator_task_runtime_cleanup_in_progress",
    "coordinator_task_release_verification_required",
  ]);
  const runtimeSource = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../src/security/coordinator-task-runtime.ts",
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
