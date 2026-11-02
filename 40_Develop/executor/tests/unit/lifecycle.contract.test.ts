/**
 * 共通Lifecycleの実行・清掃・結果の順序を有限操作で確認する。
 * @responsibility 一次失敗・清掃待機・取消と認証の終了不明を反証する。
 * @trace ERB-IT-004
 * @level UT
 * @scope メモリ内の操作だけ。実AI・Docker・保存を使わない。
 * @boundary 技術生涯と上位の保存・Home解放。
 */
import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import test from "node:test";
import {
  bindAuthenticationLifecycle,
  type Authentication,
} from "../../scripts/authentication-command-test.ts";
import type { AuthenticationResult } from "../../src/authentication/types.ts";
import {
  createExecutor,
  restartDockerEnvironment,
  type ExecutorRequest,
  type StartResult,
  type RecordProjection,
  type CancelArguments,
  type AttemptCancelInput,
  type DockerEnvironmentRestartRequest,
  type CompletionResult,
  type Executor,
  type ExecutorCallbacks,
  type StartInput,
} from "../../src/index.ts";
import type {
  DockerIsolationRuntimeOptions,
  DockerRuntimeRepairInput,
  DockerRuntimeRepairResult,
  DockerRuntimeRestartInput,
} from "../../../docker-isolation/src/index.ts";
import { executeLifecycle } from "../../src/lifecycle/execute.ts";
import { createLifecycleOperations } from "../../src/lifecycle/operations.ts";

/**
 * 無指定の公開型を全用途Unionとし、用途確定後の入出力を照合する。
 * @responsibility 未絞込みの実行、空のAttempt取消、架空のProbe投影を型で拒否する。
 * @trace ERB-IT-004
 * @precondition 本体の公開型と所有元の環境型をTypeScriptで確認する。
 * @stimulus 三用途Union、誤用途、取消引数、mode別環境要求を与える。
 * @observation tscの正例とexpect-error消費。
 * @oracle 用途を確定した操作だけ型が一致し、環境の元入力・結果も参照できる。
 * @cleanup 型だけの関数を呼ばず、外部Effectを発行しない。
 */
test("公開型の既定Unionと用途別取消は入出力の相関を維持する", () => {
  function typesOnly(
    executor: Executor,
    request: ExecutorRequest,
    start: StartResult,
    result: CompletionResult,
    projection: RecordProjection,
    input: StartInput,
    callbacks: ExecutorCallbacks,
    args: CancelArguments,
    attemptInput: StartInput<"attempt">,
    authenticationInput: StartInput<"authentication">,
    probeInput: StartInput<"isolation_probe">,
    cancelInput: AttemptCancelInput,
    options: DockerIsolationRuntimeOptions,
    environment: DockerEnvironmentRestartRequest,
  ) {
    // @ts-expect-error 用途未確定のUnionへ任意用途の開始入力を渡せない。
    executor.start(input);
    // @ts-expect-error Attemptが含まれるUnionでは取消入力を省略できない。
    executor.cancel();
    if (executor.kind === "attempt") {
      const started: StartResult<"attempt"> = executor.start(attemptInput);
      executor.cancel(cancelInput);
      // @ts-expect-error Attempt取消の元参照は必須。
      executor.cancel();
      void started;
    } else if (executor.kind === "authentication") {
      const commonProjection: RecordProjection = executor.recordProjection;
      const commonInput: StartInput = authenticationInput;
      const commonCallbacks: ExecutorCallbacks = {
        onCommandCompleted() {},
      } satisfies ExecutorCallbacks<"authentication">;
      const noArguments: CancelArguments = [];
      void commonProjection;
      void commonInput;
      void commonCallbacks;
      void noArguments;
      const started: StartResult<"authentication"> =
        executor.start(authenticationInput);
      executor.cancel();
      // @ts-expect-error 認証取消に空ObjectやAttempt入力は渡さない。
      executor.cancel(cancelInput);
      void started;
    } else {
      const started: StartResult<"isolation_probe"> =
        executor.start(probeInput);
      executor.cancel();
      void started;
    }
    if (request.kind === "attempt") {
      const execution: Executor<"attempt"> | null = createExecutor(
        request,
        options,
      );
      void execution;
    } else if (request.kind === "authentication") {
      const execution: Executor<"authentication"> | null = createExecutor(
        request,
        { managementDirectory: "C:\\synthetic\\management" },
      );
      // @ts-expect-error 認証要求をAttempt用Overloadへ渡せない。
      createExecutor(request, options);
      void execution;
    }
    if (start.kind === "authentication" && start.status === "started") {
      const completion: Promise<CompletionResult<"authentication">> =
        start.completion;
      void completion;
    }
    if (result.kind === "attempt") void result.reviewFindings;
    else if (result.kind === "authentication") void result.authenticationStatus;
    else void result.containerId;
    // @ts-expect-error Probeには記録投影を定義しない。
    const noProjection: RecordProjection<"isolation_probe"> = projection;
    void noProjection;
    if (environment.mode === "restart") {
      const original: DockerRuntimeRestartInput = environment.input;
      void original;
    } else {
      const original: DockerRuntimeRepairInput = environment.input;
      const pending: Promise<DockerRuntimeRepairResult> =
        restartDockerEnvironment(environment);
      void original;
      void pending;
    }
    void callbacks;
    void args;
  }
  void typesOnly;
});

/**
 * 認証の事前取消を開始拒否として返し、操作を再利用しない。
 * @responsibility Signalと開始結果の拒否理由を本番Facadeで接続する。
 * @trace ERB-IT-004
 * @precondition 有限認証操作と未開始Executor。
 * @stimulus 明示取消又は外部Signalの事前abort。
 * @observation execute/cleanup件数、元Projection、拒否理由、再開始結果。
 * @oracle 操作零、cancelled理由のblocked、completionなし、再開始拒否。
 * @cleanup 制御は開始拒否時に終端し、外部資源なし。
 */
test("認証の開始前取消は実行せず開始を拒否する", async () => {
  for (const external of [false, true]) {
    let calls = 0;
    const core: Authentication = {
      resources: [],
      projection: {
        provider: "codex",
        action: "status",
        ownershipLabel: "synthetic",
        resources: [],
      },
      async execute() {
        calls++;
        throw Error("unexpected");
      },
      async cleanup() {
        calls++;
        throw Error("unexpected");
      },
      isProcessCompletionConfirmed: () => true,
    };
    const executor = bindAuthenticationLifecycle(core);
    assert.ok(executor);
    const controller = new AbortController();
    if (external) controller.abort();
    else await executor.cancel();
    const result = executor.start({
      ...(external ? { signal: controller.signal } : {}),
    });
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") {
      assert.equal(result.reason, "provider_authentication_cancelled");
      assert.equal(result.completion, null);
    }
    assert.equal(executor.start({}).status, "blocked");
    assert.equal(calls, 0);
    assert.deepEqual(await executor.cancel(), {
      status: "blocked",
      reason: "invalid",
    });
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  }
});

/**
 * 外部中断と明示取消を同じ一回配送と購読寿命へ接続する。
 * @responsibility 事前取消拒否、登録境界、遅延Handler、Rejectと終端後無配送を反証する。
 * @trace ERB-IT-004
 * @precondition Node標準AbortControllerと有限Promiseだけを使う。
 * @stimulus 事前abort・登録中abort・登録前後abort・重複取消・終端後abort。
 * @observation 配送件数、拒否理由、実Signalのlistener数、終端印。
 * @oracle 配送一回、購読残存零、事前取消は再開始不可。
 * @cleanup 全制御をfinishし、保留中の配送を確定する。
 */
test("外部Signalは共通取消へ一回配送され終端で購読を解放する", async () => {
  const pre = new AbortController();
  pre.abort();
  const refused = createLifecycleOperations();
  assert.equal(refused.start(pre.signal), false);
  assert.equal(refused.finished, true);
  assert.equal(refused.cancellationRequested, true);
  assert.equal(refused.start(), false);
  assert.equal(getEventListeners(pre.signal, "abort").length, 0);

  for (const late of [false, true]) {
    const external = new AbortController();
    const control = createLifecycleOperations();
    assert.equal(control.start(external.signal), true);
    assert.equal(getEventListeners(external.signal, "abort").length, 1);
    let calls = 0;
    const handler = async () => {
      calls++;
      throw Error("delivery");
    };
    if (!late) control.bindCancellation(handler);
    external.abort();
    if (late) control.bindCancellation(handler);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 1);
    assert.deepEqual(await control.cancel(), {
      status: "blocked",
      reason: "duplicate",
    });
    control.finish();
    assert.equal(getEventListeners(external.signal, "abort").length, 0);
  }

  const race = new AbortController();
  const add = race.signal.addEventListener.bind(race.signal);
  Object.defineProperty(race.signal, "addEventListener", {
    value: (type: string, listener: () => void, options: { once: boolean }) => {
      race.abort();
      add(type, listener, options);
    },
  });
  const racing = createLifecycleOperations();
  assert.equal(racing.start(race.signal), false);
  assert.equal(racing.finished, true);
  assert.equal(getEventListeners(race.signal, "abort").length, 0);

  const after = new AbortController();
  const ended = createLifecycleOperations();
  ended.start(after.signal);
  let deliveries = 0;
  ended.bindCancellation(async () => {
    deliveries++;
    return true;
  });
  ended.finish();
  after.abort();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(deliveries, 0);
  assert.equal(getEventListeners(after.signal, "abort").length, 0);
});

/**
 * 公開用途の欠測・未知・矛盾を技術準備前に拒否する。
 * @responsibility action由来の暗黙Fallbackとgetter実行を反証する。
 * @trace ERB-IT-004
 * @precondition 不正なメモリ入力だけを使う。
 * @stimulus 未指定kind、未知kind、用途矛盾、accessor、Proxy。
 * @observation nullとgetter実行件数。
 * @oracle 全て拒否し、getterを呼ばない。
 * @cleanup N/A: 外部資源なし。
 */
test("公開Factoryはkindの未知・欠測・矛盾を別用途へ配送しない", () => {
  let getters = 0;
  const getter = {
    get kind() {
      getters++;
      return "authentication";
    },
    action: "status",
  };
  for (const request of [
    {},
    { action: "status" },
    { kind: "unknown" },
    getter,
    { kind: "attempt", action: "login" },
    { kind: "authentication", action: "status", purpose: "task" },
    { kind: "authentication", action: "unknown" },
    { kind: "isolation_probe", probeId: "synthetic", action: "status" },
    new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw Error("proxy");
        },
      },
    ),
  ])
    assert.equal(
      createExecutor(request as never, {
        managementDirectory: "C:\\synthetic\\management",
      }),
      null,
    );
  assert.equal(getters, 0);
});

/**
 * 共通制御の各段階と遅延取消配送を有限操作で照合する。
 * @responsibility 二正本・二重配送・終端後の追加操作を反証する。
 * @trace ERB-IT-004
 * @precondition メモリ内のSignalと有限Promiseだけを使う。
 * @stimulus 事前取消、重複、配送Reject、清掃中取消、終端通知再入。
 * @observation 配送件数、元結果、共通終端、拒否理由。
 * @oracle 配送一回、清掃完了前は未終端、結果固定後は取消拒否。
 * @cleanup 保留Promiseを全て確定する。外部資源なし。
 */
test("共通制御は開始・取消配送・終端を一つの正本で管理する", async () => {
  const before = createLifecycleOperations();
  assert.equal((await before.cancel()).status, "requested");
  assert.equal(before.signal.aborted, true);
  assert.deepEqual(await before.cancel(), {
    status: "blocked",
    reason: "duplicate",
  });
  assert.equal(before.start(), false);
  assert.equal(before.finished, true);
  assert.equal(before.start(), false);
  let delivered = 0;
  before.bindCancellation(async () => {
    delivered++;
    return true;
  });
  before.bindCancellation(async () => {
    delivered++;
    return true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(delivered, 0);
  const delayed = createLifecycleOperations();
  assert.equal(delayed.start(), true);
  assert.equal((await delayed.cancel()).status, "requested");
  delayed.bindCancellation(async () => {
    delivered++;
    return true;
  });
  delayed.bindCancellation(async () => {
    delivered++;
    return true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(delivered, 1);
  delayed.finish();
  before.finish();
  assert.deepEqual(await before.cancel(), {
    status: "blocked",
    reason: "invalid",
  });
  assert.equal(before.start(), false);
  const failed = createLifecycleOperations();
  failed.start();
  failed.bindCancellation(async () => {
    throw Error("delivery");
  });
  await assert.rejects(failed.cancel(), /delivery/);
  assert.deepEqual(await failed.cancel(), {
    status: "blocked",
    reason: "duplicate",
  });
  const external = new AbortController();
  const linked = createLifecycleOperations();
  assert.equal(linked.start(external.signal), true);
  external.abort();
  assert.equal(linked.signal.aborted, true);
  linked.finish();
  linked.bindCancellation(async () => {
    throw Error("terminal_delivery");
  });
  const running = createLifecycleOperations();
  running.start();
  let release: () => void = () => {};
  const cleaning = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered: () => void = () => {};
  const cleanupEntered = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let terminalCancel: unknown;
  const completion = executeLifecycle(
    {
      async execute() {},
      async cleanup() {
        entered();
        await cleaning;
      },
      createResult() {
        return { status: "confirmed" };
      },
      onCompleted: async () => {
        terminalCancel = await running.cancel();
      },
    },
    undefined,
    running,
  );
  await cleanupEntered;
  assert.equal(running.finished, false);
  assert.equal((await running.cancel()).status, "requested");
  release();
  assert.deepEqual(await completion, { status: "confirmed" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(running.finished, true);
  assert.deepEqual(terminalCancel, { status: "blocked", reason: "invalid" });

  const fixed = createLifecycleOperations();
  fixed.start();
  let afterResult: unknown;
  const fixedResult = await executeLifecycle(
    {
      async execute() {},
      async cleanup() {},
      createResult() {
        queueMicrotask(async () => {
          afterResult = await fixed.cancel();
        });
        return { status: "completed", cancelled: false };
      },
    },
    undefined,
    fixed,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fixedResult, { status: "completed", cancelled: false });
  assert.deepEqual(afterResult, { status: "blocked", reason: "invalid" });

  const throwing = createLifecycleOperations();
  throwing.start();
  await assert.rejects(
    executeLifecycle(
      {
        async execute() {},
        async cleanup() {},
        createResult() {
          throw null;
        },
      },
      undefined,
      throwing,
    ),
    (error) => error === null,
  );
  assert.equal(throwing.finished, true);
  assert.deepEqual(await throwing.cancel(), {
    status: "blocked",
    reason: "invalid",
  });

  let cleanupCalls = 0;
  await executeLifecycle(
    {
      async execute() {},
      shouldCleanup: () => false,
      async cleanup() {
        cleanupCalls++;
      },
      createResult() {
        return false;
      },
    },
    undefined,
  );
  assert.equal(cleanupCalls, 0);
});

/** 用途が異なる開始・取消・通知を共通名の型が混同しない。 */
test("共通公開型は用途と開始・取消・結果・通知の対応を維持する", () => {
  function typesOnly(
    attempt: Executor<"attempt">,
    authentication: Executor<"authentication">,
    probe: Executor<"isolation_probe">,
    input: StartInput<"attempt">,
  ) {
    attempt.start(input);
    authentication.start({});
    probe.start({});
    // @ts-expect-error 認証開始にAttemptの管理参照を転用しない。
    authentication.start(input);
    // @ts-expect-error Attempt取消には元Controlと管理参照が必須。
    attempt.cancel({});
    // @ts-expect-error 認証にAttempt専用の明示解放を捏造しない。
    authentication.abandon({
      recoveryCapability: {},
      managementCapability: {},
    });
    const wrong: ExecutorCallbacks<"isolation_probe"> = {
      // @ts-expect-error Probeには認証の終了通知を登録できない。
      onCommandCompleted: () => {},
    };
    void wrong;
  }
  void typesOnly;
  function narrow(
    value: CompletionResult<"attempt" | "authentication" | "isolation_probe">,
  ) {
    if (value.kind === "authentication") return value.authenticationStatus;
    if (value.kind === "isolation_probe") return value.facts;
    return value.normalizedResult;
  }
  void narrow;
  assert.ok(true);
});

/** falsyな例外も発生事実と値を分け、清掃例外による一次値上書きを拒否する。 */
test("共通Lifecycleはfalsy例外・二重例外・正常を取り違えない", async () => {
  for (const primary of [null, undefined, false, 0, ""]) {
    for (const secondary of [false, true]) {
      let cleaned = false;
      const result = await executeLifecycle(
        {
          async execute() {
            throw primary;
          },
          async cleanup() {
            cleaned = true;
            if (secondary) throw Error("secondary");
          },
          createResult(_context, failure, failed) {
            return { failure, failed };
          },
        },
        undefined,
      );
      assert.equal(cleaned, true);
      assert.equal(result.failed, true);
      assert.equal(result.failure, primary);
    }
  }
  const clean = await executeLifecycle(
    {
      async execute() {},
      async cleanup() {},
      createResult(_context, failure, failed) {
        return { failure, failed };
      },
    },
    undefined,
  );
  assert.deepEqual(clean, { failure: null, failed: false });
  const cleanupOnly = await executeLifecycle(
    {
      async execute() {},
      async cleanup() {
        throw undefined;
      },
      createResult(_context, failure, failed) {
        return { failure, failed };
      },
    },
    undefined,
  );
  assert.deepEqual(cleanupOnly, { failure: undefined, failed: true });
});

/** 最終command／清掃待機中の取消と、既存一次理由後の清掃例外を固定する。 */
test("認証は最終取消を反映し清掃例外で一次理由を上書きしない", async () => {
  for (const mode of [
    "cancel_execute",
    "cancel_cleanup",
    "primary_cleanup_error",
    "normal_cleanup_error",
  ]) {
    let release!: () => void;
    let ready!: () => void;
    const reached = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const primary =
      mode === "primary_cleanup_error"
        ? "provider_authentication_resource_receipt_unconfirmed"
        : "provider_authentication_completed";
    const core: Authentication = {
      resources: [],
      projection: {
        provider: "claude",
        action: "status",
        ownershipLabel: "synthetic",
        resources: [],
      },
      async execute() {
        if (mode === "cancel_execute") {
          ready();
          await waiting;
        }
        return {
          reason: primary,
          authenticationStatus: "confirmed",
          authenticationConfirmed: true,
          providerEffectIssued: true,
          processCompletionConfirmed: true,
        };
      },
      async cleanup() {
        if (mode === "cancel_cleanup") {
          ready();
          await waiting;
        }
        if (mode.endsWith("error")) throw null;
        return { confirmed: true, processCompletionConfirmed: true };
      },
      isProcessCompletionConfirmed: () => true,
    };
    const executor = bindAuthenticationLifecycle(core);
    assert.ok(executor);
    const pending = executor.start({}).completion;
    if (mode.startsWith("cancel")) {
      await reached;
      void executor.cancel();
      release();
    }
    assert.ok(pending);
    const result = await pending;
    assert.equal(result.authenticationConfirmed, true);
    assert.equal(
      result.reason,
      mode.startsWith("cancel")
        ? "provider_authentication_cancelled"
        : mode === "primary_cleanup_error"
          ? primary
          : "provider_authentication_process_completion_unconfirmed",
    );
    assert.equal(result.cleanupConfirmed, mode.startsWith("cancel"));
  }
});

/** 清掃が終了する前に結果を公開せず、清掃例外で一次失敗を上書きしない。 */
test("共通Lifecycleは同じContextで清掃をjoinし一次失敗を保持する", async () => {
  const context = {},
    events: string[] = [];
  const primary = Error("primary"),
    secondary = Error("cleanup");
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const completion = executeLifecycle(
    {
      async execute(actual) {
        assert.equal(actual, context);
        events.push("execute");
        throw primary;
      },
      async cleanup(actual) {
        assert.equal(actual, context);
        events.push("cleanup");
        await waiting;
        throw secondary;
      },
      createResult(actual, failure) {
        assert.equal(actual, context);
        events.push("result");
        return failure;
      },
    },
    context,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ["execute", "cleanup"]);
  release();
  assert.equal(await completion, primary);
  assert.deepEqual(events, ["execute", "cleanup", "result"]);
});

/** 認証も一回のstart・取消を同じRuntimeに渡し、終了不明の後に清掃を発行しない。 */
test("認証の共通Lifecycleは正常・取消・終了不明・清掃失敗を区別する", async () => {
  for (const mode of [
    "normal",
    "cancel",
    "unknown",
    "cleanup_failed",
    "throw",
  ] as const) {
    let cleanups = 0;
    let observedSignal: AbortSignal | undefined;
    const result: AuthenticationResult = {
      reason: "provider_authentication_completed",
      authenticationStatus: "confirmed",
      authenticationConfirmed: true,
      providerEffectIssued: true,
      processCompletionConfirmed: mode !== "unknown",
    };
    const core: Authentication = {
      resources: [],
      projection: {
        provider: "codex",
        action: "status",
        ownershipLabel: "synthetic",
        resources: [],
      },
      async execute(signal, callbacks) {
        observedSignal = signal;
        callbacks?.onCommandSubmitting?.("synthetic");
        if (mode === "throw") throw Error("synthetic");
        await new Promise((resolve) => setImmediate(resolve));
        return {
          ...result,
          ...(signal?.aborted
            ? { reason: "provider_authentication_cancelled" }
            : {}),
        };
      },
      async cleanup(resources, signal) {
        cleanups++;
        assert.deepEqual(resources, []);
        assert.equal(signal, undefined);
        return {
          confirmed: mode !== "cleanup_failed",
          processCompletionConfirmed: true,
        };
      },
      isProcessCompletionConfirmed: () =>
        mode !== "unknown" && mode !== "throw",
    };
    const executor = bindAuthenticationLifecycle(core);
    assert.ok(executor);
    assert.equal(executor.recordProjection, core.projection);
    const notices: string[] = [];
    let delivered: CompletionResult<"authentication"> | null = null;
    const started = executor.start({
      callbacks: {
        onCommandSubmitting: (purpose) => {
          notices.push(purpose);
        },
        onCompleted: (result) => {
          delivered = result;
          return Promise.reject(Error("passive"));
        },
      },
    });
    assert.ok(started.status === "started");
    if (mode === "cancel") {
      const cancelled = await executor.cancel();
      assert.equal(cancelled.status, "requested");
      if (cancelled.status === "requested")
        assert.equal(cancelled.processTerminationObserved, false);
    }
    assert.equal(executor.start({}).status, "blocked");
    const completed = await started.completion;
    assert.deepEqual(await executor.cancel(), {
      status: "blocked",
      reason: "invalid",
    });
    assert.equal(completed.kind, "authentication");
    assert.equal(delivered, completed);
    assert.deepEqual(notices, ["synthetic"]);
    assert.equal(cleanups, mode === "unknown" || mode === "throw" ? 0 : 1);
    assert.equal(
      completed.cleanupConfirmed,
      mode === "normal" || mode === "cancel",
    );
    assert.equal(
      completed.processCompletionConfirmed,
      mode !== "unknown" && mode !== "throw",
    );
    if (mode === "cancel") {
      assert.equal(observedSignal?.aborted, true);
      assert.equal(completed.reason, "provider_authentication_cancelled");
    }
  }
});
