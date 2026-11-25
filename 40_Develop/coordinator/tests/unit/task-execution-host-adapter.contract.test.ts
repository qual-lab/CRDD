/**
 * coordinator:unit:task-execution-host-adapterの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:task-execution-host-adapterが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope Identity値と既存保存・Process安全状態への局所接続。
 * @boundary PRL-UT-014=N/A: Coordinator Application Portは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";

import {
  createCoordinatorStableId,
  hashCoordinatorContent,
} from "../../src/lifecycle/validation.ts";
import {
  createExecutionProcessRecoveryIdentity,
  getExecutionProcessInstanceIdentity,
  inspectExecutionProcessRecoveryIdentity,
} from "../../src/lifecycle/host.ts";
import type { CoordinatorRecoveryTransition } from "../../src/lifecycle/types.ts";

/**
 * Queue具体保存の実Lease確認と更新値の遅延評価を確認する。
 * @responsibility 保存前の展開や別呼出しのLease持越しを反証する。
 * @trace PRL-UT-014
 * @precondition 具体保存関数の実宣言を一度捕捉しWriterだけを有限代役にする。
 * @stimulus 生存、欠測、差替え、null、borrow例外を独立に与える。
 * @observation 元Repository・世代、getter評価順、borrowと同じOwnerの観測。
 * @oracle Writer内でだけ評価し、元結果・例外を変更しない。
 * @cleanup N/A: 各呼出しの局所値だけを使う。
 * @boundary 実関数と有限Writer。実保存成立は別の結合試験で確認する。
 */
test("Queue具体保存は元更新をWriter内で遅延評価しLeaseを持ち越さない", () => {
  const source = fs.readFileSync(
    new URL("../../src/lifecycle/host.ts", import.meta.url),
    "utf8",
  );
  const declarations = [
    "writerLeaseAccess",
    "updateCoordinatorQueue",
    "updateCoordinatorSingleTask",
  ]
    .map((name) => stripTypeScriptTypes(sourceDeclaration(source, name)))
    .join("\n");
  const compile = new Function(
    "updateQueue",
    "borrowCoordinatorActiveLease",
    "activeLeaseIsObserved",
    "Date",
    `${declarations}; return { updateCoordinatorQueue, updateCoordinatorSingleTask };`,
  );
  for (const profile of [
    "active",
    "absent",
    "replaced",
    "null",
    "throws",
  ] as const) {
    const events: string[] = [];
    const repository = Object.freeze({});
    const lease = profile === "null" ? null : Object.freeze({ profile });
    const active = {
      kind: "project-operation",
      repositoryRoot: "root",
      repositoryBindingId: "binding",
      projectId: "project",
      queueId: "queue",
      ownerGeneration: "owner",
    };
    const failure = new Error("borrow-failed");
    const outcome = Object.freeze({ status: "blocked", reason: "original" });
    const next = Object.defineProperties(
      {},
      Object.fromEntries(
        Object.entries({
          state: "running",
          resumeCondition: "resume",
          resultReference: "reference",
          lease,
        }).map(([key, value]) => [
          key,
          {
            get: () => {
              events.push(key);
              return value;
            },
          },
        ]),
      ),
    );
    const raw = Object.freeze({ source: "single" });
    const run = compile(
      (
        actualRepository: unknown,
        binding: string,
        request: {
          kind: string;
          input: [
            string,
            number,
            Record<string, unknown>,
            {
              borrowActiveLease: () => unknown;
              isActiveLeaseObserved: () => boolean;
              now?: () => number;
            },
          ];
        },
      ) => {
        if (request.kind === "operation")
          assert.strictEqual(actualRepository, repository);
        else assert.deepEqual(actualRepository, { directory: "worktree" });
        assert.equal(binding, "binding");
        const [queueId, generation, values, access] = request.input;
        assert.equal(queueId, "queue");
        assert.equal(generation, 7);
        assert.equal(access.isActiveLeaseObserved(), false);
        if (request.kind === "operation") {
          assert.deepEqual(events, []);
          assert.equal(values.state, "running");
          assert.equal(values.resumeCondition, "resume");
          assert.equal(values.resultReference, "reference");
          assert.equal(values.leasePresent, lease !== null);
          assert.equal(values.leaseIsNull, lease === null);
          assert.equal(access.now, undefined);
        } else {
          assert.equal(request.kind, "single");
          assert.deepEqual(events, []);
          assert.strictEqual(values, raw);
          assert.equal(access.now?.(), 123);
        }
        const borrowed = access.borrowActiveLease();
        assert.deepEqual(
          borrowed,
          profile === "absent" || profile === "null" ? undefined : active,
        );
        assert.equal(access.isActiveLeaseObserved(), profile === "active");
        return outcome;
      },
      (actualLease: unknown) => {
        assert.strictEqual(actualLease, lease);
        if (profile === "throws") throw failure;
        return profile === "absent" || profile === "null" ? undefined : active;
      },
      (observed: unknown) => {
        assert.strictEqual(observed, active);
        return profile === "active";
      },
      {
        now() {
          events.push("now");
          return 123;
        },
      },
    ) as Record<
      "updateCoordinatorQueue" | "updateCoordinatorSingleTask",
      (...args: unknown[]) => unknown
    >;
    for (let invocation = 0; invocation < 2; invocation++) {
      events.length = 0;
      const execute = () =>
        run.updateCoordinatorQueue(
          { repository, repositoryBindingId: "binding" },
          "queue",
          7,
          next,
        );
      if (profile === "throws")
        assert.throws(execute, (error) => error === failure);
      else assert.strictEqual(execute(), outcome);
      assert.deepEqual(events, [
        "state",
        "resumeCondition",
        "resultReference",
        "lease",
        "lease",
        "lease",
      ]);
      events.length = 0;
      const executeSingle = () =>
        run.updateCoordinatorSingleTask(
          "worktree",
          "binding",
          "queue",
          7,
          lease,
          raw,
        );
      if (profile === "throws")
        assert.throws(executeSingle, (error) => error === failure);
      else assert.strictEqual(executeSingle(), outcome);
      assert.deepEqual(events, ["now"]);
    }
  }
});

/**
 * Task搬送前の取消とWorkspace照合を実Sourceの同じ断面で検証する。
 * @responsibility Portを経由せず元対象を照合し、拒否後に委譲しないことを確認する。
 * @trace PRL-UT-014
 * @precondition Graphの対象観測と委譲を含む実Source断面を一回だけ捕捉する。
 * @stimulus Direct／Isolated一致、別ID、欠測、観測不能、取消、前後の例外を与える。
 * @observation 元の観測引数、委譲、委譲前停止と実際の結果を区別する。
 * @oracle 同じWorkspaceだけを委譲し、取消なら観測0。委譲前停止で下位結果を作らない。
 * @cleanup N/A: 各差分は独立した局所値のみを使う。
 * @boundary Source断面と有限観測代役。実Git・実Writerの証明ではない。
 */
test("TaskのWorkspace直接観測は元対象を照合し取消では観測しない", async () => {
  const source = fs.readFileSync(
    new URL("../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("    let stoppedBeforeDelegation:");
  const end = source.indexOf("    const capturedOutcome", start);
  assert.ok(start > 0 && end > start);
  const evaluate = new Function(
    "confirmPreparedWorkspaceTarget",
    "runCoordinatorSingleTaskAttempt",
    "persistence",
    "input",
    "queue",
    "operation",
    `${stripTypeScriptTypes(`
      async function inspectTarget() {
        let delegated = false;
        const recording = null, attemptId = "attempt-a", operationId = "operation-a";
        const taskId = "task-a", state = { tasks: [], repositoryRevision: "revision-a" };
        const execution = { authorityBindingId: "authority-a" };
        const observeStarted = () => {};
        const waitForPreparation = async (observe) => observe();
        const preparationRefusal = (signal) => signal.aborted ? "cancelled" : "denied";
        const isCleanStateContention = () => false;
        ${source.slice(start, end)}
        return { delegated, stoppedBeforeDelegation, outcome };
      }`)}\nreturn inspectTarget();`,
  ) as (...args: unknown[]) => Promise<Record<string, unknown>>;
  for (const profile of [
    "direct",
    "isolated",
    "other",
    "missing",
    "unknown",
    "blocked",
    "cancelled",
    "observation_throws",
    "delegation_rejects",
  ] as const) {
    let observations = 0;
    let delegations = 0;
    const outcome = Object.freeze({ status: "completed" });
    const workspaceTarget = Object.freeze({ target: "prepared-by-caller" });
    const persistence = Object.freeze({
      workingDirectory: "original/nested",
      repositoryBindingId: "binding-a",
    });
    const result = await evaluate(
      (...args: unknown[]) => {
        observations++;
        assert.deepEqual(args, [
          persistence.workingDirectory,
          persistence.repositoryBindingId,
          "queue-a",
          workspaceTarget,
        ]);
        if (profile === "blocked" || profile === "unknown")
          return {
            status: profile,
            value: null,
            manualRecoveryRequired: false,
            recoveryId: null,
          };
        if (profile === "observation_throws") throw Error("synthetic");
        return {
          status: "completed",
          value: {
            workspaceId:
              profile === "other"
                ? "workspace-b"
                : profile === "direct"
                  ? null
                  : profile === "missing"
                    ? null
                    : "workspace-a",
          },
        };
      },
      async (attempt: Record<string, unknown>) => {
        delegations++;
        assert.deepEqual(attempt.workspaceTarget, {
          workspaceId: profile === "direct" ? null : "workspace-a",
        });
        if (profile === "delegation_rejects") throw Error("synthetic");
        return outcome;
      },
      persistence,
      {
        queueId: "queue-a",
        cancellationSignal: { aborted: profile === "cancelled" },
      },
      { workspaceId: profile === "direct" ? null : "workspace-a" },
      { workspaceTarget },
    );
    assert.equal(observations, profile === "cancelled" ? 0 : 1, profile);
    const matched = profile === "direct" || profile === "isolated";
    const delegated = matched || profile === "delegation_rejects";
    assert.equal(delegations, delegated ? 1 : 0, profile);
    assert.equal(result.delegated, delegated, profile);
    assert.strictEqual(result.outcome, matched ? outcome : null, profile);
    assert.equal(
      result.stoppedBeforeDelegation,
      profile === "cancelled"
        ? "cancelled"
        : delegated || profile === "observation_throws"
          ? null
          : "blocked",
      profile,
    );
  }
});

/**
 * 元の相関IDと内容Hashの値契約を検証する。
 *
 * @responsibility prefix、入力順、NUL区切り、40桁と64桁の使い分けを固定vectorで照合する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 空・複数要素・日本語の入力と内容差を純粋関数へ渡す。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("相関IDと内容Hashは元の区切り・順序・桁数を維持する", () => {
  const vectors: readonly [readonly string[], string][] = [
    [[], "e3b0c44298fc1c149afbf4c8996fb92427ae41e4"],
    [[""], "e3b0c44298fc1c149afbf4c8996fb92427ae41e4"],
    [["project", "task", "1"], "3465ddaaaffd5bd57c04d4cf1709fd6e8eb40fcf"],
    [["task", "project", "1"], "ad1db0ae9a58a7750f9dbe6af9b61889a0551ffb"],
    [["日本語", "実行"], "7e4a502f9d7fcd2d77e96ff96d0f757cfc51c8a9"],
    [["projecttask", "1"], "02ef8505705b26e1910732935549d020429c7d07"],
    [["project", "task1"], "2778d7c308fb1c04a466ff84f41b957e2d25a07d"],
  ];
  for (const [parts, digest] of vectors) {
    assert.equal(
      createCoordinatorStableId("attempt", parts),
      `attempt-${digest}`,
    );
    assert.equal(createCoordinatorStableId("queue", parts), `queue-${digest}`);
  }
  assert.equal(
    hashCoordinatorContent("content"),
    "ed7002b439e9ac845f22357d822bac1444730fbdb6016d3ec9432297b9ec9f73",
  );
  assert.doesNotMatch(
    fs.readFileSync(
      new URL("../../src/lifecycle/execution.ts", import.meta.url),
      "utf8",
    ),
    /performance\.now\s*\(/u,
  );
  assert.equal(
    createCoordinatorStableId("attempt", ["project", "task", "1"]),
    createCoordinatorStableId("attempt", ["project", "task", "1"]),
  );
  assert.notEqual(
    createCoordinatorStableId("attempt", ["project", "task", "1"]),
    createCoordinatorStableId("attempt", ["project", "task", "2"]),
  );
  assert.match(
    createCoordinatorStableId("attempt", ["project", "task", "1"]),
    /^attempt-[0-9a-f]{40}$/u,
  );
  assert.match(hashCoordinatorContent("content"), /^[0-9a-f]{64}$/u);
  assert.notEqual(
    hashCoordinatorContent("content"),
    hashCoordinatorContent("changed"),
  );
});

/**
 * Process世代と回復参照の照合・停止Ownerへの直接接続を検証する。
 *
 * @responsibility 元のProcess世代と相関を保ち、停止通知を既存Ownerへ一回渡す。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実Identity生成と照合を行い、実停止処理を独立した状態で呼ぶ。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("同じProcess世代の回復照合と既存停止Ownerへの直接接続を維持する", () => {
  const recoveryId = createExecutionProcessRecoveryIdentity(
    "attempt-12345678",
    "operation-12345678",
  );
  assert.match(getExecutionProcessInstanceIdentity(), /^[0-9a-f-]{36}$/u);
  assert.deepEqual(
    inspectExecutionProcessRecoveryIdentity(
      recoveryId,
      "attempt-12345678",
      "operation-12345678",
    ),
    {
      processIdentity: recoveryId.split(".")[1],
      recoveryId,
    },
  );

  const source = fs.readFileSync(
    new URL("../../src/lifecycle/host.ts", import.meta.url),
    "utf8",
  );
  const state = new Function(
    `${sourceDeclaration(source, "processCleanupUnknown")}
    ${sourceDeclaration(source, "poisonExecutionProcessAfterCleanupUnknown")}
    ${sourceDeclaration(source, "isExecutionProcessPoisoned")}
    return { poisonExecutionProcessAfterCleanupUnknown, isExecutionProcessPoisoned };`,
  )() as {
    poisonExecutionProcessAfterCleanupUnknown(): void;
    isExecutionProcessPoisoned(): boolean;
  };
  assert.equal(state.isExecutionProcessPoisoned(), false);
  state.poisonExecutionProcessAfterCleanupUnknown();
  assert.equal(state.isExecutionProcessPoisoned(), true);
});

const recoveryDiagnostic = sourceDeclaration(
  fs.readFileSync(
    new URL("../../src/lifecycle/environment.ts", import.meta.url),
    "utf8",
  ),
  "writeCoordinatorRecoveryDiagnostic",
);

/** 既存診断Writer本体を有限の出力先だけへ接続する。 */
function withRecoveryReporter(reporter: object) {
  return new Function(
    "productionRecoveryDiagnosticReporter",
    "return (" + recoveryDiagnostic + ");",
  )(reporter) as (event: CoordinatorRecoveryTransition) => void;
}

/**
 * 回復通知の内容と失敗境界を検証する。
 *
 * @responsibility 通知を凍結した値へ限定し、診断例外を実回復へ漏らさないことを確認する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実通知関数へ同期例外を返す通知先を渡す。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("回復通知はAuthorityを含まず診断の同期例外を回復へ漏らさない", async () => {
  let seen: CoordinatorRecoveryTransition | undefined;
  const observer = (event: CoordinatorRecoveryTransition) => {
    seen = event;
    throw new Error("diagnostic_unavailable");
  };
  const inspect = (event: CoordinatorRecoveryTransition) => {
    assert.equal(Object.isFrozen(event), true);
    assert.equal(Object.hasOwn(event, "acknowledgeDocker"), false);
    assert.deepEqual(
      Object.keys(event).sort(),
      [
        "phase",
        "projectId",
        "milestoneId",
        "queueId",
        "taskId",
        "operationId",
        "recoveryId",
        "stateGeneration",
      ].sort(),
    );
  };
  await assert.doesNotReject(async () => {
    await withRecoveryReporter({ report: observer })({
      phase: "required",
      projectId: "project-1",
      milestoneId: "milestone-1",
      queueId: "queue-1",
      taskId: "task-1",
      operationId: "operation-1",
      recoveryId: "recovery-1",
      stateGeneration: 2,
    });
  });
  assert.ok(seen);
  inspect(seen);
});

/**
 * 任意診断の処理状態を回復の進行条件から分離する。
 * @responsibility 同期例外・即時／後着拒否・未完了でも元の回復操作を一回進める。
 * @trace PRL-UT-014
 * @precondition 外部Effectのない回復操作と任意の診断代役。
 * @stimulus 診断を発行し、実回復の拒否結果を受けた後に遅い診断を拒否する。
 * @observation 同期return、回復呼出し数、exact参照とcleanup未確認。
 * @oracle 診断拒否を未処理にせず、回復結果を成功化・再送しない。
 * @cleanup 後着Promiseを解放する。永続pendingはhandleを持たない局所値だけ。
 * @boundary 回復操作と受動診断。
 */
test("任意の回復診断は未完了でも回復を止めず、後着拒否で結果を変えない", async () => {
  for (const mode of [
    "sync",
    "throw",
    "reject",
    "pending",
    "late_reject",
    "missing",
    "getter_throw",
  ] as const) {
    let recoveries = 0,
      notices = 0;
    let rejectLate!: (error: Error) => void;
    const late = new Promise<void>((_resolve, reject) => {
      rejectLate = reject;
    });
    const outcome = Object.freeze({
      status: "blocked",
      recoveryId: "exact-recovery",
      cleanupConfirmed: false,
    });
    const cancellationSignal = new AbortController().signal;
    const callbacks = {
      recoverTaskRecovery: (recoveryId: string, signal: AbortSignal) => {
        assert.equal(recoveryId, "exact-recovery");
        assert.strictEqual(signal, cancellationSignal);
        recoveries++;
        return outcome;
      },
      report(event: CoordinatorRecoveryTransition) {
        assert.strictEqual(this, callbacks);
        notices++;
        assert.equal(Object.isFrozen(event), true);
        if (mode === "throw") throw Error("diagnostic_failure");
        if (mode === "reject")
          return Promise.reject(Error("diagnostic_failure"));
        if (mode === "pending") return new Promise<void>(() => {});
        if (mode === "late_reject") return late;
      },
    };
    if (mode === "missing")
      assert.equal(Reflect.deleteProperty(callbacks, "report"), true);
    if (mode === "getter_throw")
      Object.defineProperty(callbacks, "report", {
        get() {
          notices++;
          throw Error("diagnostic_getter_failure");
        },
      });
    assert.equal(
      withRecoveryReporter(callbacks)({
        phase: "required",
        projectId: "p",
        milestoneId: "m",
        queueId: "q",
        taskId: null,
        operationId: null,
        recoveryId: "exact-recovery",
        stateGeneration: 1,
      }),
      undefined,
    );
    assert.equal(
      await callbacks.recoverTaskRecovery("exact-recovery", cancellationSignal),
      outcome,
    );
    if (mode === "late_reject")
      rejectLate(Error("diagnostic_failure_after_recovery"));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(recoveries, 1);
    assert.equal(notices, mode === "missing" ? 0 : 1);
    assert.equal(outcome.cleanupConfirmed, false);
    assert.equal(outcome.recoveryId, "exact-recovery");
  }
});
