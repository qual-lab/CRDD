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
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
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
import { createRuntimeProcessRecoveryIdentity } from "../../../src/execution/process-safety-state.ts";
import {
  buildObjectiveTaskRequest,
  createCoordinatorObjectiveResult,
} from "../../../src/objective/execute.ts";
import { inspectCoordinatorObjectivePlan } from "../../../src/objective/plan.ts";
import { resolveCoordinatorReplan } from "../../../src/objective/replan.ts";
import { resolveTaskExecutionSelections } from "../../../src/selection/resolve.ts";
import type { CoordinatorStatePort } from "../../../src/state/persistence.ts";
import {
  inspectCoordinatorObjectiveResult,
  inspectTaskStartCandidates,
} from "../../../src/state/projection.ts";
import { createCoordinatorTaskRecoveryAdapter } from "../../../src/task/dispatch.ts";
import { selectionConfig } from "../../fixtures/ai-selection.ts";

/**
 * Docker回復の確定は任意State保存ではなく有限更新へ接続する。
 * @responsibility 同じTask・回復IDと期待世代の搬送、保存後metadata拒否と元参照保全を確認する。
 * @trace PRL-UT-014
 * @precondition 実Objectiveの回復確定断面と有限の保存応答を使う。
 * @stimulus 正常・fresh差・未回収・保存拒否・保存後候補欠測を与える。
 * @observation 有限要求、保存回数、後続通知と元回復ID。
 * @oracle 保存成功と同版候補の確認後だけ通知し、拒否時はexact参照を保持する。
 * @cleanup メモリ値のみ。
 * @boundary Coordinator調停とEMの完成更新。実WriterはEM試験で確認する。
 */
test("Docker回復確定は有限要求を渡し保存不明で元参照を保持する", async () => {
  const source = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../../src/objective/execute.ts", import.meta.url),
      "utf8",
    ),
  );
  const begin = source.indexOf(
    "    const recoveredDocker = recoveries.filter(",
  );
  const end = source.indexOf("    const externallyOwnedItems", begin);
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
    const request={projectId:'project-a',milestoneId:'milestone-a'};const queueId='queue-a';
    const recoveries=[{kind:'docker',taskId:'task-a',recoveryId:${JSON.stringify(id)}}];
    const readCurrentRecoveryState=()=>scenario==='fresh_unknown'?null:initial;
    const persistence={state:{writeState:()=>{throw Error('raw_state_writer_called')},updateTask:(input,generation)=>{
      calls++;assert.deepEqual(input,{kind:'task_recovery_finalize',projectId:'project-a',recoveries:[{taskId:'task-a',recoveryId:${JSON.stringify(id)}}]});
      assert.equal(generation,4);
      if(scenario==='save_blocked')return {status:'blocked',reason:'save_unconfirmed'};
      return {status:'completed',reason:'saved',value:{...initial,generation:5},taskStartCandidates:scenario==='metadata_unknown'?null:{projectId:'project-a',generation:5,taskIds:[]}};
    }}};
    const taskRecovery={observeTransition:async value=>events.push(value)};
    ${source.slice(begin, end)}
    return {status:'continued',calls,events,state};
  })();`,
    ["initial", "scenario", "assert", "blocked", "inspectTaskStartCandidates"],
  );
  for (const scenario of [
    "normal",
    "fresh_unknown",
    "save_blocked",
    "metadata_unknown",
    "cleanup_unknown",
  ]) {
    const input =
      scenario === "cleanup_unknown"
        ? {
            ...initial,
            tasks: initial.tasks.map((task) => ({
              ...task,
              cleanupConfirmed: false,
            })),
          }
        : initial;
    const result = await evaluate(
      input,
      scenario,
      assert,
      stop,
      inspectTaskStartCandidates,
    );
    if (scenario === "normal") {
      assert.equal(result.status, "continued");
      assert.equal(result.calls, 1);
      assert.equal(result.events.length, 1);
      assert.equal(result.events[0].phase, "verification_resources_finalized");
    } else {
      assert.equal(result.status, "blocked");
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(result.manualRecoveryRequired, true);
      assert.deepEqual(result.recoveryIds, [id]);
    }
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
    new URL("../../../src/objective/execute.ts", import.meta.url),
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
    "createObjectiveIntake",
    "inspectTaskStartCandidates",
    "blocked",
  ])(
    () => true,
    () => ({ queueId: "queue", requestHash: "hash" }),
    inspectTaskStartCandidates,
    blocked,
  ) as (
    deps: object,
    request: object,
    signal: AbortSignal,
  ) => Promise<ReturnType<typeof createCoordinatorObjectiveResult>>;
  const initial = await intake(
    {
      authenticatedPrincipalId: "principal",
      repositoryBindingId: "binding",
      clockIdentity: { createContentHash: () => "hash" },
      plan: request.plan,
      persistence: {
        lease: {
          inspectAcquisitionOwner: () => ({
            status: "completed",
            value: { acquisition: null },
          }),
        },
        state: {
          readState: () => ({
            status: "completed",
            value: known,
            taskStartCandidates: null,
          }),
          enqueueOperation: () => {
            effects++;
            assert.fail("候補不正で受付しない");
          },
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
    body.indexOf("const latest = persistence.state.readState"),
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
      {
        state: {
          readState: () => {
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
        },
      },
      request,
      execution,
      inspectTaskStartCandidates,
      blocked,
      () => assert.fail("不正な候補を投影しない"),
      createCoordinatorObjectiveResult,
      "queue",
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
  for (const stage of ["recovering", "settled"]) {
    const writeName = `${stage}Write`;
    const start = body.indexOf(
      "state = Object.freeze({",
      body.indexOf(`if (${writeName}.status`),
    );
    const stop = body.indexOf(`recoveryState = ${writeName}.value;`, start);
    const recovering = compileFunction(
      `let state; ${body.slice(start, stop)} return null;`,
      [
        writeName,
        "request",
        "queueId",
        "item",
        "inspectTaskStartCandidates",
        "blocked",
      ],
    );
    const savedState =
      stage === "settled"
        ? {
            ...known,
            tasks: known.tasks.map((task) => ({
              ...task,
              recoveryObligations: task.recoveryObligations.map((item) =>
                item.kind === "docker"
                  ? { ...item, phase: "settled" as const }
                  : item,
              ),
            })),
          }
        : known;
    const result = recovering(
      {
        status: "completed",
        reason: "saved",
        value: savedState,
        taskStartCandidates: null,
      },
      request,
      "queue",
      obligations[0],
      inspectTaskStartCandidates,
      blocked,
    ) as ReturnType<typeof createCoordinatorObjectiveResult>;
    assert.equal(result.effectState, "unknown");
    assert.deepEqual(
      new Set(result.recoveryIds),
      new Set([dockerId, processId]),
    );
    assert.ok(inspectCoordinatorObjectiveResult(result));
  }
});

/**
 * 再計画保存の成功metadataを現在の結果と同じ断面で捕捉する。
 * @trace PRL-UT-014
 * @precondition 不変の初期Stateを一度だけ準備し、各差分は独立した値とPortを使う。
 * @stimulus 成功Task IDの欠測・別対象・Proxyと、Project・世代の不一致を与える。
 * @observation 後続Queue更新数、停止区分とhook実行回数。
 * @oracle 不明な成功応答を完了や未実施へ補完せず、後続更新を停止する。
 * @cleanup メモリのみ。
 */
test("再計画保存の成功metadata不正はQueueを進めず保存後不明にする", () => {
  const base = projectExecutionFixture({
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "a".repeat(40),
    ownerGeneration: "owner-a",
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["done"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["done"] }],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["file.txt"],
        conflictKeys: [],
      },
    ],
    taskExecutionSelections: fixtureTaskExecutionSelections(),
  }).state;
  let hooks = 0;
  for (const mode of [
    "ok",
    "missing",
    "wrong",
    "proxy",
    "project",
    "generation",
  ]) {
    const before = {
      ...structuredClone(base),
      tasks: base.tasks.map((item) => ({
        ...structuredClone(item),
        state: "failed" as const,
      })),
    };
    let queueWrites = 0;
    const after = {
      ...structuredClone(before),
      generation: before.generation + 1,
      ...(mode === "project" ? { projectId: "other" } : {}),
      ...(mode === "generation" ? { generation: before.generation } : {}),
    };
    const port = {
      readState: () => ({ status: "completed", value: before }),
      readQueue: () => ({
        status: "completed",
        value: {
          projectId: "project-a",
          milestoneId: "milestone-a",
          state: "replan_required",
          ownerGeneration: null,
          generation: 1,
        },
      }),
      updateTask: () => ({
        status: "completed",
        value: after,
        ...(mode === "missing"
          ? {}
          : {
              taskUpdateTaskIds:
                mode === "wrong"
                  ? ["other"]
                  : mode === "proxy"
                    ? new Proxy(["task-a"], {
                        get() {
                          hooks++;
                          throw Error("hook");
                        },
                      })
                    : ["task-a"],
            }),
      }),
      updateQueue: () => {
        queueWrites++;
        return { status: "completed" };
      },
    } as unknown as CoordinatorStatePort;
    const result = resolveCoordinatorReplan(
      port,
      {
        projectId: "project-a",
        milestoneId: "milestone-a",
        queueId: "queue-a",
        maximumReplans: 1,
      },
      () => ({ disposition: "maintain_plan", reason: "fixture" }),
    );
    assert.equal(queueWrites, mode === "ok" ? 1 : 0, mode);
    assert.equal(result.status, mode === "ok" ? "completed" : "blocked", mode);
    if (mode !== "ok") {
      assert.equal(result.effectState, "unknown");
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(result.manualRecoveryRequired, true);
    }
  }
  assert.equal(hooks, 0);
});
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

import { inspectCoordinatorObjectiveRequest } from "../../../src/objective/plan.ts";

/**
 * 同じ受付が捕捉した計画と、別参照の依存返却値を区別する。
 * @responsibility exact参照だけを再利用し、別値の検査・例外時停止を維持する。
 * @trace PRL-UT-014
 * @precondition 公開受付の実検査で独立・凍結した要求を使用する。
 * @stimulus exact計画、同値別Object、範囲外、getter、Proxy、null、例外を返す。
 * @observation 計画検査回数、内部実行への搬送値と停止理由。
 * @oracle exactだけ再検査0。別参照は検査1。不正値は実行0、hook0。
 * @cleanup 値のみ。保存・Process・外部実行を発行しない。
 * @boundary 受付済み要求と未信頼の計画依存。
 */
test("受付計画はexact参照だけ再利用し別参照と不正返却を検査する", async () => {
  const request = inspectCoordinatorObjectiveRequest(objective);
  assert.ok(request);
  const source = fs.readFileSync(
    new URL("../../../src/objective/execute.ts", import.meta.url),
    "utf8",
  );
  let inspections = 0;
  let executions = 0;
  let delivered: unknown;
  const run = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "executeAcceptedCoordinatorObjective"))});`,
    [
      "isPrincipalId",
      "blocked",
      "inspectBinding",
      "inspectCoordinatorObjectivePlan",
      "createCoordinatorExecutionHostPorts",
      "createCoordinatorSnapshotPersistencePorts",
      "createCoordinatorTaskRecoveryAdapter",
      "executeCoordinatorObjective",
      "readObjectiveReplay",
      "createObjectiveIntake",
      "initializeExecutionStore",
      "verifyRuntimePersistenceRepository",
    ],
  )(
    isPrincipalId,
    (_request: unknown, reason: string) => ({ status: "blocked", reason }),
    () => ({
      repositoryBindingId: "binding",
      repositoryRoot: {},
      workingDirectory: {},
      bindingCapability: {},
    }),
    (raw: unknown, accepted: typeof request) => {
      inspections += 1;
      return inspectCoordinatorObjectivePlan(raw, accepted);
    },
    () => ({
      clockIdentity: {
        createStableId: () => "queue",
        createContentHash: () => "hash",
      },
    }),
    () => ({}),
    () => ({}),
    async (dependencies: { plan: unknown }) => {
      executions += 1;
      delivered = dependencies.plan;
      return { status: "blocked", reason: "finite_execution_reached" };
    },
    () => null,
    () => ({}),
    () => ({ status: "completed", value: null }),
    () => ({}),
  ) as (
    dependencies: {
      authenticatedPrincipalId: string;
      verifyProjectBinding: () => object;
      planObjective: () => unknown;
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
    [new Error("planner_failed"), false],
  ] as const) {
    inspections = 0;
    executions = 0;
    delivered = null;
    const result = await run(
      {
        authenticatedPrincipalId: "principal-a",
        verifyProjectBinding: () => ({}),
        planObjective: () => {
          if (value instanceof Error) throw value;
          return value;
        },
      },
      request,
      new AbortController().signal,
    );
    assert.equal(inspections, value === request.plan ? 0 : 1);
    assert.equal(executions, valid ? 1 : 0);
    assert.equal(
      result.reason,
      valid
        ? "finite_execution_reached"
        : "orchestrator_plan_invalid_or_out_of_scope",
    );
    if (valid) assert.deepEqual(delivered, request.plan);
    if (value === request.plan) assert.equal(delivered, request.plan);
  }
  assert.equal(hooks, 0);
  const identity = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "createObjectiveIntake"))});`,
  )() as (
    request: object,
    binding: string,
    principal: string,
    clock: object,
  ) => { queueId: string; requestHash: string };
  const clock = {
    createStableId: (_prefix: string, parts: string[]) => parts.join("/"),
    createContentHash: (text: string) => text,
  };
  const original = identity(request, "binding", "principal-a", clock);
  assert.deepEqual(
    { ...original, operation: "resume" },
    identity(
      { ...request, operation: "resume" },
      "binding",
      "principal-a",
      clock,
    ),
  );
  const reordered = inspectCoordinatorObjectiveRequest(
    Object.fromEntries(Object.entries(request).reverse()),
  );
  assert.ok(reordered);
  assert.deepEqual(
    original,
    identity(reordered, "binding", "principal-a", clock),
  );
  const changed = identity(
    { ...request, milestoneId: "other" },
    "binding",
    "principal-a",
    clock,
  );
  assert.equal(changed.queueId, original.queueId);
  assert.notEqual(changed.requestHash, original.requestHash);
  const project = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "projectObjectiveReplay"))});`,
    [
      "createCoordinatorObjectiveResult",
      "projectCoordinatorState",
      "inspectTaskStartCandidates",
    ],
  )(
    createCoordinatorObjectiveResult,
    (state: { milestone: { state: string } }) => ({
      milestoneState: state.milestone.state,
      nextAction: "recover",
    }),
    () => ({}),
  ) as (
    request: object,
    queue: object,
    state: object | null,
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
  const replay = project(request, queue, state);
  assert.equal(replay.effectState, "unknown");
  assert.equal(replay.manualRecoveryRequired, true);
  assert.equal(replay.cleanupConfirmed, false);
  assert.deepEqual([...replay.recoveryIds], ["original-recovery"]);
  assert.equal(
    project(request, queue, { ...state, milestoneId: "newer" }).projection,
    null,
  );
  assert.equal(
    project(request, { ...queue, state: "completed" }, null).status,
    "completed",
  );
  const execute = compileFunction(
    `return (${sourceDeclaration(source, "executeCoordinatorObjective")});`,
    [
      "isPrincipalId",
      "blocked",
      "createObjectiveIntake",
      "inspectTaskExecutionSelections",
    ],
  )(
    isPrincipalId,
    (_request: unknown, reason: string) => ({ status: "blocked", reason }),
    identity,
    inspectTaskExecutionSelections,
  ) as (
    deps: object,
    input: object,
    signal: AbortSignal,
  ) => Promise<{ reason: string }>;
  const forbidden = () => assert.fail("unknown resume must not issue effects");
  let reads = 0;
  const rejected = await execute(
    {
      authenticatedPrincipalId: "principal-a",
      repositoryBindingId: "binding",
      clockIdentity: clock,
      plan: request.plan,
      resolveTaskSelections: forbidden,
      persistence: {
        state: {
          readQueue: () => {
            reads++;
            return { status: "blocked", reason: "fixture_missing" };
          },
          readState: forbidden,
          writeState: forbidden,
          enqueueOperation: forbidden,
        },
        get lease() {
          return forbidden();
        },
      },
      execution: { runSingleTaskAttempt: forbidden },
    },
    { ...request, operation: "resume" },
    new AbortController().signal,
  );
  assert.equal(rejected.reason, "fixture_missing");
  assert.equal(reads, 1);
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
    const result = await execute(
      {
        authenticatedPrincipalId: "principal-a",
        repositoryBindingId: "binding",
        clockIdentity: clock,
        plan: request.plan,
        resolveTaskSelections: () => ({ status: "resolved", value }),
        persistence: {
          lease: {
            inspectAcquisitionOwner: () => ({
              status: "completed",
              value: { acquisition: null },
            }),
          },
          state: {
            readState: () => ({ status: "completed", value: null }),
            enqueueOperation: () => {
              enqueues++;
              return forbidden();
            },
          },
        },
        execution: { runSingleTaskAttempt: forbidden },
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
    new URL("../../../src/objective/execute.ts", import.meta.url),
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
      "taskRecovery",
      "inspectRecoveryCorrelationBindings",
      "persistence",
      "inspectTaskStartCandidates",
      "blocked",
      "recoveryApplicationId",
      "dependencies",
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
  for (const profile of [
    "unknown",
    "save_failure",
    "metadata",
    "normal",
    "notify_throw",
    "notify_reject",
  ]) {
    const events: string[] = [];
    const adapter = createCoordinatorTaskRecoveryAdapter({
      resolveTaskRecoveryCorrelations() {
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
    });
    const result = (await evaluate(
      { status: "completed", value: active },
      request,
      "queue",
      adapter,
      (raw: unknown) => raw,
      {
        state: {
          updateTask(command: unknown, generation: number) {
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
        },
      },
      inspectTaskStartCandidates,
      blocked,
      () => {
        events.push("continue");
        return "application";
      },
      { clockIdentity: {} },
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
