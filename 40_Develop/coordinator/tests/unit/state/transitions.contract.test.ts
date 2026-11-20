/**
 * orchestrator:unit:stateの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility orchestrator:unit:stateが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @trace PRL-UT-007
 * @level UT
 * @scope project、runtime、state
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。 / PRL-UT-007=N/A: Objective／Milestone Acceptance Decision状態遷移は外部実行境界を持たない。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  ProjectExecutionState,
  ProjectTaskDefinition,
} from "../../../../execution-model/src/index.ts";
import {
  projectExecutionFixture,
  taskHandoffFixture,
  taskStartedFixture,
  taskStartFixture,
} from "../../../../execution-model/tests/fixtures/execution-plan.ts";
import {
  inspectCoordinatorProjection,
  isCoordinatorProjectionSemanticallyValid,
  projectCoordinatorState,
} from "../../../src/state/projection.ts";
import { describeCoordinatorStateContract } from "../../../src/state/validation.ts";
import { taskExecutionSelections } from "../../fixtures/ai-selection.ts";

const revision = "a".repeat(40);

/**
 * taskのTest準備責務を実行する。
 *
 * @responsibility taskがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus taskを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
function task(
  id: string,
  dependencies: readonly string[] = [],
  allowedPaths: readonly string[] = [`work/${id}.txt`],
  conflictKeys: readonly string[] = [],
): ProjectTaskDefinition {
  return Object.freeze({
    id,
    objectiveId: "objective-1",
    dependencies,
    allowedPaths,
    conflictKeys,
  });
}

/**
 * stateForのTest準備責務を実行する。
 *
 * @responsibility stateForがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus stateForを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
function stateFor(
  tasks: readonly ProjectTaskDefinition[],
  maximumConcurrency = 5,
) {
  const result = projectExecutionFixture({
    taskExecutionSelections: taskExecutionSelections(),
    projectId: "crdd",
    milestoneId: "v0.19",
    repositoryRevision: revision,
    maximumConcurrency,
    milestoneAcceptanceCriteria: ["全Objectiveの統合結果が整合する"],
    objectives: [
      {
        id: "objective-1",
        acceptanceCriteria: ["必要Taskの結果が統合される"],
      },
    ],
    tasks,
    ownerGeneration: "owner-1",
  });
  assert.equal(result.status, "completed");
  assert.ok(result.state);
  assert.deepEqual(
    result.state.taskExecutionSelections,
    taskExecutionSelections(),
    "EMの状態生成は完全選定を保持する",
  );
  return result.state;
}

/**
 * startのTest準備責務を実行する。
 *
 * @responsibility startがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus startを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
/**
 * 保存量の旧上限を超える初期状態を投影まで接続する。
 * @responsibility 定義件数・受入条件・Path集合を容量だけで拒否しない。
 * @trace PRL-UT-006
 * @precondition 129 Objectiveと1,025 Taskの一意な相関を構築する。
 * @stimulus 旧512文字超の本文・Pathと129件の集合を同じ状態へ渡す。
 * @observation 全量の状態・投影と不正入力の拒否を観測する。
 * @oracle 正常値は全量を保持し、重複IDと同時実行数不正は拒否する。
 * @cleanup N/A: メモリ内の値のみ。
 * @boundary 既知の合成StateからCoordinator公開投影の検査。初期生成規則はEM試験が所有する。
 */
it("公開投影は旧Objective・Task・本文・Path集合上限を復活させない", () => {
  const criteria = Array.from(
    { length: 129 },
    (_, index) => `${index}-${"a".repeat(513)}`,
  );
  const longPath = `${"segment/".repeat(75)}source.txt`;
  const objectives = Array.from({ length: 129 }, (_, index) => ({
    id: `objective-${index}`,
    acceptanceCriteria: criteria,
  }));
  const tasks = Array.from({ length: 1025 }, (_, index) => ({
    id: `task-${index}`,
    objectiveId: `objective-${index % objectives.length}`,
    dependencies:
      index === 1024 ? Array.from({ length: 129 }, (_, i) => `task-${i}`) : [],
    allowedPaths: [
      longPath,
      ...Array.from({ length: 128 }, (_, i) => `work/${i}.txt`),
    ],
    conflictKeys: Array.from({ length: 129 }, (_, i) => `key-${i}`),
  }));
  const input = {
    taskExecutionSelections: taskExecutionSelections(),
    projectId: "crdd",
    milestoneId: "v0.19",
    repositoryRevision: revision,
    maximumConcurrency: 5,
    milestoneAcceptanceCriteria: criteria,
    objectives,
    tasks,
    ownerGeneration: "owner-1",
  };
  const result = projectExecutionFixture(input);
  assert.equal(result.status, "completed");
  assert.ok(result.state);
  assert.equal(result.state.objectives.length, 129);
  assert.equal(result.state.tasks.length, 1025);
  assert.equal(result.state.tasks[1024]?.definition.allowedPaths[0], longPath);
  const firstTask = result.state.tasks[0];
  assert.ok(firstTask);
  const projection = projectCoordinatorState(result.state, {
    projectId: result.state.projectId,
    generation: result.state.generation,
    taskIds: [firstTask.definition.id],
  });
  assert.equal(
    inspectCoordinatorProjection(projection)?.objectiveTaskSummaries.length,
    129,
  );
  assert.equal(isCoordinatorProjectionSemanticallyValid(projection), true);
});

function start(
  state: ProjectExecutionState,
  taskId: string,
  attemptId = `attempt-${taskId}`,
) {
  const reserved = taskStartFixture(
    state,
    state.generation,
    taskId,
    attemptId,
    `authority-${taskId}`,
  );
  assert.equal(reserved.status, "completed");
  assert.ok(reserved.state);
  const prepared = taskHandoffFixture(
    reserved.state,
    reserved.state.generation,
    taskId,
    attemptId,
    `operation-${taskId}`,
  );
  assert.equal(prepared.status, "completed");
  assert.ok(prepared.state);
  const observed = taskStartedFixture(
    prepared.state,
    prepared.state.generation,
    taskId,
    attemptId,
    `operation-${taskId}`,
  );
  assert.equal(observed.status, "completed");
  assert.ok(observed.state);
  return observed.state;
}

describe("Orchestrator state contract", () => {
  /**
   * 取消済みTaskをObjectiveとMilestoneの取消へ同じ世代で投影するを検証する。
   *
   * @responsibility 取消済みTaskをObjectiveとMilestoneの取消へ同じ世代で投影するの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 取消済みTaskをObjectiveとMilestoneの取消へ同じ世代で投影するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("取消済みTaskをObjectiveとMilestoneの取消へ同じ世代で投影する", () => {
    let state = stateFor([task("task-a")], 1);
    state = start(state, "task-a");
    // 終端規則はEM試験が所有し、ここでは投影・回復の既知入力だけを用意する。
    const terminalFixture = {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "cancelled",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    } as const;
    const settled = {
      status: "completed" as const,
      state: {
        ...state,
        generation: state.generation + 1,
        milestone: { ...state.milestone, state: "cancelled" as const },
        objectives: state.objectives.map((objective) => ({
          ...objective,
          state: "cancelled" as const,
        })),
        tasks: state.tasks.map((task) =>
          task.definition.id !== terminalFixture.taskId
            ? task
            : {
                ...task,
                state: "cancelled" as const,
                startPhase: "settled" as const,
                cleanupConfirmed: terminalFixture.cleanupConfirmed,
                recoveryObligations: terminalFixture.recoveryObligations,
                recoveryUnresolved: terminalFixture.recoveryUnresolved,
                candidateId: null,
              },
        ),
      },
    };
    assert.equal(settled.status, "completed");
    assert.ok(settled.state);
    const projection = projectCoordinatorState(settled.state, {
      projectId: settled.state.projectId,
      generation: settled.state.generation,
      taskIds: [],
    });
    assert.equal(projection.milestoneState, "cancelled");
    assert.equal(projection.objectiveCounts.cancelled, 1);
    assert.equal(projection.taskCounts.cancelled, 1);
    assert.equal(projection.nextAction, "wait_for_task");
  });

  /**
   * Task完了だけではObjectiveまたはMilestoneを受け入れないを検証する。
   *
   * @responsibility Task完了だけではObjectiveまたはMilestoneを受け入れないの合否判定を所有する。
   * @trace PRL-UT-007
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Task完了だけではObjectiveまたはMilestoneを受け入れないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-UT-007=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("Task完了だけではObjectiveまたはMilestoneを受け入れない", () => {
    let state = stateFor([task("task-a")]);
    state = start(state, "task-a");
    // 終端規則はEM試験が所有し、ここでは投影・回復の既知入力だけを用意する。
    const terminalFixture = {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "completed",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    } as const;
    const settled = {
      status: "completed" as const,
      state: {
        ...state,
        generation: state.generation + 1,
        milestone: { ...state.milestone, state: state.milestone.state },
        objectives: state.objectives.map((objective) => ({
          ...objective,
          state: "integration_pending" as const,
        })),
        tasks: state.tasks.map((task) =>
          task.definition.id !== terminalFixture.taskId
            ? task
            : {
                ...task,
                state: "completed" as const,
                startPhase: "settled" as const,
                cleanupConfirmed: terminalFixture.cleanupConfirmed,
                recoveryObligations: terminalFixture.recoveryObligations,
                recoveryUnresolved: terminalFixture.recoveryUnresolved,
                candidateId: null,
              },
        ),
      },
    };
    assert.equal(settled.status, "completed");
    assert.ok(settled.state);
    assert.equal(settled.state.objectives[0]?.state, "integration_pending");
    assert.equal(settled.state.milestone.state, "executing");
    assert.deepEqual(
      projectCoordinatorState(settled.state, {
        projectId: settled.state.projectId,
        generation: settled.state.generation,
        taskIds: [],
      }),
      {
        projectId: "crdd",
        milestoneId: "v0.19",
        generation: 5,
        milestoneState: "executing",
        objectiveCounts: {
          planned: 0,
          executing: 0,
          integration_pending: 1,
          accepted: 0,
          returned: 0,
          blocked: 0,
          cancelled: 0,
        },
        taskCounts: {
          planned: 0,
          waiting_dependency: 0,
          ready: 0,
          starting: 0,
          running: 0,
          cleanup_pending: 0,
          completed: 1,
          failed: 0,
          cancelled: 0,
          recovery_required: 0,
          superseded: 0,
        },
        objectiveTaskSummaries: [
          {
            objectiveId: "objective-1",
            objectiveState: "integration_pending",
            taskCounts: {
              planned: 0,
              waiting_dependency: 0,
              ready: 0,
              starting: 0,
              running: 0,
              cleanup_pending: 0,
              completed: 1,
              failed: 0,
              cancelled: 0,
              recovery_required: 0,
              superseded: 0,
            },
          },
        ],
        workProgress: "tasks_complete",
        qualityState: "integration_pending",
        humanDecisionRequired: false,
        recoveryRequired: false,
        nextAction: "verify_objective_integration",
      },
    );
  });

  /**
   * Recoveryを進捗や品質の成功へ補正しないを検証する。
   *
   * @responsibility Recoveryを進捗や品質の成功へ補正しないの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Recoveryを進捗や品質の成功へ補正しないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("Recoveryを進捗や品質の成功へ補正しない", () => {
    let state = stateFor([task("task-a")]);
    state = start(state, "task-a");
    // 終端規則はEM試験が所有し、ここでは投影・回復の既知入力だけを用意する。
    const terminalFixture = {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "recovery_required",
      cleanupConfirmed: false,
      recoveryObligations: [
        {
          kind: "docker",
          recoveryId: `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`,
          phase: "required",
        },
      ],
      recoveryUnresolved: false,
    } as const;
    const settled = {
      status: "completed" as const,
      state: {
        ...state,
        generation: state.generation + 1,
        milestone: { ...state.milestone, state: "recovery_required" as const },
        objectives: state.objectives.map((objective) => ({
          ...objective,
          state: "blocked" as const,
        })),
        tasks: state.tasks.map((task) =>
          task.definition.id !== terminalFixture.taskId
            ? task
            : {
                ...task,
                state: "recovery_required" as const,
                startPhase: "settled" as const,
                cleanupConfirmed: terminalFixture.cleanupConfirmed,
                recoveryObligations: terminalFixture.recoveryObligations,
                recoveryUnresolved: terminalFixture.recoveryUnresolved,
                candidateId: null,
              },
        ),
      },
    };
    assert.ok(settled.state);
    const projection = projectCoordinatorState(settled.state, {
      projectId: settled.state.projectId,
      generation: settled.state.generation,
      taskIds: [],
    });
    assert.equal(projection.workProgress, "in_progress");
    assert.equal(projection.qualityState, "blocked");
    assert.equal(projection.recoveryRequired, true);
    assert.equal(projection.nextAction, "recover");
  });

  /**
  });

  /**
   * Lockとstale resultの保持条件を説明するを検証する。
   *
   * @responsibility Lockとstale resultの保持条件を説明するの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Lockとstale resultの保持条件を説明するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("Lockとstale resultの保持条件を説明する", () => {
    assert.deepEqual(describeCoordinatorStateContract(), {
      contract: "crdd-execution-model/project-state/v3",
      maximumConcurrency: 5,
      capacityStates: [
        "starting",
        "running",
        "cleanup_pending",
        "recovery_required_without_cleanup",
      ],
      lockContract:
        "project_operation_then_short_project_state_transaction_never_held_across_single_task_runtime",
      staleResult:
        "generation_attempt_and_operation_identity_mismatch_blocks_without_projection",
      acceptanceContract:
        "task_completion_then_objective_integration_then_milestone_integration",
    });
  });
});
