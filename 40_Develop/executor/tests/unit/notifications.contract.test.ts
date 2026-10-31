/**
 * 通知専用interfaceと単発実行の終了条件を反証する。
 * @packageDocumentation
 * @responsibility 通知待ち・失敗・未登録を技術実行と上位保存から区別する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @level UT
 * @scope 合成計画・有限Handle・メモリ内観測のみ。
 * @boundary 実AI・Docker・Filesystem・保存の成立は主張しない。
 */
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import {
  startDockerCommandSessionCandidate,
  type DockerResourceReceipts,
} from "../../../docker-isolation/src/index.ts";
import { createExecutorTestRuntime } from "../../scripts/executor-test.ts";
import type {
  ExecutorCallbacks,
  CompletionResult,
  AttemptDiagnosticNotice,
} from "../../src/index.ts";
import type { IsolationRuntime } from "../../src/attempt/isolation.ts";
import { attemptPlan } from "../fixtures/attempt-plan.ts";

/**
 * 公開FactoryからPlanを往復せず、同じ一試行を実行・取消・回収する。
 * @responsibility Requestから作った内部構成と公開startの実接続を有限隔離だけで確認する。
 * @trace ERB-IT-004
 * @precondition AI AdapterとFactory／startは実装本体、隔離とHomeだけをメモリ代役へ置換する。
 * @stimulus 正常、開始通知待ちの取消、Home競合、同じExecutorへの再開始。
 * @observation 準備中の要求零、元ID、同じ結果通知、回収・解放回数。
 * @oracle 完全Plan・prepareは公開せず、一回実行と元Controlの取消を維持する。
 * @cleanup 全PromiseをjoinしModule代役を復元する。外部AI・Dockerは呼ばない。
 */
test("Requestを受ける公開Factoryは内部Planで一回実行し同じControlで取り消す", async () => {
  const di = await import("../../../docker-isolation/src/index.ts");
  const boundary = await import("../../src/attempt/isolation.ts");
  let current = fixture();
  let acquisitions = 0;
  const dockerMock = mock.module(
    new URL("../../../docker-isolation/src/index.ts", import.meta.url).href,
    {
      namedExports: {
        ...di,
        createDockerIsolationRuntime: () => ({
          acquireHomeLease: () => {
            acquisitions++;
            return current.isolation.acquireHomeLease("d".repeat(64));
          },
        }),
      },
    },
  );
  const isolationMock = mock.module(
    new URL("../../src/attempt/isolation.ts", import.meta.url).href,
    {
      namedExports: {
        ...boundary,
        bindIsolationRuntime: () => ({
          startExecution: current.isolation.startExecution,
          cleanupOwnedResources: current.isolation.cleanupOwnedResources,
          verifyCleanupOutcome: current.isolation.verifyCleanupOutcome,
        }),
      },
    },
  );
  try {
    const { createExecutor }: typeof import("../../src/attempt/execute.ts") =
      await import(
        new URL(
          "../../src/attempt/execute.ts?request-bound-contract",
          import.meta.url,
        ).href
      );
    for (const mode of ["normal", "cancel", "busy"] as const) {
      current = fixture(mode === "busy");
      acquisitions = 0;
      const request = {
        purpose: "probe" as const,
        selection: current.plan.executionSelection,
        target: {
          provider: current.plan.provider,
          operationId: current.plan.operationId,
          grantRef: current.plan.grantRef,
          workspaceSourcePath: "C:/synthetic/work",
          temporarySourcePath: "C:/synthetic/tmp",
          providerHomeSourcePath: current.plan.providerHomeSourcePath,
          providerHomeIdentityHash: current.plan.providerHomeIdentityHash,
          providerHomeProtectionHash: current.plan.providerHomeProtectionHash,
          localUserBindingHash: current.plan.localUserBindingHash,
          stableLogicalHomeBindingHash:
            current.plan.stableLogicalHomeBindingHash,
          activeMountCapability: current.plan.activeMountCapability,
        },
      };
      const executor = createExecutor(
        request,
        {
          borrowPaths: () => ({
            tmp: "C:/synthetic/tmp",
            management: "C:/synthetic/management",
          }),
          inspectReceipts: () => null,
        },
        { randomBytes: (size: number) => Buffer.alloc(size, 1) },
      );
      assert.ok(executor);
      assert.equal("prepare" in executor, false);
      assert.equal("commands" in executor.recordProjection, false);
      assert.equal("providerInput" in executor.recordProjection, false);
      assert.equal(acquisitions, 0);
      assert.equal(current.calls.length, 0);
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      let notified: unknown = null;
      const started = executor.start(current.owner, current.reference, {
        onStarted: () => (mode === "cancel" ? pending : undefined),
        onCompleted: (result) => {
          notified = result;
        },
      });
      assert.equal(acquisitions, 1);
      assert.equal(started.recoveryId, current.reference.recoveryId);
      if (started.status !== "started") {
        assert.equal(mode, "busy");
        assert.equal(started.cleanupConfirmed, false);
        assert.equal(current.calls.length, 0);
        continue;
      }
      for (let turn = 0; turn < 100 && current.counts().cleanups === 0; turn++)
        await Promise.resolve();
      if (mode === "cancel") {
        assert.equal(
          (await executor.cancel(started.controlCapability, {})).status,
          "blocked",
        );
        assert.equal(
          (await executor.cancel(started.controlCapability, current.owner))
            .status,
          "requested",
        );
        release();
      }
      const result = await started.completion;
      assert.equal(
        result.status,
        mode === "cancel" ? "cancelled" : "completed",
      );
      assert.strictEqual(result, notified);
      assert.deepEqual(current.counts(), { cleanups: 1, releases: 1 });
      assert.equal(
        executor.start(current.owner, current.reference).status,
        "blocked",
      );
      assert.equal(acquisitions, 1);
    }
  } finally {
    isolationMock.restore();
    dockerMock.restore();
  }
});

/**
 * 開始通知の保留・遅い拒否を、開始済みProcessの技術回収から分離する。
 * @responsibility 技術清掃は進め、内容受理とcompletionだけを通知join後に限定する。
 * @trace ERB-IT-004
 * @precondition 合成sessionとParser呼出し計数だけを使う。
 * @stimulus 通知resolve・reject・保留中取消の三経路。
 * @observation Parser回数、清掃回数、元ID、completionの未確定。
 * @oracle 保留中は清掃一回・Parser零、resolveだけParser一回。
 * @cleanup 各通知をsettleし、completionをjoin、module mockを復元する。
 */
test("開始通知を待つ間も技術清掃し、通知成功後だけProvider内容を受理する", async () => {
  const ai = await import("../../../ai-adapter/src/index.ts");
  let parses = 0;
  const mocked = mock.module(
    new URL("../../../ai-adapter/src/index.ts", import.meta.url).href,
    {
      namedExports: {
        ...ai,
        parseProviderResult: (
          ...args: Parameters<typeof ai.parseProviderResult>
        ) => {
          parses++;
          return ai.parseProviderResult(...args);
        },
      },
    },
  );
  const resultModule = await import(
    new URL("../../src/result/attempt.ts?notification-join", import.meta.url)
      .href
  );
  const resultMock = mock.module(
    new URL("../../src/result/attempt.ts", import.meta.url).href,
    { namedExports: resultModule },
  );
  try {
    const isolated: typeof import("../../src/attempt/execute.ts") =
      await import(
        new URL(
          "../../src/attempt/execute.ts?notification-join",
          import.meta.url,
        ).href
      );
    const { start, cancel } = isolated;
    for (const mode of ["resolve", "reject", "cancel"] as const) {
      parses = 0;
      const f = fixture();
      let resolve!: () => void, reject!: (error: Error) => void;
      const pending = new Promise<void>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      const state = {
        controls: new WeakMap(),
        isolation: f.isolation,
        callbacks: { onStarted: () => pending },
      };
      const started = start(state, f.plan, f.owner, f.reference);
      assert.equal(started.status, "started");
      if (started.status !== "started") continue;
      let completed = false;
      void started.completion.then(() => {
        completed = true;
      });
      for (let turns = 0; turns < 100 && f.counts().cleanups === 0; turns++)
        await Promise.resolve();
      assert.equal(f.counts().cleanups, 1);
      assert.equal(completed, false);
      assert.equal(parses, 0);
      if (mode === "cancel")
        await cancel(state, started.controlCapability, f.owner);
      if (mode === "reject") reject(Error("synthetic_late_rejection"));
      else resolve();
      const result = await started.completion;
      assert.equal(result.recoveryId, f.reference.recoveryId);
      assert.equal(result.cleanupConfirmed, true);
      assert.deepEqual(f.counts(), { cleanups: 1, releases: 1 });
      assert.equal(parses, mode === "resolve" ? 1 : 0);
      assert.equal(
        result.status,
        mode === "resolve"
          ? "completed"
          : mode === "cancel"
            ? "cancelled"
            : "blocked",
      );
      if (mode !== "resolve") assert.equal(result.normalizedResult, null);
    }
    const invalidResults: CompletionResult[] = [];
    for (const delayed of [false, true]) {
      parses = 0;
      const f = fixture(false, "{}");
      let finish!: () => void;
      const pending = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const started = start(
        {
          controls: new WeakMap(),
          isolation: f.isolation,
          callbacks: { onStarted: () => (delayed ? pending : undefined) },
        },
        f.plan,
        f.owner,
        f.reference,
      );
      assert.equal(started.status, "started");
      if (started.status !== "started") continue;
      if (delayed) {
        for (let turns = 0; turns < 100 && f.counts().cleanups === 0; turns++)
          await Promise.resolve();
        assert.equal(f.counts().cleanups, 1);
        assert.equal(parses, 0);
        finish();
      }
      const result = await started.completion;
      assert.equal(parses, 1);
      assert.equal(result.status, "blocked");
      assert.equal(result.normalizedResult, null);
      assert.equal(result.resultSha256, null);
      assert.equal(result.resultBytes, 0);
      assert.deepEqual(f.counts(), { cleanups: 1, releases: 1 });
      invalidResults.push(result);
    }
    assert.deepEqual(invalidResults[0], invalidResults[1]);
  } finally {
    mocked.restore();
    resultMock.restore();
  }
});

/**
 * 実在する隔離境界だけを有限代役にする。
 * @responsibility 元IDを清掃へ搬送し、通知を保存操作にしない。
 * @trace ERB-IT-002
 * @precondition 実資源を使用しない。
 * @stimulus 呼出し側が明示start・cancelを行う。
 * @observation 発行・清掃・Home解放と局所Receipt。
 * @oracle 各実行の元Promiseと通知を同じOwnerへ結合する。
 * @cleanup 呼出しCaseが全completionを待つ。
 */
function fixture(busy = false, providerOutput?: string) {
  const plan = attemptPlan();
  const owner = {};
  const reference = {
    recoveryId: `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`,
    recoveryCapability: {},
  };
  const calls: string[] = [];
  let cleanups = 0,
    releases = 0;
  let receipts: DockerResourceReceipts | null = null;
  const isolation: IsolationRuntime = {
    acquireHomeLease: () =>
      busy
        ? null
        : {
            release: () => {
              releases++;
              return true;
            },
          },
    startExecution: (input, _reference, _owner, hooks) =>
      startDockerCommandSessionCandidate(
        input.commands.map((command) => command.purpose),
        {
          startCommand: (purpose) => {
            calls.push(purpose);
            return {
              started: async () => true,
              terminateAndWait: async () => true,
              wait: async () => ({
                status: 0,
                signal: null,
                stderr: "",
                outputExceeded: false,
                stdout: purpose.startsWith("create_")
                  ? "a".repeat(64)
                  : purpose === "start_subscription_auth_probe_attached"
                    ? JSON.stringify({
                        loggedIn: true,
                        authMethod: "claude.ai",
                        apiProvider: "firstParty",
                        forcedLoginMethod: "claudeai",
                        subscriptionType: "max",
                      })
                    : purpose === "start_provider_attached"
                      ? (providerOutput ??
                        JSON.stringify({
                          type: "result",
                          subtype: "success",
                          is_error: false,
                          num_turns: 1,
                          total_cost_usd: 0,
                          structured_output: { status: true },
                        }))
                      : "",
              }),
            };
          },
          cleanup: async (observed) => {
            receipts = observed;
            cleanups++;
            return {
              confirmed: true,
              processTreeTerminated: true,
              containersAbsent: true,
              networksAbsent: true,
              resourceObservations: [],
            };
          },
          verifyCleanup: (result) => result.resourceObservations ?? null,
        },
        hooks,
      ),
    cleanupOwnedResources: async () => {
      throw Error("unexpected_fallback");
    },
    verifyCleanupOutcome: () => null,
  };
  const runtime = createExecutorTestRuntime(isolation);
  return {
    runtime,
    isolation,
    plan,
    owner,
    reference,
    calls,
    counts: () => ({ cleanups, releases }),
    receipts: () => receipts,
  };
}

/**
 * 任意通知の未登録と受動通知の拒否を完了条件へ混同しない。
 * @responsibility 保存やACKなしで技術結果を返す境界を固定する。
 * @trace ERB-IT-004
 * @precondition 有効な合成計画と元参照。
 * @stimulus 未登録、受動通知のsync throw／async reject。
 * @observation 同じ結果object、九要求、清掃・解放各一回。
 * @oracle 上位の保存fieldを生成せず技術完了を維持する。
 * @cleanup 各completionと拒否観測を待つ。
 */
test("通知なしでも技術完了し、受動通知失敗は同じ結果を変えない", async () => {
  for (const mode of ["absent", "throw", "reject"]) {
    const f = fixture();
    let notified: unknown = null;
    const diagnostics: AttemptDiagnosticNotice[] = [];
    const callbacks: ExecutorCallbacks =
      mode === "absent"
        ? {}
        : {
            onCompleted: (result) => {
              notified = result;
              if (mode === "throw") throw Error("synthetic");
              return Promise.reject(Error("synthetic"));
            },
            onDiagnostic: (notice) => {
              diagnostics.push(notice);
              if (mode === "throw") throw Error("synthetic");
              return Promise.reject(Error("synthetic"));
            },
          };
    const started = f.runtime.start(f.plan, f.owner, f.reference, callbacks);
    assert.equal(started.status, "started");
    if (started.status !== "started") continue;
    const result = await started.completion;
    assert.equal(result.status, "completed");
    assert.equal(f.calls.length, 9);
    assert.deepEqual(f.counts(), { cleanups: 1, releases: 1 });
    assert.equal(result.recoveryId, f.reference.recoveryId);
    if (mode !== "absent") {
      assert.equal(notified, result);
      assert.deepEqual(
        diagnostics.map((notice) => notice.event),
        [
          "coordinator_provider_boundary_configured",
          "coordinator_provider_boundary_settled",
        ],
      );
      for (const notice of diagnostics) {
        assert.equal(notice.operationId, f.plan.operationId);
        assert.equal(notice.provider, f.plan.provider);
        assert.equal("commands" in notice, false);
        assert.equal("providerHomeSourcePath" in notice, false);
      }
      const configured = diagnostics[0];
      assert.ok(
        configured?.event === "coordinator_provider_boundary_configured",
      );
      assert.deepEqual(
        Object.keys(configured).sort(),
        [
          "event",
          "taskRole",
          "provider",
          "operationId",
          "approvalModeConfigured",
          "sandboxModeConfigured",
          "workspaceMountModeConfigured",
          "networkPolicyHash",
          "rootFilesystemReadOnlyConfigured",
          "nonRootUserConfigured",
          "workdirConfigured",
        ].sort(),
      );
    } else {
      assert.equal(diagnostics.length, 0);
    }
    for (const name of [
      "mountLeaseReleased",
      "recoveryCompleted",
      "recoveryFinalizationCapability",
    ])
      assert.equal(name in result, false);
  }
});

/**
 * 必要通知の拒否と清掃用ID保持を独立に照合する。
 * @responsibility 通知先の失敗で次要求を発行せず、取得済みIDを失わない。
 * @trace ERB-IT-002
 * @precondition 失敗先を一つだけ選ぶ。
 * @stimulus 発行予定、Receipt、資源終了、清掃終了のthrow／reject。
 * @observation 次要求数、ID、Home解放と元参照。
 * @oracle 保存判断を受け取らず技術清掃を各一回行う。
 * @cleanup 全completionを待つ。
 */
test("必要通知の例外・拒否は次のEffectを止め、元Receiptと解放事実を保持する", async () => {
  for (const name of [
    "onCommandSubmitting",
    "onResourceCreated",
    "onResourcesClosed",
    "onCleanupCompleted",
  ] as const)
    for (const asynchronous of [false, true]) {
      const f = fixture();
      const refuse = () => {
        if (asynchronous) return Promise.reject(Error("synthetic"));
        throw Error("synthetic");
      };
      const started = f.runtime.start(f.plan, f.owner, f.reference, {
        [name]: refuse,
      });
      assert.equal(started.status, "started");
      if (started.status !== "started") continue;
      const result = await started.completion;
      assert.equal(result.status, "blocked");
      assert.equal(result.homeLeaseReleased, true);
      assert.equal(result.recoveryId, f.reference.recoveryId);
      assert.deepEqual(f.counts(), { cleanups: 1, releases: 1 });
      assert.equal(
        f.calls.length,
        name === "onCommandSubmitting"
          ? 0
          : name === "onResourceCreated"
            ? 1
            : 9,
      );
      if (name === "onResourceCreated")
        assert.equal(
          f.receipts()?.create_subscription_auth_probe.dockerId,
          "a".repeat(64),
        );
    }
});

/**
 * 通知待機中の取消とHome競合をEffectなしへ閉じる。
 * @responsibility 未開始を清掃・Home解放済みへ昇格しない。
 * @trace ERB-IT-002
 * @precondition 同じ元Control・Ownerを使う。
 * @stimulus intent通知待ち中の取消、又はHome競合。
 * @observation 要求0、未発行通知一回、exact回復ID。
 * @oracle 保留通知を待ち終えてから同じ試行を終える。
 * @cleanup 保留Promiseを解放しcompletionを待つ。
 */
test("通知待機中の取消は未発行を通知し、Home競合は同IDの未開始結果を返す", async () => {
  let enter!: () => void, finish!: () => void;
  const entered = new Promise<void>((resolve) => {
      enter = resolve;
    }),
    release = new Promise<void>((resolve) => {
      finish = resolve;
    });
  const f = fixture();
  let notIssued = 0;
  const started = f.runtime.start(f.plan, f.owner, f.reference, {
    onCommandSubmitting: async () => {
      enter();
      await release;
    },
    onCommandNotIssued: () => {
      notIssued++;
    },
  });
  assert.equal(started.status, "started");
  if (started.status !== "started") return;
  await entered;
  await f.runtime.cancel(started.controlCapability, f.owner);
  finish();
  const result = await started.completion;
  assert.equal(result.status, "cancelled");
  assert.equal(f.calls.length, 0);
  assert.equal(notIssued, 1);
  assert.deepEqual(f.counts(), { cleanups: 1, releases: 1 });
  const busy = fixture(true);
  const rejected = busy.runtime.start(
    busy.plan,
    busy.owner,
    busy.reference,
    {},
  );
  assert.equal(rejected.status, "blocked");
  assert.equal(rejected.recoveryId, busy.reference.recoveryId);
  if (rejected.status !== "blocked") return;
  assert.equal(rejected.cleanupConfirmed, false);
  assert.equal(rejected.manualRecoveryRequired, true);
  assert.equal(busy.calls.length, 0);
  assert.deepEqual(busy.counts(), { cleanups: 0, releases: 0 });
});

/**
 * 不正な選定・参照は乱数と隔離Runtime構築より前に拒否する。
 * @responsibility 実ParserとFactoryへ接続し準備失敗のEffect零を確認する。
 * @trace ERB-IT-004
 * @precondition 隔離構築だけを有限代役へ替え、外部AI・Dockerは使わない。
 * @stimulus 未登録Model・種別差・動的項目、参照の重複・hole・Proxy・件数超過。
 * @observation 正例の準備成功と、負例の乱数・Runtime構築・Home取得零。
 * @oracle getter／Proxyを実行せず、Providerへ到達しない。
 * @cleanup Module代役を復元する。実資源は生成しない。
 */
test("不正な選定・参照は乱数と隔離構築より前に拒否する", async () => {
  const di = await import("../../../docker-isolation/src/index.ts");
  const ai = await import("../../../ai-adapter/src/index.ts");
  let runtimes = 0,
    randoms = 0,
    homes = 0,
    traps = 0;
  const mocked = mock.module(
    new URL("../../../docker-isolation/src/index.ts", import.meta.url).href,
    {
      namedExports: {
        ...di,
        createDockerIsolationRuntime: () => {
          runtimes++;
          return {
            acquireHomeLease: () => {
              homes++;
              throw Error("home_forbidden");
            },
          };
        },
      },
    },
  );
  try {
    const { createExecutor }: typeof import("../../src/attempt/execute.ts") =
      await import(
        new URL(
          "../../src/attempt/execute.ts?invalid-input-boundary",
          import.meta.url,
        ).href
      );
    const planned = ai.planProviderExecution(
      {
        provider: "claude",
        purpose: "advice",
        modelSelection: {
          provider: "claude",
          modelIdentifier: "opus",
          identifierKind: "alias",
          reasoningEffort: "low",
        },
        resultSchema: ai.describeAdviceResultSchema(),
      },
      di.describeDockerProviderExecutionLocations("claude", "advice"),
    );
    assert.ok(planned.plan);
    const command = di.bindAdviceCommand(planned.plan),
      commandHash = di.hashAdviceCommand(command);
    assert.ok(commandHash);
    const plan = attemptPlan();
    const base = {
      purpose: "advice" as const,
      input: "synthetic",
      command,
      commandHash,
      allowedReferences: ["ref-0"],
      selection: { ...plan.executionSelection, purpose: "advice" as const },
      target: {
        provider: plan.provider,
        operationId: plan.operationId,
        grantRef: plan.grantRef,
        providerHomeSourcePath: plan.providerHomeSourcePath,
        providerHomeIdentityHash: plan.providerHomeIdentityHash,
        providerHomeProtectionHash: plan.providerHomeProtectionHash,
        localUserBindingHash: plan.localUserBindingHash,
        stableLogicalHomeBindingHash: plan.stableLogicalHomeBindingHash,
        activeMountCapability: plan.activeMountCapability,
        workspaceSourcePath: "C:/synthetic/work",
        temporarySourcePath: "C:/synthetic/tmp",
      },
    };
    const options = {
      borrowPaths: () => ({
        tmp: "C:/synthetic/tmp",
        management: "C:/synthetic/management",
      }),
      inspectReceipts: () => null,
    };
    const random = {
      randomBytes: (size: number) => {
        randoms++;
        return Buffer.alloc(size, 1);
      },
    };
    for (const count of [1, 257, 1024]) {
      randoms = 0;
      runtimes = 0;
      assert.ok(
        createExecutor(
          {
            ...base,
            allowedReferences: Array.from(
              { length: count },
              (_, i) => `ref-${i}`,
            ),
          },
          options,
          random,
        ),
      );
      assert.equal(randoms, 2);
      assert.equal(runtimes, 1);
      assert.equal(homes, 0);
    }
    const dynamic = Object.defineProperty({ ...base.selection }, "provider", {
      enumerable: true,
      get() {
        traps++;
        throw Error("getter_forbidden");
      },
    });
    const proxy = new Proxy(["ref-0"], {
      getPrototypeOf() {
        traps++;
        throw Error("proxy_forbidden");
      },
    });
    const invalid: readonly unknown[] = [
      {
        ...base,
        selection: { ...base.selection, modelIdentifier: "unregistered-model" },
      },
      { ...base, selection: { ...base.selection, identifierKind: "exact" } },
      {
        ...base,
        selection: { ...base.selection, catalogIdentity: "not_input" },
      },
      { ...base, selection: dynamic },
      ...[
        ["ref-0", "ref-0"],
        new Array(1),
        proxy,
        Array.from({ length: 1025 }, (_, i) => `ref-${i}`),
      ].map((allowedReferences) => ({ ...base, allowedReferences })),
    ];
    for (const candidate of invalid) {
      randoms = 0;
      runtimes = 0;
      // @ts-expect-error 故障用unknownを公開入力境界へ搬送する。
      assert.equal(createExecutor(candidate, options, random), null);
      assert.equal(randoms, 0);
      assert.equal(runtimes, 0);
      assert.equal(homes, 0);
    }
    assert.equal(traps, 0);
  } finally {
    mocked.restore();
  }
});
