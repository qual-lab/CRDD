/**
 * Attempt入力の事前拒否と共通資源APIの薄い搬送を確認する。
 * @responsibility 入力・Promise・不明値の保持と未知kindの処置0を反証する。
 * @trace ERB-IT-014
 * @level UT
 * @scope DIを有限代役へ置換。実Docker・AI・Filesystem処置は行わない。
 * @boundary DIの実体確認は既存DI試験が所有し、本試験は入口の配線だけを扱う。
 */
import assert from "node:assert/strict";
import test, { mock } from "node:test";

import type {
  DirectoryCleanupResult,
  DirectoryInspectionInput,
  RepairDisposalInput,
  RepairInput,
  RepairResult,
} from "../../../docker-isolation/src/docker-desktop/repair-session.ts";
import type {
  RepairCheckpoint,
  RepairRetentionTargets,
} from "../../../docker-isolation/src/docker-desktop/types.ts";
import type { ResourceTarget } from "../../src/index.ts";
import type {
  IsolationCallbacks,
  IsolationExecutionResult,
} from "../../../docker-isolation/src/index.ts";

/**
 * 保存済みSnapshotを用途別の旧投影へ変換せず共通DIへ搬送する。
 * @responsibility 元入力・通知・Session・最終結果の同一性を確認する。
 * @trace ERB-IT-014
 * @precondition DIの公開操作だけを有限代役へ置換する。
 * @stimulus Snapshot観測・単独回収・取消と最終結果待機を行う。
 * @observation 入力、Callback、SessionとCompletionの参照。
 * @oracle 再構築・コピー・取消の別経路を追加しない。
 * @cleanup Module代役を解除し、試験Promiseの完了を確認する。
 * @boundary Executor公開入口から有限DI接続。実Docker・Filesystem操作なし。
 */
test("Snapshot入口は元DI入力・通知・取消とCompletionを直接搬送する", async (t) => {
  const target: ResourceTarget<"snapshot"> = {
    managementDirectory: "C:\\synthetic\\management",
    resources: { resources: [] },
    cleanupOrder: [],
    setupTimeoutMs: 10000,
    unreceiptedAbsence: "retain",
    verifyLabelAbsence: false,
    previouslyAbsent: [],
  };
  const result: IsolationExecutionResult = {
    failure: null,
    resources: target.resources,
    cancellationRequested: false,
    processTerminationConfirmed: false,
    notificationDeliveryConfirmed: null,
    callbackRegistrationReleased: true,
    cleanup: {
      confirmed: false,
      configCleanupConfirmed: true,
      observations: [],
    },
  };
  const observed = { status: "blocked", resources: [] };
  let calls = 0;
  let cancellations = 0;
  const execution = {
    cancel: async () => {
      cancellations++;
      return { cancellationRequested: true, processTerminationObserved: false };
    },
    completion: Promise.resolve(result),
  };
  const callbacks: IsolationCallbacks = { onResourceIdentified: () => {} };
  const controller = new AbortController();
  const options = { signal: controller.signal, stopOnUnknownAbsence: true };
  const original = await import("../../../docker-isolation/src/index.ts");
  const lower = t.mock.module(
    new URL("../../../docker-isolation/src/index.ts", import.meta.url).href,
    {
      namedExports: {
        ...original,
        inspectIsolation: (input: unknown, received: unknown) => {
          calls++;
          assert.equal(input, target);
          assert.equal(received, options);
          return observed;
        },
        cleanupIsolation: (input: unknown, received: unknown) => {
          calls++;
          assert.equal(input, target);
          assert.equal(received, callbacks);
          return execution;
        },
      },
    },
  );
  t.after(() => lower.restore());
  const api: typeof import("../../src/lifecycle/cleanup.ts") = await import(
    new URL("../../src/lifecycle/cleanup.ts?snapshot-contract", import.meta.url)
      .href
  );
  assert.equal(api.inspectResources(target, options), observed);
  const returned = api.cleanupResources(target, callbacks);
  assert.equal(returned, execution);
  assert.equal((await returned.cancel()).processTerminationObserved, false);
  assert.equal(cancellations, 1);
  assert.equal(await returned.completion, result);
  assert.equal(calls, 2);
  let hooks = 0;
  const accessor = Object.defineProperty({ ...target }, "kind", {
    get() {
      hooks++;
      return "container";
    },
  });
  const inherited = Object.assign(
    Object.create({
      get kind() {
        hooks++;
        return "container";
      },
    }),
    target,
  );
  const prototypeProxy = Object.assign(
    Object.create(
      new Proxy(
        {},
        {
          has() {
            hooks++;
            throw Error("unexpected_prototype_has");
          },
          get() {
            hooks++;
            throw Error("unexpected_prototype_get");
          },
        },
      ),
    ),
    target,
  );
  const proxy = new Proxy(target, {
    get() {
      hooks++;
      throw Error("unexpected_proxy_get");
    },
    has() {
      hooks++;
      throw Error("unexpected_proxy_has");
    },
    getOwnPropertyDescriptor() {
      hooks++;
      throw Error("unexpected_proxy_descriptor");
    },
  });
  for (const invalid of [
    null,
    undefined,
    0,
    "snapshot",
    accessor,
    inherited,
    prototypeProxy,
    proxy,
  ]) {
    assert.throws(
      () => api.inspectResources(invalid as never),
      /resource_target_invalid/u,
    );
    assert.throws(
      () => api.cleanupResources(invalid as never),
      /resource_target_invalid/u,
    );
  }
  assert.equal(hooks, 0);
  assert.equal(calls, 2);
});

/**
 * 旧用途別Targetを公開入口へ再導入しない。
 * @responsibility 古い投影・Receipt束をDI接続より前に拒否する。
 * @trace ERB-IT-014
 * @boundary 値検査のみ。資源の取得・回収を実行しない。
 */
test("旧用途別Targetは技術要求前に拒否する", async () => {
  const { inspectResources, cleanupResources } = await import(
    "../../src/lifecycle/cleanup.ts"
  );
  for (const kind of ["resource_set", "authentication", "attempt", "unknown"]) {
    const target = { kind } as unknown as ResourceTarget;
    assert.throws(
      () => inspectResources(target as ResourceTarget<"container">),
      /resource_target_invalid/,
    );
    assert.throws(
      () => cleanupResources(target as ResourceTarget<"container">),
      /resource_target_invalid/,
    );
  }
});

/**
 * 固定Directoryの観測・回収と環境操作の薄い接続を検証する。
 * @responsibility 実在する下位操作へ元入力を渡す。
 * @trace ERB-IT-014
 * @precondition DIを有限代役へ置換する。
 * @stimulus 正常・取消・不明を与える。
 * @observation 元入力とPromise、処置数。
 * @oracle 元契約を変更せず、範囲外の要求を発行しない。
 * @cleanup Module代役を解除する。
 * @boundary Executor公開入口からDIへの接続。
 */
test("共通資源APIは固定DI入力と対象別の同期性を保持する", async () => {
  const calls: unknown[] = [];
  let targets: RepairRetentionTargets | null = null;
  let cleanup: Promise<DirectoryCleanupResult> = Promise.resolve({
    request: "not_issued",
    absence: "unknown",
  });
  const repairResult: RepairResult = Object.freeze({
    preparation: "boundary_unavailable",
    machine: null,
    lifecycle: null,
    checkpoint: null,
    finalCheckpointConfirmed: false,
    ownerBindingSha256: null,
    scopeSha256: null,
  });
  const repaired = Promise.resolve(repairResult);
  const unexpected = () => {
    throw Error("unexpected_attempt_operation");
  };
  const original = await import("../../../docker-isolation/src/index.ts");
  const lower = mock.module(
    new URL("../../../docker-isolation/src/index.ts", import.meta.url).href,
    {
      namedExports: {
        ...original,
        createTrustedDockerRecoveryExecutor: unexpected,
        planDockerRecoveryResourceExpectations: unexpected,
        codexAdviceProviderInitRequired: unexpected,
        inspectIsolation: (target: { kind: string; input: unknown }) => {
          assert.equal(target.kind, "docker_runtime_directory");
          calls.push(target.input);
          return targets;
        },
        cleanupIsolation: (target: { kind: string; input: unknown }) => {
          assert.equal(target.kind, "docker_runtime_directory");
          calls.push(target.input);
          return cleanup;
        },
        observeDockerRuntimeBackendState: unexpected,
        observeDockerRuntimeEngine: unexpected,
        restartDockerRuntime: unexpected,
        restartDockerEnvironment: (request: {
          mode: string;
          input: unknown;
        }) => {
          assert.equal(request.mode, "repair");
          calls.push(request.input);
          return repaired;
        },
        runDockerRuntimeRepairSession: (input: unknown) => {
          calls.push(input);
          return repaired;
        },
      },
    },
  );
  try {
    const { inspectResources, cleanupResources } = (await import(
      new URL(
        "../../src/lifecycle/cleanup.ts?directory-contract",
        import.meta.url,
      ).href
    )) as typeof import("../../src/lifecycle/cleanup.ts");
    const { restartDockerEnvironment } = (await import(
      new URL("../../src/index.ts?directory-contract", import.meta.url).href
    )) as typeof import("../../src/index.ts");
    const controller = new AbortController();
    const checkpoint: RepairCheckpoint = {
      actions: Object.fromEntries(
        [
          "stop_runtime",
          "terminate_runtime",
          "stop_backend",
          "retain_runtime",
          "start_runtime",
          "stop_failed_runtime",
          "retain_failed_runtime",
          "retain_auxiliary_runtime",
          "restart_runtime",
        ].map((key) => [
          key,
          { intent: "not_saved", request: "not_issued", result: "unobserved" },
        ]),
      ) as RepairCheckpoint["actions"],
      directories: {
        primary: {
          expected: null,
          source: { state: "unobserved", identity: null },
          retained: { state: "unobserved", identity: null },
        },
        failed: {
          expected: null,
          source: { state: "unobserved", identity: null },
          retained: { state: "unobserved", identity: null },
        },
        auxiliary: {
          expected: null,
          source: { state: "unobserved", identity: null },
          retained: { state: "unobserved", identity: null },
        },
      },
      engine: "unobserved",
      stale: "unknown",
      hostSafety: "unknown",
      cleanup: "not_requested",
      cleanupFailure: null,
    };
    const inspect: DirectoryInspectionInput = Object.freeze({
      operationNonce: "a".repeat(64),
      ownerBindingSha256: "b".repeat(64),
      scopeSha256: "c".repeat(64),
      checkpoint,
      signal: controller.signal,
      canObserve: () => false,
    });
    assert.equal(
      inspectResources({ kind: "docker_runtime_directory", input: inspect }),
      null,
    );
    assert.equal(calls.at(-1), inspect);
    targets = Object.freeze({ primary: null, failed: null, auxiliary: null });
    assert.equal(
      inspectResources({ kind: "docker_runtime_directory", input: inspect }),
      targets,
    );
    const disposal: RepairDisposalInput = Object.freeze({
      operationNonce: inspect.operationNonce,
      ownerBindingSha256: inspect.ownerBindingSha256,
      scopeSha256: inspect.scopeSha256,
      checkpoint,
      purpose: "primary",
      signal: controller.signal,
      canIssueEffect: () => false,
    });
    for (const request of ["not_issued", "issued", "unknown"] as const) {
      for (const absence of ["confirmed_absent", "unknown"] as const) {
        const result = Object.freeze({ request, absence });
        cleanup = Promise.resolve(result);
        assert.equal(
          cleanupResources({
            kind: "docker_runtime_directory",
            input: disposal,
          }),
          cleanup,
        );
        assert.equal(calls.at(-1), disposal);
        assert.equal(await cleanup, result);
      }
    }
    controller.abort();
    assert.equal(
      cleanupResources({ kind: "docker_runtime_directory", input: disposal }),
      cleanup,
    );
    const failed = new Error("synthetic_lower_rejection");
    cleanup = Promise.reject(failed);
    await assert.rejects(
      cleanupResources({ kind: "docker_runtime_directory", input: disposal }),
      (error) => error === failed,
    );
    const request: RepairInput = Object.freeze({
      operationNonce: inspect.operationNonce,
      signal: controller.signal,
      resume: null,
      canIssueEffect: () => false,
      onPrepared: unexpected,
      onCheckpoint: unexpected,
    });
    assert.equal(
      restartDockerEnvironment({ mode: "repair", input: request }),
      repaired,
    );
    assert.equal(calls.at(-1), request);
    assert.equal(await repaired, repairResult);
    const before = calls.length;
    for (const kind of ["unknown", undefined]) {
      const bad = {
        kind,
        operationId: "o",
        recoveryId: "r",
      } as unknown as ResourceTarget<"container">;
      assert.throws(() => inspectResources(bad), /resource_target_invalid/);
      assert.throws(() => cleanupResources(bad), /resource_target_invalid/);
    }
    const proxy = new Proxy({} as ResourceTarget<"container">, {
      get: unexpected,
    });
    assert.throws(() => inspectResources(proxy), /resource_target_invalid/);
    assert.throws(() => cleanupResources(proxy), /resource_target_invalid/);
    assert.equal(calls.length, before);
  } finally {
    lower.restore();
  }
});
