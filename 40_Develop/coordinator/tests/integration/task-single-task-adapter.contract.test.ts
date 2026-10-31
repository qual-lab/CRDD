/**
 * coordinator:integration:task-single-task-adapterの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:task-single-task-adapterが所有する検証責務を実行する。
 * @trace PRL-IT-005
 * @level IT
 * @scope project、runtime、single、task、adapter
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { getEventListeners } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  describeCoordinatorSingleTaskAdapterContract,
  COORDINATOR_SINGLE_TASK_PRE_EFFECT_REJECTIONS,
  type CoordinatorSingleTaskDependencies,
  runCoordinatorSingleTaskAttempt,
} from "../../src/execution/controller.ts";
import { startRuntimeOwnedCoordinatorTask } from "../../src/execution/controller.ts";
import { observeCoordinatorTaskCompletion } from "../../src/execution/observation.ts";

/**
 * 変更観測の意味と閉じた形を固定する。
 * @responsibility 欠測・空・変更ありと方式の相関を反証する。
 * @trace PRL-IT-005
 * @precondition 内容なしの観測metadata。
 * @stimulus 正常値と各不整合、getter、余剰field。
 * @observation snapshot又はnull。
 * @oracle 欠測を変更なしにせずHost Pathを受けない。
 * @cleanup N/A: 値検査だけ。
 * @boundary Task結果と上位契約。
 */
test("Workspace観測snapshotは方式と変更情報の相関を保持する", () => {
  const base = {
    workspaceId: null,
    changedPaths: ["src/file.ts"],
    canonicalRepositoryChanged: true,
    changeAttribution: "unattributed",
    workspaceDeletionIssued: false,
  };
  assert.deepEqual(snapshotCoordinatorWorkspaceResult(base), base);
  for (const raw of [
    { ...base, canonicalRepositoryChanged: false },
    { ...base, changedPaths: null },
    { ...base, changedPaths: [] },
    { ...base, changedPaths: ["C:/host"] },
    { ...base, changedPaths: ["../outside"] },
    { ...base, changedPaths: ["src/file.ts", "src/file.ts"] },
    { ...base, workspaceDeletionIssued: true },
    { ...base, extra: true },
    Object.defineProperty({ ...base }, "changedPaths", {
      get: () => assert.fail("getter"),
    }),
  ])
    assert.equal(snapshotCoordinatorWorkspaceResult(raw), null);
  for (const changedPaths of [null, [], ["src/file.ts"]]) {
    const value = {
      ...base,
      changedPaths,
      canonicalRepositoryChanged:
        changedPaths === null ? null : changedPaths.length > 0,
    };
    assert.deepEqual(snapshotCoordinatorWorkspaceResult(value), value);
  }
});
import {
  beginRuntimeProcessEffectDrain,
  endRuntimeProcessEffectDrain,
} from "../../src/execution/process-safety-state.ts";

const CONTRACT = "crdd-coordinator/orchestrator-single-task-adapter";
const ATTEMPT_ID = "attempt-0001";
const OPERATION_ID = "operation-0001";
const AUTHORITY_BINDING_ID = "authority-0001";
const repositoryRevisionValue = "a".repeat(40);
const dockerRecoveryId = `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`;

/**
 * 元Controlをawait前に捕捉し、Reader受渡し失敗でも元Taskの完了観測を維持する。
 * @responsibility 同Processの配送捕捉と公開結果の境界を確認する。
 * @trace PRL-IT-005
 * @precondition 未完了Promiseと元Controlを持つ模擬Taskを用意する。
 * @stimulus 捕捉成功、捕捉例外、Reader受渡し例外を実行する。
 * @observation 捕捉順序、Reader受渡し、元完了結果と公開fieldを取得する。
 * @oracle 捕捉は同期区間で実施し、例外をEffectなしへ変換せず、関数を公開しない。
 * @cleanup 全Promiseを終端し、外部Processは起動しない。
 * @boundary Coordinator Adapter→元Coordinator Task Control。
 */
test("結果配送捕捉はawait前で失敗時も元Taskを待つ", async () => {
  for (const mode of [
    "success",
    "capture_throw",
    "binding_throw",
    "binding_reject",
    "binding_pending",
    "binding_late_reject",
  ] as const) {
    let resolve!: (value: unknown) => void;
    const completion = new Promise<unknown>((done) => {
      resolve = done;
    });
    const { dependencies, controlCapability } = harness({ completion });
    const callOrderEntries: string[] = [];
    const delivery = Object.freeze({
      readResults: () =>
        Object.freeze({ status: "not_required" as const, results: null }),
      complete: () => {
        throw new Error("no_result");
      },
    });
    let isReturned = false;
    let rejectBinding!: (error: Error) => void;
    const lateBinding = new Promise<void>((_resolve, reject) => {
      rejectBinding = reject;
    });
    const pending = runCoordinatorSingleTaskAttempt(
      {
        ...dependencies,
        captureResultDelivery: (control) => {
          assert.equal(control, controlCapability);
          callOrderEntries.push("capture");
          if (mode === "capture_throw") throw new Error("capture_failed");
          return delivery;
        },
      },
      validInput({
        bindResultReader: (captured: unknown) => {
          callOrderEntries.push("bind");
          assert.equal(captured, mode === "capture_throw" ? null : delivery);
          if (mode === "binding_throw") throw new Error("binding_failed");
          if (mode === "binding_reject")
            return Promise.reject(Error("binding_failed"));
          if (mode === "binding_pending") return new Promise<void>(() => {});
          if (mode === "binding_late_reject") return lateBinding;
        },
      }),
    ).then((outcome) => {
      isReturned = true;
      return outcome;
    });
    assert.deepEqual(callOrderEntries, ["capture", "bind"]);
    await Promise.resolve();
    assert.equal(isReturned, false);
    resolve(completionRecord());
    const outcome = await pending;
    assert.equal(outcome.status, "completed");
    assert.equal(outcome.effectState, "settled");
    assert.ok(
      Object.values(outcome).every((value) => typeof value !== "function"),
    );
    assert.equal(Object.hasOwn(outcome, "delivery"), false);
    if (mode === "binding_late_reject") {
      rejectBinding(Error("binding_failed_after_completion"));
      await new Promise<void>((done) => setImmediate(done));
      assert.equal(outcome.status, "completed");
      assert.deepEqual(callOrderEntries, ["capture", "bind"]);
    }
  }
});

/**
 * 開始通知だけが上位状態保存を一回発火し、終端後は発火しない。
 *
 * @responsibility 受付、Executor開始、Reviewer開始と終了後を区別する。
 * @trace PRL-IT-005
 * @precondition 未完了Taskと通知を明示発行できる模擬開始境界を用意する。
 * @stimulus 初回・重複・Reviewer・是正Executor・終端後の通知を渡す。
 * @observation 上位確認回数、通知の返却値と最終結果を取得する。
 * @oracle 上位確認は一回だけで、終端後通知は例外、正常完了は維持する。
 * @cleanup 元の完了Promiseを終端する。外部資源を作成しない。
 * @boundary Task通知からCoordinatorの開始保存Callbackへの境界。
 */
test("開始通知は初回Executorだけを保存し受付・重複・終端後を区別する", async () => {
  let settle!: (value: unknown) => void;
  let saves = 0;
  const completion = new Promise<unknown>((resolve) => {
    settle = resolve;
  });
  const { dependencies, startCalls } = harness({ completion });
  const pending = runCoordinatorSingleTaskAttempt(
    dependencies,
    validInput({
      observeStarted: async () => {
        saves += 1;
      },
    }),
  );
  assert.equal(saves, 0);
  const notify = startCalls[0]?.[3] as NonNullable<
    Parameters<CoordinatorSingleTaskDependencies["startTask"]>[3]
  >;
  assert.equal(typeof notify, "function");
  const notice = Object.freeze({
    event: "coordinator_provider_process_started" as const,
    taskRole: "executor" as const,
    provider: "claude" as const,
    operationId: "OP-lower-executor",
  });
  assert.deepEqual(await Promise.all([notify(notice), notify(notice)]), [
    undefined,
    undefined,
  ]);
  assert.equal(
    await notify({
      ...notice,
      taskRole: "reviewer",
      operationId: "OP-lower-reviewer",
      provider: "codex",
    }),
    undefined,
  );
  assert.equal(
    await notify({ ...notice, operationId: "OP-remediation-executor" }),
    undefined,
  );
  assert.equal(saves, 1);
  settle(completionRecord());
  assert.equal((await pending).status, "completed");
  await assert.rejects(async () => notify(notice), /notification_closed/u);
  assert.equal(saves, 1);
});

/**
 * 通知の欠落や上位保存失敗を完了成功へ丸めない。
 *
 * @responsibility 通知必須の呼出しで模擬成功だけが返る反例を拒否する。
 * @trace PRL-IT-005
 * @precondition 資源回収済みの模擬完了と拒否・例外の保存Callbackを使用する。
 * @stimulus 通知なし、同期例外、非同期拒否の結果を評価する。
 * @observation 完了status、理由、候補公開と回収状態を取得する。
 * @oracle 成功や候補を返さず、確認済み回収を不明へ書き換えない。
 * @cleanup 模擬Taskの元の完了を待つ。外部Effectはない。
 * @boundary 上位開始確認とTask結果公開の境界。
 */
test("必須開始通知の欠落・保存拒否・例外を成功へ補正しない", async () => {
  const missing = await runCoordinatorSingleTaskAttempt(
    harness().dependencies,
    validInput({ observeStarted: async () => {} }),
  );
  assert.equal(missing.status, "blocked");
  assert.equal(missing.reason, "single_task_start_notification_missing");
  assert.equal(missing.cleanupConfirmed, true);
  assert.equal(missing.manualRecoveryRequired, false);
  assert.equal(missing.candidateId, null);
  for (const isThrows of [false, true]) {
    const dependencies: CoordinatorSingleTaskDependencies = {
      startTask: (_request, _root, _correlation, notify) => ({
        status: "started",
        controlCapability: Object.freeze({}),
        completion: Promise.resolve().then(async () => {
          await assert.rejects(async () =>
            notify?.({
              event: "coordinator_provider_process_started",
              taskRole: "executor",
              provider: "claude",
              operationId: "OP-executor",
            }),
          );
          return completionRecord({
            status: "blocked",
            reason: "provider_start_observation_failed",
            candidateId: null,
          });
        }),
      }),
      cancelTask: () => null,
    };
    const outcome = await runCoordinatorSingleTaskAttempt(
      dependencies,
      validInput({
        observeStarted: async () => {
          if (isThrows) throw new Error("fixture_save_failed");
          return Promise.reject(Error("fixture_save_rejected"));
        },
      }),
    );
    assert.equal(outcome.status, "blocked");
    assert.equal(outcome.reason, "provider_start_observation_failed");
    assert.equal(outcome.cleanupConfirmed, true);
  }
});

/**
 * 上位保存待ちでも取消監視が接続済みである。
 *
 * @responsibility 開始確認待機が同じTaskの取消と元の完了を切り離さないことを確認する。
 * @trace PRL-IT-005
 * @precondition 開始確認を未完了にし、取消後に回収済み結果を返す模擬Taskを使用する。
 * @stimulus 通知待機中にabortし、保存を解放して完了を待つ。
 * @observation exact制御参照への取消回数、完了結果、abort監視残存を取得する。
 * @oracle 取消一回、回収確認付きcancelled、終端後監視0。
 * @cleanup 保存・完了Promiseを解放し、監視を解除する。
 * @boundary 開始保存待機と同じTaskの取消境界。
 */
test("開始通知の保存待機中も取消を一回搬送して元の完了を待つ", async () => {
  const controller = new AbortController();
  const controlCapability = Object.freeze({});
  const calls: object[] = [];
  let releaseSave!: () => void;
  const save = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  let notify!: NonNullable<
    Parameters<CoordinatorSingleTaskDependencies["startTask"]>[3]
  >;
  let settle!: (value: unknown) => void;
  const completion = new Promise<unknown>((resolve) => {
    settle = resolve;
  });
  const dependencies: CoordinatorSingleTaskDependencies = {
    startTask: (_request, _root, _correlation, observer) => {
      assert.ok(observer);
      notify = observer;
      return { status: "started", controlCapability, completion };
    },
    cancelTask: (control) => {
      calls.push(control);
      return null;
    },
  };
  const pending = runCoordinatorSingleTaskAttempt(
    dependencies,
    validInput({
      cancellationSignal: controller.signal,
      observeStarted: () => save,
    }),
  );
  const observation = notify({
    event: "coordinator_provider_process_started",
    taskRole: "executor",
    provider: "claude",
    operationId: "OP-executor",
  });
  await Promise.resolve();
  assert.equal(getEventListeners(controller.signal, "abort").length, 1);
  controller.abort();
  controller.abort();
  assert.deepEqual(calls, [controlCapability]);
  releaseSave();
  await observation;
  settle(
    completionRecord({
      status: "blocked",
      reason: "coordinator_task_cancelled_after_provider_cleanup",
      candidateId: null,
    }),
  );
  const outcome = await pending;
  assert.equal(outcome.status, "cancelled");
  assert.equal(outcome.cleanupConfirmed, true);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

/**
 * 開始保存失敗後も元の技術結果と回復参照を搬送する。
 * @responsibility 通知Promiseのjoinが結果構築を飛び越えないことを確認する。
 * @trace PRL-IT-005
 * @precondition 同じ元Taskが持つexact回復IDと清掃観測を固定する。
 * @stimulus 開始保存をrejectし、清掃成立／不明の元完了を返す。
 * @observation 最終理由、cleanup、回復集合と呼出し回数を取得する。
 * @oracle 失敗を成功にせず、同じIDと実際の清掃観測を保持する。
 * @cleanup 局所Promiseをすべて待つ。実資源なし。
 * @boundary Task開始通知と終端結果。
 */
test("開始保存reject後のjoinでもexact回復参照と清掃事実を失わない", async () => {
  for (const clean of [true, false]) {
    let saves = 0;
    const dependencies: CoordinatorSingleTaskDependencies = {
      startTask: (_request, _root, _correlation, notify) => ({
        status: "started",
        controlCapability: Object.freeze({}),
        completion: Promise.resolve().then(async () => {
          await assert.rejects(async () =>
            notify?.({
              event: "coordinator_provider_process_started",
              taskRole: "executor",
              provider: "codex",
              operationId: "OP-executor",
            }),
          );
          return completionRecord({
            status: "blocked",
            reason: "provider_start_observation_failed",
            candidateId: null,
            cleanupConfirmed: clean,
            manualRecoveryRequired: true,
            dockerRecoveryIds: [dockerRecoveryId],
          });
        }),
      }),
      cancelTask: () => null,
    };
    const outcome = await runCoordinatorSingleTaskAttempt(
      dependencies,
      validInput({
        observeStarted: async () => {
          saves++;
          throw Error("private_save_failure");
        },
      }),
    );
    assert.equal(saves, 1);
    assert.equal(outcome.status, "blocked");
    assert.equal(outcome.reason, "provider_start_observation_failed");
    assert.equal(outcome.cleanupConfirmed, clean);
    assert.equal(outcome.manualRecoveryRequired, true);
    assert.deepEqual(outcome.recoveryIds, [dockerRecoveryId]);
  }
});

/**
 * 最終join前の開始保存拒否を新品Processで確認する。
 * @responsibility 通知の未処理拒否を後着のjoinで隠さない。
 * @trace PRL-IT-005
 * @precondition 外部Effectなしの局所子Processと遅延completion。
 * @stimulus 下位が通知Promiseを保持しない場合に、上位保存を即時rejectさせる。
 * @observation 未処理拒否数、最終結果、exact回復IDと清掃観測。
 * @oracle 未処理拒否零、処置一回、元結果と同じ回復・清掃を保持する。
 * @cleanup 子ProcessのcloseをspawnSyncで確認する。File生成なし。
 * @boundary Coordinator通知OwnerとNodeの拒否観測。
 */
test("遅延completion前の開始保存rejectをOwnerが直ちに捕捉する", () => {
  const source = `
    import { runCoordinatorSingleTaskAttempt } from ${JSON.stringify(new URL("../../src/execution/controller.ts", import.meta.url).href)};
    let unhandled = 0, calls = 0;
    process.on("unhandledRejection", () => unhandled++);
    const results = [];
    for (const clean of [true, false]) {
      const completion = ${JSON.stringify(completionRecord({ status: "blocked", reason: "provider_start_observation_failed", candidateId: null, manualRecoveryRequired: true, dockerRecoveryIds: [dockerRecoveryId] }))};
      completion.cleanupConfirmed = clean;
      const dependencies = {
        startTask(_request, _root, _correlation, notify) {
          queueMicrotask(() => { notify({event:"coordinator_provider_process_started",taskRole:"executor",provider:"codex",operationId:"OP-child"}); });
          return {status:"started",controlCapability:{},completion:new Promise(resolve=>setTimeout(()=>resolve(completion),40))};
        },
        cancelTask() {}
      };
      results.push(await runCoordinatorSingleTaskAttempt(dependencies, {
        ...${JSON.stringify(validInput())},
        cancellationSignal: new AbortController().signal,
        observeStarted: async () => { calls++; throw Error("private_save_failure"); }
      }));
    }
    await new Promise(resolve => setImmediate(resolve));
    console.log(JSON.stringify({unhandled,calls,results}));
  `;
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", source],
    {
      encoding: "utf8",
      timeout: 15000,
      windowsHide: true,
    },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0);
  assert.doesNotMatch(child.stderr, /Unhandled|RejectionHandledWarning/u);
  const observed = JSON.parse(child.stdout);
  assert.equal(observed.unhandled, 0);
  assert.equal(observed.calls, 2);
  for (const [index, outcome] of observed.results.entries()) {
    assert.equal(outcome.status, "blocked");
    assert.equal(outcome.reason, "provider_start_observation_failed");
    assert.equal(outcome.cleanupConfirmed, index === 0);
    assert.deepEqual(outcome.recoveryIds, [dockerRecoveryId]);
  }
});

/**
 * 完了待機中に呼出し元入力が変わっても開始時の上位相関を維持する。
 *
 * @responsibility 上位Adapter移管後のAttempt・判断権限・Revision固定を反証する。
 * @trace PRL-IT-005
 * @precondition 開始時に有効な可変入力と未完了Promiseを用意する。
 * @stimulus Task開始後に入力の相関値を変更して完了させる。
 * @observation 最終結果のAttempt・判断権限・Revisionを取得する。
 * @oracle 開始時の相関値だけが結果へ残る。
 * @cleanup 局所Promiseを終端し、Task観測を待つ。
 * @boundary PRL-IT-005=上位相関とCoordinator完了待機の境界。
 */
test("完了待機中の入力変更で上位相関を置き換えない", async () => {
  let settleCompletion!: (value: unknown) => void;
  const completion = new Promise<unknown>((resolve) => {
    settleCompletion = resolve;
  });
  const input = { ...validInput() };
  const { dependencies } = harness({ completion });
  const pending = runCoordinatorSingleTaskAttempt(dependencies, input);
  input.attemptId = "another-attempt";
  input.authorityBindingId = "another-authority";
  input.repositoryRevision = "b".repeat(40);
  settleCompletion(completionRecord());
  const result = await pending;
  assert.equal(result.attemptId, ATTEMPT_ID);
  assert.equal(result.authorityBindingId, AUTHORITY_BINDING_ID);
  assert.equal(result.repositoryRevision, repositoryRevisionValue);
});

/**
 * 完了観測が成功と拒否の両方で取消監視を解除することを確認する。
 *
 * @responsibility 共通Task観測の監視残存と取消搬送回数を直接検証する。
 * @trace PRL-IT-005
 * @precondition 実AbortSignalと局所完了Promiseを使用する。
 * @stimulus Signalを二回取消し、元の完了Promiseを成功または拒否で終端する。
 * @observation 取消搬送回数、同一制御参照、監視数と返却statusを観測する。
 * @oracle 取消搬送は一度で、終端後abort監視は0件、拒否はunknownとなる。
 * @cleanup 元のPromiseを終端し、観測関数が登録した監視を解除する。
 * @boundary PRL-IT-005=Task完了待機と取消SignalのProcess内境界。
 */
test("Task completion observation releases abort listeners on resolve and reject", async () => {
  for (const isRejectCompletion of [false, true]) {
    const controller = new AbortController();
    const controlCapability = Object.freeze({});
    const calls: object[] = [];
    let resolveCompletion!: (value: unknown) => void;
    let rejectObservedCompletion!: (reason: Error) => void;
    const completion = new Promise<unknown>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectObservedCompletion = reject;
    });
    const pending = observeCoordinatorTaskCompletion(
      { controlCapability, completion },
      (control) => {
        calls.push(control);
        return Promise.reject(new Error("cancel_entry_failed"));
      },
      controller.signal,
    );
    assert.equal(getEventListeners(controller.signal, "abort").length, 1);
    controller.abort();
    controller.abort();
    if (isRejectCompletion)
      rejectObservedCompletion(new Error("completion_unknown"));
    else resolveCompletion(Object.freeze({ status: "blocked" }));
    const observed = await pending;
    assert.deepEqual(calls, [controlCapability]);
    assert.equal(observed.status, isRejectCompletion ? "unknown" : "observed");
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    if (observed.status === "observed")
      assert.equal(observed.cancellationTransferred, true);
  }
});

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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
function harness(
  overrides: Readonly<{
    startTask?: CoordinatorSingleTaskDependencies["startTask"];
    cancelTask?: CoordinatorSingleTaskDependencies["cancelTask"];
    completion?: Promise<unknown>;
  }> = Object.freeze({}),
) {
  const startCalls: unknown[][] = [];
  const cancelCalls: unknown[] = [];
  const controlCapability = Object.freeze({});
  const dependencies: CoordinatorSingleTaskDependencies = Object.freeze({
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
function validInput(
  overrides: Readonly<Record<string, unknown>> = Object.freeze({}),
) {
  return Object.freeze({
    attemptId: ATTEMPT_ID,
    operationId: OPERATION_ID,
    authorityBindingId: AUTHORITY_BINDING_ID,
    repositoryRevision: repositoryRevisionValue,
    taskRequest: Object.freeze({ objective: "bounded" }),
    repositoryRoot: "C:\\repository",
    cancellationSignal: new AbortController().signal,
    ...overrides,
  }) as Parameters<typeof runCoordinatorSingleTaskAttempt>[1];
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("正常完了はattemptと固定Revisionへ結合した閉結果で返る", async () => {
  const { dependencies, startCalls } = harness();
  const attempt = await runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("実行元が返した実効Executor Providerだけを閉結果へ保持する", async () => {
  const { dependencies } = harness({
    completion: Promise.resolve(
      completionRecord({ executorProvider: "claude" }),
    ),
  });
  const attempt = await runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("入力不正はTask Effect 0の入力拒否として閉じる", async () => {
  const { dependencies, startCalls } = harness();
  const invalidInputs = [
    validInput({ attemptId: "" }),
    validInput({ attemptId: ".leading-dot" }),
    validInput({ operationId: ".leading-dot" }),
    validInput({ authorityBindingId: ".leading-dot" }),
    validInput({ repositoryRevision: "not-hex" }),
    validInput({ cancellationSignal: {} }),
  ];
  for (const input of invalidInputs) {
    const attempt = await runCoordinatorSingleTaskAttempt(dependencies, input);
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("開始前の取消はTask Effect 0のcancelledとして閉じる", async () => {
  const { dependencies, startCalls } = harness();
  const controller = new AbortController();
  controller.abort();
  const attempt = await runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("既知のEffect前拒否はEffect 0のblockedへ写像する", async () => {
  for (const [message, processRestartRequired] of [
    ["coordinator_task_process_restart_required", true],
    ["coordinator_task_runtime_cleanup_in_progress", false],
  ] as const) {
    const { dependencies } = harness({
      startTask: () => {
        throw new Error(message);
      },
    });
    const attempt = await runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("未知の開始例外はEffect不明としてfail closedする", async () => {
  const { dependencies } = harness({
    startTask: () => {
      throw new Error("unexpected_infrastructure_error");
    },
  });
  const attempt = await runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
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
    const attempt = await runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
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
    const attempt = await runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
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
  const attempt = await runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
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
    const attempt = await runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
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
    const attempt = await runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
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
    const attempt = await runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
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
  const pendingAttempt = runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
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
  const pendingAttempt = runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
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
   * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
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
    const pendingAttempt = runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("startTask実行中の同期abortも一度だけ転送される", async () => {
  const controller = new AbortController();
  const cancelCalls: unknown[] = [];
  const controlCapability = Object.freeze({});
  const dependencies: CoordinatorSingleTaskDependencies = Object.freeze({
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
  const attempt = await runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("取消と同時に観測した通常失敗はcancelledへ丸めない", async () => {
  const controller = new AbortController();
  let settleCompletion: ((value: unknown) => void) | null = null;
  const completion = new Promise((resolve) => {
    settleCompletion = resolve;
  });
  const { dependencies } = harness({ completion });
  const pendingAttempt = runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("回復義務を伴う取消結果はcancelledへ丸めない", async () => {
  const controller = new AbortController();
  let settleCompletion: ((value: unknown) => void) | null = null;
  const completion = new Promise((resolve) => {
    settleCompletion = resolve;
  });
  const { dependencies } = harness({ completion });
  const pendingAttempt = runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
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
    const attempt = await runCoordinatorSingleTaskAttempt(
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("契約表示はProject状態・後続Task・受入の非所有を宣言する", () => {
  assert.deepEqual(describeCoordinatorSingleTaskAdapterContract(), {
    contract: CONTRACT,
    contractRevision: 3,
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
 * Effect前拒否母集団は現在Runtimeの実throw経路と一致する。
 *
 * @responsibility 片付け中とProcess再利用禁止の拒否母集団を照合する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 拒否理由集合をSourceへ照合し、実際の片付け待機中にTask入口を呼ぶ。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("Effect前拒否母集団は現在Runtimeの実throw経路と一致する", () => {
  assert.deepEqual(COORDINATOR_SINGLE_TASK_PRE_EFFECT_REJECTIONS, [
    "coordinator_task_process_restart_required",
    "coordinator_task_runtime_cleanup_in_progress",
    "coordinator_task_workspace_target_invalid",
  ]);
  const runtimeSource = fs.readFileSync(
    path.resolve(import.meta.dirname, "../../src/execution/controller.ts"),
    "utf8",
  );
  for (const rejection of COORDINATOR_SINGLE_TASK_PRE_EFFECT_REJECTIONS)
    assert.equal(runtimeSource.includes(`"${rejection}"`), true, rejection);
  const drain = beginRuntimeProcessEffectDrain();
  try {
    assert.throws(
      () => startRuntimeOwnedCoordinatorTask({}, "C:\\repository"),
      /coordinator_task_runtime_cleanup_in_progress/u,
    );
  } finally {
    assert.equal(endRuntimeProcessEffectDrain(drain), true);
  }
});

/**
 * Provider未選択の拒否結果でも理由と回復参照を保持する。
 *
 * @responsibility blocked/nullを結果不明へ変換せず、実際の回復義務だけを保持する。
 * @trace PRL-IT-005
 * @precondition 実Runtimeの拒否結果に対応する固定完了値を用いる。
 * @stimulus 回復不要とexact回復義務ありの完了値をAdapterへ渡す。
 * @observation 理由、Provider投影、cleanupと回復参照を観測する。
 * @oracle 元理由を保持し、nullをProviderやEffect 0の根拠にしない。
 * @cleanup N/A: 外部資源を生成せず、完了Promiseだけを局所注入する。
 * @boundary PRL-IT-005=Direct Boundary: Task完了値→Single Task Adapter。
 */
test("未選択Providerの拒否は理由とexact回復を保持する", async () => {
  for (const manualRecoveryRequired of [false, true]) {
    const { dependencies } = harness({
      completion: Promise.resolve(
        completionRecord({
          status: "blocked",
          reason: "coordinator_task_external_send_confirmation_unavailable",
          executorProvider: null,
          candidateId: null,
          cleanupConfirmed: !manualRecoveryRequired,
          manualRecoveryRequired,
          dockerRecoveryIds: manualRecoveryRequired ? [dockerRecoveryId] : [],
        }),
      ),
    });
    const result = await runCoordinatorSingleTaskAttempt(
      dependencies,
      validInput(),
    );
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      "coordinator_task_external_send_confirmation_unavailable",
    );
    assert.equal(Object.hasOwn(result, "executorProvider"), false);
    assert.equal(result.cleanupConfirmed, !manualRecoveryRequired);
    assert.equal(result.manualRecoveryRequired, manualRecoveryRequired);
    assert.deepEqual(
      result.recoveryIds,
      manualRecoveryRequired ? [dockerRecoveryId] : [],
    );
    assert.deepEqual(
      result.recoveryObligations,
      manualRecoveryRequired
        ? [{ kind: "docker", recoveryId: dockerRecoveryId }]
        : [],
    );
  }
});

/**
 * Providerの欠測互換と不正完了値の拒否を区別する。
 *
 * @responsibility 未選択nullは拒否結果だけで許可し、成功や未知値へ広げない。
 * @trace PRL-IT-005
 * @precondition 外部Effectを持たない固定Fixtureを使用する。
 * @stimulus completed/null、未知値、欠測互換、実効Providerを比較する。
 * @observation 結果理由と実効Providerの投影を観測する。
 * @oracle completed/nullと未知値は拒否し、undefinedと既存Providerを維持する。
 * @cleanup N/A: 固定完了Promise以外の資源を使用しない。
 * @boundary PRL-IT-005=Direct Boundary: Task完了値→Single Task Adapter。
 */
test("Provider未選択は成功へ拡張せず欠測互換を維持する", async () => {
  for (const executorProvider of [
    null,
    "unknown",
    undefined,
    "codex",
    "claude",
  ]) {
    const { dependencies } = harness({
      completion: Promise.resolve(completionRecord({ executorProvider })),
    });
    const result = await runCoordinatorSingleTaskAttempt(
      dependencies,
      validInput(),
    );
    if (executorProvider === null || executorProvider === "unknown") {
      assert.equal(result.reason, "single_task_completion_observation_invalid");
      assert.equal(result.manualRecoveryRequired, true);
    } else {
      assert.equal(result.status, "completed");
      assert.equal(result.executorProvider, executorProvider);
    }
  }
});

/**
 * Provider Getterを欠測に読み替えず非実行で拒否する。
 *
 * @responsibility 参照時Effectを持つAccessorを結果契約へ受理しない。
 * @trace PRL-IT-005
 * @precondition Provider項目だけをAccessorにした固定完了値を用いる。
 * @stimulus AdapterへAccessor完了値を渡す。
 * @observation Getter呼出し数と拒否理由を観測する。
 * @oracle Getter 0回かつ完了観測不正として拒否する。
 * @cleanup N/A: 外部Effectや残存資源を生成しない。
 * @boundary PRL-IT-005=Direct Boundary: Task完了値→Single Task Adapter。
 */
test("Provider Accessorを実行せず欠測互換から除外する", async () => {
  let getterCalls = 0;
  const value = { ...completionRecord() };
  Object.defineProperty(value, "executorProvider", {
    get() {
      getterCalls += 1;
      return undefined;
    },
  });
  const { dependencies } = harness({
    completion: Promise.resolve(Object.freeze(value)),
  });
  const result = await runCoordinatorSingleTaskAttempt(
    dependencies,
    validInput(),
  );
  assert.equal(getterCalls, 0);
  assert.equal(result.reason, "single_task_completion_observation_invalid");
  assert.equal(result.manualRecoveryRequired, true);
});

import { snapshotCoordinatorWorkspaceResult } from "../../../domain-model/src/index.ts";
