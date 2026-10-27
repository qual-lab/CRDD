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
import { taskExecutionSelections } from "../../fixtures/ai-selection.ts";
import assert from "node:assert/strict";
import { withCallerPlan } from "../../../../domain-model/tests/fixtures/execution-plan.ts";
import test from "node:test";

import { createCoordinatorState } from "../../../src/state/create.ts";
import {
  createCoordinatorObjectiveResult,
  createCoordinatorTaskExecutionSet,
  inspectCoordinatorWorkspaceResults,
} from "../../../src/objective/execute.ts";
import {
  inspectCoordinatorObjectivePlan,
  COORDINATOR_OBJECTIVE_INTAKE_CONTRACT,
} from "../../../src/objective/plan.ts";
import { inspectCoordinatorObjectiveRequest } from "../../../src/objective/request.ts";

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
