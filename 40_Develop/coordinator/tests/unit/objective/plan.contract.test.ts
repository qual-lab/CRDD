/**
 * orchestrator:unit:objective-intakeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility orchestrator:unit:objective-intakeが所有する検証責務を実行する。
 * @trace PPR-UT-006
 * @trace PRL-UT-006
 * @level UT
 * @scope project、runtime、objective、intake、public
 * @boundary PPR-UT-006=N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。 / PRL-UT-006=N/A: Task Authority縮小と結果状態の規則は外部実行境界を持たない。
 */

import assert from "node:assert/strict";
import test from "node:test";
import { withCallerPlan } from "../../../../execution-model/tests/fixtures/execution-plan.ts";
import {
  createCoordinatorObjectiveResult,
  createCoordinatorTaskExecutionSet,
  executeCoordinatorPublicObjective,
  runCoordinatorObjective,
} from "../../../src/objective/execute.ts";
import { inspectCoordinatorObjectivePlan } from "../../../src/objective/plan.ts";
import { createCoordinatorState } from "../../../src/state/create.ts";
import { taskExecutionSelections } from "../../fixtures/ai-selection.ts";

const objectiveRequest = Object.freeze(
  withCallerPlan({
    requestId: "request-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "a".repeat(40),
    objective: "限定された成果物を更新する",
    acceptanceCriteria: Object.freeze(["成果物が受入条件を満たす"]),
    allowedPaths: Object.freeze(["40_Develop/coordinator"]),
    readPaths: Object.freeze(["06_Architecture/orchestrator"]),
    maximumConcurrency: 2,
    maximumReplans: 1,
    originLane: "interactive" as const,
    adoptResult: false,
    intakeEpoch: "fixture-epoch",
  }),
);

const COORDINATOR_OBJECTIVE_PLAN = Object.freeze({
  milestoneAcceptanceCriteria: Object.freeze(["全Taskを統合できる"]),
  objectives: Object.freeze([
    Object.freeze({
      id: "objective-a",
      acceptanceCriteria: Object.freeze(["対象変更を確認できる"]),
    }),
  ]),
  tasks: Object.freeze([
    Object.freeze({
      id: "task-a",
      objectiveId: "objective-a",
      dependencies: Object.freeze([]),
      allowedPaths: Object.freeze(["40_Develop/coordinator/src"]),
      conflictKeys: Object.freeze(["orchestrator-source"]),
    }),
  ]),
});

/**
 * Objective Planは許可Path内の閉じた値だけを受理するを検証する。
 *
 * @responsibility Objective Planは許可Path内の閉じた値だけを受理するの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Objective Planは許可Path内の閉じた値だけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("Objective Planは許可Path内の閉じた値だけを受理する", () => {
  const request = inspectCoordinatorObjectiveRequest(objectiveRequest);
  assert.ok(request);
  const workspaceId = "11111111-1111-1111-1111-111111111111";
  assert.equal(
    inspectCoordinatorObjectiveRequest({ ...objectiveRequest, workspaceId })
      ?.workspaceId,
    workspaceId,
  );
  assert.equal(
    inspectCoordinatorObjectiveRequest({
      ...objectiveRequest,
      workspaceId: "../other",
    }),
    null,
  );
  assert.deepEqual(
    inspectCoordinatorObjectivePlan(COORDINATOR_OBJECTIVE_PLAN, request),
    COORDINATOR_OBJECTIVE_PLAN,
  );
  let getters = 0;
  const accessor = {
    ...COORDINATOR_OBJECTIVE_PLAN,
    get tasks() {
      getters++;
      return COORDINATOR_OBJECTIVE_PLAN.tasks;
    },
  };
  for (const raw of [
    accessor,
    new Proxy(COORDINATOR_OBJECTIVE_PLAN, {}),
    { ...COORDINATOR_OBJECTIVE_PLAN, unknown: true },
  ])
    assert.equal(inspectCoordinatorObjectivePlan(raw, request), null);
  assert.equal(getters, 0);
  assert.equal(
    inspectCoordinatorObjectivePlan(
      {
        ...COORDINATOR_OBJECTIVE_PLAN,
        tasks: [
          {
            ...COORDINATOR_OBJECTIVE_PLAN.tasks[0],
            allowedPaths: ["90_Release"],
          },
        ],
      },
      request,
    ),
    null,
  );
});

/**
 * 外部受付を通らない入力からBinding・保存・Taskを開始しない。
 * @responsibility 受付と内部実行の分離後も要求・主体・Signalの拒否を維持する。
 * @trace PRL-UT-006
 * @precondition 外部処理はすべて到達時に失敗する依存へ差し替える。
 * @stimulus 二入口へ不正要求・主体を渡し、直接受付には不正Signalも渡す。
 * @observation 元の拒否理由と依存への到達0。
 * @oracle 受付失敗からBinding・保存・Taskへ進まない。
 * @cleanup N/A: メモリ内の値だけ。
 * @boundary 外部要求受付と内部実行。実AI・Docker・Filesystemは使用しない。
 */
test("Objectiveの要求・主体・Signal拒否は内部実行への接続前に成立する", async () => {
  const unexpected = () =>
    assert.fail("execution boundary must not be reached");
  const dependencies: Parameters<typeof runCoordinatorObjective>[0] = {
    authenticatedPrincipalId: "principal-a",
    resolveTaskSelections: unexpected,
    verifyProjectBinding: unexpected,
    planObjective: unexpected,
    createTaskExecutions: unexpected,
    observeLeaseOwner: unexpected,
    execution: { runSingleTaskAttempt: unexpected },
  };
  const signal = new AbortController().signal;
  for (const [deps, request, inputSignal] of [
    [dependencies, null, signal],
    [
      { ...dependencies, authenticatedPrincipalId: "" },
      objectiveRequest,
      signal,
    ],
    [dependencies, objectiveRequest, null as unknown as AbortSignal],
  ] as const) {
    const result = await runCoordinatorObjective(deps, request, inputSignal);
    assert.equal(result.reason, "orchestrator_objective_request_invalid");
  }
  const runtimeDependencies = { startTask: unexpected, cancelTask: unexpected };
  const invalid = await executeCoordinatorPublicObjective(
    runtimeDependencies,
    null,
    signal,
  );
  assert.equal(invalid.reason, "orchestrator_objective_request_invalid");
  const unauthenticated = await executeCoordinatorPublicObjective(
    runtimeDependencies,
    objectiveRequest,
    signal,
    undefined,
    { principalId: "" },
  );
  assert.equal(
    unauthenticated.reason,
    "orchestrator_authenticated_principal_not_verified",
  );
});

/**
 * Task実行集合はCoordinatorがTask範囲へAuthority bindingを縮小するを検証する。
 *
 * @responsibility Task実行集合はCoordinatorがTask範囲へAuthority bindingを縮小するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Task実行集合はCoordinatorがTask範囲へAuthority bindingを縮小するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("Task実行集合はOrchestratorがTask範囲へAuthority bindingを縮小する", () => {
  const created = createCoordinatorState({
    taskExecutionSelections: taskExecutionSelections(),
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "a".repeat(40),
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["全Taskを統合できる"],
    objectives: COORDINATOR_OBJECTIVE_PLAN.objectives,
    tasks: COORDINATOR_OBJECTIVE_PLAN.tasks,
    ownerGeneration: "owner-a",
  });
  assert.ok(created.state);
  const taskExecutions = createCoordinatorTaskExecutionSet(
    [{ taskId: "task-a", taskRequest: {}, repositoryRoot: {} }],
    created.state,
    {
      now: () => ({ monotonicMs: 0, iso: "2026-09-06T00:00:00.000Z" }),
      createStableId: (prefix, parts) => `${prefix}-${parts.join("-")}`,
      createContentHash: (content) => content,
    },
  );
  assert.ok(taskExecutions);
  assert.equal(taskExecutions[0]?.taskId, "task-a");
  assert.equal(
    taskExecutions[0]?.authorityBindingId,
    `authority-project-a-milestone-a-${"a".repeat(40)}-objective-a-task-a-0`,
  );
  assert.equal(
    createCoordinatorTaskExecutionSet(
      [
        {
          taskId: "task-a",
          authorityBindingId: "host-supplied",
          taskRequest: {},
          repositoryRoot: {},
        },
      ],
      created.state,
      {
        now: () => ({ monotonicMs: 0, iso: "2026-09-06T00:00:00.000Z" }),
        createStableId: () => "authority-a",
        createContentHash: (content) => content,
      },
    ),
    null,
  );
});

/**
 * Objective結果は入力Identityと終了条件を同じ公開契約へ固定するを検証する。
 *
 * @responsibility Objective結果は入力Identityと終了条件を同じ公開契約へ固定するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Objective結果は入力Identityと終了条件を同じ公開契約へ固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("Objective結果は入力Identityと終了条件を同じ公開契約へ固定する", () => {
  const request = inspectCoordinatorObjectiveRequest(objectiveRequest);
  assert.ok(request);
  assert.deepEqual(
    createCoordinatorObjectiveResult(request, {
      status: "blocked",
      reason: "orchestrator_waiting",
      recoveryIds: ["recovery-a"],
      manualRecoveryRequired: true,
      effectState: "unknown",
    }),
    {
      contract: COORDINATOR_OBJECTIVE_INTAKE_CONTRACT,
      status: "blocked",
      reason: "orchestrator_waiting",
      requestId: "request-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      queueId: null,
      projection: null,
      cleanupConfirmed: true,
      manualRecoveryRequired: true,
      processRestartRequired: false,
      recoveryIds: ["recovery-a"],
      recoveryObligations: [],
      effectState: "unknown",
    },
  );
});

/**
 * 作業領域の変更観測を同じ試行へ結合し、元値から分離する。
 * @responsibility 対象一致、閉入力、重複拒否と一次失敗の保持を確認する。
 * @trace PRL-UT-006
 * @precondition 合成Task結果のみ。
 * @stimulus Direct／Isolated、欠測、不正値と入力後の変更。
 * @observation 結果の同一性、null、不変性、元の失敗field。
 * @oracle 不正値でgetterを実行せず、未知を空観測へ変換しない。
 * @cleanup N/A: 外部資源を取得しない。
 * @boundary 同一Processの値契約。
 */
test("ObjectiveはWorkspace観測をsnapshotし一次失敗を上書きしない", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const entry = {
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: "operation-a",
    result: {
      workspaceId: id,
      changedPaths: ["source.txt"],
      canonicalRepositoryChanged: false,
      changeAttribution: "unattributed" as const,
      workspaceDeletionIssued: false as const,
    },
  };
  const request = { ...objectiveRequest, workspaceId: id };
  const result = createCoordinatorObjectiveResult(request, {
    status: "blocked",
    reason: "primary_failure",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    recoveryIds: ["host-task.a"],
    effectState: "unknown",
    workspaceResults: [entry],
  });
  entry.result.changedPaths.push("later.txt");
  assert.deepEqual(result.workspaceResults?.[0]?.result.changedPaths, [
    "source.txt",
  ]);
  assert.equal(result.reason, "primary_failure");
  assert.deepEqual(result.recoveryIds, ["host-task.a"]);
  assert.equal(
    Object.isFrozen(result.workspaceResults?.[0]?.result.changedPaths),
    true,
  );
  assert.equal(inspectCoordinatorWorkspaceResults([entry], null), null);
  const direct = {
    ...entry,
    result: {
      ...entry.result,
      workspaceId: null,
      canonicalRepositoryChanged: true,
    },
  };
  assert.ok(inspectCoordinatorWorkspaceResults([direct], null));
  assert.equal(inspectCoordinatorWorkspaceResults([direct], id), null);
  assert.equal(
    inspectCoordinatorWorkspaceResults([
      entry,
      { ...direct, attemptId: "attempt-b", operationId: "operation-b" },
    ]),
    null,
  );
  for (const invalid of [
    [],
    null,
    [entry, entry],
    [{ ...entry, extra: true }],
    [{ ...entry, result: { ...entry.result, extra: true } }],
    [
      new Proxy(entry, {
        get() {
          throw new Error("proxy_touched");
        },
      }),
    ],
  ])
    assert.equal(inspectCoordinatorWorkspaceResults(invalid), null);
  let getters = 0;
  const accessor = Object.defineProperty({ ...entry }, "result", {
    enumerable: true,
    get() {
      getters++;
      return entry.result;
    },
  });
  assert.equal(inspectCoordinatorWorkspaceResults([accessor]), null);
  assert.equal(getters, 0);
  const unknown = createCoordinatorObjectiveResult(objectiveRequest, {
    status: "blocked",
    reason: "original_cleanup_failure",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    recoveryIds: ["host-task.a"],
    effectState: "unknown",
    workspaceResults: [entry],
  });
  assert.equal(unknown.workspaceResults, null);
  assert.equal(unknown.reason, "original_cleanup_failure");
  assert.equal(unknown.cleanupConfirmed, false);
});

import { inspectExecutionPlan } from "../../../../execution-model/src/index.ts";
import { normalizeRepositoryRelativePath } from "../../../src/input/snapshot.ts";
import {
  COORDINATOR_OBJECTIVE_INTAKE_CONTRACT,
  inspectCoordinatorObjectiveRequest,
} from "../../../src/objective/plan.ts";
import { inspectCoordinatorProjection } from "../../../src/state/projection.ts";
import { inspectCoordinatorWorkspaceResults } from "../../../src/workspace/record.ts";

/**
 * 旧容量を超える計画を入力・保存定義・公開投影へ接続する。
 * @responsibility 件数と本文量による拒否だけを撤去し、相関と形式の拒否を維持する。
 * @trace PPR-UT-006
 * @precondition 129 Objectiveと1025 Taskの一意な合成計画を用意する。
 * @stimulus 長い本文・129 Path・受入条件と対応する公開投影を検査する。
 * @observation 返却配列長、全文、相関不正と安全整数境界の拒否。
 * @oracle 旧上限超過は受理し、欠測・重複・参照不正・制御文字・範囲逸脱は拒否する。
 * @cleanup N/A: メモリ内の値のみ。
 * @boundary Domainの公開純粋入力・投影。
 */
test("計画と公開投影は旧件数と本文容量を超えても相関を検査する", () => {
  const paths = Array.from({ length: 129 }, (_, index) => `src/path-${index}`);
  const longPath = `src/${"part/".repeat(110)}file.ts`;
  paths.push(longPath);
  const criteria = Array.from(
    { length: 129 },
    (_, index) => `${index}:${"確認".repeat(2049)}`,
  );
  const largePlan = {
    milestoneAcceptanceCriteria: criteria,
    objectives: Array.from({ length: 129 }, (_, index) => ({
      id: `objective-${index}`,
      acceptanceCriteria: criteria,
    })),
    tasks: Array.from({ length: 1025 }, (_, index) => ({
      id: `task-${index}`,
      objectiveId: `objective-${index % 129}`,
      dependencies: [],
      allowedPaths: index === 0 ? paths : ["src/path-0"],
      conflictKeys: [],
    })),
  };
  const validated = inspectExecutionPlan(largePlan, { allowedPaths: paths });
  assert.equal(validated?.objectives.length, 129);
  assert.equal(validated?.tasks.length, 1025);
  assert.equal(normalizeRepositoryRelativePath(longPath), longPath);
  const request = {
    intakeEpoch: "epoch-a",
    requestId: "request-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "a".repeat(40),
    objective: "説明".repeat(16385),
    plan: largePlan,
    taskInputs: largePlan.tasks.map((task) => ({
      taskId: task.id,
      objective: "作業".repeat(16385),
      acceptanceCriteria: ["完了条件"],
      readPaths: ["src/path-0"],
    })),
    acceptanceCriteria: criteria,
    allowedPaths: paths,
    readPaths: paths,
    maximumConcurrency: 5,
    maximumReplans: 32,
    originLane: "interactive",
    adoptResult: false,
  };
  const accepted = inspectCoordinatorObjectiveRequest(request);
  assert.equal(accepted?.objective, request.objective);
  assert.equal(accepted?.taskInputs.length, 1025);
  assert.equal(
    accepted?.taskInputs[1024]?.objective,
    request.taskInputs[1024]?.objective,
  );
  for (const invalid of [
    { ...request, objective: "" },
    { ...request, objective: "invalid\0text" },
    { ...request, allowedPaths: [...paths, paths[0]] },
    { ...request, readPaths: ["../outside"] },
    { ...request, taskInputs: request.taskInputs.slice(1) },
    { ...request, maximumConcurrency: 6 },
    { ...request, maximumReplans: 33 },
  ])
    assert.equal(inspectCoordinatorObjectiveRequest(invalid), null);
  const objectiveCounts = {
    planned: 129,
    executing: 0,
    integration_pending: 0,
    accepted: 0,
    returned: 0,
    blocked: 0,
    cancelled: 0,
  };
  const taskCounts = {
    planned: 0,
    waiting_dependency: 0,
    ready: 1025,
    starting: 0,
    running: 0,
    cleanup_pending: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    recovery_required: 0,
    superseded: 0,
  };
  const projection = {
    projectId: "project-a",
    milestoneId: "milestone-a",
    generation: 1,
    milestoneState: "planned",
    objectiveCounts,
    taskCounts,
    objectiveTaskSummaries: largePlan.objectives.map((objective) => ({
      objectiveId: objective.id,
      objectiveState: "planned",
      taskCounts: {
        ...taskCounts,
        ready: largePlan.tasks.filter(
          (task) => task.objectiveId === objective.id,
        ).length,
      },
    })),
    workProgress: "not_started",
    qualityState: "not_evaluated",
    humanDecisionRequired: false,
    recoveryRequired: false,
    nextAction: "schedule_task",
  };
  assert.equal(
    inspectCoordinatorProjection(projection)?.taskCounts.ready,
    1025,
  );
  for (const ready of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(
      inspectCoordinatorProjection({
        ...projection,
        taskCounts: { ...taskCounts, ready },
      }),
      null,
    );
  assert.equal(
    inspectCoordinatorProjection({
      ...projection,
      taskCounts: { ...taskCounts, ready: Number.MAX_SAFE_INTEGER, running: 1 },
    }),
    null,
  );
  assert.equal(
    inspectCoordinatorProjection({
      ...projection,
      objectiveTaskSummaries: projection.objectiveTaskSummaries.slice(1),
    }),
    null,
  );
});
