/**
 * 公開Objectiveから固定選定をTask入力へ搬送する責務を検証する。
 *
 * @packageDocumentation
 * @responsibility 純粋builderが保存選定を保持し、再選定と権限生成を行わないことを確認する。
 * @trace PRL-UT-014
 * @level UT
 * @scope Objectiveの固定選定から単発Task要求の生成まで。
 * @boundary N/A: Provider、公開CLIと永続Runtimeを起動しない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";
import { compileFunction } from "node:vm";
import {
  inspectTaskExecutionSelections,
  isPrincipalId,
} from "../../../../execution-model/src/index.ts";
import {
  fixtureTaskExecutionSelections,
  projectExecutionFixture,
  withCallerPlan,
} from "../../../../execution-model/tests/fixtures/execution-plan.ts";
import { sourceDeclaration } from "../../../../execution-model/tests/support/source-declaration.ts";
import {
  createRuntimeProcessRecoveryIdentity,
  getRuntimeProcessInstanceIdentity,
} from "../../../src/lifecycle/host.ts";
import { createCoordinatorObjectiveResult } from "../../../src/lifecycle/execution.ts";
import { resolveTaskExecutionSelections } from "../../../src/lifecycle/selection.ts";
import {
  buildObjectiveTaskRequest,
  buildObjectiveTaskExecutions,
  inspectCoordinatorObjectiveResult,
  inspectTaskStartCandidates,
  captureTaskStartCandidates,
  validIdentity,
} from "../../../src/lifecycle/validation.ts";
import {
  createCoordinatorStableId,
  createProjectRecoveryApplicationId,
  hashCoordinatorContent,
} from "../../../src/lifecycle/validation.ts";
import { selectionConfig } from "../../fixtures/ai-selection.ts";

const objectiveRecoverySource = fs.readFileSync(
  new URL("../../../src/lifecycle/execution.ts", import.meta.url),
  "utf8",
);
const captureObjectiveRecoveryWrite = compileFunction(
  `return (${sourceDeclaration(objectiveRecoverySource, "captureObjectiveRecoveryWrite")});`,
  ["inspectTaskStartCandidates"],
)(inspectTaskStartCandidates);
const wasObjectiveStateUninitialized = compileFunction(
  `return (${sourceDeclaration(objectiveRecoverySource, "wasObjectiveStateUninitialized")});`,
  [],
)();

/**
 * Docker回復の確定は任意State保存ではなく有限更新へ接続する。
 * @responsibility 同じTask・回復IDと期待世代の搬送、保存後metadata拒否と元参照保全を確認する。
 * @trace PRL-UT-014
 * @precondition 実Objectiveの回復確定断面と有限の保存応答を使う。
 * @stimulus 正常・fresh差・EMの終結拒否・保存不明・候補欠測と、対象なし・再入場を与える。
 * @observation 有限要求、保存回数、後続通知と元回復ID。
 * @oracle 同版確認前・対象なし・再試行準備済みには保存を要求せず、EMの拒否は同じ回復参照と理由で返す。
 * @cleanup メモリ値のみ。
 * @boundary Coordinator調停とEMの完成更新。実WriterはEM試験で確認する。
 */
test("Docker回復確定は有限要求を渡し保存不明で元参照を保持する", async () => {
  const source = stripTypeScriptTypes(objectiveRecoverySource);
  const begin = source.indexOf(
    "    const recoveredDocker = recoveries.filter(",
  );
  const end = source.indexOf("    const outstanding =", begin);
  assert.ok(begin >= 0 && end > begin);
  const stop = compileFunction(
    `return (${sourceDeclaration(source, "blocked")});`,
    ["createCoordinatorObjectiveResult"],
  )(createCoordinatorObjectiveResult);
  const id = "docker-task.exact";
  const initial = {
    projectId: "project-a",
    generation: 4,
    tasks: [
      {
        definition: { id: "task-a" },
        attemptId: "attempt-a",
        operationId: "operation-a",
        cleanupConfirmed: true,
        recoveryUnresolved: false,
        recoveryObligations: [
          { kind: "docker", recoveryId: id, phase: "settled" },
        ],
      },
    ],
  };
  const evaluate = compileFunction(
    `return (async()=>{
    let recoveryState=initial; let state=null; let calls=0; const events=[];
    const writeCoordinatorRecoveryDiagnostic=value=>events.push(value);
    const request={projectId:'project-a',milestoneId:'milestone-a'};const queueId='queue-a';
    const recoveries=scenario==='no_target'?[]:[{kind:'docker',taskId:'task-a',recoveryId:${JSON.stringify(id)},phase:initial.tasks[0].recoveryObligations[0].phase}];
    const queue=scenario.startsWith('retry_ready') && scenario!=='retry_ready_wrong_queue'
      ? {state:'queued',resumeCondition:'exact_recovery_settled'}
      : {state:'recovery_required',resumeCondition:'exact_recovery'};
    const readCurrentRecoveryState=()=>{
      evidence.reads++;
      if(scenario==='retry_ready')assert.fail('確定済み回復を再処置しない');
      return scenario==='fresh_unknown'?null:initial;
    };
    const repository=Object.freeze({});const intake=Object.freeze({operation:'resume'});
    const persistence={repository,repositoryBindingId:'binding',intake};
    const saveProjectExecutionState=(actualRepository,binding,input,generation,actualIntake)=>{
      assert.equal(actualRepository,repository);assert.equal(binding,'binding');assert.equal(actualIntake,intake);
      evidence.writes++;
      assert.equal(evidence.reads,1);
      calls++;assert.deepEqual(input,{kind:'task_recovery_finalize',projectId:'project-a',recoveries:[{taskId:'task-a',recoveryId:${JSON.stringify(id)}}]});
      assert.equal(generation,4);
      if(scenario==='save_blocked')return {status:'blocked',reason:'save_unconfirmed'};
      if(scenario==='cleanup_unknown' || scenario.startsWith('retry_ready_'))
        return {status:'blocked',reason:'orchestrator_task_recovery_not_settled'};
      return {status:'completed',reason:'saved',value:{...initial,generation:5},taskStartCandidates:scenario==='metadata_unknown'?null:{projectId:'project-a',generation:5,taskIds:[]}};
    };

    ${source.slice(begin, end)}
    return {status:'continued',calls,events,state};
  })();`,
    [
      "initial",
      "scenario",
      "evidence",
      "assert",
      "blocked",
      "captureObjectiveRecoveryWrite",
    ],
  );
  for (const scenario of [
    "normal",
    "no_target",
    "fresh_unknown",
    "save_blocked",
    "metadata_unknown",
    "cleanup_unknown",
    "retry_ready",
    "retry_ready_wrong_queue",
    "retry_ready_cleanup_unknown",
    "retry_ready_pending_obligation",
  ]) {
    const retryReady = scenario.startsWith("retry_ready");
    const input = retryReady
      ? {
          ...initial,
          tasks: initial.tasks.map((task) => ({
            ...task,
            state: "ready",
            startPhase: "none",
            attemptId: null,
            operationId: null,
            authorityBindingId: null,
            retryCount: 1,
            cleanupConfirmed: scenario !== "retry_ready_cleanup_unknown",
            recoveryObligations: task.recoveryObligations.map((entry) => ({
              ...entry,
              phase:
                scenario === "retry_ready_pending_obligation"
                  ? "required"
                  : entry.phase,
            })),
          })),
        }
      : scenario === "cleanup_unknown"
        ? {
            ...initial,
            tasks: initial.tasks.map((task) => ({
              ...task,
              cleanupConfirmed: false,
            })),
          }
        : initial;
    const evidence = { reads: 0, writes: 0 };
    const result = await evaluate(
      input,
      scenario,
      evidence,
      assert,
      stop,
      captureObjectiveRecoveryWrite,
    );
    if (scenario === "normal") {
      assert.equal(result.status, "continued");
      assert.equal(result.calls, 1);
      assert.equal(result.events.length, 1);
      assert.equal(result.events[0].phase, "verification_resources_finalized");
    } else if (scenario === "retry_ready" || scenario === "no_target") {
      assert.equal(result.status, "continued");
      assert.equal(result.calls, 0);
      assert.deepEqual(result.events, []);
    } else {
      assert.equal(result.status, "blocked");
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(result.manualRecoveryRequired, true);
      assert.deepEqual(result.recoveryIds, [id]);
    }
    const isNoTarget = scenario === "no_target" || scenario === "retry_ready";
    assert.deepEqual(evidence, {
      reads: isNoTarget ? 0 : 1,
      writes: isNoTarget || scenario === "fresh_unknown" ? 0 : 1,
    });
    if (scenario === "cleanup_unknown" || scenario.startsWith("retry_ready_"))
      assert.equal(result.reason, "orchestrator_task_recovery_not_settled");
  }
});

/**
 * Objectiveの実際の改訂版照合だけを受付条件にする。
 * @trace PRL-UT-014
 * @precondition 公開受付の照合部分を使い、VCとWorkspaceの観測だけを差し替える。
 * @stimulus 現在改訂、一致しない改訂、採用済みWorkspace、観測不明と結合不正。
 * @observation 受付結果とWorkspace照会回数。
 * @oracle 確認済み改訂かつ有効な結合だけを通す。
 * @cleanup メモリのみ。
 */
test("Objectiveは現在改訂または採用済みWorkspaceを確認してから実行へ渡す", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const body = sourceDeclaration(source, "runObjective");
  const start = body.indexOf("    let revisionConfirmed =");
  const end = body.indexOf("    const groupId =", start);
  assert.ok(start > 0 && end > start);
  const compile = compileFunction(
    `${body.slice(start, end)}\nreturn "verified";`,
    [
      "identity",
      "request",
      "repositoryRoot",
      "repositoryBindingId",
      "workspacePlanReadyForAcceptance",
      "validIdentity",
      "blocked",
    ],
  );
  const request = {
    repositoryRevision: "revision",
    projectId: "project",
    milestoneId: "milestone",
  };
  for (const [value, workspace, binding, root, expected, reads] of [
    ["revision", false, "binding", "root", "verified", 0],
    ["other", true, "binding", "root", "verified", 1],
    ["other", false, "binding", "root", "orchestrator_binding_not_verified", 1],
    [
      "other",
      "throws",
      "binding",
      "root",
      "orchestrator_binding_not_verified",
      1,
    ],
    [null, true, "binding", "root", "orchestrator_binding_not_verified", 0],
    ["revision", false, "", "root", "orchestrator_binding_not_verified", 0],
    ["revision", false, "binding", "", "orchestrator_binding_not_verified", 0],
  ] as const) {
    let calls = 0;
    const result = compile(
      value ? { status: "observed", revisionIdentity: value } : null,
      request,
      root,
      binding,
      (...args: unknown[]) => {
        calls++;
        assert.deepEqual(args, [
          root,
          binding,
          "project",
          "milestone",
          "revision",
          value,
        ]);
        if (workspace === "throws") throw new Error("unknown");
        return workspace;
      },
      (input: unknown) => input === "binding",
      (input: unknown, reason: string) => {
        assert.strictEqual(input, request);
        return reason;
      },
    );
    assert.equal(result, expected);
    assert.equal(calls, reads);
  }
});

/**
 * ObjectiveのLease観測は従来のOS適用範囲を維持する。
 * @trace PRL-UT-014
 * @precondition 本番宣言と有限の生存観測を使用する。
 * @stimulus Windowsと非Windows、各観測結果を与える。
 * @observation 元所有者、観測回数と結果。
 * @oracle 非Windowsで観測を行わず元PID・世代付きunknownを返す。
 * @cleanup メモリ内だけ。
 */
test("ObjectiveのLease観測は非Windowsで元相関を保ち生存観測しない", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/host.ts", import.meta.url),
    "utf8",
  );
  const declaration = sourceDeclaration(source, "observeObjectiveLeaseOwner");
  const compile = compileFunction(`return (${declaration});`, [
    "process",
    "observeLeaseOwner",
  ]);
  const owner = Object.freeze({
    ownerProcessId: 42,
    ownerGeneration: "original",
  });
  for (const platform of ["win32", "linux", "darwin"]) {
    for (const status of ["alive", "absent", "unknown"]) {
      let calls = 0;
      const result = Object.freeze({ ...owner, status });
      const observe = compile({ platform }, (value: unknown) => {
        assert.equal(value, owner);
        calls++;
        return result;
      });
      const actual = observe(owner);
      if (platform === "win32") assert.equal(actual, result);
      else {
        assert.deepEqual(actual, { ...owner, status: "unknown" });
        assert.ok(Object.isFrozen(actual));
      }
      assert.equal(calls, platform === "win32" ? 1 : 0);
    }
  }
});

/**
 * Task組立ての順序・入力相関・独立配列と固定選定を確認する。
 * @trace PRL-UT-014
 * @precondition 既存State fixtureとTask別の異なる本文・Pathを使う。
 * @stimulus 廃止Task、並び替え、同IDの二入力と入力欠測を与える。
 * @observation Task順序、元Root／保存選定、本文と配列の参照。
 * @oracle 先頭一致だけを使い、他Taskや全体入力を混ぜず、欠測は拒否する。
 * @cleanup メモリ内だけ。
 */
test("Task要求組立てはTask別入力と保存選定を順序通り独立して搬送する", () => {
  const request = inspectCoordinatorObjectiveRequest(objective);
  assert.ok(request);
  const created = projectExecutionFixture({
    taskExecutionSelections: fixtureTaskExecutionSelections(),
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    repositoryRevision: request.repositoryRevision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: request.plan.milestoneAcceptanceCriteria,
    objectives: request.plan.objectives,
    tasks: request.plan.tasks,
    ownerGeneration: "owner-a",
  });
  assert.ok(created.state);
  const first = created.state.tasks[0];
  assert.ok(first);
  const inputA = {
    taskId: "task-a",
    objective: "A専用",
    acceptanceCriteria: ["A基準"],
    readPaths: ["a-read.ts"],
  };
  const inputB = {
    taskId: "task-b",
    objective: "B専用",
    acceptanceCriteria: ["B基準"],
    readPaths: ["b-read.ts"],
  };
  const input = {
    ...request,
    taskInputs: [inputA, { ...inputA, objective: "二番目は使わない" }, inputB],
  };
  const state = {
    ...created.state,
    tasks: [
      {
        ...first,
        definition: {
          ...first.definition,
          id: "task-b",
          allowedPaths: ["b-write.ts"],
        },
      },
      { ...first, state: "superseded" as const },
      {
        ...first,
        definition: {
          ...first.definition,
          id: "task-a",
          allowedPaths: ["a-write.ts"],
        },
      },
    ],
  };
  const root = Object.freeze({ original: true });
  const result = buildObjectiveTaskExecutions(input, state, root);
  assert.deepEqual(
    result.map((entry) => entry.taskId),
    ["task-b", "task-a"],
  );
  for (const [index, expected] of [inputB, inputA].entries()) {
    const entry = result[index];
    assert.ok(entry);
    assert.equal(entry.repositoryRoot, root);
    assert.ok(Object.isFrozen(entry));
    const task = entry.taskRequest;
    assert.equal(task.objective, expected.objective);
    assert.equal(task.taskExecutionSelections, state.taskExecutionSelections);
    assert.deepEqual(task.acceptanceCriteria, expected.acceptanceCriteria);
    assert.deepEqual(task.readPaths, expected.readPaths);
    assert.deepEqual(task.allowedPaths, [
      index === 0 ? "b-write.ts" : "a-write.ts",
    ]);
    assert.notEqual(task.acceptanceCriteria, expected.acceptanceCriteria);
    assert.notEqual(task.readPaths, expected.readPaths);
    assert.notEqual(
      task.allowedPaths,
      state.tasks[index === 0 ? 0 : 2]?.definition.allowedPaths,
    );
    assert.ok(
      Object.isFrozen(task) &&
        Object.isFrozen(task.acceptanceCriteria) &&
        Object.isFrozen(task.allowedPaths) &&
        Object.isFrozen(task.readPaths),
    );
  }
  assert.throws(
    () =>
      buildObjectiveTaskExecutions(
        { ...input, taskInputs: [inputA] },
        state,
        root,
      ),
    /coordinator_task_input_missing/,
  );
  assert.equal(inputA.objective, "A専用");
  assert.equal(state.tasks[1]?.state, "superseded");
});

/**
 * Objectiveの具体選定は元Root・設定・Catalogと二役割選定の順序を保持する。
 * @trace PRL-UT-014
 * @precondition 本番宣言を有限の既存Owner境界へ接続する。
 * @stimulus Root／設定の拒否・例外、選定拒否、workTypeとchoiceの有無を与える。
 * @observation 呼出し順・元参照・理由・返却値。
 * @oracle 拒否後は後続0、例外は元受付へ伝播し、入力を補完しない。
 * @cleanup メモリ内のみ。
 */
test("Objectiveの具体選定は元Root再観測と拒否理由・要求の評価順を維持する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/selection.ts", import.meta.url),
    "utf8",
  );
  const declaration = sourceDeclaration(
    source,
    "resolveObjectiveTaskSelections",
  );
  for (const mode of [
    "root_blocked",
    "root_throw",
    "config_blocked",
    "config_throw",
    "resolved",
    "choice",
    "selection_blocked",
    "selection_throw",
  ]) {
    const root = Object.freeze({ original: true }),
      capability = Object.freeze({}),
      catalog = Object.freeze({}),
      snapshot = Object.freeze({
        config: Object.freeze({}),
        identity: "synthetic",
      });
    const choice = Object.freeze({ provider: "codex" });
    const request = mode === "choice" ? { workType: "coding", choice } : {};
    const result = Object.freeze({
      status: mode === "selection_blocked" ? "blocked" : "resolved",
      reason: "original-selection",
    });
    const order: string[] = [];
    const resolve = compileFunction(`return (${declaration});`, [
      "getRepository",
      "readRepositoryAiSelection",
      "getModelCatalog",
      "resolveCheckedTaskExecutionSelections",
    ])(
      (input: unknown) => {
        order.push("root");
        assert.equal(input, root);
        if (mode === "root_throw") throw Error(mode);
        return mode === "root_blocked"
          ? { status: "blocked", reason: "original-root" }
          : { status: "completed", capability };
      },
      (input: unknown, models: unknown) => {
        order.push("config");
        assert.equal(input, capability);
        assert.equal(models, catalog);
        if (mode === "config_throw") throw Error(mode);
        return mode === "config_blocked"
          ? { status: "blocked", reason: "original-config" }
          : { status: "available", snapshot };
      },
      () => {
        order.push("catalog");
        return { catalog };
      },
      (input: unknown, values: { workType: unknown; choice?: unknown }) => {
        order.push("selection");
        assert.equal(input, snapshot);
        assert.equal(values.workType, mode === "choice" ? "coding" : null);
        assert.equal(values.choice, mode === "choice" ? choice : undefined);
        assert.deepEqual(
          Object.keys(values),
          mode === "choice" ? ["workType", "choice"] : ["workType"],
        );
        if (mode === "selection_throw") throw Error(mode);
        return result;
      },
    ) as (
      root: unknown,
      request: object,
    ) => { reason: string; value?: unknown };
    if (mode.endsWith("_throw"))
      assert.throws(() => resolve(root, request), new RegExp(mode));
    else {
      const actual = resolve(root, request);
      if (mode === "root_blocked" || mode === "config_blocked") {
        assert.equal(
          actual.reason,
          mode === "root_blocked" ? "original-root" : "original-config",
        );
        assert.equal(actual.value, null);
      } else assert.equal(actual, result);
    }
    assert.deepEqual(
      order,
      mode.startsWith("root_")
        ? ["root"]
        : mode.startsWith("config_")
          ? ["root", "catalog", "config"]
          : ["root", "catalog", "config", "selection"],
    );
  }
});

/**
 * 候補不正による停止でも元の回復事実を保持する。
 * @trace PRL-UT-014
 * @precondition 本体の最終結果構築と回復保存直後の実Sourceを有限依存で組み立てる。
 * @stimulus その断面のmetadataだけを不正にする。
 * @observation 例外非漏出、元ID・種別・再起動、不正後の追加呼出し0。
 * @oracle 不明を成功又は空の回復情報へ補完しない。
 * @cleanup メモリのみ。
 */
test("最終読取りと回復保存後の候補不正はexact回復情報を保持して停止する", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const blocked = compileFunction(
    `return (${sourceDeclaration(source, "blocked")});`,
    ["createCoordinatorObjectiveResult"],
  )(createCoordinatorObjectiveResult) as (
    ...args: unknown[]
  ) => ReturnType<typeof createCoordinatorObjectiveResult>;
  const request = inspectCoordinatorObjectiveRequest(objective);
  assert.ok(request);
  const blockRecoveryItem = compileFunction(
    `return (${sourceDeclaration(source, "blockObjectiveRecoveryItem")});`,
    ["blocked"],
  )(blocked);
  const base = projectExecutionFixture({
    taskExecutionSelections: fixtureTaskExecutionSelections(),
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    repositoryRevision: request.repositoryRevision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: request.plan.milestoneAcceptanceCriteria,
    objectives: request.plan.objectives,
    tasks: request.plan.tasks,
    ownerGeneration: "owner",
  }).state;
  const dockerId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  const processId = createRuntimeProcessRecoveryIdentity(
    "attempt",
    "operation",
  );
  const obligations = [
    {
      kind: "docker" as const,
      recoveryId: dockerId,
      phase: "required" as const,
    },
    {
      kind: "runtime_process" as const,
      recoveryId: processId,
      phase: "required" as const,
    },
  ];
  const single = blockRecoveryItem(
    request,
    "fixture_technical_recovery_unconfirmed",
    obligations[0],
  ) as ReturnType<typeof createCoordinatorObjectiveResult>;
  assert.equal(single.reason, "fixture_technical_recovery_unconfirmed");
  assert.equal(single.effectState, "unknown");
  assert.equal(single.cleanupConfirmed, false);
  assert.equal(single.manualRecoveryRequired, true);
  assert.deepEqual(single.recoveryIds, [dockerId]);
  assert.deepEqual(single.recoveryObligations, [
    { kind: "docker", recoveryId: dockerId },
  ]);
  const known = {
    ...base,
    tasks: base.tasks.map((task) => ({
      ...task,
      recoveryObligations: obligations,
      recoveryUnresolved: true,
    })),
  };
  const body = sourceDeclaration(source, "executeCoordinatorObjective");
  let effects = 0;
  const intake = compileFunction(`return (${body});`, [
    "isPrincipalId",
    "inspectTaskStartCandidates",
    "blocked",
    "createQueue",
    "inspectCoordinatorSnapshotLeaseAcquisitionOwner",
    "readProjectExecutionState",
    "hashCoordinatorContent",
    "getRuntimeProcessInstanceIdentity",
  ])(
    () => true,
    inspectTaskStartCandidates,
    blocked,
    () => {
      effects++;
      assert.fail("候補不正で受付しない");
    },
    () => ({ status: "completed", value: { acquisition: null } }),
    () => ({ status: "completed", value: known, taskStartCandidates: null }),
    hashCoordinatorContent,
    getRuntimeProcessInstanceIdentity,
  ) as (
    deps: object,
    request: object,
    signal: AbortSignal,
  ) => Promise<ReturnType<typeof createCoordinatorObjectiveResult>>;
  const missingIntake = await intake(
    {
      authenticatedPrincipalId: "principal",
      persistence: { repository: {}, repositoryBindingId: "binding" },
    },
    request,
    new AbortController().signal,
  );
  assert.equal(missingIntake.reason, "orchestrator_objective_request_invalid");
  assert.equal(missingIntake.effectState, "no_effect");
  const initial = await intake(
    {
      authenticatedPrincipalId: "principal",

      persistence: {
        repository: {},
        repositoryBindingId: "binding",
        intake: {
          operation: request.operation,
          projectId: request.projectId,
          milestoneId: request.milestoneId,
          queueId: "queue",
          requestHash: "hash",
        },
      },
    },
    request,
    new AbortController().signal,
  );
  assert.equal(effects, 0);
  assert.deepEqual(
    new Set(initial.recoveryIds),
    new Set([dockerId, processId]),
  );
  assert.ok(inspectCoordinatorObjectiveResult(initial));
  const tail = body.slice(
    body.indexOf("const latest = readProjectExecutionState"),
    body.lastIndexOf("}"),
  );
  let reads = 0;
  const evaluate = compileFunction(`return (async()=>{ ${tail} })();`, [
    "persistence",
    "request",
    "execution",
    "inspectTaskStartCandidates",
    "blocked",
    "projectCoordinatorState",
    "createCoordinatorObjectiveResult",
    "queueId",
    "readProjectExecutionState",
  ]);
  for (const recordedInState of [true, false]) {
    reads = 0;
    const execution = {
      status: "blocked",
      reason: "fixture_unknown",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      processRestartRequired: true,
      recoveryIds: recordedInState ? [] : [dockerId, processId],
      recoveryObligations: recordedInState
        ? []
        : obligations.map(({ kind, recoveryId }) => ({ kind, recoveryId })),
      effectState: "unknown",
    };
    const result = (await evaluate(
      { repository: {}, repositoryBindingId: "binding" },
      request,
      execution,
      inspectTaskStartCandidates,
      blocked,
      () => assert.fail("不正な候補を投影しない"),
      createCoordinatorObjectiveResult,
      "queue",
      () => {
        reads++;
        return {
          status: "completed",
          value: recordedInState ? known : base,
          taskStartCandidates: {
            projectId: base.projectId,
            generation: base.generation,
            taskIds: {},
          },
        };
      },
    )) as ReturnType<typeof createCoordinatorObjectiveResult>;
    assert.equal(reads, 1);
    assert.equal(result.status, "blocked");
    assert.equal(result.projection, null);
    assert.equal(result.effectState, "unknown");
    assert.equal(result.cleanupConfirmed, false);
    assert.equal(result.manualRecoveryRequired, true);
    assert.equal(result.processRestartRequired, true);
    assert.deepEqual(
      new Set(result.recoveryIds),
      new Set([dockerId, processId]),
    );
    assert.ok(inspectCoordinatorObjectiveResult(result));
  }
  const start = body.indexOf("const saveProcessRecoveryPhase =");
  const stop = body.indexOf("const writeRecoveryPhaseDiagnostic =", start);
  assert.ok(start >= 0 && stop > start);
  const recovering = compileFunction(
    `let state; let recoveryState = original;
    ${body.slice(start, stop)}
    const result = saveProcessRecoveryPhase(stage, item);
    return { result, state, recoveryState };`,
    [
      "original",
      "persistence",
      "request",
      "queueId",
      "stage",
      "item",
      "saveProjectExecutionState",
      "captureObjectiveRecoveryWrite",
      "blockObjectiveRecoveryItem",
      "blocked",
    ],
  );
  for (const stage of [
    "task_recovery_start",
    "task_recovery_settle",
  ] as const) {
    const savedState =
      stage === "task_recovery_settle"
        ? {
            ...known,
            tasks: known.tasks.map((task) => ({
              ...task,
              recoveryObligations: task.recoveryObligations.map((item) =>
                item.kind === "runtime_process"
                  ? { ...item, phase: "settled" as const }
                  : item,
              ),
            })),
          }
        : known;
    const persistence = {
      repository: {},
      repositoryBindingId: "binding",
      intake: {},
    };
    const item = { ...obligations[1], taskId: known.tasks[0]?.definition.id };
    const { result, state, recoveryState } = recovering(
      known,
      persistence,
      request,
      "queue",
      stage,
      item,
      (...args: unknown[]) => {
        assert.strictEqual(args[0], persistence.repository);
        assert.equal(args[1], persistence.repositoryBindingId);
        assert.deepEqual(args[2], {
          kind: stage,
          projectId: request.projectId,
          taskId: item.taskId,
          recoveryKind: "runtime_process",
          recoveryId: processId,
        });
        assert.equal(args[3], known.generation);
        assert.strictEqual(args[4], persistence.intake);
        return {
          status: "completed",
          reason: "saved",
          value: savedState,
          taskStartCandidates: null,
        };
      },
      captureObjectiveRecoveryWrite,
      blockRecoveryItem,
      blocked,
    ) as {
      result: ReturnType<typeof createCoordinatorObjectiveResult>;
      state: { value: unknown };
      recoveryState: unknown;
    };
    assert.strictEqual(state.value, savedState);
    assert.strictEqual(recoveryState, known);
    assert.equal(result.effectState, "unknown");
    assert.deepEqual(
      new Set(result.recoveryIds),
      new Set([dockerId, processId]),
    );
    assert.ok(inspectCoordinatorObjectiveResult(result));
  }
});

const recoveryDiagnosticSource = fs.readFileSync(
  new URL("../../../src/lifecycle/environment.ts", import.meta.url),
  "utf8",
);

const objective = Object.freeze(
  withCallerPlan({
    operation: "start" as const,
    requestId: "request-1",
    projectId: "project-1",
    milestoneId: "milestone-1",
    repositoryRevision: "a".repeat(40),
    objective: "合成fixtureの搬送だけを確認する",
    acceptanceCriteria: Object.freeze(["外部処理を起動しない"]),
    allowedPaths: Object.freeze(["fixture.txt"]),
    readPaths: Object.freeze(["fixture.txt"]),
    maximumConcurrency: 1,
    maximumReplans: 0,
    originLane: "interactive" as const,
    adoptResult: false,
  }),
);

/**
 * 分類と明示選択の全入力組合せを固定選定の搬送へ接続する。
 *
 * @responsibility 公開Objectiveの検査後にbuilderが完全選定をTask要求へ保持することを検証する。
 * @trace PRL-UT-014
 * @precondition 正常Objective、三つの任意項目と二Providerの技術対応済み選択を使用する。
 * @stimulus 全四組合せを公開検査、選定とbuilderへ渡す。
 * @observation 二役割の完全値、複製配列と旧fieldの不存在を確認する。
 * @oracle 同じ受付の選定だけを搬送し、Front Providerによる再選定や権限を追加しない。
 * @cleanup N/A: メモリ内の純粋関数だけを実行する。
 * @boundary N/A: 実Task、ProviderとHost資源を起動しない。
 */
test("Objective選定は全四組合せでTask契約へexactに搬送する", () => {
  for (const choice of [
    { provider: "codex", model: "gpt-5.5", effort: "high" },
    { provider: "claude", model: "opus", effort: "high" },
  ] as const) {
    const optionalFieldNames = [{ workType: "coding" }, { choice }];
    for (let mask = 0; mask < 4; mask += 1) {
      const request = inspectCoordinatorObjectiveRequest(
        Object.assign(
          { ...objective },
          ...optionalFieldNames.filter(
            (_entry, index) => (mask & (1 << index)) !== 0,
          ),
        ),
      );
      assert.ok(request);
      const resolved = resolveTaskExecutionSelections(selectionConfig(), {
        workType: request.workType ?? null,
        ...(request.choice ? { choice: request.choice } : {}),
      });
      assert.ok(resolved.value);
      const task = buildObjectiveTaskRequest(request, resolved.value);
      const snapshot = task;
      assert.deepEqual(snapshot.taskExecutionSelections, resolved.value);
      assert.equal(snapshot.taskExecutionSelections, resolved.value);
      assert.equal(
        snapshot.taskExecutionSelections.executor.provider,
        mask & 2 ? choice.provider : "codex",
      );
      assert.equal(Object.hasOwn(task, "frontProvider"), false);
      assert.equal(Object.hasOwn(task, "requestedProfileId"), false);
      assert.notEqual(task.acceptanceCriteria, request.acceptanceCriteria);
      assert.deepEqual(task.allowedPaths, request.allowedPaths);
      assert.ok(Object.isFrozen(task));
      assert.ok(Object.isFrozen(task.acceptanceCriteria));
      assert.ok(Object.isFrozen(task.allowedPaths));
      assert.equal(Object.hasOwn(task, "selectionGrant"), false);
      assert.equal(Object.hasOwn(task, "decisionCapabilityReplacement"), false);
    }
  }
});

import { inspectCoordinatorObjectiveRequest } from "../../../src/lifecycle/validation.ts";

/**
 * 未信頼の計画を公開受付で捕捉し、同じ検査済み参照を実行へ渡す。
 * @responsibility 受付時の独立凍結と、受付後の再検査・再捕捉なしの搬送を確認する。
 * @trace PRL-UT-014
 * @precondition 公開受付の実検査で独立・凍結した要求を使用する。
 * @stimulus 元計画、同値別Object、範囲外、getter、Proxy、null、Errorを要求へ渡す。
 * @observation Binding到達数、内部実行への搬送値と停止理由。
 * @oracle 不正値はBinding・実行0、hook0。正常値は独立凍結後の同じ参照。
 * @cleanup 値のみ。保存・Process・外部実行を発行しない。
 * @boundary 未信頼の公開要求から受付済み計画と内部実行への接続。
 */
test("公開受付は計画を独立凍結し同じ検査済み参照だけを実行へ渡す", async () => {
  const request = inspectCoordinatorObjectiveRequest(objective);
  assert.ok(request);
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const captured: {
    value: ReturnType<typeof inspectCoordinatorObjectiveRequest>;
  } = { value: null };
  const readCaptured = (): ReturnType<
    typeof inspectCoordinatorObjectiveRequest
  > => captured.value;
  let executions = 0;
  let delivered: unknown;
  let recoveryReads = 0;
  const binding = Object.freeze({
    repositoryBindingId: "binding",
    repositoryRoot: {},
    workingDirectory: {},
  });
  const boundRepository = Object.freeze({});
  const intake = Object.freeze({});
  const executeAccepted = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "executeAcceptedCoordinatorObjective"))});`,
    [
      "isPrincipalId",
      "blocked",
      "executeCoordinatorObjective",
      "readObjectiveReplay",
      "verifyRuntimePersistenceRepository",
    ],
  )(
    isPrincipalId,
    (_request: unknown, reason: string) => ({ status: "blocked", reason }),
    async (
      dependencies: {
        persistence: {
          repository: unknown;
          workingDirectory: unknown;
          repositoryBindingId: string;
          intake: unknown;
        };
      },
      accepted: { plan: unknown },
      _signal: unknown,
    ) => {
      assert.equal(recoveryReads, 0);
      executions += 1;
      assert.equal(Object.hasOwn(dependencies, "plan"), false);
      delivered = accepted.plan;
      assert.strictEqual(dependencies.persistence.repository, boundRepository);
      assert.strictEqual(
        dependencies.persistence.workingDirectory,
        binding.workingDirectory,
      );
      assert.equal(
        dependencies.persistence.repositoryBindingId,
        binding.repositoryBindingId,
      );
      assert.strictEqual(dependencies.persistence.intake, intake);
      assert.equal(Object.isFrozen(dependencies.persistence), true);
      assert.deepEqual(Object.keys(dependencies.persistence).sort(), [
        "intake",
        "repository",
        "repositoryBindingId",
        "workingDirectory",
      ]);
      return { status: "blocked", reason: "finite_execution_reached" };
    },
    (
      _request: unknown,
      root: unknown,
      bindingId: unknown,
      replayIntake: unknown,
    ) => {
      assert.strictEqual(root, binding.workingDirectory);
      assert.equal(bindingId, binding.repositoryBindingId);
      assert.strictEqual(replayIntake, intake);
      return null;
    },
    (directory: unknown) => {
      assert.strictEqual(directory, binding.workingDirectory);
      return boundRepository;
    },
  ) as (
    dependencies: {
      authenticatedPrincipalId: string;
      binding: typeof binding;
      intake: typeof intake;
    },
    accepted: typeof request,
    signal: AbortSignal,
  ) => Promise<{ reason: string }>;
  let hooks = 0;
  const copy = JSON.parse(JSON.stringify(request.plan));
  const outside = {
    ...copy,
    tasks: copy.tasks.map((task: object) => ({
      ...task,
      allowedPaths: ["outside.txt"],
    })),
  };
  const accessor = {
    ...copy,
    get tasks() {
      hooks += 1;
      return copy.tasks;
    },
  };
  const proxy = new Proxy(copy, {
    ownKeys() {
      hooks += 1;
      return [];
    },
  });
  for (const [value, valid] of [
    [request.plan, true],
    [copy, true],
    [outside, false],
    [accessor, false],
    [proxy, false],
    [null, false],
    [new Error("untrusted_plan_value"), false],
  ] as const) {
    captured.value = null;
    executions = 0;
    delivered = null;
    const owner = {
      authenticatedPrincipalId: "principal-a",
      binding,
      intake,
      get resolveTaskRecoveryCorrelations() {
        recoveryReads++;
        throw Error("eager_recovery_read");
      },
      get recoverTaskRecovery() {
        recoveryReads++;
        throw Error("eager_recovery_read");
      },
      get observeRecoveryTransition() {
        recoveryReads++;
        throw Error("eager_recovery_read");
      },
    };
    const accepted = inspectCoordinatorObjectiveRequest({
      ...objective,
      plan: value,
    });
    captured.value = accepted;
    const result = accepted
      ? await executeAccepted(owner, accepted, new AbortController().signal)
      : null;
    assert.equal(executions, valid ? 1 : 0);
    assert.equal(
      result?.reason ?? null,
      valid ? "finite_execution_reached" : null,
    );
    if (valid) {
      const accepted = readCaptured();
      assert.ok(accepted);
      assert.deepEqual(delivered, request.plan);
      assert.strictEqual(delivered, accepted.plan);
      assert.notStrictEqual(delivered, value);
      assert.equal(Object.isFrozen(accepted.plan), true);
      assert.equal(Object.isFrozen(accepted.plan.tasks), true);
      assert.notStrictEqual(accepted.plan.tasks, value.tasks);
      assert.notStrictEqual(accepted.plan.tasks[0], value.tasks[0]);
      assert.equal(Object.isFrozen(accepted.plan.tasks[0]), true);
      assert.deepEqual(value, request.plan);
    }
    assert.equal(recoveryReads, 0);
  }
  assert.equal(hooks, 0);
  const identity = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "createObjectiveIntake"))});`,
    ["createCoordinatorStableId", "hashCoordinatorContent"],
  )(createCoordinatorStableId, hashCoordinatorContent) as (
    request: object,
    binding: string,
    principal: string,
  ) => { queueId: string; requestHash: string };
  const original = identity(request, "binding", "principal-a");
  assert.deepEqual(
    { ...original, operation: "resume" },
    identity({ ...request, operation: "resume" }, "binding", "principal-a"),
  );
  const reordered = inspectCoordinatorObjectiveRequest(
    Object.fromEntries(Object.entries(request).reverse()),
  );
  assert.ok(reordered);
  assert.deepEqual(original, identity(reordered, "binding", "principal-a"));
  const changed = identity(
    { ...request, milestoneId: "other" },
    "binding",
    "principal-a",
  );
  assert.equal(changed.queueId, original.queueId);
  assert.notEqual(changed.requestHash, original.requestHash);
  const project = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "projectObjectiveReplay"))});`,
    ["createCoordinatorObjectiveResult", "projectCoordinatorState", "blocked"],
  )(
    createCoordinatorObjectiveResult,
    (state: { milestone: { state: string } }) => ({
      milestoneState: state.milestone.state,
      nextAction: "recover",
    }),
    (_request: unknown, reason: string, options: unknown) => ({
      status: "blocked",
      reason,
      options,
    }),
  ) as (
    request: object,
    queue: object,
    state: object | null,
    candidates?: object,
  ) => {
    projection: object | null;
    recoveryIds: string[];
    cleanupConfirmed: boolean;
    effectState: string;
    manualRecoveryRequired: boolean;
    status: string;
  };
  const queue = {
    queueId: "queue",
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    repositoryRevision: request.repositoryRevision,
    state: "recovery_required",
    ownerGeneration: null,
  };
  const state = {
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    repositoryRevision: request.repositoryRevision,
    milestone: { state: "executing" },
    tasks: [
      {
        cleanupConfirmed: false,
        recoveryUnresolved: true,
        recoveryObligations: [
          {
            kind: "runtime_process",
            recoveryId: "original-recovery",
            phase: "required",
          },
        ],
      },
    ],
  };
  const replay = project(request, queue, state, {
    projectId: state.projectId,
    generation: 1,
    taskIds: [],
  });
  assert.equal(replay.effectState, "unknown");
  assert.equal(replay.manualRecoveryRequired, true);
  assert.equal(replay.cleanupConfirmed, false);
  assert.deepEqual([...replay.recoveryIds], ["original-recovery"]);
  assert.deepEqual(project(request, queue, state, undefined), {
    status: "blocked",
    reason: "orchestrator_state_observation_unknown",
    options: { knownState: state, queueId: queue.queueId },
  });
  assert.equal(
    project(request, queue, { ...state, milestoneId: "newer" }).projection,
    null,
  );
  assert.equal(
    project(request, { ...queue, state: "completed" }, null).status,
    "completed",
  );
  const repository = Object.freeze({});
  let projectReadAllowed = false;
  const execute = compileFunction(
    `return (${sourceDeclaration(source, "executeCoordinatorObjective")});`,
    [
      "isPrincipalId",
      "blocked",
      "inspectTaskExecutionSelections",
      "readQueueEntry",
      "createQueue",
      "inspectCoordinatorSnapshotLeaseAcquisitionOwner",
      "readProjectExecutionState",
      "hashCoordinatorContent",
      "getRuntimeProcessInstanceIdentity",
      "resolveObjectiveTaskSelections",
    ],
  )(
    isPrincipalId,
    (_request: unknown, reason: string) => ({ status: "blocked", reason }),
    inspectTaskExecutionSelections,
    (actualRepository: unknown, binding: string, queueId: string) => {
      assert.equal(actualRepository, repository);
      assert.equal(binding, "binding");
      assert.equal(
        queueId,
        createCoordinatorStableId("queue", [
          "binding",
          "principal-a",
          "request-1",
        ]),
      );
      reads++;
      return { status: "blocked", reason: "fixture_missing" };
    },
    () => {
      enqueues++;
      return forbidden();
    },
    () => ({ status: "completed", value: { acquisition: null } }),
    () => {
      assert.ok(projectReadAllowed, "unknown resume must not read Project");
      return { status: "completed", value: null };
    },
    hashCoordinatorContent,
    getRuntimeProcessInstanceIdentity,
    (actualRoot: unknown, actualRequest: unknown) => {
      assert.equal(actualRoot, repository);
      assert.equal(typeof actualRequest, "object");
      return selectionResult();
    },
  ) as (
    deps: object,
    input: object,
    signal: AbortSignal,
  ) => Promise<{ reason: string }>;
  const forbidden = () => assert.fail("unknown resume must not issue effects");
  let selectionResult: () => unknown = forbidden;
  let reads = 0;
  const rejected = await execute(
    {
      authenticatedPrincipalId: "principal-a",

      repositoryRoot: repository,
      persistence: {
        repository,
        repositoryBindingId: "binding",
        intake: identity(
          { ...request, operation: "resume" },
          "binding",
          "principal-a",
        ),
      },
      execution: {},
    },
    { ...request, operation: "resume" },
    new AbortController().signal,
  );
  assert.equal(rejected.reason, "fixture_missing");
  assert.equal(reads, 1);
  projectReadAllowed = true;
  let selectionHooks = 0;
  let enqueues = 0;
  const accessorSelections = {
    get executor() {
      selectionHooks++;
      throw Error("selection_accessor_must_not_run");
    },
    reviewer: null,
  };
  const proxySelections = new Proxy(
    {},
    {
      ownKeys() {
        selectionHooks++;
        throw Error("selection_proxy_must_not_run");
      },
    },
  );
  const resolved = resolveTaskExecutionSelections(selectionConfig(), {
    workType: null,
  });
  assert.ok(resolved.value);
  const missingWorkType = { ...resolved.value.executor };
  Reflect.deleteProperty(missingWorkType, "workType");
  for (const value of [
    accessorSelections,
    proxySelections,
    {},
    { executor: {} },
    { ...resolved.value, executor: missingWorkType },
  ]) {
    selectionResult = () => ({ status: "resolved", value });
    const result = await execute(
      {
        authenticatedPrincipalId: "principal-a",

        repositoryRoot: repository,
        persistence: {
          repository,
          repositoryBindingId: "binding",
          intake: identity(
            { ...request, operation: "start" },
            "binding",
            "principal-a",
          ),
        },
        execution: {},
      },
      { ...request, operation: "start" },
      new AbortController().signal,
    );
    assert.equal(result.reason, "orchestrator_input_invalid");
  }
  assert.equal(selectionHooks, 0);
  assert.equal(enqueues, 0);
});

/**
 * 保存競合で再送が判明したときは現在の同版観測だけを返す。
 * @responsibility 古いProject候補の搬送と、観測欠測後の誤った再実行を検出する。
 * @trace PRL-UT-014
 * @precondition 実Objectiveの再送分岐とReaderを接続し、保存境界だけを差し替える。
 * @stimulus 新規再送、終端再開、進行中の明示再開と観測欠測を与える。
 * @observation 保存読取り回数、元回復参照、後続実行への到達を確認する。
 * @oracle 再送は一回の読取りから返し、Queueが欠けた場合も新規実行へ進まない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Objectiveの保存直後分岐と同版Readerへの接続。
 */
test("保存競合のObjective再送は同版から返し、Queue欠測でも実行しない", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const body = sourceDeclaration(source, "executeCoordinatorObjective");
  const start = body.indexOf("  const queued =");
  const end = body.indexOf("  if (initialization)", start);
  assert.ok(start > 0 && end > start);
  const validationSource = fs.readFileSync(
    new URL("../../../src/lifecycle/validation.ts", import.meta.url),
    "utf8",
  );
  const replay = compileFunction(
    `
    ${stripTypeScriptTypes(sourceDeclaration(source, "readObjectiveReplay"))}
    ${stripTypeScriptTypes(sourceDeclaration(validationSource, "captureTaskStartCandidates"))}
    return (queueInput, persistence, request, queueId, requestHash, initialization) => {
      ${objectiveStopProjection(body)}
      ${body.slice(start, end)}
      return "continue";
    };
  `,
    [
      "verifyRuntimePersistenceRepository",
      "readState",
      "blocked",
      "snapshotPlainArray",
      "inspectTaskStartCandidates",
      "projectObjectiveReplay",
      "readQueueEntry",
      "createQueue",
      "COORDINATOR_PUBLIC_RUNTIME_CONTRACT",
    ],
  );
  const savedQueue = {
    queueId: "queue",
    projectId: "project",
    milestoneId: "milestone",
    requestHash: "hash",
    repositoryRevision: "revision",
    state: "recovery_required",
  };
  const freshState = {
    projectId: "project",
    milestoneId: "milestone",
    repositoryRevision: "revision",
    recoveryId: "exact-recovery",
  };
  const candidate = Object.freeze({ generation: 2 });
  for (const [operation, queueState, hasQueue, expected] of [
    ["start", "queued", true, "exact-recovery"],
    ["resume", "completed", true, "exact-recovery"],
    ["start", "queued", false, "orchestrator_state_observation_unknown"],
    ["resume", "queued", true, "continue"],
    ["resume", "missing", false, "resume_queue_missing"],
    ["resume", "foreign", true, "orchestrator_queue_identity_conflict"],
  ] as const) {
    let reads = 0;
    let registrations = 0;
    let queueReads = 0;
    const run = replay(
      (root: string) => root,
      (root: string, binding: string, scope: string) => {
        reads++;
        assert.equal(root, "repo");
        assert.equal(binding, "binding");
        assert.equal(scope, "execution");
        return {
          status: "completed",
          value: {
            queueEntries: hasQueue ? [savedQueue] : [],
            projects: [freshState],
            taskStartCandidates: [candidate],
          },
        };
      },
      (_request: unknown, reason: string, options: unknown) => {
        if (reason === "orchestrator_state_observation_unknown")
          assert.deepEqual(options, { knownState: null, queueId: "queue" });
        return reason;
      },
      (value: unknown) => ({ status: "ok", value }),
      (state: unknown, value: unknown) => {
        assert.strictEqual(state, freshState);
        assert.strictEqual(value, candidate);
        return value;
      },
      (
        _request: unknown,
        queue: unknown,
        state: typeof freshState,
        candidates: unknown,
      ) => {
        assert.strictEqual(queue, savedQueue);
        assert.strictEqual(state, freshState);
        assert.strictEqual(candidates, candidate);
        return state.recoveryId;
      },
      () => {
        queueReads++;
        assert.equal(operation, "resume");
        if (queueState === "missing")
          return { status: "blocked", reason: "resume_queue_missing" };
        return {
          status: "completed",
          value: {
            ...savedQueue,
            state: queueState,
            requestHash:
              queueState === "foreign" ? "other" : savedQueue.requestHash,
          },
        };
      },
      () => {
        registrations++;
        assert.equal(operation, "start");
        return {
          status: "completed",
          reason: "orchestrator_queue_request_reused",
          value: { ...savedQueue, state: queueState },
        };
      },
      "contract",
    );
    const result = run(
      savedQueue,
      {
        repository: "repo",
        workingDirectory: "repo",
        repositoryBindingId: "binding",
        intake: savedQueue,
      },
      { ...savedQueue, operation },
      savedQueue.queueId,
      savedQueue.requestHash,
      undefined,
    );
    assert.equal(typeof result === "object" ? result.reason : result, expected);
    assert.equal(
      reads,
      expected === "exact-recovery" ||
        expected === "orchestrator_state_observation_unknown"
        ? 1
        : 0,
    );
    assert.equal(registrations, operation === "start" ? 1 : 0);
    assert.equal(queueReads, operation === "resume" ? 1 : 0);
  }
});

/**
 * 通常実行で確認した終了済み・統合待ちのQueueを公開結果へ投影する。
 * @trace PRL-UT-014
 * @precondition 現行実行の結果分岐と実際の結果生成を使う。
 * @stimulus 統合待ち、採用済み、取消済み、採用状態との矛盾、状態欠測を与える。
 * @observation 元の投影、結果区分・理由・回復とEffectの表示。
 * @oracle 正常な観測は新規Effectなし。矛盾は回復待ちの停止、欠測は通常分岐へ渡す。
 * @cleanup N/A: メモリのみ。
 */
test("通常実行でのObjective終了観測は理由とEffectなしの公開結果を維持する", () => {
  const source = stripTypeScriptTypes(objectiveRecoverySource);
  const mismatch = source.indexOf('"orchestrator_terminal_replay_mismatch"');
  const start = source.lastIndexOf("\n  if (\n", mismatch);
  const end = source.indexOf('  if (queue.state !== "queued"', mismatch);
  assert.ok(start > 0 && start < mismatch && mismatch < end);
  const blocked = compileFunction(
    `return (${sourceDeclaration(source, "blocked")});`,
    ["createCoordinatorObjectiveResult"],
  )(createCoordinatorObjectiveResult);
  const candidates = Object.freeze({});
  const stateValue = Object.freeze({});
  const cases = [
    [
      "integration_pending",
      "executing",
      "completed",
      "orchestrator_tasks_already_integration_pending",
    ],
    [
      "completed",
      "accepted",
      "completed",
      "orchestrator_objective_already_accepted",
    ],
    [
      "cancelled",
      "cancelled",
      "cancelled",
      "orchestrator_objective_already_cancelled",
    ],
    [
      "completed",
      "executing",
      "blocked",
      "orchestrator_terminal_replay_mismatch",
    ],
    ["completed", null, null, null],
    ["queued", "executing", null, null],
  ] as const;
  const evaluate = compileFunction(
    `return (queue, state) => {
      const request = { requestId: "request-a", projectId: "project-a", milestoneId: "milestone-a" };
      const queueId = "queue-a";
      ${source.slice(start, end)}
      return null;
    };`,
    ["createCoordinatorObjectiveResult", "projectCoordinatorState", "blocked"],
  );
  for (const [queueState, milestoneState, status, reason] of cases) {
    let projections = 0;
    const projection = Object.freeze({ milestoneState });
    const project = evaluate(
      createCoordinatorObjectiveResult,
      (value: unknown, candidate: unknown) => {
        assert.strictEqual(value, stateValue);
        assert.strictEqual(candidate, candidates);
        projections++;
        return projection;
      },
      blocked,
    );
    const result = project(
      { state: queueState },
      {
        value: milestoneState === null ? null : stateValue,
        taskStartCandidates: candidates,
      },
    );
    assert.equal(projections, status === null ? 0 : 1);
    if (status === null) {
      assert.equal(result, null);
      continue;
    }
    const inconsistent = status === "blocked";
    assert.equal(result.status, status);
    assert.equal(result.reason, reason);
    assert.equal(result.queueId, inconsistent ? null : "queue-a");
    assert.strictEqual(result.projection, inconsistent ? null : projection);
    assert.equal(result.effectState, inconsistent ? "unknown" : "no_effect");
    assert.equal(result.cleanupConfirmed, !inconsistent);
    assert.equal(result.manualRecoveryRequired, inconsistent);
    assert.equal(result.processRestartRequired, false);
    assert.deepEqual(result.recoveryIds, []);
    assert.deepEqual(result.recoveryObligations, []);
  }
});

/**
 * 採用・品質待ちの表示更新と履歴整理失敗で、捕捉済み結果を再生成しない。
 * @trace PRL-UT-014
 * @precondition 凍結済みのWorkspace観測と回復情報を持つ元結果を使う。
 * @stimulus 同じQueue、別のWorkspace、観測不能、採用済み、履歴整理失敗を与える。
 * @observation Queueと採用の観測数、公開理由、Workspace観測と回復情報の参照。
 * @oracle 現在照合は元の順序で行い、表示変更で観測を再検査・差替えしない。
 * @cleanup N/A: メモリのみ。
 */
test("Objectiveの実行後表示は現在Queueを照合し捕捉済みの結果を保つ", async () => {
  const source = stripTypeScriptTypes(objectiveRecoverySource);
  const start = source.indexOf("    const wasIntegrationPending =");
  const end = source.indexOf("  })().catch(", start);
  assert.ok(start > 0 && end > start);
  const evaluate = compileFunction(
    `return (execution, request) => {
      const repositoryRoot = "root", repositoryBindingId = "binding";
      const identity = { revisionIdentity: "known-head" };
      ${source.slice(start, end)}
    };`,
    [
      "readState",
      "verifyRuntimePersistenceRepository",
      "workspacePlanReadyForAcceptance",
    ],
  );
  const request = Object.freeze({
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "initial-revision",
    workspaceId: "workspace-a",
  });
  const workspaceResults = Object.freeze([Object.freeze({ taskId: "task-a" })]);
  const recoveryIds = Object.freeze(["same-recovery"]);
  const recoveryObligations = Object.freeze([]);
  const original = Object.freeze({
    status: "completed",
    reason: "orchestrator_tasks_already_integration_pending",
    queueId: "queue-a",
    projection: Object.freeze({ milestoneState: "executing" }),
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "no_effect",
    workspaceResults,
    recoveryIds,
    recoveryObligations,
  });
  const queue = Object.freeze({ ...request, queueId: original.queueId });
  for (const [condition, reason] of [
    ["ready", "orchestrator_quality_acceptance_required"],
    ["direct", "orchestrator_quality_acceptance_required"],
    ["waiting", "orchestrator_workspace_adoption_required"],
    ["foreign", "orchestrator_workspace_target_unconfirmed"],
    ["unknown", "orchestrator_workspace_target_unconfirmed"],
    ["accepted", "orchestrator_objective_already_accepted"],
    ["unrelated", "untouched"],
  ] as const) {
    const calls: string[] = [];
    const project = evaluate(
      (root: unknown, binding: unknown, scope: unknown) => {
        calls.push("read");
        assert.deepEqual(
          [root, binding, scope],
          ["repository", "binding", "queue"],
        );
        return {
          status: condition === "unknown" ? "unknown" : "completed",
          value: {
            queueEntries: [
              {
                ...queue,
                workspaceId:
                  condition === "direct"
                    ? null
                    : condition === "foreign"
                      ? "other"
                      : queue.workspaceId,
              },
            ],
          },
        };
      },
      (root: unknown) => {
        assert.equal(root, "root");
        return "repository";
      },
      (...args: unknown[]) => {
        calls.push("acceptance");
        assert.deepEqual(args, [
          "root",
          "binding",
          request.projectId,
          request.milestoneId,
          request.repositoryRevision,
          "known-head",
        ]);
        return condition === "ready";
      },
    );
    const execution =
      condition === "accepted"
        ? { ...original, projection: { milestoneState: "accepted" } }
        : condition === "unrelated"
          ? { ...original, reason }
          : original;
    const result = project(
      execution,
      condition === "direct" ? { ...request, workspaceId: undefined } : request,
    );
    assert.equal(result.reason, reason, condition);
    assert.equal(
      result.cleanupConfirmed,
      condition !== "foreign" && condition !== "unknown",
    );
    assert.strictEqual(result.workspaceResults, workspaceResults);
    assert.strictEqual(result.recoveryIds, recoveryIds);
    assert.strictEqual(result.recoveryObligations, recoveryObligations);
    if (condition === "unrelated") assert.strictEqual(result, execution);
    else assert.equal(Object.isFrozen(result), true);
    assert.deepEqual(
      calls,
      condition === "unrelated" || condition === "accepted"
        ? []
        : condition === "foreign" || condition === "unknown"
          ? ["read"]
          : ["read", "acceptance"],
    );
  }
  const execute = compileFunction(
    `return (${sourceDeclaration(source, "executeAcceptedCoordinatorObjective")});`,
    [
      "isPrincipalId",
      "readObjectiveReplay",
      "verifyRuntimePersistenceRepository",
      "executeCoordinatorObjective",
      "retireStateRecords",
      "historyRepositoryInput",
    ],
  );
  for (const status of ["completed", "cancelled"] as const) {
    const execution = {
      ...original,
      status,
      projection: { milestoneState: "accepted" },
    };
    const run = execute(
      () => true,
      () => null,
      () => "repository",
      async () => execution,
      () => ({ status: "blocked", reason: "history_blocked" }),
      (repository: unknown) => repository,
    );
    const result = await run(
      {
        authenticatedPrincipalId: "principal-a",
        binding: {},
        intake: {},
        execution: {},
      },
      request,
      new AbortController().signal,
    );
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      status === "cancelled"
        ? "orchestrator_cancelled_history_blocked"
        : "history_blocked",
    );
    assert.equal(result.projection, null);
    assert.equal(result.cleanupConfirmed, false);
    assert.equal(result.manualRecoveryRequired, true);
    assert.equal(result.effectState, "unknown");
    assert.strictEqual(result.workspaceResults, workspaceResults);
    assert.strictEqual(result.recoveryIds, recoveryIds);
  }
});

/**
 * 回復後のProject・Queue・候補を同じ保存版から確認する。
 * @responsibility 回復前から変わったQueueまたは業務状態を継続へ渡さない。
 * @trace PRL-UT-014
 * @precondition 本番の同版照合を一回組み立て、保存読取りだけを差し替える。
 * @stimulus 取消、Queue差、Project差、候補の重複と一致を与える。
 * @observation 読取り回数と継続用に返したProjectを観測する。
 * @oracle 一致だけが一回の読取りで継続し、取消では読取りもしない。
 * @cleanup N/A: メモリのみ。
 * @boundary 回復時の再観測と後続処置の接続。
 */
test("回復後の再確認はQueue・Project・候補を同じ保存版で比較する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const body = sourceDeclaration(source, "executeCoordinatorObjective");
  const start = body.indexOf("    const readCurrentRecoveryState =");
  const end = body.indexOf("    if (unresolvedTasks.length > 0)", start);
  assert.ok(start > 0 && end > start);
  const compile = compileFunction(
    stripTypeScriptTypes(`function prepare() {
      let state;
      ${body.slice(start, end)}
      return readCurrentRecoveryState;
    }`) + "\nreturn prepare();",
    [
      "readState",
      "persistence",
      "request",
      "queueId",
      "cancellationSignal",
      "recoveryProcess",
      "getRuntimeProcessInstanceIdentity",
      "recoveryQueue",
      "recoveryState",
      "isDeepStrictEqual",
      "captureTaskStartCandidates",
    ],
  );
  const project = { projectId: "project", generation: 1, tasks: [] };
  const queue = { queueId: "queue", generation: 2 };
  const candidate = { projectId: "project", generation: 1, taskIds: [] };
  for (const scenario of [
    "match",
    "queue_changed",
    "project_changed",
    "duplicate",
    "cancelled",
  ]) {
    const cancellation = new AbortController();
    if (scenario === "cancelled") cancellation.abort();
    let reads = 0;
    const observe = compile(
      (repository: string, binding: string, scope: string) => {
        reads++;
        assert.deepEqual(
          [repository, binding, scope],
          ["repository", "binding", "execution"],
        );
        return {
          status: "completed",
          value: {
            projects: [
              scenario === "project_changed"
                ? { ...project, generation: 2 }
                : project,
            ],
            queueEntries: [
              scenario === "queue_changed"
                ? { ...queue, generation: 3 }
                : queue,
            ],
            taskStartCandidates:
              scenario === "duplicate" ? [candidate, candidate] : [candidate],
          },
        };
      },
      { repository: "repository", repositoryBindingId: "binding" },
      project,
      queue.queueId,
      cancellation.signal,
      "process",
      () => "process",
      queue,
      project,
      isDeepStrictEqual,
      captureTaskStartCandidates,
    );
    assert.equal(observe(), scenario === "match" ? project : null, scenario);
    assert.equal(reads, scenario === "cancelled" ? 0 : 1, scenario);
  }
});

/**
 * Graph実行準備で同版のQueue・Project・候補だけを取得する。
 * @responsibility 別改訂版と候補欠測を実行準備成功へ変えない。
 * @trace PRL-UT-014
 * @precondition 実準備関数に既存EM読取りの有限結果を渡す。
 * @stimulus 同版一致、Queueの改訂版違いと候補欠測、不正なTask別実行入力を与える。
 * @observation 読取り回数と準備結果。
 * @oracle 一回の読取りで一致時だけ実行準備を返し、入力順と元の参照を維持する。
 * @cleanup N/A: メモリのみ。
 * @boundary 共通実行ループのLease取得前準備。
 */
test("共通ループの準備は同版から一度だけ読み、版違いと候補欠測を拒否する", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const compile = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "prepareScheduledOperation"))});`,
    [
      "readState",
      "captureTaskStartCandidates",
      "taskExecutionMap",
      "blockExecution",
    ],
  );
  const mapExecutions = compileFunction(
    `return (${sourceDeclaration(source, "taskExecutionMap")});`,
    ["validIdentity"],
  )(validIdentity);
  const state = {
    projectId: "project",
    milestoneId: "milestone",
    repositoryRevision: "revision",
    generation: 1,
    tasks: [
      { definition: { id: "task-a" }, state: "queued" },
      { definition: { id: "task-b" }, state: "queued" },
      { definition: { id: "task-old" }, state: "superseded" },
    ],
  };
  const queue = { ...state, queueId: "queue", state: "queued" };
  const first = { taskId: "task-a", authorityBindingId: "authority-a" };
  const second = { taskId: "task-b", authorityBindingId: "authority-b" };
  const expectedRefusal = "orchestrator_task_execution_set_invalid";
  for (const [scenario, expected, taskExecutions] of [
    ["match", "scheduled", [second, first]],
    ["revision", "orchestrator_execution_identity_mismatch", [first, second]],
    ["missing", "orchestrator_state_observation_unknown", [first, second]],
    ["duplicate", expectedRefusal, [first, first]],
    ["superseded", expectedRefusal, [first, { ...second, taskId: "task-old" }]],
    ["foreign", expectedRefusal, [first, { ...second, taskId: "foreign" }]],
    [
      "authority",
      expectedRefusal,
      [first, { ...second, authorityBindingId: "" }],
    ],
    ["incomplete", expectedRefusal, [first]],
  ] as const) {
    let reads = 0;
    const prepare = compile(
      (repository: string, binding: string, scope: string) => {
        reads++;
        assert.deepEqual(
          [repository, binding, scope],
          ["repository", "binding", "execution"],
        );
        return {
          status: "completed",
          value: {
            projects: [state],
            queueEntries: [
              scenario === "revision"
                ? { ...queue, repositoryRevision: "other" }
                : queue,
            ],
            taskStartCandidates:
              scenario === "missing"
                ? []
                : [
                    {
                      projectId: state.projectId,
                      generation: state.generation,
                      taskIds: [],
                    },
                  ],
          },
        };
      },
      captureTaskStartCandidates,
      mapExecutions,
      (_input: unknown, reason: string) => ({ reason }),
    );
    const output = prepare(
      {
        repository: "repository",
        repositoryBindingId: "binding",
      },
      {
        ...queue,
        taskExecutions,
        cancellationSignal: new AbortController().signal,
      },
    );
    assert.equal(output.kind ?? output.reason, expected, scenario);
    assert.equal(reads, 1, scenario);
    if (scenario === "match") {
      assert.deepEqual([...output.executions.keys()], ["task-b", "task-a"]);
      assert.strictEqual(output.executions.get("task-a"), first);
      assert.strictEqual(output.executions.get("task-b"), second);
    }
  }

  const events: string[] = [];
  const persistence = {
    workingDirectory: "graph-root",
    repositoryBindingId: "graph-binding",
  };
  const input = { projectId: "graph-project", queueId: "graph-request" };
  const leaseFailure = {
    status: "blocked",
    reason: "synthetic_lease_blocked",
    recoveryId: null,
  };
  const prepareRefusal = {
    status: "blocked",
    reason: "synthetic_prepare_blocked",
  };
  let rejectPreparation = false;
  const single = {
    kind: "single",
    deps: {
      root: "single-root",
      binding: "single-binding",
      projectId: "single-project",
    },
    requestId: "single-request",
  };
  const run = compileFunction(
    `return (${sourceDeclaration(source, "runCoordinatorOperation")});`,
    [
      "setImmediate",
      "prepareScheduledOperation",
      "acquireCoordinatorSnapshotLease",
      "executeSingleOperation",
      "blockExecution",
    ],
  )(
    async () => {
      events.push("defer");
    },
    (received: unknown, receivedInput: unknown) => {
      assert.equal(received, persistence);
      assert.equal(receivedInput, input);
      events.push("prepare");
      return rejectPreparation
        ? prepareRefusal
        : { kind: "scheduled", state, queue };
    },
    (
      root: string,
      binding: string,
      project: string,
      id: string,
      purpose: string,
    ) => {
      const kind = root === "single-root" ? "single" : "graph";
      assert.deepEqual(
        [root, binding, project, id, purpose],
        [
          `${kind}-root`,
          `${kind}-binding`,
          `${kind}-project`,
          `${kind}-request`,
          "project-operation",
        ],
      );
      events.push(`lease:${kind}`);
      return leaseFailure;
    },
    (operation: unknown, lease: unknown) => {
      assert.equal(operation, single);
      assert.equal(lease, leaseFailure);
      events.push("single");
    },
    (receivedInput: unknown, reason: unknown) => {
      assert.equal(receivedInput, input);
      assert.equal(reason, leaseFailure.reason);
      events.push("graph-refusal");
      return reason;
    },
  );
  const pending = run(single);
  assert.deepEqual(events, ["defer"]);
  assert.equal(await pending, undefined);
  assert.deepEqual(events.splice(0), ["defer", "lease:single", "single"]);
  assert.equal(
    await run({ kind: "scheduled", persistence, input }),
    leaseFailure.reason,
  );
  assert.deepEqual(events.splice(0), [
    "prepare",
    "lease:graph",
    "graph-refusal",
  ]);
  rejectPreparation = true;
  assert.equal(
    await run({ kind: "scheduled", persistence, input }),
    prepareRefusal,
  );
  assert.deepEqual(events, ["prepare"]);
});

/**
 * Owner喪失の観測後から通知までの順序とexact参照を確認する。
 * @trace PRL-UT-014
 * @precondition 本番関数の該当断面と有限保存Portを使用する。
 * @stimulus 観測不明、保存拒否、保存後metadata不正、任意通知のthrow／拒否を与える。
 * @observation 保存要求、通知順、後続到達と元回復ID。
 * @oracle 保存不明は停止して元参照を返し、任意診断失敗で回復を停止しない。
 * @cleanup N/A: Process内の独立した値だけ。
 * @boundary Coordinatorの観測→完成保存→候補捕捉→通知の接続。
 */
test("Owner喪失保存の拒否と候補不正でも取得済みexact参照を保持する", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const body = sourceDeclaration(source, "executeCoordinatorObjective");
  const begin = body.indexOf(
    "if (applicationId === null && activeTasks.length > 0)",
  );
  const end = body.indexOf("if (!applicationId) {", begin);
  assert.ok(begin >= 0 && end > begin);
  const blocked = compileFunction(
    `return (${sourceDeclaration(source, "blocked")});`,
    ["createCoordinatorObjectiveResult"],
  )(createCoordinatorObjectiveResult);
  const evaluate = compileFunction(
    `return (async()=>{let state=initial;let applicationId=null;
    const activeTasks=state.value.tasks.filter(item=>["starting","running"].includes(item.state));
    const operationIds=activeTasks.map(item=>item.operationId).filter(item=>item!==null);
    ${body.slice(begin, end)}
    return {status:"continued",value:state.value};
  })();`,
    [
      "initial",
      "request",
      "queueId",
      "resolveRuntimeOwnedDockerTaskCurrentCorrelations",
      "getRepository",
      "inspectRecoveryCorrelationBindings",
      "persistence",
      "captureObjectiveRecoveryWrite",
      "blocked",
      "createProjectRecoveryApplicationId",
      "dependencies",
      "saveProjectExecutionState",
      "writeCoordinatorRecoveryDiagnostic",
    ],
  );
  const request = inspectCoordinatorObjectiveRequest(objective);
  assert.ok(request);
  const base = projectExecutionFixture({
    taskExecutionSelections: fixtureTaskExecutionSelections(),
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    repositoryRevision: request.repositoryRevision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: request.plan.milestoneAcceptanceCriteria,
    objectives: request.plan.objectives,
    tasks: request.plan.tasks,
    ownerGeneration: "owner",
  }).state;
  const first = base.tasks[0];
  assert.ok(first);
  const recoveryId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  const active = {
    ...base,
    tasks: [
      {
        ...first,
        state: "running",
        startPhase: "running",
        operationId: "operation-a",
      },
    ],
  };
  const saved = {
    ...active,
    generation: active.generation + 1,
    tasks: [
      {
        ...active.tasks[0],
        state: "recovery_required",
        startPhase: "settled",
        recoveryObligations: [
          { kind: "docker", recoveryId, phase: "required" },
        ],
      },
    ],
  };
  const bindings = [
    { operationId: "operation-a", status: "matched", recoveryId },
  ];
  const recoveryTasks = saved.tasks as Parameters<
    typeof createProjectRecoveryApplicationId
  >[2];
  const recoveryTask = recoveryTasks[0];
  assert.ok(recoveryTask);
  const previousTask = {
    ...recoveryTask,
    definition: { ...recoveryTask.definition, id: "previous-task" },
    state: "ready" as const,
    recoveryObligations: [
      {
        kind: "host" as const,
        recoveryId: "host.previous",
        phase: "settled" as const,
      },
    ],
  };
  const calculateExpected = (references: readonly string[]) =>
    `project-recovery-application-${createHash("sha256")
      .update([request.projectId, "queue", ...references].join("\0"))
      .digest("hex")
      .slice(0, 40)}`;
  const exactReference = `${recoveryTask.definition.id}:docker:${recoveryId}`;
  assert.equal(
    createProjectRecoveryApplicationId(request.projectId, "queue", []),
    null,
  );
  assert.equal(
    createProjectRecoveryApplicationId(
      request.projectId,
      "queue",
      recoveryTasks,
    ),
    calculateExpected([exactReference]),
  );
  const allReferences = [
    exactReference,
    "previous-task:host:host.previous",
  ].sort();
  assert.equal(
    createProjectRecoveryApplicationId(request.projectId, "queue", [
      previousTask,
      recoveryTask,
    ]),
    calculateExpected(allReferences),
  );
  assert.equal(
    createProjectRecoveryApplicationId(request.projectId, "queue", [
      {
        ...recoveryTask,
        recoveryObligations: recoveryTask.recoveryObligations.map((entry) => ({
          ...entry,
          phase: "settled" as const,
        })),
      },
      previousTask,
    ]),
    calculateExpected(allReferences),
  );
  for (const profile of [
    "unknown",
    "save_failure",
    "metadata",
    "normal",
    "notify_throw",
    "notify_reject",
  ]) {
    const events: string[] = [];
    const callbacks = {
      resolveTaskRecoveryCorrelations(): unknown {
        assert.strictEqual(this, callbacks);
        events.push("observe");
        return profile === "unknown" ? null : bindings;
      },
      observeRecoveryTransition() {
        events.push("notify");
        if (profile === "notify_throw") throw Error("optional_diagnostic");
        if (profile === "notify_reject")
          return Promise.reject(Error("optional_diagnostic"));
      },
      recoverTaskRecovery() {
        assert.fail("この断面で技術回収しない");
      },
    };
    const result = (await evaluate(
      { status: "completed", value: active },
      request,
      "queue",
      () => callbacks.resolveTaskRecoveryCorrelations(),
      () => ({ status: "blocked" }),
      (raw: unknown) => raw,
      { repositoryBindingId: "binding" },
      captureObjectiveRecoveryWrite,
      blocked,
      (projectId: string, queueId: string, tasks: typeof recoveryTasks) => {
        events.push("continue");
        assert.equal(projectId, request.projectId);
        assert.equal(queueId, "queue");
        assert.strictEqual(tasks, saved.tasks);
        return createProjectRecoveryApplicationId(projectId, queueId, tasks);
      },
      {},
      (
        _repository: unknown,
        binding: string,
        command: unknown,
        generation: number,
      ) => {
        assert.equal(binding, "binding");
        events.push("save");
        assert.deepEqual(command, {
          kind: "task_owner_loss",
          projectId: request.projectId,
          bindings,
        });
        assert.equal(generation, active.generation);
        return profile === "save_failure"
          ? { status: "blocked", reason: "fixture_save_failure" }
          : {
              status: "completed",
              value: saved,
              taskStartCandidates:
                profile === "metadata"
                  ? null
                  : {
                      projectId: saved.projectId,
                      generation: saved.generation,
                      taskIds: [],
                    },
            };
      },
      compileFunction(
        "return (" +
          sourceDeclaration(
            recoveryDiagnosticSource,
            "writeCoordinatorRecoveryDiagnostic",
          ) +
          ");",
        ["productionRecoveryDiagnosticReporter"],
      )({ report: () => callbacks.observeRecoveryTransition() }),
    )) as {
      status: string;
      effectState?: string;
      cleanupConfirmed?: boolean;
      manualRecoveryRequired?: boolean;
      recoveryIds?: readonly string[];
      recoveryObligations?: readonly unknown[];
    };
    if (["unknown", "save_failure", "metadata"].includes(profile)) {
      assert.equal(result.status, "blocked");
      assert.equal(result.effectState, "unknown");
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(result.manualRecoveryRequired, true);
      assert.deepEqual(
        events,
        profile === "unknown" ? ["observe"] : ["observe", "save"],
      );
      if (profile !== "unknown") {
        assert.deepEqual(result.recoveryIds, [recoveryId]);
        assert.deepEqual(result.recoveryObligations, [
          { kind: "docker", recoveryId },
        ]);
      }
    } else {
      assert.equal(result.status, "continued");
      assert.deepEqual(events, ["observe", "save", "notify", "continue"]);
    }
  }
});

/**
 * 初回受付に限定した未初期化の例外を固定する。
 * @trace PRL-UT-014
 * @precondition 本番の取得Owner受付断面だけを一回捕捉する。
 * @stimulus intake・結果区分・理由・手動回復・元IDを一つずつ変える。
 * @observation 取得記録の選択と拒否理由・元回復参照を確認する。
 * @oracle 全条件成立時だけacquisition:nullとなり、それ以外の不明を消さない。
 * @cleanup メモリ値だけ。
 */
test("未初期化の取得Owner例外は元intakeと全条件に限定する", () => {
  const source = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../../src/lifecycle/execution.ts", import.meta.url),
      "utf8",
    ),
  );
  const begin = source.indexOf("  const observedAcquisitionOwner =");
  const end = source.indexOf("  if (\n    resolvedAcquisition", begin);
  assert.ok(begin >= 0 && end > begin);
  const evaluate = compileFunction(
    `return (persistence,raw)=>{
    const inspectCoordinatorSnapshotLeaseAcquisitionOwner=(directory,binding)=>{
      assert.equal(directory,'root/sub');assert.equal(binding,'binding');return raw;
    };
    ${source.slice(begin, end)}
    return {acquisition: resolvedAcquisition};
  };`,
    ["assert", "wasObjectiveStateUninitialized", "blockWithoutProject"],
  )(
    assert,
    wasObjectiveStateUninitialized,
    (
      reason: string,
      recoveryId: string | null,
      manualRecoveryRequired: boolean,
    ) => ({ reason, recoveryId, manualRecoveryRequired }),
  ) as (context: object, raw: object) => object;
  for (const profile of [
    "fresh",
    "resume",
    "missing",
    "completed",
    "reason",
    "manual",
    "recovery",
  ]) {
    const raw = {
      status: profile === "completed" ? "completed" : "blocked",
      reason: profile === "reason" ? "other" : "orchestrator_snapshot_absent",
      manualRecoveryRequired: profile === "manual",
      recoveryId: profile === "recovery" ? "exact" : null,
      value: { acquisition: { original: true } },
    };
    const result = evaluate(
      {
        workingDirectory: "root/sub",
        repositoryBindingId: "binding",
        intake:
          profile === "missing"
            ? undefined
            : { operation: profile === "resume" ? "resume" : "start" },
      },
      raw,
    );
    if (profile === "fresh") assert.deepEqual(result, { acquisition: null });
    else if (profile === "completed")
      assert.strictEqual(
        (result as { acquisition: unknown }).acquisition,
        raw.value.acquisition,
      );
    else
      assert.deepEqual(result, {
        reason: raw.reason,
        recoveryId: raw.recoveryId,
        manualRecoveryRequired: raw.manualRecoveryRequired,
      });
  }
});

/**
 * 部分的に実行するObjectiveの試験へ実停止投影をつなぐ。
 * @trace PRL-UT-014
 */
function objectiveStopProjection(source: string) {
  const start = source.indexOf("  const blockWithoutProject =");
  const end = source.indexOf('  if (request.operation === "resume") {', start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}

/**
 * 回復対象Queueと主Queueを混同しない。
 * @trace PRL-UT-014
 * @precondition 本番の直接回復とQueue照合断面を使用する。
 * @stimulus 同Project別Queueの正常回復とQueue欠測・別Project・別IDを与える。
 * @observation 具体回復へ渡す全入力、元回復IDと公開失敗区分を取得する。
 * @oracle 回復対象との一致だけを許し、不一致では元参照を保持する。
 * @cleanup メモリ値だけ。
 */
test("回復後は実際の回復Queueを照合し不一致でも元参照を保持する", () => {
  const source = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../../src/lifecycle/execution.ts", import.meta.url),
      "utf8",
    ),
  );
  const objective = sourceDeclaration(source, "executeCoordinatorObjective");
  const begin = objective.indexOf(
    "    const reconciled = reconcileCoordinatorSnapshotLeaseOwnerLoss(",
  );
  const end = objective.indexOf("    const reread = readQueueEntry(", begin);
  assert.ok(begin >= 0 && end > begin);
  const observer = () => undefined;
  const evaluate = compileFunction(
    `return raw=>{
    const request={projectId:'project-a'};const queueId='primary';const recoveryQueueId='other';
    const persistence={workingDirectory:'root/sub',repositoryBindingId:'binding'};
    const observeObjectiveLeaseOwner=observer;const state={value:null};
    const reconcileCoordinatorSnapshotLeaseOwnerLoss=(...args)=>{
      assert.deepEqual(args.slice(0,5),['root/sub','binding','project-a','other','project-operation']);
      assert.equal(args[5],observer);return raw;
    };
    ${objectiveStopProjection(source)}
    ${objective.slice(begin, end)}
    return {status:'continued'};
  };`,
    ["assert", "observer", "COORDINATOR_PUBLIC_RUNTIME_CONTRACT"],
  )(assert, observer, "fixture") as (raw: object) => {
    status: string;
    reason?: string;
  };
  for (const queue of [
    { projectId: "project-a", queueId: "other" },
    { projectId: "foreign", queueId: "other" },
    { projectId: "project-a", queueId: "primary" },
    null,
  ]) {
    for (const recoveryId of ["exact-recovery", null]) {
      const result = evaluate({
        status: "completed",
        value: { queue, recoveryId },
      });
      if (queue?.projectId === "project-a" && queue.queueId === "other")
        assert.equal(result.status, "continued");
      else {
        assert.deepEqual(result, {
          contract: "fixture",
          status: "blocked",
          reason: "orchestrator_lease_recovery_queue_mismatch",
          recoveryIds: recoveryId ? [recoveryId] : [],
          manualRecoveryRequired: recoveryId !== null,
          cleanupConfirmed: recoveryId === null,
          effectState: recoveryId === null ? "no_effect" : "unknown",
        });
      }
    }
  }
  for (const manual of [false, true]) {
    for (const recoveryId of [null, "exact-recovery"]) {
      const expectedManual = manual || recoveryId !== null;
      assert.deepEqual(
        evaluate({
          status: "blocked",
          reason: "recovery_not_confirmed",
          recoveryId,
          manualRecoveryRequired: manual,
        }),
        {
          contract: "fixture",
          status: "blocked",
          reason: "recovery_not_confirmed",
          recoveryIds: recoveryId ? [recoveryId] : [],
          manualRecoveryRequired: expectedManual,
          cleanupConfirmed: !expectedManual,
          effectState: expectedManual ? "unknown" : "no_effect",
        },
      );
    }
  }
});

/**
 * 初回Project読取りの例外は元intakeとReaderの全条件へ限定する。
 * @responsibility Factory撤去後も観測不能を新規受付へ変えない。
 * @trace PRL-UT-014
 * @precondition 実Objectiveの初回読取り断面を一度だけ捕捉する。
 * @stimulus 元intake、結果区分、理由、手動回復、回復IDを独立に変える。
 * @observation 元Repository・binding・Projectと投影結果。
 * @oracle 全条件一致だけ未初期化を認め、既存Projectは元の値、不明は元の停止理由と参照を返す。
 * @cleanup N/A: 局所値のみ。
 * @boundary 元の受付情報とEM Readerの有限結果。
 */
test("初回Project読取りの未初期化例外は元intakeの全条件だけで許可する", () => {
  const source = sourceDeclaration(
    fs.readFileSync(
      new URL("../../../src/lifecycle/execution.ts", import.meta.url),
      "utf8",
    ),
    "executeCoordinatorObjective",
  );
  const start = source.indexOf("  const observedProject =");
  const end = source.indexOf("  if (state.value === null)", start);
  assert.ok(start > 0 && end > start);
  const evaluate = new Function(
    "readProjectExecutionState",
    "persistence",
    "request",
    "wasObjectiveStateUninitialized",
    "blockWithoutProject",
    `${stripTypeScriptTypes(`function intakeState() {${source.slice(start, end)} return state;}`)} return intakeState();`,
  ) as (...args: unknown[]) => unknown;
  const base = Object.freeze({
    status: "blocked",
    reason: "orchestrator_snapshot_absent",
    value: null,
    manualRecoveryRequired: false,
    recoveryId: null,
  });
  const repository = Object.freeze({});
  const existing = Object.freeze({ projectId: "project-a" });
  const candidates = Object.freeze({});
  for (const profile of [
    "fresh",
    "resume",
    "missing",
    "reason",
    "manual",
    "reference",
    "completed",
  ] as const) {
    const observed =
      profile === "reason"
        ? { ...base, reason: "reader_unknown" }
        : profile === "manual"
          ? { ...base, manualRecoveryRequired: true }
          : profile === "reference"
            ? { ...base, recoveryId: "original-reference" }
            : profile === "completed"
              ? {
                  ...base,
                  status: "completed",
                  value: existing,
                  taskStartCandidates: candidates,
                }
              : base;
    let reads = 0;
    const actual = evaluate(
      (...args: unknown[]) => {
        reads++;
        assert.deepEqual(args, [repository, "binding-a", "project-a"]);
        return observed;
      },
      {
        repository,
        repositoryBindingId: "binding-a",
        intake:
          profile === "missing"
            ? undefined
            : { operation: profile === "resume" ? "resume" : "start" },
      },
      { projectId: "project-a", operation: "start" },
      wasObjectiveStateUninitialized,
      (
        reason: string,
        recoveryId: string | null,
        manualRecoveryRequired: boolean,
      ) => ({ reason, recoveryId, manualRecoveryRequired }),
    );
    assert.equal(reads, 1, profile);
    if (profile === "fresh")
      assert.deepEqual(actual, {
        value: null,
        taskStartCandidates: null,
      });
    else if (profile === "completed") {
      assert.deepEqual(actual, {
        value: existing,
        taskStartCandidates: candidates,
      });
      assert.strictEqual((actual as { value: unknown }).value, existing);
    } else
      assert.deepEqual(actual, {
        reason: observed.reason,
        recoveryId: observed.recoveryId,
        manualRecoveryRequired: true,
      });
  }
});

/**
 * 最終読取り欠測では実行結果と元回復参照を維持する。
 * @responsibility Reader失敗を新しい実行失敗へ一律変換しない。
 * @trace PRL-UT-014
 * @precondition 実Objectiveの最終結果断面を一度捕捉する。
 * @stimulus Reader blockedとProject不存在を与える。
 * @observation 公開状態・理由・清掃・回復参照と投影。
 * @oracle 元実行結果を保持し、投影だけnullにする。
 * @cleanup N/A: 局所値のみ。
 * @boundary EM最終観測と元実行結果の公開投影。
 */
test("最終Project読取りの欠測は元実行結果と回復参照を変更しない", async () => {
  const body = sourceDeclaration(
    fs.readFileSync(
      new URL("../../../src/lifecycle/execution.ts", import.meta.url),
      "utf8",
    ),
    "executeCoordinatorObjective",
  );
  const start = body.indexOf("  const latest = readProjectExecutionState");
  assert.ok(start > 0);
  const evaluate = compileFunction(
    `return (async () => {${body.slice(start, body.lastIndexOf("}"))}})();`,
    [
      "readProjectExecutionState",
      "persistence",
      "request",
      "execution",
      "inspectTaskStartCandidates",
      "projectCoordinatorState",
      "createCoordinatorObjectiveResult",
      "queueId",
    ],
  );
  const repository = Object.freeze({});
  const execution = {
    status: "blocked",
    reason: "original_execution_reason",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: true,
    recoveryIds: ["original-recovery"],
    recoveryObligations: [
      { kind: "runtime_process", recoveryId: "original-recovery" },
    ],
    effectState: "unknown",
  };
  for (const observed of [
    {
      status: "blocked",
      reason: "reader_unknown",
      recoveryId: "reader-reference",
      value: null,
    },
    { status: "completed", reason: "absent", value: null },
  ]) {
    const result = (await evaluate(
      (...args: unknown[]) => {
        assert.deepEqual(args, [repository, "binding-a", objective.projectId]);
        return observed;
      },
      { repository, repositoryBindingId: "binding-a" },
      objective,
      execution,
      () => assert.fail("missing Project has no candidates"),
      () => assert.fail("missing Project cannot project"),
      createCoordinatorObjectiveResult,
      "queue-a",
    )) as Record<string, unknown>;
    assert.equal(result.status, execution.status);
    assert.equal(result.reason, execution.reason);
    assert.equal(result.cleanupConfirmed, execution.cleanupConfirmed);
    assert.equal(
      result.manualRecoveryRequired,
      execution.manualRecoveryRequired,
    );
    assert.equal(
      result.processRestartRequired,
      execution.processRestartRequired,
    );
    assert.deepEqual(result.recoveryIds, execution.recoveryIds);
    assert.deepEqual(result.recoveryObligations, execution.recoveryObligations);
    assert.equal(result.effectState, execution.effectState);
    assert.equal(result.projection, null);
  }
});
