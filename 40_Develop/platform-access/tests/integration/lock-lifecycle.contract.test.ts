/**
 * Named Pipe技術lifecycleの故障・終了を検証する。
 * @packageDocumentation
 * @responsibility 既存Worker／Supervisorの故障Oracleを上位入力検査から分離する。
 * @trace ERB-IT-003
 * @level IT
 * @scope lock、worker、supervisor
 * @boundary ERB-IT-003=Direct Boundary: PAの合成子・実自己所有WorkerとPipe。
 */
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { EventEmitter, once } from "node:events";
import { createServer } from "node:net";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  acquireHostOperationSupervisorLockUsingChildFactory,
  acquireInteractiveConsoleKernelLockOutcomeUsingFactory,
} from "../support/lock-harness.ts";
const FAST_SUPERVISOR_TIMING = Object.freeze({
  acquireTimeoutMs: 10,
  releaseTimeoutMs: 10,
});

/**
 * 故障通知の同期発行と登録時の即時通知を確認する。
 * @responsibility 例外・非同期拒否を故障結果や他listenerへ波及させない。
 * @trace ERB-IT-003
 * @precondition 合成Supervisor子だけを既存factoryで注入する。
 * @stimulus 通常故障・故障後登録・取得結果不明へthrow、reject、後着reject、pendingを渡す。
 * @observation 同期順序、unsubscribe、終了要求数、failure/loss/release結果。
 * @oracle 拒否を待たず故障が確定し、後着で再通知・再終了しない。
 * @cleanup 合成子の既存finalizerをjoinし、実資源は取得しない。
 * @boundary PA本番Supervisorとメモリ代役。
 */
test("故障listenerの拒否は通常・即時・取得結果不明の通知を止めない", async () => {
  for (const mode of [
    "normal",
    "throw",
    "reject",
    "late_reject",
    "pending",
  ] as const) {
    const delayed: Array<(error: Error) => void> = [];
    const seen: string[] = [];
    const notify = () => {
      seen.push("notice");
      if (mode === "throw") throw Error("synthetic_listener_failure");
      if (mode === "reject")
        return Promise.reject(Error("synthetic_listener_reject"));
      if (mode === "late_reject")
        return new Promise<void>((_resolve, reject) => {
          delayed.push(reject);
        });
      if (mode === "pending") return new Promise<void>(() => {});
    };
    const scenario = supervisorChildScenario("normal");
    let child: ChildProcess | null = null;
    const acquired = await acquireHostOperationSupervisorLockUsingChildFactory(
      "crdd-coordinator-doctor-LISTENER",
      "c".repeat(32),
      (name, env) => {
        child = scenario.factory(name, env);
        return child;
      },
      FAST_SUPERVISOR_TIMING,
    );
    assert.ok(acquired.lock);
    const lock = acquired.lock;
    assert.equal(await acquired.lock.confirmReady(), "ready");
    acquired.lock.onFailureDetected(notify);
    acquired.lock.onFailureDetected(() => {
      seen.push("following");
    });
    const remove = acquired.lock.onFailureDetected(() => {
      seen.push("removed");
    });
    remove();
    assert.ok(child);
    assert.doesNotThrow(() => child?.emit("error", Error("synthetic_failure")));
    assert.deepEqual(seen, ["notice", "following"]);
    assert.doesNotThrow(() => {
      const unsubscribe = lock.onFailureDetected(notify);
      unsubscribe();
    });
    assert.deepEqual(seen, ["notice", "following", "notice"]);
    await acquired.lock.failureDetected;
    assert.equal(await acquired.lock.loss, "cleanup_confirmed_failure");
    assert.equal(await acquired.lock.release(), "cleanup_confirmed_failure");
    assert.equal(scenario.killCount(), 1);

    const unknownChild = supervisorChildScenario("acquire_timeout_unconfirmed");
    const unknown = await acquireHostOperationSupervisorLockUsingChildFactory(
      "crdd-coordinator-doctor-LISTENER",
      "d".repeat(32),
      unknownChild.factory,
      FAST_SUPERVISOR_TIMING,
    );
    assert.equal(unknown.status, "cleanup_unknown");
    assert.ok(unknown.lock);
    const unknownLock = unknown.lock;
    assert.doesNotThrow(() => {
      const unsubscribe = unknownLock.onFailureDetected(notify);
      unsubscribe();
    });
    assert.equal(await unknown.lock.release(), "cleanup_unknown");
    const count = unknownChild.killCount();
    for (const reject of delayed)
      reject(Error("synthetic_late_listener_reject"));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(seen, ["notice", "following", "notice", "notice"]);
    assert.equal(scenario.killCount(), 1);
    assert.equal(unknownChild.killCount(), count);
  }
});
/**
 * supervisorChildScenarioのTest準備責務を実行する。
 *
 * @responsibility supervisorChildScenarioがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus supervisorChildScenarioを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
function supervisorChildScenario(
  scenario:
    | "normal"
    | "acquire_timeout_terminated"
    | "acquire_timeout_unconfirmed"
    | "ready_malformed"
    | "ready_exit"
    | "acquired_disconnect_alive"
    | "ready_then_exit"
    | "ready_duplicate"
    | "ready_duplicate_unconfirmed"
    | "released_without_exit"
    | "exit_without_released"
    | "release_nonzero_exit",
) {
  let captured: Readonly<{
    pipeName: string;
    environment: NodeJS.ProcessEnv;
  }> | null = null;
  let killCount = 0;
  /**
   * factoryのTest準備責務を実行する。
   *
   * @responsibility factoryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-003
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus factoryを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
   */
  const factory = (pipeName: string, environment: NodeJS.ProcessEnv) => {
    captured = Object.freeze({ pipeName, environment });
    const child = new EventEmitter() as EventEmitter & {
      connected: boolean;
      exitCode: number | null;
      signalCode: NodeJS.Signals | null;
      channel: Readonly<{ unref: () => void }>;
      send: (message: unknown) => boolean;
      kill: () => boolean;
      unref: () => void;
    };
    child.connected = true;
    child.exitCode = null;
    child.signalCode = null;
    child.channel = Object.freeze({ unref: () => undefined });
    child.unref = () => undefined;
    /**
     * exitのTest準備責務を実行する。
     *
     * @responsibility exitがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
     * @trace ERB-IT-003
     * @precondition 呼出し元Test Caseが必要な入力を渡す。
     * @stimulus exitを呼び出す。
     * @observation 返却値、生成fixtureまたは観測値を取得する。
     * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
     * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
     * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
     */
    const exit = (code: number) => {
      if (child.exitCode !== null) return;
      child.exitCode = code;
      child.connected = false;
      child.emit("exit", code, null);
    };
    child.kill = () => {
      killCount += 1;
      if (
        scenario !== "acquire_timeout_unconfirmed" &&
        scenario !== "ready_duplicate_unconfirmed"
      )
        queueMicrotask(() => exit(1));
      return true;
    };
    child.send = (message) => {
      if (message === "confirm-ready") {
        if (scenario === "ready_malformed")
          queueMicrotask(() => child.emit("message", { status: "wrong" }));
        else if (scenario === "ready_exit") queueMicrotask(() => exit(1));
        else if (scenario === "ready_then_exit")
          queueMicrotask(() => {
            child.emit("message", { status: "ready" });
            queueMicrotask(() => exit(1));
          });
        else if (
          scenario === "ready_duplicate" ||
          scenario === "ready_duplicate_unconfirmed"
        )
          queueMicrotask(() => {
            child.emit("message", { status: "ready" });
            queueMicrotask(() => child.emit("message", { status: "ready" }));
          });
        else queueMicrotask(() => child.emit("message", { status: "ready" }));
      } else if (message === "release") {
        queueMicrotask(() =>
          child.emit("message", { status: "release-ready" }),
        );
      } else if (message === "confirm-release") {
        if (scenario === "released_without_exit")
          queueMicrotask(() => child.emit("message", { status: "released" }));
        else if (scenario === "exit_without_released")
          queueMicrotask(() => exit(0));
        else if (scenario === "release_nonzero_exit")
          queueMicrotask(() => {
            child.emit("message", { status: "released" });
            exit(1);
          });
        else
          queueMicrotask(() => {
            child.emit("message", { status: "released" });
            exit(0);
          });
      }
      return true;
    };
    if (!scenario.startsWith("acquire_timeout"))
      queueMicrotask(() => {
        child.emit("message", { status: "acquired" });
        if (scenario === "acquired_disconnect_alive")
          queueMicrotask(() => {
            child.connected = false;
            child.emit("disconnect");
          });
      });
    return child as unknown as ReturnType<typeof spawn>;
  };
  return Object.freeze({
    factory,
    captured: () => captured,
    killCount: () => killCount,
  });
}

/**
 * interactiveLockWorkerScenarioのTest準備責務を実行する。
 *
 * @responsibility interactiveLockWorkerScenarioがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus interactiveLockWorkerScenarioを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
function interactiveLockWorkerScenario(initialState: 1 | -1) {
  const listeners = new Map<string, (value: unknown) => void>();
  return Object.freeze({
    factory: (_pipeName: string, sharedState: SharedArrayBuffer) => {
      const state = new Int32Array(sharedState);
      Atomics.store(state, 0, initialState);
      Atomics.notify(state, 0);
      return Object.freeze({
        unref: () => undefined,
        postMessage: () => {
          Atomics.store(state, 0, 2);
          Atomics.notify(state, 0);
          queueMicrotask(() => listeners.get("exit")?.(0));
        },
        terminate: async () => {
          queueMicrotask(() => listeners.get("exit")?.(0));
          return 0;
        },
        once: (event: "error" | "exit", listener: (value: never) => void) => {
          listeners.set(event, listener as (value: unknown) => void);
        },
      });
    },
  });
}

/**
 * verifyDelayedLockWorkerInChildのTest準備責務を実行する。
 *
 * @responsibility verifyDelayedLockWorkerInChildがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus verifyDelayedLockWorkerInChildを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
async function verifyDelayedLockWorkerInChild(
  moduleUrl: string,
  workerUrl: string,
  protectionHash: string,
) {
  const assert: typeof import("node:assert/strict") = (
    await import("node:assert/strict")
  ).default;
  const { default: workerThreads } = await import("node:worker_threads");
  const { syncBuiltinESMExports } = await import("node:module");
  const nativeWorker = workerThreads.Worker;
  const startupGate = new SharedArrayBuffer(8);
  const gate = new Int32Array(startupGate);
  const events: string[] = [];
  let ownedWorker: InstanceType<typeof nativeWorker> | null = null;
  let lockState: Int32Array | null = null;
  let constructionCount = 0;
  let terminationCount = 0;
  let hasExited = false;
  let hasTerminationCompleted = false;
  let terminationCompletion: Promise<number> | null = null;
  let resolveExit!: (code: number) => void;
  const exit = new Promise<number>((resolve) => {
    resolveExit = resolve;
  });
  const preload = `import { workerData } from "node:worker_threads";
    const gate = new Int32Array(workerData.startupGate);
    Atomics.store(gate, 0, 1);
    Atomics.wait(gate, 1, 0, 15000);
    Atomics.store(gate, 0, 2);`;
  class DelayedLockWorker extends nativeWorker {
    constructor(
      filename: string | URL,
      options: import("node:worker_threads").WorkerOptions,
    ) {
      assert.ok(filename instanceof URL);
      assert.equal(filename.href, workerUrl);
      assert.deepEqual(options.env, {});
      assert.equal(options.execArgv, undefined);
      const workerPayload = options.workerData as Readonly<{
        pipeName: string;
        state: SharedArrayBuffer;
      }>;
      assert.ok(workerPayload.state instanceof SharedArrayBuffer);
      assert.equal(typeof workerPayload.pipeName, "string");
      super(filename, {
        ...options,
        workerData: { ...workerPayload, startupGate },
        execArgv: [
          "--import",
          `data:text/javascript,${encodeURIComponent(preload)}`,
        ],
      });
      constructionCount += 1;
      assert.ok(this.threadId > 0);
      ownedWorker = this;
      lockState = new Int32Array(workerPayload.state);
      this.once("exit", (code) => {
        hasExited = true;
        events.push("worker-exit");
        resolveExit(code);
      });
    }
    override terminate() {
      terminationCount += 1;
      events.push("termination-request");
      terminationCompletion = super.terminate().then((code) => {
        hasTerminationCompleted = true;
        events.push("termination-completed");
        return code;
      });
      return terminationCompletion;
    }
  }
  try {
    Reflect.set(workerThreads, "Worker", DelayedLockWorker);
    syncBuiltinESMExports();
    const runtime = await import(moduleUrl);
    const startedAt = Date.now();
    const lock = runtime.acquireNamedPipeKernelLock(protectionHash);
    events.push("acquire-returned");
    assert.equal(lock, null);
    assert.equal(constructionCount, 1);
    assert.equal(terminationCount, 1);
    assert.ok(Date.now() - startedAt >= 5000);
    assert.equal(Atomics.load(gate, 0), 1);
    const observedState = lockState as Int32Array | null;
    assert.ok(observedState);
    assert.equal(Atomics.load(observedState, 0), 0);
    assert.equal(hasExited, false);
    assert.equal(hasTerminationCompleted, false);
    Reflect.set(workerThreads, "Worker", nativeWorker);
    syncBuiltinESMExports();
    const exitCode = await exit;
    assert.equal(await terminationCompletion, exitCode);
    assert.equal(hasExited, true);
    assert.equal(hasTerminationCompleted, true);
    const terminatedWorker = ownedWorker as InstanceType<
      typeof nativeWorker
    > | null;
    assert.ok(terminatedWorker);
    assert.equal(terminatedWorker.threadId, -1);
    assert.equal(Atomics.load(gate, 0), 1);
    assert.equal(Atomics.load(observedState, 0), 0);
    const reacquired = runtime.acquireNamedPipeKernelLock(protectionHash);
    assert.ok(reacquired);
    assert.equal(reacquired.release(), true);
    assert.equal(constructionCount, 1);
    events.push("reacquired-and-released");
    process.stdout.write(
      `${JSON.stringify({ events, terminationCount, delayedAcquisitionObserved: false })}\n`,
    );
  } finally {
    Reflect.set(workerThreads, "Worker", nativeWorker);
    syncBuiltinESMExports();
    const worker = ownedWorker as InstanceType<typeof nativeWorker> | null;
    if (worker && !hasExited)
      await nativeWorker.prototype.terminate.call(worker);
  }
}

/**
 * 固定Supervisor: 三段階のsend同期例外は終了失敗と失効へ収束するを検証する。
 *
 * @responsibility 固定Supervisor: 三段階のsend同期例外は終了失敗と失効へ収束するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定Supervisor: 三段階のsend同期例外は終了失敗と失効へ収束するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
test("固定Supervisor: 三段階のsend同期例外は終了失敗と失効へ収束する", {
  skip: process.platform !== "win32",
}, async () => {
  for (const failedMessage of ["confirm-ready", "release", "confirm-release"]) {
    const scenario = supervisorChildScenario("normal");
    const supervisorChildren: ReturnType<typeof spawn>[] = [];
    const messages: unknown[] = [];
    const outcome = await acquireHostOperationSupervisorLockUsingChildFactory(
      "crdd-coordinator-doctor-SENDTHROW",
      "b".repeat(32),
      (pipeName, environment) => {
        const child = scenario.factory(pipeName, environment);
        supervisorChildren.push(child);
        const send = child.send.bind(child);
        child.send = ((message: unknown) => {
          messages.push(message);
          if (message === failedMessage) throw new Error("fixture_send_failed");
          return send(message as string);
        }) as typeof child.send;
        return child;
      },
      FAST_SUPERVISOR_TIMING,
    );
    assert.equal(outcome.status, "acquired");
    assert.ok(outcome.lock);
    let failureNotifications = 0;
    outcome.lock.onFailureDetected(() => {
      failureNotifications += 1;
    });
    if (failedMessage === "confirm-ready") {
      assert.equal(
        await outcome.lock.confirmReady(),
        "cleanup_confirmed_failure",
      );
    } else {
      assert.equal(await outcome.lock.confirmReady(), "ready");
      assert.equal(await outcome.lock.release(), "cleanup_confirmed_failure");
    }
    await outcome.lock.failureDetected;
    assert.equal(await outcome.lock.loss, "cleanup_confirmed_failure");
    assert.equal(outcome.lock.assertLive(), false);
    assert.equal(await outcome.lock.release(), "cleanup_confirmed_failure");
    assert.equal(failureNotifications, 1);
    assert.equal(scenario.killCount(), 1);
    assert.deepEqual(
      messages,
      ["confirm-ready", "release", "confirm-release"].slice(
        0,
        ["confirm-ready", "release", "confirm-release"].indexOf(failedMessage) +
          1,
      ),
    );
    assert.equal(supervisorChildren.length, 1);
    assert.deepEqual(supervisorChildren[0]?.eventNames(), []);
  }
});

/**
 * 固定Supervisor: 失敗listenerの例外は他の通知・終了・失効を妨げないを検証する。
 *
 * @responsibility 固定Supervisor: 失敗listenerの例外は他の通知・終了・失効を妨げないの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定Supervisor: 失敗listenerの例外は他の通知・終了・失効を妨げないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
test("固定Supervisor: 失敗listenerの例外は他の通知・終了・失効を妨げない", {
  skip: process.platform !== "win32",
}, async () => {
  const scenario = supervisorChildScenario("normal");
  const supervisorChildren: ReturnType<typeof spawn>[] = [];
  const outcome = await acquireHostOperationSupervisorLockUsingChildFactory(
    "crdd-coordinator-doctor-LISTENER",
    "c".repeat(32),
    (pipeName, environment) => {
      const child = scenario.factory(pipeName, environment);
      supervisorChildren.push(child);
      return child;
    },
    FAST_SUPERVISOR_TIMING,
  );
  assert.equal(outcome.status, "acquired");
  assert.ok(outcome.lock);
  assert.equal(await outcome.lock.confirmReady(), "ready");
  const notifications: string[] = [];
  outcome.lock.onFailureDetected(() => {
    notifications.push("throwing");
    throw new Error("fixture_listener_failed");
  });
  outcome.lock.onFailureDetected(() => {
    notifications.push("following");
  });
  const unsubscribe = outcome.lock.onFailureDetected(() => {
    notifications.push("removed");
  });
  unsubscribe();
  const child = supervisorChildren[0];
  assert.ok(child);
  assert.doesNotThrow(() =>
    child.emit("error", new Error("fixture_supervisor_failed")),
  );
  await outcome.lock.failureDetected;
  assert.deepEqual(notifications, ["throwing", "following"]);
  assert.equal(await outcome.lock.loss, "cleanup_confirmed_failure");
  assert.equal(outcome.lock.assertLive(), false);
  assert.equal(await outcome.lock.confirmReady(), "cleanup_confirmed_failure");
  assert.equal(await outcome.lock.release(), "cleanup_confirmed_failure");
  assert.equal(scenario.killCount(), 1);
  assert.deepEqual(child.eventNames(), []);
  child.emit("message", { status: "ready" });
  assert.deepEqual(notifications, ["throwing", "following"]);
});

/**
 * 追加境界: 対話Workerの失敗と遅延終了を解放成功へ変換しないを検証する。
 *
 * @responsibility 追加境界: 対話Workerの失敗と遅延終了を解放成功へ変換しないの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 追加境界: 対話Workerの失敗と遅延終了を解放成功へ変換しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
test("追加境界: 対話Workerの失敗と遅延終了を解放成功へ変換しない", {
  skip: process.platform !== "win32",
}, async (t) => {
  const keepAlive = setInterval(() => undefined, 5_000);
  t.after(() => clearInterval(keepAlive));
  assert.deepEqual(
    await acquireInteractiveConsoleKernelLockOutcomeUsingFactory(() => {
      throw new Error("fixture_factory_failed");
    }),
    { status: "cleanup_unknown", lock: null },
  );
  for (const scenario of [
    "post-throw",
    "wrong-state",
    "error-exit",
    "termination-reject",
    "late-termination",
    "normal",
  ] as const) {
    const worker = new EventEmitter();
    let terminationCount = 0;
    let postCount = 0;
    let resolveLate!: () => void;
    const lateCompleted = new Promise<void>((resolve) => {
      resolveLate = resolve;
    });
    const outcome =
      await acquireInteractiveConsoleKernelLockOutcomeUsingFactory(
        (_pipeName, sharedState) => {
          const state = new Int32Array(sharedState);
          Atomics.store(
            state,
            0,
            scenario === "termination-reject" || scenario === "late-termination"
              ? -1
              : 1,
          );
          return {
            unref: () => undefined,
            once: (event, listener) => worker.once(event, listener),
            postMessage: () => {
              postCount += 1;
              if (scenario === "post-throw")
                throw new Error("fixture_post_failed");
              Atomics.store(state, 0, scenario === "wrong-state" ? 3 : 2);
              queueMicrotask(() => {
                if (scenario === "error-exit")
                  worker.emit("error", new Error("fixture_worker_error"));
                worker.emit("exit", 0);
              });
            },
            terminate: () => {
              terminationCount += 1;
              if (scenario === "late-termination")
                return new Promise<number>((resolve) =>
                  setTimeout(() => {
                    resolve(0);
                    worker.emit("exit", 0);
                    resolveLate();
                  }, 1_100),
                );
              queueMicrotask(() => worker.emit("exit", 0));
              return scenario === "termination-reject"
                ? Promise.reject(new Error("fixture_termination_rejected"))
                : Promise.resolve(0);
            },
          };
        },
      );
    if (scenario === "termination-reject" || scenario === "late-termination") {
      assert.deepEqual(outcome, { status: "cleanup_unknown", lock: null });
      assert.equal(terminationCount, 1);
      assert.equal(postCount, 0);
      if (scenario === "late-termination") await lateCompleted;
    } else {
      assert.equal(outcome.status, "acquired");
      assert.ok(outcome.lock);
      assert.equal(
        await outcome.lock.release(),
        scenario === "normal" ? "released" : "cleanup_unknown",
      );
      assert.equal(await outcome.lock.release(), "cleanup_unknown");
      assert.equal(postCount, 1);
      assert.equal(
        terminationCount,
        scenario === "post-throw" || scenario === "wrong-state" ? 1 : 0,
      );
    }
  }
});

/**
 * 追加境界: Supervisorのspawnと終了要求失敗を資源取得前後で分けるを検証する。
 *
 * @responsibility 追加境界: Supervisorのspawnと終了要求失敗を資源取得前後で分けるの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 追加境界: Supervisorのspawnと終了要求失敗を資源取得前後で分けるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
test("追加境界: Supervisorのspawnと終了要求失敗を資源取得前後で分ける", {
  skip: process.platform !== "win32",
}, async (t) => {
  const keepAlive = setInterval(() => undefined, 5_000);
  t.after(() => clearInterval(keepAlive));
  const rootName = "crdd-coordinator-doctor-SPAWNFAIL";
  const nonce = "b".repeat(32);
  assert.deepEqual(
    await acquireHostOperationSupervisorLockUsingChildFactory(
      rootName,
      nonce,
      () => {
        throw new Error("fixture_spawn_failed");
      },
      FAST_SUPERVISOR_TIMING,
    ),
    { status: "cleanup_confirmed_failure", lock: null },
  );
  const scenario = supervisorChildScenario("normal");
  let supervisorChild: ReturnType<typeof spawn> | null = null;
  let killCount = 0;
  const outcome = await acquireHostOperationSupervisorLockUsingChildFactory(
    rootName,
    nonce,
    (pipeName, environment) => {
      supervisorChild = scenario.factory(pipeName, environment);
      supervisorChild.kill = () => {
        killCount += 1;
        throw new Error("fixture_kill_failed");
      };
      return supervisorChild;
    },
    FAST_SUPERVISOR_TIMING,
  );
  assert.ok(outcome.lock);
  const child = supervisorChild as ReturnType<typeof spawn> | null;
  assert.ok(child);
  child.emit("error", new Error("fixture_supervisor_error"));
  assert.equal(await outcome.lock.loss, "cleanup_unknown");
  assert.equal(await outcome.lock.confirmReady(), "cleanup_unknown");
  assert.equal(await outcome.lock.release(), "cleanup_unknown");
  assert.equal(outcome.lock.assertLive(), false);
  let notificationCount = 0;
  const unsubscribe = outcome.lock.onFailureDetected(() => {
    notificationCount += 1;
  });
  assert.equal(notificationCount, 1);
  unsubscribe();
  assert.equal(killCount, 1);
  assert.deepEqual(child.eventNames(), []);
  // 模擬子の終了は未確認のまま。監視解除後の終了通知で成功へ変えない。
  child.emit("exit", 1, null);
  assert.equal(await outcome.lock.release(), "cleanup_unknown");
});

/**
 * 追加境界: SupervisorはIPC形状違反と終了中競合を単一の失敗へ収束するを検証する。
 *
 * @responsibility 追加境界: SupervisorはIPC形状違反と終了中競合を単一の失敗へ収束するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 追加境界: SupervisorはIPC形状違反と終了中競合を単一の失敗へ収束するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
test("追加境界: SupervisorはIPC形状違反と終了中競合を単一の失敗へ収束する", {
  skip: process.platform !== "win32",
}, async (t) => {
  const keepAlive = setInterval(() => undefined, 5_000);
  t.after(() => clearInterval(keepAlive));
  for (const failure of [
    "null",
    "array",
    "extra",
    "release-exit",
    "release-timeout",
    "release-concurrent",
    "ready-disconnect",
    "release-ready-exit",
  ] as const) {
    const scenario = supervisorChildScenario("normal");
    let supervisorChild: ReturnType<typeof spawn> | null = null;
    const messages: unknown[] = [];
    const outcome = await acquireHostOperationSupervisorLockUsingChildFactory(
      "crdd-coordinator-doctor-BOUNDARY",
      "c".repeat(32),
      (pipeName, environment) => {
        const child = scenario.factory(pipeName, environment);
        supervisorChild = child;
        const send = child.send.bind(child);
        child.send = ((message: unknown) => {
          messages.push(message);
          if (message === "confirm-ready" && failure === "ready-disconnect") {
            queueMicrotask(() => {
              child.emit("message", { status: "ready" });
              Reflect.set(child, "connected", false);
              child.emit("disconnect");
            });
          } else if (message === "release") {
            if (
              failure === "release-timeout" ||
              failure === "release-concurrent"
            )
              return true;
            queueMicrotask(() => {
              if (
                failure === "release-exit" ||
                failure === "release-ready-exit"
              ) {
                if (failure === "release-ready-exit")
                  child.emit("message", { status: "release-ready" });
                Reflect.set(child, "exitCode", 1);
                Reflect.set(child, "connected", false);
                child.emit("exit", 1, null);
              } else
                child.emit(
                  "message",
                  failure === "null"
                    ? null
                    : failure === "array"
                      ? []
                      : { status: "release-ready", extra: true },
                );
            });
          } else return send(message as string);
          return true;
        }) as typeof child.send;
        return child;
      },
      FAST_SUPERVISOR_TIMING,
    );
    assert.ok(outcome.lock);
    const ready = await outcome.lock.confirmReady();
    if (failure === "ready-disconnect")
      assert.equal(ready, "cleanup_confirmed_failure");
    else {
      assert.equal(ready, "ready");
      const first = outcome.lock.release();
      if (failure === "release-concurrent") {
        const second = outcome.lock.release();
        const third = outcome.lock.release();
        assert.deepEqual(await Promise.all([first, second, third]), [
          "cleanup_confirmed_failure",
          "cleanup_confirmed_failure",
          "cleanup_confirmed_failure",
        ]);
      } else assert.equal(await first, "cleanup_confirmed_failure");
    }
    assert.equal(await outcome.lock.loss, "cleanup_confirmed_failure");
    assert.equal(outcome.lock.assertLive(), false);
    assert.equal(await outcome.lock.release(), "cleanup_confirmed_failure");
    assert.equal(
      scenario.killCount(),
      failure === "release-exit" || failure === "release-ready-exit" ? 0 : 1,
    );
    const child = supervisorChild as ReturnType<typeof spawn> | null;
    assert.ok(child);
    assert.deepEqual(child.eventNames(), []);
    if (failure !== "release-ready-exit")
      assert.equal(messages.includes("confirm-release"), false);
  }
});

/**
 * 同期Lock取得timeoutは本番Worker終了後に遅延取得を残さず再取得できるを検証する。
 *
 * @responsibility 同期Lock取得timeoutは本番Worker終了後に遅延取得を残さず再取得できるの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 同期Lock取得timeoutは本番Worker終了後に遅延取得を残さず再取得できるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
test("同期Lock取得timeoutは本番Worker終了後に遅延取得を残さず再取得できる", {
  skip: process.platform !== "win32",
  timeout: 30_000,
}, async (t) => {
  const moduleUrl = new URL("../../src/index.ts", import.meta.url).href;
  const workerUrl = new URL("../../src/lock/worker.ts", import.meta.url).href;
  const protectionHash = `\\\\.\\pipe\\CRDD.Coordinator.CurrentState.${randomBytes(16).toString("hex")}`;
  const invocation = `(${verifyDelayedLockWorkerInChild.toString()})(${JSON.stringify(moduleUrl)}, ${JSON.stringify(workerUrl)}, ${JSON.stringify(protectionHash)}).catch(error => { console.error(error); process.exitCode = 1; });`;
  const scratchRoot = fileURLToPath(
    new URL("../../../../.crdd/tests/kernel-lock/", import.meta.url),
  );
  const child = spawn(process.execPath, ["--eval", invocation], {
    env: { TEMP: scratchRoot, TMP: scratchRoot },
    cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    windowsHide: true,
    timeout: 25_000,
  });
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  });
  const stdoutItems: Buffer[] = [];
  const stderrItems: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) =>
    stdoutItems.push(Buffer.from(chunk)),
  );
  child.stderr.on("data", (chunk: Buffer) =>
    stderrItems.push(Buffer.from(chunk)),
  );
  const [code, signal] = await once(child, "close");
  assert.equal(signal, null);
  assert.equal(code, 0, Buffer.concat(stderrItems).toString("utf8"));
  assert.deepEqual(JSON.parse(Buffer.concat(stdoutItems).toString("utf8")), {
    events: [
      "termination-request",
      "acquire-returned",
      "worker-exit",
      "termination-completed",
      "reacquired-and-released",
    ],
    terminationCount: 1,
    delayedAcquisitionObserved: false,
  });
});

/**
 * Host Operation Supervisorは固定入力と異常状態を構造化するを検証する。
 *
 * @responsibility Host Operation Supervisorは固定入力と異常状態を構造化するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host Operation Supervisorは固定入力と異常状態を構造化するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
test("Host Operation Supervisorは固定入力と異常状態を構造化する", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const rootName = "crdd-coordinator-doctor-SCENARIO";
  const nonce = "aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff";
  const normal = supervisorChildScenario("normal");
  const acquired = await acquireHostOperationSupervisorLockUsingChildFactory(
    rootName,
    nonce,
    normal.factory,
    FAST_SUPERVISOR_TIMING,
  );
  assert.equal(acquired.status, "acquired");
  assert.ok(acquired.lock);
  assert.equal(await acquired.lock.confirmReady(), "ready");
  assert.equal(await acquired.lock.release(), "released");
  const childInput = normal.captured();
  assert.ok(childInput);
  assert.equal(childInput.pipeName.startsWith("\\\\.\\pipe\\"), true);
  const environment = childInput.environment as Record<string, string>;
  for (const name of [
    "PATH",
    "HOME",
    "USERPROFILE",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "GIT_ASKPASS",
    "NODE_OPTIONS",
    "NODE_PATH",
    "NODE_V8_COVERAGE",
  ])
    assert.equal(environment[name], "");
  assert.equal(typeof environment.SystemRoot, "string");
  assert.equal(environment.WINDIR, environment.SystemRoot);

  for (const scenario of ["ready_malformed", "ready_exit"] as const) {
    const candidate = supervisorChildScenario(scenario);
    const outcome = await acquireHostOperationSupervisorLockUsingChildFactory(
      rootName,
      `${nonce.slice(0, -1)}${scenario === "ready_malformed" ? "1" : "2"}`,
      candidate.factory,
      FAST_SUPERVISOR_TIMING,
    );
    assert.equal(outcome.status, "acquired");
    assert.ok(outcome.lock);
    assert.equal(
      await outcome.lock.confirmReady(),
      "cleanup_confirmed_failure",
    );
  }

  for (const scenario of [
    "released_without_exit",
    "exit_without_released",
    "release_nonzero_exit",
  ] as const) {
    const candidate = supervisorChildScenario(scenario);
    const outcome = await acquireHostOperationSupervisorLockUsingChildFactory(
      rootName,
      `${nonce.slice(0, -1)}${scenario.length % 10}`,
      candidate.factory,
      FAST_SUPERVISOR_TIMING,
    );
    assert.equal(outcome.status, "acquired");
    assert.ok(outcome.lock);
    assert.equal(await outcome.lock.release(), "cleanup_confirmed_failure");
  }
});

/**
 * Host Operation Supervisorはterminate未確認だけをcleanup不明にするを検証する。
 *
 * @responsibility Host Operation Supervisorはterminate未確認だけをcleanup不明にするの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host Operation Supervisorはterminate未確認だけをcleanup不明にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
test("Host Operation Supervisorはterminate未確認だけをcleanup不明にする", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const rootName = "crdd-coordinator-doctor-TIMEOUT";
  const nonce = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
  const terminated = supervisorChildScenario("acquire_timeout_terminated");
  assert.equal(
    (
      await acquireHostOperationSupervisorLockUsingChildFactory(
        rootName,
        nonce,
        terminated.factory,
        FAST_SUPERVISOR_TIMING,
      )
    ).status,
    "cleanup_confirmed_failure",
  );
  const unconfirmed = supervisorChildScenario("acquire_timeout_unconfirmed");
  const unknown = await acquireHostOperationSupervisorLockUsingChildFactory(
    rootName,
    `${nonce.slice(0, -1)}1`,
    unconfirmed.factory,
    FAST_SUPERVISOR_TIMING,
  );
  assert.equal(unknown.status, "cleanup_unknown");
  assert.ok(unknown.lock);
  assert.equal(await unknown.lock.release(), "cleanup_unknown");
});

/**
 * Host Operation Supervisorの非同期喪失と複合通知は単一finalizerへ収束するを検証する。
 *
 * @responsibility Host Operation Supervisorの非同期喪失と複合通知は単一finalizerへ収束するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host Operation Supervisorの非同期喪失と複合通知は単一finalizerへ収束するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
test("Host Operation Supervisorの非同期喪失と複合通知は単一finalizerへ収束する", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const rootName = "crdd-coordinator-doctor-LIVENESS";
  const nonce = "cccccccc-dddd-4eee-8fff-ffffffffffff";
  const scenarios = [
    "acquired_disconnect_alive",
    "ready_then_exit",
    "ready_duplicate",
  ] as const;
  for (const [index, scenario] of scenarios.entries()) {
    const candidate = supervisorChildScenario(scenario);
    const outcome = await acquireHostOperationSupervisorLockUsingChildFactory(
      rootName,
      `${nonce.slice(0, -1)}${index}`,
      candidate.factory,
      FAST_SUPERVISOR_TIMING,
    );
    assert.equal(outcome.status, "acquired");
    assert.ok(outcome.lock);
    const readiness = await outcome.lock.confirmReady();
    if (scenario === "acquired_disconnect_alive")
      assert.equal(readiness, "cleanup_confirmed_failure");
    else assert.equal(readiness, "ready");
    assert.equal(await outcome.lock.loss, "cleanup_confirmed_failure");
    assert.equal(outcome.lock.assertLive(), false);
    assert.equal(await outcome.lock.release(), "cleanup_confirmed_failure");
    if (scenario === "ready_then_exit") assert.equal(candidate.killCount(), 0);
    else assert.equal(candidate.killCount(), 1);
  }
});

/**
 * Host Operation Supervisorのcleanup不明は遅延通知で降格せずexactly onceを保つを検証する。
 *
 * @responsibility Host Operation Supervisorのcleanup不明は遅延通知で降格せずexactly onceを保つの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host Operation Supervisorのcleanup不明は遅延通知で降格せずexactly onceを保つの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
test("Host Operation Supervisorのcleanup不明は遅延通知で降格せずexactly onceを保つ", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const candidate = supervisorChildScenario("ready_duplicate_unconfirmed");
  const outcome = await acquireHostOperationSupervisorLockUsingChildFactory(
    "crdd-coordinator-doctor-UNKNOWN",
    "dddddddd-eeee-4fff-8aaa-ffffffffffff",
    candidate.factory,
    FAST_SUPERVISOR_TIMING,
  );
  assert.equal(outcome.status, "acquired");
  assert.ok(outcome.lock);
  assert.equal(await outcome.lock.confirmReady(), "ready");
  assert.equal(await outcome.lock.loss, "cleanup_unknown");
  assert.equal(await outcome.lock.release(), "cleanup_unknown");
  assert.equal(await outcome.lock.release(), "cleanup_unknown");
  assert.equal(candidate.killCount(), 1);
});

/**
 * Host Operation Supervisor entrypointはexact argvとIPCなしでlistenしないを検証する。
 *
 * @responsibility Host Operation Supervisor entrypointはexact argvとIPCなしでlistenしないの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host Operation Supervisor entrypointはexact argvとIPCなしでlistenしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
test("Host Operation Supervisor entrypointはexact argvとIPCなしでlistenしない", () => {
  const entrypoint = fileURLToPath(
    new URL("../../src/lock/supervisor.ts", import.meta.url),
  );
  const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.HostOperation.${"a".repeat(32)}`;
  for (const args of [
    [entrypoint, pipeName],
    [entrypoint, pipeName, "extra"],
  ]) {
    const result = spawnSync(process.execPath, args, {
      env: {},
      shell: false,
      windowsHide: true,
      encoding: "utf8",
      timeout: 5_000,
    });
    assert.equal(result.status, 64);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  }
});

/**
 * Host Operation Supervisor entrypointはclosing中の親command違反をnonzeroへ単調化するを検証する。
 *
 * @responsibility Host Operation Supervisor entrypointはclosing中の親command違反をnonzeroへ単調化するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host Operation Supervisor entrypointはclosing中の親command違反をnonzeroへ単調化するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
test("Host Operation Supervisor entrypointはclosing中の親command違反をnonzeroへ単調化する", async () => {
  const entrypoint = fileURLToPath(
    new URL("../../src/lock/supervisor.ts", import.meta.url),
  );
  for (const [index, secondCommand] of ["release", "confirm-ready"].entries()) {
    const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.HostOperation.${index.toString(16).padStart(32, "a")}`;
    const child = spawn(process.execPath, [entrypoint, pipeName], {
      env: {},
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    const messages: unknown[] = [];
    child.on("message", (message) => {
      messages.push(message);
      if ((message as { status?: unknown })?.status === "acquired") {
        child.send("release");
        child.send(secondCommand);
      }
    });
    const [exitCode] = (await once(child, "exit")) as [number | null];
    assert.notEqual(exitCode, 0);
    assert.equal(
      messages.some(
        (message) => (message as { status?: unknown })?.status === "released",
      ),
      false,
    );
  }
});

/**
 * Host Operation Supervisor entrypointはconfirm-release後の違反を成功へ戻さないを検証する。
 *
 * @responsibility Host Operation Supervisor entrypointはconfirm-release後の違反を成功へ戻さないの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host Operation Supervisor entrypointはconfirm-release後の違反を成功へ戻さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
test("Host Operation Supervisor entrypointはconfirm-release後の違反を成功へ戻さない", async () => {
  const entrypoint = fileURLToPath(
    new URL("../../src/lock/supervisor.ts", import.meta.url),
  );
  const violations = [
    "confirm-release",
    "release",
    "confirm-ready",
    Object.freeze({ command: "unknown" }),
  ] as const;
  for (const [index, violation] of violations.entries()) {
    const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.HostOperation.${(index + 16).toString(16).padStart(32, "b")}`;
    const child = spawn(process.execPath, [entrypoint, pipeName], {
      env: {},
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    const messages: unknown[] = [];
    child.on("message", (message) => {
      messages.push(message);
      const status = (message as { status?: unknown })?.status;
      if (status === "acquired") child.send("release");
      if (status === "release-ready") {
        child.send("confirm-release");
        child.send(violation);
      }
    });
    const [exitCode] = (await once(child, "exit")) as [number | null];
    assert.notEqual(exitCode, 0);
    assert.equal(
      messages.some(
        (message) => (message as { status?: unknown })?.status === "released",
      ),
      false,
    );
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(pipeName, resolve);
    });
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

/**
 * Host Operation Supervisor entrypointはconfirm-release直後の親disconnectを成功にしないを検証する。
 *
 * @responsibility Host Operation Supervisor entrypointはconfirm-release直後の親disconnectを成功にしないの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host Operation Supervisor entrypointはconfirm-release直後の親disconnectを成功にしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
test("Host Operation Supervisor entrypointはconfirm-release直後の親disconnectを成功にしない", async () => {
  const entrypoint = fileURLToPath(
    new URL("../../src/lock/supervisor.ts", import.meta.url),
  );
  const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.HostOperation.${"c".repeat(32)}`;
  const child = spawn(process.execPath, [entrypoint, pipeName], {
    env: {},
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  const messages: unknown[] = [];
  child.on("message", (message) => {
    messages.push(message);
    const status = (message as { status?: unknown })?.status;
    if (status === "acquired") child.send("release");
    if (status === "release-ready") {
      child.send("confirm-release");
      child.disconnect();
    }
  });
  const [exitCode] = (await once(child, "exit")) as [number | null];
  assert.notEqual(exitCode, 0);
  assert.equal(
    messages.some(
      (message) => (message as { status?: unknown })?.status === "released",
    ),
    false,
  );
});

/**
 * 対話Console専用lockは終了確認済み非取得とcleanup不明を分離するを検証する。
 *
 * @responsibility 対話Console専用lockは終了確認済み非取得とcleanup不明を分離するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 対話Console専用lockは終了確認済み非取得とcleanup不明を分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: PA内の技術lifecycleと自己所有試験資源
 */
test("対話Console専用lockは終了確認済み非取得とcleanup不明を分離する", async () => {
  if (process.platform !== "win32") return;
  const unavailable =
    await acquireInteractiveConsoleKernelLockOutcomeUsingFactory(
      interactiveLockWorkerScenario(-1).factory,
    );
  assert.deepEqual(unavailable, { status: "unavailable", lock: null });

  const acquired = await acquireInteractiveConsoleKernelLockOutcomeUsingFactory(
    interactiveLockWorkerScenario(1).factory,
  );
  assert.equal(acquired.status, "acquired");
  assert.ok(acquired.lock);
  assert.equal(await acquired.lock.release(), "released");

  const timedOut = await acquireInteractiveConsoleKernelLockOutcomeUsingFactory(
    () =>
      Object.freeze({
        unref: () => undefined,
        postMessage: () => undefined,
        terminate: async () => 0,
        once: () => undefined,
      }),
  );
  assert.deepEqual(timedOut, { status: "cleanup_unknown", lock: null });
});

/**
 * 受理された境界待機値でもready・releaseの技術契約を維持する。
 * @responsibility 元の受理範囲と往復・終了Oracleを保持する。
 * @trace ERB-IT-003
 * @precondition 合成Supervisorと固定Pipe試験vector。
 * @stimulus 最小・最大待機値で取得、ready、releaseを行う。
 * @observation 取得状態、captured、kill回数と終了。
 * @oracle 受理され、往復後にreleased、killなし。
 * @cleanup 合成子を終了状態へ収束する。
 * @boundary ERB-IT-003=Direct Boundary: PAの合成Supervisor。
 */
test("Supervisorは受理した境界待機値でreadyとreleaseを維持する", async () => {
  for (const [
    suffixLength,
    nonceLength,
    acquireTimeoutMs,
    releaseTimeoutMs,
  ] of [
    [6, 32, 1, 1],
    [64, 48, 1000, 5000],
  ] as const) {
    const scenario = supervisorChildScenario("normal");
    const outcome = await acquireHostOperationSupervisorLockUsingChildFactory(
      `crdd-coordinator-doctor-${"a".repeat(suffixLength)}`,
      "a".repeat(nonceLength),
      scenario.factory,
      { acquireTimeoutMs, releaseTimeoutMs },
    );
    assert.equal(outcome.status, "acquired");
    assert.ok(outcome.lock);
    assert.ok(scenario.captured());
    assert.equal(await outcome.lock.confirmReady(), "ready");
    assert.equal(await outcome.lock.release(), "released");
    assert.equal(scenario.killCount(), 0);
  }
});
