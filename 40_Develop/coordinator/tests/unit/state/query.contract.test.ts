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
import type { ProjectExecutionState } from "../../../../execution-model/src/index.ts";
import { projectExecutionFixture } from "../../../../execution-model/tests/fixtures/execution-plan.ts";
import { sourceDeclaration } from "../../../../execution-model/tests/support/source-declaration.ts";
import { snapshotPlainArray } from "../../../src/input/snapshot.ts";
import type { CoordinatorStatePort } from "../../../src/state/persistence.ts";
import {
  inspectCoordinatorObjectiveResult,
  inspectCoordinatorProjection,
  inspectTaskStartCandidates,
  projectCoordinatorState,
  COORDINATOR_STATE_QUERY_CONTRACT,
} from "../../../src/state/projection.ts";

import {
  executeCoordinatorPublicStateQuery,
  queryCoordinatorState,
} from "../../../src/state/query.ts";
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
    new URL("../../../src/state/query.ts", import.meta.url),
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
  const query = new Function(
    "projectCoordinatorState",
    "inspectTaskStartCandidates",
    "COORDINATOR_STATE_QUERY_CONTRACT",
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "queryCoordinatorState"))});`,
  )(
    (...args: Parameters<typeof projectCoordinatorState>) => {
      projections++;
      return projectCoordinatorState(...args);
    },
    () => assert.fail("duplicate_candidate_intake"),
    COORDINATOR_STATE_QUERY_CONTRACT,
  ) as typeof queryCoordinatorState;
  for (const [metadata, repositoryRevision, reason] of [
    [base, request.repositoryRevision, "orchestrator_state_observed"],
    [
      null,
      request.repositoryRevision,
      "orchestrator_state_observation_unknown",
    ],
    [
      { ...base, generation: base.generation + 1 },
      request.repositoryRevision,
      "orchestrator_state_observation_unknown",
    ],
    [base, "b".repeat(40), "orchestrator_state_revision_mismatch"],
    [null, "b".repeat(40), "orchestrator_state_observation_unknown"],
  ] as const) {
    projections = 0;
    const result = query(
      reader({
        status: "completed",
        reason: "observed",
        value: state,
        taskStartCandidates: metadata,
      }),
      { ...request, repositoryRevision },
    );
    assert.equal(result.reason, reason);
    assert.equal(projections, 1);
  }
  assert.equal(JSON.stringify(state), before);
});

/**
 * 保存失敗の結果は別Taskの既知義務と今回の回復参照を併合する。
 * @trace PRL-UT-006
 * @precondition 実dispatchの結果構築と三つの終了closureを一度だけ捕捉する。
 * @stimulus 明示義務の有無・重複とQueue／Leaseの失敗位置だけを差分化する。
 * @observation exact ID・種別、unknown、清掃未確認と再起動flag。
 * @oracle 明示空集合も既知義務を消さず、古い義務だけから現在Processの再起動を推定しない。
 * @cleanup N/A: 各差分は独立したメモリ値だけを使用する。
 * @boundary 保存Portは有限代役。実保存7profileとは区別する。
 */
test("終端保存失敗は既知義務と今回分をQueue・Lease失敗後も保持する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/task/dispatch.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("  const completeWithoutOwnedQueue =");
  const end = source.indexOf("  // Selection made before", start);
  assert.ok(start > 0 && end > start);
  const run = new Function(
    "mode",
    "options",
    `
    const COORDINATOR_EXECUTION_CONTRACT = 'fixture';
    ${sourceDeclaration(source, "result")}
    ${sourceDeclaration(source, "blocked")}
    const input = {projectId:'project-a', queueId:'queue-a'};
    const lease = {ownerGeneration:1, release:()=> mode==='release' ? {status:'blocked',reason:'release_failed'} : {status:'completed'}};
    let queue = {generation:1};
    const dependencies = {persistence:{state:{
      updateQueue:()=>mode.startsWith('queue') ? {status:'blocked',reason:'queue_failed'} : {status:'completed',value:{generation:2}},
      settleQueueLeaseRelease:()=>mode==='settlement' ? {status:'blocked',reason:'settlement_failed'} : {status:'completed'}
    }}};
    if(mode==='queue_release') lease.release=()=>({status:'blocked',reason:'release_failed'});
    const stableId=()=> 'existing-id';
    const withWorkspaceResults=value=>value;
    ${stripTypeScriptTypes(source.slice(start, end))}
    return finalizeOwnedFailure('save_failed', options);
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
      const old = { kind: "runtime_process", recoveryId: "old-exact" };
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
    }
  }
});

/**
 * 既存State照会の受付世代だけでPortを構成する。
 * @responsibility 内部Reader廃止後も同じ世代と未初期化・解放不明の分類を維持する。
 * @trace PRL-UT-006
 * @precondition Source本文と有限なReader返却値だけを使う。
 * @stimulus 正常値、真正不存在、読取り失敗、解放不明を与える。
 * @observation 固定intake view、一回の照会、元epochと構成停止理由。
 * @oracle 不明を補完せず、正常時だけ同じepochでPortを作る。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Co構成とEMの既存State照会。
 */
test("現在Port構成はStateのexecution viewだけを一度取得する", () => {
  const source = stripTypeScriptTypes(
    sourceDeclaration(
      fs.readFileSync(
        new URL("../../../src/state/transaction.ts", import.meta.url),
        "utf8",
      ),
      "createCurrentCoordinatorPersistencePorts",
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
  const port = {};
  const create = new Function(
    "readState",
    "verifyRuntimePersistenceRepository",
    "createCoordinatorSnapshotPersistencePorts",
    `${source}; return createCurrentCoordinatorPersistencePorts;`,
  )(
    (actual: unknown, binding: string, scope: string) => {
      calls++;
      assert.equal(actual, root);
      assert.equal(binding, "binding-a");
      assert.equal(scope, "execution");
      return reply;
    },
    () => root,
    (directory: string, binding: string) => {
      assert.equal(directory, "fixture-root");
      assert.equal(binding, "binding-a");
      return port;
    },
  );
  assert.equal(create("fixture-root", "binding-a"), port);
  for (const [value, expected] of [
    [
      { status: "completed", reason: "absent", value: null },
      "orchestrator_snapshot_not_initialized",
    ],
    [
      { status: "blocked", reason: "read_unknown", value: null },
      "orchestrator_snapshot_not_initialized",
    ],
    [
      {
        status: "blocked",
        reason: "orchestrator_snapshot_lock_release_unconfirmed",
        value: null,
      },
      "orchestrator_snapshot_lock_release_unconfirmed",
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
  const source = stripTypeScriptTypes(
    sourceDeclaration(
      fs.readFileSync(
        new URL("../../../src/state/query.ts", import.meta.url),
        "utf8",
      ),
      "executeCoordinatorPublicStateQuery",
    ),
    { mode: "strip" },
  );
  for (const mode of ["current", "adopted", "absent", "unknown"] as const) {
    const state = runtimeState();
    const capability = {};
    let reads = 0;
    let adoptionChecks = 0;
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
      verifyRuntimePersistenceRepository: () => capability,
      deriveCoordinatorRepositoryBindingId: () => "binding-a",
      readState: (root: unknown, binding: string, scope: string) => {
        assert.strictEqual(root, capability);
        assert.equal(binding, "binding-a");
        assert.equal(scope, "execution");
        reads++;
        if (mode === "unknown")
          return {
            status: "blocked",
            value: null,
            manualRecoveryRequired: true,
          };
        return {
          status: "completed",
          value: {
            projects:
              mode === "absent" ? [] : [{ ...state, generation: reads }],
            queueEntries: [],
            schemaRevision: 9,
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
          },
        };
      },
      workspacePlanReadyForAcceptance: () => {
        adoptionChecks++;
        assert.equal(reads, 1);
        return true;
      },
      createCurrentCoordinatorPersistencePorts: () =>
        assert.fail("unexpected_state_reread"),
      queryCoordinatorState: (
        reader: Pick<CoordinatorStatePort, "readState">,
        query: typeof request,
      ) => {
        return queryCoordinatorState(reader, query);
      },
      COORDINATOR_PUBLIC_RUNTIME_CONTRACT: "public-fixture",
      COORDINATOR_STATE_QUERY_CONTRACT: "query-fixture",
    };
    const evaluate = new Function(
      ...Object.keys(dependencies),
      `${source}; return executeCoordinatorPublicStateQuery;`,
    )(...Object.values(dependencies));
    const result = evaluate(request, "fixture-root", {
      principalId: "local:fixture",
    });
    assert.equal(reads, mode === "adopted" ? 2 : 1, mode);
    assert.equal(adoptionChecks, mode === "adopted" ? 1 : 0, mode);
    if (mode === "unknown") {
      assert.equal(result.status, "blocked");
      assert.equal(result.observationState, "unknown");
      assert.equal(result.manualRecoveryRequired, true);
      assert.equal(Object.hasOwn(result, "intakeEpoch"), false);
    } else {
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
    const result = executeCoordinatorPublicStateQuery(
      request,
      "must-not-be-read",
      authentication,
    );
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      "orchestrator_authenticated_principal_not_verified",
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
    contract: "crdd-coordinator/orchestrator-objective-intake/v4",
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
    contract: "crdd-coordinator/orchestrator-state-query/v2",
    status: "completed",
    reason: "orchestrator_state_observed",
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
      contract: "crdd-coordinator/orchestrator-state-query/v2",
      status: "completed",
      reason: "orchestrator_state_observed",
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
      contract: "crdd-coordinator/orchestrator-objective-intake/v4",
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
 * readerのTest準備責務を実行する。
 *
 * @responsibility readerがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PPR-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus readerを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
function reader(
  result: ReturnType<CoordinatorStatePort["readState"]>,
): Pick<CoordinatorStatePort, "readState"> {
  return Object.freeze({ readState: () => result });
}

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
      reader({
        status: "completed",
        reason: "observed",
        value: state,
        taskStartCandidates: invalid as never,
      }),
      request,
    );
    assert.equal(rejected.reason, "orchestrator_state_observation_unknown");
    assert.equal(rejected.projection, null);
  }
  assert.equal(hooks, 0);
  const idle = queryCoordinatorState(
    reader({
      status: "completed",
      reason: "observed",
      value: state,
      taskStartCandidates: { ...base, taskIds: [] },
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
      reader({
        status: "completed",
        reason: "observed",
        value: state,
        taskStartCandidates,
      }),
      request,
    );
    assert.equal(unknown.status, "blocked");
    assert.equal(unknown.reason, "orchestrator_state_observation_unknown");
    assert.equal(unknown.projection, null);
  }
  const result = queryCoordinatorState(
    reader({
      status: "completed",
      reason: "observed",
      value: state,
      taskStartCandidates: {
        projectId: state.projectId,
        generation: state.generation,
        taskIds: ["task-a"],
      },
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
      contract: "crdd-coordinator/orchestrator-public-runtime/v1",
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
    reader({
      status: "completed",
      reason: "absent",
      value: null,
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
    reader({
      status: "completed",
      reason: "observed",
      value: { ...runtimeState(), repositoryRevision: "b".repeat(40) },
      taskStartCandidates: {
        projectId: runtimeState().projectId,
        generation: runtimeState().generation,
        taskIds: ["task-a"],
      },
    }),
    request,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "orchestrator_state_revision_mismatch");
  assert.equal(result.observationState, "unknown");
  assert.equal(result.projection, null);
});

/**
 * 観測不能と既存Recovery義務をEffect発行と混同しないを検証する。
 *
 * @responsibility 観測不能と既存Recovery義務をEffect発行と混同しないの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 観測不能と既存Recovery義務をEffect発行と混同しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("観測不能と既存Recovery義務をEffect発行と混同しない", () => {
  const result = queryCoordinatorState(
    reader({
      status: "blocked",
      reason: "store_unavailable",
      value: null,
      manualRecoveryRequired: true,
      recoveryId: "recovery-a",
    }),
    request,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.observationState, "unknown");
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.effectState, "no_effect");
});

import { parseRuntimeActivityObservation } from "../../../src/state/observation.ts";
import {
  inspectCoordinatorStateQuery,
  inspectCoordinatorStateQueryResult,
} from "../../../src/state/projection.ts";

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
  const observed = parseRuntimeActivityObservation(raw);
  assert.equal(observed?.sources.length, 10001);
  assert.equal(observed?.singleTasks?.length, 10001);
  assert.equal(observed?.events.length, 51);
  assert.equal(
    parseRuntimeActivityObservation({
      ...raw,
      sources: [...sources, sources[0]],
    }),
    null,
  );
  assert.equal(
    parseRuntimeActivityObservation({ ...raw, events: [...events, events[0]] }),
    null,
  );
  assert.equal(
    parseRuntimeActivityObservation({
      ...raw,
      singleTasks: [{ ...singleTasks[0], repositoryId: "missing" }],
    }),
    null,
  );
});
