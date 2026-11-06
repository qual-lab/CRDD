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

import type {
  RepairInput,
  RepairResult,
} from "../../../docker-isolation/src/docker-desktop/repair-session.ts";
import type { RestartInput } from "../../../docker-isolation/src/docker-desktop/restart.ts";
import type { DockerIsolationRuntimeOptions } from "../../src/lifecycle/types.ts";
import {
  type AttemptCancelInput,
  type CancelArguments,
  type CompletionResult,
  createExecutor,
  type DockerEnvironmentRequest,
  type Executor,
  type ExecutorCallbacks,
  type ExecutorRequest,
  type RecordProjection,
  restartDockerEnvironment,
  type StartInput,
  type StartResult,
} from "../../src/index.ts";
import { createLifecycleControl } from "../../src/lifecycle/execute.ts";

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
    environment: DockerEnvironmentRequest,
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
      const original: RestartInput = environment.input;
      void original;
    } else {
      const original: RepairInput = environment.input;
      const pending: Promise<RepairResult> =
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
  const refused = createLifecycleControl();
  assert.equal(refused.start(pre.signal), false);
  assert.equal(refused.finished, true);
  assert.equal(refused.cancellationRequested, true);
  assert.equal(refused.start(), false);
  assert.equal(getEventListeners(pre.signal, "abort").length, 0);

  for (const late of [false, true]) {
    const external = new AbortController();
    const control = createLifecycleControl();
    assert.equal(control.start(external.signal), true);
    assert.equal(getEventListeners(external.signal, "abort").length, 1);
    let calls = 0;
    const handler = async () => {
      calls++;
      throw Error("delivery");
    };
    if (!late) control.bind(cancellationSession(handler));
    external.abort();
    if (late) control.bind(cancellationSession(handler));
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
  const racing = createLifecycleControl();
  assert.equal(racing.start(race.signal), false);
  assert.equal(racing.finished, true);
  assert.equal(getEventListeners(race.signal, "abort").length, 0);

  const after = new AbortController();
  const ended = createLifecycleControl();
  ended.start(after.signal);
  let deliveries = 0;
  ended.bind(
    cancellationSession(async () => {
      deliveries++;
      return true;
    }),
  );
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
  const before = createLifecycleControl();
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
  before.bind(
    cancellationSession(async () => {
      delivered++;
      return true;
    }),
  );
  before.bind(
    cancellationSession(async () => {
      delivered++;
      return true;
    }),
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(delivered, 0);
  const delayed = createLifecycleControl();
  assert.equal(delayed.start(), true);
  assert.equal((await delayed.cancel()).status, "requested");
  delayed.bind(
    cancellationSession(async () => {
      delivered++;
      return true;
    }),
  );
  delayed.bind(
    cancellationSession(async () => {
      delivered++;
      return true;
    }),
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(delivered, 1);
  delayed.finish();
  before.finish();
  assert.deepEqual(await before.cancel(), {
    status: "blocked",
    reason: "invalid",
  });
  assert.equal(before.start(), false);
  const failed = createLifecycleControl();
  failed.start();
  failed.bind(
    cancellationSession(async () => {
      throw Error("delivery");
    }),
  );
  await assert.rejects(failed.cancel(), /delivery/);
  assert.deepEqual(await failed.cancel(), {
    status: "blocked",
    reason: "duplicate",
  });
  const external = new AbortController();
  const linked = createLifecycleControl();
  assert.equal(linked.start(external.signal), true);
  external.abort();
  assert.equal(linked.signal.aborted, true);
  linked.finish();
  linked.bind(
    cancellationSession(async () => {
      throw Error("terminal_delivery");
    }),
  );
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

/**
 * 取消配送だけを観測する有限DI Session。
 * @responsibility 実Process・資源の成立を主張せず取消ハンドラーだけを接続する。
 * @trace ERB-IT-004
 * @precondition メモリ内の関数のみ。
 * @stimulus handlerの正常・失敗。
 * @observation 配送回数と終了観測の値。
 * @oracle 同じhandlerの結果をそのまま返す。
 * @cleanup 実資源なし。
 */
function cancellationSession(
  handler: () => Promise<boolean>,
): import("../../../docker-isolation/src/index.ts").IsolationExecution {
  return {
    completion: Promise.resolve(
      {} as import("../../../docker-isolation/src/index.ts").IsolationExecutionResult,
    ),
    cancel: async () => ({
      cancellationRequested: true,
      processTerminationObserved: await handler(),
    }),
  };
}

/** 入力の取得操作を準備Effectより前に拒否する。 @trace ERB-IT-004 */
test("Attemptの欠測・accessor・内側Proxyは乱数取得前に非評価で拒否する", () => {
  let hooks = 0,
    randomCalls = 0;
  const getter = () => {
    hooks++;
    throw Error("synthetic_getter");
  };
  const target = {
    operationId: "OP-123456",
    grantRef: "PHMGRANT-123456",
    provider: "codex",
    workspaceSourcePath: "C:/fixture/work",
    temporarySourcePath: "C:/fixture/tmp",
    providerHomeSourcePath: "C:/fixture/home",
    providerHomeIdentityHash: "a".repeat(64),
    providerHomeProtectionHash: "b".repeat(64),
    localUserBindingHash: "c".repeat(64),
    stableLogicalHomeBindingHash: "d".repeat(64),
    activeMountCapability: {},
  };
  const base = { kind: "attempt", purpose: "probe", target, selection: {} };
  const accessor = (value: object, key: string) =>
    Object.defineProperty({ ...value }, key, { get: getter, enumerable: true });
  const proxy = new Proxy(target, {
    get: getter,
    getOwnPropertyDescriptor: getter,
    ownKeys: getter,
  });
  for (const request of [
    { kind: "attempt" },
    accessor(base, "target"),
    { ...base, target: proxy },
    { ...base, target: accessor(target, "temporarySourcePath") },
    { ...base, target: accessor(target, "workspaceProtection") },
    {
      ...base,
      target: {
        ...target,
        workspaceProtection: accessor(
          {
            gitSourcePath: "C:/fixture/git",
            internalSourcePath: "C:/fixture/internal",
          },
          "gitSourcePath",
        ),
      },
    },
    accessor(base, "purpose"),
    accessor(base, "selection"),
  ]) {
    assert.equal(
      createExecutor(
        request as ExecutorRequest<"attempt">,
        {
          paths: { tmp: "C:/fixture/tmp", management: "C:/fixture/management" },
        },
        {
          randomBytes: () => {
            randomCalls++;
            throw Error("unexpected_random");
          },
        },
      ),
      null,
    );
  }
  assert.equal(hooks, 0);
  assert.equal(randomCalls, 0);
});
