/**
 * orchestrator:unit:state-queryの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility orchestrator:unit:state-queryが所有する検証責務を実行する。
 * @trace PPR-UT-006
 * @trace PRL-UT-006
 * @level UT
 * @scope project、runtime、state、query、public
 * @boundary PPR-UT-006=N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import {
  ExecutionStorageBlockedError,
  type ProjectExecutionState,
} from "../../../../execution-model/src/index.ts";
import { projectExecutionFixture } from "../../../../execution-model/tests/fixtures/execution-plan.ts";
import { sourceDeclaration } from "../../../../execution-model/tests/support/source-declaration.ts";
import { queryState } from "../../../src/index.ts";
import {
  coordinatorDataBoundaryBlocked,
  RepositoryDataBlockedError,
} from "../../../src/lifecycle/host.ts";
import { queryCoordinatorState } from "../../../src/lifecycle/query.ts";
import { snapshotPlainArray } from "../../../src/lifecycle/validation.ts";
import {
  COORDINATOR_STATE_QUERY_CONTRACT,
  inspectCoordinatorObjectiveResult,
  inspectCoordinatorProjection,
  inspectTaskStartCandidates,
  projectCoordinatorState,
} from "../../../src/lifecycle/validation.ts";
import { taskExecutionSelections } from "../../fixtures/ai-selection.ts";

/**
 * 照会は同じ断面の候補を完成投影で一度だけ受け付ける。
 * @responsibility 検査済み候補の破棄と再捕捉をなくし、不正候補の拒否を維持する。
 * @trace PPR-UT-006
 * @precondition 実照会宣言、実投影と合成の正常Stateを使用する。
 * @stimulus 正常・欠測・世代差・Revision差・候補とRevision両方の不正を与える。
 * @observation 完成投影の呼出し数と拒否理由、状態変更なし。
 * @oracle 一回の投影で受け付け、候補不正をRevision不正より先に拒否する。
 * @cleanup メモリ値のみ。
 * @boundary EMの観測結果と公開照会の投影。
 */
test("状態照会は完成投影で一度だけ候補を受け付ける", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/query.ts", import.meta.url),
    "utf8",
  );
  const state = runtimeState();
  const before = JSON.stringify(state);
  const base = {
    projectId: state.projectId,
    generation: state.generation,
    taskIds: ["task-a"],
  };
  let projections = 0;
  let inspections = 0;
  const query = new Function(
    "projectCoordinatorState",
    "inspectTaskStartCandidates",
    "snapshotPlainArray",
    "COORDINATOR_STATE_QUERY_CONTRACT",
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "queryCoordinatorState"))});`,
  )(
    (...args: Parameters<typeof projectCoordinatorState>) => {
      projections++;
      return projectCoordinatorState(...args);
    },
    (...args: Parameters<typeof inspectTaskStartCandidates>) => {
      inspections++;
      return inspectTaskStartCandidates(...args);
    },
    snapshotPlainArray,
    COORDINATOR_STATE_QUERY_CONTRACT,
  ) as typeof queryCoordinatorState;
  for (const [metadata, repositoryRevision, reason] of [
    [base, request.repositoryRevision, "coordinator_state_observed"],
    [null, request.repositoryRevision, "coordinator_state_observation_unknown"],
    [
      { ...base, generation: base.generation + 1 },
      request.repositoryRevision,
      "coordinator_state_observation_unknown",
    ],
    [base, "b".repeat(40), "coordinator_state_revision_mismatch"],
    [null, "b".repeat(40), "coordinator_state_observation_unknown"],
    [
      [base, base],
      request.repositoryRevision,
      "coordinator_state_observation_unknown",
    ],
  ] as const) {
    projections = 0;
    inspections = 0;
    const result = query(
      Object.freeze({
        projects: [state],
        taskStartCandidates: Array.isArray(metadata) ? metadata : [metadata],
      }),
      { ...request, repositoryRevision },
    );
    assert.equal(result.reason, reason);
    assert.equal(
      projections,
      reason === "coordinator_state_observation_unknown" ? 0 : 1,
    );
    assert.equal(inspections, Array.isArray(metadata) ? 2 : 1);
  }
  assert.equal(JSON.stringify(state), before);
});

/**
 * 保存失敗の結果は別Taskの既知義務と今回の回復参照を併合する。
 * @trace PRL-UT-006
 * @precondition 実dispatchの結果構築と終了処理を一度だけ捕捉する。
 * @stimulus 明示義務の有無・重複とQueue／Leaseの失敗位置だけを差分化する。
 * @observation exact ID・種別、unknown、清掃未確認と再起動flag。
 * @oracle 明示空集合も既知義務を消さず、古い義務だけから現在Processの再起動を推定しない。終端を書けない場合は成功結果を作らない。
 * @cleanup N/A: 各差分は独立したメモリ値だけを使用する。
 * @boundary 保存Portは有限代役。実保存7profileとは区別する。
 */
test("終端保存失敗は既知義務と今回分をQueue・Lease失敗後も保持する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("  const completeQueue =");
  const end = source.indexOf("  // Selection made before", start);
  assert.ok(start > 0 && end > start);
  const run = new Function(
    "mode",
    "options",
    `
    const COORDINATOR_EXECUTION_CONTRACT = 'fixture';
    ${sourceDeclaration(source, "result")}
    ${sourceDeclaration(source, "blocked")}
    ${stripTypeScriptTypes(sourceDeclaration(source, "blockExecution"))}
    const input = {projectId:'project-a', queueId:'queue-a'};
    const calls = [];
    const lease = {ownerGeneration:1, release:()=> {
      calls.push('release');
      return mode==='release' || mode==='queue_release' ? {status:'blocked',reason:'release_failed'} : {status:'completed'};
    }};
    let queue = {generation:1};
    const repository=Object.freeze({});
    const state = options.state;
    const persistence = {repository,repositoryBindingId:'binding'};
    const updateCoordinatorQueue=(context,id,generation,next)=>{
      if(context!==persistence || id!=='queue-a' || generation!==1 || next.lease!==lease)throw Error('wrong_queue_context');
      if (next.state==='integration_pending') {
        calls.push('integration');
        if (next.resultReference!=='project-result' || next.resumeCondition!=='objective_integration')
          throw Error('wrong_queue_transition');
        return mode==='integration_failed' || mode==='integration_failed_recovery_failed'
          ? {status:'blocked',reason:'integration_write_failed'}
          : {status:'completed',value:{generation:2}};
      }
      calls.push('write');
      if (next.state!=='recovery_required' || next.resumeCondition!=='owned_operation_failure')
        throw Error('wrong_recovery_transition');
      if (mode==='integration_failed_recovery_failed') return {status:'blocked',reason:'queue_failed'};
      return mode.startsWith('queue') ? {status:'blocked',reason:'queue_failed'} : {status:'completed',value:{generation:2}};
    };
    const settleCoordinatorSnapshotQueueLeaseRelease=(actualRepository,binding,id,generation,owner)=>{
      calls.push('settle');
      if(actualRepository!==repository || binding!=='binding' || id!=='queue-a' || generation!==2 || owner!==1)throw Error('wrong_lease_settlement');
      return mode==='settlement' ? {status:'blocked',reason:'settlement_failed'} : {status:'completed'};
    };
    const createCoordinatorStableId=()=> 'existing-id';
    const withWorkspaceResults=value=>value;
    ${sourceDeclaration(source, "finishOperationLease")}
    ${stripTypeScriptTypes(source.slice(start, end))}
    const outcome = mode.startsWith('integration') ? settleOwnedQueue(
      {state:'integration_pending',resumeCondition:'objective_integration',resultReference:'project-result'},
      () => {
        calls.push('project');
        return result(input, {
          status:'completed',reason:'integration_pending',stateGeneration:state.generation,
          completedTaskIds:options.completedTaskIds,cleanupConfirmed:true,
          manualRecoveryRequired:false,effectState:'settled',
        });
      },
      {completedTaskIds:options.completedTaskIds,processRestartRequired:options.processRestartRequired},
    ) : finalizeOwnedFailure('save_failed', options);
    return {...outcome, calls};
  `,
  ) as (mode: string, options: object) => Record<string, unknown>;
  for (const mode of [
    "normal",
    "queue",
    "release",
    "settlement",
    "queue_release",
  ]) {
    for (const explicit of [false, true]) {
      const old = { kind: "execution_process", recoveryId: "old-exact" };
      const current = { kind: "candidate", recoveryId: "new-exact" };
      const output = run(mode, {
        state: {
          generation: 4,
          tasks: [
            {
              recoveryObligations: [
                { ...old, phase: "required" },
                {
                  kind: "candidate",
                  recoveryId: "settled-id",
                  phase: "settled",
                },
              ],
            },
          ],
        },
        recoveryIds: explicit ? [current.recoveryId, current.recoveryId] : [],
        completedTaskIds: ["finished-task"],
        recoveryObligations: explicit ? [old, current, current] : [],
        processRestartRequired: explicit,
      });
      assert.deepEqual(
        output.recoveryIds,
        explicit ? [old.recoveryId, current.recoveryId] : [old.recoveryId],
      );
      assert.deepEqual(
        output.recoveryObligations,
        explicit ? [old, current] : [old],
      );
      assert.equal(output.processRestartRequired, explicit);
      assert.equal(output.status, "blocked");
      assert.equal(output.effectState, "unknown");
      assert.equal(output.cleanupConfirmed, false);
      assert.equal(output.manualRecoveryRequired, true);
      assert.equal(output.stateGeneration, 4);
      assert.deepEqual(output.completedTaskIds, ["finished-task"]);
      assert.equal(
        output.reason,
        {
          normal: "save_failed",
          queue: "queue_failed",
          release: "release_failed",
          settlement: "settlement_failed",
          queue_release: "release_failed",
        }[mode],
      );
      assert.deepEqual(
        output.calls,
        mode === "normal" || mode === "settlement"
          ? ["write", "release", "settle"]
          : ["write", "release"],
      );
    }
  }
  const state = {
    generation: 4,
    tasks: [
      {
        recoveryObligations: [
          { kind: "host", recoveryId: "known-recovery", phase: "required" },
        ],
      },
    ],
  };
  for (const [mode, calls, reason] of [
    [
      "integration",
      ["integration", "project", "release", "settle"],
      "integration_pending",
    ],
    [
      "integration_failed",
      ["integration", "write", "release", "settle"],
      "integration_write_failed",
    ],
    [
      "integration_failed_recovery_failed",
      ["integration", "write", "release"],
      "queue_failed",
    ],
  ] as const) {
    const outcome = run(mode, {
      state,
      completedTaskIds: ["finished-task"],
      processRestartRequired: true,
    });
    assert.deepEqual(outcome.calls, calls);
    assert.equal(outcome.reason, reason);
    assert.equal(outcome.stateGeneration, 4);
    assert.deepEqual(outcome.completedTaskIds, ["finished-task"]);
    const failed = mode !== "integration";
    assert.equal(outcome.status, failed ? "blocked" : "completed");
    assert.equal(outcome.cleanupConfirmed, !failed);
    assert.equal(outcome.processRestartRequired, failed);
    assert.deepEqual(outcome.recoveryIds, failed ? ["known-recovery"] : []);
  }
});

/**
 * Queue所有前後の終結が同じ解放順序と結果保存を使うことを確認する。
 * @responsibility 物理解放の重複と未所有Queueへの確定を反証する。
 * @trace PRL-UT-006
 * @precondition 実completeQueue断面を一回捕捉する。
 * @stimulus Queue有無と解放・確定の成功／拒否／例外を独立に与える。
 * @observation 呼出し順・回数、元世代・Owner、元回復群とWorkspace結果。
 * @oracle 解放は一回、成功かつQueueありだけ確定し、例外を握り潰さない。
 * @cleanup N/A: 各条件は独立したメモリ値のみ。
 * @boundary 実終結制御と有限Lease／Writer代役。
 */
test("Queue所有前後の終結は一回解放し対象がある場合だけ確定する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("  const completeQueue =");
  const end = source.indexOf("  const finalizeOwnedFailure =", start);
  assert.ok(start > 0 && end > start);
  const compile = new Function(
    "lease",
    "persistence",
    "input",
    "settleCoordinatorSnapshotQueueLeaseRelease",
    "withWorkspaceResults",
    `const COORDINATOR_EXECUTION_CONTRACT='fixture'; ${sourceDeclaration(source, "result")} ${sourceDeclaration(source, "finishOperationLease")} ${stripTypeScriptTypes(`function terminalControl() {const queue = {generation:7}; ${source.slice(start, end)} return completeQueue;}`)} return terminalControl();`,
  );
  for (const owned of [false, true])
    for (const mode of [
      "normal",
      "release_blocked",
      "settlement_blocked",
      "release_throw",
      "settlement_throw",
      "missing_target",
    ] as const) {
      const calls: string[] = [];
      const repository = Object.freeze({});
      const failure = new Error(mode);
      const workspaceResults = Object.freeze([{ result: "same-workspace" }]);
      const terminal = Object.freeze({
        status: "completed",
        reason: "original_result",
        stateGeneration: 4,
        completedTaskIds: ["task-a"],
        recoveryIds: ["exact-recovery"],
        recoveryObligations: [
          { kind: "execution_process", recoveryId: "exact-recovery" },
        ],
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        processRestartRequired: true,
        effectState: "settled",
      });
      const blocked =
        mode === "release_blocked" || (owned && mode === "settlement_blocked");
      const run = compile(
        {
          ownerGeneration: "owner-a",
          release: () => {
            calls.push("release");
            if (mode === "release_throw") throw failure;
            return mode === "release_blocked"
              ? { status: "blocked", reason: mode }
              : { status: "completed" };
          },
        },
        { repository, repositoryBindingId: "binding-a" },
        { projectId: "project-a", queueId: "queue-a" },
        (...args: unknown[]) => {
          calls.push("settlement");
          assert.deepEqual(args, [
            repository,
            "binding-a",
            "queue-a",
            7,
            "owner-a",
          ]);
          if (mode === "settlement_throw") throw failure;
          return mode === "settlement_blocked"
            ? { status: "blocked", reason: mode }
            : { status: "completed" };
        },
        (value: Record<string, unknown>) => {
          calls.push("projection");
          if (!blocked) assert.strictEqual(value, terminal);
          return { ...value, workspaceResults };
        },
      ) as (result: object, queue: object | null) => Record<string, unknown>;
      const execute = () =>
        run(
          terminal,
          owned
            ? mode === "missing_target"
              ? (undefined as never)
              : { generation: 7 }
            : null,
        );
      if (owned && mode === "missing_target") {
        assert.throws(execute, TypeError);
        assert.deepEqual(calls, ["release"]);
      } else if (
        mode === "release_throw" ||
        (owned && mode === "settlement_throw")
      ) {
        assert.throws(execute, (error) => error === failure);
        assert.deepEqual(
          calls,
          mode === "release_throw" ? ["release"] : ["release", "settlement"],
        );
      } else {
        const observed = execute();
        assert.deepEqual(
          calls,
          owned && mode !== "release_blocked"
            ? ["release", "settlement", "projection"]
            : ["release", "projection"],
        );
        assert.equal(observed.status, blocked ? "blocked" : terminal.status);
        assert.equal(observed.reason, blocked ? mode : terminal.reason);
        assert.equal(observed.stateGeneration, terminal.stateGeneration);
        assert.deepEqual(observed.completedTaskIds, terminal.completedTaskIds);
        assert.deepEqual(observed.recoveryIds, terminal.recoveryIds);
        assert.deepEqual(
          observed.recoveryObligations,
          terminal.recoveryObligations,
        );
        assert.equal(
          observed.processRestartRequired,
          terminal.processRestartRequired,
        );
        assert.strictEqual(observed.workspaceResults, workspaceResults);
        assert.equal(observed.cleanupConfirmed, !blocked);
        assert.equal(observed.manualRecoveryRequired, blocked);
        assert.equal(
          observed.effectState,
          blocked ? "unknown" : terminal.effectState,
        );
      }
    }
});

/**
 * 単発終結では物理解放後だけRootを検証し、runningの保存確定を禁止する。
 * @responsibility Graphと共用する終結処理が単発固有の順序・拒否条件を保つことを確認する。
 * @trace PRL-UT-006
 * @precondition 実終結宣言と独立した有限のLease・Repository・Queueを使う。
 * @stimulus 通常と明示回復のrunning、物理解放拒否・例外、Root例外、確定拒否・例外を与える。
 * @observation 呼出し順序、回数、元Queue／Owner世代と返却値又は同じ例外。
 * @oracle 解放一回、通常running又は解放拒否ではRoot・保存0、明示回復のrunningはEMへ委譲。
 * @cleanup Process内の値だけ。実Filesystem・AI・Dockerを使用しない。
 * @boundary 単発のLease終了と保存接続。実保存の成立は別の既存試験が所有する。
 */
test("共通終結は単発と明示回復の解放順・running分岐を保つ", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const compile = new Function(
    "settleCoordinatorSnapshotQueueLeaseRelease",
    `${sourceDeclaration(source, "finishOperationLease")} return finishOperationLease;`,
  );
  for (const mode of [
    "normal",
    "running",
    "recovery_running",
    "release_blocked",
    "release_throw",
    "settlement_blocked",
    "recovery_settlement_blocked",
    "settlement_throw",
  ]) {
    const calls: string[] = [];
    const repository = Object.freeze({
      directory: "original-working-directory",
    });
    const failure = new Error(mode);
    const released = {
      status: mode === "release_blocked" ? "blocked" : "completed",
      reason: mode,
    };
    const settled = {
      status: mode.endsWith("settlement_blocked") ? "blocked" : "completed",
      reason: mode,
      recoveryId: "settlement.original",
    };
    const finish = compile((...args: unknown[]) => {
      calls.push("settlement");
      assert.deepEqual(args, [repository, "binding", "request", 9, "owner"]);
      if (mode === "settlement_throw") throw failure;
      return settled;
    }) as (lease: object, target: object) => { status: string; reason: string };
    const invoke = () =>
      finish(
        {
          ownerGeneration: "owner",
          release: () => {
            calls.push("release");
            if (mode === "release_throw") throw failure;
            return released;
          },
        },
        {
          kind: mode.startsWith("recovery_") ? "single-recovery" : "single",
          root: "original-working-directory",
          binding: "binding",
          queueId: "request",
          queue: {
            generation: 9,
            state: mode.endsWith("running") ? "running" : "completed",
          },
        },
      );
    if (mode.endsWith("_throw"))
      assert.throws(invoke, (error) => error === failure);
    else {
      const observed = invoke();
      if (mode === "running") {
        assert.equal(observed.status, "blocked");
        assert.equal(
          observed.reason,
          "coordinator_task_lease_release_unconfirmed",
        );
      } else
        assert.strictEqual(
          observed,
          mode === "release_blocked" ? released : settled,
        );
    }
    assert.deepEqual(
      calls,
      mode === "running" || mode.startsWith("release_")
        ? ["release"]
        : ["release", "settlement"],
    );
  }
});

/**
 * 初期化済みの試験状態から値Contextだけを構成する。
 * @responsibility 内部Reader廃止後も同じ世代と未初期化・解放不明の分類を維持する。
 * @trace PRL-UT-006
 * @precondition Source本文と有限なReader返却値だけを使う。
 * @stimulus 正常値、真正不存在、読取り失敗、解放不明を与える。
 * @observation execution viewの一回観測、凍結した値と準備停止理由。
 * @oracle 不明を補完せず、正常時だけ操作を持たないContextを作る。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Co構成とEMの既存State照会。
 */
test("試験の値Context構成はexecution viewだけを一度取得する", () => {
  const source = stripTypeScriptTypes(
    sourceDeclaration(
      fs.readFileSync(
        new URL("../../fixtures/task-persistence-fixture.ts", import.meta.url),
        "utf8",
      ),
      "createTestPersistence",
    ),
    { mode: "strip" },
  );
  const root = {};
  let calls = 0;
  let reply: unknown = {
    status: "completed",
    reason: "ready",
    value: {},
  };
  const create = new Function(
    "readExecutionState",
    "resolveExecutionStorageDirectory",
    `${source}; return createTestPersistence;`,
  )(
    (actual: unknown, binding: string) => {
      calls++;
      assert.equal(actual, root);
      assert.equal(binding, "binding-a");
      return reply;
    },
    () => root,
  );
  const context = create("fixture-root", "binding-a");
  assert.deepEqual(context, {
    workingDirectory: "fixture-root",
    repository: root,
    repositoryBindingId: "binding-a",
    intake: undefined,
  });
  assert.equal(Object.isFrozen(context), true);
  assert.equal(Object.hasOwn(context, "readExecutionState"), false);
  for (const [value, expected] of [
    [
      { status: "completed", reason: "absent", value: null },
      "coordinator_snapshot_not_initialized",
    ],
    [
      { status: "blocked", reason: "read_unknown", value: null },
      "coordinator_snapshot_not_initialized",
    ],
    [
      {
        status: "blocked",
        reason: "coordinator_snapshot_lock_release_unconfirmed",
        value: null,
      },
      "coordinator_snapshot_lock_release_unconfirmed",
    ],
  ] as const) {
    reply = value;
    assert.throws(() => create("fixture-root", "binding-a"), {
      message: expected,
    });
  }
  assert.equal(calls, 4);
});

/**
 * 公開状態照会の本番本文が同じ保存版から表示を作ることを確認する。
 * @responsibility 再読取り削減と採用確認前後のfresh観測を区別する。
 * @trace PPR-UT-006
 * @precondition 正規の状態値と有限のRepository・保存観測を使う。
 * @stimulus 同改訂・採用済み別改訂・対象不存在・読取り不明を与える。
 * @observation 読取り数・採用確認数・同版の世代と受付世代。
 * @oracle 通常は一回、採用確認を挟む場合は二回取得し、追加Portを構築しない。
 * @cleanup N/A: Sourceの読取りと有限のメモリ代役だけ。
 * @boundary Co照会本文と固定下位結果。実Git・Lockの成立は主張しない。
 */
test("公開状態照会は同版のProjectを使い採用確認後だけ再取得する", () => {
  const querySource = fs.readFileSync(
    new URL("../../../src/lifecycle/query.ts", import.meta.url),
    "utf8",
  );
  const source = sourceDeclaration(querySource, "queryState");
  for (const mode of [
    "current",
    "adopted",
    "absent",
    "unknown",
    "unknown_without_recovery",
    "missing_snapshot",
    "wrong_schema",
  ] as const) {
    const state = runtimeState();
    const capability = {};
    let reads = 0;
    let adoptionChecks = 0;
    let queries = 0;
    let lastSnapshot: unknown;
    const storageUnknown =
      mode === "unknown" || mode === "unknown_without_recovery";
    const dependencies = {
      snapshotPlainArray,
      inspectTaskStartCandidates,
      inspectCoordinatorStateQuery: () => request,
      isPrincipalId: () => true,
      resolveVerifiedRepositoryRootFromWorkingDirectory: () => "fixture-root",
      getRepository: () => ({ capability }),
      readRepositorySnapshot: () => ({
        revisionIdentity: mode === "adopted" ? "b".repeat(40) : revision,
      }),
      resolveExecutionStorageDirectory: () => capability,
      deriveCoordinatorRepositoryBindingId: () => "binding-a",
      readExecutionState: (root: unknown, binding: string) => {
        assert.strictEqual(root, capability);
        assert.equal(binding, "binding-a");
        reads++;
        if (storageUnknown)
          return {
            status: "blocked",
            value: null,
            manualRecoveryRequired: mode === "unknown",
            recoveryId: mode === "unknown" ? "recovery-a" : null,
          };
        lastSnapshot =
          mode === "missing_snapshot"
            ? null
            : {
                projects:
                  mode === "absent" ? [] : [{ ...state, generation: reads }],
                queueEntries: [],
                schemaRevision: mode === "wrong_schema" ? 8 : 9,
                taskStartCandidates:
                  mode === "absent"
                    ? []
                    : [
                        {
                          projectId: state.projectId,
                          generation: reads,
                          taskIds: ["task-a"],
                        },
                      ],
              };
        return {
          status: "completed",
          value: lastSnapshot,
        };
      },
      workspacePlanReadyForAcceptance: () => {
        adoptionChecks++;
        assert.equal(reads, 1);
        return true;
      },
      createTestPersistence: () => assert.fail("unexpected_state_reread"),
      queryCoordinatorState: (
        observed: Parameters<typeof queryCoordinatorState>[0],
        query: typeof request,
      ) => {
        queries++;
        assert.strictEqual(observed, lastSnapshot);
        return queryCoordinatorState(observed, query);
      },
      COORDINATOR_PUBLIC_RUNTIME_CONTRACT: "public-fixture",
      COORDINATOR_STATE_QUERY_CONTRACT: "query-fixture",
    };
    const evaluate = new Function(
      ...Object.keys(dependencies),
      `${source}; return queryState;`,
    )(...Object.values(dependencies));
    const result = evaluate(request, "fixture-root", {
      principalId: "local:fixture",
    });
    assert.equal(reads, mode === "adopted" ? 2 : 1, mode);
    assert.equal(adoptionChecks, mode === "adopted" ? 1 : 0, mode);
    if (
      storageUnknown ||
      mode === "missing_snapshot" ||
      mode === "wrong_schema"
    ) {
      assert.equal(result.status, "blocked");
      assert.equal(result.reason, "coordinator_snapshot_not_initialized");
      assert.equal(result.observationState, "unknown");
      assert.equal(result.manualRecoveryRequired, mode === "unknown");
      assert.equal(result.cleanupConfirmed, true);
      assert.equal(result.effectState, "no_effect");
      assert.equal(result.projection, null);
      assert.equal(queries, 0);
      assert.equal(Object.hasOwn(result, "intakeEpoch"), false);
    } else {
      assert.equal(queries, 1);
      assert.equal(result.status, "completed");
      assert.equal(
        result.observationState,
        mode === "absent" ? "absent" : "observed",
      );
      assert.equal(
        result.projection?.generation ?? null,
        mode === "absent" ? null : reads,
      );
      assert.equal(Object.hasOwn(result, "intakeEpoch"), false);
      if (mode !== "absent") assert.equal(result.projection.generation, reads);
    }
  }
});

const revision = "a".repeat(40);
const request = Object.freeze({
  requestId: "query-a",
  projectId: "project-a",
  repositoryRevision: revision,
});

/**
 * 公開照会で既知の保存例外と、契約外の例外を区別する。
 * @trace PPR-UT-006
 * @precondition 検査済みの要求と有限のRepository読取り代役を用いる。
 * @stimulus 保存Readerから二種の既知例外と一般例外を返す。
 * @observation 元の回復参照、Effect、清掃確認と一般例外の同一性。
 * @oracle 既知例外だけを公開結果へ投影し、状態表示を呼ばない。
 * @cleanup N/A: 合成の値と例外だけ。
 * @boundary 公開照会の読取りと保存例外。
 */
test("公開状態照会は既知の保存例外だけを元の回復情報付きで返す", () => {
  const source = sourceDeclaration(
    fs.readFileSync(
      new URL("../../../src/lifecycle/query.ts", import.meta.url),
      "utf8",
    ),
    "queryState",
  );
  const blocked = {
    status: "blocked",
    reason: "repository_runtime_data_ignore_registration_blocked",
    effectIssued: true,
    effectStateUnknown: true,
    effectConfirmation: "unknown",
    cleanupConfirmed: false,
    retryAllowed: false,
    recoveryReference: "repository-local-ignore.exact-recovery-a",
    repositoryPathReported: false,
  } as const;
  const unexpected = Error("unexpected_query_error");
  for (const error of [
    new ExecutionStorageBlockedError(blocked),
    new RepositoryDataBlockedError(blocked),
    unexpected,
  ]) {
    const dependencies = {
      inspectCoordinatorStateQuery,
      isPrincipalId: () => true,
      resolveVerifiedRepositoryRootFromWorkingDirectory: () => "fixture-root",
      getRepository: () => ({ capability: {} }),
      readRepositorySnapshot: () => ({ revisionIdentity: revision }),
      resolveExecutionStorageDirectory: () => ({}),
      deriveCoordinatorRepositoryBindingId: () => "binding-a",
      readExecutionState: () => {
        throw error;
      },
      queryCoordinatorState: () => assert.fail("failed read cannot project"),
      ExecutionStorageBlockedError,
      RepositoryDataBlockedError,
      coordinatorDataBoundaryBlocked,
    };
    const run = new Function(
      ...Object.keys(dependencies),
      `return (${source});`,
    )(...Object.values(dependencies)) as typeof queryState;
    const read = () =>
      run(request, "fixture-root", { principalId: "local:test" });
    if (error === unexpected) assert.throws(read, (value) => value === error);
    else
      assert.deepEqual(
        read(),
        coordinatorDataBoundaryBlocked(
          error as ExecutionStorageBlockedError | RepositoryDataBlockedError,
        ),
      );
  }
});

/**
 * Host Storeを渡さない公開照会でも、認証Contextの欠測を拒否する。
 * @trace PPR-UT-006
 * @precondition 正規の照会要求と、参照してはならない所在を使う。
 * @stimulus 認証Contextなし又は不正Principalで照会する。
 * @observation 本人確認の固定拒否理由とEffect状態。
 * @oracle Repositoryを解決する前に認証不足で停止する。
 * @cleanup N/A: 読取り・保存前の拒否のみ。
 * @boundary 同一Processの公開入力検査。認証そのものの実測ではない。
 */
test("公開状態照会はHost Storeを認証の代替にせず未認証入力を拒否する", () => {
  for (const authentication of [undefined, { principalId: "" }]) {
    const result = queryState(request, "must-not-be-read", authentication);
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      "coordinator_authenticated_principal_not_verified",
    );
    assert.equal(result.effectState, "no_effect");
  }
});

/**
 * runtimeStateのTest準備責務を実行する。
 *
 * @responsibility runtimeStateがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PPR-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus runtimeStateを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
function runtimeState(): ProjectExecutionState {
  const created = projectExecutionFixture({
    taskExecutionSelections: taskExecutionSelections(),
    projectId: request.projectId,
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["Objectiveが受理される"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["Taskが完了する"] }],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["result.txt"],
        conflictKeys: [],
      },
    ],
    ownerGeneration: "owner-a",
  });
  assert.equal(created.status, "completed");
  assert.ok(created.state);
  return created.state;
}

/**
 * 未信頼の列挙値を暗黙に文字列化しないことを確認する。
 * @trace PRL-UT-006
 * @precondition 正常な投影・Objective・状態照会・外側停止を一度構築する。
 * @stimulus 列挙値・契約名・回復kindへ変換Hook付きObject又はProxyを渡す。
 * @observation null拒否、例外非漏出と変換Hook／Proxyの実行数。
 * @oracle 正常値は維持し、不正値は未知コードを一度も実行せず拒否する。
 * @cleanup メモリのみ。保存・外部Processを使わない。
 */
test("結果受付は列挙値Objectの暗黙変換を実行しない", () => {
  const state = runtimeState();
  const projection = projectCoordinatorState(state, {
    projectId: state.projectId,
    generation: state.generation,
    taskIds: ["task-a"],
  });
  const objective = {
    contract: "crdd-coordinator/objective-intake/v4",
    status: "blocked",
    reason: "fixture_pending",
    requestId: "request-a",
    projectId: projection.projectId,
    milestoneId: projection.milestoneId,
    queueId: null,
    projection,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
    recoveryIds: [],
    recoveryObligations: [],
    effectState: "no_effect",
  };
  const query = {
    contract: "crdd-coordinator/state-query/v2",
    status: "completed",
    reason: "coordinator_state_observed",
    requestId: "state-a",
    projectId: projection.projectId,
    repositoryRevision: revision,
    observationState: "observed",
    projection,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "no_effect",
  };
  const boundary = {
    contract: "crdd-coordinator/public-runtime/v2",
    status: "blocked",
    reason: "fixture_blocked",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "no_effect",
  };
  const recoverable = {
    ...objective,
    projection: null,
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    effectState: "unknown",
    recoveryIds: ["host.fixture"],
    recoveryObligations: [{ kind: "host", recoveryId: "host.fixture" }],
  };
  const cases: {
    name: string;
    valid: unknown;
    inspect: (value: unknown) => unknown;
  }[] = [];
  for (const key of [
    "milestoneState",
    "workProgress",
    "qualityState",
    "nextAction",
  ] as const)
    cases.push({
      name: `projection.${key}`,
      valid: projection[key],
      inspect: (value) =>
        inspectCoordinatorProjection({ ...projection, [key]: value }),
    });
  for (const key of ["status", "observationState"] as const)
    cases.push({
      name: `query.${key}`,
      valid: query[key],
      inspect: (value) =>
        inspectCoordinatorStateQueryResult({ ...query, [key]: value }),
    });
  for (const key of ["status", "effectState"] as const)
    cases.push({
      name: `objective.${key}`,
      valid: objective[key],
      inspect: (value) =>
        inspectCoordinatorObjectiveResult({ ...objective, [key]: value }),
    });
  for (const key of ["contract", "effectState"] as const)
    cases.push({
      name: `boundary.${key}`,
      valid: boundary[key],
      inspect: (value) =>
        inspectCoordinatorObjectiveResult({ ...boundary, [key]: value }),
    });
  cases.push({
    name: "recovery.kind",
    valid: "host",
    inspect: (value) =>
      inspectCoordinatorObjectiveResult({
        ...recoverable,
        recoveryObligations: [{ kind: value, recoveryId: "host.fixture" }],
      }),
  });
  for (const entry of cases) {
    assert.ok(entry.inspect(entry.valid), entry.name);
    let calls = 0;
    const convert = () => {
      calls++;
      return entry.valid;
    };
    const hook = {
      toString: convert,
      valueOf: convert,
      [Symbol.toPrimitive]: convert,
    };
    const proxy = new Proxy(
      {},
      {
        get() {
          calls++;
          throw Error("proxy_get");
        },
      },
    );
    for (const value of [hook, proxy]) {
      assert.doesNotThrow(() =>
        assert.equal(entry.inspect(value), null, entry.name),
      );
      assert.equal(calls, 0, entry.name);
    }
  }
});

/**
 * @trace PPR-UT-006
 * @precondition 同じState準備から差戻し・回復必要の差分だけを構築する。
 * @stimulus 実Producerの投影を共通受付・状態結果・Objective結果へ渡す。
 * @observation 状態と回復義務の保持、不正な組合せの拒否。
 * @oracle Producer正本の両状態は誤拒否せず、回復必要を成功やID欠測へ畳まない。
 * @cleanup メモリのみ。
 */
test("差戻しと回復必要はProducerから両結果受付まで一貫する", () => {
  const base = runtimeState();
  for (const mode of ["returned", "recovery_required"] as const) {
    const state: ProjectExecutionState = {
      ...base,
      milestone: { ...base.milestone, state: mode },
      objectives: base.objectives.map((entry) => ({
        ...entry,
        state: mode === "returned" ? "accepted" : "blocked",
      })),
      tasks: base.tasks.map((entry) => ({
        ...entry,
        state: mode === "returned" ? "completed" : "recovery_required",
      })),
    };
    const projection = projectCoordinatorState(state, {
      projectId: state.projectId,
      generation: state.generation,
      taskIds: [],
    });
    assert.deepEqual(inspectCoordinatorProjection(projection), projection);
    const query = {
      contract: "crdd-coordinator/state-query/v2",
      status: "completed",
      reason: "coordinator_state_observed",
      requestId: "state-a",
      projectId: state.projectId,
      repositoryRevision: revision,
      observationState: "observed",
      projection,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect",
    };
    assert.deepEqual(
      inspectCoordinatorStateQueryResult(query)?.projection,
      projection,
    );
    const recovery = mode === "recovery_required";
    const result = {
      contract: "crdd-coordinator/objective-intake/v4",
      status: "blocked",
      reason: "fixture_pending",
      requestId: "request-a",
      projectId: state.projectId,
      milestoneId: state.milestoneId,
      queueId: null,
      projection,
      cleanupConfirmed: !recovery,
      manualRecoveryRequired: recovery,
      processRestartRequired: false,
      recoveryIds: recovery ? ["host.fixture"] : [],
      recoveryObligations: recovery
        ? [{ kind: "host", recoveryId: "host.fixture" }]
        : [],
      effectState: recovery ? "unknown" : "no_effect",
    };
    const captured = inspectCoordinatorObjectiveResult(result);
    assert.ok(captured);
    assert.deepEqual(captured.projection, projection);
    assert.equal(
      inspectCoordinatorObjectiveResult({
        ...result,
        recoveryIds: [],
        recoveryObligations: [],
      }) === null,
      recovery,
    );
    assert.equal(
      inspectCoordinatorProjection({
        ...projection,
        humanDecisionRequired: false,
      }),
      null,
    );
  }
});

/**
 * 状態参照は閉じた要求だけを受け入れるを検証する。
 *
 * @responsibility 状態参照は閉じた要求だけを受け入れるの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 状態参照は閉じた要求だけを受け入れるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("状態参照は閉じた要求だけを受け入れる", () => {
  assert.deepEqual(inspectCoordinatorStateQuery(request), request);
  assert.equal(
    inspectCoordinatorStateQuery({ ...request, unexpected: true }),
    null,
  );
  for (const value of ["a", "a".repeat(128)]) {
    const input = { ...request, requestId: value, projectId: value };
    assert.deepEqual(inspectCoordinatorStateQuery(input), input);
  }
  for (const value of ["", "-a", "a\n", "a".repeat(129)]) {
    for (const key of ["requestId", "projectId"] as const)
      assert.equal(
        inspectCoordinatorStateQuery({ ...request, [key]: value }),
        null,
      );
  }
  for (const length of [39, 40, 41, 64, 65]) {
    const input = { ...request, repositoryRevision: "a".repeat(length) };
    assert.deepEqual(
      inspectCoordinatorStateQuery(input),
      length >= 40 && length <= 64 ? input : null,
    );
  }
});

/**
 * 状態参照はCoordinatorのcanonical投影だけを返すを検証する。
 *
 * @responsibility 状態参照はCoordinatorのcanonical投影だけを返すの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 状態参照はCoordinatorのcanonical投影だけを返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("状態参照はOrchestratorのcanonical投影だけを返す", () => {
  const state = runtimeState();
  let hooks = 0;
  const base = {
    projectId: state.projectId,
    generation: state.generation,
    taskIds: ["task-a"],
  };
  const sparse = new Array<string>(2);
  sparse[1] = "task-a";
  const accessor = {
    ...base,
    get taskIds() {
      hooks++;
      return ["task-a"];
    },
  };
  const proxy = new Proxy(base, {
    ownKeys() {
      hooks++;
      return Reflect.ownKeys(base);
    },
  });
  const arrayGetter = ["task-a"];
  Object.defineProperty(arrayGetter, "0", {
    enumerable: true,
    get() {
      hooks++;
      return "task-a";
    },
  });
  const arrayProxy = new Proxy(["task-a"], {
    ownKeys() {
      hooks++;
      return ["0", "length"];
    },
  });
  for (const invalid of [
    undefined,
    { ...base, taskIds: {} },
    { ...base, taskIds: ["missing"] },
    { ...base, taskIds: ["task-a", "task-a"] },
    { ...base, taskIds: sparse },
    { ...base, taskIds: arrayGetter },
    { ...base, taskIds: arrayProxy },
    accessor,
    proxy,
  ]) {
    const rejected = queryCoordinatorState(
      Object.freeze({
        projects: [state],
        taskStartCandidates: [invalid],
      }),
      request,
    );
    assert.equal(rejected.reason, "coordinator_state_observation_unknown");
    assert.equal(rejected.projection, null);
  }
  assert.equal(hooks, 0);
  const idle = queryCoordinatorState(
    Object.freeze({
      projects: [state],
      taskStartCandidates: [{ ...base, taskIds: [] }],
    }),
    request,
  );
  assert.equal(idle.projection?.nextAction, "wait_for_task");
  for (const taskStartCandidates of [
    null,
    {
      projectId: state.projectId,
      generation: state.generation + 1,
      taskIds: ["task-a"],
    },
  ]) {
    const unknown = queryCoordinatorState(
      Object.freeze({
        projects: [state],
        taskStartCandidates: [taskStartCandidates],
      }),
      request,
    );
    assert.equal(unknown.status, "blocked");
    assert.equal(unknown.reason, "coordinator_state_observation_unknown");
    assert.equal(unknown.projection, null);
  }
  const result = queryCoordinatorState(
    Object.freeze({
      projects: [state],
      taskStartCandidates: [
        {
          projectId: state.projectId,
          generation: state.generation,
          taskIds: ["task-a"],
        },
      ],
    }),
    request,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.observationState, "observed");
  assert.equal(result.projection?.projectId, request.projectId);
  assert.equal(result.effectState, "no_effect");
  assert.deepEqual(inspectCoordinatorStateQueryResult(result), result);
  assert.equal(
    inspectCoordinatorStateQueryResult({
      ...result,
      contract: "crdd-coordinator/public-runtime/v1",
    }),
    null,
  );
});

/**
 * 状態不存在は失敗や成功推定ではなくabsent観測として返すを検証する。
 *
 * @responsibility 状態不存在は失敗や成功推定ではなくabsent観測として返すの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 状態不存在は失敗や成功推定ではなくabsent観測として返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("状態不存在は失敗や成功推定ではなくabsent観測として返す", () => {
  const result = queryCoordinatorState(
    Object.freeze({
      projects: [],
      taskStartCandidates: null,
    }),
    request,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.observationState, "absent");
  assert.equal(result.projection, null);
});

/**
 * 異なるRepository改訂版の状態を現在値として返さないを検証する。
 *
 * @responsibility 異なるRepository改訂版の状態を現在値として返さないの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 異なるRepository改訂版の状態を現在値として返さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("異なるRepository改訂版の状態を現在値として返さない", () => {
  const result = queryCoordinatorState(
    Object.freeze({
      projects: [{ ...runtimeState(), repositoryRevision: "b".repeat(40) }],
      taskStartCandidates: [
        {
          projectId: runtimeState().projectId,
          generation: runtimeState().generation,
          taskIds: ["task-a"],
        },
      ],
    }),
    request,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_state_revision_mismatch");
  assert.equal(result.observationState, "unknown");
  assert.equal(result.projection, null);
});

/**
 * 複数Projectから要求したProjectと同版の候補だけを返す。
 * @trace PPR-UT-006
 * @precondition 内容が同一の別Projectと複数世代の候補が同じ断面にある。
 * @stimulus 別Project、古い世代、同版、同版重複の候補を組み合わせる。
 * @observation 公開状態、次操作及び観測不能の区分。
 * @oracle 別Projectや別世代で一致数を増やさず、同版重複は拒否する。
 * @cleanup N/A: 合成値だけ。
 * @boundary 取得済み実行断面と状態照会の表示。
 */
test("取得済み断面から指定Projectと同版の候補だけを選ぶ", () => {
  const state = runtimeState();
  const other = { ...state, projectId: "project-other" };
  const base = {
    projectId: state.projectId,
    generation: state.generation,
    taskIds: ["task-a"],
  };
  const snapshot = {
    projects: [other, state],
    taskStartCandidates: [
      { ...base, projectId: other.projectId },
      { ...base, generation: state.generation + 1 },
      base,
    ],
  };
  const result = queryCoordinatorState(snapshot, request);
  assert.equal(result.observationState, "observed");
  assert.equal(result.projection?.projectId, state.projectId);
  assert.equal(result.projection?.generation, state.generation);
  assert.equal(result.projection?.nextAction, "schedule_task");
  const duplicate = queryCoordinatorState(
    {
      ...snapshot,
      taskStartCandidates: [...snapshot.taskStartCandidates, base],
    },
    request,
  );
  assert.equal(duplicate.reason, "coordinator_state_observation_unknown");
  assert.equal(duplicate.projection, null);
});

import { parseExecutionActivityObservation } from "../../../src/lifecycle/query.ts";
import {
  inspectCoordinatorStateQuery,
  inspectCoordinatorStateQueryResult,
} from "../../../src/lifecycle/validation.ts";

/**
 * 取得済み活動観測を量だけで欠測へ変えない。
 * @trace PRL-UT-006
 * @precondition 10001出所と単発記録、51履歴eventの合成値を使う。
 * @stimulus 完全集合と重複・不明参照・閉Schema違反を渡す。
 * @observation 保持された件数と不正時のnull。
 * @oracle 観測済み内容の量とSchema・Identity相関を区別する。
 * @cleanup N/A: 純粋値だけ。
 */
test("活動結果は10001出所・単発記録と51eventを保持する", () => {
  const sources = Array.from({ length: 10001 }, (_, index) => ({
    repositoryId: `repo-${index.toString().padStart(5, "0")}`,
    revision: "a".repeat(40),
  }));
  const singleTasks = sources.map((source, index) => ({
    repositoryId: source.repositoryId,
    requestId: `request-${index}`,
    mode: "workspace_edit",
    phase: "settled",
    status: "unknown",
    cleanupConfirmed: false,
    recoveryRequired: true,
  }));
  const events = Array.from({ length: 51 }, (_, index) => ({
    repositoryId: sources[0]?.repositoryId,
    eventId: `execution-${(50 - index).toString(16).padStart(64, "0")}`,
    occurredAt: "2026-11-12T00:00:00.000Z",
    objectiveId: "objective-a",
    taskId: "task-a",
    attemptId: "attempt-a",
    status: "unknown",
    reason: "unknown",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
  }));
  const raw = {
    projectId: "project-a",
    state: "absent",
    reason: "runtime_activity_state_absent",
    projection: null,
    currentSourceRepositoryId: null,
    sources,
    eventState: "observed",
    eventReason: "runtime_activity_events_observed",
    events,
    eventContinuation: null,
    singleTasks,
  };
  const observed = parseExecutionActivityObservation(raw);
  assert.equal(observed?.sources.length, 10001);
  assert.equal(observed?.singleTasks?.length, 10001);
  assert.equal(observed?.events.length, 51);
  assert.equal(
    parseExecutionActivityObservation({
      ...raw,
      sources: [...sources, sources[0]],
    }),
    null,
  );
  assert.equal(
    parseExecutionActivityObservation({
      ...raw,
      events: [...events, events[0]],
    }),
    null,
  );
  assert.equal(
    parseExecutionActivityObservation({
      ...raw,
      singleTasks: [{ ...singleTasks[0], repositoryId: "missing" }],
    }),
    null,
  );
});
