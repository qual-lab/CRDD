/**
 * project-runtime:unit:objective-intakeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility project-runtime:unit:objective-intakeが所有する検証責務を実行する。
 * @trace PPR-UT-006
 * @trace PRL-UT-007
 * @level UT
 * @scope project、runtime、objective、intake、public
 * @boundary PPR-UT-006=N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。 / PRL-UT-007=N/A: Objective／Milestone Acceptance Decision状態遷移は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  createProjectRuntimeState,
  createProjectRuntimeObjectiveResult,
  createProjectRuntimeTaskExecutionSet,
  inspectProjectRuntimeObjectivePlan,
  inspectProjectRuntimeObjectiveRequest,
  PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT,
} from "../../src/index.ts";

const objectiveRequest = Object.freeze({
  requestId: "request-a",
  projectId: "project-a",
  milestoneId: "milestone-a",
  repositoryRevision: "a".repeat(40),
  objective: "限定された成果物を更新する",
  acceptanceCriteria: Object.freeze(["成果物が受入条件を満たす"]),
  allowedPaths: Object.freeze(["40_Develop/project-runtime"]),
  readPaths: Object.freeze(["06_Architecture/project-runtime"]),
  maximumConcurrency: 2,
  maximumReplans: 1,
  originLane: "interactive" as const,
  adoptResult: false,
});

const PROJECT_RUNTIME_OBJECTIVE_PLAN = Object.freeze({
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
      allowedPaths: Object.freeze(["40_Develop/project-runtime/src"]),
      conflictKeys: Object.freeze(["project-runtime-source"]),
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
 * @boundary PPR-UT-006=N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。
 */
test("Objective Planは許可Path内の閉じた値だけを受理する", () => {
  const request = inspectProjectRuntimeObjectiveRequest(objectiveRequest);
  assert.ok(request);
  assert.deepEqual(
    inspectProjectRuntimeObjectivePlan(PROJECT_RUNTIME_OBJECTIVE_PLAN, request),
    PROJECT_RUNTIME_OBJECTIVE_PLAN,
  );
  assert.equal(
    inspectProjectRuntimeObjectivePlan(
      {
        ...PROJECT_RUNTIME_OBJECTIVE_PLAN,
        tasks: [
          {
            ...PROJECT_RUNTIME_OBJECTIVE_PLAN.tasks[0],
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
 * Task実行集合はProject RuntimeがTask範囲へAuthority bindingを縮小するを検証する。
 *
 * @responsibility Task実行集合はProject RuntimeがTask範囲へAuthority bindingを縮小するの合否判定を所有する。
 * @trace PRL-UT-007
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Task実行集合はProject RuntimeがTask範囲へAuthority bindingを縮小するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-007=N/A: Objective／Milestone Acceptance Decision状態遷移は外部実行境界を持たない。
 */
test("Task実行集合はProject RuntimeがTask範囲へAuthority bindingを縮小する", () => {
  const created = createProjectRuntimeState({
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "a".repeat(40),
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["全Taskを統合できる"],
    objectives: PROJECT_RUNTIME_OBJECTIVE_PLAN.objectives,
    tasks: PROJECT_RUNTIME_OBJECTIVE_PLAN.tasks,
    ownerGeneration: "owner-a",
  });
  assert.ok(created.state);
  const taskExecutions = createProjectRuntimeTaskExecutionSet(
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
    createProjectRuntimeTaskExecutionSet(
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
 * @trace PRL-UT-007
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Objective結果は入力Identityと終了条件を同じ公開契約へ固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-007=N/A: Objective／Milestone Acceptance Decision状態遷移は外部実行境界を持たない。
 */
test("Objective結果は入力Identityと終了条件を同じ公開契約へ固定する", () => {
  const request = inspectProjectRuntimeObjectiveRequest(objectiveRequest);
  assert.ok(request);
  assert.deepEqual(
    createProjectRuntimeObjectiveResult(request, {
      status: "blocked",
      reason: "project_runtime_waiting",
      recoveryIds: ["recovery-a"],
      manualRecoveryRequired: true,
      effectState: "unknown",
    }),
    {
      contract: PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT,
      status: "blocked",
      reason: "project_runtime_waiting",
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
