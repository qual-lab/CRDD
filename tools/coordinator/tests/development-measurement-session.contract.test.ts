import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  inspectRuntimeOwnedWindowsCandidateStore,
  inspectRuntimeOwnedWindowsRuntimeState,
} from "../src/security/candidate-store-windows-adapter.ts";
import { startRuntimeOwnedDevelopmentCoordinatorTask } from "../src/security/coordinator-task-runtime.ts";
import {
  createIsolatedDevelopmentMeasurementSessionCandidate,
  inspectRuntimeOwnedDevelopmentMeasurementSession,
} from "../src/security/development-measurement-session.ts";
import { confirmInteractiveConsoleChallengeOutcomeUsingAdapter } from "../src/security/external-send-grant-runtime.ts";
import { inspectRuntimeOwnedWindowsProviderHomeCandidate } from "../src/security/provider-home-windows-adapter.ts";
import { assertPresent } from "./test-support.ts";

const repositoryRoot = path.resolve(
  fileURLToPath(new URL("../../..", import.meta.url)),
);
const COMMIT = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TREE = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
function task(executor: "codex" | "claude") {
  return {
    frontProvider: executor === "codex" ? "claude" : "codex",
    requestedExecutorProvider: executor,
    objective: "Update one bounded fixture.",
    acceptanceCriteria: ["The expected content is present."],
    allowedPaths: ["fixture.txt"],
    readPaths: ["README.md", "fixture.txt"],
    workClass: "bounded_implementation",
    planState: "complete",
    risk: "low",
    difficulty: "low",
    decisionImpact: "limited",
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  };
}
function configuration() {
  return {
    repositoryRoot,
    expectedCommit: COMMIT,
    expectedTree: TREE,
    expectedPackageContentRootSha256: "c".repeat(64),
    nativeDistributionRoot: path.join(
      repositoryRoot,
      ".crdd",
      "signed-native-fixture",
    ),
    expectedNativeRelease: {
      manifestHash: "d".repeat(64),
      releaseSequence: 1,
      crddVersion: "0.18.0",
      crddCommit: "e".repeat(40),
      crddTree: "f".repeat(40),
      packageContentRootSha256: "1".repeat(64),
    },
    tasks: [task("codex"), task("claude")],
    expiresAtMs: 1_100,
  };
}
function harness() {
  const clock = { wall: 100, monotonic: 100 };
  const state = {
    identity: "2".repeat(64),
    isBlocked: false,
    confirmationCount: 0,
    notice: "",
    confirmationStatus: "confirmed" as
      | "confirmed"
      | "declined_invalid"
      | "cleanup_unknown"
      | "timeout",
    beforeConfirmation: () => {},
    observationThrows: false,
    operationValid: true,
    repositoryRoot,
    revision: COMMIT,
  };
  const operations = new WeakSet<object>();
  const repositories = new WeakMap<object, object>();
  const runtime = createIsolatedDevelopmentMeasurementSessionCandidate({
    observe: () => {
      if (state.observationThrows)
        throw new Error("private observation details");
      return {
        sourceIdentitySha256: state.identity,
        nativeIdentitySha256: "3".repeat(64),
        repositoryIdentitySha256: "4".repeat(64),
      };
    },
    confirm: async (notice) => {
      state.confirmationCount += 1;
      state.notice = notice;
      state.beforeConfirmation();
      return { status: state.confirmationStatus };
    },
    wallNow: () => clock.wall,
    monotonicNow: () => clock.monotonic,
    randomChallenge: () => "123456",
    isEffectBlocked: () => state.isBlocked,
    verifyOperation: (capability) => {
      if (
        !capability ||
        typeof capability !== "object" ||
        !operations.has(capability) ||
        !state.operationValid
      )
        throw new Error("invalid operation");
      return {
        operationId: "operation-1",
        createdAt: "2026-08-30T00:00:00Z",
        managementScopeBound: true,
      };
    },
    borrowRepository: (capability, management) => {
      if (
        !capability ||
        typeof capability !== "object" ||
        repositories.get(capability) !== management
      )
        return null;
      return {
        operationId: "operation-1",
        repositoryRoot: state.repositoryRoot,
        gitDirectory: path.join(repositoryRoot, ".git"),
        commonDirectory: path.join(repositoryRoot, ".git"),
        revision: state.revision,
      };
    },
  });
  function createOperation() {
    const management = Object.freeze({});
    const repository = Object.freeze({});
    operations.add(management);
    repositories.set(repository, management);
    return { management, repository };
  }
  return { runtime, state, clock, createOperation };
}

test("一回の確認から2Task・最大8呼出しへ結合し、試験tokenは本番へ流用できない", async () => {
  const { runtime, state, createOperation } = harness();
  const admitted = await runtime.request(
    configuration(),
    new AbortController().signal,
  );
  assert.equal(admitted.status, "authorized");
  assertPresent(admitted.capability);
  assert.equal(
    inspectRuntimeOwnedDevelopmentMeasurementSession(admitted.capability),
    null,
  );
  for (const executor of ["codex", "claude"] as const) {
    const taskCapability = runtime.reserveTask(
      admitted.capability,
      task(executor),
    );
    assertPresent(taskCapability);
    const { management, repository } = createOperation();
    assert.equal(
      runtime.bindOperation(taskCapability, management, repository),
      true,
    );
    assert.equal(
      runtime.bindOperation(taskCapability, management, repository),
      false,
    );
    for (const role of [
      "executor",
      "reviewer",
      "executor",
      "reviewer",
    ] as const) {
      const provider =
        role === "executor"
          ? executor
          : executor === "codex"
            ? "claude"
            : "codex";
      const invocation = runtime.reserveInvocation(
        taskCapability,
        provider,
        role,
      );
      assertPresent(invocation);
      assert.equal(
        runtime.consumeInvocation(taskCapability, invocation, provider, role),
        true,
      );
      assert.equal(
        runtime.consumeInvocation(taskCapability, invocation, provider, role),
        false,
      );
      assert.equal(runtime.settleInvocation(taskCapability, invocation), true);
    }
    assert.equal(
      runtime.reserveInvocation(taskCapability, executor, "executor"),
      null,
    );
    assert.equal(runtime.settleTask(taskCapability, "finished"), true);
    assert.equal(runtime.checkOperation(management), false);
    assert.equal(
      runtime.reserveTask(admitted.capability, task(executor)),
      null,
    );
  }
  assert.equal(state.confirmationCount, 1);
  assert.equal(runtime.inspect(admitted.capability)?.invocationCount, 8);
  assert.equal(
    (await runtime.request(configuration(), new AbortController().signal))
      .status,
    "blocked",
  );
  assert.equal(state.confirmationCount, 1);
});

for (const failure of [
  "expiry",
  "cancel",
  "source_replaced",
  "process_blocked",
  "observer_throw",
] as const) {
  test(`承認待ち中の${failure}は許可を発行しない`, async () => {
    const { runtime, state, clock } = harness();
    const abort = new AbortController();
    state.beforeConfirmation = () => {
      if (failure === "expiry") clock.wall = 1_100;
      if (failure === "cancel") abort.abort();
      if (failure === "source_replaced") state.identity = "5".repeat(64);
      if (failure === "process_blocked") state.isBlocked = true;
      if (failure === "observer_throw") state.observationThrows = true;
    };
    const result = await runtime.request(configuration(), abort.signal);
    assert.equal(result.status, "blocked");
    assert.equal(result.capability, null);
    assert.equal(
      JSON.stringify(result).includes("private observation details"),
      false,
    );
  });
}

for (const status of [
  "declined_invalid",
  "cleanup_unknown",
  "timeout",
] as const) {
  test(`確認結果${status}から実行許可へ昇格しない`, async () => {
    const { runtime, state } = harness();
    state.confirmationStatus = status;
    assert.equal(
      (await runtime.request(configuration(), new AbortController().signal))
        .capability,
      null,
    );
  });
}

test("不正設定・Task・追加keyは人間へ確認する前に拒否する", async () => {
  for (const invalid of [
    { ...configuration(), confirmed: true },
    { ...configuration(), expiresAtMs: 3_600_101 },
    { ...configuration(), tasks: [task("codex"), task("codex")] },
    {
      ...configuration(),
      tasks: [{ ...task("codex"), risk: "high" }, task("claude")],
    },
    {
      ...configuration(),
      tasks: [{ ...task("codex"), allowedPaths: [1] }, task("claude")],
    },
    new Proxy(configuration(), {
      get() {
        throw new Error("must not invoke proxy");
      },
    }),
  ]) {
    const { runtime, state } = harness();
    assert.equal(
      (await runtime.request(invalid, new AbortController().signal)).status,
      "blocked",
    );
    assert.equal(state.confirmationCount, 0);
  }
});

test("設定を承認待ち中に変更しても表示済みのTask snapshotだけに限定する", async () => {
  const { runtime, state } = harness();
  const config = configuration();
  state.beforeConfirmation = () => {
    const firstTask = config.tasks[0];
    assertPresent(firstTask);
    firstTask.objective = "Changed scope";
  };
  const result = await runtime.request(config, new AbortController().signal);
  assertPresent(result.capability);
  assert.equal(state.notice.includes("Changed scope"), false);
  assert.equal(runtime.reserveTask(result.capability, config.tasks[0]), null);
  assertPresent(runtime.reserveTask(result.capability, task("codex")));
});

test("偽Operation・別Repository・別Revision・別sessionへの再登録を拒否する", async () => {
  const { runtime, state, createOperation } = harness();
  const result = await runtime.request(
    configuration(),
    new AbortController().signal,
  );
  assertPresent(result.capability);
  const taskCapability = runtime.reserveTask(result.capability, task("codex"));
  assertPresent(taskCapability);
  const { management, repository } = createOperation();
  assert.equal(runtime.bindOperation(taskCapability, {}, repository), false);
  state.repositoryRoot = path.join(repositoryRoot, "other");
  assert.equal(
    runtime.bindOperation(taskCapability, management, repository),
    false,
  );
  state.repositoryRoot = repositoryRoot;
  state.revision = "9".repeat(40);
  assert.equal(
    runtime.bindOperation(taskCapability, management, repository),
    false,
  );
  state.revision = COMMIT;
  assert.equal(
    runtime.bindOperation(taskCapability, management, repository),
    true,
  );
  assert.equal(runtime.bindOperation({}, management, repository), false);
});

test("期限切れで新規消費を止めても既発行tokenの終了記録は可能・cleanup不明なら次Taskを止める", async () => {
  const { runtime, clock, createOperation } = harness();
  const result = await runtime.request(
    configuration(),
    new AbortController().signal,
  );
  assertPresent(result.capability);
  const taskCapability = runtime.reserveTask(result.capability, task("codex"));
  assertPresent(taskCapability);
  const { management, repository } = createOperation();
  assert.equal(
    runtime.bindOperation(taskCapability, management, repository),
    true,
  );
  const invocation = runtime.reserveInvocation(
    taskCapability,
    "codex",
    "executor",
  );
  assertPresent(invocation);
  clock.monotonic = 1_100;
  assert.equal(
    runtime.consumeInvocation(taskCapability, invocation, "codex", "executor"),
    false,
  );
  assert.equal(runtime.checkOperation(management), false);
  assert.equal(runtime.settleInvocation({}, invocation), false);
  assert.equal(runtime.settleInvocation(taskCapability, invocation), true);
  assert.equal(runtime.settleTask(taskCapability, "cleanup_unknown"), true);
  assert.equal(runtime.reserveTask(result.capability, task("claude")), null);
});

test("共通console lifecycleで開発版承認の目的を表示し外部送信だけの承認と混同しない", async () => {
  const writes: string[] = [];
  const result = await confirmInteractiveConsoleChallengeOutcomeUsingAdapter(
    "bounded scope",
    "123456",
    { input: 1, output: 2 },
    new AbortController().signal,
    {
      writeText: async (_handle, text) => {
        writes.push(text);
        return { status: "completed" };
      },
      readLine: async () => ({ status: "completed", line: "123456" }),
    },
    "development_measurement",
  );
  assert.equal(result.status, "confirmed");
  assert.match(writes.join(""), /この固定開発版による限定実測を承認/);
});

for (const stop of ["expiry", "cancel"] as const) {
  test(`${stop}後は新規native初期化を拒否し所有cleanupの読取り観測だけを残す`, async () => {
    const { runtime, clock, createOperation } = harness();
    const abort = new AbortController();
    const admitted = await runtime.request(configuration(), abort.signal);
    assertPresent(admitted.capability);
    const taskCapability = runtime.reserveTask(
      admitted.capability,
      task("codex"),
    );
    assertPresent(taskCapability);
    const { management, repository } = createOperation();
    assert.equal(
      runtime.bindOperation(taskCapability, management, repository),
      true,
    );
    const context = runtime.operationContext(management);
    assertPresent(context?.cleanupContext);
    assertPresent(runtime.borrowNativeObservation(taskCapability, true));
    if (stop === "expiry") clock.wall = 1_100;
    else abort.abort();
    assert.equal(runtime.borrowNativeObservation(taskCapability, true), null);
    assert.equal(runtime.borrowNativeObservation(taskCapability, false), null);
    assert.equal(
      runtime.borrowNativeObservation(context.cleanupContext, true),
      null,
    );
    assertPresent(
      runtime.borrowNativeObservation(context.cleanupContext, false),
    );
    assert.equal(runtime.borrowNativeObservation({}, false), null);
    assert.equal(runtime.settleTask(taskCapability, "finished"), true);
    assert.equal(
      runtime.borrowNativeObservation(context.cleanupContext, false),
      null,
    );
  });
}

test("cleanup観測も実装差替え・観測失敗・process不明を推測して継続しない", async () => {
  for (const failure of ["replacement", "throw", "poison"] as const) {
    const { runtime, state, createOperation } = harness();
    const admitted = await runtime.request(
      configuration(),
      new AbortController().signal,
    );
    assertPresent(admitted.capability);
    const taskCapability = runtime.reserveTask(
      admitted.capability,
      task("codex"),
    );
    assertPresent(taskCapability);
    const { management, repository } = createOperation();
    assert.equal(
      runtime.bindOperation(taskCapability, management, repository),
      true,
    );
    const context = runtime.operationContext(management);
    assertPresent(context?.cleanupContext);
    if (failure === "replacement") state.identity = "9".repeat(64);
    if (failure === "throw") state.observationThrows = true;
    if (failure === "poison") state.isBlocked = true;
    assert.equal(
      runtime.borrowNativeObservation(context.cleanupContext, false),
      null,
    );
    assert.equal(
      runtime.reserveInvocation(taskCapability, "codex", "executor"),
      null,
    );
  }
});

test("予約後にOperationが失われた場合は消費せず予約枠も払い戻さない", async () => {
  const { runtime, state, createOperation } = harness();
  const admitted = await runtime.request(
    configuration(),
    new AbortController().signal,
  );
  assertPresent(admitted.capability);
  const taskCapability = runtime.reserveTask(
    admitted.capability,
    task("codex"),
  );
  assertPresent(taskCapability);
  const { management, repository } = createOperation();
  assert.equal(
    runtime.bindOperation(taskCapability, management, repository),
    true,
  );
  const invocation = runtime.reserveInvocation(
    taskCapability,
    "codex",
    "executor",
  );
  assertPresent(invocation);
  state.operationValid = false;
  assert.equal(
    runtime.consumeInvocation(taskCapability, invocation, "codex", "executor"),
    false,
  );
  assert.equal(runtime.inspect(admitted.capability)?.invocationCount, 1);
  assert.equal(runtime.settleInvocation(taskCapability, invocation), true);
});

test("試験sessionのtokenは本番Task・native Home・Store・Runtime Stateへ権限を渡さない", async () => {
  const { runtime } = harness();
  const admitted = await runtime.request(
    configuration(),
    new AbortController().signal,
  );
  assertPresent(admitted.capability);
  const taskCapability = runtime.reserveTask(
    admitted.capability,
    task("codex"),
  );
  assertPresent(taskCapability);
  const now = new Date().toISOString();
  for (const outcome of [
    inspectRuntimeOwnedWindowsProviderHomeCandidate(
      "codex",
      now,
      taskCapability,
    ),
    inspectRuntimeOwnedWindowsCandidateStore(true, now, taskCapability),
    inspectRuntimeOwnedWindowsRuntimeState(true, now, taskCapability),
  ]) {
    assert.equal(outcome.status, "blocked");
    assert.match(outcome.reason, /development_context_invalid$/u);
    assert.equal(outcome.helperSpawnAttempts, 0);
    assert.equal(outcome.processEffectIssued, false);
    assert.equal(outcome.filesystemEffectIssued, false);
  }
  assert.throws(
    () =>
      startRuntimeOwnedDevelopmentCoordinatorTask(
        task("codex"),
        repositoryRoot,
        admitted.capability,
      ),
    /development_permission_required/u,
  );
});
