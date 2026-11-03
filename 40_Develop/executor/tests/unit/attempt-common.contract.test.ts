/**
 * 通常Attemptの共通DI接続を有限の技術境界で反証する。
 * @responsibility 五資源・九操作・通知・一次失敗・元結果相関の搬送を確認する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 実入力構築とAdapter本文。実Process・Docker・AIは使用しない。
 * @boundary DI共通Owner自体の保証はDIの共通Lifecycle試験で確認する。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as di from "../../../docker-isolation/src/index.ts";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import { PURPOSES } from "../../src/attempt/constants.ts";
import * as boundary from "../../src/attempt/operations.ts";
import type { AttemptPlan, IsolationRuntime } from "../../src/attempt/types.ts";
import { attemptPlan } from "../fixtures/attempt-plan.ts";

/**
 * Executor外側の未知例外をDIの技術失敗と取り違えない。
 * @responsibility 外側catchの固定診断と生例外非公開を確認する。
 * @trace ERB-UT-023
 * @precondition 本番executeAttempt本文と有限の実行・回収境界を使用する。
 * @stimulus code/messageの読取りを禁止した例外を実行代役から投げる。
 * @observation blocked結果、固定例外分類、例外Property読取り数。
 * @oracle unclassified_exceptionとなり、Property読取りは0回。
 * @cleanup N/A: 値とPromiseだけ。実Process・Docker・AIは使用しない。
 * @boundary Executor外側catch。DI内部の分類はDI試験で検証する。
 */
test("Executor外側の未知例外はDIとして再分類せず生値を公開しない", async () => {
  const source = readFileSync(
    new URL("../../src/attempt/operations.ts", import.meta.url),
    "utf8",
  );
  const execute = runInNewContext(
    sourceDeclaration(source, "executeAttempt") + "\nexecuteAttempt",
    {
      createConfigurationNotice: () => ({}),
      createCompletionResult: (value: unknown) => value,
      executeLifecycle: async (operations: {
        execute(): Promise<void>;
        cleanup(): Promise<void>;
        createResult(
          context: unknown,
          error: unknown,
          failed: boolean,
        ): unknown;
      }) => {
        await operations.execute();
        await operations.cleanup();
        return operations.createResult(null, null, false);
      },
    },
  );
  let reads = 0;
  const thrown = Object.defineProperties(
    {},
    {
      code: {
        get() {
          reads++;
          throw Error("must_not_read");
        },
      },
      message: {
        get() {
          reads++;
          throw Error("must_not_read");
        },
      },
    },
  );
  const notices: Array<{ primaryFailure?: { exceptionCode: string } }> = [];
  const result = await execute(
    {
      callbacks: {
        onDiagnostic: (notice: (typeof notices)[number]) => {
          notices.push(notice);
        },
      },
      isolation: {
        startExecution: () => {
          throw thrown;
        },
        cleanupOwnedResources: async () => ({
          confirmed: false,
          processTreeTerminated: false,
          containersAbsent: false,
          networksAbsent: false,
        }),
      },
    },
    { lifecycle: { cancellationRequested: false } },
    {
      operationId: "OP-123456",
      provider: "codex",
      taskRole: "executor",
    },
    { recoveryId: "exact-recovery" },
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    notices.at(-1)?.primaryFailure?.exceptionCode,
    "unclassified_exception",
  );
  assert.equal(reads, 0);
});

/**
 * 入力構築が既存のpayload・環境・Path条件を維持する。
 * @responsibility 構成Ownerの拒否条件を有限入力で確認する。
 * @trace ERB-UT-023
 * @precondition 本番の純粋構築から合成Planを取得する。
 * @stimulus 各件数・容量・Path境界を渡す。
 * @observation 受理又はnull。
 * @oracle 許容範囲だけ受理する。
 * @cleanup N/A: 値検査だけ。
 * @boundary Executorの入力構築。
 */
test("Request構築は旧payload上限と予約名・Path拒否を維持する", () => {
  const { plan } = fixture();
  const execution = boundary.resolveProviderExecution(plan);
  assert.ok(execution);
  const build = (
    argv: readonly string[],
    environment: Readonly<Record<string, string>>,
  ) =>
    boundary.resolveIsolationCommandInput(
      plan,
      "C:/synthetic/tmp",
      "a".repeat(64),
      { ...execution, argv, environment } as typeof execution,
    );
  assert.ok(build(Array(256).fill("arg"), {}));
  assert.equal(build(Array(257).fill("arg"), {}), null);
  assert.ok(
    build(
      execution.argv,
      Object.fromEntries(
        Array.from({ length: 64 }, (_, i) => [`SAFE_${i}`, "value"]),
      ),
    ),
  );
  assert.equal(
    build(
      execution.argv,
      Object.fromEntries(
        Array.from({ length: 65 }, (_, i) => [`SAFE_${i}`, "value"]),
      ),
    ),
    null,
  );
  for (const name of [
    "HOME",
    "TMPDIR",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
  ])
    assert.equal(build(execution.argv, { [name]: "untrusted" }), null);
  const empty = build([""], {});
  assert.ok(empty);
  const baseBytes = Buffer.byteLength(JSON.stringify(empty.execution), "utf8");
  assert.ok(build(["x".repeat(128 * 1024 - baseBytes)], {}));
  assert.equal(build(["x".repeat(128 * 1024 - baseBytes + 1)], {}), null);
  for (const temporary of [
    "relative",
    "C:/bad,path",
    "C:/bad\npath",
    "C:/bad\0path",
  ])
    assert.equal(
      boundary.resolveIsolationCommandInput(plan, temporary, "a".repeat(64)),
      null,
    );
});

/** 本番と同じ入力構築を実行し、共通DIだけを有限代役へ置換する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-UT-023
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-UT-023=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
function fixture() {
  const classification = Object.freeze({
    category: "completed" as const,
    stdoutBytes: 9,
    stderrBytes: 0,
  });
  const source = readFileSync(
    new URL("../../src/attempt/operations.ts", import.meta.url),
    "utf8",
  );
  const value = attemptPlan();
  const plan = boundary.prepareAttempt(
    { randomBytes: (size) => Buffer.alloc(size, 1) },
    {
      kind: "attempt",
      purpose: "probe",
      selection: value.executionSelection,
      target: {
        provider: value.provider,
        operationId: value.operationId,
        grantRef: value.grantRef,
        workspaceSourcePath: "C:/synthetic/work",
        temporarySourcePath: "C:/synthetic/tmp",
        providerHomeSourcePath: value.providerHomeSourcePath,
        providerHomeIdentityHash: value.providerHomeIdentityHash,
        providerHomeProtectionHash: value.providerHomeProtectionHash,
        localUserBindingHash: value.localUserBindingHash,
        stableLogicalHomeBindingHash: value.stableLogicalHomeBindingHash,
        activeMountCapability: value.activeMountCapability,
      },
    },
    { tmp: "C:/synthetic/tmp", management: "C:/synthetic/management" },
  );
  assert.ok(plan);
  let request: di.IsolationRequest | null = null;
  let calls = 0;
  let failure: di.IsolationExecutionResult["failure"] = null;
  let snapshot: di.ResourceSnapshot | null = null;
  const context = {
    ...di,
    ...boundary,
    Object,
    WeakMap,
    PURPOSES,
    prepareIsolation: (input: di.IsolationRequest) => {
      request = input;
      return {};
    },
    executeIsolation: (
      _prepared: unknown,
      callbacks: di.IsolationCallbacks,
    ): di.IsolationExecution => {
      calls++;
      assert.ok(request);
      const current = request;
      snapshot = Object.freeze({
        resources: Object.freeze(
          current.resources.map((resource, index) =>
            Object.freeze({
              key: resource.key,
              identity: Object.freeze({
                kind: resource.kind,
                dockerId: String(index + 1).repeat(64),
                name: resource.name,
                ownershipLabel: resource.ownershipLabel,
              }),
              request: "issued" as const,
              configuration: Object.freeze({
                image: resource.kind === "container" ? resource.image : null,
                command: null,
                environmentNames: null,
                mounts: null,
                networks: null,
                internal:
                  resource.kind === "network" ? resource.internal : null,
              }),
            }),
          ),
        ),
      });
      const resources = snapshot;
      const completion = Promise.resolve().then(
        async (): Promise<di.IsolationExecutionResult> => {
          if (failure?.notification === "onNotIssued") {
            const step = current.steps.find(
              (step) => step.key === failure?.stepKey,
            );
            assert.ok(step);
            callbacks.onNotIssued?.(step);
          } else if (!failure) {
            for (const step of current.steps) {
              await callbacks.onSubmitting?.(step);
              if (step.action === "create")
                await callbacks.onCreated?.(step, resources);
              else if (step.action === "run") {
                await callbacks.onStarted?.(step);
                const response = {
                  status: 0,
                  signal: null,
                  stdout: "synthetic",
                  stderr: "",
                  outputExceeded: false,
                };
                const commandResult = {
                  observation: response,
                  elapsedMs: 1,
                  errorCode: null,
                  classification,
                  exitClass: "zero" as const,
                };
                await callbacks.onObserved?.(step, commandResult);
                await callbacks.onCompleted?.(step, commandResult);
              }
            }
          }
          return {
            failure,
            resources,
            cancellationRequested: false,
            processTerminationConfirmed: true,
            notificationDeliveryConfirmed: true,
            callbackRegistrationReleased: true,
            cleanup: {
              confirmed: true,
              configCleanupConfirmed: true,
              observations: resources.resources.map((resource) => ({
                key: resource.key,
                observation: "absent",
              })),
            },
          };
        },
      );
      return {
        completion,
        cancel: async () => ({
          cancellationRequested: true,
          processTerminationObserved: true,
        }),
      };
    },
  };
  const bind = runInNewContext(
    `${sourceDeclaration(source, "bindIsolationRuntime")}\nbindIsolationRuntime`,
    context,
  ) as (plan: AttemptPlan) => Omit<IsolationRuntime, "acquireHomeLease">;
  return {
    plan,
    bound: bind(plan),
    request: () => request,
    snapshot: () => snapshot,
    calls: () => calls,
    classification: () => classification,
    fail: (value: NonNullable<di.IsolationExecutionResult["failure"]>) => {
      failure = value;
    },
  };
}

/** 実構成と元結果だけを共通DIの一生涯へ結合する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-UT-023
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-UT-023=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("通常Attemptは五資源・九操作を共通DIへ一回接続し元Snapshotを返す", async () => {
  const f = fixture(),
    recovery = {},
    management = {};
  const events: string[] = [];
  let receivedClassification: unknown;
  assert.ok(f.bound.startExecution);
  const execution = f.bound.startExecution(f.plan, recovery, management, {
    onCommandObserved: (_purpose, _result, classification) => {
      receivedClassification = classification;
    },
    onCommandSubmitting: (key) => {
      events.push(key);
    },
  });
  const result = await execution.completion;
  assert.equal(f.calls(), 1);
  assert.strictEqual(receivedClassification, f.classification());
  assert.equal(result.executionExit, "zero");
  assert.strictEqual(f.request(), f.plan.isolationRequest);
  assert.equal("commands" in f.plan, false);
  assert.ok(Object.isFrozen(f.plan.isolationRequest));
  assert.ok(Object.isFrozen(f.plan.isolationRequest.resources));
  assert.ok(Object.isFrozen(f.plan.isolationRequest.resources[0]));
  assert.throws(() => {
    (f.plan.isolationRequest.resources as unknown as unknown[]).push({});
  }, TypeError);
  assert.equal(f.request()?.resources.length, 5);
  assert.deepEqual(
    Array.from(f.request()?.steps.map((step) => step.key) ?? []),
    Array.from(PURPOSES),
  );
  assert.deepEqual(events, Array.from(PURPOSES));
  assert.strictEqual(result.resourceSnapshot, f.snapshot());
  assert.equal(result.resourceObservations?.length, 5);
  assert.equal(result.cleanup.confirmed, true);
  const primary = f.request()?.steps.at(-1);
  assert.equal(primary?.action, "run");
  if (primary?.action === "run") {
    assert.equal(primary.timeoutMs, 300_000);
    assert.equal(primary.deadlineOrigin, "started");
  }
  assert.ok(
    f.bound.verifyCleanupOutcome?.(
      result.cleanup,
      f.plan,
      recovery,
      management,
    ),
  );
  assert.equal(
    f.bound.verifyCleanupOutcome?.(
      { ...result.cleanup },
      f.plan,
      recovery,
      management,
    ),
    null,
  );
  assert.equal(
    f.bound.verifyCleanupOutcome?.(
      result.cleanup,
      { ...f.plan },
      recovery,
      management,
    ),
    null,
  );
  assert.equal(
    f.bound.verifyCleanupOutcome?.(result.cleanup, f.plan, {}, management),
    null,
  );
  assert.equal(
    f.bound.verifyCleanupOutcome?.(result.cleanup, f.plan, recovery, {}),
    null,
  );
});

/** Handle取得と応答観測は技術Ownerが報告した実際の段階を保持する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-UT-023
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-UT-023=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("通常Attemptは共通DIの一次失敗と未発行通知名を推測で変更しない", async () => {
  for (const stage of ["start", "wait", "notification"] as const) {
    const f = fixture();
    f.fail({
      stepKey: "create_provider",
      stage,
      reason: "fixed_failure",
      kind: "threw",
      notification: stage === "notification" ? "onNotIssued" : null,
      commandHandleObtained: stage !== "start",
      responseObserved: stage === "notification",
      exceptionCode: "unknown",
    });
    assert.ok(f.bound.startExecution);
    const result = await f.bound.startExecution(f.plan, {}, {}, {}).completion;
    assert.equal(
      result.failure?.stage,
      stage === "notification"
        ? "gate"
        : stage === "start"
          ? "command_start"
          : "command_wait",
    );
    assert.equal(result.failure?.commandHandleObtained, stage !== "start");
    assert.equal(result.failure?.responseObserved, stage === "notification");
    if (stage === "notification")
      assert.equal(result.failure?.gate, "onCommandNotIssued");
  }
});

/**
 * 共通資源名と乱数検査が既存境界を二namespaceで維持することを確認する。
 *
 * @responsibility 有限実行namespace、実行Identity形式、63文字上限とBuffer取得長を反証する。
 * @trace ERB-UT-023
 * @precondition 実Docker・外部AIを使わず固定値を共通準備処理へ渡す。
 * @stimulus 二namespaceの正常値、不正Identity、名前長境界と乱数型・長さ違反を与える。
 * @observation 返却資源名、null、例外および乱数取得回数。
 * @oracle 既存prefixと上限を維持し、不正取得を補完しない。
 * @cleanup N/A: 局所値だけで実資源やStoreを作成しない。
 * @boundary N/A: Process内の値生成だけを確認する。
 */
test("Executorの準備資源名は実行Identity形式・63文字境界と乱数長を維持する", () => {
  const { createResourceNames, createRandomHex } = preparationFunctions();
  for (const executionNamespace of ["codex", "claude"] as const) {
    const names = createResourceNames(
      executionNamespace,
      "a".repeat(64),
      "b".repeat(16),
    );
    assert.ok(names);
    assert.deepEqual(
      { ...names },
      {
        internalNetworkName: `crdd-internal-${"b".repeat(16)}`,
        egressNetworkName: `crdd-egress-${"b".repeat(16)}`,
        proxyContainerName: `crdd-proxy-${"b".repeat(16)}`,
        authContainerName: `crdd-auth-${"b".repeat(16)}`,
        providerContainerName: `crdd-${executionNamespace}-${"a".repeat(16)}`,
        ownershipLabel: `crdd.coordinator.runtime=${"b".repeat(16)}`,
      },
    );
    for (const executionIdentityHash of [
      "",
      "a".repeat(63),
      "a".repeat(65),
      "A".repeat(64),
      "g".repeat(64),
    ])
      assert.equal(
        createResourceNames(
          executionNamespace,
          executionIdentityHash,
          "b".repeat(16),
        ),
        null,
      );
    const maximumSuffix = 63 - "crdd-internal-".length;
    assert.equal(
      createResourceNames(
        executionNamespace,
        "a".repeat(64),
        "b".repeat(maximumSuffix),
      )?.internalNetworkName.length,
      63,
    );
    assert.equal(
      createResourceNames(
        executionNamespace,
        "a".repeat(64),
        "b".repeat(maximumSuffix + 1),
      ),
      null,
    );
  }
  for (const namespace of ["", "CODEX", "other", "claude ", "codex;"]) {
    assert.equal(
      createResourceNames(namespace, "a".repeat(64), "b".repeat(16)),
      null,
    );
  }
  for (const bytes of [8, 32]) {
    for (const delta of [-1, 1]) {
      assert.equal(
        createRandomHex(
          { randomBytes: () => Buffer.alloc(bytes + delta) },
          bytes,
        ),
        null,
      );
    }
    const failure = new Error("exact_random_failure");
    assert.throws(
      () =>
        createRandomHex(
          {
            randomBytes: () => {
              throw failure;
            },
          },
          bytes,
        ),
      (error: unknown) => error === failure,
    );
  }
  let calls = 0;
  const state = {
    randomBytes: (size: number) => {
      calls += 1;
      return Buffer.alloc(size, 0xab);
    },
  };
  assert.equal(createRandomHex(state, 8), "ab".repeat(8));
  assert.equal(createRandomHex(state, 32), "ab".repeat(32));
  assert.equal(calls, 2);
  assert.equal(
    createRandomHex({ randomBytes: () => Buffer.alloc(7) }, 8),
    null,
  );
  assert.equal(
    createRandomHex(
      { randomBytes: () => new Uint8Array(8) as unknown as Buffer },
      8,
    ),
    null,
  );
  assert.throws(
    () =>
      createRandomHex(
        {
          randomBytes: () => {
            throw new Error("fixed_random_failure");
          },
        },
        8,
      ),
    /fixed_random_failure/u,
  );
});

/**
 * 不正な資源名・Label・DigestをHome排他より前に拒否する。
 * @responsibility Executorが所有する五資源の生成・開始文法を固定する。
 * @trace ERB-UT-023
 * @precondition 本番準備から得た合成Plan。技術接続は呼ばれると失敗する。
 * @stimulus 名の欠測・不正文法・重複、LabelとDigestの変異を渡す。
 * @observation 開始拒否と技術接続の呼出し回数。
 * @oracle 全変異を拒否し、Home取得・DI要求は0。
 * @cleanup N/A: メモリ内の有限値のみ。
 * @boundary Executor開始入力。実資源観測は行わない。
 */
test("資源Identityの不正はHome取得・DI要求より前に拒否する", () => {
  const { plan } = fixture();
  assert.equal(boundary.isAttemptPlanValid(plan), true);
  const nameKeys = [
    "authContainerName",
    "providerContainerName",
    "proxyContainerName",
    "internalNetworkName",
    "egressNetworkName",
  ] as const;
  for (const change of [
    ...nameKeys.flatMap((key, index) =>
      nameKeys.slice(index + 1).map((other) => ({ [key]: plan[other] })),
    ),
    { authContainerName: "" },
    { providerContainerName: "crdd-codex-invalid" },
    { internalNetworkName: plan.authContainerName },
    { ownershipLabel: "crdd.coordinator.runtime=invalid" },
    { providerImageDigest: "sha256:invalid" },
    { proxyImageDigest: "sha256:invalid" },
  ]) {
    let technicalCalls = 0;
    const state = {
      controls: new WeakMap(),
      callbacks: {},
      isolation: new Proxy({} as IsolationRuntime, {
        get() {
          technicalCalls++;
          throw Error("must_not_call");
        },
      }),
    };
    const result = boundary.start(
      state,
      { ...plan, ...change },
      {},
      {
        recoveryId: `docker-task.${plan.stableLogicalHomeBindingHash}.${"b".repeat(64)}.${"c".repeat(64)}`,
        recoveryCapability: {},
      },
    );
    assert.equal(result.status, "blocked");
    assert.equal(technicalCalls, 0);
  }
});

/**
 * 認証Home環境の既存境界を構成Ownerの実本文で反証する。
 * @responsibility 予約環境名・不正名を拒否し、固定Home以外へ広げない。
 * @trace ERB-UT-023
 * @precondition Source本文だけを用い、実行・保存は行わない。
 * @stimulus 正規名、null、予約名と不正文法。
 * @observation 元環境値又はnull。
 * @oracle 不正値の補完・文字列変換なし。
 * @cleanup 局所VMのみ。実資源なし。
 */
test("Executorの認証環境構築は予約名を拒否し固定Homeだけを返す", () => {
  const { createAuthenticationEnvironment } = preparationFunctions();
  const accepted = createAuthenticationEnvironment("CODEX_HOME");
  assert.ok(accepted);
  assert.deepEqual({ ...accepted }, { CODEX_HOME: "/provider-home" });
  const empty = createAuthenticationEnvironment(null);
  assert.notEqual(empty, null);
  assert.deepEqual({ ...empty }, {});
  for (const name of [
    "",
    "HOME",
    "TMPDIR",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "bad-name",
    "CODEX_HOME\0",
  ])
    assert.equal(createAuthenticationEnvironment(name), null);
});

/**
 * 非公開の準備三関数を、既存Source抽出でそのまま有限試験へ接続する。
 * @responsibility 製品公開の試験入口を増やさず、正本の実本文だけを使う。
 * @trace ERB-UT-023
 * @precondition 同じPackageのSourceを読み取れる。
 * @stimulus 三宣言を構文木から選び、Bufferだけを共有する。
 * @observation 移管先の同じ関数。
 * @oracle 手書きの置換実装を使わない。
 * @cleanup メモリ内のVMのみ。
 */
function preparationFunctions(): {
  createRandomHex: (
    state: Readonly<{ randomBytes: (size: number) => Buffer }>,
    bytes: number,
  ) => string | null;
  createResourceNames: (
    namespace: string,
    identity: string,
    suffix: string,
  ) => Readonly<{
    internalNetworkName: string;
    egressNetworkName: string;
    proxyContainerName: string;
    authContainerName: string;
    providerContainerName: string;
    ownershipLabel: string;
  }> | null;
  createAuthenticationEnvironment: (
    name: string | null,
  ) => Readonly<Record<string, string>> | null;
} {
  const source = readFileSync(
    new URL("../../src/attempt/operations.ts", import.meta.url),
    "utf8",
  );
  const names = [
    "createRandomHex",
    "createResourceNames",
    "createAuthenticationEnvironment",
  ];
  return runInNewContext(
    names.map((name) => sourceDeclaration(source, name)).join("\n") +
      "\n({" +
      names.join(",") +
      "})",
    { Buffer },
  );
}
